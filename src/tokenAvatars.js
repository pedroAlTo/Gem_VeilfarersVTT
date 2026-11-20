import { isTierOnePortrait, tierOnePortrait } from './bestiaryPortraits.js';

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

export const ANCESTRY_TOKEN_AVATARS = Object.freeze({
  ailuran: {
    m: '/assets/tokens/ailuran_m.jpg',
    f: '/assets/tokens/ailuran_f.jpg',
  },
  bloomstrider: {
    m: '/assets/tokens/bloomstrider_m.jpg',
    f: '/assets/tokens/bloomstrider_f.jpg',
  },
  celestiari: {
    m: '/assets/tokens/celestiari_m.jpg',
    f: '/assets/tokens/celestiari_f.jpg',
  },
  ethereal: {
    m: '/assets/tokens/ethereal_m.jpg',
    f: '/assets/tokens/ethereal_f.jpg',
  },
  human: {
    m: '/assets/tokens/human_m.jpg',
    f: '/assets/tokens/human_f.jpg',
  },
  kryllian: {
    m: '/assets/tokens/kryllian_m.jpg',
    f: '/assets/tokens/kryllian_f.jpg',
  },
  kryx: {
    m: '/assets/tokens/kryx_m.jpg',
    f: '/assets/tokens/kryx_f.jpg',
  },
  rift_spinner: {
    m: '/assets/tokens/rift_spinner_m.jpg',
    f: '/assets/tokens/rift_spinner_f.jpg',
  },
  synthetic: {
    m: '/assets/tokens/synthetic_m.jpg',
    f: '/assets/tokens/synthetic_f.jpg',
  },
});

export function normalizeAncestryId(species = '') {
  const s = String(species || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_\s]+/g, '');
  if (s.includes('ailuran')) return 'ailuran';
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

export function detectGender(pronouns = '', name = '') {
  const p = String(pronouns || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/^(f|female)$/i.test(p) || /\b(she|her|hers|ella|ellas|femenino|fem|mujer|female|chica|dame)\b/i.test(p)) {
    return 'f';
  }
  if (/^(m|male)$/i.test(p) || /\b(he|him|his|el|ellos|masculino|masc|hombre|male|chico|sir)\b/i.test(p)) {
    return 'm';
  }

  if (/^(n|nb)$/.test(p) || /\b(they|them|elle|elles|non[- ]?binary|neutral|neutro|no binari[oa])\b/.test(p)) return 'n';

  // Name cues for older sheets that did not record pronouns.
  const n = String(name || '').trim().toLowerCase();
  if (/\b(lucy|jarana|jaraña|vea|maren|sarah|elena|maria|kira|valeria|anya|chloe|zoe|eva|clara)\b/i.test(n)) {
    return 'f';
  }
  if (/\b(brok|miles|harker|kovacs|tarek|arun|viktor|marcus|dante|alex|leo|sam)\b/i.test(n)) {
    return 'm';
  }

  // Morphological gender heuristic (e.g. Spanish -a feminine, -o masculine)
  if (/[aá]$/i.test(n) && !/^(luca|sasha|eliah)$/i.test(n)) {
    return 'f';
  }
  if (/[oó]$/i.test(n)) {
    return 'm';
  }

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

export function getArchetypeTokenAvatar(species, archetype, gender = 'm') {
  const ancestry = normalizeAncestryId(species);
  const arch = ARCHETYPES.includes(archetype) ? archetype : 'warrior';
  return classPortraitPath(ancestry, archetypeClasses[arch], PORTRAIT_GENDERS.includes(gender) ? gender : 'm');
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
  return gender === 'n' ? '/assets/tokens/' + ancestry + '_n.jpg' : ANCESTRY_TOKEN_AVATARS[ancestry][gender];
}

const TOKEN_DIR = '/assets/tokens/';
const MARKER = TOKEN_DIR + 'adversary-marker.svg';
const techInsignia = '/assets/cards/domain-tech-flag.png';
const bestiaryArt = new Map([
  ['rogue synthetic', TOKEN_DIR + 'synthetic_n.jpg'],
  ['volkov enforcer', classPortraitPath('kryx', 'soldier', 'n')],
  ['the biomancer', TOKEN_DIR + 'kryllian_n.jpg'],
  ['the ascended', TOKEN_DIR + 'celestiari_n.jpg'],
  ['the whispering monk (precursor expert)', TOKEN_DIR + 'rift_spinner_n.jpg'],
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
  if (isTierOnePortrait(url)) return '';
  if (url === techInsignia && (token.isPlayer === false || token.actorType === 'adversary') && tierOnePortrait(token.name)) return '';
  if (namedPortraits.some(([, file]) => url === TOKEN_DIR + file)) return '';
  return url.startsWith(TOKEN_DIR + 'classes/') || legacyPortrait.test(url) ? '' : url;
}

export function actorPortrait(token = {}) {
  const custom = customTokenPortrait(token);
  if (custom) return custom;
  const named = namedPortraits.find(([pattern]) => pattern.test(token.name || ''));
  if (named && (token.avatarUrl === TOKEN_DIR + named[1] || (!token.species && !token.characterClass))) return TOKEN_DIR + named[1];
  if (token.actorType === 'drone') return techInsignia;
  if (token.isPlayer === false || token.actorType === 'adversary') {
    const art = tierOnePortrait(token.name) || bestiaryArt.get(String(token.name || '').trim().toLowerCase());
    if (art) return art;
    if (isTierOnePortrait(token.avatarUrl)) return token.avatarUrl;
  }
  const fields = token.sourceCharacter?.document?.fields || {};
  const species = token.species || token.ancestry || fields.ancestry;
  if (!species && (token.isPlayer === false || ['adversary', 'npc'].includes(token.actorType))) return MARKER;
  const pronouns = token.gender || token.pronouns || token.pron || (token.pronouns == null ? fields.gender || fields.pron || fields.pronouns : '');
  const style = token.tokenArchetype || fields.token_archetype;
  if (ARCHETYPES.includes(style)) return getArchetypeTokenAvatar(species, style, detectGender(pronouns, token.name));
  return defaultTokenAvatar(species, pronouns, token.name, token.characterClass || token.class || fields.class || token.roleTag);
}
