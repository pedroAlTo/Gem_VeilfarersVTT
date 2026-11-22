import { hasSwarmTactics } from './adversaryPassives.js';
import { pathCard } from './statePowers.js';
import { actionArt } from './actionCardArt.js';
import { tokenInventory } from './equipment.js';
import { installedAugments, augmentRule, catalogEntry } from './gear.js';
import { equipmentPicture } from './equipmentArtwork.js';
import { enemyCategory } from './adversaryCardCategories.js';
// The hand of a player character: what it can play, what playing it costs and how Powers move
// between Vault and Loadout. Pure rules (Corebook 12.06, ch. 7 and 18); the hand UI draws it.
import { availablePowers } from './advancement.js';
const text = value => value == null ? '' : String(value);
const lower = value => text(value).trim().toLowerCase();
const fieldsOf = token => token?.sourceCharacter?.document?.fields || token?.sheetFields || {};
const writable = token => token.sourceCharacter?.document?.fields || (token.sheetFields ||= {});
const slug = value => lower(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const TRAITS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

// The colours of the Domain flags and bands of the card art.
export const DOMAIN_COLORS = { Tech: '#00697f', Synthesis: '#1f5c2b', Social: '#ee6a82', Neural: '#7b3a78', Kinetic: '#9b150c', Void: '#15121a', Lux: '#d8b40a' };
// Card art (public/assets/cards): a flag and a name band per Domain and per Class, and a
// corner band for Ancestry and Background cards.
const CARD_ART = '/assets/cards/';
const CLASS_ART = ['diplomat', 'engineer', 'explorer', 'mystic', 'pilot', 'scholar', 'scoundrel', 'soldier', 'vanguard'];
const illustratedPowers = new Set('drone-whisper quantum-firewall system-jackknife biological-scan environmental-adaptation rapid-regeneration linguistic-patch perfect-facade silver-tongue mind-shield telekinetic-grasp veil-sensitivity force-shield kinetic-blast tactical-overwatch slipstream-jolt temporal-cloak vector-calculus blinding-flash spark-of-hope wayfinders-pulse'.split(' '));
// The eight painted cells in each domain sheet are in level order, two powers per level.
const domainSheetNames = {
  Tech: ["Data Ghost", "Emergency Repair", "Digital Cascade", "Rapid Fabrication", "AI Symbiosis", "System Repair", "Adaptive Protocol", "Network Dominion"],
  Synthesis: ["Ecosystem Analysis", "Symbiotic Bond", "Hostile Environment Mastery", "Symbiotic Bloom", "Adaptive Evolution", "Bio-Integration", "Cellular Reconstruction", "Terraforming Genesis"],
  Social: ["Emotional Manipulation", "Inspiring Presence", "Compelling Argument", "Master of Disguise", "Rallying Cry", "Web of Lies", "Legendary Reputation", "Social Puppeteer"],
  Neural: ["Memory Echo", "Synaptic Disruption", "Empathic Network", "Mind-Slip", "Cordon of Will", "Neural Feedback", "Mind Spike", "Temporal Glimpse"],
  Kinetic: ["Impact Absorption", "Kinetic Barrier", "Protective Dome", "Velocity Surge", "Guardian's Aegis", "Precision Strike", "Kinetic Mastery", "Shockwave Pulse"],
  Void: ["Lucky Break", "Spatial Shift", "Flux Field", "Temporal Muffle", "Danger Sense", "Spatial Cache", "Fate's Hand", "Phase Walk"],
  Lux: ["Eyes of Truth", "Photon Shield", "Aura of Clarity", "Stellar Lance", "Deflection Prism", "Solar Judgment", "Beacon of Resurrection", "Cartographer of the Unseen"],
};
// Each row records the painted cells in one sheet, left to right, top to bottom.
const upperPowerSheets = [
  ["Tech:6:Consciousness Transfer", "Tech:6:Invention Protocol", "Tech:7:Megascale Fabrication", "Tech:7:Systemic Shutdown", "Tech:8:Cascading Upgrade", "Tech:8:Digital Apotheosis", "Tech:9:Precursor Protocol", "Tech:9:Quantum Command Hub", "Tech:10:Architect of Matter"],
  ["Tech:10:Cosmic Engineer", "Synthesis:6:Ecosystem Creation", "Synthesis:6:Metamorphic Mastery", "Synthesis:7:Biomorphic Arsenal", "Synthesis:7:Hivemind Convergence", "Synthesis:8:Bio-Weapon Architect", "Synthesis:8:Local Life Web", "Synthesis:9:Genesis Protocol", "Synthesis:9:Global Stimulus Field"],
  ["Synthesis:10:Cosmic Synthesis", "Synthesis:10:Universal Life Force", "Social:6:Charismatic Authority", "Social:6:Mass Deception", "Social:7:Memetic Erasure", "Social:7:Perfect Masquerade", "Social:8:Cult of Personality", "Social:8:Mass Hysteria", "Social:9:Diplomatic Redirection"],
  ["Social:9:Fabricate Reality", "Social:10:Architect of Civilization", "Social:10:Cosmic Accord", "Neural:6:Collective Consciousness", "Neural:6:Psychic Storm", "Neural:7:Mind Sanctuary", "Neural:7:Veil Suppression", "Neural:8:Psychic Collapse", "Neural:8:Temporal Maelstrom"],
  ["Neural:9:Destiny Weave", "Neural:9:Psychic Fallout", "Neural:10:Consciousness Bridge", "Neural:10:Veil Mastery", "Kinetic:6:Energy Cascade", "Kinetic:6:Force Fortress", "Kinetic:7:Orbital Lance", "Kinetic:7:Temporal Freeze", "Kinetic:8:Singularity Well"],
  ["Kinetic:8:Tactical Aegis", "Kinetic:9:Asteroid Redirect", "Kinetic:9:Indomitable Bastion", "Kinetic:10:Absolute Command", "Kinetic:10:Force Incarnate", "Void:6:Spatial Link", "Void:6:Void Sanctuary", "Void:7:Chrono Stasis", "Void:7:Phase Jump"],
  ["Void:8:Phantom Ship", "Void:8:Temporal Disarray", "Void:9:Cosmic Luck", "Void:9:The Navigator's Truth", "Void:10:Master of Fate", "Void:10:Master of Space", "Lux:6:Lightbridge", "Lux:6:Photonic Detonation", "Lux:7:Corona Beam"],
  ["Lux:7:Inviolable Sanctum", "Lux:8:Omniscient Eye", "Lux:8:Solar Avatar", "Lux:9:Pulse of Genesis", "Lux:9:Stellar Chorus", "Lux:10:Apotheosis", "Lux:10:Eternal Beacon"],
];
const upperPowerArt = new Map(upperPowerSheets.flatMap((names, sheet) => names.map((key, cell) =>
  [key, { illustration: CARD_ART + 'powers/domains/upper-' + (sheet + 1) + '.webp', cell }])));

export function powerArt(power) {
  const art = domainArt(power.d);
  const upper = upperPowerArt.get(`${power.d}:${power.l}:${power.n}`);
  if (upper) return { ...art, ...upper };
  const names = Object.hasOwn(domainSheetNames, power.d) && domainSheetNames[power.d];
  const cell = names ? names.indexOf(power.n) : -1;
  if (cell >= 0 && Number(power.l) === 2 + Math.floor(cell / 2)) {
    return { ...art, illustration: CARD_ART + 'powers/domains/' + lower(power.d) + '.webp', cell };
  }
  const slug = String(power.n).toLowerCase().replace(/['’]/g, '').replace(/ +/g, '-');
  return Number(power.l) === 1 && illustratedPowers.has(slug) ? { ...art, illustration: '/assets/cards/powers/level-1/' + slug + '.webp' } : art;
}
export const domainArt = domain => DOMAIN_COLORS[domain] ? { flag: `${CARD_ART}domain-${lower(domain)}-flag.png`, band: `${CARD_ART}domain-${lower(domain)}-band.png`, layout: 'band' } : { flag: '', band: `${CARD_ART}plain-band.png`, layout: 'band' };
// Existing editorial scenes also illustrate the non-domain cards in a Sleeping hand.
const sceneArt = id => CARD_ART + 'powers/level-1/' + id + '.webp';
const classScenes = {
  diplomat: 'silver-tongue', engineer: 'drone-whisper', explorer: 'environmental-adaptation',
  mystic: 'veil-sensitivity', pilot: 'vector-calculus', scholar: 'biological-scan',
  scoundrel: 'perfect-facade', soldier: 'tactical-overwatch', vanguard: 'force-shield',
};
const communityScenes = {
  'core-world': 'perfect-facade', 'trade-hub': 'linguistic-patch', 'frontier-colony': 'environmental-adaptation',
  'void-station': 'quantum-firewall', 'free-fleet': 'vector-calculus',
  agrisynth: 'biological-scan', 'displaced-enclave': 'spark-of-hope',
};
export const classArt = cls => { const id = lower(cls?.id || cls?.name); return CLASS_ART.includes(id) ? { illustration: sceneArt(classScenes[id]), flag: `${CARD_ART}class-${id}-flag.png`, band: `${CARD_ART}class-${id}-band.png`, layout: 'band' } : { flag: '', band: `${CARD_ART}plain-band.png`, layout: 'band' }; };
export const cornerArt = (kind, id) => ({ illustration: kind === 'ancestry' && id
  ? '/assets/tokens/crew/' + id.replace('-', '_') + '-n.webp'
  : sceneArt(communityScenes[id] || 'spark-of-hope'), flag: '', band: `${CARD_ART}${kind}-band.png`, layout: 'corner' });
export const CARD_KINDS = { augment: 'Aumento', power: 'Poder', vault: 'Vault', archive: 'Archivo', move: 'Resolve Move', feature: 'Clase', ancestry: 'Ancestry', community: 'Background', effort: 'Common Effort', beardown: 'Resolve Move', fear: 'Fear', adversary: 'Adversario' };
// A card's kind in words, never undefined (a kind without a name falls back to «Carta»).
export const cardKindName = kind => CARD_KINDS[kind] || 'Carta';

// "2 Hope + 1 Stress", "spend 1", "THE READING (2 EFFORT)"… as numbers. `open` marks a cost
// the card leaves to the player (Variable, "spend and roll 1+", upkeep): it is paid by hand.
export function parseCost(value, kind = 'power') {
  const source = text(value), cost = { hope: 0, stress: 0, effort: 0, resolve: 0, hp: 0, open: false };
  for (const [key, word] of [['hope', 'Hope'], ['stress', 'Stress'], ['effort', 'Effort'], ['resolve', 'Resolve'], ['hp', 'HP']]) {
    const match = source.match(new RegExp(`(\\d+)\\s*${word}\\b`, 'i')); if (match) cost[key] = Number(match[1]);
  }
  if (kind === 'move') { const spend = source.match(/spend(?: and roll)?\s*(\d+)(\+)?/i); if (spend) { cost.resolve = Number(spend[1]); cost.open = !!spend[2]; cost.rolls = /and roll/i.test(source); } }
  if (/variable|all remaining|per (day|week|participant)|to begin|wealth/i.test(source)) cost.open = true;
  return cost;
}
export function parseRoll(value) {
  const match = text(value).match(/DC\s*(\d+)\s*\(([A-Za-z]+)\)/);
  const traitId = match && lower(match[2]);
  return match && TRAITS.includes(traitId) ? { dc: Number(match[1]), traitId } : null;
}
export const costLabel = cost => [cost.hope && `${cost.hope} Hope`, cost.stress && `${cost.stress} Stress`, cost.effort && `${cost.effort} Effort`, cost.resolve && `${cost.resolve}${cost.open ? '+' : ''} Resolve`, cost.hp && `${cost.hp} HP`].filter(Boolean).join(' + ') || (cost.open ? 'Variable' : 'Sin coste');

const byName = (list, name) => list.find(item => lower(item.name ?? item.n) === lower(name)) || list.find(item => lower(item.id) === slug(name)) || null;
// Older tokens only say who they are in free text ("Ace Pilot // Awakened Starchaser",
// "Heavy Engineer // Sleeping Synthetic"): the class or ancestry is taken from there when the
// sheet has no field for it.
const inText = (list, ...texts) => {
  const source = texts.filter(Boolean).join(' ');
  return source ? list.find(item => new RegExp(`\\b${String(item.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(source)) || null : null;
};
export const classOf = (token, data) => byName(data.classes, token?.characterClass) || inText(data.classes, token?.characterClass, token?.roleTag);
export const ancestryOf = (token, data) => byName(data.ancestries, token?.species) || inText(data.ancestries, token?.species, token?.roleTag);
// An ancestry Gift is "used" when its text gives it a moment, a price or a limit.
// (Corebook 12.06 also writes some as a procedure with its own roll: Nurturing Touch "roll 1d4 once".)
export const usableGift = gift => /\bonce per\b|\bmay (?:choose to )?(?:mark|spend)\b|\bcan (?:mark|spend|use your)\b|\broll \d*d\d+ once\b/i.test(text(gift?.text));
export const giftLimit = gift => { const match = text(gift?.text).match(/once per ((?:game )?session|long rest|short rest|rest|scene)/i); return match ? `1 / ${match[1].replace(/^game /i, '')}` : ''; };
// What a Gift asks you to mark or spend. "Path resources" are Hope for the Awakened and
// Effort for the Sleeping. Amounts it gives back ("clear 1 Stress") are not a price.
export function giftCost(gift, sleeping = false) {
  const cost = { hope: 0, stress: 0, effort: 0, resolve: 0, hp: 0, open: false };
  // Bold markup (**2 path resources**) does not change the price.
  for (const match of text(gift?.text).replace(/\*+/g, '').matchAll(/(?:mark|spend)s?\s+(\d+)\s+(Stress|Hope|Effort|path resources?)/gi)) {
    const amount = Number(match[1]), what = lower(match[2]);
    const key = what === 'stress' ? 'stress' : what === 'hope' ? 'hope' : what === 'effort' ? 'effort' : sleeping ? 'effort' : 'hope';
    cost[key] = Math.max(cost[key], amount);
  }
  if (/spend Hope\b/i.test(text(gift?.text)) && !cost.hope) cost.open = true;
  return cost;
}
export const isSleepingMystic = token => token?.path === 'Sleeping' && /mystic/i.test(text(token.characterClass));
// The subclass rank acquired: 0 Foundation, 1 Specialization, 2 Mastery.
export const subclassRank = token => Math.max(Number(token?.advancement?.subclassUpgrades) || 0, /mastery/i.test(token?.subclassRank) ? 2 : /specialization/i.test(token?.subclassRank) ? 1 : 0);

// Uncanny Power, step 1 (Corebook ch. 7, Sleeping Mystic): choose how many Resolve to spend, roll
// one Resolve Die per Resolve and add Knowledge once. The result, capped by the character level,
// is the highest Domain level reachable; the Keeper gains 1 Fear per Resolve. The access stays
// open on the character (`uncanny`) until a Power is chosen or it is given up.
// Impossible Efficiency (Mind-Touched Mastery, once per session): two dice per Resolve.
export const IMPOSSIBLE_EFFICIENCY = JSON.stringify(['session', 'session', 'Impossible Efficiency']);
export const hasImpossibleEfficiency = token => isSleepingMystic(token) && /mind.?touched/i.test(text(token.subclass)) && subclassRank(token) >= 2;
export function uncannyAccess(source, { spent, faces = null, efficiency = false, random = Math.random } = {}) {
  if (!isSleepingMystic(source)) throw new Error('Uncanny Power es del Mystic Sleeping.');
  if (source.uncanny) throw new Error(`Ya tienes un acceso abierto (nivel ${source.uncanny.access}): elige un Poder o renuncia a él.`);
  const count = Math.floor(Number(spent));
  if (!(count >= 1)) throw new Error('Gasta al menos 1 Resolve.');
  need(source.resolve?.current || 0, count, 'Resolve');
  if (efficiency && !hasImpossibleEfficiency(source)) throw new Error('Impossible Efficiency es la Mastery del Mind-Touched.');
  if (efficiency && Object.hasOwn(source.cardUses || {}, IMPOSSIBLE_EFFICIENCY)) throw new Error('Impossible Efficiency ya se usó esta sesión.');
  const token = structuredClone(source), sides = token.resolve?.dieType === 'd6' ? 6 : 4, dice = count * (efficiency ? 2 : 1);
  const rolls = Array.isArray(faces) && faces.length === dice && faces.every(v => Number.isInteger(v) && v >= 1 && v <= sides) ? faces.slice() : Array.from({ length: dice }, () => Math.floor(random() * sides) + 1);
  const knowledge = Number(token.traits?.knowledge) || 0, total = rolls.reduce((n, v) => n + v, 0) + knowledge;
  const access = Math.max(0, Math.min(total, Number(token.level) || 1));
  token.resolve = { ...token.resolve, current: token.resolve.current - count };
  token.uncanny = { access, spent: count };
  if (efficiency) token.cardUses = { ...(token.cardUses || {}), [IMPOSSIBLE_EFFICIENCY]: 'session' };
  const notes = [`Uncanny Power: ${count} Resolve${efficiency ? ' (Impossible Efficiency: 2 dados por Resolve)' : ''} → ${token.resolve.dieType || 'd4'} [${rolls.join(', ')}] + Knowledge ${knowledge} = ${total}; nivel accesible ${access}${total > access ? ' (máx. tu nivel)' : ''}. El Keeper gana ${count} Fear.`];
  return { token, access, rolls, total, fear: count, notes, summary: `Uncanny Power · acceso nivel ${access}` };
}
// The Archive Powers an open access reaches (playable, level ≤ access).
export const uncannyChoices = (cards, access) => cards.filter(c => c.kind === 'archive' && c.playable && c.level <= access);

// Loadout and Vault as the sheet stores them.
export function loadoutNames(token) {
  const f = fieldsOf(token);
  return Object.keys(f).filter(k => /^a_pwr_\d+_n$/.test(k)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(k => text(f[k]).trim()).filter(Boolean);
}
export function vaultNames(token) {
  return text(fieldsOf(token).a_vault).split('\n').map(line => line.split(' · ').pop().trim()).filter(Boolean);
}
export const loadoutCap = token => Number(fieldsOf(token).a_loadout_cap) || 5;

// The Domain packages a Sleeping Mystic has unlocked in the Uncanny Archive: [Domain, level].
export function archivePackages(token) {
  const f = fieldsOf(token), source = Object.values(f).filter(v => typeof v === 'string').join('\n'), found = new Map();
  const studied = source.match(/Studied Domains\s*[—-]\s*([^\n]+)/i);
  if (studied) for (const name of studied[1].split('+')) { const domain = Object.keys(DOMAIN_COLORS).find(d => lower(d) === lower(name)); if (domain) found.set(`${domain}:1`, [domain, 1]); }
  for (const match of text(f.s_archive).matchAll(/([A-Za-z]+)\s+(\d+)/g)) { const domain = Object.keys(DOMAIN_COLORS).find(d => lower(d) === lower(match[1])); if (domain) found.set(`${domain}:${match[2]}`, [domain, Number(match[2])]); }
  return [...found.values()];
}

export const powerCard = (power, zone, sheet = {}) => {
  const type = power.t || sheet.type || 'Power', passive = /passive/i.test(type);
  return {
    id: `${zone}:${slug(power.n)}`, kind: zone === 'loadout' ? 'power' : zone, zone, name: power.n,
    domain: power.d || '', level: power.l || 0, type, tier: power.tier || '', color: DOMAIN_COLORS[power.d] || '#6d28d9', art: powerArt(power),
    subtitle: [power.d, power.l && `L${power.l}`, type].filter(Boolean).join(' · '),
    costText: power.cost || sheet.cost || '—', cost: parseCost(power.cost), roll: parseRoll(power.dc), rollText: power.dc && power.dc !== '—' ? power.dc : '',
    rc: Number(power.rc ?? sheet.rc ?? 0) || 0, text: text(power.txt || sheet.text), reaction: /reaction/i.test(type), playable: zone !== 'vault' && !passive,
  };
};

// Every card of the character, in hand order: what it can play first, the Vault last.
export function characterCards(token, data, options = {}) {
  if (!token || token.isPlayer === false || !data) return [];
  const f = fieldsOf(token), cards = [], sleeping = token.path === 'Sleeping';
  const cls = classOf(token, data), rules = sleeping && cls?.sleepingRules ? cls.sleepingRules : cls;
  if (!sleeping) {
    const sheetPower = (name, i) => ({ text: text(f[`a_pwr_${i}_d`]), rc: f[`a_pwr_${i}_rc`] });
    const keys = Object.keys(f).filter(k => /^a_pwr_\d+_n$/.test(k)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const key of keys) {
      const name = text(f[key]).trim(); if (!name) continue;
      const index = key.match(/\d+/)[0], known = byName(data.powers, name);
      cards.push(powerCard(known || { n: name, txt: text(f[`a_pwr_${index}_d`]), rc: f[`a_pwr_${index}_rc`] }, 'loadout', sheetPower(name, index)));
    }
  } else if (isSleepingMystic(token)) {
    for (const [domain, level] of archivePackages(token)) for (const power of data.powers.filter(p => p.d === domain && p.l === level)) {
      const card = powerCard(power, 'archive');
      // Uncanny Power cannot reproduce a Reaction or a Passive Power.
      cards.push({ ...card, playable: card.playable && !card.reaction && !/project/i.test(card.type) });
    }
  }
  if (sleeping) {
    const learned = lower([f.s_learned_moves, f.s_active_move].join('\n'));
    const ofClass = data.resolveMoves.filter(m => lower(m.class) === lower(cls?.name));
    let moves = ofClass.filter(m => learned.includes(lower(m.name)));
    if (!moves.length) moves = ofClass.filter(m => !m.subclass || lower(m.subclass) === lower(token.subclass));
    for (const move of moves) {
      const cost = parseCost(move.cost, 'move');
      cards.push({ id: `move:${slug(move.name)}`, kind: 'move', ...(isSleepingMystic(token) && /^uncanny power$/i.test(move.name) ? { uncanny: true } : {}), zone: 'loadout', name: move.name, subtitle: ['Resolve Move', move.subclass || move.class].filter(Boolean).join(' · '), color: cls?.color || '#fb923c', art: actionArt(move.name, classArt(cls)), costText: move.cost, cost, roll: null, rollText: cost.rolls ? `Tira ${token.resolve?.dieType || 'd4'} por Resolve` : '', rc: 0, text: text(move.text), playable: true });
    }
  }
  const pathFeature = sleeping ? rules?.effortFeature : rules?.hopeFeature;
  if (pathFeature) cards.push({ id: `feature:${slug(pathFeature.name)}`, kind: 'feature', zone: 'innate', name: pathFeature.name.replace(/\s*\(.*?\)\s*$/, ''), subtitle: `${cls.name} · ${sleeping ? 'Effort Feature' : 'Hope Feature'}`, color: cls.color || '#c084fc', art: classArt(cls), costText: (pathFeature.name.match(/\((.*?)\)/) || [])[1] || '—', cost: parseCost(pathFeature.name), roll: null, rollText: '', rc: 0, text: text(pathFeature.text), playable: true });
  // The class and the subclass ranks actually acquired on this character.
  const branchList = sleeping ? cls?.sleepingSubclasses : cls?.awakenedSubclasses;
  const branch = branchList?.find(b => lower(b.name) === lower(token.subclass) || lower(token.subclass).startsWith(lower(b.name) + ' ('));
  const rank = subclassRank(token);
  const features = [[rules?.classFeature, 'Clase'], [branch?.foundation, 'Foundation'], [rank >= 1 && branch?.specialization, 'Specialization'], [rank >= 2 && branch?.mastery, 'Mastery']];
  for (const [feature, tier] of features) {
    if (!feature?.name) continue;
    const description = text(feature.desc || feature.text), passive = /passive/i.test(feature.type || '');
    // Multi-option class features have conditional costs paid when the printed option is chosen.
    const price = /^(?:spend|mark) (\d+ (?:Hope|Effort|Stress))\b/i.exec(description)?.[1] || '';
    cards.push({ id: 'class-rule:' + slug(feature.name), kind: 'feature', zone: 'innate', name: feature.name,
      subtitle: [branch && tier !== 'Clase' ? branch.name : cls.name, tier, feature.type].filter(Boolean).join(' · '),
      art: classArt(cls), color: cls.color, costText: price || '—', cost: parseCost(price), roll: null, rollText: '', rc: 0,
      text: description, reaction: /reaction/i.test(feature.type || ''), guidedFeature: true, passive, playable: true });
  }
  // One card per Gift that is used (it has a moment, a price or a limit); passive Gifts are
  // always on and stay on the sheet.
  const ancestry = ancestryOf(token, data);
  for (const gift of (ancestry?.gifts || []).filter(usableGift)) cards.push({ id: `ancestry:${ancestry.id}:${slug(gift.name)}`, kind: 'ancestry', zone: 'innate', name: gift.name, subtitle: `Ancestry · ${ancestry.name}`, color: ancestry.color || '#94a3b8', art: cornerArt('ancestry', ancestry.id), costText: costLabel(giftCost(gift, sleeping)), cost: giftCost(gift, sleeping), roll: null, rollText: '', rc: 0, text: text(gift.text), limit: giftLimit(gift), playable: true });
  const community = byName(data.communities, token.community);
  if (community?.feature) cards.push({ id: `community:${community.id}`, kind: 'community', zone: 'innate', name: community.feature.name, subtitle: `Background · ${community.name}`, color: community.color || '#94a3b8', art: cornerArt('community', community.id), costText: '—', cost: parseCost(''), roll: null, rollText: '', rc: 0, text: text(community.feature.text), playable: true });
  // Augmentations that are used (they have a moment, a price or a limit), installed: one card each,
  // with the classes' cards, illustrated with the augment's own picture (user decision, v2.28.0).
  for (const row of installedAugments(tokenInventory(token))) {
    const rule = augmentRule(row)?.active; if (!rule) continue;
    const entry = catalogEntry(row), picture = equipmentPicture(entry || row);
    const cost = parseCost(rule.stress ? `${rule.stress} Stress` : '');
    cards.push({ id: `augment:${row.id}`, kind: 'augment', zone: 'innate', name: row.name, subtitle: `Aumento${entry?.tier ? ` · ${entry.tier}` : ''}`, color: '#22d3ee', art: { flag: '', band: '/assets/cards/plain-band.png', layout: 'band', ...(picture || {}) }, costText: rule.stress ? `${rule.stress} Stress` : '—', cost, roll: null, rollText: '', rc: 0, text: rule.text, limit: rule.limit, reaction: !!rule.reaction, effect: rule.clearStress ? { clearStress: rule.clearStress } : null, playable: true });
  }
  if (!sleeping) for (const name of vaultNames(token)) { const known = byName(data.powers, name); cards.push(powerCard(known || { n: name }, 'vault')); }
  // Bear Down and the Common Efforts come after the character's own cards.
  if (sleeping) cards.push(...sleepingCommonCards(token, options));
  return cards.map(card => pathCard(card, token));
}

// The deck's reference catalog besides the Powers (user request, 18 Nov 2026): every Ancestry
// Gift, every Community benefit and the class cards, Awakened and Sleeping, grouped by class.
// Read-only cards (they are consulted, not played from here).
export function catalogGroups(data) {
  const read = card => ({ zone: 'catalog', roll: null, rollText: '', rc: 0, playable: false, ...card });
  const ancestry = (data.ancestries || []).map(a => ({ group: a.name, cards: (a.gifts || []).map(g => read({ id: `cat:ancestry:${a.id}:${slug(g.name)}`, kind: 'ancestry', name: g.name, subtitle: `Ancestry · ${a.name}`, color: a.color || '#94a3b8', art: cornerArt('ancestry', a.id), costText: usableGift(g) ? costLabel(giftCost(g)) : 'Pasivo', cost: giftCost(g), text: text(g.text), limit: giftLimit(g) })) }));
  const community = (data.communities || []).filter(c => c.feature).map(c => ({ group: c.name, cards: [read({ id: `cat:community:${c.id}`, kind: 'community', name: c.feature.name, subtitle: `Background · ${c.name}`, color: c.color || '#94a3b8', art: cornerArt('community', c.id), costText: '—', cost: parseCost(''), text: text(c.feature.text) })] }));
  const feature = (cls, f, label, path) => f && read({ id: `cat:${path}:${cls.id}:${slug(f.name)}`, kind: 'feature', name: f.name.replace(/\s*\(.*?\)\s*$/, ''), subtitle: `${cls.name} · ${label}`, color: cls.color || '#c084fc', art: classArt(cls), costText: (f.name.match(/\((.*?)\)/) || [])[1] || '—', cost: parseCost(f.name), text: text(f.text) });
  const awakened = (data.classes || []).map(cls => ({ group: cls.name, cards: [feature(cls, cls.hopeFeature, 'Hope Feature', 'aw'), feature(cls, cls.classFeature, 'Class Feature', 'aw')].filter(Boolean) }));
  const sleeping = (data.classes || []).filter(c => c.sleepingRules).map(cls => {
    const r = cls.sleepingRules;
    const moves = (data.resolveMoves || []).filter(m => lower(m.class) === lower(cls.name)).map(m => read({ id: `cat:move:${slug(m.class)}:${slug(m.name)}`, kind: 'move', name: m.name, subtitle: ['Resolve Move', m.subclass || m.class].filter(Boolean).join(' · '), color: cls.color || '#fb923c', art: actionArt(m.name, classArt(cls)), costText: m.cost, cost: parseCost(m.cost, 'move'), text: text(m.text) }));
    return { group: cls.name, cards: [feature(cls, r.effortFeature, 'Effort Feature', 'sl'), feature(cls, r.classFeature, 'Class Feature', 'sl'), ...moves].filter(Boolean) };
  });
  return { ancestry, community, awakened, sleeping };
}

const need = (have, cost, label) => { if (cost > have) throw new Error(`No hay ${label} suficiente: hacen falta ${cost} y quedan ${have}.`); };
const overwhelmed = token => (token.stress?.current || 0) >= (token.stress?.max ?? 6);

// Playing a card pays its printed cost and says what happens next. Nothing is rolled for the
// Spellcast here: the result names the roll (Trait and DC) for the dice panel.
// resolveSpent: how many Resolve an open Move or Uncanny Power spends (1 or more).
export function playCard(source, card, { resolveSpent = null, random = Math.random } = {}) {
  if (!card?.playable) throw new Error(card?.zone === 'vault' ? 'Esta carta está en el Vault: hay que traerla al Loadout con un Recall.' : 'Esta carta es pasiva o un proyecto: no se activa desde la mano.');
  const token = structuredClone(source), cost = { ...card.cost }, notes = [];
  let fear = 0, roll = card.roll ? { ...card.roll } : null;
  const dieSides = token.resolve?.dieType === 'd6' ? 6 : 4, die = () => Math.floor(random() * dieSides) + 1;
  if (card.uncanny) throw new Error('Uncanny Power se usa desde su ventana: tira el acceso y elige el Poder del Archivo.');
  if (card.kind === 'archive') {
    // Uncanny Power (Corebook ch. 7): the access is rolled first (uncannyAccess) and stays open on
    // the character; then a Power of the Archive at or below that level is chosen. Sending the
    // Resolve with the card does both steps at once (older clients, tests).
    let opened = null;
    if (!token.uncanny) {
      if (resolveSpent == null) throw new Error('Primero tira el acceso de Uncanny Power: gasta Resolve y mira hasta qué nivel llegas.');
      opened = uncannyAccess(token, { spent: resolveSpent, random });
      Object.assign(token, opened.token); fear = opened.fear; notes.push(...opened.notes);
    }
    const pending = token.uncanny;
    if (card.level > pending.access) {
      if (!opened) throw new Error(`${card.name} es de nivel ${card.level} y tu acceso llega a ${pending.access}: elige un Poder de nivel ${pending.access} o menor.`);
      return { token, paid: { resolve: opened ? pending.spent : 0 }, fear, roll: null, failed: true, pending: true, summary: `${card.name} es de nivel ${card.level} y el acceso llega a ${pending.access}. El acceso sigue abierto: elige un Poder del Archivo de nivel ${pending.access} o menor.`, notes };
    }
    if (cost.stress) { if (overwhelmed(token)) throw new Error('Overwhelmed: no puedes pagar costes de Stress.'); need((token.stress?.max ?? 6) - (token.stress?.current || 0), cost.stress, 'margen de Stress'); token.stress = { ...token.stress, current: (token.stress.current || 0) + cost.stress }; }
    if (cost.hp) token.hp = { ...token.hp, current: Math.max(0, token.hp.current - cost.hp) };
    token.uncanny = null;
    roll = { dc: 10 + card.level, traitId: 'knowledge' };
    notes.push(`Acceso nivel ${pending.access}: ${card.name} (nivel ${card.level}). Ignora el coste de Hope. Acción completa. Spellcast de Knowledge contra DC ${roll.dc}; si la superas, el Poder se manifiesta. Con Critical Success recuperas los ${pending.spent} Resolve.`);
    return { token, paid: { resolve: opened ? pending.spent : 0, stress: cost.stress, hp: cost.hp }, fear, roll, refundResolve: pending.spent, summary: `${card.name} · Uncanny Power`, notes };
  }
  if (/all remaining Hope/i.test(card.costText)) {
    const minimum = Number(/minimum (\d+)/i.exec(card.costText)?.[1] || 1);
    need(token.hope || 0, minimum, 'Hope');
    cost.hope = token.hope;
  }
  if (/^Long-Term Project/i.test(card.type) && /per (day|week) of maintenance/i.test(card.costText)) cost.stress = 0;
  if (cost.open && cost.resolve) cost.resolve = Math.max(cost.resolve, Number(resolveSpent) || cost.resolve);
  need(token.hope || 0, cost.hope, 'Hope'); need(token.effort || 0, cost.effort, 'Effort'); need(token.resolve?.current || 0, cost.resolve, 'Resolve');
  if (cost.stress && overwhelmed(token)) throw new Error('Overwhelmed: no puedes pagar costes de Stress.');
  if (cost.stress) need((token.stress?.max ?? 6) - (token.stress?.current || 0), cost.stress, 'margen de Stress');
  if (cost.hope) token.hope -= cost.hope;
  if (cost.effort) token.effort -= cost.effort;
  if (cost.stress) token.stress = { ...token.stress, current: (token.stress.current || 0) + cost.stress };
  if (cost.hp) token.hp = { ...token.hp, current: Math.max(0, token.hp.current - cost.hp) };
  if (cost.resolve) {
    token.resolve = { ...token.resolve, current: token.resolve.current - cost.resolve };
    if (card.cost.rolls) { const rolls = Array.from({ length: cost.resolve }, die); notes.push(`Resolve: ${token.resolve.dieType || 'd4'} [${rolls.join(', ')}] = ${rolls.reduce((n, v) => n + v, 0)}.`); }
  }
  // An augment whose benefit is clearing Stress (Pain Suppressor).
  if (card.effect?.clearStress && token.stress) { const before = token.stress.current || 0; token.stress = { ...token.stress, current: Math.max(0, before - card.effect.clearStress) }; notes.push(`Limpia ${before - token.stress.current} Stress.`); }
  if (card.cost.open && !cost.resolve) notes.push('Esta carta tiene un coste variable o de mantenimiento: ajústalo a mano en la ficha.');
  if (roll) notes.push(`Tirada: ${card.rollText}.`);
  return { token, paid: cost, fear, roll, summary: `${card.name} · ${costLabel(cost)}`, notes };
}

export const RECALL_MODES = {
  long: { name: 'Long Rest', text: 'Gratis: reorganiza el Loadout libremente.' },
  short: { name: 'Short Rest', text: 'Pagas el Recall Cost impreso del Poder en Stress.' },
  scene: { name: 'Escena activa', text: 'Usa tu Acción, pagas el Recall Cost en Stress y gastas 1 Hope.' },
};
export function recallCost(card, mode) {
  if (!RECALL_MODES[mode]) throw new Error('Momento de Recall desconocido.');
  return { stress: mode === 'long' ? 0 : card.rc, hope: mode === 'scene' ? 1 : 0, action: mode === 'scene' };
}

// Recall: a Vault Power enters the Loadout; if the Loadout is full, one Power leaves for the
// Vault. data gives the printed text of the Powers so the sheet stays complete.
export function recallPower(source, data, vaultName, { mode = 'long', replace = '' } = {}) {
  const token = structuredClone(source), f = writable(token);
  if (token.path === 'Sleeping') throw new Error('Los personajes Sleeping no tienen Vault ni Loadout.');
  const loadout = loadoutNames(token), vault = vaultNames(token);
  if (!vault.some(n => lower(n) === lower(vaultName))) throw new Error('Ese Poder no está en el Vault.');
  const incoming = byName(data.powers, vaultName) || { n: vaultName, rc: 0 };
  const cost = recallCost({ rc: Number(incoming.rc) || 0 }, mode);
  let leaving = '';
  if (loadout.length >= loadoutCap(token)) {
    leaving = loadout.find(n => lower(n) === lower(replace));
    if (!leaving) throw new Error(`El Loadout está lleno (${loadoutCap(token)} Poderes): elige cuál pasa al Vault.`);
  }
  need(token.hope || 0, cost.hope, 'Hope');
  if (cost.stress) { if (overwhelmed(token)) throw new Error('Overwhelmed: no puedes pagar el Recall Cost en Stress.'); need((token.stress?.max ?? 6) - (token.stress?.current || 0), cost.stress, 'margen de Stress'); }
  if (cost.hope) token.hope -= cost.hope;
  if (cost.stress) token.stress = { ...token.stress, current: (token.stress.current || 0) + cost.stress };
  const nextLoadout = [...loadout.filter(n => n !== leaving), incoming.n];
  const nextVault = [...vault.filter(n => lower(n) !== lower(vaultName)), ...(leaving ? [leaving] : [])];
  const previous = Object.fromEntries(Object.keys(f).filter(k => /^a_pwr_\d+_n$/.test(k)).map(k => [lower(f[k]), { d: f[k.replace(/_n$/, '_d')], rc: f[k.replace(/_n$/, '_rc')] }]));
  for (const key of Object.keys(f).filter(k => /^a_pwr_\d+_/.test(k))) delete f[key];
  nextLoadout.forEach((name, i) => {
    const p = byName(data.powers, name), kept = previous[lower(name)];
    f[`a_pwr_${i}_n`] = name;
    f[`a_pwr_${i}_d`] = p ? [p.d, `L${p.l}`, p.t, p.cost, p.dc].filter(Boolean).join(' · ') + `\n${text(p.txt)}` : text(kept?.d);
    f[`a_pwr_${i}_rc`] = text(p ? p.rc ?? 0 : kept?.rc ?? 0);
  });
  f.a_vault = nextVault.map(name => { const p = byName(data.powers, name); return p ? `${p.d} · L${p.l} · ${p.n}` : name; }).join('\n');
  return { token, cost, entered: incoming.n, left: leaving, summary: `Recall (${RECALL_MODES[mode].name}): ${incoming.n} entra en el Loadout${leaving ? `; ${leaving} pasa al Vault` : ''}. ${[cost.stress && `${cost.stress} Stress`, cost.hope && `${cost.hope} Hope`, cost.action && 'Acción'].filter(Boolean).join(' + ') || 'Sin coste'}.` };
}

// Learning a Power: it enters the Vault. Only Powers within reach can be taken: the character's
// Domains (and a multiclass Domain at half level), up to its level, not already known.
export const powersInReach = (token, data) => availablePowers(token, data, Number(token?.level) || 1);
export function learnPower(source, data, name) {
  const token = structuredClone(source), f = writable(token);
  if (token.path === 'Sleeping') throw new Error('Los personajes Sleeping no tienen Vault ni Loadout.');
  const power = byName(data.powers, name);
  if (!power) throw new Error('Poder desconocido.');
  if (!powersInReach(token, data).some(p => lower(p.n) === lower(power.n))) throw new Error(`${power.n} no está a tu alcance: fuera de tus Dominios, por encima de tu nivel o ya lo conoces.`);
  const lines = text(f.a_vault).split('\n').filter(line => line.trim());
  f.a_vault = [...lines, `${power.d} · L${power.l} · ${power.n}`].join('\n');
  return { token, learned: power.n, summary: `${power.n} (${power.d}, nivel ${power.l}) entra en el Vault.` };
}

// The Uncanny Archive of a Sleeping Mystic (Corebook ch. 7), managed from the deck and the sheet:
// a Domain-level package unlocks every Power of that Domain at exactly that level. The level
// cannot exceed the character's; from level 2 on, two different Domains must already be unlocked
// at the level below (Breadth requirement). The list is kept in `s_archive`; the creator's
// «Studied Domains» line is folded into it the first time the Archive is edited.
export const archiveText = packages => [...packages].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([d, l]) => `${d} ${l}`).join(', ');
export function archiveRequirement(token, packages, domain, level) {
  if (packages.some(([d, l]) => d === domain && l === level)) return `${domain} ${level} ya está en el Archivo.`;
  if (level > (Number(token.level) || 1)) return `El nivel ${level} supera tu nivel de personaje (${Number(token.level) || 1}).`;
  if (level >= 2 && new Set(packages.filter(([, l]) => l === level - 1).map(([d]) => d)).size < 2) return `Para investigar el nivel ${level} hacen falta dos Dominios distintos a nivel ${level - 1}.`;
  return '';
}
export function editArchive(source, data, { op, domain, level }) {
  if (!isSleepingMystic(source)) throw new Error('El Archivo es del Mystic Sleeping.');
  const name = Object.keys(DOMAIN_COLORS).find(d => lower(d) === lower(domain)), lv = Number(level);
  if (!name || !Number.isInteger(lv) || lv < 1 || lv > 10) throw new Error('Elige un Dominio y un nivel.');
  const token = structuredClone(source), f = writable(token);
  let packages = archivePackages(token);
  if (op === 'add') {
    const problem = archiveRequirement(token, packages, name, lv);
    if (problem) throw new Error(problem);
    if (!data.powers.some(p => p.d === name && p.l === lv)) throw new Error(`No hay Poderes de ${name} de nivel ${lv}.`);
    packages = [...packages, [name, lv]];
  } else if (op === 'remove') {
    if (!packages.some(([d, l]) => d === name && l === lv)) throw new Error(`${name} ${lv} no está en el Archivo.`);
    packages = packages.filter(([d, l]) => !(d === name && l === lv));
  } else throw new Error('Operación desconocida.');
  for (const key of Object.keys(f)) if (typeof f[key] === 'string' && /Studied Domains\s*[—-]/i.test(f[key])) f[key] = f[key].split('\n\n').filter(part => !/^\s*Studied Domains\s*[—-]/i.test(part)).join('\n\n').replace(/^.*Studied Domains\s*[—-].*$\n?/gim, '');
  f.s_archive = archiveText(packages);
  const count = data.powers.filter(p => p.d === name && p.l === lv).length;
  return { token, packages, summary: op === 'add' ? `${name} ${lv} entra en el Archivo: ${count} Poderes más a través de Uncanny Power.` : `${name} ${lv} sale del Archivo.` };
}

// ---------------------------------------------------------------------------------------------
// Sleeping: Bear Down and the Common Efforts (Corebook ch. 7), as cards. Their move names are
// the ones the EFFORT action knows.
export const COMMON_EFFORTS = [
  { move: 'Steady Hands (+2)', name: 'Steady Hands', effort: 1, text: 'Before you make a Core Trait Roll that draws on something genuinely practiced, spend 1 Effort to add +2; justify the practice in the fiction.' },
  { move: 'Read the Room', name: 'Read the Room', effort: 1, text: 'Ask the Keeper one question about the immediate tactical or social situation (exits, who holds power here, where the tension sits) and they answer truthfully.' },
  { move: 'Push Through', name: 'Push Through', effort: 1, text: 'Ignore one minor environmental or condition penalty on your next action (smoke, partial darkness, awkward footing).' },
  { move: 'The Opening', name: 'The Opening', effort: 2, text: 'You gain Advantage on your next roll, the product of preparation, position, or hard experience.' },
  { move: 'Try Again', name: 'Try Again', effort: 2, text: 'After you roll, reroll one of your two Duality dice (the Hope die or the Fear die) and use the new result. If you reroll the Fear die and it comes up higher, you live with it.' },
  { move: 'Brace (Mitigate)', name: 'Brace', effort: 2, text: 'Against harm you see coming, drop the next hit you take by one severity band (Severe to Major, Major to Minor). This spends no Armor Slots.' },
  { move: 'Cover the Angle', name: 'Cover the Angle', effort: 2, text: 'Give your Reaction to an ally within range: the next Core Trait Roll they make before the start of your next Spotlight gains +2 as you cover, guide, or warn them.' },
  { move: 'Second Wind', name: 'Second Wind', effort: 3, optional: true, text: 'Optional module. Clear 2 Stress outside of a rest, catching your breath mid-action.' },
  { move: 'Seize the Moment', name: 'Seize the Moment', effort: 3, optional: true, text: 'Optional module. After a success, add one extra favorable consequence to the fiction, which the Keeper validates. It is a branch, not a second success.' },
];
const NO_COST = () => ({ hope: 0, stress: 0, effort: 0, resolve: 0, hp: 0, fear: 0, open: false });
export function sleepingCommonCards(token, { optionalEfforts = false } = {}) {
  if (token?.path !== 'Sleeping' || token.isPlayer === false) return [];
  const bearDown = { id: 'resolve:bear-down', kind: 'beardown', zone: 'innate', name: 'Bear Down', subtitle: 'Resolve Move universal', color: '#b45309', art: actionArt('Bear Down'),
    costText: 'spend and roll 1+', cost: { ...NO_COST(), resolve: 1, open: true, rolls: true }, roll: null, rollText: `Tira ${token.resolve?.dieType || 'd4'} por Resolve`, rc: 0, playable: true,
    text: 'After any Duality Roll, attack, reaction, or damage roll, before the outcome is narrated, spend Resolve Dice and add their total. It adds to the total only: it never changes which die came up higher and never makes a Critical.' };
  const efforts = COMMON_EFFORTS.filter(e => !e.optional || optionalEfforts).map(e => ({ id: `effort:${slug(e.name)}`, kind: 'effort', zone: 'innate', move: e.move, name: e.name, subtitle: `Common Effort · ${e.effort} Effort`, color: '#a16207',
    art: actionArt(e.name), costText: `${e.effort} Effort`, cost: { ...NO_COST(), effort: e.effort }, roll: null, rollText: '', rc: 0, playable: true, text: e.text }));
  return [bearDown, ...efforts];
}

// ---------------------------------------------------------------------------------------------
// The Keeper's hand: the Fear moves of the Corebook (ch. 9) and, with an adversary selected,
// its printed abilities.
export const FEAR_COLOR = '#7e22ce';
const fearCard = (id, name, fear, text, extra = {}) => ({ id: `fear:${id}`, kind: 'fear', zone: 'innate', name, subtitle: 'Fear · Keeper', color: FEAR_COLOR, art: actionArt(name),
  costText: `${fear} Fear`, cost: { ...NO_COST(), fear }, roll: null, rollText: '', rc: 0, playable: true, text, ...extra });
export const FEAR_MOVES = [
  fearCard('spotlight', 'Spotlight Enemies', 1, 'Spend 1 Fear to let one eligible NPC that has not yet acted in the current Spotlight cycle take its Spotlight now. This changes order but never grants a second Spotlight in that cycle. A defensive Reaction still requires its own printed trigger.', { spotlight: true }),
  fearCard('complication', 'Declare a Complication', 1, 'Spend 1 Fear after a noncritical Roll to activate one threat, clock trigger, witness, alarm, or equipment risk established before that Roll. Apply its printed or predeclared effect. This move cannot invent damage, item failure, an enemy, or a retroactive fact.'),
  fearCard('interrupt', 'Interrupt an Action', 2, "After the player declares an Action but before dice are rolled or costs paid, spend 2 Fear to activate one previously established threat. Resolve that threat, then the player may continue, change, or cancel the Action. No cost is lost for changing or canceling it."),
  fearCard('ancestry', 'Ancestry Complication', 1, "At most once per character per session, after a player-rolled Fear-dominant noncritical Roll materially uses an Ancestry Gift, spend 1 Fear and roll 1d6 on that ancestry's table. The result is rolled, never chosen. Matching dice never trigger it. If a row lacks a complete effect, its full mechanical effect is to mark 1 Stress.", { die: 6 }),
];

// The abilities printed in an adversary's text, in the formats the three books use: a feature
// table, "**Name** _(Type):_ text", "Name (Fear 2) text" and Rust & Steel's "- **Special:** text".
export function adversaryAbilities(source) {
  const lines = text(source).replace(/\r/g, '').split('\n').map(line => line.trim()), found = [];
  const add = (name, type, body) => {
    const clean = value => text(value).replace(/\*\*|__|(^|\s)_|_(\s|$)/g, '$1$2').replace(/\*/g, '').trim();
    name = clean(name).replace(/[:.]$/, ''); type = clean(type); body = clean(body);
    if (!name || name.length > 60 || /^(feature name|type|description)$/i.test(name) || found.some(a => lower(a.name) === lower(name))) return;
    const fear = Number((type.match(/Fear\s*(\d+)/i) || body.match(/spends?\s+(\d+)\s+Fear/i) || [])[1] || 0);
    const kind = /reaction/i.test(type) ? 'Reaction' : /passive/i.test(type) && !fear ? 'Passive' : /action/i.test(type) ? 'Action' : fear ? 'Fear' : type || 'Action';
    found.push({ name, type: kind, fear, text: body });
  };
  for (const line of lines) {
    let m;
    if ((m = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|?\s*$/))) add(m[1], m[2], m[3]);
    else if ((m = line.match(/^(?:-\s*)?\*\*(.+?)\*\*\s*[_*]\((.+?)\):?[_*]:?\s*(.+)$/))) add(m[1], m[2], m[3]);
    else if ((m = line.match(/^(?:-\s*)?\*\*(.+?)\s*\(([^)]*(?:Action|Reaction|Passive|Fear)[^)]*)\)[:.]?\*\*:?\s*(.+)$/i))) add(m[1], m[2], m[3]);
    else if ((m = line.match(/^(?:-\s*)?(?:\*\*)?([A-Z][A-Za-z' -]{2,40}?)(?:\*\*)?\s*\((Fear\s*\d+[^)]*)\)\s*[:.]?\s*(.+)$/))) add(m[1], m[2], m[3]);
    else if ((m = line.match(/^-\s*\*\*(.+?)\s*[-–—]\s*(Passive|Action|Reaction):\*\*\s*(.+)$/i))) add(m[1], m[2], m[3]);
    else if ((m = line.match(/^-\s*\*\*(Poisoned Hairpin|Call in Favors|Backup):\*\*\s*(.+)$/i))) add(m[1], 'Procedimiento', m[2]);
    else if ((m = line.match(/^-\s*\*\*(Special):\*\*\s*(.+)$/))) add(m[1], 'Action', m[2]);
  }
  // Encounter objectives and service-only NPCs have procedures instead of attacks.
  for (let i = 0; i < lines.length; i++) {
    const heading = /^\*\*(Hazard|Objective|Consequence|Combat Use|Services):\*\*\s*(.*)$/i.exec(lines[i]);
    if (!heading) continue;
    let body = heading[2];
    if (!body && heading[1] === 'Services') {
      let j = i + 1;
      while (j < lines.length && !lines[j]) j++;
      while (j < lines.length && lines[j].startsWith('- ')) body += (body ? '\n' : '') + lines[j++];
    }
    if (!body) continue;
    const same = found.filter(a => a.name === heading[1] || a.name.startsWith(heading[1] + ' ')).length;
    add(heading[1] + (same ? ' ' + (same + 1) : ''), 'Procedimiento', body);
  }
  return found;
}
export function keeperCards(token) {
  const cards = [...FEAR_MOVES];
  if (token && token.isPlayer === false && token.actorType !== 'drone') {
    for (const ability of adversaryAbilities(token.featureNotes)) {
      const category = enemyCategory(ability);
      cards.push({
        id: `adversary:${token.id}:${slug(ability.name)}`, kind: 'adversary', zone: 'innate', name: ability.name, subtitle: `${token.name} · ${ability.type}${ability.fear ? ` · Fear ${ability.fear}` : ''}`,
        category, color: ability.fear ? FEAR_COLOR : '#9b150c', art: actionArt(category), costText: ability.fear ? `${ability.fear} Fear` : '—',
        cost: { ...NO_COST(), fear: ability.fear }, roll: null, rollText: '', rc: 0, swarm: ability.name === 'Swarm Tactics' && hasSwarmTactics(token), reaction: ability.type === 'Reaction', playable: ability.type !== 'Passive' || (ability.name === 'Swarm Tactics' && hasSwarmTactics(token) && token.hp?.current >= 3), text: ability.text, actorId: token.id, actorName: token.name,
      });
    }
  }
  return cards;
}
