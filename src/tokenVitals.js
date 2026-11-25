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

// The token's HP and Stress on the map (v2.58.0): two slim bars, no labels or numbers (those are
// in the character bar). HP above, Stress below; the colour warns as in the gauges.
export function drawSlimVitals(ctx, { y, width, scale = 1, hp = null, stress = null, armor = null }) {
  const rows = [hp && ['hp', hp], stress && ['stress', stress], armor && ['armor', armor]].filter(Boolean);
  if (!rows.length) return;
  const h = 3.5 * scale, gap = 1.5 * scale, w = width;
  ctx.save();
  ctx.fillStyle = 'rgba(4,12,23,0.88)';
  ctx.beginPath(); ctx.roundRect(-w / 2 - 2, y - 2, w + 4, rows.length * h + (rows.length - 1) * gap + 4, 2); ctx.fill();
  rows.forEach(([key, stat], i) => {
    const g = gaugeState(stat.current, stat.max, key), top = y + i * (h + gap);
    ctx.fillStyle = '#213246'; ctx.fillRect(-w / 2, top, w, h);
    ctx.fillStyle = g.color; ctx.fillRect(-w / 2, top, w * g.ratio, h);
    // One black pixel between points, so the segments read at a glance (user request).
    const n = Math.max(1, Math.min(40, Math.round(g.limit))), px = 1 / (ctx.getTransform?.()?.a || 1);
    ctx.fillStyle = '#000';
    for (let k = 1; k < n; k++) ctx.fillRect(-w / 2 + (w * k) / n - px / 2, top, px, h);
  });
  ctx.restore();
}

// The same, as segmented rings around the token (v2.58.0, user's option: «círculos alrededor del
// token con los segmentos; 2 círculos exteriores y uno interior»): HP and Stress outside, Escudos
// (Armor Slots) inside, one segment per point, filled from the top clockwise.
export function drawVitalRings(ctx, { radius, scale = 1, hp = null, stress = null, armor = null }) {
  const ring = (stat, key, r, width, color) => {
    if (!stat?.max) return;
    const g = gaugeState(stat.current, stat.max, key), n = Math.max(1, Math.min(40, Math.round(g.limit)));
    const gap = Math.min(0.12, (Math.PI * 2) / n * 0.22), step = (Math.PI * 2) / n;
    ctx.lineWidth = width; ctx.lineCap = 'butt';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * step + gap / 2;
      ctx.beginPath(); ctx.arc(0, 0, r, a, a + step - gap);
      ctx.strokeStyle = i < Math.max(0, Math.min(n, g.value)) ? (color || g.color) : 'rgba(33,50,70,0.92)';
      ctx.stroke();
    }
  };
  ctx.save();
  const w = 3 * scale;
  if (hp || stress) { ctx.beginPath(); ctx.arc(0, 0, radius + 2 + w * (stress ? 2.1 : 1.1), 0, Math.PI * 2); ctx.lineWidth = w * (stress ? 2.6 : 1.4); ctx.strokeStyle = 'rgba(4,12,23,0.55)'; ctx.stroke(); }
  ring(hp, 'hp', radius + 2 + w * 0.6, w, null);
  ring(stress, 'stress', radius + 2 + w * 1.8, w * 0.85, null);
  ring(armor, 'armor', Math.max(4, radius - w * 0.9), w * 0.85, '#79cef9');
  ctx.restore();
}
