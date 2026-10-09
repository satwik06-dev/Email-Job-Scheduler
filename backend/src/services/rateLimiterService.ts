import redisClient from '../config/redis.js';
import { config } from '../config/env.js';
import prisma from '../config/db.js';
import slackService from './slackService.js';

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: 'sender_limit_exceeded' | 'global_limit_exceeded';
  currentSenderCount: number;
  senderLimit: number;
  currentGlobalCount: number;
  globalLimit: number;
  hourWindow: string;
  rescheduleDelayMs: number;
  rescheduledTime: Date;
}

export class RateLimiterService {
  /**
   * Helper to get current hour window string, e.g. "2026-10-09T12"
   */
  public getHourWindow(date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}`;
  }

  /**
   * Calculates milliseconds until the start of the next UTC hour window
   */
  public getMsUntilNextHourWindow(date = new Date()): { delayMs: number; nextWindowStart: Date } {
    const nextWindow = new Date(date);
    nextWindow.setUTCMinutes(0, 0, 0);
    nextWindow.setUTCHours(nextWindow.getUTCHours() + 1);

    const diff = nextWindow.getTime() - date.getTime();
    // Add 1000ms safety buffer
    const delayMs = Math.max(1000, diff + 1000);
    return { delayMs, nextWindowStart: nextWindow };
  }

  /**
   * Atomically checks and reserves an email send slot for sender within the current hour.
   * Multi-worker safe via Redis atomic evaluation.
   */
  public async checkAndIncrement(
    senderEmail: string,
    customSenderLimit?: number | null,
    userId?: string | null
  ): Promise<RateLimitCheckResult> {
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const { delayMs, nextWindowStart } = this.getMsUntilNextHourWindow(now);

    const senderLimit = customSenderLimit || config.worker.maxEmailsPerHourPerSender;
    const globalLimit = config.worker.maxEmailsPerHour;

    const senderKey = `ratelimit:sender:${senderEmail.toLowerCase()}:${hourWindow}`;
    const globalKey = `ratelimit:global:${hourWindow}`;
    const ttlSeconds = 3600 * 2; // 2 hour TTL for clean persistence

    // Atomic Lua script to prevent race conditions across parallel BullMQ workers
    const luaScript = `
      local sender_key = KEYS[1]
      local global_key = KEYS[2]
      local sender_limit = tonumber(ARGV[1])
      local global_limit = tonumber(ARGV[2])
      local ttl = tonumber(ARGV[3])

      local sender_count = tonumber(redis.call('GET', sender_key) or '0')
      if sender_count >= sender_limit then
        return {0, sender_count, 'sender_limit_exceeded'}
      end

      local global_count = tonumber(redis.call('GET', global_key) or '0')
      if global_count >= global_limit then
        return {0, global_count, 'global_limit_exceeded'}
      end

      local new_sender = redis.call('INCR', sender_key)
      if new_sender == 1 then
        redis.call('EXPIRE', sender_key, ttl)
      end

      local new_global = redis.call('INCR', global_key)
      if new_global == 1 then
        redis.call('EXPIRE', global_key, ttl)
      end

      return {1, new_sender, 'ok'}
    `;

    try {
      const result = (await redisClient.eval(
        luaScript,
        2,
        senderKey,
        globalKey,
        senderLimit.toString(),
        globalLimit.toString(),
        ttlSeconds.toString()
      )) as [number, number, string];

      const [allowedCode, currentCount, statusMsg] = result;
      const allowed = allowedCode === 1;

      if (!allowed) {
        // Limit hit! Trigger Slack notification if not already notified in this window
        await this.handleRateLimitHitNotification({
          senderEmail,
          userId,
          hourWindow,
          hourlyLimit: senderLimit,
          currentCount,
          rescheduledTime: nextWindowStart,
        });

        return {
          allowed: false,
          reason: statusMsg as any,
          currentSenderCount: currentCount,
          senderLimit,
          currentGlobalCount: 0,
          globalLimit,
          hourWindow,
          rescheduleDelayMs: delayMs,
          rescheduledTime: nextWindowStart,
        };
      }

      return {
        allowed: true,
        currentSenderCount: currentCount,
        senderLimit,
        currentGlobalCount: 0,
        globalLimit,
        hourWindow,
        rescheduleDelayMs: 0,
        rescheduledTime: now,
      };
    } catch (error: any) {
      console.error('[RateLimiter] Error running Redis rate limit script:', error.message);
      // Fallback in case of temporary Redis error: allow job or record in DB
      return {
        allowed: true,
        currentSenderCount: 1,
        senderLimit,
        currentGlobalCount: 1,
        globalLimit,
        hourWindow,
        rescheduleDelayMs: 0,
        rescheduledTime: now,
      };
    }
  }

  /**
   * Dispatches Slack alert once per sender per hour window
   */
  private async handleRateLimitHitNotification(params: {
    senderEmail: string;
    userId?: string | null;
    hourWindow: string;
    hourlyLimit: number;
    currentCount: number;
    rescheduledTime: Date;
  }) {
    const notifyThrottleKey = `ratelimit:notified:${params.senderEmail.toLowerCase()}:${params.hourWindow}`;
    const alreadyNotified = await redisClient.get(notifyThrottleKey);

    if (!alreadyNotified) {
      // Set throttle key so Slack isn't spammed for every single postponed job
      await redisClient.set(notifyThrottleKey, '1', 'EX', 3600);

      // Log in DB for persistent audit
      try {
        await prisma.rateLimitLog.upsert({
          where: {
            senderEmail_hourWindow: {
              senderEmail: params.senderEmail,
              hourWindow: params.hourWindow,
            },
          },
          update: {
            count: params.currentCount,
            limitHitAt: new Date(),
            notifiedAt: new Date(),
          },
          create: {
            senderEmail: params.senderEmail,
            hourWindow: params.hourWindow,
            count: params.currentCount,
            limitHitAt: new Date(),
            notifiedAt: new Date(),
          },
        });
      } catch (err: any) {
        console.warn('[RateLimiter] DB rate limit log upsert error:', err.message);
      }

      // Live verifiable call to Slack
      console.log(`[RateLimiter] Rate limit exceeded for ${params.senderEmail} in window ${params.hourWindow}. Triggering Slack notification...`);
      await slackService.notifyRateLimitHit({
        senderEmail: params.senderEmail,
        userId: params.userId,
        hourlyLimit: params.hourlyLimit,
        currentCount: params.currentCount,
        hourWindow: params.hourWindow,
        rescheduledTime: params.rescheduledTime,
      });
    }
  }

  /**
   * Helper to retrieve current count for dashboard/monitoring
   */
  public async getSenderCurrentCount(senderEmail: string): Promise<number> {
    const hourWindow = this.getHourWindow();
    const key = `ratelimit:sender:${senderEmail.toLowerCase()}:${hourWindow}`;
    const val = await redisClient.get(key);
    return val ? parseInt(val, 10) : 0;
  }
}

export const rateLimiterService = new RateLimiterService();
export default rateLimiterService;
