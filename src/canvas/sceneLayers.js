// The scene's own layers (split out of canvasEngine.js in v2.65.0): water and lava zones and
// their drawing, rain and mist, the grid and its calibration guide, walls, doors, windows,
// switches and the Keeper's light markers.
import { drawRainRipples, drawWaterSurface, renderWeatherFog, renderWeatherRain, traceWater, waterBounds } from '../surfaceFX.js';
import { store } from '../state.js';
import { canvasFont } from '../fontSets.js';
import { windowSides } from '../windows.js';
import { notify } from '../ui.js';

export const sceneLayerMethods = {
  // --- Tablet & Mobile Touch Gestures ---
  canDrawWater() {
    const state = store.getState();
    return state.activeTool === 'water' && state.userRole === 'keeper' && store.sessionRole !== 'player' &&
      state.layerVisibility.water !== false && !state.layerLocked.water;
  },

  waterDraftChanged() {
    window.dispatchEvent(new CustomEvent('veil:water-draft'));
  },

  cancelWaterDrawing() {
    if (this.waterStart || this.waterPolyPoints?.length) this.preDragSnapshot = null;
    this.waterStart = null; this.waterCurrent = null; this.waterPolyPoints = []; this.waterFreePoints = null;
    this.waterDraftChanged();
  },

  finishWaterPolygon() {
    if (!this.canDrawWater() || store.state.waterDrawMode !== 'polygon') return false;
    try {
      const zone = store.addWaterZone({ name:'Aquatic Hazard', shape:'polygon', points:this.waterPolyPoints, depth:2 });
      if (!zone) return false;
      this.cancelWaterDrawing();
      return true;
    } catch (error) { notify(error.message, 'error'); return false; }
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  // --- Walls, Doors & Windows Rendering ---
  renderWalls(ctx, walls, isEditor = true) {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';
    const sceneIsDark = this.isNight(store.getActiveMap());

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
      // In the dark (v2.64.4, the one fog) undiscovered walls, doors and windows are hidden from
      // the players; by day, or once discovered, a door shows.
      if (!isKeeper || !state.gmVision) {
        if (sceneIsDark) {
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
  },

  renderSwitches(ctx, map, keeper) {
    const state = store.getState(), list = map.switches || [];
    if (!list.length) return;
    const fullMapId = `${state.campaignId}:${map.id}`;
    ctx.save();
    for (const raw of list) {
      const sw = this.draggedSwitch?.sw?.id === raw.id ? this.draggedSwitch.sw : raw;
      if (!keeper && (sw.secret || (this.isNight(map) && !this.fog.isPointExplored(sw.x, sw.y, fullMapId)))) continue;
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
  },

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
  },
};
