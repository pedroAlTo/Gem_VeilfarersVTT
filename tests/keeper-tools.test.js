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
  assert.equal(catalog.filter(x => x.placement !== 'narrative').length, 48);
  const swarm = profile('CHARON SKITTER-RAT SWARM');
  assert.deepEqual([swarm.hp, swarm.evasion, swarm.attack, swarm.major, swarm.severe, swarm.stress], [6, 11, 2, 6, 12, 0]);
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
  for (const entry of catalog) { assert.ok(entry.book && entry.section && entry.line > 0 && entry.text.length > 30);
    assert.ok(entry.description.length > 25 && !entry.description.includes('**'), entry.name); }
  const plugin = adversaryLibraryPlugin(); const watched = [];
  const source = plugin.load.call({ addWatchFile: file => watched.push(file) }, plugin.resolveId('virtual:veil-adversaries'));
  assert.deepEqual(JSON.parse(source.slice('export default '.length)), catalog); assert.equal(watched.length, 4);
});

test('all 57 profiles can be placed and retained in a saved campaign', async () => {
  const { validateCampaign } = await import('../src/validation.js');
  for (const entry of catalog) {
    const token = deployAdversary(entry);
    assert.equal(token.hp.max, entry.hp ?? 0, entry.name);
    assert.ok(token.featureNotes.includes(entry.text), entry.name);
    if (entry.placement === 'narrative') assert.equal(token.bestiaryMode, 'narrative', entry.name);
  }
  const saved = JSON.parse(JSON.stringify(store.serializeCampaign()));
  assert.doesNotThrow(() => validateCampaign(saved));
  assert.equal(saved.tokens.filter(t => t.bestiaryMode === 'narrative').length, 9);
  assert.equal(catalog.filter(e => e.proposalReason).length, 44);
  const mites = profile('VOID MITE CLUSTER');
  assert.deepEqual(mites.provisional, { major: 5, severe: 10, armor: 0, stress: 2 });
  assert.deepEqual([mites.hp, mites.evasion, mites.attack, mites.damage], [8, 13, 3, '1d6 Void']);
  assert.deepEqual(profile('CINDER-MITE').provisional, { severe: 9, armor: 1 });
  assert.equal(profile('NEON JELLY').armor, 0);
  assert.equal(profile('FERRO-BEAST').armor, 4);
  assert.equal(profile('VANKO THE VILE (AUGMENTATION SPECIALIST)').provisional, undefined);
});

test('the Keeper can fill missing legacy tracks on the selected original token once', async () => {
  const entry = profile('FERRO-BEAST');
  const token = deployAdversary(entry);
  const note = token.featureNotes.split('\n\nPropuesta del VTT')[0];
  store.updateToken(token.id, { name: 'El Guardián', featureNotes: note, armor: { current: 0, max: 0 }, hp: { ...token.hp, current: 2 } });
  const modal = await openAdversaryLibrary([entry]);
  const apply = modal.querySelector('[data-apply-tracks]');
  assert.match(apply.textContent, /El Guardián.*Armor 4/);
  apply.click();
  assert.deepEqual(store.getSelectedToken().armor, { max: 4, current: 4 });
  assert.equal(store.getSelectedToken().hp.current, 2);
  assert.equal(modal.querySelector('[data-apply-tracks]'), null);
  assert.ok(store.getSelectedToken().featureNotes.startsWith(note));
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
  assert.equal(reference.querySelector('[data-deploy]').disabled, false);
  assert.equal(reference.querySelector('[data-deploy-boss]').disabled, true);
  assert.match(reference.querySelector('[data-deploy]').textContent, /marcador/);
  store.sessionRole = 'player'; assert.equal(await openAdversaryLibrary(catalog), undefined);
  reference.querySelector('[data-deploy]').disabled = false; reference.querySelector('[data-deploy]').click();
  assert.equal(store.state.tokens.filter(t => t.name.includes('GRANDFATHER')).length, 0);
});

test('the illustrated Void Mite can be placed with identified, editable provisional values', async () => {
  const modal = await openAdversaryLibrary(catalog);
  const search = modal.querySelector('[data-search]');
  const show = name => { search.value = name; search.dispatchEvent(new Event('input')); };
  show('Void Mite Cluster');
  const refArt = modal.querySelector('[data-detail] img').getAttribute('src');
  assert.equal(modal.querySelector('[data-detail] a').getAttribute('href'), refArt);
  assert.equal(modal.querySelector('[data-deploy]').disabled, false);
  assert.match(modal.querySelector('[data-detail] details').textContent, /Major 5 · Severe 10/);
  modal.querySelector('[data-deploy]').click();
  const deployed = store.getSelectedToken();
  assert.equal(deployed.avatarUrl, refArt);
  assert.equal(deployed.hp.majorThreshold, 5);
  assert.match(deployed.featureNotes, /Propuesta del VTT/);
  const other = await openAdversaryLibrary(catalog);
  other.querySelector('[data-search]').value = 'Security Drone Model-V';
  other.querySelector('[data-search]').dispatchEvent(new Event('input'));
  const securityArt = other.querySelector('[data-detail] img').getAttribute('src');
  assert.notEqual(securityArt, refArt);
  other.querySelector('[data-deploy]').click();
  assert.equal(store.getSelectedToken().avatarUrl, securityArt);
});

test('the Keeper can pick a Refuge portrait, preview it and keep it when the token is renamed', async () => {
  const { TokenHUD } = await import('../src/tokenSheet.js');
  const token = deployAdversary(profile('SECURITY DRONE MODEL-V'));
  new TokenHUD(mount()).openTokenSettingsModal(token);
  document.querySelector('#sheet_portrait_picker').click();
  const picker = document.querySelector('.portrait-picker'), collection = picker.querySelector('[data-collection]');
  collection.value = 'rift_spinner'; collection.dispatchEvent(new Event('change'));
  assert.equal(picker.querySelectorAll('.portrait-choice').length, 5);
  assert.ok(picker.querySelector('.portrait-choice img').getAttribute('src').includes('rift_spinner'));
  collection.value = 'bestiary'; collection.dispatchEvent(new Event('change'));
  const choices = [...picker.querySelectorAll('.portrait-choice')];
  assert.equal(choices.length, 13);
  const queen = choices.find(b => b.textContent === 'Weaver Queen');
  const url = queen.querySelector('img').getAttribute('src');
  queen.click(); await new Promise(r => setTimeout(r, 0));
  assert.equal(document.querySelector('#sheet_avatar_preview').getAttribute('src'), url);
  document.querySelector('#sheet_name').value = 'Hunger Weaver';
  document.querySelector('#sheet_save_btn').click();
  const saved = store.state.tokens.find(t => t.id === token.id);
  assert.equal(saved.name, 'Hunger Weaver');
  assert.equal(saved.avatarUrl, url);
  assert.equal(saved.portraitOverride, true);
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

test('Bear Down after a damage roll spends Resolve and needs no previous check', () => {
  const pc = store.addToken({ name: 'Rook', isPlayer: true, actorType: 'player', path: 'Sleeping', resolve: { current: 3, max: 3, dieType: 'd6' } });
  const result = performGameAction({ type: 'RESOLVE', actorId: pc.id, count: 2, target: 'damage' });
  assert.equal(result.damage, true); assert.equal(result.bearDown.count, 2); assert.equal(result.bearDown.dice.length, 2);
  assert.ok(result.bearDown.dice.every(v => v >= 1 && v <= 6));
  assert.equal(result.bearDown.bonus, result.bearDown.dice[0] + result.bearDown.dice[1]);
  assert.equal(store.state.tokens.find(t => t.id === pc.id).resolve.current, 1);
  assert.throws(() => performGameAction({ type: 'RESOLVE', actorId: store.addToken({ name: 'Ava', isPlayer: true, actorType: 'player', path: 'Awakened' }).id, target: 'damage' }), /No Resolve/);
});

test('the dice panel adds Bear Down to the open damage roll with the same dice', () => {
  const panel = new DiceRollerSidebar(mount());
  const pc = store.addToken({ name: 'Rook', isPlayer: true, actorType: 'player', path: 'Sleeping', resolve: { current: 3, max: 3, dieType: 'd4' } });
  const target = store.addToken({ name: 'Drone', isPlayer: false, actorType: 'adversary', hp: { current: 6, max: 6, majorThreshold: 7, severeThreshold: 13 } });
  store.update({ selectedTokenId: pc.id });
  panel.currentActor = store.state.tokens.find(t => t.id === pc.id);
  const q = id => panel.container.querySelector(id);
  q('#dmg_target_select').innerHTML = `<option value="${target.id}">Drone</option>`; q('#dmg_target_select').value = target.id;
  q('#dmg_formula').value = ''; q('#dmg_dice_count').value = '1'; q('#dmg_dice_sides').value = '8'; q('#dmg_flat_mod').value = '0';
  q('#dmg_proficiency').value = '1'; q('#dmg_honed').value = '0';
  panel.executeDamageCalc([5]);
  assert.equal(panel.pendingDamageFor(pc.id)?.raw, 5);
  return panel.applyBearDownDamage(3).then(updated => {
    assert.equal(updated.raw, 8, 'same d8 face (5) + Bear Down 3');
    assert.equal(q('#dmg_raw_val').textContent, '8');
    assert.equal(panel.pendingDamageFor(target.id), null, 'only the roller can Bear Down on it');
  });
});


test('enemy dossiers show editable book descriptions, recover legacy profiles and keep masked contacts anonymous', async () => {
  const { openDossier } = await import('../src/dossierUI.js');
  const { adversaryDescription } = await import('../src/adversaryDescription.js');
  const a = deployAdversary(profile('ROGUE SYNTHETIC'), { hidden: false });
  assert.match(a.description, /protocol droid/);
  assert.equal(adversaryDescription({ featureNotes: a.featureNotes }), a.description);
  assert.match(profile('SCRAP DRONE').description, /^Automated maintenance/);
  assert.match(profile('MAMA K (INFORMATION BROKER)').description, /^Mama K is a kindly grandmother/);
  assert.equal(adversaryDescription({ featureNotes: 'Private GM plan for tomorrow.' }), '');
  const modal = openDossier(a, () => {});
  const box = modal.querySelector('[name=description]');
  assert.equal(box.value, a.description); box.value = 'A damaged protocol droid.';
  modal.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  const saved = store.state.tokens.find(t => t.id === a.id);
  assert.equal(saved.description, box.value);
  const n = new NetworkManager();
  assert.equal(n.snapshotFor('guest').tokens.find(t => t.id === a.id).description, undefined);
  n.disconnect();
});

test('the player can browse every ancestry from their dossier and only change an assigned token', async () => {
  const { openDossier } = await import('../src/dossierUI.js');
  const { openActorPortrait } = await import('../src/portraitPicker.js');
  const token = store.state.tokens.find(t => t.isPlayer);
  const other = store.state.tokens.find(t => t.id !== token.id);
  store.update({ userRole:'player', claimedTokenId:token.id });
  assert.equal(openActorPortrait(other.id), undefined);
  const dossier = openDossier(token);
  dossier.querySelector('[data-portrait]').click();
  const picker = document.querySelector('.portrait-picker');
  assert.ok(picker.querySelector('[data-upload]'));
  const group = picker.querySelector('[data-collection]');
  group.value = 'rift_spinner'; group.dispatchEvent(new Event('change'));
  const cls = picker.querySelector('[data-class]'); cls.value = ''; cls.dispatchEvent(new Event('change'));
  const tile = picker.querySelector('.portrait-choice');
  const url = tile.querySelector('img').getAttribute('src');
  tile.click(); await new Promise(r => setTimeout(r,0));
  assert.equal(store.state.tokens.find(t => t.id === token.id).avatarUrl, url);
  assert.equal(dossier.querySelector('.dossier-portrait').getAttribute('src'), url);
  dossier.querySelector('[data-portrait]').click();
  document.querySelector('.portrait-picker [data-auto]').click(); await new Promise(r => setTimeout(r,0));
  assert.equal(store.state.tokens.find(t => t.id === token.id).portraitOverride, false);
  assert.notEqual(dossier.querySelector('.dossier-portrait').getAttribute('src'), url);
});

test('the token controls live in the portrait selection: one window, applied at once, closed with «Listo»', async () => {
  const { openActorPortrait } = await import('../src/portraitPicker.js');
  document.querySelectorAll('.portrait-picker').forEach(m => m.remove());
  const token = store.state.tokens.find(t => t.isPlayer);
  store.update({ userRole:'player', claimedTokenId:token.id });
  const changes = [];
  const picker = openActorPortrait(token.id, null, { onChange: patch => changes.push(patch) });
  assert.equal(document.querySelectorAll('.portrait-picker').length, 1);
  assert.match(picker.querySelector('h3').textContent, /^Retrato y token · /);
  assert.ok(picker.querySelector('.portrait-grid') && picker.querySelector('[data-token-look]'));
  assert.equal(picker.querySelectorAll('[data-look-frame]').length, 31);
  // The frame and its colour apply at once.
  picker.querySelector('[data-look-frame="frame-15"]').click();
  let live = store.state.tokens.find(t => t.id === token.id);
  assert.equal(live.frame, 'frame-15'); assert.equal(live.color, '#d1d1d1');
  assert.equal(changes.at(-1).color, '#d1d1d1');
  assert.equal(picker.querySelector('[data-look-frame="frame-15"]').getAttribute('aria-checked'), 'true');
  // A stat's place, and the name.
  const hp = picker.querySelector('[data-layout-stat="hp"]'); hp.value = 'outer1'; hp.dispatchEvent(new Event('change'));
  const name = picker.querySelector('[data-look-name]'); name.checked = false; name.dispatchEvent(new Event('change'));
  live = store.state.tokens.find(t => t.id === token.id);
  assert.equal(live.vitalsLayout.hp, 'outer1'); assert.equal(live.vitalsLayout.name, false);
  // Choosing a portrait keeps the window open, with the controls as they are.
  const group = picker.querySelector('[data-collection]'); group.value = 'crew'; group.dispatchEvent(new Event('change'));
  const tile = picker.querySelector('.portrait-choice'), url = tile.querySelector('img').getAttribute('src');
  tile.click(); await new Promise(r => setTimeout(r, 0));
  assert.equal(store.state.tokens.find(t => t.id === token.id).avatarUrl, url);
  assert.ok(picker.isConnected);
  assert.equal(picker.querySelector('.portrait-choice[aria-pressed=true] img').getAttribute('src'), url);
  assert.equal(picker.querySelector('[data-layout-stat="hp"]').value, 'outer1');
  assert.equal(store.state.tokens.find(t => t.id === token.id).frame, 'frame-15');
  picker.querySelector('[data-done]').click();
  assert.equal(picker.isConnected, false);
});
