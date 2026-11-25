// Movable panels (V3): the character bar and the deck icon move by pressing on them and dragging,
// like any element of the table (no grip). A press without moving stays a normal click; past a
// few pixels it is a drag and that click does not fire. The place is remembered on this browser
// as a fraction of the map area (it survives a resize); a double click with Alt puts it back.
import { zoomOf } from './uiScale.js';
const KEY = name => `veil.panel.${name}`;
const read = name => { try { return JSON.parse(localStorage.getItem(KEY(name)) || 'null'); } catch { return null; } };
const write = (name, value) => { try { if (value) localStorage.setItem(KEY(name), JSON.stringify(value)); else localStorage.removeItem(KEY(name)); } catch {} };
const DRAG_AFTER = 6; // pixels before a press becomes a drag
const NOT_FROM = 'input, select, textarea, vf-select, [contenteditable="true"], .vf-card:not(.card-deck)';

// el: the element to move, or a function that finds it (for one that is redrawn).
// area: the element whose box the position is measured in (the map viewport).
// root: where presses are listened to (the element, or a container it lives in).
export function makeMovable(el, name, { area, root = null } = {}) {
  const target = typeof el === 'function' ? el : () => el;
  const listenOn = root || target();
  if (!listenOn || listenOn.dataset.movable?.includes(name)) return null;
  listenOn.dataset.movable = `${listenOn.dataset.movable || ''} ${name}`.trim();
  const box = () => (area || target()?.offsetParent || target()?.parentElement)?.getBoundingClientRect();
  // Puts the element at a viewport point (its top-left corner), clamped inside the area.
  const place = (vx, vy) => {
    const node = target(), b = box(); if (!node || !b) return null;
    const own = node.getBoundingClientRect(), w = own.width, h = own.height;
    const x = Math.max(b.left, Math.min(b.right - Math.min(w, b.width), vx)), y = Math.max(b.top, Math.min(b.bottom - Math.min(h, b.height), vy));
    const holder = node.offsetParent || node.parentElement, parent = holder.getBoundingClientRect();
    // Ajustes → Tamaño: zoom scales `left` and `top` (the node's own and its ancestors').
    const z = zoomOf(node);
    Object.assign(node.style, { position: 'absolute', left: `${Math.round((x - parent.left) / z)}px`, top: `${Math.round((y - parent.top) / z)}px`, right: 'auto', bottom: 'auto', transform: 'none', margin: '0' });
    node.classList.add('is-moved');
    return { fx: b.width ? (x - b.left) / b.width : 0, fy: b.height ? (y - b.top) / b.height : 0 };
  };
  const restore = () => {
    const saved = read(name), b = box();
    if (saved && b?.width) place(b.left + saved.fx * b.width, b.top + saved.fy * b.height);
  };
  const reset = () => { write(name, null); const node = target(); if (!node) return; node.classList.remove('is-moved'); for (const k of ['position', 'left', 'top', 'right', 'bottom', 'transform', 'margin']) node.style[k] = ''; };
  listenOn.addEventListener('pointerdown', event => {
    const node = target();
    if (!node || event.button !== 0 || !node.contains(event.target) || event.target.closest(NOT_FROM)) return;
    const rect = node.getBoundingClientRect(), startX = event.clientX, startY = event.clientY;
    const dx = startX - rect.left, dy = startY - rect.top;
    let dragging = false, last = null;
    const move = e => {
      if (!dragging) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_AFTER) return;
        dragging = true; node.classList.add('is-moving');
      }
      e.preventDefault();
      last = place(e.clientX - dx, e.clientY - dy);
    };
    const up = () => {
      window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
      if (!dragging) return;
      node.classList.remove('is-moving');
      if (last) write(name, last);
      // The click that ends a drag does not press the element.
      const swallow = e => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, true), 300);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  });
  // Alt + double click puts it back where it was at first.
  listenOn.addEventListener('dblclick', event => { const node = target(); if (event.altKey && node?.contains(event.target)) { event.stopPropagation(); reset(); } });
  // An element that is redrawn gets its place back each time.
  if (root) new MutationObserver(() => { if (read(name) && !target()?.classList.contains('is-moved')) restore(); }).observe(root, { childList: true, subtree: true });
  requestAnimationFrame(restore);
  window.addEventListener('resize', restore);
  return { reset, restore };
}
