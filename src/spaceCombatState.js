// src/spaceCombatState.js
// PROJECT ARES — Estado del combate espacial 3D: ronda, modo de motor anunciado,
// puestos que ya usaron su Spotlight, arcos Exposed y contactos enemigos.
// Puro (sin DOM): se persiste como parte de state.starship.combat y viaja por red.

import {
  RANGE_BANDS, SENSOR_LOCK_DC, ENGINE_MODES, MANEUVERS, ARCS,
  bandAfterManeuver, resolveManeuver, endOfRoundShip, publicContacts, scenePositionForBand,
} from './spaceCombatRules.js';

/** Contacto enemigo vacío (el Keeper rellena casco/Evasion/armas; los jugadores no lo ven). */
export function newContact({ id, name = 'Contacto sin identificar', band = 'Standard', heading = 0 } = {}) {
  return {
    id: id || `contact-${Date.now().toString(36)}`,
    name,
    band,
    heading,
    hull: 22,
    maxHull: 22,
    evasionBase: 12,
    heat: 0,
    heatCap: 12,
    armorSlots: { fore: 6, starboard: 6, aft: 6, port: 6, maxPerArc: 6 },
    weapons: [
      { name: 'Pulse Cannon', damage: '2d8+1', band: 'Engagement', tags: ['Energy'] },
      { name: 'Light Missile', damage: '3d6+1', band: 'Standard', tags: ['Guided'] },
    ],
    sensorLock: false,
    visibleDamage: false,
    burning: false,
  };
}

/** Estado de combate inicial para state.starship.combat. */
export function newCombatState() {
  return {
    active: false,
    round: 1,
    engineMode: 'Cruise',
    stationsDone: [],          // puestos que ya gastaron su Spotlight en la ronda
    exposedArcs: [],           // [{ shipId, arc, untilPilotSpotlight }]
    pilotEvasionModifier: 0,   // +2 evasiva / −1 agresiva hasta el próximo Spotlight del Piloto
    gunnerBonus: 0,            // +1 tras Aggressive Approach
    advantageNextShot: false,  // crítico o Flanking
    targetContactId: null,
    contacts: [],              // naves enemigas (Keeper ve todo; snapshot filtra)
  };
}

/** Fusiona un estado guardado antiguo con el nuevo esquema (migración suave). */
export function withCombatDefaults(starship) {
  const base = newCombatState();
  const combat = { ...base, ...(starship?.combat || {}) };
  combat.contacts = (combat.contacts || []).map((c) => ({ ...newContact(c), ...c }));
  combat.stationsDone = Array.isArray(combat.stationsDone) ? combat.stationsDone : [];
  combat.exposedArcs = Array.isArray(combat.exposedArcs) ? combat.exposedArcs : [];
  return { ...starship, combat };
}

/** ¿Qué banda tendrá la nave si la maniobra tiene éxito? (nave fantasma pre-tirada). */
export function ghostBandFor(maneuverName, currentBand) {
  const m = MANEUVERS[maneuverName];
  if (!m) return currentBand;
  return bandAfterManeuver(currentBand, m.bandDelta || 0);
}

/** Aplica el resultado de una tirada de maniobra al estado de combate + banda de la nave. */
export function applyManeuverResult(combat, starship, { maneuverName, total, hope, fear, declaredArc = null }) {
  const dc = MANEUVERS[maneuverName]?.dc ?? 10;
  const effect = resolveManeuver({ total, hope, fear, dc, maneuverName, engineMode: combat.engineMode, declaredArc });
  const next = structuredClone(combat);
  const shipPatch = {};
  if (effect.bandChange) shipPatch.rangeBand = bandAfterManeuver(starship.rangeBand, effect.bandChange);
  if (effect.heatDelta) shipPatch.heat = Math.min((starship.heatCap ?? 10), starship.heat + effect.heatDelta);
  if (effect.exposedArc) next.exposedArcs.push({ shipId: 'own', arc: effect.exposedArc, untilPilotSpotlight: true });
  if (effect.primaryDriveIntegrityLoss) {
    shipPatch.systems = { ...(starship.systems || {}), 'Primary Drive': Math.max(0, (starship.systems?.['Primary Drive'] ?? 3) - 1) };
  }
  // Efectos persistentes de la maniobra (solo si afectó a la posición/actitud).
  if (effect.outcome === 'success' || effect.outcome === 'critical') {
    const m = MANEUVERS[maneuverName];
    next.pilotEvasionModifier = m.evasionBonus || (m.evasionPenalty ? -m.evasionPenalty : 0);
    next.gunnerBonus = m.gunnerBonus || 0;
    if (maneuverName === 'Evasive Pattern') {
      for (const c of next.contacts) c.sensorLock = false; // rompe locks enemigos por evasión
    }
  }
  if (effect.advantageNextShot) next.advantageNextShot = true;
  next.stationsDone = [...new Set([...next.stationsDone, 'pilot'])];
  return { combat: next, shipPatch, effect };
}

/** Sensor Lock sobre un contacto (Knowledge DC por banda). */
export function applySensorLock(combat, { contactId, band, total }) {
  const dc = SENSOR_LOCK_DC[band] ?? 10;
  const locked = total >= dc;
  const next = structuredClone(combat);
  const contact = next.contacts.find((c) => c.id === contactId);
  if (contact) contact.sensorLock = locked;
  next.stationsDone = [...new Set([...next.stationsDone, 'sensors'])];
  return { combat: next, locked, dc };
}

/** Fin de ronda: regeneración de arcos, disipación de calor y avance de efectos. */
export function advanceCombatRound(combat, starship) {
  const shipEnd = endOfRoundShip({ shieldArcs: starship.shieldArcs, firedThisRound: starship.firedThisRound, heat: starship.heat });
  const next = structuredClone(combat);
  next.round += 1;
  next.stationsDone = [];
  next.exposedArcs = [];
  next.pilotEvasionModifier = 0;
  next.gunnerBonus = 0;
  next.advantageNextShot = false;
  for (const c of next.contacts) {
    c.armorSlots = { ...c.armorSlots, ...Object.fromEntries(ARCS.map((a) => [a, Math.min(c.armorSlots.maxPerArc ?? 6, (c.armorSlots[a] || 0) + 2)])) };
    if (!c.firedThisRound) c.heat = Math.max(0, c.heat - 1);
  }
  return { combat: next, shipPatch: { ...shipEnd, firedThisRound: false, visible: false } };
}

/** Anunciar modo de motor al inicio de la ronda (cuesta Calor). */
export function announceEngineMode(combat, starship, mode) {
  if (!ENGINE_MODES[mode]) return { combat, shipPatch: {} };
  const next = structuredClone(combat);
  next.engineMode = mode;
  return { combat: next, shipPatch: { heat: Math.min(starship.heatCap ?? 10, starship.heat + ENGINE_MODES[mode].heatOnAnnounce) } };
}

/** Vista pública del combate para jugadores (privacidad: sin datos ocultos del enemigo). */
export function publicCombatView(combat) {
  return {
    active: combat.active,
    round: combat.round,
    engineMode: combat.engineMode,
    stationsDone: combat.stationsDone,
    exposedArcs: combat.exposedArcs.filter((e) => e.shipId === 'own'),
    targetContactId: combat.targetContactId,
    contacts: publicContacts(combat.contacts),
  };
}

/** Reexporta para la escena 3D (lazy import desde UI). */
export { RANGE_BANDS, scenePositionForBand };
