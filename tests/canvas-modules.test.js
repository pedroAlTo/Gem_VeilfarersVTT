// The canvas engine in modules (v2.65.0, user request: «para poder trabajar en módulos separados»).
// canvasEngine.js keeps the core (canvas, map, viewport, render loop); every other part is a
// module in src/canvas/ whose methods are mixed into CanvasEngine.prototype.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'MouseEvent', 'Image']) globalThis[k] = dom.window[k];
dom.window.HTMLCanvasElement.prototype.getContext = () => ({});
const { store } = await import('../src/state.js'); await store.ready;
const { CanvasEngine, WATER_DEPTH_NAMES } = await import('../src/canvasEngine.js');

// Every method the engine had in one file (up to v2.64.6), plus the input handlers that were
// arrow functions inside initEvents.
const METHODS = ['resize', 'updateMapProgress', 'loadMap', 'fitMapToViewport', 'screenToWorld', 'worldToScreen', 'getViewportBounds', 'getTokenImage', 'snapPoint', 'pointInPolygon', 'canDrawWater', 'waterDraftChanged', 'cancelWaterDrawing', 'finishWaterPolygon', 'initTouchEvents', 'beginTokenDrag', 'cancelTokenDrag', 'reconcileTokenDrag', 'displayTokens', 'noteTokenAt', 'glideToken', 'nudgeSelectedToken', 'showMoveDistance', 'renderMovementPreview', 'renderMoveDistance', 'sceneDarkness', 'darknessAt', 'visionTokens', 'initEvents', 'handleDoubleAction', 'triggerPing', 'triggerFX', 'setAttackTarget', 'triggerAttackFX', 'startLoop', 'render', 'renderHoveredConditionTooltip', 'renderWaterZones', 'renderRainOverlay', 'renderFogOverlay', 'renderGrid', 'renderGridCalibrationGuide', 'isTokenVisibleToPlayers', 'knownArea', 'isNight', 'partySees', 'isPointInPlayerVision', 'projectPointToSegment', 'distToSegment', 'checkLineIntersection', 'renderWalls', 'switchAt', 'useSwitch', 'renderSwitches', 'renderLightMarkers', 'renderTokens', 'drawTokenFrame', 'drawClassBanner', 'renderGhostToken', 'renderAttackTargeting', 'isHorrorToken', 'renderSensoryVision', 'resolveTokenStat', 'canSeeVitals', 'renderTokenVitals', 'renderCardAreas', 'renderTemplate', 'renderRuler', 'renderEffectMarkers', 'renderParticlesAndPings',
  'onKeyDown', 'onDrop', 'onContextMenu', 'onMouseDown', 'onMouseMove', 'onMouseUp'];

test('every method of the engine is still there, as a method of the class (not enumerable)', () => {
  const proto = CanvasEngine.prototype;
  for (const name of METHODS) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, name);
    assert.ok(descriptor && typeof descriptor.value === 'function', `CanvasEngine.${name}`);
    assert.equal(descriptor.enumerable, false, `${name} behaves like a class method`);
  }
  assert.equal(WATER_DEPTH_NAMES.length, 6, 'the inspector still imports the water depths from canvasEngine.js');
});

test('the core stays small and each module keeps to one part of the map', () => {
  const lines = path => readFileSync(new URL(path, import.meta.url), 'utf8').split('\n').length;
  assert.ok(lines('../src/canvasEngine.js') <= 900, `canvasEngine.js has ${lines('../src/canvasEngine.js')} lines: new map code goes into src/canvas/`);
  const modules = readdirSync(new URL('../src/canvas/', import.meta.url)).filter(f => f.endsWith('.js'));
  assert.ok(modules.length >= 10);
  for (const file of modules) assert.ok(lines(`../src/canvas/${file}`) <= 800, `src/canvas/${file} has ${lines(`../src/canvas/${file}`)} lines: split it`);
});
