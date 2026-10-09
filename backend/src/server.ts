import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config/env.js';
import { emailQueue, scheduleEmailJob } from './queues/emailQueue.js';
import { createEmailWorker } from './workers/emailWorker.js';
import apiRouter from './routes/api.js';
import prisma from './config/db.js';
import smtpService from './services/smtpService.js';
import elasticSearchService from './services/elasticSearchService.js';

const app = express();

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bull-Board UI Setup
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue as any) as any],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', async (_req, res) => {
  const queueCounts = await emailQueue.getJobCounts();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    queue: queueCounts,
    elasticsearch: elasticSearchService.getStatus(),
  });
});

/**
 * Startup Reconciliation to ensure persistence across server restarts
 * If the server restarts, future scheduled emails are still sent at the correct time,
 * and past-due emails are immediately picked up without duplication.
 */
async function reconcileScheduledEmailsOnStartup() {
  console.log('[Startup] Running job reconciliation check for scheduled emails...');
  try {
    const pendingEmails = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RESCHEDULED_RATE_LIMIT'] },
      },
    });

    console.log(`[Startup] Found ${pendingEmails.length} pending email(s) in database.`);
    let restoredCount = 0;

    for (const email of pendingEmails) {
      const existingJob = await emailQueue.getJob(email.id);

      // If BullMQ doesn't already have this job in Redis, restore it
      if (!existingJob) {
        const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());
        await scheduleEmailJob(
          {
            emailId: email.id,
            userId: email.userId,
            senderEmail: email.senderEmail,
            recipientEmail: email.recipientEmail,
            subject: email.subject,
            body: email.body,
            hourlyLimit: email.hourlyLimit,
            delayBetweenEmailsMs: email.delayBetweenEmailsMs,
            scheduledAt: email.scheduledAt.toISOString(),
          },
          delayMs
        );
        restoredCount++;
      }
    }

    if (restoredCount > 0) {
      console.log(`[Startup] Restored ${restoredCount} job(s) into BullMQ from database.`);
    } else {
      console.log('[Startup] All scheduled jobs are safely persistent in Redis/BullMQ.');
    }
  } catch (error: any) {
    console.error('[Startup] Reconciliation check error:', error.message);
  }
}

// Start Server and Worker
async function startServer() {
  try {
    // 1. Initialize Ethereal account
    await smtpService.getAccountDetails();

    // 2. Initialize Elasticsearch index
    await elasticSearchService.init();

    // 3. Reconcile database & BullMQ jobs
    await reconcileScheduledEmailsOnStartup();

    // 4. Start BullMQ worker
    const worker = createEmailWorker();

    // 5. Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`====================================================`);
      console.log(`🚀 ReachInbox Email Scheduler API is running!`);
      console.log(`📡 API Base URL:       http://localhost:${config.port}/api`);
      console.log(`📊 BullMQ Dashboard:   http://localhost:${config.port}/admin/queues`);
      console.log(`🩺 Health Check:       http://localhost:${config.port}/health`);
      console.log(`⚡ Concurrency:        ${config.worker.concurrency} worker threads`);
      console.log(`⏳ Inter-email delay:  ${config.worker.minDelayBetweenEmailsMs} ms`);
      console.log(`🛑 Hourly sender limit: ${config.worker.maxEmailsPerHourPerSender} emails/hr`);
      console.log(`====================================================`);
    });

    // Graceful Shutdown
    const shutdown = async () => {
      console.log('\n[Server] Graceful shutdown initiated...');
      server.close();
      await worker.close();
      await emailQueue.close();
      await prisma.$disconnect();
      console.log('[Server] Shutdown complete.');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error: any) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();

export default app;
