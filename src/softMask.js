// Feathered edges for the darkness layers (fog of war and lighting). The mask is shrunk and
// enlarged again, which blurs every hard cut into a gradient. It needs no canvas filter, so
// it looks the same in every browser, and it costs one small extra draw per frame.
const scratch = new WeakMap();

// version: pass a number that changes only when the mask is redrawn; while it stays the same
// the reduced copy is reused and a frame costs a single draw.
export function drawSoftened(ctx, source, softness = 10, version = null) {
  const width = source?.width, height = source?.height;
  if (!width || !height) return;
  const factor = Math.max(1, Math.round(softness));
  let small = scratch.get(source);
  if (!small && factor > 1 && typeof document !== 'undefined') { small = document.createElement('canvas'); scratch.set(source, small); }
  const smallCtx = factor > 1 ? small?.getContext?.('2d') : null;
  if (!smallCtx) { ctx.drawImage(source, 0, 0); return; }
  const w = Math.max(1, Math.ceil(width / factor)), h = Math.max(1, Math.ceil(height / factor));
  const resized = small.width !== w || small.height !== h;
  if (resized) { small.width = w; small.height = h; }
  if (resized || version === null || small.__version !== version) {
    smallCtx.clearRect(0, 0, w, h);
    smallCtx.imageSmoothingEnabled = true; smallCtx.imageSmoothingQuality = 'high';
    smallCtx.drawImage(source, 0, 0, width, height, 0, 0, w, h);
    small.__version = version;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, w, h, 0, 0, w * factor, h * factor);
  ctx.restore();
}

// A cheap fingerprint of the numbers a mask depends on. Two frames with the same fingerprint
// draw the same mask, so the second one can reuse the first.
export function fingerprint(values) {
  let h = 2166136261;
  for (const value of values) {
    const n = typeof value === 'number' ? Math.round(value * 16) : typeof value === 'string' ? value.length * 31 + (value.charCodeAt(0) || 0) + (value.charCodeAt(value.length - 1) || 0) * 7 : value ? 1 : 0;
    h = Math.imul(h ^ (n | 0), 16777619);
  }
  return h >>> 0;
}
export const wallValues = walls => walls.flatMap(w => [w.x1, w.y1, w.x2, w.y2, w.isOpen ? 1 : 0, w.wallType || (w.isDoor ? 'door' : w.isWindow ? 'window' : 'wall'), w.visionPercent ?? -1]);

// Sight does not end in a line: it is full up to most of its range and fades over the rest.
export const VISION_FADE_START = 0.72;
export function visionFill(ctx, x, y, radius) {
  if (typeof ctx.createRadialGradient !== 'function' || !(radius > 0)) return 'rgba(0, 0, 0, 1.0)';
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
  gradient.addColorStop(VISION_FADE_START, 'rgba(0, 0, 0, 1)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  return gradient;
}
