import { GoogleGenAI } from '@google/genai';

const parseBody = async (req: any) => {
  if (!req) return {};

  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return {};
};

const proxyGoogleApi = async <T>(url: string, token: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : payload?.error?.message || 'Google API request failed';
    throw new Error(message);
  }

  return payload as T;
};

const fetchClassroomGoogleData = async (token: string) => {
  const detectedCourses: any[] = [];
  const activities: any[] = [];

  const courseFetchCandidates = [
    'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE',
    'https://classroom.googleapis.com/v1/userCourses?userId=me&courseStates=ACTIVE',
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
  ];

  let coursesList: any[] = [];

  for (const url of courseFetchCandidates) {
    try {
      const payload = await proxyGoogleApi<{ courses?: any[]; userCourses?: any[] }>(url, token);
      const nextCourses = payload.courses || payload.userCourses || [];
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
    } catch {
      // retry on next fallback
    }
  }

  if (coursesList.length === 0) {
    return { courses: [], activities: [] };
  }

  const colorPalette = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];

  for (let i = 0; i < coursesList.length; i++) {
    const course = coursesList[i];
    const courseSubject = {
      id: `classroom-course-${course.id}`,
      code: course.section ? `${(course.name || 'COURSE').substring(0, 6).toUpperCase()}-${course.section}` : (course.name || 'COURSE').substring(0, 8).toUpperCase(),
      name: course.name || 'Classroom Course',
      instructor: course.creatorUserId ? `Instructor (${String(course.creatorUserId).substring(0, 6)})` : 'Faculty Instructor',
      units: 3,
      color: colorPalette[i % colorPalette.length],
      semester: 'Active Term',
      meetingSchedule: course.room ? `Room: ${course.room}` : undefined,
      createdAt: new Date().toISOString(),
    };

    detectedCourses.push(courseSubject);

    const courseWorkStates = ['PUBLISHED', 'ASSIGNED', 'DRAFT'];
    let courseWorks: any[] = [];

    for (const state of courseWorkStates) {
      try {
        const payload = await proxyGoogleApi<{ courseWork?: any[] }>(
          `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?courseWorkStates=${state}`,
          token
        );
        courseWorks = [...courseWorks, ...(payload.courseWork || [])];
      } catch {
        // ignore missing states
      }
    }

    for (const cw of courseWorks) {
      let isSubmitted = false;
      try {
        const submissionPayload = await proxyGoogleApi<{ studentSubmissions?: any[] }>(
          `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork/${cw.id}/studentSubmissions?userId=me`,
          token
        );
        const userSubmission = (submissionPayload.studentSubmissions || [])[0];
        if (userSubmission && ['TURNED_IN', 'RETURNED', 'LATE_TURNED_IN', 'RECLAIMED_BY_STUDENT'].includes(userSubmission.state)) {
          isSubmitted = true;
        }
      } catch {
        // ignore submission fetch errors
      }

      let dueDateIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      if (cw.dueDate) {
        const due = new Date();
        due.setFullYear(cw.dueDate.year || due.getFullYear());
        due.setMonth((cw.dueDate.month || 1) - 1);
        due.setDate(cw.dueDate.day || due.getDate());
        if (cw.dueTime) {
          due.setHours(cw.dueTime.hours || 23, cw.dueTime.minutes || 59, 0, 0);
        } else {
          due.setHours(23, 59, 0, 0);
        }
        dueDateIso = due.toISOString();
      }

      let actType: 'assignment' | 'project' | 'quiz' | 'examination' = 'assignment';
      const title = (cw.title || '').toLowerCase();
      if (cw.workType === 'MULTIPLE_CHOICE_QUESTION') actType = 'quiz';
      else if (title.includes('project') || title.includes('capstone')) actType = 'project';
      else if (title.includes('exam') || title.includes('midterm')) actType = 'examination';

      activities.push({
        id: `classroom-work-${cw.id}`,
        source: 'classroom',
        courseName: course.name,
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

  return { courses: detectedCourses, activities };
};

const fetchCalendarGoogleData = async (token: string) => {
  const timeMin = new Date().toISOString();
  const data = await proxyGoogleApi<{ items?: any[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=25`,
    token
  );

  const activities: any[] = [];
  const items = data.items || [];

  for (const event of items) {
    const title = event.summary || 'Scheduled Deliverable';
    const startStr = event.start?.dateTime || event.start?.date;
    if (!startStr) continue;

    let actType: 'assignment' | 'project' | 'quiz' | 'examination' | 'deadline' = 'deadline';
    const lower = title.toLowerCase();
    if (lower.includes('exam') || lower.includes('midterm') || lower.includes('finals')) actType = 'examination';
    else if (lower.includes('quiz') || lower.includes('test')) actType = 'quiz';
    else if (lower.includes('project') || lower.includes('sprint') || lower.includes('milestone')) actType = 'project';
    else if (lower.includes('submission') || lower.includes('due') || lower.includes('deliverable') || lower.includes('task')) actType = 'assignment';

    activities.push({
      id: `calendar-${event.id}`,
      source: 'calendar',
      courseName: 'Schedule & Deadlines',
      courseCode: 'CALENDAR',
      title,
      type: actType,
      dueDate: new Date(startStr).toISOString(),
      status: 'pending',
      notes: event.description || 'Google Calendar Event (Synced from Workspace)',
      link: event.htmlLink,
      estimatedHours: actType === 'examination' ? 4 : actType === 'project' ? 5 : 2,
    });
  }

  return {
    calendarCourse: items.length > 0 ? {
      id: 'course-google-calendar',
      code: 'CALENDAR',
      name: 'Schedule & Deadlines',
      instructor: 'Google Calendar Sync',
      units: 3,
      color: '#f59e0b',
      semester: 'Active Workspace',
      createdAt: new Date().toISOString(),
    } : undefined,
    activities,
  };
};

const fetchGoogleTasksData = async (token: string) => {
  const data = await proxyGoogleApi<{ items?: any[] }>('https://tasks.googleapis.com/tasks/v1/users/@me/lists', token);
  const lists = data.items || [];
  const activities: any[] = [];
  const taskCourses: any[] = [];
  const colorPalette = ['#06b6d4', '#10b981', '#8b5cf6', '#ec4899', '#3b82f6'];

  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];
    const listName = list.title || 'Tasks';
    const cleanCode = (listName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 7) || 'TASK').toUpperCase();

    taskCourses.push({
      id: `task-list-${list.id}`,
      code: cleanCode,
      name: listName,
      instructor: 'Google Tasks / Connected Apps',
      units: 3,
      color: colorPalette[i % colorPalette.length],
      semester: 'Active Workspace',
      createdAt: new Date().toISOString(),
    });

    const tasksPayload = await proxyGoogleApi<{ items?: any[] }>(
      `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=true`,
      token
    );

    for (const item of tasksPayload.items || []) {
      if (!item.title) continue;

      const dueDateIso = item.due ? new Date(item.due).toISOString() : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      let actType: 'assignment' | 'project' | 'quiz' | 'examination' = 'assignment';
      const lower = String(item.title).toLowerCase();
      if (lower.includes('project') || lower.includes('capstone') || lower.includes('sprint')) actType = 'project';
      else if (lower.includes('quiz') || lower.includes('review')) actType = 'quiz';
      else if (lower.includes('exam')) actType = 'examination';

      activities.push({
        id: `gtask-${item.id}`,
        source: 'tasks',
        courseName: listName,
        courseCode: cleanCode,
        title: item.title,
        type: actType,
        dueDate: dueDateIso,
        status: item.status === 'completed' ? 'completed' : 'pending',
        notes: item.notes || 'Task imported from Google Tasks / Gmail Add-ons',
        estimatedHours: actType === 'project' ? 5 : 2,
      });
    }
  }

  return { taskCourses, activities };
};

const handleGoogleRoute = async (req: any, res: any, route: string) => {
  const body = await parseBody(req);
  const { token } = body || {};

  if (!token) {
    return res.status(400).json({ error: 'Google access token required.' });
  }

  try {
    if (route === 'google/classroom') {
      const result = await fetchClassroomGoogleData(token);
      return res.status(200).json(result);
    }

    if (route === 'google/calendar') {
      const result = await fetchCalendarGoogleData(token);
      return res.status(200).json(result);
    }

    if (route === 'google/tasks') {
      const result = await fetchGoogleTasksData(token);
      return res.status(200).json(result);
    }

    if (route === 'google/detect') {
      const [classroomResult, calendarResult, tasksResult] = await Promise.all([
        fetchClassroomGoogleData(token),
        fetchCalendarGoogleData(token),
        fetchGoogleTasksData(token),
      ]);

      const allActivities = [...classroomResult.activities, ...calendarResult.activities, ...tasksResult.activities];
      const coursesMap = new Map<string, any>();

      classroomResult.courses.forEach((course: any) => coursesMap.set(course.id, course));
      tasksResult.taskCourses.forEach((course: any) => {
        if (!coursesMap.has(course.id)) coursesMap.set(course.id, course);
      });

      if (calendarResult.calendarCourse && calendarResult.activities.length > 0) {
        coursesMap.set(calendarResult.calendarCourse.id, calendarResult.calendarCourse);
      }

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

      return res.status(200).json({
        courses: Array.from(coursesMap.values()),
        activities: allActivities,
      });
    }

    if (route === 'google/debug') {
      const results: Record<string, any> = {};
      const urls = [
        'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE',
        'https://classroom.googleapis.com/v1/userCourses?userId=me&courseStates=ACTIVE',
        'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
        'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(new Date().toISOString())}&singleEvents=true&orderBy=startTime&maxResults=25`,
      ];

      for (const url of urls) {
        try {
          results[url] = await proxyGoogleApi(url, token);
        } catch (error: any) {
          results[url] = { error: error.message || 'Failed request' };
        }
      }

      return res.status(200).json(results);
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch Google Workspace data.' });
  }

  return res.status(404).json({ error: 'Google route not found.' });
};

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const handleAiRoute = async (req: any, res: any, route: string) => {
  const body = await parseBody(req);

  try {
    if (route === 'ai/prioritize-workload') {
      const { tasks = [], subjects = [] } = body;

      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(200).json({
          prioritizedTaskIds: [],
          burnoutRisk: 'Low',
          workloadFactor: 15,
          summary: 'No active academic tasks recorded.',
          actionableSteps: ['Add subjects and upcoming assignments to generate an AI workload schedule.'],
        });
      }

      if (!ai) {
        const urgentTasks = tasks.filter((task: any) => task.priority === 'urgent' || task.status === 'in_progress');
        return res.status(200).json({
          prioritizedTaskIds: urgentTasks.map((task: any) => task.id),
          burnoutRisk: tasks.length > 5 ? 'Moderate' : 'Low',
          workloadFactor: Math.min(100, tasks.length * 15),
          summary: `Prioritizing ${urgentTasks.length} urgent tasks based on imminent deadline heuristics.`,
          actionableSteps: [
            'Complete nearest deliverable within a dedicated 2-hour morning block.',
            'Review upcoming exam materials with spaced repetition.',
          ],
        });
      }

      const prompt = `You are an expert academic advisor and workload management AI for college students. Analyze the following student academic workload and provide intelligent prioritization and study recommendations: Subjects: ${JSON.stringify(subjects, null, 2)} Active Tasks & Deadlines: ${JSON.stringify(tasks, null, 2)} Return a strict JSON object with these keys: { "prioritizedTaskIds": ["id1", "id2", ...], "burnoutRisk": "Low" | "Moderate" | "High", "workloadFactor": number (1 to 100), "summary": "Brief 1-2 sentence executive assessment", "actionableSteps": ["Concrete recommendation 1", "Concrete recommendation 2", "Concrete recommendation 3"], "studySchedule": [{ "timeSlot": "09:00 - 11:00", "subject": "Subject Code/Name", "task": "Task title", "focusStrategy": "Deep Work / Problem Solving" }] }`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      return res.status(200).json(JSON.parse(response.text || '{}'));
    }

    if (route === 'ai/breakdown-task') {
      const { taskTitle, taskType, subjectCode, estimatedHours, notes } = body;
      if (!taskTitle) return res.status(400).json({ error: 'taskTitle is required' });

      if (!ai) {
        return res.status(200).json({
          subtasks: [
            { title: `Review guidelines and requirements for ${taskTitle}`, estimatedMinutes: 30 },
            { title: 'Draft initial architecture and implementation outline', estimatedMinutes: 60 },
            { title: 'Execute core requirements and conduct self-check', estimatedMinutes: 90 },
            { title: 'Final formatting, proofreading and submission', estimatedMinutes: 30 },
          ],
        });
      }

      const prompt = `Break down the following college academic requirement into 3 to 5 clear, sequential, actionable subtasks: Requirement: ${taskTitle} Category: ${taskType || 'Project/Assignment'} Subject: ${subjectCode || 'General IT'} Estimated Total Hours: ${estimatedHours || 4} Notes: ${notes || 'None'} Return a strict JSON object: { "subtasks": [{ "title": "Concise actionable milestone title", "estimatedMinutes": number }], "proTip": "One practical tip" }`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      return res.status(200).json(JSON.parse(response.text || '{}'));
    }

    if (route === 'ai/generate-study-plan') {
      const { subjects = [], examTasks = [] } = body;
      if (!ai) {
        return res.status(200).json({
          overview: 'Adaptive study plan tailored to upcoming deliverables.',
          blocks: [
            { day: 'Day 1', time: '09:00 - 11:30', topic: 'Core Concept Review & Practice Exercises' },
            { day: 'Day 2', time: '14:00 - 16:30', topic: 'Past Paper Assessment & Synthesis' },
            { day: 'Day 3', time: '10:00 - 12:00', topic: 'Final Consolidation & Flashcard Drill' },
          ],
        });
      }

      const prompt = `Create an optimized revision schedule for a college student facing these upcoming exams and heavy deliverables: Subjects: ${JSON.stringify(subjects)} Deliverables: ${JSON.stringify(examTasks)} Return a JSON object: { "overview": "Direct 1-2 sentence strategy", "blocks": [{ "day": "Day label", "time": "Time slot", "topic": "Focused topic and technique" }], "metacognitiveTechnique": "Brief spaced repetition or active recall tip" }`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      return res.status(200).json(JSON.parse(response.text || '{}'));
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'AI route failed.' });
  }

  return res.status(404).json({ error: 'AI route not found.' });
};

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;
  const route = pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');

  if (!route) {
    return res.status(200).json({ ok: true, message: 'AcadPulse API is running.' });
  }

  if (route.startsWith('google/')) {
    return handleGoogleRoute(req, res, route);
  }

  if (route.startsWith('ai/')) {
    return handleAiRoute(req, res, route);
  }

  return res.status(404).json({ error: `Unknown API route: ${route}` });
}
