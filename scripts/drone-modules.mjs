// Builds src/droneModules.json from the module tables of Corebook 12.06 (chapter 14) and
// Rust & Steel 12.06. Run it again if those tables change: node scripts/drone-modules.mjs
import { readFile, writeFile } from 'node:fs/promises';

const read = name => readFile(new URL(`../System/${name}`, import.meta.url), 'utf8');
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rows = (text, from, to, source, gradeOf) => {
  const out = []; let group = '';
  const lines = text.slice(text.indexOf(from), text.indexOf(to, text.indexOf(from) + from.length)).split('\n');
  for (const line of lines) {
    const heading = line.match(/^#{2,3} (.+)/); if (heading) { group = heading[1].trim(); continue; }
    const row = line.match(/^\| \*\*(.+?)\*\* \| (\d+) Cr \| (\d+) \| (.+) \|\s*$/); if (!row) continue;
    const effect = row[4].replaceAll('**', '').trim();
    out.push({ id: slug(row[1]), name: row[1], cost: Number(row[2]), slots: Number(row[3]), effect, group: group.replace(/^Common |^Restricted | in the Core$| Upgrades$/g, ''), grade: gradeOf(group, effect), source });
  }
  return out;
};
const core = await read('VeilFarers_Corebook_12_06_Corrections_FULL_SOURCE.md'), steel = await read('VeilFarers_Rust_and_Steel_12_06_Corrections_FULL_SOURCE.md');
const modules = [
  ...rows(core, '## Common Modules', '## Flight and Stealth', 'Corebook', group => /Military/.test(group) ? 'military' : 'common'),
  // Rust & Steel prints no Grade column: its upgrades are Military unless the section or the
  // text of the module says Experimental.
  ...rows(steel, '## Signal / Control Upgrades', '### Phase Blink Array', 'Rust & Steel', (group, effect) => /Experimental/.test(group) || /^Experimental/.test(effect) ? 'experimental' : 'military'),
];
const unique = modules.filter((m, i) => modules.findIndex(x => x.id === m.id) === i); // the Corebook entry wins over its Rust & Steel reprint
await writeFile(new URL('../src/droneModules.json', import.meta.url), JSON.stringify(unique, null, 1) + '\n', 'utf8');
console.log(`${unique.length} módulos de dron: ${unique.filter(m => m.source === 'Corebook').length} del Corebook, ${unique.filter(m => m.source !== 'Corebook').length} de Rust & Steel`);
