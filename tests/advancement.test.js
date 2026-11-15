import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CREATOR_DATA as data } from '../src/creator/creatorData.js';
import { availablePowers, multiclassChoices, nextSubclassFeature, powerDomains, applyLevelUp, experienceSlots, levelGrants, optionBlocked, tierOf, isTierAchievement, ADVANCEMENT_OPTIONS } from '../src/advancement.js';

const pc = (extra = {}) => ({
  name: 'Maren', isPlayer: true, actorType: 'player', path: 'Awakened', level: 1, proficiency: 1, evasion: 10, x: 0, y: 0,
  hp: { current: 5, max: 6, majorThreshold: 6, severeThreshold: 12 }, stress: { current: 0, max: 6 }, armor: { current: 3, max: 3 },
  traits: { agility: 0, strength: -1, finesse: 1, knowledge: 2, instinct: 1, presence: 0 },
  sheetFields: { a_exp_0: 'Pattern hunter', a_exp_0_bonus: '+2', a_exp_1: 'Dock rat', a_exp_1_bonus: '+2', s_exp_0: 'Other path', s_exp_0_bonus: '+2' },
  ...extra,
});

test('tiers and Tier Achievement levels follow the Corebook', () => {
  assert.deepEqual([1, 4, 5, 7, 8, 10].map(tierOf), [1, 1, 2, 2, 3, 3]);
  assert.deepEqual([1, 2, 3, 5, 8, 9].map(isTierAchievement), [false, true, false, true, true, false]);
  assert.equal(ADVANCEMENT_OPTIONS.length, 11);
  assert.deepEqual(experienceSlots(pc()).map(x => [x.name, x.bonus]), [['Pattern hunter', 2], ['Dock rat', 2]]);
});

test('level 2 is a Tier Achievement: +1 Proficiency, +1 to two Experiences, thresholds follow the level, plus two Slots', () => {
  const before = pc();
  assert.ok(levelGrants(before).some(g => /Proficiency/.test(g)));
  const { token, summary } = applyLevelUp(before, { picks: [{ id: 'hp' }, { id: 'evasion' }], achievementExperiences: ['a_exp_0', 'a_exp_1'] });
  assert.equal(token.level, 2); assert.equal(token.proficiency, 2);
  assert.deepEqual([token.hp.max, token.hp.current, token.hp.majorThreshold, token.hp.severeThreshold], [7, 6, 7, 13]);
  assert.equal(token.evasion, 11);
  assert.deepEqual(experienceSlots(token).map(x => x.bonus), [3, 3]);
  assert.equal(token.advancement.log[0].level, 2); assert.ok(summary.length >= 4);
  assert.equal(before.level, 1, 'the original is untouched');
});

test('both Slots must be spent, on different options, unless leaving one is confirmed', () => {
  const at2 = pc({ level: 2 });
  assert.throws(() => applyLevelUp(at2, { picks: [{ id: 'hp' }] }), /sin gastar/);
  assert.throws(() => applyLevelUp(at2, { picks: [{ id: 'hp' }, { id: 'hp' }] }), /distintas/);
  assert.throws(() => applyLevelUp(at2, { picks: [{ id: 'hp' }, { id: 'proficiency' }] }), /dos Advancement Slots/);
  const lost = applyLevelUp(at2, { picks: [{ id: 'stress' }], allowUnspent: true });
  assert.equal(lost.token.stress.max, 7); assert.match(lost.summary.join(' '), /sin gastar/);
  assert.equal(applyLevelUp(at2, { picks: [{ id: 'proficiency' }] }).token.proficiency, 2, 'a two-Slot option spends the level');
});

test('a Trait rises once per Tier; the limit resets at the next Tier', () => {
  let token = applyLevelUp(pc({ level: 2 }), { picks: [{ id: 'trait', trait: 'knowledge' }, { id: 'hp' }] }).token;
  assert.equal(token.traits.knowledge, 3);
  assert.throws(() => applyLevelUp(token, { picks: [{ id: 'trait', trait: 'knowledge' }, { id: 'hp' }] }), /ya subió en este Tier/);
  token = applyLevelUp(token, { picks: [{ id: 'trait', trait: 'finesse' }, { id: 'hp' }] }).token; // level 4
  token = applyLevelUp(token, { picks: [{ id: 'trait', trait: 'knowledge' }, { id: 'hp' }], achievementExperiences: ['a_exp_0', 'a_exp_1'] }).token; // level 5, Tier 2
  assert.equal(token.level, 5); assert.equal(token.traits.knowledge, 4);
  assert.throws(() => applyLevelUp(pc({ level: 2 }), { picks: [{ id: 'trait' }, { id: 'hp' }] }), /Elige el Trait/);
});

test('gated options: Multiclass and Subclass need Tier 2, Tempered Resolve needs a Tier 3 Sleeping character, Proficiency stops at 6', () => {
  assert.match(optionBlocked(pc({ level: 2 }), 'multiclass'), /Tier 2/);
  assert.match(optionBlocked(pc({ level: 2 }), 'subclass'), /Tier 2/);
  assert.equal(optionBlocked(pc({ level: 4 }), 'multiclass'), '');
  const multi = applyLevelUp(pc({ level: 4 }), { picks: [{ id: 'multiclass', note: 'Engineer' }], achievementExperiences: ['a_exp_0', 'a_exp_1'] }).token;
  assert.equal(multi.advancement.multiclass, true); assert.match(optionBlocked(multi, 'multiclass'), /una vez/);
  let sub = applyLevelUp(pc({ level: 5 }), { picks: [{ id: 'subclass' }] }).token;
  assert.match(sub.advancement.log.at(-1).summary.join(' '), /Specialization/);
  assert.match(optionBlocked(sub, 'subclass'), /Mastery requiere Tier 3/);
  sub = applyLevelUp({ ...sub, level: 7 }, { picks: [{ id: 'subclass' }], achievementExperiences: ['a_exp_0', 'a_exp_1'] }).token;
  assert.match(sub.advancement.log.at(-1).summary.join(' '), /Mastery/);
  assert.match(optionBlocked(pc({ level: 8 }), 'tempered'), /Sleeping/);
  assert.match(optionBlocked(pc({ level: 3, proficiency: 6 }), 'proficiency'), /máximo/);
  assert.match(optionBlocked(pc({ sheetFields: {} }), 'experiences'), /no tiene Experiencias/);
  assert.throws(() => applyLevelUp(pc({ level: 10 }), { picks: [{ id: 'hp' }, { id: 'stress' }] }), /nivel máximo/);
  assert.throws(() => applyLevelUp({ ...pc(), isPlayer: false, actorType: 'adversary' }, { picks: [] }), /jugadores/);
});

test('a Sleeping character gains Resolve at levels 3, 5, 7 and 9, can buy more, and tempers it to d6 at Tier 3', () => {
  const sleeper = extra => pc({ path: 'Sleeping', resolve: { current: 2, max: 2, dieType: 'd4' }, ...extra });
  let token = applyLevelUp(sleeper({ level: 2 }), { picks: [{ id: 'hp' }, { id: 'stress' }] }).token;
  assert.equal(token.resolve.max, 3, 'level 3');
  token = applyLevelUp(token, { picks: [{ id: 'power', resolve: 'max' }, { id: 'hp' }] }).token;
  assert.equal(token.resolve.max, 4, 'bought with a Slot at level 4');
  assert.deepEqual(experienceSlots(token).map(x => x.name), ['Other path'], 'Sleeping reads its own Experiences');
  const capped = sleeper({ level: 3, resolve: { current: 6, max: 6, dieType: 'd4' } });
  assert.throws(() => applyLevelUp(capped, { picks: [{ id: 'power', resolve: 'max' }, { id: 'hp' }] }), /elige un Move/);
  assert.match(applyLevelUp(capped, { picks: [{ id: 'power', resolve: 'move', note: 'Brace' }, { id: 'hp' }] }).summary.join(' '), /Resolve Move: Brace/);
  const tempered = applyLevelUp(sleeper({ level: 8 }), { picks: [{ id: 'tempered' }] }).token;
  assert.equal(tempered.resolve.dieType, 'd6'); assert.equal(tempered.resolve.max, 3);
  assert.match(optionBlocked(tempered, 'tempered'), /ya es d6/);
});

test('Experiences stop at +5 and the level-up dialog applies the choices to the sheet', async () => {
  assert.throws(() => applyLevelUp(pc({ level: 2, sheetFields: { a_exp_0: 'A', a_exp_0_bonus: '+5', a_exp_1: 'B', a_exp_1_bonus: '+2' } }), { picks: [{ id: 'experiences', experiences: ['a_exp_0', 'a_exp_1'] }, { id: 'hp' }] }), /\+5, el máximo/);
  const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
  for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[key] = dom.window[key];
  const { store } = await import('../src/state.js'); await store.ready;
  const { createActor } = await import('../src/actors.js');
  const { openLevelUp, canLevelUp } = await import('../src/levelUpUI.js');
  after(async () => { await store.saveQueue.catch(() => {}); dom.window.close(); });
  store.state.userRole = 'keeper'; store.sessionRole = 'local';
  const actor = createActor(pc(), store.state.activeMapId); store.state.tokens.push(actor);
  assert.equal(canLevelUp(actor), true);
  const modal = await openLevelUp(actor.id), form = modal.querySelector('form');
  assert.match(modal.textContent, /1 → 2/); assert.match(modal.querySelector('.level-grants').textContent, /Proficiency/);
  const submit = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  form.elements.slot_0.value = 'trait'; form.elements.slot_0.onchange();
  form.elements.trait_0.value = 'knowledge';
  submit();
  assert.match(modal.querySelector('.dossier-error').textContent, /1 Advancement Slot sin gastar/, 'asks before losing a Slot');
  assert.equal(store.state.tokens.find(t => t.id === actor.id).level, 1);
  form.elements.slot_1.value = 'hp'; form.elements.slot_1.onchange();
  submit();
  const saved = store.state.tokens.find(t => t.id === actor.id);
  assert.deepEqual([saved.level, saved.traits.knowledge, saved.hp.max, saved.proficiency], [2, 3, 7, 2]);
  assert.equal(document.querySelector('.level-up-dialog'), null);
  store.state.userRole = 'player';
  assert.equal(canLevelUp(saved), false, 'only the Keeper levels characters up');
});

const pilot = (extra = {}) => pc({ characterClass: 'Pilot', subclass: 'Void Runner', sheetFields: { a_exp_0: 'Lane rat', a_exp_0_bonus: '+2', a_exp_1: 'Fleet lifer', a_exp_1_bonus: '+2', a_domain_ref: 'Void & Tech', a_pwr_0_n: 'Slipstream Jolt', a_vault: '', a_loadout_cap: '5' }, ...extra });

test('a new Power is chosen from the character Domains at a level it can reach, never one it already has, and enters the Vault', () => {
  const at1 = pilot();
  assert.deepEqual(powerDomains(at1, data).sort(), ['Tech', 'Void']);
  const options = availablePowers(at1, data);
  assert.ok(options.length > 0 && options.every(p => ['Void', 'Tech'].includes(p.d) && p.l <= 2));
  assert.ok(!options.some(p => p.n === 'Slipstream Jolt'), 'already in the Loadout');
  const chosen = options[0];
  const { token, summary } = applyLevelUp(at1, { data, picks: [{ id: 'power', powerId: `${chosen.d}::${chosen.n}` }, { id: 'hp' }], achievementExperiences: ['a_exp_0', 'a_exp_1'] });
  assert.match(token.sheetFields.a_vault, new RegExp(chosen.n)); assert.match(summary.join(' '), /Nuevo Poder al Vault/);
  assert.ok(!availablePowers(token, data).some(p => p.n === chosen.n), 'no duplicates');
  assert.throws(() => applyLevelUp(at1, { data, picks: [{ id: 'power', powerId: 'Lux::Nope' }, { id: 'hp' }], achievementExperiences: ['a_exp_0', 'a_exp_1'] }), /Poder disponible/);
});

test('a Tier Achievement or a Slot can add a new Experience at +2 instead of raising two; five is the limit', () => {
  const { token } = applyLevelUp(pilot(), { data, picks: [{ id: 'hp' }, { id: 'stress' }], achievementExperiences: ['a_exp_0'], achievementNewExperience: 'Storm survivor' });
  assert.deepEqual(experienceSlots(token).map(x => [x.name, x.bonus]), [['Lane rat', 3], ['Fleet lifer', 2], ['Storm survivor', 2]]);
  assert.throws(() => applyLevelUp(pilot(), { data, picks: [{ id: 'hp' }, { id: 'stress' }], achievementExperiences: ['a_exp_0'], achievementNewExperience: 'lane rat' }), /ya existe/);
  const full = pilot({ level: 2, sheetFields: Object.fromEntries([0, 1, 2, 3, 4].flatMap(i => [[`a_exp_${i}`, `E${i}`], [`a_exp_${i}_bonus`, '+2']])) });
  assert.throws(() => applyLevelUp(full, { data, picks: [{ id: 'experiences', experiences: ['a_exp_0'], newExperience: 'Sixth' }, { id: 'hp' }] }), /máximo cinco/);
});

test('Multiclass adds a second Class with a genuinely new Domain at half level; Subclass upgrades grant the full feature; Loadout grows with the Tier', () => {
  const at4 = pilot({ level: 4 });
  const choices = multiclassChoices(at4, data);
  assert.ok(!choices.some(c => c.name === 'Pilot'));
  const mystic = choices.find(c => c.id === 'mystic');
  assert.ok(mystic.domains.includes('Neural') && !mystic.domains.includes('Void'), 'Void is already a Pilot Domain');
  const pick = { id: 'multiclass', classId: 'mystic', domain: 'Neural', answer: 'I felt the storm speak.' };
  assert.throws(() => applyLevelUp(at4, { data, picks: [{ ...pick, domain: 'Void' }], achievementExperiences: ['a_exp_0', 'a_exp_1'] }), /Dominio nuevo/);
  assert.throws(() => applyLevelUp(at4, { data, picks: [{ ...pick, answer: ' ' }], achievementExperiences: ['a_exp_0', 'a_exp_1'] }), /pregunta de trasfondo/);
  const { token } = applyLevelUp(at4, { data, picks: [pick], achievementExperiences: ['a_exp_0', 'a_exp_1'] });
  assert.deepEqual([token.level, token.advancement.multiclass.className, token.sheetFields.multiclass], [5, 'Mystic', 'Mystic']);
  assert.equal(token.sheetFields.a_loadout_cap, '6', 'Tier 2 carries six Powers');
  assert.deepEqual(powerDomains(token, data).sort(), ['Neural', 'Tech', 'Void']);
  const next = availablePowers(token, data);
  assert.ok(next.filter(p => p.d === 'Neural').every(p => p.l <= 3), 'level 6: the multiclass Domain reaches half, rounded up');
  assert.ok(next.some(p => p.d === 'Void' && p.l > 3));
  // Subclass: Specialization at Tier 2, with the feature text on the sheet.
  assert.equal(nextSubclassFeature(token, data).rank, 'Specialization');
  const upgraded = applyLevelUp(token, { data, picks: [{ id: 'subclass' }] }).token;
  const feature = data.classes.find(c => c.id === 'pilot').awakenedSubclasses.find(s => s.name === 'Void Runner').specialization;
  assert.ok(upgraded.sheetFields.features.includes(feature.name)); assert.equal(upgraded.sheetFields.subclass_rank, 'Specialization');
  assert.equal(nextSubclassFeature(upgraded, data).rank, 'Mastery');
});
