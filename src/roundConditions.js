// Conditions that act at the end of each round (v2.54.0, Plan de UX V3, fase 5, segunda parte; the
// user's decision of 25 nov 2026: both automatic). When the Keeper closes the round («Nueva ronda»):
// - On Fire: 1d4 Energy damage with the Fire tag, thrown in 3D, against the Thresholds as usual
//   (resistances, Reflective armor and the Energy penetration count). No Armor Slot is spent for the
//   target: the Keeper can still adjust it by hand.
// - Poisoned: 1 Stress. Synthetics and targets immune to toxins ignore it (Corebook 12.06, ch. 10).
// Bleeding stays manual (HANDOVER_V2, decision 18). It runs on the Keeper's table, which closes the round.
import { onRoundChange, lifeStage } from './combatState.js';
import { visibleConditions } from './conditions.js';
import { resolveDamage } from './rulesEngine.js';
import { damageProtection } from './damageProtection.js';
import { thresholdBonus } from './powerEffects.js';
import { isMachineTarget } from './weaponFeatures.js';
import { targetDefenses } from './equipment.js';
import { throwDice, facesRoller } from './tableDice.js';
import { damageCalc } from './logCalc.js';

const TOXIN_IMMUNE = /(?:inmun|immun)\w*[^.]*(?:toxin|venen|poison)|ignora\w* (?:la )?condici[oó]n Poisoned/i;

// Who ignores Poisoned, and why (an empty string: it counts).
export function poisonImmunity(token) {
  if (isMachineTarget(token)) return 'Sintético o máquina';
  if (damageProtection(token, new Set(['poison', 'toxic'])) === 'immune') return 'inmune a toxinas';
  const gear = (token?.inventory?.items || []).map(i => [i.name, i.benefit, i.use].join(' ')).join(' · ');
  return TOXIN_IMMUNE.test(gear) ? 'inmune a toxinas (equipo)' : '';
}

// The tokens of the scene that burn or are poisoned now.
export function roundConditionTargets(store) {
  const map = store.getActiveMap?.();
  if (!map) return [];
  return store.state.tokens.filter(t => t.mapId === map.id && !t.inReserve && t.hp && (t.hp.current || 0) > 0 && !lifeStage(t))
    .map(t => ({ token: t, fire: visibleConditions(t).includes('On Fire'), poison: visibleConditions(t).includes('Poisoned') }))
    .filter(x => x.fire || x.poison);
}

// One burn: the damage of a 1d4 Energy (Fire) face against the target's thresholds.
export function fireDamage(token, face) {
  const raised = thresholdBonus(token);
  const major = Number(token.hp?.majorThreshold), severe = Number(token.hp?.severeThreshold);
  const defenses = targetDefenses(token);
  return resolveDamage({
    attackerName: 'On Fire', targetName: token.name, diceCount: 1, diceSides: 4, flatModifier: 0, rollDie: facesRoller([face]),
    damageType: 'energy', types: ['energy', 'fire'], targetToken: token,
    targetMajorThreshold: Number.isFinite(major) ? major + raised : 99, targetSevereThreshold: Number.isFinite(severe) ? severe + raised : 99,
    targetReflective: defenses.reflective, useArmorSlot: false, currentArmorSlots: 0,
  });
}

const write = (store, id, patch) => {
  const before = store.tableActing; store.tableActing = true;
  try { store.updateToken(id, patch); } finally { store.tableActing = before; }
};

export async function roundConditions(store, round, { roll = throwDice } = {}) {
  const lines = [];
  for (const { token, fire, poison } of roundConditionTargets(store)) {
    const secret = token.hidden ? { visibility: 'keeper' } : {};
    if (fire) {
      const live = store.state.tokens.find(t => t.id === token.id);
      if (!live?.hp || (live.hp.current || 0) <= 0) continue;
      const faces = await roll([{ qty: 1, sides: 4, role: 'On Fire' }], { label: `On Fire · ${live.name}`, actor: live, secret: !!live.hidden,
        describe: v => { const r = fireDamage(live, v[0]); return { total: r.effectiveDamage, outcome: `${r.finalSeverity} · ${r.finalHpDamage} HP`, modifiers: `1d4 [${v[0]}] Energy (Fire)` }; } }).catch(() => []);
      const face = Number.isInteger(faces?.[0]) && faces[0] >= 1 && faces[0] <= 4 ? faces[0] : 1 + Math.floor(Math.random() * 4);
      const now = store.state.tokens.find(t => t.id === token.id) || live;
      const result = fireDamage(now, face);
      const before = now.hp.current, after = Math.max(0, before - result.finalHpDamage);
      if (after !== before) write(store, now.id, { hp: { ...now.hp, current: after } });
      const line = `${now.name} arde: 1d4 [${face}] Energy (Fire) → ${result.fullyProtected ? (result.finalSeverity === 'Immune' ? 'inmune' : 'resiste') : result.finalSeverity}, pierde ${before - after} HP (${before} → ${after}).`;
      store.addLog({ sender: 'Combat', ...secret, type: 'DAMAGE', title: `On Fire · ${now.name}`, details: line,
        calc: [`Fin de la ronda ${round - 1}: On Fire hace 1d4 Energy con el tag Fire (Corebook, cap. 10).`,
          ...damageCalc({ result, sides: [4], hpLost: before - after, hpBefore: before, hpAfter: after, hpMax: now.hp.max, type: 'energy' }),
          'Sin Armor Slots: es un efecto continuo (el Keeper puede ajustarlo a mano).', 'Termina al apagarlo: tu Acción, la de un aliado, sumergirse o lo que diga la fuente.'] });
      lines.push(line);
    }
    if (poison) {
      const now = store.state.tokens.find(t => t.id === token.id);
      if (!now) continue;
      const immune = poisonImmunity(now);
      if (immune) { lines.push(`${now.name} ignora Poisoned (${immune}).`); continue; }
      if (!now.stress) continue;
      const max = now.stress.max > 0 ? now.stress.max : Infinity, before = now.stress.current || 0, after = Math.min(max, before + 1);
      if (after !== before) write(store, now.id, { stress: { ...now.stress, current: after } });
      const line = `${now.name} está Poisoned: marca 1 Stress (${before} → ${after}${Number.isFinite(max) ? ` / ${max}` : ''})${after === before ? ', ya no le queda Stress libre' : ''}.`;
      store.addLog({ sender: 'Combat', ...secret, type: 'EFFECT', title: `Poisoned · ${now.name}`, details: line,
        calc: [`Fin de la ronda ${round - 1}: Poisoned marca 1 Stress (Corebook, cap. 10).`, `Stress: ${before} → ${after}`, 'Termina con First Aid (DC 10), un antídoto, un Long Rest o la duración de la fuente.'] });
      lines.push(line);
    }
  }
  return lines;
}

onRoundChange((store, round) => { roundConditions(store, round).catch(error => console.warn('Round conditions:', error)); });
