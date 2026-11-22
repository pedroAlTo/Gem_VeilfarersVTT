import extras from './extraEquipmentArt.json' with { type: 'json' };
import { EQUIPMENT_CATALOG } from './equipmentLibrary.js';
import { equipmentNameAliases, equipmentNameKey } from './equipmentNames.js';

// The table's own entries have their paintings by id; the book items generated in v2.30.0
// (ids «bk_…») are found by their English name, or share a painting of their family.
const tableItems = EQUIPMENT_CATALOG.filter(item => !String(item.id).startsWith('bk_'));
const bookItems = new Map(EQUIPMENT_CATALOG.filter(item => String(item.id).startsWith('bk_')).map(item => [item.id, item]));
const catalogIds = new Set([...tableItems.map(item => item.id), ...Object.values(extras)]);
const exactNames = new Map(Object.entries(extras).map(([name, id]) => [equipmentNameKey(name), id]));
const aliases = new Map();
for (const item of tableItems) {
  for (const key of equipmentNameAliases(item.name)) if (!aliases.has(key)) aliases.set(key, item.id);
  for (const name of [item.name, ...item.name.split(' / ')]) exactNames.set(equipmentNameKey(name), item.id);
}
// The local inventory used to save a short display name, often with a generated row ID.
// Renamed items use their original art identity. Retired items share a painting of
// the same equipment family; this lookup never changes their stats or inventory IDs.
const legacyEquipment = [
  ['core_ar_tactical_weave', 'Malla Táctica Balística'],
  ['core_ar_heavy_combat_suit', 'Traje de Combate Blindado Orbital'],
  ['core_wp_plasma_carbine', 'Carabina de Plasma'],
  ['core_wp_mag_cannon', 'Cañón de Aceleración Magnética', 'core_wp_railgun'],
  ['core_wp_scattergun', 'Escopeta Táctica de Dispersión', 'tt1-shotgun-civilian'],
  ['core_wp_void_rifle', 'Rifle de Francotirador del Vacío', 'core_wp_sniper_system'],
  ['core_wp_beam_saber', 'Espada de Haz Fotónico', 'core_wp_plasma_rapier'],
  ['rs_wp_chitin_spikes', 'Lanzador de Espículas Quitinosas', 'core_wp_needle_gun'],
  ['rs_wp_chitin_mandible', 'Garras Mandibulares Biomecánicas', 'rs_wp_kryllian_wrist_blade'],
  ['rs_aug_lithian_seismic_node', 'Nodo Sísmico Subdérmico Lithian', 'core_aug_sensory_package'],
  ['rs_aug_geode_core', 'Núcleo Resonante de Geoda', 'rs_ar_lithian_silicate'],
  ['rs_aug_chitin_pheromone', 'Transmisor de Feromonas de Alerta', 'tt1-communications-implant'],
  ['rs_aug_neural_overclock', 'Módulo de Overclocking Neural Sintético', 'core_aug_enhanced_reflexes'],
  ['rs_aug_subdermal_wiring', 'Cableado Óptico de Reflejos Subdérmicos', 'core_aug_combat_reflexes'],
  ['rs_aug_void_gills', 'Branquias de Membrana del Vacío', 'tt1-respiratory-enhancement'],
  ['rs_aug_zerog_thrusters', 'Propulsores Maniobrables de Gravedad Cero', 'drone_mod_mil_flight'],
  ['rs_aug_ocular_targeter', 'Ojo Cibernético con HUD Táctico', 'tt1-optical-enhancement-basic'],
  ['rs_aug_hydraulic_muscle', 'Injerto Muscular Hidráulico', 'tt1-enhanced-muscles'],
  ['rs_aug_auto_adrenal_pump', 'Bomba Adrenal de Resucitación Táctica', 'core_gr_stim_injector'],
];
// The catalog id an older inventory name stands for (v2.30.0: gear.js classifies those rows too).
const legacyByName = new Map(legacyEquipment.map(([id, name]) => [equipmentNameKey(name), id]));
export const legacyEquipmentId = name => legacyByName.get(equipmentNameKey(name)) || null;
const legacyIds = new Map();
for (const [id, name, artId = id] of legacyEquipment) {
  exactNames.set(equipmentNameKey(name), artId);
  legacyIds.set(id, artId);
}
// Equipment painted from the original medallion entries. Each row is one 3 × 3 sheet.
const objectSheets = [
  ["core_wp_plasma_rapier", "core_wp_gravity_hammer", "core_wp_electro_whip", "core_wp_kinetic_pistol", "core_wp_flechette_pistol", "core_wp_plasma_pistol", "core_wp_needle_gun", "core_wp_combat_pistol", "core_wp_gauss_pistol"],
  ["core_wp_rocket_launcher", "core_wp_railgun", "core_wp_fusion_cannon", "rs_wp_lithian_hammer", "rs_wp_kryllian_wrist_blade", "rs_wp_voidborn_blade", "rs_wp_synther_arm_blaster", "core_aug_memory_chip", "core_aug_pain_suppressor"],
  ["tt1-beam-cannon", "tt1-net-launcher", "tt1-plasma-cannon", "tt1-chain-improvised", "tt1-club-baton", "tt1-hand-axe", "tt1-hatchet", "tt1-mace", "tt1-machete"],
  ["tt1-mining-pick", "tt1-pipe-wrench", "tt1-pry-bar", "tt1-quarterstaff", "tt1-service-combat-knife", "tt1-shock-baton", "tt1-spear", "tt1-survival-tomahawk", "tt1-utility-knife"],
  ["tt1-mono-blade", "tt1-carbine", "tt1-civilian-pulse-gun", "tt1-frontier-revolver", "tt1-heavy-pistol", "tt1-hold-out-pistol", "tt1-holdout-blaster", "tt1-holdout-laser", "tt1-industrial-cutter"],
  ["tt1-laser-pistol", "tt1-light-pistol", "tt1-medium-pistol", "tt1-slug-pistol", "tt1-stun-blaster", "tt1-taser-pistol", "tt1-hunting-rifle", "tt1-laser-rifle", "tt1-shotgun-civilian"],
  ["tt1-sporting-rifle", "tt1-varmint-rifle", "tt1-plasma-rifle", "tt1-pulse-rifle", "tt1-frontier-jacket", "tt1-reinforced-clothing", "tt1-combat-jacket", "tt1-audio-dampeners", "tt1-enhanced-muscles"],
  ["tt1-light-absorbent-skin", "tt1-neural-silence-nodes", "tt1-subdermal-camouflage", "tt1-thermal-shroud", "tt1-active-toxin-purger", "tt1-audio-enhancement-basic", "tt1-communications-implant", "tt1-data-jack", "tt1-environmental-adaptation-basic"],
  ["tt1-internal-storage-compartment", "tt1-memory-core-basic", "tt1-muscle-weave-basic", "tt1-olfactory-booster", "tt1-optical-enhancement-basic", "tt1-reflex-trigger", "tt1-respiratory-enhancement", "tt1-subdermal-plating-light", "tt1-shielded-receiver"],
  ["tt1-radiation-chem-sensor", "tt1-audio-suite", "tt1-medical-scanner", "tt1-tool-mount", "tt1-cutter", "tt1-repair-kit", "tt1-noise-dampener", "tt1-low-profile-frame", "tt1-decoy-flare-pod"],
  ["tt1-smoke-flash-pod", "tt1-stun-dart"],
  ["core_ar_smart_fabric","core_ar_special_forces","core_ar_tactical_armor","core_ar_assault_armor","core_ar_marine_armor","core_ar_power_rig","core_ar_battle_armor","core_ar_power_armor_heavy","core_ar_siege_armor"],
  ["rs_ar_sun_touched","rs_ar_dawn_regalia","rs_ar_iron_tyrant","rs_ar_shadow_weave","rs_ar_joric_battle_plate","rs_ar_centurion_siege","rs_ar_collectors_carapace","core_wp_phase_blade","core_wp_void_cleaver"],
  ["core_wp_phase_pistol","core_wp_void_pistol","core_aug_combat_precognition"],
];
const objects = new Map(objectSheets.flatMap((sheet, index) => sheet.map((id, cell) => [id, { index, cell }])));
// The picture of a piece of equipment, for a card: one image, or a cell of a 3 × 3 sheet.
// item: a catalog entry or an inventory row (by catalogId, id or name). null if it has none.
// A painting of the same family for a book item without its own (never changes its stats).
const FAMILY_ART = {
  weapons: { Melee: 'tt1-machete', Pistols: 'tt1-heavy-pistol', Rifles: 'tt1-hunting-rifle', 'Heavy Weapons': 'core_wp_rocket_launcher', '': 'tt1-heavy-pistol' },
  armor: { Light: 'core_ar_tactical_weave', Medium: 'core_ar_composite_armor', Heavy: 'core_ar_riot_armor', '': 'core_ar_composite_armor' },
  augmentations: { Sensory: 'tt1-optical-enhancement-basic', Neural: 'core_aug_memory_chip', Physical: 'tt1-enhanced-muscles', Combat: 'core_aug_combat_reflexes', Utility: 'tt1-tool-mount', House: 'core_aug_combat_precognition', Stealth: 'tt1-subdermal-camouflage', '': 'core_aug_memory_chip' },
  gear: { 'Médico': 'tt1-medical-scanner', 'Supervivencia': 'tt1-radiation-chem-sensor', 'Herramientas': 'tt1-repair-kit', 'Tecnología': 'tt1-data-jack', 'Comunicaciones': 'tt1-communications-implant', 'Seguridad e infiltración': 'tt1-noise-dampener', 'Vigilancia': 'tt1-audio-suite', 'Intrusión': 'tt1-data-jack', 'Ciencia prohibida': 'tt1-shielded-receiver', 'Protección': 'tt1-low-profile-frame', 'Sustancias': 'core_gr_stim_injector', 'Personal y varios': 'core_gr_omnitool', '': 'core_gr_omnitool' },
};
export function equipmentPicture(item) {
  const explicit = [item?.catalogId, item?.id].map(id => legacyIds.get(id) || id).find(id => catalogIds.has(id));
  if (explicit) return pictureForId(explicit);
  const names = equipmentNameAliases(item?.name);
  const id = exactNames.get(names[0]) || names.map(name => exactNames.get(name) || aliases.get(name)).find(Boolean);
  if (id) return pictureForId(id);
  const book = bookItems.get(item?.catalogId) || bookItems.get(item?.id) || (item?.category ? item : null);
  const family = book && FAMILY_ART[book.category];
  return family ? pictureForId(family[book.family] || family['']) : null;
}
function pictureForId(id) {
  const object = objects.get(id);
  if (object) return { illustration: `/assets/equipment/objects/set-${object.index + 1}.webp`, cell: object.cell };
  return typeof id === 'string' ? { illustration: `/assets/equipment/${id}.webp` } : null;
}
export function equipmentThumbnail(item) {
  const picture = equipmentPicture(item);
  if (!picture) return '';
  if (Number.isInteger(picture.cell)) {
    const { illustration, cell } = picture;
    return `<span class="equip-object-picture"><img src="${illustration}" style="left:-${cell % 3 * 100}%;top:-${Math.floor(cell / 3) * 100}%" alt="" loading="lazy" /></span>`;
  }
  return `<img src="${picture.illustration}" width="54" height="54" loading="lazy" alt="" style="object-fit:cover;border-radius:5px;flex:none" />`;
}
