import { store as defaultStore } from './state.js';
import { newId } from './persistence.js';
import { cardDuration, newClock, addClock, tickClocks, helpsOthers, durationDice, tierOf } from './effectClocks.js';
import { rollVeilfarersCheck, checkMath, TRAITS, SUBTRAITS, damageTypeOf } from './rulesEngine.js';
import { cardUse, usedBy, resetCardUses } from './cardLimits.js';
import { activePath, PATH_TRAITS, pathImmune, pathBranch, contextualEdges, CONTEXT_EDGES } from './statePowers.js';
import { cardTargets, createResolution, awaitingRoll, cardToAmend, completeCardRoll, projectSize, resolveImmediate, cardRollOptions, areaRule, areaTargets, areaRadius, AREA_BOONS, SELF_EFFECTS, applySelfEffect, endSelfEffects, CARD_MODES, SUSTAINED, eligible, applySpecial, resolutionLog, updateResolution, applyCardDuration, procedureZone, applyHeal } from './cardResolution.js';
import { firstStrikeRider } from './damageRiders.js';
import { REACTIONS, holdsReaction, canPay } from './powerReactions.js';
import { rollBonus, armedRoll, NEXT_ROLL, barrier } from './powerEffects.js';
import { weaponRangeBand, rollAdversaryCheck, distanceInfo, rangeCheck, isMeleeAttack } from './attackFlow.js';
import { finite } from './validation.js';
import { normalizeConditions, specialState, SPECIAL_PREFIX, visibleConditions } from './conditions.js';
import { isPartyToken } from './tokenPermissions.js';
import { resolveJump } from './starshipJump.js';
import { checkEdge, disciplinedDefense, markMeleeDefense, requireActive, lifeStage, lifePatch, roundKey, canReceiveHealing, BLAZE_CHOICES, LIFE_STATES, helplessTarget, rangedTargetBlock } from './combatState.js';
import { validFaces, facesRoller } from './tableDice.js';
import { newRest, chooseMoves, restComplete, resolveRest, REST_NAMES } from './rest.js';
import { cardData } from './cardData.js';
import { handoffControl, isDroneToken, droneSignal as signalOf } from './drones.js';
import { droneCompatible } from './dronePowers.js';
import { tokenInventory, validateInventory } from './equipment.js';
import { weaponAttackEdge, afterAttackStress, weaponDamageRiders, weaponReadiness, afterShot, FOLLOW_UPS, wielderEvasion, areaProcedure, zoneTargets } from './weaponFeatures.js';
import { npcSave } from './weaponAftermath.js';
import { rollCalc } from './logCalc.js';
import { PROCEDURES, procedureFor } from './powerProcedures.js';
import { hasTag } from './weaponTags.js';
import { droneEvasion } from './drones.js';
import { EQUIPMENT_CATALOG } from './equipmentLibrary.js';
import { installGear, removeGear, wearArmor } from './gear.js';
import { characterCards, playCard, recallPower, learnPower, costLabel, COMMON_EFFORTS, CARD_KINDS, cardKindName, uncannyAccess, uncannyChoices, editArchive } from './loadoutCards.js';
const lastRoll = new Map();
const closingStrike = actor => ({ id: 'breaking-point', branch: pathBranch(actor), label: 'Breaking Point' + (pathBranch(actor) ? ' · ' + pathBranch(actor) : ''), dice: Math.max(1, Math.min(10, actor.proficiency || 1)) + 'd6' });
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
// Whoever acts takes the Spotlight (v2.43.2, user decision): moving a drone is its operator acting.
export function grantActorSpotlight(store, tokenId) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  const operatorId = token?.actorType === 'drone' ? token.drone?.operatorId : '';
  return grantSpotlight(store, operatorId || tokenId);
}
export const ACTIVE_CARD_KINDS = new Set(['power', 'archive', 'move', 'feature']);
// The cards that are Powers (casting one ends Vanish).
const POWER_KINDS = new Set(['power', 'archive']);
// Who has Sneak Attack: every Scoundrel (the Awakened Shadow Operative and the Sleeping The Quiet
// Network both print it, Corebook 12.06).
export const sneakAttacker = token => /scoundrel/i.test(String(token?.characterClass || ''));

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
    if (action.active && pathImmune(actor, name)) throw new Error(actor.name + ' es inmune a ' + name + '.');
    if (actor.isPlayer !== false && LIFE_STATES.includes(name)) throw new Error('Utiliza los controles de progreso y estabilización.');
    const conditions = action.active ? normalizeConditions([...current, name]) : current.filter(c => c !== name);
    if (conditions.length > 30) throw new Error('Máximo 30 condiciones por token.');
    // Frightened names its source (v2.55.0): a token of the same scene, or none (a reminder only).
    const patch = { conditions };
    if (name === 'Frightened' && action.active && action.sourceId !== undefined) {
      const source = action.sourceId ? store.state.tokens.find(t => t.id === String(action.sourceId) && t.mapId === actor.mapId && t.id !== actor.id) : null;
      if (action.sourceId && !source) throw new Error('La fuente del miedo no está en esta escena.');
      patch.frightenedBy = source?.id || null;
    }
    store.updateToken(actor.id, patch);
    return { actorId: actor.id, conditions };
  }
  if (action.type === 'FTL') return resolveJump(store, actor, action, resolveGameAction);
  // A second target or a second attack after an attack (v2.46.0): Automatic, Salvo Fire, Arc,
  // Cleave, Quick. The table checks the attack, the weapon, the distances and pays the Stress;
  // Automatic and Salvo Fire compare the same attack total with the new target's Evasion.
  if (action.type === 'WEAPON_FOLLOWUP') {
    requireActive(actor);
    const kind = String(action.kind ?? ''), rule = FOLLOW_UPS[kind];
    if (!rule) throw new Error('Propiedad de arma desconocida.');
    const record = lastRoll.get(rollKey);
    if (!record || record.id !== action.checkId || !record.attackTargetId || record.mapId !== store.state.activeMapId) throw new Error('Ese ataque ya no está pendiente.');
    const weapon = tokenInventory(actor).weapons.find(w => w.id === String(action.weaponId ?? ''));
    if (!weapon || !hasTag(weapon, kind)) throw new Error(`El arma no tiene ${rule.label}.`);
    if ((record.followUps || []).includes(kind)) throw new Error(`${rule.label} ya se usó en este ataque.`);
    if (rule.hit && !record.hitTarget) throw new Error(`${rule.label} necesita un impacto.`);
    if (rule.melee && weaponRangeBand(weapon) !== 'Melee') throw new Error('Cleave es de un arma Melee.');
    // A new attack needs the weapon ready (Reload, Charge-Up) before anything is paid.
    if (rule.attack && !weaponReadiness(weapon).ready) throw new Error(weaponReadiness(weapon).reason);
    const map = store.getActiveMap?.() || {}, primary = store.state.tokens.find(t => t.id === record.attackTargetId);
    const target = store.state.tokens.find(t => t.id === String(action.targetId ?? '') && t.mapId === actor.mapId && !t.inReserve);
    if (!primary || !target) throw new Error('El objetivo ya no está en la escena.');
    if (rule.sameTarget && target.id !== primary.id) throw new Error('Quick ataca otra vez al mismo objetivo.');
    if (rule.other && (target.id === primary.id || target.id === actor.id)) throw new Error('Elige otro objetivo distinto del primero.');
    const order = ['Melee', 'Very Close', 'Close', 'Far', 'Extreme'];
    if (rule.near && order.indexOf(distanceInfo(primary, target, map).band) > order.indexOf(rule.near)) throw new Error(`${rule.label}: el segundo objetivo debe estar a ${rule.near} del primero.`);
    if ((rule.same || rule.attack) && !rule.sameTarget) {
      const reach = rangeCheck(weapon, distanceInfo(actor, target, map).band);
      if (!reach.allowed) throw new Error(reach.reason || 'Fuera del alcance del arma.');
    }
    const patch = {};
    if (rule.stress) {
      const stress = actor.stress || { current: 0, max: 0 };
      if (stress.max > 0 && (stress.current || 0) + rule.stress > stress.max) throw new Error(`${rule.label} cuesta ${rule.stress} Stress y no queda ninguno libre.`);
      patch.stress = { ...stress, current: (stress.current || 0) + rule.stress };
    }
    if (Object.keys(patch).length) store.updateToken(actor.id, patch);
    record.followUps = [...(record.followUps || []), kind];
    const out = { kind, targetId: target.id, primaryId: primary.id, critical: !!record.isCritical, total: record.total };
    if (rule.same) {
      const melee = weaponRangeBand(weapon) === 'Melee';
      out.evasion = droneEvasion(target) + wielderEvasion(tokenInventory(target).weapons, { melee }).mod;
      out.hit = !!record.isCritical || record.total >= out.evasion || helplessTarget(target);
    }
    const said = rule.same ? `${record.total} contra la Evasion ${out.evasion} de ${target.name}: ${out.hit ? 'impacta' : 'falla'}` : rule.half ? `${target.name} recibe la mitad del daño, sin tirada` : rule.sameTarget ? `segundo ataque contra ${target.name}` : `otro ataque contra ${target.name}`;
    store.addLog({ sender: actor.name, type: 'EFFECT', title: `${rule.label} · ${weapon.name}`, details: `${said}${rule.stress ? ` (marca ${rule.stress} Stress)` : ''}.` });
    if (actor.isPlayer !== false) grantActorSpotlight(store, actor.id);
    return out;
  }
  // Areas and Psionic (v2.46.0). «save»: Explosive, Area (band), Dispersal Wave and Psionic have no
  // attack roll: every creature in the zone makes its Reaction Roll (an NPC here, with the d20s the
  // client threw in 3D; a character's player rolls it and chooses). «attack»: Spray and Waveform
  // compare the attack just made with the Evasion of everyone else in the cone.
  if (action.type === 'WEAPON_AREA') {
    requireActive(actor);
    const inventory = tokenInventory(actor), weapon = inventory.weapons.find(w => w.id === String(action.weaponId ?? ''));
    const procedure = areaProcedure(weapon);
    if (!weapon || !procedure) throw new Error('Esa arma no tiene un área ni es Psionic.');
    const map = store.getActiveMap?.() || {}, distance = (a, b) => distanceInfo(a, b, map);
    if (procedure.mode === 'attack') {
      const record = lastRoll.get(rollKey);
      if (!record || record.id !== action.checkId || !record.attackTargetId || record.mapId !== store.state.activeMapId) throw new Error('Ese ataque ya no está pendiente.');
      if (record.cone) throw new Error(`${procedure.label} ya se resolvió en este ataque.`);
      record.cone = true;
      const primary = store.state.tokens.find(t => t.id === record.attackTargetId);
      const melee = weaponRangeBand(weapon) === 'Melee';
      const items = zoneTargets(store.state.tokens, actor, primary, procedure, distance).filter(t => t.id !== primary.id).map(t => {
        const evasion = droneEvasion(t) + wielderEvasion(tokenInventory(t).weapons, { melee }).mod;
        return { targetId: t.id, name: t.name, evasion, share: record.isCritical || record.total >= evasion ? 1 : 0 };
      });
      store.addLog({ sender: actor.name, type: 'EFFECT', title: `${procedure.label} · ${weapon.name}`, details: items.length ? `${record.total} contra ${items.map(i => `${i.name} (Evasion ${i.evasion}: ${i.share ? 'impacta' : 'falla'})`).join(', ')}.` : 'Nadie más en el cono.' });
      return { kind: procedure.kind, label: procedure.label, mode: 'attack', critical: !!record.isCritical, items };
    }
    const readiness = weaponReadiness(weapon);
    if (!readiness.ready) throw new Error(readiness.reason);
    const impact = store.state.tokens.find(t => t.id === String(action.targetId ?? '') && t.mapId === actor.mapId && !t.inReserve);
    if (!impact) throw new Error('El objetivo ya no está en la escena.');
    const reach = rangeCheck(weapon, distanceInfo(actor, impact, map).band);
    if (!reach.allowed) throw new Error(reach.reason || 'Fuera del alcance del arma.');
    const faces = (Array.isArray(action.faces) ? action.faces : []).slice(0, 30).filter(f => Number.isInteger(f) && f >= 1 && f <= 20);
    const items = zoneTargets(store.state.tokens, actor, impact, procedure, distance).map(t => {
      if (t.isPlayer !== false || isPartyToken(t)) return { targetId: t.id, name: t.name, share: null, player: true };
      const { trait, roll, failed } = npcSave(t, procedure, [faces.shift()]);
      return { targetId: t.id, name: t.name, share: failed ? 1 : procedure.success, math: `${trait[0].toUpperCase() + trait.slice(1)} ${roll.total} vs CD ${procedure.dc}`, failed };
    });
    const shot = afterShot(weapon);
    const patch = shot.spent !== weapon.spent || shot.charged !== weapon.charged ? { inventory: { ...inventory, weapons: inventory.weapons.map(w => w.id === weapon.id ? shot : w) } } : {};
    if (Object.keys(patch).length) store.updateToken(actor.id, patch);
    if (actor.isPlayer !== false) grantActorSpotlight(store, actor.id);
    const share = s => s === 1 ? 'daño completo' : s === 0.5 ? 'la mitad' : 'sin daño';
    const trait = procedure.traits.map(t => t[0].toUpperCase() + t.slice(1)).join(' o ');
    const areaLines = items.map(i => i.player ? `${i.name} tira ${trait} contra CD ${procedure.dc} y elige` : `${i.name}: ${i.math} → ${i.failed ? 'falla' : 'resiste'}, ${share(i.share)}`);
    store.addLog({ sender: actor.name, ...(secret ? { visibility: 'keeper' } : {}), type: 'EFFECT', title: `${procedure.label} · ${weapon.name}`,
      details: areaLines.join(' · ') + '.', calc: [`${procedure.label}: ${procedure.around ? `todos a ${procedure.around} de ${impact.name}` : procedure.cone ? `cono ${procedure.cone}` : impact.name}`, `Reaction Roll: ${trait} contra CD ${procedure.dc} (falla: daño completo; acierta: ${share(procedure.success)})`, ...areaLines] });
    return { kind: procedure.kind, label: procedure.label, mode: 'save', dc: procedure.dc, traits: procedure.traits, success: procedure.success, impactId: impact.id, items };
  }
  // Reload or charge a weapon (v2.45.0): an Action, so it takes the Spotlight.
  if (action.type === 'WEAPON_READY') {
    requireActive(actor);
    const inventory = tokenInventory(actor), weapon = inventory.weapons.find(w => w.id === String(action.weaponId ?? ''));
    if (!weapon) throw new Error('El arma ya no pertenece al personaje.');
    const readiness = weaponReadiness(weapon);
    if (readiness.ready) throw new Error(`${weapon.name} ya está lista para atacar.`);
    const ready = readiness.mode === 'reload' ? { ...weapon, spent: false } : { ...weapon, charged: true };
    store.updateToken(actor.id, { inventory: { ...inventory, weapons: inventory.weapons.map(w => w.id === weapon.id ? ready : w) } });
    if (actor.isPlayer !== false) grantActorSpotlight(store, actor.id);
    const said = readiness.mode === 'reload' ? `recarga ${weapon.name}` : `carga ${weapon.name}: podrá disparar en un Spotlight posterior`;
    store.addLog({ sender: actor.name, type: 'GEAR', title: `${actor.name} ${said}`, details: `${readiness.action} (una Acción).` });
    return { actorId: actor.id, weaponId: weapon.id, mode: readiness.mode };
  }
  // Armor and augmentations: the table puts them on or takes them off and applies or undoes what
  // they change (thresholds, Armor Slots, Evasion, HP, Traits, over-capacity Stress).
  if (action.type === 'GEAR_INSTALL' || action.type === 'GEAR_REMOVE' || action.type === 'GEAR_WEAR') {
    const inventory = tokenInventory(actor);
    let patch, said;
    if (action.type === 'GEAR_INSTALL') {
      const item = EQUIPMENT_CATALOG.find(i => i.id === String(action.catalogId ?? ''));
      if (!item) throw new Error('Ese objeto no está en el catálogo.');
      patch = installGear(actor, inventory, item); said = `${item.category === 'armor' ? 'se pone' : 'instala'} ${item.name}`;
    } else if (action.type === 'GEAR_WEAR') {
      const rowId = action.rowId == null ? null : String(action.rowId), row = rowId && inventory.items.find(r => r.id === rowId);
      patch = wearArmor(actor, inventory, rowId); said = row ? `se pone ${row.name}` : 'se quita la armadura';
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
  if (['CHECK', 'CARD_PLAY', 'UNCANNY_ACCESS', 'POWER_USE', 'LUCKY_BREAK', 'RESOLVE', 'EFFORT', 'STABILIZE'].includes(action.type)) requireActive(actor);
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
    // Taking the drone in hand happens on the operator's Spotlight (Corebook ch. 14): they get it.
    grantSpotlight(store, String(action.operatorId ?? ''));
    const log = { sender: actor.name, type: 'DRONE', title: `${actor.name}: cambio de operador`, details: result.summary };
    store.addLog(log);
    return { id: newId(), actorId: actor.id, log, outcomeTitle: 'CONTROL DEL DRON', summary: result.summary };
  }
  // The duration die of a card that succeeded (v2.41.0): thrown after the roll, in 3D, by whoever
  // cast it; the table applies the clock (Rapid Regeneration: +1 HP now and each Spotlight).
  // The healing dice of a Power procedure (v2.49.0), thrown in 3D by the caster's screen.
  if (action.type === 'CARD_EFFECT') {
    const row = resolutionLog(store, String(action.playId ?? '')), record = row?.resolution;
    if (!record || record.actorId !== actor.id || !Array.isArray(record.effectPending) || !record.effectPending.length || record.mapId !== store.state.activeMapId) throw new Error('Esta carta no espera su curación.');
    const calc = [];
    const said = record.effectPending.map((heal, i) => {
      const [qty, sides] = String(heal.dice).split('d').map(Number);
      const faces = Array.isArray(action.faces?.[i]) && validFaces(action.faces[i], qty, sides) ? action.faces[i] : Array.from({ length: qty }, () => 1 + Math.floor(Math.random() * sides));
      calc.push(`${heal.dice}: [${faces.join(', ')}] = ${faces.reduce((a, b) => a + b, 0)} HP${heal.stress ? ` y −${heal.stress} Stress` : ''}`);
      return applyHeal(store, record, heal, faces.reduce((a, b) => a + b, 0));
    }).filter(Boolean).join(' ');
    calc.push(said);
    updateResolution(store, record.id, { effectPending: null, notes: [...(record.notes || []).filter(n => n !== 'Ahora se tira la curación.'), said].filter(Boolean) });
    const log = { sender: actor.name, type: 'CARD', title: actor.name + ': ' + record.name + ' · curación', details: said, calc };
    store.addLog(log);
    return { id: newId(), actorId: actor.id, log, summary: said };
  }
  if (action.type === 'CARD_DURATION') {
    const row = resolutionLog(store, String(action.playId ?? '')), record = row?.resolution;
    if (!record || record.actorId !== actor.id || record.phase !== 'ready' || !record.durationAwaiting || record.mapId !== store.state.activeMapId) throw new Error('Esta carta no espera su duración.');
    const dd = durationDice(record);
    if (!dd) throw new Error('Esta carta no tira duración.');
    const faces = validFaces(action.faces, dd.qty, dd.sides) ? action.faces.slice() : Array.from({ length: dd.qty }, () => 1 + Math.floor(Math.random() * dd.sides));
    const said = applyCardDuration(store, record, actor, faces);
    updateResolution(store, record.id, { durationAwaiting: false, durationPending: false, durationFaces: faces, notes: [...(record.notes || []).filter(n => n !== 'Ahora se tira la duración.'), said].filter(Boolean) });
    const log = { sender: actor.name, type: 'CARD', title: actor.name + ': ' + record.name + ' · duración', details: said };
    store.addLog(log);
    return { id: newId(), actorId: actor.id, log, summary: said, faces };
  }
  // The card hand: playing a card pays its printed cost; a Recall moves a Power from the Vault
  // to the Loadout. The Keeper's table resolves both, so costs cannot be skipped by a client.
  if (action.type === 'CARD_PLAY' || action.type === 'CARD_RECALL' || action.type === 'CARD_LEARN' || action.type === 'UNCANNY_ACCESS' || action.type === 'ARCHIVE_EDIT' || action.type === 'REACTION_PAY' || action.type === 'POWER_USE' || action.type === 'LUCKY_BREAK') {
    const data = cardData();
    if (!data) throw new Error('Las cartas aún se están cargando. Inténtalo de nuevo en un momento.');
    if (actor.isPlayer === false) throw new Error('Solo los personajes jugadores tienen mano de cartas.');
    // The table that resolves the action applies it, even while its own screen previews the
    // Player view (whose edit guard would otherwise drop the payment silently).
    const apply = patch => store.updateToken(actor.id, patch);
    const sheet = token => ({ ...(token.sourceCharacter ? { sourceCharacter: token.sourceCharacter } : {}), ...(token.sheetFields ? { sheetFields: token.sheetFields } : {}) });
    const resources = token => ({ hope: token.hope || 0, effort: token.effort || 0, stress: token.stress, resolve: token.resolve, hp: token.hp });
    // The action of a sustained Power (v2.35.0): Telekinetic Grasp hurls the object (its damage is
    // prepared by the client against the target); Flux Field, once per round, Advantage for an
    // ally's next roll or Disadvantage on an enemy's next attack.
    if (action.type === 'POWER_USE') {
      const name = String(action.name ?? ''), rule = SUSTAINED[name], clock = actor.effectClocks?.find(c => c.name === name);
      if (!rule || !clock) throw new Error(name + ' no está activo.');
      const map = store.getActiveMap?.(), target = store.state.tokens.find(t => t.id === action.targetId && t.mapId === actor.mapId && !t.hidden);
      if (!target || target.id === actor.id) throw new Error('Elige un objetivo en la escena.');
      let details, damage = null;
      if (name === 'Telekinetic Grasp') {
        if (!eligible(actor, target, map, { reach: rule.reach, self: false })) throw new Error('El objetivo está fuera de alcance (Far) o tras un muro.');
        damage = { formula: Math.max(1, Math.min(10, Number(actor.proficiency) || 1)) + 'd6', type: 'void' };
        details = `${actor.name} lanza el objeto enlazado contra ${target.name}: ${damage.formula} Void.`;
        grantSpotlight(store, actor.id);
      } else {
        const mode = String(action.mode ?? ''), round = roundKey(map || {});
        if (!(clock.modes || []).includes(mode)) throw new Error('Ese modo no está activo.');
        if (clock.meleeRound === round) throw new Error('Flux Field ya se usó esta ronda.');
        const ally = isPartyToken(target);
        if (mode === 'Lucky Streak') {
          if (!ally) throw new Error('Lucky Streak es para un aliado.');
          store.updateToken(target.id, { pendingAdvantage: true });
          details = `Flux Field · Lucky Streak: ${target.name} tiene Ventaja en su próxima tirada.`;
        } else {
          if (ally) throw new Error('Unlucky Enemies es para un enemigo.');
          store.updateToken(target.id, { effectClocks: addClock(target.effectClocks, { ...newClock({ name: 'Flux Field · próximo ataque', segments: 1, tick: 'manual', scene: true }), edge: 'disadvantage', nextAttack: true }) });
          details = `Flux Field · Unlucky Enemies: el próximo ataque de ${target.name} tiene Desventaja.`;
        }
        apply({ effectClocks: actor.effectClocks.map(c => c.id === clock.id ? { ...c, meleeRound: round } : c) });
      }
      const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: ${name}`, details };
      store.addLog(log);
      return { id: newId(), actorId: actor.id, log, summary: details, damage, targetId: target.id };
    }
    // Lucky Break (Void 2, Reaction, 1 Stress): reroll the Hope or the Fear die of your latest
    // roll and keep the new result; the outcome, the Path payout and the Keeper's Fear follow it.
    if (action.type === 'LUCKY_BREAK') {
      if (!characterCards(actor, data).some(c => c.name === 'Lucky Break' && c.playable)) throw new Error('Lucky Break no está en la mano de ' + actor.name + '.');
      if (!canPay(actor, { stress: 1 })) throw new Error(actor.name + ' no puede marcar Stress.');
      const previous = lastRoll.get(rollKey);
      if (!previous || previous.hopeVal == null || previous.keeperD20) throw new Error('Haz primero una tirada de Dualidad.');
      if (previous.luckyBreak) throw new Error('Esa tirada ya se relanzó con Lucky Break.');
      const die = action.die === 'fear' ? 'fear' : 'hope';
      const face = validFaces([action.face], 1, 12) ? action.face : 1 + Math.floor(Math.random() * 12);
      const hopeVal = die === 'hope' ? face : previous.hopeVal, fearVal = die === 'fear' ? face : previous.fearVal;
      const total = previous.total - previous[die + 'Val'] + face, isCritical = hopeVal === fearVal;
      const dominance = isCritical ? 'Hope' : hopeVal > fearVal ? 'Hope' : 'Fear', success = isCritical || total >= previous.dc;
      const resultType = isCritical ? 'CRITICAL_SUCCESS' : `${success ? 'SUCCESS' : 'FAILURE'}_WITH_${dominance.toUpperCase()}`;
      const fearGain = !isCritical && dominance === 'Fear' ? 1 : 0;
      const result = { ...previous, hopeVal, fearVal, total, isCritical, dominance, resultType, fearGain, luckyBreak: { die, from: previous[die + 'Val'], to: face },
        outcomeTitle: isCritical ? 'CRITICAL SUCCESS (Matching Faces)' : resultType.replaceAll('_', ' '),
        outcomeDesc: `Lucky Break: el dado de ${die === 'hope' ? 'Hope' : 'Fear'} pasa de ${previous[die + 'Val']} a ${face}. ${success ? 'La tirada tiene éxito.' : 'La tirada falla.'}` };
      if (previous.hitTarget !== undefined) result.hitTarget = success ? (previous.hitTarget || previous.attackTargetId || null) : null;
      // The payout follows the new dice: Hope (Awakened) and the Keeper's Fear by the difference.
      const patch = { stress: { ...actor.stress, current: (actor.stress?.current || 0) + 1 } };
      const hopeOf = r => (r.isCritical || r.dominance === 'Hope' ? 1 : 0);
      if (actor.path !== 'Sleeping') patch.hope = clamp((actor.hope || 0) + hopeOf(result) - hopeOf(previous), 6);
      if (result.isCritical && !previous.isCritical) patch.stress = { ...patch.stress, current: Math.max(0, patch.stress.current - 1) };
      apply(patch);
      const fearDelta = fearGain - (previous.fearGain || 0);
      if (fearDelta > 0) store.addFear(fearDelta); else if (fearDelta < 0) store.addFear(-Math.min(-fearDelta, store.state.fear));
      const cast = cardToAmend(store, previous);
      if (cast) completeCardRoll(store, cast, result, previous);
      lastRoll.set(rollKey, result);
      const log = { sender: actor.name, type: 'CHECK', title: `${actor.name}: Lucky Break · ${result.outcomeTitle}`, details: `${result.outcomeDesc} Total ${total} vs DC ${previous.dc}. Marca 1 Stress.${actor.path === 'Sleeping' && hopeOf(result) !== hopeOf(previous) ? ' Ajusta el Effort Track si cambia el dado mayor.' : ''}` };
      store.addLog(log);
      return { ...result, log };
    }
    // A reaction Power used in the attack or damage window (v2.33.0): it pays its printed price
    // and leaves what lasts (the amount Impact Absorption keeps, Tactical Overwatch's Armor Slots).
    if (action.type === 'REACTION_PAY') {
      const name = String(action.name ?? ''), rule = REACTIONS[name];
      // Kinetic Barrier absorbs from its pool; at 0 it dissipates (and its Evasion and Resistance go).
      if (name === 'Kinetic Barrier') {
        const wall = barrier(actor);
        if (!wall) throw new Error('La barrera ya no está.');
        const used = Math.max(0, Math.min(wall.left, Math.round(Number(action.amount) || 0))), left = wall.left - used;
        apply({ effectClocks: left > 0 ? actor.effectClocks.map(c => c.id === wall.clock.id ? { ...c, absorbed: left } : c) : actor.effectClocks.filter(c => c.id !== wall.clock.id) });
        const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: Kinetic Barrier`, details: `Absorbe ${used} de daño.${left > 0 ? ` Quedan ${left}.` : ' La barrera se disipa.'}` };
        store.addLog(log);
        return { id: newId(), actorId: actor.id, log, summary: log.details };
      }
      if (!rule || !holdsReaction(actor, name, data)) throw new Error('Esa reacción no está en el Loadout de ' + actor.name + '.');
      if (!canPay(actor, rule.cost)) throw new Error(actor.name + ' no puede pagar ' + name + '.');
      const patch = {};
      if (rule.cost.hope) patch.hope = (actor.hope || 0) - rule.cost.hope;
      if (rule.cost.stress) patch.stress = { ...actor.stress, current: (actor.stress?.current || 0) + rule.cost.stress };
      const amount = Math.max(0, Math.min(200, Math.round(Number(action.amount) || 0)));
      if (name === 'Impact Absorption' && amount) patch.effectClocks = addClock((actor.effectClocks || []).filter(c => c.name !== name), { ...newClock({ name, segments: 1, tick: 'manual', scene: true }), absorbed: amount });
      apply(patch);
      let details = `${actor.name} usa ${name} (${rule.cost.hope ? rule.cost.hope + ' Hope' : rule.cost.stress + ' Stress'}).`;
      if (name === 'Impact Absorption' && amount) details += ` Absorbe ${amount}: su próximo ataque suma ${amount} al daño (o se mueve una banda más).`;
      if (name === 'Tactical Overwatch') {
        const target = store.state.tokens.find(t => t.id === action.targetId && t.mapId === actor.mapId);
        if (!target) throw new Error('El aliado ya no está en la escena.');
        const armor = target.armor || { current: 0, max: 0 };
        store.updateToken(target.id, { armor: { ...armor, current: (armor.current || 0) + 2, max: (armor.max || 0) + 2 },
          effectClocks: addClock(target.effectClocks, { ...newClock({ name, segments: 1, tick: 'manual', scene: true }), tempArmor: 2, sourceId: actor.id }) });
        details += ` ${target.name}: Ventaja en su defensa y +2 Armor Slots temporales hasta el próximo Spotlight de ${actor.name}.`;
      }
      const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: ${name}`, details };
      store.addLog(log);
      return { id: newId(), actorId: actor.id, log, summary: details };
    }
    if (action.type === 'ARCHIVE_EDIT') {
      const result = editArchive(actor, data, { op: action.op, domain: String(action.domain ?? ''), level: action.level });
      apply(sheet(result.token));
      const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: Archivo`, details: result.summary };
      store.addLog(log);
      return { id: newId(), actorId: actor.id, log, summary: result.summary, packages: result.packages };
    }
    if (action.type === 'CARD_LEARN') {
      const result = learnPower(actor, data, String(action.name ?? ''));
      apply(sheet(result.token));
      const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: nuevo Poder`, details: result.summary };
      store.addLog(log);
      return { id: newId(), actorId: actor.id, log, outcomeTitle: 'PODER AÑADIDO', summary: result.summary, learned: result.learned };
    }
    // Uncanny Power, step 1: the access roll (faces of the 3D dice when valid). It spends the
    // Resolve, gives the Keeper the Fear and leaves the access open until a Power is chosen.
    // `cancel` gives up an open access: nothing is refunded.
    if (action.type === 'UNCANNY_ACCESS') {
      if (action.cancel === true) {
        if (!actor.uncanny) return { actorId: actor.id, summary: 'No hay ningún acceso abierto.' };
        apply({ uncanny: null });
        const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: Uncanny Power`, details: `Renuncia al acceso de nivel ${actor.uncanny.access}. El Resolve y el Fear quedan gastados.` };
        store.addLog(log);
        return { actorId: actor.id, log, summary: log.details };
      }
      const result = uncannyAccess(actor, { spent: finite(action.resolveSpent, 1, 12) ? action.resolveSpent : 0, faces: Array.isArray(action.faces) ? action.faces.slice(0, 24) : null, efficiency: action.efficiency === true });
      apply({ resolve: result.token.resolve, uncanny: result.token.uncanny, ...(action.efficiency === true ? { cardUses: result.token.cardUses } : {}) });
      if (result.fear) store.addFear(result.fear);
      const reach = uncannyChoices(characterCards(store.state.tokens.find(t => t.id === actor.id), data), result.access);
      const details = [...result.notes, reach.length ? `Puede elegir: ${reach.map(c => `${c.name} (L${c.level})`).join(', ')}.` : 'Ningún Poder del Archivo está a su alcance.'].join(' ');
      const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: Uncanny Power · acceso ${result.access}`, details };
      store.addLog(log);
      return { id: newId(), actorId: actor.id, log, access: result.access, rolls: result.rolls, total: result.total, fear: result.fear, choices: reach.map(c => c.id), summary: details };
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
    const state = activePath(actor);
    if (card.chooseTrait && !PATH_TRAITS.includes(action.trait)) throw new Error('Elige Agility, Instinct o Strength para este estado.');
    if (card.reverse) {
      if (!state || action.clockId !== state.id) throw new Error('Ese estado ya terminó.');
      if (card.chooseTrait) {
        apply({ effectClocks: actor.effectClocks.map(c => c.id === state.id ? { ...c, trait: action.trait } : c) });
        return { summary: 'Atributo del estado: ' + action.trait };
      }
      const hit = lastRoll.get(rollKey);
      if (!hit || hit.id !== action.checkId || !hit.hitTarget || hit.mapId !== store.state.activeMapId || hit.pathId !== state.id || hit.closedPath) throw new Error('Selecciona una acción con daño pendiente del personaje.');
      apply({ effectClocks: actor.effectClocks.filter(c => c.id !== state.id) });
      hit.closedPath = true;
      const rider = closingStrike(actor);
      const log = { sender: actor.name, type: 'EFFECT', title: 'Breaking Point', details: state.name + ' termina. +' + rider.dice + ' al daño de la acción.' };
      store.addLog(log);
      return { rider, log, summary: log.details };
    }
    if (card.kind === 'effort' || card.kind === 'beardown') throw new Error('Utiliza la acción de Effort o Resolve de esta carta.');
    const openChecks = (store.state.logs || []).filter(row => row.resolution?.phase === 'roll' || row.resolution?.replies?.some(r => !r.outcome));
    if (openChecks.length >= 140) throw new Error('Resuelve las tiradas pendientes antes de jugar otra carta.');
    const use = cardUse(card,store.state);
    if (usedBy(actor,use)) throw new Error(card.name + ' ya está gastado (' + use.label + ').');
    const ids = action.targetIds ?? (action.targetId ? [action.targetId] : []);
    // An area around the caster («all enemies within Close range»): everyone inside is a target.
    const mode = String(action.mode ?? '').slice(0, 30), procedure = procedureFor(card.name, mode);
    const area = areaRule(card, mode);
    // A Power used through the drone the character operates: range, targets and line of sight are
    // measured from the drone (Corebook ch. 14, «Domain Powers Through a Drone»).
    let origin = actor, drone = null;
    if (action.viaDroneId) {
      drone = store.state.tokens.find(t => t.id === action.viaDroneId);
      if (!isDroneToken(drone) || drone.drone?.operatorId !== actor.id) throw new Error('Ese dron no está bajo el control de ' + actor.name + '.');
      if (signalOf(drone) === 'lost') throw new Error('Señal Lost: el dron no recibe órdenes.');
      if (!droneCompatible(card)) throw new Error(card.name + ' no puede usarse a través de un dron: necesita tu cuerpo, tu toque o tu presencia.');
      origin = { ...actor, x: drone.x, y: drone.y, size: drone.size || 1, mapId: drone.mapId };
    }
    let targets;
    if (area) {
      targets = areaTargets(origin, area, store);
      // «Up to three creatures»: the most wounded first (Cellular Reconstruction · Distributed).
      // (Lightbridge: the most stressed first.)
      const need = t => area.most === 'stress' ? (t.stress?.current || 0) : (t.hp?.max || 0) - (t.hp?.current || 0);
      if (area.max) targets = [...targets].sort((a, b) => need(b) - need(a)).slice(0, area.max);
    } else if (procedure?.zone && procedure.zone.shape !== 'around') {
      // A point, a cone or a line: aimed at a token within its reach.
      const center = store.state.tokens.find(t => t.id === ids[0]);
      if (!center || !eligible(origin, center, store.getActiveMap?.(), { reach: procedure.zone.reach, self: false })) throw new Error(`Elige ${procedure.zone.shape === 'point' ? 'el punto (un token)' : 'la dirección (un token)'} de ${card.name} a alcance ${procedure.zone.reach}.`);
      targets = procedureZone(origin, procedure.zone, center, store);
    } else targets = cardTargets(origin, card, ids, store);
    const result = playCard(actor, card, { resolveSpent: finite(action.resolveSpent, 1, 12) ? action.resolveSpent : null });
    // A mode that costs more than the printed first cost (Cellular Reconstruction · Distributed: 2 Hope).
    const extraHope = Math.max(0, (procedure?.cost?.hope || 0) - (card.cost?.hope || 0));
    if (extraHope && !result.failed) {
      if ((result.token.hope || 0) < extraHope) throw new Error(`${card.name} · ${procedure.mode} cuesta ${procedure.cost.hope} Hope.`);
      result.token.hope -= extraHope;
    }
    const areaChecks = area?.check && !result.roll && !result.failed;
    if (drone) result.notes.push(`A través de ${drone.name}.`);
    // Kinetic Blast (v2.32.0): spend 1 Hope (+ up to 2 to Empower) and the next melee attack carries it.
    let kineticClock = null;
    if (card.name === 'Kinetic Blast') {
      const empower = Math.max(0, Math.min(2, Number.isInteger(action.empower) ? action.empower : 0));
      if ((result.token.hope || 0) < empower) throw new Error('No hay Hope suficiente para Empower: hacen falta ' + (1 + empower) + '.');
      result.token.hope -= empower;
      kineticClock = { ...newClock({ name: 'Kinetic Blast', segments: 1, tick: 'manual', scene: true }), empower };
      result.notes.push('Su próximo ataque cuerpo a cuerpo: al impactar, + Strength + 1d8' + (empower ? ' + ' + empower + '×(' + (actor.proficiency || 1) + 'd6) por Empower' : '') + ' de daño Physical (Kinetic).');
    }
    // Powers spent «when making a roll» are armed for the next matching roll; Powers that only
    // give a contextual Advantage for the scene leave their clock (Eyes of Truth).
    let armedClock = null;
    if (NEXT_ROLL[card.name]) {
      armedClock = newClock({ name: card.name, segments: 1, tick: 'manual', scene: true });
      result.notes.push(`Preparado para tu próxima tirada de ${NEXT_ROLL[card.name].traits.join(' o ')}: +${NEXT_ROLL[card.name].bonus(actor)} (${NEXT_ROLL[card.name].note}).`);
    } else if (CONTEXT_EDGES[card.name] && !SELF_EFFECTS[card.name] && !cardDuration(card, actor, () => 1) && !result.roll) {
      armedClock = newClock({ name: card.name, segments: 1, tick: 'manual', scene: true });
      result.notes.push(`Ventaja en ${CONTEXT_EDGES[card.name][0]} · ${CONTEXT_EDGES[card.name][1]} durante la escena.`);
    }
    // Biological Scan: touching the target shows its HP and conditions at once.
    if (card.name === 'Biological Scan' && targets[0]) {
      const t = targets[0];
      result.notes.push(`${t.name}: HP ${t.hp?.current ?? '?'} / ${t.hp?.max ?? '?'} · Stress ${t.stress?.current ?? 0} / ${t.stress?.max ?? 0} · estados: ${[...(t.conditions || []), ...(t.effectClocks || []).filter(c => c.condition).map(c => c.condition)].join(', ') || 'ninguno'}.`);
    }
    if (area && !result.failed) result.notes.push(`Área ${area.reach} alrededor de ${actor.name}: ${targets.map(t => t.name).join(', ') || 'nadie dentro'}.${areaChecks && targets.length ? ` Cada uno tira ${area.check.traitId} contra DC ${area.check.dc}.` : ''}`);
    // A card whose text sets a duration starts an effect clock on the character (Path to
    // Nirvana: Proficiency Spotlights; Rapid Regeneration: 1d4 turns).
    const choice = cardRollOptions(card);
    if (choice && card.kind !== 'archive' && result.roll) {
      const dc = action.cardDC ?? result.roll.dc;
      if (!choice.includes(dc)) throw new Error('DC fuera de las opciones impresas.');
      result.roll.dc = dc;
    }
    const duration = (result.failed || result.roll || card.guidedFeature || projectSize(card)) ? null : cardDuration(card, actor, facesRoller(Array.isArray(action.durationFaces) ? action.durationFaces.slice(0, 4) : []));
    // An effect that may help someone else goes to the ally the player marked (a player
    // character on the same scene), otherwise to the one who plays the card.
    const marked = targets[0];
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
    if (clock && card.chooseTrait) { clock.trait = action.trait; result.notes.push('Ventaja en ' + action.trait + '.'); }
    let immediate = {};
    if (card.name === 'Rapid Regeneration' && duration) {
      const recipient = holder === actor ? result.token : holder;
      const surge = duration.faces?.[0] === 4;
      immediate = { hp: { ...recipient.hp, current: Math.min(recipient.hp.max, recipient.hp.current + 1) },
        ...(surge ? { stress: { ...recipient.stress, current: Math.max(0, recipient.stress.current - 1) } } : {}) };
      result.notes.push(holder.name + ': recupera 1 HP' + (surge ? ' y limpia 1 Stress (Surge).' : '.'));
    }
    apply({ ...resources(result.token), ...(card.kind === 'archive' ? { uncanny: result.token.uncanny ?? null } : {}), ...(use && !result.failed ? {cardUses: {...actor.cardUses,[use.key]:use.scope}} : {}), ...(holder === actor ? immediate : {}) });
    if (holder !== actor && Object.keys(immediate).length) store.updateToken(holder.id, immediate);
    // A Power that works on its caster without a roll (Temporal Cloak · Personal → Hidden).
    if (SELF_EFFECTS[card.name] && !result.roll && !result.failed) result.notes.push(applySelfEffect(store, card.name, actor.id, String(action.mode ?? '')));
    // Another Power of the Domain ends a self effect that says so (Temporal Cloak and Void).
    // (Vanish: casting any Power ends it.)
    const ended = (card.domain || POWER_KINDS.has(card.kind)) && endSelfEffects(store.state.tokens.find(t => t.id === actor.id), { domain: card.domain || '', name: card.name, power: POWER_KINDS.has(card.kind) });
    if (ended) { store.updateToken(actor.id, { effectClocks: ended.effectClocks, conditions: ended.conditions }); result.notes.push('Termina ' + ended.ended.join(', ') + '.'); }
    if (armedClock) { const live = store.state.tokens.find(t => t.id === actor.id); store.updateToken(actor.id, { effectClocks: addClock((live.effectClocks || []).filter(c => c.name !== armedClock.name), armedClock) }); }
    if (kineticClock) { const live = store.state.tokens.find(t => t.id === actor.id); store.updateToken(actor.id, { effectClocks: addClock(live.effectClocks, kineticClock) }); }
    if (area && AREA_BOONS[card.name] && !result.failed && !result.roll) {
      for (const t of targets) store.updateToken(t.id, AREA_BOONS[card.name](store.state.tokens.find(x => x.id === t.id)));
      result.notes.push('Cada aliado del área: +2 a su próxima tirada.');
    }
    // Silenced (v2.53.0, fase 5): the book does not mark which Powers are verbal, so the table says it.
    if (POWER_KINDS.has(card.kind) && visibleConditions(actor).includes('Silenced')) result.notes.push(`${actor.name} está Silenced: si este Poder necesita voz (componente verbal), no puede lanzarse; el Keeper decide.`);
    const effect = !result.roll && !result.failed && resolveImmediate(store, actor, targets, card, action.effectFace);
    if (effect) result.notes.push(effect);
    // A Power, Move or Path feature used as an action gives the Spotlight (a Reaction does not).
    if (ACTIVE_CARD_KINDS.has(card.kind) && !result.pending && !card.reaction && !card.passive && !card.guidedFeature && !projectSize(card)) grantSpotlight(store, actor.id);
    if (clock) {
      const live = store.state.tokens.find(t => t.id === holder.id);
      store.updateToken(live.id, { effectClocks: addClock(live.effectClocks, clock) });
    }
    if (result.fear) store.addFear(result.fear);
    const details = [result.summary, ...result.notes].join(' ');
    const playId = newId();
    const resolution = createResolution(card, actor, targets, result.roll, playId, store.state.activeMapId);
    if (use) resolution.limit = use;
    if (resolution.project && !result.roll && !result.failed) {
      const mission = store.addClock({ title: card.name + ' · ' + actor.name, segments: resolution.project, category: 'progress' });
      resolution.clockId = mission.id;
      resolution.notes = ['Proyecto iniciado. Marca el reloj al resolver cada fase de trabajo impresa.'];
    }
    if (result.failed) resolution.phase = 'done';
    if (SELF_EFFECTS[card.name] || CARD_MODES[card.name]) resolution.mode = String(action.mode ?? '').slice(0, 30);
    // «Choose two» (v2.52.0): the options the player marked (the defaults otherwise).
    if (PROCEDURES[card.name]?.choose && Array.isArray(action.choices)) resolution.choices = action.choices.filter(c => typeof c === 'string' && Object.hasOwn(PROCEDURES[card.name].choose.options, c)).slice(0, 4);
    if (CARD_MODES[card.name] && !CARD_MODES[card.name].includes(resolution.mode)) resolution.mode = CARD_MODES[card.name][0];
    if (area && !result.failed) {
      resolution.area = { x: Math.round(origin.x), y: Math.round(origin.y), reach: area.reach, radius: Math.round(areaRadius(origin, store.getActiveMap?.(), area.reach)), color: card.color || '#00f3ff', failure: area.failure };
      if (areaChecks && targets.length) resolution.replies = targets.map(t => ({ id: newId(), actorId: t.id, traitId: area.check.traitId, dc: area.check.dc }));
    }
    if (card.kind === 'archive' && result.refundResolve) resolution.refundResolve = result.refundResolve;
    // The Special state written by the player (v2.40.0): without a roll it goes on at once to the
    // targets (or the caster); with a roll, on a success; in an area with replies, to who fails.
    const special = typeof action.special === 'string' ? specialState(action.special) : '';
    if (special && !result.failed) {
      resolution.special = special;
      if (!result.roll && !resolution.replies?.length) {
        const said = applySpecial(store, special, targets.length ? targets : [actor]);
        if (said) { result.notes.push(said); resolution.specialApplied = true; }
      } else result.notes.push(`Estado Special preparado: «${special.slice(SPECIAL_PREFIX.length)}»${resolution.replies?.length ? ' para quien falle su tirada.' : ' si la tirada sale.'}`);
    }
    if (action.durationFaces) resolution.durationFaces = action.durationFaces.slice(0, 4);
    // With a roll, the duration die waits for the success (v2.41.0).
    else if (result.roll && !result.failed && durationDice(card) && !PROCEDURES[card.name]) resolution.durationPending = true;
    const log = { sender: actor.name, type: 'CARD', title: actor.name + ': ' + card.name, details: special ? [result.summary, ...result.notes].join(' ') : details, resolution };
    store.addLog(log);
    // The Keeper's table shows the card that was just used.
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('veil:card-played', { detail: { card, playId, actorId: actor.id, actorName: actor.name, playerName: String(action.playerName ?? '').slice(0, 80), summary: result.summary, notes: result.notes, failed: !!result.failed, at: Date.now() } }));
    return { id: playId, actorId: actor.id, log, outcomeTitle: `${cardKindName(card.kind)} · ${costLabel(result.paid)}`.toUpperCase(), card: { id: card.id, name: card.name, kind: card.kind, color: card.color }, roll: result.roll, failed: !!result.failed, notes: result.notes, summary: result.summary, fear: result.fear };
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
    const cast = awaitingRoll(store, action.cardPlayId, actor, o, action.cardReplyId);
    if (cast && (action.attack || secret !== (store.state.logs.find(row => row.resolution?.id === cast.id)?.visibility === 'keeper'))) throw new Error('Resuelve el poder con su propia tirada pública.');
    const state = activePath(actor);
    const ownAttack = target && player && !action.viaDrone && target.id !== actor.id;
    if (action.closingId && (!ownAttack || !state || state.id !== action.closingId)) throw new Error('Breaking Point requiere el estado activo y una acción propia.');
    const weapon = ownAttack && action.weaponId ? tokenInventory(actor).weapons.find(w => w.id === action.weaponId) : null;
    if (ownAttack && action.weaponId && !weapon) throw new Error('El arma ya no pertenece al personaje.');
    // Reload and Charge-Up: a spent or uncharged weapon cannot attack until an Action readies it.
    const readiness = weaponReadiness(weapon);
    if (!readiness.ready) throw new Error(readiness.reason);
    const context = o.contextId && contextualEdges(actor,o.traitId).find(c => c.id === o.contextId);
    if (o.contextId && !context) throw new Error('Ese efecto contextual ya no está activo para el atributo.');
    if (action.closingId && (target.hidden || target.mapId !== store.state.activeMapId)) throw new Error('El objetivo de Breaking Point ya no está en la escena.');
    const melee = ownAttack && (!weapon || weaponRangeBand(weapon) === 'Melee');
    const guard = melee && disciplinedDefense(target, actor, store.getActiveMap?.(), store.state.tokens);
    // Heavy (Rust & Steel 12.06): Strength below +1 attacks with Disadvantage.
    const heavy = weapon ? weaponAttackEdge(weapon, actor) : null;
    // The target's conditions (v2.53.0, fase 5): a Hidden target cannot be shot at; a Prone one
    // gives a ranged attack Advantage; an Incapacitated one is hit automatically.
    const ranged = !!target && !isMeleeAttack(weapon, distanceInfo(actor, target, store.getActiveMap?.() || {}).band);
    const hiddenBlock = target && target.id !== actor.id ? rangedTargetBlock(target, ranged) : '';
    if (hiddenBlock) throw new Error(hiddenBlock);
    const edge = checkEdge(actor, target, o.hasAdvantage || !!context, o.hasDisadvantage || !!guard?.penalty || !!heavy?.disadvantage, o.traitId, { ranged, reaction: !!action.cardReplyId });
    const keeperRoll = !player;
    // Powers in effect (Velocity Surge +2 Agility) and those armed for this roll (Silver Tongue,
    // Vector Calculus: a bonus and a Hope die that counts higher).
    const surge = player ? rollBonus(actor, o.traitId) : 0, armed = player ? armedRoll(actor, o.traitId) : null;
    const powerNotes = [];
    if (surge) powerNotes.push(`+${surge} por Poderes activos`);
    let forcedHope = o.forcedHope;
    if (armed) {
      const face = Number.isFinite(Number(forcedHope)) ? Math.max(1, Math.min(12, Math.round(Number(forcedHope)))) : 1 + Math.floor(Math.random() * 12);
      forcedHope = armed.rule.hope(face);
      powerNotes.push(`${armed.clock.name}: +${armed.rule.bonus(actor)}${forcedHope !== face ? ` · Hope ${face} cuenta como ${forcedHope}` : ''}`);
    }
    const powerMod = surge + (armed ? armed.rule.bonus(actor) : 0);
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
      customMod: (o.customMod || 0) + (actor.pendingCheckBonus || 0) + powerMod,
      forcedHope,
      forcedFear: o.forcedFear,
      forcedAdv: o.forcedAdv,
      forcedResolve: o.forcedResolve,
    });
    const patch = { pendingCheckBonus: 0, pendingAdvantage: false };
    if (armed) patch.effectClocks = (actor.effectClocks || []).filter(c => c.id !== armed.clock.id);
    if (powerNotes.length) result.outcomeDesc = `${result.outcomeDesc || ''} ${powerNotes.join('. ')}.`.trim();
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
    // The weapon's cost after the roll: High-Recoil (Strength 0 or lower) and Unstable (Failure
    // with Fear) mark Stress; Volatile and Catastrophic are recalled.
    const recoil = weapon ? afterAttackStress(weapon, actor, result) : null;
    if (recoil?.stress) {
      const before = patch.stress || actor.stress || { current: 0, max: 0 };
      patch.stress = { ...before, current: before.max > 0 ? Math.min(before.max, (before.current || 0) + recoil.stress) : (before.current || 0) + recoil.stress };
    }
    const weaponNotes = [...(heavy?.notes || []), ...(recoil?.notes || []).map(n => n + '.')];
    if (weaponNotes.length) result.outcomeDesc = `${result.outcomeDesc || ''} ${weaponNotes.join(' ')}`.trim();
    // Integrity Die (Path to Nirvana, Disciplined State): each roll with Fear lowers it by 1, never
    // on matching dice; at 0 the state ends.
    let integrityEnded = [];
    if (player && result.dominance === 'Fear' && !result.isCritical && actor.effectClocks?.some(c => c.tick === 'fear')) {
      const ticked = tickClocks(actor.effectClocks, { kind: 'fear' });
      patch.effectClocks = ticked.list; integrityEnded = ticked.expired;
    }
    const helpless = ownAttack && helplessTarget(target);
    const hit = ownAttack && (result.isCritical || result.total >= o.dc || helpless);
    if (helpless && !result.isCritical && result.total < o.dc) {
      weaponNotes.push(`${target.name} está Incapacitated: el ataque impacta automáticamente.`);
      result.outcomeDesc = `${result.outcomeDesc || ''} ${weaponNotes.at(-1)}`.trim();
    }
    const damageRiders = [];
    if (state && melee) {
      const opening = firstStrikeRider(actor, weapon);
      if (opening && target.isPlayer === false && !isPartyToken(target)) {
        if (hit) damageRiders.push({ ...opening, branch: pathBranch(actor), label: opening.label + ' · ' + (pathBranch(actor) || 'rama') });
        patch.effectClocks = (patch.effectClocks || actor.effectClocks).map(c => c.id === state.id ? { ...c, firstStrikeUsed: true } : c);
      }
      if (hit && /refused/i.test(state.name) && actor.traits?.[state.trait]) damageRiders.push({ id: 'disciplined-trait', label: state.trait, value: actor.traits[state.trait] });
    }
    // Sneak Attack (Scoundrel, Awakened and Sleeping): an attack with Advantage that hits deals
    // +1d6 once (2d6 at Tier 2, 3d6 at Tier 3); more sources of Advantage add nothing.
    if (hit && edge.advantage && sneakAttacker(actor)) damageRiders.push({ id: 'sneak-attack', label: 'Sneak Attack', dice: tierOf(actor.level) + 'd6' });
    // The weapon's own damage on a hit: Scatter +2 up close, Disruptor +1 die against a machine.
    if (hit && weapon) damageRiders.push(...weaponDamageRiders(weapon, { band: distanceInfo(actor, target, store.getActiveMap?.() || {}).band, target, held: tokenInventory(actor).weapons }));
    // The shot spends a Reload weapon and the charge of a Charge-Up one.
    const shot = weapon && afterShot(weapon);
    if (shot && (shot.spent !== weapon.spent || shot.charged !== weapon.charged)) {
      const inventory = tokenInventory(actor);
      patch.inventory = { ...inventory, weapons: inventory.weapons.map(w => w.id === weapon.id ? shot : w) };
    }
    // Attacking ends the self effects that say so (Temporal Cloak) and breaks Hidden.
    const unveiled = ownAttack && endSelfEffects({ ...actor, effectClocks: patch.effectClocks || actor.effectClocks }, { attack: true });
    if (unveiled) { patch.effectClocks = unveiled.effectClocks; patch.conditions = unveiled.conditions; }
    if (ownAttack && (patch.conditions || actor.conditions || []).includes('Hidden')) patch.conditions = (patch.conditions || actor.conditions).filter(c => c !== 'Hidden');
    // Impact Absorption: the amount absorbed goes into the next attack's damage.
    const absorbed = ownAttack && actor.effectClocks?.find(c => c.name === 'Impact Absorption' && c.absorbed);
    if (absorbed) {
      if (hit) damageRiders.push({ id: 'impact-absorption', label: 'Impact Absorption', value: absorbed.absorbed });
      patch.effectClocks = (patch.effectClocks || actor.effectClocks).filter(c => c.id !== absorbed.id);
    }
    // Kinetic Blast armed: this melee attack spends it; a hit adds its damage.
    const kinetic = ownAttack && melee && actor.effectClocks?.find(c => c.name === 'Kinetic Blast');
    if (kinetic) {
      if (hit) {
        damageRiders.push({ id: 'kinetic-blast', label: 'Kinetic Blast', dice: '1d8' });
        if (actor.traits?.strength) damageRiders.push({ id: 'kinetic-blast-strength', label: 'Kinetic Blast · Strength', value: actor.traits.strength });
        for (let i = 0; i < (kinetic.empower || 0); i++) damageRiders.push({ id: 'kinetic-empower-' + i, label: 'Kinetic Blast · Empower', dice: Math.max(1, Math.min(10, Number(actor.proficiency) || 1)) + 'd6' });
      }
      patch.effectClocks = (patch.effectClocks || actor.effectClocks).filter(c => c.id !== kinetic.id);
    }
    if (action.closingId) {
      if (hit) damageRiders.push(closingStrike(actor));
      patch.effectClocks = (patch.effectClocks || actor.effectClocks).filter(c => c.id !== state.id);
    }
    if (target && target.id !== actor.id && actor.effectClocks?.some(c => c.nextAttack)) patch.effectClocks = (patch.effectClocks || actor.effectClocks).filter(c => !c.nextAttack);
    // Stagger and Disorienting: the next action of any kind has Disadvantage and spends them
    // (a Reaction Roll is not an action). So does the plain Dazed condition (v2.53.0).
    if (!action.cardReplyId && actor.effectClocks?.some(c => c.nextAction)) patch.effectClocks = (patch.effectClocks || actor.effectClocks).filter(c => !c.nextAction);
    if (!action.cardReplyId && (patch.conditions || actor.conditions || []).includes('Dazed')) patch.conditions = (patch.conditions || actor.conditions).filter(c => c !== 'Dazed');
    // Brittle on the target: this Physical hit deals +1d6 and Brittle ends.
    const brittle = hit && target?.effectClocks?.find(c => c.brittle);
    if (brittle && (!weapon || damageTypeOf(weapon) === 'physical')) {
      damageRiders.push({ id: 'brittle', label: 'Brittle', dice: '1d6' });
      store.updateToken(target.id, { effectClocks: target.effectClocks.filter(c => c.id !== brittle.id) });
    }
    if (['agility','finesse'].includes(o.traitId) && actor.effectClocks?.some(c => c.name === 'Slipstream Jolt')) patch.effectClocks = (patch.effectClocks || actor.effectClocks).filter(c => c.name !== 'Slipstream Jolt');
    if (!standalone) store.updateToken(actor.id, patch);
    if (guard) markMeleeDefense(store, target, guard);
    // Resolve the normal payout before the card's additional Fear, so revising a
    // failed cast cannot remove the Fear earned by the Duality roll at the cap.
    if (result.fearGain) store.addFear(result.fearGain);
    if (cast) completeCardRoll(store, cast, result);
    // Acting takes the Spotlight (v2.43.2, user decision): any action roll of a player, attack or
    // not, with what a new Spotlight brings (effect clocks such as Rapid Regeneration). A Reaction
    // Roll a card asks for (an area, Mind-Slip) does not.
    if (player && !standalone && !action.cardReplyId) grantActorSpotlight(store, actor.id);
    for (const c of integrityEnded) store.addLog({ sender: actor.name, type: 'EFFECT', title: `Fin de ${c.name}`, details: `${actor.name}: el Integrity Die llega a 0 y «${c.name}» termina.` });
    const record = { id: newId(), actorId: actor.id, ...result,
      ...(cast ? { cardPlayId: cast.id, ...(cast.replyId ? { cardReplyId: cast.replyId } : {}) } : {}),
      ...(ownAttack ? { hitTarget: hit ? target.id : null, attackTargetId: target.id, mapId: store.state.activeMapId, pathId: state?.id || null, closedPath: !!action.closingId, damageRiders } : {}), ...(secret ? { visibility: 'keeper' } : {}) };
    lastRoll.set(rollKey, record);
    const log = {
      sender: actor.name,
      ...(secret ? { visibility: 'keeper' } : {}),
      type: 'CHECK',
      title: `${actor.name}: ${result.outcomeTitle}`,
      details: `${checkMath(result)} vs DC ${result.dc}. ${result.pathPayout}${weaponNotes.length ? ' ' + weaponNotes.join(' ') : ''}`,
      resultType: result.resultType,
      // The full calculation, shown under «Ver cálculo» (v2.51.0).
      calc: rollCalc({ ...result, attack: !!ownAttack }, [...(edge.advantage ? ['Ventaja por: ' + (o.hasAdvantage ? 'elegida' : 'efectos o condiciones')] : []), ...(edge.disadvantage ? ['Desventaja por: ' + (o.hasDisadvantage ? 'elegida o alcance' : 'efectos, condiciones o el arma')] : []), ...powerNotes, ...weaponNotes]),
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
    const cast = cardToAmend(store, previous);
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
    if (cast) completeCardRoll(store, cast, result, previous);
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
    const common = COMMON_EFFORTS.find(c => c.move === move);
    const log = {
      ...(common ? { resolution: createResolution(common, actor, [], null, newId(), store.state.activeMapId) } : {}),
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
  store.update({ rest: null, tokens: store.state.tokens.map(t => (patches.has(t.id) ? { ...t, ...patches.get(t.id), ...(rest.kind === 'long' ? resetCardUses(t,'long rest') : {}) } : t)) });
  const log = { sender: 'Keeper', type: 'REST', title: `${REST_NAMES[rest.kind]} completado`, details: lines.join('\n') || 'Sin cambios.' };
  store.addLog(log);
  return { rest: null, done: true, lines };
}
