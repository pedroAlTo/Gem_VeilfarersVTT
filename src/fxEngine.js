import { CombatFX, drawFireArea } from './combatFX.js';
import { drawBlackHole } from './surfaceFX.js';
// src/fxEngine.js
// High-Performance AAA Tactical FX & Particle Simulation Engine for VeilVTT
// Optimized with strict particle budgets, viewport culling, zero CPU shadowBlur in inner loops,
// and throttled persistent emitters for ultra-smooth 60 FPS performance.
// Sound is disabled per design specification ("No establezcas sonidos").

export class FXEngine {
  constructor() {
    this.combat = new CombatFX();
    this.particles = [];
    this.lightningBolts = [];
    this.shockwaves = [];
    this.voidRifts = [];
    this.emitterTimers = new Map();

    // Quality performance modes: 'eco' | 'balanced' | 'ultra'
    this.quality = 'balanced';
    this.reducedMotion = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
    this.maxParticles = 140;
    this.maxShockwaves = 6;
    this.maxLightning = 4;
    this.maxRifts = 4;
  }

  removeEffect(fxId) {
    if (!fxId) return;
    this.emitterTimers.delete(fxId);
    this.voidRifts = this.voidRifts.filter(r => r.id !== fxId);
    this.particles = this.particles.filter(p => p.riftId !== fxId && p.effectId !== fxId && p.id !== fxId);
  }

  setQuality(level = 'balanced') {
    this.quality = level;
    if (level === 'eco') {
      this.maxParticles = 50;
      this.maxShockwaves = 3;
      this.maxLightning = 1;
      this.maxRifts = 2;
    } else if (level === 'ultra') {
      this.maxParticles = 180;
      this.maxShockwaves = 8;
      this.maxLightning = 4;
      this.maxRifts = 4;
    } else {
      // balanced
      this.maxParticles = 120;
      this.maxShockwaves = 6;
      this.maxLightning = 3;
      this.maxRifts = 3;
    }
  }

  // Trigger effect by type (Instant burst)
  trigger(type, params = {}) {
    const x = params.x || 0;
    const y = params.y || 0;

    switch (type) {
      case 'explosion':
        this.createExplosion(x, y, params);
        break;
      case 'lightning':
        this.createLightning(x, y, params);
        break;
      case 'void_rift':
        this.createVoidRift(x, y, params);
        break;
      case 'void':
      case 'void_beam':
        this.createVoidBeam(x, y, params);
        break;
      case 'radiant':
        this.createRadiantBurst(x, y, params);
        break;
      case 'laser':
        this.createLaserBurst(x, y, params);
        break;
      case 'plasma':
        this.createPlasmaBurst(x, y, params);
        break;
      case 'ballistic':
      case 'kinetic':
      case 'bullet':
        this.createBallisticBurst(x, y, params);
        break;
      case 'melee':
      case 'slash':
        this.createMeleeSlash(x, y, params);
        break;
      case 'emp':
        this.createEMP(x, y, params);
        break;
      case 'sparkle':
        this.createSparkles(x, y, params);
        break;
      default:
        this.createRadiantBurst(x, y, params);
    }
  }

  // --- 1. RESTORED HIGH-YIELD AAA PLASMA EXPLOSION ---
  createExplosion(x, y, params = {}) {
    this.combat.add({ attacker: { x, y }, target: { x, y }, kind: 'explosion', hpLost: params.hpLost ?? 2,
      tokenDiameter: params.tokenDiameter ?? (96 * Math.max(.5, Math.min(2, params.intensity || 1))) });
  }

  // --- 2. OPTIMIZED FRACTAL ARC DISCHARGE (LIGHTNING) ---
  createLightning(x, y, params = {}) {
    if (this.lightningBolts.length >= this.maxLightning) {
      this.lightningBolts.shift();
    }

    const targetX = params.targetX || (x + (Math.random() - 0.5) * 320);
    const targetY = params.targetY || (y + (Math.random() - 0.5) * 320);

    // Optimized depth: 4 iterations = 16 crisp segments instead of 64
    const mainPoints = this.generateFractalArc(x, y, targetX, targetY, 4, 55);

    const branches = [];
    const numBranches = 1 + Math.floor(Math.random() * 2);
    for (let b = 0; b < numBranches; b++) {
      const idx = Math.floor(Math.random() * (mainPoints.length - 2)) + 1;
      const origin = mainPoints[idx];
      const angle = Math.atan2(targetY - y, targetX - x) + (Math.random() - 0.5) * 1.4;
      const length = 50 + Math.random() * 80;
      const bx = origin.x + Math.cos(angle) * length;
      const by = origin.y + Math.sin(angle) * length;
      branches.push(this.generateFractalArc(origin.x, origin.y, bx, by, 3, 28));
    }

    this.lightningBolts.push({
      mainPoints,
      branches,
      color: params.color || '#00f3ff',
      coreColor: '#ffffff',
      life: 1.0,
      decay: 0.08
    });

    this.createImpactSparks(targetX, targetY, '#38bdf8', 8);
    this.createImpactSparks(x, y, '#00f3ff', 5);

    this.particles.push({
      type: 'flash',
      x: (x + targetX) / 2,
      y: (y + targetY) / 2,
      radius: 140,
      color: 'rgba(0, 243, 255, 0.35)',
      alpha: 0.6,
      life: 1.0,
      decay: 0.14
    });
  }

  generateFractalArc(x1, y1, x2, y2, depth, displacement) {
    let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];

    for (let d = 0; d < depth; d++) {
      const newPts = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const nx = -dy / (len || 1);
        const ny = dx / (len || 1);

        const currentDisp = (Math.random() - 0.5) * displacement * Math.pow(0.65, d);
        const displacedPoint = {
          x: midX + nx * currentDisp,
          y: midY + ny * currentDisp
        };

        newPts.push(p1);
        newPts.push(displacedPoint);
      }
      newPts.push(pts[pts.length - 1]);
      pts = newPts;
    }
    return pts;
  }

  // --- 3. COSMIC BLACK HOLE IMPLOSION (INWARD SPIRAL & STAR POINTS) ---
  createVoidRift(x, y, params = {}) {
    const intensity = params.intensity || 1.0;
    const riftId = params.id || ('rift_' + Date.now());
    const radius = (params.radius || 110) * intensity;
    const singularityRadius = radius * 0.28;

    const existing = this.voidRifts.find(r => r.id === riftId);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.radius = radius;
      existing.singularityRadius = singularityRadius;
      if (params.decay !== undefined) existing.decay = params.decay;
      if (existing.distortionWaves) {
        existing.distortionWaves.forEach(dw => { dw.maxR = radius * 1.4; });
      }
    } else {
      if (this.voidRifts.length >= this.maxRifts) {
        this.voidRifts.shift();
      }
      this.voidRifts.push({
        id: riftId,
        persistent: params.decay === 0,
        x,
        y,
        radius,
        singularityRadius,
        rotation: 0,
        rotSpeed: 2.2,
        life: 1.0,
        decay: params.decay !== undefined ? params.decay : 0.006,
        distortionWaves: [
          { r: radius * 1.4, maxR: radius * 1.4, speed: 70 },
          { r: radius * 0.95, maxR: radius * 1.4, speed: 70 },
          { r: radius * 0.5, maxR: radius * 1.4, speed: 70 }
        ]
      });
    }

    // Inflow Star Points spiraling into the central singularity
    const particleCount = Math.min(35, Math.round((params.count || 28) * intensity));
    for (let i = 0; i < particleCount; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const dist = singularityRadius + 12 + Math.random() * (radius * 1.35);
      const ang = Math.random() * Math.PI * 2;
      this.particles.push({
        type: 'singularity_inflow',
        riftId: riftId,
        effectId: riftId,
        riftX: x,
        riftY: y,
        dist,
        singularityRadius,
        angle: ang,
        radialSpeed: 40 + Math.random() * 60,
        angularSpeed: 2.5 + Math.random() * 3.5,
        size: 1.0 + Math.random() * 1.2,
        color: '#ffffff',
        life: 1.0,
        decay: 0.008 + Math.random() * 0.008
      });
    }
  }

  // --- 4. OPTIMIZED RADIANT NOVA (ESTALLIDO DE LUZ) ---
  createRadiantBurst(x, y, params = {}) {
    const intensity = params.intensity || 1.0;

    // Blinding core light flash
    this.particles.push({
      type: 'flash',
      x,
      y,
      radius: 220 * intensity,
      color: '#ffffff',
      alpha: 1.0,
      life: 1.0,
      decay: 0.06
    });

    // Expanding golden divine shockwave ring
    if (this.shockwaves.length < this.maxShockwaves) {
      this.shockwaves.push({
        x,
        y,
        radius: 12,
        maxRadius: 240 * intensity,
        speed: 460 * intensity,
        lineWidth: 5,
        color: '#ffffff',
        edgeColor: '#fde047',
        alpha: 1.0,
        decay: 2.2
      });
    }

    // Luminous God Rays (8 rays instead of 14 for massive render speedup)
    const numRays = 8;
    for (let r = 0; r < numRays; r++) {
      const angle = (r / numRays) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const length = (140 + Math.random() * 150) * intensity;
      this.particles.push({
        type: 'god_ray',
        x,
        y,
        angle,
        length,
        width: 12 + Math.random() * 16,
        rotSpeed: (r % 2 === 0 ? 1 : -1) * 0.7,
        color: Math.random() > 0.4 ? '#ffffff' : '#fef08a',
        life: 1.0,
        decay: 0.026 + Math.random() * 0.018
      });
    }

    // Solar photon sparks
    const count = Math.min(18, Math.round(16 * intensity));
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 320 * intensity;
      this.particles.push({
        type: 'spark',
        x,
        y,
        prevX: x,
        prevY: y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        drag: 0.94,
        size: 2.5 + Math.random() * 3,
        color: Math.random() > 0.3 ? '#ffffff' : '#fef08a',
        life: 1.0,
        decay: 0.022 + Math.random() * 0.02
      });
    }
  }

  // --- 5. OPTIMIZED EMP SHOCKWAVE ---
  createEMP(x, y, params = {}) {
    if (this.shockwaves.length >= this.maxShockwaves) {
      this.shockwaves.shift();
    }

    const intensity = params.intensity || 1.0;
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius: 260 * intensity,
      speed: 420 * intensity,
      lineWidth: 4,
      color: '#00f3ff',
      edgeColor: '#38bdf8',
      alpha: 1.0,
      decay: 1.6,
      isHexagonal: true
    });

    const moteCount = Math.round(12 * intensity);
    for (let i = 0; i < moteCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 140 * intensity;
      this.particles.push({
        type: 'digital_mote',
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        vx: (Math.random() - 0.5) * 35,
        vy: (Math.random() - 0.5) * 35,
        size: 2.5 + Math.random() * 3,
        color: '#00f3ff',
        life: 1.0,
        decay: 0.025
      });
    }
  }

  // --- 6. OPTIMIZED SPARKLES ---
  createSparkles(x, y, params = {}) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 110;
      this.particles.push({
        type: 'stardust',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        drag: 0.96,
        size: 2.5 + Math.random() * 3.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2,
        twinklePhase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.5 ? '#38bdf8' : '#fde047',
        life: 1.0,
        decay: 0.02 + Math.random() * 0.015
      });
    }
  }

  createLaserBurst(x, y, params = {}) {
    const targetX = params.targetX || (x + 280);
    const targetY = params.targetY || y;
    const color = params.color || '#ef4444';

    this.particles.push({
      type: 'laser_shot',
      x1: x,
      y1: y,
      x2: targetX,
      y2: targetY,
      color,
      width: params.width || 6,
      life: 1.0,
      decay: 0.08
    });

    this.createImpactSparks(targetX, targetY, color, 12);
  }

  createPlasmaBurst(x, y, params = {}) {
    const targetX = params.targetX || (x + 280);
    const targetY = params.targetY || y;
    const color = params.color || '#10b981';

    this.particles.push({
      type: 'laser_shot',
      x1: x,
      y1: y,
      x2: targetX,
      y2: targetY,
      color,
      width: params.width || 10,
      life: 1.0,
      decay: 0.07
    });

    if (this.shockwaves.length < this.maxShockwaves) {
      this.shockwaves.push({
        x: targetX,
        y: targetY,
        radius: 6,
        maxRadius: 75,
        speed: 280,
        lineWidth: 5,
        color,
        edgeColor: '#ffffff',
        alpha: 0.9,
        decay: 3.2
      });
    }

    this.createImpactSparks(targetX, targetY, color, 16);
  }

  createBallisticBurst(x, y, params = {}) {
    const targetX = params.targetX || (x + 280);
    const targetY = params.targetY || y;
    const tracerColor = params.color || '#fbbf24';

    this.particles.push({
      type: 'flash',
      x,
      y,
      radius: 25,
      color: '#fef08a',
      alpha: 0.85,
      life: 1.0,
      decay: 0.16
    });

    for (let i = 0; i < 3; i++) {
      const jx = (Math.random() - 0.5) * 8;
      const jy = (Math.random() - 0.5) * 8;
      this.particles.push({
        type: 'laser_shot',
        x1: x + jx,
        y1: y + jy,
        x2: targetX + (Math.random() - 0.5) * 12,
        y2: targetY + (Math.random() - 0.5) * 12,
        color: tracerColor,
        width: 3.5,
        life: 1.0,
        decay: 0.10 + i * 0.03
      });
    }

    this.createImpactSparks(targetX, targetY, '#f59e0b', 10);
  }

  createMeleeSlash(x, y, params = {}) {
    const targetX = params.targetX || x;
    const targetY = params.targetY || y;
    const color = params.color || '#00f3ff';
    const angle = Math.atan2(targetY - y, targetX - x) + Math.PI / 2;
    const slashLen = 45;

    this.particles.push({
      type: 'laser_shot',
      x1: targetX - Math.cos(angle) * slashLen,
      y1: targetY - Math.sin(angle) * slashLen,
      x2: targetX + Math.cos(angle) * slashLen,
      y2: targetY + Math.sin(angle) * slashLen,
      color,
      width: 7,
      life: 1.0,
      decay: 0.09
    });

    this.particles.push({
      type: 'flash',
      x: targetX,
      y: targetY,
      radius: 35,
      color,
      alpha: 0.8,
      life: 1.0,
      decay: 0.12
    });

    this.createImpactSparks(targetX, targetY, color, 14);
  }

  createVoidBeam(x, y, params = {}) {
    const targetX = params.targetX || (x + 280);
    const targetY = params.targetY || y;
    const color = params.color || '#a855f7';

    this.particles.push({
      type: 'laser_shot',
      x1: x,
      y1: y,
      x2: targetX,
      y2: targetY,
      color,
      width: 8,
      life: 1.0,
      decay: 0.06
    });

    if (this.shockwaves.length < this.maxShockwaves) {
      this.shockwaves.push({
        x: targetX,
        y: targetY,
        radius: 8,
        maxRadius: 95,
        speed: 220,
        lineWidth: 6,
        color: '#c084fc',
        edgeColor: '#6b21a8',
        alpha: 0.95,
        decay: 2.6
      });
    }

    this.createImpactSparks(targetX, targetY, '#d8b4fe', 16);
  }

  createImpactSparks(x, y, color = '#00f3ff', count = 8) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const ang = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 260;
      this.particles.push({
        type: 'spark',
        x,
        y,
        prevX: x,
        prevY: y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        drag: 0.93,
        gravity: 25,
        size: 1.8 + Math.random() * 2.2,
        color,
        life: 1.0,
        decay: 0.04 + Math.random() * 0.04
      });
    }
  }

  // Helper: Sample point inside an effect's designated boundary (circle, polygon, line)
  getRandomPointInEffect(eff) {
    if (eff.shape === 'polygon' && eff.points && eff.points.length >= 3) {
      const idx = 1 + Math.floor(Math.random() * (eff.points.length - 2));
      const p0 = eff.points[0];
      const p1 = eff.points[idx];
      const p2 = eff.points[idx + 1];
      let r1 = Math.random();
      let r2 = Math.random();
      if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
      return {
        x: p0.x + r1 * (p1.x - p0.x) + r2 * (p2.x - p0.x),
        y: p0.y + r1 * (p1.y - p0.y) + r2 * (p2.y - p0.y)
      };
    } else if (eff.shape === 'line') {
      const t = Math.random();
      const x2 = eff.x2 ?? (eff.x + 160);
      const y2 = eff.y2 ?? eff.y;
      return {
        x: eff.x + t * (x2 - eff.x),
        y: eff.y + t * (y2 - eff.y)
      };
    } else {
      // Circle
      const r = Math.sqrt(Math.random()) * (eff.radius || 120);
      const ang = Math.random() * Math.PI * 2;
      return {
        x: eff.x + Math.cos(ang) * r,
        y: eff.y + Math.sin(ang) * r
      };
    }
  }

  // Helper: Sample point on perimeter of effect (circle rim, polygon edge, line)
  getRandomPointOnPerimeter(eff) {
    if (eff.shape === 'polygon' && eff.points && eff.points.length >= 3) {
      const idx = Math.floor(Math.random() * eff.points.length);
      const p1 = eff.points[idx];
      const p2 = eff.points[(idx + 1) % eff.points.length];
      const t = Math.random();
      return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y)
      };
    } else if (eff.shape === 'line') {
      const t = Math.random();
      const x2 = eff.x2 ?? (eff.x + 160);
      const y2 = eff.y2 ?? eff.y;
      return {
        x: eff.x + t * (x2 - eff.x),
        y: eff.y + t * (y2 - eff.y)
      };
    } else {
      // Circle perimeter
      const ang = Math.random() * Math.PI * 2;
      const r = eff.radius || 120;
      return {
        x: eff.x + Math.cos(ang) * r,
        y: eff.y + Math.sin(ang) * r
      };
    }
  }

  // --- THROTTLED PERSISTENT EMITTERS SIMULATION ---
  // Keeps map elements alive without flooding CPU or memory
  updateEmitters(mapEffects = [], dt) {
    // 0. Automatic cleanup of deleted persistent emitters
    const activeIds = new Set(mapEffects.map(e => e.id));
    for (const [id] of this.emitterTimers) {
      if (!activeIds.has(id)) this.emitterTimers.delete(id);
    }

    // Purge any void rifts whose effect was deleted or whose type is no longer 'void_rift'
    const activeVoidRiftIds = new Set(
      mapEffects.filter(e => e.active !== false && e.type === 'void_rift').map(e => e.id)
    );
    for (let i = this.voidRifts.length - 1; i >= 0; i--) {
      const rift = this.voidRifts[i];
      if (rift.persistent && !activeVoidRiftIds.has(rift.id)) {
        this.voidRifts.splice(i, 1);
      }
    }

    for (const eff of mapEffects) {
      if (eff.active === false) continue;

      let timer = this.emitterTimers.get(eff.id) || 0;
      timer += dt;

      const rate = 1.0 / (eff.intensity || 1.0);

      // 0. LASER BEAM (Tactical Coherent Laser Emitter)
      if (eff.type === 'laser') {
        const interval = Math.max(0.03, 0.08 * rate);
        if (timer >= interval) {
          timer = 0;
          if (this.particles.length < this.maxParticles) {
            const x1 = eff.x;
            const y1 = eff.y;
            const x2 = eff.x2 ?? (eff.x + 260);
            const y2 = eff.y2 ?? eff.y;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.hypot(dx, dy) || 1;
            const ux = dx / dist;
            const uy = dy / dist;
            const nx = -uy;
            const ny = ux;
            const bw = eff.beamWidth || 6;
            const color = eff.color || '#ef4444';

            // High-velocity coherent photon packets along beam
            const t = Math.random();
            const jit = (Math.random() - 0.5) * bw * 0.7;
            const speed = 260 + Math.random() * 220;
            this.particles.push({
              type: 'spark',
              effectId: eff.id,
              x: x1 + t * dx + nx * jit,
              y: y1 + t * dy + ny * jit,
              prevX: x1 + t * dx,
              prevY: y1 + t * dy,
              vx: ux * speed + nx * (Math.random() - 0.5) * 15,
              vy: uy * speed + ny * (Math.random() - 0.5) * 15,
              drag: 0.98,
              size: 1.6 + Math.random() * 1.5,
              color: Math.random() > 0.4 ? '#ffffff' : color,
              life: 1.0,
              decay: 0.05
            });

            // Impact sparks bursting backwards from Point B
            for (let s = 0; s < 2; s++) {
              const backAngle = Math.atan2(-uy, -ux) + (Math.random() - 0.5) * 1.9;
              const sparkSpeed = 60 + Math.random() * 160;
              this.particles.push({
                type: 'spark',
                effectId: eff.id,
                x: x2 + (Math.random() - 0.5) * 6,
                y: y2 + (Math.random() - 0.5) * 6,
                prevX: x2,
                prevY: y2,
                vx: Math.cos(backAngle) * sparkSpeed,
                vy: Math.sin(backAngle) * sparkSpeed,
                drag: 0.94,
                size: 1.6 + Math.random() * 2.0,
                color: Math.random() > 0.35 ? color : '#ffffff',
                life: 1.0,
                decay: 0.04 + Math.random() * 0.025
              });
            }
          }
        }
      }
      // 1. VOID RIFT (Black hole with cosmic accretion disk)
      else if (eff.type === 'void_rift') {
        if (timer >= 0.14 * rate) {
          timer = 0;
          {
            this.createVoidRift(eff.x, eff.y, {
              id: eff.id,
              radius: eff.radius || 110,
              intensity: eff.intensity || 1.0,
              count: 4,
              decay: 0
            });
          }
        }
      }
      // 2. TOXIC (Bubbling green dots & floating skulls/bones)
      else if (eff.type === 'toxic') {
        if (timer >= 0.16 * rate) {
          timer = 0;
          if (this.particles.length < this.maxParticles) {
            if (eff.shape === 'line') {
              const x1 = eff.x;
              const y1 = eff.y;
              const x2 = eff.x2 ?? (eff.x + 160);
              const y2 = eff.y2 ?? eff.y;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const dist = Math.hypot(dx, dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;
              const nx = -uy;
              const ny = ux;
              const t = Math.random() * 0.4;
              const spd = (90 + Math.random() * 110) * (eff.intensity || 1.0);

              this.particles.push({
                type: 'toxic_bubble',
                effectId: eff.id,
                x: x1 + t * dx + nx * (Math.random() - 0.5) * 12,
                y: y1 + t * dy + ny * (Math.random() - 0.5) * 12,
                vx: ux * spd + nx * (Math.random() - 0.5) * 20,
                vy: uy * spd + ny * (Math.random() - 0.5) * 20,
                drag: 0.96,
                size: 3.0 + Math.random() * 4.5,
                color: '#22c55e',
                alpha: 0.85,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.015
              });

              if (Math.random() < 0.28) {
                this.particles.push({
                  type: 'toxic_skull',
                  effectId: eff.id,
                  x: x1 + t * dx + nx * (Math.random() - 0.5) * 10,
                  y: y1 + t * dy + ny * (Math.random() - 0.5) * 10,
                  vx: ux * (spd * 0.8) + nx * (Math.random() - 0.5) * 15,
                  vy: uy * (spd * 0.8) + ny * (Math.random() - 0.5) * 15,
                  drag: 0.98,
                  rotation: (Math.random() - 0.5) * 0.2,
                  rotSpeed: (Math.random() - 0.5) * 0.5,
                  size: 13 + Math.random() * 6,
                  life: 1.0,
                  decay: 0.014
                });
              }
            } else {
              const pt = this.getRandomPointInEffect(eff);
              // Green bubbling dot
              this.particles.push({
                type: 'toxic_bubble',
                effectId: eff.id,
                x: pt.x,
                y: pt.y,
                vx: (Math.random() - 0.5) * 14,
                vy: -18 - Math.random() * 28,
                drag: 0.96,
                size: 3.0 + Math.random() * 4.5,
                color: '#22c55e',
                alpha: 0.85,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.015
              });

              // Occasional skull and crossbones
              if (Math.random() < 0.28) {
                const skullPt = this.getRandomPointInEffect(eff);
                this.particles.push({
                  type: 'toxic_skull',
                  effectId: eff.id,
                  x: skullPt.x,
                  y: skullPt.y,
                  vx: (Math.random() - 0.5) * 8,
                  vy: -14 - Math.random() * 20,
                  drag: 0.98,
                  rotation: (Math.random() - 0.5) * 0.2,
                  rotSpeed: (Math.random() - 0.5) * 0.5,
                  size: 13 + Math.random() * 6,
                  life: 1.0,
                  decay: 0.014
                });
              }
            }
          }
        }
      }
      // 3. RADIOACTIVE (Pulsing ☢ signs & glowing green aura)
      else if (eff.type === 'radioactive') {
        if (timer >= 0.28 * rate) {
          timer = 0;
          if (this.particles.length < this.maxParticles) {
            const pInt = eff.particleIntensity ?? eff.intensity ?? 1.0;
            if (eff.shape === 'line') {
              const x1 = eff.x;
              const y1 = eff.y;
              const x2 = eff.x2 ?? (eff.x + 160);
              const y2 = eff.y2 ?? eff.y;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const dist = Math.hypot(dx, dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;
              const nx = -uy;
              const ny = ux;
              const t = Math.random() * 0.5;
              const spd = 70 + Math.random() * 80;

              this.particles.push({
                type: 'radioactive_trefoil',
                effectId: eff.id,
                x: x1 + t * dx + nx * (Math.random() - 0.5) * 14,
                y: y1 + t * dy + ny * (Math.random() - 0.5) * 14,
                vx: ux * spd + nx * (Math.random() - 0.5) * 15,
                vy: uy * spd + ny * (Math.random() - 0.5) * 15,
                drag: 0.98,
                rotation: (Math.random() - 0.5) * 0.3,
                rotSpeed: (Math.random() - 0.5) * 0.4,
                size: 18 + Math.random() * 14,
                alpha: Math.min(1.0, 0.85 * pInt),
                life: 1.0,
                decay: 0.012
              });
            } else {
              const pt = this.getRandomPointInEffect(eff);
              this.particles.push({
                type: 'radioactive_trefoil',
                effectId: eff.id,
                x: pt.x,
                y: pt.y,
                vx: (Math.random() - 0.5) * 6,
                vy: -8 - Math.random() * 12,
                drag: 0.98,
                rotation: (Math.random() - 0.5) * 0.3,
                rotSpeed: (Math.random() - 0.5) * 0.4,
                size: 18 + Math.random() * 14,
                alpha: Math.min(1.0, 0.85 * pInt),
                life: 1.0,
                decay: 0.012
              });
            }
          }
        }
      }
      // Fire is rendered as a clipped continuous field, not perimeter particle blobs.
      else if (eff.type === 'fire') { timer = 0; }
      // 5. LIGHTNING / ARC STORM (Straight-Line Arc Storm A to B, Electrified polygon nodes, Circle center-to-rim)
      else if (eff.type === 'lightning') {
        const isLine = eff.shape === 'line' || eff.lightningMode === 'line';
        const freq = eff.frequency || 1.0;
        // Continuous rapid discharges in straight line Arc Storm mode
        const interval = isLine ? Math.max(0.06, (0.35 / freq) * rate) : Math.max(0.25, (2.4 / freq) * rate);

        if (timer >= interval) {
          timer = 0;
          if (this.lightningBolts.length < this.maxLightning) {
            const boltColor = eff.color || '#00f3ff';
            const mode = eff.lightningMode || (eff.shape === 'polygon' ? 'polygon' : (eff.shape === 'line' ? 'line' : 'circle'));

            if (mode === 'line' || isLine) {
              // Direct Arc Storm from Point A to Point B
              const x2 = eff.x2 ?? (eff.x + 180);
              const y2 = eff.y2 ?? eff.y;
              this.createLightning(eff.x, eff.y, { targetX: x2, targetY: y2, color: boltColor });

              // Grounding / impact sparks at Point B and Point A
              if (this.particles.length < this.maxParticles) {
                for (let s = 0; s < 2; s++) {
                  const ang = Math.random() * Math.PI * 2;
                  const spd = 40 + Math.random() * 120;
                  this.particles.push({
                    type: 'spark',
                    effectId: eff.id,
                    x: x2 + (Math.random() - 0.5) * 8,
                    y: y2 + (Math.random() - 0.5) * 8,
                    prevX: x2,
                    prevY: y2,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd,
                    drag: 0.93,
                    size: 2.0,
                    color: boltColor,
                    life: 1.0,
                    decay: 0.05
                  });
                }
              }
            } else if (mode === 'polygon' && eff.points && eff.points.length >= 3) {
              // Electrified internal arcs between random nodes of polygon
              const i1 = Math.floor(Math.random() * eff.points.length);
              let i2 = Math.floor(Math.random() * eff.points.length);
              if (i1 === i2) i2 = (i1 + 1) % eff.points.length;
              this.createLightning(eff.points[i1].x, eff.points[i1].y, {
                targetX: eff.points[i2].x,
                targetY: eff.points[i2].y,
                color: boltColor
              });
            } else {
              // Circle mode: Center as emitter, striking to randomly selected perimeter point
              const r = eff.radius || 120;
              const ang = Math.random() * Math.PI * 2;
              this.createLightning(eff.x, eff.y, {
                targetX: eff.x + Math.cos(ang) * r,
                targetY: eff.y + Math.sin(ang) * r,
                color: boltColor
              });
            }
          }
        }
      }
      // 6. RADIANT (Solar light beam from A to B or radial core)
      else if (eff.type === 'radiant') {
        if (timer >= 0.35 * rate) {
          timer = 0;
          if (this.particles.length < this.maxParticles) {
            if (eff.shape === 'line') {
              const x1 = eff.x;
              const y1 = eff.y;
              const x2 = eff.x2 ?? (eff.x + 160);
              const y2 = eff.y2 ?? eff.y;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const dist = Math.hypot(dx, dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;
              const nx = -uy;
              const ny = ux;
              const t = Math.random();
              const spd = 120 + Math.random() * 140;

              this.particles.push({
                type: 'spark',
                effectId: eff.id,
                x: x1 + t * dx + nx * (Math.random() - 0.5) * 14,
                y: y1 + t * dy + ny * (Math.random() - 0.5) * 14,
                prevX: x1 + t * dx,
                prevY: y1 + t * dy,
                vx: ux * spd + nx * (Math.random() - 0.5) * 20,
                vy: uy * spd + ny * (Math.random() - 0.5) * 20,
                drag: 0.96,
                size: 2.4,
                color: '#fef08a',
                life: 1.0,
                decay: 0.03
              });
            } else {
              const pt = this.getRandomPointInEffect(eff);
              this.particles.push({
                type: 'spark',
                effectId: eff.id,
                x: pt.x,
                y: pt.y,
                prevX: pt.x,
                prevY: pt.y,
                vx: (Math.random() - 0.5) * 35,
                vy: -20 - Math.random() * 30,
                drag: 0.96,
                size: 2.2,
                color: '#fef08a',
                life: 1.0,
                decay: 0.03
              });
            }
          }
        }
      }
      // 7. EXPLOSION
      else if (eff.type === 'explosion') {
        if (timer >= 0.35 * rate) {
          timer = 0;
          if (this.particles.length < this.maxParticles) {
            const x1 = eff.x;
            const y1 = eff.y;
            const x2 = eff.x2 ?? (eff.x + 160);
            const y2 = eff.y2 ?? eff.y;
            const t = eff.shape === 'line' ? Math.random() : 0;
            const posX = x1 + t * (x2 - x1) + (Math.random() - 0.5) * 16;
            const posY = y1 + t * (y2 - y1) + (Math.random() - 0.5) * 16;

            this.particles.push({
              type: 'fireball',
              effectId: eff.id,
              x: posX,
              y: posY,
              vx: (Math.random() - 0.5) * 25,
              vy: -30 - Math.random() * 40,
              drag: 0.96,
              size: 14 * (eff.intensity || 1.0),
              maxSize: 28 * (eff.intensity || 1.0),
              growth: 16,
              rotation: 0,
              rotSpeed: 0,
              life: 1.0,
              decay: 0.035
            });
          }
        }
      }
      // 8. EMP (Directional shockwaves A to B or omnidirectional pulse)
      else if (eff.type === 'emp') {
        const interval = eff.shape === 'line' ? Math.max(0.8, 1.8 * rate) : (3.2 * rate);
        if (timer >= interval) {
          timer = 0;
          if (eff.shape === 'line') {
            const x1 = eff.x;
            const y1 = eff.y;
            const x2 = eff.x2 ?? (eff.x + 160);
            const y2 = eff.y2 ?? eff.y;
            this.createEMP(x1, y1, { intensity: eff.intensity || 1.0 });

            // Traveling wave pulses along segment
            for (let step = 1; step <= 3; step++) {
              const st = step / 3;
              this.shockwaves.push({
                x: x1 + st * (x2 - x1),
                y: y1 + st * (y2 - y1),
                radius: 8,
                maxRadius: 65 * (eff.intensity || 1.0),
                speed: 140,
                lineWidth: 3,
                color: 'rgba(0, 243, 255, 0.45)',
                edgeColor: '#38bdf8',
                alpha: 0.9,
                decay: 0.75,
                isHexagonal: true
              });
            }
          } else {
            this.createEMP(eff.x, eff.y, { intensity: eff.intensity || 1.0 });
          }
        }
      }
      // 9. SPARKLE (Stardust particle stream along vector A to B)
      else if (eff.type === 'sparkle') {
        if (timer >= 0.35 * rate) {
          timer = 0;
          if (this.particles.length < this.maxParticles) {
            if (eff.shape === 'line') {
              const x1 = eff.x;
              const y1 = eff.y;
              const x2 = eff.x2 ?? (eff.x + 160);
              const y2 = eff.y2 ?? eff.y;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const dist = Math.hypot(dx, dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;
              const nx = -uy;
              const ny = ux;
              const t = Math.random();
              const spd = 100 + Math.random() * 90;

              this.particles.push({
                type: 'stardust',
                effectId: eff.id,
                x: x1 + t * dx + nx * (Math.random() - 0.5) * 12,
                y: y1 + t * dy + ny * (Math.random() - 0.5) * 12,
                vx: ux * spd + nx * (Math.random() - 0.5) * 15,
                vy: uy * spd + ny * (Math.random() - 0.5) * 15,
                drag: 0.97,
                size: 2.2 + Math.random() * 2.5,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 1.5,
                twinklePhase: Math.random() * Math.PI * 2,
                color: Math.random() > 0.5 ? '#38bdf8' : '#fde047',
                life: 1.0,
                decay: 0.02
              });
            } else {
              const pt = this.getRandomPointInEffect(eff);
              this.particles.push({
                type: 'stardust',
                effectId: eff.id,
                x: pt.x,
                y: pt.y,
                vx: (Math.random() - 0.5) * 15,
                vy: -10 - Math.random() * 20,
                drag: 0.97,
                size: 2.2 + Math.random() * 2.5,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 1.5,
                twinklePhase: Math.random() * Math.PI * 2,
                color: Math.random() > 0.5 ? '#38bdf8' : '#fde047',
                life: 1.0,
                decay: 0.02
              });
            }
          }
        }
      }

      this.emitterTimers.set(eff.id, timer);
    }
  }

  // --- HARDWARE-ACCELERATED MAIN UPDATE & RENDER LOOP ---
  // Zero software shadowBlur inside loops; uses GPU-native additive blend
  updateAndRender(ctx, dt, mapEffects = [], viewport = null) {
    const combatOptions = { quality: this.quality, reducedMotion: !!this.reducedMotion?.matches, viewport };
    this.combat.render(ctx, dt, combatOptions);
    for (const effect of mapEffects) if (effect.type === 'fire') drawFireArea(ctx, effect, this.combat.time, combatOptions);

    // 0. Update persistent map effect emitters (always run to purge deleted effects)
    this.updateEmitters(mapEffects || [], dt);

    // Safety budget clamp: drop oldest particles if budget exceeded
    if (this.particles.length > this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles);
    }

    // 1. RENDER SHOCKWAVES
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      sw.alpha -= sw.decay * dt;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      // Viewport culling
      if (viewport) {
        if (sw.x + sw.radius < viewport.minX || sw.x - sw.radius > viewport.maxX ||
            sw.y + sw.radius < viewport.minY || sw.y - sw.radius > viewport.maxY) {
          continue;
        }
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = sw.lineWidth * (sw.radius / sw.maxRadius);
      ctx.strokeStyle = sw.color;

      ctx.beginPath();
      if (sw.isHexagonal) {
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2;
          const px = sw.x + Math.cos(a) * sw.radius;
          const py = sw.y + Math.sin(a) * sw.radius;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else {
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      }
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = sw.edgeColor;
      ctx.stroke();

      ctx.restore();
    }

    // 2. RENDER VOID RIFTS (Realistic Cosmic Black Hole — Relativistic Kerr Gravitational Model)
    const activeVoidRiftIds = new Set(
      (mapEffects || []).filter(e => e.active !== false && e.type === 'void_rift').map(e => e.id)
    );
    for (let i = this.voidRifts.length - 1; i >= 0; i--) {
      const rift = this.voidRifts[i];
      // Do not render or keep dead or deleted persistent rifts
      if (rift.persistent && !activeVoidRiftIds.has(rift.id)) {
        this.voidRifts.splice(i, 1);
        continue;
      }
      rift.rotation += rift.rotSpeed * dt;
      rift.life -= rift.decay * Math.min(dt, 0.05) * 60;

      if (rift.life <= 0) {
        this.voidRifts.splice(i, 1);
        continue;
      }

      // Viewport culling
      if (viewport) {
        if (rift.x + rift.radius * 1.5 < viewport.minX || rift.x - rift.radius * 1.5 > viewport.maxX ||
            rift.y + rift.radius * 1.5 < viewport.minY || rift.y - rift.radius * 1.5 > viewport.maxY) {
          continue;
        }
      }

      drawBlackHole(ctx, rift, this.quality, this.reducedMotion?.matches);
    }

    // 2.5. RENDER TACTICAL LASER BEAMS & LINE CONDUITS
    this.renderLaserBeams(ctx, mapEffects, dt);

    // 3. RENDER LIGHTNING BOLTS (Fractal Arcs)
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      bolt.life -= bolt.decay;

      if (bolt.life <= 0) {
        this.lightningBolts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'bevel';

      const renderArc = (pts, widthScale = 1.0) => {
        if (!pts || pts.length < 2) return;

        // Faint outer electric glow
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
        ctx.lineWidth = 10 * widthScale * bolt.life;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
        ctx.stroke();

        // Main colored arc
        ctx.strokeStyle = bolt.color;
        ctx.lineWidth = 3.5 * widthScale * bolt.life;
        ctx.stroke();

        // Hot white core
        ctx.strokeStyle = bolt.coreColor;
        ctx.lineWidth = 1.4 * widthScale * bolt.life;
        ctx.stroke();
      };

      renderArc(bolt.mainPoints, 1.0);
      for (const branch of bolt.branches) {
        renderArc(branch, 0.65);
      }

      ctx.restore();
    }

    // 4. RENDER PARTICLES (Fireballs, Sparks, Smoke, Stardust, God Rays, White Light Inflow)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      if (p.drag) {
        p.vx *= p.drag;
        p.vy *= p.drag;
      }
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }

      p.prevX = p.x;
      p.prevY = p.y;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;

      if (p.growth) {
        p.size = Math.min(p.maxSize || 999, p.size + p.growth * dt);
      }
      if (p.rotSpeed) {
        p.rotation += p.rotSpeed * dt;
      }

      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Viewport culling: Skip offscreen rendering
      if (viewport) {
        if (p.x < viewport.minX || p.x > viewport.maxX || p.y < viewport.minY || p.y > viewport.maxY) {
          continue;
        }
      }

      ctx.save();

      if (p.type === 'laser_shot') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.life * 0.85;
        ctx.lineWidth = p.width * 2.6;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = p.life * 0.98;
        ctx.lineWidth = Math.max(1.5, p.width * 0.4);
        ctx.stroke();
      } else if (p.type === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.life * p.alpha;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'god_ray') {
        p.angle += (p.rotSpeed || 0) * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.life * 0.65;

        const grad = ctx.createLinearGradient(0, 0, p.length, 0);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.35, p.color);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(p.length, -p.width / 2);
        ctx.lineTo(p.length, p.width / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'fireball') {
        // Fast dual-pass fill without runtime gradient allocations
        ctx.globalCompositeOperation = 'lighter';
        const alpha = Math.min(1.0, p.life * 1.2);

        // Outer warm plasma glow
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = p.life > 0.5 ? '#ff7700' : '#cc2200';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Hot luminous core
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = p.life > 0.6 ? '#ffffff' : '#ffcc00';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        // Hardware-accelerated spark streaks with zero CPU shadowBlur
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.life;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';

        const streakX = p.x - (p.vx || 0) * dt * 2.0;
        const streakY = p.y - (p.vy || 0) * dt * 2.0;

        ctx.beginPath();
        ctx.moveTo(streakX, streakY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // Bright white center dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'smoke') {
        // Lightweight translucent dark smoke puffs
        ctx.globalAlpha = p.life * p.alpha;
        ctx.fillStyle = 'rgba(30, 36, 48, 0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'singularity_inflow') {
        // Gravitational inward spiral implosion towards singularity
        const parent = this.voidRifts.find(r => r.id === p.riftId);
        if (parent) { p.riftX = parent.x; p.riftY = parent.y; p.singularityRadius = parent.singularityRadius; }
        const singularityR = p.singularityRadius || 24;
        const accel = Math.max(1.0, 95 / (p.dist || 1));
        p.dist -= p.radialSpeed * accel * dt;
        p.angle += p.angularSpeed * (1 + 80 / (p.dist + 10)) * dt;
        p.x = p.riftX + Math.cos(p.angle) * p.dist;
        p.y = p.riftY + Math.sin(p.angle) * p.dist;

        // Disappear instantly upon entering the event horizon
        if (p.dist <= singularityR + 2) {
          p.life = 0;
        }

        ctx.globalCompositeOperation = 'lighter';
        // Twinkling brilliant star point
        const twinkle = 0.75 + Math.sin(p.dist * 0.2 + p.angle * 3) * 0.25;
        ctx.globalAlpha = Math.min(1.0, p.life * twinkle);

        // Render point simulating star
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Pinpoint subtle micro-glint for brighter stars
        if (p.size >= 1.5) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(p.x - p.size * 1.5, p.y);
          ctx.lineTo(p.x + p.size * 1.5, p.y);
          ctx.moveTo(p.x, p.y - p.size * 1.5);
          ctx.lineTo(p.x, p.y + p.size * 1.5);
          ctx.stroke();
        }
      } else if (p.type === 'digital_mote') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.type === 'toxic_bubble') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1.0, p.life * 1.5) * (p.alpha || 0.85);
        ctx.fillStyle = p.color || '#22c55e';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'toxic_skull') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.globalAlpha = Math.min(1.0, p.life * 1.2) * 0.9;
        ctx.font = `${Math.round(p.size)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#86efac';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 6;
        ctx.fillText('☠', 0, 0);
        ctx.restore();
      } else if (p.type === 'radioactive_trefoil') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        const pulse = Math.sin(p.life * Math.PI) * (p.alpha || 0.85);
        ctx.globalAlpha = Math.max(0, pulse);
        ctx.font = `bold ${Math.round(p.size)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#4ade80';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8;
        ctx.fillText('☢', 0, 0);
        ctx.restore();
      } else if (p.type === 'stardust') {
        ctx.globalCompositeOperation = 'lighter';
        p.twinklePhase += dt * 4;
        const twinkle = 0.6 + Math.sin(p.twinklePhase) * 0.4;
        ctx.globalAlpha = p.life * twinkle;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // --- HARDWARE-ACCELERATED TACTICAL LASER BEAMS & LINE CONDUITS ---
  renderLaserBeams(ctx, mapEffects = [], dt) {
    if (!mapEffects || mapEffects.length === 0) return;
    const now = performance.now() * 0.001;

    for (const eff of mapEffects) {
      if (eff.active === false) continue;

      // 1. TACTICAL LASER BEAM
      if (eff.type === 'laser') {
        const x1 = eff.x;
        const y1 = eff.y;
        const x2 = eff.x2 ?? (eff.x + 260);
        const y2 = eff.y2 ?? eff.y;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) continue;

        const beamWidth = eff.beamWidth || 6;
        const intensity = eff.intensity ?? 1.0;
        const freq = eff.frequency ?? 1.0;
        const color = eff.color || '#ef4444';

        // High-frequency harmonic oscillation for tactical energy beam
        const pulse = 1.0 + 0.14 * Math.sin(now * freq * 16);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';

        // Outer Atmospheric Aura Bloom
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.min(1.0, 0.24 * intensity * pulse);
        ctx.lineWidth = beamWidth * 3.8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Focused Sheath
        ctx.globalAlpha = Math.min(1.0, 0.65 * intensity * pulse);
        ctx.lineWidth = beamWidth * 1.8;
        ctx.stroke();

        // Dense Energetic Core
        ctx.globalAlpha = Math.min(1.0, 0.92 * intensity);
        ctx.lineWidth = beamWidth * 0.9;
        ctx.stroke();

        // White-Hot Singularity Plasma Spine
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.96;
        ctx.lineWidth = Math.max(1.5, beamWidth * 0.32);
        ctx.stroke();

        // Emitter Aperture Lens Flare at Point A
        const nozzleR = Math.max(8, beamWidth * 2.2);
        const gradA = ctx.createRadialGradient(x1, y1, 0, x1, y1, nozzleR);
        gradA.addColorStop(0, '#ffffff');
        gradA.addColorStop(0.35, color);
        gradA.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradA;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(x1, y1, nozzleR, 0, Math.PI * 2);
        ctx.fill();

        // Lens aperture ring
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.65 * pulse;
        ctx.beginPath();
        ctx.arc(x1, y1, nozzleR * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        // Impact Searing Plasma Flare at Point B
        const impactR = Math.max(12, beamWidth * 3.2);
        const gradB = ctx.createRadialGradient(x2, y2, 0, x2, y2, impactR);
        gradB.addColorStop(0, '#ffffff');
        gradB.addColorStop(0.4, color);
        gradB.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradB;
        ctx.globalAlpha = Math.min(1.0, 0.98 * pulse);
        ctx.beginPath();
        ctx.arc(x2, y2, impactR, 0, Math.PI * 2);
        ctx.fill();

        // Conical back-spray splash ring
        const impactAngle = Math.atan2(dy, dx);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(x2, y2, impactR * 0.55, impactAngle + Math.PI * 0.58, impactAngle + Math.PI * 1.42);
        ctx.stroke();

        ctx.restore();
      }

      // 2. ARC STORM / STRAIGHT-LINE ELECTRIC CONDUIT GLOW
      else if (eff.type === 'lightning' && (eff.shape === 'line' || eff.lightningMode === 'line')) {
        const x1 = eff.x;
        const y1 = eff.y;
        const x2 = eff.x2 ?? (eff.x + 180);
        const y2 = eff.y2 ?? eff.y;
        const boltColor = eff.color || '#00f3ff';
        const pulse = Math.sin(now * 30);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';

        // Faint ionized air channel glow along line segment
        ctx.strokeStyle = boltColor;
        ctx.globalAlpha = Math.max(0.08, 0.18 + 0.10 * pulse);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = Math.max(0.12, 0.32 + 0.14 * Math.cos(now * 25));
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.restore();
      }
    }
  }
}
