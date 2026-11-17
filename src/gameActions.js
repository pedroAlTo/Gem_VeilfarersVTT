import { store as defaultStore } from './state.js';
import { newId } from './persistence.js';
import { rollVeilfarersCheck, checkMath, TRAITS, SUBTRAITS } from './rulesEngine.js';
import { finite } from './validation.js';
import { normalizeConditions } from './conditions.js';
import { cardData } from './cardData.js';
import { handoffControl } from './drones.js';
import { characterCards, playCard, recallPower, costLabel, CARD_KINDS } from './loadoutCards.js';
const lastRoll = new Map();
const clamp = (n, max) => Math.max(0, Math.min(max, n));
export function performGameAction(action, store = defaultStore) {
  const secret = action.visibility === 'keeper';
  if (secret && (store.sessionRole === 'player' || store.state.userRole !== 'keeper')) throw new Error('Solo el Keeper puede hacer tiradas secretas.');
  const standalone = secret && action.type === 'CHECK' && !action.actorId;
  const actor = standalone ? { name: 'Keeper', isPlayer: false } : store.state.tokens.find(t => t.id === action.actorId);
  const rollKey = JSON.stringify([store.state.campaignId, action.actorId, secret ? 'keeper' : 'table']);
  if (!actor) throw new Error('Choose a character first.');
  if (action.type === 'CONDITION') {
    if (typeof action.name !== 'string' || !action.name.trim() || action.name.length > 100 || typeof action.active !== 'boolean') throw new Error('Condición inválida.');
    const name = normalizeConditions([action.name])[0], current = normalizeConditions(actor.conditions);
    const conditions = action.active ? normalizeConditions([...current, name]) : current.filter(c => c !== name);
    if (conditions.length > 30) throw new Error('Máximo 30 condiciones por token.');
    store.updateToken(actor.id, { conditions });
    return { actorId: actor.id, conditions };
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
  if (action.type === 'CARD_PLAY' || action.type === 'CARD_RECALL') {
    const data = cardData();
    if (!data) throw new Error('Las cartas aún se están cargando. Inténtalo de nuevo en un momento.');
    if (actor.isPlayer === false) throw new Error('Solo los personajes jugadores tienen mano de cartas.');
    const sheet = token => ({ ...(token.sourceCharacter ? { sourceCharacter: token.sourceCharacter } : {}), ...(token.sheetFields ? { sheetFields: token.sheetFields } : {}) });
    const resources = token => ({ hope: token.hope || 0, effort: token.effort || 0, stress: token.stress, resolve: token.resolve, hp: token.hp });
    if (action.type === 'CARD_RECALL') {
      const result = recallPower(actor, data, String(action.name ?? ''), { mode: action.mode, replace: String(action.replace ?? '') });
      store.updateToken(actor.id, { ...resources(result.token), ...sheet(result.token) });
      const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: Recall`, details: result.summary };
      store.addLog(log);
      return { id: newId(), actorId: actor.id, log, outcomeTitle: 'RECALL', summary: result.summary, entered: result.entered, left: result.left };
    }
    const card = characterCards(actor, data).find(c => c.id === action.cardId);
    if (!card) throw new Error('Esa carta ya no está en la mano de este personaje.');
    const result = playCard(actor, card, { resolveSpent: finite(action.resolveSpent, 1, 12) ? action.resolveSpent : null });
    store.updateToken(actor.id, resources(result.token));
    if (result.fear) store.addFear(result.fear);
    const details = [result.summary, ...result.notes].join(' ');
    const log = { sender: actor.name, type: 'CARD', title: `${actor.name}: ${card.name}`, details };
    store.addLog(log);
    // The Keeper's table shows the card that was just used.
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('veil:card-played', { detail: { card, actorId: actor.id, actorName: actor.name, playerName: String(action.playerName ?? '').slice(0, 80), summary: result.summary, notes: result.notes, failed: !!result.failed, at: Date.now() } }));
    return { id: newId(), actorId: actor.id, log, outcomeTitle: `${CARD_KINDS[card.kind]} · ${costLabel(result.paid)}`.toUpperCase(), card: { id: card.id, name: card.name, kind: card.kind, color: card.color }, roll: result.roll, failed: !!result.failed, notes: result.notes, summary: result.summary, fear: result.fear };
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
    const result = rollVeilfarersCheck({
      actorName: actor.name,
      path: actor.path,
      traitName: !player && actor.attackModifier !== undefined ? 'Attack' : o.traitId,
      traitMod: !player && actor.attackModifier !== undefined ? actor.attackModifier : actor.traits?.[o.traitId] || 0,
      subtraitName: o.subtraitId || '',
      subtraitMod: player ? actor.subtraits?.[o.subtraitId] || 0 : 0,
      dc: o.dc,
      hasAdvantage: !!o.hasAdvantage || !!actor.pendingAdvantage,
      hasDisadvantage: !!o.hasDisadvantage,
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
    if (!player) {
      result.fearGain = 0;
      result.pathPayout = 'Keeper roll: no Path payout or Fear gain.';
      result.outcomeDesc = result.isCritical
        ? 'Automatic success. Maximize the normal damage pool.'
        : 'Resolve the established attack outcome.';
    }
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
    if (!standalone) store.updateToken(actor.id, patch);
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
  if (action.type === 'RESOLVE') {
    const previous = lastRoll.get(rollKey);
    if (!previous)
      throw new Error('Make a check first, then use Bear Down before narrating its outcome.');
    if (actor.path !== 'Sleeping' || (actor.resolve?.current || 0) < 1)
      throw new Error('No Resolve available.');
    const sides = actor.resolve.dieType === 'd6' ? 6 : 4,
      bonus = 1 + Math.floor(Math.random() * sides);
    store.updateToken(actor.id, {
      resolve: { ...actor.resolve, current: actor.resolve.current - 1 },
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
      result.outcomeDesc = `Bear Down adds ${bonus}. ${success ? 'The check succeeds.' : 'The check still fails.'} Dominance and Path payout are unchanged.`;
    }
    lastRoll.set(rollKey, result);
    const log = {
      sender: actor.name,
      type: 'RESOLVE',
      ...(secret ? { visibility: 'keeper' } : {}),
      title: 'Bear Down',
      details: `+${bonus}; ${result.total} vs DC ${result.dc}. ${result.outcomeTitle}`,
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
