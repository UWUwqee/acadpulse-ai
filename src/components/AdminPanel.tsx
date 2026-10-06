import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Activity, AlertTriangle, Bell, Check, Clock3, FileText, Search, ShieldCheck, UserRoundCog, Users } from 'lucide-react';
import { PublicProfile } from '../types';
import { db } from '../services/firebase';
import {
  AdminAuditEntry,
  Announcement,
  changeUserRole,
  changeUserSuspension,
  deactivateAnnouncement,
  publishAnnouncement,
  resolveUserReport,
  SystemEvent,
  UserAccess,
  UserReport,
} from '../services/adminService';

interface AdminPanelProps {
  user: User;
  isRootAdmin: boolean;
}

type AdminSection = 'overview' | 'users' | 'announcements' | 'reports' | 'audit';

const sections: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'announcements', label: 'Announcements', icon: Bell },
  { id: 'reports', label: 'Reports', icon: AlertTriangle },
  { id: 'audit', label: 'Audit log', icon: FileText },
];

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const timestamp = value as { toMillis?: () => number; seconds?: number };
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  return typeof timestamp.seconds === 'number' ? timestamp.seconds * 1000 : 0;
}

function formatTime(value: unknown): string {
  const time = timestampMillis(value);
  return time ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(time) : 'Just now';
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, isRootAdmin }) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [accessRecords, setAccessRecords] = useState<UserAccess[]>([]);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [auditEntries, setAuditEntries] = useState<AdminAuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState<'all' | 'institution'>('all');
  const [institutionDomain, setInstitutionDomain] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const reportError = (reason: Error) => setError(reason.message || 'Admin data could not be loaded.');
    const unsubs = [
      onSnapshot(query(collection(db, 'public_profiles'), limit(500)), (snapshot) => {
        setProfiles(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as PublicProfile)));
      }, reportError),
      onSnapshot(collection(db, 'user_access'), (snapshot) => {
        setAccessRecords(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as UserAccess)));
      }, reportError),
      onSnapshot(query(collection(db, 'system_events'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
        setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as SystemEvent)));
      }, reportError),
      onSnapshot(query(collection(db, 'site_announcements'), orderBy('createdAt', 'desc'), limit(50)), (snapshot) => {
        setAnnouncements(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Announcement)));
      }, reportError),
      onSnapshot(query(collection(db, 'user_reports'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as UserReport)));
      }, reportError),
      onSnapshot(query(collection(db, 'admin_audit_logs'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
        setAuditEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as AdminAuditEntry)));
      }, reportError),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);

  const accessByUid = useMemo(() => new Map(accessRecords.map((record) => [record.uid, record])), [accessRecords]);
  const visibleProfiles = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return profiles
      .filter((profile) => {
        const access = accessByUid.get(profile.uid);
        return !searchTerm || [profile.nickname, profile.uid, access?.email].some((value) => value?.toLowerCase().includes(searchTerm));
      })
      .sort((first, second) => first.nickname.localeCompare(second.nickname));
  }, [accessByUid, profiles, search]);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const failedSyncs = events.filter((event) => event.eventType === 'google_sync_failed' && timestampMillis(event.createdAt) >= sevenDaysAgo).length;
  const failedReminders = events.filter((event) => event.eventType === 'reminder_delivery_failed' && timestampMillis(event.createdAt) >= sevenDaysAgo).length;
  const activeUsers = accessRecords.filter((record) => !record.suspended && timestampMillis(record.lastSeenAt) >= Date.now() - 24 * 60 * 60 * 1000).length;
  const openReports = reports.filter((report) => report.status === 'open').length;

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  const handleAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    const title = announcementTitle.trim();
    const message = announcementMessage.trim();
    const targetDomain = institutionDomain.trim().toLowerCase();
    if (!title || !message || (announcementAudience === 'institution' && !targetDomain)) {
      setError('Enter a title and message, and choose an institution domain when targeting one campus.');
      return;
    }
    await runAction(async () => {
      await publishAnnouncement({
        title,
        message,
        audience: announcementAudience,
        ...(announcementAudience === 'institution' ? { institutionDomain: targetDomain } : {}),
        active: true,
      }, user);
      setAnnouncementTitle('');
      setAnnouncementMessage('');
    }, 'Announcement published.');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-200"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.14em]">Administration</span></div>
          <h1 className="mt-1 text-xl font-semibold text-white">Service control</h1>
          <p className="mt-1 text-xs text-slate-400">Signed in as {user.email} · {isRootAdmin ? 'Owner access' : 'Administrator access'}</p>
        </div>
        <span className="text-xs text-slate-500">Live data · updates automatically</span>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 pb-2" aria-label="Admin sections">
        {sections.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSection(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${section === id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
            <Icon className="h-4 w-4" />{label}{id === 'reports' && openReports > 0 && <span className="rounded-full bg-rose-900 px-1.5 text-[10px] text-rose-100">{openReports}</span>}
          </button>
        ))}
      </nav>

      {notice && <div role="status" className="flex items-center gap-2 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200"><Check className="h-4 w-4" />{notice}</div>}
      {error && <div role="alert" className="rounded-md border border-rose-800 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{error}</div>}

      {section === 'overview' && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Users} label="Registered users" value={profiles.length} detail="Known profiles" />
            <Metric icon={Activity} label="Active, 24 hours" value={activeUsers} detail="Recent sign-ins" />
            <Metric icon={AlertTriangle} label="Google sync failures" value={failedSyncs} detail="Last 7 days" warning={failedSyncs > 0} />
            <Metric icon={Bell} label="Reminder failures" value={failedReminders} detail="Last 7 days" warning={failedReminders > 0} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="border-t border-slate-800 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Clock3 className="h-4 w-4 text-amber-300" />Recent service events</h2>
              {events.length === 0 ? <EmptyState text="No service errors have been recorded." /> : <div className="divide-y divide-slate-800">{events.slice(0, 8).map((event) => <EventRow key={event.id} event={event} />)}</div>}
            </section>
            <section className="border-t border-slate-800 pt-4">
              <h2 className="mb-3 text-sm font-semibold text-white">Open reports <span className="ml-1 font-mono text-rose-300">{openReports}</span></h2>
              {reports.filter((report) => report.status === 'open').slice(0, 5).map((report) => <div key={report.id} className="border-b border-slate-800 py-3"><div className="text-sm text-white">{report.category} · {report.targetNickname || report.targetUid}</div><p className="mt-1 line-clamp-2 text-xs text-slate-400">{report.details}</p><div className="mt-1 text-[10px] text-slate-500">{formatTime(report.createdAt)}</div></div>)}
              {openReports === 0 && <EmptyState text="No reports need review." />}
            </section>
          </div>
        </section>
      )}

      {section === 'users' && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-white">Account management</h2><p className="mt-1 text-xs text-slate-500">Role changes are restricted to the verified owner account and take effect live.</p></div>
            <label className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or UID" className="w-full rounded-md border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500" /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-slate-800 text-xs text-slate-500"><th className="py-2 pr-3 font-medium">Account</th><th className="py-2 pr-3 font-medium">Role</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Last active</th><th className="py-2 font-medium">Actions</th></tr></thead>
              <tbody>{visibleProfiles.map((profile) => {
                const access = accessByUid.get(profile.uid);
                const isOwner = profile.uid === user.uid && isRootAdmin;
                const role = isOwner ? 'owner' : access?.role === 'admin' ? 'admin' : 'member';
                const suspended = access?.suspended === true;
                return <tr key={profile.uid} className="border-b border-slate-800/70 align-top">
                  <td className="py-3 pr-3"><div className="font-medium text-white">{profile.nickname || 'Student'}</div><div className="text-xs text-slate-400">{access?.email || 'Email unavailable'}</div><div className="mt-1 max-w-[260px] truncate font-mono text-[10px] text-slate-600">{profile.uid}</div></td>
                  <td className="py-3 pr-3"><span className={`rounded border px-2 py-1 text-[11px] ${role === 'owner' ? 'border-amber-700/60 text-amber-200' : role === 'admin' ? 'border-cyan-800 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{role}</span></td>
                  <td className="py-3 pr-3"><span className={suspended ? 'text-rose-300' : 'text-emerald-300'}>{suspended ? 'Suspended' : 'Active'}</span></td>
                  <td className="py-3 pr-3 text-xs text-slate-400">{formatTime(access?.lastSeenAt)}</td>
                  <td className="py-3"><div className="flex flex-wrap gap-2">
                    {isRootAdmin && !isOwner && <button disabled={saving} onClick={() => void runAction(() => changeUserRole(profile.uid, role === 'admin' ? 'member' : 'admin', user), role === 'admin' ? 'Administrator role removed.' : 'Administrator role assigned.')} className="rounded border border-cyan-900 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-950/50 disabled:opacity-50">{role === 'admin' ? 'Remove admin' : 'Make admin'}</button>}
                    {!isOwner && <button disabled={saving} onClick={() => void runAction(() => changeUserSuspension(profile.uid, !suspended, user), suspended ? 'Account reactivated.' : 'Account suspended.')} className={`rounded border px-2 py-1 text-[11px] disabled:opacity-50 ${suspended ? 'border-emerald-900 text-emerald-200 hover:bg-emerald-950/50' : 'border-rose-900 text-rose-200 hover:bg-rose-950/50'}`}>{suspended ? 'Reactivate' : 'Suspend'}</button>}
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
            {visibleProfiles.length === 0 && <EmptyState text="No matching user profiles." />}
          </div>
        </section>
      )}

      {section === 'announcements' && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form onSubmit={(event) => void handleAnnouncement(event)} className="space-y-3 border-t border-slate-800 pt-4">
            <h2 className="text-sm font-semibold text-white">Publish announcement</h2>
            <input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={100} placeholder="Announcement title" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
            <textarea value={announcementMessage} onChange={(event) => setAnnouncementMessage(event.target.value)} maxLength={1000} rows={4} placeholder="Message" className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
            <div className="flex flex-wrap gap-3">
              <select value={announcementAudience} onChange={(event) => setAnnouncementAudience(event.target.value as 'all' | 'institution')} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="all">All users</option><option value="institution">One institution</option></select>
              {announcementAudience === 'institution' && <input value={institutionDomain} onChange={(event) => setInstitutionDomain(event.target.value)} placeholder="Institution email domain" className="min-w-48 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />}
              <button disabled={saving} className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50">Publish</button>
            </div>
          </form>
          <section className="border-t border-slate-800 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-white">Recent announcements</h2>
            {announcements.length === 0 ? <EmptyState text="No announcements published yet." /> : announcements.map((announcement) => <article key={announcement.id} className="border-b border-slate-800 py-3"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium text-white">{announcement.title}</h3><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{announcement.message}</p><p className="mt-2 text-[10px] text-slate-500">{announcement.audience === 'all' ? 'All users' : announcement.institutionDomain} · {announcement.active ? 'Active' : 'Inactive'} · {formatTime(announcement.createdAt)}</p></div>{announcement.active && <button disabled={saving} onClick={() => void runAction(() => deactivateAnnouncement(announcement.id, user), 'Announcement withdrawn.')} className="shrink-0 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50">Withdraw</button>}</div></article>)}
          </section>
        </section>
      )}

      {section === 'reports' && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-white">Profile and chat reports</h2>
          {reports.length === 0 ? <EmptyState text="No reports have been submitted." /> : <div className="divide-y divide-slate-800">{reports.map((report) => <article key={report.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-white">{report.category}</span><span className={`rounded border px-1.5 py-0.5 text-[10px] ${report.status === 'open' ? 'border-amber-800 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{report.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{report.details}</p><p className="mt-2 text-[10px] text-slate-500">Reported by {report.reporterUid} · Target {report.targetNickname || report.targetUid} · {formatTime(report.createdAt)}</p></div>{report.status === 'open' && <div className="flex gap-2"><button disabled={saving} onClick={() => void runAction(() => resolveUserReport(report.id, 'reviewed', user), 'Report marked reviewed.')} className="h-fit rounded border border-cyan-900 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-950/50 disabled:opacity-50">Mark reviewed</button><button disabled={saving} onClick={() => void runAction(() => resolveUserReport(report.id, 'dismissed', user), 'Report dismissed.')} className="h-fit rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50">Dismiss</button></div>}</article>)}</div>}
        </section>
      )}

      {section === 'audit' && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-white">Administrative activity</h2>
          {auditEntries.length === 0 ? <EmptyState text="No administrative actions recorded yet." /> : <div className="divide-y divide-slate-800">{auditEntries.map((entry) => <div key={entry.id} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr_auto]"><span className="text-xs font-semibold text-cyan-200">{entry.action.replaceAll('_', ' ')}</span><span className="text-xs text-slate-300">{entry.details}{entry.targetUid ? ` · target ${entry.targetUid}` : ''}</span><span className="text-[10px] text-slate-500">{entry.actorEmail || entry.actorUid} · {formatTime(entry.createdAt)}</span></div>)}</div>}
        </section>
      )}
    </div>
  );
};

function Metric({ icon: Icon, label, value, detail, warning = false }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; detail: string; warning?: boolean }) {
  return <div className="border-t border-slate-800 px-1 py-3">
    <div className="flex items-center gap-2 text-xs text-slate-400"><Icon className={`h-4 w-4 ${warning ? 'text-rose-300' : 'text-cyan-300'}`} />{label}</div>
    <div className={`mt-2 font-mono text-2xl font-semibold ${warning ? 'text-rose-200' : 'text-white'}`}>{value}</div>
    <div className="mt-1 text-[10px] text-slate-500">{detail}</div>
  </div>;
}

function EventRow({ event }: { event: SystemEvent }) {
  return <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr_auto]"><span className="text-xs font-medium text-amber-200">{event.eventType.replaceAll('_', ' ')}</span><span className="text-xs text-slate-300">{event.message}</span><span className="text-[10px] text-slate-500">{formatTime(event.createdAt)}</span></div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-5 text-sm text-slate-500">{text}</p>;
}