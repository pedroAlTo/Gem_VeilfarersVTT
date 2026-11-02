// Canvas-only artwork. Geometry stays in map coordinates; no frame-buffer readback.
const TAU = Math.PI * 2;
export function waterBounds(zone) {
  if (zone.shape === 'polygon') {
    if (!zone.points || zone.points.length < 3 || zone.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
    const xs = zone.points.map(p => p.x), ys = zone.points.map(p => p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  }
  if (![zone.x,zone.y,zone.width,zone.height].every(Number.isFinite) || zone.width <= 0 || zone.height <= 0) return null;
  return { minX: zone.x, minY: zone.y, maxX: zone.x + zone.width, maxY: zone.y + zone.height };
}
export function traceWater(ctx, zone) {
  ctx.beginPath();
  if (zone.shape === 'polygon') {
    ctx.moveTo(zone.points[0].x, zone.points[0].y);
    for (const p of zone.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  } else ctx.rect(zone.x, zone.y, zone.width, zone.height);
}
export function drawWaterSurface(ctx, zone, time, { viewport, quality = 'balanced', reducedMotion = false } = {}) {
  const bounds = waterBounds(zone);
  if (!bounds) return false;
  const b = viewport ? {
    minX: Math.max(bounds.minX, viewport.minX), minY: Math.max(bounds.minY, viewport.minY),
    maxX: Math.min(bounds.maxX, viewport.maxX), maxY: Math.min(bounds.maxY, viewport.maxY)
  } : bounds;
  if (b.maxX <= b.minX || b.maxY <= b.minY) return false;
  const depth = Math.max(0, Math.min(5, zone.depth ?? 2));
  const flow = reducedMotion ? 0 : time * (zone.flowSpeed ?? 1);
  const width = b.maxX - b.minX, height = b.maxY - b.minY;
  ctx.save();
  traceWater(ctx, zone);
  ctx.clip(); // All light, wave and shoreline passes share the exact polygon mask.
  const wash = ctx.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  wash.addColorStop(0, `rgba(33, 143, 164, ${0.22 + depth * 0.06})`);
  wash.addColorStop(0.46, `rgba(6, 66, 108, ${0.28 + depth * 0.085})`);
  wash.addColorStop(1, `rgba(4, 19, 53, ${0.35 + depth * 0.1})`);
  ctx.fillStyle = wash;
  ctx.fillRect(b.minX,b.minY,width,height);
  // Broad reflected ribbons, two crossing frequencies instead of a uniform sine grid.
  ctx.globalCompositeOperation = 'screen';
  const rows = quality === 'eco' ? 6 : 10;
  const stepY = Math.max(18, height / rows), stepX = Math.max(16, width / 52);
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let y = Math.floor(b.minY / stepY) * stepY - stepY; y < b.maxY + stepY; y += stepY) {
      let first = true;
      for (let x = b.minX - stepX; x <= b.maxX + stepX; x += stepX) {
        const wave = Math.sin(x * 0.021 + y * 0.008 + flow * 0.52 + pass * 2) * 7
          + Math.sin(x * 0.049 - flow * 0.37 + y * 0.026) * 3;
        const py = y + wave + Math.sin(flow * 0.28 + y) * 4;
        if (first) ctx.moveTo(x,py); else ctx.lineTo(x,py);
        first = false;
      }
    }
    ctx.lineWidth = pass ? 0.8 : 3;
    ctx.strokeStyle = pass ? 'rgba(158,244,255,0.07)' : 'rgba(44,160,190,0.10)';
    ctx.stroke();
  }
  // Warped caustic lattice: curved, connected light cells, not parallel scan lines.
  const columns = quality === 'eco' ? 5 : quality === 'ultra' ? 11 : 8;
  const cell = Math.max(24, Math.max(width,height) / columns);
  const warp = (x,y) => ({
    x: x + Math.sin(x * .031 + y * .019 + flow * .42) * cell * .22,
    y: y + Math.cos(x * .026 - y * .024 - flow * .33) * cell * .16
  });
  for (let row=-1;row<=Math.ceil(height/cell)+1;row++) {
    for(let col=-1;col<=Math.ceil(width/cell)+1;col++) {
      const cx=b.minX+col*cell+(row%2)*cell*.5, cy=b.minY+row*cell*.82;
      const points=Array.from({length:6},(_,i)=>warp(cx+Math.cos(i*TAU/6)*cell*.58,cy+Math.sin(i*TAU/6)*cell*.58));
      ctx.beginPath();
      for(let i=0;i<6;i++) {
        const p=points[i],n=points[(i+1)%6],mid={x:(p.x+n.x)/2,y:(p.y+n.y)/2};
        if(i===0)ctx.moveTo(mid.x,mid.y);
        else ctx.quadraticCurveTo(p.x,p.y,mid.x,mid.y);
      }
      const p=points[0],n=points[1];ctx.quadraticCurveTo(p.x,p.y,(p.x+n.x)/2,(p.y+n.y)/2);
      const light=.04 + (1+Math.sin(col*3.7+row*2.1+flow*.5))*.045;
      ctx.strokeStyle=`rgba(150,247,249,${light*(1-depth*.1)})`;
      ctx.lineWidth=1.1;ctx.stroke();
    }
  }
  // A few sparse surface highlights instead of uniform sparkle noise.
  for(let i=0;i<8;i++) {
    const x=b.minX+((i*.618)%1)*width,y=b.minY+((i*.414)%1)*height;
    ctx.strokeStyle=`rgba(210,255,253,${.06+.04*Math.sin(flow*.6+i)})`;ctx.lineWidth=.8;
    ctx.beginPath();ctx.ellipse(x,y,7+i,2,-.3,.3,4.2);ctx.stroke();
  }
  // Subtle wet edge and interrupted foam, clipped inward along concave shores too.
  traceWater(ctx,zone);
  ctx.strokeStyle = 'rgba(113,225,232,0.18)'; ctx.lineWidth = 8; ctx.stroke();
  ctx.setLineDash([5,18,2,27]); ctx.lineDashOffset = -flow * 4;
  ctx.strokeStyle = 'rgba(204,255,250,0.38)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  return true;
}

export function drawBlackHole(ctx, rift, quality = 'balanced', reducedMotion = false) {
  const r = Math.max(4, rift.radius), h = r * 0.28;
  const time = reducedMotion ? 0 : rift.rotation;
  ctx.save();
  ctx.translate(rift.x,rift.y);
  ctx.rotate(-0.16);
  ctx.globalAlpha *= Math.max(0,Math.min(1,rift.life));
  // Falloff outside the photon sphere, without washing out the map.
  const halo = ctx.createRadialGradient(0,0,h * 0.8,0,0,r * 1.5);
  halo.addColorStop(0,'rgba(12,7,25,0.95)');
  halo.addColorStop(0.29,'rgba(37,23,69,0.42)');
  halo.addColorStop(0.6,'rgba(45,69,110,0.14)');
  halo.addColorStop(1,'rgba(10,15,25,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0,0,r * 1.5,0,TAU); ctx.fill();
  ctx.save();ctx.scale(1,.25);
  const diskGlow=ctx.createRadialGradient(0,0,h,0,0,r*1.3);
  diskGlow.addColorStop(0,'rgba(219,232,255,.52)');
  diskGlow.addColorStop(.17,'rgba(178,158,220,.29)');
  diskGlow.addColorStop(.48,'rgba(108,130,194,.15)');
  diskGlow.addColorStop(1,'rgba(45,80,138,0)');
  ctx.fillStyle=diskGlow;ctx.beginPath();ctx.arc(0,0,r*1.3,0,TAU);ctx.fill();ctx.restore();
  const strands = quality === 'eco' ? 14 : quality === 'ultra' ? 42 : 28;
  const disk = (front) => {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i=0;i<strands;i++) {
      const f=i/strands, radius=h * 1.35 + f * r * 0.95;
      const phase=time * (0.25 + (1-f) * 0.4) + i * 2.399;
      ctx.beginPath();
      const start=front ? 0 : Math.PI, end=front ? Math.PI : TAU;
      for (let j=0;j<=64;j++) {
        const a=start + (end-start)*j/64;
        const ripple=1 + Math.sin(a * 6 + phase) * 0.022 + Math.sin(a*13-phase)*.008;
        const x=Math.cos(a)*radius*ripple;
        const y=Math.sin(a)*radius*0.24 + Math.sin(a*8+phase)*r*.004;
        if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      const alpha=(0.12 + (1-f)*0.54)*(front ? 1 : 0.65);
      const gradient=ctx.createLinearGradient(-radius,0,radius,0);
      gradient.addColorStop(0,`rgba(133,76,217,${alpha*0.6})`);
      gradient.addColorStop(0.48,`rgba(218,153,216,${alpha})`);
      gradient.addColorStop(0.78,`rgba(226,251,255,${alpha})`);
      gradient.addColorStop(1,`rgba(74,189,239,${alpha*0.7})`);
      ctx.strokeStyle=gradient; ctx.lineWidth=Math.max(0.6,r*0.012); ctx.stroke();
    }
    ctx.restore();
  };
  disk(false);
  // Lensed upper arc, brightest near the inner orbit.
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(let i=0;i<5;i++) {
    ctx.beginPath(); ctx.ellipse(0,0,h*(1.16+i*0.045),h*(1.12+i*0.018),0,Math.PI,TAU);
    ctx.strokeStyle=`rgba(180,215,255,${0.38-i*0.06})`;
    ctx.lineWidth=1.2+i*0.4;ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle='#010106';ctx.beginPath();ctx.arc(0,0,h,0,TAU);ctx.fill();
  const rim=ctx.createLinearGradient(-h,-h,h,h);
  rim.addColorStop(0,'#9b6cbe');rim.addColorStop(0.4,'#f0e6ff');rim.addColorStop(0.8,'#97dff8');rim.addColorStop(1,'#36567a');
  ctx.strokeStyle=rim;ctx.lineWidth=Math.max(.65,r*0.006);ctx.stroke();
  // The foreground disk occludes only the lower horizon, giving the hole depth.
  disk(true);
  ctx.restore();
}
