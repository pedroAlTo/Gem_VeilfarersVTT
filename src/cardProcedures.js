// Offers dice explicitly printed on the card. The Keeper chooses the clause and its subject
// (costs, reductions and failure branches often contain different dice in the same paragraph).
const traits = 'Agility|Finesse|Strength|Instinct|Knowledge|Presence';
export function printedChecks(card) {
  const checks = new Map();
  const add = (trait, dc) => {
    if (+dc >= 1 && +dc <= 100) checks.set(trait.toLowerCase() + ':' + dc, { traitId: trait.toLowerCase(), dc: +dc });
  };
  const source = String(card.text || '').replace(/\*+/g, '');
  for (const m of source.matchAll(new RegExp('\\b(' + traits + ')(?:\\s*\\([^)]+\\))?\\s+(?:(?:Core Trait|Trait|Spellcast|Reaction)\\s+)?(?:roll|check)\\b[^.\\n;]{0,28}?DC\\s*(\\d+)', 'gi'))) add(m[1], m[2]);
  for (const m of source.matchAll(new RegExp('DC\\s*(\\d+)\\s*\\((' + traits + ')\\)', 'gi'))) add(m[2], m[1]);
  return [...checks.values()];
}
export function printedPools(card, actor) {
  const pools = new Map();
  const text = String(card.text || '').replace(/\*+/g, '');
  const rx = /(?:\(?Proficiency(?:\s*[×x*]\s*(\d+))?\)?\s*[×x*]?\s*(?:d(4|6|8|10|12|20))|\b(\d*)d(4|6|8|10|12|20))\b(?:\s*([+−-])\s*(\d+))?/gi;
  for (const m of text.matchAll(rx)) {
    const qty = m[2] ? (actor?.proficiency || 1) * Number(m[1] || 1) : Number(m[3] || 1);
    if (qty < 1 || qty > 40) continue;
    const sides = Number(m[2] || m[4]), flat = Number(m[6] || 0) * (m[5] === '-' || m[5] === '−' ? -1 : 1);
    const label = qty + 'd' + sides + (flat ? (flat > 0 ? '+' : '') + flat : '');
    pools.set(label, { qty, sides, flat, label });
  }
  return [...pools.values()];
}
