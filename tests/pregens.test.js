import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATOR_DATA as data } from '../src/creator/creatorData.js';
import { PREGENS, pregenSheet, pregenState } from '../src/pregens.js';
import { firstIncompleteStep } from '../src/creator/creatorModel.js';
import { parseCharacterJSON } from '../src/characterImport.js';
import { armorEvasionMod } from '../src/armorEvasion.js';
import { installGear, wearArmor } from '../src/gear.js';
import { EQUIPMENT_CATALOG } from '../src/equipmentLibrary.js';

// Hearts in the Void, ch. 16: HP / Stress / Evasion of each Active Sheet.
const BOOK = { spark: [7, 6, 9], wall: [7, 6, 8], whisper: [6, 6, 10], lyra: [5, 6, 10], flash: [6, 6, 11], shadow: [6, 7, 13], kel: [6, 6, 11], senna: [6, 6, 10], rourke: [6, 6, 13], threnody: [6, 6, 10] };

test('the ten pregens of Hearts in the Void are built by the creator and match their printed sheets', () => {
  assert.equal(PREGENS.length, 10);
  for (const pregen of PREGENS) {
    assert.equal(firstIncompleteStep(pregenState(pregen), data), 0, pregen.id + ' complete');
    const { token } = parseCharacterJSON(pregenSheet(pregen, data));
    assert.deepEqual([token.hp.max, token.stress.max, token.evasion], BOOK[pregen.id], pregen.id);
    assert.equal(token.path, 'Sleeping');
    assert.deepEqual(Object.values(token.traits).sort((a, b) => a - b), [-1, 0, 0, 1, 1, 2], pregen.id + ' fixed Trait array');
    assert.equal(token.effort, 2); assert.deepEqual([token.resolve.current, token.resolve.max, token.resolve.dieType], [2, 2, 'd4']);
  }
  // The Sleeping Mystics carry their Archive (Studied Domains).
  const whisper = parseCharacterJSON(pregenSheet(PREGENS.find(p => p.id === 'whisper'), data)).token;
  assert.match(JSON.stringify(whisper.sourceCharacter.document.fields), /Studied Domains — Neural \+ Void/);
});

test('armor features move Evasion as the Corebook says, and changing armor moves it by the difference', () => {
  assert.equal(armorEvasionMod('Flexible (+1 Evasión)'), 1);
  assert.equal(armorEvasionMod(['Heavy', 'Jury-rigged']), -1);
  assert.equal(armorEvasionMod('Very Heavy, Powered'), -2);
  assert.equal(armorEvasionMod('Massive'), -2);
  assert.equal(armorEvasionMod('', { characterClass: 'Vanguard' }), 1, 'Unbroken Focus without armor');
  assert.equal(armorEvasionMod('Heavy', { characterClass: 'Vanguard' }), -1, 'no Unbroken Focus in Heavy armor');
  const item = name => EQUIPMENT_CATALOG.find(i => i.category === 'armor' && i.name.startsWith(name));
  let t = { id: 'a', name: 'Ana', level: 1, evasion: 10, traits: { strength: 0, agility: 0, finesse: 0, presence: 0, instinct: 0, knowledge: 0 }, hp: { current: 6, max: 6, majorThreshold: 3, severeThreshold: 5 }, stress: { current: 0, max: 6 }, armor: { current: 0, max: 0 }, inventory: { weapons: [], items: [] } };
  t = { ...t, ...installGear(t, t.inventory, item('Frontier Vest'), 'vest') };
  assert.deepEqual([t.evasion, t.armorEvasion], [11, 1], 'Flexible +1');
  t = { ...t, ...installGear(t, t.inventory, item('Salvage Armor'), 'salvage') };
  assert.deepEqual([t.evasion, t.armorEvasion], [9, -1], 'Heavy −1, the vest no longer counts');
  t = { ...t, ...wearArmor(t, t.inventory, null) };
  assert.deepEqual([t.evasion, t.armorEvasion], [10, 0], 'no armor: back to the base');
});
