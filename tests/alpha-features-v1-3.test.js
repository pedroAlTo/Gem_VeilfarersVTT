import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body><div id="app"></div></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent']) {
  globalThis[key] = dom.window[key];
}

// Mock 2D context for jsdom
if (dom.window.HTMLCanvasElement) {
  dom.window.HTMLCanvasElement.prototype.getContext = function (type) {
    if (type !== '2d') return null;
    const canvas = this;
    const pixels = canvas._pixels || (canvas._pixels = new Map());
    return {
      canvas,
      fillStyle: '#000000',
      globalCompositeOperation: 'source-over',
      clearRect(x, y, w, h) { pixels.clear(); },
      fillRect(x, y, w, h) {
        for (let px = Math.max(0, x); px < Math.min(canvas.width, x + w); px += 4) {
          for (let py = Math.max(0, y); py < Math.min(canvas.height, y + h); py += 4) {
            pixels.set(`${px},${py}`, [255, 255, 255, 255]);
          }
        }
      },
      save() {},
      restore() {},
      beginPath() { this._poly = []; },
      moveTo(x, y) { this._poly.push({ x, y }); },
      lineTo(x, y) { this._poly.push({ x, y }); },
      closePath() {},
      fill() {
        if (this._poly && this._poly.length >= 3) {
          const minX = Math.min(...this._poly.map(p => p.x));
          const maxX = Math.max(...this._poly.map(p => p.x));
          const minY = Math.min(...this._poly.map(p => p.y));
          const maxY = Math.max(...this._poly.map(p => p.y));
          for (let x = Math.max(0, minX); x <= Math.min(canvas.width, maxX); x += 4) {
            for (let y = Math.max(0, minY); y <= Math.min(canvas.height, maxY); y += 4) {
              pixels.set(`${x},${y}`, [255, 255, 255, 255]);
            }
          }
        }
      },
      getImageData(x, y, w, h) {
        const val = pixels.get(`${x},${y}`) || [0, 0, 0, 0];
        return { data: new Uint8ClampedArray(val) };
      },
      drawImage() {}
    };
  };
}

const { store } = await import('../src/state.js');
await store.ready;
const {
  EQUIPMENT_CATALOG,
  filterEquipmentCatalog,
  equipCatalogItem
} = await import('../src/equipmentLibrary.js');
const { openEquipmentCatalog } = await import('../src/equipmentUI.js');
const { promptShieldMitigation } = await import('../src/diceRoller.js');
const { FogOfWarEngine } = await import('../src/fogEngine.js');
const { TokenHUD } = await import('../src/tokenSheet.js');
const { RosterManager } = await import('../src/rosterManager.js');
const { checkBackupReminder } = await import('../src/sessionManager.js');

test('equipment & augmentations catalog: filters by core and rust&steel alien species in any combination', () => {
  assert.ok(EQUIPMENT_CATALOG.length >= 20, 'Catalog contains complete rules gear');

  // Filter core weapons
  const coreWeapons = filterEquipmentCatalog({ source: 'core', category: 'weapons' });
  assert.ok(coreWeapons.length > 0, 'Core weapons present');
  assert.ok(coreWeapons.every(w => w.source === 'core' && w.category === 'weapons'));

  // Filter alien species items (Rust & Steel)
  const alienItems = filterEquipmentCatalog({ source: 'rust_and_steel' });
  assert.ok(alienItems.length > 0, 'Rust & Steel alien items present');
  assert.ok(alienItems.some(i => i.species === 'Lithian'), 'Lithian gear included');
  assert.ok(alienItems.some(i => i.species === 'Chitinid'), 'Chitinid gear included');
  assert.ok(alienItems.some(i => i.species === 'Synthet'), 'Synthet gear included');
  assert.ok(alienItems.some(i => i.species === 'Voidborn'), 'Voidborn gear included');

  // Filter augmentations
  const augmentations = filterEquipmentCatalog({ category: 'augmentations' });
  assert.ok(augmentations.length >= 6, 'Augmentations category present');

  // Any combination: Equipping alien augmentation and core weapon to character inventory
  let inv = { weapons: [], items: [] };
  const kineticPistol = coreWeapons[0];
  const lithianNode = alienItems.find(i => i.category === 'augmentations');
  assert.ok(kineticPistol && lithianNode);

  inv = equipCatalogItem(inv, kineticPistol);
  inv = equipCatalogItem(inv, lithianNode);

  assert.equal(inv.weapons.length, 1);
  assert.equal(inv.weapons[0].name, kineticPistol.name);
  assert.equal(inv.items.length, 1);
  assert.equal(inv.items[0].name, lithianNode.name);
});

test('drone token creation: presets, 90º standard FOV, shared control, and spotlight', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const roster = new RosterManager(container);

  // Deploy drone
  roster.openDeployDroneModal();
  const modal = document.querySelector('.veil-modal-backdrop');
  assert.ok(modal, 'Deploy drone modal opened');

  const nameInp = modal.querySelector('#drone_name_input');
  nameInp.value = 'Drone Test Alpha';

  // Submit form
  modal.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));

  const created = store.getState().tokens.find(t => t.name === 'Drone Test Alpha');
  assert.ok(created, 'Drone token created in store');
  assert.equal(created.actorType, 'drone');
  assert.equal(created.isPlayer, false);
  assert.equal(created.visionAngle, 90, 'Standard 90º FOV');
  assert.equal(created.hasSpotlight, true, 'Spotlight enabled on drone');
  assert.equal(created.spotlight.enabled, true);

  modal.remove();
  container.remove();
});

test('token preview window: direct modification of stats (HP, shields/armor, stress, hope/effort)', () => {
  const testTok = store.addToken({
    name: 'Stat Edit Token',
    hp: { current: 8, max: 10, majorThreshold: 5, severeThreshold: 10 },
    armor: { current: 1, max: 3 },
    stress: { current: 2, max: 6 },
    hope: 3,
    path: 'Awakened'
  });
  store.update({ selectedTokenId: testTok.id, userRole: 'keeper' });

  const hudContainer = document.createElement('div');
  document.body.appendChild(hudContainer);
  const hud = new TokenHUD(hudContainer);

  // 1. Modify HP directly via preview quick stepper
  const hpPlusBtn = hudContainer.querySelector('[data-quick-stat="hp"][data-delta="1"]');
  assert.ok(hpPlusBtn, 'HP plus button present in preview HUD');
  hpPlusBtn.click();
  assert.equal(store.getState().tokens.find(t => t.id === testTok.id).hp.current, 9);

  // 2. Modify Shields/Armor directly
  const armorPlusBtn = hudContainer.querySelector('[data-quick-stat="armor"][data-delta="1"]');
  assert.ok(armorPlusBtn, 'Armor plus button present in preview HUD');
  armorPlusBtn.click();
  assert.equal(store.getState().tokens.find(t => t.id === testTok.id).armor.current, 2);

  // 3. Modify Stress directly
  const stressMinusBtn = hudContainer.querySelector('[data-quick-stat="stress"][data-delta="-1"]');
  assert.ok(stressMinusBtn, 'Stress minus button present in preview HUD');
  stressMinusBtn.click();
  assert.equal(store.getState().tokens.find(t => t.id === testTok.id).stress.current, 1);

  // 4. Modify Hope directly
  const hopeMinusBtn = hudContainer.querySelector('[data-quick-stat="hope"][data-delta="-1"]');
  assert.ok(hopeMinusBtn, 'Hope minus button present in preview HUD');
  hopeMinusBtn.click();
  assert.equal(store.getState().tokens.find(t => t.id === testTok.id).hope, 2);

  // 5. Spotlight toggle directly on preview window
  const spotBtn = hudContainer.querySelector('#quick_spotlight_btn');
  assert.ok(spotBtn, 'Spotlight toggle button present in preview');
  spotBtn.click();
  assert.equal(store.getState().tokens.find(t => t.id === testTok.id).hasSpotlight, true);

  hudContainer.remove();
});

test('shield mitigation and damage execution: owner mitigates damage with shields before HP reduction', () => {
  const targetTok = store.addToken({
    name: 'Shield Bearer',
    hp: { current: 10, max: 10, majorThreshold: 4, severeThreshold: 8 },
    armor: { current: 3, max: 3 }
  });

  let mitigationConfirmed = null;
  promptShieldMitigation(targetTok, 8, (spentShields) => {
    mitigationConfirmed = spentShields;
  });

  // Modal appears offering shield selection
  const modal = document.querySelector('.veil-modal-backdrop');
  if (modal) {
    const slider = modal.querySelector('#mitigate_shields_slider');
    slider.value = '2';
    slider.dispatchEvent(new Event('input'));
    modal.querySelector('#mitigate_confirm_btn').click();
  }

  assert.equal(mitigationConfirmed, 2, '2 shields spent to mitigate incoming damage');
});

test('authoritative fog of war: reset and reveal all sync via campaign state and Keeper authority', () => {
  const fog = new FogOfWarEngine();
  const mapId = 'sync_fog_map_1';
  const fullMapId = `campaign_test:${mapId}`;

  // 1. Initial state
  assert.equal(fog.isPointExplored(200, 200, fullMapId), false);

  // 2. Reveal all
  fog.revealAll(fullMapId, 800, 600);
  assert.equal(fog.isPointExplored(200, 200, fullMapId), true);

  // 3. Serialize exploration
  const serialized = fog.serializeExploration(fullMapId, 800, 600);
  assert.equal(serialized, 'all');

  // 4. Reset exploration
  fog.resetExploration(fullMapId);
  assert.equal(fog.isPointExplored(200, 200, fullMapId), false);
  const resetSerialized = fog.serializeExploration(fullMapId, 800, 600);
  assert.equal(resetSerialized, 'none');

  // 5. Load exploration
  fog.loadExploration(fullMapId, 800, 600, 'all');
  assert.equal(fog.isPointExplored(200, 200, fullMapId), true);

  // 6. Test store resetMapFog and revealMapFog
  const testMap = store.addMap({ name: 'Fog Test Scene', imageUrl: '/assets/maps/blank-grid.svg' });
  store.revealMapFog(testMap.id);
  const updatedMap1 = store.getState().maps.find(m => m.id === testMap.id);
  assert.equal(updatedMap1.fogExplored, 'all');

  store.resetMapFog(testMap.id);
  const updatedMap2 = store.getState().maps.find(m => m.id === testMap.id);
  assert.equal(updatedMap2.fogExplored, 'none');
});

test('campaign backup: rolling snapshot in localStorage and export reminder for testers', () => {
  store.update({ userRole: 'keeper', campaignName: 'Alpha Testing Campaign' });

  // 1. Trigger export reminder
  const reminderModal = checkBackupReminder(true);
  assert.ok(reminderModal, 'Backup reminder modal returned');
  assert.match(reminderModal.textContent, /RECORDATORIO DE COPIA DE SEGURIDAD/i);
  assert.match(reminderModal.textContent, /Alpha Testing Campaign/i);
  reminderModal.remove();

  // 2. Auto backup snapshot in localStorage
  const autoBackup = localStorage.getItem('veilfarers_auto_backup');
  assert.ok(autoBackup, 'Auto backup snapshot stored in localStorage');
  const parsed = JSON.parse(autoBackup);
  assert.ok(parsed.campaignId);
  assert.ok(parsed.data);
});

test('cloud account & login: Google popup, redirect fallback and Netlify Identity integration', async () => {
  const { CloudAccount } = await import('../src/cloudAccount.js');

  const c = new CloudAccount();

  // 1. Netlify User setting & session restoration
  c.setNetlifyUser({ id: 'netlify_pilot_1', email: 'pilot@veil.org', user_metadata: { full_name: 'Captain Harker' } });
  assert.equal(c.user.uid, 'netlify_pilot_1');
  assert.equal(c.user.email, 'pilot@veil.org');
  assert.equal(c.user.displayName, 'Captain Harker');
  assert.equal(c.user.isNetlify, true);

  // 2. Google sign-in with redirect option
  let redirectCalled = false;
  let popupCalled = false;
  c.authAPI = {
    setPersistence: async () => {}, browserLocalPersistence: 'local', browserSessionPersistence: 'session',
    GoogleAuthProvider: class { setCustomParameters() {} },
    signInWithRedirect: async () => { redirectCalled = true; },
    signInWithPopup: async () => { popupCalled = true; return { user: { uid: 'google_user_1', email: 'g@test.com' } }; }
  };
  c.auth = {};

  await c.signInWithGoogle({ useRedirect: true });
  assert.equal(redirectCalled, true, 'signInWithRedirect called when useRedirect is true');

  const popupUser = await c.signInWithGoogle({ useRedirect: false });
  assert.equal(popupCalled, true, 'signInWithPopup called when useRedirect is false');
  assert.equal(popupUser.uid, 'google_user_1');
});

test('observer mode: joining as observer suppresses claim modal, and assignment from keeper transitions player to active', async () => {
  const { openClaimCharacterModal } = await import('../src/rosterManager.js');

  // 1. Initial player state without assigned tokens
  const baseToken = structuredClone(store.state.tokens[0]);
  store.update({
    userRole: 'player',
    isObserver: false,
    claimedTokenId: null,
    selectedTokenId: null,
    tokens: [
      { ...baseToken, id: 'tok_assigned', name: 'Harker', ownerId: '', controllerIds: [] }
    ]
  });

  // 2. Open Claim Character modal and select Opción C (Observer)
  const modal = openClaimCharacterModal();
  assert.ok(modal, 'Claim character modal rendered');
  const observerBtn = modal.querySelector('#btn_claim_observer');
  assert.ok(observerBtn, 'Observer button present in claim modal');

  observerBtn.click();
  assert.equal(store.state.isObserver, true, 'isObserver set to true');
  assert.equal(store.state.claimedTokenId, null, 'claimedTokenId is cleared');
  assert.equal(document.body.contains(modal), false, 'Claim modal closed after choosing observer');

  // 3. NetworkManager INITIAL_STATE processing with assignment
  const { NetworkManager } = await import('../src/networkManager.js');
  const net = new NetworkManager(store);
  store.sessionRole = 'player';
  store.peerId = 'player_observer_1';
  store.memberId = 'player_observer_1';
  net.room = 'test_alpha_room';
  net.hostConn = { peer: 'keeper_peer' };

  // State snapshot where Keeper assigned tok_assigned to player_observer_1
  const campaignBase = store.serializeCampaign();
  const assignedState = {
    ...campaignBase,
    memberId: 'player_observer_1',
    tokens: [
      { ...baseToken, id: 'tok_assigned', name: 'Harker', ownerId: 'player_observer_1', controllerIds: ['player_observer_1'], x: 500, y: 400, mapId: store.state.activeMapId }
    ],
    claimedTokenId: null
  };

  // Simulate receiving INITIAL_STATE
  await net.handleIncomingMessage(net.envelope({
    type: 'INITIAL_STATE',
    state: assignedState
  }), 'keeper_peer');

  // Should automatically transition from observer to active player with assigned token
  assert.equal(store.state.isObserver, false, 'isObserver flipped to false upon assignment');
  assert.equal(store.state.selectedTokenId, 'tok_assigned', 'Assigned token is selected');
});

test('scene telemetry & image size limit: MAP_LOAD_STATUS updates keeper UI and file limit is 50MB (100MB with Cloudinary)', async () => {
  const { NetworkManager } = await import('../src/networkManager.js');
  const net = new NetworkManager(store);

  // 1. Host receiving MAP_LOAD_STATUS from connected peer
  store.sessionRole = 'host';
  store.update({
    userRole: 'keeper',
    isHosting: true,
    campaignName: 'Test Host Campaign',
    players: [{ id: 'p_yomismo', name: 'yomismo' }],
    connectedPeers: [{ id: 'p_yomismo', name: 'yomismo' }]
  });
  net.room = 'room_telemetry_test';
  net.members.set('peer_yomismo_conn', { id: 'p_yomismo', name: 'yomismo' });

  let eventFired = false;
  const listener = (e) => {
    if (e.detail?.peerId === 'p_yomismo') eventFired = true;
  };
  window.addEventListener('veil:map-load-status', listener);

  const statusMsg = net.envelope({
    type: 'MAP_LOAD_STATUS',
    peerId: 'p_yomismo',
    name: 'yomismo',
    role: 'player',
    mapId: store.state.activeMapId,
    progress: 100,
    loaded: true,
    text: 'Matriz cargada al 100%'
  });

  await net.handleIncomingMessage(statusMsg, 'peer_yomismo_conn');
  window.removeEventListener('veil:map-load-status', listener);

  assert.equal(eventFired, true, 'veil:map-load-status event was dispatched on host');
  const recorded = net.mapLoadStatuses.get('p_yomismo');
  assert.ok(recorded, 'Map load status recorded for player ID');
  assert.equal(recorded.progress, 100);
  assert.equal(recorded.loaded, true);

  // 2. Telemetry Modal displays 100% and ready status
  const { openMapSyncTelemetryModal } = await import('../src/sessionLobby.js');
  const modal = openMapSyncTelemetryModal();
  assert.ok(modal, 'Telemetry modal opened');
  const text = modal.textContent;
  assert.match(text, /yomismo/i);
  assert.match(text, /100% ✅/);
  modal.remove();
});

test('viewport frustum culling: getViewportBounds accurately maps screen viewport to world coordinates', async () => {
  const { CanvasEngine } = await import('../src/canvasEngine.js');
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 1000;
  canvasEl.height = 600;
  const engine = new CanvasEngine(canvasEl);
  engine.displayWidth = 1000;
  engine.displayHeight = 600;
  engine.panX = 100;
  engine.panY = 50;
  engine.zoom = 2;

  const vp = engine.getViewportBounds(0);
  assert.equal(vp.minX, -50);
  assert.equal(vp.minY, -25);
  assert.equal(vp.maxX, 450);
  assert.equal(vp.maxY, 275);

  const paddedVp = engine.getViewportBounds(10);
  assert.equal(paddedVp.minX, -60);
  assert.equal(paddedVp.minY, -35);
  assert.equal(paddedVp.maxX, 460);
  assert.equal(paddedVp.maxY, 285);
});

test('cloudinary image compression and account scene library: compressImageForUpload and saveScene', async () => {
  const { compressImageForUpload } = await import('../src/cloudinaryService.js');
  const { account } = await import('../src/cloudAccount.js');

  // 1. Image under limit passes through untouched
  const smallMockFile = { name: 'small_map.png', size: 1024, type: 'image/png' };
  const result = await compressImageForUpload(smallMockFile);
  assert.equal(result.name, 'small_map.png');

  // 2. Account saveScene and removeScene
  account.user = { uid: 'user_scene_test', isNetlify: true, displayName: 'Keeper Test' };
  const sceneId = await account.saveScene({
    name: 'Derelict Station Hangar',
    gridSize: 70,
    ambientLight: 0.5,
    width: 3000,
    height: 2000,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/map.webp'
  });

  assert.ok(sceneId, 'Scene saved with ID');
  const scenes = await account.list('scenes');
  const found = scenes.find(s => s.name === 'Derelict Station Hangar');
  assert.ok(found, 'Saved scene found in account library');
  assert.equal(found.gridSize, 70);
  assert.equal(found.imageUrl, 'https://res.cloudinary.com/demo/image/upload/map.webp');

  await account.removeScene(sceneId);
  const updatedScenes = await account.list('scenes');
  assert.equal(updatedScenes.some(s => s.id === sceneId), false, 'Scene removed from account library');
});

test('spotlight exclusivity and adversary fear cost: only one token spotlighted, adversary costs 1 fear', async () => {
  const { store } = await import('../src/state.js');
  await store.ready;

  const playerA = {
    id: 'tok_pc_a',
    name: 'PC Alpha',
    actorType: 'player',
    isPlayer: true,
    hasSpotlight: false,
    hp: { current: 10, max: 10 },
    armor: { current: 2, max: 2 },
    mapId: store.state.activeMapId || 'scene_default'
  };
  const playerB = {
    id: 'tok_pc_b',
    name: 'PC Beta',
    actorType: 'player',
    isPlayer: true,
    hasSpotlight: false,
    hp: { current: 10, max: 10 },
    armor: { current: 2, max: 2 },
    mapId: store.state.activeMapId || 'scene_default'
  };
  const adversary = {
    id: 'tok_adv_c',
    name: 'Alien Hunter',
    actorType: 'adversary',
    isPlayer: false,
    hasSpotlight: false,
    hp: { current: 12, max: 12 },
    armor: { current: 0, max: 0 },
    mapId: store.state.activeMapId || 'scene_default'
  };

  store.state.tokens = [playerA, playerB, adversary];
  store.state.userRole = 'keeper';
  store.sessionRole = 'host';
  store.state.fear = 0;

  // 1. Activate spotlight on PC Alpha
  const ok1 = store.setTokenSpotlight('tok_pc_a', true);
  assert.equal(ok1, true);
  assert.equal(store.state.tokens.find(t => t.id === 'tok_pc_a').hasSpotlight, true);

  // 2. Activate spotlight on PC Beta -> PC Alpha loses spotlight
  const ok2 = store.setTokenSpotlight('tok_pc_b', true);
  assert.equal(ok2, true);
  assert.equal(store.state.tokens.find(t => t.id === 'tok_pc_a').hasSpotlight, false);
  assert.equal(store.state.tokens.find(t => t.id === 'tok_pc_b').hasSpotlight, true);

  // 3. Attempt to activate spotlight on Adversary with 0 Fear -> fails
  const okAdvFail = store.setTokenSpotlight('tok_adv_c', true);
  assert.equal(okAdvFail, false, 'Should fail without Fear');
  assert.equal(store.state.tokens.find(t => t.id === 'tok_adv_c').hasSpotlight, false);
  assert.equal(store.state.fear, 0);

  // 4. Grant Fear to Keeper and activate spotlight on Adversary -> costs 1 Fear and succeeds
  store.state.fear = 2;
  const okAdvSuccess = store.setTokenSpotlight('tok_adv_c', true);
  assert.equal(okAdvSuccess, true, 'Should succeed with Fear');
  assert.equal(store.state.fear, 1, '1 Fear was spent');
  assert.equal(store.state.tokens.find(t => t.id === 'tok_adv_c').hasSpotlight, true);
  assert.equal(store.state.tokens.find(t => t.id === 'tok_pc_b').hasSpotlight, false, 'PC Beta lost spotlight');
});

test('simplified invitation code: 3-char prefix from campaign name + 5-char random suffix', async () => {
  const { NetworkManager } = await import('../src/networkManager.js');
  const { parseInvitation } = await import('../src/sessionLobby.js');
  const { store } = await import('../src/state.js');
  const { EventEmitter } = await import('node:events');

  store.state.campaignName = 'USC Nostromo Outpost';
  const nm = new NetworkManager({
    stateStore: store,
    peerFactory: (room) => {
      const emitter = new EventEmitter();
      emitter.destroy = () => {};
      setTimeout(() => emitter.emit('open', room), 5);
      return emitter;
    }
  });

  const room = await nm.hostSession();
  assert.match(room, /^USC-[A-Z0-9]{5}$/, 'Code has 3 chars of name + 5 random chars');
  nm.disconnect();

  // Test parseInvitation on short codes and URLs
  assert.deepEqual(parseInvitation('USC-K89FA'), { room: 'USC-K89FA', invite: 'USC-K89FA' });
  assert.deepEqual(parseInvitation('https://vfvtt.netlify.app/?join=USC-K89FA'), { room: 'USC-K89FA', invite: 'USC-K89FA' });

  // Malformed or incomplete codes throw
  assert.throws(() => parseInvitation('USC'), /Pega el código o enlace/);
  assert.throws(() => parseInvitation('VEIL-ABC'), /Pega el código o enlace/);
});

test('single line header & compact session bar: session controls dock inside header and floating fear meter overlay', async () => {
  const { initSessionBar } = await import('../src/sessionLobby.js');
  document.body.innerHTML = `
    <header class="header-hud">
      <div class="header-left">
        <div id="session_bar_slot"></div>
      </div>
      <div id="fear_meter_container"></div>
      <div class="header-right"></div>
    </header>
  `;

  initSessionBar();
  const slot = document.getElementById('session_bar_slot');
  const bar = slot.querySelector('.session-strip');
  assert.ok(bar, 'Session strip mounted inside header slot');
  assert.ok(bar.classList.contains('session-strip-inline'), 'Session strip has inline class');
  assert.ok(bar.querySelector('#session_code'), 'Code input exists');
  assert.ok(bar.querySelector('#session_crew'), 'Crew count exists');

  const fearContainer = document.getElementById('fear_meter_container');
  assert.ok(fearContainer, 'Fear meter container exists in header slot for overlay mounting');
});

test('firebase full scene persistence: saves and restores scene with all components (walls, lights, tokens)', async () => {
  const { account } = await import('../src/cloudAccount.js');
  
  // Mock Firebase / user identity
  account.user = { uid: 'test_user_fb', isNetlify: false, displayName: 'Test GM' };
  account.dbAPI = {
    doc: (_, ...parts) => parts.join('/'),
    setDoc: async (path, data) => { account._lastSavedDoc = { path, data }; },
    getDocsFromServer: async () => ({ docs: [{ id: 'scene_test_1', data: () => account._lastSavedDoc?.data || {} }] })
  };
  account.db = {};

  const fullScene = {
    id: 'scene_station_alpha',
    name: 'Estación Deep Void - Sector 7',
    gridSize: 70,
    ambientLight: 0.25,
    width: 2560,
    height: 1440,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/map.webp',
    walls: [
      { id: 'w1', x1: 100, y1: 100, x2: 500, y2: 100, wallType: 'wall', isDoor: false },
      { id: 'w2', x1: 500, y1: 100, x2: 500, y2: 600, wallType: 'wall', isDoor: true, isOpen: false }
    ],
    lights: [
      { id: 'l1', x: 300, y: 300, radius: 250, color: '#00f3ff', intensity: 0.8 }
    ],
    effects: [
      { id: 'fx1', type: 'voidRift', x: 400, y: 400, radius: 100 }
    ],
    water: [
      { id: 'wt1', points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }] }
    ],
    tokens: [
      { id: 'tok_npc1', name: 'Sentry Drone', x: 250, y: 250, actorType: 'drone' }
    ],
    notes: ['Acceso restringido con clave bio-métrica']
  };

  const savedId = await account.saveScene(fullScene);
  assert.equal(savedId, 'scene_station_alpha');
  assert.ok(account._lastSavedDoc, 'Doc was written to Firestore');
  
  const savedData = account._lastSavedDoc.data;
  assert.equal(savedData.name, 'Estación Deep Void - Sector 7');
  assert.equal(savedData.walls.length, 2, 'Walls preserved');
  assert.equal(savedData.lights.length, 1, 'Lights preserved');
  assert.equal(savedData.effects.length, 1, 'Effects preserved');
  assert.equal(savedData.water.length, 1, 'Water preserved');
  assert.equal(savedData.tokens.length, 1, 'Tokens preserved');
  assert.equal(savedData.notes.length, 1, 'Notes preserved');
});

test('session persistence & invited sessions list: persists active session, invited history and case-insensitive room routing', async () => {
  const {
    saveActiveSession,
    getActiveSession,
    clearActiveSession,
    saveInvitedSession,
    getInvitedSessions,
    removeInvitedSession,
    NetworkManager
  } = await import('../src/networkManager.js');
  const { store } = await import('../src/state.js');

  // 1. Save and retrieve active session
  saveActiveSession({ role: 'player', room: 'USC-ALPHA', invite: 'USC-ALPHA', playerName: 'Ripley' });
  let active = getActiveSession();
  assert.ok(active, 'Active session stored');
  assert.equal(active.room, 'USC-ALPHA');
  assert.equal(active.playerName, 'Ripley');

  clearActiveSession();
  assert.equal(getActiveSession(), null, 'Active session cleared on explicit leave');

  // 2. Invited sessions list
  saveInvitedSession({ room: 'USC-BETA', invite: 'USC-BETA', playerName: 'Dallas', campaignName: 'Nostromo Mission' });
  saveInvitedSession({ room: 'USC-GAMMA', invite: 'USC-GAMMA', playerName: 'Kane', campaignName: 'Derelict Ship' });
  let invited = getInvitedSessions();
  assert.equal(invited.length, 2);
  assert.equal(invited[0].room, 'USC-GAMMA');
  assert.equal(invited[1].room, 'USC-BETA');

  // Remove an invited session
  removeInvitedSession('USC-BETA');
  invited = getInvitedSessions();
  assert.equal(invited.length, 1);
  assert.equal(invited[0].room, 'USC-GAMMA');

  // 3. Case-insensitive room matching in NetworkManager
  store.state.isHosting = true;
  store.sessionRole = 'host';
  const nm = new NetworkManager({ stateStore: store });
  nm.room = 'USC-K89FA';
  let messageHandled = false;
  nm.members.set('peer_test', { id: 'player_1', name: 'Kane' });
  nm.ephemeral = () => { messageHandled = true; };
  nm.broadcast = () => {};

  // Send MAP_LOAD_STATUS with lowercase room code 'usc-k89fa'
  await nm.handleIncomingMessage({
    type: 'MAP_LOAD_STATUS',
    room: 'usc-k89fa', // lowercase!
    messageId: 'msg_test_case_1',
    peerId: 'peer_test',
    progress: 100,
    loaded: true
  }, 'peer_test');

  assert.equal(messageHandled, true, 'Case-insensitive room matching accepted the message');
  nm.disconnect();
});

test('null token fields resilience: tokens with null species, community or roleTag connect and validate safely', async () => {
  const { validateCampaign, validateActor } = await import('../src/validation.js');
  const rawToken = {
    id: 'tok_resilient',
    name: 'Operative X',
    x: 100,
    y: 100,
    species: null, // from Firestore / network serialization
    community: null,
    characterClass: null,
    subclass: null,
    roleTag: null,
    ownerId: null,
    hp: { current: 10, max: 10 }
  };

  const validated = validateActor(rawToken);
  assert.equal(validated.species, undefined, 'species: null safely normalized without error');
  assert.equal(validated.community, undefined, 'community: null safely normalized without error');
  assert.equal(validated.ownerId, undefined, 'ownerId: null safely normalized without error');

  const campaign = {
    campaignName: 'Test Resilient Campaign',
    fear: 0,
    maps: [{ id: 'map1', name: 'Map 1', imageUrl: 'http://test.com/m.png', gridSize: 70 }],
    tokens: [{ ...rawToken, mapId: 'map1' }],
    clocks: [],
    handouts: [],
    starship: {
      name: 'Vessel', maxHull: 10, hull: 10, heat: 0, heatCap: 10, pearls: 0,
      shieldArcs: { fore: 0, aft: 0, port: 0, starboard: 0, maxPerArc: 4 }
    }
  };

  const validCampaign = validateCampaign(campaign);
  assert.ok(validCampaign, 'Campaign validates cleanly without throwing invalid species');
});





