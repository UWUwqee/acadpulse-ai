import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { ChatConversation, ChatMessage, FriendRequest, Friendship, PublicProfile } from '../types';
import {
  ensureConversation,
  findPublicProfile,
  savePublicProfile,
  sendChatMessage,
  sendFriendRequest,
  subscribePublicProfile,
  subscribeConversations,
  subscribeFriendRequests,
  subscribeFriendships,
  subscribeMessages,
  toggleMessageReaction,
  respondToFriendRequest,
} from '../services/socialService';
import { submitUserReport } from '../services/adminService';
import { Check, CheckCheck, Flag, ImagePlus, MessageCircle, Plus, Send, Settings, UserPlus, Users, X } from 'lucide-react';

interface ChatViewProps {
  user: User;
}

const reactions = ['❤️', '👍', '😂', '😮', '😢', '‼️'];
const styles = {
  field: 'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none',
  button: 'inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50',
};

function Avatar({ profile, size = 'md' }: { profile?: PublicProfile | null; size?: 'sm' | 'md' | 'lg' }) {
  const dimension = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  return profile?.photoBase64 ? (
    <img src={profile.photoBase64} alt="" className={`${dimension} shrink-0 rounded-full border border-slate-700 object-cover`} />
  ) : (
    <div className={`${dimension} shrink-0 rounded-full border border-indigo-700/50 bg-indigo-950 text-indigo-200 grid place-items-center font-semibold`}>
      {(profile?.nickname || '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

export const ChatView: React.FC<ChatViewProps> = ({ user }) => {
  const [profile, setProfile] = useState<PublicProfile>({
    uid: user.uid,
    nickname: user.displayName || 'Student',
    photoBase64: '',
    updatedAt: new Date().toISOString(),
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [friendUid, setFriendUid] = useState('');
  const [lookupProfile, setLookupProfile] = useState<PublicProfile | null>(null);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, PublicProfile>>({});
  const [activeFriendUid, setActiveFriendUid] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('Harassment or abuse');
  const [reportDetails, setReportDetails] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribePublicProfile(user.uid, (saved) => {
      if (saved) setProfile(saved);
    });
  }, [user.uid]);

  useEffect(() => subscribeFriendRequests(user.uid, setFriendRequests), [user.uid]);
  useEffect(() => subscribeFriendships(user.uid, setFriendships), [user.uid]);
  useEffect(() => subscribeConversations(user.uid, setConversations), [user.uid]);

  const friendUids = useMemo(
    () => friendships.flatMap((friendship) => friendship.participants.filter((uid) => uid !== user.uid)),
    [friendships, user.uid]
  );

  useEffect(() => {
    const unsubscribes = friendUids.map((uid) => subscribePublicProfile(uid, (friend) => {
      setFriendProfiles((existing) => {
        const updated = { ...existing };
        if (friend) updated[uid] = friend;
        else delete updated[uid];
        return updated;
      });
    }));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [friendUids.join('|')]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    return subscribeMessages(activeConversationId, setMessages);
  }, [activeConversationId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!activeFriendUid) {
      setActiveConversationId(null);
      return;
    }
    const existing = conversations.find((conversation) => conversation.participants.includes(activeFriendUid));
    if (existing) setActiveConversationId(existing.id);
    else setActiveConversationId(null);
  }, [activeFriendUid, conversations]);

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLookupProfile(null);
    const uid = friendUid.trim();
    if (!uid || uid === user.uid) {
      setError('Enter another user’s UID.');
      return;
    }
    setBusy(true);
    try {
      const found = await findPublicProfile(uid);
      if (!found) throw new Error('No profile found for that UID. Check the UID and try again.');
      setLookupProfile(found);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Profile lookup failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddFriend = async () => {
    if (!lookupProfile) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await sendFriendRequest(user.uid, lookupProfile.uid);
      setNotice('Friend request sent.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send friend request.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequest = async (request: FriendRequest, accepted: boolean) => {
    setError('');
    try {
      await respondToFriendRequest(request, accepted);
      setNotice(accepted ? 'Friend added.' : 'Request declined.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update friend request.');
    }
  };

  const openFriendChat = async (uid: string) => {
    setError('');
    setActiveFriendUid(uid);
    const conversation = conversations.find((item) => item.participants.includes(uid));
    if (conversation) {
      setActiveConversationId(conversation.id);
      return;
    }
    try {
      const id = await ensureConversation(user.uid, uid);
      setActiveConversationId(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open chat.');
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeFriendUid || !messageText.trim()) return;
    setError('');
    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        conversationId = await ensureConversation(user.uid, activeFriendUid);
        setActiveConversationId(conversationId);
      }
      await sendChatMessage(conversationId, user.uid, messageText);
      setMessageText('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Message could not be sent.');
    }
  };

  const handleReaction = async (message: ChatMessage, emoji: string) => {
    if (!activeConversationId) return;
    try {
      await toggleMessageReaction(activeConversationId, message.id, user.uid, emoji);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reaction could not be saved.');
    }
  };

  const handlePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    if (file.size > 500_000) {
      setError('Choose an image under 500 KB so it fits safely in your Firestore profile.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfile((current) => ({ ...current, photoBase64: String(reader.result || '') }));
      setError('');
    };
    reader.onerror = () => setError('Could not read this image.');
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const nickname = profile.nickname.trim();
    if (!nickname) {
      setError('Nickname cannot be empty.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const nextProfile = { ...profile, nickname, updatedAt: new Date().toISOString() };
      await savePublicProfile(nextProfile);
      setProfile(nextProfile);
      setIsEditingProfile(false);
      setNotice('Profile saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeFriendUid || reportDetails.trim().length < 8) {
      setError('Add at least 8 characters describing the concern.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submitUserReport({
        reporterUid: user.uid,
        targetUid: activeFriendUid,
        targetNickname: activeFriend?.nickname || 'Student',
        ...(activeConversationId ? { conversationId: activeConversationId } : {}),
        category: reportCategory,
        details: reportDetails.trim(),
      });
      setReportDetails('');
      setIsReportOpen(false);
      setNotice('Report submitted for review.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit the report.');
    } finally {
      setBusy(false);
    }
  };

  const activeFriend = activeFriendUid ? friendProfiles[activeFriendUid] : null;

  return (
    <div className="grid min-h-[min(620px,78dvh)] overflow-hidden rounded-xl border border-slate-800 bg-slate-950/75 md:min-h-[620px] md:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-slate-800 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2 text-white">
            <MessageCircle className="h-5 w-5 text-indigo-300" />
            <h2 className="font-semibold">Messages</h2>
          </div>
          <button className={styles.button} onClick={() => setIsEditingProfile(true)} title="Profile settings">
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar profile={profile} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{profile.nickname}</div>
              <div className="text-xs text-slate-400">Your UID</div>
            </div>
          </div>
          <div className="select-all break-all rounded bg-slate-900 px-2 py-1.5 font-mono text-[11px] text-slate-300">{user.uid}</div>

          <form onSubmit={handleLookup} className="mt-4 space-y-2">
            <label className="text-xs font-medium text-slate-300" htmlFor="friend-uid">Add friend by UID</label>
            <input id="friend-uid" value={friendUid} onChange={(event) => setFriendUid(event.target.value)} placeholder="Paste a user UID" className={styles.field} />
            <button type="submit" disabled={busy} className="w-full rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              <span className="inline-flex items-center gap-2"><UserPlus className="h-4 w-4" />Find user</span>
            </button>
          </form>

          {lookupProfile && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
              <Avatar profile={lookupProfile} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{lookupProfile.nickname}</div>
                <div className="truncate font-mono text-[10px] text-slate-500">{lookupProfile.uid}</div>
              </div>
              <button onClick={handleAddFriend} disabled={busy} title="Send friend request" className="rounded-md bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
            </div>
          )}
        </div>

        {friendRequests.length > 0 && (
          <div className="border-t border-slate-800 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300"><UserPlus className="h-4 w-4" />Requests ({friendRequests.length})</h3>
            <div className="space-y-2">
              {friendRequests.map((request) => (
                <FriendRequestRow key={request.id} request={request} onRespond={handleRequest} />
              ))}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 border-t border-slate-800 p-3">
          <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-slate-400"><Users className="h-4 w-4" />Friends</h3>
          {friendUids.length === 0 ? (
            <p className="px-1 py-3 text-xs text-slate-500">Search by a friend’s UID to connect.</p>
          ) : (
            <div className="space-y-1">
              {friendUids.map((uid) => {
                const friend = friendProfiles[uid];
                const conversation = conversations.find((item) => item.participants.includes(uid));
                return (
                  <button key={uid} onClick={() => void openFriendChat(uid)} className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${activeFriendUid === uid ? 'bg-slate-800' : 'hover:bg-slate-900'}`}>
                    <Avatar profile={friend} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{friend?.nickname || 'Student'}</span>
                      <span className="block truncate text-xs text-slate-500">{conversation?.lastMessage || 'Start a conversation'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-h-[min(520px,65dvh)] min-w-0 flex-col md:min-h-[520px]">
        {activeFriendUid ? (
          <>
            <header className="flex items-center gap-3 border-b border-slate-800 px-5 py-3">
              <Avatar profile={activeFriend} size="sm" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-white">{activeFriend?.nickname || 'Student'}</h3>
                <p className="truncate font-mono text-[10px] text-slate-500">{activeFriendUid}</p>
              </div>
              <span className="hidden text-[11px] text-slate-500 sm:inline">Profile visible to friends</span>
              <button onClick={() => setIsReportOpen((open) => !open)} title="Report profile or chat" aria-label="Report profile or chat" className="rounded-md p-2 text-slate-400 hover:bg-rose-950/50 hover:text-rose-300"><Flag className="h-4 w-4" /></button>
            </header>

            {isReportOpen && <form onSubmit={(event) => void handleReport(event)} className="space-y-2 border-b border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-white">Report profile or chat</h4><button type="button" onClick={() => setIsReportOpen(false)} aria-label="Close report form" className="rounded p-1 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
              <div className="grid gap-2 sm:grid-cols-[190px_1fr]">
                <select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)} className={styles.field}>
                  <option>Harassment or abuse</option><option>Spam</option><option>Impersonation</option><option>Other safety concern</option>
                </select>
                <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} minLength={8} maxLength={1000} rows={2} placeholder="Describe the concern" className={`${styles.field} resize-y`} />
              </div>
              <div className="flex justify-end"><button type="submit" disabled={busy || reportDetails.trim().length < 8} className="rounded-md bg-rose-800 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Submit report</button></div>
            </form>}

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.length === 0 ? (
                <div className="grid h-full min-h-56 place-items-center text-center">
                  <div><MessageCircle className="mx-auto mb-2 h-8 w-8 text-slate-600" /><p className="text-sm text-slate-300">Start the conversation</p><p className="mt-1 text-xs text-slate-500">Messages and reactions update live.</p></div>
                </div>
              ) : messages.map((message) => {
                const mine = message.senderUid === user.uid;
                const groupedReactions = Object.entries(
                  Object.values(message.reactions || {}).reduce<Record<string, number>>((groups, emoji) => {
                    groups[emoji] = (groups[emoji] || 0) + 1;
                    return groups;
                  }, {})
                );
                const myReaction = message.reactions?.[user.uid];
                return (
                  <div key={message.id} className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm border border-slate-700 bg-slate-800 text-slate-100'}`}>
                        {message.text}
                      </div>
                      <div className={`mt-1 flex flex-wrap items-center gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                        {groupedReactions.map(([emoji, count]) => <span key={emoji} className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs">{emoji} {count}</span>)}
                        <div className="flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          {reactions.map((emoji) => <button key={emoji} onClick={() => void handleReaction(message, emoji)} title={`React ${emoji}`} aria-label={`React with ${emoji}`} className={`rounded px-1 py-0.5 text-xs hover:bg-slate-800 ${myReaction === emoji ? 'bg-slate-800' : ''}`}>{emoji}</button>)}
                        </div>
                        {mine && <span title="Sent" className="text-slate-500">{message.createdAt ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messageEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex items-end gap-2 border-t border-slate-800 p-4">
              <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSendMessage(event as unknown as React.FormEvent); } }} rows={1} placeholder="iMessage" className={`${styles.field} max-h-32 resize-y rounded-2xl px-4 py-3`} />
              <button type="submit" disabled={!messageText.trim()} title="Send message" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:bg-slate-700"><Send className="h-4 w-4" /></button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div><MessageCircle className="mx-auto mb-3 h-10 w-10 text-slate-600" /><h3 className="text-base font-semibold text-white">Your conversations</h3><p className="mt-1 max-w-sm text-sm text-slate-400">Add a friend by UID, accept a request, then choose them from your friends list to chat.</p></div>
          </div>
        )}
      </section>

      {(error || notice) && <div className={`fixed bottom-4 right-4 z-50 max-w-md rounded-lg border px-4 py-3 text-sm shadow-xl ${error ? 'border-rose-800 bg-rose-950 text-rose-200' : 'border-emerald-800 bg-emerald-950 text-emerald-200'}`}>{error || notice}<button onClick={() => { setError(''); setNotice(''); }} className="ml-3"><X className="inline h-4 w-4" /></button></div>}

      {isEditingProfile && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveProfile} className="w-full max-w-md space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-white">Profile settings</h2><button type="button" onClick={() => setIsEditingProfile(false)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></div>
            <div className="flex items-center gap-4"><Avatar profile={profile} size="lg" /><label className={`${styles.button} cursor-pointer`}><ImagePlus className="h-4 w-4" />Choose photo<input type="file" accept="image/*" className="hidden" onChange={(event) => handlePhoto(event.target.files?.[0])} /></label></div>
            <div><label htmlFor="nickname" className="mb-1 block text-xs font-medium text-slate-300">Nickname</label><input id="nickname" value={profile.nickname} onChange={(event) => setProfile((current) => ({ ...current, nickname: event.target.value }))} maxLength={40} className={styles.field} /></div>
            <div><div className="mb-1 text-xs font-medium text-slate-300">Unique UID</div><div className="select-all break-all rounded bg-slate-950 p-2 font-mono text-xs text-slate-400">{user.uid}</div></div>
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3"><button type="button" onClick={() => setIsEditingProfile(false)} className={styles.button}>Cancel</button><button disabled={busy} type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">Save profile</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

function FriendRequestRow({ request, onRespond }: { request: FriendRequest; onRespond: (request: FriendRequest, accepted: boolean) => void }) {
  const [sender, setSender] = useState<PublicProfile | null>(null);
  useEffect(() => {
    let alive = true;
    void findPublicProfile(request.fromUid).then((result) => { if (alive) setSender(result); }).catch(() => {});
    return () => { alive = false; };
  }, [request.fromUid]);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
      <div className="mb-2 flex items-center gap-2"><Avatar profile={sender} size="sm" /><div className="min-w-0"><div className="truncate text-xs font-medium text-white">{sender?.nickname || 'Student'}</div><div className="truncate font-mono text-[9px] text-slate-500">{request.fromUid}</div></div></div>
      <div className="flex gap-2"><button onClick={() => onRespond(request, true)} className="flex-1 rounded bg-emerald-700/70 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-700">Accept</button><button onClick={() => onRespond(request, false)} className="flex-1 rounded border border-slate-700 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Decline</button></div>
    </div>
  );
}
