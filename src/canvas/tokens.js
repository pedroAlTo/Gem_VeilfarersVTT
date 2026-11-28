// Tokens on the map (split out of canvasEngine.js in v2.65.0): portraits, frames, names,
// conditions and vitals, the ghost of a token being placed and the condition tooltip.
import { mapPortraitLayers } from '../tokenAvatars.js';
import { isEncounterMarker } from '../bestiaryProfiles.js';
import { drawStatBars, drawStatPips, drawStatRing, ringRadius } from '../tokenVitals.js';
import { LAYOUT_STATS, namesHidden, statFor, tokenLayout } from '../tokenLayout.js';
import { frameBody, frameById, frameGeometry, frameLight } from '../tokenFrames.js';
import { drawTokenConditions, getHoveredCondition } from '../conditions.js';
import { store } from '../state.js';
import { canvasFont } from '../fontSets.js';
import { pointInWater } from '../waterGeometry.js';
import { drawEffectClocks } from '../effectClocks.js';
import { keepsTokenColor } from '../ancestryVision.js';
import { sharesSight } from './helpers.js';

export const tokenMethods = {
  // --- Tokens Rendering ---
  renderTokens(scene, map, time, vision = null, viewer = null) {
    const tokens = this.displayTokens();
    const state = store.getState();
    const gridSize = map.gridSize || 64;
    const isKeeperGM = state.userRole === 'keeper' && state.gmVision;
    // The Keeper's view always shows every token, also in the fog (v2.29.3, user decision); the ones
    // the party does not see are dimmed and marked. Only the player's view hides them.
    const keeperSees = state.userRole === 'keeper';

    for (const tok of tokens) {
      const radius = (tok.size * gridSize) / 2;
      const isSelected = tok.id === state.selectedTokenId;

      // Visibility Check:
      // Adversary / NPC tokens remain in the dark and are ONLY drawn if a player is facing them in LOS or inside an illuminated explored light
      const isVisibleToPlayers = this.isTokenVisibleToPlayers(tok, tokens, map);
      const fullMapId = `${state.campaignId}:${map.id}`;

      if (isVisibleToPlayers) {
        if (!tok.isPlayer) {
          this.lastKnownEnemyPositions.set(tok.id, {
            x: tok.x,
            y: tok.y,
            size: tok.size,
            avatar: tok.avatar,
            name: tok.name,
            color: tok.color,
            mapId: map.id
          });
        }
      } else if (!keeperSees) {
        // Token is out of real-time vision.
        // If players previously spotted this enemy in explored territory, show frozen last known position
        const lastPos = this.lastKnownEnemyPositions.get(tok.id);
        if (lastPos && lastPos.mapId === map.id) {
          if (this.isPointInPlayerVision(lastPos.x, lastPos.y, tokens, map)) {
            // Player is looking right at the spot and sees it is now empty: remove ghost
            this.lastKnownEnemyPositions.delete(tok.id);
          } else if (this.fog.isPointExplored(lastPos.x, lastPos.y, fullMapId)) {
            // Draw frozen last known position in the fog shroud
            this.renderGhostToken(vision?.grey() || scene, lastPos, gridSize, time);
          }
        }
        continue;
      }

      // Check if token is in any water zone
      const waterZone = (map.waterZones || []).find(w => pointInWater(tok.x, tok.y, w));

      const ctx = !vision ? scene : keepsTokenColor(tok, viewer, store.memberId || store.peerId) ? vision.color() : vision.grey();
      ctx.save();
      ctx.translate(tok.x, tok.y);

      // Dimmed transparency for tokens in the dark seen by Keeper
      if (!isVisibleToPlayers && keeperSees) {
        ctx.globalAlpha = 0.52;
      }

      // Water Wake Ripple Effect at feet
      if (waterZone) {
        const ripplePhase = (time * 2) % 1;
        const rippleRadius = radius * (1 + ripplePhase * 0.8);
        const rippleAlpha = 1 - ripplePhase;

        ctx.save();
        ctx.strokeStyle = waterZone.color || 'rgba(56, 189, 248, 0.7)';
        ctx.globalAlpha = rippleAlpha * 0.7;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (tok.hidden) {
        ctx.globalAlpha = 0.55;
      }

      // Selection Glow
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
        ctx.stroke();

        const ext = radius + 10;
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(ext - 8, ext);
          ctx.lineTo(ext, ext);
          ctx.lineTo(ext, ext - 8);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Avatar & Defeated / Dead Token representation (HP <= 0)
      const layers = mapPortraitLayers(tok);
      const bossPending = tok.boss ? !tok.boss.defeated && (tok.boss.index < tok.boss.states.length - 1 || tok.boss.states[tok.boss.index].defeat === 'objective') : tok.bossStatus?.pending;
      const isDead = tok.boss?.defeated || tok.bossStatus?.defeated || (!isEncounterMarker(tok) && typeof tok.hp?.current === 'number' && tok.hp.current <= 0 && !bossPending);

      // A frame (v2.60.0): the portrait fills its hole; the frame is drawn after the rim.
      const frame = frameById(tok.frame), frameFit = frame && frameGeometry(frame, radius);
      const portraitR = frameFit ? Math.min(radius, frameFit.hole + 1) : radius;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, portraitR, 0, Math.PI * 2);
      ctx.clip();

      if (isDead) {
        ctx.fillStyle = '#0a0f1d';
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

        const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        radGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
        radGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

        ctx.fillStyle = '#f87171';
        ctx.font = `bold ${Math.round(radius * 1.15)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠️', 0, 0);
      } else {
        const img = this.getTokenImage(layers.portrait);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -portraitR, -portraitR, portraitR * 2, portraitR * 2);
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
          ctx.fillStyle = '#00f3ff';
          ctx.font = `bold ${Math.round(radius * 0.7)}px ${canvasFont('display')}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const isKeeper = state.userRole === 'keeper';
          const isMaskedLetter = !isKeeper && this.isHorrorToken(tok);
          ctx.fillText(isMaskedLetter ? '?' : (tok.name ? tok.name.charAt(0) : '?'), 0, 0);
        }
      }

      // Spotlight Top Specular Highlight on Token Avatar
      if ((tok.hasSpotlight || tok.spotlight?.enabled) && !isDead) {
        const specGrad = ctx.createLinearGradient(0, -radius, 0, radius * 0.35);
        specGrad.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
        specGrad.addColorStop(0.6, 'rgba(251, 191, 36, 0.08)');
        specGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = specGrad;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      }

      ctx.restore();

      // Rim Border / Brilliant Golden Border with Brief Light Pulse (Spotlight / Foco)
      const hasSpotlight = (tok.hasSpotlight || tok.spotlight?.enabled) && !tok.hidden && !isDead;
      if (hasSpotlight) {
        ctx.save();
        const goldPrimary = tok.spotlight?.color || '#fbbf24';
        const goldBright = '#fef08a';

        // Periodic brief pulse of light: 2.2s period, 0.75s active pulse wave
        const pulsePeriod = 2.2;
        const pulseDuration = 0.75;
        const phase = (time || 0) % pulsePeriod;
        const isPulsing = phase < pulseDuration;

        if (isPulsing) {
          const t = phase / pulseDuration; // 0.0 -> 1.0
          // Pulse expansion: compact (~10-14px outward) so it doesn't take much canvas space
          const maxExpand = Math.min(14, Math.max(8, radius * 0.28));
          const currentExpand = radius + t * maxExpand;
          const pulseAlpha = Math.sin(t * Math.PI) * 0.85;

          // 1. Expanding brief wave of golden light
          ctx.save();
          ctx.strokeStyle = `rgba(251, 191, 36, ${pulseAlpha})`;
          ctx.lineWidth = Math.max(1.5, 3 * (1 - t * 0.6));
          ctx.shadowColor = goldPrimary;
          ctx.shadowBlur = 12 * (1 - t * 0.4);
          ctx.beginPath();
          ctx.arc(0, 0, currentExpand, 0, Math.PI * 2);
          ctx.stroke();

          // 2. Second softer harmonic micro-wave
          if (t < 0.6) {
            const t2 = t / 0.6;
            const currentExpand2 = radius + t2 * (maxExpand * 0.55);
            const alpha2 = (1 - t2) * 0.55;
            ctx.strokeStyle = `rgba(254, 240, 138, ${alpha2})`;
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(0, 0, currentExpand2, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Luminous Golden Rim
        const flashIntensity = isPulsing && phase < 0.35 ? (1 - phase / 0.35) * 8 : 0;
        ctx.strokeStyle = goldPrimary;
        ctx.lineWidth = isSelected ? 4.5 : 3.5;
        ctx.shadowColor = goldPrimary;
        ctx.shadowBlur = 10 + flashIntensity;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner metallic highlight ring
        ctx.strokeStyle = goldBright;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = goldBright;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      } else {
        ctx.save();
        // The colour chosen in the sheet wins; the path and kind only give the default (v2.29.2:
        // a Sleeping character used to be orange whatever colour was chosen).
        let rimColor = tok.color || (tok.path === 'Sleeping' ? '#ffaa00' : '#00f3ff');
        if (isDead) rimColor = '#ef4444';
        else if (!tok.isPlayer) rimColor = tok.color || (tok.actorType === 'drone' ? '#72dfce' : '#ef4444');
        if (tok.hidden) rimColor = '#a855f7';

        // With a frame, the frame is the rim; a hidden or fallen token still shows its colour.
        if (!frameFit || tok.hidden || isDead) {
          ctx.strokeStyle = rimColor;
          ctx.lineWidth = isSelected ? 4 : (isDead ? 3 : 2.5);
          ctx.beginPath();
          ctx.arc(0, 0, frameFit ? frameFit.half * frame.outer : radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (frameFit) this.drawTokenFrame(ctx, frame, frameFit);

      // The class insignia, unless the token's layout hides it (v2.59.0).
      if (tokenLayout(tok).insignia) this.drawClassBanner(ctx, layers.flag, radius);

      // Dead / Defeated Badge above token
      if (isDead) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-24, -radius - 22, 48, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold 9px ${canvasFont('hud')}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠️ DEAD', 0, -radius - 15);
        ctx.restore();
      }

      // Hidden Badge
      if (tok.hidden) {
        ctx.save();
        ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-24, -radius - 22, 48, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold 9px ${canvasFont('hud')}`;
        ctx.textAlign = 'center';
        ctx.fillText('HIDDEN', 0, -radius - 12);
        ctx.restore();
      }

      // Darkness / Hidden in Fog indicator for Keeper
      if (!isVisibleToPlayers && keeperSees) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-48, -radius - (tok.hidden ? 38 : 22), 96, 14, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `bold 8px ${canvasFont('hud')}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🕶️ OCULTO EN NIEBLA', 0, -radius - (tok.hidden ? 31 : 15));
        ctx.restore();
      }

      // Water Depth Badge above token
      if (waterZone) {
        ctx.save();
        const depth = waterZone.depth ?? 2;
        ctx.fillStyle = 'rgba(14, 165, 233, 0.9)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-30, -radius - (tok.hidden ? 36 : 22), 60, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold 9px ${canvasFont('hud')}`;
        ctx.textAlign = 'center';
        ctx.fillText(`🌊 DEPTH ${depth}`, 0, -radius - (tok.hidden ? 26 : 12));
        ctx.restore();
      }

      // Vitals & Nameplate
      this.renderTokenVitals(ctx, tok, radius);
      drawTokenConditions(ctx, tok, radius, this.zoom);
      drawEffectClocks(ctx, tok, radius, this.zoom);
      if (this.cursorWorld) {
        const hoveredCond = getHoveredCondition(tok, this.cursorWorld, radius, this.zoom);
        if (hoveredCond) {
          const sPos = this.worldToScreen(this.cursorWorld.x, this.cursorWorld.y);
          this.activeHoveredCondition = { condition: hoveredCond, screenX: sPos.x, screenY: sPos.y };
        }
      }
      const bossStatus = tok.boss ? { index: tok.boss.index, total: tok.boss.states.length } : tok.bossStatus;
      if (bossStatus) {
        ctx.save(); ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
        const phaseText = `FASE ${bossStatus.index + 1}/${bossStatus.total}${tok.hp.current === 0 && bossPending ? ' · TRANSICIÓN' : ''}`;
        const width = ctx.measureText(phaseText).width + 12;
        ctx.fillStyle = '#201525'; ctx.fillRect(-width / 2, -radius - 36, width, 17);
        ctx.fillStyle = '#efb9d8'; ctx.fillText(phaseText, 0, -radius - 24); ctx.restore();
      }


      // Directional Vision & Smaller Directional Arrow Handle on Selected Token. A player sees it
      // only on the party's tokens and their own: enemies' and NPCs' cones are the Keeper's (v2.29.2).
      if (isSelected && (state.userRole !== 'player' || sharesSight(tok))) {
        ctx.save();
        const fAngle = tok.facingAngle ?? 0;
        const vAngle = tok.visionAngle ?? 90;
        const arrowDist = radius + 20;

        // FOV Guide Arc if directional (< 360)
        if (vAngle < 360) {
          const halfFov = (vAngle * Math.PI) / 360;
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, radius + 40, fAngle - halfFov, fAngle + halfFov);
          ctx.stroke();

          // Radial guide lines
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(fAngle - halfFov) * (radius + 40), Math.sin(fAngle - halfFov) * (radius + 40));
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(fAngle + halfFov) * (radius + 40), Math.sin(fAngle + halfFov) * (radius + 40));
          ctx.stroke();
          ctx.restore();
        }

        // Pointer line from token boundary to arrow handle
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(Math.cos(fAngle) * radius, Math.sin(fAngle) * radius);
        ctx.lineTo(Math.cos(fAngle) * (arrowDist - 8), Math.sin(fAngle) * (arrowDist - 8));
        ctx.stroke();
        ctx.restore();

        // Smaller Directional Arrow Handle
        const arrowX = Math.cos(fAngle) * arrowDist;
        const arrowY = Math.sin(fAngle) * arrowDist;

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(fAngle);

        // Sleek compact directional arrow
        ctx.beginPath();
        ctx.moveTo(9, 0);     // Tip pointing forward
        ctx.lineTo(-7, -6);   // Top wing
        ctx.lineTo(-3, 0);    // Inner notch
        ctx.lineTo(-7, 6);    // Bottom wing
        ctx.closePath();

        ctx.fillStyle = '#00f3ff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
      }

      ctx.restore();
    }
  },

  // --- Render Ghost / Last Known Position of Enemy in Fog of War ---
  // The frame: its body over the portrait's edge, then its light with «screen» (black adds nothing).
  drawTokenFrame(ctx, frame, { half }) {
    const body = this.getTokenImage(frameBody(frame)), light = this.getTokenImage(frameLight(frame));
    ctx.save();
    if (body?.complete && body.naturalWidth) ctx.drawImage(body, -half, -half, half * 2, half * 2);
    if (light?.complete && light.naturalWidth) { ctx.globalCompositeOperation = 'screen'; ctx.drawImage(light, -half, -half, half * 2, half * 2); }
    ctx.restore();
  },

  drawClassBanner(ctx, url, radius) {
    const flag = url && this.getTokenImage(url);
    if (!flag?.complete || !flag.naturalWidth || !flag.naturalHeight) return;
    // Twice its first size (v2.27.17: at 35 % of the token it could hardly be seen). It hangs
    // over the bottom-right edge of the ring so it does not cover the portrait.
    const height = 2 * radius * 0.7;
    const width = height * flag.naturalWidth / flag.naturalHeight;
    ctx.drawImage(flag, radius - width * 0.6, radius - height, width, height);
  },

  renderGhostToken(ctx, ghost, gridSize, time, caption = 'ÚLTIMA POS.') {
    const radius = ((ghost.size || 1) * gridSize) / 2;
    ctx.save();
    ctx.translate(ghost.x, ghost.y);

    // Ghost transparency & radar border
    ctx.globalAlpha = 0.45;

    // Outer scanning dashed ring
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Token base
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Portrait / initial
    const layers = mapPortraitLayers({ ...ghost, avatarUrl: ghost.avatar });
    const img = this.getTokenImage(layers.portrait);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `bold ${Math.round(radius * 0.7)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((ghost.name || '?')[0].toUpperCase(), 0, 0);
    }

    this.drawClassBanner(ctx, layers.flag, radius);

    // Badge
    ctx.globalAlpha = 0.85;
    ctx.font = `bold 9px ${canvasFont('hud')}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f59e0b';
    if (caption) ctx.fillText(caption, 0, radius + 12);

    ctx.restore();
  },

  // Helper to determine if a token is a horror, adversary, or has its identity masked from players
  isHorrorToken(tok) {
    if (!tok) return false;
    if (tok.hideName) return true;
    if (tok.isPlayer) return false;
    if (tok.actorType === 'adversary') return true;
    const str = `${tok.name || ''} ${tok.roleTag || ''} ${tok.species || ''}`.toLowerCase();
    return /horror|stalker|abomination|threat|alien|beast|monster|parasite|spawn|unknown/i.test(str);
  },

  // Helper to extract numerical current and max for any character sheet stat
  resolveTokenStat(tok, key, mode = 'current') {
    if (!tok || !key) return 0;
    if (key === 'hp') return mode === 'current' ? (tok.hp?.current ?? 0) : (tok.hp?.max ?? 10);
    if (key === 'stress') return mode === 'current' ? (tok.stress?.current ?? 0) : (tok.stress?.max ?? 6);
    if (key === 'armor') return mode === 'current' ? (tok.armor?.current ?? 0) : (tok.armor?.max ?? 2);
    if (key === 'hope') return mode === 'current' ? (tok.hope ?? 0) : 6;
    if (key === 'effort') return mode === 'current' ? (tok.effort ?? 0) : 6;
    if (key === 'resolve') return mode === 'current' ? (tok.resolve?.current ?? 0) : (tok.resolve?.max ?? 4);
    if (key === 'clock') return mode === 'current' ? (tok.displayConfig?.clockProgress ?? 0) : (tok.displayConfig?.clockSegments ?? 4);
    if (key.startsWith('trait_')) {
      const traitName = key.replace('trait_', '');
      return tok.traits?.[traitName] ?? 0;
    }
    return 0;
  },

  // Who sees a token's HP and Stress on the map (v2.58.0, user decision): the Keeper, everyone's;
  // a player, only their own character (and the drone they operate), never allies or enemies.
  // store.canEditToken is exactly that: the Keeper's table edits every token; a player, the
  // character it plays (claimed) and what it controls.
  canSeeVitals(tok) { return store.canEditToken(tok.id); },

  // What the token shows and where (v2.59.0, the user's design: tokenLayout.js): its name (yes/no)
  // and, for whoever may see them, each stat as a bar below or above it, a ring (inner, outer 1,
  // outer 2) or, for Armor and Resolve, small tokens beside it. A clock put on the token by hand
  // (not the old «HACK» sample) is still drawn.
  renderTokenVitals(ctx, tok, radius) {
    if (isEncounterMarker(tok)) return;
    ctx.save();
    const layout = tokenLayout(tok), scale = Math.max(1, Math.min(1.8, 0.9 / this.zoom));
    // Around the frame, if it has one (v2.60.0): outside its edge and inside its hole.
    const frame = frameById(tok.frame), fit = frame && frameGeometry(frame, radius);
    const outR = fit ? fit.half * frame.outer : radius, inR = fit ? Math.min(radius, fit.hole + 1) : radius;
    const nameWidth = Math.max(radius * 2, 70);
    let below = outR + 4;
    // A player may hide every name on their screen with V; the Keeper always sees them (v2.59.0).
    const namesOff = namesHidden() && store.getState().userRole !== 'keeper';
    if (layout.name && !namesOff) {
      ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
      ctx.strokeStyle = tok.color ? tok.color : 'rgba(0, 243, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-nameWidth / 2, outR + 4, nameWidth, 16, 3);
      ctx.fill();
      ctx.stroke();
      const isKeeper = store.getState().userRole === 'keeper';
      const isMasked = !isKeeper && this.isHorrorToken(tok);
      const rawName = isMasked ? '?????' : tok.name;
      const displayName = (isKeeper && this.isHorrorToken(tok))
        ? (tok.name.length > 10 ? tok.name.substring(0, 9) + '.. [?]' : `${tok.name} [?]`)
        : (rawName.length > 14 ? rawName.substring(0, 12) + '..' : rawName);
      ctx.fillStyle = isMasked ? '#f43f5e' : (tok.color || '#e2e8f0');
      ctx.font = `bold 11px ${canvasFont('hud')}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayName, 0, outR + 12);
      below = outR + 22;
    }
    if (!this.canSeeVitals(tok)) { ctx.restore(); return; }

    const placed = place => LAYOUT_STATS.map(([key]) => key).filter(key => layout[key] === place).map(key => [key, statFor(tok, key)]).filter(([, stat]) => stat);
    // Bars below (under the name) and above the token.
    drawStatBars(ctx, { y: below + 2, width: nameWidth, scale, rows: placed('bottom') });
    drawStatBars(ctx, { y: -outR - 6, width: nameWidth, scale, rows: placed('top'), up: true });
    // Rings: the inner one inside the rim, the outer ones around it.
    for (const ring of ['inner1', 'outer1', 'outer2']) for (const [key, stat] of placed(ring)) drawStatRing(ctx, { r: ringRadius(ring, ring === 'inner1' ? inR : outR, scale), width: 3 * scale, key, stat });
    // Small tokens beside it; past the outer rings when there are any.
    const ringsOut = placed('outer2').length ? 9.5 * scale : placed('outer1').length ? 5.5 * scale : 0;
    for (const side of ['right', 'left']) for (const [key, stat] of placed(side)) drawStatPips(ctx, { side, radius: outR, scale, key, stat, offset: ringsOut });

    // A clock the Keeper put on the token by hand (not the sample one).
    const cfg = tok.displayConfig || {};
    const sample = o => o?.type === 'circular' && o.statKey === 'clock' && /^hack$/i.test(o.label || '') && (o.id === 'ov_clock' || o.current === 2);
    const overlays = Array.isArray(tok.displayOverlays) ? tok.displayOverlays.filter(o => !sample(o)) : [];
    const clocks = overlays.length ? overlays.filter(o => o.type === 'circular') : cfg.showClock && !/^hack$/i.test(cfg.clockLabel || '') ? [{ label: cfg.clockLabel, current: cfg.clockProgress, max: cfg.clockSegments, color: '#00f3ff' }] : [];
    clocks.slice(0, 2).forEach((item, idx) => {
      const cur = item.current ?? (cfg.clockProgress ?? 0), max = item.max ?? (item.segments || cfg.clockSegments || 4);
      const color = item.color || '#00f3ff', r = 11;
      ctx.save();
      ctx.translate(idx === 0 ? radius * 0.75 : -radius * 0.75, -radius * 0.75);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10, 15, 26, 0.95)'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
      const seg = (Math.PI * 2) / Math.max(1, max);
      for (let i = 0; i < max; i++) {
        const a = -Math.PI / 2 + i * seg;
        if (i < cur) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r - 1.5, a, a + seg); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
      if (item.label) { ctx.fillStyle = color; ctx.font = `bold 7px ${canvasFont('hud')}`; ctx.textAlign = 'center'; ctx.fillText(item.label, 0, r + 7); }
      ctx.restore();
    });
    ctx.restore();
  },

  renderHoveredConditionTooltip(ctx, info) {
    if (!info || !info.condition) return;
    const c = info.condition;
    const sx = info.screenX;
    const sy = info.screenY;
    ctx.save();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const title = `${c.isState ? '💀' : '⚡'} ${c.label} (${c.name})`;
    const rule = c.rule || '';

    // Measure and wrap rule text
    ctx.font = `bold 12px ${canvasFont('hud')}`;
    const titleW = ctx.measureText(title).width;
    ctx.font = '11px sans-serif';

    const maxWidth = 260;
    const words = rule.split(' ');
    const lines = [];
    let currentLine = '';
    for (const w of words) {
      const testLine = currentLine ? currentLine + ' ' + w : w;
      if (ctx.measureText(testLine).width > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = w;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const boxW = Math.max(titleW, maxWidth) + 24;
    const lineH = 15;
    const boxH = 26 + lines.length * lineH + 10;
    let boxX = sx + 14;
    let boxY = sy - boxH / 2;
    if (boxX + boxW > this.displayWidth - 10) boxX = sx - boxW - 14;
    if (boxY < 10) boxY = 10;
    if (boxY + boxH > this.displayHeight - 10) boxY = this.displayHeight - boxH - 10;

    // Tactical Glass panel
    ctx.fillStyle = 'rgba(10, 17, 30, 0.95)';
    ctx.strokeStyle = c.isState ? '#fbbf24' : '#00f3ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = c.isState ? 'rgba(251, 191, 36, 0.4)' : 'rgba(0, 243, 255, 0.4)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    // Title
    ctx.fillStyle = c.isState ? '#fde68a' : '#38bdf8';
    ctx.font = `bold 12px ${canvasFont('hud')}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, boxX + 12, boxY + 8);

    // Rule lines
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    lines.forEach((line, idx) => {
      ctx.fillText(line, boxX + 12, boxY + 26 + idx * lineH);
    });

    ctx.restore();
  },
};
