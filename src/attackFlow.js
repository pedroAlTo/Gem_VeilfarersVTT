// The complete attack procedure: declare (weapon, target, range), attack roll against
// Evasion, and damage only on a hit. Pure rules; the dice panel drives it.
import { TRAITS } from './rulesEngine.js';
import { EQUIPMENT_CATALOG } from './equipmentLibrary.js';
import { hasTag } from './weaponTags.js';

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

// Distance between two tokens is measured base to base (user ruling, 17 Nov 2026): the gap
// between the edges of their bases, so a large creature is in Melee when its base touches yours.
export function tokenGapSquares(a, b, gridSize) {
  const centre = tokenDistanceSquares(a, b, gridSize);
  return Math.max(0, centre - ((Number(a?.size) || 1) + (Number(b?.size) || 1)) / 2);
}
// Bands for a gap between bases: touching (also diagonally) is Melee; then by whole metres of gap.
export function gapBandFor(gapSquares, metersPerSquare = DEFAULT_METERS_PER_SQUARE) {
  const meters = Math.round(gapSquares * metersPerSquare);
  if (gapSquares <= 0.5 || meters <= 1) return 'Melee';
  if (meters <= 5) return 'Very Close';
  if (meters <= 10) return 'Close';
  if (meters <= 25) return 'Far';
  return 'Extreme';
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
  const squares = tokenGapSquares(a, b, map.gridSize), metersPerSquare = map.gridScaleMeters || DEFAULT_METERS_PER_SQUARE;
  return { squares, meters: squares * metersPerSquare, band: gapBandFor(squares, metersPerSquare), blocked: lineBlockedByWall(a, b, map.walls || []) };
}

const bandFromMeters = meters => (meters <= 1 ? 'Melee' : meters <= 5 ? 'Very Close' : meters <= 10 ? 'Close' : meters <= 25 ? 'Far' : 'Extreme');
const bandFromText = value => {
  const text = String(value ?? '').toLowerCase();
  if (/very\s*far|extreme|extremo|muy\s*lej/.test(text)) return 'Extreme';
  if (/\bfar\b|lejos|lejan|largo|larga/.test(text)) return 'Far';
  if (/very\s*close|muy\s*cerca/.test(text)) return 'Very Close';
  if (/\bclose\b|cerca|corto|media|medio/.test(text)) return 'Close';
  if (/melee|cuerpo|contact|adyacente|adjacent/.test(text)) return 'Melee';
  // "15 m", "10m", "5 metros"
  const meters = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m\b|metros?)/);
  if (meters) return bandFromMeters(Number(meters[1].replace(',', '.')));
  return '';
};
const plainName = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// A catalog weapon answers to its whole name, to the part in brackets and to each side of
// "English / Español": "Slug Pistol" finds "Pistola Cinética Militar (Slug Pistol)".
const nameAliases = value => {
  const raw = String(value ?? '');
  const parts = [raw, raw.replace(/\(.*?\)/g, ''), ...(raw.match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1)), ...raw.replace(/\(.*?\)/g, '').split('/')];
  return [...new Set(parts.map(plainName).filter(Boolean))];
};
// The band a weapon reaches: its own Range text (or the Trait text, when the range was written
// there); when the sheet left it blank, the range of
// the catalog weapon with the same name. '' means it is not known (the sheet should say it:
// the attack then warns that no distance limit applies).
export function weaponRangeBand(weapon) {
  // Some imported sheets write the range with the Trait ("Agility · Melee").
  const own = bandFromText(weapon?.range) || bandFromText(weapon?.trait);
  if (own || !weapon?.name) return own;
  const names = nameAliases(weapon.name);
  const match = names.length && EQUIPMENT_CATALOG.find(item => item.category === 'weapons' && nameAliases(item.name).some(alias => names.includes(alias)));
  return (match && bandFromText(match.range)) || '';
}

// A short firearm is one whose maximum range is Close or less (user ruling, 17 Nov 2026): it
// fires at Close and point-blank in Melee without penalty. A weapon can also say so with
// `short: true` (or not, with `short: false`).
export function isShortWeapon(weapon, reach = weaponRangeBand(weapon)) {
  if (!weapon) return false;
  if (typeof weapon.short === 'boolean') return weapon.short;
  return reach === 'Very Close' || reach === 'Close';
}

// Table rule: a melee weapon only works at Melee (Reach: also Very Close); a ranged weapon fired
// beyond the band it covers attacks with Disadvantage; a long ranged weapon (maximum range Far or
// more) fired at a target in Melee attacks with Disadvantage. A firearm with a maximum range of
// Close has no Disadvantage at Close or in Melee.
export function rangeCheck(weapon, band) {
  // No weapon in hand is an unarmed strike: a Melee attack (Corebook ch. 10).
  if (!weapon) return band && band !== 'Melee'
    ? { allowed: false, disadvantage: false, reach: 'Melee', band, reason: `Sin arma el ataque es cuerpo a cuerpo: el objetivo está a ${band}, fuera de Melee.` }
    : { allowed: true, disadvantage: false, reach: 'Melee', band, reason: '' };
  const reach = weaponRangeBand(weapon);
  if (!reach || !band) return { allowed: true, disadvantage: false, reach, band, reason: '' };
  if (reach === 'Melee') {
    return band === 'Melee' || (band === 'Very Close' && hasReach(weapon))
      ? { allowed: true, disadvantage: false, reach, band, reason: '' }
      : { allowed: false, disadvantage: false, reach, band, reason: `Arma cuerpo a cuerpo: el objetivo está a ${band}, fuera de Melee.` };
  }
  const beyond = RANGE_BANDS.indexOf(band) > RANGE_BANDS.indexOf(reach);
  if (beyond) return { allowed: true, disadvantage: true, reach, band, reason: `Objetivo a ${band}, más allá del alcance del arma (${reach}): Desventaja.` };
  if (band === 'Melee' && !isShortWeapon(weapon, reach)) return { allowed: true, disadvantage: true, reach, band, reason: `Arma de alcance ${reach} contra un objetivo en Melee: Desventaja (las armas de alcance máximo Close no la tienen).` };
  return { allowed: true, disadvantage: false, reach, band, reason: '' };
}

// Weapon properties that change the attack roll (Corebook ch. 13), read from the weapon's tags:
// Reliable +1 always; Accurate +1 and Smart Scope +2 at Far or Very Far.
export function weaponAttackBonus(weapon, band = '') {
  const far = band === 'Far' || band === 'Extreme', parts = [];
  if (weapon && hasTag(weapon, 'reliable')) parts.push(['Reliable', 1]);
  if (weapon && far && hasTag(weapon, 'accurate')) parts.push(['Accurate', 1]);
  if (weapon && far && hasTag(weapon, 'smart-scope')) parts.push(['Smart Scope', 2]);
  return { bonus: parts.reduce((sum, [, n]) => sum + n, 0), notes: parts.map(([name, n]) => `${name} +${n}`) };
}
// Reach (Corebook): a Melee weapon may attack at Very Close.
const hasReach = weapon => !!weapon && hasTag(weapon, 'reach');

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
