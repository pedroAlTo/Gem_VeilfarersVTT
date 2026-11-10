// src/canvasEngine.js
// High-Resolution Tactical Canvas Engine with Water Depths (0-5), Editable Walls & Lights,
// Drag-Resizable Templates, Expanded Particle FX, and Multi-Layer Support

import { LightingEngine } from './lightingEngine.js';
import { drawWaterSurface, traceWater, waterBounds, drawRainRipples, renderWeatherRain, renderWeatherFog } from './surfaceFX.js';
import { drawTokenGauge } from './tokenVitals.js';
import { drawTokenConditions } from './conditions.js';
import { FXEngine } from './fxEngine.js';
import { FogOfWarEngine } from './fogEngine.js';
import { store } from './state.js';
import { isPartyToken } from './tokenPermissions.js';
import { network } from './networkManager.js';
import { audio } from './audioEngine.js';
import { undoManager } from './undoManager.js';
import { pointInWater } from './waterGeometry.js';
import { notify } from './ui.js';

export const WATER_DEPTH_NAMES = [
  'Pond / Puddle (0-10cm)',
  'Ankle-Deep Stream (10-30cm)',
  'Knee-Deep Shallows (0.5m)',
  'Waist-Deep Swamp / Cryo (1m)',
  'Chest-Deep Submerged (1.5-2m)',
  'Void Abyss / Pearl Trench (Very Deep)'
];

export const WATER_DEPTH_COLORS = [
  'rgba(56, 189, 248, 0.28)',  // 0: Pond
  'rgba(14, 165, 233, 0.40)',  // 1: Ankle
  'rgba(2, 132, 199, 0.52)',   // 2: Knee
  'rgba(3, 105, 161, 0.65)',   // 3: Waist
  'rgba(30, 58, 138, 0.78)',   // 4: Chest
  'rgba(10, 15, 45, 0.92)'     // 5: Abyss
];

export class CanvasEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.lighting = new LightingEngine();
    this.fog = new FogOfWarEngine();

    // Camera / Transform
    this.zoom = 1.0;
    this.panX = 100;
    this.panY = 60;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    // Map Cache
    this.currentMapId = null;
    this.mapImage = new Image();
    this.isMapLoaded = false;
    this.tokenImages = new Map();

    // Drag / Edit State
    this.draggedToken = null;
    this.draggedWall = null; // { wall, handle: 'p1'|'p2'|'mid', startX, startY }
    this.draggedLight = null; // { light, handle: 'center'|'radius', startX, startY }
    this.draggedEffect = null; // { effect, handle: 'center'|'radius', startX, startY }
    this.draggedWater = null; // { zone, handle: 'center'|'se', startX, startY }
    this.draggedTemplate = null; // { template, handle: 'transform'|'move'|'aperture'|'width' }
    this.preDragSnapshot = null;

    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.isSpacePressed = false;

    // Creation In-Progress
    this.rulerStart = null;
    this.rulerCurrent = null;
    this.templates = [];
    this.activeTemplate = null; // { id, type, x, y, radius, length, angle, width }
    this.wallStart = null;
    this.wallCurrent = null;
    this.waterStart = null;
    this.waterCurrent = null;
    this.waterPolyPoints = [];

    // Fog of War Ghost Memory (Enemy last known positions in explored areas)
    this.lastKnownEnemyPositions = new Map();

    // Tactical Attack Targeting
    this.attackTarget = null; // { attackerId, targetId }
    this.cursorWorld = null;

    // AAA Particle FX & Pings
    this.fx = new FXEngine();
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.pings = [];

    // Loop
    this.lastTime = performance.now();
    this.animFrameId = null;

    this.initEvents();
    this.initTouchEvents();
    this.resize();
    this.startLoop();

    window.veilCanvas = this;
  }

  resize() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.displayWidth = w;
    this.displayHeight = h;
  }

  loadMap(mapData) {
    const campaignId = store.getState().campaignId;
    const key = `${campaignId}:${mapData.id}:${mapData.imageUrl}`;
    if (this.currentMapKey === key) return;
    this.cancelWaterDrawing();
    if (this.currentCampaignId !== campaignId) {
      this.templates = []; this.pings = []; this.activeTemplate = null;
      this.fx.particles = []; this.fx.lightningBolts = []; this.fx.shockwaves = []; this.fx.voidRifts = []; this.fx.emitterTimers.clear();
      for (const name of ['draggedToken', 'draggedWall', 'draggedLight', 'draggedEffect', 'draggedWater', 'draggedTemplate', 'preDragSnapshot']) this[name] = null;
    }
    this.currentCampaignId = campaignId;
    this.currentMapKey = key;
    this.currentMapId = mapData.id;
    this.isMapLoaded = false;

    this.mapImage = new Image();
    this.mapImage.onload = () => {
      if (this.currentMapKey !== key) return;
      this.isMapLoaded = true;
      this.fitMapToViewport();
    };
    this.mapImage.onerror = () => { if (this.currentMapKey === key) this.isMapLoaded = false; };
    this.mapImage.src = mapData.imageUrl;
  }

  fitMapToViewport() {
    if (!this.mapImage || this.mapImage.width === 0) return;
    const padding = 40;
    const availW = Math.max(200, this.displayWidth - padding * 2);
    const availH = Math.max(200, this.displayHeight - padding * 2);
    const scaleX = availW / this.mapImage.width;
    const scaleY = availH / this.mapImage.height;
    this.zoom = Math.min(scaleX, scaleY);
    this.panX = (this.displayWidth - this.mapImage.width * this.zoom) / 2;
    this.panY = (this.displayHeight - this.mapImage.height * this.zoom) / 2;
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom
    };
  }

  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this.panX,
      y: wy * this.zoom + this.panY
    };
  }

  getTokenImage(url) {
    if (!url) return null;
    if (this.tokenImages.has(url)) return this.tokenImages.get(url);
    const img = new Image();
    img.src = url;
    this.tokenImages.set(url, img);
    return img;
  }

  // --- Enhanced Snapping System (Grid, Anchor Vertices, Objects) ---
  snapPoint(x, y, threshold = 16, excludeWallId = null) {
    const state = store.getState();
    const map = store.getActiveMap() || {};

    const excludeSet = Array.isArray(excludeWallId) ? new Set(excludeWallId) : (excludeWallId ? new Set([excludeWallId]) : null);

    // 1. Snap to Anchor points (Vertices of walls, doors, windows)
    if (state.snapToAnchors !== false) {
      let nearestAnchor = null;
      let minDist = threshold;
      for (const w of (map.walls || [])) {
        if (excludeSet && excludeSet.has(w.id)) continue;
        const d1 = Math.hypot(x - w.x1, y - w.y1);
        if (d1 < minDist) {
          minDist = d1;
          nearestAnchor = { x: w.x1, y: w.y1 };
        }
        const d2 = Math.hypot(x - w.x2, y - w.y2);
        if (d2 < minDist) {
          minDist = d2;
          nearestAnchor = { x: w.x2, y: w.y2 };
        }
      }
      if (nearestAnchor) return { x: nearestAnchor.x, y: nearestAnchor.y, snapped: 'anchor' };
    }

    // 2. Snap to Objects (Tokens, Lights, Effects centers)
    if (state.snapToObjects) {
      let nearestObj = null;
      let minDist = threshold;
      for (const tok of store.getTokensForActiveMap()) {
        if (this.draggedToken && tok.id === this.draggedToken.id) continue;
        const d = Math.hypot(x - tok.x, y - tok.y);
        if (d < minDist) {
          minDist = d;
          nearestObj = { x: tok.x, y: tok.y };
        }
      }
      for (const l of (map.lights || [])) {
        const d = Math.hypot(x - l.x, y - l.y);
        if (d < minDist) {
          minDist = d;
          nearestObj = { x: l.x, y: l.y };
        }
      }
      if (nearestObj) return { x: nearestObj.x, y: nearestObj.y, snapped: 'object' };
    }

    // 3. Snap to Grid (Half-grid and grid intersections)
    if ((state.gridSnap || state.snapToGrid) && map.gridSize) {
      const step = map.gridSize / 2;
      return {
        x: Math.round(x / step) * step,
        y: Math.round(y / step) * step,
        snapped: 'grid'
      };
    }

    return { x, y, snapped: false };
  }

  // --- Point In Polygon Helper (Ray-casting Algorithm) ---
  pointInPolygon(px, py, points) {
    if (!points || points.length < 3) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // --- Tablet & Mobile Touch Gestures ---
  canDrawWater() {
    const state = store.getState();
    return state.activeTool === 'water' && state.userRole === 'keeper' && store.sessionRole !== 'player' &&
      state.layerVisibility.water !== false && !state.layerLocked.water;
  }

  waterDraftChanged() {
    window.dispatchEvent(new CustomEvent('veil:water-draft'));
  }

  cancelWaterDrawing() {
    if (this.waterStart || this.waterPolyPoints?.length) this.preDragSnapshot = null;
    this.waterStart = null; this.waterCurrent = null; this.waterPolyPoints = [];
    this.waterDraftChanged();
  }

  finishWaterPolygon() {
    if (!this.canDrawWater() || store.state.waterDrawMode !== 'polygon') return false;
    try {
      const zone = store.addWaterZone({ name:'Aquatic Hazard', shape:'polygon', points:this.waterPolyPoints, depth:2 });
      if (!zone) return false;
      this.cancelWaterDrawing();
      return true;
    } catch (error) { notify(error.message, 'error'); return false; }
  }

  initTouchEvents() {
    let lastTouchDistance = 0;
    let isPinching = false;
    let pinchCenterWorld = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let longPressTimer = null;
    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;

    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    this.canvas.addEventListener('touchstart', (e) => {
      clearLongPress();

      if (e.touches.length === 2) {
        this.cancelWaterDrawing();
        isPinching = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        lastTouchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = this.canvas.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        pinchCenterWorld = this.screenToWorld(midX, midY);
        e.preventDefault();
      } else if (e.touches.length === 1) {
        isPinching = false;
        touchMoved = false;
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        // Double Tap Detection (Mobile & Tablets)
        const now = Date.now();
        const timeDiff = now - lastTapTime;
        const distFromLastTap = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);
        if (timeDiff < 480 && timeDiff > 40 && distFromLastTap < 48) {
          clearLongPress();
          if (e.cancelable) e.preventDefault();
          const rect = this.canvas.getBoundingClientRect();
          const sx = touch.clientX - rect.left;
          const sy = touch.clientY - rect.top;
          const world = this.screenToWorld(sx, sy);
          this.handleDoubleAction(world.x, world.y, e);
          lastTapTime = 0;
          return;
        }
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;
        lastTapTime = now;

        // Long Press Detection (Hold for 500ms)
        longPressTimer = setTimeout(() => {
          if (!touchMoved && !isPinching) {
            const rect = this.canvas.getBoundingClientRect();
            const sx = lastTouchX - rect.left;
            const sy = lastTouchY - rect.top;
            const world = this.screenToWorld(sx, sy);
            const state = store.getState();
            const map = store.getActiveMap() || {};
            const gridSize = map.gridSize || 64;
            const tokens = state.tokens.filter(t => t.mapId === state.activeMapId);

            for (let i = tokens.length - 1; i >= 0; i--) {
              const tok = tokens[i];
              const radius = (tok.size * gridSize) / 2;
              if (Math.hypot(world.x - tok.x, world.y - tok.y) <= radius) {
                if (window.veilTokenHUD) {
                  window.veilTokenHUD.openCharacterSheetModal(tok);
                }
                break;
              }
            }
          }
        }, 500);

        const mouseEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        this.canvas.dispatchEvent(mouseEvent);
        e.preventDefault();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && isPinching) {
        clearLongPress();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const curDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = this.canvas.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

        if (lastTouchDistance > 0 && pinchCenterWorld) {
          const factor = curDist / lastTouchDistance;
          this.zoom = Math.max(0.12, Math.min(4.5, this.zoom * factor));
          this.panX = midX - pinchCenterWorld.x * this.zoom;
          this.panY = midY - pinchCenterWorld.y * this.zoom;
          pinchCenterWorld = this.screenToWorld(midX, midY);
        }
        lastTouchDistance = curDist;
        e.preventDefault();
      } else if (e.touches.length === 1 && !isPinching) {
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;

        if (Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY) > 8) {
          touchMoved = true;
          clearLongPress();
        }

        const mouseEvent = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        this.canvas.dispatchEvent(mouseEvent);
        e.preventDefault();
      }
    }, { passive: false });

    const endTouch = (e) => {
      clearLongPress();
      if (e.type === 'touchcancel') this.cancelWaterDrawing();
      if (e.touches && e.touches.length < 2) {
        isPinching = false;
        lastTouchDistance = 0;
        pinchCenterWorld = null;
      }
      const mouseEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: lastTouchX,
        clientY: lastTouchY,
        button: 0
      });
      this.canvas.dispatchEvent(mouseEvent);
      window.dispatchEvent(mouseEvent);
      if (e.cancelable) e.preventDefault();
    };

    this.canvas.addEventListener('touchend', endTouch, { passive: false });
    this.canvas.addEventListener('touchcancel', endTouch, { passive: false });
  }

  initEvents() {
    const waterContext = s => JSON.stringify([s.campaignId,s.activeMapId,s.activeTool,s.waterDrawMode,s.userRole,s.activeLayer,s.layerVisibility.water,s.layerLocked.water]);
    let previousWaterContext = waterContext(store.state);
    this.waterUnsubscribe = store.subscribe(state => {
      const context = waterContext(state);
      if (context !== previousWaterContext) { previousWaterContext = context; this.cancelWaterDrawing(); }
    });
    window.addEventListener('blur', () => { this.cancelWaterDrawing(); this.isSpacePressed=false; this.isPanning=false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.cancelWaterDrawing(); });
    this.canvas.addEventListener('pointercancel', () => this.cancelWaterDrawing());
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resize(), 120);
    });

    // Keyboard Hotkeys
    window.addEventListener('keydown', (e) => {
    if(e.defaultPrevented || e.target.closest?.('vf-select,.orbital-listbox,.veil-modal-backdrop,[contenteditable="true"]'))return;
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (e.target.closest?.('button') && (e.key === 'Enter' || e.code === 'Space')) return;

      if (e.code === 'Space' && !e.repeat) {
        this.isSpacePressed = true;
        this.canvas.style.cursor = 'grab';
      }

      // Delete key deletes active area template or selected wall/light/water zone
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.key === 'Backspace' && this.canDrawWater() && this.waterPolyPoints.length) {
          e.preventDefault(); this.waterPolyPoints.pop(); this.waterDraftChanged(); return;
        }
        if (this.activeTemplate) {
          undoManager.pushCurrentState('Eliminar Plantilla de Área');
          this.templates = this.templates.filter(t => t.id !== this.activeTemplate.id);
          this.activeTemplate = null;
          audio.playClockTick();
          return;
        }
        const state = store.getState();
        if (state.userRole === 'keeper') {
          if (state.selectedWallId) {
            store.deleteWall(state.selectedWallId);
            audio.playLaserShot();
          } else if (state.selectedLightId) {
            store.deleteLight(state.selectedLightId);
            audio.playLaserShot();
          } else if (state.selectedEffectId) {
            store.deleteEffect(state.selectedEffectId);
            audio.playLaserShot();
          } else if (state.selectedWaterId) {
            store.deleteWaterZone(state.selectedWaterId);
          }
        }
      }

      // Enter closes in-progress polygon water drawing
      if ((e.key === 'Enter' || e.code === 'Enter') && this.canDrawWater() && this.waterPolyPoints.length) {
        e.preventDefault(); this.finishWaterPolygon();
      }

      // Escape cancels template, ruler, wall, or water placement
      if (e.code === 'Escape') {
        this.activeTemplate = null;
        this.rulerStart = null;
        this.wallStart = null;
        this.cancelWaterDrawing();
        store.update({ selectedWallId: null, selectedLightId: null, selectedWaterId: null, selectedEffectId: null, selectedTemplateId: null });
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.canvas.style.cursor = 'default';
      }
    });

    // Double-click handler (Desktop mouse)
    this.canvas.addEventListener('dblclick', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);
      this.handleDoubleAction(world.x, world.y, e);
    });

    // Drag and Drop Images directly onto Canvas
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      this.canvas.classList.add('canvas-drag-over');
    });

    this.canvas.addEventListener('dragleave', () => {
      this.canvas.classList.remove('canvas-drag-over');
    });

    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      this.canvas.classList.remove('canvas-drag-over');
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);
      const tokens = store.getTokensForActiveMap();
      const map = store.getActiveMap();
      const gridSize = map.gridSize || 64;

      // Check if dropped onto a token
      let hitToken = null;
      for (let i = tokens.length - 1; i >= 0; i--) {
        const tok = tokens[i];
        const radius = (tok.size * gridSize) / 2;
        if (Math.hypot(world.x - tok.x, world.y - tok.y) <= radius) {
          hitToken = tok;
          break;
        }
      }

      const reader = new FileReader();
      reader.onload = (re) => {
        const dataUrl = re.target.result;
        if (hitToken) {
          // Update token portrait
          store.updateToken(hitToken.id, { avatarUrl: dataUrl });
          network.broadcast({ type: 'TOKEN_UPDATE', tokenId: hitToken.id, partial: { avatarUrl: dataUrl } });
          audio.playSparkle();
          store.addLog({
            sender: 'Tactical Canvas',
            type: 'TOKEN_CUSTOMIZE',
            title: `Token Portrait Updated: [${hitToken.name}]`,
            details: `Custom portrait asset applied.`
          });
        } else {
          // Update map image
          const testImg = new Image();
          testImg.onload = () => {
            const w = testImg.naturalWidth || 2000;
            const h = testImg.naturalHeight || 2000;
            store.updateActiveMap({
              imageUrl: dataUrl,
              width: w,
              height: h,
              name: file.name.replace(/\.[^/.]+$/, '')
            });
            network.broadcast({ type: 'MAP_CHANGE', mapId: map.id });
            audio.playLaserShot();
            store.addLog({
              sender: 'Tactical Canvas',
              type: 'SCENE_DEPLOY',
              title: `Battlemap Dropped & Deployed: [${file.name}]`,
              details: `Tactical scene texture updated (${w} x ${h} px).`
            });
          };
          testImg.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    });

    // MOUSE DOWN
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);
      this.cursorWorld = world;
      const state = store.getState();
      const map = store.getActiveMap();
      const isKeeper = state.userRole === 'keeper';

      // Pan with Middle Click, Right Click, or Space + Left Click
      if (e.button === 1 || e.button === 2 || this.isSpacePressed) {
        this.isPanning = true;
        this.panStartX = sx - this.panX;
        this.panStartY = sy - this.panY;
        this.canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }

      if (e.button === 0) {
        this.preDragSnapshot = undoManager.captureSnapshot('Acción Táctica');
        // Alt + Click triggers tactical ping
        if (e.altKey || state.activeTool === 'ping') {
          this.triggerPing(world.x, world.y, isKeeper ? '#ff3366' : '#00f3ff');
          network.broadcast({
            type: 'PING',
            x: world.x,
            y: world.y,
            color: isKeeper ? '#ff3366' : '#00f3ff'
          });
          audio.playPing();
          return;
        }

        // Measure Ruler
        if (state.activeTool === 'measure') {
          this.rulerStart = world;
          this.rulerCurrent = world;
          return;
        }

        // FX Tool: Trigger AAA particle effect at click
        if (state.activeTool === 'fx') {
          this.triggerFX(state.activeFxType || 'lightning', {
            x: world.x,
            y: world.y,
            targetX: world.x + (Math.random() - 0.5) * 260,
            targetY: world.y + (Math.random() - 0.5) * 260
          });
          network.broadcast({
            type: 'SPECIAL_FX',
            fxType: state.activeFxType || 'lightning',
            params: { x: world.x, y: world.y }
          });
          return;
        }

        // FX Emitter Tool (Keeper): Place persistent particle anomaly element
        if (state.activeTool === 'fx_emitter' && isKeeper) {
          const isLaser = state.activeFxType === 'laser';
          const newFx = store.addEffect({
            type: state.activeFxType || 'void_rift',
            shape: isLaser ? 'line' : 'circle',
            label: isLaser ? 'Tactical Laser Beam' : state.activeFxType === 'void_rift' ? 'Black Hole Singularity' : state.activeFxType === 'radiant' ? 'Radiant Light Core' : 'Tactical Anomaly',
            x: Math.round(world.x),
            y: Math.round(world.y),
            x2: Math.round(world.x + (isLaser ? 260 : 160)),
            y2: Math.round(world.y),
            beamWidth: isLaser ? 6 : 4,
            color: isLaser ? '#ef4444' : '#00f3ff',
            radius: 140,
            intensity: 1.0,
            active: true
          });
          store.update({ selectedEffectId: newFx.id, activeTool: 'select' });
          audio.playClockTick();
          return;
        }

        // Grid Scaler / Calibration Tool (Keeper): Drag to measure & set exact cell size
        if (state.activeTool === 'grid_scale' && isKeeper) {
          this.gridCalibStart = { x: world.x, y: world.y };
          this.gridCalibCurrent = { x: world.x, y: world.y };
          return;
        }

        // Water Creation Tool (Keeper)
        if (state.activeTool === 'water') {
          if (!this.canDrawWater()) return;
          const mode = state.waterDrawMode || 'box';
          if (mode === 'polygon') {
            // Browser double-clicks contain a second mousedown; it is not another vertex.
            if (e.detail > 1) return;
            // If clicking near first point and has >= 3 points, close polygon
            if (this.waterPolyPoints.length >= 3) {
              const firstPt = this.waterPolyPoints[0];
              if (Math.hypot(world.x - firstPt.x, world.y - firstPt.y) <= 12 / this.zoom) {
                this.finishWaterPolygon();
                return;
              }
            }
            const last = this.waterPolyPoints.at(-1);
            if (last && Math.hypot(world.x-last.x,world.y-last.y) < 2/this.zoom) return;
            if (this.waterPolyPoints.length >= 512) { notify('Máximo 512 vértices. Cierra el polígono o quita el último con Retroceso.', 'error'); return; }
            this.waterPolyPoints.push({ x: Math.round(world.x), y: Math.round(world.y) });
            this.waterDraftChanged();
            return;
          } else {
            this.waterStart = world;
            this.waterCurrent = world;
            this.waterDraftChanged();
            return;
          }
        }

        // Wall Creation Tool (Keeper)
        if (state.activeTool === 'wall' && isKeeper) {
          const snapped = this.snapPoint(world.x, world.y, 16);
          this.wallStart = { x: snapped.x, y: snapped.y };
          this.wallCurrent = { x: snapped.x, y: snapped.y };
          return;
        }

        // Light Placement Tool (Keeper)
        if (state.activeTool === 'light' && isKeeper) {
          const newLight = {
            id: 'light_' + Date.now(),
            x: Math.round(world.x),
            y: Math.round(world.y),
            radius: 260,
            color: '#00f3ff',
            intensity: 0.9,
            effect: 'pulse',
            pulseSpeed: 1.5,
            label: 'Tactical Light'
          };
          store.updateActiveMap({ lights: [...(map.lights || []), newLight] });
          store.update({ selectedLightId: newLight.id, activeTool: 'select', activeLayer: 'walls_lights' });
          return;
        }

        // Select / Template Tool Interaction Check
        if (state.activeTool === 'select' || state.activeTool === 'template') {
          // 0. Check Eye Controller Handle (Facing Angle / Directional FOV) on Selected Token
          const allTokens = store.getTokensForActiveMap();
          const selectedTok = allTokens.find(t => t.id === state.selectedTokenId);
          if (selectedTok && store.canEditToken(selectedTok.id)) {
            const tokR = ((selectedTok.size || 1) * (map.gridSize || 64)) / 2;
            const fAngle = selectedTok.facingAngle ?? 0;
            const arrowDist = tokR + 20;
            const arrowX = selectedTok.x + Math.cos(fAngle) * arrowDist;
            const arrowY = selectedTok.y + Math.sin(fAngle) * arrowDist;
            if (Math.hypot(world.x - arrowX, world.y - arrowY) <= 18) {
              this.draggedTokenFacing = selectedTok;
              return;
            }
          }

          // 0b. TOKENS HAVE MAXIMUM PREFERENCE OVER ANY OTHER ELEMENT
          const gridSize = map.gridSize || 64;
          let clickedToken = null;
          for (let i = allTokens.length - 1; i >= 0; i--) {
            const tok = allTokens[i];
            const radius = ((tok.size || 1) * gridSize) / 2;
            const dist = Math.hypot(world.x - tok.x, world.y - tok.y);
            if (dist <= radius) {
              if (!isKeeper && !tok.isPlayer && !this.isTokenVisibleToPlayers(tok, allTokens, map)) {
                continue;
              }
              clickedToken = tok;
              break;
            }
          }

          if (clickedToken) {
            const canMove = store.canEditToken(clickedToken.id);
            if (canMove) {
              this.draggedToken = clickedToken;
              this.draggedTokenOrigX = clickedToken.x;
              this.draggedTokenOrigY = clickedToken.y;
              this.dragOffsetX = world.x - clickedToken.x;
              this.dragOffsetY = world.y - clickedToken.y;
            }
            this.activeTemplate = null;
            store.update({
              selectedTokenId: clickedToken.id,
              selectedWallId: null,
              selectedLightId: null,
              selectedWaterId: null,
              selectedEffectId: null,
              selectedTemplateId: null
            });
            return;
          }

          // 1. Template Handle Interaction (Delete, 2nd Controller Rotate/Scale, Cone Aperture, Line Width, Center Move, Body Drag)
          for (let i = this.templates.length - 1; i >= 0; i--) {
            const tmpl = this.templates[i];
            const gridSize = map.gridSize || 64;
            const scaleMeters = map.gridScaleMeters || 2.0;
            const radiusMeters = ((tmpl.radius / gridSize) * scaleMeters).toFixed(1);
            const radiusSq = (tmpl.radius / gridSize).toFixed(1);
            let deg = Math.round(((tmpl.angle || 0) * 180) / Math.PI) % 360;
            if (deg < 0) deg += 360;
            const badgeText = `AREA: ${radiusMeters}m (${radiusSq} sq) // ${deg}°`;
            const textW = badgeText.length * 7.5;
            const delX = tmpl.x + (textW + 20) / 2 + 8;
            const delY = tmpl.y - tmpl.radius - 28;

            // Handle A: Delete Button [✕]
            if (Math.hypot(world.x - delX, world.y - delY) <= 18) {
              this.templates.splice(i, 1);
              if (this.activeTemplate?.id === tmpl.id) {
                this.activeTemplate = null;
              }
              store.update({ selectedTemplateId: null });
              window.dispatchEvent(new CustomEvent('veil:template_deselected'));
              audio.playClockTick();
              return;
            }

            // Handle B: 2nd Controller Handle (Rotate & Scale)
            const h2X = tmpl.x + Math.cos(tmpl.angle || 0) * tmpl.radius;
            const h2Y = tmpl.y + Math.sin(tmpl.angle || 0) * tmpl.radius;
            if (Math.hypot(world.x - h2X, world.y - h2Y) <= 22) {
              this.activeTemplate = tmpl;
              this.draggedTemplate = { template: tmpl, handle: 'transform' };
              store.update({ selectedTemplateId: tmpl.id });
              window.dispatchEvent(new CustomEvent('veil:template_selected'));
              return;
            }

            // Handle C: Cone Aperture Angle Handle (on outer edge of cone)
            if (tmpl.type === 'cone') {
              const halfAng = (tmpl.coneAngle || (Math.PI / 3)) / 2;
              const ax = tmpl.x + Math.cos((tmpl.angle || 0) + halfAng) * tmpl.radius;
              const ay = tmpl.y + Math.sin((tmpl.angle || 0) + halfAng) * tmpl.radius;
              if (Math.hypot(world.x - ax, world.y - ay) <= 20) {
                this.activeTemplate = tmpl;
                this.draggedTemplate = { template: tmpl, handle: 'aperture' };
                store.update({ selectedTemplateId: tmpl.id });
                window.dispatchEvent(new CustomEvent('veil:template_selected'));
                return;
              }
            }

            // Handle D: Line Width / Amplitude Handle (on lateral edge of beam)
            if (tmpl.type === 'line') {
              const halfW = (tmpl.width || 48) / 2;
              const lx = tmpl.x + Math.cos(tmpl.angle || 0) * (tmpl.radius * 0.5) - Math.sin(tmpl.angle || 0) * halfW;
              const ly = tmpl.y + Math.sin(tmpl.angle || 0) * (tmpl.radius * 0.5) + Math.cos(tmpl.angle || 0) * halfW;
              if (Math.hypot(world.x - lx, world.y - ly) <= 20) {
                this.activeTemplate = tmpl;
                this.draggedTemplate = { template: tmpl, handle: 'width' };
                store.update({ selectedTemplateId: tmpl.id });
                window.dispatchEvent(new CustomEvent('veil:template_selected'));
                return;
              }
            }

            // Handle E: Center Move Handle
            if (Math.hypot(world.x - tmpl.x, world.y - tmpl.y) <= 22) {
              this.activeTemplate = tmpl;
              this.draggedTemplate = { template: tmpl, handle: 'move', offsetX: world.x - tmpl.x, offsetY: world.y - tmpl.y };
              store.update({ selectedTemplateId: tmpl.id });
              window.dispatchEvent(new CustomEvent('veil:template_selected'));
              return;
            }

            // Handle D: Body Drag / Click inside template
            let isInside = false;
            if (tmpl.type === 'circle') {
              isInside = Math.hypot(world.x - tmpl.x, world.y - tmpl.y) <= tmpl.radius;
            } else if (tmpl.type === 'cone') {
              const dist = Math.hypot(world.x - tmpl.x, world.y - tmpl.y);
              if (dist <= tmpl.radius) {
                const ang = Math.atan2(world.y - tmpl.y, world.x - tmpl.x);
                let diff = ang - (tmpl.angle || 0);
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                isInside = Math.abs(diff) <= Math.PI / 6;
              }
            } else {
              const dx = world.x - tmpl.x;
              const dy = world.y - tmpl.y;
              const cos = Math.cos(-(tmpl.angle || 0));
              const sin = Math.sin(-(tmpl.angle || 0));
              const lx = dx * cos - dy * sin;
              const ly = dx * sin + dy * cos;
              if (tmpl.type === 'line') {
                isInside = lx >= 0 && lx <= tmpl.radius && Math.abs(ly) <= (tmpl.width || 48) / 2;
              } else if (tmpl.type === 'box') {
                isInside = Math.abs(lx) <= tmpl.radius && Math.abs(ly) <= tmpl.radius;
              }
            }

            if (isInside) {
              this.activeTemplate = tmpl;
              this.draggedTemplate = { template: tmpl, handle: 'move', offsetX: world.x - tmpl.x, offsetY: world.y - tmpl.y };
              return;
            }
          }

          // If activeTool is 'template' and user clicked OUTSIDE existing template handles: Create new template
          if (state.activeTool === 'template') {
            undoManager.pushCurrentState('Crear Plantilla de Área');
            const tmplShape = state.templateShape || state.activeTemplateType || 'circle';
            const newTmpl = {
              id: 'template_' + Date.now(),
              type: tmplShape,
              x: Math.round(world.x),
              y: Math.round(world.y),
              radius: 120,
              length: 120,
              angle: 0,
              coneAngle: Math.PI / 3,
              width: 48,
              color: state.activeTemplateColor || 'rgba(0, 243, 255, 0.25)',
              strokeColor: '#00f3ff'
            };
            this.templates.push(newTmpl);
            this.activeTemplate = newTmpl;
            this.draggedTemplate = { template: newTmpl, handle: 'transform' };
            store.update({ selectedTemplateId: newTmpl.id });
            window.dispatchEvent(new CustomEvent('veil:template_selected'));
            audio.playClockTick();
            return;
          }

          // 2. Interactive Door Click Check (Available to ALL Players & Keeper)
          for (const wall of (map.walls || [])) {
            const isDoor = wall.isDoor || wall.wallType === 'door';
            if (isDoor) {
              // Secret doors are hidden from players: cannot be detected or clicked
              if (wall.isSecret && !isKeeper) continue;

              const midX = (wall.x1 + wall.x2) / 2;
              const midY = (wall.y1 + wall.y2) / 2;
              const distMid = Math.hypot(world.x - midX, world.y - midY);

              if (distMid <= 22) {
                // If locked and not Keeper, block player from opening
                if (wall.isLocked && !isKeeper) {
                  audio.playError();
                  store.addCombatLog({
                    type: 'SYSTEM',
                    title: '🔒 PUERTA BLOQUEADA',
                    details: 'La compuerta está cerrada con cerrojo de seguridad. Solo el Director (Keeper) puede desbloquearla.'
                  });
                  return;
                }

                // Unlocked or Keeper: Toggle door
                const newOpen = !wall.isOpen;
                store.updateWall(wall.id, { isOpen: newOpen });
                network.broadcast({ type: 'WALL_UPDATE', wallId: wall.id, data: { isOpen: newOpen } });
                audio.playClockTick();
                store.addCombatLog({
                  type: 'SYSTEM',
                  title: newOpen ? '🚪 COMPUERTA ABIERTA' : '🚪 COMPUERTA CERRADA',
                  details: `La escotilla ha sido ${newOpen ? 'abierta' : 'cerrada'}.`
                });
                return;
              }
            }
          }

          // 3. Persistent Effect Anomaly Layer / Keeper Mode
          if (isKeeper && (state.activeLayer === 'walls_lights' || state.activeTool === 'select')) {
            // Check Anomaly Effect selection / handles (Circle, Line, Polygon)
            for (const eff of (map.effects || [])) {
              const shape = eff.shape || 'circle';

              if (shape === 'line') {
                if (eff.x2 === undefined || eff.x2 === null) {
                  eff.x2 = eff.x + (eff.radius || 120) * 1.5;
                  eff.y2 = eff.y;
                }
                const dA = Math.hypot(world.x - eff.x, world.y - eff.y);
                const dB = Math.hypot(world.x - eff.x2, world.y - eff.y2);
                const dLine = this.distToSegment(world.x, world.y, eff.x, eff.y, eff.x2, eff.y2);

                if (dA <= 18) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'pointA' };
                  return;
                } else if (dB <= 18) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'pointB' };
                  return;
                } else if (dLine <= 16) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'center', startX: world.x, startY: world.y, origX: eff.x, origY: eff.y, origX2: eff.x2, origY2: eff.y2 };
                  return;
                }
              } else if (shape === 'polygon') {
                if (!eff.points || eff.points.length < 3) {
                  const r = eff.radius || 120;
                  eff.points = Array.from({length: 5}, (_, i) => ({
                    x: Math.round(eff.x + Math.cos(i * Math.PI * 2 / 5 - Math.PI / 2) * r),
                    y: Math.round(eff.y + Math.sin(i * Math.PI * 2 / 5 - Math.PI / 2) * r)
                  }));
                }
                let clickedVertexIndex = -1;
                for (let vi = 0; vi < eff.points.length; vi++) {
                  if (Math.hypot(world.x - eff.points[vi].x, world.y - eff.points[vi].y) <= 16) {
                    clickedVertexIndex = vi;
                    break;
                  }
                }
                if (clickedVertexIndex >= 0) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'polyVertex', vertexIndex: clickedVertexIndex };
                  return;
                }
                const distCenter = Math.hypot(world.x - eff.x, world.y - eff.y);
                const inside = this.pointInPolygon(world.x, world.y, eff.points);
                if (distCenter <= 24 || inside) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'center', startX: world.x, startY: world.y, origX: eff.x, origY: eff.y, origPoints: eff.points.map(p => ({ ...p })) };
                  return;
                }
              } else {
                // Circle
                const distCenter = Math.hypot(world.x - eff.x, world.y - eff.y);
                const distHandle = Math.hypot(world.x - (eff.x + eff.radius), world.y - eff.y);
                if (distHandle <= 18) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'radius', startX: world.x, origRadius: eff.radius };
                  return;
                } else if (distCenter <= Math.max(26, eff.radius || 120)) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'center', startX: world.x, startY: world.y, origX: eff.x, origY: eff.y };
                  return;
                }
              }
            }

            // Check Light selection / handles
            for (const light of (map.lights || [])) {
              const distCenter = Math.hypot(world.x - light.x, world.y - light.y);
              const distHandle = Math.hypot(world.x - (light.x + light.radius), world.y - light.y);

              if (distHandle <= 16) {
                this.activeTemplate = null;
                store.update({ selectedLightId: light.id, selectedWallId: null, selectedEffectId: null, selectedWaterId: null, selectedTemplateId: null });
                this.draggedLight = { light, handle: 'radius', startX: world.x, origRadius: light.radius };
                return;
              } else if (distCenter <= 24) {
                this.activeTemplate = null;
                store.update({ selectedLightId: light.id, selectedWallId: null, selectedEffectId: null, selectedWaterId: null, selectedTemplateId: null });
                this.draggedLight = { light, handle: 'center', startX: world.x, startY: world.y, origX: light.x, origY: light.y };
                return;
              }
            }

            // Check Wall vertices first (Compound joints or single endpoints)
            const clickedWallPoints = [];
            for (const wall of (map.walls || [])) {
              const d1 = Math.hypot(world.x - wall.x1, world.y - wall.y1);
              const d2 = Math.hypot(world.x - wall.x2, world.y - wall.y2);
              if (d1 <= 15) {
                clickedWallPoints.push({ wall, pt: 'p1', origX: wall.x1, origY: wall.y1 });
              } else if (d2 <= 15) {
                clickedWallPoints.push({ wall, pt: 'p2', origX: wall.x2, origY: wall.y2 });
              }
            }

            if (clickedWallPoints.length > 0) {
              this.activeTemplate = null;
              store.update({
                selectedWallId: clickedWallPoints[0].wall.id,
                selectedLightId: null,
                selectedEffectId: null,
                selectedWaterId: null,
                selectedTemplateId: null
              });
              this.draggedWall = {
                handle: 'joint',
                jointPoints: clickedWallPoints,
                wall: clickedWallPoints[0].wall,
                startX: world.x,
                startY: world.y
              };
              return;
            }

            // If no vertex clicked, check wall midpoints or segment bodies for selection / moving
            for (const wall of (map.walls || [])) {
              const midX = (wall.x1 + wall.x2) / 2;
              const midY = (wall.y1 + wall.y2) / 2;
              const distMid = Math.hypot(world.x - midX, world.y - midY);

              const lenSq = (wall.x2 - wall.x1) ** 2 + (wall.y2 - wall.y1) ** 2;
              let distSeg = Infinity;
              if (lenSq > 0) {
                const t = Math.max(0, Math.min(1, ((world.x - wall.x1) * (wall.x2 - wall.x1) + (world.y - wall.y1) * (wall.y2 - wall.y1)) / lenSq));
                const projX = wall.x1 + t * (wall.x2 - wall.x1);
                const projY = wall.y1 + t * (wall.y2 - wall.y1);
                distSeg = Math.hypot(world.x - projX, world.y - projY);
              }

              if (distMid <= 16 || distSeg <= 12) {
                this.activeTemplate = null;
                store.update({ selectedWallId: wall.id, selectedLightId: null, selectedEffectId: null, selectedWaterId: null, selectedTemplateId: null });
                this.draggedWall = {
                  wall,
                  handle: 'mid',
                  startX: world.x,
                  startY: world.y,
                  origX1: wall.x1,
                  origY1: wall.y1,
                  origX2: wall.x2,
                  origY2: wall.y2
                };
                return;
              }
            }
          }

          // 3. Water Layer (Keeper & Move Tool)
          if (isKeeper && (state.activeLayer === 'water' || state.activeTool === 'select')) {
            for (const zone of (map.waterZones || [])) {
              if (zone.shape === 'polygon' && zone.points && zone.points.length >= 3) {
                // Check polygon vertex handles
                for (let vIdx = 0; vIdx < zone.points.length; vIdx++) {
                  const pt = zone.points[vIdx];
                  if (Math.hypot(world.x - pt.x, world.y - pt.y) <= 14) {
                    this.activeTemplate = null;
                    store.update({ selectedWaterId: zone.id, selectedWallId: null, selectedLightId: null, selectedEffectId: null, selectedTemplateId: null });
                    this.draggedWater = { zone, handle: 'polyVertex', vertexIndex: vIdx };
                    return;
                  }
                }
                if (this.pointInPolygon(world.x, world.y, zone.points)) {
                  this.activeTemplate = null;
                  store.update({ selectedWaterId: zone.id, selectedWallId: null, selectedLightId: null, selectedEffectId: null, selectedTemplateId: null });
                  this.draggedWater = { zone, handle: 'polyCenter', startX: world.x, startY: world.y, origPoints: zone.points.map(p => ({ ...p })) };
                  return;
                }
              } else {
                const seHandleX = zone.x + zone.width;
                const seHandleY = zone.y + zone.height;
                const distHandle = Math.hypot(world.x - seHandleX, world.y - seHandleY);
                const inside = world.x >= zone.x && world.x <= zone.x + zone.width && world.y >= zone.y && world.y <= zone.y + zone.height;

                if (distHandle <= 16) {
                  this.activeTemplate = null;
                  store.update({ selectedWaterId: zone.id, selectedWallId: null, selectedLightId: null, selectedEffectId: null, selectedTemplateId: null });
                  this.draggedWater = { zone, handle: 'se', startX: world.x, startY: world.y, origW: zone.width, origH: zone.height };
                  return;
                } else if (inside) {
                  this.activeTemplate = null;
                  store.update({ selectedWaterId: zone.id, selectedWallId: null, selectedLightId: null, selectedEffectId: null, selectedTemplateId: null });
                  this.draggedWater = { zone, handle: 'center', startX: world.x, startY: world.y, origX: zone.x, origY: zone.y };
                  return;
                }
              }
            }
          }

          // 4. Clicked background -> clear selections & initiate Stage Pan (Move Tool)
          this.activeTemplate = null;
          store.update({ selectedTokenId: null, selectedWallId: null, selectedLightId: null, selectedWaterId: null, selectedEffectId: null, selectedTemplateId: null, targetTokenId: null });
          window.dispatchEvent(new CustomEvent('veil:template_deselected'));
          if (state.activeTool === 'select') {
            this.isPanning = true;
            this.panStartX = sx - this.panX;
            this.panStartY = sy - this.panY;
            this.canvas.style.cursor = 'grabbing';
          }
        }
      }
    });

    // MOUSE MOVE
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);
      this.cursorWorld = world;
      const state = store.getState();
      const map = store.getActiveMap();

      if (this.isPanning) {
        this.panX = sx - this.panStartX;
        this.panY = sy - this.panStartY;
        return;
      }

      if (this.gridCalibStart && state.activeTool === 'grid_scale') {
        this.gridCalibCurrent = { x: world.x, y: world.y };
        return;
      }

      if (this.draggedTokenFacing && !store.canEditToken(this.draggedTokenFacing.id)) this.draggedTokenFacing = null;
      if (this.draggedToken && !store.canEditToken(this.draggedToken.id)) this.draggedToken = null;
      if (this.draggedTokenFacing) {
        const dx = world.x - this.draggedTokenFacing.x;
        const dy = world.y - this.draggedTokenFacing.y;
        this.draggedTokenFacing.facingAngle = Math.atan2(dy, dx);
        return;
      }

      if (this.draggedToken) {
        let nextX = world.x - this.dragOffsetX;
        let nextY = world.y - this.dragOffsetY;

        // Players cannot cross walls, windows, or closed doors with their token
        if (state.userRole === 'player' && (map.walls || []).length > 0) {
          const currX = this.draggedToken.x;
          const currY = this.draggedToken.y;
          const origX = this.draggedTokenOrigX ?? currX;
          const origY = this.draggedTokenOrigY ?? currY;

          const collidesWithBlockingWall = (x1, y1, x2, y2) => {
            for (const wall of (map.walls || [])) {
              const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
              const isBlocking = wallType === 'wall' || wallType === 'window' || (wallType === 'door' && !wall.isOpen);
              if (isBlocking && this.checkLineIntersection(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2)) {
                return true;
              }
            }
            return false;
          };

          const directBlocked = collidesWithBlockingWall(currX, currY, nextX, nextY) || collidesWithBlockingWall(origX, origY, nextX, nextY);
          if (directBlocked) {
            const xSlideBlocked = collidesWithBlockingWall(currX, currY, nextX, currY) || collidesWithBlockingWall(origX, origY, nextX, currY);
            const ySlideBlocked = collidesWithBlockingWall(currX, currY, currX, nextY) || collidesWithBlockingWall(origX, origY, currX, nextY);

            if (!xSlideBlocked) {
              nextY = currY;
            } else if (!ySlideBlocked) {
              nextX = currX;
            } else {
              nextX = currX;
              nextY = currY;
            }
          }
        }

        this.draggedToken.x = nextX;
        this.draggedToken.y = nextY;
        return;
      }

      if (this.draggedTemplate) {
        const tmpl = this.draggedTemplate.template;
        if (this.draggedTemplate.handle === 'transform') {
          const dx = world.x - tmpl.x;
          const dy = world.y - tmpl.y;
          tmpl.radius = Math.max(25, Math.hypot(dx, dy));
          tmpl.length = tmpl.radius;
          tmpl.angle = Math.atan2(dy, dx);
        } else if (this.draggedTemplate.handle === 'aperture') {
          let diff = Math.atan2(world.y - tmpl.y, world.x - tmpl.x) - (tmpl.angle || 0);
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          tmpl.coneAngle = Math.max(0.26, Math.min(Math.PI * 0.95, Math.abs(diff) * 2));
        } else if (this.draggedTemplate.handle === 'width') {
          const dx = world.x - tmpl.x;
          const dy = world.y - tmpl.y;
          const cos = Math.cos(-(tmpl.angle || 0));
          const sin = Math.sin(-(tmpl.angle || 0));
          const ly = Math.abs(dx * sin + dy * cos);
          tmpl.width = Math.max(16, Math.min(260, ly * 2));
        } else if (this.draggedTemplate.handle === 'move') {
          tmpl.x = world.x - (this.draggedTemplate.offsetX || 0);
          tmpl.y = world.y - (this.draggedTemplate.offsetY || 0);
        }
        return;
      }

      if (this.draggedEffect) {
        const de = this.draggedEffect;
        if (de.handle === 'center') {
          const dx = world.x - de.startX;
          const dy = world.y - de.startY;
          de.effect.x = Math.round(de.origX + dx);
          de.effect.y = Math.round(de.origY + dy);
          if (de.origX2 !== undefined) {
            de.effect.x2 = Math.round(de.origX2 + dx);
            de.effect.y2 = Math.round(de.origY2 + dy);
          }
          if (de.origPoints) {
            de.effect.points = de.origPoints.map(p => ({
              x: Math.round(p.x + dx),
              y: Math.round(p.y + dy)
            }));
          }
        } else if (de.handle === 'radius') {
          de.effect.radius = Math.max(30, Math.round(Math.hypot(world.x - de.effect.x, world.y - de.effect.y)));
        } else if (de.handle === 'pointA') {
          de.effect.x = Math.round(world.x);
          de.effect.y = Math.round(world.y);
        } else if (de.handle === 'pointB') {
          de.effect.x2 = Math.round(world.x);
          de.effect.y2 = Math.round(world.y);
        } else if (de.handle === 'polyVertex') {
          if (de.effect.points && de.effect.points[de.vertexIndex]) {
            de.effect.points[de.vertexIndex].x = Math.round(world.x);
            de.effect.points[de.vertexIndex].y = Math.round(world.y);
            const pts = de.effect.points;
            de.effect.x = Math.round(pts.reduce((s, p) => s + p.x, 0) / pts.length);
            de.effect.y = Math.round(pts.reduce((s, p) => s + p.y, 0) / pts.length);
          }
        }

        // Real-time synchronization of visual void rift if dragging black hole anomaly
        if (this.fx && this.fx.voidRifts) {
          const vRift = this.fx.voidRifts.find(r => r.id === de.effect.id);
          if (vRift) {
            vRift.x = de.effect.x;
            vRift.y = de.effect.y;
            if (de.handle === 'radius') {
              vRift.radius = de.effect.radius;
              vRift.singularityRadius = de.effect.radius * 0.28;
            }
          }
        }
        return;
      }

      if (this.draggedWall) {
        const dw = this.draggedWall;
        let wx = world.x;
        let wy = world.y;
        if (state.gridSnap && map.gridSize) {
          wx = Math.round(wx / (map.gridSize / 2)) * (map.gridSize / 2);
          wy = Math.round(wy / (map.gridSize / 2)) * (map.gridSize / 2);
        }

        if (dw.handle === 'joint' && dw.jointPoints) {
          const excludeIds = dw.jointPoints.map(jp => jp.wall.id);
          const snapped = this.snapPoint(wx, wy, 16, excludeIds);
          for (const jp of dw.jointPoints) {
            if (jp.pt === 'p1') {
              jp.wall.x1 = snapped.x;
              jp.wall.y1 = snapped.y;
            } else {
              jp.wall.x2 = snapped.x;
              jp.wall.y2 = snapped.y;
            }
          }
        } else if (dw.handle === 'p1') {
          const snapped = this.snapPoint(wx, wy, 16, dw.wall.id);
          dw.wall.x1 = snapped.x;
          dw.wall.y1 = snapped.y;
        } else if (dw.handle === 'p2') {
          const snapped = this.snapPoint(wx, wy, 16, dw.wall.id);
          dw.wall.x2 = snapped.x;
          dw.wall.y2 = snapped.y;
        } else if (dw.handle === 'mid') {
          const dx = wx - dw.startX;
          const dy = wy - dw.startY;
          dw.wall.x1 = dw.origX1 + dx;
          dw.wall.y1 = dw.origY1 + dy;
          dw.wall.x2 = dw.origX2 + dx;
          dw.wall.y2 = dw.origY2 + dy;
        }
        return;
      }

      if (this.draggedLight) {
        const dl = this.draggedLight;
        if (dl.handle === 'center') {
          dl.light.x = Math.round(world.x);
          dl.light.y = Math.round(world.y);
        } else if (dl.handle === 'radius') {
          dl.light.radius = Math.max(40, Math.round(Math.hypot(world.x - dl.light.x, world.y - dl.light.y)));
        }
        return;
      }

      if (this.draggedWater) {
        const dw = this.draggedWater;
        if (dw.handle === 'polyVertex') {
          if (dw.zone.points && dw.zone.points[dw.vertexIndex]) {
            dw.zone.points[dw.vertexIndex].x = Math.round(world.x);
            dw.zone.points[dw.vertexIndex].y = Math.round(world.y);
          }
        } else if (dw.handle === 'polyCenter') {
          const dx = world.x - dw.startX;
          const dy = world.y - dw.startY;
          for (let i = 0; i < dw.zone.points.length; i++) {
            dw.zone.points[i].x = Math.round(dw.origPoints[i].x + dx);
            dw.zone.points[i].y = Math.round(dw.origPoints[i].y + dy);
          }
        } else if (dw.handle === 'se') {
          dw.zone.width = Math.max(60, Math.round(world.x - dw.zone.x));
          dw.zone.height = Math.max(60, Math.round(world.y - dw.zone.y));
        } else if (dw.handle === 'center') {
          const dx = world.x - dw.startX;
          const dy = world.y - dw.startY;
          dw.zone.x = Math.round(dw.origX + dx);
          dw.zone.y = Math.round(dw.origY + dy);
        }
        return;
      }

      if (this.rulerStart) {
        this.rulerCurrent = world;
        return;
      }

      if (this.wallStart) {
        const snapped = this.snapPoint(world.x, world.y, 16);
        this.wallCurrent = { x: snapped.x, y: snapped.y };
        return;
      }

      if (this.waterStart) {
        this.waterCurrent = world;
        return;
      }

      // Cursor Hover Hinting for Templates
      if (!this.isPanning && !this.draggedToken && !this.draggedTemplate && !this.draggedWall && !this.draggedLight && !this.draggedWater && !this.rulerStart && !this.wallStart && !this.waterStart && !this.isSpacePressed) {
        let hoverCursor = 'default';
        for (const tmpl of this.templates) {
          const gridSize = map.gridSize || 64;
          const scaleMeters = map.gridScaleMeters || 2.0;
          const radiusMeters = ((tmpl.radius / gridSize) * scaleMeters).toFixed(1);
          const radiusSq = (tmpl.radius / gridSize).toFixed(1);
          let deg = Math.round(((tmpl.angle || 0) * 180) / Math.PI) % 360;
          if (deg < 0) deg += 360;
          const badgeText = `AREA: ${radiusMeters}m (${radiusSq} sq) // ${deg}°`;
          const textW = badgeText.length * 7.5;
          const delX = tmpl.x + (textW + 20) / 2 + 8;
          const delY = tmpl.y - tmpl.radius - 28;

          // Delete button hover
          if (Math.hypot(world.x - delX, world.y - delY) <= 16) {
            hoverCursor = 'pointer';
            break;
          }

          // 2nd Controller Gimbal hover (Rotate & Scale)
          const h2X = tmpl.x + Math.cos(tmpl.angle || 0) * tmpl.radius;
          const h2Y = tmpl.y + Math.sin(tmpl.angle || 0) * tmpl.radius;
          if (Math.hypot(world.x - h2X, world.y - h2Y) <= 18) {
            hoverCursor = 'crosshair';
            break;
          }

          // Cone aperture handle hover
          if (tmpl.type === 'cone') {
            const halfAng = (tmpl.coneAngle || (Math.PI / 3)) / 2;
            const ax = tmpl.x + Math.cos((tmpl.angle || 0) + halfAng) * tmpl.radius;
            const ay = tmpl.y + Math.sin((tmpl.angle || 0) + halfAng) * tmpl.radius;
            if (Math.hypot(world.x - ax, world.y - ay) <= 16) {
              hoverCursor = 'ew-resize';
              break;
            }
          }

          // Line width handle hover
          if (tmpl.type === 'line') {
            const halfW = (tmpl.width || 48) / 2;
            const lx = tmpl.x + Math.cos(tmpl.angle || 0) * (tmpl.radius * 0.5) - Math.sin(tmpl.angle || 0) * halfW;
            const ly = tmpl.y + Math.sin(tmpl.angle || 0) * (tmpl.radius * 0.5) + Math.cos(tmpl.angle || 0) * halfW;
            if (Math.hypot(world.x - lx, world.y - ly) <= 16) {
              hoverCursor = 'ns-resize';
              break;
            }
          }

          // Center Move handle hover
          if (Math.hypot(world.x - tmpl.x, world.y - tmpl.y) <= 18) {
            hoverCursor = 'move';
            break;
          }
        }
        this.canvas.style.cursor = hoverCursor;
      }
    });

    // MOUSE UP
    window.addEventListener('mouseup', (e) => {
      const state = store.getState();
      if (this.gridCalibStart) {
        if (this.gridCalibCurrent) {
          const dx = Math.abs(this.gridCalibCurrent.x - this.gridCalibStart.x);
          const dy = Math.abs(this.gridCalibCurrent.y - this.gridCalibStart.y);
          const measured = Math.round(Math.max(dx, dy));
          if (measured >= 16) {
            store.updateActiveMap({ gridSize: measured });
            audio.playClockTick();
            store.addLog({
              type: 'system',
              message: `📐 Rejilla calibrada a ${measured}px por casilla`
            });
            window.dispatchEvent(new CustomEvent('veil:grid_calibrated', { detail: { gridSize: measured } }));
          }
        }
        this.gridCalibStart = null;
        this.gridCalibCurrent = null;
        if (state.activeTool === 'grid_scale') {
          store.update({ activeTool: 'select' });
          document.querySelectorAll('.left-toolbar .tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'select');
          });
        }
      }

      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.style.cursor = this.isSpacePressed ? 'grab' : 'default';
      }

      if (this.draggedTokenFacing) {
        if (this.preDragSnapshot) {
          undoManager.pushSnapshot(this.preDragSnapshot, 'Rotar Operativo');
        }
        store.updateToken(this.draggedTokenFacing.id, { facingAngle: this.draggedTokenFacing.facingAngle });
        if (store.sessionRole !== 'player') network.broadcast({ type: 'TOKEN_UPDATE', tokenId: this.draggedTokenFacing.id, partial: { facingAngle: this.draggedTokenFacing.facingAngle } });
        this.draggedTokenFacing = null;
      }

      if (this.draggedToken) {
        const state = store.getState();
        const map = store.getActiveMap();
        let finalX = this.draggedToken.x;
        let finalY = this.draggedToken.y;

        // Snapping: check anchors, objects, and grid
        const hasSnap = state.snapToAnchors !== false || state.snapToObjects || state.snapToGrid !== false || state.gridSnap !== false;
        if (hasSnap && map.gridSize) {
          const snapped = this.snapPoint(finalX, finalY, map.gridSize / 2);
          if (snapped && snapped.snapped) {
            finalX = snapped.x;
            finalY = snapped.y;
          } else {
            finalX = Math.round(finalX / map.gridSize) * map.gridSize;
            finalY = Math.round(finalY / map.gridSize) * map.gridSize;
          }
        }

        // Barrier Collision: Players cannot cross walls, windows, or closed doors
        const isKeeper = state.userRole === 'keeper';
        let isBlocked = false;
        let blockedReason = '';

        if (!isKeeper && this.draggedTokenOrigX !== undefined && this.draggedTokenOrigX !== null) {
          for (const wall of (map.walls || [])) {
            const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
            const isDoor = wallType === 'door';
            const isWindow = wallType === 'window';
            const isWall = wallType === 'wall';

            let barrierBlocks = false;
            if (isWall) {
              barrierBlocks = true;
            } else if (isWindow) {
              barrierBlocks = true; // Windows block token movement
            } else if (isDoor && !wall.isOpen) {
              barrierBlocks = true; // Closed door blocks movement
            }

            if (barrierBlocks && this.checkLineIntersection(this.draggedTokenOrigX, this.draggedTokenOrigY, finalX, finalY, wall.x1, wall.y1, wall.x2, wall.y2)) {
              isBlocked = true;
              blockedReason = isWindow
                ? 'No puedes atravesar ventanas de cristal reforzado.'
                : (isDoor ? 'La compuerta está cerrada.' : 'No puedes atravesar muros opacos.');
              break;
            }
          }
        }

        if (isBlocked) {
          finalX = this.draggedTokenOrigX;
          finalY = this.draggedTokenOrigY;
          this.draggedToken.x = finalX;
          this.draggedToken.y = finalY;
          audio.playError();
          store.addCombatLog({
            type: 'WARNING',
            title: '⚠️ MOVIMIENTO BLOQUEADO',
            details: blockedReason
          });
        }

        if (this.preDragSnapshot && !isBlocked) {
          store._skipNextUndoSnapshot = true;
          undoManager.pushSnapshot(this.preDragSnapshot, `Mover ${this.draggedToken.name || 'Operativo'}`);
        }
        store.updateToken(this.draggedToken.id, { x: finalX, y: finalY });
        if (store.sessionRole !== 'player') network.broadcast({ type: 'TOKEN_MOVE', tokenId: this.draggedToken.id, x: finalX, y: finalY });
        this.draggedToken = null;
        this.draggedTokenOrigX = null;
        this.draggedTokenOrigY = null;
      }

      if (this.draggedWall) {
        const dw = this.draggedWall;
        const map = store.getActiveMap();
        if (this.preDragSnapshot) {
          store._skipNextUndoSnapshot = true;
          const desc = dw.handle === 'joint' && dw.jointPoints && dw.jointPoints.length > 1
            ? 'Mover Vértice Compuesto de Muros'
            : 'Ajustar Muro';
          undoManager.pushSnapshot(this.preDragSnapshot, desc);
        }

        if (dw.handle === 'joint' && dw.jointPoints) {
          const first = dw.jointPoints[0];
          let jx = first.pt === 'p1' ? first.wall.x1 : first.wall.x2;
          let jy = first.pt === 'p1' ? first.wall.y1 : first.wall.y2;

          // Auto-weld with any existing wall endpoint <= 16px
          const excludeIds = new Set(dw.jointPoints.map(jp => jp.wall.id));
          for (const otherW of (map?.walls || [])) {
            if (excludeIds.has(otherW.id)) continue;
            if (Math.hypot(jx - otherW.x1, jy - otherW.y1) <= 16) {
              jx = otherW.x1;
              jy = otherW.y1;
              break;
            } else if (Math.hypot(jx - otherW.x2, jy - otherW.y2) <= 16) {
              jx = otherW.x2;
              jy = otherW.y2;
              break;
            }
          }

          for (const jp of dw.jointPoints) {
            if (jp.pt === 'p1') {
              jp.wall.x1 = jx;
              jp.wall.y1 = jy;
            } else {
              jp.wall.x2 = jx;
              jp.wall.y2 = jy;
            }
            store.updateWall(jp.wall.id, {
              x1: jp.wall.x1,
              y1: jp.wall.y1,
              x2: jp.wall.x2,
              y2: jp.wall.y2
            });
            network.broadcast({
              type: 'WALL_UPDATE',
              wallId: jp.wall.id,
              data: { x1: jp.wall.x1, y1: jp.wall.y1, x2: jp.wall.x2, y2: jp.wall.y2 }
            });
          }
        } else if (dw.handle === 'mid') {
          for (const otherW of (map?.walls || [])) {
            if (otherW.id === dw.wall.id) continue;
            if (Math.hypot(dw.wall.x1 - otherW.x1, dw.wall.y1 - otherW.y1) <= 16) {
              dw.wall.x1 = otherW.x1;
              dw.wall.y1 = otherW.y1;
            } else if (Math.hypot(dw.wall.x1 - otherW.x2, dw.wall.y1 - otherW.y2) <= 16) {
              dw.wall.x1 = otherW.x2;
              dw.wall.y1 = otherW.y2;
            }
            if (Math.hypot(dw.wall.x2 - otherW.x1, dw.wall.y2 - otherW.y1) <= 16) {
              dw.wall.x2 = otherW.x1;
              dw.wall.y2 = otherW.y1;
            } else if (Math.hypot(dw.wall.x2 - otherW.x2, dw.wall.y2 - otherW.y2) <= 16) {
              dw.wall.x2 = otherW.x2;
              dw.wall.y2 = otherW.y2;
            }
          }
          store.updateWall(dw.wall.id, {
            x1: dw.wall.x1,
            y1: dw.wall.y1,
            x2: dw.wall.x2,
            y2: dw.wall.y2
          });
          network.broadcast({
            type: 'WALL_UPDATE',
            wallId: dw.wall.id,
            data: { x1: dw.wall.x1, y1: dw.wall.y1, x2: dw.wall.x2, y2: dw.wall.y2 }
          });
        }
        this.draggedWall = null;
      }

      if (this.draggedLight) {
        if (this.preDragSnapshot) {
          store._skipNextUndoSnapshot = true;
          undoManager.pushSnapshot(this.preDragSnapshot, 'Ajustar Luz');
        }
        store.updateLight(this.draggedLight.light.id, {
          x: this.draggedLight.light.x,
          y: this.draggedLight.light.y,
          radius: this.draggedLight.light.radius
        });
        this.draggedLight = null;
      }

      if (this.draggedEffect) {
        if (this.preDragSnapshot) {
          store._skipNextUndoSnapshot = true;
          undoManager.pushSnapshot(this.preDragSnapshot, 'Ajustar Anomalía FX');
        }
        store.updateEffect(this.draggedEffect.effect.id, {
          x: this.draggedEffect.effect.x,
          y: this.draggedEffect.effect.y,
          x2: this.draggedEffect.effect.x2,
          y2: this.draggedEffect.effect.y2,
          radius: this.draggedEffect.effect.radius,
          points: this.draggedEffect.effect.points
        });
        this.draggedEffect = null;
      }

      if (this.draggedWater) {
        if (this.preDragSnapshot) {
          store._skipNextUndoSnapshot = true;
          undoManager.pushSnapshot(this.preDragSnapshot, 'Ajustar Zona Acuática');
        }
        store.updateWaterZone(this.draggedWater.zone.id, {
          x: this.draggedWater.zone.x,
          y: this.draggedWater.zone.y,
          width: this.draggedWater.zone.width,
          height: this.draggedWater.zone.height,
          points: this.draggedWater.zone.points
        });
        this.draggedWater = null;
      }

      if (this.draggedTemplate) {
        if (this.preDragSnapshot) {
          undoManager.pushSnapshot(this.preDragSnapshot, 'Ajustar Plantilla de Área');
        }
        this.draggedTemplate = null;
      }

      if (this.rulerStart) {
        this.rulerStart = null;
        this.rulerCurrent = null;
      }

      if (this.wallStart && this.wallCurrent) {
        const map = store.getActiveMap();
        const startSnap = this.snapPoint(this.wallStart.x, this.wallStart.y, 16);
        const endSnap = this.snapPoint(this.wallCurrent.x, this.wallCurrent.y, 16);
        const dist = Math.hypot(endSnap.x - startSnap.x, endSnap.y - startSnap.y);
        if (dist > 15) {
          if (this.preDragSnapshot) {
            store._skipNextUndoSnapshot = true;
            undoManager.pushSnapshot(this.preDragSnapshot, 'Construir Muro');
          }
          let x1 = Math.round(startSnap.x);
          let y1 = Math.round(startSnap.y);
          let x2 = Math.round(endSnap.x);
          let y2 = Math.round(endSnap.y);

          // Auto-weld with any existing wall endpoint <= 16px into a compound path
          for (const other of (map.walls || [])) {
            if (Math.hypot(x1 - other.x1, y1 - other.y1) <= 16) { x1 = other.x1; y1 = other.y1; }
            else if (Math.hypot(x1 - other.x2, y1 - other.y2) <= 16) { x1 = other.x2; y1 = other.y2; }
            if (Math.hypot(x2 - other.x1, y2 - other.y1) <= 16) { x2 = other.x1; y2 = other.y1; }
            else if (Math.hypot(x2 - other.x2, y2 - other.y2) <= 16) { x2 = other.x2; y2 = other.y2; }
          }

          const newWall = {
            id: 'wall_' + Date.now(),
            x1,
            y1,
            x2,
            y2,
            isDoor: false,
            isOpen: false
          };
          store.updateActiveMap({ walls: [...(map.walls || []), newWall] });
          store.update({ selectedWallId: newWall.id });
        }
        this.wallStart = null;
        this.wallCurrent = null;
      }

      if (this.waterStart && this.waterCurrent && this.canDrawWater() && store.state.waterDrawMode !== 'polygon' && e.button === 0) {
        const x1 = Math.min(this.waterStart.x, this.waterCurrent.x);
        const y1 = Math.min(this.waterStart.y, this.waterCurrent.y);
        const w = Math.abs(this.waterCurrent.x - this.waterStart.x);
        const h = Math.abs(this.waterCurrent.y - this.waterStart.y);

        if (w > 30 && h > 30) {
          if (this.preDragSnapshot) {
            store._skipNextUndoSnapshot = true;
            undoManager.pushSnapshot(this.preDragSnapshot, 'Definir Zona Acuática');
          }
          store.addWaterZone({
            name: 'Water Hazard',
            shape: 'box',
            x: Math.round(x1),
            y: Math.round(y1),
            width: Math.round(w),
            height: Math.round(h),
            depth: 2
          });
        }
        this.waterStart = null;
        this.waterCurrent = null;
        this.waterDraftChanged();
      }
      this.preDragSnapshot = null;
    });

    // Zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const worldBefore = this.screenToWorld(sx, sy);
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.1, Math.min(10.0, this.zoom * zoomFactor));

      this.zoom = newZoom;
      this.panX = sx - worldBefore.x * newZoom;
      this.panY = sy - worldBefore.y * newZoom;
    }, { passive: false });

    // Context Menu (Right Click) cancels placement, deletes clicked template, or deletes clicked anchor/element
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);
      const state = store.getState();
      const isKeeper = state.userRole === 'keeper';
      const map = store.getActiveMap();

      // Cancelling an unfinished water shape must never delete geometry underneath it.
      if (this.waterStart || this.waterPolyPoints.length) {
        this.cancelWaterDrawing(); this.isPanning=false; return;
      }

      // Check if right-clicked on any area template to delete it
      for (let i = this.templates.length - 1; i >= 0; i--) {
        const tmpl = this.templates[i];
        const dist = Math.hypot(world.x - tmpl.x, world.y - tmpl.y);
        if (dist <= tmpl.radius + 30) {
          undoManager.pushCurrentState('Eliminar Plantilla de Área');
          this.templates.splice(i, 1);
          if (this.activeTemplate?.id === tmpl.id) {
            this.activeTemplate = null;
          }
          audio.playClockTick();
          return;
        }
      }

      // --- KEEPER: RIGHT-CLICK DELETES ANCHOR / VERTEX / ELEMENT ---
      if (isKeeper) {
        // 1. Wall Anchors & Segments: Right-clicking an anchor shared by 2 walls merges them; single endpoint or segment deletes wall
        const nearWalls = [];
        for (const w of (map.walls || [])) {
          const d1 = Math.hypot(world.x - w.x1, world.y - w.y1);
          const d2 = Math.hypot(world.x - w.x2, world.y - w.y2);
          if (d1 <= 16) {
            nearWalls.push({ wall: w, pt: 'p1', x: w.x1, y: w.y1 });
          } else if (d2 <= 16) {
            nearWalls.push({ wall: w, pt: 'p2', x: w.x2, y: w.y2 });
          }
        }

        if (nearWalls.length >= 2) {
          // Anchor shared by 2 connected walls: remove anchor by merging into a single wall
          const wA = nearWalls[0].wall;
          const ptA = nearWalls[0].pt;
          const wB = nearWalls[1].wall;
          const ptB = nearWalls[1].pt;

          const otherA = ptA === 'p1' ? { x: wA.x2, y: wA.y2 } : { x: wA.x1, y: wA.y1 };
          const otherB = ptB === 'p1' ? { x: wB.x2, y: wB.y2 } : { x: wB.x1, y: wB.y1 };

          const updatedWalls = (map.walls || []).filter(w => w.id !== wB.id).map(w => {
            if (w.id === wA.id) {
              return { ...w, x1: otherA.x, y1: otherA.y, x2: otherB.x, y2: otherB.y };
            }
            return w;
          });
          store.updateActiveMap({ walls: updatedWalls });
          audio.playClockTick();
          return;
        } else if (nearWalls.length === 1) {
          // Dead-end wall anchor: delete the wall
          store.deleteWall(nearWalls[0].wall.id);
          audio.playClockTick();
          return;
        }

        // 2. Polygon Water Zone Vertices: Right-click deletes the vertex (or zone if <= 3 points)
        for (const zone of (map.waterZones || [])) {
          if (zone.shape === 'polygon' && zone.points && zone.points.length >= 3) {
            for (let vi = 0; vi < zone.points.length; vi++) {
              if (Math.hypot(world.x - zone.points[vi].x, world.y - zone.points[vi].y) <= 16) {
                if (zone.points.length > 3) {
                  const newPts = zone.points.filter((_, idx) => idx !== vi);
                  store.updateWaterZone(zone.id, { points: newPts });
                } else {
                  store.deleteWaterZone(zone.id);
                }
                audio.playClockTick();
                return;
              }
            }
          }
        }

        // 3. Persistent Anomaly Effects / Laser Beam Anchors: Right-click deletes vertex or element
        for (const eff of (map.effects || [])) {
          if (eff.shape === 'polygon' && eff.points && eff.points.length >= 3) {
            for (let vi = 0; vi < eff.points.length; vi++) {
              if (Math.hypot(world.x - eff.points[vi].x, world.y - eff.points[vi].y) <= 16) {
                if (eff.points.length > 3) {
                  const newPts = eff.points.filter((_, idx) => idx !== vi);
                  store.updateEffect(eff.id, { points: newPts });
                } else {
                  // Revert remaining 2 points to a line
                  const rem = eff.points.filter((_, idx) => idx !== vi);
                  store.updateEffect(eff.id, {
                    shape: 'line',
                    x: rem[0].x,
                    y: rem[0].y,
                    x2: rem[1].x,
                    y2: rem[1].y,
                    points: []
                  });
                }
                audio.playClockTick();
                return;
              }
            }
          } else if (eff.shape === 'line' || eff.type === 'laser') {
            const x2 = eff.x2 ?? (eff.x + 260);
            const y2 = eff.y2 ?? eff.y;
            const dA = Math.hypot(world.x - eff.x, world.y - eff.y);
            const dB = Math.hypot(world.x - x2, world.y - y2);
            if (dA <= 16 || dB <= 16) {
              store.deleteEffect(eff.id);
              audio.playClockTick();
              return;
            }
          } else {
            // Circle center or resize handle
            const distCenter = Math.hypot(world.x - eff.x, world.y - eff.y);
            const distHandle = Math.hypot(world.x - (eff.x + eff.radius), world.y - eff.y);
            if (distCenter <= 24 || distHandle <= 16) {
              store.deleteEffect(eff.id);
              audio.playClockTick();
              return;
            }
          }
        }

        // 4. Light Sources: Right-click on center deletes the light
        for (const light of (map.lights || [])) {
          if (Math.hypot(world.x - light.x, world.y - light.y) <= 22) {
            store.deleteLight(light.id);
            audio.playClockTick();
            return;
          }
        }
      }

      this.activeTemplate = null;
      this.rulerStart = null;
      this.wallStart = null;
      this.cancelWaterDrawing();
    });
  }

  // --- Unified Double-Click / Double-Tap Handler (Desktop, Tablet & Mobile) ---
  handleDoubleAction(worldX, worldY, originalEvent) {
    if (originalEvent?.preventDefault) originalEvent.preventDefault();
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';
    if (state.activeTool === 'water') {
      if (this.waterPolyPoints && this.waterPolyPoints.length) this.finishWaterPolygon();
      return;
    }

    const world = { x: worldX, y: worldY };
    const map = store.getActiveMap() || {};

    // 0. TOKENS HAVE MAXIMUM PREFERENCE OVER ANY OTHER ELEMENT
    const tokens = store.getTokensForActiveMap();
    const gridSize = map.gridSize || 64;

    for (let i = tokens.length - 1; i >= 0; i--) {
      const tok = tokens[i];
      const radius = ((tok.size || 1) * gridSize) / 2;
      if (Math.hypot(world.x - tok.x, world.y - tok.y) <= radius + 6) {
        if (!isKeeper && !tok.isPlayer && !this.isTokenVisibleToPlayers(tok, tokens, map)) {
          continue;
        }
        if (window.veilTokenHUD) {
          window.veilTokenHUD.openCharacterSheetModal(tok);
        }
        return;
      }
    }

    // 0b. DOORS: Double click toggles door open/closed
    for (const wall of (map.walls || [])) {
      const isDoor = wall.isDoor || wall.wallType === 'door';
      if (isDoor) {
        if (wall.isSecret && !isKeeper) continue;
        const midX = (wall.x1 + wall.x2) / 2;
        const midY = (wall.y1 + wall.y2) / 2;
        if (Math.hypot(world.x - midX, world.y - midY) <= 28) {
          if (wall.isLocked && !isKeeper) {
            audio.playError();
            store.addCombatLog({
              type: 'SYSTEM',
              title: '🔒 PUERTA BLOQUEADA',
              details: 'La compuerta está cerrada con cerrojo de seguridad.'
            });
            return;
          }
          const newOpen = !wall.isOpen;
          store.updateWall(wall.id, { isOpen: newOpen });
          network.broadcast({ type: 'WALL_UPDATE', wallId: wall.id, data: { isOpen: newOpen } });
          audio.playClockTick();
          store.addCombatLog({
            type: 'SYSTEM',
            title: newOpen ? '🚪 COMPUERTA ABIERTA' : '🚪 COMPUERTA CERRADA',
            details: `La escotilla ha sido ${newOpen ? 'abierta' : 'cerrada'}.`
          });
          return;
        }
      }
    }

    // --- KEEPER ELEMENT HANDLES (Walls, Anomalies, Water) ---
    if (isKeeper) {
      // A. Check Endpoints: si dos puntos están juntos unelos en un trazado compuesto, haciendo doble click se separan
      // 1. Walls Endpoints
      const nearEndpoints = [];
      for (const w of (map.walls || [])) {
        const d1 = Math.hypot(world.x - w.x1, world.y - w.y1);
        const d2 = Math.hypot(world.x - w.x2, world.y - w.y2);
        if (d1 <= 16) {
          nearEndpoints.push({ wall: w, pt: 'p1', x: w.x1, y: w.y1, otherX: w.x2, otherY: w.y2 });
        } else if (d2 <= 16) {
          nearEndpoints.push({ wall: w, pt: 'p2', x: w.x2, y: w.y2, otherX: w.x1, otherY: w.y1 });
        }
      }

      if (nearEndpoints.length >= 2) {
        // SEPARATE COMPOUND JOINT ON DOUBLE CLICK
        undoManager.pushCurrentState('Separar Muros Compuestos');

        for (const ep of nearEndpoints) {
          const dx = ep.otherX - ep.x;
          const dy = ep.otherY - ep.y;
          const len = Math.hypot(dx, dy);
          if (len > 0) {
            const sepDist = Math.max(10, Math.min(26, len * 0.35));
            const newX = Math.round(ep.x + (dx / len) * sepDist);
            const newY = Math.round(ep.y + (dy / len) * sepDist);
            if (ep.pt === 'p1') {
              ep.wall.x1 = newX;
              ep.wall.y1 = newY;
            } else {
              ep.wall.x2 = newX;
              ep.wall.y2 = newY;
            }
            store.updateWall(ep.wall.id, {
              x1: ep.wall.x1,
              y1: ep.wall.y1,
              x2: ep.wall.x2,
              y2: ep.wall.y2
            });
            network.broadcast({
              type: 'WALL_UPDATE',
              wallId: ep.wall.id,
              data: { x1: ep.wall.x1, y1: ep.wall.y1, x2: ep.wall.x2, y2: ep.wall.y2 }
            });
          }
        }
        audio.playClockTick();
        store.addCombatLog({
          type: 'SYSTEM',
          title: '✂️ MUROS SEPARADOS',
          details: `Vértice compuesto separado. Se han independizado ${nearEndpoints.length} extremos de muro.`
        });
        return;
      } else if (nearEndpoints.length === 1) {
        // Single standalone endpoint: double click starts drawing a new wall segment from it
        const ep = nearEndpoints[0];
        this.wallStart = { x: ep.x, y: ep.y };
        this.wallCurrent = { x: Math.round(world.x), y: Math.round(world.y) };
        store.update({ activeTool: 'wall', selectedWallId: ep.wall.id });
        audio.playClockTick();
        return;
      }

      // 2. Line Anomalies & Lasers Endpoints (Point A or Point B)
      for (const eff of (map.effects || [])) {
        if (eff.shape === 'line' || eff.type === 'laser') {
          const x2 = eff.x2 ?? (eff.x + 260);
          const y2 = eff.y2 ?? eff.y;
          const dA = Math.hypot(world.x - eff.x, world.y - eff.y);
          const dB = Math.hypot(world.x - x2, world.y - y2);

          if (dA <= 16 || dB <= 16) {
            const startX = dB <= 16 ? x2 : eff.x;
            const startY = dB <= 16 ? y2 : eff.y;
            const dir = dB <= 16 ? 1 : -1;
            const newEff = store.addEffect({
              type: eff.type,
              shape: 'line',
              color: eff.color,
              beamWidth: eff.beamWidth,
              intensity: eff.intensity,
              frequency: eff.frequency,
              label: eff.label,
              x: startX,
              y: startY,
              x2: startX + 220 * dir,
              y2: startY
            });
            store.update({ selectedEffectId: newEff.id, activeTool: 'select' });
            audio.playClockTick();
            return;
          }
        }
      }

      // B. Check Lines Between Two Points: double-click on a line between two points creates a new anchor
      // 1. Walls: Split segment into two contiguous walls sharing the new anchor point
      for (const w of (map.walls || [])) {
        const proj = this.projectPointToSegment(world.x, world.y, w.x1, w.y1, w.x2, w.y2);
        if (proj.dist <= 15 && proj.t > 0.06 && proj.t < 0.94) {
          const snapped = this.snapPoint(Math.round(proj.x), Math.round(proj.y), 16);
          const anchorX = snapped.x;
          const anchorY = snapped.y;

          const wall1 = { ...w, x2: anchorX, y2: anchorY };
          const wall2 = {
            ...w,
            id: 'wall_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            x1: anchorX,
            y1: anchorY,
            x2: w.x2,
            y2: w.y2
          };

          const updatedWalls = (map.walls || []).map(existing => existing.id === w.id ? wall1 : existing);
          updatedWalls.push(wall2);
          store.updateActiveMap({ walls: updatedWalls });
          store.update({ selectedWallId: wall1.id });
          audio.playClockTick();
          return;
        }
      }

      // 2. Polygon Water Zones: Insert new vertex between the two clicked vertices
      for (const zone of (map.waterZones || [])) {
        if (zone.shape === 'polygon' && zone.points && zone.points.length >= 3) {
          const pts = zone.points;
          for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            const proj = this.projectPointToSegment(world.x, world.y, p1.x, p1.y, p2.x, p2.y);
            if (proj.dist <= 15 && proj.t > 0.06 && proj.t < 0.94) {
              const newPts = [...pts];
              newPts.splice(i + 1, 0, { x: Math.round(proj.x), y: Math.round(proj.y) });
              store.updateWaterZone(zone.id, { points: newPts });
              store.update({ selectedWaterId: zone.id });
              audio.playClockTick();
              return;
            }
          }
        }
      }

      // 3. Persistent Anomaly Effects: Insert new vertex or split line
      for (const eff of (map.effects || [])) {
        if (eff.shape === 'polygon' && eff.points && eff.points.length >= 3) {
          const pts = eff.points;
          for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            const proj = this.projectPointToSegment(world.x, world.y, p1.x, p1.y, p2.x, p2.y);
            if (proj.dist <= 15 && proj.t > 0.06 && proj.t < 0.94) {
              const newPts = [...pts];
              newPts.splice(i + 1, 0, { x: Math.round(proj.x), y: Math.round(proj.y) });
              store.updateEffect(eff.id, { points: newPts });
              store.update({ selectedEffectId: eff.id });
              audio.playClockTick();
              return;
            }
          }
        } else if (eff.shape === 'line' || eff.type === 'laser') {
          const x2 = eff.x2 ?? (eff.x + 260);
          const y2 = eff.y2 ?? eff.y;
          const proj = this.projectPointToSegment(world.x, world.y, eff.x, eff.y, x2, y2);
          if (proj.dist <= 15 && proj.t > 0.06 && proj.t < 0.94) {
            const anchorX = Math.round(proj.x);
            const anchorY = Math.round(proj.y);

            if (eff.type === 'laser') {
              // Split laser beam into two connected segments
              store.updateEffect(eff.id, { x2: anchorX, y2: anchorY });
              const newLaser = store.addEffect({
                type: 'laser',
                shape: 'line',
                color: eff.color,
                beamWidth: eff.beamWidth,
                label: eff.label,
                x: anchorX,
                y: anchorY,
                x2: x2,
                y2: y2
              });
              store.update({ selectedEffectId: newLaser.id });
            } else {
              // Convert other line anomalies to a 3-point polygon anchor
              store.updateEffect(eff.id, {
                shape: 'polygon',
                points: [
                  { x: eff.x, y: eff.y },
                  { x: anchorX, y: anchorY },
                  { x: x2, y: y2 }
                ]
              });
            }
            audio.playClockTick();
            return;
          }
        }
      }
    }
  }

  // --- Particle FX Engine ---
  triggerPing(x, y, color = '#00f3ff') {
    this.pings.push({
      x,
      y,
      color,
      radius: 10,
      maxRadius: 180,
      alpha: 1.0,
      startTime: performance.now()
    });
  }

  triggerFX(type, params = {}) {
    this.fx.trigger(type, params);
  }

  setAttackTarget(attackerId, targetId) {
    if (!targetId) {
      this.attackTarget = null;
      store.update({ targetTokenId: null });
    } else {
      this.attackTarget = { attackerId, targetId };
      store.update({ targetTokenId: targetId });
    }
  }

  triggerAttackFX(params = {}) {
    const { attacker, target, weaponType, isCritical } = params;
    if (!attacker || !target) return;
    const x1 = attacker.x;
    const y1 = attacker.y;
    const x2 = target.x;
    const y2 = target.y;

    let fxType = 'laser';
    const typeStr = (weaponType || '').toLowerCase();
    if (typeStr.includes('plasma') || typeStr.includes('ion') || typeStr.includes('blaster') || typeStr.includes('termico')) {
      fxType = 'plasma';
    } else if (typeStr.includes('arc') || typeStr.includes('rayo') || typeStr.includes('shock') || typeStr.includes('electr') || typeStr.includes('lightning') || typeStr.includes('volt')) {
      fxType = 'lightning';
    } else if (typeStr.includes('bala') || typeStr.includes('bullet') || typeStr.includes('kinetic') || typeStr.includes('cinet') || typeStr.includes('rifle') || typeStr.includes('shotgun') || typeStr.includes('pistol')) {
      fxType = 'ballistic';
    } else if (typeStr.includes('saber') || typeStr.includes('sword') || typeStr.includes('espada') || typeStr.includes('blade') || typeStr.includes('melee') || typeStr.includes('cuerpo') || typeStr.includes('filo') || typeStr.includes('daga')) {
      fxType = 'melee';
    } else if (typeStr.includes('void') || typeStr.includes('vacio') || typeStr.includes('gravity') || typeStr.includes('grav') || typeStr.includes('entrop')) {
      fxType = 'void_beam';
    } else if (typeStr.includes('laser') || typeStr.includes('haz') || typeStr.includes('beam')) {
      fxType = 'laser';
    }

    this.fx.trigger(fxType, {
      x: x1,
      y: y1,
      targetX: x2,
      targetY: y2,
      isCritical,
      color: isCritical ? '#f59e0b' : undefined
    });
  }

  startLoop() {
    const loop = (now) => {
      this.render(now);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  render(now) {
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const ctx = this.ctx;
    const state = store.getState();
    const map = store.getActiveMap();

    this.loadMap(map);

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#060910';
    ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);

    if (!this.isMapLoaded) {
      ctx.fillStyle = '#00f3ff';
      ctx.font = '18px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('INITIALIZING QUANTUM TACTICAL MAP...', this.displayWidth / 2, this.displayHeight / 2);
      return;
    }

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // 1. LAYER: MAP / TERRAIN
    if (state.layerVisibility.map !== false) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.mapImage, 0, 0);
    }

    // 2. LAYER: WATER & HAZARDS
    if (state.layerVisibility.water !== false) {
      this.renderWaterZones(ctx, map.waterZones || [], now * 0.001, !!(map.showRain ?? state.showRain), map.rainIntensity ?? state.rainIntensity);
    }

    // Grid Overlay
    if (state.showGrid && map.gridSize) {
      this.renderGrid(ctx, map);
    }

    // 3. LAYER: WALLS & LIGHTING & FOG OF WAR
    const isKeeperGM = state.userRole === 'keeper' && state.gmVision;
    const activeTokens = store.getTokensForActiveMap();

    // A. Dynamic Lighting Pass (Ambient darkness, light fixtures, sirens)
    if (state.layerVisibility.walls_lights !== false && !isKeeperGM) {
      const fullMapId = `${state.campaignId}:${map.id}`;
      const activeLights = (map.lights || []).filter(l => {
        if (isKeeperGM || state.fogOfWar === false) return true;
        return this.fog.isPointExplored(l.x, l.y, fullMapId);
      });
      const lightingTokens = activeTokens.map(tok => {
        if (this.draggedToken && tok.id === this.draggedToken.id && this.draggedTokenOrigX != null && state.userRole === 'player') {
          return { ...tok, x: this.draggedTokenOrigX, y: this.draggedTokenOrigY };
        }
        return tok;
      });
      // When Fog of War is enabled, Fog of War itself controls map darkness and explored attenuation (50%).
      // Dynamic lighting only renders light fixtures and glows without covering the explored map with opaque darkness.
      const ambientLightLevel = state.fogOfWar !== false ? 1.0 : (map.ambientLight ?? 0.25);

      this.lighting.renderLighting({
        ctx,
        mapWidth: this.mapImage.width,
        mapHeight: this.mapImage.height,
        ambientLight: ambientLightLevel,
        ambientColor: map.ambientColor ?? '#0a1220',
        walls: map.walls || [],
        lights: activeLights,
        tokens: lightingTokens,
        time: now * 0.001
      });
    }

    // B. Fog of War Pass (Unvisited 100% dark, Explored out-of-vision 50% shroud, Current FOV 0%)
    if (state.fogOfWar !== false && state.layerVisibility.walls_lights !== false) {
      let viewers = [];
      if (state.userRole === 'player') {
        viewers = activeTokens.filter(isPartyToken);
        if (viewers.length === 0) {
          const claimed = activeTokens.find(t => t.id === state.claimedTokenId || t.id === state.selectedTokenId);
          if (claimed) viewers = [claimed];
        }
        // Anchor vision to origin position during drag so player cannot scan ahead into undiscovered areas
        if (this.draggedToken && this.draggedTokenOrigX != null) {
          viewers = viewers.map(v => v.id === this.draggedToken.id ? { ...v, x: this.draggedTokenOrigX, y: this.draggedTokenOrigY } : v);
        }
      } else {
        // Keeper mode: use player tokens to stamp exploration and show visibility
        viewers = activeTokens.filter(isPartyToken);
        if (viewers.length === 0 && state.selectedTokenId) {
          const sel = activeTokens.find(t => t.id === state.selectedTokenId);
          if (sel) viewers = [sel];
        }
      }

      this.fog.renderFogOfWar({
        ctx,
        mapWidth: this.mapImage.width,
        mapHeight: this.mapImage.height,
        mapId: `${state.campaignId}:${map.id}`,
        walls: map.walls || [],
        lights: map.lights || [],
        viewers,
        lightingEngine: this.lighting,
        exploredOpacity: state.fogExploredOpacity ?? 0.50,
        isKeeperGM: isKeeperGM,
        stamp: !this.draggedToken
      });
    }

    // Sensory Vision Acoustic Pass (Tremorsense: reveals ground creatures through darkness)
    const sensoryTokens = activeTokens.filter(t => t.visionMode === 'sensory' || t.hasVibrationVision);
    if (sensoryTokens.length > 0) {
      this.renderSensoryVision(ctx, sensoryTokens, activeTokens, now * 0.001, map.gridSize || 64);
    }

    // Chromatic Vision (Ailurean High-Contrast Grayscale)
    const selTok = activeTokens.find(t => t.id === state.selectedTokenId);
    const isChromatic = selTok && (
      selTok.visionMode === 'chromatic' ||
      selTok.species?.toLowerCase() === 'ailurean' ||
      selTok.roleTag?.toLowerCase().includes('ailurean') ||
      selTok.isAilurean
    );
    if (isChromatic) {
      if (this.canvas.style.filter !== 'grayscale(100%) contrast(1.15)') {
        this.canvas.style.filter = 'grayscale(100%) contrast(1.15)';
      }
    } else {
      if (this.canvas.style.filter && this.canvas.style.filter !== 'none') {
        this.canvas.style.filter = 'none';
      }
    }

    // Render Walls and Doors (Keeper sees controllers/limitators; Players see clean bulkheads/doors)
    const isEditorMode = (state.userRole === 'keeper' && state.gmVision) || (state.userRole === 'keeper' && state.activeLayer === 'walls_lights');
    this.renderWalls(ctx, map.walls || [], isEditorMode);
    if (isEditorMode) {
      this.renderLightMarkers(ctx, map.lights || []);
    }

    // Render In-Progress Wall
    if (this.wallStart && this.wallCurrent) {
      ctx.save();
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(this.wallStart.x, this.wallStart.y);
      ctx.lineTo(this.wallCurrent.x, this.wallCurrent.y);
      ctx.stroke();
      ctx.restore();
    }

    // Render In-Progress Water Zone
    if (this.canDrawWater() && this.waterStart && this.waterCurrent) {
      const x = Math.min(this.waterStart.x, this.waterCurrent.x);
      const y = Math.min(this.waterStart.y, this.waterCurrent.y);
      const w = Math.abs(this.waterCurrent.x - this.waterStart.x);
      const h = Math.abs(this.waterCurrent.y - this.waterStart.y);

      ctx.save();
      ctx.fillStyle = 'rgba(2, 132, 199, 0.45)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // 4. LAYER: TOKENS & OPERATIVES
    if (state.layerVisibility.tokens !== false) {
      this.renderTokens(ctx, map, now * 0.001);
    }

    // 5. LAYER: OVERLAY & FX
    if (state.layerVisibility.overlay !== false) {
      this.renderParticlesAndPings(ctx, dt, map.effects || []);
      this.renderEffectMarkers(ctx, map.effects || []);
      this.renderAttackTargeting(ctx, map, now * 0.001);
      for (const tmpl of this.templates) {
        this.renderTemplate(ctx, tmpl, tmpl === this.activeTemplate);
      }
      if (this.rulerStart && this.rulerCurrent) {
        this.renderRuler(ctx, this.rulerStart, this.rulerCurrent, map.gridSize || 64);
      }
      if (this.gridCalibStart && this.gridCalibCurrent) {
        this.renderGridCalibrationGuide(ctx, this.gridCalibStart, this.gridCalibCurrent);
      }
      this.renderRainOverlay(ctx, map, now * 0.001);
      this.renderFogOverlay(ctx, map, now * 0.001);
    }

    ctx.restore();
  }

  // --- Water Zones Rendering ---
  renderWaterZones(ctx, waterZones, time, rain = false, intensity = 'rain') {
    const state = store.getState();
    const isWaterLayer = state.activeLayer === 'water' && state.userRole === 'keeper';

    const viewport = { minX: -this.panX / this.zoom, minY: -this.panY / this.zoom,
      maxX: (this.displayWidth - this.panX) / this.zoom, maxY: (this.displayHeight - this.panY) / this.zoom };
    for (const w of waterZones) {
      const isSelected = w.id === state.selectedWaterId;
      if (!drawWaterSurface(ctx, w, time, { viewport, quality: this.fx.quality,
        reducedMotion: this.reducedMotion?.matches })) continue;
      if (rain) drawRainRipples(ctx, w, time, { viewport, quality: this.fx.quality, intensity,
        reducedMotion: this.reducedMotion?.matches });
      if (!(isWaterLayer || isSelected)) continue;
      const depth = Math.max(0, Math.min(5, w.depth ?? 2));
      const bounds = waterBounds(w);
      ctx.save();
      traceWater(ctx,w);
      ctx.strokeStyle = isSelected ? '#a5f4ff' : 'rgba(94,211,231,0.65)';
      ctx.lineWidth = (isSelected ? 2 : 1) / this.zoom; ctx.stroke();
      const handles = w.shape === 'polygon' ? w.points : [{ x: w.x+w.width, y: w.y+w.height }];
      for(const p of handles) {
        ctx.beginPath();ctx.arc(p.x,p.y,5/this.zoom,0,Math.PI*2);
        ctx.fillStyle='#06151f';ctx.fill();ctx.stroke();
      }
      ctx.font = '10px monospace';
      const label = `WATER / DEPTH ${depth}`;
      const labelW = ctx.measureText(label).width + 16;
      ctx.fillStyle='#071621e8';ctx.fillRect(bounds.minX+8,bounds.minY+8,labelW,22);
      ctx.fillStyle='#a0e6ed';ctx.fillText(label,bounds.minX+16,bounds.minY+23);
      ctx.restore();
    }

    // In-progress polygon drawing preview (Water Tool)
    if (this.canDrawWater() && state.waterDrawMode === 'polygon' && this.waterPolyPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#00f3ff';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 2 / this.zoom;
      ctx.setLineDash([6/this.zoom, 4/this.zoom]);

      ctx.beginPath();
      ctx.moveTo(this.waterPolyPoints[0].x, this.waterPolyPoints[0].y);
      for (let i = 1; i < this.waterPolyPoints.length; i++) {
        ctx.lineTo(this.waterPolyPoints[i].x, this.waterPolyPoints[i].y);
      }
      if (this.cursorWorld) {
        ctx.lineTo(this.cursorWorld.x, this.cursorWorld.y);
      }
      if (this.waterPolyPoints.length >= 2) ctx.fill();
      ctx.stroke();

      // Render vertex dots
      ctx.setLineDash([]);
      for (let i = 0; i < this.waterPolyPoints.length; i++) {
        const pt = this.waterPolyPoints[i];
        ctx.fillStyle = i === 0 ? '#10b981' : '#00f3ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (i === 0 ? 7 : 5)/this.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // First vertex closure guide
      if (this.waterPolyPoints.length >= 3 && this.cursorWorld) {
        const first = this.waterPolyPoints[0];
        const distFirst = Math.hypot(this.cursorWorld.x - first.x, this.cursorWorld.y - first.y);
        if (distFirst <= 12 / this.zoom) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(first.x, first.y, 14/this.zoom, 0, Math.PI * 2);
          ctx.stroke();

          ctx.font = 'bold 10px "Rajdhani", sans-serif';
          ctx.fillStyle = '#10b981';
          ctx.fillText('CLIC PARA CERRAR', first.x + 16, first.y + 4);
        }
      }

      ctx.restore();
    }
  }

  // --- Rain Weather Overlay Pass ---
  renderRainOverlay(ctx, map, time) {
    if (!map.showRain && !store.getState().showRain) return;
    const viewport = {
      minX: -this.panX / this.zoom,
      minY: -this.panY / this.zoom,
      maxX: (this.displayWidth - this.panX) / this.zoom,
      maxY: (this.displayHeight - this.panY) / this.zoom,
      width: this.displayWidth / this.zoom,
      height: this.displayHeight / this.zoom,
      zoom: this.zoom
    };
    renderWeatherRain(ctx, {
      map,
      viewport,
      time,
      quality: this.fx?.quality || 'balanced',
      reducedMotion: this.reducedMotion?.matches
    });
  }
  // --- Fog Weather Overlay Pass ---
  renderFogOverlay(ctx, map, time) {
    if (!map.showFog && !store.getState().showFog) return;
    const viewport = {
      minX: -this.panX / this.zoom,
      minY: -this.panY / this.zoom,
      maxX: (this.displayWidth - this.panX) / this.zoom,
      maxY: (this.displayHeight - this.panY) / this.zoom,
      width: this.displayWidth / this.zoom,
      height: this.displayHeight / this.zoom,
      zoom: this.zoom
    };
    renderWeatherFog(ctx, {
      map,
      viewport,
      time,
      quality: this.fx?.quality || 'balanced',
      reducedMotion: this.reducedMotion?.matches
    });
  }

  // --- Grid Rendering ---
  renderGrid(ctx, map) {
    const size = map.gridSize || 64;
    const w = this.mapImage.width;
    const h = this.mapImage.height;
    const offX = ((map.gridOffsetX || 0) % size + size) % size;
    const offY = ((map.gridOffsetY || 0) % size + size) % size;

    ctx.save();
    ctx.strokeStyle = map.gridColor || 'rgba(0, 243, 255, 0.18)';
    ctx.globalAlpha = map.gridAlpha !== undefined ? map.gridAlpha : 1.0;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = offX; x <= w; x += size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = offY; y <= h; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // If grid scaling / calibration tool is active, highlight calibration origin cell
    const state = store.getState();
    if (state.activeTool === 'grid_scale' && state.userRole === 'keeper') {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(offX, offY, size, size);

      ctx.fillStyle = 'rgba(253, 224, 71, 0.15)';
      ctx.fillRect(offX, offY, size, size);

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${size}px`, offX + 6, offY + 16);
    }

    ctx.restore();
  }

  // --- Interactive Grid Calibration Guide on Canvas ---
  renderGridCalibrationGuide(ctx, start, end) {
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    const size = Math.round(Math.max(w, h));

    ctx.save();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(minX, minY, size, size);

    ctx.fillStyle = 'rgba(253, 224, 71, 0.22)';
    ctx.fillRect(minX, minY, size, size);

    // Dimension badge
    const badgeText = `📐 MEDIDA: ${size}px // ESCALA DE 1 CASILLA`;
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    const textW = ctx.measureText(badgeText).width;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.fillRect(minX, minY - 26, textW + 16, 22);
    ctx.strokeRect(minX, minY - 26, textW + 16, 22);

    ctx.fillStyle = '#fde047';
    ctx.fillText(badgeText, minX + 8, minY - 11);

    ctx.restore();
  }

  // --- Check if an NPC / Adversary token is visible to any active player token ---
  isTokenVisibleToPlayers(targetTok, allTokens, map) {
    const state = store.getState();
    // 1. Friendly player tokens are always visible to players
    if (isPartyToken(targetTok)) return true;

    // 2. If Keeper has GM Vision active, all tokens are visible to Keeper
    if (state.userRole === 'keeper' && state.gmVision) return true;

    // 3. Find viewing tokens: all friendly player characters
    let viewers = allTokens.filter(isPartyToken);
    if (viewers.length === 0) {
      const sel = allTokens.find(t => t.id === state.selectedTokenId || t.id === state.claimedTokenId);
      if (sel) viewers = [sel];
    }
    if (viewers.length === 0) return false;

    // 4. Test if ANY viewer has facing line-of-sight to targetTok
    for (const viewer of viewers) {
      if (viewer.hidden) continue;
      const vx = viewer.x;
      const vy = viewer.y;
      const tx = targetTok.x;
      const ty = targetTok.y;

      const dist = Math.hypot(tx - vx, ty - vy);
      const vRange = viewer.visionRange || (viewer.hasLight ? viewer.lightRadius : 400);

      // Beyond max perception range -> cannot see
      if (dist > vRange) continue;

      // Vision angle (FOV) test
      const vAngle = viewer.visionAngle ?? 360;
      if (vAngle < 360) {
        const fAngle = viewer.facingAngle ?? 0;
        const angleToTarget = Math.atan2(ty - vy, tx - vx);
        let diff = angleToTarget - fAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const halfFov = (vAngle * Math.PI) / 360;
        if (Math.abs(diff) > halfFov) {
          // Viewer is not facing this token!
          continue;
        }
      }

      // Line of Sight obstruction test against walls and closed doors
      let losBlocked = false;
      for (const wall of (map.walls || [])) {
        const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
        if (wallType === 'window') continue; // Windows do not block line of sight
        if (wallType === 'door' && wall.isOpen) continue; // Open doors do not block LOS

        // Solid walls, closed doors, and secret doors block LOS
        if (this.checkLineIntersection(vx, vy, tx, ty, wall.x1, wall.y1, wall.x2, wall.y2)) {
          losBlocked = true;
          break;
        }
      }

      if (!losBlocked) {
        // At least one player is facing the target with direct LOS!
        return true;
      }
    }

    // 5. Test if targetTok is inside the illuminated radius of any EXPLORED light source
    const fullMapId = `${state.campaignId}:${map.id}`;
    for (const light of (map.lights || [])) {
      if (light.enabled === false) continue;
      if (!this.fog.isPointExplored(light.x, light.y, fullMapId)) continue;

      const lx = light.x;
      const ly = light.y;
      const tx = targetTok.x;
      const ty = targetTok.y;
      const dist = Math.hypot(tx - lx, ty - ly);
      const lRadius = light.radius || 200;
      if (dist > lRadius) continue;

      const lAngle = light.visionAngle ?? 360;
      if (lAngle < 360) {
        const fAngle = light.facingAngle ?? 0;
        const angleToTarget = Math.atan2(ty - ly, tx - lx);
        let diff = angleToTarget - fAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const halfFov = (lAngle * Math.PI) / 360;
        if (Math.abs(diff) > halfFov) continue;
      }

      let losBlocked = false;
      for (const wall of (map.walls || [])) {
        const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
        if (wallType === 'window') continue;
        if (wallType === 'door' && wall.isOpen) continue;
        if (this.checkLineIntersection(lx, ly, tx, ty, wall.x1, wall.y1, wall.x2, wall.y2)) {
          losBlocked = true;
          break;
        }
      }

      if (!losBlocked) {
        return true;
      }
    }

    return false;
  }

  // --- Check if a point is within active vision/light of any player token ---
  isPointInPlayerVision(x, y, allTokens, map) {
    let viewers = allTokens.filter(isPartyToken);
    for (const viewer of viewers) {
      if (viewer.hidden) continue;
      const vx = viewer.x;
      const vy = viewer.y;
      const dist = Math.hypot(x - vx, y - vy);
      const vRange = viewer.visionRange || (viewer.hasLight ? viewer.lightRadius : 400);
      if (dist > vRange) continue;

      const vAngle = viewer.visionAngle ?? 360;
      if (vAngle < 360) {
        const fAngle = viewer.facingAngle ?? 0;
        const angleToTarget = Math.atan2(y - vy, x - vx);
        let diff = angleToTarget - fAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        if (Math.abs(diff) > (vAngle * Math.PI) / 360) continue;
      }

      let losBlocked = false;
      for (const wall of (map.walls || [])) {
        const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
        if (wallType === 'window') continue;
        if (wallType === 'door' && wall.isOpen) continue;
        if (this.checkLineIntersection(vx, vy, x, y, wall.x1, wall.y1, wall.x2, wall.y2)) {
          losBlocked = true;
          break;
        }
      }
      if (!losBlocked) return true;
    }
    return false;
  }

  // --- Distance & Projection from Point to Segment Helper ---
  projectPointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return { x: x1, y: y1, t: 0, dist: Math.hypot(px - x1, py - y1) };
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    const clampedT = Math.max(0, Math.min(1, t));
    const projX = x1 + clampedT * dx;
    const projY = y1 + clampedT * dy;
    return {
      x: projX,
      y: projY,
      t: clampedT,
      dist: Math.hypot(px - projX, py - projY)
    };
  }

  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // --- Line Intersection Helper ---
  checkLineIntersection(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
    const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
    const u = -((p1x - p3x) * (p2y - p1y) - (p1y - p3y) * (p2x - p1x)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  // --- Walls, Doors & Windows Rendering ---
  renderWalls(ctx, walls, isEditor = true) {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';

    ctx.save();
    for (const w of walls) {
      const isSelected = w.id === state.selectedWallId;
      const wallType = w.wallType || (w.isDoor ? 'door' : (w.isWindow ? 'window' : 'wall'));
      const isDoor = wallType === 'door';
      const isWindow = wallType === 'window';
      const isWall = wallType === 'wall';
      const isOpen = !!w.isOpen;
      const isLocked = !!w.isLocked;
      const isSecret = !!w.isSecret;
      const visionPercent = w.visionPercent ?? 80;

      // Wall lines are ONLY visible for the Keeper.
      // Players see no wall lines (the walls block LOS and movement without drawing neon lines).
      // Secret doors are completely hidden from players.
      // In Fog of War: Unexplored walls, doors and windows are completely hidden from players.
      if (!isKeeper || !state.gmVision) {
        if (state.fogOfWar !== false) {
          const fullMapId = `${state.campaignId}:${state.activeMapId}`;
          if (!this.fog.isWallExplored(w, fullMapId)) continue;
        }
        if (!isKeeper) {
          if (isWall) continue;
          if (isDoor && isSecret) continue;
        }
      }

      ctx.save();
      if (isDoor) {
        if (isSecret && isKeeper) {
          // Secret door indicator for Keeper
          ctx.strokeStyle = isSelected ? '#c084fc' : '#a855f7';
          ctx.lineWidth = isSelected ? 5 : 4;
          ctx.setLineDash([6, 4]);
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 10;
        } else if (isOpen) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = isSelected ? 5 : 4;
          ctx.setLineDash([6, 6]);
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 8;
        } else if (isLocked) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = isSelected ? 5 : 4;
          ctx.setLineDash([]);
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;
        } else {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = isSelected ? 5 : 4;
          ctx.setLineDash([]);
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 6;
        }
      } else if (isWindow) {
        // Cyan glass sheen with double line & transparency
        ctx.strokeStyle = isSelected ? '#00f3ff' : 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = isSelected ? 5 : 3.5;
        ctx.setLineDash([8, 4]);
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = isSelected ? 12 : 6;
      } else {
        // Normal opaque wall
        ctx.strokeStyle = isSelected ? '#00f3ff' : 'rgba(255, 42, 95, 0.8)';
        ctx.lineWidth = isSelected ? 5 : 3.5;
        ctx.setLineDash([]);
        ctx.shadowColor = isSelected ? '#00f3ff' : '#ff2a5f';
        ctx.shadowBlur = isSelected ? 12 : 6;
      }

      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();

      // For Windows: render tinted glass slab along the segment proportional to window opacity
      if (isWindow) {
        const glassAlpha = Math.max(0.12, ((100 - visionPercent) / 100) * 0.45);
        ctx.save();
        ctx.strokeStyle = `rgba(56, 189, 248, ${glassAlpha})`;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.stroke();
        ctx.restore();
      }

      // Vertex Handles (Editor mode only)
      if (isEditor) {
        const drawVertexNode = (vx, vy, isSelectedWall) => {
          let connectedCount = 0;
          for (const other of walls) {
            if (Math.hypot(vx - other.x1, vy - other.y1) <= 6) connectedCount++;
            if (Math.hypot(vx - other.x2, vy - other.y2) <= 6) connectedCount++;
          }
          const isCompoundJoint = connectedCount >= 2;

          ctx.save();
          if (isCompoundJoint) {
            // Compound joint indicator: outer glowing cyan ring with white center
            ctx.beginPath();
            ctx.arc(vx, vy, 7.5, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2.2;
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 8;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(vx, vy, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          } else {
            // Standalone endpoint: standard circle
            let vertexColor = isSelectedWall ? '#00f3ff' : (isDoor ? (isSecret ? '#c084fc' : (isOpen ? '#10b981' : (isLocked ? '#ef4444' : '#f59e0b'))) : (isWindow ? '#38bdf8' : '#ff2a5f'));
            ctx.fillStyle = vertexColor;
            ctx.beginPath();
            ctx.arc(vx, vy, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        };

        drawVertexNode(w.x1, w.y1, isSelected);
        drawVertexNode(w.x2, w.y2, isSelected);
      }

      // Midpoint Handle / Door / Window Badge
      const midX = (w.x1 + w.x2) / 2;
      const midY = (w.y1 + w.y2) / 2;

      if (isDoor) {
        if (isSecret && !isKeeper) {
          // Player sees secret door as regular wall: no badge
        } else {
          ctx.beginPath();
          ctx.arc(midX, midY, 12, 0, Math.PI * 2);
          ctx.fillStyle = (isSecret && isKeeper) ? 'rgba(88, 28, 135, 0.95)' : (isOpen ? '#064e3b' : (isLocked ? '#7f1d1d' : '#78350f'));
          ctx.fill();
          ctx.strokeStyle = (isSecret && isKeeper) ? '#c084fc' : (isOpen ? '#10b981' : (isLocked ? '#ef4444' : '#f59e0b'));
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((isSecret && isKeeper) ? '🕵️' : (isOpen ? '🔓' : (isLocked ? '🔒' : '🚪')), midX, midY);
        }
      } else if (isWindow) {
        // Window glass badge
        ctx.beginPath();
        ctx.roundRect(midX - 22, midY - 9, 44, 18, 4);
        ctx.fillStyle = 'rgba(8, 47, 73, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#bae6fd';
        ctx.font = 'bold 9px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🪟 ${visionPercent}%`, midX, midY);
      } else if (isEditor) {
        ctx.beginPath();
        ctx.arc(midX, midY, 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#00f3ff' : '#fff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();
  }

  // --- Light Markers Rendering ---
  renderLightMarkers(ctx, lights) {
    const state = store.getState();

    ctx.save();
    for (const l of lights) {
      const isSelected = l.id === state.selectedLightId;

      ctx.save();
      // Lightbulb Center Marker
      ctx.fillStyle = l.color || '#00f3ff';
      ctx.shadowColor = l.color || '#00f3ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.stroke();

      // Outer Radius Circumference Ring
      ctx.strokeStyle = isSelected ? '#00f3ff' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Radius Resize Handle
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(l.x + l.radius, l.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = l.color || '#00f3ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 10px "Rajdhani", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(l.label || 'Light', l.x, l.y - 14);

      ctx.restore();
    }
    ctx.restore();
  }

  // --- Tokens Rendering ---
  renderTokens(ctx, map, time) {
    const tokens = store.getTokensForActiveMap();
    const state = store.getState();
    const gridSize = map.gridSize || 64;
    const isKeeperGM = state.userRole === 'keeper' && state.gmVision;

    for (const tok of tokens) {
      const radius = (tok.size * gridSize) / 2;
      const isSelected = tok.id === state.selectedTokenId;

      // Visibility Check:
      // Adversary / NPC tokens remain in the dark and are ONLY drawn if a player is facing them in LOS or inside an illuminated explored light
      const isVisibleToPlayers = this.isTokenVisibleToPlayers(tok, tokens, map);
      const fullMapId = `${state.campaignId}:${map.id}`;

      if (isVisibleToPlayers) {
        if (!tok.isPlayer) {
          this.lastKnownEnemyPositions.set(tok.id, {
            x: tok.x,
            y: tok.y,
            size: tok.size,
            avatar: tok.avatar,
            name: tok.name,
            color: tok.color,
            mapId: map.id
          });
        }
      } else if (!isKeeperGM) {
        // Token is out of real-time vision.
        // If players previously spotted this enemy in explored territory, show frozen last known position
        const lastPos = this.lastKnownEnemyPositions.get(tok.id);
        if (lastPos && lastPos.mapId === map.id) {
          if (this.isPointInPlayerVision(lastPos.x, lastPos.y, tokens, map)) {
            // Player is looking right at the spot and sees it is now empty: remove ghost
            this.lastKnownEnemyPositions.delete(tok.id);
          } else if (this.fog.isPointExplored(lastPos.x, lastPos.y, fullMapId)) {
            // Draw frozen last known position in the fog shroud
            this.renderGhostToken(ctx, lastPos, gridSize, time);
          }
        }
        continue;
      }

      // Check if token is in any water zone
      const waterZone = (map.waterZones || []).find(w => pointInWater(tok.x, tok.y, w));

      ctx.save();
      ctx.translate(tok.x, tok.y);

      // Dimmed transparency for tokens in the dark seen by Keeper
      if (!isVisibleToPlayers && isKeeperGM) {
        ctx.globalAlpha = 0.52;
      }

      // Water Wake Ripple Effect at feet
      if (waterZone) {
        const ripplePhase = (time * 2) % 1;
        const rippleRadius = radius * (1 + ripplePhase * 0.8);
        const rippleAlpha = 1 - ripplePhase;

        ctx.save();
        ctx.strokeStyle = waterZone.color || 'rgba(56, 189, 248, 0.7)';
        ctx.globalAlpha = rippleAlpha * 0.7;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (tok.hidden) {
        ctx.globalAlpha = 0.55;
      }

      // Selection Glow
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
        ctx.stroke();

        const ext = radius + 10;
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(ext - 8, ext);
          ctx.lineTo(ext, ext);
          ctx.lineTo(ext, ext - 8);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Avatar
      const img = this.getTokenImage(tok.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        ctx.fillStyle = '#00f3ff';
        ctx.font = `bold ${Math.round(radius * 0.7)}px "Orbitron", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const isKeeper = state.userRole === 'keeper';
        const isMaskedLetter = !isKeeper && this.isHorrorToken(tok);
        ctx.fillText(isMaskedLetter ? '?' : (tok.name ? tok.name.charAt(0) : '?'), 0, 0);
      }
      ctx.restore();

      // Rim Border
      ctx.save();
      let rimColor = '#00f3ff';
      if (tok.path === 'Sleeping') rimColor = '#ffaa00';
      if (!tok.isPlayer) rimColor = tok.actorType === 'drone' ? '#72dfce' : '#ef4444';
      if (tok.hidden) rimColor = '#a855f7';

      ctx.strokeStyle = rimColor;
      ctx.lineWidth = isSelected ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Hidden Badge
      if (tok.hidden) {
        ctx.save();
        ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-24, -radius - 22, 48, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HIDDEN', 0, -radius - 12);
        ctx.restore();
      }

      // Darkness / Hidden in Fog indicator for Keeper
      if (!isVisibleToPlayers && isKeeperGM) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-48, -radius - (tok.hidden ? 38 : 22), 96, 14, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🕶️ OCULTO EN NIEBLA', 0, -radius - (tok.hidden ? 31 : 15));
        ctx.restore();
      }

      // Water Depth Badge above token
      if (waterZone) {
        ctx.save();
        const depth = waterZone.depth ?? 2;
        ctx.fillStyle = 'rgba(14, 165, 233, 0.9)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-30, -radius - (tok.hidden ? 36 : 22), 60, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🌊 DEPTH ${depth}`, 0, -radius - (tok.hidden ? 26 : 12));
        ctx.restore();
      }

      // Vitals & Nameplate
      this.renderTokenVitals(ctx, tok, radius);
      drawTokenConditions(ctx, tok, radius, this.zoom);

      // Directional Vision & Smaller Directional Arrow Handle on Selected Token
      if (isSelected) {
        ctx.save();
        const fAngle = tok.facingAngle ?? 0;
        const vAngle = tok.visionAngle ?? 360;
        const arrowDist = radius + 20;

        // FOV Guide Arc if directional (< 360)
        if (vAngle < 360) {
          const halfFov = (vAngle * Math.PI) / 360;
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, radius + 40, fAngle - halfFov, fAngle + halfFov);
          ctx.stroke();

          // Radial guide lines
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(fAngle - halfFov) * (radius + 40), Math.sin(fAngle - halfFov) * (radius + 40));
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(fAngle + halfFov) * (radius + 40), Math.sin(fAngle + halfFov) * (radius + 40));
          ctx.stroke();
          ctx.restore();
        }

        // Pointer line from token boundary to arrow handle
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(Math.cos(fAngle) * radius, Math.sin(fAngle) * radius);
        ctx.lineTo(Math.cos(fAngle) * (arrowDist - 8), Math.sin(fAngle) * (arrowDist - 8));
        ctx.stroke();
        ctx.restore();

        // Smaller Directional Arrow Handle
        const arrowX = Math.cos(fAngle) * arrowDist;
        const arrowY = Math.sin(fAngle) * arrowDist;

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(fAngle);

        // Sleek compact directional arrow
        ctx.beginPath();
        ctx.moveTo(9, 0);     // Tip pointing forward
        ctx.lineTo(-7, -6);   // Top wing
        ctx.lineTo(-3, 0);    // Inner notch
        ctx.lineTo(-7, 6);    // Bottom wing
        ctx.closePath();

        ctx.fillStyle = '#00f3ff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
      }

      ctx.restore();
    }
  }

  // --- Render Ghost / Last Known Position of Enemy in Fog of War ---
  renderGhostToken(ctx, ghost, gridSize, time) {
    const radius = ((ghost.size || 1) * gridSize) / 2;
    ctx.save();
    ctx.translate(ghost.x, ghost.y);

    // Ghost transparency & radar border
    ctx.globalAlpha = 0.45;

    // Outer scanning dashed ring
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Token base
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Portrait / initial
    const img = this.getTokenImage(ghost.avatar);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `bold ${Math.round(radius * 0.7)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((ghost.name || '?')[0].toUpperCase(), 0, 0);
    }

    // Badge
    ctx.globalAlpha = 0.85;
    ctx.font = 'bold 9px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('ÚLTIMA POS.', 0, radius + 12);

    ctx.restore();
  }

  // --- Tactical Attack Targeting LOS & Distance Rendering ---
  renderAttackTargeting(ctx, map, time) {
    const state = store.getState();
    const tokens = store.getTokensForActiveMap();
    if (!tokens || tokens.length < 2) return;

    let targetId = this.attackTarget?.targetId || state.targetTokenId;
    let attackerId = this.attackTarget?.attackerId;

    if (!targetId) return;

    const target = tokens.find(t => t.id === targetId);
    if (!target) return;

    let attacker = tokens.find(t => t.id === attackerId);
    if (!attacker) {
      if (state.selectedTokenId && state.selectedTokenId !== targetId) {
        attacker = tokens.find(t => t.id === state.selectedTokenId);
      } else if (state.claimedTokenId && state.claimedTokenId !== targetId) {
        attacker = tokens.find(t => t.id === state.claimedTokenId);
      }
    }

    if (!attacker || attacker.id === target.id) return;

    // Visibility test for players: do not reveal adversaries out of sight
    const isKeeperGM = state.userRole === 'keeper' && state.gmVision;
    if (!isKeeperGM && !target.isPlayer && !this.isTokenVisibleToPlayers(target, tokens, map)) {
      return;
    }

    const x1 = attacker.x;
    const y1 = attacker.y;
    const x2 = target.x;
    const y2 = target.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const distPx = Math.hypot(dx, dy);
    if (distPx < 1) return;

    const gridSize = map.gridSize || 64;
    const distSquares = (distPx / gridSize).toFixed(1);
    const distMeters = ((distPx / gridSize) * 1.5).toFixed(1);

    // LOS obstruction test against walls and closed doors
    let losBlocked = false;
    for (const wall of (map.walls || [])) {
      const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
      if (wallType === 'window') continue;
      if (wallType === 'door' && wall.isOpen) continue;
      if (this.checkLineIntersection(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2)) {
        losBlocked = true;
        break;
      }
    }

    ctx.save();

    // 1. Draw Targeting Laser Line
    const beamColor = losBlocked ? '#ef4444' : '#00f3ff';
    const coreColor = losBlocked ? '#fca5a5' : '#e0f2fe';

    ctx.strokeStyle = beamColor;
    ctx.lineWidth = 4 / this.zoom;
    ctx.shadowColor = beamColor;
    ctx.shadowBlur = 10;
    if (losBlocked) {
      ctx.setLineDash([10 / this.zoom, 6 / this.zoom]);
    } else {
      ctx.lineDashOffset = -(time * 40) % 32;
      ctx.setLineDash([16 / this.zoom, 8 / this.zoom]);
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 1.5 / this.zoom;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // 2. Crosshair Reticle on Target
    const targetRadius = ((target.size || 1) * gridSize) / 2;
    const reticleRadius = targetRadius + 14 / this.zoom;

    ctx.save();
    ctx.translate(x2, y2);
    ctx.rotate(time * 1.5);

    ctx.strokeStyle = beamColor;
    ctx.lineWidth = 2 / this.zoom;
    ctx.setLineDash([8 / this.zoom, 6 / this.zoom]);
    ctx.beginPath();
    ctx.arc(0, 0, reticleRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    const bracketSize = 8 / this.zoom;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(reticleRadius - bracketSize, -reticleRadius);
      ctx.lineTo(reticleRadius, -reticleRadius);
      ctx.lineTo(reticleRadius, -reticleRadius + bracketSize);
      ctx.stroke();
    }
    ctx.restore();

    // Center Crosshair Pip
    ctx.save();
    ctx.translate(x2, y2);
    ctx.strokeStyle = beamColor;
    ctx.lineWidth = 1.5 / this.zoom;
    ctx.beginPath();
    const pip = 6 / this.zoom;
    ctx.moveTo(-pip, 0); ctx.lineTo(pip, 0);
    ctx.moveTo(0, -pip); ctx.lineTo(0, pip);
    ctx.stroke();
    ctx.restore();

    // 3. Tactical HUD Tag at midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const titleText = `🎯 ${target.name.toUpperCase()}`;
    const statusText = losBlocked ? `⚠️ BLOQUEADO · ${distMeters}m (${distSquares} cas)` : `⚡ DESPEJADO · ${distMeters}m (${distSquares} cas)`;

    ctx.font = `bold ${Math.max(10, Math.round(11 / this.zoom))}px "Rajdhani", sans-serif`;
    const titleWidth = ctx.measureText(titleText).width;
    const statusWidth = ctx.measureText(statusText).width;
    const badgeW = Math.max(titleWidth, statusWidth) + 20 / this.zoom;
    const badgeH = 34 / this.zoom;

    ctx.fillStyle = 'rgba(7, 16, 29, 0.92)';
    ctx.strokeStyle = beamColor;
    ctx.lineWidth = 1.5 / this.zoom;
    ctx.beginPath();
    ctx.roundRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH, 4 / this.zoom);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(titleText, midX, midY - 6 / this.zoom);

    ctx.font = `${Math.max(9, Math.round(10 / this.zoom))}px "Rajdhani", sans-serif`;
    ctx.fillStyle = losBlocked ? '#ef4444' : '#10b981';
    ctx.fillText(statusText, midX, midY + 8 / this.zoom);

    ctx.restore();
  }

  // Helper to determine if a token is a horror, adversary, or has its identity masked from players
  isHorrorToken(tok) {
    if (!tok) return false;
    if (tok.hideName) return true;
    if (tok.isPlayer) return false;
    if (tok.actorType === 'adversary') return true;
    const str = `${tok.name || ''} ${tok.roleTag || ''} ${tok.species || ''}`.toLowerCase();
    return /horror|stalker|abomination|threat|alien|beast|monster|parasite|spawn|unknown/i.test(str);
  }

  // --- Sensory Vision Acoustic Pass (Tremorsense 360°: reveals ground creatures through darkness) ---
  // Slow dramatic 10-second pulse cycle (Aliens motion tracker aesthetic)
  renderSensoryVision(ctx, sensoryTokens, allTokens, time, gridSize = 64) {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';
    const cycleDuration = 10.0; // 10 seconds between sweeps
    const waveDuration = 3.2;   // Pulse expands slowly across deck over 3.2s
    const timeInCycle = time % cycleDuration;

    for (const sensorTok of sensoryTokens) {
      const sRange = sensorTok.vibrationRadius || sensorTok.visionRange || 280;

      ctx.save();

      // 1. Expanding acoustic wavefront from sensor token (first 3.2s of the 10s cycle)
      if (timeInCycle < waveDuration) {
        const prog = timeInCycle / waveDuration;
        const curR = prog * sRange;
        const waveAlpha = (1 - prog) * 0.45;

        ctx.strokeStyle = `rgba(52, 211, 153, ${waveAlpha})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(sensorTok.x, sensorTok.y, curR, 0, Math.PI * 2);
        ctx.stroke();

        if (prog > 0.25) {
          const prog2 = (prog - 0.25) / 0.75;
          ctx.strokeStyle = `rgba(52, 211, 153, ${(1 - prog2) * 0.18})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(sensorTok.x, sensorTok.y, prog2 * sRange, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 2. Detect moving ground contacts within vibration radius
      for (const target of allTokens) {
        if (target.id === sensorTok.id || target.isFlying) continue;

        const dist = Math.hypot(target.x - sensorTok.x, target.y - sensorTok.y);
        if (dist > sRange) continue;

        const arrivalTime = (dist / sRange) * waveDuration;
        const timeSinceArrival = timeInCycle - arrivalTime;
        const blipDuration = 2.8; // Dramatic fade over 2.8s

        if (timeSinceArrival >= 0 && timeSinceArrival < blipDuration) {
          const blipProg = timeSinceArrival / blipDuration;
          // Smooth pulse curve: fast rise, slow eerie decay
          const intensity = Math.sin(blipProg * Math.PI) * Math.pow(1 - blipProg, 0.6);
          const targetRadius = ((target.size || 1) * gridSize) / 2;

          ctx.save();
          ctx.globalAlpha = intensity;

          // A. Slow dramatic phosphor green contact ring (token footprint)
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(target.x, target.y, targetRadius + 4, 0, Math.PI * 2);
          ctx.stroke();

          // B. Faint secondary echo ring expanding outward
          const echoR = targetRadius + 4 + blipProg * 14;
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(target.x, target.y, echoR, 0, Math.PI * 2);
          ctx.stroke();

          // C. Center phosphor ping dot
          ctx.fillStyle = 'rgba(52, 211, 153, 0.85)';
          ctx.beginPath();
          ctx.arc(target.x, target.y, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // D. Vibration acoustic bearing line from sensor to target
          ctx.save();
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(sensorTok.x, sensorTok.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.restore();

          // E. Acoustic radar blip label - All non-player tokens mask identity with ????? for players
          const isMasked = !target.isPlayer || this.isHorrorToken(target);
          const labelText = isMasked
            ? (isKeeper && state.gmVision ? `📡 VIBRACIÓN: ????? [${target.name.toUpperCase()}]` : '📡 VIBRACIÓN: ?????')
            : `📡 VIBRACIÓN: ${target.name.toUpperCase()}`;

          ctx.font = 'bold 9px "Rajdhani", sans-serif';
          const textW = ctx.measureText(labelText).width;
          const badgeW = Math.max(90, textW + 20);

          ctx.fillStyle = 'rgba(6, 78, 59, 0.9)';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(target.x - badgeW / 2, target.y - 42, badgeW, 18, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#6ee7b7';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, target.x, target.y - 33);

          ctx.restore();
        }
      }

      ctx.restore();
    }
  }

  // Helper to extract numerical current and max for any character sheet stat
  resolveTokenStat(tok, key, mode = 'current') {
    if (!tok || !key) return 0;
    if (key === 'hp') return mode === 'current' ? (tok.hp?.current ?? 0) : (tok.hp?.max ?? 10);
    if (key === 'stress') return mode === 'current' ? (tok.stress?.current ?? 0) : (tok.stress?.max ?? 6);
    if (key === 'armor') return mode === 'current' ? (tok.armor?.current ?? 0) : (tok.armor?.max ?? 2);
    if (key === 'hope') return mode === 'current' ? (tok.hope ?? 0) : 6;
    if (key === 'effort') return mode === 'current' ? (tok.effort ?? 0) : 6;
    if (key === 'resolve') return mode === 'current' ? (tok.resolve?.current ?? 0) : (tok.resolve?.max ?? 4);
    if (key === 'clock') return mode === 'current' ? (tok.displayConfig?.clockProgress ?? 0) : (tok.displayConfig?.clockSegments ?? 4);
    if (key.startsWith('trait_')) {
      const traitName = key.replace('trait_', '');
      return tok.traits?.[traitName] ?? 0;
    }
    return 0;
  }

  renderTokenVitals(ctx, tok, radius) {
    ctx.save();
    const cfg = tok.displayConfig || {};
    const gaugeScale = Math.max(1, Math.min(2, 0.9 / this.zoom));
    const overlays = tok.displayOverlays || [];

    // If custom modular overlays are defined, render them
    if (overlays.length > 0) {
      let barY = -radius - 12 * gaugeScale;
      const barWidth = Math.max(radius * 2, 86 * gaugeScale);
      for (const item of overlays) {
        if (item.type !== 'bar') continue;
        drawTokenGauge(ctx, { x: -barWidth / 2, y: barY, width: barWidth,
          current: item.current ?? this.resolveTokenStat(tok, item.statKey, 'current'),
          max: item.max ?? this.resolveTokenStat(tok, item.statKey, 'max'),
          key: item.statKey, label: item.label, color: item.color, scale: gaugeScale });
        barY -= 25 * gaugeScale;
      }

      // Nameplate below token
      ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
      ctx.lineWidth = 1;
      const nameWidth = Math.max(radius * 2, 70);
      ctx.beginPath();
      ctx.roundRect(-nameWidth / 2, radius + 4, nameWidth, 16, 3);
      ctx.fill();
      ctx.stroke();

      const isKeeper = store.getState().userRole === 'keeper';
      const isMasked = !isKeeper && this.isHorrorToken(tok);
      const rawName = isMasked ? '?????' : tok.name;
      const displayName = (isKeeper && this.isHorrorToken(tok))
        ? (tok.name.length > 10 ? tok.name.substring(0, 9) + '.. [?]' : `${tok.name} [?]`)
        : (rawName.length > 14 ? rawName.substring(0, 12) + '..' : rawName);

      ctx.fillStyle = isMasked ? '#f43f5e' : '#e2e8f0';
      ctx.font = 'bold 11px "Rajdhani", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayName, 0, radius + 12);

      // 2. Linear Badges below nameplate
      const linearBadges = overlays.filter(o => o.type === 'linear');
      if (linearBadges.length > 0) {
        const badgeY = radius + 24;
        const bWidth = 52;
        const spacing = 4;
        const totalW = linearBadges.length * bWidth + (linearBadges.length - 1) * spacing;
        let startX = -totalW / 2;

        for (const item of linearBadges) {
          const cur = item.current ?? this.resolveTokenStat(tok, item.statKey, 'current') ?? 0;
          const max = item.max ?? this.resolveTokenStat(tok, item.statKey, 'max');
          const color = item.color || '#38bdf8';
          const label = item.label || item.statKey.toUpperCase();
          const text = max !== undefined && max !== null ? `${label} ${cur}/${max}` : `${label} ${cur}`;

          ctx.beginPath();
          ctx.roundRect(startX, badgeY, bWidth, 15, 3);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.font = 'bold 9px "Rajdhani", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, startX + bWidth / 2, badgeY + 7.5);

          startX += bWidth + spacing;
        }
      }

      // 3. Circular Counter / Tactical Clock Dials
      const circularItems = overlays.filter(o => o.type === 'circular');
      circularItems.forEach((item, idx) => {
        const cur = item.current ?? (tok.displayConfig?.clockProgress ?? 0);
        const max = item.max ?? (item.segments || tok.displayConfig?.clockSegments || 4);
        const color = item.color || '#00f3ff';
        const label = item.label || 'CLOCK';
        const clockRadius = 14;

        const clockX = idx === 0 ? radius * 0.75 : (idx === 1 ? -radius * 0.75 : radius * 0.75);
        const clockY = idx <= 1 ? -radius * 0.75 : radius * 0.75;

        ctx.save();
        ctx.translate(clockX, clockY);

        ctx.beginPath();
        ctx.arc(0, 0, clockRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 15, 26, 0.95)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.stroke();

        const segAngle = (Math.PI * 2) / max;
        for (let s = 0; s < max; s++) {
          const a = -Math.PI / 2 + s * segAngle;
          if (s < cur) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, clockRadius - 1.5, a, a + segAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
          }
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * clockRadius, Math.sin(a) * clockRadius);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        if (label) {
          ctx.fillStyle = color;
          ctx.font = 'bold 8px "Rajdhani", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label, 0, clockRadius + 8);
        }

        ctx.restore();
      });

      ctx.restore();
      return;
    }

    // Default Legacy Fallback using displayConfig

    let barY = -radius - 12 * gaugeScale;
    const width = Math.max(radius * 2, 86 * gaugeScale);
    if (cfg.showHpBar !== false && tok.hp?.max) {
      drawTokenGauge(ctx, { x: -width / 2, y: barY, width, scale: gaugeScale, key: 'hp', current: tok.hp.current, max: tok.hp.max });
      barY -= 25 * gaugeScale;
    }
    if (cfg.showStressBar) {
      drawTokenGauge(ctx, { x: -width / 2, y: barY, width, scale: gaugeScale, key: 'stress', current: tok.stress?.current ?? 0, max: tok.stress?.max ?? 6 });
    }

    // 2. Nameplate below token
    ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
    ctx.lineWidth = 1;
    const nameWidth = Math.max(radius * 2, 70);
    ctx.beginPath();
    ctx.roundRect(-nameWidth / 2, radius + 4, nameWidth, 16, 3);
    ctx.fill();
    ctx.stroke();

    const isKeeper = store.getState().userRole === 'keeper';
    const isMasked = !isKeeper && this.isHorrorToken(tok);
    const rawName = isMasked ? '?????' : tok.name;
    const displayName = (isKeeper && this.isHorrorToken(tok))
      ? (tok.name.length > 10 ? tok.name.substring(0, 9) + '.. [?]' : `${tok.name} [?]`)
      : (rawName.length > 14 ? rawName.substring(0, 12) + '..' : rawName);

    ctx.fillStyle = isMasked ? '#f43f5e' : '#e2e8f0';
    ctx.font = 'bold 11px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayName, 0, radius + 12);

    // 3. Configurable Numeric Counters row below nameplate
    const badges = [];
    if (cfg.showHpCounter && tok.hp) {
      badges.push({ text: `❤️ ${tok.hp.current}/${tok.hp.max}`, color: '#34d399', bg: 'rgba(6, 78, 59, 0.85)' });
    }
    if (cfg.showStressCounter) {
      badges.push({ text: `⚡ ${tok.stress?.current ?? 0}/${tok.stress?.max || 6}`, color: '#f472b6', bg: 'rgba(131, 24, 67, 0.85)' });
    }
    if (cfg.showArmorCounter) {
      badges.push({ text: `🛡️ ${tok.armor?.current ?? 0}`, color: '#38bdf8', bg: 'rgba(12, 74, 110, 0.85)' });
    }

    if (badges.length > 0) {
      const badgeY = radius + 24;
      const bWidth = 48;
      const spacing = 4;
      const totalW = badges.length * bWidth + (badges.length - 1) * spacing;
      let startX = -totalW / 2;

      for (const b of badges) {
        ctx.beginPath();
        ctx.roundRect(startX, badgeY, bWidth, 14, 3);
        ctx.fillStyle = b.bg;
        ctx.fill();
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.text, startX + bWidth / 2, badgeY + 7);

        startX += bWidth + spacing;
      }
    }

    // 4. Tactical Mini-Clock on Token (Top-Right Quadrant)
    if (cfg.showClock) {
      const clockRadius = 14;
      const clockX = radius * 0.75;
      const clockY = -radius * 0.75;
      const segs = cfg.clockSegments || 4;
      const prog = Math.min(segs, Math.max(0, cfg.clockProgress || 0));

      ctx.save();
      ctx.translate(clockX, clockY);

      // Dial background
      ctx.beginPath();
      ctx.arc(0, 0, clockRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 15, 26, 0.95)';
      ctx.fill();
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Slices
      const sliceAngle = (Math.PI * 2) / segs;
      for (let s = 0; s < segs; s++) {
        const startAng = -Math.PI / 2 + s * sliceAngle;
        const endAng = startAng + sliceAngle;

        if (s < prog) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, clockRadius - 2, startAng, endAng);
          ctx.closePath();
          ctx.fillStyle = prog >= segs ? '#ef4444' : '#00f3ff';
          ctx.fill();
        }

        // Divider ray
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(startAng) * clockRadius, Math.sin(startAng) * clockRadius);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Center pivot
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      // Clock label tag below
      if (cfg.clockLabel) {
        ctx.beginPath();
        ctx.roundRect(-24, clockRadius + 2, 48, 12, 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#00f3ff';
        ctx.font = 'bold 8px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${prog}/${segs} ${cfg.clockLabel}`, 0, clockRadius + 8);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // --- Dynamic Area Templates with Rotate, Scale & Delete Handles ---
  renderTemplate(ctx, tmpl, isSelected = true) {
    const map = store.getActiveMap();
    const gridSize = map.gridSize || 64;
    const scaleMeters = map.gridScaleMeters || 2.0;
    const radiusMeters = ((tmpl.radius / gridSize) * scaleMeters).toFixed(1);
    const radiusSq = (tmpl.radius / gridSize).toFixed(1);
    let deg = Math.round(((tmpl.angle || 0) * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;

    const mainColor = tmpl.type === 'circle' ? '#00f3ff'
                    : tmpl.type === 'cone' ? '#ffaa00'
                    : tmpl.type === 'line' ? '#c084fc'
                    : '#10b981';

    ctx.save();
    ctx.translate(tmpl.x, tmpl.y);
    ctx.rotate(tmpl.angle || 0);

    // 1. Draw Template Shape with Tactical Holographic Styling
    if (tmpl.type === 'circle') {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, tmpl.radius);
      grad.addColorStop(0, 'rgba(0, 243, 255, 0.28)');
      grad.addColorStop(0.7, 'rgba(0, 243, 255, 0.12)');
      grad.addColorStop(1, 'rgba(0, 243, 255, 0.04)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = isSelected ? 14 : 6;

      ctx.beginPath();
      ctx.arc(0, 0, tmpl.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Range distance concentric rings
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, tmpl.radius * 0.33, 0, Math.PI * 2);
      ctx.arc(0, 0, tmpl.radius * 0.66, 0, Math.PI * 2);
      ctx.stroke();

      // Aim axis line to 2nd controller
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tmpl.radius, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tmpl.type === 'cone') {
      const coneHalfAngle = (tmpl.coneAngle || (Math.PI / 3)) / 2;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, tmpl.radius);
      grad.addColorStop(0, 'rgba(255, 170, 0, 0.35)');
      grad.addColorStop(0.7, 'rgba(255, 100, 0, 0.15)');
      grad.addColorStop(1, 'rgba(255, 40, 0, 0.04)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = isSelected ? 14 : 6;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, tmpl.radius, -coneHalfAngle, coneHalfAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Range arcs
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, tmpl.radius * 0.5, -coneHalfAngle, coneHalfAngle);
      ctx.stroke();

      // Aim axis
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tmpl.radius, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tmpl.type === 'line') {
      const beamWidth = tmpl.width || 48;
      const grad = ctx.createLinearGradient(0, 0, tmpl.radius, 0);
      grad.addColorStop(0, 'rgba(192, 132, 252, 0.4)');
      grad.addColorStop(1, 'rgba(192, 132, 252, 0.1)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = isSelected ? 14 : 6;

      ctx.beginPath();
      ctx.rect(0, -beamWidth / 2, tmpl.radius, beamWidth);
      ctx.fill();
      ctx.stroke();

      // Forward chevrons along beam
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      for (let x = 40; x < tmpl.radius - 20; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x - 6, -8);
        ctx.lineTo(x, 0);
        ctx.lineTo(x - 6, 8);
        ctx.stroke();
      }
    } else if (tmpl.type === 'box') {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, tmpl.radius * 1.4);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = isSelected ? 14 : 6;

      ctx.beginPath();
      ctx.rect(-tmpl.radius, -tmpl.radius, tmpl.radius * 2, tmpl.radius * 2);
      ctx.fill();
      ctx.stroke();

      // Aim axis to controller
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tmpl.radius, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Interactive Handles (Rendered if selected)
    if (isSelected) {
      // Center Move Handle (Diamond Four-Way Move Crosshair) at (0, 0)
      ctx.fillStyle = '#00f3ff';
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // The 2nd Controller Handle (Rotate & Scale Gimbal) at (tmpl.radius, 0)
      ctx.strokeStyle = mainColor;
      ctx.fillStyle = 'rgba(6, 11, 25, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 14;

      ctx.beginPath();
      ctx.arc(tmpl.radius, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Gimbal tick marks
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tmpl.radius - 17, 0); ctx.lineTo(tmpl.radius - 11, 0);
      ctx.moveTo(tmpl.radius + 11, 0); ctx.lineTo(tmpl.radius + 17, 0);
      ctx.moveTo(tmpl.radius, -17); ctx.lineTo(tmpl.radius, -11);
      ctx.moveTo(tmpl.radius, 11); ctx.lineTo(tmpl.radius, 17);
      ctx.stroke();

      // White center pivot node
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tmpl.radius, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Handle 3A: Cone Aperture Angle Handle (at outer arc rim)
      if (tmpl.type === 'cone') {
        const coneHalfAngle = (tmpl.coneAngle || (Math.PI / 3)) / 2;
        const ax = Math.cos(coneHalfAngle) * tmpl.radius;
        const ay = Math.sin(coneHalfAngle) * tmpl.radius;
        ctx.fillStyle = '#ffaa00';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(ax, ay, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📐', ax, ay);
      }

      // Handle 3B: Line Beam Width Handle (at lateral beam edge)
      if (tmpl.type === 'line') {
        const lx = tmpl.radius * 0.5;
        const ly = (tmpl.width || 48) / 2;
        ctx.fillStyle = '#c084fc';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(lx, ly, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↕', lx, ly);
      }
    }

    ctx.restore(); // Restores from rotated coordinate space

    // 3. Upright HUD Badge & Delete Button [✕]
    if (isSelected) {
      ctx.save();
      const coneDeg = Math.round(((tmpl.coneAngle || (Math.PI / 3)) * 180) / Math.PI);
      const widthMeters = (((tmpl.width || 48) / gridSize) * scaleMeters).toFixed(1);
      const extraInfo = tmpl.type === 'cone' ? ` // 📐 ${coneDeg}°`
                      : tmpl.type === 'line' ? ` // ↕ ${widthMeters}m`
                      : '';
      const badgeText = `AREA: ${radiusMeters}m (${radiusSq} sq) // ${deg}°${extraInfo}`;
      ctx.font = 'bold 11px "Orbitron", sans-serif';
      const textW = ctx.measureText(badgeText).width;
      const totalW = textW + 20;
      const badgeX = tmpl.x;
      const badgeY = tmpl.y - tmpl.radius - 28;

      // Badge Background Panel
      ctx.fillStyle = 'rgba(6, 11, 25, 0.9)';
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(badgeX - totalW / 2 - 12, badgeY - 11, totalW, 22, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX - 12, badgeY);

      // Delete Button [✕]
      const delX = badgeX + totalW / 2 + 8;
      const delY = badgeY;

      ctx.fillStyle = 'rgba(255, 42, 95, 0.3)';
      ctx.strokeStyle = '#ff2a5f';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ff2a5f';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(delX, delY, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', delX, delY);

      ctx.restore();
    }
  }

  // --- Measurement Ruler with Canonical System Range Bands ---
  renderRuler(ctx, start, end, gridSize) {
    const map = store.getActiveMap() || {};
    const distPx = Math.hypot(end.x - start.x, end.y - start.y);
    const distGrid = (distPx / gridSize).toFixed(1);

    const isStarship = map.scaleType === 'starship' || map.isStarship ||
      (map.name || '').toLowerCase().includes('space') ||
      (map.name || '').toLowerCase().includes('starship') ||
      (map.name || '').toLowerCase().includes('naval');

    let distVal = 0;
    let distUnit = 'm';
    let rangeBand = 'Contact';

    if (isStarship) {
      // Starship Combat Scale (Naval Combat Chapter 17)
      const scaleKm = map.gridScaleKm || (map.gridScaleMeters ? map.gridScaleMeters * 2.5 : 5.0);
      distVal = ((distPx / gridSize) * scaleKm).toFixed(1);
      distUnit = 'km';

      const numKm = parseFloat(distVal);
      if (numKm <= 2.5) rangeBand = 'Adjacent';
      else if (numKm <= 10) rangeBand = 'Engagement';
      else if (numKm <= 35) rangeBand = 'Standard';
      else if (numKm <= 80) rangeBand = 'Long';
      else rangeBand = 'Extreme';
    } else {
      // Personal Tactical Combat Scale (Veilfarers 12.06 Canon)
      // Contact (0 - 1.5m), Very Close (1.5 - 3m), Close (3 - 10m), Far (10 - 30m), Extreme (> 30m)
      const scaleMeters = map.gridScaleMeters || 2.0;
      distVal = ((distPx / gridSize) * scaleMeters).toFixed(1);
      distUnit = 'm';

      const numM = parseFloat(distVal);
      if (numM <= 1.5) rangeBand = 'Contact';
      else if (numM <= 3.0) rangeBand = 'Very Close';
      else if (numM <= 10.0) rangeBand = 'Close';
      else if (numM <= 30.0) rangeBand = 'Far';
      else rangeBand = 'Extreme';
    }

    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 8;
    ctx.setLineDash([6, 6]);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
    ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
    ctx.fill();

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const badgeText = `${distVal}${distUnit} (${distGrid} sq) // [${rangeBand.toUpperCase()}]`;

    ctx.font = 'bold 12px "Orbitron", sans-serif';
    const textWidth = ctx.measureText(badgeText).width;

    ctx.fillStyle = 'rgba(6, 11, 25, 0.9)';
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(midX - textWidth / 2 - 8, midY - 14, textWidth + 16, 26, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00f3ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, midX, midY - 1);

    ctx.restore();
  }

  // --- Persistent Anomaly Effect Markers Rendering ---
  renderEffectMarkers(ctx, effects) {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';

    for (const eff of effects) {
      const isSelected = eff.id === state.selectedEffectId;
      if (!isKeeper && !isSelected && eff.active === false) continue;

      const shape = eff.shape || 'circle';
      const icon = eff.type === 'laser' ? '🔴'
                 : eff.type === 'void_rift' ? '🌌'
                 : eff.type === 'radiant' ? '☀️'
                 : eff.type === 'explosion' ? '💥'
                 : eff.type === 'lightning' ? '⚡'
                 : eff.type === 'emp' ? '📡'
                 : eff.type === 'toxic' ? '☠️'
                 : eff.type === 'radioactive' ? '☢️'
                 : eff.type === 'fire' ? '🔥'
                 : '✨';

      ctx.save();

      if (shape === 'line') {
        if (eff.x2 === undefined || eff.x2 === null) {
          eff.x2 = eff.x + (eff.radius || 120) * 1.5;
          eff.y2 = eff.y;
        }

        // Draw Line
        ctx.strokeStyle = eff.active === false ? 'rgba(100, 116, 139, 0.4)' : (eff.color || '#00f3ff');
        ctx.lineWidth = isSelected ? 3.5 : 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(eff.x, eff.y);
        ctx.lineTo(eff.x2, eff.y2);
        ctx.stroke();

        // Endpoints handles (A and B)
        if (isKeeper || isSelected) {
          ctx.setLineDash([]);
          // Point A
          ctx.fillStyle = isSelected ? '#ffffff' : (eff.color || '#00f3ff');
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Point B
          ctx.beginPath();
          ctx.arc(eff.x2, eff.y2, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Midpoint Badge
          const midX = (eff.x + eff.x2) / 2;
          const midY = (eff.y + eff.y2) / 2;
          ctx.beginPath();
          ctx.arc(midX, midY, 14, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(0, 243, 255, 0.35)' : 'rgba(6, 11, 25, 0.75)';
          ctx.fill();
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, midX, midY);

          ctx.font = 'bold 9px "Orbitron", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText((eff.label || (eff.type === 'laser' ? 'Laser Beam' : 'Line Anomaly')).toUpperCase(), midX, midY - 18);
        }
      } else if (shape === 'polygon') {
        if (!eff.points || eff.points.length < 3) {
          const r = eff.radius || 120;
          eff.points = Array.from({length: 5}, (_, i) => ({
            x: Math.round(eff.x + Math.cos(i * Math.PI * 2 / 5 - Math.PI / 2) * r),
            y: Math.round(eff.y + Math.sin(i * Math.PI * 2 / 5 - Math.PI / 2) * r)
          }));
        }

        // Draw Polygon perimeter & subtle fill
        ctx.strokeStyle = eff.active === false ? 'rgba(100, 116, 139, 0.4)' : (eff.color || '#00f3ff');
        ctx.fillStyle = isSelected ? 'rgba(0, 243, 255, 0.08)' : 'rgba(0, 243, 255, 0.03)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.setLineDash([6, 4]);

        ctx.beginPath();
        ctx.moveTo(eff.points[0].x, eff.points[0].y);
        for (let i = 1; i < eff.points.length; i++) {
          ctx.lineTo(eff.points[i].x, eff.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Polygon Vertex handles
        if (isKeeper || isSelected) {
          ctx.setLineDash([]);
          for (let i = 0; i < eff.points.length; i++) {
            const pt = eff.points[i];
            ctx.fillStyle = isSelected ? '#ffffff' : (eff.color || '#00f3ff');
            ctx.strokeStyle = eff.color || '#00f3ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          // Center handle & badge
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, 14, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(0, 243, 255, 0.35)' : 'rgba(6, 11, 25, 0.75)';
          ctx.fill();
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, eff.x, eff.y);

          ctx.font = 'bold 9px "Orbitron", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText((eff.label || 'Poly Anomaly').toUpperCase(), eff.x, eff.y - 18);
        }
      } else {
        // Circle (Default)
        ctx.strokeStyle = eff.active === false ? 'rgba(100, 116, 139, 0.4)' : (eff.color || '#00f3ff');
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, eff.radius || 120, 0, Math.PI * 2);
        ctx.stroke();

        // Radius handle (if selected and keeper)
        if (isSelected && isKeeper) {
          ctx.setLineDash([]);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(eff.x + (eff.radius || 120), eff.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Center Anomaly Icon & Badge (if Keeper or selected)
        if (isKeeper || isSelected) {
          ctx.setLineDash([]);
          ctx.fillStyle = isSelected ? 'rgba(0, 243, 255, 0.35)' : 'rgba(6, 11, 25, 0.75)';
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, eff.x, eff.y);

          // Label above
          ctx.font = 'bold 9px "Orbitron", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText((eff.label || 'Anomaly').toUpperCase(), eff.x, eff.y - 18);
        }
      }

      ctx.restore();
    }
  }

  // --- Particles, AAA FX & Pings ---
  renderParticlesAndPings(ctx, dt, mapEffects = []) {
    const now = performance.now();

    // 1. Radar Pings
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const ping = this.pings[i];
      const elapsed = (now - ping.startTime) / 1000;
      if (elapsed > 1.2) {
        this.pings.splice(i, 1);
        continue;
      }

      ping.radius = 10 + (ping.maxRadius - 10) * (elapsed / 1.2);
      ping.alpha = Math.max(0, 1 - elapsed / 1.2);

      ctx.save();
      ctx.strokeStyle = ping.color;
      ctx.globalAlpha = ping.alpha;
      ctx.lineWidth = 3;
      ctx.shadowColor = ping.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(ping.x, ping.y, ping.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ping.x, ping.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = ping.color;
      ctx.fill();

      ctx.restore();
    }

    // 2. High-Performance Tactical FX Simulation with Map Effects & Frustum Culling
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this.canvas.width, this.canvas.height);
    const viewport = {
      minX: Math.min(tl.x, br.x) - 160,
      minY: Math.min(tl.y, br.y) - 160,
      maxX: Math.max(tl.x, br.x) + 160,
      maxY: Math.max(tl.y, br.y) + 160
    };
    this.fx.updateAndRender(ctx, dt, mapEffects, viewport);
  }
}
