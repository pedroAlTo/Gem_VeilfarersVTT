// Plan de UX V3, fase 3 (v2.49.0): Power procedures. The table applies what each Power does from its
// reviewed procedure: targets and zones, damage prepared for the Keeper, Reaction Rolls of the
// targets with their failure, healing and conditions with their duration, and failed casts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATOR_DATA as data } from '../src/creator/creatorData.js';
import { setCardData } from '../src/cardData.js';
import { performGameAction } from '../src/gameActions.js';
import { characterCards } from '../src/loadoutCards.js';
import { resolutionLog } from '../src/cardResolution.js';
import { combatTransition, checkEdge, nextSpotlightRound } from '../src/combatState.js';
import { visibleConditions } from '../src/conditions.js';
import { evasionBonus } from '../src/powerEffects.js';
import { PROCEDURES, procedureFor, diceFormula } from '../src/powerProcedures.js';
import { validEffectClocks } from '../src/effectClocks.js';

setCardData(data);
const scene = { id: 'deck', gridSize: 64, gridScaleMeters: 2, spotlightRound: 1 };
const actor = (id, patch = {}) => ({ id, name: id, mapId: scene.id, x: 64, y: 64, size: 1, isPlayer: true, actorType: 'player', characterClass: 'Mystic', path: 'Awakened', level: 10, proficiency: 2, hope: 6,
  traits: { presence: 0, knowledge: 0, strength: 0, agility: 0, instinct: 0 }, conditions: [], hp: { current: 6, max: 10 }, stress: { current: 2, max: 6 }, armor: { current: 2, max: 3 }, sheetFields: {}, ...patch });
const hostile = (id, patch = {}) => actor(id, { isPlayer: false, actorType: 'adversary', attackModifier: 0, ...patch });
function table(...tokens) {
  return { sessionRole: 'host', state: { campaignId: 'p', activeMapId: scene.id, maps: [scene], userRole: 'keeper', tokens, logs: [], fear: 0, clocks: [] },
    getActiveMap() { return this.state.maps[0]; }, update(patch) { Object.assign(this.state, patch); },
    updateToken(id, patch) { this.state.tokens = this.state.tokens.map(t => t.id === id ? combatTransition(t, { ...t, ...patch }, this.getActiveMap()) : t); },
    addLog(log) { this.state.logs.unshift(log); }, addFear(n) { this.state.fear = Math.min(12, this.state.fear + n); },
    addClock(c) { this.state.clocks.push({ id: 'project', ...c }); return this.state.clocks.at(-1); } };
}
const get = (s, id) => s.state.tokens.find(t => t.id === id);
const withPower = (name, patch = {}) => actor('caster', { sheetFields: { a_pwr_1_n: name }, ...patch });
function play(s, name, extra = {}) {
  const card = characterCards(get(s, 'caster'), data).find(c => c.name === name);
  assert.ok(card, name);
  return performGameAction({ type: 'CARD_PLAY', actorId: 'caster', cardId: card.id, ...extra }, s);
}
const cast = (s, playId, trait, dc, hope, fear) => performGameAction({ type: 'CHECK', actorId: 'caster', cardPlayId: playId, options: { traitId: trait, dc, forcedHope: hope, forcedFear: fear } }, s);
const reply = (s, playId, replyId, who, trait, dc, total) => performGameAction({ type: 'CHECK', actorId: who, cardPlayId: playId, cardReplyId: replyId, options: { traitId: trait, dc, forcedD20: total } }, s);
const record = (s, id) => resolutionLog(s, id).resolution;

test('every procedure names a known Power and valid steps', () => {
  const names = new Set(data.powers.map(p => p.n));
  for (const [name, p] of Object.entries(PROCEDURES)) {
    assert.ok(names.has(name), name);
    for (const mode of p.modes ? Object.values(p.modes) : [p]) for (const step of [...(mode.success || []), ...(mode.hope || []), ...(mode.failure || [])]) {
      assert.ok(['damage', 'save', 'heal', 'condition', 'clock', 'mark', 'note', 'revive'].includes(step.do), `${name}: ${step.do}`);
      // A duration in dice (1d4 rounds) is rolled when it applies.
      const clock = step.clock || step.fail?.clock;
      if (clock) assert.ok(validEffectClocks([{ id: 'x', segments: 1, filled: 0, tick: 'manual', ...clock, ...(typeof clock.rounds === 'string' ? { rounds: 4 } : {}) }]), `${name}: clock`);
    }
  }
  assert.equal(diceFormula('P*d12', { proficiency: 3 }), '3d12'); assert.equal(diceFormula('P2*d8', { proficiency: 2 }), '4d8'); assert.equal(diceFormula('4d10', {}), '4d10');
  assert.equal(procedureFor('Cellular Reconstruction', 'Distributed').zone.max, 3);
  assert.equal(procedureFor('Cellular Reconstruction').mode, 'Focused', 'the first mode by default');
});

test('Mind Spike: damage that ignores armor for the Keeper, then a Presence roll; a failure leaves it Stunned until the end of its next Spotlight', () => {
  const s = table(withPower('Mind Spike'), hostile('e', { x: 64 * 8 }));
  const play1 = play(s, 'Mind Spike', { targetIds: ['e'] });
  cast(s, play1.id, 'presence', 20, 12, 10);
  const r = record(s, play1.id);
  assert.deepEqual(r.damagePending, [{ formula: '2d12', type: 'void', tag: '', noArmor: true, targetIds: ['e'] }]);
  assert.equal(r.replies.length, 1); assert.deepEqual([r.replies[0].traitId, r.replies[0].dc], ['presence', 15]);
  reply(s, play1.id, r.replies[0].id, 'e', 'presence', 15, 4);
  assert.ok(visibleConditions(get(s, 'e')).includes('Stunned'));
  assert.equal(get(s, 'e').effectClocks.find(c => c.condition === 'Stunned').expiry, 'spotlight-end');
  assert.match(record(s, play1.id).replies[0].consequence, /Stunned hasta el final de su próximo Spotlight/);
});

test('Psychic Storm hits every enemy in Close range and not the allies; a failed Presence roll marks 1 Stress', () => {
  const s = table(withPower('Psychic Storm'), hostile('a', { x: 128 }), hostile('b', { x: 64, y: 192 }), hostile('far', { x: 64 * 12 }), actor('ally', { x: 128, y: 128 }));
  const p = play(s, 'Psychic Storm');
  assert.deepEqual(record(s, p.id).targetIds.sort(), ['a', 'b']);
  cast(s, p.id, 'presence', 20, 12, 10);
  const r = record(s, p.id);
  assert.deepEqual(r.damagePending[0].targetIds.sort(), ['a', 'b']);
  const before = get(s, 'a').stress.current;
  reply(s, p.id, r.replies.find(x => x.actorId === 'a').id, 'a', 'presence', 15, 3);
  assert.equal(get(s, 'a').stress.current, before + 1);
});

test('Photonic Detonation fills a Close cone towards the token aimed at; Blinded on a failed Agility roll', () => {
  const s = table(withPower('Photonic Detonation'), hostile('front', { x: 64 * 3 }), hostile('beside', { x: 64 * 4, y: 96 }), hostile('behind', { x: 0 }));
  const p = play(s, 'Photonic Detonation', { targetIds: ['front'] });
  assert.deepEqual(record(s, p.id).targetIds.sort(), ['beside', 'front']);
  cast(s, p.id, 'presence', 20, 12, 10);
  const r = record(s, p.id);
  reply(s, p.id, r.replies.find(x => x.actorId === 'front').id, 'front', 'agility', 15, 2);
  assert.ok(visibleConditions(get(s, 'front')).includes('Blinded'));
  nextSpotlightRound(s);
  assert.equal(visibleConditions(get(s, 'front')).includes('Blinded'), false, 'for 1 round');
});

test('Cellular Reconstruction · Distributed costs 2 Hope, heals the three most wounded allies in Close and clears 1 Stress with Hope', () => {
  const hurt = (id, hp, x) => actor(id, { x, hp: { current: hp, max: 10 } });
  const s = table(withPower('Cellular Reconstruction', { hp: { current: 9, max: 10 } }), hurt('a', 2, 128), hurt('b', 5, 192), hurt('c', 8, 64 * 4), hurt('d', 9, 64 * 4.5), hostile('e', { x: 128, y: 128 }));
  const p = play(s, 'Cellular Reconstruction', { mode: 'Distributed' });
  assert.equal(get(s, 'caster').hope, 4, '2 Hope');
  assert.deepEqual(record(s, p.id).targetIds, ['a', 'b', 'c']);
  cast(s, p.id, 'knowledge', 15, 11, 5);
  const r = record(s, p.id);
  assert.deepEqual(r.effectPending, [{ dice: '2d6', hp: 0, stress: 0, targetIds: ['a', 'b', 'c'] }]);
  assert.equal(get(s, 'a').stress.current, 1, 'Success with Hope: −1 Stress at once');
  performGameAction({ type: 'CARD_EFFECT', actorId: 'caster', playId: p.id, faces: [[3, 4]] }, s);
  assert.deepEqual(['a', 'b', 'c'].map(id => get(s, id).hp.current), [9, 10, 10]);
  assert.equal(record(s, p.id).effectPending, null);
  assert.throws(() => performGameAction({ type: 'CARD_EFFECT', actorId: 'caster', playId: p.id, faces: [[3, 4]] }, s), /no espera/);
});

test('Shockwave Pulse · Protective: +2 Evasion to the allies in Close until the round changes and 1d4 HP to them', () => {
  const s = table(withPower('Shockwave Pulse'), actor('ally', { x: 128 }), hostile('e', { x: 192 }));
  const p = play(s, 'Shockwave Pulse', { mode: 'Protective' });
  cast(s, p.id, 'strength', 20, 12, 10);
  assert.equal(evasionBonus(get(s, 'ally')), 2); assert.equal(evasionBonus(get(s, 'e')), 0);
  assert.deepEqual(record(s, p.id).effectPending[0].targetIds, ['ally']);
  nextSpotlightRound(s);
  assert.equal(evasionBonus(get(s, 'ally')), 0);
});

test('a failed cast has its cost: Temporal Freeze leaves the caster Stunned and 2 Stress; Psychic Collapse rebounds 1d8 on the caster', () => {
  const s = table(withPower('Temporal Freeze'));
  const p = play(s, 'Temporal Freeze'), paid = get(s, 'caster').stress.current;
  cast(s, p.id, 'instinct', 20, 2, 3);
  assert.ok(visibleConditions(get(s, 'caster')).includes('Stunned'));
  assert.equal(get(s, 'caster').stress.current, paid + 2, '2 Stress on top of the cost');
  const c = table(withPower('Psychic Collapse'), hostile('e', { x: 64 * 6 }));
  const miss = play(c, 'Psychic Collapse', { targetIds: ['e'] });
  cast(c, miss.id, 'presence', 25, 2, 3);
  assert.deepEqual(record(c, miss.id).damagePending, [{ formula: '1d8', type: 'void', tag: '', noArmor: false, targetIds: ['caster'] }]);
  // On a success: Disadvantage on all its rolls until the round changes.
  const c2 = table(withPower('Psychic Collapse'), hostile('e', { x: 64 * 6 }));
  const hit = play(c2, 'Psychic Collapse', { targetIds: ['e'] });
  cast(c2, hit.id, 'presence', 25, 12, 12); // matching dice: a Critical
  assert.equal(checkEdge(get(c2, 'e'), null, false, false, 'agility').disadvantage, true);
});

test('Vanish (user decision): Hidden at once, no roll; attacking or casting a Power ends it', async () => {
  const { cardSummary } = await import('../src/cardSummaries.js');
  const rogue = (patch = {}) => actor('caster', { characterClass: 'Scoundrel', path: 'Sleeping', level: 3, resolve: { current: 3, max: 3, dieType: 'd4' }, effort: 2, ...patch });
  const s = table(rogue(), hostile('e', { x: 128, evasion: 5 }));
  const vanish = characterCards(get(s, 'caster'), data).find(c => c.name === 'Vanish');
  assert.ok(vanish, 'Vanish in hand'); assert.match(vanish.text, /You become Hidden until you attack or use a Power/);
  assert.match(cardSummary(vanish, get(s, 'caster')) || '', /Oculto \(Hidden\)/);
  performGameAction({ type: 'CARD_PLAY', actorId: 'caster', cardId: vanish.id }, s);
  assert.ok(visibleConditions(get(s, 'caster')).includes('Hidden'));
  assert.equal(get(s, 'caster').resolve.current, 2, '1 Resolve');
  assert.equal(checkEdge(get(s, 'caster'), get(s, 'e')).advantage, true, 'Advantage on the attack');
  performGameAction({ type: 'CHECK', actorId: 'caster', attack: true, targetId: 'e', options: { traitId: 'agility', dc: 5, forcedHope: 6, forcedFear: 2, forcedAdv: 2 } }, s);
  assert.equal(visibleConditions(get(s, 'caster')).includes('Hidden'), false, 'attacking ends it');
  assert.equal(get(s, 'caster').effectClocks.some(c => c.name === 'Vanish'), false);
  // Casting a Power ends it too (CARD_PLAY of a Power calls endSelfEffects with power: true).
  const { endSelfEffects } = await import('../src/cardResolution.js');
  const t = table(rogue(), hostile('e', { x: 128 }));
  performGameAction({ type: 'CARD_PLAY', actorId: 'caster', cardId: characterCards(get(t, 'caster'), data).find(c => c.name === 'Vanish').id }, t);
  const ended = endSelfEffects(get(t, 'caster'), { power: true });
  assert.deepEqual(ended.ended, ['Vanish']); assert.equal(ended.conditions.includes('Hidden'), false);
  assert.equal(endSelfEffects(get(t, 'caster'), { domain: 'Void' }), null, 'another Domain alone does not');
});

test('second batch: Rallying Cry, Beacon of Resurrection, Apotheosis and Psychic Fallout', async () => {
  const { rollBonus, immuneTo } = await import('../src/powerEffects.js');
  // Rallying Cry: +2 to all rolls until the round changes, no fear for the scene, −1 Stress with Hope.
  const r = table(withPower('Rallying Cry'), actor('ally', { x: 128 }), hostile('e', { x: 192 }));
  const cry = play(r, 'Rallying Cry');
  cast(r, cry.id, 'presence', 15, 11, 4);
  assert.equal(rollBonus(get(r, 'ally'), 'agility'), 2); assert.equal(rollBonus(get(r, 'e'), 'agility'), 0);
  assert.equal(immuneTo(get(r, 'ally'), 'Frightened'), true);
  assert.equal(get(r, 'ally').stress.current, 1);
  nextSpotlightRound(r);
  assert.equal(rollBonus(get(r, 'ally'), 'agility'), 0, 'for 1 round'); assert.equal(immuneTo(get(r, 'ally'), 'Frightened'), true, 'for the scene');
  // Beacon of Resurrection: a fallen ally comes back at 1 HP with Disadvantage until the end of its next Spotlight.
  const b = table(withPower('Beacon of Resurrection'), actor('down', { x: 192, hp: { current: 0, max: 10 }, conditions: ['Dying'] }));
  const beacon = play(b, 'Beacon of Resurrection', { targetIds: ['down'] });
  cast(b, beacon.id, 'presence', 20, 12, 10);
  assert.equal(get(b, 'down').hp.current, 1); assert.equal(get(b, 'down').conditions.includes('Dying'), false);
  assert.equal(checkEdge(get(b, 'down'), null, false, false, 'agility').disadvantage, true);
  // Apotheosis: allies heal their Severe Threshold; enemies take direct damage that ignores armor.
  const a = table(withPower('Apotheosis', { hope: 6 }), actor('ally', { x: 128, hp: { current: 2, max: 20, severeThreshold: 9 } }), hostile('e', { x: 192 }));
  const apo = play(a, 'Apotheosis');
  cast(a, apo.id, 'presence', 30, 12, 12);
  assert.equal(get(a, 'ally').hp.current, 11);
  assert.deepEqual(record(a, apo.id).damagePending, [{ formula: '6d10', type: 'energy', tag: 'Radiant', noArmor: true, direct: true, targetIds: ['e'] }]);
  // Psychic Fallout: a failed cast leaves Disadvantage on all rolls for 1d4 rounds.
  const f = table(withPower('Psychic Fallout', { hope: 6 }), hostile('e', { x: 64 * 6 }));
  const fallout = play(f, 'Psychic Fallout');
  cast(f, fallout.id, 'presence', 25, 2, 3);
  const clock = get(f, 'caster').effectClocks.find(c => c.allRolls);
  assert.ok(clock && clock.rounds >= 1 && clock.rounds <= 4);
});
