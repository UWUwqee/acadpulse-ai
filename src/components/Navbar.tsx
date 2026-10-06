import React from 'react';
import { Plus, Database, Sparkles, LogOut } from 'lucide-react';
import { User } from 'firebase/auth';

interface NavbarProps {
  activeTab: 'tasks' | 'schedule' | 'resources' | 'ai' | 'courses';
  setActiveTab: (tab: 'tasks' | 'schedule' | 'resources' | 'ai' | 'courses') => void;
  onOpenNewTask: () => void;
  onOpenFirebaseModal: () => void;
  connectionStatus: {
    isConnected: boolean;
    mode: string;
    error?: string;
  };
  user?: User | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTask,
  onOpenFirebaseModal,
  connectionStatus,
  user,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-bold text-sm tracking-tighter">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <button
            onClick={() => setActiveTab('tasks')}
            className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-indigo-400 transition-colors cursor-pointer text-left"
          >
            AcadPulse-AI
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
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
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* New Deliverable Button */}
          <button
            onClick={onOpenNewTask}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-sm shadow-indigo-600/30 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Deliverable</span>
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
      <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-slate-800 bg-slate-950 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-2 py-1 rounded whitespace-nowrap ${activeTab === 'tasks' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-2 py-1 rounded whitespace-nowrap ${activeTab === 'schedule' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Calendar
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`px-2 py-1 rounded whitespace-nowrap ${activeTab === 'resources' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Resources
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-2 py-1 rounded whitespace-nowrap ${activeTab === 'ai' ? 'text-indigo-400 font-semibold' : 'text-slate-400'}`}
        >
          AI Advisor
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-2 py-1 rounded whitespace-nowrap ${activeTab === 'courses' ? 'text-white font-semibold' : 'text-slate-400'}`}
        >
          Courses
        </button>
      </div>
    </header>
  );
};
