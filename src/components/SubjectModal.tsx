import React, { useState, useEffect } from 'react';
import { Subject } from '../types';
import { X, GraduationCap } from 'lucide-react';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (subject: Omit<Subject, 'id' | 'createdAt'>) => Promise<any>;
  onUpdate?: (id: string, updates: Partial<Subject>) => Promise<any>;
  editingSubject?: Subject | null;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#ef4444', // Red
];

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  editingSubject,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [instructor, setInstructor] = useState('');
  const [units, setUnits] = useState(3);
  const [semester, setSemester] = useState('1st Semester 2026-2027');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingSubject) {
      setCode(editingSubject.code);
      setName(editingSubject.name);
      setInstructor(editingSubject.instructor);
      setUnits(editingSubject.units);
      setSemester(editingSubject.semester);
      setMeetingSchedule(editingSubject.meetingSchedule || '');
      setColor(editingSubject.color || '#6366f1');
    } else {
      setCode('');
      setName('');
      setInstructor('');
      setUnits(3);
      setSemester('1st Semester 2026-2027');
      setMeetingSchedule('');
      setColor('#6366f1');
    }
    setErrorMsg('');
  }, [editingSubject, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErrorMsg('Course code and name are required.');
      return;
    }

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      instructor: instructor.trim() || 'TBA',
      units: Number(units) || 3,
      semester: semester.trim(),
      meetingSchedule: meetingSchedule.trim() || undefined,
      color,
    };

    if (editingSubject && onUpdate) {
      await onUpdate(editingSubject.id, payload);
    } else {
      await onSave(payload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 shadow-2xl relative my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-400" />
            <span>{editingSubject ? 'Edit Course Subject' : 'Add Course Subject'}</span>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Course Code *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. IT-CAP401"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white uppercase placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Academic Units
              </label>
              <input
                type="number"
                min="1"
                max="6"
                value={units}
                onChange={(e) => setUnits(parseInt(e.target.value) || 3)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Course Title *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Capstone Project 1"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Instructor / Professor
            </label>
            <input
              type="text"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="e.g. Prof. E. Santos"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Meeting Schedule
            </label>
            <input
              type="text"
              value={meetingSchedule}
              onChange={(e) => setMeetingSchedule(e.target.value)}
              placeholder="e.g. Mon/Wed 1:00 PM - 3:00 PM (Room ICT-302)"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Course Accent Color
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

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
              {editingSubject ? 'Save Course' : 'Add Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
