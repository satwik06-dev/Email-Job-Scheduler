export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  slackConnected: boolean;
  slackChannel?: string | null;
  slackTeamName?: string | null;
}

export interface EmailJob {
  id: string;
  userId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'RESCHEDULED_RATE_LIMIT' | 'CANCELLED';
  etherealPreviewUrl?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  bullJobId?: string | null;
  hourlyLimit?: number | null;
  delayBetweenEmailsMs?: number | null;
  batchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailListResponse {
  emails: EmailJob[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ScheduleEmailPayload {
  senderEmail: string;
  recipientEmails: string[];
  subject: string;
  body: string;
  startTime?: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
  userId?: string;
}

export interface QueueCounts {
  active: number;
  completed: number;
  delayed: number;
  failed: number;
  paused: number;
  waiting: number;
}

export interface SenderStat {
  senderEmail: string;
  currentHourCount: number;
  hourlyLimit: number;
}

export interface DashboardStats {
  db: {
    scheduled: number;
    sent: number;
    failed: number;
    rescheduledRateLimit: number;
    total: number;
  };
  queue: QueueCounts;
  senders: SenderStat[];
  elasticsearch: {
    connected: boolean;
    node: string;
    index: string;
  };
}
