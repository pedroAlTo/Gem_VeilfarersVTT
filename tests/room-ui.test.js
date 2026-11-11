import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'CustomEvent', 'Image']) globalThis[key] = dom.window[key];
dom.window.HTMLCanvasElement.prototype.getContext = () => ({});
const { store } = await import('../src/state.js'); await store.ready;
const { account } = await import('../src/cloudAccount.js');
const { rooms } = await import('../src/roomController.js');
const { openRoomLobby } = await import('../src/roomUI.js');
account.restoreSession = async () => {};
account.loadPreferences = async () => ({});
const tick = () => new Promise(r => setTimeout(r, 0));
after(async () => { rooms.room = null; rooms.unsubscribeStore(); clearTimeout(rooms.saveTimer); await store.saveQueue; dom.window.close(); });

test('room menu separates owned/member rooms and retains pause restrictions after async loading', async () => {
  account.user = { uid: 'keeper', displayName: 'Keeper' }; rooms.service.uid = 'keeper';
  const owned = { id: 'my-room', ownerUid: 'keeper', name: 'My <room>', inviteCode: 'VF-' + '1'.repeat(32), hostEpoch: '', hostSeenAt: null };
  const joined = { ...owned, id: 'other-room', ownerUid: 'other', name: 'Other table' };
  rooms.service.list = async () => [owned, joined]; rooms.room = owned; rooms.members = [{ uid: 'pilot', name: 'Pilot', status: 'active' }];
  store.state.roomPaused = true; store.state.isConnected = false;
  const modal = openRoomLobby(); await tick(); await tick();
  assert.equal(modal.querySelector('[data-room-error]').textContent, '');
  assert.equal(modal.querySelectorAll('[data-enter-room]').length, 2);
  assert.match(modal.textContent, /Salas que dirijo/); assert.match(modal.textContent, /Salas en las que juego/);
  assert.match(modal.textContent, /My <room>/); assert.equal(modal.querySelector('room'), null);
  assert.equal(modal.querySelector('[data-room-import]').disabled, true);
  assert.ok(modal.querySelector('[data-room-assign="pilot"]'));
  assert.ok(modal.querySelector('[data-room-broadcast]'));
  store.update({ roomPaused: false, isConnected: true });
  assert.equal(modal.querySelector('[data-room-import]').disabled, false);
  assert.match(modal.querySelector('[data-current-presence]').textContent, /Online/);
  modal.remove(); await tick();
});

test('player room menu exposes the roster but never owner controls', async () => {
  account.user = { uid: 'pilot', displayName: 'Pilot' }; rooms.service.uid = 'pilot';
  rooms.room = { id: 'other-room', ownerUid: 'keeper', name: 'Table', inviteCode: 'VF-' + '2'.repeat(32) };
  rooms.service.list = async () => [rooms.room]; store.state.players = [{ id: 'pilot', name: 'Pilot' }, { id: 'crew', name: 'Crew' }];
  store.state.isConnected = false; store.state.roomPaused = true;
  const modal = openRoomLobby(); await tick(); await tick();
  assert.equal(modal.querySelector('[data-room-error]').textContent, '');
  assert.equal(modal.querySelectorAll('[data-room-roster] .room-card').length, 2);
  assert.equal(modal.querySelector('[data-room-kick]'), null); assert.equal(modal.querySelector('[data-room-rotate]'), null);
  assert.equal(modal.querySelector('[data-room-import]').disabled, true);
  modal.remove(); await tick();
});
