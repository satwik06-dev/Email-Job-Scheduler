import { Router } from 'express';
import multer from 'multer';
import emailController from '../controllers/emailController.js';
import authController from '../controllers/authController.js';
import slackController from '../controllers/slackController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

export const apiRouter = Router();

// Auth routes
apiRouter.post('/auth/google', authController.googleLogin.bind(authController));
apiRouter.post('/auth/demo-login', authController.demoLogin.bind(authController));
apiRouter.get('/auth/me', authController.getMe.bind(authController));

// Email scheduling routes
apiRouter.post('/emails/schedule', emailController.scheduleEmails.bind(emailController));
apiRouter.post('/emails/upload-leads', upload.single('file'), emailController.uploadLeads.bind(emailController));
apiRouter.get('/emails/scheduled', emailController.getScheduledEmails.bind(emailController));
apiRouter.get('/emails/sent', emailController.getSentEmails.bind(emailController));
apiRouter.get('/emails/search', emailController.searchEmails.bind(emailController));
apiRouter.delete('/emails/:id', emailController.cancelEmail.bind(emailController));
apiRouter.get('/emails/stats', emailController.getStats.bind(emailController));

// Slack integration routes
apiRouter.get('/slack/auth-url', slackController.getAuthUrl.bind(slackController));
apiRouter.get('/auth/slack/callback', slackController.handleCallback.bind(slackController));
apiRouter.post('/slack/connect-webhook', slackController.connectWebhook.bind(slackController));
apiRouter.post('/slack/disconnect', slackController.disconnect.bind(slackController));
apiRouter.post('/slack/test', slackController.sendTest.bind(slackController));

export default apiRouter;
