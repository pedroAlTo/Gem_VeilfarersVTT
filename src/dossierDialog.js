import { escapeHTML as e, sanitizeHTML } from './ui.js';

export function dossierDialog(title, body, className = '') {
  const previous = document.activeElement;
  const modal = document.createElement('div');
  modal.className = `veil-modal-backdrop dossier-backdrop ${className}`;
  const panel = modal.classList.contains('table-action-panel');
  modal.innerHTML = sanitizeHTML(`<section class="veil-modal-box dossier-modal" role="dialog" aria-modal="${!panel}" aria-label="${e(title)}"><header class="veil-modal-header"><h3>${e(title)}</h3><button class="modal-close-btn" aria-label="Cerrar">×</button></header><div class="dossier-body">${body}</div></section>`);
  const close = () => { if (modal.dataset.busy) return; modal.remove(); previous?.focus?.(); };
  modal.querySelector('.modal-close-btn').onclick = close;
  modal.onclick = event => { if (event.target === modal) close(); };
  modal.onkeydown = event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (!panel && event.key === 'Tab') {
      const items = [...modal.querySelectorAll('button, input, textarea, select, a[href], summary, [tabindex="0"]')].filter(x => !x.disabled && x.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  document.body.append(modal);
  modal.querySelector('.modal-close-btn').focus();
  return modal;
}

export function tableDialog(title, body, className = '') {
  // Only the latest card being browsed is needed. Pending decisions (e.g. two
  // separate hits) stay in the DOM and become available again when the top one closes.
  if (className === 'card-inspect-dialog') document.querySelector('.table-action-panel.card-inspect-dialog')?.remove();
  return dossierDialog(title, body, `table-action-panel ${className}`);
}
