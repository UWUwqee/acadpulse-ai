import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from './firebase';
import { AcademicTask, Subject } from '../types';

const TOKEN_STORAGE_KEY = 'mentally_academic_access_token';

// In-memory access token caching with sessionStorage fallback
let cachedAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken && typeof window !== 'undefined') {
        cachedAccessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      }

      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get Google OAuth access token');
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google institutional sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export interface DetectedSchoolActivity {
  id: string;
  source: 'classroom' | 'calendar' | 'tasks';
  courseName: string;
  courseCode: string;
  title: string;
  type: 'assignment' | 'project' | 'quiz' | 'examination' | 'deadline';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  link?: string;
  estimatedHours: number;
}

export async function debugGoogleWorkspaceSync(token: string) {
  const debugInfo: Record<string, any> = {};

  for (const url of [
    'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE',
    'https://classroom.googleapis.com/v1/userCourses?userId=me&courseStates=ACTIVE',
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
  ]) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      debugInfo[url] = {
        status: res.status,
        ok: res.ok,
        payload: json,
      };
    } catch (err) {
      debugInfo[url] = { status: 'error', error: err };
    }
  }

  if (typeof window !== 'undefined') {
    console.group('[AcadPulse] Google Workspace debug');
    console.log(JSON.stringify(debugInfo, null, 2));
    console.groupEnd();
  }

  return debugInfo;
}

// 1. Google Classroom: Fetch active courses and pending coursework
export async function fetchClassroomActivities(
  token: string
): Promise<{ courses: Subject[]; activities: DetectedSchoolActivity[] }> {
  const detectedCourses: Subject[] = [];
  const activities: DetectedSchoolActivity[] = [];

  try {
    const courseFetchCandidates = [
      'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE',
      'https://classroom.googleapis.com/v1/userCourses?userId=me&courseStates=ACTIVE',
      'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
    ];

    let coursesList: any[] = [];

    for (const url of courseFetchCandidates) {
      const coursesRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!coursesRes.ok) {
        continue;
      }

      const coursesData = await coursesRes.json();
      const nextCourses = coursesData.courses || coursesData.userCourses || [];
      if (Array.isArray(nextCourses) && nextCourses.length > 0) {
        coursesList = nextCourses.map((course) => ({
          ...course,
          id: course.id,
          name: course.name || course.course?.name || 'Classroom Course',
          section: course.section || course.course?.section,
          room: course.room || course.course?.room,
          creatorUserId: course.creatorUserId || course.course?.creatorUserId,
        }));
        break;
      }
    }

    if (coursesList.length === 0) {
      console.warn('Classroom courses fetch returned no active courses for this account.');
      return { courses: [], activities: [] };
    }

    const colorPalette = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];

    for (let i = 0; i < coursesList.length; i++) {
      const c = coursesList[i];
      const courseSubject: Subject = {
        id: `classroom-course-${c.id}`,
        code: c.section
          ? `${c.name.substring(0, 6).toUpperCase()}-${c.section}`
          : c.name.substring(0, 8).toUpperCase(),
        name: c.name,
        instructor: c.creatorUserId ? `Instructor (${c.creatorUserId.substring(0, 6)})` : 'Faculty Instructor',
        units: 3,
        color: colorPalette[i % colorPalette.length],
        semester: 'Active Term',
        meetingSchedule: c.room ? `Room: ${c.room}` : undefined,
        createdAt: new Date().toISOString(),
      };
      detectedCourses.push(courseSubject);

      // Fetch coursework for each course
      try {
        const courseWorkStates = ['PUBLISHED', 'ASSIGNED', 'DRAFT'];
        let courseWorks: any[] = [];

        for (const state of courseWorkStates) {
          const cwRes = await fetch(
            `https://classroom.googleapis.com/v1/courses/${c.id}/courseWork?courseWorkStates=${state}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (!cwRes.ok) {
            continue;
          }

          const cwData = await cwRes.json();
          const stateCourseWorks = cwData.courseWork || [];
          courseWorks = [...courseWorks, ...stateCourseWorks];
        }

        if (courseWorks.length > 0) {
          for (const cw of courseWorks) {
            // Check student submission status using userId=me
            let isSubmitted = false;
            try {
              const subRes = await fetch(
                `https://classroom.googleapis.com/v1/courses/${c.id}/courseWork/${cw.id}/studentSubmissions?userId=me`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              if (subRes.ok) {
                const subData = await subRes.json();
                const userSubmission = (subData.studentSubmissions || [])[0];
                if (
                  userSubmission &&
                  [
                    'TURNED_IN',
                    'RETURNED',
                    'LATE_TURNED_IN',
                    'RECLAIMED_BY_STUDENT',
                  ].includes(userSubmission.state)
                ) {
                  isSubmitted = true;
                }
              }
            } catch {
              // ignore submission check failure
            }

            // Calculate due date
            let dueDateIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
            if (cw.dueDate) {
              const d = new Date();
              d.setFullYear(cw.dueDate.year || d.getFullYear());
              d.setMonth((cw.dueDate.month || 1) - 1);
              d.setDate(cw.dueDate.day || d.getDate());
              if (cw.dueTime) {
                d.setHours(cw.dueTime.hours || 23);
                d.setMinutes(cw.dueTime.minutes || 59);
              } else {
                d.setHours(23, 59, 0, 0);
              }
              dueDateIso = d.toISOString();
            }

            let actType: DetectedSchoolActivity['type'] = 'assignment';
            if (cw.workType === 'MULTIPLE_CHOICE_QUESTION') actType = 'quiz';
            else if (
              cw.title.toLowerCase().includes('project') ||
              cw.title.toLowerCase().includes('capstone')
            )
              actType = 'project';
            else if (
              cw.title.toLowerCase().includes('exam') ||
              cw.title.toLowerCase().includes('midterm')
            )
              actType = 'examination';

            activities.push({
              id: `classroom-work-${cw.id}`,
              source: 'classroom',
              courseName: c.name,
              courseCode: courseSubject.code,
              title: cw.title,
              type: actType,
              dueDate: dueDateIso,
              status: isSubmitted ? 'completed' : 'pending',
              notes: cw.description || 'Google Classroom Coursework Assignment',
              link: cw.alternateLink,
              estimatedHours: actType === 'project' ? 6 : actType === 'examination' ? 5 : 2.5,
            });
          }
        }
      } catch (err) {
        console.warn(`Error fetching coursework for course ${c.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Classroom API fetch error:', err);
  }

  return { courses: detectedCourses, activities };
}

// 2. Google Calendar: Fetch upcoming deadlines, exam schedules, and work events
export async function fetchCalendarActivities(
  token: string
): Promise<{ calendarCourse?: Subject; activities: DetectedSchoolActivity[] }> {
  const activities: DetectedSchoolActivity[] = [];
  let calendarCourse: Subject | undefined = undefined;

  try {
    const timeMin = new Date().toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&singleEvents=true&orderBy=startTime&maxResults=25`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];

      if (items.length > 0) {
        calendarCourse = {
          id: 'course-google-calendar',
          code: 'CALENDAR',
          name: 'Schedule & Deadlines',
          instructor: 'Google Calendar Sync',
          units: 3,
          color: '#f59e0b',
          semester: 'Active Workspace',
          createdAt: new Date().toISOString(),
        };
      }

      for (const ev of items) {
        const title = ev.summary || 'Scheduled Deliverable';
        const startStr = ev.start?.dateTime || ev.start?.date;
        if (!startStr) continue;

        let actType: DetectedSchoolActivity['type'] = 'deadline';
        const lower = title.toLowerCase();
        if (lower.includes('exam') || lower.includes('midterm') || lower.includes('finals')) {
          actType = 'examination';
        } else if (lower.includes('quiz') || lower.includes('test')) {
          actType = 'quiz';
        } else if (lower.includes('project') || lower.includes('sprint') || lower.includes('milestone')) {
          actType = 'project';
        } else if (lower.includes('submission') || lower.includes('due') || lower.includes('deliverable') || lower.includes('task')) {
          actType = 'assignment';
        }

        activities.push({
          id: `calendar-${ev.id}`,
          source: 'calendar',
          courseName: 'Schedule & Deadlines',
          courseCode: 'CALENDAR',
          title,
          type: actType,
          dueDate: new Date(startStr).toISOString(),
          status: 'pending',
          notes: ev.description || 'Google Calendar Event (Synced from Gmail/Workspace)',
          link: ev.htmlLink,
          estimatedHours: actType === 'examination' ? 4 : actType === 'project' ? 5 : 2,
        });
      }
    }
  } catch (err) {
    console.error('Calendar API fetch error:', err);
  }

  return { calendarCourse, activities };
}

// 3. Google Tasks: Fetch pending tasks from Google Tasks and connected apps
export async function fetchGoogleTasksActivities(
  token: string
): Promise<{ taskCourses: Subject[]; activities: DetectedSchoolActivity[] }> {
  const activities: DetectedSchoolActivity[] = [];
  const taskCourses: Subject[] = [];

  try {
    const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (listsRes.ok) {
      const listsData = await listsRes.json();
      const lists = listsData.items || [];

      const colorPalette = ['#06b6d4', '#10b981', '#8b5cf6', '#ec4899', '#3b82f6'];

      for (let i = 0; i < lists.length; i++) {
        const list = lists[i];
        const listName = list.title || 'Tasks';
        const cleanCode = (listName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 7) || 'TASK').toUpperCase();

        const taskSubject: Subject = {
          id: `task-list-${list.id}`,
          code: cleanCode,
          name: listName,
          instructor: 'Google Tasks / Connected Apps',
          units: 3,
          color: colorPalette[i % colorPalette.length],
          semester: 'Active Workspace',
          createdAt: new Date().toISOString(),
        };
        taskCourses.push(taskSubject);

        try {
          const tasksRes = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=true`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (tasksRes.ok) {
            const tasksData = await tasksRes.json();
            const taskItems = tasksData.items || [];

            for (const t of taskItems) {
              if (!t.title) continue;

              const dueDateIso = t.due
                ? new Date(t.due).toISOString()
                : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

              let actType: DetectedSchoolActivity['type'] = 'assignment';
              const lower = t.title.toLowerCase();
              if (lower.includes('project') || lower.includes('capstone') || lower.includes('sprint')) {
                actType = 'project';
              } else if (lower.includes('quiz') || lower.includes('review')) {
                actType = 'quiz';
              } else if (lower.includes('exam')) {
                actType = 'examination';
              }

              activities.push({
                id: `gtask-${t.id}`,
                source: 'tasks',
                courseName: listName,
                courseCode: cleanCode,
                title: t.title,
                type: actType,
                dueDate: dueDateIso,
                status: t.status === 'completed' ? 'completed' : 'pending',
                notes: t.notes || 'Task imported from Google Tasks / Gmail add-ons',
                estimatedHours: actType === 'project' ? 5 : 2,
              });
            }
          }
        } catch (err) {
          console.warn(`Error fetching tasks for list ${list.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Google Tasks fetch error:', err);
  }

  return { taskCourses, activities };
}

// Master Detector: Aggregates Classroom, Tasks, and Calendar in real-time
// Supports both Institutional Gmail (Classroom, Calendar, Tasks) and Normal Gmail (Tasks, Calendar, Connected apps)
export async function detectAllPendingActivities(token: string): Promise<{
  courses: Subject[];
  activities: DetectedSchoolActivity[];
}> {
  const [classroomResult, calendarResult, tasksResult] = await Promise.all([
    fetchClassroomActivities(token),
    fetchCalendarActivities(token),
    fetchGoogleTasksActivities(token),
  ]);

  const allActivities: DetectedSchoolActivity[] = [
    ...classroomResult.activities,
    ...calendarResult.activities,
    ...tasksResult.activities,
  ];

  // Combine courses: Google Classroom courses + Task List courses + Calendar course
  const coursesMap = new Map<string, Subject>();

  // Add Classroom courses first
  classroomResult.courses.forEach((c) => coursesMap.set(c.id, c));

  // If user has Task list courses, add them
  tasksResult.taskCourses.forEach((c) => {
    if (!coursesMap.has(c.id)) {
      coursesMap.set(c.id, c);
    }
  });

  // If calendar course exists and there are calendar activities, add calendar course
  if (calendarResult.calendarCourse && calendarResult.activities.length > 0) {
    coursesMap.set(calendarResult.calendarCourse.id, calendarResult.calendarCourse);
  }

  // Fallback default category for users without any Classroom or Task lists yet
  if (coursesMap.size === 0) {
    coursesMap.set('work-gen-1', {
      id: 'work-gen-1',
      code: 'WORK-01',
      name: 'Work & Daily Deliverables',
      instructor: 'Google Workspace',
      units: 3,
      color: '#6366f1',
      semester: 'Active Workspace',
      createdAt: new Date().toISOString(),
    });
  }

  console.log('[AcadPulse] Classroom sync result', {
    classroomCourses: classroomResult.courses.length,
    classroomActivities: classroomResult.activities.length,
    calendarActivities: calendarResult.activities.length,
    taskActivities: tasksResult.activities.length,
    allActivities: allActivities.length,
    sampleFirst: allActivities[0],
  });

  return {
    courses: Array.from(coursesMap.values()),
    activities: allActivities,
  };
}
