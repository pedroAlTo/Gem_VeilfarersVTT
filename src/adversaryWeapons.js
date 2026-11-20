// Read the published Damage field, including older tokens which only stored the prose.
const pool = /^(?:\d*d(?:4|6|8|10|12|20)(?!\d)|\d+)(?:\s*[+-]\s*(?:\d*d(?:4|6|8|10|12|20)(?!\d)|\d+))*/i;
const namedTypes = /\b(physical|phys|energy|void|neural|kinetic|impact|acid|shock|explosive)\b/i;
const baseType = value => ({ phys: 'Physical', kinetic: 'Physical', impact: 'Physical', acid: 'Energy', shock: 'Energy' }[value.toLowerCase()] || value);
export const fixedStressAttack = token => {
  const amount = /^(\d+)\s+Stress(?:\s*\([^)]*\))?$/i.exec(token?.damageExpression?.trim() || '')?.[1];
  return amount && +amount >= 1 && +amount <= 3 ? Number(amount) : 0;
};
export const proceduralAttack = token => !!fixedStressAttack(token) || /^(?:narrative|infection)$/i.test(token?.damageExpression?.trim() || '');

function attackRows(token) {
  const source = token.damageExpression.trim();
  if (/^(?:special \(multiple attacks\)|3 attacks \(various\))$/i.test(source)) {
    const assault = (token.featureNotes || '').match(/makes 3 attacks:\s*([^\n|]+)/i)?.[1] || '';
    return [...assault.matchAll(/(?:^|,\s*(?:and )?)([^,(]+?)\s*\(([^)]+)\)/g)].map(m => [m[1].trim(), m[2]]);
  }
  if (proceduralAttack(token)) return [];
  const named = [...source.matchAll(/(?:^|,\s*)([^,(]+?)\s*\((\d*d\d+[^)]*)\)/gi)];
  if (named.length && !pool.test(source)) return named.map(m => [m[1].trim(), m[2]]);
  const alternatives = source.split(/\s+(?:or|\/)\s+/i);
  return alternatives.map((part, i) => {
    if (i && !pool.test(part) && namedTypes.test(part)) part = (source.match(pool)?.[0] || '') + ' ' + part;
    return [part.match(/\(([^)]+)\)/)?.[1] || (alternatives.length > 1 ? part : 'Ataque del adversario'), part];
  });
}

export function adversaryWeapons(token) {
  if (!token.damageExpression) return [];
  return attackRows(token).map(([name, printed], i) => {
    const first = printed.match(pool);
    // Unknown custom expressions remain editable in the manual damage field.
    let damage = printed;
    if (first) {
      const tail = printed.slice(first[0].length);
      const extra = tail.match(/^\s*(?:phys(?:ical)?|energy|void|neural)\s*(\+\s*\d*d\d+(?:\s*[+-]\s*\d+)?)\b/i)?.[1] || '';
      const mixed = tail.match(/^\s*(?:phys(?:ical)?|energy|void|neural)\s*\+\s*\d*d\d+\s+shock\s*$/i);
      const type = tail.split(/[;(]/, 1)[0].match(namedTypes)?.[1];
      damage = mixed ? printed : (first[0] + extra).replace(/\s/g, '') + (type && type.toLowerCase() !== 'explosive' ? ' ' + baseType(type) : '');
    }
    return { id: i ? 'main-attack-' + (i + 1) : 'main-attack', name, damage, damageMode: 'final',
      trait: 'Attack ' + (token.attackModifier ?? 0), range: token.attackRange || '', features: printed, tier: '' };
  });
}
