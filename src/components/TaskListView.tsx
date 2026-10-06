import React, { useState, useMemo } from 'react';
import { AcademicTask, Subject, TaskStatus, TaskType } from '../types';
import { formatDateTime, getCountdown } from '../utils/dateUtils';
import {
  Search,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Sparkles,
  Edit2,
  Trash2,
  Plus,
  Filter,
  CheckSquare,
  Square,
  Loader2,
  Calendar,
  Layers,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TaskListViewProps {
  tasks: AcademicTask[];
  subjects: Subject[];
  onToggleStatus: (id: string) => Promise<void>;
  onToggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  onEditTask: (task: AcademicTask) => void;
  onDeleteTask: (id: string) => Promise<void>;
  onOpenNewTask: () => void;
  onUpdateTask: (id: string, updates: Partial<AcademicTask>) => Promise<void>;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  subjects,
  onToggleStatus,
  onToggleSubtask,
  onEditTask,
  onDeleteTask,
  onOpenNewTask,
  onUpdateTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [aiLoadingTaskId, setAiLoadingTaskId] = useState<string | null>(null);
  const overdueCount = tasks.filter(
    (task) => task.status !== 'completed' && getCountdown(task.dueDate).isOverdue
  ).length;

  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesNotes = task.notes?.toLowerCase().includes(query);
        const subject = subjectMap.get(task.subjectId);
        const matchesSubject = subject
          ? subject.code.toLowerCase().includes(query) || subject.name.toLowerCase().includes(query)
          : false;
        if (!matchesTitle && !matchesNotes && !matchesSubject) return false;
      }

      if (selectedSubjectId !== 'all' && task.subjectId !== selectedSubjectId) {
        return false;
      }

      if (selectedStatus === 'overdue') {
        if (task.status === 'completed' || !getCountdown(task.dueDate).isOverdue) return false;
      } else if (selectedStatus !== 'all' && task.status !== selectedStatus) {
        return false;
      }

      if (selectedType !== 'all' && task.type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedSubjectId, selectedStatus, selectedType, subjectMap]);

  const handleStatusToggle = async (task: AcademicTask) => {
    if (task.status === 'in_progress') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {
        // ignore
      }
    }
    await onToggleStatus(task.id);
  };

  const handleDecomposeWithAi = async (task: AcademicTask) => {
    try {
      setAiLoadingTaskId(task.id);
      const subject = subjectMap.get(task.subjectId);

      const res = await fetch('/api/ai/breakdown-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: task.title,
          taskType: task.type,
          subjectCode: subject ? `${subject.code} - ${subject.name}` : '',
          estimatedHours: task.estimatedHours,
          notes: task.notes,
        }),
      });

      if (!res.ok) throw new Error('AI breakdown request failed');
      const data = await res.json();

      if (Array.isArray(data.subtasks) && data.subtasks.length > 0) {
        const newSubtasks = [
          ...task.subtasks,
          ...data.subtasks.map((st: any, i: number) => ({
            id: 'st-ai-' + Date.now() + '-' + i,
            title: st.title || st,
            completed: false,
          })),
        ];

        await onUpdateTask(task.id, { subtasks: newSubtasks });
        setExpandedTaskId(task.id);
      }
    } catch (err) {
      console.error('Failed to decompose with AI', err);
    } finally {
      setAiLoadingTaskId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar: Search, Filters & Counters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/40 p-3 rounded-lg border border-slate-800">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tasks, subjects, notes..."
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Subject Filter */}
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Courses</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 capitalize"
          >
            <option value="all">All Types</option>
            <option value="assignment">Assignments</option>
            <option value="project">Projects</option>
            <option value="quiz">Quizzes</option>
            <option value="examination">Examinations</option>
            <option value="deadline">Deadlines</option>
          </select>

          {/* Status Tabs */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                selectedStatus === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setSelectedStatus('pending')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                selectedStatus === 'pending' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setSelectedStatus('overdue')}
              aria-pressed={selectedStatus === 'overdue'}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                selectedStatus === 'overdue' ? 'bg-rose-950/70 text-rose-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Overdue ({overdueCount})
            </button>
            <button
              onClick={() => setSelectedStatus('in_progress')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                selectedStatus === 'in_progress' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setSelectedStatus('completed')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                selectedStatus === 'completed' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Completed
            </button>
          </div>
        </div>
      </div>

      {/* Task List Table/Cards */}
      {filteredTasks.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-lg p-10 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 mb-3">
            <Calendar className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="text-sm font-bold text-white mb-3">No Pending Deliverables</h3>
          <button
            onClick={onOpenNewTask}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm shadow-indigo-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Deliverable</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const subject = subjectMap.get(task.subjectId);
            const countdown = getCountdown(task.dueDate);
            const completedSubtasks = task.subtasks.filter((st) => st.completed).length;
            const totalSubtasks = task.subtasks.length;
            const isExpanded = expandedTaskId === task.id;

            return (
              <div
                key={task.id}
                className={`bg-slate-900/80 border rounded-lg transition-all ${
                  task.status === 'completed'
                    ? 'border-slate-800/60 opacity-75'
                    : countdown.isOverdue
                    ? 'border-rose-900/50 bg-rose-950/10'
                    : countdown.isUrgent
                    ? 'border-amber-900/40 bg-amber-950/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Main Row */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Left: Checkbox / Status + Title + Subject */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Status Toggle Button */}
                    <button
                      onClick={() => handleStatusToggle(task)}
                      title={`Status: ${task.status}. Click to cycle.`}
                      className="mt-0.5 cursor-pointer text-slate-400 hover:text-white transition-colors shrink-0"
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : task.status === 'in_progress' ? (
                        <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-600 hover:border-slate-400" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1 text-xs">
                        {/* Subject Code */}
                        <span
                          className="font-bold font-mono tracking-tight text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${subject?.color || '#6366f1'}20`,
                            color: subject?.color || '#818cf8',
                          }}
                        >
                          {subject?.code || 'GEN-IT'}
                        </span>

                        {/* Unboxed Metadata (Separated with middot per Universal Frontend Design) */}
                        <span className="text-slate-500 capitalize">{task.type}</span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono tabular-nums text-slate-400">
                          {task.estimatedHours}h effort
                        </span>
                        {task.weightPercentage ? (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="font-mono tabular-nums text-slate-400">
                              {task.weightPercentage}% grade
                            </span>
                          </>
                        ) : null}
                      </div>

                      {/* Title */}
                      <h3
                        className={`text-sm sm:text-base font-semibold text-white leading-snug break-words ${
                          task.status === 'completed' ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {task.title}
                      </h3>

                      {/* Notes snippet if any */}
                      {task.notes && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{task.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Right: Deadline Countdown + Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    {/* Countdown / Due date */}
                    <div className="text-left sm:text-right">
                      <div
                        className={`text-xs font-mono font-semibold tabular-nums flex items-center sm:justify-end gap-1 ${
                          task.status === 'completed'
                            ? 'text-emerald-400'
                            : countdown.isOverdue
                            ? 'text-rose-400 font-bold'
                            : countdown.isUrgent
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>
                          {task.status === 'completed' ? 'Submitted' : countdown.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono tabular-nums">
                        {formatDateTime(task.dueDate)}
                      </div>
                    </div>

                    {/* Subtasks counter toggle */}
                    {totalSubtasks > 0 && (
                      <button
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-950 rounded border border-slate-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span className="font-mono tabular-nums">
                          {completedSubtasks}/{totalSubtasks}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {/* AI Decompose Button */}
                    <button
                      onClick={() => handleDecomposeWithAi(task)}
                      disabled={aiLoadingTaskId === task.id}
                      title="Decompose requirement into milestones using Gemini AI"
                      className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/60 rounded border border-indigo-800/40 transition-colors cursor-pointer shrink-0"
                    >
                      {aiLoadingTaskId === task.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => onEditTask(task)}
                      title="Edit activity"
                      aria-label={`Edit ${task.title}`}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      title="Delete activity"
                      aria-label={`Delete ${task.title}`}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Subtasks Section */}
                {isExpanded && totalSubtasks > 0 && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-800/60 bg-slate-950/40">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Milestones ({completedSubtasks}/{totalSubtasks})
                    </div>
                    <div className="space-y-1.5">
                      {task.subtasks.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => onToggleSubtask(task.id, st.id)}
                          className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded cursor-pointer transition-colors text-xs"
                        >
                          {st.completed ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                          <span
                            className={
                              st.completed
                                ? 'line-through text-slate-500'
                                : 'text-slate-300'
                            }
                          >
                            {st.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
