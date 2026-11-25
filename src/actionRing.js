// The action ring (Plan de UX V3, fase 2, user decision of 25 Nov 2026): the target first. A player
// touches an enemy token on the map and a ring opens around it with what their character can do to
// it: attack with each weapon in hand (in range or not, and why) and cast each Power in hand that
// can be aimed at it. One more touch does it: an attack with no edge, or the Power cast at once.
// The bar and the hand keep working as before; the ring is a shortcut.
import { store } from './state.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { tokenInventory } from './equipment.js';
import { distanceInfo, rangeCheck, weaponRangeBand } from './attackFlow.js';
import { weaponReadiness } from './weaponFeatures.js';
import { isPartyToken } from './tokenPermissions.js';
import { tokenAtPoint } from './playerActionBar.js';

// Who acts with the ring: a player's own character (or the Keeper's Player view of one).
export function ringActor(state = store.state) {
  const id = state.claimedTokenId;
  const token = id && state.tokens.find(t => t.id === id && t.mapId === state.activeMapId);
  return token && token.isPlayer !== false ? token : null;
}
// What the ring offers against this target: each weapon, with whether it reaches.
export function ringOptions(actor, target, map = {}, cards = []) {
  if (!actor || !target || target.id === actor.id || isPartyToken(target)) return [];
  const band = distanceInfo(actor, target, map).band;
  const weapons = (tokenInventory(actor).weapons || []).filter(w => w.equipped !== false);
  const attacks = (weapons.length ? weapons : [null]).map(w => {
    const reach = rangeCheck(w, band), ready = weaponReadiness(w);
    return { kind: 'weapon', id: w?.id || '', name: w?.name || 'Desarmado', detail: weaponRangeBand(w) || (w ? '—' : 'Melee'),
      ok: reach.allowed && ready.ready, edge: reach.disadvantage ? 'Desventaja' : '', why: !ready.ready ? ready.reason : !reach.allowed ? reach.reason : reach.disadvantage ? reach.reason : '' };
  });
  return [...attacks, ...cards.map(c => ({ kind: 'card', id: c.id, name: c.name, detail: c.costLabel || '', ok: true, why: '' }))];
}

export function mountActionRing({ bar, hand } = {}) {
  if (typeof document === 'undefined') return null;
  let ring = null, down = null;
  const close = () => { ring?.remove(); ring = null; };
  const open = target => {
    close();
    const actor = ringActor(), map = store.getActiveMap?.() || {}, engine = window.veilCanvas;
    if (!actor || !engine?.worldToScreen) return;
    const cards = hand?.tokenId === actor.id ? hand.ringCards(target) : [];
    const options = ringOptions(actor, target, map, cards);
    if (!options.length) return;
    const rect = engine.canvas.getBoundingClientRect(), p = engine.worldToScreen(target.x, target.y);
    ring = document.createElement('div');
    ring.className = 'action-ring'; ring.setAttribute('role', 'menu'); ring.setAttribute('aria-label', `Acciones contra ${target.name}`);
    ring.style.left = `${Math.round(rect.left + p.x)}px`; ring.style.top = `${Math.round(rect.top + p.y)}px`;
    // The options on an arc above the token; its name and the close button below it.
    const n = options.length, radius = Math.max(84, 24 * n), size = Math.round(((target.size || 1) * (map.gridSize || 64) * (engine.zoom || 1)) / 2);
    ring.innerHTML = sanitizeHTML(`<div class="action-ring-name" style="transform:translate(-50%, ${size + 10}px)" data-no-i18n>${e(target.name)} · ${e(distanceInfo(actor, target, map).band)}</div>
      ${options.map((o, i) => {
        const angle = (n === 1 ? -90 : -165 + (i * 150) / (n - 1)) * Math.PI / 180, x = Math.round(Math.cos(angle) * radius), y = Math.round(Math.sin(angle) * radius);
        return `<button type="button" role="menuitem" class="action-ring-item ${o.kind} ${o.ok ? '' : 'off'}" style="transform:translate(calc(-50% + ${x}px), calc(-50% + ${y}px))" data-ring-kind="${o.kind}" data-ring-id="${e(o.id)}" ${o.ok ? '' : 'aria-disabled="true"'} title="${e(o.why || (o.kind === 'card' ? 'Lanzar sobre ' + target.name : 'Atacar a ' + target.name))}"><b data-no-i18n>${e(o.name)}</b><span data-no-i18n>${e(o.edge || o.detail)}</span></button>`;
      }).join('')}
      <button type="button" class="action-ring-close" style="transform:translate(-50%, ${size + 36}px)" data-ring-close aria-label="Cerrar">×</button>`);
    document.body.append(ring);
    ring.querySelector('[data-ring-close]').onclick = close;
    ring.querySelectorAll('[data-ring-id]').forEach(b => b.onclick = () => {
      const option = options.find(o => o.kind === b.dataset.ringKind && o.id === b.dataset.ringId);
      if (!option) return;
      if (!option.ok) { notify(option.why || 'No llega.', 'error'); return; }
      close();
      if (option.kind === 'card') { hand?.castAt(option.id, target.id); return; }
      // The bar attacks the marked target at once (no second touch: the ring was the choice).
      bar?.attackFromRing?.(option.id, target);
    });
  };
  const attach = () => {
    const canvas = window.veilCanvas?.canvas;
    if (!canvas) { setTimeout(attach, 500); return; }
    // A tap (not a drag) on an enemy token, while nothing else is being aimed.
    canvas.addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY, t: performance.now() }; if (ring && !ring.contains(event.target)) close(); }, true);
    canvas.addEventListener('pointerup', event => {
      const start = down; down = null;
      if (!start || event.button !== 0 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6 || performance.now() - start.t > 450) return;
      if (bar?.targeting || window.veilCardAim || document.body.classList.contains('pab-targeting')) return;
      const actor = ringActor(), engine = window.veilCanvas;
      if (!actor || !engine?.screenToWorld || !store.canEditToken(actor.id)) return;
      const rect = canvas.getBoundingClientRect(), world = engine.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
      const map = store.getActiveMap?.() || {};
      const target = tokenAtPoint(store.getTokensForActiveMap(), world, map.gridSize || 64, { exclude: actor.id, includeHidden: false });
      if (!target || isPartyToken(target)) return;
      open(target);
    });
    window.addEventListener('keydown', event => { if (event.key === 'Escape' && ring) close(); });
    store.subscribe(() => { if (ring && !ringActor()) close(); });
  };
  attach();
  return { open, close, get element() { return ring; } };
}
