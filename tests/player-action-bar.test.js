import test from 'node:test';
import assert from 'node:assert/strict';
import { tapPick, EMPTY_PICK, experienceCost, experienceAvailable, experienceBonus } from '../src/playerActionBar.js';

const run = taps => taps.reduce((acc, tap) => { const next = tapPick(acc.pick, tap); return { pick: next.pick, roll: next.roll ?? acc.roll }; }, { pick: EMPTY_PICK, roll: null });

test('a Trait is selected with one touch and rolled with the second', () => {
  const first = tapPick(EMPTY_PICK, { kind: 'trait', id: 'agility' });
  assert.deepEqual(first.pick, { trait: 'agility', exp: null });
  assert.equal(first.roll, undefined);
  assert.deepEqual(run([{ kind: 'trait', id: 'agility' }, { kind: 'trait', id: 'agility' }]), { pick: EMPTY_PICK, roll: { trait: 'agility', exp: null, edge: 'normal' } });
});

test('touching another Trait changes the selection without rolling', () => {
  const r = run([{ kind: 'trait', id: 'agility' }, { kind: 'trait', id: 'presence' }]);
  assert.deepEqual(r, { pick: { trait: 'presence', exp: null }, roll: null });
});

test('Advantage or Disadvantage rolls the selected Trait with that edge', () => {
  assert.deepEqual(run([{ kind: 'trait', id: 'grit' }, { kind: 'edge', id: 'adv' }]).roll, { trait: 'grit', exp: null, edge: 'adv' });
  assert.deepEqual(run([{ kind: 'trait', id: 'grit' }, { kind: 'edge', id: 'dis' }]).roll, { trait: 'grit', exp: null, edge: 'dis' });
});

test('an Experience is selected, then rolled with a second touch or with an edge', () => {
  const picked = run([{ kind: 'trait', id: 'wit' }, { kind: 'exp', id: 1 }]);
  assert.deepEqual(picked, { pick: { trait: 'wit', exp: 1 }, roll: null });
  assert.deepEqual(run([{ kind: 'trait', id: 'wit' }, { kind: 'exp', id: 1 }, { kind: 'exp', id: 1 }]).roll, { trait: 'wit', exp: 1, edge: 'normal' });
  assert.deepEqual(run([{ kind: 'trait', id: 'wit' }, { kind: 'exp', id: 1 }, { kind: 'edge', id: 'dis' }]).roll, { trait: 'wit', exp: 1, edge: 'dis' });
  assert.deepEqual(run([{ kind: 'trait', id: 'wit' }, { kind: 'exp', id: 0 }, { kind: 'exp', id: 1 }]).pick, { trait: 'wit', exp: 1 });
});

test('without a Trait, Experiences and edges do nothing', () => {
  assert.deepEqual(run([{ kind: 'exp', id: 0 }, { kind: 'edge', id: 'adv' }]), { pick: EMPTY_PICK, roll: null });
});

test('Awakened Experiences cost 1 Hope and need it; Sleeping ones are free', () => {
  assert.equal(experienceCost({ path: 'Awakened' }), 1);
  assert.equal(experienceCost({ path: 'Sleeping' }), 0);
  assert.equal(experienceAvailable({ path: 'Awakened', hope: 0 }), false);
  assert.equal(experienceAvailable({ path: 'Awakened', hope: 2 }), true);
  assert.equal(experienceAvailable({ path: 'Sleeping', hope: 0 }), true);
});

test('the Experience bonus is read from the sheet text', () => {
  assert.equal(experienceBonus({ bonus: '+2' }), 2);
  assert.equal(experienceBonus({ bonus: ' + 3 ' }), 3);
  assert.equal(experienceBonus({ bonus: '' }), 0);
  assert.equal(experienceBonus({ bonus: '99' }), 10);
});

test('a player sees Ficha, Nave, Dossiers, Registro and Chat in the right panel', async () => {
  const { PLAYER_TABS } = await import('../src/playerActionBar.js');
  assert.deepEqual(PLAYER_TABS, ['sheet', 'ship', 'handouts', 'log', 'chat']);
});
