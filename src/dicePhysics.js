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
export const PHYSICS_STEP = 1 / 120;
export const MAX_THROW_STEPS = 720;
export const TRAY_SIZE = { width: 12, depth: 7.6 };
export const TRAY_RAILS = [
  { position: [-6.1, .4, 0], size: [.3, 1, 8.1] },
  { position: [6.1, .4, 0], size: [.3, 1, 8.1] },
  { position: [0, .4, -3.9], size: [12.5, 1, .3] },
  { position: [0, .4, 3.9], size: [12.5, 1, .3] },
];
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function createDiceSimulation(model, random = Math.random) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -24, 0), allowSleep: true });
  world.solver.iterations = 24;
  world.solver.tolerance = 1e-7;
  const rubber = new CANNON.Material('mat'), resin = new CANNON.Material('dice');
  world.addContactMaterial(new CANNON.ContactMaterial(rubber, resin, { friction: 0.55, restitution: 0.24 }));
  world.addContactMaterial(new CANNON.ContactMaterial(resin, resin, { friction: 0.35, restitution: 0.3 }));
  const box = (x, y, z, sx, sy, sz) => { const body = new CANNON.Body({ mass: 0, material: rubber, shape: new CANNON.Box(new CANNON.Vec3(sx, sy, sz)) }); body.position.set(x, y, z); world.addBody(body); };
  box(0, -0.25, 0, TRAY_SIZE.width / 2, 0.25, TRAY_SIZE.depth / 2);
  for (const { position, size } of TRAY_RAILS) box(...position, ...size.map(n => n / 2));
  const bodies = [0, 1].map(i => {
    const shape = new CANNON.ConvexPolyhedron({ vertices: model.vertices.map(v => new CANNON.Vec3(v.x, v.y, v.z)), faces: model.faces.map(f => f.indices) });
    const body = new CANNON.Body({ mass: 1, material: resin, shape, linearDamping: 0.12, angularDamping: 0.25, sleepSpeedLimit: 0.16, sleepTimeLimit: 0.45 });
    body.position.set(-3.8 + random() * 0.4, 1.8 + random() * 0.4, -1.35 + i * 2.7);
    body.velocity.set(3.8 + random() * 1.4, 0.4 + random() * .7, (i ? -1 : 1) * (.2 + random() * .5));
    body.angularVelocity.set((random() - 0.5) * 5, (random() - 0.5) * 6, -3 - random() * 4);
    body.quaternion.setFromEuler(random() * 6, random() * 6, random() * 6);
    world.addBody(body); return body;
  });
  let steps = 0, settled = false;
  const snapshot = () => bodies.map(body => ({ position: body.position.toArray(), quaternion: body.quaternion.toArray() }));
  return {
    world, bodies, snapshot,
    get settled() { return settled; },
    get steps() { return steps; },
    step() {
      if (settled) return;
      world.step(PHYSICS_STEP);
      steps++;
      // A throw is driven solely by gravity and contacts. Never kick, teleport,
      // or rotate a landed die into place; sleeping bodies retain their pose.
      settled = bodies.every(body => body.sleepState === CANNON.Body.SLEEPING);
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

// Reject a cocked/stacked/overlong trajectory before it is displayed. This only
// selects initial conditions; no live body is ever kicked or teleported. The
// authoritative rules result is unchanged. Test throws use the natural labels.
export function prepareThrow(model, values, seed) {
  if (values && (values.length !== 2 || values.some(n => !Number.isInteger(n) || n < 1 || n > 12))) throw new Error('A d12 result must be between 1 and 12.');
  const faceHeight = model.faces[0].center.length();
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidateSeed = (seed + Math.imul(attempt, 0x9e3779b9)) >>> 0;
    const simulation = createDiceSimulation(model, seededRandom(candidateSeed));
    while (!simulation.settled && simulation.steps < MAX_THROW_STEPS) simulation.step();
    const final = simulation.snapshot();
    const clean = simulation.settled && final.every(body => {
      const normal = model.faces[topFace(model, body.quaternion)].normal.clone().applyQuaternion(new THREE.Quaternion(...body.quaternion));
      return normal.y > .995 && Math.abs(body.position[1] - faceHeight) < .02 && Math.abs(body.position[0]) < TRAY_SIZE.width / 2 - .8 && Math.abs(body.position[2]) < TRAY_SIZE.depth / 2 - .8;
    });
    if (clean) return { seed: candidateSeed, final, steps: simulation.steps,
      numbers: final.map((body, i) => values ? faceNumbers(topFace(model, body.quaternion), values[i]) : Array.from({ length: 12 }, (_, n) => n + 1)) };
  }
  throw new Error('Could not prepare a clean landing. Your game result is preserved.');
}
