// Plan de UX V3, fase 6 (v2.56.0): «¿Qué puedo hacer?», the conditions in words, the interface size.
import test from 'node:test';
import assert from 'node:assert/strict';
import { whatNow, conditionLines, CONDITION_EFFECTS } from '../src/whatNow.js';
import { CONDITIONS } from '../src/conditions.js';

const memory = new Map();
globalThis.localStorage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) };

const pc = (patch = {}) => ({ id: 'pc', name: 'Vea', mapId: 'm', x: 0, y: 0, isPlayer: true, actorType: 'player', conditions: [], hope: 2, hp: { current: 6, max: 6 }, stress: { current: 0, max: 6 }, ...patch });

test('every standard condition says what the table does with it', () => {
  assert.deepEqual(CONDITIONS.map(c => c.name).filter(n => !CONDITION_EFFECTS[n]), []);
  assert.deepEqual(conditionLines(pc({ conditions: ['Prone'] })).map(c => [c.label, c.name]), [['Derribado', 'Prone']]);
});

test('«¿Qué puedo hacer?»: what the character can do now and what limits it', () => {
  const gun = { id: 'g', name: 'Slug Pistol', range: 'Close', tags: [] }, rail = { id: 'r', name: 'Rail Rifle', range: 'Far', tags: ['reload'], spent: true };
  const free = whatNow(pc({ inventory: { weapons: [gun, rail], items: [] } }), { cards: [{ name: 'Stellar Lance', playable: true, cost: { hope: 1 } }, { name: 'Big One', playable: true, cost: { hope: 3 } }] });
  assert.ok(free.can.some(l => /Atacar con Slug Pistol \(Close\)/.test(l)));
  assert.ok(free.can.some(l => /Recargar Rail Rifle/.test(l)));
  assert.ok(free.can.some(l => /una carta de tu mano: Stellar Lance/.test(l)), 'only the cards it can pay');
  assert.ok(free.can.some(l => /Moverte/.test(l)));
  const held = whatNow(pc({ conditions: ['Restrained', 'Stunned'], hope: 0 }));
  assert.equal(held.can.some(l => /Atacar|Tirar/.test(l)), false, 'Stunned: no actions');
  assert.equal(held.can.some(l => /Moverte/.test(l)), false);
  assert.ok(held.limits.some(l => /Restringido \(Restrained\): No puedes moverte/.test(l)));
  assert.ok(held.limits.some(l => /Sin Hope/.test(l)));
  assert.ok(held.how.some(l => /anillo/.test(l)));
  assert.match(whatNow(pc({ conditions: ['Dying'], hp: { current: 0, max: 6 } })).limits[0], /Dying/);
});

test('the interface size: four steps, remembered, anything else is Normal', async () => {
  const { UI_SCALES, applyUiScale, uiScale } = await import('../src/uiScale.js');
  assert.deepEqual(UI_SCALES.map(s => s.value), [0.9, 1, 1.15, 1.3]);
  assert.equal(applyUiScale(1.3), 1.3); assert.equal(uiScale(), 1.3); assert.equal(memory.get('veil.ui.scale'), '1.3');
  assert.equal(applyUiScale(7), 1);
});
