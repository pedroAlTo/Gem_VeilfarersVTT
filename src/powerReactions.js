// Reaction Powers at the moment of an attack or of its damage (v2.33.0, user request): the table
// finds who can use one (the Power in the Loadout, the price payable, in range), offers it in the
// window where the Keeper decides, and works out the result. Corebook, levels 1-2:
// - Force Shield (Kinetic 1, 1 Hope): you or an ally in Very Close is hit → +3 Evasion against
//   that attack; if it then misses, the attacker takes (Proficiency)d4 Physical (Kinetic).
// - Tactical Overwatch (Kinetic 1, 1 Hope): an ally in Close is targeted → Advantage on their
//   defense (the attack has Disadvantage) and 2 temporary Armor Slots until your next Spotlight.
// - Photon Shield (Lux 2, 1 Stress): an ally in Close takes HP damage from an attack → the damage
//   drops by your Tier + 2 before the thresholds (doubled against Veil-Touched creatures).
// - Impact Absorption (Kinetic 2, 1 Stress): you take Physical damage → it drops by
//   (Proficiency)d6 + 2; on your next Spotlight one attack adds the amount absorbed.
// - Mind Shield (Neural 1, 1 Stress): you take Neural damage → it drops by (Proficiency)d6.
import { characterCards } from './loadoutCards.js';
import { distanceInfo, RANGE_BANDS } from './attackFlow.js';
import { isPartyToken } from './tokenPermissions.js';
import { tierOf } from './effectClocks.js';
import { barrier } from './powerEffects.js';

const prof = token => Math.max(1, Math.min(10, Number(token?.proficiency) || 1));
const roll = (qty, sides, random = Math.random) => Array.from({ length: qty }, () => Math.floor(random() * sides) + 1);
export const veilTouched = token => /veil[- ]touched/i.test([token?.featureNotes, token?.roleTag, token?.description, token?.species].join(' '));

export const REACTIONS = {
  'Force Shield': { when: 'hit', who: 'self-or-ally', reach: 'Very Close', cost: { hope: 1 } },
  'Tactical Overwatch': { when: 'targeted', who: 'ally', reach: 'Close', cost: { hope: 1 } },
  'Photon Shield': { when: 'damage', who: 'ally', reach: 'Close', cost: { stress: 1 } },
  'Impact Absorption': { when: 'damage', who: 'self', cost: { stress: 1 }, types: ['physical'] },
  'Mind Shield': { when: 'damage', who: 'self', cost: { stress: 1 }, types: ['neural'] },
  // After HP damage to you or an ally in Very Close (it is also played as an ordinary Power).
  'Rapid Regeneration': { when: 'after-damage', who: 'self-or-ally', reach: 'Very Close', cost: { hope: 1 } },
};

const overwhelmed = token => (token.stress?.current || 0) >= (token.stress?.max ?? 6);
export function canPay(token, cost = {}) {
  if (cost.hope && (token.hope || 0) < cost.hope) return false;
  if (cost.stress && (overwhelmed(token) || (token.stress?.max ?? 6) - (token.stress?.current || 0) < cost.stress)) return false;
  return true;
}
// The Power is in the character's hand (its Loadout) and can be played there.
export const holdsReaction = (token, name, data) => !!data && characterCards(token, data).some(c => c.name === name && c.kind === 'power' && c.playable);

// Who can use a reaction for this target now.
export function reactorsFor(name, target, tokens, map, data) {
  const rule = REACTIONS[name];
  if (!rule || !target || !isPartyToken(target)) return [];
  return tokens.filter(t => {
    if (t.mapId !== target.mapId || t.hidden || t.inReserve || !isPartyToken(t) || t.isPlayer === false) return false;
    if (rule.who === 'self' && t.id !== target.id) return false;
    if (rule.who === 'ally' && t.id === target.id) return false;
    if (t.id !== target.id) {
      const gap = distanceInfo(t, target, map || {});
      if (gap.blocked || RANGE_BANDS.indexOf(gap.band) > RANGE_BANDS.indexOf(rule.reach)) return false;
    }
    return canPay(t, rule.cost) && holdsReaction(t, name, data);
  });
}

// Damage reduced by a reaction: only the parts of the types it protects against (all if none),
// taken from the first parts first. Each part keeps its types.
export function reduceComponents(components = [], amount = 0, types = null) {
  let left = Math.max(0, amount);
  return components.map(part => {
    if (!left || (types && !part.types?.some(t => types.includes(t)))) return part;
    const cut = Math.min(left, part.amount);
    left -= cut;
    return { ...part, amount: part.amount - cut };
  });
}

// The reductions the target (or an ally) can apply to this hit, each with its amount already
// rolled: [{ name, actorId, actorName, amount, faces, label, types }].
export function damageReactions({ target, attacker, components, tokens, map, data, random = Math.random }) {
  const out = [];
  // Kinetic Barrier: the target's own barrier absorbs first (no price; it dissipates when spent).
  const wall = barrier(target), total = components.reduce((n, p) => n + (p.amount || 0), 0);
  if (wall && total > 0) {
    const amount = Math.min(wall.left, total);
    out.push({ name: 'Kinetic Barrier', actorId: target.id, actorName: target.name, amount, faces: [], free: true, types: null, label: `Kinetic Barrier de ${target.name}: absorbe ${amount} (le quedan ${wall.left})` });
  }
  const touches = types => !types || components.some(p => p.amount > 0 && p.types?.some(t => types.includes(t)));
  for (const [name, rule] of Object.entries(REACTIONS)) {
    if (rule.when !== 'damage' || !touches(rule.types)) continue;
    for (const reactor of reactorsFor(name, target, tokens, map, data)) {
      let amount, faces = [], label;
      if (name === 'Photon Shield') {
        const base = tierOf(reactor.level) + 2, doubled = veilTouched(attacker);
        amount = base * (doubled ? 2 : 1);
        label = `Photon Shield de ${reactor.name} (1 Stress): −${amount}${doubled ? ' (Veil-Touched: doble)' : ''}`;
      } else {
        faces = roll(prof(reactor), 6, random);
        amount = faces.reduce((a, b) => a + b, 0) + (name === 'Impact Absorption' ? 2 : 0);
        label = `${name} de ${reactor.name} (1 Stress): −${amount} ${name === 'Mind Shield' ? 'Neural' : 'Physical'} (${prof(reactor)}d6 [${faces.join(', ')}]${name === 'Impact Absorption' ? ' + 2' : ''})`;
      }
      out.push({ name, actorId: reactor.id, actorName: reactor.name, amount, faces, label, types: rule.types || null });
    }
  }
  return out;
}
