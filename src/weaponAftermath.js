// After a weapon's hit is applied (Plan de UX V3, fase 4, second part, v2.45.0): the table resolves
// what the weapon does to the target. An NPC's Reaction Rolls (Stunning, Knockdown, Thermal…) are
// thrown at once, in 3D, as the Keeper's d20 + modifier against the Feature DC (HANDOVER_V2,
// decision 6), and a failure applies its condition; effects without a roll (Disorienting,
// Stagger, Continuous, Brittle, Melting, Stunning on crit) are applied to any target. A player
// character rolls its own Reaction Rolls: the table says which, in the log.
// It runs only where the damage is applied: the Keeper's table.
import { tokenInventory } from './equipment.js';
import { weaponOutcomes } from './weaponFeatures.js';
import { rollAdversaryCheck } from './attackFlow.js';
import { checkEdge } from './combatState.js';
import { addClock, newClock } from './effectClocks.js';
import { normalizeConditions } from './conditions.js';
import { pathImmune } from './statePowers.js';
import { canBleed } from './rulesEngine.js';
import { isPartyToken } from './tokenPermissions.js';

const TRAIT_NAME = { agility: 'Agility', strength: 'Strength', finesse: 'Finesse', knowledge: 'Knowledge', instinct: 'Instinct', presence: 'Presence' };

// The clock a weapon effect puts on the target.
export function weaponClock(spec, source) {
  const base = newClock({ name: spec.name, segments: 1, tick: spec.tick || 'manual', ...(spec.perTick ? { perTick: spec.perTick } : {}), ...(spec.die ? { die: spec.die } : {}), scene: true }, { source });
  const extra = Object.fromEntries(['condition', 'expiry', 'rounds', 'edge', 'nextAction', 'brittle', 'melting', 'dc'].filter(k => spec[k] !== undefined).map(k => [k, spec[k]]));
  return { ...base, ...extra };
}

// What one outcome changes on the target (conditions and clocks), and the words for the log.
export function outcomePatch(target, apply, source) {
  let conditions = normalizeConditions(target.conditions), clocks = target.effectClocks || [];
  const named = [], immune = [];
  for (const name of apply.conditions || []) {
    if (pathImmune(target, name)) { immune.push(name); continue; }
    conditions = normalizeConditions([...conditions, name]); named.push(name);
  }
  if (apply.clock) {
    if (apply.clock.condition && pathImmune(target, apply.clock.condition)) immune.push(apply.clock.condition);
    else { clocks = addClock(clocks, weaponClock(apply.clock, source)); named.push(apply.clock.condition || apply.clock.name); }
  }
  return { patch: { conditions, effectClocks: clocks }, named, immune };
}

// One NPC Reaction Roll: the d20 (and the Advantage or Disadvantage d6), against the DC.
export function npcSave(target, save, faces = []) {
  // Of the Traits the target may choose (Knockdown: Agility or Strength), one without Disadvantage.
  const trait = save.traits.find(t => !checkEdge(target, null, false, false, t).disadvantage) || save.traits[0];
  const edge = checkEdge(target, null, false, false, trait);
  const roll = rollAdversaryCheck({ actorName: target.name, modifier: target.attackModifier ?? 0, dc: save.dc, hasAdvantage: edge.advantage, hasDisadvantage: edge.disadvantage, forcedD20: faces[0] ?? null, forcedD6: faces[1] ?? null });
  return { trait, edge, roll, failed: !roll.isCritical && roll.total < save.dc };
}

// info: { attackerId, targetId, weaponId, hpLost, stressLost, critical, secret }
export async function resolveWeaponAftermath(store, info, { throwDice = null } = {}) {
  const attacker = store.state.tokens.find(t => t.id === info.attackerId);
  const weapon = attacker && info.weaponId ? tokenInventory(attacker).weapons.find(w => w.id === info.weaponId) : null;
  let target = store.state.tokens.find(t => t.id === info.targetId);
  if (!weapon || !target) return [];
  const outcomes = weaponOutcomes(weapon, { hit: true, hpLost: info.hpLost || 0, stressLost: info.stressLost || 0, critical: !!info.critical, organic: canBleed(target), hpAfter: target.hp?.current });
  if (!outcomes.length) return [];
  const npc = target.isPlayer === false && !isPartyToken(target);
  const lines = [];
  const visibility = info.secret ? { visibility: 'keeper' } : {};
  const apply = (apply, label) => {
    target = store.state.tokens.find(t => t.id === info.targetId) || target;
    const { patch, named, immune } = outcomePatch(target, apply, `${weapon.name} · ${label}`);
    if (named.length) {
      const before = store.tableActing; store.tableActing = true;
      try { store.updateToken(target.id, patch); } finally { store.tableActing = before; }
    }
    return { named, immune };
  };
  for (const o of outcomes) {
    if (o.kind === 'effect') {
      const { named, immune } = apply(o.apply, o.label);
      lines.push(`${o.label}: ${named.length ? o.text : 'inmune a ' + immune.join(', ')}.`);
      continue;
    }
    if (!npc) {
      // A character rolls its own Reaction Roll (the player decides how).
      lines.push(`${o.label}: ${target.name} tira ${o.traits.map(t => TRAIT_NAME[t]).join(' o ')} contra CD ${o.dc}; si falla, ${o.failText}.`);
      continue;
    }
    target = store.state.tokens.find(t => t.id === info.targetId) || target;
    const preview = npcSave(target, o);
    const groups = [{ qty: 1, sides: 20, role: 'Reaction' }, ...(preview.edge.advantage || preview.edge.disadvantage ? [{ qty: 1, sides: 6, role: preview.edge.advantage ? 'Advantage' : 'Disadvantage' }] : [])];
    const faces = throwDice ? await throwDice(groups, { label: `${o.label} · ${target.name}: ${TRAIT_NAME[preview.trait]} vs CD ${o.dc}`, actor: target, secret: !!info.secret,
      describe: v => { const r = npcSave(target, o, v); return { total: r.roll.total, outcome: r.failed ? 'FALLA' : 'RESISTE', modifiers: `d20 [${v[0]}] ${r.roll.totalMod >= 0 ? '+' : '−'} ${Math.abs(r.roll.totalMod)} vs CD ${o.dc}` }; } }).catch(() => []) : [];
    const { trait, roll, failed } = npcSave(target, o, faces);
    const math = `${TRAIT_NAME[trait]} d20 [${roll.d20}]${roll.advVal ? ` + d6 [${roll.advVal}]` : roll.disadvVal ? ` − d6 [${roll.disadvVal}]` : ''} ${(target.attackModifier ?? 0) >= 0 ? '+' : '−'} ${Math.abs(target.attackModifier ?? 0)} = ${roll.total} vs CD ${o.dc}`;
    if (!failed) { lines.push(`${o.label}: ${math} → resiste.`); continue; }
    const { named, immune } = apply(o.fail, o.label);
    lines.push(`${o.label}: ${math} → falla: ${named.length ? o.failText : 'inmune a ' + immune.join(', ')}.`);
  }
  if (lines.length) store.addLog({ sender: 'Combat', ...visibility, type: 'EFFECT', title: `${weapon.name} · ${target.name}`, details: lines.join(' ') });
  return lines;
}
