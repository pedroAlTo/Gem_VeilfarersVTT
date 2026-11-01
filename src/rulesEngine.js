// src/rulesEngine.js
// Veilfarers Canon Rules Engine (Sacred System Bible Release 12.06)

export const DC_LADDER = [
  { name: 'Routine', dc: 5, desc: 'Under normal circumstances with standard equipment' },
  { name: 'Easy', dc: 10, desc: 'Minor pressure or low complexity' },
  { name: 'Challenging', dc: 15, desc: 'Standard adventuring challenge' },
  { name: 'Difficult', dc: 20, desc: 'Heavy opposition or harsh conditions' },
  { name: 'Extreme', dc: 25, desc: 'Heroic stakes, razor-thin margin' },
  { name: 'Nearly Impossible', dc: 30, desc: 'Legendary feats altering galactic fate' }
];

export const TRAITS = [
  { id: 'agility', name: 'Agility', short: 'AGI' },
  { id: 'strength', name: 'Strength', short: 'STR' },
  { id: 'finesse', name: 'Finesse', short: 'FIN' },
  { id: 'knowledge', name: 'Knowledge', short: 'KNO' },
  { id: 'instinct', name: 'Instinct', short: 'INS' },
  { id: 'presence', name: 'Presence', short: 'PRE' }
];

export const SUBTRAITS = [
  { id: 'pilot', name: 'Pilot / Navigate', parent: 'finesse' },
  { id: 'tech', name: 'Tech', parent: 'knowledge' },
  { id: 'medicine', name: 'Medicine', parent: 'knowledge' }
];

export const KEEPER_MOVES = [
  { id: 'clock_1', name: 'Escalate a Clock', cost: 1, desc: 'Advance any active countdown or threat clock by 1 segment.' },
  { id: 'hazard_2', name: 'Activate Immediate Problem', cost: 2, desc: 'Trigger an alarm, witness, bulkhead breach, or reinforcement vector.' },
  { id: 'environ_2', name: 'Environmental Hazard', cost: 2, desc: 'Atmospheric drop, radiation surge, quantum rift flare, or fire outbreak.' },
  { id: 'hard_move_3', name: 'Hard Keeper Move', cost: 3, desc: 'Adversary uses special apex power, direct flank, or ambushes unready Voidwalker.' }
];

/**
 * Rolls an authentic Veilfarers Hope & Fear Check
 */
export function rollVeilfarersCheck({
  actorName = 'Voidwalker',
  path = 'Awakened', // 'Awakened' or 'Sleeping'
  traitName = 'Finesse',
  traitMod = 0,
  subtraitName = '',
  subtraitMod = 0,
  dc = 15,
  hasAdvantage = false,
  hasDisadvantage = false,
  useResolve = false,
  resolveDieType = 'd4',
  experienceMod = 0,
  experienceLabel = '',
  customMod = 0
}) {
  // 1 Hope d12 + 1 Fear d12
  const hopeVal = Math.floor(Math.random() * 12) + 1;
  const fearVal = Math.floor(Math.random() * 12) + 1;

  // Advantage / Disadvantage (1d6)
  let advVal = 0;
  let disadvVal = 0;
  if (hasAdvantage && !hasDisadvantage) {
    advVal = Math.floor(Math.random() * 6) + 1;
  } else if (hasDisadvantage && !hasAdvantage) {
    disadvVal = Math.floor(Math.random() * 6) + 1;
  }

  // Resolve die (+1d4 or +1d6)
  let resolveVal = 0;
  if (useResolve) {
    const sides = resolveDieType === 'd6' ? 6 : 4;
    resolveVal = Math.floor(Math.random() * sides) + 1;
  }

  // Total Modifier
  const totalMod = traitMod + subtraitMod + advVal - disadvVal + resolveVal + experienceMod + customMod;
  const total = hopeVal + fearVal + totalMod;

  // Rule 1: CRITICAL CHECK (Matching faces on d12s, even 1+1!)
  const isCritical = hopeVal === fearVal;

  let dominance = 'Hope';
  if (!isCritical) {
    dominance = hopeVal > fearVal ? 'Hope' : 'Fear';
  }

  let resultType = '';
  let outcomeTitle = '';
  let outcomeDesc = '';
  let pathPayout = '';
  let fearGain = 0;

  if (isCritical) {
    resultType = 'CRITICAL_SUCCESS';
    outcomeTitle = 'CRITICAL SUCCESS (Matching Faces)';
    outcomeDesc = 'Inviolable automatic success! Path payout granted and double normal damage dice on attacks.';
    if (path === 'Awakened') {
      pathPayout = 'Awakened Payout: Clears 1 Stress and gains +1 Hope (capped at 6).';
    } else {
      pathPayout = 'Sleeping Payout: Clears 1 Stress, marks 2 Effort track segments (clearing track for +1 Effort), and gains +1 extra point in Effort or Resolve.';
    }
  } else if (total >= dc) {
    if (dominance === 'Hope') {
      resultType = 'SUCCESS_WITH_HOPE';
      outcomeTitle = 'SUCCESS WITH HOPE';
      outcomeDesc = 'Action succeeds smoothly! No complication or consequence applies.';
      pathPayout = path === 'Awakened' ? 'Awakened: +1 Hope gained.' : 'Sleeping: +1 segment marked on Effort Track.';
    } else {
      resultType = 'SUCCESS_WITH_FEAR';
      outcomeTitle = 'SUCCESS WITH FEAR';
      outcomeDesc = 'Action succeeds, but at a cost! Exactly one established consequence applies and Keeper gains +1 Fear.';
      fearGain = 1;
    }
  } else {
    // Failure
    if (dominance === 'Hope') {
      resultType = 'FAILURE_WITH_HOPE';
      outcomeTitle = 'FAILURE WITH HOPE';
      outcomeDesc = 'Action fails to achieve the objective, but crew stays composed without new complications.';
      pathPayout = path === 'Awakened' ? 'Awakened: +1 Hope gained.' : 'Sleeping: +1 segment marked on Effort Track.';
    } else {
      resultType = 'FAILURE_WITH_FEAR';
      outcomeTitle = 'FAILURE WITH FEAR';
      outcomeDesc = 'Action fails and situation escalates! Keeper gains +1 Fear and a declared consequence triggers.';
      fearGain = 1;
    }
  }

  return {
    actorName,
    path,
    traitName,
    traitMod,
    subtraitName,
    subtraitMod,
    dc,
    hopeVal,
    fearVal,
    advVal,
    disadvVal,
    resolveVal,
    resolveDieType,
    experienceMod,
    experienceLabel,
    customMod,
    totalMod,
    total,
    isCritical,
    dominance,
    resultType,
    outcomeTitle,
    outcomeDesc,
    pathPayout,
    fearGain,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
}

/**
 * Calculates Damage & Threshold Resolution according to Veilfarers Canon
 * Below Major: 1 HP
 * Major to below Severe: 2 HP
 * Severe or above: 3 HP (+ 1 per 10 above Severe)
 * One Armor Slot lowers the hit by one severity step!
 */
export function resolveDamage({
  attackerName = 'Attacker',
  targetName = 'Target',
  diceFormula = '2d8+2',
  diceCount = 2,
  diceSides = 8,
  flatModifier = 2,
  isCritical = false,
  isKeeperCritical = false,
  isDirectDamage = false,
  targetMajorThreshold = 6,
  targetSevereThreshold = 12,
  useArmorSlot = true,
  currentArmorSlots = 2,
  mountRating = 1 // 1 for person, 2 for Tier 2/3 ship, 3 for Tier 4/5 ship
}) {
  // Roll dice
  let rolls = [];
  let baseDiceTotal = 0;

  if (isKeeperCritical) {
    // Keeper Critical: Maximize normal pool
    for (let i = 0; i < diceCount; i++) {
      rolls.push(diceSides);
      baseDiceTotal += diceSides;
    }
  } else if (isCritical) {
    // Player Critical: Double dice count
    for (let i = 0; i < diceCount * 2; i++) {
      const val = Math.floor(Math.random() * diceSides) + 1;
      rolls.push(val);
      baseDiceTotal += val;
    }
  } else {
    for (let i = 0; i < diceCount; i++) {
      const val = Math.floor(Math.random() * diceSides) + 1;
      rolls.push(val);
      baseDiceTotal += val;
    }
  }

  const rawDamage = (baseDiceTotal + flatModifier) * mountRating;

  let baseSeverity = 'Minor';
  let rawHpDamage = 1;

  if (isDirectDamage) {
    baseSeverity = 'Direct HP';
    rawHpDamage = rawDamage;
  } else {
    if (rawDamage < targetMajorThreshold) {
      baseSeverity = 'Minor';
      rawHpDamage = 1;
    } else if (rawDamage < targetSevereThreshold) {
      baseSeverity = 'Major';
      rawHpDamage = 2;
    } else {
      baseSeverity = 'Severe';
      const excess = rawDamage - targetSevereThreshold;
      const extra = Math.floor(excess / 10);
      rawHpDamage = 3 + extra;
    }
  }

  // Armor Slot mitigation (lowers hit by one severity step)
  let finalHpDamage = rawHpDamage;
  let armorSlotSpent = false;
  let finalSeverity = baseSeverity;

  if (!isDirectDamage && useArmorSlot && currentArmorSlots > 0) {
    armorSlotSpent = true;
    if (baseSeverity === 'Severe') {
      finalSeverity = 'Mitigated to Major';
      finalHpDamage = Math.max(1, rawHpDamage - 1);
    } else if (baseSeverity === 'Major') {
      finalSeverity = 'Mitigated to Minor';
      finalHpDamage = 1;
    } else if (baseSeverity === 'Minor') {
      finalSeverity = 'Deflected';
      finalHpDamage = 0;
    }
  }

  return {
    attackerName,
    targetName,
    rolls,
    baseDiceTotal,
    flatModifier,
    mountRating,
    rawDamage,
    baseSeverity,
    finalSeverity,
    targetMajorThreshold,
    targetSevereThreshold,
    rawHpDamage,
    finalHpDamage,
    armorSlotSpent,
    isDirectDamage,
    isCritical,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
}

/**
 * Dying Spotlight check (1d12: 8+ marks Dying Progress)
 */
export function rollDyingCheck(characterName = 'Voidwalker', isFinalStage = false) {
  const roll = Math.floor(Math.random() * 12) + 1;
  const isMark = roll >= 8;
  const stageName = isFinalStage ? 'Final' : 'Dying';
  
  return {
    characterName,
    stageName,
    roll,
    isMark,
    message: isMark
      ? `${characterName} rolled ${roll} on ${stageName} Spotlight -> PROGRESS MARKED! (8+)`
      : `${characterName} rolled ${roll} on ${stageName} Spotlight -> Holding on, no mark added. (<8)`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
}
