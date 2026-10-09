import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Mail,
  Search,
  LogOut,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Activity,
} from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSlackModal: () => void;
  isSearching?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenSlackModal,
  isSearching,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-gray-900 tracking-tight">ReachInbox</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Scheduler
                </span>
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">Cold Email Automation & Queue Engine</p>
            </div>
          </div>

          {/* Search bar (Elasticsearch powered) */}
          <div className="flex-1 max-w-md mx-4 lg:mx-8">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search subject, recipient, body (Elasticsearch)..."
                className="block w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {/* Actions & User Header */}
          <div className="flex items-center space-x-3">
            {/* Bull-Board Live Queue Button */}
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200"
              title="Open real-time BullMQ Dashboard"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>BullMQ Board</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>

            {/* Slack Integration Button */}
            <button
              onClick={onOpenSlackModal}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                user?.slackConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Configure Slack Rate Limit Notifications"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {user?.slackConnected ? 'Slack Alert Active' : 'Connect Slack'}
              </span>
              {user?.slackConnected ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              )}
            </button>

            {/* User Profile & Logout */}
            {user && (
              <div className="flex items-center space-x-3 pl-2 border-l border-gray-200">
                <div className="flex items-center space-x-2">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                    alt={user.name || user.email}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-100 object-cover"
                  />
                  <div className="hidden xl:block text-left text-xs">
                    <p className="font-semibold text-gray-900 leading-tight">{user.name || 'User'}</p>
                    <p className="text-gray-500 leading-tight truncate max-w-[120px]">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
