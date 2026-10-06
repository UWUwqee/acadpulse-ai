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
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center px-4 relative overflow-hidden select-none">
      {/* Subtle Ambient Background Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-indigo-600/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Clean Auth Card */}
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-8 sm:p-10 shadow-2xl relative z-10 backdrop-blur-xl text-center">
        {/* Brand Icon & Name */}
        <div className="w-13 h-13 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 mx-auto mb-4">
          <Sparkles className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-6">
          AcadPulse-AI
        </h1>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-5 p-3 bg-rose-950/60 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Primary Action */}
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-100 active:bg-slate-200 disabled:opacity-70 text-slate-900 text-sm font-semibold rounded-xl shadow-md transition-all cursor-pointer border border-slate-200"
        >
          {isLoggingIn ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
          ) : (
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5 shrink-0"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
          )}
          <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
        </button>

        {/* Clean Supported Badges */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-center gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800">
            <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
            <span>School Gmail</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800">
            <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
            <span>Regular Gmail</span>
          </span>
        </div>
      </div>
    </div>
  );
};
