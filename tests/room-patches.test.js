import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
globalThis.window ??= dom.window; globalThis.document ??= dom.window.document; globalThis.localStorage ??= dom.window.localStorage;
const { itemPatch, applyItemPatch, RoomWire } = await import('../src/roomWire.js');
const { splitCampaignText } = await import('../src/roomService.js');

const fields = item => new Map(Object.entries(item).map(([k, v]) => [k, JSON.stringify(v)]));
const index = list => new Map(list.map(x => [x.id, fields(x)]));

test('itemPatch / applyItemPatch: only what changed travels, and the list is rebuilt exactly', () => {
  const avatar = 'data:image/png;base64,' + 'A'.repeat(50000);
  const before = [{ id: 'a', x: 1, y: 2, avatarUrl: avatar, hp: { current: 5 } }, { id: 'b', x: 9, note: 'n' }];
  const after = [{ id: 'a', x: 64, y: 2, avatarUrl: avatar, hp: { current: 5 } }, { id: 'b', x: 9 }, { id: 'c', x: 0 }];
  const patch = itemPatch(index(before), index(after), after);
  assert.deepEqual(patch.set, { a: { x: 64 } }, 'a token moved sends only its x');
  assert.deepEqual(patch.unset, { b: ['note'] });
  assert.deepEqual(patch.add, [{ id: 'c', x: 0 }]);
  assert.ok(JSON.stringify(patch).length < 300, 'the avatar is not sent again');
  assert.deepEqual(applyItemPatch(before, patch), after);
  // Removal and reordering.
  const later = [{ id: 'c', x: 0 }, { id: 'a', x: 64, y: 2, avatarUrl: avatar, hp: { current: 5 } }];
  assert.deepEqual(applyItemPatch(after, itemPatch(index(after), index(later), later)), later);
  assert.equal(itemPatch(index(later), index(later), later), null, 'nothing changed');
});

test('compressSnapshot sends a full snapshot first, then item patches that rebuild the same state', () => {
  const wire = Object.create(RoomWire.prototype);
  const s1 = { fear: 2, tokens: [{ id: 't1', x: 1, avatarUrl: 'X'.repeat(9000) }, { id: 't2', x: 5 }], maps: [{ id: 'm', imageUrl: 'IMG'.repeat(4000), fogExplored: null }] };
  const first = wire.compressSnapshot({ type: 'INITIAL_STATE', state: s1 });
  assert.equal(first.type, 'INITIAL_STATE');
  const s2 = structuredClone(s1); s2.tokens[0].x = 65; s2.maps[0].fogExplored = { bits: 'AQ==' }; s2.fear = 3;
  const second = wire.compressSnapshot({ type: 'INITIAL_STATE', state: s2 });
  assert.equal(second.type, 'ROOM_STATE_PATCH');
  assert.deepEqual(second.changes, { fear: 3 });
  assert.deepEqual(second.items.tokens.set, { t1: { x: 65 } });
  assert.deepEqual(second.items.maps.set, { m: { fogExplored: { bits: 'AQ==' } } }, 'the map image is not sent again');
  assert.ok(JSON.stringify(second).length < 400);
  const rebuilt = { ...s1, ...second.changes };
  for (const [k, p] of Object.entries(second.items)) rebuilt[k] = applyItemPatch(s1[k], p);
  assert.deepEqual(rebuilt, s2);
});

test('splitCampaignText: pieces join into the same JSON, and a small change rewrites few pieces', () => {
  const big = { maps: [{ id: 'm', imageUrl: 'data:' + 'Q'.repeat(400000) }], tokens: Array.from({ length: 60 }, (_, i) => ({ id: 't' + i, x: i, sheet: 'S'.repeat(3000) + i })) };
  const a = splitCampaignText(big);
  assert.deepEqual(JSON.parse(a.join('')), big);
  assert.ok(a.every(p => p.length <= 60000));
  const changed = structuredClone(big); changed.tokens[5].x = 12345; changed.tokens[30].sheet += '!';
  const b = splitCampaignText(changed), known = new Set(a);
  assert.deepEqual(JSON.parse(b.join('')), changed);
  assert.ok(b.filter(p => !known.has(p)).length <= 4, `rewritten pieces: ${b.filter(p => !known.has(p)).length} of ${b.length}`);
  assert.ok(splitCampaignText({ v: 'x'.repeat(59990) + '😀😀😀' }).every(p => !/[\uD800-\uDBFF]$/.test(p)));
});

// A tiny in-memory stand-in for the Realtime Database API the wire uses.
function fakeRealtime() {
  const tree = {}, childListeners = [], valueListeners = [];
  const at = path => path.split('/').filter(Boolean);
  const get = path => at(path).reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), tree);
  const put = (path, value) => {
    const keys = at(path), last = keys.pop(); let node = tree;
    for (const k of keys) node = node[k] ??= {};
    const existed = node[last] !== undefined;
    if (value === null) delete node[last]; else node[last] = structuredClone(value);
    const parent = keys.join('/');
    if (value !== null && !existed) for (const l of childListeners) if (l.path === parent) l.cb(snap(`${parent}/${last}`));
    for (const l of valueListeners) if (l.path === path) l.cb(snap(path));
  };
  const snap = path => ({ key: at(path).at(-1), val: () => structuredClone(get(path) ?? null), exists: () => get(path) !== undefined });
  const api = {
    ref: (db, path) => ({ path }),
    serverTimestamp: () => Date.now(),
    set: async (ref, value) => put(ref.path, value),
    update: async (ref, values) => { for (const [k, v] of Object.entries(values)) put(`${ref.path}/${k}`, v); },
    remove: async ref => put(ref.path, null),
    get: async ref => snap(ref.path),
    onChildAdded: (ref, cb) => { const l = { path: ref.path, cb }; childListeners.push(l); for (const k of Object.keys(get(ref.path) || {})) cb(snap(`${ref.path}/${k}`)); return () => childListeners.splice(childListeners.indexOf(l), 1); },
    onValue: (ref, cb) => { const l = { path: ref.path, cb }; valueListeners.push(l); cb(snap(ref.path)); return () => valueListeners.splice(valueListeners.indexOf(l), 1); },
  };
  return { api, db: {}, tree };
}

test('RoomWire over Realtime Database: ordered messages both ways, parts removed after reading, other epochs ignored', async () => {
  const realtime = fakeRealtime();
  const firestoreStub = { api: { onSnapshot: () => () => {} }, ref: () => ({}), col: () => ({}) };
  const toKeeper = [], toPlayer = [];
  const keeper = new RoomWire(firestoreStub, 'room', 'w1', 'keeper', { realtime, epoch: 'E1', onData: d => toKeeper.push(d), onClose: e => { throw e; } });
  const player = new RoomWire(firestoreStub, 'room', 'w1', 'player', { realtime, epoch: 'E1', onData: d => toPlayer.push(d), onClose: e => { throw e; } });
  const big = { type: 'INITIAL_STATE', state: { fear: 1, tokens: [{ id: 't', x: 1, sheet: 'S'.repeat(130000) }] } };
  keeper.send(big);
  player.send({ type: 'TOKEN_MOVE', tokenId: 't', x: 64 });
  const until = async f => { for (let i = 0; i < 200 && !f(); i++) await new Promise(r => setTimeout(r, 5)); };
  await until(() => toPlayer.length && toKeeper.length);
  assert.deepEqual(toPlayer[0], big, 'a message in several parts arrives whole');
  assert.deepEqual(toKeeper[0], { type: 'TOKEN_MOVE', tokenId: 't', x: 64 });
  const moved = structuredClone(big); moved.state.tokens[0].x = 65;
  keeper.send(moved);
  await until(() => toPlayer.length === 2);
  assert.equal(toPlayer[1].state.tokens[0].x, 65, 'the patch rebuilds the state');
  await until(() => !Object.keys(realtime.tree.wires.w1.down || {}).length);
  assert.deepEqual(realtime.tree.wires.w1.down || {}, {}, 'read parts are removed');
  // A stale Keeper connection (another epoch) is not heard.
  await realtime.api.set({ path: 'wires/w1/down/99_0' }, { seq: 3, part: 0, total: 1, text: JSON.stringify({ type: 'FORGED' }), epoch: 'OLD' });
  await new Promise(r => setTimeout(r, 30));
  assert.equal(toPlayer.length, 2);
  // Presence: the player's beat reaches the Keeper's wire.
  await player.beat(); await until(() => keeper.seenAt);
  assert.ok(keeper.seenAt > 0);
  keeper.close(); player.close();
});
