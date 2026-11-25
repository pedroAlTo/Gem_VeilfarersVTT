#!/usr/bin/env python3
"""Builds src/equipmentBooks.json: every piece of personal equipment of the Corebook and Rust &
Steel (12.06) that the table catalog (src/equipmentLibrary.js) does not already have.

Sources (read only): the creator's structured weapons, armor and grafts (src/creator/creatorData.js,
exported through node) and the books' own tables and item entries under System/.
Ship weapons, drone upgrades, weapon/armor modifications and services are not personal equipment
and stay out. Run from the repository root:  python3 scripts/build-equipment-books.py
"""
import json, re, subprocess, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = os.path.join(ROOT, 'System', 'VeilFarers_Corebook_12_06_Corrections_FULL_SOURCE.md')
RS = os.path.join(ROOT, 'System', 'VeilFarers_Rust_and_Steel_12_06_Corrections_FULL_SOURCE.md')
OUT = os.path.join(ROOT, 'src', 'equipmentBooks.json')

TIER_NAMES = {1: 'Common', 2: 'Military', 3: 'Experimental', 4: 'Precursor', 5: 'Precursor'}
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
clean = lambda s: re.sub(r'\*\*|\[|\]', '', str(s or '')).strip()


def node_json(expr):
    js = f"import('{ROOT}/' + process.argv[1]).then(m => console.log(JSON.stringify({expr})))"
    return json.loads(subprocess.check_output(['node', '-e', js, 'src/creator/creatorData.js']))


def credits(cost):
    m = re.search(r'(\d+(?:\.\d+)?)', str(cost or ''))
    return float(m.group(1)) if m else None


def wealth_tier(cost):
    """WT from the price (Corebook, Wealth and Acquisition): 1 / 4 / 9 / 16 / 25+ Credits."""
    m = re.search(r'WT\s*(\d)', str(cost or ''))
    if m: return int(m.group(1))
    c = credits(cost)
    if c is None: return None
    if c <= 0: return 0
    for wt, top in ((1, 1), (2, 4), (3, 9), (4, 16)):
        if c <= top: return wt
    return 5


def tier_of(text):
    """'Common (TT1)', '2', 'BLACK' → (label, rank)."""
    t = str(text or '').strip()
    m = re.search(r'TT\s*(\d)', t) or re.match(r'^\s*(\d)', t)
    if m:
        r = int(m.group(1)); name = re.sub(r'\s*\(.*\)', '', t) if not t[0].isdigit() else TIER_NAMES.get(r, 'Common')
        return f'{name} (TT{r})', r
    if t.upper() == 'BLACK': return 'Mercado negro (TT3)', 3
    return t, 1


def tables(path):
    lines = open(path, encoding='utf-8').read().split('\n'); out = []; h2 = h3 = ''; i = 0
    while i < len(lines):
        l = lines[i]
        if l.startswith('## '): h2, h3 = l[3:].strip(), ''
        elif l.startswith('### '): h3 = l[4:].strip()
        if l.startswith('|') and i + 1 < len(lines) and re.match(r'^\|\s*-', lines[i + 1]):
            header = [c.strip().upper() for c in l.strip().strip('|').split('|')]; rows = []; j = i + 2
            while j < len(lines) and lines[j].startswith('|'):
                rows.append([clean(c) for c in lines[j].strip().strip('|').split('|')]); j += 1
            out.append({'h2': h2, 'h3': h3, 'header': header, 'rows': rows}); i = j; continue
        i += 1
    return out


def entries(path, start_heading, end_heading):
    """Item entries written as '### NAME' + a STAT table + **Label:** paragraphs (Rust & Steel)."""
    lines = open(path, encoding='utf-8').read().split('\n')
    start = next(i for i, l in enumerate(lines) if l.strip() == start_heading)
    end = next(i for i, l in enumerate(lines) if i > start and l.strip() == end_heading)
    out = []; h2 = ''; i = start
    while i < end:
        l = lines[i]
        if l.startswith('## '): h2 = l[3:].strip()
        if l.startswith('### '):
            name = l[4:].strip(); j = i + 1; stats = {}; text = {}; key = None
            while j < end and not lines[j].startswith('#'):
                row = re.match(r'^\|\s*\*\*(.+?)\*\*\s*\|\s*(.*?)\s*\|?\s*$', lines[j])
                label = re.match(r'^\*\*([A-Za-z /]+?):\*\*\s*(.*)$', lines[j])
                if row: stats[row.group(1).strip()] = row.group(2).strip().rstrip('|').strip(); key = None
                elif label: key = label.group(1).strip(); text[key] = clean(label.group(2))
                elif key and lines[j].strip().startswith('-'): text[key] += ' ' + clean(lines[j].strip()[1:].strip())
                j += 1
            if 'Cost' in stats and 'Tier' in stats: out.append({'section': h2, 'name': name, 'stats': stats, 'text': text})
            i = j; continue
        i += 1
    return out


# The first entry of each group carries its group title in the heading ("ATMOSPHERIC EQUIPMENT
# EMERGENCY BREATHER"): these prefixes are the group titles, not the item's name.
GROUP_PREFIXES = [r'TIER \d [A-Z ]+? AUGMENTATIONS ', 'ATMOSPHERIC EQUIPMENT ', 'TEMPERATURE AND ENVIRONMENTAL PROTECTION ', 'FOOD AND WATER ',
                  'SHELTER AND CAMP EQUIPMENT ', 'NAVIGATION AND ORIENTATION ', 'FIRST AID AND FIELD MEDICINE ', 'PHARMACEUTICALS ', 'MEDICAL DEVICES ',
                  'BASIC TOOLS ', 'SPECIALIZED EQUIPMENT ', 'COMMUNICATIONS EQUIPMENT ', 'SENSORS AND SCANNERS ', 'SURVEILLANCE EQUIPMENT ',
                  'BYPASS EQUIPMENT ', 'DETECTION EVASION ', 'RESTRAINTS AND CONTROL ', 'LIGHTING ', 'CONTAINERS AND CARRYING ',
                  'CLOTHING AND PERSONAL EFFECTS ', 'MISCELLANEOUS EQUIPMENT ']
SMALL = {'and', 'of', 'the', 'with', 'for'}


def item_name(heading):
    for p in GROUP_PREFIXES: heading = re.sub('^' + p, '', heading)
    def cap(word):
        lead = re.match(r'^[("«]*', word).group(0); body = word[len(lead):]
        return lead + '-'.join(part[:1].upper() + part[1:] for part in body.split('-'))
    words = heading.lower().split()
    name = ' '.join(w if (i and w in SMALL) else cap(w) for i, w in enumerate(words))
    for short in ('HUD', 'EMP', 'TRS', 'HES', 'DNA', 'ID', 'AI'): name = re.sub(r'\b' + short.capitalize() + r'\b', short, name)
    return name


def section_family(section):
    s = section.upper()
    for key, fam in [('SENSORY', 'Sensory'), ('NEURAL', 'Neural'), ('PHYSICAL', 'Physical'), ('COMBAT', 'Combat'), ('UTILITY', 'Utility'), ('HOUSE', 'House'), ('STEALTH', 'Stealth'), ('INFILTRATION', 'Stealth'),
                     ('SURVIVAL', 'Supervivencia'), ('MEDICAL', 'Médico'), ('TOOLS', 'Herramientas'), ('TECH', 'Tecnología'), ('COMMUNICATION', 'Comunicaciones'), ('SECURITY', 'Seguridad e infiltración'),
                     ('PERSONAL', 'Personal y varios'), ('SURVEILLANCE', 'Vigilancia'), ('HACKING', 'Intrusión'), ('FORBIDDEN SCIENCE', 'Ciencia prohibida'), ('PROTECTIVE', 'Protección'), ('CONSUMABLE', 'Sustancias'), ('SUBSTANCE', 'Sustancias')]:
        if key in s: return fam
    return 'Varios'


def main():
    creator = node_json('{ weapons: m.CREATOR_DATA.weapons, armor: m.CREATOR_DATA.armor, grafts: m.CREATOR_DATA.humanInheritance.grafts }')
    cat = json.loads(subprocess.check_output(['node', '-e', f"import('{ROOT}/src/equipmentLibrary.js').then(m => console.log(JSON.stringify(m.EQUIPMENT_CATALOG.filter(i => !String(i.id).startsWith('bk_')).map(i => [i.id, i.name, i.category]))))"]))
    # What the table's own entries already have (not the generated «bk_» ones): by the English slug
    # in its id and by each of its names.
    have = set()
    for cid, name, _ in cat:
        have.add(norm(re.sub(r'^(core|rs)_(wp|ar|aug|gr|gear)_', '', cid).replace('_', ' ')))
        for part in str(name).split(' / '): have.add(norm(part))
    out, seen = [], set()

    def add(item):
        key = norm(item['name'])
        if key in have or key in seen: return
        seen.add(key); out.append(item)

    book = lambda pack: 'rust_and_steel' if 'rust' in str(pack) else 'core'
    for w in creator['weapons']:
        label, rank = tier_of(f"{w.get('tier', 'Common')} ({w.get('tierCode', 'TT1')})")
        add({'id': 'bk_' + slug(w['id']), 'name': w['name'], 'source': book(w.get('pack')), 'category': 'weapons', 'tier': label, 'tierRank': rank,
             'trait': w.get('trait', ''), 'damage': w.get('damage', ''), 'range': w.get('range', ''), 'burden': w.get('burden'), 'features': ', '.join(w.get('features') or []),
             'family': w.get('category', ''), 'cost': f"{w['cost']} Cr" if w.get('cost') is not None else '', 'wt': wealth_tier(w.get('cost'))})
    for a in creator['armor']:
        label, rank = tier_of(f"{a.get('tier', 'Common')} ({a.get('tierCode', 'TT1')})")
        th = a.get('thresholds') or {}
        add({'id': 'bk_' + slug(a['id']), 'name': a['name'], 'source': book(a.get('pack')), 'category': 'armor', 'tier': label, 'tierRank': rank,
             'majorThreshold': th.get('major'), 'severeThreshold': th.get('severe'), 'armorSlots': a.get('armorSlots'), 'features': ', '.join(a.get('features') or []),
             'family': a.get('category', ''), 'cost': f"{a['cost']} Cr" if a.get('cost') is not None else '', 'wt': wealth_tier(a.get('cost'))})

    for t in tables(CORE):
        h = t['header']
        if h[:3] == ['NAME', 'BENEFIT', 'DRAWBACK']:
            for r in t['rows']:
                label, rank = tier_of(r[4]); stress = r[3] if r[3] not in ('-', '—', '') else '0'
                add({'id': 'bk_core_aug_' + slug(r[0]), 'name': r[0], 'source': 'core', 'category': 'augmentations', 'tier': label, 'tierRank': rank,
                     'benefit': r[1], 'drawback': r[2], 'stressCost': int(stress) if stress.isdigit() else 0, 'family': section_family(t['h2']),
                     'cost': r[5], 'wt': wealth_tier(r[5]), 'use': r[1]})
        if h[:2] == ['NAME', 'TECH TIER'] and len(h) == 4 and h[2] in ('USE', 'RANGE'):
            for r in t['rows']:
                label, rank = tier_of(r[1])
                add({'id': 'bk_core_gear_' + slug(r[0]), 'name': r[0], 'source': 'core', 'category': 'gear', 'tier': label, 'tierRank': rank,
                     'use': r[2] if h[2] == 'USE' else f'Alcance: {r[2]}', 'family': section_family(t['h3'] or t['h2']), 'cost': r[3], 'wt': wealth_tier(r[3])})

    for e in entries(RS, '# CHAPTER 8: AUGMENTATIONS & CYBERNETICS', '# CHAPTER 9: PERSONAL EQUIPMENT & GEAR'):
        label, rank = tier_of(e['stats']['Tier']); name = item_name(e['name'])
        effect = e['text'].get('Effect', ''); desc = e['text'].get('Description', '')
        stress = re.search(r'mark (\d+) Stress', effect)
        add({'id': 'bk_rs_aug_' + slug(name), 'name': name, 'source': 'rust_and_steel', 'category': 'augmentations', 'tier': label, 'tierRank': rank,
             'benefit': effect, 'description': desc, 'complexity': e['stats'].get('Complexity'), 'installDC': e['stats'].get('Installation DC'), 'requires': e['stats'].get('Requires', ''),
             'stressCost': int(stress.group(1)) if stress else 0, 'family': section_family(e['section']), 'cost': e['stats']['Cost'], 'wt': wealth_tier(e['stats']['Cost']), 'use': effect})
    for e in entries(RS, '# CHAPTER 9: PERSONAL EQUIPMENT & GEAR', '# CHAPTER 10: WEAPON & ARMOR MODIFICATIONS'):
        label, rank = tier_of(e['stats']['Tier']); name = item_name(e['name'])
        extra = ' · '.join(f'{k}: {v}' for k, v in e['stats'].items() if k not in ('Tier', 'Cost', 'Burden'))
        desc = e['text'].get('Description', '') or e['text'].get('Effect', '')
        add({'id': 'bk_rs_gear_' + slug(name), 'name': name, 'source': 'rust_and_steel', 'category': 'gear', 'tier': label, 'tierRank': rank,
             'burden': e['stats'].get('Burden'), 'use': (extra + ('. ' if extra and desc else '') + desc).strip(), 'tactical': e['text'].get('Tactical Application', ''),
             'family': section_family(e['section']), 'cost': e['stats']['Cost'], 'wt': wealth_tier(e['stats']['Cost'])})

    # The black market (Rust & Steel ch. 17): illegal, they carry Heat. The book gives a weapon's
    # type, not its Trait: the table proposes one by family (editable on the weapon).
    trait_by_type = {'PISTOL': 'Finesse', 'SMG': 'Agility', 'RIFLE': 'Agility', 'HEAVY': 'Strength', 'MELEE': 'Strength', 'EXPLOSIVE': 'Agility', 'GRENADE': 'Agility', 'LAUNCHER': 'Agility'}
    family_by_type = {'PISTOL': 'Pistols', 'SMG': 'Pistols', 'RIFLE': 'Rifles', 'HEAVY': 'Heavy Weapons', 'MELEE': 'Melee'}
    for t in tables(RS):
        if not t['h2'].startswith('17.'): continue
        h = t['header']
        for r in t['rows']:
            if not r[0] or r[0].lower().startswith('any other'): continue
            row = dict(zip(h, r)); label, rank = tier_of(row.get('TIER', '')); heat = row.get('HEAT', '')
            if h[0] == 'WEAPON':
                kind = next((k for k in trait_by_type if k in row.get('TYPE', '').upper()), 'HEAVY')
                add({'id': 'bk_rs_bm_' + slug(r[0]), 'name': r[0].replace('"', '«', 1).replace('"', '»', 1) if r[0].count('"') == 2 else r[0], 'source': 'rust_and_steel', 'category': 'weapons',
                     'tier': label, 'tierRank': rank, 'trait': trait_by_type[kind], 'traitProposed': True, 'damage': row.get('DMG', ''), 'range': row.get('RANGE', ''), 'burden': row.get('BURDEN'),
                     'features': row.get('PROPERTIES', ''), 'family': family_by_type.get(kind, 'Heavy Weapons'), 'cost': row.get('COST', ''), 'wt': wealth_tier(row.get('COST')), 'heat': heat, 'illegal': True})
            elif h[0] == 'ARMOR':
                add({'id': 'bk_rs_bm_' + slug(r[0]), 'name': r[0], 'source': 'rust_and_steel', 'category': 'armor', 'tier': label, 'tierRank': rank,
                     'majorThreshold': int(row['MAJOR']) if row.get('MAJOR', '').isdigit() else None, 'severeThreshold': int(row['SEVERE']) if row.get('SEVERE', '').isdigit() else None,
                     'armorSlots': int(row['ARMOR SLOTS']) if row.get('ARMOR SLOTS', '').isdigit() else None, 'features': row.get('PROPERTIES', ''), 'family': row.get('TYPE', ''),
                     'cost': row.get('COST', ''), 'wt': wealth_tier(row.get('COST')), 'heat': heat, 'illegal': True})
            elif h[0] == 'AUGMENTATION':
                stress = re.search(r'mark (\d+) Stress', row.get('EFFECT', ''))
                add({'id': 'bk_rs_bm_' + slug(r[0]), 'name': r[0], 'source': 'rust_and_steel', 'category': 'augmentations', 'tier': label, 'tierRank': rank,
                     'benefit': row.get('EFFECT', ''), 'complexity': row.get('COMPLEXITY'), 'stressCost': int(stress.group(1)) if stress else 0, 'family': section_family(t['h3']),
                     'cost': row.get('COST', ''), 'wt': wealth_tier(row.get('COST')), 'use': row.get('EFFECT', ''), 'heat': heat, 'illegal': True})
            elif h[0] in ('ITEM', 'DEVICE', 'SUBSTANCE'):
                use = row.get('EFFECT') or row.get('PROCEDURE', '')
                if row.get('DURATION'): use += f" Duración: {row['DURATION']}."
                if row.get('AFTEREFFECT / DEPENDENCY'): use += f" Secuelas: {row['AFTEREFFECT / DEPENDENCY']}."
                add({'id': 'bk_rs_bm_' + slug(r[0]), 'name': r[0], 'source': 'rust_and_steel', 'category': 'gear', 'tier': label, 'tierRank': rank,
                     'use': use.strip(), 'family': section_family(t['h3']), 'cost': row.get('COST', ''), 'wt': wealth_tier(row.get('COST')), 'heat': heat, 'illegal': True})

    for item in out:
        # Precursor relics carry no price in the creator data (0): they are not bought, no WT.
        if item.get('wt') == 0 and item.get('tierRank', 1) >= 4: item['wt'] = None
        for k in [k for k, v in item.items() if v in (None, '')]: del item[k]
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    counts = {}
    for i in out: counts[f"{i['source']}/{i['category']}"] = counts.get(f"{i['source']}/{i['category']}", 0) + 1
    print(len(out), 'new items', counts)


if __name__ == '__main__':
    main()
