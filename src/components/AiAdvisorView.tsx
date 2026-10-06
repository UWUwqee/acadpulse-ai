import React, { useState } from 'react';
import { AcademicTask, Subject, WorkloadAnalysis } from '../types';
import { BrandMark } from './BrandMark';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  Zap,
  ArrowRight,
} from 'lucide-react';

interface AiAdvisorViewProps {
  tasks: AcademicTask[];
  subjects: Subject[];
  metrics: WorkloadAnalysis;
  onUpdateTask: (id: string, updates: Partial<AcademicTask>) => Promise<void>;
}

export const AiAdvisorView: React.FC<AiAdvisorViewProps> = ({
  tasks,
  subjects,
  metrics,
  onUpdateTask,
}) => {
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    prioritizedTaskIds?: string[];
    burnoutRisk?: string;
    workloadFactor?: number;
    summary?: string;
    actionableSteps?: string[];
    studySchedule?: {
      timeSlot: string;
      subject: string;
      task: string;
      focusStrategy: string;
    }[];
  } | null>(null);

  const [appliedNotice, setAppliedNotice] = useState(false);

  const handleRunAiAnalysis = async () => {
    try {
      setLoading(true);
      setAppliedNotice(false);

      const activeTasks = tasks.filter((t) => t.status !== 'completed');

      const res = await fetch('/api/ai/prioritize-workload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: activeTasks,
          subjects,
        }),
      });

      if (!res.ok) throw new Error('AI analysis failed');
      const data = await res.json();
      setAiResult(data);
    } catch (err) {
      console.error('Error running AI advisor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAiPriorities = async () => {
    if (!aiResult?.prioritizedTaskIds || aiResult.prioritizedTaskIds.length === 0) return;

    // Set highest priority for the top tasks identified by AI
    const topIds = aiResult.prioritizedTaskIds.slice(0, 3);
    for (const taskId of topIds) {
      await onUpdateTask(taskId, { priority: 'urgent' });
    }
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BrandMark size="sm" />
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                AI Workload Advisor
              </h2>
            </div>
          </div>
        </div>

        <button
          onClick={handleRunAiAnalysis}
          disabled={loading}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-semibold rounded-md shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 text-indigo-200" />
          )}
          <span>{loading ? 'Evaluating Workload...' : 'Run Real-Time AI Analysis'}</span>
        </button>
      </div>

      {/* Applied Notice Feedback */}
      {appliedNotice && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800/60 rounded-md text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Top AI recommendations applied: prioritized tasks marked as Urgent.</span>
        </div>
      )}

      {/* Real-time Status Card & Suggestions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Current Load Diagnostics */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Workload Balance Diagnostics
          </h3>

          <div className="space-y-3">
            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Burnout Risk Index</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white">
                  {aiResult?.burnoutRisk || metrics.burnoutRisk} Risk
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Total Active Workload</div>
              <div className="text-xl font-bold font-mono tabular-nums text-white">
                {metrics.totalPendingHours}{' '}
                <span className="text-xs text-slate-400 font-normal">estimated hours pending</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Subject Effort Distribution</div>
              <div className="space-y-1.5 mt-2">
                {metrics.timeAllocationSuggestions.map((alloc, i) => (
                  <div key={i} className="text-xs flex items-center justify-between">
                    <span className="text-slate-300 truncate max-w-[180px]">
                      {alloc.subjectName}
                    </span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {alloc.recommendedHours}h
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center & Right: AI Recommendations & Study Schedule */}
        <div className="lg:col-span-2 space-y-4">
          {aiResult ? (
            <>
              {/* Executive Assessment */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Executive AI Assessment</span>
                  </div>
                  {aiResult.prioritizedTaskIds && aiResult.prioritizedTaskIds.length > 0 && (
                    <button
                      onClick={handleApplyAiPriorities}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Apply Priority Sorting</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <p className="text-sm text-slate-200 leading-relaxed mb-4">
                  {aiResult.summary}
                </p>

                {aiResult.actionableSteps && aiResult.actionableSteps.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">
                      Strategic Recommendations
                    </div>
                    <ul className="space-y-2">
                      {aiResult.actionableSteps.map((step, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950 p-2.5 rounded border border-slate-800"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Suggested Study Blocks Schedule */}
              {aiResult.studySchedule && aiResult.studySchedule.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>AI-Recommended Daily Study Schedule</span>
                  </div>

                  <div className="space-y-2">
                    {aiResult.studySchedule.map((slot, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950 rounded border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-indigo-400 font-semibold px-2 py-0.5 bg-indigo-950 rounded border border-indigo-900 shrink-0">
                            {slot.timeSlot}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-white">
                              {slot.subject}
                            </div>
                            <div className="text-xs text-slate-400">{slot.task}</div>
                          </div>
                        </div>

                        <span className="text-[11px] text-slate-400 italic">
                          {slot.focusStrategy}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-lg p-8 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Ready for AI Workload Analysis</h4>
              <button
                onClick={handleRunAiAnalysis}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Analyze Workload Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
