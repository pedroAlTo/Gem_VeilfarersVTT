import { LOCAL_ONLY } from './runtimeMode.js';
import { newId } from './persistence.js';
import { exportNativeCharacter, parseCharacterJSON } from './characterImport.js';
const env = import.meta.env || {};
export const cloudConfig = Object.fromEntries(['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'].map((key, i) => [key, env[['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_APP_ID'][i]] || '']));
export const cloudConfigured = !LOCAL_ONLY && ['apiKey', 'authDomain', 'projectId'].every(k => Boolean(cloudConfig[k]));
export const storageConfigured = cloudConfigured && Boolean(cloudConfig.storageBucket);
export function portableCharacter(token) {
  const data = structuredClone(token);
  for (const key of ['id', 'mapId', 'ownerId', 'controllerIds', 'scenePositions', 'hidden', 'hideName']) delete data[key];
  data.x = 200; data.y = 200;
  return data;
}
export const preferenceKeys = [
  'userName', 'audioMuted', 'showGrid', 'gridSnap', 'snapToGrid',
  'snapToAnchors', 'snapToObjects', 'diceTheme', 'dice3d', 'reducedMotion',
  'gmVision', 'fogOfWar', 'fogExploredOpacity', 'claimedTokenId'
];
export function cleanPreferences(values = {}) {
  if (!values || typeof values !== 'object') return {};
  return Object.fromEntries(preferenceKeys.filter(k => k in values).map(k => {
    const v = values[k];
    if (k === 'userName') return [k, String(v || '').slice(0, 80)];
    if (k === 'diceTheme') return [k, ['crystal', 'panels', 'circuits', 'galaxy'].includes(v) ? v : 'crystal'];
    if (k === 'fogExploredOpacity') return [k, typeof v === 'number' ? Math.max(0.05, Math.min(0.95, v)) : 0.5];
    if (k === 'claimedTokenId') return [k, v ? String(v) : null];
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
      const imports = [import('firebase/app'), import('firebase/auth'), import('firebase/firestore')];
      if (storageConfigured) imports.push(import('firebase/storage').catch(() => null));
      const [app, auth, db, storage] = await Promise.all(imports);
      this.authAPI = auth; this.dbAPI = db; this.storageAPI = storage;
      this.app = app.getApps()[0] || app.initializeApp(cloudConfig);
      this.auth = auth.getAuth(this.app); this.db = db.getFirestore(this.app);
      if (storage) {
        try { this.storage = storage.getStorage(this.app); } catch { this.storage = null; }
      } else {
        this.storage = null;
      }
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
  async signInWithGoogle() {
    if (cloudConfigured) {
      try {
        await this.init();
        const a = this.authAPI;
        const provider = new a.GoogleAuthProvider();
        const credential = await a.signInWithPopup(this.auth, provider);
        return credential.user;
      } catch (err) {
        if (!err.message?.includes('popup-closed-by-user')) {
          // If Firebase Google popup fails or is disabled in console, attempt Netlify Identity
          return this.signInWithNetlify('google');
        }
        throw err;
      }
    }
    return this.signInWithNetlify('google');
  }
  async initNetlifyIdentity() {
    if (typeof window === 'undefined') return null;
    if (window.netlifyIdentity) return window.netlifyIdentity;

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="netlify-identity-widget"]');
      if (existing) {
        existing.addEventListener('load', () => {
          if (window.netlifyIdentity) {
            window.netlifyIdentity.init();
            resolve(window.netlifyIdentity);
          }
        });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
      script.async = true;
      script.onload = () => {
        if (window.netlifyIdentity) {
          window.netlifyIdentity.init();
          resolve(window.netlifyIdentity);
        } else {
          reject(new Error('Netlify Identity could not be initialized.'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Netlify Identity script.'));
      document.head.appendChild(script);
    });
  }
  async signInWithNetlify(provider = 'google') {
    const ni = await this.initNetlifyIdentity();
    if (!ni) throw new Error('Netlify Identity is not available in this environment.');
    return new Promise((resolve, reject) => {
      const onLogin = user => {
        this.user = {
          uid: user.id || user.email || 'netlify_' + Date.now(),
          email: user.email || '',
          displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Operative',
          isNetlify: true,
          netlifyUser: user
        };
        this.epoch++;
        this.emit();
        try { ni.close(); } catch {}
        resolve(this.user);
      };
      ni.on('login', onLogin);
      ni.on('error', err => reject(err));
      ni.open(provider ? 'login' : undefined);
    });
  }
  async resetPassword(email) { await this.init(); await this.authAPI.sendPasswordResetEmail(this.auth, email.trim()); }
  async signOut() {
    if (this.user?.isNetlify && typeof window !== 'undefined' && window.netlifyIdentity) {
      try { window.netlifyIdentity.logout(); } catch {}
    }
    this.user = null;
    this.epoch++;
    this.emit();
    if (this.authAPI && this.auth) {
      try { await this.authAPI.signOut(this.auth); } catch {}
    }
  }
  async identity() {
    if (this.user?.isNetlify) return this.user.uid;
    await this.init();
    if (!this.user) throw new Error('Sign in to use your cloud library.');
    return this.user.uid;
  }
  async list(kind) {
    if (this.user?.isNetlify) {
      try {
        const stored = localStorage.getItem(`veil_${kind}_${this.user.uid}`);
        return stored ? JSON.parse(stored) : [];
      } catch { return []; }
    }
    const uid = await this.identity(), epoch = this.epoch, d = this.dbAPI;
    const result = await d.getDocsFromServer(d.collection(this.db, 'users', uid, kind));
    if (epoch !== this.epoch) throw new Error('Account changed. Reopen your library.');
    return result.docs.map(doc => ({ ...doc.data(), id: doc.id })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  async saveCharacter(token) {
    const uid = await this.identity();
    const portable = portableCharacter(token), payload = JSON.stringify(exportNativeCharacter(portable));
    if (new TextEncoder().encode(payload).length > 500000) throw new Error('This character exceeds the 500 KB cloud limit. Use a web URL for its portrait.');
    const id = newId();
    const entry = { id, name: token.name.slice(0, 200), payload, updatedAt: Date.now() };

    if (this.user?.isNetlify) {
      try {
        const list = await this.list('characters');
        list.unshift(entry);
        localStorage.setItem(`veil_characters_${uid}`, JSON.stringify(list));
      } catch {}
      return id;
    }

    const d = this.dbAPI;
    await d.setDoc(d.doc(this.db, 'users', uid, 'characters', id), entry);
    return id;
  }
  async removeCharacter(id) {
    const uid = await this.identity();
    if (this.user?.isNetlify) {
      try {
        const list = (await this.list('characters')).filter(c => c.id !== id);
        localStorage.setItem(`veil_characters_${uid}`, JSON.stringify(list));
      } catch {}
      return;
    }
    await this.dbAPI.deleteDoc(this.dbAPI.doc(this.db, 'users', uid, 'characters', id));
  }
  decodeCharacter(row) { return portableCharacter(parseCharacterJSON(row.payload).token); }
  async savePreferences(values) {
    const cleaned = cleanPreferences(values);
    try {
      localStorage.setItem('veil_user_preferences', JSON.stringify(cleaned));
    } catch {}
    if (this.user?.isNetlify) {
      try {
        localStorage.setItem('veil_user_preferences_' + this.user.uid, JSON.stringify(cleaned));
      } catch {}
      return;
    }
    const uid = await this.identity(), d = this.dbAPI;
    await d.setDoc(d.doc(this.db, 'users', uid, 'settings', 'preferences'), cleaned);
  }
  async loadPreferences() {
    if (this.user?.isNetlify) {
      try {
        const saved = localStorage.getItem('veil_user_preferences_' + this.user.uid) || localStorage.getItem('veil_user_preferences');
        return saved ? cleanPreferences(JSON.parse(saved)) : {};
      } catch { return {}; }
    }
    try {
      const uid = await this.identity(), epoch = this.epoch, d = this.dbAPI;
      const doc = await d.getDocFromServer(d.doc(this.db, 'users', uid, 'settings', 'preferences'));
      if (epoch !== this.epoch) throw new Error('Account changed.');
      return (doc && typeof doc.exists === 'function' && doc.exists()) ? cleanPreferences(doc.data() || {}) : {};
    } catch {
      try {
        const saved = localStorage.getItem('veil_user_preferences');
        return saved ? cleanPreferences(JSON.parse(saved)) : {};
      } catch { return {}; }
    }
  }
  async uploadScene(file, scene, progress = () => {}) {
    const uid = await this.identity();
    if (!this.storageAPI || (!this.storage && !this.storageAPI.ref)) {
      throw new Error('Firebase Storage no está configurado. Desmarca la opción para usar la imagen en local o mediante URL.');
    }
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
