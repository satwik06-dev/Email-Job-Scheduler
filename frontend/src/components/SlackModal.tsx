import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  Trash2,
  BellRing,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { slackApi } from '../services/api';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUserSlackStatus } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#email-alerts');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleOAuthConnect = async () => {
    try {
      const res = await slackApi.getAuthUrl(user?.id || '');
      if (res.hasCredentials && res.url) {
        window.location.href = res.url;
      } else {
        setStatusMsg({
          type: 'error',
          text: 'Slack OAuth Client ID not configured in backend .env. Please enter a Slack Incoming Webhook URL below for instant connection.',
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed to retrieve Slack OAuth URL' });
    }
  };

  const handleWebhookConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !webhookUrl.trim()) return;

    try {
      setIsConnecting(true);
      setStatusMsg(null);
      const res = await slackApi.connectWebhook(user.id, webhookUrl.trim(), channel.trim());
      if (res.success) {
        updateUserSlackStatus({
          slackConnected: true,
          slackChannel: channel.trim(),
          slackTeamName: 'Slack Workspace',
        });
        setStatusMsg({
          type: 'success',
          text: 'Slack connected successfully! A test ping was sent to your channel.',
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to connect Slack webhook',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    try {
      await slackApi.disconnect(user.id);
      updateUserSlackStatus({
        slackConnected: false,
        slackChannel: null,
        slackTeamName: null,
      });
      setStatusMsg({ type: 'success', text: 'Slack disconnected successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed to disconnect Slack' });
    }
  };

  const handleSendTestNotification = async () => {
    try {
      setIsTesting(true);
      setStatusMsg(null);
      const res = await slackApi.sendTest(user?.id, 'sales@reachinbox.ai');
      if (res.notified) {
        setStatusMsg({
          type: 'success',
          text: 'Live rate limit notification sent to your Slack channel right now! Check Slack.',
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: res.reason || 'Failed to send notification. Make sure Slack is connected.',
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed to dispatch test notification' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Slack Alerts Integration</h2>
              <p className="text-xs text-gray-500">Live notifications when sender hourly limits are hit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {statusMsg && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Current Status */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/75 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  user?.slackConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                }`}
              />
              <div>
                <p className="text-xs font-semibold text-gray-900">
                  {user?.slackConnected
                    ? `Connected to ${user.slackTeamName || 'Slack'} (${user.slackChannel || '#alerts'})`
                    : 'Slack is Disconnected'}
                </p>
                <p className="text-[11px] text-gray-500">
                  {user?.slackConnected
                    ? 'Rate-limit triggers will notify this channel in real time.'
                    : 'Rate-limit triggers will silently postpone jobs without crashing.'}
                </p>
              </div>
            </div>

            {user?.slackConnected && (
              <button
                onClick={handleDisconnect}
                className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Connect Option 1: Official OAuth */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Option 1: Slack OAuth Flow
            </h4>
            <button
              type="button"
              onClick={handleOAuthConnect}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold shadow-2xs transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
              <span>Connect Slack via OAuth v2</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          {/* Connect Option 2: Direct Webhook */}
          <form onSubmit={handleWebhookConnect} className="space-y-3 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Option 2: Incoming Webhook (Direct / Dev)
            </h4>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Slack Incoming Webhook URL
              </label>
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="#channel-name"
                className="w-1/2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isConnecting || !webhookUrl.trim()}
                className="flex-1 px-4 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              >
                {isConnecting ? 'Verifying...' : 'Save & Verify Webhook'}
              </button>
            </div>
          </form>

          {/* Test Live Notification Button */}
          {user?.slackConnected && (
            <div className="pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleSendTestNotification}
                disabled={isTesting}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                <BellRing className="w-4 h-4" />
                <span>
                  {isTesting ? 'Sending Slack Alert...' : '⚡ Trigger Live Rate-Limit Alert to Slack'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlackModal;
