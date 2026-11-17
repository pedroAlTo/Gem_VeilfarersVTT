import test from 'node:test';
import assert from 'node:assert/strict';
import { seatCharacter, gameSnapshot, startGameRecording } from '../src/gameRecord.js';
import { gameEntry } from '../src/accountModel.js';
import { groupGames } from '../src/accountGamesUI.js';

const tokens = [
  { id: 'd1', name: 'Dron', actorType: 'drone', ownerId: 'u1' },
  { id: 'a1', name: 'Kira', isPlayer: true, actorType: 'player', ownerId: 'u1', level: 3, characterClass: 'Guardian', path: 'Awakened' },
  { id: 'a2', name: 'Maren', isPlayer: true, actorType: 'player', ownerId: 'u2' },
  { id: 'x1', name: 'Pirata', actorType: 'adversary', ownerId: 'u1' },
];

test('your character is the player character your seat controls, never a drone or an adversary', () => {
  assert.equal(seatCharacter(tokens, 'u1').name, 'Kira');
  assert.equal(seatCharacter(tokens, 'u3', 'a2').name, 'Maren', 'falls back to the claimed token');
  assert.equal(seatCharacter(tokens, 'u3'), null);
});

test('a snapshot records the role and, for players, the character', () => {
  const player = gameSnapshot({ roomId: 'r1', isKeeper: false, tokens, seatId: 'u1' });
  assert.deepEqual({ ...player, characterKey: undefined }, { roomId: 'r1', role: 'player', characterName: 'Kira', characterSummary: 'Nivel 3 · Guardian · Awakened', characterKey: undefined });
  assert.ok(player.characterKey);
  const keeper = gameSnapshot({ roomId: 'r1', isKeeper: true, tokens, seatId: 'u1' });
  assert.equal(keeper.role, 'keeper'); assert.equal(keeper.characterName, '');
  assert.equal(gameSnapshot({ roomId: '', tokens }), null);
});

test('a game entry keeps only what the rules accept', () => {
  const entry = gameEntry('r1', { role: 'admin', characterName: 'x'.repeat(300), lastPlayedAt: 7, extra: true });
  assert.deepEqual(Object.keys(entry).sort(), ['characterKey', 'characterName', 'characterSummary', 'lastPlayedAt', 'role', 'roomId']);
  assert.equal(entry.role, 'player'); assert.equal(entry.characterName.length, 200); assert.equal(entry.lastPlayedAt, 7);
  assert.throws(() => gameEntry(''), /partida/);
  assert.throws(() => gameEntry('a/b'), /partida/);
});

test('the table records on entering a room and when your character changes, not on every change', async () => {
  const listeners = new Set(), roomListeners = new Set(), saved = [];
  const store = { state: { tokens: tokens.slice(), claimedTokenId: null }, memberId: 'u1', subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  const rooms = { room: null, isKeeper: false, service: { uid: 'u1' }, subscribe: fn => { roomListeners.add(fn); return () => roomListeners.delete(fn); } };
  const account = { user: { uid: 'u1' }, saveGame: async (id, data) => { saved.push({ id, ...data }); } };
  const stop = startGameRecording({ rooms, store, account, delay: 5 });
  const wait = () => new Promise(r => setTimeout(r, 20));
  rooms.room = { id: 'r1' }; roomListeners.forEach(fn => fn(rooms)); await wait();
  assert.equal(saved.length, 1); assert.equal(saved[0].characterName, 'Kira');
  listeners.forEach(fn => fn(store.state, ['tokens'])); await wait();
  assert.equal(saved.length, 1, 'same character, nothing new to write');
  store.state.tokens = tokens.map(t => t.id === 'a1' ? { ...t, level: 4 } : t);
  listeners.forEach(fn => fn(store.state, ['tokens'])); await wait();
  assert.equal(saved.length, 2); assert.equal(saved[1].characterSummary, 'Nivel 4 · Guardian · Awakened');
  listeners.forEach(fn => fn(store.state, ['fear'])); await wait();
  assert.equal(saved.length, 2, 'other changes are ignored');
  stop();
});

test('the account lists the most recently played rooms first and attaches each record', () => {
  const rooms = [{ id: 'r1', name: 'A', ownerUid: 'x' }, { id: 'r2', name: 'B', ownerUid: 'x' }];
  const games = groupGames(rooms, [], { uid: 'me', records: [{ roomId: 'r2', characterName: 'Kira', lastPlayedAt: 50 }, { roomId: 'r1', lastPlayedAt: 10 }] });
  assert.deepEqual(games.map(g => g.id), ['r2', 'r1']);
  assert.equal(games[0].record.characterName, 'Kira');
});
