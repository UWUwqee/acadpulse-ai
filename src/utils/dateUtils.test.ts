import assert from 'node:assert/strict';
import test from 'node:test';
import { isWithinReminderWindow } from './dateUtils';

test('isWithinReminderWindow accepts only future due dates within 24 hours', () => {
  const now = Date.parse('2026-10-06T12:00:00.000Z');

  assert.equal(isWithinReminderWindow('', now), false);
  assert.equal(isWithinReminderWindow('invalid-date', now), false);
  assert.equal(isWithinReminderWindow('2026-10-06T11:59:59.999Z', now), false);
  assert.equal(isWithinReminderWindow('2026-10-06T12:00:00.000Z', now), false);
  assert.equal(isWithinReminderWindow('2026-10-07T12:00:00.000Z', now), true);
  assert.equal(isWithinReminderWindow('2026-10-07T12:00:00.001Z', now), false);
});