import { pointInWater } from './waterGeometry.js';

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

// Stateless, world-anchored impacts: moving the camera never drags the rain.
function rainRandom(x, y, seed) {
  let n = Math.imul(x,374761393) ^ Math.imul(y,668265263) ^ Math.imul(seed,1274126177);
  n = Math.imul(n ^ (n >>> 13),1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function drawRainRipples(ctx, zone, time, { viewport, quality = 'balanced', intensity = 'rain', reducedMotion = false } = {}) {
  if (reducedMotion || !Number.isFinite(time)) return false;
  const bounds = waterBounds(zone);
  if (!bounds) return false;
  const b = viewport ? {
    minX:Math.max(bounds.minX,viewport.minX), minY:Math.max(bounds.minY,viewport.minY),
    maxX:Math.min(bounds.maxX,viewport.maxX), maxY:Math.min(bounds.maxY,viewport.maxY)
  } : bounds;
  if (!Object.values(b).every(Number.isFinite) || b.maxX<=b.minX || b.maxY<=b.minY) return false;
  const spacing = intensity==='drizzle' ? 1.6 : intensity==='storm' ? .72 : 1;
  const baseCell = (quality==='eco' ? 112 : quality==='ultra' ? 64 : 80) * spacing;
  const budget = quality==='eco' ? 128 : quality==='ultra' ? 512 : 256;
  let cell = baseCell;
  // Powers of two bound work on giant maps without tying positions to the camera.
  while ((Math.ceil((b.maxX-b.minX)/cell)+2) * (Math.ceil((b.maxY-b.minY)/cell)+2)>budget) cell*=2;
  const radiusScale=cell/baseCell, margin=24*radiusScale;
  let seed=0;
  for (const char of String(zone.id??'water')) seed=(Math.imul(seed,31)+char.charCodeAt(0))|0;
  ctx.save(); traceWater(ctx,zone); ctx.clip(); ctx.setLineDash([]);
  for (let row=Math.floor((b.minY-margin)/cell);row<=Math.floor((b.maxY+margin)/cell);row++) {
    for (let col=Math.floor((b.minX-margin)/cell);col<=Math.floor((b.maxX+margin)/cell);col++) {
      const period=1.7+rainRandom(col,row,seed)*1.1;
      const clock=Math.max(0,time)/period+rainRandom(col,row,seed+1);
      const cycle=Math.floor(clock), phase=(clock-cycle)/.78;
      if (phase>=1) continue;
      const x=(col+.12+rainRandom(col,row,seed+cycle*7+2)*.76)*cell;
      const y=(row+.12+rainRandom(col,row,seed+cycle*7+3)*.76)*cell;
      if (x<b.minX-margin || x>b.maxX+margin || y<b.minY-margin || y>b.maxY+margin || !pointInWater(x,y,zone)) continue;
      const radius=(10+rainRandom(col,row,seed+4)*13)*radiusScale;
      const aspect=.72+rainRandom(col,row,seed+5)*.18;
      for (let ring=0;ring<2;ring++) {
        const age=phase-ring*.19;
        if (age<=0) continue;
        const r=radius*Math.sqrt(age);
        const alpha=Math.min(1,age/.09)*(1-phase)**1.6*(ring?.18:.32);
        ctx.beginPath(); ctx.ellipse(x,y,r,r*aspect,0,0,TAU);
        ctx.lineWidth=2.2*radiusScale; ctx.strokeStyle=`rgba(4,28,40,${alpha*.45})`; ctx.stroke();
        ctx.lineWidth=.8*radiusScale; ctx.strokeStyle=`rgba(191,232,240,${alpha})`; ctx.stroke();
      }
    }
  }
  ctx.restore(); return true;
}

// Shared by the effects lab; there is no screen-wide weather pass anymore.
export function renderWeatherRain(ctx, { map = {}, viewport, time = 0, quality = 'balanced', reducedMotion = false } = {}) {
  if (!viewport || viewport.width<=0 || viewport.height<=0 || reducedMotion) return false;
  let drawn=false;
  for (const zone of map.waterZones||[]) {
    drawn=drawRainRipples(ctx,zone,time,{viewport,quality,reducedMotion,intensity:map.rainIntensity})||drawn;
  }
  return drawn;
}

/**
 * Atmospheric drifting fog & mist simulation.
 * Pure canvas procedural animation across visible viewport.
 * Uses harmonic multi-octave drifting billows with soft alpha compositing.
 */
export function renderWeatherFog(ctx, { map = {}, viewport, time = 0, quality = 'balanced', reducedMotion = false } = {}) {
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) return false;

  const zoom = Math.max(0.1, viewport.zoom || 1);
  const margin = 120 / zoom;
  const vw = viewport.width + margin * 2;
  const vh = viewport.height + margin * 2;
  const ox = viewport.minX - margin;
  const oy = viewport.minY - margin;

  const density = map.fogDensity || 'medium'; // 'light' | 'medium' | 'dense'
  const densityAlpha = density === 'light' ? 0.18 : density === 'dense' ? 0.52 : 0.32;
  const speed = reducedMotion ? 0 : 28; // Slow atmospheric drift (28 px/s)

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // 1. Overall base ambient mist layer
  ctx.fillStyle = `rgba(148, 185, 215, ${densityAlpha * 0.22})`;
  ctx.fillRect(viewport.minX, viewport.minY, viewport.width, viewport.height);

  // 2. Multi-layer drifting fog banks (soft radial clusters)
  const bankCount = quality === 'eco' ? 8 : quality === 'ultra' ? 24 : 14;
  const radius = Math.max(160, Math.min(420, (viewport.width + viewport.height) * 0.24));

  for (let b = 0; b < bankCount; b++) {
    const layerSpeed = speed * (0.6 + (b % 4) * 0.25);
    const seedX = (b * 0.381966 + (b % 7) * 0.11) % 1;
    const seedY = (b * 0.535897 + (b % 11) * 0.09) % 1;

    const driftX = time * layerSpeed;
    const driftY = Math.sin(time * 0.12 + b * 1.7) * 45;

    const cx = ((seedX * vw + driftX) % vw + vw) % vw + ox;
    const cy = ((seedY * vh + driftY) % vh + vh) % vh + oy;

    const pulse = Math.sin(time * 0.2 + b * 2.3) * 0.15;
    const r = radius * (0.85 + (b % 3) * 0.2 + pulse);
    const alpha = densityAlpha * (0.28 + (b % 5) * 0.08);

    const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
    grad.addColorStop(0, `rgba(180, 215, 240, ${alpha})`);
    grad.addColorStop(0.55, `rgba(150, 190, 220, ${alpha * 0.45})`);
    grad.addColorStop(1, 'rgba(150, 190, 220, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Wisp streaks (horizontal crawling mist ribbons)
  const wisps = quality === 'eco' ? 4 : quality === 'ultra' ? 12 : 7;
  for (let w = 0; w < wisps; w++) {
    const wSpeed = speed * (1.1 + (w % 3) * 0.3);
    const wx = ((w * 0.618 * vw + time * wSpeed) % vw + vw) % vw + ox;
    const wy = oy + ((w * 0.414 * vh + Math.cos(time * 0.15 + w) * 35) % vh + vh) % vh;
    const wLen = (280 + (w % 4) * 120) / Math.sqrt(zoom);
    const wHeight = (40 + (w % 3) * 20) / Math.sqrt(zoom);

    const wGrad = ctx.createLinearGradient(wx, wy, wx + wLen, wy);
    const wAlpha = densityAlpha * 0.22;
    wGrad.addColorStop(0, 'rgba(190, 225, 250, 0)');
    wGrad.addColorStop(0.5, `rgba(190, 225, 250, ${wAlpha})`);
    wGrad.addColorStop(1, 'rgba(190, 225, 250, 0)');

    ctx.fillStyle = wGrad;
    ctx.beginPath();
    ctx.ellipse(wx + wLen * 0.5, wy, wLen * 0.5, wHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  return true;
}
