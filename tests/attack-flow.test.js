import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createActor } from '../src/actors.js';
import { RANGE_BANDS, rangeBandFor, tokenDistanceSquares, weaponRangeBand, rangeCheck, weaponTraitId, netEdge, rollAdversaryAttack, dualityAttackHit } from '../src/attackFlow.js';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[key] = dom.window[key];
const { store } = await import('../src/state.js'); await store.ready;
const { DiceRollerSidebar } = await import('../src/diceRoller.js');
const { network } = await import('../src/networkManager.js');
const { audio } = await import('../src/audioEngine.js'); audio.muted = true;
const original = structuredClone(store.state), originalBroadcast = network.broadcast, originalChat = network.sendChat, random = Math.random;
beforeEach(async () => {
  await store.saveQueue.catch(() => {}); store.state = structuredClone(original); store.state.campaignId = crypto.randomUUID();
  store.state.userRole = 'keeper'; store.sessionRole = 'local'; store.remoteApplying = false; store.listeners.clear(); store.state.logs = [];
  store.state.dice3d = false; store.sessionBusy = false; store.undoManager = null; document.body.replaceChildren(); delete window.veilCanvas;
  network.broadcast = () => {}; network.sendChat = async () => {}; Math.random = random;
});
after(async () => { await store.saveQueue.catch(() => {}); network.broadcast = originalBroadcast; network.sendChat = originalChat; Math.random = random; dom.window.close(); });

// Queue of die faces: each call to Math.random yields the next face of a die with `sides` sides.
const faces = list => { const queue = [...list]; Math.random = () => { const [face, sides] = queue.shift() ?? [1, 2]; return (face - 0.5) / sides; }; };

function scene({ attacker = {}, target = {}, weapon = null, squares = 1 } = {}) {
  const map = store.getActiveMap(), grid = map.gridSize || 64;
  const a = createActor({ name: 'Attacker', isPlayer: true, path: 'Awakened', traits: { agility: 1, strength: 2, finesse: 3, knowledge: 0, instinct: 1, presence: 0 }, hope: 2, x: 200, y: 200, ...attacker }, map.id);
  const t = createActor({ name: 'Target', isPlayer: false, evasion: 12, hp: { current: 6, max: 6, majorThreshold: 10, severeThreshold: 16 }, armor: { current: 2, max: 2 }, x: 200 + squares * grid, y: 200, ...target }, map.id);
  if (weapon) a.inventory = { weapons: [{ id: 'w1', name: 'Weapon', damage: '1d8', damageMode: 'final', trait: 'Finesse', range: 'Close', features: '', tier: '', ...weapon }], items: [] };
  store.state.tokens = [a, t]; store.state.selectedTokenId = a.id;
  const node = document.createElement('div'); document.body.append(node);
  const dice = new DiceRollerSidebar(node);
  dice.syncWithSelectedToken(); dice.populateDamageTargets();
  node.querySelector('#dmg_target_select').value = t.id;
  if (weapon) { node.querySelector('#dmg_weapon_select').value = 'w1'; dice.applyWeaponPreset(a, a.inventory.weapons[0]); }
  const q = id => node.querySelector(id), live = id => store.state.tokens.find(x => x.id === id);
  return { node, dice, a, t, q, live };
}

test('range bands follow the Corebook distances; Melee is an adjacent square', () => {
  assert.deepEqual(RANGE_BANDS, ['Melee', 'Very Close', 'Close', 'Far', 'Very Far']);
  assert.deepEqual([1, 1.42, 2, 2.5, 3, 10, 11, 50, 51].map(s => rangeBandFor(s, 2)), ['Melee', 'Melee', 'Very Close', 'Very Close', 'Close', 'Close', 'Far', 'Far', 'Very Far']);
  assert.equal(tokenDistanceSquares({ x: 0, y: 0 }, { x: 192, y: 0 }, 64), 3);
  assert.deepEqual(['Melee', 'Very Close', 'Close', 'Far', 'Very Far', 'Cuerpo a cuerpo', ''].map(range => weaponRangeBand({ range })), ['Melee', 'Very Close', 'Close', 'Far', 'Very Far', 'Melee', '']);
});

test('a melee weapon only attacks at Melee; a ranged weapon beyond its band attacks with Disadvantage', () => {
  assert.equal(rangeCheck({ range: 'Melee' }, 'Melee').allowed, true);
  const tooFar = rangeCheck({ range: 'Melee' }, 'Very Close');
  assert.equal(tooFar.allowed, false); assert.match(tooFar.reason, /fuera de Melee/);
  assert.deepEqual([rangeCheck({ range: 'Close' }, 'Close').disadvantage, rangeCheck({ range: 'Close' }, 'Melee').disadvantage, rangeCheck({ range: 'Close' }, 'Far').disadvantage], [false, false, true]);
  assert.equal(rangeCheck({ range: 'Close' }, 'Far').allowed, true);
  assert.deepEqual(rangeCheck(null, 'Far'), { allowed: true, disadvantage: false, reach: '', band: 'Far', reason: '' });
  assert.equal(weaponTraitId({ trait: 'Finesse' }), 'finesse'); assert.equal(weaponTraitId({ trait: 'Attack +2' }), '');
  assert.deepEqual(netEdge(true, true), { advantage: false, disadvantage: false });
});

test('a Keeper attack is 1d20 + Attack against Evasion; a natural 20 is a critical hit', () => {
  const miss = rollAdversaryAttack({ attackModifier: 2, evasion: 12, forcedD20: 9 });
  assert.deepEqual([miss.total, miss.hit, miss.isCritical], [11, false, false]);
  assert.equal(rollAdversaryAttack({ attackModifier: 2, evasion: 12, forcedD20: 10 }).hit, true);
  const crit = rollAdversaryAttack({ attackModifier: -5, evasion: 30, forcedD20: 20 });
  assert.deepEqual([crit.hit, crit.isCritical], [true, true]);
  const hampered = rollAdversaryAttack({ attackModifier: 2, evasion: 12, hasDisadvantage: true, forcedD20: 12, forcedD6: 4 });
  assert.deepEqual([hampered.total, hampered.hit, hampered.edge], [10, false, 'Disadvantage']);
  assert.equal(rollAdversaryAttack({ attackModifier: 0, evasion: 12, hasAdvantage: true, hasDisadvantage: true, forcedD20: 12 }).d6, 0, 'they cancel');
  assert.equal(dualityAttackHit({ total: 11, isCritical: false }, 12), false);
  assert.equal(dualityAttackHit({ total: 12, isCritical: false }, 12), true);
  assert.equal(dualityAttackHit({ total: 3, isCritical: true }, 12), true);
});

test('an adversary that misses rolls no damage; one that hits gets its damage worked out, and applying it stays a separate step', async () => {
  const { dice, q, a, t, live } = scene({ attacker: { isPlayer: false, attackModifier: 2 } });
  q('#dmg_formula').value = '6'; // flat damage: writing the log also draws from Math.random
  faces([[5, 20]]);
  const miss = await dice.executeAttack();
  assert.equal(miss.hit, false);
  assert.equal(q('#atk_outcome_val').textContent, 'FALLO'); assert.equal(q('#atk_total_val').textContent, '7'); assert.equal(q('#atk_evasion_val').textContent, '12');
  assert.equal(q('#damage_result_display').style.display, 'none', 'no damage on a miss');
  assert.equal(live(t.id).hp.current, 6);
  faces([[15, 20]]);
  const hit = await dice.executeAttack();
  assert.equal(hit.hit, true); assert.equal(q('#atk_outcome_val').textContent, 'IMPACTO');
  assert.equal(q('#damage_result_display').style.display, 'block'); assert.equal(q('#dmg_raw_val').textContent, '6');
  assert.equal(live(t.id).hp.current, 6, 'nothing is applied until the Keeper applies it');
  q('#apply_dmg_to_target_btn').click();
  assert.equal(live(t.id).hp.current, 5);
  assert.ok(store.state.logs.some(l => /Ataque · Attacker/.test(l.title) && /d20 \[15\]/.test(l.details)));
});

test('a natural 20 from the Keeper is critical: it hits any Evasion and deals maximum damage', async () => {
  const { dice, q } = scene({ attacker: { isPlayer: false, attackModifier: 0 }, target: { evasion: 40 } });
  q('#dmg_formula').value = '2d8+1';
  faces([[20, 20]]);
  const result = await dice.executeAttack();
  assert.deepEqual([result.hit, result.critical], [true, true]);
  assert.equal(q('#atk_outcome_val').textContent, 'CRÍTICO');
  assert.equal(q('#dmg_raw_val').textContent, '17', 'every die at its maximum, flat modifier once');
});

test('a player attacks with Hope and Fear against Evasion using the weapon Trait; a miss rolls no damage', async () => {
  const { dice, q, live, a } = scene({ weapon: { trait: 'Finesse', range: 'Close', damage: '5' }, squares: 3 });
  faces([[2, 12], [3, 12]]);
  const miss = await dice.executeAttack();
  assert.equal(miss.hit, false); assert.equal(q('#atk_total_val').textContent, '8', '2 + 3 + Finesse 3');
  assert.equal(q('#atk_outcome_val').textContent, 'FALLO'); assert.equal(q('#damage_result_display').style.display, 'none');
  faces([[6, 12], [4, 12]]);
  const hit = await dice.executeAttack();
  assert.equal(hit.hit, true); assert.equal(hit.total, 13);
  assert.equal(q('#atk_outcome_val').textContent, 'IMPACTO'); assert.equal(q('#dmg_raw_val').textContent, '5');
  assert.equal(live(a.id).hope, 3, 'the attack is a Duality roll: Hope dominance pays out');
});

test('matching Hope and Fear dice make a player attack critical: it hits and doubles the damage dice', async () => {
  const { dice, q } = scene({ weapon: { trait: 'Finesse', range: 'Close', damage: '1d8' }, target: { evasion: 30 }, squares: 3 });
  faces([[4, 12], [4, 12]]);
  const result = await dice.executeAttack();
  assert.deepEqual([result.hit, result.critical], [true, true]);
  assert.match(q('#dmg_detail_text').textContent, /Dice: \[\d+, \d+\]/, 'two dice instead of one');
});

test('a melee weapon cannot attack a target out of Melee: no roll, no damage', async () => {
  const { dice, q, live, a } = scene({ weapon: { trait: 'Strength', range: 'Melee', damage: '1d10' }, squares: 4 });
  faces([[12, 12], [1, 12]]);
  const result = await dice.executeAttack();
  assert.equal(result.blocked, true); assert.equal(q('#atk_outcome_val').textContent, 'FUERA DE ALCANCE');
  assert.match(q('#atk_detail_text').textContent, /fuera de Melee/);
  assert.equal(q('#damage_result_display').style.display, 'none'); assert.equal(live(a.id).hope, 2, 'no roll was made');
  // Adjacent, the same weapon attacks normally.
  const near = scene({ weapon: { trait: 'Strength', range: 'Melee', damage: '1d10' }, squares: 1 });
  faces([[9, 12], [2, 12]]);
  assert.equal((await near.dice.executeAttack()).hit, true);
});

test('a ranged weapon beyond its range attacks with Disadvantage', async () => {
  const { dice, q } = scene({ weapon: { trait: 'Finesse', range: 'Very Close', damage: '1d8' }, squares: 6 });
  faces([[6, 12], [4, 12], [5, 6]]);
  const result = await dice.executeAttack();
  assert.equal(result.band, 'Close'); assert.equal(result.total, 8, '6 + 4 + 3 − d6 [5]'); assert.equal(result.hit, false);
  assert.match(q('#atk_detail_text').textContent, /más allá del alcance del arma \(Very Close\): Desventaja/);
});

test('an attack needs an attacker and a different target', async () => {
  const { dice, q, a } = scene();
  q('#dmg_target_select').value = '';
  await assert.rejects(dice.executeAttack(), /Elige un objetivo/);
  q('#dmg_target_select').value = a.id;
  await assert.rejects(dice.executeAttack(), /a sí mismo/);
});
