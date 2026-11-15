import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATOR_DATA as data } from '../src/creator/creatorData.js';
import { freshState, setChoice, isStepReady, firstIncompleteStep, characterDomains, levelOnePowers, powerId, equipmentChoices, equipmentEligibility, spend, buildSheetDocument, subclassList, classRules, CREATOR_STEPS, TRAIT_ARRAY, EQUIP_BUDGET } from '../src/creator/creatorModel.js';
import { parseCharacterJSON, characterDetails } from '../src/characterImport.js';
import { tokenInventory } from '../src/equipment.js';
import { weaponRangeBand } from '../src/attackFlow.js';

const pick = (state, key, value) => setChoice(state, key, value);
function scholar() {
  let s = freshState();
  s = pick(s, 'ancestry', 'synthetic'); s = pick(s, 'community', data.communities[0].id);
  s = pick(s, 'path', 'Awakened'); s = pick(s, 'cls', 'scholar'); s = pick(s, 'subclass', subclassList(s, data)[0].name);
  s.traits = { agility: 0, strength: -1, finesse: 1, instinct: 1, presence: 0, knowledge: 2 };
  s.experiences = ['Pattern hunter', 'Dock rat', 'Archive diver'];
  s = pick(s, 'affiliation', data.affiliations[0].id);
  const [a, b] = characterDomains(s, data);
  s.powers = [powerId(levelOnePowers(data, a)[0]), powerId(levelOnePowers(data, b)[0])];
  s.weapons = [equipmentChoices(s, data, 'weapon')[0].name]; s.armors = [equipmentChoices(s, data, 'armor')[0].name];
  s.name = 'Maren Solas'; s.bgAnswer = 'The map my mother left.';
  return s;
}

test('the creator data is the complete rules set: 9 ancestries, 7 communities, 9 classes with 3 subclasses per Path', () => {
  assert.deepEqual([data.ancestries.length, data.communities.length, data.classes.length, data.affiliations.length], [9, 7, 9, 13]);
  for (const cls of data.classes) { assert.equal(cls.awakenedSubclasses.length, 3, cls.id); assert.equal(cls.sleepingSubclasses.length, 3, cls.id); assert.ok(cls.sleepingRules.effortFeature, cls.id); }
  assert.equal(data.powers.filter(p => p.l === 1).length, 21, 'three Level 1 Powers in each of the seven Domains');
  assert.deepEqual(CREATOR_STEPS.map(s => s.id), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([...TRAIT_ARRAY].sort((a, b) => a - b), [-1, 0, 0, 1, 1, 2]);
});

test('each step is ready only when its choice is complete, and later choices reset when an earlier one changes', () => {
  let s = freshState();
  assert.equal(firstIncompleteStep(s, data), 1);
  s = pick(s, 'ancestry', 'ailuran');
  assert.equal(isStepReady(s, 1, data), false, 'Ailurans choose a strain');
  s.subStrain = data.ancestries.find(a => a.id === 'ailuran').subStrains[0].id;
  assert.equal(isStepReady(s, 1, data), true);
  s = pick(s, 'ancestry', 'human'); assert.equal(s.subStrain, null); assert.equal(isStepReady(s, 1, data), true);
  s = pick(s, 'path', 'Awakened'); s = pick(s, 'cls', 'soldier');
  assert.equal(isStepReady(s, 3, data), false);
  s = pick(s, 'subclass', 'Guardian'); assert.equal(isStepReady(s, 3, data), true);
  s.traits = { agility: 2, strength: 2, finesse: 1, instinct: 0, presence: 0, knowledge: -1 };
  assert.equal(isStepReady(s, 4, data), false, 'the array must be used exactly once');
  s.traits.strength = 1; assert.equal(isStepReady(s, 4, data), true);
  s.experiences = ['A', 'B', ' ']; assert.equal(isStepReady(s, 5, data), false);
  s.powers = ['x']; s.weapons = ['y'];
  s = pick(s, 'cls', 'pilot');
  assert.deepEqual([s.subclass, s.powers, s.weapons], [null, [], []]);
});

test('Domains: class pair, Mystic by Veil Alignment, Vanguard by subclass; an Awakened character starts with two Level 1 Powers from them', () => {
  let s = pick(pick(freshState(), 'path', 'Awakened'), 'cls', 'pilot');
  assert.deepEqual(characterDomains(s, data), ['Void', 'Tech']);
  s = pick(s, 'cls', 'mystic'); assert.deepEqual(characterDomains(s, data), ['Neural']);
  s = pick(s, 'veilAlignment', 'Lux'); assert.deepEqual(characterDomains(s, data), ['Neural', 'Lux']);
  s = pick(pick(s, 'cls', 'vanguard'), 'subclass', 'Kinetic Echo'); assert.deepEqual(characterDomains(s, data), ['Neural', 'Kinetic']);
  s.powers = [powerId(levelOnePowers(data, 'Neural')[0])]; assert.equal(isStepReady(s, 7, data), false);
  s.powers.push(powerId(levelOnePowers(data, 'Tech')[0])); assert.equal(isStepReady(s, 7, data), false, 'a Power from another Domain');
  s.powers[1] = powerId(levelOnePowers(data, 'Kinetic')[0]); assert.equal(isStepReady(s, 7, data), true);
  // Sleeping characters have no Loadout; a Sleeping Mystic studies two Domains instead.
  let sleeper = pick(pick(freshState(), 'path', 'Sleeping'), 'cls', 'soldier');
  assert.equal(isStepReady(sleeper, 7, data), true);
  sleeper = pick(sleeper, 'cls', 'mystic'); assert.equal(isStepReady(sleeper, 7, data), false);
  sleeper.sleepingMysticDomains = ['Void', 'Tech']; assert.equal(isStepReady(sleeper, 7, data), true);
});

test('starting equipment respects the class Technology Access and the 4-credit budget on each side', () => {
  const scholarState = pick(pick(freshState(), 'path', 'Awakened'), 'cls', 'scholar'), cls = data.classes.find(c => c.id === 'scholar');
  const weapons = equipmentChoices(scholarState, data, 'weapon');
  assert.ok(weapons.length > 0 && weapons.every(w => w.category === 'Pistols' && w.pack === 'core' && w.cost <= EQUIP_BUDGET));
  assert.match(equipmentEligibility(data.weapons.find(w => w.category === 'Rifles'), 'weapon', cls).reason, /entrenamiento/);
  assert.equal(equipmentChoices(pick(scholarState, 'cls', 'soldier'), data, 'weapon').some(w => w.category === 'Heavy Weapons'), true);
  assert.ok(equipmentChoices({ ...scholarState, includeRustAndSteel: true }, data, 'weapon').length > weapons.length);
  const s = scholar(); s.weapons = data.weapons.filter(w => w.cost === 4).slice(0, 2).map(w => w.name);
  assert.equal(spend(s.weapons, data.weapons), 8); assert.equal(isStepReady(s, 8, data), false);
});

test('a finished character becomes a sheet the VTT imports: resources, thresholds, Traits, weapons with range, Powers and links', () => {
  const s = scholar(), doc = buildSheetDocument(s, data, { characterId: 'vtt-1', now: new Date('2026-11-15T00:00:00Z') });
  assert.equal(doc.app, 'Veilfarers Character Sheet'); assert.equal(doc.fields.class, 'Scholar');
  const parsed = parseCharacterJSON(doc), token = parsed.token, cls = data.classes.find(c => c.id === 'scholar'), armor = data.armor.find(a => a.name === s.armors[0]);
  assert.deepEqual(parsed.missing, []); assert.deepEqual(parsed.warnings, []);
  assert.deepEqual([token.name, token.path, token.characterClass, token.species, token.level, token.proficiency], ['Maren Solas', 'Awakened', 'Scholar', 'Synthetic', 1, 1]);
  assert.deepEqual([token.hp.max, token.hp.current, token.evasion, token.hope], [cls.hp, cls.hp, cls.evasion, 2]);
  assert.equal(token.stress.max, 7, 'Synthetics have seven Stress slots');
  assert.deepEqual([token.hp.majorThreshold, token.hp.severeThreshold], [armor.thresholds.major + 1, armor.thresholds.severe + 1], 'armor + level');
  assert.equal(token.armor.max, armor.armorSlots);
  assert.equal(token.traits.knowledge, 2); assert.equal(token.traits.strength, -1);
  const weapon = tokenInventory(token).weapons[0], chosen = data.weapons.find(w => w.name === s.weapons[0]);
  assert.equal(weapon.name, chosen.name); assert.equal(weaponRangeBand(weapon), weaponRangeBand(chosen), 'the range travels with the weapon');
  const details = characterDetails(token);
  assert.deepEqual(details.experiences.map(x => x.bonus), ['+2', '+2', '+2']);
  assert.equal(details.powers.length, 2); assert.equal(details.loadoutCap, '5');
  assert.equal(details.affiliations[0].name, data.affiliations[0].name);
  assert.equal(details.seeds[0][1], 'The map my mother left.');
  assert.ok(details.features.some(([, text]) => text.includes(cls.classFeature.name)));
});

test('a Sleeping character gets Effort, Resolve and the Sleeping class rules; no armor means natural thresholds', () => {
  let s = scholar(); s = pick(s, 'path', 'Sleeping'); s = pick(s, 'subclass', subclassList(s, data)[0].name); s.anchor = 'My field notes';
  const token = parseCharacterJSON(buildSheetDocument(s, data)).token, rules = classRules(s, data);
  assert.deepEqual([token.path, token.effort, token.resolve.max, token.resolve.current, token.recoveryAnchor], ['Sleeping', 2, 2, 2, 'My field notes']);
  assert.equal(token.hp.max, rules.hp);
  assert.equal(characterDetails(token).powers.length, 0);
  assert.throws(() => buildSheetDocument({ ...s, name: '' }, data), /paso 9/);
  assert.throws(() => buildSheetDocument(freshState(), data), /paso 1: Ancestry/);
});

test('the wizard walks the nine steps, keeps a draft and puts the finished character on the table as a token', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
  for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[key] = dom.window[key];
  const { store } = await import('../src/state.js'); await store.ready;
  const { openCharacterCreator } = await import('../src/creator/creatorUI.js');
  try {
    store.state.userRole = 'keeper'; store.sessionRole = 'local';
    localStorage.setItem('veil_creator_draft', JSON.stringify({ ...scholar(), name: '' }));
    const before = store.state.tokens.length;
    const modal = await openCharacterCreator();
    const click = selector => modal.querySelector(selector).click();
    assert.equal(modal.querySelectorAll('.creator-step').length, 9);
    assert.equal(modal.querySelector('.creator-step.active').dataset.step, '9', 'opens on the first unfinished step of the draft');
    assert.equal(modal.querySelectorAll('.creator-step.ready').length, 8);
    click('[data-finish="token"]');
    assert.match(modal.querySelector('.dossier-error').textContent, /paso 9/, 'a name is required');
    const name = modal.querySelector('[data-field="name"]'); name.value = 'Maren Solas'; name.dispatchEvent(new Event('input', { bubbles: true }));
    assert.equal(JSON.parse(localStorage.getItem('veil_creator_draft')).name, 'Maren Solas', 'the draft follows every change');
    // Going back and changing the class clears the choices that depended on it.
    click('.creator-step[data-step="3"]'); click('[data-set="cls"][data-value="pilot"]');
    assert.equal(modal.querySelectorAll('.creator-step.ready').length < 9, true);
    click('[data-act="next"]');
    assert.match(modal.querySelector('.dossier-error').textContent, /Completa/);
    click('[data-set="subclass"]');
    click('.creator-step[data-step="7"]'); modal.querySelectorAll('[data-power]')[0].click(); modal.querySelectorAll('[data-power]')[3].click();
    assert.equal(modal.querySelectorAll('[data-power].selected').length, 2);
    modal.querySelectorAll('[data-power]')[1].click();
    assert.match(modal.querySelector('.dossier-error').textContent, /Solo 2 Poderes/);
    click('.creator-step[data-step="8"]'); click('[data-weapon]'); click('[data-armor]');
    click('.creator-step[data-step="9"]');
    click('[data-finish="token"]');
    assert.equal(document.querySelector('.creator-dialog'), null);
    assert.equal(store.state.tokens.length, before + 1);
    const created = store.state.tokens.at(-1);
    assert.deepEqual([created.name, created.characterClass, created.path, created.actorType], ['Maren Solas', 'Pilot', 'Awakened', 'player']);
    assert.ok(created.sourceCharacter.document.fields.wpri_name);
    assert.equal(localStorage.getItem('veil_creator_draft'), null, 'the draft is cleared once the character exists');
    // A second character can replace the sheet of an existing token without moving it.
    localStorage.setItem('veil_creator_draft', JSON.stringify({ ...scholar(), name: 'Vell' }));
    const again = await openCharacterCreator();
    again.querySelector('[data-target]').value = created.id;
    again.querySelector('[data-finish="replace"]').click();
    const replaced = store.state.tokens.find(t => t.id === created.id);
    assert.deepEqual([replaced.name, replaced.characterClass, replaced.x, replaced.y], ['Vell', 'Scholar', created.x, created.y]);
    assert.equal(store.state.tokens.length, before + 1);
  } finally { await store.saveQueue.catch(() => {}); dom.window.close(); }
});
