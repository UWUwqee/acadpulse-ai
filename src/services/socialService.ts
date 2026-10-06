import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { ChatConversation, ChatMessage, FriendRequest, Friendship, PublicProfile } from '../types';
import { db } from './firebase';

const profiles = collection(db, 'public_profiles');
const requests = collection(db, 'friend_requests');
const friendships = collection(db, 'friendships');
const conversations = collection(db, 'conversations');

export function pairId(firstUid: string, secondUid: string) {
  return [firstUid, secondUid].sort().join('_');
}

export async function ensurePublicProfile(uid: string, nickname: string) {
  const profileRef = doc(profiles, uid);
  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) {
    await setDoc(profileRef, {
      uid,
      nickname: nickname.trim() || 'Student',
      photoBase64: '',
      updatedAt: new Date().toISOString(),
    } satisfies PublicProfile);
  }
}

export async function savePublicProfile(profile: PublicProfile) {
  await setDoc(doc(profiles, profile.uid), profile, { merge: true });
}

export async function findPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snapshot = await getDoc(doc(profiles, uid.trim()));
  return snapshot.exists() ? (snapshot.data() as PublicProfile) : null;
}

export function subscribePublicProfile(uid: string, listener: (profile: PublicProfile | null) => void): Unsubscribe {
  return onSnapshot(doc(profiles, uid), (snapshot) => {
    listener(snapshot.exists() ? snapshot.data() as PublicProfile : null);
  });
}

export function subscribeFriendRequests(uid: string, listener: (items: FriendRequest[]) => void): Unsubscribe {
  const friendRequestQuery = query(requests, where('toUid', '==', uid));
  return onSnapshot(friendRequestQuery, (snapshot) => {
    listener(snapshot.docs
      .map((item) => ({ id: item.id, ...(item.data() as Omit<FriendRequest, 'id'>) }))
      .filter((item) => item.status === 'pending'));
  });
}

export function subscribeFriendships(uid: string, listener: (items: Friendship[]) => void): Unsubscribe {
  const friendshipQuery = query(friendships, where('participants', 'array-contains', uid));
  return onSnapshot(friendshipQuery, (snapshot) => {
    listener(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Friendship, 'id'>) })));
  });
}

export async function sendFriendRequest(fromUid: string, toUid: string) {
  if (!toUid || fromUid === toUid) throw new Error('Enter another user’s UID.');
  const [friendshipsSnapshot, outgoingRequestsSnapshot] = await Promise.all([
    getDocs(query(friendships, where('participants', 'array-contains', fromUid))),
    getDocs(query(requests, where('fromUid', '==', fromUid))),
  ]);
  if (friendshipsSnapshot.docs.some((item) => (item.data().participants as string[]).includes(toUid))) {
    throw new Error('You are already friends.');
  }
  if (outgoingRequestsSnapshot.docs.some((item) => item.data().toUid === toUid && item.data().status === 'pending')) {
    throw new Error('A friend request is already pending.');
  }

  await addDoc(requests, {
    fromUid,
    toUid,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function respondToFriendRequest(request: FriendRequest, accepted: boolean) {
  await runTransaction(db, async (transaction) => {
    const requestRef = doc(requests, request.id);
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists() || requestSnapshot.data().status !== 'pending') {
      throw new Error('This friend request is no longer pending.');
    }

    transaction.update(requestRef, { status: accepted ? 'accepted' : 'rejected' });
    if (accepted) {
      const friendshipId = pairId(request.fromUid, request.toUid);
      transaction.set(doc(friendships, friendshipId), {
        participants: [request.fromUid, request.toUid].sort(),
        status: 'accepted',
        requestId: request.id,
        createdAt: serverTimestamp(),
      });
    }
  });
}

export async function ensureConversation(currentUid: string, friendUid: string) {
  const id = pairId(currentUid, friendUid);
  const conversationRef = doc(conversations, id);
  const friendship = await getDoc(doc(friendships, id));
  if (!friendship.exists()) throw new Error('You can only start chats with accepted friends.');

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(conversationRef);
    if (!existing.exists()) {
      transaction.set(conversationRef, {
        participants: [currentUid, friendUid].sort(),
        lastMessage: '',
        lastMessageSender: '',
        updatedAt: serverTimestamp(),
      });
    }
  });
  return id;
}

export function subscribeConversations(uid: string, listener: (items: ChatConversation[]) => void): Unsubscribe {
  const conversationQuery = query(conversations, where('participants', 'array-contains', uid));
  return onSnapshot(conversationQuery, (snapshot) => {
    listener(snapshot.docs
      .map((item) => ({ id: item.id, ...(item.data() as Omit<ChatConversation, 'id'>) }))
      .sort((first, second) => timestampMillis(second.updatedAt) - timestampMillis(first.updatedAt)));
  });
}

export function subscribeMessages(conversationId: string, listener: (items: ChatMessage[]) => void): Unsubscribe {
  const messagesQuery = query(
    collection(db, 'conversations', conversationId, 'messages')
  );
  return onSnapshot(messagesQuery, (snapshot) => {
    listener(snapshot.docs
      .map((item) => ({ id: item.id, ...(item.data() as Omit<ChatMessage, 'id'>) }))
      .sort((first, second) => timestampMillis(first.createdAt) - timestampMillis(second.createdAt)));
  });
}

export async function sendChatMessage(conversationId: string, senderUid: string, text: string) {
  const normalizedText = text.trim();
  if (!normalizedText) return;
  const conversationRef = doc(conversations, conversationId);
  const messageRef = doc(collection(conversationRef, 'messages'));
  const batch = writeBatch(db);
  batch.set(messageRef, { senderUid, text: normalizedText, reactions: {}, createdAt: serverTimestamp() });
  batch.update(conversationRef, {
    lastMessage: normalizedText,
    lastMessageSender: senderUid,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function toggleMessageReaction(
  conversationId: string,
  messageId: string,
  uid: string,
  emoji: string,
) {
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  await runTransaction(db, async (transaction) => {
    const message = await transaction.get(messageRef);
    if (!message.exists()) throw new Error('Message no longer exists.');
    const existingReactions = (message.data().reactions || {}) as Record<string, string>;
    const myReaction = existingReactions[uid];
    const nextReactions = { ...existingReactions };
    if (myReaction === emoji) delete nextReactions[uid];
    else nextReactions[uid] = emoji;
    transaction.update(messageRef, {
      reactions: nextReactions,
    });
  });
}

function timestampMillis(timestamp: unknown): number {
  if (!timestamp || typeof timestamp !== 'object') return 0;
  const value = timestamp as { toMillis?: () => number; seconds?: number };
  if (typeof value.toMillis === 'function') return value.toMillis();
  return typeof value.seconds === 'number' ? value.seconds * 1000 : 0;
}
