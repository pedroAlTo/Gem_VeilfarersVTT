// Feathered edges for the darkness layers (fog of war and lighting). The mask is shrunk and
// enlarged again, which blurs every hard cut into a gradient. It needs no canvas filter, so
// it looks the same in every browser, and it costs one small extra draw per frame.
const scratch = new WeakMap();

export function drawSoftened(ctx, source, softness = 10) {
  const width = source?.width, height = source?.height;
  if (!width || !height) return;
  const factor = Math.max(1, Math.round(softness));
  let small = scratch.get(source);
  if (!small && factor > 1 && typeof document !== 'undefined') { small = document.createElement('canvas'); scratch.set(source, small); }
  const smallCtx = factor > 1 ? small?.getContext?.('2d') : null;
  if (!smallCtx) { ctx.drawImage(source, 0, 0); return; }
  const w = Math.max(1, Math.ceil(width / factor)), h = Math.max(1, Math.ceil(height / factor));
  if (small.width !== w || small.height !== h) { small.width = w; small.height = h; }
  smallCtx.clearRect(0, 0, w, h);
  smallCtx.imageSmoothingEnabled = true; smallCtx.imageSmoothingQuality = 'high';
  smallCtx.drawImage(source, 0, 0, width, height, 0, 0, w, h);
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, w, h, 0, 0, w * factor, h * factor);
  ctx.restore();
}

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
