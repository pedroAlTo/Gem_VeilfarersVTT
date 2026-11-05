import { sanitizeHTML } from './ui.js';

export function normalizeHex(value) {
  const text = String(value ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(text)) return '#' + [...text].map(c => c + c).join('').toLowerCase();
  return /^[0-9a-f]{6}$/i.test(text) ? '#' + text.toLowerCase() : null;
}
export function hexToHSV(hex) {
  const color = normalizeHex(hex) || '#00f3ff', [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: max === 0 ? 0 : d / max, v: max };
}
export function hsvToHex({ h, s, v }) {
  const hue = ((h % 360) + 360) % 360 / 60, c = v * s, x = c * (1 - Math.abs(hue % 2 - 1)), m = v - c;
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hue)];
  return '#' + rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('');
}
let closeActive;
export function openColorPickerPopover(anchor, currentColor = '#00f3ff', onColorChange = () => {}) {
  closeActive?.(false);
  const popover = document.createElement('div'); popover.className = 'cyber-color-popover glass-panel vf-color-picker';
  popover.setAttribute('role', 'dialog'); popover.setAttribute('aria-label', 'Tactical color picker');
  const presets = [['Cyan', '#00f3ff'], ['Sky', '#38bdf8'], ['Blue', '#3b82f6'], ['Violet', '#8b5cf6'], ['Magenta', '#d946ef'], ['Rose', '#ff2a5f'], ['Red', '#ef4444'], ['Amber', '#f59e0b'], ['Emerald', '#10b981'], ['Mint', '#34d399'], ['White', '#ffffff'], ['Slate', '#94a3b8']];
  let selected = normalizeHex(currentColor) || '#00f3ff', hsv = hexToHSV(selected);
  popover.innerHTML = sanitizeHTML(`
    <div class="pop-header"><span>TACTICAL COLOR</span><button type="button" class="pop-close-btn" aria-label="Close color picker">×</button></div>
    <div class="pop-color-plane" tabindex="0" role="group" aria-label="Saturation and brightness" aria-describedby="color_plane_hint"><span class="pop-color-cursor"></span></div>
    <span id="color_plane_hint" class="pop-hint">Drag to choose · arrow keys to fine-tune</span>
    <label class="pop-hue-label">Hue<input class="pop-hue" type="range" min="0" max="359" step="1" aria-label="Hue"></label>
    <div class="pop-presets">${presets.map(([name, color]) => `<button type="button" class="pop-swatch" style="background:${color}" data-color="${color}" aria-label="${name}" title="${name}"></button>`).join('')}</div>
    <div class="pop-custom-row"><label for="color_hex">HEX</label><input type="text" id="color_hex" class="pop-hex-input hud-input hud-input-xs" aria-label="Hex color" spellcheck="false" maxlength="7"><div class="pop-preview" aria-label="Selected color"></div></div>
    <div class="pop-actions"><span class="pop-hint pop-color-status" aria-live="polite">Changes apply live</span><button type="button" class="hud-btn hud-btn-xs hud-btn-primary pop-ok-btn">Done</button></div>`);
  document.body.append(popover);
  const plane = popover.querySelector('.pop-color-plane'), cursor = popover.querySelector('.pop-color-cursor'), hue = popover.querySelector('.pop-hue'), hex = popover.querySelector('.pop-hex-input'), preview = popover.querySelector('.pop-preview'), status = popover.querySelector('.pop-color-status');
  const draw = () => {
    plane.style.backgroundColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });
    cursor.style.left = `${hsv.s * 100}%`; cursor.style.top = `${(1 - hsv.v) * 100}%`;
    plane.setAttribute('aria-label', `Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`);
    hue.value = String(Math.round(hsv.h)); hue.setAttribute('aria-valuetext', `${Math.round(hsv.h)} degrees`);
    hex.value = selected; hex.removeAttribute('aria-invalid'); preview.style.background = selected;
    popover.querySelectorAll('.pop-swatch').forEach(swatch => { const active = swatch.dataset.color === selected; swatch.classList.toggle('active', active); swatch.setAttribute('aria-pressed', String(active)); });
    status.textContent = 'Changes apply live';
  };
  const applyHSV = () => { selected = hsvToHex(hsv); draw(); onColorChange(selected); };
  const applyHex = value => { const valid = normalizeHex(value); if (!valid) return false; selected = valid; hsv = hexToHSV(valid); draw(); onColorChange(valid); return true; };
  const atPointer = event => {
    const rect = plane.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    hsv.s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    hsv.v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)); applyHSV();
  };
  let pointer = null;
  plane.onpointerdown = event => { if (event.button !== 0) return; event.preventDefault(); plane.focus({ preventScroll: true }); pointer = event.pointerId; plane.setPointerCapture?.(pointer); atPointer(event); };
  plane.onpointermove = event => { if (pointer === event.pointerId) atPointer(event); };
  plane.onpointerup = event => { if (pointer === event.pointerId) { atPointer(event); plane.releasePointerCapture?.(pointer); pointer = null; } };
  plane.onpointercancel = plane.onlostpointercapture = () => { pointer = null; };
  plane.onkeydown = event => {
    const amount = event.shiftKey ? .1 : .01;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); if (event.key === 'ArrowLeft') hsv.s -= amount; if (event.key === 'ArrowRight') hsv.s += amount; if (event.key === 'ArrowUp') hsv.v += amount; if (event.key === 'ArrowDown') hsv.v -= amount;
    hsv.s = Math.max(0, Math.min(1, hsv.s)); hsv.v = Math.max(0, Math.min(1, hsv.v)); applyHSV();
  };
  hue.oninput = () => { hsv.h = Number(hue.value); applyHSV(); };
  popover.querySelectorAll('.pop-swatch').forEach(swatch => swatch.onclick = () => applyHex(swatch.dataset.color));
  // Partial typing never sends malformed CSS colors into saved game state.
  hex.oninput = () => { if (/^#?[0-9a-f]{6}$/i.test(hex.value.trim())) applyHex(hex.value); else { hex.setAttribute('aria-invalid', 'true'); status.textContent = 'Enter a 3- or 6-digit hex color'; } };
  hex.onchange = () => { if (!applyHex(hex.value)) { hex.setAttribute('aria-invalid', 'true'); status.textContent = 'Enter a 3- or 6-digit hex color'; } };
  const freshAnchor = () => anchor.isConnected ? anchor : anchor.id ? document.getElementById(anchor.id) : null;
  const outside = event => { if (!popover.contains(event.target) && !freshAnchor()?.contains(event.target)) close(false); };
  const reposition = () => {
    const rect = freshAnchor()?.getBoundingClientRect(); if (!rect) return;
    const width = popover.offsetWidth, height = popover.offsetHeight;
    popover.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - height - 8))}px`;
  };
  const close = (restoreFocus = true) => {
    document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', reposition);
    popover.remove(); if (closeActive === close) closeActive = null; if (restoreFocus) freshAnchor()?.focus({ preventScroll: true });
  };
  closeActive = close;
  popover.querySelector('.pop-close-btn').onclick = () => close();
  popover.querySelector('.pop-ok-btn').onclick = () => { if (hex.getAttribute('aria-invalid') === 'true' && !applyHex(hex.value)) { hex.focus(); return; } close(); };
  popover.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } });
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'click', 'dblclick', 'wheel']) popover.addEventListener(name, event => event.stopPropagation());
  document.addEventListener('pointerdown', outside, true); window.addEventListener('resize', reposition);
  draw(); reposition(); plane.focus({ preventScroll: true });
  return popover;
}
