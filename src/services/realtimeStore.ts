import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  Firestore,
  Unsubscribe
} from 'firebase/firestore';
import { Subject, AcademicTask, AcademicResource, FirebaseConnectionConfig, WorkloadAnalysis } from '../types';
import { normalizeDueDate } from '../utils/dateUtils';
import { db, firebaseConfig } from './firebase';

type Listener<T> = (data: T) => void;

class RealtimeStoreManager {
  private subjects: Subject[] = [];
  private tasks: AcademicTask[] = [];
  private resources: AcademicResource[] = [];

  private subjectsListeners: Set<Listener<Subject[]>> = new Set();
  private tasksListeners: Set<Listener<AcademicTask[]>> = new Set();
  private resourcesListeners: Set<Listener<AcademicResource[]>> = new Set();
  private connectionListeners: Set<Listener<{ isConnected: boolean; mode: string; error?: string }>> = new Set();

  private db: Firestore = db;
  private unsubscribes: Unsubscribe[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private currentUserId: string | null = null;
  private isFirebaseConnected = true;
  private connectionError: string | undefined = undefined;

  constructor() {
    this.cleanLegacyLocalStorage();
    this.initBroadcastChannel();
  }

  // Ensure no residual dummy/mock data persists
  private cleanLegacyLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('ptc_academic_tasks');
      localStorage.removeItem('ptc_academic_subjects');
      localStorage.removeItem('ptc_academic_resources');
    } catch {
      // ignore
    }
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('mentally_academic_realtime_sync');
        this.broadcastChannel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'SYNC_ALL') {
            if (payload.subjects) this.subjects = payload.subjects;
            if (payload.tasks) this.tasks = payload.tasks;
            if (payload.resources) this.resources = payload.resources;
            this.notifyAll();
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not initialized', err);
      }
    }
  }

  private broadcastChange() {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SYNC_ALL',
        payload: {
          subjects: this.subjects,
          tasks: this.tasks,
          resources: this.resources
        }
      });
    }
  }

  private notifySubjects() {
    const list = [...this.subjects];
    this.subjectsListeners.forEach((fn) => fn(list));
  }

  private notifyTasks() {
    const list = [...this.tasks];
    this.tasksListeners.forEach((fn) => fn(list));
  }

  private notifyResources() {
    const list = [...this.resources];
    this.resourcesListeners.forEach((fn) => fn(list));
  }

  private notifyConnection() {
    const status = {
      isConnected: this.isFirebaseConnected,
      mode: 'firestore-live',
      error: this.connectionError
    };
    this.connectionListeners.forEach((fn) => fn(status));
  }

  private notifyAll() {
    this.notifySubjects();
    this.notifyTasks();
    this.notifyResources();
    this.notifyConnection();
  }

  // Bind real-time Firestore listeners to the logged-in student's user account
  bindUser(userId: string) {
    if (this.currentUserId === userId && this.unsubscribes.length > 0) {
      return;
    }

    this.unbindUser();
    this.currentUserId = userId;
    this.attachFirestoreListeners(userId);
  }

  unbindUser() {
    this.unsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore
      }
    });
    this.unsubscribes = [];
    this.currentUserId = null;
    this.subjects = [];
    this.tasks = [];
    this.resources = [];
    this.notifyAll();
  }

  private attachFirestoreListeners(userId: string) {
    try {
      this.connectionError = undefined;

      // 1. Real-time Subject Listener
      const unsubSubjects = onSnapshot(
        collection(this.db, 'users', userId, 'academic_subjects'),
        (snapshot) => {
          this.subjects = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Subject, 'id'>)
          }));
          this.notifySubjects();
        },
        (err) => {
          console.warn('Firestore subjects subscription warning:', err);
          this.connectionError = err.message;
          this.notifyConnection();
        }
      );

      // 2. Real-time Task Listener
      const unsubTasks = onSnapshot(
        collection(this.db, 'users', userId, 'academic_tasks'),
        (snapshot) => {
          this.tasks = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<AcademicTask, 'id'>)
          }));
          this.notifyTasks();
        },
        (err) => {
          console.warn('Firestore tasks subscription warning:', err);
          this.connectionError = err.message;
          this.notifyConnection();
        }
      );

      // 3. Real-time Resource Listener
      const unsubResources = onSnapshot(
        collection(this.db, 'users', userId, 'academic_resources'),
        (snapshot) => {
          this.resources = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<AcademicResource, 'id'>)
          }));
          this.notifyResources();
        },
        (err) => {
          console.warn('Firestore resources subscription warning:', err);
          this.connectionError = err.message;
          this.notifyConnection();
        }
      );

      this.unsubscribes = [unsubSubjects, unsubTasks, unsubResources];
      this.isFirebaseConnected = true;
      this.notifyConnection();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to attach Firestore listeners';
      this.connectionError = errorMsg;
      this.notifyConnection();
    }
  }

  // Subscriptions for React components
  subscribeSubjects(listener: Listener<Subject[]>): () => void {
    this.subjectsListeners.add(listener);
    listener([...this.subjects]);
    return () => this.subjectsListeners.delete(listener);
  }

  subscribeTasks(listener: Listener<AcademicTask[]>): () => void {
    this.tasksListeners.add(listener);
    listener([...this.tasks]);
    return () => this.tasksListeners.delete(listener);
  }

  subscribeResources(listener: Listener<AcademicResource[]>): () => void {
    this.resourcesListeners.add(listener);
    listener([...this.resources]);
    return () => this.resourcesListeners.delete(listener);
  }

  subscribeConnection(listener: Listener<{ isConnected: boolean; mode: string; error?: string }>): () => void {
    this.connectionListeners.add(listener);
    listener({
      isConnected: this.isFirebaseConnected,
      mode: 'firestore-live',
      error: this.connectionError
    });
    return () => this.connectionListeners.delete(listener);
  }

  getSubjects(): Subject[] {
    return [...this.subjects];
  }

  getTasks(): AcademicTask[] {
    return [...this.tasks];
  }

  getResources(): AcademicResource[] {
    return [...this.resources];
  }

  getConnectionStatus() {
    return {
      isConnected: this.isFirebaseConnected,
      mode: 'firestore-live',
      error: this.connectionError,
      config: firebaseConfig
    };
  }

  // --- Real-time Task Operations ---
  async addTask(task: Omit<AcademicTask, 'id' | 'createdAt'>): Promise<AcademicTask> {
    const id = 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const newTask: AcademicTask = {
      ...task,
      id,
      createdAt: new Date().toISOString()
    };

    // Optimistic instant state update
    this.tasks = [newTask, ...this.tasks];
    this.broadcastChange();
    this.notifyTasks();

    if (this.currentUserId) {
      try {
        await setDoc(doc(this.db, 'users', this.currentUserId, 'academic_tasks', id), newTask);
      } catch (e) {
        console.warn('Firestore addTask sync error:', e);
      }
    }

    return newTask;
  }

  async addTasksBatch(tasksList: Omit<AcademicTask, 'id' | 'createdAt'>[]): Promise<void> {
    const nowIso = new Date().toISOString();
    const createdTasks: AcademicTask[] = tasksList.map((t, idx) => ({
      ...t,
      id: 'task-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: nowIso
    }));

    // Deduplicate against existing tasks
    const existingTitles = new Set(this.tasks.map((t) => t.title.trim().toLowerCase()));
    const filteredToInsert = createdTasks.filter((t) => !existingTitles.has(t.title.trim().toLowerCase()));

    if (filteredToInsert.length === 0) return;

    this.tasks = [...filteredToInsert, ...this.tasks];
    this.broadcastChange();
    this.notifyTasks();

    if (this.currentUserId) {
      for (const t of filteredToInsert) {
        try {
          await setDoc(doc(this.db, 'users', this.currentUserId, 'academic_tasks', t.id), t);
        } catch (e) {
          console.warn('Firestore batch task item error:', e);
        }
      }
    }
  }

  async updateTask(id: string, updates: Partial<AcademicTask>): Promise<void> {
    this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
    this.broadcastChange();
    this.notifyTasks();

    if (this.currentUserId) {
      try {
        await updateDoc(doc(this.db, 'users', this.currentUserId, 'academic_tasks', id), updates);
      } catch (e) {
        console.warn('Firestore updateTask sync error:', e);
      }
    }
  }

  async deleteTask(id: string): Promise<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.broadcastChange();
    this.notifyTasks();

    if (this.currentUserId) {
      try {
        await deleteDoc(doc(this.db, 'users', this.currentUserId, 'academic_tasks', id));
      } catch (e) {
        console.warn('Firestore deleteTask sync error:', e);
      }
    }
  }

  async toggleTaskStatus(id: string): Promise<void> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;

    let nextStatus: AcademicTask['status'] = 'in_progress';
    if (task.status === 'pending') nextStatus = 'in_progress';
    else if (task.status === 'in_progress') nextStatus = 'completed';
    else nextStatus = 'pending';

    await this.updateTask(id, { status: nextStatus });
  }

  async toggleSubtask(taskId: string, subtaskId: string): Promise<void> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every((st) => st.completed);
    const updates: Partial<AcademicTask> = {
      subtasks: updatedSubtasks,
      ...(allCompleted && task.status !== 'completed' ? { status: 'completed' } : {})
    };

    await this.updateTask(taskId, updates);
  }

  // --- Real-time Subject Operations ---
  async addSubject(subject: Omit<Subject, 'id' | 'createdAt'> & { id?: string }): Promise<Subject> {
    const id = subject.id || 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newSub: Subject = {
      ...subject,
      id,
      createdAt: new Date().toISOString()
    };

    this.subjects = [...this.subjects, newSub];
    this.broadcastChange();
    this.notifySubjects();

    if (this.currentUserId) {
      try {
        await setDoc(doc(this.db, 'users', this.currentUserId, 'academic_subjects', id), newSub);
      } catch (e) {
        console.warn('Firestore addSubject sync error:', e);
      }
    }

    return newSub;
  }

  async updateSubject(id: string, updates: Partial<Subject>): Promise<void> {
    this.subjects = this.subjects.map((s) => (s.id === id ? { ...s, ...updates } : s));
    this.broadcastChange();
    this.notifySubjects();

    if (this.currentUserId) {
      try {
        await updateDoc(doc(this.db, 'users', this.currentUserId, 'academic_subjects', id), updates);
      } catch (e) {
        console.warn('Firestore updateSubject sync error:', e);
      }
    }
  }

  async deleteSubject(id: string): Promise<void> {
    this.subjects = this.subjects.filter((s) => s.id !== id);
    this.tasks = this.tasks.filter((t) => t.subjectId !== id);
    this.resources = this.resources.filter((r) => r.subjectId !== id);

    this.broadcastChange();
    this.notifyAll();

    if (this.currentUserId) {
      try {
        await deleteDoc(doc(this.db, 'users', this.currentUserId, 'academic_subjects', id));
      } catch (e) {
        console.warn('Firestore deleteSubject sync error:', e);
      }
    }
  }

  // --- Real-time Resource Operations ---
  async addResource(resource: Omit<AcademicResource, 'id' | 'dateAdded'>): Promise<AcademicResource> {
    const id = 'res-' + Date.now();
    const newRes: AcademicResource = {
      ...resource,
      id,
      dateAdded: new Date().toISOString()
    };

    this.resources = [newRes, ...this.resources];
    this.broadcastChange();
    this.notifyResources();

    if (this.currentUserId) {
      try {
        await setDoc(doc(this.db, 'users', this.currentUserId, 'academic_resources', id), newRes);
      } catch (e) {
        console.warn('Firestore addResource sync error:', e);
      }
    }

    return newRes;
  }

  async updateResource(id: string, updates: Partial<AcademicResource>): Promise<void> {
    this.resources = this.resources.map((r) => (r.id === id ? { ...r, ...updates } : r));
    this.broadcastChange();
    this.notifyResources();

    if (this.currentUserId) {
      try {
        await updateDoc(doc(this.db, 'users', this.currentUserId, 'academic_resources', id), updates);
      } catch (e) {
        console.warn('Firestore updateResource sync error:', e);
      }
    }
  }

  async deleteResource(id: string): Promise<void> {
    this.resources = this.resources.filter((r) => r.id !== id);
    this.broadcastChange();
    this.notifyResources();

    if (this.currentUserId) {
      try {
        await deleteDoc(doc(this.db, 'users', this.currentUserId, 'academic_resources', id));
      } catch (e) {
        console.warn('Firestore deleteResource sync error:', e);
      }
    }
  }

  // Clear all data
  clearAll() {
    this.subjects = [];
    this.tasks = [];
    this.resources = [];
    this.broadcastChange();
    this.notifyAll();
  }

  // Real-time Workload Metrics Calculation Engine
  calculateWorkloadMetrics(): WorkloadAnalysis {
    const pendingTasks = this.tasks.filter((t) => t.status !== 'completed');
    const nowTime = new Date().getTime();

    let urgentCount = 0;
    let missingCount = 0;
    let totalPendingHours = 0;
    let examWeightScore = 0;

    const subjectHoursMap: Record<string, number> = {};

    pendingTasks.forEach((task) => {
      totalPendingHours += task.estimatedHours || 2;
      const normalizedDueDate = normalizeDueDate(task.dueDate);
      const dueDate = normalizedDueDate ? new Date(normalizedDueDate) : null;
      const dueTime = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.getTime() : null;

      if (!dueTime) {
        missingCount++;
        return;
      }

      if (dueTime < nowTime) {
        missingCount++;
        return;
      }

      const diffHours = (dueTime - nowTime) / (1000 * 60 * 60);
      const isFutureDeadline = diffHours > 0;
      const isUrgentByDeadline = isFutureDeadline && diffHours <= 48;
      const isUrgentByPriority = task.priority === 'urgent' && isFutureDeadline && diffHours <= 72;

      if (isUrgentByDeadline || isUrgentByPriority) {
        urgentCount++;
      }

      if (task.type === 'examination' || task.type === 'quiz') {
        examWeightScore += (task.weightPercentage || 20) * (diffHours < 72 ? 1.5 : 1);
      }

      subjectHoursMap[task.subjectId] = (subjectHoursMap[task.subjectId] || 0) + (task.estimatedHours || 2);
    });

    const baseHourFactor = Math.min(50, (totalPendingHours / 30) * 50);
    const urgentFactor = Math.min(30, urgentCount * 10);
    const examFactor = Math.min(20, (examWeightScore / 60) * 20);
    const calculatedScore = Math.min(100, Math.round(baseHourFactor + urgentFactor + examFactor));

    let statusLabel: WorkloadAnalysis['statusLabel'] = 'Optimal';
    let burnoutRisk: WorkloadAnalysis['burnoutRisk'] = 'Low';

    if (calculatedScore >= 75) {
      statusLabel = 'Overloaded';
      burnoutRisk = 'High';
    } else if (calculatedScore >= 50) {
      statusLabel = 'Heavy';
      burnoutRisk = 'Moderate';
    } else if (calculatedScore >= 25) {
      statusLabel = 'Manageable';
      burnoutRisk = 'Low';
    }

    const suggestions: WorkloadAnalysis['timeAllocationSuggestions'] = [];
    Object.entries(subjectHoursMap).forEach(([subId, hrs]) => {
      const subject = this.subjects.find((s) => s.id === subId);
      if (subject) {
        suggestions.push({
          subjectName: subject.name,
          recommendedHours: Math.round(hrs * 10) / 10,
          reason: `${subject.code} has pending deliverables with active milestones.`
        });
      }
    });

    const recommendations: string[] = [];
    if (urgentCount > 0) {
      recommendations.push(`Prioritize ${urgentCount} urgent deliverable${urgentCount > 1 ? 's' : ''} due in under 48 hours.`);
    }
    if (totalPendingHours > 15) {
      recommendations.push('Schedule 90-minute Pomodoro study blocks across consecutive mornings to alleviate high workload density.');
    }
    if (pendingTasks.some((t) => t.type === 'examination')) {
      recommendations.push('Conduct spaced repetition review for impending examinations to avoid last-minute cramming.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Workload is balanced. Maintain steady progress on semester requirements.');
    }

    return {
      workloadScore: calculatedScore,
      statusLabel,
      urgentCount,
      missingCount,
      totalPendingHours: Math.round(totalPendingHours * 10) / 10,
      burnoutRisk,
      studyRecommendations: recommendations,
      timeAllocationSuggestions: suggestions,
      aiInsights: `Live workload analysis indicates ${statusLabel.toLowerCase()} academic load across ${this.subjects.length} registered subjects with ${pendingTasks.length} active assignments and exams.`,
      generatedAt: new Date().toISOString()
    };
  }
}

export const realtimeStore = new RealtimeStoreManager();
