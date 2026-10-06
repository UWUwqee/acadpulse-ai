import React from 'react';
import { WorkloadAnalysis, AcademicTask } from '../types';
import { AlertTriangle, Clock, GraduationCap, CheckCircle, Sparkles, CircleAlert } from 'lucide-react';

interface WorkloadMetricsBarProps {
  metrics: WorkloadAnalysis;
  tasks: AcademicTask[];
  onOpenAiAdvisor: () => void;
}

export const WorkloadMetricsBar: React.FC<WorkloadMetricsBarProps> = ({
  metrics,
  tasks,
  onOpenAiAdvisor,
}) => {
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const examCount = tasks.filter((t) => (t.type === 'examination' || t.type === 'quiz') && t.status !== 'completed').length;

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
    if (score >= 50) return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
    return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
  };

  const getProgressColor = (score: number) => {
    if (score >= 75) return 'bg-rose-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 sm:p-5 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-5 gap-4 items-center">
        {/* Metric 1: Workload Stress Index */}
        <div className="col-span-2 sm:col-span-1">
          <div className="text-xs font-medium text-slate-400 mb-1">Workload Stress Index</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {metrics.workloadScore}%
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getScoreColor(
                metrics.workloadScore
              )}`}
            >
              {metrics.statusLabel}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                metrics.workloadScore
              )}`}
              style={{ width: `${metrics.workloadScore}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Urgent Deadlines (<48h) */}
        <div className="border-l border-slate-800 pl-4">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <AlertTriangle className={`w-3.5 h-3.5 ${metrics.urgentCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>Urgent Deadlines</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {metrics.urgentCount}
          </div>
        </div>

        {/* Metric 3: Pending Effort Hours */}
        <div className="border-l border-slate-800 pl-4">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Pending Study Hours</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {metrics.totalPendingHours}
            <span className="text-sm font-normal text-slate-400 ml-1">hrs</span>
          </div>
        </div>

        {/* Metric 4: Upcoming Exams / Quizzes */}
        <div className="border-l border-slate-800 pl-4">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exams & Quizzes</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {examCount}
          </div>
        </div>

        {/* Metric 5: Missing / Unscheduled Activity */}
        <div className="border-l border-slate-800 pl-4">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <CircleAlert className={`w-3.5 h-3.5 ${metrics.missingCount > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
            <span>Missing Activity</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {metrics.missingCount}
          </div>
        </div>

        {/* Action Button: AI Workload Advisor */}
        <div className="col-span-2 lg:col-span-1 flex flex-col justify-center items-start lg:items-end">
          <button
            onClick={onOpenAiAdvisor}
            className="w-full lg:w-auto px-4 py-2.5 rounded-md bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-indigo-200" />
            <span>AI Workload Advisor</span>
          </button>
          <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span className="font-mono tabular-nums">{completedTasks}/{totalTasks}</span> deliverables completed
          </div>
        </div>
      </div>
    </div>
  );
};
