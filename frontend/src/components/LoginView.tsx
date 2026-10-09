import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Mail, ShieldCheck, Zap, ArrowRight, Play } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithGoogle, loginDemo } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleGoogleSuccess = async (response: any) => {
    if (response.credential) {
      const ok = await loginWithGoogle(response.credential);
      if (!ok) {
        setErrorMsg('Authentication with Google failed. Please try again.');
      }
    }
  };

  const handleDemoSignIn = async () => {
    try {
      setIsDemoLoading(true);
      setErrorMsg(null);
      await loginDemo('recruiter@reachinbox.ai', 'ReachInbox Reviewer');
    } catch (err: any) {
      setErrorMsg('Demo sign-in failed');
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] text-white flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background isometric grid pattern mimicking the Figma cover */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px]"></div>

      {/* Decorative gradient blur */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25">
            <Mail className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              ReachInbox
            </h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mt-1">
              Outbox Labs • Full-Stack Scheduler
            </p>
          </div>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Production-grade Email Queue Engine powered by BullMQ, Redis, Elasticsearch, and Ethereal SMTP.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#161922] border border-[#232838] rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-100">Sign in to Dashboard</h2>
            <p className="text-xs text-gray-400 mt-1">
              Google OAuth authentication (no mock)
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Official Google OAuth GIS Button */}
          <div className="flex flex-col items-center justify-center w-full space-y-3">
            <div className="w-full flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setErrorMsg('Google Sign-In failed or popup was closed.')}
                theme="filled_black"
                shape="pill"
                size="large"
                text="signin_with"
                width="320"
              />
            </div>
            <p className="text-[11px] text-gray-500 text-center">
              Official Google Identity Services (GIS) OAuth verification
            </p>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="grow border-t border-[#232838]"></div>
            <span className="shrink mx-4 text-gray-500 text-[11px] uppercase tracking-wider">or</span>
            <div className="grow border-t border-[#232838]"></div>
          </div>

          {/* Quick Demo Sign In Button */}
          <button
            type="button"
            onClick={handleDemoSignIn}
            disabled={isDemoLoading}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {isDemoLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Instant Reviewer Access (1-Click Demo)</span>
              </>
            )}
          </button>

          {/* Features Pills */}
          <div className="pt-4 border-t border-[#232838] grid grid-cols-2 gap-2 text-[11px] text-gray-400">
            <div className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>BullMQ Delayed Jobs</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Persistent on Restart</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Elasticsearch Search</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Live Slack Rate Alerts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
