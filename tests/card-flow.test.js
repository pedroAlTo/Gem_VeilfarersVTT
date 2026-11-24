import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[key] = dom.window[key];
const { CREATOR_DATA: data } = await import('../src/creator/creatorData.js');
const { powerCard } = await import('../src/loadoutCards.js');
const { cardSummary, autoSummary, SUMMARIES } = await import('../src/cardSummaries.js');
const { cardStatus, quickPlan, cardChips } = await import('../src/cardFlow.js');
after(() => dom.window.close());

const card = name => powerCard(data.powers.find(p => p.n === name), 'loadout');
const hero = { id: 'h', name: 'Harker', proficiency: 2, level: 5, hope: 3, stress: { current: 0, max: 6 }, effectClocks: [] };

test('every Power of levels 1-3 has a hand-written one-line summary that fits on the card', () => {
  for (const power of data.powers.filter(p => p.l <= 3)) {
    assert.ok(SUMMARIES[power.n], power.n);
    assert.ok(cardSummary(card(power.n), hero).length <= 110, power.n);
  }
  assert.equal(cardSummary(card('Stellar Lance'), hero), 'Ataque a distancia · Presence DC 15 · Far · 2d8 Energy (Radiant) · Devastating contra Heavy');
  assert.equal(cardSummary(card('Photon Shield'), hero), 'Reacción · aliado Close dañado · −4 al daño (doble contra Veil-Touched)', 'Tier 2 + 2');
  // Any other card: built from its printed data.
  const high = powerCard(data.powers.find(p => p.l >= 6 && /\(Proficiency\)\s*[×x]\s*d\d+/i.test(p.txt)), 'loadout');
  assert.match(autoSummary(high, hero), /2d\d+ \w+/);
});

test('a card says its state, and one click knows what the card needs', () => {
  assert.deepEqual(cardStatus(card('Stellar Lance'), { ...hero, hope: 0 }), { cls: 'no', text: 'Falta 1 Hope' });
  assert.deepEqual(cardStatus(card('Kinetic Barrier'), { ...hero, effectClocks: [{ name: 'Kinetic Barrier' }] }), { cls: 'active', text: 'Activa · 10/10' });
  assert.deepEqual(cardStatus(card('Silver Tongue'), { ...hero, effectClocks: [{ name: 'Silver Tongue' }] }), { cls: 'ready', text: 'Preparada' });
  assert.deepEqual(cardStatus(card('Blinding Flash'), hero), { cls: 'react', text: 'Reacción' });
  assert.equal(cardStatus(card('Spark of Hope'), hero), null);
  assert.equal(quickPlan(card('Stellar Lance'), hero), 'aim');
  assert.equal(quickPlan(card('Blinding Flash'), hero), 'area');
  assert.equal(quickPlan(card('Kinetic Barrier'), hero), 'play');
  assert.equal(quickPlan(card('Drone Whisper'), hero), 'dialog', 'it asks which DC');
  assert.deepEqual(cardChips(card('Stellar Lance'), hero).map(([k]) => k), ['cost', 'reach', 'roll', 'dmg']);
});

test('a reaction offer lights up for the player who controls the reactor and their answer reaches the Keeper', async () => {
  const { store } = await import('../src/state.js');
  const { sendOffer, closeOffer, liveFor, answer, receiveOffer } = await import('../src/reactionOffers.js');
  store.state.tokens = [{ id: 'vea', name: 'Vea', isPlayer: true }, { id: 'other', name: 'Otro', isPlayer: true }];
  store.state.userRole = 'player';
  const answers = [];
  const offerId = sendOffer({ name: 'Force Shield', reactors: [{ id: 'vea', name: 'Vea' }], text: 'Void Horror impacta a Harker', cost: '1 Hope' }, a => answers.push(a));
  assert.ok(liveFor('vea', 'Force Shield'), 'lit on this screen');
  assert.equal(liveFor('other', 'Force Shield'), null);
  assert.ok(document.querySelector('.reaction-toast'));
  answer(offerId, 'vea', true);
  assert.deepEqual(answers, [{ reactorId: 'vea', use: true }]);
  assert.equal(liveFor('vea', 'Force Shield'), null, 'answered: no longer lit');
  assert.equal(document.querySelector('.reaction-toast'), null);
  // An offer for somebody else's character is not shown.
  receiveOffer({ offerId: 'x', name: 'Photon Shield', reactorIds: ['nobody'], text: '' });
  assert.equal(liveFor('nobody', 'Photon Shield'), null);
  closeOffer(offerId);
  store.state.userRole = 'keeper';
});

test('aiming a Power works like an attack: the dropped token is marked, a second touch casts, and the pointer carries the Domain emblem', async () => {
  const { store } = await import('../src/state.js');
  const { startAim, stopAim, domainEmblem, emblemNode } = await import('../src/cardFlow.js');
  assert.deepEqual(domainEmblem(card('Stellar Lance')), { src: '/assets/cards/domain-lux-flag.png', glow: '#fde047' });
  assert.equal(domainEmblem({ name: 'Second Wind', kind: 'effort' }), null);
  assert.ok(emblemNode(card('Kinetic Blast')).querySelector('img').src.endsWith('domain-kinetic-flag.png'));
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  const marks = [];
  window.veilCanvas = { canvas, screenToWorld: (x, y) => ({ x, y }), setAttackTarget: (a, b) => marks.push([a, b]), requestRender() {} };
  store.getActiveMap = () => ({ id: 'm', gridSize: 64, gridScaleMeters: 2 });
  store.state.tokens = [{ id: 'h', name: 'Harker', mapId: 'm', x: 64, y: 64, size: 1, isPlayer: true }, { id: 'e', name: 'Raider', mapId: 'm', x: 64 + 64 * 4, y: 64, size: 1, isPlayer: false, actorType: 'adversary' }];
  store.getTokensForActiveMap = () => store.state.tokens;
  let cast = null;
  startAim(card('Stellar Lance'), store.state.tokens[0], 'aim', ids => { cast = ids; }, { preselect: 'e' });
  assert.equal(window.veilCardAim.markedId, 'e', 'the token it was dropped on is marked');
  assert.deepEqual(marks.at(-1), ['h', 'e'], 'with the attack line');
  assert.match(document.getElementById('card_aim_banner').textContent, /toca otra vez el objetivo para lanzar/);
  assert.ok(document.querySelector('.card-emblem-cursor.aiming'));
  assert.equal(cast, null, 'nothing is cast yet');
  canvas.dispatchEvent(Object.assign(new Event('pointerdown'), { clientX: 320, clientY: 64, button: 0 }));
  assert.deepEqual(cast, ['e'], 'the second touch on it casts');
  assert.equal(window.veilCardAim, null);
  assert.deepEqual(marks.at(-1), [null, null]);
  assert.equal(document.querySelector('.card-emblem-cursor'), null);
  // A plain click first marks, then casts.
  cast = null;
  startAim(card('Stellar Lance'), store.state.tokens[0], 'aim', ids => { cast = ids; });
  const touch = () => canvas.dispatchEvent(Object.assign(new Event('pointerdown'), { clientX: 320, clientY: 64, button: 0 }));
  touch(); assert.equal(cast, null); assert.equal(window.veilCardAim.markedId, 'e');
  touch(); assert.deepEqual(cast, ['e']);
  stopAim();
});
