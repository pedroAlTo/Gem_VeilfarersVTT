import test from 'node:test';
import assert from 'node:assert/strict';
import { LightingEngine } from '../src/lightingEngine.js';
import { drawSoftened, visionFill, VISION_FADE_START } from '../src/softMask.js';

// The engine only needs a canvas to exist; the geometry under test draws nothing.
const engineWithoutCanvas = () => { globalThis.document = { createElement: () => ({ getContext: () => ({}) }) }; try { return new LightingEngine(); } finally { delete globalThis.document; } };

test('sight and light in the open are round: every edge point lies on the radius, not on a square', () => {
  const polygon = engineWithoutCanvas().computeVisibilityPolygon(500, 500, 200, []);
  assert.ok(polygon.length >= 60, 'enough samples for a smooth circle');
  for (const point of polygon) assert.ok(Math.abs(Math.hypot(point.x - 500, point.y - 500) - 200) < 0.01);
  // The old shape had no point between the diagonals: at 0° the edge was a chord at ~141 px.
  const east = polygon.reduce((best, p) => Math.abs(Math.atan2(p.y - 500, p.x - 500)) < Math.abs(Math.atan2(best.y - 500, best.x - 500)) ? p : best);
  assert.ok(east.x > 699);
});

test('a wall still cuts the circle, and a cone keeps its apex and a smooth arc', () => {
  const engine = engineWithoutCanvas();
  const walled = engine.computeVisibilityPolygon(500, 500, 200, [{ x1: 600, y1: 300, x2: 600, y2: 700 }]);
  assert.ok(Math.max(...walled.map(p => p.x)) <= 600.5, 'nothing is seen past the wall');
  assert.ok(Math.min(...walled.map(p => p.x)) < 301, 'the open side still reaches the full radius');
  const cone = engine.computeVisibilityPolygon(500, 500, 200, [], 0, 180);
  assert.deepEqual(cone[0], { x: 500, y: 500 }); assert.ok(cone.length > 30);
});

test('the fog and the light mask are drawn feathered, and sight fades over the last part of its range', () => {
  const calls = [], small = { width: 0, height: 0, getContext: () => ({ clearRect() {}, drawImage: (...a) => calls.push(['small', ...a.slice(1)]) }) };
  globalThis.document = { createElement: () => small };
  const ctx = { save() {}, restore() {}, drawImage: (...a) => calls.push(['main', ...a.slice(1)]) };
  try {
    drawSoftened(ctx, { width: 1200, height: 600 }, 12);
    assert.deepEqual(calls, [['small', 0, 0, 1200, 600, 0, 0, 100, 50], ['main', 0, 0, 100, 50, 0, 0, 1200, 600]]);
    assert.equal(ctx.imageSmoothingEnabled, true);
  } finally { delete globalThis.document; }
  const stops = [], gradient = { addColorStop: (at, color) => stops.push([at, color]) };
  assert.equal(visionFill({ createRadialGradient: () => gradient }, 0, 0, 300), gradient);
  assert.deepEqual(stops, [[0, 'rgba(0, 0, 0, 1)'], [VISION_FADE_START, 'rgba(0, 0, 0, 1)'], [1, 'rgba(0, 0, 0, 0)']]);
  assert.equal(visionFill({}, 0, 0, 300), 'rgba(0, 0, 0, 1.0)', 'without gradients the cut stays solid');
});
