// The first-use guide on screen: a small panel at the bottom left of the table with the steps
// of the current role. Steps tick themselves when the action really happens.
import { store } from './state.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import {
  stepsFor, guideRole, readProgress, writeProgress, mark, settled, stepsFromState, baselineOf,
} from './onboarding.js';

// On a phone the guide starts as a small pill: expanded it would cover most of the map.
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 600px)').matches;
let panel = null, progress = readProgress(), base = null, minimized = narrow(), ctx = { cloud: false, keeperRoom: false };
let rooms = null, lastRole = '';

const role = () => guideRole(store.sessionRole, store.state.userRole);
const steps = () => stepsFor(role(), { cloud: ctx.cloud });
const tableVisible = () => {
  const lobby = document.getElementById('vf-lobby-gateway');
  return !lobby || lobby.classList.contains('hidden');
};
const seatId = () => store.memberId || store.peerId || rooms?.service?.uid || '';

function save() { writeProgress(progress); }

function complete(ids) {
  let changed = false;
  for (const id of ids) if (steps().some(step => step.id === id)) changed = mark(progress, role(), id) || changed;
  if (changed) { save(); render(); }
}

// Briefly outlines the element a step talks about, and scrolls it into view.
function spotlight(step) {
  const target = (step.target || []).map(selector => document.querySelector(selector)).find(el => el && el.getClientRects().length);
  if (!target) return false;
  target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  target.classList.remove('guide-spot'); void target.offsetWidth; target.classList.add('guide-spot');
  setTimeout(() => target.classList.remove('guide-spot'), 4200);
  return true;
}

function render() {
  if (!panel) return;
  const r = role(), entry = progress[r], list = steps();
  const show = tableVisible() && !entry.closed && list.length > 0;
  lastRole = r;
  panel.hidden = !show;
  if (!show) return;
  const count = list.filter(step => settled(entry, step.id)).length;
  const current = list.find(step => !settled(entry, step.id));
  const title = r === 'keeper' ? 'Primeros pasos · Keeper' : 'Primeros pasos · Jugador';
  if (minimized) {
    panel.innerHTML = sanitizeHTML(`<button type="button" class="guide-pill" data-guide-expand aria-label="Mostrar la guía"><span>${title}</span> <strong>${count} / ${list.length}</strong></button>`);
    panel.querySelector('[data-guide-expand]').onclick = () => { minimized = false; render(); };
    return;
  }
  const done = !current;
  panel.innerHTML = sanitizeHTML(`
    <header class="guide-head">
      <div><span class="guide-eyebrow">${title}</span><strong class="guide-count">${count} / ${list.length}</strong></div>
      <div class="guide-head-actions">
        <button type="button" class="guide-icon" data-guide-min title="Minimizar" aria-label="Minimizar">–</button>
        <button type="button" class="guide-icon" data-guide-close title="Cerrar la guía" aria-label="Cerrar la guía">×</button>
      </div>
    </header>
    <div class="guide-bar"><span style="width:${Math.round(count / list.length * 100)}%"></span></div>
    ${done ? `<div class="guide-done"><strong>¡Listo!</strong><p>Ya conoces lo básico. La ayuda (botón AYUDA) explica el resto de herramientas.</p><button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-guide-finish>Cerrar la guía</button></div>` : ''}
    <ol class="guide-steps">${list.map(step => {
      const state = entry.done.includes(step.id) ? 'done' : entry.skipped.includes(step.id) ? 'skipped' : step === current ? 'current' : 'todo';
      return `<li class="guide-step ${state}" data-step="${e(step.id)}">
        <span class="guide-check" aria-hidden="true">${state === 'done' ? '✓' : state === 'skipped' ? '–' : ''}</span>
        <div><span class="guide-step-title">${e(step.title)}</span>${state === 'current' ? `<p>${e(step.text)}</p>
          <div class="guide-step-actions"><button type="button" class="hud-btn hud-btn-xs" data-guide-show>Muéstramelo</button><button type="button" class="hud-btn hud-btn-xs" data-guide-skip>Saltar paso</button></div>` : ''}</div>
      </li>`;
    }).join('')}</ol>`);
  panel.querySelector('[data-guide-min]').onclick = () => { minimized = true; render(); };
  const close = () => { progress[r].closed = true; save(); render(); notify('Puedes volver a ver los primeros pasos desde AYUDA.'); };
  panel.querySelector('[data-guide-close]').onclick = close;
  panel.querySelector('[data-guide-finish]')?.addEventListener('click', close);
  panel.querySelector('[data-guide-show]')?.addEventListener('click', event => {
    if (!spotlight(current)) { event.currentTarget.textContent = 'No está a la vista'; event.currentTarget.disabled = true; }
  });
  panel.querySelector('[data-guide-skip]')?.addEventListener('click', () => { mark(progress, r, current.id, 'skipped'); save(); render(); });
}

function checkState() {
  if (!base) base = baselineOf(store.state);
  // A character assigned later starts its "move" from where it was first seen.
  for (const token of store.state.tokens || []) if (!base.positions[token.id]) base.positions[token.id] = { x: token.x, y: token.y };
  complete(stepsFromState(role(), base, store.state, { seatId: seatId(), keeperRoom: ctx.keeperRoom, previewTokenId: store.sessionRole === 'player' ? '' : store.state.selectedTokenId }));
}

// Opens the guide again (from the help), optionally from the start.
export function reopenGuide({ restart = false } = {}) {
  const r = role();
  if (restart) progress[r] = { done: [], skipped: [], closed: false };
  else progress[r].closed = false;
  minimized = false; base = baselineOf(store.state); save();
  render(); checkState();
}

export async function mountOnboarding({ cloud = false } = {}) {
  if (panel || typeof document === 'undefined') return;
  ctx.cloud = cloud;
  panel = document.createElement('aside');
  panel.className = 'guide-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Guía de primer uso'); panel.setAttribute('aria-live', 'polite');
  // Inside the map, top right: clear of the Fear track and clocks (top left) and of the hand.
  const host = document.getElementById('canvas_viewport_root');
  if (host) { panel.classList.add('in-map'); host.append(panel); } else document.body.append(panel);
  for (const type of ['pointerdown', 'mousedown', 'wheel', 'dblclick', 'contextmenu']) panel.addEventListener(type, event => event.stopPropagation());
  store.subscribe((_state, keys) => {
    if (keys.some(k => ['tokens', 'maps', 'activeMapId', 'fear', 'claimedTokenId', 'selectedTokenId', 'userRole'].includes(k))) checkState();
    if (role() !== lastRole) render();
  });
  window.addEventListener('veil:guide', event => complete([event.detail?.event].filter(Boolean)));
  window.addEventListener('veil:language', render);
  const lobby = document.getElementById('vf-lobby-gateway');
  if (lobby) new MutationObserver(() => { if (tableVisible()) base ||= baselineOf(store.state); render(); }).observe(lobby, { attributes: true, attributeFilter: ['class'] });
  if (cloud) {
    try {
      ({ rooms } = await import('./roomController.js'));
      rooms.subscribe(() => { ctx.keeperRoom = !!rooms.room && rooms.isKeeper; checkState(); if (role() !== lastRole) render(); });
    } catch {}
  }
  if (tableVisible()) base = baselineOf(store.state);
  render(); checkState();
}
