import { notify } from './ui.js';

// Both sections share a single header entry. Navigation never opens stacked dialogs.
export function mountSessionNavigation(modal, active) {
  const nav = document.createElement('nav');
  nav.className = 'session-navigation'; nav.setAttribute('aria-label', 'Secciones de sesiones');
  for (const [key, label] of [['live', 'Partida y tripulación'], ['saved', 'Sesiones guardadas']]) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'hud-btn' + (key === active ? ' active' : '');
    button.textContent = label; button.dataset.sessionSection = key;
    button.setAttribute('aria-current', key === active ? 'page' : 'false');
    button.onclick = async () => {
      if (key === active || modal.dataset.busy) return;
      nav.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        const open = key === 'saved' ? (await import('./sessionManager.js')).openSessionManager : (await import('./sessionLobby.js')).openSessionLobby;
        modal.remove(); document.getElementById('network_modal_btn')?.focus(); await open();
      } catch (error) { notify(error.message, 'error'); nav.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
    };
    nav.append(button);
  }
  modal.querySelector('.dossier-modal').insertBefore(nav, modal.querySelector('.dossier-body'));
  return nav;
}
