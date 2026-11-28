import { requireActive, nextSpotlightRound } from '../combatState.js';
import { shipWithChanges } from '../starshipJump.js';
import { rollAdversaryCheck } from '../attackFlow.js';
import { ARCS, BANDS, ROLES, DRIVES, MOVES, WEAPONS, FRIENDLY_WEAPONS, crewEligible, crewMember, crewEvasion, applyImpact, moveBand, sensorDC, inRange } from './encounter.js';

const demand = (condition, message) => { if (!condition) throw new Error(message); };
const has = (record, key) => typeof key === 'string' && Object.hasOwn(record, key);
const die = sides => Math.floor(Math.random() * sides) + 1;
const keeper = store => store.sessionRole !== 'player' && store.state.userRole === 'keeper';
const heat = (ship, amount) => Object.assign(ship, shipWithChanges(ship, { heat: Math.max(0, ship.heat + amount) }));
function recover(ship) {
  for (const arc of Object.keys(ARCS)) ship.shieldArcs[arc] = Math.min(ship.shieldArcs.maxPerArc, ship.shieldArcs[arc] + 2);
  if (!ship.firedThisRound) heat(ship, -1);
  ship.firedThisRound = false;
  ship.visible = false;
}
function announceDrive(n, ship, mode) {
  demand(!n.drive && has(DRIVES, mode), 'El motor ya se ha anunciado o el modo es inválido.');
  n.drive = mode;
  heat(ship, DRIVES[mode].heat);
  return 'Motor ' + mode;
}
function rollDamage(weapon, rating, critical, npc, randomDie) {
  const qty = weapon.qty * (critical && !npc ? 2 : 1);
  let sum = weapon.flat;
  for (let i = 0; i < qty; i++) sum += critical && npc ? weapon.sides : randomDie(weapon.sides);
  return sum * rating;
}
function pilotTurn({ n, ship, contact, action, check }) {
  demand(has(MOVES, action.move) && has(ARCS, action.arc), 'Elige una maniobra y su arco.');
  const move = MOVES[action.move], dest = moveBand(contact.band, move.step);
  demand(dest, 'La maniobra excede las bandas del encuentro.');
  if (action.move === 'broadside') demand(['port','starboard'].includes(action.arc), 'La andanada requiere Babor o Estribor.');
  const dc = action.move === 'evade' && action.underFire ? 15 : move.dc;
  const result = check('instinct', dc, DRIVES[n.drive].bonus);
  n.pilotEffect = n.pilotEffect.aim ? { aim: true } : {}; // critical aim lasts until the next shot
  let message = move.name + ' · ' + contact.band;
  if (result.isCritical || result.total >= dc) {
    contact.band = dest;
    ship.rangeBand = dest;
    n.heading = action.arc;
    if (action.move === 'aggressive') Object.assign(n.pilotEffect, { evasion: -1, attack: 1 });
    if (action.move === 'evade') n.pilotEffect.evasion = 2;
    if (action.move === 'broadside') n.pilotEffect.exposed = action.arc;
    if (action.move === 'flank') { n.pilotEffect.flankId = contact.id; n.pilotEffect.flankArc = action.arc; }
    if (result.isCritical) n.pilotEffect.aim = true;
    message = move.name + ' · ' + dest;
  } else if (result.dominance === 'Fear') {
    heat(ship, 1);
    if (n.drive === 'Overdrive') {
      ship.systems['Primary Drive'] = Math.max(0, (ship.systems['Primary Drive'] ?? 3) - 1);
      message += ' · +1 Calor · Primary Drive −1';
    } else {
      n.pilotEffect.exposed = action.arc;
      message += ' · +1 Calor · ' + ARCS[action.arc] + ' expuesto';
    }
  }
  return { result, message };
}
function crewTurn(ctx) {
  const { n, ship, contact, action, check, randomDie } = ctx;
  if (action.station === 'engineer') {
    const vent = action.order === 'vent';
    demand(vent || action.order === 'cool', 'Elige una operación de Ingeniería.');
    heat(ship, vent ? -5 : -3);
    if (vent) ship.visible = true;
    return { message: (vent ? 'Venteo' : 'Enfriar sistemas') + ' · Calor ' + ship.heat + '/' + ship.heatCap };
  }
  demand(contact?.kind === 'ship' && !contact.hidden && contact.privateShip?.hull > 0, 'Elige una nave activa como objetivo.');
  if (action.station === 'pilot') return pilotTurn(ctx);
  if (action.station === 'sensors') {
    demand(ship.systems['Sensor Array'] > 0, 'El Sensor Array está fuera de servicio.');
    const dc = sensorDC(contact.band);
    const result = check('knowledge', dc, 0);
    if (result.isCritical || result.total >= dc) contact.locked = true;
    return { result, message: contact.name + (contact.locked ? ' · Sensor Lock' : ' · sin fijación') };
  }
  demand(action.station === 'gunner' && FRIENDLY_WEAPONS.includes(action.weapon) && has(ARCS, action.arc), 'Selecciona montura y arco del objetivo.');
  demand(ship.systems.Weapons > 0, 'El sistema de armas está fuera de servicio.');
  const weapon = WEAPONS[action.weapon], target = contact.privateShip;
  demand(inRange(weapon, contact.band), 'Arma fuera de alcance.');
  const flank = n.pilotEffect.flankId === contact.id && n.pilotEffect.flankArc === action.arc;
  const result = check('finesse', target.evasion, n.pilotEffect.attack || 0, contact.locked || n.pilotEffect.aim || flank, true);
  const hit = result.isCritical || result.total >= target.evasion;
  contact.locked = false; delete n.pilotEffect.aim;
  if (flank) { delete n.pilotEffect.flankArc; delete n.pilotEffect.flankId; }
  ship.firedThisRound = true;
  let message = weapon.name + (hit ? ' · impacto en ' : ' · fallo contra ') + contact.name;
  if (hit) {
    const raw = rollDamage(weapon, ship.mountRating, result.isCritical, false, randomDie);
    const impact = applyImpact(target, action.arc, raw);
    if (impact.lost > 0) contact.visibleDamage = true;
    n.impact = { revision: n.revision + 1, source: 'own', target: contact.id, arc: action.arc };
    return { result, message, privateNote: weapon.name + ' · ' + raw + ' de daño · ' + impact.absorbed + ' absorbidos · Casco ' + target.hull + '/' + target.maxHull };
  }
  return { result, message };
}
function keeperTurn({ store, n, ship, contact, action, randomDie }) {
  if (action.order === 'assign') {
    demand(has(ROLES, action.station) && !n.spent[action.station], 'Ese puesto ya actuó.');
    const actor = store.state.tokens.find(t => t.id === action.assignment);
    demand(action.assignment === '' || crewEligible(actor, store.state.activeMapId), 'Selecciona un personaje de la escena.');
    if (actor) {
      const sameMember = id => crewMember(store.state.tokens.find(t => t.id === id)) === crewMember(actor);
      demand(!Object.values(n.spent).some(sameMember), 'Este tripulante ya actuó.');
      for (const role of Object.keys(ROLES)) if (sameMember(n.crew[role])) n.crew[role] = '';
    }
    n.crew[action.station] = action.assignment;
    return { message: ROLES[action.station] + ' · ' + (actor?.name || 'Sin asignar') };
  }
  if (action.order === 'drive') return { message: announceDrive(n, ship, action.drive) };
  if (action.order === 'round') {
    demand(n.drive, 'Anuncia el motor antes de cerrar la ronda.');
    recover(ship);
    for (const c of n.contacts) if (c.privateShip) { recover(c.privateShip); c.privateShip.acted = {}; }
    n.round++; n.spent = {}; n.drive = null;
    nextSpotlightRound(store);
    return { message: 'Ronda ' + n.round };
  }
  demand(!!n.drive && contact?.kind === 'ship' && contact.privateShip?.hull > 0, 'Selecciona la nave enemiga y anuncia el motor.');
  const enemy = contact.privateShip;
  if (action.order === 'enemyCool') {
    demand(!enemy.acted.system, 'La nave ya usó su acción de sistema.');
    heat(enemy,-3); enemy.acted.system = true;
    return { message: contact.name + ' · sistemas' };
  }
  if (action.order === 'enemyMove') {
    demand(!enemy.acted.pilot && ['close','open'].includes(action.move), 'La nave ya maniobró o la maniobra es inválida.');
    const dest = moveBand(contact.band, MOVES[action.move].step);
    demand(dest, 'Fuera de las bandas del encuentro.');
    const result = rollAdversaryCheck({ actorName: contact.name, dc: 10, modifier: 1 });
    enemy.acted.pilot = true;
    if (result.isCritical || result.total >= 10) {
      contact.band = ship.rangeBand = dest;
      if (contact.locked && action.move === 'open') {
        if (['Long','Extreme'].includes(dest)) contact.locked = false;
        else if (dest === 'Standard') {
          const escape = rollAdversaryCheck({ actorName: contact.name, dc: 15 });
          if (escape.isCritical || escape.total >= 15) contact.locked = false;
        }
      }
    }
    return { message: contact.name + ' · ' + contact.band + (contact.locked ? ' · Sensor Lock' : '') };
  }
  demand(action.order === 'enemyFire' && enemy.weapons.includes(action.weapon) && has(ARCS, action.arc), 'Orden de nave desconocida.');
  demand(!enemy.acted[action.weapon], 'La montura ya disparó esta ronda.');
  const weapon = WEAPONS[action.weapon];
  demand(inRange(weapon,contact.band), 'Montura enemiga fuera de alcance.');
  const defense = crewEvasion(ship,n,store.state.tokens);
  const result = rollAdversaryCheck({ actorName: contact.name, dc: defense, modifier: ship.visible ? 2 : 0,
    hasAdvantage: n.pilotEffect.exposed === action.arc });
  enemy.acted[action.weapon] = true; enemy.firedThisRound = true;
  if (!result.isCritical && result.total < defense) return { message: contact.name + ' · disparo fallido' };
  n.impact = { revision: n.revision + 1, source: contact.id, target: 'own', arc: action.arc };
  const hit = applyImpact(ship,action.arc,rollDamage(weapon,enemy.mountRating,result.isCritical,true,randomDie));
  return { message: 'Impacto en ' + ARCS[action.arc] + ' · ' + hit.absorbed + ' absorbidos · −' + hit.lost + ' Casco' };
}

// Commands carry the scene and its last seen revision. An old click or a retry cannot spend a second Spotlight.
export function resolveNavalAction(store, action, resolveCheck, randomDie = die) {
  const map = store.getActiveMap(), current = map?.naval;
  demand(current && map.id === action.mapId && current.revision === action.revision && current.round === action.round, 'La escena o la ronda ha cambiado. Revisa la orden.');
  demand(store.sessionRole !== 'player' && !store.state.roomPaused, 'La sala está en pausa.');
  const n = structuredClone(current), ship = structuredClone(store.state.starship);
  ship.systems ||= { 'Primary Drive': 3, 'Sensor Array': 3, Weapons: 3 };
  const contact = n.contacts.find(c => c.id === action.contactId);
  let turn;
  if (action.type === 'NAVAL_KEEPER') {
    demand(keeper(store), 'Solo el Keeper puede dar esa orden.');
    turn = keeperTurn({ store,n,ship,contact,action,randomDie });
  } else {
    const actor = store.state.tokens.find(t => t.id === action.actorId);
    demand(has(ROLES,action.station) && n.crew[action.station] === actor?.id && crewEligible(actor,map.id), 'Este tripulante no ocupa el puesto.');
    if (store.sessionRole === 'local' && !keeper(store)) demand(store.canEditToken(actor.id), 'Elige tu personaje asignado.');
    requireActive(actor);
    demand(ship.hull > 0, 'La nave está Dying.');
    demand(!n.spent[action.station] && !Object.values(n.spent).some(id => crewMember(store.state.tokens.find(t => t.id === id)) === crewMember(actor)),  'Spotlight usado en esta ronda.');
    if (action.order === 'drive' && action.station === 'pilot') turn = { message: announceDrive(n, ship, action.drive) };
    else {
      demand(!!n.drive, 'Anuncia el modo de motor al inicio de la ronda.');
      const check = (traitId, dc, customMod = 0, advantage = false, concealDC = false) => {
        const faces = action.faces;
        const valid = Array.isArray(faces) && (faces.length === 2 || faces.length === 3) &&
          faces.every((v,i) => Number.isInteger(v) && v >= 1 && v <= (i < 2 ? 12 : 6));
        return resolveCheck({ type: 'CHECK', actorId: actor.id, options: { traitId, dc, customMod, hasAdvantage: !!advantage,
          hasDisadvantage: ship.hull <= 2, criticalChoice: 'resolve',
          ...(valid ? { forcedHope: faces[0], forcedFear: faces[1], forcedAdv: faces[2] } : {}) } }, store, { naval: true, concealDC, unmodified: action.station === 'sensors' });
      };
      if (action.station !== 'engineer') demand(action.order === 'act', 'Orden de puesto desconocida.');
      turn = crewTurn({ n, ship, contact, action, check, randomDie });
      n.spent[action.station] = actor.id;
      if (!turn.result) store.setTokenSpotlight(actor.id,true);
    }
  }
  if (ship.systems['Sensor Array'] === 0) n.contacts.forEach(c => { c.locked = false; });
  const roll = turn.result;
  const comparison = roll && action.station !== 'gunner' ? ' / DC ' + roll.dc : '';
  n.note = turn.message + (roll ? ' · ' + roll.total + comparison : '');
  n.revision++;
  store._beforeTacticalMutation('Combate espacial');
  store.update({ maps: store.state.maps.map(m => m.id === map.id ? { ...m, naval: n } : m), starship: ship });
  store.addLog({ sender: ship.name, type: 'NAVAL', title: turn.message, details: '' });
  if (turn.privateNote) store.addLog({ sender: 'Keeper', type: 'NAVAL', visibility: 'keeper', title: turn.privateNote, details: '' });
  const result = { ...turn.result, navalOutcome: turn.message };
  if (action.type === 'NAVAL_STATION' && action.station === 'gunner') delete result.dc;
  return result;
}
