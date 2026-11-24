import { LOCAL_ONLY } from './runtimeMode.js';
import { newId } from './persistence.js';
import { exportNativeCharacter, parseCharacterJSON, characterKey } from './characterImport.js';
import { noteEntry, gameEntry } from './accountModel.js';
import { getFirebaseConfig, useEmulators, realtimeDatabase } from './firebaseConfig.js';
// The portal signs in with getFirebaseConfig(); the account and the rooms must use the very
// same project, or a signed-in user would see no rooms. Outside the Vite build (tests, scripts)
// there is no environment, and the cloud stays off unless it is configured explicitly.
const env = import.meta.env;
export const cloudConfig = env ? getFirebaseConfig() : { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', databaseURL: '' };
export const cloudConfigured = !LOCAL_ONLY && ['apiKey', 'authDomain', 'projectId'].every(k => Boolean(cloudConfig[k]));
export const storageConfigured = cloudConfigured && Boolean(cloudConfig.storageBucket);
export function portableCharacter(token) {
  const data = structuredClone(token);
  for (const key of ['id', 'mapId', 'ownerId', 'controllerIds', 'scenePositions', 'hidden', 'hideName']) delete data[key];
  data.x = 200; data.y = 200;
  for (const k of ['species', 'community', 'characterClass', 'subclass', 'roleTag', 'path', 'damageExpression', 'attackRange', 'featureNotes']) {
    if (data[k] == null) delete data[k];
    else if (typeof data[k] !== 'string') data[k] = String(data[k]);
  }
  return data;
}
export const preferenceKeys = [
  'userName', 'audioMuted', 'showGrid', 'gridSnap', 'snapToGrid',
  'snapToAnchors', 'snapToObjects', 'diceTheme', 'dice3d', 'reducedMotion',
  'fogOfWar', 'fogExploredOpacity'
];
export function cleanPreferences(values = {}) {
  if (!values || typeof values !== 'object') return {};
  return Object.fromEntries(preferenceKeys.filter(k => k in values).map(k => {
    const v = values[k];
    if (k === 'userName') return [k, String(v || '').slice(0, 80)];
    if (k === 'diceTheme') return [k, ['crystal', 'panels', 'circuits', 'galaxy'].includes(v) ? v : 'crystal'];
    if (k === 'fogExploredOpacity') return [k, typeof v === 'number' ? Math.max(0.05, Math.min(0.95, v)) : 0.5];
    return [k, !!v];
  }));
}
// Saves the cloud refused, kept in this browser apart from the cloud cache (v2.31.2).
const localOnlyKey = (kind, uid) => `veil_${kind}_${uid}_local`;
function readLocalOnly(kind, uid) {
  try { const rows = JSON.parse(localStorage.getItem(localOnlyKey(kind, uid)) || '[]'); return Array.isArray(rows) ? rows : []; } catch { return []; }
}
function writeLocalOnly(kind, uid, rows) {
  try { if (rows.length) localStorage.setItem(localOnlyKey(kind, uid), JSON.stringify(rows)); else localStorage.removeItem(localOnlyKey(kind, uid)); } catch {}
}

export class CloudAccount {
  constructor() {
    this.user = null; this.listeners = new Set(); this.epoch = 0;
    this.firebaseUser = null;
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.user); }
  publishUser() {
    if (this.signingOut) return;
    const user = this.firebaseUser;
    const changed = this.user?.uid !== user?.uid || this.user?.displayName !== user?.displayName || this.user?.email !== user?.email;
    this.user = user;
    if (changed) { this.epoch++; this.emit(); }
  }
  setFirebaseUser(user) {
    this.firebaseUser = user;
    this.publishUser();
  }
  async restoreSession() {
    if (LOCAL_ONLY || !cloudConfigured) return;
    await this.init();
  }
  async init() {
    if (!cloudConfigured) throw new Error(LOCAL_ONLY ? 'Cloud features are disabled in local test mode.' : 'Firebase setup is required. Follow FIREBASE_SETUP.md, then restart the app.');
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const imports = [import('firebase/app'), import('firebase/auth'), import('firebase/firestore')];
      if (storageConfigured) imports.push(import('firebase/storage').catch(() => null));
      const [app, auth, db, storage] = await Promise.all(imports);
      this.authAPI = auth; this.dbAPI = db; this.storageAPI = storage;
      this.app = app.getApps()[0] || app.initializeApp(cloudConfig);
      this.auth = auth.getAuth(this.app); this.db = db.getFirestore(this.app);
      useEmulators({ auth: this.auth, authAPI: auth, firestore: this.db, firestoreAPI: db });
      if (storage) {
        try { this.storage = storage.getStorage(this.app); } catch { this.storage = null; }
      } else {
        this.storage = null;
      }
      await new Promise((resolve, reject) => {
        let first = true;
        this.authUnsubscribe?.();
        this.authUnsubscribe = auth.onAuthStateChanged(this.auth, user => { this.setFirebaseUser(user); if (first) { first = false; resolve(); } }, reject);
      });
      try {
        const redirectResult = await auth.getRedirectResult(this.auth);
        if (redirectResult?.user) {
          this.setFirebaseUser(redirectResult.user, true);
        }
      } catch (e) {
        console.warn('Firebase getRedirectResult error:', e);
      }
      return this;
    })().catch(error => { this.loading = null; throw error; });
    return this.loading;
  }
  // Realtime Database (V3): the live channel of online play. It bills by data moved, not by
  // operation, so play no longer spends the Firestore quota. Loaded on demand; null when the
  // project has no database URL or the SDK cannot start (then play stays on Firestore).
  async realtime() {
    if (this.rtdbLoading) return this.rtdbLoading;
    this.rtdbLoading = (async () => {
      await this.init();
      if (!cloudConfig?.databaseURL) return null;
      const api = await import('firebase/database');
      return { api, db: realtimeDatabase(this.app, api) };
    })().catch(error => { console.warn('Realtime Database no disponible:', error); return null; });
    return this.rtdbLoading;
  }
  async signIn(email, password, { create = false, name = '', remember = true } = {}) {
    await this.init();
    const a = this.authAPI;
    await a.setPersistence(this.auth, remember ? a.browserLocalPersistence : a.browserSessionPersistence);
    const credential = await (create ? a.createUserWithEmailAndPassword : a.signInWithEmailAndPassword)(this.auth, email.trim(), password);
    if (create && name.trim()) await a.updateProfile(credential.user, { displayName: name.trim().slice(0, 80) });
    this.setFirebaseUser(credential.user, true);
  }
  async signInWithGoogle(options = {}) {
    const { useRedirect = false, remember = true } = options;
    if (this.authAPI || cloudConfigured) {
      const a = this.authAPI || (await this.init()).authAPI;
      await a.setPersistence(this.auth, remember ? a.browserLocalPersistence : a.browserSessionPersistence);
      const provider = new a.GoogleAuthProvider();
      if (typeof provider.setCustomParameters === 'function') {
        provider.setCustomParameters({ prompt: 'select_account' });
      }
      if (useRedirect) {
        await a.signInWithRedirect(this.auth, provider);
        return null;
      }
      const credential = await a.signInWithPopup(this.auth, provider);
      this.setFirebaseUser(credential.user, true);
      return credential.user;
    }
    throw new Error('El acceso con Google necesita la configuración de Firebase.');
  }
  async resetPassword(email) { await this.init(); await this.authAPI.sendPasswordResetEmail(this.auth, email.trim()); }
  async signOut() {
    if (this.signingOut) return;
    this.signingOut = true;
    try {
      if (this.authAPI && this.auth) await this.authAPI.signOut(this.auth);
      this.firebaseUser = null;
    } finally {
      this.signingOut = false;
      this.publishUser();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('veil:auth-signout'));
      }
    }
  }
  async identity() {
    if (this.user?.uid) return this.user.uid;
    await this.init();
    if (!this.user) {
      if (this.authAPI?.signInAnonymously && this.auth) {
        try {
          const cred = await this.authAPI.signInAnonymously(this.auth);
          this.setFirebaseUser(cred.user, false);
          return cred.user.uid;
        } catch (e) {
          console.warn('Firebase anonymous authentication error:', e);
        }
      }
      throw new Error('Inicia sesión en tu cuenta para acceder a la base de datos de escenas en Firebase.');
    }
    return this.user.uid;
  }
  async list(kind) {
    const uid = await this.identity(), epoch = this.epoch, d = this.dbAPI;
    try {
      const result = await d.getDocsFromServer(d.collection(this.db, 'users', uid, kind));
      if (epoch !== this.epoch) throw new Error('Account changed. Reopen your library.');
      const server = result.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      // Entries that could only be saved in this browser (the cloud refused the write) are kept
      // until the cloud has an entry at least as recent: reading the cloud must not erase them.
      const pending = readLocalOnly(kind, uid).filter(entry => !server.some(row => row.id === entry.id && (row.updatedAt || 0) >= (entry.updatedAt || 0)));
      writeLocalOnly(kind, uid, pending);
      const items = [...server.filter(row => !pending.some(entry => entry.id === row.id)), ...pending.map(entry => ({ ...entry, localOnly: true }))].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      try { localStorage.setItem(`veil_${kind}_${uid}`, JSON.stringify(items)); } catch {}
      return items;
    } catch (err) {
      const isPerm = err?.code === 'permission-denied' || String(err?.message || '').toLowerCase().includes('permission');
      if (isPerm) {
        console.warn(`Firestore permission denied for ${kind}; falling back to local account storage.`);
        try {
          const stored = localStorage.getItem(`veil_${kind}_${uid}`);
          return stored ? JSON.parse(stored) : [];
        } catch { return []; }
      }
      throw err;
    }
  }
  // A cloud write that only reached this browser must never look like a cloud save.
  reportLocalFallback(kind) {
    this.lastSaveTarget = 'local';
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('veil:cloud-fallback', { detail: { kind } }));
  }
  async saveCharacter(token) {
    const uid = await this.identity();
    const portable = portableCharacter(token), payload = JSON.stringify(exportNativeCharacter(portable));
    if (new TextEncoder().encode(payload).length > 500000) throw new Error('This character exceeds the 500 KB cloud limit. Use a web URL for its portrait.');
    // Upsert: saving the same character again replaces its entry instead of duplicating it.
    const key = characterKey(portable).slice(0, 400);
    let existing = null;
    try { existing = (await this.list('characters')).find(c => c.key === key) || null; } catch {}
    const id = existing?.id || newId();
    const entry = { id, key, name: token.name.slice(0, 200), payload, updatedAt: Date.now() };

    try {
      const d = this.dbAPI;
      await d.setDoc(d.doc(this.db, 'users', uid, 'characters', id), entry);
      return id;
    } catch (err) {
      const isPerm = err?.code === 'permission-denied' || String(err?.message || '').toLowerCase().includes('permission');
      if (isPerm) {
        console.warn('Firestore permission denied; saving character locally in account cache.');
        this.reportLocalFallback('characters');
        writeLocalOnly('characters', uid, [entry, ...readLocalOnly('characters', uid).filter(c => c.id !== id)]);
        try {
          const list = (await this.list('characters')).filter(c => c.id !== id);
          list.unshift({ ...entry, localOnly: true });
          localStorage.setItem(`veil_characters_${uid}`, JSON.stringify(list));
        } catch {}
        return id;
      }
      throw err;
    }
  }
  async removeCharacter(id) {
    const uid = await this.identity();
    writeLocalOnly('characters', uid, readLocalOnly('characters', uid).filter(c => c.id !== id));
    try {
      await this.dbAPI.deleteDoc(this.dbAPI.doc(this.db, 'users', uid, 'characters', id));
    } catch (err) {
      const isPerm = err?.code === 'permission-denied' || String(err?.message || '').toLowerCase().includes('permission');
      if (isPerm) {
        try {
          const list = (await this.list('characters')).filter(c => c.id !== id);
          localStorage.setItem(`veil_characters_${uid}`, JSON.stringify(list));
        } catch {}
        return;
      }
      throw err;
    }
  }
  async saveScene(scene, extra = {}) {
    const uid = await this.identity();
    const id = scene.id || newId();
    const entry = {
      id,
      name: (scene.name || 'Escena táctica').slice(0, 200),
      gridSize: Number(scene.gridSize) || 70,
      ambientLight: Number.isFinite(Number(scene.ambientLight)) && scene.ambientLight != null ? Math.min(1, Math.max(0, Number(scene.ambientLight))) : 0.25,
      width: Number(scene.width) || 1920,
      height: Number(scene.height) || 1080,
      imageUrl: scene.imageUrl || '',
      walls: Array.isArray(scene.walls) ? scene.walls : (Array.isArray(extra.walls) ? extra.walls : []),
      lights: Array.isArray(scene.lights) ? scene.lights : (Array.isArray(extra.lights) ? extra.lights : []),
      effects: Array.isArray(scene.effects) ? scene.effects : (Array.isArray(extra.effects) ? extra.effects : []),
      water: Array.isArray(scene.water) ? scene.water : (Array.isArray(extra.water) ? extra.water : []),
      fow: scene.fow !== undefined ? scene.fow : (extra.fow !== undefined ? extra.fow : null),
      notes: Array.isArray(scene.notes) ? scene.notes : (Array.isArray(extra.notes) ? extra.notes : []),
      tokens: Array.isArray(scene.tokens) ? scene.tokens.map(t => portableCharacter(t)) : (Array.isArray(extra.tokens) ? extra.tokens.map(t => portableCharacter(t)) : []),
      arcId: scene.arcId || extra.arcId || null,
      createdAt: scene.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    try {
      const d = this.dbAPI;
      await d.setDoc(d.doc(this.db, 'users', uid, 'scenes', id), entry);
      // Cache as backup
      try {
        const list = (await this.list('scenes')).filter(s => s.id !== id);
        list.unshift(entry);
        localStorage.setItem(`veil_scenes_${uid}`, JSON.stringify(list));
      } catch {}
      return id;
    } catch (err) {
      console.warn('Firestore error in saveScene:', err);
      try {
        const list = (await this.list('scenes')).filter(s => s.id !== id);
        list.unshift(entry);
        localStorage.setItem(`veil_scenes_${uid}`, JSON.stringify(list));
      } catch {}
      throw new Error(`Error al guardar en Firebase Firestore: ${err.message || 'Sin permisos de base de datos'}`);
    }
  }
  async removeScene(id) {
    const uid = await this.identity();
    try {
      await this.dbAPI.deleteDoc(this.dbAPI.doc(this.db, 'users', uid, 'scenes', id));
    } catch (err) {
      console.warn('Firestore removeScene fallback to local storage:', err);
      try {
        const list = (await this.list('scenes')).filter(s => s.id !== id);
        localStorage.setItem(`veil_scenes_${uid}`, JSON.stringify(list));
      } catch {}
    }
  }
  // Personal notes: private to this account and grouped by room.
  async listNotes(roomId) { return (await this.list('notes')).filter(n => n.roomId === roomId); }
  async cacheNotes(uid, change) {
    try { localStorage.setItem(`veil_notes_${uid}`, JSON.stringify(change(await this.list('notes')))); } catch {}
  }
  async saveNote(roomId, note) {
    const uid = await this.identity(), entry = noteEntry(roomId, note);
    const local = () => this.cacheNotes(uid, list => [entry, ...list.filter(n => n.id !== entry.id)]);
    try {
      await this.dbAPI.setDoc(this.dbAPI.doc(this.db, 'users', uid, 'notes', entry.id), entry);
    } catch (err) {
      if (err?.code !== 'permission-denied') throw err;
      this.reportLocalFallback('notes'); await local();
    }
    return entry;
  }
  async removeNote(id) {
    const uid = await this.identity();
    const local = () => this.cacheNotes(uid, list => list.filter(n => n.id !== id));
    try { await this.dbAPI.deleteDoc(this.dbAPI.doc(this.db, 'users', uid, 'notes', id)); }
    catch (err) { if (err?.code !== 'permission-denied') throw err; await local(); }
  }
  // Per-game record, written by the table while playing. Without the published rule it stays
  // in this browser, quietly: it is a convenience, not something to warn about on every change.
  async saveGame(roomId, data) {
    const uid = await this.identity(), entry = gameEntry(roomId, data);
    try { await this.dbAPI.setDoc(this.dbAPI.doc(this.db, 'users', uid, 'games', entry.roomId), entry); }
    catch (err) {
      if (err?.code !== 'permission-denied') throw err;
      try {
        const key = `veil_games_${uid}`, list = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([entry, ...list.filter(g => g.roomId !== entry.roomId)]));
      } catch {}
    }
    return entry;
  }
  decodeCharacter(row) { return portableCharacter(parseCharacterJSON(row.payload).token); }
  async savePreferences(values) {
    const cleaned = cleanPreferences(values), uid = await this.identity(), epoch = this.epoch;
    const cacheKey = `veil_user_preferences_firebase_${uid}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cleaned));
      localStorage.setItem('veil_user_preferences_' + uid, JSON.stringify(cleaned));
    } catch {}

    const d = this.dbAPI;
    try {
      await d.setDoc(d.doc(this.db, 'users', uid, 'settings', 'preferences'), cleaned);
    } catch (err) {
      const isPermError = err.code === 'permission-denied' || String(err.message || '').includes('permissions');
      if (isPermError) {
        try {
          const coreKeys = ['userName', 'audioMuted', 'showGrid', 'gridSnap', 'diceTheme', 'dice3d', 'reducedMotion'];
          const coreOnly = Object.fromEntries(coreKeys.filter(k => k in cleaned).map(k => [k, cleaned[k]]));
          await d.setDoc(d.doc(this.db, 'users', uid, 'settings', 'preferences'), coreOnly);
          return;
        } catch (innerErr) {
          console.warn('Cloud preferences sync skipped; parameters saved in local cache.', innerErr);
          return;
        }
      }
      throw err;
    }
    if (epoch !== this.epoch) throw new Error('Account changed. Reopen your preferences.');
  }
  async loadPreferences() {
    const uid = await this.identity(), epoch = this.epoch;
    const cacheKey = `veil_user_preferences_firebase_${uid}`;
    try {
      const d = this.dbAPI;
      const doc = await d.getDocFromServer(d.doc(this.db, 'users', uid, 'settings', 'preferences'));
      if (epoch !== this.epoch) throw new Error('Account changed.');
      const values = (doc && typeof doc.exists === 'function' && doc.exists()) ? cleanPreferences(doc.data() || {}) : {};
      try { localStorage.setItem(cacheKey, JSON.stringify(values)); } catch {}
      return values;
    } catch {
      if (epoch !== this.epoch) throw new Error('Account changed.');
      try {
        const saved = localStorage.getItem(cacheKey);
        return saved ? cleanPreferences(JSON.parse(saved)) : {};
      } catch { return {}; }
    }
  }
  async uploadScene(file, scene, progress = () => {}) {
    const uid = await this.identity();
    if (!this.storageAPI || (!this.storage && !this.storageAPI.ref)) {
      throw new Error('Firebase Storage no está configurado. Desmarca la opción para usar la imagen en local o mediante URL.');
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 50 * 1024 * 1024) throw new Error('Elige una imagen PNG, JPEG o WebP de hasta 50 MB.');
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
