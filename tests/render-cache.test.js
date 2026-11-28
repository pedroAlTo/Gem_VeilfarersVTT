import test from 'node:test';
import assert from 'node:assert/strict';

// A canvas that accepts every drawing call and counts the ones the tests care about.
const calls = { drawImage: 0, getImageData: 0 };
const context = () => new Proxy({ getImageData: (x, y, w, h) => { calls.getImageData++; return { data: new Uint8ClampedArray(w * h * 4).fill(255) }; }, drawImage: () => { calls.drawImage++; }, createRadialGradient: () => ({ addColorStop() {} }) }, { get: (target, key) => key in target ? target[key] : () => {}, set: (target, key, value) => { target[key] = value; return true; } });
globalThis.document = { createElement: () => { const ctx = context(); return { width: 0, height: 0, getContext: () => ctx }; } };
const { FogOfWarEngine } = await import('../src/fogEngine.js');
const { LightingEngine } = await import('../src/lightingEngine.js');
const { drawSoftened, fingerprint, wallValues } = await import('../src/softMask.js');

test('a fingerprint changes with any number the mask depends on, and only then', () => {
  const wall = { x1: 0, y1: 0, x2: 100, y2: 0, wallType: 'door', isOpen: false };
  assert.equal(fingerprint([1, 2, 'a', true]), fingerprint([1, 2, 'a', true]));
  assert.notEqual(fingerprint([1, 2]), fingerprint([2, 1]));
  assert.notEqual(fingerprint(wallValues([wall])), fingerprint(wallValues([{ ...wall, isOpen: true }])), 'opening a door');
  assert.notEqual(fingerprint(wallValues([wall])), fingerprint(wallValues([{ ...wall, x2: 101 }])));
  assert.notEqual(fingerprint([10.0]), fingerprint([10.1]), 'a token that moved a little');
});

test('the softened copy of a mask is rebuilt only when its version changes', () => {
  const source = { width: 800, height: 600 }, ctx = context();
  calls.drawImage = 0; drawSoftened(ctx, source, 8, 1); const first = calls.drawImage;
  drawSoftened(ctx, source, 8, 1); assert.equal(calls.drawImage - first, 1, 'same version: one draw, no downscale');
  drawSoftened(ctx, source, 8, 2); assert.equal(calls.drawImage - first, 3, 'new version: downscale and draw');
  drawSoftened(ctx, source, 8); drawSoftened(ctx, source, 8); assert.equal(calls.drawImage - first, 7, 'no version given: always rebuilt');
});

test('the fog of war is recomputed only when a viewer, a wall, a light or the exploration changes', () => {
  const fog = new FogOfWarEngine(), lighting = new LightingEngine();
  let polygons = 0; const compute = lighting.computeVisibilityPolygon.bind(lighting);
  lighting.computeVisibilityPolygon = (...args) => { polygons++; return compute(...args); };
  const door = { x1: 300, y1: 0, x2: 300, y2: 400, wallType: 'door', isOpen: false };
  const frame = (viewer, walls = [door]) => fog.renderFogOfWar({ ctx: context(), mapWidth: 800, mapHeight: 600, mapId: 'm', walls, lights: [], viewers: [viewer], lightingEngine: lighting, exploredOpacity: 0.5 });
  const hero = { x: 100, y: 100, visionRange: 200, visionAngle: 360, facingAngle: 0 };
  const first = frame(hero); assert.equal(polygons, 1);
  for (let i = 0; i < 20; i++) assert.equal(frame({ ...hero }), first, 'idle frames reuse the same vision');
  assert.equal(polygons, 1, 'twenty idle frames cost no visibility polygon');
  frame({ ...hero, x: 110 }); assert.equal(polygons, 2, 'the viewer moved');
  frame({ ...hero, x: 110 }); assert.equal(polygons, 2);
  frame({ ...hero, x: 110 }, [{ ...door, isOpen: true }]); assert.equal(polygons, 3, 'a door opened');
  fog.resetExploration('m'); frame({ ...hero, x: 110 }, [{ ...door, isOpen: true }]); assert.equal(polygons, 4, 'the exploration memory was reset');
});

test('point tests read the exploration memory once per change, not once per question', () => {
  const fog = new FogOfWarEngine();
  fog.revealAll('m', 800, 600);
  calls.getImageData = 0;
  for (let i = 0; i < 500; i++) assert.equal(fog.isPointExplored(i, 300, 'm'), true);
  assert.equal(calls.getImageData, 1, 'one readback for 500 questions');
  assert.equal(fog.isWallExplored({ x1: 10, y1: 10, x2: 200, y2: 10 }, 'm'), true); assert.equal(calls.getImageData, 1);
  fog.stampExploration(context(), [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
  fog.isPointExplored(5, 5, 'm'); assert.equal(calls.getImageData, 2, 'a new stamp refreshes the copy');
  assert.equal(fog.isPointExplored(-5, 5, 'm'), false); assert.equal(fog.isPointExplored(5, 5, 'other'), false);
});

test('steady lights are drawn once; animated lights at most thirty times a second', () => {
  const lighting = new LightingEngine();
  let polygons = 0; const compute = lighting.computeVisibilityPolygon.bind(lighting);
  lighting.computeVisibilityPolygon = (...args) => { polygons++; return compute(...args); };
  const frame = (lights, time) => lighting.renderLighting({ ctx: context(), mapWidth: 800, mapHeight: 600, ambientLight: 0.3, walls: [], lights, tokens: [], time });
  const lamp = { x: 200, y: 200, radius: 150, intensity: 0.8 };
  for (let i = 0; i < 30; i++) frame([lamp], i / 60);
  // Two per light: the darkness mask and the area its colour tints (v2.27.3), both kept.
  assert.equal(polygons, 2, 'thirty frames of a steady light: its two polygons, once');
  frame([{ ...lamp, x: 210 }], 0.6); assert.equal(polygons, 4, 'the light moved');
  polygons = 0;
  for (let i = 0; i < 60; i++) frame([{ ...lamp, effect: 'pulse' }], 1 + i / 60);
  assert.ok(polygons >= 28 && polygons <= 33, `one second of a pulsing light at 60 fps redraws about 30 times (${polygons})`);
});

test('a preview viewer (an NPC on the Keeper’s screen) is shown but never explores the map (v2.63.0)', () => {
  const fog = new FogOfWarEngine(), lighting = new LightingEngine();
  const memory = fog.getExploredCanvas('pv', 800, 600).getContext('2d');
  let fills = 0; memory.fill = () => { fills++; };
  const frame = viewers => fog.renderFogOfWar({ ctx: context(), mapWidth: 800, mapHeight: 600, mapId: 'pv', walls: [], lights: [], viewers, lightingEngine: lighting, exploredOpacity: 0.5 });
  const npc = { x: 400, y: 300, visionRange: 200, visionAngle: 90, facingAngle: 0, preview: true };
  assert.equal(frame([npc]).length, 1, 'its sight is drawn on this screen');
  assert.equal(fills, 0, 'and not remembered as explored');
  frame([npc, { x: 100, y: 100, visionRange: 200, visionAngle: 360, facingAngle: 0 }]);
  assert.ok(fills > 0, 'the party explores');
});

test('the saved exploration uses cells that follow the map size (v2.63.0)', async () => {
  const { explorationCell, explorationKey } = await import('../src/fogEngine.js');
  assert.equal(explorationCell(1376, 768), 8);
  assert.equal(explorationCell(4128, 2304), 16);
  assert.equal(explorationKey({ cols: 2, rows: 3, bits: 'AA==' }), '2x3:AA==');
  assert.equal(explorationKey('all'), 'all');
});

test('on the Keeper’s screen what an NPC saw stays explored, apart from the table’s memory (v2.64.1)', () => {
  const fog = new FogOfWarEngine(), lighting = new LightingEngine();
  const table = fog.getExploredCanvas('km', 800, 600).getContext('2d');
  let tableFills = 0; table.fill = () => { tableFills++; };
  const npc = { x: 400, y: 300, visionRange: 200, visionAngle: 90, facingAngle: 0, preview: true };
  fog.renderFogOfWar({ ctx: context(), mapWidth: 800, mapHeight: 600, mapId: 'km', walls: [], lights: [], viewers: [npc], lightingEngine: lighting, exploredOpacity: 0.5, keeperMemory: true });
  const keeper = fog.keeperCanvases.get('km').getContext('2d');
  let keeperFills = 0; keeper.fill = () => { keeperFills++; };
  fog.renderFogOfWar({ ctx: context(), mapWidth: 800, mapHeight: 600, mapId: 'km', walls: [], lights: [], viewers: [{ ...npc, facingAngle: Math.PI }], lightingEngine: lighting, exploredOpacity: 0.5, keeperMemory: true });
  assert.ok(keeperFills > 0, 'the NPC’s sight is remembered for the Keeper');
  assert.equal(tableFills, 0, 'and never in the table’s exploration (sent to the players)');
  let cleared = 0; keeper.clearRect = () => { cleared++; };
  fog.resetExploration('km'); assert.equal(cleared, 1, 'a reset forgets it too');
});

test('one fog: the darkness is lifted to the explored veil where the party discovered the map (v2.64.4)', () => {
  const lighting = new LightingEngine();
  const draws = [];
  const lctx = lighting.lightCtx;
  lctx.drawImage = (image) => draws.push({ image, alpha: lctx.globalAlpha, op: lctx.globalCompositeOperation });
  const memory = { width: 800, height: 600 };
  lighting.renderLighting({ ctx: context(), mapWidth: 800, mapHeight: 600, ambientLight: 0, walls: [], lights: [], tokens: [], time: 0, explored: { canvas: memory, veil: 0.5, version: 1 } });
  const lift = draws.find(d => d.image === memory);
  assert.ok(lift, 'the memory is cut out of the darkness');
  assert.equal(lift.op, 'destination-out');
  assert.equal(lift.alpha, 0.5, 'full darkness lifted to a 50 % veil');
  draws.length = 0;
  lighting.renderLighting({ ctx: context(), mapWidth: 800, mapHeight: 600, ambientLight: 0.7, walls: [], lights: [], tokens: [], time: 0, explored: { canvas: memory, veil: 0.5, version: 2 } });
  assert.equal(draws.find(d => d.image === memory), undefined, 'a scene lighter than the veil: nothing to lift');
});

test('a light shows only where the party sees or has discovered; GM vision sees them all (v2.64.6)', () => {
  const lighting = new LightingEngine(), lctx = lighting.lightCtx, steps = [];
  lctx.drawImage = () => steps.push(`image ${lctx.globalCompositeOperation}`);
  lctx.fill = () => steps.push(`light ${lctx.globalCompositeOperation}`);
  lctx.fillRect = () => steps.push(`dark ${lctx.globalCompositeOperation}`);
  const memory = { width: 800, height: 600 }, lamp = { x: 400, y: 300, radius: 150, intensity: 0.8 };
  const frame = (onlySeen, version) => {
    steps.length = 0;
    lighting.renderLighting({ ctx: context(), mapWidth: 800, mapHeight: 600, ambientLight: 0, walls: [], lights: [lamp], tokens: [], sights: [{ x: 100, y: 100, radius: 50 }], time: 0, explored: { canvas: memory, veil: 0.5, version }, onlySeen });
    return [...steps];
  };
  const seen = frame(true, 1);
  assert.deepEqual(seen.slice(0, 4), ['light source-over', 'image destination-in', 'dark source-out', 'image destination-out'], 'the lamp is kept only where the map is known, and the darkness is laid around it');
  assert.deepEqual(seen.slice(4), ['light destination-out'], 'what the characters see right now is cut afterwards, never held back');
  const all = frame(false, 2);
  assert.ok(!all.includes('image destination-in'), 'GM vision: every light shows');
  assert.deepEqual(all.filter(s => s.startsWith('light')), ['light destination-out', 'light destination-out']);
});

test('the table’s exploration is merged once: only the cells a screen lacks are drawn (v2.64.6)', () => {
  const fog = new FogOfWarEngine();
  const ctx = fog.getExploredCanvas('mg', 40, 20).getContext('2d');
  let cells = 0; ctx.fillRect = () => { cells++; };
  const grid = byte => ({ status: 'custom', cols: 4, rows: 2, cellSize: 10, bits: Buffer.from([byte]).toString('base64') });
  fog.mergeExploration('mg', 40, 20, grid(0b0011)); assert.equal(cells, 2);
  fog.mergeExploration('mg', 40, 20, grid(0b0011)); assert.equal(cells, 2, 'the same grid again: nothing redrawn (its soft edges stay soft)');
  fog.mergeExploration('mg', 40, 20, grid(0b0111)); assert.equal(cells, 3, 'only the new cell');
  fog.noteMerged('mg', grid(0b1111));
  fog.mergeExploration('mg', 40, 20, grid(0b1111)); assert.equal(cells, 3, 'a screen’s own save is not merged back');
  fog.resetExploration('mg');
  fog.mergeExploration('mg', 40, 20, grid(0b0011)); assert.equal(cells, 5, 'after a reset the grid is drawn again');
});
