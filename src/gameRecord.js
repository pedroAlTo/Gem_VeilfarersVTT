// Keeps users/{uid}/games/{roomId} up to date while you are in a room: whether you run it or
// play in it, the character you play and when you last played. The account screen reads it.
import { characterKey } from './characterImport.js';

// The player character this seat controls (drones are tools, not "your character").
export function seatCharacter(tokens = [], seatId = '', claimedTokenId = '') {
  const pcs = tokens.filter(t => t && t.actorType !== 'drone' && (t.isPlayer || ['pc', 'player', 'character'].includes(t.actorType)));
  return pcs.find(t => seatId && (t.ownerId === seatId || (t.controllerIds || []).includes(seatId)))
    || pcs.find(t => claimedTokenId && t.id === claimedTokenId) || null;
}

export function characterSummary(token) {
  if (!token) return '';
  return [token.level ? `Nivel ${token.level}` : '', token.characterClass, token.path].filter(Boolean).join(' · ');
}

// What is worth recording for this room right now. A Keeper records no character.
export function gameSnapshot({ roomId, isKeeper, tokens, seatId, claimedTokenId }) {
  if (!roomId) return null;
  const token = isKeeper ? null : seatCharacter(tokens, seatId, claimedTokenId);
  return {
    roomId, role: isKeeper ? 'keeper' : 'player',
    characterName: token?.name || '', characterSummary: characterSummary(token), characterKey: token ? characterKey(token) : '',
  };
}
const fingerprint = snapshot => JSON.stringify(snapshot);

// Writes on entering a room and whenever the role or character changes; at most once per
// `delay` ms, and again after `refresh` ms of play so "last played" stays current.
export function startGameRecording({ rooms, store, account, delay = 3000, refresh = 15 * 60 * 1000, clock = () => Date.now() }) {
  let last = '', lastAt = 0, timer = null;
  const check = () => {
    const room = rooms.room;
    if (!room || !account.user || rooms.leaving) return;
    const snapshot = gameSnapshot({ roomId: room.id, isKeeper: rooms.isKeeper, tokens: store.state.tokens, seatId: store.memberId || store.peerId || rooms.service?.uid, claimedTokenId: store.state.claimedTokenId });
    const print = fingerprint(snapshot);
    if (print === last && clock() - lastAt < refresh) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (rooms.room?.id !== snapshot.roomId) return;
      last = print; lastAt = clock();
      account.saveGame(snapshot.roomId, { ...snapshot, lastPlayedAt: lastAt }).catch(error => console.warn('Game record not saved:', error));
    }, delay);
  };
  const offStore = store.subscribe((_state, keys) => { if (keys.some(k => k === 'tokens' || k === 'claimedTokenId')) check(); });
  const offRooms = rooms.subscribe(() => { if (!rooms.room) { last = ''; clearTimeout(timer); } else check(); });
  return () => { offStore(); offRooms(); clearTimeout(timer); };
}
