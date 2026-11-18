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
