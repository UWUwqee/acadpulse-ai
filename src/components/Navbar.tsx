import React from 'react';
import { Plus, Database, Sparkles, LogOut, MessageCircle, Wrench, ShieldCheck } from 'lucide-react';
import { User } from 'firebase/auth';
import { BrandMark } from './BrandMark';

interface NavbarProps {
  activeTab: 'tasks' | 'schedule' | 'resources' | 'ai' | 'courses' | 'tools' | 'chat' | 'admin';
  setActiveTab: (tab: 'tasks' | 'schedule' | 'resources' | 'ai' | 'courses' | 'tools' | 'chat' | 'admin') => void;
  onOpenNewTask: () => void;
  onOpenFirebaseModal: () => void;
  connectionStatus: {
    isConnected: boolean;
    mode: string;
    error?: string;
  };
  user?: User | null;
  onLogout?: () => void;
  adminAccess?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTask,
  onOpenFirebaseModal,
  connectionStatus,
  user,
  onLogout,
  adminAccess = false,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <BrandMark size="sm" />
          <button
            onClick={() => setActiveTab('tasks')}
            className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-[#f7f0d0] via-[#f0d789] to-[#d79c45] bg-clip-text text-transparent hover:brightness-125 transition-all cursor-pointer text-left"
          >
            AcadPulse-AI
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden xl:flex items-center gap-0.5 2xl:gap-1">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Workload & Tasks
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'schedule'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Deadlines Calendar
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'resources'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Resource Repository
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60'
                : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Workload Advisor
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'courses'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Courses
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'tools' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />Tools
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />Chat
          </button>
          {adminAccess && <button
            onClick={() => setActiveTab('admin')}
            className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'admin' ? 'bg-cyan-950/80 text-cyan-200' : 'text-cyan-300 hover:bg-cyan-950/40'}`}
          ><ShieldCheck className="h-3.5 w-3.5" />Admin</button>}
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* New Deliverable Button */}
          <button
            onClick={onOpenNewTask}
            title="Add deliverable"
            aria-label="Add deliverable"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-sm shadow-indigo-600/30 transition-colors cursor-pointer whitespace-nowrap sm:px-3"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Deliverable</span>
          </button>

          {/* User Profile & Sign Out */}
          {user && onLogout && (
            <button
              onClick={onLogout}
              title={`Signed in as ${user.email}. Click to sign out.`}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer shrink-0 ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Subnavigation */}
      <nav aria-label="Primary navigation" className="xl:hidden flex items-center justify-start gap-1 px-2 py-2 border-t border-slate-800 bg-slate-950 text-xs overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`shrink-0 px-2 py-1 rounded whitespace-nowrap ${activeTab === 'tasks' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`shrink-0 px-2 py-1 rounded whitespace-nowrap ${activeTab === 'schedule' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Calendar
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`shrink-0 px-2 py-1 rounded whitespace-nowrap ${activeTab === 'resources' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Resources
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`shrink-0 px-2 py-1 rounded whitespace-nowrap ${activeTab === 'ai' ? 'text-indigo-400 font-semibold' : 'text-slate-400'}`}
        >
          AI Advisor
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`shrink-0 px-2 py-1 rounded whitespace-nowrap ${activeTab === 'courses' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Courses
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`shrink-0 px-2 py-1 rounded whitespace-nowrap ${activeTab === 'tools' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Tools
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`shrink-0 px-2 py-1 rounded whitespace-nowrap ${activeTab === 'chat' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Chat
        </button>
        {adminAccess && <button
          onClick={() => setActiveTab('admin')}
          className={`shrink-0 px-2 py-1 whitespace-nowrap ${activeTab === 'admin' ? 'font-semibold text-cyan-200' : 'text-cyan-300'}`}
        >Admin</button>}
      </nav>
    </header>
  );
};
