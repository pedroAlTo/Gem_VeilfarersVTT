// Windows (v2.29.2, user decision 21 Nov 2026): each side of a window has its own transparency,
// from 0 % (an opaque wall) to 100 % (clear glass): the one-way mirror of an interrogation room is
// 100 % from one side and 10 % from the other. What lies beyond a window is seen dimmed by the
// transparency of the side the viewer stands on; at 0 % the window stops sight like a wall.
// Side A is to the left of the segment going from its first point to its second; side B, the other.
export const isWindowWall = w => !!w && (w.wallType === 'window' || (!w.wallType && w.isWindow));
const pct = value => Math.max(0, Math.min(100, Math.round(Number.isFinite(Number(value)) ? Number(value) : 80)));
export const windowSides = w => {
  const a = pct(w?.visionPercent ?? 80);
  return { a, b: pct(w?.visionPercentBack ?? a) };
};
// The side (x, y) is on: 'a' or 'b'.
export const windowSide = (w, x, y) => ((w.x2 - w.x1) * (y - w.y1) - (w.y2 - w.y1) * (x - w.x1) >= 0 ? 'a' : 'b');
// How much one sees through the window from (x, y), 0–100.
export const seeThrough = (w, x, y) => windowSides(w)[windowSide(w, x, y)];
// Clear enough to make out who is behind it (tokens): half or more.
export const SEE_TOKENS_FROM = 50;

// The area hidden behind a window, seen from (x, y): the window and its two edges pushed away
// from the viewer by `reach`. Returns four points, or null when the viewer is on the line.
export function windowShadow(w, x, y, reach) {
  const far = (px, py) => { const dx = px - x, dy = py - y, m = Math.hypot(dx, dy); return m < 1e-6 ? null : [px + (dx / m) * reach, py + (dy / m) * reach]; };
  const q1 = far(w.x1, w.y1), q2 = far(w.x2, w.y2);
  return q1 && q2 ? [[w.x1, w.y1], [w.x2, w.y2], q2, q1] : null;
}
