// Plan de UX V3, fase 4 (v2.44.0): weapons apply their features. The catalog's properties are
// all known tags, each with the book's rule and what the table does; Rust & Steel 12.06 adds
// Heavy, Scatter, High-Recoil, Unstable, Defensive, Disruptor; Massive takes Evasion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATOR_DATA as data } from '../src/creator/creatorData.js';
import { setCardData } from '../src/cardData.js';
import { performGameAction } from '../src/gameActions.js';
import { combatTransition } from '../src/combatState.js';
import { EQUIPMENT_CATALOG } from '../src/equipmentLibrary.js';
import { WEAPON_TAGS, weaponTagList, tagsFromFeatures, canonicalTag, tagLabel } from '../src/weaponTags.js';
import { TABLE_USE, tagInfo } from '../src/weaponGlossary.js';
import { weaponAttackBonus } from '../src/attackFlow.js';
import { weaponAttackEdge, wielderEvasion, afterAttackStress, weaponDamageRiders, isMachineTarget, ignoresLineOfSight, featureReminders, weaponFeatures, armorCut } from '../src/weaponFeatures.js';

setCardData(data);
const weapons = EQUIPMENT_CATALOG.filter(i => i.category === 'weapons');

test('every property in the weapon catalog is a known tag with the book rule and what the table does', () => {
  assert.ok(weapons.length > 200);
  const unknown = [], noRule = [], noUse = [];
  for (const w of weapons) for (const tag of weaponTagList(w)) {
    const id = tag.split(':')[0], info = tagInfo(tag);
    if (!WEAPON_TAGS[id]) unknown.push(`${w.name}: ${tag}`);
    if (!TABLE_USE[id]) noUse.push(`${w.name}: ${tag}`);
    if (!info.rule && info.book !== 'Veilfarers VTT') noRule.push(`${w.name}: ${tag}`);
  }
  assert.deepEqual(unknown, [], 'every tag is in the registry');
  assert.deepEqual(noUse, [], 'every tag says what the table does');
  assert.deepEqual(noRule, [], 'every book tag carries its rule');
  // The Corebook controls the properties it defines; Rust & Steel adds its own.
  assert.equal(tagInfo('crushing').book, 'Corebook 12.06');
  assert.match(tagInfo('scatter').rule, /At Very Close range, attack rolls gain \+1/);
  assert.equal(tagInfo('scatter').mode, 'auto');
  assert.match(tagInfo('area:close').rule, /Agility Reaction Roll/, 'Area with a band is the Explosive procedure');
  // Book names are clean: «"Widow" Needler», not «Widow« Needler».
  assert.equal(weapons.filter(w => /\w«/.test(w.name)).length, 0);
});

test('the catalog spellings read as the canonical property (Rust & Steel compatibility)', () => {
  assert.deepEqual(tagsFromFeatures('Phasing (ignora 1 slot de armadura, Penetración -4)'), ['phasing'], 'a comma inside a parenthesis');
  assert.deepEqual(tagsFromFeatures('Reliable (fiable en barro, lluvia y vacío)'), ['reliable']);
  assert.deepEqual(tagsFromFeatures('Volatile, Armor Piercing 3, Overcharge'), ['volatile', 'armor-piercing:3', 'overcharge']);
  assert.deepEqual(tagsFromFeatures('Area Very Close, Thermal, Lingering'), ['area:very-close', 'thermal', 'lingering']);
  assert.deepEqual(tagsFromFeatures('Two-Handed, Energy, Blast (Close), Unstable'), ['two-handed', 'energy', 'area:close', 'unstable']);
  assert.deepEqual(tagsFromFeatures('Brutal, Stun, Cone, Defensive (+2), Range (Medium), Persistent'), ['devastating', 'stunning', 'spray', 'defensive:2', 'range:medium', 'lingering:3']);
  assert.deepEqual(tagsFromFeatures('Reach Very Close, Stunning en Crítico'), ['reach:very-close', 'stunning-on-crit']);
  // Sheets saved before: the run-on spellings come back as the property and its value.
  assert.deepEqual(['brutal', 'armor-piercing-3', 'area-close', 'phasing-ignora-1-slot-de-armadura', 'reliable-fiable-en-barro', 'pen-2'].map(canonicalTag),
    ['devastating', 'armor-piercing:3', 'area:close', 'phasing', 'reliable', 'pen-2']);
  assert.deepEqual(weaponTagList({ tags: ['brutal', 'devastating', 'stun'] }), ['devastating', 'stunning']);
  assert.equal(tagLabel('area:very-close'), 'Area (Very Close)'); assert.equal(tagLabel('defensive:2'), 'Defensive +2');
});

test('Heavy, Scatter, Massive, Defensive, High-Recoil, Unstable, Disruptor and Stable as the books say', () => {
  const strong = { traits: { strength: 1 } }, weak = { traits: { strength: 0 } };
  // Heavy: Strength +1 or higher, otherwise Disadvantage.
  assert.equal(weaponAttackEdge({ tags: ['heavy'] }, strong).disadvantage, false);
  assert.equal(weaponAttackEdge({ tags: ['heavy'] }, weak).disadvantage, true);
  assert.match(weaponAttackEdge({ tags: ['unwieldy', 'overcharge'] }, strong).ahead.join(' '), /Unwieldy.*Overcharge/);
  // Scatter: +1 up close, −1 at Close or beyond; +2 damage up close.
  assert.equal(weaponAttackBonus({ tags: ['scatter'] }, 'Very Close').bonus, 1);
  assert.equal(weaponAttackBonus({ tags: ['scatter'] }, 'Melee').bonus, 1);
  assert.equal(weaponAttackBonus({ tags: ['scatter'] }, 'Close').bonus, -1);
  assert.deepEqual(weaponAttackBonus({ tags: ['scatter'] }, 'Far').notes, ['Scatter −1']);
  assert.deepEqual(weaponDamageRiders({ tags: ['scatter'] }, { band: 'Very Close' }).map(r => [r.id, r.value]), [['scatter', 2]]);
  assert.deepEqual(weaponDamageRiders({ tags: ['scatter'] }, { band: 'Close' }), []);
  // Massive in hand −1 Evasion; Defensive +N against Melee only, the best one.
  assert.equal(wielderEvasion([{ tags: ['massive'] }]).mod, -1);
  assert.equal(wielderEvasion([{ tags: ['massive'], equipped: false }]).mod, 0, 'holstered');
  assert.equal(wielderEvasion([{ tags: ['defensive'] }, { tags: ['defensive:2'] }], { melee: true }).mod, 2);
  assert.equal(wielderEvasion([{ tags: ['defensive:2'] }], { melee: false }).mod, 0);
  // High-Recoil: Strength 0 or lower marks 1 Stress; Unstable on a Failure with Fear (not on doubles).
  assert.equal(afterAttackStress({ tags: ['high-recoil'] }, weak, {}).stress, 1);
  assert.equal(afterAttackStress({ tags: ['high-recoil'] }, strong, {}).stress, 0);
  assert.equal(afterAttackStress({ tags: ['unstable'] }, strong, { resultType: 'FAILURE_WITH_FEAR' }).stress, 1);
  assert.equal(afterAttackStress({ tags: ['unstable'] }, strong, { resultType: 'FAILURE_WITH_FEAR', isCritical: true }).stress, 0);
  assert.match(afterAttackStress({ tags: ['volatile'] }, strong, { resultType: 'FAILURE_WITH_FEAR' }).notes[0], /Volatile/);
  // Disruptor: one more normal die against a Synthetic, a drone or a machine.
  const synth = { isPlayer: true, species: 'Synthetic' }, drone = { actorType: 'drone' }, guard = { isPlayer: false, name: 'Security Drone' }, human = { isPlayer: true, species: 'Human' };
  assert.deepEqual([synth, drone, guard, human].map(isMachineTarget), [true, true, true, false]);
  assert.deepEqual(weaponDamageRiders({ damage: '1d8+2', tags: ['disruptor'] }, { target: guard }).map(r => r.dice), ['1d8']);
  assert.deepEqual(weaponDamageRiders({ damage: '1d8+2', tags: ['disruptor'] }, { target: human }), []);
  // Stable ignores Overheating; Guided needs no line of sight.
  assert.equal(weaponFeatures({ tags: ['overheating', 'stable'] }).overheating, false);
  assert.equal(ignoresLineOfSight({ tags: ['guided'] }), true); assert.equal(ignoresLineOfSight({ tags: ['accurate'] }), false);
  // System Shock follows the target; Knockdown uses its own DC; Massive is no longer a reminder.
  assert.match(featureReminders({ tags: ['system-shock'] }, { machine: false }).join(), /orgánico.*1d4 Stress/);
  assert.match(featureReminders({ tier: 'TT3', tags: ['knockdown'] }, { hit: true }).join(), /CD 15/);
  assert.match(featureReminders({ tier: 'TT1', tags: ['knockdown'] }, { hit: true }).join(), /CD 10/);
  assert.deepEqual(featureReminders({ tags: ['massive'] }, { hit: true }), []);
  assert.deepEqual(armorCut({ tags: ['shred'] }, { hit: true, damaged: true }, 3), { long: 0, repairAll: 1, downtime: 0, shred: 1 });
});

// The table rolls the attack: Heavy gives Disadvantage, High-Recoil and Unstable mark Stress,
// Scatter and Disruptor ride on the damage.
const scene = { id: 'deck', gridSize: 64, gridScaleMeters: 2, spotlightRound: 1 };
const pc = (id, patch = {}) => ({ id, name: id, mapId: scene.id, x: 64, y: 64, size: 1, isPlayer: true, actorType: 'player', characterClass: 'Soldier', path: 'Awakened', level: 1, proficiency: 1, hope: 2,
  traits: { agility: 1, strength: 0, finesse: 1 }, conditions: [], hp: { current: 6, max: 6 }, stress: { current: 0, max: 6 }, armor: { current: 1, max: 1 }, sheetFields: {}, ...patch });
function table(...tokens) {
  return { sessionRole: 'host', state: { campaignId: 'w', activeMapId: scene.id, maps: [scene], userRole: 'keeper', tokens, logs: [], fear: 0, clocks: [] },
    getActiveMap() { return this.state.maps.find(m => m.id === this.state.activeMapId); }, update(patch) { Object.assign(this.state, patch); },
    updateToken(id, patch) { this.state.tokens = this.state.tokens.map(t => t.id === id ? combatTransition(t, { ...t, ...patch }, this.getActiveMap()) : t); },
    addLog(log) { this.state.logs.unshift(log); }, addFear(n) { this.state.fear = Math.min(12, this.state.fear + n); } };
}
const gun = (id, tags) => ({ inventory: { weapons: [{ id, name: id, damage: '1d8+1', trait: 'Agility', range: 'Close', tags }], items: [], credits: 0 } });
const attack = (s, weaponId, options = {}) => performGameAction({ type: 'CHECK', actorId: 'pc', attack: true, targetId: 'foe', weaponId, options: { traitId: 'agility', dc: 5, forcedHope: 9, forcedFear: 3, forcedAdv: 4, ...options } }, s);

test('an attack with the weapon: Heavy, High-Recoil, Unstable, Scatter and Disruptor at the table', () => {
  const foe = { ...pc('foe'), isPlayer: false, actorType: 'adversary', name: 'Combat Synth', x: 128 };
  const s = table({ ...pc('pc'), ...gun('heavy-rail', ['heavy', 'high-recoil']) }, foe);
  const heavy = attack(s, 'heavy-rail');
  assert.equal(heavy.disadvVal, 4, 'Heavy with Strength 0: the Disadvantage die is rolled');
  assert.equal(s.state.tokens.find(t => t.id === 'pc').stress.current, 1, 'High-Recoil marks 1 Stress');
  assert.match(s.state.logs[0].details, /Heavy.*High-Recoil/);
  const u = table({ ...pc('pc', { traits: { agility: 1, strength: 2 } }), ...gun('phase', ['unstable']) }, foe);
  attack(u, 'phase', { forcedHope: 2, forcedFear: 9, dc: 30 });
  assert.equal(u.state.tokens.find(t => t.id === 'pc').stress.current, 1, 'Unstable on a Failure with Fear');
  const sc = table({ ...pc('pc', { traits: { agility: 1, strength: 2 } }), ...gun('shotgun', ['scatter', 'disruptor']) }, foe);
  const hit = attack(sc, 'shotgun');
  assert.deepEqual(hit.damageRiders.map(r => r.id), ['scatter', 'disruptor'], 'Very Close: Scatter +2; the target is a Synthetic: Disruptor +1d8');
});

// v2.45.0 (fase 4, second part): what the weapon does after the hit.
test('after the hit: an NPC rolls its Reaction Rolls and a failure applies the condition; effects need no roll', async () => {
  const { weaponOutcomes } = await import('../src/weaponFeatures.js');
  const { resolveWeaponAftermath } = await import('../src/weaponAftermath.js');
  const { nextSpotlightRound, checkEdge } = await import('../src/combatState.js');
  const { visibleConditions } = await import('../src/conditions.js');
  // Triggers as printed: Stunning needs HP loss; Knockdown uses DC 10 at TT1-2; Lethal Toxin spares Synthetics.
  assert.deepEqual(weaponOutcomes({ tier: 'TT1', tags: ['stunning'] }, { hit: true, hpLost: 0 }), []);
  assert.equal(weaponOutcomes({ tier: 'TT1', tags: ['stunning'] }, { hit: true, hpLost: 1 })[0].dc, 10);
  assert.equal(weaponOutcomes({ tier: 'TT3', tags: ['knockdown'] }, { hit: true })[0].dc, 15);
  assert.deepEqual(weaponOutcomes({ tags: ['lethal-toxin'] }, { hit: true, hpLost: 2, organic: false }), []);
  assert.equal(weaponOutcomes({ tags: ['mind-lock'] }, { hit: true, hpLost: 1, stressLost: 0 }).length, 0, 'Mind-Lock needs Stress');

  const baton = { id: 'baton', name: 'Shock Baton', tier: 'Common (TT1)', damage: 'd6+1', range: 'Melee', tags: ['stunning', 'knockdown', 'stagger'] };
  const s = table({ ...pc('pc'), inventory: { weapons: [baton], items: [], credits: 0 } }, { ...pc('foe'), isPlayer: false, actorType: 'adversary', name: 'Pirata', attackModifier: 1, x: 128 });
  // d20 3 + 1 = 4 vs DC 10: fails Stunning; 15 + 1 resists Knockdown.
  const faces = [[3], [15]];
  const lines = await resolveWeaponAftermath(s, { attackerId: 'pc', targetId: 'foe', weaponId: 'baton', hpLost: 1, critical: false }, { throwDice: async () => faces.shift() });
  const foe = s.state.tokens.find(t => t.id === 'foe');
  assert.ok(visibleConditions(foe).includes('Stunned'), 'Stunned by the failed Strength roll');
  assert.equal(foe.conditions.includes('Prone'), false, 'Knockdown resisted');
  assert.ok(foe.effectClocks.some(c => c.nextAction && c.edge === 'disadvantage'), 'Stagger: Disadvantage on its next action');
  assert.equal(checkEdge(foe, null).disadvantage, true);
  assert.match(lines.join(' '), /Stunning: Strength d20 \[3\] \+ 1 = 4 vs CD 10 → falla/);
  assert.match(s.state.logs[0].details, /Knockdown: .* → resiste/);
  // Stunned lasts until after the next round: two round changes.
  nextSpotlightRound(s);
  assert.ok(visibleConditions(s.state.tokens.find(t => t.id === 'foe')).includes('Stunned'), 'still Stunned during the next round');
  nextSpotlightRound(s);
  assert.equal(visibleConditions(s.state.tokens.find(t => t.id === 'foe')).includes('Stunned'), false, 'cleared after the next round');

  // A character rolls its own Reaction Rolls: the log says which; effects still apply.
  const k = table({ ...pc('pc'), inventory: { weapons: [baton], items: [], credits: 0 } }, { ...pc('ally'), x: 128 });
  const said = await resolveWeaponAftermath(k, { attackerId: 'pc', targetId: 'ally', weaponId: 'baton', hpLost: 1 }, { throwDice: async () => { throw new Error('no roll for a character'); } });
  assert.match(said.join(' '), /ally tira Strength contra CD 10; si falla, Stunned/);
  assert.equal(visibleConditions(k.state.tokens.find(t => t.id === 'ally')).includes('Stunned'), false);
  assert.ok(k.state.tokens.find(t => t.id === 'ally').effectClocks.some(c => c.nextAction));
});

test('Continuous marks Stress at the next Spotlight; Stagger is spent by the next roll; Brittle adds 1d6 to the next Physical hit', async () => {
  const { resolveWeaponAftermath } = await import('../src/weaponAftermath.js');
  const gun = { id: 'g', name: 'Rail', damage: '1d8', range: 'Close', tags: ['continuous', 'brittle'] };
  const foe = { ...pc('foe'), isPlayer: false, actorType: 'adversary', x: 128, evasion: 5, stress: { current: 0, max: 4 } };
  const s = table({ ...pc('pc', { traits: { agility: 1, strength: 2 } }), inventory: { weapons: [gun], items: [], credits: 0 } }, foe);
  await resolveWeaponAftermath(s, { attackerId: 'pc', targetId: 'foe', weaponId: 'g', hpLost: 2 });
  let f = s.state.tokens.find(t => t.id === 'foe');
  assert.deepEqual(f.effectClocks.map(c => c.name).sort(), ['Brittle · +1d6 Physical', 'Continuous · +1 Stress']);
  s.updateToken('foe', { hasSpotlight: true });
  f = s.state.tokens.find(t => t.id === 'foe');
  assert.equal(f.stress.current, 1, 'Continuous: 1 Stress at the start of its Spotlight');
  assert.equal(f.effectClocks.some(c => c.name.startsWith('Continuous')), false, 'and it ends');
  // The next Physical hit with Brittle on the target: +1d6, and Brittle ends.
  s.updateToken('foe', { hasSpotlight: false });
  const hit = attack(s, 'g');
  assert.ok(hit.damageRiders.some(r => r.id === 'brittle' && r.dice === '1d6'));
  assert.equal(s.state.tokens.find(t => t.id === 'foe').effectClocks.some(c => c.brittle), false);
  // Stagger on a character: its next roll of any kind has Disadvantage and spends it.
  const stag = table({ ...pc('pc', { effectClocks: [{ id: 'st', name: 'Stagger · próxima acción', segments: 1, filled: 0, tick: 'manual', edge: 'disadvantage', nextAction: true }] }) });
  const roll = performGameAction({ type: 'CHECK', actorId: 'pc', options: { traitId: 'agility', dc: 10, forcedHope: 9, forcedFear: 3, forcedAdv: 2 } }, stag);
  assert.equal(roll.disadvVal, 2);
  assert.equal(stag.state.tokens[0].effectClocks.length, 0);
});

test('Paired, Non-Lethal, Reload and Charge-Up at the table', async () => {
  const { weaponDamageRiders, weaponReadiness, afterShot, nonLethalHp, weaponOutcomes } = await import('../src/weaponFeatures.js');
  const { validateInventory } = await import('../src/equipment.js');
  // Paired: two Paired weapons in hand add the larger bonus; one alone adds nothing.
  const left = { id: 'l', tags: ['paired:1'] }, right = { id: 'r', tags: ['paired:2'] };
  assert.deepEqual(weaponDamageRiders(left, { held: [left, right] }).map(r => [r.id, r.value]), [['paired', 2]]);
  assert.deepEqual(weaponDamageRiders(left, { held: [left] }), []);
  assert.deepEqual(weaponDamageRiders(left, { held: [left, { ...right, equipped: false }] }), [], 'holstered');
  // Non-Lethal: never below 1 HP; at 1 HP the target is Incapacitated.
  assert.equal(nonLethalHp({ tags: ['non-lethal'] }, 3, 0), 1);
  assert.equal(nonLethalHp({ tags: [] }, 3, 0), 0);
  assert.deepEqual(weaponOutcomes({ tags: ['non-lethal'] }, { hit: true, hpLost: 2, hpAfter: 1 })[0].apply, { conditions: ['Incapacitated'] });
  // Reload: each shot spends it; Charge-Up fires only charged.
  assert.equal(weaponReadiness({ tags: ['reload'] }).ready, true);
  assert.deepEqual(afterShot({ tags: ['reload'] }), { tags: ['reload'], spent: true });
  assert.equal(weaponReadiness({ name: 'Rifle', tags: ['reload'], spent: true }).action, 'Recargar');
  assert.equal(weaponReadiness({ name: 'Railgun', tags: ['charge-up'] }).action, 'Cargar');
  assert.ok(validateInventory({ weapons: [{ id: 'a', name: 'A', damage: 'd8', damageMode: 'base', trait: '', range: '', features: '', tier: '', spent: true, charged: false }], items: [] }));

  const s = table({ ...pc('pc', { traits: { agility: 1, strength: 2 } }), ...gun('rail', ['charge-up', 'reload']) }, { ...pc('foe'), isPlayer: false, actorType: 'adversary', x: 128 });
  assert.throws(() => attack(s, 'rail'), /no está cargada/);
  performGameAction({ type: 'WEAPON_READY', actorId: 'pc', weaponId: 'rail' }, s);
  let w = s.state.tokens.find(t => t.id === 'pc').inventory.weapons[0];
  assert.equal(w.charged, true);
  attack(s, 'rail');
  w = s.state.tokens.find(t => t.id === 'pc').inventory.weapons[0];
  assert.deepEqual([w.charged, w.spent], [false, true], 'the shot uses the charge and spends the weapon');
  assert.throws(() => attack(s, 'rail'), /descargada/);
  performGameAction({ type: 'WEAPON_READY', actorId: 'pc', weaponId: 'rail' }, s);
  assert.equal(s.state.tokens.find(t => t.id === 'pc').inventory.weapons[0].spent, false, 'reloaded');
  // The charge is lost when the wielder moves.
  performGameAction({ type: 'WEAPON_READY', actorId: 'pc', weaponId: 'rail' }, s);
  assert.equal(s.state.tokens.find(t => t.id === 'pc').inventory.weapons[0].charged, true);
  s.updateToken('pc', { x: 64 + 64 });
  assert.equal(s.state.tokens.find(t => t.id === 'pc').inventory.weapons[0].charged, false);
});
