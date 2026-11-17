// The table is built for a computer or a tablet. On a phone it still works for following a
// game: this one-time notice says so, and what works well there. Closing it is remembered.
import { sanitizeHTML } from './ui.js';

const KEY = 'veil_mobile_notice_v1';

export function mountMobileNotice() {
  if (typeof document === 'undefined' || typeof matchMedia !== 'function') return;
  const phone = matchMedia('(max-width: 600px)');
  let seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch {}
  if (seen) return;
  const note = document.createElement('aside');
  note.className = 'mobile-notice'; note.hidden = true; note.setAttribute('role', 'note');
  note.innerHTML = sanitizeHTML(`<p><strong>Pensada para ordenador o tablet.</strong> <span>En el móvil puedes seguir la partida, consultar tu ficha, tirar dados y usar el chat. Para dirigir o editar el mapa usa una pantalla más grande, mejor en horizontal.</span></p><button type="button" class="hud-btn hud-btn-xs" data-mobile-ok>Entendido</button>`);
  document.body.append(note);
  const lobby = document.getElementById('vf-lobby-gateway');
  const update = () => { note.hidden = !phone.matches || (lobby && !lobby.classList.contains('hidden')); };
  note.querySelector('[data-mobile-ok]').onclick = () => { try { localStorage.setItem(KEY, '1'); } catch {} note.remove(); };
  phone.addEventListener?.('change', update);
  if (lobby) new MutationObserver(update).observe(lobby, { attributes: true, attributeFilter: ['class'] });
  update();
}
