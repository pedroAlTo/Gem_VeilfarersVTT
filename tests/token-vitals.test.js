// The tokens on the map (v2.58.0, user decisions): HP, Stress and Escudos as slim segmented bars
// or as segmented rings (two outside, one inside); the states inside the token, over its flag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawSlimVitals, drawVitalRings } from '../src/tokenVitals.js';
import { conditionMarkerLayout } from '../src/conditions.js';

const memory = new Map();
globalThis.localStorage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) };
function context() {
  const commands = [];
  const ctx = new Proxy({}, { get(target, key) { if (key in target) return target[key]; return (...args) => { commands.push([key, ...args]); }; }, set(target, key, value) { target[key] = value; commands.push(['set', key, value]); return true; } });
  return { ctx, commands };
}

test('slim bars: one black pixel between points, nothing when the token shows no bars', () => {
  const { ctx, commands } = context();
  drawSlimVitals(ctx, { y: 40, width: 64, hp: { current: 4, max: 6 }, stress: { current: 1, max: 3 } });
  const rects = commands.filter(c => c[0] === 'fillRect');
  // Per bar: the track, the fill and its separators (6 HP points → 5, 3 Stress → 2).
  assert.equal(rects.length, (2 + 5) + (2 + 2));
  assert.ok(commands.some(c => c[0] === 'set' && c[1] === 'fillStyle' && c[2] === '#000'));
  const empty = context(); drawSlimVitals(empty.ctx, { y: 40, width: 64 });
  assert.equal(empty.commands.length, 0);
});

test('rings: a segment per point, HP and Stress outside, Escudos inside', () => {
  const { ctx, commands } = context();
  drawVitalRings(ctx, { radius: 32, hp: { current: 3, max: 6 }, stress: { current: 0, max: 4 }, armor: { current: 2, max: 3 } });
  const arcs = commands.filter(c => c[0] === 'arc').map(c => c[3]);
  const outer = arcs.filter(r => r > 32), inner = arcs.filter(r => r < 32);
  assert.equal(inner.length, 3, 'three Escudos segments inside');
  assert.equal(outer.length, 1 + 6 + 4, 'the dark band, then 6 HP and 4 Stress segments');
});

test('the states sit inside the token, in its lower-right quarter (over the class flag)', () => {
  for (const radius of [32, 64]) for (const zoom of [0.4, 1, 2]) {
    const spots = conditionMarkerLayout(4, radius, zoom);
    for (const s of spots) {
      assert.ok(Math.hypot(Math.abs(s.x) + s.size / 2, Math.abs(s.y) + s.size / 2) <= radius * 1.05, `inside at r=${radius} z=${zoom}`);
      assert.ok(s.x > -radius * 0.1 && s.y > -radius * 0.2, 'right and low');
    }
  }
});

test("the map style is each viewer's: bars by default, rings on request", async () => {
  const { vitalsStyle, setVitalsStyle } = await import('../src/mapVitals.js');
  assert.equal(vitalsStyle(), 'bars');
  assert.equal(setVitalsStyle('rings'), 'rings'); assert.equal(memory.get('veil.vitals.style'), 'rings');
  assert.equal(setVitalsStyle('nope'), 'bars');
});
