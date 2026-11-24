import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
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

test('the violet table theme restyles the frame only and leaves every in-game colour variable alone', () => {
  const css = read('../src/theme-violet.css');
  for (const color of ['#0d0420', '#2a0b5c', '#6d28d9', '#c084fc', '#fde68a']) assert.ok(css.includes(color), color);
  for (const variable of ['--cyan-pearl', '--cyan-glow', '--crimson-fear', '--purple-void', '--amber-warn', '--emerald-tech'])
    assert.ok(!new RegExp(variable + '\\s*:').test(css), variable + ' must not be redefined');
  // Containers of the dice panel may be restyled; anything that carries a game colour may not.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/token-quickbar|roster-token-card/g, '');
  assert.ok(!/vf-callout|vf-results|vf-dice|texture-pill|duality|hope|fear|token-|\.pip\b|(?<!:not\()\.active/i.test(rules), 'no dice theme, token, Hope, Fear or active-state selectors');
  assert.ok(read('../src/main.js').includes("theme-violet.css"));
});

test('the portal and the account use one Firebase project, so a signed-in user finds their rooms', async () => {
  const { getFirebaseConfig, DEFAULT_FIREBASE_CONFIG } = await import('../src/firebaseConfig.js');
  const client = await import('../src/vtt-integration/modules/firebaseClient.js');
  assert.equal(client.getFirebaseConfig, getFirebaseConfig);
  assert.equal(getFirebaseConfig().projectId, DEFAULT_FIREBASE_CONFIG.projectId);
  const account = read('../src/cloudAccount.js');
  assert.match(account, /cloudConfig = env \? getFirebaseConfig\(\)/);
  // Outside the Vite build nothing reaches the cloud by accident.
  assert.equal((await import('../src/cloudAccount.js')).cloudConfigured, false);
});

test('a failed room lookup is shown as an error with a retry, never as an empty list', async () => {
  const { rooms } = await import('../src/roomController.js');
  const gateway = new VeilfarersLobbyGateway(), original = rooms.service.list;
  const warn = console.warn; console.warn = () => {};
  try {
    await new Promise(r => setTimeout(r, 60)); // let the initial signed-out auth event pass
    gateway.currentUser = { uid: 'user-1', displayName: 'Pedro' };
    rooms.service.list = async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); };
    await gateway.loadRoomsList();
    const keeperList = document.getElementById('vf-keeper-rooms-list');
    assert.match(keeperList.textContent, /No se han podido cargar tus salas/);
    assert.match(keeperList.textContent, /reglas de Firestore/);
    assert.ok(!/No tienes salas creadas/.test(keeperList.textContent));
    rooms.service.list = async () => [{ id: 'room_1', name: 'Nave 1', ownerUid: 'user-1', inviteCode: 'NAV-33F44' }];
    keeperList.querySelector('.btn-retry-rooms').click();
    await new Promise(r => setTimeout(r, 20));
    assert.match(keeperList.textContent, /Nave 1/); assert.match(keeperList.textContent, /NAV-33F44/);
    // A guest never queries the cloud and still gets the local table.
    let called = false; rooms.service.list = async () => { called = true; return []; };
    gateway.currentUser = { uid: 'guest_1' };
    await gateway.loadRoomsList();
    assert.equal(called, false);
    assert.match(document.getElementById('vf-player-rooms-list').textContent, /Mesa Principal/);
  } finally { rooms.service.list = original; console.warn = warn; rooms.unsubscribeStore?.(); }
});

test('a room that cannot be opened brings the user back to the lobby with the reason', async () => {
  const { rooms } = await import('../src/roomController.js');
  const gateway = new VeilfarersLobbyGateway(), enter = rooms.enter, list = rooms.service.list;
  const warn = console.warn; console.warn = () => {};
  try {
    gateway.currentUser = { uid: 'user-1' };
    rooms.service.list = async () => [];
    rooms.enter = async () => { throw new Error('La sala ya no existe.'); };
    gateway.hideLobby();
    await gateway.runRoomAction(r => r.enter('room_x'), 'No se pudo abrir la sala');
    assert.ok(!document.getElementById('vf-lobby-gateway').classList.contains('hidden'));
    const error = document.getElementById('vf-hub-error');
    assert.equal(error.hidden, false); assert.match(error.textContent, /No se pudo abrir la sala: La sala ya no existe/);
  } finally { rooms.enter = enter; rooms.service.list = list; console.warn = warn; }
});

test('the lobby library is the signed-in user\'s own: it lists, imports and deletes account characters, and a guest has none', async () => {
  const { account } = await import('../src/cloudAccount.js');
  const gateway = new VeilfarersLobbyGateway(), list = document.getElementById('vf-vault-list');
  const original = { list: account.list, save: account.saveCharacter, remove: account.removeCharacter }, confirmBefore = globalThis.confirm;
  const sheet = name => JSON.stringify({ app: 'Veilfarers VTT Actor', version: 1, token: { name, species: 'Human', characterClass: 'Pilot', path: 'Awakened', level: 2, evasion: 11, hp: { current: 5, max: 6 }, stress: { current: 0, max: 6 }, armor: { current: 3, max: 3 } } });
  let rows = [{ id: 'c1', name: 'Maren <b>Solas</b>', payload: sheet('Maren'), updatedAt: 1 }];
  const saved = [], removed = [];
  try {
    await new Promise(r => setTimeout(r, 60));
    account.list = async kind => { assert.equal(kind, 'characters'); return rows; };
    account.saveCharacter = async token => { saved.push(token); rows = [...rows, { id: 'c2', name: token.name, payload: sheet(token.name), updatedAt: 2 }]; };
    account.removeCharacter = async id => { removed.push(id); rows = rows.filter(r => r.id !== id); };
    gateway.currentUser = { uid: 'guest_1' };
    await gateway.loadCharacters();
    assert.match(list.textContent, /modo invitado/i);
    gateway.currentUser = { uid: 'user-1' };
    await gateway.loadCharacters();
    assert.equal(list.querySelectorAll('.vault-char-card').length, 1);
    assert.equal(list.querySelector('h4').textContent, 'Maren <b>Solas</b>'); assert.equal(list.querySelectorAll('h4 b').length, 0);
    assert.match(list.textContent, /Pilot/); assert.match(list.textContent, /Nivel 2/);
    assert.ok(list.querySelector('.vault-card-actions').classList.contains('fx-advanced'));
    // Import: a sheet file goes to the account, never to a shared store.
    const file = { text: async () => sheet('Vell') };
    await gateway.handleImportJSON({ target: { files: [file], value: 'x' } });
    assert.equal(saved[0].name, 'Vell'); assert.equal(list.querySelectorAll('.vault-char-card').length, 2);
    await gateway.handleImportJSON({ target: { files: [{ text: async () => 'not json' }], value: 'x' } });
    assert.match(document.getElementById('vf-hub-error').textContent, /No se pudo importar la ficha/);
    globalThis.confirm = () => true;
    list.querySelector('.btn-delete-char').click(); await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(removed, ['c1']); assert.equal(list.querySelectorAll('.vault-char-card').length, 1);
    account.list = async () => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); };
    await gateway.loadCharacters();
    assert.match(list.textContent, /No se han podido cargar tus personajes/);
    // Nothing in the lobby reads or writes the old shared vault any more.
    const source = read('../src/vtt-integration/modules/lobbyGateway.js');
    assert.ok(!source.includes('character_vault') && !source.includes('firebase/database'));
  } finally { Object.assign(account, { list: original.list, saveCharacter: original.save, removeCharacter: original.remove }); globalThis.confirm = confirmBefore; }
});

test('Plan de UX V3: Básico starts with Crear partida, Unirme and Continuar, and one list of games', () => {
  const gateway = new VeilfarersLobbyGateway();
  gateway.setLobbyMode('basic');
  for (const id of ['vf-quick-create', 'vf-join-code-input', 'vf-btn-join-code', 'vf-quick-continue', 'vf-quick-rooms-list', 'vf-btn-join-vtt'])
    assert.equal(document.getElementById(id)?.closest('.fx-advanced, .vf-hub-section-view, .vf-hero-role-selector'), null, id + ' visible in Básico');
  const css = read('../src/vtt-integration/styles/lobby-fates.css');
  assert.match(css, /\[data-lobby-mode='basic'\] \.vf-hero-role-selector,\s*#vf-lobby-gateway\[data-lobby-mode='basic'\] \.vf-hub-section-view \{ display: none; \}/);
  // One list: the rooms you run and the ones you play, the last one first and in «Continuar».
  gateway.currentUser = { uid: 'u1', displayName: 'Ana' };
  localStorage.setItem('veil.room.active.u1', 'r2');
  gateway.renderQuickRooms([{ id: 'r1', name: 'Mi campaña', ownerUid: 'u1' }], [{ id: 'r2', name: 'La de Pedro' }]);
  const rows = [...document.querySelectorAll('#vf-quick-rooms-list .btn-quick-enter')].map(b => [b.dataset.roomId, b.dataset.role]);
  assert.deepEqual(rows, [['r2', 'player'], ['r1', 'keeper']]);
  const cont = document.getElementById('vf-quick-continue');
  assert.equal(cont.hidden, false);
  assert.deepEqual([cont.dataset.roomId, cont.dataset.role], ['r2', 'player']);
  assert.match(document.getElementById('vf-quick-continue-name').textContent, /La de Pedro · Jugador/);
  // Without an account there is no online room to create: it says why and where to play.
  gateway.currentUser = { uid: 'guest_1' };
  gateway.quickCreate();
  assert.match(document.getElementById('vf-hub-error').textContent, /inicia sesión/);
});

test('Plan de UX V3: invited with a link, the code is filled in and only a name is asked for', async () => {
  globalThis.location = dom.window.location;
  dom.window.location.hash = 'roomInvite=VEI-8H2FA';
  document.getElementById('vf-invite-code').value = '';
  const gateway = new VeilfarersLobbyGateway();
  assert.equal(document.getElementById('vf-invite-code').value, 'VEI-8H2FA');
  assert.equal(document.getElementById('vf-auth-screen').dataset.invited, 'true');
  await gateway.joinWithoutAccount('  ', 'VEI-8H2FA');
  assert.match(document.getElementById('vf-auth-error').textContent, /nombre/);
  await gateway.joinWithoutAccount('Ana', '');
  assert.match(document.getElementById('vf-auth-error').textContent, /código/);
  dom.window.location.hash = '';
});
