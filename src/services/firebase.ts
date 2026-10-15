import { initializeApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { ChatMessage, RoomState, VTTUser, Player } from '../types/vtt';

// Retrieve config from Vite environment variables or localStorage override
export function getFirebaseConfig() {
  const localConfigStr = typeof window !== 'undefined' ? localStorage.getItem('VEILFARERS_FIREBASE_CONFIG') : null;
  if (localConfigStr) {
    try {
      return JSON.parse(localConfigStr);
    } catch {
      // ignore
    }
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId && cfg.apiKey !== 'your_api_key_here');
}

export function saveFirebaseConfig(cfg: Record<string, string>) {
  localStorage.setItem('VEILFARERS_FIREBASE_CONFIG', JSON.stringify(cfg));
  window.location.reload();
}

let app: FirebaseApp | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: Firestore | null = null;
const googleProvider = new GoogleAuthProvider();

export function initFirebase() {
  if (!isFirebaseConfigured()) {
    return { app: null, auth: null, db: null };
  }

  if (!getApps().length) {
    try {
      app = initializeApp(getFirebaseConfig());
      auth = getAuth(app);
      db = getFirestore(app);
    } catch (err) {
      console.warn('Firebase initialization error:', err);
    }
  } else {
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  }

  return { app, auth, db };
}

// Initialise on module load
initFirebase();

/* ================= AUTHENTICATION ================= */

export async function loginWithGoogle(): Promise<VTTUser> {
  const { auth: currentAuth } = initFirebase();
  if (!currentAuth) {
    // Demo Mock fallback
    const mockUser: VTTUser = {
      uid: 'demo-user-' + Math.floor(Math.random() * 1000),
      displayName: 'Veil Wanderer',
      email: 'wanderer@veilfarers.realm',
      photoURL: null,
      isAnonymous: false,
    };
    localStorage.setItem('VEILFARERS_MOCK_USER', JSON.stringify(mockUser));
    return mockUser;
  }

  try {
    const cred = await signInWithPopup(currentAuth, googleProvider);
    return {
      uid: cred.user.uid,
      displayName: cred.user.displayName || 'Veilfarer',
      email: cred.user.email,
      photoURL: cred.user.photoURL,
      isAnonymous: cred.user.isAnonymous,
    };
  } catch (error) {
    console.error('Google Sign-in failed:', error);
    throw error;
  }
}

export async function loginAsGuest(name: string = 'Guest Explorer'): Promise<VTTUser> {
  const { auth: currentAuth } = initFirebase();
  if (!currentAuth) {
    const mockUser: VTTUser = {
      uid: 'guest-' + Math.floor(Math.random() * 10000),
      displayName: name,
      email: null,
      photoURL: null,
      isAnonymous: true,
    };
    localStorage.setItem('VEILFARERS_MOCK_USER', JSON.stringify(mockUser));
    return mockUser;
  }

  try {
    const cred = await signInAnonymously(currentAuth);
    return {
      uid: cred.user.uid,
      displayName: name,
      email: null,
      photoURL: null,
      isAnonymous: true,
    };
  } catch (err) {
    console.warn('Guest sign-in fallback:', err);
    const mockUser: VTTUser = {
      uid: 'guest-' + Date.now(),
      displayName: name,
      email: null,
      photoURL: null,
      isAnonymous: true,
    };
    return mockUser;
  }
}

export async function logoutUser(): Promise<void> {
  const { auth: currentAuth } = initFirebase();
  if (currentAuth) {
    await firebaseSignOut(currentAuth);
  }
  localStorage.removeItem('VEILFARERS_MOCK_USER');
}

export function subscribeToAuth(callback: (user: VTTUser | null) => void): () => void {
  const { auth: currentAuth } = initFirebase();

  if (!currentAuth) {
    // Check mock user in localStorage
    const saved = localStorage.getItem('VEILFARERS_MOCK_USER');
    if (saved) {
      try {
        callback(JSON.parse(saved));
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
    return () => {};
  }

  return onAuthStateChanged(currentAuth, (user: FirebaseUser | null) => {
    if (user) {
      callback({
        uid: user.uid,
        displayName: user.displayName || 'Veilfarer',
        email: user.email,
        photoURL: user.photoURL,
        isAnonymous: user.isAnonymous,
      });
    } else {
      callback(null);
    }
  });
}

/* ================= FIRESTORE ROOM SYNC ================= */

export function subscribeToRoom(
  roomId: string,
  onUpdate: (state: Partial<RoomState>) => void
): () => void {
  const { db: currentDb } = initFirebase();

  if (!currentDb) {
    // LocalStorage fallback for demo/offline play
    const key = `VEILFARERS_ROOM_${roomId}`;
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          onUpdate(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  const roomRef = doc(currentDb, 'rooms', roomId);
  return onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data() as Partial<RoomState>);
    }
  });
}

export async function updateRoomState(roomId: string, partial: Partial<RoomState>): Promise<void> {
  const { db: currentDb } = initFirebase();

  if (!currentDb) {
    const key = `VEILFARERS_ROOM_${roomId}`;
    const existing = localStorage.getItem(key);
    const parsed = existing ? JSON.parse(existing) : {};
    const updated = { ...parsed, ...partial };
    localStorage.setItem(key, JSON.stringify(updated));
    return;
  }

  const roomRef = doc(currentDb, 'rooms', roomId);
  await setDoc(roomRef, partial, { merge: true });
}

/* ================= CHAT & DICE ROLL MESSAGES ================= */

export function subscribeToMessages(
  roomId: string,
  onMessages: (msgs: ChatMessage[]) => void
): () => void {
  const { db: currentDb } = initFirebase();

  if (!currentDb) {
    const key = `VEILFARERS_MSGS_${roomId}`;
    const readLocal = () => {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          onMessages(JSON.parse(stored));
        } catch {}
      }
    };
    readLocal();
    const handler = (e: StorageEvent) => {
      if (e.key === key) readLocal();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  const msgsRef = collection(currentDb, 'rooms', roomId, 'messages');
  const q = query(msgsRef, orderBy('timestamp', 'asc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const list: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...(doc.data() as Omit<ChatMessage, 'id'>) });
    });
    onMessages(list);
  });
}

export async function sendChatMessage(roomId: string, msg: Omit<ChatMessage, 'id'>): Promise<void> {
  const { db: currentDb } = initFirebase();

  if (!currentDb) {
    const key = `VEILFARERS_MSGS_${roomId}`;
    const existing = localStorage.getItem(key);
    const list: ChatMessage[] = existing ? JSON.parse(existing) : [];
    const newMsg: ChatMessage = {
      ...msg,
      id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    };
    list.push(newMsg);
    // keep last 100
    if (list.length > 100) list.shift();
    localStorage.setItem(key, JSON.stringify(list));
    // trigger storage event in current window as well
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(list) }));
    return;
  }

  const msgsRef = collection(currentDb, 'rooms', roomId, 'messages');
  await addDoc(msgsRef, {
    ...msg,
    timestamp: Date.now(),
    serverTimestamp: serverTimestamp(),
  });
}

/* ================= PLAYER PRESENCE ================= */

export function subscribeToPlayers(
  roomId: string,
  onPlayers: (players: Player[]) => void
): () => void {
  const { db: currentDb } = initFirebase();

  if (!currentDb) {
    const key = `VEILFARERS_PLAYERS_${roomId}`;
    const read = () => {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          onPlayers(JSON.parse(stored));
        } catch {}
      }
    };
    read();
    const handler = (e: StorageEvent) => {
      if (e.key === key) read();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  const playersRef = collection(currentDb, 'rooms', roomId, 'players');
  return onSnapshot(playersRef, (snapshot) => {
    const list: Player[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...(doc.data() as Omit<Player, 'id'>) });
    });
    onPlayers(list);
  });
}

export async function setPlayerPresence(roomId: string, player: Player): Promise<void> {
  const { db: currentDb } = initFirebase();

  if (!currentDb) {
    const key = `VEILFARERS_PLAYERS_${roomId}`;
    const existing = localStorage.getItem(key);
    let list: Player[] = existing ? JSON.parse(existing) : [];
    list = list.filter((p) => p.id !== player.id);
    list.push(player);
    localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(list) }));
    return;
  }

  const playerRef = doc(currentDb, 'rooms', roomId, 'players', player.id);
  await setDoc(playerRef, {
    ...player,
    lastSeen: Date.now(),
  }, { merge: true });
}
