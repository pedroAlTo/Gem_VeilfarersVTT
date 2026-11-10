import { store } from './state.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { dossierDialog } from './dossierUI.js';
import { openCharacterImport } from './characterManager.js';
import { mountSessionNavigation } from './sessionNavigation.js';

export async function openSessionManager() {
  const modal = dossierDialog('SESIONES', '<p class="dossier-muted">Leyendo sesiones…</p>', 'sessions-backdrop');
  mountSessionNavigation(modal, 'saved');
  const body = modal.querySelector('.dossier-body');
  const refresh = async () => {
    const sessions = await store.savedSessions();
    if (!modal.isConnected) return;
    body.innerHTML = sanitizeHTML(`
      <span class="dossier-eyebrow">ARCHIVO LOCAL / CONTINUIDAD DE CAMPAÑA</span><h2 class="dossier-heading">Cada historia, en su lugar.</h2>
      <p class="dossier-muted">El autoguardado conserva escenas, fichas, clocks, nave, documentos y registro. Exporta un JSON para llevar una sesión a otro navegador o equipo.</p>
      <section class="session-current"><span class="dossier-eyebrow">SESIÓN ACTIVA</span><div><input class="hud-input" aria-label="Nombre de la sesión activa" id="session_name" value="${e(store.state.campaignName)}"><button class="hud-btn" id="session_rename">Renombrar</button><button class="hud-btn hud-btn-primary" id="session_save">Guardar ahora</button></div><small>${e(store.state.saveStatus === 'saved' ? 'Guardada en este navegador' : 'Guardado pendiente')}</small></section>
      <div class="session-list">${sessions.map(s => `<article class="session-card ${s.id === store.state.campaignId ? 'current' : ''}"><div><span class="dossier-eyebrow">${s.id === store.state.campaignId ? 'ACTIVA' : 'GUARDADA'}</span><h3>${e(s.name)}</h3><p>${s.maps || 0} escenas · ${s.tokens || 0} actores · ${s.clocks || 0} clocks</p><small>${s.savedAt ? e(new Date(s.savedAt).toLocaleString()) : 'Guardado anterior'}</small></div><button class="hud-btn" data-open-session="${e(s.id)}" ${s.id === store.state.campaignId || s.damaged ? 'disabled' : ''}>Abrir</button></article>`).join('')}</div>
      <section class="session-new"><h4 class="dossier-label">CREAR SESIÓN</h4><div><input class="hud-input" id="session_new_name" aria-label="Nombre de nueva sesión" placeholder="Nombre de la nueva sesión" maxlength="500"><button class="hud-btn hud-btn-primary" id="session_create">Nueva vacía</button><button class="hud-btn" id="session_copy">Duplicar activa</button></div><small>La sesión vacía comienza con una escena sin actores. Fear se inicia en 0 para que lo ajustes al preparar la partida.</small></section>
      <p class="dossier-error" role="alert"></p><footer class="dossier-footer"><button class="hud-btn" id="session_actors">Importar personajes</button><button class="hud-btn" id="session_export">Exportar sesión JSON</button><label class="hud-btn session-file">Importar sesión JSON<input type="file" id="session_import" accept=".json,application/json"></label></footer>
    `);
    if (store.sessionRole !== 'local' || store.state.isHosting || store.state.isConnected) {
      const message = document.createElement('p'); message.className = 'import-warning';
      message.textContent = 'Para abrir, crear o importar otra sesión, cierra la partida desde «Partida y tripulación». Tus sesiones guardadas se conservan.';
      body.prepend(message);
      body.querySelectorAll('#session_rename,#session_create,#session_copy,#session_import,#session_actors,[data-open-session]').forEach(b => { b.disabled = true; });
      if (store.sessionRole === 'player') body.querySelector('#session_save').disabled = true;
    }
    const execute = async action => {
      modal.dataset.busy = 'true';
      const controls = [...body.querySelectorAll('button, input')].map(x => [x, x.disabled]);
      controls.forEach(([x]) => { x.disabled = true; });
      try { await action(); await refresh(); }
      catch (err) { body.querySelector('.dossier-error').textContent = err.message; controls.forEach(([x, disabled]) => { x.disabled = disabled; }); }
      finally { delete modal.dataset.busy; }
    };
    body.querySelector('#session_save').onclick = () => execute(async () => { await store.saveToStorage(); await store.saveQueue; notify('Sesión guardada.'); });
    body.querySelector('#session_rename').onclick = () => execute(() => store.renameSession(body.querySelector('#session_name').value));
    body.querySelector('#session_create').onclick = () => execute(() => store.createSession(body.querySelector('#session_new_name').value));
    body.querySelector('#session_copy').onclick = () => execute(() => store.createSession(body.querySelector('#session_new_name').value, true));
    body.querySelectorAll('[data-open-session]').forEach(b => { b.onclick = () => execute(() => store.openSession(b.dataset.openSession)); });
    body.querySelector('#session_export').onclick = () => store.exportCampaignJSON();
    body.querySelector('#session_actors').onclick = () => { modal.remove(); openCharacterImport(); };
    body.querySelector('#session_import').onchange = event => {
      const file = event.target.files[0]; if (!file) return;
      execute(async () => {
        if (file.size > 100 * 1024 * 1024) throw new Error('El archivo supera 100 MB.');
        if (!await store.importCampaignJSON(await file.text())) throw new Error('No se ha importado la sesión. Revisa el formato del archivo y el estado del almacenamiento.');
        notify('Sesión importada como una copia independiente.');
      });
    };
  };
  try { await refresh(); }
  catch (err) {
    body.innerHTML = sanitizeHTML(`<p class="dossier-error">${e(err.message)}</p><p class="dossier-muted">No se ha cambiado la sesión activa. Puedes exportar el estado en memoria antes de recargar.</p><button class="hud-btn" id="session_recovery_export">Exportar copia de recuperación</button>`);
    body.querySelector('#session_recovery_export').onclick = () => store.exportCampaignJSON();
  }
  return modal;
}

export function checkBackupReminder(force = false) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const state = store.getState();
  if (state.userRole !== 'keeper') return;

  const lastReminder = parseInt(localStorage.getItem('veil_last_export_reminder') || '0', 10);
  const now = Date.now();
  const TWENTY_MINS = 20 * 60 * 1000;

  if (!force && (now - lastReminder) < TWENTY_MINS) return;

  localStorage.setItem('veil_last_export_reminder', String(now));

  const modal = dossierDialog('💾 RECORDATORIO DE COPIA DE SEGURIDAD', `
    <span class="dossier-eyebrow">PROTECCIÓN DE DATOS DE CAMPAÑA // VERSIÓN ALPHA</span>
    <h2 class="dossier-heading">Tus historias viven en tu navegador.</h2>
    <p class="dossier-muted">
      Las campañas y mapas tácticos se almacenan localmente en el almacenamiento de este navegador. Si borras cookies o datos de navegación, podrías perder tu campaña.
    </p>
    <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 6px; padding: 12px; margin: 12px 0;">
      <p style="margin: 0; color: #fff; font-size: 13px;">
        💡 <strong>Recomendación para Testers:</strong> Descarga una copia de seguridad en formato JSON de tu campaña <strong>"${e(state.campaignName || 'Campaña')}"</strong>. Puedes restaurarla en cualquier momento o abrirla en otro equipo.
      </p>
      <small style="color: #64748b; display: block; margin-top: 4px;">También se mantiene una copia de seguridad automática rodante en la memoria del navegador.</small>
    </div>
    <footer class="dossier-footer" style="display: flex; justify-content: space-between; gap: 8px;">
      <button class="hud-btn hud-btn-secondary" type="button" id="reminder_later_btn">Recordar más tarde</button>
      <button class="hud-btn hud-btn-primary" type="button" id="reminder_export_btn">📥 Descargar Copia de Seguridad JSON</button>
    </footer>
  `);

  modal.querySelector('#reminder_later_btn')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#reminder_export_btn')?.addEventListener('click', () => {
    store.exportCampaignJSON();
    modal.remove();
    notify('💾 Copia de seguridad exportada con éxito.');
  });
  return modal;
}
