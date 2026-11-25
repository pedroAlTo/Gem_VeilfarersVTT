// Power procedures (Plan de UX V3, fase 3): what each Power does at the table, written once from
// its printed text (Corebook 12.06) and reviewed by hand, so the table applies it without asking:
// who it reaches, the damage it deals, the Reaction Roll its targets make and what a failure
// brings, healing, conditions with their duration, and what a failed cast costs. Pure data and
// small helpers; cardResolution.js and gameActions.js read it.
//
//   target   one creature chosen like an attack: { who, reach, self }
//   zone     several: { shape: 'around' (the caster) | 'point' (around a chosen token) | 'cone' |
//            'line' (from the caster towards a chosen token), reach (to the point, or the cone's
//            length), size (the zone around a point), who: 'enemies' | 'allies' | 'creatures',
//            max (at most N, the most wounded first for healing), self }
//   success, hope, failure   steps, in order; `hope` adds to `success` on a Success with Hope
//            (or a Critical); `failure` on a failed Spellcast.
//   steps    { do: 'damage', to, dice, type, tag, noArmor }   rolled once for everyone it reaches
//            { do: 'save', to, trait, dc, fail: { conditions, clock, stress }, failText }
//            { do: 'heal', to, dice, hp, stress }             HP (dice, a number, 'severe' = the
//                                                             target's Severe Threshold, 'all') and Stress
//            { do: 'revive', to }                             back from 0 HP to 1 (its Dying states end)
//            { do: 'condition', to, conditions }              plain conditions
//            { do: 'clock', to, clock }                       an effect clock (condition, edge…)
//            { do: 'mark', to, stress, hp }                   Stress or direct HP marked
//            { do: 'note', text }
//   to       'targets' (default) | 'enemies' | 'allies' | 'self' | 'ownSide' (the caster and its
//            allies within the zone's reach: a failed cast turned against them)
//   dice     'P*d10' (Proficiency × d10), 'P2*d8' (Proficiency × 2 × d8), '3d8', '1d4'
//   modes    { Name: { …the same fields… } }, the first is the default (Básico)
const STUN_NEXT = name => ({ name: name + ' · Stunned', condition: 'Stunned', expiry: 'spotlight-end' });

export const PROCEDURES = {
  // ── Level 4 ──
  'Precision Strike': { target: { who: 'creature', reach: 'Far', self: false },
    success: [{ do: 'damage', dice: 'P*d10', type: 'physical', tag: 'Kinetic' }],
    hope: [{ do: 'clock', clock: { name: 'Precision Strike · sin Reacciones', expiry: 'spotlight-end' } }] },
  'Solar Judgment': { zone: { shape: 'point', reach: 'Close', size: 'Very Close', who: 'enemies' },
    success: [{ do: 'damage', dice: 'P*d6', type: 'energy', tag: 'Radiant' },
      { do: 'note', text: 'Una criatura Veil-Touched o Void tira Instinct DC 15: si falla, Dazed y sin Poderes Void hasta el final de su próximo Spotlight.' }] },
  'Bio-Integration': { target: { who: 'party', reach: 'Melee', self: true },
    failure: [{ do: 'mark', hp: 1, stress: 1 }] },
  // Neural Feedback: a Reaction when an adversary within Close deals HP damage to you (offered then).
  'Neural Feedback': { target: { who: 'creature', reach: 'Close', self: false },
    success: [{ do: 'damage', dice: 'P*d8', type: 'void' },
      { do: 'save', trait: 'instinct', dc: 15, fail: { clock: { name: 'Neural Feedback · Vulnerable', condition: 'Vulnerable', expiry: 'spotlight-end' } }, failText: 'Vulnerable hasta el final de su próximo Spotlight' }] },
  // ── Level 5 ──
  'Mind Spike': { target: { who: 'creature', reach: 'Far', self: false },
    success: [{ do: 'damage', dice: 'P*d12', type: 'void', noArmor: true },
      { do: 'save', trait: 'presence', dc: 15, fail: { clock: STUN_NEXT('Mind Spike') }, failText: 'Stunned hasta el final de su próximo Spotlight' }] },
  'Shockwave Pulse': { modes: {
    Offensive: { zone: { shape: 'around', reach: 'Close', who: 'creatures' },
      success: [{ do: 'damage', to: 'enemies', dice: 'P*d12', type: 'physical', tag: 'Kinetic' }, { do: 'condition', to: 'enemies', conditions: ['Prone'] }],
      hope: [{ do: 'clock', to: 'allies', clock: { name: 'Shockwave Pulse', expiry: 'round' } }, { do: 'heal', to: 'allies', dice: '1d4' }] },
    Protective: { zone: { shape: 'around', reach: 'Close', who: 'creatures' },
      success: [{ do: 'clock', to: 'allies', clock: { name: 'Shockwave Pulse', expiry: 'round' } }, { do: 'heal', to: 'allies', dice: '1d4' }],
      hope: [{ do: 'damage', to: 'enemies', dice: 'P*d12', type: 'physical', tag: 'Kinetic' }, { do: 'condition', to: 'enemies', conditions: ['Prone'] }] },
  } },
  'Cellular Reconstruction': { modes: {
    Focused: { target: { who: 'creature', reach: 'Melee', self: true },
      success: [{ do: 'heal', dice: 'P*d10', stress: 1 }], hope: [{ do: 'heal', dice: 'P*d4' }] },
    Distributed: { cost: { hope: 2 }, zone: { shape: 'around', reach: 'Close', who: 'allies', max: 3, self: true },
      success: [{ do: 'heal', dice: 'P*d6' }], hope: [{ do: 'heal', stress: 1 }] },
  } },
  // ── Level 6 ──
  'Psychic Storm': { zone: { shape: 'around', reach: 'Close', who: 'enemies' },
    success: [{ do: 'damage', dice: 'P*d10', type: 'void' },
      { do: 'save', trait: 'presence', dc: 15, fail: { stress: 1 }, failText: 'marca 1 Stress' }] },
  'Photonic Detonation': { zone: { shape: 'cone', reach: 'Close', who: 'creatures' },
    success: [{ do: 'damage', dice: 'P*d10', type: 'energy', tag: 'Radiant' },
      { do: 'save', trait: 'agility', dc: 15, fail: { clock: { name: 'Photonic Detonation · Blinded', condition: 'Blinded', expiry: 'round' } }, failText: 'Blinded hasta el cambio de ronda' }] },
  // Energy Cascade: each round, every affected target rolls Agility DC 15 or takes the damage (+1 each round).
  'Energy Cascade': { zone: { shape: 'around', reach: 'Far', who: 'enemies' },
    success: [{ do: 'clock', to: 'enemies', clock: { name: 'Energy Cascade', cascade: true, dc: 15, segments: 10 } },
      { do: 'note', text: 'Al empezar cada ronda, cada objetivo tira Agility DC 15: si falla, recibe (Proficiency)d8 Physical (Kinetic), +1 por ronda, y se aleja una banda.' }],
    failure: [{ do: 'clock', to: 'ownSide', clock: { name: 'Energy Cascade', cascade: true, dc: 15, segments: 10 } }, { do: 'note', text: 'Fallo: la cascada os afecta a ti y a tus aliados.' }] },
  // ── Level 7 ──
  'Orbital Lance': { zone: { shape: 'point', reach: 'Extreme', size: 'Very Close', who: 'creatures' },
    success: [{ do: 'damage', dice: '4d10', type: 'physical', tag: 'Kinetic' }],
    failure: [{ do: 'note', text: 'Fallo: tira d8 (dirección) y 1d4 (bandas de alcance); el impacto cae allí. La nave pierde 1 Hull.' }] },
  'Corona Beam': { zone: { shape: 'line', reach: 'Far', who: 'creatures' },
    success: [{ do: 'damage', dice: 'P2*d8', type: 'energy', tag: 'Radiant' },
      { do: 'note', text: 'Contra un objetivo de Tier menor, +10 al total antes de comparar con sus umbrales.' }] },
  'Temporal Freeze': { failure: [{ do: 'clock', to: 'self', clock: { name: 'Temporal Freeze · Stunned', condition: 'Stunned', expiry: 'round' } }, { do: 'mark', to: 'self', stress: 2 }] },
  'Phase Jump': { failure: [{ do: 'clock', to: 'self', clock: STUN_NEXT('Phase Jump') }, { do: 'mark', to: 'self', stress: 2 }] },
  'Rallying Cry': { zone: { shape: 'around', reach: 'Close', who: 'allies' },
    success: [{ do: 'clock', to: 'allies', clock: { name: 'Rallying Cry', expiry: 'round' } }, { do: 'clock', to: 'allies', clock: { name: 'Rallying Cry · sin miedo' } },
      { do: 'note', text: 'Cada aliado gana HP temporales iguales a tu Presence: anótalos en su ficha.' }],
    hope: [{ do: 'heal', to: 'allies', stress: 1 }] },
  'Lightbridge': { zone: { shape: 'around', reach: 'Far', who: 'allies', max: 3, self: true, most: 'stress' },
    success: [{ do: 'heal', to: 'allies', stress: 1 }, { do: 'note', text: 'Teletransporta hasta 3 criaturas dispuestas a un punto visible a Far: muévelas en el mapa.' }] },
  'Beacon of Resurrection': { target: { who: 'party', reach: 'Far', self: false },
    success: [{ do: 'revive' }, { do: 'clock', clock: { name: 'Beacon of Resurrection · Desventaja', edge: 'disadvantage', allRolls: true, expiry: 'spotlight-end' } },
      { do: 'note', text: 'No puedes usar Poderes Lux hasta tu próximo Long Rest.' }] },
  'Temporal Maelstrom': { zone: { shape: 'around', reach: 'Close', who: 'creatures', self: true },
    success: [{ do: 'clock', to: 'targets', clock: { name: 'Temporal Maelstrom · Desventaja', edge: 'disadvantage', allRolls: true } }],
    failure: [{ do: 'note', text: 'Fallo: sufres los efectos de la Veil Storm hasta limpiar 2 Stress.' }] },
  'Inviolable Sanctum': { success: [{ do: 'clock', to: 'self', clock: { name: 'Inviolable Sanctum', sanctum: true } },
    { do: 'note', text: 'Cúpula a Close: nada la cruza sin tu permiso. Los aliados dentro limpian 1 Stress al final de cada ronda mientras dure (hasta 1 minuto o hasta romper la concentración).' }] },
  'Hivemind Convergence': { zone: { shape: 'around', reach: 'Far', who: 'allies', max: 6, self: true },
    success: [{ do: 'note', text: 'Mentes unidas la escena: Ventaja al ayudar a otro y una reserva común de 1d6 HP temporales.' }],
    failure: [{ do: 'mark', to: 'allies', stress: 1 }, { do: 'clock', to: 'allies', clock: { name: 'Hivemind Convergence · Dazed', condition: 'Dazed', edge: 'disadvantage', nextAction: true } }] },
  // ── Level 8 ──
  'Solar Avatar': { success: [{ do: 'clock', to: 'self', clock: { name: 'Solar Avatar', expiry: 'round', rounds: 3, endStress: 2 } },
    { do: 'note', text: 'Tres rondas: vuelas, eres inmune al daño Physical, tus ataques Lux marcan 1 HP más (hasta 4) y das luz brillante a Far. Al terminar, marcas 2 Stress (la mesa lo hace).' }] },
  'Omniscient Eye': { success: [{ do: 'clock', to: 'self', clock: { name: 'Omniscient Eye · Vulnerable', condition: 'Vulnerable' } }] },
  'Psychic Collapse': { target: { who: 'creature', reach: 'Extreme', self: false },
    success: [{ do: 'damage', dice: '3d8', type: 'void', noArmor: true },
      { do: 'clock', clock: { name: 'Psychic Collapse · Desventaja', edge: 'disadvantage', allRolls: true, expiry: 'round' } }],
    failure: [{ do: 'damage', to: 'self', dice: '1d8', type: 'void' }] },
  // ── Level 9 ──
  'Psychic Fallout': { zone: { shape: 'around', reach: 'Far', who: 'enemies' },
    success: [{ do: 'damage', dice: '3d6', type: 'void' },
      { do: 'save', trait: 'instinct', dc: 15, fail: { clock: { name: 'Psychic Fallout · Stunned', condition: 'Stunned', expiry: 'round' }, conditions: ['Vulnerable'] }, failText: 'Stunned una ronda y Vulnerable la escena' }],
    failure: [{ do: 'clock', to: 'self', clock: { name: 'Psychic Fallout · Desventaja', edge: 'disadvantage', allRolls: true, expiry: 'round', rounds: '1d4' } }] },
  'Stellar Chorus': { success: [{ do: 'note', text: 'Toda la escena, los aliados a Far suman tu Presence a sus ataques, Reaction Rolls y umbrales de daño (no se acumula con Aura of Clarity). Al terminar, caes inconsciente 1 hora.' }] },
  'Indomitable Bastion': { failure: [{ do: 'note', text: 'Fallo: la barrera se derrumba y hace 3d12 Physical (Kinetic) a quienes estaban dentro.' }] },
  // ── Level 10 ──
  'Apotheosis': { zone: { shape: 'around', reach: 'Far', who: 'creatures', self: false },
    success: [{ do: 'heal', to: 'allies', hp: 'severe', stress: 1 }, { do: 'damage', to: 'enemies', dice: '6d10', type: 'energy', tag: 'Radiant', direct: true, noArmor: true },
      { do: 'note', text: 'Los enemigos Veil-Touched reciben el doble. Hasta el final de la escena no bajas de 1 HP y tus golpes desarmados suman 1d6 Energy (Radiant).' }],
    failure: [{ do: 'damage', to: 'self', dice: '4d10', type: 'energy' }] },
  'Universal Life Force': { modes: {
    Restore: { target: { who: 'creature', reach: 'Extreme', self: true }, success: [{ do: 'heal', hp: 'all' }], failure: [{ do: 'damage', to: 'self', dice: '4d12', type: 'void' }] },
    Unmake: { target: { who: 'creature', reach: 'Extreme', self: false }, success: [{ do: 'damage', dice: '4d12', type: 'void', noArmor: true }], failure: [{ do: 'damage', to: 'self', dice: '4d12', type: 'void' }] },
  } },
  'Force Incarnate': { failure: [{ do: 'damage', to: 'self', dice: '4d12', type: 'physical' }] },
  'Architect of Matter': { failure: [{ do: 'damage', to: 'self', dice: '3d12', type: 'physical' }, { do: 'note', text: 'Fallo: tu Knowledge baja 1 punto para siempre.' }] },
};

// The procedure of a Power, in the mode it was played (the first mode by default).
export function procedureFor(name, mode = '') {
  const p = PROCEDURES[name];
  if (!p) return null;
  if (!p.modes) return p;
  const modes = Object.keys(p.modes);
  return { ...p.modes[modes.includes(mode) ? mode : modes[0]], mode: modes.includes(mode) ? mode : modes[0] };
}
export const procedureModes = name => (PROCEDURES[name]?.modes ? Object.keys(PROCEDURES[name].modes) : null);

// A dice spec as a formula for this caster: 'P*d10' → '2d10' at Proficiency 2.
export function diceFormula(spec, actor) {
  const prof = Math.max(1, Math.min(10, Number(actor?.proficiency) || 1));
  const m = /^P(\d*)\*d(\d+)$/.exec(String(spec || ''));
  if (m) return `${prof * (Number(m[1]) || 1)}d${m[2]}`;
  return String(spec || '');
}
// The steps a cast brings: success (plus hope on a Success with Hope or a Critical), or failure.
export function stepsFor(procedure, { success = false, hope = false } = {}) {
  if (!procedure) return [];
  return success ? [...(procedure.success || []), ...(hope ? procedure.hope || [] : [])] : [...(procedure.failure || [])];
}
