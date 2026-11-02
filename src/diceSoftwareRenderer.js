import * as THREE from 'three';
// Compatibility renderer for WebGL-disabled devices. Uses the same Three.js scene,
// camera, textured geometry and recorded physics frames; only rasterization changes.
export class DiceSoftwareRenderer {
  constructor() { this.domElement = document.createElement('canvas'); this.ctx = this.domElement.getContext('2d'); this.shadowMap = {}; this.scale = 1; }
  setPixelRatio(value) { this.scale = Math.min(value, 1.5); }
  setSize(width, height) { this.width = width; this.height = height; this.domElement.width = width * this.scale; this.domElement.height = height * this.scale; this.domElement.style.width = width + 'px'; this.domElement.style.height = height + 'px'; }
  render(scene, camera) {
    const c = this.ctx, w = this.width, h = this.height;
    if (!w || !h) return;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0); c.clearRect(0, 0, w, h);
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const project = p => { const v = p.clone().project(camera); return { x: (v.x + 1) * w / 2, y: (1 - v.y) * h / 2, z: v.z }; };
    const triangles = [], lines = [];
    scene.traverse(mesh => {
      if (!mesh.isMesh && !mesh.isLineSegments) return;
      const geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, ix = geo.index;
      if (!pos) return;
      if (mesh.isLineSegments) { for (let i = 0; i < pos.count; i += 2) lines.push({ p: [i, i + 1].map(k => project(new THREE.Vector3().fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld))), color: '#' + mesh.material.color.getHexString() }); return; }
      const count = ix ? ix.count : pos.count;
      for (let i = 0; i < count; i += 3) {
        const ids = [i, i + 1, i + 2].map(k => ix ? ix.getX(k) : k);
        const world = ids.map(k => new THREE.Vector3().fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld));
        const normal = world[1].clone().sub(world[0]).cross(world[2].clone().sub(world[0])).normalize();
        if (normal.dot(camera.position.clone().sub(world[0])) <= 0) continue;
        const points = world.map(project), depth = points.reduce((sum, p) => sum + p.z, 0) / 3;
        const image = mesh.material.map?.image;
        triangles.push({ points, depth, image, uv: image && uv ? ids.map(k => ({ x: uv.getX(k) * image.width, y: (1 - uv.getY(k)) * image.height })) : null, shade: Math.max(.35, .65 + normal.dot(new THREE.Vector3(-.3, .8, .5).normalize()) * .35), color: '#' + mesh.material.color.getHexString() });
      }
    });
    triangles.sort((a, b) => b.depth - a.depth);
    for (const t of triangles) {
      const [a, b, d] = t.points;
      c.save(); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.closePath(); c.clip();
      if (!t.uv) { c.fillStyle = t.color; c.fillRect(0, 0, w, h); }
      if (t.uv) {
        const [u, v, z] = t.uv, den = u.x * (v.y - z.y) + v.x * (z.y - u.y) + z.x * (u.y - v.y);
        if (Math.abs(den) > .001) {
          const A = (a.x * (v.y - z.y) + b.x * (z.y - u.y) + d.x * (u.y - v.y)) / den;
          const B = (a.y * (v.y - z.y) + b.y * (z.y - u.y) + d.y * (u.y - v.y)) / den;
          const C = (a.x * (z.x - v.x) + b.x * (u.x - z.x) + d.x * (v.x - u.x)) / den;
          const D = (a.y * (z.x - v.x) + b.y * (u.x - z.x) + d.y * (v.x - u.x)) / den;
          const E = a.x - A * u.x - C * u.y, F = a.y - B * u.x - D * u.y;
          c.transform(A, B, C, D, E, F); c.drawImage(t.image, 0, 0);
        }
      }
      c.restore();
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.closePath(); c.fillStyle = `rgba(0,0,0,${1 - t.shade})`; c.fill();
    }
    // The mesh faces already carry illuminated seams, so no hidden rear edges are drawn.
  }
  dispose() { this.domElement.width = this.domElement.height = 1; }
  forceContextLoss() {}
}
