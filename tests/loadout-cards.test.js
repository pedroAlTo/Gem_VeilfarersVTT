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
  assert.equal(cards[2].cost.hope, 3, 'Eureka Moment (3 Hope)'); assert.equal(cards[3].name, 'Synthetic'); assert.match(cards[4].subtitle, /^Background · /);
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
