// What the armor worn does to Evasion (Corebook 12.06, ch. 13: «Armor never adds a flat bonus to
// Evasion: a few Features adjust Evasion directly (Flexible +1, Heavy -1, Very Heavy and Massive
// -2)»), plus the Vanguard's Unbroken Focus (+1 while not wearing Heavy or Very Heavy armor).
// `features`: the armor's features as text or a list; none for no armor.
export function armorEvasionMod(features, token = {}) {
  const text = (Array.isArray(features) ? features.join(', ') : String(features ?? '')).toLowerCase();
  const veryHeavy = /very[ -]heavy/.test(text), heavy = !veryHeavy && /\bheavy\b/.test(text);
  let mod = 0;
  if (/\bflexible\b/.test(text)) mod += 1;
  if (heavy) mod -= 1;
  if (veryHeavy || /\bmassive\b/.test(text)) mod -= 2;
  if (/vanguard/i.test(String(token.characterClass || '')) && !heavy && !veryHeavy) mod += 1;
  return mod;
}
