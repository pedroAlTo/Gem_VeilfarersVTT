import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<body><input id="field"><canvas></canvas></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'localStorage', 'CustomEvent']) globalThis[key] = dom.window[key];
const { store } = await import('../src/state.js'); await store.ready;
const { NetworkManager } = await import('../src/networkManager.js');
const { FreehandTool, validateDrawing, strokeHit } = await import('../src/freehand.js');
const { MapClipboard, offsetElement } = await import('../src/mapClipboard.js');
const original = store.serializeCampaign(), network = new NetworkManager({ stateStore: store });
const engine = { zoom: 1, templates: [], activeTemplate: null }, reports = [];
const drawing = new FreehandTool(engine, store, network, m => reports.push(m));
const clipboard = new MapClipboard(store, network, engine, m => reports.push(m));
const tick = () => new Promise(r => setTimeout(r, 0));
beforeEach(async () => {
  network.disconnect(); await store.saveQueue;
  store.state = { ...store.state, ...structuredClone(original), activeTool: 'draw', drawingColor: '#d946ef', drawingWidth: 10, persistentRoomId: '', roomPaused: false, selectedTokenId: null, selectedDrawingId: null, selectedWallId: null, selectedLightId: null, selectedWaterId: null, selectedEffectId: null };
  store.getActiveMap().drawings = []; store.state.layerVisibility.overlay = true; store.state.layerLocked.overlay = false;
  drawing.cancel(); clipboard.content = null; reports.length = 0;
});
after(async () => { drawing.unsubscribe(); network.disconnect(); await store.saveQueue; dom.window.close(); });

test('freehand persists exact geometry/color/width and eraser leaves every non-drawing element intact', async () => {
  const before = structuredClone(store.serializeCampaign());
  drawing.start({ x: 0, y: 0 }); drawing.move({ x: 100, y: 75 }); drawing.move({ x: 120, y: 0 }); drawing.finish(); await tick();
  const stroke = store.getActiveMap().drawings[0];
  assert.equal(stroke.color, '#d946ef'); assert.equal(stroke.width, 10); assert.equal(stroke.points.length, 3);
  assert.equal(stroke.authorId, 'keeper');
  assert.equal(store.normalizeCampaign(store.serializeCampaign()).maps[0].drawings[0].id, stroke.id);
  store.update({ activeTool: 'erase_draw' }); drawing.start({ x: 60, y: -10 }); drawing.move({ x: 60, y: 150 }); drawing.finish(); await tick();
  assert.deepEqual(store.getActiveMap().drawings, []);
  const after = store.serializeCampaign(); delete after.savedAt; delete before.savedAt;
  assert.deepEqual(after, before);
});

test('tool/scene/connection changes cancel drafts, and sparse eraser samples still hit a crossing stroke', () => {
  drawing.start({ x: 10, y: 10 }); store.update({ activeTool: 'select' }); assert.equal(drawing.draft, null); assert.equal(drawing.finish(), false);
  store.update({ activeTool: 'draw' }); drawing.start({ x: 10, y: 10 }); store.update({ persistentRoomId: 'room', roomPaused: true });
  assert.equal(drawing.draft, null); assert.equal(drawing.start({ x: 1, y: 1 }), true); assert.equal(drawing.draft, null);
  assert.equal(strokeHit({ points: [{ x: 0, y: 10 }, { x: 100, y: 10 }], width: 2 }, { x: 50, y: 100 }, 3, { x: 50, y: 0 }), true);
  assert.equal(strokeHit({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 2 }, { x: 100, y: 0 }, 3), false);
});

test('Keeper validates drawing requests, ignores forged authors and refuses edits to another scene or author', () => {
  const mapId = store.state.activeMapId, shape = { color: '#00dfff', width: 5, points: [{ x: 1, y: 2 }], authorId: 'keeper' };
  const { id } = network.acceptDrawing({ operation: 'add', mapId, drawing: shape }, 'pilot-a');
  assert.equal(store.getActiveMap().drawings[0].authorId, 'pilot-a');
  assert.throws(() => network.acceptDrawing({ operation: 'erase', mapId, ids: [id] }, 'pilot-b'), /propios/);
  assert.throws(() => network.acceptDrawing({ operation: 'add', mapId: 'other', drawing: shape }, 'pilot-a'), /escena/);
  assert.throws(() => validateDrawing({ ...store.getActiveMap().drawings[0], width: 500 }), /válido/);
  assert.throws(() => validateDrawing({ ...store.getActiveMap().drawings[0], points: [{ x: NaN, y: 1 }] }), /válido/);
  network.acceptDrawing({ operation: 'erase', mapId, ids: [id] }, 'pilot-a'); assert.equal(store.getActiveMap().drawings.length, 0);
  store.sessionRole = 'player'; store.state.isConnected = false;
  return assert.rejects(network.editDrawing('add', { mapId, drawing: shape }), /pausa/);
});

test('copy/paste duplicates tokens independently and does not steal the original player assignment', async () => {
  const token = store.state.tokens[0]; token.ownerId = 'pilot-a'; store.state.selectedTokenId = token.id;
  assert.equal(clipboard.copy(), true); await clipboard.paste();
  const copy = store.state.tokens.at(-1);
  assert.notEqual(copy.id, token.id); assert.equal(copy.x, token.x + store.getActiveMap().gridSize);
  assert.equal(copy.ownerId, ''); assert.deepEqual(copy.controllerIds, []);
  copy.hp.current = 0; assert.notEqual(copy.hp.current, token.hp.current);
  assert.equal(token.ownerId, 'pilot-a');
  store.state.roomPaused = true; store.state.persistentRoomId = 'room'; await assert.rejects(clipboard.paste(), /pausa/);
});

test('polygon/wall geometry offsets all points; shortcuts preserve text editing and campaign isolation', async () => {
  const original = { id: 'zone', x: 0, y: 0, width: 100, height: 40, points: [{ x: 0, y: 0 }, { x: 100, y: 40 }, { x: 0, y: 40 }] };
  const copy = offsetElement(original, 64, 64); assert.deepEqual(copy.points[0], { x: 64, y: 64 }); assert.equal(copy.x, 64); assert.equal(copy.width, 100); assert.equal(original.x, 0);
  const wall = offsetElement({ id: 'wall', x1: 0, y1: 10, x2: 50, y2: 10 }, 64, 64); assert.equal(wall.x2, 114); assert.equal(wall.y1, 74);
  store.state.selectedTokenId = store.state.tokens[0].id;
  const inputEvent = { ctrlKey: true, key: 'c', target: document.getElementById('field'), preventDefault: () => assert.fail('text copy must stay native') };
  assert.equal(clipboard.keydown(inputEvent), false);
  assert.equal(clipboard.copy(), true); store.state.campaignId = 'another-room'; assert.equal(await clipboard.paste(), false);
});

test('drawing selections can be copied by their author but players cannot duplicate tokens', async () => {
  const mapId = store.state.activeMapId, { id } = network.acceptDrawing({ operation: 'add', mapId, drawing: { color: '#ffffff', width: 2, points: [{ x: 0, y: 0 }] } }, 'pilot');
  store.sessionRole = 'player'; store.memberId = 'pilot'; store.state.isConnected = true; store.state.selectedDrawingId = id;
  assert.equal(clipboard.copy(), true); assert.equal(clipboard.content.kind, 'drawing');
  clipboard.content = null; store.state.selectedTokenId = store.state.tokens[0].id;
  clipboard.copy(); assert.equal(clipboard.content, null); assert.match(reports.at(-1), /Solo puedes copiar tus dibujos/);
});
