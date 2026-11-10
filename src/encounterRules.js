import { newId } from './persistence.js';
import { CONDITIONS, normalizeConditions } from './conditions.js';

const check = (ok, message) => { if (!ok) throw new Error(message); };
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const short = (value, limit = 300) => typeof value === 'string' && value.length <= limit;
export const isKeeper = (state, sessionRole) => sessionRole !== 'player' && state.userRole === 'keeper';
export const IMPACT_TYPES = { auto: 'Según arma', ballistic: 'Balística · metralla', plasma: 'Láser / plasma', fire: 'Fuego', cryo: 'Criogénesis', explosion: 'Explosión', melee: 'Cuerpo a cuerpo' };
export function validateEnvironment(env) {
  if (env == null) return;
  check(env && typeof env === 'object' && !Array.isArray(env), 'Entorno inválido.');
  for (const k of ['microId', 'macroId', 'macroFeatureId']) check(short(env[k] ?? ''), 'Referencia ambiental inválida.');
  check(integer(env.tier, 1, 4), 'El tier ambiental debe estar entre 1 y 4.');
  check(!env.macroId || !!env.microId, 'Selecciona primero el microentorno base.');
  check(!env.macroId || !!env.macroFeatureId, 'Selecciona una característica del macroentorno.');
}
export function activeEnvironmentFeatures(env, catalog) {
  validateEnvironment(env);
  if (!env?.microId) return [];
  const micro = catalog.find(e => e.id === env.microId && e.layer === 'micro');
  check(micro, 'Microentorno no disponible.');
  const features = micro.features.map(f => ({ ...f, layer: 'micro', source: micro.source }));
  if (env.macroId) {
    const macro = catalog.find(e => e.id === env.macroId && e.layer === 'macro');
    const feature = macro?.features.find(f => f.id === env.macroFeatureId && ['Passive', 'Action'].includes(f.type));
    check(feature, 'El macroentorno aporta exactamente una característica Passive o Action.');
    features.push({ ...feature, layer: 'macro', source: macro.source });
  }
  return features;
}
export function encounterLog(title, details, visibility = 'keeper') {
  return { id: 'encounter_' + newId(), timestamp: new Date().toLocaleTimeString(), type: 'SYSTEM', sender: 'Keeper', title, details, visibility };
}
export function environmentActivation(state, sessionRole, mapId, featureId, catalog, { triggerConfirmed = false, manualCost, targetName = '' } = {}) {
  check(isKeeper(state, sessionRole), 'Solo el Keeper puede activar el entorno.');
  check(mapId === state.activeMapId, 'Activa esta escena antes de resolver sus efectos.');
  const map = state.maps.find(m => m.id === mapId);
  check(map, 'La escena ya no existe.');
  const feature = activeEnvironmentFeatures(map.environment, catalog).find(f => f.id === featureId);
  check(feature && feature.type !== 'Passive', 'Esta característica es pasiva o no pertenece a la escena.');
  check(feature.type !== 'Reaction' || triggerConfirmed, 'Confirma el disparador impreso antes de activar la reacción.');
  const cost = feature.fear ?? manualCost;
  check(integer(cost, 0, 12), 'Especifica el coste variable conforme al texto impreso.');
  check(integer(state.fear, 0, 12) && state.fear >= cost, 'No hay suficiente Fear.');
  const log = encounterLog(`${map.name} · ${feature.name}`, `${cost} Fear${targetName ? ' · ' + targetName : ''}. ${feature.text}\n${feature.source}`);
  const patch = { fear: state.fear - cost, logs: [log, ...(state.logs || [])].slice(0, 150) };
  if (feature.type === 'Clock') {
    const segments = Number(/(\d+)-segment/.exec(feature.text)?.[1]);
    check(integer(segments, 1, 32), 'Define el reloj según el procedimiento impreso.');
    const clockId = 'environment_' + newId();
    check(!(state.clocks || []).some(c => c.environmentMapId === mapId && c.environmentFeatureId === feature.id), 'Este reloj ya existe. Avánzalo desde el panel de relojes.');
    patch.clocks = [...(state.clocks || []), { id: clockId, environmentMapId: mapId, environmentFeatureId: feature.id, title: feature.name, segments, filled: 0, category: 'danger', isKeeperOnly: false, posX: 80, posY: 100, collapsed: false }];
  }
  return patch;
}

const statRanges = { hp: [1, 10000], armor: [0, 10000], stress: [0, 10000], evasion: [0, 100], attackModifier: [-100, 100], majorThreshold: [1, 10000], severeThreshold: [1, 10000] };
export function validateBoss(boss) {
  if (boss == null) return;
  check(boss && Array.isArray(boss.states) && boss.states.length >= 2 && boss.states.length <= 8, 'Un boss necesita entre 2 y 8 estados.');
  check(short(boss.sourceText ?? '', 50000), 'Referencia de boss demasiado larga.');
  check(boss.defeated === undefined || typeof boss.defeated === 'boolean', 'Estado final inválido.');
  check(integer(boss.index, 0, boss.states.length - 1), 'Estado de boss inválido.');
  for (const phase of boss.states) {
    check(phase.defeat === undefined || ['hp0', 'objective'].includes(phase.defeat), 'Condición de derrota inválida.');
    check(phase.clearMode === undefined || ['negative', 'choose'].includes(phase.clearMode), 'Limpieza de condiciones inválida.');
    check(phase.canAttack === undefined || typeof phase.canAttack === 'boolean', 'Ataque de estado inválido.');
    check(short(phase.name) && phase.name.trim(), 'Cada estado necesita un nombre.');
    check(['hp0', 'hpPercent', 'armor0', 'objective', 'clock'].includes(phase.trigger), 'Disparador de fase inválido.');
    check(['pool', 'keep'].includes(phase.hpMode), 'Modo de HP inválido.');
    if (phase.trigger === 'hpPercent') check(integer(phase.threshold, 1, 99), 'Umbral porcentual inválido.');
    if (phase.trigger === 'clock') check(short(phase.clockId) && !!phase.clockId, 'Selecciona el reloj de la transición.');
    check(short(phase.notes ?? '', 20000) && short(phase.transition ?? '', 10000), 'Texto de fase demasiado largo.');
    check(phase.stats && typeof phase.stats === 'object', 'Estadísticas de fase inválidas.');
    for (const [key, value] of Object.entries(phase.stats)) {
      if (key === 'damageExpression') check(short(value, 1000), 'Expresión de daño inválida.');
      else check(statRanges[key] && integer(value, ...statRanges[key]), 'Valor de fase inválido: ' + key);
    }
    if (phase.hpMode === 'pool') check(integer(phase.stats.hp, 1, 10000), 'Indica los HP de cada reserva nueva.');
    if (phase.stats.majorThreshold && phase.stats.severeThreshold) check(phase.stats.majorThreshold <= phase.stats.severeThreshold, 'Umbrales de fase invertidos.');
  }
}
export function phaseReady(token, clocks = [], objectiveConfirmed = false) {
  const next = token.boss?.states?.[token.boss.index + 1];
  if (!next) return false;
  if (next.trigger === 'hp0') return token.hp.current === 0;
  if (next.trigger === 'armor0') return token.armor.max > 0 && token.armor.current === 0;
  if (next.trigger === 'hpPercent') return token.hp.current / token.hp.max * 100 <= next.threshold;
  if (next.trigger === 'clock') return clocks.some(c => c.id === next.clockId && c.filled === c.segments);
  return objectiveConfirmed;
}
export function applyBossStats(token, phase) {
  const next = structuredClone(token), stats = phase.stats;
  if (phase.hpMode === 'pool') next.hp = { ...next.hp, current: stats.hp, max: stats.hp };
  for (const key of ['majorThreshold', 'severeThreshold']) if (stats[key] !== undefined) next.hp[key] = stats[key];
  check(next.hp.majorThreshold <= next.hp.severeThreshold, 'Los umbrales heredados de esta fase están invertidos.');
  for (const key of ['armor', 'stress']) if (stats[key] !== undefined) next[key] = { ...next[key], max: stats[key], current: key === 'stress' ? 0 : stats[key] };
  for (const key of ['evasion', 'attackModifier', 'damageExpression']) if (stats[key] !== undefined) next[key] = stats[key];
  return next;
}
export function advanceBoss(state, sessionRole, tokenId, expectedIndex, { objectiveConfirmed = false, timingConfirmed = false, clearCustom = [] } = {}) {
  check(isKeeper(state, sessionRole), 'Solo el Keeper puede cambiar de fase.');
  const token = state.tokens.find(t => t.id === tokenId);
  check(token?.boss && !token.isPlayer && token.actorType !== 'player', 'Selecciona un adversario con estados.');
  validateBoss(token.boss);
  check(!token.boss.requiresTiming || timingConfirmed, 'Confirma que ha llegado el Spotlight indicado por el perfil.');
  check(token.boss.index === expectedIndex, 'La fase ya cambió. Revisa el estado actual.');
  check(phaseReady(token, state.clocks, objectiveConfirmed), 'Aún no se ha cumplido el disparador de transición.');
  const index = token.boss.index + 1, phase = token.boss.states[index];
  const next = applyBossStats(token, phase);
  const negative = new Set(CONDITIONS.filter(c => c.name !== 'Hidden').map(c => c.name));
  next.conditions = normalizeConditions(token.conditions || []).filter(c => (phase.clearMode === 'choose' || !negative.has(c)) && !clearCustom.includes(c));
  next.boss = { ...token.boss, index, defeated: false };
  const gain = index === token.boss.states.length - 1 ? 3 : 2;
  const fear = Math.min(12, state.fear + gain);
  const log = encounterLog(`${token.name} · ${phase.name}`, `${phase.transition || 'Transición de estado.'}\n+${fear - state.fear} Fear (${gain} antes del límite de 12). ${phase.notes || ''}`);
  return { tokens: state.tokens.map(t => t.id === tokenId ? next : t), fear, logs: [log, ...(state.logs || [])].slice(0, 150) };
}
