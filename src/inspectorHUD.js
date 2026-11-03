import { sanitizeHTML } from './ui.js';
// src/inspectorHUD.js
// Tactical Element Inspector for Editable Walls, Dynamic Lights, and Water Zones

import { store } from './state.js';
import { network } from './networkManager.js';
import { audio } from './audioEngine.js';
import { WATER_DEPTH_NAMES } from './canvasEngine.js';
import { openColorPickerPopover, normalizeHex } from './colorPicker.js';
import { undoManager } from './undoManager.js';

export class ElementInspectorHUD {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();

    store.subscribe((state, keys) => {
      // Avoid destroying DOM only while user is actively typing in a text field
      const activeEl = document.activeElement;
      if (this.container && activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.type !== 'range' && activeEl.type !== 'checkbox') {
        return;
      }

      if (
        keys.includes('selectedLightId') ||
        keys.includes('selectedWallId') ||
        keys.includes('selectedWaterId') ||
        keys.includes('selectedEffectId') ||
        keys.includes('selectedTemplateId') ||
        keys.includes('userRole') ||
        keys.includes('maps')
      ) {
        this.render();
      }
    });

    window.addEventListener('veil:template_selected', () => this.render());
    window.addEventListener('veil:template_deselected', () => this.render());
  }

  render() {
    const state = store.getState();
    const map = store.getActiveMap();
    const isKeeper = state.userRole === 'keeper';

    // 1. Template Inspector (Accessible when an area template is selected)
    if (state.selectedTemplateId) {
      const activeTmpl = (window.veilCanvas?.templates || []).find(t => t.id === state.selectedTemplateId);
      if (activeTmpl) {
        this.renderTemplateInspector(activeTmpl);
        this.container.classList.remove('hidden');
        return;
      }
    }

    // 2. Persistent Effect Anomaly Inspector
    if (state.selectedEffectId) {
      const effect = (map.effects || []).find(f => f.id === state.selectedEffectId);
      if (effect) {
        this.renderEffectInspector(effect);
        this.container.classList.remove('hidden');
        return;
      }
    }

    // Only visible if Keeper and an element is selected
    if (!isKeeper) {
      this.container.innerHTML = sanitizeHTML('');
      this.container.classList.add('hidden');
      return;
    }

    if (state.selectedLightId) {
      const light = (map.lights || []).find(l => l.id === state.selectedLightId);
      if (light) {
        this.renderLightInspector(light);
        this.container.classList.remove('hidden');
        return;
      }
    }

    if (state.selectedWallId) {
      const wall = (map.walls || []).find(w => w.id === state.selectedWallId);
      if (wall) {
        this.renderWallInspector(wall);
        this.container.classList.remove('hidden');
        return;
      }
    }

    if (state.selectedWaterId) {
      const zone = (map.waterZones || []).find(w => w.id === state.selectedWaterId);
      if (zone) {
        this.renderWaterInspector(zone);
        this.container.classList.remove('hidden');
        return;
      }
    }

    this.container.innerHTML = sanitizeHTML('');
    this.container.classList.add('hidden');
  }

  renderLightInspector(light) {
    this.container.innerHTML = sanitizeHTML(`
      <div class="element-inspector glass-panel">
        <div class="inspector-header">
          <div class="insp-title-group">
            <span class="insp-icon">💡</span>
            <span class="insp-title">LIGHT SOURCE // [${(light.label || 'Tactical Light').toUpperCase()}]</span>
          </div>
          <button class="insp-close-btn" id="insp_close">&times;</button>
        </div>

        <div class="inspector-body">
          <div class="insp-row">
            <div class="insp-col">
              <label>Name</label>
              <input type="text" id="insp_light_name" class="hud-input hud-input-xs" value="${light.label || 'Light'}" />
            </div>
            <div class="insp-col" style="max-width: 60px;">
              <label>Color</label>
              <button type="button" id="insp_light_color_btn" class="overlay-color-btn" style="background: ${light.color || '#00f3ff'}; width: 100%; height: 26px;" title="Elegir Color de Luz"></button>
            </div>
            <div class="insp-col">
              <label>Radius (${light.radius || 260}px)</label>
              <input type="range" id="insp_light_radius" min="60" max="800" step="10" value="${light.radius || 260}" class="hud-slider" />
            </div>
          </div>

          <div class="insp-row" style="margin-top: 8px;">
            <div class="insp-col">
              <label>Intensity (${((light.intensity ?? 0.9) * 100).toFixed(0)}%)</label>
              <input type="range" id="insp_light_intensity" min="0.1" max="1.5" step="0.05" value="${light.intensity ?? 0.9}" class="hud-slider" />
            </div>
            <div class="insp-col">
              <label>Dynamic FX Effect</label>
              <vf-select id="insp_light_effect" class="hud-select hud-select-xs">
                <option value="steady" ${light.effect === 'steady' ? 'selected' : ''}>Steady (Continuous)</option>
                <option value="pulse" ${light.effect === 'pulse' ? 'selected' : ''}>Pulse (Breathing Glow)</option>
                <option value="flicker" ${light.effect === 'flicker' ? 'selected' : ''}>Flicker (Malfunctioning Neon)</option>
                <option value="siren" ${light.effect === 'siren' ? 'selected' : ''}>Siren / Dual Alert (2 Colores)</option>
                <option value="quantum" ${light.effect === 'quantum' ? 'selected' : ''}>Quantum Flux (Pearl Resin)</option>
                <option value="spark" ${light.effect === 'spark' ? 'selected' : ''}>Electric Spark (Arc Discharge)</option>
              </vf-select>
            </div>
            <div class="insp-col insp-actions" style="max-width: 90px; justify-content: flex-end;">
              <button class="hud-btn hud-btn-xs hud-btn-danger" id="insp_delete_btn">DELETE</button>
            </div>
          </div>

          ${light.effect === 'siren' ? `
            <div class="insp-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.15);">
              <div class="insp-col" style="max-width: 90px;">
                <label>Color 2 (Siren)</label>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <button class="insp-color-swatch-btn" id="insp_light_color2_btn" style="background: ${light.color2 || '#3b82f6'}; width: 26px; height: 26px; border-radius: 4px; border: 1px solid #fff; cursor: pointer;" title="Seleccionar Color Secundario de Sirena"></button>
                </div>
              </div>
              <div class="insp-col" style="flex: 2;">
                <label>Siren Intensity (${Math.round((light.effectIntensity ?? 1.0) * 100)}%)</label>
                <input type="range" id="insp_light_effect_intensity" min="0.2" max="2.5" step="0.1" value="${light.effectIntensity ?? 1.0}" class="hud-slider" />
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `);

    this.container.querySelector('#insp_close').onclick = () => store.update({ selectedLightId: null });

    this.container.querySelector('#insp_light_name').onchange = (e) => {
      store.updateLight(light.id, { label: e.target.value.trim() || 'Light' });
    };

    const colBtn = this.container.querySelector('#insp_light_color_btn');
    if (colBtn) {
      colBtn.onclick = (e) => {
        e.stopPropagation();
        openColorPickerPopover(colBtn, light.color || '#00f3ff', (c) => {
          colBtn.style.background = c;
          store.updateLight(light.id, { color: c });
        });
      };
    }

    const col2Btn = this.container.querySelector('#insp_light_color2_btn');
    if (col2Btn) {
      col2Btn.onclick = (e) => {
        e.stopPropagation();
        openColorPickerPopover(col2Btn, light.color2 || '#3b82f6', (c) => {
          col2Btn.style.background = c;
          store.updateLight(light.id, { color2: c });
        });
      };
    }

    const effIntSlider = this.container.querySelector('#insp_light_effect_intensity');
    if (effIntSlider) {
      effIntSlider.oninput = (e) => {
        store.updateLight(light.id, { effectIntensity: parseFloat(e.target.value) });
      };
    }

    this.container.querySelector('#insp_light_radius').oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      store.updateLight(light.id, { radius: val });
    };

    this.container.querySelector('#insp_light_intensity').oninput = (e) => {
      const val = parseFloat(e.target.value);
      store.updateLight(light.id, { intensity: val });
    };

    this.container.querySelector('#insp_light_effect').onchange = (e) => {
      store.updateLight(light.id, { effect: e.target.value });
    };

    this.container.querySelector('#insp_delete_btn').onclick = () => {
      store.deleteLight(light.id);
      audio.playLaserShot();
    };
  }

  renderWallInspector(wall) {
    const wallType = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
    const isDoor = wallType === 'door';
    const isWindow = wallType === 'window';
    const isWall = wallType === 'wall';
    const isOpen = !!wall.isOpen;
    const isLocked = !!wall.isLocked;
    const isSecret = !!wall.isSecret;
    const visionPercent = wall.visionPercent ?? 80;

    const map = store.getActiveMap();
    const connectedNeighbours = (map?.walls || []).filter(other =>
      other.id !== wall.id && (
        Math.hypot(wall.x1 - other.x1, wall.y1 - other.y1) <= 6 ||
        Math.hypot(wall.x1 - other.x2, wall.y1 - other.y2) <= 6 ||
        Math.hypot(wall.x2 - other.x1, wall.y2 - other.y1) <= 6 ||
        Math.hypot(wall.x2 - other.x2, wall.y2 - other.y2) <= 6
      )
    );
    const isCompound = connectedNeighbours.length > 0;

    const icon = isDoor ? (isSecret ? '🕵️' : '🚪') : (isWindow ? '🪟' : '🧱');
    const title = isDoor ? (isSecret ? 'PUERTA SECRETA // OCULTA' : 'PUERTA / ESCOTILLA // PORTAL') : (isWindow ? 'VENTANA / CRISTAL BLINDADO' : 'MURO NORMAL // BARRERA OPACA');

    this.container.innerHTML = sanitizeHTML(`
      <div class="element-inspector glass-panel">
        <div class="inspector-header">
          <div class="insp-title-group">
            <span class="insp-icon">${icon}</span>
            <span class="insp-title">${title}</span>
          </div>
          <button class="insp-close-btn" id="insp_close">&times;</button>
        </div>

        <div class="inspector-body">
          <!-- Wall Type Selector Bar -->
          <div class="insp-row" style="margin-bottom: 8px;">
            <div class="insp-type-pill-group" style="display: flex; gap: 4px; width: 100%;">
              <button class="hud-btn hud-btn-xs ${isWall ? 'hud-btn-primary' : 'hud-btn-secondary'}" id="btn_type_wall" style="flex: 1;">
                🧱 Muro Normal
              </button>
              <button class="hud-btn hud-btn-xs ${isDoor ? 'hud-btn-primary' : 'hud-btn-secondary'}" id="btn_type_door" style="flex: 1;">
                🚪 Puerta
              </button>
              <button class="hud-btn hud-btn-xs ${isWindow ? 'hud-btn-primary' : 'hud-btn-secondary'}" id="btn_type_window" style="flex: 1;">
                🪟 Ventana
              </button>
            </div>
          </div>

          ${isCompound ? `
            <div class="insp-row" style="margin-bottom: 8px; padding: 5px 8px; background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: var(--radius-xs); font-size: 11px; color: var(--cyan-pearl); display: flex; align-items: center; justify-content: space-between;">
              <span>🔗 TRAZADO COMPUESTO (${connectedNeighbours.length + 1} tramos)</span>
              <button class="hud-btn hud-btn-xs hud-btn-secondary" id="insp_separate_wall_btn" title="Separa los extremos de este muro del trazado compuesto">✂️ SEPARAR</button>
            </div>
          ` : ''}

          <!-- Dynamic Controls per Type -->
          ${isDoor ? `
            <div class="insp-row" style="align-items: center; gap: 6px; flex-wrap: wrap;">
              <div class="insp-col" style="flex: 1; min-width: 120px;">
                <button class="hud-btn hud-btn-xs ${isOpen ? 'hud-btn-primary' : 'hud-btn-amber'}" id="insp_door_toggle_state" style="width: 100%;">
                  ${isOpen ? '🟢 ABIERTA' : '🔴 CERRADA'}
                </button>
              </div>
              <div class="insp-col" style="flex: 1; min-width: 120px;">
                <button class="hud-btn hud-btn-xs ${isLocked ? 'hud-btn-danger' : 'hud-btn-cyan'}" id="insp_door_toggle_lock" style="width: 100%;">
                  ${isLocked ? '🔒 BLOQUEADA' : '🔓 DESBLOQUEADA'}
                </button>
              </div>
              <div class="insp-col" style="flex: 1.2; min-width: 140px;">
                <button class="hud-btn hud-btn-xs ${isSecret ? 'hud-btn-purple' : 'hud-btn-secondary'}" id="insp_door_toggle_secret" style="width: 100%;">
                  ${isSecret ? '🕵️ SECRETA (Oculta)' : '👁️ VISIBLE (Visible a Jugadores)'}
                </button>
              </div>
            </div>
            <div class="insp-row" style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">
              ${isSecret
                ? '🕵️ Puerta Secreta activada: Los jugadores la ven como un muro normal opaco y no pueden detectarla ni abrirla.'
                : (isLocked
                  ? '⚠️ Cerrojo echado. Los jugadores la ven pero no pueden abrirla desde el mapa.'
                  : '✓ Visible y desbloqueada. Cualquier jugador o Keeper puede abrir y cerrar esta puerta con 1 clic en el mapa.')}
            </div>
          ` : isWindow ? `
            <div class="insp-row" style="align-items: center; gap: 10px;">
              <div class="insp-col" style="flex: 2;">
                <label style="font-size: 11px; color: #38bdf8; font-weight: 700; display: flex; justify-content: space-between;">
                  <span>% DE VISIÓN / TRANSPARENCIA</span>
                  <span id="window_vis_val">${visionPercent}%</span>
                </label>
                <input type="range" id="insp_window_vis" min="10" max="100" step="5" value="${visionPercent}" class="hud-range" style="width: 100%;" />
              </div>
              <div class="insp-col" style="flex: 1; font-size: 10px; color: var(--text-dim);">
                Permite ver y pasar luz a través. Los tokens NO pueden traspasarla.
              </div>
            </div>
          ` : `
            <div class="insp-row" style="font-size: 11px; color: var(--text-dim);">
              Muro opaco macizo. Bloquea línea de visión, proyecta sombras dinámicas y bloquea movimiento de tokens.
            </div>
          `}

          <div class="insp-row insp-actions" style="margin-top: 10px; justify-content: flex-end;">
            <button class="hud-btn hud-btn-xs hud-btn-danger" id="insp_delete_btn">ELIMINAR MURO</button>
          </div>
        </div>
      </div>
    `);

    this.container.querySelector('#insp_close').onclick = () => store.update({ selectedWallId: null });

    const sepBtn = this.container.querySelector('#insp_separate_wall_btn');
    if (sepBtn) {
      sepBtn.onclick = () => {
        undoManager.pushCurrentState('Separar Muro de Trazado');
        const dx1 = wall.x2 - wall.x1;
        const dy1 = wall.y2 - wall.y1;
        const len = Math.hypot(dx1, dy1);
        if (len > 0) {
          const sep = Math.max(8, Math.min(24, len * 0.35));
          const nx1 = Math.round(wall.x1 + (dx1 / len) * sep);
          const ny1 = Math.round(wall.y1 + (dy1 / len) * sep);
          const nx2 = Math.round(wall.x2 - (dx1 / len) * sep);
          const ny2 = Math.round(wall.y2 - (dy1 / len) * sep);
          store.updateWall(wall.id, { x1: nx1, y1: ny1, x2: nx2, y2: ny2 });
          audio.playClockTick();
          store.addCombatLog({
            type: 'SYSTEM',
            title: '✂️ MURO SEPARADO',
            details: 'El tramo ha sido separado del trazado compuesto.'
          });
          const updated = (store.getActiveMap()?.walls || []).find(w => w.id === wall.id);
          if (updated) this.renderWallInspector(updated);
        }
      };
    }

    // Wall Type Switchers
    this.container.querySelector('#btn_type_wall').onclick = () => {
      store.updateWall(wall.id, { wallType: 'wall', isDoor: false, isWindow: false, isOpen: false });
      audio.playClockTick();
      const updatedMap = store.getActiveMap();
      const updatedWall = (updatedMap.walls || []).find(w => w.id === wall.id);
      if (updatedWall) this.renderWallInspector(updatedWall);
    };
    this.container.querySelector('#btn_type_door').onclick = () => {
      store.updateWall(wall.id, { wallType: 'door', isDoor: true, isWindow: false, isOpen: false, isLocked: false });
      audio.playClockTick();
      const updatedMap = store.getActiveMap();
      const updatedWall = (updatedMap.walls || []).find(w => w.id === wall.id);
      if (updatedWall) this.renderWallInspector(updatedWall);
    };
    this.container.querySelector('#btn_type_window').onclick = () => {
      store.updateWall(wall.id, { wallType: 'window', isDoor: false, isWindow: true, isOpen: true, visionPercent: 80 });
      audio.playClockTick();
      const updatedMap = store.getActiveMap();
      const updatedWall = (updatedMap.walls || []).find(w => w.id === wall.id);
      if (updatedWall) this.renderWallInspector(updatedWall);
    };

    // Door Controls
    const doorToggle = this.container.querySelector('#insp_door_toggle_state');
    if (doorToggle) {
      doorToggle.onclick = () => {
        const nextState = !isOpen;
        store.updateWall(wall.id, { isOpen: nextState });
        network.broadcast({ type: 'WALL_UPDATE', wallId: wall.id, data: { isOpen: nextState } });
        audio.playClockTick();
        const updatedMap = store.getActiveMap();
        const updatedWall = (updatedMap.walls || []).find(w => w.id === wall.id);
        if (updatedWall) this.renderWallInspector(updatedWall);
      };
    }

    const lockToggle = this.container.querySelector('#insp_door_toggle_lock');
    if (lockToggle) {
      lockToggle.onclick = () => {
        const nextLock = !isLocked;
        store.updateWall(wall.id, { isLocked: nextLock });
        network.broadcast({ type: 'WALL_UPDATE', wallId: wall.id, data: { isLocked: nextLock } });
        audio.playClockTick();
        const updatedMap = store.getActiveMap();
        const updatedWall = (updatedMap.walls || []).find(w => w.id === wall.id);
        if (updatedWall) this.renderWallInspector(updatedWall);
      };
    }

    const secretToggle = this.container.querySelector('#insp_door_toggle_secret');
    if (secretToggle) {
      secretToggle.onclick = () => {
        const nextSecret = !isSecret;
        store.updateWall(wall.id, { isSecret: nextSecret });
        network.broadcast({ type: 'WALL_UPDATE', wallId: wall.id, data: { isSecret: nextSecret } });
        audio.playClockTick();
        const updatedMap = store.getActiveMap();
        const updatedWall = (updatedMap.walls || []).find(w => w.id === wall.id);
        if (updatedWall) this.renderWallInspector(updatedWall);
      };
    }

    // Window Slider
    const visSlider = this.container.querySelector('#insp_window_vis');
    if (visSlider) {
      visSlider.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        this.container.querySelector('#window_vis_val').textContent = `${val}%`;
        store.updateWall(wall.id, { visionPercent: val });
      };
    }

    this.container.querySelector('#insp_delete_btn').onclick = () => {
      store.deleteWall(wall.id);
      audio.playLaserShot();
    };
  }

  renderWaterInspector(zone) {
    const depth = zone.depth ?? 2;
    const state = store.getState();
    const map = store.getActiveMap();
    const isRain = !!(map.showRain || state.showRain);

    this.container.innerHTML = sanitizeHTML(`
      <div class="element-inspector glass-panel">
        <div class="inspector-header">
          <div class="insp-title-group">
            <span class="insp-icon">🌊</span>
            <span class="insp-title">AQUATIC HAZARD ZONE // [${zone.name.toUpperCase()}]</span>
          </div>
          <button class="insp-close-btn" id="insp_close">&times;</button>
        </div>

        <div class="inspector-body">
          <div class="insp-row">
            <div class="insp-col" style="flex: 2;">
              <label>Zone Label</label>
              <input type="text" id="insp_water_name" class="hud-input hud-input-xs" value="${zone.name}" />
            </div>

            <div class="insp-col" style="flex: 3;">
              <label>Water Depth: Level ${depth}</label>
              <vf-select id="insp_water_depth" class="hud-select hud-select-xs">
                ${WATER_DEPTH_NAMES.map((name, idx) => `
                  <option value="${idx}" ${idx === depth ? 'selected' : ''}>
                    Depth ${idx}: ${name}
                  </option>
                `).join('')}
              </vf-select>
            </div>

            <div class="insp-col" style="flex: 2;">
              <label>Forma</label>
              <button class="hud-btn hud-btn-xs hud-btn-secondary" id="insp_water_shape_toggle" title="Alternar entre Caja rectangular y Polígono editable">
                ${zone.shape === 'polygon' ? '📐 POLÍGONO' : '🟦 CAJA'}
              </button>
            </div>

            <div class="insp-col" style="flex: 2;">
              <label>Weather FX</label>
              <button class="hud-btn hud-btn-xs ${isRain ? 'hud-btn-primary active' : 'hud-btn-secondary'}" id="insp_water_rain_toggle">
                ${isRain ? '🌧️ RAIN ACTIVE' : '🌧️ RAIN OFF'}
              </button>
            </div>

            <div class="insp-col insp-actions" style="max-width: 90px; justify-content: flex-end;">
              <button class="hud-btn hud-btn-xs hud-btn-danger" id="insp_delete_btn">DELETE</button>
            </div>
          </div>
        </div>
      </div>
    `);

    this.container.querySelector('#insp_close').onclick = () => store.update({ selectedWaterId: null });

    this.container.querySelector('#insp_water_name').onchange = (e) => {
      store.updateWaterZone(zone.id, { name: e.target.value.trim() || 'Water Hazard' });
    };

    this.container.querySelector('#insp_water_depth').onchange = (e) => {
      const newDepth = parseInt(e.target.value, 10);
      store.updateWaterZone(zone.id, { depth: newDepth });
      audio.playPing();
    };

    const shapeBtn = this.container.querySelector('#insp_water_shape_toggle');
    if (shapeBtn) {
      shapeBtn.onclick = () => {
        if (zone.shape === 'polygon') {
          // Switch to box
          const xs = (zone.points || []).map(p => p.x);
          const ys = (zone.points || []).map(p => p.y);
          const minX = xs.length ? Math.min(...xs) : zone.x;
          const minY = ys.length ? Math.min(...ys) : zone.y;
          const maxX = xs.length ? Math.max(...xs) : (zone.x + (zone.width || 180));
          const maxY = ys.length ? Math.max(...ys) : (zone.y + (zone.height || 140));
          store.updateWaterZone(zone.id, {
            shape: 'box',
            x: minX,
            y: minY,
            width: Math.max(64, maxX - minX),
            height: Math.max(64, maxY - minY)
          });
        } else {
          // Switch to polygon
          const w = zone.width || 180;
          const h = zone.height || 140;
          const pts = [
            { x: zone.x, y: zone.y },
            { x: zone.x + w, y: zone.y },
            { x: zone.x + w, y: zone.y + h },
            { x: zone.x, y: zone.y + h }
          ];
          store.updateWaterZone(zone.id, {
            shape: 'polygon',
            points: pts
          });
        }
        audio.playPing();
        const updated = (store.getActiveMap().waterZones || []).find(z => z.id === zone.id) || zone;
        this.renderWaterInspector(updated);
      };
    }

    const rainBtn = this.container.querySelector('#insp_water_rain_toggle');
    if (rainBtn) {
      rainBtn.onclick = () => {
        const next = !isRain;
        store.updateActiveMap({ showRain: next });
        store.update({ showRain: next });
        this.renderWaterInspector(zone);
      };
    }

    this.container.querySelector('#insp_delete_btn').onclick = () => {
      store.deleteWaterZone(zone.id);
    };
  }

  // --- Persistent Effect Anomaly Inspector ---
  renderEffectInspector(effect) {
    const shape = effect.shape || 'circle';
    const type = effect.type || 'void_rift';
    const effectColor = normalizeHex(effect.color) || (type === 'laser' ? '#ef4444' : '#00f3ff');

    this.container.innerHTML = sanitizeHTML(`
      <div class="element-inspector glass-panel">
        <div class="inspector-header">
          <div class="insp-title-group">
            <span class="insp-icon">🌀</span>
            <span class="insp-title">ANOMALY EMITTER // [${(effect.label || 'Tactical Anomaly').toUpperCase()}]</span>
          </div>
          <button class="insp-close-btn" id="insp_close">&times;</button>
        </div>

        <div class="inspector-body">
          <div class="insp-row">
            <div class="insp-col" style="flex: 2;">
              <label>Anomaly Type</label>
              <vf-select id="insp_fx_type" class="hud-select hud-select-xs">
                <option value="laser" ${type === 'laser' ? 'selected' : ''}>🔴 Tactical Laser Beam (Haz Láser)</option>
                <option value="void_rift" ${type === 'void_rift' ? 'selected' : ''}>🌌 Black Hole Singularity</option>
                <option value="toxic" ${type === 'toxic' ? 'selected' : ''}>☣️ Toxic Hazard (Bubbles & Skulls)</option>
                <option value="radioactive" ${type === 'radioactive' ? 'selected' : ''}>☢️ Radioactive (☢ Signs & Glow)</option>
                <option value="fire" ${type === 'fire' ? 'selected' : ''}>🔥 Fire & Plasma Perimeter</option>
                <option value="lightning" ${type === 'lightning' ? 'selected' : ''}>⚡ Arc Storm / Lightning</option>
                <option value="emp" ${type === 'emp' ? 'selected' : ''}>📡 EMP Wave Generator</option>
                <option value="radiant" ${type === 'radiant' ? 'selected' : ''}>☀️ Radiant Light Core</option>
                <option value="sparkle" ${type === 'sparkle' ? 'selected' : ''}>✨ Stardust Bioluminescence</option>
              </vf-select>
            </div>
            <div class="insp-col" style="flex: 1.5;">
              <label>Shape</label>
              <vf-select id="insp_fx_shape" class="hud-select hud-select-xs" ${type === 'laser' ? 'disabled title="Haz Láser es exclusivamente de sólo línea recta"' : ''}>
                ${type === 'laser' ? `
                  <option value="line" selected>➖ Straight Line A-B (Solo Línea)</option>
                ` : `
                  <option value="circle" ${shape === 'circle' ? 'selected' : ''}>⭕ Circle Area</option>
                  <option value="polygon" ${shape === 'polygon' ? 'selected' : ''}>📐 Polygon Area</option>
                  <option value="line" ${shape === 'line' ? 'selected' : ''}>➖ Straight Line A-B</option>
                `}
              </vf-select>
            </div>
            <div class="insp-col" style="flex: 2;">
              <label>Label</label>
              <input type="text" id="insp_fx_label" class="hud-input hud-input-xs" value="${effect.label || 'Anomaly'}" />
            </div>
            <div class="insp-col" style="max-width: 80px;">
              <label>State</label>
              <button class="hud-btn hud-btn-xs ${effect.active !== false ? 'hud-btn-primary active' : 'hud-btn-secondary'}" id="insp_fx_toggle_active">
                ${effect.active !== false ? '● ACTIVE' : '○ MUTED'}
              </button>
            </div>
          </div>

          <div class="insp-row" style="margin-top: 8px;">
            <div class="insp-col" style="flex: 2;">
              <label>Radius (${effect.radius || 120}px)</label>
              <input type="range" id="insp_fx_radius" min="40" max="600" step="10" value="${effect.radius || 120}" class="hud-slider" />
            </div>
            <div class="insp-col" style="flex: 2;">
              <label>Intensity (${Math.round((effect.intensity || 1.0) * 100)}%)</label>
              <input type="range" id="insp_fx_intensity" min="0.2" max="2.5" step="0.1" value="${effect.intensity || 1.0}" class="hud-slider" />
            </div>
            <div class="insp-col insp-actions" style="max-width: 90px; justify-content: flex-end;">
              <button class="hud-btn hud-btn-xs hud-btn-danger" id="insp_delete_btn">DELETE</button>
            </div>
          </div>

          <!-- Type-Specific Parameters -->
          ${type === 'radioactive' ? `
            <div class="insp-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.15);">
              <div class="insp-col" style="flex: 1;">
                <label>Light Intensity (${Math.round((effect.lightIntensity ?? 1.0) * 100)}%)</label>
                <input type="range" id="insp_fx_light_intensity" min="0.1" max="2.5" step="0.1" value="${effect.lightIntensity ?? 1.0}" class="hud-slider" />
              </div>
              <div class="insp-col" style="flex: 1;">
                <label>Particle Rate (${Math.round((effect.particleIntensity ?? 1.0) * 100)}%)</label>
                <input type="range" id="insp_fx_particle_intensity" min="0.2" max="2.5" step="0.1" value="${effect.particleIntensity ?? 1.0}" class="hud-slider" />
              </div>
            </div>
          ` : ''}

          ${type === 'lightning' ? `
            <div class="insp-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.15);">
              <div class="insp-col" style="flex: 1.5;">
                <label>Lightning Mode</label>
                <vf-select id="insp_fx_lightning_mode" class="hud-select hud-select-xs">
                  <option value="circle" ${(effect.lightningMode || 'circle') === 'circle' ? 'selected' : ''}>Center to Rim Emitter</option>
                  <option value="polygon" ${effect.lightningMode === 'polygon' ? 'selected' : ''}>Electrified Area Nodes</option>
                  <option value="line" ${effect.lightningMode === 'line' ? 'selected' : ''}>Direct Arc Point A to B</option>
                </vf-select>
              </div>
              <div class="insp-col" style="flex: 1.5;">
                <label>Frequency (${(effect.frequency ?? 1.0).toFixed(1)}x)</label>
                <input type="range" id="insp_fx_freq" min="0.2" max="4.0" step="0.2" value="${effect.frequency ?? 1.0}" class="hud-slider" />
              </div>
              <div class="insp-col" style="max-width: 80px;">
                <label>Color</label>
                <button type="button" id="insp_fx_color" class="insp-fx-color-button" style="background:${effectColor}" aria-label="Choose anomaly color" title="Choose anomaly color"><span>Choose</span></button>
              </div>
            </div>
          ` : ''}

          ${type === 'laser' ? `
            <div class="insp-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.15);">
              <div class="insp-col" style="flex: 1.5;">
                <label>Beam Width (${effect.beamWidth || 6}px)</label>
                <input type="range" id="insp_fx_beam_width" min="2" max="24" step="1" value="${effect.beamWidth || 6}" class="hud-slider" />
              </div>
              <div class="insp-col" style="flex: 1.5;">
                <label>Pulse Oscillation (${(effect.frequency ?? 1.0).toFixed(1)}x)</label>
                <input type="range" id="insp_fx_freq" min="0.2" max="4.0" step="0.2" value="${effect.frequency ?? 1.0}" class="hud-slider" />
              </div>
              <div class="insp-col" style="max-width: 80px;">
                <label>Beam Color</label>
                <button type="button" id="insp_fx_color" class="insp-fx-color-button" style="background:${effectColor}" aria-label="Choose anomaly color" title="Choose anomaly color"><span>Choose</span></button>
              </div>
            </div>
            <div class="insp-row" style="margin-top: 4px; display: flex; gap: 6px; align-items: center;">
              <span style="font-size: 10px; color: #94a3b8;">Presets:</span>
              <button class="hud-btn hud-btn-xs laser-preset-btn" data-color="#ef4444" style="background:#ef4444; color:#fff; padding: 1px 6px;">Red</button>
              <button class="hud-btn hud-btn-xs laser-preset-btn" data-color="#00f3ff" style="background:#00f3ff; color:#000; padding: 1px 6px;">Cyan</button>
              <button class="hud-btn hud-btn-xs laser-preset-btn" data-color="#10b981" style="background:#10b981; color:#fff; padding: 1px 6px;">Emerald</button>
              <button class="hud-btn hud-btn-xs laser-preset-btn" data-color="#c084fc" style="background:#c084fc; color:#000; padding: 1px 6px;">Violet</button>
              <button class="hud-btn hud-btn-xs laser-preset-btn" data-color="#f59e0b" style="background:#f59e0b; color:#000; padding: 1px 6px;">Amber</button>
            </div>
          ` : ''}
        </div>
      </div>
    `);

    this.container.querySelector('#insp_close').onclick = () => store.update({ selectedEffectId: null });

    this.container.querySelector('#insp_fx_type').onchange = (e) => {
      const newType = e.target.value;
      const updates = { type: newType };
      if (newType === 'laser') {
        updates.shape = 'line';
        if (effect.x2 === undefined || effect.x2 === null) {
          updates.x2 = effect.x + 260;
          updates.y2 = effect.y;
        }
        if (!effect.beamWidth) updates.beamWidth = 6;
        if (!effect.color || effect.color === '#00f3ff') updates.color = '#ef4444';
        if (!effect.label || effect.label === 'Anomaly') updates.label = 'Tactical Laser Beam';
      }
      store.updateEffect(effect.id, updates);
      const updatedMap = store.getActiveMap();
      const updatedEff = (updatedMap.effects || []).find(f => f.id === effect.id);
      if (updatedEff) this.renderEffectInspector(updatedEff);
    };

    const shapeSelect = this.container.querySelector('#insp_fx_shape');
    if (shapeSelect) {
      shapeSelect.onchange = (e) => {
        const newShape = e.target.value;
        const updates = { shape: newShape };
        if (newShape === 'polygon' && (!effect.points || effect.points.length < 3)) {
          const r = effect.radius || 120;
          updates.points = Array.from({length: 5}, (_, i) => ({
            x: Math.round(effect.x + Math.cos(i * Math.PI * 2 / 5 - Math.PI / 2) * r),
            y: Math.round(effect.y + Math.sin(i * Math.PI * 2 / 5 - Math.PI / 2) * r)
          }));
        }
        if (newShape === 'line' && (effect.x2 === undefined || effect.x2 === null)) {
          updates.x2 = effect.x + (effect.radius || 120) * 1.5;
          updates.y2 = effect.y;
        }
        store.updateEffect(effect.id, updates);
        const updatedMap = store.getActiveMap();
        const updatedEff = (updatedMap.effects || []).find(f => f.id === effect.id);
        if (updatedEff) this.renderEffectInspector(updatedEff);
      };
    }

    this.container.querySelector('#insp_fx_label').onchange = (e) => {
      store.updateEffect(effect.id, { label: e.target.value.trim() || 'Anomaly' });
    };

    this.container.querySelector('#insp_fx_toggle_active').onclick = () => {
      const currentActive = effect.active !== false;
      store.updateEffect(effect.id, { active: !currentActive });
      audio.playClockTick();
      const updatedMap = store.getActiveMap();
      const updatedEff = (updatedMap.effects || []).find(f => f.id === effect.id);
      if (updatedEff) this.renderEffectInspector(updatedEff);
    };

    this.container.querySelector('#insp_fx_radius').oninput = (e) => {
      store.updateEffect(effect.id, { radius: parseInt(e.target.value, 10) });
    };

    this.container.querySelector('#insp_fx_intensity').oninput = (e) => {
      store.updateEffect(effect.id, { intensity: parseFloat(e.target.value) });
    };

    const lightIntSlider = this.container.querySelector('#insp_fx_light_intensity');
    if (lightIntSlider) {
      lightIntSlider.oninput = (e) => {
        store.updateEffect(effect.id, { lightIntensity: parseFloat(e.target.value) });
      };
    }

    const partIntSlider = this.container.querySelector('#insp_fx_particle_intensity');
    if (partIntSlider) {
      partIntSlider.oninput = (e) => {
        store.updateEffect(effect.id, { particleIntensity: parseFloat(e.target.value) });
      };
    }

    const lightningModeSelect = this.container.querySelector('#insp_fx_lightning_mode');
    if (lightningModeSelect) {
      lightningModeSelect.onchange = (e) => {
        store.updateEffect(effect.id, { lightningMode: e.target.value });
      };
    }

    const freqSlider = this.container.querySelector('#insp_fx_freq');
    if (freqSlider) {
      freqSlider.oninput = (e) => {
        store.updateEffect(effect.id, { frequency: parseFloat(e.target.value) });
      };
    }

    const beamWidthSlider = this.container.querySelector('#insp_fx_beam_width');
    if (beamWidthSlider) {
      beamWidthSlider.oninput = (e) => {
        store.updateEffect(effect.id, { beamWidth: parseInt(e.target.value, 10) });
      };
    }

    this.container.querySelectorAll('.laser-preset-btn').forEach(btn => {
      btn.onclick = () => {
        const color = btn.dataset.color;
        store.updateEffect(effect.id, { color });
        const updatedMap = store.getActiveMap();
        const updatedEff = (updatedMap.effects || []).find(f => f.id === effect.id);
        if (updatedEff) this.renderEffectInspector(updatedEff);
      };
    });

    const colorPicker = this.container.querySelector('#insp_fx_color');
    if (colorPicker) {
      colorPicker.onclick = event => {
        event.stopPropagation();
        const latest = (store.getActiveMap().effects || []).find(item => item.id === effect.id);
        openColorPickerPopover(colorPicker, latest?.color || effectColor, color => {
          // Color picking can rerender the inspector; the popover stays mounted.
          if ((store.getActiveMap().effects || []).some(item => item.id === effect.id)) store.updateEffect(effect.id, { color });
        });
      };
    }

    this.container.querySelector('#insp_delete_btn').onclick = () => {
      store.deleteEffect(effect.id);
      audio.playLaserShot();
    };
  }

  // --- Area Template Inspector ---
  renderTemplateInspector(tmpl) {
    const map = store.getActiveMap();
    const gridSize = map.gridSize || 64;
    const scaleMeters = map.gridScaleMeters || 2.0;
    const radiusMeters = ((tmpl.radius / gridSize) * scaleMeters).toFixed(1);
    const radiusSq = (tmpl.radius / gridSize).toFixed(1);
    let deg = Math.round(((tmpl.angle || 0) * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;

    const coneDeg = Math.round(((tmpl.coneAngle || Math.PI / 3) * 180) / Math.PI);
    const widthMeters = (((tmpl.width || 48) / gridSize) * scaleMeters).toFixed(1);

    this.container.innerHTML = sanitizeHTML(`
      <div class="element-inspector glass-panel">
        <div class="inspector-header">
          <div class="insp-title-group">
            <span class="insp-icon">◎</span>
            <span class="insp-title">AREA TEMPLATE // [${tmpl.type.toUpperCase()}] — ${radiusMeters}m (${radiusSq} sq)</span>
          </div>
          <button class="insp-close-btn" id="insp_close">&times;</button>
        </div>

        <div class="inspector-body">
          <div class="insp-row">
            <!-- Shape Selector -->
            <div class="insp-col" style="flex: 2;">
              <label>Shape</label>
              <div style="display: flex; gap: 4px;">
                <button class="hud-btn hud-btn-xs tmpl-shape-btn ${tmpl.type === 'circle' ? 'active hud-btn-primary' : ''}" data-shape="circle">⭕ Circle</button>
                <button class="hud-btn hud-btn-xs tmpl-shape-btn ${tmpl.type === 'cone' ? 'active hud-btn-primary' : ''}" data-shape="cone">📐 Cone</button>
                <button class="hud-btn hud-btn-xs tmpl-shape-btn ${tmpl.type === 'line' ? 'active hud-btn-primary' : ''}" data-shape="line">➖ Line</button>
                <button class="hud-btn hud-btn-xs tmpl-shape-btn ${tmpl.type === 'box' ? 'active hud-btn-primary' : ''}" data-shape="box">⏹️ Box</button>
              </div>
            </div>

            <!-- Length / Radius Slider -->
            <div class="insp-col" style="flex: 2;">
              <label>Size / Distance (${radiusMeters}m / ${radiusSq} sq)</label>
              <input type="range" id="insp_tmpl_radius" min="40" max="800" step="10" value="${tmpl.radius}" class="hud-slider" />
            </div>

            <!-- Rotation Slider -->
            <div class="insp-col" style="flex: 1;">
              <label>Rotation (${deg}°)</label>
              <input type="range" id="insp_tmpl_rotation" min="0" max="360" step="5" value="${deg}" class="hud-slider" />
            </div>
          </div>

          <!-- Shape-specific controls (Cone Aperture, Line Width) -->
          <div class="insp-row" style="margin-top: 8px;">
            ${tmpl.type === 'cone' ? `
              <div class="insp-col" style="flex: 3;">
                <label>Cone Aperture Angle (${coneDeg}°)</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="range" id="insp_tmpl_cone_angle" min="15" max="150" step="5" value="${coneDeg}" class="hud-slider" style="flex: 1;" />
                  <div style="display: flex; gap: 3px;">
                    ${[30, 45, 60, 90, 120].map(a => `
                      <button class="hud-btn hud-btn-xs cone-preset-btn ${coneDeg === a ? 'active hud-btn-primary' : ''}" data-angle="${a}" style="padding: 2px 5px; font-size: 8px;">${a}°</button>
                    `).join('')}
                  </div>
                </div>
              </div>
            ` : ''}

            ${tmpl.type === 'line' ? `
              <div class="insp-col" style="flex: 3;">
                <label>Beam Amplitude / Width (${widthMeters}m)</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="range" id="insp_tmpl_width" min="16" max="220" step="4" value="${tmpl.width || 48}" class="hud-slider" style="flex: 1;" />
                  <div style="display: flex; gap: 3px;">
                    ${[32, 48, 64, 96, 128].map(w => `
                      <button class="hud-btn hud-btn-xs line-preset-btn ${(tmpl.width || 48) === w ? 'active hud-btn-primary' : ''}" data-width="${w}" style="padding: 2px 5px; font-size: 8px;">${((w / gridSize) * scaleMeters).toFixed(1)}m</button>
                    `).join('')}
                  </div>
                </div>
              </div>
            ` : ''}

            <div class="insp-col insp-actions" style="max-width: 90px; justify-content: flex-end; margin-left: auto;">
              <button class="hud-btn hud-btn-xs hud-btn-danger" id="insp_tmpl_delete_btn">DELETE</button>
            </div>
          </div>
        </div>
      </div>
    `);

    this.container.querySelector('#insp_close').onclick = () => {
      if (window.veilCanvas) window.veilCanvas.activeTemplate = null;
      store.update({ selectedTemplateId: null });
      this.render();
    };

    this.container.querySelectorAll('.tmpl-shape-btn').forEach(btn => {
      btn.onclick = () => {
        tmpl.type = btn.dataset.shape;
        this.renderTemplateInspector(tmpl);
      };
    });

    this.container.querySelector('#insp_tmpl_radius').oninput = (e) => {
      tmpl.radius = parseInt(e.target.value, 10);
      tmpl.length = tmpl.radius;
    };

    this.container.querySelector('#insp_tmpl_rotation').oninput = (e) => {
      tmpl.angle = (parseInt(e.target.value, 10) * Math.PI) / 180;
    };

    const coneAngleInput = this.container.querySelector('#insp_tmpl_cone_angle');
    if (coneAngleInput) {
      coneAngleInput.oninput = (e) => {
        tmpl.coneAngle = (parseInt(e.target.value, 10) * Math.PI) / 180;
      };
    }
    this.container.querySelectorAll('.cone-preset-btn').forEach(btn => {
      btn.onclick = () => {
        const degVal = parseInt(btn.dataset.angle, 10);
        tmpl.coneAngle = (degVal * Math.PI) / 180;
        this.renderTemplateInspector(tmpl);
      };
    });

    const widthInput = this.container.querySelector('#insp_tmpl_width');
    if (widthInput) {
      widthInput.oninput = (e) => {
        tmpl.width = parseInt(e.target.value, 10);
      };
    }
    this.container.querySelectorAll('.line-preset-btn').forEach(btn => {
      btn.onclick = () => {
        tmpl.width = parseInt(btn.dataset.width, 10);
        this.renderTemplateInspector(tmpl);
      };
    });

    this.container.querySelector('#insp_tmpl_delete_btn').onclick = () => {
      if (window.veilCanvas) {
        window.veilCanvas.templates = (window.veilCanvas.templates || []).filter(t => t.id !== tmpl.id);
        window.veilCanvas.activeTemplate = null;
      }
      store.update({ selectedTemplateId: null });
      audio.playClockTick();
      this.render();
    };
  }
}
