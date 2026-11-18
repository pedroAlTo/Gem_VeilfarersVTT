// Technology Access (Corebook ch. 6–7 class tables, ch. 13 Tech Tiers): which gear a character
// is trained to use. Every class trains some weapon families, armor weights and augment types,
// and reaches Military (TT2) at level 2 and Experimental (TT3) at level 5 (each class table
// says so); the "+1 Technology Access Level" advancement raises it. Table rule (user decision,
// 17 Nov 2026): using anything outside that competence rolls with Disadvantage, always.
import { tagsFromFeatures, hasTag } from './weaponTags.js';
import { EQUIPMENT_CATALOG } from './equipmentLibrary.js';
import { classOf } from './loadoutCards.js';
import { DRONE_GRADES } from './drones.js';

const lower = value => String(value ?? '').trim().toLowerCase();
const TIER_WORDS = { common: 1, military: 2, experimental: 3, precursor: 4 };
export const TIER_NAMES = { 1: 'Common (TT1)', 2: 'Military (TT2)', 3: 'Experimental (TT3)', 4: 'Precursor (TT4)' };

// "Common (TT1)", "Tier 2 · Lithian", "Military", 3 → 1..4.
export function tierRank(tier) {
  if (Number.isInteger(tier)) return tier;
  const text = lower(tier);
  const code = text.match(/tt\s*(\d)/) || text.match(/tier\s*(\d)/);
  if (code) return Number(code[1]);
  for (const [word, rank] of Object.entries(TIER_WORDS)) if (text.includes(word)) return rank;
  return 1;
}

// Families of the catalog weapons and armor, as the class tables name them.
const WEAPON_FAMILY = {
  Melee: ['core_wp_combat_knife', 'core_wp_stun_baton', 'core_wp_plasma_cutter', 'core_wp_monoblade', 'core_wp_energy_dagger', 'core_wp_vibro_sword', 'core_wp_chainglaive', 'core_wp_plasma_rapier', 'core_wp_gravity_hammer', 'core_wp_electro_whip', 'core_wp_phase_blade', 'core_wp_void_cleaver', 'rs_wp_lithian_hammer', 'rs_wp_kryllian_wrist_blade', 'rs_wp_voidborn_blade'],
  Pistols: ['core_wp_kinetic_pistol', 'core_wp_flechette_pistol', 'core_wp_plasma_pistol', 'core_wp_needle_gun', 'core_wp_combat_pistol', 'core_wp_gauss_pistol', 'core_wp_disruptor_pistol', 'core_wp_phase_pistol', 'core_wp_void_pistol', 'rs_wp_synther_arm_blaster'],
  Rifles: ['core_wp_assault_rifle', 'core_wp_sniper_rifle', 'core_wp_gauss_rifle', 'core_wp_battle_rifle', 'core_wp_sniper_system', 'core_wp_plasma_carbine'],
  'Heavy Weapons': ['core_wp_machine_gun', 'core_wp_heavy_machine_gun', 'core_wp_rocket_launcher', 'core_wp_railgun', 'core_wp_fusion_cannon'],
};
const ARMOR_WEIGHT = {
  Light: ['core_ar_tactical_weave', 'core_ar_env_suit', 'core_ar_mesh_armor', 'core_ar_pilot_jacket', 'core_ar_infiltrator_suit', 'core_ar_stealth_armor', 'core_ar_smart_fabric', 'core_ar_special_forces', 'core_ar_hazard_suit', 'core_ar_kinetic_shield', 'rs_ar_thermo_sink_plating', 'rs_ar_shadow_weave'],
  Medium: ['core_ar_homestead_rig', 'core_ar_heavy_combat_suit', 'core_ar_composite_armor', 'core_ar_security_armor', 'core_ar_colony_defense', 'core_ar_tactical_armor', 'core_ar_assault_armor', 'core_ar_marine_armor', 'core_ar_power_rig', 'rs_ar_lithian_silicate', 'rs_ar_chitin_carapace', 'rs_ar_sun_touched', 'rs_ar_scrap_plate', 'rs_ar_collectors_carapace'],
  Heavy: ['core_ar_riot_armor', 'core_ar_salvage_armor', 'core_ar_industrial_exosuit', 'core_ar_battle_armor', 'core_ar_power_armor_heavy', 'core_ar_siege_armor', 'rs_ar_dawn_regalia', 'rs_ar_iron_tyrant', 'rs_ar_joric_battle_plate', 'rs_ar_centurion_siege'],
};
const AUGMENT_TYPE = {
  Neural: ['core_aug_memory_chip', 'core_aug_pain_suppressor', 'core_aug_combat_precognition', 'core_aug_enhanced_reflexes', 'core_aug_sensory_package', 'rs_aug_drone_link_jack'],
  Physical: ['core_aug_subdermal_armor', 'core_aug_reinforced_bones', 'core_aug_toxin_filter', 'core_aug_prosthetic_limb', 'core_aug_combat_reflexes'],
  Stealth: ['core_aug_subdermal_camo'],
};
const familyFrom = (table, id) => Object.entries(table).find(([, ids]) => ids.includes(id))?.[0] || '';

// A weapon or armor without a catalog id: its own fields say its family (a `family` field, or a
// Melee range), never words in its name (user decision: tags and fields, not word search).
const WEAPON_FAMILIES = ['Melee', 'Pistols', 'Rifles', 'Heavy Weapons'];
function guessWeaponFamily(item) {
  if (WEAPON_FAMILIES.includes(item.family)) return item.family;
  if (lower(item.range) === 'melee') return 'Melee';
  return '';
}
function guessArmorWeight(item) {
  const tags = tagsFromFeatures(item.features);
  if (tags.some(t => ['heavy', 'very-heavy', 'massive'].includes(t.split(':')[0]))) return 'Heavy';
  const slots = Number(item.armorSlots);
  if (slots >= 7) return 'Heavy';
  if (slots >= 5) return 'Medium';
  return slots ? 'Light' : '';
}

const fold = value => lower(value).normalize('NFD').replace(/[̀-ͯ]/g, '');
// The catalog entry an inventory line came from (by name, either of its two names).
export function catalogEntry(name) {
  const wanted = fold(name);
  if (!wanted) return null;
  return EQUIPMENT_CATALOG.find(item => fold(item.name) === wanted || fold(item.name).split(' / ').includes(wanted)) || null;
}

// What kind of gear an item is and what it needs: { kind, rank, family, features }.
export function gearProfile(item, data = null) {
  if (!item) return null;
  const entry = item.category ? item : (catalogEntry(item.name) || null);
  const creator = !entry && data ? [...(data.weapons || []), ...(data.armor || [])].find(x => fold(x.name) === fold(item.name)) : null;
  const source = entry || creator || item;
  const kindOf = { weapons: 'weapon', armor: 'armor', augmentations: 'augment', gear: 'gear', drone_modules: 'drone' };
  let kind = kindOf[source.category] || (creator ? (data.weapons.includes(creator) ? 'weapon' : 'armor') : item.damage ? 'weapon' : '');
  const features = Array.isArray(source.features) ? source.features.join(', ') : String(source.features ?? '');
  const rank = tierRank(source.tierRank ?? source.tier ?? item.tier);
  let family = '';
  if (kind === 'weapon') family = familyFrom(WEAPON_FAMILY, source.id) || (creator && creator.category) || guessWeaponFamily({ ...item, ...source, features });
  if (kind === 'armor') family = familyFrom(ARMOR_WEIGHT, source.id) || (creator && creator.category) || guessArmorWeight({ ...item, ...source, features });
  if (kind === 'augment') family = familyFrom(AUGMENT_TYPE, source.id);
  return { kind, rank, family, features, name: item.name || source.name };
}

const fieldsOf = token => token?.sourceCharacter?.document?.fields || token?.sheetFields || {};

// The character's training: the highest Tech Tier its class and level reach (or its own
// Technology Access Level, if the sheet raised it) and the categories that tier lists.
// null for NPCs, adversaries and characters whose class is unknown: no restriction applies.
export function characterAccess(token, data) {
  if (!token || token.isPlayer === false || !data) return null;
  const cls = classOf(token, data);
  const tiers = cls?.technologyAccess?.tiers || [];
  if (!tiers.length) return null;
  const level = Number(token.level) || 1;
  const reached = tiers.filter(t => Number(t.level || 1) <= level).sort((a, b) => Number(a.rank) - Number(b.rank));
  const tier = reached.at(-1) || tiers[0];
  const own = Number(fieldsOf(token).tech_access) || 0;
  const rank = Math.max(Number(tier.rank) || 1, own);
  const summary = String(tier.summary || '');
  const augments = /all augment/i.test(summary) ? 'all' : (summary.match(/([A-Za-z/]+) Augments?/i)?.[1] || '').split('/').map(s => s.trim()).filter(Boolean);
  return {
    className: cls.name, level, rank, tierName: TIER_NAMES[rank] || tier.name, summary,
    weapons: tier.allWeapons || /all weapons/i.test(summary) ? 'all' : (tier.weaponCategories || []),
    armor: tier.allArmor || /all armor/i.test(summary) ? 'all' : (tier.armorCategories || []),
    augments, noHeavyArmor: /excluding heavy/i.test(summary), noMassive: /excluding massive/i.test(summary),
  };
}

// Whether the character is trained for an item. { ok, reason }. A gear's family is only
// checked when the class table names families for its kind; plain equipment checks the tier.
export function competence(item, token, data, access = characterAccess(token, data)) {
  const profile = gearProfile(item, data);
  if (!access || !profile || !profile.kind) return { ok: true, reason: '', profile };
  const out = reason => ({ ok: false, reason, profile });
  if (profile.rank > access.rank) return out(`${TIER_NAMES[profile.rank] || `Tier ${profile.rank}`}: tu Technology Access es ${access.tierName}.`);
  if (profile.kind === 'weapon' && profile.family && access.weapons !== 'all' && !access.weapons.includes(profile.family)) return out(`${access.className} no está entrenado en ${profile.family}.`);
  if (profile.kind === 'weapon' && access.noMassive && (hasTag(item, 'massive') || tagsFromFeatures(profile.features).includes('massive'))) return out(`${access.className} no está entrenado en armas Massive.`);
  if (profile.kind === 'armor' && profile.family && access.armor !== 'all' && !access.armor.includes(profile.family)) return out(`${access.className} no está entrenado en armadura ${profile.family}.`);
  if (profile.kind === 'armor' && access.noHeavyArmor && tagsFromFeatures(profile.features).some(t => ['heavy', 'very-heavy'].includes(t.split(':')[0]))) return out(`${access.className} no está entrenado en armaduras Heavy.`);
  if (profile.kind === 'augment' && profile.family && access.augments !== 'all' && !access.augments.includes(profile.family)) return out(`${access.className} no está entrenado en aumentos ${profile.family}.`);
  return { ok: true, reason: '', profile };
}

// A drone's chassis Grade is its Tech Tier (Common, Military, Experimental).
export function droneCompetence(drone, operator, data) {
  const grade = DRONE_GRADES[drone?.drone?.grade];
  if (!grade || !operator) return { ok: true, reason: '' };
  return competence({ name: grade.name, category: 'drone_modules', tier: grade.tier - 1 }, operator, data);
}

// Worn armor and installed augmentations from the inventory (and the imported sheet's armor).
export function wornGear(token, inventory) {
  const rows = [...(inventory?.items || [])];
  const f = fieldsOf(token);
  if (f.armor_name && !rows.some(r => fold(r.name) === fold(f.armor_name))) rows.push({ name: f.armor_name, tier: f.armor_tier || '', category: undefined });
  return rows;
}

// Everything the character carries that is outside its competence, with the reason.
export function gearOutsideCompetence(token, inventory, data) {
  const access = characterAccess(token, data);
  if (!access) return [];
  const rows = [...(inventory?.weapons || []), ...wornGear(token, inventory)];
  return rows.map(row => ({ row, check: competence(row, token, data, access) })).filter(({ check }) => !check.ok)
    .map(({ row, check }) => ({ name: row.name, kind: check.profile.kind, reason: check.reason }));
}

// Recommended consequence of a Failure with Fear, by the gear involved (Corebook ch. 13:
// "Weapon jams, armor seal breaks, kit dropped"; Ammunition; Jury-rigged; drone modules).
export function failureWithFearAdvice(kind, name = '', features = '') {
  const what = name ? `«${name}»` : '';
  if (kind === 'weapon') return `Failure with Fear con ${what || 'el arma'}: se recomienda que la consecuencia sea del arma: se encasquilla, se queda sin munición (una Acción y munición para recargar) o se cae.`;
  if (kind === 'armor') return /jury-rigged/i.test(features)
    ? `Failure with Fear con ${what || 'la armadura'} (Jury-rigged): una función con energía queda offline; si no tiene, −1 Armor Slot máximo hasta repararla (Acción, Knowledge (Tech) DC 10).`
    : `Failure with Fear con ${what || 'la armadura'}: se recomienda que la consecuencia sea de la armadura: se rompe el sellado o pierde una función.`;
  if (kind === 'augment') return `Failure with Fear con ${what || 'el aumento'}: se recomienda que se manifieste su inconveniente o que falle hasta repararlo.`;
  if (kind === 'drone') return `Failure with Fear del operador con ${what || 'el dron'}: se recomienda tirar la Drone Complication (d12) o dejar un módulo offline hasta una Acción y Knowledge (Tech) DC 10.`;
  return '';
}
