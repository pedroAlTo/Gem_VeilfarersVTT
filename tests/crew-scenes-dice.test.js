import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { JSDOM } from 'jsdom';
import { Vector3, Quaternion } from 'three';
import { d12Model, faceNumbers, topFace, simulateThrow, createDiceSimulation, seededRandom, prepareThrow, TRAY_RAILS } from '../src/dicePhysics.js';
import { controlsToken, assignControls, movePartyToScene } from '../src/tokenPermissions.js';
import { createActor } from '../src/actors.js';
import { CloudAccount, portableCharacter, cleanPreferences } from '../src/cloudAccount.js';
const dom = new JSDOM('<body></body>', { url: 'http://localhost' });
for (const k of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[k] = dom.window[k];
const { store } = await import('../src/state.js'); await store.ready;
const { NetworkManager } = await import('../src/networkManager.js');
const { parseInvitation } = await import('../src/sessionLobby.js');
const original = structuredClone(store.state);
beforeEach(async () => { await store.saveQueue.catch(() => {}); store.state = structuredClone(original); store.listeners.clear(); store.sessionRole = 'local'; store.remoteApplying = false; store.memberId = null; store.peerId = null; store.sessionBusy = false; document.body.replaceChildren(); });
after(async () => { await store.saveQueue.catch(() => {}); dom.window.close(); });
const pc = (name = 'Pilot') => createActor({ name }, store.state.activeMapId);
const drone = () => createActor({ name: 'Scout', actorType: 'drone', controllerIds: ['a', 'b'] }, store.state.activeMapId);

test('assignment moves a player slot atomically; drones stay shared', () => {
  const a = { ...pc(), ownerId: 'a' }, b = pc('Other'), d = drone();
  const next = assignControls([a, b, d], b.id, ['a'], ['a', 'b']);
  assert.equal(next[0].ownerId, ''); assert.equal(next[1].ownerId, 'a'); assert.deepEqual(next[2].controllerIds, ['a', 'b']);
  assert.throws(() => assignControls([a, b], 'missing', ['a'], ['a'])); assert.equal(a.ownerId, 'a');
  assert.throws(() => assignControls([a, b], b.id, ['a', 'b'], ['a', 'b']));
  assert.throws(() => assignControls([a], a.id, ['stranger'], ['a']));
});
test('NPCs can be assigned and shared drone controllers can act, strangers and hidden tokens cannot', () => {
  const npc = createActor({ actorType: 'npc', ownerId: 'a' }, 'm'), d = drone();
  assert.ok(!controlsToken({ ...npc, ownerId: 'keeper' }, 'keeper')); assert.ok(controlsToken(npc, 'a')); assert.ok(controlsToken(d, 'a')); assert.ok(controlsToken(d, 'b'));
  assert.ok(!controlsToken(d, 'c')); assert.ok(!controlsToken({ ...d, hidden: true }, 'a'));
});
test('scene changes move party and shared drones but preserve encounter enemies, resources and controllers', () => {
  const a = { ...pc(), x: 351, y: 289, ownerId: 'a' }, d = drone(), enemy = createActor({ actorType: 'adversary', ownerId: 'keeper' }, a.mapId);
  const target = { id: 'new', width: 500, height: 500, gridSize: 50 };
  const moved = movePartyToScene([a, d, enemy], target);
  assert.equal(moved[0].mapId, 'new'); assert.equal(moved[1].mapId, 'new'); assert.equal(moved[2].mapId, a.mapId);
  assert.deepEqual(moved[0].hp, a.hp); assert.equal(moved[0].ownerId, 'a'); assert.deepEqual(moved[1].controllerIds, d.controllerIds);
  const returned = movePartyToScene(moved, { id: a.mapId, width: 2000, height: 2000, gridSize: 64 });
  assert.equal(returned[0].x, 351); assert.equal(returned[0].y, 289);
});
test('creating a scene transfers existing characters; guest cannot change or create scenes', () => {
  const originalToken = store.state.tokens.find(t => t.isPlayer);
  const scene = store.addMap({ name: 'New sector', imageUrl: '/blank', gridSize: 70 });
  assert.equal(store.state.tokens.find(t => t.id === originalToken.id).mapId, scene.id);
  store.sessionRole = 'player'; const before = store.serializeCampaign();
  assert.equal(store.switchScene(original.activeMapId), false); assert.equal(store.addMap({ name: 'No' }), null); assert.deepEqual(store.serializeCampaign().maps, before.maps);
});
test('player imports replace their own sheet, retain token identity and never acquire other ownership', () => {
  store.state.isHosting = true; store.sessionRole = 'host'; const n = new NetworkManager();
  const existing = { ...pc(), ownerId: 'a', x: 444 }; store.state.tokens = [existing];
  n.acceptCharacter({ ...pc('Updated'), ownerId: 'b', controllerIds: ['b'], hidden: true }, 'a');
  assert.equal(store.state.tokens.length, 1); assert.equal(store.state.tokens[0].id, existing.id); assert.equal(store.state.tokens[0].x, 444); assert.equal(store.state.tokens[0].ownerId, 'a'); assert.equal(store.state.tokens[0].name, 'Updated');
  assert.throws(() => n.acceptCharacter({ ...pc(), hp: { current: 100, max: 1 } }, 'a')); assert.equal(store.state.tokens[0].name, 'Updated'); n.disconnect();
});
test('host rejects drone movement from strangers but accepts both controllers', async () => {
  const n = new NetworkManager(); n.room = 'room'; store.state.isHosting = true; store.sessionRole = 'host'; const d = drone(); store.state.tokens = [d];
  for (const id of ['a', 'b', 'c']) n.members.set(id, { id, name: id });
  for (const [sender, x] of [['a', 100], ['b', 200], ['c', 300]]) await n.handleIncomingMessage({ room: 'room', messageId: sender, type: 'TOKEN_MOVE', tokenId: d.id, x, y: 0 }, sender);
  assert.equal(store.state.tokens[0].x, 200); n.disconnect();
});
test('invitation parser accepts a complete code or link, rejects room-only and malformed secrets', () => {
  const secret = '12345678-1234-4321-8123-123456789012';
  assert.deepEqual(parseInvitation(`VEIL-ABC.${secret}`), { room: 'VEIL-ABC', invite: secret });
  assert.deepEqual(parseInvitation(`https://vtt.example/?room=VEIL-ABC#invite=${secret}`), { room: 'VEIL-ABC', invite: secret });
  assert.throws(() => parseInvitation('VEIL-ABC')); assert.throws(() => parseInvitation('VEIL-ABC.short'));
});
test('reconnection restores the same roster identity and token control', () => {
  const n = new NetworkManager(); n.room = 'room'; n.invite = 'invite'; store.state.isHosting = true; store.sessionRole = 'host';
  const conn = peer => { const c = new EventEmitter(); c.peer = peer; c.open = true; c.send = () => {}; c.close = () => c.emit('close'); return c; };
  const hello = { type: 'HELLO', room: 'room', invite: 'invite', resume: 'a'.repeat(32), playerName: 'Pilot' };
  const first = conn('first'); n.setupConnection(first); first.emit('data', hello); const memberId = n.members.get('first').id;
  const token = { ...pc(), ownerId: memberId }; store.state.tokens = [token]; first.close();
  assert.equal(store.state.players.length, 1); assert.equal(store.state.connectedPeers.length, 0);
  const next = conn('next'); n.setupConnection(next); next.emit('data', hello);
  assert.equal(n.members.get('next').id, memberId); assert.equal(n.snapshotFor('next').claimedTokenId, token.id); n.disconnect();
});
test('connection failure restores local campaign and ends player mode', async () => {
  let peer; const n = new NetworkManager({ peerFactory: () => { peer = new EventEmitter(); peer.destroy = () => {}; return peer; } });
  const before = store.state.campaignId, joining = n.joinSession('room', 'Pilot', 'valid-invite');
  await new Promise(resolve => setTimeout(resolve, 10)); peer.emit('error', new Error('Unavailable'));
  await assert.rejects(joining, /Session closed|Unavailable/); assert.equal(store.sessionRole, 'local'); assert.equal(store.state.campaignId, before); assert.equal(store.state.isConnected, false); assert.equal(n.room, '');
});
test('portable characters omit tactical permissions and preferences cannot promote a player', () => {
  const t = portableCharacter({ ...pc(), ownerId: 'gm', controllerIds: ['a'], hidden: true, scenePositions: { m: { x: 0, y: 0 } } });
  for (const key of ['ownerId', 'controllerIds', 'hidden', 'scenePositions', 'id']) assert.ok(!(key in t));
  const prefs = cleanPreferences({ userRole: 'keeper', userName: 'Pilot', diceTheme: 'invalid', dice3d: true });
  assert.ok(!('userRole' in prefs)); assert.equal(prefs.diceTheme, 'crystal');
});
test('cloud character save uses the authenticated UID and keeps a versioned portable sheet', async () => {
  const c = new CloudAccount(); c.identity = async () => 'uid-a'; let saved;
  c.dbAPI = { doc: (...args) => args.slice(1).join('/'), setDoc: async (path, data) => { saved = { path, data }; } };
  await c.saveCharacter({ ...pc(), ownerId: 'a' });
  assert.match(saved.path, /^users\/uid-a\/characters\//); assert.equal(c.decodeCharacter(saved.data).name, 'Pilot'); assert.ok(!('ownerId' in JSON.parse(saved.data.payload).token));
});
test('cloud library rejects stale reads after the signed-in account changes', async () => {
  const c = new CloudAccount(); c.identity = async () => 'a';
  c.dbAPI = { collection: () => 'path', getDocsFromServer: async () => { c.epoch++; return { docs: [] }; } };
  await assert.rejects(c.list('characters'), /Account changed/);
});
test('failed scene metadata save cleans up uploaded image and never reports success', async () => {
  const c = new CloudAccount(); c.user = { uid: 'a' }; c.identity = async () => 'a'; let deleted = false, progress;
  c.storageAPI = { ref: (_, path) => path, uploadBytesResumable: () => ({ on: (_, report, fail, done) => { report({ bytesTransferred: 5, totalBytes: 10 }); done(); }, cancel: () => {} }), getDownloadURL: async () => 'https://image', deleteObject: async () => { deleted = true; } };
  c.dbAPI = { doc: () => 'path', setDoc: async () => { throw new Error('Denied'); } };
  await assert.rejects(c.uploadScene({ type: 'image/png', size: 10 }, { name: 'Sector' }, n => { progress = n; }), /Denied/);
  assert.equal(deleted, true); assert.equal(progress, 50); assert.equal(c.cancelUpload, null);
});
test('d12 model has twelve outward-facing pentagons and every result maps to its top face', () => {
  const model = d12Model(); assert.equal(model.vertices.length, 20); assert.equal(model.faces.length, 12);
  for (const face of model.faces) { assert.equal(face.indices.length, 5); assert.ok(face.normal.dot(face.center) > 0); }
  for (let face = 0; face < 12; face++) for (let value = 1; value <= 12; value++) { const numbers = faceNumbers(face, value); assert.equal(numbers[face], value); assert.equal(new Set(numbers).size, 12); assert.ok(numbers.every(x => x >= 1 && x <= 12)); }
});
test('physical throws settle above the mat, inside rails, with a flat numbered face up', () => {
  const model = d12Model();
  for (let seed = 1; seed <= 12; seed++) {
    let n = seed; const frames = simulateThrow(model, () => ((n = (1664525 * n + 1013904223) >>> 0) / 4294967296));
    assert.ok(frames.length > 100 && frames.length <= 1200);
    for (const frame of frames.at(-1)) {
      const [x, y, z] = frame.position; assert.ok(Math.abs(x) < 7 && Math.abs(z) < 4); assert.ok(y > .7 && y < 1);
      const face = model.faces[topFace(model, frame.quaternion)], q = new Quaternion(...frame.quaternion);
      assert.ok(face.normal.clone().applyQuaternion(q).dot(new Vector3(0, 1, 0)) > .99);
    }
  }
});

test('two clients complete host/join, token assignment, scene sync, submission and leave over the message protocol', async () => {
  const peers = new Map(); let serial = 0;
  const factory = value => {
    const peer = new EventEmitter(); peer.id = typeof value === 'string' ? value : `client-${++serial}`; peer.links = [];
    peers.set(peer.id, peer);
    peer.destroy = () => { peers.delete(peer.id); peer.links.forEach(c => c.close()); };
    peer.connect = target => {
      const host = peers.get(target); if (!host) throw new Error('Unknown host');
      const outgoing = new EventEmitter(), incoming = new EventEmitter();
      outgoing.peer = target; incoming.peer = peer.id;
      outgoing.close = incoming.close = () => { if (!outgoing.open) return; outgoing.open = incoming.open = false; outgoing.emit('close'); incoming.emit('close'); };
      outgoing.send = data => queueMicrotask(() => incoming.emit('data', structuredClone(data)));
      incoming.send = data => queueMicrotask(() => outgoing.emit('data', structuredClone(data)));
      peer.links.push(outgoing); host.links.push(incoming);
      queueMicrotask(() => { host.emit('connection', incoming); outgoing.open = incoming.open = true; outgoing.emit('open'); incoming.emit('open'); });
      return outgoing;
    };
    queueMicrotask(() => peer.emit('open', peer.id)); return peer;
  };
  const hostStore = new store.constructor(), guestStore = new store.constructor(); await Promise.all([hostStore.ready, guestStore.ready]);
  hostStore.state = structuredClone(original); guestStore.state = structuredClone(original);
  hostStore.state.campaignName = 'Host game'; guestStore.state.campaignName = 'Local backup';
  const host = new NetworkManager({ stateStore: hostStore, peerFactory: factory }), guest = new NetworkManager({ stateStore: guestStore, peerFactory: factory });
  await host.hostSession('TEST-ROOM'); await guest.joinSession(host.room, 'Navigator', host.invite);
  assert.equal(guestStore.state.campaignName, 'Host game'); assert.equal(guestStore.sessionRole, 'player'); assert.equal(hostStore.state.players.length, 1);
  const playerId = hostStore.state.players[0].id, token = hostStore.state.tokens.find(t => t.isPlayer);
  host.assignToken(playerId, token.id); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(guestStore.state.claimedTokenId, token.id); assert.ok(guestStore.canEditToken(token.id));
  const scene = hostStore.addMap({ name: 'Other sector', imageUrl: '/blank', gridSize: 70 }); host.syncAll(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(guestStore.state.activeMapId, scene.id); assert.equal(guestStore.state.tokens.find(t => t.id === token.id).mapId, scene.id);
  const result = await guest.importCharacter(pc('Imported pilot')); assert.equal(result.tokenId, token.id); assert.equal(hostStore.state.tokens.find(t => t.id === token.id).name, 'Imported pilot');
  guest.disconnect(); assert.equal(guestStore.state.campaignName, 'Local backup'); assert.equal(guestStore.sessionRole, 'local'); host.disconnect();
  await Promise.all([hostStore.saveQueue, guestStore.saveQueue]);
});

test('live rigid-body worlds reproduce authoritative face labels without replaying recorded frames', () => {
  const model = d12Model();
  for (const [seed, values] of [[1, [1, 12]], [9, [12, 1]], [71, [7, 7]], [9173, [4, 11]]]) {
    const plan = prepareThrow(model, values, seed), live = createDiceSimulation(model, seededRandom(seed));
    while (!live.settled && live.steps < 1200) live.step();
    assert.ok(live.settled); assert.equal(live.steps, plan.steps); assert.deepEqual(live.snapshot(), plan.final);
    live.snapshot().forEach((body, i) => assert.equal(plan.numbers[i][topFace(model, body.quaternion)], values[i]));
    const end = live.snapshot(); live.step(); assert.deepEqual(live.snapshot(), end);
  }
});
test('physics and Three.js share rail dimensions, gravity and solid convex die colliders', () => {
  const simulation = createDiceSimulation(d12Model(), seededRandom(42));
  assert.ok(simulation.world.gravity.y < 0);
  assert.equal(simulation.bodies.length, 2);
  for (const die of simulation.bodies) { assert.ok(die.mass > 0); assert.equal(die.shapes[0].faces.length, 12); }
  TRAY_RAILS.forEach((rail, i) => {
    const body = simulation.world.bodies[i + 1]; assert.equal(body.mass, 0);
    assert.deepEqual(body.position.toArray(), rail.position);
    assert.deepEqual(body.shapes[0].halfExtents.toArray(), rail.size.map(n => n / 2));
  });
});
