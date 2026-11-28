// What happens when the map is used (split out of canvasEngine.js in v2.65.0): the double
// click/tap actions (doors, switches, tokens, notes), pings, effects, attack targets and switches.
import { store } from '../state.js';
import { network } from '../networkManager.js';
import { audio } from '../audioEngine.js';
import { undoManager } from '../undoManager.js';

export const actionMethods = {
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
  },

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
  },

  triggerFX(type, params = {}) {
    this.fx.trigger(type, params);
  },

  setAttackTarget(attackerId, targetId) {
    if (!targetId) {
      this.attackTarget = null;
      store.update({ targetTokenId: null });
    } else {
      this.attackTarget = { attackerId, targetId };
      store.update({ targetTokenId: targetId });
    }
  },

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
  },

  // --- Light Markers Rendering ---
  // The switch under a point: the Keeper finds every one; a player only the visible ones they
  // have discovered.
  switchAt(map, world, keeper) {
    const fullMapId = `${store.state.campaignId}:${map.id}`;
    return (map.switches || []).find(sw => Math.hypot(world.x - sw.x, world.y - sw.y) <= 18
      && (keeper || (!sw.secret && (!this.isNight(map) || this.fog.isPointExplored(sw.x, sw.y, fullMapId))))) || null;
  },

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
  },
};
