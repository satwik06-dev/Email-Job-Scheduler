import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Calendar,
  Clock,
  Gauge,
  Send,
  FileText,
  CheckCircle2,
  AlertCircle,
  Users,
} from 'lucide-react';
import { emailApi } from '../services/api';
import { ScheduleEmailPayload } from '../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId?: string;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
}) => {
  const [senderEmail, setSenderEmail] = useState('sales@reachinbox.ai');
  const [recipientInput, setRecipientInput] = useState('');
  const [detectedEmails, setDetectedEmails] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Scheduling options
  const [startOption, setStartOption] = useState<'now' | 'custom'>('now');
  const [customStartTime, setCustomStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000); // 5 mins in future
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle lead file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setErrorMsg(null);
      const res = await emailApi.uploadLeads(file);
      if (res.success && res.emails.length > 0) {
        setDetectedEmails(res.emails);
        setUploadedFileName(file.name);
      } else {
        setErrorMsg('No valid email addresses found in the uploaded file.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to upload leads file');
    } finally {
      setIsUploading(false);
    }
  };

  // Compile final recipients
  const manualRecipients = recipientInput
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes('@'));

  const totalRecipients = Array.from(new Set([...detectedEmails, ...manualRecipients]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (totalRecipients.length === 0) {
      setErrorMsg('Please specify at least one recipient email address or upload a leads file.');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Please enter an email subject.');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('Please enter the email body.');
      return;
    }

    try {
      setIsSubmitting(true);

      const startTimeIso =
        startOption === 'now'
          ? new Date().toISOString()
          : new Date(customStartTime).toISOString();

      const payload: ScheduleEmailPayload = {
        senderEmail: senderEmail.trim(),
        recipientEmails: totalRecipients,
        subject: subject.trim(),
        body,
        startTime: startTimeIso,
        delayBetweenEmailsMs: delayBetweenSeconds * 1000,
        hourlyLimit,
        userId,
      };

      await emailApi.schedule(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Compose & Schedule Campaign</h2>
              <p className="text-xs text-gray-500">Queue emails with rate-limiting and delay controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sender Email & Presets */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Sender Email Address (From)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="email"
                required
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="sender@domain.com"
                className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <select
                onChange={(e) => {
                  if (e.target.value) setSenderEmail(e.target.value);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-gray-50 text-gray-700 focus:outline-none"
                defaultValue=""
              >
                <option value="" disabled>Choose sender alias</option>
                <option value="sales@reachinbox.ai">sales@reachinbox.ai</option>
                <option value="growth@reachinbox.ai">growth@reachinbox.ai</option>
                <option value="marketing@reachinbox.ai">marketing@reachinbox.ai</option>
                <option value="founder@outboxlabs.com">founder@outboxlabs.com</option>
              </select>
            </div>
          </div>

          {/* Recipients & File Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Recipients / Leads ({totalRecipients.length} detected)</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV / TXT Leads</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.txt"
                className="hidden"
              />
            </div>

            {/* Upload status indicator */}
            {uploadedFileName && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>{detectedEmails.length}</strong> email addresses parsed from <em>{uploadedFileName}</em>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetectedEmails([]);
                    setUploadedFileName(null);
                  }}
                  className="text-xs text-emerald-700 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Direct text input */}
            <textarea
              rows={2}
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="Or enter recipient emails separated by comma or new line (e.g. alex@example.com, sara@domain.com)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Subject Line
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Quick question regarding your outbound pipeline"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Email Body (HTML supported)
            </label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{firstName}},\n\nI noticed ReachInbox was scaling its outbound operations and wanted to connect..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Scheduling Configuration (3 Columns) */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Start Time */}
            <div>
              <label className="font-semibold text-gray-700 flex items-center space-x-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Start Time</span>
              </label>
              <div className="space-y-1.5">
                <div className="flex items-center space-x-3">
                  <label className="inline-flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="startTimeOption"
                      checked={startOption === 'now'}
                      onChange={() => setStartOption('now')}
                      className="text-indigo-600"
                    />
                    <span>Immediately</span>
                  </label>
                  <label className="inline-flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="startTimeOption"
                      checked={startOption === 'custom'}
                      onChange={() => setStartOption('custom')}
                      className="text-indigo-600"
                    />
                    <span>Scheduled</span>
                  </label>
                </div>
                {startOption === 'custom' && (
                  <input
                    type="datetime-local"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  />
                )}
              </div>
            </div>

            {/* Delay Between Emails */}
            <div>
              <label className="font-semibold text-gray-700 flex items-center space-x-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Delay Between Sends</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={delayBetweenSeconds}
                  onChange={(e) => setDelayBetweenSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-center font-semibold"
                />
                <span className="text-gray-500">sec (provider throttle)</span>
              </div>
            </div>

            {/* Hourly Rate Limit */}
            <div>
              <label className="font-semibold text-gray-700 flex items-center space-x-1 mb-1">
                <Gauge className="w-3.5 h-3.5 text-amber-600" />
                <span>Hourly Limit</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-center font-semibold"
                />
                <span className="text-gray-500">emails/hr per sender</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {totalRecipients.length > 0 ? (
                <span>
                  Ready to schedule <strong>{totalRecipients.length}</strong> email(s) via BullMQ persistent queue.
                </span>
              ) : (
                <span>No recipients specified yet</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || totalRecipients.length === 0}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm shadow-indigo-200 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Queuing Jobs...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Schedule Emails</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComposeModal;
