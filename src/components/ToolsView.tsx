import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { AcademicTask, CourseGrade, Subject } from '../types';
import { db } from '../services/firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getCountdown } from '../utils/dateUtils';
import { BellRing, BookOpenCheck, CalendarClock, CheckCircle2, Clock3, Loader2, Target } from 'lucide-react';

interface ToolsViewProps {
  user: User;
  tasks: AcademicTask[];
  subjects: Subject[];
}

interface StudyBlock {
  timeSlot: string;
  subject: string;
  task: string;
  focusStrategy: string;
}

const notificationOptions = [
  { value: 24, label: '1 day before' },
  { value: 3, label: '3 hours before' },
  { value: 1, label: '1 hour before' },
];

export const ToolsView: React.FC<ToolsViewProps> = ({ user, tasks, subjects }) => {
  const [grades, setGrades] = useState<Record<string, CourseGrade>>({});
  const [studyBlocks, setStudyBlocks] = useState<StudyBlock[]>([]);
  const [studySummary, setStudySummary] = useState('');
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(() => localStorage.getItem(`acadpulse:reminders:${user.uid}`) === 'enabled');
  const [reminderHours, setReminderHours] = useState(() => Number(localStorage.getItem(`acadpulse:reminder-hours:${user.uid}`) || 24));
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const activeTasks = useMemo(() => tasks.filter((task) => task.status !== 'completed'), [tasks]);

  useEffect(() => {
    const gradesRef = collection(db, 'users', user.uid, 'course_grades');
    return onSnapshot(gradesRef, (snapshot) => {
      const nextGrades: Record<string, CourseGrade> = {};
      snapshot.docs.forEach((gradeDoc) => {
        nextGrades[gradeDoc.id] = gradeDoc.data() as CourseGrade;
      });
      setGrades(nextGrades);
    });
  }, [user.uid]);

  useEffect(() => {
    if (!remindersEnabled || notificationPermission !== 'granted') return;

    const notifyUpcoming = () => {
      const now = Date.now();
      for (const task of activeTasks) {
        if (!task.dueDate) continue;
        const dueTime = new Date(task.dueDate).getTime();
        const remainingMs = dueTime - now;
        if (remainingMs <= 0 || remainingMs > reminderHours * 60 * 60 * 1000) continue;
        const reminderKey = `acadpulse:reminded:${user.uid}:${task.id}:${task.dueDate}:${reminderHours}`;
        if (localStorage.getItem(reminderKey)) continue;
        const subject = subjects.find((item) => item.id === task.subjectId);
        new Notification(`Upcoming: ${task.title}`, {
          body: `${subject?.code || 'Course'} · ${getCountdown(task.dueDate).label}`,
          tag: reminderKey,
        });
        localStorage.setItem(reminderKey, 'sent');
      }
    };

    notifyUpcoming();
    const timer = window.setInterval(notifyUpcoming, 60_000);
    return () => window.clearInterval(timer);
  }, [activeTasks, notificationPermission, reminderHours, remindersEnabled, subjects, user.uid]);

  const handleGeneratePlan = async () => {
    setPlannerLoading(true);
    setPlannerError('');
    try {
      const response = await fetch('/api/ai/prioritize-workload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: activeTasks, subjects }),
      });
      if (!response.ok) throw new Error('Could not generate the study plan. Try again.');
      const result = await response.json();
      const subjectNames = new Map(subjects.map((subject) => [subject.code, subject.name]));
      const generatedBlocks = Array.isArray(result.studySchedule)
        ? result.studySchedule as StudyBlock[]
        : (result.prioritizedTaskIds || [])
          .map((taskId: string, index: number) => activeTasks.find((task) => task.id === taskId) || activeTasks[index])
          .filter(Boolean)
          .slice(0, 5)
          .map((task: AcademicTask, index: number) => {
            const subject = subjects.find((item) => item.id === task.subjectId);
            return {
              timeSlot: `${index + 1} · ${task.estimatedHours || 2}h block`,
              subject: subject ? `${subject.code} · ${subject.name}` : 'Course work',
              task: task.title,
              focusStrategy: task.type === 'examination' || task.type === 'quiz' ? 'Active recall and spaced practice' : 'Focused work, then review',
            };
          });
      setStudyBlocks(generatedBlocks);
      setStudySummary(result.summary || `Plan generated for ${activeTasks.length} active activities.`);
      void subjectNames;
    } catch (reason) {
      setPlannerError(reason instanceof Error ? reason.message : 'Study plan generation failed.');
    } finally {
      setPlannerLoading(false);
    }
  };

  const updateGrade = async (subjectId: string, update: Partial<CourseGrade>) => {
    const current = grades[subjectId] || {
      subjectId,
      currentGrade: 0,
      gradedWeight: 0,
      targetGrade: 90,
      updatedAt: new Date().toISOString(),
    };
    const nextGrade = { ...current, ...update, updatedAt: new Date().toISOString() };
    setGrades((existing) => ({ ...existing, [subjectId]: nextGrade }));
    await setDoc(doc(db, 'users', user.uid, 'course_grades', subjectId), nextGrade);
  };

  const enableReminders = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      setRemindersEnabled(true);
      localStorage.setItem(`acadpulse:reminders:${user.uid}`, 'enabled');
    }
  };

  const toggleReminders = () => {
    const enabled = !remindersEnabled;
    setRemindersEnabled(enabled);
    localStorage.setItem(`acadpulse:reminders:${user.uid}`, enabled ? 'enabled' : 'disabled');
    if (enabled && notificationPermission !== 'granted') void enableReminders();
  };

  const setReminderLead = (hours: number) => {
    setReminderHours(hours);
    localStorage.setItem(`acadpulse:reminder-hours:${user.uid}`, String(hours));
  };

  const progressFor = (subject: Subject) => {
    const courseTasks = tasks.filter((task) => task.subjectId === subject.id);
    const completed = courseTasks.filter((task) => task.status === 'completed').length;
    const overdue = courseTasks.filter((task) => task.status !== 'completed' && getCountdown(task.dueDate).isOverdue).length;
    const percent = courseTasks.length ? Math.round((completed / courseTasks.length) * 100) : 0;
    return { total: courseTasks.length, completed, overdue, percent };
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div><h2 className="text-xl font-semibold text-white">Study tools</h2><p className="mt-1 text-sm text-slate-400">Planning, grade targets, reminders, and course progress</p></div>
        <span className="text-xs text-slate-500">{activeTasks.length} active activities</span>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-indigo-300" /><h3 className="font-semibold text-white">Smart study planner</h3></div>
            <button onClick={() => void handleGeneratePlan()} disabled={plannerLoading || activeTasks.length === 0} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              {plannerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
              {plannerLoading ? 'Planning...' : 'Build my plan'}
            </button>
          </div>
          {plannerError && <p className="mt-3 text-sm text-rose-300">{plannerError}</p>}
          {studySummary && <p className="mt-4 text-sm leading-relaxed text-slate-300">{studySummary}</p>}
          {studyBlocks.length ? (
            <div className="mt-4 space-y-2">
              {studyBlocks.map((block, index) => <div key={`${block.task}-${index}`} className="grid gap-2 rounded-md border border-slate-800 bg-slate-950/70 p-3 sm:grid-cols-[140px_1fr]">
                <div className="flex items-center gap-2 text-xs font-medium text-indigo-200"><Clock3 className="h-4 w-4 shrink-0" />{block.timeSlot}</div>
                <div><div className="text-sm font-semibold text-white">{block.task}</div><div className="mt-1 text-xs text-slate-400">{block.subject} · {block.focusStrategy}</div></div>
              </div>)}
            </div>
          ) : !studySummary && <p className="mt-4 text-sm text-slate-500">Generate a prioritized plan from your current deadlines and workload.</p>}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2"><BellRing className="h-5 w-5 text-amber-300" /><h3 className="font-semibold text-white">Deadline reminders</h3></div>
          <p className="mt-2 text-sm text-slate-400">Browser notifications for activities approaching their due date. The site must be open.</p>
          <label className="mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950 p-3">
            <span><span className="block text-sm font-medium text-white">Enable reminders</span><span className="block text-xs text-slate-500">Permission: {notificationPermission}</span></span>
            <input type="checkbox" checked={remindersEnabled} onChange={toggleReminders} className="h-4 w-4 accent-indigo-500" />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-300">Notify me
            <select value={reminderHours} onChange={(event) => setReminderLead(Number(event.target.value))} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              {notificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {notificationPermission === 'denied' && <p className="mt-2 text-xs text-rose-300">Notifications are blocked by the browser. Enable them in site settings to use reminders.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4 flex items-center gap-2"><Target className="h-5 w-5 text-emerald-300" /><div><h3 className="font-semibold text-white">Grade goal tracker</h3><p className="text-xs text-slate-400">Estimate the average needed on remaining graded work to reach your goal.</p></div></div>
        {subjects.length === 0 ? <p className="text-sm text-slate-500">Add a course to start tracking grade goals.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs text-slate-400"><tr className="border-b border-slate-800"><th className="pb-2 font-medium">Course</th><th className="pb-2 font-medium">Current average</th><th className="pb-2 font-medium">Graded weight</th><th className="pb-2 font-medium">Target</th><th className="pb-2 font-medium">Needed on remaining</th></tr></thead><tbody>
          {subjects.map((subject) => {
            const grade = grades[subject.id] || { currentGrade: 0, gradedWeight: 0, targetGrade: 90 };
            const remaining = 100 - grade.gradedWeight;
            const needed = remaining > 0 ? (grade.targetGrade * 100 - grade.currentGrade * grade.gradedWeight) / remaining : grade.currentGrade;
            return <tr key={subject.id} className="border-b border-slate-800/60 last:border-0"><td className="py-3 pr-3"><span className="font-mono text-xs text-indigo-200">{subject.code}</span><span className="ml-2 text-slate-300">{subject.name}</span></td>
              <td className="py-2 pr-3"><NumberInput label={`${subject.code} current average`} value={grade.currentGrade} onCommit={(value) => void updateGrade(subject.id, { currentGrade: value })} /></td>
              <td className="py-2 pr-3"><NumberInput label={`${subject.code} graded weight`} value={grade.gradedWeight} onCommit={(value) => void updateGrade(subject.id, { gradedWeight: value })} /></td>
              <td className="py-2 pr-3"><NumberInput label={`${subject.code} target grade`} value={grade.targetGrade} onCommit={(value) => void updateGrade(subject.id, { targetGrade: value })} /></td>
              <td className={`py-3 font-mono font-semibold ${needed > 100 ? 'text-rose-300' : 'text-emerald-300'}`}>{remaining <= 0 ? `${grade.currentGrade.toFixed(1)}% final` : needed > 100 ? `${needed.toFixed(1)}% needed` : `${Math.max(0, needed).toFixed(1)}% needed`}</td>
            </tr>;
          })}
        </tbody></table></div>}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-cyan-300" /><div><h3 className="font-semibold text-white">Course progress</h3><p className="text-xs text-slate-400">Completion and overdue work by course.</p></div></div>
        {subjects.length === 0 ? <p className="text-sm text-slate-500">No courses to show yet.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => {
            const progress = progressFor(subject);
            return <div key={subject.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-start justify-between gap-3"><div><div className="font-mono text-xs" style={{ color: subject.color }}>{subject.code}</div><h4 className="mt-1 text-sm font-semibold text-white">{subject.name}</h4></div><span className="font-mono text-sm font-semibold text-white">{progress.percent}%</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress.percent}%` }} /></div>
              <div className="mt-3 flex justify-between text-xs text-slate-400"><span>{progress.completed}/{progress.total} complete</span><span className={progress.overdue ? 'text-rose-300' : ''}>{progress.overdue} overdue</span></div>
            </div>;
          })}
        </div>}
      </section>
    </div>
  );
};

function NumberInput({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <input aria-label={label} type="number" min="0" max="100" step="0.1" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => {
    const number = Number(draft);
    if (Number.isFinite(number)) onCommit(Math.min(100, Math.max(0, number)));
  }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none" />;
}
