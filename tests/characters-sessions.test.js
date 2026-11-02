import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseCharacterJSON, initializeImportedResources, characterDetails, characterKey, exportSystemCharacter, exportNativeCharacter, TRAIT_IDS } from '../src/characterImport.js';
import { createActor, replaceActorSheet } from '../src/actors.js';
import { readCampaign, writeCampaign, listCampaigns } from '../src/persistence.js';

const fixture = () => ({
  app: 'Veilfarers Character Sheet', version: '2.80-RC3.2', exportedAt: 'original',
  future: { preserved: true },
  fields: { name: 'Test Scholar', chosen_path: 'Awakened', ancestry: 'Synthetic', class: 'Scholar', subclass: 'Archaeologist', community: 'Station', level: '1', prof: '1', evasion: '10', thr_major: '5', thr_severe: '11', armor_thr: '4 / 10', s_honed: 'HONED EDGE +0 DAMAGE',
    ...Object.fromEntries(TRAIT_IDS.map((k, i) => [`tr_${k}`, String([-1, 0, 1, 2, 1, 0][i])])),
    base_tr_knowledge: '0', a_exp_0: 'Pattern hunter', a_exp_0_bonus: '+2', a_exp_1: '', a_exp_1_bonus: '+2', s_exp_0: 'Inactive experience', s_exp_0_bonus: '+2',
    wpri_name: 'Net Launcher', wpri_dmg: 'n/a', wpri_dmg_final_aw: 'n/a', wsec_name: 'Laser Rifle', wsec_dmg: 'd8 ene.', a_featname: 'Eureka', a_feattext: 'Hope feature', s_featname: 'Inactive', s_feattext: 'Effort feature', unknown_future_field: 'Keep this',
  },
  tracks: { max: { hp: 5, armor_slots: 3, stress: 6, s_resolve: 2 }, current: {} },
});

test('final Traits and thresholds are imported once; ancestry never rewrites Stress', () => {
  const { token, missing } = parseCharacterJSON(fixture());
  assert.equal(token.traits.knowledge, 2); assert.equal(token.traits.agility, -1);
  assert.deepEqual(token.hp, { current: 5, max: 5, majorThreshold: 5, severeThreshold: 11 });
  assert.equal(token.stress.max, 6); assert.deepEqual(missing.map(x => x.key), ['hp', 'armor_slots', 'stress', 'a_hope']);
  assert.throws(() => initializeImportedResources(parseCharacterJSON(fixture()), {}));
  const initialized = initializeImportedResources(parseCharacterJSON(fixture()), { hp: 4, armor_slots: 2, stress: 1, a_hope: 2 });
  assert.equal(initialized.hp.current, 4); assert.equal(initialized.hope, 2);
});
test('current resource zeros survive import and no-damage weapons stay no-damage', () => {
  const f = fixture(); f.tracks.current = { hp: 0, stress: 0, armor_slots: 0, a_hope: 0, s_effort: 0, s_resolve: 0 };
  const p = parseCharacterJSON(f); assert.equal(p.missing.length, 0); assert.equal(p.token.hp.current, 0);
  assert.equal(characterDetails(p.token).weapons[0].damage, 'n/a');
});
test('only active Path experiences and features are shown, empty experience slots are not invented', () => {
  const token = parseCharacterJSON(fixture()).token, d = characterDetails(token);
  assert.deepEqual(d.experiences, [{ name: 'Pattern hunter', bonus: '+2' }]);
  assert.ok(d.features.some(([k]) => k === 'Eureka')); assert.ok(!d.features.some(([k]) => k === 'Inactive'));
  token.path = 'Sleeping'; assert.equal(characterDetails(token).experiences[0].name, 'Inactive experience');
});
test('creator export preserves unrecognized fields and updates edited current/final stats', () => {
  const original = fixture(), token = parseCharacterJSON(original).token;
  token.hp.current = 2; token.traits.strength = 3; token.hope = 4;
  const exported = exportSystemCharacter(token), reimport = parseCharacterJSON(exported);
  assert.deepEqual(exported.future, original.future); assert.equal(exported.fields.unknown_future_field, 'Keep this');
  assert.equal(exported.fields.s_exp_0, 'Inactive experience'); assert.equal(exported.fields.base_tr_knowledge, '0');
  assert.equal(reimport.token.hp.current, 2); assert.equal(reimport.token.traits.strength, 3); assert.equal(reimport.token.hope, 4);
  assert.equal(original.tracks.current.hp, undefined);
});
test('duplicate matching ignores export timestamp, uses source ID when supplied', () => {
  const a = fixture(), b = fixture(); b.exportedAt = 'later';
  assert.equal(characterKey(parseCharacterJSON(a).token), characterKey(parseCharacterJSON(b).token));
  a.fields.character_id = 'VF-23'; b.fields.character_id = 'VF-23'; b.fields.name = 'Renamed';
  assert.equal(characterKey(parseCharacterJSON(a).token), characterKey(parseCharacterJSON(b).token));
});
test('bad schemas, invalid numbers and inverted thresholds fail before a token exists', () => {
  for (const mutate of [f => { f.fields.tr_agility = 'n/a'; }, f => { f.tracks.current.hp = 500; }, f => { f.fields.thr_major = 99; }, f => { f.fields.chosen_path = 'Other'; }]) {
    const f = fixture(); mutate(f); assert.throws(() => parseCharacterJSON(f));
  }
  assert.throws(() => parseCharacterJSON('{broken')); assert.throws(() => parseCharacterJSON({ app: 'Other' }));
});
test('actor creation honors supplied stats and coordinates zero; batch IDs are unique', () => {
  const imported = parseCharacterJSON(fixture()).token;
  const a = createActor({ ...imported, x: 0, y: 0 }, 'm'), b = createActor(imported, 'm');
  assert.equal(a.x, 0); assert.equal(a.y, 0); assert.notEqual(a.id, b.id); assert.equal(a.hp.max, 5);
});
test('reimport preserves token placement, portrait, visibility and tactical overlays', () => {
  const old = createActor({ ...parseCharacterJSON(fixture()).token, x: 0, y: 42, hidden: true, avatarUrl: 'portrait.png', displayOverlays: [{ statKey: 'hp' }] }, 'other-map');
  const next = parseCharacterJSON(fixture()).token; next.hp.max = 8;
  const result = replaceActorSheet(old, next);
  for (const k of ['id', 'mapId', 'x', 'y', 'hidden', 'avatarUrl', 'displayOverlays']) assert.deepEqual(result[k], old[k]);
  assert.equal(result.hp.max, 8);
});
test('native adversary export/import preserves real combat fields without PC Path inference', () => {
  const token = createActor({ actorType: 'adversary', isPlayer: false, attackModifier: 3, evasion: 13, damageExpression: '1d8+1 Phys + 1d4 Shock', hp: { current: 12, max: 12, majorThreshold: 10, severeThreshold: 18 }, featureNotes: 'Overclock' }, 'm');
  const result = createActor(parseCharacterJSON(exportNativeCharacter(token)).token, 'new-map');
  assert.equal(result.path, ''); assert.equal(result.attackModifier, 3); assert.equal(result.hp.max, 12); assert.equal(result.damageExpression, token.damageExpression); assert.notEqual(result.id, token.id);
});

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost' });
for (const k of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[k] = dom.window[k];
const { store } = await import('../src/state.js'); await store.ready;
const { openDossier } = await import('../src/dossierUI.js');
const { TokenHUD } = await import('../src/tokenSheet.js');
const { DiceRollerSidebar } = await import('../src/diceRoller.js');
const { performGameAction } = await import('../src/gameActions.js');
const original = structuredClone(store.state);
beforeEach(async () => {
  await store.saveQueue.catch(() => {}); localStorage.clear(); document.body.replaceChildren();
  store.state = structuredClone(original); store.listeners.clear(); store.sessionRole = 'local'; store.storageReadFailed = false; store.sessionBusy = false;
  localStorage.setItem('veilvtt.activeCampaign', store.state.campaignId);
});
after(async () => { await store.saveQueue.catch(() => {}); dom.window.close(); });

test('multi-actor import is atomic and a duplicate update cannot overwrite silently', () => {
  const before = structuredClone(store.state.tokens), good = parseCharacterJSON(fixture()).token;
  assert.throws(() => store.importActors([{ token: good }, { token: { ...good, hp: { current: 5, max: 1 } } }]));
  assert.deepEqual(store.state.tokens, before);
  assert.throws(() => store.importActors([{ token: good, updateId: before[0].id }, { token: good, updateId: before[0].id }]));
  assert.deepEqual(store.state.tokens, before);
  store.importActors([{ token: good }]); assert.equal(store.state.tokens.at(-1).hp.max, 5);
});
test('saved sessions isolate maps, actors, logs, clocks and ship state; reload opens the selected identity', async () => {
  store.state.logs = [{ title: 'Preserve log' }]; store.state.clocks[0].position = { x: 0, y: 55 }; store.state.starship.pearls = 0;
  await store.saveToStorage(); await store.saveQueue;
  const id = store.state.campaignId, before = store.serializeCampaign();
  await store.createSession('Empty'); const emptyId = store.state.campaignId;
  assert.notEqual(emptyId, id); assert.equal(store.state.tokens.length, 0); assert.equal(store.state.logs.length, 0); assert.equal(store.state.maps.length, 1);
  assert.notEqual(store.state.maps[0].id, before.maps[0].id);
  await store.openSession(id);
  for (const key of ['maps', 'tokens', 'clocks', 'logs', 'starship']) assert.deepEqual(store.state[key], before[key]);
  const reloaded = new store.constructor(); await reloaded.ready;
  assert.equal(reloaded.state.campaignId, id); assert.equal(reloaded.state.logs[0].title, 'Preserve log');
  assert.equal((await listCampaigns()).length, 2);
});
test('duplicate and rename retain independent identities and export/import creates another copy', async () => {
  await store.saveToStorage(); const first = store.state.campaignId;
  await store.createSession('Copy', true); const copy = store.state.campaignId;
  assert.notEqual(first, copy); assert.equal(store.state.tokens.length, original.tokens.length);
  await store.renameSession('Renamed'); assert.equal(store.state.campaignId, copy);
  assert.equal((await readCampaign(copy)).campaignName, 'Renamed');
  assert.equal(await store.importCampaignJSON(JSON.stringify(store.serializeCampaign())), true);
  assert.notEqual(store.state.campaignId, copy); assert.equal((await listCampaigns()).length, 3);
});
test('failed save blocks a session switch and retains current actor data and active ID', async () => {
  const proto = Object.getPrototypeOf(localStorage), set = proto.setItem;
  const id = store.state.campaignId, before = structuredClone(store.state.tokens);
  proto.setItem = () => { throw new Error('Quota exceeded'); };
  try { await assert.rejects(store.createSession('Must not open'), /Quota/); }
  finally { proto.setItem = set; }
  assert.equal(store.state.campaignId, id); assert.deepEqual(store.state.tokens, before); assert.equal(store.sessionBusy, false);
});
test('unknown saved ID does not inherit the legacy campaign; malformed archive does not replace active', async () => {
  localStorage.setItem('veilvtt_campaign_data_v1207', JSON.stringify(store.serializeCampaign()));
  assert.equal(await readCampaign('missing'), null);
  const id = store.state.campaignId;
  assert.equal(await store.importCampaignJSON(JSON.stringify(fixture())), false); assert.equal(store.state.campaignId, id);
  await writeCampaign('bad', { ...store.serializeCampaign(), maps: null });
  await assert.rejects(store.openSession('bad')); assert.equal(store.state.campaignId, id);
});
test('ficha renders active references safely, saves Evasion and keeps Resolve maximum independent', () => {
  const token = createActor(parseCharacterJSON(fixture()).token, store.state.activeMapId);
  token.name = '<img src=x onerror=alert(1)>'; token.path = 'Sleeping'; token.resolve.current = 1;
  store.state.tokens.push(token);
  const modal = openDossier(token, () => {});
  assert.equal(modal.querySelectorAll('.dossier-hero img').length, 0);
  assert.equal(modal.querySelector('[name=resolve_max]').value, '2');
  modal.querySelector('[name=evasion]').value = '14';
  modal.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const saved = store.state.tokens.find(t => t.id === token.id);
  assert.equal(saved.evasion, 14); assert.equal(saved.resolve.max, 2); assert.equal(saved.resolve.current, 1);
});
test('NPC quickbar shows Evasion and attack instead of Hope/Effort', () => {
  const token = store.addToken({ actorType: 'adversary', isPlayer: false, evasion: 13, attackModifier: 3 });
  store.state.selectedTokenId = token.id;
  const root = document.createElement('div'); document.body.append(root); const hud = new TokenHUD(root);
  assert.match(root.textContent, /EVASION 13/); assert.doesNotMatch(root.textContent, /HOPE|EFFORT/);
  hud.isExpanded = true; hud.render(); assert.doesNotMatch(root.textContent, /BURNOUT|BEAR DOWN/);
});
test('NPC checks use the imported attack modifier, not a PC Trait', () => {
  const token = store.addToken({ actorType: 'adversary', isPlayer: false, attackModifier: 3, traits: { agility: -1 } });
  const result = performGameAction({ type: 'CHECK', actorId: token.id, options: { traitId: 'agility', dc: 15 } });
  assert.equal(result.traitMod, 3); assert.equal(result.traitName, 'Attack');
});
test('dice actor and experiences reset when switching into an empty session', async () => {
  const token = store.addToken(parseCharacterJSON(fixture()).token); store.state.selectedTokenId = token.id;
  const root = document.createElement('div'); document.body.append(root); new DiceRollerSidebar(root);
  const select = root.querySelector('#dice_experience_select'); select.value = '0'; select.onchange();
  assert.equal(root.querySelector('#dice_exp_mod').value, '2');
  await store.createSession('No stale actor');
  assert.equal(root.querySelector('#dice_actor_name').textContent, 'Selecciona un actor');
  assert.equal(root.querySelector('#roll_check_btn').disabled, true);
  assert.equal(root.querySelector('#dice_exp_mod').value, '0');
});
