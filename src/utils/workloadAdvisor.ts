import { AcademicTask, Subject } from '../types';

export function createWorkloadFallback(tasks: AcademicTask[], subjects: Subject[]) {
  const activeTasks = tasks.filter((task) => task.status !== 'completed');
  const sortedTasks = [...activeTasks].sort((first, second) => {
    const firstParsedDue = first.dueDate ? new Date(first.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const secondParsedDue = second.dueDate ? new Date(second.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const firstDue = Number.isFinite(firstParsedDue) ? firstParsedDue : Number.POSITIVE_INFINITY;
    const secondDue = Number.isFinite(secondParsedDue) ? secondParsedDue : Number.POSITIVE_INFINITY;
    const firstPriority = first.priority === 'urgent' ? -86_400_000 : first.priority === 'high' ? -43_200_000 : 0;
    const secondPriority = second.priority === 'urgent' ? -86_400_000 : second.priority === 'high' ? -43_200_000 : 0;
    return firstDue + firstPriority - (secondDue + secondPriority);
  });

  if (sortedTasks.length === 0) {
    return {
      prioritizedTaskIds: [],
      burnoutRisk: 'Low',
      workloadFactor: 0,
      summary: 'No active academic tasks recorded.',
      actionableSteps: ['Add an activity with a due date to generate a study plan.'],
      studySchedule: [],
      fallback: true,
    };
  }

  const totalHours = sortedTasks.reduce((total, task) => {
    const estimate = Number(task.estimatedHours);
    return total + (Number.isFinite(estimate) && estimate > 0 ? estimate : 2);
  }, 0);
  const burnoutRisk = totalHours >= 20 || sortedTasks.length >= 10
    ? 'High'
    : totalHours >= 10 || sortedTasks.length >= 6
      ? 'Moderate'
      : 'Low';
  const firstTask = sortedTasks[0];
  const firstSubject = subjects.find((subject) => subject.id === firstTask.subjectId);

  return {
    prioritizedTaskIds: sortedTasks.map((task) => task.id),
    burnoutRisk,
    workloadFactor: Math.min(100, Math.round(totalHours * 5)),
    summary: `AI is temporarily unavailable. Start with "${firstTask.title}"${firstSubject ? ` for ${firstSubject.code}` : ''}, then work through the remaining activities in deadline order.`,
    actionableSteps: [
      `Start with ${firstTask.title}${firstTask.dueDate ? `, due ${new Date(firstTask.dueDate).toLocaleDateString()}` : ''}.`,
      'Work in focused blocks and take a short break between activities.',
      'Review your remaining deadlines after completing the first activity.',
    ],
    studySchedule: sortedTasks.slice(0, 5).map((task, index) => {
      const subject = subjects.find((item) => item.id === task.subjectId);
      const estimatedHours = Number(task.estimatedHours);
      return {
        timeSlot: `Block ${index + 1} · ${Number.isFinite(estimatedHours) && estimatedHours > 0 ? estimatedHours : 2}h`,
        subject: subject ? `${subject.code} · ${subject.name}` : 'Course work',
        task: task.title,
        focusStrategy: task.type === 'examination' || task.type === 'quiz'
          ? 'Active recall and spaced practice'
          : 'Focused work, then review',
      };
    }),
    fallback: true,
  };
}