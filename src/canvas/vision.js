// What can be seen (split out of canvasEngine.js in v2.65.0): the scene's darkness and night,
// whose eyes show the map, what the party sees (range, cone, walls, lights) and what it knows.
import { DAYLIGHT_BELOW } from '../fogEngine.js';
import { store } from '../state.js';
import { withRanges } from '../visionRanges.js';
import { SEE_TOKENS_FROM, seeThrough } from '../windows.js';
import { partyEyes, sharesSight } from './helpers.js';

export const visionMethods = {
  // The scene's darkness now: 1 − its ambient light. When the Keeper changes it with a
  // transition (Clima: Día / Atardecer / Noche), every screen slides to it over that time.
  // A scene keeps its old look until the Keeper sets its darkness in Clima (`map.darkness`): with
  // fog of war the fog alone shades it (no darkness), without fog its ambient light does.
  sceneDarkness(map, now = (typeof performance !== 'undefined' ? performance.now() : Date.now()), fog = true) {
    if (Number.isFinite(this.previewDarkness)) return Math.max(0, Math.min(1, this.previewDarkness));
    const set = Number.isFinite(map?.darkness) ? map.darkness : fog ? 0 : 1 - (map?.ambientLight ?? 0.25);
    const target = Math.max(0, Math.min(1, set));
    const d = this.darknessAnim;
    if (!d || d.mapId !== map?.id) { this.darknessAnim = { mapId: map?.id, from: target, to: target, start: now, dur: 0 }; return target; }
    if (d.to !== target) {
      const shown = this.darknessAt(d, now);
      Object.assign(d, { from: shown, to: target, start: now, dur: Math.max(0, Math.min(60000, Number(map.lightTransitionMs) || 0)) });
    }
    return this.darknessAt(d, now);
  },

  darknessAt(d, now) {
    if (!d.dur) return d.to;
    const t = Math.max(0, Math.min(1, (now - d.start) / d.dur)), ease = t * t * (3 - 2 * t);
    return d.from + (d.to - d.from) * ease;
  },

  // The tokens of this scene as the vision, lighting and fog read them: their sight, light and
  // vibration ranges converted from metres to this map's pixels (v2.63.0, visionRanges.js).
  visionTokens() {
    const map = store.getActiveMap();
    return (store.confirmedTokens?.() || store.state.tokens).filter(token => token.mapId === store.state.activeMapId).map(token => withRanges(token, map));
  },

  // --- Check if an NPC / Adversary token is visible to any active player token ---
  isTokenVisibleToPlayers(targetTok, allTokens, map) {
    const state = store.getState();
    if (store.sessionRole === 'player') allTokens = this.visionTokens();
    // 1. Friendly player tokens are always visible to players
    if (partyEyes(targetTok)) return true;

    // 2. If Keeper has GM Vision active, all tokens are visible to Keeper
    if (state.userRole === 'keeper' && state.gmVision) return true;

    // 3. Find viewing tokens: all friendly player characters
    // Enemies do not share their sight: only the party's eyes count (a player who selects an
    // enemy does not see what it sees; the Keeper's preview of a selected NPC stays on his screen).
    let viewers = allTokens.filter(partyEyes);
    if (viewers.length === 0) {
      const sel = allTokens.find(t => (t.id === state.selectedTokenId || t.id === state.claimedTokenId) && (state.userRole !== 'player' || sharesSight(t)));
      if (sel) viewers = [sel];
    }
    if (viewers.length === 0) return false;

    return this.partySees(viewers, targetTok.x, targetTok.y, map);
  },

  // What this screen knows as discovered (the table's memory, and on the Keeper's screen what the
  // NPCs saw): the darkness is lifted to the explored veil there. None without a real canvas.
  knownArea(fullMapId, state = store.state) {
    try { return this.fog.knownCanvas(fullMapId, this.mapImage.width, this.mapImage.height, state.userRole === 'keeper' && store.sessionRole !== 'player'); }
    catch { return null; }
  },

  // Night (v2.64.0): the scene is 50 % dark or more (Clima, or its ambient light). By day a
  // character sees up to its vision range.
  isNight(map) {
    return this.sceneDarkness(map, undefined, false) >= DAYLIGHT_BELOW;
  },

  // Whether the party sees a point (v2.64.0, user decision; Foundry VTT's detection modes as the
  // reference): a character facing it with nothing in between and within its vision range; at
  // night, also within its dark range or where a light shines on it. Up to v2.63 a lit point was
  // seen at any distance (v2.27.8), so a large light made a cone without end.
  partySees(viewers, x, y, map) {
    const walls = map.walls || [];
    const blocked = (ax, ay, bx, by, forLight = false) => walls.some(wall => {
      const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
      if (wallType === 'door' && wall.isOpen) return false; // open doors do not block
      // A window lets light through, and lets the party make out who is behind it from a side
      // clear enough (v2.29.2).
      if (wallType === 'window' && (forLight || seeThrough(wall, ax, ay) >= SEE_TOKENS_FROM)) return false;
      return this.checkLineIntersection(ax, ay, bx, by, wall.x1, wall.y1, wall.x2, wall.y2);
    });
    const within = (cx, cy, facing, angle, px, py) => {
      if (!(angle < 360)) return true;
      let diff = Math.atan2(py - cy, px - cx) - (facing ?? 0);
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      return Math.abs(diff) <= (angle * Math.PI) / 360;
    };
    const night = this.isNight(map);
    // At night: the map's lights that are on and the party's own lights (an enemy's lamp is the
    // Keeper's only, v2.29.2).
    const lights = !night ? [] : [
      ...(map.lights || []).filter(l => l.enabled !== false && !l.off).map(l => ({ x: l.x, y: l.y, radius: l.radius || 200, facing: l.facingAngle, angle: l.visionAngle ?? 360 })),
      ...this.visionTokens().filter(t => partyEyes(t) && t.hasLight && !t.hidden && t.lightRadius > 0).map(t => ({ x: t.x, y: t.y, radius: t.lightRadius, facing: t.facingAngle, angle: t.visionAngle ?? 90 })),
    ];
    const lit = () => lights.some(l => Math.hypot(x - l.x, y - l.y) <= l.radius && within(l.x, l.y, l.facing, l.angle, x, y) && !blocked(l.x, l.y, x, y, true));
    for (const viewer of viewers) {
      if (viewer.hidden) continue;
      const { visionRange, darkRange } = withRanges(viewer, map);
      const dist = Math.hypot(x - viewer.x, y - viewer.y);
      if (dist > visionRange) continue;
      if (!within(viewer.x, viewer.y, viewer.facingAngle, viewer.visionAngle ?? 90, x, y)) continue;
      if (blocked(viewer.x, viewer.y, x, y)) continue;
      if (!night || dist <= darkRange || lit()) return true;
    }
    return false;
  },

  // --- Check if a point is within active vision/light of any player token ---
  isPointInPlayerVision(x, y, allTokens, map) {
    if (store.sessionRole === 'player') allTokens = this.visionTokens();
    return this.partySees(allTokens.filter(partyEyes), x, y, map);
  },

  // --- Distance & Projection from Point to Segment Helper ---
  projectPointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return { x: x1, y: y1, t: 0, dist: Math.hypot(px - x1, py - y1) };
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    const clampedT = Math.max(0, Math.min(1, t));
    const projX = x1 + clampedT * dx;
    const projY = y1 + clampedT * dy;
    return {
      x: projX,
      y: projY,
      t: clampedT,
      dist: Math.hypot(px - projX, py - projY)
    };
  },

  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  },

  // --- Line Intersection Helper ---
  checkLineIntersection(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
    const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
    const u = -((p1x - p3x) * (p2y - p1y) - (p1y - p3y) * (p2x - p1x)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  },
};
