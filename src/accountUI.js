import { account, cloudConfigured, cleanPreferences } from './cloudAccount.js';
import { store } from './state.js';
import { audio } from './audioEngine.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, sanitizeHTML, notify, confirmAction } from './ui.js';
import { openCharacterImport } from './characterManager.js';
import { network } from './networkManager.js';

export function initAccount() {
  account.subscribe(async user => {
    document.querySelectorAll('[data-account-label]').forEach(el => el.textContent = user?.displayName || (user ? 'My account' : 'Sign in'));
    if (user) {
      try { const prefs = await account.loadPreferences(); store.update(prefs); if ('audioMuted' in prefs) audio.muted = prefs.audioMuted; }
      catch (error) { notify('Preferences could not be loaded: ' + error.message, 'error'); }
    }
  });
  if (cloudConfigured) account.init().catch(error => notify(error.message, 'error'));
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

    <div style="margin-bottom: 16px;">
      <button class="hud-btn hud-btn-primary" type="button" id="btn_google_signin" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; padding: 10px;">
        <span style="font-size: 16px;">🌐</span> Iniciar sesión con Google (Netlify / Google Account)
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
  const run = async fn => {
    error.textContent = ''; modal.dataset.busy = '1';
    const buttons = [...modal.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
    try { await fn(); } catch (err) { error.textContent = err.message; }
    finally { delete modal.dataset.busy; buttons.forEach(b => b.disabled = false); }
  };
  if (!signed) {
    let submitMode = 'signin';
    modal.querySelector('#btn_create_account')?.addEventListener('click', () => { submitMode = 'create'; });
    modal.querySelector('#btn_signin_account')?.addEventListener('click', () => { submitMode = 'signin'; });

    modal.querySelector('#btn_google_signin')?.addEventListener('click', () => run(async () => {
      await account.signInWithGoogle();
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
      await account.savePreferences(values);
      store.update(cleanPreferences(values));
      audio.muted = values.audioMuted;
      notify('All user parameters and preferences saved.');
    });
  }
  return modal;
}
