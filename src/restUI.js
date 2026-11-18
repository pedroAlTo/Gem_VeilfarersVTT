// Rests on the table (V3). The Keeper's two buttons sit in the map's top-left corner, next to the
// scene name: a crescent moon (Short Rest) and a rising sun (Long Rest). While a rest is on, the
// map is paused under a panel that shows who has chosen and who is still choosing; each player
// picks two different moves for their character; the last choice applies the rest to everybody.
import { store } from './state.js';
import { network } from './networkManager.js';
import { notify, sanitizeHTML, escapeHTML as e } from './ui.js';
import { REST_MOVES, REST_NAMES, restPending } from './rest.js';
import './restUI.css';

export const MOON_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 3.2a8.6 8.6 0 1 0 5.3 13.4A7.2 7.2 0 0 1 15.5 3.2z"/></svg>';
export const SUNRISE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 18.5h19M6 21.5h12"/><path d="M7 18.5a5 5 0 0 1 10 0"/><path d="M12 8.5v2.6M5.6 12.1l1.6 1.6M18.4 12.1l-1.6 1.6M12 2.5l-2 2M12 2.5l2 2"/></svg>';

const picks = new Map(); // tokenId → moves this screen has marked, before confirming
const expanded = new Set(); // rows the Keeper opened to choose for an absent player
let busy = false;

const isTable = () => store.sessionRole !== 'player' && store.state.userRole === 'keeper';
const ownedByPlayer = t => !!((t.ownerId && t.ownerId !== 'keeper') || t.controllerIds?.length);
// Who this screen may choose for: its own characters; the Keeper, anyone (an absent player).
const mayChoose = t => (isTable() ? true : store.canEditToken(t.id));

async function send(action) {
  if (busy) return;
  busy = true;
  try { await network.requestAction(action); }
  catch (error) { notify(error.message, 'error'); }
  finally { busy = false; paint(); }
}

function controlsHTML() {
  const rest = store.state.rest;
  const button = (kind, icon, title) => `<button type="button" class="rest-btn ${rest?.kind === kind ? 'active' : ''}" data-rest-start="${kind}" title="${title}" aria-label="${title}" ${rest ? 'disabled' : ''}>${icon}</button>`;
  return button('short', MOON_ICON, 'Descanso corto: pausa la partida y cada jugador elige dos movimientos') + button('long', SUNRISE_ICON, 'Descanso largo: pausa la partida y cada jugador elige dos movimientos');
}

function rowHTML(rest, token) {
  const chosen = rest.choices[token.id], moves = REST_MOVES[rest.kind];
  const name = id => moves.find(m => m.id === id)?.name || id;
  const can = mayChoose(token), forPlayer = isTable() && ownedByPlayer(token);
  const open = can && (!forPlayer || expanded.has(token.id)) && (!chosen || picks.has(token.id));
  const marked = picks.get(token.id) || [];
  const status = chosen
    ? `<span class="rest-status done">✓ ${e(chosen.map(name).join(' + '))}</span>`
    : `<span class="rest-status waiting">Eligiendo…</span>`;
  const actions = !can ? '' : chosen && !open ? `<button type="button" class="rest-link" data-rest-change="${e(token.id)}">Cambiar</button>`
    : !open ? `<button type="button" class="rest-link" data-rest-open="${e(token.id)}">Elegir por el jugador</button>` : '';
  const choices = open ? `<div class="rest-moves">${moves.map(m => `<button type="button" class="rest-move ${marked.includes(m.id) ? 'on' : ''}" data-rest-pick="${e(token.id)}:${m.id}" aria-pressed="${marked.includes(m.id)}" ${!marked.includes(m.id) && marked.length >= 2 ? 'disabled' : ''}><b>${e(m.name)}</b><small>${e(m.text)}</small></button>`).join('')}</div>
    <div class="rest-confirm"><span>${marked.length}/2</span><button type="button" class="rest-primary" data-rest-confirm="${e(token.id)}" ${marked.length === 2 ? '' : 'disabled'}>Confirmar</button></div>` : '';
  return `<li class="rest-row ${chosen ? 'is-done' : ''} ${open ? 'is-open' : ''}"><div class="rest-row-head"><img src="${e(token.avatarUrl || '')}" alt=""><strong>${e(token.name)}</strong>${status}${actions}</div>${choices}</li>`;
}

function overlayHTML(rest) {
  const tokens = rest.participants.map(id => store.state.tokens.find(t => t.id === id)).filter(Boolean);
  const pending = restPending(rest, store.state.tokens).map(id => store.state.tokens.find(t => t.id === id)?.name).filter(Boolean);
  const icon = rest.kind === 'short' ? MOON_ICON : SUNRISE_ICON;
  return `<div class="rest-panel" role="dialog" aria-modal="true" aria-labelledby="rest_title">
    <header><span class="rest-icon">${icon}</span><div><h2 id="rest_title">${e(REST_NAMES[rest.kind])}</h2><p>Partida en pausa · cada personaje elige dos movimientos distintos</p></div></header>
    <ul class="rest-list">${tokens.map(t => rowHTML(rest, t)).join('')}</ul>
    <footer><span class="rest-pending">${pending.length ? `Faltan: ${e(pending.join(', '))}` : 'Todos han elegido.'}</span>
      ${isTable() ? `<span class="rest-keeper"><button type="button" class="rest-link" data-rest-cancel>Cancelar descanso</button>${Object.keys(rest.choices).length ? '<button type="button" class="rest-secondary" data-rest-finish title="Aplica el descanso solo a quienes ya han elegido">Aplicar ya</button>' : ''}</span>` : ''}
    </footer></div>`;
}

let controls = null, overlay = null;
function paint() {
  const rest = store.state.rest;
  if (controls) {
    controls.hidden = !isTable();
    if (isTable()) controls.innerHTML = sanitizeHTML(controlsHTML());
  }
  if (!overlay) return;
  // Picks for a rest that ended, or a character that already confirmed, are forgotten.
  if (!rest) { picks.clear(); expanded.clear(); }
  overlay.hidden = !rest;
  overlay.innerHTML = rest ? sanitizeHTML(overlayHTML(rest)) : '';
}

export function mountRestUI() {
  const heading = document.querySelector('.orbital-map-heading > div');
  const viewport = document.getElementById('canvas_viewport_root');
  if (!heading || !viewport || controls) return;
  controls = document.createElement('div');
  controls.className = 'rest-controls'; controls.id = 'rest_controls';
  heading.prepend(controls);
  controls.addEventListener('click', event => {
    const kind = event.target.closest('[data-rest-start]')?.dataset.restStart;
    if (kind) send({ type: 'REST_START', kind });
  });
  overlay = document.createElement('div');
  overlay.className = 'rest-overlay'; overlay.id = 'rest_overlay'; overlay.hidden = true;
  // The pause: nothing under the panel can be touched (the table also refuses it).
  for (const type of ['pointerdown', 'mousedown', 'wheel', 'dblclick', 'contextmenu']) overlay.addEventListener(type, event => event.stopPropagation());
  overlay.addEventListener('click', event => {
    const t = event.target.closest('button');
    if (!t || !store.state.rest) return;
    const rest = store.state.rest;
    if (t.dataset.restPick) {
      const [id, move] = t.dataset.restPick.split(':');
      const list = picks.get(id) || [];
      picks.set(id, list.includes(move) ? list.filter(m => m !== move) : [...list, move].slice(0, 2));
      return paint();
    }
    if (t.dataset.restOpen) { expanded.add(t.dataset.restOpen); picks.set(t.dataset.restOpen, []); return paint(); }
    if (t.dataset.restChange) { expanded.add(t.dataset.restChange); picks.set(t.dataset.restChange, (rest.choices[t.dataset.restChange] || []).slice()); return paint(); }
    if (t.dataset.restConfirm) {
      const id = t.dataset.restConfirm, moves = picks.get(id) || [];
      picks.delete(id); expanded.delete(id);
      return send({ type: 'REST_CHOICE', actorId: id, restId: rest.id, moves, tokenName: store.state.tokens.find(x => x.id === id)?.name || '' });
    }
    if (t.matches('[data-rest-cancel]')) return send({ type: 'REST_CANCEL' });
    if (t.matches('[data-rest-finish]')) return send({ type: 'REST_FINISH' });
  });
  viewport.append(overlay);
  store.subscribe((state, keys = []) => { if (!keys.length || keys.some(k => ['rest', 'tokens', 'userRole', 'activeMapId'].includes(k))) paint(); });
  paint();
}
