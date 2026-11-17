import test from 'node:test';
import assert from 'node:assert/strict';
import { rollAdversaryCheck } from '../src/attackFlow.js';
import { checkMath } from '../src/rulesEngine.js';

test('an adversary check is 1d20 + modifier against the DC, never Duality', () => {
  const hit = rollAdversaryCheck({ actorName: 'Pirata', modifier: 3, dc: 15, forcedD20: 12 });
  assert.equal(hit.keeperD20, true); assert.equal(hit.d20, 12); assert.equal(hit.total, 15);
  assert.equal(hit.fearVal, null, 'no Fear die'); assert.equal(hit.fearGain, 0);
  assert.equal(hit.outcomeTitle, 'ÉXITO'); assert.equal(hit.resultType, 'SUCCESS_WITH_HOPE');
  const miss = rollAdversaryCheck({ modifier: 3, dc: 15, forcedD20: 11 });
  assert.equal(miss.total, 14); assert.equal(miss.outcomeTitle, 'FALLO');
});

test('a natural 20 is a critical success whatever the DC', () => {
  const crit = rollAdversaryCheck({ modifier: -5, dc: 30, forcedD20: 20 });
  assert.equal(crit.isCritical, true); assert.equal(crit.resultType, 'CRITICAL_SUCCESS');
});

test('Advantage adds a d6, Disadvantage subtracts it, and the math shows every die', () => {
  const adv = rollAdversaryCheck({ modifier: 2, dc: 15, hasAdvantage: true, forcedD20: 10, forcedD6: 4 });
  assert.equal(adv.total, 16); assert.equal(adv.advVal, 4);
  assert.equal(checkMath(adv), 'd20 [10] + 2 + d6 [4] (Ventaja) = 16');
  const dis = rollAdversaryCheck({ modifier: 2, dc: 15, hasDisadvantage: true, forcedD20: 10, forcedD6: 4 });
  assert.equal(dis.total, 8); assert.equal(checkMath(dis), 'd20 [10] + 2 − d6 [4] (Desventaja) = 8');
  const both = rollAdversaryCheck({ modifier: 0, dc: 10, hasAdvantage: true, hasDisadvantage: true, forcedD20: 10 });
  assert.equal(both.total, 10, 'they cancel out');
});
