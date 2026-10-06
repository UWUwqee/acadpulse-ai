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

  (realtimeStore as any).tasks = originalTasks;
  (realtimeStore as any).subjects = originalSubjects;
});
