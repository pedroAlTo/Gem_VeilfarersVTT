// src/fogEngine.js
// Advanced Fog of War & Exploration Shroud Engine for Veilfarers VTT
// Supports Unvisited Total Darkness (100%), Explored Shroud (80%-95%), and Real-time LOS FOV

export class FogOfWarEngine {
  constructor() {
    this.fogCanvas = document.createElement('canvas');
    this.fogCtx = this.fogCanvas.getContext('2d');

    // Persistent exploration maps: mapId -> HTMLCanvasElement (white = visited)
    this.exploredCanvases = new Map();

    // Default explored shroud opacity (88% black transparency)
    this.defaultExploredOpacity = 0.88;
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
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      this.exploredCanvases.set(mapId, canvas);
    } else if (canvas.width !== width || canvas.height !== height) {
      // Preserve existing exploration when resizing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(tempCanvas, 0, 0);
    }
    return canvas;
  }

  /**
   * Resets exploration for a map (returns all areas to 100% darkness)
   */
  resetExploration(mapId) {
    const canvas = this.exploredCanvases.get(mapId);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /**
   * Reveals the entire map (marks all areas as explored)
   */
  revealAll(mapId, width, height) {
    const canvas = this.getExploredCanvas(mapId, width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
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
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sampleX = Math.min(mapWidth - 1, Math.floor(c * cellSize + cellSize / 2));
        const sampleY = Math.min(mapHeight - 1, Math.floor(r * cellSize + cellSize / 2));
        try {
          const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
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
    stamp = true
  }) {
    this.resize(mapWidth, mapHeight);
    const fCtx = this.fogCtx;
    const exploredCanvas = this.getExploredCanvas(mapId, mapWidth, mapHeight);
    const expCtx = exploredCanvas.getContext('2d');

    // 1. Calculate active real-time vision polygons for all viewing tokens
    const currentVisionPolygons = [];
    for (const viewer of viewers) {
      if (viewer.hidden) continue;
      const lx = viewer.x;
      const ly = viewer.y;
      const radius = viewer.visionRange || (viewer.hasLight ? viewer.lightRadius : 360);
      const facingAngle = viewer.facingAngle ?? 0;
      const visionAngle = viewer.visionAngle ?? 90;

      const poly = lightingEngine.computeVisibilityPolygon(
        lx,
        ly,
        radius,
        walls,
        facingAngle,
        visionAngle
      );

      if (poly && poly.length >= 3) {
        currentVisionPolygons.push(poly);
        // Stamp this newly discovered field into the persistent exploration memory only when confirmed
        if (stamp) {
          this.stampExploration(expCtx, poly);
        }
      }
    }

    // 1b. Calculate illumination for lights in VISITED areas
    // Lights located in areas already explored by the user show through the shroud
    const visitedLightPolygons = [];
    if (lights && lights.length > 0) {
      for (const light of lights) {
        const lx = Math.round(light.x);
        const ly = Math.round(light.y);
        if (lx < 0 || ly < 0 || lx >= mapWidth || ly >= mapHeight) continue;

        let isVisited = false;
        try {
          const pixel = expCtx.getImageData(lx, ly, 1, 1).data;
          isVisited = (pixel[0] > 64 || pixel[3] > 64);
        } catch {
          isVisited = false;
        }

        if (isVisited) {
          const lRadius = light.radius || 200;
          const lFacing = light.facingAngle ?? null;
          const lAngle = light.visionAngle ?? 360;
          const lPoly = lightingEngine.computeVisibilityPolygon(
            lx,
            ly,
            lRadius,
            walls,
            lFacing,
            lAngle
          );
          if (lPoly && lPoly.length >= 3) {
            visitedLightPolygons.push({ poly: lPoly, intensity: light.intensity ?? 0.8 });
            if (stamp) {
              this.stampExploration(expCtx, lPoly);
            }
          }
        }
      }
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

    // 5. Cut out the CURRENT active vision polygons completely (0% fog in field of view)
    fCtx.globalCompositeOperation = 'destination-out';
    for (const poly of currentVisionPolygons) {
      fCtx.beginPath();
      fCtx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        fCtx.lineTo(poly[i].x, poly[i].y);
      }
      fCtx.closePath();
      fCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';
      fCtx.fill();
    }

    // Also cut out illumination from visited map lights so explored lit zones remain completely clear (no attenuation)
    for (const { poly } of visitedLightPolygons) {
      fCtx.beginPath();
      fCtx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        fCtx.lineTo(poly[i].x, poly[i].y);
      }
      fCtx.closePath();
      fCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';
      fCtx.fill();
    }

    // Reset composite operation to normal
    fCtx.globalCompositeOperation = 'source-over';

    // 6. Draw Fog of War onto tactical canvas
    ctx.save();
    if (isKeeperGM) {
      // Keeper GM Vision: show explored vs unexplored with subtle 30% overlay
      ctx.globalAlpha = 0.32;
      ctx.drawImage(this.fogCanvas, 0, 0);
    } else {
      // Player Perspective: Full strict Fog of War
      ctx.drawImage(this.fogCanvas, 0, 0);
    }
    ctx.restore();

    return currentVisionPolygons;
  }
}

