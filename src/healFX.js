// A small effect when a token is healed (v2.43.1, user request): a soft green glow, a rising
// cross and «+N HP» above it, for about a second and a half. Presentation only: HP changes come
// from the rules; the canvas only sees that a token's HP went up.
const TAU = Math.PI * 2, LIFE = 1.5;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Who was healed between two token lists (same scene, HP up): [{ id, x, y, size, amount }].
export function healedTokens(previous = [], tokens = [], mapId = null) {
  const before = new Map(previous.map(t => [t.id, t]));
  const out = [];
  for (const t of tokens) {
    const was = before.get(t.id);
    if (!was || (mapId && t.mapId !== mapId) || was.mapId !== t.mapId) continue;
    const amount = (Number(t.hp?.current) || 0) - (Number(was.hp?.current) || 0);
    if (amount > 0 && Number.isFinite(t.x) && Number.isFinite(t.y)) out.push({ id: t.id, x: t.x, y: t.y, size: t.size || 1, amount });
  }
  return out;
}

export class HealFX {
  constructor() { this.bursts = []; }
  clear() { this.bursts = []; }
  add({ x, y, diameter = 64, amount = 1 }) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(amount > 0)) return false;
    this.bursts = [...this.bursts.filter(b => Math.hypot(b.x - x, b.y - y) > 1 || b.t > 0.4), { x, y, radius: clamp(diameter, 16, 2000) / 2, amount: Math.round(amount), t: 0 }].slice(-12);
    return true;
  }
  render(ctx, dt, { reducedMotion = false } = {}) {
    if (!this.bursts.length) return;
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter(b => b.t < LIFE);
    for (const b of this.bursts) {
      // Fully visible at first, then it fades; the text rises above the HP bar.
      const k = b.t / LIFE, fade = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55, rise = reducedMotion ? 0 : k * b.radius * 0.7;
      ctx.save();
      // Glow and a ring that opens around the token.
      const glow = ctx.createRadialGradient(b.x, b.y, b.radius * 0.2, b.x, b.y, b.radius * 1.35);
      glow.addColorStop(0, `rgba(74, 222, 128, ${0.32 * fade})`); glow.addColorStop(1, 'rgba(74, 222, 128, 0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 1.35, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(134, 239, 172, ${0.85 * fade})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * (reducedMotion ? 1.08 : 1 + 0.25 * k), 0, TAU); ctx.stroke();
      // A cross and the amount, rising.
      const cy = b.y - b.radius * 1.75 - rise, arm = Math.max(6, b.radius * 0.18);
      ctx.fillStyle = `rgba(134, 239, 172, ${fade})`; ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 10;
      ctx.fillRect(b.x - arm * 0.3, cy - arm, arm * 0.6, arm * 2); ctx.fillRect(b.x - arm, cy - arm * 0.3, arm * 2, arm * 0.6);
      ctx.font = `700 ${Math.round(clamp(b.radius * 0.55, 15, 48))}px 'Chakra Petch', system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = `rgba(5, 46, 22, ${0.95 * fade})`; ctx.strokeText(`+${b.amount} HP`, b.x, cy - arm * 2.2);
      ctx.fillStyle = `rgba(220, 252, 231, ${fade})`; ctx.fillText(`+${b.amount} HP`, b.x, cy - arm * 2.2);
      ctx.restore();
    }
  }
}
