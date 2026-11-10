// Presentation only: the damage resolver remains the single source of HP/Armor changes.
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 1e6 && Math.abs(p.y) <= 1e6;
export function impactScale(hpLost) {
  if (!Number.isFinite(hpLost) || hpLost <= 0) return 0;
  return hpLost <= 1 ? .5 : Math.min(2, 1 + (hpLost - 2) * .2);
}
export function weaponImpactType(weapon = '', explicit = 'auto') {
  const kinds = ['ballistic', 'plasma', 'fire', 'cryo', 'explosion', 'melee'];
  if (kinds.includes(explicit)) return explicit;
  const text = (typeof weapon === 'object' ? [weapon.name, weapon.type, weapon.damageType, weapon.features, weapon.damage].join(' ') : String(weapon)).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/cryo|crio|freeze|frost|ice\b|congela|cold|hielo/.test(text)) return 'cryo';
  if (/flame|fire\b|fuego|incend|napalm|quem/.test(text)) return 'fire';
  if (/explos|grenade|granada|rocket|cohete|missile|misil|blast\b/.test(text)) return 'explosion';
  if (/plasma|laser|beam|blaster|photon|foton|ion\b/.test(text)) return 'plasma';
  if (/ballistic|balistic|bullet|bala|kinetic|cinet|rifle|shotgun|pistol|rail|slug|flechette|metralla/.test(text)) return 'ballistic';
  if (/melee|sword|saber|blade|espada|cuchillo|knife|filo|shank|daga/.test(text)) return 'melee';
  return 'ballistic';
}
export function attackPresentation({ attacker, target, mapId, weapon, kind = 'auto', hpLost, armorSlotSpent = false, isDirect = false, isCritical = false, gridSize = 64 }) {
  if (!point(target) || !point(attacker) || !Number.isFinite(hpLost) || hpLost < 0) return null;
  return { attacker: { x: attacker.x, y: attacker.y }, target: { x: target.x, y: target.y }, mapId,
    kind: weaponImpactType(weapon, kind), hpLost, shield: !!armorSlotSpent && !isDirect,
    tokenDiameter: clamp((target.size || 1) * gridSize, 1, 20000), isCritical: !!isCritical };
}
function glow(ctx, x, y, radius, inner, outer = 'rgba(0,0,0,0)') {
  if (radius <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, inner); gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
}
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
export class CombatFX {
  constructor() { this.bursts = []; this.time = 0; }
  clear() { this.bursts = []; }
  add(params) {
    if (!point(params?.attacker) || !point(params?.target) || !Number.isFinite(params.hpLost) || params.hpLost < 0 || !Number.isFinite(params.tokenDiameter) || params.tokenDiameter <= 0) return false;
    const kind = weaponImpactType(params.weaponType || '', params.kind);
    const diameter = clamp(params.tokenDiameter, 1, 20000);
    const distance = Math.hypot(params.target.x - params.attacker.x, params.target.y - params.attacker.y);
    this.bursts.push({ ...params, kind, diameter, scale: impactScale(params.hpLost), age: 0,
      travel: distance < 1 ? 0 : clamp(distance / 1600, .08, .42), duration: kind === 'cryo' ? 1.5 : 1.15 });
    this.bursts = this.bursts.slice(-8); return true;
  }
  render(ctx, dt, { quality = 'balanced', reducedMotion = false, viewport } = {}) {
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.time += step;
    this.bursts = this.bursts.filter(b => (b.age += step) < b.travel + b.duration);
    const count = quality === 'eco' ? 10 : quality === 'ultra' ? 30 : 20;
    for (const b of this.bursts) {
      if (viewport) {
        const margin = b.diameter;
        if (Math.max(b.attacker.x, b.target.x) + margin < viewport.minX || Math.min(b.attacker.x, b.target.x) - margin > viewport.maxX || Math.max(b.attacker.y, b.target.y) + margin < viewport.minY || Math.min(b.attacker.y, b.target.y) - margin > viewport.maxY) continue;
      }
      ctx.save();
      const angle = Math.atan2(b.target.y - b.attacker.y, b.target.x - b.attacker.x);
      if (b.age < b.travel && !reducedMotion) {
        const u = b.age / b.travel, tail = Math.max(0, u - .13);
        ctx.lineCap = 'round'; ctx.strokeStyle = b.kind === 'cryo' ? '#b1f4ff' : b.kind === 'plasma' ? '#d3a7ff' : '#ffe6a9';
        ctx.lineWidth = Math.max(1, b.diameter * .025);
        ctx.beginPath(); ctx.moveTo(b.attacker.x + (b.target.x - b.attacker.x) * tail, b.attacker.y + (b.target.y - b.attacker.y) * tail);
        ctx.lineTo(b.attacker.x + (b.target.x - b.attacker.x) * u, b.attacker.y + (b.target.y - b.attacker.y) * u); ctx.stroke();
      } else {
        const age = Math.max(0, b.age - b.travel), t = age / b.duration;
        if (b.scale > 0) this.impact(ctx, b, reducedMotion ? .45 : t, count, reducedMotion);
        if (b.shield && b.kind !== 'melee') this.shield(ctx, b, angle, reducedMotion ? .2 : t);
      }
      ctx.restore();
    }
  }
  shield(ctx, b, angle, t) {
    if (t > .68) return;
    const r = b.diameter * Math.max(.5, b.scale) / 2;
    ctx.save(); ctx.translate(b.target.x, b.target.y); ctx.rotate(angle + Math.PI);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.globalAlpha = (1 - t / .68) * .85;
    glow(ctx, r * .45, 0, r * .8, 'rgba(80,214,255,.6)');
    ctx.strokeStyle = '#a2f6ff'; ctx.lineWidth = Math.max(1, r * .035);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (.85 - i * .11), -.9 - t, .9 + t); ctx.stroke(); }
    // A faceted energy skin, concentrated on the incoming side of the shield.
    const cell = r / 4;
    ctx.strokeStyle = 'rgba(136,236,255,.65)'; ctx.lineWidth = Math.max(.5, r * .012);
    for (let y = -2; y <= 2; y++) for (let x = 0; x <= 2; x++) {
      ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * TAU / 6; const px = x * cell * 1.5 + Math.cos(a) * cell * .72, py = y * cell * 1.6 + (x % 2) * cell * .8 + Math.sin(a) * cell * .72; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
    }
    ctx.restore();
  }
  impact(ctx, b, t, count, reducedMotion) {
    const r = b.diameter * b.scale / 2, fade = Math.max(0, 1 - t);
    ctx.save(); ctx.translate(b.target.x, b.target.y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip(); // Exact maximum footprint, including fragments and glow.
    ctx.globalAlpha = fade;
    if (b.kind === 'ballistic' || b.kind === 'melee') {
      glow(ctx, 0, 0, r * .5, 'rgba(255,190,90,.65)');
      for (let i = 0; i < count; i++) {
        const a = noise(i + 3) * TAU, distance = r * Math.min(.98, (.15 + t * 1.8) * (.3 + noise(i + 71) * .7));
        const x = Math.cos(a) * distance, y = Math.sin(a) * distance;
        ctx.strokeStyle = i % 3 ? '#e6a86b' : '#d9e5f0'; ctx.lineWidth = Math.max(.7, r * .025);
        ctx.beginPath(); ctx.moveTo(x * .68, y * .68); ctx.lineTo(x, y); ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + t * 5); ctx.fillStyle = i % 2 ? '#778392' : '#dcc4ab'; ctx.fillRect(-r * .035, -r * .016, r * .07, r * .032); ctx.restore();
      }
    } else if (b.kind === 'cryo') {
      glow(ctx, 0, 0, r, 'rgba(142,233,255,.65)');
      const spread = Math.min(1, .25 + t * 3);
      for (let i = 0; i < Math.min(18, count); i++) {
        const a = noise(i + 32) * TAU, length = r * spread * (.18 + noise(i) * .38);
        const origin = r * spread * (.18 + noise(i + 51) * .43);
        ctx.save(); ctx.translate(Math.cos(a) * origin, Math.sin(a) * origin); ctx.rotate(a + (noise(i + 4) - .5));
        ctx.fillStyle = i % 2 ? 'rgba(128,215,240,.46)' : 'rgba(210,250,255,.65)'; ctx.strokeStyle = 'rgba(221,252,255,.8)'; ctx.lineWidth = Math.max(.5, r * .012);
        ctx.beginPath(); ctx.moveTo(-length * .3, 0); ctx.lineTo(length * .35, -r * .05); ctx.lineTo(length, 0); ctx.lineTo(length * .15, r * .05); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(185,242,255,.6)'; ctx.beginPath(); ctx.moveTo(-length * .8, -r * .06); ctx.lineTo(0, 0); ctx.lineTo(length * .65, 0); ctx.moveTo(length * .2, 0); ctx.lineTo(length * .45, r * .12); ctx.stroke(); ctx.restore();
      }
      ctx.strokeStyle = 'rgba(198,245,255,.5)'; ctx.lineWidth = r * .018;
      ctx.beginPath(); for (let i = 0; i <= 11; i++) { const a = i / 11 * TAU, d = r * spread * (.58 + noise(i % 11 + 45) * .28); if (i) ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); else ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); } ctx.stroke();
    } else if (b.kind === 'plasma') {
      glow(ctx, 0, 0, r * (.45 + t * .5), 'rgba(185,112,255,.8)');
      glow(ctx, 0, 0, r * Math.max(.12, .45 - t * .3), 'rgba(220,255,255,.95)');
      ctx.strokeStyle = '#c4a5ff'; ctx.lineWidth = Math.max(1, r * .04);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * Math.min(.95, .25 + t + i * .1), r * (.15 + t * .45), i * 1.1, t * 4 + i, t * 4 + i + 4.4); ctx.stroke(); }
      for (let i = 0; i < count / 2; i++) { const a = i * 2.4; glow(ctx, Math.cos(a) * r * t, Math.sin(a) * r * t, r * .07, '#c1f9ff'); }
    } else {
      // Ignition core, rolling hot lobes, cooling soot and a restrained pressure ring.
      const explosion = b.kind === 'explosion';
      if (explosion) {
        glow(ctx, 0, 0, r * (.65 + t * .3), t < .45 ? 'rgba(255,146,35,.82)' : 'rgba(82,66,60,.42)');
        ctx.strokeStyle = `rgba(255,220,166,${Math.max(0, .9 - t)})`; ctx.lineWidth = Math.max(1, r * .025);
        ctx.beginPath(); ctx.arc(0, 0, r * Math.min(.98, .15 + t * 2.5), 0, TAU); ctx.stroke();
      }
      for (let i = 0; i < (reducedMotion ? 5 : 12); i++) {
        const a = i * 2.4, spread = r * Math.min(.7, .1 + t * .85), x = Math.cos(a) * spread * noise(i + 12), y = Math.sin(a) * spread - t * r * .3;
        glow(ctx, x, y, r * (.17 + noise(i) * .2), t > .55 ? 'rgba(75,68,70,.68)' : i % 3 ? 'rgba(255,91,25,.88)' : 'rgba(255,200,75,.95)');
      }
      if (!explosion) {
        for (let i = 0; i < 7; i++) {
          const x = (i - 3) * r * .2, sway = Math.sin(t * 14 + i * 2) * r * .15;
          ctx.fillStyle = i % 2 ? 'rgba(255,161,42,.75)' : 'rgba(255,75,18,.8)';
          ctx.beginPath(); ctx.moveTo(x - r * .16, r * .4); ctx.bezierCurveTo(x - r * .35, 0, x + sway, -r * .3, x + sway, -r * (.45 + noise(i) * .5)); ctx.bezierCurveTo(x + r * .3, -r * .05, x + r * .3, r * .3, x + r * .16, r * .4); ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}

export function drawFireArea(ctx, effect, time, { viewport, quality = 'balanced', reducedMotion = false } = {}) {
  if (effect.active === false) return;
  const points = effect.points;
  let bounds;
  if (effect.shape === 'polygon') {
    if (!Array.isArray(points) || points.length < 3 || !points.every(point)) return;
    bounds = { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) };
  } else if (effect.shape === 'line') {
    const width = clamp(effect.width || 36, 4, 1000);
    if (![effect.x, effect.y, effect.x2, effect.y2].every(Number.isFinite)) return;
    bounds = { minX: Math.min(effect.x, effect.x2) - width, maxX: Math.max(effect.x, effect.x2) + width, minY: Math.min(effect.y, effect.y2) - width, maxY: Math.max(effect.y, effect.y2) + width };
  } else {
    const r = clamp(effect.radius || 80, 1, 100000);
    if (!point(effect)) return;
    bounds = { minX: effect.x - r, minY: effect.y - r, maxX: effect.x + r, maxY: effect.y + r };
  }
  const b = viewport ? { minX: Math.max(bounds.minX, viewport.minX), minY: Math.max(bounds.minY, viewport.minY), maxX: Math.min(bounds.maxX, viewport.maxX), maxY: Math.min(bounds.maxY, viewport.maxY) } : bounds;
  if (b.maxX <= b.minX || b.maxY <= b.minY) return;
  ctx.save(); ctx.beginPath();
  if (effect.shape === 'polygon') { ctx.moveTo(points[0].x, points[0].y); for (const p of points.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath(); }
  else if (effect.shape === 'line') {
    const a = Math.atan2(effect.y2 - effect.y, effect.x2 - effect.x), w = clamp(effect.width || 36, 4, 1000) / 2, nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
    ctx.moveTo(effect.x + nx, effect.y + ny); ctx.lineTo(effect.x2 + nx, effect.y2 + ny); ctx.lineTo(effect.x2 - nx, effect.y2 - ny); ctx.lineTo(effect.x - nx, effect.y - ny); ctx.closePath();
  } else ctx.arc(effect.x, effect.y, (bounds.maxX - bounds.minX) / 2, 0, TAU);
  ctx.clip();
  ctx.fillStyle = 'rgba(103,30,7,.22)'; ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
  const budget = quality === 'eco' ? 40 : quality === 'ultra' ? 130 : 80;
  let spacing = Math.max(22, Math.sqrt((b.maxX - b.minX) * (b.maxY - b.minY) / budget));
  // Include boundary cells in the budget, so the lower edge never runs out of emitters.
  while ((Math.ceil((b.maxX - b.minX) / spacing) + 2) * (Math.ceil((b.maxY - b.minY) / spacing) + 2) > budget) spacing *= 1.12;
  const motion = reducedMotion ? 0 : time;
  let count = 0;
  for (let y = Math.floor(b.minY / spacing) * spacing; y < b.maxY + spacing && count < budget; y += spacing) for (let x = Math.floor(b.minX / spacing) * spacing; x < b.maxX + spacing && count < budget; x += spacing) {
    count++;
    const seed = x * .13 + y * .17, phase = motion * 2.5 + seed;
    const h = (18 + noise(seed) * 22) * Math.min(1.6, spacing / 28);
    const px = x + noise(seed + 1) * spacing * .9, py = y + noise(seed + 2) * spacing * .9;
    const sway = Math.sin(phase) * h * .23, heat = .7 + Math.sin(phase * .8) * .15;
    // Overlapping low ground heat makes one fire field rather than a row of icons.
    glow(ctx, px, py, spacing * 1.2, `rgba(187,45,7,${heat * .30})`);
    glow(ctx, px, py - h * .1, spacing * .7, `rgba(255,113,18,${heat * .45})`);
    for (let layer = 0; layer < 3; layer++) {
      const height = h * (layer === 2 ? .42 : layer === 1 ? .72 : 1.1), width = h * (layer === 2 ? .1 : .25);
      const tilt = sway + (noise(seed + 6) - .5) * height * .35;
      const gradient = ctx.createLinearGradient(px, py + h * .15, px + tilt, py - height);
      gradient.addColorStop(0, 'rgba(197,44,6,0)');
      gradient.addColorStop(.18, layer === 2 ? 'rgba(255,237,160,.65)' : 'rgba(247,122,23,.45)');
      gradient.addColorStop(.5, layer === 2 ? 'rgba(255,215,112,.75)' : 'rgba(255,156,49,.62)');
      gradient.addColorStop(.82, 'rgba(241,76,10,.22)'); gradient.addColorStop(1, 'rgba(213,39,4,0)');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(px - width * .8, py + h * .15);
      ctx.bezierCurveTo(px - width * 1.5, py - height * .2, px + tilt - width * .3, py - height * .48, px + tilt, py - height);
      ctx.bezierCurveTo(px + tilt + width * .15, py - height * .45, px + width * 1.3, py - height * .25, px + width * .7, py + h * .15); ctx.closePath(); ctx.fill();
    }
    // Small embers and fractured glowing coals remain anchored in map coordinates.
    for (let i = 0; i < 3; i++) {
      const ex = px + (noise(seed + i * 7) - .5) * spacing, ey = py + (noise(seed + i * 11) - .5) * spacing;
      ctx.fillStyle = `rgba(255,${120 + Math.floor(noise(seed + i) * 100)},56,${heat * .6})`;
      ctx.fillRect(ex, ey, 1 + noise(seed + i) * 2.5, 1);
    }
    if (!reducedMotion && count % 3 === 0) { const rise = (motion * .65 + noise(seed)) % 1; ctx.fillStyle = `rgba(255,207,104,${1 - rise})`; ctx.fillRect(px + Math.sin(phase) * 5, py - rise * h * 2, 1.5, 2); }

  }
  ctx.restore();
}
