import { resolveDamage } from './rulesEngine.js';

const text = value => value == null ? '' : String(value);
export function tokenInventory(token) {
  if (token.inventory) return structuredClone(token.inventory);
  const f = token.sourceCharacter?.document?.fields || {};
  const weapons = ['wpri', 'wsec'].filter(p => f[p + '_name']).map(p => {
    const final = (token.path === 'Awakened' && f[p + '_dmg_final_aw']) || f[p + '_dmg_final'];
    return { id: p, name: text(f[p + '_name']), damage: text(final || f[p + '_dmg']), damageMode: final ? 'final' : 'base', trait: text(f[p + '_trait']), range: text(f[p + '_range']), features: text(f[p + '_feat']), tier: text(f[p + '_tier']) };
  });
  if (!weapons.length && token.isPlayer === false && token.damageExpression) weapons.push({ id: 'main-attack', name: 'Ataque del adversario', damage: token.damageExpression, damageMode: 'final', trait: 'Attack ' + (token.attackModifier ?? 0), range: token.attackRange || '', features: '', tier: '' });
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
      if (!row || typeof row !== 'object' || Object.keys(row).some(k => !(k in lengths))) fail();
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
  const clean = expression.toLowerCase().replaceAll('−', '-').replace(/\b(?:physical|phys|energy|ene|shock|fire|cold|psychic|void|kinetic|sonic|acid)\b\.?/g, '').replace(/\s/g, '');
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

export function weaponPreset(token, weapon) {
  return { formula: weapon.damage, proficiency: weapon.damageMode === 'base' && token.isPlayer !== false ? token.proficiency || 1 : 1, honed: weapon.damageMode === 'base' && token.path === 'Sleeping' ? token.honedEdgeBonus || 0 : 0 };
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
  const flatModifier = parsed.flat + honed;
  const result = resolveDamage({ ...options, diceCount: 0, flatModifier: diceTotal + flatModifier, mountRating: 1 });
  return { ...result, rolls, flatModifier, formula: expression, pools };
}
