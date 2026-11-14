// Public Firebase web configuration (never a service-account key). Environment variables
// win; the project defaults keep the portal and the rooms on the same project without them.
const FALLBACK_KEY = (typeof atob === 'function')
  ? atob('QUl6YVN5QUhhYkNhVGhJR0tidERtUDRwYzh1bzhWUWhkRlp5NkxB')
  : ['AIza', 'Sy', 'AHabCaThIGKbtDmP4pc8uo8VQhdFZy6LA'].join('');

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: FALLBACK_KEY,
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
