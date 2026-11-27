// Vision, light and vibration in metres, converted with each map's scale (v2.63.0), and the
// Keeper's fog brush.
import test from 'node:test';
import assert from 'node:assert/strict';

const { withRanges, tokenSenses, pixelsPerMeter, DEFAULT_VISION_METERS } = await import('../src/visionRanges.js');

test('the same character sees as far in metres on a sketch and on a 4K plate', () => {
  const hero = { id: 'h', visionMeters: 20, lightMeters: 8 };
  assert.equal(withRanges(hero, { gridSize: 64, gridScaleMeters: 2 }).visionRange, 640);
  assert.equal(withRanges(hero, { gridSize: 192, gridScaleMeters: 2 }).visionRange, 1920, 'three times the pixels, same metres');
  assert.equal(withRanges(hero, { gridSize: 100, gridScaleMeters: 1.5 }).lightRadius, 8 * 100 / 1.5);
  assert.equal(pixelsPerMeter({}), 32, 'an uncalibrated map: 64 px per 2 m square');
});

test('old pixel ranges are ignored: a token without metres uses the defaults', () => {
  const old = { id: 'o', visionRange: 280, lightRadius: 250, vibrationRadius: 260 };
  assert.deepEqual(tokenSenses(old), { vision: DEFAULT_VISION_METERS, light: 10, vibration: 10 });
  assert.equal(withRanges(old, { gridSize: 64, gridScaleMeters: 2 }).visionRange, DEFAULT_VISION_METERS * 32);
  assert.equal(tokenSenses({ visionMeters: 0 }).vision, 0, 'a blind token stays blind');
  assert.equal(tokenSenses({ visionMeters: -3 }).vision, DEFAULT_VISION_METERS);
});

test('the fog brush darkens or explores along the stroke and saves it with a new mark', async () => {
  const calls = [], updates = [];
  const store = { state: { activeTool: 'fog_brush', userRole: 'keeper', fogOfWar: true, fogBrushMode: 'hide', fogBrushSize: 2, campaignId: 'c', activeMapId: 'm' }, sessionRole: 'local',
    getActiveMap: () => ({ id: 'm', gridSize: 50 }), updateMap: (id, partial) => updates.push([id, partial]) };
  const engine = { mapImage: { width: 1000, height: 800 }, zoom: 1, fog: { exploredVersion: 7, brushExploration: (...a) => calls.push(a), serializeExploration: () => ({ status: 'custom', cols: 2, rows: 2, cellSize: 8, bits: 'AQ==' }) } };
  const { FogBrush } = await import('../src/fogBrush.js');
  const brush = new FogBrush(engine, store);
  assert.equal(brush.start({ x: 100, y: 100 }), true);
  assert.deepEqual(calls[0], ['c:m', 1000, 800, 100, 100, 100, false], 'radius: 2 squares of 50 px; hide');
  brush.move({ x: 300, y: 100 });
  assert.ok(calls.length >= 5, 'a fast stroke is filled between pointer events');
  assert.equal(updates.length, 0, 'nothing is sent while painting');
  assert.equal(brush.finish(), true);
  assert.equal(updates.length, 1);
  assert.ok(updates[0][1].fogResetAt > 0 && updates[0][1].fogExplored.status === 'custom');
  assert.equal(engine.fogApplied.get('c:m').reset, updates[0][1].fogResetAt, 'this screen does not reload what it painted');
  store.state.fogBrushMode = 'reveal'; brush.start({ x: 0, y: 0 }); assert.equal(calls.at(-1)[6], true);
  brush.finish();
  store.state.activeTool = 'select'; assert.equal(brush.start({ x: 0, y: 0 }), false, 'only with the tool');
  store.state.activeTool = 'fog_brush'; store.sessionRole = 'player'; assert.equal(brush.start({ x: 0, y: 0 }), false, 'never for a player');
});
