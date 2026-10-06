import React, { useState, useEffect } from 'react';
import { FirebaseConnectionConfig } from '../types';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw, Copy, Check, Shield } from 'lucide-react';

interface FirebaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: FirebaseConnectionConfig) => Promise<boolean>;
  onDisconnect: () => void;
  onResetDefault: () => void;
  onClearAll: () => void;
  connectionStatus: {
    isConnected: boolean;
    mode: string;
    error?: string;
    config?: FirebaseConnectionConfig | null;
  };
}

export const FirebaseModal: React.FC<FirebaseModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  onResetDefault,
  onClearAll,
  connectionStatus,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [projectId, setProjectId] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [appId, setAppId] = useState('');
  const [jsonConfigInput, setJsonConfigInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedRules, setCopiedRules] = useState(false);

  useEffect(() => {
    if (connectionStatus.config) {
      setApiKey(connectionStatus.config.apiKey || '');
      setAuthDomain(connectionStatus.config.authDomain || '');
      setProjectId(connectionStatus.config.projectId || '');
      setStorageBucket(connectionStatus.config.storageBucket || '');
      setMessagingSenderId(connectionStatus.config.messagingSenderId || '');
      setAppId(connectionStatus.config.appId || '');
    }
  }, [connectionStatus.config]);

  if (!isOpen) return null;

  const handleParseJson = () => {
    try {
      if (!jsonConfigInput.trim()) return;
      const parsed = JSON.parse(jsonConfigInput);
      if (parsed.apiKey) setApiKey(parsed.apiKey);
      if (parsed.authDomain) setAuthDomain(parsed.authDomain);
      if (parsed.projectId) setProjectId(parsed.projectId);
      if (parsed.storageBucket) setStorageBucket(parsed.storageBucket);
      if (parsed.messagingSenderId) setMessagingSenderId(parsed.messagingSenderId);
      if (parsed.appId) setAppId(parsed.appId);
      setErrorMsg('');
    } catch {
      setErrorMsg('Invalid JSON format. Please verify your Firebase config object.');
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim() || !appId.trim()) {
      setErrorMsg('API Key, Project ID, and App ID are required.');
      return;
    }

    try {
      setIsConnecting(true);
      setErrorMsg('');
      await onConnect({
        apiKey: apiKey.trim(),
        authDomain: authDomain.trim(),
        projectId: projectId.trim(),
        storageBucket: storageBucket.trim() || undefined,
        messagingSenderId: messagingSenderId.trim() || undefined,
        appId: appId.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to Firebase Firestore.');
    } finally {
      setIsConnecting(false);
    }
  };

  const sampleRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /academic_tasks/{doc} {
      allow read, write: if true;
    }
    match /academic_subjects/{doc} {
      allow read, write: if true;
    }
    match /academic_resources/{doc} {
      allow read, write: if true;
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(sampleRules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-xl w-full p-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">
              Real-Time Backend & Firestore Sync
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Live State Banner */}
        <div className="mt-4 p-3.5 rounded-lg border flex items-center justify-between gap-3 bg-slate-950 border-slate-800">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                connectionStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            <div>
              <div className="text-xs font-bold text-white">
                {connectionStatus.isConnected
                  ? 'Firestore Live onSnapshot Connected'
                  : 'Instant Reactive In-Memory Bus Active'}
              </div>
            </div>
          </div>

          {connectionStatus.isConnected && (
            <button
              onClick={onDisconnect}
              className="px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-950/50 rounded border border-rose-900/40 transition-colors cursor-pointer"
            >
              Disconnect
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Firebase Config Form */}
        <form onSubmit={handleConnect} className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Quick Paste `firebaseConfig` JSON
              </label>
              <button
                type="button"
                onClick={handleParseJson}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                Auto-fill from JSON
              </button>
            </div>
            <textarea
              rows={2}
              value={jsonConfigInput}
              onChange={(e) => setJsonConfigInput(e.target.value)}
              placeholder='{"apiKey": "AIzaSy...", "projectId": "my-capstone-app", "appId": "1:..."}'
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md p-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                API Key *
              </label>
              <input
                type="text"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Project ID *
              </label>
              <input
                type="text"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g. ptc-academic-workload"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Auth Domain
              </label>
              <input
                type="text"
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
                placeholder="project-id.firebaseapp.com"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                App ID *
              </label>
              <input
                type="text"
                required
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1:123456789:web:..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={isConnecting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
              <span>{isConnecting ? 'Connecting...' : 'Connect Firestore Listeners'}</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/50">
                Android: academicai.app
              </span>
              <button
                type="button"
                onClick={onClearAll}
                className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 rounded transition-colors cursor-pointer"
              >
                Clear Data
              </button>
            </div>
          </div>
        </form>

        {/* Security Rules Helper */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Firestore Security Rules (Copy for Firebase Console)</span>
            </div>
            <button
              type="button"
              onClick={handleCopyRules}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {copiedRules ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Rules</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-2.5 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono text-slate-400 overflow-x-auto">
            {sampleRules}
          </pre>
        </div>
      </div>
    </div>
  );
};
