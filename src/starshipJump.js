import { requireActive, roundKey } from './combatState.js';
import { newId } from './persistence.js';

export function shipWithChanges(ship, patch) {
  const next = { ...ship, ...patch };
  if (ship.heat <= ship.heatCap && next.heat > next.heatCap) {
    next.systems = Object.fromEntries(Object.entries(next.systems || {}).map(([key, value]) => [key, Math.max(0, value - 1)]));
    next.visible = true;
    next.heatCheckPending = true;
  }
  return next;
}

// The table settles the check and the ship state in the same synchronous action.
// The solution ID also keeps late commands from consuming a different solution.
export function resolveJump(store, actor, action, check) {
  const ship = store.state.starship, map = store.getActiveMap(), round = roundKey(map);
  const calculate = action.step === 'calculate', solution = ship.jump;
  requireActive(actor);
  if (actor.isPlayer === false || actor.actorType === 'drone' || actor.mapId !== map.id) throw new Error('Selecciona un tripulante de la escena.');
  if (ship.pearls < 1 || solution?.phase === 'transit') throw new Error('La nave no puede iniciar otro salto.');
  if (action.turn != null && action.turn !== round) throw new Error('La ronda ha cambiado. Revisa el Spotlight actual.');
  if (actor.ftlRound === round) throw new Error('Este tripulante ya ha usado su Spotlight para el salto en esta ronda.');
  if (calculate ? !!solution : action.step !== 'initiate' || !solution || solution.id !== action.solutionId || solution.mapId !== map.id)
    throw new Error('La solución de salto ha cambiado. Revisa el panel de la nave.');
  const destination = calculate ? String(action.destination || '').trim() : solution.destination;
  if (!destination || destination.length > 120) throw new Error('Indica el destino del salto (máximo 120 caracteres).');
  const dc = calculate && action.underFire ? 15 : 10;
  const result = check({ type: 'CHECK', actorId: actor.id, options: { traitId: calculate ? 'knowledge' : 'instinct', dc, criticalChoice: action.criticalChoice } }, store);
  const success = result.isCritical || result.total >= dc;
  const shipPatch = {};
  let detail;
  if (calculate && success) {
    shipPatch.jump = { id: newId(), phase: 'ready', destination, mapId: map.id };
    detail = 'Solución calculada';
  } else if (success) {
    shipPatch.pearls = ship.pearls - 1;
    shipPatch.jump = { ...solution, phase: 'transit' };
    detail = 'Salto iniciado · −1 Pearl';
  } else {
    detail = calculate ? 'Sin solución de salto' : 'La nave sigue en el espacio normal';
    if (result.dominance === 'Fear') {
      if (calculate) { shipPatch.heat = ship.heat + 1; detail += ' · +1 Heat'; }
      else {
        shipPatch.systems = { ...ship.systems, 'Primary Drive': Math.max(0, (ship.systems?.['Primary Drive'] ?? 3) - 1) };
        detail += ' · −1 Integrity (Primary Drive)';
      }
    }
  }
  store.updateToken(actor.id, { ftlRound: round });
  store.setTokenSpotlight(actor.id, true);
  store.update({ starship: shipWithChanges(ship, shipPatch) });
  store.addLog({ sender: actor.name, type: 'FTL', title: detail, details: destination + ' · ' + result.outcomeTitle });
  return { ...result, jumpOutcome: detail };
}
