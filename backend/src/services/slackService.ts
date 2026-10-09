import axios from 'axios';
import { config } from '../config/env.js';
import prisma from '../config/db.js';

interface SlackRateLimitNotificationParams {
  userId?: string | null;
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  hourWindow: string;
  rescheduledTime: Date;
  delayedJobsCount?: number;
}

export class SlackService {
  /**
   * Generates the Slack OAuth v2 authorize URL
   */
  public getOAuthAuthorizeUrl(state?: string): string {
    if (!config.slack.clientId) {
      return '';
    }
    const scopes = encodeURIComponent('incoming-webhook,chat:write');
    const redirectUri = encodeURIComponent(config.slack.redirectUri);
    const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
    return `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scopes}&redirect_uri=${redirectUri}${stateParam}`;
  }

  /**
   * Handles exchanging code for token & incoming webhook
   */
  public async handleOAuthCallback(code: string, userId?: string): Promise<{
    success: boolean;
    teamName?: string;
    channel?: string;
    error?: string;
  }> {
    try {
      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          code,
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          redirect_uri: config.slack.redirectUri,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const data = response.data;
      if (!data.ok) {
        throw new Error(data.error || 'Slack OAuth exchange failed');
      }

      const slackToken = data.access_token;
      const slackWebhookUrl = data.incoming_webhook?.url;
      const slackChannel = data.incoming_webhook?.channel;
      const slackTeamName = data.team?.name;

      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            slackToken,
            slackWebhookUrl,
            slackChannel,
            slackTeamName,
            slackConnected: true,
          },
        });
      }

      console.log(`[Slack] Connected to workspace "${slackTeamName}", channel "${slackChannel}"`);
      return {
        success: true,
        teamName: slackTeamName,
        channel: slackChannel,
      };
    } catch (error: any) {
      console.error('[Slack] OAuth error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Connects Slack directly via Incoming Webhook URL (useful for local dev or custom webhook testing)
   */
  public async connectWebhook(userId: string, webhookUrl: string, channel = '#email-alerts', teamName = 'Workspace'): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          slackWebhookUrl: webhookUrl,
          slackChannel: channel,
          slackTeamName: teamName,
          slackConnected: true,
        },
      });

      // Send verification message
      await this.sendRawWebhook(webhookUrl, {
        text: ' ReachInbox Scheduler connected to this Slack channel successfully! You will receive instant notifications when sender rate limits are triggered.',
      });

      return true;
    } catch (error: any) {
      console.error('[Slack] Failed to connect webhook:', error.message);
      return false;
    }
  }

  /**
   * Disconnects Slack for a user/tenant
   */
  public async disconnect(userId: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          slackToken: null,
          slackWebhookUrl: null,
          slackChannel: null,
          slackTeamName: null,
          slackConnected: false,
        },
      });
      console.log(`[Slack] Disconnected Slack for user ${userId}`);
      return true;
    } catch (error: any) {
      console.error('[Slack] Failed to disconnect Slack:', error.message);
      return false;
    }
  }

  /**
   * Sends rate limit alert message to Slack
   */
  public async notifyRateLimitHit(params: SlackRateLimitNotificationParams): Promise<{ notified: boolean; reason?: string }> {
    try {
      // Find user connection or fallback to default configured webhook
      let webhookUrl: string | null = config.slack.defaultWebhookUrl || null;
      let targetUser = null;

      if (params.userId) {
        targetUser = await prisma.user.findUnique({
          where: { id: params.userId },
        });
        if (targetUser?.slackConnected && targetUser.slackWebhookUrl) {
          webhookUrl = targetUser.slackWebhookUrl;
        }
      }

      if (!webhookUrl) {
        // Try to find any active user with Slack connected
        const anyConnectedUser = await prisma.user.findFirst({
          where: { slackConnected: true, slackWebhookUrl: { not: null } },
        });
        if (anyConnectedUser?.slackWebhookUrl) {
          webhookUrl = anyConnectedUser.slackWebhookUrl;
        }
      }

      if (!webhookUrl) {
        console.log(`[Slack] Rate limit hit for ${params.senderEmail}, but no Slack integration is connected. Skipping notification gracefully.`);
        return { notified: false, reason: 'No Slack connected' };
      }

      const formattedNextTime = new Date(params.rescheduledTime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const payload = {
        text: `⚠️ *ReachInbox Rate Limit Alert*: Sender \`${params.senderEmail}\` hit hourly threshold!`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ Email Scheduler Rate Limit Triggered',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender:*\n\`${params.senderEmail}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Limit:*\n${params.hourlyLimit} emails/hr`,
              },
              {
                type: 'mrkdwn',
                text: `*Window:*\n${params.hourWindow}`,
              },
              {
                type: 'mrkdwn',
                text: `*Current Sent:*\n${params.currentCount} emails`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🔄 *Auto-Reschedule Action Taken:*\nExceeded jobs have *NOT* been dropped. They are automatically queued and postponed to the next available hour window at *${formattedNextTime}*.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `⚡ ReachInbox Production Scheduler • Live BullMQ Worker alert • ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      };

      const res = await axios.post(webhookUrl, payload, { timeout: 6000 });
      console.log(`[Slack] Live rate limit notification successfully dispatched to Slack for sender ${params.senderEmail}! Status: ${res.status}`);
      return { notified: true };
    } catch (error: any) {
      console.error('[Slack] Failed to dispatch Slack message:', error.message);
      return { notified: false, reason: error.message };
    }
  }

  private async sendRawWebhook(webhookUrl: string, payload: any): Promise<void> {
    await axios.post(webhookUrl, payload, { timeout: 6000 });
  }
}

export const slackService = new SlackService();
export default slackService;
