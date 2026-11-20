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
