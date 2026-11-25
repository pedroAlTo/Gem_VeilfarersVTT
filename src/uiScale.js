// Interface size (v2.56.0, Plan de UX V3, fase 6): the panels, the bars, the menus and the windows
// grow or shrink with CSS zoom; the map keeps its own zoom. The choice stays on this browser.
// Elements placed from the pointer or from another element's box (menus, lists, movable panels)
// divide their position by their own zoom (zoomOf), because zoom scales `left` and `top` too.
export const UI_SCALES = [
  { value: 0.9, label: 'Compacto' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Grande' },
  { value: 1.3, label: 'Muy grande' },
];
const KEY = 'veil.ui.scale';
const valid = n => UI_SCALES.some(s => s.value === n);
const read = () => { try { return Number(localStorage.getItem(KEY)); } catch { return NaN; } };
let current = valid(read()) ? read() : 1;

export const uiScale = () => current;

export function applyUiScale(value = current) {
  const n = Number(value);
  current = valid(n) ? n : 1;
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--ui-zoom', String(current));
    document.documentElement.dataset.uiSize = String(current);
  }
  try { localStorage.setItem(KEY, String(current)); } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('resize'));
  return current;
}

// The zoom an element is drawn with: its own and its ancestors' (1 where zoom is not supported).
export function zoomOf(el) {
  if (typeof getComputedStyle !== 'function') return 1;
  let z = 1;
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const own = parseFloat(getComputedStyle(node).zoom);
    if (Number.isFinite(own) && own > 0) z *= own;
  }
  return z;
}
