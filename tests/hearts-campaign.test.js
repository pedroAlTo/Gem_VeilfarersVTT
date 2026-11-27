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
