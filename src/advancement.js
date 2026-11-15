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

function raiseExperiences(token, keys, summary, label) {
  const slots = experienceSlots(token), f = writable(token);
  const distinct = slots.length >= 2;
  if (keys.length !== 2 || (distinct && keys[0] === keys[1])) throw new Error(`${label}: elige dos Experiencias${distinct ? ' distintas' : ''}.`);
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
export function applyLevelUp(source, { picks = [], achievementExperiences = [], allowUnspent = false } = {}) {
  const token = structuredClone(source), level = token.level || 1, next = level + 1, tier = tierOf(next);
  if (token.actorType === 'adversary' || token.isPlayer === false) throw new Error('Solo los personajes jugadores suben de nivel.');
  if (level >= MAX_LEVEL) throw new Error(`El nivel máximo es ${MAX_LEVEL}.`);
  const chosen = picks.map(p => ({ ...p, option: option(p.id) }));
  if (chosen.some(p => !p.option)) throw new Error('Opción de avance desconocida.');
  const spent = chosen.reduce((n, p) => n + p.option.slots, 0);
  if (spent > 2) throw new Error('Cada nivel da dos Advancement Slots.');
  if (spent < 2 && !allowUnspent) throw new Error('Quedan Advancement Slots sin gastar. Los que no se usen se pierden: confírmalo para continuar.');
  if (new Set(chosen.map(p => p.id)).size !== chosen.length) throw new Error('Las dos opciones de un Slot deben ser distintas.');
  for (const p of chosen) { const why = optionBlocked(token, p.id, next); if (why) throw new Error(why); }

  const adv = record(token), summary = [], sleeping = token.path === 'Sleeping';
  token.level = next;
  token.hp = { ...token.hp, majorThreshold: (token.hp.majorThreshold || 0) + 1, severeThreshold: (token.hp.severeThreshold || 0) + 1 };
  if (isTierAchievement(next)) {
    if ((token.proficiency || 1) < 6) { token.proficiency = (token.proficiency || 1) + 1; summary.push(`Logro de Tier: Proficiency ${token.proficiency}`); }
    if (experienceSlots(token).length) raiseExperiences(token, achievementExperiences, summary, 'Logro de Tier');
    else summary.push('Logro de Tier: +1 a dos Experiencias (anótalas en la ficha)');
  }
  if (sleeping && RESOLVE_LEVELS.includes(next) && token.resolve && token.resolve.max < 6) { token.resolve = { ...token.resolve, max: token.resolve.max + 1 }; summary.push(`Resolve máximo ${token.resolve.max}`); }

  for (const p of chosen) {
    const note = String(p.note ?? '').trim().slice(0, 200);
    if (p.id === 'hp') { token.hp = { ...token.hp, max: token.hp.max + 1, current: token.hp.current + 1 }; summary.push(`HP máximo ${token.hp.max}`); }
    if (p.id === 'stress') { token.stress = { ...token.stress, max: (token.stress?.max ?? 6) + 1 }; summary.push(`Stress máximo ${token.stress.max}`); }
    if (p.id === 'experiences') raiseExperiences(token, p.experiences || [], summary, 'Slot');
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
      } else summary.push(`${sleeping ? 'Nuevo Resolve Move' : 'Nuevo Poder al Vault'}${note ? `: ${note}` : ''}`);
    }
    if (p.id === 'multiclass') { adv.multiclass = true; summary.push(`Multiclass${note ? `: ${note}` : ''}`); }
    if (p.id === 'subclass') { adv.subclassUpgrades += 1; summary.push(`Subclass: ${adv.subclassUpgrades === 1 ? 'Specialization' : 'Mastery'}${note ? ` · ${note}` : ''}`); }
    if (p.id === 'tempered') { adv.temperedResolve = true; token.resolve = { ...token.resolve, dieType: 'd6' }; summary.push('Tempered Resolve: dado d6'); }
  }
  if (spent < 2) summary.push(`${2 - spent} Advancement Slot sin gastar (perdido)`);
  adv.log = [...adv.log, { level: next, tier, summary }].slice(-20);
  token.advancement = adv;
  return { token, summary };
}
