const coordinate = value => Number.isFinite(value) && Math.abs(value) <= 1e6;
const samePoint = (a, b) => a.x === b.x && a.y === b.y;

export function waterGeometry(zone, { requireArea = true } = {}) {
  const shape = zone.shape ?? 'box';
  if (shape === 'polygon') {
    if (!Array.isArray(zone.points) || zone.points.length < 3 || zone.points.length > 512 ||
        zone.points.some(p => !p || !coordinate(p.x) || !coordinate(p.y))) {
      throw new Error('El polígono necesita entre 3 y 512 vértices válidos.');
    }
    let points = zone.points.map(p => ({ x:p.x, y:p.y }));
    if (requireArea) {
      points = points.filter((p, i) => !i || !samePoint(p, points[i - 1]));
      if (samePoint(points[0], points.at(-1))) points.pop();
      const area = points.reduce((sum, p, i) => { const next=points[(i+1)%points.length]; return sum+p.x*next.y-next.x*p.y; }, 0);
      if (points.length < 3 || Math.abs(area) < 1e-6) throw new Error('El polígono necesita al menos 3 vértices que delimiten un área. Retroceso quita el último.');
    }
    const xs=points.map(p=>p.x), ys=points.map(p=>p.y), x=Math.min(...xs), y=Math.min(...ys);
    return { shape, points, x, y, width:Math.max(...xs)-x, height:Math.max(...ys)-y };
  }
  const x=zone.x??300, y=zone.y??300, width=zone.width??200, height=zone.height??160;
  if (shape !== 'box' || ![x,y,width,height].every(coordinate) || width <= 0 || height <= 0) throw new Error('Las dimensiones de la zona de agua no son válidas.');
  return { shape, x, y, width, height, points:undefined };
}

export function pointInWater(x, y, zone) {
  if (zone.shape !== 'polygon') return x >= zone.x && x <= zone.x+zone.width && y >= zone.y && y <= zone.y+zone.height;
  const points = zone.points;
  if (!points || points.length < 3) return false;
  let inside = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if (((a.y>y)!==(b.y>y)) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
