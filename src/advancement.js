// Level-up rules, Corebook 12.06 ch. 12 (Advancement). Pure functions: the sheet dialog
// collects the choices and applyLevelUp() returns the advanced character.
import { TRAIT_IDS } from './characterImport.js';

export const MAX_LEVEL = 10;
export const tierOf = level => (level >= 8 ? 3 : level >= 5 ? 2 : 1);
// Levels 2, 5 and 8 add a Tier Achievement to the two Advancement Slots.
export const isTierAchievement = level => [2, 5, 8].includes(level);
// Sleeping: maximum Resolve rises by 1 at levels 3, 5, 7 and 9, never above 6.
const RESOLVE_LEVELS = [3, 5, 7, 9];

export const ADVANCEMENT_OPTIONS = [
  { id: 'hp', slots: 1, label: '+1 HP máximo' },
  { id: 'stress', slots: 1, label: '+1 Stress máximo' },
  { id: 'experiences', slots: 1, label: '+1 a dos Experiencias' },
  { id: 'trait', slots: 1, label: '+1 a un Trait (una vez por Tier y Trait)' },
  { id: 'evasion', slots: 1, label: '+1 Evasion' },
  { id: 'proficiency', slots: 2, label: '+1 Proficiency (máx. 6)' },
  { id: 'tech', slots: 1, label: '+1 Technology Access Level' },
  { id: 'power', slots: 1, label: 'Nuevo Poder (Awakened) / +1 Resolve o Move (Sleeping)' },
  { id: 'multiclass', slots: 2, label: 'Multiclass (Tier 2+, una vez)' },
  { id: 'subclass', slots: 2, label: 'Upgraded Subclass (Tier 2+)' },
  { id: 'tempered', slots: 2, label: 'Tempered Resolve: d4 → d6 (Tier 3, Sleeping, una vez)' },
];
const option = id => ADVANCEMENT_OPTIONS.find(o => o.id === id);
const record = token => ({ log: [], traitRaises: {}, multiclass: false, subclassUpgrades: 0, temperedResolve: false, ...(token.advancement || {}) });
const fields = token => token.sourceCharacter?.document?.fields || token.sheetFields || {};
const writable = token => token.sourceCharacter?.document?.fields || (token.sheetFields ||= {});
const bonus = value => { const n = parseInt(String(value ?? '').replace('−', '-'), 10); return Number.isFinite(n) ? n : 0; };

// The character's Experiences on the active Path, with the sheet key of each bonus.
export function experienceSlots(token) {
  const f = fields(token), prefix = token.path === 'Sleeping' ? 's' : 'a';
  return Object.keys(f).filter(k => new RegExp(`^${prefix}_exp_\\d+$`).test(k) && String(f[k] ?? '').trim())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(key => ({ key, name: String(f[key]), bonus: bonus(f[`${key}_bonus`]) }));
}

// Why an option cannot be taken at the level the character is about to reach; '' when it can.
export function optionBlocked(token, id, nextLevel = (token.level || 1) + 1) {
  const tier = tierOf(nextLevel), adv = record(token), sleeping = token.path === 'Sleeping';
  if (id === 'proficiency' && (token.proficiency || 1) >= 6) return 'Proficiency ya está en el máximo (6).';
  if (id === 'experiences' && !experienceSlots(token).length) return 'La ficha no tiene Experiencias registradas.';
  if (id === 'trait' && TRAIT_IDS.every(t => (adv.traitRaises[tier] || []).includes(t))) return 'Todos los Traits ya subieron en este Tier.';
  if (id === 'multiclass') { if (tier < 2) return 'Multiclass requiere Tier 2 (nivel 5).'; if (adv.multiclass) return 'Multiclass solo se toma una vez.'; }
  if (id === 'subclass') {
    if (tier < 2) return 'Upgraded Subclass requiere Tier 2 (nivel 5).';
    if (adv.subclassUpgrades >= 2) return 'El Subclass ya tiene Specialization y Mastery.';
    if (adv.subclassUpgrades === 1 && tier < 3) return 'La Mastery requiere Tier 3 (nivel 8).';
  }
  if (id === 'tempered') {
    if (!sleeping) return 'Tempered Resolve es solo para Sleeping.';
    if (tier < 3) return 'Tempered Resolve requiere Tier 3 (nivel 8).';
    if (adv.temperedResolve || token.resolve?.dieType === 'd6') return 'El Resolve ya es d6.';
  }
  return '';
}

// --- Choices that need the rules data (src/creator/creatorData.js) ---------------------------
const lower = value => String(value ?? '').trim().toLowerCase();
const classByName = (data, name) => (data?.classes || []).find(c => lower(c.name) === lower(name) || c.id === lower(name)) || null;

// Domains the character can take Powers from: its own pair plus, once multiclassed, the new one.
export function powerDomains(token, data) {
  const all = [...new Set((data?.powers || []).map(p => p.d))];
  const reference = String(fields(token).a_domain_ref ?? '').split('\n')[0];
  let own = all.filter(d => new RegExp(`\\b${d}\\b`, 'i').test(reference));
  if (!own.length) own = (classByName(data, token.characterClass)?.domainList || []).slice(0, 2);
  const extra = token.advancement?.multiclass?.domain;
  return extra && !own.includes(extra) ? [...own, extra] : own;
}
export function ownedPowerNames(token) {
  const f = fields(token);
  const loadout = Object.keys(f).filter(k => /^a_pwr_\d+_n$/.test(k)).map(k => f[k]);
  const vault = String(f.a_vault ?? '').split('\n').map(line => line.split(' · ').pop());
  return new Set([...loadout, ...vault].map(lower).filter(Boolean));
}
// Powers an Awakened character may learn at the level it is reaching. A multiclass Domain
// advances at half the character's level, rounded up.
export function availablePowers(token, data, nextLevel = (token.level || 1) + 1) {
  if (token.path === 'Sleeping' || !data) return [];
  const domains = powerDomains(token, data), owned = ownedPowerNames(token), extra = token.advancement?.multiclass?.domain;
  return data.powers.filter(p => domains.includes(p.d) && p.l <= (p.d === extra ? Math.ceil(nextLevel / 2) : nextLevel) && !owned.has(lower(p.n)))
    .sort((a, b) => a.l - b.l || a.d.localeCompare(b.d) || a.n.localeCompare(b.n));
}
// Classes and Domains a character could multiclass into: a different Class with a Domain it lacks.
export function multiclassChoices(token, data) {
  const own = powerDomains(token, data).map(lower);
  return (data?.classes || []).filter(c => lower(c.name) !== lower(token.characterClass))
    .map(c => ({ id: c.id, name: c.name, question: c.bgQuestion, domains: c.domainList.filter(d => !own.includes(lower(d))) })).filter(c => c.domains.length);
}
// Resolve Moves (Corebook ch. 7). A Sleeping character already holds its two Class Moves and its
// Subclass Move, so Option 8 only finds a Move when the sheet is missing one of them.
const moveLine = move => `${move.name} (${move.cost}) — ${move.text}`;
const baseSubclass = name => String(name ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
const knowsMove = (token, move) => lower(fields(token).s_learned_moves).includes(lower(move.name));
export function availableResolveMoves(token, data) {
  if (token.path !== 'Sleeping' || !data) return [];
  return (data.resolveMoves || []).filter(m => lower(m.class) === lower(token.characterClass) && (!m.subclass || lower(m.subclass) === lower(token.subclass) || lower(m.subclass) === lower(baseSubclass(token.subclass))) && !knowsMove(token, m));
}
// A Sleeping multiclass learns exactly one Class Resolve Move of the second Class.
export const multiclassMoves = (data, classId) => { const cls = (data?.classes || []).find(c => c.id === classId); return cls ? (data.resolveMoves || []).filter(m => lower(m.class) === lower(cls.name) && !m.subclass) : []; };
function learnMove(token, move) {
  const f = writable(token);
  f.s_learned_moves = [String(f.s_learned_moves ?? '').trim(), moveLine(move)].filter(v => v && v !== '[]').join('\n\n');
}

// The Subclass feature the next upgrade grants (Specialization, then Mastery).
export function nextSubclassFeature(token, data) {
  const cls = classByName(data, token.characterClass);
  const list = cls ? (token.path === 'Sleeping' ? cls.sleepingSubclasses : cls.awakenedSubclasses) : [];
  const sub = (list || []).find(x => lower(x.name) === lower(token.subclass));
  const rank = (token.advancement?.subclassUpgrades || 0) === 0 ? 'Specialization' : 'Mastery';
  return { rank, feature: sub?.[rank.toLowerCase()] || null };
}

// What the level itself grants, before any slot is spent.
export function levelGrants(token) {
  const next = (token.level || 1) + 1, grants = [];
  if (isTierAchievement(next)) {
    grants.push((token.proficiency || 1) < 6 ? 'Logro de Tier: +1 Proficiency' : 'Logro de Tier: Proficiency ya en el máximo');
    grants.push('Logro de Tier: +1 a dos Experiencias');
    if (next >= 5) grants.push('Logro de Tier: se limpian los Traits marcados');
  }
  if (token.path === 'Sleeping' && RESOLVE_LEVELS.includes(next) && (token.resolve?.max ?? 2) < 6) grants.push('Sleeping: +1 Resolve máximo');
  grants.push('Umbrales Major y Severe +1 (suman el nivel)');
  return grants;
}

// Two existing Experiences +1 each or, with newName, a new Experience at +2 and one existing +1.
function raiseExperiences(token, keys, summary, label, newName = '') {
  const slots = experienceSlots(token), f = writable(token);
  const added = String(newName ?? '').trim().slice(0, 120);
  if (added) {
    if (slots.some(x => x.name.trim().toLowerCase() === added.toLowerCase())) throw new Error(`${label}: esa Experiencia ya existe.`);
    const prefix = token.path === 'Sleeping' ? 's' : 'a';
    // Corebook ch. 8: a character holds at most five Experiences.
    if (slots.length >= 5) throw new Error(`${label}: un personaje tiene como máximo cinco Experiencias.`);
    let index = 0; while (String(f[`${prefix}_exp_${index}`] ?? '').trim()) index++;
    f[`${prefix}_exp_${index}`] = added; f[`${prefix}_exp_${index}_bonus`] = '+2';
    summary.push(`${label}: nueva Experiencia «${added}» +2`);
    keys = keys.slice(0, 1);
    if (keys.length !== 1) throw new Error(`${label}: elige además una Experiencia existente que sube +1.`);
  } else {
    const distinct = slots.length >= 2;
    if (keys.length !== 2 || (distinct && keys[0] === keys[1])) throw new Error(`${label}: elige dos Experiencias${distinct ? ' distintas' : ''}.`);
  }
  for (const key of keys) {
    const slot = slots.find(s => s.key === key);
    if (!slot) throw new Error(`${label}: esa Experiencia no está en la ficha.`);
    const current = bonus(f[`${key}_bonus`]);
    if (current >= 5) throw new Error(`${label}: «${slot.name}» ya está en +5, el máximo.`);
    f[`${key}_bonus`] = `+${current + 1}`;
    summary.push(`${label}: ${slot.name} +${current + 1}`);
  }
}

// picks: [{ id, trait?, experiences?: [key, key], resolve?: 'max' | 'move', note? }]
// achievementExperiences: the two Experiences raised by a Tier Achievement (levels 2, 5, 8).
// data: the creator rules data. With it, Powers, Multiclass and Subclass are chosen from the
// rules; without it they are recorded as free-text notes.
// respend: spend the Advancement Slots refunded by an Awakening. The level does not change and
// nothing the level itself grants is applied again.
export function applyLevelUp(source, { picks = [], achievementExperiences = [], achievementNewExperience = '', allowUnspent = false, data = null, respend = false } = {}) {
  const token = structuredClone(source), level = token.level || 1, next = respend ? level : level + 1, tier = tierOf(next);
  const budget = respend ? (token.advancement?.refundSlots || 0) : 2;
  if (token.actorType === 'adversary' || token.isPlayer === false) throw new Error('Solo los personajes jugadores suben de nivel.');
  if (respend && budget < 1) throw new Error('Este personaje no tiene Advancement Slots devueltos por gastar.');
  if (!respend && level >= MAX_LEVEL) throw new Error(`El nivel máximo es ${MAX_LEVEL}.`);
  const chosen = picks.map(p => ({ ...p, option: option(p.id) }));
  if (chosen.some(p => !p.option)) throw new Error('Opción de avance desconocida.');
  const spent = chosen.reduce((n, p) => n + p.option.slots, 0);
  if (spent > budget) throw new Error(respend ? `Solo hay ${budget} Advancement Slot${budget === 1 ? '' : 's'} devuelto${budget === 1 ? '' : 's'}.` : 'Cada nivel da dos Advancement Slots.');
  if (respend && spent < 1) throw new Error('Elige en qué gastar los Slots devueltos.');
  if (!respend && spent < 2 && !allowUnspent) throw new Error('Quedan Advancement Slots sin gastar. Los que no se usen se pierden: confírmalo para continuar.');
  if (!respend && new Set(chosen.map(p => p.id)).size !== chosen.length) throw new Error('Las dos opciones de un Slot deben ser distintas.');
  for (const p of chosen) { const why = optionBlocked(token, p.id, next); if (why) throw new Error(why); }

  const adv = record(token), summary = [], sleeping = token.path === 'Sleeping';
  if (!respend) {
    token.level = next;
    token.hp = { ...token.hp, majorThreshold: (token.hp.majorThreshold || 0) + 1, severeThreshold: (token.hp.severeThreshold || 0) + 1 };
  }
  if (!respend && isTierAchievement(next)) {
    if ((token.proficiency || 1) < 6) { token.proficiency = (token.proficiency || 1) + 1; summary.push(`Logro de Tier: Proficiency ${token.proficiency}`); }
    if (experienceSlots(token).length) raiseExperiences(token, achievementExperiences, summary, 'Logro de Tier', achievementNewExperience);
    else summary.push('Logro de Tier: +1 a dos Experiencias (anótalas en la ficha)');
  }
  // Loadout capacity is set by Tier: 5 Powers at Tier 1, 6 at Tier 2 and 7 at Tier 3 (ch. 18).
  if (!sleeping) { const cap = 4 + tier; if (Number(fields(token).a_loadout_cap || 5) !== cap) { writable(token).a_loadout_cap = String(cap); if (tier !== tierOf(level)) summary.push(`Loadout: ${cap} Poderes`); } }
  if (!respend && sleeping && RESOLVE_LEVELS.includes(next) && token.resolve && token.resolve.max < 6) { token.resolve = { ...token.resolve, max: token.resolve.max + 1 }; summary.push(`Resolve máximo ${token.resolve.max}`); }

  for (const p of chosen) {
    const note = String(p.note ?? '').trim().slice(0, 200);
    if (p.id === 'hp') { token.hp = { ...token.hp, max: token.hp.max + 1, current: token.hp.current + 1 }; summary.push(`HP máximo ${token.hp.max}`); }
    if (p.id === 'stress') { token.stress = { ...token.stress, max: (token.stress?.max ?? 6) + 1 }; summary.push(`Stress máximo ${token.stress.max}`); }
    if (p.id === 'experiences') raiseExperiences(token, p.experiences || [], summary, 'Slot', p.newExperience);
    if (p.id === 'trait') {
      if (!TRAIT_IDS.includes(p.trait)) throw new Error('Elige el Trait que sube.');
      if ((adv.traitRaises[tier] || []).includes(p.trait)) throw new Error('Ese Trait ya subió en este Tier.');
      token.traits = { ...token.traits, [p.trait]: (token.traits?.[p.trait] ?? 0) + 1 };
      adv.traitRaises = { ...adv.traitRaises, [tier]: [...(adv.traitRaises[tier] || []), p.trait] };
      summary.push(`${p.trait} +${token.traits[p.trait]}`);
    }
    if (p.id === 'evasion') { token.evasion = (token.evasion ?? 10) + 1; summary.push(`Evasion ${token.evasion}`); }
    if (p.id === 'proficiency') { token.proficiency = (token.proficiency || 1) + 1; summary.push(`Proficiency ${token.proficiency}`); }
    if (p.id === 'tech') {
      const f = writable(token), current = bonus(f.tech_access);
      f.tech_access = String(current + 1); summary.push(`Technology Access ${current + 1}`);
    }
    if (p.id === 'power') {
      if (sleeping && p.resolve !== 'move') {
        if ((token.resolve?.max ?? 2) >= 6) throw new Error('El Resolve máximo ya es 6: elige un Move nuevo.');
        token.resolve = { ...token.resolve, max: token.resolve.max + 1 }; summary.push(`Resolve máximo ${token.resolve.max}`);
      } else if (!sleeping && data) {
        const power = availablePowers(token, data, next).find(x => `${x.d}::${x.n}` === p.powerId);
        if (!power) throw new Error('Elige un Poder disponible de tus Dominios.');
        const f = writable(token), line = `${power.d} · L${power.l} · ${power.n}`;
        f.a_vault = [String(f.a_vault ?? '').trim(), line].filter(Boolean).join('\n');
        summary.push(`Nuevo Poder al Vault: ${line}`);
      } else if (sleeping && data) {
        const move = availableResolveMoves(token, data).find(m => m.id === p.moveId);
        if (!move) throw new Error('Tu personaje ya tiene todos los Resolve Moves de su clase y subclase: elige +1 Resolve máximo.');
        learnMove(token, move); summary.push(`Nuevo Resolve Move: ${move.name}`);
      } else summary.push(`${sleeping ? 'Nuevo Resolve Move' : 'Nuevo Poder al Vault'}${note ? `: ${note}` : ''}`);
    }
    if (p.id === 'multiclass') {
      if (data) {
        const choice = multiclassChoices(token, data).find(c => c.id === p.classId);
        if (!choice) throw new Error('Elige una segunda Clase.');
        if (!choice.domains.includes(p.domain)) throw new Error('Elige un Dominio nuevo de la segunda Clase.');
        const answer = String(p.answer ?? '').trim().slice(0, 1000);
        if (!answer) throw new Error(`Responde a la pregunta de trasfondo de ${choice.name}.`);
        const cls = data.classes.find(c => c.id === choice.id), rules = sleeping && cls.sleepingRules ? cls.sleepingRules : cls;
        const move = sleeping ? multiclassMoves(data, choice.id).find(m => m.id === p.moveId) : null;
        if (sleeping && !move) throw new Error(`Un multiclass Sleeping aprende un Class Resolve Move de ${choice.name}: elígelo.`);
        const gained = sleeping ? rules.effortFeature : rules.hopeFeature, f = writable(token);
        adv.multiclass = { classId: choice.id, className: choice.name, domain: p.domain, dormant: sleeping };
        f.multiclass = choice.name;
        f.features = [String(f.features ?? '').trim(), `Multiclass · ${choice.name} — ${gained?.name || ''}: ${gained?.text || ''}`, `${choice.question} ${answer}`].filter(Boolean).join('\n\n');
        if (!sleeping) f.a_domain_ref = [String(f.a_domain_ref ?? '').trim(), `Multiclass Domain — ${p.domain}`].filter(Boolean).join(' · ');
        if (move) learnMove(token, move);
        summary.push(`Multiclass: ${choice.name} · Dominio ${p.domain}${sleeping ? ` (latente) · Move: ${move.name}` : ''}`);
      } else { adv.multiclass = true; summary.push(`Multiclass${note ? `: ${note}` : ''}`); }
    }
    if (p.id === 'subclass') {
      const upgrade = data ? nextSubclassFeature(token, data) : { rank: adv.subclassUpgrades === 0 ? 'Specialization' : 'Mastery', feature: null };
      adv.subclassUpgrades += 1; token.subclassRank = upgrade.rank;
      if (upgrade.feature) {
        const f = writable(token);
        f.subclass_rank = upgrade.rank;
        f.features = [String(f.features ?? '').trim(), `${token.subclass} · ${upgrade.rank} — ${upgrade.feature.name}: ${upgrade.feature.desc || upgrade.feature.text || ''}`].filter(Boolean).join('\n\n');
      }
      summary.push(`Subclass: ${upgrade.rank}${upgrade.feature ? ` · ${upgrade.feature.name}` : note ? ` · ${note}` : ''}`);
    }
    // Slots spent on the Sleeping engine come back if the character later Awakens (ch. 12).
    if (sleeping && (p.id === 'power' || p.id === 'tempered')) adv.sleepingSlots = (adv.sleepingSlots || 0) + p.option.slots;
    if (p.id === 'tempered') { adv.temperedResolve = true; token.resolve = { ...token.resolve, dieType: 'd6' }; summary.push('Tempered Resolve: dado d6'); }
  }
  if (!respend && spent < 2) summary.push(`${2 - spent} Advancement Slot sin gastar (perdido)`);
  if (respend) { adv.refundSlots = budget - spent; summary.unshift(`Slots devueltos gastados: ${spent}${adv.refundSlots ? ` (quedan ${adv.refundSlots})` : ''}`); }
  adv.log = [...adv.log, { level: next, tier, summary }].slice(-20);
  token.advancement = adv;
  return { token, summary };
}

// Awakening in play (Corebook ch. 7): a Sleeping character becomes Awakened. A story event the
// Keeper recognises, resolved in downtime; it is not an Advancement Slot option.
// powers: the starter pair, two Level 1 Powers of the primary Class's Domains ("Domain::Name").
export function awakeningDomains(token, data, veilAlignment = '') {
  const cls = classByName(data, token.characterClass), sub = baseSubclass(token.subclass);
  if (!cls) return [];
  if (cls.id === 'mystic') return ['Neural', ['Lux', 'Void'].includes(veilAlignment) ? veilAlignment : ''].filter(Boolean);
  if (cls.id === 'vanguard') return ['Neural', { 'Ghost Blade': 'Void', 'Kinetic Echo': 'Kinetic', 'Pure Conduit': 'Lux' }[sub]].filter(Boolean);
  return cls.domainList.slice(0, 2);
}
export function awaken(source, { data, powers = [], veilAlignment = '' } = {}) {
  const token = structuredClone(source);
  if (token.actorType === 'adversary' || token.isPlayer === false) throw new Error('Solo un personaje jugador puede Despertar.');
  if (token.path !== 'Sleeping') throw new Error('Solo un personaje Sleeping puede Despertar.');
  const cls = classByName(data, token.characterClass);
  if (!cls) throw new Error('No se reconoce la clase del personaje: no se puede aplicar el Awakening.');
  // The corresponding Awakened Subclass: The Steward becomes The Icon; the rest map by name.
  const subName = baseSubclass(token.subclass) === 'The Steward' ? 'The Icon' : baseSubclass(token.subclass);
  const sub = (cls.awakenedSubclasses || []).find(x => lower(x.name) === lower(subName));
  const domains = awakeningDomains(token, data, veilAlignment);
  if (cls.id === 'mystic' && domains.length < 2) throw new Error('Un Mystic elige su Veil Alignment (Lux o Void) al Despertar.');
  if (domains.length < 2) throw new Error('No se pueden determinar los Dominios del personaje.');
  const starter = [...new Set(powers)].map(id => data.powers.find(p => `${p.d}::${p.n}` === id && p.l === 1 && domains.includes(p.d))).filter(Boolean);
  if (starter.length !== 2) throw new Error(`Elige dos Poderes de nivel 1 distintos de ${domains.join(' y ')}.`);

  const adv = record(token), f = writable(token), level = token.level || 1, summary = ['Awakening: de Sleeping a Awakened'];
  const text = value => String(value ?? '').trim();
  const line = feature => (feature ? `${text(feature.name)} — ${text(feature.text || feature.desc)}` : '');
  // Effort becomes Hope; the Resolve engine, Honed Edge and the Recovery Anchor are retired.
  const hope = Math.min(token.effort || 0, token.hopeMax ?? 6);
  Object.assign(token, { path: 'Awakened', hope, effort: 0, resolve: { current: 0, max: 0, dieType: 'd4' }, honedEdgeBonus: 0, recoveryAnchor: '' });
  summary.push(`Effort → Hope ${hope}`, 'Se retiran Resolve, Resolve Moves, Honed Edge y Recovery Anchor');
  // Experiences stay; from now on they cost Hope to invoke.
  for (const key of Object.keys(f).filter(k => /^s_exp_\d+(_bonus)?$/.test(k))) { const mine = key.replace(/^s_/, 'a_'); if (text(f[key])) f[mine] = f[key]; }
  // Hope Feature and Class Feature of the Awakened class; the Subclass keeps its upgrade tier.
  const previousSub = token.subclass;
  if (sub) { token.subclass = sub.name; f.subclass = sub.name; token.roleTag = [token.characterClass, sub.name].filter(Boolean).join(' · '); }
  const sleepingRules = cls.sleepingRules || {};
  const stale = [text(sleepingRules.classFeature?.name), text(previousSub), text(baseSubclass(previousSub)), 'Multiclass ·', 'Studied Domains'].filter(Boolean);
  const kept = text(f.features).split('\n\n').filter(part => part && !stale.some(prefix => part.startsWith(prefix)));
  const upgrades = adv.subclassUpgrades || 0, multi = adv.multiclass && typeof adv.multiclass === 'object' ? adv.multiclass : null;
  const secondClass = multi ? data.classes.find(c => c.id === multi.classId) : null;
  f.features = [line(cls.classFeature),
    sub?.foundation && `${sub.name} · Foundation — ${line(sub.foundation)}`,
    upgrades >= 1 && sub?.specialization && `${sub.name} · Specialization — ${line(sub.specialization)}`,
    upgrades >= 2 && sub?.mastery && `${sub.name} · Mastery — ${line(sub.mastery)}`,
    secondClass && `Multiclass · ${secondClass.name} — ${line(secondClass.hopeFeature)}`, ...kept].filter(Boolean).join('\n\n');
  Object.assign(f, { chosen_path: 'Awakened', a_featname: text(cls.hopeFeature?.name), a_feattext: text(cls.hopeFeature?.text), s_featname: '', s_feattext: '', s_learned_moves: '', s_anchor: '', s_honed: '', s_active_move: '', s_active_move_text: '' });
  if (sub?.trait || cls.spellcastTrait) f.signature_trait = text(sub?.trait || cls.spellcastTrait);
  // The Vault and Loadout open with the starter pair. A Dormant multiclass Domain becomes active,
  // without starter Powers of its own.
  for (const key of Object.keys(f).filter(k => /^a_pwr_\d+_/.test(k))) delete f[key];
  starter.forEach((p, i) => Object.assign(f, { [`a_pwr_${i}_n`]: p.n, [`a_pwr_${i}_d`]: [p.d, `L${p.l}`, p.t, p.cost, p.dc].filter(Boolean).join(' · ') + `\n${text(p.txt)}`, [`a_pwr_${i}_rc`]: text(p.rc ?? 0) }));
  if (multi) { multi.dormant = false; summary.push(`El Dominio latente ${multi.domain} pasa a estar activo`); }
  f.a_domain_ref = [domains.join(' & '), veilAlignment && cls.id === 'mystic' && `Veil Alignment — ${veilAlignment}`, multi && `Multiclass Domain — ${multi.domain}`].filter(Boolean).join(' · ');
  f.a_loadout_cap = String(4 + tierOf(level)); f.a_vault = text(f.a_vault);
  summary.push(`Loadout inicial: ${starter.map(p => p.n).join(' y ')}`);
  // Slots spent on the Sleeping engine are refunded to be re-spent as an Awakened character.
  const refund = adv.sleepingSlots || 0;
  adv.refundSlots = (adv.refundSlots || 0) + refund; adv.sleepingSlots = 0; adv.temperedResolve = false;
  if (refund) summary.push(`${refund} Advancement Slot${refund === 1 ? '' : 's'} devuelto${refund === 1 ? '' : 's'} para volver a gastar`);
  adv.log = [...adv.log, { level, tier: tierOf(level), summary }].slice(-20);
  token.advancement = adv;
  return { token, summary };
}
