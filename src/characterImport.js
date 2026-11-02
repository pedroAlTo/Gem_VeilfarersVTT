// Character Sheet 2.80 exports use final Traits/thresholds and separate resource tracks.
// Keep the original document intact, including fields that this VTT cannot automate.
export const TRAIT_IDS = ['agility', 'strength', 'finesse', 'knowledge', 'instinct', 'presence'];
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const text = v => v == null ? '' : String(v);
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
    for (const k of ['id', 'mapId', 'x', 'y', 'ownerId']) delete token[k];
    return { token, missing: [], warnings: [], format: 'VTT Actor 1' };
  }
  if (doc.app !== 'Veilfarers Character Sheet' || !object(doc.fields) || !object(doc.tracks?.max) || !object(doc.tracks?.current))
    throw new Error('Formato no reconocido. Usa Veilfarers Character Sheet o Veilfarers VTT Actor; las sesiones se importan en Sesiones.');
  const f = doc.fields, max = doc.tracks.max, current = doc.tracks.current;
  if (!text(f.name).trim()) throw new Error('La ficha no tiene nombre.');
  if (!['Awakened', 'Sleeping'].includes(f.chosen_path)) throw new Error('chosen_path debe ser Awakened o Sleeping.');
  const path = f.chosen_path, missing = [], warnings = [];
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
    level: number(f.level, 'Nivel', 1, 100), proficiency: number(f.prof, 'Proficiency', 1, 100),
    evasion: number(f.evasion, 'Evasion', 0, 100),
    traits: Object.fromEntries(TRAIT_IDS.map(k => [k, number(f[`tr_${k}`], k, -100, 100)])),
    hp, armor, stress, hope: hope.current, effort: effort.current, resolve,
    hopeMax: hope.max, effortMax: effort.max,
    honedEdgeBonus: f.s_honed ? number(text(f.s_honed).replace(/^HONED EDGE\s*([+-]?\d+)\s*DAMAGE$/i, '$1'), 'Honed Edge', 0, 100) : 0,
    recoveryAnchor: text(f.s_anchor),
    sourceCharacter: { format: 'character-sheet', document: doc, initializedResources: [] },
  };
  if (missing.length) warnings.push('El archivo no incluye todos los recursos actuales. Revisa los valores iniciales antes de importar.');
  if (!/^2\.80(?:\b|-)/.test(text(doc.version))) warnings.push(`Versión ${text(doc.version) || 'sin indicar'}: se han leído los campos reconocidos; revisa la ficha.`);
  return { token, missing, warnings, format: `Character Sheet ${doc.version || ''}` };
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
export function characterDetails(token) {
  const f = token.sourceCharacter?.document?.fields || {};
  const prefix = token.path === 'Sleeping' ? 's' : 'a';
  const indexed = (regex, build) => Object.keys(f).filter(k => regex.test(k)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).filter(k => text(f[k]).trim()).map(build);
  return {
    experiences: indexed(new RegExp(`^${prefix}_exp_\\d+$`), k => ({ name: text(f[k]), bonus: text(f[`${k}_bonus`]) })),
    weapons: ['wpri', 'wsec'].filter(p => f[`${p}_name`]).map(p => ({ name: text(f[`${p}_name`]), trait: text(f[`${p}_trait`]), damage: text(f[`${p}_dmg_final${token.path === 'Awakened' ? '_aw' : ''}`] || f[`${p}_dmg_final`] || f[`${p}_dmg`]), features: text(f[`${p}_feat`]), tier: text(f[`${p}_tier`]) })),
    armor: [f.armor_name, f.armor_tier, f.armor_feat].filter(Boolean).join(' · '),
    features: [
      ['Clase / subclase · referencia importada', f.features],
      [f[`${prefix}_featname`] || 'Rasgo de senda', f[`${prefix}_feattext`]],
      ['Ancestry', [f.ancestry_gift, f.ancestry_note].filter(Boolean).join('\n\n')],
      ['Comunidad', [f.community_gift, f.community_note, f.community_advantages].filter(Boolean).join('\n\n')],
      ['Competencias', f.class_proficiencies],
      ...(prefix === 's' ? [[f.s_active_move || 'Movimiento activo', f.s_active_move_text], ['Movimientos aprendidos', f.s_learned_moves]] : []),
    ].filter(([, value]) => value && value !== '[]'),
    domains: prefix === 'a' ? text(f.a_domain_ref) : '',
    powers: prefix === 'a' ? indexed(/^a_pwr_\d+_n$/, k => ({ name: text(f[k]), description: text(f[k.replace(/_n$/, '_d')]), recall: text(f[k.replace(/_n$/, '_rc')]) })) : [],
    equipment: indexed(/^eq_\d+_name$/, k => ({ name: text(f[k]), tier: text(f[k.replace(/_name$/, '_tier')]), quantity: text(f[k.replace(/_name$/, '_qty')]), use: text(f[k.replace(/_name$/, '_use')]) })),
    notes: [['Equipo', f.equipment_notes], ['Notas', f[`${prefix}_quick_notes`]], ['Motivación', f.seed_motive], ['Vínculos', [f.conn_first, f.conn_debt, f.conn_friction].filter(Boolean).join('\n\n')]].filter(([, v]) => v),
  };
}
export function exportSystemCharacter(token) {
  if (!token.sourceCharacter?.document) throw new Error('Este actor no procede del creador de fichas. Exporta el formato VTT.');
  const doc = structuredClone(token.sourceCharacter.document), f = doc.fields;
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
  for (const key of ['id', 'mapId', 'x', 'y', 'ownerId']) delete portable[key];
  return { app: 'Veilfarers VTT Actor', version: 1, token: portable };
}
export function downloadJSON(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
