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
