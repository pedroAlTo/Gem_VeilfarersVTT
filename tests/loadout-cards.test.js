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
  assert.deepEqual(characterCards(he09, data).map(c => c.kind), ['move', 'move', 'feature', 'ancestry', 'beardown', 'effort', 'effort', 'effort', 'effort', 'effort', 'effort', 'effort']);
  assert.deepEqual(characterCards(harker, data), []);
});

test('the table pays a played card even while its own screen previews the Player view', async () => {
  const { performGameAction } = await import('../src/gameActions.js');
  const { setCardData } = await import('../src/cardData.js');
  setCardData(data);
  const hero = { ...character(), id: 'tok_hero', hope: 2, stress: { current: 0, max: 6 } };
  // A store whose edit guard refuses changes in the Player view unless the table is applying them.
  const store = { sessionRole: 'host', remoteApplying: false, state: { userRole: 'player', campaignId: 'c', tokens: [hero], fear: 0 },
    updateToken(id, patch) { if (!this.remoteApplying && !this.tableActing && this.state.userRole === 'player') return false; Object.assign(this.state.tokens.find(t => t.id === id), patch); return true; },
    addFear() {}, addLog() {} };
  const card = characterCards(hero, data).find(c => c.kind === 'power' && c.cost.hope === 1);
  performGameAction({ type: 'CARD_PLAY', actorId: 'tok_hero', cardId: card.id }, store);
  assert.equal(hero.hope, 1); assert.ok(!store.tableActing, 'the guard is restored afterwards');
  // remoteApplying would also skip saving: it must not be used for this.
  assert.equal(store.remoteApplying, false);
  // A connected player's own table is never given this authority.
  const guest = { ...store, sessionRole: 'player', tableActing: false, state: { ...store.state, tokens: [{ ...hero, hope: 2 }] } };
  performGameAction({ type: 'CARD_PLAY', actorId: 'tok_hero', cardId: card.id }, guest);
  assert.equal(guest.state.tokens[0].hope, 2, 'a guest table does not apply the change: the Keeper does');
});

test('the Keeper holds the four Fear moves and, with an adversary selected, its printed abilities', async () => {
  const { keeperCards, adversaryAbilities, FEAR_MOVES } = await import('../src/loadoutCards.js');
  assert.deepEqual(FEAR_MOVES.map(c => [c.name, c.cost.fear]), [['Spotlight Enemies', 1], ['Declare a Complication', 1], ['Interrupt an Action', 2], ['Ancestry Complication', 1]]);
  assert.deepEqual(keeperCards(null).map(c => c.kind), ['fear', 'fear', 'fear', 'fear']);
  // The three formats the books print.
  const table = '| FEATURE NAME | TYPE | DESCRIPTION |\n| --- | --- | --- |\n| **Compliance Protocol** | Action | Siren. |\n| **Networked** | Passive | +2 Attack. |\n| **Self-Destruct** | Reaction | Trigger: The Keeper spends 1 Fear when the Drone hits 0 HP. |';
  assert.deepEqual(adversaryAbilities(table).map(a => [a.name, a.type, a.fear]), [['Compliance Protocol', 'Action', 0], ['Networked', 'Passive', 0], ['Self-Destruct', 'Reaction', 1]]);
  const species = '**Swarm Tactics** _(Passive):_ While the Horde has 3+ HP...\n**Scatter** _(Action):_ The swarm separates.\nBlackout Hunt (Fear 2) The Gloomfang disables lights.\n**Tactics** Not an ability.';
  assert.deepEqual(adversaryAbilities(species).map(a => [a.name, a.type, a.fear]), [['Swarm Tactics', 'Passive', 0], ['Scatter', 'Action', 0], ['Blackout Hunt', 'Fear', 2]]);
  assert.deepEqual(adversaryAbilities('- **Special:** Can target one augmentation.').map(a => a.name), ['Special']);
  const enemy = { id: 'tok_e', name: 'Gloomfang', isPlayer: false, actorType: 'adversary', featureNotes: species };
  const cards = keeperCards(enemy).filter(c => c.kind === 'adversary');
  assert.deepEqual(cards.map(c => [c.name, c.playable, c.cost.fear, c.actorId]), [['Swarm Tactics', false, 0, 'tok_e'], ['Scatter', true, 0, 'tok_e'], ['Blackout Hunt', true, 2, 'tok_e']]);
  assert.equal(keeperCards({ ...enemy, isPlayer: true }).length, 4, 'a player character adds no adversary cards');
  assert.equal(keeperCards({ ...enemy, actorType: 'drone' }).length, 4);
});

test('Bear Down spends the dice chosen and adds them all; a Sleeping hand holds it with the Common Efforts', async () => {
  const { performGameAction } = await import('../src/gameActions.js');
  const { sleepingCommonCards } = await import('../src/loadoutCards.js');
  const vell = { id: 'tok_vell', name: 'Vell', isPlayer: true, path: 'Sleeping', traits: { finesse: 1, agility: 0, strength: 0, instinct: 0, presence: 0, knowledge: 0 }, effort: 0, effortTrack: [false, false], hope: 0, resolve: { current: 3, max: 3, dieType: 'd4' }, stress: { current: 0, max: 6 }, hp: { current: 6, max: 6 } };
  const store = { sessionRole: 'local', state: { userRole: 'keeper', campaignId: 'bd', tokens: [vell], fear: 0 }, updateToken(id, patch) { Object.assign(vell, patch); }, addFear() {}, addLog() {} };
  assert.throws(() => performGameAction({ type: 'RESOLVE', actorId: 'tok_vell', count: 2 }, store), /Make a check first/);
  performGameAction({ type: 'CHECK', actorId: 'tok_vell', options: { traitId: 'finesse', dc: 30, forcedHope: 3, forcedFear: 5 } }, store);
  const result = performGameAction({ type: 'RESOLVE', actorId: 'tok_vell', count: 2 }, store);
  assert.equal(vell.resolve.current, 1); assert.equal(result.bearDown.count, 2); assert.equal(result.bearDown.dice.length, 2);
  assert.equal(result.total, 3 + 5 + 1 + result.bearDown.bonus); assert.equal(result.dominance, 'Fear', 'Bear Down never changes which die is higher');
  const capped = performGameAction({ type: 'RESOLVE', actorId: 'tok_vell', count: 9 }, store);
  assert.equal(capped.bearDown.count, 1, 'never more dice than Resolve left'); assert.equal(vell.resolve.current, 0);
  const cards = sleepingCommonCards(vell);
  assert.deepEqual(cards.map(c => c.name), ['Bear Down', 'Steady Hands', 'Read the Room', 'Push Through', 'The Opening', 'Try Again', 'Brace', 'Cover the Angle']);
  assert.equal(sleepingCommonCards(vell, { optionalEfforts: true }).length, 10, 'Second Wind and Seize the Moment only when the Keeper adopts them');
  assert.deepEqual(sleepingCommonCards({ ...vell, path: 'Awakened' }), []);
});

test('every card kind has a name, so using a Common Effort or Bear Down never breaks (v2.27.6)', async () => {
  const { sleepingCommonCards, keeperCards, CARD_KINDS, cardKindName } = await import('../src/loadoutCards.js');
  const vell = { id: 'tok_v', name: 'Vell', isPlayer: true, path: 'Sleeping', effort: 0, hope: 0, resolve: { current: 1, max: 1, dieType: 'd4' }, stress: { current: 0, max: 6 }, hp: { current: 6, max: 6 } };
  const kinds = new Set([...sleepingCommonCards(vell, { optionalEfforts: true }), ...(keeperCards?.({ fear: 3, tokens: [] }) || [])].map(c => c.kind));
  for (const kind of kinds) assert.ok(CARD_KINDS[kind], `kind ${kind} has a name`);
  assert.equal(cardKindName('desconocido'), 'Carta');
});

test('a card with a duration puts its clock on the player, or on the marked ally when it helps others', async () => {
  const { performGameAction } = await import('../src/gameActions.js');
  const { setCardData } = await import('../src/cardData.js');
  setCardData(data);
  const vanguard = { ...character({ cls: 'vanguard' }), id: 'tok_v', hope: 6, level: 5, mapId: 'm', stress: { current: 0, max: 6 } };
  const ally = { ...character(), id: 'tok_a', name: 'Ally', hope: 2, mapId: 'm', stress: { current: 0, max: 6 } };
  const store = { sessionRole: 'local', state: { userRole: 'keeper', campaignId: 'c', tokens: [vanguard, ally], fear: 0 },
    updateToken(id, patch) { Object.assign(this.state.tokens.find(t => t.id === id), patch); return true; }, addFear() {}, addLog() {} };
  const nirvana = characterCards(vanguard, data).find(c => /Nirvana/.test(c.name));
  const out = performGameAction({ type: 'CARD_PLAY', actorId: 'tok_v', cardId: nirvana.id, targetId: 'tok_a' }, store);
  assert.equal(vanguard.effectClocks[0].die, 'd6', 'Tier 2 (level 5): Integrity d6');
  assert.equal(ally.effectClocks, undefined, 'a state on yourself never goes to the ally');
  assert.match(out.notes.join(' '), /Integrity Die d6/);
  // Rapid Regeneration helps others: with an ally marked, the clock goes to the ally.
  const regenToken = { ...vanguard, id: 'tok_r', effectClocks: [], sourceCharacter: structuredClone(vanguard.sourceCharacter) };
  const f = regenToken.sourceCharacter.document.fields; f.a_pwr_1_n = 'Rapid Regeneration'; f.a_pwr_1_d = ''; store.state.tokens.push(regenToken);
  const regen = characterCards(regenToken, data).find(c => c.name === 'Rapid Regeneration');
  performGameAction({ type: 'CARD_PLAY', actorId: 'tok_r', cardId: regen.id, targetId: 'tok_a' }, store);
  assert.equal(ally.effectClocks[0].name, 'Rapid Regeneration'); assert.deepEqual(ally.effectClocks[0].perTick, { hp: 1 });
  assert.deepEqual(regenToken.effectClocks, []);
});

test('finishing an active action gives the player the Spotlight; a Reaction or a plain roll does not', async () => {
  const { performGameAction, grantSpotlight } = await import('../src/gameActions.js');
  const { setCardData } = await import('../src/cardData.js');
  setCardData(data);
  const hero = { ...character(), id: 'tok_s', hope: 6, mapId: 'm', stress: { current: 0, max: 6 }, hasSpotlight: false };
  const spot = [];
  const store = { sessionRole: 'local', state: { userRole: 'keeper', campaignId: 'c', tokens: [hero], fear: 0 },
    updateToken(id, patch) { Object.assign(this.state.tokens.find(t => t.id === id), patch); return true; }, addFear() {}, addLog() {},
    setTokenSpotlight(id, on) { spot.push([id, on]); Object.assign(this.state.tokens.find(t => t.id === id), { hasSpotlight: on }); return true; } };
  performGameAction({ type: 'CHECK', actorId: 'tok_s', options: { traitId: 'agility', dc: 10, forcedHope: 6, forcedFear: 2 } }, store);
  assert.deepEqual(spot, [], 'a plain Trait roll is not an attack');
  performGameAction({ type: 'CHECK', actorId: 'tok_s', attack: true, options: { traitId: 'agility', dc: 10, forcedHope: 6, forcedFear: 2 } }, store);
  assert.deepEqual(spot, [['tok_s', true]], 'an attack gives the Spotlight');
  hero.hasSpotlight = false; spot.length = 0;
  const cards = characterCards(hero, data);
  const reaction = cards.find(c => c.reaction && c.playable);
  if (reaction) { performGameAction({ type: 'CARD_PLAY', actorId: 'tok_s', cardId: reaction.id }, store); assert.deepEqual(spot, [], 'a Reaction does not'); }
  const active = cards.find(c => c.kind === 'power' && c.playable && !c.reaction && c.cost.hope <= 1);
  performGameAction({ type: 'CARD_PLAY', actorId: 'tok_s', cardId: active.id }, store);
  assert.deepEqual(spot, [['tok_s', true]], 'a Power used as an action does');
  assert.equal(grantSpotlight(store, 'tok_s'), false, 'already in the Spotlight: nothing to do');
  assert.equal(grantSpotlight(store, 'nope'), false);
});

test('Sleeping hand displays an illustration for every card in the fan and enlarged view', async () => {
  const { existsSync } = await import('node:fs');
  const { cardFace } = await import('../src/cardHandUI.js');
  const token = character({ path: 'Sleeping', cls: 'mystic', mystic: ['Tech', 'Lux'] });
  const cards = characterCards(token, data, { optionalEfforts: true });
  assert.ok(cards.some(c => c.name === 'Cover the Angle'));
  for (const c of cards) {
    assert.ok(c.art.illustration && existsSync(new URL('../public' + c.art.illustration, import.meta.url)), c.name);
    for (const large of [false, true]) assert.ok(cardFace(c, { large }).includes('src="' + c.art.illustration + '"'), c.name);
  }
});
