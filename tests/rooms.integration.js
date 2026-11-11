// Run against the local Firestore emulator: npm run test:rooms.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as dbAPI from 'firebase/firestore';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', 'HTMLElement']) globalThis[key] = dom.window[key];
const { store } = await import('../src/state.js'); await store.ready;
const { NetworkManager } = await import('../src/networkManager.js');
const { RoomService, splitRoomData, ROOM_PART_SIZE } = await import('../src/roomService.js');
const { RoomController, activeRoomKey } = await import('../src/roomController.js');
const { RoomWire, createRoomWire } = await import('../src/roomWire.js');
const controllers = [], wireHandles = [];
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-veilfarers-vtt', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  await env.clearFirestore();
});
after(async () => {
  for (const controller of controllers.reverse()) { await controller.leave({ save: false }); controller.unsubscribeStore(); clearTimeout(controller.saveTimer); }
  for (const wire of wireHandles) wire.close();
  await env?.cleanup(); dom.window.close();
});
async function service(uid) {
  const cloudAccount = { user: { uid, displayName: 'Pilot' }, dbAPI, db: env.authenticatedContext(uid).firestore(), restoreSession: async () => {}, init: async () => {} };
  return new RoomService({ cloudAccount }).ready();
}
async function controller(uid) {
  const stateStore = new store.constructor(); await stateStore.ready;
  const n = new NetworkManager({ stateStore });
  const c = new RoomController({ service: await service(uid), stateStore, networkManager: n }); controllers.push(c); return c;
}
async function until(predicate, message = 'condition', timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await new Promise(r => setTimeout(r, 30)); }
  throw new Error('Timed out: ' + message);
}
const campaign = name => ({ ...store.serializeCampaign(), campaignId: crypto.randomUUID(), campaignName: name });

test('rooms belong to accounts; invitation rotation preserves members and kicks cannot be undone by a guest', async () => {
  const keeper = await service('keeper'), player = await service('player'), other = await service('other');
  const room = await keeper.create('Persistent campaign', campaign('Persistent campaign'));
  await assertFails(other.getRoom(room.id));
  await assertFails(dbAPI.getDocs(other.col('rooms')));
  await assertFails(dbAPI.getDocs(other.col('roomInvites')));
  await player.join(room.inviteCode, 'Same name');
  assert.equal((await player.list())[0].id, room.id);
  const freshCode = await keeper.rotateInvitation(room.id);
  assert.notEqual(freshCode, room.inviteCode);
  await assert.rejects(other.join(room.inviteCode), /regenerada/);
  assert.equal((await player.getRoom(room.id)).id, room.id, 'membership is independent from the old code');
  await other.join(freshCode, 'Same name');
  const members = await dbAPI.getDocs(keeper.col('rooms', room.id, 'members'));
  assert.deepEqual(members.docs.map(d => d.id).sort(), ['other', 'player'], 'same names never share a seat');
  await assertFails(player.setMemberStatus(room.id, 'other', 'revoked'));
  await assertFails(dbAPI.updateDoc(player.ref('rooms', room.id), { ownerUid: 'player' }));
  await assertFails(dbAPI.getDocs(player.col('rooms', room.id, 'chunks')));
  await assertFails(dbAPI.getDocs(player.col('rooms', room.id, 'saves')));
  await keeper.setMemberStatus(room.id, 'player', 'revoked');
  await assertFails(player.getRoom(room.id));
  await assert.rejects(player.join(freshCode), /expulsado/);
  await assertFails(dbAPI.updateDoc(player.ref('rooms', room.id, 'members', 'player'), { status: 'active' }));
  await assertFails(dbAPI.deleteDoc(player.ref('rooms', room.id, 'members', 'player')));
  assert.equal((await player.list()).length, 0);
  await keeper.setMemberStatus(room.id, 'player', 'active');
  assert.equal((await player.list())[0].id, room.id);
  const own = await player.create('My other table', campaign('My other table'));
  assert.deepEqual(new Set((await player.list()).map(r => r.id)), new Set([room.id, own.id]));
  const anonymous = env.unauthenticatedContext().firestore();
  await assertFails(dbAPI.getDoc(dbAPI.doc(anonymous, 'roomInvites', freshCode)));
});

test('server rules freeze expired/offline rooms, fence old connections and protect private mailboxes', async () => {
  const keeper = await service('lease-keeper'), player = await service('lease-player'), spy = await service('lease-spy');
  let room = await keeper.create('Leases', campaign('Leases'));
  await player.join(room.inviteCode); await spy.join(room.inviteCode);
  await assertFails(createRoomWire(player, room, 'Player'));
  const epoch = crypto.randomUUID(); await keeper.acquire(room.id, epoch); room = await keeper.getRoom(room.id);
  await assert.rejects(keeper.acquire(room.id, crypto.randomUUID()), /otra ventana/);
  const wireId = await createRoomWire(player, room, 'Player');
  const part = { seq: 1, part: 0, total: 1, text: '{}' };
  await assertSucceeds(dbAPI.setDoc(player.ref('rooms', room.id, 'wires', wireId, 'up', '1_0'), part));
  await assertFails(dbAPI.setDoc(player.ref('rooms', room.id, 'wires', wireId, 'down', '1_0'), part));
  await assertFails(dbAPI.getDocs(spy.col('rooms', room.id, 'wires', wireId, 'down')));
  await assertFails(dbAPI.updateDoc(player.ref('rooms', room.id, 'wires', wireId), { uid: 'lease-spy' }));
  await env.withSecurityRulesDisabled(async ctx => { await dbAPI.updateDoc(dbAPI.doc(ctx.firestore(), 'rooms', room.id), { hostSeenAt: dbAPI.Timestamp.fromMillis(keeper.now() - 30000) }); });
  await assertFails(dbAPI.setDoc(player.ref('rooms', room.id, 'wires', wireId, 'up', '2_0'), { ...part, seq: 2 }));
  const next = crypto.randomUUID(); await keeper.acquire(room.id, next);
  await assertFails(dbAPI.setDoc(player.ref('rooms', room.id, 'wires', wireId, 'up', '3_0'), { ...part, seq: 3 }));
  await keeper.release(room.id, epoch);
  assert.equal((await keeper.getRoom(room.id)).hostEpoch, next, 'stale tab cannot release the current lease');
  await keeper.release(room.id, next);
  assert.equal((await player.getRoom(room.id)).hostEpoch, '', 'offline member still has access');
});

test('large campaigns and ordered wire fragments round-trip without truncation or Unicode corruption', async () => {
  const keeper = await service('large-keeper'), player = await service('large-player');
  const data = campaign('Large campaign'); data.maps[0].imageUrl = 'data:image/png;base64,' + 'x'.repeat(1100000);
  data.arcs[0].description = '✨😀'.repeat(70000);
  const room = await keeper.create(data.campaignName, data);
  const loaded = await keeper.loadCampaign(await keeper.getRoom(room.id));
  assert.deepEqual(loaded, data);
  const countBefore = (await dbAPI.getDocs(keeper.col('rooms', room.id, 'chunks'))).size;
  data.tokens[0].x += 10; await keeper.saveCampaign(room.id, data, '');
  const countAfter = (await dbAPI.getDocs(keeper.col('rooms', room.id, 'chunks'))).size;
  assert.ok(countAfter - countBefore <= 2, 'movement reuses immutable image chunks');
  assert.deepEqual(await keeper.loadCampaign(await keeper.getRoom(room.id)), data);
  const text = { value: 'x'.repeat(ROOM_PART_SIZE - 11) + '😀😀' + 'z'.repeat(ROOM_PART_SIZE) };
  assert.deepEqual(JSON.parse(splitRoomData(text).join('')), text);
  assert.ok(splitRoomData(text).every(part => !/[\uD800-\uDBFF]$/.test(part)));
  await player.join(room.inviteCode); const epoch = crypto.randomUUID(); await keeper.acquire(room.id, epoch);
  const live = await keeper.getRoom(room.id), wireId = await createRoomWire(player, live, 'Pilot'), received = [];
  const receiving = new RoomWire(keeper, room.id, wireId, 'keeper', { onData: d => received.push(d), onClose: e => { throw e; } }); wireHandles.push(receiving);
  // Deliver sequence 2 before sequence 1 and fragments in reverse order.
  for (const [seq, value] of [[2, { value: 'second' }], [1, text]]) {
    const parts = splitRoomData(value);
    for (let i = parts.length - 1; i >= 0; i--) await dbAPI.setDoc(player.ref('rooms', room.id, 'wires', wireId, 'up', `${seq}_${i}`), { seq, part: i, total: parts.length, text: parts[i] });
  }
  await until(() => received.length === 2, 'ordered fragments');
  assert.deepEqual(received, [text, { value: 'second' }]); receiving.close();
});

test('actual Keeper/player controllers preserve movement, assignments, arcs and scenes across disconnects', async () => {
  const keeper = await controller('game-keeper'), player = await controller('game-player');
  const room = await keeper.create('Persistent play');
  await until(() => keeper.store.state.isConnected, 'Keeper lease');
  const hiddenId = keeper.store.state.tokens.find(t => !t.isPlayer)?.id;
  if (hiddenId) keeper.store.updateToken(hiddenId, { hidden: true });
  keeper.store.addLog({ type: 'ROLL', title: 'Keeper secret', details: 'secret result', visibility: 'keeper' });
  await player.join(room.inviteCode);
  await until(() => player.store.state.isConnected, 'initial guest snapshot');
  assert.equal(player.store.state.logs.some(log => log.visibility === 'keeper'), false);
  if (hiddenId) assert.equal(player.store.state.tokens.some(t => t.id === hiddenId), false);
  // A real transport outage must pause the replica and recover without a new invitation.
  await dbAPI.disableNetwork(player.service.db);
  await until(() => !player.store.state.isConnected && player.store.state.roomPaused, 'guest network outage');
  await dbAPI.enableNetwork(player.service.db);
  await until(() => player.store.state.isConnected, 'guest network recovery');
  const token = keeper.store.state.tokens.find(t => t.isPlayer);
  keeper.store.getActiveMap().walls = [];
  keeper.network.assignToken('game-player', token.id);
  await until(() => player.store.canEditToken(token.id), 'assignment');
  const x = token.x + 60, y = token.y + 30;
  player.store.updateToken(token.id, { x, y });
  await until(() => keeper.store.state.tokens.find(t => t.id === token.id).x === x, 'authoritative movement');
  await until(() => player.network.pendingTokenPatches.size === 0, 'durable acknowledgement');
  assert.equal(player.store.state.tokens.find(t => t.id === token.id).x, x);
  const stroke = await player.network.editDrawing('add', { mapId: player.store.state.activeMapId, drawing: { color: '#10b981', width: 5, points: [{ x: 20, y: 20 }, { x: 100, y: 80 }] } });
  await until(() => player.store.getActiveMap().drawings?.some(d => d.id === stroke.id), 'shared drawing');
  assert.equal(keeper.store.getActiveMap().drawings[0].authorId, 'game-player');
  const originalArcs = structuredClone(keeper.store.state.arcs), originalMaps = structuredClone(keeper.store.state.maps);
  // An abrupt Keeper connection loss expires the server lease; the same owner can return.
  await dbAPI.disableNetwork(keeper.service.db);
  await until(() => player.store.state.roomPaused && !player.store.state.isConnected, 'crashed Keeper lease expiry', 30000);
  assert.equal(player.store.canEditToken(token.id), false);
  await dbAPI.enableNetwork(keeper.service.db);
  await until(() => player.store.state.isConnected, 'Keeper network recovery');
  await keeper.leave();
  await until(() => player.store.state.roomPaused && !player.store.state.isConnected, 'offline pause');
  assert.equal(player.room.id, room.id);
  assert.equal(player.store.sessionRole, 'player');
  assert.equal(player.store.canEditToken(token.id), false);
  assert.equal(player.store.updateToken(token.id, { x: 999 }), false);
  assert.equal(player.store.state.tokens.find(t => t.id === token.id).x, x);
  const resumed = await controller('game-keeper');
  await resumed.enter(room.id);
  await until(() => player.store.state.isConnected, 'automatic guest resume');
  assert.equal(resumed.store.state.tokens.find(t => t.id === token.id).x, x);
  assert.deepEqual(resumed.store.state.arcs, originalArcs);
  assert.deepEqual(resumed.store.state.maps, originalMaps);
  assert.equal(player.store.state.tokens.find(t => t.id === token.id).x, x);
  await player.leave();
  const returned = await controller('game-player');
  localStorage.setItem(activeRoomKey('game-player'), room.id);
  await returned.restore();
  await until(() => returned.store.state.isConnected, 'direct re-entry without invitation');
  assert.equal(returned.store.memberId, 'game-player');
  assert.equal(returned.store.canEditToken(token.id), true);
  const secondTab = await controller('game-player'); await secondTab.enter(room.id);
  await until(() => secondTab.store.state.isConnected, 'second tab');
  assert.equal(resumed.store.state.connectedPeers.filter(p => p.id === 'game-player').length, 1);
  await resumed.rotate();
  assert.equal(returned.store.state.isConnected, true);
  await resumed.kick('game-player');
  await until(() => !returned.room && !secondTab.room, 'revoked connections leave');
  await until(() => !resumed.store.state.tokens.find(t => t.id === token.id).ownerId, 'revoked token ownership');
  await resumed.leave();
});
