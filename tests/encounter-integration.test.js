import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadEncounters } from '../scripts/encounter-library.mjs';
import { createActor } from '../src/actors.js';
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
  dice.executeDamageCalc();assert.equal(effects.length,0);assert.equal(sent.filter(m=>m.type==='ATTACK_FX').length,0);
  node.querySelector('#apply_dmg_to_target_btn').click();assert.equal(effects.length,1);assert.equal(effects[0].hpLost,1);assert.equal(effects[0].shield,true);assert.equal(effects[0].kind,'plasma');assert.equal(store.state.tokens.find(t=>t.id===target.id).armor.current,0);
  node.querySelector('#apply_dmg_to_target_btn').click();assert.equal(effects.length,1);
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
