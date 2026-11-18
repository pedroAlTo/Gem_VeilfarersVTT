import test from 'node:test';
import assert from 'node:assert/strict';
import { cardDuration, newClock, addClock, tickClocks, editClock, validEffectClocks, clockSlots } from '../src/effectClocks.js';
import { validTokenPatch } from '../src/validation.js';

const nirvana = { name: 'Path to Nirvana', text: 'Spend 3 Hope to enter the Nirvana State. It lasts until the scene ends or you have taken a number of Spotlights equal to your Proficiency, whichever occurs first.' };
const regen = { name: 'Rapid Regeneration', text: 'Reaction (Cost: 1 Hope). When you or an ally in Very Close takes damage, the target recovers 1 HP immediately. Roll 1d4: the result is the number of additional turns the effect lasts. At the start of the target\'s turn, they recover +1 HP.' };

test('a card text sets the duration of its clock', () => {
  assert.deepEqual(cardDuration(nirvana, { proficiency: 3 }), { name: 'Path to Nirvana', tick: 'spotlight', segments: 3, note: 'Dura 3 Spotlights (Proficiency 3).', perTick: null });
  const r = cardDuration(regen, {}, () => 3);
  assert.equal(r.segments, 3); assert.deepEqual(r.faces, [3]); assert.deepEqual(r.perTick, { hp: 1 });
  assert.equal(cardDuration({ name: 'Golpe', text: 'Deal 2d6 damage.' }), null, 'no duration, no clock');
});

test('the Spotlight marks a segment; a full clock ends', () => {
  let list = addClock([], newClock({ name: 'Path to Nirvana', segments: 2, tick: 'spotlight' }, { id: 'n' }));
  let r = tickClocks(list, { kind: 'spotlight' });
  assert.equal(r.list[0].filled, 1); assert.equal(r.expired.length, 0);
  r = tickClocks(r.list, { kind: 'spotlight' });
  assert.equal(r.list.length, 0); assert.equal(r.expired[0].name, 'Path to Nirvana');
  list = addClock(addClock([], newClock({ name: 'A', segments: 4 }, { id: 'a' })), newClock({ name: 'A', segments: 2 }, { id: 'b' }));
  assert.deepEqual(list.map(c => c.id), ['b'], 'the same effect again restarts its clock');
  assert.equal(tickClocks(list, { id: 'b' }).list[0].filled, 1, 'a touch marks one segment');
  assert.deepEqual(editClock(list, 'b', { segments: 1, filled: 5 })[0], { ...list[0], segments: 1, filled: 1 });
});

test('clocks travel in token patches only when valid', () => {
  const ok = [newClock({ name: 'Path to Nirvana', segments: 3 }, { id: 'n' })];
  assert.equal(validEffectClocks(ok), true);
  assert.equal(validTokenPatch({ effectClocks: ok }), true);
  assert.equal(validTokenPatch({ effectClocks: [{ ...ok[0], filled: 9 }] }), false);
  assert.equal(validTokenPatch({ effectClocks: [{ ...ok[0], segments: 99 }] }), false);
  assert.equal(clockSlots({ effectClocks: ok }, 32, 1)[0].dx < -32, true, 'drawn to the left of the token');
});

test('Integrity Die (Corebook 12.06): highest face by Tier, lowered by rolls with Fear, ends with the scene', async () => {
  const { tierOf } = await import('../src/effectClocks.js');
  const classes = (await import('../src/creator/data/classes.json', { with: { type: 'json' } })).default;
  const vanguard = classes.find(c => c.id === 'vanguard');
  const nirvana = { name: 'Path to Nirvana', text: vanguard.hopeFeature.text };
  const disciplined = { name: 'The Refused Path', text: vanguard.sleepingRules.effortFeature.text };
  assert.deepEqual([1, 4, 5, 7, 8, 10].map(tierOf), [1, 1, 2, 2, 3, 3]);
  for (const card of [nirvana, disciplined]) {
    assert.deepEqual([1, 5, 9].map(level => cardDuration(card, { level })?.segments), [4, 6, 8]);
    const d = cardDuration(card, { level: 5 });
    assert.equal(d.tick, 'fear'); assert.equal(d.scene, true); assert.equal(d.die, 'd6');
  }
  const clock = newClock(cardDuration(nirvana, { level: 1 }), { id: 'i' });
  assert.equal(validEffectClocks([clock]), true);
  let r = tickClocks([clock], { kind: 'fear' });
  assert.equal(r.list[0].segments - r.list[0].filled, 3, 'd4 → 3 after a roll with Fear');
  assert.equal(tickClocks([clock], { kind: 'spotlight' }).ticked.length, 0, 'the Spotlight does not lower it');
});

test('the table lowers the Integrity Die on a roll with Fear, never on matching dice', async () => {
  const { performGameAction } = await import('../src/gameActions.js');
  const clock = newClock({ name: 'Path to Nirvana', segments: 4, tick: 'fear', scene: true, die: 'd4' }, { id: 'i' });
  const hero = { id: 'h', name: 'Kaia', isPlayer: true, path: 'Awakened', hope: 2, traits: { agility: 1, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 }, stress: { current: 0, max: 6 }, hp: { current: 6, max: 6 }, effectClocks: [clock] };
  const logs = [];
  const store = { sessionRole: 'local', state: { userRole: 'keeper', campaignId: 'fx', tokens: [hero], fear: 0 }, updateToken(id, patch) { Object.assign(hero, patch); }, addFear() {}, addLog(l) { logs.push(l); } };
  performGameAction({ type: 'CHECK', actorId: 'h', options: { traitId: 'agility', dc: 10, forcedHope: 3, forcedFear: 8 } }, store);
  assert.equal(hero.effectClocks[0].segments - hero.effectClocks[0].filled, 3, 'with Fear: 4 → 3');
  performGameAction({ type: 'CHECK', actorId: 'h', options: { traitId: 'agility', dc: 10, forcedHope: 9, forcedFear: 2 } }, store);
  assert.equal(hero.effectClocks[0].filled, 1, 'with Hope: unchanged');
  performGameAction({ type: 'CHECK', actorId: 'h', options: { traitId: 'agility', dc: 10, forcedHope: 5, forcedFear: 5 } }, store);
  assert.equal(hero.effectClocks[0].filled, 1, 'matching dice: unchanged');
  hero.effectClocks = [{ ...hero.effectClocks[0], filled: 3 }];
  performGameAction({ type: 'CHECK', actorId: 'h', options: { traitId: 'agility', dc: 10, forcedHope: 1, forcedFear: 7 } }, store);
  assert.deepEqual(hero.effectClocks, [], 'at 0 the state ends');
  assert.ok(logs.some(l => /Fin de Path to Nirvana/.test(l.title)));
});

test('Resolve: Bear Down has something to add to only after a roll; Prepare refills it on a rest', async () => {
  const { bearDownTarget, prepareResolve } = await import('../src/bearDown.js');
  const dice = { lastRollKind: 'check', lastResult: { actorId: 's' }, pendingDamageFor: id => (id === 'd' ? {} : null) };
  assert.equal(bearDownTarget('s', dice), 'check');
  assert.equal(bearDownTarget('x', dice), '', 'another character rolled');
  assert.equal(bearDownTarget('d', dice), 'damage', 'an open damage roll comes first');
  assert.equal(bearDownTarget('s', null), '');
  const sleeper = { path: 'Sleeping', resolve: { current: 1, max: 4, dieType: 'd4' } };
  assert.deepEqual(prepareResolve(sleeper, 'short').resolve, { current: 2, max: 4, dieType: 'd4' });
  assert.deepEqual(prepareResolve(sleeper, 'long').resolve.current, 4);
  assert.equal(prepareResolve({ ...sleeper, resolve: { current: 4, max: 4 } }, 'short'), null, 'already full');
  assert.equal(prepareResolve({ path: 'Awakened', resolve: { current: 0, max: 0 } }, 'long'), null);
});

test('durationDice: only a duration set by a die is thrown by the player', async () => {
  const { durationDice, cardDuration } = await import('../src/effectClocks.js');
  const { facesRoller, validFaces } = await import('../src/tableDice.js');
  assert.deepEqual(durationDice({ text: 'Roll 1d4: the result is the number of additional turns.' }), { qty: 1, sides: 4 });
  assert.equal(durationDice({ text: 'Lasts a number of Spotlights equal to your Proficiency.' }), null);
  const d = cardDuration({ name: 'X', text: 'Roll 1d4: the result is the number of additional turns.' }, {}, facesRoller([3]));
  assert.equal(d.segments, 3);
  assert.ok(validFaces([1, 4], 2, 4)); assert.ok(!validFaces([5], 1, 4)); assert.ok(!validFaces([1], 2, 4));
});
