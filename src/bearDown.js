// Bear Down (Corebook, Sleeping): after any Duality Roll, attack, reaction or damage roll, before
// the outcome is narrated, spend Resolve Dice and add their total. It adds to the total only:
// never changes which die came up higher, never makes a critical. Used by the Bear Down card
// and by the Resolve control of the player's Ficha.
import { store } from './state.js';
import { network } from './networkManager.js';

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
  const result = await network.requestAction({ type: 'RESOLVE', actorId: token.id, count: Math.max(1, Number(count) || 1), visibility: dice?.rollVisibility?.() || 'table', ...(damage ? { target: 'damage' } : {}) });
  const rolled = `Bear Down ${result.bearDown.count}${token.resolve?.dieType || 'd4'} [${result.bearDown.dice.join(', ')}] = +${result.bearDown.bonus}`;
  if (damage) {
    const updated = await dice.applyBearDownDamage(result.bearDown.bonus);
    return { result, summary: `${rolled} al daño: ${updated?.raw ?? '?'} (${updated?.severity ?? ''}).` };
  }
  await dice?.applyBearDown(result);
  return { result, summary: `${rolled}: total ${result.total} vs DC ${result.dc}. ${result.outcomeTitle}.` };
}

// Prepare (Corebook, rests): a Short Rest recovers 1 Resolve; a Long Rest fills the pool.
export function prepareResolve(token, rest = 'short') {
  const r = token?.resolve;
  if (!r || token.path !== 'Sleeping') return null;
  const current = rest === 'long' ? r.max : Math.min(r.max, (r.current || 0) + 1);
  return current === r.current ? null : { resolve: { ...r, current } };
}
