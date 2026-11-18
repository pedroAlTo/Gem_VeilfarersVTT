// Effects that add damage to an attack (V3), from an explicit list of the cards that do it
// (never by searching words in card texts):
// - Combat Surge (Soldier, Awakened): after a hit, 2 Hope → +1d6, once per attack.
// - The Held Line (Soldier, Sleeping): after a hit, 1 Effort → +1d6, once per attack.
// - Nirvana State / Disciplined State (Path to Nirvana, The Refused Path): the first Melee
//   attack against an enemy during the state deals +2d6 (applied by itself); Breaking Point ends
//   the state for a closing strike of +(Proficiency)d6, added once, never doubled on a Critical.
import { weaponRangeBand } from './attackFlow.js';
import { throwDice } from './tableDice.js';

const lower = v => String(v ?? '').trim().toLowerCase();
export const CARD_RIDERS = [
  { id: 'combat-surge', card: 'combat surge', label: 'Combat Surge', dice: '1d6', cost: '2 Hope' },
  { id: 'held-line', card: 'the held line', label: 'The Held Line', dice: '1d6', cost: '1 Effort' },
];
export const STATE_EFFECTS = ['path to nirvana', 'the refused path'];
const stateClock = token => (token?.effectClocks || []).find(c => STATE_EFFECTS.includes(lower(c.name)));

export function rollExpression(expr, roll = sides => Math.floor(Math.random() * sides) + 1) {
  const m = String(expr).match(/^(\d+)d(\d+)$/i);
  if (!m) return { total: 0, faces: [] };
  const faces = Array.from({ length: Math.min(20, Number(m[1])) }, () => roll(Number(m[2])));
  return { total: faces.reduce((a, b) => a + b, 0), faces };
}

// The same, thrown as 3D dice (the result card shows it to the table).
export async function throwExpression(expr, label, actor = null) {
  const m = String(expr).match(/^(\d+)d(\d+)$/i);
  if (!m) return { total: 0, faces: [] };
  const faces = await throwDice([{ qty: Math.min(20, Number(m[1])), sides: Number(m[2]), role: 'Damage' }], { label, actor,
    describe: v => ({ outcome: `+${v.reduce((a, b) => a + b, 0)} daño`, modifiers: `${expr} [${v.join(', ')}]` }) });
  return { total: faces.reduce((a, b) => a + b, 0), faces };
}

// What the player can still add to the damage of the attack just made. `cards`: their hand.
export function availableRiders(token, cards = [], used = []) {
  if (!token) return [];
  const out = [];
  for (const r of CARD_RIDERS) {
    if (used.includes(r.id)) continue;
    const card = cards.find(c => c.playable && lower(c.name) === r.card);
    if (!card) continue;
    const enough = (token.hope || 0) >= (card.cost?.hope || 0) && (token.effort || 0) >= (card.cost?.effort || 0);
    out.push({ ...r, kind: 'card', cardId: card.id, enough });
  }
  const state = stateClock(token);
  if (state && !used.includes('breaking-point')) {
    const p = Math.max(1, Math.min(10, Number(token.proficiency) || 1));
    out.push({ id: 'breaking-point', label: 'Breaking Point', dice: `${p}d6`, cost: `termina ${state.name}`, kind: 'state', clockId: state.id, enough: true });
  }
  return out;
}

// The state's first Melee attack against an enemy: +2d6, once. null otherwise.
export function firstStrikeRider(token, weapon) {
  const state = stateClock(token);
  if (!state || state.firstStrikeUsed) return null;
  const melee = !weapon || weaponRangeBand(weapon) === 'Melee';
  return melee ? { id: 'first-strike', label: `${state.name} · primer golpe`, dice: '2d6', clockId: state.id } : null;
}
