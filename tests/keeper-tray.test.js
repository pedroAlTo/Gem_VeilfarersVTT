import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingDecisions, decisionStatus } from '../src/keeperTray.js';

const state = {
  activeMapId: 'm1',
  tokens: [{ id: 'pc', name: 'Harker', isPlayer: true }, { id: 'npc', name: 'Raider', isPlayer: false }, { id: 'pc2', name: 'Vale', isPlayer: true }],
  logs: [
    { resolution: { id: 'r1', name: 'Blinding Flash', actorId: 'pc', mapId: 'm1', phase: 'ready', replies: [{ id: 'a', actorId: 'npc', traitId: 'instinct', dc: 10 }, { id: 'b', actorId: 'pc2', traitId: 'instinct', dc: 10, outcome: 'Fallo' }] } },
    { resolution: { id: 'r2', name: 'Stellar Lance', actorId: 'pc', mapId: 'm1', phase: 'roll', replies: [] } },
    { resolution: { id: 'r3', name: 'Spark of Hope', actorId: 'pc', mapId: 'm1', phase: 'ready' } },
    { resolution: { id: 'r4', name: 'Old', actorId: 'pc', mapId: 'm1', phase: 'done' } },
    { resolution: { id: 'r5', name: 'Elsewhere', actorId: 'pc', mapId: 'm2', phase: 'ready' } },
    { title: 'plain log' },
  ],
};

test('the Keeper tray lists the open plays of the active scene with what they wait for', () => {
  const items = pendingDecisions(state);
  assert.deepEqual(items.map(i => i.id), ['r1', 'r2', 'r3']);
  assert.equal(items[0].adversaries.length, 1);
  assert.equal(items[0].players, 0);
  assert.equal(decisionStatus(items[0]), '1 adversario(s) por tirar');
  assert.equal(decisionStatus(items[1]), 'Esperando la tirada de Harker');
  assert.equal(decisionStatus(items[2]), 'Lista para que decidas');
});
