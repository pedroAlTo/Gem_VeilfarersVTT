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

  // Common feminine or masculine name cues if pronouns are empty/neutral
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

  return 'm';
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
  const g = ['m', 'f'].includes(gender) ? gender : 'm';
  return `/assets/tokens/${ancestry}_${arch}_${g}.jpg`;
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
    const arch = detectArchetype(roleOrClass);
    return getArchetypeTokenAvatar(ancestry, arch, gender);
  }
  const pair = ANCESTRY_TOKEN_AVATARS[ancestry] || ANCESTRY_TOKEN_AVATARS.human;
  return pair[gender] || pair.m;
}
