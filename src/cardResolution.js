import { cardUse, usedBy } from './cardLimits.js';
import { printedChecks } from './cardProcedures.js';
import { newId } from './persistence.js';
import { distanceInfo, RANGE_BANDS } from './attackFlow.js';
import { cardDuration, helpsOthers, addClock, newClock, MAX_SEGMENTS } from './effectClocks.js';
import { CONDITIONS, normalizeConditions } from './conditions.js';
import { canReceiveHealing, LIFE_STATES } from './combatState.js';
import { isPartyToken } from './tokenPermissions.js';
import { facesRoller } from './tableDice.js';
import { pathImmune } from './statePowers.js';

// Range and recipients here are the printed activation requirements. Fictional objects and
// points without a token remain legitimate subjects of the other cards.
export const TARGET_RULES = {
  'Rapid Regeneration': { who: 'party', reach: 'Very Close', self: true },
  'Spark of Hope': { who: 'party', reach: 'Melee', self: false },
  'Emergency Repair': { who: 'machine', reach: 'Melee', self: true },
  'Synaptic Disruption': { who: 'creature', reach: 'Close', self: false },
  'Slipstream Jolt': { who: 'any', reach: 'Close', self: false, object: true },
};
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
};
function effectPatch(token, kind, value, condition, record) {
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
  if (!record || record.phase === 'done' || record.mapId !== store.state.activeMapId || store.state.rest) throw new Error('Esta resolución no está disponible en la escena actual.');
  if (operation === 'renew-arc') {
    const actor = store.state.tokens.find(t => t.id === record.actorId);
    const use = cardUse({kind:'power',name:record.name,text:record.text},store.state);
    if (!actor || use?.scopeId !== 'unassigned' || !usedBy(actor,use)) throw new Error('Este poder pertenece a un arco gestionado por la mesa.');
    const cardUses = {...actor.cardUses}; delete cardUses[use.key];
    store.updateToken(actor.id,{cardUses});
    return;
  }
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
  const label = [EFFECT_OPTIONS[kind], ['condition','clear'].includes(kind) ? condition : value, changes.map(c => c.target.name).join(', '), comment].filter(x => x != null && x !== '').join(' · ');
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
export function completeCardRoll(store, record, roll) {
  if (record.replyId) {
    updateResolution(store, record.id, { replies: record.replies.map(r => r.id === record.replyId ? { ...r, outcome: roll.outcomeTitle, total: roll.total } : r) });
    return;
  }
  const actor = store.state.tokens.find(t => t.id === record.actorId);
  const success = roll.isCritical || roll.total >= roll.dc;
  const notes = [];
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
    } else if (record.name === 'Rapid Regeneration' && targets[0]) {
      const target = targets[0];
      if (canReceiveHealing(target)) {
        const duration = cardDuration(record, actor, facesRoller(record.durationFaces || []));
        if (duration) store.updateToken(target.id, { hp: { ...target.hp, current: Math.min(target.hp.max, target.hp.current + 1) },
          ...(duration.faces?.[0] === 4 ? { stress: { ...target.stress, current: Math.max(0, target.stress.current - 1) } } : {}),
          effectClocks: addClock(target.effectClocks, newClock(duration)) });
      }
    } else {
      const immediate = resolveImmediate(store, actor, targets, record);
      if (immediate) notes.push(immediate);
      else if (!record.project) {
        const duration = cardDuration(record, actor, facesRoller(record.durationFaces || []));
        const recipients = helpsOthers(record) && record.targetIds.length ? targets : [actor];
        if (duration) for (const holder of recipients) store.updateToken(holder.id, { effectClocks: addClock(holder.effectClocks, newClock(duration, { source: actor.name })) });
      }
    }
  }
  const failureFear = { 'Drone Whisper': 1, 'Cascading Upgrade': 3, 'Mass Deception': 2, 'Architect of Civilization': 6, 'Force Incarnate': 4 };
  if (!success && Object.hasOwn(failureFear, record.name)) {
    store.addFear(failureFear[record.name]);
    notes.push('Fear por el fallo del poder: +' + failureFear[record.name] + ' (máximo 12).');
  }
  let clockId;
  if (success && record.project) clockId = store.addClock({ title: record.name + ' · ' + actor.name, segments: record.project, category: 'progress' }).id;
  if (roll.isCritical && record.refundResolve && actor.resolve) {
    const source = store.state.tokens.find(t => t.id === actor.id);
    store.updateToken(source.id, { resolve: { ...source.resolve, current: Math.min(source.resolve.max, source.resolve.current + record.refundResolve) } });
    notes.push('Uncanny Power recupera el Resolve de acceso.');
  }
  updateResolution(store, record.id, { phase: 'ready', ...(clockId ? { clockId } : {}), outcome: roll.outcomeTitle, resultType: roll.resultType, total: roll.total, notes });
}
