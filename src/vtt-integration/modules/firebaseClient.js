import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAHabCaThIGKbtDmP4pc8uo8VQhdFZy6LA',
  authDomain: 'veilfarers-vtt.firebaseapp.com',
  projectId: 'veilfarers-vtt',
  storageBucket: 'veilfarers-vtt.firebasestorage.app',
  messagingSenderId: '480141496542',
  appId: '1:480141496542:web:4bdd93f4016e228515324f',
  databaseURL: 'https://veilfarers-vtt-default-rtdb.firebaseio.com'
};

export function getFirebaseConfig() {
  return {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
    databaseURL: import.meta.env?.VITE_FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_CONFIG.databaseURL
  };
}

let appInstance = null;
let authInstance = null;
let dbInstance = null;

export function initFirebase() {
  if (appInstance) return appInstance;
  try {
    const existing = getApps();
    if (existing.length > 0) {
      appInstance = existing[0];
    } else {
      const config = getFirebaseConfig();
      if (config.apiKey && config.projectId) {
        appInstance = initializeApp(config);
        console.log('[Veilfarers Firebase] App inicializada con éxito para proyecto:', config.projectId);
      }
    }
  } catch (err) {
    console.warn('[Veilfarers Firebase] Error al inicializar Firebase App:', err);
  }
  return appInstance;
}

export function getFirebaseAuthInstance() {
  const app = initFirebase();
  if (!app) return null;
  if (!authInstance) {
    try {
      authInstance = getAuth(app);
    } catch (err) {
      console.warn('[Veilfarers Firebase] Error obteniendo getAuth():', err);
    }
  }
  return authInstance;
}

export function getFirebaseDatabaseInstance() {
  const app = initFirebase();
  if (!app) return null;
  if (!dbInstance) {
    try {
      dbInstance = getDatabase(app);
    } catch (err) {
      console.warn('[Veilfarers Firebase] Error obteniendo getDatabase():', err);
    }
  }
  return dbInstance;
}
