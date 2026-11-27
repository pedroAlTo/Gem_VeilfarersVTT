// The Hearts in the Void room (v2.62.0): a prepared campaign the Keeper loads from Sesiones → Módulos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[key] = dom.window[key];
const { store } = await import('../src/state.js'); await store.ready;
const { NetworkManager } = await import('../src/networkManager.js');
const { validateBoss } = await import('../src/encounterRules.js');
const file = JSON.parse(readFileSync(new URL('../public/campaigns/hearts-in-the-void.json', import.meta.url), 'utf8'));

test('the room passes the campaign rules: scenes per plate, arcs, people, adversaries and clocks', () => {
  const campaign = store.normalizeCampaign(structuredClone(file));
  assert.equal(campaign.campaignName, 'Hearts in the Void');
  assert.equal(campaign.maps.length, 10);
  for (const plate of ['A', 'B', '1', '2', '3', '4', '5']) assert.ok(campaign.maps.some(m => m.name.startsWith('Lámina ' + plate + ' ')), 'plate ' + plate);
  assert.deepEqual(campaign.arcs.flatMap(a => a.sceneIds).sort(), campaign.maps.map(m => m.id).sort(), 'every scene in one arc');
  assert.ok(campaign.tokens.every(t => t.mapId === 'reserve' && t.inReserve), 'everyone waits in the reserve');
  for (const name of ['Zara “Starwind” Kaine', 'Korren “Iron Hammer” Vex', 'Thex Vain-Glory', 'Brix “Coal-Heart” Stonehammer', 'Alexei Joric', 'Madame Silk', '“Scalpel” Kaine', 'Maya Santos', 'Nyx of the Last Account', 'ARIA-7']) {
    const npc = campaign.tokens.find(t => t.name === name);
    assert.ok(npc && npc.actorType === 'npc' && npc.description.includes('— EN —'), name);
  }
  const weavers = campaign.tokens.filter(t => t.name === 'Hunger Weaver');
  assert.equal(weavers.length, 2);
  assert.deepEqual([weavers[0].evasion, weavers[0].hp.max, weavers[0].attackModifier, weavers[0].damageExpression], [10, 6, 2, '1d8 Physical']);
  const queen = campaign.tokens.find(t => t.name === 'Weaver Queen');
  validateBoss(queen.boss);
  assert.deepEqual(queen.boss.states.map(s => [s.stats.hp, s.stats.evasion, s.stats.armor]), [[10, 8, 3], [8, 12, 0]]);
  assert.ok(campaign.tokens.every(t => t.actorType !== 'adversary' || t.hidden), 'adversaries start hidden');
  assert.equal(campaign.fogOfWar, true, 'the adventure plays with fog of war (v2.64.3)');
  assert.equal(campaign.clocks.length, 6);
  assert.ok(campaign.clocks.every(c => c.isKeeperOnly), 'clocks start hidden');
  assert.equal(campaign.clocks.find(c => /Korren/.test(c.title)).filled, 1);
});

test('the dossiers come in Spanish and English, and the Keeper’s notes never reach the players', () => {
  const docs = file.handouts;
  assert.ok(docs.length > 60);
  const bilingual = docs.filter(d => !d.id.startsWith('hv_book_'));
  for (const d of bilingual) assert.ok(d.contentHtml.includes('data-lang="es"') && d.contentHtml.includes('data-lang="en"'), d.title);
  assert.ok(docs.filter(d => d.folder?.startsWith('Keeper')).every(d => d.keeperOnly), 'Keeper folders are private');
  assert.ok(docs.every(d => !d.sharedWithPlayers), 'nothing is shared until the Keeper decides');
  // Online: a shared player document reaches the players; a private note never does, even if marked shared.
  const state = store.normalizeCampaign(structuredClone(file));
  state.handouts = state.handouts.map(h => h.id === 'hv_p_mission' || h.id === 'hv_g_start' ? { ...h, sharedWithPlayers: true } : h);
  const saved = structuredClone(store.state);
  Object.assign(store.state, state);
  try {
    const n = new NetworkManager();
    const sent = n.snapshotFor('guest').handouts.map(h => h.id);
    assert.deepEqual(sent, ['hv_p_mission']);
    n.disconnect();
  } finally { Object.assign(store.state, saved); }
});

test('the dossier window shows one language at a time and the private notes cannot be transmitted', async () => {
  const { HandoutManager } = await import('../src/handoutManager.js');
  const saved = structuredClone(store.state.handouts);
  store.update({ userRole: 'keeper', handouts: file.handouts.filter(d => ['hv_p_mission', 'hv_g_start'].includes(d.id)) });
  const pane = document.createElement('div'); document.body.append(pane);
  const manager = new HandoutManager(pane);
  const card = id => pane.querySelector(`.handout-card[data-id="${id}"]`);
  assert.ok(card('hv_g_start').querySelector('.handout-badge'), 'private mark');
  assert.equal(card('hv_g_start').querySelector('.broadcast-handout-btn, .share-handout-btn'), null, 'no transmit or share for private notes');
  card('hv_p_mission').querySelector('.share-handout-btn').click();
  assert.equal(store.state.handouts.find(h => h.id === 'hv_p_mission').sharedWithPlayers, true);
  manager.displayTransmissionPopup(store.state.handouts.find(h => h.id === 'hv_p_mission'));
  const popup = document.getElementById('active_transmission_popup');
  const visible = [...popup.querySelectorAll('[data-lang]')].filter(b => !b.hidden).map(b => b.dataset.lang);
  assert.deepEqual(visible, ['es']);
  popup.querySelector('.handout-lang button[data-show-lang="en"]').click();
  assert.deepEqual([...popup.querySelectorAll('[data-lang]')].filter(b => !b.hidden).map(b => b.dataset.lang), ['en']);
  popup.remove(); pane.remove();
  store.update({ handouts: saved });
});

test('the V toast is short and does not pile up (v2.62.1)', async t => {
  const { notify } = await import('../src/ui.js');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  notify('Nombres de los tokens ocultos (V para verlos).', 'info', { duration: 1200, key: 'names' });
  notify('Nombres de los tokens visibles.', 'info', { duration: 1200, key: 'names' });
  const toasts = () => [...document.querySelectorAll('#toast_stack .orbital-toast')].filter(el => el.dataset.toastKey === 'names');
  assert.equal(toasts().length, 1, 'one toast, the latest');
  assert.equal(toasts()[0].textContent, 'Nombres de los tokens visibles.');
  t.mock.timers.tick(1199); assert.equal(toasts().length, 1);
  t.mock.timers.tick(1); assert.equal(toasts().length, 0, 'gone after 1.2 s');
  notify('Aviso normal.');
  t.mock.timers.tick(5999); assert.ok(document.querySelector('#toast_stack .orbital-toast'), 'other toasts keep their 6 s');
  t.mock.timers.tick(1);
});

test('the home menu creates an online room that holds the adventure (v2.62.2)', async () => {
  const { RoomController } = await import('../src/roomController.js');
  let sent = null;
  const service = { ready: async () => {}, create: async (name, campaign) => { sent = { name, campaign }; return { id: 'room-hv', inviteCode: 'HEA-123' }; } };
  const controller = new RoomController({ service, stateStore: store, networkManager: { disconnect() {} } });
  controller.enter = async () => {}; // the connection itself is the rooms' integration test
  const before = store.state.campaignId;
  await controller.create('Hearts in the Void · 26 nov', { campaign: file });
  assert.equal(sent.name, 'Hearts in the Void · 26 nov');
  assert.equal(sent.campaign.campaignName, 'Hearts in the Void · 26 nov');
  assert.equal(sent.campaign.maps.length, 10);
  assert.equal(sent.campaign.handouts.length, file.handouts.length);
  assert.notEqual(sent.campaign.campaignId, file.campaignId, 'a new campaign id for every room');
  assert.notEqual(store.state.campaignId, before);
  assert.ok(sent.campaign.tokens.every(t => !t.ownerId), 'nobody owns a token in a new room');
});

test('the home screen offers the adventure next to Crear partida (v2.62.2)', () => {
  const lobby = readFileSync(new URL('../src/vtt-integration/modules/lobbyGateway.js', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const html of [lobby, index]) assert.match(html, /id="vf-quick-module"[^>]*data-module="hearts-in-the-void"/);
});

test('clocks belong to scenes: a new clock to the active one; only the active scene’s clocks are drawn (v2.62.3)', async () => {
  const { clockOnScene, scopeMapIds, clockScenesLabel } = await import('../src/clockScenes.js');
  const { ClocksManager } = await import('../src/clocksManager.js');
  const { validateCampaign } = await import('../src/validation.js');
  const saved = structuredClone({ maps: store.state.maps, arcs: store.state.arcs, clocks: store.state.clocks, activeMapId: store.state.activeMapId, userRole: store.state.userRole });
  const maps = [{ ...structuredClone(store.state.maps[0]), id: 'm_a', name: 'A' }, { ...structuredClone(store.state.maps[0]), id: 'm_b', name: 'B' }, { ...structuredClone(store.state.maps[0]), id: 'm_c', name: 'C' }];
  store.update({ userRole: 'keeper', maps, arcs: [{ id: 'arc1', name: 'Uno', description: '', sceneIds: ['m_a', 'm_b'], tokenIds: [], images: [] }, { id: 'arc2', name: 'Dos', description: '', sceneIds: ['m_c'], tokenIds: [], images: [] }], clocks: [], activeMapId: 'm_a' });
  try {
    const here = store.addClock({ title: 'Aquí', segments: 4 });
    assert.deepEqual(here.mapIds, ['m_a'], 'a new clock belongs to the active scene');
    const everywhere = store.addClock({ title: 'Siempre', segments: 4, mapIds: null });
    assert.equal(everywhere.mapIds, undefined);
    const arc = store.addClock({ title: 'Arco', segments: 6, mapIds: scopeMapIds('arc') });
    assert.deepEqual(arc.mapIds, ['m_a', 'm_b']);
    const legacy = { id: 'old', title: 'Antiguo', segments: 4, filled: 0 };
    assert.ok(clockOnScene(legacy, 'm_c') && clockOnScene(everywhere, 'm_c') && !clockOnScene(here, 'm_c'));
    assert.equal(clockScenesLabel(here), 'A'); assert.equal(clockScenesLabel(arc), '2 escenas'); assert.equal(clockScenesLabel(everywhere), 'Todas las escenas');
    const overlay = document.createElement('div'); document.body.append(overlay);
    new ClocksManager(overlay);
    const drawn = () => [...overlay.querySelectorAll('.clock-widget .clock-title')].map(t => t.textContent).sort();
    assert.deepEqual(drawn(), ['Aquí', 'Arco', 'Siempre']);
    store.update({ activeMapId: 'm_c' });
    assert.deepEqual(drawn(), ['Siempre'], 'another scene shows only its own clocks');
    store.update({ activeMapId: 'm_b' });
    assert.deepEqual(drawn(), ['Arco', 'Siempre']);
    // Deleting a scene frees its clocks; a clock left without scenes is shown everywhere, never lost.
    store.update({ activeMapId: 'm_c' });
    store.deleteScene('m_a');
    assert.deepEqual(store.state.clocks.find(c => c.title === 'Aquí').mapIds, []);
    assert.deepEqual(store.state.clocks.find(c => c.title === 'Arco').mapIds, ['m_b']);
    assert.ok(drawn().includes('Aquí'));
    overlay.remove();
    assert.throws(() => validateCampaign({ ...store.serializeCampaign(), clocks: [{ ...here, mapIds: [42] }] }), /clock/i);
  } finally { store.update(saved); }
});

test('the room’s clocks live on their plates and the user’s art is linked (v2.62.3)', () => {
  const plate = id => 'hv_map_plate_' + id;
  const clocks = Object.fromEntries(file.clocks.map(c => [c.id.replace('hv_clock_', ''), c.mapIds]));
  assert.deepEqual(clocks.hunger, [plate(5)]);
  assert.deepEqual(clocks.core, [plate(4)]);
  assert.deepEqual(clocks.structure, [plate(4), plate(1), plate(2), plate(5)]);
  const art = Object.fromEntries(file.handouts.filter(h => h.imageUrl).map(h => [h.id, h.imageUrl]));
  for (const [id, name] of [['hv_p_rec_room', 'last-game'], ['hv_p_poetry', 'notebook'], ['hv_p_dock_k17', 'dock-k17'], ['hv_p_pack', 'pack'], ['hv_p_signs', 'props'], ['hv_p_commercial', 'props'],
    ['hv_p_nexus', 'nexus'], ['hv_p_kurogane_archive', 'experimental-records'], ['hv_p_korren_comm', 'korren-comm']]) {
    assert.equal(art[id], `/campaigns/hearts-in-the-void/${name}.webp`, id);
    assert.ok(readFileSync(new URL(`../public${art[id]}`, import.meta.url)).length > 10000, name);
  }
});

test('the user’s minor characters are portrait options, and Parel Dho and Blue Casta wear them (v2.62.4)', async () => {
  const { portraitChoices, isPresetPortrait, isPlayerPortrait, presetLocation } = await import('../src/portraitCatalog.js');
  const npc = portraitChoices('npc');
  assert.ok(['Parel Dho', 'Blue Casta', 'Zara “Starwind” Kaine', 'Lydia Valerius'].every(name => npc.some(p => p.name === name)));
  for (const { url } of npc) {
    assert.ok(isPresetPortrait(url) && isPlayerPortrait(url), url);
    assert.ok(['npc', 'pregens'].includes(presetLocation(url).collection) || presetLocation(url).cls === '');
    assert.ok(readFileSync(new URL('../public' + url, import.meta.url)).length > 10000, url);
  }
  const token = name => file.tokens.find(t => t.name === name);
  assert.equal(token('Parel Dho').avatarUrl, '/assets/tokens/npc/parel-dho.webp');
  assert.equal(token('Blue Casta').avatarUrl, '/assets/tokens/npc/blue-casta.webp');
  assert.equal(file.handouts.find(h => h.id === 'hv_npc_parel').imageUrl, '/assets/tokens/npc/parel-dho.webp');
  const picker = readFileSync(new URL('../src/portraitPicker.js', import.meta.url), 'utf8');
  assert.match(picker, /\['npc', 'PNJ'\]/);
});

test('the user’s characters are portrait options of their ancestry, the pregens wear theirs (v2.62.5)', async () => {
  const { portraitChoices, PREGEN_PORTRAITS } = await import('../src/portraitCatalog.js');
  const names = ancestry => portraitChoices(ancestry).map(p => p.name);
  assert.ok(names('kryx').includes('Rourke Ashfang') && names('kryx').includes('Brix “Coal-Heart” Stonehammer'), 'Kryx');
  assert.ok(names('kryllian').includes('Dr. Lyra Voss') && names('kryllian').includes('Korren “Iron Hammer” Vex') && names('kryllian').includes('Parel Dho'));
  assert.ok(names('rift_spinner').includes('Madame Silk') && names('ailuran').includes('Nyx of the Last Account') && names('ethereal').includes('Thex Vain-Glory'));
  assert.equal(portraitChoices('kryx', 'soldier').length, 3, 'a class filter keeps its own three portraits');
  assert.equal(PREGEN_PORTRAITS.length, 10);
  for (const { url } of PREGEN_PORTRAITS) assert.ok(readFileSync(new URL('../public' + url, import.meta.url)).length > 10000, url);
  const { PREGENS, pregenPortrait } = await import('../src/pregens.js');
  assert.ok(PREGENS.every(p => pregenPortrait(p).startsWith('/assets/tokens/hiv/')));
  const { pregenToken } = await import('../src/playerActionBar.js');
  const rourke = await pregenToken('rourke');
  assert.equal(rourke.avatarUrl, '/assets/tokens/hiv/rourke.webp');
  assert.equal(rourke.portraitOverride, true);
  // The room: the people wear their portraits; the Keeper’s dossier shows the full figure.
  const token = name => file.tokens.find(t => t.name === name);
  assert.equal(token('Zara “Starwind” Kaine').avatarUrl, '/assets/tokens/hiv/zara.webp');
  assert.equal(token('Alexei Joric').avatarUrl, '/assets/tokens/hiv/alexei-civil.webp');
  assert.ok(token('Lord Comandante Maximus Joric') && token('Lydia Valerius') && token('Oficial de recuperación Joric'));
  assert.equal(file.handouts.find(h => h.id === 'hv_npc_zara').imageUrl, '/campaigns/hearts-in-the-void/characters/zara.webp');
  assert.equal(file.handouts.find(h => h.id === 'hv_p_portraits').imageUrl, '/campaigns/hearts-in-the-void/characters/alexei.webp');
});

test('NPC dossiers can be shared: the crew gets who they are, the Keeper keeps the rest (v2.63.0)', async () => {
  const korren = file.handouts.find(h => h.id === 'hv_npc_korren');
  assert.equal(korren.keeperOnly, false);
  assert.equal(korren.imageUrl, '/campaigns/hearts-in-the-void/characters/korren.webp');
  assert.ok(korren.keeperHtml.includes('Aurelian') && !korren.contentHtml.includes('Aurelian'), 'the debt is the Keeper’s');
  const token = file.tokens.find(t => t.id === 'tok_hv_korren');
  assert.ok(!token.description.includes('Aurelian'), 'the token (seen by the players) does not tell it either');
  for (const d of file.handouts.filter(h => h.id.startsWith('hv_npc_'))) assert.ok(d.contentHtml.includes('data-lang="en"') && d.keeperHtml, d.title);
  // Shared and transmitted, the players never get the Keeper's part.
  const state = store.normalizeCampaign(structuredClone(file));
  state.handouts = state.handouts.map(h => h.id === 'hv_npc_korren' ? { ...h, sharedWithPlayers: true } : h);
  const saved = structuredClone(store.state);
  Object.assign(store.state, state, { isHosting: true });
  try {
    const n = new NetworkManager();
    const sent = n.snapshotFor('guest').handouts;
    assert.deepEqual(sent.map(h => h.id), ['hv_npc_korren']);
    assert.equal(sent[0].keeperHtml, undefined);
    const out = []; n.connections.set('guest', { open: true, send: m => out.push(m) });
    n.broadcast({ type: 'TRANSMISSION', handout: state.handouts.find(h => h.id === 'hv_npc_korren') });
    assert.equal(out.length, 1);
    assert.ok(!JSON.stringify(out[0]).includes('Aurelian'));
    n.connections.clear(); n.disconnect();
  } finally { Object.assign(store.state, saved); }
  // The Keeper reads both parts side by side; a player only the public one.
  const { HandoutManager } = await import('../src/handoutManager.js');
  const pane = document.createElement('div'); document.body.append(pane);
  const manager = new HandoutManager(pane);
  store.update({ userRole: 'keeper' });
  manager.displayTransmissionPopup(korren);
  let popup = document.getElementById('active_transmission_popup');
  assert.ok(popup.querySelector('.has-keeper-part .transmission-keeper').textContent.includes('Aurelian'));
  assert.ok(popup.querySelector('.transmission-attached-img'));
  popup.remove();
  store.update({ userRole: 'player' });
  manager.displayTransmissionPopup(korren);
  popup = document.getElementById('active_transmission_popup');
  assert.equal(popup.querySelector('.transmission-keeper'), null);
  popup.remove(); pane.remove();
  store.update({ userRole: 'keeper' });
});

test('a room made before the images is brought up to date without touching the table (v2.63.0)', async () => {
  const { mergeModule, roomModule } = await import('../src/moduleUpdate.js');
  const old = structuredClone(file);
  // As the room was in v2.62.0: a private NPC note without image, a generic portrait, no new NPCs.
  old.handouts = old.handouts.filter(h => h.id !== 'hv_npc_maximus').map(h => h.id === 'hv_npc_zara' ? { ...h, keeperOnly: true, imageUrl: '', keeperHtml: undefined, contentHtml: '<p>old</p>' } : h);
  old.handouts.push({ id: 'doc_mine', title: 'Mis notas', sender: 'Keeper', timestamp: '', contentHtml: '<p>mía</p>', imageUrl: '', sharedWithPlayers: true });
  old.handouts = old.handouts.map(h => h.id === 'hv_p_mission' ? { ...h, sharedWithPlayers: true } : h);
  old.tokens = old.tokens.filter(t => t.id !== 'tok_hv_maximus').map(t => t.id === 'tok_hv_zara' ? { ...t, avatarUrl: '/assets/tokens/crew/human-f-pilot.webp', description: 'secreto', mapId: 'hv_map_plate_5', x: 321, y: 654, inReserve: false }
    : t.id === 'tok_hv_korren' ? { ...t, avatarUrl: 'https://example.com/mi-korren.png' } : t);
  assert.equal(roomModule(old), 'hearts-in-the-void');
  const { handouts, tokens, arcs, counts } = mergeModule(old, file, 'hearts-in-the-void');
  const zaraDoc = handouts.find(h => h.id === 'hv_npc_zara');
  assert.equal(zaraDoc.imageUrl, '/campaigns/hearts-in-the-void/characters/zara.webp');
  assert.ok(zaraDoc.keeperHtml && !zaraDoc.keeperOnly && zaraDoc.contentHtml !== '<p>old</p>');
  assert.ok(handouts.some(h => h.id === 'hv_npc_maximus' && !h.sharedWithPlayers), 'new dossiers arrive unshared');
  assert.equal(handouts.find(h => h.id === 'doc_mine').contentHtml, '<p>mía</p>');
  assert.equal(handouts.find(h => h.id === 'hv_p_mission').sharedWithPlayers, true, 'shared stays shared');
  const zara = tokens.find(t => t.id === 'tok_hv_zara');
  assert.deepEqual([zara.avatarUrl, zara.mapId, zara.x, zara.y], ['/assets/tokens/hiv/zara.webp', 'hv_map_plate_5', 321, 654]);
  assert.notEqual(zara.description, 'secreto');
  assert.equal(tokens.find(t => t.id === 'tok_hv_korren').avatarUrl, 'https://example.com/mi-korren.png', 'the Keeper’s own image stays');
  assert.ok(tokens.some(t => t.id === 'tok_hv_maximus') && arcs.find(a => a.id === 'hv_arc_crossroads').tokenIds.includes('tok_hv_maximus'));
  assert.ok(counts.docsAdded >= 1 && counts.docsUpdated >= 1 && counts.tokensAdded === 1);
  assert.equal(mergeModule({ ...old, fogOfWar: false }, file, 'hearts-in-the-void').fogOfWar, true, 'a room made with the fog off gets it back');
  store.normalizeCampaign({ ...structuredClone(old), handouts, tokens, arcs });
  assert.deepEqual(mergeModule({ ...old, fogOfWar: true, handouts, tokens, arcs }, file, 'hearts-in-the-void').counts, { docsAdded: 0, docsUpdated: 0, tokensAdded: 0, tokensUpdated: 0 }, 'a second run changes nothing');
});
