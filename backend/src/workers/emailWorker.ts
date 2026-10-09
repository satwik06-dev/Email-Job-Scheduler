import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData, rescheduleEmailJob } from '../queues/emailQueue.js';
import { redisConnectionOptions } from '../config/redis.js';
import { config } from '../config/env.js';
import prisma from '../config/db.js';
import smtpService from '../services/smtpService.js';
import rateLimiterService from '../services/rateLimiterService.js';
import elasticSearchService from '../services/elasticSearchService.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Worker processor function for email jobs
 */
export async function processEmailJob(job: Job<EmailJobData>) {
  const { emailId, senderEmail, recipientEmail, subject, body, hourlyLimit, delayBetweenEmailsMs, userId } = job.data;
  console.log(`[Worker] Processing email job ${job.id} for ${recipientEmail} from ${senderEmail}`);

  // 1. Verify email exists in DB and is in a valid state
  const dbEmail = await prisma.emailJob.findUnique({
    where: { id: emailId },
  });

  if (!dbEmail) {
    console.warn(`[Worker] Email record ${emailId} not found in database. Skipping.`);
    return { status: 'skipped', reason: 'Email not found in database' };
  }

  // Idempotency check: if already sent or cancelled, do not resend
  if (dbEmail.status === 'SENT') {
    console.log(`[Worker] Email ${emailId} has already been sent. Skipping duplicate send.`);
    return { status: 'already_sent' };
  }
  if (dbEmail.status === 'CANCELLED') {
    console.log(`[Worker] Email ${emailId} has been cancelled by user. Skipping.`);
    return { status: 'cancelled' };
  }

  // 2. Rate Limiting Check (Atomic sliding hour window per sender)
  const rateLimitResult = await rateLimiterService.checkAndIncrement(
    senderEmail,
    hourlyLimit || dbEmail.hourlyLimit,
    userId || dbEmail.userId
  );

  if (!rateLimitResult.allowed) {
    console.warn(
      `[Worker] Rate limit reached for sender ${senderEmail} (${rateLimitResult.currentSenderCount}/${rateLimitResult.senderLimit} emails/hr). Rescheduling job to next hour window...`
    );

    // Update status in DB to RESCHEDULED_RATE_LIMIT
    await prisma.emailJob.update({
      where: { id: emailId },
      data: {
        status: 'RESCHEDULED_RATE_LIMIT',
        scheduledAt: rateLimitResult.rescheduledTime,
      },
    });

    // Re-index into Elasticsearch with new status
    await elasticSearchService.indexEmail({
      id: dbEmail.id,
      userId: dbEmail.userId,
      senderEmail: dbEmail.senderEmail,
      recipientEmail: dbEmail.recipientEmail,
      subject: dbEmail.subject,
      body: dbEmail.body,
      status: 'RESCHEDULED_RATE_LIMIT',
      scheduledAt: rateLimitResult.rescheduledTime.toISOString(),
      createdAt: dbEmail.createdAt.toISOString(),
    });

    // Reschedule in BullMQ with the calculated delay until next window starts
    await rescheduleEmailJob(job.data, rateLimitResult.rescheduleDelayMs);

    return {
      status: 'rescheduled_rate_limit',
      senderEmail,
      hourWindow: rateLimitResult.hourWindow,
      nextWindow: rateLimitResult.rescheduledTime,
      delayMs: rateLimitResult.rescheduleDelayMs,
    };
  }

  // 3. Provider throttling delay (Delay Between Each Email)
  const interEmailDelay = delayBetweenEmailsMs || config.worker.minDelayBetweenEmailsMs;
  if (interEmailDelay > 0) {
    console.log(`[Worker] Applying inter-email throttling delay of ${interEmailDelay}ms...`);
    await sleep(interEmailDelay);
  }

  // 4. Mark DB status as SENDING
  await prisma.emailJob.update({
    where: { id: emailId },
    data: { status: 'SENDING' },
  });

  // 5. Send Email via Fake SMTP (Ethereal)
  const sendResult = await smtpService.sendEmail({
    from: senderEmail,
    to: recipientEmail,
    subject,
    html: body,
  });

  const now = new Date();

  if (sendResult.success) {
    // 6. Update DB to SENT with preview URL
    const updated = await prisma.emailJob.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: now,
        etherealPreviewUrl: sendResult.previewUrl || null,
        errorMessage: null,
      },
    });

    // 7. Update Elasticsearch
    await elasticSearchService.indexEmail({
      id: updated.id,
      userId: updated.userId,
      senderEmail: updated.senderEmail,
      recipientEmail: updated.recipientEmail,
      subject: updated.subject,
      body: updated.body,
      status: 'SENT',
      scheduledAt: updated.scheduledAt.toISOString(),
      sentAt: now.toISOString(),
      etherealPreviewUrl: sendResult.previewUrl || null,
      createdAt: updated.createdAt.toISOString(),
    });

    console.log(`[Worker] Email ${emailId} successfully delivered! Ethereal URL: ${sendResult.previewUrl}`);
    return {
      status: 'sent',
      emailId,
      previewUrl: sendResult.previewUrl,
    };
  } else {
    // 8. Update DB to FAILED
    const updated = await prisma.emailJob.update({
      where: { id: emailId },
      data: {
        status: 'FAILED',
        errorMessage: sendResult.error || 'SMTP delivery failure',
        retryCount: { increment: 1 },
      },
    });

    await elasticSearchService.indexEmail({
      id: updated.id,
      userId: updated.userId,
      senderEmail: updated.senderEmail,
      recipientEmail: updated.recipientEmail,
      subject: updated.subject,
      body: updated.body,
      status: 'FAILED',
      scheduledAt: updated.scheduledAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    });

    throw new Error(sendResult.error || 'Failed to deliver email');
  }
}

/**
 * Initializes and exports the BullMQ Worker with configurable concurrency
 */
export function createEmailWorker() {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: redisConnectionOptions,
    concurrency: config.worker.concurrency, // Configurable worker concurrency
  });

  worker.on('active', (job) => {
    console.log(`[Worker] Started processing job ${job.id}`);
  });

  worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed. Result:`, result);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, error.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker internal error:', err);
  });

  console.log(`[Worker] BullMQ email worker started with concurrency = ${config.worker.concurrency}`);
  return worker;
}

export default createEmailWorker;
