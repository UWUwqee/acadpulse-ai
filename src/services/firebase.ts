import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Web app's Firebase configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyD6FskKiR4k40gsrb6mNIBXvBAJFSFAY3w",
  authDomain: "aipowerd-academic.firebaseapp.com",
  projectId: "aipowerd-academic",
  storageBucket: "aipowerd-academic.firebasestorage.app",
  messagingSenderId: "240838468110",
  appId: "1:240838468110:web:334b38962147b03a19d25f"
};

// Singleton Firebase initialization
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Standard Workspace & Classroom/Calendar scopes
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

WORKSPACE_SCOPES.forEach((scope) => googleAuthProvider.addScope(scope));
// Force account selection so students can easily pick their institutional school email
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});
