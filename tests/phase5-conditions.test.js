// Plan de UX V3, fase 5 (v2.53.0): the conditions count by themselves (Corebook 12.06, ch. 10).
// Prone, Restrained, Weakened, Dazed, Incapacitated and Hidden change the rolls, the attacks, the
// movement and the damage without the table remembering them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATOR_DATA as data } from '../src/creator/creatorData.js';
import { setCardData } from '../src/cardData.js';
import { performGameAction } from '../src/gameActions.js';
import { checkEdge, combatTransition, movementBlock, requireActive, helplessTarget, rangedTargetBlock } from '../src/combatState.js';
import { resolveDamageExpression } from '../src/equipment.js';
import { isMeleeAttack } from '../src/attackFlow.js';
import { npcSave } from '../src/weaponAftermath.js';

setCardData(data);
const scene = { id: 'm', gridSize: 64, gridScaleMeters: 2, walls: [], spotlightRound: 1 };
const pc = (id, patch = {}) => ({ id, name: id, mapId: scene.id, x: 64, y: 64, size: 1, isPlayer: true, actorType: 'player', characterClass: 'Soldier', path: 'Awakened', level: 1, proficiency: 1, hope: 2,
  traits: { agility: 1, strength: 0, finesse: 1 }, conditions: [], hp: { current: 6, max: 6 }, stress: { current: 0, max: 6 }, armor: { current: 1, max: 1 }, sheetFields: {}, ...patch });
const foe = (patch = {}) => ({ ...pc('foe'), isPlayer: false, actorType: 'adversary', name: 'Pirata', x: 64 * 8, ...patch });
function table(...tokens) {
  return { sessionRole: 'host', state: { campaignId: 'w', activeMapId: scene.id, maps: [scene], userRole: 'keeper', tokens, logs: [], fear: 0, clocks: [] },
    getActiveMap() { return this.state.maps.find(m => m.id === this.state.activeMapId); }, update(patch) { Object.assign(this.state, patch); },
    updateToken(id, patch) { this.state.tokens = this.state.tokens.map(t => t.id === id ? combatTransition(t, { ...t, ...patch }, this.getActiveMap()) : t); },
    addLog(log) { this.state.logs.unshift(log); }, addFear(n) { this.state.fear = Math.min(12, this.state.fear + n); } };
}
const rifle = { inventory: { weapons: [{ id: 'rifle', name: 'Rifle', damage: '1d8+1', trait: 'Agility', range: 'Far', tags: [] }, { id: 'knife', name: 'Knife', damage: '1d4', trait: 'Agility', range: 'Melee', tags: [] }], items: [], credits: 0 } };
const shoot = (s, options = {}, weaponId = 'rifle') => performGameAction({ type: 'CHECK', actorId: 'pc', attack: true, targetId: 'foe', weaponId, options: { traitId: 'agility', dc: 12, forcedHope: 5, forcedFear: 3, forcedAdv: 4, ...options } }, s);

test('Restrained, Weakened, Prone and Dazed give Disadvantage where the book says', () => {
  const t = (conditions) => pc('a', { conditions });
  assert.equal(checkEdge(t(['Restrained']), null, false, false, 'agility').disadvantage, true);
  assert.equal(checkEdge(t(['Restrained']), null, false, false, 'strength').disadvantage, true);
  assert.equal(checkEdge(t(['Restrained']), null, false, false, 'finesse').disadvantage, false);
  assert.equal(checkEdge(t(['Weakened']), null, false, false, 'strength').disadvantage, true);
  assert.equal(checkEdge(t(['Weakened']), null, false, false, 'agility').disadvantage, false);
  assert.equal(checkEdge(t(['Prone']), foe(), false, false, 'agility').disadvantage, true, 'Prone: Disadvantage on attacks');
  assert.equal(checkEdge(t(['Prone']), null, false, false, 'agility').disadvantage, false, 'not on other rolls');
  assert.equal(checkEdge(t(['Dazed']), null, false, false, 'presence').disadvantage, true, 'Dazed: the next action, any Trait');
  assert.equal(checkEdge(t(['Dazed']), null, false, false, 'presence', { reaction: true }).disadvantage, false, 'a Reaction Roll is not an action');
  // A Prone target: a ranged attacker has Advantage, a melee one does not.
  assert.equal(checkEdge(pc('a'), foe({ conditions: ['Prone'] }), false, false, 'agility', { ranged: true }).advantage, true);
  assert.equal(checkEdge(pc('a'), foe({ conditions: ['Prone'] }), false, false, 'agility').advantage, false);
  assert.equal(isMeleeAttack({ range: 'Melee' }, 'Far'), true); assert.equal(isMeleeAttack({ range: 'Far' }, 'Melee'), false); assert.equal(isMeleeAttack(null, 'Melee'), true);
  // An NPC's Reaction Roll ignores «the next action» (Dazed, Stagger).
  const save = npcSave(foe({ conditions: ['Dazed'], attackModifier: 0 }), { traits: ['agility'], dc: 10 }, [12]);
  assert.equal(save.edge.disadvantage, false);
});

test('Dazed is spent by the next action; a ranged attack on a Prone target rolls with Advantage', () => {
  const s = table(pc('pc', { conditions: ['Dazed'], ...rifle }), foe());
  const first = shoot(s);
  assert.equal(first.disadvVal, 4, 'the Disadvantage die');
  assert.equal(s.state.tokens.find(t => t.id === 'pc').conditions.includes('Dazed'), false, 'and Dazed ends');
  assert.equal(shoot(s).disadvVal, 0, 'the next roll is normal');
  const p = table(pc('pc', rifle), foe({ conditions: ['Prone'] }));
  assert.equal(shoot(p).advVal, 4, 'Prone target, ranged: Advantage');
  const m = table(pc('pc', rifle), foe({ conditions: ['Prone'], x: 128 }));
  assert.equal(shoot(m, {}, 'knife').advVal, 0, 'a melee attack does not get it');
});

test('a Hidden target cannot be shot at; an Incapacitated one is hit automatically', () => {
  const h = table(pc('pc', rifle), foe({ conditions: ['Hidden'] }));
  assert.throws(() => shoot(h), /Hidden/);
  assert.match(rangedTargetBlock(foe({ conditions: ['Hidden'] }), true), /distancia/);
  assert.equal(rangedTargetBlock(foe({ conditions: ['Hidden'] }), false), '', 'in melee it can');
  const near = table(pc('pc', rifle), foe({ conditions: ['Hidden'], x: 128 }));
  assert.doesNotThrow(() => shoot(near, {}, 'knife'));
  const i = table(pc('pc', rifle), foe({ conditions: ['Incapacitated'] }));
  const miss = shoot(i, { dc: 30, forcedHope: 2, forcedFear: 3 });
  assert.equal(miss.hitTarget, 'foe', 'a miss on the dice still hits');
  assert.match(i.state.logs[0].details, /Incapacitated: el ataque impacta/);
  assert.equal(helplessTarget(foe({ conditions: ['Incapacitated'] })), true);
});

test('Restrained cannot move (the player); moving stands up from Prone; Incapacitated cannot act', () => {
  assert.match(movementBlock(pc('a', { conditions: ['Restrained'] })), /Restrained/);
  assert.match(movementBlock(pc('a', { conditions: ['Incapacitated'] })), /Incapacitated/);
  assert.equal(movementBlock(pc('a', { conditions: ['Prone'] })), '');
  assert.throws(() => requireActive(pc('a', { conditions: ['Incapacitated'] })), /Incapacitated/);
  const s = table(pc('pc', { conditions: ['Prone'] }));
  s.updateToken('pc', { x: 128 });
  assert.deepEqual(s.state.tokens[0].conditions, [], 'standing is free when moving');
  // Knocked down and pushed in the same write: it stays Prone.
  const k = table(pc('pc'));
  k.updateToken('pc', { x: 192, conditions: ['Prone'] });
  assert.deepEqual(k.state.tokens[0].conditions, ['Prone']);
});

test('Weakened: the damage loses its flat modifiers, the dice are unaffected', () => {
  const faces = [5];
  const opts = { proficiency: 1, honed: 2, rollDie: () => faces[0], targetMajorThreshold: 5, targetSevereThreshold: 10, currentArmorSlots: 0 };
  assert.equal(resolveDamageExpression('1d8+3 Physical', opts).rawDamage, 10, '5 + 3 + Honed 2');
  const weak = resolveDamageExpression('1d8+3 Physical', { ...opts, honed: 0, noFlat: true });
  assert.equal(weak.rawDamage, 5); assert.equal(weak.flatModifier, 0);
  // A die rider (Sneak Attack) still counts: it arrives as a bonus.
  assert.equal(resolveDamageExpression('1d8+3 Physical', { ...opts, honed: 0, noFlat: true, bonus: 4 }).rawDamage, 9);
});
