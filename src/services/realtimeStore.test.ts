import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDueDate } from '../utils/dateUtils';
import { realtimeStore } from './realtimeStore';

const originalTasks = (realtimeStore as any).tasks;
const originalSubjects = (realtimeStore as any).subjects;

test('normalizeDueDate strips missing or invalid deadlines', () => {
  assert.equal(normalizeDueDate(''), '');
  assert.equal(normalizeDueDate('missing-date'), '');
  assert.ok(normalizeDueDate('2026-10-10T10:00:00.000Z'));
});

test('missing activities are counted as missing and not urgent', () => {
  (realtimeStore as any).subjects = [{
    id: 'sub-1',
    code: 'CS101',
    name: 'Intro to CS',
    instructor: 'Dr. Smith',
    units: 3,
    color: '#6d5efc',
    semester: 'Fall',
    createdAt: new Date().toISOString(),
  }];

  (realtimeStore as any).tasks = [{
    id: 'task-missing',
    title: 'Unscheduled assignment',
    subjectId: 'sub-1',
    type: 'assignment',
    dueDate: '',
    estimatedHours: 2,
    priority: 'urgent',
    status: 'pending',
    subtasks: [],
    createdAt: new Date().toISOString(),
  }];

  const metrics = realtimeStore.calculateWorkloadMetrics();

  assert.equal(metrics.missingCount, 1);
  assert.equal(metrics.urgentCount, 0);

  (realtimeStore as any).tasks = [{
    ...originalTasks[0],
    id: 'task-overdue',
    title: 'Overdue assignment',
    dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    priority: 'high',
    status: 'pending',
  }];

  const overdueMetrics = realtimeStore.calculateWorkloadMetrics();
  assert.equal(overdueMetrics.missingCount, 1);
  assert.equal(overdueMetrics.urgentCount, 0);

  const now = Date.now();
  (realtimeStore as any).tasks = [
    ...Array.from({ length: 5 }, (_, index) => ({
      ...originalTasks[0],
      id: `task-future-${index}`,
      title: `Future assignment ${index}`,
      dueDate: new Date(now + (index === 4 ? 5 : index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      ...originalTasks[0],
      id: `task-overdue-${index}`,
      title: `Overdue assignment ${index}`,
      dueDate: new Date(now - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    })),
  ];

  const pendingMetrics = realtimeStore.calculateWorkloadMetrics();
  assert.equal(pendingMetrics.urgentCount, 5);
  assert.equal(pendingMetrics.missingCount, 3);

  (realtimeStore as any).tasks = originalTasks;
  (realtimeStore as any).subjects = originalSubjects;
});
