import { boundaries, headingYaw, layoutEncounter } from './layout.js';
import { bandLabel } from './encounter.js';

// A real orthographic tactical view for devices without WebGL, sharing the same orders and bands.
export function createMap2D(root, onPick) {
  const canvas=document.createElement('canvas');root.prepend(canvas);
  const ctx=canvas.getContext('2d');let state=null, hits=[];
  function draw(){
    if(!ctx || !state)return;
    const {n,ship,target,move,height,preview}=state, {points,center,own,ghost}=layoutEncounter(n,target,move,height,preview);
    const w=Math.max(root.clientWidth,1),h=Math.max(root.clientHeight,1),s=Math.min(w/21,h/16);
    const dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const pos=p=>[w*.54+(p[0]+3)*s,h*.46+(p[2]-1)*s];
    const [cx,cy]=pos(center);ctx.lineWidth=1;ctx.strokeStyle='#a6a2c352';
    for(const r of boundaries){ctx.beginPath();ctx.arc(cx,cy,r*s,0,Math.PI*2);ctx.stroke();}
    function marker(at,name,color,id,angle) {
      const [x,y]=pos(at);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle=color;ctx.fillStyle=color+'55';ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-11,-6);ctx.lineTo(-6,0);ctx.lineTo(-11,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
      ctx.font='600 12px system-ui';ctx.fillStyle=color;ctx.fillText(name,x+12,y-12);if(id)hits.push([x,y,id]);
    }
    hits=[];marker(own,ship.name,'#83edfa',null,-headingYaw(own,points.get(n.contacts.find(c=>c.kind==='ship')?.id) || center,n.heading));
    for(const c of n.contacts)marker(points.get(c.id),c.name+' · '+bandLabel(c.band)+(c.locked?' · SENSOR LOCK':''),c.kind==='ship'?'#ffa1ae':'#e4d9ca',c.id,2.8);
    if(ghost){const [x,y]=pos(own),[gx,gy]=pos(ghost);ctx.strokeStyle='#75f1fb';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(gx,gy);ctx.stroke();ctx.setLineDash([]);marker(ghost,(height>0?'+':'')+height+' km','#74d9e6',null,-headingYaw(ghost,center,state.arc));}
  }
  canvas.onclick=e=>{const r=canvas.getBoundingClientRect();for(const [x,y,id] of hits)if(Math.hypot(e.clientX-r.left-x,e.clientY-r.top-y)<28){onPick(id);break;}};
  const observer=new ResizeObserver(draw);observer.observe(root);
  return {update(s){state=s;draw();},camera(){},dispose(){observer.disconnect();canvas.remove();}};
}
