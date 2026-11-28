// src/spaceCombatRules.js
// PROJECT ARES — Motor de reglas del combate espacial 3D (Veilfarers Corebook, cap. Starship Combat).
// Módulo puro y determinista: sin DOM ni red. Lo consumen starshipManager.js, la escena 3D
// (spaceScene3d.js) y las pruebas unitarias. Definiciones según PROJECTARES/Combate_espacial_3D_propuesta.pdf.

/** Las cinco bandas de distancia. La posición en la escena se deriva de la banda; los km son decorativos. */
export const RANGE_BANDS = ['Adjacent', 'Engagement', 'Standard', 'Long', 'Extreme'];

/** DC de Sensor Lock por banda (regla del Corebook). */
export const SENSOR_LOCK_DC = { Adjacent: 5, Engagement: 10, Standard: 15, Long: 20, Extreme: 25 };

/** Etiqueta de km mostrada como texto; nunca es un valor continuo de reglas. */
export const BAND_LABEL_KM = {
  Adjacent: '0–100 m',
  Engagement: '100 m–5 km',
  Standard: '5–50 km',
  Long: '50–500 km',
  Extreme: '500–5.000 km',
};

/** Los cuatro arcos de cada nave. */
export const ARCS = ['fore', 'starboard', 'aft', 'port'];

/** Modos de motor anunciados al inicio de la ronda. */
export const ENGINE_MODES = {
  Cruise: { evasion: 0, maneuver: 0, heatOnAnnounce: 0 },
  Combat: { evasion: 1, maneuver: 1, heatOnAnnounce: 1 },
  Overdrive: { evasion: 2, maneuver: 2, heatOnAnnounce: 3 },
};

/** Maniobras del Piloto: Instinct + modificadores, DC y efecto canónico. */
export const MANEUVERS = {
  'Close Range': { dc: 10, bandDelta: -1, desc: 'Una banda hacia dentro.' },
  'Open Range': { dc: 10, bandDelta: +1, desc: 'Una banda hacia fuera.' },
  'Evasive Pattern': { dc: 10, dcUnderFire: 15, bandDelta: 0, evasionBonus: 2, bonusUntilPilotSpotlight: true, desc: 'Mantiene la banda; +2 Evasion hasta el próximo Spotlight del Piloto. Rompe un Sensor Lock enemigo.' },
  'Aggressive Approach': { dc: 10, bandDelta: -1, gunnerBonus: 1, evasionPenalty: 1, exposesArc: 'fore', desc: 'Cierra una banda; +1 a los Artilleros y −1 Evasion. Arco declarado: Proa.' },
  'Broadside': { dc: 10, bandDelta: 0, exposesArc: 'port|starboard', allMountsFire: true, desc: 'Mantiene la banda; Babor o Estribor queda expuesto y disparan todas sus monturas.' },
  'Flanking': { dc: 15, bandDelta: 0, marksTargetArc: true, advantageNextShot: true, desc: 'Se nombra un arco del objetivo; el siguiente disparo antes del próximo Spotlight del Piloto tiene Ventaja y va a ese arco.' },
  'Disengage': { dc: 10, bandDelta: +1, breaksContactInLongOrExtreme: true, desc: 'Abre una banda; en Long o Extreme el contacto termina, salvo persecución.' },
};

/** Tabla de daño al casco: puntos más allá de los Armor Slots → cascos perdidos. */
export const HULL_DAMAGE_TABLE = [
  { maxDamage: 5, hullLoss: 1 },
  { maxDamage: 12, hullLoss: 2 },
  { maxDamage: 20, hullLoss: 3 },
  { maxDamage: 30, hullLoss: 4 },
];

export function hullLossFor(leftoverDamage) {
  if (leftoverDamage <= 0) return 0;
  for (const row of HULL_DAMAGE_TABLE) if (leftoverDamage <= row.maxDamage) return row.hullLoss;
  return 5 + Math.floor((leftoverDamage - 30) / 10);
}

export function bandIndex(band) {
  const i = RANGE_BANDS.indexOf(band);
  return i === -1 ? 1 : i; // desconocido → Engagement (banda normal)
}

/** Aplica el desplazamiento de banda de una maniobra (sin pasar de Extreme, mínimo Adjacent). */
export function bandAfterManeuver(band, bandDelta) {
  const next = Math.max(0, Math.min(RANGE_BANDS.length - 1, bandIndex(band) + bandDelta));
  return RANGE_BANDS[next];
}

/** ¿La DC de la maniobra sube a 15? (bajo fuego o peligro activo). */
export function maneuverDC(maneuverName, { underFire = false, inHazard = false } = {}) {
  const m = MANEUVERS[maneuverName];
  if (!m) return null;
  if (m.dcUnderFire && (underFire || inHazard)) return m.dcUnderFire;
  return m.dc;
}

/** Desglose de Evasion mostrado en la ficha: base + tripulante + motor + efectos de maniobra. */
export function evasionBreakdown({ base = 0, crew = 0, engineMode = 'Cruise', maneuverBonus = 0 } = {}) {
  const engine = ENGINE_MODES[engineMode]?.evasion ?? 0;
  const parts = [
    { label: 'Base', value: base },
    ...(crew ? [{ label: 'Tripulante', value: crew }] : []),
    ...(engine ? [{ label: `Motor (${engineMode})`, value: engine }] : []),
    ...(maneuverBonus ? [{ label: 'Maniobra', value: maneuverBonus }] : []),
  ];
  return { parts, total: parts.reduce((sum, p) => sum + p.value, 0) };
}

/** Anunciar modo de motor: devuelve el calor añadido al inicio de la ronda. */
export function engineHeatCost(engineMode) {
  return ENGINE_MODES[engineMode]?.heatOnAnnounce ?? 0;
}

/** El arma puede disparar a esta banda (etiquetas [Long-Range]/[Extreme] y guía). */
export function weaponCanFireAtBand(weapon, band) {
  const cur = bandIndex(band);
  // Banda mínima: la etiqueta `band` del arma es su alcance *mínimo* de uso normal.
  const min = bandIndex(weapon?.minBand ?? 'Engagement');
  if (cur < min) return { ok: false, reason: 'fuera de alcance' };
  // Alcance máximo: más allá de su banda sin etiquetas de largo alcance, no dispara.
  const max = bandIndex(weapon?.maxBand ?? weapon?.band ?? 'Extreme');
  const tags = weapon?.tags || [];
  const longish = tags.includes('Long') || tags.includes('Long-Range');
  if (cur > max && !longish) return { ok: false, reason: 'fuera de alcance' };
  if (band === 'Long' && !(longish || cur <= max)) return { ok: false, reason: 'requiere [Long-Range]' };
  if (band === 'Long' && longish === false && cur > max) return { ok: false, reason: 'requiere [Long-Range]' };
  if (band === 'Extreme') {
    if (!tags.includes('Extreme') && !longish) return { ok: false, reason: 'requiere [Extreme] o [Long-Range]' };
    if (!weapon?.sensorLock) return { ok: false, reason: 'necesita Sensor Lock' };
    if (longish && !tags.includes('Extreme')) return { ok: true, disadvantage: true };
  }
  if (band === 'Adjacent' && !(weapon?.adjacent || tags.includes('Point-Blank'))) return { ok: false, reason: 'el arma no dispara a quemarropa' };
  return { ok: true };
}

/** Resultado de la tirada de maniobra según Hope/Fear y diana. */
export function resolveManeuver({ total, hope, fear, dc, maneuverName, engineMode = 'Cruise', declaredArc = null }) {
  const m = MANEUVERS[maneuverName];
  if (!m) throw new Error(`Maniobra desconocida: ${maneuverName}`);
  const success = total >= dc;
  const critical = success && hope > fear;
  const outcome = critical ? 'critical' : success ? 'success' : fear > hope ? 'fear' : 'hope';
  const effect = { outcome, bandChange: 0, heatDelta: 0, exposedArc: null, evasionModifier: 0, gunnerBonus: 0, advantageNextShot: false, primaryDriveIntegrityLoss: 0 };
  if (outcome === 'critical') {
    effect.bandChange = m.bandDelta || 0;
    effect.advantageNextShot = true;
  } else if (outcome === 'success') {
    effect.bandChange = m.bandDelta || 0;
  } else {
    // Fallo (Hope o Fear): la banda y el rumbo no cambian.
    if (outcome === 'fear') {
      effect.heatDelta = 1;
      const arc = declaredArc || (m.exposesArc && m.exposesArc !== 'port|starboard' ? m.exposesArc : 'fore');
      if (engineMode === 'Overdrive') effect.primaryDriveIntegrityLoss = 1;
      else effect.exposedArc = arc;
    }
  }
  if (effect.bandChange || outcome === 'success' || outcome === 'critical') {
    if (m.evasionPenalty) effect.evasionModifier -= m.evasionPenalty;
    if (m.gunnerBonus) effect.gunnerBonus = m.gunnerBonus;
  }
  if (m.evasionBonus && (outcome === 'success' || outcome === 'critical')) effect.evasionModifier += m.evasionBonus;
  if (m.advantageNextShot && (outcome === 'success' || outcome === 'critical')) effect.advantageNextShot = true;
  return effect;
}

/** Sensor Lock: Knowledge sin modificar contra la DC de la banda. Uno por objetivo. */
export function resolveSensorLock({ total, dc, success }) {
  const ok = success ?? total >= dc;
  return { locked: ok, grantsAdvantage: ok };
}

/** Un lock se mantiene al cerrar banda; solo se rompe abriendo en Long/Extreme, o con evasiva. */
export function lockSurvivesManeuver(lockHolderBandBefore, lockHolderBandAfter, maneuverName) {
  if (maneuverName === 'Evasive Pattern') return false;
  const opened = bandIndex(lockHolderBandAfter) > bandIndex(lockHolderBandBefore);
  if (!opened) return true;
  return !(bandIndex(lockHolderBandAfter) >= bandIndex('Long'));
}

/** Daño naval final: primero Armor Slots del arco, resto al casco. Crítico declara sistema. */
export function resolveNavalDamage({ rawDice, mountRating = 2, armorSlots = 0, isCritical = false, declaredSystem = null }) {
  const total = Math.max(0, Math.round(rawDice * mountRating));
  const absorbed = Math.min(armorSlots, total);
  const leftover = total - absorbed;
  const hullLoss = hullLossFor(leftover);
  return {
    totalDamage: total,
    absorbedByArc: absorbed,
    toHull: leftover,
    hullLoss,
    systemIntegrityLoss: isCritical && hullLoss > 0 && declaredSystem ? 1 : 0,
  };
}

/** Fin de ronda: +2 Armor Slots por arco (hasta máx), −1 Calor si no se disparó. */
export function endOfRoundShip({ shieldArcs, firedThisRound, heat }) {
  const max = shieldArcs.maxPerArc ?? 4;
  const regen = (v) => Math.min(max, (v || 0) + 2);
  return {
    shieldArcs: { fore: regen(shieldArcs.fore), starboard: regen(shieldArcs.starboard), aft: regen(shieldArcs.aft), port: regen(shieldArcs.port), maxPerArc: max },
    heat: firedThisRound ? heat : Math.max(0, heat - 1),
  };
}

/** Nave al límite: Casco 1–2 → Desventaja; Casco 0 → Dying. */
export function shipCriticalState(hull) {
  if (hull <= 0) return 'dying';
  if (hull <= 2) return 'disadvantage';
  return 'normal';
}

/** Orden de la ronda: quién tiene el Spotlight. */
export const ROUND_STATIONS = ['captain', 'pilot', 'gunner', 'engineer', 'sensors', 'keeper'];

/** Posición decorativa (plano XZ) derivada de la banda: anillos centrados en el objetivo. */
export function scenePositionForBand(band, angleDeg = 0, scale = 1) {
  const radiusByBand = { Adjacent: 1.2, Engagement: 3, Standard: 6, Long: 10, Extreme: 15 };
  const r = (radiusByBand[band] ?? 6) * scale;
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, radius: r };
}

/**
 * Privacidad: proyección de contactos para jugadores.
 * El jugador no ve casco, Evasion ni Armor Slots del enemigo: solo banda, lock y daños visibles.
 */
export function publicContacts(contacts = []) {
  return contacts.map((c) => ({
    id: c.id,
    name: c.name,
    band: c.band,
    heading: c.heading ?? 0,
    hasSensorLock: !!c.sensorLock,
    visibleDamage: c.visibleDamage ?? false,
    burning: !!c.burning,
  }));
}
