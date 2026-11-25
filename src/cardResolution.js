import { cardUse, usedBy } from './cardLimits.js';
import { printedChecks } from './cardProcedures.js';
import { newId } from './persistence.js';
import { distanceInfo, RANGE_BANDS } from './attackFlow.js';
import { cardDuration, helpsOthers, addClock, newClock, MAX_SEGMENTS } from './effectClocks.js';
import { CONDITIONS, normalizeConditions, specialState } from './conditions.js';
import { canReceiveHealing, LIFE_STATES, lifePatch, onRoundChange } from './combatState.js';
import { isPartyToken } from './tokenPermissions.js';
import { facesRoller } from './tableDice.js';
import { pathImmune } from './statePowers.js';
import { CLOCK_BONUSES } from './powerEffects.js';
import { PROCEDURES, procedureFor, stepsFor, diceFormula } from './powerProcedures.js';
import { outcomePatch } from './weaponAftermath.js';

// Range and recipients here are the printed activation requirements. Fictional objects and
// points without a token remain legitimate subjects of the other cards.
export const TARGET_RULES = {
  'Rapid Regeneration': { who: 'party', reach: 'Very Close', self: true },
  'Spark of Hope': { who: 'party', reach: 'Melee', self: false },
  'Emergency Repair': { who: 'machine', reach: 'Melee', self: true },
  'Synaptic Disruption': { who: 'creature', reach: 'Close', self: false },
  'Slipstream Jolt': { who: 'any', reach: 'Close', self: false, object: true },
  // Levels 1-3 that name one target (v2.32.0): chosen like an attack, at their printed range.
  'Stellar Lance': { who: 'creature', reach: 'Far', self: false },
  'Biological Scan': { who: 'creature', reach: 'Melee', self: false },
  'Mind-Slip': { who: 'creature', reach: 'Close', self: false, object: true },
  'Emotional Manipulation': { who: 'creature', reach: 'Close', self: false },
  'Symbiotic Bond': { who: 'party', reach: 'Close', self: false },
};
// Power procedures (v2.49.0, fase 3): one target is aimed like an attack; a point, a cone or a line
// is aimed at a token (the point, or the direction), and the zone is worked out from it.
for (const [name, p] of Object.entries(PROCEDURES)) {
  if (TARGET_RULES[name]) continue;
  const first = p.modes ? Object.values(p.modes)[0] : p;
  if (first.target) TARGET_RULES[name] = { ...first.target };
  else if (first.zone && first.zone.shape !== 'around') TARGET_RULES[name] = { who: 'any', reach: first.zone.reach, self: false, zone: true };
}
// Damage a Power deals when its Spellcast succeeds: the table prepares it against the target and
// the Keeper decides it like any hit (formula, type and delivery tag as printed).
export const POWER_DAMAGE = {
  'Stellar Lance': { formula: actor => `${Math.max(1, Number(actor?.proficiency) || 1)}d8`, type: 'energy', tag: 'Radiant', heavy: 'Devastating contra armadura Heavy o Very Heavy.' },
};
// Effects on the caster when the Power works (v2.32.0): a condition on the token and a clock that
// says what ends it. Temporal Cloak · Personal: Hidden; it ends if the caster attacks or uses
// another Void Power. The Vehicle mode stays with the table (the ship is not a token here).
export const SELF_EFFECTS = {
  'Temporal Cloak': { modes: ['Personal', 'Vehículo'], when: 'Personal', condition: 'Hidden', endsOnAttack: true, endsOnDomain: 'Void',
    note: 'casi invisible 10 minutos: Hidden y Ventaja en Agility para no ser detectado. Termina si ataca o usa otro Poder Void.' },
  // Vanish (Scoundrel, Resolve move; user decision, v2.50.0): it resolves by itself, Hidden until the
  // character attacks or casts a Power (Hidden gives Advantage on the next attack).
  'Vanish': { condition: 'Hidden', endsOnAttack: true, endsOnPower: true,
    note: 'rompe la línea de visión y queda Hidden (Ventaja en su próximo ataque). Se va al atacar o al lanzar un Poder.' },
};
export function applySelfEffect(store, name, actorId, mode = '') {
  const rule = SELF_EFFECTS[name], actor = store.state.tokens.find(t => t.id === actorId);
  if (!rule || !actor) return '';
  if (rule.modes && (mode || rule.when) !== rule.when) return name + ' · ' + mode + ': lo resuelve la mesa.';
  const clocks = addClock((actor.effectClocks || []).filter(c => c.name !== name), newClock({ name, segments: 1, tick: 'manual', scene: true }));
  store.updateToken(actor.id, { conditions: normalizeConditions([...(actor.conditions || []), rule.condition]), effectClocks: clocks });
  return actor.name + ': ' + rule.note;
}
// What ends a self effect: an attack, or another Power of its Domain.
export function endSelfEffects(actor, { attack = false, domain = '', name = '', power = false } = {}) {
  const ending = Object.entries(SELF_EFFECTS).filter(([key, rule]) => key !== name && actor?.effectClocks?.some(c => c.name === key) && ((attack && rule.endsOnAttack) || (power && rule.endsOnPower) || (domain && rule.endsOnDomain === domain)));
  if (!ending.length) return null;
  const names = ending.map(([key]) => key), conditions = new Set(ending.map(([, rule]) => rule.condition));
  return { effectClocks: actor.effectClocks.filter(c => !names.includes(c.name)), conditions: (actor.conditions || []).filter(c => !conditions.has(c)), ended: names };
}
// Powers with modes chosen when they are played (v2.35.0).
export const CARD_MODES = {
  'Mind-Slip': ['Compel', 'Stagger', 'Field of Hesitation'],
  'Flux Field': ['Lucky Streak', 'Unlucky Enemies'],
};
for (const [name, p] of Object.entries(PROCEDURES)) if (p.modes && !CARD_MODES[name]) CARD_MODES[name] = Object.keys(p.modes);
// Powers that, once cast, leave an action to use while they last (their clock on the caster):
// Telekinetic Grasp hurls the tethered object; Flux Field, once per round, grants Advantage to an
// ally's roll or imposes Disadvantage on an enemy's attack.
export const SUSTAINED = {
  'Telekinetic Grasp': { label: 'Lanzar el objeto', reach: 'Far' },
  'Flux Field': { label: 'Usar Flux Field (1 / ronda)' },
};
// Area boons applied to everyone inside at once (no roll).
export const AREA_BOONS = {
  'Inspiring Presence': token => ({ pendingCheckBonus: (Number(token.pendingCheckBonus) || 0) + 2 }),
};
// Powers whose area is around the caster (user request, v2.32.0): «all enemies within Close
// range…». Everyone inside the circle is a target; a printed Reaction Roll is asked of each of
// them, and the failure the card names is applied to whoever fails. A point chosen elsewhere
// («Choose a point within…») is placed by the table, not here.
const AREA_RX = /\b(you and )?(?:all|every|each)\s+(?:other\s+)?(enem(?:y|ies)|all(?:y|ies)|creatures?)\s+(?:within|in)\s+(melee|very close|close|far)\b/i;
const AREA_METERS = { Melee: 1, 'Very Close': 5, Close: 10, Far: 25 };
export function areaRule(card, mode = '') {
  // A Power procedure around the caster (Psychic Storm, Shockwave Pulse…), in the mode played.
  const proc = procedureFor(card?.name, mode);
  if (proc) return proc.zone?.shape === 'around' ? { reach: proc.zone.reach, who: proc.zone.who, self: !!proc.zone.self, check: null, failure: null, procedure: true, max: proc.zone.max || 0, most: proc.zone.most || 'hp' } : null;
  const text = String(card?.text || '').replace(/\*+/g, '');
  if (/choose a point/i.test(text)) return null;
  // A zone printed another way: Protective Dome covers a Very Close zone around the caster.
  if (card?.name === 'Protective Dome') return { reach: 'Very Close', who: 'allies', self: true, check: null, failure: null };
  const m = AREA_RX.exec(text);
  if (!m) return null;
  const reach = RANGE_BANDS.find(b => b.toLowerCase() === m[3].toLowerCase());
  const who = /^enem/i.test(m[2]) ? 'enemies' : /^all/i.test(m[2]) ? 'allies' : 'creatures';
  const check = /must (?:make|roll|succeed on)/i.test(text) ? printedChecks(card)[0] || null : null;
  const condition = (clause = '') => CONDITIONS.map(c => c.name).find(name => new RegExp('\\b' + name + '\\b').test(clause)) || '';
  const sentence = rx => (text.match(rx) || [''])[0];
  const fear = sentence(/On (?:a )?Failure with Fear[^.]*\./i), fail = sentence(/On (?:a )?failure(?! with)[^.]*\./i);
  return { reach, who, self: !!m[1] && who === 'allies', check,
    failure: { condition: condition(fail), disadvantage: /Disadvantage on (?:their|its) next attack/i.test(fail), fearCondition: condition(fear),
      until: /until the end of (?:their|its) next Spotlight/i.test(fear + fail) ? 'spotlight-end' : 'round' } };
}
// The circle drawn on the map: the band's metres from the caster's base (distances are measured
// base to base), up to the centre of a standard target.
export const areaRadius = (actor, map, reach) => ((AREA_METERS[reach] ?? 10) / (map?.gridScaleMeters || 2) + ((Number(actor?.size) || 1) + 1) / 2) * (map?.gridSize || 64);
export function applyAreaFailure(store, record, targetId, roll) {
  const target = store.state.tokens.find(t => t.id === targetId), f = record.area.failure;
  if (!target) return '';
  const said = [];
  let clocks = target.effectClocks || [], conditions = target.conditions || [];
  if (f.disadvantage) {
    clocks = addClock(clocks, { ...newClock({ name: record.name + ' · próximo ataque', segments: 1, tick: 'manual', scene: true }), edge: 'disadvantage', nextAttack: true });
    said.push('Desventaja en su próximo ataque');
  }
  const condition = roll.dominance === 'Fear' && f.fearCondition ? f.fearCondition : f.condition;
  if (condition && pathImmune(target, condition)) said.push('inmune a ' + condition);
  else if (['Dazed', 'Stunned'].includes(condition)) {
    clocks = addClock(clocks, { ...newClock({ name: record.name, segments: 1, tick: 'manual', scene: true }), condition, expiry: f.until });
    said.push(condition + (f.until === 'spotlight-end' ? ' hasta el final de su próximo Spotlight' : ' hasta el cambio de ronda'));
  } else if (condition) {
    conditions = normalizeConditions([...conditions, condition]);
    said.push(condition);
  }
  if (!said.length) return '';
  store.updateToken(target.id, { effectClocks: clocks, conditions });
  return target.name + ': ' + said.join(' · ') + '.';
}
// Puts a Special state on these tokens (skips the ones that already have it or have 30 markers).
export function applySpecial(store, state, holders) {
  const named = [];
  for (const holder of holders) {
    const live = store.state.tokens.find(t => t.id === holder.id);
    const current = normalizeConditions(live?.conditions);
    if (!live || current.includes(state) || current.length >= 30) continue;
    store.updateToken(live.id, { conditions: normalizeConditions([...current, state]) });
    named.push(live.name);
  }
  return named.length ? named.join(', ') + ' · ' + state + '.' : '';
}
// The tokens in a procedure's zone aimed at `center`: around it (a point), in a 60° cone or a line
// one square wide from the caster towards it. Walls between the zone's origin and a token stop it.
const SIDE = { enemies: (a, t) => isPartyToken(t) !== isPartyToken(a), allies: (a, t) => isPartyToken(t) === isPartyToken(a), creatures: () => true };
export function procedureZone(actor, zone, center, store) {
  const map = store.getActiveMap?.() || {}, live = store.state.tokens.filter(t => t.mapId === actor.mapId && !t.inReserve && !t.hidden && t.id !== actor.id);
  const side = SIDE[zone.who] || SIDE.creatures, order = RANGE_BANDS;
  const within = (band, limit) => order.indexOf(band) >= 0 && order.indexOf(band) <= order.indexOf(limit);
  if (!center) return [];
  if (zone.shape === 'point') return live.filter(t => (t.id === center.id || (() => { const d = distanceInfo(center, t, map); return within(d.band, zone.size || 'Very Close') && !d.blocked; })()) && side(actor, t));
  const aim = Math.atan2(center.y - actor.y, center.x - actor.x), grid = map.gridSize || 64;
  return live.filter(t => {
    if (!side(actor, t)) return false;
    if (t.id === center.id) return true;
    const d = distanceInfo(actor, t, map);
    if (!within(d.band, zone.reach) || d.blocked) return false;
    const dx = t.x - actor.x, dy = t.y - actor.y;
    if (zone.shape === 'line') {
      const along = dx * Math.cos(aim) + dy * Math.sin(aim), across = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
      return along > 0 && across <= grid * (0.5 + (Number(t.size) || 1) / 2);
    }
    const angle = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - aim), Math.cos(Math.atan2(dy, dx) - aim)));
    return angle <= Math.PI / 6 + 1e-6;
  });
}
export function areaTargets(actor, rule, store) {
  const map = store.getActiveMap?.();
  return store.state.tokens.filter(t => {
    if (t.inReserve || !eligible(actor, t, map, { reach: rule.reach, self: rule.self })) return false;
    if (t.id === actor.id) return rule.self;
    const ally = isPartyToken(t) === isPartyToken(actor);
    return rule.who === 'creatures' || (rule.who === 'allies' ? ally : !ally);
  });
}
export const eligible = (actor, target, map, rule = {}) => {
  if (!target || target.hidden || target.mapId !== actor.mapId || map?.id && map.id !== target.mapId) return false;
  if (rule.self === false && actor.id === target.id) return false;
  if (rule.who === 'party' && target.isPlayer === false && !isPartyToken(target)) return false;
  if (rule.who === 'machine' && !/drone|vehicle|starship|synthetic|vehículo|sintétic/i.test([target.actorType, target.species, target.roleTag, target.sourceCharacter?.document?.fields?.ancestry].join(' '))) return false;
  if (!rule.reach || actor.id === target.id) return true;
  const gap = distanceInfo(actor, target, map || {});
  return !gap.blocked && RANGE_BANDS.indexOf(gap.band) <= RANGE_BANDS.indexOf(rule.reach);
};
export function cardTargets(actor, card, ids, store) {
  const rule = TARGET_RULES[card.name], map = store.getActiveMap?.();
  if (!Array.isArray(ids) || ids.length > 50 || new Set(ids).size !== ids.length) throw new Error('Selección de objetivos inválida.');
  if (actor.mapId && store.state.activeMapId && actor.mapId !== store.state.activeMapId) throw new Error('El personaje ha cambiado de escena.');
  if (rule && !ids.length && rule.self && eligible(actor, actor, map, rule)) ids = [actor.id];
  if (rule && (ids.length > 1 || !ids.length && !rule.object)) throw new Error('Elige un objetivo válido para ' + card.name + '.');
  const targets = ids.map(id => store.state.tokens.find(t => t.id === id));
  if (targets.some(t => !eligible(actor, t, map, rule))) throw new Error('Revisa el objetivo y la escena' + (rule?.reach ? ' · Alcance ' + rule.reach : '') + '.');
  if (['Emergency Repair', 'Rapid Regeneration'].includes(card.name) && targets.some(t => !canReceiveHealing(t))) throw new Error('Estabiliza al personaje antes de curarlo.');
  return targets;
}

export const projectSize = card => Number(/long-term project\s*\((\d+)\s*(?:segments?|[- ]?clock)/i.exec([card.type, card.text].join(' '))?.[1]) || 0;
export function createResolution(card, actor, targets, roll, id, mapId) {
  return { id, mapId, actorId: actor?.id || '', name: card.name, text: String(card.text || '').slice(0, 12000),
    targetIds: targets.map(t => t.id), roll: roll || null, phase: roll ? 'roll' : 'ready', applied: [], project: projectSize(card) };
}
export function resolutionLog(store, id) {
  return (store.state.logs || []).find(row => row.resolution?.id === id);
}
export function updateResolution(store, id, change) {
  const logs = store.state.logs.map(row => row.resolution?.id === id ? { ...row, resolution: { ...row.resolution, ...change } } : row);
  store.update({ logs });
}
export function awaitingRoll(store, id, actor, options, replyId) {
  if (!id) return null;
  const record = resolutionLog(store, id)?.resolution;
  if (replyId) {
    const reply = record?.replies?.find(r => r.id === replyId);
    if (record?.phase !== 'ready' || !reply || reply.outcome || reply.actorId !== actor.id || record.mapId !== store.state.activeMapId ||
        reply.traitId !== options.traitId || reply.dc !== options.dc) throw new Error('La tirada de objetivo ya cambió.');
    return { ...record, replyId };
  }
  if (record?.phase !== 'roll' || record.actorId !== actor.id || record.mapId !== store.state.activeMapId ||
      record.roll.traitId !== options.traitId || record.roll.dc !== options.dc) throw new Error('La tirada pendiente ya cambió. Ábrela desde el registro de mesa.');
  return record;
}

export const EFFECT_OPTIONS = {
  note: 'Registrar decisión', hp: 'Cambiar HP finales', stress: 'Cambiar Stress', hope: 'Cambiar Hope',
  effort: 'Cambiar Effort', armor: 'Cambiar Armor Slots', condition: 'Aplicar condición', clear: 'Retirar condición',
  advantage: 'Ventaja en la siguiente tirada', bonus: 'Modificador a la siguiente tirada', clock: 'Iniciar reloj de efecto',
  special: 'Aplicar estado Special (texto libre)',
};
function effectPatch(token, kind, value, condition, record) {
  if (kind === 'special') {
    const state = specialState(condition);
    if (!state) throw new Error('Escribe el texto del estado Special.');
    const current = normalizeConditions(token.conditions);
    if (current.length >= 30) throw new Error('Máximo 30 condiciones por token.');
    return { conditions: normalizeConditions([...current, state]) };
  }
  if (kind === 'condition' || kind === 'clear') {
    if (!CONDITIONS.some(c => c.name === condition) || LIFE_STATES.includes(condition)) throw new Error('Elige una condición de la lista.');
    if (kind === 'condition' && pathImmune(token, condition)) throw new Error(token.name + ' es inmune a ' + condition + '.');
    const current = normalizeConditions(token.conditions);
    return { conditions: kind === 'clear' ? current.filter(c => c !== condition) : normalizeConditions([...current, condition]) };
  }
  if (kind === 'advantage') return { pendingAdvantage: true };
  if (!Number.isInteger(value) || !value || Math.abs(value) > 100) throw new Error('Indica una cantidad entre −100 y 100 distinta de cero.');
  if (kind === 'clock') {
    if (value < 1 || value > MAX_SEGMENTS) throw new Error('Número de segmentos inválido.');
    return { effectClocks: addClock(token.effectClocks, newClock({ name: record.name, segments: value, tick: 'manual' })) };
  }
  if (kind === 'bonus') {
    if (Math.abs(value) > 10) throw new Error('El modificador debe estar entre −10 y 10.');
    return { pendingCheckBonus: (token.pendingCheckBonus || 0) + value };
  }
  if (kind === 'hope' || kind === 'effort') {
    if (token.isPlayer === false || (token.path === 'Sleeping') !== (kind === 'effort')) throw new Error('Ese recurso no corresponde a ' + token.name + '.');
    return { [kind]: Math.max(0, Math.min(6, (token[kind] || 0) + value)) };
  }
  const track = token[kind];
  if (!['hp', 'armor', 'stress'].includes(kind) || !Number.isFinite(track?.max)) throw new Error('El objetivo carece de ese recurso.');
  if (kind === 'hp' && value > 0 && !canReceiveHealing(token)) throw new Error('Estabiliza al personaje antes de curarlo.');
  return { [kind]: { ...track, current: Math.max(0, Math.min(track.max, track.current + value)) } };
}

// These are adjudicated consequences of a specific play. Only the Keeper can submit them.
// Validate every target before updating anything and keep a receipt with the original play.
export function adjudicateCard(store, id, { operation, kind, ids = [], value, condition, note = '' }) {
  if (store.sessionRole === 'player' || store.state.userRole !== 'keeper') throw new Error('Solo el Keeper resuelve estas consecuencias.');
  const row = resolutionLog(store, id), record = row?.resolution;
  if (!record || record.mapId !== store.state.activeMapId || store.state.rest) throw new Error('Esta resolución no está disponible en la escena actual.');
  if (operation === 'renew-arc') {
    const actor = store.state.tokens.find(t => t.id === record.actorId);
    const use = cardUse({kind:'power',name:record.name,text:record.text},store.state);
    if (!actor || record.limit?.scopeId !== 'unassigned' || use?.scopeId !== 'unassigned' || !usedBy(actor,use)) throw new Error('Este poder pertenece a un arco gestionado por la mesa.');
    const cardUses = {...actor.cardUses}; delete cardUses[use.key];
    store.updateToken(actor.id,{cardUses});
    store.addLog({type:'SESSION',sender:'Keeper',title:'Uso por arco renovado',details:actor.name + ' · ' + record.name});
    return;
  }
  if (record.phase === 'done') throw new Error('Esta resolución ya está cerrada.');
  if (!['apply', 'finish', 'cancel'].includes(operation)) throw new Error('Operación inválida.');
  if (record.phase === 'roll' && operation !== 'cancel') throw new Error('Resuelve primero la tirada vinculada.');
  const comment = String(note).trim().slice(0, 500);
  if (operation !== 'apply') {
    if (operation === 'finish' && record.replies?.some(r => !r.outcome)) throw new Error('Quedan tiradas de objetivo pendientes.');
    updateResolution(store, id, { phase: 'done', conclusion: operation === 'cancel' ? 'Cancelada' : 'Resuelta', note: comment });
    return;
  }
  if (!Object.hasOwn(EFFECT_OPTIONS, kind) || !Array.isArray(ids) || ids.length > 50 ||
      new Set(ids).size !== ids.length || (!ids.length && kind !== 'note') || (kind === 'note' && !comment)) throw new Error('Elige los objetivos y la consecuencia.');
  const receipt = JSON.stringify([kind, [...ids].sort(), value ?? null, condition || '', comment]);
  if (record.applied.some(r => r.key === receipt)) throw new Error('Esta consecuencia ya se aplicó.');
  if (record.applied.length >= 60) throw new Error('Esta carta ya tiene 60 consecuencias.');
  const changes = ids.map(targetId => {
    const target = store.state.tokens.find(t => t.id === targetId && t.mapId === record.mapId);
    if (!target || target.hidden && row.visibility !== 'keeper') throw new Error('Un objetivo ya no está disponible en esta escena.');
    return { target, patch: kind === 'note' ? null : effectPatch(target, kind, value, condition, record) };
  });
  for (const { target, patch } of changes) if (patch) store.updateToken(target.id, patch);
  const label = [EFFECT_OPTIONS[kind], ['condition','clear'].includes(kind) ? condition : kind === 'special' ? specialState(condition) : value, changes.map(c => c.target.name).join(', '), comment].filter(x => x != null && x !== '').join(' · ');
  updateResolution(store, id, { applied: [...record.applied, { key: receipt, label }] });
}

// Only benefits that the table can determine without interpreting the fiction are automatic.
export const cardRollOptions = card => ['Drone Whisper', 'System Jackknife'].includes(card.name) ? [10, 15, 20] : null;
export function resolveImmediate(store, actor, targets, card, face) {
  const target = targets[0];
  if (!target) return '';
  const fresh = id => store.state.tokens.find(t => t.id === id);
  if (card.name === 'Spark of Hope') {
    const t = fresh(target.id);
    store.updateToken(t.id, { stress: { ...t.stress, current: Math.max(0, t.stress.current - 1) } });
    return target.name + ' limpia 1 Stress.';
  }
  if (card.name === 'Emergency Repair') {
    const t = fresh(target.id);
    const d8 = Number.isInteger(face) && face >= 1 && face <= 8 ? face : 1 + Math.floor(Math.random() * 8);
    const hp = Math.max(0, d8 + (actor.traits?.knowledge || 0));
    store.updateToken(t.id, { hp: { ...t.hp, current: Math.min(t.hp.max, t.hp.current + hp) } });
    if (d8 === 8) {
      const source = fresh(actor.id);
      store.updateToken(source.id, { stress: { ...source.stress, current: Math.max(0, source.stress.current - 1) } });
    }
    return target.name + ' repara hasta ' + hp + ' HP (d8: ' + d8 + ').' + (d8 === 8 ? ' Stress reembolsado.' : '');
  }
  if (card.name === 'Slipstream Jolt') {
    const t = fresh(target.id);
    store.updateToken(t.id, { effectClocks: addClock(t.effectClocks, newClock({ name: card.name, segments: 1, tick: 'manual' })) });
    return target.name + ' tendrá Desventaja en su próxima tirada de Agility o Finesse.';
  }
  return '';
}
export function requestCardChecks(store, id, ids, check) {
  const row = resolutionLog(store, id), record = row?.resolution;
  if (store.sessionRole === 'player' || store.state.userRole !== 'keeper' || store.state.rest || record?.phase !== 'ready' || record.mapId !== store.state.activeMapId) throw new Error('La carta no está disponible para solicitar tiradas.');
  if (!printedChecks(record).some(r => r.traitId === check.traitId && r.dc === check.dc) || !ids.length || ids.length > 50 || new Set(ids).size !== ids.length) throw new Error('Selecciona la tirada impresa y sus objetivos.');
  const old = record.replies || [];
  if (old.length + ids.length > 60) throw new Error('Demasiadas tiradas para esta carta.');
  const additions = ids.map(actorId => {
    const token = store.state.tokens.find(t => t.id === actorId && t.mapId === record.mapId);
    if (!token || (token.hidden && row.visibility !== 'keeper') || old.some(r => r.actorId === actorId && r.traitId === check.traitId && r.dc === check.dc && !r.outcome)) throw new Error('Tirada ya pendiente u objetivo fuera de escena.');
    return { id: newId(), actorId, traitId: check.traitId, dc: check.dc };
  });
  updateResolution(store, id, { replies: [...old, ...additions] });
}
// Bear Down can revise the most recent roll only while its card is still on the table.
// Look up the current version so replies made by other players are preserved.
export function cardToAmend(store, previous) {
  if (!previous.cardPlayId) return null;
  const record = resolutionLog(store, previous.cardPlayId)?.resolution;
  if (record?.phase !== 'ready' || record.mapId !== store.state.activeMapId) throw new Error('Esta resolución ya no admite Bear Down.');
  if (!previous.cardReplyId) return record;
  if (!record.replies?.some(r => r.id === previous.cardReplyId && r.outcome)) throw new Error('La tirada de objetivo ya cambió.');
  return { ...record, replyId: previous.cardReplyId };
}
// The lasting effect of a card that succeeded: Rapid Regeneration heals its target now and leaves
// its clock (+1 HP each time the target takes the Spotlight); other cards leave their clock on the
// recipients. `faces` are the duration dice already thrown (random if missing).
export function applyCardDuration(store, record, actor, faces = []) {
  const targets = (record.targetIds || []).map(id => store.state.tokens.find(t => t.id === id && t.mapId === record.mapId)).filter(Boolean);
  const duration = cardDuration(record, actor, facesRoller(faces));
  if (!duration) return '';
  if (record.name === 'Rapid Regeneration') {
    const target = targets[0];
    if (!target) return '';
    if (!canReceiveHealing(target)) return target.name + ' necesita estabilizarse antes de curarse.';
    const surge = duration.faces?.[0] === 4;
    store.updateToken(target.id, { hp: { ...target.hp, current: Math.min(target.hp.max, target.hp.current + 1) },
      ...(surge ? { stress: { ...target.stress, current: Math.max(0, target.stress.current - 1) } } : {}),
      effectClocks: addClock(target.effectClocks, newClock(duration, { source: actor?.name || '' })) });
    return target.name + ': +1 HP' + (surge ? ' y −1 Stress (Surge)' : '') + '. ' + duration.note + ' (+1 HP cada vez que toma el foco).';
  }
  const recipients = helpsOthers(record) && targets.length ? targets : [actor].filter(Boolean);
  for (const holder of recipients) store.updateToken(holder.id, { effectClocks: addClock(store.state.tokens.find(t => t.id === holder.id).effectClocks, newClock(duration, { source: actor?.name || '' })) });
  return 'Reloj «' + duration.name + '» en ' + recipients.map(t => t.name).join(', ') + ': ' + duration.note + '.';
}
// ── Power procedures at the table (v2.49.0, Plan de UX V3, fase 3) ───────────────────────────
// The steps of the cast: conditions, clocks, Stress and direct HP and the Reaction Rolls of the
// targets are applied here; healing dice and damage are thrown by the caster's screen in 3D
// (record.effectPending → CARD_EFFECT; record.damagePending → the Keeper's damage window).
const TRAIT = { agility: 'Agility', strength: 'Strength', finesse: 'Finesse', knowledge: 'Knowledge', instinct: 'Instinct', presence: 'Presence' };
export function runProcedure(store, record, roll, actor) {
  const proc = procedureFor(record.name, record.mode);
  if (!proc) return null;
  const success = roll.isCritical || roll.total >= roll.dc, hope = success && (roll.dominance === 'Hope' || roll.isCritical);
  const fresh = id => store.state.tokens.find(t => t.id === id && t.mapId === record.mapId);
  const targets = (record.targetIds || []).map(fresh).filter(Boolean);
  const ownSide = () => { const map = store.getActiveMap?.() || {}, reach = proc.zone?.reach || 'Far';
    return store.state.tokens.filter(t => t.mapId === record.mapId && !t.inReserve && isPartyToken(t) === isPartyToken(actor) && (t.id === actor?.id || (!distanceInfo(actor, t, map).blocked && RANGE_BANDS.indexOf(distanceInfo(actor, t, map).band) <= RANGE_BANDS.indexOf(reach)))); };
  const pick = to => to === 'self' ? [fresh(actor?.id)].filter(Boolean) : to === 'ownSide' ? ownSide()
    : to === 'enemies' ? targets.filter(t => isPartyToken(t) !== isPartyToken(actor)) : to === 'allies' ? targets.filter(t => isPartyToken(t) === isPartyToken(actor)) : targets;
  const notes = [], extra = {}, damage = [], heals = [];
  for (const step of stepsFor(proc, { success, hope })) {
    const who = pick(step.to);
    if (step.do === 'note') { notes.push(step.text); continue; }
    if (!who.length) continue;
    if (step.do === 'damage') { damage.push({ formula: diceFormula(step.dice, actor), type: step.type || 'physical', tag: step.tag || '', noArmor: !!step.noArmor, ...(step.direct ? { direct: true } : {}), targetIds: who.map(t => t.id) }); continue; }
    if (step.do === 'heal') { heals.push({ dice: step.dice ? diceFormula(step.dice, actor) : '', hp: step.hp || 0, stress: step.stress || 0, targetIds: who.map(t => t.id) }); continue; }
    if (step.do === 'revive') {
      // Back from 0 HP to 1 (Beacon of Resurrection): the Dying states end, then the HP comes back.
      for (const target of who) {
        const live = fresh(target.id);
        if (!live?.hp || live.hp.current > 0) { if (live) notes.push(live.name + ' no ha caído a 0 HP.'); continue; }
        // Stabilized first: from there the usual recovery from 0 HP applies (combatTransition).
        store.updateToken(live.id, lifePatch(live, 'Stabilized'));
        const now = fresh(live.id);
        store.updateToken(live.id, { hp: { ...now.hp, current: 1 } });
        notes.push(live.name + ' vuelve con 1 HP.');
      }
      continue;
    }
    if (step.do === 'save') {
      extra.replies = [...(extra.replies || record.replies || []), ...who.map(t => ({ id: newId(), actorId: t.id, traitId: step.trait, dc: step.dc }))];
      extra.saveFailure = step.fail; extra.saveFailText = step.failText || '';
      notes.push(`${who.map(t => t.name).join(', ')} ${who.length > 1 ? 'tiran' : 'tira'} ${TRAIT[step.trait]} contra DC ${step.dc}; si falla, ${step.failText}.`);
      continue;
    }
    for (const target of who) {
      const live = fresh(target.id);
      if (step.do === 'condition' || step.do === 'clock') {
        // A duration in dice («for 1d4 rounds»): rolled here.
        const base = step.clock && (step.clock.cascade || step.clock.sanctum) ? { ...step.clock, sourceId: actor?.id } : step.clock;
        const clock = base && typeof base.rounds === 'string' ? { ...step.clock, rounds: Math.max(1, Math.min(6, String(step.clock.rounds).split('d').reduce((qty, sides) => Array.from({ length: Number(qty) || 1 }, () => 1 + Math.floor(Math.random() * Number(sides))).reduce((a, b) => a + b, 0)))) } : base;
        const { patch, named, immune } = outcomePatch(live, step.do === 'clock' ? { clock } : { conditions: step.conditions }, record.name);
        if (named.length) store.updateToken(live.id, patch);
        notes.push(`${live.name}: ${named.length ? named.join(', ') : 'inmune a ' + immune.join(', ')}.`);
      } else if (step.do === 'mark') {
        const patch = {};
        if (step.stress && live.stress) patch.stress = { ...live.stress, current: live.stress.max > 0 ? Math.min(live.stress.max, (live.stress.current || 0) + step.stress) : (live.stress.current || 0) + step.stress };
        if (step.hp && live.hp) patch.hp = { ...live.hp, current: Math.max(0, live.hp.current - step.hp) };
        if (Object.keys(patch).length) store.updateToken(live.id, patch);
        notes.push(`${live.name}: ${[step.hp && `pierde ${step.hp} HP`, step.stress && `marca ${step.stress} Stress`].filter(Boolean).join(' y ')}.`);
      }
    }
  }
  // Healing with no dice is applied now; with dice, the caster's screen throws them.
  const now = heals.filter(h => !h.dice), later = heals.filter(h => h.dice);
  for (const h of now) notes.push(applyHeal(store, record, h, 0));
  if (later.length) { extra.effectPending = later; notes.push('Ahora se tira la curación.'); }
  if (damage.length) { extra.damagePending = damage; notes.push('El daño se prepara contra ' + [...new Set(damage.flatMap(d => d.targetIds))].map(id => fresh(id)?.name).filter(Boolean).join(', ') + '.'); }
  return { notes: notes.filter(Boolean), extra };
}
// Healing to its targets: `total` HP from the dice already thrown, plus a fixed amount, and
// Stress cleared. Who cannot receive healing yet (Dying) is skipped.
export function applyHeal(store, record, heal, total = 0) {
  const said = [];
  for (const id of heal.targetIds) {
    const t = store.state.tokens.find(x => x.id === id && x.mapId === record.mapId);
    if (!t) continue;
    if (!canReceiveHealing(t)) { said.push(t.name + ' necesita estabilizarse antes de curarse'); continue; }
    // 'severe': as much as the target's Severe Threshold; 'all': every marked HP.
    const fixed = heal.hp === 'severe' ? Number(t.hp?.severeThreshold) || 0 : heal.hp === 'all' ? Math.max(0, (t.hp?.max || 0) - (t.hp?.current || 0)) : Number(heal.hp) || 0;
    const hp = Math.max(0, total + fixed), patch = {};
    if (hp && t.hp) patch.hp = { ...t.hp, current: Math.min(t.hp.max, t.hp.current + hp) };
    if (heal.stress && t.stress) patch.stress = { ...t.stress, current: Math.max(0, t.stress.current - heal.stress) };
    if (Object.keys(patch).length) store.updateToken(t.id, patch);
    said.push(`${t.name}: ${[hp && `+${hp} HP`, heal.stress && `−${heal.stress} Stress`].filter(Boolean).join(' y ')}`);
  }
  return said.length ? said.join(' · ') + '.' : '';
}

// Damage the table's own screen prepares (the host is the Keeper's): a failed save that deals damage.
export function emitPowerDamage(actorId, hits) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined' || !window.dispatchEvent) return false;
  window.dispatchEvent(new CustomEvent('veil:power-damage', { detail: { actorId, hits } }));
  return true;
}

// ── Power effects when the round changes (v2.51.0) ───────────────────────────────────────────
// Energy Cascade: every affected target rolls Agility DC 15 (a card entry with its replies, like any
// Reaction Roll; the Keeper rolls the adversaries) and a failure takes (Proficiency)d8 Physical
// (Kinetic), +1 per round already passed. Inviolable Sanctum: the allies within Close of the caster
// clear 1 Stress. Both end with the scene.
export function roundEffects(store, round) {
  const map = store.getActiveMap?.();
  if (!map) return [];
  const said = [];
  const groups = new Map();
  for (const t of store.state.tokens) if (t.mapId === map.id && !t.inReserve) for (const c of t.effectClocks || []) if (c.cascade) {
    const list = groups.get(c.sourceId) || []; list.push({ token: t, clock: c }); groups.set(c.sourceId, list);
  }
  for (const [casterId, items] of groups) {
    const caster = store.state.tokens.find(t => t.id === casterId) || { id: casterId, name: 'Energy Cascade', proficiency: 1 };
    const bonus = Math.max(0, ...items.map(i => i.clock.filled || 0));
    const formula = `${Math.max(1, Math.min(10, Number(caster.proficiency) || 1))}d8${bonus ? '+' + bonus : ''}`;
    for (const { token, clock } of items) {
      const live = store.state.tokens.find(t => t.id === token.id);
      // One segment per round («1 minute» = 10 rounds); the last one ends it.
      store.updateToken(live.id, { effectClocks: (live.effectClocks || []).flatMap(c => c.id !== clock.id ? [c] : (c.filled || 0) + 1 >= c.segments ? [] : [{ ...c, filled: (c.filled || 0) + 1 }]) });
    }
    const targets = items.map(i => i.token);
    const id = newId(), record = createResolution({ name: 'Energy Cascade', text: '' }, caster, targets, null, id, map.id);
    record.replies = targets.map(t => ({ id: newId(), actorId: t.id, traitId: 'agility', dc: 15 }));
    record.saveFailure = { damage: { formula, type: 'physical', tag: 'Kinetic' } };
    record.saveFailText = `${formula} Physical (Kinetic) y se aleja una banda de alcance`;
    record.notes = [`Ronda ${round}: ${targets.map(t => t.name).join(', ')} ${targets.length > 1 ? 'tiran' : 'tira'} Agility contra DC 15; si falla, ${record.saveFailText}.`];
    store.addLog({ sender: caster.name, type: 'CARD', title: `Energy Cascade · ronda ${round}`, details: record.notes[0], resolution: record });
    said.push(record.notes[0]);
  }
  for (const caster of store.state.tokens.filter(t => t.mapId === map.id && t.effectClocks?.some(c => c.sanctum))) {
    const inside = store.state.tokens.filter(t => t.mapId === map.id && !t.inReserve && isPartyToken(t) === isPartyToken(caster) && t.stress?.current > 0 &&
      (t.id === caster.id || RANGE_BANDS.indexOf(distanceInfo(caster, t, map).band) <= RANGE_BANDS.indexOf('Close')));
    for (const t of inside) store.updateToken(t.id, { stress: { ...t.stress, current: t.stress.current - 1 } });
    const line = `Inviolable Sanctum: ${inside.length ? inside.map(t => t.name).join(', ') + ' limpian 1 Stress' : 'nadie dentro con Stress'}.`;
    store.addLog({ sender: caster.name, type: 'EFFECT', title: 'Inviolable Sanctum', details: line });
    said.push(line);
  }
  return said;
}
onRoundChange(roundEffects);

export function completeCardRoll(store, record, roll, previous = null) {
  if (record.replyId) {
    const reply = record.replies.find(r => r.id === record.replyId);
    const failed = !roll.isCritical && roll.total < roll.dc;
    // An area card applies its printed failure to whoever fails (once per reply).
    const target = reply && store.state.tokens.find(t => t.id === reply.actorId);
    let consequence = !failed || !reply || reply.consequence ? '' : record.area?.failure ? applyAreaFailure(store, record, reply.actorId, roll) : record.replyFailure && target ? target.name + ': ' + record.replyFailure : '';
    // A Power procedure's Reaction Roll (v2.49.0): its failure applies at once.
    if (failed && reply && !reply.consequence && record.saveFailure && target) {
      const { patch, named, immune } = outcomePatch(target, record.saveFailure, record.name);
      if (record.saveFailure.stress && target.stress) patch.stress = { ...target.stress, current: target.stress.max > 0 ? Math.min(target.stress.max, (target.stress.current || 0) + record.saveFailure.stress) : (target.stress.current || 0) + record.saveFailure.stress };
      if (named.length || patch.stress) store.updateToken(target.id, patch);
      // Damage on a failed save (Energy Cascade): the table's screen (the Keeper's) prepares it.
      const damage = record.saveFailure.damage;
      if (damage) emitPowerDamage(record.actorId, [{ ...damage, targetIds: [target.id] }]);
      consequence = [consequence, target.name + ': ' + (named.length || patch.stress || damage ? record.saveFailText : 'inmune a ' + immune.join(', '))].filter(Boolean).join(' ');
    }
    // The Special state of the play goes to whoever fails its reply.
    if (failed && reply && !reply.consequence && record.special && target) consequence = [consequence, applySpecial(store, record.special, [target])].filter(Boolean).join(' ');
    updateResolution(store, record.id, { replies: record.replies.map(r => r.id === record.replyId ? { ...r, outcome: roll.outcomeTitle, total: roll.total, ...(consequence ? { consequence } : {}) } : r) });
    return;
  }
  const actor = store.state.tokens.find(t => t.id === record.actorId);
  const success = roll.isCritical || roll.total >= roll.dc;
  const outcome = { outcome: roll.outcomeTitle, resultType: roll.resultType, total: roll.total };
  if (previous && success === (previous.isCritical || previous.total >= previous.dc)) {
    updateResolution(store, record.id, outcome);
    return;
  }
  // If Bear Down turns a failure into a success, take back only the card's actual
  // extra Fear. The normal Fear-dominant payout still stands, including at the cap.
  if (previous && record.failureFearGained) store.addFear(-Math.min(record.failureFearGained, store.state.fear));
  const notes = [];
  if (success && SELF_EFFECTS[record.name]) notes.push(applySelfEffect(store, record.name, record.actorId, record.mode));
  const extra = {};
  // A Power with its procedure (v2.49.0): its steps, on a success or a failure.
  const procedure = !(previous && record.procedureRun) ? runProcedure(store, record, roll, actor) : null;
  if (procedure) { notes.push(...procedure.notes); Object.assign(extra, procedure.extra, { procedureRun: true }); }
  // A sustained Power leaves its clock and its action (Flux Field: the mode, both with Hope).
  if (success && SUSTAINED[record.name] && actor) {
    const clock = newClock({ name: record.name, segments: 1, tick: 'manual', scene: true });
    if (record.name === 'Flux Field') clock.modes = roll.dominance === 'Hope' || roll.isCritical ? [...CARD_MODES['Flux Field']] : [CARD_MODES['Flux Field'].includes(record.mode) ? record.mode : 'Lucky Streak'];
    const live = store.state.tokens.find(t => t.id === actor.id);
    store.updateToken(actor.id, { effectClocks: addClock((live.effectClocks || []).filter(c => c.name !== record.name), clock) });
    notes.push(record.name === 'Flux Field' ? 'Flux Field activo (' + clock.modes.join(' y ') + '): toca la carta para usarlo, una vez por ronda.' : 'Objeto enlazado: toca la carta para lanzarlo como acción.');
  }
  // Mind-Slip: Stagger leaves an NPC Prone; Compel asks it a Presence Reaction Roll (DC 15) and
  // the table moves it on a failure; Field of Hesitation marks its Very Close zone.
  if (success && record.name === 'Mind-Slip') {
    const target = record.targetIds.map(id => store.state.tokens.find(t => t.id === id)).find(Boolean);
    const npc = target && target.isPlayer === false && !isPartyToken(target);
    if (record.mode === 'Stagger' && target) {
      if (npc) { store.updateToken(target.id, { conditions: normalizeConditions([...(target.conditions || []), 'Prone']) }); notes.push(target.name + ' queda Prone.'); }
      else notes.push(target.name + ' queda Prone solo si su jugador lo acepta.');
    } else if (record.mode === 'Compel' && target) {
      if (npc) { extra.replies = [...(record.replies || []), { id: newId(), actorId: target.id, traitId: 'presence', dc: 15 }]; extra.replyFailure = 'muévelo una banda de alcance en la dirección que elija ' + (actor?.name || 'quien lanza') + '.'; notes.push(target.name + ' tira Presence contra DC 15.'); }
      else notes.push(target.name + ' se mueve solo si su jugador lo acepta.');
    } else if (record.mode === 'Field of Hesitation') {
      const centre = target || actor, map = { gridSize: 64, gridScaleMeters: 2, ...(store.getActiveMap?.() || {}) };
      if (centre) extra.area = { x: Math.round(centre.x), y: Math.round(centre.y), reach: 'Very Close', radius: Math.round(areaRadius(centre, map, 'Very Close')), failure: null };
      notes.push('Campo de vacilación (Very Close, una escena): quien intente cruzarlo tira Presence contra DC 10; si falla, se queda fuera y pierde su Acción.');
    }
  }
  // An area Power whose effect lasts on everyone inside (Aura of Clarity, Protective Dome).
  if (success && record.area && CLOCK_BONUSES[record.name] && !procedure) {
    const inside = record.targetIds.map(id => store.state.tokens.find(t => t.id === id && t.mapId === record.mapId)).filter(Boolean);
    for (const t of inside) store.updateToken(t.id, { effectClocks: addClock((t.effectClocks || []).filter(c => c.name !== record.name), newClock({ name: record.name, segments: 1, tick: 'manual', scene: true }, { source: actor?.name || '' })) });
    notes.push(record.name + ' en ' + (inside.map(t => t.name).join(', ') || 'nadie') + '.');
  }
  // The Special state of the play: on a success, to its targets (or to the caster without one).
  if (success && record.special && !record.replies?.length && !(previous && record.specialApplied)) {
    const holders = record.targetIds.map(id => store.state.tokens.find(t => t.id === id && t.mapId === record.mapId)).filter(Boolean);
    const said = applySpecial(store, record.special, holders.length ? holders : [actor].filter(Boolean));
    if (said) { notes.push(said); extra.specialApplied = true; }
  }
  if (success) {
    const targets = record.targetIds.map(id => store.state.tokens.find(t => t.id === id && t.mapId === record.mapId)).filter(Boolean);
    if (record.name === 'Synaptic Disruption' && targets[0]) {
      const target = targets[0], condition = roll.dominance === 'Hope' || roll.isCritical ? 'Stunned' : 'Dazed';
      if (pathImmune(target, condition)) notes.push(target.name + ' es inmune a ' + condition + '.');
      else {
        const clock = newClock({ name: record.name, segments: 1, tick: 'manual' });
        clock.condition = condition;
        clock.expiry = condition === 'Stunned' ? 'round' : 'spotlight-end';
        clock.scene = true;
        store.updateToken(target.id, { effectClocks: addClock(target.effectClocks, clock) });
        notes.push(target.name + ' · ' + condition + (condition === 'Stunned' ? ' por una ronda.' : ' hasta el final de su próximo Spotlight.'));
      }
    } else if (record.name === 'Global Stimulus Field') {
      const participants = store.state.tokens.filter(t => t.mapId === record.mapId && !t.inReserve && (isPartyToken(t) || t.actorType === 'adversary'));
      for (const token of participants) {
        const ally = isPartyToken(token);
        const clock = { ...newClock({name:record.name,segments:1,tick:'manual',scene:true}), expiry:'round', edge: ally ? 'advantage' : 'disadvantage' };
        const patch = {effectClocks:addClock(token.effectClocks,clock)};
        if (ally && token.stress) patch.stress = {...token.stress,current:Math.max(0,token.stress.current-1)};
        if (ally && token.hp && canReceiveHealing(token)) patch.hp = {...token.hp,current:Math.min(token.hp.max,token.hp.current+1)};
        store.updateToken(token.id,patch);
      }
      notes.push('Aliados: +1 HP, −1 Stress y Ventaja. Adversarios: Desventaja hasta el cambio de ronda.');
    } else {
      const immediate = record.name === 'Rapid Regeneration' ? '' : resolveImmediate(store, actor, targets, record);
      if (immediate) notes.push(immediate);
      else if (!record.project && !procedure) {
        // A duration die thrown after the success (v2.41.0): the card waits for it (CARD_DURATION).
        if (record.durationPending && !record.durationFaces) { extra.durationAwaiting = true; notes.push('Ahora se tira la duración.'); }
        else { const said = applyCardDuration(store, record, actor, record.durationFaces || []); if (said) notes.push(said); }
      }
    }
  }
  const failureFear = { 'Drone Whisper': 1, 'Cascading Upgrade': 3, 'Mass Deception': 2, 'Architect of Civilization': 6, 'Force Incarnate': 4, 'Universal Life Force': 4, 'Apotheosis': 4 };
  let failureFearGained = 0;
  if (!success && Object.hasOwn(failureFear, record.name)) {
    const before = store.state.fear;
    store.addFear(failureFear[record.name]);
    failureFearGained = store.state.fear - before;
    notes.push('Fear por el fallo del poder: +' + failureFearGained + ' (máximo 12).');
  }
  let clockId;
  if (success && record.project) clockId = store.addClock({ title: record.name + ' · ' + actor.name, segments: record.project, category: 'progress' }).id;
  if (roll.isCritical && record.refundResolve && actor.resolve) {
    const source = store.state.tokens.find(t => t.id === actor.id);
    store.updateToken(source.id, { resolve: { ...source.resolve, current: Math.min(source.resolve.max, source.resolve.current + record.refundResolve) } });
    notes.push('Uncanny Power recupera el Resolve de acceso.');
  }
  updateResolution(store, record.id, { phase: 'ready', ...(clockId ? { clockId } : {}), ...outcome, failureFearGained, notes, ...extra });
}
