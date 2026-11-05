import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadAdversaries, adversaryLibraryPlugin } from '../scripts/adversary-library.mjs';
import { createActor } from '../src/actors.js';

const catalog = loadAdversaries();
const profile = name => catalog.find(entry => entry.name === name);
const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[key] = dom.window[key];
const { store } = await import('../src/state.js'); await store.ready;
const { performGameAction } = await import('../src/gameActions.js');
const { NetworkManager } = await import('../src/networkManager.js');
const { openAdversaryLibrary, deployAdversary } = await import('../src/adversaryLibrary.js');
const { CombatLogView } = await import('../src/combatLog.js');
const { DiceRollerSidebar } = await import('../src/diceRoller.js');
const { audio } = await import('../src/audioEngine.js'); audio.muted = true;
const original = structuredClone(store.state);
beforeEach(async () => {
  await store.saveQueue.catch(() => {});
  store.state = structuredClone(original); store.state.dice3d = false; store.state.logs = [];
  store.listeners.clear(); store.sessionRole = 'local'; store.remoteApplying = false; store.sessionBusy = false;
  store.state.campaignId = crypto.randomUUID(); store.state.userRole = 'keeper';
  document.body.replaceChildren(); delete window.veilCanvas;
});
after(async () => { await store.saveQueue.catch(() => {}); dom.window.close(); });
const options = { traitId: 'finesse', dc: 12, customMod: 0, experienceMod: 0 };
const check = (actorId, visibility = 'table') => ({ type: 'CHECK', actorId, visibility, options });
const mount = () => { const node = document.createElement('div'); document.body.append(node); return node; };

test('catalog preserves printed combat values, full abilities and book provenance', () => {
  assert.equal(catalog.length, 57); assert.equal(new Set(catalog.map(x => x.id)).size, 57);
  assert.equal(catalog.filter(x => x.deployable).length, 42);
  const swarm = profile('CHARON SKITTER-RAT SWARM');
  assert.deepEqual([swarm.hp, swarm.evasion, swarm.attack, swarm.major, swarm.severe, swarm.stress], [6, 11, 2, 6, 12, null]);
  assert.equal(swarm.damage, '1d8 (Horde) / 1d4 (Depleted)');
  const synthetic = profile('ROGUE SYNTHETIC');
  assert.deepEqual([synthetic.hp, synthetic.stress, synthetic.evasion, synthetic.attack, synthetic.major, synthetic.severe], [12, 6, 13, 3, 10, 18]);
  assert.equal(synthetic.damage, '1d8+1 Phys + 1d4 Shock');
  assert.match(synthetic.text, /Overclock/i);
  const broker = profile('VANKO THE VILE (AUGMENTATION SPECIALIST)');
  assert.deepEqual([broker.hp, broker.stress, broker.armor, broker.evasion, broker.attack, broker.major, broker.severe], [25, 6, 4, 14, 5, 15, 30]);
  assert.match(broker.damage, /surgical tools.*arm-cannon/);
  assert.match(broker.text, /Physical Description/); assert.match(broker.text, /Relationship Hooks/);
  assert.deepEqual(broker.traits, { agility: 2, strength: 3, finesse: 2, instinct: 1, presence: 0, knowledge: 4 });
  for (const entry of catalog) { assert.ok(entry.book && entry.section && entry.line > 0 && entry.text.length > 30); }
  const plugin = adversaryLibraryPlugin(); const watched = [];
  const source = plugin.load.call({ addWatchFile: file => watched.push(file) }, plugin.resolveId('virtual:veil-adversaries'));
  assert.deepEqual(JSON.parse(source.slice('export default '.length)), catalog); assert.equal(watched.length, 3);
});

test('incomplete and narrative-only encounters stay reference-only instead of acquiring invented stats', () => {
  for (const name of ['VOID MITE CLUSTER', 'THE GRANDFATHER LEVIATHAN', "THE EMPEROR'S SHADOW"]) {
    const entry = profile(name); assert.ok(entry, name); assert.equal(entry.deployable, false, name);
    assert.throws(() => deployAdversary(entry), /procedimiento/);
  }
});

test('deployment makes independent hidden tokens in the active scene with the complete source notes', () => {
  const entry = profile('ROGUE SYNTHETIC');
  window.veilCanvas = { displayWidth: 800, displayHeight: 600, screenToWorld: () => ({ x: 0, y: 230 }) };
  const a = deployAdversary(entry), b = deployAdversary(entry, { hidden: false });
  assert.notEqual(a.id, b.id); assert.equal(a.mapId, store.state.activeMapId); assert.equal(a.x, 0); assert.equal(a.y, 230);
  assert.equal(a.hidden, true); assert.equal(b.hidden, false); assert.equal(a.isPlayer, false);
  assert.equal(a.hp.max, 12); assert.equal(a.hp.majorThreshold, 10); assert.equal(a.hp.severeThreshold, 18);
  assert.equal(a.attackModifier, 3); assert.equal(a.damageExpression, entry.damage); assert.ok(a.featureNotes.includes(entry.text));
  store.updateToken(a.id, { hp: { ...a.hp, current: 1 } }); assert.equal(b.hp.current, 12);
  const n = new NetworkManager(); const replica = n.snapshotFor('guest');
  assert.ok(!replica.tokens.some(t => t.id === a.id)); assert.ok(replica.tokens.some(t => t.id === b.id));
  store.sessionRole = 'player';
  assert.throws(() => deployAdversary(entry), /Solo el Keeper/); n.disconnect();
});

test('library search, book/tier filters and deployment operate from the actual controls', async () => {
  const modal = await openAdversaryLibrary(catalog);
  const book = modal.querySelector('[data-book]'), tier = modal.querySelector('[data-tier]'), search = modal.querySelector('[data-search]');
  book.value = 'Rust & Steel'; book.dispatchEvent(new Event('change'));
  tier.value = '3'; tier.dispatchEvent(new Event('change'));
  search.value = 'Vanko surgical'; search.dispatchEvent(new Event('input'));
  assert.equal(modal.querySelectorAll('.bestiary-item').length, 1);
  assert.match(modal.querySelector('[data-detail]').textContent, /VANKO THE VILE/);
  assert.equal(modal.querySelector('[data-hidden]').checked, true);
  modal.querySelector('[data-deploy]').click();
  assert.equal(modal.isConnected, false); assert.equal(store.getSelectedToken().hp.max, 25);
  const reference = await openAdversaryLibrary(catalog);
  reference.querySelector('[data-search]').value = 'GRANDFATHER LEVIATHAN';
  reference.querySelector('[data-search]').dispatchEvent(new Event('input'));
  assert.equal(reference.querySelector('[data-deploy]').disabled, true);
  assert.match(reference.querySelector('[data-detail]').textContent, /Ficha de consulta/);
  store.sessionRole = 'player'; assert.equal(await openAdversaryLibrary(catalog), undefined);
  reference.querySelector('[data-deploy]').disabled = false; reference.querySelector('[data-deploy]').click();
  assert.equal(store.state.tokens.filter(t => t.name.includes('GRANDFATHER')).length, 0);
});

test('secret Keeper checks persist locally and never broadcast dice or enter player snapshots', async () => {
  const n = new NetworkManager(); store.state.isHosting = true; store.sessionRole = 'host';
  const sent = []; n.connections.set('guest', { open: true, send: data => sent.push(data) });
  const result = await n.performAction(check(undefined, 'keeper'));
  assert.equal(result.visibility, 'keeper'); assert.equal(result.actorName, 'Keeper');
  assert.equal(store.state.logs[0].visibility, 'keeper');
  assert.equal(store.serializeCampaign().logs[0].visibility, 'keeper');
  assert.deepEqual(n.snapshotFor('guest').logs, []);
  n.broadcast({ type: 'DICE_ROLL', result });
  assert.ok(!sent.some(data => data.type === 'DICE_ROLL'));
  const actor = createActor({ name: 'Public enemy', isPlayer: false }, store.state.activeMapId); store.state.tokens = [actor];
  await n.performAction(check(actor.id));
  assert.equal(n.snapshotFor('guest').logs.length, 1); assert.ok(sent.some(data => data.type === 'DICE_ROLL'));
  n.disconnect();
});

test('players cannot request secret checks or expose one through public Bear Down', async () => {
  const actor = createActor({ name: 'Pilot', path: 'Sleeping', ownerId: 'guest', resolve: { current: 2, max: 2, dieType: 'd4' } }, store.state.activeMapId);
  store.state.tokens = [actor]; performGameAction(check(actor.id, 'keeper'));
  assert.throws(() => performGameAction({ type: 'RESOLVE', actorId: actor.id }), /Make a check first/);
  const secretResolve = performGameAction({ type: 'RESOLVE', actorId: actor.id, visibility: 'keeper' });
  assert.equal(secretResolve.visibility, 'keeper'); assert.equal(secretResolve.log.visibility, 'keeper');
  const n = new NetworkManager(); n.room = 'test'; store.state.isHosting = true; store.sessionRole = 'host';
  n.members.set('guest', { id: 'guest' }); const responses = []; n.connections.set('guest', { open: true, send: data => responses.push(data) });
  const count = store.state.logs.length;
  await n.handleIncomingMessage({ type: 'ACTION', room: 'test', messageId: 'forged', requestId: 'r', action: check(actor.id, 'keeper') }, 'guest');
  assert.equal(store.state.logs.length, count); assert.ok(responses.some(data => data.type === 'ACTION_RESULT' && data.error));
  n.disconnect(); store.sessionRole = 'player';
  assert.throws(() => performGameAction(check(actor.id, 'keeper')), /Solo el Keeper/);
});

test('public and secret Bear Down histories remain independent for the same character', () => {
  const actor = createActor({ path: 'Sleeping', resolve: { current: 2, max: 2, dieType: 'd4' } }, store.state.activeMapId); store.state.tokens = [actor];
  const publicRoll = performGameAction(check(actor.id)); const secretRoll = performGameAction(check(actor.id, 'keeper'));
  assert.notEqual(publicRoll.id, secretRoll.id);
  const resolved = performGameAction({ type: 'RESOLVE', actorId: actor.id });
  assert.equal(resolved.id, publicRoll.id); assert.equal(resolved.visibility, undefined); assert.equal(resolved.log.visibility, undefined);
});

test('secret mode is usable without a token and removes private results on switching to Player', async () => {
  store.state.selectedTokenId = null;
  const logNode = mount(); new CombatLogView(logNode);
  const diceNode = mount(), dice = new DiceRollerSidebar(diceNode);
  const toggle = diceNode.querySelector('#secret_roll');
  assert.equal(diceNode.querySelector('#roll_check_btn').disabled, true);
  toggle.checked = true; toggle.dispatchEvent(new Event('change'));
  assert.equal(diceNode.querySelector('#roll_check_btn').disabled, false);
  await dice.executeActionCheck();
  assert.equal(dice.lastResult.visibility, 'keeper'); assert.match(logNode.textContent, /SOLO KEEPER/);
  dice.executeDamageCalc(); assert.equal(dice.secretDamage, true);
  assert.ok(store.state.logs.every(entry => entry.visibility === 'keeper'));
  store.update({ userRole: 'player' });
  assert.equal(toggle.closest('label').hidden, true); assert.equal(toggle.checked, false);
  assert.equal(diceNode.querySelector('#dice_result_display').style.display, 'none');
  assert.equal(diceNode.querySelector('#damage_result_display').style.display, 'none');
  assert.doesNotMatch(logNode.textContent, /SOLO KEEPER/);
  assert.equal(logNode.querySelectorAll('.log-card').length, 0);
});
