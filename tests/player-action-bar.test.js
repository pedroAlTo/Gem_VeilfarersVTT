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

test('an Experience can be chosen before the Trait; edges need a Trait', () => {
  assert.deepEqual(run([{ kind: 'edge', id: 'adv' }]), { pick: EMPTY_PICK, roll: null });
  assert.deepEqual(run([{ kind: 'exp', id: 0 }, { kind: 'edge', id: 'adv' }]), { pick: { trait: null, exp: 0 }, roll: null });
  assert.deepEqual(run([{ kind: 'exp', id: 0 }, { kind: 'trait', id: 'agility' }]), { pick: { trait: 'agility', exp: 0 }, roll: null });
  assert.deepEqual(run([{ kind: 'exp', id: 0 }, { kind: 'trait', id: 'agility' }, { kind: 'edge', id: 'adv' }]).roll, { trait: 'agility', exp: 0, edge: 'adv' });
  assert.deepEqual(run([{ kind: 'exp', id: 0 }, { kind: 'exp', id: 0 }]), { pick: { trait: null, exp: null }, roll: null }, 'a second touch without a Trait unselects it');
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

test('the Ficha tab reads defense, resources and pending effects from the token', async () => {
  const { sheetStats } = await import('../src/playerActionBar.js');
  const awake = sheetStats({ path: 'Awakened', evasion: 11, hp: { current: 9, max: 16, majorThreshold: 6, severeThreshold: 12 }, armor: { current: 2, max: 4 }, stress: { current: 1, max: 6 }, hope: 3, pendingAdvantage: true, pendingCheckBonus: 2, conditions: ['Vulnerable'] }, 'Chaleco táctico');
  assert.equal(awake.evasion, 11);
  assert.deepEqual(awake.thresholds, [6, 12]);
  assert.deepEqual(awake.shields, { current: 2, max: 4 });
  assert.equal(awake.armor, 'Chaleco táctico');
  assert.deepEqual(awake.path, { label: 'HOPE', current: 3, max: 6 });
  assert.equal(awake.resolve, null);
  assert.deepEqual(awake.others.slice(0, 2), ['Ventaja preparada', '+2 a la próxima tirada']);
  // The conditions (Vulnerable) are in the status list, with icon and what they do (v2.56.0).
  assert.equal(awake.others.length, 2);
  const sleeper = sheetStats({ path: 'Sleeping', effort: 2, resolve: { current: 1, max: 3, dieType: 'd6' } });
  assert.deepEqual(sleeper.path, { label: 'EFFORT', current: 2, max: 6 });
  assert.deepEqual(sleeper.resolve, { current: 1, max: 3, die: 'd6' });
  assert.equal(sleeper.armor, '—');
  assert.deepEqual(sleeper.others, []);
});

test('hidden tokens are targets only on the Keeper machine', async () => {
  const { tokenAtPoint } = await import('../src/playerActionBar.js');
  const tokens = [{ id: 'a', x: 0, y: 0, size: 1 }, { id: 'h', x: 200, y: 0, size: 2, hidden: true }];
  assert.equal(tokenAtPoint(tokens, { x: 210, y: 10 }, 64), null, 'a player never targets what it cannot see');
  assert.equal(tokenAtPoint(tokens, { x: 210, y: 10 }, 64, { includeHidden: true })?.id, 'h');
  assert.equal(tokenAtPoint(tokens, { x: 5, y: 5 }, 64, { exclude: 'a' }), null, 'never the attacker');
});
