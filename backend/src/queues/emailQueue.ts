import { Queue, QueueEvents } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';

export const EMAIL_QUEUE_NAME = 'email-scheduler';

export interface EmailJobData {
  emailId: string;
  userId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  hourlyLimit?: number | null;
  delayBetweenEmailsMs?: number | null;
  scheduledAt: string;
  attempt?: number;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600 * 24 * 7, // Keep completed jobs for 7 days
      count: 10000,
    },
    removeOnFail: {
      age: 3600 * 24 * 14,
      count: 10000,
    },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
});

/**
 * Adds an email job to the BullMQ persistent queue with delayed scheduling
 */
export async function scheduleEmailJob(data: EmailJobData, delayMs: number) {
  const safeDelay = Math.max(0, delayMs);
  const job = await emailQueue.add('send-email', data, {
    delay: safeDelay,
    jobId: data.emailId, // Idempotency key: prevents duplicates across restarts and retries
  });
  console.log(`[Queue] Scheduled job ${job.id} for email ${data.recipientEmail} with delay ${safeDelay}ms`);
  return job;
}

/**
 * Reschedules an existing email job into a new delay window (e.g. rate limit window)
 */
export async function rescheduleEmailJob(data: EmailJobData, delayMs: number) {
  const safeDelay = Math.max(1000, delayMs);
  const newJobId = `${data.emailId}-rescheduled-${Date.now()}`;
  const job = await emailQueue.add('send-email', data, {
    delay: safeDelay,
    jobId: newJobId,
  });
  console.log(`[Queue] Rescheduled job ${newJobId} for email ${data.recipientEmail} with delay ${safeDelay}ms`);
  return job;
}

/**
 * Cancels a scheduled job in BullMQ
 */
export async function cancelEmailJob(jobId: string): Promise<boolean> {
  const job = await emailQueue.getJob(jobId);
  if (job) {
    await job.remove();
    return true;
  }
  return false;
}

export default emailQueue;
