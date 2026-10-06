import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';

export const ADMIN_OWNER_EMAIL = 'ftluzano@paterostechnologicalcollege.edu.ph';

export interface UserAccess {
  uid: string;
  email?: string;
  role?: 'owner' | 'admin' | 'member';
  suspended?: boolean;
  suspendedBy?: string;
  lastSeenAt?: unknown;
  updatedAt?: unknown;
}

export interface SystemEvent {
  id: string;
  uid: string;
  email?: string;
  eventType: string;
  message: string;
  createdAt?: unknown;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  audience: 'all' | 'institution';
  institutionDomain?: string;
  active: boolean;
  createdBy: string;
  createdAt?: unknown;
}

export interface UserReport {
  id: string;
  reporterUid: string;
  targetUid: string;
  targetNickname?: string;
  conversationId?: string;
  category: string;
  details: string;
  status: 'open' | 'reviewed' | 'dismissed';
  createdAt?: unknown;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  actorUid: string;
  actorEmail?: string;
  targetUid?: string;
  details?: string;
  createdAt?: unknown;
}

export function isOwnerAccount(user: User): boolean {
  return user.emailVerified && user.email?.toLowerCase() === ADMIN_OWNER_EMAIL;
}

export function ensureUserAccess(user: User): Promise<void> {
  const accessRef = doc(db, 'user_access', user.uid);
  const base = {
    uid: user.uid,
    email: user.email || '',
    lastSeenAt: serverTimestamp(),
  };
  return setDoc(accessRef, isOwnerAccount(user) ? {
    ...base,
    role: 'owner',
    suspended: false,
    updatedAt: serverTimestamp(),
  } : base, { merge: true });
}

export function subscribeUserAccess(uid: string, onChange: (access: UserAccess | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'user_access', uid), (snapshot) => {
    onChange(snapshot.exists() ? { uid, ...snapshot.data() } as UserAccess : null);
  });
}

export async function recordSystemEvent(user: User, eventType: string, message: string): Promise<void> {
  await addDoc(collection(db, 'system_events'), {
    uid: user.uid,
    email: user.email || '',
    eventType,
    message: message.slice(0, 1000),
    createdAt: serverTimestamp(),
  });
}

function auditEntry(actor: User, action: string, targetUid: string | undefined, details: string) {
  return {
    action,
    actorUid: actor.uid,
    actorEmail: actor.email || '',
    ...(targetUid ? { targetUid } : {}),
    details: details.slice(0, 1000),
    createdAt: serverTimestamp(),
  };
}

export async function changeUserRole(targetUid: string, role: 'admin' | 'member', actor: User): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'user_access', targetUid), {
    uid: targetUid,
    role,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(collection(db, 'admin_audit_logs')), auditEntry(actor, `role_${role}`, targetUid, `Role set to ${role}.`));
  await batch.commit();
}

export async function changeUserSuspension(targetUid: string, suspended: boolean, actor: User): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'user_access', targetUid), {
    uid: targetUid,
    suspended,
    suspendedBy: actor.uid,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(collection(db, 'admin_audit_logs')), auditEntry(actor, suspended ? 'user_suspended' : 'user_reactivated', targetUid, suspended ? 'Account suspended.' : 'Account reactivated.'));
  await batch.commit();
}

export async function publishAnnouncement(input: Omit<Announcement, 'id' | 'createdAt' | 'createdBy'>, actor: User): Promise<void> {
  const batch = writeBatch(db);
  const announcementRef = doc(collection(db, 'site_announcements'));
  batch.set(announcementRef, { ...input, createdBy: actor.uid, createdAt: serverTimestamp() });
  batch.set(doc(collection(db, 'admin_audit_logs')), auditEntry(actor, 'announcement_published', announcementRef.id, `Published: ${input.title}`));
  await batch.commit();
}

export async function deactivateAnnouncement(id: string, actor: User): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'site_announcements', id), { active: false, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, 'admin_audit_logs')), auditEntry(actor, 'announcement_deactivated', id, 'Announcement deactivated.'));
  await batch.commit();
}

export async function resolveUserReport(id: string, status: 'reviewed' | 'dismissed', actor: User): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'user_reports', id), { status, reviewedBy: actor.uid, reviewedAt: serverTimestamp() });
  batch.set(doc(collection(db, 'admin_audit_logs')), auditEntry(actor, `report_${status}`, id, `Report marked ${status}.`));
  await batch.commit();
}

export async function submitUserReport(input: Omit<UserReport, 'id' | 'status' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'user_reports'), {
    ...input,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}