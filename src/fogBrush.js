// The Keeper's fog brush (v2.63.0, user request: «permite además al Keeper dibujar niebla de guerra
// en zonas descubiertas para volver a oscurecerlas»). With the tool on, the Keeper paints over the
// map: «Oscurecer» makes explored areas unexplored again, «Descubrir» explores them. The stroke is
// saved when it ends, with a new reset mark (map.fogResetAt): every player's screen replaces its
// memory with the table's, so what was darkened is dark for everyone. Whatever a character is
// looking at right now is explored again on the next frame, as with the «Reiniciar» button.
import { explorationKey } from './fogEngine.js';

export const FOG_BRUSH_SIZES = [1, 2, 4, 8]; // radius, in squares of the scene

export class FogBrush {
  constructor(engine, stateStore) {
    this.engine = engine;
    this.store = stateStore;
    this.stroke = null;
  }

  active() {
    const s = this.store.state;
    return s.activeTool === 'fog_brush' && s.userRole === 'keeper' && this.store.sessionRole !== 'player' && s.fogOfWar !== false;
  }

  radius() {
    const map = this.store.getActiveMap();
    return (map?.gridSize || 64) * (FOG_BRUSH_SIZES.includes(this.store.state.fogBrushSize) ? this.store.state.fogBrushSize : 2);
  }

  mapId() {
    return `${this.store.state.campaignId}:${this.store.state.activeMapId}`;
  }

  paint(point) {
    const image = this.engine.mapImage;
    if (!image?.width) return;
    this.engine.fog.brushExploration(this.mapId(), image.width, image.height, point.x, point.y, this.radius(), this.store.state.fogBrushMode === 'reveal');
  }

  start(point) {
    if (!this.active()) return false;
    this.stroke = { last: point };
    this.paint(point);
    return true;
  }

  move(point) {
    if (!this.stroke) return false;
    // Fill the gap between two pointer events so a fast stroke stays continuous.
    const { last } = this.stroke, step = this.radius() / 2;
    const n = Math.max(1, Math.ceil(Math.hypot(point.x - last.x, point.y - last.y) / step));
    for (let i = 1; i <= n; i++) this.paint({ x: last.x + ((point.x - last.x) * i) / n, y: last.y + ((point.y - last.y) * i) / n });
    this.stroke.last = point;
    return true;
  }

  finish() {
    if (!this.stroke) return false;
    this.stroke = null;
    this.save();
    return true;
  }

  save() {
    const engine = this.engine, map = this.store.getActiveMap(), image = engine.mapImage;
    if (!map || !image?.width) return;
    const fullMapId = this.mapId();
    const fogExplored = engine.fog.serializeExploration(fullMapId, image.width, image.height);
    const fogResetAt = Date.now();
    // This screen already shows the stroke: it must not reload its memory from the saved grid.
    engine.fogApplied ??= new Map();
    engine.fogApplied.set(fullMapId, { data: explorationKey(fogExplored), reset: fogResetAt });
    engine._fogSavedVersion = `${fullMapId}:${engine.fog.exploredVersion}`;
    this.store.updateMap(map.id, { fogExplored, fogResetAt });
  }

  // The brush's outline under the pointer.
  render(ctx) {
    const at = this.engine.cursorWorld;
    if (!this.active() || !at) return;
    const reveal = this.store.state.fogBrushMode === 'reveal', zoom = this.engine.zoom || 1;
    ctx.save();
    ctx.beginPath(); ctx.arc(at.x, at.y, this.radius(), 0, Math.PI * 2);
    ctx.fillStyle = reveal ? 'rgba(253, 230, 138, 0.10)' : 'rgba(15, 10, 40, 0.28)'; ctx.fill();
    ctx.lineWidth = 2 / zoom; ctx.setLineDash([8 / zoom, 6 / zoom]);
    ctx.strokeStyle = reveal ? '#fde68a' : '#c084fc'; ctx.stroke();
    ctx.restore();
  }
}
