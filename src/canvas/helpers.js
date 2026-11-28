// Constants and helpers the canvas engine's modules share (split out of canvasEngine.js in v2.65.0).
import { store } from '../state.js';
import { isPartyToken } from '../tokenPermissions.js';

export const WATER_DEPTH_NAMES = [
  'Pond / Puddle (0-10cm)',
  'Ankle-Deep Stream (10-30cm)',
  'Knee-Deep Shallows (0.5m)',
  'Waist-Deep Swamp / Cryo (1m)',
  'Chest-Deep Submerged (1.5-2m)',
  'Void Abyss / Pearl Trench (Very Deep)'
];

export const WATER_DEPTH_COLORS = [
  'rgba(56, 189, 248, 0.28)',  // 0: Pond
  'rgba(14, 165, 233, 0.40)',  // 1: Ankle
  'rgba(2, 132, 199, 0.52)',   // 2: Knee
  'rgba(3, 105, 161, 0.65)',   // 3: Waist
  'rgba(30, 58, 138, 0.78)',   // 4: Chest
  'rgba(10, 15, 45, 0.92)'     // 5: Abyss
];

// Whose eyes may show the map: a party token, or one this screen controls. Never an enemy's
// (players do not share what adversaries and NPCs see; v2.27.7).
// An adversary or a masked token («?????») is an enemy even when someone was given control of it:
// it never lends its eyes to the players, and they see it only when the party does (v2.27.8).
export const isEnemyToken = t => !!t && !t.isPlayer && (t.actorType === 'adversary' || !!t.hideName || /horror|stalker|abomination|threat|alien|beast|monster|parasite|spawn|unknown/i.test(`${t.name || ''} ${t.roleTag || ''} ${t.species || ''}`));

// The party's eyes: party tokens that are not enemies.
export const partyEyes = t => isPartyToken(t) && !isEnemyToken(t);

export const sharesSight = token => !!token && !isEnemyToken(token) && (isPartyToken(token) || (store.sessionRole === 'player' && token.ownerId !== 'keeper' && !!store.canEditToken?.(token.id)));

// Ramer–Douglas–Peucker: a freehand outline with only the points that shape it.
export function simplifyPath(points, tolerance = 3) {
  if (points.length < 3) return points.slice();
  const dist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy; if (!l) return Math.hypot(p.x - a.x, p.y - a.y); const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); };
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop(); let best = -1, at = -1;
    for (let k = i + 1; k < j; k++) { const d = dist(points[k], points[i], points[j]); if (d > best) { best = d; at = k; } }
    if (best > tolerance) { keep[at] = 1; stack.push([i, at], [at, j]); }
  }
  return points.filter((_, i) => keep[i]);
}
