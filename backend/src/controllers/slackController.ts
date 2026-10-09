import { Request, Response } from 'express';
import slackService from '../services/slackService.js';
import { config } from '../config/env.js';
import prisma from '../config/db.js';

export class SlackController {
  /**
   * Get OAuth URL for "Connect Slack" button
   */
  public getAuthUrl(req: Request, res: Response) {
    const userId = (req.query.userId as string) || '';
    const url = slackService.getOAuthAuthorizeUrl(userId);
    return res.json({
      url,
      hasCredentials: Boolean(config.slack.clientId),
    });
  }

  /**
   * Slack OAuth callback handler
   */
  public async handleCallback(req: Request, res: Response) {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string; // userId passed via state param

      if (!code) {
        return res.redirect(`${config.frontendUrl}?slack=error&message=No+code+received`);
      }

      const result = await slackService.handleOAuthCallback(code, state);

      if (result.success) {
        return res.redirect(`${config.frontendUrl}?slack=connected&channel=${encodeURIComponent(result.channel || '')}`);
      } else {
        return res.redirect(`${config.frontendUrl}?slack=error&message=${encodeURIComponent(result.error || 'Failed')}`);
      }
    } catch (error: any) {
      console.error('[SlackController] Callback error:', error);
      return res.redirect(`${config.frontendUrl}?slack=error&message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Connect Slack directly via Webhook URL (ideal for demoing or local dev)
   */
  public async connectWebhook(req: Request, res: Response) {
    try {
      const { userId, webhookUrl, channel } = req.body;

      if (!userId || !webhookUrl) {
        return res.status(400).json({ error: 'userId and webhookUrl are required' });
      }

      const success = await slackService.connectWebhook(userId, webhookUrl, channel);
      if (success) {
        return res.json({ success: true, message: 'Slack connected and test notification dispatched!' });
      } else {
        return res.status(500).json({ error: 'Failed to connect Slack webhook' });
      }
    } catch (error: any) {
      console.error('[SlackController] Connect webhook error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Disconnect Slack
   */
  public async disconnect(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const success = await slackService.disconnect(userId);
      return res.json({ success });
    } catch (error: any) {
      console.error('[SlackController] Disconnect error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Send test message to Slack
   */
  public async sendTest(req: Request, res: Response) {
    try {
      const { userId, senderEmail = 'test-sender@reachinbox.ai' } = req.body;
      const result = await slackService.notifyRateLimitHit({
        userId,
        senderEmail,
        hourlyLimit: 50,
        currentCount: 50,
        hourWindow: '2026-10-09T12',
        rescheduledTime: new Date(Date.now() + 1800000),
      });

      return res.json(result);
    } catch (error: any) {
      console.error('[SlackController] Test notification error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}

export const slackController = new SlackController();
export default slackController;
