// Weapon tags (V3): a weapon's properties as a canonical list, the one the rules read.
// "Reliable", "Armor Piercing (2)", "Paired+2", "Reach 2m" → ["reliable", "armor-piercing:2",
// "paired:2", "reach:2"]. A weapon keeps its descriptive Features text; the tags decide.
// Older weapons without tags get them once from their Features list, read as a list of names
// (separated by "," or ";", the name before ":" or "("), never by searching words in a text.

// The Weapon Features Glossary (Corebook ch. 13) and the other tags the catalogs print.
export const WEAPON_TAGS = {
  accurate: 'Accurate', adaptive: 'Adaptive', 'arcing-shot': 'Arcing Shot', area: 'Area', 'armor-piercing': 'Armor Piercing',
  automatic: 'Automatic', bleed: 'Bleed', brittle: 'Brittle', 'burst-fire': 'Burst Fire', cleave: 'Cleave', concealable: 'Concealable',
  continuous: 'Continuous', crushing: 'Crushing', cutting: 'Cutting', 'deployable-cover': 'Deployable Cover', devastating: 'Devastating',
  disintegrating: 'Disintegrating', disorienting: 'Disorienting', 'dispersal-wave': 'Dispersal Wave', energy: 'Energy',
  'energy-surge': 'Energy Surge', entangling: 'Entangling', entrapping: 'Entrapping', existence: 'Existence', explosive: 'Explosive',
  guided: 'Guided', ignite: 'Ignite', lightweight: 'Lightweight', massive: 'Massive', messy: 'Messy', 'mind-link': 'Mind Link',
  'mind-lock': 'Mind-Lock', overheating: 'Overheating', paired: 'Paired', phasing: 'Phasing', poison: 'Poison', powerful: 'Powerful',
  'probability-shift': 'Probability Shift', psionic: 'Psionic', quick: 'Quick', reach: 'Reach', 'reality-shift': 'Reality Shift',
  reliable: 'Reliable', reload: 'Reload', 'salvo-fire': 'Salvo Fire', 'shield-piercing': 'Shield Piercing', shredding: 'Shredding',
  silent: 'Silent', singularity: 'Singularity', 'smart-scope': 'Smart Scope', stable: 'Stable', stagger: 'Stagger', stunning: 'Stunning',
  'stunning-on-crit': 'Stunning on crit', suppressive: 'Suppressive', 'system-shock': 'System Shock', 'taser-charge': 'Taser Charge',
  unraveling: 'Unraveling', vibration: 'Vibration', waveform: 'Waveform',
  // Printed by the catalogs outside the glossary; kept, shown, no automatic rule.
  'two-handed': 'Two-Handed', heavy: 'Heavy', finesse: 'Finesse', 'non-lethal': 'Non-Lethal', thermal: 'Thermal', stun: 'Stun',
  knockdown: 'Knockdown', brutal: 'Brutal', scope: 'Scope', thrown: 'Thrown', blast: 'Blast',
};
// Other spellings of the same tag.
const ALIASES = { 'energy-tag': 'energy', bleeding: 'bleed', 'poison-special': 'poison', 'reach-2m': 'reach' };

const slug = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const TAG_RE = /^[a-z0-9-]{1,40}(?::[a-z0-9.+-]{1,20})?$/;

// One listed property → its tag ("Armor Piercing (2)" → "armor-piercing:2"); null if empty.
export function tagFrom(entry) {
  const raw = String(entry ?? '').replace(/\*+/g, '').trim();
  if (!raw) return null;
  const head = raw.split(':')[0].trim();
  const value = head.match(/\((\d+(?:\.\d+)?)\)/)?.[1] || head.match(/\+(\d+)\s*$/)?.[1] || head.match(/\b(\d+)\s*m\b/i)?.[1] || '';
  const name = head.replace(/\(.*?\)/g, '').replace(/\+\d+\s*$/, '').replace(/\b\d+\s*m\b/i, '').trim();
  let id = slug(name);
  if (!id) return null;
  id = ALIASES[id] || id;
  return value ? `${id}:${value}` : id;
}

// A Features list (array, or text with "," / ";" between properties) → tags, without repeats.
export function tagsFromFeatures(features) {
  const parts = Array.isArray(features) ? features : String(features ?? '').split(/[;,\n]/);
  const out = [];
  for (const part of parts) {
    const tag = tagFrom(part);
    if (tag && TAG_RE.test(tag) && !out.some(t => t.split(':')[0] === tag.split(':')[0])) out.push(tag);
  }
  return out.slice(0, 30);
}

export const validTags = tags => Array.isArray(tags) && tags.length <= 30 && tags.every(t => typeof t === 'string' && TAG_RE.test(t));

// The weapon's tags: its own list, or (older weapons) the one read from its Features.
export const weaponTagList = weapon => (Array.isArray(weapon?.tags) ? weapon.tags : tagsFromFeatures(weapon?.features));
export const hasTag = (weapon, id) => weaponTagList(weapon).some(t => t === id || t.startsWith(id + ':'));
export function tagValue(weapon, id, fallback = 0) {
  const tag = weaponTagList(weapon).find(t => t.startsWith(id + ':'));
  return tag ? Number(tag.split(':')[1]) || fallback : hasTag(weapon, id) ? fallback : 0;
}
export const tagLabel = tag => { const [id, value] = String(tag).split(':'); return `${WEAPON_TAGS[id] || id}${value ? ` ${value}` : ''}`; };
// "Reliable, Armor Piercing 2" → tags, for the equipment editor.
export const parseTagInput = text => tagsFromFeatures(String(text ?? '').replace(/\b(\w[\w -]*?)\s+(\d+)\b/g, '$1 ($2)'));
