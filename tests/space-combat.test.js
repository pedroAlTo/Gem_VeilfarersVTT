// PROJECT ARES — Pruebas del motor de combate espacial 3D (reglas del Corebook, cap. Starship Combat).
import assert from 'node:assert/strict';
import { test } from 'node:test';

const rules = await import('../src/spaceCombatRules.js');
const state = await import('../src/spaceCombatState.js');

test('bandas: una maniobra con éxito mueve una banda; Aggressive Approach 12 km Standard → Engagement', () => {
  assert.equal(rules.bandAfterManeuver('Standard', -1), 'Engagement');
  assert.equal(rules.bandAfterManeuver('Engagement', -1), 'Adjacent');
  assert.equal(rules.bandAfterManeuver('Adjacent', -1), 'Adjacent'); // no baja de Adjacent
  assert.equal(rules.bandAfterManeuver('Extreme', +1), 'Extreme');   // no sube de Extreme
});

test('DC de Sensor Lock por banda según el Corebook', () => {
  assert.deepEqual(rules.SENSOR_LOCK_DC, { Adjacent: 5, Engagement: 10, Standard: 15, Long: 20, Extreme: 25 });
});

test('modo de motor: desglose de Evasion y calor al anunciar', () => {
  const ev = rules.evasionBreakdown({ base: 12, crew: 2, engineMode: 'Combat' });
  assert.equal(ev.total, 15); // 12 + 2 tripulante + 1 motor (Paso 1 de la maqueta: Evasion 15)
  assert.equal(rules.engineHeatCost('Combat'), 1);
  assert.equal(rules.engineHeatCost('Overdrive'), 3);
  assert.equal(rules.engineHeatCost('Cruise'), 0);
});

test('maniobra con éxito (Aggressive Approach): cierra banda, +1 artilleros, −1 Evasion', () => {
  const e = rules.resolveManeuver({ total: 15, hope: 2, fear: 1, dc: 10, maneuverName: 'Aggressive Approach' });
  assert.ok(e.outcome === 'success' || e.outcome === 'critical');
  assert.equal(e.bandChange, -1);
  assert.equal(e.gunnerBonus, 1);
  assert.equal(e.evasionModifier, -1); // Evasion 14 tras la maniobra (Paso 2)
});

test('fallo con Fear: sin cambio de banda, +1 Calor y arco Exposed', () => {
  const e = rules.resolveManeuver({ total: 9, hope: 0, fear: 2, dc: 10, maneuverName: 'Aggressive Approach', declaredArc: 'fore' });
  assert.equal(e.outcome, 'fear');
  assert.equal(e.bandChange, 0);
  assert.equal(e.heatDelta, 1);
  assert.equal(e.exposedArc, 'fore');
});

test('fallo con Fear en Overdrive: Primary Drive −1 Integrity en lugar de exponer arco', () => {
  const e = rules.resolveManeuver({ total: 9, hope: 0, fear: 2, dc: 10, maneuverName: 'Close Range', engineMode: 'Overdrive' });
  assert.equal(e.exposedArc, null);
  assert.equal(e.primaryDriveIntegrityLoss, 1);
});

test('crítico de maniobra: además Ventaja en el próximo disparo', () => {
  const e = rules.resolveManeuver({ total: 20, hope: 3, fear: 0, dc: 10, maneuverName: 'Close Range' });
  assert.equal(e.outcome, 'critical');
  assert.equal(e.advantageNextShot, true);
});

test('daño del ejemplo del libro: 2d10=14 × MR2 = 28; Proa absorbe 6, resto 22 → −4 casco', () => {
  const d = rules.resolveNavalDamage({ rawDice: 14, mountRating: 2, armorSlots: 6 });
  assert.equal(d.totalDamage, 28);
  assert.equal(d.absorbedByArc, 6);
  assert.equal(d.toHull, 22);
  assert.equal(d.hullLoss, 4); // Skarrh 22 → 18
});

test('tabla de casco: 1–5→1, 6–12→2, 13–20→3, 21–30→4, 31+→5 (+1/10)', () => {
  assert.equal(rules.hullLossFor(4), 1);
  assert.equal(rules.hullLossFor(10), 2);
  assert.equal(rules.hullLossFor(16), 3);
  assert.equal(rules.hullLossFor(22), 4);
  assert.equal(rules.hullLossFor(31), 5);
  assert.equal(rules.hullLossFor(41), 6);
  assert.equal(rules.hullLossFor(0), 0);
});

test('crítico con sistema declarado quita casco → sistema −1 Integrity', () => {
  const d = rules.resolveNavalDamage({ rawDice: 14, mountRating: 2, armorSlots: 0, isCritical: true, declaredSystem: 'Weapons' });
  assert.equal(d.systemIntegrityLoss, 1);
  const noCasco = rules.resolveNavalDamage({ rawDice: 2, mountRating: 1, armorSlots: 6, isCritical: true, declaredSystem: 'Weapons' });
  assert.equal(noCasco.systemIntegrityLoss, 0); // absorbido entero: no quita casco
});

test('alcance de armas: Light Plasma (Engagement) puede disparar en Engagement pero no en Standard', () => {
  const w = { band: 'Engagement', tags: ['Energy'] };
  assert.equal(rules.weaponCanFireAtBand(w, 'Engagement').ok, true);
  assert.equal(rules.weaponCanFireAtBand(w, 'Standard').ok, false);
});

test('Extreme requiere lock y da Desventaja con [Long-Range]', () => {
  const lr = { band: 'Engagement', tags: ['Long-Range'] };
  assert.equal(rules.weaponCanFireAtBand(lr, 'Extreme').ok, false); // sin lock
  assert.equal(rules.weaponCanFireAtBand({ ...lr, sensorLock: true }, 'Extreme').disadvantage, true);
});

test('Sensor Lock: Knowledge sin modificar contra DC de la banda; romper abriendo a Long', () => {
  assert.equal(rules.resolveSensorLock({ total: 14, dc: 10 }).locked, true);
  assert.equal(rules.lockSurvivesManeuver('Engagement', 'Standard', 'Open Range'), true);
  assert.equal(rules.lockSurvivesManeuver('Standard', 'Long', 'Open Range'), false);
  assert.equal(rules.lockSurvivesManeuver('Engagement', 'Engagement', 'Evasive Pattern'), false);
});

test('fin de ronda: +2 Armor Slots por arco y −1 Calor si no se disparó', () => {
  const r = rules.endOfRoundShip({ shieldArcs: { fore: 2, starboard: 4, aft: 0, port: 1, maxPerArc: 4 }, firedThisRound: false, heat: 3 });
  assert.deepEqual(r.shieldArcs, { fore: 4, starboard: 4, aft: 2, port: 3, maxPerArc: 4 });
  assert.equal(r.heat, 2);
  const fired = rules.endOfRoundShip({ shieldArcs: { fore: 2, starboard: 2, aft: 2, port: 2, maxPerArc: 4 }, firedThisRound: true, heat: 3 });
  assert.equal(fired.heat, 3); // sin enfriamiento pasivo
});

test('nave al límite: Casco 1–2 Desventaja, 0 Dying', () => {
  assert.equal(rules.shipCriticalState(2), 'disadvantage');
  assert.equal(rules.shipCriticalState(3), 'normal');
  assert.equal(rules.shipCriticalState(0), 'dying');
});

test('estado: applyManeuverResult marca el puesto Piloto como hecho (Spotlight usado)', () => {
  const combat = state.newCombatState();
  const ship = { rangeBand: 'Standard', heat: 1, heatCap: 10, systems: { 'Primary Drive': 3 } };
  const applied = state.applyManeuverResult(combat, ship, { maneuverName: 'Aggressive Approach', total: 15, hope: 1, fear: 0 });
  assert.ok(applied.combat.stationsDone.includes('pilot'));
  assert.equal(applied.shipPatch.rangeBand, 'Engagement');
  assert.equal(applied.combat.gunnerBonus, 1);
});

test('estado: fallo con Fear sube calor y expone arco propio', () => {
  const combat = state.newCombatState();
  const ship = { rangeBand: 'Standard', heat: 1, heatCap: 10, systems: {} };
  const applied = state.applyManeuverResult(combat, ship, { maneuverName: 'Aggressive Approach', total: 9, hope: 0, fear: 2 });
  assert.equal(applied.shipPatch.heat, 2); // 1 → 2/10 (variante del PDF)
  assert.deepEqual(applied.combat.exposedArcs, [{ shipId: 'own', arc: 'fore', untilPilotSpotlight: true }]);
  assert.equal(applied.shipPatch.rangeBand, undefined);
});

test('estado: Sensor Lock sobre contacto y fin de ronda limpia efectos', () => {
  let combat = state.newCombatState();
  combat.contacts = [state.newContact({ id: 'skarrh', name: 'Crimson Skarrh', band: 'Engagement' })];
  combat.targetContactId = 'skarrh';
  const locked = state.applySensorLock(combat, { contactId: 'skarrh', band: 'Engagement', total: 14 });
  assert.equal(locked.combat.contacts[0].sensorLock, true);
  assert.ok(locked.combat.stationsDone.includes('sensors'));
  const ship = { shieldArcs: { fore: 1, starboard: 2, aft: 3, port: 4, maxPerArc: 4 }, firedThisRound: true, heat: 4 };
  const next = state.advanceCombatRound(locked.combat, ship);
  assert.equal(next.combat.round, 2);
  assert.deepEqual(next.combat.stationsDone, []);
  assert.equal(next.combat.contacts[0].armorSlots.fore, 6); // regen +2 hasta máx 6
  assert.equal(next.shipPatch.shieldArcs.fore, 3);
});

test('privacidad: publicContacts oculta casco, Evasion y Armor Slots al jugador', () => {
  const c = state.newContact({ id: 'x', name: 'Skarrh', band: 'Standard' });
  const pub = rules.publicContacts([c])[0];
  assert.equal(pub.hull, undefined);
  assert.equal(pub.evasionBase, undefined);
  assert.equal(pub.armorSlots, undefined);
  assert.equal(pub.weapons, undefined);
  assert.equal(pub.band, 'Standard');
  assert.equal(pub.hasSensorLock, false);
});

test('privacidad: publicCombatView soloExpose arcos propios', () => {
  let combat = state.newCombatState();
  combat.exposedArcs = [{ shipId: 'own', arc: 'fore' }, { shipId: 'enemy1', arc: 'aft' }];
  const view = state.publicCombatView(combat);
  assert.deepEqual(view.exposedArcs.map((e) => e.shipId), ['own']);
});

test('escena: la posición sale de la banda (km/altura decorativos)', () => {
  const p1 = rules.scenePositionForBand('Engagement');
  const p2 = rules.scenePositionForBand('Extreme');
  assert.ok(p2.radius > p1.radius);
  assert.equal(rules.scenePositionForBand('Standard').radius, 6);
});

test('migración suave: starship antiguo sin combat recibe defaults', () => {
  const migrated = state.withCombatDefaults({ name: 'Vagrant Star', hull: 14 });
  assert.equal(migrated.combat.round, 1);
  assert.equal(migrated.combat.engineMode, 'Cruise');
  assert.deepEqual(migrated.combat.contacts, []);
});
