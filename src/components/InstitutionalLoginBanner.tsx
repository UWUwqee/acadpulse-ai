import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { detectAllPendingActivities, DetectedSchoolActivity } from '../services/googleWorkspace';
import { Subject, AcademicTask } from '../types';
import { getInstitutionInfo } from '../utils/institutionHelper';
import {
  Loader2,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Calendar,
  GraduationCap,
  Briefcase,
  School,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface InstitutionalLoginBannerProps {
  user: User;
  token: string | null;
  onLogout: () => void;
  onSyncActivities: (
    newCourses: Subject[],
    newTasks: Omit<AcademicTask, 'id' | 'createdAt'>[]
  ) => Promise<void>;
  existingSubjects: Subject[];
}

export const InstitutionalLoginBanner: React.FC<InstitutionalLoginBannerProps> = ({
  user,
  token,
  onLogout,
  onSyncActivities,
  existingSubjects,
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedActivities, setDetectedActivities] = useState<DetectedSchoolActivity[]>([]);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const accountInfo = getInstitutionInfo(user.email);

  const handleDetectAndSync = async () => {
    if (!token) {
      setErrorMsg('Google OAuth session expired. Please re-authenticate.');
      return;
    }

    try {
      setIsDetecting(true);
      setErrorMsg(null);
      setSyncFeedback(null);

      const result = await detectAllPendingActivities(token);
      setDetectedActivities(result.activities);

      const formattedTasks: Omit<AcademicTask, 'id' | 'createdAt'>[] = result.activities.map((act) => {
        const matchedCourse = result.courses.find(
          (c) => c.name.toLowerCase() === act.courseName.toLowerCase() || c.code === act.courseCode
        );
        const courseId = matchedCourse ? matchedCourse.id : (existingSubjects[0]?.id || 'sub-1');

        return {
          title: act.title,
          subjectId: courseId,
          type: act.type,
          dueDate: act.dueDate,
          estimatedHours: act.estimatedHours,
          priority: 'urgent',
          status: act.status,
          subtasks: [
            {
              id: 'st-' + Math.random().toString(36).substring(2, 6),
              title: `Review deliverable requirements: ${act.title}`,
              completed: false,
            },
            {
              id: 'st-' + Math.random().toString(36).substring(2, 6),
              title: 'Complete and verify submission',
              completed: false,
            },
          ],
          notes: `${act.notes || ''}${act.link ? `\nLink: ${act.link}` : ''}`,
        };
      });

      await onSyncActivities(result.courses, formattedTasks);

      if (result.activities.length > 0) {
        setSyncFeedback(
          `Detected & synced ${result.activities.length} pending activities from ${accountInfo.isInstitutional ? 'Google Classroom & Calendar' : 'Google Tasks & Calendar'}!`
        );
      } else {
        setSyncFeedback(
          accountInfo.isInstitutional
            ? 'Connected! No pending coursework or exams detected in your school Google account right now.'
            : 'Connected! No pending tasks or scheduled deadlines detected in your Google Tasks/Calendar right now.'
        );
      }
    } catch (err: unknown) {
      console.error('Detection error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch pending activities from Google Workspace.';
      setErrorMsg(msg);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-indigo-900/40 rounded-xl p-4 sm:p-5 mb-6 relative overflow-hidden">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left Side: Account Info & Detected Source */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800/80 flex items-center justify-center text-indigo-400 shrink-0">
            {accountInfo.isInstitutional ? (
              <School className="w-5 h-5 text-indigo-400" />
            ) : (
              <Briefcase className="w-5 h-5 text-cyan-400" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-sm font-bold text-white tracking-tight">
                AcadPulse-AI Connected Workspace
              </h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                accountInfo.isInstitutional
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-800/50'
                  : 'bg-cyan-950 text-cyan-300 border-cyan-800/50'
              }`}>
                {accountInfo.isInstitutional ? (
                  <GraduationCap className="w-3 h-3 text-indigo-400" />
                ) : (
                  <Briefcase className="w-3 h-3 text-cyan-400" />
                )}
                <span>{accountInfo.badgeLabel}</span>
              </span>
            </div>

            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
              <span className="font-mono text-white font-medium">{user.email}</span>
              {user.displayName && (
                <span className="text-slate-400">({user.displayName})</span>
              )}
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {accountInfo.isInstitutional
                    ? 'Classroom & Calendar Synced'
                    : 'Google Tasks & Calendar Synced'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Re-detect Activities & Sign Out */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleDetectAndSync}
            disabled={isDetecting}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>
              {isDetecting
                ? 'Detecting Activities...'
                : accountInfo.isInstitutional
                ? 'Re-detect School Coursework'
                : 'Re-detect Tasks & Schedule'}
            </span>
          </button>

          <button
            onClick={onLogout}
            title="Sign out from Google account"
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {errorMsg && (
        <div className="mt-3 p-2.5 bg-rose-950/60 border border-rose-800/60 rounded-lg text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {syncFeedback && (
        <div className="mt-3 p-2.5 bg-emerald-950/60 border border-emerald-800/60 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Live Detected Activities Drawer / Preview */}
      {detectedActivities.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Detected Activities ({detectedActivities.length})</span>
            <span className="text-[10px] text-slate-500 font-normal">
              {accountInfo.isInstitutional
                ? `Google Classroom & Calendar · ${accountInfo.institutionName}`
                : `Google Tasks & Calendar · ${accountInfo.institutionName}`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {detectedActivities.map((act) => (
              <div
                key={act.id}
                className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="font-mono text-indigo-400 font-semibold truncate max-w-[140px]">
                      {act.courseName}
                    </span>
                    <span className="uppercase text-[9px] px-1 bg-slate-900 rounded font-mono text-slate-400">
                      {act.source}
                    </span>
                  </div>
                  <div className="font-semibold text-white truncate" title={act.title}>
                    {act.title}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 mt-1 font-mono tabular-nums flex items-center justify-between">
                  <span>{new Date(act.dueDate).toLocaleDateString()}</span>
                  <span className="text-amber-400 font-semibold">{act.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
