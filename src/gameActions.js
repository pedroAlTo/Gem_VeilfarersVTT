import { store as defaultStore } from './state.js';
import { newId } from './persistence.js';
import { cardDuration, newClock, addClock, tickClocks, helpsOthers } from './effectClocks.js';
import { rollVeilfarersCheck, checkMath, TRAITS, SUBTRAITS } from './rulesEngine.js';
import { rollAdversaryCheck, distanceInfo } from './attackFlow.js';
import { finite } from './validation.js';
import { normalizeConditions } from './conditions.js';
import { isPartyToken } from './tokenPermissions.js';
import { resolveJump } from './starshipJump.js';
import { checkEdge, requireActive, lifeStage, lifePatch, roundKey, canReceiveHealing, BLAZE_CHOICES, LIFE_STATES } from './combatState.js';
import { validFaces, facesRoller } from './tableDice.js';
import { newRest, chooseMoves, restComplete, resolveRest, REST_NAMES } from './rest.js';
import { cardData } from './cardData.js';
import { handoffControl } from './drones.js';
import { tokenInventory, validateInventory } from './equipment.js';
import { EQUIPMENT_CATALOG } from './equipmentLibrary.js';
import { installGear, removeGear } from './gear.js';
import { characterCards, playCard, recallPower, learnPower, costLabel, CARD_KINDS, cardKindName } from './loadoutCards.js';
const lastRoll = new Map();
const clamp = (n, max) => Math.max(0, Math.min(max, n));
// The table that resolves an action (the Keeper's, local or hosting) applies it even while its
// own screen previews the Player view, whose edit guard would otherwise drop the change silently.
// tableActing lifts only that guard; saving and broadcasting work as usual.
// A player who finishes an active action (an attack, a Power or Move played, a move on the map)
// takes the Spotlight. Only the table gives it; a cancelled action never reaches here.
// (User decision, 18 Nov 2026.)
export function grantSpotlight(store, tokenId) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token || token.isPlayer === false || token.actorType === 'drone' || token.hasSpotlight || typeof store.setTokenSpotlight !== 'function') return false;
  const before = store.tableActing; store.tableActing = true;
  try { return store.setTokenSpotlight(tokenId, true) !== false; } finally { store.tableActing = before; }
}
export const ACTIVE_CARD_KINDS = new Set(['power', 'archive', 'move', 'feature']);

export function performGameAction(action, store = defaultStore) {
  const before = store.tableActing;
  store.tableActing = store.sessionRole !== 'player' || !!before;
  try { return resolveGameAction(action, store); } finally { store.tableActing = before; }
}
function resolveGameAction(action, store) {
  // Rests: the Keeper starts or cancels one; each character chooses its two moves; the last
  // choice applies the rest to everybody and play goes on.
  if (action.type === 'REST_FINISH') {
    if (store.sessionRole === 'player' || store.state.userRole !== 'keeper') throw new Error('Solo el Keeper puede terminar el descanso.');
    return finishRest(store);
  }
  if (action.type === 'REST_START' || action.type === 'REST_CANCEL') {
    if (store.sessionRole === 'player' || store.state.userRole !== 'keeper') throw new Error('Solo el Keeper puede empezar o cancelar un descanso.');
    if (action.type === 'REST_CANCEL') {
      const kind = store.state.rest?.kind;
      if (!kind) return { rest: null };
      store.update({ rest: null });
      store.addLog({ sender: 'Keeper', type: 'REST', title: `${REST_NAMES[kind]} cancelado`, details: 'La partida continúa sin cambios.' });
      return { rest: null };
    }
    if (store.state.rest) throw new Error('Ya hay un descanso en curso.');
    const rest = newRest(action.kind, store.state.tokens, store.state.activeMapId);
    store.update({ rest });
    store.addLog({ sender: 'Keeper', type: 'REST', title: `${REST_NAMES[rest.kind]}: partida en pausa`, details: 'Cada personaje elige dos movimientos distintos del descanso.' });
    return { rest };
  }
  if (action.type === 'REST_CHOICE') {
    const rest = store.state.rest;
    if (!rest || (action.restId && action.restId !== rest.id)) throw new Error('Ese descanso ya ha terminado.');
    const next = chooseMoves(rest, String(action.actorId ?? ''), action.moves, action.rolls);
    if (!restComplete(next, store.state.tokens)) { store.update({ rest: next }); return { rest: next }; }
    return finishRest(store, next);
  }
  const secret = action.visibility === 'keeper';
  if (secret && (store.sessionRole === 'player' || store.state.userRole !== 'keeper')) throw new Error('Solo el Keeper puede hacer tiradas secretas.');
  const standalone = secret && action.type === 'CHECK' && !action.actorId;
  const actor = standalone ? { name: 'Keeper', isPlayer: false } : store.state.tokens.find(t => t.id === action.actorId);
  const rollKey = JSON.stringify([store.state.campaignId, action.actorId, secret ? 'keeper' : 'table']);
  if (!actor) throw new Error('Choose a character first.');
  if (action.type === 'CONDITION') {
    if (typeof action.name !== 'string' || !action.name.trim() || action.name.length > 100 || typeof action.active !== 'boolean') throw new Error('Condición inválida.');
    const name = normalizeConditions([action.name])[0], current = normalizeConditions(actor.conditions);
    if (actor.isPlayer !== false && LIFE_STATES.includes(name)) throw new Error('Utiliza los controles de progreso y estabilización.');
    const conditions = action.active ? normalizeConditions([...current, name]) : current.filter(c => c !== name);
    if (conditions.length > 30) throw new Error('Máximo 30 condiciones por token.');
    store.updateToken(actor.id, { conditions });
    return { actorId: actor.id, conditions };
  }
  if (action.type === 'FTL') return resolveJump(store, actor, action, resolveGameAction);
  // Armor and augmentations: the table puts them on or takes them off and applies or undoes what
  // they change (thresholds, Armor Slots, Evasion, HP, Traits, over-capacity Stress).
  if (action.type === 'GEAR_INSTALL' || action.type === 'GEAR_REMOVE') {
    const inventory = tokenInventory(actor);
    let patch, said;
    if (action.type === 'GEAR_INSTALL') {
      const item = EQUIPMENT_CATALOG.find(i => i.id === String(action.catalogId ?? ''));
      if (!item) throw new Error('Ese objeto no está en el catálogo.');
      patch = installGear(actor, inventory, item); said = `${item.category === 'armor' ? 'se pone' : 'instala'} ${item.name}`;
    } else {
      const row = [...inventory.weapons, ...inventory.items].find(r => r.id === String(action.rowId ?? ''));
      patch = removeGear(actor, inventory, String(action.rowId ?? '')); said = `quita ${row?.name || 'un objeto'}`;
    }
    validateInventory(patch.inventory);
    store.updateToken(actor.id, patch);
    const log = { sender: actor.name, type: 'GEAR', title: `${actor.name} ${said}`, details: [patch.hp && `Umbrales ${patch.hp.majorThreshold}/${patch.hp.severeThreshold}, HP máx. ${patch.hp.max}`, patch.armor && `Armor Slots ${patch.armor.current}/${patch.armor.max}`, patch.evasion != null && `Evasión ${patch.evasion}`, patch.stress && `Stress máx. ${patch.stress.max}`].filter(Boolean).join(' · ') || 'Sin cambios en sus números.' };
    store.addLog(log);
    return { actorId: actor.id, patch, log };
  }
  if (action.type === 'LIFE_TURN') {
    const stage = lifeStage(actor), map = store.getActiveMap();
    if (action.finish === true) {
      if (stage !== 'Last Act' || !BLAZE_CHOICES.includes(actor.blazeChoice)) throw new Error('No hay un último acto por resolver.');
      store.updateToken(actor.id, lifePatch(actor, 'Dead'));
      const log = { sender: actor.name, type: 'LIFE', title: 'Blaze of Glory', details: actor.blazeChoice + ' · Acto resuelto. Muerte definitiva.' };
      store.addLog(log); return { actorId: actor.id, log };
    }
    if (!['Dying', 'Final'].includes(stage) || actor.mapId !== map.id || !actor.hasSpotlight) throw new Error('Se necesita el Spotlight del personaje en Dying o Final.');
    const turn = roundKey(map);
    if (action.turn != null && action.turn !== turn) throw new Error('La ronda ha cambiado. Revisa el Spotlight actual.');
    if (actor.lifeRollRound === turn) throw new Error('Este Spotlight ya está resuelto.');
    let patch, details;
    if (action.blaze != null) {
      if (action.confirmed !== true || !BLAZE_CHOICES.includes(action.blaze)) throw new Error('Confirma la elección del jugador para Blaze of Glory.');
      patch = { ...lifePatch(actor, 'Last Act'), blazeChoice: action.blaze };
      details = 'Blaze of Glory · ' + action.blaze + '. Resuelve el último acto elegido por el jugador. El personaje muere al finalizarlo.';
    } else {
      const face = validFaces([action.face], 1, 12) ? action.face : 1 + Math.floor(Math.random() * 12);
      const progress = (actor.lifeProgress || 0) + Number(face >= 8);
      patch = progress === 2 ? lifePatch(actor, stage === 'Dying' ? 'Final' : 'Dead') : { conditions: [...new Set([...(actor.conditions || []), stage])], lifeProgress: progress };
      details = stage + ' · d12 [' + face + '] · ' + progress + '/2';
    }
    store.updateToken(actor.id, { ...patch, lifeRollRound: turn });
    const log = { sender: actor.name, type: 'LIFE', title: stage, details };
    store.addLog(log); return { actorId: actor.id, log };
  }
  if (['CHECK', 'CARD_PLAY', 'RESOLVE', 'EFFORT', 'STABILIZE'].includes(action.type)) requireActive(actor);
  if (action.type === 'STABILIZE') {
    const target = store.state.tokens.find(t => t.id === action.targetId);
    const stage = lifeStage(target);
    if (!['Dying', 'Final'].includes(stage) || target.mapId !== actor.mapId || target.mapId !== store.state.activeMapId ||
        distanceInfo(actor, target, store.getActiveMap()).band !== 'Melee') throw new Error('Selecciona un aliado adyacente en Dying o Final.');
    if (!['knowledge', 'finesse'].includes(action.traitId)) throw new Error('Elige Knowledge o Finesse.');
    const result = resolveGameAction({ type: 'CHECK', actorId: actor.id, options: { traitId: action.traitId, subtraitId: action.traitId === 'knowledge' ? 'medicine' : '', dc: stage === 'Final' ? 20 : 15 } }, store);
    if (result.isCritical || result.total >= result.dc) store.updateToken(target.id, lifePatch(target, 'Stabilized'));
    grantSpotlight(store, actor.id);
    return result;
  }
  // Neural Network Control: a registered crew member takes the drone in hand.
  if (action.type === 'DRONE_HANDOFF') {
    const result = handoffControl(store.state.tokens, actor.id, String(action.operatorId ?? ''));
    for (const token of result.tokens) { const before = store.state.tokens.find(t => t.id === token.id); if (before !== token) store.updateToken(token.id, token.id === actor.id ? { drone: token.drone } : { stress: token.stress }); }
    const log = { sender: actor.name, type: 'DRONE', title: `${actor.name}: cambio de operador`, details: result.summary };
    store.addLog(log);
    return { id: newId(), actorId: actor.id, log, outcomeTitle: 'CONTROL DEL DRON', summary: result.summary };
  }
  // The card hand: playing a card pays its printed cost; a Recall moves a Power from the Vault
  // to the Loadout. The Keeper's table resolves both, so costs cannot be skipped by a client.
  if (action.type === 'CARD_PLAY' || action.type === 'CARD_RECALL' || action.type === 'CARD_LEARN') {
    const data = cardData();
    if (!data) throw new Error('Las cartas aún se están cargando. Inténtalo de nuevo en un momento.');
    if (actor.isPlayer === false) throw new Error('Solo los personajes jugadores tienen mano de cartas.');
    // The table that resolves the action applies it, even while its own screen previews the
    // Player view (whose edit guard would otherwise drop the payment silently).
    const apply = patch => store.updateToken(actor.id, patch);
    const sheet = token => ({ ...(token.sourceCharacter ? { sourceCharacter: token.sourceCharacter } : {}), ...(token.sheetFields ? { sheetFields: token.sheetFields } : {}) });
    const resources = token => ({ hope: token.hope || 0, effort: token.effort || 0, stress: token.stress, resolve: token.resolve, hp: token.hp });
    if (action.type === 'CARD_LEARN') {
      const result = learnPower(actor, data, String(action.name ?? ''));
      apply(sheet(result.token));
      const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: nuevo Poder`, details: result.summary };
      store.addLog(log);
      return { id: newId(), actorId: actor.id, log, outcomeTitle: 'PODER AÑADIDO', summary: result.summary, learned: result.learned };
    }
    if (action.type === 'CARD_RECALL') {
      const result = recallPower(actor, data, String(action.name ?? ''), { mode: action.mode, replace: String(action.replace ?? '') });
      apply({ ...resources(result.token), ...sheet(result.token) });
      const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: Recall`, details: result.summary };
      store.addLog(log);
      return { id: newId(), actorId: actor.id, log, outcomeTitle: 'RECALL', summary: result.summary, entered: result.entered, left: result.left };
    }
    const card = characterCards(actor, data).find(c => c.id === action.cardId);
    if (!card) throw new Error('Esa carta ya no está en la mano de este personaje.');
    const result = playCard(actor, card, { resolveSpent: finite(action.resolveSpent, 1, 12) ? action.resolveSpent : null });
    // A card whose text sets a duration starts an effect clock on the character (Path to
    // Nirvana: Proficiency Spotlights; Rapid Regeneration: 1d4 turns).
    const duration = result.failed ? null : cardDuration(card, actor, facesRoller(Array.isArray(action.durationFaces) ? action.durationFaces.slice(0, 4) : []));
    // An effect that may help someone else goes to the ally the player marked (a player
    // character on the same scene), otherwise to the one who plays the card.
    const marked = action.targetId && action.targetId !== actor.id ? store.state.tokens.find(t => t.id === action.targetId) : null;
    const holder = duration && marked && helpsOthers(card) && (marked.isPlayer !== false || isPartyToken(marked)) && marked.actorType !== 'drone' && !marked.hidden && marked.mapId === actor.mapId ? marked : actor;
    if (card.name === 'Rapid Regeneration' && duration) {
      if ((action.targetId && holder.id !== action.targetId) || !['Melee', 'Very Close'].includes(distanceInfo(actor, holder, store.getActiveMap?.()).band))
        throw new Error('Rapid Regeneration requiere un aliado a alcance Very Close o al propio personaje.');
      if (!canReceiveHealing(holder)) throw new Error('Estabiliza al personaje antes de aplicar curación ordinaria.');
    }
    if (duration) {
      const when = duration.tick === 'fear' ? '' : duration.scene && duration.tick === 'manual' ? ' Termina al acabar la escena.' : ` Avanza un segmento cada vez que ${holder.name} gana el foco.`;
      result.notes.push(`Reloj «${duration.name}»${holder !== actor ? ` en ${holder.name}` : ''}: ${duration.note}${when}`);
    }
    const clock = duration ? newClock(duration, { source: actor.name }) : null;
    let immediate = {};
    if (card.name === 'Rapid Regeneration' && duration) {
      const recipient = holder === actor ? result.token : holder;
      const surge = duration.faces?.[0] === 4;
      immediate = { hp: { ...recipient.hp, current: Math.min(recipient.hp.max, recipient.hp.current + 1) },
        ...(surge ? { stress: { ...recipient.stress, current: Math.max(0, recipient.stress.current - 1) } } : {}) };
      result.notes.push(holder.name + ': recupera 1 HP' + (surge ? ' y limpia 1 Stress (Surge).' : '.'));
    }
    apply({ ...resources(result.token), ...(holder === actor ? immediate : {}), ...(clock && holder === actor ? { effectClocks: addClock(actor.effectClocks, clock) } : {}) });
    if (clock && holder !== actor) store.updateToken(holder.id, { ...immediate, effectClocks: addClock(holder.effectClocks, clock) });
    // A Power, Move or Path feature used as an action gives the Spotlight (a Reaction does not).
    if (ACTIVE_CARD_KINDS.has(card.kind) && !card.reaction) grantSpotlight(store, actor.id);
    if (result.fear) store.addFear(result.fear);
    const details = [result.summary, ...result.notes].join(' ');
    const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: ${card.name}`, details };
    store.addLog(log);
    // The Keeper's table shows the card that was just used.
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('veil:card-played', { detail: { card, actorId: actor.id, actorName: actor.name, playerName: String(action.playerName ?? '').slice(0, 80), summary: result.summary, notes: result.notes, failed: !!result.failed, at: Date.now() } }));
    return { id: newId(), actorId: actor.id, log, outcomeTitle: `${cardKindName(card.kind)} · ${costLabel(result.paid)}`.toUpperCase(), card: { id: card.id, name: card.name, kind: card.kind, color: card.color }, roll: result.roll, failed: !!result.failed, notes: result.notes, summary: result.summary, fear: result.fear };
  }
  if (action.type === 'CHECK') {
    const o = action.options || {};
    if (
      !TRAITS.some((t) => t.id === o.traitId) ||
      !finite(o.dc, 1, 100) ||
      !finite(o.customMod ?? 0, -100, 100) ||
      !finite(o.experienceMod ?? 0, 0, 10)
    )
      throw new Error('Invalid roll options.');
    if (o.subtraitId && !SUBTRAITS.some((t) => t.id === o.subtraitId && t.parent === o.traitId))
      throw new Error('Choose the parent Trait for this Subtrait.');
    const player = actor.isPlayer !== false,
      sleeping = actor.path === 'Sleeping',
      exp = o.experienceMod || 0,
      resolve = o.useResolve ? 1 : 0;
    if (!player && (exp || resolve)) throw new Error('Keeper attacks do not spend Path resources.');
    if (exp && !sleeping && (actor.hope || 0) < 1) throw new Error('An Experience costs 1 Hope.');
    if (resolve && (!sleeping || (actor.resolve?.current || 0) < resolve))
      throw new Error('Resolve requires a Sleeping character with available Resolve.');
    const target = action.attack && action.targetId ? store.state.tokens.find(t => t.id === action.targetId && t.mapId === actor.mapId) : null;
    if (action.attack && action.targetId && !target) throw new Error('El objetivo ya no está en esta escena.');
    const edge = checkEdge(actor, target, o.hasAdvantage, o.hasDisadvantage);
    const keeperRoll = !player;
    const result = keeperRoll ? rollAdversaryCheck({
      actorName: actor.name,
      modifier: (actor.attackModifier ?? 0) + (o.customMod || 0) + (actor.pendingCheckBonus || 0),
      traitMod: actor.attackModifier ?? 0,
      dc: o.dc,
      hasAdvantage: edge.advantage,
      hasDisadvantage: edge.disadvantage,
      forcedD20: o.forcedD20 ?? null,
      forcedD6: o.forcedAdv ?? null,
    }) : rollVeilfarersCheck({
      actorName: actor.name,
      path: actor.path,
      traitName: !player && actor.attackModifier !== undefined ? 'Attack' : o.traitId,
      traitMod: !player && actor.attackModifier !== undefined ? actor.attackModifier : actor.traits?.[o.traitId] || 0,
      subtraitName: o.subtraitId || '',
      subtraitMod: player ? actor.subtraits?.[o.subtraitId] || 0 : 0,
      dc: o.dc,
      hasAdvantage: edge.advantage,
      hasDisadvantage: edge.disadvantage,
      useResolve: !!resolve,
      resolveDieType: actor.resolve?.dieType || 'd4',
      experienceMod: exp,
      customMod: (o.customMod || 0) + (actor.pendingCheckBonus || 0),
      forcedHope: o.forcedHope,
      forcedFear: o.forcedFear,
      forcedAdv: o.forcedAdv,
      forcedResolve: o.forcedResolve,
    });
    const patch = { pendingCheckBonus: 0, pendingAdvantage: false };
    if (resolve) patch.resolve = { ...actor.resolve, current: actor.resolve.current - 1 };
    if (player && !sleeping) {
      patch.hope = clamp(
        (actor.hope || 0) -
          (exp ? 1 : 0) +
          (result.dominance === 'Hope' || result.isCritical ? 1 : 0),
        6
      );
    } else if (player) {
      let effort = actor.effort || 0,
        track = [...(actor.effortTrack || [false, false])];
      if (result.isCritical) {
        effort = clamp(effort + 1, 6);
        track = [false, false];
        if (o.criticalChoice === 'resolve' || effort >= 6) {
          const r = patch.resolve || actor.resolve;
          patch.resolve = { ...r, current: clamp(r.current + 1, r.max) };
        } else effort = clamp(effort + 1, 6);
      } else if (result.dominance === 'Hope' && o.meaningful !== false) {
        if (track[0]) {
          effort = clamp(effort + 1, 6);
          track = [false, false];
        } else track = [true, false];
      }
      patch.effort = effort;
      patch.effortTrack = track;
    }
    if (player && result.isCritical)
      patch.stress = { ...actor.stress, current: Math.max(0, (actor.stress?.current || 0) - 1) };
    // Integrity Die (Path to Nirvana, Disciplined State): each roll with Fear lowers it by 1, never
    // on matching dice; at 0 the state ends.
    let integrityEnded = [];
    if (player && result.dominance === 'Fear' && !result.isCritical && actor.effectClocks?.some(c => c.tick === 'fear')) {
      const ticked = tickClocks(actor.effectClocks, { kind: 'fear' });
      patch.effectClocks = ticked.list; integrityEnded = ticked.expired;
    }
    if (!standalone) store.updateToken(actor.id, patch);
    if (action.attack && player) grantSpotlight(store, actor.id);
    for (const c of integrityEnded) store.addLog({ sender: actor.name, type: 'EFFECT', title: `Fin de ${c.name}`, details: `${actor.name}: el Integrity Die llega a 0 y «${c.name}» termina.` });
    if (result.fearGain) store.addFear(result.fearGain);
    const record = { id: newId(), actorId: actor.id, ...result, ...(secret ? { visibility: 'keeper' } : {}) };
    lastRoll.set(rollKey, record);
    const log = {
      sender: actor.name,
      ...(secret ? { visibility: 'keeper' } : {}),
      type: 'CHECK',
      title: `${actor.name}: ${result.outcomeTitle}`,
      details: `${checkMath(result)} vs DC ${result.dc}. ${result.pathPayout}`,
      resultType: result.resultType,
    };
    store.addLog(log);
    return { ...record, log };
  }
  // Bear Down after a damage roll (Corebook ch. 7: "any Duality Roll, attack, reaction, or
  // damage roll"): the Resolve Dice are spent and rolled here; the dice panel adds the total
  // to the damage that has not been applied yet.
  if (action.type === 'RESOLVE' && action.target === 'damage') {
    if (actor.path !== 'Sleeping' || (actor.resolve?.current || 0) < 1) throw new Error('No Resolve available.');
    const count = Math.max(1, Math.min(actor.resolve.current, Number.isInteger(action.count) ? action.count : 1));
    const sides = actor.resolve.dieType === 'd6' ? 6 : 4,
      dice = validFaces(action.faces, count, sides) ? action.faces.slice() : Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides)),
      bonus = dice.reduce((n, v) => n + v, 0);
    store.updateToken(actor.id, { resolve: { ...actor.resolve, current: actor.resolve.current - count } });
    const log = {
      sender: actor.name, type: 'RESOLVE', ...(secret ? { visibility: 'keeper' } : {}),
      title: 'Bear Down · daño', details: `${count}${actor.resolve.dieType || 'd4'} [${dice.join(', ')}] = +${bonus} al daño.`,
    };
    store.addLog(log);
    return { id: newId(), actorId: actor.id, damage: true, bearDown: { count, dice, bonus }, log };
  }
  if (action.type === 'RESOLVE') {
    const previous = lastRoll.get(rollKey);
    if (!previous)
      throw new Error('Make a check first, then use Bear Down before narrating its outcome.');
    if (actor.path !== 'Sleeping' || (actor.resolve?.current || 0) < 1)
      throw new Error('No Resolve available.');
    // Bear Down spends any number of Resolve Dice and adds their total (Corebook ch. 7).
    const count = Math.max(1, Math.min(actor.resolve.current, Number.isInteger(action.count) ? action.count : 1));
    const sides = actor.resolve.dieType === 'd6' ? 6 : 4,
      dice = validFaces(action.faces, count, sides) ? action.faces.slice() : Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides)),
      bonus = dice.reduce((n, v) => n + v, 0);
    store.updateToken(actor.id, {
      resolve: { ...actor.resolve, current: actor.resolve.current - count },
    });
    const result = {
      ...previous,
      total: previous.total + bonus,
      totalMod: previous.totalMod + bonus,
      resolveVal: (previous.resolveVal || 0) + bonus,
    };
    if (!result.isCritical) {
      const success = result.total >= result.dc;
      result.resultType = `${success ? 'SUCCESS' : 'FAILURE'}_WITH_${result.dominance.toUpperCase()}`;
      result.outcomeTitle = result.resultType.replaceAll('_', ' ');
      result.outcomeDesc = `Bear Down adds ${bonus} (${count}${actor.resolve.dieType || 'd4'}: ${dice.join(', ')}). ${success ? 'The check succeeds.' : 'The check still fails.'} Dominance and Path payout are unchanged.`;
    }
    result.bearDown = { count, dice, bonus };
    lastRoll.set(rollKey, result);
    const log = {
      sender: actor.name,
      type: 'RESOLVE',
      ...(secret ? { visibility: 'keeper' } : {}),
      title: 'Bear Down',
      details: `${count}${actor.resolve.dieType || 'd4'} [${dice.join(', ')}] = +${bonus}; ${result.total} vs DC ${result.dc}. ${result.outcomeTitle}`,
    };
    store.addLog(log);
    return { ...result, log };
  }
  if (action.type === 'EFFORT') {
    if (actor.path !== 'Sleeping') throw new Error('Effort moves require a Sleeping character.');
    const allowed = {
      'Steady Hands (+2)': 1,
      'Read the Room': 1,
      'Push Through': 1,
      'The Opening': 2,
      'Try Again': 2,
      'Brace (Mitigate)': 2,
      'Cover the Angle': 2,
      'Second Wind': 3,
      'Seize the Moment': 3,
    };
    const move = String(action.move || '');
    const cost = allowed[move];
    if (!cost) throw new Error('Use the printed move cost in your character sheet.');
    if (cost === 3 && !store.state.optionalEfforts)
      throw new Error('The Keeper must enable both optional Efforts before the session.');
    const burnout = action.burnout === true && actor.effort === 0;
    if (burnout && (actor.hp?.current || 0) < 1) throw new Error('Burnout requires at least 1 HP.');
    if (!burnout && (actor.effort || 0) < cost) throw new Error('Not enough Effort.');
    if (move.startsWith('Steady Hands') && actor.pendingCheckBonus)
      throw new Error('Steady Hands is already prepared for the next check.');
    if (move === 'The Opening' && actor.pendingAdvantage)
      throw new Error('The Opening is already prepared.');
    if (move === 'Brace (Mitigate)' && actor.pendingBrace)
      throw new Error('Brace is already prepared.');
    const patch = { effort: burnout ? 0 : actor.effort - cost };
    if (burnout) {
      const stressMax = actor.isBurnedOut ? actor.stress.max : Math.max(1, actor.stress.max - 1);
      Object.assign(patch, {
        hp: { ...actor.hp, current: actor.hp.current - 1 },
        stress: {
          ...actor.stress,
          max: stressMax,
          current: Math.min(stressMax, actor.stress.current + 1),
        },
        isBurnedOut: true,
        baseStressMax: actor.baseStressMax || actor.stress.max,
      });
    }
    if (move.startsWith('Steady Hands')) patch.pendingCheckBonus = 2;
    if (move === 'The Opening') patch.pendingAdvantage = true;
    if (move === 'Brace (Mitigate)') patch.pendingBrace = true;
    if (move === 'Second Wind')
      patch.stress = {
        ...(patch.stress || actor.stress),
        current: Math.max(0, (patch.stress || actor.stress).current - 2),
      };
    store.updateToken(actor.id, patch);
    const log = {
      sender: actor.name,
      type: 'EFFORT',
      title: move,
      details: `${burnout ? 'Burnout: paid 1 HP, marked 1 Stress.' : `Spent ${cost} Effort.`}${move.startsWith('Steady') ? ' +2 prepared for the next check.' : ' Resolve the printed effect at the table.'}`,
    };
    store.addLog(log);
    return { log };
  }
  throw new Error('Unsupported game action.');
}

// Everyone has chosen: apply every character's moves, log them, and end the pause.
export function finishRest(store, rest = store.state.rest) {
  if (!rest) return { rest: null };
  const { patches, lines } = resolveRest(rest, store.state.tokens);
  store._beforeTacticalMutation?.(REST_NAMES[rest.kind]);
  store.update({ rest: null, tokens: store.state.tokens.map(t => (patches.has(t.id) ? { ...t, ...patches.get(t.id) } : t)) });
  const log = { sender: 'Keeper', type: 'REST', title: `${REST_NAMES[rest.kind]} completado`, details: lines.join('\n') || 'Sin cambios.' };
  store.addLog(log);
  return { rest: null, done: true, lines };
}
