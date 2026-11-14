import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const indexHtml = read('../index.html');
const dom = new JSDOM(indexHtml, { url: 'http://localhost/' });
for (const key of ['window', 'document', 'localStorage', 'CustomEvent', 'HTMLElement']) globalThis[key] = dom.window[key];
const { VeilfarersLobbyGateway } = await import('../src/vtt-integration/modules/lobbyGateway.js');
after(() => dom.window.close());

const flat = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim();

test('the portal markup in index.html matches the lobby template, so both render the same lobby', () => {
  const source = read('../src/vtt-integration/modules/lobbyGateway.js');
  const template = source.slice(source.indexOf('root.innerHTML = `') + 18, source.indexOf('`;\n    document.body.appendChild(root);'));
  const start = indexHtml.indexOf('<div id="vf-lobby-gateway" class="vf-lobby-gateway">') + 52;
  const page = indexHtml.slice(start, indexHtml.indexOf('<div id="app_root">'));
  assert.equal(flat(page).replace(/<\/div>$/, ''), flat(template));
});

test('the lobby keeps the consolidated entry points and numbers its cells', () => {
  new VeilfarersLobbyGateway();
  for (const id of ['role-btn-player', 'role-btn-keeper', 'vf-btn-join-vtt', 'vf-join-code-input', 'vf-user-welcome', 'vf-user-email', 'vf-import-json', 'vf-btn-guest', 'vf-btn-google'])
    assert.ok(document.getElementById(id), id);
  assert.deepEqual([...document.querySelectorAll('#vf-auth-screen .fx-num')].map(n => n.textContent), ['01', '02']);
  assert.deepEqual([...document.querySelectorAll('#vf-player-section .fx-num, .vf-hero-role-selector .fx-num')].map(n => n.textContent).sort(), ['01', '02', '03', '04']);
  // Entering the table is never an advanced-only option (HANDOVER.md §1).
  for (const id of ['vf-btn-join-vtt', 'vf-btn-join-code', 'vf-btn-create-room']) assert.equal(document.getElementById(id).closest('.fx-advanced'), null, id);
});

test('Básico is the default view; the switch marks the lobby and is remembered', () => {
  localStorage.removeItem('veil_lobby_mode');
  const gateway = new VeilfarersLobbyGateway(), root = document.getElementById('vf-lobby-gateway');
  assert.equal(root.dataset.lobbyMode, 'basic');
  assert.equal(document.getElementById('vf-mode-basic').getAttribute('aria-pressed'), 'true');
  document.getElementById('vf-mode-advanced').click();
  assert.equal(root.dataset.lobbyMode, 'advanced');
  assert.equal(localStorage.getItem('veil_lobby_mode'), 'advanced');
  assert.ok(document.getElementById('vf-mode-advanced').classList.contains('active'));
  assert.equal(new VeilfarersLobbyGateway().lobbyMode, 'advanced');
  gateway.setLobbyMode('unknown');
  assert.equal(root.dataset.lobbyMode, 'basic');
});

test('the lobby stylesheet carries the approved violet palette and hides advanced options in Básico', () => {
  const css = read('../src/vtt-integration/styles/lobby-fates.css');
  for (const color of ['#0d0420', '#2a0b5c', '#6d28d9', '#c084fc', '#fde68a']) assert.ok(css.includes(color), color);
  assert.match(css, /\[data-lobby-mode='basic'\] \.fx-advanced \{ display: none !important; \}/);
  assert.ok(read('../src/main.js').includes("lobby-fates.css"));
});
