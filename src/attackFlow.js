// The complete attack procedure: declare (weapon, target, range), attack roll against
// Evasion, and damage only on a hit. Pure rules; the dice panel drives it.
import { TRAITS } from './rulesEngine.js';
import { EQUIPMENT_CATALOG } from './equipmentLibrary.js';

// Range bands of the table (user ruling, 15 Nov 2026): Melee up to 1 m or an adjacent square
// (diagonals included), Very Close up to 5 m, Close up to 10 m, Far up to 25 m, Extreme beyond.
export const RANGE_BANDS = ['Melee', 'Very Close', 'Close', 'Far', 'Extreme'];
export const DEFAULT_METERS_PER_SQUARE = 2;
export function rangeBandFor(squares, metersPerSquare = DEFAULT_METERS_PER_SQUARE) {
  // Whole metres, as the table reads them: 10.02 m is "10 m" on the label and is still Close.
  const meters = Math.round(squares * metersPerSquare);
  if (squares <= 1.5 || meters <= 1) return 'Melee';
  if (meters <= 5) return 'Very Close';
  if (meters <= 10) return 'Close';
  if (meters <= 25) return 'Far';
  return 'Extreme';
}
export function tokenDistanceSquares(a, b, gridSize) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)) / (gridSize || 64);
}

// Walls and closed doors stop a shot; windows and open doors do not.
function crosses(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
  const u = -((p1x - p3x) * (p2y - p1y) - (p1y - p3y) * (p2x - p1x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
export function lineBlockedByWall(a, b, walls = []) {
  return walls.some(wall => {
    const type = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
    if (type === 'window' || (type === 'door' && wall.isOpen)) return false;
    return crosses(a.x, a.y, b.x, b.y, wall.x1, wall.y1, wall.x2, wall.y2);
  });
}

// Everything the table needs to know about the gap between two tokens, in one place:
// the lock line, the ruler and the attack all read it from here.
export function distanceInfo(a, b, map = {}) {
  const squares = tokenDistanceSquares(a, b, map.gridSize), metersPerSquare = map.gridScaleMeters || DEFAULT_METERS_PER_SQUARE;
  return { squares, meters: squares * metersPerSquare, band: rangeBandFor(squares, metersPerSquare), blocked: lineBlockedByWall(a, b, map.walls || []) };
}

const bandFromText = value => {
  const text = String(value ?? '').toLowerCase();
  if (/very\s*far|extreme|extremo|muy\s*lej/.test(text)) return 'Extreme';
  if (/\bfar\b|lejos|largo/.test(text)) return 'Far';
  if (/very\s*close|muy\s*cerca/.test(text)) return 'Very Close';
  if (/\bclose\b|cerca|corto/.test(text)) return 'Close';
  if (/melee|cuerpo|contact/.test(text)) return 'Melee';
  return '';
};
const plainName = value => String(value ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9áéíóúüñ]+/g, ' ').trim();
// The band a weapon reaches: its own Range text or, when the sheet left it blank, the range
// of the catalog weapon with the same name. '' means it is not known.
export function weaponRangeBand(weapon) {
  const own = bandFromText(weapon?.range);
  if (own || !weapon?.name) return own;
  const name = plainName(weapon.name);
  const match = name && EQUIPMENT_CATALOG.find(item => item.category === 'weapons' && plainName(item.name) === name);
  return match ? bandFromText(match.range) : '';
}

// Table rule: a melee weapon only works at Melee; a ranged weapon fired beyond the band
// it covers attacks with Disadvantage.
export function rangeCheck(weapon, band) {
  // No weapon in hand is an unarmed strike: a Melee attack (Corebook ch. 10).
  if (!weapon) return band && band !== 'Melee'
    ? { allowed: false, disadvantage: false, reach: 'Melee', band, reason: `Sin arma el ataque es cuerpo a cuerpo: el objetivo está a ${band}, fuera de Melee.` }
    : { allowed: true, disadvantage: false, reach: 'Melee', band, reason: '' };
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

// Any other roll a Keeper makes for an adversary (decision 6 of HANDOVER_V2: the Corebook text
// that has the Keeper roll Duality dice is an erratum): 1d20 + modifier against a DC, the same
// dice as its attack. A natural 20 is a critical success. Shaped like a Duality result so the
// dice panel, the log and the chat can show it.
export function rollAdversaryCheck({ actorName = '', modifier = 0, traitMod = modifier, dc = 15, hasAdvantage = false, hasDisadvantage = false, forcedD20 = null, forcedD6 = null, random = Math.random } = {}) {
  const roll = rollAdversaryAttack({ attackModifier: modifier, evasion: dc, hasAdvantage, hasDisadvantage, forcedD20, forcedD6, random });
  const success = roll.hit;
  return {
    actorName, traitName: 'Attack', traitMod, keeperD20: true, d20: roll.d20, hopeVal: roll.d20, fearVal: null,
    advVal: roll.edge === 'Advantage' ? roll.d6 : 0, disadvVal: roll.edge === 'Disadvantage' ? roll.d6 : 0,
    totalMod: roll.total - roll.d20, total: roll.total, dc, isCritical: roll.isCritical, dominance: 'Keeper', fearGain: 0,
    resultType: roll.isCritical ? 'CRITICAL_SUCCESS' : success ? 'SUCCESS_WITH_HOPE' : 'FAILURE_WITH_FEAR',
    outcomeTitle: roll.isCritical ? 'ÉXITO CRÍTICO (20 natural)' : success ? 'ÉXITO' : 'FALLO',
    outcomeDesc: roll.isCritical ? 'Éxito automático. En un ataque, el daño normal se maximiza.' : success ? 'El adversario lo consigue: aplica el resultado establecido.' : 'El adversario no lo consigue.',
    pathPayout: 'Tirada del Keeper (1d20): sin pago de senda ni Fear.',
  };
}

// A player's Duality attack hits when it is critical or its total reaches the target's Evasion.
export function dualityAttackHit(result, evasion) {
  return !!result && (!!result.isCritical || result.total >= evasion);
}
