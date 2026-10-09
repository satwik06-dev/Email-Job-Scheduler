import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env.js';

interface SendMailParams {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface SendMailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

class SmtpService {
  private transporter: Transporter | null = null;
  private accountInfo: { user: string; pass: string } | null = null;
  private initPromise: Promise<void> | null = null;

  private async initializeTransporter(): Promise<void> {
    if (this.transporter) return;

    if (config.ethereal.user && config.ethereal.pass) {
      this.accountInfo = {
        user: config.ethereal.user,
        pass: config.ethereal.pass,
      };
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: this.accountInfo.user,
          pass: this.accountInfo.pass,
        },
      });
      console.log(`[SMTP] Configured Ethereal SMTP with user: ${this.accountInfo.user}`);
    } else {
      console.log('[SMTP] No Ethereal credentials supplied. Generating test Ethereal account...');
      const testAccount = await nodemailer.createTestAccount();
      this.accountInfo = {
        user: testAccount.user,
        pass: testAccount.pass,
      };
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[SMTP] Generated ephemeral Ethereal account: ${testAccount.user}`);
      console.log(`[SMTP] Webmail access: https://ethereal.email/login (User: ${testAccount.user} / Pass: ${testAccount.pass})`);
    }
  }

  public async getAccountDetails() {
    if (!this.initPromise) {
      this.initPromise = this.initializeTransporter();
    }
    await this.initPromise;
    return this.accountInfo;
  }

  public async sendEmail(params: SendMailParams): Promise<SendMailResult> {
    try {
      if (!this.initPromise) {
        this.initPromise = this.initializeTransporter();
      }
      await this.initPromise;

      if (!this.transporter) {
        throw new Error('SMTP transporter is not initialized');
      }

      // Format from field cleanly
      const fromAddress = params.from.includes('<') ? params.from : `"${params.from.split('@')[0]}" <${params.from}>`;

      const info = await this.transporter.sendMail({
        from: fromAddress,
        to: params.to,
        subject: params.subject,
        text: params.text || params.html?.replace(/<[^>]+>/g, '') || '',
        html: params.html || params.text || '',
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[SMTP] Email sent to ${params.to} from ${params.from}. MessageID: ${info.messageId}`);
      if (previewUrl) {
        console.log(`[SMTP] Ethereal Preview URL: ${previewUrl}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
      };
    } catch (error: any) {
      console.error(`[SMTP] Failed to send email to ${params.to}:`, error.message);
      return {
        success: false,
        error: error.message || 'Failed to send email via SMTP',
      };
    }
  }
}

export const smtpService = new SmtpService();
export default smtpService;
