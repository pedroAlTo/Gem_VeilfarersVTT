import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createActor } from '../src/actors.js';
import { RANGE_BANDS, rangeBandFor, tokenGapSquares, gapBandFor, tokenDistanceSquares, weaponRangeBand, lineBlockedByWall, distanceInfo, rangeCheck, weaponTraitId, netEdge, rollAdversaryAttack, dualityAttackHit, weaponAttackBonus } from '../src/attackFlow.js';

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

test('range bands follow the table ruling: Melee adjacent or 1 m, Very Close 5 m, Close 10 m, Far 25 m, Extreme beyond', () => {
  assert.deepEqual(RANGE_BANDS, ['Melee', 'Very Close', 'Close', 'Far', 'Extreme']);
  // 2 m per square: 1 sq and a diagonal are Melee; 2 sq = 4 m; 3 sq = 6 m; 5 sq = 10 m; 6 sq = 12 m; 12 sq = 24 m; 13 sq = 26 m.
  assert.deepEqual([1, 1.42, 2, 2.5, 3, 5, 6, 12, 12.5, 13, 23].map(s => rangeBandFor(s, 2)), ['Melee', 'Melee', 'Very Close', 'Very Close', 'Close', 'Close', 'Far', 'Far', 'Far', 'Extreme', 'Extreme']);
  // In metres, whatever the scale of the map.
  assert.deepEqual([1, 5, 5.5, 10, 11, 25, 26].map(m => rangeBandFor(m, 1)), ['Melee', 'Very Close', 'Close', 'Close', 'Far', 'Far', 'Extreme']);
  assert.deepEqual([10.02, 10.4, 10.6, 25.4, 25.6].map(m => rangeBandFor(m, 1)), ['Close', 'Close', 'Far', 'Far', 'Extreme'], 'whole metres, as shown on the label');
  assert.equal(tokenDistanceSquares({ x: 0, y: 0 }, { x: 192, y: 0 }, 64), 3);
  assert.deepEqual(['Melee', 'Very Close', 'Close', 'Far', 'Very Far', 'Extreme', 'Cuerpo a cuerpo', ''].map(range => weaponRangeBand({ range })), ['Melee', 'Very Close', 'Close', 'Far', 'Extreme', 'Extreme', 'Melee', '']);
});

test('a weapon whose sheet has no Range takes it from the catalog weapon of the same name', () => {
  assert.equal(weaponRangeBand({ name: 'Pistola Cinética Militar', range: '' }), 'Close');
  assert.equal(weaponRangeBand({ name: 'Pistola Cinética Militar (Slug Pistol)' }), 'Close');
  assert.equal(weaponRangeBand({ name: 'Arma inventada', range: '' }), '');
  // Imported sheets: Spanish words, metres, the English name of a catalog weapon, or its kind.
  assert.deepEqual(['Lejano', 'Muy lejano', 'Cercano', 'Distancia media', '15 m', '4m', '40 metros'].map(range => weaponRangeBand({ range })), ['Far', 'Extreme', 'Close', 'Close', 'Far', 'Very Close', 'Extreme']);
  assert.equal(weaponRangeBand({ name: 'Slug Pistol' }), 'Close');
  assert.equal(weaponRangeBand({ name: 'Energy Dagger', trait: 'Agility · Melee', range: '' }), 'Melee', 'range written with the Trait');
  assert.equal(rangeCheck({ name: 'Energy Dagger', trait: 'Agility · Melee', range: '' }, 'Extreme').allowed, false);
  // The range is never guessed from words in the name (user decision: tags and fields, not word search).
  assert.deepEqual(['Sniper Rifle', 'Assault Rifle', 'Combat Shotgun', 'Combat Knife', 'Heavy Revolver'].map(name => weaponRangeBand({ name })), ['', '', '', '', '']);
  assert.equal(weaponRangeBand({ name: 'Pistola Cinética Militar', range: 'Far' }), 'Far', 'its own Range wins');
});

test('walls and closed doors block the line of fire; windows and open doors do not', () => {
  const a = { x: 0, y: 0 }, b = { x: 200, y: 0 }, across = { x1: 100, y1: -50, x2: 100, y2: 50 };
  assert.equal(lineBlockedByWall(a, b, [across]), true);
  assert.equal(lineBlockedByWall(a, b, [{ ...across, wallType: 'window' }]), false);
  assert.equal(lineBlockedByWall(a, b, [{ ...across, wallType: 'door', isOpen: true }]), false);
  assert.equal(lineBlockedByWall(a, b, [{ ...across, wallType: 'door', isOpen: false }]), true);
  assert.equal(lineBlockedByWall(a, b, [{ x1: 100, y1: 20, x2: 100, y2: 90 }]), false, 'a wall beside the line');
  assert.deepEqual(distanceInfo(a, { x: 1472, y: 0 }, { gridSize: 64, walls: [across] }), { squares: 22, meters: 44, band: 'Extreme', blocked: true });
});

test('a melee weapon only attacks at Melee; a ranged weapon beyond its band, or a long one at Melee, attacks with Disadvantage', () => {
  assert.equal(rangeCheck({ range: 'Melee' }, 'Melee').allowed, true);
  const tooFar = rangeCheck({ range: 'Melee' }, 'Very Close');
  assert.equal(tooFar.allowed, false); assert.match(tooFar.reason, /fuera de Melee/);
  assert.deepEqual([rangeCheck({ range: 'Close' }, 'Close').disadvantage, rangeCheck({ range: 'Close' }, 'Melee').disadvantage, rangeCheck({ range: 'Close' }, 'Far').disadvantage, rangeCheck({ range: 'Close' }, 'Extreme').disadvantage], [false, false, true, true]);
  // A long ranged weapon at Melee has Disadvantage; a short one (a pistol) does not.
  assert.match(rangeCheck({ name: 'Rifle de Asalto Automático', range: 'Far' }, 'Melee').reason, /objetivo en Melee: Desventaja/);
  assert.equal(rangeCheck({ name: 'Pistola Cinética Militar (Slug Pistol)', range: 'Close' }, 'Melee').disadvantage, false);
  assert.equal(rangeCheck({ name: 'Bláster Oculto de Brazo Sintético', range: 'Close' }, 'Melee').disadvantage, false);
  assert.equal(rangeCheck({ name: 'Arma rara', range: 'Close', short: true }, 'Melee').disadvantage, false, 'a weapon can be marked short');
  assert.equal(rangeCheck({ name: 'Pistola pesada', range: 'Close', short: false }, 'Melee').disadvantage, true, 'or explicitly not');
  assert.equal(rangeCheck({ range: 'Close' }, 'Far').allowed, true);
  // User ruling: any firearm with a maximum range of Close has no Disadvantage at Close or Melee,
  // whatever its name; a Far weapon does at Melee.
  assert.equal(rangeCheck({ name: 'Pistola Cinética Militar (Slug Pistol)', range: 'Close' }, 'Close').disadvantage, false);
  assert.equal(rangeCheck({ name: 'Escopeta recortada', range: 'Very Close' }, 'Melee').disadvantage, false);
  assert.equal(rangeCheck({ name: 'Subfusil compacto', range: 'Close' }, 'Melee').disadvantage, false);
  assert.equal(rangeCheck({ name: 'Pistola de largo alcance', range: 'Far' }, 'Melee').disadvantage, true, 'a long-range pistol is not short');
  assert.match(rangeCheck({ name: 'Rifle de Asalto Automático', range: 'Far' }, 'Melee').reason, /alcance Far.*Desventaja/);
  assert.equal(rangeCheck({ name: 'Rifle de Asalto Automático', range: 'Far' }, 'Close').disadvantage, false);
  // Without a weapon the attack is an unarmed strike: Melee only.
  assert.equal(rangeCheck(null, 'Melee').allowed, true);
  const unarmed = rangeCheck(null, 'Far');
  assert.deepEqual([unarmed.allowed, unarmed.reach], [false, 'Melee']); assert.match(unarmed.reason, /Sin arma el ataque es cuerpo a cuerpo/);
  assert.equal(rangeCheck({ name: 'Arma inventada', range: '' }, 'Far').allowed, true, 'a weapon with no known range is not limited');
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
  q('#apply_dmg_to_target_btn').click();document.querySelector('#kdmg_apply')?.click();
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
  // Centres 7 squares apart: 6 squares (12 m) base to base.
  const { dice, q } = scene({ weapon: { trait: 'Finesse', range: 'Very Close', damage: '1d8' }, squares: 7 });
  faces([[6, 12], [4, 12], [5, 6]]);
  const result = await dice.executeAttack();
  assert.equal(result.band, 'Far'); assert.equal(result.total, 8, '6 + 4 + 3 − d6 [5]'); assert.equal(result.hit, false);
  assert.match(q('#atk_detail_text').textContent, /más allá del alcance del arma \(Very Close\): Desventaja/);
});

test('an attack needs an attacker and a different target', async () => {
  const { dice, q, a } = scene();
  q('#dmg_target_select').value = '';
  await assert.rejects(dice.executeAttack(), /Elige un objetivo/);
  q('#dmg_target_select').value = a.id;
  await assert.rejects(dice.executeAttack(), /a sí mismo/);
});

test('the reported case: a Close pistol with no Range on the sheet, 23 squares away behind a wall, attacks with Disadvantage and warns about the wall', async () => {
  const { dice, q, a, t } = scene({ weapon: { name: 'Pistola Cinética Militar', trait: 'Agility', range: '', damage: '5' }, squares: 23 });
  const map = store.getActiveMap();
  map.walls = [{ id: 'w', x1: (a.x + t.x) / 2, y1: a.y - 200, x2: (a.x + t.x) / 2, y2: a.y + 200 }];
  faces([[6, 12], [4, 12], [5, 6]]);
  const result = await dice.executeAttack();
  assert.equal(result.band, 'Extreme');
  assert.equal(result.total, 6, '6 + 4 + Agility 1 − d6 [5]');
  const detail = q('#atk_detail_text').textContent;
  assert.match(detail, /objetivo a Extreme \(44\.0 m, 22\.0 casillas\) · alcance del arma Close/);
  assert.match(detail, /línea de tiro bloqueada/);
  assert.match(detail, /más allá del alcance del arma \(Close\): Desventaja/);
});

// A stand-in for the 3D dice: it records what is thrown and answers with the queued faces.
function table3D(queue) {
  const thrown = [], shown = [];
  window.VFDice3D = { roll: async groups => { thrown.push(groups.map(g => `${g.qty}d${g.sides}:${g.role}`)); return { values: groups.flatMap(g => Array.from({ length: g.qty }, () => queue.shift())) }; }, showResults: data => shown.push(data) };
  store.state.dice3d = true;
  return { thrown, shown };
}
const with3D = (dice, run) => { dice.is3D = true; dice.attackToDamagePause = 0; return run().finally(() => { delete window.VFDice3D; }); };

test('Disadvantage throws its d6 on the table, subtracts the face shown and reports it; the damage dice are thrown in 3D too', async () => {
  const { dice, q } = scene({ weapon: { trait: 'Finesse', range: 'Close', damage: '1d8+1', damageMode: 'base' }, attacker: { proficiency: 2 }, squares: 7 }); // 6 squares (12 m) base to base: beyond Close
  const { thrown, shown } = table3D([9, 7, 4, /* damage */ 6, 3]);
  const result = await with3D(dice, () => dice.executeAttack());
  assert.deepEqual(thrown[0], ['1d12:Hope', '1d12:Fear', '1d6:Disadvantage']);
  assert.equal(result.total, 15, '9 + 7 + Finesse 3 − d6 [4]');
  assert.match(q('#atk_detail_text').textContent, /Hope \[9\] \+ Fear \[7\] \+ 3 − d6 \[4\] \(Desventaja\) = 15/);
  assert.deepEqual(shown[0].rolls.map(r => [r.value, r.role]), [[9, 'Hope'], [7, 'Fear'], [4, 'Disadvantage']]);
  assert.equal(shown[0].modifiers, 'Hope [9] + Fear [7] + 3 − d6 [4] (Desventaja) = 15', 'the whole d6 is written out, never folded into one Mod figure');
  assert.equal(q('#cube_extra_num').textContent, '4'); assert.equal(q('#label_extra_die').textContent, 'DIS (-d6)');
  assert.match(store.state.logs.find(l => l.type === 'CHECK').details, /\+ 3 − d6 \[4\] \(Desventaja\) = 15 vs DC/);
  // Proficiency 2 on a 1d8+1 weapon: two d8 on the table, and their faces are the damage.
  assert.deepEqual(thrown[1], ['2d8:Damage']);
  assert.equal(q('#dmg_raw_val').textContent, '10', '6 + 3 + 1');
  assert.deepEqual(shown[1].rolls.map(r => [r.value, r.sides]), [[6, 8], [3, 8]]); assert.equal(shown[1].total, 10);
});

test('an adversary throws its d20 and the Disadvantage d6 in 3D; a critical maximises damage without rolling', async () => {
  const { dice, q } = scene({ attacker: { isPlayer: false, attackModifier: 2 } });
  q('#dmg_formula').value = '2d6+1'; q('#dice_disadvantage').checked = true;
  const { thrown, shown } = table3D([15, 3, /* damage */ 2, 5]);
  const hit = await with3D(dice, () => dice.executeAttack());
  assert.deepEqual(thrown, [['1d20:Attack', '1d6:Disadvantage'], ['2d6:Damage']]);
  assert.equal(hit.total, 14, '15 + 2 − 3'); assert.match(q('#atk_detail_text').textContent, /d20 \[15\] \+ 2 − d6 \[3\] = 14/);
  assert.equal(shown[0].outcome, 'IMPACTO'); assert.equal(q('#dmg_raw_val').textContent, '8');
  q('#dice_disadvantage').checked = false;
  const second = table3D([20]);
  const crit = await with3D(dice, () => dice.executeAttack());
  assert.equal(crit.critical, true); assert.deepEqual(second.thrown, [['1d20:Attack']]); assert.equal(q('#dmg_raw_val').textContent, '13');
});

test('a player Critical throws twice the damage pool, Proficiency included; the Resolve die on the table is the one that counts', async () => {
  const { dice, q, a } = scene({ weapon: { name: 'Pistola de pruebas', trait: 'Finesse', range: 'Close', damage: '2d8+2', damageMode: 'base' }, attacker: { proficiency: 3, path: 'Sleeping', level: 1, resolve: { current: 2, max: 2, dieType: 'd4' } } });
  q('#dice_use_resolve').checked = true;
  const { thrown } = table3D([5, 5, 3, /* 8d8 */ 1, 2, 3, 4, 5, 6, 7, 8]);
  const result = await with3D(dice, () => dice.executeAttack());
  assert.deepEqual(thrown, [['1d12:Hope', '1d12:Fear', '1d4:Resolve'], ['8d8:Damage']]);
  assert.equal(result.critical, true); assert.equal(result.total, 16, '5 + 5 + Finesse 3 + Resolve [3]');
  assert.equal(q('#dmg_raw_val').textContent, '38', '36 on the dice + 2');
  assert.equal(a.path, 'Sleeping');
});

test('damage follows the sheet: levelling up refreshes Proficiency and Honed Edge, a typed value is kept', async () => {
  const { applyLevelUp } = await import('../src/advancement.js');
  const { weaponPreset, damageDicePools, tokenInventory } = await import('../src/equipment.js');
  const { dice, q, a, live } = scene({ weapon: { damage: '1d8', damageMode: 'base' }, attacker: { path: 'Sleeping', level: 1, proficiency: 1, honedEdgeBonus: 0, resolve: { current: 2, max: 2, dieType: 'd4' } } });
  assert.deepEqual([q('#dmg_proficiency').value, q('#dmg_honed').value], ['1', '0']);
  // Level 2 is a Tier Achievement: Proficiency 2; Honed Edge is level − 1.
  store.updateToken(a.id, applyLevelUp(live(a.id), { picks: [{ id: 'hp' }, { id: 'stress' }] }).token);
  assert.deepEqual([live(a.id).proficiency, live(a.id).honedEdgeBonus], [2, 1]);
  q('#dmg_is_direct').checked = true; faces([[4, 8], [6, 8]]);
  dice.executeDamageCalc();
  assert.deepEqual([q('#dmg_proficiency').value, q('#dmg_honed').value], ['2', '1']);
  assert.equal(q('#dmg_raw_val').textContent, '11', '2d8 [4, 6] + Honed Edge 1');
  q('#dmg_proficiency').value = 4; store.updateToken(a.id, { proficiency: 3 });
  dice.executeDamageCalc(); assert.equal(q('#dmg_proficiency').value, '4', 'a value typed by hand is not overwritten');
  // Proficiency goes to one listed die only (ch. 10): 2d8+2 at Proficiency 3 is 4d8+2.
  assert.deepEqual(damageDicePools('2d8+2', { proficiency: 3 }), [{ sides: 8, count: 4 }]);
  assert.deepEqual(damageDicePools('1d8+1d4', { proficiency: 2, isCritical: true }), [{ sides: 8, count: 4 }, { sides: 4, count: 2 }]);
  assert.deepEqual(damageDicePools('', { proficiency: 2, diceCount: 1, diceSides: 4 }), [{ sides: 4, count: 2 }]);
  assert.deepEqual(damageDicePools('2d8', { isKeeperCritical: true }), []);
  assert.deepEqual(weaponPreset({ isPlayer: true, path: 'Sleeping', level: 4, proficiency: 2 }, { damage: 'd8', damageMode: 'base' }), { formula: 'd8', proficiency: 2, honed: 3 });
  // A sheet from another tool with a frozen "final" damage returns to its base dice on level-up.
  const sheet = { isPlayer: true, path: 'Awakened', level: 1, proficiency: 1, hp: { current: 6, max: 6, majorThreshold: 3, severeThreshold: 6 }, stress: { current: 0, max: 6 }, sourceCharacter: { document: { fields: { wpri_name: 'Rifle', wpri_dmg: 'd10+1', wpri_dmg_final: '1d10+1' } } } };
  assert.equal(tokenInventory(sheet).weapons[0].damageMode, 'final');
  const levelled = applyLevelUp(sheet, { picks: [{ id: 'hp' }, { id: 'stress' }] }).token, rifle = tokenInventory(levelled).weapons[0];
  assert.deepEqual([rifle.damage, rifle.damageMode, weaponPreset(levelled, rifle).proficiency], ['d10+1', 'base', 2]);
});

test('with no weapon the attack is unarmed: it cannot be made beyond Melee', async () => {
  const far = scene({ squares: 6 });
  const blocked = await far.dice.executeAttack();
  assert.deepEqual([blocked.hit, blocked.blocked], [false, true]);
  assert.equal(far.q('#atk_outcome_val').textContent, 'FUERA DE ALCANCE');
  assert.match(far.q('#atk_detail_text').textContent, /Sin arma el ataque es cuerpo a cuerpo/);
  assert.equal(far.q('#damage_result_display').style.display, 'none');
});

test('a roll is announced once: the golden card of the results stack, never a second overlay', async () => {
  const { readFileSync } = await import('node:fs');
  const dice3d = readFileSync(new URL('../public/assets/3d-dice/vf-dice3d.js', import.meta.url), 'utf8');
  assert.ok(!/display\.showResults\(/.test(dice3d), 'the bottom results overlay is no longer drawn');
  assert.match(dice3d, /function pushResultCard\(/); assert.match(dice3d, /stack\.append\(card\)/, 'cards are added in arrival order');
  // The table callout and the 3D result feed the same stack, so two rolls show two cards.
  const pushed = [], sent = [];
  window.VFDice3D = { pushResultCard: data => pushed.push(data), showResults: data => pushed.push(data) };
  const { VeilfarersDiceEngine3D } = await import('../src/vtt-integration/modules/diceEngine3D.js').catch(() => ({}));
  const { dice } = scene();
  network.broadcast = message => sent.push(message);
  dice.announceRoll({ tokenName: 'Maren', total: 12, modifiers: 'd20 [10] + 2 = 12' }, { rolled3D: true });
  dice.announceRoll({ tokenName: 'Pirata', total: 7, modifiers: 'd20 [5] + 2 = 7' }, { rolled3D: true, secret: true });
  assert.deepEqual(pushed.map(c => c.tokenName), ['Maren', 'Pirata']);
  assert.deepEqual(sent.filter(m => m.type === 'DICE_ROLL').map(m => m.result.tokenName), ['Maren'], 'a secret roll is not sent to the table');
  delete window.VFDice3D; void VeilfarersDiceEngine3D;
});

test('weapon properties that change the attack roll: Reliable, Accurate, Smart Scope; Reach', () => {
  assert.deepEqual(weaponAttackBonus({ features: 'Reliable: +1 attack' }, 'Close'), { bonus: 1, notes: ['Reliable +1'] });
  assert.deepEqual(weaponAttackBonus({ features: 'Accurate' }, 'Close').bonus, 0);
  assert.deepEqual(weaponAttackBonus({ features: 'Accurate; Smart Scope' }, 'Far'), { bonus: 3, notes: ['Accurate +1', 'Smart Scope +2'] });
  assert.deepEqual(weaponAttackBonus({ features: 'Lightweight: 0 Burden; Energy Tag: Energy dmg; Pen -2' }, 'Melee'), { bonus: 0, notes: [] });
  assert.equal(weaponAttackBonus(null, 'Far').bonus, 0);
  assert.equal(rangeCheck({ name: 'Vibro-lanza', range: 'Melee', features: 'Reach' }, 'Very Close').allowed, true);
  assert.equal(rangeCheck({ name: 'Vibro-lanza', range: 'Melee', features: 'Reach' }, 'Close').allowed, false);
});

test('token distance is measured base to base', () => {
  const g = 64;
  // A size-2 creature whose base touches a size-1 token: Melee (centres 1.5 squares apart).
  assert.equal(distanceInfo({ x: 0, y: 0, size: 1 }, { x: 96, y: 0, size: 2 }, { gridSize: g }).band, 'Melee');
  // Centres 1.6 squares apart, as in the user's screenshot: still Melee base to base.
  assert.equal(distanceInfo({ x: 0, y: 0, size: 1 }, { x: 102, y: 0, size: 2 }, { gridSize: g }).band, 'Melee');
  assert.equal(tokenGapSquares({ x: 0, y: 0 }, { x: 64, y: 64 }, g).toFixed(2), '0.41', 'diagonal neighbours almost touch');
  assert.equal(distanceInfo({ x: 0, y: 0 }, { x: 64, y: 64 }, { gridSize: g }).band, 'Melee');
  assert.equal(distanceInfo({ x: 0, y: 0 }, { x: 128, y: 0 }, { gridSize: g }).band, 'Very Close', 'one empty square between bases: 2 m');
  assert.deepEqual([0, 0.5, 1, 2.5, 3, 5, 5.5, 12.5, 13].map(s => gapBandFor(s, 2)), ['Melee', 'Melee', 'Very Close', 'Very Close', 'Close', 'Close', 'Far', 'Far', 'Extreme']);
});

test('the hand selects an attribute, turns the live card, then links a targeted spell to the dice and log', async () => {
  const {CardHand} = await import('../src/cardHandUI.js');
  const {loadCardData} = await import('../src/cardData.js');
  const {openResolution} = await import('../src/cardResolutionUI.js');
  await loadCardData();
  const {a,t,dice} = scene({ attacker:{characterClass:'Vanguard',subclass:'Ghost Blade',hope:6} });
  a.sheetFields = {a_pwr_1_n:'Synaptic Disruption'};
  store.state.userRole = 'player'; store.state.claimedTokenId = a.id;
  window.veilDiceRoller = dice;
  const bar = document.createElement('div'); document.body.append(bar);
  const hand = new CardHand(bar);
  const inspect = name => hand.inspect(hand.cards.find(c => c.name === name));
  const path = inspect('Path to Nirvana');
  const trait = path.querySelector('vf-select[name=path_trait]');
  assert.ok(trait); trait.value = 'agility';
  await path.querySelector('[data-card-play]').onclick();
  assert.equal(store.state.tokens.find(x=>x.id===a.id).effectClocks[0].trait,'agility');
  assert.ok(hand.root.querySelector('.vf-path-reverse'));
  assert.match(inspect('Breaking Point').textContent,/after any multipliers/);
  const spell = inspect('Synaptic Disruption');
  spell.querySelector('[name=card_target]').value=t.id;
  await spell.querySelector('[data-card-play]').onclick();
  assert.equal(dice.preparedCard.traitId,'presence'); const id=dice.preparedCard.playId;
  await dice.executeActionCheck();
  const entry = store.state.logs.find(row=>row.resolution?.id===id);
  assert.equal(entry.resolution.phase,'ready');assert.deepEqual(entry.resolution.targetIds,[t.id]);
  store.state.userRole='keeper';
  const panel = openResolution(id);
  assert.ok(panel.querySelector('[data-effect=apply]'));assert.match(panel.textContent,/Presence Spellcast Roll/);
  panel.querySelector('[name=kind]').value='note';panel.querySelector('[name=kind]').onchange();
  panel.querySelector('[name=note]').value='Consecuencia acordada';
  panel.querySelector('[data-effect=apply]').click();
  assert.match(store.state.logs.find(row=>row.resolution?.id===id).resolution.applied[0].label,/Consecuencia acordada/);
  hand.unsubscribe(); delete window.veilDiceRoller;
});

test('Swarm Tactics from its card rolls two attacks and retains both shield decisions', async () => {
  const {openSwarmAttack} = await import('../src/swarmAttackUI.js');
  const {a,t,dice} = scene({attacker:{isPlayer:false,actorType:'adversary',hp:{current:3,max:6},attackModifier:20,damageExpression:'1d8 (Horde) / 1d4 (Depleted)',featureNotes:'**Swarm Tactics** _(Passive):_ While the Horde has 3+ HP, it can attack two targets within Close range simultaneously.'},target:{isPlayer:true,evasion:6}});
  const b={...structuredClone(t),id:'second-target',name:'Segundo objetivo',x:t.x+1};
  store.state.tokens.push(b);window.veilDiceRoller=dice;
  const modal=openSwarmAttack(a.id,t.id);
  modal.querySelector('input[value="second-target"]').checked=true;
  await modal.querySelector('[data-swarm]').onclick();
  const results=document.querySelector('[aria-label="Swarm Tactics · resultados"]');
  assert.ok(results,modal.textContent);
  assert.equal(results.querySelectorAll('[data-hit]').length,2);
  for(const [i,btn] of [...results.querySelectorAll('[data-hit]')].entries()){
    btn.click();
    const confirm=document.querySelector('#kdmg_apply');
    assert.ok(confirm);
    assert.ok(confirm.closest('[role=dialog]').textContent.includes([t,b][i].name));
    confirm.click();
  }
  assert.equal(store.state.logs.filter(row=>row.title==='Ataque · '+a.name).length,2);
  delete window.veilDiceRoller;
});

test('Burst Fire adds to the weapon once without repeating typed Vanguard damage', async () => {
  const { dice, q, t, live } = scene({ weapon: { features: 'Burst Fire' } });
  q('#dmg_formula').value = '1d8 Physical';
  await dice.executeDamageCalc([8], {
    extraFaces: [2],
    riders: [
      {label:'Primer golpe',branch:'Void',value:2},
      {label:'Breaking Point',branch:'Void',value:3},
    ],
  });
  assert.equal(dice.lastDamage.raw,15);
  assert.equal(q('#dmg_raw_val').textContent,'15');
  q('#apply_dmg_to_target_btn').click();
  document.querySelector('#kdmg_apply').click();
  assert.equal(live(t.id).hp.current,4);
});

test('the Keeper can open a new narrative arc from the log after clearing the original play', async () => {
  const { CombatLogView } = await import('../src/combatLog.js');
  const { a } = scene();
  const key = JSON.stringify(['story arc','unassigned','Megascale Fabrication']);
  store.updateToken(a.id,{cardUses:{[key]:'story arc'}});
  store.update({arcs:[]});
  const container = document.createElement('section');
  document.body.append(container);
  new CombatLogView(container);
  container.querySelector('#clear_log_btn').click();
  container.querySelector('[data-new-arc]').click();
  document.querySelector('[data-renew]').click();
  assert.deepEqual(store.state.tokens.find(t=>t.id===a.id).cardUses,{});
  assert.equal(container.querySelector('[data-new-arc]'),null);
});

test('a table panel leaves the map interactive and switching actors cannot play the old hand', async () => {
  const { CardHand } = await import('../src/cardHandUI.js');
  const { loadCardData } = await import('../src/cardData.js');
  const { dossierDialog } = await import('../src/dossierDialog.js');
  await loadCardData();
  const { a, t } = scene({ attacker: { characterClass: 'Vanguard', hope: 6 }, target: { actorType: 'player', isPlayer: true } });
  store.state.userRole = 'player'; store.state.claimedTokenId = a.id;
  const bar = document.createElement('div'), mapControl = document.createElement('button');
  document.body.append(bar, mapControl);
  const hand = new CardHand(bar);
  const card = hand.cards.find(c => c.name === 'Path to Nirvana');
  const first = hand.inspect(card), panel = hand.inspect(card);
  assert.equal(first.isConnected, false);
  assert.equal(panel.querySelector('[role=dialog]').getAttribute('aria-modal'), 'false');
  assert.equal(panel.querySelector('.table-rule').open, false);
  panel.querySelector('[name=path_trait]').value = 'instinct';
  mapControl.onclick = () => store.update({ selectedTokenId: t.id });
  mapControl.focus(); mapControl.click();
  assert.equal(document.activeElement, mapControl);
  await panel.querySelector('[data-card-play]').onclick();
  assert.ok(panel.isConnected); assert.match(panel.querySelector('[role=alert]').textContent, /cambiado/);
  assert.equal(store.state.tokens.find(x => x.id === a.id).hope, 6);
  assert.equal(store.state.tokens.find(x => x.id === t.id).effectClocks?.length || 0, 0);
  const full = dossierDialog('Ficha', '');
  assert.equal(full.querySelector('[role=dialog]').getAttribute('aria-modal'), 'true');
  hand.unsubscribe();
});

test('the damage panel keeps its target, prevents duplicate prompts and refreshes a changed defense', async () => {
  const { dice, q, t, live } = scene({ weapon: {} });
  q('#dmg_formula').value = '1d8 Physical';
  await dice.executeDamageCalc([8]);
  const open = q('#apply_dmg_to_target_btn');
  open.click(); open.click();
  const panels = () => document.querySelectorAll('.damage-action-dialog');
  assert.equal(panels().length, 1);
  assert.equal(panels()[0].querySelector('[role=dialog]').getAttribute('aria-modal'), 'false');
  store.updateToken(t.id, { hp: { ...t.hp, current: 5 } });
  panels()[0].querySelector('#kdmg_apply').click();
  assert.equal(live(t.id).hp.current, 5);
  assert.equal(panels().length, 1); assert.match(panels()[0].textContent, /HP 4\/6/);
  panels()[0].querySelector('#kdmg_apply').click();
  assert.equal(live(t.id).hp.current, 4); assert.equal(panels().length, 0);
});
