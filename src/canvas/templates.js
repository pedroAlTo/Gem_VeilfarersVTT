// Areas and measuring (split out of canvasEngine.js in v2.65.0): the areas of cards and
// powers, the area templates the Keeper and players place, and the ruler.
import { store } from '../state.js';
import { canvasFont } from '../fontSets.js';
import { rangeBandFor } from '../attackFlow.js';

export const templateMethods = {
  // --- Dynamic Area Templates with Rotate, Scale & Delete Handles ---
  // The area of a Power around its caster (v2.32.0), drawn like the Area tool's circle while its
  // resolution is open: everyone sees it, because the resolution is in the shared log.
  renderCardAreas(ctx, map) {
    // A card being aimed (v2.36.0): its reach around the caster and a ring on each valid target.
    const aim = typeof window !== 'undefined' ? window.veilCardAim : null;
    if (aim) {
      const caster = store.state.tokens.find(t => t.id === aim.casterId), grid = map.gridSize || 64, pulse = 0.55 + 0.45 * Math.sin(Date.now() / 260);
      if (caster && aim.radius && (aim.area || aim.reach !== 'Far')) {
        if (aim.area) this.renderTemplate(ctx, { id: 'aim', type: 'circle', x: caster.x, y: caster.y, radius: aim.radius, angle: 0 }, true);
        else { ctx.save(); ctx.setLineDash([12, 8]); ctx.strokeStyle = 'rgba(167,139,250,.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(caster.x, caster.y, aim.radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      }
      for (const id of aim.validIds || []) {
        const t = store.state.tokens.find(x => x.id === id && x.mapId === map.id);
        if (!t) continue;
        const r = ((t.size || 1) * grid) / 2 + 6;
        ctx.save(); ctx.strokeStyle = aim.area ? `rgba(248,113,113,${pulse})` : `rgba(52,211,153,${pulse})`; ctx.lineWidth = 4; ctx.shadowColor = aim.area ? '#f87171' : '#34d399'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        // The marked target (v2.42.0): a second, steady ring in the card's colour.
        if (id === aim.markedId) {
          ctx.save(); ctx.strokeStyle = aim.color || '#00f3ff'; ctx.lineWidth = 5; ctx.shadowColor = aim.color || '#00f3ff'; ctx.shadowBlur = 22; ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(t.x, t.y, r + 9, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }
    }
    const logs = store.state.logs || [];
    for (let i = 0; i < Math.min(logs.length, 40); i++) {
      const record = logs[i]?.resolution, area = record?.area;
      if (!area || record.phase === 'done' || record.mapId !== map.id || (logs[i].visibility === 'keeper' && store.sessionRole === 'player')) continue;
      this.renderTemplate(ctx, { id: 'area_' + record.id, type: 'circle', x: area.x, y: area.y, radius: area.radius, angle: 0 }, false);
      ctx.save();
      ctx.font = '600 13px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#e0fbff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText(`${record.name} · ${area.reach}`, area.x, area.y - area.radius - 8);
      ctx.restore();
    }
  },

  renderTemplate(ctx, tmpl, isSelected = true) {
    const map = store.getActiveMap();
    const gridSize = map.gridSize || 64;
    const scaleMeters = map.gridScaleMeters || 2.0;
    const radiusMeters = ((tmpl.radius / gridSize) * scaleMeters).toFixed(1);
    const radiusSq = (tmpl.radius / gridSize).toFixed(1);
    let deg = Math.round(((tmpl.angle || 0) * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;

    const mainColor = tmpl.type === 'circle' ? '#00f3ff'
                    : tmpl.type === 'cone' ? '#ffaa00'
                    : tmpl.type === 'line' ? '#c084fc'
                    : '#10b981';

    ctx.save();
    ctx.translate(tmpl.x, tmpl.y);
    ctx.rotate(tmpl.angle || 0);

    // 1. Draw Template Shape with Tactical Holographic Styling
    if (tmpl.type === 'circle') {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, tmpl.radius);
      grad.addColorStop(0, 'rgba(0, 243, 255, 0.28)');
      grad.addColorStop(0.7, 'rgba(0, 243, 255, 0.12)');
      grad.addColorStop(1, 'rgba(0, 243, 255, 0.04)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = isSelected ? 14 : 6;

      ctx.beginPath();
      ctx.arc(0, 0, tmpl.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Range distance concentric rings
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, tmpl.radius * 0.33, 0, Math.PI * 2);
      ctx.arc(0, 0, tmpl.radius * 0.66, 0, Math.PI * 2);
      ctx.stroke();

      // Aim axis line to 2nd controller
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tmpl.radius, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tmpl.type === 'cone') {
      const coneHalfAngle = (tmpl.coneAngle || (Math.PI / 3)) / 2;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, tmpl.radius);
      grad.addColorStop(0, 'rgba(255, 170, 0, 0.35)');
      grad.addColorStop(0.7, 'rgba(255, 100, 0, 0.15)');
      grad.addColorStop(1, 'rgba(255, 40, 0, 0.04)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = isSelected ? 14 : 6;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, tmpl.radius, -coneHalfAngle, coneHalfAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Range arcs
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, tmpl.radius * 0.5, -coneHalfAngle, coneHalfAngle);
      ctx.stroke();

      // Aim axis
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tmpl.radius, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tmpl.type === 'line') {
      const beamWidth = tmpl.width || 48;
      const grad = ctx.createLinearGradient(0, 0, tmpl.radius, 0);
      grad.addColorStop(0, 'rgba(192, 132, 252, 0.4)');
      grad.addColorStop(1, 'rgba(192, 132, 252, 0.1)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = isSelected ? 14 : 6;

      ctx.beginPath();
      ctx.rect(0, -beamWidth / 2, tmpl.radius, beamWidth);
      ctx.fill();
      ctx.stroke();

      // Forward chevrons along beam
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      for (let x = 40; x < tmpl.radius - 20; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x - 6, -8);
        ctx.lineTo(x, 0);
        ctx.lineTo(x - 6, 8);
        ctx.stroke();
      }
    } else if (tmpl.type === 'box') {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, tmpl.radius * 1.4);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = isSelected ? 14 : 6;

      ctx.beginPath();
      ctx.rect(-tmpl.radius, -tmpl.radius, tmpl.radius * 2, tmpl.radius * 2);
      ctx.fill();
      ctx.stroke();

      // Aim axis to controller
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tmpl.radius, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Interactive Handles (Rendered if selected)
    if (isSelected) {
      // Center Move Handle (Diamond Four-Way Move Crosshair) at (0, 0)
      ctx.fillStyle = '#00f3ff';
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // The 2nd Controller Handle (Rotate & Scale Gimbal) at (tmpl.radius, 0)
      ctx.strokeStyle = mainColor;
      ctx.fillStyle = 'rgba(6, 11, 25, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 14;

      ctx.beginPath();
      ctx.arc(tmpl.radius, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Gimbal tick marks
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tmpl.radius - 17, 0); ctx.lineTo(tmpl.radius - 11, 0);
      ctx.moveTo(tmpl.radius + 11, 0); ctx.lineTo(tmpl.radius + 17, 0);
      ctx.moveTo(tmpl.radius, -17); ctx.lineTo(tmpl.radius, -11);
      ctx.moveTo(tmpl.radius, 11); ctx.lineTo(tmpl.radius, 17);
      ctx.stroke();

      // White center pivot node
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tmpl.radius, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Handle 3A: Cone Aperture Angle Handle (at outer arc rim)
      if (tmpl.type === 'cone') {
        const coneHalfAngle = (tmpl.coneAngle || (Math.PI / 3)) / 2;
        const ax = Math.cos(coneHalfAngle) * tmpl.radius;
        const ay = Math.sin(coneHalfAngle) * tmpl.radius;
        ctx.fillStyle = '#ffaa00';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(ax, ay, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📐', ax, ay);
      }

      // Handle 3B: Line Beam Width Handle (at lateral beam edge)
      if (tmpl.type === 'line') {
        const lx = tmpl.radius * 0.5;
        const ly = (tmpl.width || 48) / 2;
        ctx.fillStyle = '#c084fc';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(lx, ly, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↕', lx, ly);
      }
    }

    ctx.restore(); // Restores from rotated coordinate space

    // 3. Upright HUD Badge & Delete Button [✕]
    if (isSelected) {
      ctx.save();
      const coneDeg = Math.round(((tmpl.coneAngle || (Math.PI / 3)) * 180) / Math.PI);
      const widthMeters = (((tmpl.width || 48) / gridSize) * scaleMeters).toFixed(1);
      const extraInfo = tmpl.type === 'cone' ? ` // 📐 ${coneDeg}°`
                      : tmpl.type === 'line' ? ` // ↕ ${widthMeters}m`
                      : '';
      const badgeText = `AREA: ${radiusMeters}m (${radiusSq} sq) // ${deg}°${extraInfo}`;
      ctx.font = `bold 11px ${canvasFont('display')}`;
      const textW = ctx.measureText(badgeText).width;
      const totalW = textW + 20;
      const badgeX = tmpl.x;
      const badgeY = tmpl.y - tmpl.radius - 28;

      // Badge Background Panel
      ctx.fillStyle = 'rgba(6, 11, 25, 0.9)';
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(badgeX - totalW / 2 - 12, badgeY - 11, totalW, 22, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX - 12, badgeY);

      // Delete Button [✕]
      const delX = badgeX + totalW / 2 + 8;
      const delY = badgeY;

      ctx.fillStyle = 'rgba(255, 42, 95, 0.3)';
      ctx.strokeStyle = '#ff2a5f';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ff2a5f';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(delX, delY, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', delX, delY);

      ctx.restore();
    }
  },

  // --- Measurement Ruler with Canonical System Range Bands ---
  renderRuler(ctx, start, end, gridSize, movement = false) {
    const map = store.getActiveMap() || {};
    const distPx = Math.hypot(end.x - start.x, end.y - start.y);
    const distGrid = (distPx / gridSize).toFixed(1);

    const isStarship = map.scaleType === 'starship' || map.isStarship ||
      (map.name || '').toLowerCase().includes('space') ||
      (map.name || '').toLowerCase().includes('starship') ||
      (map.name || '').toLowerCase().includes('naval');

    let distVal = 0;
    let distUnit = 'm';
    let rangeBand = 'Contact';

    const scaleKilometers = map.gridScaleKm || (map.gridScaleMeters ? map.gridScaleMeters * 2.5 : 5.0);
    if (isStarship) {
      // Starship Combat Scale (Naval Combat Chapter 17)
      const scaleKm = scaleKilometers;
      distVal = ((distPx / gridSize) * scaleKm).toFixed(1);
      distUnit = 'km';

      const numKm = parseFloat(distVal);
      if (numKm <= 2.5) rangeBand = 'Adjacent';
      else if (numKm <= 10) rangeBand = 'Engagement';
      else if (numKm <= 35) rangeBand = 'Standard';
      else if (numKm <= 80) rangeBand = 'Long';
      else rangeBand = 'Extreme';
    } else {
      // Personal Tactical Combat Scale (Veilfarers 12.06 Canon)
      // Melee (adjacent or up to 1 m), Very Close (up to 5 m), Close (up to 10 m), Far (up to 25 m), Extreme
      const scaleMeters = map.gridScaleMeters || 2.0;
      distVal = ((distPx / gridSize) * scaleMeters).toFixed(1);
      distUnit = 'm';

      rangeBand = rangeBandFor(distPx / gridSize, scaleMeters);
    }

    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 8;
    ctx.setLineDash([6, 6]);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
    ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
    ctx.fill();

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const badgeText = movement ? `${rangeBand.toUpperCase()} · ${(distUnit === 'km' ? distPx / gridSize * scaleKilometers * 1000 : Number(distVal)).toLocaleString(undefined, { maximumFractionDigits: 1 })} m` : `${distVal}${distUnit} (${distGrid} sq) // [${rangeBand.toUpperCase()}]`;

    ctx.font = `bold 12px ${canvasFont('display')}`;
    const textWidth = ctx.measureText(badgeText).width;

    ctx.fillStyle = 'rgba(6, 11, 25, 0.9)';
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(midX - textWidth / 2 - 8, midY - 14, textWidth + 16, 26, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00f3ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, midX, midY - 1);

    ctx.restore();
  },
};
