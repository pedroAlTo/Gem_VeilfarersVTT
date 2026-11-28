export const BANDS = ['Adjacent', 'Engagement', 'Standard', 'Long', 'Extreme'];
// Nominal distances are labels for the miniature. Only the band resolves a rule.
export const BAND_KM = [0.05, 3, 12, 80, 800];
export const ROLES = { pilot: 'Piloto', gunner: 'Artillero', engineer: 'Ingeniero', sensors: 'Sensores' };
export const ARCS = { fore: 'Proa', starboard: 'Estribor', aft: 'Popa', port: 'Babor' };
export const DRIVES = { Cruise: { bonus: 0, heat: 0 }, Combat: { bonus: 1, heat: 1 }, Overdrive: { bonus: 2, heat: 3 } };
export const MOVES = {
  aggressive: { name: 'Aproximación agresiva', step: -1, dc: 10, hit: 'Cierra una banda. Artillería +1 y Evasión −1.' },
  close: { name: 'Cerrar distancia', step: -1, dc: 10, hit: 'Cierra una banda.' },
  open: { name: 'Abrir distancia', step: 1, dc: 10, hit: 'Abre una banda.' },
  evade: { name: 'Patrón evasivo', step: 0, dc: 10, hit: 'Conserva la banda y gana +2 Evasión.' },
  flank: { name: 'Flanqueo', step: 0, dc: 15, hit: 'Ventaja al próximo disparo dirigido al arco declarado.' },
  broadside: { name: 'Andanada', step: 0, dc: 10, hit: 'Presenta Babor o Estribor. Ese arco queda expuesto.' },
};
export const WEAPONS = {
  plasma: { name: 'Light Plasma', qty: 2, sides: 10, flat: 0, maxBand: 1 },
  slug: { name: 'Light Slug Cannon', qty: 2, sides: 8, flat: 0, maxBand: 2 },
  pulse: { name: 'Pulse Cannon', qty: 2, sides: 8, flat: 1, maxBand: 1 },
  missile: { name: 'Light Missile', qty: 3, sides: 6, flat: 1, maxBand: 2 },
};
export const FRIENDLY_WEAPONS = ['plasma', 'slug'];
export const NAVAL_SKY = '/assets/space/veil-orbit.webp';
export const sensorDC = band => 5 * (BANDS.indexOf(band) + 1);
export const moveBand = (band, step) => BANDS[BANDS.indexOf(band) + step] ?? null;
export const inRange = (weapon, band) => BANDS.indexOf(band) >= 1 && BANDS.indexOf(band) <= weapon.maxBand;
export const bandLabel = band => `${BAND_KM[BANDS.indexOf(band)]?.toLocaleString('es-ES')} km · ${band}`;
export const crewEligible = (actor, mapId) => actor?.isPlayer === true && actor.mapId === mapId && !actor.hidden && !actor.inReserve && actor.actorType !== 'drone';
// A player may own several tokens at the table and still occupies one naval station.
export function crewMember(actor) {
  return actor && ([actor.ownerId, ...(actor.controllerIds || [])].find(id => id && id !== 'keeper') || actor.id);
}
export function evasionSources(ship, naval, tokens) {
  const pilot = tokens.find(t => t.id === naval.crew.pilot);
  const base = ship.tier === 1 ? 16 : ship.tier >= 4 ? 8 : 12;
  return { base, instinct: pilot?.traits?.instinct || 0, drive: DRIVES[naval.drive]?.bonus || 0, maneuver: naval.pilotEffect.evasion || 0 };
}
export function crewEvasion(ship, naval, tokens) {
  return Object.values(evasionSources(ship,naval,tokens)).reduce((total, value) => total + value, 0);
}
export function hullLoss(raw) {
  if (raw <= 0) return 0;
  if (raw <= 5) return 1;
  if (raw <= 12) return 2;
  if (raw <= 20) return 3;
  return raw <= 30 ? 4 : 5 + Math.floor((raw - 31) / 10);
}
export function applyImpact(ship, arc, raw) {
  const absorbed = Math.min(raw, ship.shieldArcs[arc]);
  const lost = hullLoss(raw - absorbed);
  ship.shieldArcs[arc] -= absorbed;
  ship.hull = Math.max(0, ship.hull - lost);
  return { absorbed, lost };
}
export function createEncounter(tokens, mapId, selectedId) {
  const actors = tokens.filter(t => crewEligible(t, mapId));
  const pilot = actors.find(t => t.id === selectedId) || actors[0];
  const seated = new Set([crewMember(pilot)]);
  const rest = actors.filter(actor => {
    const member = crewMember(actor);
    if (seated.has(member)) return false;
    seated.add(member);
    return true;
  });
  const crew = { pilot: pilot?.id || '', gunner: rest[0]?.id || '', engineer: rest[1]?.id || '', sensors: rest[2]?.id || '' };
  return {
    version: 1, revision: 0, round: 1, drive: null, heading: 'fore', crew, spent: {}, pilotEffect: {}, note: '',
    contacts: [
      { id: 'skarrh', name: 'Crimson Skarrh', kind: 'ship', band: 'Standard', locked: false, visibleDamage: false, bearing: 0.24,
        privateShip: { hull: 22, maxHull: 22, evasion: 12, heat: 1, heatCap: 12, mountRating: 2,
          shieldArcs: { fore: 6, aft: 6, port: 6, starboard: 6, maxPerArc: 6 },
          systems: { 'Primary Drive': 3, 'Sensor Array': 3, Weapons: 3 }, weapons: ['pulse', 'missile'], acted: {}, firedThisRound: false } },
      { id: 'beacon', name: 'Baliza', kind: 'beacon', band: 'Long', bearing: 2.36, locked: false, visibleDamage: false },
    ],
  };
}
// Whitelist both levels so a future Keeper-only field cannot enter a room snapshot.
export function publicEncounter(n) {
  const { version, revision, round, drive, heading, crew, spent, note } = n;
  const pilotEffect = Object.fromEntries(['evasion', 'attack', 'exposed', 'flankId', 'flankArc', 'aim']
    .filter(key => n.pilotEffect[key] !== undefined).map(key => [key, n.pilotEffect[key]]));
  const impact = n.impact && { revision: n.impact.revision, target: n.impact.target, source: n.impact.source, arc: n.impact.arc };
  const stations = Object.keys(ROLES);
  return { version, revision, round, drive, heading, ...(impact ? { impact } : {}),
    crew: Object.fromEntries(stations.map(id => [id,crew[id]])),
    spent: Object.fromEntries(stations.filter(id => spent[id]).map(id => [id,spent[id]])), pilotEffect, note,
    contacts: n.contacts.filter(c => !c.hidden).map(({ id, name, kind, band, locked, visibleDamage, bearing }) =>
      ({ id, name, kind, band, locked, visibleDamage, bearing })) };
}
const int = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
const short = x => typeof x === 'string' && x.length <= 200;
const obj = x => x && typeof x === 'object' && !Array.isArray(x);
const record = (x, accept) => obj(x) && Object.entries(x).every(([key, value]) => accept(key, value));
export function validEncounter(n) {
  if (!obj(n) || n.version !== 1 || !int(n.revision, Number.MAX_SAFE_INTEGER) || !int(n.round, Number.MAX_SAFE_INTEGER) || n.round < 1 ||
      (n.heading != null && !Object.hasOwn(ARCS,n.heading)) || !(n.drive === null || Object.hasOwn(DRIVES, n.drive)) || !obj(n.crew) || !Object.keys(ROLES).every(k => short(n.crew[k])) ||
      !record(n.spent, (key, val) => Object.hasOwn(ROLES, key) && short(val)) || !obj(n.pilotEffect) ||
      typeof n.note !== 'string' || n.note.length > 500 || !Array.isArray(n.contacts) || !n.contacts.length || n.contacts.length > 64 ||
      new Set(n.contacts.map(c => c?.id)).size !== n.contacts.length) return false;
  const impact = n.impact;
  if (impact && (!int(impact.revision,n.revision) || !short(impact.target) || !short(impact.source) || !Object.hasOwn(ARCS,impact.arc))) return false;
  return n.contacts.every(c => {
    if (!obj(c) || !short(c.id) || !c.id || !short(c.name) || !['ship','beacon'].includes(c.kind) ||
        !BANDS.includes(c.band) || !Number.isFinite(c.bearing) || typeof c.locked !== 'boolean' || typeof c.visibleDamage !== 'boolean') return false;
    const s = c.privateShip;
    if (s === undefined) return true; // players receive only the contact
    return obj(s) && int(s.maxHull,10000) && int(s.hull,s.maxHull) && int(s.evasion,100) && int(s.heat,10000) && int(s.heatCap,10000) &&
      int(s.mountRating,3) && s.mountRating > 0 && obj(s.shieldArcs) && int(s.shieldArcs.maxPerArc,100) &&
      Object.keys(ARCS).every(a => int(s.shieldArcs[a],100)) && record(s.systems, (key,val) => short(key) && int(val,3)) &&
      Array.isArray(s.weapons) && s.weapons.every(w => Object.hasOwn(WEAPONS,w)) && obj(s.acted);
  });
}
