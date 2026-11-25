// «¿Qué puedo hacer?» (v2.56.0, Plan de UX V3, fase 6): what this character can do right now, what
// limits it and how to do it, in plain words. The conditions say what the table does with them.
import { visibleConditions, conditionDefinition } from './conditions.js';
import { lifeStage, movementBlock, fearSource } from './combatState.js';
import { tokenInventory } from './equipment.js';
import { weaponReadiness } from './weaponFeatures.js';
import { weaponRangeBand } from './attackFlow.js';
import { canPay } from './powerReactions.js';

// What each condition does at this table (the book's rule is in Condiciones).
export const CONDITION_EFFECTS = {
  Bleeding: 'Marcas 1 Stress al acabar cada ronda (se aplica a mano) hasta que te curen.',
  Blinded: 'Desventaja al atacar y en Instinct.',
  Confused: 'En tu Spotlight actúas contra la criatura más cercana.',
  Cornered: 'Desventaja en Agility y Finesse; no sales de Melee con quien te acorrala.',
  Dazed: 'Desventaja en tu próxima acción; después se quita sola.',
  Fleeing: 'En tu Spotlight te alejas de la fuente y no puedes atacarla.',
  Frightened: 'Desventaja en las tiradas contra la fuente del miedo y no puedes acercarte a ella.',
  Hidden: 'Ventaja en tu próximo ataque y no te pueden atacar a distancia. Se va al atacar o lanzar un Poder.',
  Incapacitated: 'No puedes actuar, reaccionar ni moverte; los ataques contra ti impactan siempre.',
  Infected: 'El efecto que lo causó dice el síntoma; dura hasta que te traten.',
  'On Fire': 'Al acabar la ronda recibes 1d4 Energy (Fire). Apágalo con tu Acción o la de un aliado.',
  Poisoned: 'Al acabar la ronda marcas 1 Stress, hasta que te traten.',
  Prone: 'Desventaja al atacar; a distancia te atacan con Ventaja. Al moverte te levantas.',
  Restrained: 'No puedes moverte; Desventaja en Agility y Strength. Strength DC 15 en tu Spotlight para soltarte.',
  Silenced: 'No puedes hablar ni lanzar Poderes que necesiten voz.',
  Stunned: 'No puedes actuar hasta después de la próxima ronda, o hasta que un aliado te despierte.',
  Vulnerable: 'Los ataques contra ti tienen Ventaja.',
  Weakened: 'Desventaja en Strength; tu daño pierde los modificadores fijos.',
};

// One line per active condition: its name in the table's words and what it does now.
export function conditionLines(token) {
  return visibleConditions(token).map(name => {
    const def = conditionDefinition(name);
    return { name, label: def?.label || name, effect: CONDITION_EFFECTS[name] || def?.rule || 'Marcador propio: consúltalo con el Keeper.' };
  });
}

// token: the character; tokens: the scene; cards: its hand (CardHand.cards), if known.
export function whatNow(token, { tokens = [], cards = null } = {}) {
  const can = [], limits = [], how = [];
  if (!token) return { can, limits, how: ['Elige o crea un personaje en la barra para empezar.'] };
  const stage = lifeStage(token);
  if (stage) {
    limits.push(`${token.name} está ${stage}: sigue el procedimiento de Condiciones (barra → «Ver estado del personaje»).`);
    return { can, limits, how };
  }
  const blocked = movementBlock(token), conditions = conditionLines(token);
  const acts = !conditions.some(c => ['Stunned', 'Incapacitated'].includes(c.name));
  if (acts) {
    can.push('Tirar un atributo: toca AGI, STR, FIN, KNO, INS o PRE y otra vez para tirar.');
    const weapons = tokenInventory(token).weapons.filter(w => w.equipped !== false);
    const ready = weapons.filter(w => weaponReadiness(w).ready), unready = weapons.filter(w => !weaponReadiness(w).ready);
    if (ready.length) can.push(`Atacar con ${ready.map(w => `${w.name} (${weaponRangeBand(w) || 'sin alcance'})`).join(', ')}: elige el arma y toca al objetivo.`);
    else if (!weapons.length) can.push('Atacar desarmado (Melee): toca «Desarmado» y luego al objetivo.');
    for (const w of unready) can.push(`${weaponReadiness(w).action || 'Preparar'} ${w.name}: gasta tu Acción con su botón en Atacar.`);
    if (Array.isArray(cards)) {
      const playable = cards.filter(c => c.playable && canPay(token, c.cost || {}));
      if (playable.length) can.push(`Usar ${playable.length === 1 ? 'una carta' : `${playable.length} cartas`} de tu mano: ${playable.slice(0, 5).map(c => c.name).join(', ')}${playable.length > 5 ? '…' : ''}.`);
    }
    if (!token.hasSpotlight) can.push('Tomar el foco (✨ o la tecla F) para actuar en esta ronda.');
  }
  if (!blocked) can.push('Moverte: arrastra tu ficha o usa las flechas.');
  else if (!conditions.some(c => ['Restrained', 'Stunned', 'Incapacitated'].includes(c.name))) limits.push(blocked);
  const fear = fearSource(token), source = fear && tokens.find(t => t.id === fear);
  if (source) limits.push(`No puedes acercarte a ${source.name} (Frightened).`);
  for (const c of conditions) limits.push(`${c.label} (${c.name}): ${c.effect}`);
  if ((token.hope || 0) < 1) limits.push('Sin Hope: no puedes usar Experiencias ni cartas que la cuesten.');
  if (token.stress?.max > 0 && (token.stress.current || 0) >= token.stress.max) limits.push('Stress lleno: estás Overwhelmed (Desventaja en tus tiradas hasta que alivies Stress).');
  how.push('Toca a un enemigo en el mapa: el anillo te ofrece tus armas y Poderes contra él.',
    'Teclado: T abre el anillo sobre el enemigo más cercano (otra vez, el siguiente; flechas y Enter dentro), 1–9 eligen arma, Enter ataca al objetivo marcado, F toma el foco, las flechas mueven, Esc cancela, ? abre esta ayuda.',
    'Cada resultado del registro tiene «Ver cálculo» con la cuenta completa.');
  return { can, limits, how };
}
