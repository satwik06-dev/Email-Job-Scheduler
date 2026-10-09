import React from 'react';
import { EmailJob } from '../types';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Mail,
  Calendar,
  Inbox,
  AlertCircle,
} from 'lucide-react';

interface SentListProps {
  emails: EmailJob[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const SentList: React.FC<SentListProps> = ({ emails, isLoading, onRefresh }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div className="space-y-2 w-1/3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
            <div className="h-4 bg-gray-100 rounded w-1/4"></div>
            <div className="h-6 bg-gray-200 rounded-full w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-2xs">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
          <Inbox className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">No Sent Emails Yet</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          As soon as scheduled jobs are executed and delivered via fake SMTP (Ethereal), they will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
          <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="px-6 py-3.5">Recipient</th>
              <th scope="col" className="px-6 py-3.5">Sender</th>
              <th scope="col" className="px-6 py-3.5">Subject</th>
              <th scope="col" className="px-6 py-3.5">Delivered At</th>
              <th scope="col" className="px-6 py-3.5">Status</th>
              <th scope="col" className="px-6 py-3.5 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {emails.map((email) => {
              const isSent = email.status === 'SENT';
              const dateObj = new Date(email.sentAt || email.updatedAt);
              const formattedDate = dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <tr key={email.id} className="hover:bg-gray-50/75 transition-colors">
                  {/* Recipient */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-medium ${
                        isSent ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-gray-900">{email.recipientEmail}</span>
                    </div>
                  </td>

                  {/* Sender */}
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[11px]">
                      {email.senderEmail}
                    </span>
                  </td>

                  {/* Subject */}
                  <td className="px-6 py-4 max-w-xs truncate font-medium text-gray-800">
                    {email.subject}
                  </td>

                  {/* Delivered At */}
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{formattedDate}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isSent ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sent</span>
                      </span>
                    ) : (
                      <div className="inline-flex items-center space-x-1" title={email.errorMessage || 'Failed'}>
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                          <span>Failed</span>
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Ethereal Webmail Preview Link */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {email.etherealPreviewUrl ? (
                      <a
                        href={email.etherealPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                        title="Open real rendered test email on Ethereal Webmail"
                      >
                        <span>View Email</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs italic">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SentList;
