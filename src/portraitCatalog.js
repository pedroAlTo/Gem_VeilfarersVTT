import { ANCESTRY_IDS, TOKEN_CLASSES, PORTRAIT_GENDERS, classPortraitPath, crewPortraitPath } from './tokenAvatars.js';
import { TIER_ONE_PORTRAITS, TIER_TWO_PORTRAITS } from './bestiaryPortraits.js';

export const ancestryNames = {
  ailuran: 'Ailurean', bloomstrider: 'Bloomstrider', celestiari: 'Celestiari', ethereal: 'Ethereal',
  human: 'Human', kryllian: 'Kryllian', kryx: 'Kryx', rift_spinner: 'Rift Spinner', synthetic: 'Synthetic',
};
const labels = { m: 'Masculino', f: 'Femenino', n: 'Neutro' };
// The characters the user provided (v2.62.4–v2.62.5, «úsalos también para crear versiones de retrato
// para tokens donde corresponda; si es un kryx, añade el retrato como opción de Kryx»): any token can
// use them; each also appears with the portraits of its ancestry. [file, name, ancestry, group].
// Thumbnails by scripts/token-thumbs.py.
const CHARACTER_PORTRAITS = [
  ['hiv/spark.webp', '“Spark” Meridian Kess', 'human', 'pregens'],
  ['hiv/marcus.webp', 'Marcus “Wall” Steele', 'human', 'pregens'],
  ['hiv/whisper.webp', 'Whisper-of-Ancient-Winds', 'ethereal', 'pregens'],
  ['hiv/lyra.webp', 'Dr. Lyra Voss', 'kryllian', 'pregens'],
  ['hiv/flash.webp', '“Flash” Kira Tal-Ven', 'celestiari', 'pregens'],
  ['hiv/shadow.webp', '“Shadow” Val Corrigan', 'synthetic', 'pregens'],
  ['hiv/kel.webp', 'Kel of the Hollow Channel', 'ailuran', 'pregens'],
  ['hiv/senna.webp', 'Senna of the Quiet Grove', 'bloomstrider', 'pregens'],
  ['hiv/rourke.webp', 'Rourke Ashfang', 'kryx', 'pregens'],
  ['hiv/threnody.webp', 'Threnody-in-Amber', 'rift_spinner', 'pregens'],
  ['hiv/zara.webp', 'Zara “Starwind” Kaine', 'human', 'npc'],
  ['hiv/korren.webp', 'Korren “Iron Hammer” Vex', 'kryllian', 'npc'],
  ['hiv/thex.webp', 'Thex Vain-Glory', 'ethereal', 'npc'],
  ['hiv/brix.webp', 'Brix “Coal-Heart” Stonehammer', 'kryx', 'npc'],
  ['hiv/alexei-civil.webp', 'Alexei Joric', 'human', 'npc'],
  ['hiv/alexei.webp', 'Alexei Joric (uniforme de gala)', 'human', 'npc'],
  ['hiv/silk.webp', 'Madame Silk', 'rift_spinner', 'npc'],
  ['hiv/scalpel.webp', '“Scalpel” Kaine', 'bloomstrider', 'npc'],
  ['hiv/maya.webp', 'Maya Santos', 'human', 'npc'],
  ['hiv/nyx.webp', 'Nyx of the Last Account', 'ailuran', 'npc'],
  ['hiv/maximus-joric.webp', 'Lord Comandante Maximus Joric', 'human', 'npc'],
  ['hiv/lydia-valerius.webp', 'Lydia Valerius', 'human', 'npc'],
  ['hiv/joric-officer.webp', 'Oficial de recuperación Joric', 'human', 'npc'],
  ['hiv/orla-venn.webp', 'Orla Venn', 'human', 'npc'],
  ['hiv/pilot.webp', 'Piloto de carga', 'human', 'npc'],
  ['npc/parel-dho.webp', 'Parel Dho', 'kryllian', 'npc'],
  ['npc/blue-casta.webp', 'Blue Casta', 'celestiari', 'npc'],
].map(([file, name, ancestry, group]) => ({ name, url: '/assets/tokens/' + file, ancestry, group }));
export const NPC_PORTRAITS = CHARACTER_PORTRAITS.filter(p => p.group === 'npc').map(({ name, url }) => ({ name, url }));
export const PREGEN_PORTRAITS = CHARACTER_PORTRAITS.filter(p => p.group === 'pregens').map(({ name, url }) => ({ name, url }));
const ancestryCharacters = ancestry => CHARACTER_PORTRAITS.filter(p => p.ancestry === ancestry).map(({ name, url }) => ({ name, url }));
export function portraitChoices(collection, cls = '') {
  if (collection === 'bestiary-2') return TIER_TWO_PORTRAITS;
  if (collection === 'bestiary') return TIER_ONE_PORTRAITS;
  if (collection === 'npc') return NPC_PORTRAITS;
  if (collection === 'pregens') return PREGEN_PORTRAITS;
  if (collection === 'crew') return [
    ['captain_harker.jpg', 'Capt. Harker'], ['pilot_vea.jpg', 'Vea Kaelen'],
    ['engineer_he09.jpg', 'HE-09'], ['void_stalker.jpg', 'Void Stalker'],
  ].map(([file, name]) => ({ name, url: '/assets/tokens/' + file }));
  if (!ANCESTRY_IDS.includes(collection)) return [];
  if (TOKEN_CLASSES.includes(cls)) return PORTRAIT_GENDERS.map(gender => ({
    name: labels[gender], url: classPortraitPath(collection, cls, gender),
  }));
  return [...[['f', 'soldier'], ['m', 'soldier'], ['f', 'pilot'], ['m', 'pilot'], ['n', '']].map(([gender, role]) => ({
    name: labels[gender] + (role === 'soldier' ? ' · Campo' : role ? ' · Estación' : ''),
    url: crewPortraitPath(collection, gender, role),
  })), ...ancestryCharacters(collection)];
}
const presets = new Map();
for (const collection of ['bestiary', 'bestiary-2', 'crew', ...ANCESTRY_IDS, 'pregens', 'npc']) {
  const classes = ANCESTRY_IDS.includes(collection) ? ['', ...TOKEN_CLASSES] : [''];
  for (const cls of classes) for (const { url } of portraitChoices(collection, cls)) presets.set(url, { collection, cls });
}
export const isPresetPortrait = url => presets.has(url);
// The small image of a preset portrait for the window's grid (v2.61.2, scripts/token-thumbs.py;
// the class portraits' thumbnails come from scripts/token-portraits.mjs). Others stay as they are.
export const portraitThumb = url => isPresetPortrait(url) ? url.replace('/assets/tokens/', '/assets/tokens/thumbs/').replace(/\.(jpe?g|png)$/i, '.webp') : url;
export const presetLocation = url => presets.get(url);

// Only short references may be copied into individual messages, including historical ones.
export function isPortraitReference(url) {
  if (typeof url !== 'string' || !url || url.length > 2048 || /[\s\\\u0000-\u001f]/.test(url)) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; }
}
export function isInlinePortrait(url) {
  return typeof url === 'string' && /^data:image\/(?:webp|jpeg|png|gif|avif);base64,[a-z0-9+/]+=*$/i.test(url);
}
export function isPortraitSource(url) {
  return isPortraitReference(url) || (typeof url === 'string' && url.length <= 180000 && isInlinePortrait(url));
}

export function isPlayerPortrait(url) {
  return isPresetPortrait(url) || (typeof url === 'string' && url.length <= 180000 && isInlinePortrait(url))
    || (isPortraitReference(url) && /^https?:\/\//i.test(url));
}
