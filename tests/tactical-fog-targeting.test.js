import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body><div id="app"></div></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent']) {
  globalThis[key] = dom.window[key];
}

// Mock Canvas 2D context for jsdom in node test runner
if (dom.window.HTMLCanvasElement) {
  dom.window.HTMLCanvasElement.prototype.getContext = function (type) {
    if (type !== '2d') return null;
    const canvas = this;
    const pixels = canvas._pixels || (canvas._pixels = new Map());

    return {
      canvas,
      fillStyle: '#000000',
      globalCompositeOperation: 'source-over',
      clearRect(x, y, w, h) { pixels.clear(); },
      fillRect(x, y, w, h) {
        for (let px = Math.max(0, x); px < Math.min(canvas.width, x + w); px += 4) {
          for (let py = Math.max(0, y); py < Math.min(canvas.height, y + h); py += 4) {
            pixels.set(`${px},${py}`, [255, 255, 255, 255]);
          }
        }
      },
      save() {},
      restore() {},
      beginPath() { this._poly = []; },
      moveTo(x, y) { this._poly.push({ x, y }); },
      lineTo(x, y) { this._poly.push({ x, y }); },
      closePath() {},
      fill() {
        if (this._poly && this._poly.length >= 3) {
          // Stamp interior points
          const minX = Math.min(...this._poly.map(p => p.x));
          const maxX = Math.max(...this._poly.map(p => p.x));
          const minY = Math.min(...this._poly.map(p => p.y));
          const maxY = Math.max(...this._poly.map(p => p.y));
          for (let x = Math.max(0, minX); x <= Math.min(canvas.width, maxX); x++) {
            for (let y = Math.max(0, minY); y <= Math.min(canvas.height, maxY); y++) {
              pixels.set(`${x},${y}`, [255, 255, 255, 255]);
            }
          }
        }
      },
      getImageData(x, y, w, h) {
        const val = pixels.get(`${x},${y}`) || [0, 0, 0, 0];
        return { data: new Uint8ClampedArray(val) };
      },
      drawImage() {}
    };
  };
}

const { store } = await import('../src/state.js');
await store.ready;
const { FogOfWarEngine } = await import('../src/fogEngine.js');
const { FXEngine } = await import('../src/fxEngine.js');
const { LayerManagerHUD } = await import('../src/layerManager.js');

test('fog of war: default explored opacity is 50% and adjustable between 5% and 95%', () => {
  assert.equal(store.getState().fogExploredOpacity, 0.50, 'Default explored opacity should be 50% (0.50)');

  store.setFogExploredOpacity(0.35);
  assert.equal(store.getState().fogExploredOpacity, 0.35);

  store.setFogExploredOpacity(0.75);
  assert.equal(store.getState().fogExploredOpacity, 0.75);

  // Boundary clamping
  store.setFogExploredOpacity(0.01);
  assert.equal(store.getState().fogExploredOpacity, 0.05);

  store.setFogExploredOpacity(0.99);
  assert.equal(store.getState().fogExploredOpacity, 0.95);

  store.setFogExploredOpacity(0.50);
});

test('fog of war engine: unvisited points are dark, stamped polygons explore points and walls', () => {
  const fog = new FogOfWarEngine();
  const mapId = 'test_map_fog';

  // Initially unvisited coordinates return false
  assert.equal(fog.isPointExplored(100, 100, mapId), false);

  const canvas = fog.getExploredCanvas(mapId, 800, 600);
  const ctx = canvas.getContext('2d');

  // Stamp a square from (50, 50) to (150, 150)
  fog.stampExploration(ctx, [
    { x: 50, y: 50 },
    { x: 150, y: 50 },
    { x: 150, y: 150 },
    { x: 50, y: 150 }
  ]);

  // Center point (100, 100) is now explored
  assert.equal(fog.isPointExplored(100, 100, mapId), true);

  // Far away point (500, 500) remains unexplored
  assert.equal(fog.isPointExplored(500, 500, mapId), false);

  // Wall with both endpoints or midpoint inside explored zone is explored
  const insideWall = { x1: 60, y1: 60, x2: 120, y2: 120, wallType: 'door' };
  assert.equal(fog.isWallExplored(insideWall, mapId), true);

  // Wall completely outside is unexplored
  const outsideWall = { x1: 400, y1: 400, x2: 450, y2: 450, wallType: 'wall' };
  assert.equal(fog.isWallExplored(outsideWall, mapId), false);
});

test('layer manager HUD: displays Fog of War and Weather Overlay sections distinctly', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  store.state.userRole = 'keeper';

  const hud = new LayerManagerHUD(container);
  hud.isMinimized = false;
  hud.render();

  // Fog of War elements
  const fowSection = container.querySelector('.layer-fow-section');
  assert.ok(fowSection, 'Fog of War section should exist');
  assert.match(fowSection.textContent, /NIEBLA DE COMBATE/);

  const fowToggle = container.querySelector('#btn_toggle_fow_layer');
  assert.ok(fowToggle, 'Toggle FOW button should exist');

  const fowSlider = container.querySelector('#input_fow_opacity');
  assert.ok(fowSlider, 'FOW explored opacity slider should exist');
  assert.equal(fowSlider.min, '10');
  assert.equal(fowSlider.max, '90');

  // Weather overlay section
  const weatherSection = container.querySelector('.layer-weather-section');
  assert.ok(weatherSection, 'Weather overlay section should exist');
  assert.match(weatherSection.textContent, /WEATHER OVERLAY/);

  const rainBtn = container.querySelector('#layer_btn_toggle_rain');
  assert.ok(rainBtn, 'Rain overlay button should exist');

  const fogBtn = container.querySelector('#layer_btn_toggle_fog');
  assert.ok(fogBtn, 'Atmospheric mist button should exist');
  assert.match(fogBtn.textContent, /BRUMA/);

  container.remove();
});

test('fx engine: triggers weapon attack FX and scalable explosion', () => {
  const fx = new FXEngine();

  // Test trigger for weapon types
  fx.trigger('plasma', { x: 10, y: 10, targetX: 200, targetY: 200 });
  fx.trigger('ballistic', { x: 10, y: 10, targetX: 200, targetY: 200 });
  fx.trigger('melee', { x: 10, y: 10, targetX: 200, targetY: 200 });
  fx.trigger('void_beam', { x: 10, y: 10, targetX: 200, targetY: 200 });
  fx.trigger('laser', { x: 10, y: 10, targetX: 200, targetY: 200 });

  assert.ok(fx.particles.length > 0, 'Weapon triggers should generate particles');

  // Test scalable explosion
  const initialShockwaves = fx.shockwaves.length;
  fx.trigger('explosion', { x: 100, y: 100, intensity: 2.5 });
  assert.ok(fx.shockwaves.length > initialShockwaves, 'Explosion should generate shockwaves');
  const latestWave = fx.shockwaves[fx.shockwaves.length - 1];
  assert.ok(latestWave.maxRadius >= 180 * 2.0, 'Shockwave maxRadius should scale with intensity');
});

test('token reserve system: send to reserve, deploy to scene and delete permanently', () => {
  const activeMapId = store.getState().activeMapId;
  const initialActiveCount = store.getTokensForActiveMap().length;
  const initialReserveCount = store.getReserveTokens().length;

  // 1. Add a new token
  const testToken = store.addToken({
    name: 'Operativo Alpha',
    actorType: 'player',
    isPlayer: true,
    hp: { current: 10, max: 10, majorThreshold: 5, severeThreshold: 10 },
    x: 200,
    y: 200
  });

  assert.ok(testToken, 'Token should be created');
  assert.equal(store.getTokensForActiveMap().length, initialActiveCount + 1);

  // 2. Send token to reserve
  store.update({ selectedTokenId: testToken.id });
  assert.equal(store.getState().selectedTokenId, testToken.id);

  const sent = store.sendTokenToReserve(testToken.id);
  assert.equal(sent, true);
  assert.equal(store.getState().selectedTokenId, null, 'Deselects when sent to reserve');
  assert.equal(store.getTokensForActiveMap().length, initialActiveCount, 'Token not on active map');
  assert.equal(store.getReserveTokens().length, initialReserveCount + 1, 'Token in reserve pool');

  const reserveTok = store.getState().tokens.find(t => t.id === testToken.id);
  assert.equal(reserveTok.mapId, 'reserve');
  assert.equal(reserveTok.inReserve, true);
  assert.equal(reserveTok.lastMapId, activeMapId);

  // 3. Deploy token back from reserve
  const deployed = store.deployTokenFromReserve(testToken.id, 750, 550);
  assert.equal(deployed, true);
  assert.equal(store.getState().selectedTokenId, testToken.id, 'Selected upon deployment');
  assert.equal(store.getTokensForActiveMap().length, initialActiveCount + 1);
  assert.equal(store.getReserveTokens().length, initialReserveCount);

  const deployedTok = store.getState().tokens.find(t => t.id === testToken.id);
  assert.equal(deployedTok.mapId, activeMapId);
  assert.equal(deployedTok.inReserve, false);
  assert.equal(deployedTok.x, 750);
  assert.equal(deployedTok.y, 550);

  // 4. Delete token permanently
  store.deleteToken(testToken.id);
  assert.equal(store.getState().tokens.some(t => t.id === testToken.id), false, 'Token permanently removed');
  assert.equal(store.getTokensForActiveMap().length, initialActiveCount);
});

test('map load progress and multiplayer scene synchronization telemetry', async () => {
  const { network } = await import('../src/networkManager.js');
  const { openMapSyncTelemetryModal } = await import('../src/sessionLobby.js');

  // 1. Broadcast map load progress
  let receivedEvent = null;
  const listener = (e) => { receivedEvent = e.detail; };
  window.addEventListener('veil:map-load-status', listener);

  network.broadcastMapLoadStatus({
    mapId: 'map-test-1',
    progress: 45,
    loaded: false,
    text: '3.2 / 7.1 MB'
  });

  assert.ok(receivedEvent, 'Event veil:map-load-status should be dispatched');
  assert.equal(receivedEvent.progress, 45);
  assert.equal(receivedEvent.loaded, false);
  assert.equal(receivedEvent.text, '3.2 / 7.1 MB');

  // Verify status is tracked in network.mapLoadStatuses
  const myStatus = network.mapLoadStatuses.get(receivedEvent.peerId);
  assert.ok(myStatus, 'Map status should be stored in network.mapLoadStatuses');
  assert.equal(myStatus.progress, 45);

  // 2. Broadcast completed load
  network.broadcastMapLoadStatus({
    mapId: 'map-test-1',
    progress: 100,
    loaded: true,
    text: 'Listo'
  });
  assert.equal(receivedEvent.progress, 100);
  assert.equal(receivedEvent.loaded, true);

  // 3. Open telemetry modal
  const modal = openMapSyncTelemetryModal();
  assert.ok(modal, 'Telemetry modal should be returned and created');
  assert.match(modal.textContent, /TELEMETRÍA/i);
  assert.match(modal.textContent, /SINCRONIZACIÓN DE MATRIZ TÁCTICA/i);
  assert.match(modal.textContent, /100%/);
  modal.remove();

  window.removeEventListener('veil:map-load-status', listener);
});

test('cloudinary service: configuration, local persistence and auto-optimization url formatting', async () => {
  const { getCloudinaryConfig, saveCloudinaryConfig, uploadToCloudinary } = await import('../src/cloudinaryService.js');

  // Save config in localStorage
  saveCloudinaryConfig('veilfarers_cloud', 'veilfarers_preset');
  const cfg = getCloudinaryConfig();
  assert.equal(cfg.cloudName, 'veilfarers_cloud');
  assert.equal(cfg.preset, 'veilfarers_preset');
  assert.equal(cfg.isConfigured, true);

  // Test upload formatting
  const mockFile = new Blob(['mock image data'], { type: 'image/png' });
  const result = await uploadToCloudinary(mockFile);
  assert.ok(result.url.includes('/upload/f_auto,q_auto/'), 'Url should include auto-format and auto-quality transformation');
  assert.ok(result.url.includes('veilfarers_cloud'));

  // Clean up
  saveCloudinaryConfig('', '');
  const cleared = getCloudinaryConfig();
  assert.equal(cleared.cloudName, '');
  assert.equal(cleared.isConfigured, false);
});
