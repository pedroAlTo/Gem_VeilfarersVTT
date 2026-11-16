import test from 'node:test';
import assert from 'node:assert/strict';
import { DRONE_GRADES, DRONE_MODULES, DRONE_SAMPLE_BUILDS, DRONE_COMPLICATIONS, droneBuild, droneModule, installationRule, droneTokenData, droneEvasion, droneCommand, validateDroneState, rollDroneComplication, worsenSignal } from '../src/drones.js';

test('the three Drone Grades carry the numbers of the Corebook table', () => {
  const row = g => [g.tier, g.cost, g.hp, g.evasion, g.major, g.severe, g.armor, g.slots];
  assert.deepEqual(row(DRONE_GRADES.common), [2, 4, 2, 10, 5, 11, 0, 2]);
  assert.deepEqual(row(DRONE_GRADES.military), [3, 8, 3, 11, 7, 14, 1, 3]);
  assert.deepEqual(row(DRONE_GRADES.experimental), [4, 16, 5, 12, 9, 16, 2, 4]);
  assert.deepEqual([DRONE_GRADES.common.evasionCap, DRONE_GRADES.military.evasionCap, DRONE_GRADES.experimental.evasionCap], [12, 14, 15]);
});

test('the module catalog holds the printed modules with their cost, Slots and Grade', () => {
  assert.equal(DRONE_MODULES.filter(m => m.source === 'Corebook').length, 31);
  assert.equal(new Set(DRONE_MODULES.map(m => m.id)).size, DRONE_MODULES.length);
  const row = id => { const m = droneModule(id); return [m.cost, m.slots, m.grade, m.source]; };
  assert.deepEqual(row('extended-link'), [2, 1, 'common', 'Corebook']);
  assert.deepEqual(row('neural-network-control'), [1, 0, 'common', 'Corebook']);
  assert.deepEqual(row('compliance-taser'), [4, 2, 'common', 'Corebook']);
  assert.deepEqual(row('micro-laser'), [4, 2, 'military', 'Corebook']);
  assert.deepEqual(row('military-flight-module'), [6, 1, 'military', 'Corebook']);
  assert.deepEqual(row('hardened-link'), [6, 1, 'military', 'Rust & Steel']);
  assert.deepEqual(row('ghost-signal-lattice'), [16, 2, 'experimental', 'Rust & Steel']);
  assert.match(droneModule('agile-servos').effect, /\+1 Evasion/);
  assert.equal(DRONE_COMPLICATIONS.length, 12);
});

test('every sample build of the chapter is legal and costs what the book prints', () => {
  const totals = { 'cheap-scout-mote': 5, 'field-repair-beetle': 7, 'relay-crawler': 7, 'flying-scout-mote': 7, 'shared-crew-scout': 6, 'security-stun-drone': 18, 'tactical-support-frame': 18, 'ghost-signal-infiltrator': 56 };
  for (const sample of DRONE_SAMPLE_BUILDS) {
    const build = droneBuild(sample);
    assert.deepEqual(build.errors, [], sample.name); assert.equal(build.cost, totals[sample.id], sample.name);
  }
  assert.match(droneBuild(DRONE_SAMPLE_BUILDS.find(b => b.id === 'flying-scout-mote')).notes.join(' '), /−2 a las tiradas de Agility/);
});

test('modules change the frame: Evasion, Armor Slots and thresholds, within the Grade cap and its Slots', () => {
  const plated = droneBuild({ grade: 'military', modules: ['armor-plating', 'agile-servos', 'reinforced-plating'] });
  assert.deepEqual([plated.evasion, plated.armor, plated.major, plated.severe, plated.slotsUsed], [11, 2, 9, 16, 3]);
  const capped = droneBuild({ grade: 'experimental', modules: ['agile-servos', 'reflex-kernel', 'low-light-camera', 'audio-suite'] });
  assert.equal(capped.evasion, 14); assert.deepEqual(capped.errors, []);
  assert.match(droneBuild({ grade: 'common', modules: ['stun-dart', 'low-light-camera'] }).errors[0], /2 Module Slots y esta configuración usa 3/);
  assert.deepEqual(droneBuild({ grade: 'common', modules: ['flight-module', 'wall-crawler'] }).movement, ['Terrestre', 'Vuelo', 'Paredes y techos']);
  assert.throws(() => droneBuild({ grade: 'common', modules: ['nope'] }), /desconocido/);
});

test('a module above the Grade of the frame is an illegal modification with its own procedure', () => {
  assert.equal(installationRule('military', 'common'), null);
  assert.deepEqual([installationRule('common', 'military').dc, installationRule('military', 'experimental').dc, installationRule('common', 'experimental').extraSlot], [15, 20, 1]);
  const refused = droneBuild({ grade: 'common', modules: ['target-painter'] });
  assert.match(refused.errors[0], /solo lo monta como modificación ilegal/);
  const allowed = droneBuild({ grade: 'common', modules: ['target-painter'], illegalMods: true });
  assert.deepEqual(allowed.errors, []); assert.match(allowed.notes[0], /DC 15/);
  assert.equal(droneBuild({ grade: 'common', modules: ['reflex-kernel'], illegalMods: true }).slotsUsed, 2, 'Experimental in Common uses one more Slot');
  // A Common frame is locked against lethal weapons until the Weaponized Common Drones procedure.
  const laser = droneBuild({ grade: 'common', modules: ['micro-laser'], illegalMods: true });
  assert.match(laser.errors.join(' '), /bloqueo contra armas letales/);
  assert.deepEqual(droneBuild({ grade: 'common', modules: ['micro-laser'], illegalMods: true, weaponUnlocked: true }).errors, []);
  assert.deepEqual(droneBuild({ grade: 'common', modules: ['stun-dart'] }).errors, [], 'non-lethal systems are legal on a Common drone');
  assert.match(droneBuild({ grade: 'common', modules: ['armor-booster'], illegalMods: true }).errors.join(' '), /Military o Experimental/);
});

test('a build becomes a token: frame resources, modules as equipment and weapons that never scale with Proficiency', () => {
  const data = droneTokenData(droneBuild({ grade: 'military', modules: ['stun-dart', 'hardened-link'] }), { operatorId: 'tok_pilot' });
  assert.deepEqual([data.actorType, data.isPlayer, data.hp.max, data.hp.majorThreshold, data.armor.max, data.stress.max], ['drone', false, 3, 7, 1, 0]);
  assert.deepEqual(data.inventory.weapons.map(w => [w.name, w.damage, w.damageMode, w.range]), [['Stun Dart', '1d6 phys', 'final', 'Far']]);
  assert.deepEqual(data.inventory.items.map(i => i.name), ['Stun Dart', 'Hardened Link']);
  assert.equal(validateDroneState(data.drone).operatorId, 'tok_pilot');
  // A refit keeps the damage already taken.
  const refit = droneTokenData(droneBuild({ grade: 'military', modules: ['armor-plating'] }), { previous: { hp: { current: 1 }, armor: { current: 0 }, drone: { offline: [] } } });
  assert.deepEqual([refit.hp.current, refit.hp.max, refit.armor.current, refit.armor.max], [1, 3, 0, 2]);
  assert.throws(() => validateDroneState({ grade: 'common', modules: ['x'] }), /inválida/);
  assert.throws(() => validateDroneState({ grade: 'common', modules: [], signal: 'great' }), /inválida/);
});

test('signal rules: Unstable gives Disadvantage on a complex command, Lost stops commands and costs 2 Evasion', () => {
  const drone = signal => ({ actorType: 'drone', evasion: 11, drone: { grade: 'military', modules: [], signal } });
  assert.deepEqual([droneEvasion(drone('stable')), droneEvasion(drone('unstable')), droneEvasion(drone('lost'))], [11, 11, 9]);
  assert.equal(droneEvasion({ actorType: 'adversary', evasion: 13 }), 13);
  assert.deepEqual([droneCommand(drone('stable')).disadvantage, droneCommand(drone('unstable')).disadvantage, droneCommand(drone('lost')).allowed], [false, true, false]);
  const hardened = { ...drone('unstable'), drone: { grade: 'military', modules: ['hardened-link'], signal: 'unstable' } };
  assert.equal(droneCommand(hardened).disadvantage, false, 'Hardened Link treats Unstable as Stable for complex commands');
  hardened.drone.offline = ['hardened-link'];
  assert.equal(droneCommand(hardened).disadvantage, true, 'unless the module is offline');
  assert.deepEqual([worsenSignal('stable'), worsenSignal('unstable'), worsenSignal('lost')], ['unstable', 'lost', 'lost']);
  assert.deepEqual(rollDroneComplication(() => 0.55), { roll: 7, text: 'El dron pierde 1 HP directo.' });
});
