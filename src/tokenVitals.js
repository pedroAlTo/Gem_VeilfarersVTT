export function gaugeState(current, max, statKey = 'hp') {
  const value = Number.isFinite(Number(current)) ? Number(current) : 0;
  const limit = Math.max(0, Number.isFinite(Number(max)) ? Number(max) : 0);
  const ratio = limit > 0 ? Math.max(0, Math.min(1, value / limit)) : 0;
  const danger = limit > 0 && (statKey === 'hp' ? ratio <= 0.25 : statKey === 'stress' && ratio >= 1);
  const color = danger ? '#fb779d' : statKey === 'hp' ? (ratio <= 0.5 ? '#eac78a' : '#72e5cf')
    : statKey === 'stress' ? '#d990ed' : statKey === 'armor' ? '#79cef9' : statKey === 'resolve' ? '#c4a7ff' : '#edd58a';
  return { value, limit, ratio, danger, color, cells: Math.max(1, Math.min(24, Math.ceil(limit))) };
}
export function statGaugeHTML(label, current, max, key) {
  const g = gaugeState(current,max,key);
  return `<div class="telemetry-stat ${g.danger ? 'stat-danger' : ''}" style="--stat-color:${g.color}">
    <div class="telemetry-label"><span>${label}</span><b>${g.value}<small> / ${g.limit}</small></b></div>
    <div class="telemetry-track" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="${Math.max(1,g.limit)}" aria-valuenow="${Math.max(0,Math.min(g.value,g.limit))}" aria-valuetext="${g.value} / ${g.limit}">
      ${Array.from({length:g.cells},(_,i)=>`<i style="--cell-fill:${Math.max(0,Math.min(1,g.ratio*g.cells-i))*100}%"></i>`).join('')}
    </div></div>`;
}
export function drawTokenGauge(ctx, { x, y, width, current, max, key = 'hp', label, color, scale = 1 }) {
  const g = gaugeState(current,max,key);
  const hue = g.danger ? g.color : color || g.color;
  ctx.save();
  ctx.translate(x,y);ctx.scale(scale,scale);
  x=0;y=0;width/=scale;
  ctx.fillStyle = 'rgba(4,12,23,0.93)';
  ctx.beginPath();ctx.roundRect(x-4,y-14,width+8,23,3);ctx.fill();
  ctx.strokeStyle='rgba(126,190,218,0.28)';ctx.lineWidth=0.6;ctx.stroke();
  ctx.font='8px monospace';ctx.textBaseline='middle';ctx.textAlign='left';
  ctx.fillStyle=hue;ctx.fillText((label || key.toUpperCase()).slice(0,10),x,y-7,width*0.54);
  ctx.textAlign='right';ctx.fillStyle='#eef8ff';ctx.fillText(`${g.value}/${g.limit}`,x+width,y-7,width*0.44);
  const gap=2, cellWidth=(width-gap*(g.cells-1))/g.cells;
  for(let i=0;i<g.cells;i++) {
    const cx=x+i*(cellWidth+gap), fraction=Math.max(0,Math.min(1,g.ratio*g.cells-i));
    ctx.fillStyle='#213246';ctx.fillRect(cx,y,cellWidth,4);
    if(fraction>0) {
      ctx.fillStyle=hue;ctx.fillRect(cx,y,cellWidth*fraction,4);
      ctx.fillStyle='rgba(255,255,255,0.45)';ctx.fillRect(cx,y,cellWidth*fraction,0.7);
    }
  }
  ctx.restore();
}

// ── The stats on the map (v2.58.0, places of v2.59.0: tokenLayout.js) ───────────────────────
// Bars: one row per stat, a black pixel between points so the segments read at a glance.
// rows: [[key, { current, max }]]; y is the top of the first row (rows go down) unless `up`.
export function drawStatBars(ctx, { y, width, scale = 1, rows = [], up = false }) {
  if (!rows.length) return;
  const h = 3.5 * scale, gap = 1.5 * scale, w = width, total = rows.length * h + (rows.length - 1) * gap;
  const top0 = up ? y - total : y;
  ctx.save();
  ctx.fillStyle = 'rgba(4,12,23,0.88)';
  ctx.beginPath(); ctx.roundRect(-w / 2 - 2, top0 - 2, w + 4, total + 4, 2); ctx.fill();
  rows.forEach(([key, stat], i) => {
    const g = gaugeState(stat.current, stat.max, key), top = top0 + i * (h + gap);
    ctx.fillStyle = '#213246'; ctx.fillRect(-w / 2, top, w, h);
    ctx.fillStyle = g.color; ctx.fillRect(-w / 2, top, w * g.ratio, h);
    // One black pixel between points, so the segments read at a glance (user request).
    const n = Math.max(1, Math.min(40, Math.round(g.limit))), px = 1 / (ctx.getTransform?.()?.a || 1);
    ctx.fillStyle = '#000';
    for (let k = 1; k < n; k++) ctx.fillRect(-w / 2 + (w * k) / n - px / 2, top, px, h);
  });
  ctx.restore();
}
// The v2.58.0 call: HP, Stress and Escudos under the name.
export function drawSlimVitals(ctx, { y, width, scale = 1, hp = null, stress = null, armor = null }) {
  drawStatBars(ctx, { y, width, scale, rows: [hp && ['hp', hp], stress && ['stress', stress], armor && ['armor', armor]].filter(Boolean) });
}

// A ring around the token's centre: one segment per point, filled from the top clockwise.
export function drawStatRing(ctx, { r, width, key, stat }) {
  if (!stat?.max) return;
  const g = gaugeState(stat.current, stat.max, key), n = Math.max(1, Math.min(40, Math.round(g.limit)));
  const step = (Math.PI * 2) / n, gap = Math.min(0.12, step * 0.22);
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.lineWidth = width + 2; ctx.strokeStyle = 'rgba(4,12,23,0.7)'; ctx.stroke();
  ctx.lineWidth = width; ctx.lineCap = 'butt';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step + gap / 2;
    ctx.beginPath(); ctx.arc(0, 0, r, a, a + step - gap);
    ctx.strokeStyle = i < Math.max(0, Math.min(n, g.value)) ? g.color : 'rgba(33,50,70,0.92)';
    ctx.stroke();
  }
  ctx.restore();
}
// Where each ring goes for a token of this radius.
export const ringRadius = (place, radius, scale = 1) => place === 'inner1' ? Math.max(4, radius - 3.5 * scale) : place === 'outer1' ? radius + 3.5 * scale : radius + 7.5 * scale;

// Small tokens beside the token (Armor, Resolve): 8 × 8 px each, full or empty, in columns of up
// to six. Armor: a shield. Resolve: a triangle (d4) or a square (d6).
export function drawStatPips(ctx, { side = 'right', radius, scale = 1, key, stat, offset = 0 }) {
  if (!stat?.max) return;
  const size = 8 * scale, gap = 2 * scale, per = 6, n = Math.max(0, Math.min(24, Math.round(stat.max)));
  const color = key === 'armor' ? '#79cef9' : '#c4a7ff', dir = side === 'left' ? -1 : 1;
  const columns = Math.ceil(n / per);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const col = Math.floor(i / per), row = i % per, rows = Math.min(per, n - col * per);
    const x = dir * (radius + 4 * scale + offset + size / 2 + col * (size + gap));
    const y = (row - (rows - 1) / 2) * (size + gap);
    const full = i < stat.current;
    ctx.beginPath();
    if (key === 'armor') {
      const s = size / 2;
      ctx.moveTo(x, y - s); ctx.lineTo(x + s, y - s * 0.6); ctx.lineTo(x + s * 0.8, y + s * 0.35); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.8, y + s * 0.35); ctx.lineTo(x - s, y - s * 0.6); ctx.closePath();
    } else if (stat.die === 'd6') ctx.rect(x - size / 2, y - size / 2, size, size);
    else { ctx.moveTo(x, y - size / 2); ctx.lineTo(x + size / 2, y + size / 2); ctx.lineTo(x - size / 2, y + size / 2); ctx.closePath(); }
    ctx.fillStyle = full ? color : 'rgba(4,12,23,0.85)'; ctx.fill();
    ctx.lineWidth = Math.max(1, scale); ctx.strokeStyle = full ? '#0b1220' : color; ctx.stroke();
  }
  ctx.restore();
  return columns * (size + gap);
}
