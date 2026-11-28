import * as T from 'three';

function surface(color, metalness = .6, roughness = .46) {
  return new T.MeshStandardMaterial({ color, metalness, roughness });
}
function mesh(group, geometry, material, x, y, z) {
  const part = new T.Mesh(geometry, material);
  part.position.set(x,y,z); group.add(part); return part;
}
const box = (group, mat, x, y, z, a, b, c) => mesh(group, new T.BoxGeometry(a,b,c), mat, x,y,z);
function tube(group,mat,x,y,z,front,rear,length,segments=10) {
  const part = mesh(group,new T.CylinderGeometry(front,rear,length,segments),mat,x,y,z);
  part.rotation.z = -Math.PI/2; return part;
}
// Both miniatures face +X. Actual hull meshes can be inspected from any camera angle.
export function freighter() {
  const g = new T.Group(), pearl = surface(0xc6c0b3,.42), ink = surface(0x303248), brass = surface(0xb69656), iron = surface(0x585768);
  const exhaust = new T.MeshBasicMaterial({color:0x81f9ff});
  tube(g,ink,0,0,0,.37,.43,2.6,8);
  tube(g,pearl,1.23,.025,0,.24,.38,.57,8);
  box(g,iron,0,-.17,0,2.4,.24,.53);
  for (const x of [-.76,-.06,.64]) {
    for(const side of [-1,1]) {
      box(g,pearl,x,0,side*.34,.58,.48,.33);
      box(g,ink,x-.04,.255,side*.34,.46,.035,.25);
      box(g,brass,x-.19,.035,side*.35,.055,.5,.36);
    }
    box(g,iron,x,.3,0,.34,.24,.36);
  }
  box(g,pearl,.73,.40,0,.54,.22,.30);
  box(g,new T.MeshBasicMaterial({color:0x79c9dc}),.91,.48,0,.13,.045,.26);
  box(g,brass,.39,.49,-.12,.018,.37,.018);
  for (const [y,z] of [[-.14,-.28],[-.14,.28],[.14,0]]) {
    tube(g,iron,-1.4,y,z,.16,.21,.47);
    tube(g,brass,-1.59,y,z,.205,.188,.075);
    tube(g,exhaust,-1.65,y,z,.135,.13,.06);
  }
  return g;
}
function wing(g,m,points,y,depth) {
  const s = new T.Shape(); points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z)); s.closePath();
  const geo = new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:1});
  geo.rotateX(-Math.PI/2); return mesh(g,geo,m,0,y,0);
}
export function corvette() {
  const g = new T.Group(), wine = surface(0x932d49,.48), obsidian = surface(0x353041), edges = surface(0xbe6f72);
  wing(g,obsidian,[[-1,-.2],[.86,-.21],[1.42,0],[.86,.21],[-1,.2]],-.11,.26);
  for(const s of [-1,1]) {
    wing(g,wine,[[-1.08,s*.62],[-.45,s*.43],[1.35,s*.13],[.76,s*.36],[-.72,s*.7]],-.05,.14);
    wing(g,edges,[[-.75,s*.55],[.92,s*.21],[-.38,s*.5]],.11,.025);
    tube(g,new T.MeshBasicMaterial({color:0xff8176}),-.88,.015,s*.39,.08,.1,.12);
  }
  box(g,wine,-.12,.18,0,.62,.16,.23);
  return g;
}
export function contactModel(kind) {
  if(kind==='ship') return corvette();
  const g=new T.Group();
  mesh(g,new T.OctahedronGeometry(.25),new T.MeshBasicMaterial({color:0xf4dec2,wireframe:true}),0,0,0);
  return g;
}
export function ghostModel() {
  const g=new T.Group(), mat=new T.LineBasicMaterial({color:0x6cf5ff,transparent:true,opacity:.72});
  const hull=freighter();
  hull.traverse(part=>{ if(part.isMesh) {const wire=new T.LineSegments(new T.EdgesGeometry(part.geometry,32),mat);wire.position.copy(part.position);wire.rotation.copy(part.rotation);g.add(wire);} });
  disposeObjects(hull); return g;
}
export function disposeObjects(group) {
  const gs = new Set(), ms = new Set();
  group.traverse(o => { if(o.geometry) gs.add(o.geometry); if(o.material) for(const m of Array.isArray(o.material)?o.material:[o.material]) ms.add(m); });
  gs.forEach(g=>g.dispose()); ms.forEach(m=>m.dispose());
}
