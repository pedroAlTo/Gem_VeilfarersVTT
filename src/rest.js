// Rests (V3, Corebook ch. 9 «Rest and Recovery»). The Keeper starts a Short or a Long Rest; the
// table pauses; each character chooses two different moves of that rest; when everyone has
// chosen, the table applies them all at once and play goes on.
import { tierOf } from './effectClocks.js';
import { restoreArmorCut } from './weaponFeatures.js';
import { isPartyToken, isDrone } from './tokenPermissions.js';
import { normalizeConditions } from './conditions.js';

export const REST_MOVES = {
  short: [
    { id: 'tend', name: 'Tend Wounds', text: 'Recupera 1d4 + Tier HP marcados.' },
    { id: 'clear', name: 'Clear Stress', text: 'Borra 1d4 + Tier Stress marcado.' },
    { id: 'repair', name: 'Repair Armor', text: 'Con herramientas o materiales, recupera 1d4 + Tier Armor Slots gastados.' },
    { id: 'prepare', name: 'Prepare', text: 'Awakened: +1 Hope. Sleeping: +1 Resolve (hasta tu reserva). Nunca da Effort.' },
  ],
  long: [
    { id: 'recover', name: 'Recover', text: 'Recupera todos los HP.' },
    { id: 'decompress', name: 'Decompress', text: 'Borra todo el Stress, también Long Bruise.' },
    { id: 'repairAll', name: 'Repair All Armor', text: 'Recupera todos los Armor Slots.' },
    { id: 'prepare', name: 'Prepare', text: 'Awakened: Hope a su valor inicial (2). Sleeping: Resolve al máximo. Nunca da Effort.' },
  ],
};
export const REST_NAMES = { short: 'Descanso corto', long: 'Descanso largo' };
const HOPE_START = 2;
// Prepare (Corebook): a Short Rest recovers 1 Resolve; a Long Rest fills the pool.
export function prepareResolve(token, rest = 'short') {
  const r = token?.resolve;
  if (!r || token.path !== 'Sleeping') return null;
  const current = rest === 'long' ? r.max : Math.min(r.max, (r.current || 0) + 1);
  return current === r.current ? null : { resolve: { ...r, current } };
}
// Conditions whose own rule ends them with a Long Rest (Blinded, Poisoned, Weakened).
const LONG_REST_CONDITIONS = ['Blinded', 'Poisoned', 'Weakened'];

// The characters who rest: the party on the scene (not drones).
export const restParticipants = (tokens, mapId) => (tokens || []).filter(t => t.mapId === mapId && isPartyToken(t) && !isDrone(t) && t.isPlayer !== false);

export function newRest(kind, tokens, mapId, id = `rest_${Date.now().toString(36)}`) {
  if (!REST_MOVES[kind]) throw new Error('Descanso desconocido.');
  const participants = restParticipants(tokens, mapId).map(t => t.id);
  if (!participants.length) throw new Error('No hay personajes jugadores en la escena para descansar.');
  return { id, kind, mapId, participants, choices: {} };
}

export function validRest(r) {
  if (r == null) return true;
  return typeof r === 'object' && typeof r.id === 'string' && r.id.length <= 60 && ['short', 'long'].includes(r.kind)
    && typeof r.mapId === 'string' && Array.isArray(r.participants) && r.participants.length >= 1 && r.participants.length <= 40
    && r.participants.every(id => typeof id === 'string' && id.length <= 200)
    && r.choices && typeof r.choices === 'object' && !Array.isArray(r.choices)
    && Object.entries(r.choices).every(([id, moves]) => r.participants.includes(id) && validMoves(r.kind, moves));
}

// Two different moves of that rest.
export const validMoves = (kind, moves) => Array.isArray(moves) && moves.length === 2 && moves[0] !== moves[1]
  && moves.every(m => REST_MOVES[kind]?.some(x => x.id === m));

export function chooseMoves(rest, tokenId, moves) {
  if (!rest) throw new Error('No hay ningún descanso en curso.');
  if (!rest.participants.includes(tokenId)) throw new Error('Este personaje no participa en el descanso.');
  if (!validMoves(rest.kind, moves)) throw new Error('Elige dos movimientos distintos del descanso.');
  return { ...rest, choices: { ...rest.choices, [tokenId]: moves.slice() } };
}
export const restPending = (rest, tokens = []) => (rest?.participants || []).filter(id => !rest.choices?.[id] && tokens.some(t => t.id === id));
export const restComplete = (rest, tokens = []) => !!rest && restPending(rest, tokens).length === 0;

const rollD4 = () => Math.floor(Math.random() * 4) + 1;
const moveName = (kind, id) => REST_MOVES[kind].find(m => m.id === id)?.name || id;

// One character's two moves → the patch for its token and what happened, in words.
export function restPatch(token, kind, moves, roll = rollD4) {
  const tier = tierOf(token.level);
  const patch = {}, said = [];
  const amount = () => { const d = roll(); return { d, n: d + tier }; };
  let armor = token.armor ? { ...token.armor } : null;
  // A Long Rest ends the cuts that last «until the next Long Rest» (Armor Piercing).
  if (kind === 'long' && armor?.cut) armor = restoreArmorCut(armor, { long: true, repairAll: moves.includes('repairAll') });
  for (const move of moves) {
    if (move === 'tend' && token.hp) {
      const { d, n } = amount(), current = Math.min(token.hp.max, token.hp.current + n);
      patch.hp = { ...token.hp, current }; said.push(`Tend Wounds 1d4 [${d}] + ${tier}: +${current - token.hp.current} HP (${current}/${token.hp.max})`);
    }
    if (move === 'clear' && token.stress) {
      const { d, n } = amount(), current = Math.max(0, (token.stress.current || 0) - n);
      patch.stress = { ...token.stress, current }; said.push(`Clear Stress 1d4 [${d}] + ${tier}: −${(token.stress.current || 0) - current} Stress (${current}/${token.stress.max})`);
    }
    if (move === 'repair' && armor) {
      const { d, n } = amount(), current = Math.min(armor.max || 0, (armor.current || 0) + n);
      said.push(`Repair Armor 1d4 [${d}] + ${tier}: +${current - (armor.current || 0)} Armor Slots (${current}/${armor.max || 0})`);
      armor = { ...armor, current };
    }
    if (move === 'recover' && token.hp) { patch.hp = { ...token.hp, current: token.hp.max }; said.push(`Recover: HP ${token.hp.max}/${token.hp.max}`); }
    if (move === 'decompress') {
      if (token.stress) patch.stress = { ...token.stress, current: 0 };
      if ((token.conditions || []).includes('Long Bruise')) patch.conditions = (token.conditions || []).filter(c => c !== 'Long Bruise');
      said.push(`Decompress: Stress a 0${patch.conditions ? ' y sin Long Bruise' : ''}`);
    }
    if (move === 'repairAll' && armor) { armor = { ...armor, current: armor.max || 0 }; said.push(`Repair All Armor: ${armor.max || 0}/${armor.max || 0}`); }
    if (move === 'prepare') {
      if (token.path === 'Sleeping') {
        const p = prepareResolve(token, kind);
        if (p) patch.resolve = p.resolve;
        said.push(`Prepare: Resolve ${(p?.resolve || token.resolve)?.current ?? 0}/${token.resolve?.max ?? 0}`);
      } else {
        const hope = kind === 'long' ? Math.max(token.hope || 0, HOPE_START) : Math.min(token.hopeMax ?? 6, (token.hope || 0) + 1);
        patch.hope = hope; said.push(`Prepare: Hope ${hope}`);
      }
    }
  }
  if (armor && JSON.stringify(armor) !== JSON.stringify(token.armor)) patch.armor = armor;
  if (kind === 'long') {
    const kept = (patch.conditions || token.conditions || []).filter(c => !LONG_REST_CONDITIONS.includes(c));
    if (kept.length !== (patch.conditions || token.conditions || []).length) { patch.conditions = normalizeConditions(kept); said.push('Termina Blinded / Poisoned / Weakened'); }
  }
  return { patch, summary: `${token.name}: ${moves.map(m => moveName(kind, m)).join(' + ')}. ${said.join('; ')}.` };
}

// Everything the rest changes: the patches of the characters and, on a Long Rest, the end of the
// Armor Piercing cuts of every other token on the scene (enemies included).
export function resolveRest(rest, tokens, roll = rollD4) {
  const patches = new Map(), lines = [];
  for (const id of rest.participants) {
    const token = tokens.find(t => t.id === id), moves = rest.choices[id];
    if (!token || !moves) continue;
    const { patch, summary } = restPatch(token, rest.kind, moves, roll);
    patches.set(id, patch); lines.push(summary);
  }
  if (rest.kind === 'long') {
    for (const t of tokens) {
      if (patches.has(t.id) || t.mapId !== rest.mapId || !t.armor?.cut?.long) continue;
      patches.set(t.id, { armor: restoreArmorCut(t.armor, { long: true }) });
    }
  }
  return { patches, lines };
}
