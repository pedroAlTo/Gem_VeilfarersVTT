import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadEncounters } from '../scripts/encounter-library.mjs';
import { createActor } from '../src/actors.js';
import { resolveDamage, damageTypeOf, weaponTags, usableArmorSlots, canBleed } from '../src/rulesEngine.js';
const dom = new JSDOM('<body></body>', { url:'http://localhost/' });
for (const key of ['window','document','HTMLElement','customElements','MutationObserver','localStorage','Event','CustomEvent','FormData']) globalThis[key] = dom.window[key];
const { store } = await import('../src/state.js'); await store.ready;
const { openEnvironment } = await import('../src/environmentUI.js');
const { openBossEditor } = await import('../src/bossUI.js');
const { DiceRollerSidebar } = await import('../src/diceRoller.js');
const { network, NetworkManager } = await import('../src/networkManager.js');
const { readCampaign } = await import('../src/persistence.js');
const { audio } = await import('../src/audioEngine.js'); audio.muted = true;
const catalog = loadEncounters(), original = structuredClone(store.state), originalBroadcast = network.broadcast;
beforeEach(async () => {
  await store.saveQueue.catch(()=>{}); store.state = structuredClone(original); store.state.campaignId = crypto.randomUUID();
  store.state.userRole='keeper';store.sessionRole='local';store.remoteApplying=false;store.listeners.clear();store.state.logs=[];
  store.state.dice3d=false;store.sessionBusy=false;store.undoManager=null;document.body.replaceChildren();delete window.veilCanvas;network.broadcast=()=>{};
});
after(async () => { await store.saveQueue.catch(()=>{}); network.broadcast=originalBroadcast;dom.window.close(); });

test('scene moves survive persistence and export without changing active scene or token locations', async () => {
  const maps=store.state.maps, scene=maps[0], next=store.createArc({name:'Next'}), active=store.state.activeMapId, tokens=structuredClone(store.state.tokens);
  assert.equal(store.moveSceneToArc(scene.id,next.id),true);assert.equal(store.moveSceneToArc(scene.id,'missing'),false);
  assert.equal(store.moveSceneToArc(scene.id,''),true);await store.saveQueue;
  const saved=await readCampaign(store.state.campaignId);assert.ok(!saved.arcs.some(a=>a.sceneIds.includes(scene.id)));
  const imported=store.normalizeCampaign(saved);assert.deepEqual(imported.arcs,saved.arcs);
  assert.equal(store.state.activeMapId,active);assert.deepEqual(store.state.tokens,tokens);
  store.state.arcs=[];assert.deepEqual(store.getArcs(),[]);
});
test('environment editor saves the requested inactive map and refuses activation there', async () => {
  const map=store.state.maps.find(m=>m.id!==store.state.activeMapId), active=store.getActiveMap();
  const modal=await openEnvironment(map.id,catalog.environments);
  const micro=modal.querySelector('[data-micro]');micro.value='keeper-micro-1';micro.dispatchEvent(new Event('change'));
  modal.querySelector('[data-save]').click();
  assert.equal(store.state.maps.find(m=>m.id===map.id).environment.microId,'keeper-micro-1');assert.equal(store.getActiveMap().environment,active.environment);
  assert.ok([...modal.querySelectorAll('[data-activate]')].every(b=>b.disabled));
  assert.match(modal.querySelector('[data-source]').textContent,/DC 10/);
});
test('environment editor rechecks Keeper permission when saving', async () => {
  const map=store.getActiveMap(), before=structuredClone(map);
  const modal=await openEnvironment(map.id,catalog.environments);modal.querySelector('[data-micro]').value='keeper-micro-1';store.state.userRole='player';
  modal.querySelector('[data-save]').click();assert.deepEqual(store.getActiveMap(),before);assert.match(modal.querySelector('.dossier-error').textContent,/Keeper/);
});
test('boss editor loads canonical phase data and saves renamed enemy with explicit inherited stats', async () => {
  const token=store.addToken({name:'Base leader',actorType:'adversary',isPlayer:false,attackModifier:3});
  const modal=await openBossEditor(token.id,catalog.bosses);modal.querySelector('[data-template]').value='keeper-boss-1';modal.querySelector('[data-load]').click();
  assert.equal(modal.querySelector('[data-boss-name]').value,'THE RUST-KING (SCAVENGER WARLORD)');
  modal.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  const saved=store.state.tokens.find(t=>t.id===token.id);assert.equal(saved.boss.states.length,2);assert.equal(saved.hp.current,10);assert.equal(saved.armor.current,3);assert.equal(saved.attackModifier,3);assert.match(saved.name,/RUST-KING/);
  assert.equal(saved.boss.requiresTiming,false);assert.equal(saved.boss.states[1].trigger,'hp0');
});
test('network snapshot retains current scene arc but removes future boss phases and other arc details', () => {
  const token=store.addToken({name:'Boss',actorType:'adversary',isPlayer:false,hidden:false,boss:{index:0,states:catalog.bosses[0].states,sourceText:'PRIVATE FUTURE'}});
  store.createArc({name:'Secret future arc'});const manager=new NetworkManager(store);const snapshot=manager.snapshotFor('guest');
  const publicBoss=snapshot.tokens.find(t=>t.id===token.id);assert.equal(publicBoss.boss,undefined);assert.deepEqual(publicBoss.bossStatus,{index:0,total:2,name:'THE BULLY',defeated:false,pending:true});
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE FUTURE'));assert.ok(!snapshot.arcs.some(a=>a.name==='Secret future arc'));assert.ok(snapshot.arcs.every(a=>a.sceneIds.every(id=>id===snapshot.activeMapId)));
});
function damagePanel({ secret=false, direct=false }={}) {
  const map=store.getActiveMap();const a=createActor({name:'Rifle',isPlayer:true},map.id), t=createActor({name:'Target',isPlayer:false,hp:{current:1,max:6,majorThreshold:5,severeThreshold:10},armor:{current:1,max:1}},map.id);
  store.state.tokens=[a,t];store.state.selectedTokenId=a.id;const node=document.createElement('div');document.body.append(node);const dice=new DiceRollerSidebar(node);
  node.querySelector('#dmg_target_select').value=t.id;node.querySelector('#dmg_formula').value='1d4+30';node.querySelector('#dmg_major_thresh').value='5';node.querySelector('#dmg_severe_thresh').value='10';node.querySelector('#dmg_impact_type').value='plasma';node.querySelector('#dmg_is_direct').checked=direct;
  if(secret){node.querySelector('#secret_roll').checked=true;node.querySelector('#secret_roll').dispatchEvent(new Event('change'));}
  return {node,dice,target:t};
}
test('damage preview is silent; applied FX use actual lost HP and real Armor expenditure only once', () => {
  const {node,dice,target}=damagePanel();const effects=[],sent=[];window.veilCanvas={triggerAttackFX:p=>effects.push(p)};network.broadcast=msg=>sent.push(msg);
  node.querySelector('#dmg_use_armor').checked=true; // the defender chooses to mark an Armor Slot
  dice.executeDamageCalc();assert.equal(effects.length,0);assert.equal(sent.filter(m=>m.type==='ATTACK_FX').length,0);
  node.querySelector('#apply_dmg_to_target_btn').click();assert.equal(effects.length,1);assert.equal(effects[0].hpLost,1);assert.equal(effects[0].shield,true);assert.equal(effects[0].kind,'plasma');assert.equal(store.state.tokens.find(t=>t.id===target.id).armor.current,0);
  node.querySelector('#apply_dmg_to_target_btn').click();assert.equal(effects.length,1);
});
test('a hit below the Major Threshold marks 1 HP; Armor is never spent unless the defender chooses to (Corebook ch. 10)', () => {
  const {node,dice,target}=damagePanel();window.veilCanvas={triggerAttackFX:()=>{}};network.broadcast=()=>{};
  store.updateToken(target.id,{hp:{current:6,max:6,majorThreshold:10,severeThreshold:16},armor:{current:3,max:3}});
  // Stale manual thresholds must not win over the target's own.
  node.querySelector('#dmg_major_thresh').value='10';node.querySelector('#dmg_severe_thresh').value='20';
  node.querySelector('#dmg_formula').value='6';
  assert.equal(node.querySelector('#dmg_use_armor').checked,false,'armor is opt-in');
  dice.executeDamageCalc();
  assert.equal(node.querySelector('#dmg_raw_val').textContent,'6');
  assert.equal(node.querySelector('#dmg_severity_val').textContent,'Minor');
  assert.equal(node.querySelector('#dmg_hp_loss_val').textContent,'1 HP');
  assert.match(node.querySelector('#dmg_detail_text').textContent,/Major \(10\) & Severe \(16\)\. No armor slot used/);
  node.querySelector('#apply_dmg_to_target_btn').click();
  const after=store.state.tokens.find(t=>t.id===target.id);
  assert.equal(after.hp.current,5);assert.equal(after.armor.current,3);
});
test('Penetration lowers both thresholds for the hit; Reflective and Wards cancel it; Neural marks 1 Stress (Corebook ch. 10)', () => {
  const hit=o=>resolveDamage({diceCount:0,flatModifier:8,targetMajorThreshold:10,targetSevereThreshold:16,...o});
  assert.deepEqual([hit({}).baseSeverity,hit({}).rawHpDamage],['Minor',1]);
  const energy=hit({damageType:'energy'});assert.deepEqual([energy.effectiveMajor,energy.effectiveSevere,energy.baseSeverity,energy.rawHpDamage],[8,14,'Major',2]);
  assert.equal(hit({damageType:'energy',targetReflective:true}).baseSeverity,'Minor');
  assert.equal(hit({damageType:'energy',targetWarded:true}).baseSeverity,'Major','a Ward does nothing against Energy');
  const voidHit=resolveDamage({diceCount:0,flatModifier:12,targetMajorThreshold:10,targetSevereThreshold:16,damageType:'void'});
  assert.deepEqual([voidHit.effectiveSevere,voidHit.baseSeverity,voidHit.rawHpDamage],[12,'Severe',3]);
  assert.equal(resolveDamage({diceCount:0,flatModifier:12,targetMajorThreshold:10,targetSevereThreshold:16,damageType:'void',targetWarded:true}).baseSeverity,'Major');
  // Overkill counts from the lowered Severe Threshold.
  assert.equal(resolveDamage({diceCount:0,flatModifier:22,targetMajorThreshold:10,targetSevereThreshold:16,damageType:'void'}).rawHpDamage,4);
  assert.equal(hit({damageType:'neural'}).stressMarked,1);assert.equal(hit({damageType:'void'}).stressMarked,0);
  // Direct damage ignores thresholds, so it ignores Penetration too. Thresholds never drop below 1.
  assert.equal(hit({damageType:'void',isDirectDamage:true}).penetration,0);
  assert.equal(resolveDamage({diceCount:0,flatModifier:1,targetMajorThreshold:2,targetSevereThreshold:4,damageType:'void'}).effectiveMajor,1);
  assert.deepEqual(['1d8 ene.','1d10 Void','2d6 Phys','Neural lash 1d6',{damageType:'Energy'},'1d8'].map(damageTypeOf),['energy','void','physical','neural','energy','physical']);
});
test('the damage panel reads the weapon type and the target armor: an Energy rifle against Reflective armor loses its Penetration', () => {
  const {node,dice,target}=damagePanel();window.veilCanvas={triggerAttackFX:()=>{}};network.broadcast=()=>{};
  store.updateToken(target.id,{hp:{current:6,max:6,majorThreshold:10,severeThreshold:16},armor:{current:3,max:3},stress:{current:0,max:6}});
  node.querySelector('#dmg_formula').value='8 ene.';
  dice.executeDamageCalc();
  assert.equal(node.querySelector('#dmg_severity_val').textContent,'Major');assert.equal(node.querySelector('#dmg_hp_loss_val').textContent,'2 HP');
  assert.match(node.querySelector('#dmg_detail_text').textContent,/Energy · Penetración −2: umbrales 10\/16 → 8\/14/);
  node.querySelector('#apply_dmg_to_target_btn').click();
  assert.equal(store.state.tokens.find(t=>t.id===target.id).hp.current,4,'applied with the same lowered thresholds');
  // Same hit against Reflective armor: found on the target, no Penetration.
  node.remove();store.listeners.clear();
  const second=damagePanel();
  store.updateToken(second.target.id,{hp:{current:6,max:6,majorThreshold:10,severeThreshold:16},armor:{current:3,max:3},inventory:{weapons:[],items:[{id:'a1',name:'Mirror Weave',quantity:'1',tier:'',use:'Reflective: anula la penetración de Energía.'}]}});
  second.node.querySelector('#dmg_formula').value='8 ene.';
  second.dice.executeDamageCalc();
  assert.equal(second.node.querySelector('#dmg_target_reflective').checked,true);
  assert.equal(second.node.querySelector('#dmg_severity_val').textContent,'Minor');
  // Neural, chosen by hand: 1 HP and 1 Stress.
  second.node.querySelector('#dmg_damage_type').value='neural';second.node.querySelector('#dmg_formula').value='3';
  store.updateToken(second.target.id,{stress:{current:0,max:6}});
  second.dice.executeDamageCalc();second.node.querySelector('#apply_dmg_to_target_btn').click();
  const after=store.state.tokens.find(t=>t.id===second.target.id);
  assert.equal(after.stress.current,1);assert.equal(after.hp.current,5);
});
test('Crushing ignores one Armor Slot unless the armor is Composite; Bleed applies Bleeding to targets that bleed (Corebook ch. 10)', () => {
  assert.deepEqual(weaponTags({ name: 'War Hammer', features: 'Heavy, Crushing' }), { crushing: true, bleed: false });
  assert.deepEqual(weaponTags({ name: 'Slash Claw', features: 'Bleed' }), { crushing: false, bleed: true });
  assert.deepEqual(weaponTags('Reliable'), { crushing: false, bleed: false });
  assert.equal(usableArmorSlots(3, { crushing: true }), 2); assert.equal(usableArmorSlots(1, { crushing: true }), 0);
  assert.equal(usableArmorSlots(3, { crushing: true, composite: true }), 3); assert.equal(usableArmorSlots(3), 3); assert.equal(usableArmorSlots(0, { crushing: true }), 0);
  assert.equal(canBleed({ species: 'Human' }), true); assert.equal(canBleed({ species: 'Synthetic' }), false); assert.equal(canBleed({ species: 'Sintético' }), false);
});
test('a Crushing hit against a single Armor Slot cannot be soaked; with Composite armor it can', () => {
  const {node,dice,target}=damagePanel();window.veilCanvas={triggerAttackFX:()=>{}};network.broadcast=()=>{};
  store.updateToken(target.id,{hp:{current:6,max:6,majorThreshold:10,severeThreshold:16},armor:{current:1,max:1}});
  node.querySelector('#dmg_formula').value='6';node.querySelector('#dmg_weapon_crushing').checked=true;node.querySelector('#dmg_use_armor').checked=true;
  dice.executeDamageCalc();
  assert.equal(node.querySelector('#dmg_hp_loss_val').textContent,'1 HP','the only slot is ignored');
  assert.match(node.querySelector('#dmg_detail_text').textContent,/Crushing: ignora 1 Armor Slot/);
  assert.equal(node.querySelector('#dmg_shield_mitigation_row').style.display,'none');
  node.querySelector('#apply_dmg_to_target_btn').click();
  let after=store.state.tokens.find(t=>t.id===target.id);
  assert.equal(after.hp.current,5);assert.equal(after.armor.current,1,'an ignored slot is not spent');
  // Composite armor: the same hit can be soaked.
  node.remove();store.listeners.clear();
  const second=damagePanel();
  store.updateToken(second.target.id,{hp:{current:6,max:6,majorThreshold:10,severeThreshold:16},armor:{current:1,max:1},inventory:{weapons:[],items:[{id:'a1',name:'Composite Armor',quantity:'1',tier:'',use:'Composite, Resilient'}]}});
  second.node.querySelector('#dmg_formula').value='6';second.node.querySelector('#dmg_weapon_crushing').checked=true;second.node.querySelector('#dmg_use_armor').checked=true;
  second.dice.executeDamageCalc();
  assert.equal(second.node.querySelector('#dmg_target_composite').checked,true);
  assert.equal(second.node.querySelector('#dmg_hp_loss_val').textContent,'0 HP');
  assert.match(second.node.querySelector('#dmg_detail_text').textContent,/Crushing anulado por armadura Composite/);
  second.node.querySelector('#apply_dmg_to_target_btn').click();
  after=store.state.tokens.find(t=>t.id===second.target.id);
  assert.equal(after.hp.current,6);assert.equal(after.armor.current,0);
});
test('a Bleed weapon leaves the target Bleeding on any hit, once, and never a Synthetic', () => {
  const {node,dice,target}=damagePanel();window.veilCanvas={triggerAttackFX:()=>{}};network.broadcast=()=>{};
  store.updateToken(target.id,{hp:{current:6,max:6,majorThreshold:10,severeThreshold:16},armor:{current:2,max:2},species:'Human',conditions:['Bleeding']});
  node.querySelector('#dmg_formula').value='3';node.querySelector('#dmg_weapon_bleed').checked=true;node.querySelector('#dmg_use_armor').checked=true;
  dice.executeDamageCalc();
  assert.match(node.querySelector('#dmg_detail_text').textContent,/Bleed: el objetivo queda Bleeding/);
  node.querySelector('#apply_dmg_to_target_btn').click();
  let after=store.state.tokens.find(t=>t.id===target.id);
  assert.equal(after.hp.current,6,'soaked to 0 HP');assert.deepEqual(after.conditions,['Bleeding'],'still a hit: Bleeding, not duplicated');
  node.remove();store.listeners.clear();
  const second=damagePanel();
  store.updateToken(second.target.id,{hp:{current:6,max:6,majorThreshold:10,severeThreshold:16},species:'Synthetic',conditions:[]});
  second.node.querySelector('#dmg_formula').value='3';second.node.querySelector('#dmg_weapon_bleed').checked=true;
  second.dice.executeDamageCalc();
  assert.match(second.node.querySelector('#dmg_detail_text').textContent,/no sangra/);
  second.node.querySelector('#apply_dmg_to_target_btn').click();
  after=store.state.tokens.find(t=>t.id===second.target.id);
  assert.equal(after.hp.current,5);assert.deepEqual(after.conditions||[],[]);
});
test('Armor exhausted between preview and apply does not produce a shield; secret impact is not broadcast', () => {
  const {node,dice,target}=damagePanel({secret:true});const effects=[],sent=[];window.veilCanvas={triggerAttackFX:p=>effects.push(p)};network.broadcast=msg=>sent.push(msg);
  dice.executeDamageCalc();store.updateToken(target.id,{armor:{current:0,max:1}});node.querySelector('#apply_dmg_to_target_btn').click();
  assert.equal(effects[0].shield,false);assert.equal(sent.filter(m=>m.type==='ATTACK_FX'||m.type==='SPECIAL_FX').length,0);
});
test('direct damage bypass suppresses shield feedback and changing scene invalidates a stale application', () => {
  const {node,dice}=damagePanel({direct:true});const effects=[];window.veilCanvas={triggerAttackFX:p=>effects.push(p)};
  dice.executeDamageCalc();node.querySelector('#apply_dmg_to_target_btn').click();assert.equal(effects[0].shield,false);
  node.remove();store.listeners.clear();const second=damagePanel();second.dice.executeDamageCalc();store.state.activeMapId=store.state.maps.find(m=>m.id!==store.state.activeMapId).id;second.node.querySelector('#apply_dmg_to_target_btn').click();assert.equal(effects.length,1);
});
