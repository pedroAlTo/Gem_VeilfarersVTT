import { hasTag, tagValue, weaponTagList } from './weaponTags.js';
// Weapon features (Corebook ch. 13, Weapon Features Glossary), read from the weapon's tags
// (weaponTags.js), never by searching words in its text.
// What changes numbers is applied by the table: the attack roll (attackFlow.weaponAttackBonus),
// the Armor Slots the defender may spend, extra damage dice, an extra HP, Stress and the
// conditions a hit applies. Features that ask for a choice, a reaction roll or the fiction are
// shown as reminders after the hit, with the item's Feature DC.

export function weaponFeatures(weapon) {
  const t = id => !!weapon && typeof weapon === 'object' && hasTag(weapon, id);
  return {
    crushing: t('crushing'), bleed: t('bleed'), phasing: t('phasing'), cutting: t('cutting'), vibration: t('vibration'),
    shieldPiercing: t('shield-piercing'), burstFire: t('burst-fire'), massive: t('massive'), energySurge: t('energy-surge'),
    devastating: t('devastating'), poison: t('poison'), ignite: t('ignite'),
    // Stable: the weapon ignores Overheating (Corebook).
    overheating: t('overheating') && !t('stable'),
  };
}

// ── Rust & Steel 12.06 and Corebook properties the table applies (Plan de UX V3, fase 4) ──────
const strengthOf = token => Number(token?.traits?.strength) || 0;
// The die of the weapon's damage line («1d8+3 phys.» → 8).
const weaponDie = weapon => Number(String(weapon?.damage || '').match(/d(\d+)/i)?.[1]) || 6;
// A Synthetic, a drone or a machine (Disruptor, System Shock): a drone token, a character whose
// Ancestry is Synthetic, or an adversary whose name or role says it is one.
export function isMachineTarget(token) {
  if (!token) return false;
  if (token.actorType === 'drone' || token.drone) return true;
  const who = [token.species, token.sourceCharacter?.document?.fields?.ancestry].join(' ');
  if (/synthe?t|sint[eé]tic|android|robot/i.test(who)) return true;
  return token.isPlayer === false && /\b(drones?|synth\w*|sint[eé]tic\w*|androids?|robots?|automat\w*|constructs?|mechs?|machines?|m[aá]quinas?|turrets?|torretas?)\b/i.test([token.name, token.roleTag].join(' '));
}

// What the weapon does to its own attack roll besides the bonus (attackFlow.weaponAttackBonus):
// Heavy (Rust & Steel): Strength +1 or higher, otherwise Disadvantage. `ahead` lists what the
// player decides before rolling (Unwieldy, Overcharge, Charge-Up, Garrote, Neural-Link).
export function weaponAttackEdge(weapon, wielder) {
  const notes = [], ahead = [];
  let disadvantage = false;
  if (!weapon || typeof weapon !== 'object') return { disadvantage, notes, ahead };
  if (hasTag(weapon, 'heavy') && strengthOf(wielder) < 1) { disadvantage = true; notes.push('Heavy: Strength menor que +1, Desventaja.'); }
  if (hasTag(weapon, 'unwieldy')) ahead.push('Unwieldy: −2 al ataque salvo que la hayas afianzado con una Acción y no te hayas movido.');
  if (hasTag(weapon, 'overcharge')) ahead.push('Overcharge: antes de atacar, puedes marcar 1 Stress para +1d6 de daño si impactas.');
  if (hasTag(weapon, 'charge-up')) ahead.push('Charge-Up: dispara solo si la cargaste con una Acción en un Spotlight anterior.');
  if (hasTag(weapon, 'garrote')) ahead.push('Garrote: solo contra un objetivo desprevenido o Restrained por ti.');
  if (hasTag(weapon, 'neural-link')) ahead.push('Neural-Link: sin un aumento de interfaz neural, Desventaja.');
  return { disadvantage, notes, ahead };
}

// The Evasion of whoever holds these weapons in hand: Massive −1 (Corebook); Defensive +1 (or
// its value) against Melee attacks (Rust & Steel). Only the best Defensive counts.
export function wielderEvasion(weapons = [], { melee = false } = {}) {
  const held = (weapons || []).filter(w => w && w.equipped !== false);
  let mod = 0; const notes = [];
  if (held.some(w => hasTag(w, 'massive'))) { mod -= 1; notes.push('Massive en la mano: −1 Evasion'); }
  const defensive = melee ? Math.max(0, ...held.filter(w => hasTag(w, 'defensive')).map(w => tagValue(w, 'defensive', 1))) : 0;
  if (defensive) { mod += defensive; notes.push(`Defensive: +${defensive} Evasion contra Melee`); }
  return { mod, notes };
}

// Stress the wielder marks after the attack roll: High-Recoil with Strength 0 or lower; Unstable
// on a Failure with Fear (matching dice stay a Critical Success). Volatile and Catastrophic are
// recalled on a Failure with Fear.
export function afterAttackStress(weapon, wielder, result = {}) {
  const notes = [];
  let stress = 0;
  if (!weapon || typeof weapon !== 'object') return { stress, notes };
  const fearFail = result.resultType === 'FAILURE_WITH_FEAR' && !result.isCritical;
  if (hasTag(weapon, 'high-recoil') && strengthOf(wielder) <= 0) { stress++; notes.push('High-Recoil: Strength 0 o menos, marca 1 Stress'); }
  if (fearFail && hasTag(weapon, 'unstable')) { stress++; notes.push('Unstable: Fallo con Fear, marca 1 Stress y el arma queda fuera de servicio hasta una Acción y Knowledge (Tech) DC 10'); }
  if (fearFail && hasTag(weapon, 'volatile')) notes.push('Volatile: el arma se sobrecalienta y no ataca hasta enfriarla con una Acción; Agility DC 10 o 1d6 Energy (Fire)');
  if (fearFail && hasTag(weapon, 'catastrophic')) notes.push('Catastrophic: el arma queda Broken y detona; tú y todos a Very Close tiráis Agility DC 15 (3d6 Energy, la mitad si acertáis)');
  return { stress, notes };
}

// Damage the weapon adds on a hit: Scatter +2 in Melee or Very Close (Rust & Steel); Disruptor one
// more normal damage die against a Synthetic, a drone or a machine; Paired (Corebook): with two
// Paired weapons in hand, the bonus of one of them (the larger).
export function weaponDamageRiders(weapon, { band = '', target = null, held = [] } = {}) {
  const out = [];
  if (!weapon || typeof weapon !== 'object') return out;
  const partner = hasTag(weapon, 'paired') && (held || []).some(w => w && w.id !== weapon.id && w.equipped !== false && hasTag(w, 'paired'));
  if (partner) {
    const bonus = Math.max(...[weapon, ...held.filter(w => w && w.id !== weapon.id && w.equipped !== false && hasTag(w, 'paired'))].map(w => tagValue(w, 'paired', 0)));
    if (bonus > 0) out.push({ id: 'paired', label: 'Paired', value: bonus });
  }
  if (hasTag(weapon, 'scatter') && (band === 'Melee' || band === 'Very Close')) out.push({ id: 'scatter', label: 'Scatter', value: 2 });
  if (hasTag(weapon, 'disruptor') && isMachineTarget(target)) out.push({ id: 'disruptor', label: 'Disruptor', dice: '1d' + weaponDie(weapon) });
  return out;
}

// ── After the hit (Plan de UX V3, fase 4, second part) ───────────────────────────────────────
// What a weapon does to the target once the damage is applied: Reaction Rolls with the condition a
// failure brings, and effects that need no roll. Each entry says its trigger as the book prints it:
//   save:   { kind: 'save', id, label, traits, dc, fail: { conditions?, clock? }, failText }
//   effect: { kind: 'effect', id, label, apply: { conditions?, clock? }, text }
// `clock` is an effect clock for the target (effectClocks.js), built by the table.
// ctx: { hit, hpLost, stressLost, critical, organic }
const STUNNED = label => ({ name: label + ' · Stunned', condition: 'Stunned', expiry: 'round', rounds: 2 });
export function weaponOutcomes(weapon, ctx = {}) {
  if (!weapon || typeof weapon !== 'object' || !ctx.hit) return [];
  const t = id => hasTag(weapon, id), dc = featureDC(weapon), out = [];
  const damaged = (ctx.hpLost || 0) > 0, hurt = damaged || (ctx.stressLost || 0) > 0;
  const save = (id, label, traits, saveDc, fail, failText) => out.push({ kind: 'save', id, label, traits, dc: saveDc, fail, failText });
  const effect = (id, label, apply, text) => out.push({ kind: 'effect', id, label, apply, text });
  // Corebook 12.06
  if (t('stunning') && damaged) save('stunning', 'Stunning', ['strength'], dc, { clock: STUNNED('Stunning') }, 'Stunned hasta después de la próxima ronda');
  if (t('taser-charge')) save('taser-charge', 'Taser Charge', ['strength'], dc, { clock: STUNNED('Taser Charge') }, 'Stunned hasta después de la próxima ronda');
  if (t('entangling') && hurt) save('entangling', 'Entangling', ['strength'], dc, { conditions: ['Restrained'] }, 'Restrained');
  if (t('entrapping')) save('entrapping', 'Entrapping', ['strength', 'knowledge'], dc, { conditions: ['Incapacitated'] }, 'Incapacitated');
  if (t('mind-lock') && (ctx.stressLost || 0) > 0) save('mind-lock', 'Mind-Lock', ['presence'], dc, { clock: { name: 'Mind-Lock · solo puede moverse', expiry: 'spotlight-end' } }, 'solo puede moverse en su próximo Spotlight');
  if (t('stunning-on-crit') && ctx.critical) effect('stunning-on-crit', 'Stunning on crit', { clock: STUNNED('Stunning on crit') }, 'crítico: Stunned hasta después de la próxima ronda');
  if (t('disorienting')) effect('disorienting', 'Disorienting', { clock: { name: 'Disorienting · Dazed', condition: 'Dazed', edge: 'disadvantage', nextAction: true } }, 'Dazed: Desventaja en su próxima acción');
  if (t('stagger') && damaged) effect('stagger', 'Stagger', { clock: { name: 'Stagger · próxima acción', edge: 'disadvantage', nextAction: true } }, 'Desventaja en su próxima acción');
  if (t('continuous')) effect('continuous', 'Continuous', { clock: { name: 'Continuous · +1 Stress', tick: 'spotlight', perTick: { stress: 1 } } }, 'marca 1 Stress al empezar su próximo Spotlight');
  if (t('brittle') && damaged) effect('brittle', 'Brittle', { clock: { name: 'Brittle · +1d6 Physical', brittle: true } }, 'su próximo daño Physical hace +1d6');
  // Rust & Steel 12.06
  if (t('knockdown')) save('knockdown', 'Knockdown', ['agility', 'strength'], dc <= 15 ? 10 : 15, { conditions: ['Prone'] }, 'Prone');
  if (t('thermal') && damaged) save('thermal', 'Thermal', ['strength'], dc, { conditions: ['On Fire'] }, 'On Fire');
  if (t('anchoring') && damaged) save('anchoring', 'Anchoring', ['strength'], dc, { clock: { name: 'Anchoring · sin moverse', expiry: 'spotlight-end' } }, 'no puede hacer Move en su próximo Spotlight');
  if (t('non-lethal') && damaged && ctx.hpAfter === 1) effect('non-lethal', 'Non-Lethal', { conditions: ['Incapacitated'] }, 'a 1 HP queda Incapacitated (inconsciente), no Dying');
  if (t('melting') && damaged) effect('melting', 'Melting', { clock: { name: 'Melting', tick: 'spotlight', melting: true, dc, die: 'd' + weaponDie(weapon) } }, `al empezar su próximo Spotlight, Strength contra CD ${dc} o 1d${weaponDie(weapon)} Energy`);
  // Rust & Steel 12.06, Forbidden
  if (t('agony') && hurt) save('agony', 'Agony', ['instinct'], 15, { clock: STUNNED('Agony') }, 'Stunned hasta después de la próxima ronda');
  if (t('lethal-toxin') && damaged && ctx.organic !== false) save('lethal-toxin', 'Lethal Toxin', ['strength'], 15, { conditions: ['Incapacitated', 'Poisoned'] }, 'Incapacitated y Poisoned');
  if (t('irradiating') && damaged && (t('radiation') || /radiation/i.test(String(weapon.damage || '')))) save('irradiating', 'Irradiating', ['strength'], 15, { conditions: ['Poisoned'] }, 'Poisoned');
  return out;
}
// What the table resolves after the hit, so it is no longer a reminder: the effects on any target,
// the Reaction Rolls on an NPC (a character's player rolls them: those stay as reminders).
export const AFTERMATH_EFFECTS = ['stunning-on-crit', 'disorienting', 'stagger', 'continuous', 'brittle', 'melting', 'non-lethal'];
export const AFTERMATH_TAGS = [...AFTERMATH_EFFECTS, 'stunning', 'taser-charge', 'entangling', 'entrapping', 'mind-lock', 'knockdown', 'thermal', 'anchoring', 'agony', 'lethal-toxin', 'irradiating'];

// Reload and Charge-Up (Corebook; Rust & Steel): whether the weapon can attack now, and what the
// Action that readies it is called. A Reload weapon is spent by each shot; a Charge-Up weapon
// fires only charged, and the shot uses the charge.
export function weaponReadiness(weapon) {
  if (!weapon || typeof weapon !== 'object') return { ready: true };
  if (hasTag(weapon, 'reload') && weapon.spent) return { ready: false, mode: 'reload', action: 'Recargar', reason: `${weapon.name} está descargada: gasta una Acción en recargarla antes de volver a disparar (Reload).` };
  if (hasTag(weapon, 'charge-up') && !weapon.charged) return { ready: false, mode: 'charge', action: 'Cargar', reason: `${weapon.name} no está cargada: gasta una Acción en cargarla; podrá disparar en un Spotlight posterior (Charge-Up).` };
  return { ready: true };
}
// The weapon row after attacking with it: a Reload weapon is spent, a Charge-Up one loses its charge.
export function afterShot(weapon) {
  if (!weapon || typeof weapon !== 'object') return weapon;
  const next = { ...weapon };
  if (hasTag(weapon, 'reload')) next.spent = true;
  if (hasTag(weapon, 'charge-up')) next.charged = false;
  return next;
}
// Non-Lethal (Rust & Steel): the hit cannot take the target below 1 HP.
export const nonLethalHp = (weapon, currentHp, newHp) => (weapon && typeof weapon === 'object' && hasTag(weapon, 'non-lethal') && currentHp >= 1 ? Math.max(1, newHp) : newHp);

// A second target or a second attack after an attack (Plan de UX V3, fase 4, third part, v2.46.0),
// as the books print them:
//   Automatic (Corebook): after a hit, 1 Stress: the same attack result against a second valid target
//     within range and Very Close of the first; damage rolled separately.
//   Salvo Fire (Corebook): the same, a second target within Close of the first.
//   Arc (Rust & Steel): after a hit, a second target within Very Close of the first takes half the
//     damage (rounded down), with no roll.
//   Cleave (Corebook): after a Melee hit, one more attack against a different target within reach.
//   Quick (Corebook): after attacking (hit or not), 1 Stress: a second attack against the same target.
export const FOLLOW_UPS = {
  automatic: { label: 'Automatic', action: 'Segundo objetivo', stress: 1, hit: true, near: 'Very Close', other: true, same: true },
  'salvo-fire': { label: 'Salvo Fire', action: 'Segundo objetivo', stress: 1, hit: true, near: 'Close', other: true, same: true },
  arc: { label: 'Arc', action: 'Arco a otro objetivo', stress: 0, hit: true, near: 'Very Close', other: true, half: true },
  cleave: { label: 'Cleave', action: 'Otro ataque a otro objetivo', stress: 0, hit: true, melee: true, other: true, attack: true },
  quick: { label: 'Quick', action: 'Segundo ataque', stress: 1, hit: false, sameTarget: true, attack: true },
};
// The ones this weapon offers after this attack (each once per attack).
export function availableFollowUps(weapon, { hit = false, melee = false, used = [] } = {}) {
  if (!weapon || typeof weapon !== 'object') return [];
  return Object.entries(FOLLOW_UPS).filter(([id, rule]) => hasTag(weapon, id) && !used.includes(id) && (!rule.hit || hit) && (!rule.melee || melee))
    .map(([id, rule]) => ({ id, ...rule }));
}

// ── Areas and Psionic (v2.46.0) ──────────────────────────────────────────────────────────────
// How a weapon reaches its targets, as the books print it:
//   Explosive (Corebook): every creature within Very Close of the impact point makes an Agility
//     Reaction Roll against the Feature DC: failure, the damage in full; success, half. Total Cover
//     blocks it. Area (band) and Blast (band) are the same procedure in that band (Rust & Steel).
//   Dispersal Wave (Corebook): a Close cone; each creature makes a Presence Reaction Roll, DC 15;
//     on a failure it suffers the weapon's effect (here: its damage), on a success nothing.
//   Psionic (Corebook): no attack roll against Evasion; the target makes a Presence Reaction Roll
//     against the Feature DC: failure, the damage in full; success, none.
//   Spray and Cone (Rust & Steel): a Very Close cone; Waveform (Corebook): a Close cone. One attack
//     roll compared with every creature's Evasion; the damage is rolled once (allies included).
const BAND_NAME = { 'very-close': 'Very Close', close: 'Close', far: 'Far', melee: 'Melee', medium: 'Close', 'very-far': 'Extreme' };
export function areaProcedure(weapon) {
  if (!weapon || typeof weapon !== 'object') return null;
  const dc = featureDC(weapon);
  if (hasTag(weapon, 'psionic')) return { kind: 'psionic', label: 'Psionic', mode: 'save', traits: ['presence'], dc, zone: 'target', success: 0 };
  if (hasTag(weapon, 'dispersal-wave')) return { kind: 'dispersal-wave', label: 'Dispersal Wave', mode: 'save', traits: ['presence'], dc: 15, cone: 'Close', success: 0 };
  const area = weaponTagList(weapon).find(t => t === 'area' || t.startsWith('area:'));
  if (hasTag(weapon, 'explosive') || (area && area.includes(':'))) {
    const band = area?.includes(':') ? BAND_NAME[area.split(':')[1]] || 'Very Close' : 'Very Close';
    return { kind: hasTag(weapon, 'explosive') ? 'explosive' : 'area', label: hasTag(weapon, 'explosive') ? 'Explosive' : `Area (${band})`, mode: 'save', traits: ['agility'], dc, around: band, success: 0.5 };
  }
  if (hasTag(weapon, 'spray')) return { kind: 'spray', label: 'Spray', mode: 'attack', cone: 'Very Close' };
  if (hasTag(weapon, 'waveform')) return { kind: 'waveform', label: 'Waveform', mode: 'attack', cone: 'Close' };
  return null;
}
// Who is in the zone: around the impact (a band from the target token; a wall between them and the
// impact is Total Cover), a 60° cone from the attacker towards the target, or the target alone.
// `distance(a, b)` → { band, blocked } (attackFlow.distanceInfo with the map).
const ORDER = ['Melee', 'Very Close', 'Close', 'Far', 'Extreme'];
const within = (band, limit) => ORDER.indexOf(band) >= 0 && ORDER.indexOf(band) <= ORDER.indexOf(limit);
export function zoneTargets(tokens, actor, impact, procedure, distance) {
  if (!procedure || !impact) return [];
  if (procedure.zone === 'target') return [impact];
  const live = (tokens || []).filter(t => t && t.mapId === impact.mapId && !t.inReserve && Number.isFinite(t.x) && Number.isFinite(t.y));
  if (procedure.around) return live.filter(t => { const d = distance(impact, t); return t.id === impact.id || (within(d.band, procedure.around) && !d.blocked); });
  if (procedure.cone) {
    const aim = Math.atan2(impact.y - actor.y, impact.x - actor.x);
    return live.filter(t => {
      if (t.id === actor.id) return false;
      if (t.id === impact.id) return true;
      const d = distance(actor, t);
      if (!within(d.band, procedure.cone) || d.blocked) return false;
      const angle = Math.abs(Math.atan2(Math.sin(Math.atan2(t.y - actor.y, t.x - actor.x) - aim), Math.cos(Math.atan2(t.y - actor.y, t.x - actor.x) - aim)));
      return angle <= Math.PI / 6 + 1e-6;
    });
  }
  return [impact];
}

// Guided, Mind Link and Indirect may attack without line of sight.
export const ignoresLineOfSight = weapon => !!weapon && ['guided', 'mind-link', 'indirect'].some(id => hasTag(weapon, id));

// Feature DC: TT1 10, TT2 15, TT3 20, TT4 25 (Corebook). Read from the item's tier text.
export function featureDC(weapon) {
  const tier = String(weapon?.tier ?? '');
  const tt = tier.match(/tt\s*([1-4])/i)?.[1] || tier.match(/tier\s*([1-4])/i)?.[1];
  if (tt) return [10, 15, 20, 25][Number(tt) - 1];
  if (/experimental/i.test(tier)) return 20;
  if (/military|advanced|uncommon/i.test(tier)) return 15;
  if (/precursor|legendary|artifact/i.test(tier)) return 25;
  return 10;
}

// The Armor Slots the defender may spend against this hit.
// Crushing (cancelled by Composite armor) and Phasing ignore one; Cutting and Vibration allow
// none; Shield Piercing allows half, rounded down.
export function armorSlotsAllowed(available, features = {}, { composite = false } = {}) {
  let slots = Math.max(0, Number(available) || 0);
  if (features.cutting || features.vibration) return 0;
  if (features.crushing && !composite) slots = Math.max(0, slots - 1);
  if (features.phasing) slots = Math.max(0, slots - 1);
  if (features.shieldPiercing) slots = Math.floor(slots / 2);
  return slots;
}
export function armorSlotNotes(features = {}, { composite = false } = {}) {
  const notes = [];
  if (features.cutting || features.vibration) notes.push(`${features.cutting ? 'Cutting' : 'Vibration'}: no se pueden gastar Armor Slots contra este impacto.`);
  else {
    if (features.crushing) notes.push(composite ? 'Crushing anulado por armadura Composite.' : 'Crushing: ignora 1 Armor Slot del objetivo en este impacto.');
    if (features.phasing) notes.push('Phasing: ignora 1 Armor Slot del objetivo en este impacto.');
    if (features.shieldPiercing) notes.push('Shield Piercing: solo se puede gastar la mitad de los Armor Slots (redondeando abajo).');
  }
  return notes;
}

// Extra damage after the dice are rolled. `rolls` and `sides` are the normal damage dice, in order.
// Burst Fire: each die at its maximum adds one die of the same size (the new dice do not explode).
// Massive: roll one more normal die and discard the lowest. Energy Surge: +1d6 Energy.
export function damageExtras(features = {}, rolls = [], sides = [], rollDie = s => Math.floor(Math.random() * s) + 1) {
  let bonus = 0;
  const notes = [];
  if (features.burstFire) {
    const extra = rolls.map((r, i) => (r === sides[i] && sides[i] > 1 ? rollDie(sides[i]) : null)).filter(v => v !== null);
    if (extra.length) { bonus += extra.reduce((a, b) => a + b, 0); notes.push(`Burst Fire: ${extra.length} dado${extra.length > 1 ? 's' : ''} extra [${extra.join(', ')}].`); }
  }
  if (features.massive && rolls.length) {
    const size = sides[0] || 6, extra = rollDie(size), low = Math.min(...rolls);
    const gain = Math.max(0, extra - low);
    bonus += gain;
    notes.push(`Massive: dado extra d${size} [${extra}], se descarta el más bajo (${Math.min(extra, low)})${gain ? `: +${gain}` : ''}.`);
  }
  if (features.energySurge) {
    const surge = rollDie(6);
    bonus += surge;
    notes.push(`Energy Surge: +1d6 [${surge}] Energy y el objetivo marca 1 Stress.`);
  }
  return { bonus, notes };
}

// The extra dice damageExtras will roll, in the same order, so they can be thrown as 3D dice
// first: one per Burst Fire die at its maximum, Massive's die, Energy Surge's d6.
export function extraDiceNeeded(features = {}, rolls = [], sides = []) {
  const out = [];
  if (features.burstFire) rolls.forEach((r, i) => { if (r === sides[i] && sides[i] > 1) out.push({ qty: 1, sides: sides[i], role: 'Burst Fire' }); });
  if (features.massive && rolls.length) out.push({ qty: 1, sides: sides[0] || 6, role: 'Massive' });
  if (features.energySurge) out.push({ qty: 1, sides: 6, role: 'Energy Surge' });
  return out;
}

// Devastating: when damage reaches the Severe Threshold, the hit marks 1 more HP.
export const devastatingExtra = (features = {}, raw = 0, severe = Infinity) => (features.devastating && raw >= severe ? 1 : 0);

// Stress the hit marks besides HP: Energy Surge on a hit, Poison when HP is lost.
export function hitStress(features = {}, { hpLost = 0 } = {}) {
  return (features.energySurge ? 1 : 0) + (features.poison && hpLost > 0 ? 1 : 0);
}
// Conditions the table applies by itself: Ignite (On Fire) when HP is lost.
export function hitConditions(features = {}, { hpLost = 0 } = {}) {
  return features.ignite && hpLost > 0 ? ['On Fire'] : [];
}

// Everything else, as reminders: what triggers it, who rolls against what, what it applies.
const REMINDERS = [
  ['stunning-on-crit', (dc, ctx) => ctx.critical ? 'Stunning on crit: el objetivo queda Stunned.' : ''],
  ['stunning', (dc, ctx) => ctx.damaged ? `Stunning: el objetivo hace una Strength Reaction Roll contra CD ${dc}; si falla, queda Stunned.` : ''],
  ['taser-charge', dc => `Taser Charge: Strength Reaction Roll contra CD ${dc}; si falla, Stunned.`],
  ['entangling', (dc, ctx) => ctx.damaged ? `Entangling: Strength Reaction Roll contra CD ${dc}; si falla, Restrained.` : ''],
  ['entrapping', dc => `Entrapping: el objetivo elige Strength o Knowledge (Tech) contra CD ${dc}; si falla, Incapacitated.`],
  ['disorienting', () => 'Disorienting: el objetivo queda Dazed.'],
  ['stagger', (dc, ctx) => ctx.damaged ? 'Stagger: el objetivo tiene Desventaja en su próxima acción.' : ''],
  ['continuous', () => 'Continuous: el objetivo marca 1 Stress al empezar su próximo Spotlight.'],
  ['brittle', (dc, ctx) => ctx.damaged ? 'Brittle: el próximo daño Physical que reciba hace +1d6.' : ''],
  ['armor-piercing', (dc, ctx, w) => `Armor Piercing${tagValue(w, 'armor-piercing') ? ` ${tagValue(w, 'armor-piercing')}` : ''}: reduce los Armor Slots máximos del objetivo según su valor hasta su próximo Long Rest.`],
  ['shredding', (dc, ctx) => ctx.damaged ? 'Shredding: −1 Armor Slot máximo del objetivo hasta reparar la armadura en Downtime.' : ''],
  ['mind-lock', dc => `Mind-Lock: si el objetivo marca Stress, Presence Reaction Roll contra CD ${dc}; si falla, solo puede moverse en su próximo Spotlight.`],
  ['disintegrating', (dc, ctx) => ctx.maxDie ? 'Disintegrating: un dado salió al máximo; un objeto expuesto queda inutilizado o −1 Armor Slot máximo (elige el objetivo).' : ''],
  ['unraveling', (dc, ctx) => ctx.maxDie ? 'Unraveling: un dado salió al máximo; el objetivo suprime un rasgo de Clase o Ancestry hasta el final de la escena.' : ''],
  ['system-shock', (dc, ctx) => ctx.machine === true ? 'System Shock: el objetivo es Sintético o máquina: daño normal.' : ctx.machine === false ? 'System Shock: el objetivo es orgánico: en lugar del daño, solo 1d4 Stress.' : 'System Shock: daño normal contra Sintéticos y máquinas; contra orgánicos, solo 1d4 Stress.'],
  ['suppressive', () => 'Suppressive: marca 1 Stress; quien esté a Close del objetivo tiene Desventaja en sus ataques hasta el final de su próximo Spotlight.'],
  ['probability-shift', () => 'Probability Shift: puedes repetir los dos Duality Dice y quedarte con el nuevo resultado.'],
  // Area with no band (Corebook): who is in its zone is the table's call.
  ['area', (dc, ctx, w) => weaponTagList(w).includes('area') ? 'Área: el efecto alcanza a todas las criaturas de su zona (también aliados); compara la tirada con la Evasion de cada una.' : ''],
  // Rust & Steel 12.06
  ['knockdown', dc => `Knockdown: el objetivo elige Agility o Strength (Reaction Roll) contra CD ${dc <= 15 ? 10 : 15}; si falla, Prone.`],
  ['thermal', (dc, ctx) => ctx.damaged ? `Thermal: Strength Reaction Roll contra CD ${dc}; si falla, On Fire.` : ''],
  ['anchoring', (dc, ctx) => ctx.damaged ? `Anchoring: Strength Reaction Roll contra CD ${dc}; si falla, no puede hacer Move en su próximo Spotlight.` : ''],
  ['melting', (dc, ctx) => ctx.damaged ? `Melting: al empezar su próximo Spotlight, el objetivo tira Strength contra CD ${dc}; si falla, un dado de daño del arma como Energy; si acierta, la mitad.` : ''],
  ['non-lethal', () => 'Non-Lethal: no baja al objetivo de 1 HP; a 1 HP queda Incapacitated (inconsciente), no Dying.'],
  ['sundering', (dc, ctx) => ctx.critical && ctx.damaged ? 'Sundering: el objetivo elige: un escudo expuesto queda fuera de servicio o −2 Armor Slots máximos hasta Repair All Armor.' : ''],
  ['sustained-fire', (dc, ctx) => ctx.hit ? 'Sustained Fire: en tu próximo Spotlight, sin moverte y con el objetivo a tu alcance, gasta tu Acción para repetir este daño sin tirar.' : ''],
  ['emp', (dc, ctx) => ctx.hit ? 'EMP: resuelve el pulso EMP (Rust & Steel, cap. 5) contra los dispositivos expuestos, aumentos, drones y Sintéticos a su alcance.' : ''],
  ['anti-psionic', (dc, ctx) => ctx.hit ? 'Anti-Psionic: +1d6 Neural si el objetivo es Veil-Touched o Veil-Aligned, o usó un Domain Power desde su último Spotlight.' : ''],
  ['temporal', () => 'Temporal: una vez por escena, tras una tirada sin dobles, puedes repetir el dado de Hope.'],
  // Rust & Steel 12.06, Forbidden
  ['lethal-toxin', (dc, ctx) => ctx.damaged ? 'Lethal Toxin: un objetivo orgánico tira Strength DC 15; si falla, Incapacitated y Poisoned (un segundo fallo, Dying). Los Sintéticos son inmunes.' : ''],
  ['irradiating', (dc, ctx) => ctx.damaged ? 'Irradiating: Strength DC 15; si falla, Poisoned hasta Knowledge (Medicine) DC 20 en un Long Rest. La zona queda contaminada.' : ''],
  ['agony', (dc, ctx) => ctx.damaged ? 'Agony: Instinct Reaction Roll DC 15; si falla, Stunned (salvo inmunes al dolor).' : ''],
  ['horrifying', (dc, ctx) => ctx.damaged ? 'Horrifying: quien lo vea causar daño por primera vez en la escena tira Presence DC 15; si falla, marca 1 Stress.' : ''],
  ['disabling', (dc, ctx) => ctx.damaged ? 'Disabling: contra un Sintético, un dron o alguien con aumentos, su operador tira Knowledge (Tech) DC 15; si falla, un dispositivo expuesto queda fuera de servicio.' : ''],
  ['assassination', (dc, ctx) => ctx.hit ? 'Assassination: contra un objetivo desprevenido, un dado de daño más y el objetivo queda Dazed.' : ''],
  ['shred', (dc, ctx) => ctx.damaged ? (ctx.armorAuto ? 'Shred: un objetivo orgánico queda Bleeding.' : 'Shred: −1 Armor Slot máximo hasta Repair All Armor y, si es orgánico, Bleeding.') : ''],
  ['black-hole', () => 'Black Hole: cada criatura a Very Close tira Strength DC 15; si falla, es arrastrada al centro y recibe 4d6 Void; si acierta, la mitad.'],
  ['lingering', (dc, ctx, w) => `Lingering: la zona sigue siendo peligrosa ${tagValue(w, 'lingering') ? tagValue(w, 'lingering') + ' rondas' : 'hasta el final de la próxima ronda'}; quien entre o empiece allí su Spotlight repite la tirada de Agility contra la mitad de los dados.`],
  ['one-use', () => 'One-Use: el arma o su carga se gasta tras esta Acción.'],
];
// ctx.armorAuto: the table already cut the target's maximum Armor Slots (an enemy, see armorCut).
const ARMOR_CUT_TAGS = ['armor-piercing', 'shredding', 'disintegrating'];
export function featureReminders(weapon, ctx = {}) {
  if (!weapon || typeof weapon !== 'object') return [];
  const dc = featureDC(weapon);
  return [...new Set(REMINDERS.filter(([id]) => hasTag(weapon, id) && !(ctx.armorAuto && ARMOR_CUT_TAGS.includes(id)) && !((ctx.aftermath === 'npc' ? AFTERMATH_TAGS : ctx.aftermath === 'pc' ? AFTERMATH_EFFECTS : []).includes(id))).map(([, say]) => say(dc, ctx, weapon)).filter(Boolean))];
}

// Cuts to an enemy's maximum Armor Slots, applied at once (enemies rarely live to a second
// round, so a reminder would come too late). Each cut keeps how it comes back:
// - Armor Piercing (rating, default 1), on a hit: until its next Long Rest.
// - Disintegrating, when a damage die rolls its maximum: −1 until Repair All Armor (for an NPC
//   the Keeper chooses; on an armored enemy the table takes the Armor Slot).
// - Shredding, when the hit deals damage: −1 until the armor is repaired in Downtime.
// null when nothing is cut. PCs keep the reminders: the player chooses (Disintegrating) and the
// cut is applied on their sheet.
export function armorCut(weapon, ctx = {}, armorMax = 0) {
  if (!weapon || !ctx.hit || !(armorMax > 0)) return null;
  const cut = { long: 0, repairAll: 0, downtime: 0 };
  if (hasTag(weapon, 'armor-piercing')) cut.long = Math.max(1, Math.min(5, tagValue(weapon, 'armor-piercing', 1)));
  if (hasTag(weapon, 'disintegrating') && ctx.maxDie) cut.repairAll = 1;
  if (hasTag(weapon, 'shredding') && ctx.damaged) cut.downtime = 1;
  // Shred (Rust & Steel, Forbidden): −1 until Repair All Armor when it causes HP loss.
  if (hasTag(weapon, 'shred') && ctx.damaged) { cut.repairAll += 1; cut.shred = 1; }
  return cut.long + cut.repairAll + cut.downtime ? cut : null;
}
export const validArmorCut = c => !!c && typeof c === 'object' && ['long', 'repairAll', 'downtime'].every(k => Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= 5) && c.long + c.repairAll + c.downtime >= 1;
// The armor after the cut: its maximum drops (never below 0), the slots left fit the new maximum,
// and `cut` remembers what each rest gives back.
export function applyArmorCut(armor = {}, cut) {
  const total = cut.long + cut.repairAll + cut.downtime;
  const max = Math.max(0, (armor.max || 0) - total), before = armor.cut || {};
  return { ...armor, max, current: Math.min(armor.current || 0, max), cut: { long: (before.long || 0) + cut.long, repairAll: (before.repairAll || 0) + cut.repairAll, downtime: (before.downtime || 0) + cut.downtime } };
}
// What a rest gives back: a Long Rest ends the Armor Piercing cuts; Repair All Armor also those
// of Disintegrating. The Shredding ones wait for Downtime (the Keeper edits them by hand).
export function restoreArmorCut(armor = {}, { long = false, repairAll = false } = {}) {
  const c = armor.cut;
  if (!c) return armor;
  const back = (long ? c.long || 0 : 0) + (repairAll ? c.repairAll || 0 : 0);
  if (!back) return armor;
  const cut = { long: long ? 0 : c.long || 0, repairAll: repairAll ? 0 : c.repairAll || 0, downtime: c.downtime || 0 };
  const { cut: _old, ...rest } = armor;
  return { ...rest, max: (armor.max || 0) + back, ...(cut.long + cut.repairAll + cut.downtime ? { cut } : {}) };
}
export function armorCutNotes(cut) {
  if (!cut) return [];
  return [
    ...(cut.long ? [`Armor Piercing: −${cut.long} Armor Slot${cut.long > 1 ? 's' : ''} máximo${cut.long > 1 ? 's' : ''} del objetivo al aplicar el daño (hasta su próximo Long Rest).`] : []),
    ...(cut.repairAll - (cut.shred || 0) > 0 ? ['Disintegrating: un dado salió al máximo; −1 Armor Slot máximo del objetivo al aplicar el daño (hasta Repair All Armor).'] : []),
    ...(cut.shred ? ['Shred: −1 Armor Slot máximo del objetivo al aplicar el daño (hasta Repair All Armor).'] : []),
    ...(cut.downtime ? ['Shredding: −1 Armor Slot máximo del objetivo al aplicar el daño (hasta reparar la armadura en Downtime).'] : []),
  ];
}

// Overheating: after each attack roll a d6; on 1–2 the weapon must cool down.
export function overheatCheck(features = {}, rollDie = s => Math.floor(Math.random() * s) + 1) {
  if (!features.overheating) return null;
  const roll = rollDie(6);
  return { roll, overheated: roll <= 2, text: roll <= 2 ? `Overheating: d6 [${roll}]: el arma se sobrecalienta; marca 1 Stress para enfriarla o gasta una Acción antes de volver a atacar.` : `Overheating: d6 [${roll}]: sin problema.` };
}
