import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'customElements',
  'MutationObserver',
  'localStorage',
  'Event',
  'CustomEvent',
])
  globalThis[key] = dom.window[key];
const { store } = await import('../src/state.js');
await store.ready;
const { NetworkManager, network } = await import('../src/networkManager.js');
const { sanitizeHTML } = await import('../src/ui.js');
const { performGameAction } = await import('../src/gameActions.js');
const { rollVeilfarersCheck, resolveDamage } = await import('../src/rulesEngine.js');
const { DiceRollerSidebar } = await import('../src/diceRoller.js');
const { TokenHUD } = await import('../src/tokenSheet.js');
const { StarshipManager } = await import('../src/starshipManager.js');
const { audio } = await import('../src/audioEngine.js');
audio.muted = true;
const original = structuredClone(store.state),
  random = Math.random;
beforeEach(async () => {
  await store.saveQueue.catch(() => {});
  store.state = structuredClone(original);
  store.sessionRole = 'local';
  store.listeners.clear();
  store.undoManager = null;
  store.remoteApplying = false;
  localStorage.clear();
  localStorage.setItem('veilvtt.activeCampaign', store.state.campaignId);
  Math.random = random;
  network.connections.clear();
  network.members.clear();
  network.seen.clear();
  network.room = 'ROOM';
});
after(async () => {
  await store.saveQueue.catch(() => {});
  Math.random = random;
  dom.window.close();
});
const actor = () => store.state.tokens[0];
const sleeping = () => {
  Object.assign(actor(), {
    path: 'Sleeping',
    effort: 2,
    hope: 2,
    resolve: { current: 2, max: 2, dieType: 'd4' },
    stress: { current: 2, max: 6 },
  });
  return actor();
};
const check = (options = {}) =>
  performGameAction({
    type: 'CHECK',
    actorId: actor().id,
    options: { traitId: 'finesse', dc: 15, ...options },
  });
test('all matching faces, including ones, are critical regardless of DC', () => {
  for (let i = 0; i < 12; i++) {
    Math.random = () => i / 12;
    assert.equal(rollVeilfarersCheck({ dc: 30 }).isCritical, true);
  }
});
test('Fear is clamped at twelve and invalid numbers cannot corrupt it', () => {
  store.setFear(99);
  assert.equal(store.state.fear, 12);
  store.setFear(NaN);
  assert.equal(store.state.fear, 12);
});
test('critical pays Hope and clears Stress exactly once', () => {
  Object.assign(actor(), { path: 'Awakened', hope: 2, stress: { current: 2, max: 6 } });
  Math.random = () => 0;
  check();
  assert.equal(actor().hope, 3);
  assert.equal(actor().stress.current, 1);
});
test('Sleeping critical pays track and extra point, respecting caps', () => {
  sleeping();
  actor().effort = 5;
  actor().resolve.current = 0;
  Math.random = () => 0;
  check({ criticalChoice: 'effort' });
  assert.equal(actor().effort, 6);
  assert.equal(actor().resolve.current, 1);
  assert.deepEqual(actor().effortTrack, [false, false]);
});
test('no free Experience at zero Hope, no Resolve on Awakened', () => {
  actor().path = 'Awakened';
  actor().hope = 0;
  assert.throws(() => check({ experienceMod: 2 }), /Hope/);
  assert.throws(() => check({ useResolve: true }), /Resolve/);
});
test('Resolve is spent, cannot be used empty', () => {
  sleeping();
  actor().resolve.current = 0;
  assert.throws(() => check({ useResolve: true }));
  actor().resolve.current = 2;
  let n = 0;
  Math.random = () => [0, 0.5, 0.1][n++ % 3];
  check({ useResolve: true });
  assert.equal(actor().resolve.current, 1);
});
test('Steady Hands sets one-shot +2 and debits exactly once', () => {
  sleeping();
  performGameAction({ type: 'EFFORT', actorId: actor().id, move: 'Steady Hands (+2)' });
  assert.equal(actor().effort, 1);
  assert.equal(actor().pendingCheckBonus, 2);
  assert.throws(() =>
    performGameAction({ type: 'EFFORT', actorId: actor().id, move: 'Steady Hands (+2)' })
  );
  let n = 0;
  Math.random = () => [0, 0.5][n++ % 2];
  const r = check();
  assert.equal(r.customMod, 2);
  assert.equal(actor().pendingCheckBonus, 0);
});
test('Bear Down modifies the existing roll without changing faces or repeating payouts', () => {
  sleeping();
  let n = 0;
  Math.random = () => [0, 0.5][n++ % 2];
  const r = check();
  const fear = store.state.fear;
  const b = performGameAction({ type: 'RESOLVE', actorId: actor().id });
  assert.ok(b.total > r.total);
  assert.equal(b.hopeVal, r.hopeVal);
  assert.equal(b.fearVal, r.fearVal);
  assert.equal(store.state.fear, fear);
  assert.equal(actor().resolve.current, 1);
});
test('Keeper critical maximizes normal pool', () =>
  assert.equal(
    resolveDamage({ diceCount: 2, diceSides: 8, flatModifier: 2, isKeeperCritical: true })
      .rawDamage,
    18
  ));
test('damage applies against current HP and only once', () => {
  const el = document.createElement('div');
  document.body.append(el);
  const ui = new DiceRollerSidebar(el);
  ui.populateDamageTargets();
  el.querySelector('#dmg_target_select').value = actor().id;
  el.querySelector('#dmg_dice_count').value = '1';
  el.querySelector('#dmg_dice_sides').value = '4';
  el.querySelector('#dmg_flat_mod').value = '0';
  el.querySelector('#dmg_use_armor').checked = false;
  Math.random = () => 0;
  ui.executeDamageCalc();
  store.updateToken(actor().id, { hp: { ...actor().hp, current: 5 } });
  el.querySelector('#apply_dmg_to_target_btn').click();
  assert.equal(actor().hp.current, 4);
  el.querySelector('#apply_dmg_to_target_btn').click();
  assert.equal(actor().hp.current, 4);
  el.remove();
});
test('empty collections and ship changes persist', async () => {
  store.update({
    tokens: [],
    clocks: [],
    handouts: [],
    starship: { ...store.state.starship, hull: 1, pearls: 0 },
  });
  await store.saveQueue;
  const restored = new store.constructor();
  await restored.ready;
  assert.equal(restored.state.tokens.length, 0);
  assert.equal(restored.state.clocks.length, 0);
  assert.equal(restored.state.handouts.length, 0);
  assert.equal(restored.state.starship.hull, 1);
  assert.equal(restored.state.starship.pearls, 0);
});
test('import validates before mutation and preserves campaign name and active map', () => {
  const before = JSON.stringify(store.state);
  assert.equal(store.importCampaignJSON('{"maps":null}'), false);
  assert.equal(JSON.stringify(store.state), before);
  const data = store.serializeCampaign();
  data.campaignName = 'Imported name';
  data.activeMapId = data.maps[1].id;
  assert.equal(store.importCampaignJSON(JSON.stringify(data)), true);
  assert.equal(store.state.campaignName, 'Imported name');
  assert.equal(store.state.activeMapId, data.maps[1].id);
});
test('save errors are visible in state', async () => {
  const proto = Object.getPrototypeOf(localStorage),
    old = proto.setItem;
  proto.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  await store.saveToStorage();
  assert.equal(store.state.saveStatus, 'error');
  proto.setItem = old;
});
test('guest broadcasts go to host', () => {
  store.sessionRole = 'player';
  let message;
  network.hostConn = { open: true, peer: 'host', send: (m) => (message = m) };
  network.broadcast({ type: 'TOKEN_MOVE', tokenId: actor().id, x: 1, y: 2 });
  assert.equal(message.type, 'TOKEN_MOVE');
  assert.equal(message.room, 'ROOM');
});
test('unauthorized peers and foreign rooms cannot modify state', async () => {
  store.state.isHosting = true;
  const old = actor().x;
  await network.handleIncomingMessage(
    { type: 'TOKEN_MOVE', room: 'ROOM', messageId: 'a', tokenId: actor().id, x: 9, y: 8 },
    'stranger'
  );
  assert.equal(actor().x, old);
  network.members.set('player', { name: 'Player' });
  actor().ownerId = 'player';
  await network.handleIncomingMessage(
    { type: 'TOKEN_MOVE', room: 'OTHER', messageId: 'b', tokenId: actor().id, x: 9, y: 8 },
    'player'
  );
  assert.equal(actor().x, old);
});
test('owner can move, cannot rename or promote their token', async () => {
  store.state.isHosting = true;
  network.members.set('player', { name: 'Player' });
  actor().ownerId = 'player';
  await network.handleIncomingMessage(
    { type: 'TOKEN_MOVE', room: 'ROOM', messageId: 'a', tokenId: actor().id, x: 9, y: 8 },
    'player'
  );
  assert.equal(actor().x, 9);
  const old = actor().name;
  await network.handleIncomingMessage(
    {
      type: 'TOKEN_UPDATE',
      room: 'ROOM',
      messageId: 'b',
      tokenId: actor().id,
      partial: { name: 'evil', ownerId: 'evil' },
    },
    'player'
  );
  assert.equal(actor().name, old);
});
test('all snapshots filter hidden tokens, private clocks and unshared documents', () => {
  actor().hidden = true;
  store.state.clocks[0].isKeeperOnly = true;
  const state = network.snapshotFor('p');
  assert.ok(!state.tokens.some((t) => t.id === actor().id));
  assert.ok(!state.clocks.some((c) => c.id === store.state.clocks[0].id));
  assert.ok(state.handouts.every((h) => h.sharedWithPlayers));
});
test('full snapshot synchronizes create, delete, clocks, walls and ship together', () => {
  const created = store.addToken({ name: 'New' });
  store.addClock({ title: 'New clock' });
  store.state.starship.hull = 4;
  const snap = network.snapshotFor('p');
  assert.ok(snap.tokens.some((t) => t.id === created.id));
  assert.ok(snap.clocks.some((c) => c.title === 'New clock'));
  assert.equal(snap.starship.hull, 4);
  store.deleteToken(created.id);
  assert.ok(!network.snapshotFor('p').tokens.some((t) => t.id === created.id));
});
test('XSS is removed while document formatting and custom controls survive', () => {
  const safe = sanitizeHTML(
    '<img src=x onerror="alert(1)"><script>alert(1)</script><b>OK</b><vf-select><option value="1">One</option></vf-select>'
  );
  assert.ok(!safe.includes('onerror'));
  assert.ok(!safe.includes('<script'));
  assert.ok(safe.includes('<b>OK</b>'));
  assert.ok(safe.includes('vf-select'));
});
test('custom select works after option content replacement', async () => {
  const el = document.createElement('vf-select');
  el.innerHTML = '<option value="a">Alpha</option>';
  document.body.append(el);
  el.value = 'a';
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el.querySelector('button').textContent, 'Alpha');
  el.innerHTML = '<option value="b">Beta</option>';
  el.value = 'b';
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el.querySelector('button').textContent, 'Beta');
  el.remove();
});
test('Heat crosses cap, applies system damage once until cooled', () => {
  const ui = Object.create(StarshipManager.prototype);
  store.state.starship.heat = 9;
  ui.updateShip({ heat: 11 });
  assert.equal(store.state.starship.heat, 11);
  assert.equal(store.state.starship.systems['Primary Drive'], 2);
  ui.updateShip({ heat: 13 });
  assert.equal(store.state.starship.systems['Primary Drive'], 2);
  ui.updateShip({ heat: 9 });
  ui.updateShip({ heat: 11 });
  assert.equal(store.state.starship.systems['Primary Drive'], 1);
});
test('Keeper rolls grant neither Fear nor Path resources', () => {
  actor().isPlayer = false;
  const fear = store.state.fear,
    hope = actor().hope,
    stress = actor().stress.current;
  let n = 0;
  Math.random = () => [0, 0.5][n++ % 2];
  check();
  assert.equal(store.state.fear, fear);
  Math.random = () => 0;
  check();
  assert.equal(actor().hope, hope);
  assert.equal(actor().stress.current, stress);
});
test('Opening is a paid one-shot Advantage', () => {
  sleeping();
  performGameAction({ type: 'EFFORT', actorId: actor().id, move: 'The Opening' });
  assert.equal(actor().effort, 0);
  assert.equal(actor().pendingAdvantage, true);
  let n = 0;
  Math.random = () => [0, 0.5, 0.2][n++ % 3];
  assert.ok(check().advVal > 0);
  assert.equal(actor().pendingAdvantage, false);
});
test('Burnout charges HP and Stress without repeatedly reducing the same maximum', () => {
  sleeping();
  actor().effort = 0;
  const hp = actor().hp.current;
  performGameAction({ type: 'EFFORT', actorId: actor().id, move: 'Read the Room', burnout: true });
  assert.equal(actor().hp.current, hp - 1);
  assert.equal(actor().stress.current, 3);
  assert.equal(actor().stress.max, 5);
  performGameAction({ type: 'EFFORT', actorId: actor().id, move: 'Read the Room', burnout: true });
  assert.equal(actor().stress.max, 5);
  assert.equal(actor().hp.current, hp - 2);
});
test('optional Efforts cannot silently spend resources before adoption', () => {
  sleeping();
  actor().effort = 6;
  assert.throws(() =>
    performGameAction({ type: 'EFFORT', actorId: actor().id, move: 'Second Wind' })
  );
  assert.equal(actor().effort, 6);
  store.state.optionalEfforts = true;
  performGameAction({ type: 'EFFORT', actorId: actor().id, move: 'Second Wind' });
  assert.equal(actor().effort, 3);
  assert.equal(actor().stress.current, 0);
});
test('owned resource updates cannot change thresholds or die types', async () => {
  store.state.isHosting = true;
  network.members.set('p', { name: 'Player' });
  actor().ownerId = 'p';
  const original = actor().hp.majorThreshold;
  await network.handleIncomingMessage(
    {
      type: 'TOKEN_UPDATE',
      room: 'ROOM',
      messageId: 'threshold',
      tokenId: actor().id,
      partial: { hp: { ...actor().hp, majorThreshold: 999 } },
    },
    'p'
  );
  assert.equal(actor().hp.majorThreshold, original);
});
test('an invalid invitation never receives a snapshot', () => {
  const handlers = {};
  let closed = false,
    sent = false;
  network.invite = 'correct';
  network.setupConnection({
    peer: 'invalid',
    open: true,
    on: (e, f) => (handlers[e] = f),
    close: () => {
      closed = true;
      handlers.close?.();
    },
    send: () => (sent = true),
  });
  handlers.data({ type: 'HELLO', room: 'ROOM', invite: 'wrong', playerName: 'Unknown' });
  assert.equal(closed, true);
  assert.equal(sent, false);
  assert.equal(network.members.has('invalid'), false);
});
test('replayed messages are not applied twice', async () => {
  store.state.isHosting = true;
  network.members.set('p', { name: 'Player' });
  actor().ownerId = 'p';
  const message = {
    type: 'TOKEN_MOVE',
    room: 'ROOM',
    messageId: 'same-id',
    tokenId: actor().id,
    x: 10,
    y: 20,
  };
  await network.handleIncomingMessage(message, 'p');
  await network.handleIncomingMessage({ ...message, x: 90 }, 'p');
  assert.equal(actor().x, 10);
});
test('guest state applies creation, deletion, ship and walls while retaining Player role', async () => {
  const snapshot = network.snapshotFor('p');
  snapshot.tokens = [];
  snapshot.clocks = [];
  snapshot.starship.hull = 2;
  snapshot.maps[0].walls = [];
  store.sessionRole = 'player';
  network.hostConn = { peer: 'host' };
  await network.handleIncomingMessage(
    { type: 'INITIAL_STATE', room: 'ROOM', messageId: 'sync', state: snapshot },
    'host'
  );
  assert.equal(store.state.tokens.length, 0);
  assert.equal(store.state.clocks.length, 0);
  assert.equal(store.state.starship.hull, 2);
  assert.equal(store.getActiveMap().walls.length, 0);
  assert.equal(store.state.userRole, 'player');
  assert.equal(store.state.gmVision, false);
});
test('guest cannot promote to Keeper or edit campaign directly', () => {
  store.sessionRole = 'player';
  store.state.userRole = 'player';
  const fear = store.state.fear;
  store.update({ userRole: 'keeper' });
  store.update({ fear: 12 });
  assert.equal(store.state.userRole, 'player');
  assert.equal(store.state.fear, fear);
});
test('guest replica never overwrites local saved campaign', async () => {
  await store.saveToStorage();
  const key = `veilvtt.campaign.${store.state.campaignId}`,
    saved = localStorage.getItem(key);
  store.sessionRole = 'player';
  store.remoteApplying = true;
  store.update({ campaignName: 'Remote' });
  await store.saveQueue;
  assert.equal(localStorage.getItem(key), saved);
});
test('malformed nested imports are rejected atomically', () => {
  const before = JSON.stringify(store.state),
    input = store.serializeCampaign();
  input.clocks[0].segments = 1e9;
  assert.equal(store.importCampaignJSON(JSON.stringify(input)), false);
  assert.equal(JSON.stringify(store.state), before);
});
test('secret doors retain blocking geometry but not labels or secret flags', () => {
  store.getActiveMap().walls.push({
    id: 'secret',
    x1: 1,
    y1: 2,
    x2: 3,
    y2: 4,
    isDoor: true,
    isSecret: true,
    label: 'Secret laboratory',
  });
  const wall = network.snapshotFor('p').maps[0].walls.find((w) => w.id === 'secret');
  assert.equal(wall.wallType, 'wall');
  assert.equal(wall.isDoor, false);
  assert.equal(wall.label, undefined);
  assert.equal(wall.isSecret, undefined);
  assert.equal(wall.x2, 3);
});
test('armor changed after preview cannot give a free mitigation', () => {
  const el = document.createElement('div');
  document.body.append(el);
  const ui = new DiceRollerSidebar(el);
  ui.populateDamageTargets();
  el.querySelector('#dmg_target_select').value = actor().id;
  el.querySelector('#dmg_dice_count').value = '1';
  el.querySelector('#dmg_proficiency').value = '1';
  el.querySelector('#dmg_dice_sides').value = '4';
  el.querySelector('#dmg_flat_mod').value = '0';
  el.querySelector('#dmg_use_armor').checked = true;
  Math.random = () => 0;
  ui.executeDamageCalc();
  const hp = actor().hp.current;
  store.updateToken(actor().id, { armor: { ...actor().armor, current: 0 } });
  el.querySelector('#apply_dmg_to_target_btn').click();
  assert.equal(actor().hp.current, hp - 1);
  ui.executeDamageCalc();
  assert.equal(el.querySelector('#apply_dmg_to_target_btn').disabled, false);
  el.remove();
});
test('naval end-of-round cooling is conditional on firing', () => {
  const el = document.createElement('div');
  document.body.append(el);
  store.state.starship.heat = 5;
  store.state.starship.firedThisRound = true;
  new StarshipManager(el);
  el.querySelector('#regen_shields_btn').click();
  assert.equal(store.state.starship.heat, 5);
  assert.equal(store.state.starship.firedThisRound, false);
  el.querySelector('#regen_shields_btn').click();
  assert.equal(store.state.starship.heat, 4);
  el.remove();
});
test('naval shields absorb first, then Hull and declared system damage', () => {
  const el = document.createElement('div');
  document.body.append(el);
  new StarshipManager(el);
  el.querySelector('#naval_raw').value = '10';
  el.querySelector('#naval_arc').value = 'fore';
  el.querySelector('#naval_system').value = 'Weapons';
  el.querySelector('#naval_critical').checked = true;
  el.querySelector('#apply_naval_damage').click();
  assert.equal(store.state.starship.shieldArcs.fore, 0);
  assert.equal(store.state.starship.hull, 12);
  assert.equal(store.state.starship.systems.Weapons, 2);
  el.remove();
});
test('disabled custom selects settle without MutationObserver feedback', async () => {
  const el = document.createElement('vf-select');
  el.innerHTML = '<option value="x">Choice</option>';
  document.body.append(el);
  el.disabled = true;
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el.querySelector('button').disabled, true);
  el.disabled = false;
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el.querySelector('button').disabled, false);
  el.remove();
});
test('successful saves report SAVED after the write completes', async () => {
  store.storageReadFailed = false;
  await store.saveToStorage();
  assert.equal(store.state.saveStatus, 'saved');
  assert.equal(store.state.saveError, undefined);
});
