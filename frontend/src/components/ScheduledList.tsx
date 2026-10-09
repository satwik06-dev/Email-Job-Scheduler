import React from 'react';
import { EmailJob } from '../types';
import {
  Clock,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Mail,
  User,
  Calendar,
} from 'lucide-react';

interface ScheduledListProps {
  emails: EmailJob[];
  isLoading: boolean;
  onCancel: (id: string) => void;
  onRefresh: () => void;
}

export const ScheduledList: React.FC<ScheduledListProps> = ({
  emails,
  isLoading,
  onCancel,
  onRefresh,
}) => {
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
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">No Scheduled Emails</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          You don't have any emails queued up right now. Click "Compose New Email" to schedule a campaign.
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
              <th scope="col" className="px-6 py-3.5">Scheduled For</th>
              <th scope="col" className="px-6 py-3.5">Status</th>
              <th scope="col" className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {emails.map((email) => {
              const isRescheduled = email.status === 'RESCHEDULED_RATE_LIMIT';
              const dateObj = new Date(email.scheduledAt);
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
                      <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-medium">
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

                  {/* Scheduled For */}
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{formattedDate}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isRescheduled ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <RotateCcw className="w-3 h-3 text-amber-500 animate-spin" />
                        <span>Rescheduled (Rate Limit)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <Clock className="w-3 h-3 text-blue-500" />
                        <span>Scheduled</span>
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => onCancel(email.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel schedule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

export default ScheduledList;
