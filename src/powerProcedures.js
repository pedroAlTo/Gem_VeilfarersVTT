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
//            { do: 'heal', to, dice, hp, stress }             HP (dice or a number) and Stress cleared
//            { do: 'condition', to, conditions }              plain conditions
//            { do: 'clock', to, clock }                       an effect clock (condition, edge…)
//            { do: 'mark', to, stress, hp }                   Stress or direct HP marked
//            { do: 'note', text }
//   to       'targets' (default) | 'enemies' | 'allies' | 'self'
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
  // ── Level 7 ──
  'Orbital Lance': { zone: { shape: 'point', reach: 'Extreme', size: 'Very Close', who: 'creatures' },
    success: [{ do: 'damage', dice: '4d10', type: 'physical', tag: 'Kinetic' }],
    failure: [{ do: 'note', text: 'Fallo: tira d8 (dirección) y 1d4 (bandas de alcance); el impacto cae allí. La nave pierde 1 Hull.' }] },
  'Corona Beam': { zone: { shape: 'line', reach: 'Far', who: 'creatures' },
    success: [{ do: 'damage', dice: 'P2*d8', type: 'energy', tag: 'Radiant' },
      { do: 'note', text: 'Contra un objetivo de Tier menor, +10 al total antes de comparar con sus umbrales.' }] },
  'Temporal Freeze': { failure: [{ do: 'clock', to: 'self', clock: { name: 'Temporal Freeze · Stunned', condition: 'Stunned', expiry: 'round' } }, { do: 'mark', to: 'self', stress: 2 }] },
  'Phase Jump': { failure: [{ do: 'clock', to: 'self', clock: STUN_NEXT('Phase Jump') }, { do: 'mark', to: 'self', stress: 2 }] },
  // ── Level 8 ──
  'Psychic Collapse': { target: { who: 'creature', reach: 'Extreme', self: false },
    success: [{ do: 'damage', dice: '3d8', type: 'void', noArmor: true },
      { do: 'clock', clock: { name: 'Psychic Collapse · Desventaja', edge: 'disadvantage', allRolls: true, expiry: 'round' } }],
    failure: [{ do: 'damage', to: 'self', dice: '1d8', type: 'void' }] },
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
