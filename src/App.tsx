import React, { useState, useEffect, useRef } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './services/firebase';
import { useAcademicStore } from './hooks/useAcademicStore';
import { initAuth, logoutGoogle, detectAllPendingActivities, fetchClassroomActivities, debugGoogleWorkspaceSync } from './services/googleWorkspace';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { InstitutionalLoginBanner } from './components/InstitutionalLoginBanner';
import { WorkloadMetricsBar } from './components/WorkloadMetricsBar';
import { TaskListView } from './components/TaskListView';
import { CalendarView } from './components/CalendarView';
import { ResourceHubView } from './components/ResourceHubView';
import { AiAdvisorView } from './components/AiAdvisorView';
import { SubjectDirectoryView } from './components/SubjectDirectoryView';
import { TaskModal } from './components/TaskModal';
import { SubjectModal } from './components/SubjectModal';
import { ResourceModal } from './components/ResourceModal';
import { FirebaseModal } from './components/FirebaseModal';
import { ChatView } from './components/ChatView';
import { ToolsView } from './components/ToolsView';
import { AdminPanel } from './components/AdminPanel';
import { ensurePublicProfile } from './services/socialService';
import { getInstitutionInfo } from './utils/institutionHelper';
import { isWithinReminderWindow, getCountdown } from './utils/dateUtils';
import { claimDeadlineReminderEmail, markDeadlineReminderEmailFailed, markDeadlineReminderEmailSent } from './services/deadlineReminders';
import { sendDeadlineReminderEmail } from './services/googleWorkspace';
import { Announcement, ensureUserAccess, isOwnerAccount, recordSystemEvent, subscribeUserAccess, UserAccess } from './services/adminService';
import { AcademicTask, Subject, AcademicResource } from './types';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [detectStatusMessage, setDetectStatusMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState('');
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);
  const [isRootAdmin, setIsRootAdmin] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);

  const {
    subjects,
    tasks,
    resources,
    connectionStatus,
    workloadMetrics,
    addTask,
    addTasksBatch,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    toggleSubtask,
    addSubject,
    updateSubject,
    deleteSubject,
    addResource,
    updateResource,
    deleteResource,
    clearAll,
  } = useAcademicStore(currentUser?.uid);

  const tasksRef = useRef(tasks);
  const subjectsRef = useRef(subjects);
  tasksRef.current = tasks;
  subjectsRef.current = subjects;

  const [activeTab, setActiveTab] = useState<'tasks' | 'schedule' | 'resources' | 'ai' | 'courses' | 'tools' | 'chat' | 'admin'>('tasks');

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AcademicTask | null>(null);

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<AcademicResource | null>(null);

  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  useEffect(() => {
    const unsub = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setIsAuthChecking(false);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setIsAuthChecking(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setUserAccess(null);
      setIsRootAdmin(false);
      return;
    }

    const rootAdmin = isOwnerAccount(currentUser);
    setIsRootAdmin(rootAdmin);
    void ensureUserAccess(currentUser).catch((error) => {
      console.warn('Could not update admin access heartbeat:', error);
    });

    const unsubscribe = subscribeUserAccess(currentUser.uid, (access) => {
      setUserAccess(access);
      const adminEnabled = rootAdmin || access?.role === 'admin';
      setActiveTab((current) => current === 'admin' && !adminEnabled ? 'tasks' : current);
      if (access?.suspended && !rootAdmin) {
        void logoutGoogle().finally(() => {
          setCurrentUser(null);
          setAccessToken(null);
        });
      }
    });
    const heartbeatId = window.setInterval(() => {
      void ensureUserAccess(currentUser).catch(() => {});
    }, 5 * 60 * 1000);
    return () => {
      unsubscribe();
      window.clearInterval(heartbeatId);
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) {
      setAnnouncements([]);
      return;
    }
    const activeAnnouncements = query(
      collection(db, 'site_announcements'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    return onSnapshot(activeAnnouncements, (snapshot) => {
      setAnnouncements(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Announcement)));
    }, (error) => console.warn('Could not load announcements:', error));
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) {
      setDismissedAnnouncements([]);
      return;
    }
    try {
      setDismissedAnnouncements(JSON.parse(localStorage.getItem(`acadpulse:dismissed-announcements:${currentUser.uid}`) || '[]'));
    } catch {
      setDismissedAnnouncements([]);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLastSyncedAt(null);
      return;
    }

    try {
      setLastSyncedAt(window.localStorage.getItem(`acadpulse:last-sync:${currentUser.uid}`));
    } catch {
      setLastSyncedAt(null);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return;

    let checkingReminders = false;
    const checkReminders = async () => {
      if (checkingReminders || localStorage.getItem(`acadpulse:reminders:${currentUser.uid}`) !== 'enabled') return;
      checkingReminders = true;
      const now = Date.now();
      try {
        for (const task of tasks) {
          if (task.status === 'completed' || !isWithinReminderWindow(task.dueDate, now)) continue;
          const reminderKey = `acadpulse:reminded:${currentUser.uid}:${task.id}:${task.dueDate}`;
          const subject = subjects.find((item) => item.id === task.subjectId);

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && !localStorage.getItem(reminderKey)) {
            new Notification(`Upcoming: ${task.title}`, {
              body: `${subject?.code || 'Course'} · Due ${getCountdown(task.dueDate).label}`,
              tag: reminderKey,
            });
            localStorage.setItem(reminderKey, 'sent');
          }

          if (!accessToken || !currentUser.email) continue;
          const claimed = await claimDeadlineReminderEmail(currentUser.uid, task, now);
          if (!claimed) continue;
          try {
            await sendDeadlineReminderEmail(accessToken, currentUser.email, task.title, subject?.code || '', task.dueDate);
            await markDeadlineReminderEmailSent(currentUser.uid, task);
            setReminderError('');
          } catch (error) {
            await markDeadlineReminderEmailFailed(currentUser.uid, task, error);
            setReminderError(error instanceof Error ? error.message : 'Gmail could not send the reminder.');
            const eventKey = `acadpulse:last-reminder-error:${currentUser.uid}:${task.id}`;
            const lastRecordedAt = Number(localStorage.getItem(eventKey) || 0);
            if (now - lastRecordedAt >= 60 * 60 * 1000) {
              await recordSystemEvent(currentUser, 'reminder_delivery_failed', `${task.title}: ${error instanceof Error ? error.message : 'Gmail send failed.'}`).catch(() => {});
              localStorage.setItem(eventKey, String(now));
            }
          }
        }
      } finally {
        checkingReminders = false;
      }
    };

    void checkReminders();
    const timer = window.setInterval(() => void checkReminders(), 60_000);
    window.addEventListener('acadpulse:reminder-settings-changed', checkReminders);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('acadpulse:reminder-settings-changed', checkReminders);
    };
  }, [accessToken, currentUser, subjects, tasks]);

  useEffect(() => {
    if (!currentUser) return;
    void ensurePublicProfile(currentUser.uid, currentUser.displayName || 'Student').catch((error) => {
      console.warn('Could not initialize public user profile:', error);
    });
  }, [currentUser?.uid]);

  const recordWorkspaceSync = (userId = currentUser?.uid) => {
    if (!userId) return;
    const syncedAt = new Date().toISOString();
    setLastSyncedAt(syncedAt);
    try {
      window.localStorage.setItem(`acadpulse:last-sync:${userId}`, syncedAt);
    } catch {
      // Keep the current-session timestamp if browser storage is unavailable.
    }
  };

  const reconcileCompletedActivities = async (
    detected: Array<Pick<AcademicTask, 'title' | 'subjectId' | 'dueDate' | 'status' | 'notes'>>
  ) => {
    for (const activity of detected) {
      if (activity.status !== 'completed') continue;

      const activityLink = activity.notes?.match(/Link:\s*(https?:\/\/\S+)/)?.[1];
      const normalizedTitle = activity.title.trim().toLowerCase();
      const normalizedDueDate = activity.dueDate.substring(0, 10);
      const existingTask = tasksRef.current.find((task) => {
        if (
          task.title.trim().toLowerCase() !== normalizedTitle ||
          task.dueDate.substring(0, 10) !== normalizedDueDate
        ) {
          return false;
        }

        return task.subjectId === activity.subjectId || Boolean(activityLink && task.notes?.includes(activityLink));
      });

      if (existingTask && existingTask.status !== 'completed') {
        tasksRef.current = tasksRef.current.map((task) =>
          task.id === existingTask.id ? { ...task, status: 'completed' } : task
        );
        await updateTask(existingTask.id, { status: 'completed' });
      }
    }
  };

  const handleSyncActivities = async (
    newCourses: Subject[],
    newTasks: Omit<AcademicTask, 'id' | 'createdAt'>[]
  ) => {
    await reconcileCompletedActivities(newTasks);

    // Add any courses that don't already exist
    for (const course of newCourses) {
      const exists = subjects.some(
        (s) =>
          s.code.toLowerCase() === course.code.toLowerCase() ||
          s.name.toLowerCase() === course.name.toLowerCase()
      );
      if (!exists) {
        await addSubject(course);
      }
    }

    // Deduplicate incoming tasks against existing items
    const tasksToAdd = newTasks.filter(
      (nt) =>
        !tasks.some(
          (existing) =>
            existing.title.trim().toLowerCase() === nt.title.trim().toLowerCase() &&
            existing.dueDate.substring(0, 10) === nt.dueDate.substring(0, 10)
        )
    );

    if (tasksToAdd.length > 0) {
      await addTasksBatch(tasksToAdd);
    }
  };

  useEffect(() => {
    if (
      !currentUser?.uid ||
      !accessToken ||
      isAutoDetecting ||
      !getInstitutionInfo(currentUser.email).isInstitutional
    ) {
      return;
    }

    const syncIntervalMs = 60_000;
    let isSyncing = false;

    const syncClassroomSubmissions = async () => {
      if (isSyncing || document.visibilityState !== 'visible') return;
      isSyncing = true;

      try {
        const result = await fetchClassroomActivities(accessToken);
        const completedActivities = result.activities
          .filter((activity) => activity.source === 'classroom' && activity.status === 'completed')
          .map((activity) => {
            const detectedCourse = result.courses.find(
              (course) =>
                course.name.toLowerCase() === activity.courseName.toLowerCase() ||
                course.code === activity.courseCode
            );
            const localCourse = subjectsRef.current.find(
              (subject) =>
                subject.name.toLowerCase() === activity.courseName.toLowerCase() ||
                subject.code === activity.courseCode
            );

            return {
              title: activity.title,
              subjectId: localCourse?.id || detectedCourse?.id || '',
              dueDate: activity.dueDate || '',
              status: activity.status,
              notes: `${activity.notes || ''}${activity.link ? `\nLink: ${activity.link}` : ''}`,
            };
          });

        await reconcileCompletedActivities(completedActivities);
        recordWorkspaceSync(currentUser.uid);
      } catch (error) {
        console.warn('Automatic Google Classroom submission sync failed:', error);
      } finally {
        isSyncing = false;
      }
    };

    const syncKey = `acadpulse:last-sync:${currentUser.uid}`;
    let lastSyncTime = 0;
    try {
      lastSyncTime = Date.parse(window.localStorage.getItem(syncKey) || '') || 0;
    } catch {
      lastSyncTime = 0;
    }
    if (Date.now() - lastSyncTime >= syncIntervalMs) {
      void syncClassroomSubmissions();
    }

    const intervalId = window.setInterval(syncClassroomSubmissions, syncIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void syncClassroomSubmissions();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.uid, currentUser?.email, accessToken, isAutoDetecting, updateTask]);

  const handleLoginSuccess = async (user: User, token: string) => {
    setCurrentUser(user);
    setAccessToken(token);
    setIsAutoDetecting(true);

    const accountInfo = getInstitutionInfo(user.email);
    setDetectStatusMessage(
      accountInfo.isInstitutional
        ? `Connecting to ${accountInfo.institutionName}... Scanning Google Classroom, Tasks & Calendar...`
        : 'Connecting to Google Workspace... Scanning Google Tasks, connected apps & Calendar...'
    );

    try {
      await debugGoogleWorkspaceSync(token);
      const result = await detectAllPendingActivities(token);

      const visibleCourses = (result.courses || []).filter((course) => {
        const name = course.name.toLowerCase();
        return !['my tasks', 'tasks', 'google tasks', 'google tasks / connected apps'].includes(name.trim());
      });

      const visibleActivities = (result.activities || []).filter((act) => {
        const name = (act.courseName || '').toLowerCase();
        return !['my tasks', 'tasks', 'google tasks', 'google tasks / connected apps'].includes(name.trim());
      });

      if (visibleCourses.length > 0 || visibleActivities.length > 0) {
        setDetectStatusMessage(
          `Importing ${visibleCourses.length} courses/lists and ${visibleActivities.length} pending activities...`
        );

        const formattedTasks: Omit<AcademicTask, 'id' | 'createdAt'>[] = visibleActivities.map((act) => {
          const matchedCourse = visibleCourses.find(
            (c) => c.name.toLowerCase() === act.courseName.toLowerCase() || c.code === act.courseCode
          );
          const courseId = matchedCourse ? matchedCourse.id : (visibleCourses[0]?.id || subjects[0]?.id || 'sub-1');

          const dueDate = act.dueDate && !Number.isNaN(new Date(act.dueDate).getTime()) ? act.dueDate : '';

          return {
            title: act.title,
            subjectId: courseId,
            type: act.type,
            dueDate,
            estimatedHours: act.estimatedHours,
            priority: dueDate ? 'high' : 'medium',
            status: act.status,
            subtasks: [
              {
                id: 'st-' + Math.random().toString(36).substring(2, 6),
                title: `Review deliverable requirements: ${act.title}`,
                completed: false,
              },
              {
                id: 'st-' + Math.random().toString(36).substring(2, 6),
                title: 'Finalize submission',
                completed: false,
              },
            ],
            notes: `${act.notes || ''}${act.link ? `\nLink: ${act.link}` : ''}`,
          };
        });

        await handleSyncActivities(visibleCourses, formattedTasks);
      }
      recordWorkspaceSync(user.uid);
    } catch (err) {
      console.warn('Auto detection notice on login:', err);
      void recordSystemEvent(user, 'google_sync_failed', err instanceof Error ? err.message : 'Automatic Google sync failed.').catch(() => {});
    } finally {
      setTimeout(() => {
        setIsAutoDetecting(false);
        setDetectStatusMessage(null);
      }, 700);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setCurrentUser(null);
    setAccessToken(null);
  };

  const institutionDomain = getInstitutionInfo(currentUser?.email).domain;
  const adminAccess = isRootAdmin || userAccess?.role === 'admin';
  const visibleAnnouncements = announcements.filter((announcement) => (
    announcement.active
    && !dismissedAnnouncements.includes(announcement.id)
    && (announcement.audience === 'all' || announcement.institutionDomain === institutionDomain)
  ));
  const dismissAnnouncement = (announcementId: string) => {
    const next = [...dismissedAnnouncements, announcementId];
    setDismissedAnnouncements(next);
    if (currentUser) localStorage.setItem(`acadpulse:dismissed-announcements:${currentUser.uid}`, JSON.stringify(next));
  };

  // Handlers for Task Modal
  const handleOpenNewTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: AcademicTask) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  // Handlers for Subject Modal
  const handleOpenNewSubject = () => {
    setEditingSubject(null);
    setIsSubjectModalOpen(true);
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setIsSubjectModalOpen(true);
  };

  // Handlers for Resource Modal
  const handleOpenNewResource = () => {
    setEditingResource(null);
    setIsResourceModalOpen(true);
  };

  const handleEditResource = (resource: AcademicResource) => {
    setEditingResource(resource);
    setIsResourceModalOpen(true);
  };

  // Initial Auth Loading Screen
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#070b13] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-xs font-medium tracking-wide">Initializing AcadPulse-AI...</span>
      </div>
    );
  }

  // Auth Screen Gate: Only connection option is institutional Google/Gmail
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#020b16] text-slate-100 selection:bg-indigo-600 selection:text-white relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="motion-grid absolute inset-0" />
        <div className="motion-scan absolute left-0 top-[22%] h-px w-full" />
        <div className="motion-scan motion-scan-late absolute left-0 top-[74%] h-px w-full" />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_24%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_40%,rgba(255,255,255,0.02))] pointer-events-none" />

      <div className="motion-screen-enter relative z-10 flex min-h-screen flex-col">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenNewTask={handleOpenNewTask}
          onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
          connectionStatus={connectionStatus}
          user={currentUser}
          onLogout={handleLogout}
          adminAccess={adminAccess}
        />

        {isAutoDetecting && (
          <div className="border-b border-indigo-900/70 bg-indigo-950/60 px-4 py-2.5">
            <div className="mx-auto flex max-w-7xl items-center justify-center gap-2.5 text-xs text-indigo-100">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
              <span className="font-medium">{detectStatusMessage || 'Detecting pending school activities...'}</span>
            </div>
          </div>
        )}

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
          {visibleAnnouncements.map((announcement) => <div key={announcement.id} className="mb-4 flex items-start justify-between gap-4 border-l-2 border-cyan-400 bg-cyan-950/35 px-4 py-3"><div><h2 className="text-sm font-semibold text-cyan-100">{announcement.title}</h2><p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{announcement.message}</p></div><button onClick={() => dismissAnnouncement(announcement.id)} aria-label="Dismiss announcement" className="shrink-0 px-2 text-lg leading-none text-slate-400 hover:text-white">×</button></div>)}
          <div className="motion-stage-1 mb-6 rounded-3xl border border-slate-800/80 bg-slate-900/60 p-3 shadow-xl shadow-indigo-950/10 backdrop-blur-sm">
            <InstitutionalLoginBanner
              user={currentUser}
              token={accessToken}
              onSyncActivities={handleSyncActivities}
              onSynced={() => recordWorkspaceSync()}
              lastSyncedAt={lastSyncedAt}
              existingSubjects={subjects}
            />
          </div>

          <div className="motion-stage-2 mb-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 shadow-lg shadow-slate-950/40">
            <WorkloadMetricsBar
              metrics={workloadMetrics}
              tasks={tasks}
              onOpenAiAdvisor={() => setActiveTab('ai')}
            />
          </div>

          <div key={activeTab} className="motion-tab-enter flex-1 rounded-2xl border border-slate-800/80 bg-slate-900/45 p-3 shadow-lg shadow-slate-950/40">
            {activeTab === 'tasks' && (
              <TaskListView
                tasks={tasks}
                subjects={subjects}
                onToggleStatus={toggleTaskStatus}
                onToggleSubtask={toggleSubtask}
                onEditTask={handleEditTask}
                onDeleteTask={deleteTask}
                onOpenNewTask={handleOpenNewTask}
                onUpdateTask={updateTask}
              />
            )}

            {activeTab === 'schedule' && (
              <CalendarView
                tasks={tasks}
                subjects={subjects}
                onOpenNewTask={handleOpenNewTask}
                onEditTask={handleEditTask}
              />
            )}

            {activeTab === 'resources' && (
              <ResourceHubView
                resources={resources}
                subjects={subjects}
                onOpenNewResource={handleOpenNewResource}
                onEditResource={handleEditResource}
                onDeleteResource={deleteResource}
              />
            )}

            {activeTab === 'ai' && (
              <AiAdvisorView
                user={currentUser}
                tasks={tasks}
                subjects={subjects}
                metrics={workloadMetrics}
                onUpdateTask={updateTask}
              />
            )}

            {activeTab === 'courses' && (
              <SubjectDirectoryView
                subjects={subjects}
                tasks={tasks}
                resources={resources}
                onOpenNewSubject={handleOpenNewSubject}
                onEditSubject={handleEditSubject}
                onDeleteSubject={deleteSubject}
                onSelectSubjectFilter={() => {
                  setActiveTab('tasks');
                }}
              />
            )}

            {activeTab === 'tools' && (
              <ToolsView user={currentUser} tasks={tasks} subjects={subjects} reminderError={reminderError} />
            )}

            {activeTab === 'chat' && (
              <ChatView user={currentUser} />
            )}

            {activeTab === 'admin' && adminAccess && (
              <AdminPanel user={currentUser} isRootAdmin={isRootAdmin} />
            )}
          </div>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-[11px] text-slate-500">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4">
            <span>AcadPulse-AI</span>
            <span className="text-slate-700">•</span>
            <span>Built for students</span>
          </div>
        </footer>
      </div>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={addTask}
        onUpdate={updateTask}
        editingTask={editingTask}
        subjects={subjects}
      />

      {/* Subject Modal */}
      <SubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSave={addSubject}
        onUpdate={updateSubject}
        editingSubject={editingSubject}
      />

      {/* Resource Modal */}
      <ResourceModal
        isOpen={isResourceModalOpen}
        onClose={() => setIsResourceModalOpen(false)}
        onSave={addResource}
        onUpdate={updateResource}
        editingResource={editingResource}
        subjects={subjects}
      />

      {/* Firebase Real-Time Connection Modal */}
      <FirebaseModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        onConnect={async () => true}
        onDisconnect={() => {}}
        onResetDefault={() => {}}
        onClearAll={clearAll}
        connectionStatus={connectionStatus}
      />
    </div>
  );
}
