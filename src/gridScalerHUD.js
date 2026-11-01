// src/gridScalerHUD.js
// Tactical Grid Scaler & Scale Calibration HUD for VeilVTT
// Allows live scaling of grid cells, physical scale (meters/sq), and fine offset alignment

import { store } from './state.js';
import { audio } from './audioEngine.js';

export class GridScalerHUD {
  constructor(containerElement) {
    this.container = containerElement;
    this.isOpen = false;
    this.render();

    store.subscribe((state, keys) => {
      if (
        keys.includes('maps') ||
        keys.includes('activeMapId') ||
        keys.includes('userRole') ||
        keys.includes('activeTool')
      ) {
        if (state.activeTool === 'grid_scale') {
          this.isOpen = true;
        }
        this.render();
      }
    });

    window.addEventListener('veil:toggle_grid_scaler', (e) => {
      this.isOpen = e.detail?.force !== undefined ? e.detail.force : !this.isOpen;
      const scalerBtn = document.getElementById('tool_grid_scale');
      if (scalerBtn) scalerBtn.classList.toggle('active', this.isOpen);
      this.render();
    });

    window.addEventListener('veil:grid_calibrated', () => {
      this.render();
    });
  }

  toggle(force) {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    const scalerBtn = document.getElementById('tool_grid_scale');
    if (scalerBtn) scalerBtn.classList.toggle('active', this.isOpen);
    this.render();
  }

  render() {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';

    if (!isKeeper || (!this.isOpen && state.activeTool !== 'grid_scale')) {
      this.container.innerHTML = '';
      this.container.classList.add('hidden');
      return;
    }

    const map = store.getActiveMap() || {};
    const gridSize = map.gridSize || 64;
    const scaleMeters = map.gridScaleMeters || 2.0;
    const offX = map.gridOffsetX || 0;
    const offY = map.gridOffsetY || 0;
    const gridColor = map.gridColor || '#00f3ff';
    const gridAlpha = map.gridAlpha !== undefined ? map.gridAlpha : 0.2;

    this.container.classList.remove('hidden');
    this.container.innerHTML = `
      <div class="element-inspector glass-panel grid-scaler-panel" style="max-width: 580px;">
        <div class="inspector-header">
          <div class="insp-title-group">
            <span class="insp-icon">📐</span>
            <span class="insp-title">ESCALA Y CALIBRACIÓN DE REJILLA // [${map.name || 'SCENE'}]</span>
          </div>
          <button class="insp-close-btn" id="close_grid_scaler_btn" title="Cerrar Calibrador">&times;</button>
        </div>

        <div class="inspector-body" style="gap: 12px;">
          <!-- Section 1: Grid Size in Pixels (Live Slider) -->
          <div style="background: rgba(15, 23, 42, 0.45); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(0, 243, 255, 0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label style="font-family: var(--font-hud); font-size: 11px; font-weight: 700; color: #fff;">
                TAMAÑO DE CASILLA: <span style="color: var(--cyan-pearl); font-size: 13px;">${gridSize}px</span>
              </label>
              <div style="display: flex; gap: 4px;">
                <button class="hud-btn hud-btn-xs step-grid-btn" data-step="-5">-5</button>
                <button class="hud-btn hud-btn-xs step-grid-btn" data-step="-1">-1</button>
                <button class="hud-btn hud-btn-xs step-grid-btn" data-step="1">+1</button>
                <button class="hud-btn hud-btn-xs step-grid-btn" data-step="5">+5</button>
              </div>
            </div>

            <input type="range" id="grid_size_slider" min="24" max="250" step="1" value="${gridSize}" class="hud-slider" style="width: 100%;" />

            <div style="display: flex; gap: 4px; margin-top: 6px; align-items: center;">
              <span style="font-size: 9px; color: var(--text-dim); text-transform: uppercase;">Presets VTT:</span>
              <button class="hud-btn hud-btn-xs grid-preset-btn ${gridSize === 50 ? 'active hud-btn-primary' : ''}" data-size="50">50px</button>
              <button class="hud-btn hud-btn-xs grid-preset-btn ${gridSize === 64 ? 'active hud-btn-primary' : ''}" data-size="64">64px</button>
              <button class="hud-btn hud-btn-xs grid-preset-btn ${gridSize === 70 ? 'active hud-btn-primary' : ''}" data-size="70">70px (R20)</button>
              <button class="hud-btn hud-btn-xs grid-preset-btn ${gridSize === 100 ? 'active hud-btn-primary' : ''}" data-size="100">100px (FVTT)</button>
              <button class="hud-btn hud-btn-xs grid-preset-btn ${gridSize === 128 ? 'active hud-btn-primary' : ''}" data-size="128">128px (2K)</button>
              <button class="hud-btn hud-btn-xs grid-preset-btn ${gridSize === 140 ? 'active hud-btn-primary' : ''}" data-size="140">140px (4K)</button>
            </div>
          </div>

          <!-- Section 2: Physical Scale (Meters per square) -->
          <div style="background: rgba(15, 23, 42, 0.45); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(0, 243, 255, 0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label style="font-family: var(--font-hud); font-size: 11px; font-weight: 700; color: #fff;">
                ESCALA FÍSICA: <span style="color: #fde047;">1 Casilla = ${scaleMeters} metros</span>
              </label>
              <div style="display: flex; align-items: center; gap: 6px;">
                <input type="number" id="grid_scale_meters_input" min="0.5" max="100" step="0.5" value="${scaleMeters}" class="hud-input hud-input-xs" style="width: 65px; text-align: center;" />
                <span style="font-size: 10px; color: var(--text-dim);">m / sq</span>
              </div>
            </div>

            <div style="display: flex; gap: 4px;">
              <button class="hud-btn hud-btn-xs scale-preset-btn ${scaleMeters === 1.0 ? 'active hud-btn-primary' : ''}" data-meters="1.0">1.0m (CQB)</button>
              <button class="hud-btn hud-btn-xs scale-preset-btn ${scaleMeters === 1.5 ? 'active hud-btn-primary' : ''}" data-meters="1.5">1.5m (5 ft D&D)</button>
              <button class="hud-btn hud-btn-xs scale-preset-btn ${scaleMeters === 2.0 ? 'active hud-btn-primary' : ''}" data-meters="2.0">2.0m (Veilfarers)</button>
              <button class="hud-btn hud-btn-xs scale-preset-btn ${scaleMeters === 3.0 ? 'active hud-btn-primary' : ''}" data-meters="3.0">3.0m (Exterior)</button>
              <button class="hud-btn hud-btn-xs scale-preset-btn ${scaleMeters === 10.0 ? 'active hud-btn-primary' : ''}" data-meters="10.0">10m (Naval)</button>
            </div>
            <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">
              💡 Las reglas de medida, rangos de armas y plantillas tácticas calcularán sus alcances con esta escala.
            </div>
          </div>

          <!-- Section 3: Fine Alignment Nudge (Offset X & Y) -->
          <div style="display: flex; gap: 10px;">
            <div style="flex: 1; background: rgba(15, 23, 42, 0.45); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(0, 243, 255, 0.2);">
              <label style="font-family: var(--font-hud); font-size: 10px; font-weight: 700; color: #fff; margin-bottom: 4px; display: block;">
                ALINEACIÓN FINA // DESPLAZAR REJILLA
              </label>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                <div style="display: grid; grid-template-columns: repeat(3, 28px); gap: 3px;">
                  <div></div>
                  <button class="hud-btn hud-btn-xs nudge-btn" data-axis="y" data-dir="-1" title="Subir rejilla 1px (o 5px con Shift)">▲</button>
                  <div></div>
                  <button class="hud-btn hud-btn-xs nudge-btn" data-axis="x" data-dir="-1" title="Mover rejilla izquierda 1px (o 5px con Shift)">◀</button>
                  <button class="hud-btn hud-btn-xs reset-offset-btn" title="Resetear desplazamiento a (0,0)">⌖</button>
                  <button class="hud-btn hud-btn-xs nudge-btn" data-axis="x" data-dir="1" title="Mover rejilla derecha 1px (o 5px con Shift)">▶</button>
                  <div></div>
                  <button class="hud-btn hud-btn-xs nudge-btn" data-axis="y" data-dir="1" title="Bajar rejilla 1px (o 5px con Shift)">▼</button>
                  <div></div>
                </div>

                <div style="font-size: 10px; color: var(--text-dim); text-align: right; line-height: 1.4;">
                  <div>Offset X: <span style="color: #fff; font-weight: bold;">${offX}px</span></div>
                  <div>Offset Y: <span style="color: #fff; font-weight: bold;">${offY}px</span></div>
                </div>
              </div>
            </div>

            <!-- Section 4: Interactive Measure Tool on Canvas -->
            <div style="flex: 1; background: rgba(15, 23, 42, 0.45); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(0, 243, 255, 0.2); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <label style="font-family: var(--font-hud); font-size: 10px; font-weight: 700; color: #fde047; margin-bottom: 4px; display: block;">
                  📐 DIBUJAR CASILLA EN EL MAPA
                </label>
                <div style="font-size: 9.5px; color: #cbd5e1; line-height: 1.3;">
                  Haz clic y arrastra sobre cualquier cuadrado dibujado en el mapa para ajustar los píxeles al instante.
                </div>
              </div>
              <button class="hud-btn hud-btn-xs hud-btn-primary" id="activate_drag_calib_btn" style="width: 100%; margin-top: 6px;">
                ${state.activeTool === 'grid_scale' ? '✓ MODO ARRASTRAR ACTIVO' : 'ACTIVAR MODO ARRASTRAR'}
              </button>
            </div>
          </div>

          <!-- Section 5: Opacity & Color -->
          <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; border-top: 1px solid rgba(0, 243, 255, 0.15); padding-top: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 10px; color: var(--text-dim);">Opacidad:</span>
              <input type="range" id="grid_alpha_slider" min="0.05" max="0.8" step="0.05" value="${gridAlpha}" class="hud-slider" style="width: 100px;" />
              <span style="font-size: 10px; color: #fff;">${Math.round(gridAlpha * 100)}%</span>
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 10px; color: var(--text-dim);">Color:</span>
              <input type="color" id="grid_color_picker" value="${gridColor.startsWith('#') ? gridColor : '#00f3ff'}" class="hud-color-input" style="width: 28px; height: 22px;" />
              <button class="hud-btn hud-btn-xs hud-btn-secondary" id="grid_apply_done_btn" style="margin-left: 8px;">GUARDAR Y CERRAR</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(map);
  }

  bindEvents(map) {
    // Close button
    const closeBtn = this.container.querySelector('#close_grid_scaler_btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.isOpen = false;
        const scalerBtn = document.getElementById('tool_grid_scale');
        if (scalerBtn) scalerBtn.classList.remove('active');
        if (store.getState().activeTool === 'grid_scale') {
          store.update({ activeTool: 'select' });
        }
        this.render();
      };
    }

    const doneBtn = this.container.querySelector('#grid_apply_done_btn');
    if (doneBtn) {
      doneBtn.onclick = () => {
        this.isOpen = false;
        const scalerBtn = document.getElementById('tool_grid_scale');
        if (scalerBtn) scalerBtn.classList.remove('active');
        if (store.getState().activeTool === 'grid_scale') {
          store.update({ activeTool: 'select' });
        }
        this.render();
        audio.playClockTick();
      };
    }

    // Grid size slider (Live feedback)
    const sizeSlider = this.container.querySelector('#grid_size_slider');
    if (sizeSlider) {
      sizeSlider.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        store.updateActiveMap({ gridSize: val });
        // Update label badge live
        const label = this.container.querySelector('.insp-title');
        if (label) this.render();
      };
    }

    // Step buttons
    this.container.querySelectorAll('.step-grid-btn').forEach(btn => {
      btn.onclick = () => {
        const step = parseInt(btn.dataset.step, 10);
        const newSize = Math.max(20, Math.min(260, (map.gridSize || 64) + step));
        store.updateActiveMap({ gridSize: newSize });
        audio.playClockTick();
        this.render();
      };
    });

    // Preset buttons
    this.container.querySelectorAll('.grid-preset-btn').forEach(btn => {
      btn.onclick = () => {
        const size = parseInt(btn.dataset.size, 10);
        store.updateActiveMap({ gridSize: size });
        audio.playClockTick();
        this.render();
      };
    });

    // Scale in meters input
    const scaleInput = this.container.querySelector('#grid_scale_meters_input');
    if (scaleInput) {
      scaleInput.onchange = (e) => {
        const val = Math.max(0.2, parseFloat(e.target.value) || 2.0);
        store.updateActiveMap({ gridScaleMeters: val });
        audio.playClockTick();
        this.render();
      };
    }

    // Scale presets
    this.container.querySelectorAll('.scale-preset-btn').forEach(btn => {
      btn.onclick = () => {
        const meters = parseFloat(btn.dataset.meters);
        store.updateActiveMap({ gridScaleMeters: meters });
        audio.playClockTick();
        this.render();
      };
    });

    // Nudge buttons
    this.container.querySelectorAll('.nudge-btn').forEach(btn => {
      btn.onclick = (e) => {
        const axis = btn.dataset.axis;
        const dir = parseInt(btn.dataset.dir, 10);
        const amount = e.shiftKey ? 5 : 1;
        const size = map.gridSize || 64;

        if (axis === 'x') {
          const newX = (((map.gridOffsetX || 0) + dir * amount) % size + size) % size;
          store.updateActiveMap({ gridOffsetX: newX });
        } else {
          const newY = (((map.gridOffsetY || 0) + dir * amount) % size + size) % size;
          store.updateActiveMap({ gridOffsetY: newY });
        }
        this.render();
      };
    });

    // Reset offset button
    const resetOffsetBtn = this.container.querySelector('.reset-offset-btn');
    if (resetOffsetBtn) {
      resetOffsetBtn.onclick = () => {
        store.updateActiveMap({ gridOffsetX: 0, gridOffsetY: 0 });
        audio.playClockTick();
        this.render();
      };
    }

    // Activate drag calibration
    const activateDragBtn = this.container.querySelector('#activate_drag_calib_btn');
    if (activateDragBtn) {
      activateDragBtn.onclick = () => {
        store.update({ activeTool: 'grid_scale' });
        audio.playClockTick();
        this.render();
      };
    }

    // Grid Alpha slider
    const alphaSlider = this.container.querySelector('#grid_alpha_slider');
    if (alphaSlider) {
      alphaSlider.oninput = (e) => {
        const alpha = parseFloat(e.target.value);
        store.updateActiveMap({ gridAlpha: alpha });
      };
    }

    // Grid Color picker
    const colorPicker = this.container.querySelector('#grid_color_picker');
    if (colorPicker) {
      colorPicker.oninput = (e) => {
        store.updateActiveMap({ gridColor: e.target.value });
      };
    }
  }
}

