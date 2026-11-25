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

test('Básico plays the cards that had a window with the usual choice (v2.48.0)', async () => {
  const { basicDefaults } = await import('../src/cardFlow.js');
  const token = { traits: { agility: 1, instinct: 3, strength: 2 }, effort: 2 };
  assert.deepEqual(basicDefaults({ name: 'Path to Nirvana', chooseTrait: true, cost: {} }, token).options, { trait: 'instinct' }, 'the best of Agility, Instinct, Strength');
  assert.equal(basicDefaults({ name: 'Drone Whisper', cost: {} }, token, { dc: '20' }).options.cardDC, 20, 'the table DC');
  assert.equal(basicDefaults({ name: 'System Jackknife', cost: {} }, token, { dc: '12' }).options.cardDC, 15, 'not one of its DCs: 15');
  assert.equal(basicDefaults({ name: 'Run It Down', kind: 'move', cost: { open: true, resolve: 1 } }, token).resolveSpent, 1, 'the minimum Resolve');
  assert.equal(basicDefaults({ name: 'Breaking Point', reverse: true, cost: {} }, token), null, 'Breaking Point keeps its place');
  assert.equal(basicDefaults({ name: 'Bear Down', kind: 'beardown', cost: {} }, token), null);
});
