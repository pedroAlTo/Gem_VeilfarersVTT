import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createActor } from '../src/actors.js';
import { BANDS, WEAPONS, createEncounter, crewEvasion, hullLoss, inRange, publicEncounter, sensorDC, validEncounter } from '../src/naval/encounter.js';
import { layoutEncounter, headingYaw, boundaries } from '../src/naval/layout.js';
import { resolveNavalAction } from '../src/naval/actions.js';

const dom = new JSDOM('<body></body>', { url: 'http://localhost' });
for (const key of ['window','document','HTMLElement','customElements','MutationObserver','localStorage','Event','CustomEvent','FormData']) globalThis[key] = dom.window[key];
const { store: singleton } = await import('../src/state.js');
const { performGameAction } = await import('../src/gameActions.js');
const { NetworkManager } = await import('../src/networkManager.js');
const { validateCampaign } = await import('../src/validation.js');
await singleton.ready;
const fresh = structuredClone(singleton.state);
after(() => dom.window.close());

async function table() {
  const store = new singleton.constructor();
  await store.ready;
  store.state = structuredClone(fresh);
  store.state.userRole = 'keeper';
  store.saveToStorage = () => {};
  const id = store.state.activeMapId;
  const names = ['Maren','Saber','Vell','Tovel'];
  const tokens = names.map(name => createActor({ name, ownerId: name, controllerIds: [name] }, id));
  tokens[0].traits.instinct = 2;
  store.state.tokens = tokens;
  store.getActiveMap().naval = createEncounter(tokens, id, tokens[0].id);
  const current = () => store.getActiveMap().naval;
  const command = (order, options = {}) => {
    const { round, revision, crew } = current();
    return { type: options.station ? 'NAVAL_STATION' : 'NAVAL_KEEPER', actorId: crew[options.station],
      mapId: id, round, revision, order, contactId: 'skarrh', arc: 'fore', ...options };
  };
  const run = (order, options) => performGameAction(command(order,options),store);
  return {store, tokens, id, current, command, run};
}

test('las bandas fijan la distancia y la altura solo cambia la previsualización', async () => {
  const {current} = await table();
  assert.deepEqual(BANDS.map(sensorDC), [5,10,15,20,25]);
  assert.deepEqual([0,5,6,12,13,20,21,30,31,40,41].map(hullLoss), [0,1,2,2,3,3,4,4,5,5,6]);
  const low = layoutEncounter(current(),'skarrh','aggressive',-3,true);
  const high = layoutEncounter(current(),'skarrh','aggressive',3,true);
  assert.deepEqual(low.own,high.own);
  assert.equal(low.ghost[0], high.ghost[0]); assert.equal(low.ghost[2], high.ghost[2]);
  assert.equal(low.ghost[1],-3); assert.equal(high.ghost[1],3);
  const radius = Math.hypot(high.ghost[0]-high.center[0],high.ghost[2]-high.center[2]);
  assert.ok(radius > boundaries[0] && radius < boundaries[1]);
  assert.notDeepEqual(layoutEncounter(current(),'beacon','close',0,true).center,high.center);
  assert.equal(layoutEncounter(current(),'skarrh','close',2,false).ghost,null);
  assert.equal(headingYaw([0,0,0],[1,0,0],'aft'), Math.PI);
  assert.ok(!inRange(WEAPONS.plasma,'Standard') && inRange(WEAPONS.plasma,'Engagement'));
  assert.ok(!inRange(WEAPONS.pulse,'Standard') && inRange(WEAPONS.missile,'Standard'));
});

test('la ronda del ejemplo resuelve motor, maniobra, escudos, casco, sensores y regeneración', async () => {
  const {current,run,store,tokens,command} = await table();
  assert.throws(()=>run('act',{station:'pilot',move:'aggressive'}), /motor/);
  run('drive',{drive:'Combat'});
  assert.equal(store.state.starship.heat,1); assert.equal(crewEvasion(store.state.starship,current(),tokens),15);
  assert.throws(()=>run('act',{station:'gunner',weapon:'plasma'}), /alcance/);
  const roll=run('act',{station:'pilot',move:'aggressive',faces:[8,4]});
  assert.equal(roll.total,15); assert.equal(current().contacts[0].band,'Engagement');
  assert.equal(crewEvasion(store.state.starship,current(),tokens),14);
  assert.throws(()=>run('act',{station:'pilot',move:'aggressive'}), /Spotlight/);
  const shot=resolveNavalAction(store,command('act',{station:'gunner',weapon:'plasma'}), act => {
    assert.equal(act.options.customMod,1); return {total:16,dc:act.options.dc};
  },()=>7);
  assert.equal(shot.dc,undefined);
  assert.equal(current().contacts[0].privateShip.shieldArcs.fore,0);
  assert.equal(current().contacts[0].privateShip.hull,18);
  assert.equal(current().contacts[0].visibleDamage,true);
  run('cool',{station:'engineer'}); assert.equal(store.state.starship.heat,0);
  const sensor=store.state.tokens.find(t=>t.id===current().crew.sensors);
  store.updateToken(sensor.id,{pendingCheckBonus:7,pendingAdvantage:true});
  const lock=run('act',{station:'sensors',faces:[8,6]});
  assert.equal(lock.total,14); assert.equal(current().contacts[0].locked,true);
  assert.equal(store.state.tokens.find(t=>t.id===sensor.id).pendingCheckBonus,7);
  run('round');
  assert.equal(current().contacts[0].privateShip.shieldArcs.fore,2);
  assert.equal(current().drive,null); assert.deepEqual(current().spent,{});
  assert.equal(current().round,2); assert.equal(current().contacts[0].locked,true);
  run('drive',{drive:'Cruise'});
  const attack=run('act',{station:'gunner',weapon:'plasma',faces:[9,4,5]});
  assert.equal(attack.advVal,5); assert.equal(current().contacts[0].locked,false);
});

test('el puesto no se puede gastar dos veces, tampoco con un segundo token del jugador', async () => {
  const {store,command,current,run,tokens,id}=await table();
  const second=createActor({name:'Aliado',ownerId:'Maren'},id);
  store.state.tokens.push(second);
  const auto=createEncounter([tokens[0],second,...tokens.slice(1)],id,tokens[0].id);
  assert.equal(auto.crew.gunner,tokens[1].id);
  run('drive',{station:'pilot',drive:'Combat'});
  const pending=command('act',{station:'pilot',move:'aggressive',faces:[9,3]});
  performGameAction(pending,store);
  assert.throws(()=>performGameAction(pending,store),/escena o la ronda/);
  assert.throws(()=>run('assign',{type:'NAVAL_KEEPER',station:'sensors',assignment:second.id}),/ya actuó/);
  store.state.roomPaused=true;
  assert.throws(()=>run('cool',{station:'engineer'}),/pausa/);
  assert.equal(current().spent.engineer,undefined);
});

test('el Keeper aplica las órdenes del puesto asignado y un invitado reconectado recupera la banda y la ronda', async () => {
  const {store,run,current,command,tokens}=await table();
  store.sessionRole='host'; store.state.isHosting=true;
  const host=new NetworkManager({stateStore:store});
  host.room='NAVAL'; host.members.set('wire-a',{id:'Maren'});
  const messages=[];
  host.connections.set('wire-a',{peer:'wire-a',open:true,send:message=>messages.push(message)});
  const submit=async action=>{
    const requestId='request-'+messages.length;
    await host.handleIncomingMessage(host.envelope({type:'ACTION',action,requestId}),'wire-a');
    return messages.find(m=>m.type==='ACTION_RESULT' && m.requestId===requestId);
  };
  run('drive',{drive:'Combat'});
  const denied=await submit(command('act',{station:'gunner',weapon:'plasma'}));
  assert.ok(denied.error);
  const keeperOrder=await submit(command('round',{actorId:tokens[0].id}));
  assert.ok(keeperOrder.error);
  const order=command('act',{station:'pilot',move:'aggressive',faces:[8,4]});
  const accepted=await submit(order);
  assert.equal(accepted.result.total,15);
  assert.ok((await submit(order)).error); assert.equal(current().revision,2);
  host.members.delete('wire-a');
  host.members.set('wire-b',{id:'Maren'});
  const reconnect=host.snapshotFor('wire-b');
  assert.equal(reconnect.claimedTokenId,tokens[0].id);
  assert.equal(reconnect.maps[0].naval.contacts[0].band,'Engagement');
  assert.equal(reconnect.maps[0].naval.spent.pilot,tokens[0].id);
  assert.equal(reconnect.maps[0].naval.contacts[0].privateShip,undefined);
  clearTimeout(host.syncTimer);
});

test('Fallos con Hope y Fear, Overdrive y dados iguales usan los resultados del Core', async () => {
  for(const [drive,faces,extraHeat,exposed,driveDamage] of [
    ['Combat',[3,1],0,false,0], ['Combat',[1,3],1,true,0], ['Overdrive',[1,2],1,false,1],
  ]) {
    const {run,store,current} = await table(); run('drive',{drive});
    const initialHeat=store.state.starship.heat, initialFear=store.state.fear;
    run('act',{station:'pilot',move:'aggressive',faces});
    assert.equal(store.state.starship.heat,initialHeat+extraHeat);
    assert.equal(current().contacts[0].band,'Standard');
    assert.equal(current().pilotEffect.exposed,exposed?'fore':undefined);
    assert.equal(store.state.starship.systems['Primary Drive'],3-driveDamage);
    assert.equal(store.state.fear,Math.min(12,initialFear+(faces[1]>faces[0]?1:0)));
  }
  const {run,current}=await table(); run('drive',{drive:'Cruise'});
  assert.ok(run('act',{station:'pilot',move:'aggressive',faces:[1,1]}).isCritical);
  assert.equal(current().pilotEffect.aim,true);
});

test('la sesión guarda el enemigo entero y los invitados reciben una proyección sin números privados', async () => {
  const {store,current,run,command,tokens}=await table();
  const network=new NetworkManager({stateStore:store});
  run('drive',{drive:'Combat'});
  run('act',{station:'pilot',move:'aggressive',faces:[9,3]});
  current().contacts[0].privateShip.evasion=37;
  current().contacts.push({...current().contacts[1],id:'hidden-contact',name:'SECRET CONTACT',hidden:true});
  current().pilotEffect.privateFutureField='SECRET VALUE';
  const broadcasts=[];network.broadcast=message=>broadcasts.push(message);
  const reply=await network.performAction(command('act',{station:'gunner',weapon:'plasma',faces:[1,1]}));
  const guest=network.snapshotFor(tokens[0].ownerId);
  assert.doesNotThrow(()=>validateCampaign(guest));
  assert.ok(validEncounter(current()) && validEncounter(guest.maps[0].naval));
  assert.deepEqual(guest.maps[0].naval,publicEncounter(current()));
  const onWire=JSON.stringify([guest.maps[0].naval,guest.logs,reply,broadcasts]);
  assert.doesNotMatch(onWire,/privateShip|SECRET CONTACT|SECRET VALUE|DC 37|Evasion 37|"dc":37|Pulse Cannon|absorbidos/);
  assert.ok(store.state.logs.some(entry=>entry.visibility==='keeper' && entry.type==='NAVAL'));
  const saved=structuredClone(store.serializeCampaign());
  assert.equal(saved.maps.find(m=>m.id===store.state.activeMapId).naval.contacts[0].privateShip.evasion,37);
  const restored=await table();
  assert.equal(await restored.store.importCampaignJSON(JSON.stringify(saved)),true);
  assert.equal(restored.current().contacts[0].privateShip.evasion,37);
  assert.equal(restored.current().contacts[0].band,'Engagement');
  assert.equal(restored.current().spent.gunner,tokens[1].id);
  const old=structuredClone(saved);delete old.maps.find(m=>m.id===old.activeMapId).naval;
  assert.doesNotThrow(()=>validateCampaign(old));
});
