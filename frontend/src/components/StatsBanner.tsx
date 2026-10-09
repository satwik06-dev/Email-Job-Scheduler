import React from 'react';
import { DashboardStats } from '../types';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Zap,
  Layers,
  Database,
  Search,
} from 'lucide-react';

interface StatsBannerProps {
  stats: DashboardStats | null;
  onRefresh: () => void;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({ stats, onRefresh }) => {
  if (!stats) return null;

  return (
    <div className="mb-6 space-y-3">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Scheduled */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled</p>
            <p className="text-xl font-bold text-gray-900">{stats.db.scheduled}</p>
          </div>
        </div>

        {/* Sent */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sent (Ethereal)</p>
            <p className="text-xl font-bold text-gray-900">{stats.db.sent}</p>
          </div>
        </div>

        {/* Rate Limited & Rescheduled */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rescheduled</p>
            <div className="flex items-center space-x-1.5">
              <span className="text-xl font-bold text-gray-900">{stats.db.rescheduledRateLimit}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Rate-Limited</span>
            </div>
          </div>
        </div>

        {/* BullMQ Queue */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">BullMQ Queue</p>
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-semibold text-indigo-600">{stats.queue.delayed} delayed</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">{stats.queue.active} active</span>
            </div>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center space-x-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</p>
            <p className="text-xl font-bold text-gray-900">{stats.db.failed}</p>
          </div>
        </div>
      </div>

      {/* Senders Rate Limiter Tracker */}
      {stats.senders && stats.senders.length > 0 && (
        <div className="bg-white px-4 py-2.5 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-gray-600">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-gray-700">Multi-Sender Hourly Utilization:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {stats.senders.map((s) => {
              const isNearLimit = s.currentHourCount >= s.hourlyLimit * 0.8;
              const isOverLimit = s.currentHourCount >= s.hourlyLimit;
              return (
                <div
                  key={s.senderEmail}
                  className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-lg border font-mono ${
                    isOverLimit
                      ? 'bg-red-50 text-red-700 border-red-200 font-bold'
                      : isNearLimit
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  <span className="truncate max-w-[140px]">{s.senderEmail}</span>
                  <span className="px-1.5 py-0.2 rounded bg-white text-gray-900 text-[11px] font-sans font-semibold border">
                    {s.currentHourCount} / {s.hourlyLimit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsBanner;
