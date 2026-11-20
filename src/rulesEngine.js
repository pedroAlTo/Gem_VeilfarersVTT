import { hasTag } from './weaponTags.js';
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
  customMod = 0,
  forcedHope = null,
  forcedFear = null,
  forcedAdv = null,
  forcedResolve = null
}) {
  // 1 Hope d12 + 1 Fear d12 (lee la cara física si fue lanzada en 3D, o genera aleatoria)
  const hopeVal = (forcedHope != null && Number.isFinite(Number(forcedHope)))
    ? Math.max(1, Math.min(12, Math.round(Number(forcedHope))))
    : Math.floor(Math.random() * 12) + 1;
  const fearVal = (forcedFear != null && Number.isFinite(Number(forcedFear)))
    ? Math.max(1, Math.min(12, Math.round(Number(forcedFear))))
    : Math.floor(Math.random() * 12) + 1;

  // Advantage / Disadvantage (1d6)
  let advVal = 0;
  let disadvVal = 0;
  if (hasAdvantage && !hasDisadvantage) {
    advVal = (forcedAdv != null && Number.isFinite(Number(forcedAdv)))
      ? Math.max(1, Math.min(6, Math.round(Number(forcedAdv))))
      : Math.floor(Math.random() * 6) + 1;
  } else if (hasDisadvantage && !hasAdvantage) {
    disadvVal = (forcedAdv != null && Number.isFinite(Number(forcedAdv)))
      ? Math.max(1, Math.min(6, Math.round(Number(forcedAdv))))
      : Math.floor(Math.random() * 6) + 1;
  }

  // Resolve die (+1d4 or +1d6)
  let resolveVal = 0;
  if (useResolve) {
    const sides = resolveDieType === 'd6' ? 6 : 4;
    resolveVal = (forcedResolve != null && Number.isFinite(Number(forcedResolve)))
      ? Math.max(1, Math.min(sides, Math.round(Number(forcedResolve))))
      : Math.floor(Math.random() * sides) + 1;
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

// The sum of a check written out, so no die hides inside a single "modifier" figure:
// "Hope [7] + Fear [3] + 2 − d6 [5] (Desventaja) = 7".
export function checkMath(result) {
  if (result.keeperD20) {
    const flat = result.totalMod - (result.advVal || 0) + (result.disadvVal || 0);
    return `d20 [${result.d20}]${flat ? ` ${flat > 0 ? '+' : '−'} ${Math.abs(flat)}` : ''}`
      + (result.advVal ? ` + d6 [${result.advVal}] (Ventaja)` : '') + (result.disadvVal ? ` − d6 [${result.disadvVal}] (Desventaja)` : '')
      + ` = ${result.total}`;
  }
  const flat = result.totalMod - (result.advVal || 0) + (result.disadvVal || 0) - (result.resolveVal || 0);
  return `Hope [${result.hopeVal}] + Fear [${result.fearVal}]${flat ? ` ${flat > 0 ? '+' : '−'} ${Math.abs(flat)}` : ''}`
    + (result.resolveVal ? ` + ${result.resolveDieType || 'd4'} [${result.resolveVal}] (Resolve)` : '')
    + (result.advVal ? ` + d6 [${result.advVal}] (Ventaja)` : '') + (result.disadvVal ? ` − d6 [${result.disadvVal}] (Desventaja)` : '')
    + ` = ${result.total}`;
}

/**
 * Calculates Damage & Threshold Resolution according to Veilfarers Canon
 * Below Major: 1 HP
 * Major to below Severe: 2 HP
 * Severe or above: 3 HP (+ 1 per 10 above Severe)
 * One Armor Slot lowers the hit by one severity step!
 */
// Corebook ch. 10, Damage Types: Penetration lowers BOTH thresholds for that hit only.
// It never bypasses armor. Reflective armor cancels Energy; a Ward cancels Void and Neural.
export const DAMAGE_TYPES = { physical: 'Physical', energy: 'Energy', void: 'Void', neural: 'Neural' };
const PENETRATION = { physical: 0, energy: 2, void: 4, neural: 4 };
// The type comes from the damage line ("d8+1 ene.") and, for a weapon, its tags (Energy;
// Phasing deals Void), not from words in its description.
export function damageTypeOf(source) {
  if (source && typeof source === 'object') {
    if (hasTag(source, 'phasing')) return 'void';
    const own = damageTypeOf([source.damageType, source.damage].join(' '));
    return own === 'physical' && hasTag(source, 'energy') ? 'energy' : own;
  }
  const text = String(source ?? '').toLowerCase();
  const primary = text.match(/\b(physical|phys|energy|ene|void|neural)\b/)?.[1];
  if (primary) return ({ phys: 'physical', ene: 'energy' })[primary] || primary;
  if (/\bphasing\b/.test(text)) return 'void';
  if (/\bpsionic\b/.test(text)) return 'neural';
  if (/\b(?:plasma|laser|arc|thermal|fire|cold|sonic|radiant|radiation|lightning|corrosive|acid)\b/.test(text)) return 'energy';
  return 'physical';
}
// Weapon tags (Corebook ch. 10). Crushing: the hit ignores one Armor Slot, unless the target's
// armor is Composite. Bleed: any hit applies Bleeding, whatever its tier.
export function weaponTags(source) {
  if (source && typeof source === 'object') return { crushing: hasTag(source, 'crushing'), bleed: hasTag(source, 'bleed') };
  const text = String(source ?? '');
  return { crushing: /\bcrushing\b/i.test(text), bleed: /\bbleed(?:ing)?\b/i.test(text) };
}
export function usableArmorSlots(available, { crushing = false, composite = false } = {}) {
  const slots = Math.max(0, Number(available) || 0);
  return crushing && !composite ? Math.max(0, slots - 1) : slots;
}
// Targets that do not bleed, including most Synthetics, are immune to Bleeding.
export function canBleed(token) {
  return !/synthetic|sint[eé]tic/i.test([token?.species, token?.sourceCharacter?.document?.fields?.ancestry].join(' '));
}
export function penetrationFor(type, { reflective = false, warded = false } = {}) {
  if (type === 'energy' && reflective) return 0;
  if ((type === 'void' || type === 'neural') && warded) return 0;
  return PENETRATION[type] ?? 0;
}

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
  useArmorSlot = false, // the defender MAY mark an Armor Slot; it is never automatic
  damageType = 'physical',
  targetReflective = false,
  targetWarded = false,
  protection = '',
  currentArmorSlots = 2,
  mountRating = 1, // 1 for person, 2 for Tier 2/3 ship, 3 for Tier 4/5 ship
  // One die at a time. The dice panel passes the faces read from the 3D dice here.
  rollDie = sides => Math.floor(Math.random() * sides) + 1
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
      const val = rollDie(diceSides);
      rolls.push(val);
      baseDiceTotal += val;
    }
  } else {
    for (let i = 0; i < diceCount; i++) {
      const val = rollDie(diceSides);
      rolls.push(val);
      baseDiceTotal += val;
    }
  }

  const rawDamage = (baseDiceTotal + flatModifier) * mountRating;

  const effectiveDamage = protection === 'immune' ? 0 : protection === 'resistant' ? Math.floor(rawDamage / 2) : rawDamage;
  const fullyProtected = !!protection && effectiveDamage === 0;
  const penetration = isDirectDamage ? 0 : penetrationFor(damageType, { reflective: targetReflective, warded: targetWarded });
  const effectiveMajor = Math.max(1, targetMajorThreshold - penetration);
  const effectiveSevere = Math.max(effectiveMajor, targetSevereThreshold - penetration);
  // A Neural hit also frays the mind: 1 Stress on top of its HP.
  const stressMarked = damageType === 'neural' && !isDirectDamage && !fullyProtected ? 1 : 0;

  let baseSeverity = 'Minor';
  let rawHpDamage = 1;

  if (fullyProtected) {
    baseSeverity = protection === 'immune' ? 'Immune' : 'Resisted';
    rawHpDamage = 0;
  } else if (isDirectDamage) {
    baseSeverity = 'Direct HP';
    rawHpDamage = effectiveDamage;
  } else {
    if (effectiveDamage < effectiveMajor) {
      baseSeverity = 'Minor';
      rawHpDamage = 1;
    } else if (effectiveDamage < effectiveSevere) {
      baseSeverity = 'Major';
      rawHpDamage = 2;
    } else {
      baseSeverity = 'Severe';
      const excess = effectiveDamage - effectiveSevere;
      const extra = Math.floor(excess / 10);
      rawHpDamage = 3 + extra;
    }
  }

  // Armor Slot mitigation (lowers hit by one severity step)
  let finalHpDamage = rawHpDamage;
  let armorSlotSpent = false;
  let finalSeverity = baseSeverity;

  if (!fullyProtected && !isDirectDamage && useArmorSlot && currentArmorSlots > 0) {
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
    effectiveDamage,
    protection,
    fullyProtected,
    baseSeverity,
    finalSeverity,
    targetMajorThreshold,
    targetSevereThreshold,
    damageType,
    penetration,
    effectiveMajor,
    effectiveSevere,
    stressMarked,
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
