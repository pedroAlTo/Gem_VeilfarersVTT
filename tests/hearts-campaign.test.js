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
