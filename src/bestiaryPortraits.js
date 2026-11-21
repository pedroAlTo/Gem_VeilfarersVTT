const directory = '/assets/tokens/bestiary/tier-1/';

// These filenames go to players even when the Keeper conceals the contact's name.
// Keep them independent of both the creature's name and the order of the menu.
export const TIER_ONE_PORTRAITS = [
  ['01', 'Charon Skitter-Rat Swarm'],
  ['02', 'Void Leech'],
  ['03', 'Cinder-Mite'],
  ['04', 'Security Drone Model-V'],
  ['05', 'Neon Jelly'],
  ['06', 'Scrap-Ghoul'],
  ['07', 'Void Mite Cluster'],
  ['08', 'Scrap Drone'],
  ['09', 'The Rust-King'],
  ['10', 'Unit 734 “The Loader”'],
  ['11', 'The Alpha Xenowolf'],
  ['12', 'Hunger Weaver'],
  ['13', 'Weaver Queen'],
].map(([id, name]) => ({ name, url: directory + id + '.webp' }));

function nameKey(name) {
  return String(name || '').split(/\(|\bENCOUNTER TYPE:/i, 1)[0]
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');
}

const byName = new Map(TIER_ONE_PORTRAITS.map(portrait => [nameKey(portrait.name), portrait.url]));
byName.set('skitter rat swarm', byName.get('charon skitter rat swarm'));
const urls = new Set(byName.values());

export function tierOnePortrait(name) {
  return byName.get(nameKey(name)) || '';
}

export function isTierOnePortrait(url) {
  return urls.has(url);
}

export const TIER_TWO_PORTRAITS = [
  { name: 'Silent Gloomfang', url: '/assets/tokens/bestiary/tier-2/01.webp' },
  { name: 'Void Leech Swarm', url: '/assets/tokens/bestiary/tier-2/02.webp' },
  { name: 'Rust Hulk', url: '/assets/tokens/bestiary/tier-2/03.webp' },
  { name: 'Cult Zealot', url: '/assets/tokens/bestiary/tier-2/04.webp' },
  { name: 'Wraith-Touched', url: '/assets/tokens/bestiary/tier-2/05.webp' },
  { name: 'House Joric Marine', url: '/assets/tokens/bestiary/tier-2/06.webp' },
  { name: 'Gloomfang', url: '/assets/tokens/bestiary/tier-2/07.webp' },
  { name: 'Glass Weaver', url: '/assets/tokens/bestiary/tier-2/08.webp' },
  { name: 'Rogue Synthetic', url: '/assets/tokens/bestiary/tier-2/09.webp' },
  { name: 'Phase-Stalker', url: '/assets/tokens/bestiary/tier-2/10.webp' },
  { name: 'Volkov Enforcer', url: '/assets/tokens/bestiary/tier-2/11.webp' },
  { name: 'Mama K', url: '/assets/tokens/bestiary/tier-2/12.webp' },
  { name: 'The Whispering Monk', url: '/assets/tokens/bestiary/tier-2/13.webp' },
  { name: 'Sly Marlo', url: '/assets/tokens/bestiary/tier-2/14.webp' },
  { name: 'The Void-Caller', url: '/assets/tokens/bestiary/tier-2/15.webp' },
  { name: 'The “Chimera” Stealth Tank', url: '/assets/tokens/bestiary/tier-2/16.webp' },
  { name: 'The Dual-Minded Psion', url: '/assets/tokens/bestiary/tier-2/17.webp' },
  { name: 'The Corporate Negotiator', url: '/assets/tokens/bestiary/tier-2/18.webp' },
];
const tierTwo = new Map(TIER_TWO_PORTRAITS.map(p => [nameKey(p.name), p.url]));
const tierTwoUrls = new Set(tierTwo.values());
export const bestiaryPortrait = name => tierOnePortrait(name) || tierTwo.get(nameKey(name)) || '';
export const isBestiaryPortrait = url => isTierOnePortrait(url) || tierTwoUrls.has(url);
