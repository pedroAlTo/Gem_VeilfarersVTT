#!/usr/bin/env python3
"""Builds src/weaponGlossary.json: the rule of every personal weapon property, as printed in the
Corebook 12.06 (Weapon Features Glossary) and in Rust & Steel 12.06 (2.6 New Property Glossary,
Core Rules properties reference and the Forbidden weapon properties of chapter 17).

The Corebook controls the properties it defines (Rust & Steel 12.06, «Authoritative registry»);
Rust & Steel adds the rest. The books in System/ are only read.

    python3 scripts/build-weapon-glossary.py
"""
import json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = os.path.join(ROOT, 'System', 'VeilFarers_Corebook_12_06_Corrections_FULL_SOURCE.md')
RS = os.path.join(ROOT, 'System', 'VeilFarers_Rust_and_Steel_12_06_Corrections_FULL_SOURCE.md')
OUT = os.path.join(ROOT, 'src', 'weaponGlossary.json')

def slug(value):
    value = unicodedata.normalize('NFD', value.lower())
    value = ''.join(c for c in value if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-')

def clean(text):
    text = re.sub(r'\*\*|\*|_', '', text)
    return re.sub(r'\s+', ' ', text).strip()

def section(lines, start, stop):
    a = next(i for i, l in enumerate(lines) if l.startswith(start))
    b = next(i for i, l in enumerate(lines[a + 1:], a + 1) if l.startswith(stop))
    return lines[a:b]

out = {}
def put(key, name, book, rule, override=False):
    if key and rule and (override or key not in out):
        out[key] = {'name': name, 'book': book, 'rule': clean(rule)}

core = open(CORE, encoding='utf-8').read().split('\n')
for line in section(core, '## WEAPON FEATURES GLOSSARY', '## ARMOR: THE RULES'):
    m = re.match(r'^- \*\*(.+?)\.\*\* (.+)$', line)
    if m: put(slug(m.group(1)), m.group(1), 'Corebook 12.06', m.group(2))

# Crushing is a Core weapon tag defined with the damage types (ch. 10), not in the glossary.
for line in core:
    m = re.match(r'^- \*\*Crushing\*\* is a weapon tag [^:]*: (.+)$', line)
    if m: put('crushing', 'Crushing', 'Corebook 12.06', m.group(1)[0].upper() + m.group(1)[1:]); break

rs = open(RS, encoding='utf-8').read().split('\n')
# 2.6: «### [NEW] NAME» (the first one also carries «WEAPON PROPERTIES»), then «**Effect:** …».
block = section(rs, '## 2.6: NEW PROPERTY GLOSSARY', '### ARMOR PROPERTIES')
name = None
for line in block:
    head = re.match(r'^### (?:WEAPON PROPERTIES )?\[(?:NEW|CR)\] (.+)$', line)
    if head: name = head.group(1).strip().title().replace('-Up', '-Up'); continue
    effect = re.match(r'^\*\*Effect:\*\* (.+)$', line)
    if effect and name:
        put(slug(name), name, 'Rust & Steel 12.06', effect.group(1)); name = None
# Core Rules properties (reference): the compatibility spellings, «- **Name** means …».
for line in section(rs, '### CORE RULES PROPERTIES (REFERENCE)', '# CHAPTER 3'):
    m = re.match(r'^- \*\*([A-Za-z -]+?)(?: \([a-z]+\))?\*\* (?:\([^)]*\) )?(.+)$', line)
    if m: put(slug(m.group(1)), m.group(1), 'Rust & Steel 12.06', m.group(1) + ' ' + m.group(2))
# Forbidden weapon properties (17.1): «**[Name]:** …», «**[One-Shot] / [One-Use]:** …».
for line in section(rs, '### NEW WEAPON PROPERTIES (FORBIDDEN)', '## 17.2'):
    m = re.match(r'^\*\*((?:\[[^\]]+\](?: / )?)+):\*\* (.+)$', line)
    if not m: continue
    for raw in re.findall(r'\[([^\]]+)\]', m.group(1)):
        label = re.sub(r'\s*\((?:N|band)\)$', '', raw)
        key = slug(label) + ('-band' if raw.endswith('(band)') else '')
        put(key, label, 'Rust & Steel 12.06 · Forbidden', m.group(2))

# Properties defined where their weapon is (chapters 3-5): «**[NEW] Unwieldy Property:** …».
armor_at = next(i for i, l in enumerate(rs) if l.startswith('# CHAPTER 7'))
for line in rs[:armor_at]:
    m = re.match(r'^\*\*\[NEW\] ([A-Za-z -]+?) Property:\*\* (.+)$', line)
    if m: put(slug(m.group(1)), m.group(1), 'Rust & Steel 12.06', m.group(2))
# Classifications without a rule (17.2): Restricted, Disturbing, Prototype, Forbidden, Precursor.
for line in rs:
    m = re.match(r'^\*\*((?:\[[A-Za-z]+\](?:, )?){3,}):\*\* (.+)$', line)
    if m:
        for label in re.findall(r'\[([^\]]+)\]', m.group(1)): put(slug(label), label, 'Rust & Steel 12.06 · Forbidden', m.group(2))

# Identical names: the Corebook entry stays; Rust & Steel's Bleeding is the table's «bleed».
if 'bleeding' in out: out['bleed'] = out.pop('bleeding')
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(dict(sorted(out.items())), f, ensure_ascii=False, indent=1)
    f.write('\n')
print(f'{len(out)} propiedades en {os.path.relpath(OUT, ROOT)}')
