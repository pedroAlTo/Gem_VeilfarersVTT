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
function readStats(book, lines) {
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
          entry.armor = numberAfter(stats, 'Armor Slots');
          entry.evasion = numberAfter(stats.replaceAll('|', ' '), 'Evasion');
          entry.attack = numberAfter(stats, 'Attack');
          entry.major = numberAfter(stats, 'Major');
          entry.severe = numberAfter(stats, 'Severe');
          entry.damage = (/(?:Damage|Weapons):?\s+(.+?)(?=\s+(?:Stress|Thresholds)\b|\s*[·|]|$)/i.exec(stats)?.[1] || '').trim();
          const traitLine = body.find(line => /^- \*\*Traits:/.test(line));
          if (traitLine) {
            const traits = Object.fromEntries(['Agility', 'Strength', 'Finesse', 'Instinct', 'Presence', 'Knowledge'].map(name => [name.toLowerCase(), numberAfter(traitLine.replaceAll('*', ''), name)]));
            if (Object.values(traits).every(Number.isFinite)) entry.traits = traits;
          }
          entry.deployable = [entry.hp, entry.evasion, entry.attack, entry.major, entry.severe].every(Number.isFinite) && entry.hp > 0 && !!entry.damage;
          entry.text = body.join('\n').trim();
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
