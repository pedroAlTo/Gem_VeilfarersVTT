// What a character wears and has installed (V3, user decision 21 Nov 2026): armor and
// augmentations change the character's numbers, so putting them on and taking them off goes
// through the table, which works out the change from the catalog and can undo it exactly.
// Corebook 12.06, ch. 10 (Natural Thresholds) and «Augmentation Systems».
import { EQUIPMENT_CATALOG } from './equipmentLibrary.js';
import { newId } from './persistence.js';
import { equipmentNameAliases } from './equipmentNames.js';
import { legacyEquipmentId } from './equipmentArtwork.js';

const fold = value => String(value ?? '').trim().toLowerCase();
const byId = new Map(EQUIPMENT_CATALOG.map(item => [item.id, item]));
const byName = new Map(EQUIPMENT_CATALOG.flatMap(item => [item.name, ...String(item.name).split(' / ')].map(name => [fold(name), item])));
// An inventory row's catalog entry: by catalogId, by name, by the name it had in older
// inventories (legacy list in equipmentArtwork) or by any of its aliases ("English / Español").
const byAlias = new Map();
for (const item of EQUIPMENT_CATALOG) for (const key of equipmentNameAliases(item.name)) if (!byAlias.has(key)) byAlias.set(key, item);
export const catalogEntry = row => byId.get(row?.catalogId) || byName.get(fold(row?.name)) || byId.get(legacyEquipmentId(row?.name))
  || equipmentNameAliases(row?.name).map(key => byAlias.get(key)).find(Boolean) || null;

// The kind of an inventory row: its own `kind`, else what its catalog entry is.
export function gearKind(row) {
  if (['armor', 'augment', 'gear'].includes(row?.kind)) return row.kind;
  const category = catalogEntry(row)?.category;
  return category === 'armor' ? 'armor' : category === 'augmentations' ? 'augment' : 'gear';
}

// What each augmentation does. `effects` are always on while it is installed (and undone when it
// is removed); `active` makes it a card in the hand: it is used, with its Stress cost and limit.
// Situational bonuses (+1 on some rolls) and immunities stay as text: the table applies them.
export const AUGMENTS = {
  core_aug_combat_reflexes: { effects: { evasion: 1 } },
  core_aug_subdermal_armor: { effects: { armorMax: 1 } },
  core_aug_reinforced_bones: { effects: { hpMax: 2 } },
  core_aug_prosthetic_limb: { effects: { strength: 1 } },
  core_aug_enhanced_reflexes: { effects: { agility: 2 } },
  core_aug_sensory_package: { effects: { instinct: 2 } },
  core_aug_combat_precognition: { active: { stress: 1, limit: '1 / escena', text: 'Una vez por escena, marca 1 Stress: Ventaja en un ataque o en una tirada de reacción en combate.' } },
  core_aug_pain_suppressor: { active: { stress: 0, clearStress: 1, limit: '1 / escena', reaction: true, text: 'Una vez por escena, después de un impacto que te marque 2 o más HP: limpia 1 Stress.' } },
};
const TRAIT_NAMES = { strength: 'Fuerza', agility: 'Agilidad', instinct: 'Instinto', finesse: 'Finura', presence: 'Presencia', knowledge: 'Conocimiento' };
export function effectsLine(effects = {}) {
  const out = [];
  if (effects.evasion) out.push(`+${effects.evasion} Evasión`);
  if (effects.armorMax) out.push(`+${effects.armorMax} Armor Slot máx.`);
  if (effects.hpMax) out.push(`+${effects.hpMax} HP máx.`);
  for (const [trait, name] of Object.entries(TRAIT_NAMES)) if (effects[trait]) out.push(`+${effects[trait]} ${name}`);
  return out.join(' · ');
}
export const augmentRule = row => AUGMENTS[catalogEntry(row)?.id] || null;

// Augment Capacity: the three best of Strength, Agility, Finesse and Presence (minimum 0); Humans
// and Synthetics +2. Each augment costs 1; each point past the capacity is −1 maximum Stress.
export function augmentCapacity(token) {
  const t = token?.traits || {};
  const best = ['strength', 'agility', 'finesse', 'presence'].map(k => Number(t[k]) || 0).sort((a, b) => b - a).slice(0, 3);
  const frame = /human|synthetic|sint[eé]tico|humano/i.test(`${token?.ancestry || ''} ${token?.species || ''}`) ? 2 : 0;
  return Math.max(0, best.reduce((a, b) => a + b, 0)) + frame;
}
export const installedAugments = inventory => (inventory?.items || []).filter(row => gearKind(row) === 'augment');
export const overCapacity = (token, inventory) => Math.max(0, installedAugments(inventory).length - augmentCapacity(token));

// Base Damage Thresholds with no armor: Major 2 / Severe 4 (4 / 6 for the plated ancestries).
const PLATED = /kryll|rift ?spinner|synthetic|sint[eé]tic/i;
export const naturalThresholds = token => (PLATED.test(`${token?.ancestry || ''} ${token?.species || ''}`) ? [4, 6] : [2, 4]);

// The stat changes of a set of effects, signed (+1 installs, −1 removes), on a working copy.
function applyEffects(token, effects, sign) {
  if (!effects) return;
  if (effects.evasion) token.evasion = (Number(token.evasion) || 10) + sign * effects.evasion;
  if (effects.hpMax && token.hp) { const max = Math.max(1, token.hp.max + sign * effects.hpMax); token.hp = { ...token.hp, max, current: Math.min(max, Math.max(0, token.hp.current + sign * effects.hpMax)) }; }
  if (effects.armorMax) { const a = token.armor || { current: 0, max: 0 }; const max = Math.max(0, (a.max || 0) + sign * effects.armorMax); token.armor = { ...a, max, current: Math.min(max, Math.max(0, (a.current || 0) + sign * effects.armorMax)) }; }
  for (const trait of Object.keys(TRAIT_NAMES)) if (effects[trait]) token.traits = { ...(token.traits || {}), [trait]: (Number(token.traits?.[trait]) || 0) + sign * effects[trait] };
}
// Armor Slots an armor gives plus those the installed augments add.
const augmentArmor = inventory => installedAugments(inventory).reduce((n, row) => n + (augmentRule(row)?.effects?.armorMax || 0), 0);

// The token fields that changed between two copies (only those gear touches).
const FIELDS = ['inventory', 'hp', 'armor', 'evasion', 'traits', 'stress'];
const changes = (before, after) => Object.fromEntries(FIELDS.filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(k => [k, after[k]]));

// Over-capacity follows the augments and the traits: maximum Stress moves by the difference.
function settleCapacity(before, beforeInventory, after) {
  const diff = overCapacity(after, after.inventory) - overCapacity(before, beforeInventory);
  if (!diff || !after.stress) return;
  const max = Math.max(1, (after.stress.max ?? 6) - diff);
  after.stress = { ...after.stress, max, current: Math.min(max, after.stress.current || 0) };
}

// Installing armor or an augmentation from the catalog. Armor replaces the armor worn.
// inventory: the character's current inventory (tokenInventory). Returns the token patch.
export function installGear(token, inventory, item, id = newId()) {
  if (!item || !['armor', 'augmentations'].includes(item.category)) throw new Error('Eso no es una armadura ni un aumento.');
  const after = structuredClone({ ...token, inventory });
  const row = { id, name: item.name, tier: item.tier || '', quantity: '1', use: item.use || item.benefit || item.features || '', catalogId: item.id, kind: item.category === 'armor' ? 'armor' : 'augment' };
  if (row.kind === 'armor') {
    // The new armor is put on; the one worn until now stays carried (v2.30.0).
    for (const r of after.inventory.items) if (gearKind(r) === 'armor') r.equipped = false;
    row.equipped = true;
    wearStats(after, token, item);
  } else {
    if (installedAugments(after.inventory).some(r => catalogEntry(r)?.id === item.id)) throw new Error(`${item.name} ya está instalado.`);
    applyEffects(after, AUGMENTS[item.id]?.effects, +1);
  }
  after.inventory.items.push(row);
  settleCapacity(token, inventory, after);
  return changes({ ...token, inventory }, after);
}

// The armor worn: the one marked equipped. Rows from before v2.30.0 have no mark: then the first
// unmarked armor is the one on and the rest are carried.
export function wornArmor(inventory) {
  const armors = (inventory?.items || []).filter(r => gearKind(r) === 'armor');
  return armors.find(r => r.equipped === true) || armors.find(r => r.equipped === undefined) || null;
}
export const isWorn = (row, inventory) => !!row && wornArmor(inventory) === row;
// Thresholds and Armor Slots of an armor (a catalog entry), or the natural ones with none.
function wearStats(after, token, entry) {
  const level = Number(token.level || 1), extra = augmentArmor(after.inventory);
  if (entry && entry.majorThreshold && entry.severeThreshold) after.hp = { ...after.hp, majorThreshold: entry.majorThreshold + level, severeThreshold: entry.severeThreshold + level };
  else { const [major, severe] = naturalThresholds(token); after.hp = { ...after.hp, majorThreshold: major + level, severeThreshold: severe + level }; }
  const max = (entry?.armorSlots || 0) + extra;
  after.armor = { ...(after.armor || {}), max, current: entry ? max : Math.min(max, after.armor?.current || 0) };
}
// Putting on a carried armor (rowId) or taking the worn one off (null): only one is worn.
export function wearArmor(token, inventory, rowId) {
  const after = structuredClone({ ...token, inventory });
  const row = rowId ? after.inventory.items.find(r => r.id === rowId && gearKind(r) === 'armor') : null;
  if (rowId && !row) throw new Error('Esa armadura ya no está en el inventario.');
  for (const r of after.inventory.items) if (gearKind(r) === 'armor') r.equipped = r === row;
  const entry = row && catalogEntry(row);
  if (row && !entry) throw new Error(`${row.name} no está en el catálogo: sus umbrales se editan en la ficha.`);
  wearStats(after, token, entry);
  return changes({ ...token, inventory }, after);
}

// Taking a piece off: the worn armor leaves the natural thresholds and no Armor Slots of its
// own (a carried one changes nothing); an augmentation's effects are undone. Any other row is
// just removed.
export function removeGear(token, inventory, rowId) {
  const all = [...inventory.weapons, ...inventory.items], row = all.find(r => r.id === rowId);
  if (!row) throw new Error('Eso ya no está en el inventario.');
  const after = structuredClone({ ...token, inventory });
  after.inventory.weapons = after.inventory.weapons.filter(r => r.id !== rowId);
  after.inventory.items = after.inventory.items.filter(r => r.id !== rowId);
  const kind = inventory.weapons.includes(row) ? 'weapon' : gearKind(row);
  if (kind === 'armor') { if (wornArmor(inventory) === row) wearStats(after, token, null); }
  else if (kind === 'augment') applyEffects(after, augmentRule(row)?.effects, -1);
  settleCapacity(token, inventory, after);
  return changes({ ...token, inventory }, after);
}
