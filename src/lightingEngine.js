// src/lightingEngine.js
// 2D Raycasting Dynamic Lighting & Shadow Engine for VeilVTT

export class LightingEngine {
  constructor() {
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');
  }

  resize(width, height) {
    if (this.lightCanvas.width !== width || this.lightCanvas.height !== height) {
      this.lightCanvas.width = width;
      this.lightCanvas.height = height;
    }
  }

  /**
   * Casts a ray from (rx, ry) in direction (dx, dy) against line segments
   */
  getIntersection(ray, segment) {
    const r_px = ray.a.x;
    const r_py = ray.a.y;
    const r_dx = ray.b.x - ray.a.x;
    const r_dy = ray.b.y - ray.a.y;

    const s_px = segment.a.x;
    const s_py = segment.a.y;
    const s_dx = segment.b.x - segment.a.x;
    const s_dy = segment.b.y - segment.a.y;

    const r_mag = Math.sqrt(r_dx * r_dx + r_dy * r_dy);
    const s_mag = Math.sqrt(s_dx * s_dx + s_dy * s_dy);
    if (r_mag === 0 || s_mag === 0) return null;

    if (r_dx / r_mag === s_dx / s_mag && r_dy / r_mag === s_dy / s_mag) {
      return null;
    }

    const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / (s_dx * r_dy - s_dy * r_dx);
    const T1 = (s_px + s_dx * T2 - r_px) / r_dx;

    if (T1 < 0) return null;
    if (T2 < 0 || T2 > 1) return null;

    return {
      x: r_px + r_dx * T1,
      y: r_py + r_dy * T1,
      param: T1
    };
  }

  /**
   * Computes the 2D visibility polygon for a light source at (lx, ly)
   * Supports optional directional FOV (visionAngle < 360) and facingAngle
   */
  computeVisibilityPolygon(lx, ly, radius, walls, facingAngle = null, visionAngle = 360) {
    const isDirectional = visionAngle < 360 && facingAngle !== null && facingAngle !== undefined;
    const halfFov = isDirectional ? ((visionAngle * Math.PI) / 360) : Math.PI;

    // Add bounding box segments around the light radius
    const bbox = [
      { a: { x: lx - radius, y: ly - radius }, b: { x: lx + radius, y: ly - radius } },
      { a: { x: lx + radius, y: ly - radius }, b: { x: lx + radius, y: ly + radius } },
      { a: { x: lx + radius, y: ly + radius }, b: { x: lx - radius, y: ly + radius } },
      { a: { x: lx - radius, y: ly + radius }, b: { x: lx - radius, y: ly - radius } }
    ];

    // Filter walls that are within or intersect the light's radius
    const segments = [...bbox];
    const rSq = (radius * 1.5) * (radius * 1.5);

    for (const w of walls) {
      // Open doors and transparent windows allow light and vision rays to pass
      if ((w.isDoor || w.wallType === 'door') && w.isOpen) continue;
      if (w.isWindow || w.wallType === 'window') continue;

      // Distance from point to line segment
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const l2 = dx * dx + dy * dy;
      let distSq = (w.x1 - lx) ** 2 + (w.y1 - ly) ** 2;
      if (l2 > 0) {
        let t = ((lx - w.x1) * dx + (ly - w.y1) * dy) / l2;
        t = Math.max(0, Math.min(1, t));
        distSq = (lx - (w.x1 + t * dx)) ** 2 + (ly - (w.y1 + t * dy)) ** 2;
      }

      if (distSq < rSq) {
        segments.push({
          a: { x: w.x1, y: w.y1 },
          b: { x: w.x2, y: w.y2 }
        });
      }
    }

    // Vertex welding: If any segment endpoints are very close (<= 12px), weld them into continuous nodes to prevent light leaks through micro-gaps
    const WELD_THRESHOLD_SQ = 12 * 12;
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i];
        const s2 = segments[j];
        if ((s1.a.x - s2.a.x) ** 2 + (s1.a.y - s2.a.y) ** 2 <= WELD_THRESHOLD_SQ) {
          s2.a.x = s1.a.x;
          s2.a.y = s1.a.y;
        }
        if ((s1.a.x - s2.b.x) ** 2 + (s1.a.y - s2.b.y) ** 2 <= WELD_THRESHOLD_SQ) {
          s2.b.x = s1.a.x;
          s2.b.y = s1.a.y;
        }
        if ((s1.b.x - s2.a.x) ** 2 + (s1.b.y - s2.a.y) ** 2 <= WELD_THRESHOLD_SQ) {
          s2.a.x = s1.b.x;
          s2.a.y = s1.b.y;
        }
        if ((s1.b.x - s2.b.x) ** 2 + (s1.b.y - s2.b.y) ** 2 <= WELD_THRESHOLD_SQ) {
          s2.b.x = s1.b.x;
          s2.b.y = s1.b.y;
        }
      }
    }

    // Get all unique points
    const points = [];
    for (const seg of segments) {
      points.push(seg.a, seg.b);
    }

    // Get unique angles
    const angles = [];
    if (isDirectional) {
      angles.push(facingAngle - halfFov, facingAngle + halfFov);
      // Sample intermediate arc steps for smooth circular perimeter
      const steps = 14;
      for (let s = 1; s < steps; s++) {
        angles.push(facingAngle - halfFov + (s / steps) * (halfFov * 2));
      }
    }

    for (const p of points) {
      const angle = Math.atan2(p.y - ly, p.x - lx);
      if (isDirectional) {
        let diff = angle - facingAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        if (Math.abs(diff) <= halfFov) {
          angles.push(angle - 0.0001, angle, angle + 0.0001);
        }
      } else {
        angles.push(angle - 0.0001, angle, angle + 0.0001);
      }
    }

    // Raycast in all candidate directions
    const intersects = [];
    for (const angle of angles) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const ray = {
        a: { x: lx, y: ly },
        b: { x: lx + dx * radius * 2, y: ly + dy * radius * 2 }
      };

      let closestIntersect = null;
      for (const seg of segments) {
        const intersect = this.getIntersection(ray, seg);
        if (!intersect) continue;
        if (!closestIntersect || intersect.param < closestIntersect.param) {
          closestIntersect = intersect;
        }
      }

      if (closestIntersect) {
        const dist = Math.hypot(closestIntersect.x - lx, closestIntersect.y - ly);
        if (dist > radius) {
          closestIntersect.x = lx + dx * radius;
          closestIntersect.y = ly + dy * radius;
        }
        closestIntersect.angle = angle;
        intersects.push(closestIntersect);
      }
    }

    if (isDirectional) {
      intersects.sort((a, b) => {
        let da = a.angle - facingAngle;
        while (da < -Math.PI) da += Math.PI * 2;
        while (da > Math.PI) da -= Math.PI * 2;
        let db = b.angle - facingAngle;
        while (db < -Math.PI) db += Math.PI * 2;
        while (db > Math.PI) db -= Math.PI * 2;
        return da - db;
      });
      return [{ x: lx, y: ly }, ...intersects];
    } else {
      intersects.sort((a, b) => a.angle - b.angle);
      return intersects;
    }
  }

  /**
   * Renders dynamic lighting layer with ambient darkness and illuminated polygons
   */
  renderLighting({
    ctx,
    mapWidth,
    mapHeight,
    ambientLight = 0.2,
    ambientColor = '#0a1220',
    walls = [],
    lights = [],
    tokens = [],
    time = 0
  }) {
    this.resize(mapWidth, mapHeight);
    const lCtx = this.lightCtx;

    // 1. Fill with darkness based on ambientLight (ambient 1.0 = clear, ambient 0.25 = 0.75 darkness)
    lCtx.clearRect(0, 0, mapWidth, mapHeight);
    const darknessAlpha = Math.max(0, Math.min(1, 1 - ambientLight));
    if (darknessAlpha > 0.01) {
      lCtx.fillStyle = `rgba(5, 8, 15, ${darknessAlpha})`;
      lCtx.fillRect(0, 0, mapWidth, mapHeight);
    }

    // Collect all active light sources (station lights + token vision lights)
    const allLights = [...lights];
    for (const tok of tokens) {
      if (tok.hasLight && tok.lightRadius > 0 && !tok.hidden) {
        allLights.push({
          id: `tok_light_${tok.id}`,
          x: tok.x,
          y: tok.y,
          radius: tok.lightRadius,
          color: tok.lightColor || '#00f3ff',
          intensity: 0.85,
          effect: tok.lightEffect || 'steady',
          pulseSpeed: 1,
          facingAngle: tok.facingAngle,
          visionAngle: tok.visionAngle ?? 90
        });
      }

      // Token Night Vision (tactical phosphor green light cutting darkness up to visionRange)
      if (tok.visionMode === 'night_vision' && !tok.hidden) {
        allLights.push({
          id: `tok_nv_${tok.id}`,
          x: tok.x,
          y: tok.y,
          radius: tok.visionRange || 280,
          color: '#10b981',
          intensity: 0.92,
          effect: 'steady',
          pulseSpeed: 1,
          facingAngle: tok.facingAngle,
          visionAngle: tok.visionAngle ?? 90,
          isNightVision: true
        });
      }
    }

    // 2. Cut out light shapes from darkness using destination-out
    lCtx.globalCompositeOperation = 'destination-out';

    for (const light of allLights) {
      let currentRadius = light.radius || 200;
      let currentIntensity = light.intensity ?? 0.8;
      const speed = light.pulseSpeed || 1.5;
      const effect = light.effect || (light.flicker ? 'flicker' : 'steady');

      if (effect === 'pulse') {
        const wave = Math.sin(time * speed * 2) * 0.12;
        currentRadius *= (1 + wave);
        currentIntensity = Math.max(0.2, Math.min(1, currentIntensity * (1 + wave * 1.5)));
      } else if (effect === 'flicker') {
        const wave = Math.sin(time * speed * 5) * 0.08 + (Math.sin(time * speed * 13) * 0.04);
        currentRadius *= (1 + wave);
        currentIntensity = Math.max(0.2, Math.min(1, currentIntensity * (1 + wave * 2)));
      } else if (effect === 'quantum') {
        const wave = Math.sin(time * speed * 1.8) * 0.1 + Math.cos(time * speed * 3.4) * 0.05;
        currentRadius *= (1 + wave);
        currentIntensity = Math.max(0.3, Math.min(1, currentIntensity * (1 + wave * 1.2)));
      } else if (effect === 'siren' || effect === 'strobe') {
        const effInt = light.effectIntensity ?? 1.0;
        const wave = Math.sin(time * speed * 5) > 0 ? (0.35 * effInt) : (-0.3 * effInt);
        currentRadius *= (1 + wave * 0.4);
        currentIntensity = Math.max(0.05, Math.min(1.0, currentIntensity + wave));
      } else if (effect === 'spark') {
        const isSpark = Math.random() < 0.12;
        const wave = isSpark ? (Math.random() * 0.5) : (Math.sin(time * 2) * 0.05);
        currentRadius *= (1 + wave);
        currentIntensity = isSpark ? 1.0 : Math.max(0.2, currentIntensity * 0.7);
      }

      const polygon = this.computeVisibilityPolygon(
        light.x,
        light.y,
        currentRadius,
        walls,
        light.facingAngle,
        light.visionAngle ?? 360
      );
      if (polygon.length < 3) continue;

      // Draw light cutout
      lCtx.save();
      lCtx.beginPath();
      lCtx.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i++) {
        lCtx.lineTo(polygon[i].x, polygon[i].y);
      }
      lCtx.closePath();

      // Radial gradient for smooth falloff
      const grad = lCtx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, currentRadius
      );
      grad.addColorStop(0, `rgba(0, 0, 0, ${currentIntensity})`);
      grad.addColorStop(0.5, `rgba(0, 0, 0, ${currentIntensity * 0.75})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      lCtx.fillStyle = grad;
      lCtx.fill();
      lCtx.restore();
    }

    // 2b. Window Opacity Shadow Attenuation Pass
    // Semi-transparent windows cast a dimming shadow behind them proportional to (100 - visionPercent)%
    const windowWalls = walls.filter(w => (w.isWindow || w.wallType === 'window') && (w.visionPercent ?? 80) < 100);
    if (windowWalls.length > 0) {
      lCtx.globalCompositeOperation = 'source-over';
      for (const win of windowWalls) {
        const visPct = Math.max(0, Math.min(100, win.visionPercent ?? 80));
        const shadowFactor = (100 - visPct) / 100; // e.g. 80% vision = 0.20 shadow factor
        if (shadowFactor <= 0.01) continue;

        for (const light of allLights) {
          const midX = (win.x1 + win.x2) / 2;
          const midY = (win.y1 + win.y2) / 2;
          const distLight = Math.hypot(midX - light.x, midY - light.y);
          if (distLight > light.radius * 1.5) continue;

          const p1x = win.x1;
          const p1y = win.y1;
          const p2x = win.x2;
          const p2y = win.y2;

          const d1x = p1x - light.x;
          const d1y = p1y - light.y;
          const m1 = Math.hypot(d1x, d1y) || 1;

          const d2x = p2x - light.x;
          const d2y = p2y - light.y;
          const m2 = Math.hypot(d2x, d2y) || 1;

          const projLen = light.radius * 2;
          const q1x = p1x + (d1x / m1) * projLen;
          const q1y = p1y + (d1y / m1) * projLen;
          const q2x = p2x + (d2x / m2) * projLen;
          const q2y = p2y + (d2y / m2) * projLen;

          lCtx.save();
          lCtx.beginPath();
          lCtx.moveTo(p1x, p1y);
          lCtx.lineTo(p2x, p2y);
          lCtx.lineTo(q2x, q2y);
          lCtx.lineTo(q1x, q1y);
          lCtx.closePath();

          const shadowAlpha = shadowFactor * darknessAlpha * (light.intensity ?? 0.85);
          lCtx.fillStyle = `rgba(5, 8, 15, ${shadowAlpha})`;
          lCtx.fill();
          lCtx.restore();
        }
      }
    }

    // 3. Additive color glow pass on top of lighted areas
    lCtx.globalCompositeOperation = 'source-over';
    
    // Draw back the ambient light map onto the main game canvas with multiply / blend
    ctx.save();
    ctx.drawImage(this.lightCanvas, 0, 0);

    // Subtle colored glows around light centers
    ctx.globalCompositeOperation = 'screen';
    for (const light of allLights) {
      const effect = light.effect || 'steady';
      let activeColor = light.color || '#00f3ff';
      if (effect === 'siren') {
        const speed = light.speed || 1.0;
        const isPhase1 = Math.sin(time * speed * 5) > 0;
        activeColor = isPhase1 ? (light.color || '#ef4444') : (light.color2 || '#3b82f6');
      }

      const grad = ctx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, light.radius * 0.6
      );
      grad.addColorStop(0, activeColor);
      grad.addColorStop(1, 'transparent');

      ctx.save();
      const glowScale = effect === 'siren' ? Math.min(2.0, (light.effectIntensity ?? 1.0)) : 1.0;
      ctx.globalAlpha = Math.min(1.0, (light.intensity || 0.8) * 0.35 * glowScale);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
