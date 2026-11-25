// The hand in decks (v2.57.0, the user's idea): each card in one deck by what it is; a reaction
// usable now leaves its deck and waits on top, one click away.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deckOf, handDecks, HAND_DECKS } from '../src/cardFlow.js';

const card = (name, kind, extra = {}) => ({ id: name, name, kind, playable: true, ...extra });

test('each card goes to one deck: reactions, Powers, Moves or traits', () => {
  assert.deepEqual(HAND_DECKS.map(d => d[0]), ['reactions', 'powers', 'moves', 'traits']);
  assert.equal(deckOf(card('Tactical Overwatch', 'power', { reaction: true })), 'reactions', 'a reaction Power is a reaction first');
  assert.equal(deckOf(card('Lucky Break', 'effort')), 'reactions');
  assert.equal(deckOf(card('Bear Down', 'beardown')), 'reactions');
  assert.equal(deckOf(card('Mind Spike', 'power')), 'powers');
  assert.equal(deckOf(card('Rapid Regeneration', 'archive')), 'powers');
  assert.equal(deckOf(card('Uncanny Power', 'move', { uncanny: true })), 'powers');
  assert.equal(deckOf(card('Run It Down', 'move')), 'moves');
  assert.equal(deckOf(card('Aquatic Symbiote', 'ancestry')), 'traits');
  assert.equal(deckOf(card('Hope Feature', 'feature')), 'traits');
});

test('a reaction usable now leaves its deck; empty decks are not shown; usable cards are counted', () => {
  const hand = [card('Tactical Overwatch', 'power', { reaction: true }), card('Neural Feedback', 'power', { reaction: true }), card('Mind Spike', 'power'), card('Precision Strike', 'power', { playable: false })];
  const { live, decks } = handDecks(hand, { isLive: c => c.name === 'Tactical Overwatch', isUsable: c => c.playable });
  assert.deepEqual(live.map(c => c.name), ['Tactical Overwatch']);
  assert.deepEqual(decks.map(d => [d.id, d.cards.map(c => c.name), d.usable]), [['reactions', ['Neural Feedback'], 1], ['powers', ['Mind Spike', 'Precision Strike'], 1]]);
  assert.deepEqual(handDecks([]).decks, []);
});
