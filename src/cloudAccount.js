import { LOCAL_ONLY } from './runtimeMode.js';
import { newId } from './persistence.js';
import { exportNativeCharacter, parseCharacterJSON } from './characterImport.js';
const env = import.meta.env || {};
export const cloudConfig = Object.fromEntries(['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'].map((key, i) => [key, env[['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_APP_ID'][i]] || '']));
export const cloudConfigured = !LOCAL_ONLY && Object.values(cloudConfig).every(Boolean);
export function portableCharacter(token) {
  const data = structuredClone(token);
  for (const key of ['id', 'mapId', 'ownerId', 'controllerIds', 'scenePositions', 'hidden', 'hideName']) delete data[key];
  data.x = 200; data.y = 200;
  return data;
}
export const preferenceKeys = ['userName', 'audioMuted', 'showGrid', 'gridSnap', 'diceTheme', 'dice3d', 'reducedMotion'];
export function cleanPreferences(values) {
  return Object.fromEntries(preferenceKeys.filter(k => k in values).map(k => {
    const v = values[k];
    if (k === 'userName') return [k, String(v).slice(0, 80)];
    if (k === 'diceTheme') return [k, ['crystal', 'panels', 'circuits', 'galaxy'].includes(v) ? v : 'crystal'];
    return [k, !!v];
  }));
}
export class CloudAccount {
  constructor() { this.user = null; this.listeners = new Set(); this.epoch = 0; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.user); }
  async init() {
    if (!cloudConfigured) throw new Error(LOCAL_ONLY ? 'Cloud features are disabled in local test mode.' : 'Firebase setup is required. Follow FIREBASE_SETUP.md, then restart the app.');
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [app, auth, db, storage] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore'), import('firebase/storage')]);
      this.authAPI = auth; this.dbAPI = db; this.storageAPI = storage;
      this.app = app.getApps()[0] || app.initializeApp(cloudConfig);
      this.auth = auth.getAuth(this.app); this.db = db.getFirestore(this.app); this.storage = storage.getStorage(this.app);
      await new Promise(resolve => {
        let first = true;
        auth.onAuthStateChanged(this.auth, user => { this.user = user; this.epoch++; this.emit(); if (first) { first = false; resolve(); } });
      });
      return this;
    })().catch(error => { this.loading = null; throw error; });
    return this.loading;
  }
  async signIn(email, password, { create = false, name = '', remember = true } = {}) {
    await this.init();
    const a = this.authAPI;
    await a.setPersistence(this.auth, remember ? a.browserLocalPersistence : a.browserSessionPersistence);
    const credential = await (create ? a.createUserWithEmailAndPassword : a.signInWithEmailAndPassword)(this.auth, email.trim(), password);
    if (create && name.trim()) { await a.updateProfile(credential.user, { displayName: name.trim().slice(0, 80) }); this.emit(); }
  }
  async resetPassword(email) { await this.init(); await this.authAPI.sendPasswordResetEmail(this.auth, email.trim()); }
  async signOut() { await this.init(); await this.authAPI.signOut(this.auth); }
  async identity() { await this.init(); if (!this.user) throw new Error('Sign in to use your cloud library.'); return this.user.uid; }
  async list(kind) {
    const uid = await this.identity(), epoch = this.epoch, d = this.dbAPI;
    const result = await d.getDocsFromServer(d.collection(this.db, 'users', uid, kind));
    if (epoch !== this.epoch) throw new Error('Account changed. Reopen your library.');
    return result.docs.map(doc => ({ ...doc.data(), id: doc.id })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  async saveCharacter(token) {
    const uid = await this.identity(), d = this.dbAPI;
    const portable = portableCharacter(token), payload = JSON.stringify(exportNativeCharacter(portable));
    if (new TextEncoder().encode(payload).length > 500000) throw new Error('This character exceeds the 500 KB cloud limit. Use a web URL for its portrait.');
    // Each save is a new version; another device cannot silently overwrite an existing sheet.
    const id = newId();
    await d.setDoc(d.doc(this.db, 'users', uid, 'characters', id), { name: token.name.slice(0, 200), payload, updatedAt: Date.now() });
    return id;
  }
  async removeCharacter(id) { const uid = await this.identity(); await this.dbAPI.deleteDoc(this.dbAPI.doc(this.db, 'users', uid, 'characters', id)); }
  decodeCharacter(row) { return portableCharacter(parseCharacterJSON(row.payload).token); }
  async savePreferences(values) {
    const uid = await this.identity(), d = this.dbAPI;
    await d.setDoc(d.doc(this.db, 'users', uid, 'settings', 'preferences'), cleanPreferences(values));
  }
  async loadPreferences() {
    const uid = await this.identity(), epoch = this.epoch, d = this.dbAPI;
    const doc = await d.getDocFromServer(d.doc(this.db, 'users', uid, 'settings', 'preferences'));
    if (epoch !== this.epoch) throw new Error('Account changed.');
    return doc.exists() ? cleanPreferences(doc.data()) : {};
  }
  async uploadScene(file, scene, progress = () => {}) {
    const uid = await this.identity();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('Choose PNG, JPEG or WebP up to 20 MB.');
    const path = `users/${uid}/maps/${newId()}`, s = this.storageAPI, d = this.dbAPI;
    const ref = s.ref(this.storage, path);
    const task = s.uploadBytesResumable(ref, file, { contentType: file.type });
    this.cancelUpload = () => task.cancel();
    try {
      await new Promise((resolve, reject) => { task.on('state_changed', snap => progress(Math.round(100 * snap.bytesTransferred / snap.totalBytes)), reject, resolve); });
      if (this.user?.uid !== uid) throw new Error('Account changed during upload.');
      const imageUrl = await s.getDownloadURL(ref);
      const data = { ...scene, imageUrl, storagePath: path, updatedAt: Date.now() };
      await d.setDoc(d.doc(this.db, 'users', uid, 'scenes', newId()), data);
      return data;
    } catch (error) {
      // Do not leave an unlisted orphan after a failed metadata write.
      await s.deleteObject(ref).catch(() => {});
      throw error;
    } finally { this.cancelUpload = null; }
  }
}
export const account = new CloudAccount();
