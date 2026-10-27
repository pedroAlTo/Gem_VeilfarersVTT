// Procedural tactical battlemap rendering on HTML5 Canvas for Veilfarers

export function drawProceduralMap(
  ctx: CanvasRenderingContext2D,
  type: string,
  width: number,
  height: number
) {
  ctx.save();

  if (type === 'tellurian') {
    // Abandoned Freighter Corridors with bulkheads & emergency lighting
    ctx.fillStyle = '#0f131c';
    ctx.fillRect(0, 0, width, height);

    // Deck plating
    ctx.strokeStyle = 'rgba(76, 85, 110, 0.2)';
    ctx.lineWidth = 1.5;
    const sz = 100;
    for (let x = 0; x < width; x += sz) {
      for (let y = 0; y < height; y += sz) {
        ctx.strokeRect(x, y, sz, sz);
      }
    }

    // Heavy Bulkhead walls and corridors
    ctx.fillStyle = '#1e2433';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;

    // Outer and interior hull walls
    ctx.strokeRect(80, 80, width - 160, height - 160);

    // Central cargo junction
    const cx = width / 2;
    const cy = height / 2;

    // Glowing emergency floor strips
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(120, cy);
    ctx.lineTo(width - 120, cy);
    ctx.moveTo(cx, 120);
    ctx.lineTo(cx, height - 120);
    ctx.stroke();

    // Workstation consoles / cover crates
    const crates = [
      { x: cx - 250, y: cy - 120, w: 80, h: 50 },
      { x: cx - 250, y: cy + 70, w: 80, h: 50 },
      { x: cx + 180, y: cy - 100, w: 90, h: 60 },
      { x: cx + 180, y: cy + 60, w: 90, h: 60 },
    ];

    crates.forEach((c) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      // Stencil mark
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText('TELLURIAN', c.x + 8, c.y + 28);
    });
  } else if (type === 'rust_belt') {
    // Industrial rust, debris field, welded scrap plates
    ctx.fillStyle = '#18120e';
    ctx.fillRect(0, 0, width, height);

    // Irregular rusty metal plates
    const sz = 80;
    for (let x = 0; x < width; x += sz) {
      for (let y = 0; y < height; y += sz) {
        ctx.fillStyle = (x + y) % 160 === 0 ? 'rgba(180, 83, 9, 0.1)' : 'rgba(217, 119, 6, 0.05)';
        ctx.fillRect(x + 2, y + 2, sz - 4, sz - 4);
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.3)';
        ctx.strokeRect(x, y, sz, sz);
      }
    }

    // Welded seam lines
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 300);
    ctx.lineTo(800, 450);
    ctx.lineTo(1600, 400);
    ctx.stroke();
  } else if (type === 'hydros') {
    // Bioluminescent ocean harvesting rig
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      50,
      width / 2,
      height / 2,
      Math.max(width, height) / 1.5
    );
    grad.addColorStop(0, '#042f2e');
    grad.addColorStop(0.6, '#082f49');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Deep water hexagonal grid platform
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 400, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Spire of Verita (Solari Prime golden marble & runic circles)
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Glowing gold circular dais
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 320, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)';
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, 260, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
