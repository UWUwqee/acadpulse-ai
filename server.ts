import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

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
      // Algorithmic fallback if API key is temporarily absent
      const urgentTasks = tasks.filter((t: any) => t.priority === 'urgent' || t.status === 'in_progress');
      return res.json({
        prioritizedTaskIds: urgentTasks.map((t: any) => t.id),
        burnoutRisk: tasks.length > 5 ? 'Moderate' : 'Low',
        workloadFactor: Math.min(100, tasks.length * 15),
        summary: `Prioritizing ${urgentTasks.length} urgent tasks based on imminent deadline heuristics.`,
        actionableSteps: [
          'Complete nearest deliverable within a dedicated 2-hour morning block.',
          'Review upcoming exam materials with spaced repetition.',
        ],
      });
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
    return res.status(500).json({
      error: 'Failed to generate AI workload prioritization.',
      details: error.message,
    });
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
