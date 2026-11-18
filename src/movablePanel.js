// Movable panels (V3): the card hand and the character bar can be dragged by their grip to any
// place on the map; the place is remembered on this browser (as a fraction of the map area, so
// it survives a resize). A double click on the grip puts the panel back in its usual place.
const KEY = name => `veil.panel.${name}`;
const read = name => { try { return JSON.parse(localStorage.getItem(KEY(name)) || 'null'); } catch { return null; } };
const write = (name, value) => { try { if (value) localStorage.setItem(KEY(name), JSON.stringify(value)); else localStorage.removeItem(KEY(name)); } catch {} };

export function makeMovable(el, name, { label = 'panel' } = {}) {
  if (!el || el.dataset.movable) return null;
  el.dataset.movable = name;
  const grip = document.createElement('button');
  grip.type = 'button'; grip.className = 'move-grip'; grip.textContent = '⠿';
  grip.title = `Arrastra para mover ${label} · doble clic: volver a su sitio`;
  grip.setAttribute('aria-label', `Mover ${label}`);
  const parent = () => el.offsetParent || el.parentElement;
  const place = (left, top) => {
    const box = parent()?.getBoundingClientRect(); if (!box) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const x = Math.max(0, Math.min(box.width - Math.min(w, box.width), left)), y = Math.max(0, Math.min(box.height - Math.min(h, box.height), top));
    Object.assign(el.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, right: 'auto', bottom: 'auto', transform: 'none' });
    el.classList.add('is-moved');
    return { fx: box.width ? x / box.width : 0, fy: box.height ? y / box.height : 0 };
  };
  const restore = () => {
    const saved = read(name), box = parent()?.getBoundingClientRect();
    if (!saved || !box || !box.width) return;
    place(saved.fx * box.width, saved.fy * box.height);
  };
  const reset = () => { write(name, null); el.classList.remove('is-moved'); for (const k of ['left', 'top', 'right', 'bottom', 'transform']) el.style[k] = ''; };
  grip.addEventListener('pointerdown', event => {
    event.preventDefault(); event.stopPropagation();
    const box = parent().getBoundingClientRect(), rect = el.getBoundingClientRect();
    const dx = event.clientX - rect.left, dy = event.clientY - rect.top;
    grip.setPointerCapture?.(event.pointerId); el.classList.add('is-moving');
    let last = null;
    const move = e => { last = place(e.clientX - box.left - dx, e.clientY - box.top - dy); };
    const up = () => { grip.removeEventListener('pointermove', move); el.classList.remove('is-moving'); if (last) write(name, last); };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up, { once: true });
    grip.addEventListener('pointercancel', up, { once: true });
  });
  for (const type of ['mousedown', 'click', 'dblclick', 'contextmenu']) grip.addEventListener(type, event => event.stopPropagation());
  grip.addEventListener('dblclick', reset);
  // The panel redraws its content: the grip is put back each time.
  const ensure = () => { if (grip.parentElement !== el) el.prepend(grip); };
  new MutationObserver(ensure).observe(el, { childList: true });
  ensure();
  requestAnimationFrame(restore);
  window.addEventListener('resize', restore);
  return { reset, restore };
}
