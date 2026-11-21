import { escapeHTML as e, sanitizeHTML } from './ui.js';

export function dossierDialog(title, body, className = '') {
  const previous = document.activeElement;
  const modal = document.createElement('div');
  modal.className = `veil-modal-backdrop dossier-backdrop ${className}`;
  modal.innerHTML = sanitizeHTML(`<section class="veil-modal-box dossier-modal" role="dialog" aria-modal="true" aria-label="${e(title)}"><header class="veil-modal-header"><h3>${e(title)}</h3><button class="modal-close-btn" aria-label="Cerrar">×</button></header><div class="dossier-body">${body}</div></section>`);
  const close = () => { if (modal.dataset.busy) return; modal.remove(); previous?.focus?.(); };
  modal.querySelector('.modal-close-btn').onclick = close;
  modal.onclick = event => { if (event.target === modal) close(); };
  modal.onkeydown = event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (event.key === 'Tab') {
      const items = [...modal.querySelectorAll('button, input, textarea, [tabindex="0"]')].filter(x => !x.disabled && x.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  document.body.append(modal);
  modal.querySelector('.modal-close-btn').focus();
  return modal;
}
