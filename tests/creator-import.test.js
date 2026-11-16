import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCharacterJSON, initializeImportedResources, characterDetails, exportSystemCharacter } from '../src/characterImport.js';
import { createActor } from '../src/actors.js';
import { validateActor } from '../src/validation.js';

const readFixture = name => JSON.parse(readFileSync(new URL(`./fixtures/creator/${name}.json`, import.meta.url), 'utf8'));

test('imports characters created with Veilfarers Character Creator v2.74 (Brok, Jaraña, Lucy Fer)', () => {
  const brokDoc = readFixture('Brok');
  assert.equal(brokDoc.app, 'Veilfarers Character Creator');
  const parsedBrok = parseCharacterJSON(brokDoc);
  assert.equal(parsedBrok.token.name, 'Brok');
  assert.equal(parsedBrok.token.path, 'Sleeping');
  assert.equal(parsedBrok.token.characterClass, 'Soldier');
  assert.equal(parsedBrok.token.subclass, 'Peacekeeper');
  assert.equal(parsedBrok.token.species, 'Kryx');
  assert.equal(parsedBrok.token.community, 'Free Fleet');
  assert.equal(parsedBrok.token.hp.max, 7);
  assert.equal(parsedBrok.token.armor.max, 6);
  assert.equal(parsedBrok.token.stress.max, 6);
  assert.equal(parsedBrok.token.evasion, 7);
  assert.equal(parsedBrok.token.hp.majorThreshold, 9);
  assert.equal(parsedBrok.token.hp.severeThreshold, 18);
  assert.equal(parsedBrok.token.traits.strength, 2);
  assert.equal(parsedBrok.token.traits.knowledge, -1);
  assert.equal(parsedBrok.token.resolve.max, 2);

  const actorBrok = createActor(parsedBrok.token, 'map-1');
  assert.ok(actorBrok.id);
  validateActor(actorBrok);

  const jaranaDoc = readFixture('Jarana');
  const parsedJarana = parseCharacterJSON(jaranaDoc);
  assert.equal(parsedJarana.token.name, 'Jaraña');
  assert.equal(parsedJarana.token.path, 'Sleeping');
  assert.equal(parsedJarana.token.characterClass, 'Vanguard');
  assert.equal(parsedJarana.token.subclass, 'Kinetic Echo (+Kinetic)');
  assert.equal(parsedJarana.token.hp.max, 6);
  assert.equal(parsedJarana.token.armor.max, 3);
  assert.equal(parsedJarana.token.evasion, 11);
  assert.equal(parsedJarana.token.hp.majorThreshold, 6);
  assert.equal(parsedJarana.token.hp.severeThreshold, 12);

  const lucyDoc = readFixture('Lucy_Fer');
  const parsedLucy = parseCharacterJSON(lucyDoc);
  assert.equal(parsedLucy.token.name, 'Lucy Fer');
  assert.equal(parsedLucy.token.path, 'Sleeping');
  assert.equal(parsedLucy.token.characterClass, 'Mystic');
  assert.equal(parsedLucy.token.subclass, 'Veil Walker (School of Path)');
  assert.equal(parsedLucy.token.hp.max, 6);
  assert.equal(parsedLucy.token.armor.max, 3);
  assert.equal(parsedLucy.token.traits.knowledge, 2);
});

test('imports characters created with Veilfarers Character Creator v2.41 (Miles)', () => {
  const milesDoc = readFixture('Miles');
  assert.equal(milesDoc.app, 'Veilfarers Character Creator');
  assert.equal(milesDoc.version, '2.41');
  const parsedMiles = parseCharacterJSON(milesDoc);
  assert.equal(parsedMiles.token.name, 'Miles');
  assert.equal(parsedMiles.token.path, 'Sleeping');
  assert.equal(parsedMiles.token.characterClass, 'Diplomat');
  assert.equal(parsedMiles.token.subclass, 'Political Operative');
  assert.equal(parsedMiles.token.hp.max, 6);
  assert.equal(parsedMiles.token.armor.max, 3);
  assert.equal(parsedMiles.token.stress.max, 6);
  assert.equal(parsedMiles.token.evasion, 10);
  assert.equal(parsedMiles.token.hp.majorThreshold, 6);
  assert.equal(parsedMiles.token.hp.severeThreshold, 12);
  assert.equal(parsedMiles.token.traits.presence, 2);

  const details = characterDetails(parsedMiles.token);
  assert.ok(details.weapons.some(w => w.name === 'Flechette Pistol'));
  assert.ok(details.armor.includes("Pilot's Jacket"));
  assert.equal(details.experiences.length, 3);
  assert.equal(details.experiences[0].name, 'Military savvy');

  const actorMiles = createActor(parsedMiles.token, 'map-1');
  assert.ok(actorMiles.id);
  validateActor(actorMiles);
});

test('handles character creator exports with missing or partial tracks', () => {
  const milesDoc = readFixture('Miles');
  const altered = structuredClone(milesDoc);
  delete altered.tracks;
  const parsed = parseCharacterJSON(altered);
  assert.equal(parsed.token.hp.max, 6);
  assert.equal(parsed.token.armor.max, 3);
  assert.equal(parsed.token.stress.max, 6);
  assert.equal(parsed.token.resolve.max, 2);
});

test('exportSystemCharacter and re-import preserves character creator data', () => {
  const jaranaDoc = readFixture('Jarana');
  const parsed = parseCharacterJSON(jaranaDoc);
  const token = initializeImportedResources(parsed, { hp: 6, armor_slots: 3, stress: 0, s_resolve: 2, s_effort: 2 });
  const exported = exportSystemCharacter(token);
  assert.equal(exported.app, 'Veilfarers Character Creator');
  assert.equal(exported.fields.name, 'Jaraña');
  assert.equal(exported.fields.chosen_path, 'Sleeping');
  const reimported = parseCharacterJSON(exported);
  assert.equal(reimported.token.name, 'Jaraña');
  assert.equal(reimported.token.hp.max, 6);
});
