// Básico / Avanzado at the table (Plan de UX V3, fase 2, user decision of 25 Nov 2026). Básico, the
// default, plays with the fewest clicks: the table picks the usual option (Lucky Break rerolls the
// lower die…). Avanzado asks first and shows every option. A per-player preference of this screen.
const KEY = 'veil.table.mode';
const listeners = new Set();
export function tableMode() {
  try { return localStorage.getItem(KEY) === 'advanced' ? 'advanced' : 'basic'; } catch { return 'basic'; }
}
export const isAdvanced = () => tableMode() === 'advanced';
export function setTableMode(mode) {
  const next = mode === 'advanced' ? 'advanced' : 'basic';
  try { localStorage.setItem(KEY, next); } catch {}
  if (typeof document !== 'undefined') document.body?.setAttribute('data-table-mode', next);
  for (const fn of listeners) { try { fn(next); } catch {} }
  return next;
}
export const onTableMode = fn => { listeners.add(fn); return () => listeners.delete(fn); };
// Lucky Break in Básico: the lower of the two Duality Dice (on a tie, Fear).
export const luckyBreakDie = last => (Number(last?.hopeVal) < Number(last?.fearVal) ? 'hope' : 'fear');
