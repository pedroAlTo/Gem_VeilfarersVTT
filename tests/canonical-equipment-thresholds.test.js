// tests/canonical-equipment-thresholds.test.js
// Verification of Canonical Armor Thresholds, Weapons, Augmentations, Drone Modules and Fear on Adversary Spotlight

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUIPMENT_CATALOG,
  filterEquipmentCatalog,
  equipCatalogItem
} from '../src/equipmentLibrary.js';
import { resolveDamage } from '../src/rulesEngine.js';
import { CONDITIONS, CAMPAIGN_STATES, ALL_CONDITIONS_AND_STATES, conditionDefinition } from '../src/conditions.js';

test('canonical armors define majorThreshold, severeThreshold and armorSlots', () => {
  const armors = filterEquipmentCatalog({ category: 'armor' });
  assert.ok(armors.length >= 15, 'Contains complete canonical armor catalog');

  // Verify Frontier Vest / Tactical Weave
  const frontierVest = armors.find(a => a.id === 'core_ar_tactical_weave');
  assert.ok(frontierVest, 'Frontier Vest exists');
  assert.equal(frontierVest.majorThreshold, 5);
  assert.equal(frontierVest.severeThreshold, 11);
  assert.equal(frontierVest.armorSlots, 3);

  // Verify Combat Armor
  const combatArmor = armors.find(a => a.id === 'core_ar_heavy_combat_suit');
  assert.ok(combatArmor, 'Combat Armor exists');
  assert.equal(combatArmor.majorThreshold, 8);
  assert.equal(combatArmor.severeThreshold, 16);
  assert.equal(combatArmor.armorSlots, 3);

  // Verify Powered Armor
  const poweredArmor = armors.find(a => a.id === 'core_ar_power_rig');
  assert.ok(poweredArmor, 'Powered Armor exists');
  assert.equal(poweredArmor.majorThreshold, 13);
  assert.equal(poweredArmor.severeThreshold, 28);
  assert.equal(poweredArmor.armorSlots, 6);

  // Verify Siege Armor
  const siegeArmor = armors.find(a => a.id === 'core_ar_siege_armor');
  assert.ok(siegeArmor, 'Siege Armor exists');
  assert.equal(siegeArmor.majorThreshold, 16);
  assert.equal(siegeArmor.severeThreshold, 32);
  assert.equal(siegeArmor.armorSlots, 8);
});

test('canonical weapons define trait, damageType, and damage formula', () => {
  const weapons = filterEquipmentCatalog({ category: 'weapons' });
  assert.ok(weapons.length >= 20, 'Contains complete canonical weapons catalog');

  const knife = weapons.find(w => w.id === 'core_wp_combat_knife');
  assert.ok(knife);
  assert.equal(knife.trait, 'Finesse');
  assert.equal(knife.damageType, 'Physical');
  assert.equal(knife.range, 'Melee');

  const phaseBlade = weapons.find(w => w.id === 'core_wp_phase_blade');
  assert.ok(phaseBlade);
  assert.equal(phaseBlade.damageType, 'Void');

  const plasmaCarbine = weapons.find(w => w.id === 'core_wp_plasma_carbine');
  assert.ok(plasmaCarbine);
  assert.equal(plasmaCarbine.damageType, 'Energy');
  assert.equal(plasmaCarbine.trait, 'Instinct');
});

test('canonical augmentations and drone modules are present', () => {
  const augs = filterEquipmentCatalog({ category: 'augmentations' });
  assert.ok(augs.length >= 10, 'Canonical augmentations present');
  const memoryChip = augs.find(a => a.id === 'core_aug_memory_chip');
  assert.ok(memoryChip);
  assert.equal(memoryChip.augmentCost, 1);

  const droneMods = filterEquipmentCatalog({ category: 'drone_modules' });
  assert.ok(droneMods.length >= 12, 'Canonical drone modules present');
  const neuralNet = droneMods.find(m => m.id === 'drone_mod_neural_network_control');
  assert.ok(neuralNet, 'Neural network control module exists');
  assert.equal(neuralNet.slots, 0, 'Shared control module consumes 0 slots');
});

test('damage resolution uses target thresholds accurately', () => {
  // Target with Combat Armor + Level 2: Major = 10, Severe = 18
  const targetMajor = 10;
  const targetSevere = 18;

  // 1. Minor Hit (< 10)
  const minorResult = resolveDamage({
    diceCount: 0,
    flatModifier: 8,
    targetMajorThreshold: targetMajor,
    targetSevereThreshold: targetSevere,
    useArmorSlot: false,
    currentArmorSlots: 3
  });
  assert.equal(minorResult.baseSeverity, 'Minor');
  assert.equal(minorResult.finalHpDamage, 1);

  // 2. Major Hit (>= 10 and < 18)
  const majorResult = resolveDamage({
    diceCount: 0,
    flatModifier: 14,
    targetMajorThreshold: targetMajor,
    targetSevereThreshold: targetSevere,
    useArmorSlot: false,
    currentArmorSlots: 3
  });
  assert.equal(majorResult.baseSeverity, 'Major');
  assert.equal(majorResult.finalHpDamage, 2);

  // 3. Severe Hit (>= 18)
  const severeResult = resolveDamage({
    diceCount: 0,
    flatModifier: 21,
    targetMajorThreshold: targetMajor,
    targetSevereThreshold: targetSevere,
    useArmorSlot: false,
    currentArmorSlots: 3
  });
  assert.equal(severeResult.baseSeverity, 'Severe');
  assert.equal(severeResult.finalHpDamage, 3); // 18 + 3 = 21, < 10 over severe, so 3 HP

  // 4. Overkill Severe Hit (>= 28)
  const overkillResult = resolveDamage({
    diceCount: 0,
    flatModifier: 29,
    targetMajorThreshold: targetMajor,
    targetSevereThreshold: targetSevere,
    useArmorSlot: false,
    currentArmorSlots: 3
  });
  assert.equal(overkillResult.baseSeverity, 'Severe');
  assert.equal(overkillResult.finalHpDamage, 4); // 10 over severe = +1 HP (total 4 HP)

  // 5. Mitigated by Armor Slot
  const mitigatedResult = resolveDamage({
    diceCount: 0,
    flatModifier: 14,
    targetMajorThreshold: targetMajor,
    targetSevereThreshold: targetSevere,
    useArmorSlot: true,
    currentArmorSlots: 3
  });
  assert.equal(mitigatedResult.baseSeverity, 'Major');
  assert.equal(mitigatedResult.finalSeverity, 'Mitigated to Minor');
  assert.equal(mitigatedResult.finalHpDamage, 1);
  assert.equal(mitigatedResult.armorSlotSpent, true);
});

test('campaign states and standard conditions registry', () => {
  assert.equal(CONDITIONS.length, 18, '18 standard combat conditions');
  assert.equal(CAMPAIGN_STATES.length, 6, '6 campaign states');
  assert.equal(ALL_CONDITIONS_AND_STATES.length, 24);

  const overwhelmed = conditionDefinition('Overwhelmed');
  assert.ok(overwhelmed);
  assert.equal(overwhelmed.label, 'Abrumado');

  const dying = conditionDefinition('Dying');
  assert.ok(dying);
  assert.equal(dying.label, 'Moribundo');
});

test('keeper activating spotlight on adversary consumes 1 Fear', async () => {
  const { store } = await import('../src/state.js');
  await store.ready;

  const advToken = {
    id: 'tok_test_adv_spotlight',
    name: 'Xeno Stalker',
    actorType: 'adversary',
    isPlayer: false,
    hasSpotlight: false,
    hp: { current: 10, max: 10 },
    armor: { current: 0, max: 0 },
    mapId: store.state.activeMapId || 'scene_default'
  };

  store.state.tokens.push(advToken);
  store.state.userRole = 'keeper';
  store.sessionRole = 'host';

  // Fear = 0 -> cannot activate spotlight on adversary
  store.state.fear = 0;
  const failResult = store.setTokenSpotlight('tok_test_adv_spotlight', true);
  assert.equal(failResult, false);
  assert.equal(store.state.fear, 0);

  // Fear = 3 -> activating spotlight spends 1 Fear
  store.state.fear = 3;
  const successResult = store.setTokenSpotlight('tok_test_adv_spotlight', true);
  assert.equal(successResult, true);
  assert.equal(store.state.fear, 2, 'Fear decreased from 3 to 2');
  assert.equal(store.state.tokens.find(t => t.id === 'tok_test_adv_spotlight').hasSpotlight, true);
});
