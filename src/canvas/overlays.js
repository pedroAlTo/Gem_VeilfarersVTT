// What is drawn over the scene (split out of canvasEngine.js in v2.65.0): attack targeting,
// vibration sense, effect markers, particles and pings.
import { store } from '../state.js';
import { canvasFont } from '../fontSets.js';
import { DEFAULT_METERS_PER_SQUARE, gapBandFor, tokenGapSquares } from '../attackFlow.js';

export const overlayMethods = {
  // --- Tactical Attack Targeting LOS & Distance Rendering ---
  renderAttackTargeting(ctx, map, time) {
    const state = store.getState();
    const tokens = store.getTokensForActiveMap();
    if (!tokens || tokens.length < 2) return;

    let targetId = this.attackTarget?.targetId || state.targetTokenId;
    let attackerId = this.attackTarget?.attackerId;

    if (!targetId) return;

    const target = tokens.find(t => t.id === targetId);
    if (!target) return;

    let attacker = tokens.find(t => t.id === attackerId);
    if (!attacker) {
      if (state.selectedTokenId && state.selectedTokenId !== targetId) {
        attacker = tokens.find(t => t.id === state.selectedTokenId);
      } else if (state.claimedTokenId && state.claimedTokenId !== targetId) {
        attacker = tokens.find(t => t.id === state.claimedTokenId);
      }
    }

    if (!attacker || attacker.id === target.id) return;

    // Visibility test for players: do not reveal adversaries out of sight
    if (state.userRole !== 'keeper' && !target.isPlayer && !this.isTokenVisibleToPlayers(target, tokens, map)) {
      return;
    }

    const x1 = attacker.x;
    const y1 = attacker.y;
    const x2 = target.x;
    const y2 = target.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const distPx = Math.hypot(dx, dy);
    if (distPx < 1) return;

    const gridSize = map.gridSize || 64;
    // Same scale and bands as the attack and the ruler.
    const metersPerSquare = map.gridScaleMeters || DEFAULT_METERS_PER_SQUARE;
    // Base to base, like the attack: the gap between the edges of the two tokens.
    const gapSquares = tokenGapSquares(attacker, target, gridSize);
    const distSquares = gapSquares.toFixed(1);
    const distMeters = (gapSquares * metersPerSquare).toFixed(1);
    const lockBand = gapBandFor(gapSquares, metersPerSquare).toUpperCase();

    // LOS obstruction test against walls and closed doors
    let losBlocked = false;
    for (const wall of (map.walls || [])) {
      const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
      if (wallType === 'window') continue;
      if (wallType === 'door' && wall.isOpen) continue;
      if (this.checkLineIntersection(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2)) {
        losBlocked = true;
        break;
      }
    }

    ctx.save();

    // 1. Draw Discrete Targeting Vector Line
    const beamColor = losBlocked ? 'rgba(239, 68, 68, 0.55)' : 'rgba(0, 243, 255, 0.45)';
    ctx.strokeStyle = beamColor;
    ctx.lineWidth = 1.2 / this.zoom;
    ctx.shadowBlur = 0;
    if (losBlocked) {
      ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
    } else {
      ctx.lineDashOffset = -(time * 24) % 16;
      ctx.setLineDash([8 / this.zoom, 4 / this.zoom]);
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // 2. Discrete Corner Brackets around Target Token (Non-intrusive)
    const targetRadius = ((target.size || 1) * gridSize) / 2;
    const bracketDist = targetRadius + 4 / this.zoom;
    const bracketLen = 6 / this.zoom;

    ctx.save();
    ctx.translate(x2, y2);
    ctx.strokeStyle = losBlocked ? 'rgba(239, 68, 68, 0.7)' : 'rgba(0, 243, 255, 0.65)';
    ctx.lineWidth = 1 / this.zoom;
    ctx.setLineDash([]);

    // 4 subtle corner brackets
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(bracketDist - bracketLen, -bracketDist);
      ctx.lineTo(bracketDist, -bracketDist);
      ctx.lineTo(bracketDist, -bracketDist + bracketLen);
      ctx.stroke();
      ctx.rotate(Math.PI / 2);
    }
    ctx.restore();

    // 3. Compact & Discrete Tactical Distance Pill at Midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const distText = losBlocked ? `⚠️ BLOQUEADO · ${lockBand} · ${distMeters}m (${distSquares}c)` : `⚡ ${lockBand} · ${distMeters}m (${distSquares}c)`;
    ctx.font = `${Math.max(8.5, Math.round(9.5 / this.zoom))}px ${canvasFont('hud')}`;
    const textW = ctx.measureText(distText).width;
    const pillW = textW + 12 / this.zoom;
    const pillH = 15 / this.zoom;

    ctx.fillStyle = 'rgba(7, 16, 29, 0.72)';
    ctx.strokeStyle = losBlocked ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 243, 255, 0.35)';
    ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();
    ctx.roundRect(midX - pillW / 2, midY - pillH / 2, pillW, pillH, 3 / this.zoom);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = losBlocked ? '#fca5a5' : '#a5f4ff';
    ctx.fillText(distText, midX, midY);

    ctx.restore();
  },

  // --- Sensory Vision Acoustic Pass (Tremorsense 360°: reveals ground creatures through darkness) ---
  // Slow dramatic 10-second pulse cycle (Aliens motion tracker aesthetic)
  renderSensoryVision(ctx, sensoryTokens, allTokens, time, gridSize = 64) {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';
    const cycleDuration = 10.0; // 10 seconds between sweeps
    const waveDuration = 3.2;   // Pulse expands slowly across deck over 3.2s
    const timeInCycle = time % cycleDuration;

    for (const sensorTok of sensoryTokens) {
      const sRange = sensorTok.vibrationRadius || sensorTok.visionRange || 280;

      ctx.save();

      // 1. Expanding acoustic wavefront from sensor token (first 3.2s of the 10s cycle)
      if (timeInCycle < waveDuration) {
        const prog = timeInCycle / waveDuration;
        const curR = prog * sRange;
        const waveAlpha = (1 - prog) * 0.45;

        ctx.strokeStyle = `rgba(52, 211, 153, ${waveAlpha})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(sensorTok.x, sensorTok.y, curR, 0, Math.PI * 2);
        ctx.stroke();

        if (prog > 0.25) {
          const prog2 = (prog - 0.25) / 0.75;
          ctx.strokeStyle = `rgba(52, 211, 153, ${(1 - prog2) * 0.18})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(sensorTok.x, sensorTok.y, prog2 * sRange, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 2. Detect moving ground contacts within vibration radius
      for (const target of allTokens) {
        if (target.id === sensorTok.id || target.isFlying) continue;

        const dist = Math.hypot(target.x - sensorTok.x, target.y - sensorTok.y);
        if (dist > sRange) continue;

        const arrivalTime = (dist / sRange) * waveDuration;
        const timeSinceArrival = timeInCycle - arrivalTime;
        const blipDuration = 2.8; // Dramatic fade over 2.8s

        if (timeSinceArrival >= 0 && timeSinceArrival < blipDuration) {
          const blipProg = timeSinceArrival / blipDuration;
          // Smooth pulse curve: fast rise, slow eerie decay
          const intensity = Math.sin(blipProg * Math.PI) * Math.pow(1 - blipProg, 0.6);
          const targetRadius = ((target.size || 1) * gridSize) / 2;

          ctx.save();
          ctx.globalAlpha = intensity;

          // A. Slow dramatic phosphor green contact ring (token footprint)
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(target.x, target.y, targetRadius + 4, 0, Math.PI * 2);
          ctx.stroke();

          // B. Faint secondary echo ring expanding outward
          const echoR = targetRadius + 4 + blipProg * 14;
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(target.x, target.y, echoR, 0, Math.PI * 2);
          ctx.stroke();

          // C. Center phosphor ping dot
          ctx.fillStyle = 'rgba(52, 211, 153, 0.85)';
          ctx.beginPath();
          ctx.arc(target.x, target.y, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // D. Vibration acoustic bearing line from sensor to target
          ctx.save();
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(sensorTok.x, sensorTok.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.restore();

          // E. Acoustic radar blip label - All non-player tokens mask identity with ????? for players
          const isMasked = !target.isPlayer || this.isHorrorToken(target);
          const labelText = isMasked
            ? (isKeeper && state.gmVision ? `📡 VIBRACIÓN: ????? [${target.name.toUpperCase()}]` : '📡 VIBRACIÓN: ?????')
            : `📡 VIBRACIÓN: ${target.name.toUpperCase()}`;

          ctx.font = `bold 9px ${canvasFont('hud')}`;
          const textW = ctx.measureText(labelText).width;
          const badgeW = Math.max(90, textW + 20);

          ctx.fillStyle = 'rgba(6, 78, 59, 0.9)';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(target.x - badgeW / 2, target.y - 42, badgeW, 18, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#6ee7b7';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, target.x, target.y - 33);

          ctx.restore();
        }
      }

      ctx.restore();
    }
  },

  // --- Persistent Anomaly Effect Markers Rendering ---
  renderEffectMarkers(ctx, effects) {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';

    for (const eff of effects) {
      const isSelected = eff.id === state.selectedEffectId;
      if (!isKeeper && !isSelected && eff.active === false) continue;

      const shape = eff.shape || 'circle';
      const icon = eff.type === 'laser' ? '🔴'
                 : eff.type === 'void_rift' ? '🌌'
                 : eff.type === 'radiant' ? '☀️'
                 : eff.type === 'explosion' ? '💥'
                 : eff.type === 'lightning' ? '⚡'
                 : eff.type === 'emp' ? '📡'
                 : eff.type === 'toxic' ? '☠️'
                 : eff.type === 'radioactive' ? '☢️'
                 : eff.type === 'fire' ? '🔥'
                 : '✨';

      ctx.save();

      if (shape === 'line') {
        if (eff.x2 === undefined || eff.x2 === null) {
          eff.x2 = eff.x + (eff.radius || 120) * 1.5;
          eff.y2 = eff.y;
        }

        // Draw Line
        ctx.strokeStyle = eff.active === false ? 'rgba(100, 116, 139, 0.4)' : (eff.color || '#00f3ff');
        ctx.lineWidth = isSelected ? 3.5 : 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(eff.x, eff.y);
        ctx.lineTo(eff.x2, eff.y2);
        ctx.stroke();

        // Endpoints handles (A and B)
        if (isKeeper || isSelected) {
          ctx.setLineDash([]);
          // Point A
          ctx.fillStyle = isSelected ? '#ffffff' : (eff.color || '#00f3ff');
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Point B
          ctx.beginPath();
          ctx.arc(eff.x2, eff.y2, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Midpoint Badge
          const midX = (eff.x + eff.x2) / 2;
          const midY = (eff.y + eff.y2) / 2;
          ctx.beginPath();
          ctx.arc(midX, midY, 14, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(0, 243, 255, 0.35)' : 'rgba(6, 11, 25, 0.75)';
          ctx.fill();
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, midX, midY);

          ctx.font = `bold 9px ${canvasFont('display')}`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText((eff.label || (eff.type === 'laser' ? 'Laser Beam' : 'Line Anomaly')).toUpperCase(), midX, midY - 18);
        }
      } else if (shape === 'polygon') {
        if (!eff.points || eff.points.length < 3) {
          const r = eff.radius || 120;
          eff.points = Array.from({length: 5}, (_, i) => ({
            x: Math.round(eff.x + Math.cos(i * Math.PI * 2 / 5 - Math.PI / 2) * r),
            y: Math.round(eff.y + Math.sin(i * Math.PI * 2 / 5 - Math.PI / 2) * r)
          }));
        }

        // Draw Polygon perimeter & subtle fill
        ctx.strokeStyle = eff.active === false ? 'rgba(100, 116, 139, 0.4)' : (eff.color || '#00f3ff');
        ctx.fillStyle = isSelected ? 'rgba(0, 243, 255, 0.08)' : 'rgba(0, 243, 255, 0.03)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.setLineDash([6, 4]);

        ctx.beginPath();
        ctx.moveTo(eff.points[0].x, eff.points[0].y);
        for (let i = 1; i < eff.points.length; i++) {
          ctx.lineTo(eff.points[i].x, eff.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Polygon Vertex handles
        if (isKeeper || isSelected) {
          ctx.setLineDash([]);
          for (let i = 0; i < eff.points.length; i++) {
            const pt = eff.points[i];
            ctx.fillStyle = isSelected ? '#ffffff' : (eff.color || '#00f3ff');
            ctx.strokeStyle = eff.color || '#00f3ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          // Center handle & badge
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, 14, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(0, 243, 255, 0.35)' : 'rgba(6, 11, 25, 0.75)';
          ctx.fill();
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, eff.x, eff.y);

          ctx.font = `bold 9px ${canvasFont('display')}`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText((eff.label || 'Poly Anomaly').toUpperCase(), eff.x, eff.y - 18);
        }
      } else {
        // Circle (Default)
        ctx.strokeStyle = eff.active === false ? 'rgba(100, 116, 139, 0.4)' : (eff.color || '#00f3ff');
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, eff.radius || 120, 0, Math.PI * 2);
        ctx.stroke();

        // Radius handle (if selected and keeper)
        if (isSelected && isKeeper) {
          ctx.setLineDash([]);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(eff.x + (eff.radius || 120), eff.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Center Anomaly Icon & Badge (if Keeper or selected)
        if (isKeeper || isSelected) {
          ctx.setLineDash([]);
          ctx.fillStyle = isSelected ? 'rgba(0, 243, 255, 0.35)' : 'rgba(6, 11, 25, 0.75)';
          ctx.strokeStyle = eff.color || '#00f3ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, eff.x, eff.y);

          // Label above
          ctx.font = `bold 9px ${canvasFont('display')}`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText((eff.label || 'Anomaly').toUpperCase(), eff.x, eff.y - 18);
        }
      }

      ctx.restore();
    }
  },

  // --- Particles, AAA FX & Pings ---
  renderParticlesAndPings(ctx, dt, mapEffects = []) {
    const now = performance.now();

    // 1. Radar Pings
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const ping = this.pings[i];
      const elapsed = (now - ping.startTime) / 1000;
      if (elapsed > 1.2) {
        this.pings.splice(i, 1);
        continue;
      }

      ping.radius = 10 + (ping.maxRadius - 10) * (elapsed / 1.2);
      ping.alpha = Math.max(0, 1 - elapsed / 1.2);

      ctx.save();
      ctx.strokeStyle = ping.color;
      ctx.globalAlpha = ping.alpha;
      ctx.lineWidth = 3;
      ctx.shadowColor = ping.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(ping.x, ping.y, ping.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ping.x, ping.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = ping.color;
      ctx.fill();

      ctx.restore();
    }

    // 2. High-Performance Tactical FX Simulation with Map Effects & Frustum Culling
    const viewport = this.getViewportBounds(160);
    this.fx.updateAndRender(ctx, dt, mapEffects, viewport);
  },
};
