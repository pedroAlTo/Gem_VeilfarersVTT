import { distanceInfo, RANGE_BANDS } from './attackFlow.js';

export function hasSwarmTactics(actor) {
  return actor?.isPlayer === false && /Swarm Tactics[^\n]*?3(?:\+| or more) HP[^\n]*?two targets within Close range/i.test(actor.featureNotes || '');
}
export function swarmCandidates(actor, map, tokens) {
  if (!hasSwarmTactics(actor) || actor.hp?.current < 3 || actor.mapId !== map?.id) return [];
  return tokens.filter(t => {
    if (t.id === actor.id || t.mapId !== map.id || t.inReserve || !t.hp?.current) return false;
    const gap = distanceInfo(actor, t, map);
    return !gap.blocked && RANGE_BANDS.indexOf(gap.band) <= RANGE_BANDS.indexOf('Close');
  });
}
export function swarmTargets(actor, map, tokens, ids) {
  if (!Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2) throw new Error('Marca dos objetivos distintos.');
  const eligible = swarmCandidates(actor, map, tokens);
  const targets = ids.map(id => eligible.find(t => t.id === id));
  if (targets.some(t => !t)) throw new Error('Swarm Tactics requiere 3 HP o más y dos objetivos a alcance Close en esta escena.');
  return targets;
}
export function bloodiedAttack(actor) {
  if (actor?.isPlayer !== false || !(actor.hp?.current > 0 && actor.hp.current * 2 < actor.hp.max)) return { attack: 0, flat: 0, die: false };
  const notes = actor.featureNotes || '';
  const rage = /Territorial Rage[^\n]*?below half HP[^\n]*?\+2 to attack rolls and deals an additional die of damage/i.test(notes);
  const desperate = /Desperate Strike[^\n]*?below half HP[^\n]*?\+2 damage on all attacks/i.test(notes);
  return { attack: rage ? 2 : 0, flat: desperate ? 2 : 0, die: rage };
}
export const probabilityDefense = target => /Probability Threads[^\n]*?Attacks against the Monk have Disadvantage/i.test(target?.featureNotes || '');
