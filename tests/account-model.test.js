import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'localStorage', 'CustomEvent']) globalThis[key] = dom.window[key];
const { noteEntry, arcEntries } = await import('../src/accountModel.js');
const { CloudAccount } = await import('../src/cloudAccount.js');
const { RoomService } = await import('../src/roomService.js');
const { RoomController } = await import('../src/roomController.js');
after(() => dom.window.close());

const campaign = () => ({
  maps: [{ id: 'm1' }, { id: 'm2' }],
  arcs: [
    { id: 'arc_a', name: 'Arco 1', description: 'Inicio', sceneIds: ['m1', 'gone'], tokenIds: ['t1'], images: [{ id: 'i', url: 'data:x' }] },
    { id: 'arc_b', name: '', sceneIds: ['m2'] },
  ],
});

test('arc index entries keep only what the rules accept and drop scenes that no longer exist', () => {
  const [a, b] = arcEntries(campaign(), 5);
  assert.deepEqual(a, { id: 'arc_a', name: 'Arco 1', description: 'Inicio', sceneIds: ['m1'], order: 0, updatedAt: 5 });
  assert.deepEqual(b, { id: 'arc_b', name: 'Arco', description: '', sceneIds: ['m2'], order: 1, updatedAt: 5 });
  assert.deepEqual(arcEntries({}), []);
});

test('a personal note always belongs to a room and respects the stored limits', () => {
  const note = noteEntry('room_1', { title: '  Pista  ', body: 'x'.repeat(30000) });
  assert.equal(note.roomId, 'room_1'); assert.equal(note.title, 'Pista'); assert.equal(note.body.length, 20000);
  assert.ok(note.id && typeof note.updatedAt === 'number');
  assert.equal(noteEntry('room_1', { id: 'n1' }).id, 'n1');
  assert.throws(() => noteEntry('', { title: 'x' }), /partida/);
});

function fakeAccount(uid = 'u1') {
  const docs = new Map(), c = new CloudAccount();
  c.user = { uid }; c.identity = async () => uid; c.db = {};
  c.dbAPI = {
    doc: (_db, ...path) => path.join('/'), collection: (_db, ...path) => path.join('/'),
    setDoc: async (path, data) => { docs.set(path, structuredClone(data)); },
    deleteDoc: async path => { docs.delete(path); },
    getDocsFromServer: async path => ({ docs: [...docs].filter(([key]) => key.startsWith(path + '/')).map(([key, data]) => ({ id: key.split('/').pop(), data: () => data })) }),
  };
  return { c, docs };
}

test('personal notes are saved under the signed-in user, listed per room, updated in place and removed', async () => {
  const { c, docs } = fakeAccount();
  const first = await c.saveNote('room_1', { title: 'Pista', body: 'El núcleo está dañado' });
  await c.saveNote('room_2', { title: 'Otra partida', body: '' });
  assert.ok(docs.has(`users/u1/notes/${first.id}`));
  assert.deepEqual((await c.listNotes('room_1')).map(n => n.title), ['Pista']);
  await c.saveNote('room_1', { id: first.id, title: 'Pista corregida', body: 'ñ' });
  assert.deepEqual((await c.listNotes('room_1')).map(n => n.title), ['Pista corregida']);
  await c.removeNote(first.id);
  assert.deepEqual(await c.listNotes('room_1'), []);
  assert.equal((await c.listNotes('room_2')).length, 1);
});

test('a note the cloud rejects stays in this browser and the fallback is announced', async () => {
  const { c } = fakeAccount('u2'); let announced = '';
  const denied = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  c.dbAPI.setDoc = async () => { throw denied; }; c.dbAPI.getDocsFromServer = async () => { throw denied; };
  window.addEventListener('veil:cloud-fallback', e => { announced = e.detail.kind; }, { once: true });
  const note = await c.saveNote('room_1', { title: 'Solo local', body: '' });
  assert.equal(announced, 'notes');
  assert.deepEqual((await c.listNotes('room_1')).map(n => n.id), [note.id]);
  c.dbAPI.setDoc = async () => { throw new Error('offline'); };
  await assert.rejects(c.saveNote('room_1', { title: 'x' }), /offline/);
});

function fakeRoomService() {
  const docs = new Map(), writes = [];
  const service = new RoomService({ cloudAccount: {} });
  service.db = {}; service.uid = 'keeper';
  service.api = {
    doc: (_db, ...path) => path.join('/'), collection: (_db, ...path) => path.join('/'),
    getDocsFromServer: async path => ({ docs: [...docs].filter(([key]) => key.startsWith(path + '/')).map(([key, data]) => ({ id: key.split('/').pop(), data: () => data, ref: key })) }),
    writeBatch: () => {
      const ops = [];
      return { set: (path, data) => ops.push(() => { docs.set(path, structuredClone(data)); writes.push('set ' + path); }),
        delete: path => ops.push(() => { docs.delete(path); writes.push('delete ' + path); }), commit: async () => ops.forEach(op => op()) };
    },
  };
  return { service, docs, writes };
}

test('the room arc index follows the campaign: only changed arcs are written and removed arcs are deleted', async () => {
  const { service, docs, writes } = fakeRoomService(), data = campaign();
  docs.set('rooms/r1/arcs/arc_old', { id: 'arc_old', name: 'Viejo', description: '', sceneIds: [], order: 0, updatedAt: 1 });
  assert.equal(await service.syncArcs('r1', data), 3);
  assert.deepEqual((await service.listArcs('r1')).map(a => a.id), ['arc_a', 'arc_b']);
  writes.length = 0;
  assert.equal(await service.syncArcs('r1', data), 0, 'an unchanged campaign writes nothing');
  data.arcs[1].name = 'Arco 2';
  await service.syncArcs('r1', data);
  assert.deepEqual(writes, ['set rooms/r1/arcs/arc_b']);
  assert.equal(docs.get('rooms/r1/arcs/arc_b').name, 'Arco 2');
});

test('rules that predate the arc index never break a Keeper save and are not retried', async () => {
  let calls = 0;
  const controller = Object.create(RoomController.prototype);
  controller.service = { syncArcs: async () => { calls++; throw Object.assign(new Error('denied'), { code: 'permission-denied' }); } };
  const warn = console.warn; console.warn = () => {};
  try { await controller.syncArcs('r1', campaign()); await controller.syncArcs('r1', campaign()); } finally { console.warn = warn; }
  assert.equal(calls, 1);
});

test('firestore.rules declares the arc and note collections with the same fields as the model', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.ok(rules.includes(`match /arcs/{arcId}`) && rules.includes(`match /users/{uid}/notes/{noteId}`));
  for (const key of Object.keys(arcEntries(campaign())[0])) assert.ok(rules.includes(`'${key}'`), key);
  for (const key of Object.keys(noteEntry('r', {}))) assert.ok(rules.includes(`'${key}'`), key);
});
