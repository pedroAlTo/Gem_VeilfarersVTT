import { account, cleanPreferences } from './cloudAccount.js';
import { store } from './state.js';
import { audio } from './audioEngine.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, sanitizeHTML, notify, confirmAction } from './ui.js';
import { openCharacterImport } from './characterManager.js';
import { network } from './networkManager.js';
import { CAMPAIGN_KEYS } from './validation.js';

let accountReady, accountSubscribed = false;
export function sessionPreferences(values) {
  const prefs = cleanPreferences(values);
  if (store.sessionRole === 'player') for (const key of CAMPAIGN_KEYS) delete prefs[key];
  return prefs;
}
export function initAccount() {
  const paint = () => document.querySelectorAll('[data-account-label]').forEach(el => {
    const name = account.user?.displayName || account.user?.email || (account.user ? 'Mi cuenta' : 'Iniciar sesión');
    const status = account.user ? 'Conectado' : 'Offline';
    if (el.querySelector('[data-account-name]')) {
      el.querySelector('[data-account-name]').textContent = name;
      el.querySelector('[data-account-status]').textContent = status;
    } else el.textContent = `${name} · ${status}`;
    el.dataset.signedIn = String(!!account.user);
    el.setAttribute('aria-label', `Cuenta: ${name}. ${status}`);
    el.title = account.user ? `Cuenta: ${name} · sesión iniciada` : 'Cuenta: Offline · iniciar sesión';
    el.onclick = openAccount;
  });
  if (!accountSubscribed) account.subscribe(async user => {
    paint();
    if (user) {
      const epoch = account.epoch;
      try {
        const saved = await account.loadPreferences();
        if (epoch !== account.epoch || account.user?.uid !== user.uid) return;
        const prefs = sessionPreferences(saved);
        store.update(prefs); if ('audioMuted' in prefs) audio.muted = prefs.audioMuted;
      }
      catch (error) { notify('Preferences could not be loaded: ' + error.message, 'error'); }
    }
  });
  accountSubscribed = true; paint();
  accountReady ||= account.restoreSession().catch(error => notify(error.message, 'error')).finally(paint);
  return accountReady;
}
export async function useCharacter(token) {
  if (store.sessionRole === 'player') {
    const existing = store.state.tokens.find(t => t.actorType !== 'drone' && t.ownerId === (store.memberId || store.peerId));
    if (existing && !(await confirmAction(`Replace ${existing.name}'s sheet with ${token.name}? Its token and assignment will be kept.`))) throw new Error('Character replacement cancelled.');
    await network.importCharacter(token);
  } else store.importActors([{ token }]);
}
export function openAccount() {
  const signed = !!account.user;
  const modal = dossierDialog('PERSONAL ARCHIVE', signed ? `
    <span class="dossier-eyebrow">ACCOUNT / PRIVATE LIBRARY</span><h2>${e(account.user.displayName || 'Your archive')}</h2><p class="dossier-muted">${e(account.user.email || 'Conectado')} · Characters and preferences follow this account.</p>
    <div class="session-actions"><button class="hud-btn" id="account_import">Import JSON to library</button><button class="hud-btn" id="account_save_actor">Save selected character</button><button class="hud-btn hud-btn-danger" id="account_signout">Sign out</button></div>
    <h3>User Parameters & Preferences</h3>
    <label class="dossier-field">Call sign / Indicativo<input class="hud-input" id="account_name" maxlength="80" value="${e(store.state.userName)}"></label>
    <div class="session-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <label><input type="checkbox" id="pref_audio" ${store.state.audioMuted ? 'checked' : ''}> Mute audio</label>
      <label><input type="checkbox" id="pref_grid" ${store.state.showGrid ? 'checked' : ''}> Show grid</label>
      <label><input type="checkbox" id="pref_snap" ${store.state.gridSnap ? 'checked' : ''}> Snap to grid</label>
      <label><input type="checkbox" id="pref_motion" ${store.state.reducedMotion ? 'checked' : ''}> Reduce motion</label>
      <label><input type="checkbox" id="pref_dice3d" ${store.state.dice3d !== false ? 'checked' : ''}> 3D Dice Tray</label>
      <label><input type="checkbox" id="pref_fog" ${store.state.fogOfWar !== false ? 'checked' : ''}> Fog of War</label>
    </div>
    <div style="margin-top: 10px;">
      <label class="dossier-field">Explored Fog Opacity (${Math.round((store.state.fogExploredOpacity ?? 0.5) * 100)}%)
        <input type="range" id="pref_fog_opacity" min="0.05" max="0.95" step="0.05" value="${store.state.fogExploredOpacity ?? 0.5}" class="hud-slider">
      </label>
    </div>
    <button class="hud-btn hud-btn-primary" id="account_preferences" style="margin-top: 12px; width: 100%;">Save all parameters</button>
    <h3>Saved characters</h3><div id="account_characters" aria-live="polite">Loading…</div><p class="dossier-error" role="alert"></p>
  ` : `
    <span class="dossier-eyebrow">YOUR CHARACTERS / YOUR SETTINGS</span><h2>Bring your crew with you.</h2><p class="dossier-muted">Sign in to save characters, preferences and scene images. Local play is always available.</p>

    <div style="margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px;">
      <button class="hud-btn hud-btn-primary" type="button" id="btn_google_signin" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; padding: 10px;">
        <span style="font-size: 16px;">🌐</span> Iniciar sesión con Google (Ventana emergente)
      </button>
      <button class="hud-btn hud-btn-secondary" type="button" id="btn_google_redirect" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; padding: 8px; font-size: 12px;">
        <span>🔄</span> Iniciar sesión con Google (Redirección directa · Si falla el popup)
      </button>
      <button class="hud-btn hud-btn-secondary" type="button" id="btn_netlify_signin" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; padding: 8px; font-size: 12px;">
        <span>⚡</span> Iniciar sesión con Netlify Identity (Google / Email)
      </button>
    </div>

    <div style="text-align: center; margin: 12px 0; color: #64748b; font-size: 11px;">— O ACCEDE CON CORREO Y CONTRASEÑA —</div>

    <form id="account_form">
      <label class="dossier-field">Email<input class="hud-input" name="email" type="email" autocomplete="email" required></label>
      <label class="dossier-field">Password<input class="hud-input" name="password" type="password" autocomplete="current-password" minlength="6" required></label>
      <label class="dossier-field">Call sign · for a new account<input class="hud-input" name="name" maxlength="80" autocomplete="nickname"></label>
      <label><input type="checkbox" name="remember" checked> Keep me signed in on this device</label>
      <div class="session-actions" style="margin-top: 14px;">
        <button class="hud-btn hud-btn-primary" type="submit" id="btn_signin_account">Sign in</button>
        <button class="hud-btn hud-btn-secondary" type="submit" id="btn_create_account" name="create">Create account</button>
        <button class="hud-btn" type="button" id="account_reset">Reset password</button>
      </div>
    </form>
    <p class="dossier-error" role="alert"></p>
  `);
  const error = modal.querySelector('.dossier-error');
  const displayAuthError = (err) => {
    const isUnauthorizedDomain = err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain');
    const isPopupClosed = err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed-by-user');
    const isOpNotAllowed = err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed');
    const isPermissionDenied = err.code === 'permission-denied' || String(err.message || '').toLowerCase().includes('permissions') || String(err.message || '').toLowerCase().includes('permission');
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'tu-dominio.netlify.app';

    if (isUnauthorizedDomain) {
      error.innerHTML = sanitizeHTML(`
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 8px; padding: 12px; margin-top: 10px; text-align: left;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 16px;">⚠️</span>
            <strong style="color: #f87171; font-size: 13px;">Dominio no autorizado en Firebase Authentication</strong>
          </div>
          <p style="margin: 0 0 8px; font-size: 12px; color: #cbd5e1; line-height: 1.4;">
            Google y Firebase bloquean las conexiones desde este dominio porque aún no está en la lista de dominios autorizados de tu proyecto Firebase.
          </p>
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 6px; padding: 8px 10px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Dominio actual:</span>
            <code style="color: #00f3ff; font-weight: bold; font-size: 13px; flex: 1;" id="domain_code_display">${e(currentHost)}</code>
            <button type="button" class="hud-btn hud-btn-xs hud-btn-secondary" id="btn_copy_auth_domain" style="white-space: nowrap;">📋 Copiar</button>
          </div>
          <p style="margin: 0 0 10px; font-size: 11px; color: #94a3b8; line-height: 1.4;">
            👉 <strong>Pasos para activarlo (10 segundos):</strong><br>
            1. Abre <a href="https://console.firebase.google.com/project/veilfarers-vtt/authentication/settings" target="_blank" rel="noopener noreferrer" style="color: #00f3ff; text-decoration: underline;">Firebase Console · Configuración de Auth</a>.<br>
            2. En la pestaña <strong>Settings</strong> ve a <strong>Authorized domains</strong> (Dominios autorizados).<br>
            3. Pulsa <strong>Add domain</strong> (Añadir dominio), pega <code>${e(currentHost)}</code> y guarda.
          </p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href="https://console.firebase.google.com/project/veilfarers-vtt/authentication/settings" target="_blank" rel="noopener noreferrer" class="hud-btn hud-btn-primary hud-btn-xs" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
              🔗 Ir a Firebase Console
            </a>
            <button type="button" class="hud-btn hud-btn-secondary hud-btn-xs" id="fallback_netlify_btn">
              ⚡ Probar con Netlify Identity
            </button>
          </div>
        </div>
      `);
      modal.querySelector('#btn_copy_auth_domain')?.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(currentHost);
          notify(`Dominio '${currentHost}' copiado al portapapeles.`);
        }
      });
      modal.querySelector('#fallback_netlify_btn')?.addEventListener('click', () => run(async () => {
        await account.signInWithNetlify();
        modal.remove();
        openAccount();
      }));
      return;
    }

    if (isPermissionDenied) {
      error.innerHTML = sanitizeHTML(`
        <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 8px; padding: 12px; margin-top: 10px; text-align: left;">
          <strong style="color: #fbbf24; font-size: 13px;">⚠️ Reglas de Firestore restringidas en Firebase</strong>
          <p style="margin: 6px 0 8px; font-size: 12px; color: #cbd5e1; line-height: 1.4;">
            Firebase Firestore ha devuelto "Missing or insufficient permissions". Tus personajes y parámetros se están guardando localmente de forma segura en este navegador. Para sincronizarlos entre distintos dispositivos, despliega las reglas de seguridad de Firestore.
          </p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href="https://console.firebase.google.com/project/veilfarers-vtt/firestore/rules" target="_blank" rel="noopener noreferrer" class="hud-btn hud-btn-primary hud-btn-xs" style="text-decoration: none;">
              🔗 Editar Reglas de Firestore
            </a>
            <button type="button" class="hud-btn hud-btn-secondary hud-btn-xs" id="btn_dismiss_perm_warn">Entendido</button>
          </div>
        </div>
      `);
      modal.querySelector('#btn_dismiss_perm_warn')?.addEventListener('click', () => { error.innerHTML = ''; });
      return;
    }

    if (isOpNotAllowed) {
      error.innerHTML = sanitizeHTML(`
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 8px; padding: 12px; margin-top: 10px; text-align: left;">
          <strong style="color: #f87171; font-size: 13px;">Google Sign-In no está habilitado en Firebase</strong>
          <p style="margin: 6px 0 8px; font-size: 12px; color: #cbd5e1;">Debes habilitar el proveedor Google en Firebase Console > Authentication > Sign-in method.</p>
          <a href="https://console.firebase.google.com/project/veilfarers-vtt/authentication/providers" target="_blank" rel="noopener noreferrer" class="hud-btn hud-btn-primary hud-btn-xs" style="text-decoration: none;">
            🔗 Habilitar Google en Firebase Console
          </a>
        </div>
      `);
      return;
    }

    if (isPopupClosed) {
      error.innerHTML = sanitizeHTML(`
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 10px; margin-top: 8px; text-align: left;">
          <p style="margin: 0 0 6px; font-weight: bold; color: #f87171;">La ventana emergente de Google se cerró antes de completar el acceso.</p>
          <p style="margin: 0 0 8px; font-size: 12px; color: #cbd5e1;">Esto ocurre si el navegador bloquea popups o si el dominio no está autorizado en Firebase.</p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="hud-btn hud-btn-primary hud-btn-xs" id="quick_google_redirect">🔄 Probar con Redirección Directa</button>
            <button type="button" class="hud-btn hud-btn-secondary hud-btn-xs" id="quick_netlify_login">⚡ Usar Netlify Identity</button>
          </div>
        </div>
      `);
      modal.querySelector('#quick_google_redirect')?.addEventListener('click', () => {
        run(() => account.signInWithGoogle({ useRedirect: true, remember: modal.querySelector('[name=remember]')?.checked !== false }));
      });
      modal.querySelector('#quick_netlify_login')?.addEventListener('click', () => run(async () => {
        await account.signInWithNetlify();
        modal.remove();
        openAccount();
      }));
      return;
    }

    error.textContent = err.message || 'Error durante la autenticación.';
  };

  const run = async fn => {
    error.textContent = ''; modal.dataset.busy = '1';
    const buttons = [...modal.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
    try { await fn(); } catch (err) { displayAuthError(err); }
    finally { delete modal.dataset.busy; buttons.forEach(b => b.disabled = false); }
  };
  if (!signed) {
    let submitMode = 'signin';
    modal.querySelector('#btn_create_account')?.addEventListener('click', () => { submitMode = 'create'; });
    modal.querySelector('#btn_signin_account')?.addEventListener('click', () => { submitMode = 'signin'; });

    modal.querySelector('#btn_google_signin')?.addEventListener('click', () => run(async () => {
      const user = await account.signInWithGoogle({ useRedirect: false, remember: modal.querySelector('[name=remember]').checked });
      if (user) {
        modal.remove();
        openAccount();
      }
    }));

    modal.querySelector('#btn_google_redirect')?.addEventListener('click', () => run(async () => {
      await account.signInWithGoogle({ useRedirect: true, remember: modal.querySelector('[name=remember]').checked });
    }));

    modal.querySelector('#btn_netlify_signin')?.addEventListener('click', () => run(async () => {
      await account.signInWithNetlify();
      modal.remove();
      openAccount();
    }));

    modal.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const values = new FormData(event.target);
      const isCreate = submitMode === 'create' || event.submitter?.name === 'create';
      run(async () => {
        await account.signIn(values.get('email'), values.get('password'), {
          create: isCreate,
          name: values.get('name') || '',
          remember: values.has('remember')
        });
        modal.remove();
        openAccount();
      });
    };
    modal.querySelector('#account_reset').onclick = () => run(async () => {
      const email = modal.querySelector('[name=email]');
      if (!email.reportValidity()) return;
      await account.resetPassword(email.value);
      notify('If this address has an account, password reset instructions are on their way.');
    });
  } else {
    const refresh = async () => {
      const rows = await account.list('characters');
      if (!modal.isConnected) return;
      const list = modal.querySelector('#account_characters');
      list.innerHTML = sanitizeHTML(rows.length ? rows.map((r, i) => `<article class="crew-row"><div><strong>${e(r.name)}</strong><small>${e(new Date(r.updatedAt).toLocaleString())}</small></div><button class="hud-btn" data-use="${i}">Use in game</button><button class="hud-btn hud-btn-danger" data-delete="${i}" aria-label="Delete ${e(r.name)}">Delete</button></article>`).join('') : '<p class="dossier-muted">Your library is empty. Import a JSON or save a selected character.</p>');
      list.querySelectorAll('[data-use]').forEach(b => b.onclick = () => run(async () => { await useCharacter(account.decodeCharacter(rows[Number(b.dataset.use)])); notify('Character ready in this game.'); }));
      list.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => run(async () => { if (await confirmAction('Delete this saved character version?')) { await account.removeCharacter(rows[Number(b.dataset.delete)].id); await refresh(); } }));
    };
    run(refresh);
    modal.querySelector('#account_import').onclick = () => openCharacterImport({ onImport: async entries => { for (const x of entries) await account.saveCharacter(x.token); await refresh(); return entries.length; } });
    modal.querySelector('#account_save_actor').onclick = () => run(async () => { const token = store.getSelectedToken(); if (!token || (store.sessionRole === 'player' && !store.canEditToken(token.id))) throw new Error('Select a character you control first.'); await account.saveCharacter(token); await refresh(); notify('Character saved to your account.'); });
    modal.querySelector('#account_signout').onclick = () => run(async () => { await account.signOut(); modal.remove(); openAccount(); });
    modal.querySelector('#account_preferences').onclick = () => run(async () => {
      const fogOpVal = parseFloat(modal.querySelector('#pref_fog_opacity')?.value) || 0.5;
      const values = {
        ...store.state,
        userName: modal.querySelector('#account_name').value.trim(),
        audioMuted: modal.querySelector('#pref_audio').checked,
        showGrid: modal.querySelector('#pref_grid').checked,
        gridSnap: modal.querySelector('#pref_snap').checked,
        snapToGrid: modal.querySelector('#pref_snap').checked,
        reducedMotion: modal.querySelector('#pref_motion').checked,
        dice3d: modal.querySelector('#pref_dice3d').checked,
        fogOfWar: modal.querySelector('#pref_fog').checked,
        fogExploredOpacity: fogOpVal
      };
      store.update(sessionPreferences(values));
      audio.muted = values.audioMuted;
      try {
        await account.savePreferences(values);
        notify('All user parameters and preferences saved.');
      } catch (err) {
        console.warn('Preferences cloud sync error:', err);
        notify('Parámetros guardados correctamente en este dispositivo.');
      }
    });
  }
  return modal;
}
