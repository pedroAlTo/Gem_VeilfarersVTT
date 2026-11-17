import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATOR_DATA as data } from '../src/creator/creatorData.js';
import { tierRank, characterAccess, competence, gearProfile, gearOutsideCompetence, droneCompetence, failureWithFearAdvice } from '../src/techAccess.js';
import { learnPower, powersInReach } from '../src/loadoutCards.js';

const pc = (characterClass, level = 1, extra = {}) => ({ isPlayer: true, characterClass, level, path: 'Awakened', ...extra });

test('tech tiers are read from any of the catalog spellings', () => {
  assert.deepEqual(['Common (TT1)', 'Military (TT2)', 'Experimental (TT3)', 'Tier 2 · Lithian', 'Military', 'Precursor'].map(tierRank), [1, 2, 3, 2, 2, 4]);
});

test('a class reaches Military at level 2 and Experimental at level 5; the sheet can raise it', () => {
  assert.equal(characterAccess(pc('Diplomat', 1), data).rank, 1);
  assert.equal(characterAccess(pc('Diplomat', 2), data).rank, 2);
  assert.equal(characterAccess(pc('Diplomat', 5), data).rank, 3);
  assert.equal(characterAccess(pc('Diplomat', 1, { sheetFields: { tech_access: '2' } }), data).rank, 2);
  assert.equal(characterAccess({ isPlayer: false, characterClass: 'Soldier' }, data), null, 'adversaries are not restricted');
  assert.equal(characterAccess(pc('Clase inventada'), data), null);
});

test('competence follows the class table: weapon family, armor weight, augment type and tier', () => {
  const diplomat = pc('Diplomat', 1), soldier = pc('Soldier', 1);
  assert.equal(competence({ name: 'Pistola Cinética Militar (Slug Pistol)' }, diplomat, data).ok, true);
  assert.match(competence({ name: 'Rifle de Asalto Automático' }, diplomat, data).reason, /no está entrenado en Rifles/);
  assert.equal(competence({ name: 'Rifle de Asalto Automático' }, soldier, data).ok, true, 'a Soldier trains every weapon');
  assert.match(competence({ name: 'Pistola de Combate Rápida' }, diplomat, data).reason, /Military \(TT2\)/);
  assert.equal(competence({ name: 'Pistola de Combate Rápida' }, pc('Diplomat', 2), data).ok, true);
  assert.match(competence({ name: 'Salvage Armor / Armadura de Chatarrero' }, diplomat, data).reason, /armadura Heavy/);
  assert.equal(competence({ name: 'Frontier Vest' }, diplomat, data).ok, true, 'either name of a catalog entry works');
  assert.match(competence({ name: 'Camuflaje Subdérmico Cromático' }, diplomat, data).reason, /aumentos Stealth/);
  assert.equal(gearProfile({ name: 'Arma inventada', damage: '1d6', range: 'Melee' }).family, 'Melee', 'unknown weapons are read from their words');
});

test('the gear a character carries outside its competence is listed with the reason', () => {
  const diplomat = pc('Diplomat', 1);
  const out = gearOutsideCompetence(diplomat, { weapons: [{ name: 'Rifle de Asalto Automático' }], items: [{ name: 'Riot Armor / Armadura Antidisturbios' }, { name: 'Omnitool Táctico Multifunción' }] }, data);
  assert.deepEqual(out.map(o => [o.name, o.kind]), [['Rifle de Asalto Automático', 'weapon'], ['Riot Armor / Armadura Antidisturbios', 'armor']]);
});

test('a drone above its operator’s access is outside competence', () => {
  const drone = { drone: { grade: 'military' } }, operator = pc('Diplomat', 1);
  assert.equal(droneCompetence(drone, operator, data).ok, false);
  assert.equal(droneCompetence(drone, pc('Diplomat', 2), data).ok, true);
  assert.equal(droneCompetence({ drone: { grade: 'common' } }, operator, data).ok, true);
});

test('Failure with Fear advice speaks of the gear involved', () => {
  assert.match(failureWithFearAdvice('weapon', 'Pistola'), /encasquilla/);
  assert.match(failureWithFearAdvice('armor', 'Salvage', 'Heavy, Jury-rigged'), /Armor Slot/);
  assert.match(failureWithFearAdvice('drone', 'Mote'), /Drone Complication/);
});

test('a Power within reach can be added to the Vault; others cannot', () => {
  const mystic = pc('Mystic', 1, { sheetFields: { a_domain_ref: 'Lux & Neural' } });
  const reach = powersInReach(mystic, data);
  assert.ok(reach.length && reach.every(p => ['Lux', 'Neural'].includes(p.d) && p.l === 1));
  const result = learnPower(mystic, data, reach[0].n);
  assert.match(result.token.sheetFields.a_vault, new RegExp(reach[0].n));
  assert.throws(() => learnPower(result.token, data, reach[0].n), /no está a tu alcance/, 'not twice');
  const far = data.powers.find(p => p.d === 'Kinetic');
  assert.throws(() => learnPower(mystic, data, far.n), /no está a tu alcance/);
  const high = data.powers.find(p => p.d === 'Lux' && p.l > 1);
  assert.throws(() => learnPower(mystic, data, high.n), /no está a tu alcance/);
  assert.throws(() => learnPower({ ...mystic, path: 'Sleeping' }, data, reach[0].n), /Sleeping/);
});
