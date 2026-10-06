import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createWorkloadFallback } from './src/utils/workloadAdvisor';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

async function proxyGoogleApi<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error?.message || 'Google API request failed';
    throw new Error(message);
  }

  return payload as T;
}

async function fetchClassroomGoogleData(token: string) {
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
      // try the next fallback
    }
  }

  if (coursesList.length === 0) {
    return { courses: [], activities: [] };
  }

  const colorPalette = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];

  for (let i = 0; i < coursesList.length; i++) {
    const c = coursesList[i];
    const courseSubject = {
      id: `classroom-course-${c.id}`,
      code: c.section ? `${(c.name || 'COURSE').substring(0, 6).toUpperCase()}-${c.section}` : (c.name || 'COURSE').substring(0, 8).toUpperCase(),
      name: c.name || 'Classroom Course',
      instructor: c.creatorUserId ? `Instructor (${String(c.creatorUserId).substring(0, 6)})` : 'Faculty Instructor',
      units: 3,
      color: colorPalette[i % colorPalette.length],
      semester: 'Active Term',
      meetingSchedule: c.room ? `Room: ${c.room}` : undefined,
      createdAt: new Date().toISOString(),
    };
    detectedCourses.push(courseSubject);

    const courseWorkStates = ['PUBLISHED', 'ASSIGNED', 'DRAFT'];
    let courseWorks: any[] = [];

    for (const state of courseWorkStates) {
      try {
        const payload = await proxyGoogleApi<{ courseWork?: any[] }>(
          `https://classroom.googleapis.com/v1/courses/${c.id}/courseWork?courseWorkStates=${state}`,
          token
        );
        const stateCourseWorks = payload.courseWork || [];
        courseWorks = [...courseWorks, ...stateCourseWorks];
      } catch {
        // ignore missing states
      }
    }

    for (const cw of courseWorks) {
      let isSubmitted = false;
      try {
        const submissionPayload = await proxyGoogleApi<{ studentSubmissions?: any[] }>(
          `https://classroom.googleapis.com/v1/courses/${c.id}/courseWork/${cw.id}/studentSubmissions?userId=me`,
          token
        );
        const userSubmission = (submissionPayload.studentSubmissions || [])[0];
        if (userSubmission && ['TURNED_IN', 'RETURNED', 'LATE_TURNED_IN', 'RECLAIMED_BY_STUDENT'].includes(userSubmission.state)) {
          isSubmitted = true;
        }
      } catch {
        // ignore if submission can't be read
      }

      let dueDateIso = '';
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

      let actType: 'assignment' | 'project' | 'quiz' | 'examination' = 'assignment';
      const title = (cw.title || '').toLowerCase();
      if (cw.workType === 'MULTIPLE_CHOICE_QUESTION') actType = 'quiz';
      else if (title.includes('project') || title.includes('capstone')) actType = 'project';
      else if (title.includes('exam') || title.includes('midterm')) actType = 'examination';

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

  return { courses: detectedCourses, activities };
}

async function fetchCalendarGoogleData(token: string) {
  const timeMin = new Date().toISOString();
  const data = await proxyGoogleApi<{ items?: any[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=25`,
    token
  );

  const activities: any[] = [];
  const items = data.items || [];

  for (const ev of items) {
    const title = ev.summary || 'Scheduled Deliverable';
    const startStr = ev.start?.dateTime || ev.start?.date;
    if (!startStr) continue;

    let actType: 'assignment' | 'project' | 'quiz' | 'examination' | 'deadline' = 'deadline';
    const lower = title.toLowerCase();
    if (lower.includes('exam') || lower.includes('midterm') || lower.includes('finals')) actType = 'examination';
    else if (lower.includes('quiz') || lower.includes('test')) actType = 'quiz';
    else if (lower.includes('project') || lower.includes('sprint') || lower.includes('milestone')) actType = 'project';
    else if (lower.includes('submission') || lower.includes('due') || lower.includes('deliverable') || lower.includes('task')) actType = 'assignment';

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
}

async function fetchGoogleTasksData(token: string) {
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

    for (const t of tasksPayload.items || []) {
      if (!t.title) continue;
      const dueDateIso = t.due ? new Date(t.due).toISOString() : '';
      let actType: 'assignment' | 'project' | 'quiz' | 'examination' = 'assignment';
      const lower = String(t.title).toLowerCase();
      if (lower.includes('project') || lower.includes('capstone') || lower.includes('sprint')) actType = 'project';
      else if (lower.includes('quiz') || lower.includes('review')) actType = 'quiz';
      else if (lower.includes('exam')) actType = 'examination';

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

  return { taskCourses, activities };
}

app.post('/api/google/classroom', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Google access token required.' });
    const result = await fetchClassroomGoogleData(token);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch Classroom data.' });
  }
});

app.post('/api/google/calendar', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Google access token required.' });
    const result = await fetchCalendarGoogleData(token);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch Calendar data.' });
  }
});

app.post('/api/google/tasks', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Google access token required.' });
    const result = await fetchGoogleTasksData(token);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch Tasks data.' });
  }
});

app.post('/api/google/detect', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Google access token required.' });

    const [classroomResult, calendarResult, tasksResult] = await Promise.all([
      fetchClassroomGoogleData(token),
      fetchCalendarGoogleData(token),
      fetchGoogleTasksData(token),
    ]);

    const allActivities = [...classroomResult.activities, ...calendarResult.activities, ...tasksResult.activities];
    const coursesMap = new Map<string, any>();

    classroomResult.courses.forEach((c: any) => coursesMap.set(c.id, c));
    tasksResult.taskCourses.forEach((c: any) => {
      if (!coursesMap.has(c.id)) coursesMap.set(c.id, c);
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

    return res.json({
      courses: Array.from(coursesMap.values()),
      activities: allActivities,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to detect Google Workspace activities.' });
  }
});

app.post('/api/google/debug', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Google access token required.' });

    const results: Record<string, any> = {};
    for (const url of [
      'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE',
      'https://classroom.googleapis.com/v1/userCourses?userId=me&courseStates=ACTIVE',
      'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
      'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' + encodeURIComponent(new Date().toISOString()) + '&singleEvents=true&orderBy=startTime&maxResults=25',
    ]) {
      try {
        const payload = await proxyGoogleApi(url, token);
        results[url] = payload;
      } catch (error: any) {
        results[url] = { error: error.message || 'Failed request' };
      }
    }

    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to debug Google Workspace.' });
  }
});

// Initialize Gemini SDK with User-Agent header as required
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// API Route: AI Workload Prioritizer & Schedule Advisor
app.post('/api/ai/prioritize-workload', async (req: Request, res: Response) => {
  try {
    const { tasks, subjects } = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.json({
        prioritizedTaskIds: [],
        burnoutRisk: 'Low',
        workloadFactor: 15,
        summary: 'No active academic tasks recorded.',
        actionableSteps: ['Add subjects and upcoming assignments to generate an AI workload schedule.'],
      });
    }

    if (!ai) {
      return res.json(createWorkloadFallback(tasks, Array.isArray(subjects) ? subjects : []));
    }

    const prompt = `You are an expert academic advisor and workload management AI for college students.
Analyze the following student academic workload and provide intelligent prioritization and study recommendations:

Subjects:
${JSON.stringify(subjects, null, 2)}

Active Tasks & Deadlines:
${JSON.stringify(tasks, null, 2)}

Return a strict JSON object with these keys:
{
  "prioritizedTaskIds": ["id1", "id2", ... ordered by true urgency, academic weighting, and effort],
  "burnoutRisk": "Low" | "Moderate" | "High",
  "workloadFactor": number (1 to 100),
  "summary": "Brief 1-2 sentence executive assessment of their current workload distribution",
  "actionableSteps": ["Concrete recommendation 1", "Concrete recommendation 2", "Concrete recommendation 3"],
  "studySchedule": [
    { "timeSlot": "e.g. 09:00 - 11:00", "subject": "Subject Code/Name", "task": "Task title", "focusStrategy": "e.g. Deep Work / Problem Solving" }
  ]
}
Do not include markdown ticks around the JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('AI Workload Prioritization error:', error);
    return res.json(createWorkloadFallback(
      Array.isArray(req.body?.tasks) ? req.body.tasks : [],
      Array.isArray(req.body?.subjects) ? req.body.subjects : []
    ));
  }
});

// API Route: Task Breakdown Milestone Generator
app.post('/api/ai/breakdown-task', async (req: Request, res: Response) => {
  try {
    const { taskTitle, taskType, subjectCode, estimatedHours, notes } = req.body;

    if (!taskTitle) {
      return res.status(400).json({ error: 'taskTitle is required' });
    }

    if (!ai) {
      return res.json({
        subtasks: [
          { title: `Review guidelines and requirements for ${taskTitle}`, estimatedMinutes: 30 },
          { title: `Draft initial architecture and implementation outline`, estimatedMinutes: 60 },
          { title: `Execute core requirements and conduct self-check`, estimatedMinutes: 90 },
          { title: `Final formatting, proofreading and submission`, estimatedMinutes: 30 },
        ],
      });
    }

    const prompt = `Break down the following college academic requirement into 3 to 5 clear, sequential, actionable subtasks:
Requirement: ${taskTitle}
Category: ${taskType || 'Project/Assignment'}
Subject: ${subjectCode || 'General IT'}
Estimated Total Hours: ${estimatedHours || 4}
Notes: ${notes || 'None'}

Return a strict JSON object:
{
  "subtasks": [
    { "title": "Concise actionable milestone title", "estimatedMinutes": number }
  ],
  "proTip": "One high-value practical tip for finishing this college requirement efficiently"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Task breakdown error:', error);
    return res.status(500).json({
      error: 'Failed to break down task.',
      details: error.message,
    });
  }
});

// API Route: Study Plan Generator
app.post('/api/ai/generate-study-plan', async (req: Request, res: Response) => {
  try {
    const { subjects, examTasks } = req.body;

    if (!ai) {
      return res.json({
        overview: 'Adaptive study plan tailored to upcoming deliverables.',
        blocks: [
          { day: 'Day 1', time: '09:00 - 11:30', topic: 'Core Concept Review & Practice Exercises' },
          { day: 'Day 2', time: '14:00 - 16:30', topic: 'Past Paper Assessment & Synthesis' },
          { day: 'Day 3', time: '10:00 - 12:00', topic: 'Final Consolidation & Flashcard Drill' },
        ],
      });
    }

    const prompt = `Create an optimized revision schedule for a college student facing these upcoming exams and heavy deliverables:
Subjects: ${JSON.stringify(subjects || [])}
Deliverables: ${JSON.stringify(examTasks || [])}

Return a JSON object:
{
  "overview": "Direct 1-2 sentence strategy",
  "blocks": [
    { "day": "Day label", "time": "Time slot", "topic": "Focused topic and technique" }
  ],
  "metacognitiveTechnique": "Brief spaced repetition or active recall tip"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Study plan error:', error);
    return res.status(500).json({
      error: 'Failed to generate study plan.',
      details: error.message,
    });
  }
});

async function startServer() {
  if (!isProduction) {
    // Mount Vite dev middleware
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Academic Workload Server running on http://localhost:${PORT}`);
  });
}

startServer();
