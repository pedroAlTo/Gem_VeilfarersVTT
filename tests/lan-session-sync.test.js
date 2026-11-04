import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { lanSessions } from '../scripts/lan-sessions.mjs';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
// Keep the native Event and EventTarget realm used by Node's WebSocket.
globalThis.window = Object.assign(new EventTarget(), { sessionStorage: dom.window.sessionStorage });
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
const { store } = await import('../src/state.js');
const { LanPeer } = await import('../src/lanPeer.js');
const { NetworkManager } = await import('../src/networkManager.js');
const { connectionDisplay } = await import('../src/runtimeMode.js');

async function until(predicate, message) {
  const deadline = Date.now() + 3000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 15));
  assert.ok(predicate(), message);
}

// The adapter only frames Vite's custom events. Both endpoints use the actual
// TCP/WebSocket connection, LAN relay, session protocol and campaign stores.
async function client(url) {
  const socket = new WebSocket(url, 'vite-hmr');
  const events = new EventEmitter();
  let gamePackets = 0;
  const received = [];
  socket.addEventListener('message', event => {
    const packet = JSON.parse(event.data);
    if (packet.type === 'custom') {
      if (packet.event === 'veil:lan' && packet.data.op === 'data') { gamePackets++; received.push(packet.data.data); }
      events.emit(packet.event, packet.data);
    }
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('WebSocket handshake timed out')); }, 3000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', e => { clearTimeout(timer); reject(new Error('WebSocket handshake failed: ' + e.message, { cause: e.error })); }, { once: true });
  });
  const transport = {
    on: (name, fn) => events.on(name, fn),
    off: (name, fn) => events.off(name, fn),
    send: (event, data) => socket.send(JSON.stringify({ type: 'custom', event, data })),
  };
  const state = new store.constructor();
  await state.ready;
  const manager = new NetworkManager({ stateStore: state, peerFactory: options => new LanPeer(transport, options, manager.invite) });
  return { state, manager, socket, received, packets: () => gamePackets };
}

test('LAN: token positions and public rolls synchronize, secret rolls never reach player sockets or reconnect snapshots', { timeout: 18000 }, async () => {
  await store.ready;
  const server = await createServer({
    configFile: false, envFile: false, plugins: [{ name: 'lan-test-mode', configResolved(config) {
      config.env.VITE_SESSION_TRANSPORT = 'lan';
      config.env.VITE_LOCAL_ONLY = '0';
    } }, lanSessions()], logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port: 0, watch: null },
  });
  const clients = [];
  try {
    await server.listen();
    const port = server.httpServer.address().port;
    const url = `ws://127.0.0.1:${port}/?token=${server.config.webSocketToken}`;
    for (let i = 0; i < 3; i++) clients.push(await client(url));
    const [keeper, pilot, stranger] = clients;
    const room = await keeper.manager.hostSession();
    assert.equal(connectionDisplay(keeper.state.state, 'host').detail, 'WAITING FOR PLAYERS');
    await assert.rejects(stranger.manager.joinSession(room, 'Denied', 'incorrect-invitation-for-this-test'), /No matching invitation/);
    assert.equal(keeper.state.state.connectedPeers.length, 0);
    await pilot.manager.joinSession(room, 'Pilot', keeper.manager.invite);
    assert.equal(pilot.state.state.joiningSession, false);
    assert.equal(connectionDisplay(pilot.state.state, 'player').detail, 'LINKED TO KEEPER');
    const tokenId = keeper.state.getTokensForActiveMap().find(token => token.isPlayer).id;
    keeper.manager.assignToken(keeper.state.state.connectedPeers[0].id, tokenId);
    await until(() => pilot.state.canEditToken(tokenId), 'assignment reaches player');
    const hidden = keeper.state.addToken({ name: 'SECRET_AMBUSH_SENTINEL', isPlayer: false, hidden: true });
    const options = { traitId: 'finesse', dc: 12, customMod: 0 };
    const secret = await keeper.manager.requestAction({ type: 'CHECK', actorId: hidden.id, visibility: 'keeper', options });
    assert.equal(secret.visibility, 'keeper');
    assert.ok(keeper.state.serializeCampaign().logs.some(entry => entry.visibility === 'keeper'));
    const count = keeper.state.state.logs.length;
    await assert.rejects(pilot.manager.requestAction({ type: 'CHECK', actorId: tokenId, visibility: 'keeper', options }), /not assigned/);
    assert.equal(keeper.state.state.logs.length, count);
    const publicRoll = await pilot.manager.requestAction({ type: 'CHECK', actorId: tokenId, options });
    await until(() => pilot.received.some(packet => packet.type === 'DICE_ROLL' && packet.result.id === publicRoll.id), 'public check reaches guest');
    await Promise.all(['Bleeding', 'Hidden'].map(name => pilot.manager.requestAction({ type:'CONDITION', actorId:tokenId, name, active:true })));
    await until(() => pilot.state.state.tokens.find(t => t.id === tokenId).conditions.includes('Hidden'), 'condition changes reach the player');
    for (const endpoint of [keeper, pilot]) {
      const token = endpoint.state.state.tokens.find(t => t.id === tokenId);
      assert.ok(token.conditions.includes('Hidden') && token.conditions.includes('Bleeding'), 'rapid independent toggles are merged by the Keeper');
      assert.equal(!!token.hidden, false, 'Hidden condition does not make the token private');
    }
    await assert.rejects(pilot.manager.requestAction({ type:'CONDITION', actorId:hidden.id, name:'Stunned', active:true }), /not assigned/);
    const inventory = { weapons:[{id:'test-gun',name:'Pistol',damage:'d8+1 Phys',damageMode:'final',trait:'Finesse',range:'Close',tier:'Common',features:'Reliable'}],items:[{id:'medkit',name:'Medkit',quantity:'2',tier:'Common',use:'First Aid'}] };
    pilot.state.updateToken(tokenId, { inventory });
    await until(() => keeper.state.state.tokens.find(t => t.id === tokenId).inventory?.items[0]?.quantity === '2', 'owned inventory reaches Keeper');
    const pose = state => {
      const token = state.getTokensForActiveMap().find(token => token.id === tokenId);
      return [token.mapId, token.x, token.y];
    };
    const map = keeper.state.state.activeMapId;
    keeper.state.updateToken(tokenId, { x: 448, y: 320 });
    await until(() => pose(pilot.state).join() === [map, 448, 320].join(), 'Keeper move reaches player');
    pilot.state.updateToken(tokenId, { x: 640, y: 384 });
    await until(() => clients.slice(0, 2).every(({ state }) => pose(state).join() === [map, 640, 384].join()), 'player move reaches Keeper and is confirmed to the player');
    pilot.manager.disconnect();
    await until(() => keeper.state.state.connectedPeers.length === 0, 'disconnected player leaves roster');
    keeper.state.updateToken(tokenId, { x: 512, y: 256 });
    await pilot.manager.joinSession(room, 'Pilot', keeper.manager.invite);
    assert.deepEqual(pose(pilot.state), [map, 512, 256]);
    assert.ok(pilot.state.canEditToken(tokenId));
    const restored = pilot.state.state.tokens.find(t => t.id === tokenId);
    assert.deepEqual(restored.inventory, inventory);
    assert.ok(restored.conditions.includes('Bleeding') && restored.conditions.includes('Hidden'));
    assert.ok(pilot.state.state.logs.some(entry => entry.type === 'CHECK'));
    assert.ok(pilot.state.state.logs.every(entry => entry.visibility !== 'keeper'));
    const wire = JSON.stringify(pilot.received);
    assert.ok(!wire.includes('SECRET_AMBUSH_SENTINEL'));
    assert.ok(!wire.includes(hidden.id)); assert.ok(!wire.includes(secret.id));
    assert.ok(pilot.received.filter(packet => packet.type === 'INITIAL_STATE').every(packet => packet.state.logs.every(entry => entry.visibility !== 'keeper')));
    assert.equal(stranger.packets(), 0, 'rejected sockets receive no campaign packets');
    keeper.manager.disconnect();
    await until(() => !pilot.state.state.isConnected, 'losing the Keeper marks the replica disconnected');
    assert.equal(pilot.state.canEditToken(tokenId), false);
  } finally {
    for (const { manager, socket } of clients.reverse()) {
      manager.disconnect();
      socket.close();
    }
    await server.close();
    dom.window.close();
  }
});
