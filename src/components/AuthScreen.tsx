import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { googleSignIn } from '../services/googleWorkspace';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  GraduationCap,
  Briefcase,
} from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: (user: User, token: string) => Promise<void> | void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      setErrorMsg(null);
      const res = await googleSignIn();
      if (res) {
        await onLoginSuccess(res.user, res.accessToken);
      }
    } catch (err: unknown) {
      console.error('Sign-in error:', err);
      const error = err as { code?: string; message?: string };
      if (error?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in cancelled. Please select your Google account.');
      } else {
        setErrorMsg(error?.message || 'Login interrupted. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040b17] text-slate-100 overflow-hidden relative select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.20),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.18),_transparent_25%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-12">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200">
              <Sparkles className="w-3.5 h-3.5" />
              Academic planning, simplified
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Keep your workload under control.
              </h1>
              <p className="max-w-xl text-base text-slate-300 leading-relaxed">
                Track deadlines, sync school work, and prioritize what matters most without losing time
                to manual planning.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur-sm">
                <div className="text-xs text-slate-400 mb-2">School sync</div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                  Classroom + Calendar
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur-sm">
                <div className="text-xs text-slate-400 mb-2">Live planning</div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  AI workload view
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur-sm">
                <div className="text-xs text-slate-400 mb-2">Daily clarity</div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Briefcase className="w-4 h-4 text-cyan-400" />
                  Smart task tracking
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Welcome</div>
                  <div className="text-xl font-bold text-white">AcadPulse-AI</div>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-5 rounded-xl border border-rose-800/70 bg-rose-950/30 p-3 text-left text-xs text-rose-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full rounded-2xl bg-white text-slate-900 px-4 py-3.5 text-sm font-semibold shadow-lg shadow-slate-200/10 transition hover:bg-slate-100 disabled:opacity-70"
            >
              <span className="flex items-center justify-center gap-3">
                {isLoggingIn ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
                ) : (
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="h-5 w-5 shrink-0"
                  >
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                )}
                <span>{isLoggingIn ? 'Connecting...' : 'Continue with Google'}</span>
              </span>
            </button>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                School Gmail
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1.5">
                <Briefcase className="h-3.5 w-3.5 text-cyan-400" />
                Personal Gmail
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
