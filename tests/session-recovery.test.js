import test, { after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const errors = [], virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => errors.push(error));
const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/', pretendToBeVisual: true, virtualConsole });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'MouseEvent', 'Image']) globalThis[key] = dom.window[key];
dom.window.HTMLCanvasElement.prototype.getContext = () => ({});
const { store } = await import('../src/state.js'); await store.ready;
const { CloudAccount, account } = await import('../src/cloudAccount.js');
const { initAccount, sessionPreferences } = await import('../src/accountUI.js');
const { NetworkManager } = await import('../src/networkManager.js');
const { CanvasEngine } = await import('../src/canvasEngine.js');
const { audio } = await import('../src/audioEngine.js'); audio.muted = true;
const { TokenHUD } = await import('../src/tokenSheet.js');
const original = structuredClone(store.state);
class EventCanvas extends CanvasEngine { startLoop() {} }
const canvas = document.getElementById('tactical_canvas');
canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 600 });
const engine = new EventCanvas(canvas);
const managers = [];
const mouse = (type, x, y) => canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(async () => {
  await store.saveQueue.catch(() => {});
  store.state = structuredClone(original); store.remoteApplying = false; store.sessionBusy = false;
  store.sessionRole = 'player'; store.memberId = 'pilot'; store.peerId = 'guest-wire';
  Object.assign(store.state, { userRole: 'player', isConnected: true, activeTool: 'select', activeLayer: 'tokens', gridSnap: false, snapToGrid: false, snapToAnchors: false, snapToObjects: false });
  const token = store.state.tokens.find(t => t.isPlayer);
  Object.assign(token, { x: 100, y: 100, ownerId: 'pilot', hidden: false });
  store.state.tokens = [token]; store.state.selectedTokenId = token.id; store.state.claimedTokenId = token.id;
  store.getActiveMap().walls = []; store.getActiveMap().lights = [];
  Object.assign(engine, { panX: 0, panY: 0, zoom: 1, draggedToken: null, draggedTokenFacing: null, preDragSnapshot: null, isPanning: false, isSpacePressed: false });
  document.activeElement?.blur?.();
});
afterEach(() => { for (const n of managers.splice(0)) n.disconnect(); assert.deepEqual(errors.splice(0), []); });
after(async () => { engine.waterUnsubscribe(); engine.tokenUnsubscribe?.(); await store.saveQueue.catch(() => {}); dom.window.close(); });

function identityWidget(user) {
  const listeners = new Map();
  return { currentUser: () => user, init() {}, open() {}, close() { this.emit('close'); }, logout() { user = null; this.emit('logout'); },
    on(name, fn) { const set = listeners.get(name) || new Set(); set.add(fn); listeners.set(name, set); },
    off(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, value) { for (const fn of listeners.get(name) || []) fn(value); },
    count(name) { return listeners.get(name)?.size || 0; } };
}

test('startup restores an already initialized Netlify session even without Firebase', async () => {
  window.netlifyIdentity = identityWidget({ id: 'cached-pilot', email: 'pilot@example.test', user_metadata: { full_name: 'Pilot' } });
  const oldLoad = account.loadPreferences;
  account.loadPreferences = async () => ({});
  try { await initAccount(); await tick(); assert.equal(account.user?.uid, 'cached-pilot'); }
  finally { account.loadPreferences = oldLoad; await account.signOut(); delete window.netlifyIdentity; }
});

test('header account identity updates safely and stays independent from the game connection', async () => {
  const button = document.getElementById('session_account'), oldLoad = account.loadPreferences;
  account.loadPreferences = async () => ({});
  try {
    await initAccount();
    assert.equal(document.querySelectorAll('#session_account').length, 1);
    assert.equal(button.closest('header')?.tagName, 'HEADER');
    assert.equal(document.getElementById('data_menu_btn'), null);
    store.state.isConnected = true;
    account.setNetlifyUser(null);
    assert.equal(button.dataset.signedIn, 'false');
    assert.equal(button.querySelector('[data-account-status]').textContent, 'Offline');
    account.setNetlifyUser({ id: 'header-pilot', email: 'pilot@example.test', user_metadata: { full_name: '<Pilot & Crew>' } });
    await tick();
    assert.equal(button.dataset.signedIn, 'true');
    assert.equal(button.querySelector('[data-account-name]').textContent, '<Pilot & Crew>');
    assert.equal(button.querySelector('[data-account-status]').textContent, 'Conectado');
    assert.equal(button.querySelector('pilot'), null);
    store.state.isConnected = false;
    assert.equal(button.dataset.signedIn, 'true');
    await account.signOut();
    assert.equal(button.querySelector('[data-account-name]').textContent, 'Iniciar sesión');
    assert.equal(button.querySelector('[data-account-status]').textContent, 'Offline');
  } finally { account.loadPreferences = oldLoad; }
});

test('shared session navigation replaces dialogs and retains online archive protections after a save failure', async () => {
  const { openSessionLobby } = await import('../src/sessionLobby.js');
  store.sessionRole = 'local'; store.state.isConnected = false; store.state.isHosting = false;
  const lobby = openSessionLobby();
  await lobby.querySelector('[data-session-section="saved"]').onclick();
  let modal = document.querySelector('.sessions-backdrop');
  assert.ok(modal?.isConnected); assert.equal(lobby.isConnected, false);
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
  assert.equal(modal.querySelector('#session_create').disabled, false);
  await modal.querySelector('[data-session-section="live"]').onclick();
  assert.equal(modal.isConnected, false);
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
  const live = document.querySelector('.dossier-backdrop');
  store.sessionRole = 'host'; store.state.isConnected = true; store.state.isHosting = true;
  await live.querySelector('[data-session-section="saved"]').onclick();
  modal = document.querySelector('.sessions-backdrop');
  assert.equal(modal.querySelector('#session_create').disabled, true);
  const oldSave = store.saveToStorage;
  store.saveToStorage = async () => { throw new Error('Storage unavailable'); };
  try {
    await modal.querySelector('#session_save').onclick();
    assert.match(modal.querySelector('.dossier-error').textContent, /Storage unavailable/);
    assert.equal(modal.querySelector('#session_create').disabled, true);
    assert.equal(modal.querySelector('#session_save').disabled, false);
  } finally { store.saveToStorage = oldSave; modal.remove(); }
});

test('Google popup and redirect explicitly honor remember-me before authentication', async () => {
  const c = new CloudAccount(), calls = [];
  c.auth = {}; c.authAPI = { browserLocalPersistence: 'local', browserSessionPersistence: 'session',
    setPersistence: async (_auth, type) => calls.push(type), GoogleAuthProvider: class { setCustomParameters() {} },
    signInWithPopup: async () => { calls.push('popup'); return { user: { uid: 'google-pilot' } }; },
    signInWithRedirect: async () => { calls.push('redirect'); } };
  await c.signInWithGoogle({ remember: true });
  await c.signInWithGoogle({ remember: false, useRedirect: true });
  assert.deepEqual(calls, ['local', 'popup', 'session', 'redirect']);
  assert.equal(c.user.uid, 'google-pilot');
});

async function endpoints() {
  const hostStore = new store.constructor(); await hostStore.ready;
  hostStore.state = structuredClone(store.state); hostStore.state.userRole = 'keeper'; hostStore.state.isHosting = true; hostStore.sessionRole = 'host';
  const host = new NetworkManager({ stateStore: hostStore }), guest = new NetworkManager({ stateStore: store }); managers.push(guest, host);
  host.room = guest.room = 'recovery-room'; guest.lastRevision = -1;
  const toHost = [], toGuest = [];
  guest.hostConn = { peer: 'host-wire', open: true, send: data => toHost.push(structuredClone(data)) };
  host.members.set('guest-wire', { id: 'pilot', name: 'Pilot' });
  host.connections.set('guest-wire', { peer: 'guest-wire', open: true, send: data => toGuest.push(structuredClone(data)) });
  const deliverGuest = async () => { while (toGuest.length) await guest.handleIncomingMessage(toGuest.shift(), 'host-wire'); };
  const deliverHost = async () => { while (toHost.length) await host.handleIncomingMessage(toHost.shift(), 'guest-wire'); };
  host.syncAll(); await deliverGuest();
  return { host, guest, hostStore, toHost, toGuest, deliverGuest, deliverHost, tokenId: store.state.tokens[0].id };
}

test('pending player movement survives an older snapshot and preserves newer Keeper resources', async () => {
  const f = await endpoints();
  store.updateToken(f.tokenId, { x: 300, y: 200 });
  assert.equal(store.state.tokens[0].x, 300, 'show the pending move immediately');
  f.hostStore.updateToken(f.tokenId, { hope: 1 }); f.host.syncAll();
  await f.deliverGuest();
  assert.equal(store.state.tokens[0].x, 300, 'in-flight snapshot must not undo the pending move');
  assert.equal(store.state.tokens[0].hope, 1, 'overlay only the changed fields');
  await f.deliverHost(); await f.deliverGuest();
  assert.equal(f.hostStore.state.tokens[0].x, 300); assert.equal(store.state.tokens[0].x, 300);
});

test('canvas drag remains visible across a Keeper snapshot and commits its final position once', async () => {
  const f = await endpoints();
  mouse('mousedown', 100, 100); mouse('mousemove', 250, 200);
  f.hostStore.updateToken(f.tokenId, { hope: 1 }); f.host.syncAll(); await f.deliverGuest();
  mouse('mousemove', 300, 200);
  const translations = [], ctx = new Proxy({ measureText: () => ({ width: 50 }), translate: (x, y) => translations.push([x, y]) }, { get: (obj, key) => key in obj ? obj[key] : () => ({ addColorStop() {} }) });
  engine.renderTokens(ctx, store.getActiveMap(), 1);
  assert.deepEqual(translations[0], [300, 200], 'render the current drag, using the latest token sheet');
  mouse('mouseup', 300, 200);
  assert.equal(f.toHost.length, 1);
  await f.deliverHost(); await f.deliverGuest();
  assert.equal(f.hostStore.state.tokens[0].x, 300); assert.equal(store.state.tokens[0].hope, 1);
});

test('late Netlify SDK initialization restores the session and binds lifecycle events once', async () => {
  const c = new CloudAccount(); delete window.netlifyIdentity;
  const loading = c.initNetlifyIdentity();
  const user = { id: 'late-pilot', email: 'late@example.test' }, ni = identityWidget(user);
  window.netlifyIdentity = ni;
  document.querySelector('script[src*="netlify-identity-widget"]').dispatchEvent(new Event('load'));
  await loading; await c.initNetlifyIdentity();
  assert.equal(c.user.uid, user.id); assert.equal(ni.count('login'), 1);
  ni.emit('logout'); assert.equal(c.user, null);
  delete window.netlifyIdentity;
});

test('Firebase initial null never erases Netlify and the selected provider survives reload', () => {
  const c = new CloudAccount(), user = { id: 'netlify-pilot', email: 'n@example.test' };
  c.setNetlifyUser(user); c.setFirebaseUser(null); assert.equal(c.user.uid, user.id);
  c.setFirebaseUser({ uid: 'firebase-pilot' }); assert.equal(c.user.uid, user.id);
  const reload = new CloudAccount(); reload.setFirebaseUser({ uid: 'firebase-pilot' }); reload.setNetlifyUser(user, false);
  assert.equal(reload.user.uid, user.id);
  c.setFirebaseUser({ uid: 'firebase-pilot' }, true); c.setNetlifyUser(null, false);
  assert.equal(c.user.uid, 'firebase-pilot');
});

test('Netlify cancelled and completed sign-ins remove temporary listeners and logout is not recursive', async () => {
  const ni = identityWidget(null), c = new CloudAccount(); window.netlifyIdentity = ni;
  let pending = c.signInWithNetlify(); await tick(); ni.emit('close');
  await assert.rejects(pending, /cancelado/);
  assert.equal(ni.count('close'), 0); assert.equal(ni.count('error'), 0); assert.equal(ni.count('login'), 1);
  pending = c.signInWithNetlify(); await tick(); ni.emit('login', { id: 'logged-pilot' });
  assert.equal((await pending).uid, 'logged-pilot'); assert.equal(ni.count('login'), 1);
  await c.signOut(); assert.equal(c.user, null); delete window.netlifyIdentity;
});

test('cancelled Google access does not silently switch authentication providers', async () => {
  const c = new CloudAccount(); c.setNetlifyUser({ id: 'existing-pilot' });
  c.auth = {}; c.authAPI = { setPersistence: async () => {}, browserLocalPersistence: 'local', GoogleAuthProvider: class {}, signInWithPopup: async () => { throw Object.assign(new Error('Cancelled'), { code: 'auth/popup-closed-by-user' }); } };
  c.signInWithNetlify = () => assert.fail('No implicit provider switch');
  await assert.rejects(c.signInWithGoogle(), /Cancelled/); assert.equal(c.user.uid, 'existing-pilot');
});

test('late preference responses cannot restore another account or a claimed token and Keeper fog', async () => {
  const c = new CloudAccount(); c.setFirebaseUser({ uid: 'first-pilot' }, true); c.identity = async () => c.user.uid;
  let resolveRead;
  c.dbAPI = { doc: () => 'preferences', getDocFromServer: () => new Promise(resolve => { resolveRead = resolve; }) };
  const pending = c.loadPreferences(); await tick(); c.setFirebaseUser({ uid: 'second-pilot' }, true);
  resolveRead({ exists: () => true, data: () => ({ userName: 'Old name', claimedTokenId: 'old-token' }) });
  await assert.rejects(pending, /Account changed/);
  const prefs = sessionPreferences({ userName: 'Pilot', audioMuted: true, showGrid: false, claimedTokenId: 'old-token', gmVision: true, fogOfWar: false, fogExploredOpacity: .1 });
  assert.deepEqual(prefs, { userName: 'Pilot', audioMuted: true, showGrid: false });
  localStorage.setItem('veil_user_preferences', JSON.stringify({ userName: 'Another account' }));
  c.dbAPI.getDocFromServer = async () => { throw new Error('Offline'); };
  assert.deepEqual(await c.loadPreferences(), {});
});

test('rapid HUD resource changes each send once and old confirmations cannot undo the newest edit', async () => {
  const f = await endpoints(), container = document.createElement('div'); document.body.append(container);
  const hud = new TokenHUD(container);
  const start = store.state.tokens[0].hp.current;
  container.querySelector('[data-quick-stat="hp"][data-delta="-1"]').click();
  container.querySelector('[data-quick-stat="hp"][data-delta="-1"]').click();
  assert.equal(store.state.tokens[0].hp.current, start - 2); assert.equal(f.toHost.length, 2);
  await f.host.handleIncomingMessage(f.toHost.shift(), 'guest-wire'); await f.deliverGuest();
  assert.equal(store.state.tokens[0].hp.current, start - 2, 'second edit is still pending');
  await f.deliverHost(); await f.deliverGuest();
  assert.equal(f.hostStore.state.tokens[0].hp.current, start - 2); assert.equal(f.guest.pendingTokenPatches.size, 0);
  container.remove();
});

test('player spotlight toggle synchronizes without granting light-configuration permissions', async () => {
  const f = await endpoints(), container = document.createElement('div'); document.body.append(container);
  const hud = new TokenHUD(container), previous = !!store.state.tokens[0].hasSpotlight;
  container.querySelector('#quick_spotlight_btn').click();
  assert.equal(f.toHost.length, 1); await f.deliverHost(); await f.deliverGuest();
  assert.equal(f.hostStore.state.tokens[0].hasSpotlight, !previous); assert.equal(store.state.tokens[0].spotlight.enabled, !previous);
  assert.equal(store.updateToken(f.tokenId, { spotlight: { radius: 99999 } }), false);
  assert.equal(f.toHost.length, 0); container.remove();
});

test('orientation gestures use the current snapshot and commit one facing update', async () => {
  const f = await endpoints(), token = store.state.tokens[0];
  token.facingAngle = 0; f.hostStore.state.tokens[0].facingAngle = 0;
  const handleX = token.x + (token.size || 1) * store.getActiveMap().gridSize / 2 + 20;
  mouse('mousedown', handleX, 100); mouse('mousemove', 100, 200);
  f.hostStore.updateToken(f.tokenId, { hope: 2 }); f.host.syncAll(); await f.deliverGuest();
  mouse('mouseup', 100, 200);
  assert.equal(f.toHost.length, 1); await f.deliverHost(); await f.deliverGuest();
  assert.equal(store.state.tokens[0].facingAngle, Math.PI / 2); assert.equal(store.state.tokens[0].hope, 2);
});

test('Keeper teleport or reassignment cancels an obsolete drag without overwriting the new state', async () => {
  const f = await endpoints();
  mouse('mousedown', 100, 100); mouse('mousemove', 200, 200);
  f.hostStore.updateToken(f.tokenId, { x: 400, y: 400 }); f.host.syncAll(); await f.deliverGuest();
  mouse('mouseup', 200, 200);
  assert.equal(f.toHost.length, 0); assert.equal(store.state.tokens[0].x, 400);
  mouse('mousedown', 400, 400); mouse('mousemove', 500, 400);
  f.hostStore.updateToken(f.tokenId, { ownerId: 'someone-else' }); f.host.syncAll(); await f.deliverGuest();
  mouse('mouseup', 500, 400); assert.equal(f.toHost.length, 0); assert.equal(engine.draggedToken, null);
});

test('Keeper Player preview does not reject authorized remote moves; repeated packets apply once', async () => {
  const f = await endpoints();
  f.hostStore.state.userRole = 'player'; f.hostStore.state.claimedTokenId = 'different-token';
  store.updateToken(f.tokenId, { x: 230, y: 270 });
  const packet = f.toHost.shift();
  await f.host.handleIncomingMessage(packet, 'guest-wire');
  await f.host.handleIncomingMessage({ ...packet, messageId: 'replayed-move', partial: { x: 999, y: 999 } }, 'guest-wire');
  await f.deliverGuest(); assert.equal(f.hostStore.state.tokens[0].x, 230); assert.equal(store.state.tokens[0].x, 230);
});

test('rejected resource edits restore confirmed values with an explicit response', async () => {
  const f = await endpoints(), hp = store.state.tokens[0].hp;
  store.updateToken(f.tokenId, { hp: { ...hp, max: hp.max + 1, current: 1 } });
  await f.deliverHost();
  assert.ok(f.toGuest.some(p => p.type === 'TOKEN_PATCH_REJECTED' && /máximo/.test(p.error)));
  await f.deliverGuest(); assert.equal(store.state.tokens[0].hp.current, hp.current); assert.equal(f.guest.pendingTokenPatches.size, 0);
});

test('a move in flight cannot alter a token after the Keeper changes scene', async () => {
  const f = await endpoints(); store.updateToken(f.tokenId, { x: 900, y: 900 });
  const nextMap = f.hostStore.state.maps.find(m => m.id !== f.hostStore.state.activeMapId);
  f.hostStore.switchScene(nextMap.id); const authoritative = structuredClone(f.hostStore.state.tokens[0]);
  await f.deliverHost(); await f.deliverGuest();
  assert.equal(store.state.activeMapId, nextMap.id); assert.equal(store.state.tokens[0].x, authoritative.x);
  assert.equal(f.guest.pendingTokenPatches.size, 0);
});

test('unconfirmed edits time out to the latest authoritative token, not the local campaign default', async t => {
  const f = await endpoints();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  store.updateToken(f.tokenId, { x: 500, y: 500 });
  f.hostStore.updateToken(f.tokenId, { hope: 1 }); f.host.syncAll(); await f.deliverGuest();
  t.mock.timers.tick(10001);
  assert.equal(store.state.tokens[0].x, 100); assert.equal(store.state.tokens[0].hope, 1);
  assert.equal(f.guest.pendingTokenPatches.size, 0);
});

test('unconfirmed movement does not reveal rooms or adversaries before Keeper acknowledgement', async () => {
  const f = await endpoints();
  f.hostStore.updateToken(f.tokenId, { visionRange: 400, visionAngle: 90, facingAngle: 0 }); f.host.syncAll(); await f.deliverGuest();
  const enemy = { id: 'unseen-contact', x: 650, y: 100, isPlayer: false }, map = store.getActiveMap();
  store.updateToken(f.tokenId, { x: 600, y: 100 });
  assert.equal(store.state.tokens[0].x, 600, 'the token displays the proposed location');
  assert.equal(engine.visionTokens()[0].x, 100, 'lighting and exploration retain the confirmed location');
  assert.equal(engine.isTokenVisibleToPlayers(enemy, store.state.tokens, map), false);
  assert.equal(engine.isPointInPlayerVision(650, 100, store.state.tokens, map), false);
  await f.deliverHost(); await f.deliverGuest();
  assert.equal(engine.isTokenVisibleToPlayers(enemy, store.state.tokens, map), true);
});
