import { mapPortraitLayers } from './tokenAvatars.js';
import { isEncounterMarker } from './bestiaryProfiles.js';
// src/canvasEngine.js
// High-Resolution Tactical Canvas Engine with Water Depths (0-5), Editable Walls & Lights,
// Drag-Resizable Templates, Expanded Particle FX, and Multi-Layer Support

import { FreehandTool } from './freehand.js';
import { MapClipboard } from './mapClipboard.js';
import { LightingEngine } from './lightingEngine.js';
import { DAYLIGHT_BELOW } from './fogEngine.js';
import { drawWaterSurface, traceWater, waterBounds, drawRainRipples, renderWeatherRain, renderWeatherFog, drawLavaGlow } from './surfaceFX.js';
import { drawStatBars, drawStatRing, drawStatPips, ringRadius } from './tokenVitals.js';
import { tokenLayout, statFor, LAYOUT_STATS, namesHidden } from './tokenLayout.js';
import { frameById, frameGeometry, frameBody, frameLight } from './tokenFrames.js';
import { drawTokenConditions, getHoveredCondition } from './conditions.js';
import { FXEngine } from './fxEngine.js';
import { healedTokens } from './healFX.js';
import { FogOfWarEngine, explorationKey } from './fogEngine.js';
import { store } from './state.js';
import { withRanges } from './visionRanges.js';
import { FogBrush } from './fogBrush.js';
import { isPartyToken } from './tokenPermissions.js';
import { canvasFont } from './fontSets.js';
import { seeThrough, windowSides, SEE_TOKENS_FROM } from './windows.js';
import { network } from './networkManager.js';
import { audio } from './audioEngine.js';
import { undoManager } from './undoManager.js';
import { pointInWater } from './waterGeometry.js';
import { notify, confirmAction } from './ui.js';
import { movementBlock, approachBlock } from './combatState.js';
import { getCloudinaryConfig, uploadToCloudinary } from './cloudinaryService.js';
import { rangeBandFor, gapBandFor, tokenGapSquares, DEFAULT_METERS_PER_SQUARE } from './attackFlow.js';
import { drawEffectClocks } from './effectClocks.js';
import { grantActorSpotlight } from './gameActions.js';
import { monochromeViewer, keepsTokenColor, MonochromeLayers } from './ancestryVision.js';

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

// Whose eyes may show the map: a party token, or one this screen controls. Never an enemy's
// (players do not share what adversaries and NPCs see; v2.27.7).
// An adversary or a masked token («?????») is an enemy even when someone was given control of it:
// it never lends its eyes to the players, and they see it only when the party does (v2.27.8).
const isEnemyToken = t => !!t && !t.isPlayer && (t.actorType === 'adversary' || !!t.hideName || /horror|stalker|abomination|threat|alien|beast|monster|parasite|spawn|unknown/i.test(`${t.name || ''} ${t.roleTag || ''} ${t.species || ''}`));
// The party's eyes: party tokens that are not enemies.
const partyEyes = t => isPartyToken(t) && !isEnemyToken(t);
const sharesSight = token => !!token && !isEnemyToken(token) && (isPartyToken(token) || (store.sessionRole === 'player' && token.ownerId !== 'keeper' && !!store.canEditToken?.(token.id)));

// Ramer–Douglas–Peucker: a freehand outline with only the points that shape it.
function simplifyPath(points, tolerance = 3) {
  if (points.length < 3) return points.slice();
  const dist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy; if (!l) return Math.hypot(p.x - a.x, p.y - a.y); const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); };
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop(); let best = -1, at = -1;
    for (let k = i + 1; k < j; k++) { const d = dist(points[k], points[i], points[j]); if (d > best) { best = d; at = k; } }
    if (best > tolerance) { keep[at] = 1; stack.push([i, at], [at, j]); }
  }
  return points.filter((_, i) => keep[i]);
}

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
    this.mapImage = typeof Image !== 'undefined' ? new Image() : { width: 1000, height: 600, naturalWidth: 1000, naturalHeight: 600 };
    this.isMapLoaded = false;
    this.currentMapProgress = 0;
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
    const parent = this.canvas?.parentElement;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const w = parent ? parent.clientWidth : (this.canvas?.clientWidth || this.canvas?.width || 1000);
    const h = parent ? parent.clientHeight : (this.canvas?.clientHeight || this.canvas?.height || 600);

    if (this.canvas) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      if (this.canvas.style) {
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
      }
    }

    this.displayWidth = w;
    this.displayHeight = h;
  }

  updateMapProgress(mapData, percent, statusText) {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById('map_loader_overlay');
    const barFill = document.getElementById('map_loader_bar_fill');
    const percentEl = document.getElementById('map_loader_percent');
    const statusEl = document.getElementById('map_loader_status');
    const titleEl = document.getElementById('map_loader_title');

    if (overlay && barFill && percentEl && statusEl) {
      overlay.classList.remove('hidden');
      if (titleEl) titleEl.textContent = `SINCRONIZANDO // ${mapData.name || 'ESCENA TÁCTICA'}`.toUpperCase();
      barFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      percentEl.textContent = `${Math.round(percent)}%`;
      if (statusText) statusEl.textContent = statusText;

      if (percent >= 100) {
        clearTimeout(this._loaderHideTimer);
        this._loaderHideTimer = setTimeout(() => {
          overlay.classList.add('hidden');
        }, 400);
      }
    }

    this.currentMapProgress = percent;

    try {
      network.broadcastMapLoadStatus?.({
        mapId: mapData.id,
        progress: Math.round(percent),
        loaded: percent >= 100,
        text: statusText
      });
    } catch { /* network not ready or offline */ }
  }

  loadMap(mapData) {
    if (!mapData || !mapData.id) return;
    const campaignId = store.getState().campaignId;
    const key = `${campaignId}:${mapData.id}:${mapData.imageUrl}`;
    if (this.currentMapKey === key) {
      if (this.isMapLoaded && !this._reportedLoadedKey) {
        this._reportedLoadedKey = key;
        this.updateMapProgress(mapData, 100, 'Matriz cargada al 100%');
      }
      return;
    }
    this._reportedLoadedKey = null;
    this.cancelTokenDrag();
    this.cancelWaterDrawing();
    if (this.currentCampaignId !== campaignId) {
      this.templates = []; this.pings = []; this.activeTemplate = null;
      this.fx.particles = []; this.fx.lightningBolts = []; this.fx.shockwaves = []; this.fx.voidRifts = []; this.fx.emitterTimers.clear(); this.fx.combat.clear(); this.fx.heal?.clear();
      for (const name of ['draggedToken', 'draggedWall', 'draggedLight', 'draggedSwitch', 'draggedEffect', 'draggedWater', 'draggedTemplate', 'preDragSnapshot']) this[name] = null;
    }
    this.currentCampaignId = campaignId;
    this.currentMapKey = key;
    this.currentMapId = mapData.id;
    this.isMapLoaded = false;

    this.updateMapProgress(mapData, 5, 'Iniciando conexión con matriz...');

    // If it's a data URL, blob URL or we are in a non-browser environment
    if (!mapData.imageUrl || mapData.imageUrl.startsWith('data:') || typeof XMLHttpRequest === 'undefined') {
      this.mapImage = new Image();
      this.mapImage.onload = () => {
        if (this.currentMapKey !== key) return;
        this.isMapLoaded = true;
        this.updateMapProgress(mapData, 100, 'Matriz cargada');
        this.fitMapToViewport();
      };
      this.mapImage.onerror = () => {
        if (this.currentMapKey === key) {
          this.isMapLoaded = false;
          this.updateMapProgress(mapData, 0, 'Error al decodificar mapa');
        }
      };
      this.mapImage.src = mapData.imageUrl;
      return;
    }

    // Network / HTTP image: use XMLHttpRequest with onprogress for real byte tracking
    let xhrDone = false;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', mapData.imageUrl, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (e) => {
      if (this.currentMapKey !== key) return;
      if (e.lengthComputable && e.total > 0) {
        const percent = Math.min(95, Math.round((e.loaded / e.total) * 100));
        const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
        const totalMB = (e.total / (1024 * 1024)).toFixed(1);
        this.updateMapProgress(mapData, percent, `${loadedMB} / ${totalMB} MB (${percent}%)`);
      } else {
        const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
        this.updateMapProgress(mapData, 50, `${loadedMB} MB transferidos...`);
      }
    };

    const fallbackDirect = () => {
      if (xhrDone || this.currentMapKey !== key) return;
      xhrDone = true;
      this.mapImage = new Image();
      this.mapImage.onload = () => {
        if (this.currentMapKey !== key) return;
        this.isMapLoaded = true;
        this.updateMapProgress(mapData, 100, 'Matriz cargada');
        this.fitMapToViewport();
      };
      this.mapImage.onerror = () => {
        if (this.currentMapKey === key) {
          this.isMapLoaded = false;
          this.updateMapProgress(mapData, 0, 'Error al cargar mapa');
        }
      };
      this.mapImage.src = mapData.imageUrl;
    };

    xhr.onload = () => {
      if (this.currentMapKey !== key) return;
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
        xhrDone = true;
        const blob = xhr.response;
        const blobUrl = URL.createObjectURL(blob);
        this.mapImage = new Image();
        this.mapImage.onload = () => {
          URL.revokeObjectURL(blobUrl);
          if (this.currentMapKey !== key) return;
          this.isMapLoaded = true;
          this.updateMapProgress(mapData, 100, 'Matriz cargada');
          this.fitMapToViewport();
        };
        this.mapImage.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          fallbackDirect();
        };
        this.mapImage.src = blobUrl;
      } else {
        fallbackDirect();
      }
    };

    xhr.onerror = () => {
      fallbackDirect();
    };

    try {
      xhr.send();
    } catch {
      fallbackDirect();
    }
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

  getViewportBounds(pad = 0) {
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this.displayWidth, this.displayHeight);
    return {
      minX: Math.min(tl.x, br.x) - pad,
      minY: Math.min(tl.y, br.y) - pad,
      maxX: Math.max(tl.x, br.x) + pad,
      maxY: Math.max(tl.y, br.y) + pad
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
    this.waterStart = null; this.waterCurrent = null; this.waterPolyPoints = []; this.waterFreePoints = null;
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

  beginTokenDrag(token, facing = false) {
    this.lastMoveDistance = null;
    this.tokenDragContext = { distance: 0, campaignId: store.state.campaignId, mapId: token.mapId, tool: store.state.activeTool, role: store.state.userRole, x: token.x, y: token.y, facingAngle: token.facingAngle };
    // Gesture state is a visual preview, never the authoritative token object.
    if (facing) this.draggedTokenFacing = { ...token };
    else { this.draggedToken = { ...token }; this.draggedTokenOrigX = token.x; this.draggedTokenOrigY = token.y; }
  }
  cancelTokenDrag() {
    if (this.draggedToken || this.draggedTokenFacing) this.preDragSnapshot = null;
    this.draggedToken = null; this.draggedTokenFacing = null;
    this.draggedTokenOrigX = null; this.draggedTokenOrigY = null; this.tokenDragContext = null;
  }
  reconcileTokenDrag() {
    const drag = this.draggedToken || this.draggedTokenFacing, origin = this.tokenDragContext;
    if (!drag || !origin) return;
    const token = store.state.tokens.find(t => t.id === drag.id), state = store.state;
    if (!token || !store.canEditToken(drag.id) || token.mapId !== origin.mapId || state.activeMapId !== origin.mapId || state.campaignId !== origin.campaignId || state.activeTool !== origin.tool || state.userRole !== origin.role || token.x !== origin.x || token.y !== origin.y || (this.draggedTokenFacing && token.facingAngle !== origin.facingAngle)) this.cancelTokenDrag();
  }
  displayTokens() {
    this.reconcileTokenDrag();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return store.getTokensForActiveMap().map(token => {
      if (this.draggedToken?.id === token.id) { this.noteTokenAt(token.id, this.draggedToken.x, this.draggedToken.y, token.mapId); return { ...token, x: this.draggedToken.x, y: this.draggedToken.y }; }
      const shown = this.glideToken(token, now);
      if (this.draggedTokenFacing?.id === token.id) return { ...shown, facingAngle: this.draggedTokenFacing.facingAngle };
      return shown;
    });
  }
  // A token that changes place without being dragged here (another player's move, a move the
  // Keeper confirms, an undo) slides from where it was drawn to its new place instead of jumping.
  noteTokenAt(id, x, y, mapId) {
    this.tokenGlides ??= new Map();
    this.tokenGlides.set(id, { x, y, toX: x, toY: y, fromX: x, fromY: y, start: 0, dur: 0, mapId });
  }
  glideToken(token, now) {
    this.tokenGlides ??= new Map();
    const g = this.tokenGlides.get(token.id);
    if (!g || g.mapId !== token.mapId) { this.noteTokenAt(token.id, token.x, token.y, token.mapId); return token; }
    if (g.toX !== token.x || g.toY !== token.y) {
      const grid = store.getActiveMap?.()?.gridSize || 64;
      const dist = Math.hypot(token.x - g.x, token.y - g.y);
      // Far jumps (a new scene, a teleport across the map) are not animated.
      if (dist > grid * 40 || !Number.isFinite(dist)) { this.noteTokenAt(token.id, token.x, token.y, token.mapId); return token; }
      Object.assign(g, { fromX: g.x, fromY: g.y, toX: token.x, toY: token.y, start: now, dur: Math.max(220, Math.min(900, (dist / grid) * 110)) });
    }
    if (!g.dur) return token;
    const t = Math.min(1, (now - g.start) / g.dur), ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    g.x = g.fromX + (g.toX - g.fromX) * ease; g.y = g.fromY + (g.toY - g.fromY) * ease;
    if (t >= 1) { g.x = g.toX; g.y = g.toY; g.dur = 0; return token; }
    return { ...token, x: g.x, y: g.y };
  }
  // One square in a direction for the selected token: walls, doors and windows stop a player as
  // when dragging; the move is the player's active action (Spotlight) and reaches the table.
  nudgeSelectedToken(dx, dy) {
    const state = store.getState(), map = store.getActiveMap();
    const tok = state.tokens.find(t => t.id === state.selectedTokenId);
    if (!tok || !map || tok.mapId !== state.activeMapId || this.draggedToken) return false;
    if (!['select', 'measure'].includes(state.activeTool || 'select')) return false;
    if (state.userRole !== 'keeper' && !store.canEditToken(tok.id)) return false;
    if (state.rest && state.userRole !== 'keeper') { notify('La partida está en pausa: el grupo está descansando.', 'error'); return true; }
    // Restrained, Stunned, Incapacitated…: a player cannot move the character (the Keeper can).
    const blocked = state.userRole !== 'keeper' && movementBlock(tok);
    if (blocked) { audio.playError?.(); notify(blocked, 'error'); return true; }
    const g = map.gridSize || 64, W = this.mapImage?.width || Infinity, H = this.mapImage?.height || Infinity;
    const x = Math.max(0, Math.min(W, tok.x + dx * g)), y = Math.max(0, Math.min(H, tok.y + dy * g));
    if (x === tok.x && y === tok.y) return true;
    const afraid = state.userRole !== 'keeper' && approachBlock(tok, x, y, state.tokens);
    if (afraid) { audio.playError?.(); notify(afraid, 'error'); return true; }
    if (state.userRole !== 'keeper') {
      const wall = (map.walls || []).find(w => {
        const type = w.wallType || (w.isDoor ? 'door' : (w.isWindow ? 'window' : 'wall'));
        return (type === 'wall' || type === 'window' || (type === 'door' && !w.isOpen)) && this.checkLineIntersection(tok.x, tok.y, x, y, w.x1, w.y1, w.x2, w.y2);
      });
      if (wall) {
        const type = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
        audio.playError();
        notify(type === 'window' ? 'No puedes atravesar ventanas de cristal reforzado.' : type === 'door' ? 'La compuerta está cerrada.' : 'No puedes atravesar muros opacos.', 'error');
        return true;
      }
    }
    const stepDistance = Math.hypot(x - tok.x, y - tok.y);
    if (store.updateToken(tok.id, { x, y }) === false) return true;
    const previous = this.lastMoveDistance;
    const continued = previous?.tokenId === tok.id && previous.mapId === map.id && previous.keyboard && previous.expires > performance.now();
    this.showMoveDistance(tok.id, map.id, (continued ? previous.distance : 0) + stepDistance, true);
    if (store.sessionRole !== 'player' && state.userRole === 'player') grantActorSpotlight(store, tok.id);
    if (store.sessionRole !== 'player') network.broadcast({ type: 'TOKEN_MOVE', tokenId: tok.id, x, y });
    return true;
  }

  showMoveDistance(tokenId, mapId, distance, keyboard = false) {
    this.lastMoveDistance = { tokenId, mapId, distance, keyboard, expires: performance.now() + 1500 };
  }

  renderMovementPreview(ctx, map) {
    if (!this.draggedToken || !this.tokenDragContext?.distance) return;
    const origin = this.tokenDragContext;
    const token = this.draggedToken;
    const grid = map.gridSize || 64;
    this.renderGhostToken(ctx, { ...token, x: origin.x, y: origin.y, avatar: token.avatarUrl }, grid, 0, '');
    this.renderRuler(ctx, origin, token, grid, true);
  }

  renderMoveDistance(ctx, map, tokens) {
    const drag = this.draggedToken;
    const saved = this.lastMoveDistance;
    const active = drag ? this.tokenDragContext : saved;
    if (!active || active.mapId !== map.id || !active.distance || (!drag && active.expires <= performance.now())) return;
    const token = drag || tokens.find(t => t.id === saved.tokenId);
    if (!token) return;
    const grid = map.gridSize || 64;
    const meters = active.distance / grid * (map.gridScaleMeters || DEFAULT_METERS_PER_SQUARE);
    const label = meters.toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' m';
    const point = this.worldToScreen(token.x, token.y);
    ctx.save();
    ctx.font = 'bold 14px system-ui';
    const width = Math.ceil(ctx.measureText(label).width) + 16;
    const x = Math.max(0, Math.min(this.displayWidth - width, point.x - width / 2));
    const y = Math.max(0, Math.min(this.displayHeight - 24, point.y + (token.size || 1) * grid * this.zoom / 2 + 8));
    ctx.fillStyle = '#091625';
    ctx.fillRect(x, y, width, 24);
    ctx.fillStyle = '#a5f3fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + 12);
    ctx.restore();
  }

  // The scene's darkness now: 1 − its ambient light. When the Keeper changes it with a
  // transition (Clima: Día / Atardecer / Noche), every screen slides to it over that time.
  // A scene keeps its old look until the Keeper sets its darkness in Clima (`map.darkness`): with
  // fog of war the fog alone shades it (no darkness), without fog its ambient light does.
  sceneDarkness(map, now = (typeof performance !== 'undefined' ? performance.now() : Date.now()), fog = true) {
    if (Number.isFinite(this.previewDarkness)) return Math.max(0, Math.min(1, this.previewDarkness));
    const set = Number.isFinite(map?.darkness) ? map.darkness : fog ? 0 : 1 - (map?.ambientLight ?? 0.25);
    const target = Math.max(0, Math.min(1, set));
    const d = this.darknessAnim;
    if (!d || d.mapId !== map?.id) { this.darknessAnim = { mapId: map?.id, from: target, to: target, start: now, dur: 0 }; return target; }
    if (d.to !== target) {
      const shown = this.darknessAt(d, now);
      Object.assign(d, { from: shown, to: target, start: now, dur: Math.max(0, Math.min(60000, Number(map.lightTransitionMs) || 0)) });
    }
    return this.darknessAt(d, now);
  }
  darknessAt(d, now) {
    if (!d.dur) return d.to;
    const t = Math.max(0, Math.min(1, (now - d.start) / d.dur)), ease = t * t * (3 - 2 * t);
    return d.from + (d.to - d.from) * ease;
  }
  // The tokens of this scene as the vision, lighting and fog read them: their sight, light and
  // vibration ranges converted from metres to this map's pixels (v2.63.0, visionRanges.js).
  visionTokens() {
    const map = store.getActiveMap();
    return (store.confirmedTokens?.() || store.state.tokens).filter(token => token.mapId === store.state.activeMapId).map(token => withRanges(token, map));
  }
  initEvents() {
    this.freehand = new FreehandTool(this, store, network, notify);
    this.fogBrush = new FogBrush(this, store);
    this.mapClipboard = new MapClipboard(store, network, this, notify);
    this.tokenUnsubscribe = store.subscribe(() => this.reconcileTokenDrag());
    // A token healed shows a small green effect (v2.43.1): on every screen, for tokens it can see.
    let healTokens = store.state.tokens, healMap = store.state.activeMapId;
    this.healUnsubscribe = store.subscribe((state, keys) => {
      if (Array.isArray(keys) && !keys.includes('tokens') && !keys.includes('activeMapId')) return;
      const sameScene = state.activeMapId === healMap;
      const healed = sameScene ? healedTokens(healTokens, state.tokens, state.activeMapId) : [];
      healTokens = state.tokens; healMap = state.activeMapId;
      if (!healed.length) return;
      const map = store.getActiveMap(), grid = map?.gridSize || 64, visible = store.getTokensForActiveMap();
      for (const h of healed) {
        const token = state.tokens.find(t => t.id === h.id);
        if (state.userRole !== 'keeper' && (!token || token.hidden || !this.isTokenVisibleToPlayers(token, visible, map))) continue;
        this.fx.heal.add({ x: h.x, y: h.y, diameter: h.size * grid, amount: h.amount });
      }
      this.requestRender?.();
    });
    const waterContext = s => JSON.stringify([s.campaignId,s.activeMapId,s.activeTool,s.waterDrawMode,s.userRole,s.activeLayer,s.layerVisibility.water,s.layerLocked.water]);
    let previousWaterContext = waterContext(store.state);
    this.waterUnsubscribe = store.subscribe(state => {
      const context = waterContext(state);
      if (context !== previousWaterContext) { previousWaterContext = context; this.cancelWaterDrawing(); }
    });
    window.addEventListener('blur', () => { this.cancelWaterDrawing(); this.cancelTokenDrag(); this.freehand.cancel(); this.isSpacePressed=false; this.isPanning=false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.cancelWaterDrawing(); this.cancelTokenDrag(); this.freehand.cancel(); } });
    this.canvas.addEventListener('pointercancel', () => { this.cancelWaterDrawing(); this.cancelTokenDrag(); this.freehand.cancel(); });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resize(), 120);
    });

    // Keyboard Hotkeys
    window.addEventListener('keydown', (e) => {
    if(e.defaultPrevented || e.target.closest?.('vf-select,.orbital-listbox,.veil-modal-backdrop,[contenteditable="true"]'))return;
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (e.target.closest?.('button') && (e.key === 'Enter' || e.code === 'Space')) return;
      if (this.mapClipboard.keydown(e)) return;
      if (e.key === 'Escape') { this.cancelTokenDrag(); this.freehand.cancel(); }

      if (e.code === 'Space' && !e.repeat) {
        this.isSpacePressed = true;
        this.canvas.style.cursor = 'grab';
      }
      // Arrow keys move the selected token one square (V3), with the same rules as dragging it.
      const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (step && !e.ctrlKey && !e.metaKey && !e.altKey && this.nudgeSelectedToken(step[0], step[1])) { e.preventDefault(); return; }

      // Delete key deletes active area template or selected wall/light/water zone
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.state.selectedDrawingId) {
          e.preventDefault(); network.editDrawing('erase', { mapId: store.state.activeMapId, ids: [store.state.selectedDrawingId] }).catch(error => notify(error.message, 'error')); return;
        }
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
        if (state.selectedTokenId && (state.userRole === 'keeper' || store.canEditToken(state.selectedTokenId))) {
          const tok = state.tokens.find(t => t.id === state.selectedTokenId);
          if (tok) {
            e.preventDefault();
            if (e.shiftKey) {
              (async () => {
                const ok = await confirmAction(`¿Eliminar definitivamente al token "${tok.name}" de la campaña?`);
                if (ok) {
                  store.deleteToken(tok.id);
                  network.broadcast?.({ type: 'TOKEN_DELETE', tokenId: tok.id });
                  network.syncAll?.();
                  audio.playLaserShot();
                  notify(`🗑️ Token "${tok.name}" eliminado definitivamente.`);
                }
              })();
            } else {
              store.sendTokenToReserve(tok.id);
              network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId: tok.id, partial: { mapId: 'reserve', inReserve: true } });
              network.syncAll?.();
              audio.playClockTick();
              notify(`📦 "${tok.name}" retirado a la Reserva (Roster).`);
            }
            return;
          }
        }
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
        store.update({ selectedWallId: null, selectedLightId: null, selectedSwitchId: null, selectedWaterId: null, selectedEffectId: null, selectedTemplateId: null });
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
          const { isConfigured } = getCloudinaryConfig();
          if (isConfigured) {
            uploadToCloudinary(file, () => {}, { prefix: 'Token_' }).then(res => {
              store.updateToken(hitToken.id, { avatarUrl: res.url });
              network.broadcast({ type: 'TOKEN_UPDATE', tokenId: hitToken.id, partial: { avatarUrl: res.url } });
              audio.playSparkle();
              store.addLog({
                sender: 'Tactical Canvas',
                type: 'TOKEN_CUSTOMIZE',
                title: `Token Portrait Cloudinary: [${hitToken.name}]`,
                details: `Custom portrait asset applied from Cloudinary (Token_).`
              });
            }).catch(() => {
              store.updateToken(hitToken.id, { avatarUrl: dataUrl });
              network.broadcast({ type: 'TOKEN_UPDATE', tokenId: hitToken.id, partial: { avatarUrl: dataUrl } });
            });
            return;
          }
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
          const applyLocal = (imgSrc, w, h) => {
            store.updateActiveMap({
              imageUrl: imgSrc,
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

          const cConfig = getCloudinaryConfig();
          if (cConfig.isConfigured) {
            notify('☁️ Subiendo mapa táctico a Cloudinary...');
            uploadToCloudinary(file, percent => {
              this.updateMapProgress({ id: map.id, name: file.name }, percent, `Subiendo a Cloudinary: ${percent}%`);
            }).then(uploaded => {
              applyLocal(uploaded.url, uploaded.width || 2000, uploaded.height || 2000);
              notify('☁️ Mapa subido y optimizado en Cloudinary.');
            }).catch(err => {
              notify(`Fallo Cloudinary: ${err.message}. Usando copia local.`, 'warning');
              const testImg = new Image();
              testImg.onload = () => applyLocal(dataUrl, testImg.naturalWidth || 2000, testImg.naturalHeight || 2000);
              testImg.src = dataUrl;
            });
          } else {
            const testImg = new Image();
            testImg.onload = () => applyLocal(dataUrl, testImg.naturalWidth || 2000, testImg.naturalHeight || 2000);
            testImg.src = dataUrl;
          }
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
        if (this.freehand.start(world)) return;
        if (this.fogBrush.start(world)) return;
        if (state.activeTool === 'select') store.update({ selectedDrawingId: null });
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
          } else if (mode === 'free') {
            // Freehand: the zone follows the pointer; releasing closes it.
            this.waterFreePoints = [{ x: Math.round(world.x), y: Math.round(world.y) }];
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
              this.beginTokenDrag(selectedTok, true);
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
            // A player cannot drag a character that is Restrained or cannot act (v2.53.0).
            const blocked = !isKeeper && movementBlock(clickedToken);
            if (blocked && this.moveBlockNotice !== clickedToken.id + blocked) notify(blocked, 'error');
            this.moveBlockNotice = blocked ? clickedToken.id + blocked : '';
            const canMove = store.canEditToken(clickedToken.id) && !blocked;
            if (canMove) {
              this.beginTokenDrag(clickedToken);
              this.dragOffsetX = world.x - clickedToken.x;
              this.dragOffsetY = world.y - clickedToken.y;
            }
            this.activeTemplate = null;
            store.update({
              selectedTokenId: clickedToken.id,
              selectedWallId: null,
              selectedLightId: null, selectedSwitchId: null,
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

          // 2a. Light switches: a player uses a visible, usable one (the Keeper selects them below).
          if (!isKeeper) {
            const sw = this.switchAt(map, world, false);
            if (sw) { this.useSwitch(sw); return; }
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

                // Unlocked or Keeper: Toggle door (a connected player asks the table: it opens it)
                const newOpen = !wall.isOpen;
                if (store.sessionRole === 'player') { network.sendToHost?.({ type: 'MAP_INTERACT', kind: 'door', id: wall.id }); audio.playClockTick(); return; }
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
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedSwitchId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'pointA' };
                  return;
                } else if (dB <= 18) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedSwitchId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'pointB' };
                  return;
                } else if (dLine <= 16) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedSwitchId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
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
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedSwitchId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'polyVertex', vertexIndex: clickedVertexIndex };
                  return;
                }
                const distCenter = Math.hypot(world.x - eff.x, world.y - eff.y);
                const inside = this.pointInPolygon(world.x, world.y, eff.points);
                if (distCenter <= 24 || inside) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedSwitchId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'center', startX: world.x, startY: world.y, origX: eff.x, origY: eff.y, origPoints: eff.points.map(p => ({ ...p })) };
                  return;
                }
              } else {
                // Circle
                const distCenter = Math.hypot(world.x - eff.x, world.y - eff.y);
                const distHandle = Math.hypot(world.x - (eff.x + eff.radius), world.y - eff.y);
                if (distHandle <= 18) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedSwitchId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'radius', startX: world.x, origRadius: eff.radius };
                  return;
                } else if (distCenter <= Math.max(26, eff.radius || 120)) {
                  this.activeTemplate = null;
                  store.update({ selectedEffectId: eff.id, selectedLightId: null, selectedSwitchId: null, selectedWallId: null, selectedWaterId: null, selectedTemplateId: null });
                  this.draggedEffect = { effect: eff, handle: 'center', startX: world.x, startY: world.y, origX: eff.x, origY: eff.y };
                  return;
                }
              }
            }

            // Light switches: select and drag (double click switches them).
            const sw = this.switchAt(map, world, true);
            if (sw) {
              this.activeTemplate = null;
              store.update({ selectedSwitchId: sw.id, selectedLightId: null, selectedWallId: null, selectedEffectId: null, selectedWaterId: null, selectedTemplateId: null });
              this.draggedSwitch = { sw: { ...sw }, dx: world.x - sw.x, dy: world.y - sw.y };
              return;
            }
            // Check Light selection / handles
            for (const light of (map.lights || [])) {
              const distCenter = Math.hypot(world.x - light.x, world.y - light.y);
              const distHandle = Math.hypot(world.x - (light.x + light.radius), world.y - light.y);

              if (distHandle <= 16) {
                this.activeTemplate = null;
                store.update({ selectedLightId: light.id, selectedSwitchId: null, selectedWallId: null, selectedEffectId: null, selectedWaterId: null, selectedTemplateId: null });
                this.draggedLight = { light, handle: 'radius', startX: world.x, origRadius: light.radius };
                return;
              } else if (distCenter <= 24) {
                this.activeTemplate = null;
                store.update({ selectedLightId: light.id, selectedSwitchId: null, selectedWallId: null, selectedEffectId: null, selectedWaterId: null, selectedTemplateId: null });
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
                selectedLightId: null, selectedSwitchId: null,
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
                store.update({ selectedWallId: wall.id, selectedLightId: null, selectedSwitchId: null, selectedEffectId: null, selectedWaterId: null, selectedTemplateId: null });
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
                    store.update({ selectedWaterId: zone.id, selectedWallId: null, selectedLightId: null, selectedSwitchId: null, selectedEffectId: null, selectedTemplateId: null });
                    this.draggedWater = { zone, handle: 'polyVertex', vertexIndex: vIdx };
                    return;
                  }
                }
                if (this.pointInPolygon(world.x, world.y, zone.points)) {
                  this.activeTemplate = null;
                  store.update({ selectedWaterId: zone.id, selectedWallId: null, selectedLightId: null, selectedSwitchId: null, selectedEffectId: null, selectedTemplateId: null });
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
                  store.update({ selectedWaterId: zone.id, selectedWallId: null, selectedLightId: null, selectedSwitchId: null, selectedEffectId: null, selectedTemplateId: null });
                  this.draggedWater = { zone, handle: 'se', startX: world.x, startY: world.y, origW: zone.width, origH: zone.height };
                  return;
                } else if (inside) {
                  this.activeTemplate = null;
                  store.update({ selectedWaterId: zone.id, selectedWallId: null, selectedLightId: null, selectedSwitchId: null, selectedEffectId: null, selectedTemplateId: null });
                  this.draggedWater = { zone, handle: 'center', startX: world.x, startY: world.y, origX: zone.x, origY: zone.y };
                  return;
                }
              }
            }
          }

          if (state.activeTool === 'select' && this.freehand.select(world)) { this.activeTemplate = null; return; }
          // 4. Clicked background -> clear selections & initiate Stage Pan (Move Tool)
          this.activeTemplate = null;
          store.update({ selectedTokenId: null, selectedWallId: null, selectedLightId: null, selectedSwitchId: null, selectedWaterId: null, selectedEffectId: null, selectedTemplateId: null, targetTokenId: null });
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

      if (this.freehand.move(world)) return;
      if (this.fogBrush.move(world)) return;
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

        this.tokenDragContext.distance += Math.hypot(nextX - this.draggedToken.x, nextY - this.draggedToken.y);
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

      if (this.draggedSwitch) {
        this.draggedSwitch.sw.x = Math.round(world.x - this.draggedSwitch.dx); this.draggedSwitch.sw.y = Math.round(world.y - this.draggedSwitch.dy);
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
      if (this.waterFreePoints?.length) {
        const last = this.waterFreePoints.at(-1);
        if (Math.hypot(world.x - last.x, world.y - last.y) >= 6 / this.zoom && this.waterFreePoints.length < 4000) this.waterFreePoints.push({ x: Math.round(world.x), y: Math.round(world.y) });
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
      if (this.freehand.finish()) return;
      if (this.fogBrush.finish()) return;
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
        const token = this.draggedTokenFacing;
        if (this.preDragSnapshot) {
          undoManager.pushSnapshot(this.preDragSnapshot, 'Rotar Operativo');
        }
        this.cancelTokenDrag();
        store.updateToken(token.id, { facingAngle: token.facingAngle });
        if (store.sessionRole !== 'player') network.broadcast({ type: 'TOKEN_UPDATE', tokenId: token.id, partial: { facingAngle: token.facingAngle } });
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
          // Frightened (v2.55.0): not closer to the source of the fear.
          const afraid = !isBlocked && approachBlock({ ...this.draggedToken, x: this.draggedTokenOrigX, y: this.draggedTokenOrigY }, finalX, finalY, state.tokens);
          if (afraid) { isBlocked = true; blockedReason = afraid; notify(afraid, 'error'); }
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
        const tokenId = this.draggedToken.id;
        const moved = finalX !== this.draggedTokenOrigX || finalY !== this.draggedTokenOrigY;
        const distance = this.tokenDragContext.distance + Math.hypot(finalX - this.draggedToken.x, finalY - this.draggedToken.y);
        this.cancelTokenDrag();
        const accepted = store.updateToken(tokenId, { x: finalX, y: finalY }) !== false;
        // The Keeper's own Player view: a move is the player's active action (a connected
        // player's move gets it from the table when the patch arrives).
        if (accepted && !isBlocked && (moved || distance > 0)) this.showMoveDistance(tokenId, map.id, distance);
        if (accepted && moved && store.sessionRole !== 'player' && store.state.userRole === 'player') grantActorSpotlight(store, tokenId);
        if (accepted && store.sessionRole !== 'player') network.broadcast({ type: 'TOKEN_MOVE', tokenId, x: finalX, y: finalY });
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

      if (this.draggedSwitch) {
        const { sw } = this.draggedSwitch; this.draggedSwitch = null;
        const before = (store.getActiveMap().switches || []).find(x => x.id === sw.id);
        if (before && (before.x !== sw.x || before.y !== sw.y)) store.updateSwitch(sw.id, { x: sw.x, y: sw.y });
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

      if (this.waterFreePoints?.length && e.button === 0) {
        const points = simplifyPath(this.waterFreePoints, 3 / this.zoom).slice(0, 512);
        this.waterFreePoints = null;
        if (points.length >= 3 && this.canDrawWater()) {
          try {
            if (this.preDragSnapshot) { store._skipNextUndoSnapshot = true; undoManager.pushSnapshot(this.preDragSnapshot, 'Dibujar zona'); }
            store.addWaterZone({ shape: 'polygon', points, depth: 2 });
          } catch (error) { notify(error.message, 'error'); }
        }
        this.waterDraftChanged();
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

    // 0a. SWITCHES: the Keeper switches them with a double click.
    if (isKeeper) { const sw = this.switchAt(map, world, true); if (sw) { this.useSwitch(sw); return; } }
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
          if (store.sessionRole === 'player') { network.sendToHost?.({ type: 'MAP_INTERACT', kind: 'door', id: wall.id }); audio.playClockTick(); return; }
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
    const map = store.getActiveMap();
    if (params.mapId && params.mapId !== map?.id) return false;
    if (store.state.userRole !== 'keeper') {
      if (params.targetId) {
        const target = store.state.tokens.find(t => t.id === params.targetId);
        if (!target || target.hidden || !this.isTokenVisibleToPlayers(target, store.getTokensForActiveMap(), map)) return false;
      } else if (!params.target || !this.isTokenVisibleToPlayers({ ...params.target, size: 1 }, store.getTokensForActiveMap(), map)) return false;
    }
    if (store.state.userRole !== 'keeper' && params.attackerId) {
      const attacker = store.state.tokens.find(t => t.id === params.attackerId);
      if (!attacker || attacker.hidden || !this.isTokenVisibleToPlayers(attacker, store.getTokensForActiveMap(), map)) params = { ...params, attacker: { ...params.target } };
    }
    return this.fx.combat.add(params);
  }

  startLoop() {
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = (now) => {
      this.render(now);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  render(now) {
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.activeHoveredCondition = null;
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
      ctx.font = `18px ${canvasFont('display')}`;
      ctx.textAlign = 'center';
      ctx.fillText('INITIALIZING QUANTUM TACTICAL MAP...', this.displayWidth / 2, this.displayHeight / 2);
      return;
    }

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // 1. LAYER: MAP / TERRAIN (Optimizada con recorte de viewport / Frustum Culling)
    if (state.layerVisibility.map !== false) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const mapW = this.mapImage.naturalWidth || this.mapImage.width;
      const mapH = this.mapImage.naturalHeight || this.mapImage.height;
      if (mapW > 0 && mapH > 0) {
        // Frustum culling: renderiza exclusivamente la región visible en pantalla
        const vp = this.getViewportBounds(4);
        const sx = Math.max(0, Math.floor(vp.minX));
        const sy = Math.max(0, Math.floor(vp.minY));
        const sRight = Math.min(mapW, Math.ceil(vp.maxX));
        const sBottom = Math.min(mapH, Math.ceil(vp.maxY));
        const sw = sRight - sx;
        const sh = sBottom - sy;
        if (sw > 0 && sh > 0) {
          if (sx === 0 && sy === 0 && sw === mapW && sh === mapH) {
            ctx.drawImage(this.mapImage, 0, 0);
          } else {
            ctx.drawImage(this.mapImage, sx, sy, sw, sh, sx, sy, sw, sh);
          }
        }
      }
    }

    // 2. LAYER: WATER & HAZARDS
    if (state.layerVisibility.water !== false) {
      this.renderWaterZones(ctx, map.waterZones || [], now * 0.001, !!(map.showRain ?? state.showRain), map.rainIntensity ?? state.rainIntensity);
    }

    // Grid Overlay
    if (state.showGrid && map.gridSize) {
      this.renderGrid(ctx, map);
    }

    // Annotations sit under lighting/fog; drawing cannot reveal unexplored map areas.
    this.freehand.render(ctx);

    // 3. LAYER: WALLS & LIGHTING & FOG OF WAR
    const isKeeperGM = state.userRole === 'keeper' && state.gmVision;
    const activeTokens = this.visionTokens();
    // Where each token is drawn now (dragged, or sliding to its new place): its light and its
    // vision go with it, so the lit area never runs ahead of the token.
    const shownTokens = new Map(this.displayTokens().map(t => [t.id, t]));
    const drawnAt = tok => {
      const drawn = shownTokens.get(tok.id);
      return drawn && (drawn.x !== tok.x || drawn.y !== tok.y) ? { ...tok, x: drawn.x, y: drawn.y } : tok;
    };
    // A player's vision only slides toward a place the table has confirmed (never toward a move
    // still waiting for the Keeper, which could be refused).
    const proposed = new Map(store.state.tokens.map(t => [t.id, t]));
    const seenAt = tok => {
      const p = proposed.get(tok.id);
      return p && (p.x !== tok.x || p.y !== tok.y) ? tok : drawnAt(tok);
    };

    // A. Lighting (Foundry-like): the scene's darkness (0 day … 1 night, animated when the Keeper
    // changes it) covers the map, and every light cuts it with its lit area. Everyone sees it;
    // the Keeper's GM vision sees it softened so the map stays readable.
    // Who sees on this screen: the party (a player's tokens follow confirmed places; while the
    // player drags, the vision stays at the start of the drag).
    // A token's own light (a flashlight, often a cone) shows on a player's screen only for the
    // party and the tokens that player controls. Enemies' and NPCs' cones are the Keeper's only
    // (v2.27.9: not while out of sight; v2.29.2: never, user decision).
    const lightShown = t => state.userRole !== 'player' || sharesSight(t);
    let viewers = [];
    if (state.userRole === 'player') {
      // Only the party's eyes: an enemy the player selects (to attack it) never sees for them.
      viewers = activeTokens.filter(partyEyes);
      if (viewers.length === 0) {
        const claimed = activeTokens.find(t => (t.id === state.claimedTokenId || t.id === state.selectedTokenId) && sharesSight(t));
        if (claimed) viewers = [claimed];
      }
      // Vision follows the token as it slides; while the player drags, it stays at the origin
      // so the player cannot scan ahead into undiscovered areas.
      viewers = viewers.map(v => this.draggedToken?.id === v.id ? (this.draggedTokenOrigX != null ? { ...v, x: this.draggedTokenOrigX, y: this.draggedTokenOrigY } : v) : seenAt(v));
    } else {
      // Keeper: the party's eyes explore the map (that memory is sent to the players). Every other
      // token's sight is shown on the Keeper's screen only and never explores (v2.63.0, user: «los
      // tokens no jugadores no emiten foco de visión para los jugadores; sí lo puede ver el Keeper
      // en su visión»). Up to v2.62 it took selecting the NPC on a scene without the party.
      const others = activeTokens.filter(t => !partyEyes(t) && !isEncounterMarker(t)).map(t => ({ ...t, hidden: false, preview: true }));
      viewers = [...activeTokens.filter(partyEyes), ...others].map(drawnAt);
    }

    const darkness = this.sceneDarkness(map, now, state.fogOfWar !== false);
    // With fog of war, what the characters see is lit for this screen: their sight clears the
    // scene's darkness, as before, even without a light of their own.
    const sightLights = state.fogOfWar !== false ? viewers.filter(v => !v.hidden).map(v => ({ x: v.x, y: v.y, radius: v.visionRange || (v.hasLight ? v.lightRadius : 360), facingAngle: v.facingAngle ?? 0, visionAngle: v.visionAngle ?? 90 })) : [];
    if (state.layerVisibility.walls_lights !== false) {
      // A token's own light goes where the token is drawn: while it is dragged into place and
      // while it slides to a new place. (Vision and fog keep the confirmed position.)
      const lightingTokens = activeTokens.filter(lightShown).map(drawnAt);
      this.lighting.renderLighting({
        ctx,
        mapWidth: this.mapImage.width,
        mapHeight: this.mapImage.height,
        // With fog of war the fog alone shades the map (as up to v2.23): visited areas keep their
        // explored veil and no scene darkness is laid on top of them. The scene's darkness (Clima
        // or the scene's ambient light) is drawn only without fog; with fog, night limits what each
        // character sees instead.
        ambientLight: state.fogOfWar !== false ? 1 : 1 - darkness * (isKeeperGM ? 0.55 : 1),
        ambientColor: map.ambientColor ?? '#0a1220',
        walls: map.walls || [],
        lights: (map.lights || []).filter(l => !l.off),
        tokens: lightingTokens,
        sights: sightLights,
        time: now * 0.001
      });
      // Lava lights itself through the darkness.
      if (state.layerVisibility.water !== false && state.fogOfWar === false) for (const zone of (map.waterZones || [])) if (zone.kind === 'lava') drawLavaGlow(ctx, zone, now * 0.001, darkness * (isKeeperGM ? 0.55 : 1));
    }

    // B. Fog of War Pass (Unvisited 100% dark, Explored out-of-vision 50% shroud, Current FOV 0%)
    if (state.fogOfWar !== false && state.layerVisibility.walls_lights !== false) {
      const fullMapId = `${state.campaignId}:${map.id}`;
      // The table's exploration reaches every screen: loaded the first time, then merged each time
      // the Keeper saves more of it; a reset or a reveal (its own mark) applies to all.
      this.fogApplied ??= new Map();
      const applied = this.fogApplied.get(fullMapId), resetMark = map.fogResetAt || 0;
      const fogData = explorationKey(map.fogExplored);
      if (!this.fog.isExplorationLoaded(fullMapId) && map.fogExplored) {
        this.fog.loadExploration(fullMapId, this.mapImage.width, this.mapImage.height, map.fogExplored);
        this.fogApplied.set(fullMapId, { data: fogData, reset: resetMark });
      } else if (!applied || applied.data !== fogData || applied.reset !== resetMark) {
        // A new mark (reset, reveal, or the Keeper's fog brush darkening explored areas, v2.63.0)
        // replaces this screen's memory with the table's; otherwise the table's is added to it.
        if (applied && applied.reset !== resetMark) this.fog.loadExploration(fullMapId, this.mapImage.width, this.mapImage.height, map.fogExplored || 'none');
        else if (map.fogExplored) this.fog.mergeExploration(fullMapId, this.mapImage.width, this.mapImage.height, map.fogExplored);
        this.fogApplied.set(fullMapId, { data: fogData, reset: resetMark });
      }

      this.fog.renderFogOfWar({
        ctx,
        mapWidth: this.mapImage.width,
        mapHeight: this.mapImage.height,
        mapId: fullMapId,
        walls: map.walls || [],
        // Every light that shows something at night: the map's and the tokens' own (where the
        // table has them; a player's dragged token keeps its light at the start of the drag).
        lights: [...(map.lights || []).filter(l => !l.off).map(l => ({ ...l, fixture: true })), ...activeTokens.filter(t => t.hasLight && t.lightRadius > 0 && !t.hidden && lightShown(t)).map(t => {
          const at = this.draggedToken?.id === t.id && state.userRole === 'player' && this.draggedTokenOrigX != null ? { ...t, x: this.draggedTokenOrigX, y: this.draggedTokenOrigY } : state.userRole === 'player' ? seenAt(t) : drawnAt(t);
          return { x: at.x, y: at.y, radius: t.lightRadius, facingAngle: t.facingAngle, visionAngle: t.visionAngle ?? 90 };
        })],
        darkness,
        // Day (whole line of sight) only when the Keeper set the scene's time in Clima.
        daylight: Number.isFinite(map.darkness) && darkness < DAYLIGHT_BELOW,
        viewers,
        lightingEngine: this.lighting,
        exploredOpacity: state.fogExploredOpacity ?? 0.50,
        isKeeperGM: isKeeperGM,
        stamp: !this.draggedToken
      });

      // Authoritative Keeper exploration persistence debounced sync
      // Only when the exploration memory has changed since it was last saved.
      if (state.userRole === 'keeper' && !this.draggedToken && !this.fogBrush.stroke && !this._fogSyncTimer && this._fogSavedVersion !== `${fullMapId}:${this.fog.exploredVersion}`) {
        this._fogSavedVersion = `${fullMapId}:${this.fog.exploredVersion}`;
        this._fogSyncTimer = setTimeout(() => {
          this._fogSyncTimer = null;
          if (this.fog && this.mapImage && map) {
            const serialized = this.fog.serializeExploration(fullMapId, this.mapImage.width, this.mapImage.height);
            if (serialized && JSON.stringify(serialized) !== JSON.stringify(map.fogExplored)) {
              store.updateMap(map.id, { fogExplored: serialized });
              import('./networkManager.js').then(({ network }) => {
                network.broadcast?.({ type: 'FOG_SYNC', mapId: map.id, fogExplored: serialized });
              }).catch(() => {});
            }
          }
        }, 1500);
      }
    }

    // Sensory Vision Acoustic Pass (Tremorsense: reveals ground creatures through darkness)
    // Only whoever has it sees it (v2.59.0, user decision): the Keeper, every sensor; a player, the
    // vibration of their own character (store.canEditToken).
    const sensoryTokens = activeTokens.filter(t => (t.visionMode === 'sensory' || t.hasVibrationVision) && store.canEditToken(t.id));
    if (sensoryTokens.length > 0) {
      this.renderSensoryVision(ctx, sensoryTokens, activeTokens, now * 0.001, map.gridSize || 64);
    }

    // Render Walls and Doors (Keeper sees controllers/limitators; Players see clean bulkheads/doors)
    const isEditorMode = (state.userRole === 'keeper' && state.gmVision) || (state.userRole === 'keeper' && state.activeLayer === 'walls_lights');
    this.renderWalls(ctx, map.walls || [], isEditorMode);
    if (isEditorMode) {
      this.renderLightMarkers(ctx, map.lights || []);
    }
    this.renderSwitches(ctx, map, state.userRole === 'keeper');

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

    // Render In-Progress freehand zone
    if (this.canDrawWater() && this.waterFreePoints?.length > 1) {
      const lava = state.waterKind === 'lava';
      ctx.save();
      ctx.beginPath(); ctx.moveTo(this.waterFreePoints[0].x, this.waterFreePoints[0].y);
      for (const p of this.waterFreePoints) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fillStyle = lava ? 'rgba(220, 60, 12, 0.4)' : 'rgba(2, 132, 199, 0.4)'; ctx.fill();
      ctx.strokeStyle = lava ? '#fb923c' : '#38bdf8'; ctx.lineWidth = 2 / this.zoom; ctx.setLineDash([6 / this.zoom, 6 / this.zoom]); ctx.stroke();
      ctx.restore();
    }
    // Render In-Progress Water Zone
    if (this.canDrawWater() && this.waterStart && this.waterCurrent) {
      const x = Math.min(this.waterStart.x, this.waterCurrent.x);
      const y = Math.min(this.waterStart.y, this.waterCurrent.y);
      const w = Math.abs(this.waterCurrent.x - this.waterStart.x);
      const h = Math.abs(this.waterCurrent.y - this.waterStart.y);

      ctx.save();
      ctx.fillStyle = state.waterKind === 'lava' ? 'rgba(220, 60, 12, 0.45)' : 'rgba(2, 132, 199, 0.45)';
      ctx.strokeStyle = state.waterKind === 'lava' ? '#fb923c' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // 4. LAYER: TOKENS & OPERATIVES
    const viewer = monochromeViewer(state, activeTokens, store.sessionRole, store.memberId || store.peerId);
    const vision = viewer ? (this.monochromeLayers ||= new MonochromeLayers()) : null;
    vision?.begin(ctx);
    if (state.layerVisibility.tokens !== false) {
      this.renderTokens(ctx, map, now * 0.001, vision, viewer);
    }

    // 5. LAYER: OVERLAY & FX
    const overlay = vision?.grey() || ctx;
    if (state.layerVisibility.overlay !== false) {
      this.renderParticlesAndPings(overlay, dt, map.effects || []);
      this.renderEffectMarkers(overlay, map.effects || []);
      this.renderAttackTargeting(overlay, map, now * 0.001);
      for (const tmpl of this.templates) {
        this.renderTemplate(overlay, tmpl, tmpl === this.activeTemplate);
      }
      this.renderCardAreas(overlay, map);
      if (this.rulerStart && this.rulerCurrent) {
        this.renderRuler(overlay, this.rulerStart, this.rulerCurrent, map.gridSize || 64);
      }
      if (this.gridCalibStart && this.gridCalibCurrent) {
        this.renderGridCalibrationGuide(overlay, this.gridCalibStart, this.gridCalibCurrent);
      }
      this.renderRainOverlay(overlay, map, now * 0.001);
      this.renderFogOverlay(overlay, map, now * 0.001);
    }

    this.renderMovementPreview(overlay, map);
    this.fogBrush.render(overlay);
    vision?.flush();
    ctx.restore();

    if (!this.draggedToken) this.renderMoveDistance(ctx, map, activeTokens);

    // Floating tactical condition / state tooltip
    if (this.activeHoveredCondition) {
      this.renderHoveredConditionTooltip(ctx, this.activeHoveredCondition);
    }
  }

  renderHoveredConditionTooltip(ctx, info) {
    if (!info || !info.condition) return;
    const c = info.condition;
    const sx = info.screenX;
    const sy = info.screenY;
    ctx.save();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const title = `${c.isState ? '💀' : '⚡'} ${c.label} (${c.name})`;
    const rule = c.rule || '';

    // Measure and wrap rule text
    ctx.font = `bold 12px ${canvasFont('hud')}`;
    const titleW = ctx.measureText(title).width;
    ctx.font = '11px sans-serif';

    const maxWidth = 260;
    const words = rule.split(' ');
    const lines = [];
    let currentLine = '';
    for (const w of words) {
      const testLine = currentLine ? currentLine + ' ' + w : w;
      if (ctx.measureText(testLine).width > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = w;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const boxW = Math.max(titleW, maxWidth) + 24;
    const lineH = 15;
    const boxH = 26 + lines.length * lineH + 10;
    let boxX = sx + 14;
    let boxY = sy - boxH / 2;
    if (boxX + boxW > this.displayWidth - 10) boxX = sx - boxW - 14;
    if (boxY < 10) boxY = 10;
    if (boxY + boxH > this.displayHeight - 10) boxY = this.displayHeight - boxH - 10;

    // Tactical Glass panel
    ctx.fillStyle = 'rgba(10, 17, 30, 0.95)';
    ctx.strokeStyle = c.isState ? '#fbbf24' : '#00f3ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = c.isState ? 'rgba(251, 191, 36, 0.4)' : 'rgba(0, 243, 255, 0.4)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    // Title
    ctx.fillStyle = c.isState ? '#fde68a' : '#38bdf8';
    ctx.font = `bold 12px ${canvasFont('hud')}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, boxX + 12, boxY + 8);

    // Rule lines
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    lines.forEach((line, idx) => {
      ctx.fillText(line, boxX + 12, boxY + 26 + idx * lineH);
    });

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
      if (rain && w.kind !== 'lava') drawRainRipples(ctx, w, time, { viewport, quality: this.fx.quality, intensity,
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

          ctx.font = `bold 10px ${canvasFont('hud')}`;
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

    const vp = this.getViewportBounds(size);
    const startX = Math.max(offX, Math.floor((Math.max(0, vp.minX) - offX) / size) * size + offX);
    const endX = Math.min(w, Math.ceil((Math.min(w, vp.maxX) - offX) / size) * size + offX);
    const startY = Math.max(offY, Math.floor((Math.max(0, vp.minY) - offY) / size) * size + offY);
    const endY = Math.min(h, Math.ceil((Math.min(h, vp.maxY) - offY) / size) * size + offY);

    const lineTop = Math.max(0, Math.floor(vp.minY));
    const lineBottom = Math.min(h, Math.ceil(vp.maxY));
    const lineLeft = Math.max(0, Math.floor(vp.minX));
    const lineRight = Math.min(w, Math.ceil(vp.maxX));

    for (let x = startX; x <= endX; x += size) {
      ctx.moveTo(x, lineTop);
      ctx.lineTo(x, lineBottom);
    }
    for (let y = startY; y <= endY; y += size) {
      ctx.moveTo(lineLeft, y);
      ctx.lineTo(lineRight, y);
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
    if (store.sessionRole === 'player') allTokens = this.visionTokens();
    // 1. Friendly player tokens are always visible to players
    if (partyEyes(targetTok)) return true;

    // 2. If Keeper has GM Vision active, all tokens are visible to Keeper
    if (state.userRole === 'keeper' && state.gmVision) return true;

    // 3. Find viewing tokens: all friendly player characters
    // Enemies do not share their sight: only the party's eyes count (a player who selects an
    // enemy does not see what it sees; the Keeper's preview of a selected NPC stays on his screen).
    let viewers = allTokens.filter(partyEyes);
    if (viewers.length === 0) {
      const sel = allTokens.find(t => (t.id === state.selectedTokenId || t.id === state.claimedTokenId) && (state.userRole !== 'player' || sharesSight(t)));
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
      const vRange = withRanges(viewer, map).visionRange;

      // Beyond max perception range -> cannot see
      if (dist > vRange) continue;

      // Vision angle (FOV) test (standard 90° for Veilfarers)
      const vAngle = viewer.visionAngle ?? 90;
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
        // A window lets the party make out who is behind it from a side clear enough (v2.29.2).
        if (wallType === 'window' && seeThrough(wall, vx, vy) >= SEE_TOKENS_FROM) continue;
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

    // 5. A light lets the party see an enemy beyond their own vision range, but only one that a
    // character is looking at with nothing in between (v2.27.8): a lit room behind a wall, or
    // behind their back, shows the room, never who is in it.
    const blocked = (ax, ay, bx, by) => (map.walls || []).some(wall => {
      const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
      if ((wallType === 'window' && seeThrough(wall, ax, ay) >= SEE_TOKENS_FROM) || (wallType === 'door' && wall.isOpen)) return false;
      return this.checkLineIntersection(ax, ay, bx, by, wall.x1, wall.y1, wall.x2, wall.y2);
    });
    const facing = (v, x, y) => {
      const vAngle = v.visionAngle ?? 90;
      if (vAngle >= 360) return true;
      let diff = Math.atan2(y - v.y, x - v.x) - (v.facingAngle ?? 0);
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      return Math.abs(diff) <= (vAngle * Math.PI) / 360;
    };
    const watched = viewers.some(v => !v.hidden && facing(v, targetTok.x, targetTok.y) && !blocked(v.x, v.y, targetTok.x, targetTok.y));
    if (!watched) return false;
    const fullMapId = `${state.campaignId}:${map.id}`;
    for (const light of (map.lights || [])) {
      if (light.enabled === false || light.off) continue; // a light that is off shows nobody
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
    if (store.sessionRole === 'player') allTokens = this.visionTokens();
    let viewers = allTokens.filter(partyEyes);
    for (const viewer of viewers) {
      if (viewer.hidden) continue;
      const vx = viewer.x;
      const vy = viewer.y;
      const dist = Math.hypot(x - vx, y - vy);
      const vRange = withRanges(viewer, map).visionRange;
      if (dist > vRange) continue;

      const vAngle = viewer.visionAngle ?? 90;
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
        if (wallType === 'window' && seeThrough(wall, vx, vy) >= SEE_TOKENS_FROM) continue;
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
        // A window is drawn as a thin glass pane below (v2.29.2), not as a thick dashed line.
        ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
        ctx.lineWidth = 0;
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

      // Windows: a thin glass pane (two fine lines with the glass between, tinted by how opaque it
      // is) and small frame caps at its ends. The tint is the average of its two sides.
      if (isWindow) {
        const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, nx = -(w.y2 - w.y1) / len, ny = (w.x2 - w.x1) / len, half = 2.2;
        const { a, b } = windowSides(w), opacity = 1 - (a + b) / 200;
        ctx.save();
        ctx.setLineDash([]);
        ctx.shadowColor = '#7dd3fc'; ctx.shadowBlur = isSelected ? 10 : 3;
        ctx.beginPath();
        ctx.moveTo(w.x1 + nx * half, w.y1 + ny * half); ctx.lineTo(w.x2 + nx * half, w.y2 + ny * half);
        ctx.lineTo(w.x2 - nx * half, w.y2 - ny * half); ctx.lineTo(w.x1 - nx * half, w.y1 - ny * half); ctx.closePath();
        ctx.fillStyle = `rgba(125, 211, 252, ${0.12 + opacity * 0.55})`; ctx.fill();
        ctx.lineWidth = isSelected ? 1.4 : 1; ctx.strokeStyle = isSelected ? '#e0f7ff' : 'rgba(186, 230, 253, 0.85)';
        for (const side of [1, -1]) { ctx.beginPath(); ctx.moveTo(w.x1 + nx * half * side, w.y1 + ny * half * side); ctx.lineTo(w.x2 + nx * half * side, w.y2 + ny * half * side); ctx.stroke(); }
        ctx.shadowBlur = 0; ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(224, 242, 254, 0.95)';
        for (const [px, py] of [[w.x1, w.y1], [w.x2, w.y2]]) { ctx.beginPath(); ctx.moveTo(px + nx * 4.5, py + ny * 4.5); ctx.lineTo(px - nx * 4.5, py - ny * 4.5); ctx.stroke(); }
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
        // The Keeper reads each side's transparency on that side of the pane (A and B), small and
        // only when it matters: in the wall editor or with the window selected. Players see glass.
        if (isKeeper && (isEditor || isSelected)) {
          const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, nx = -(w.y2 - w.y1) / len, ny = (w.x2 - w.x1) / len;
          const { a, b } = windowSides(w);
          ctx.save();
          ctx.font = `600 10px ${canvasFont('hud')}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (const [label, value, side] of [['A', a, 1], ['B', b, -1]]) {
            const tx = midX + nx * 13 * side, ty = midY + ny * 13 * side, text = `${label} ${value}%`, wdt = ctx.measureText(text).width + 10;
            ctx.fillStyle = 'rgba(8, 20, 36, 0.85)'; ctx.beginPath(); ctx.roundRect(tx - wdt / 2, ty - 8, wdt, 16, 4); ctx.fill();
            ctx.fillStyle = value === 0 ? '#fca5a5' : value === 100 ? '#e0f7ff' : '#bae6fd'; ctx.fillText(text, tx, ty + 0.5);
          }
          ctx.restore();
        }
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
  // The switch under a point: the Keeper finds every one; a player only the visible ones they
  // have discovered.
  switchAt(map, world, keeper) {
    const fullMapId = `${store.state.campaignId}:${map.id}`;
    return (map.switches || []).find(sw => Math.hypot(world.x - sw.x, world.y - sw.y) <= 18
      && (keeper || (!sw.secret && (store.state.fogOfWar === false || this.fog.isPointExplored(sw.x, sw.y, fullMapId))))) || null;
  }
  // Pressing a switch: a locked one only tells so; a connected player asks the table.
  useSwitch(sw) {
    const keeper = store.state.userRole === 'keeper' && store.sessionRole !== 'player';
    if (!keeper && !sw.usable) {
      audio.playError();
      store.addCombatLog({ type: 'SYSTEM', title: '🔒 INTERRUPTOR BLOQUEADO', details: `${sw.label || 'El interruptor'} no responde. Solo el Keeper puede accionarlo.` });
      return;
    }
    audio.playClockTick();
    if (store.sessionRole === 'player') { network.sendToHost?.({ type: 'MAP_INTERACT', kind: 'switch', id: sw.id }); return; }
    const before = store.tableActing; store.tableActing = true;
    try {
      const result = store.toggleSwitch(sw.id);
      if (result) store.addCombatLog({ type: 'SYSTEM', title: result.on ? '💡 LUCES ENCENDIDAS' : '🌑 LUCES APAGADAS', details: `${sw.label || 'Interruptor'}: ${result.count} luz${result.count === 1 ? '' : 'es'}.` });
    } finally { store.tableActing = before; }
  }
  renderSwitches(ctx, map, keeper) {
    const state = store.getState(), list = map.switches || [];
    if (!list.length) return;
    const fullMapId = `${state.campaignId}:${map.id}`;
    ctx.save();
    for (const raw of list) {
      const sw = this.draggedSwitch?.sw?.id === raw.id ? this.draggedSwitch.sw : raw;
      if (!keeper && (sw.secret || (state.fogOfWar !== false && !this.fog.isPointExplored(sw.x, sw.y, fullMapId)))) continue;
      const selected = keeper && state.selectedSwitchId === sw.id;
      // The lights it controls, while selected.
      if (selected) {
        ctx.save(); ctx.strokeStyle = 'rgba(253, 230, 138, 0.6)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5 / this.zoom;
        for (const l of (map.lights || []).filter(l => (sw.lightIds || []).includes(l.id))) { ctx.beginPath(); ctx.moveTo(sw.x, sw.y); ctx.lineTo(l.x, l.y); ctx.stroke(); }
        ctx.restore();
      }
      ctx.save(); ctx.translate(sw.x, sw.y);
      if (sw.secret) ctx.globalAlpha = 0.6;
      ctx.fillStyle = 'rgba(13, 4, 32, 0.9)'; ctx.strokeStyle = sw.on ? '#fde68a' : '#64748b'; ctx.lineWidth = selected ? 3 : 1.8;
      if (sw.secret) ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.roundRect(-10, -14, 20, 28, 5); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      // The lever: up and glowing when on, down and grey when off.
      ctx.fillStyle = sw.on ? '#fde68a' : '#475569'; if (sw.on) { ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.roundRect(-5, sw.on ? -10 : 1, 10, 9, 2); ctx.fill(); ctx.shadowBlur = 0;
      if (!sw.usable) { ctx.fillStyle = '#f87171'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', 12, -12); }
      if (keeper) { ctx.fillStyle = '#e2e8f0'; ctx.font = `bold 10px ${canvasFont('hud')}`; ctx.textAlign = 'center'; ctx.fillText(`${sw.label || 'Interruptor'}${sw.secret ? ' · SECRETO' : ''}`, 0, 26); }
      ctx.restore();
    }
    ctx.restore();
  }

  renderLightMarkers(ctx, lights) {
    const state = store.getState();

    ctx.save();
    for (const l of lights) {
      const isSelected = l.id === state.selectedLightId;

      ctx.save();
      // Lightbulb Center Marker (grey and dashed when the light is off)
      if (l.off) ctx.globalAlpha = 0.45;
      ctx.fillStyle = l.off ? '#475569' : (l.color || '#00f3ff');
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
      ctx.font = `bold 10px ${canvasFont('hud')}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${l.label || 'Light'}${l.off ? ' · OFF' : ''}`, l.x, l.y - 14);

      ctx.restore();
    }
    ctx.restore();
  }

  // --- Tokens Rendering ---
  renderTokens(scene, map, time, vision = null, viewer = null) {
    const tokens = this.displayTokens();
    const state = store.getState();
    const gridSize = map.gridSize || 64;
    const isKeeperGM = state.userRole === 'keeper' && state.gmVision;
    // The Keeper's view always shows every token, also in the fog (v2.29.3, user decision); the ones
    // the party does not see are dimmed and marked. Only the player's view hides them.
    const keeperSees = state.userRole === 'keeper';

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
      } else if (!keeperSees) {
        // Token is out of real-time vision.
        // If players previously spotted this enemy in explored territory, show frozen last known position
        const lastPos = this.lastKnownEnemyPositions.get(tok.id);
        if (lastPos && lastPos.mapId === map.id) {
          if (this.isPointInPlayerVision(lastPos.x, lastPos.y, tokens, map)) {
            // Player is looking right at the spot and sees it is now empty: remove ghost
            this.lastKnownEnemyPositions.delete(tok.id);
          } else if (this.fog.isPointExplored(lastPos.x, lastPos.y, fullMapId)) {
            // Draw frozen last known position in the fog shroud
            this.renderGhostToken(vision?.grey() || scene, lastPos, gridSize, time);
          }
        }
        continue;
      }

      // Check if token is in any water zone
      const waterZone = (map.waterZones || []).find(w => pointInWater(tok.x, tok.y, w));

      const ctx = !vision ? scene : keepsTokenColor(tok, viewer, store.memberId || store.peerId) ? vision.color() : vision.grey();
      ctx.save();
      ctx.translate(tok.x, tok.y);

      // Dimmed transparency for tokens in the dark seen by Keeper
      if (!isVisibleToPlayers && keeperSees) {
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

      // Avatar & Defeated / Dead Token representation (HP <= 0)
      const layers = mapPortraitLayers(tok);
      const bossPending = tok.boss ? !tok.boss.defeated && (tok.boss.index < tok.boss.states.length - 1 || tok.boss.states[tok.boss.index].defeat === 'objective') : tok.bossStatus?.pending;
      const isDead = tok.boss?.defeated || tok.bossStatus?.defeated || (!isEncounterMarker(tok) && typeof tok.hp?.current === 'number' && tok.hp.current <= 0 && !bossPending);

      // A frame (v2.60.0): the portrait fills its hole; the frame is drawn after the rim.
      const frame = frameById(tok.frame), frameFit = frame && frameGeometry(frame, radius);
      const portraitR = frameFit ? Math.min(radius, frameFit.hole + 1) : radius;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, portraitR, 0, Math.PI * 2);
      ctx.clip();

      if (isDead) {
        ctx.fillStyle = '#0a0f1d';
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

        const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        radGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
        radGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

        ctx.fillStyle = '#f87171';
        ctx.font = `bold ${Math.round(radius * 1.15)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠️', 0, 0);
      } else {
        const img = this.getTokenImage(layers.portrait);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -portraitR, -portraitR, portraitR * 2, portraitR * 2);
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
          ctx.fillStyle = '#00f3ff';
          ctx.font = `bold ${Math.round(radius * 0.7)}px ${canvasFont('display')}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const isKeeper = state.userRole === 'keeper';
          const isMaskedLetter = !isKeeper && this.isHorrorToken(tok);
          ctx.fillText(isMaskedLetter ? '?' : (tok.name ? tok.name.charAt(0) : '?'), 0, 0);
        }
      }

      // Spotlight Top Specular Highlight on Token Avatar
      if ((tok.hasSpotlight || tok.spotlight?.enabled) && !isDead) {
        const specGrad = ctx.createLinearGradient(0, -radius, 0, radius * 0.35);
        specGrad.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
        specGrad.addColorStop(0.6, 'rgba(251, 191, 36, 0.08)');
        specGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = specGrad;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      }

      ctx.restore();

      // Rim Border / Brilliant Golden Border with Brief Light Pulse (Spotlight / Foco)
      const hasSpotlight = (tok.hasSpotlight || tok.spotlight?.enabled) && !tok.hidden && !isDead;
      if (hasSpotlight) {
        ctx.save();
        const goldPrimary = tok.spotlight?.color || '#fbbf24';
        const goldBright = '#fef08a';

        // Periodic brief pulse of light: 2.2s period, 0.75s active pulse wave
        const pulsePeriod = 2.2;
        const pulseDuration = 0.75;
        const phase = (time || 0) % pulsePeriod;
        const isPulsing = phase < pulseDuration;

        if (isPulsing) {
          const t = phase / pulseDuration; // 0.0 -> 1.0
          // Pulse expansion: compact (~10-14px outward) so it doesn't take much canvas space
          const maxExpand = Math.min(14, Math.max(8, radius * 0.28));
          const currentExpand = radius + t * maxExpand;
          const pulseAlpha = Math.sin(t * Math.PI) * 0.85;

          // 1. Expanding brief wave of golden light
          ctx.save();
          ctx.strokeStyle = `rgba(251, 191, 36, ${pulseAlpha})`;
          ctx.lineWidth = Math.max(1.5, 3 * (1 - t * 0.6));
          ctx.shadowColor = goldPrimary;
          ctx.shadowBlur = 12 * (1 - t * 0.4);
          ctx.beginPath();
          ctx.arc(0, 0, currentExpand, 0, Math.PI * 2);
          ctx.stroke();

          // 2. Second softer harmonic micro-wave
          if (t < 0.6) {
            const t2 = t / 0.6;
            const currentExpand2 = radius + t2 * (maxExpand * 0.55);
            const alpha2 = (1 - t2) * 0.55;
            ctx.strokeStyle = `rgba(254, 240, 138, ${alpha2})`;
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(0, 0, currentExpand2, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Luminous Golden Rim
        const flashIntensity = isPulsing && phase < 0.35 ? (1 - phase / 0.35) * 8 : 0;
        ctx.strokeStyle = goldPrimary;
        ctx.lineWidth = isSelected ? 4.5 : 3.5;
        ctx.shadowColor = goldPrimary;
        ctx.shadowBlur = 10 + flashIntensity;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner metallic highlight ring
        ctx.strokeStyle = goldBright;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = goldBright;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      } else {
        ctx.save();
        // The colour chosen in the sheet wins; the path and kind only give the default (v2.29.2:
        // a Sleeping character used to be orange whatever colour was chosen).
        let rimColor = tok.color || (tok.path === 'Sleeping' ? '#ffaa00' : '#00f3ff');
        if (isDead) rimColor = '#ef4444';
        else if (!tok.isPlayer) rimColor = tok.color || (tok.actorType === 'drone' ? '#72dfce' : '#ef4444');
        if (tok.hidden) rimColor = '#a855f7';

        // With a frame, the frame is the rim; a hidden or fallen token still shows its colour.
        if (!frameFit || tok.hidden || isDead) {
          ctx.strokeStyle = rimColor;
          ctx.lineWidth = isSelected ? 4 : (isDead ? 3 : 2.5);
          ctx.beginPath();
          ctx.arc(0, 0, frameFit ? frameFit.half * frame.outer : radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (frameFit) this.drawTokenFrame(ctx, frame, frameFit);

      // The class insignia, unless the token's layout hides it (v2.59.0).
      if (tokenLayout(tok).insignia) this.drawClassBanner(ctx, layers.flag, radius);

      // Dead / Defeated Badge above token
      if (isDead) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-24, -radius - 22, 48, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold 9px ${canvasFont('hud')}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠️ DEAD', 0, -radius - 15);
        ctx.restore();
      }

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
        ctx.font = `bold 9px ${canvasFont('hud')}`;
        ctx.textAlign = 'center';
        ctx.fillText('HIDDEN', 0, -radius - 12);
        ctx.restore();
      }

      // Darkness / Hidden in Fog indicator for Keeper
      if (!isVisibleToPlayers && keeperSees) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-48, -radius - (tok.hidden ? 38 : 22), 96, 14, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `bold 8px ${canvasFont('hud')}`;
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
        ctx.font = `bold 9px ${canvasFont('hud')}`;
        ctx.textAlign = 'center';
        ctx.fillText(`🌊 DEPTH ${depth}`, 0, -radius - (tok.hidden ? 26 : 12));
        ctx.restore();
      }

      // Vitals & Nameplate
      this.renderTokenVitals(ctx, tok, radius);
      drawTokenConditions(ctx, tok, radius, this.zoom);
      drawEffectClocks(ctx, tok, radius, this.zoom);
      if (this.cursorWorld) {
        const hoveredCond = getHoveredCondition(tok, this.cursorWorld, radius, this.zoom);
        if (hoveredCond) {
          const sPos = this.worldToScreen(this.cursorWorld.x, this.cursorWorld.y);
          this.activeHoveredCondition = { condition: hoveredCond, screenX: sPos.x, screenY: sPos.y };
        }
      }
      const bossStatus = tok.boss ? { index: tok.boss.index, total: tok.boss.states.length } : tok.bossStatus;
      if (bossStatus) {
        ctx.save(); ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
        const phaseText = `FASE ${bossStatus.index + 1}/${bossStatus.total}${tok.hp.current === 0 && bossPending ? ' · TRANSICIÓN' : ''}`;
        const width = ctx.measureText(phaseText).width + 12;
        ctx.fillStyle = '#201525'; ctx.fillRect(-width / 2, -radius - 36, width, 17);
        ctx.fillStyle = '#efb9d8'; ctx.fillText(phaseText, 0, -radius - 24); ctx.restore();
      }


      // Directional Vision & Smaller Directional Arrow Handle on Selected Token. A player sees it
      // only on the party's tokens and their own: enemies' and NPCs' cones are the Keeper's (v2.29.2).
      if (isSelected && (state.userRole !== 'player' || sharesSight(tok))) {
        ctx.save();
        const fAngle = tok.facingAngle ?? 0;
        const vAngle = tok.visionAngle ?? 90;
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
  // The frame: its body over the portrait's edge, then its light with «screen» (black adds nothing).
  drawTokenFrame(ctx, frame, { half }) {
    const body = this.getTokenImage(frameBody(frame)), light = this.getTokenImage(frameLight(frame));
    ctx.save();
    if (body?.complete && body.naturalWidth) ctx.drawImage(body, -half, -half, half * 2, half * 2);
    if (light?.complete && light.naturalWidth) { ctx.globalCompositeOperation = 'screen'; ctx.drawImage(light, -half, -half, half * 2, half * 2); }
    ctx.restore();
  }

  drawClassBanner(ctx, url, radius) {
    const flag = url && this.getTokenImage(url);
    if (!flag?.complete || !flag.naturalWidth || !flag.naturalHeight) return;
    // Twice its first size (v2.27.17: at 35 % of the token it could hardly be seen). It hangs
    // over the bottom-right edge of the ring so it does not cover the portrait.
    const height = 2 * radius * 0.7;
    const width = height * flag.naturalWidth / flag.naturalHeight;
    ctx.drawImage(flag, radius - width * 0.6, radius - height, width, height);
  }

  renderGhostToken(ctx, ghost, gridSize, time, caption = 'ÚLTIMA POS.') {
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
    const layers = mapPortraitLayers({ ...ghost, avatarUrl: ghost.avatar });
    const img = this.getTokenImage(layers.portrait);
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

    this.drawClassBanner(ctx, layers.flag, radius);

    // Badge
    ctx.globalAlpha = 0.85;
    ctx.font = `bold 9px ${canvasFont('hud')}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f59e0b';
    if (caption) ctx.fillText(caption, 0, radius + 12);

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
    if (state.userRole !== 'keeper' && !target.isPlayer && !this.isTokenVisibleToPlayers(target, tokens, map)) {
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
    // Same scale and bands as the attack and the ruler.
    const metersPerSquare = map.gridScaleMeters || DEFAULT_METERS_PER_SQUARE;
    // Base to base, like the attack: the gap between the edges of the two tokens.
    const gapSquares = tokenGapSquares(attacker, target, gridSize);
    const distSquares = gapSquares.toFixed(1);
    const distMeters = (gapSquares * metersPerSquare).toFixed(1);
    const lockBand = gapBandFor(gapSquares, metersPerSquare).toUpperCase();

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

    // 1. Draw Discrete Targeting Vector Line
    const beamColor = losBlocked ? 'rgba(239, 68, 68, 0.55)' : 'rgba(0, 243, 255, 0.45)';
    ctx.strokeStyle = beamColor;
    ctx.lineWidth = 1.2 / this.zoom;
    ctx.shadowBlur = 0;
    if (losBlocked) {
      ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
    } else {
      ctx.lineDashOffset = -(time * 24) % 16;
      ctx.setLineDash([8 / this.zoom, 4 / this.zoom]);
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // 2. Discrete Corner Brackets around Target Token (Non-intrusive)
    const targetRadius = ((target.size || 1) * gridSize) / 2;
    const bracketDist = targetRadius + 4 / this.zoom;
    const bracketLen = 6 / this.zoom;

    ctx.save();
    ctx.translate(x2, y2);
    ctx.strokeStyle = losBlocked ? 'rgba(239, 68, 68, 0.7)' : 'rgba(0, 243, 255, 0.65)';
    ctx.lineWidth = 1 / this.zoom;
    ctx.setLineDash([]);

    // 4 subtle corner brackets
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(bracketDist - bracketLen, -bracketDist);
      ctx.lineTo(bracketDist, -bracketDist);
      ctx.lineTo(bracketDist, -bracketDist + bracketLen);
      ctx.stroke();
      ctx.rotate(Math.PI / 2);
    }
    ctx.restore();

    // 3. Compact & Discrete Tactical Distance Pill at Midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const distText = losBlocked ? `⚠️ BLOQUEADO · ${lockBand} · ${distMeters}m (${distSquares}c)` : `⚡ ${lockBand} · ${distMeters}m (${distSquares}c)`;
    ctx.font = `${Math.max(8.5, Math.round(9.5 / this.zoom))}px ${canvasFont('hud')}`;
    const textW = ctx.measureText(distText).width;
    const pillW = textW + 12 / this.zoom;
    const pillH = 15 / this.zoom;

    ctx.fillStyle = 'rgba(7, 16, 29, 0.72)';
    ctx.strokeStyle = losBlocked ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 243, 255, 0.35)';
    ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();
    ctx.roundRect(midX - pillW / 2, midY - pillH / 2, pillW, pillH, 3 / this.zoom);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = losBlocked ? '#fca5a5' : '#a5f4ff';
    ctx.fillText(distText, midX, midY);

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

          ctx.font = `bold 9px ${canvasFont('hud')}`;
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

  // Who sees a token's HP and Stress on the map (v2.58.0, user decision): the Keeper, everyone's;
  // a player, only their own character (and the drone they operate), never allies or enemies.
  // store.canEditToken is exactly that: the Keeper's table edits every token; a player, the
  // character it plays (claimed) and what it controls.
  canSeeVitals(tok) { return store.canEditToken(tok.id); }

  // What the token shows and where (v2.59.0, the user's design: tokenLayout.js): its name (yes/no)
  // and, for whoever may see them, each stat as a bar below or above it, a ring (inner, outer 1,
  // outer 2) or, for Armor and Resolve, small tokens beside it. A clock put on the token by hand
  // (not the old «HACK» sample) is still drawn.
  renderTokenVitals(ctx, tok, radius) {
    if (isEncounterMarker(tok)) return;
    ctx.save();
    const layout = tokenLayout(tok), scale = Math.max(1, Math.min(1.8, 0.9 / this.zoom));
    // Around the frame, if it has one (v2.60.0): outside its edge and inside its hole.
    const frame = frameById(tok.frame), fit = frame && frameGeometry(frame, radius);
    const outR = fit ? fit.half * frame.outer : radius, inR = fit ? Math.min(radius, fit.hole + 1) : radius;
    const nameWidth = Math.max(radius * 2, 70);
    let below = outR + 4;
    // A player may hide every name on their screen with V; the Keeper always sees them (v2.59.0).
    const namesOff = namesHidden() && store.getState().userRole !== 'keeper';
    if (layout.name && !namesOff) {
      ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
      ctx.strokeStyle = tok.color ? tok.color : 'rgba(0, 243, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-nameWidth / 2, outR + 4, nameWidth, 16, 3);
      ctx.fill();
      ctx.stroke();
      const isKeeper = store.getState().userRole === 'keeper';
      const isMasked = !isKeeper && this.isHorrorToken(tok);
      const rawName = isMasked ? '?????' : tok.name;
      const displayName = (isKeeper && this.isHorrorToken(tok))
        ? (tok.name.length > 10 ? tok.name.substring(0, 9) + '.. [?]' : `${tok.name} [?]`)
        : (rawName.length > 14 ? rawName.substring(0, 12) + '..' : rawName);
      ctx.fillStyle = isMasked ? '#f43f5e' : (tok.color || '#e2e8f0');
      ctx.font = `bold 11px ${canvasFont('hud')}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayName, 0, outR + 12);
      below = outR + 22;
    }
    if (!this.canSeeVitals(tok)) { ctx.restore(); return; }

    const placed = place => LAYOUT_STATS.map(([key]) => key).filter(key => layout[key] === place).map(key => [key, statFor(tok, key)]).filter(([, stat]) => stat);
    // Bars below (under the name) and above the token.
    drawStatBars(ctx, { y: below + 2, width: nameWidth, scale, rows: placed('bottom') });
    drawStatBars(ctx, { y: -outR - 6, width: nameWidth, scale, rows: placed('top'), up: true });
    // Rings: the inner one inside the rim, the outer ones around it.
    for (const ring of ['inner1', 'outer1', 'outer2']) for (const [key, stat] of placed(ring)) drawStatRing(ctx, { r: ringRadius(ring, ring === 'inner1' ? inR : outR, scale), width: 3 * scale, key, stat });
    // Small tokens beside it; past the outer rings when there are any.
    const ringsOut = placed('outer2').length ? 9.5 * scale : placed('outer1').length ? 5.5 * scale : 0;
    for (const side of ['right', 'left']) for (const [key, stat] of placed(side)) drawStatPips(ctx, { side, radius: outR, scale, key, stat, offset: ringsOut });

    // A clock the Keeper put on the token by hand (not the sample one).
    const cfg = tok.displayConfig || {};
    const sample = o => o?.type === 'circular' && o.statKey === 'clock' && /^hack$/i.test(o.label || '') && (o.id === 'ov_clock' || o.current === 2);
    const overlays = Array.isArray(tok.displayOverlays) ? tok.displayOverlays.filter(o => !sample(o)) : [];
    const clocks = overlays.length ? overlays.filter(o => o.type === 'circular') : cfg.showClock && !/^hack$/i.test(cfg.clockLabel || '') ? [{ label: cfg.clockLabel, current: cfg.clockProgress, max: cfg.clockSegments, color: '#00f3ff' }] : [];
    clocks.slice(0, 2).forEach((item, idx) => {
      const cur = item.current ?? (cfg.clockProgress ?? 0), max = item.max ?? (item.segments || cfg.clockSegments || 4);
      const color = item.color || '#00f3ff', r = 11;
      ctx.save();
      ctx.translate(idx === 0 ? radius * 0.75 : -radius * 0.75, -radius * 0.75);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10, 15, 26, 0.95)'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
      const seg = (Math.PI * 2) / Math.max(1, max);
      for (let i = 0; i < max; i++) {
        const a = -Math.PI / 2 + i * seg;
        if (i < cur) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r - 1.5, a, a + seg); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
      if (item.label) { ctx.fillStyle = color; ctx.font = `bold 7px ${canvasFont('hud')}`; ctx.textAlign = 'center'; ctx.fillText(item.label, 0, r + 7); }
      ctx.restore();
    });
    ctx.restore();
  }

  // --- Dynamic Area Templates with Rotate, Scale & Delete Handles ---
  // The area of a Power around its caster (v2.32.0), drawn like the Area tool's circle while its
  // resolution is open: everyone sees it, because the resolution is in the shared log.
  renderCardAreas(ctx, map) {
    // A card being aimed (v2.36.0): its reach around the caster and a ring on each valid target.
    const aim = typeof window !== 'undefined' ? window.veilCardAim : null;
    if (aim) {
      const caster = store.state.tokens.find(t => t.id === aim.casterId), grid = map.gridSize || 64, pulse = 0.55 + 0.45 * Math.sin(Date.now() / 260);
      if (caster && aim.radius && (aim.area || aim.reach !== 'Far')) {
        if (aim.area) this.renderTemplate(ctx, { id: 'aim', type: 'circle', x: caster.x, y: caster.y, radius: aim.radius, angle: 0 }, true);
        else { ctx.save(); ctx.setLineDash([12, 8]); ctx.strokeStyle = 'rgba(167,139,250,.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(caster.x, caster.y, aim.radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      }
      for (const id of aim.validIds || []) {
        const t = store.state.tokens.find(x => x.id === id && x.mapId === map.id);
        if (!t) continue;
        const r = ((t.size || 1) * grid) / 2 + 6;
        ctx.save(); ctx.strokeStyle = aim.area ? `rgba(248,113,113,${pulse})` : `rgba(52,211,153,${pulse})`; ctx.lineWidth = 4; ctx.shadowColor = aim.area ? '#f87171' : '#34d399'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        // The marked target (v2.42.0): a second, steady ring in the card's colour.
        if (id === aim.markedId) {
          ctx.save(); ctx.strokeStyle = aim.color || '#00f3ff'; ctx.lineWidth = 5; ctx.shadowColor = aim.color || '#00f3ff'; ctx.shadowBlur = 22; ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(t.x, t.y, r + 9, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }
    }
    const logs = store.state.logs || [];
    for (let i = 0; i < Math.min(logs.length, 40); i++) {
      const record = logs[i]?.resolution, area = record?.area;
      if (!area || record.phase === 'done' || record.mapId !== map.id || (logs[i].visibility === 'keeper' && store.sessionRole === 'player')) continue;
      this.renderTemplate(ctx, { id: 'area_' + record.id, type: 'circle', x: area.x, y: area.y, radius: area.radius, angle: 0 }, false);
      ctx.save();
      ctx.font = '600 13px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#e0fbff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText(`${record.name} · ${area.reach}`, area.x, area.y - area.radius - 8);
      ctx.restore();
    }
  }

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
      ctx.font = `bold 11px ${canvasFont('display')}`;
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
  renderRuler(ctx, start, end, gridSize, movement = false) {
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

    const scaleKilometers = map.gridScaleKm || (map.gridScaleMeters ? map.gridScaleMeters * 2.5 : 5.0);
    if (isStarship) {
      // Starship Combat Scale (Naval Combat Chapter 17)
      const scaleKm = scaleKilometers;
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
      // Melee (adjacent or up to 1 m), Very Close (up to 5 m), Close (up to 10 m), Far (up to 25 m), Extreme
      const scaleMeters = map.gridScaleMeters || 2.0;
      distVal = ((distPx / gridSize) * scaleMeters).toFixed(1);
      distUnit = 'm';

      rangeBand = rangeBandFor(distPx / gridSize, scaleMeters);
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
    const badgeText = movement ? `${rangeBand.toUpperCase()} · ${(distUnit === 'km' ? distPx / gridSize * scaleKilometers * 1000 : Number(distVal)).toLocaleString(undefined, { maximumFractionDigits: 1 })} m` : `${distVal}${distUnit} (${distGrid} sq) // [${rangeBand.toUpperCase()}]`;

    ctx.font = `bold 12px ${canvasFont('display')}`;
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

          ctx.font = `bold 9px ${canvasFont('display')}`;
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

          ctx.font = `bold 9px ${canvasFont('display')}`;
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
          ctx.font = `bold 9px ${canvasFont('display')}`;
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
    const viewport = this.getViewportBounds(160);
    this.fx.updateAndRender(ctx, dt, mapEffects, viewport);
  }
}
