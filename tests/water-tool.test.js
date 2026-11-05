import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { waterGeometry, pointInWater } from '../src/waterGeometry.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const eventErrors=[], virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>eventErrors.push(error));
const dom=new JSDOM(html,{url:'http://localhost/',pretendToBeVisual:true,virtualConsole});
for (const k of ['window','document','HTMLElement','customElements','MutationObserver','localStorage','Event','CustomEvent','MouseEvent','Image']) globalThis[k]=dom.window[k];
dom.window.HTMLCanvasElement.prototype.getContext=()=>({});
const {store}=await import('../src/state.js');await store.ready;
const {CanvasEngine}=await import('../src/canvasEngine.js');
const {undoManager}=await import('../src/undoManager.js');
const {audio}=await import('../src/audioEngine.js');audio.muted=true;
const {initWaterControls}=await import('../src/waterControls.js');
const {NetworkManager}=await import('../src/networkManager.js');
const original=structuredClone(store.state);
// Rendering is covered by surfaceFX tests. Exercise the actual canvas event handlers here.
class EventCanvas extends CanvasEngine { startLoop() {} }
const canvas=document.getElementById('tactical_canvas');
canvas.getBoundingClientRect=()=>({left:0,top:0,width:900,height:600});
const engine=new EventCanvas(canvas), stopControls=initWaterControls();
beforeEach(async()=>{
  await store.saveQueue.catch(()=>{}); store.sessionRole='local';store.remoteApplying=false;store.sessionBusy=false;
  store.state=structuredClone(original);store.state.campaignId=crypto.randomUUID();store.state.tokens=[];
  const map=store.getActiveMap();map.walls=[];map.lights=[];map.effects=[];map.waterZones=[];
  engine.zoom=1;engine.panX=0;engine.panY=0;engine.isPanning=false;engine.isSpacePressed=false;
  engine.draggedWater=null;engine.draggedToken=null;engine.preDragSnapshot=null;engine.templates=[];engine.activeTemplate=null;
  engine.rulerStart=null;engine.wallStart=null;engine.gridCalibStart=null;engine.cancelWaterDrawing();
  undoManager.undoStack=[];undoManager.redoStack=[];undoManager._activeGroupKey=null;undoManager._lastGroupTime=0;store.undoManager=undoManager;store._skipNextUndoSnapshot=false;
  store.update({activeTool:'water',waterDrawMode:'polygon'});document.activeElement?.blur?.();
});
afterEach(()=>assert.deepEqual(eventErrors.splice(0),[], 'canvas events must not throw'));
after(async()=>{stopControls();engine.waterUnsubscribe();await store.saveQueue.catch(()=>{});dom.window.close();});
const mouse=(type,x,y,detail=1,target=canvas,button=0)=>target.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x*engine.zoom+engine.panX,clientY:y*engine.zoom+engine.panY,button,detail}));
const click=(x,y,detail=1)=>{mouse('mousedown',x,y,detail);mouse('mouseup',x,y,detail);};
const key=(key)=>window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,code:key,bubbles:true,cancelable:true}));
const zones=()=>store.getActiveMap().waterZones;
const triangle=()=>{click(0,0);click(180,0);click(80,140);};

test('polygon creation preserves vertices, zero coordinates and independent copies through saves and snapshots', async()=>{
  triangle();key('Enter');assert.equal(zones().length,1);
  const zone=zones()[0];assert.equal(zone.shape,'polygon');assert.deepEqual(zone.points,[{x:0,y:0},{x:180,y:0},{x:80,y:140}]);
  assert.deepEqual([zone.x,zone.y,zone.width,zone.height],[0,0,180,140]);assert.equal(engine.waterPolyPoints.length,0);
  const imported=store.normalizeCampaign(JSON.parse(JSON.stringify(store.serializeCampaign())));
  assert.deepEqual(imported.maps.find(m=>m.id===store.state.activeMapId).waterZones[0].points,zone.points);
  const n=new NetworkManager();assert.deepEqual(n.snapshotFor('guest').maps[0].waterZones[0].points,zone.points);n.disconnect();
  store.update({activeTool:'water',waterDrawMode:'polygon'});triangle();key('Enter');assert.notEqual(zones()[0].id,zones()[1].id);
  zones()[1].points[0].x=20;assert.equal(zones()[0].points[0].x,0);
});

test('a complete browser double-click sequence closes once without duplicate vertices or a ghost draft',()=>{
  click(10,10);click(180,10);click(80,140,1);click(80,140,2);mouse('dblclick',80,140,2);
  assert.equal(zones().length,1);assert.equal(zones()[0].points.length,3);assert.equal(engine.waterPolyPoints.length,0);
  key('Enter');assert.equal(zones().length,1);
});

test('closing on the first vertex uses a consistent screen-sized hit area at different zooms',()=>{
  for(const zoom of [.2,1,5]){
    engine.zoom=zoom;triangle();click(10/zoom,0);assert.equal(engine.waterPolyPoints.length,0);
  }
  assert.equal(zones().length,3);assert.ok(zones().every(z=>z.points.length===3));
});

test('toolbar mode buttons create the chosen shape and provide close/cancel controls',()=>{
  document.getElementById('water_btn_box').click();assert.equal(store.state.waterDrawMode,'box');
  mouse('mousedown',0,0);mouse('mousemove',120,80);mouse('mouseup',120,80);
  assert.equal(zones()[0].shape,'box');assert.deepEqual([zones()[0].x,zones()[0].y,zones()[0].width,zones()[0].height],[0,0,120,80]);
  document.getElementById('water_btn_poly').click();assert.equal(store.state.waterDrawMode,'polygon');
  triangle();assert.equal(document.getElementById('water_finish').disabled,false);document.getElementById('water_finish').click();
  assert.equal(zones()[1].shape,'polygon');assert.equal(document.getElementById('water_finish').disabled,true);
  click(20,20);document.getElementById('water_cancel').click();assert.equal(engine.waterPolyPoints.length,0);
});

test('switching tool or shape cancels unfinished geometry; returning does not resume it',()=>{
  triangle();store.update({activeTool:'select'});assert.equal(engine.waterPolyPoints.length,0);assert.equal(document.getElementById('water_flyout').style.display,'none');
  key('Enter');assert.equal(zones().length,0);store.update({activeTool:'water'});click(20,20);assert.equal(engine.waterPolyPoints.length,1);
  store.update({waterDrawMode:'box'});assert.equal(engine.waterPolyPoints.length,0);
  mouse('mousedown',10,10);mouse('mousemove',200,200);store.update({activeTool:'measure'});mouse('mouseup',200,200);
  assert.equal(zones().length,0);assert.equal(engine.waterStart,null);assert.equal(engine.waterCurrent,null);
});

test('scene, campaign, role and layer changes discard a pending polygon',()=>{
  const id=store.state.activeMapId;
  for(const change of [{activeMapId:'other-map'},{campaignId:'other-campaign'},{userRole:'player'},{activeLayer:'water'},{layerLocked:{...store.state.layerLocked,water:true}},{layerVisibility:{...store.state.layerVisibility,water:false}}]){
    store.update({activeMapId:id,userRole:'keeper',activeLayer:'tokens',layerLocked:{...store.state.layerLocked,water:false},layerVisibility:{...store.state.layerVisibility,water:true}});
    triangle();assert.equal(engine.waterPolyPoints.length,3);store.update(change);assert.equal(engine.waterPolyPoints.length,0);
  }
});

test('Escape, context menu, lost focus and pointer cancellation leave no water draft or accidental deletions',()=>{
  store.getActiveMap().walls=[{id:'keep-wall',x1:0,y1:0,x2:180,y2:0}];
  for(const cancel of [()=>key('Escape'),()=>mouse('contextmenu',0,0),()=>window.dispatchEvent(new Event('blur')),()=>canvas.dispatchEvent(new Event('pointercancel'))]){
    triangle();cancel();assert.equal(engine.waterPolyPoints.length,0);assert.equal(engine.waterCurrent,null);assert.equal(zones().length,0);
    assert.equal(store.getActiveMap().walls.length,1);
  }
});

test('Backspace removes the last vertex and degenerate polygons cannot create a default rectangle',()=>{
  click(0,0);click(100,0);click(200,0);key('Enter');assert.equal(zones().length,0);assert.equal(engine.waterPolyPoints.length,3);
  key('Backspace');assert.equal(engine.waterPolyPoints.length,2);click(100,100);key('Enter');assert.equal(zones().length,1);
  assert.equal(zones()[0].shape,'polygon');
});

test('water creation is one undoable action and redo restores its real geometry',()=>{
  triangle();key('Enter');const points=structuredClone(zones()[0].points);
  assert.equal(undoManager.undoStack.length,1);undoManager.undo();assert.equal(zones().length,0);
  undoManager.redo();assert.deepEqual(zones()[0].points,points);
});

test('successive water zones and separate edits have independent undo steps; cancelling a draft adds none',()=>{
  triangle();key('Enter');triangle();key('Enter');assert.equal(zones().length,2);assert.equal(undoManager.undoStack.length,2);
  const id=zones()[1].id;
  store.updateWaterZone(id,{depth:3});undoManager._lastGroupTime=0;store.updateWaterZone(id,{depth:4});
  assert.equal(undoManager.undoStack.length,4);undoManager.undo();assert.equal(zones()[1].depth,3);
  undoManager.undo();assert.equal(zones()[1].depth,2);
  click(30,30);key('Escape');assert.equal(undoManager.undoStack.length,2);
  undoManager.undo();assert.equal(zones().length,1);undoManager.undo();assert.equal(zones().length,0);
  undoManager.redo();undoManager.redo();assert.equal(zones().length,2);
});

test('keyboard activation of water buttons does not trigger the canvas Enter shortcut',()=>{
  triangle();const button=document.getElementById('water_cancel');
  button.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
  assert.equal(zones().length,0);button.click();assert.equal(engine.waterPolyPoints.length,0);
});

test('polygon vertex editing keeps bounds current and token water effects respect concave boundaries',()=>{
  triangle();key('Enter');store.update({activeTool:'select'});
  mouse('mousedown',180,0);mouse('mousemove',220,20);mouse('mouseup',220,20);
  assert.deepEqual(zones()[0].points[1],{x:220,y:20});assert.equal(zones()[0].width,220);
  const concave=waterGeometry({shape:'polygon',points:[{x:0,y:0},{x:200,y:0},{x:200,y:50},{x:50,y:50},{x:50,y:200},{x:0,y:200}]});
  assert.equal(pointInWater(25,150,concave),true);assert.equal(pointInWater(150,150,concave),false);
});

test('players and locked or hidden water layers cannot leave drafts or create water',()=>{
  for(const change of [{userRole:'player'},{userRole:'keeper',layerLocked:{...store.state.layerLocked,water:true}},{layerLocked:{...store.state.layerLocked,water:false},layerVisibility:{...store.state.layerVisibility,water:false}}]){
    store.update(change);triangle();key('Enter');assert.equal(engine.waterPolyPoints.length,0);assert.equal(zones().length,0);
  }
  store.sessionRole='player';assert.equal(store.addWaterZone({shape:'polygon',points:[{x:0,y:0},{x:100,y:0},{x:0,y:100}]}),null);
});
