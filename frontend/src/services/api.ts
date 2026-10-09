import axios from 'axios';
import {
  EmailJob,
  EmailListResponse,
  ScheduleEmailPayload,
  DashboardStats,
  User,
} from '../types';

const api = axios.create({
  baseURL: '/api',
});

// Set user id header automatically if logged in
api.interceptors.request.use((config) => {
  const savedUser = localStorage.getItem('reachinbox_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user?.id) {
        config.headers['x-user-id'] = user.id;
      }
    } catch (e) {
      // ignore
    }
  }
  return config;
});

export const emailApi = {
  schedule: async (data: ScheduleEmailPayload) => {
    const res = await api.post('/emails/schedule', data);
    return res.data;
  },

  uploadLeads: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ success: boolean; filename: string; count: number; emails: string[] }>(
      '/emails/upload-leads',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data;
  },

  getScheduled: async (params?: { page?: number; limit?: number; senderEmail?: string }) => {
    const res = await api.get<EmailListResponse>('/emails/scheduled', { params });
    return res.data;
  },

  getSent: async (params?: { page?: number; limit?: number; senderEmail?: string }) => {
    const res = await api.get<EmailListResponse>('/emails/sent', { params });
    return res.data;
  },

  search: async (q: string, status?: string) => {
    const res = await api.get<{ query: string; count: number; results: EmailJob[] }>('/emails/search', {
      params: { q, status },
    });
    return res.data;
  },

  cancel: async (id: string) => {
    const res = await api.delete(`/emails/${id}`);
    return res.data;
  },

  getStats: async () => {
    const res = await api.get<DashboardStats>('/emails/stats');
    return res.data;
  },
};

export const authApi = {
  googleLogin: async (credential: string, clientId?: string) => {
    const res = await api.post<{ success: boolean; user: User }>('/auth/google', {
      credential,
      clientId,
    });
    return res.data;
  },

  demoLogin: async (email?: string, name?: string) => {
    const res = await api.post<{ success: boolean; user: User }>('/auth/demo-login', {
      email,
      name,
    });
    return res.data;
  },

  getMe: async (userId: string) => {
    const res = await api.get<User>('/auth/me', { params: { userId } });
    return res.data;
  },
};

export const slackApi = {
  getAuthUrl: async (userId: string) => {
    const res = await api.get<{ url: string; hasCredentials: boolean }>('/slack/auth-url', {
      params: { userId },
    });
    return res.data;
  },

  connectWebhook: async (userId: string, webhookUrl: string, channel?: string) => {
    const res = await api.post<{ success: boolean; message: string }>('/slack/connect-webhook', {
      userId,
      webhookUrl,
      channel,
    });
    return res.data;
  },

  disconnect: async (userId: string) => {
    const res = await api.post<{ success: boolean }>('/slack/disconnect', { userId });
    return res.data;
  },

  sendTest: async (userId?: string, senderEmail?: string) => {
    const res = await api.post<{ notified: boolean; reason?: string }>('/slack/test', {
      userId,
      senderEmail,
    });
    return res.data;
  },
};

export default api;
