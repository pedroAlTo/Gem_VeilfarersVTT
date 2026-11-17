import test from 'node:test';
import assert from 'node:assert/strict';
import { groupGames } from '../src/accountGamesUI.js';

const rooms = [
  { id: 'r1', name: 'Zeta', ownerUid: 'other', inviteCode: 'ZET-AAAAA' },
  { id: 'r2', name: 'Alfa', ownerUid: 'other' },
  { id: 'r3', name: 'Mía', ownerUid: 'me', inviteCode: 'MIA-BBBBB' },
];
const notes = [
  { id: 'n1', roomId: 'r1', title: 'Pistas', updatedAt: 10 },
  { id: 'n2', roomId: 'r1', title: 'Nombres', updatedAt: 30 },
  { id: 'n3', roomId: 'gone', title: 'De una sala borrada', updatedAt: 5 },
  { id: 'n4', title: 'sin sala' },
];

test('the game in play comes first, then the ones you run, then the rest by name', () => {
  const games = groupGames(rooms, notes, { uid: 'me', currentId: 'r1' });
  assert.deepEqual(games.map(g => g.id), ['r1', 'r3', 'r2', 'gone']);
  assert.equal(games[0].current, true);
  assert.equal(games[1].role, 'keeper');
  assert.equal(games[2].role, 'player');
});

test('each game carries its own notes, newest first, and notes of rooms no longer listed are kept', () => {
  const games = groupGames(rooms, notes, { uid: 'me' });
  const zeta = games.find(g => g.id === 'r1');
  assert.deepEqual(zeta.notes.map(n => n.id), ['n2', 'n1']);
  assert.deepEqual(games.find(g => g.id === 'r2').notes, []);
  const gone = games.find(g => g.id === 'gone');
  assert.equal(gone.role, 'gone');
  assert.equal(gone.notes[0].title, 'De una sala borrada');
  assert.ok(!games.some(g => g.notes.some(n => n.id === 'n4')), 'a note without a room is not shown');
});

test('no rooms and no notes gives an empty list', () => {
  assert.deepEqual(groupGames([], [], {}), []);
});
