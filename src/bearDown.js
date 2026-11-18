// Bear Down (Corebook, Sleeping): after any Duality Roll, attack, reaction or damage roll, before
// the outcome is narrated, spend Resolve Dice and add their total. It adds to the total only:
// never changes which die came up higher, never makes a critical. Used by the Bear Down card
// and by the Resolve control of the player's Ficha.
import { store } from './state.js';
import { network } from './networkManager.js';
import { throwDice } from './tableDice.js';

// What Bear Down would add to right now for this character: 'damage' (an open damage roll),
// 'check' (the latest roll), or '' (nothing to add to).
export function bearDownTarget(tokenId, dice = typeof window !== 'undefined' ? window.veilDiceRoller : null) {
  if (!dice) return '';
  if (dice.pendingDamageFor?.(tokenId)) return 'damage';
  const last = dice.lastResult;
  return dice.lastRollKind === 'check' && last && (last.actorId === tokenId) ? 'check' : '';
}

export async function bearDown(token, count, dice = window.veilDiceRoller) {
  const damage = dice?.pendingDamageFor?.(token.id);
  const n = Math.max(1, Math.min(token.resolve?.current || 1, Number(count) || 1)), sides = token.resolve?.dieType === 'd6' ? 6 : 4;
  if ((token.resolve?.current || 0) < 1) throw new Error('No Resolve available.');
  // The Resolve Dice are thrown as 3D dice; the table adds the faces they show.
  const faces = await throwDice([{ qty: n, sides, role: 'Resolve' }], { label: `Bear Down · ${token.name}`, actor: token,
    describe: v => ({ total: v.reduce((a, b) => a + b, 0), outcome: `+${v.reduce((a, b) => a + b, 0)}`, modifiers: `${n}d${sides} [${v.join(', ')}]` }) });
  const result = await network.requestAction({ type: 'RESOLVE', actorId: token.id, count: n, faces, visibility: dice?.rollVisibility?.() || 'table', ...(damage ? { target: 'damage' } : {}) });
  const rolled = `Bear Down ${result.bearDown.count}${token.resolve?.dieType || 'd4'} [${result.bearDown.dice.join(', ')}] = +${result.bearDown.bonus}`;
  if (damage) {
    const updated = await dice.applyBearDownDamage(result.bearDown.bonus);
    return { result, summary: `${rolled} al daño: ${updated?.raw ?? '?'} (${updated?.severity ?? ''}).` };
  }
  await dice?.applyBearDown(result);
  return { result, summary: `${rolled}: total ${result.total} vs DC ${result.dc}. ${result.outcomeTitle}.` };
}

// Prepare (Corebook, rests) lives with the rests.
export { prepareResolve } from './rest.js';
