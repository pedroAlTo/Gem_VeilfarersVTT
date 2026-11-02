import { openSceneCreator } from './sceneCreator.js';
import { sanitizeHTML, confirmAction } from './ui.js';
// src/sceneManager.js
// Tactical Scene & Multi-Map Manager for VeilVTT

import { store } from './state.js';
import { network } from './networkManager.js';

export class SceneManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('maps') || keys.includes('activeMapId') || keys.includes('userRole')) {
        this.render();
      }
    });
  }

  render() {
    const state = store.getState();
    const activeMap = store.getActiveMap();
    const isKeeper = state.userRole === 'keeper';

    this.container.innerHTML = sanitizeHTML(`
      <div class="scenes-sidebar-content">
        <div class="sidebar-header-row">
          <span class="sidebar-title">TACTICAL SCENES (${state.maps.length})</span>
          ${isKeeper ? `
            <button class="hud-btn hud-btn-xs hud-btn-primary" id="add_map_btn">+ NEW SCENE</button>
          ` : ''}
        </div>

        <!-- Maps List -->
        <div class="scene-cards-list">
          ${state.maps.map(map => {
            const isActive = map.id === state.activeMapId;
            return `
              <div class="scene-card ${isActive ? 'active' : ''}" data-id="${map.id}">
                <div class="scene-card-preview" style="background-image: url('${map.imageUrl}')">
                  ${isActive ? '<span class="scene-active-tag">ENGAGED</span>' : ''}
                </div>
                <div class="scene-card-info">
                  <span class="scene-card-name">${map.name}</span>
                  <div class="scene-card-meta">
                    <span>Grid: ${map.gridSize || 70}px</span>
                    <span>Walls: ${map.walls?.length || 0}</span>
                    <span>Lights: ${map.lights?.length || 0}</span>
                  </div>
                </div>
                ${isKeeper && !isActive ? `
                  <button class="hud-btn hud-btn-xs hud-btn-secondary switch-scene-btn" data-id="${map.id}">ENGAGE</button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        ${isKeeper ? `
          <!-- Active Scene Environment Config -->
          <div class="scene-config-panel glass-panel" style="margin-top: 16px;">
            <div class="config-header">ENVIRONMENTAL TUNING // [${activeMap.name}]</div>

            <div class="form-group" style="margin-top: 10px;">
              <label>Ambient Light (Darkness level: ${(100 - (activeMap.ambientLight * 100)).toFixed(0)}%)</label>
              <input type="range" id="scene_ambient_slider" min="0" max="1" step="0.05" value="${activeMap.ambientLight ?? 0.25}" class="hud-slider" />
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1.2;">
                <label>Grid Size: <span style="color: var(--cyan-pearl);">${activeMap.gridSize || 64}px</span></label>
                <input type="range" id="scene_grid_size_slider" class="hud-slider" value="${activeMap.gridSize || 64}" min="24" max="250" />
              </div>
              <div class="form-group" style="flex: 0.8;">
                <label>Scale (m/sq)</label>
                <input type="number" id="scene_grid_scale_meters" class="hud-input" value="${activeMap.gridScaleMeters || 2.0}" min="0.5" max="100" step="0.5" />
              </div>
            </div>

            <div style="margin-top: 6px; margin-bottom: 8px;">
              <button class="hud-btn hud-btn-xs hud-btn-primary" id="open_grid_scaler_btn" style="width: 100%; font-size: 11px; padding: 6px;">
                📐 ESCALAR Y CALIBRAR REJILLA EN EL MAPA
              </button>
            </div>

            <div class="form-row" style="margin-top: 10px;">
              <button class="hud-btn hud-btn-xs hud-btn-danger" id="clear_walls_btn">CLEAR WALLS</button>
              <button class="hud-btn hud-btn-xs hud-btn-secondary" id="clear_lights_btn">CLEAR LIGHTS</button>
              <button class="hud-btn hud-btn-xs hud-btn-cyan" id="add_water_zone_btn">+ WATER ZONE</button>
            </div>

            <!-- Water Zones List in Scene -->
            <div class="scene-water-list" style="margin-top: 14px; border-top: 1px solid rgba(0, 243, 255, 0.2); padding-top: 10px;">
              <div style="font-family: var(--font-hud); font-size: 11px; font-weight: 700; color: var(--cyan-pearl); margin-bottom: 6px;">
                AQUATIC HAZARDS (${activeMap.waterZones?.length || 0}) // DEPTH 0-5
              </div>
              ${(activeMap.waterZones || []).map(w => `
                <div class="log-card glass-panel" style="margin-bottom: 6px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <span style="font-weight: 700; color: #fff;">${w.name}</span>
                    <span style="font-size: 11px; color: #38bdf8; margin-left: 6px;">Depth ${w.depth ?? 2}</span>
                  </div>
                  <div style="display: flex; gap: 4px;">
                    <button class="hud-btn hud-btn-xs select-water-btn" data-id="${w.id}">SELECT</button>
                    <button class="hud-btn hud-btn-xs hud-btn-danger delete-water-btn" data-id="${w.id}">✕</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `);

    this.initEvents();
  }

  initEvents() {
    const isKeeper = store.getState().userRole === 'keeper';

    // Switch scene
    this.container.querySelectorAll('.switch-scene-btn').forEach(btn => {
      btn.onclick = () => {
        const targetId = btn.dataset.id;
        store.switchScene(targetId);
        network.broadcast({ type: 'MAP_CHANGE', mapId: targetId });
      };
    });

    if (isKeeper) {
      // Add Map Button
      const addBtn = this.container.querySelector('#add_map_btn');
      if (addBtn) {
        addBtn.onclick = () => this.openAddMapModal();
      }

      // Add Water Zone Button
      const addWaterBtn = this.container.querySelector('#add_water_zone_btn');
      if (addWaterBtn) {
        addWaterBtn.onclick = () => {
          store.addWaterZone({
            name: 'Pearl Lagoon Hazard',
            x: 400,
            y: 350,
            width: 320,
            height: 220,
            depth: 3
          });
        };
      }

      // Select / Delete Water buttons
      this.container.querySelectorAll('.select-water-btn').forEach(btn => {
        btn.onclick = () => {
          store.update({ selectedWaterId: btn.dataset.id, activeLayer: 'water' });
        };
      });

      this.container.querySelectorAll('.delete-water-btn').forEach(btn => {
        btn.onclick = () => {
          store.deleteWaterZone(btn.dataset.id);
        };
      });

      // Environmental Sliders
      const ambientSlider = this.container.querySelector('#scene_ambient_slider');
      if (ambientSlider) {
        ambientSlider.oninput = (e) => {
          const val = parseFloat(e.target.value);
          store.updateActiveMap({ ambientLight: val });
        };
      }

      const gridSizeSlider = this.container.querySelector('#scene_grid_size_slider');
      if (gridSizeSlider) {
        gridSizeSlider.oninput = (e) => {
          const val = parseInt(e.target.value, 10) || 64;
          store.updateActiveMap({ gridSize: val });
        };
      }

      const gridScaleInput = this.container.querySelector('#scene_grid_scale_meters');
      if (gridScaleInput) {
        gridScaleInput.onchange = (e) => {
          const val = Math.max(0.2, parseFloat(e.target.value) || 2.0);
          store.updateActiveMap({ gridScaleMeters: val });
        };
      }

      const openScalerBtn = this.container.querySelector('#open_grid_scaler_btn');
      if (openScalerBtn) {
        openScalerBtn.onclick = () => {
          window.dispatchEvent(new CustomEvent('veil:toggle_grid_scaler', { detail: { force: true } }));
        };
      }

      // Clear Walls / Lights
      const clearWalls = this.container.querySelector('#clear_walls_btn');
      if (clearWalls) {
        clearWalls.onclick = async () => {
          if (await confirmAction('Clear all dynamic lighting barrier walls in this scene?')) {
            store.updateActiveMap({ walls: [] });
          }
        };
      }

      const clearLights = this.container.querySelector('#clear_lights_btn');
      if (clearLights) {
        clearLights.onclick = async () => {
          if (await confirmAction('Clear all placed light sources in this scene?')) {
            store.updateActiveMap({ lights: [] });
          }
        };
      }
    }
  }

  openAddMapModal() { return openSceneCreator(); }
}
