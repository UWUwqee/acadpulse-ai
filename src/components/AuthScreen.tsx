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
      <div className="absolute inset-0 overflow-hidden">
        <div className="motion-grid absolute inset-0" />
        <div className="motion-scan absolute left-0 top-[26%] h-px w-full" />
        <div className="motion-scan motion-scan-late absolute left-0 top-[70%] h-px w-full" />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_14%_44%,rgba(34,211,238,0.10),transparent_38%),radial-gradient(ellipse_at_82%_20%,rgba(245,158,11,0.10),transparent_34%)]" />

      <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 lg:px-12">
        <section className="motion-stage-1 hidden lg:block">
          <div className="flex items-center gap-3">
            <BrandMark size="lg" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">Academic planner</div>
              <div className="text-xl font-bold text-[#f0d98b]">AcadPulse-AI</div>
            </div>
          </div>
          <div className="mt-16 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">Make room for the work that matters</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.08] text-white">Your semester,<br /><span className="text-cyan-200">in clear focus.</span></h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-300">Bring coursework, deadlines, and study time into one considered workspace.</p>
          </div>
          <div className="mt-14 flex max-w-lg items-center gap-4 border-t border-slate-700/70 pt-5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            <span>Coursework</span><span className="h-px flex-1 bg-gradient-to-r from-cyan-300/70 to-amber-300/70" /><span>Deadlines</span><span className="h-px flex-1 bg-gradient-to-r from-amber-300/70 to-cyan-300/70" /><span>Progress</span>
          </div>
        </section>

        <section className="motion-stage-2 w-full max-w-md justify-self-center rounded-2xl border border-slate-700/80 bg-slate-950/75 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8 lg:justify-self-end">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark size="md" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Welcome</div>
              <div className="text-xl font-bold text-[#f0d98b]">AcadPulse-AI</div>
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">Welcome</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Sign in to continue</h2>
            <p className="mt-2 text-sm text-slate-400">School tasks, deadlines, and study load in one place.</p>
          </div>

          <div className="mb-6 flex flex-wrap gap-2 text-[11px] text-slate-300">
            <span className="rounded border border-slate-700 bg-slate-900/80 px-2.5 py-1.5">Classroom</span>
            <span className="rounded border border-slate-700 bg-slate-900/80 px-2.5 py-1.5">Calendar</span>
            <span className="rounded border border-slate-700 bg-slate-900/80 px-2.5 py-1.5">Tasks</span>
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
            className="group relative w-full overflow-hidden rounded-lg border border-cyan-100/70 bg-[#f1eee5] px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-0.5 hover:bg-white disabled:translate-y-0 disabled:opacity-70"
          >
            <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-18deg] bg-white/55 transition-transform duration-700 group-hover:translate-x-[420%]" />
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
          <p className="mt-4 text-center text-[11px] text-slate-500">Secure sign-in with your Google account</p>
        </section>
      </main>
    </div>
  );
};
