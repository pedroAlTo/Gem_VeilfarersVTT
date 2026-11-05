import { drawBlackHole, drawWaterSurface } from './surfaceFX.js';
import './fxLab.css';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
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
const canvases=['hole','water'].map(id=>document.getElementById(id));
function setup(canvas) {
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
  if(!paused && !document.hidden)time+=Math.min((now-previous)/1000,0.05);
  previous=now;
  const hole=setup(canvases[0]);
  drawBlackHole(hole.ctx,{x:hole.width/2,y:hole.height/2,radius:Math.min(hole.width*.29,hole.height*.4),rotation:time*0.9,life:1},quality);
  const {ctx,width,height}=setup(canvases[1]);
  const pad=width*.06, middle=width*.52;
  drawWaterSurface(ctx,{x:pad,y:height*.15,width:width*.37,height:height*.7,depth:2,flowSpeed:1},time,{quality});
  drawWaterSurface(ctx,{shape:'polygon',depth:4,flowSpeed:0.6,points:[
    {x:middle,y:height*.15},{x:width-pad,y:height*.15},{x:width-pad,y:height*.85},
    {x:middle,y:height*.85},{x:middle,y:height*.62},{x:middle+width*.13,y:height*.52},{x:middle,y:height*.4}
  ]},time,{quality});
  ctx.fillStyle='#acd8df';ctx.font='10px monospace';ctx.fillText('DEPTH / 02',pad,height*.94);ctx.fillText('DEPTH / 04',middle,height*.94);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
