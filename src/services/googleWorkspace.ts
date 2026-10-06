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

async function proxyGoogleRequest<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.error || 'Google Workspace request failed.');
  }

  return response.json() as Promise<T>;
}

// 1. Google Classroom: Fetch active courses and pending coursework
export async function fetchClassroomActivities(
  token: string
): Promise<{ courses: Subject[]; activities: DetectedSchoolActivity[] }> {
  return proxyGoogleRequest('/api/google/classroom', token);
}

// 2. Google Calendar: Fetch upcoming deadlines, exam schedules, and work events
export async function fetchCalendarActivities(
  token: string
): Promise<{ calendarCourse?: Subject; activities: DetectedSchoolActivity[] }> {
  return proxyGoogleRequest('/api/google/calendar', token);
}

// 3. Google Tasks: Fetch pending tasks from Google Tasks and connected apps
export async function fetchGoogleTasksActivities(
  token: string
): Promise<{ taskCourses: Subject[]; activities: DetectedSchoolActivity[] }> {
  return proxyGoogleRequest('/api/google/tasks', token);
}

// Master Detector: Aggregates Classroom, Tasks, and Calendar in real-time
// Supports both Institutional Gmail (Classroom, Calendar, Tasks) and Normal Gmail (Tasks, Calendar, Connected apps)
export async function detectAllPendingActivities(token: string): Promise<{
  courses: Subject[];
  activities: DetectedSchoolActivity[];
}> {
  return proxyGoogleRequest('/api/google/detect', token);
}

export async function debugGoogleWorkspaceSync(token: string) {
  return proxyGoogleRequest('/api/google/debug', token);
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export async function sendDeadlineReminderEmail(
  token: string,
  email: string,
  title: string,
  subjectCode: string,
  dueDate: string
): Promise<void> {
  const subject = `Reminder: ${title} is due tomorrow`;
  const body = [
    `Your activity "${title}" is due in about one day.`,
    subjectCode ? `Course: ${subjectCode}` : '',
    `Due: ${new Date(dueDate).toLocaleString()}`,
    'Open AcadPulse to review your activity.',
  ].filter(Boolean).join('\n');
  const mimeMessage = [
    `To: ${email}`,
    `Subject: =?UTF-8?B?${encodeBase64Utf8(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Utf8(body),
  ].join('\r\n');
  const raw = btoa(mimeMessage).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || 'Gmail could not send the reminder.');
  }
}
