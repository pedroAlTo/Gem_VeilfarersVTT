import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent']) globalThis[key] = dom.window[key];
const { inviteDue } = await import('../src/keeperInvite.js');

test('the Keeper sees «Invita a tus jugadores» in an online room until someone joins or it is closed', () => {
  const controller = { room: { id: 'room_1', inviteCode: 'VEI-8H2FA' }, isKeeper: true };
  const state = { userRole: 'keeper', connectedPeers: [] };
  assert.equal(inviteDue(state, controller, 'host'), true);
  assert.equal(inviteDue({ ...state, connectedPeers: [{ id: 'p', name: 'Ana' }] }, controller, 'host'), false, 'someone joined');
  assert.equal(inviteDue(state, { ...controller, isKeeper: false }, 'player'), false, 'players do not invite');
  assert.equal(inviteDue(state, { room: null }, 'local'), false, 'local table');
  localStorage.setItem('veil.invite.closed.room_1', '1');
  assert.equal(inviteDue(state, controller, 'host'), false, 'closed for this room');
});
