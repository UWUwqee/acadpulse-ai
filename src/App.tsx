import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useAcademicStore } from './hooks/useAcademicStore';
import { initAuth, logoutGoogle, detectAllPendingActivities } from './services/googleWorkspace';
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
      const result = await detectAllPendingActivities(token);

      if (result.courses.length > 0 || result.activities.length > 0) {
        setDetectStatusMessage(
          `Importing ${result.courses.length} courses/lists and ${result.activities.length} pending activities...`
        );
        
        const formattedTasks: Omit<AcademicTask, 'id' | 'createdAt'>[] = result.activities.map((act) => {
          const matchedCourse = result.courses.find(
            (c) => c.name.toLowerCase() === act.courseName.toLowerCase() || c.code === act.courseCode
          );
          const courseId = matchedCourse ? matchedCourse.id : (result.courses[0]?.id || subjects[0]?.id || 'sub-1');

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
                title: 'Finalize submission',
                completed: false,
              },
            ],
            notes: `${act.notes || ''}${act.link ? `\nLink: ${act.link}` : ''}`,
          };
        });

        await handleSyncActivities(result.courses, formattedTasks);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Universal Top Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewTask={handleOpenNewTask}
        onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
        connectionStatus={connectionStatus}
        user={currentUser}
        onLogout={handleLogout}
      />

      {/* Auto-detection Progress Banner */}
      {isAutoDetecting && (
        <div className="bg-indigo-950/80 border-b border-indigo-800/80 px-4 py-2.5 flex items-center justify-center gap-2.5 text-xs text-indigo-200">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
          <span className="font-medium">{detectStatusMessage || 'Detecting pending school activities...'}</span>
        </div>
      )}

      {/* Main Content Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Institutional School Gmail Pending Activity Detection Banner */}
        <InstitutionalLoginBanner
          user={currentUser}
          token={accessToken}
          onLogout={handleLogout}
          onSyncActivities={handleSyncActivities}
          existingSubjects={subjects}
        />

        {/* Real-time Workload Metrics Status Strip */}
        <WorkloadMetricsBar
          metrics={workloadMetrics}
          tasks={tasks}
          onOpenAiAdvisor={() => setActiveTab('ai')}
        />

        {/* Tabbed Views */}
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
      </main>

      {/* Quiet Academic Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            AcadPulse-AI · Real-time Academic Resource & Workload Management System
          </div>
          <div>
            Built for college & university students across all institutional domains
          </div>
        </div>
      </footer>

      {/* Task Modal */}
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
