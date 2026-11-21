import { isBestiaryPortrait, bestiaryPortrait } from './bestiaryPortraits.js';

/**
 * Token Avatar Resolver for Veilfarers VTT.
 * Maps character ancestries, archetypes (warrior, mystic, scoundrel, engineer)
 * and genders to canonical high-resolution token portraits.
 */

export const ANCESTRY_IDS = [
  'ailuran',
  'bloomstrider',
  'celestiari',
  'ethereal',
  'human',
  'kryllian',
  'kryx',
  'rift_spinner',
  'synthetic',
];

export const TOKEN_CLASSES = ['diplomat', 'engineer', 'explorer', 'mystic', 'pilot', 'scholar', 'scoundrel', 'soldier', 'vanguard'];
export const PORTRAIT_GENDERS = ['m', 'f', 'n'];
const classAliases = {
  diplomático: 'diplomat', diplomática: 'diplomat', ingeniero: 'engineer', ingeniera: 'engineer',
  explorador: 'explorer', exploradora: 'explorer', místico: 'mystic', mística: 'mystic',
  piloto: 'pilot', erudito: 'scholar', erudita: 'scholar', pícaro: 'scoundrel', pícara: 'scoundrel',
  soldado: 'soldier', vanguardia: 'vanguard',
};
const archetypeClasses = { warrior: 'soldier', mystic: 'mystic', scoundrel: 'scoundrel', engineer: 'engineer' };

export function classPortraitPath(ancestry, cls, gender) {
  return '/assets/tokens/classes/' + ancestry + '-' + cls + '-' + gender + '.svg';
}

export const ARCHETYPES = ['warrior', 'mystic', 'scoundrel', 'engineer'];

export const ARCHETYPE_META = Object.freeze({
  warrior: {
    id: 'warrior',
    label: 'Guerrero / Vanguard',
    description: 'Soldado, combatiente acorazado y especialista en primera línea',
  },
  mystic: {
    id: 'mystic',
    label: 'Erudito / Mago',
    description: 'Místico del Velo, erudito psiónico y canalizador',
  },
  scoundrel: {
    id: 'scoundrel',
    label: 'Pícaro / Explorador',
    description: 'Explorador sigiloso, infiltrador y acechador del vacío',
  },
  engineer: {
    id: 'engineer',
    label: 'Técnico / Científico',
    description: 'Ingeniero de sistemas, artífice, forjador y diplomático',
  },
});

const fieldClasses = new Set(['soldier', 'vanguard', 'scoundrel', 'explorer']);

export function crewPortraitPath(ancestry, gender, cls) {
  const variant = gender === 'n' ? 'n' : gender + (fieldClasses.has(cls) ? '-field' : '-station');
  return '/assets/tokens/crew/' + ancestry + '-' + variant + '.webp';
}

export const ANCESTRY_TOKEN_AVATARS = Object.freeze(Object.fromEntries(
  ANCESTRY_IDS.map(id => [id, Object.fromEntries(PORTRAIT_GENDERS.map(gender => [gender, crewPortraitPath(id, gender)]))])
));

export function normalizeAncestryId(species = '') {
  const s = String(species || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_\s]+/g, '');
  if (/ailure?an/.test(s)) return 'ailuran';
  if (s.includes('bloom') || s.includes('strider')) return 'bloomstrider';
  if (s.includes('celestiari') || s.includes('celest')) return 'celestiari';
  if (s.includes('ethereal') || s.includes('etere')) return 'ethereal';
  if (s.includes('human')) return 'human';
  if (s.includes('kryllian') || s.includes('kryll')) return 'kryllian';
  if (s.includes('kryx')) return 'kryx';
  if (s.includes('rift') || s.includes('spinner') || s.includes('tejed')) return 'rift_spinner';
  if (s.includes('synth') || s.includes('sintet') || s.includes('androide')) return 'synthetic';
  return 'human';
}

export function portraitGender(value) {
  const p = typeof value === 'string' ? value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
  if (/^(n|nb|x)$/.test(p) || /\b(non[- ]?binary|no[- ]?binari[oaex]|neutral|neutr[oa]|agender|agenero)\b/.test(p)) return 'n';
  if (/^f$/.test(p) || /\b(she|her|hers|ella|ellas|femenin[oa]|fem|mujer|female|feminine|hembra|chica|dame)\b/.test(p)) return 'f';
  if (/^m$/.test(p) || /\b(he|him|his|el|ellos|masculin[oa]|masc|hombre|male|masculine|macho|chico|sir)\b/.test(p)) return 'm';
  return /\b(they|them|their|elle|elles)\b/.test(p) ? 'n' : '';
}

export function sheetGender(...sources) {
  for (const source of sources) {
    for (const key of ['gender', 'sex', 'sexo', 'género', 'genero', 'character_gender']) {
      const gender = portraitGender(source?.[key]);
      if (gender) return gender;
    }
  }
  return '';
}

export function sheetPronouns(...sources) {
  for (const source of sources) {
    for (const key of ['pron', 'pronouns', 'pronombres']) {
      if (typeof source?.[key] === 'string' && source[key].trim()) return source[key].trim();
    }
  }
  return '';
}

export function detectGender(identity = '', name = '') {
  const known = portraitGender(identity);
  if (known) return known;
  // Published pregens and legacy sheets with no identity field.
  if (/\b(lucy|jarana|jaraña|vea|elena)\b/i.test(name)) return 'f';
  if (/\b(brok|miles|harker|marcus)\b/i.test(name)) return 'm';
  return 'n';
}

export function detectArchetype(roleOrClass = '') {
  const s = String(roleOrClass || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/mistic|mystic|mago|psion|scholar|erudit|sage|seer|conduit|void|healer|curand/i.test(s)) {
    return 'mystic';
  }
  if (/picar|scoundrel|explor|rogue|scout|infiltr|shadow|stealth|stalk|acechad|ladron|thief|sniper|ranger/i.test(s)) {
    return 'scoundrel';
  }
  if (/ingen|engineer|tecn|tech|cientif|mechan|artisan|diplomat|forg|maker|hack|pilot/i.test(s)) {
    return 'engineer';
  }
  if (/sold|vanguard|guerr|combat|peacekeep|blade|guard|juggernaut|pesad|tank|bruis/i.test(s)) {
    return 'warrior';
  }
  return 'warrior';
}

export function getArchetypeTokenAvatar(species, archetype, gender = 'n') {
  const ancestry = normalizeAncestryId(species);
  const arch = ARCHETYPES.includes(archetype) ? archetype : 'warrior';
  return classPortraitPath(ancestry, archetypeClasses[arch], PORTRAIT_GENDERS.includes(gender) ? gender : 'n');
}

export function listAncestryArchetypeTokens(species, pronouns, name) {
  const ancestry = normalizeAncestryId(species);
  const gender = detectGender(pronouns, name);
  return ARCHETYPES.map(arch => ({
    id: arch,
    ...ARCHETYPE_META[arch],
    avatarUrl: getArchetypeTokenAvatar(ancestry, arch, gender),
  }));
}

export function defaultTokenAvatar(species, pronouns, name, roleOrClass = '') {
  const ancestry = normalizeAncestryId(species);
  const gender = detectGender(pronouns, name);
  if (roleOrClass) {
    const words = String(roleOrClass).toLowerCase().match(/[\p{L}]+/gu) || [];
    const cls = words.map(w => classAliases[w] || w).find(w => TOKEN_CLASSES.includes(w));
    return cls ? classPortraitPath(ancestry, cls, gender) : getArchetypeTokenAvatar(ancestry, detectArchetype(roleOrClass), gender);
  }
  return ANCESTRY_TOKEN_AVATARS[ancestry][gender];
}

const TOKEN_DIR = '/assets/tokens/';
const MARKER = TOKEN_DIR + 'adversary-marker.svg';
const techInsignia = '/assets/cards/domain-tech-flag.png';
const bestiaryArt = new Map([
  ['rogue synthetic', TOKEN_DIR + 'synthetic_n.jpg'],
  ['volkov enforcer', classPortraitPath('kryx', 'soldier', 'n')],
  ['the biomancer', TOKEN_DIR + 'kryllian_n.jpg'],
  ['the ascended', TOKEN_DIR + 'celestiari_n.jpg'],
  ['the whispering monk (precursor expert)', crewPortraitPath('rift_spinner', 'n')],
  ['precursor drone', techInsignia],
]);
const namedPortraits = [
  [/^(?:(?:capt\.?|captain)\s+)?(?:jonathan\s+)?harker$/i, 'captain_harker.jpg'], [/\bvea kaelen\b/i, 'pilot_vea.jpg'],
  [/\bhe[- ]?09\b/i, 'engineer_he09.jpg'], [/^void (?:horror )?stalker$/i, 'void_stalker.jpg'],
];
const legacyPortrait = new RegExp('^/assets/tokens/(?:' + ANCESTRY_IDS.join('|') + ')(?:_(?:' + ARCHETYPES.join('|') + '))?_[mfn]\\.jpg$');

export function customTokenPortrait(token) {
  const url = token?.avatarUrl;
  if (!url || typeof url !== 'string' || url === MARKER || url === TOKEN_DIR + 'synthetic_infiltrator_echo.jpg') return '';
  if (token.portraitOverride === true) return url;
  if (isBestiaryPortrait(url)) return '';
  if (url === techInsignia && (token.isPlayer === false || token.actorType === 'adversary') && bestiaryPortrait(token.name)) return '';
  if (namedPortraits.some(([, file]) => url === TOKEN_DIR + file)) return '';
  return url.startsWith(TOKEN_DIR + 'classes/') || url.startsWith(TOKEN_DIR + 'crew/') || legacyPortrait.test(url) ? '' : url;
}

export function actorPortrait(token = {}) {
  const custom = customTokenPortrait(token);
  if (custom) return custom;
  const doc = token.sourceCharacter?.document;
  const fields = doc?.fields || {};
  const identity = sheetGender(token, fields, doc) || sheetPronouns(token, fields, doc);
  const named = namedPortraits.find(([pattern]) => pattern.test(token.name || ''));
  const expectedGender = named?.[1] === 'captain_harker.jpg' ? 'm' : named?.[1] === 'pilot_vea.jpg' ? 'f' : '';
  if (named && (!expectedGender || !portraitGender(identity) || portraitGender(identity) === expectedGender) && (token.avatarUrl === TOKEN_DIR + named[1] || (!token.species && !token.characterClass))) return TOKEN_DIR + named[1];
  if (token.actorType === 'drone') return techInsignia;
  if (token.isPlayer === false || token.actorType === 'adversary') {
    const art = bestiaryPortrait(token.name) || bestiaryArt.get(String(token.name || '').trim().toLowerCase());
    if (art) return art;
    if (isBestiaryPortrait(token.avatarUrl)) return token.avatarUrl;
  }
  const species = token.species || token.ancestry || fields.ancestry;
  if (!species && (token.isPlayer === false || ['adversary', 'npc'].includes(token.actorType))) return MARKER;
  const style = token.tokenArchetype || fields.token_archetype;
  if (ARCHETYPES.includes(style)) return getArchetypeTokenAvatar(species, style, detectGender(identity, token.name));
  return defaultTokenAvatar(species, identity, token.name, token.characterClass || token.class || fields.class || token.roleTag);
}
