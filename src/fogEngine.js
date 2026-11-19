import { drawSoftened, visionFill, fingerprint, wallValues } from './softMask.js';
import { lightStrength } from './lightingEngine.js';
// src/fogEngine.js
// Advanced Fog of War & Exploration Shroud Engine for Veilfarers VTT
// Supports Unvisited Total Darkness (100%), Explored Shroud (80%-95%), and Real-time LOS FOV

// Width, in map pixels, of the gradient that replaces every hard cut of the fog.
export const FOG_SOFTNESS = 12;
const MASK_CELL = 4; // map pixels per cell of the exploration mask
// Below this scene darkness it is day: tokens see everything in their line of sight.
export const DAYLIGHT_BELOW = 0.5;
const tracePolygon = (c, poly) => { c.beginPath(); c.moveTo(poly[0].x, poly[0].y); for (let i = 1; i < poly.length; i++) c.lineTo(poly[i].x, poly[i].y); c.closePath(); };

export class FogOfWarEngine {
  constructor() {
    this.fogCanvas = document.createElement('canvas');
    this.fogCtx = this.fogCanvas.getContext('2d', { willReadFrequently: true });

    // Persistent exploration maps: mapId -> HTMLCanvasElement (white = visited)
    this.exploredCanvases = new Map();

    // Default explored shroud opacity (88% black transparency)
    this.defaultExploredOpacity = 0.88;

    // Every change to an exploration memory bumps this; masks and caches compare against it.
    this.exploredVersion = 0;
    this.masks = new Map();       // mapId -> low-resolution copy of the memory for point tests
    this.fogKey = null;           // fingerprint of the last fog drawn
    this.fogVersion = 0;          // bumps when the fog canvas is redrawn
    this.lastVision = [];
  }

  // A reduced copy of the exploration memory, read back once per change. Asking whether a
  // point is explored then costs an array lookup instead of a GPU readback per question.
  explorationMask(mapId) {
    const canvas = this.exploredCanvases.get(mapId);
    if (!canvas || typeof document === 'undefined') return null;
    let mask = this.masks.get(mapId);
    if (mask && mask.version === this.exploredVersion && mask.width === canvas.width && mask.height === canvas.height) return mask.data ? mask : null;
    const cell = MASK_CELL, cols = Math.ceil(canvas.width / cell), rows = Math.ceil(canvas.height / cell);
    mask = { version: this.exploredVersion, width: canvas.width, height: canvas.height, cell, cols, rows, data: null };
    this.masks.set(mapId, mask);
    try {
      const small = mask.canvas || document.createElement('canvas');
      small.width = cols; small.height = rows;
      const ctx = small.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, cols, rows);
      ctx.drawImage(canvas, 0, 0, cols * cell, rows * cell, 0, 0, cols, rows);
      const pixels = ctx.getImageData(0, 0, cols, rows).data;
      if (pixels.length !== cols * rows * 4) return null; // no real canvas here: fall back to single reads
      const data = new Uint8Array(cols * rows);
      for (let i = 0; i < data.length; i++) data[i] = Math.max(pixels[i * 4], pixels[i * 4 + 3]);
      mask.data = data;
      return mask;
    } catch { return null; }
  }

  /**
   * Resizes internal fog canvas
   */
  resize(width, height) {
    if (this.fogCanvas.width !== width || this.fogCanvas.height !== height) {
      this.fogCanvas.width = width;
      this.fogCanvas.height = height;
    }
  }

  /**
   * Gets or initializes the persistent explored canvas for a given map
   */
  getExploredCanvas(mapId, width, height) {
    let canvas = this.exploredCanvases.get(mapId);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, width, height);
      this.exploredCanvases.set(mapId, canvas);
    } else if (canvas.width !== width || canvas.height !== height) {
      // Preserve existing exploration when resizing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      tempCtx.drawImage(canvas, 0, 0);

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(tempCanvas, 0, 0);
    }
    return canvas;
  }

  /**
   * Resets exploration for a map (returns all areas to 100% darkness)
   */
  resetExploration(mapId) {
    this.dispelStamped = null;
    const canvas = this.exploredCanvases.get(mapId);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.exploredVersion++;
  }

  /**
   * Reveals the entire map (marks all areas as explored)
   */
  revealAll(mapId, width, height) {
    const canvas = this.getExploredCanvas(mapId, width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    this.exploredVersion++;
  }

  /**
   * Checks if exploration data has been loaded/initialized for this map
   */
  isExplorationLoaded(mapId) {
    return this.exploredCanvases.has(mapId);
  }

  /**
   * Serializes exploration memory into a compact grid bitmask for persistence and network sync
   */
  serializeExploration(mapId, mapWidth, mapHeight, cellSize = 32) {
    const canvas = this.exploredCanvases.get(mapId);
    if (!canvas) return 'none';
    const ctx = canvas.getContext('2d');
    const cols = Math.ceil(mapWidth / cellSize);
    const rows = Math.ceil(mapHeight / cellSize);
    const totalCells = cols * rows;
    const numBytes = Math.ceil(totalCells / 8);
    const bytes = new Uint8Array(numBytes);

    let setBits = 0;
    const mask = this.explorationMask(mapId);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sampleX = Math.min(mapWidth - 1, Math.floor(c * cellSize + cellSize / 2));
        const sampleY = Math.min(mapHeight - 1, Math.floor(r * cellSize + cellSize / 2));
        try {
          // One lookup in the mask instead of one canvas readback per cell.
          const pixel = mask ? [mask.data[Math.floor(sampleY / mask.cell) * mask.cols + Math.floor(sampleX / mask.cell)] || 0, 0, 0, 0] : ctx.getImageData(sampleX, sampleY, 1, 1).data;
          if (pixel[0] > 64 || pixel[3] > 64) {
            const index = r * cols + c;
            const byteIndex = Math.floor(index / 8);
            const bitIndex = index % 8;
            bytes[byteIndex] |= (1 << bitIndex);
            setBits++;
          }
        } catch {
          // ignore sampling error
        }
      }
    }

    if (setBits === 0) return 'none';
    if (setBits === totalCells) return 'all';

    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : globalThis.btoa(binary);
    return { status: 'custom', cols, rows, cellSize, bits: b64 };
  }

  // Adds the table's exploration (the Keeper's saved memory) to this screen's, without erasing
  // what this screen has seen: every player ends up with the same explored map.
  mergeExploration(mapId, mapWidth, mapHeight, fogExplored) {
    if (!fogExplored || fogExplored === 'none') return;
    if (fogExplored === 'all') { this.revealAll(mapId, mapWidth, mapHeight); return; }
    if (!fogExplored.bits || !fogExplored.cols) return;
    const canvas = this.getExploredCanvas(mapId, mapWidth, mapHeight), ctx = canvas.getContext('2d');
    const cell = fogExplored.cellSize || 32, cols = fogExplored.cols, rows = fogExplored.rows;
    let bytes;
    if (typeof Buffer !== 'undefined') bytes = new Uint8Array(Buffer.from(fogExplored.bits, 'base64'));
    else { const binary = globalThis.atob(fogExplored.bits); bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); }
    ctx.fillStyle = '#ffffff';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const index = r * cols + c;
      if (bytes[index >> 3] & (1 << (index & 7))) ctx.fillRect(c * cell, r * cell, cell, cell);
    }
    this.exploredVersion++;
  }

  /**
   * Hydrates exploration canvas from authoritative serialized exploration state
   */
  loadExploration(mapId, mapWidth, mapHeight, fogExplored) {
    if (!fogExplored || fogExplored === 'none') {
      this.resetExploration(mapId);
      return;
    }
    if (fogExplored === 'all') {
      this.revealAll(mapId, mapWidth, mapHeight);
      return;
    }
    if (typeof fogExplored === 'object' && fogExplored.status === 'custom' && fogExplored.bits) {
      this.exploredVersion++;
      const canvas = this.getExploredCanvas(mapId, mapWidth, mapHeight);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, mapWidth, mapHeight);

      const cellSize = fogExplored.cellSize || 32;
      const cols = fogExplored.cols;
      const rows = fogExplored.rows;
      let bytes;
      if (typeof Buffer !== 'undefined') {
        bytes = new Uint8Array(Buffer.from(fogExplored.bits, 'base64'));
      } else {
        const binary = globalThis.atob(fogExplored.bits);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      }

      ctx.fillStyle = '#ffffff';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const index = r * cols + c;
          const byteIndex = Math.floor(index / 8);
          const bitIndex = index % 8;
          if (byteIndex < bytes.length && (bytes[byteIndex] & (1 << bitIndex))) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        }
      }
    }
  }

  /**
   * Stamps a visibility polygon into the persistent exploration memory
   */
  stampExploration(exploredCtx, polygon) {
    if (!polygon || polygon.length < 3) return;
    this.exploredVersion++;
    exploredCtx.save();
    exploredCtx.fillStyle = '#ffffff';
    exploredCtx.beginPath();
    exploredCtx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
      exploredCtx.lineTo(polygon[i].x, polygon[i].y);
    }
    exploredCtx.closePath();
    exploredCtx.fill();
    exploredCtx.restore();
  }

  /**
   * Tests if a world coordinate (x, y) has been visited/explored by players.
   * Unvisited coordinates return false (pitch dark).
   */
  isPointExplored(x, y, mapId) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const canvas = this.exploredCanvases.get(mapId);
    if (!canvas) return false;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= canvas.width || iy >= canvas.height) return false;
    const mask = this.explorationMask(mapId);
    if (mask) return mask.data[Math.floor(iy / mask.cell) * mask.cols + Math.floor(ix / mask.cell)] > 64;
    try {
      const ctx = canvas.getContext('2d');
      const pixel = ctx.getImageData(ix, iy, 1, 1).data;
      return pixel[0] > 64 || pixel[3] > 64;
    } catch {
      return false;
    }
  }

  /**
   * Tests if a wall, window or door has been discovered in an explored zone.
   * If both endpoints and its center are completely in unexplored darkness, returns false.
   */
  isWallExplored(wall, mapId) {
    if (!wall) return false;
    if (this.isPointExplored(wall.x1, wall.y1, mapId)) return true;
    if (this.isPointExplored(wall.x2, wall.y2, mapId)) return true;
    const midX = (wall.x1 + wall.x2) / 2;
    const midY = (wall.y1 + wall.y2) / 2;
    return this.isPointExplored(midX, midY, mapId);
  }

  /**
   * Core Fog of War Renderer:
   * 1. Zone A: Unvisited areas = 100% black (pitch dark)
   * 2. Zone B: Explored areas out of current vision angle / LOS = 80%-95% black transparency (darker, harder to see)
   * 3. Zone C: Current vision angle & LOS = 0% fog (completely clear)
   */
  renderFogOfWar({
    ctx,
    mapWidth,
    mapHeight,
    mapId = 'default_map',
    walls = [],
    lights = [],
    viewers = [],
    lightingEngine,
    exploredOpacity = 0.88,
    isKeeperGM = false,
    stamp = true,
    darkness = 0,
    daylight = false
  }) {
    this.resize(mapWidth, mapHeight);
    const fCtx = this.fogCtx;
    const exploredCanvas = this.getExploredCanvas(mapId, mapWidth, mapHeight);
    const expCtx = exploredCanvas.getContext('2d');
    // Daylight (the scene's darkness under half, Foundry's «global illumination»): a token sees
    // everything in its line of sight. At night it sees its own vision and whatever a light shows.

    // Nothing the fog depends on has changed since the last frame: draw the same fog again.
    const key = fingerprint([mapId, mapWidth, mapHeight, exploredOpacity, isKeeperGM, stamp, daylight ? 1 : 0,
      ...viewers.flatMap(v => [v.x, v.y, v.hidden, v.visionRange || 0, v.hasLight, v.lightRadius || 0, v.facingAngle ?? 0, v.visionAngle ?? 90]),
      -1, ...(lights || []).flatMap(l => [l.x, l.y, l.radius || 200, l.facingAngle ?? -9, l.visionAngle ?? 360, l.intensity ?? 0.8, l.fixture ? 1 : 0]),
      -2, ...wallValues(walls)]);
    if (key === this.fogKey && this.fogKeyVersion === this.exploredVersion) {
      ctx.save();
      if (isKeeperGM) ctx.globalAlpha = 0.32;
      drawSoftened(ctx, this.fogCanvas, FOG_SOFTNESS, this.fogVersion);
      ctx.restore();
      return this.lastVision;
    }

    // 1. What each viewer sees: its line of sight (walls, facing), lit by daylight, by its own
    // vision or by a light. Only what is seen is remembered as explored: a light the party has
    // no line of sight to reveals nothing.
    const sightRange = Math.hypot(mapWidth, mapHeight);
    const lit = daylight ? [] : (lights || []).map(light => ({
      poly: lightingEngine.computeVisibilityPolygon(light.x, light.y, light.radius || 200, walls, light.facingAngle ?? null, light.visionAngle ?? 360),
      x: light.x, y: light.y, radius: light.radius || 200
    })).filter(l => l.poly && l.poly.length >= 3);
    const currentVisionPolygons = [], visionShapes = [];
    for (const viewer of viewers) {
      if (viewer.hidden) continue;
      const own = viewer.visionRange || (viewer.hasLight ? viewer.lightRadius : 360);
      const facingAngle = viewer.facingAngle ?? 0;
      const visionAngle = viewer.visionAngle ?? 90;
      const los = lightingEngine.computeVisibilityPolygon(viewer.x, viewer.y, daylight ? sightRange : Math.max(own, ...lit.map(l => Math.hypot(l.x - viewer.x, l.y - viewer.y) + l.radius), 1), walls, facingAngle, visionAngle);
      if (!los || los.length < 3) continue;
      currentVisionPolygons.push(los);
      visionShapes.push({ los, x: viewer.x, y: viewer.y, own });
    }
    // The seen area, painted with `paint` (fog: cut out; memory: white).
    const paintSeen = (target, paint) => {
      for (const { los, x, y, own } of visionShapes) {
        target.save();
        tracePolygon(target, los); target.clip();
        if (daylight) { target.fillStyle = paint === 'cut' ? 'rgba(0, 0, 0, 1)' : '#ffffff'; target.fillRect(0, 0, mapWidth, mapHeight); }
        else {
          // Own vision fades towards the end of its range; a light shows its whole lit area.
          target.fillStyle = paint === 'cut' ? visionFill(target, x, y, own) : '#ffffff';
          target.beginPath(); target.arc(x, y, own, 0, Math.PI * 2); target.fill();
          for (const l of lit) { tracePolygon(target, l.poly); target.fillStyle = paint === 'cut' ? 'rgba(0, 0, 0, 1)' : '#ffffff'; target.fill(); }
        }
        target.restore();
      }
    };
    // Map lights that are on dissipate the fog of their whole lit area (walls still stop the
    // light), by their intensity: the dimmest shows it in half-light, from intensity 1 it is
    // clear as day. A lit area is seen and remembered; the Keeper turns a light off (or keeps the
    // room dark) to hide it.
    const dispel = (lights || []).filter(l => l.fixture).map(light => {
      const poly = lightingEngine.computeVisibilityPolygon(light.x, light.y, light.radius || 200, walls, light.facingAngle ?? null, light.visionAngle ?? 360);
      return poly && poly.length >= 3 ? { poly, x: light.x, y: light.y, radius: light.radius || 200, strength: lightStrength(light.intensity ?? 0.8) } : null;
    }).filter(Boolean);
    const paintDispel = (target, cut) => {
      for (const d of dispel) {
        tracePolygon(target, d.poly);
        if (cut) {
          const g = target.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.radius);
          g.addColorStop(0, `rgba(0, 0, 0, ${d.strength})`); g.addColorStop(0.8, `rgba(0, 0, 0, ${d.strength})`); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
          target.fillStyle = g;
        } else target.fillStyle = '#ffffff';
        target.fill();
      }
    };
    // A lit area is remembered once (stamping it again every frame would only force the fog to be
    // worked out again each frame).
    const dispelKey = dispel.map(d => `${Math.round(d.x)},${Math.round(d.y)},${Math.round(d.radius)},${d.poly.length}`).join('|') + '#' + mapId;
    if (stamp && dispel.length && dispelKey !== this.dispelStamped) { this.dispelStamped = dispelKey; this.exploredVersion++; paintDispel(expCtx, false); }
    if (stamp && visionShapes.length) {
      this.exploredVersion++;
      paintSeen(expCtx, '#ffffff');
    }

    // 2. Prepare fog canvas
    fCtx.clearRect(0, 0, mapWidth, mapHeight);

    // Fill entire fogCanvas with 100% UNEXPLORED DARKNESS (pitch black)
    fCtx.fillStyle = 'rgba(5, 8, 15, 1.0)';
    fCtx.fillRect(0, 0, mapWidth, mapHeight);

    // 3. Cut out explored areas from the 100% darkness
    fCtx.globalCompositeOperation = 'destination-out';
    fCtx.drawImage(exploredCanvas, 0, 0);

    // 4. Fill behind the cutouts with the Explored Shroud opacity (default 50% darkness, adjustable)
    // Explored areas outside current FOV and outside lights will have this attenuation
    const shroudAlpha = Math.max(0.05, Math.min(0.95, exploredOpacity ?? 0.50));
    fCtx.globalCompositeOperation = 'destination-over';
    fCtx.fillStyle = `rgba(5, 8, 15, ${shroudAlpha})`;
    fCtx.fillRect(0, 0, mapWidth, mapHeight);

    // 5. Cut out what the viewers see right now (0% fog).
    fCtx.globalCompositeOperation = 'destination-out';
    paintSeen(fCtx, 'cut');
    paintDispel(fCtx, true);

    // Reset composite operation to normal
    fCtx.globalCompositeOperation = 'source-over';

    // 6. Draw Fog of War onto tactical canvas
    ctx.save();
    if (isKeeperGM) {
      // Keeper GM Vision: show explored vs unexplored with subtle 30% overlay
      ctx.globalAlpha = 0.32;
      drawSoftened(ctx, this.fogCanvas, FOG_SOFTNESS, ++this.fogVersion);
    } else {
      // Player Perspective: Full strict Fog of War, with feathered edges
      drawSoftened(ctx, this.fogCanvas, FOG_SOFTNESS, ++this.fogVersion);
    }
    ctx.restore();

    // Stamping the same shapes again changes nothing, so this frame can be reused as is.
    this.fogKey = key; this.fogKeyVersion = this.exploredVersion; this.lastVision = currentVisionPolygons;
    return currentVisionPolygons;
  }
}

