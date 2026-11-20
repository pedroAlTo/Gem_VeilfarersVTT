import { adversaryWeapons } from './adversaryWeapons.js';
import { resolveDamage } from './rulesEngine.js';
import { tagsFromFeatures, parseTagInput, validTags } from './weaponTags.js';

const text = value => value == null ? '' : String(value);
export function tokenInventory(token) {
  // Every weapon carries its tags (older ones get them from their Features list).
  const tagged = inventory => ({ ...inventory, weapons: (inventory.weapons || []).map(w => (Array.isArray(w.tags) ? w : { ...w, tags: tagsFromFeatures(w.features) })) });
  if (token.inventory) return tagged(structuredClone(token.inventory));
  const f = token.sourceCharacter?.document?.fields || {};
  const weapons = ['wpri', 'wsec'].filter(p => f[p + '_name']).map(p => {
    const final = (token.path === 'Awakened' && f[p + '_dmg_final_aw']) || f[p + '_dmg_final'];
    return { id: p, name: text(f[p + '_name']), damage: text(final || f[p + '_dmg']), damageMode: final ? 'final' : 'base', trait: text(f[p + '_trait']), range: text(f[p + '_range']), features: text(f[p + '_feat']), tier: text(f[p + '_tier']), tags: tagsFromFeatures(f[p + '_tags'] || f[p + '_feat']) };
  });
  if (!weapons.length && token.isPlayer === false && token.damageExpression) weapons.push(...adversaryWeapons(token));
  const items = Object.keys(f).filter(k => /^eq_\d+_name$/.test(k) && text(f[k]).trim()).sort((a,b) => a.localeCompare(b, undefined, { numeric: true })).map(k => ({ id: k, name: text(f[k]), tier: text(f[k.replace('_name', '_tier')]), quantity: text(f[k.replace('_name', '_qty')]) || '1', use: text(f[k.replace('_name', '_use')]) }));
  for (const [key, name] of [['kit_class', 'Kit de clase'], ['kit_personal', 'Kit personal']]) if (f[key]) items.push({ id: key, name, quantity: '1', tier: '', use: text(f[key]) });
  return { weapons, items };
}

export function validateInventory(value) {
  const fail = () => { throw new Error('Inventario inválido: revisa nombres, cantidades y expresiones.'); };
  if (!value || typeof value !== 'object' || Object.keys(value).some(k => !['weapons', 'items'].includes(k)) || !Array.isArray(value.weapons) || !Array.isArray(value.items) || value.weapons.length > 40 || value.items.length > 100) fail();
  for (const [list, weapon] of [[value.weapons, true], [value.items, false]]) {
    const ids = new Set();
    for (const row of list) {
      const lengths = weapon ? { id:100, name:200, damage:1000, damageMode:5, trait:150, range:150, features:10000, tier:100 } : { id:100, name:200, quantity:20, tier:100, use:10000 };
      // Tags: a canonical list (the editor may hand them as "Reliable, Armor Piercing 2").
      if (weapon && row && typeof row.tags === 'string') row.tags = parseTagInput(row.tags);
      if (weapon && row && 'tags' in row && !validTags(row.tags)) fail();
      if (!row || typeof row !== 'object' || Object.keys(row).some(k => !(k in lengths) && !(weapon && k === 'tags'))) fail();
      for (const [key, max] of Object.entries(lengths)) if (typeof row[key] !== 'string' || row[key].length > max) fail();
      if (!row.id.trim() || ids.has(row.id) || !row.name.trim()) fail(); ids.add(row.id);
      if (weapon ? !['base', 'final'].includes(row.damageMode) : !/^\d{1,6}$/.test(row.quantity)) fail();
    }
  }
  return value;
}

// Accept only arithmetic we actually implement. Alternatives, keep-highest,
// rerolls and feature procedures remain explicit instead of being discarded.
export function parseDamageExpression(expression) {
  const error = () => { throw new Error('Usa dados y modificadores (ej.: 2d8+1 o 1d8+1+1d4). Elige una alternativa y resuelve las propiedades especiales según su texto.'); };
  if (typeof expression !== 'string' || expression.length > 1000) return error();
  const clean = expression.toLowerCase().replaceAll('−', '-').replace(/\b(?:physical|phys|energy|ene|shock|fire|cold|psychic|void|neural|kinetic|sonic|acid)\b\.?/g, '').replace(/\s/g, '');
  const terms = [...clean.matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/g)];
  if (!terms.length || terms.map(m => m[0]).join('') !== clean || terms.slice(1).some(m => !m[1])) return error();
  const pools = []; let flat = 0;
  for (const match of terms) {
    if (match[3]) {
      const count = Number(match[2] || 1), sides = Number(match[3]);
      if (match[1] === '-' || !Number.isInteger(count) || count < 1 || count > 100 || ![4,6,8,10,12,20].includes(sides)) return error();
      pools.push({ count, sides });
    } else flat += Number(match[4]) * (match[1] === '-' ? -1 : 1);
  }
  if (pools.length > 12 || pools.reduce((n,p) => n+p.count, 0) > 100 || Math.abs(flat) > 10000 || (!pools.length && flat < 1)) return error();
  return { pools, flat };
}

// Honed Edge (Corebook ch. 7): a Sleeping character adds level - 1 to damage, once.
export const honedEdgeOf = token => token?.path === 'Sleeping' ? Math.max(Number(token.honedEdgeBonus) || 0, Math.max(0, (token.level || 1) - 1)) : 0;
export function weaponPreset(token, weapon) {
  const base = weapon.damageMode === 'base';
  return { formula: weapon.damage, proficiency: base && token.isPlayer !== false ? token.proficiency || 1 : 1, honed: base ? honedEdgeOf(token) : 0 };
}

// The dice a damage roll puts on the table, in the order they are rolled: Proficiency on the
// first listed die (ch. 10), twice the pool on a player Critical, none on a Keeper Critical
// (the pool is maximised, not rolled).
export function damageDicePools(formula, { proficiency = 1, diceCount = 1, diceSides = 8, isCritical = false, isKeeperCritical = false } = {}) {
  if (isKeeperCritical) return [];
  const pools = formula
    ? parseDamageExpression(formula).pools.map((p, i) => ({ sides: p.sides, count: p.count + (i === 0 ? proficiency - 1 : 0) }))
    : [{ sides: diceSides, count: diceCount + proficiency - 1 }];
  return pools.map(p => ({ sides: p.sides, count: p.count * (isCritical ? 2 : 1) })).filter(p => p.count > 0);
}

export function resolveDamageExpression(expression, options = {}) {
  const parsed = parseDamageExpression(expression);
  const proficiency = options.proficiency ?? 1, honed = options.honed ?? 0;
  if (!Number.isInteger(proficiency) || proficiency < 1 || proficiency > 10 || !Number.isInteger(honed) || honed < 0 || honed > 9) throw new Error('Revisa Proficiency y Honed Edge.');
  const pools = parsed.pools.map((p, i) => ({ ...p, count: p.count + (i === 0 ? proficiency - 1 : 0) }));
  if (pools.reduce((n,p) => n+p.count, 0) > 100) throw new Error('Máximo 100 dados antes del Critical.');
  const rolls = []; let diceTotal = 0;
  for (const pool of pools) {
    const part = resolveDamage({ ...options, diceCount: pool.count, diceSides: pool.sides, flatModifier: 0, mountRating: 1 });
    rolls.push(...part.rolls); diceTotal += part.rawDamage;
  }
  // `bonus`: what is added to this damage besides the formula (Bear Down, Combat Surge…).
  const flatModifier = parsed.flat + honed + (Number.isInteger(options.bonus) ? options.bonus : 0);
  const result = resolveDamage({ ...options, diceCount: 0, flatModifier: diceTotal + flatModifier, mountRating: 1 });
  return { ...result, rolls, flatModifier, formula: expression, pools };
}

// What the target has against Penetration (Corebook ch. 10): Reflective armor cancels
// Energy; a Ward cancels Void and Neural; Composite armor blunts Crushing.
export function targetDefenses(token) {
  if (!token) return { reflective: false, warded: false, composite: false };
  const f = token.sourceCharacter?.document?.fields || {};
  const armorText = [...(token.inventory?.items || []).map(i => `${i.name} ${i.use}`), f.armor_name, f.armor_feat, f.armor_mods].join(' ');
  return { reflective: /\breflective\b/i.test(armorText), warded: token.voidWard === true, composite: /\bcomposite\b/i.test(armorText) };
}
