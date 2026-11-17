import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATOR_DATA as data } from '../src/creator/creatorData.js';
import { freshState, setChoice, characterDomains, levelOnePowers, powerId, subclassList, equipmentChoices, buildSheetDocument } from '../src/creator/creatorModel.js';
import { parseCharacterJSON } from '../src/characterImport.js';
import { parseCost, parseRoll, costLabel, characterCards, playCard, recallPower, recallCost, loadoutNames, vaultNames, archivePackages, isSleepingMystic } from '../src/loadoutCards.js';

function character({ path = 'Awakened', cls = 'scholar', ancestry = 'synthetic', mystic = null } = {}) {
  let s = freshState();
  for (const [k, v] of [['ancestry', ancestry], ['community', data.communities[0].id], ['path', path], ['cls', cls]]) s = setChoice(s, k, v);
  s = setChoice(s, 'subclass', subclassList(s, data)[0].name);
  s.traits = { agility: 0, strength: -1, finesse: 1, instinct: 1, presence: 0, knowledge: 2 };
  s.experiences = ['Pattern hunter', 'Dock rat', 'Archive diver']; s = setChoice(s, 'affiliation', data.affiliations[0].id);
  if (mystic) s.sleepingMysticDomains = mystic;
  if (path === 'Awakened') { const [a, b] = characterDomains(s, data); s.powers = [powerId(levelOnePowers(data, a)[0]), powerId(levelOnePowers(data, b)[0])]; }
  s.weapons = [equipmentChoices(s, data, 'weapon')[0].name]; s.armors = [equipmentChoices(s, data, 'armor')[0].name]; s.name = 'Maren Solas'; s.anchor = 'A worn star chart';
  return parseCharacterJSON(buildSheetDocument(s, data)).token;
}
const fields = token => token.sourceCharacter.document.fields;

test('printed costs and rolls are read as numbers', () => {
  assert.deepEqual(parseCost('2 Hope + 1 Stress'), { hope: 2, stress: 1, effort: 0, resolve: 0, hp: 0, open: false });
  assert.deepEqual([parseCost('THE READING (2 EFFORT)').effort, parseCost('Combat Surge (2 Hope)').hope, parseCost('—').open, parseCost('Variable').open, parseCost('5 Hope + 5 Stress to begin').open], [2, 2, false, true, true]);
  assert.deepEqual([parseCost('spend 2', 'move').resolve, parseCost('spend and roll 1+', 'move').open, parseCost('spend and roll 1', 'move').rolls], [2, true, true]);
  assert.deepEqual(parseRoll('DC 15 (Knowledge)'), { dc: 15, traitId: 'knowledge' }); assert.equal(parseRoll('—'), null);
  assert.equal(costLabel(parseCost('3 Hope + 2 Stress')), '3 Hope + 2 Stress'); assert.equal(costLabel(parseCost('—')), 'Sin coste');
});

test('an Awakened hand holds its Loadout Powers, the Hope Feature, the Ancestry and the Background, then the Vault', () => {
  const token = character();
  fields(token).a_vault = 'Tech · L1 · ' + data.powers.find(p => p.d === 'Tech' && p.l === 1 && !loadoutNames(token).includes(p.n)).n;
  const cards = characterCards(token, data);
  assert.deepEqual(cards.map(c => c.kind), ['power', 'power', 'feature', 'ancestry', 'community', 'vault']);
  const [first] = cards, printed = data.powers.find(p => p.n === first.name);
  assert.deepEqual([first.costText, first.rc, first.domain, first.level], [printed.cost, Number(printed.rc), printed.d, 1]);
  assert.equal(cards[2].cost.hope, 3, 'Eureka Moment (3 Hope)'); assert.equal(cards[3].name, 'Modular Consciousness', 'the Gift that is used, not the passive one'); assert.match(cards[4].subtitle, /^Background · /);
  assert.equal(cards.at(-1).playable, false, 'a Vault card must be Recalled first');
  assert.deepEqual(characterCards({ isPlayer: false }, data), []);
});

test('a Sleeping hand holds its Resolve Moves and Effort Feature; a Sleeping Mystic holds the Powers of its Archive', () => {
  const soldier = character({ path: 'Sleeping', cls: 'soldier', ancestry: 'kryx' });
  const cards = characterCards(soldier, data), moves = cards.filter(c => c.kind === 'move');
  assert.ok(moves.length >= 2); assert.ok(moves.every(m => m.cost.resolve >= 1));
  assert.equal(cards.find(c => c.kind === 'feature').cost.effort, 1, 'THE HELD LINE (1 EFFORT)');
  assert.equal(cards.some(c => c.kind === 'power' || c.kind === 'vault'), false);
  const mystic = character({ path: 'Sleeping', cls: 'mystic', mystic: ['Lux', 'Neural'] });
  assert.equal(isSleepingMystic(mystic), true); assert.deepEqual(archivePackages(mystic), [['Lux', 1], ['Neural', 1]]);
  const archive = characterCards(mystic, data).filter(c => c.kind === 'archive');
  assert.equal(archive.length, 6, 'every Level 1 Power of both studied Domains');
  assert.ok(archive.filter(c => c.reaction).every(c => !c.playable), 'Uncanny Power cannot reproduce a Reaction');
});

test('playing a card pays its printed cost and names the Spellcast roll; without the resources it is refused', () => {
  const token = { ...character(), hope: 2, stress: { current: 0, max: 6 } };
  const card = characterCards(token, data).find(c => c.kind === 'power' && c.cost.hope === 1 && c.roll);
  const played = playCard(token, card);
  assert.equal(played.token.hope, 1); assert.deepEqual(played.roll, card.roll); assert.equal(token.hope, 2, 'the source is not touched');
  assert.throws(() => playCard({ ...token, hope: 0 }, card), /No hay Hope suficiente: hacen falta 1 y quedan 0/);
  const stressCard = { ...card, cost: parseCost('1 Stress') };
  assert.equal(playCard(token, stressCard).token.stress.current, 1);
  assert.throws(() => playCard({ ...token, stress: { current: 6, max: 6 } }, stressCard), /Overwhelmed/);
  assert.throws(() => playCard(token, { ...card, playable: false, zone: 'vault' }), /Recall/);
  // The Hope Feature costs 3 Hope.
  assert.throws(() => playCard(token, characterCards(token, data).find(c => c.kind === 'feature')), /hacen falta 3/);
});

test('a Resolve Move spends Resolve and rolls its dice; the Effort Feature spends Effort', () => {
  const soldier = { ...character({ path: 'Sleeping', cls: 'soldier', ancestry: 'kryx' }), effort: 2, resolve: { current: 2, max: 2, dieType: 'd4' } };
  const cards = characterCards(soldier, data), move = cards.find(c => c.kind === 'move');
  const played = playCard(soldier, move, { resolveSpent: 2, random: () => 0.5 });
  assert.ok(played.token.resolve.current < 2);
  assert.throws(() => playCard({ ...soldier, resolve: { current: 0, max: 2, dieType: 'd4' } }, move), /No hay Resolve suficiente/);
  assert.equal(playCard(soldier, cards.find(c => c.kind === 'feature')).token.effort, 1);
});

test('Uncanny Power: Resolve Dice + Knowledge give the level reached, the Keeper gains Fear, and the roll is Knowledge vs 10 + level', () => {
  const mystic = { ...character({ path: 'Sleeping', cls: 'mystic', mystic: ['Lux', 'Neural'] }), level: 1, resolve: { current: 2, max: 2, dieType: 'd4' } };
  const card = characterCards(mystic, data).find(c => c.kind === 'archive' && c.playable);
  const played = playCard(mystic, card, { resolveSpent: 2, random: () => 0.5 });
  assert.equal(played.token.resolve.current, 0); assert.equal(played.fear, 2);
  assert.deepEqual(played.roll, { dc: 11, traitId: 'knowledge' }); assert.equal(played.token.hope ?? 0, mystic.hope ?? 0, 'the Hope cost is ignored');
  assert.match(played.notes.join(' '), /nivel accesible 1/);
  // A Power above the level reached does not manifest and the Resolve stays spent.
  const tooHigh = playCard(mystic, { ...card, level: 2 }, { resolveSpent: 1, random: () => 0 });
  assert.equal(tooHigh.failed, true); assert.equal(tooHigh.token.resolve.current, 1); assert.equal(tooHigh.fear, 1);
  assert.throws(() => playCard({ ...mystic, resolve: { current: 0, max: 2, dieType: 'd4' } }, card), /No hay Resolve/);
});

test('Recall moves a Power from the Vault to the Loadout: free in a Long Rest, its Recall Cost in Stress in a Short Rest, plus 1 Hope in a scene', () => {
  const token = { ...character(), hope: 2, stress: { current: 0, max: 6 } };
  const spare = data.powers.find(p => p.l === 1 && Number(p.rc) === 1 && !loadoutNames(token).includes(p.n));
  fields(token).a_vault = `${spare.d} · L1 · ${spare.n}`;
  assert.deepEqual([recallCost({ rc: 2 }, 'long'), recallCost({ rc: 2 }, 'short'), recallCost({ rc: 2 }, 'scene')], [{ stress: 0, hope: 0, action: false }, { stress: 2, hope: 0, action: false }, { stress: 2, hope: 1, action: true }]);
  const rested = recallPower(token, data, spare.n, { mode: 'long' });
  assert.deepEqual([loadoutNames(rested.token).length, vaultNames(rested.token).length, rested.token.hope, rested.token.stress.current], [3, 0, 2, 0]);
  assert.match(fields(rested.token).a_pwr_2_d, new RegExp('^' + spare.d + ' · L1'));
  const inScene = recallPower(token, data, spare.n, { mode: 'scene' });
  assert.deepEqual([inScene.token.hope, inScene.token.stress.current], [1, 1]);
  assert.throws(() => recallPower({ ...token, hope: 0 }, data, spare.n, { mode: 'scene' }), /No hay Hope suficiente/);
  assert.throws(() => recallPower(token, data, 'Not owned'), /no está en el Vault/);
  // A full Loadout needs a Power to leave for the Vault.
  fields(token).a_loadout_cap = '2';
  assert.throws(() => recallPower(token, data, spare.n, { mode: 'long' }), /Loadout está lleno \(2 Poderes\)/);
  const leaving = loadoutNames(token)[0], swapped = recallPower(token, data, spare.n, { mode: 'short', replace: leaving });
  assert.deepEqual(loadoutNames(swapped.token).sort(), [loadoutNames(token)[1], spare.n].sort()); assert.deepEqual(vaultNames(swapped.token), [leaving]);
  assert.equal(swapped.token.stress.current, 1);
  assert.throws(() => recallPower(character({ path: 'Sleeping', cls: 'soldier', ancestry: 'kryx' }), data, 'x'), /no tienen Vault/);
});

test('the table resolves a played card and a Recall: costs are paid on the Keeper side, Fear included', async () => {
  const { performGameAction } = await import('../src/gameActions.js');
  const { setCardData } = await import('../src/cardData.js');
  const fakeStore = token => { const store = { sessionRole: 'local', state: { userRole: 'keeper', campaignId: 'c', tokens: [token], fear: 0 }, logs: [], updateToken(id, patch) { Object.assign(store.state.tokens.find(t => t.id === id), patch); }, addFear(n) { store.state.fear += n; }, addLog(entry) { store.logs.push(entry); } }; return store; };
  const hero = { ...character(), id: 'tok_hero', hope: 2, stress: { current: 0, max: 6 } };
  const store = fakeStore(hero);
  setCardData(null);
  assert.throws(() => performGameAction({ type: 'CARD_PLAY', actorId: 'tok_hero', cardId: 'x' }, store), /aún se están cargando/);
  setCardData(data);
  const card = characterCards(hero, data).find(c => c.kind === 'power' && c.cost.hope === 1);
  const played = performGameAction({ type: 'CARD_PLAY', actorId: 'tok_hero', cardId: card.id }, store);
  assert.equal(store.state.tokens[0].hope, 1); assert.equal(played.card.name, card.name); assert.match(played.outcomeTitle, /PODER · 1 HOPE/);
  assert.equal(store.logs.at(-1).type, 'CARD');
  assert.throws(() => performGameAction({ type: 'CARD_PLAY', actorId: 'tok_hero', cardId: 'loadout:nope' }, store), /ya no está en la mano/);
  const spare = data.powers.find(p => p.l === 1 && !loadoutNames(hero).includes(p.n));
  fields(store.state.tokens[0]).a_vault = `${spare.d} · L1 · ${spare.n}`;
  const recalled = performGameAction({ type: 'CARD_RECALL', actorId: 'tok_hero', name: spare.n, mode: 'long' }, store);
  assert.equal(recalled.entered, spare.n); assert.ok(loadoutNames(store.state.tokens[0]).includes(spare.n));
  // Uncanny Power gives the Keeper its Fear.
  const mystic = { ...character({ path: 'Sleeping', cls: 'mystic', mystic: ['Lux', 'Neural'] }), id: 'tok_mystic', resolve: { current: 2, max: 2, dieType: 'd4' } };
  const second = fakeStore(mystic), archive = characterCards(mystic, data).find(c => c.kind === 'archive' && c.playable);
  performGameAction({ type: 'CARD_PLAY', actorId: 'tok_mystic', cardId: archive.id, resolveSpent: 2 }, second);
  assert.deepEqual([second.state.fear, second.state.tokens[0].resolve.current], [2, 0]);
  assert.throws(() => performGameAction({ type: 'CARD_PLAY', actorId: 'tok_adv', cardId: 'x' }, fakeStore({ id: 'tok_adv', name: 'Pirata', isPlayer: false })), /Solo los personajes jugadores/);
});

test('every card has its art: a Domain or Class flag and band, or the Ancestry and Background corner band', async () => {
  const { existsSync } = await import('node:fs');
  const { domainArt, classArt, cornerArt, DOMAIN_COLORS } = await import('../src/loadoutCards.js');
  const onDisk = path => existsSync(new URL('../public' + path, import.meta.url));
  for (const domain of Object.keys(DOMAIN_COLORS)) { const art = domainArt(domain); assert.ok(onDisk(art.flag) && onDisk(art.band), domain); }
  for (const cls of data.classes) { const art = classArt(cls); assert.ok(art.flag && onDisk(art.flag) && onDisk(art.band), cls.id); }
  for (const kind of ['ancestry', 'community']) { const art = cornerArt(kind); assert.equal(art.layout, 'corner'); assert.ok(onDisk(art.band), kind); }
  assert.equal(domainArt('Unknown').flag, ''); assert.ok(onDisk(domainArt('Unknown').band));
  const hero = character(), cards = characterCards(hero, data);
  assert.ok(cards.every(c => c.art && onDisk(c.art.band)), 'no card is left without art');
  assert.match(cards.find(c => c.kind === 'power').art.flag, /domain-[a-z]+-flag\.png$/);
  assert.match(cards.find(c => c.kind === 'feature').art.flag, /class-scholar-flag\.png$/);
});

test('ancestry cards are the Gifts that are used; passive Gifts stay on the sheet', async () => {
  const { usableGift, giftCost, giftLimit } = await import('../src/loadoutCards.js');
  const gifts = name => data.ancestries.find(a => a.name === name).gifts;
  const used = name => gifts(name).filter(usableGift).map(g => g.name);
  assert.deepEqual(used('Ailuran'), [], 'Aura-Sight and Perfect Equilibrium are always on');
  assert.deepEqual(used('Synthetic'), ['Modular Consciousness']);
  assert.deepEqual(used('Human'), ['Adaptive Spirit', 'Cultural Bridge']);
  assert.deepEqual(used('Rift Spinner'), ['Chrono-Gift']);
  assert.deepEqual(used('Ethereal'), ['Phase Shift', 'Temporal Perception']);
  assert.deepEqual(used('Bloomstrider'), ['Nurturing Touch']);
  const gift = (ancestry, name) => gifts(ancestry).find(g => g.name === name);
  assert.deepEqual([giftCost(gift('Ethereal', 'Phase Shift')).stress, giftCost(gift('Human', 'Adaptive Spirit')).hope], [1, 2]);
  // "2 path resources" is Hope for the Awakened and Effort for the Sleeping.
  assert.deepEqual([giftCost(gift('Rift Spinner', 'Chrono-Gift')).hope, giftCost(gift('Rift Spinner', 'Chrono-Gift'), true).effort, giftCost(gift('Rift Spinner', 'Chrono-Gift'), true).hope], [2, 2, 0]);
  // What a Gift gives back is not a price: Stellar Meditation clears Stress and grants Hope.
  const meditation = giftCost(gift('Celestiari', 'Stellar Meditation'));
  assert.deepEqual([meditation.stress, meditation.hope, meditation.effort], [0, 0, 0]);
  assert.equal(giftLimit(gift('Celestiari', 'Stellar Meditation')), '1 / long rest'); assert.equal(giftLimit(gift('Human', 'Adaptive Spirit')), '1 / session');
  const kryx = characterCards(character({ ancestry: 'kryx' }), data).filter(c => c.kind === 'ancestry');
  assert.deepEqual(kryx.map(c => [c.name, c.cost.stress, c.playable]), [['Pack Intuition', 1, true], ['Biolume Howl', 1, true]]);
  assert.equal(characterCards({ ...character(), species: 'Ailuran' }, data).some(c => c.kind === 'ancestry'), false, 'an ancestry with only passive Gifts adds no card');
});

test('the table announces a used card so the Keeper can see it', async () => {
  const { performGameAction } = await import('../src/gameActions.js');
  const { setCardData } = await import('../src/cardData.js');
  const heard = [];
  globalThis.window = { dispatchEvent: event => heard.push(event.detail) };
  globalThis.CustomEvent ||= class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  try {
    setCardData(data);
    const hero = { ...character(), id: 'tok_hero', name: 'Maren Solas', hope: 2, stress: { current: 0, max: 6 } };
    const store = { sessionRole: 'local', state: { userRole: 'keeper', campaignId: 'c', tokens: [hero], fear: 0 }, updateToken(id, patch) { Object.assign(hero, patch); }, addFear() {}, addLog() {} };
    const card = characterCards(hero, data).find(c => c.kind === 'power' && c.cost.hope === 1);
    performGameAction({ type: 'CARD_PLAY', actorId: 'tok_hero', cardId: card.id, playerName: 'Lucía' }, store);
    assert.equal(heard.length, 1);
    assert.deepEqual([heard[0].actorName, heard[0].playerName, heard[0].card.name, heard[0].failed], ['Maren Solas', 'Lucía', card.name, false]);
    assert.ok(heard[0].card.text.length > 20 && heard[0].card.art.band, 'the whole card travels: text and art');
  } finally { delete globalThis.window; }
});

test('older tokens without class or ancestry fields get them from their role text', async () => {
  const { classOf, ancestryOf } = await import('../src/loadoutCards.js');
  const vea = { isPlayer: true, path: 'Awakened', name: 'Vea Kaelen', roleTag: 'Ace Pilot // Awakened Starchaser' };
  const he09 = { isPlayer: true, path: 'Sleeping', name: 'Unit HE-09', roleTag: 'Heavy Engineer // Sleeping Synthetic' };
  const harker = { isPlayer: true, path: 'Awakened', name: 'Capt. Jonathan Harker', roleTag: 'Captain // Awakened Voidwalker' };
  assert.deepEqual([classOf(vea, data)?.id, classOf(he09, data)?.id, ancestryOf(he09, data)?.name, classOf(harker, data)], ['pilot', 'engineer', 'Synthetic', null]);
  assert.equal(classOf({ characterClass: 'Soldier', roleTag: 'Ace Pilot' }, data).id, 'soldier', 'the sheet field wins over the free text');
  assert.equal(classOf({ roleTag: 'Copilot of the Vagrant' }, data), null, 'whole words only');
  assert.deepEqual(characterCards(he09, data).map(c => c.kind), ['move', 'move', 'feature', 'ancestry']);
  assert.deepEqual(characterCards(harker, data), []);
});

test('the table pays a played card even while its own screen previews the Player view', async () => {
  const { performGameAction } = await import('../src/gameActions.js');
  const { setCardData } = await import('../src/cardData.js');
  setCardData(data);
  const hero = { ...character(), id: 'tok_hero', hope: 2, stress: { current: 0, max: 6 } };
  // A store whose edit guard refuses changes in the Player view unless the table is applying them.
  const store = { sessionRole: 'host', remoteApplying: false, state: { userRole: 'player', campaignId: 'c', tokens: [hero], fear: 0 },
    updateToken(id, patch) { if (!this.remoteApplying && this.state.userRole === 'player') return false; Object.assign(this.state.tokens.find(t => t.id === id), patch); return true; },
    addFear() {}, addLog() {} };
  const card = characterCards(hero, data).find(c => c.kind === 'power' && c.cost.hope === 1);
  performGameAction({ type: 'CARD_PLAY', actorId: 'tok_hero', cardId: card.id }, store);
  assert.equal(hero.hope, 1); assert.equal(store.remoteApplying, false, 'the guard is restored afterwards');
});
