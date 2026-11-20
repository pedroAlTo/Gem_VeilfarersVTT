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
  let resistant = false;
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
