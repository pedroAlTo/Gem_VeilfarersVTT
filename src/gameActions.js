import { store } from './state.js';
import { newId } from './persistence.js';
import { rollVeilfarersCheck, TRAITS, SUBTRAITS } from './rulesEngine.js';
import { finite } from './validation.js';
const lastRoll = new Map();
const clamp = (n, max) => Math.max(0, Math.min(max, n));
export function performGameAction(action) {
  const actor = store.state.tokens.find((t) => t.id === action.actorId);
  const rollKey = `${store.state.campaignId}:${action.actorId}`;
  if (!actor) throw new Error('Choose a character first.');
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
      traitName: o.traitId,
      traitMod: actor.traits?.[o.traitId] || 0,
      subtraitName: o.subtraitId || '',
      subtraitMod: actor.subtraits?.[o.subtraitId] || 0,
      dc: o.dc,
      hasAdvantage: !!o.hasAdvantage || !!actor.pendingAdvantage,
      hasDisadvantage: !!o.hasDisadvantage,
      useResolve: !!resolve,
      resolveDieType: actor.resolve?.dieType || 'd4',
      experienceMod: exp,
      customMod: (o.customMod || 0) + (actor.pendingCheckBonus || 0),
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
    store.updateToken(actor.id, patch);
    if (result.fearGain) store.addFear(result.fearGain);
    const record = { id: newId(), actorId: actor.id, ...result };
    lastRoll.set(rollKey, record);
    const log = {
      sender: actor.name,
      type: 'CHECK',
      title: `${actor.name}: ${result.outcomeTitle}`,
      details: `Hope [${result.hopeVal}] + Fear [${result.fearVal}] ${result.totalMod >= 0 ? '+' : ''}${result.totalMod} = ${result.total} vs DC ${result.dc}. ${result.pathPayout}`,
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
