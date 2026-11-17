import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'localStorage', 'CustomEvent']) globalThis[key] = dom.window[key];
const { retryUntilConnected, isPermanentRoomError, retryDelay } = await import('../src/connectRetryUI.js');
after(() => dom.window.close());
const instant = () => Promise.resolve();

test('it keeps trying after passing errors and stops once connected', async () => {
  let calls = 0;
  const ok = await retryUntilConnected(async () => { calls++; if (calls < 3) throw new Error('Network error'); }, { wait: instant });
  assert.equal(ok, true); assert.equal(calls, 3);
  assert.equal(document.querySelector('.connect-retry'), null, 'the panel goes away');
});

test('an error a retry cannot fix stops at once', async () => {
  let calls = 0;
  await assert.rejects(retryUntilConnected(async () => { calls++; throw new Error('La sala ya no existe.'); }, { wait: instant }), /ya no existe/);
  assert.equal(calls, 1);
  assert.ok(isPermanentRoomError({ code: 'permission-denied' }));
  assert.ok(!isPermanentRoomError(new Error('La sala está abierta en otra ventana del Keeper.')), 'a Keeper tab still holding the lease is worth waiting for');
});

test('Cancel stops the loop and tells the caller', async () => {
  let cancelled = false, calls = 0;
  const run = retryUntilConnected(async () => { calls++; throw new Error('offline'); }, { onCancel: () => { cancelled = true; }, wait: () => new Promise(() => {}) });
  await new Promise(r => setTimeout(r, 10));
  assert.match(document.querySelector('.connect-retry [data-retry-state]').textContent, /Reintentando en \d+ s · intento 2/);
  document.querySelector('.connect-retry [data-retry-cancel]').click();
  assert.equal(await run, false); assert.equal(cancelled, true); assert.equal(calls, 1);
  assert.equal(document.querySelector('.connect-retry'), null);
});

test('the wait grows to 15 s and stays there', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(retryDelay), [2000, 4000, 8000, 15000, 15000, 15000]);
});
