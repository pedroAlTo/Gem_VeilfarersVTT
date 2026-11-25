// Plan de UX V3, fase 5, segunda parte (v2.54.0): On Fire and Poisoned act by themselves when the
// Keeper closes the round (the user's decision, 25 nov 2026). Bleeding stays manual (decision 18).
import test from 'node:test';
import assert from 'node:assert/strict';
import { combatTransition, nextSpotlightRound } from '../src/combatState.js';
import { roundConditions, poisonImmunity, fireDamage, roundConditionTargets } from '../src/roundConditions.js';

const scene = { id: 'm', name: 'Cubierta', gridSize: 64, gridScaleMeters: 2, walls: [], spotlightRound: 1 };
const tok = (id, patch = {}) => ({ id, name: id, mapId: 'm', x: 64, y: 64, isPlayer: false, actorType: 'adversary', conditions: [],
  hp: { current: 8, max: 8, majorThreshold: 5, severeThreshold: 10 }, stress: { current: 0, max: 3 }, ...patch });
function table(...tokens) {
  return { sessionRole: 'host', state: { activeMapId: 'm', maps: [scene], userRole: 'keeper', tokens, logs: [], fear: 0, clocks: [] },
    getActiveMap() { return this.state.maps.find(m => m.id === this.state.activeMapId); }, update(patch) { Object.assign(this.state, patch); },
    updateToken(id, patch) { this.state.tokens = this.state.tokens.map(t => t.id === id ? combatTransition(t, { ...t, ...patch }, this.getActiveMap()) : t); },
    addLog(log) { this.state.logs.unshift(log); } };
}
const dice = face => async () => [face];

test('On Fire: 1d4 Energy (Fire) against the thresholds, with resistance and the Energy penetration', async () => {
  const s = table(tok('a', { conditions: ['On Fire'] }), tok('b', { conditions: ['On Fire', 'Resistance to Fire'] }), tok('c'));
  assert.deepEqual(roundConditionTargets(s).map(x => x.token.id), ['a', 'b'], 'only who burns');
  const lines = await roundConditions(s, 2, { roll: dice(4) });
  // 4 Energy against Major 5 − 2 (Energy penetration) = 3: Major, 2 HP.
  assert.equal(s.state.tokens.find(t => t.id === 'a').hp.current, 6);
  // Resistance halves it: 2 < 3, Minor, 1 HP.
  assert.equal(s.state.tokens.find(t => t.id === 'b').hp.current, 7);
  assert.match(lines[0], /a arde: 1d4 \[4\] Energy \(Fire\) → Major, pierde 2 HP \(8 → 6\)/);
  const log = s.state.logs.find(l => l.title === 'On Fire · a');
  assert.ok(log.calc.some(l => /Dados: d4 \[4\]/.test(l)) && log.calc.some(l => /Sin Armor Slots/.test(l)), 'the calculation in the log');
  assert.equal(fireDamage(tok('x', { conditions: ['Immunity to Fire'] }), 4).finalHpDamage, 0, 'immune');
  // It keeps burning: the condition stays until it is put out.
  assert.ok(s.state.tokens.find(t => t.id === 'a').conditions.includes('On Fire'));
});

test('Poisoned: 1 Stress per round; Synthetics and toxin-immune targets ignore it', async () => {
  const s = table(tok('a', { conditions: ['Poisoned'] }), tok('robot', { name: 'Combat Synth', conditions: ['Poisoned'] }),
    tok('filter', { isPlayer: true, actorType: 'player', conditions: ['Poisoned'], inventory: { weapons: [], items: [{ id: 'f', name: 'Filtro Hepático Bio-Sintético', benefit: 'Inmunidad total a toxinas y venenos (ignora condición Poisoned).' }] } }),
    tok('full', { conditions: ['Poisoned'], stress: { current: 3, max: 3 } }));
  const lines = await roundConditions(s, 3, { roll: dice(1) });
  const stress = id => s.state.tokens.find(t => t.id === id).stress.current;
  assert.equal(stress('a'), 1);
  assert.equal(stress('robot'), 0); assert.match(poisonImmunity(s.state.tokens.find(t => t.id === 'robot')), /Sintético/);
  assert.equal(stress('filter'), 0); assert.match(poisonImmunity(s.state.tokens.find(t => t.id === 'filter')), /equipo/);
  assert.equal(stress('full'), 3, 'capped');
  assert.ok(lines.some(l => /Combat Synth ignora Poisoned/.test(l)));
});

test('«Nueva ronda» runs them; a character at 0 HP or in a life stage is left alone', async () => {
  const s = table(tok('a', { conditions: ['On Fire', 'Poisoned'] }), tok('down', { isPlayer: true, actorType: 'player', conditions: ['On Fire', 'Dying'], hp: { current: 0, max: 6, majorThreshold: 4, severeThreshold: 8 } }));
  nextSpotlightRound(s);
  await new Promise(r => setTimeout(r, 20));
  const a = s.state.tokens.find(t => t.id === 'a');
  assert.ok(a.hp.current < 8, 'burnt'); assert.equal(a.stress.current, 1, 'poisoned');
  assert.equal(s.state.tokens.find(t => t.id === 'down').hp.current, 0);
  assert.equal(s.state.logs.filter(l => /down/.test(l.title || '')).length, 0);
});
