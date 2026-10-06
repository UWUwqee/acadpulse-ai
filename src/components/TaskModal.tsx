import React, { useState, useEffect } from 'react';
import { AcademicTask, Subject, TaskType, TaskPriority, TaskStatus, Subtask } from '../types';
import { X, Sparkles, Plus, Trash2, Loader2, Calendar, Clock } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<AcademicTask, 'id' | 'createdAt'>) => Promise<any>;
  onUpdate?: (id: string, updates: Partial<AcademicTask>) => Promise<any>;
  editingTask?: AcademicTask | null;
  subjects: Subject[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  editingTask,
  subjects,
}) => {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [type, setType] = useState<TaskType>('assignment');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(3);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [weightPercentage, setWeightPercentage] = useState<number>(15);
  const [notes, setNotes] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isGeneratingAiSubtasks, setIsGeneratingAiSubtasks] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setSubjectId(editingTask.subjectId);
      setType(editingTask.type);
      setDueDate(editingTask.dueDate ? editingTask.dueDate.substring(0, 16) : '');
      setEstimatedHours(editingTask.estimatedHours || 3);
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      setWeightPercentage(editingTask.weightPercentage || 15);
      setNotes(editingTask.notes || '');
      setSubtasks(editingTask.subtasks || []);
    } else {
      setTitle('');
      setSubjectId(subjects[0]?.id || '');
      setType('assignment');
      // Default due date: tomorrow at 23:59
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 0, 0);
      setDueDate(tomorrow.toISOString().substring(0, 16));
      setEstimatedHours(3);
      setPriority('medium');
      setStatus('pending');
      setWeightPercentage(15);
      setNotes('');
      setSubtasks([]);
    }
    setErrorMsg('');
  }, [editingTask, isOpen, subjects]);

  if (!isOpen) return null;

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([
      ...subtasks,
      {
        id: 'st-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        title: newSubtaskTitle.trim(),
        completed: false,
      },
    ]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== id));
  };

  const handleAiBreakdown = async () => {
    if (!title.trim()) {
      setErrorMsg('Please enter a deliverable title first to generate AI milestones.');
      return;
    }

    try {
      setIsGeneratingAiSubtasks(true);
      setErrorMsg('');

      const activeSubject = subjects.find((s) => s.id === subjectId);

      const res = await fetch('/api/ai/breakdown-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: title,
          taskType: type,
          subjectCode: activeSubject ? `${activeSubject.code} - ${activeSubject.name}` : '',
          estimatedHours,
          notes,
        }),
      });

      if (!res.ok) throw new Error('AI breakdown service unavailable');
      const data = await res.json();

      if (Array.isArray(data.subtasks) && data.subtasks.length > 0) {
        const generatedList: Subtask[] = data.subtasks.map((st: any, i: number) => ({
          id: 'st-ai-' + Date.now() + '-' + i,
          title: st.title || st,
          completed: false,
        }));
        setSubtasks([...subtasks, ...generatedList]);
      }
    } catch (err: any) {
      console.warn('AI breakdown notice:', err);
      // Fallback sensible academic milestones
      setSubtasks([
        ...subtasks,
        { id: 'st-fb-1', title: `Review guidelines and outline for ${title}`, completed: false },
        { id: 'st-fb-2', title: `Implement core requirements and drafting`, completed: false },
        { id: 'st-fb-3', title: `Final proofreading, verification, and portal upload`, completed: false },
      ]);
    } finally {
      setIsGeneratingAiSubtasks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Title is required.');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Please select a subject.');
      return;
    }

    const payload = {
      title: title.trim(),
      subjectId,
      type,
      dueDate: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
      estimatedHours: Number(estimatedHours) || 1,
      priority,
      status,
      subtasks,
      weightPercentage: Number(weightPercentage) || 0,
      notes: notes.trim(),
    };

    if (editingTask && onUpdate) {
      await onUpdate(editingTask.id, payload);
    } else {
      await onSave(payload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-xl w-full p-6 shadow-2xl relative my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">
            {editingTask ? 'Edit Academic Deliverable' : 'Add Academic Deliverable'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Deliverable Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 3 System Architecture & Methodology"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Subject & Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Course / Subject *
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Deliverable Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 capitalize"
              >
                <option value="assignment">Assignment</option>
                <option value="project">Project / Capstone</option>
                <option value="quiz">Quiz</option>
                <option value="examination">Examination</option>
                <option value="deadline">Administrative Deadline</option>
              </select>
            </div>
          </div>

          {/* Due Date & Estimated Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Deadline Due Date & Time *</span>
              </label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Estimated Study Hours</span>
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                max="100"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Priority & Status & Grade Weight */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 capitalize"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 capitalize"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Grade Weight (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={weightPercentage}
                onChange={(e) => setWeightPercentage(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Subtasks / Milestones Section */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">
                Actionable Milestones ({subtasks.length})
              </label>
              <button
                type="button"
                onClick={handleAiBreakdown}
                disabled={isGeneratingAiSubtasks}
                className="text-[11px] flex items-center gap-1 text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 hover:bg-indigo-950 border border-indigo-800/60 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                {isGeneratingAiSubtasks ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-indigo-300" />
                )}
                <span>Generate with AI</span>
              </button>
            </div>

            {/* Subtask items list */}
            {subtasks.length > 0 && (
              <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto pr-1">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between gap-2 p-1.5 bg-slate-950 rounded border border-slate-800 text-xs"
                  >
                    <span className="text-slate-300 truncate">{st.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(st.id)}
                      className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Add milestone step..."
                className="flex-1 bg-slate-950 border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Instructions or Submission Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Upload PDF to portal. Attach code repository link and testing log."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-sm shadow-indigo-600/30 transition-colors cursor-pointer"
            >
              {editingTask ? 'Save Changes' : 'Create Deliverable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
