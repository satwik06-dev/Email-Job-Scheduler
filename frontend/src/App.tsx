import React, { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import StatsBanner from './components/StatsBanner';
import ScheduledList from './components/ScheduledList';
import SentList from './components/SentList';
import ComposeModal from './components/ComposeModal';
import SlackModal from './components/SlackModal';
import LoginView from './components/LoginView';
import { emailApi } from './services/api';
import { EmailJob, DashboardStats } from './types';
import {
  Clock,
  CheckCircle,
  Plus,
  RefreshCw,
  Search,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';

const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '1084227786407-dummygoogleclientidforreachinbox.apps.googleusercontent.com';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // Tab state: 'scheduled' | 'sent'
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');

  // Emails lists
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(true);
  const [isLoadingSent, setIsLoadingSent] = useState(true);

  // Stats
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailJob[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [schedRes, sentRes, statsRes] = await Promise.all([
        emailApi.getScheduled(),
        emailApi.getSent(),
        emailApi.getStats(),
      ]);

      setScheduledEmails(schedRes.emails || []);
      setSentEmails(sentRes.emails || []);
      setStats(statsRes);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoadingScheduled(false);
      setIsLoadingSent(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh queue state every 8 seconds
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Debounced search via Elasticsearch
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await emailApi.search(searchQuery.trim());
        setSearchResults(res.results || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Cancel scheduled email
  const handleCancelEmail = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled email?')) return;
    try {
      await emailApi.cancel(id);
      showToast('Scheduled email cancelled successfully');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to cancel email', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-gray-900 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        isSearching={isSearching}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Statistics & Health Banner */}
        <StatsBanner stats={stats} onRefresh={fetchData} />

        {/* Dashboard Actions Bar */}
        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center space-x-1.5 p-1 bg-gray-100 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveTab('scheduled');
                setSearchQuery('');
              }}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'scheduled' && !searchQuery
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Scheduled Emails</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-50 text-blue-700 font-bold">
                {stats?.db.scheduled || scheduledEmails.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('sent');
                setSearchQuery('');
              }}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'sent' && !searchQuery
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sent Emails</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-bold">
                {stats?.db.sent || sentEmails.length}
              </span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              title="Refresh queue status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-indigo-200 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Search Results Notice (if active) */}
        {searchQuery.trim() && (
          <div className="mb-4 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-indigo-600" />
              <span>
                Search results for "<strong>{searchQuery}</strong>" (via Elasticsearch index):{' '}
                <strong>{searchResults?.length ?? 0} matches found</strong>
              </span>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-indigo-700 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Tab Content */}
        {searchQuery.trim() && searchResults ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                Elasticsearch Query Results
              </h3>
              {searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  No matching emails found for "{searchQuery}".
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {searchResults.map((email) => (
                    <div key={email.id} className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">{email.recipientEmail}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-gray-100 text-gray-600 font-mono">
                            {email.senderEmail}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              email.status === 'SENT'
                                ? 'bg-emerald-50 text-emerald-700'
                                : email.status === 'RESCHEDULED_RATE_LIMIT'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {email.status}
                          </span>
                        </div>
                        <p className="text-gray-700 font-medium">{email.subject}</p>
                        <p className="text-gray-400 line-clamp-1">{email.body}</p>
                      </div>

                      {email.etherealPreviewUrl && (
                        <a
                          href={email.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:underline shrink-0 ml-4"
                        >
                          <span>View in Ethereal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'scheduled' ? (
          <ScheduledList
            emails={scheduledEmails}
            isLoading={isLoadingScheduled}
            onCancel={handleCancelEmail}
            onRefresh={fetchData}
          />
        ) : (
          <SentList
            emails={sentEmails}
            isLoading={isLoadingSent}
            onRefresh={fetchData}
          />
        )}
      </main>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          showToast('Campaign successfully scheduled into BullMQ queue!');
          fetchData();
        }}
        userId={user?.id}
      />

      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
      />
    </div>
  );
};

const Root: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <Dashboard />;
};

export function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
