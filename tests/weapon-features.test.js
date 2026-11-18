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

test('the whisper to the Keeper lists what is left to resolve', async () => {
  const { rulesWhisperText } = await import('../src/rulesWhisper.js');
  assert.equal(rulesWhisperText({ attacker: 'Pirata', target: 'Kira', weapon: 'Shock Baton', notes: ['Stunning: …'] }), '⚔ Pirata → Kira · Shock Baton: por resolver\n• Stunning: …');
  assert.equal(rulesWhisperText({ notes: [] }), '', 'nothing to resolve, nothing sent');
});

test('weapons carry canonical tags; the rules read the tags, not words in the text', async () => {
  const { tagFrom, tagsFromFeatures, hasTag, tagValue, tagLabel, parseTagInput, validTags } = await import('../src/weaponTags.js');
  const { weaponAttackBonus, rangeCheck } = await import('../src/attackFlow.js');
  assert.deepEqual(['Reliable', 'Armor Piercing (2)', 'Paired+2', 'Reach 2m', 'Energy Tag: Energy dmg', 'Lightweight: 0 Burden'].map(tagFrom), ['reliable', 'armor-piercing:2', 'paired:2', 'reach:2', 'energy', 'lightweight']);
  assert.deepEqual(tagsFromFeatures('Lightweight: 0 Burden; Energy Tag: Energy dmg; Pen -2'), ['lightweight', 'energy', 'pen-2']);
  assert.deepEqual(tagsFromFeatures(['Accurate', 'Two-Handed']), ['accurate', 'two-handed']);
  assert.deepEqual(parseTagInput('Reliable, Armor Piercing 2, Reach'), ['reliable', 'armor-piercing:2', 'reach']);
  assert.equal(tagLabel('armor-piercing:2'), 'Armor Piercing 2');
  assert.equal(validTags(['reliable', 'paired:2']), true); assert.equal(validTags(['<script>']), false);
  // Tags decide: words in the name or the description change nothing.
  assert.equal(weaponAttackBonus({ name: 'Reliable Rifle', features: 'very reliable in mud', tags: [] }, 'Far').bonus, 0);
  assert.equal(weaponAttackBonus({ name: 'Rifle', tags: ['reliable', 'accurate'] }, 'Far').bonus, 2);
  assert.equal(rangeCheck({ name: 'Vibro-lanza', range: 'Melee', features: 'out of reach of most', tags: [] }, 'Very Close').allowed, false);
  assert.equal(rangeCheck({ name: 'Vibro-lanza', range: 'Melee', tags: ['reach'] }, 'Very Close').allowed, true);
  assert.equal(weaponFeatures({ name: 'Massive Hammer', tags: [] }).massive, false);
  assert.equal(weaponFeatures({ tags: ['massive', 'devastating'] }).devastating, true);
  assert.equal(damageTypeOf({ damage: 'd8 phys.', tags: ['energy'] }), 'energy');
  assert.equal(damageTypeOf({ damage: 'd8', name: 'Energy Blade', tags: [] }), 'physical', 'the name says nothing');
  assert.equal(hasTag({ features: 'Reliable: +1 attack' }, 'reliable'), true, 'an older weapon reads its Features list');
  assert.equal(tagValue({ tags: ['armor-piercing:2'] }, 'armor-piercing'), 2);
});

test('effects that add damage to an attack come from an explicit list', async () => {
  const { availableRiders, firstStrikeRider, rollExpression, CARD_RIDERS } = await import('../src/damageRiders.js');
  assert.deepEqual(CARD_RIDERS.map(r => r.id), ['combat-surge', 'held-line']);
  const surge = { id: 'feature:combat-surge', name: 'Combat Surge', playable: true, cost: { hope: 2 } };
  const soldier = { hope: 2, proficiency: 3 };
  assert.deepEqual(availableRiders(soldier, [surge]).map(r => [r.id, r.dice, r.enough]), [['combat-surge', '1d6', true]]);
  assert.equal(availableRiders({ hope: 1 }, [surge])[0].enough, false, 'not enough Hope');
  assert.deepEqual(availableRiders(soldier, [surge], ['combat-surge']), [], 'once per attack');
  const inState = { proficiency: 3, effectClocks: [{ id: 'n', name: 'Path to Nirvana', segments: 4, filled: 0, tick: 'fear' }] };
  assert.deepEqual(availableRiders(inState, []).map(r => [r.id, r.dice]), [['breaking-point', '3d6']]);
  assert.equal(firstStrikeRider(inState, { range: 'Melee', tags: [] }).dice, '2d6');
  assert.equal(firstStrikeRider(inState, { range: 'Far', tags: [] }), null, 'only a Melee attack');
  assert.equal(firstStrikeRider({ effectClocks: [{ ...inState.effectClocks[0], firstStrikeUsed: true }] }, null), null, 'only the first');
  assert.deepEqual(rollExpression('2d6', () => 4), { total: 8, faces: [4, 4] });
});

test('a damage formula adds Bear Down and the effects on top (they were lost with a written formula)', async () => {
  const { resolveDamageExpression } = await import('../src/equipment.js');
  const base = resolveDamageExpression('d8+2', { rollDie: () => 3, targetMajorThreshold: 6, targetSevereThreshold: 12 });
  const plus = resolveDamageExpression('d8+2', { rollDie: () => 3, targetMajorThreshold: 6, targetSevereThreshold: 12, bonus: 4 });
  assert.equal(base.rawDamage, 5); assert.equal(plus.rawDamage, 9);
});
