import { ANCESTRY_IDS, TOKEN_CLASSES, PORTRAIT_GENDERS, classPortraitPath, crewPortraitPath } from './tokenAvatars.js';
import { TIER_ONE_PORTRAITS, TIER_TWO_PORTRAITS } from './bestiaryPortraits.js';

export const ancestryNames = {
  ailuran: 'Ailurean', bloomstrider: 'Bloomstrider', celestiari: 'Celestiari', ethereal: 'Ethereal',
  human: 'Human', kryllian: 'Kryllian', kryx: 'Kryx', rift_spinner: 'Rift Spinner', synthetic: 'Synthetic',
};
const labels = { m: 'Masculino', f: 'Femenino', n: 'Neutro' };
export function portraitChoices(collection, cls = '') {
  if (collection === 'bestiary-2') return TIER_TWO_PORTRAITS;
  if (collection === 'bestiary') return TIER_ONE_PORTRAITS;
  if (collection === 'crew') return [
    ['captain_harker.jpg', 'Capt. Harker'], ['pilot_vea.jpg', 'Vea Kaelen'],
    ['engineer_he09.jpg', 'HE-09'], ['void_stalker.jpg', 'Void Stalker'],
  ].map(([file, name]) => ({ name, url: '/assets/tokens/' + file }));
  if (!ANCESTRY_IDS.includes(collection)) return [];
  if (TOKEN_CLASSES.includes(cls)) return PORTRAIT_GENDERS.map(gender => ({
    name: labels[gender], url: classPortraitPath(collection, cls, gender),
  }));
  return [['f', 'soldier'], ['m', 'soldier'], ['f', 'pilot'], ['m', 'pilot'], ['n', '']].map(([gender, role]) => ({
    name: labels[gender] + (role === 'soldier' ? ' · Campo' : role ? ' · Estación' : ''),
    url: crewPortraitPath(collection, gender, role),
  }));
}
const presets = new Map();
for (const collection of ['bestiary', 'bestiary-2', 'crew', ...ANCESTRY_IDS]) {
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
