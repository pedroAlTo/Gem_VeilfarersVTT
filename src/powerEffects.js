// What an active Power gives while its clock is on a token (v2.34.0, user request: the table does
// the sums the card prints). Read from the clock's name, so a clock the Keeper ends by hand ends
// its bonus too. Corebook, levels 2-3:
// - Kinetic Barrier (scene): +1 Evasion, Resistance to Physical damage, absorbs up to 10 damage
//   and then dissipates (the amount left is kept on the clock as `absorbed`).
// - Velocity Surge (scene, on a successful cast): +2 on Agility Rolls.
// - Aura of Clarity (concentration, you and allies in Close): immune to Frightened and Dazed;
//   Damage Thresholds +1.
// - Protective Dome (10 minutes, a Very Close zone): occupants +2 Evasion.
// And the Powers spent «when making a roll», armed for the next matching roll:
// - Silver Tongue: a Presence Roll adds your Tier; a Hope die showing 11 counts as 12.
// - Vector Calculus: an Agility or Finesse Roll adds your Level; a Hope die of 10 or lower counts as 11.
export const CLOCK_BONUSES = {
  'Kinetic Barrier': { evasion: 1, resist: 'physical', absorb: 10 },
  'Velocity Surge': { rollTraits: ['agility'], rollBonus: 2 },
  'Aura of Clarity': { thresholds: 1, immune: ['Frightened', 'Dazed'] },
  'Protective Dome': { evasion: 2 },
  // Shockwave Pulse · Protective (v2.49.0): +2 Evasion until the round changes.
  'Shockwave Pulse': { evasion: 2 },
  // Rallying Cry (v2.50.0): +2 to all rolls for 1 round, and no fear for the scene.
  'Rallying Cry': { rollTraits: ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'], rollBonus: 2 },
  'Rallying Cry · sin miedo': { immune: ['Frightened'] },
  // «Choose two» adaptations (v2.52.0).
  'Adaptive Evolution · Enhanced Senses': { rollTraits: ['instinct'], rollBonus: 2 },
  'Adaptive Evolution · Physical Adaptation': { evasion: 1 },
  'Symbiotic Bloom · Lithoderm': { resist: 'physical' },
  'Symbiotic Bloom · Sky-Adapted': { evasion: 2 },
  'Biomorphic Arsenal · Carapace Plating': { resist: 'physical' },
};
export const tierOfLevel = level => { const l = Number(level) || 1; return l <= 4 ? 1 : l <= 7 ? 2 : 3; };
export const NEXT_ROLL = {
  'Silver Tongue': { traits: ['presence'], bonus: token => tierOfLevel(token.level), hope: v => (v === 11 ? 12 : v), note: 'Hope 11 cuenta como 12' },
  'Vector Calculus': { traits: ['agility', 'finesse'], bonus: token => Number(token.level) || 1, hope: v => (v <= 10 ? 11 : v), note: 'Hope 10 o menos cuenta como 11' },
};

const active = token => (token?.effectClocks || []).filter(c => Object.hasOwn(CLOCK_BONUSES, c.name)).map(c => ({ clock: c, bonus: CLOCK_BONUSES[c.name] }));
const sum = (token, key) => active(token).reduce((n, { bonus }) => n + (bonus[key] || 0), 0);
export const evasionBonus = token => sum(token, 'evasion');
export const thresholdBonus = token => sum(token, 'thresholds');
export const rollBonus = (token, trait) => active(token).reduce((n, { bonus }) => n + (bonus.rollTraits?.includes(trait) ? bonus.rollBonus : 0), 0);
export const resists = (token, type) => active(token).some(({ bonus }) => bonus.resist === type);
export const immuneTo = (token, condition) => active(token).some(({ bonus }) => bonus.immune?.includes(condition));
// The barrier still standing: { clock, left } or null.
export function barrier(token) {
  const found = active(token).find(({ bonus }) => bonus.absorb);
  if (!found) return null;
  const left = found.clock.absorbed ?? found.bonus.absorb;
  return left > 0 ? { clock: found.clock, left } : null;
}
// The next-roll Power armed for this trait: { clock, rule } or null.
export function armedRoll(token, trait) {
  const clock = (token?.effectClocks || []).find(c => NEXT_ROLL[c.name]?.traits.includes(trait));
  return clock ? { clock, rule: NEXT_ROLL[clock.name] } : null;
}
