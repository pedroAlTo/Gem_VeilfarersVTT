import test from 'node:test';
import assert from 'node:assert/strict';
import { newRest, chooseMoves, restComplete, restPending, resolveRest, restPatch, validRest, validMoves } from '../src/rest.js';

const pc = (id, extra = {}) => ({ id, name: id, mapId: 'm1', isPlayer: true, level: 1, path: 'Awakened', hope: 1, hp: { current: 2, max: 8 }, stress: { current: 4, max: 6 }, armor: { current: 0, max: 3 }, conditions: [], ...extra });

test('newRest: the party on the scene rests; enemies, drones and other scenes do not', () => {
  const tokens = [pc('a'), pc('b', { mapId: 'm2' }), { id: 'e', mapId: 'm1', isPlayer: false, actorType: 'adversary' }];
  const rest = newRest('short', tokens, 'm1', 'r1');
  assert.deepEqual(rest.participants, ['a']);
  assert.ok(validRest(rest));
  assert.throws(() => newRest('short', [], 'm1'), /No hay personajes/);
});

test('chooseMoves: two different moves of that rest; the rest is complete when all have chosen', () => {
  let rest = newRest('long', [pc('a'), pc('b')], 'm1', 'r1');
  assert.throws(() => chooseMoves(rest, 'a', ['recover', 'recover']), /dos movimientos distintos/);
  assert.throws(() => chooseMoves(rest, 'a', ['tend', 'recover']), /dos movimientos distintos/, 'a Short Rest move in a Long Rest');
  assert.throws(() => chooseMoves(rest, 'x', ['recover', 'prepare']), /no participa/);
  rest = chooseMoves(rest, 'a', ['recover', 'prepare']);
  assert.deepEqual(restPending(rest, [pc('a'), pc('b')]), ['b']);
  assert.ok(!restComplete(rest, [pc('a'), pc('b')]));
  rest = chooseMoves(rest, 'b', ['decompress', 'repairAll']);
  assert.ok(restComplete(rest, [pc('a'), pc('b')]));
  assert.ok(validRest(rest));
  assert.ok(!validMoves('short', ['tend']));
});

test('Short Rest: 1d4 + Tier on HP, Stress and Armor; Prepare +1 Hope or +1 Resolve', () => {
  const roll = () => 2; // 2 + Tier 1 = 3
  const { patch } = restPatch(pc('a'), 'short', ['tend', 'clear'], roll);
  assert.equal(patch.hp.current, 5); assert.equal(patch.stress.current, 1);
  const armor = restPatch(pc('a'), 'short', ['repair', 'prepare'], roll).patch;
  assert.equal(armor.armor.current, 3); assert.equal(armor.hope, 2);
  const sleeper = restPatch(pc('s', { path: 'Sleeping', resolve: { current: 0, max: 4, dieType: 'd4' } }), 'short', ['prepare', 'tend'], roll).patch;
  assert.equal(sleeper.resolve.current, 1); assert.equal(sleeper.hope, undefined, 'a Sleeping never gains Hope from Prepare');
  assert.equal(restPatch(pc('t', { level: 5 }), 'short', ['tend', 'clear'], roll).patch.hp.current, 6, 'Tier 2 adds 2');
});

test('Long Rest: full HP / Stress / Armor; Decompress ends Long Bruise; Prepare Hope to 2; Armor Piercing cuts end', () => {
  const hurt = pc('a', { hope: 0, conditions: ['Long Bruise', 'Poisoned'], armor: { current: 0, max: 1, cut: { long: 2, repairAll: 1, downtime: 0 } } });
  const { patch } = restPatch(hurt, 'long', ['decompress', 'repairAll']);
  assert.equal(patch.stress.current, 0);
  assert.deepEqual(patch.conditions, [], 'Long Bruise (Decompress) and Poisoned (a Long Rest) end');
  assert.deepEqual([patch.armor.max, patch.armor.current], [4, 4], 'Armor Piercing and Disintegrating cuts come back; all slots repaired');
  assert.equal(restPatch(hurt, 'long', ['recover', 'prepare']).patch.hope, 2);
  assert.equal(restPatch(pc('a', { hope: 5 }), 'long', ['recover', 'prepare']).patch.hope, 5, 'Prepare never lowers Hope');
  // An enemy on the scene gets its Armor Piercing cut back too.
  const enemy = { id: 'e', mapId: 'm1', isPlayer: false, armor: { current: 0, max: 1, cut: { long: 2, repairAll: 0, downtime: 1 } } };
  const rest = chooseMoves(newRest('long', [pc('a'), enemy], 'm1', 'r'), 'a', ['recover', 'decompress']);
  const { patches, lines } = resolveRest(rest, [pc('a'), enemy]);
  assert.equal(patches.get('e').armor.max, 3);
  assert.deepEqual(patches.get('e').armor.cut, { long: 0, repairAll: 0, downtime: 1 });
  assert.match(lines[0], /Recover \+ Decompress/);
});
