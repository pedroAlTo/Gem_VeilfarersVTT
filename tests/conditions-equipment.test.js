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
  assert.deepEqual(store.state.tokens[0].conditions,['Hidden','Bleeding','Special: Herido']);
  await modal.querySelector('[data-condition="Hidden"]').onclick();assert.ok(!store.state.tokens[0].conditions.includes('Hidden'));
  const n=new NetworkManager();assert.deepEqual(n.snapshotFor('guest').tokens[0].conditions,['Bleeding','Special: Herido']);
  assert.deepEqual(store.serializeCampaign().tokens[0].conditions,['Bleeding','Special: Herido']);
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

test('unassigned players cannot prepare another token weapon; assigned players can execute damage', () => {
  const t=actor();store.state.tokens=[t];store.state.selectedTokenId=t.id;store.state.userRole='player';store.state.claimedTokenId=null;
  const el=mount(),dice=new DiceRollerSidebar(el);assert.equal(dice.prepareWeapon(t.id,'laser'),false);assert.equal(openInventory(t.id),undefined);
  store.state.claimedTokenId=t.id;assert.equal(dice.prepareWeapon(t.id,'laser'),true);
  el.querySelector('#dmg_target_select').value=t.id;dice.executeDamageCalc();assert.equal(el.querySelector('#apply_dmg_to_target_btn').disabled,false);
});

test('the equipment tab (v2.30.0): three blocks, the equipped large, a filtered catalog that shows everything before taking it', async () => {
  const { openDossier } = await import('../src/dossierUI.js');
  const { EQUIPMENT_CATALOG } = await import('../src/equipmentLibrary.js');
  const t = actor({ level: 2, inventory: { weapons: [weapon()], items: [{ id: 'kit', name: 'Medkit', tier: '', quantity: '2', use: 'Heals' }] } });
  store.state.tokens = [t]; store.state.selectedTokenId = t.id;
  const modal = openDossier(t, () => {}, 'equipment'), panel = modal.querySelector('[data-panel="equipment"]'), live = () => store.state.tokens[0];
  const click = selector => panel.querySelector(selector).click();
  const tick = () => new Promise(r => setTimeout(r, 0));
  // Three blocks by importance; the catalog stays closed.
  assert.deepEqual([...panel.querySelectorAll('.eq-block-head h4')].map(h => h.textContent.split('·')[0].trim()), ['ARMAS Y ARMADURAS', 'AUMENTOS', 'ÚTILES Y VARIOS']);
  assert.equal(panel.querySelector('[data-eq-catalog]').hidden, true);
  // The weapon in hand is a large card with all its characteristics and its tags with their rule.
  const card = panel.querySelector('.eq-card.eq-weapons');
  assert.ok(card && card.querySelector('.eq-stats'), 'large card with its stats');
  // The catalog: type, WT and book filters (several at once) and the item's whole sheet before taking it.
  click('[data-eq-open="weapons,armor"]');
  assert.equal(panel.querySelector('[data-eq-catalog]').hidden, false);
  panel.querySelector('[data-eq-mine]').click();
  click('[data-eq-type="weapons"]');
  const rs = () => [...panel.querySelectorAll('[data-eq-pickid]')].map(b => EQUIPMENT_CATALOG.find(i => i.id === b.dataset.eqPickid));
  assert.ok(rs().length > 0 && rs().every(i => i.category === 'armor'), 'only armor after leaving Armaduras on');
  click('[data-eq-wt="2"]'); assert.ok(rs().every(i => i.category === 'armor' && i.wt === 2));
  click('[data-eq-book="rust_and_steel"]'); assert.ok(rs().length > 0 && rs().every(i => i.source === 'rust_and_steel' && i.wt === 2));
  click('[data-eq-book="core"]'); assert.ok(rs().some(i => i.source === 'core'), 'several books at once');
  click('[data-eq-wt="2"]'); click('[data-eq-book="core"]'); click('[data-eq-book="rust_and_steel"]');
  const pick = rs().find(i => i.armorSlots >= 3);
  panel.querySelector(`[data-eq-pickid="${pick.id}"]`).click();
  assert.match(panel.querySelector('[data-eq-pick]').textContent, /Armor Slots/, 'all its characteristics before taking it');
  click('[data-eq-take]'); await tick();
  assert.equal(live().inventory.items.find(i => i.kind === 'armor').catalogId, pick.id); assert.equal(live().armor.max, pick.armorSlots);
  // A second armor is put on; the first stays carried, and can be put on again.
  const second = rs().find(i => i.id !== pick.id && i.armorSlots && i.armorSlots !== pick.armorSlots);
  panel.querySelector(`[data-eq-pickid="${second.id}"]`).click(); click('[data-eq-take]'); await tick();
  assert.equal(live().inventory.items.filter(i => i.kind === 'armor').length, 2); assert.equal(live().armor.max, second.armorSlots);
  const firstRow = live().inventory.items.find(i => i.catalogId === pick.id);
  assert.equal(firstRow.equipped, false);
  click(`[data-eq-wear="${firstRow.id}"]`); await tick();
  assert.equal(live().armor.max, pick.armorSlots); assert.equal(live().inventory.items.find(i => i.catalogId === second.id).equipped, false);
  click('[data-eq-close]'); assert.equal(panel.querySelector('[data-eq-catalog]').hidden, true);
  // Weapons: put away and back in hand.
  const weaponId = live().inventory.weapons[0].id;
  click(`[data-eq-hand="${weaponId}"][data-on="0"]`); assert.equal(live().inventory.weapons[0].equipped, false);
  assert.ok(panel.querySelector('.eq-row [data-eq-expand]'), 'carried weapons are compact rows');
  click(`[data-eq-expand="${weaponId}"]`); assert.ok(panel.querySelector('.eq-row.open .eq-detail'), 'a carried row opens to show everything');
  click(`[data-eq-hand="${weaponId}"][data-on="1"]`); assert.equal(live().inventory.weapons[0].equipped, true);
  // Quantities, edit behind ⋯, a new entry saved only with a name, removing asks once.
  click('[data-equip-qty="kit"][data-delta="1"]'); assert.equal(live().inventory.items.find(i => i.id === 'kit').quantity, '3');
  click(`[data-equip-menu="${weaponId}"]`); click(`[data-equip-edit="${weaponId}"]`);
  const form = panel.querySelector('[data-equip-form]');
  form.querySelector('[data-field="name"]').value = 'Rifle del capitán'; form.querySelector('[data-equip-save]').click();
  assert.equal(live().inventory.weapons[0].name, 'Rifle del capitán');
  click('[data-eq-open="gear"]'); click('[data-eq-custom="items"]');
  click('[data-equip-save]'); assert.match(panel.querySelector('[data-eq-error]').textContent, /Ponle un nombre/);
  panel.querySelector('[data-equip-form] [data-field="name"]').value = 'Cuerda'; click('[data-equip-save]');
  assert.equal(live().inventory.items.at(-1).name, 'Cuerda');
  click('[data-equip-menu="kit"]'); click('[data-equip-remove="kit"]'); click('[data-equip-remove="kit"]');
  assert.equal(live().inventory.items.some(i => i.id === 'kit'), false);
  assert.equal(panel.querySelector('[data-eq-keeper]').hidden, store.state.userRole !== 'keeper' || store.sessionRole === 'player');
  modal.remove();
});

test('augmentations: effects applied on install and undone on removal, capacity costs maximum Stress, active ones are cards (v2.28.0)', async () => {
  const { installGear, removeGear, augmentCapacity, AUGMENTS } = await import('../src/gear.js');
  const { EQUIPMENT_CATALOG } = await import('../src/equipmentLibrary.js');
  const { characterCards, playCard } = await import('../src/loadoutCards.js');
  const { setCardData } = await import('../src/cardData.js');
  const { CREATOR_DATA } = await import('../src/creator/creatorData.js');
  const item = id => EQUIPMENT_CATALOG.find(i => i.id === id);
  let t = { id: 'aug', name: 'Kael', isPlayer: true, level: 1, evasion: 10, ancestry: 'Ailuran', traits: { strength: 0, agility: 1, finesse: 0, presence: 0, instinct: 0, knowledge: 0 }, hp: { current: 6, max: 6, majorThreshold: 3, severeThreshold: 5 }, stress: { current: 0, max: 6 }, armor: { current: 0, max: 0 }, inventory: { weapons: [], items: [] } };
  const apply = patch => { t = { ...t, ...patch }; };
  assert.equal(augmentCapacity(t), 1, 'the three best of Str/Agi/Fin/Pre');
  apply(installGear(t, t.inventory, item('core_aug_combat_reflexes'), 'r1'));
  assert.equal(t.evasion, 11); assert.equal(t.stress.max, 6, 'within capacity');
  apply(installGear(t, t.inventory, item('core_aug_reinforced_bones'), 'r2'));
  assert.deepEqual([t.hp.max, t.hp.current], [8, 8]); assert.equal(t.stress.max, 5, 'one past the capacity: −1 maximum Stress');
  assert.throws(() => installGear(t, t.inventory, item('core_aug_reinforced_bones'), 'r3'), /ya está instalado/);
  apply(installGear(t, t.inventory, item('core_aug_prosthetic_limb'), 'r4'));
  assert.equal(t.traits.strength, 1); assert.equal(t.stress.max, 5, '+1 Strength raises the capacity as the third augment uses it');
  apply(removeGear(t, t.inventory, 'r2'));
  assert.deepEqual([t.hp.max, t.hp.current], [6, 6]); assert.equal(t.stress.max, 6, 'back within capacity');
  apply(removeGear(t, t.inventory, 'r1')); assert.equal(t.evasion, 10);
  // Subdermal Armor adds to the armor's slots, also when armor is put on afterwards.
  apply(installGear(t, t.inventory, item('core_aug_subdermal_armor'), 'r5')); assert.deepEqual(t.armor, { current: 1, max: 1 });
  const vest = EQUIPMENT_CATALOG.find(i => i.category === 'armor' && i.armorSlots);
  apply(installGear(t, t.inventory, vest, 'a1')); assert.equal(t.armor.max, vest.armorSlots + 1);
  apply(removeGear(t, t.inventory, 'a1')); assert.equal(t.armor.max, 1); assert.deepEqual([t.hp.majorThreshold, t.hp.severeThreshold], [3, 5]);
  // An augment that is used is a card in the hand, illustrated with its own picture.
  assert.ok(AUGMENTS.core_aug_pain_suppressor.active);
  apply(installGear(t, t.inventory, item('core_aug_pain_suppressor'), 'r6'));
  setCardData(CREATOR_DATA);
  const card = characterCards({ ...t, characterClass: 'Soldier', path: 'Awakened' }, CREATOR_DATA).find(c => c.kind === 'augment');
  assert.ok(card, 'the Pain Suppressor is a card'); assert.match(card.art.illustration, /equipment/); assert.equal(card.limit, '1 / escena');
  const played = playCard({ ...t, stress: { current: 3, max: 6 } }, card);
  assert.equal(played.token.stress.current, 2, 'it clears 1 Stress');
  assert.equal(characterCards({ ...t, characterClass: 'Soldier', path: 'Awakened' }, CREATOR_DATA).filter(c => c.kind === 'augment').length, 1, 'passive augments are not cards');
});

test('mixed damage uses each defence, rounds repeated types once and preserves the rolled faces', async () => {
  const { sameDamageDefenses } = await import('../src/damageProtection.js');
  const hit = (formula, conditions, more = {}) => resolveDamageExpression(formula, { targetToken: { conditions }, rollDie: sides => sides, ...more });
  const result = hit('d8+1 Phys + d4 Shock', ['Resistance: Physical', 'Immunity: Shock']);
  assert.deepEqual(result.rolls, [8, 4]); assert.equal(result.effectiveDamage, 4);
  assert.equal(result.fullyProtected, false);
  const groups = result.groups.map(({ types, applied }) => ({ types, applied }));
  assert.ok(sameDamageDefenses({ conditions: ['Immunity: Shock', 'Resistance: Physical'] }, { groups }));
  assert.ok(!sameDamageDefenses({ conditions: ['Immunity: Shock'] }, { groups }));
  assert.equal(hit('1 Fire + 1 Fire', ['Resistance: Fire']).effectiveDamage, 1);
  assert.equal(hit('d8 Phys + d4 Neural', ['Immunity: Neural']).stressMarked, 0);
  assert.equal(hit('d8 Phys + d4 Neural', ['Immunity: Physical']).stressMarked, 1);
  assert.equal(hit('d8 Phys + d4 Shock', ['Immunity: Physical', 'Immunity: Energy']).finalHpDamage, 0);
  const critical = hit('d8+1 Phys + d4 Shock', ['Immunity: Shock'], { isCritical: true, proficiency: 2, honed: 1, bonus: 2 });
  assert.deepEqual(critical.rolls, [8, 8, 8, 8, 4, 4]);
  assert.equal(critical.effectiveDamage, 36);
});

test('Vea’s existing inventory and an imported armor-only sheet render the packaged paintings', () => {
  const item = (id, name, quantity) => ({ id, name, quantity, tier: 'Tier 1', use: '' });
  const vest = 'Malla Táctica Balística', suit = 'Traje de Combate Blindado Orbital';
  const legacy = { weapons: [weapon({ id: 'old-pistol', name: 'Pistola Cinética Militar', damage: '1d8', range: 'Short' })],
    items: [item('v1', vest, '2'), item('s2', suit, '1'), item('v2', vest, '1')] };
  const t = actor({ name: 'Vea Kaelen', inventory: structuredClone(legacy) });
  store.state.tokens = [t];
  const dossier = openDossier(t, () => {}, 'equipment');
  // v2.30.0: in hand / worn as large cards, carried as compact rows (the first unmarked armor is worn).
  const rows = [...dossier.querySelectorAll('.eq-card, .eq-row')];
  assert.deepEqual(rows.map(r => r.querySelector('strong').textContent), ['Pistola Cinética Militar', vest, suit, vest]);
  const sources = rows.map(r => r.querySelector('img')?.getAttribute('src'));
  assert.deepEqual(sources, ['/assets/equipment/objects/set-1.webp', '/assets/equipment/core_ar_tactical_weave.webp',
    '/assets/equipment/core_ar_heavy_combat_suit.webp', '/assets/equipment/core_ar_tactical_weave.webp']);
  assert.equal(rows[0].querySelector('img').style.top, '-100%');
  assert.match(rows[0].textContent, /1d8/);
  for (const src of new Set(sources)) assert.equal(readFileSync(new URL('../public' + src, import.meta.url)).toString('ascii', 8, 12), 'WEBP');
  assert.deepEqual(store.state.tokens[0].inventory, legacy);
  dossier.remove();
  const imported = actor({ sourceCharacter: { format: 'character-sheet', document: { app: 'Veilfarers Character Sheet', fields: { name: 'Vea', armor_name: 'MALLA TACTICA BALISTICA' } } }, inventory: { weapons: [], items: [] } });
  store.state.tokens = [imported];
  const sheet = openDossier(imported, () => {}, 'equipment');
  assert.equal(sheet.querySelector('.eq-card img')?.getAttribute('src'), sources[1]);
});

test('the catalog has the personal equipment of both books, with Wealth Tier, book and family (v2.30.0)', async () => {
  const { EQUIPMENT_CATALOG, wealthTier, filterEquipmentCatalog } = await import('../src/equipmentLibrary.js');
  const { gearProfile } = await import('../src/techAccess.js');
  const count = (source, category) => EQUIPMENT_CATALOG.filter(i => i.source === source && i.category === category).length;
  assert.ok(EQUIPMENT_CATALOG.length > 550, `${EQUIPMENT_CATALOG.length} items`);
  for (const category of ['weapons', 'armor', 'augmentations', 'gear']) assert.ok(count('core', category) > 0 && count('rust_and_steel', category) > 0, category);
  assert.ok(count('rust_and_steel', 'weapons') >= 150 && count('rust_and_steel', 'gear') >= 100);
  // Names from the books, also the Rust & Steel entries and the black market.
  for (const name of ['Shock Baton', 'Plate Carrier', 'Tactical HUD Interface', 'Grappling Hook', 'Thermal Regulation Suit (TRS)', 'Chameleon Skin', 'Berserker Chip']) assert.ok(EQUIPMENT_CATALOG.some(i => i.name === name), name);
  assert.deepEqual([wealthTier('1 Cr (WT1)'), wealthTier('4 Credits'), wealthTier('9 Cr'), wealthTier('16 Credits'), wealthTier('25 Credits'), wealthTier('0 Cr'), wealthTier('')], [1, 2, 3, 4, 5, 0, null]);
  // Filters: several books, several WTs, several types at once.
  const both = filterEquipmentCatalog({ sources: ['core', 'rust_and_steel'], categories: ['armor'], wts: [2, 3] });
  assert.ok(both.length && both.every(i => i.category === 'armor' && [2, 3].includes(i.wt)));
  assert.ok(new Set(both.map(i => i.source)).size === 2);
  // Technology Access reads the family of a book item.
  const carrier = EQUIPMENT_CATALOG.find(i => i.name === 'Plate Carrier');
  assert.equal(gearProfile(carrier).family, carrier.family); assert.ok(['Light', 'Medium', 'Heavy'].includes(carrier.family));
  assert.equal(gearProfile(EQUIPMENT_CATALOG.find(i => i.name === 'Tactical HUD Interface')).family, 'Neural', 'Sensory counts as Neural');
});

test('armor: one worn at a time, others carried; older inventories wear the first unmarked one (v2.30.0)', async () => {
  const { installGear, wearArmor, removeGear, wornArmor } = await import('../src/gear.js');
  const { EQUIPMENT_CATALOG } = await import('../src/equipmentLibrary.js');
  const a = EQUIPMENT_CATALOG.find(i => i.name === 'Plate Carrier'), b = EQUIPMENT_CATALOG.find(i => i.name === 'Voidsuit (Combat)');
  let t = { id: 'arm', name: 'Kael', isPlayer: true, level: 2, ancestry: 'Human', hp: { current: 6, max: 6, majorThreshold: 4, severeThreshold: 6 }, armor: { current: 0, max: 0 }, stress: { current: 0, max: 6 }, inventory: { weapons: [], items: [] } };
  const apply = patch => { t = { ...t, ...patch }; };
  apply(installGear(t, t.inventory, a, 'a')); apply(installGear(t, t.inventory, b, 'b'));
  assert.equal(t.inventory.items.length, 2, 'putting on another keeps the first, carried');
  assert.equal(wornArmor(t.inventory).id, 'b'); assert.equal(t.armor.max, b.armorSlots); assert.equal(t.hp.majorThreshold, b.majorThreshold + 2);
  apply(wearArmor(t, t.inventory, 'a')); assert.equal(wornArmor(t.inventory).id, 'a'); assert.equal(t.armor.max, a.armorSlots);
  apply(removeGear(t, t.inventory, 'b')); assert.equal(t.armor.max, a.armorSlots, 'removing a carried armor changes nothing');
  apply(wearArmor(t, t.inventory, null)); assert.equal(wornArmor(t.inventory), null); assert.deepEqual([t.hp.majorThreshold, t.hp.severeThreshold, t.armor.max], [4, 6, 0]);
  assert.equal(wornArmor({ items: [{ id: 'x', name: 'Plate Carrier' }, { id: 'y', name: 'Voidsuit (Combat)' }] }).id, 'x');
});
