import test from 'node:test';
import assert from 'node:assert/strict';
import { weaponFeatures, featureDC, armorSlotsAllowed, damageExtras, devastatingExtra, hitStress, hitConditions, featureReminders, overheatCheck } from '../src/weaponFeatures.js';
import { damageTypeOf } from '../src/rulesEngine.js';

test('features are read from the weapon text', () => {
  const f = weaponFeatures({ name: 'Rifle', features: 'Burst Fire; Shield Piercing; Devastating; Poison; Ignite' });
  assert.deepEqual([f.burstFire, f.shieldPiercing, f.devastating, f.poison, f.ignite, f.massive], [true, true, true, true, true, false]);
  assert.equal(damageTypeOf({ name: 'Phase Blade', damage: 'd8', features: 'Phasing' }), 'void', 'Phasing deals Void');
});

test('Feature DC by tier: TT1 10, TT2 15, TT3 20, TT4 25', () => {
  assert.deepEqual(['Common (TT1)', 'TT2', 'Tier 3', 'TT4', ''].map(tier => featureDC({ tier })), [10, 15, 20, 25, 10]);
});

test('Armor Slots the defender may spend', () => {
  assert.equal(armorSlotsAllowed(4, { crushing: true }), 3);
  assert.equal(armorSlotsAllowed(4, { crushing: true }, { composite: true }), 4);
  assert.equal(armorSlotsAllowed(4, { phasing: true }), 3);
  assert.equal(armorSlotsAllowed(4, { cutting: true }), 0);
  assert.equal(armorSlotsAllowed(4, { vibration: true }), 0);
  assert.equal(armorSlotsAllowed(5, { shieldPiercing: true }), 2);
});

test('extra damage: Burst Fire, Massive, Energy Surge', () => {
  const dice = [6, 2];
  const roll = () => dice.shift();
  assert.deepEqual(damageExtras({ burstFire: true }, [8, 3, 8], [8, 8, 8], roll), { bonus: 8, notes: ['Burst Fire: 2 dados extra [6, 2].'] });
  assert.equal(damageExtras({ massive: true }, [2, 5], [6, 6], () => 6).bonus, 4, 'the new 6 replaces the 2');
  assert.equal(damageExtras({ massive: true }, [4, 5], [6, 6], () => 1).bonus, 0, 'the new die is the lowest: discarded');
  assert.equal(damageExtras({ energySurge: true }, [3], [6], () => 5).bonus, 5);
  assert.equal(damageExtras({}, [6], [6]).bonus, 0);
});

test('Devastating, Stress and conditions of a hit', () => {
  assert.equal(devastatingExtra({ devastating: true }, 12, 12), 1);
  assert.equal(devastatingExtra({ devastating: true }, 11, 12), 0);
  assert.equal(hitStress({ energySurge: true, poison: true }, { hpLost: 1 }), 2);
  assert.equal(hitStress({ poison: true }, { hpLost: 0 }), 0);
  assert.deepEqual(hitConditions({ ignite: true }, { hpLost: 2 }), ['On Fire']);
  assert.deepEqual(hitConditions({ ignite: true }, { hpLost: 0 }), []);
});

test('reminders name the trigger, the roll and the Feature DC', () => {
  const r = featureReminders({ features: 'Stunning; Reload', tier: 'TT2' }, { damaged: true });
  assert.match(r[0], /Strength Reaction Roll contra CD 15.*Stunned/);
  assert.match(r[1], /Reload/);
  assert.deepEqual(featureReminders({ features: 'Stunning' }, { damaged: false }), [], 'Stunning needs a damaged target');
  assert.equal(overheatCheck({ overheating: true }, () => 2).overheated, true);
  assert.equal(overheatCheck({}), null);
});
