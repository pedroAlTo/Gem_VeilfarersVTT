import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { boundaries, headingYaw, layoutEncounter } from './layout.js';
import { freighter, contactModel, ghostModel, disposeObjects } from './models.js';
import { ARCS, bandLabel } from './encounter.js';

const v = a => new T.Vector3(...a);
function trace(points, color, opacity, dashed = false) {
  const opt = { color, transparent: true, opacity, depthWrite:false };
  const mat = dashed ? new T.LineDashedMaterial({ ...opt,dashSize:.18,gapSize:.13 }) : new T.LineBasicMaterial(opt);
  const line=new T.Line(new T.BufferGeometry().setFromPoints(points),mat);
  if (dashed) line.computeLineDistances();
  return line;
}
function ring(x,y,z,r,begin=0,end=Math.PI*2) {
  const steps = Math.max(8, Math.round(100*(end-begin)/(Math.PI*2)));
  return Array.from({length:steps+1},(_,i)=>new T.Vector3(x+r*Math.cos(begin+(end-begin)*i/steps),y,z+r*Math.sin(begin+(end-begin)*i/steps)));
}
export function createMap3D(root, onPick, onLoss) {
  const renderer = new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.6));
  renderer.setClearColor(0x000000,0); renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.32;
  root.prepend(renderer.domElement);
  const scene=new T.Scene(), ships=new T.Group(), marks=new T.Group(), ghost=ghostModel(), own=freighter();
  ships.add(own); scene.add(ships,marks,ghost);
  scene.add(new T.HemisphereLight(0xc8deff,0x554157,2));
  const sun=new T.DirectionalLight(0xffe0b7,3);sun.position.set(3,8,6);scene.add(sun);
  const rim=new T.DirectionalLight(0x919cff,2);rim.position.set(-6,3,-8);scene.add(rim);
  const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(.25,0),new T.MeshStandardMaterial({color:0x413c4a,roughness:.92}),24);
  const obj=new T.Object3D();
  for(let i=0;i<24;i++){const a=i*2.39996,r=13+(i%7)*.72;obj.position.set(r*Math.cos(a),-2+(i%4),r*Math.sin(a));obj.rotation.set(i*.32,a,i*.17);obj.scale.setScalar(.45+(i%5)*.30);obj.updateMatrix();rocks.setMatrixAt(i,obj.matrix);}
  scene.add(rocks);
  const labels=document.createElement('div'); labels.className='nav-labels';root.append(labels);
  const orbital=new T.PerspectiveCamera(39,1,.1,140), top=new T.OrthographicCamera(-15,15,10,-10,.1,140);
  const focus=new T.Vector3(-3.5,0,1.5);
  orbital.position.set(-1.4,10.4,17.3);
  const controls=new OrbitControls(orbital,renderer.domElement);
  controls.target.copy(focus);controls.minDistance=5; controls.maxDistance=40;controls.maxPolarAngle=Math.PI*.48;controls.update();
  top.position.set(focus.x,35,focus.z);top.up.set(0,0,-1);top.lookAt(focus);
  let camera=orbital, frame=0, gone=false, data, layout, bindings=[], size={w:1,h:1};
  const contacts=new Map(), ray=new T.Raycaster();
  const burst = new T.Group();
  scene.add(burst);
  let seenImpact = null, flashStarted = null;
  function flash(impact) {
    const start = layout.points.get(impact.source), end = layout.points.get(impact.target);
    if (!start || !end) return;
    disposeObjects(burst); burst.clear();
    const color = impact.target === 'own' ? 0xff889e : 0x8bf4ff;
    const direction = v(start).sub(v(end)).normalize();
    const at = v(end).addScaledVector(direction, 1.1);
    burst.add(trace([v(start),at],color,1));
    const shell = new T.Mesh(new T.SphereGeometry(.42,16,12), new T.MeshBasicMaterial({color,transparent:true,opacity:.8,wireframe:true,depthWrite:false}));
    shell.position.copy(at); burst.add(shell); flashStarted = performance.now();
  }
  function render() {
    frame=0;if(gone || !data) return;
    if (flashStarted !== null) {
      const age = Math.min(1, (performance.now() - flashStarted) / 570);
      burst.visible = age < 1;
      burst.children.forEach(part => { part.material.opacity = 1 - age; });
      if (burst.children[1]) burst.children[1].scale.setScalar(.4 + age * 2);
      if (age < 1) invalidate(); else flashStarted = null;
    }
    renderer.render(scene,camera);
    for(const [node,point] of bindings) {
      const p=point.clone().project(camera);
      node.hidden=p.z< -1 || p.z>1 || Math.abs(p.x)>1 || Math.abs(p.y)>1;
      node.style.left=((p.x+1)*size.w/2)+'px';node.style.top=((1-p.y)*size.h/2)+'px';
    }
  }
  function invalidate() { if(!gone && !frame) frame=requestAnimationFrame(render); }
  function resize(){
    const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);size={w,h};
    renderer.setSize(w,h,false);orbital.aspect=w/h;orbital.updateProjectionMatrix();
    const extent=Math.max(6.5,10*h/w);top.left=-extent*w/h;top.right=-top.left;top.top=extent;top.bottom=-extent;top.updateProjectionMatrix();invalidate();
  }
  function label(copy,position,kind,id) {
    const node=document.createElement(id?'button':'span');node.className='nav-marker '+kind;
    node.textContent=copy;if(id){node.type='button';node.onclick=()=>onPick(id);}
    labels.append(node);bindings.push([node,position]);
  }
  function arcs(at, radius, info, active, enemy, yaw) {
    const names=['fore','starboard','aft','port'];
    names.forEach((a,i)=>{
      const angle=i*Math.PI/2-yaw, color=a===active?0xffc962:enemy?0xcf667e:0x66cbd5;
      marks.add(trace(ring(at[0],at[1]-.12,at[2],radius,angle-.66,angle+.66),color,a===active?.98:.62));
      // Slots are always present on the player's ship and on a Keeper's target card.
      label(ARCS[a]+(info?' '+info[a]:''),v([at[0]+Math.cos(angle)*radius,at[1]+.13,at[2]+Math.sin(angle)*radius]),a===active?'arc':'sector');
    });
  }
  function update(next) {
    const initialized = !!data;
    data=next;layout=layoutEncounter(next.n,next.target,next.move,next.height,next.preview);
    const impact = next.n.impact;
    if (initialized && impact && impact.revision !== seenImpact) { burst.visible=true; flash(impact); }
    seenImpact = impact?.revision ?? null;
    disposeObjects(marks);marks.clear();labels.replaceChildren();bindings=[];
    own.position.copy(v(layout.own));own.rotation.y=headingYaw(layout.own,layout.points.get(next.n.contacts.find(c=>c.kind==='ship')?.id) || layout.center,next.n.heading);
    label(next.ship.name,own.position.clone().add(v([0,.75,.25])),'ally');
    arcs(layout.own,1.82,next.ship.shieldArcs,next.role==='pilot'?next.arc:next.n.pilotEffect.exposed,false,own.rotation.y);
    for(const [id,m] of contacts) if(!layout.points.has(id)){ships.remove(m);disposeObjects(m);contacts.delete(id);}
    for(const c of next.n.contacts){
      let m=contacts.get(c.id);if(!m){m=contactModel(c.kind);m.userData.contact=c.id;contacts.set(c.id,m);ships.add(m);}
      m.position.copy(v(layout.points.get(c.id)));m.rotation.y=Math.PI+.22;
      label(c.name+(c.id===next.target?' · '+bandLabel(c.band):'')+(c.locked?' · SENSOR LOCK':''),m.position.clone().add(v([0,.66,-.35])),c.kind==='beacon'?'neutral':'hostile',c.id);
      if(c.kind==='ship') arcs(layout.points.get(c.id),1.7,next.keeper?c.privateShip?.shieldArcs:null,next.role==='gunner'?next.arc:null,true,m.rotation.y);
    }
    const [x,,z]=layout.center;
    boundaries.forEach((r,i)=>marks.add(trace(ring(x,-.24,z,r),i===1?0x749da4:0x9186b7,i===1?.38:.22)));
    ghost.visible=!!layout.ghost;
    if(layout.ghost){
      ghost.position.copy(v(layout.ghost));ghost.rotation.y=headingYaw(layout.ghost,layout.center,next.arc);
      const end=v(layout.ghost),foot=end.clone();foot.y=-.23;
      marks.add(trace([own.position,end],0x6bf5fc,.94,true),trace([end,foot],0x6bf5fc,.77,true),trace(ring(foot.x,foot.y,foot.z,.46),0x6bf5fc,.79));
      label((next.height>0?'+':'')+next.height+' km',foot.clone().add(v([.5,.18,0])),'altitude');
    }
    invalidate();
  }
  let down=null;
  function press(e){down={x:e.clientX,y:e.clientY};}
  function pick(e){if(!down || Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=root.getBoundingClientRect();ray.setFromCamera({x:2*(e.clientX-r.left)/r.width-1,y:1-2*(e.clientY-r.top)/r.height},camera);
    const hit=ray.intersectObjects([...contacts.values()],true)[0];let m=hit?.object;while(m && !m.userData.contact)m=m.parent;if(m)onPick(m.userData.contact);}
  function lost(e){e.preventDefault();onLoss();}
  renderer.domElement.addEventListener('pointerdown',press);renderer.domElement.addEventListener('pointerup',pick);
  renderer.domElement.addEventListener('webglcontextlost',lost);
  controls.addEventListener('change',invalidate);const ro=new ResizeObserver(resize);ro.observe(root);resize();
  return {update, camera(mode){camera=mode==='top'?top:orbital;controls.enabled=camera===orbital;invalidate();},
    dispose(){gone=true;cancelAnimationFrame(frame);ro.disconnect();controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);
      disposeObjects(scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();labels.remove();}};
}
