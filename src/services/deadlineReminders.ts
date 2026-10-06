import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import { AcademicTask } from '../types';
import { db } from './firebase';

function reminderRef(userId: string, task: AcademicTask) {
  const dueTime = new Date(task.dueDate).getTime();
  const reminderId = `${encodeURIComponent(task.id)}_${dueTime}`;
  return doc(db, 'users', userId, 'deadline_reminders', reminderId);
}

export async function claimDeadlineReminderEmail(
  userId: string,
  task: AcademicTask,
  now = Date.now()
): Promise<boolean> {
  const reference = reminderRef(userId, task);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.data();
    if (current?.status === 'sent') return false;
    if (current?.status === 'sending' && Number(current.claimedAt) > now - 5 * 60 * 1000) return false;

    transaction.set(reference, {
      taskId: task.id,
      taskTitle: task.title,
      dueDate: task.dueDate,
      status: 'sending',
      claimedAt: now,
    }, { merge: true });
    return true;
  });
}

export async function markDeadlineReminderEmailSent(userId: string, task: AcademicTask): Promise<void> {
  await updateDoc(reminderRef(userId, task), { status: 'sent', sentAt: Date.now() });
}

export async function markDeadlineReminderEmailFailed(
  userId: string,
  task: AcademicTask,
  reason: unknown
): Promise<void> {
  const message = reason instanceof Error ? reason.message : 'Gmail could not send the reminder.';
  await updateDoc(reminderRef(userId, task), {
    status: 'failed',
    lastError: message.slice(0, 500),
    failedAt: Date.now(),
  });
}