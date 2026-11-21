import extras from './extraEquipmentArt.json' with { type: 'json' };
import { EQUIPMENT_CATALOG } from './equipmentLibrary.js';

const equipmentPictures = new Map(EQUIPMENT_CATALOG.flatMap(item => [item.id, item.name, ...item.name.split(' / ')].map(key => [key.toLowerCase(), item.id])));
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
export function equipmentPicture(item) {
  const id = [item?.catalogId, item?.id].map(v => equipmentPictures.get(String(v ?? '').toLowerCase())).find(Boolean) || equipmentPictures.get(String(item?.name).toLowerCase()) || extras[String(item?.name).toLowerCase()];
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
