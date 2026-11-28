// Dropping things on the map and its right-click menu (split out of initEvents in v2.65.0).
import { store } from '../state.js';
import { network } from '../networkManager.js';
import { audio } from '../audioEngine.js';
import { undoManager } from '../undoManager.js';
import { notify } from '../ui.js';
import { getCloudinaryConfig, uploadToCloudinary } from '../cloudinaryService.js';

export const dropMenuMethods = {
// Something dropped on the map: an image, a token from the roster or a file (registered in initEvents).
  onDrop(e) {
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
    },

// The right-click menu on the map (registered in initEvents).
  onContextMenu(e) {
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
    },
};
