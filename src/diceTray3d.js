import * as THREE from 'three';
import { d12Model, createDiceSimulation, prepareThrow, seededRandom, topFace, PHYSICS_STEP, MAX_THROW_STEPS, TRAY_RAILS, TRAY_SIZE } from './dicePhysics.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { store } from './state.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { createDiceMaps, DICE_THEMES, DICE_PALETTES } from './diceMaterials.js';
import { createDiceTrayPanel } from './diceTrayPanel.js';
import './diceTray.css';
export { DICE_THEMES };
let tray;
function makeDie(model, numbers, theme, fear) {
  const group = new THREE.Group(), color = fear ? DICE_PALETTES.fear : DICE_PALETTES.hope;
  // Real chamfer geometry catches the studio light along edges and corners.
  // The broad face planes retain the collider's contact height.
  const inset = (face, id) => model.vertices[id].clone().lerp(face.center, .065);
  const shell = new THREE.Mesh(new ConvexGeometry(model.faces.flatMap(face => face.indices.map(id => inset(face, id)))), new THREE.MeshPhysicalMaterial({ color: theme === 'crystal' ? color : 0x263849, metalness: theme === 'crystal' ? .15 : .7, roughness: .23, clearcoat: 1 }));
  shell.castShadow = shell.receiveShadow = true; group.add(shell);
  model.faces.forEach((face, i) => {
    const positions = [], uv = [], radius = model.vertices[face.indices[0]].distanceTo(face.center);
    const add = p => { positions.push(p.x, p.y, p.z); const delta = p.clone().sub(face.center); uv.push(.5 + .46 * delta.dot(face.u) / radius, .5 + .46 * delta.dot(face.v) / radius); };
    for (let j = 0; j < face.indices.length; j++) { add(face.center.clone().addScaledVector(face.normal, .001)); add(inset(face, face.indices[j]).addScaledVector(face.normal, .001)); add(inset(face, face.indices[(j + 1) % face.indices.length]).addScaledVector(face.normal, .001)); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.computeVertexNormals();
    const maps = createDiceMaps(theme, fear, numbers[i]);
    const material = new THREE.MeshPhysicalMaterial({ ...maps,
      roughness: { crystal: .2, panels: .38, circuits: .4, galaxy: .23 }[theme],
      metalness: { crystal: .08, panels: .65, circuits: .42, galaxy: .12 }[theme],
      bumpScale: theme === 'crystal' ? .018 : theme === 'galaxy' ? 0 : .012,
      clearcoat: 1, clearcoatRoughness: .15, envMapIntensity: .85,
      emissive: 0xffffff, emissiveIntensity: .32,
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  });
  return group;
}
function disposeGroup(group) {
  const textures = new Set();
  group.traverse(node => { node.geometry?.dispose(); for (const material of [node.material].flat().filter(Boolean)) { for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); material.dispose(); } });
  textures.forEach(texture => texture.dispose());
}
export class DiceTray {
  constructor() {
    this.modal = createDiceTrayPanel({ theme: store.state.diceTheme, automatic: store.state.dice3d !== false, reducedMotion: store.state.reducedMotion });
    this.stage = this.modal.querySelector('#tray_stage'); this.theme = DICE_THEMES[store.state.diceTheme] ? store.state.diceTheme : 'crystal'; this.frame = 0;
    this.modal.querySelector('#tray_theme').onchange = event => { if (!DICE_THEMES[event.target.value]) return; this.theme = event.target.value; store.update({ diceTheme: this.theme }); this.rebuildDice(); };
    this.modal.querySelector('#tray_automatic').onchange = event => store.update({ dice3d: event.target.checked });
    this.modal.querySelector('#tray_motion').onchange = event => store.update({ reducedMotion: event.target.checked });
    this.modal.querySelector('#tray_demo').onclick = () => this.show({ demo: true });
    this.observer = new MutationObserver(() => { if (!this.modal.isConnected) this.dispose(); }); this.observer.observe(this.modal.parentElement, { childList: true });
    this.modal.querySelector('#tray_reset_camera').onclick = () => this.resetCamera();
    for (const [selector, angle] of [['#tray_rotate_left', .25], ['#tray_rotate_right', -.25]]) this.modal.querySelector(selector).onclick = () => {
      if (!this.controls) return;
      this.camera.position.sub(this.controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(this.controls.target);
      this.controls.update(); this.renderFrame();
    };
    try { this.initScene(); } catch { this.unavailable('WebGL 2 is unavailable. Enable graphics acceleration in your browser, then reopen the tray.'); }
  }
  initScene() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); if (this.disposed) return; this.finishRoll?.();
      this.unavailable('The 3D graphics context was lost. Your game result is preserved. Reopen the tray to reconnect.');
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute('aria-label', 'Two twelve-sided dice on a futuristic dice mat'); this.stage.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(36, 1, .1, 100); this.camera.position.set(0, 12.5, 9.5); this.camera.lookAt(0, 0, 0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false; this.controls.minDistance = 10; this.controls.maxDistance = 25;
    this.controls.minPolarAngle = .12; this.controls.maxPolarAngle = Math.PI / 2 - .12;
    this.controls.addEventListener('change', () => this.renderFrame());
    const pmrem = new THREE.PMREMGenerator(this.renderer), environment = new RoomEnvironment();
    this.environment = pmrem.fromScene(environment, .04); this.scene.environment = this.environment.texture;
    environment.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xa8d9ff, 0x1f1130, 1.5));
    const light = new THREE.DirectionalLight(0xe2faff, 3.5); light.position.set(-3, 10, 5); light.castShadow = true; light.shadow.mapSize.set(1024, 1024); Object.assign(light.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7 }); light.shadow.bias = -.001; this.scene.add(light);
    const rim = new THREE.PointLight(0xe75bd4, 22, 20); rim.position.set(5, 4, -3); this.scene.add(rim);
    const matCanvas = document.createElement('canvas'); matCanvas.width = 1024; matCanvas.height = 640;
    const c = matCanvas.getContext('2d'); c.fillStyle = '#0b1824'; c.fillRect(0, 0, 1024, 640);
    for (let y = 0; y < 640; y += 4) { c.strokeStyle = y % 8 ? '#112434' : '#142839'; c.beginPath(); c.moveTo(0, y); c.lineTo(1024, y); c.stroke(); }
    c.strokeStyle = '#66bedf55'; c.lineWidth = 2; c.strokeRect(26, 26, 972, 588); c.strokeRect(33, 33, 958, 574);
    c.save(); c.translate(512, 320); c.strokeStyle = '#558aa740';
    for (const r of [75, 86, 165, 175]) { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); }
    for (let i = 0; i < 60; i++) { c.save(); c.rotate(i * Math.PI / 30); c.beginPath(); c.moveTo(165, 0); c.lineTo(i % 5 ? 170 : 180, 0); c.stroke(); c.restore(); }
    c.rotate(Math.PI / 4); c.strokeRect(-45, -45, 90, 90); c.restore();
    c.fillStyle = '#9ac9dd75'; c.textAlign = 'center'; c.font = '16px monospace'; c.fillText('V E I L F A R E R S', 512, 560); c.font = '10px monospace'; c.fillText('ORBITAL DICE ARRAY   /   HOPE + FEAR', 512, 584);
    const texture = new THREE.CanvasTexture(matCanvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.Mesh(new THREE.BoxGeometry(TRAY_SIZE.width, .5, TRAY_SIZE.depth), new THREE.MeshStandardMaterial({ map: texture, color: 0xc8e4ff, roughness: .95 })); mat.position.y = -.25; mat.receiveShadow = true; this.scene.add(mat);
    for (const { position: [x, y, z], size: [w, h, d] } of TRAY_RAILS) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x1c2d40, roughness: .4, metalness: .65 })); rail.position.set(x, y, z); rail.castShadow = true; this.scene.add(rail);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, .035, d * .25), new THREE.MeshBasicMaterial({ color: z > 0 ? 0xc657ae : 0x61cfe7 })); strip.position.set(x, y + h / 2 + .018, z); this.scene.add(strip);
    }
    this.model = d12Model();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.stage); this.resize();
  }
  renderFrame() { if (this.renderer && this.scene && this.camera && !this.failed) this.renderer.render(this.scene, this.camera); }
  resetCamera() {
    if (!this.camera || !this.controls) return;
    this.controls.target.set(0, 0, 0);
    const distance = Math.max(15.7, 24 / this.camera.aspect);
    this.camera.position.set(0, distance * .87, distance * .49);
    this.controls.update(); this.renderFrame();
  }
  resize() {
    if (!this.renderer || this.failed) return;
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (!this.sized) { this.sized = true; this.resetCamera(); }
    this.renderFrame();
  }
  unavailable(message) {
    this.failed = true; cancelAnimationFrame(this.frame);
    this.renderer?.domElement.remove(); this.stage.classList.add('tray-unavailable');
    this.stage.querySelector('.tray-support-message')?.remove();
    const notice = document.createElement('p'); notice.className = 'tray-support-message'; notice.setAttribute('role', 'status'); notice.textContent = message; this.stage.append(notice);
    this.modal.querySelector('#tray_engine').textContent = '3D UNAVAILABLE';
    this.modal.querySelector('#tray_note').textContent = 'Game rolls remain available in the result panel and log.';
    for (const selector of ['#tray_demo', '#tray_rotate_left', '#tray_rotate_right', '#tray_reset_camera', '#tray_theme']) this.modal.querySelector(selector).disabled = true;
  }
  rebuildDice() {
    if (!this.renderer || this.failed || !this.numbers) return;
    const pose = this.simulation?.snapshot();
    for (const die of this.dice || []) { this.scene.remove(die); disposeGroup(die); }
    this.dice = this.numbers.map((numbers, i) => { const die = makeDie(this.model, numbers, this.theme, !!i); this.scene.add(die); return die; });
    if (pose) this.applyPose(pose);
    this.renderFrame();
  }
  applyPose(pose) { this.dice.forEach((die, i) => { die.position.fromArray(pose[i].position); die.quaternion.fromArray(pose[i].quaternion); }); }
  show(result, immediate = false) {
    this.modal.toggleAttribute('data-keeper-only', result.visibility === 'keeper');
    cancelAnimationFrame(this.frame); this.lastResult = result;
    const hope = this.modal.querySelector('#tray_hope'), fear = this.modal.querySelector('#tray_fear'), caption = this.modal.querySelector('#tray_caption');
    const values = [result.hopeVal, result.fearVal], valid = values.every(n => Number.isInteger(n) && n >= 1 && n <= 12);
    if (!result.demo && !valid) return;
    if (this.failed || !this.renderer || !this.model) {
      hope.textContent = valid ? values[0] : '—'; fear.textContent = valid ? values[1] : '—';
      caption.textContent = valid ? 'Game result · 3D unavailable' : 'WebGL 2 required'; return;
    }
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    let plan;
    try { plan = prepareThrow(this.model, result.demo ? null : values, seed); }
    catch (error) { hope.textContent = values[0] ?? '—'; fear.textContent = values[1] ?? '—'; caption.textContent = error.message; this.modal.querySelector('#tray_demo').disabled = false; return; }
    this.numbers = plan.numbers;
    this.simulation = createDiceSimulation(this.model, seededRandom(plan.seed));
    this.rebuildDice();
    this.modal.querySelector('#tray_demo').disabled = true;
    hope.textContent = fear.textContent = '…'; caption.textContent = 'Rolling…';
    this.finishRoll = () => {
      if (result.demo && this.simulation.settled) this.simulation.snapshot().forEach((body, i) => values[i] = this.numbers[i][topFace(this.model, body.quaternion)]);
      hope.textContent = values[0] ?? '—'; fear.textContent = values[1] ?? '—';
      caption.textContent = result.demo ? 'Test throw' : Number.isFinite(result.total) ? `CHECK TOTAL ${result.total}` : 'Roll resolved';
      this.modal.querySelector('#tray_demo').disabled = false;
    };
    const reduced = immediate || store.state.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      while (!this.simulation.settled && this.simulation.steps < MAX_THROW_STEPS) this.simulation.step();
      this.applyPose(this.simulation.snapshot()); this.renderFrame(); this.finishRoll(); return;
    }
    let previous = performance.now(), accumulator = 0;
    const animate = now => {
      if (!this.modal.isConnected || this.failed) return;
      accumulator += Math.min(.1, Math.max(0, (now - previous) / 1000)); previous = now;
      while (accumulator >= PHYSICS_STEP && !this.simulation.settled && this.simulation.steps < MAX_THROW_STEPS) {
        this.simulation.step(); accumulator -= PHYSICS_STEP;
      }
      this.applyPose(this.simulation.snapshot()); this.renderFrame();
      if (this.simulation.settled) this.finishRoll();
      else if (this.simulation.steps >= MAX_THROW_STEPS) {
        this.finishRoll(); caption.textContent = result.demo ? 'Dice did not settle. Throw again.' : 'Game result preserved · dice did not settle';
      } else this.frame = requestAnimationFrame(animate);
    };
    this.frame = requestAnimationFrame(animate);
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    cancelAnimationFrame(this.frame); this.observer?.disconnect(); this.resizeObserver?.disconnect(); this.controls?.dispose();
    if (this.scene) disposeGroup(this.scene); this.environment?.dispose(); this.renderer?.dispose(); this.renderer?.forceContextLoss();
    if (tray === this) tray = null;
  }
}
export function openDiceTray(result) { if (!tray?.modal.isConnected) tray = new DiceTray(); if (result) tray.show(result); else if (!tray.lastResult) tray.show({ demo: true }, true); return tray; }
