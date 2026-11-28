// Pressing on the map with the mouse or a pen (split out of initEvents in v2.65.0): selection,
// token drags, door and light handles, and the first point of every drawing tool.
import { store } from '../state.js';
import { network } from '../networkManager.js';
import { audio } from '../audioEngine.js';
import { undoManager } from '../undoManager.js';
import { notify } from '../ui.js';
import { movementBlock } from '../combatState.js';

export const pointerDownMethods = {
// A press on the map: selecting, starting a drag, or the first point of a tool (registered in initEvents).
  onMouseDown(e) {
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
    },
};
