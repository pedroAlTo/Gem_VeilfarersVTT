import { probabilityDefense } from './adversaryPassives.js';
import { activePath, pathImmune } from './statePowers.js';
import { isPartyToken } from './tokenPermissions.js';
import { distanceInfo, netEdge } from './attackFlow.js';
import { normalizeConditions, visibleConditions } from './conditions.js';
import { tickClocks } from './effectClocks.js';

export const LIFE_STATES = ['Dead', 'Last Act', 'Final', 'Dying', 'Stabilized'];
export const BLAZE_CHOICES = ['Overload a Power', 'Reach beyond your grasp', 'A perfect final act', 'A killing blow'];
const character = token => token && token.isPlayer !== false && token.actorType !== 'drone';

export function lifeStage(token) {
  if (!character(token)) return '';
  const states = token.conditions || [];
  return LIFE_STATES.find(stage => states.includes(stage)) || (token.hp?.current === 0 ? 'Dying' : '');
}

export function canChooseBlaze(actor, memberId) {
  if (actor?.ownerId && actor.ownerId !== 'keeper') return actor.ownerId === memberId;
  const players = (actor?.controllerIds || []).filter(id => id !== 'keeper');
  return !players.length || players.includes(memberId);
}

export function canReceiveHealing(token) {
  const stage = lifeStage(token);
  return !stage || stage === 'Stabilized';
}

export function requireActive(token) {
  const stage = lifeStage(token);
  if (visibleConditions(token).includes('Stunned')) throw new Error(token.name + ' · Stunned. Resuelve la duración de la condición.');
  if (stage) throw new Error(`${token.name} · ${stage}. Consulta el procedimiento en Condiciones.`);
}

export function lifePatch(token, stage) {
  const conditions = (token.conditions || []).filter(name => !LIFE_STATES.includes(name));
  if (stage) conditions.push(stage);
  return { conditions: normalizeConditions(conditions), lifeProgress: 0 };
}

export function checkEdge(actor, target, advantage = false, disadvantage = false, trait = '') {
  const overwhelmed = actor?.conditions?.includes('Overwhelmed') ||
    (actor?.stress?.max > 0 && actor.stress.current >= actor.stress.max);
  const conditions = visibleConditions(actor);
  const conditionPenalty = (conditions.includes('Blinded') && (!!target || trait === 'instinct')) ||
    (conditions.includes('Cornered') && ['agility','finesse'].includes(trait)) ||
    (!!trait && ['knowledge','instinct'].includes(trait) && actor?.effectClocks?.some(c => c.condition === 'Dazed') && !pathImmune(actor, 'Dazed'));
  const jolt = ['agility', 'finesse'].includes(trait) && actor?.effectClocks?.some(c => c.name === 'Slipstream Jolt');
  const field = actor?.effectClocks?.find(c => c.name === 'Global Stimulus Field');
  // «Disadvantage on their next attack» (Blinding Flash…): only an attack, and it is spent by it.
  const nextAttack = !!target && actor?.effectClocks?.some(c => c.nextAttack && c.edge === 'disadvantage');
  // «Disadvantage on its next action» (Stagger, Disorienting → Dazed): any roll, spent by it.
  const nextAction = actor?.effectClocks?.some(c => c.nextAction && c.edge === 'disadvantage');
  // An edge on all rolls while a clock lasts (Psychic Collapse: Disadvantage on all rolls for 1 round).
  const allRollsDis = actor?.effectClocks?.some(c => c.allRolls && c.edge === 'disadvantage'), allRollsAdv = actor?.effectClocks?.some(c => c.allRolls && c.edge === 'advantage');
  // Attacking from stealth (v2.43.5, user note): a Hidden or invisible attacker has Advantage
  // (Corebook ch. 10: Hidden gives Advantage on the next attack; a Hidden attacker surprises).
  const unseen = !!target && conditions.some(c => c === 'Hidden' || /invisib/i.test(c));
  return netEdge(advantage || unseen || allRollsAdv || field?.edge === 'advantage' || (!!trait && activePath(actor)?.trait === trait) || !!actor?.pendingAdvantage || !!target?.conditions?.includes('Vulnerable'), disadvantage || field?.edge === 'disadvantage' || nextAttack || nextAction || allRollsDis || probabilityDefense(target) || conditionPenalty || jolt || !!overwhelmed);
}

export const roundKey = (map = {}) => `${map.id}/${map.spotlightRound || 1}`;

export function disciplinedDefense(target, attacker, map, tokens) {
  const state = activePath(target);
  if (!map || !state || !/refused/i.test(state.name) || isPartyToken(attacker) === isPartyToken(target) || target.mapId !== map.id) return null;
  const round = roundKey(map);
  const engaged = tokens.filter(t => t.id !== target.id && t.mapId === map.id && t.hp?.current > 0 && isPartyToken(t) !== isPartyToken(target) && distanceInfo(t,target,map).band === 'Melee').length;
  return { clockId: state.id, round, penalty: state.meleeRound === round && engaged >= 2 };
}
export function markMeleeDefense(store, target, guard) {
  const current = store.state.tokens.find(t => t.id === target.id);
  if (current?.effectClocks?.some(c => c.id === guard.clockId && c.meleeRound !== guard.round)) {
    store.updateToken(target.id, { effectClocks: current.effectClocks.map(c => c.id === guard.clockId ? { ...c, meleeRound: guard.round } : c) });
  }
}
// Run on the authoritative table, as part of the token write. Reconnecting or
// toggling the visual marker cannot replay healing or consume another turn.
export function combatTransition(previous, next, map) {
  if (!previous || next === previous) return next;
  if (previous.stress?.current >= previous.stress?.max && next.stress?.current < next.stress?.max && next.conditions?.includes('Overwhelmed')) {
    next = { ...next, conditions: next.conditions.filter(name => name !== 'Overwhelmed') };
  }
  if (next.conditions?.some(c => pathImmune(next, c))) next = { ...next, conditions: next.conditions.filter(c => !pathImmune(next, c)) };
  if (character(next) && previous.hp?.current > 0 && next.hp?.current === 0) {
    next = { ...next, ...lifePatch(next, 'Dying'), lifeRollRound: null };
  }
  // A new Spotlight (v2.43.1, user report): the first one of the round, or taking it back after
  // somebody else held it (the Spotlight is dynamic, Corebook 12.06). Turning the marker off and on
  // again with nobody in between is not a new Spotlight, so it cannot replay healing.
  const newSpotlight = map && (next.roundSpotlight !== roundKey(map) || (!!map.lastSpotlightId && map.lastSpotlightId !== next.id));
  if (map && next.mapId === map.id && !previous.hasSpotlight && next.hasSpotlight && newSpotlight) {
    next = { ...next, roundSpotlight: roundKey(map) };
    if (next.effectClocks?.some(c => c.expiry === 'spotlight-end')) next.effectClocks = next.effectClocks.map(c => c.expiry === 'spotlight-end' ? { ...c, seenSpotlight:true } : c);
    if (next.effectClocks?.some(c => c.tick === 'spotlight')) {
      const { list, ticked } = tickClocks(next.effectClocks, { kind: 'spotlight' });
      next.effectClocks = list;
      const heal = ticked.reduce((n, c) => n + (c.perTick?.hp || 0), 0);
      if (heal && next.hp && canReceiveHealing(next)) next.hp = { ...next.hp, current: Math.min(next.hp.max, next.hp.current + heal) };
      // Continuous (a weapon): the target marks Stress at the start of its next Spotlight.
      const strain = ticked.reduce((n, c) => n + (c.perTick?.stress || 0), 0);
      if (strain && next.stress) next.stress = { ...next.stress, current: next.stress.max > 0 ? Math.min(next.stress.max, (next.stress.current || 0) + strain) : (next.stress.current || 0) + strain };
    }
  }
  if (previous.hasSpotlight && !next.hasSpotlight && next.effectClocks?.some(c => c.seenSpotlight)) next = { ...next, effectClocks:next.effectClocks.filter(c => !(c.expiry === 'spotlight-end' && c.seenSpotlight)) };
  if (character(next) && previous.hp?.current === 0 && next.hp?.current > 0) {
    if (!canReceiveHealing(previous)) return { ...next, hp: { ...next.hp, current: 0 } };
    const recovery = lifePatch(next, '');
    next = { ...next, ...recovery, lifeRollRound: null, hp: { ...next.hp, current: 1 },
      conditions: normalizeConditions([...recovery.conditions, 'Long Bruise']),
      stress: { ...next.stress, current: Math.min(next.stress?.max ?? 6, (next.stress?.current || 0) + 1) } };
  }
  if (next.conditions?.includes('Long Bruise') && next.stress?.current === 0) next = { ...next, stress: { ...next.stress, current: 1 } };
  // Charge-Up (Rust & Steel 12.06): the charge is lost if the wielder loses HP, moves, or becomes
  // Dazed, Stunned, Prone or Restrained.
  if (next.inventory?.weapons?.some(w => w.charged)) {
    const hurt = (next.hp?.current ?? 0) < (previous.hp?.current ?? 0), moved = next.x !== previous.x || next.y !== previous.y;
    const was = visibleConditions(previous), now = visibleConditions(next);
    const struck = ['Dazed', 'Stunned', 'Prone', 'Restrained'].some(c => now.includes(c) && !was.includes(c));
    if (hurt || moved || struck) next = { ...next, inventory: { ...next.inventory, weapons: next.inventory.weapons.map(w => w.charged ? { ...w, charged: false } : w) } };
  }
  return next;
}

export function nextSpotlightRound(store) {
  if (store.sessionRole === 'player' || store.state.userRole !== 'keeper') throw new Error('Solo el Keeper puede cerrar la ronda.');
  const map = store.getActiveMap();
  const round = (map.spotlightRound || 1) + 1;
  store.update({
    maps: store.state.maps.map(m => m.id === map.id ? { ...m, spotlightRound: round } : m),
    tokens: store.state.tokens.map(t => {
      if (t.mapId !== map.id) return t;
      const next = t.hasSpotlight ? { ...t, hasSpotlight: false, spotlight: { ...t.spotlight, enabled: false } } : t;
      // A clock that lasts several rounds (Stunned by a weapon: «cleared after the next round») counts one down.
      return next.effectClocks?.some(c => c.expiry === 'round') ? { ...next, effectClocks: next.effectClocks.flatMap(c => c.expiry !== 'round' ? [c] : c.rounds > 1 ? [{ ...c, rounds: c.rounds - 1 }] : []) } : next;
    })
  });
  store.addLog({ sender: 'Keeper', type: 'ROUND', title: `Ronda ${round}`, details: map.name });
}
