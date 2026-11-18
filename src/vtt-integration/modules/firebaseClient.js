import { initializeApp, getApps } from 'firebase/app';
import * as authAPI from 'firebase/auth';
const { getAuth } = authAPI;
import * as databaseAPI from 'firebase/database';

import { DEFAULT_FIREBASE_CONFIG, getFirebaseConfig, useEmulators, realtimeDatabase } from '../../firebaseConfig.js';
export { DEFAULT_FIREBASE_CONFIG, getFirebaseConfig };

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
      useEmulators({ auth: authInstance, authAPI });
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
      dbInstance = realtimeDatabase(app, databaseAPI);
    } catch (err) {
      console.warn('[Veilfarers Firebase] Error obteniendo getDatabase():', err);
    }
  }
  return dbInstance;
}
