import * as THREE from 'three';
import { d12Model, simulateThrow, topFace, faceNumbers } from './dicePhysics.js';
import { store } from './state.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e } from './ui.js';
import './diceTray.css';
import { DiceSoftwareRenderer } from './diceSoftwareRenderer.js';
export const DICE_THEMES = { crystal: 'Crystal caves', panels: 'Tech panels', circuits: 'Circuits & processors', galaxy: 'Galaxy & stars' };
const palettes = { crystal: ['#68e9ff', '#ed7ac8'], panels: ['#71e8d2', '#ff9759'], circuits: ['#91fba7', '#e9a3ff'], galaxy: ['#81b8ff', '#ff8db9'] };
let tray;
function faceTexture(theme, fear, number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d'), color = palettes[theme][fear ? 1 : 0];
  let seed = 1283 + number * 41; const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  c.fillStyle = fear ? '#251225' : '#0b2836'; c.fillRect(0, 0, 256, 256);
  if (theme === 'crystal') {
    for (let i = 0; i < 28; i++) {
      const x = rand() * 256, y = rand() * 256, r = 20 + rand() * 80;
      const g = c.createLinearGradient(x, y, x + r, y + r); g.addColorStop(0, color + '90'); g.addColorStop(1, color + '05');
      c.fillStyle = g; c.strokeStyle = color + '75'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * .45, y); c.lineTo(x, y + r * .7); c.lineTo(x - r * .3, y); c.closePath(); c.fill(); c.stroke();
    }
  } else if (theme === 'panels') {
    for (let y = 0; y < 256; y += 42) for (let x = 0; x < 256; x += 64) { c.fillStyle = fear ? ((x + y) % 3 ? '#4b2e23' : '#65402f') : ((x + y) % 3 ? '#17473f' : '#235d50'); c.fillRect(x + 3, y + 3, 58, 36); c.strokeStyle = color + '80'; c.strokeRect(x + 4, y + 4, 56, 34); c.fillStyle = color; c.fillRect(x + 8, y + 8, 13, 2); c.fillStyle = '#7f8f9b'; c.fillRect(x + 51, y + 30, 3, 3); }
  } else if (theme === 'circuits') {
    c.strokeStyle = color + 'bc'; c.lineWidth = 1.6;
    for (let i = 0; i < 25; i++) { const x = rand() * 256, y = rand() * 256; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 24, y); c.lineTo(x + 39, y + 15); c.lineTo(x + 80, y + 15); c.stroke(); c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.stroke(); }
    for (let i = 0; i < 9; i++) { const x = rand() * 250, y = rand() * 250; c.fillStyle = '#07111d'; c.fillRect(x, y, 22, 22); c.strokeRect(x, y, 22, 22); for (let n = 3; n < 22; n += 5) { c.fillStyle = color; c.fillRect(x - 3, y + n, 4, 1); c.fillRect(x + 22, y + n, 4, 1); } }
  } else {
    const g = c.createRadialGradient(50, 190, 0, 130, 130, 180); g.addColorStop(0, fear ? '#ad327c' : '#2868a0'); g.addColorStop(.45, '#44245d'); g.addColorStop(1, '#030b20'); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 140; i++) { c.fillStyle = i % 4 ? '#d5e9ff' : color; const x = rand() * 256, y = rand() * 256, r = rand() * 1.3; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); if (i % 35 === 0) { c.fillRect(x - 4, y, 8, .7); c.fillRect(x, y - 4, .7, 8); } }
  }
  c.fillStyle = '#07101aca'; c.beginPath(); c.arc(128, 127, 57, 0, Math.PI * 2); c.fill();
  c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.arc(128, 127, 57, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#f5faff'; c.font = 'bold 66px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(number), 128, 119);
  c.fillStyle = color; c.font = 'bold 13px monospace'; c.fillText(fear ? 'FEAR' : 'HOPE', 128, 157);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; return texture;
}
function makeDie(model, numbers, theme, fear) {
  const group = new THREE.Group(), color = palettes[theme][fear ? 1 : 0];
  model.faces.forEach((face, i) => {
    const positions = [], uv = [], radius = model.vertices[face.indices[0]].distanceTo(face.center);
    const add = p => { positions.push(p.x, p.y, p.z); const delta = p.clone().sub(face.center); uv.push(.5 + .46 * delta.dot(face.u) / radius, .5 + .46 * delta.dot(face.v) / radius); };
    for (let j = 0; j < face.indices.length; j++) { add(face.center); add(model.vertices[face.indices[j]]); add(model.vertices[face.indices[(j + 1) % face.indices.length]]); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.computeVertexNormals();
    const texture = faceTexture(theme, fear, numbers[i]);
    const material = new THREE.MeshPhysicalMaterial({ map: texture, roughness: theme === 'crystal' ? .24 : .5, metalness: theme === 'panels' || theme === 'circuits' ? .35 : .1, clearcoat: .9, clearcoatRoughness: .22, emissive: color, emissiveMap: texture, emissiveIntensity: .12 });
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  });
  const edgeGeo = new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(.958));
  group.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .6 })));
  return group;
}
function disposeGroup(group) { group.traverse(node => { node.geometry?.dispose(); if (node.material) { node.material.map?.dispose(); node.material.dispose(); } }); }
export class DiceTray {
  constructor() {
    this.modal = dossierDialog('3D DICE / ORBITAL TRAY', `
      <div class="tray-toolbar"><div><span class="dossier-eyebrow">PHYSICAL DICE SIMULATION</span><h2>Between hope & fear.</h2></div><label class="dossier-field">Dice finish<vf-select class="hud-select" id="tray_theme">${Object.entries(DICE_THEMES).map(([key, label]) => `<option value="${key}" ${store.state.diceTheme === key ? 'selected' : ''}>${e(label)}</option>`).join('')}</vf-select></label></div>
      <div class="tray-stage" id="tray_stage"><div class="tray-corner tray-corner-left">VEILFARERS / D12</div><div class="tray-corner tray-corner-right">GRAVITY FIELD · ACTIVE</div></div>
      <div class="tray-result" role="status" aria-live="polite"><span class="tray-hope">HOPE <b id="tray_hope">—</b></span><span id="tray_caption">Two forces. One outcome.</span><span class="tray-fear">FEAR <b id="tray_fear">—</b></span></div>
      <div class="tray-footer"><label><input type="checkbox" id="tray_automatic" ${store.state.dice3d !== false ? 'checked' : ''}> Show for game rolls</label><label><input type="checkbox" id="tray_motion" ${store.state.reducedMotion ? 'checked' : ''}> Reduce motion</label><button class="hud-btn" id="tray_demo">Test throw</button></div><p class="dossier-muted" id="tray_note">Test throws are previews and do not change your character or game log.</p>`, 'dice-tray-backdrop');
    this.stage = this.modal.querySelector('#tray_stage'); this.theme = store.state.diceTheme || 'crystal'; this.frame = 0;
    this.modal.querySelector('#tray_theme').onchange = event => { this.theme = event.target.value; store.update({ diceTheme: this.theme }); if (this.lastResult) this.show(this.lastResult, true); };
    this.modal.querySelector('#tray_automatic').onchange = event => store.update({ dice3d: event.target.checked });
    this.modal.querySelector('#tray_motion').onchange = event => store.update({ reducedMotion: event.target.checked });
    this.modal.querySelector('#tray_demo').onclick = () => this.show({ hopeVal: 1 + Math.floor(Math.random() * 12), fearVal: 1 + Math.floor(Math.random() * 12), demo: true });
    this.observer = new MutationObserver(() => { if (!this.modal.isConnected) this.dispose(); }); this.observer.observe(document.body, { childList: true });
    try { this.initScene(); } catch { this.stage.classList.add('tray-unavailable'); this.stage.insertAdjacentHTML('beforeend', '<p>3D rendering is unavailable on this device. Roll results remain available below.</p>'); }
  }
  initScene() {
    try { this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { this.renderer = new DiceSoftwareRenderer(); this.modal.querySelector("#tray_note").textContent = "Compatibility rendering · same 3D geometry and physics. Test throws do not change your game."; }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.4;
    this.renderer.domElement.setAttribute('aria-label', 'Two twelve-sided dice on a futuristic dice mat'); this.stage.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(36, 1, .1, 100); this.camera.position.set(0, 12.5, 9.5); this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xa8d9ff, 0x1f1130, 3));
    const light = new THREE.DirectionalLight(0xe2faff, 5); light.position.set(-3, 10, 5); light.castShadow = true; light.shadow.mapSize.set(1024, 1024); Object.assign(light.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7 }); light.shadow.bias = -.001; this.scene.add(light);
    const rim = new THREE.PointLight(0xe75bd4, 60, 20); rim.position.set(5, 4, -3); this.scene.add(rim);
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
    const mat = new THREE.Mesh(new THREE.BoxGeometry(14, .5, 8), new THREE.MeshStandardMaterial({ map: texture, color: 0xc8e4ff, roughness: .95 })); mat.position.y = -.25; mat.receiveShadow = true; this.scene.add(mat);
    for (const [x, z, w, d] of [[0, -4.1, 14.5, .35], [0, 4.1, 14.5, .35], [-7.1, 0, .35, 8], [7.1, 0, .35, 8]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, .9, d), new THREE.MeshStandardMaterial({ color: 0x1c2d40, roughness: .4, metalness: .65 })); rail.position.set(x, .35, z); rail.castShadow = true; this.scene.add(rail);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, .035, d * .25), new THREE.MeshBasicMaterial({ color: z > 0 ? 0xc657ae : 0x61cfe7 })); strip.position.set(x, .82, z); this.scene.add(strip);
    }
    this.model = d12Model();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.stage); this.resize();
  }
  resize() { if (!this.renderer) return; const w = this.stage.clientWidth, h = this.stage.clientHeight; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.position.set(0, this.camera.aspect < 1.4 ? 19 : 12.5, this.camera.aspect < 1.4 ? 12 : 9.5); this.camera.lookAt(0, 0, 0); this.camera.updateProjectionMatrix(); this.renderer.render(this.scene, this.camera); }
  async show(result, immediate = false) {
    this.lastResult = result; cancelAnimationFrame(this.frame);
    const reduced = immediate || store.state.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hope = this.modal.querySelector('#tray_hope'), fear = this.modal.querySelector('#tray_fear'), caption = this.modal.querySelector('#tray_caption');
    const values = [result.hopeVal, result.fearVal];
    if (values.some(n => !Number.isInteger(n) || n < 1 || n > 12)) return;
    const finish = () => { hope.textContent = values[0]; fear.textContent = values[1]; caption.textContent = result.demo ? 'Preview throw · no game changes' : Number.isFinite(result.total) ? `CHECK TOTAL ${result.total}` : 'Roll resolved'; this.modal.querySelector('#tray_demo').disabled = false; };
    this.modal.querySelector('#tray_demo').disabled = true;
    if (!this.renderer || !this.model) { finish(); return; }
    hope.textContent = fear.textContent = '…'; caption.textContent = 'Dice in motion';
    const frames = simulateThrow(this.model), last = frames.at(-1);
    for (const die of this.dice || []) { this.scene.remove(die); disposeGroup(die); }
    this.dice = values.map((value, i) => { const die = makeDie(this.model, faceNumbers(topFace(this.model, last[i].quaternion), value), this.theme, !!i); this.scene.add(die); return die; });
    const render = frame => { this.dice.forEach((die, i) => { die.position.fromArray(frame[i].position); die.quaternion.fromArray(frame[i].quaternion); }); this.renderer.render(this.scene, this.camera); };
    if (reduced) { render(last); finish(); return; }
    const start = performance.now(), duration = Math.min(frames.length / 60 * 1000, 4300);
    const animate = now => { if (!this.modal.isConnected) return; const progress = Math.min(1, (now - start) / duration); render(frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))]); if (progress < 1) this.frame = requestAnimationFrame(animate); else finish(); };
    this.frame = requestAnimationFrame(animate);
  }
  dispose() { cancelAnimationFrame(this.frame); this.observer?.disconnect(); this.resizeObserver?.disconnect(); if (this.scene) disposeGroup(this.scene); this.renderer?.dispose(); this.renderer?.forceContextLoss(); if (tray === this) tray = null; }
}
export function openDiceTray(result) { if (!tray?.modal.isConnected) tray = new DiceTray(); if (result) tray.show(result); else if (!tray.lastResult) tray.show({ hopeVal: 12, fearVal: 7, demo: true }, true); return tray; }
