import confetti from 'canvas-confetti';
import type { DualityOutcome, DualityRollResult, CharacterPath } from '../types/vtt';
import { sounds } from './audio';

export interface RollDualityOptions {
  characterName: string;
  path: CharacterPath;
  traitName?: string;
  traitModifier?: number;
  experienceName?: string;
  experienceBonus?: number;
  advantageType?: 'advantage' | 'disadvantage' | 'none';
  dc?: number;
  label?: string;
  
  // Optional weapon damage evaluation
  weapon?: {
    name: string;
    damageDice: string; // e.g. "2d8+2" or "1d10"
    damageType: 'Physical' | 'Energy' | 'Void' | 'Neural';
    proficiency?: number; // 1 to 6
    targetMajorThreshold?: number;
    targetSevereThreshold?: number;
    hasReflectiveArmor?: boolean; // cancels Energy pen -2
    hasWard?: boolean; // cancels Void pen -4
  };
}

export function rollDuality(options: RollDualityOptions): DualityRollResult {
  sounds.playDiceRoll();

  const hopeDie = Math.floor(Math.random() * 12) + 1;
  const fearDie = Math.floor(Math.random() * 12) + 1;

  const traitModifier = options.traitModifier ?? 0;
  const experienceBonus = options.experienceBonus ?? 0;
  const dc = options.dc ?? 15; // default Challenging
  const adv = options.advantageType ?? 'none';

  let advantageModifier = 0;
  if (adv === 'advantage') {
    // Hope boon die: +1d6
    advantageModifier = Math.floor(Math.random() * 6) + 1;
  } else if (adv === 'disadvantage') {
    // Fear bane die: -1d6
    advantageModifier = -(Math.floor(Math.random() * 6) + 1);
  }

  const baseSum = hopeDie + fearDie;
  const total = baseSum + traitModifier + experienceBonus + advantageModifier;

  let outcome: DualityOutcome;

  // Matching dice is ALWAYS a Critical Success under Veilfarers 12.06 canon!
  if (hopeDie === fearDie) {
    outcome = 'critical_success';
    sounds.playCritSuccess();
    try {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.7 },
        colors: ['#a855f7', '#6366f1', '#38bdf8', '#f59e0b'],
      });
    } catch {}
  } else if (hopeDie > fearDie) {
    if (total >= dc) {
      outcome = 'success_hope';
      sounds.playTokenMove();
    } else {
      outcome = 'failure_hope';
      sounds.playTokenMove();
    }
  } else {
    // fearDie > hopeDie
    if (total >= dc) {
      outcome = 'success_fear';
      sounds.playCritFail(); // ominous tone
    } else {
      outcome = 'failure_fear';
      sounds.playCritFail();
    }
  }

  // Damage evaluation if weapon provided
  let damageDealt: DualityRollResult['damageDealt'] | undefined;
  if (options.weapon) {
    const isCrit = outcome === 'critical_success';
    damageDealt = calculateWeaponDamage(options.weapon, isCrit);
  }

  return {
    hopeDie,
    fearDie,
    traitName: options.traitName,
    traitModifier,
    experienceBonus: experienceBonus > 0 ? experienceBonus : undefined,
    experienceName: options.experienceName,
    advantageModifier: advantageModifier !== 0 ? advantageModifier : undefined,
    advantageType: adv,
    total,
    dc,
    outcome,
    label: options.label,
    characterName: options.characterName,
    path: options.path,
    damageDealt,
  };
}

// Calculate weapon damage according to Veilfarers 12.06 rules
export function calculateWeaponDamage(
  weapon: NonNullable<RollDualityOptions['weapon']>,
  isCritical: boolean
): NonNullable<DualityRollResult['damageDealt']> {
  const prof = Math.max(1, weapon.proficiency ?? 1);
  const regex = /^(\d*)d(\d+)([+-]\d+)?$/i;
  const match = weapon.damageDice.trim().replace(/\s+/g, '').match(regex);

  let rawTotal = 0;
  if (match) {
    const baseCount = match[1] ? parseInt(match[1], 10) : 1;
    const sides = parseInt(match[2], 10);
    const flatMod = match[3] ? parseInt(match[3], 10) : 0;

    // In Veilfarers 12.06:
    // Proficiency scales the first listed die: roll the Proficiency Die once per rank,
    // and every other listed die once.
    // E.g. 2d8 with prof 3 -> (3)d8 + (1)d8 = 4d8.
    const totalDiceCount = prof + (baseCount - 1);
    const finalDiceCount = isCritical ? totalDiceCount * 2 : totalDiceCount;

    for (let i = 0; i < finalDiceCount; i++) {
      rawTotal += Math.floor(Math.random() * sides) + 1;
    }
    rawTotal += flatMod;
  } else {
    // Fallback if formula is simple number or custom
    rawTotal = 8;
  }

  // Penetration by damage type:
  // Physical: 0
  // Energy: -2 (Reflective cancels)
  // Void: -4 (Ward cancels)
  // Neural: -4 (+1 Stress)
  let penetration = 0;
  if (weapon.damageType === 'Energy' && !weapon.hasReflectiveArmor) {
    penetration = -2;
  } else if ((weapon.damageType === 'Void' || weapon.damageType === 'Neural') && !weapon.hasWard) {
    penetration = -4;
  }

  // Target Thresholds
  const baseMajor = weapon.targetMajorThreshold ?? 7;
  const baseSevere = weapon.targetSevereThreshold ?? 14;

  // Penetration lowers the target's thresholds for that hit
  const effMajor = Math.max(1, baseMajor + penetration);
  const effSevere = Math.max(effMajor + 1, baseSevere + penetration);

  let severity: 'Minor' | 'Major' | 'Severe' | 'Overkill';
  let hpLoss = 1;

  if (rawTotal < effMajor) {
    severity = 'Minor';
    hpLoss = 1;
  } else if (rawTotal < effSevere) {
    severity = 'Major';
    hpLoss = 2;
  } else {
    severity = 'Severe';
    hpLoss = 3;
    // Overkill: +1 HP per full 10 points over Severe
    const excess = rawTotal - effSevere;
    if (excess >= 10) {
      severity = 'Overkill';
      hpLoss += Math.floor(excess / 10);
    }
  }

  const tags: string[] = [];
  if (weapon.damageType === 'Neural') {
    tags.push('+1 Stress');
  }

  return {
    rawTotal,
    damageType: weapon.damageType,
    severity,
    hpLoss,
    penetration,
    tags,
  };
}
