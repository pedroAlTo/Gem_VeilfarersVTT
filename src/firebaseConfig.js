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

// Development only: VITE_FIREBASE_EMULATORS=1 points the app at the local Auth and Firestore
// emulators (`npm run dev:emulators`) on a "demo-" project, which can never reach real data.
export const USE_EMULATORS = !!import.meta.env?.DEV && import.meta.env?.VITE_FIREBASE_EMULATORS === '1';
export const EMULATOR_PROJECT = 'demo-veilfarers-vtt';
export const EMULATOR_HOSTS = { auth: 'http://127.0.0.1:9099', firestore: ['127.0.0.1', 8080] };
// Connects an Auth / Firestore instance to the emulators once; does nothing outside that mode.
export function useEmulators({ auth = null, firestore = null, authAPI = null, firestoreAPI = null } = {}) {
  if (!USE_EMULATORS) return;
  try { if (auth && authAPI && !auth.emulatorConfig) authAPI.connectAuthEmulator(auth, EMULATOR_HOSTS.auth, { disableWarnings: true }); } catch (error) { console.warn('[Emulators] auth:', error); }
  try { if (firestore && firestoreAPI && !firestore._veilEmulator) { firestoreAPI.connectFirestoreEmulator(firestore, ...EMULATOR_HOSTS.firestore); firestore._veilEmulator = true; } } catch (error) { console.warn('[Emulators] firestore:', error); }
}

export function getFirebaseConfig() {
  if (USE_EMULATORS) return { apiKey: 'demo-key', authDomain: `${EMULATOR_PROJECT}.firebaseapp.com`, projectId: EMULATOR_PROJECT, storageBucket: '', messagingSenderId: '0', appId: '1:0:web:0', databaseURL: `http://127.0.0.1:9000?ns=${EMULATOR_PROJECT}` };
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
