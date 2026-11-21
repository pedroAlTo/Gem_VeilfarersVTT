// Font sets (v2.29.0, user decision 21 Nov 2026): the user chose mockups B and E and switches
// between them in Ajustes. Both raise every small label to at least 10 px (--fs-min); the map's
// own text (canvas) follows the chosen set through canvasFont(). The choice stays on this browser.
export const FONT_SETS = {
  b: { name: 'Exo 2', note: 'Exo 2 en títulos y botones, Inter en el texto', display: '"Exo 2", sans-serif', hud: '"Exo 2", sans-serif', body: '"Inter", sans-serif', mono: '"JetBrains Mono", ui-monospace, monospace' },
  e: { name: 'Sobria', note: 'Orbitron solo en títulos, Inter en todo lo demás', display: '"Orbitron", sans-serif', hud: '"Inter", sans-serif', body: '"Inter", sans-serif', mono: '"JetBrains Mono", ui-monospace, monospace' },
};
const KEY = 'veil.fonts';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
let current = FONT_SETS[read()] ? read() : 'b';

export const currentFontSet = () => current;
// The family for text drawn on the map: 'hud' (labels, nameplates) or 'display' (titles).
export const canvasFont = (kind = 'hud') => FONT_SETS[current][kind === 'display' ? 'display' : 'hud'];

export function applyFontSet(id = current) {
  if (!FONT_SETS[id]) id = 'b';
  current = id;
  if (typeof document !== 'undefined') document.documentElement.dataset.fonts = id;
  try { localStorage.setItem(KEY, id); } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('veil:fonts', { detail: { id } }));
  return id;
}
