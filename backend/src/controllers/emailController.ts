import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/db.js';
import { emailQueue, scheduleEmailJob, cancelEmailJob } from '../queues/emailQueue.js';
import elasticSearchService from '../services/elasticSearchService.js';
import rateLimiterService from '../services/rateLimiterService.js';
import { config } from '../config/env.js';

export class EmailController {
  /**
   * Schedule new email(s)
   */
  public async scheduleEmails(req: Request, res: Response) {
    try {
      const {
        senderEmail,
        recipientEmails,
        subject,
        body,
        startTime,
        delayBetweenEmailsMs,
        hourlyLimit,
        userId,
      } = req.body;

      if (!senderEmail || !subject || !body) {
        return res.status(400).json({ error: 'senderEmail, subject, and body are required' });
      }

      const recipients: string[] = Array.isArray(recipientEmails)
        ? recipientEmails
        : typeof recipientEmails === 'string'
        ? [recipientEmails]
        : [];

      if (recipients.length === 0) {
        return res.status(400).json({ error: 'At least one recipient email is required' });
      }

      const baseStartTime = startTime ? new Date(startTime).getTime() : Date.now();
      const delayBetween = typeof delayBetweenEmailsMs === 'number'
        ? delayBetweenEmailsMs
        : config.worker.minDelayBetweenEmailsMs;
      const limit = typeof hourlyLimit === 'number'
        ? hourlyLimit
        : config.worker.maxEmailsPerHourPerSender;

      const batchId = uuidv4();
      const scheduledEmails = [];
      const now = Date.now();

      // Iterate through recipients and space them out with delay
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i].trim();
        if (!recipient) continue;

        // Space out each email by the user-specified delay
        const targetSendTimeMs = baseStartTime + i * delayBetween;
        const delayMs = Math.max(0, targetSendTimeMs - now);
        const scheduledDate = new Date(targetSendTimeMs);

        // 1. Create DB record
        const emailRecord = await prisma.emailJob.create({
          data: {
            userId: userId || null,
            senderEmail: senderEmail.trim(),
            recipientEmail: recipient,
            subject: subject.trim(),
            body,
            scheduledAt: scheduledDate,
            status: 'SCHEDULED',
            hourlyLimit: limit,
            delayBetweenEmailsMs: delayBetween,
            batchId,
          },
        });

        // 2. Schedule in BullMQ with delay
        const bullJob = await scheduleEmailJob(
          {
            emailId: emailRecord.id,
            userId: emailRecord.userId,
            senderEmail: emailRecord.senderEmail,
            recipientEmail: emailRecord.recipientEmail,
            subject: emailRecord.subject,
            body: emailRecord.body,
            hourlyLimit: limit,
            delayBetweenEmailsMs: delayBetween,
            scheduledAt: scheduledDate.toISOString(),
          },
          delayMs
        );

        // Update bullJobId in DB
        await prisma.emailJob.update({
          where: { id: emailRecord.id },
          data: { bullJobId: bullJob.id },
        });

        // 3. Index in Elasticsearch
        await elasticSearchService.indexEmail({
          id: emailRecord.id,
          userId: emailRecord.userId,
          senderEmail: emailRecord.senderEmail,
          recipientEmail: emailRecord.recipientEmail,
          subject: emailRecord.subject,
          body: emailRecord.body,
          status: 'SCHEDULED',
          scheduledAt: scheduledDate.toISOString(),
          createdAt: emailRecord.createdAt.toISOString(),
        });

        scheduledEmails.push({
          ...emailRecord,
          bullJobId: bullJob.id,
        });
      }

      return res.status(201).json({
        success: true,
        message: `Successfully scheduled ${scheduledEmails.length} email(s)`,
        batchId,
        count: scheduledEmails.length,
        emails: scheduledEmails,
      });
    } catch (error: any) {
      console.error('[EmailController] Scheduling error:', error);
      return res.status(500).json({ error: error.message || 'Failed to schedule emails' });
    }
  }

  /**
   * Upload leads CSV or text file and extract email addresses
   */
  public async uploadLeads(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload a CSV or TXT file' });
      }

      const fileBuffer = req.file.buffer.toString('utf-8');
      // Extract emails using regex across the uploaded text/CSV
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = fileBuffer.match(emailRegex) || [];

      // Deduplicate and lower-case
      const uniqueEmails = Array.from(new Set(matches.map((e) => e.toLowerCase().trim())));

      return res.json({
        success: true,
        filename: req.file.originalname,
        count: uniqueEmails.length,
        emails: uniqueEmails,
      });
    } catch (error: any) {
      console.error('[EmailController] Upload leads error:', error);
      return res.status(500).json({ error: error.message || 'Failed to parse leads file' });
    }
  }

  /**
   * Get scheduled emails list
   */
  public async getScheduledEmails(req: Request, res: Response) {
    try {
      const { page = '1', limit = '50', senderEmail, userId } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        status: { in: ['SCHEDULED', 'RESCHEDULED_RATE_LIMIT'] },
      };

      if (senderEmail) {
        where.senderEmail = senderEmail as string;
      }
      if (userId) {
        where.userId = userId as string;
      }

      const [total, emails] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limitNum,
        }),
      ]);

      return res.json({
        emails,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error: any) {
      console.error('[EmailController] Get scheduled emails error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch scheduled emails' });
    }
  }

  /**
   * Get sent emails list
   */
  public async getSentEmails(req: Request, res: Response) {
    try {
      const { page = '1', limit = '50', senderEmail, userId } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        status: { in: ['SENT', 'FAILED'] },
      };

      if (senderEmail) {
        where.senderEmail = senderEmail as string;
      }
      if (userId) {
        where.userId = userId as string;
      }

      const [total, emails] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limitNum,
        }),
      ]);

      return res.json({
        emails,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error: any) {
      console.error('[EmailController] Get sent emails error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch sent emails' });
    }
  }

  /**
   * Search emails via Elasticsearch
   */
  public async searchEmails(req: Request, res: Response) {
    try {
      const query = (req.query.q as string) || '';
      const status = req.query.status as string | undefined;
      const userId = req.query.userId as string | undefined;

      const results = await elasticSearchService.searchEmails(query, { status, userId });
      return res.json({
        query,
        count: results.length,
        results,
      });
    } catch (error: any) {
      console.error('[EmailController] Search error:', error);
      return res.status(500).json({ error: error.message || 'Failed to perform search' });
    }
  }

  /**
   * Cancel a scheduled email
   */
  public async cancelEmail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const email = await prisma.emailJob.findUnique({ where: { id } });

      if (!email) {
        return res.status(404).json({ error: 'Email not found' });
      }

      if (email.status === 'SENT') {
        return res.status(400).json({ error: 'Cannot cancel an email that is already sent' });
      }

      // Cancel in BullMQ
      if (email.bullJobId) {
        await cancelEmailJob(email.bullJobId);
      }
      await cancelEmailJob(email.id);

      // Update DB
      const updated = await prisma.emailJob.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Update Elasticsearch
      await elasticSearchService.indexEmail({
        id: updated.id,
        userId: updated.userId,
        senderEmail: updated.senderEmail,
        recipientEmail: updated.recipientEmail,
        subject: updated.subject,
        body: updated.body,
        status: 'CANCELLED',
        scheduledAt: updated.scheduledAt.toISOString(),
        createdAt: updated.createdAt.toISOString(),
      });

      return res.json({ success: true, message: 'Email schedule cancelled' });
    } catch (error: any) {
      console.error('[EmailController] Cancel email error:', error);
      return res.status(500).json({ error: error.message || 'Failed to cancel email' });
    }
  }

  /**
   * Get queue, sender, and email statistics
   */
  public async getStats(req: Request, res: Response) {
    try {
      const [scheduledCount, sentCount, failedCount, rescheduledCount] = await Promise.all([
        prisma.emailJob.count({ where: { status: 'SCHEDULED' } }),
        prisma.emailJob.count({ where: { status: 'SENT' } }),
        prisma.emailJob.count({ where: { status: 'FAILED' } }),
        prisma.emailJob.count({ where: { status: 'RESCHEDULED_RATE_LIMIT' } }),
      ]);

      const bullJobCounts = await emailQueue.getJobCounts();

      // Retrieve distinct senders to report current hourly rates
      const distinctSenders = await prisma.emailJob.findMany({
        select: { senderEmail: true },
        distinct: ['senderEmail'],
        take: 10,
      });

      const senderStats = await Promise.all(
        distinctSenders.map(async (s) => ({
          senderEmail: s.senderEmail,
          currentHourCount: await rateLimiterService.getSenderCurrentCount(s.senderEmail),
          hourlyLimit: config.worker.maxEmailsPerHourPerSender,
        }))
      );

      return res.json({
        db: {
          scheduled: scheduledCount,
          sent: sentCount,
          failed: failedCount,
          rescheduledRateLimit: rescheduledCount,
          total: scheduledCount + sentCount + failedCount + rescheduledCount,
        },
        queue: bullJobCounts,
        senders: senderStats,
        elasticsearch: elasticSearchService.getStatus(),
      });
    } catch (error: any) {
      console.error('[EmailController] Get stats error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch stats' });
    }
  }
}

export const emailController = new EmailController();
export default emailController;
