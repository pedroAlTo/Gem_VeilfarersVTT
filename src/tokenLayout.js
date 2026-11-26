// What a token shows on the map and where (v2.59.0, the user's design of 25 nov 2026): its name
// (yes/no), its class insignia (yes/no) and, for each stat, a place: a bar below or above the token,
// the inner ring, the first outer ring or the second outer ring (outside the first); Armor and
// Resolve may also be small tokens on the right or the left of the token (8 × 8 px each, full or
// empty; Resolve as triangles for d4 and squares for d6). The numbers stay private: only the
// Keeper and the token's own player see the stats (canvasEngine.canSeeVitals).
export const LAYOUT_STATS = [['hp', 'HP'], ['path', 'Effort / Hope'], ['stress', 'Stress'], ['armor', 'Armadura'], ['resolve', 'Resolve']];
export const BAR_PLACES = [['none', 'No mostrar'], ['bottom', 'Barra inferior'], ['top', 'Barra superior'], ['inner1', 'Círculo interior'], ['outer1', 'Círculo exterior 1'], ['outer2', 'Círculo exterior 2 (por fuera del 1)']];
export const PIP_PLACES = [['right', 'Fichas a la derecha'], ['left', 'Fichas a la izquierda']];
export const PIP_STATS = new Set(['armor', 'resolve']);
export const RINGS = new Set(['inner1', 'outer1', 'outer2']);
export const DEFAULT_LAYOUT = { name: true, insignia: true, hp: 'bottom', path: 'none', stress: 'bottom', armor: 'none', resolve: 'none' };

export const placesFor = stat => PIP_STATS.has(stat) ? [...BAR_PLACES, ...PIP_PLACES] : BAR_PLACES;
const allowed = (stat, place) => placesFor(stat).some(([id]) => id === place);

export function validLayout(layout) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return false;
  for (const key of Object.keys(layout)) {
    if (key === 'name' || key === 'insignia') { if (typeof layout[key] !== 'boolean') return false; continue; }
    if (!LAYOUT_STATS.some(([id]) => id === key) || typeof layout[key] !== 'string' || !allowed(key, layout[key])) return false;
  }
  return true;
}

// The token's layout: its own, or the one its old display settings meant (bars for HP, Stress and
// Armor as they were ticked), or the default.
export function tokenLayout(token) {
  const own = validLayout(token?.vitalsLayout) ? token.vitalsLayout : null;
  if (own) return { ...DEFAULT_LAYOUT, ...own };
  const overlays = Array.isArray(token?.displayOverlays) ? token.displayOverlays : [];
  const cfg = token?.displayConfig || {};
  if (!overlays.length && !Object.keys(cfg).length) return { ...DEFAULT_LAYOUT };
  const wants = key => overlays.length ? overlays.some(o => o.statKey === key && o.type !== 'circular') : key === 'hp' ? cfg.showHpBar !== false || !!cfg.showHpCounter : key === 'stress' ? !!(cfg.showStressBar || cfg.showStressCounter) : !!cfg.showArmorCounter;
  return { ...DEFAULT_LAYOUT, hp: wants('hp') ? 'bottom' : 'none', stress: wants('stress') ? 'bottom' : 'none', armor: wants('armor') ? 'bottom' : 'none' };
}

// A stat's values for the map: { current, max, die? }, or null when the token has none.
export function statFor(token, key) {
  const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  if (key === 'hp') return token?.hp?.max ? { current: n(token.hp.current), max: n(token.hp.max) } : null;
  if (key === 'stress') return token?.stress?.max ? { current: n(token.stress.current), max: n(token.stress.max) } : null;
  if (key === 'armor') return token?.armor?.max ? { current: n(token.armor.current), max: n(token.armor.max) } : null;
  if (key === 'resolve') return token?.resolve?.max ? { current: n(token.resolve.current), max: n(token.resolve.max), die: token.resolve.dieType === 'd6' ? 'd6' : 'd4' } : null;
  if (key === 'path') {
    if (token?.isPlayer === false) return null;
    return token?.path === 'Sleeping' ? { current: n(token.effort), max: n(token.effortMax) || 6, label: 'EFFORT' } : { current: n(token.hope), max: n(token.hopeMax) || 6, label: 'HOPE' };
  }
  return null;
}

// Choosing a ring or a side for one stat frees it from any other stat that had it (one per ring,
// one per side); bars stack, so they are shared.
export function placeStat(layout, stat, place) {
  const next = { ...layout, [stat]: place };
  if (RINGS.has(place) || place === 'right' || place === 'left') {
    for (const [other] of LAYOUT_STATS) if (other !== stat && next[other] === place) next[other] = 'none';
  }
  return next;
}

// V (v2.59.0, user request: «la tecla V activa/desactiva los nombres de los tokens para los
// jugadores»): a player hides or shows every token's name on their own screen. Kept on this browser.
const NAMES_KEY = 'veil.names.hidden';
let namesOff = (() => { try { return localStorage.getItem(NAMES_KEY) === '1'; } catch { return false; } })();
export const namesHidden = () => namesOff;
export function toggleNames() {
  namesOff = !namesOff;
  try { localStorage.setItem(NAMES_KEY, namesOff ? '1' : '0'); } catch {}
  return namesOff;
}
