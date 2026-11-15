// The complete attack procedure: declare (weapon, target, range), attack roll against
// Evasion, and damage only on a hit. Pure rules; the dice panel drives it.
import { TRAITS } from './rulesEngine.js';

// Corebook ch. 10, Range Bands. Melee is arm's reach: an adjacent square, diagonals included.
export const RANGE_BANDS = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];
export function rangeBandFor(squares, metersPerSquare = 2) {
  if (squares <= 1.5) return 'Melee';
  const meters = squares * metersPerSquare;
  if (meters <= 5) return 'Very Close';
  if (meters <= 20) return 'Close';
  if (meters <= 100) return 'Far';
  return 'Very Far';
}
export function tokenDistanceSquares(a, b, gridSize) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)) / (gridSize || 64);
}

// The band a weapon reaches, read from its Range text. Unknown text means no limit is known.
export function weaponRangeBand(weapon) {
  const text = String(weapon?.range ?? '').toLowerCase();
  if (/very\s*far|muy\s*lej/.test(text)) return 'Very Far';
  if (/\bfar\b|lejos|largo/.test(text)) return 'Far';
  if (/very\s*close|muy\s*cerca/.test(text)) return 'Very Close';
  if (/\bclose\b|cerca|corto/.test(text)) return 'Close';
  if (/melee|cuerpo|contact/.test(text)) return 'Melee';
  return '';
}

// Table rule: a melee weapon only works at Melee; a ranged weapon fired beyond the band
// it covers attacks with Disadvantage.
export function rangeCheck(weapon, band) {
  const reach = weaponRangeBand(weapon);
  if (!reach || !band) return { allowed: true, disadvantage: false, reach, band, reason: '' };
  if (reach === 'Melee') {
    return band === 'Melee'
      ? { allowed: true, disadvantage: false, reach, band, reason: '' }
      : { allowed: false, disadvantage: false, reach, band, reason: `Arma cuerpo a cuerpo: el objetivo está a ${band}, fuera de Melee.` };
  }
  const beyond = RANGE_BANDS.indexOf(band) > RANGE_BANDS.indexOf(reach);
  return { allowed: true, disadvantage: beyond, reach, band, reason: beyond ? `Objetivo a ${band}, más allá del alcance del arma (${reach}): Desventaja.` : '' };
}

// The Trait a weapon attacks with, as a Trait id; '' when its text names none.
export function weaponTraitId(weapon) {
  const text = String(weapon?.trait ?? '').toLowerCase();
  return TRAITS.find(t => text.includes(t.id) || text.includes(t.name.toLowerCase()))?.id || '';
}

// Advantage and Disadvantage cancel one for one.
export function netEdge(advantage, disadvantage) {
  return { advantage: !!advantage && !disadvantage, disadvantage: !!disadvantage && !advantage };
}

// Keeper-controlled attack (table rule): 1d20 + Attack modifier against Evasion, with a d6
// added for Advantage or subtracted for Disadvantage. A natural 20 always hits and is critical.
export function rollAdversaryAttack({ attackModifier = 0, evasion = 10, hasAdvantage = false, hasDisadvantage = false, forcedD20 = null, forcedD6 = null, random = Math.random } = {}) {
  const die = sides => Math.floor(random() * sides) + 1;
  const edge = netEdge(hasAdvantage, hasDisadvantage);
  const d20 = Number.isInteger(forcedD20) && forcedD20 >= 1 && forcedD20 <= 20 ? forcedD20 : die(20);
  const d6 = edge.advantage || edge.disadvantage ? (Number.isInteger(forcedD6) && forcedD6 >= 1 && forcedD6 <= 6 ? forcedD6 : die(6)) : 0;
  const edgeMod = edge.advantage ? d6 : -d6;
  const total = d20 + attackModifier + edgeMod;
  const isCritical = d20 === 20;
  return { d20, d6, edge: edge.advantage ? 'Advantage' : edge.disadvantage ? 'Disadvantage' : '', attackModifier, total, evasion, isCritical, hit: isCritical || total >= evasion };
}

// A player's Duality attack hits when it is critical or its total reaches the target's Evasion.
export function dualityAttackHit(result, evasion) {
  return !!result && (!!result.isCritical || result.total >= evasion);
}
