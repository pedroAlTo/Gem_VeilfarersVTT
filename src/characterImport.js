import { tokenInventory } from './equipment.js';
import { defaultTokenAvatar } from './tokenAvatars.js';
// Character Sheet 2.80 exports use final Traits/thresholds and separate resource tracks.
// Keep the original document intact, including fields that this VTT cannot automate.
export const TRAIT_IDS = ['agility', 'strength', 'finesse', 'knowledge', 'instinct', 'presence'];
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const text = v => v == null ? '' : String(v);
const flag = v => v === true || ['true', 'on', '1', 'yes', 'x'].includes(text(v).trim().toLowerCase());
function number(value, label, min = 0, max = 10000) {
  if (value === '' || value == null || typeof value === 'boolean' || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max)
    throw new Error(`${label}: se necesita un entero entre ${min} y ${max}.`);
  return Number(value);
}
export function characterKey(token) {
  const id = token.sourceCharacter?.document?.fields?.character_id;
  return id ? `system:${id}` : `name:${[token.name, token.characterClass, token.species, token.path].map(v => text(v).normalize('NFKC').trim().toLowerCase()).join('|')}`;
}
export function parseCharacterJSON(input) {
  const doc = typeof input === 'string' ? JSON.parse(input.replace(/^\uFEFF/, '')) : structuredClone(input);
  if (!object(doc)) throw new Error('El JSON debe contener una ficha.');
  if (doc.app === 'Veilfarers VTT Actor' && doc.version === 1 && object(doc.token)) {
    const token = structuredClone(doc.token);
    if (!text(token.name).trim() || !object(token.hp) || !object(token.stress) || !object(token.armor)) throw new Error('El actor VTT debe incluir nombre, HP, Armor y Stress.');
    // Native exports are portable actors, never a tactical ID or a campaign snapshot.
    for (const k of ['id', 'mapId', 'x', 'y', 'ownerId', 'controllerIds', 'scenePositions']) delete token[k];
    if (!token.avatarUrl || token.avatarUrl === '/assets/tokens/captain_harker.jpg') {
      token.avatarUrl = defaultTokenAvatar(token.species, token.pronouns, token.name);
    }
    return { token, missing: [], warnings: [], format: 'VTT Actor 1' };
  }
  const isSheet = doc.app === 'Veilfarers Character Sheet';
  const isCreator = doc.app === 'Veilfarers Character Creator';
  if ((!isSheet && !isCreator) || !object(doc.fields))
    throw new Error('Formato no reconocido. Usa Veilfarers Character Sheet, Veilfarers Character Creator o Veilfarers VTT Actor; las sesiones se importan en Sesiones.');
  doc.tracks ||= {};
  doc.tracks.max ||= {};
  doc.tracks.current ||= {};
  if (!object(doc.tracks.max) || !object(doc.tracks.current))
    throw new Error('Formato no reconocido. Usa Veilfarers Character Sheet, Veilfarers Character Creator o Veilfarers VTT Actor; las sesiones se importan en Sesiones.');
  const f = doc.fields, max = doc.tracks.max, current = doc.tracks.current;
  if (!text(f.name).trim()) throw new Error('La ficha no tiene nombre.');
  if (max.hp == null && (f.base_hp_max || f.hp_max)) max.hp = Number(f.base_hp_max || f.hp_max);
  if (max.armor_slots == null && (f.base_armor_slots || f.armor_score)) max.armor_slots = Number(f.base_armor_slots || f.armor_score);
  if (max.stress == null && f.base_stress_max) max.stress = Number(f.base_stress_max);
  if (max.s_resolve == null && f.auto_resolve_floor) max.s_resolve = Number(f.auto_resolve_floor);
  let path = f.chosen_path;
  if (path && typeof path === 'string') {
    const trimmed = path.trim();
    if (/^sleeping/i.test(trimmed)) path = 'Sleeping';
    else if (/^awakened/i.test(trimmed)) path = 'Awakened';
    else throw new Error('chosen_path debe ser Awakened o Sleeping.');
  } else {
    if (
      max.s_resolve != null ||
      max.s_effort != null ||
      f.s_active_move ||
      f.s_featname ||
      f.s_learned_moves ||
      f.s_move_0_n ||
      f.s_anchor ||
      f.s_resolve_die ||
      (f.a_domain_ref && /sleeping/i.test(f.a_domain_ref))
    ) {
      path = 'Sleeping';
    } else if (
      max.a_hope != null ||
      f.a_pwr_0_n ||
      (f.a_domain_ref && !/sleeping/i.test(f.a_domain_ref))
    ) {
      path = 'Awakened';
    } else {
      path = 'Sleeping';
    }
  }
  f.chosen_path = path;
  const missing = [], warnings = [];
  const resource = (key, label, requiredMax = true) => {
    const cap = number(max[key] ?? (requiredMax ? undefined : key === 's_resolve' ? 2 : 6), `${label} máximo`, key === 'hp' ? 1 : 0, ['a_hope', 's_effort'].includes(key) ? 6 : 10000);
    let value = current[key];
    if (value == null || value === '') {
      // Explicit review is mandatory before these placeholders become live resources.
      if (['hp', 'armor_slots', 'stress', path === 'Awakened' ? 'a_hope' : 's_effort', ...(path === 'Sleeping' ? ['s_resolve'] : [])].includes(key)) missing.push({ key, label, max: cap });
      value = ['hp', 'armor_slots'].includes(key) ? cap : 0;
    }
    return { current: number(value, label, 0, cap), max: cap };
  };
  const hp = resource('hp', 'HP');
  hp.majorThreshold = number(f.thr_major, 'Umbral Major');
  hp.severeThreshold = number(f.thr_severe, 'Umbral Severe', hp.majorThreshold);
  const armor = resource('armor_slots', 'Armor'), stress = resource('stress', 'Stress');
  const hope = resource('a_hope', 'Hope', false), effort = resource('s_effort', 'Effort', false), resolve = resource('s_resolve', 'Resolve', false);
  resolve.dieType = f.s_resolve_die || 'd4';
  if (!['d4', 'd6'].includes(resolve.dieType)) throw new Error('Resolve: tipo de dado no admitido.');
  const token = {
    name: text(f.name).trim(), actorType: 'player', isPlayer: true, path,
    characterClass: text(f.class), subclass: text(f.subclass), subclassRank: text(f.subclass_rank),
    species: text(f.ancestry), community: text(f.community), pronouns: text(f.pron),
    roleTag: [f.class, f.subclass].filter(Boolean).join(' · '),
    avatarUrl: defaultTokenAvatar(f.ancestry, f.pron, f.name),
    level: number(f.level, 'Nivel', 1, 100), proficiency: number(f.prof, 'Proficiency', 1, 100),
    evasion: number(f.evasion, 'Evasion', 0, 100),
    traits: Object.fromEntries(TRAIT_IDS.map(k => [k, number(f[`tr_${k}`], k, -100, 100)])),
    hp, armor, stress, hope: hope.current, effort: effort.current, resolve,
    hopeMax: hope.max, effortMax: effort.max,
    honedEdgeBonus: (() => {
      const m = text(f.s_honed).match(/^HONED EDGE\s*([+-]?\d+)\s*DAMAGE$/i) || text(f.s_honed).match(/([+-]?\d+)/);
      return (f.s_honed && m) ? number(m[1], 'Honed Edge', 0, 100) : 0;
    })(),
    recoveryAnchor: text(f.s_anchor),
    sourceCharacter: { format: 'character-sheet', document: doc, initializedResources: [] },
  };
  if (missing.length) warnings.push('El archivo no incluye todos los recursos actuales. Revisa los valores iniciales antes de importar.');
  if (isSheet && !/^2\.8\d(?:\b|-)/.test(text(doc.version))) {
    warnings.push(`Versión ${text(doc.version) || 'sin indicar'}: se han leído los campos reconocidos; revisa la ficha.`);
  } else if (isCreator && !/^2\./.test(text(doc.version))) {
    warnings.push(`Versión ${text(doc.version) || 'sin indicar'}: se han leído los campos reconocidos; revisa la ficha.`);
  }
  return { token, missing, warnings, format: isCreator ? `Character Creator ${doc.version || ''}`.trim() : `Character Sheet ${doc.version || ''}`.trim() };
}
export function initializeImportedResources(parsed, values) {
  const token = structuredClone(parsed.token);
  for (const entry of parsed.missing) {
    const value = number(values[entry.key], entry.label, 0, entry.max);
    const key = { hp: 'hp', armor_slots: 'armor', stress: 'stress', s_resolve: 'resolve' }[entry.key];
    if (key) token[key].current = value;
    else token[entry.key === 'a_hope' ? 'hope' : 'effort'] = value;
  }
  if (token.sourceCharacter && parsed.missing.length) token.sourceCharacter.initializedResources = parsed.missing.map(x => x.key);
  return token;
}
// Sheet fields come from the imported document; actors made in the VTT keep theirs in sheetFields.
const sheetFields = token => token.sourceCharacter?.document?.fields || token.sheetFields || {};
export function characterDetails(token) {
  const f = sheetFields(token);
  const inventory = tokenInventory(token);
  const prefix = token.path === 'Sleeping' ? 's' : 'a';
  const indexed = (regex, build) => Object.keys(f).filter(k => regex.test(k)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).filter(k => text(f[k]).trim()).map(build);
  return {
    experiences: indexed(new RegExp(`^${prefix}_exp_\\d+$`), k => ({ name: text(f[k]), bonus: text(f[`${k}_bonus`]) })),
    weapons: inventory.weapons,
    armor: [f.armor_name, f.armor_tier, f.armor_feat].filter(Boolean).join(' · '),
    features: [
      ['Clase / subclase · referencia importada', f.features],
      [f[`${prefix}_featname`] || 'Rasgo de senda', f[`${prefix}_feattext`]],
      ['Ancestry', [f.ancestry_gift, f.ancestry_note].filter(Boolean).join('\n\n')],
      ['Comunidad', [f.community_gift, f.community_note, f.community_advantages].filter(Boolean).join('\n\n')],
      ['Competencias', f.class_proficiencies],
      ['Aumentos', [...indexed(/^aug_\d+_name$/, k => [f[k], f[k.replace('_name', '_tier')], f[k.replace('_name', '_benefit')], f[k.replace('_name', '_deg')]].filter(Boolean).join(' · ')), f.augment_notes].filter(Boolean).join('\n')],
      ...(prefix === 's' ? [[f.s_active_move || 'Movimiento activo', f.s_active_move_text], ['Movimientos aprendidos', f.s_learned_moves]] : []),
    ].filter(([, value]) => value && value !== '[]'),
    domains: prefix === 'a' ? text(f.a_domain_ref) : '',
    powers: prefix === 'a' ? indexed(/^a_pwr_\d+_n$/, k => ({ name: text(f[k]), description: text(f[k.replace(/_n$/, '_d')]), recall: text(f[k.replace(/_n$/, '_rc')]) })) : [],
    equipment: inventory.items,
    notes: [['Equipo', f.equipment_notes], ['Notas', f[`${prefix}_quick_notes`]]].filter(([, v]) => v),
    // Corebook ch. 8: who the character answers to, who they are tied to and why they fly.
    affiliations: [['affiliation', 'aff_'], ['aff_2_affiliation', 'aff_2_'], ['aff_3_affiliation', 'aff_3_']]
      .map(([nameKey, p]) => ({ name: text(f[nameKey]).trim(), standing: text(f[`${p}standing`]).trim(), reputation: text(f[`${p}reputation`]).trim(), callUsed: flag(f[`${p}call`]), prefix: p }))
      .filter(a => a.name || a.standing || a.reputation),
    // All three slots of the sheet, filled or not, for editing.
    affiliationSlots: [['affiliation', 'aff_'], ['aff_2_affiliation', 'aff_2_'], ['aff_3_affiliation', 'aff_3_']]
      .map(([nameKey, p]) => ({ name: text(f[nameKey]).trim(), standing: text(f[`${p}standing`]).trim(), reputation: text(f[`${p}reputation`]).trim(), callUsed: flag(f[`${p}call`]), prefix: p })),
    connectionSlots: [['First Bond', 'conn_first'], ['Open Debt', 'conn_debt'], ['Friction', 'conn_friction']].map(([label, key]) => ({ label, key, value: text(f[key]).trim() })),
    affiliationTokens: text(f.aff_tokens).trim(),
    factionNotes: [f.aff_notes, f.aff_faction_notes].map(v => text(v).trim()).filter(Boolean).join('\n\n'),
    connections: [['First Bond', f.conn_first], ['Open Debt', f.conn_debt], ['Friction', f.conn_friction]].map(([k, v]) => [k, text(v).trim()]).filter(([, v]) => v),
    seeds: [['What keeps you flying?', f.seed_motive], ['Who are you afraid to lose?', f.seed_afraid], ['Why does this crew matter?', f.seed_crew], ['What did the road take?', f.seed_loss]].map(([k, v]) => [k, text(v).trim()]).filter(([, v]) => v),
    signatureTrait: text(f.signature_trait).trim(),
    loadoutCap: prefix === 'a' ? text(f.a_loadout_cap).trim() : '',
    vault: prefix === 'a' ? text(f.a_vault).trim() : '',
  };
}
// Affiliations and connections change during play. They are written where the sheet keeps
// them, so exporting back to the creator format preserves them.
const AFFILIATION_NAME = { aff_: 'affiliation', aff_2_: 'aff_2_affiliation', aff_3_: 'aff_3_affiliation' };
function writableFields(token) {
  if (token.sourceCharacter?.document?.fields) return token.sourceCharacter.document.fields;
  return token.sheetFields ||= {};
}
export function setAffiliation(token, prefix, { name, standing, reputation, callUsed }) {
  if (!(prefix in AFFILIATION_NAME)) throw new Error('Esta ficha no tiene esa afiliación.');
  const fields = writableFields(token);
  if (name !== undefined) fields[AFFILIATION_NAME[prefix]] = text(name).trim().slice(0, 120);
  fields[`${prefix}standing`] = text(standing).trim().slice(0, 40);
  fields[`${prefix}reputation`] = text(reputation).trim().slice(0, 120);
  fields[`${prefix}call`] = !!callUsed;
  return token;
}
export function setConnection(token, key, value) {
  if (!['conn_first', 'conn_debt', 'conn_friction'].includes(key)) throw new Error('Conexión desconocida.');
  writableFields(token)[key] = text(value).trim().slice(0, 2000);
  return token;
}
export function exportSystemCharacter(token) {
  if (!token.sourceCharacter?.document) throw new Error('Este actor no procede del creador de fichas. Exporta el formato VTT.');
  const doc = structuredClone(token.sourceCharacter.document), f = doc.fields;
  doc.tracks ||= {}; doc.tracks.max ||= {}; doc.tracks.current ||= {};
  Object.assign(f, { name: token.name, level: String(token.level), prof: String(token.proficiency), chosen_path: token.path, ancestry: token.species || '', community: token.community || '', class: token.characterClass || '', subclass: token.subclass || '', evasion: String(token.evasion), thr_major: String(token.hp.majorThreshold), thr_severe: String(token.hp.severeThreshold) });
  for (const key of TRAIT_IDS) f[`tr_${key}`] = String(token.traits[key]);
  for (const [key, source] of [['hp', 'hp'], ['stress', 'stress'], ['armor_slots', 'armor'], ['s_resolve', 'resolve']]) {
    doc.tracks.max[key] = token[source].max;
    doc.tracks.current[key] = token[source].current;
  }
  doc.tracks.current.a_hope = token.hope;
  doc.tracks.current.s_effort = token.effort;
  doc.tracks.max.a_hope = token.hopeMax ?? 6;
  doc.tracks.max.s_effort = token.effortMax ?? 6;
  f.s_resolve_die = token.resolve.dieType;
  f.s_honed = `HONED EDGE +${token.honedEdgeBonus ?? 0} DAMAGE`;
  f.s_anchor = token.recoveryAnchor || '';
  doc.exportedAt = new Date().toISOString();
  return doc;
}
export function exportNativeCharacter(token) {
  const portable = structuredClone(token);
  for (const key of ['id', 'mapId', 'x', 'y', 'ownerId', 'controllerIds', 'scenePositions']) delete portable[key];
  return { app: 'Veilfarers VTT Actor', version: 1, token: portable };
}
export function downloadJSON(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
