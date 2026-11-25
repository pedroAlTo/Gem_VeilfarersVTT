// Weapon tags (V3): a weapon's properties as a canonical list, the one the rules read.
// "Reliable", "Armor Piercing (2)", "Paired+2", "Reach 2m" → ["reliable", "armor-piercing:2",
// "paired:2", "reach:2"]. A weapon keeps its descriptive Features text; the tags decide.
// Older weapons without tags get them once from their Features list, read as a list of names
// (separated by "," or ";", the name before ":" or "("), never by searching words in a text.

// The Weapon Features Glossary (Corebook 12.06, ch. 13) and the property glossary of Rust & Steel
// 12.06 (2.6, ch. 3-5 and 17), with the rule of each in weaponGlossary.json; and the descriptive
// properties of the table's own weapons (homebrew).
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
  // Rust & Steel 12.06: the new properties and the compatibility spellings it gives a Core meaning.
  anchoring: 'Anchoring', arc: 'Arc', biometric: 'Biometric', 'charge-up': 'Charge-Up', collapsible: 'Collapsible', defensive: 'Defensive',
  disruptor: 'Disruptor', fragile: 'Fragile', 'high-recoil': 'High-Recoil', indirect: 'Indirect', intimidating: 'Intimidating',
  knockdown: 'Knockdown', loud: 'Loud', melting: 'Melting', 'non-lethal': 'Non-Lethal', overcharge: 'Overcharge', returning: 'Returning',
  scatter: 'Scatter', 'self-repairing': 'Self-Repairing', spray: 'Spray', sundering: 'Sundering', 'sustained-fire': 'Sustained Fire',
  thermal: 'Thermal', unstable: 'Unstable', unwieldy: 'Unwieldy', shield: 'Shield', set: 'Set', garrote: 'Garrote', emp: 'EMP',
  'anti-psionic': 'Anti-Psionic', temporal: 'Temporal', scope: 'Scope', 'two-handed': 'Two-Handed', heavy: 'Heavy', finesse: 'Finesse',
  range: 'Range', thrown: 'Thrown', curse: 'Curse',
  // Rust & Steel 12.06, Forbidden weapons (ch. 17).
  'lethal-toxin': 'Lethal Toxin', irradiating: 'Irradiating', shred: 'Shred', untraceable: 'Untraceable', volatile: 'Volatile',
  agony: 'Agony', torture: 'Torture', disintegrate: 'Disintegrate', 'black-hole': 'Black Hole', catastrophic: 'Catastrophic',
  cursed: 'Cursed', assassination: 'Assassination', plague: 'Plague', genocide: 'Genocide', horrifying: 'Horrifying',
  disabling: 'Disabling', 'anti-tech': 'Anti-Tech', 'neural-link': 'Neural-Link', 'one-use': 'One-Use', lingering: 'Lingering',
  forbidden: 'Forbidden', precursor: 'Precursor', radiation: 'Radiation',
  // Domain Powers that give a weapon (v2.52.0): Biomorphic Arsenal's Toxin Glands.
  toxin: 'Toxin',
  // The table's own weapons (homebrew): descriptive, without a rule in the books.
  'resonancia-sismica': 'Resonancia sísmica', shrewd: 'Shrewd', 'despliegue-rapido': 'Despliegue en fracción de segundo',
};

// Other spellings of the same tag. Rust & Steel 12.06 («Core Rules properties»): Brutal means
// Devastating, Stun means Stunning, Blast (band) and Area (band) are the Explosive procedure in
// that band, Cone uses the Spray procedure, AP (N) is Armor Piercing N; Persistent is Lingering 3.
// The table's Spanish weapons: «Piercing» is Armor Piercing, «Oculta en extremidad» and «Implante
// subdérmico» are Concealable, «Corte de fase» (a Void blade that ignores an Armor Slot) is
// Phasing and «Veneno paralizante en crítico» is Stunning on crit.
const ALIASES = {
  'energy-tag': 'energy', bleeding: 'bleed', 'poison-special': 'poison', 'reach-2m': 'reach', brutal: 'devastating', stun: 'stunning',
  blast: 'area', cone: 'spray', ap: 'armor-piercing', piercing: 'armor-piercing', 'one-shot': 'one-use', persistent: 'lingering:3',
  'stunning-en-critico': 'stunning-on-crit', 'oculta-en-extremidad': 'concealable', 'implante-subdermico': 'concealable',
  'corte-de-fase': 'phasing', 'veneno-paralizante-en-critico': 'stunning-on-crit', 'despliegue-en-fraccion-de-segundo': 'despliegue-rapido',
};
// Properties whose value is a range band («Area Close», «Range (Medium)», «Reach Very Close»).
const BAND_TAGS = new Set(['area', 'blast', 'range', 'reach', 'thrown']);
const BANDS = ['very-close', 'very-far', 'melee', 'close', 'medium', 'far'];

const slug = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const TAG_RE = /^[a-z0-9-]{1,40}(?::[a-z0-9.+-]{1,20})?$/;

// A tag as the rules know it: aliases resolved, and a run-on spelling from older sheets
// («armor-piercing-3», «area-close», «phasing-ignora-1-slot-de-armadura») read back as the
// property it starts with and its value.
export function canonicalTag(tag) {
  const [rawId, rawValue = ''] = String(tag ?? '').split(':');
  let id = rawId, value = rawValue;
  const alias = ALIASES[id];
  if (alias) { const [a, v] = alias.split(':'); id = a; value = value || v || ''; }
  if (!WEAPON_TAGS[id]) {
    const base = Object.keys(WEAPON_TAGS).concat(Object.keys(ALIASES)).filter(k => id.startsWith(k + '-')).sort((a, b) => b.length - a.length)[0];
    if (base) {
      const rest = id.slice(base.length + 1), resolved = canonicalTag(base);
      const [bid, bvalue = ''] = resolved.split(':');
      id = bid;
      value = value || (/^\d+(?:\.\d+)?$/.test(rest) || BANDS.includes(rest) && BAND_TAGS.has(base) ? rest : bvalue);
    }
  }
  return value ? `${id}:${value}` : id;
}

// The commas between properties, not those inside a parenthesis («Reliable (fiable en barro,
// lluvia y vacío)» is one property).
function splitProperties(text) {
  const out = []; let depth = 0, part = '';
  for (const ch of String(text ?? '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (!depth && /[;,\n]/.test(ch)) { out.push(part); part = ''; } else part += ch;
  }
  return [...out, part];
}

// One listed property → its tag ("Armor Piercing (2)" → "armor-piercing:2"); null if empty.
export function tagFrom(entry) {
  const raw = String(entry ?? '').replace(/\*+/g, '').replace(/^\[|\]$/g, '').trim();
  if (!raw) return null;
  const head = raw.split(':')[0].trim();
  const paren = head.match(/\(([^)]*)\)/)?.[1]?.trim() || '';
  let value = paren.match(/^\+?(\d+(?:\.\d+)?)$/)?.[1] || head.match(/\+(\d+)\s*$/)?.[1] || head.match(/\b(\d+)\s*m\b/i)?.[1] || '';
  let name = head.replace(/\(.*?\)/g, '').replace(/\+\d+\s*$/, '').replace(/\b\d+\s*m\b/i, '').trim();
  // «Armor Piercing 3», «Lingering 2»: the number after the name.
  const trailing = name.match(/^(.+?)\s+(\d+)$/);
  if (trailing && !value) { name = trailing[1]; value = trailing[2]; }
  let id = slug(name);
  if (!id) return null;
  // «Area Close», «Reach Very Close», «Blast (Close)», «Range (Medium)»: the band is the value.
  const bandAt = BANDS.find(b => id.endsWith('-' + b) && BAND_TAGS.has(id.slice(0, -b.length - 1)));
  if (bandAt && !value) { id = id.slice(0, -bandAt.length - 1); value = bandAt; }
  if (BAND_TAGS.has(id) && !value && BANDS.includes(slug(paren))) value = slug(paren);
  const tag = canonicalTag(value ? `${id}:${value}` : id);
  return tag;
}

// A Features list (array, or text with "," / ";" between properties) → tags, without repeats.
export function tagsFromFeatures(features) {
  const parts = Array.isArray(features) ? features : splitProperties(features);
  const out = [];
  for (const part of parts) {
    const tag = tagFrom(part);
    if (tag && TAG_RE.test(tag) && !out.some(t => t.split(':')[0] === tag.split(':')[0])) out.push(tag);
  }
  return out.slice(0, 30);
}

export const validTags = tags => Array.isArray(tags) && tags.length <= 30 && tags.every(t => typeof t === 'string' && TAG_RE.test(t));

// The weapon's tags: its own list, or (older weapons) the one read from its Features.
export const weaponTagList = weapon => (Array.isArray(weapon?.tags) ? [...new Set(weapon.tags.map(canonicalTag))] : tagsFromFeatures(weapon?.features));
export const hasTag = (weapon, id) => weaponTagList(weapon).some(t => t === id || t.startsWith(id + ':'));
export function tagValue(weapon, id, fallback = 0) {
  const tag = weaponTagList(weapon).find(t => t.startsWith(id + ':'));
  return tag ? Number(tag.split(':')[1]) || fallback : hasTag(weapon, id) ? fallback : 0;
}
// «armor-piercing:2» → «Armor Piercing 2», «area:very-close» → «Area (Very Close)», «paired:2» → «Paired +2».
const bandLabel = value => value.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
export const tagLabel = tag => {
  const [id, value] = canonicalTag(tag).split(':'), name = WEAPON_TAGS[id] || id;
  if (!value) return name;
  if (BANDS.includes(value)) return `${name} (${bandLabel(value)})`;
  return `${name} ${['paired', 'defensive'].includes(id) ? '+' : ''}${value}`;
};
// "Reliable, Armor Piercing 2" → tags, for the equipment editor.
export const parseTagInput = text => tagsFromFeatures(String(text ?? '').replace(/\b(\w[\w -]*?)\s+(\d+)\b/g, '$1 ($2)'));
