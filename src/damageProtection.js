import { resists } from './powerEffects.js';
// Corebook 12.06, Sacred System Bible §5. Only a declared, active defence applies.
export const damageNames = ['Physical', 'Energy', 'Void', 'Neural', 'Kinetic', 'Ballistic', 'Blunt', 'Impact', 'Plasma', 'Laser', 'Arc', 'Thermal', 'Fire', 'Cold', 'Sonic', 'Radiant', 'Radiation', 'Lightning', 'Corrosive', 'Acid', 'Toxic', 'Chemical', 'Poison', 'Psionic', 'Shock', 'Explosive'];
const lower = value => String(value || '').trim().toLowerCase();
const terms = new RegExp('\\b(' + damageNames.join('|') + ')\\b', 'gi');

export function hitTypes(type, weapon, formula, tag = '') {
  // Include named delivery tags alongside the selected universal type. A note about
  // a conditional effect in an item's description does not change its damage type.
  const published = /^main-attack(?:-\d+)?$/.test(weapon?.id || '') ? String(weapon.features || '').split(';')[0] : '';
  const printed = [published, weapon?.damage, weapon?.name, ...(weapon?.tags || []), formula, tag].join(' ');
  const tags = (printed.match(terms) || []).map(lower).filter(t => !['physical', 'energy', 'void', 'neural'].includes(t));
  return new Set([lower(type), ...tags]);
}

export function damageProtection(token, types) {
  // A Power in effect (Kinetic Barrier: Resistance to Physical).
  let resistant = [...types].some(type => resists(token, type));
  for (const name of token?.conditions || []) {
    const active = lower(name);
    if (types.has('physical')) {
      if (/^(?:phase shift|incorporeal)(?:$| · )/.test(active)) return 'immune';
      if (/^(?:lithoderm|carapace plating)(?:$| · )/.test(active)) resistant = true;
    }
    const match = active.match(/(?:^| · )(resistance|resistencia|immunity|inmunidad|immune)(?:\s+(?:to|a))?\s*:?\s+([a-z]+)(?: damage)?$/);
    if (!match || !types.has(match[2])) continue;
    if (['immune', 'immunity', 'inmunidad'].includes(match[1])) return 'immune';
    resistant = true;
  }
  return resistant ? 'resistant' : '';
}


// Fold repeated amounts of the same type before rounding resistance for this hit.
export function mitigateComponents(components, target, fallback = '') {
  const grouped = new Map();
  for (const { amount, types } of components) {
    const key = [...types].sort().join('|');
    if (grouped.has(key)) grouped.get(key).amount += amount;
    else grouped.set(key, { amount, types: [...types] });
  }
  const groups = [...grouped.values()].map(group => {
    const applied = target ? damageProtection(target, new Set(group.types)) : fallback;
    const effective = applied === 'immune' ? 0 : applied === 'resistant' ? Math.floor(group.amount / 2) : group.amount;
    return { ...group, applied, effective };
  });
  const effectiveDamage = groups.reduce((sum, g) => sum + g.effective, 0);
  const statuses = new Set(groups.map(g => g.applied));
  const protection = statuses.size === 1 ? groups[0].applied : 'partial';
  return { groups, effectiveDamage, protection, fullyProtected: !!protection && groups.every(g => g.effective <= 0) };
}

// A player may have rolled before the Keeper changed one of the defences.
export function sameDamageDefenses(target, defense) {
  const groups = defense.groups ?? [defense]; // Accept single-type hits from older clients.
  return Array.isArray(groups) && groups.length > 0 && groups.length <= 100 && groups.every(g =>
    Array.isArray(g?.types) && g.types.length > 0 && g.types.length <= 32 &&
    g.types.every(t => typeof t === 'string' && t.length <= 32) &&
    g.applied === damageProtection(target, new Set(g.types)));
}
