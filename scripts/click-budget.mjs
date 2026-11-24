// Click budget (Plan de UX V3, fase 0): walks the player's usual actions in a real browser and
// counts the clicks each one takes. A journey fails if it does not reach its result, or if it
// needs more clicks than its budget. «Meta» is the target of the plan for journeys that still
// take more than it.
//
//   npm run test:clicks            (starts Vite on port 5180 by itself)
//   CLICKS_URL=http://localhost:5173/ npm run test:clicks   (uses a server already running)
//
// It needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
// The online journeys (create a room, join with a link) need Firebase and are checked by hand
// (PRUEBAS_LOCALES.md); here the table runs in local mode with the 3D dice off.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Playwright no está instalado: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const PORT = 5180;
let server = null;
async function startServer() {
  if (process.env.CLICKS_URL) return process.env.CLICKS_URL;
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
  const url = `http://localhost:${PORT}/`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return url; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Vite no arrancó en el puerto ' + PORT);
}
const stopServer = () => { if (server) try { process.kill(-server.pid); } catch {} };

// ── A journey: only `click*` calls are the player's clicks; the rest prepares the table. ───────
class Journey {
  constructor(page, name, budget, meta = budget) { Object.assign(this, { page, name, budget, meta, clicks: 0 }); }
  async click(selector) { await this.page.click(selector); this.clicks++; await this.page.waitForTimeout(350); }
  async clickCard(name) {
    const box = await this.page.evaluate(n => {
      const card = [...document.querySelectorAll('#card_hand_root .vf-card')].find(c => c.getAttribute('aria-label')?.startsWith(n + ' ·'));
      const r = card?.getBoundingClientRect();
      return r && { x: r.x + 14, y: r.y + 30 };
    }, name);
    if (!box) throw new Error(`No está la carta ${name} en la mano.`);
    await this.page.mouse.move(5, 5);
    await this.page.mouse.click(box.x, box.y); this.clicks++;
    await this.page.waitForTimeout(450); // past the double-click window
  }
  async clickToken(id) {
    const point = await this.page.evaluate(tokenId => {
      const t = window.__s.state.tokens.find(x => x.id === tokenId), c = window.veilCanvas, r = c.canvas.getBoundingClientRect(), p = c.worldToScreen(t.x, t.y);
      return { x: r.left + p.x, y: r.top + p.y };
    }, id);
    await this.page.mouse.click(point.x, point.y); this.clicks++;
    await this.page.waitForTimeout(450);
  }
  async until(fn, arg, what, timeout = 20000) {
    try { await this.page.waitForFunction(fn, arg, { timeout }); }
    catch { throw new Error(`no se llegó a: ${what}`); }
  }
}

async function openTable(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('veil_guide_v1', JSON.stringify({ keeper: { closed: true, done: [], skipped: [] }, player: { closed: true, done: [], skipped: [] } })); } catch {} });
  await page.goto(url);
  await page.waitForSelector('#vf-btn-guest', { timeout: 30000 });
  await page.waitForTimeout(1500);
  return { page, errors };
}
// Local table as a player with Harker, the 3D dice off (the rules and the clicks are the same).
async function asPlayer(page, patch = {}) {
  await page.click('#vf-btn-guest'); await page.waitForTimeout(600);
  await page.click('#vf-btn-join-vtt'); await page.waitForTimeout(2500);
  return page.evaluate(async patch => {
    const { store: s } = await import('/src/state.js'); window.__s = s;
    const { loadCardData } = await import('/src/cardData.js'); await loadCardData();
    const harker = s.state.tokens.find(t => /Harker/.test(t.name)), vea = s.state.tokens.find(t => /Vea/.test(t.name)), unit = s.state.tokens.find(t => /HE-09/.test(t.name));
    const foe = s.state.tokens.find(t => t.isPlayer === false && t.mapId === s.state.activeMapId);
    s.update({ userRole: 'keeper' }); // the table is prepared with the Keeper's hands
    // Unarmed, Harker attacks in Melee: the enemy stands next to him, in the lit room.
    s.updateToken(foe.id, { x: harker.x + 64, y: harker.y - 64, hidden: false, evasion: 1 });
    s.updateToken(vea.id, { x: harker.x - 64, y: harker.y + 64 });
    s.update({ dice3d: false, userRole: 'player', claimedTokenId: harker.id, selectedTokenId: harker.id, ...patch });
    return { harker: harker.id, vea: vea.id, unit: unit.id, foe: foe.id };
  }, patch);
}

const JOURNEYS = [
  ['Entrar a la mesa (local)', 2, 2, async j => {
    await j.click('#vf-btn-guest');
    await j.click('#vf-btn-join-vtt');
    await j.until(() => document.getElementById('tactical_canvas') && document.getElementById('vf-lobby-gateway')?.offsetParent === null, null, 'la mesa');
  }],
  ['Tirada de atributo', 2, 2, async (j, ids) => {
    await j.click('[data-pab-trait="agility"]');
    await j.click('[data-pab-trait="agility"]');
    await j.until(id => window.veilDiceRoller?.lastResult?.actorId === id, ids.harker, 'el resultado de la tirada');
  }, true],
  ['Atacar con arma', 4, 3, async (j, ids) => {
    await j.click('[data-pab-weapon]');
    await j.clickToken(ids.foe);
    await j.clickToken(ids.foe);
    await j.until(() => !!document.querySelector('[data-pab-apply]:not([disabled])'), null, 'el daño listo');
    await j.click('[data-pab-apply]');
    await j.until(() => !!document.querySelector('.kdmg, .damage-action-dialog') || /aplicado|Enviado/i.test(document.querySelector('.pab-applied')?.textContent || ''), null, 'el daño en manos del Keeper');
  }, true],
  ['Poder con objetivo (Stellar Lance)', 3, 3, async (j, ids) => {
    await j.clickCard('Stellar Lance');
    await j.clickToken(ids.foe);
    await j.clickToken(ids.foe);
    await j.until(() => window.__s.state.logs.some(l => l.resolution?.name === 'Stellar Lance' && l.resolution.outcome), null, 'la tirada del poder');
  }, true, async (page, ids) => page.evaluate(id => { const s = window.__s, h = s.state.tokens.find(t => t.id === id); s.update({ userRole: 'keeper' }); s.updateToken(id, { hope: 5, sheetFields: { ...(h.sheetFields || {}), a_pwr_5_n: 'Stellar Lance' } }); s.update({ userRole: 'player' }); }, ids.harker)],
  ['Poder del Archivo (Mystic Sleeping)', 3, 3, async (j, ids) => {
    await j.clickCard('Rapid Regeneration');
    await j.clickToken(ids.vea);
    await j.clickToken(ids.vea);
    await j.until(() => window.__s.state.logs.some(l => l.resolution?.name === 'Rapid Regeneration' && l.resolution.outcome), null, 'la tirada de Uncanny Power', 30000);
  }, true, async (page, ids) => page.evaluate(({ unit, vea }) => {
    const s = window.__s, u = s.state.tokens.find(t => t.id === unit);
    s.update({ userRole: 'keeper' });
    s.updateToken(unit, { path: 'Sleeping', characterClass: 'Mystic', level: 3, traits: { ...u.traits, knowledge: 2 }, resolve: { current: 3, max: 3, dieType: 'd4' }, sheetFields: { ...(u.sheetFields || {}), s_archive: 'Synthesis 1' } });
    s.updateToken(vea, { x: u.x - 64, y: u.y });
    s.update({ userRole: 'player', claimedTokenId: unit, selectedTokenId: unit });
  }, ids)],
  ['Elegir personaje (pregenerado)', 1, 1, async j => {
    await j.click('[data-pab-pregen="spark"]');
    await j.until(() => { const s = window.__s, t = s.state.tokens.find(x => /Spark/.test(x.name)); return !!t && s.state.claimedTokenId === t.id; }, null, 'Spark en la mesa y asignada');
  }, true, async page => page.evaluate(() => window.__s.update({ claimedTokenId: null, selectedTokenId: null }))],
  ['Reacción iluminada', 1, 1, async j => {
    await j.click('.reaction-toast [data-use]');
    await j.until(() => window.__answered === true, null, 'la respuesta al Keeper');
  }, true, async (page, ids) => page.evaluate(async vea => {
    const { sendOffer } = await import('/src/reactionOffers.js');
    sendOffer({ name: 'Force Shield', reactors: [{ id: vea, name: 'Vea' }], text: 'Prueba', cost: '1 Hope' }, ({ use }) => { window.__answered = use; });
  }, ids.vea)],
];

const url = await startServer();
const browser = await chromium.launch();
const rows = [];
let failed = 0;
try {
  for (const [name, budget, meta, walk, needsTable, prepare] of JOURNEYS) {
    const { page, errors } = await openTable(browser, url);
    const j = new Journey(page, name, budget, meta);
    let error = '';
    try {
      const ids = needsTable ? await asPlayer(page) : null;
      if (prepare) { await prepare(page, ids); await page.waitForTimeout(900); }
      await walk(j, ids);
      if (j.clicks > budget) error = `${j.clicks} clics; el presupuesto es ${budget}`;
    } catch (e) { error = e.message; }
    if (errors.length) error = error || 'error en la página: ' + errors[0];
    if (error && process.env.CLICKS_SHOTS) await page.screenshot({ path: `${process.env.CLICKS_SHOTS}/${name.replace(/[^a-z0-9]+/gi, '_')}.png` }).catch(() => {});
    if (error) failed++;
    rows.push([error ? '✕' : '✓', name, j.clicks, budget, meta, error]);
    await page.close();
  }
} finally {
  await browser.close();
  stopServer();
}
const pad = (v, n) => String(v).padEnd(n);
console.log(`\n${pad('', 2)}${pad('Recorrido', 40)}${pad('Clics', 7)}${pad('Máx.', 6)}${pad('Meta', 6)}`);
for (const [ok, name, clicks, budget, meta, error] of rows) console.log(`${pad(ok, 2)}${pad(name, 40)}${pad(clicks, 7)}${pad(budget, 6)}${pad(meta, 6)}${error ? ' ' + error : clicks > meta ? ' (por encima de la meta del plan)' : ''}`);
console.log(failed ? `\n${failed} recorrido(s) fallan.` : '\nTodos los recorridos dentro del presupuesto.');
process.exit(failed ? 1 : 0);
