// How the tokens show their HP, Stress and Escudos on the map (v2.58.0): «Barras» (two or three
// slim bars under the name) or «Anillos» (segmented rings around the token). A choice of each
// viewer, kept on this browser (Ajustes → Vida en el mapa).
export const VITALS_STYLES = [['bars', 'Barras'], ['rings', 'Anillos']];
const KEY = 'veil.vitals.style';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
let current = VITALS_STYLES.some(([id]) => id === read()) ? read() : 'bars';
export const vitalsStyle = () => current;
export function setVitalsStyle(style) {
  current = VITALS_STYLES.some(([id]) => id === style) ? style : 'bars';
  try { localStorage.setItem(KEY, current); } catch {}
  return current;
}
