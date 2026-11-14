// Run against the local Firestore emulator: npm run test:account.
import test, { before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-veilfarers-vtt', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  await env.clearFirestore();
});
after(async () => { await env?.cleanup(); });

const character = (id) => ({ id, key: 'system:abc', name: 'Maren Solas', payload: '{}', updatedAt: Date.now() });
const scene = (id) => ({ id, name: 'Charon', gridSize: 70, ambientLight: 0.25, width: 1920, height: 1080, imageUrl: 'https://res.cloudinary.com/demo/image/upload/map.webp',
  walls: [], lights: [], effects: [], water: [], fow: null, notes: [], tokens: [], arcId: null, createdAt: Date.now(), updatedAt: Date.now() });

test('a user saves and re-saves their own character, and nobody else can', async () => {
  const mine = env.authenticatedContext('u1').firestore(), other = env.authenticatedContext('u2').firestore();
  await assertSucceeds(setDoc(doc(mine, 'users/u1/characters/c1'), character('c1')));
  await assertSucceeds(setDoc(doc(mine, 'users/u1/characters/c1'), { ...character('c1'), name: 'Maren (lvl 2)' }));
  await assertFails(setDoc(doc(other, 'users/u1/characters/c1'), character('c1')));
  await assertFails(setDoc(doc(mine, 'users/u1/characters/c1'), character('other-id')));
  await assertFails(setDoc(doc(mine, 'users/u1/characters/c2'), { ...character('c2'), admin: true }));
});

test('a Keeper scene with tactical content and a Cloudinary image reaches the cloud and can be updated', async () => {
  const mine = env.authenticatedContext('u1').firestore(), other = env.authenticatedContext('u2').firestore();
  await assertSucceeds(setDoc(doc(mine, 'users/u1/scenes/s1'), scene('s1')));
  await assertSucceeds(setDoc(doc(mine, 'users/u1/scenes/s1'), { ...scene('s1'), walls: [{ x1: 0, y1: 0, x2: 10, y2: 10 }], arcId: 'arc1' }));
  await assertFails(setDoc(doc(other, 'users/u1/scenes/s1'), scene('s1')));
  await assertFails(setDoc(doc(mine, 'users/u1/scenes/s2'), { ...scene('s2'), storagePath: 'users/u2/maps/x' }));
  await assertFails(setDoc(doc(mine, 'users/u1/scenes/s3'), { ...scene('s3'), gridSize: 5 }));
});
