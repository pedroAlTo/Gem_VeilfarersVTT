import { CombatFX, drawFireArea, impactScale } from './combatFX.js';
import { drawBlackHole, drawWaterSurface, renderWeatherRain, renderWeatherFog } from './surfaceFX.js';
import './fxLab.css';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let rainIntensity = 'rain', fogEnabled = false;
const intensityButton=document.getElementById('rain_intensity'), fogButton=document.getElementById('lab_fog');
intensityButton.onclick=()=>{
  rainIntensity=({drizzle:'rain',rain:'storm',storm:'drizzle'})[rainIntensity];
  intensityButton.textContent='Lluvia: '+({drizzle:'llovizna',rain:'normal',storm:'tormenta'})[rainIntensity];
};
fogButton.onclick=()=>{fogEnabled=!fogEnabled;fogButton.setAttribute('aria-pressed',String(fogEnabled));fogButton.textContent='Bruma: '+(fogEnabled?'sí':'no');};
let quality = 'balanced', paused = reduced.matches, time = 0, previous = performance.now();
const pause = document.getElementById('pause');
function showPause() {
  pause.textContent = paused ? 'Reanudar' : 'Pausar';
  pause.setAttribute('aria-pressed',String(paused));
  document.getElementById('motion_status').textContent = paused ? 'ANIMACIÓN EN PAUSA' : 'ANIMACIÓN ACTIVA';
}
pause.onclick = () => { paused = !paused;showPause(); };
reduced.addEventListener('change', e=>{paused=e.matches;showPause();});
showPause();
document.querySelectorAll('[data-quality]').forEach(button=>button.onclick=()=>{
  quality=button.dataset.quality;
  document.querySelectorAll('[data-quality]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
});
const combatFX = new CombatFX();
let impactKind = 'ballistic', replay = true, nextReplay = 0;
document.querySelectorAll('[data-impact]').forEach(button => button.onclick = () => { impactKind = button.dataset.impact; replay = true; document.querySelectorAll('[data-impact]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); });
document.getElementById('lab_replay').onclick = () => replay = true;
document.getElementById('lab_hp').oninput = event => { document.getElementById('lab_hp_value').textContent = `${event.target.value} HP · ${Math.round(impactScale(+event.target.value) * 100)}%`; replay = true; };
document.getElementById('lab_shield').onchange = () => replay = true;
const canvases=['hole','water','rain','combat','fire_area'].map(id=>document.getElementById(id));
function setup(canvas) {
  if (!canvas) return null;
  const {width,height}=canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio || 1,2);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)) {
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  }
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#060c17';ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#4d79951c';ctx.lineWidth=0.5;ctx.beginPath();
  for(let x=0;x<width;x+=32){ctx.moveTo(x,0);ctx.lineTo(x,height);}
  for(let y=0;y<height;y+=32){ctx.moveTo(0,y);ctx.lineTo(width,y);}
  ctx.stroke();return {ctx,width,height};
}
function frame(now) {
  const dt = paused || document.hidden ? 0 : Math.min((now - previous) / 1000, .05);
  if(!paused && !document.hidden)time+=Math.min((now-previous)/1000,0.05);
  previous=now;
  const hole=setup(canvases[0]);
  if(hole) drawBlackHole(hole.ctx,{x:hole.width/2,y:hole.height/2,radius:Math.min(hole.width*.29,hole.height*.4),rotation:time*0.9,life:1},quality);
  const water=setup(canvases[1]);
  if(water) {
    const {ctx,width,height}=water;
    const pad=width*.06, middle=width*.52;
    drawWaterSurface(ctx,{x:pad,y:height*.15,width:width*.37,height:height*.7,depth:2,flowSpeed:1},time,{quality});
    drawWaterSurface(ctx,{shape:'polygon',depth:4,flowSpeed:0.6,points:[
      {x:middle,y:height*.15},{x:width-pad,y:height*.15},{x:width-pad,y:height*.85},
      {x:middle,y:height*.85},{x:middle,y:height*.62},{x:middle+width*.13,y:height*.52},{x:middle,y:height*.4}
    ]},time,{quality});
    ctx.fillStyle='#acd8df';ctx.font='10px monospace';ctx.fillText('DEPTH / 02',pad,height*.94);ctx.fillText('DEPTH / 04',middle,height*.94);
  }
  const rain=setup(canvases[2]);
  if(rain) {
    const {ctx,width,height}=rain;
    const waterZone = {
      shape: 'polygon',
      depth: 3,
      points: [
        { x: width * 0.18, y: height * 0.4 },
        { x: width * 0.82, y: height * 0.35 },
        { x: width * 0.86, y: height * 0.72 },
        { x: width * 0.52, y: height * 0.84 },
        { x: width * 0.14, y: height * 0.68 }
      ]
    };
    drawWaterSurface(ctx, waterZone, time, { quality, reducedMotion: paused });
    if (fogEnabled) renderWeatherFog(ctx, {
      map: { fogDensity: 'medium' },
      viewport: { minX: 0, minY: 0, maxX: width, maxY: height, width, height, zoom: 1 },
      time,
      quality,
      reducedMotion: paused
    });
    renderWeatherRain(ctx, {
      map: { waterZones: [waterZone], rainIntensity },
      viewport: { minX: 0, minY: 0, maxX: width, maxY: height, width, height, zoom: 1 },
      time,
      quality,
      reducedMotion: paused
    });
    ctx.fillStyle='#acd8df';ctx.font='10px monospace';ctx.fillText('WEATHER // RAIN, DRIFTING FOG & WATER RIPPLES',width*0.06,height*0.94);
  }
  const combat = setup(canvases[3]);
  if (combat) {
    const {ctx,width,height} = combat;
    const target = {x:width*.65,y:height*.48};
    ctx.strokeStyle='#82aebe';ctx.lineWidth=2;ctx.fillStyle='#172d40';ctx.beginPath();ctx.arc(target.x,target.y,40,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#bddce7';ctx.font='11px monospace';ctx.textAlign='center';ctx.fillText('TOKEN · 80 px',target.x,target.y+68);
    if(replay || time > nextReplay) {combatFX.clear();combatFX.add({attacker:{x:width*.15,y:height*.52},target,kind:impactKind,hpLost:+document.getElementById('lab_hp').value,shield:document.getElementById('lab_shield').checked,tokenDiameter:80});if(paused)combatFX.bursts[0].age=combatFX.bursts[0].travel+.4; replay=false;nextReplay=time+2.5;}
    combatFX.render(ctx,dt,{quality,reducedMotion:reduced.matches});
  }
  const fire = setup(canvases[4]);
  if(fire) {const {ctx,width:w,height:h}=fire;drawFireArea(ctx,{shape:'polygon',points:[{x:w*.12,y:h*.22},{x:w*.88,y:h*.22},{x:w*.88,y:h*.8},{x:w*.6,y:h*.8},{x:w*.6,y:h*.5},{x:w*.38,y:h*.5},{x:w*.38,y:h*.8},{x:w*.12,y:h*.8}]},time,{quality,reducedMotion:paused});}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
