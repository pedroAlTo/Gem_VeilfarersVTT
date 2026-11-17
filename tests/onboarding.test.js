import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES, stepsFor, guideRole, readProgress, writeProgress, mark, settled, finished, stepsFromState, baselineOf } from '../src/onboarding.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const state = (extra = {}) => ({
  maps: [{ id: 'm1' }], activeMapId: 'm1', fear: 4, claimedTokenId: null,
  tokens: [
    { id: 'pc1', name: 'Kira', isPlayer: true, actorType: 'player', ownerId: '', x: 100, y: 100 },
    { id: 'adv1', name: 'Pirata', actorType: 'adversary', x: 300, y: 300 },
  ],
  ...extra,
});

test('the role follows the seat: a connected player or Player view is a player, anything else the Keeper', () => {
  assert.equal(guideRole('player', 'keeper'), 'player');
  assert.equal(guideRole('local', 'player'), 'player');
  assert.equal(guideRole('host', 'keeper'), 'keeper');
  assert.equal(guideRole('local', 'keeper'), 'keeper');
});

test('each role has its own steps, and the room step only exists with the cloud', () => {
  assert.deepEqual(stepsFor('player').map(s => s.id), ['character', 'sheet', 'move', 'roll', 'card', 'chat']);
  assert.ok(!stepsFor('keeper').some(s => s.id === 'room'));
  assert.equal(stepsFor('keeper', { cloud: true })[0].id, 'room');
  for (const step of [...GUIDES.player, ...GUIDES.keeper]) assert.ok(step.title && step.text && step.target.length, step.id);
});

test('progress survives a reload, tolerates bad data and a done step cannot be done twice', () => {
  const storage = memory();
  const progress = readProgress(storage);
  assert.equal(mark(progress, 'player', 'roll'), true);
  assert.equal(mark(progress, 'player', 'roll'), false);
  assert.equal(mark(progress, 'player', 'chat', 'skipped'), true);
  assert.equal(mark(progress, 'player', 'chat'), true, 'doing a skipped step counts it as done');
  writeProgress(progress, storage);
  const again = readProgress(storage);
  assert.deepEqual(again.player, { done: ['roll', 'chat'], skipped: [], closed: false });
  storage.setItem('veil_guide_v1', '{not json');
  assert.deepEqual(readProgress(storage).keeper, { done: [], skipped: [], closed: false });
  assert.ok(settled(again.player, 'roll'));
  assert.ok(!finished(again.player, stepsFor('player')));
});

test('a player gets their character and their move from the table state', () => {
  const start = state();
  const base = baselineOf(start);
  assert.deepEqual(stepsFromState('player', base, start, { seatId: 'u1' }), []);
  const assigned = state({ tokens: start.tokens.map(t => t.id === 'pc1' ? { ...t, ownerId: 'u1' } : t) });
  assert.deepEqual(stepsFromState('player', base, assigned, { seatId: 'u1' }), ['character']);
  const moved = state({ tokens: assigned.tokens.map(t => t.id === 'pc1' ? { ...t, x: 170 } : t) });
  assert.deepEqual(stepsFromState('player', base, moved, { seatId: 'u1' }), ['character', 'move']);
  // Someone else's character moving is not your move.
  const other = state({ tokens: start.tokens.map(t => t.id === 'pc1' ? { ...t, ownerId: 'u2', x: 999 } : t) });
  assert.deepEqual(stepsFromState('player', base, other, { seatId: 'u1' }), []);
});

test('a Keeper only gets credit for what they did after the guide started, not for the demo campaign', () => {
  const start = state();
  const base = baselineOf(start);
  assert.deepEqual(stepsFromState('keeper', base, start), []);
  const later = state({
    maps: [{ id: 'm1' }, { id: 'm2' }], fear: 3,
    tokens: [...start.tokens.map(t => t.id === 'pc1' ? { ...t, ownerId: 'u1' } : t), { id: 'adv2', actorType: 'adversary' }],
  });
  assert.deepEqual(stepsFromState('keeper', base, later, { keeperRoom: true }).sort(), ['adversary', 'assign', 'fear', 'room', 'scene']);
  assert.deepEqual(stepsFromState('keeper', base, state({ activeMapId: 'm9' })), ['scene'], 'activating another scene counts');
  assert.deepEqual(stepsFromState('keeper', base, state({ fear: 6 })), [], 'gaining Fear is not spending it');
});
