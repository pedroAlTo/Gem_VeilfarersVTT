// Plan de UX V3, fase 2 (v2.47.0): act in fewer clicks. Lucky Break rerolls the lower die in
// Básico; the action ring offers each weapon (and why it does not reach) against a touched enemy.
import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) };
const { tableMode, isAdvanced, setTableMode, luckyBreakDie } = await import('../src/tableMode.js');
const { ringOptions } = await import('../src/actionRing.js');

test('Básico by default; Lucky Break rerolls the lower die (Fear on a tie)', () => {
  assert.equal(tableMode(), 'basic'); assert.equal(isAdvanced(), false);
  assert.equal(luckyBreakDie({ hopeVal: 3, fearVal: 9 }), 'hope');
  assert.equal(luckyBreakDie({ hopeVal: 10, fearVal: 2 }), 'fear');
  assert.equal(luckyBreakDie({ hopeVal: 5, fearVal: 5 }), 'fear');
  setTableMode('advanced'); assert.equal(isAdvanced(), true);
  setTableMode('anything'); assert.equal(tableMode(), 'basic');
});

test('the action ring: each weapon in hand against the touched enemy, with why it does not reach', () => {
  const map = { gridSize: 64, gridScaleMeters: 2, walls: [] };
  const w = (id, range, extra = {}) => ({ id, name: id, damage: 'd8', range, tags: [], ...extra });
  const actor = { id: 'pc', isPlayer: true, x: 64, y: 64, size: 1, mapId: 'm', inventory: { weapons: [w('knife', 'Melee'), w('pistol', 'Close'), w('rifle', 'Far', { equipped: false }), w('railgun', 'Far', { tags: ['reload'], spent: true })], items: [] } };
  const foe = { id: 'foe', isPlayer: false, actorType: 'adversary', x: 64 * 6, y: 64, size: 1, mapId: 'm' };
  const options = ringOptions(actor, foe, map, [{ id: 'c1', name: 'Stellar Lance' }]);
  assert.deepEqual(options.map(o => [o.kind, o.id, o.ok]), [['weapon', 'knife', false], ['weapon', 'pistol', true], ['weapon', 'railgun', false], ['card', 'c1', true]], 'the holstered rifle is not offered');
  assert.match(options[0].why, /Melee/); assert.match(options[2].why, /Reload/);
  // Unarmed is a Melee attack; an ally opens no ring.
  assert.deepEqual(ringOptions({ ...actor, inventory: { weapons: [], items: [] } }, { ...foe, x: 128 }, map).map(o => [o.name, o.ok]), [['Desarmado', true]]);
  assert.deepEqual(ringOptions(actor, { ...foe, isPlayer: true, actorType: 'player' }, map), []);
});
