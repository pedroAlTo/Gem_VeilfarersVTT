import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Merge the triangles into the twelve true pentagonal faces. One source of geometry
// feeds both rendering and collision; the visible dice cannot pass through the mat.
export function d12Model(radius = 0.95) {
  const geometry = new THREE.DodecahedronGeometry(radius), positions = geometry.getAttribute('position');
  const vertices = [], lookup = new Map(), grouped = new Map();
  const vertex = index => {
    const p = new THREE.Vector3().fromBufferAttribute(positions, index), key = p.toArray().map(x => x.toFixed(5)).join(',');
    if (!lookup.has(key)) { lookup.set(key, vertices.length); vertices.push(p); }
    return lookup.get(key);
  };
  for (let i = 0; i < positions.count; i += 3) {
    const ids = [vertex(i), vertex(i + 1), vertex(i + 2)], [a, b, c] = ids.map(x => vertices[x]);
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const key = normal.toArray().map(x => Math.abs(x) < .0005 ? '0.000' : x.toFixed(3)).join(',');
    if (!grouped.has(key)) grouped.set(key, { normal, ids: new Set() });
    ids.forEach(id => grouped.get(key).ids.add(id));
  }
  const faces = [...grouped.values()].map(({ normal, ids }) => {
    const indices = [...ids], center = indices.reduce((sum, id) => sum.add(vertices[id]), new THREE.Vector3()).divideScalar(indices.length);
    const u = vertices[indices[0]].clone().sub(center).normalize(), v = new THREE.Vector3().crossVectors(normal, u).normalize();
    indices.sort((a, b) => { const pa = vertices[a].clone().sub(center), pb = vertices[b].clone().sub(center); return Math.atan2(pa.dot(v), pa.dot(u)) - Math.atan2(pb.dot(v), pb.dot(u)); });
    return { indices, normal, center, u, v };
  });
  geometry.dispose();
  return { vertices, faces };
}
export function topFace(model, quaternion) {
  const q = new THREE.Quaternion(...quaternion);
  let result = 0, highest = -Infinity;
  model.faces.forEach((face, i) => { const y = face.normal.clone().applyQuaternion(q).y; if (y > highest) { highest = y; result = i; } });
  return result;
}
export function faceNumbers(topIndex, value) {
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new Error('A d12 result must be between 1 and 12.');
  return Array.from({ length: 12 }, (_, i) => ((i - topIndex + value - 1 + 12) % 12) + 1);
}
export const PHYSICS_STEP = 1 / 60;
export const TRAY_RAILS = [
  { position: [-7.1, .35, 0], size: [.35, .9, 8.55] },
  { position: [7.1, .35, 0], size: [.35, .9, 8.55] },
  { position: [0, .35, -4.1], size: [14.55, .9, .35] },
  { position: [0, .35, 4.1], size: [14.55, .9, .35] },
];
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function createDiceSimulation(model, random = Math.random) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0), allowSleep: true });
  world.solver.iterations = 16;
  const rubber = new CANNON.Material('mat'), resin = new CANNON.Material('dice');
  world.addContactMaterial(new CANNON.ContactMaterial(rubber, resin, { friction: 0.45, restitution: 0.32 }));
  world.addContactMaterial(new CANNON.ContactMaterial(resin, resin, { friction: 0.3, restitution: 0.38 }));
  const box = (x, y, z, sx, sy, sz) => { const body = new CANNON.Body({ mass: 0, material: rubber, shape: new CANNON.Box(new CANNON.Vec3(sx, sy, sz)) }); body.position.set(x, y, z); world.addBody(body); };
  box(0, -0.25, 0, 7, 0.25, 4);
  for (const { position, size } of TRAY_RAILS) box(...position, ...size.map(n => n / 2));
  const bodies = [0, 1].map(i => {
    const shape = new CANNON.ConvexPolyhedron({ vertices: model.vertices.map(v => new CANNON.Vec3(v.x, v.y, v.z)), faces: model.faces.map(f => f.indices) });
    const body = new CANNON.Body({ mass: 1, material: resin, shape, linearDamping: 0.3, angularDamping: 0.38, sleepSpeedLimit: 0.22, sleepTimeLimit: 0.4 });
    body.position.set(-4.8 - random() * 0.4, 2 + random() * 0.5, -1.1 + i * 2.2);
    body.velocity.set(6 + random() * 2, 2 + random() * 2, (0.5 - random()) * .8);
    body.angularVelocity.set(8 + random() * 7, (random() - 0.5) * 16, 8 + random() * 7);
    body.quaternion.setFromEuler(random() * 6, random() * 6, random() * 6);
    world.addBody(body); return body;
  });
  let steps = 0, nudges = 0, settled = false;
  const snapshot = () => bodies.map(body => ({ position: body.position.toArray(), quaternion: body.quaternion.toArray() }));
  return {
    world, bodies, snapshot,
    get settled() { return settled; },
    get steps() { return steps; },
    step() {
      if (settled) return;
      world.step(PHYSICS_STEP);
      steps++;
      const sleeping = bodies.every(b => b.sleepState === CANNON.Body.SLEEPING);
      // A die can land cocked against a rail or another die. Nudge it physically,
      // keeping the same game result. The renderer never substitutes a tween.
      if (steps > 120 && (sleeping || steps % 300 === 0)) {
        const cocked = bodies.filter(body => {
          const q = new THREE.Quaternion(...body.quaternion.toArray());
          const flat = Math.max(...model.faces.map(f => f.normal.clone().applyQuaternion(q).y)) > .99;
          return !flat || Math.abs(body.position.x) > 6.2 || Math.abs(body.position.z) > 3.2;
        });
        if (sleeping && !cocked.length) { settled = true; return; }
        if (nudges++ < 8) for (const body of cocked) {
          body.wakeUp(); body.velocity.set(-body.position.x * .8, 3, -body.position.z * .8);
          body.angularVelocity.set(3 + random() * 2, 2, 4);
        }
      }
      // Off-table dice are not valid rolls; recover them above the mat and let
      // the solver settle them again. This also handles a throttled render tab.
      for (const body of bodies) if (body.position.y < -.5 || Math.abs(body.position.x) > 8 || Math.abs(body.position.z) > 5) {
        body.wakeUp(); body.position.set((body === bodies[0] ? -1 : 1) * 2, 2, 0);
        body.velocity.set(0, 0, 0); body.angularVelocity.set(2, 3, 2);
      }
    },
  };
}

export function simulateThrow(model, random = Math.random) {
  const simulation = createDiceSimulation(model, random), frames = [];
  while (!simulation.settled && simulation.steps < 1200) {
    simulation.step(); frames.push(simulation.snapshot());
  }
  if (!simulation.settled) throw new Error('The dice did not settle. Throw again.');
  return frames;
}

// Determine the face labels before an authoritative game animation starts.
// The live world is then stepped with the same seed: no frame recording or
// texture replacement during the throw, and no second rules-engine roll.
export function prepareThrow(model, values, seed) {
  const simulation = createDiceSimulation(model, seededRandom(seed));
  while (!simulation.settled && simulation.steps < 1200) simulation.step();
  if (!simulation.settled) throw new Error('Dice did not settle. Your game result is preserved.');
  const final = simulation.snapshot();
  return { seed, final, steps: simulation.steps,
    numbers: final.map((body, i) => faceNumbers(topFace(model, body.quaternion), values[i])) };
}
