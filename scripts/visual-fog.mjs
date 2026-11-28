// Fog and lights in a real browser (v2.65.1). The map's darkness has broken more than once (v2.63–
// v2.64.6) without any test noticing: the unit tests draw on a fake canvas and cannot see the
// result. This walks one scene in Chromium and measures what the screen shows at fixed points:
//
//   a closed room with a door, a lamp inside and a switch; a party character outside, at night.
//
// Each case checks the darkness of the lighting mask (0 = clear, 255 = black) and, where it
// matters, the brightness of the finished screen. No picture is compared pixel by pixel (fonts and
// antialiasing change); with VISUAL_SHOTS=<folder> a picture of every case is saved to look at.
//
//   npm run test:visual            (starts Vite on port 5181 by itself)
//   VISUAL_URL=http://localhost:5173/ npm run test:visual   (uses a server already running)
//   VISUAL_SHOTS=/tmp/fog npm run test:visual
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Playwright no está instalado: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const PORT = 5181;
let server = null;
async function startServer() {
  if (process.env.VISUAL_URL) return process.env.VISUAL_URL;
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
  const url = `http://localhost:${PORT}/`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return url; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Vite no arrancó en el puerto ' + PORT);
}
const stopServer = () => { if (server) try { process.kill(-server.pid); } catch {} };

// ── The scene (world pixels; 100 px a square, 1.5 m a square: vision 25 m = 1667 px) ─────────────
const ROOM = { x1: 1200, y1: 500, x2: 1600, y2: 900 };
const DOOR = { id: 'v_door', x1: ROOM.x1, y1: 650, x2: ROOM.x1, y2: 750, wallType: 'door', isOpen: false };
const WALLS = [
  { id: 'v_top', x1: ROOM.x1, y1: ROOM.y1, x2: ROOM.x2, y2: ROOM.y1, wallType: 'wall' },
  { id: 'v_right', x1: ROOM.x2, y1: ROOM.y1, x2: ROOM.x2, y2: ROOM.y2, wallType: 'wall' },
  { id: 'v_bottom', x1: ROOM.x2, y1: ROOM.y2, x2: ROOM.x1, y2: ROOM.y2, wallType: 'wall' },
  { id: 'v_left_a', x1: ROOM.x1, y1: ROOM.y1, x2: ROOM.x1, y2: 650, wallType: 'wall' },
  { id: 'v_left_b', x1: ROOM.x1, y1: 750, x2: ROOM.x1, y2: ROOM.y2, wallType: 'wall' },
  DOOR,
];
// Its glow (60 % of the radius) reaches past the right wall: it must not show there.
const LAMP = { id: 'v_lamp', x: 1400, y: 700, radius: 700, color: '#00f3ff', intensity: 0.9, off: true };
const EYE = { x: 700, y: 700 }; // the character, facing the door
const POINTS = {
  room: [1400, 700], // the middle of the room
  behindWall: [1660, 700], // past the room's far wall, never in sight (inside the lamp's glow)
  neverSeen: [300, 1200], // behind the character, never in sight
  near: [900, 700], // two squares ahead: its dark range (5 m) at night
};

async function openScene(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('veil_guide_v1', JSON.stringify({ keeper: { closed: true, done: [], skipped: [] }, player: { closed: true, done: [], skipped: [] } })); } catch {} });
  await page.goto(url);
  await page.waitForSelector('#vf-btn-guest', { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.click('#vf-btn-guest'); await page.waitForTimeout(600);
  await page.click('#vf-btn-join-vtt'); await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelectorAll('.modal-close-btn').forEach(b => b.click()));
  await page.evaluate(async ({ WALLS, LAMP, EYE }) => {
    const { store: s } = await import('/src/state.js'); window.__s = s; await s.ready;
    const eye = s.state.tokens.find(t => /Harker/.test(t.name)), mapId = s.state.activeMapId;
    s.update({ userRole: 'keeper' });
    s.updateActiveMap({ imageUrl: '/tests/fixtures/visual-map.png', gridSize: 100, gridScaleMeters: 1.5, darkness: 1, ambientLight: 0, lightTransitionMs: 0,
      fogExploredOpacity: 0.5, walls: WALLS, lights: [LAMP], switches: [], waterZones: [], effects: [] });
    // Only the character on this scene, without a light of its own.
    s.update({ dice3d: false, tokens: s.state.tokens.map(t => t.id === eye.id
      ? { ...t, mapId, x: EYE.x, y: EYE.y, facingAngle: 0, visionAngle: 90, hasLight: false, hidden: false, inReserve: false }
      : t.mapId === mapId ? { ...t, mapId: 'visual_elsewhere' } : t) });
    s.update({ userRole: 'player', gmVision: false, claimedTokenId: eye.id, selectedTokenId: eye.id });
    s.resetMapFog();
    window.__eye = eye.id;
  }, { WALLS, LAMP, EYE });
  await page.waitForTimeout(2500);
  // Once the scene's image has loaded, start from nothing discovered (what the demo table had
  // explored while the image was changing is forgotten).
  await page.evaluate(() => { window.__s.resetMapFog(); const c = window.veilCanvas; c.zoom = 0.5; c.panX = 720 - 1000 * 0.5; c.panY = 450 - 700 * 0.5; });
  await page.waitForTimeout(1500);
  return { page, errors };
}

// What the screen shows at each point: the lighting mask's darkness and the finished brightness.
const probe = page => page.evaluate(points => {
  const c = window.veilCanvas, mask = c.lighting.lightCanvas.getContext('2d'), d = window.devicePixelRatio || 1;
  return Object.fromEntries(Object.entries(points).map(([name, [x, y]]) => {
    const dark = mask.getImageData(x, y, 1, 1).data[3];
    const v = c.ctx.getImageData((x * c.zoom + c.panX) * d, (y * c.zoom + c.panY) * d, 1, 1).data;
    return [name, { dark, bright: Math.round((v[0] + v[1] + v[2]) / 3) }];
  }));
}, POINTS);

// Each case changes the scene, waits for it to be drawn and checks what is seen.
const set = (page, fn, arg) => page.evaluate(fn, arg).then(() => page.waitForTimeout(1300));
const lamp = on => ({ lights: [{ ...LAMP, off: !on }] });
const CASES = [
  ['Luz apagada: la sala sin descubrir, a oscuras', async p => {},
    v => v.room.dark >= 245 || `oscuridad en la sala ${v.room.dark} (esperado ≥ 245)`],
  ['Luz encendida tras muros sin descubrir: sigue a oscuras (v2.64.6)', p => set(p, patch => window.__s.updateActiveMap(patch), lamp(true)),
    v => (v.room.dark >= 245 && Math.abs(v.room.bright - v.neverSeen.bright) <= 6) || `sala: oscuridad ${v.room.dark}, brillo ${v.room.bright} frente a ${v.neverSeen.bright} de lo nunca visto`],
  ['De cerca, su visión en la oscuridad (5 m)', async p => {},
    v => v.near.dark <= 60 || `a dos casillas: oscuridad ${v.near.dark} (esperado ≤ 60)`],
  ['Visión de Keeper (GM): ve todas las luces', p => set(p, () => window.__s.update({ userRole: 'keeper', gmVision: true })),
    v => v.room.dark <= 100 || `sala con visión de Keeper: oscuridad ${v.room.dark} (esperado ≤ 100)`],
  ['Puerta abierta: la sala iluminada se ve', p => set(p, walls => { window.__s.update({ userRole: 'player', gmVision: false }); window.__s.updateActiveMap({ walls }); },
    WALLS.map(w => w.id === DOOR.id ? { ...w, isOpen: true } : w)),
    v => v.room.dark <= 80 || `sala vista por la puerta: oscuridad ${v.room.dark} (esperado ≤ 80)`],
  ['Con la sala a la vista, el brillo de su luz no cruza el muro del fondo', async p => {},
    v => (v.behindWall.dark >= 245 && Math.abs(v.behindWall.bright - v.neverSeen.bright) <= 6) || `tras el muro: oscuridad ${v.behindWall.dark}, brillo ${v.behindWall.bright} frente a ${v.neverSeen.bright} de lo nunca visto`],
  ['Al girarse, lo descubierto e iluminado sigue a la vista', p => set(p, () => window.__s.updateToken(window.__eye, { facingAngle: Math.PI })),
    v => v.room.dark <= 80 || `sala descubierta y con luz: oscuridad ${v.room.dark} (esperado ≤ 80)`],
  ['Con la luz apagada, lo descubierto queda con el velo (50 %)', p => set(p, patch => window.__s.updateActiveMap(patch), lamp(false)),
    v => Math.abs(v.room.dark - 128) <= 25 || `velo en la sala: ${v.room.dark} (esperado ≈ 128)`],
  ['Velo de la escena al 80 %', p => set(p, () => window.__s.updateActiveMap({ fogExploredOpacity: 0.8 })),
    v => Math.abs(v.room.dark - 204) <= 25 || `velo en la sala: ${v.room.dark} (esperado ≈ 204)`],
  ['Lo nunca visto sigue en negro', async p => {},
    v => (v.neverSeen.dark >= 245 && v.behindWall.dark >= 245) || `nunca visto ${v.neverSeen.dark}, tras el muro ${v.behindWall.dark}`],
  ['«Borrar todo lo descubierto» con la luz encendida: a oscuras', p => set(p, patch => { window.__s.updateActiveMap(patch); window.__s.resetMapFog(); }, { ...lamp(true), fogExploredOpacity: 0.5 }),
    v => v.room.dark >= 245 || `sala tras borrar lo descubierto: oscuridad ${v.room.dark} (esperado ≥ 245)`],
];

const url = await startServer();
const browser = await chromium.launch();
const shots = process.env.VISUAL_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const rows = [];
let failed = 0;
try {
  const { page, errors } = await openScene(browser, url);
  for (const [i, [name, step, check]] of CASES.entries()) {
    let error = '';
    try {
      await step(page);
      const seen = await probe(page);
      const verdict = check(seen);
      if (verdict !== true) error = verdict;
    } catch (e) { error = e.message; }
    if (!error && errors.length) error = 'error en la página: ' + errors[0];
    if (shots) await page.screenshot({ path: `${shots}/${String(i + 1).padStart(2, '0')}-${name.replace(/[^a-z0-9áéíóúñ]+/gi, '_').slice(0, 60)}.png`, clip: { x: 150, y: 150, width: 1100, height: 600 } }).catch(() => {});
    if (error) failed++;
    rows.push([error ? '✕' : '✓', name, error]);
  }
  await page.close();
} finally {
  await browser.close();
  stopServer();
}
console.log('');
for (const [ok, name, error] of rows) console.log(`${ok} ${name}${error ? '\n    ' + error : ''}`);
console.log(failed ? `\n${failed} caso(s) fallan.` : '\nLa niebla y las luces se ven como deben.');
process.exit(failed ? 1 : 0);
