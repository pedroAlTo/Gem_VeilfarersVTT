import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRainRipples, renderWeatherRain } from '../src/surfaceFX.js';
import { pointInWater } from '../src/waterGeometry.js';
const rectangle={id:'pond',x:0,y:0,width:800,height:600};
const concave={id:'shore',shape:'polygon',points:[{x:0,y:0},{x:800,y:0},{x:800,y:600},{x:500,y:600},{x:500,y:200},{x:300,y:200},{x:300,y:600},{x:0,y:600}]};
function context(){
  const calls=[];
  const ctx=new Proxy({}, {
    get:(target,key)=>key in target?target[key]:(...args)=>calls.push([key,...args]),
    set:(target,key,value)=>{target[key]=value;calls.push(['set',key,value]);return true;}
  });
  return {ctx,calls};
}
function render(zone,time=3,options={}){
  const {ctx,calls}=context(),drawn=drawRainRipples(ctx,zone,time,options);
  return {drawn,calls,rings:calls.filter(c=>c[0]==='ellipse')};
}
test('rain draws only clipped rings with centers inside rectangular and concave water',()=>{
  for(const zone of [rectangle,concave]){
    const {drawn,calls,rings}=render(zone);assert.equal(drawn,true);assert.ok(rings.length>10);
    const clip=calls.findIndex(c=>c[0]==='clip');assert.ok(clip<calls.findIndex(c=>c[0]==='stroke'));
    assert.ok(rings.every(([,x,y])=>pointInWater(x,y,zone)));
    assert.ok(!calls.slice(clip).some(c=>['lineTo','moveTo','fillRect'].includes(c[0])));
    assert.equal(calls.at(-1)[0],'restore');
  }
});
test('ripples expand continuously and change locations between impact cycles',()=>{
  const a=render(rectangle,3),b=render(rectangle,3.005);
  assert.deepEqual(a.calls,render(rectangle,3).calls);assert.notDeepEqual(a.rings,b.rings);
  const centers=rings=>new Set(rings.map(([,x,y])=>`${x}:${y}`));
  const first=centers(a.rings),second=centers(b.rings);
  assert.ok([...first].filter(p=>second.has(p)).length>first.size*.9);
  assert.notDeepEqual(first,centers(render(rectangle,12).rings));
});
test('panning preserves shared visible ripple positions and phases',()=>{
  const zone={...rectangle,width:2000,height:1000};
  const a=render(zone,4,{viewport:{minX:0,minY:0,maxX:800,maxY:600}});
  const b=render(zone,4,{viewport:{minX:100,minY:0,maxX:900,maxY:600}});
  const interior=r=>r[1]>=130&&r[1]<=770;
  assert.ok(a.rings.filter(interior).length);assert.deepEqual(a.rings.filter(interior),b.rings.filter(interior));
});
test('offscreen, invalid and reduced-motion water do not draw rain',()=>{
  for(const result of [render(rectangle,2,{reducedMotion:true}),render(rectangle,2,{viewport:{minX:1000,minY:1000,maxX:1100,maxY:1100}}),render({shape:'polygon',points:[]}),render({...rectangle,width:0}),render(rectangle,NaN)]){
    assert.equal(result.drawn,false);assert.deepEqual(result.calls,[]);
  }
  const {ctx,calls}=context();assert.equal(renderWeatherRain(ctx,{map:{waterZones:[]},viewport:{minX:0,minY:0,maxX:800,maxY:600,width:800,height:600}}),false);assert.deepEqual(calls,[]);
});
test('huge and narrow maps have bounded finite drawing at every quality and intensity',()=>{
  for(const quality of ['eco','balanced','ultra'])for(const intensity of ['drizzle','rain','storm'])for(const size of [{width:1e7,height:1e7},{width:1e7,height:30}]){
    const {calls,rings}=render({...rectangle,...size},100,{quality,intensity});
    assert.ok(rings.length<=1024);assert.ok(calls.length<9000);
    assert.ok(rings.every(c=>c.slice(1).every(Number.isFinite)));
    assert.equal(calls.filter(c=>c[0]==='save').length,calls.filter(c=>c[0]==='restore').length);
  }
});
test('drizzle, rain and storm retain different surface impact densities',()=>{
  const density=intensity=>[1,2,3,4,5].reduce((sum,time)=>sum+render(rectangle,time,{intensity}).rings.length,0);
  assert.ok(density('drizzle')<density('rain'));assert.ok(density('rain')<density('storm'));
});
