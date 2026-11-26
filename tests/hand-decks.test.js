// The hand in decks (v2.57.0, the user's idea): each card in one deck by what it is; a reaction
// usable now leaves its deck and waits on top, one click away.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deckOf, handDecks, HAND_DECKS } from '../src/cardFlow.js';

const card = (name, kind, extra = {}) => ({ id: name, name, kind, playable: true, ...extra });

test('each card goes to one deck: Bear Down · Moves, Domain Powers, Ancestry · Community · Augments, Class', () => {
  // v2.61.0, user request: «Bear Down moves (Sleeper), Poderes de dominio, Ancestry/Community/Augmentation (juntas) y Class».
  assert.deepEqual(HAND_DECKS.map(d => d[0]), ['moves', 'powers', 'origin', 'class']);
  assert.equal(deckOf(card('Bear Down', 'beardown')), 'moves');
  assert.equal(deckOf(card('Run It Down', 'move')), 'moves');
  assert.equal(deckOf(card('Uncanny Power', 'move', { uncanny: true })), 'moves', 'a Resolve Move of the Sleeping Mystic');
  assert.equal(deckOf(card('Steady Hands', 'effort')), 'moves');
  assert.equal(deckOf(card('Tactical Overwatch', 'power', { reaction: true })), 'powers', 'a reaction that cannot be used now stays with its kind');
  assert.equal(deckOf(card('Mind Spike', 'power')), 'powers');
  assert.equal(deckOf(card('Rapid Regeneration', 'archive')), 'powers');
  assert.equal(deckOf(card('Lucky Break', 'vault')), 'powers');
  assert.equal(deckOf(card('Aquatic Symbiote', 'ancestry')), 'origin');
  assert.equal(deckOf(card('Dock Rat', 'community')), 'origin');
  assert.equal(deckOf(card('Pain Suppressor', 'augment', { reaction: true })), 'origin');
  assert.equal(deckOf(card('Hope Feature', 'feature')), 'class');
});

test('a reaction usable now leaves its deck; empty decks are not shown; usable cards are counted', () => {
  const hand = [card('Tactical Overwatch', 'power', { reaction: true }), card('Neural Feedback', 'power', { reaction: true }), card('Mind Spike', 'power'), card('Precision Strike', 'power', { playable: false }), card('Bear Down', 'beardown')];
  const { live, decks } = handDecks(hand, { isLive: c => c.name === 'Tactical Overwatch', isUsable: c => c.playable });
  assert.deepEqual(live.map(c => c.name), ['Tactical Overwatch']);
  assert.deepEqual(decks.map(d => [d.id, d.cards.map(c => c.name), d.usable]), [['moves', ['Bear Down'], 1], ['powers', ['Neural Feedback', 'Mind Spike', 'Precision Strike'], 2]]);
  assert.deepEqual(handDecks([]).decks, []);
});

test('the deck catalog reads in the same four groups as the hand', async () => {
  const { loadCardData } = await import('../src/cardData.js');
  const { catalogGroups } = await import('../src/loadoutCards.js');
  const g = catalogGroups(await loadCardData());
  // Bear Down and the Common Efforts first, then the Resolve Moves of each Sleeping class.
  assert.equal(g.moves[0].cards[0].name, 'Bear Down');
  assert.ok(g.moves[0].cards.slice(1).every(c => c.kind === 'effort'));
  assert.ok(g.moves.slice(1).every(group => /^Resolve Moves · /.test(group.group) && group.cards.every(c => c.kind === 'move')));
  // The class features apart from the moves.
  assert.ok(g.sleeping.every(group => group.cards.every(c => c.kind === 'feature')));
  // The augmentations played as cards, with Ancestry and Community.
  assert.ok(g.augments[0].cards.length >= 2 && g.augments[0].cards.every(c => c.kind === 'augment' && c.playable === false));
  const ids = Object.values(g).flat().flatMap(group => group.cards.map(c => c.id));
  assert.equal(new Set(ids).size, ids.length, 'every catalog card has its own id');
});
