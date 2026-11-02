export function gaugeState(current, max, statKey = 'hp') {
  const value = Number.isFinite(Number(current)) ? Number(current) : 0;
  const limit = Math.max(0, Number.isFinite(Number(max)) ? Number(max) : 0);
  const ratio = limit > 0 ? Math.max(0, Math.min(1, value / limit)) : 0;
  const danger = limit > 0 && (statKey === 'hp' ? ratio <= 0.25 : statKey === 'stress' && ratio >= 1);
  const color = danger ? '#fb779d' : statKey === 'hp' ? (ratio <= 0.5 ? '#eac78a' : '#72e5cf')
    : statKey === 'stress' ? '#d990ed' : statKey === 'armor' ? '#79cef9' : '#edd58a';
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
