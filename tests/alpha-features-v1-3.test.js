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


