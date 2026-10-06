import React, { useState, useMemo } from 'react';
import { AcademicTask, Subject } from '../types';
import { formatDateTime, formatDateOnly, getCountdown } from '../utils/dateUtils';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  AlertTriangle,
} from 'lucide-react';

interface CalendarViewProps {
  tasks: AcademicTask[];
  subjects: Subject[];
  onOpenNewTask: () => void;
  onEditTask: (task: AcademicTask) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  subjects,
  onOpenNewTask,
  onEditTask,
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return new Date().toISOString().substring(0, 10);
  });

  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Map tasks by date string (YYYY-MM-DD)
  const tasksByDate = useMemo(() => {
    const map: Record<string, AcademicTask[]> = {};
    tasks.forEach((t) => {
      if (t.dueDate) {
        const dateKey = t.dueDate.substring(0, 10);
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(t);
      }
    });
    return map;
  }, [tasks]);

  // Calendar days grid calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { day: number; monthOffset: number; dateStr: string }[] = [];

    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      days.push({
        day: d,
        monthOffset: -1,
        dateStr: prevDate.toISOString().substring(0, 10),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const curDate = new Date(year, month, i);
      days.push({
        day: i,
        monthOffset: 0,
        dateStr: curDate.toISOString().substring(0, 10),
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        day: i,
        monthOffset: 1,
        dateStr: nextDate.toISOString().substring(0, 10),
      });
    }

    return days;
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(now.toISOString().substring(0, 10));
  };

  const selectedDayTasks = tasksByDate[selectedDateStr] || [];

  // Sorted upcoming tasks for the timeline rail
  const upcomingChronological = useMemo(() => {
    return [...tasks]
      .filter((t) => t.status !== 'completed')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 8);
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Calendar Controls Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {monthName}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={handlePrevMonth}
            className="p-1 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenNewTask}
            className="ml-2 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Deadline</span>
          </button>
        </div>
      </div>

      {/* Grid + Schedule Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 cols on desktop) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-lg p-4">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-400 pb-2 border-b border-slate-800">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-2">
            {calendarDays.map((cell, idx) => {
              const dayTasks = tasksByDate[cell.dateStr] || [];
              const isSelected = selectedDateStr === cell.dateStr;
              const isToday = cell.dateStr === new Date().toISOString().substring(0, 10);
              const isCurrentMonth = cell.monthOffset === 0;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={`min-h-[72px] sm:min-h-[88px] p-1.5 rounded border transition-colors cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/20'
                      : isCurrentMonth
                      ? 'border-slate-800/80 hover:border-slate-700 bg-slate-950/40'
                      : 'border-transparent opacity-40 bg-slate-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold tabular-nums ${
                        isToday
                          ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center'
                          : isCurrentMonth
                          ? 'text-slate-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {cell.day}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task Indicators */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayTasks.slice(0, 2).map((t) => {
                      const subject = subjectMap.get(t.subjectId);
                      return (
                        <div
                          key={t.id}
                          className="text-[10px] truncate px-1 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: `${subject?.color || '#6366f1'}25`,
                            color: subject?.color || '#a5b4fc',
                          }}
                          title={t.title}
                        >
                          {t.title}
                        </div>
                      );
                    })}
                    {dayTasks.length > 2 && (
                      <div className="text-[9px] text-slate-500 px-1">
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda & Upcoming Timeline */}
        <div className="space-y-4">
          {/* Day Inspector */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="text-xs text-slate-400">Selected Day Agenda</div>
                <div className="text-sm font-bold text-white font-mono">
                  {formatDateOnly(selectedDateStr)}
                </div>
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {selectedDayTasks.length} deliverable{selectedDayTasks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {selectedDayTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No deliverables due on this date.
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedDayTasks.map((task) => {
                  const subject = subjectMap.get(task.subjectId);
                  const countdown = getCountdown(task.dueDate);
                  return (
                    <div
                      key={task.id}
                      onClick={() => onEditTask(task)}
                      className="p-2.5 bg-slate-950 rounded border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span
                          className="font-bold font-mono"
                          style={{ color: subject?.color || '#818cf8' }}
                        >
                          {subject?.code}
                        </span>
                        <span className="text-slate-400 font-mono tabular-nums">
                          {countdown.label}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-white truncate">
                        {task.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Continuous Schedule Timeline */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Imminent Deadlines Timeline</span>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {upcomingChronological.map((task) => {
                const subject = subjectMap.get(task.subjectId);
                const countdown = getCountdown(task.dueDate);
                return (
                  <div
                    key={task.id}
                    onClick={() => onEditTask(task)}
                    className="p-2.5 bg-slate-950 rounded border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span
                        className="font-bold font-mono"
                        style={{ color: subject?.color || '#818cf8' }}
                      >
                        {subject?.code}
                      </span>
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          countdown.isOverdue
                            ? 'text-rose-400'
                            : countdown.isUrgent
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {countdown.label}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-white truncate">
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                      {formatDateTime(task.dueDate)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
