// Character creation rules of the VTT. Adapted from the Veilfarers Character Creator
// (creator wizard + sheet bridge): same nine steps, same choices, same sheet format, so
// the result goes through the VTT importer like any other sheet. Pure functions; the data
// (src/creator/data/*.json) is passed in so it can be loaded on demand.

export const CREATOR_STEPS = [
  { id: 1, label: 'Ancestry' }, { id: 2, label: 'Community' }, { id: 3, label: 'Path, Class y Subclass' },
  { id: 4, label: 'Traits' }, { id: 5, label: 'Experiencias' }, { id: 6, label: 'Afiliación' },
  { id: 7, label: 'Poderes' }, { id: 8, label: 'Equipo' }, { id: 9, label: 'Detalles' },
];
export const TRAIT_IDS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
// The starting array: each value goes to exactly one Trait.
export const TRAIT_ARRAY = [2, 1, 1, 0, 0, -1];
// Corebook ch. 8, Finishing Touches: one Tier 1 weapon and one armor piece. Tier 1 gear costs
// at most 4 credits.
export const EQUIP_BUDGET = 4;
export const STARTING_POWERS = 2;
// Corebook ch. 8, Step 5: an Awakened character starts with two Experiences at +2 and a
// Sleeping one with three.
export const experienceCount = state => (state.path === 'Sleeping' ? 3 : 2);
// Corebook ch. 8, Step 6: the six Houses, the Free Fleet, the Explorers' Guild or Independent.
// Two more are advanced options that need the Keeper's approval; the rest are outside the Corebook.
const CORE_AFFILIATIONS = ['house-amaranth', 'house-joric', 'house-kurogane', 'house-solari', 'house-valerius', 'house-volkov', 'free-fleet', 'explorers-guild', 'independent'];
const ADVANCED_AFFILIATIONS = ['solara-compact', 'commerce-guild'];
export function affiliationStatus(affiliation) {
  if (CORE_AFFILIATIONS.includes(affiliation?.id)) return { kind: 'core', note: '' };
  if (ADVANCED_AFFILIATIONS.includes(affiliation?.id)) return { kind: 'advanced', note: 'Opción avanzada (Keeper\'s Companion): requiere aprobación del Keeper.' };
  return { kind: 'extra', note: 'Fuera de las opciones del Corebook: solo con aprobación del Keeper.' };
}
const VANGUARD_BRANCH = { 'Ghost Blade': 'Void', 'Kinetic Echo': 'Kinetic', 'Pure Conduit': 'Lux' };
const NATURAL_ARMOR = ['kryllian', 'rift-spinner', 'synthetic'];

export function freshState() {
  return {
    ancestry: null, subStrain: null, humanInheritance: null, humanInheritanceItem: null, community: null, path: null, cls: null, subclass: null,
    traits: {}, experiences: ['', '', ''], affiliation: null, veilAlignment: null, sleepingMysticDomains: [], powers: [],
    weapons: [], armors: [], kit: '', includeRustAndSteel: false,
    name: '', pronouns: '', appearance: '', voice: '', bgAnswer: '', anchor: '', wound: '',
  };
}

const find = (list, id) => (list || []).find(x => x.id === id) || null;
const clean = value => String(value ?? '').trim();
const signed = value => { const n = Number(value) || 0; return n >= 0 ? `+${n}` : String(n); };
const feature = f => (f ? [clean(f.name), clean(f.text || f.desc)].filter(Boolean).join(' — ') : '');

// Corebook ch. 3, Human — Inheritance of the Builders (choose one at character creation):
// The Graft, one free Common or Military augmentation with no drawback; or The Tool, one
// Experimental item worth 9 Cr from any equipment catalog in play.
export function inheritanceOptions(state, data, kind = state.humanInheritance) {
  const list = kind === 'graft' ? data.humanInheritance?.grafts : kind === 'tool' ? data.humanInheritance?.tools : [];
  return (list || []).filter(item => state.includeRustAndSteel || item.pack === 'core');
}
export function inheritanceChoice(state, data) {
  if (state.ancestry !== 'human' || !state.humanInheritance) return null;
  const all = state.humanInheritance === 'graft' ? data.humanInheritance?.grafts : data.humanInheritance?.tools;
  return (all || []).find(item => item.id === state.humanInheritanceItem) || null;
}

// Corebook ch. 7: every Sleeping character has the two Class Moves of its primary Class plus
// the Move of its Subclass (Sleeping Mystic and Vanguard subclasses have none of their own).
// Sleeping subclass names may carry a suffix, e.g. "Ghost Blade (+Void)".
export const baseSubclassName = name => String(name ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
export function resolveMovesFor(data, className, subclass = '') {
  return (data.resolveMoves || []).filter(m => same(m.class, className) && (!m.subclass || same(m.subclass, subclass) || same(m.subclass, baseSubclassName(subclass))));
}
export const classResolveMoves = (data, className) => (data.resolveMoves || []).filter(m => same(m.class, className) && !m.subclass);
export const moveText = move => `${move.name} (${move.cost}) — ${move.text}`;
export function startingResolveMoves(state, data) {
  const cls = find(data.classes, state.cls);
  return state.path === 'Sleeping' && cls ? resolveMovesFor(data, cls.name, state.subclass) : [];
}

export const classOf = (state, data) => find(data.classes, state.cls);
// Sleeping characters use the class's Sleeping rules (Effort Feature, its own HP and Evasion).
export function classRules(state, data) {
  const cls = classOf(state, data);
  return cls && state.path === 'Sleeping' && cls.sleepingRules ? { ...cls, ...cls.sleepingRules } : cls;
}
export function subclassList(state, data) {
  const cls = classOf(state, data);
  if (!cls) return [];
  return (state.path === 'Sleeping' ? cls.sleepingSubclasses : cls.awakenedSubclasses) || [];
}
export const subclassOf = (state, data) => subclassList(state, data).find(s => s.name === state.subclass) || null;

// The two Domains a character draws Powers from. Mystic and Vanguard choose their second one.
export function characterDomains(state, data) {
  const cls = classOf(state, data);
  if (!cls) return [];
  if (cls.id === 'mystic' && state.path === 'Sleeping') return (state.sleepingMysticDomains || []).slice(0, 2);
  if (cls.id === 'mystic') return ['Neural', state.veilAlignment].filter(Boolean);
  if (cls.id === 'vanguard') return ['Neural', VANGUARD_BRANCH[state.subclass]].filter(Boolean);
  return cls.domainList.slice(0, 2);
}
export const allDomains = data => [...new Set(data.powers.map(p => p.d))].sort();
export const powerId = power => `${power.d}::${power.n}`;
export const levelOnePowers = (data, domain) => data.powers.filter(p => p.l === 1 && p.d === domain);
export const powerById = (data, id) => data.powers.find(p => powerId(p) === id) || null;
export const needsPowers = (state, data) => state.path === 'Awakened' && !!classOf(state, data);

// Starting gear: Common (TT1) items within the class's Technology Access, 4 credits each side.
export function equipmentEligibility(item, type, cls) {
  const access = cls?.technologyAccess?.tiers?.find(t => Number(t.rank) === 1);
  if (!access) return { eligible: false, reason: 'Elige primero una clase.' };
  if (Number(item.tierRank || 1) > 1) return { eligible: false, reason: `${item.tier}: por encima del acceso inicial.` };
  const all = type === 'weapon' ? access.allWeapons : access.allArmor;
  const categories = (type === 'weapon' ? access.weaponCategories : access.armorCategories) || [];
  if (!all && !categories.includes(item.category)) return { eligible: false, reason: `Fuera del entrenamiento de ${cls.name}.` };
  return { eligible: true, reason: '' };
}
export const spend = (names, list) => names.reduce((sum, name) => sum + (list.find(x => x.name === name)?.cost || 0), 0);
export function equipmentChoices(state, data, type) {
  const cls = classOf(state, data), list = type === 'weapon' ? data.weapons : data.armor;
  return list.filter(item => (state.includeRustAndSteel || item.pack === 'core') && equipmentEligibility(item, type, cls).eligible && item.cost <= EQUIP_BUDGET);
}

export function isStepReady(state, step, data) {
  if (step === 1) {
    const anc = find(data.ancestries, state.ancestry);
    if (!anc || ((anc.subStrains || []).length && !state.subStrain)) return false;
    return anc.id !== 'human' || !!inheritanceChoice(state, data);
  }
  if (step === 2) return !!state.community;
  if (step === 3) return ['Awakened', 'Sleeping'].includes(state.path) && !!classOf(state, data) && !!subclassOf(state, data);
  if (step === 4) {
    if (!TRAIT_IDS.every(id => Object.prototype.hasOwnProperty.call(state.traits || {}, id))) return false;
    const sorted = list => list.map(Number).sort((a, b) => a - b).join(',');
    return sorted(TRAIT_IDS.map(id => state.traits[id])) === sorted(TRAIT_ARRAY);
  }
  if (step === 5) return ['Awakened', 'Sleeping'].includes(state.path) && state.experiences.slice(0, experienceCount(state)).every(x => clean(x).length > 0);
  if (step === 6) return !!state.affiliation;
  if (step === 7) {
    if (state.path === 'Sleeping') return state.cls !== 'mystic' || (state.sleepingMysticDomains || []).length === 2;
    const domains = characterDomains(state, data);
    return domains.length === 2 && state.powers.length === STARTING_POWERS && state.powers.every(id => domains.includes(powerById(data, id)?.d));
  }
  if (step === 8) return state.weapons.length === 1 && state.armors.length === 1 && spend(state.weapons, data.weapons) <= EQUIP_BUDGET && spend(state.armors, data.armor) <= EQUIP_BUDGET;
  if (step === 9) return clean(state.name).length > 0;
  return false;
}
export const firstIncompleteStep = (state, data) => CREATOR_STEPS.find(s => !isStepReady(state, s.id, data))?.id || 0;

// Changing an earlier choice clears what depended on it.
export function setChoice(state, key, value) {
  const next = { ...state, [key]: value };
  if (key === 'ancestry') Object.assign(next, { subStrain: null, humanInheritance: null, humanInheritanceItem: null });
  if (key === 'humanInheritance') next.humanInheritanceItem = null;
  if (key === 'path' || key === 'cls') Object.assign(next, { subclass: null, powers: [], veilAlignment: null, sleepingMysticDomains: [] });
  if (key === 'cls') Object.assign(next, { weapons: [], armors: [] });
  if (key === 'subclass' || key === 'veilAlignment') next.powers = [];
  return next;
}

// The finished character as a "Veilfarers Character Sheet" document, the format the VTT imports.
export function buildSheetDocument(state, data, { characterId = '', now = new Date() } = {}) {
  const missing = firstIncompleteStep(state, data);
  if (missing) throw new Error(`Falta completar el paso ${missing}: ${CREATOR_STEPS[missing - 1].label}.`);
  const sleeping = state.path === 'Sleeping', level = 1;
  const anc = find(data.ancestries, state.ancestry), com = find(data.communities, state.community), aff = find(data.affiliations, state.affiliation);
  const cls = classOf(state, data), rules = classRules(state, data), sub = subclassOf(state, data);
  const strain = (anc.subStrains || []).find(s => s.id === state.subStrain) || null;
  const weapons = state.weapons.map(n => data.weapons.find(w => w.name === n)).filter(Boolean).slice(0, 1);
  // Independent trades Standing and Calls for a Favor Pool of 1 token per session.
  const independent = aff.id === 'independent';
  const armor = data.armor.find(a => a.name === state.armors[0]) || null;
  const powers = sleeping ? [] : state.powers.map(id => powerById(data, id)).filter(Boolean);
  const domains = characterDomains(state, data);

  const inherited = inheritanceChoice(state, data), graft = state.humanInheritance === 'graft' ? inherited : null, tool = state.humanInheritance === 'tool' ? inherited : null;
  const slotText = graft ? (graft.capacityCost ? '1 Augment Slot' : '0 Augment Slots') : '';
  // The printed "The Tool" gift is one of the two inheritances; it is listed only when chosen.
  const gifts = (anc.gifts || []).filter(g => !(anc.id === 'human' && g.name === 'The Tool' && !tool));
  const ancestryText = [...gifts.map(feature), feature(anc.extra), strain && [strain.name, strain.featName, strain.featText].filter(Boolean).join(' · '),
    graft && `Inheritance of the Builders — The Graft: ${graft.name} (${graft.tier}) · ${slotText} · no drawback`,
    tool && `Inheritance of the Builders — The Tool: ${tool.name} · Experimental (TT3) · 9 Cr · paid for`].filter(Boolean).join('\n\n');
  const communityText = feature(com.feature);
  const pathFeature = sleeping ? rules.effortFeature : rules.hopeFeature;
  const foundation = sub?.foundation ? `${sub.name} · Foundation — ${feature(sub.foundation)}` : '';
  const studied = sleeping && state.sleepingMysticDomains.length ? `Studied Domains — ${state.sleepingMysticDomains.join(' + ')}` : '';
  const affiliationNotes = [aff.tag, aff.benefit && `Benefit: ${aff.benefit}`, aff.obligation && `Obligation: ${aff.obligation}`].filter(Boolean).join('\n');
  const appearance = [state.appearance && `Appearance: ${clean(state.appearance)}`, state.voice && `Voice: ${clean(state.voice)}`].filter(Boolean).join('\n');
  const access = cls.technologyAccess?.tiers?.find(t => Number(t.rank) === 1);

  const hp = Number(rules.hp) || 6, evasion = Number(rules.evasion) || 10;
  // Corebook ch. 8: six Stress slots, seven for Synthetics.
  const stress = anc.id === 'synthetic' ? 7 : 6;
  // Thresholds are armor + level; without armor 2 / 4, or 4 / 6 for naturally armored ancestries.
  const base = armor ? armor.thresholds : NATURAL_ARMOR.includes(anc.id) ? { major: 4, severe: 6 } : { major: 2, severe: 4 };
  const major = Number(base.major) + level, severe = Number(base.severe) + level, slots = armor ? Number(armor.armorSlots) || 0 : 0;

  const f = {
    character_id: characterId, name: clean(state.name), pron: clean(state.pronouns), level: String(level), prof: '1', chosen_path: sleeping ? 'Sleeping' : 'Awakened',
    ancestry: anc.name, ancestry_gift: ancestryText, ancestry_note: '', ailuran_variant: strain ? strain.name : '',
    community: com.name, community_gift: communityText, community_note: '', community_advantages: '',
    affiliation: aff.name, aff_standing: independent ? '' : '+1 Good Standing', aff_reputation: independent ? '' : 'Unknown (0)', aff_tokens: independent ? '1 Favor por sesión (Independent Favor Pool)' : '', aff_notes: [affiliationNotes, appearance].filter(Boolean).join('\n\n'), aff_faction_notes: '',
    class: cls.name, subclass: sub.name, subclass_rank: 'Foundation', signature_trait: clean(sub.trait || rules.spellcastTrait),
    features: [feature(rules.classFeature), foundation, studied].filter(Boolean).join('\n\n'),
    a_featname: sleeping ? '' : clean(pathFeature?.name), a_feattext: sleeping ? '' : clean(pathFeature?.text),
    s_featname: sleeping ? clean(pathFeature?.name) : '', s_feattext: sleeping ? clean(pathFeature?.text) : '',
    s_honed: sleeping ? 'HONED EDGE +0 DAMAGE' : '', s_resolve_die: 'd4', s_anchor: sleeping ? clean(state.anchor) : '',
    s_learned_moves: startingResolveMoves(state, data).map(moveText).join('\n\n'),
    class_proficiencies: clean(access?.summary), tech_access: '1',
    evasion: String(evasion), thr_major: String(major), thr_severe: String(severe),
    wealth: '1', kit_class: (rules.items || []).join(' · '), kit_personal: clean(state.kit),
    a_domain_ref: sleeping ? '' : [domains.join(' & '), state.veilAlignment && `Veil Alignment — ${state.veilAlignment}`].filter(Boolean).join(' · '),
    a_loadout_cap: sleeping ? '' : '5', a_vault: '',
    seed_motive: clean(state.bgAnswer), equipment_notes: clean(state.wound),
  };
  if (inherited) Object.assign(f, { human_inheritance_kind: state.humanInheritance, human_inheritance_item_id: inherited.id, human_inheritance_item_name: inherited.name });
  if (graft) Object.assign(f, { aug_0_name: graft.name, aug_0_tier: graft.tierCode || graft.tier, aug_0_benefit: clean(graft.benefit), aug_0_deg: `Human inheritance · no drawback · ${slotText}` });
  if (anc.id === 'human') f.augment_notes = 'Human — Made for the Graft: +2 Augment Capacity.' + (graft ? ' Inherited graft has no drawback.' : '');
  if (tool) Object.assign(f, { eq_0_name: tool.name, eq_0_tier: tool.tierCode || tool.tier, eq_0_use: `${clean(tool.summary)} · The Tool (human inheritance)`, eq_0_qty: '1' });
  for (const id of TRAIT_IDS) { f[`tr_${id}`] = signed(state.traits[id]); f[`base_tr_${id}`] = signed(state.traits[id]); }
  state.experiences.slice(0, experienceCount(state)).forEach((value, i) => { for (const p of ['a', 's']) { f[`${p}_exp_${i}`] = clean(value); f[`${p}_exp_${i}_bonus`] = '+2'; } });
  weapons.forEach((w, i) => {
    const p = i === 0 ? 'wpri' : 'wsec';
    Object.assign(f, { [`${p}_name`]: w.name, [`${p}_trait`]: w.trait, [`${p}_range`]: w.range, [`${p}_dmg`]: clean(w.damage), [`${p}_feat`]: (w.features || []).join(', '), [`${p}_tier`]: w.tierCode || w.tier });
  });
  if (armor) Object.assign(f, { armor_name: armor.name, armor_thr: armor.thresholds.raw || `${armor.thresholds.major} / ${armor.thresholds.severe}`, armor_score: String(slots), armor_feat: (armor.features || []).join(', '), armor_tier: armor.tierCode || armor.tier });
  powers.forEach((p, i) => Object.assign(f, { [`a_pwr_${i}_n`]: p.n, [`a_pwr_${i}_d`]: [p.d, `L${p.l}`, p.t, p.cost, p.dc].filter(Boolean).join(' · ') + `\n${clean(p.txt)}`, [`a_pwr_${i}_rc`]: clean(p.rc ?? 0) }));

  return {
    app: 'Veilfarers Character Sheet', version: '2.84-VTT', schema: 'veilfarers.character/2', characterId, exportedAt: now.toISOString(), fields: f,
    tracks: {
      max: { hp, armor_slots: slots, stress, s_resolve: 2, a_hope: 6, s_effort: 6 },
      current: { hp, armor_slots: slots, stress: 0, s_resolve: sleeping ? 2 : 0, a_hope: sleeping ? 0 : 2, s_effort: sleeping ? 2 : 0 },
    },
  };
}
