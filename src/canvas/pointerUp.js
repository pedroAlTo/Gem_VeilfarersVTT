// Releasing the press on the map (split out of initEvents in v2.65.0): where a dragged token
// lands, and finishing walls, lights, templates, water and freehand strokes.
import { store } from '../state.js';
import { network } from '../networkManager.js';
import { audio } from '../audioEngine.js';
import { undoManager } from '../undoManager.js';
import { notify } from '../ui.js';
import { approachBlock } from '../combatState.js';
import { grantActorSpotlight } from '../gameActions.js';
import { simplifyPath } from './helpers.js';

export const pointerUpMethods = {
// Releasing the press: dropping a token, finishing a wall, a template or a stroke (registered in initEvents).
  onMouseUp(e) {
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
    },
};
