import { drawSoftened, visionFill, fingerprint, wallValues } from './softMask.js';
import { isWindowWall, seeThrough, windowShadow } from './windows.js';
// src/fogEngine.js
// Advanced Fog of War & Exploration Shroud Engine for Veilfarers VTT
// Supports Unvisited Total Darkness (100%), Explored Shroud (80%-95%), and Real-time LOS FOV

// Width, in map pixels, of the gradient that replaces every hard cut of the fog.
export const FOG_SOFTNESS = 12;
const MASK_CELL = 4; // map pixels per cell of the exploration mask
// Below this scene darkness it is day: tokens see everything in their line of sight.
export const DAYLIGHT_BELOW = 0.5;
const tracePolygon = (c, poly) => { c.beginPath(); c.moveTo(poly[0].x, poly[0].y); for (let i = 1; i < poly.length; i++) c.lineTo(poly[i].x, poly[i].y); c.closePath(); };

// The exploration saved for the table (and sent to the players) is a grid of cells. Up to v2.62 they
// were always 32 px and were drawn as squares: next to the smooth edge of what a screen had seen
// live they made stairs, a second-looking fog (user report, v2.63.0). Now the cell follows the map
// (about 40 000 cells: 8 px on a 1376×768 map, 16 px on a 4K plate) and the grid is drawn one pixel
// per cell and enlarged with smoothing, so its edges are soft like the rest of the fog.
export const explorationCell = (width, height) => Math.max(8, Math.ceil(Math.sqrt((width * height) / 40000)));
// A short key of a saved exploration, to tell whether a screen already applied it.
export const explorationKey = f => (typeof f === 'object' && f ? `${f.cols}x${f.rows}:${f.bits}` : f);
const decodeBits = bits => {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(bits, 'base64'));
  const binary = globalThis.atob(bits), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
function drawCells(ctx, fogExplored) {
  const cell = fogExplored.cellSize || 32, cols = fogExplored.cols, rows = fogExplored.rows;
  const bytes = decodeBits(fogExplored.bits);
  const on = index => (index >> 3) < bytes.length && (bytes[index >> 3] & (1 << (index & 7)));
  try {
    const small = document.createElement('canvas'); small.width = cols; small.height = rows;
    const sctx = small.getContext('2d'), image = sctx.createImageData(cols, rows);
    if (image?.data?.length === cols * rows * 4) {
      for (let i = 0; i < cols * rows; i++) if (on(i)) image.data.fill(255, i * 4, i * 4 + 4);
      sctx.putImageData(image, 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(small, 0, 0, cols * cell, rows * cell);
      ctx.restore();
      return;
    }
  } catch { /* no real canvas here: squares below */ }
  ctx.fillStyle = '#ffffff';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (on(r * cols + c)) ctx.fillRect(c * cell, r * cell, cell, cell);
}

export class FogOfWarEngine {
  constructor() {
    this.fogCanvas = document.createElement('canvas');
    this.fogCtx = this.fogCanvas.getContext('2d', { willReadFrequently: true });

    // Persistent exploration maps: mapId -> HTMLCanvasElement (white = visited)
    this.exploredCanvases = new Map();
    // What the Keeper's NPCs and enemies have seen (v2.64.1): shown on the Keeper's screen with the
    // explored veil, never saved for the table nor sent to the players.
    this.keeperCanvases = new Map();

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
  // A clean canvas of the map's size for one viewer's view behind windows.
  scratchContext(width, height) {
    if (!this.scratch) this.scratch = document.createElement('canvas');
    if (this.scratch.width !== width || this.scratch.height !== height) { this.scratch.width = width; this.scratch.height = height; }
    const ctx = this.scratch.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, width, height);
    return ctx;
  }
  resetExploration(mapId) {
    for (const canvas of [this.exploredCanvases.get(mapId), this.keeperCanvases.get(mapId)]) {
      if (!canvas) continue;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.exploredVersion++;
  }

  // The Keeper's own memory of what the NPCs saw, the size of the map.
  keeperCanvas(mapId, width, height) {
    let canvas = this.keeperCanvases.get(mapId);
    if (!canvas) { canvas = document.createElement('canvas'); this.keeperCanvases.set(mapId, canvas); }
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    return canvas;
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
  serializeExploration(mapId, mapWidth, mapHeight, cellSize = explorationCell(mapWidth, mapHeight)) {
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
    drawCells(ctx, fogExplored);
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

      drawCells(ctx, fogExplored);
    }
  }

  // The Keeper's fog brush (v2.63.0, user request: «permite al Keeper dibujar niebla de guerra en
  // zonas descubiertas para volver a oscurecerlas»): a circle of the memory is forgotten (or, with
  // `reveal`, explored).
  brushExploration(mapId, mapWidth, mapHeight, x, y, radius, reveal = false) {
    const memories = [this.getExploredCanvas(mapId, mapWidth, mapHeight)];
    if (!reveal && this.keeperCanvases.has(mapId)) memories.push(this.keeperCanvases.get(mapId)); // darkening forgets both
    for (const canvas of memories) {
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = reveal ? 'source-over' : 'destination-out';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    this.exploredVersion++;
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
    if (this.isPointExplored(midX, midY, mapId)) return true;
    // A door sits on the edge of what was seen (the sight stops at its wall): look a little to
    // each side of it too (v2.63.0), so a door seen from one side is shown.
    const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1, side = 10;
    const nx = -(wall.y2 - wall.y1) / length * side, ny = (wall.x2 - wall.x1) / length * side;
    return this.isPointExplored(midX + nx, midY + ny, mapId) || this.isPointExplored(midX - nx, midY - ny, mapId);
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
    night = false,
    keeperMemory = false
  }) {
    this.resize(mapWidth, mapHeight);
    const fCtx = this.fogCtx;
    const exploredCanvas = this.getExploredCanvas(mapId, mapWidth, mapHeight);
    const expCtx = exploredCanvas.getContext('2d');
    // Two ranges, as Foundry VTT's detection modes (v2.64.0, user decision): nothing is seen beyond
    // a viewer's vision range. By day, or with no time set in Clima, it sees everything up to that
    // range. At night (Clima at 50 % or more) it makes out the dark only up to its dark range, and
    // lit areas up to its vision range. Up to v2.63 a lit area was seen at any distance (Foundry's
    // default «Light Perception»): with large lights a cone reached the end of the map.

    // Nothing the fog depends on has changed since the last frame: draw the same fog again.
    const key = fingerprint([mapId, mapWidth, mapHeight, exploredOpacity, isKeeperGM, stamp, night ? 1 : 0, keeperMemory ? 1 : 0,
      ...viewers.flatMap(v => [v.x, v.y, v.hidden, v.preview ? 1 : 0, v.visionRange || 0, v.darkRange ?? -1, v.hasLight, v.lightRadius || 0, v.facingAngle ?? 0, v.visionAngle ?? 90]),
      -1, ...(lights || []).flatMap(l => [l.x, l.y, l.radius || 200, l.facingAngle ?? -9, l.visionAngle ?? 360, l.intensity ?? 0.8, l.fixture ? 1 : 0]),
      -2, ...wallValues(walls)]);
    if (key === this.fogKey && this.fogKeyVersion === this.exploredVersion) {
      ctx.save();
      if (isKeeperGM) ctx.globalAlpha = 0.32;
      drawSoftened(ctx, this.fogCanvas, FOG_SOFTNESS, this.fogVersion);
      ctx.restore();
      return this.lastVision;
    }

    // 1. What each viewer sees: its line of sight (walls, facing) up to its vision range, in the
    // dark up to its dark range at night, and lit areas. Only what is seen is remembered as
    // explored: a light the party has no line of sight to reveals nothing.
    const sightRange = Math.hypot(mapWidth, mapHeight);
    const lit = !night ? [] : (lights || []).map(light => ({
      poly: lightingEngine.computeVisibilityPolygon(light.x, light.y, light.radius || 200, walls, light.facingAngle ?? null, light.visionAngle ?? 360),
      x: light.x, y: light.y, radius: light.radius || 200
    })).filter(l => l.poly && l.poly.length >= 3);
    const currentVisionPolygons = [], visionShapes = [];
    for (const viewer of viewers) {
      if (viewer.hidden) continue;
      const own = viewer.visionRange || (viewer.hasLight ? viewer.lightRadius : 360);
      const dark = night ? Math.max(0, Math.min(own, viewer.darkRange ?? own)) : own;
      const facingAngle = viewer.facingAngle ?? 0;
      const visionAngle = viewer.visionAngle ?? 90;
      const los = lightingEngine.computeVisibilityPolygon(viewer.x, viewer.y, Math.max(own, 1), walls, facingAngle, visionAngle);
      if (!los || los.length < 3) continue;
      currentVisionPolygons.push(los);
      // Windows half-see-through from this viewer's side dim what lies behind them (v2.29.2).
      const shadows = [];
      for (const w of walls) {
        if (!isWindowWall(w)) continue;
        const t = seeThrough(w, viewer.x, viewer.y);
        if (t <= 0 || t >= 100) continue; // 0: a wall (the sight polygon stops there); 100: clear
        const quad = windowShadow(w, viewer.x, viewer.y, sightRange * 2);
        if (quad) shadows.push({ quad, keep: t / 100 });
      }
      visionShapes.push({ los, x: viewer.x, y: viewer.y, own, dark, shadows, preview: !!viewer.preview });
    }
    // The seen area, painted with `paint` (fog: cut out; memory: white).
    // A `preview` viewer (on the Keeper's screen, a token that is not the party's) shows what it sees
    // there and is never remembered as explored: that memory goes to the players.
    const paintSeen = (final, paint, shapes = visionShapes) => {
      for (const { los, x, y, own, dark, shadows } of shapes) {
        // Behind a half-see-through window the view is drawn apart and thinned to the window's
        // transparency, then laid on the fog (or the memory) like any other view.
        const target = shadows.length ? this.scratchContext(mapWidth, mapHeight) : final;
        target.save();
        tracePolygon(target, los); target.clip();
        // What it makes out without light: by day its vision range, fading with distance into the
        // explored veil; at night its short dark range, which only fades at its edge.
        if (dark > 0) {
          target.fillStyle = paint === 'cut' ? visionFill(target, x, y, dark, !night) : '#ffffff';
          target.beginPath(); target.arc(x, y, dark, 0, Math.PI * 2); target.fill();
        }
        // At night, what the lights show, never beyond the vision range (fading at its end too).
        if (lit.length) {
          target.beginPath(); target.arc(x, y, own, 0, Math.PI * 2); target.clip();
          for (const l of lit) { tracePolygon(target, l.poly); target.fillStyle = paint === 'cut' ? visionFill(target, x, y, own, true) : '#ffffff'; target.fill(); }
        }
        target.restore();
        if (target === final) continue;
        target.save(); target.globalCompositeOperation = 'destination-out';
        // The live view is thinned to the window's transparency. The memory is all or nothing (it is
        // stamped on every redraw, so a partial stamp would add up to fully explored): what is seen
        // through glass clear enough to make out who is there (50 % or more) is remembered.
        for (const { quad, keep } of shadows) { tracePolygon(target, quad); target.fillStyle = `rgba(0, 0, 0, ${paint === 'cut' ? 1 - keep : keep >= 0.5 ? 0 : 1})`; target.fill(); }
        target.restore();
        final.drawImage(target.canvas, 0, 0);
      }
    };
    // Lights clear the fog only where the party can see (v2.29.4, user decision 21 Nov 2026: «luz
    // solo si se ve»). A lit area is part of each viewer's sight above (`lit`): behind a wall it
    // stays in the fog, and through a window it is seen with the transparency of the viewer's side.
    // Up to v2.29.3 every light that was on cleared its whole area, seen or not (v2.26.1).
    const explorers = visionShapes.filter(shape => !shape.preview);
    if (stamp && explorers.length) {
      this.exploredVersion++;
      paintSeen(expCtx, '#ffffff', explorers);
    }
    // On the Keeper's screen what an NPC has seen stays with the explored veil (v2.64.1, user report:
    // «cuando miro una zona no descubierta y la descubro, luego vuelve a ser opaca 100 %»); it is
    // kept apart, so it never reaches the table's exploration nor the players.
    const previews = visionShapes.filter(shape => shape.preview);
    const keeperMemoryCanvas = keeperMemory ? this.keeperCanvas(mapId, mapWidth, mapHeight) : null;
    if (stamp && keeperMemoryCanvas && previews.length) {
      this.exploredVersion++;
      paintSeen(keeperMemoryCanvas.getContext('2d'), '#ffffff', previews);
    }

    // 2. Prepare fog canvas
    fCtx.clearRect(0, 0, mapWidth, mapHeight);

    // Fill entire fogCanvas with 100% UNEXPLORED DARKNESS (pitch black)
    fCtx.fillStyle = 'rgba(5, 8, 15, 1.0)';
    fCtx.fillRect(0, 0, mapWidth, mapHeight);

    // 3. Cut out explored areas from the 100% darkness
    fCtx.globalCompositeOperation = 'destination-out';
    fCtx.drawImage(exploredCanvas, 0, 0);
    if (keeperMemoryCanvas) fCtx.drawImage(keeperMemoryCanvas, 0, 0);

    // 4. Fill behind the cutouts with the Explored Shroud opacity (default 50% darkness, adjustable)
    // Explored areas outside current FOV and outside lights will have this attenuation
    const shroudAlpha = Math.max(0.05, Math.min(0.95, exploredOpacity ?? 0.50));
    fCtx.globalCompositeOperation = 'destination-over';
    fCtx.fillStyle = `rgba(5, 8, 15, ${shroudAlpha})`;
    fCtx.fillRect(0, 0, mapWidth, mapHeight);

    // 5. Cut out what the viewers see right now (0% fog).
    fCtx.globalCompositeOperation = 'destination-out';
    paintSeen(fCtx, 'cut');

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

