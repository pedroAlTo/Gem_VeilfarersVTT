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
export class CloudAccount {
  constructor() {
    this.user = null; this.listeners = new Set(); this.epoch = 0;
    this.firebaseUser = null; this.netlifyUser = null;
    try { this.preferredProvider = localStorage.getItem('veil_auth_provider'); } catch {}
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.user); }
  selectProvider(provider) {
    this.preferredProvider = provider;
    try { localStorage.setItem('veil_auth_provider', provider); } catch {}
  }
  publishUser() {
    if (this.signingOut) return;
    const user = this.preferredProvider === 'netlify'
      ? this.netlifyUser || this.firebaseUser : this.firebaseUser || this.netlifyUser;
    const changed = this.user?.uid !== user?.uid || !!this.user?.isNetlify !== !!user?.isNetlify || this.user?.displayName !== user?.displayName || this.user?.email !== user?.email;
    this.user = user;
    if (changed) { this.epoch++; this.emit(); }
  }
  setFirebaseUser(user, preferred = false) {
    this.firebaseUser = user;
    if (preferred && user) this.selectProvider('firebase');
    this.publishUser();
  }
  async restoreSession() {
    if (LOCAL_ONLY) return;
    // Neither provider's initial signed-out event may erase the other's session.
    const results = await Promise.allSettled([this.initNetlifyIdentity(), ...(cloudConfigured ? [this.init()] : [])]);
    const failed = results.find(r => r.status === 'rejected');
    if (failed && !this.user) throw failed.reason;
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
  setNetlifyUser(user, preferred = true) {
    this.netlifyUser = user ? {
      uid: user.id || user.email,
      email: user.email || '',
      displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Operative',
      isNetlify: true,
      netlifyUser: user
    } : null;
    if (preferred && user) this.selectProvider('netlify');
    this.publishUser();
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
        this.selectProvider('firebase');
        await a.signInWithRedirect(this.auth, provider);
        return null;
      }
      const credential = await a.signInWithPopup(this.auth, provider);
      this.setFirebaseUser(credential.user, true);
      return credential.user;
    }
    return this.signInWithNetlify('google');
  }
  bindNetlifyIdentity(ni) {
    if (this.netlifyIdentity !== ni) {
      for (const [name, fn] of this.netlifyBindings || []) this.netlifyIdentity?.off(name, fn);
      this.netlifyIdentity = ni;
      this.netlifyBindings = [
        ['init', user => this.setNetlifyUser(user, false)],
        ['login', user => this.setNetlifyUser(user, true)],
        ['logout', () => this.setNetlifyUser(null, false)],
      ];
      for (const [name, fn] of this.netlifyBindings) ni.on(name, fn);
      // The script may have completed its automatic init before the app subscribed.
      try { this.setNetlifyUser(ni.currentUser(), false); } catch {}
      try { ni.init(); } catch {}
    }
    try { this.setNetlifyUser(ni.currentUser(), false); } catch {}
    return ni;
  }
  async initNetlifyIdentity() {
    if (typeof window === 'undefined') return null;
    if (window.netlifyIdentity) return this.bindNetlifyIdentity(window.netlifyIdentity);
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return null;
    if (this.netlifyLoading) return this.netlifyLoading;
    this.netlifyLoading = new Promise((resolve) => {
      const ready = () => { clearTimeout(timer); resolve(window.netlifyIdentity ? this.bindNetlifyIdentity(window.netlifyIdentity) : null); };
      const timer = setTimeout(ready, 2000);
      const existing = document.querySelector('script[src*="netlify-identity-widget"]');
      if (existing) {
        existing.addEventListener('load', ready, { once: true });
        existing.addEventListener('error', ready, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
      script.async = true;
      script.onload = ready;
      script.onerror = ready;
      document.head.appendChild(script);
    }).finally(() => { this.netlifyLoading = null; });
    return this.netlifyLoading;
  }
  async signInWithNetlify(provider = '') {
    const ni = await this.initNetlifyIdentity();
    if (!ni) throw new Error('Netlify Identity no está disponible en este entorno.');
    const existing = ni.currentUser();
    if (existing) { this.setNetlifyUser(existing, true); return this.user; }
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => { ni.off('login', onLogin); ni.off('close', onClose); ni.off('error', onError); };
      const onLogin = user => {
        if (settled) return;
        settled = true;
        cleanup();
        this.setNetlifyUser(user);
        try { ni.close(); } catch {}
        resolve(this.user);
      };
      const onClose = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Acceso con Netlify Identity cerrado o cancelado.'));
      };
      const onError = err => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };
      ni.on('login', onLogin);
      ni.on('close', onClose);
      ni.on('error', onError);
      try { ni.open('login'); } catch (error) { onError(error); }
    });
  }
  async resetPassword(email) { await this.init(); await this.authAPI.sendPasswordResetEmail(this.auth, email.trim()); }
  async signOut() {
    if (this.signingOut) return;
    this.signingOut = true;
    try {
      if (this.authAPI && this.auth) await this.authAPI.signOut(this.auth);
      const ni = this.netlifyIdentity || (typeof window !== 'undefined' && window.netlifyIdentity);
      if (ni) await ni.logout();
      this.firebaseUser = null; this.netlifyUser = null;
    } finally { this.signingOut = false; this.publishUser(); }
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
    const cleaned = cleanPreferences(values), uid = await this.identity(), epoch = this.epoch;
    const cacheKey = `veil_user_preferences_${this.user?.isNetlify ? 'netlify' : 'firebase'}_${uid}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cleaned));
      localStorage.setItem('veil_user_preferences_' + uid, JSON.stringify(cleaned));
    } catch {}

    if (this.user?.isNetlify) {
      return;
    }
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
    const cacheKey = `veil_user_preferences_${this.user?.isNetlify ? 'netlify' : 'firebase'}_${uid}`;
    if (this.user?.isNetlify) {
      try {
        const saved = localStorage.getItem(cacheKey) || localStorage.getItem('veil_user_preferences_' + uid);
        return saved ? cleanPreferences(JSON.parse(saved)) : {};
      } catch { return {}; }
    }
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
