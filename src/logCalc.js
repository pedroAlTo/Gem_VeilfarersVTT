// The full calculation behind a log entry (v2.51.0, user request): «en el log, cuando se produce un
// efecto, daño o cualquier efecto automático, permite expandir para ver el cálculo completo». Each
// automatic roll, damage and effect keeps its steps as plain lines (`entry.calc`); the log shows
// them under «Ver cálculo».
const sign = n => (n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`);
const TRAITS = { agility: 'Agility', strength: 'Strength', finesse: 'Finesse', instinct: 'Instinct', presence: 'Presence', knowledge: 'Knowledge' };
const traitName = t => TRAITS[String(t || '').toLowerCase()] || t || 'Trait';

// A Duality roll (or the Keeper's d20) step by step.
export function rollCalc(result, extra = []) {
  if (!result) return [];
  const lines = [];
  if (result.keeperD20) {
    lines.push(`d20: ${result.d20}`);
    const flat = (result.totalMod || 0) - (result.advVal || 0) + (result.disadvVal || 0);
    if (flat) lines.push(`Modificador del adversario: ${sign(flat)}`);
  } else {
    lines.push(`Hope d12: ${result.hopeVal} · Fear d12: ${result.fearVal}`);
    if (result.traitMod) lines.push(`${traitName(result.traitName)}: ${sign(result.traitMod)}`);
    if (result.subtraitMod) lines.push(`${result.subtraitName || 'Subtrait'}: ${sign(result.subtraitMod)}`);
    if (result.experienceMod) lines.push(`Experience${result.experienceLabel ? ` (${result.experienceLabel})` : ''}: ${sign(result.experienceMod)}`);
    if (result.customMod) lines.push(`Otros modificadores (propiedades, efectos, Poderes): ${sign(result.customMod)}`);
    if (result.resolveVal) lines.push(`Resolve ${result.resolveDieType || 'd4'}: + ${result.resolveVal}`);
  }
  if (result.advVal) lines.push(`Ventaja d6: + ${result.advVal}`);
  if (result.disadvVal) lines.push(`Desventaja d6: − ${result.disadvVal}`);
  const target = result.concealDC ? '' : ` contra ${result.attack ? 'Evasion' : 'DC'} ${result.dc}`;
  lines.push(`Total ${result.total}${target} → ${result.outcomeTitle || ''}`.trim());
  if (!result.keeperD20 && result.hopeVal === result.fearVal) lines.push('Dados iguales: éxito crítico.');
  for (const line of extra) if (line) lines.push(String(line));
  if (result.pathPayout) lines.push(result.pathPayout);
  return lines;
}

// A hit's damage, from the dice to the HP lost, for the shields actually spent.
export function damageCalc({ result, sides = [], proficiency = 1, honed = 0, riders = [], extras = [], devastating = 0, spent = 0, armorLeft = null, brace = false, hpLost = 0, hpBefore = null, hpAfter = null, hpMax = null, stress = 0, conditions = [], cut = null, type = '', noArmor = false, direct = false }) {
  if (!result) return [];
  const lines = [];
  const rolls = result.rolls || [];
  if (rolls.length) lines.push(`Dados: ${rolls.map((r, i) => `d${sides[i] || '?'} [${r}]`).join(' + ')} = ${result.baseDiceTotal ?? rolls.reduce((a, b) => a + b, 0)}${proficiency > 1 ? ` (Proficiency ${proficiency})` : ''}${result.isCritical ? ' · crítico: dados dobles' : ''}`);
  if (result.flatModifier) lines.push(`Modificador fijo: ${sign(result.flatModifier)}${honed ? ` (Honed Edge ${honed} incluido)` : ''}`);
  for (const r of riders) lines.push(`${r.label}: + ${r.value}${r.faces?.length ? ` (${r.dice} [${r.faces.join(', ')}])` : ''}`);
  for (const note of extras) lines.push(note);
  if ((result.mountRating || 1) !== 1) lines.push(`Mount Rating ×${result.mountRating}`);
  lines.push(`Daño bruto: ${result.rawDamage}${type ? ` ${type}` : ''}`);
  if (result.protection && result.effectiveDamage !== result.rawDamage) lines.push(`Tras resistencias y protecciones: ${result.effectiveDamage}`);
  if (direct || result.isDirectDamage) lines.push('Daño directo: sin umbrales.');
  else if (result.effectiveMajor != null) lines.push(`Umbrales: Major ${result.targetMajorThreshold} / Severe ${result.targetSevereThreshold}${result.penetration ? ` − ${result.penetration} (penetración ${result.damageType}) = ${result.effectiveMajor} / ${result.effectiveSevere}` : ''}`);
  if (result.baseSeverity) lines.push(`Gravedad: ${result.baseSeverity}${result.finalSeverity && result.finalSeverity !== result.baseSeverity ? ` → ${result.finalSeverity}` : ''}`);
  if (devastating) lines.push('Devastating: +1 HP al alcanzar Severe.');
  if (noArmor) lines.push('Ignora la armadura: no se pueden gastar Armor Slots.');
  else if (spent) lines.push(`Escudos gastados: ${spent}${armorLeft != null ? ` (quedan ${armorLeft})` : ''}`);
  if (brace) lines.push('Brace: −1 HP.');
  lines.push(`HP perdidos: ${hpLost}${hpBefore != null && hpAfter != null ? ` (${hpBefore} → ${hpAfter}${hpMax != null ? ` / ${hpMax}` : ''})` : ''}`);
  if (stress) lines.push(`Stress marcado: + ${stress}`);
  if (conditions.length) lines.push(`Condiciones: ${conditions.join(', ')}`);
  if (cut) lines.push(`Armor Slots máximos: − ${cut.long + cut.repairAll + cut.downtime}`);
  return lines;
}

// What the table accepts from a client (a log line is plain text).
export const validCalc = calc => Array.isArray(calc) && calc.length <= 40 && calc.every(line => typeof line === 'string' && line.length <= 400);
