import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useAcademicStore } from './hooks/useAcademicStore';
import { initAuth, logoutGoogle, detectAllPendingActivities, debugGoogleWorkspaceSync } from './services/googleWorkspace';
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
import { getInstitutionInfo } from './utils/institutionHelper';
import { AcademicTask, Subject, AcademicResource } from './types';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [detectStatusMessage, setDetectStatusMessage] = useState<string | null>(null);

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

  const [activeTab, setActiveTab] = useState<'tasks' | 'schedule' | 'resources' | 'ai' | 'courses'>('tasks');

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

  const handleSyncActivities = async (
    newCourses: Subject[],
    newTasks: Omit<AcademicTask, 'id' | 'createdAt'>[]
  ) => {
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
    <div className="min-h-screen bg-[#020b16] text-slate-100 selection:bg-indigo-600 selection:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_24%)] pointer-events-none" />

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
