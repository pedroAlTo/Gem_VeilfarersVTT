// src/canvasEngine.js
// High-Resolution Tactical Canvas Engine with Water Depths (0-5), Editable Walls & Lights,
// Drag-Resizable Templates, Expanded Particle FX, and Multi-Layer Support
//
// The engine is split into modules (v2.65.0, user request: «para poder trabajar en módulos
// separados»). This file keeps the core: setting up the canvas, loading the map, the viewport and
// the render loop that draws every layer in order. Each other part lives in src/canvas/ and is
// mixed into CanvasEngine.prototype below, so every method is still called as this.method():
//   input.js        sets up tools and listeners keyboard.js   keyboard shortcuts (onKeyDown)
//   pointerDown.js  onMouseDown                 pointerMove.js onMouseMove
//   pointerUp.js    onMouseUp                   dropAndMenu.js onDrop, onContextMenu
//   touch.js        touch gestures
//   tokenMotion.js  dragging and moving tokens  actions.js    double click/tap, pings, switches
//   vision.js       darkness, night, sight      sceneLayers.js water, rain, grid, walls, lights
//   tokens.js       drawing tokens and vitals   templates.js  card areas, templates, ruler
//   overlays.js     targeting, vibration, effect markers, particles
//   helpers.js      shared constants and helpers
// New map code goes into the module it belongs to (or a new one), not back into this file.

import { isEncounterMarker } from './bestiaryProfiles.js';
import { LightingEngine } from './lightingEngine.js';
import { DAYLIGHT_BELOW, FogOfWarEngine, explorationKey } from './fogEngine.js';
import { drawLavaGlow } from './surfaceFX.js';
import { FXEngine } from './fxEngine.js';
import { store } from './state.js';
import { canvasFont } from './fontSets.js';
import { network } from './networkManager.js';
import { MonochromeLayers, monochromeViewer } from './ancestryVision.js';
import { partyEyes, sharesSight } from './canvas/helpers.js';
import { inputMethods } from './canvas/input.js';
import { keyboardMethods } from './canvas/keyboard.js';
import { pointerDownMethods } from './canvas/pointerDown.js';
import { pointerMoveMethods } from './canvas/pointerMove.js';
import { pointerUpMethods } from './canvas/pointerUp.js';
import { dropMenuMethods } from './canvas/dropAndMenu.js';
import { touchMethods } from './canvas/touch.js';
import { tokenMotionMethods } from './canvas/tokenMotion.js';
import { actionMethods } from './canvas/actions.js';
import { visionMethods } from './canvas/vision.js';
import { sceneLayerMethods } from './canvas/sceneLayers.js';
import { tokenMethods } from './canvas/tokens.js';
import { templateMethods } from './canvas/templates.js';
import { overlayMethods } from './canvas/overlays.js';

// Shared with the inspector (water depths).
export { WATER_DEPTH_NAMES, WATER_DEPTH_COLORS } from './canvas/helpers.js';

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

    // One fog (v2.64.4, user decision): the scene's darkness, as it looked with the old «fog of war»
    // switch off, now remembering what the party discovered. Without a time in Clima, a scene keeps
    // its ambient light (the Bridge's 0.25 is 75 % dark), as before.
    const darkness = this.sceneDarkness(map, now, false);
    const fullMapId = `${state.campaignId}:${map.id}`;
    const night = darkness >= DAYLIGHT_BELOW;
    // With fog of war, what the characters see is lit for this screen: their sight clears the
    // scene's darkness, as before, even without a light of their own.
    // In the dark a character makes out its dark range (5 m by default) in front of it; the rest is
    // shown by the lights (v2.64.0 rule).
    const sightLights = viewers.filter(v => !v.hidden && v.darkRange > 0).map(v => ({ x: v.x, y: v.y, radius: v.darkRange, facingAngle: v.facingAngle ?? 0, visionAngle: v.visionAngle ?? 90 }));
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
        ambientLight: 1 - darkness * (isKeeperGM ? 0.55 : 1),
        // What was discovered stays at the explored veil instead of the full darkness.
        explored: { canvas: this.knownArea(fullMapId, state), veil: map.fogExploredOpacity ?? state.fogExploredOpacity ?? 0.5, version: this.fog.exploredVersion },
        // A light shows only where the party sees or has discovered (v2.64.6, user report); the
        // Keeper's GM vision sees them all.
        onlySeen: !isKeeperGM,
        ambientColor: map.ambientColor ?? '#0a1220',
        walls: map.walls || [],
        lights: (map.lights || []).filter(l => !l.off),
        tokens: lightingTokens,
        sights: sightLights,
        time: now * 0.001
      });
      // Lava lights itself through the darkness.
      if (state.layerVisibility.water !== false) for (const zone of (map.waterZones || [])) if (zone.kind === 'lava') drawLavaGlow(ctx, zone, now * 0.001, darkness * (isKeeperGM ? 0.55 : 1));
    }

    // B. Fog of War Pass (Unvisited 100% dark, Explored out-of-vision 50% shroud, Current FOV 0%)
    // B. The memory of what was discovered (no layer of its own since v2.64.4): loaded, merged with
    // the table's and stamped with what the party sees; the darkness above uses it.
    if (state.layerVisibility.walls_lights !== false) {
      // The table's exploration reaches every screen: loaded the first time, then merged each time
      // the Keeper saves more of it; a reset or a reveal (its own mark) applies to all.
      this.fogApplied ??= new Map();
      const applied = this.fogApplied.get(fullMapId), resetMark = map.fogResetAt || 0;
      const fogData = explorationKey(map.fogExplored);
      if (!this.fog.isExplorationLoaded(fullMapId) && map.fogExplored) {
        this.fog.loadExploration(fullMapId, this.mapImage.width, this.mapImage.height, map.fogExplored);
        this.fogApplied.set(fullMapId, { data: fogData, reset: Math.max(resetMark, applied?.reset || 0) });
      } else if (!applied || applied.data !== fogData || resetMark > applied.reset) {
        // A new mark (reset, reveal, or the Keeper's fog brush darkening explored areas, v2.63.0)
        // replaces this screen's memory with the table's; otherwise the table's is added to it.
        // Only a newer mark replaces it (v2.64.2): a map that arrives late, or without the mark, never
        // swaps what this screen has seen for an older copy; it is added to it.
        if (applied && resetMark > applied.reset) this.fog.loadExploration(fullMapId, this.mapImage.width, this.mapImage.height, map.fogExplored || 'none');
        else if (map.fogExplored) this.fog.mergeExploration(fullMapId, this.mapImage.width, this.mapImage.height, map.fogExplored);
        this.fogApplied.set(fullMapId, { data: fogData, reset: Math.max(resetMark, applied?.reset || 0) });
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
        // Night (v2.64.0): in the dark a character makes out only its dark range; lit areas up to its
        // vision range. By day, or with no time set in Clima, up to its vision range.
        night,
        // The Keeper's screen also remembers what the NPCs saw (never sent to the players).
        keeperMemory: state.userRole === 'keeper' && store.sessionRole !== 'player',
        viewers,
        lightingEngine: this.lighting,
        // Each scene can set its own veil (v2.64.0, the Keeper's fog panel); otherwise Ajustes.
        exploredOpacity: map.fogExploredOpacity ?? state.fogExploredOpacity ?? 0.50,
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
              // This screen already holds what it saves: the saved grid is not merged back into it
              // (v2.64.6; merging it again and again hardened the soft edges into steps).
              this.fogApplied ??= new Map();
              const before = this.fogApplied.get(fullMapId);
              this.fogApplied.set(fullMapId, { data: explorationKey(serialized), reset: before?.reset ?? (map.fogResetAt || 0) });
              this.fog.noteMerged(fullMapId, serialized);
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
}

// Every part's methods go on the prototype as the class's own methods would (not enumerable).
// A name defined twice is a mistake: it stops here instead of one part silently replacing another.
function mixin(target, ...parts) {
  for (const part of parts) {
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(part))) {
      if (Object.prototype.hasOwnProperty.call(target.prototype, name)) throw new Error(`CanvasEngine.${name} is defined twice`);
      Object.defineProperty(target.prototype, name, { ...descriptor, enumerable: false });
    }
  }
}
mixin(CanvasEngine, inputMethods, keyboardMethods, pointerDownMethods, pointerMoveMethods, pointerUpMethods, dropMenuMethods, touchMethods, tokenMotionMethods, actionMethods, visionMethods, sceneLayerMethods, tokenMethods, templateMethods, overlayMethods);
