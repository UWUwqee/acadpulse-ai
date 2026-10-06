import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
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
import { ensurePublicProfile } from './services/socialService';
import { getInstitutionInfo } from './utils/institutionHelper';
import { AcademicTask, Subject, AcademicResource } from './types';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [detectStatusMessage, setDetectStatusMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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

  const [activeTab, setActiveTab] = useState<'tasks' | 'schedule' | 'resources' | 'ai' | 'courses' | 'tools' | 'chat'>('tasks');

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
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -18px, 0) scale(1.08); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(18px, -22px, 0) scale(1.12); }
        }
        @keyframes grid-shift {
          0% { transform: perspective(1200px) rotateX(68deg) translateY(0); }
          50% { transform: perspective(1200px) rotateX(68deg) translateY(18px); }
          100% { transform: perspective(1200px) rotateX(68deg) translateY(0); }
        }
      `}</style>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 left-[-8%] h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl animate-[float-slow_18s_ease-in-out_infinite]" />
        <div className="absolute top-[18%] right-[-6%] h-96 w-96 rounded-full bg-violet-500/18 blur-3xl animate-[float-delayed_26s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-12%] left-[20%] h-80 w-80 rounded-full bg-amber-400/12 blur-3xl animate-[float-slow_22s_ease-in-out_infinite]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:130px_130px] [transform:perspective(1500px)_rotateX(68deg)] animate-[grid-shift_24s_ease-in-out_infinite]" />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_24%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_40%,rgba(255,255,255,0.02))] pointer-events-none" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenNewTask={handleOpenNewTask}
          onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
          connectionStatus={connectionStatus}
          user={currentUser}
          onLogout={handleLogout}
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
          <div className="mb-6 rounded-3xl border border-slate-800/80 bg-slate-900/60 p-3 shadow-xl shadow-indigo-950/10 backdrop-blur-sm">
            <InstitutionalLoginBanner
              user={currentUser}
              token={accessToken}
              onLogout={handleLogout}
              onSyncActivities={handleSyncActivities}
              onSynced={() => recordWorkspaceSync()}
              lastSyncedAt={lastSyncedAt}
              existingSubjects={subjects}
            />
          </div>

          <div className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 shadow-lg shadow-slate-950/40">
            <WorkloadMetricsBar
              metrics={workloadMetrics}
              tasks={tasks}
              onOpenAiAdvisor={() => setActiveTab('ai')}
            />
          </div>

          <div className="flex-1 rounded-2xl border border-slate-800/80 bg-slate-900/45 p-3 shadow-lg shadow-slate-950/40">
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
              <ToolsView user={currentUser} tasks={tasks} subjects={subjects} />
            )}

            {activeTab === 'chat' && (
              <ChatView user={currentUser} />
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
