// A drone in a player's hands (v2.38.0, user decision of 23 Nov 2026; Corebook ch. 14, Neural
// Network Control and «Domain Powers Through a Drone»):
// - selecting a shared drone takes control of it at once (free with a Stable signal, 1 Stress on
//   Unstable, impossible on Lost) and the operator gets the Spotlight;
// - with the drone selected, the hand shows its operator's cards: those that work through a drone
//   are used from the drone (range, targets and line of sight from it); the rest are dimmed.
// The book: good uses work through sensors, signal, voice, hacking, remote tools, a vehicle
// interface, line of sight from the drone, or a device the drone can touch, scan, mark, cut or
// connect to; bad uses need the character's own body, personal touch, a weapon they wield, an aura
// centred on them, emotional presence or judgment the drone cannot carry.
import { store } from './state.js';
import { network } from './networkManager.js';
import { notify } from './ui.js';
import { isDroneToken, hasSharedControl, droneCrew, droneSignal as signalOf } from './drones.js';

export { DRONE_POWERS, droneCompatible } from './dronePowers.js';

// The drone selected on the map that this screen's character operates, if any.
export function operatedDrone(operatorId) {
  const selected = store.getSelectedToken?.();
  return isDroneToken(selected) && selected.drone?.operatorId === operatorId && selected.mapId === store.state.activeMapId ? selected : null;
}

// Selecting a shared drone takes control of it (the player stance only).
let lastTried = '';
export function startDroneAutoControl() {
  store.subscribe(() => {
    const drone = store.getSelectedToken?.();
    const playerStance = store.sessionRole === 'player' || store.state.userRole !== 'keeper';
    if (!playerStance || !isDroneToken(drone) || !hasSharedControl(drone)) { if (!isDroneToken(drone)) lastTried = ''; return; }
    const me = store.state.tokens.find(t => t.id === store.state.claimedTokenId && t.actorType !== 'drone' && t.isPlayer !== false)
      || store.state.tokens.find(t => t.isPlayer !== false && t.actorType !== 'drone' && store.canEditToken?.(t.id) && t.mapId === drone.mapId);
    if (!me || drone.drone?.operatorId === me.id || signalOf(drone) === 'lost') return;
    if (!droneCrew(store.state.tokens, drone).some(t => t.id === me.id)) return;
    const key = drone.id + ':' + me.id;
    if (lastTried === key) return;
    lastTried = key;
    network.requestAction({ type: 'DRONE_HANDOFF', actorId: drone.id, operatorId: me.id })
      .then(result => notify(result.summary))
      .catch(error => { notify(error.message, 'error'); });
  });
}
