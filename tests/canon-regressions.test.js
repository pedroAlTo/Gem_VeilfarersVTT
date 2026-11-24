import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import { JSDOM } from 'jsdom';
import { loadAdversaries } from '../scripts/adversary-library.mjs';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData', 'NodeFilter']) globalThis[key] = dom.window[key];
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const { store } = await import('../src/state.js');
await store.ready;
const { createActor } = await import('../src/actors.js');
const { network } = await import('../src/networkManager.js');
const { audio } = await import('../src/audioEngine.js');
const { DiceRollerSidebar } = await import('../src/diceRoller.js');
const { RulesCompendiumModal } = await import('../src/rulesCompendium.js');
const { FearMeterHUD } = await import('../src/fearMeter.js');
const { StarshipManager } = await import('../src/starshipManager.js');
const { performGameAction } = await import('../src/gameActions.js');
const { lifeStage, nextSpotlightRound } = await import('../src/combatState.js');
const { resolveJump } = await import('../src/starshipJump.js');
const { parseDamageExpression, tokenInventory } = await import('../src/equipment.js');
const { deployAdversary } = await import('../src/adversaryLibrary.js');
const { damageProtection, hitTypes } = await import('../src/damageProtection.js');
const { damageTypeOf } = await import('../src/rulesEngine.js');
const { loadCardData } = await import('../src/cardData.js');
const { characterCards, FEAR_MOVES } = await import('../src/loadoutCards.js');
const { setLanguage } = await import('../src/i18n.js');

const cards = await loadCardData();
const initial = structuredClone(store.state);
const panel = () => document.body.appendChild(document.createElement('div'));
const get = actor => store.state.tokens.find(t => t.id === actor.id);
const act = (actor, route, options = {}) => performGameAction({ type: route, actorId: actor.id, ...options }, store);
function character(name, fields = {}) {
  const pc = createActor({ name, hope: 2, x: 200, y: 200, ...fields }, store.getActiveMap().id);
  store.state.tokens.push(pc);
  return pc;
}
function atTable(pc, target) {
  store.state.selectedTokenId = pc.id;
  const el = panel(), dice = new DiceRollerSidebar(el);
  dice.syncWithSelectedToken();
  dice.populateDamageTargets();
  el.querySelector('#dmg_target_select').value = target.id;
  return { dice, el };
}
async function applyDamage(dice, el, amount) {
  el.querySelector('#dmg_formula').value = String(amount);
  await dice.executeDamageCalc();
  el.querySelector('#apply_dmg_to_target_btn').click();
  assert.ok(document.querySelector('#kdmg_apply'), 'the Keeper chooses how many shields to spend');
  document.querySelector('#kdmg_apply').click();
}
function reset() {
  store.listeners.clear();
  store.state = { ...structuredClone(initial), campaignId: crypto.randomUUID(), tokens: [], logs: [], userRole: 'keeper', selectedTokenId: '', dice3d: false };
  store.sessionRole = 'local';
  store.remoteApplying = false;
  store.sessionBusy = false;
  store.undoManager = null;
  audio.muted = true;
  document.body.replaceChildren();
  network.broadcast = () => {};
  network.sendChat = async () => {};
  network.requestAction = async action => performGameAction(action, store);
}
beforeEach(reset);
after(async () => { await store.saveQueue; dom.window.close(); });

test('damage at the table marks Dying, blocks normal actions and preserves Hope', async () => {
  const pc = character('Patient', { hp: { current: 1, max: 6, majorThreshold: 6, severeThreshold: 12 } });
  const ally = character('Medic');
  const hit = atTable(ally, pc);
  await applyDamage(hit.dice, hit.el, 3);
  assert.equal(get(pc).hp.current, 0);
  assert.deepEqual(get(pc).conditions, ['Dying']);
  const { dice } = atTable(get(pc), ally);
  await assert.rejects(dice.executeAttack(), /Dying/);
  assert.throws(() => act(pc, 'CHECK', { options: { dc: 10, traitId: 'knowledge' } }), /Dying/);
  assert.equal(get(pc).hope, 2);
  store.updateToken(pc.id, { hp: { ...get(pc).hp, current: 4 } });
  assert.equal(get(pc).hp.current, 0, 'ordinary healing requires stabilization');
  assert.equal(lifeStage({ ...get(pc), conditions: [] }), 'Dying', 'older saved characters');
});

test('Dying and Final progress once per Spotlight, stabilize at zero and return with Long Bruise', t => {
  const pc = character('Patient', { hp: { current: 0, max: 6 }, stress: { current: 2, max: 6 } });
  const medic = character('Medic', { subtraits: { medicine: 2 } });
  const progress = face => { store.setTokenSpotlight(pc.id, true); act(pc, 'LIFE_TURN', { face }); };
  progress(7);
  assert.equal(get(pc).lifeProgress, 0);
  assert.throws(() => progress(12), /resuelto/);
  nextSpotlightRound(store); progress(8); assert.equal(get(pc).lifeProgress, 1);
  nextSpotlightRound(store); progress(12); assert.equal(lifeStage(get(pc)), 'Final');
  store.updateToken(medic.id, { x: 10000 });
  assert.throws(() => act(medic, 'STABILIZE', { targetId: pc.id, traitId: 'finesse' }), /adyacente/);
  store.updateToken(medic.id, { x: 200 });
  t.mock.method(Math, 'random', () => 0.5); // Matching dice succeed even at DC 20.
  const roll = act(medic, 'STABILIZE', { targetId: pc.id, traitId: 'knowledge' });
  assert.equal(roll.dc, 20);
  assert.equal(roll.subtraitMod, 2);
  assert.deepEqual([lifeStage(get(pc)), get(pc).hp.current, get(pc).lifeProgress], ['Stabilized', 0, 0]);
  store.updateToken(pc.id, { hp: { ...get(pc).hp, current: 3 } });
  assert.deepEqual([get(pc).hp.current, get(pc).hp.max, get(pc).stress.current, ...get(pc).conditions], [1, 6, 3, 'Long Bruise']);
});

test('two Final marks or a voluntarily resolved Blaze end the character', () => {
  const pc = character('Pilot', { hp: { current: 0, max: 6 }, conditions: ['Final'] });
  store.setTokenSpotlight(pc.id, true);
  act(pc, 'LIFE_TURN', { face: 8 }); nextSpotlightRound(store);
  store.setTokenSpotlight(pc.id, true); act(pc, 'LIFE_TURN', { face: 12 });
  assert.equal(lifeStage(get(pc)), 'Dead');
  const other = character('Engineer', { hp: { current: 0, max: 6 }, hasSpotlight: true });
  const blaze = { blaze: 'A perfect final act' };
  assert.throws(() => act(other, 'LIFE_TURN', blaze), /Confirma/);
  act(other, 'LIFE_TURN', { ...blaze, confirmed: true });
  assert.equal(lifeStage(get(other)), 'Last Act');
  assert.throws(() => act(other, 'LIFE_TURN', { face: 8 }), /Spotlight/);
  act(other, 'LIFE_TURN', { finish: true });
  store.updateToken(other.id, { hp: { current: 1, max: 6 } });
  assert.deepEqual([lifeStage(get(other)), get(other).hp.current], ['Dead', 0]);
});

test('Overwhelmed, Vulnerable and cancellation reach the resolved roll through the attack panel', async () => {
  const pc = character('Pilot', { stress: { current: 6, max: 6 } });
  const options = { traitId: 'knowledge', dc: 15, forcedHope: 9, forcedFear: 7, forcedAdv: 4 };
  assert.equal(act(pc, 'CHECK', { options }).total, 12);
  const target = character('Target', { isPlayer: false, evasion: 14, conditions: ['Vulnerable'] });
  const { dice } = atTable(pc, target);
  network.requestAction = async action => performGameAction({ ...action, options: { ...action.options, forcedHope: 7, forcedFear: 5, forcedAdv: 4 } }, store);
  let roll = await dice.executeAttack();
  assert.deepEqual([roll.total, roll.hit], [12, false]);
  store.updateToken(pc.id, { stress: { current: 5, max: 6 } });
  dice.syncWithSelectedToken();
  roll = await dice.executeAttack();
  assert.deepEqual([roll.total, roll.hit], [16, true]);
});

for (const [condition, loss] of [['', 3], ['Lithoderm · Resistance to Physical', 2], ['Phase Shift · Incorporeal', 0]]) {
  test('13 Physical against 6/12 at the table · ' + (condition || 'ordinary hit'), async () => {
    const attacker = character('Attacker'), target = character('Defender', { conditions: condition ? [condition] : [], hp: { current: 6, max: 6, majorThreshold: 6, severeThreshold: 12 } });
    const { el, dice } = atTable(attacker, target);
    el.querySelector('#dmg_damage_type').value = 'physical';
    el.querySelector('#dmg_weapon_bleed').checked = true;
    await applyDamage(dice, el, 13);
    assert.equal(el.querySelector('#dmg_hp_loss_val').textContent, loss + ' HP');
    assert.equal(get(target).hp.current, 6 - loss);
    assert.equal(get(target).conditions.includes('Bleeding'), loss > 0);
  });
}

test('printed tags match active defenses and multiple resistances do not stack', () => {
  const types = hitTypes('energy', { name: 'Plasma carbine' }, '2d6');
  assert.equal(damageProtection({ conditions: ['Resistance: Plasma', 'Resistance: Energy'] }, types), 'resistant');
  assert.equal(damageProtection({ conditions: ['Resistance: Energy', 'Immunity: Plasma'] }, types), 'immune');
  assert.equal(damageProtection({ conditions: ['Immunity: Physical'] }, types), '');
  assert.equal(damageTypeOf('2d8 Fire'), 'energy');
  assert.equal(damageTypeOf('2d8 Physical (Acid)'), 'physical');
});

test('Codex updates in both languages, with two Effort segments and the correct damage ladder', () => {
  setLanguage('es');
  const codex = new RulesCompendiumModal(); codex.open();
  const content = () => document.querySelector('#compendium_body').textContent.replace(/\s+/g, ' ');
  assert.match(content(), /2 segmentos/);
  assert.match(content(), /10 puntos completos/);
  assert.match(content(), /no generan Effort/);
  setLanguage('en');
  assert.match(content(), /2 segments/); assert.match(content(), /full 10 above Severe/); assert.match(content(), /grant no Effort/);
  assert.doesNotMatch(content(), /double the Severe threshold instantly|Further stress converts/);
  codex.close(); setLanguage('es');
});

test('all 48 combat profiles carry their printed attack or special procedure', () => {
  const deployed = loadAdversaries().filter(e => e.placement !== 'narrative');
  assert.equal(deployed.length, 48);
  const narrative = [], notable = {};
  for (const entry of deployed) {
    const token = deployAdversary(entry, { hidden: false });
    const weapons = tokenInventory(token).weapons;
    assert.equal(token.damageExpression, entry.damage);
    if (!weapons.length) narrative.push(entry.name);
    for (const w of weapons) assert.doesNotThrow(() => parseDamageExpression(w.damage), entry.name + ': ' + w.damage);
    notable[entry.name] = weapons;
  }
  assert.deepEqual(narrative.sort(), ['NEON JELLY', 'THE ASCENDED', 'THE SWARM-LORD', 'VOID LEECH']);
  assert.deepEqual(notable['CHARON SKITTER-RAT SWARM'].map(w => w.damage), ['1d8', '1d4']);
  const vanko = Object.entries(notable).find(([k]) => k.startsWith('VANKO'))[1];
  assert.deepEqual(vanko.map(w => w.damage), ['1d8 Physical', '2d6 Energy']);
  assert.match(vanko[0].features, /Incapacitated/);
  assert.equal(notable['BIOMANCER ABOMINATION'].length, 3);
  assert.equal(notable['THE BIOMANCER'].length, 3);
});

test('a thresholdless minion takes one HP per ordinary hit and its printed Stress attack never damages HP', async () => {
  const jelly = deployAdversary(loadAdversaries().find(e => e.name === 'NEON JELLY'), { hidden: false });
  const hero = character('Scout');
  const hit = atTable(hero, jelly);
  await applyDamage(hit.dice, hit.el, 40);
  assert.equal(get(jelly).hp.current, 2);
  assert.match(hit.el.querySelector('#dmg_detail_text').textContent, /1 HP por impacto/);

  const sting = atTable(get(jelly), hero);
  await sting.dice.executeDamageCalc();
  assert.equal(sting.el.querySelector('#dmg_hp_loss_val').textContent, '0 HP');
  const apply = sting.el.querySelector('#apply_dmg_to_target_btn');
  apply.click(); apply.click();
  assert.equal(get(hero).stress.current, 3);
  assert.equal(get(hero).hp.current, hero.hp.max);
});

test('objective encounters open their printed procedure and stay out of damage targeting', async () => {
  const marker = deployAdversary(loadAdversaries().find(e => e.name === 'THE GRANDFATHER LEVIATHAN'));
  const hero = character('Scout');
  const { el } = atTable(hero, hero);
  assert.ok(!Array.from(el.querySelector('#dmg_target_select').options).some(o => o.value === marker.id));
  const { openDossier } = await import('../src/dossierUI.js');
  const sheet = openDossier(marker);
  assert.match(sheet.textContent, /GRANDFATHER LEVIATHAN/);
  assert.equal(sheet.querySelector('[name="hp_max"]'), null);
  sheet.querySelector('[data-hidden]').click();
  assert.equal(get(marker).hidden, false);
});

test('switching a published weapon prepares the alternate damage in the dice panel', async () => {
  const entry = loadAdversaries().find(e => e.name.startsWith('VANKO'));
  const enemy = deployAdversary(entry, { hidden: false }), target = character('Target', { x: enemy.x + 1, y: enemy.y });
  const { dice, el } = atTable(enemy, target);
  const select = el.querySelector('#dmg_weapon_select');
  assert.equal(el.querySelector('#dmg_formula').value, '1d8 Physical');
  select.value = 'main-attack-2'; select.dispatchEvent(new Event('change'));
  assert.equal(el.querySelector('#dmg_formula').value, '2d6 Energy');
  await dice.executeDamageCalc([3, 4]);
  assert.equal(dice.lastDamage.raw, 7);
});

test('the Fear header spends the card hand price and cannot buy the same enemy Spotlight twice', async () => {
  store.state.fear = 6;
  const enemy = character('Sentry', { isPlayer: false, actorType: 'adversary' });
  store.state.selectedTokenId = enemy.id;
  const el = panel();
  new FearMeterHUD(el);
  const buttons = () => {
    el.querySelector('#fear_spend_menu_btn').click();
    return [...document.querySelectorAll('.keeper-move-card')];
  };
  const first = buttons();
  assert.deepEqual(first.map(n => n.querySelector('strong').textContent), FEAR_MOVES.map(c => c.name + ' · ' + c.cost.fear + ' Fear'));
  await first[0].querySelector('button').onclick(); assert.equal(store.state.fear, 5);
  store.setTokenSpotlight(enemy.id, false);
  const again = buttons();
  await again[0].querySelector('button').onclick(); assert.equal(store.state.fear, 5);
  await again[2].querySelector('button').onclick(); assert.equal(store.state.fear, 3);
});

test('Rapid Regeneration pays and heals immediately, then heals on each new Spotlight of the target, never by toggling the marker', () => {
  const caster = character('Medic'), ally = character('Patient', { hp: { current: 3, max: 8 }, stress: { current: 2, max: 6 } });
  caster.sourceCharacter = { document: { fields: { a_pwr_1_n: 'Rapid Regeneration' } } };
  const power = characterCards(caster, cards).find(c => c.name === 'Rapid Regeneration');
  const play = () => act(caster, 'CARD_PLAY', { cardId: power.id, targetId: ally.id, durationFaces: [4] });
  store.updateToken(ally.id, { x: 2000 });
  assert.throws(play, /Very Close/); assert.equal(get(caster).hope, 2);
  store.updateToken(ally.id, { x: caster.x });
  play(); assert.equal(get(caster).hope, 1);
  const vitals = () => [get(ally).hp.current, get(ally).stress.current, get(ally).effectClocks[0]?.filled];
  assert.deepEqual(vitals(), [4, 1, 0]);
  store.setTokenSpotlight(ally.id, true);
  assert.deepEqual(vitals(), [5, 1, 1]);
  store.state = structuredClone(store.state);
  store.setTokenSpotlight(ally.id, false); store.setTokenSpotlight(ally.id, true);
  assert.deepEqual(vitals(), [5, 1, 1], 'toggling the marker is not a new Spotlight');
  // The Spotlight passes to someone else and comes back in the same round: a new Spotlight.
  store.setTokenSpotlight(caster.id, true); store.setTokenSpotlight(ally.id, true);
  assert.deepEqual(vitals(), [6, 1, 2]);
  nextSpotlightRound(store); store.setTokenSpotlight(ally.id, true);
  assert.deepEqual(vitals(), [7, 1, 3]);
});

test('FTL keeps the destination and Pearl through failures, charging once on entry into transit', () => {
  const nav = character('Navigator'), pilot = character('Pilot');
  const ship = () => store.state.starship;
  ship().pearls = 2; ship().heat = 0;
  const checks = [];
  function attempt(actor, step, hope, fear, extra = {}) {
    return resolveJump(store, get(actor), { step, destination: 'Kepler', underFire: true, solutionId: ship().jump?.id, ...extra }, action => {
      checks.push([action.options.traitId, action.options.dc]);
      return performGameAction({ ...action, options: { ...action.options, forcedHope: hope, forcedFear: fear } }, store);
    });
  }
  assert.throws(() => attempt(pilot, 'initiate', 12, 11), /solución/);
  attempt(nav, 'calculate', 2, 4); assert.deepEqual([ship().pearls, ship().heat, ship().jump ?? null], [2, 1, null]);
  nextSpotlightRound(store);
  attempt(nav, 'calculate', 4, 2, { underFire: false }); assert.equal(ship().heat, 1);
  nextSpotlightRound(store);
  attempt(nav, 'calculate', 9, 7); const solution = structuredClone(ship().jump); assert.equal(solution.destination, 'Kepler');
  assert.throws(() => attempt(nav, 'initiate', 12, 11), /Spotlight/);
  assert.throws(() => attempt(pilot, 'initiate', 12, 11, { solutionId: 'stale' }), /solución/);
  assert.throws(() => attempt(pilot, 'initiate', 12, 11, { turn: 'old-round' }), /ronda ha cambiado/);
  const drive = ship().systems['Primary Drive'] ?? 3;
  attempt(pilot, 'initiate', 2, 4); assert.deepEqual([ship().systems['Primary Drive'], ship().pearls, ship().jump], [drive - 1, 2, solution]);
  nextSpotlightRound(store);
  attempt(pilot, 'initiate', 4, 2); assert.equal(ship().systems['Primary Drive'], drive - 1);
  nextSpotlightRound(store);
  attempt(pilot, 'initiate', 1, 1); assert.deepEqual([ship().pearls, ship().jump.phase], [1, 'transit']);
  assert.throws(() => attempt(nav, 'initiate', 12, 11), /otro salto/);
  assert.deepEqual(checks, [['knowledge', 15], ['knowledge', 10], ['knowledge', 15], ['instinct', 10], ['instinct', 10], ['instinct', 10]]);
});

test('naval panel needs a selected crew member before it requests a roll', () => {
  const el = panel();
  store.state.starship.pearls = 2;
  new StarshipManager(el);
  let calls = 0;
  network.requestAction = async () => { calls++; };
  el.querySelector('#ftl_jump_btn').click();
  assert.equal(calls, 0);
  assert.equal(store.state.starship.pearls, 2);
});


test('the same enemy cannot retake the Spotlight in a round through its sheet or controls', () => {
  const foe = character('Foe', { isPlayer: false, actorType: 'adversary' });
  store.state.fear = 1;
  assert.equal(store.updateToken(foe.id, { spotlight: { enabled: true } }), true);
  assert.equal(store.state.fear, 0);
  assert.equal(store.setTokenSpotlight(foe.id, true), true, 'repeating an active marker is idempotent');
  assert.equal(store.setTokenSpotlight(foe.id, false), true);
  assert.equal(store.setTokenSpotlight(foe.id, true), false);
  store.state.fear = 3;
  assert.equal(store.updateToken(foe.id, { hasSpotlight: true }), false);
  assert.equal(store.state.fear, 3); assert.equal(get(foe).hasSpotlight, false);
  nextSpotlightRound(store);
  assert.equal(store.setTokenSpotlight(foe.id, true), true);
  assert.equal(store.state.fear, 2);
});

for (const shields of [0, 1]) {
  test('Rogue Synthetic retains its Physical hit against Shock immunity with ' + shields + ' shields', async () => {
    const entry = loadAdversaries().find(e => e.name === 'ROGUE SYNTHETIC');
    const enemy = deployAdversary(entry, { hidden: false });
    const target = character('Target', { hp: { current: 6, max: 6, majorThreshold: 6, severeThreshold: 12 },
      armor: { current: 2, max: 2 }, conditions: ['Immunity: Shock'] });
    const { dice, el } = atTable(enemy, target);
    assert.match(el.querySelector('#dmg_formula').value, /Phys.*Shock/);
    await dice.executeDamageCalc([8, 4]);
    assert.equal(dice.lastDamage.raw, 13);
    assert.equal(el.querySelector('#dmg_hp_loss_val').textContent, '2 HP');
    el.querySelector('#apply_dmg_to_target_btn').click();
    const slider = document.querySelector('#kdmg_shields');
    assert.ok(slider); slider.value = String(shields); slider.oninput();
    document.querySelector('#kdmg_apply').click();
    assert.equal(get(target).hp.current, 4 + shields);
    assert.equal(get(target).armor.current, 2 - shields);
  });
}
