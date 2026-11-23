// The card flow at the table (v2.36.0, user decisions of 22 Nov 2026):
// - a card in the hand says its state (Preparada, Activa, Reacción, or why it cannot be used);
// - hovering it shows it large with its summary and its data;
// - one click (or dragging it onto the map) plays it with its defaults: a card with a target is
//   aimed on the map, an area is previewed around the caster, and the roll is thrown at once;
// - a double click opens its options (target from a list, mode, Advantage, Experience…);
// - what happens is followed in one card beside the hand, step by step.
import { store } from './state.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { TARGET_RULES, eligible, areaRule, areaTargets, areaRadius, resolutionLog, CARD_MODES, POWER_DAMAGE, cardRollOptions } from './cardResolution.js';
import { cardSummary } from './cardSummaries.js';
import { NEXT_ROLL, barrier } from './powerEffects.js';
import { cardUse, usedBy } from './cardLimits.js';
import { costLabel, DUAL_REACTIONS } from './loadoutCards.js';
import { tokenAtPoint } from './playerActionBar.js';
import { distanceInfo } from './attackFlow.js';

// ── State of a card in the hand ─────────────────────────────────────────────────────────────
function missing(card, token) {
  const c = card.cost || {}, stressRoom = (token.stress?.max ?? 6) - (token.stress?.current || 0);
  if (card.kind === 'archive') return token.uncanny || (token.resolve?.current || 0) >= 1 ? '' : 'Sin Resolve';
  if (card.uncanny) return token.uncanny || (token.resolve?.current || 0) >= 1 ? '' : 'Sin Resolve';
  if (c.hope && (token.hope || 0) < c.hope) return `Falta ${c.hope - (token.hope || 0)} Hope`;
  if (c.effort && card.kind !== 'effort' && (token.effort || 0) < c.effort) return `Falta ${c.effort - (token.effort || 0)} Effort`;
  if (c.resolve && (token.resolve?.current || 0) < c.resolve) return 'Sin Resolve';
  if (c.stress && ((token.stress?.current || 0) >= (token.stress?.max ?? 6) || stressRoom < c.stress)) return 'Sin margen de Stress';
  return '';
}
export function cardStatus(card, token, state = store.state) {
  if (!token || card.zone === 'vault' || card.zone === 'catalog') return null;
  const clock = token.effectClocks?.find(c => c.name === card.name);
  if (clock && (NEXT_ROLL[card.name] || card.name === 'Kinetic Blast')) return { cls: 'ready', text: 'Preparada' };
  if (clock) { const wall = card.name === 'Kinetic Barrier' && barrier(token); return { cls: 'active', text: wall ? `Activa · ${wall.left}/10` : 'Activa' }; }
  if (token.uncanny && card.kind === 'archive' && card.level <= token.uncanny.access) return { cls: 'ready', text: `Acceso ${token.uncanny.access}` };
  if (!card.playable) return card.reaction ? { cls: 'no', text: 'Reacción' } : null;
  if (usedBy(token, cardUse(card, state))) return { cls: 'no', text: 'Usada' };
  const reason = missing(card, token);
  if (reason) return { cls: 'no', text: reason };
  if (card.reaction) return { cls: 'react', text: DUAL_REACTIONS.has(card.name) ? 'Reacción o acción' : 'Reacción' };
  return null;
}
export const statusBadge = status => status ? `<span class="vf-card-status ${e(status.cls)}">${e(status.text)}</span>` : '';

// The card's data as chips: price, reach, roll, damage.
export function cardChips(card, token) {
  const chips = [];
  const price = card.kind === 'archive' ? '1+ Resolve' : costLabel(card.cost || {});
  if (price && price !== 'Sin coste') chips.push(['cost', price]);
  const area = areaRule(card), rule = TARGET_RULES[card.name];
  if (area) chips.push(['reach', 'Área ' + area.reach]);
  else if (rule?.reach) chips.push(['reach', 'Objetivo · ' + rule.reach]);
  if (card.kind === 'archive') chips.push(['roll', `Knowledge · DC ${10 + (card.level || 1)}`]);
  else if (card.roll) chips.push(['roll', `${card.roll.traitId[0].toUpperCase()}${card.roll.traitId.slice(1)} · DC ${card.roll.dc}`]);
  const dmg = POWER_DAMAGE[card.name];
  if (dmg) chips.push(['dmg', `${dmg.formula(token)} ${dmg.type[0].toUpperCase()}${dmg.type.slice(1)}${dmg.tag ? ' · ' + dmg.tag : ''}`]);
  return chips;
}
const cap = text => String(text || '').replace(/^\w/, c => c.toUpperCase());
const chipsHTML = chips => chips.map(([tone, text]) => `<span class="card-chip ${tone}">${e(text)}</span>`).join('');

// ── Hover: the card, large and readable ──────────────────────────────────────────────────────
let previewTimer = null;
export function showPreview(hand, card, token, faceHTML) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    document.getElementById('card_preview')?.remove();
    const box = hand.root.getBoundingClientRect();
    const status = cardStatus(card, token);
    const panel = document.createElement('aside');
    panel.id = 'card_preview'; panel.className = 'card-preview';
    panel.style.right = `${Math.max(12, window.innerWidth - box.right)}px`;
    panel.style.bottom = `${Math.max(12, window.innerHeight - box.top + 14)}px`;
    panel.innerHTML = sanitizeHTML(`
      <div class="vf-card card-preview-face" aria-hidden="true">${faceHTML}</div>
      <div class="card-preview-side">
        <strong class="card-preview-title">${e(card.name)}</strong>
        ${status ? `<span class="card-preview-status ${e(status.cls)}">${e(status.text)}</span>` : ''}
        <div class="card-chips">${chipsHTML(cardChips(card, token))}</div>
        <p class="card-preview-summary">${e(cardSummary(card, token))}</p>
        <p class="card-preview-rules">${e(card.text || '')}</p>
        ${card.playable ? '<p class="card-preview-hint"><b>Clic</b> o arrastrar al mapa: usar · <b>Doble clic</b>: opciones</p>' : ''}
      </div>`);
    document.body.append(panel);
  }, 280);
}
export function hidePreview() { clearTimeout(previewTimer); document.getElementById('card_preview')?.remove(); }

// ── One click: what the card needs ──────────────────────────────────────────────────────────
// 'dialog': it has choices that cannot be guessed; 'aim': a target on the map; 'area': an area
// around the caster to confirm; 'play': nothing else, it is played at once.
export function quickPlan(card, token) {
  if (card.chooseTrait || card.reverse || card.kind === 'beardown' || cardRollOptions(card) || (card.cost?.open && card.cost?.resolve)) return 'dialog';
  if (card.kind === 'effort' && (token.effort || 0) < (card.cost?.effort || 0)) return 'dialog';
  if (areaRule(card)) return 'area';
  if (TARGET_RULES[card.name]) return 'aim';
  return 'play';
}

// ── The Domain emblem under the pointer (v2.42.0) ───────────────────────────────────────────
// Dragging a Power, or aiming it, the pointer carries its Domain's emblem, glowing in its colour.
const DOMAINS = ['tech', 'synthesis', 'social', 'neural', 'kinetic', 'void', 'lux'];
const GLOW = { tech: '#22d3ee', synthesis: '#4ade80', social: '#fb7185', neural: '#c084fc', kinetic: '#f87171', void: '#a78bfa', lux: '#fde047' };
export function domainEmblem(card) {
  const domain = String(card?.domain || '').toLowerCase();
  return DOMAINS.includes(domain) ? { src: `/assets/cards/domain-${domain}-flag.png`, glow: GLOW[domain] } : null;
}
export function emblemNode(card) {
  const emblem = domainEmblem(card);
  if (!emblem || typeof document === 'undefined') return null;
  const node = document.createElement('div');
  node.className = 'card-emblem-cursor';
  node.style.setProperty('--glow', emblem.glow);
  const img = document.createElement('img'); img.src = emblem.src; img.alt = ''; node.append(img);
  return node;
}
let follower = null, followMove = null;
function followPointer(card) {
  unfollow();
  follower = emblemNode(card);
  if (!follower) return;
  follower.classList.add('aiming');
  document.body.append(follower);
  followMove = event => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; follower.hidden = false; };
  follower.hidden = true;
  window.addEventListener('pointermove', followMove, true);
}
function unfollow() {
  if (followMove) window.removeEventListener('pointermove', followMove, true);
  follower?.remove(); follower = null; followMove = null;
}

// ── Aim on the map ───────────────────────────────────────────────────────────────────────────
let aim = null;
const banner = text => {
  let el = document.getElementById('card_aim_banner');
  if (!el) { el = document.createElement('div'); el.id = 'card_aim_banner'; el.className = 'card-aim-banner'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.innerHTML = sanitizeHTML(text);
};
export const aiming = () => aim;
export function stopAim() {
  if (!aim) return;
  const { canvas, onDown, onKey, swallow } = aim;
  canvas?.removeEventListener('pointerdown', onDown, true);
  window.removeEventListener('keydown', onKey, true);
  for (const type of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerup', 'contextmenu']) canvas?.removeEventListener(type, swallow, true);
  document.getElementById('card_aim_banner')?.remove();
  document.body.classList.remove('card-aiming');
  if (aim.markedId) window.veilCanvas?.setAttackTarget?.(null, null);
  unfollow();
  aim = null; window.veilCardAim = null;
  window.veilCanvas?.requestRender?.();
}
// plan: 'aim' or 'area'. onConfirm(targetIds) plays the card. Like an attack (v2.42.0): the first
// touch on a token marks it (the line and the distance on the map); touching it again casts.
// `preselect`: the token the card was dropped on, already marked.
export function startAim(card, token, plan, onConfirm, { preselect = null } = {}) {
  stopAim();
  const canvas = window.veilCanvas?.canvas || document.getElementById('tactical_canvas');
  const map = store.getActiveMap?.() || {};
  if (!canvas) { onConfirm([]); return; }
  const rule = TARGET_RULES[card.name], area = plan === 'area' ? areaRule(card) : null;
  const valid = area ? areaTargets(token, area, store) : store.state.tokens.filter(t => t.mapId === token.mapId && !t.hidden && (t.id !== token.id || rule?.self) && eligible(token, t, map, rule));
  const reach = area?.reach || rule?.reach || '';
  window.veilCardAim = { casterId: token.id, area: !!area, reach, radius: reach ? areaRadius(token, map, reach) : 0, validIds: valid.map(t => t.id), color: card.color || '#00f3ff' };
  const optional = !area && rule?.object;
  const say = () => {
    if (area) banner(`<b>${e(card.name)}</b> · Área ${e(reach)} alrededor de ${e(token.name)} · ${valid.length ? `${valid.length} dentro: ${e(valid.map(t => t.name).join(', '))}` : 'nadie dentro'} · <kbd>Clic</kbd> en el mapa para lanzar · <kbd>Esc</kbd> cancela`);
    else if (aim?.markedId) {
      const marked = store.state.tokens.find(t => t.id === aim.markedId), gap = marked && distanceInfo(token, marked, map);
      banner(`<b>${e(card.name)}</b> · Objetivo: <b>${e(marked?.name || '')}</b>${gap ? ` · ${e(gap.band)} · ${gap.meters.toFixed(1)} m` : ''} · <b>toca otra vez el objetivo para lanzar</b> · <kbd>Esc</kbd> cancela`);
    } else banner(`Apuntando · <b>${e(card.name)}</b>${reach ? ` · alcance ${e(reach)}` : ''} · ${valid.length ? 'toca un objetivo iluminado' : 'no hay objetivos válidos a tu alcance'}${optional ? ' · <kbd>Enter</kbd>: sin objetivo' : ''} · <kbd>Esc</kbd> cancela`);
  };
  const confirm = ids => { stopAim(); onConfirm(ids); };
  const mark = target => {
    aim.markedId = target.id;
    window.veilCardAim = { ...window.veilCardAim, markedId: target.id };
    window.veilCanvas?.setAttackTarget?.(token.id, target.id);
    say(); window.veilCanvas?.requestRender?.();
  };
  const onDown = event => {
    if (event.button === 2) { event.preventDefault(); event.stopImmediatePropagation(); stopAim(); return; }
    const engine = window.veilCanvas;
    if (!engine?.screenToWorld) return;
    const rect = canvas.getBoundingClientRect(), world = engine.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    event.preventDefault(); event.stopImmediatePropagation();
    if (area) { confirm(valid.map(t => t.id)); return; }
    const target = tokenAtPoint(store.getTokensForActiveMap(), world, map.gridSize || 64, { includeHidden: false });
    if (!target) return;
    if (!window.veilCardAim?.validIds.includes(target.id)) { notify(`${target.name} no es un objetivo válido para ${card.name}${reach ? ` (alcance ${reach})` : ''}.`, 'error'); return; }
    if (aim.markedId === target.id) confirm([target.id]);
    else mark(target);
  };
  const onKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); stopAim(); }
    else if (event.key === 'Enter' && aim?.markedId) { event.preventDefault(); confirm([aim.markedId]); }
    else if (event.key === 'Enter' && (area || optional)) { event.preventDefault(); confirm(area ? valid.map(t => t.id) : []); }
  };
  const swallow = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  canvas.addEventListener('pointerdown', onDown, true);
  window.addEventListener('keydown', onKey, true);
  for (const type of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerup', 'contextmenu']) canvas.addEventListener(type, swallow, true);
  document.body.classList.add('card-aiming');
  aim = { card, tokenId: token.id, canvas, onDown, onKey, swallow, markedId: null };
  followPointer(card);
  const dropped = !area && preselect && store.state.tokens.find(t => t.id === preselect);
  if (dropped && valid.some(t => t.id === dropped.id)) mark(dropped);
  else { if (dropped && dropped.id !== token.id) notify(`${dropped.name} no es un objetivo válido para ${card.name}${reach ? ` (alcance ${reach})` : ''}.`, 'error'); say(); }
  window.veilCanvas?.requestRender?.();
}

// ── The resolution card beside the hand ──────────────────────────────────────────────────────
let tracked = null, unsubscribe = null;
export function closeTracker() { unsubscribe?.(); unsubscribe = null; tracked = null; document.getElementById('card_tracker')?.remove(); }
function trackerHTML() {
  const { playId, card, tokenName, result } = tracked;
  const row = playId && resolutionLog(store, playId), record = row?.resolution;
  const names = ids => (ids || []).map(id => store.state.tokens.find(t => t.id === id)?.name).filter(Boolean).join(', ');
  const steps = [];
  const step = (state, html, sub = '') => steps.push(`<li class="${state}"><i>${state === 'done' ? '✓' : state === 'wait' ? '…' : state === 'fail' ? '✕' : '•'}</i><div>${html}${sub ? `<small>${sub}</small>` : ''}</div></li>`);
  const targets = names(record?.targetIds);
  if (record?.area) step('done', `Área ${e(record.area.reach)}: <b>${e(targets || 'nadie dentro')}</b>`);
  else if (targets) step('done', `Objetivo: <b>${e(targets)}</b>`);
  step(result.failed ? 'fail' : 'done', `Coste: <b>${e(String(result.summary || '').split(' · ').slice(1).join(' · ') || 'sin coste')}</b>`);
  if (record?.roll) {
    if (record.outcome) {
      const ok = /SUCCESS/i.test(record.outcome);
      step(ok ? 'done' : 'fail', `Tirada ${e(cap(record.roll.traitId))}: <b>${e(String(record.total ?? '?'))}</b> contra DC ${record.roll.dc}`, e(record.outcome));
    } else step('wait', `Tirada ${e(cap(record.roll.traitId))} contra DC ${record.roll.dc}`, 'tirando…');
  }
  for (const reply of record?.replies || []) {
    const who = store.state.tokens.find(t => t.id === reply.actorId)?.name || 'Objetivo';
    step(reply.outcome ? (/SUCCESS/i.test(reply.outcome) ? 'done' : 'fail') : 'wait', `${e(who)} · ${e(cap(reply.traitId))} DC ${reply.dc}${reply.outcome ? `: ${e(String(reply.total))}` : ''}`, e(reply.consequence || reply.outcome || 'pendiente'));
  }
  const notes = (record?.notes?.length ? record.notes : result.notes || []).filter(note => note && !/^Tirada: /.test(note) && !/^Área \w/.test(note));
  if (notes.length) step('done', 'Efecto', e(notes.join(' ')));
  if (POWER_DAMAGE[card.name] && /SUCCESS/i.test(record?.outcome || '')) step('wait', 'Daño preparado', 'El Keeper decide escudos y reacciones');
  if (record) step(record.phase === 'done' ? 'done' : 'wait', record.phase === 'done' ? 'Resuelta' : 'Abierta en la mesa', record.phase === 'done' ? '' : 'El Keeper puede ajustarla o finalizarla');
  return `<header><strong>${e(card.name)}</strong><span>${e(tokenName)}</span><button type="button" class="card-tracker-close" data-tracker-close aria-label="Cerrar">×</button></header>
    <ol class="card-tracker-steps">${steps.join('')}</ol>
    ${record ? '<footer><button type="button" class="hud-btn hud-btn-xs" data-tracker-detail>Ver detalle</button></footer>' : ''}`;
}
function drawTracker(hand) {
  if (!tracked) return;
  let el = document.getElementById('card_tracker');
  if (!el) { el = document.createElement('section'); el.id = 'card_tracker'; el.className = 'card-tracker'; el.setAttribute('aria-live', 'polite'); document.body.append(el); }
  const box = hand.root.getBoundingClientRect();
  el.style.right = `${Math.max(12, window.innerWidth - box.right)}px`;
  el.style.bottom = `${Math.max(12, window.innerHeight - box.top + 14)}px`;
  el.innerHTML = sanitizeHTML(trackerHTML());
  el.querySelector('[data-tracker-close]').onclick = closeTracker;
  const detail = el.querySelector('[data-tracker-detail]');
  if (detail) detail.onclick = async () => { const { openResolution } = await import('./cardResolutionUI.js'); openResolution(tracked.playId); };
}
export function trackPlay(hand, card, token, result) {
  closeTracker();
  tracked = { playId: result?.id || null, card, tokenName: token.name, result: result || {} };
  drawTracker(hand);
  let last = '';
  unsubscribe = store.subscribe(() => {
    const record = tracked?.playId && resolutionLog(store, tracked.playId)?.resolution;
    const signature = JSON.stringify(record || null);
    if (signature !== last) { last = signature; drawTracker(hand); }
  });
}

// The default mode of a card with modes (the first printed).
export const defaultMode = card => CARD_MODES[card.name]?.[0];
