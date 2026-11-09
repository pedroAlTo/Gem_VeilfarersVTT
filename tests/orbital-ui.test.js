import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { drawWaterSurface, drawBlackHole, renderWeatherRain, renderWeatherFog } from '../src/surfaceFX.js';
import { gaugeState, drawTokenGauge } from '../src/tokenVitals.js';
import { FXEngine } from '../src/fxEngine.js';
const dom = new JSDOM('<body><div id="overlay"></div></body>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','customElements','MutationObserver','localStorage','Event','CustomEvent']) globalThis[key]=dom.window[key];
const {store}=await import('../src/state.js');await store.ready;
const {ClocksManager}=await import('../src/clocksManager.js');
const {GridScalerHUD}=await import('../src/gridScalerHUD.js');
const {audio}=await import('../src/audioEngine.js');audio.muted=true;
const initial=structuredClone(store.state);
const overlay=document.getElementById('overlay');
overlay.getBoundingClientRect=()=>({width:800,height:600,x:0,y:0});
Object.defineProperty(dom.window.HTMLElement.prototype,'offsetWidth',{get(){return this.classList.contains('clock-widget')?218:0;}});
Object.defineProperty(dom.window.HTMLElement.prototype,'offsetHeight',{get(){return this.classList.contains('collapsed')?94:190;}});
const manager=new ClocksManager(overlay);
beforeEach(async()=>{
  await store.saveQueue.catch(()=>{});
  store.state=structuredClone(initial);store.sessionRole='local';store.undoManager=null;
  store.state.clocks=[{id:'test_clock',title:'Air supply',filled:2,segments:6,posX:80,posY:100,category:'danger'}];
  manager.expanded.clear();manager.localPositions.clear();manager.draggedWidget=null;manager.render();
});
after(async()=>{await store.saveQueue.catch(()=>{});dom.window.close();});
function pointer(target,type,x,y,id=1){
  const event=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});
  Object.defineProperty(event,'pointerId',{value:id});target.dispatchEvent(event);
}
const widget=()=>overlay.querySelector('.clock-widget');
const handle=()=>overlay.querySelector('.clock-drag-handle');
test('compact clocks drag, persist and preserve progress across rendering',()=>{
  pointer(handle(),'pointerdown',100,120);pointer(window,'pointermove',330,250);pointer(window,'pointerup',330,250);
  assert.equal(store.state.clocks[0].posX,310);assert.equal(store.state.clocks[0].posY,230);assert.equal(store.state.clocks[0].filled,2);
  manager.render();assert.equal(widget().style.left,'310px');
  widget().querySelector('.clock-collapse-btn').click();
  assert.equal(widget().style.left,'310px');assert.equal(widget().classList.contains('collapsed'),false);
});
test('expanded clock clamps to viewport edges, including coordinate zero',()=>{
  manager.expanded.add('test_clock');manager.render();
  pointer(handle(),'pointerdown',100,120);pointer(window,'pointermove',-500,-500);pointer(window,'pointerup',-500,-500);
  assert.equal(store.state.clocks[0].posX,0);assert.equal(store.state.clocks[0].posY,0);
  pointer(handle(),'pointerdown',10,10);pointer(window,'pointermove',2000,2000);pointer(window,'pointerup',2000,2000);
  assert.equal(store.state.clocks[0].posX,582);assert.equal(store.state.clocks[0].posY,410);
});
test('clock buttons do not start a drag and cancellation restores saved position',()=>{
  pointer(widget().querySelector('button'),'pointerdown',100,120);assert.equal(manager.draggedWidget,null);
  pointer(handle(),'pointerdown',100,120);pointer(window,'pointermove',200,220,2);assert.equal(widget().style.left,'80px');
  pointer(window,'pointermove',200,220);pointer(window,'pointercancel',200,220);
  assert.equal(store.state.clocks[0].posX,80);assert.equal(widget().style.left,'80px');
});
test('keyboard position changes survive reload and retain keyboard focus',()=>{
  handle().dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  assert.equal(store.state.clocks[0].posX,90);assert.equal(document.activeElement,handle());
  handle().dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',shiftKey:true,bubbles:true,cancelable:true}));
  assert.equal(store.state.clocks[0].posY,101);
});
test('player clock arrangement cannot modify the shared campaign',()=>{
  store.sessionRole='player';
  pointer(handle(),'pointerdown',100,120);pointer(window,'pointermove',200,220);pointer(window,'pointerup',200,220);
  assert.equal(store.state.clocks[0].posX,80);assert.equal(widget().style.left,'180px');
});
test('resizing keeps clock controls reachable without overwriting saved layout',()=>{
  overlay.getBoundingClientRect=()=>({width:320,height:260});manager.onResize();
  assert.ok(parseFloat(widget().style.left)<=102);assert.ok(parseFloat(widget().style.top)<=166);
  assert.equal(store.state.clocks[0].posX,80);
  overlay.getBoundingClientRect=()=>({width:800,height:600});
});
function context(){
  const commands=[];
  const gradient={addColorStop(...args){commands.push(['stop',...args]);}};
  const ctx=new Proxy({globalAlpha:1,measureText:s=>({width:s.length*6})},{get(target,key){
    if(key in target)return target[key];
    if(String(key).startsWith('create'))return (...args)=>{commands.push([key,...args]);return gradient;};
    return (...args)=>{commands.push([key,...args]);};
  }});
  return {ctx,commands};
}
test('polygon and rectangular water clip every animation pass and restore the context',()=>{
  for(const zone of [{x:0,y:0,width:400,height:300},{shape:'polygon',points:[{x:0,y:0},{x:400,y:0},{x:200,y:100},{x:400,y:300},{x:0,y:300}]}]){
    const {ctx,commands}=context();assert.equal(drawWaterSurface(ctx,zone,4),true);
    assert.ok(commands.findIndex(c=>c[0]==='clip')<commands.findIndex(c=>c[0]==='fillRect'));
    assert.equal(commands.at(-1)[0],'restore');
    assert.ok(commands.filter(c=>c[0]==='ellipse').length>0);
  }
});
test('water culls invisible zones, bounds huge maps and respects zero flow',()=>{
  const huge={x:0,y:0,width:1e7,height:1e7,flowSpeed:0};
  const a=context(),b=context();drawWaterSurface(a.ctx,huge,0);drawWaterSurface(b.ctx,huge,300);
  assert.deepEqual(a.commands,b.commands);assert.ok(a.commands.length<5000);
  const invisible=context();assert.equal(drawWaterSurface(invisible.ctx,huge,0,{viewport:{minX:-100,minY:-100,maxX:-1,maxY:-1}}),false);
  assert.equal(invisible.commands.length,0);
});
test('black hole instant bursts survive emitter cleanup; removed persistent holes disappear',()=>{
  const fx=new FXEngine();fx.createVoidRift(0,0,{id:'burst'});fx.createVoidRift(0,0,{id:'persistent',decay:0});
  fx.updateEmitters([],0.1);assert.deepEqual(fx.voidRifts.map(r=>r.id),['burst']);
});
test('black hole can exist at particle budget and restores canvas state at every quality',()=>{
  const fx=new FXEngine();fx.maxParticles=0;fx.updateEmitters([{id:'hole',type:'void_rift',x:10,y:20,radius:80}],1);
  assert.equal(fx.voidRifts.length,1);
  for(const quality of ['eco','balanced','ultra']){
    const {ctx,commands}=context();drawBlackHole(ctx,fx.voidRifts[0],quality);
    assert.equal(commands.filter(c=>c[0]==='save').length,commands.filter(c=>c[0]==='restore').length);
    assert.ok(commands.every(c=>c.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));
  }
});
test('weather rain clips surface rings; fog retains its independent atmospheric pass',()=>{
  assert.equal(renderWeatherRain(null, { viewport: { width: 0, height: 0 } }), false);
  assert.equal(renderWeatherFog(null, { viewport: { width: 0, height: 0 } }), false);
  const viewport = { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600, zoom: 1 };
  const waterZone = { x: 100, y: 100, width: 200, height: 150 };
  for (const quality of ['eco', 'balanced', 'ultra']) {
    const { ctx, commands } = context();
    const result = renderWeatherRain(ctx, { map: { waterZones: [waterZone] }, viewport, time: 5, quality });
    assert.equal(result, true);
    assert.equal(commands.filter(c => c[0] === 'save').length, commands.filter(c => c[0] === 'restore').length);
    assert.ok(!commands.some(c => c[0] === 'lineTo'));
    assert.ok(commands.some(c => c[0] === 'clip'));
    assert.ok(commands.some(c => c[0] === 'ellipse'));
  }
  for (const density of ['light', 'medium', 'dense']) {
    const { ctx, commands } = context();
    const fogRes = renderWeatherFog(ctx, { map: { fogDensity: density }, viewport, time: 8, quality: 'balanced' });
    assert.equal(fogRes, true);
    assert.equal(commands.filter(c => c[0] === 'save').length, commands.filter(c => c[0] === 'restore').length);
    assert.ok(commands.some(c => c[0] === 'arc'));
    assert.ok(commands.some(c => c[0] === 'ellipse'));
  }
});
test('HP and Stress warn at opposite ends; gauges retain numeric values without overflow',()=>{
  assert.equal(gaugeState(1,6,'hp').danger,true);assert.equal(gaugeState(1,6,'stress').danger,false);
  assert.equal(gaugeState(6,6,'stress').danger,true);assert.equal(gaugeState(20,6).ratio,1);
  assert.equal(gaugeState(NaN,0).ratio,0);
  const {ctx,commands}=context();drawTokenGauge(ctx,{x:0,y:0,width:86,current:3,max:6,key:'hp'});
  assert.ok(commands.some(c=>c[0]==='fillText'&&c[1]==='3/6'));
});

test('arranging clocks restores an accessible layout without changing their progress',()=>{
  store.state.clocks.push({...store.state.clocks[0],id:'second',posX:9999,posY:9999,filled:4});
  manager.arrangeClocks();
  assert.deepEqual(store.state.clocks.map(c=>c.filled),[2,4]);
  assert.ok(store.state.clocks.every(c=>c.posX>=0&&c.posX<=582&&c.posY>=0&&c.posY<=506));
  assert.notEqual(store.state.clocks[0].posX,store.state.clocks[1].posX);
});

test('grid scaler HUD opens color picker popover and updates grid color without reference error', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  store.state.userRole = 'keeper';
  const hud = new GridScalerHUD(container);
  hud.isOpen = true;
  hud.render();
  const colorBtn = container.querySelector('#grid_color_btn');
  assert.ok(colorBtn, 'grid_color_btn should exist');
  assert.doesNotThrow(() => {
    colorBtn.click();
  });
  const popover = document.querySelector('.cyber-color-popover');
  assert.ok(popover, 'Color popover should be open');
  const amberSwatch = popover.querySelector('[data-color="#f59e0b"]');
  assert.ok(amberSwatch, 'Amber swatch exists');
  amberSwatch.click();
  assert.equal(store.getActiveMap().gridColor, '#f59e0b');
  popover.querySelector('.pop-ok-btn')?.click();
  container.remove();
});
