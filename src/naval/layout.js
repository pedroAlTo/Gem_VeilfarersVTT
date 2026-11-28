import { BANDS, MOVES, moveBand } from './encounter.js';

export const radii = [1.8, 4.6, 8.2, 12.1, 16.2];
export const boundaries = [2.6, 6.2, 10, 14.2, 18];
const radius = band => radii[BANDS.indexOf(band)];
// Model noses face +X in both renderers. Present the declared shield arc to the target.
export function headingYaw(origin, target, arc = 'fore') {
  const bearing = Math.atan2(target[2] - origin[2], target[0] - origin[0]);
  return ['fore','starboard','aft','port'].indexOf(arc) * Math.PI / 2 - bearing;
}
export function layoutEncounter(n, targetId, move, height, preview) {
  const primary = n.contacts.find(c => c.kind === 'ship') || n.contacts[0];
  const primaryRadius = primary ? radius(primary.band) : 8.2;
  const own = [-primaryRadius * .88, 0, primaryRadius * .475];
  const points = new Map([['own',own]]);
  for (const c of n.contacts) {
    points.set(c.id, c === primary ? [0,0,0] : [own[0]+Math.cos(c.bearing)*radius(c.band), 0, own[2]-Math.sin(c.bearing)*radius(c.band)]);
  }
  const contact = n.contacts.find(c => c.id === targetId);
  const center = points.get(targetId) || [0,0,0];
  let ghost = null;
  if (preview && contact?.kind === 'ship' && MOVES[move]) {
    const dest = moveBand(contact.band, MOVES[move].step);
    if (dest) {
      const angle = Math.atan2(own[2]-center[2], own[0]-center[0]) + (MOVES[move].step === 0 ? .42 : 0);
      ghost = [center[0]+Math.cos(angle)*radius(dest), height, center[2]+Math.sin(angle)*radius(dest)];
    }
  }
  return { points, own, center, ghost };
}
