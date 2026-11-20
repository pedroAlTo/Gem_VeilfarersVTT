import { profileDescription } from '../src/adversaryDescription.js';
import { placementMode } from '../src/bestiaryProfiles.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const books = [
  ['Alien Species', 'VeilFarers_Alien_Species', 'Threats and Adversaries', '## TIER 1: VERMIN AND SWARMS', '## BOSS ENCOUNTER DESIGN'],
  ['Keeper’s Companion', 'VeilFarers_Keepers_Companion', 'Chapter 12 · The Galactic Bestiary, Section A', '## SECTION A: STANDARD ADVERSARIES', '### LOOT TABLES: WHAT REMAINS'],
  ['Rust & Steel', 'VeilFarers_Rust_and_Steel', 'Chapter 15 · §15.3 Broker Profiles', '## 15.3: BROKER PROFILES', '## 15.4: CREATING CUSTOM BROKERS'],
];
const numberAfter = (text, label) => {
  const match = text.match(new RegExp('(?:^|\\s)' + label + ':?\\s*([+-]?\\d+)\\b', 'i'));
  return match ? Number(match[1]) : null;
};

// The editorial ledger is the single source for unprinted values. Published figures take precedence.
function readProposals(watch) {
  const file = fileURLToPath(new URL('../docs/bestiario-pendientes-core.md', import.meta.url));
  watch(file);
  const proposals = new Map();
  for (const row of readFileSync(file, 'utf8').split('\n').filter(row => /^\| (AS|KC) \|/.test(row))) {
    const [book, name, major, severe, armor, stress, reason] = row.slice(1, -1).split('|').map(cell => cell.trim());
    const stats = {};
    for (const [key, value] of Object.entries({ major, severe, armor, stress })) {
      if (value === '—') continue;
      if (!/^\d+$/.test(value)) throw new Error('Invalid editorial value for ' + name + ' / ' + key);
      stats[key] = Number(value);
    }
    const id = (book === 'AS' ? 'VeilFarers_Alien_Species/' : 'VeilFarers_Keepers_Companion/') + name;
    if (proposals.has(id) || !reason) throw new Error('Invalid editorial row for ' + id);
    proposals.set(id, { stats, reason });
  }
  return proposals;
}
function readStats(book, lines) {
  if (book === 'Alien Species') {
    const row = lines.find(line => /^\*\*Evasion\*\*\s*\d/i.test(line)) || '';
    return row.replace(/\s+(?=\*\*(?:HP|Attack|Damage|Stress|Thresholds|Armor Slots)\*\*)/gi, ' | ').replaceAll('*', '');
  }
  const plain = lines.map(line => line.replaceAll('*', '').trim());
  if (book === 'Rust & Steel') {
    const start = plain.findIndex(line => /^Stats \(Tier /.test(line));
    if (start < 0) return '';
    return plain.slice(start + 1).filter(line => /^- (?:Evasion|Thresholds|Attack|Weapons|Damage):/.test(line)).join(' | ').replaceAll(' | - ', ' | ');
  }
  return plain.find(line => /^Evasion[: ]+\d/.test(line)) || '';
}
export function loadAdversaries(watch = () => {}) {
  const entries = [];
  const proposals = readProposals(watch);
  for (const [book, prefix, section, first, last] of books) {
    const file = fileURLToPath(new URL('../System/' + prefix + '_12_06_Corrections_FULL_SOURCE.md', import.meta.url));
    watch(file);
    const lines = readFileSync(file, 'utf8').replaceAll('\r', '').split('\n');
    const start = lines.indexOf(first), end = lines.indexOf(last, start + 1);
    if (start < 0 || end < 0) throw new Error('Missing bestiary section in ' + book);
    let entry;
    for (let i = start + 1; i <= end; i++) {
      const line = lines[i];
      const heading = book === 'Keeper’s Companion'
        ? /^### \d+\. (.+?) TIER (\d+) (.+)$/.exec(line)
        : /^### (.+)$/.exec(line);
      if (i === end || heading || /^## |^### TIER \d+:/.test(line)) {
        if (entry) {
          const body = lines.slice(entry.line, i);
          const stats = readStats(book, body);
          const tierRole = body.find(line => /^_Tier \d|^\*\*Stats \(Tier \d/.test(line)) || '';
          const profile = tierRole.replace(/^_Tier |^\*\*Stats \(Tier /, '').replace(/\):\*\*$|_$/g, '');
          entry.tier ??= numberAfter('Tier ' + profile, 'Tier');
          entry.role ||= profile.replace(/^\d+\s*/, '');
          entry.hp = numberAfter(stats, 'HP');
          entry.stress = numberAfter(stats, 'Stress');
          if (/\bStress\s*[-—–](?=\s*[|·]|$)/i.test(stats)) entry.stress = 0;
          entry.armor = numberAfter(stats, 'Armor Slots');
          entry.evasion = numberAfter(stats.replaceAll('|', ' '), 'Evasion');
          entry.attack = numberAfter(stats, 'Attack');
          entry.major = numberAfter(stats, 'Major');
          entry.severe = numberAfter(stats, 'Severe');
          entry.damage = (/(?:Damage|Weapons):?\s+([^·|]+)/i.exec(stats)?.[1] || '').trim();
          const traitLine = body.find(line => /^- \*\*Traits:/.test(line));
          if (traitLine) {
            const traits = Object.fromEntries(['Agility', 'Strength', 'Finesse', 'Instinct', 'Presence', 'Knowledge'].map(name => [name.toLowerCase(), numberAfter(traitLine.replaceAll('*', ''), name)]));
            if (Object.values(traits).every(Number.isFinite)) entry.traits = traits;
          }
          const proposal = proposals.get(entry.id);
          if (proposal) {
            entry.provisional = {};
            for (const [key, value] of Object.entries(proposal.stats)) {
              if (entry[key] != null) continue;
              entry[key] = value;
              entry.provisional[key] = value;
            }
            if (Object.keys(entry.provisional).length) entry.proposalReason = proposal.reason;
            proposals.delete(entry.id);
          }
          entry.perHit = /\bminion\b/i.test(entry.role) && entry.major == null && entry.severe == null &&
            (/\bThresholds\s+None\b/i.test(stats) || entry.hp === 1);
          entry.placement = placementMode(entry);
          entry.text = body.join('\n').trim();
          entry.description = profileDescription(entry.text);
          entries.push(entry);
          entry = null;
        }
        if (i !== end && heading && !/^### TIER \d+:/.test(line)) {
          const name = heading[1].trim();
          entry = { id: prefix + '/' + name, book, section, line: i + 1, name, tier: heading[2] ? Number(heading[2]) : null, role: heading[3] || '' };
        }
      }
    }
  }
  if (proposals.size) throw new Error('Unknown adversary in editorial ledger: ' + [...proposals.keys()].join(', '));
  return entries;
}
export function adversaryLibraryPlugin() {
  const moduleId = 'virtual:veil-adversaries';
  return {
    name: 'veil-adversary-library',
    resolveId(id) { if (id === moduleId) return '\0' + moduleId; },
    load(id) {
      if (id !== '\0' + moduleId) return;
      return 'export default ' + JSON.stringify(loadAdversaries(path => this.addWatchFile(path)));
    },
  };
}
