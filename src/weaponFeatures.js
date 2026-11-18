import { hasTag, tagValue } from './weaponTags.js';
// Weapon features (Corebook ch. 13, Weapon Features Glossary), read from the weapon's tags
// (weaponTags.js), never by searching words in its text.
// What changes numbers is applied by the table: the attack roll (attackFlow.weaponAttackBonus),
// the Armor Slots the defender may spend, extra damage dice, an extra HP, Stress and the
// conditions a hit applies. Features that ask for a choice, a reaction roll or the fiction are
// shown as reminders after the hit, with the item's Feature DC.

export function weaponFeatures(weapon) {
  const t = id => !!weapon && typeof weapon === 'object' && hasTag(weapon, id);
  return {
    crushing: t('crushing'), bleed: t('bleed'), phasing: t('phasing'), cutting: t('cutting'), vibration: t('vibration'),
    shieldPiercing: t('shield-piercing'), burstFire: t('burst-fire'), massive: t('massive'), energySurge: t('energy-surge'),
    devastating: t('devastating'), poison: t('poison'), ignite: t('ignite'), overheating: t('overheating'),
  };
}

// Feature DC: TT1 10, TT2 15, TT3 20, TT4 25 (Corebook). Read from the item's tier text.
export function featureDC(weapon) {
  const tier = String(weapon?.tier ?? '');
  const tt = tier.match(/tt\s*([1-4])/i)?.[1] || tier.match(/tier\s*([1-4])/i)?.[1];
  if (tt) return [10, 15, 20, 25][Number(tt) - 1];
  if (/experimental/i.test(tier)) return 20;
  if (/military|advanced|uncommon/i.test(tier)) return 15;
  if (/precursor|legendary|artifact/i.test(tier)) return 25;
  return 10;
}

// The Armor Slots the defender may spend against this hit.
// Crushing (cancelled by Composite armor) and Phasing ignore one; Cutting and Vibration allow
// none; Shield Piercing allows half, rounded down.
export function armorSlotsAllowed(available, features = {}, { composite = false } = {}) {
  let slots = Math.max(0, Number(available) || 0);
  if (features.cutting || features.vibration) return 0;
  if (features.crushing && !composite) slots = Math.max(0, slots - 1);
  if (features.phasing) slots = Math.max(0, slots - 1);
  if (features.shieldPiercing) slots = Math.floor(slots / 2);
  return slots;
}
export function armorSlotNotes(features = {}, { composite = false } = {}) {
  const notes = [];
  if (features.cutting || features.vibration) notes.push(`${features.cutting ? 'Cutting' : 'Vibration'}: no se pueden gastar Armor Slots contra este impacto.`);
  else {
    if (features.crushing) notes.push(composite ? 'Crushing anulado por armadura Composite.' : 'Crushing: ignora 1 Armor Slot del objetivo en este impacto.');
    if (features.phasing) notes.push('Phasing: ignora 1 Armor Slot del objetivo en este impacto.');
    if (features.shieldPiercing) notes.push('Shield Piercing: solo se puede gastar la mitad de los Armor Slots (redondeando abajo).');
  }
  return notes;
}

// Extra damage after the dice are rolled. `rolls` and `sides` are the normal damage dice, in order.
// Burst Fire: each die at its maximum adds one die of the same size (the new dice do not explode).
// Massive: roll one more normal die and discard the lowest. Energy Surge: +1d6 Energy.
export function damageExtras(features = {}, rolls = [], sides = [], rollDie = s => Math.floor(Math.random() * s) + 1) {
  let bonus = 0;
  const notes = [];
  if (features.burstFire) {
    const extra = rolls.map((r, i) => (r === sides[i] && sides[i] > 1 ? rollDie(sides[i]) : null)).filter(v => v !== null);
    if (extra.length) { bonus += extra.reduce((a, b) => a + b, 0); notes.push(`Burst Fire: ${extra.length} dado${extra.length > 1 ? 's' : ''} extra [${extra.join(', ')}].`); }
  }
  if (features.massive && rolls.length) {
    const size = sides[0] || 6, extra = rollDie(size), low = Math.min(...rolls);
    const gain = Math.max(0, extra - low);
    bonus += gain;
    notes.push(`Massive: dado extra d${size} [${extra}], se descarta el más bajo (${Math.min(extra, low)})${gain ? `: +${gain}` : ''}.`);
  }
  if (features.energySurge) {
    const surge = rollDie(6);
    bonus += surge;
    notes.push(`Energy Surge: +1d6 [${surge}] Energy y el objetivo marca 1 Stress.`);
  }
  return { bonus, notes };
}

// The extra dice damageExtras will roll, in the same order, so they can be thrown as 3D dice
// first: one per Burst Fire die at its maximum, Massive's die, Energy Surge's d6.
export function extraDiceNeeded(features = {}, rolls = [], sides = []) {
  const out = [];
  if (features.burstFire) rolls.forEach((r, i) => { if (r === sides[i] && sides[i] > 1) out.push({ qty: 1, sides: sides[i], role: 'Burst Fire' }); });
  if (features.massive && rolls.length) out.push({ qty: 1, sides: sides[0] || 6, role: 'Massive' });
  if (features.energySurge) out.push({ qty: 1, sides: 6, role: 'Energy Surge' });
  return out;
}

// Devastating: when damage reaches the Severe Threshold, the hit marks 1 more HP.
export const devastatingExtra = (features = {}, raw = 0, severe = Infinity) => (features.devastating && raw >= severe ? 1 : 0);

// Stress the hit marks besides HP: Energy Surge on a hit, Poison when HP is lost.
export function hitStress(features = {}, { hpLost = 0 } = {}) {
  return (features.energySurge ? 1 : 0) + (features.poison && hpLost > 0 ? 1 : 0);
}
// Conditions the table applies by itself: Ignite (On Fire) when HP is lost.
export function hitConditions(features = {}, { hpLost = 0 } = {}) {
  return features.ignite && hpLost > 0 ? ['On Fire'] : [];
}

// Everything else, as reminders: what triggers it, who rolls against what, what it applies.
const REMINDERS = [
  ['stunning-on-crit', (dc, ctx) => ctx.critical ? 'Stunning on crit: el objetivo queda Stunned.' : ''],
  ['stunning', (dc, ctx) => ctx.damaged ? `Stunning: el objetivo hace una Strength Reaction Roll contra CD ${dc}; si falla, queda Stunned.` : ''],
  ['taser-charge', dc => `Taser Charge: Strength Reaction Roll contra CD ${dc}; si falla, Stunned.`],
  ['entangling', (dc, ctx) => ctx.damaged ? `Entangling: Strength Reaction Roll contra CD ${dc}; si falla, Restrained.` : ''],
  ['entrapping', dc => `Entrapping: el objetivo elige Strength o Knowledge (Tech) contra CD ${dc}; si falla, Incapacitated.`],
  ['disorienting', () => 'Disorienting: el objetivo queda Dazed.'],
  ['stagger', (dc, ctx) => ctx.damaged ? 'Stagger: el objetivo tiene Desventaja en su próxima acción.' : ''],
  ['continuous', () => 'Continuous: el objetivo marca 1 Stress al empezar su próximo Spotlight.'],
  ['brittle', (dc, ctx) => ctx.damaged ? 'Brittle: el próximo daño Physical que reciba hace +1d6.' : ''],
  ['armor-piercing', (dc, ctx, w) => `Armor Piercing${tagValue(w, 'armor-piercing') ? ` ${tagValue(w, 'armor-piercing')}` : ''}: reduce los Armor Slots máximos del objetivo según su valor hasta su próximo Long Rest.`],
  ['shredding', (dc, ctx) => ctx.damaged ? 'Shredding: −1 Armor Slot máximo del objetivo hasta reparar la armadura en Downtime.' : ''],
  ['mind-lock', dc => `Mind-Lock: si el objetivo marca Stress, Presence Reaction Roll contra CD ${dc}; si falla, solo puede moverse en su próximo Spotlight.`],
  ['disintegrating', (dc, ctx) => ctx.maxDie ? 'Disintegrating: un dado salió al máximo; un objeto expuesto queda inutilizado o −1 Armor Slot máximo (elige el objetivo).' : ''],
  ['unraveling', (dc, ctx) => ctx.maxDie ? 'Unraveling: un dado salió al máximo; el objetivo suprime un rasgo de Clase o Ancestry hasta el final de la escena.' : ''],
  ['system-shock', () => 'System Shock: daño normal contra Sintéticos y máquinas; contra orgánicos, solo 1d4 Stress.'],
  ['explosive', dc => `Explosive: todos a Very Close del impacto hacen una Agility Reaction Roll contra CD ${dc}; si fallan, daño completo; si aciertan, la mitad.`],
  ['automatic', (dc, ctx) => ctx.hit ? 'Automatic: marca 1 Stress para aplicar el mismo resultado a un segundo objetivo a Very Close del primero.' : ''],
  ['salvo-fire', (dc, ctx) => ctx.hit ? 'Salvo Fire: marca 1 Stress para aplicar el resultado a un segundo objetivo a Close del primero.' : ''],
  ['cleave', (dc, ctx) => ctx.hit ? 'Cleave: haz otro ataque contra un objetivo distinto a tu alcance.' : ''],
  ['quick', () => 'Quick: marca 1 Stress para hacer un segundo ataque al mismo objetivo.'],
  ['reload', () => 'Reload: gasta una Acción en recargar antes de volver a disparar.'],
  ['suppressive', () => 'Suppressive: marca 1 Stress; quien esté a Close del objetivo tiene Desventaja en sus ataques hasta el final de su próximo Spotlight.'],
  ['probability-shift', () => 'Probability Shift: puedes repetir los dos Duality Dice y quedarte con el nuevo resultado.'],
  ['paired', (dc, ctx, w) => `Paired${tagValue(w, 'paired') ? ` +${tagValue(w, 'paired')}` : ''}: con dos armas Paired, suma el bono Paired de una de ellas al daño.`],
  ['psionic', dc => `Psionic: no tira contra Evasion; el objetivo hace una Presence Reaction Roll contra CD ${dc} (falla: daño completo; acierta: nada).`],
  ['area', () => 'Área: el efecto alcanza a todas las criaturas de su zona (también aliados); compara la tirada con la Evasion de cada una.'],
  ['waveform', () => 'Área: el efecto alcanza a todas las criaturas de su zona (también aliados); compara la tirada con la Evasion de cada una.'],
  ['dispersal-wave', () => 'Área: el efecto alcanza a todas las criaturas de su zona (también aliados); compara la tirada con la Evasion de cada una.'],
  ['massive', () => 'Massive: quien lo empuña tiene −1 Evasion.'],
];
// ctx.armorAuto: the table already cut the target's maximum Armor Slots (an enemy, see armorCut).
const ARMOR_CUT_TAGS = ['armor-piercing', 'shredding', 'disintegrating'];
export function featureReminders(weapon, ctx = {}) {
  if (!weapon || typeof weapon !== 'object') return [];
  const dc = featureDC(weapon);
  return [...new Set(REMINDERS.filter(([id]) => hasTag(weapon, id) && !(ctx.armorAuto && ARMOR_CUT_TAGS.includes(id))).map(([, say]) => say(dc, ctx, weapon)).filter(Boolean))];
}

// Cuts to an enemy's maximum Armor Slots, applied at once (enemies rarely live to a second
// round, so a reminder would come too late). Each cut keeps how it comes back:
// - Armor Piercing (rating, default 1), on a hit: until its next Long Rest.
// - Disintegrating, when a damage die rolls its maximum: −1 until Repair All Armor (for an NPC
//   the Keeper chooses; on an armored enemy the table takes the Armor Slot).
// - Shredding, when the hit deals damage: −1 until the armor is repaired in Downtime.
// null when nothing is cut. PCs keep the reminders: the player chooses (Disintegrating) and the
// cut is applied on their sheet.
export function armorCut(weapon, ctx = {}, armorMax = 0) {
  if (!weapon || !ctx.hit || !(armorMax > 0)) return null;
  const cut = { long: 0, repairAll: 0, downtime: 0 };
  if (hasTag(weapon, 'armor-piercing')) cut.long = Math.max(1, Math.min(5, tagValue(weapon, 'armor-piercing', 1)));
  if (hasTag(weapon, 'disintegrating') && ctx.maxDie) cut.repairAll = 1;
  if (hasTag(weapon, 'shredding') && ctx.damaged) cut.downtime = 1;
  return cut.long + cut.repairAll + cut.downtime ? cut : null;
}
export const validArmorCut = c => !!c && typeof c === 'object' && ['long', 'repairAll', 'downtime'].every(k => Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= 5) && c.long + c.repairAll + c.downtime >= 1;
// The armor after the cut: its maximum drops (never below 0), the slots left fit the new maximum,
// and `cut` remembers what each rest gives back.
export function applyArmorCut(armor = {}, cut) {
  const total = cut.long + cut.repairAll + cut.downtime;
  const max = Math.max(0, (armor.max || 0) - total), before = armor.cut || {};
  return { ...armor, max, current: Math.min(armor.current || 0, max), cut: { long: (before.long || 0) + cut.long, repairAll: (before.repairAll || 0) + cut.repairAll, downtime: (before.downtime || 0) + cut.downtime } };
}
// What a rest gives back: a Long Rest ends the Armor Piercing cuts; Repair All Armor also those
// of Disintegrating. The Shredding ones wait for Downtime (the Keeper edits them by hand).
export function restoreArmorCut(armor = {}, { long = false, repairAll = false } = {}) {
  const c = armor.cut;
  if (!c) return armor;
  const back = (long ? c.long || 0 : 0) + (repairAll ? c.repairAll || 0 : 0);
  if (!back) return armor;
  const cut = { long: long ? 0 : c.long || 0, repairAll: repairAll ? 0 : c.repairAll || 0, downtime: c.downtime || 0 };
  const { cut: _old, ...rest } = armor;
  return { ...rest, max: (armor.max || 0) + back, ...(cut.long + cut.repairAll + cut.downtime ? { cut } : {}) };
}
export function armorCutNotes(cut) {
  if (!cut) return [];
  return [
    ...(cut.long ? [`Armor Piercing: −${cut.long} Armor Slot${cut.long > 1 ? 's' : ''} máximo${cut.long > 1 ? 's' : ''} del objetivo al aplicar el daño (hasta su próximo Long Rest).`] : []),
    ...(cut.repairAll ? ['Disintegrating: un dado salió al máximo; −1 Armor Slot máximo del objetivo al aplicar el daño (hasta Repair All Armor).'] : []),
    ...(cut.downtime ? ['Shredding: −1 Armor Slot máximo del objetivo al aplicar el daño (hasta reparar la armadura en Downtime).'] : []),
  ];
}

// Overheating: after each attack roll a d6; on 1–2 the weapon must cool down.
export function overheatCheck(features = {}, rollDie = s => Math.floor(Math.random() * s) + 1) {
  if (!features.overheating) return null;
  const roll = rollDie(6);
  return { roll, overheated: roll <= 2, text: roll <= 2 ? `Overheating: d6 [${roll}]: el arma se sobrecalienta; marca 1 Stress para enfriarla o gasta una Acción antes de volver a atacar.` : `Overheating: d6 [${roll}]: sin problema.` };
}
