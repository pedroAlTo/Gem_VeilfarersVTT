import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const bookPath = fileURLToPath(new URL('../System/VeilFarers_Keepers_Companion_12_06_Corrections_FULL_SOURCE.md', import.meta.url));
const clean = text => text.replaceAll('*', '').replaceAll('_', '').trim();
const cells = line => line.slice(1, -1).split('|').map(clean);
export function fearCost(text) {
  const plain = clean(text);
  const costs = [...plain.matchAll(/spend(?:s|ing)?\s+(a|an|one|two|three|\d+)\s+Fear(?:\s+tokens?)?/gi)]
    .map(m => ({ a: 1, an: 1, one: 1, two: 2, three: 3 }[m[1].toLowerCase()] ?? Number(m[1])));
  // Never guess a price when a rule contains a variable or alternative expenditure.
  if (new Set(costs).size > 1 || /spend(?:s|ing)?\s+[^.!?]{0,25}(?:additional|per |or |up to)/i.test(plain)) return null;
  return costs[0] ?? (/\bspend\w*\b[^.!?]{0,25}\bFear\b/i.test(plain) ? null : 0);
}
function entries(lines, first, last) {
  const start = lines.indexOf(first), end = lines.indexOf(last, start + 1);
  if (start < 0 || end < 0) throw new Error('Missing canonical encounter section: ' + first);
  const heads = [];
  for (let i = start + 1; i < end; i++) if (/^### \d+\. /.test(lines[i])) heads.push(i);
  return heads.map((i, index) => ({
    number: Number(/^### (\d+)/.exec(lines[i])[1]), line: i + 1,
    name: lines[i].replace(/^### \d+\. /, ''),
    text: lines.slice(i + 1, heads[index + 1] ?? end).join('\n').trim(),
  }));
}
export function loadEncounters(watch = () => {}) {
  watch(bookPath);
  const lines = readFileSync(bookPath, 'utf8').replaceAll('\r', '').split('\n');
  const environments = [];
  for (const [layer, chapter, first, last] of [
    ['macro', 9, '## PART TWO: MACRO- ENVIRONMENTS (PLANETARY BIOMES)', '## PART THREE: MICRO-ENVIRONMENTS (SET PIECES)'],
    ['micro', 10, '# CHAPTER 10: MICRO-ENVIRONMENTS: THE SET PIECES', '### ADVANCED ENVIRONMENTAL RULES'],
  ]) {
    for (const entry of entries(lines, first, last)) {
      const id = `keeper-${layer}-${entry.number}`;
      const features = entry.text.split('\n').filter(line => /^\|/.test(line)).map(cells)
        .filter(row => /^(Passive|Action|Reaction|Clock)$/i.test(row[1]))
        .map(([name, type, text], index) => ({ id: `${id}-${index}`, name, type, text, fear: fearCost(text) }));
      if (!features.length) throw new Error('Environment has no parsed features: ' + entry.name);
      const tierRules = {};
      const scaling = entry.text.split('### TIER SCALING:')[1]?.split('### MECHANICAL FEATURES')[0] || '';
      for (const line of scaling.split('\n')) {
        const rule = /Tier\s+([1-4])\s*\([^\n]+/i.exec(clean(line));
        if (rule) tierRules[rule[1]] = { text: rule[0], dc: Number(/\bDC\s+(\d+)/i.exec(rule[0])?.[1]) || null };
      }
      environments.push({ ...entry, id, layer, chapter, features, tierRules,
        name: layer === 'micro' ? entry.name.replace(/\s+(?:SOCIAL|COMBAT|EXPLORATION|TRAVERSAL|INFILTRATION|SURVIVAL|CHASE|TENSION|MYSTIC|STEALTH|HAZARD|CLAUSTROPHOBIA|TECH|PUZZLE|WEIRD|SURREAL|ZERO-G|TIMER|HORROR|TACTICAL)\s.*$/, '') : entry.name,
        source: `Keeper’s Companion 12.06 · Chapter ${chapter} · línea ${entry.line}`,
      });
    }
  }
  const bosses = entries(lines, '## SECTION 2: THE BESTIARY OF PHASES', "## SECTION 3: KEEPER'S WORKSHOP - BUILDING YOUR OWN")
    .map(entry => {
      const rows = entry.text.split('\n').filter(l => l.startsWith('|') && !/^\|[\s|:-]+$/.test(l)).map(cells);
      const states = [];
      if (rows[0]?.[0].startsWith('PHASE 1:')) {
        for (let col = 0; col < rows[0].length; col++) {
          const state = { name: rows[0][col].replace(/^PHASE \d+: /, ''), trigger: 'objective', hpMode: 'pool', stats: {}, notes: '' };
          for (const row of rows.slice(1)) {
            const m = /^(HP|Evasion|Armor):\s*(\d+)/i.exec(row[col] || '');
            if (m) state.stats[m[1].toLowerCase()] = Number(m[2]);
            if (row[col]) state.notes += row[col] + '\n';
          }
          states.push(state);
        }
      } else if (rows[0]?.[0] === 'PHASE') {
        for (const row of rows.slice(1)) {
          const state = { name: row[0].replace(/^\d+ - /, ''), trigger: 'objective', hpMode: 'pool', stats: {}, notes: row.at(-1) };
          if (/^\d+(?: HP)?$/.test(row[1])) state.stats.hp = parseInt(row[1]);
          else { state.hpMode = 'keep'; state.defeat = 'objective'; }
          if (row[3] === '-') state.canAttack = false;
          for (const [key, col] of [['evasion', 2], ['attackModifier', 3]]) if (/^[+\-]?\d+$/.test(row[col])) state.stats[key] = Number(row[col]);
          const thresholds = /^(\d+)\s*\/\s*(\d+)$/.exec(row[4]);
          if (thresholds) { state.stats.majorThreshold = +thresholds[1]; state.stats.severeThreshold = +thresholds[2]; }
          states.push(state);
        }
      }
      // Objective, mixed and clock triggers must be confirmed against the printed procedure.
      const trigger = clean(entry.text).match(/The Trigger:\s*([^\n]+)/)?.[1] || '';
      if (states[1] && /When (?:Host )?HP drops to 0(?: \(First Pool\))?\./i.test(trigger)) states[1].trigger = 'hp0';
      const procedure = entry.text.split('\n').filter(line => /^(?:When a phase|Each phase is|At 0 HP|At the end of Phase|At the end of each phase|When Phase)/.test(line)).join('\n');
      const transitions = [...entry.text.matchAll(/(?:^- )?\*\*Transition (\d+):\*\*([^\n]+)/gm)];
      const narrative = /### TRANSITION:[^\n]*\n+([\s\S]*?)(?=\n- \*\*Phase|\n###|$)/.exec(entry.text)?.[1]?.trim();
      states.forEach((state, index) => {
        const abilities = entry.text.split('\n').filter(line => new RegExp('^- \\*\\*Phase ' + (index + 1) + '(?:[: ]|$)').test(line));
        state.notes += '\n' + abilities.join('\n');
        const damage = /\b\d+d\d+(?:[+-]\d+)?(?: (?:Physical|Energy|Void|Psychic))?/.exec(state.notes);
        if (damage && state.canAttack !== false) state.stats.damageExpression = damage[0];
        state.transition = [trigger, transitions.find(m => Number(m[1]) === index)?.[2] || (index === 1 ? narrative : ''), procedure].filter(Boolean).join('\n\n');
        if (index && /(?:phase reaches 0 HP|At 0 HP)/i.test(procedure)) state.trigger = 'hp0';
        if (/clear only conditions/i.test(procedure)) state.clearMode = 'choose';
      });
      return { ...entry, id: `keeper-boss-${entry.number}`, states, trigger, requiresTiming: /next Spotlight/i.test(procedure),
        source: `Keeper’s Companion 12.06 · The Bestiary of Phases · línea ${entry.line}` };
    });
  return { environments, bosses };
}
export function encounterLibraryPlugin() {
  const id = 'virtual:veil-encounters';
  return { name: 'veil-encounter-library', resolveId(value) { if (value === id) return '\0' + id; },
    load(value) { if (value === '\0' + id) return 'export default ' + JSON.stringify(loadEncounters(path => this.addWatchFile(path))); } };
}
