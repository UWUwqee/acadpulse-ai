import React from 'react';
import { Subject, AcademicTask, AcademicResource } from '../types';
import { Plus, GraduationCap, Edit2, Trash2, Calendar, BookOpen, Clock } from 'lucide-react';

interface SubjectDirectoryViewProps {
  subjects: Subject[];
  tasks: AcademicTask[];
  resources: AcademicResource[];
  onOpenNewSubject: () => void;
  onEditSubject: (subject: Subject) => void;
  onDeleteSubject: (id: string) => Promise<void>;
  onSelectSubjectFilter?: (subjectId: string) => void;
}

export const SubjectDirectoryView: React.FC<SubjectDirectoryViewProps> = ({
  subjects,
  tasks,
  resources,
  onOpenNewSubject,
  onEditSubject,
  onDeleteSubject,
  onSelectSubjectFilter,
}) => {
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-slate-900/40 p-4 rounded-lg border border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Registered Courses & Projects ({subjects.length})
          </h2>
        </div>

        <button
          onClick={onOpenNewSubject}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Course</span>
        </button>
      </div>

      {/* Grid of Courses */}
      {subjects.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-lg p-10 text-center">
          <GraduationCap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-400 mb-3">
            No courses registered yet.
          </p>
          <button
            onClick={onOpenNewSubject}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Course</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject) => {
            const subjectTasks = tasks.filter((t) => t.subjectId === subject.id);
            const pendingCount = subjectTasks.filter((t) => t.status !== 'completed').length;
            const resourceCount = resources.filter((r) => r.subjectId === subject.id).length;

            return (
              <div
                key={subject.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-lg p-5 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header: Code + Units + Edit/Delete */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold font-mono px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${subject.color}20`,
                          color: subject.color,
                        }}
                      >
                        {subject.code}
                      </span>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        {subject.units} Units
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditSubject(subject)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteSubject(subject.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Course Name */}
                  <h3 className="text-sm font-bold text-white mb-1">{subject.name}</h3>
                  <div className="text-xs text-slate-400 mb-3">{subject.instructor}</div>

                  {/* Schedule info if any */}
                  {subject.meetingSchedule && (
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-3 bg-slate-950 p-2 rounded border border-slate-800">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{subject.meetingSchedule}</span>
                    </div>
                  )}
                </div>

                {/* Statistics & Quick Filters */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      <strong className="text-white font-mono tabular-nums">{pendingCount}</strong> pending
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">
                      <strong className="text-white font-mono tabular-nums">{resourceCount}</strong> resources
                    </span>
                  </div>

                  {onSelectSubjectFilter && (
                    <button
                      onClick={() => onSelectSubjectFilter(subject.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                    >
                      View Tasks
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
