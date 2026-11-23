import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATOR_DATA as data } from '../src/creator/creatorData.js';
import { setCardData } from '../src/cardData.js';
import { performGameAction } from '../src/gameActions.js';
import { characterCards, keeperCards, powerCard, adversaryAbilities, playCard } from '../src/loadoutCards.js';
import { resolutionLog, createResolution, adjudicateCard, requestCardChecks } from '../src/cardResolution.js';
import { printedChecks, printedPools } from '../src/cardProcedures.js';
import {beginCardSession,beginUnassignedArc,cardUse,resetCardUses} from '../src/cardLimits.js';
import { activePath } from '../src/statePowers.js';
import { getHoveredCondition, visibleConditions } from '../src/conditions.js';
import { nextSpotlightRound, combatTransition, checkEdge, disciplinedDefense, markMeleeDefense, requireActive } from '../src/combatState.js';
import { swarmTargets, hasSwarmTactics, bloodiedAttack } from '../src/adversaryPassives.js';
import { loadAdversaries } from '../scripts/adversary-library.mjs';
import { validEffectClocks } from '../src/effectClocks.js';
import { resolveDamageExpression } from '../src/equipment.js';
setCardData(data);
const scene = { id: 'deck', gridSize: 64, gridScaleMeters: 2, spotlightRound: 1 };
const actor = (id, patch = {}) => ({
  id, name: id, mapId: scene.id, x: 64, y: 64, size: 1, isPlayer: true, actorType: 'player', characterClass: 'Vanguard', subclass: 'Ghost Blade',
  path: 'Awakened', level: 5, proficiency: 2, hope: 6, effort: 6, traits: { agility: 2, strength: 1, knowledge: 1 }, conditions: [],
  hp: { current: 5, max: 6 }, stress: { current: 2, max: 6 }, armor: { current: 2, max: 3 }, resolve: { current: 2, max: 2, dieType: 'd4' },
  sheetFields: {}, ...patch });
const hostile = id => actor(id,{ isPlayer: false, actorType: 'adversary' });
function table(...tokens) {
  return { sessionRole: 'host', state: { campaignId: Math.random().toString(), activeMapId: scene.id, userRole: 'keeper', tokens, logs: [], fear: 0, clocks: [] },
    getActiveMap: () => scene, update(patch) { Object.assign(this.state,patch); },
    updateToken(id,patch) { this.state.tokens = this.state.tokens.map(t => t.id === id ? combatTransition(t,{...t,...patch},scene) : t); },
    addLog(log) { this.state.logs.unshift(log); }, addFear(n) { this.state.fear = Math.min(12,this.state.fear+n); },
    addClock(c) { this.state.clocks.push({ id:'project',...c }); return this.state.clocks.at(-1); } };
}
const get = (s,id) => s.state.tokens.find(t => t.id === id);
function play(s,id,name,extra={}) {
  const card = characterCards(get(s,id),data).find(c => c.name.toLowerCase() === name.toLowerCase());
  assert.ok(card,name);
  return performGameAction({ type:'CARD_PLAY',actorId:id,cardId:card.id,...extra },s);
}
const check = (s,id, options={}, extra={}) => performGameAction({ type:'CHECK',actorId:id,options:{ traitId:'agility',dc:10,forcedHope:8,forcedFear:2,forcedAdv:3,...options },...extra },s);

test('the caster chooses a Trait before paying, sees the state on the map and the reverse in hand, and can cash one hit only', () => {
  const s=table(actor('v'),hostile('e'));
  assert.throws(()=>play(s,'v','Path to Nirvana',{trait:'presence'}),/Elige/);
  assert.equal(get(s,'v').hope,6);
  play(s,'v','Path to Nirvana',{trait:'agility'});
  const v=get(s,'v'), clock=activePath(v);
  assert.equal(v.hope,3); assert.equal(clock.segments,6); assert.ok(validEffectClocks(v.effectClocks));
  assert.match(getHoveredCondition(v,{x:v.x+45,y:v.y},32).label,/agility/);
  const reverse=characterCards(v,data).find(c=>c.reverse);
  assert.equal(reverse.name,'Breaking Point'); assert.match(reverse.text,/after any multipliers/i);
  assert.throws(()=>performGameAction({type:'CONDITION',actorId:'v',name:'Stunned',active:true},s),/inmune/);
  assert.equal(check(s,'v',{traitId:'strength'}).advVal,0);
  assert.equal(check(s,'v',{hasDisadvantage:true}).advVal,0);
  const hit=check(s,'v',{}, {attack:true,targetId:'e'});
  assert.equal(hit.advVal,3); assert.equal(hit.damageRiders[0].branch,'Void'); assert.ok(activePath(get(s,'v')).firstStrikeUsed);
  const closing=play(s,'v','Breaking Point',{clockId:clock.id,checkId:hit.id});
  assert.deepEqual([closing.rider.dice,closing.rider.branch],['2d6','Void']); assert.equal(activePath(get(s,'v')),undefined);
  assert.throws(()=>performGameAction({type:'CARD_PLAY',actorId:'v',cardId:reverse.id,clockId:clock.id,checkId:hit.id},s));
  const result=resolveDamageExpression('1d4 Physical',{isCritical:true,rollDie:()=>2,bonusComponents:[{amount:7,types:['void']}]});
  assert.deepEqual(result.components.map(c=>c.amount),[4,7]);
});
test('closing declared before a miss ends the state and damage does not carry into a later action',()=>{
  const s=table(actor('v',{path:'Sleeping',subclass:'Kinetic Echo'}),hostile('e'),hostile('e2'));
  play(s,'v','The Refused Path',{trait:'strength'});
  const v=get(s,'v'),guard=disciplinedDefense(v,get(s,'e'),scene,s.state.tokens);
  assert.equal(guard.penalty,false);markMeleeDefense(s,v,guard);
  assert.equal(disciplinedDefense(get(s,'v'),get(s,'e2'),scene,s.state.tokens).penalty,true);
  const hit=check(s,'v',{dc:99},{attack:true,targetId:'e',closingId:activePath(v).id});
  assert.deepEqual(hit.damageRiders,[]);assert.equal(activePath(get(s,'v')),undefined);
});
const withPower=(name,id='caster')=>actor(id,{sheetFields:{a_pwr_1_n:name}});
test('a spell is linked to the persisted play; failing cannot apply the success effect and replay cannot charge or roll again',()=>{
  const s=table(withPower('Synaptic Disruption'),hostile('e'));
  const cast=play(s,'caster','Synaptic Disruption',{targetIds:['e']});
  assert.deepEqual(visibleConditions(get(s,'e')),[]);
  assert.throws(()=>check(s,'e',{traitId:'presence',dc:15},{cardPlayId:cast.id}),/pendiente/);
  check(s,'caster',{traitId:'presence',dc:15,forcedHope:3,forcedFear:2},{cardPlayId:cast.id});
  assert.deepEqual(visibleConditions(get(s,'e')),[]);
  assert.equal(resolutionLog(s,cast.id).resolution.phase,'ready');
  assert.throws(()=>check(s,'caster',{traitId:'presence',dc:15},{cardPlayId:cast.id}),/pendiente/);
  const second=play(s,'caster','Synaptic Disruption',{targetIds:['e']});
  check(s,'caster',{traitId:'presence',dc:15,forcedHope:11,forcedFear:6},{cardPlayId:second.id});
  assert.ok(visibleConditions(get(s,'e')).includes('Stunned'));assert.throws(()=>requireActive(get(s,'e')),/Stunned/);
  const saved=structuredClone(s.state);const resumed=table();resumed.state=saved;
  assert.equal(resolutionLog(resumed,second.id).resolution.total,17);
});
test('printed recipients, reach, healing, one-use trait penalties and mixed NPC/PC resource edits',()=>{
  const s=table(withPower('Spark of Hope'),actor('ally'));
  assert.throws(()=>play(s,'caster','Spark of Hope',{targetIds:['caster']}));assert.equal(get(s,'caster').hope,6);
  play(s,'caster','Spark of Hope',{targetIds:['ally']});assert.equal(get(s,'ally').stress.current,1);
  s.updateToken('caster',{sheetFields:{a_pwr_1_n:'Slipstream Jolt'}});
  play(s,'caster','Slipstream Jolt',{targetIds:['ally']});
  check(s,'ally',{traitId:'knowledge'});assert.ok(get(s,'ally').effectClocks.length);
  assert.equal(check(s,'ally').disadvVal,3);assert.equal(get(s,'ally').effectClocks.length,0);
  s.updateToken('caster',{sheetFields:{a_pwr_1_n:'Emergency Repair'}});s.updateToken('ally',{species:'Synthetic'});
  const before=get(s,'caster').stress.current;
  play(s,'caster','Emergency Repair',{targetIds:['ally'],effectFace:8});
  assert.equal(get(s,'ally').hp.current,6);assert.equal(get(s,'caster').stress.current,before);
});
test('target checks and Keeper decisions work for a printed ability and survive snapshots; only eligible roles resolve them',()=>{
  const s=table(actor('caster'),actor('ally'));
  const text='The target makes a Strength Reaction Roll, DC 15. On a failure, apply Prone.';
  const record=createResolution({name:'Reacción',text},get(s,'caster'),[get(s,'ally')],null,'play',scene.id);
  s.addLog({resolution:record});
  const [reaction]=printedChecks(record);
  requestCardChecks(s,record.id,['ally'],reaction);
  const reply=resolutionLog(s,'play').resolution.replies[0];
  assert.throws(()=>check(s,'caster',reaction,{cardPlayId:'play',cardReplyId:reply.id}));
  check(s,'ally',{...reaction,forcedHope:2,forcedFear:3},{cardPlayId:'play',cardReplyId:reply.id});
  const edit={operation:'apply',kind:'condition',condition:'Prone',ids:['ally']};
  s.sessionRole='player'; assert.throws(()=>adjudicateCard(s,'play',edit));
  s.sessionRole='host'; adjudicateCard(s,'play',edit);
  assert.ok(get(s,'ally').conditions.includes('Prone')); assert.throws(()=>adjudicateCard(s,'play',edit),/ya se aplicó/);
  adjudicateCard(s,'play',{operation:'finish'}); assert.throws(()=>adjudicateCard(s,'play',edit));
});
test('both printed Skitter profiles qualify at 3 HP, require two distinct targets in Close and line of effect, and do not give other swarms this ability',()=>{
  const books=loadAdversaries().filter(e=>/SKITTER-RAT SWARM/i.test(e.name)); assert.equal(books.length,2);
  for(const entry of books) {
    const swarm={...hostile('h'),featureNotes:entry.text,hp:{current:3,max:6}};
    const tokens=[swarm,actor('a'),actor('b',{x:300}),actor('far',{x:1200})];
    assert.ok(keeperCards(swarm).find(c=>c.swarm)?.playable);
    assert.equal(swarmTargets(swarm,scene,tokens,['a','b']).length,2);
    for(const ids of [['a','a'],['h','a'],['a','far']])assert.throws(()=>swarmTargets(swarm,scene,tokens,ids));
    assert.throws(()=>swarmTargets(swarm,{...scene,walls:[{x1:200,x2:200,y1:0,y2:200}]},tokens,['a','b']));
    swarm.hp.current=2;assert.throws(()=>swarmTargets(swarm,scene,tokens,['a','b']));
  }
  assert.equal(hasSwarmTactics({...hostile('h'),name:'Swarm',featureNotes:'Unrelated Swarm'}),false);
  const stalker=loadAdversaries().find(e=>e.text.includes('Territorial Rage') && e.name.includes('APEX'));
  assert.equal(bloodiedAttack({...hostile('x'),featureNotes:stalker.text,hp:{current:2,max:6}}).attack,2);
});

test('Bear Down promotes an Uncanny Power once and only spends Resolve while the card is open', () => {
  const mystic = actor('mystic', { path: 'Sleeping', characterClass: 'Mystic', sheetFields: { s_archive: 'Neural 2' }, resolve: { current: 4, max: 4, dieType: 'd4' } });
  const s = table(mystic, hostile('foe'));
  performGameAction({ type: 'UNCANNY_ACCESS', actorId: 'mystic', resolveSpent: 1, faces: [4] }, s);
  const cast = play(s, 'mystic', 'Synaptic Disruption', { targetIds: ['foe'] });
  const roll = check(s, 'mystic', { ...cast.roll, forcedHope: 5, forcedFear: 4 }, { cardPlayId: cast.id });
  const useResolve = () => performGameAction({ type: 'RESOLVE', actorId: 'mystic', count: 1, faces: [2] }, s);
  assert.equal(roll.total, 10);
  assert.deepEqual(visibleConditions(get(s, 'foe')), []);
  assert.equal(useResolve().total, 12);
  assert.equal(resolutionLog(s, cast.id).resolution.outcome, 'SUCCESS WITH HOPE');
  assert.ok(visibleConditions(get(s, 'foe')).includes('Stunned'));
  const clock = structuredClone(get(s, 'foe').effectClocks);
  assert.equal(useResolve().total, 14);
  assert.deepEqual(get(s, 'foe').effectClocks, clock);
  assert.equal(resolutionLog(s, cast.id).resolution.total, 14);
  adjudicateCard(s, cast.id, { operation: 'finish' });
  assert.throws(useResolve, /Bear Down/);
  assert.equal(get(s, 'mystic').resolve.current, 1);
});

test('Bear Down preserves other requested rolls and only revises the responder’s own result', () => {
  const s = table(actor('caster'), actor('a', { path: 'Sleeping' }), actor('b', { path: 'Sleeping' }));
  const record = createResolution({name:'Reacción',text:'DC 12 (Strength)'}, get(s,'caster'), [], null, 'reaction', scene.id);
  s.addLog({ resolution: record });
  const [rule] = printedChecks(record);
  requestCardChecks(s, record.id, ['a','b'], rule);
  const replies = () => resolutionLog(s, record.id).resolution.replies;
  const [a,b] = replies();
  check(s,'a',{...rule,forcedHope:6,forcedFear:3},{cardPlayId:record.id,cardReplyId:a.id});
  check(s,'b',{...rule,forcedHope:9,forcedFear:4},{cardPlayId:record.id,cardReplyId:b.id});
  const other = structuredClone(replies()[1]);
  performGameAction({type:'RESOLVE',actorId:'a',count:1,faces:[3]},s);
  assert.equal(replies()[0].outcome,'SUCCESS WITH HOPE'); assert.equal(replies()[0].total,13);
  assert.deepEqual(replies()[1],other);
  assert.equal(resolutionLog(s,record.id).resolution.outcome,undefined);
});

test('converting a failed spell restores only its extra Fear and respects the shared cap', () => {
  for (const initial of [4,10,11,12]) {
    const s = table(actor('mystic',{path:'Sleeping',characterClass:'Mystic',sheetFields:{s_archive:'Tech 1'}}));
    performGameAction({type:'UNCANNY_ACCESS',actorId:'mystic',resolveSpent:1,faces:[2]},s);
    const cast = play(s,'mystic','Drone Whisper');
    s.state.fear = initial;
    check(s,'mystic',{...cast.roll,forcedHope:3,forcedFear:5},{cardPlayId:cast.id});
    assert.equal(s.state.fear,Math.min(12,initial+2));
    performGameAction({type:'RESOLVE',actorId:'mystic',faces:[3]},s);
    assert.equal(s.state.fear,Math.min(12,initial+1));
    assert.equal(resolutionLog(s,cast.id).resolution.outcome,'SUCCESS WITH FEAR');
  }
});

test('unassigned arc uses can be renewed after the resolution is finished or its record cleared', () => {
  const name = 'Megascale Fabrication', s = table(withPower(name), actor('other'));
  const cast = play(s, 'caster', name);
  check(s, 'caster', {...cast.roll,forcedHope:8,forcedFear:4}, {cardPlayId:cast.id});
  adjudicateCard(s, cast.id, {operation:'finish'});
  const use = resolutionLog(s,cast.id).resolution.limit;
  assert.ok(get(s,'caster').cardUses[use.key]);
  adjudicateCard(s, cast.id, {operation:'renew-arc'});
  assert.deepEqual(get(s,'caster').cardUses,{});
  const namedKey = JSON.stringify(['story arc','chapter-2',name]);
  const campaignKey = JSON.stringify(['campaign','campaign',name]);
  for (const id of ['caster','other']) s.updateToken(id,{cardUses:{[use.key]:'story arc',[namedKey]:'story arc',[campaignKey]:'campaign'}});
  s.state.logs = [];
  s.sessionRole = 'player'; assert.throws(()=>beginUnassignedArc(s));
  s.sessionRole = 'host'; s.state.arcs = [{id:'chapter-2',sceneIds:[scene.id]}];
  assert.throws(()=>beginUnassignedArc(s));
  s.state.arcs = [];
  beginUnassignedArc(s);
  for (const token of s.state.tokens) assert.deepEqual(token.cardUses,{[namedKey]:'story arc',[campaignKey]:'campaign'});
});
test('every Domain power, project, Resolve move and published bestiary profile reaches a table procedure',()=>{
  assert.equal(data.powers.length,147);assert.equal(data.resolveMoves.length,42);
  for(const p of data.powers){const c=powerCard(p,'loadout');assert.ok(c.playable,c.name);const r=createResolution(c,actor('pc'),[],c.roll,'x',scene.id);assert.equal(r.text,c.text,c.name);assert.ok(Array.isArray(printedPools(r,actor('pc'))));}
  for(const m of data.resolveMoves) {const c=characterCards(actor('pc',{path:'Sleeping',characterClass:m.class,subclass:m.subclass,sheetFields:{s_learned_moves:m.name}}),data).find(c=>c.name===m.name);assert.ok(c?.playable,m.name);}
  for(const profile of loadAdversaries())assert.ok(adversaryAbilities(profile.text).length,profile.name);
  const s=table(withPower('Invention Protocol'));const p=play(s,'caster','Invention Protocol');
  assert.equal(resolutionLog(s,p.id).resolution.project,6);assert.equal(s.state.clocks[0].segments,6);
  const mythic=powerCard(data.powers.find(p=>p.n==='Pulse of Genesis'),'loadout');
  assert.equal(playCard(actor('a'),mythic).token.hope,0);assert.throws(()=>playCard(actor('a',{hope:4}),mythic));
});

test('printed frequency survives reconnection and resets only for the scope that has actually ended',()=>{
  const cards=data.powers.map(p=>powerCard(p,'loadout'));
  assert.equal(cards.filter(c=>cardUse(c,{})).length,51);
  const card=cards.find(c=>cardUse(c,{})?.scope==='session' && c.cost.stress<=2 && c.cost.hope<=4);
  const s=table(withPower(card.name));
  play(s,'caster',card.name);
  const resumed=table();resumed.state=structuredClone(s.state);
  assert.throws(()=>play(resumed,'caster',card.name),/ya está gastado/);
  const actor=get(resumed,'caster');
  assert.deepEqual(resetCardUses(actor,'long rest'),{});
  beginCardSession(resumed);
  assert.deepEqual(get(resumed,'caster').cardUses,{});
  const arcCard=cards.find(c=>cardUse(c,{})?.scope==='story arc');
  assert.notEqual(cardUse(arcCard,{activeMapId:'m',arcs:[{id:'A',sceneIds:['m']}]}).key,cardUse(arcCard,{activeMapId:'m',arcs:[{id:'B',sceneIds:['m']}]}).key);
});
test('field-wide rolls use the correct side and expire together at the round boundary',()=>{
  const s=table(withPower('Global Stimulus Field'),actor('ally'),hostile('foe'));s.state.maps=[scene];
  const cast=play(s,'caster','Global Stimulus Field');
  check(s,'caster',{traitId:'presence',dc:30,forcedHope:10,forcedFear:10},{cardPlayId:cast.id});
  assert.equal(checkEdge(get(s,'ally')).advantage,true);
  assert.equal(checkEdge(get(s,'foe')).disadvantage,true);
  assert.equal(get(s,'ally').hp.current,6);assert.equal(get(s,'ally').stress.current,1);
  nextSpotlightRound(s);
  assert.equal(checkEdge(get(s,'ally')).advantage,false);assert.equal(checkEdge(get(s,'foe')).disadvantage,false);
});

test('Uncanny Power at the table: access first (Resolve Dice + Knowledge, Fear), then any Archive Power at or below it, then Knowledge vs 10 + level; a Critical returns the Resolve', () => {
  const mystic = actor('mystic', { path: 'Sleeping', characterClass: 'Mystic', subclass: 'Mind-Touched', level: 3, sheetFields: { s_archive: 'Neural 1, Neural 2, Void 3' }, resolve: { current: 4, max: 4, dieType: 'd4' } });
  const s = table(mystic, hostile('foe'));
  s.state.fear = 0;
  // No access open: the Archive card cannot be cast on its own.
  assert.throws(() => play(s, 'mystic', 'Synaptic Disruption', { targetIds: ['foe'] }), /Primero tira el acceso/);
  // 1 Resolve: d4 [1] + Knowledge 1 = 2 → level 2 reachable, 1 Fear.
  const access = performGameAction({ type: 'UNCANNY_ACCESS', actorId: 'mystic', resolveSpent: 1, faces: [1] }, s);
  assert.deepEqual([access.access, s.state.fear, get(s, 'mystic').resolve.current], [2, 1, 3]);
  assert.deepEqual(get(s, 'mystic').uncanny, { access: 2, spent: 1 });
  const cards = characterCards(get(s, 'mystic'), data);
  assert.ok(access.choices.length && access.choices.every(id => cards.find(c => c.id === id).level <= 2));
  assert.throws(() => performGameAction({ type: 'UNCANNY_ACCESS', actorId: 'mystic', resolveSpent: 1 }, s), /acceso abierto/);
  // A level 3 Power is out of reach; a level 2 one is cast with Knowledge vs DC 12, without new Resolve.
  const high = cards.find(c => c.kind === 'archive' && c.level === 3 && c.playable);
  assert.throws(() => performGameAction({ type: 'CARD_PLAY', actorId: 'mystic', cardId: high.id }, s), /tu acceso llega a 2/);
  const cast = play(s, 'mystic', 'Synaptic Disruption', { targetIds: ['foe'] });
  assert.deepEqual(cast.roll, { dc: 12, traitId: 'knowledge' });
  assert.equal(get(s, 'mystic').uncanny, null);
  assert.equal(get(s, 'mystic').resolve.current, 3);
  check(s, 'mystic', { ...cast.roll, forcedHope: 5, forcedFear: 5 }, { cardPlayId: cast.id });
  assert.equal(get(s, 'mystic').resolve.current, 4, 'the Critical returns the Resolve spent; the Fear stays');
  assert.equal(s.state.fear, 1);
  // Giving up an open access refunds nothing.
  performGameAction({ type: 'UNCANNY_ACCESS', actorId: 'mystic', resolveSpent: 2, faces: [4, 4] }, s);
  assert.equal(get(s, 'mystic').uncanny.access, 3, 'capped by the character level');
  performGameAction({ type: 'UNCANNY_ACCESS', actorId: 'mystic', cancel: true }, s);
  assert.deepEqual([get(s, 'mystic').uncanny, get(s, 'mystic').resolve.current, s.state.fear], [null, 2, 3]);
  // The Uncanny Power Move card opens this procedure; it is not played as a plain Move.
  const move = characterCards(get(s, 'mystic'), data).find(c => c.uncanny);
  assert.ok(move);
  assert.throws(() => performGameAction({ type: 'CARD_PLAY', actorId: 'mystic', cardId: move.id }, s), /ventana/);
});

test('an area Power around the caster: everyone inside rolls the printed Reaction and failing applies its consequence', () => {
  const far = { ...hostile('far'), x: 64 + 64 * 9 }, near = { ...hostile('near'), x: 64 + 64 * 3 }, ally = { ...actor('ally'), x: 64, y: 64 + 64 * 2 };
  const s = table(withPower('Blinding Flash'), near, far, ally);
  const cast = play(s, 'caster', 'Blinding Flash');
  const record = resolutionLog(s, cast.id).resolution;
  assert.deepEqual(record.targetIds, ['near'], 'only the enemies within Close range');
  assert.equal(record.area.reach, 'Close');
  assert.ok(record.area.radius > 64 * 5);
  assert.deepEqual(record.replies.map(r => [r.actorId, r.traitId, r.dc]), [['near', 'instinct', 10]]);
  // The enemy fails its Instinct Reaction Roll (DC 10): Disadvantage on its next attack.
  const reply = record.replies[0];
  check(s, 'near', { traitId: 'instinct', dc: 10, forcedD20: 2 }, { cardPlayId: cast.id, cardReplyId: reply.id });
  const after = resolutionLog(s, cast.id).resolution.replies[0];
  assert.match(after.consequence, /Desventaja en su próximo ataque/);
  const mark = get(s, 'near').effectClocks.find(c => c.nextAttack);
  assert.equal(mark.edge, 'disadvantage');
  assert.equal(checkEdge(get(s, 'near'), get(s, 'caster')).disadvantage, true, 'its next attack');
  assert.equal(checkEdge(get(s, 'near'), null, false, false, 'instinct').disadvantage, false, 'not other rolls');
});

test('Temporal Cloak · Personal hides its caster until it attacks; the Vehicle mode stays with the table', () => {
  const s = table(withPower('Temporal Cloak'), hostile('e'));
  play(s, 'caster', 'Temporal Cloak', { mode: 'Personal' });
  assert.ok(get(s, 'caster').conditions.includes('Hidden'));
  assert.ok(get(s, 'caster').effectClocks.some(c => c.name === 'Temporal Cloak'));
  check(s, 'caster', { traitId: 'agility', dc: 10 }, { targetId: 'e', attack: true });
  assert.equal(get(s, 'caster').conditions.includes('Hidden'), false, 'attacking ends it');
  assert.equal(get(s, 'caster').effectClocks.some(c => c.name === 'Temporal Cloak'), false);
  const v = table(withPower('Temporal Cloak'));
  const ship = play(v, 'caster', 'Temporal Cloak', { mode: 'Vehículo' });
  assert.equal(get(v, 'caster').conditions.includes('Hidden'), false);
  assert.match(ship.notes.join(' '), /lo resuelve la mesa/);
});

test('Kinetic Blast arms the next melee attack: Strength + 1d8, and Empower adds (Proficiency)d6 per extra Hope', () => {
  const s = table(withPower('Kinetic Blast'), { ...hostile('e'), x: 128 });
  play(s, 'caster', 'Kinetic Blast', { empower: 2 });
  assert.equal(get(s, 'caster').hope, 3, '1 Hope + 2 to Empower');
  assert.equal(get(s, 'caster').effectClocks.find(c => c.name === 'Kinetic Blast').empower, 2);
  const hit = check(s, 'caster', { traitId: 'agility', dc: 5 }, { targetId: 'e', attack: true });
  assert.deepEqual(hit.damageRiders.map(r => [r.id, r.dice || r.value]), [['kinetic-blast', '1d8'], ['kinetic-blast-strength', 1], ['kinetic-empower-0', '2d6'], ['kinetic-empower-1', '2d6']]);
  assert.equal(get(s, 'caster').effectClocks.some(c => c.name === 'Kinetic Blast'), false, 'spent by the attack');
  assert.throws(() => play(table({ ...withPower('Kinetic Blast'), hope: 1 }), 'caster', 'Kinetic Blast', { empower: 1 }), /Empower/);
});

test('Biological Scan reads its target at once; Inspiring Presence gives +2 to the next roll of the allies in Close range; Stellar Lance needs a target in Far range', () => {
  const s = table(withPower('Biological Scan'), { ...hostile('e'), x: 128, hp: { current: 3, max: 6 }, conditions: ['Restrained'] });
  const scan = play(s, 'caster', 'Biological Scan', { targetIds: ['e'] });
  assert.match(scan.notes.join(' '), /e: HP 3 \/ 6 .*Restrained/);
  const t = table(withPower('Inspiring Presence'), { ...actor('ally'), x: 64 + 64 * 3 }, { ...actor('away'), x: 64 + 64 * 12 });
  play(t, 'caster', 'Inspiring Presence');
  assert.deepEqual([get(t, 'ally').pendingCheckBonus, get(t, 'away').pendingCheckBonus], [2, undefined]);
  const l = table(withPower('Stellar Lance'), { ...hostile('e'), x: 64 + 64 * 8 });
  assert.throws(() => play(l, 'caster', 'Stellar Lance'), /objetivo/);
  const lance = play(l, 'caster', 'Stellar Lance', { targetIds: ['e'] });
  assert.deepEqual(lance.roll, { dc: 15, traitId: 'presence' });
});

test('reaction Powers: who can use them, what they take off the damage and what they leave', async () => {
  const { reactorsFor, damageReactions, reduceComponents } = await import('../src/powerReactions.js');
  const hero = { ...actor('hero'), sheetFields: { a_pwr_1_n: 'Impact Absorption', a_pwr_2_n: 'Mind Shield' }, stress: { current: 0, max: 6 } };
  const medic = { ...actor('medic'), x: 64 + 64 * 4, level: 5, sheetFields: { a_pwr_1_n: 'Photon Shield', a_pwr_2_n: 'Force Shield', a_pwr_3_n: 'Tactical Overwatch' } };
  const far = { ...actor('far'), x: 64 + 64 * 20, sheetFields: { a_pwr_1_n: 'Photon Shield' } };
  const foe = { ...hostile('foe'), featureNotes: 'Veil-Touched horror' };
  const tokens = [hero, medic, far, foe];
  setCardData(data);
  assert.deepEqual(reactorsFor('Photon Shield', hero, tokens, scene, data).map(t => t.id), ['medic'], 'an ally in Close range, not the far one');
  assert.deepEqual(reactorsFor('Impact Absorption', hero, tokens, scene, data).map(t => t.id), ['hero'], 'only the one hit');
  assert.deepEqual(reactorsFor('Force Shield', hero, tokens, scene, data).map(t => t.id), [], 'Force Shield needs Very Close');
  assert.deepEqual(reactorsFor('Photon Shield', foe, tokens, scene, data), [], 'never for the enemies');
  assert.deepEqual(reactorsFor('Mind Shield', { ...hero, stress: { current: 6, max: 6 } }, tokens.map(t => t.id === 'hero' ? { ...t, stress: { current: 6, max: 6 } } : t), scene, data), [], 'Overwhelmed cannot pay Stress');
  const physical = [{ amount: 9, types: ['physical', 'kinetic'] }, { amount: 4, types: ['neural'] }];
  const found = damageReactions({ target: hero, attacker: foe, components: physical, tokens, map: scene, data, random: () => 0.5 });
  const photon = found.find(r => r.name === 'Photon Shield'), impact = found.find(r => r.name === 'Impact Absorption'), mind = found.find(r => r.name === 'Mind Shield');
  assert.equal(photon.amount, 8, 'Tier 2 + 2, doubled against a Veil-Touched creature');
  assert.equal(impact.amount, 2 * 4 + 2, '(Proficiency 2)d6 + 2');
  assert.equal(mind.amount, 8);
  assert.deepEqual(reduceComponents(physical, impact.amount, impact.types).map(p => p.amount), [0, 4], 'Impact Absorption only touches Physical');
  assert.deepEqual(reduceComponents(physical, mind.amount, mind.types).map(p => p.amount), [9, 0]);
  assert.deepEqual(reduceComponents(physical, 11).map(p => p.amount), [0, 2]);
  assert.equal(damageReactions({ target: hero, attacker: foe, components: [{ amount: 5, types: ['energy'] }], tokens, map: scene, data }).some(r => r.name !== 'Photon Shield'), false, 'no Physical or Neural, no Impact Absorption or Mind Shield');
});

test('paying a reaction: Impact Absorption keeps the amount for the next attack; Tactical Overwatch lends 2 Armor Slots', () => {
  const s = table({ ...actor('hero'), sheetFields: { a_pwr_1_n: 'Impact Absorption' }, stress: { current: 0, max: 6 } }, { ...actor('medic'), x: 128, hope: 3, sheetFields: { a_pwr_1_n: 'Tactical Overwatch' } }, { ...hostile('foe'), x: 160 });
  performGameAction({ type: 'REACTION_PAY', actorId: 'hero', name: 'Impact Absorption', amount: 7 }, s);
  assert.equal(get(s, 'hero').stress.current, 1);
  assert.equal(get(s, 'hero').effectClocks.find(c => c.name === 'Impact Absorption').absorbed, 7);
  const hit = check(s, 'hero', { traitId: 'agility', dc: 5 }, { targetId: 'foe', attack: true });
  assert.ok(hit.damageRiders.some(r => r.id === 'impact-absorption' && r.value === 7));
  assert.equal(get(s, 'hero').effectClocks.some(c => c.name === 'Impact Absorption'), false);
  performGameAction({ type: 'REACTION_PAY', actorId: 'medic', name: 'Tactical Overwatch', targetId: 'hero' }, s);
  assert.equal(get(s, 'medic').hope, 2);
  assert.deepEqual([get(s, 'hero').armor.current, get(s, 'hero').armor.max], [4, 5]);
  assert.equal(get(s, 'hero').effectClocks.find(c => c.tempArmor).sourceId, 'medic');
  assert.throws(() => performGameAction({ type: 'REACTION_PAY', actorId: 'hero', name: 'Photon Shield' }, s), /no está en el Loadout/);
});

test('Powers in effect do the sums: Kinetic Barrier, Velocity Surge, Aura of Clarity, Protective Dome and the next-roll Powers', async () => {
  const { droneEvasion } = await import('../src/drones.js');
  const { damageProtection } = await import('../src/damageProtection.js');
  const { damageReactions } = await import('../src/powerReactions.js');
  const { pathImmune } = await import('../src/statePowers.js');
  // Kinetic Barrier: +1 Evasion, Resistance to Physical, absorbs up to 10 and dissipates.
  const s = table({ ...withPower('Kinetic Barrier'), evasion: 10 }, hostile('foe'));
  play(s, 'caster', 'Kinetic Barrier');
  assert.equal(droneEvasion(get(s, 'caster')), 11);
  assert.equal(damageProtection(get(s, 'caster'), new Set(['physical'])), 'resistant');
  const [wall] = damageReactions({ target: get(s, 'caster'), attacker: get(s, 'foe'), components: [{ amount: 6, types: ['physical'] }], tokens: s.state.tokens, map: scene, data });
  assert.deepEqual([wall.name, wall.amount, wall.free], ['Kinetic Barrier', 6, true]);
  performGameAction({ type: 'REACTION_PAY', actorId: 'caster', name: 'Kinetic Barrier', amount: 6 }, s);
  assert.equal(get(s, 'caster').effectClocks.find(c => c.name === 'Kinetic Barrier').absorbed, 4);
  performGameAction({ type: 'REACTION_PAY', actorId: 'caster', name: 'Kinetic Barrier', amount: 9 }, s);
  assert.equal(droneEvasion(get(s, 'caster')), 10, 'spent: it dissipates');
  // Velocity Surge: +2 on Agility Rolls once cast.
  const v = table(withPower('Velocity Surge'));
  const cast = play(v, 'caster', 'Velocity Surge');
  check(v, 'caster', { ...cast.roll, forcedHope: 9, forcedFear: 4 }, { cardPlayId: cast.id });
  const surge = check(v, 'caster', { traitId: 'agility', dc: 10, forcedHope: 5, forcedFear: 3 });
  assert.equal(surge.total, 5 + 3 + 2 + 2, 'Agility 2 + Velocity Surge 2');
  // Aura of Clarity: you and allies in Close: thresholds +1, immune to Frightened and Dazed.
  const a = table(withPower('Aura of Clarity'), { ...actor('ally'), x: 64 + 64 * 3 });
  const aura = play(a, 'caster', 'Aura of Clarity');
  check(a, 'caster', { ...aura.roll, traitId: 'presence', forcedHope: 10, forcedFear: 6 }, { cardPlayId: aura.id });
  assert.equal(pathImmune(get(a, 'ally'), 'Dazed'), true);
  assert.equal(pathImmune(get(a, 'ally'), 'Restrained'), false);
  const { thresholdBonus } = await import('../src/powerEffects.js');
  assert.deepEqual([thresholdBonus(get(a, 'caster')), thresholdBonus(get(a, 'ally'))], [1, 1]);
  // Protective Dome: everyone in the Very Close zone +2 Evasion.
  const d = table({ ...withPower('Protective Dome'), evasion: 10 }, { ...actor('ally'), x: 128, evasion: 9 }, { ...actor('out'), x: 64 + 64 * 6, evasion: 9 });
  const dome = play(d, 'caster', 'Protective Dome');
  check(d, 'caster', { ...dome.roll, forcedHope: 10, forcedFear: 6 }, { cardPlayId: dome.id });
  assert.deepEqual(['caster', 'ally', 'out'].map(id => droneEvasion(get(d, id))), [12, 11, 9]);
  // Silver Tongue: the next Presence Roll adds the Tier and a Hope 11 counts as 12 (a match).
  const t = table({ ...withPower('Silver Tongue'), traits: { presence: 1 } });
  play(t, 'caster', 'Silver Tongue');
  const talk = check(t, 'caster', { traitId: 'presence', dc: 15, forcedHope: 11, forcedFear: 12 });
  assert.equal(talk.isCritical, true);
  assert.equal(get(t, 'caster').effectClocks.some(c => c.name === 'Silver Tongue'), false, 'spent by that roll');
  // Vector Calculus: Agility + Level, Hope 10 or lower counts as 11.
  const n = table(withPower('Vector Calculus'));
  play(n, 'caster', 'Vector Calculus');
  const pilot = check(n, 'caster', { traitId: 'agility', dc: 15, forcedHope: 3, forcedFear: 4 });
  assert.equal(pilot.total, 11 + 4 + 2 + 5, 'Hope 3 → 11, Agility 2, Level 5');
  // Eyes of Truth: Advantage on Instinct to perceive for the scene.
  const { contextualEdges } = await import('../src/statePowers.js');
  const e = table(withPower('Eyes of Truth'));
  play(e, 'caster', 'Eyes of Truth');
  assert.equal(contextualEdges(get(e, 'caster'), 'instinct').length, 1);
});

test('Mind-Slip modes: Stagger leaves an NPC Prone, Compel asks a Presence Reaction (DC 15), Field of Hesitation marks its zone', () => {
  const s = table(withPower('Mind-Slip'), { ...hostile('foe'), x: 128 });
  const stagger = play(s, 'caster', 'Mind-Slip', { targetIds: ['foe'], mode: 'Stagger' });
  check(s, 'caster', { ...stagger.roll, forcedHope: 10, forcedFear: 6 }, { cardPlayId: stagger.id });
  assert.ok(get(s, 'foe').conditions.includes('Prone'));
  const c = table({ ...withPower('Mind-Slip'), hope: 6 }, { ...hostile('foe'), x: 128 });
  const compel = play(c, 'caster', 'Mind-Slip', { targetIds: ['foe'], mode: 'Compel' });
  check(c, 'caster', { ...compel.roll, forcedHope: 10, forcedFear: 6 }, { cardPlayId: compel.id });
  const [reply] = resolutionLog(c, compel.id).resolution.replies;
  assert.deepEqual([reply.actorId, reply.traitId, reply.dc], ['foe', 'presence', 15]);
  check(c, 'foe', { traitId: 'presence', dc: 15, forcedD20: 2 }, { cardPlayId: compel.id, cardReplyId: reply.id });
  assert.match(resolutionLog(c, compel.id).resolution.replies[0].consequence, /muévelo una banda/);
  const f = table(withPower('Mind-Slip'));
  const field = play(f, 'caster', 'Mind-Slip', { mode: 'Field of Hesitation' });
  check(f, 'caster', { ...field.roll, forcedHope: 10, forcedFear: 6 }, { cardPlayId: field.id });
  assert.equal(resolutionLog(f, field.id).resolution.area.reach, 'Very Close');
});

test('Flux Field and Telekinetic Grasp leave an action while they last', () => {
  const s = table({ ...withPower('Flux Field'), stress: { current: 0, max: 6 } }, { ...actor('ally'), x: 128 }, { ...hostile('foe'), x: 192 });
  const cast = play(s, 'caster', 'Flux Field', { mode: 'Unlucky Enemies' });
  check(s, 'caster', { ...cast.roll, traitId: 'instinct', forcedHope: 10, forcedFear: 6 }, { cardPlayId: cast.id });
  assert.deepEqual(get(s, 'caster').effectClocks.find(c => c.name === 'Flux Field').modes, ['Lucky Streak', 'Unlucky Enemies'], 'with Hope: both modes');
  performGameAction({ type: 'POWER_USE', actorId: 'caster', name: 'Flux Field', mode: 'Lucky Streak', targetId: 'ally' }, s);
  assert.equal(get(s, 'ally').pendingAdvantage, true);
  assert.throws(() => performGameAction({ type: 'POWER_USE', actorId: 'caster', name: 'Flux Field', mode: 'Unlucky Enemies', targetId: 'foe' }, s), /esta ronda/);
  const t = table(withPower('Telekinetic Grasp'), { ...hostile('foe'), x: 64 + 64 * 8 });
  assert.throws(() => performGameAction({ type: 'POWER_USE', actorId: 'caster', name: 'Telekinetic Grasp', targetId: 'foe' }, t), /no está activo/);
  const grasp = play(t, 'caster', 'Telekinetic Grasp');
  check(t, 'caster', { ...grasp.roll, forcedHope: 8, forcedFear: 4 }, { cardPlayId: grasp.id });
  const hurl = performGameAction({ type: 'POWER_USE', actorId: 'caster', name: 'Telekinetic Grasp', targetId: 'foe' }, t);
  assert.deepEqual(hurl.damage, { formula: '2d6', type: 'void' });
});

test('Lucky Break rerolls a die of the latest roll: the outcome, the Hope and the Keeper Fear follow the new die', () => {
  const s = table({ ...withPower('Lucky Break'), hope: 2, stress: { current: 0, max: 6 } });
  const roll = check(s, 'caster', { traitId: 'agility', dc: 15, forcedHope: 3, forcedFear: 9 });
  assert.equal(roll.dominance, 'Fear'); assert.equal(s.state.fear, 1); assert.equal(get(s, 'caster').hope, 2);
  const lucky = performGameAction({ type: 'LUCKY_BREAK', actorId: 'caster', die: 'hope', face: 11 }, s);
  assert.deepEqual([lucky.hopeVal, lucky.total, lucky.dominance, lucky.resultType], [11, 22, 'Hope', 'SUCCESS_WITH_HOPE']);
  assert.deepEqual([get(s, 'caster').hope, get(s, 'caster').stress.current, s.state.fear], [3, 1, 0]);
  assert.throws(() => performGameAction({ type: 'LUCKY_BREAK', actorId: 'caster', die: 'fear', face: 2 }, s), /ya se relanzó/);
});

test('a Power through the operated drone: only those that work through a drone, measured from the drone; taking the drone gives the Spotlight', async () => {
  const { droneCompatible } = await import('../src/dronePowers.js');
  const card = name => characterCards(withPower(name), data).find(c => c.name === name);
  assert.equal(droneCompatible(card('Stellar Lance')), true);
  assert.equal(droneCompatible(card('Kinetic Blast')), false, 'a melee strike needs the body');
  assert.equal(droneCompatible(card('Blinding Flash')), false, 'an aura centred on the character');
  const drone = { ...actor('dr'), actorType: 'drone', isPlayer: false, x: 64 + 64 * 12, drone: { grade: 'common', modules: ['neural-network-control'], signal: 'stable', operatorId: 'caster' } };
  const foe = { ...hostile('foe'), x: 64 + 64 * 14 };
  const s = table({ ...withPower('Slipstream Jolt'), hasSpotlight: false }, drone, foe);
  s.setTokenSpotlight = (id, on) => s.updateToken(id, { hasSpotlight: on });
  // From the caster, the foe is far beyond Close; from the drone, two squares away.
  assert.throws(() => play(s, 'caster', 'Slipstream Jolt', { targetIds: ['foe'] }), /Close/);
  const jolt = play(s, 'caster', 'Slipstream Jolt', { targetIds: ['foe'], viaDroneId: 'dr' });
  assert.match(jolt.notes.join(' '), /A través de dr/);
  assert.ok(get(s, 'foe').effectClocks.some(c => c.name === 'Slipstream Jolt'));
  const t = table(withPower('Kinetic Blast'), drone);
  assert.throws(() => play(t, 'caster', 'Kinetic Blast', { viaDroneId: 'dr' }), /no puede usarse a través de un dron/);
  // Neural Network Control: a registered crew member takes the drone and its Spotlight.
  const n = table({ ...actor('pilot'), hasSpotlight: false }, { ...drone, drone: { ...drone.drone, operatorId: 'other' } });
  n.setTokenSpotlight = (id, on) => n.updateToken(id, { hasSpotlight: on });
  performGameAction({ type: 'DRONE_HANDOFF', actorId: 'dr', operatorId: 'pilot' }, n);
  assert.equal(get(n, 'dr').drone.operatorId, 'pilot');
  assert.equal(get(n, 'pilot').hasSpotlight, true);
});

test('Rapid Regeneration is a Reaction and also an ordinary Power on a target, also through Uncanny Power', async () => {
  const { reactorsFor } = await import('../src/powerReactions.js');
  const mystic = actor('mystic', { path: 'Sleeping', characterClass: 'Mystic', sheetFields: { s_archive: 'Synthesis 1' } });
  assert.equal(characterCards(mystic, data).find(c => c.name === 'Rapid Regeneration').playable, true);
  const medic = { ...withPower('Rapid Regeneration', 'medic'), x: 128 }, hurt = actor('hurt');
  assert.deepEqual(reactorsFor('Rapid Regeneration', hurt, [medic, hurt], scene, data).map(t => t.id), ['medic']);
  const s = table(medic, { ...hurt, hp: { current: 3, max: 6 } });
  play(s, 'medic', 'Rapid Regeneration', { targetIds: ['hurt'], durationFaces: [2] });
  assert.equal(get(s, 'hurt').hp.current, 4, 'played on a target: +1 HP at once');
});

test('Blinding Flash lights up for the characters in Close range of the enemy that attacks', async () => {
  const { reactorsFor } = await import('../src/powerReactions.js');
  const near = { ...withPower('Blinding Flash', 'near'), x: 128 }, far = { ...withPower('Blinding Flash', 'far'), x: 64 + 64 * 20 };
  const foe = { ...hostile('foe'), x: 192 };
  assert.deepEqual(reactorsFor('Blinding Flash', foe, [near, far, foe], scene, data).map(t => t.id), ['near']);
  assert.deepEqual(reactorsFor('Blinding Flash', near, [near, far, foe], scene, data), [], 'only against an enemy');
  assert.deepEqual(reactorsFor('Blinding Flash', foe, [{ ...near, hope: 0 }, foe], scene, data), [], 'it costs 1 Hope');
});

test('the Special state: free text put by a Power (at once, on a success or on whoever fails) and by hand', async () => {
  const { specialState, conditionDefinition, isSpecial } = await import('../src/conditions.js');
  assert.equal(specialState('  Marcado   por la lanza '), 'Special: Marcado por la lanza');
  assert.equal(specialState('special: ya escrito'), 'Special: ya escrito');
  assert.equal(specialState('   '), '');
  assert.equal(specialState('x'.repeat(200)).length, 'Special: '.length + 80);
  assert.equal(conditionDefinition('Special: Marcado').label, 'Special · Marcado');
  assert.ok(isSpecial('special:  algo'));
  // No roll: on the target at once.
  const s = table(withPower('Spark of Hope'), { ...actor('ally'), x: 128 });
  const spark = play(s, 'caster', 'Spark of Hope', { targetIds: ['ally'], special: 'Inspirado · +1 a la próxima' });
  assert.equal(spark.roll, null);
  assert.ok(get(s, 'ally').conditions.includes('Special: Inspirado · +1 a la próxima'));
  assert.match(spark.notes.join(' '), /Special: Inspirado/);
  assert.match(getHoveredCondition(get(s, 'ally'), { x: get(s, 'ally').x + 45, y: get(s, 'ally').y }, 32).label, /Special · Inspirado/);
  // With a roll (Biological Scan, Knowledge DC 10) it waits for the roll.
  const bio = table(withPower('Biological Scan'), { ...hostile('e'), x: 128 });
  assert.match(play(bio, 'caster', 'Biological Scan', { targetIds: ['e'], special: 'Escaneado' }).notes.join(' '), /preparado/);
  assert.deepEqual(get(bio, 'e').conditions, []);
  // A roll: only on a success.
  const l = table(withPower('Stellar Lance'), { ...hostile('e'), x: 64 + 64 * 4 });
  const lance = play(l, 'caster', 'Stellar Lance', { targetIds: ['e'], special: 'Cegado por la luz' });
  assert.deepEqual(get(l, 'e').conditions, []);
  check(l, 'caster', { traitId: 'presence', dc: 15, forcedHope: 11, forcedFear: 6 }, { cardPlayId: lance.id });
  assert.ok(get(l, 'e').conditions.includes('Special: Cegado por la luz'));
  // An area: on whoever fails its reply.
  const a = table(withPower('Blinding Flash'), { ...hostile('near'), x: 64 + 64 * 3 });
  const flash = play(a, 'caster', 'Blinding Flash', { special: 'Deslumbrado' });
  const reply = resolutionLog(a, flash.id).resolution.replies[0];
  check(a, 'near', { traitId: 'instinct', dc: 10, forcedD20: 2, forcedHope: 2, forcedFear: 3 }, { cardPlayId: flash.id, cardReplyId: reply.id });
  assert.ok(get(a, 'near').conditions.includes('Special: Deslumbrado'));
  // The Keeper writes one from the resolution, and anyone from the Conditions action.
  const k = table(withPower('Spark of Hope'), { ...actor('e'), x: 128 });
  const play2 = play(k, 'caster', 'Spark of Hope', { targetIds: ['e'] });
  adjudicateCard(k, play2.id, { operation: 'apply', kind: 'special', ids: ['e'], condition: 'Rastreado' });
  assert.ok(get(k, 'e').conditions.includes('Special: Rastreado'));
  assert.throws(() => adjudicateCard(k, play2.id, { operation: 'apply', kind: 'special', ids: ['e'], condition: '  ' }), /texto/);
  performGameAction({ type: 'CONDITION', actorId: 'caster', name: 'Special: Concentrado', active: true }, k);
  assert.ok(get(k, 'caster').conditions.includes('Special: Concentrado'));
});
