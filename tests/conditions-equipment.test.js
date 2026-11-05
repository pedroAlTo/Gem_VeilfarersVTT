import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { CONDITIONS, normalizeConditions, conditionMarkers, drawTokenConditions } from '../src/conditions.js';
import { tokenInventory, validateInventory, weaponPreset, parseDamageExpression, resolveDamageExpression } from '../src/equipment.js';
import { createActor } from '../src/actors.js';
import { exportNativeCharacter, parseCharacterJSON } from '../src/characterImport.js';
import { validTokenPatch, validateActor } from '../src/validation.js';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[key] = dom.window[key];
const { store } = await import('../src/state.js'); await store.ready;
const { openConditions } = await import('../src/conditionUI.js');
const { openInventory } = await import('../src/equipmentUI.js');
const { openDossier } = await import('../src/dossierUI.js');
const { DiceRollerSidebar } = await import('../src/diceRoller.js');
const { NetworkManager } = await import('../src/networkManager.js');
const original = structuredClone(store.state);
const weapon = (patch = {}) => ({ id:'laser', name:'Laser', tier:'Common', damage:'d8+1 Energy', damageMode:'base', trait:'Finesse', range:'Far', features:'', ...patch });
const inventory = () => ({ weapons:[weapon()], items:[{ id:'lamp', name:'Lamp', quantity:'1', tier:'Common', use:'Light' }] });
const actor = (patch = {}) => createActor({ inventory:inventory(), ...patch }, store.state.activeMapId);
const mount = () => { const el=document.createElement('div');document.body.append(el);return el; };
beforeEach(async () => { await store.saveQueue.catch(() => {}); store.state=structuredClone(original); store.listeners.clear(); store.state.userRole='keeper'; store.sessionRole='local'; store.remoteApplying=false; store.sessionBusy=false; document.body.replaceChildren(); delete window.veilDiceRoller; });
after(async () => { await store.saveQueue.catch(() => {});dom.window.close(); });

test('the 18 condition definitions match Corebook 12.06 verbatim; aliases and duplicate applications do not stack', () => {
  const book=readFileSync(new URL('../System/VeilFarers_Corebook_12_06_Corrections_FULL_SOURCE.md',import.meta.url),'utf8').replaceAll('\r','');
  assert.equal(CONDITIONS.length,18);
  for(const c of CONDITIONS) assert.ok(book.includes(`- **${c.name}.** ${c.rule}`),c.name);
  assert.deepEqual(normalizeConditions(['Hidden','oculto','HIDDEN','Bleeding','Herido','Herido']),['Hidden','Bleeding','Herido']);
  assert.deepEqual(conditionMarkers(CONDITIONS.map(c=>c.name)),['Bleeding','Blinded','Confused',{more:15}]);
});

test('token badges draw bounded vector icons and overflow without covering the portrait', () => {
  const calls=[]; globalThis.Path2D=class {constructor(d){this.d=d;}};
  const ctx=new Proxy({}, {get:(_,k)=>(...args)=>calls.push([k,...args]),set:()=>true});
  drawTokenConditions(ctx,{conditions:[]},32);assert.equal(calls.length,0);
  drawTokenConditions(ctx,{conditions:CONDITIONS.map(c=>c.name)},32,1);
  assert.equal(calls.filter(c=>c[0]==='roundRect').length,4);
  assert.ok(calls.some(c=>c[0]==='fillText'&&c[1]==='+15'));
  assert.ok(calls.some(c=>c[0]==='stroke'&&c[1] instanceof Path2D));
});

test('condition controls persist and synchronize without changing hidden visibility or applying automatic effects', async () => {
  const t=actor();store.state.tokens=[t];const originalHP=t.hp.current;
  const modal=openConditions(t.id);
  await modal.querySelector('[data-condition="Hidden"]').onclick();await modal.querySelector('[data-condition="Bleeding"]').onclick();
  assert.deepEqual(store.state.tokens[0].conditions,['Hidden','Bleeding']);assert.equal(store.state.tokens[0].hidden,false);assert.equal(store.state.tokens[0].hp.current,originalHP);
  const custom=modal.querySelector('[data-custom]'); custom.value='Herido';await modal.querySelector('form').onsubmit(new Event('submit',{bubbles:true,cancelable:true}));
  assert.deepEqual(store.state.tokens[0].conditions,['Hidden','Bleeding','Herido']);
  await modal.querySelector('[data-condition="Hidden"]').onclick();assert.ok(!store.state.tokens[0].conditions.includes('Hidden'));
  const n=new NetworkManager();assert.deepEqual(n.snapshotFor('guest').tokens[0].conditions,['Bleeding','Herido']);
  assert.deepEqual(store.serializeCampaign().tokens[0].conditions,['Bleeding','Herido']);
  store.update({userRole:'player'});store.state.claimedTokenId=null;
  modal.querySelector('[data-condition="Stunned"]').click();assert.ok(!store.state.tokens[0].conditions.includes('Stunned'));assert.match(modal.querySelector('[data-rule]').textContent,/Cannot take any action/);
  n.disconnect();
});

test('real sheet field conventions retain final damage, no-damage weapons and equipment quantities', () => {
  const t={isPlayer:true,path:'Awakened',proficiency:3,sourceCharacter:{document:{fields:{wpri_name:'Frontier Revolver',wpri_dmg:'d8+1 phys.',wpri_dmg_final_aw:'3d8+1 phys.',wpri_trait:'Agility · Close',wpri_feat:'Reliable: +1 attack',wsec_name:'Net Launcher',wsec_dmg_final_aw:'n/a',eq_0_name:'Lamp',eq_0_qty:'2',eq_0_use:'Illuminates 10m'}}}};
  const before=structuredClone(t.sourceCharacter);const data=tokenInventory(t);
  assert.equal(data.weapons[0].damageMode,'final');assert.equal(data.weapons[0].damage,'3d8+1 phys.');assert.equal(data.weapons[1].damage,'n/a');assert.equal(data.items[0].quantity,'2');
  assert.deepEqual(weaponPreset(t,data.weapons[0]),{formula:'3d8+1 phys.',proficiency:1,honed:0});
  assert.deepEqual(t.sourceCharacter,before);
});

test('damage parser handles mixed pools and rejects alternative or unsupported procedures intact', () => {
  assert.deepEqual(parseDamageExpression('1d8+1 Phys + 1d4 Shock'),{pools:[{count:1,sides:8},{count:1,sides:4}],flat:1});
  assert.deepEqual(parseDamageExpression('d6 − 1 phys.'),{pools:[{count:1,sides:6}],flat:-1});
  for(const value of ['n/a','2d8 keep highest','d8 / d6','1d8 (Horde) / 1d4 (Depleted)','1d8+alert(1)','101d4','1d7','1d8 2d4','1d8+','0']) assert.throws(()=>parseDamageExpression(value),undefined,value);
});

test('Proficiency, Honed Edge, mixed damage and Critical each apply exactly once', t => {
  t.mock.method(Math,'random',()=>0);
  const pc=actor({path:'Sleeping',proficiency:3,honedEdgeBonus:2});
  const base=weaponPreset(pc,weapon({damage:'d8+1 Phys'})), final=weaponPreset(pc,weapon({damage:'3d8+3 Phys',damageMode:'final'}));
  assert.equal(resolveDamageExpression(base.formula,base).rawDamage,6);
  assert.equal(resolveDamageExpression(final.formula,final).rawDamage,6);
  assert.equal(resolveDamageExpression(final.formula,{...final,isCritical:true}).rawDamage,9);
  assert.equal(resolveDamageExpression(final.formula,{...final,isKeeperCritical:true}).rawDamage,27);
  assert.equal(resolveDamageExpression('1d8+1 Phys + 1d4 Shock').rawDamage,3);
  assert.equal(resolveDamageExpression('1d8+1 Phys + 1d4 Shock',{isCritical:true}).rawDamage,5);
  assert.equal(resolveDamageExpression('1d8+1 Phys + 1d4 Shock',{isKeeperCritical:true}).rawDamage,13);
});

test('inventory editor saves weapons and objects; native export/import preserves them and empty inventories', () => {
  const t=actor();store.state.tokens=[t];const modal=openInventory(t.id);
  const name=modal.querySelector('[data-rows="weapons"] [data-field="name"]');name.value='Custom blade';name.dispatchEvent(new Event('input'));
  modal.querySelector('[data-add="items"]').click();
  const rows=modal.querySelectorAll('[data-rows="items"] [data-row]');const item=rows[1].querySelector('[data-field="name"]');item.value='Medkit';item.dispatchEvent(new Event('input'));
  modal.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(modal.isConnected,false);assert.equal(store.state.tokens[0].inventory.weapons[0].name,'Custom blade');assert.equal(store.state.tokens[0].inventory.items[1].name,'Medkit');
  const portable=parseCharacterJSON(exportNativeCharacter(store.state.tokens[0])).token;
  assert.deepEqual(portable.inventory,store.state.tokens[0].inventory);
  portable.inventory={weapons:[],items:[]};assert.deepEqual(tokenInventory(portable),{weapons:[],items:[]});
});

test('inventory editing detects stale concurrent changes and rechecks revoked ownership', () => {
  const t=actor();store.state.tokens=[t];const modal=openInventory(t.id);
  store.updateToken(t.id,{inventory:{weapons:[],items:[]}});modal.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  assert.match(modal.querySelector('.dossier-error').textContent,/otra ventana/);assert.equal(store.state.tokens[0].inventory.weapons.length,0);
  modal.remove();const second=openInventory(t.id);store.state.userRole='player';store.state.claimedTokenId=null;
  second.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));assert.match(second.querySelector('.dossier-error').textContent,/no tienes control/);
});

test('inventory and condition patches reject invalid values and cannot escalate actor permissions', () => {
  assert.equal(validTokenPatch({inventory:inventory(),conditions:['Bleeding']}),true);
  assert.equal(validTokenPatch({inventory:inventory(),ownerId:'attacker'}),false);
  for(const value of [{weapons:[],items:[{id:'x',name:'Bad'}]},{...inventory(),userRole:'keeper'},{weapons:[weapon({damageMode:'other'})],items:[]}]){assert.throws(()=>validateInventory(value));assert.equal(validTokenPatch({inventory:value}),false);}
  assert.throws(()=>validateActor({...actor(),conditions:Array(31).fill('x')}));
  assert.equal(validTokenPatch({conditions:['x'.repeat(101)]}),false);
});

test('one click in the sheet prepares damage, retains the selected target and avoids duplicated final modifiers', () => {
  const t=actor({path:'Sleeping',proficiency:3,honedEdgeBonus:2,inventory:{weapons:[weapon({damage:'3d8+3 Phys',damageMode:'final'})],items:[]}});
  const enemy=actor({name:'Enemy',isPlayer:false});store.state.tokens=[t,enemy];store.state.selectedTokenId=t.id;
  const el=mount(), dice=new DiceRollerSidebar(el);el.querySelector('#dmg_target_select').value=enemy.id;
  const modal=openDossier(t,()=>{},'equipment');modal.querySelector('[data-prepare-weapon]').click();
  assert.equal(modal.isConnected,false);assert.equal(el.querySelector('#section_damage_calc').style.display,'block');
  assert.equal(el.querySelector('#dmg_formula').value,'3d8+3 Phys');assert.equal(el.querySelector('#dmg_proficiency').value,'1');assert.equal(el.querySelector('#dmg_honed').value,'0');assert.equal(el.querySelector('#dmg_target_select').value,enemy.id);
  dice.executeDamageCalc();assert.equal(el.querySelector('#damage_result_display').style.display,'block');
  store.updateToken(t.id,{inventory:{weapons:[weapon({damage:'d4'})],items:[]}});
  assert.equal(el.querySelector('#dmg_formula').value,'');assert.equal(el.querySelector('#damage_result_display').style.display,'none');
});

test('unassigned players cannot prepare another token weapon; final damage remains Keeper-applied', () => {
  const t=actor();store.state.tokens=[t];store.state.selectedTokenId=t.id;store.state.userRole='player';store.state.claimedTokenId=null;
  const el=mount(),dice=new DiceRollerSidebar(el);assert.equal(dice.prepareWeapon(t.id,'laser'),false);assert.equal(openInventory(t.id),undefined);
  store.state.claimedTokenId=t.id;assert.equal(dice.prepareWeapon(t.id,'laser'),true);
  el.querySelector('#dmg_target_select').value=t.id;dice.executeDamageCalc();assert.equal(el.querySelector('#apply_dmg_to_target_btn').disabled,true);
});
