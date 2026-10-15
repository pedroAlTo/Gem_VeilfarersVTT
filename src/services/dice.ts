import confetti from 'canvas-confetti';
import type { DiceRollResult, DieRoll } from '../types/vtt';
import { sounds } from './audio';

export function rollDice(
  formula: string,
  options?: {
    label?: string;
    advantage?: 'normal' | 'advantage' | 'disadvantage';
    veilStrain?: number;
    archetype?: string;
  }
): DiceRollResult {
  sounds.playDiceRoll();

  const trimmed = formula.trim().toLowerCase();
  const adv = options?.advantage || 'normal';

  // Handle standard d20 with advantage/disadvantage
  if ((trimmed === 'd20' || trimmed === '1d20') && adv !== 'normal') {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    let chosen: number;
    let droppedIdx: number;

    if (adv === 'advantage') {
      if (roll1 >= roll2) {
        chosen = roll1;
        droppedIdx = 1;
      } else {
        chosen = roll2;
        droppedIdx = 0;
      }
    } else {
      if (roll1 <= roll2) {
        chosen = roll1;
        droppedIdx = 1;
      } else {
        chosen = roll2;
        droppedIdx = 0;
      }
    }

    const dice: DieRoll[] = [
      { sides: 20, value: roll1, dropped: droppedIdx === 0 },
      { sides: 20, value: roll2, dropped: droppedIdx === 1 },
    ];

    const isCritSuccess = chosen === 20;
    const isCritFail = chosen === 1;

    if (isCritSuccess) {
      sounds.playCritSuccess();
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.7 },
          colors: ['#a855f7', '#6366f1', '#ec4899', '#38bdf8']
        });
      } catch {
        // ignore in non-browser
      }
    } else if (isCritFail) {
      sounds.playCritFail();
    }

    return {
      formula: `${formula} (${adv})`,
      total: chosen,
      dice,
      modifier: 0,
      isCritSuccess,
      isCritFail,
      label: options?.label,
      veilStrain: options?.veilStrain,
      archetype: options?.archetype,
    };
  }

  // General dice regex: e.g. 2d6+4, 1d20-2, 3d8, 4d6kh3
  const regex = /^(\d*)d(\d+)(?:kh(\d+))?([+-]\d+)?$/;
  const match = trimmed.replace(/\s+/g, '').match(regex);

  if (match) {
    const count = match[1] ? parseInt(match[1], 10) : 1;
    const sides = parseInt(match[2], 10);
    const keepHighest = match[3] ? parseInt(match[3], 10) : undefined;
    const modifier = match[4] ? parseInt(match[4], 10) : 0;

    const rawRolls: Array<{ value: number; index: number }> = [];
    for (let i = 0; i < count; i++) {
      rawRolls.push({
        value: Math.floor(Math.random() * sides) + 1,
        index: i,
      });
    }

    // Determine kept / dropped
    let droppedIndices = new Set<number>();
    if (keepHighest && keepHighest < count) {
      const sorted = [...rawRolls].sort((a, b) => b.value - a.value);
      const kept = sorted.slice(0, keepHighest).map((r) => r.index);
      droppedIndices = new Set(
        rawRolls.map((r) => r.index).filter((idx) => !kept.includes(idx))
      );
    }

    const dice: DieRoll[] = rawRolls.map((r) => ({
      sides,
      value: r.value,
      dropped: droppedIndices.has(r.index),
    }));

    const sumKept = dice
      .filter((d) => !d.dropped)
      .reduce((acc, d) => acc + d.value, 0);

    const total = sumKept + modifier;

    const isCritSuccess = sides === 20 && count === 1 && rawRolls[0].value === 20;
    const isCritFail = sides === 20 && count === 1 && rawRolls[0].value === 1;

    if (isCritSuccess) {
      sounds.playCritSuccess();
      try {
        confetti({
          particleCount: 60,
          spread: 80,
          origin: { y: 0.7 },
          colors: ['#a855f7', '#6366f1', '#ec4899', '#38bdf8']
        });
      } catch {
        // ignore
      }
    } else if (isCritFail) {
      sounds.playCritFail();
    }

    return {
      formula,
      total,
      dice,
      modifier,
      isCritSuccess,
      isCritFail,
      label: options?.label,
      veilStrain: options?.veilStrain,
      archetype: options?.archetype,
    };
  }

  // Fallback: simple evaluation if custom math expression
  try {
    const dice: DieRoll[] = [];
    let mod = 0;
    // Extract any NdM occurrences
    const diceParts = formula.match(/(\d*)d(\d+)/g) || [];
    let sum = 0;
    diceParts.forEach((part) => {
      const pMatch = part.match(/(\d*)d(\d+)/);
      if (pMatch) {
        const c = pMatch[1] ? parseInt(pMatch[1], 10) : 1;
        const s = parseInt(pMatch[2], 10);
        for (let i = 0; i < c; i++) {
          const val = Math.floor(Math.random() * s) + 1;
          dice.push({ sides: s, value: val });
          sum += val;
        }
      }
    });

    // Check for + or - modifier at end
    const modMatch = formula.match(/([+-]\s*\d+)$/);
    if (modMatch) {
      mod = parseInt(modMatch[1].replace(/\s+/g, ''), 10);
    }

    const total = (dice.length > 0 ? sum : 0) + mod;

    return {
      formula,
      total,
      dice,
      modifier: mod,
      label: options?.label,
      veilStrain: options?.veilStrain,
      archetype: options?.archetype,
    };
  } catch {
    return {
      formula,
      total: 0,
      dice: [],
      modifier: 0,
      label: 'Invalid formula',
    };
  }
}
