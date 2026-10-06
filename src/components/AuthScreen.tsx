import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { googleSignIn } from '../services/googleWorkspace';
import { BrandMark } from './BrandMark';
import { Loader2, AlertCircle } from 'lucide-react';

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
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -18px, 0) scale(1.08); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(18px, -22px, 0) scale(1.12); }
        }
        @keyframes grid-shift {
          0% { transform: perspective(1200px) rotateX(68deg) translateY(0); }
          50% { transform: perspective(1200px) rotateX(68deg) translateY(18px); }
          100% { transform: perspective(1200px) rotateX(68deg) translateY(0); }
        }
      `}</style>

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-[-8%] h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl animate-[float-slow_18s_ease-in-out_infinite]" />
        <div className="absolute top-[18%] right-[-6%] h-96 w-96 rounded-full bg-violet-500/18 blur-3xl animate-[float-delayed_26s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-12%] left-[20%] h-80 w-80 rounded-full bg-amber-400/12 blur-3xl animate-[float-slow_22s_ease-in-out_infinite]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:130px_130px] [transform:perspective(1500px)_rotateX(68deg)] animate-[grid-shift_24s_ease-in-out_infinite]" />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.14),_transparent_25%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_40%,rgba(255,255,255,0.02))]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-indigo-950/20 backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-center gap-3">
            <BrandMark size="lg" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Welcome</div>
              <div className="text-2xl font-bold bg-gradient-to-r from-[#f9f6df] via-[#f0d98b] to-[#d7a857] bg-clip-text text-transparent">
                AcadPulse-AI
              </div>
            </div>
          </div>

          <div className="mb-5 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Plan smarter.</h1>
            <p className="mt-2 text-sm text-slate-300">School tasks, deadlines, and study load in one place.</p>
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-300">
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1.5">
              Classroom
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1.5">
              Calendar
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1.5">
              Tasks
            </span>
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
        </div>
      </div>
    </div>
  );
};
