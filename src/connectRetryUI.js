// Entering a room keeps trying until it connects, with a visible counter and a Cancel button.
// Errors that a retry cannot fix (the room is gone, you were removed, you are not signed in)
// stop at once and are shown as before.
import { sanitizeHTML } from './ui.js';
import { every } from './backgroundTicker.js';

const PERMANENT = [/ya no existe/i, /expulsado/i, /retirado tu acceso/i, /solo el propietario/i, /invitación no existe/i, /pega el código/i, /inicia sesión/i, /cuenta ha cambiado/i];
export const isPermanentRoomError = error => error?.code === 'permission-denied' || error?.code === 'not-found' || error?.code === 'resource-exhausted' || /quota exceeded/i.test(String(error?.message || '')) || PERMANENT.some(pattern => pattern.test(String(error?.message || '')));
// 2 s, 4 s, 8 s, then every 15 s.
export const retryDelay = attempt => Math.min(15000, 2000 * 2 ** Math.max(0, Math.min(attempt - 1, 3)));

let active = null;

function panel(label) {
  const box = document.createElement('aside');
  box.className = 'connect-retry'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
  box.innerHTML = sanitizeHTML(`<div class="connect-retry-spinner" aria-hidden="true"></div>
    <div class="connect-retry-text"><strong>${label}</strong><span data-retry-state></span><small data-retry-error></small></div>
    <button type="button" class="hud-btn hud-btn-xs" data-retry-cancel>Cancelar</button>`);
  document.body.append(box);
  return box;
}

// task: an async function that connects (rooms.enter, rooms.join...). Resolves true once it
// succeeds, false if the person cancels; rejects with an error a retry cannot fix.
export function retryUntilConnected(task, { label = 'Conectando con la sala', onCancel = () => {}, wait = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  active?.cancel();
  if (typeof document === 'undefined') return task().then(() => true);
  const box = panel(label);
  const state = box.querySelector('[data-retry-state]'), errorLine = box.querySelector('[data-retry-error]');
  let cancelled = false, stopCountdown = null, wake = null;
  const close = () => { stopCountdown?.(); box.remove(); if (active?.box === box) active = null; };
  const cancel = () => { if (cancelled) return; cancelled = true; wake?.(); close(); onCancel(); };
  box.querySelector('[data-retry-cancel]').onclick = cancel;
  active = { box, cancel };
  return (async () => {
    for (let attempt = 1; ; attempt++) {
      if (cancelled) return false;
      state.textContent = attempt === 1 ? 'Conectando…' : `Intento ${attempt}…`;
      try {
        await task();
        if (cancelled) return false;
        close(); return true;
      } catch (error) {
        if (cancelled) return false;
        if (isPermanentRoomError(error)) { close(); throw error; }
        errorLine.textContent = String(error?.message || error || '');
        const delay = retryDelay(attempt), until = Date.now() + delay;
        const paint = () => { state.textContent = `Reintentando en ${Math.max(0, Math.ceil((until - Date.now()) / 1000))} s · intento ${attempt + 1} (puedes cancelar)`; };
        paint(); stopCountdown = every(1000, paint);
        await Promise.race([wait(delay), new Promise(resolve => { wake = resolve; })]);
        stopCountdown?.(); stopCountdown = null; wake = null;
      }
    }
  })();
}

// Inside a room but not connected yet (a player waiting for the Keeper or reconnecting, a
// Keeper recovering the room after a cut): the same panel, with the attempt and the countdown
// to the next one. Cancel leaves the room and goes back to the home screen.
export function mountRoomConnectionBanner(rooms, store, { roomOnline }) {
  if (typeof document === 'undefined') return () => {};
  let box = null;
  const hide = () => { box?.remove(); box = null; };
  const show = (title, line) => {
    if (active) { hide(); return; } // the entry panel is already on screen
    if (!box) {
      box = panel(title); box.classList.add('connect-retry-room');
      box.querySelector('[data-retry-cancel]').onclick = () => {
        hide();
        rooms.leave({ preserveRemembered: false, save: rooms.isKeeper }).catch(() => {}).finally(() => window.veilLobby?.showHubScreen?.());
      };
    }
    box.querySelector('strong').textContent = title;
    box.querySelector('[data-retry-state]').textContent = line;
    box.querySelector('[data-retry-error]').textContent = rooms.lastError || '';
  };
  const paint = () => {
    const room = rooms.room;
    if (!room || rooms.leaving || store.state.isConnected) { hide(); return; }
    const now = rooms.clock ? rooms.clock() : Date.now();
    if (rooms.isKeeper) { show('Reconectando la sala', 'Recuperando la conexión con la nube… (puedes cancelar)'); return; }
    if (!roomOnline(room, now)) { show('Esperando al Keeper', 'La sala está en pausa hasta que el Keeper vuelva. Se conectará sola (puedes cancelar).'); return; }
    const wait = Math.max(0, Math.ceil(((rooms.retryAt || 0) - now) / 1000)), attempt = rooms.connectAttempts || 1;
    show('Conectando con el Keeper', wait ? `Reintentando en ${wait} s · intento ${attempt + 1} (puedes cancelar)` : `Intento ${attempt}… (puedes cancelar)`);
  };
  const stop = every(1000, paint);
  const off = rooms.subscribe(paint);
  paint();
  return () => { stop(); off(); hide(); };
}
