// Every roll is thrown as 3D dice (V3): the dice land on the screen of whoever rolls, the faces
// they show are the result, and the table sees the result card. The table that applies the roll
// takes those faces when they are valid; otherwise (3D off, an old client) it rolls them itself.
const random = sides => Math.floor(Math.random() * sides) + 1;

// groups: [{ qty, sides, role }]. describe(values) → the result card's text (label, outcome,
// total, modifiers…). Returns the faces, in the order of the groups.
export async function throwDice(groups, { label = 'Tirada', describe = null, actor = null, secret = null } = {}) {
  const dice = typeof window !== 'undefined' ? window.veilDiceRoller : null;
  const list = groups.filter(g => g.qty > 0).map(g => ({ theme: 'vfNeutral', ...g }));
  if (!list.length) return [];
  const thrown = (await dice?.roll3D?.(list, label)) || null;
  const values = thrown || list.flatMap(g => Array.from({ length: g.qty }, () => random(g.sides)));
  if (dice?.announceRoll) {
    const roles = list.flatMap(g => Array.from({ length: g.qty }, () => ({ sides: g.sides, role: g.role || 'Standard' })));
    const card = describe ? describe(values) : {};
    const total = card.total ?? values.reduce((a, b) => a + b, 0);
    dice.announceRoll({
      label, actorName: actor?.name || 'Operativo', tokenName: actor?.name || 'Operativo',
      playerName: (typeof window !== 'undefined' && window.veilStore?.state?.userName) || 'Jugador',
      skill: label, value: total, total, outcome: card.outcome || String(total), modifiers: card.modifiers || list.map(g => `${g.qty}d${g.sides}`).join(' + '),
      rolls: values.map((value, i) => ({ value, ...roles[i] })), style: 'overlay',
    }, { rolled3D: !!thrown, secret: secret ?? dice.rollVisibility?.() === 'keeper' });
  }
  return values;
}

// Faces sent by a client, checked before the table uses them.
export const validFaces = (faces, count, sides) => Array.isArray(faces) && faces.length === count && faces.every(v => Number.isInteger(v) && v >= 1 && v <= sides);
// A die roller that hands out the given faces in order, then rolls when they run out.
export const facesRoller = (faces = []) => { let i = 0; return sides => (Number.isInteger(faces[i]) && faces[i] >= 1 && faces[i] <= sides ? faces[i++] : (i++, random(sides))); };
