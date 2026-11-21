import { netEdge } from './attackFlow.js';
import { normalizeConditions } from './conditions.js';
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
  if (stage) throw new Error(`${token.name} · ${stage}. Consulta el procedimiento en Condiciones.`);
}

export function lifePatch(token, stage) {
  const conditions = (token.conditions || []).filter(name => !LIFE_STATES.includes(name));
  if (stage) conditions.push(stage);
  return { conditions: normalizeConditions(conditions), lifeProgress: 0 };
}

export function checkEdge(actor, target, advantage = false, disadvantage = false) {
  const overwhelmed = actor?.conditions?.includes('Overwhelmed') ||
    (actor?.stress?.max > 0 && actor.stress.current >= actor.stress.max);
  return netEdge(advantage || !!actor?.pendingAdvantage || !!target?.conditions?.includes('Vulnerable'), disadvantage || !!overwhelmed);
}

export const roundKey = (map = {}) => `${map.id}/${map.spotlightRound || 1}`;

// Run on the authoritative table, as part of the token write. Reconnecting or
// toggling the visual marker cannot replay healing or consume another turn.
export function combatTransition(previous, next, map) {
  if (!previous || next === previous) return next;
  if (previous.stress?.current >= previous.stress?.max && next.stress?.current < next.stress?.max && next.conditions?.includes('Overwhelmed')) {
    next = { ...next, conditions: next.conditions.filter(name => name !== 'Overwhelmed') };
  }
  if (character(next) && previous.hp?.current > 0 && next.hp?.current === 0) {
    next = { ...next, ...lifePatch(next, 'Dying'), lifeRollRound: null };
  }
  if (map && next.mapId === map.id && !previous.hasSpotlight && next.hasSpotlight && next.roundSpotlight !== roundKey(map)) {
    next = { ...next, roundSpotlight: roundKey(map) };
    if (next.effectClocks?.some(c => c.tick === 'spotlight')) {
      const { list, ticked } = tickClocks(next.effectClocks, { kind: 'spotlight' });
      next.effectClocks = list;
      const heal = ticked.reduce((n, c) => n + (c.perTick?.hp || 0), 0);
      if (heal && next.hp && canReceiveHealing(next)) next.hp = { ...next.hp, current: Math.min(next.hp.max, next.hp.current + heal) };
    }
  }
  if (character(next) && previous.hp?.current === 0 && next.hp?.current > 0) {
    if (!canReceiveHealing(previous)) return { ...next, hp: { ...next.hp, current: 0 } };
    const recovery = lifePatch(next, '');
    next = { ...next, ...recovery, lifeRollRound: null, hp: { ...next.hp, current: 1 },
      conditions: normalizeConditions([...recovery.conditions, 'Long Bruise']),
      stress: { ...next.stress, current: Math.min(next.stress?.max ?? 6, (next.stress?.current || 0) + 1) } };
  }
  if (next.conditions?.includes('Long Bruise') && next.stress?.current === 0) next = { ...next, stress: { ...next.stress, current: 1 } };
  return next;
}

export function nextSpotlightRound(store) {
  if (store.sessionRole === 'player' || store.state.userRole !== 'keeper') throw new Error('Solo el Keeper puede cerrar la ronda.');
  const map = store.getActiveMap();
  const round = (map.spotlightRound || 1) + 1;
  store.update({
    maps: store.state.maps.map(m => m.id === map.id ? { ...m, spotlightRound: round } : m),
    tokens: store.state.tokens.map(t => t.mapId === map.id && t.hasSpotlight
      ? { ...t, hasSpotlight: false, spotlight: { ...t.spotlight, enabled: false } } : t)
  });
  store.addLog({ sender: 'Keeper', type: 'ROUND', title: `Ronda ${round}`, details: map.name });
}
