import assert from 'node:assert/strict';
import test from 'node:test';
import { AcademicTask, Subject } from '../types';
import { createWorkloadFallback } from './workloadAdvisor';

const subjects: Subject[] = [{
  id: 'subject-1',
  code: 'BIO 101',
  name: 'Biology',
  instructor: 'Instructor',
  units: 3,
  color: '#008000',
  semester: 'Fall',
  createdAt: '2026-01-01T00:00:00.000Z',
}];

const task = (id: string, dueDate: string, status: AcademicTask['status'] = 'pending'): AcademicTask => ({
  id,
  title: id,
  subjectId: 'subject-1',
  type: 'assignment',
  dueDate,
  estimatedHours: 2,
  priority: 'medium',
  status,
  subtasks: [],
  createdAt: '2026-01-01T00:00:00.000Z',
});

test('workload fallback prioritizes dated active tasks and returns a usable schedule', () => {
  const result = createWorkloadFallback([
    task('later', '2026-10-10T12:00:00.000Z'),
    task('completed', '2026-10-07T12:00:00.000Z', 'completed'),
    task('sooner', '2026-10-07T12:00:00.000Z'),
    task('unscheduled', ''),
  ], subjects);

  assert.deepEqual(result.prioritizedTaskIds, ['sooner', 'later', 'unscheduled']);
  assert.equal(result.studySchedule.length, 3);
  assert.equal(result.studySchedule[0].task, 'sooner');
  assert.equal(result.fallback, true);
});