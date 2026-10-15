// Procedural tactical battlemap rendering on HTML5 Canvas

export function drawProceduralMap(
  ctx: CanvasRenderingContext2D,
  type: string,
  width: number,
  height: number
) {
  ctx.save();

  if (type === 'sanctum') {
    // Deep obsidian stone floor
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      100,
      width / 2,
      height / 2,
      Math.max(width, height) / 1.5
    );
    grad.addColorStop(0, '#1a1829');
    grad.addColorStop(0.5, '#0e0e1a');
    grad.addColorStop(1, '#07070d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Stone tile pattern
    ctx.strokeStyle = 'rgba(76, 68, 110, 0.25)';
    ctx.lineWidth = 1.5;
    const tileSize = 100;
    for (let x = 0; x < width; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Central Glowing Veil Rune Circle
    const cx = width / 2;
    const cy = height / 2;

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 320);
    glow.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    glow.addColorStop(0.6, 'rgba(168, 85, 247, 0.15)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 320, 0, Math.PI * 2);
    ctx.fill();

    // Runic Rings
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 280, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, 240, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Central Star of the Veil
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
    ctx.lineWidth = 2.5;
    const points = 8;
    for (let i = 0; i < points; i++) {
      const angle = (i * Math.PI * 2) / points;
      const x1 = cx + Math.cos(angle) * 160;
      const y1 = cy + Math.sin(angle) * 160;
      const x2 = cx + Math.cos(angle + Math.PI) * 160;
      const y2 = cy + Math.sin(angle + Math.PI) * 160;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Pillars around room
    const pillarPositions = [
      { x: cx - 400, y: cy - 300 },
      { x: cx + 400, y: cy - 300 },
      { x: cx - 400, y: cy + 300 },
      { x: cx + 400, y: cy + 300 },
      { x: cx - 600, y: cy },
      { x: cx + 600, y: cy },
    ];

    pillarPositions.forEach((p) => {
      // Pillar shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(p.x + 8, p.y + 8, 36, 0, Math.PI * 2);
      ctx.fill();

      // Pillar base
      ctx.fillStyle = '#2e2a44';
      ctx.strokeStyle = '#4e4870';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pillar inner glow
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (type === 'astral_void') {
    // Cosmic astral void
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, width, height);

    // Starfield
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 200; i++) {
      const sx = ((i * 137.5) % width);
      const sy = ((i * 293.7) % height);
      const sSize = (i % 3) + 1;
      ctx.fillRect(sx, sy, sSize, sSize);
    }

    // Astral Nebulae
    const nebula = ctx.createRadialGradient(width * 0.3, height * 0.4, 50, width * 0.3, height * 0.4, 600);
    nebula.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    nebula.addColorStop(0.5, 'rgba(139, 92, 246, 0.15)');
    nebula.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    // Floating Celestial Dais
    const cx = width / 2;
    const cy = height / 2;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 450, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Runic Astrolabe circles
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 350, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'veil_ruins') {
    // Ruined ancient citadel
    ctx.fillStyle = '#111318';
    ctx.fillRect(0, 0, width, height);

    // Distressed cracked stone tiles
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
    ctx.lineWidth = 2;
    const sz = 80;
    for (let x = 0; x < width; x += sz) {
      for (let y = 0; y < height; y += sz) {
        ctx.strokeRect(x + 2, y + 2, sz - 4, sz - 4);
      }
    }

    // Glowing Rift fissures
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(width * 0.2, height * 0.3);
    ctx.lineTo(width * 0.4, height * 0.45);
    ctx.lineTo(width * 0.65, height * 0.4);
    ctx.lineTo(width * 0.85, height * 0.6);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    // Default Dungeon
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 2;
    const step = 60;
    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < height; y += step) {
        ctx.strokeRect(x, y, step, step);
      }
    }
  }

  ctx.restore();
}
