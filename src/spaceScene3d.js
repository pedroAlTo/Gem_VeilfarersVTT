// src/spaceScene3d.js
// PROJECT ARES — Escena 3D del combate espacial (three.js, carga dinámica para no engordar el bundle).
// Cámaras Orbital y Cenital, anillos de banda centrados en el objetivo, arcos con Armor Slots,
// nave fantasma pre-maniobra, marca SENSOR LOCK y arco Exposed en ámbar.
// La posición sale de la banda: los km y la altura son decorativos.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RANGE_BANDS, ARCS, scenePositionForBand } from './spaceCombatRules.js';

const BAND_RADIUS = { Adjacent: 1.2, Engagement: 3, Standard: 6, Long: 10, Extreme: 15 };
const COLORS = {
  own: 0x78cfdf, enemy: 0xc84a5e, ghost: 0x8fa4e7, lock: 0xf5c04e,
  exposed: 0xffb347, ring: 0x1f3a52, targetRing: 0x00f3ff, arcFore: 0x39d98a,
};

function shipMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 1.4, 6, 12),
    new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35, emissive: color, emissiveIntensity: 0.15 })
  );
  body.rotation.x = Math.PI / 2; // proa hacia +Z local… lo alineamos a -Z (forward de three)
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.7, 12),
    new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3, emissive: color, emissiveIntensity: 0.2 })
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.15;
  g.add(nose);
  return g;
}

function bandRings(radiusScale = 1) {
  const group = new THREE.Group();
  for (const band of RANGE_BANDS) {
    const r = BAND_RADIUS[band] * radiusScale;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.03, r + 0.03, 96),
      new THREE.MeshBasicMaterial({ color: COLORS.ring, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.userData.band = band;
    group.add(ring);
  }
  return group;
}

function arcIndicators(shipGroup, { slots, maxSlots, exposedArcs = [], highlight = null }) {
  // Cuatro indicadores alrededor de la nave: Proa/Estribor/Popa/Babor con pips de Armor Slots.
  const dir = { fore: [0, 0, -1.6], starboard: [1.1, 0, 0], aft: [0, 0, 1.6], port: [-1.1, 0, 0] };
  const out = {};
  for (const arc of ARCS) {
    const geo = new THREE.BoxGeometry(0.5, 0.08, 0.5);
    const exposed = exposedArcs.includes(arc);
    const mat = new THREE.MeshStandardMaterial({
      color: exposed ? COLORS.exposed : arc === highlight ? COLORS.arcFore : 0x2a4a66,
      emissive: exposed ? COLORS.exposed : arc === highlight ? COLORS.arcFore : 0x0b1a2a,
      emissiveIntensity: exposed || arc === highlight ? 0.7 : 0.2,
      transparent: true, opacity: 0.9,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...dir[arc]);
    m.userData.arc = arc;
    shipGroup.add(m);
    out[arc] = m;
  }
  return out;
}

export class SpaceScene3D {
  constructor(container) {
    this.container = container;
    this.mode = 'orbital'; // 'orbital' | 'zenith'
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.AmbientLight(0x8899bb, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(6, 12, 4);
    this.scene.add(key);
    this.starfield = this._makeStarfield();
    this.scene.add(this.starfield);
    this.rings = bandRings();
    this.scene.add(this.rings);
    this.ownGroup = shipMesh(COLORS.own);
    this.scene.add(this.ownGroup);
    this.ghostGroup = null;
    this.enemyGroups = new Map();
    this.lockSprite = null;
    this._resize = this._onResize.bind(this);
    window.addEventListener('resize', this._resize);
    this._animate = this._animate.bind(this);
    this.renderer.setAnimationLoop(this._animate);
    this.setCamera(this.mode);
    this._onResize();
  }

  _makeStarfield() {
    const n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 160;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 160;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd4ff, size: 0.18, sizeAttenuation: true }));
  }

  setCamera(mode) {
    this.mode = mode;
    if (mode === 'zenith') {
      this.camera.position.set(0, 22, 0.01);
      this.controls.target.set(0, 0, 0);
    } else {
      this.camera.position.set(10, 7, 12);
      this.controls.target.set(0, 0, 0);
    }
    this.controls.update();
  }

  /** Pinta el estado. `view` es SIEMPRE una vista pública o de Keeper ya filtrada por quien mira. */
  render(view) {
    const { starship, combat, isKeeper } = view;
    const targetBand = combat?.targetBand ?? starship.rangeBand;
    // Los anillos se centran en el objetivo elegido: movemos la nave propia al centro visual
    // y colocamos al contacto en el radio de su banda.
    this.ownGroup.position.set(0, 0, 0);
    this.ownGroup.rotation.y = 0;
    // Resaltar el arco de movimiento del Piloto / arco del Artillero
    const highlight = view.highlightArc || null;
    const exposedOwn = (combat?.exposedArcs || []).filter((e) => e.shipId === 'own').map((e) => e.arc);
    if (!this.ownArcs) this.ownArcs = arcIndicators(this.ownGroup, { exposedArcs: exposedOwn, highlight });
    else this._refreshArcs(this.ownArcs, exposedOwn, highlight, starship.shieldArcs);

    // Nave fantasma: solo antes de tirar el Piloto (desaparece tras el Spotlight usado).
    this._clearGhost();
    if (view.ghostBand && !combat?.stationsDone?.includes('pilot')) {
      const p = scenePositionForBand(view.ghostBand, 180);
      this.ghostGroup = shipMesh(COLORS.ghost);
      this.ghostGroup.traverse((o) => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.35; } });
      this.ghostGroup.position.set(p.x, 0, p.z);
      this.scene.add(this.ghostGroup);
    }

    // Contactos enemigos: posición derivada de la banda (km/altura decorativos).
    const seen = new Set();
    for (const c of combat?.contacts || []) {
      seen.add(c.id);
      let entry = this.enemyGroups.get(c.id);
      if (!entry) {
        const g = shipMesh(COLORS.enemy);
        this.scene.add(g);
        entry = { group: g, arcs: null };
        this.enemyGroups.set(c.id, entry);
      }
      const angle = c.heading ?? 0;
      const p = scenePositionForBand(c.band, angle);
      entry.group.position.set(p.x, 0, p.z);
      entry.group.rotation.y = (angle * Math.PI) / 180 + Math.PI; // mira hacia la nave propia
      const exposedEnemy = isKeeper ? (combat?.exposedArcs || []).filter((e) => e.shipId === c.id).map((e) => e.arc) : [];
      const slots = isKeeper ? c.armorSlots : null;
      if (!entry.arcs) entry.arcs = arcIndicators(entry.group, { slots, exposedArcs: exposedEnemy, highlight: view.targetArcByGunner && c.id === combat?.targetContactId ? view.targetArcByGunner : null });
      // Marca SENSOR LOCK sobre el objetivo
      if (c.sensorLock && c.id === combat?.targetContactId && !this.lockSprite) {
        this.lockSprite = this._makeLockLabel();
        this.lockSprite.position.copy(entry.group.position).add(new THREE.Vector3(0, 1.6, 0));
        this.scene.add(this.lockSprite);
      } else if (this.lockSprite && (!(c.sensorLock && c.id === combat?.targetContactId))) {
        this.scene.remove(this.lockSprite); this.lockSprite = null;
      }
    }
    for (const [id, entry] of this.enemyGroups) {
      if (!seen.has(id)) { this.scene.remove(entry.group); this.enemyGroups.delete(id); }
    }
    // Anillo del objetivo resaltado
    for (const ring of this.rings.children) {
      const isTarget = ring.userData.band === targetBand;
      ring.material.color.setHex(isTarget ? COLORS.targetRing : COLORS.ring);
      ring.material.opacity = isTarget ? 0.9 : 0.45;
    }
  }

  _refreshArcs(meshes, exposed, highlight, slots) {
    for (const arc of ARCS) {
      const m = meshes[arc];
      if (!m) continue;
      const on = exposed.includes(arc) || arc === highlight;
      m.material.color.setHex(exposed.includes(arc) ? COLORS.exposed : arc === highlight ? COLORS.arcFore : 0x2a4a66);
      m.material.emissive.setHex(exposed.includes(arc) ? COLORS.exposed : arc === highlight ? COLORS.arcFore : 0x0b1a2a);
      m.material.emissiveIntensity = on ? 0.7 : 0.2;
    }
  }

  _makeLockLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#f5c04e'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 506, 122);
    ctx.fillStyle = '#f5c04e'; ctx.font = 'bold 56px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⌖ SENSOR LOCK', 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(3.2, 0.8, 1);
    return sprite;
  }

  _clearGhost() {
    if (this.ghostGroup) { this.scene.remove(this.ghostGroup); this.ghostGroup = null; }
  }

  _onResize() {
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 500;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._resize);
    this._clearGhost();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Carga diferida: la UI hace `const { mountSpaceScene } = await import('./spaceScene3d.js')`. */
export async function mountSpaceScene(container, view) {
  const scene = new SpaceScene3D(container);
  scene.render(view);
  return scene;
}
