import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEncounters, fearCost } from '../scripts/encounter-library.mjs';
import { activeEnvironmentFeatures, environmentActivation, validateEnvironment, validateBoss, advanceBoss, phaseReady, applyBossStats } from '../src/encounterRules.js';
import { validateCampaign, validTokenPatch } from '../src/validation.js';
const catalog = loadEncounters();
const actor = () => ({ id: 'boss', name: 'Boss', actorType: 'adversary', isPlayer: false, x: 100, y: 100, mapId: 'map', hp: { current: 0, max: 10, majorThreshold: 5, severeThreshold: 10 }, armor: { current: 1, max: 3 }, stress: { current: 2, max: 4 }, evasion: 10, conditions: ['Stunned', 'Hidden', 'Custom curse'] });
const phase = (name, hp = 8) => ({ name, hpMode: 'pool', trigger: 'hp0', stats: { hp } });
const base = () => ({ campaignName: 'Test', fear: 4, userRole: 'keeper', activeMapId: 'map', maps: [{ id: 'map', name: 'Bridge', imageUrl: '', gridSize: 64 }], tokens: [], logs: [], clocks: [], handouts: [], starship: { name: 'Ship', maxHull: 10, hull: 10, heat: 0, heatCap: 10, pearls: 0, shieldArcs: { fore: 0, aft: 0, port: 0, starboard: 0, maxPerArc: 1 } } });

test('canonical chapters contain 15 macro, 24 micro and 17 complete boss state profiles', () => {
  assert.equal(catalog.environments.filter(e => e.layer === 'macro').length, 15);
  assert.equal(catalog.environments.filter(e => e.layer === 'micro').length, 24);
  assert.equal(catalog.bosses.length, 17);
  assert.ok(catalog.environments.every(e => e.features.length >= 3 && e.line > 3600 && e.source.includes('12.06')));
  assert.ok(catalog.bosses.every(p => p.states.length >= 2 && p.states.length <= 4));
  for (const p of catalog.bosses) validateBoss({ index: 0, states: p.states });
  assert.equal(catalog.bosses[0].states[1].stats.damageExpression, '1d8+2 Physical');
  assert.match(catalog.bosses[0].states[1].transition, /CRACK/);
  assert.equal(catalog.bosses[13].states[1].clearMode, 'choose');
  assert.equal(catalog.bosses[16].states[3].defeat, 'objective');
  assert.equal(catalog.bosses[16].states[1].canAttack, false);
  assert.equal(catalog.bosses[14].requiresTiming, true);
  assert.equal(catalog.bosses[14].states[1].trigger, 'hp0');
  assert.equal(catalog.environments.find(e=>e.id==='keeper-micro-24').tierRules[3].dc,15);
});
test('Fear prices follow printed expenditure, not mentions of failed Fear rolls', () => {
  assert.equal(fearCost('The Keeper spends a Fear token.'), 1);
  assert.equal(fearCost('Spend 2 Fear to trigger this action.'), 2);
  assert.equal(fearCost('Spend an Action. Failure with Fear adds Stress.'), 0);
  assert.equal(fearCost('Failure with Fear costs time.'), 0);
  assert.equal(fearCost('Spend 1 Fear or spend 2 Fear.'), null);
  assert.equal(fearCost('Spend up to 3 Fear.'), null);
});
test('two layers permit all micro features and exactly one passive/action macro feature', () => {
  const micro = catalog.environments.find(e => e.layer === 'micro');
  const macro = catalog.environments.find(e => e.layer === 'macro');
  const feature = macro.features.find(f => f.type === 'Action');
  const env = { tier: 2, microId: micro.id, macroId: macro.id, macroFeatureId: feature.id };
  const active = activeEnvironmentFeatures(env, catalog.environments);
  assert.equal(active.length, micro.features.length + 1);
  assert.equal(active.filter(f => f.layer === 'macro').length, 1);
  assert.throws(() => activeEnvironmentFeatures({ ...env, macroFeatureId: macro.features.find(f => f.type === 'Reaction').id }, catalog.environments), /Passive o Action/);
  assert.throws(() => validateEnvironment({ ...env, microId: '' }), /primero/);
});
test('activation is an atomic Keeper transaction with printed cost, private log, trigger and active-scene guards', () => {
  const s = base(), micro = catalog.environments.find(e => e.layer === 'micro');
  const macro = catalog.environments.find(e => e.layer === 'macro' && e.features.some(f => f.type === 'Action' && f.fear > 0));
  const f = macro.features.find(f => f.type === 'Action' && f.fear > 0);
  s.maps[0].environment = { tier: 1, microId: micro.id, macroId: macro.id, macroFeatureId: f.id };
  const original = structuredClone(s);
  const patch = environmentActivation(s, 'local', 'map', f.id, catalog.environments);
  assert.equal(patch.fear, s.fear - f.fear); assert.equal(patch.logs.length, 1); assert.equal(patch.logs[0].visibility, 'keeper'); assert.deepEqual(s, original);
  assert.throws(() => environmentActivation({ ...s, fear: 0 }, 'local', 'map', f.id, catalog.environments), /suficiente Fear/);
  assert.throws(() => environmentActivation(s, 'player', 'map', f.id, catalog.environments), /Keeper/);
  assert.throws(() => environmentActivation(s, 'local', 'other', f.id, catalog.environments), /Activa esta escena/);
  const reaction = micro.features.find(f => f.type === 'Reaction');
  assert.throws(() => environmentActivation(s, 'local', 'map', reaction.id, catalog.environments), /disparador/);
  assert.ok(environmentActivation(s, 'local', 'map', reaction.id, catalog.environments, { triggerConfirmed: true }));
  assert.throws(() => environmentActivation(s, 'local', 'map', micro.features.find(f => f.type === 'Passive').id, catalog.environments), /pasiva/);
});
test('boss pool transition clears negative conditions, changes stats and grants final 3 Fear once, capped at 12', () => {
  const t = actor(); t.boss = { index: 0, states: [phase('First'), { ...phase('Final', 12), stats: { hp: 12, armor: 0, evasion: 15 } }] };
  const s = { ...base(), fear: 11, tokens: [t] };
  const patch = advanceBoss(s, 'local', t.id, 0, { clearCustom: ['Custom curse'] });
  assert.equal(patch.fear, 12); assert.equal(patch.tokens[0].hp.current, 12); assert.equal(patch.tokens[0].armor.current, 0); assert.equal(patch.tokens[0].evasion, 15);
  assert.deepEqual(patch.tokens[0].conditions, ['Hidden']); assert.equal(s.tokens[0].boss.index, 0);
  assert.throws(() => advanceBoss({ ...s, ...patch }, 'local', t.id, 0), /ya cambió/);
  assert.throws(() => advanceBoss(s, 'player', t.id, 0), /Keeper/);
});
test('non-final phases grant 2 Fear; percentage phases retain current/max HP and undeclared Armor/Stress', () => {
  const t = actor(); t.hp.current = 4;
  t.boss = { index: 0, states: [phase('First'), { ...phase('Enraged'), trigger: 'hpPercent', threshold: 50, hpMode: 'keep', stats: { evasion: 12 } }, phase('Final')] };
  const patch = advanceBoss({ ...base(), tokens: [t] }, 'local', t.id, 0);
  assert.equal(patch.fear, 6); assert.deepEqual(patch.tokens[0].hp, t.hp); assert.deepEqual(patch.tokens[0].armor, t.armor); assert.deepEqual(patch.tokens[0].stress, t.stress);
  assert.equal(patch.tokens[0].boss.index, 1);
});
test('clock, armor and narrative triggers require the corresponding evidence', () => {
  const t = actor(); t.boss = { index: 0, states: [phase('First'), { ...phase('Final'), trigger: 'clock', clockId: 'c' }] };
  assert.equal(phaseReady(t, [{ id: 'c', segments: 4, filled: 3 }]), false);
  assert.equal(phaseReady(t, [{ id: 'c', segments: 4, filled: 4 }]), true);
  t.boss.states[1].trigger = 'armor0'; assert.equal(phaseReady(t), false); t.armor.current = 0; assert.equal(phaseReady(t), true);
  t.boss.states[1].trigger = 'objective'; assert.equal(phaseReady(t), false); assert.equal(phaseReady(t, [], true), true);
});
test('specific boss timing and body-dependent condition exceptions take precedence', () => {
  const t = actor(); t.boss = { index: 0, requiresTiming: true, states: [phase('First'), { ...phase('Final'), clearMode: 'choose' }] };
  const s = { ...base(), tokens: [t] };
  assert.throws(() => advanceBoss(s, 'local', t.id, 0), /Spotlight/);
  const p = advanceBoss(s, 'local', t.id, 0, { timingConfirmed: true, clearCustom: ['Stunned'] });
  assert.deepEqual(p.tokens[0].conditions, ['Hidden', 'Custom curse']);
});
test('invalid states and inherited thresholds are rejected before applying stats', () => {
  assert.throws(() => validateBoss({ index: 0, states: [phase('Only')] }), /2 y 8/);
  assert.throws(() => validateBoss({ index: 0, states: [phase('First'), phase('Bad', NaN)] }), /inválido/);
  assert.throws(() => applyBossStats(actor(), { ...phase('Bad'), stats: { hp: 10, majorThreshold: 20 } }), /invertidos/);
});
test('saved campaigns validate environment and arc membership and reject player changes to boss state', () => {
  const s = base(); s.arcs = [{ id: 'a', name: 'Arc', sceneIds: ['map'] }];
  s.maps[0].environment = { tier: 1, microId: 'keeper-micro-1', macroId: '', macroFeatureId: '' };
  assert.ok(validateCampaign(s));
  assert.throws(() => validateCampaign({ ...s, arcs: [...s.arcs, { id: 'b', name: 'B', sceneIds: ['map'] }] }), /duplicated arc/);
  assert.throws(() => validateCampaign({ ...s, maps: [{ ...s.maps[0], environment: { tier: NaN } }] }), /tier/);
  assert.equal(validTokenPatch({ boss: { index: 4 } }), false);
});

test('Meltdown remains an active micro feature and starts its printed six-segment clock once', () => {
  const s = base(); s.maps[0].environment = { tier: 4, microId: 'keeper-micro-22' };
  const feature = activeEnvironmentFeatures(s.maps[0].environment, catalog.environments).find(f => f.type === 'Clock');
  assert.ok(feature); const patch = environmentActivation(s, 'local', 'map', feature.id, catalog.environments);
  assert.equal(patch.fear, s.fear); assert.equal(patch.clocks[0].segments, 6); assert.equal(patch.clocks[0].filled, 0);
  assert.throws(() => environmentActivation({ ...s, ...patch }, 'local', 'map', feature.id, catalog.environments), /ya existe/);
});
