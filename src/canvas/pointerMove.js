// Moving the pointer over the map (split out of initEvents in v2.65.0): dragging tokens and
// handles, drawing previews, panning and what the pointer hovers.
import { store } from '../state.js';

export const pointerMoveMethods = {
// The pointer moving over the map: dragging, drawing, hovering (registered in initEvents).
  onMouseMove(e) {
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
    },
};
