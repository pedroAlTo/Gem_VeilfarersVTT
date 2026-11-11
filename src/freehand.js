export const DRAWING_WIDTHS = [2, 5, 10];
export const MAX_DRAWING_POINTS = 2000;
export function validateDrawing(drawing) {
  if (!drawing || typeof drawing.id !== 'string' || !drawing.id || drawing.id.length > 200 ||
      typeof drawing.authorId !== 'string' || drawing.authorId.length > 200 ||
      !/^#[\da-f]{6}$/i.test(drawing.color) || !DRAWING_WIDTHS.includes(drawing.width) ||
      !Array.isArray(drawing.points) || !drawing.points.length || drawing.points.length > MAX_DRAWING_POINTS ||
      drawing.points.some(p => !p || ![p.x, p.y].every(n => Number.isFinite(n) && Math.abs(n) <= 1e6))) {
    throw new Error('Trazo no válido. Usa un color y uno de los tres grosores disponibles.');
  }
  return drawing;
}
const distance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
function segmentDistance(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const ac = cross(a, b, c), ad = cross(a, b, d), ca = cross(c, d, a), cb = cross(c, d, b);
  if (ac * ad < 0 && ca * cb < 0) return 0;
  return Math.min(distance(a, c, d), distance(b, c, d), distance(c, a, b), distance(d, a, b));
}
export function strokeHit(drawing, point, radius = 8, previous = point) {
  const points = drawing.points, tolerance = radius + drawing.width / 2;
  return points.length === 1 ? distance(points[0], previous, point) <= tolerance :
    points.some((p, i) => i > 0 && segmentDistance(points[i - 1], p, previous, point) <= tolerance);
}
export function paintDrawing(ctx, drawing, selected = false) {
  const points = drawing.points; if (!points.length) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = drawing.color; ctx.fillStyle = drawing.color; ctx.lineWidth = drawing.width;
  if (selected) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 8; }
  if (points.length === 1) { ctx.beginPath(); ctx.arc(points[0].x, points[0].y, drawing.width / 2, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (const p of points.slice(1)) ctx.lineTo(p.x, p.y); ctx.stroke(); }
  ctx.restore();
}
export function canAnnotate(stateStore) {
  const s = stateStore.state;
  return !stateStore.sessionBusy && (!s.persistentRoomId || !s.roomPaused) &&
    (stateStore.sessionRole !== 'player' || s.isConnected) && s.layerVisibility.overlay !== false && !s.layerLocked.overlay;
}

export class FreehandTool {
  constructor(engine, stateStore, networkManager, report) {
    Object.assign(this, { engine, store: stateStore, network: networkManager, report });
    this.eraseIds = new Set(); this.pending = new Map(); this.context = this.key();
    this.unsubscribe = stateStore.subscribe(() => { const key = this.key(); if (key !== this.context) { this.context = key; this.cancel(); } });
  }
  key() { const s = this.store.state; return JSON.stringify([s.campaignId, s.activeMapId, s.activeTool, s.userRole, this.store.sessionRole, s.isConnected, s.roomPaused, s.layerVisibility.overlay, s.layerLocked.overlay]); }
  owns(drawing) { return this.store.sessionRole !== 'player' || drawing.authorId === this.store.memberId; }
  cancel() { this.draft = null; this.erasing = false; this.previous = null; this.eraseIds.clear(); this.pending.clear(); }
  start(point) {
    const s = this.store.state;
    if (!['draw', 'erase_draw'].includes(s.activeTool)) return false;
    if (!canAnnotate(this.store)) { this.report('No puedes dibujar ahora. Comprueba la conexión y la capa de superposición.', 'error'); return true; }
    this.store.update({ selectedDrawingId: null });
    if (s.activeTool === 'draw') this.draft = { color: s.drawingColor || '#00dfff', width: s.drawingWidth || 5, points: [{ ...point }] };
    else { this.erasing = true; this.previous = point; this.move(point); }
    return true;
  }
  move(point) {
    if (this.draft) {
      const last = this.draft.points.at(-1);
      if (Math.hypot(point.x - last.x, point.y - last.y) > 2 / this.engine.zoom && this.draft.points.length < MAX_DRAWING_POINTS) this.draft.points.push({ ...point });
      return true;
    }
    if (this.erasing) {
      for (const drawing of this.store.getActiveMap().drawings || []) if (this.owns(drawing) && strokeHit(drawing, point, 12 / this.engine.zoom, this.previous)) this.eraseIds.add(drawing.id);
      this.previous = point; return true;
    }
    return false;
  }
  finish() {
    if (!this.draft && !this.erasing) return false;
    const draft = this.draft, ids = [...this.eraseIds], mapId = this.store.state.activeMapId;
    this.draft = null; this.erasing = false;
    if (!canAnnotate(this.store)) { this.cancel(); return true; }
    if (draft) {
      const key = crypto.randomUUID(); this.pending.set(key, draft);
      this.network.editDrawing('add', { mapId, drawing: draft }).then(({ id }) => this.store.update({ selectedDrawingId: id })).catch(e => this.report(e.message, 'error')).finally(() => this.pending.delete(key));
    } else if (ids.length) this.network.editDrawing('erase', { mapId, ids }).catch(e => this.report(e.message, 'error')).finally(() => this.eraseIds.clear());
    return true;
  }
  select(point) {
    if (this.store.state.layerVisibility.overlay === false) return false;
    const drawing = [...(this.store.getActiveMap().drawings || [])].reverse().find(d => strokeHit(d, point, 7 / this.engine.zoom));
    if (!drawing) return false;
    this.store.update({ selectedDrawingId: drawing.id, selectedTokenId: null, selectedWallId: null, selectedLightId: null, selectedWaterId: null, selectedEffectId: null, selectedTemplateId: null }); return true;
  }
  render(ctx) {
    if (this.store.state.layerVisibility.overlay === false) return;
    for (const drawing of this.store.getActiveMap().drawings || []) if (!this.eraseIds.has(drawing.id)) paintDrawing(ctx, drawing, drawing.id === this.store.state.selectedDrawingId);
    for (const draft of this.pending.values()) paintDrawing(ctx, draft);
    if (this.draft) paintDrawing(ctx, this.draft);
  }
}
