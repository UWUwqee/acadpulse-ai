import { useState, useEffect, useMemo, useCallback } from 'react';
import { Subject, AcademicTask, AcademicResource, FirebaseConnectionConfig } from '../types';
import { realtimeStore } from '../services/realtimeStore';

interface ConnectionState {
  isConnected: boolean;
  mode: string;
  error?: string;
  config?: FirebaseConnectionConfig | null;
}

export function useAcademicStore(userId?: string | null) {
  const [subjects, setSubjects] = useState<Subject[]>(() => realtimeStore.getSubjects());
  const [tasks, setTasks] = useState<AcademicTask[]>(() => realtimeStore.getTasks());
  const [resources, setResources] = useState<AcademicResource[]>(() => realtimeStore.getResources());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>(() => realtimeStore.getConnectionStatus());

  // Bind or unbind user in realtimeStore when userId changes
  useEffect(() => {
    if (userId) {
      realtimeStore.bindUser(userId);
    } else {
      realtimeStore.unbindUser();
    }
  }, [userId]);

  useEffect(() => {
    const unsubSubjects = realtimeStore.subscribeSubjects((updated) => {
      setSubjects(updated);
    });

    const unsubTasks = realtimeStore.subscribeTasks((updated) => {
      setTasks(updated);
    });

    const unsubResources = realtimeStore.subscribeResources((updated) => {
      setResources(updated);
    });

    const unsubConnection = realtimeStore.subscribeConnection((updated) => {
      setConnectionStatus({
        isConnected: updated.isConnected,
        mode: updated.mode,
        error: updated.error,
        config: realtimeStore.getConnectionStatus().config,
      });
    });

    return () => {
      unsubSubjects();
      unsubTasks();
      unsubResources();
      unsubConnection();
    };
  }, []);

  // Real-time workload calculation recomputed whenever tasks change
  const workloadMetrics = useMemo(() => {
    return realtimeStore.calculateWorkloadMetrics();
  }, [tasks, subjects]);

  // Subject dictionary for quick O(1) lookups
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  // Actions
  const addTask = useCallback((task: Omit<AcademicTask, 'id' | 'createdAt'>) => {
    return realtimeStore.addTask(task);
  }, []);

  const addTasksBatch = useCallback((taskList: Omit<AcademicTask, 'id' | 'createdAt'>[]) => {
    return realtimeStore.addTasksBatch(taskList);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<AcademicTask>) => {
    return realtimeStore.updateTask(id, updates);
  }, []);

  const deleteTask = useCallback((id: string) => {
    return realtimeStore.deleteTask(id);
  }, []);

  const toggleTaskStatus = useCallback((id: string) => {
    return realtimeStore.toggleTaskStatus(id);
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    return realtimeStore.toggleSubtask(taskId, subtaskId);
  }, []);

  const addSubject = useCallback((subject: Omit<Subject, 'id' | 'createdAt'> & { id?: string }) => {
    return realtimeStore.addSubject(subject);
  }, []);

  const updateSubject = useCallback((id: string, updates: Partial<Subject>) => {
    return realtimeStore.updateSubject(id, updates);
  }, []);

  const deleteSubject = useCallback((id: string) => {
    return realtimeStore.deleteSubject(id);
  }, []);

  const addResource = useCallback((resource: Omit<AcademicResource, 'id' | 'dateAdded'>) => {
    return realtimeStore.addResource(resource);
  }, []);

  const updateResource = useCallback((id: string, updates: Partial<AcademicResource>) => {
    return realtimeStore.updateResource(id, updates);
  }, []);

  const deleteResource = useCallback((id: string) => {
    return realtimeStore.deleteResource(id);
  }, []);

  const clearAll = useCallback(() => {
    realtimeStore.clearAll();
  }, []);

  return {
    subjects,
    tasks,
    resources,
    connectionStatus,
    workloadMetrics,
    subjectMap,
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
    clearAll
  };
}
