// src/layerManager.js
// Multi-Layer Workflow System for VeilVTT with Draggable & Minimizable HUD

import { store } from './state.js';
import gsap from 'gsap';

export const LAYERS = [
  { id: 'map', name: 'Map & Terrain', icon: '🗺️', desc: 'Background battlemap and grid' },
  { id: 'water', name: 'Water & Hazard', icon: '🌊', desc: 'Aquatic depths (0-5) and environmental hazards' },
  { id: 'walls_lights', name: 'Walls & Lights', icon: '💡', desc: 'Barrier walls, doors, and dynamic lighting' },
  { id: 'tokens', name: 'Tokens & Operatives', icon: '♟️', desc: 'Player characters, NPCs, ships, and monsters' },
  { id: 'overlay', name: 'Overlay & FX', icon: '✨', desc: 'Blast templates, rulers, notes, and particles' }
];

export class LayerManagerHUD {
  constructor(containerElement) {
    this.container = containerElement;
    this.isMinimized = false;
    this.initDrag();
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('activeLayer') || keys.includes('layerVisibility') || keys.includes('layerLocked') || keys.includes('userRole') || keys.includes('fogOfWar') || keys.includes('fogExploredOpacity')) {
        this.render();
      }
    });
  }

  initDrag() {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const startDrag = (clientX, clientY) => {
      isDragging = true;
      startX = clientX;
      startY = clientY;

      const rect = this.container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      this.container.style.position = 'fixed';
      this.container.style.right = 'auto';
      this.container.style.bottom = 'auto';
      this.container.style.left = `${initialLeft}px`;
      this.container.style.top = `${initialTop}px`;
      this.container.style.zIndex = '999';
    };

    const moveDrag = (clientX, clientY) => {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      const rect = this.container.getBoundingClientRect();
      const newLeft = Math.max(10, Math.min(window.innerWidth - rect.width - 10, initialLeft + dx));
      const newTop = Math.max(10, Math.min(window.innerHeight - 50, initialTop + dy));
      this.container.style.left = `${newLeft}px`;
      this.container.style.top = `${newTop}px`;
    };

    const endDrag = () => {
      isDragging = false;
    };

    // Mouse Dragging
    this.container.addEventListener('mousedown', (e) => {
      const header = e.target.closest('.layer-bar-header');
      if (!header || e.target.closest('.layer-min-btn')) return;
      startDrag(e.clientX, e.clientY);

      const onMouseMove = (ev) => moveDrag(ev.clientX, ev.clientY);
      const onMouseUp = () => {
        endDrag();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Touch Dragging (Tablets & Phones)
    this.container.addEventListener('touchstart', (e) => {
      const header = e.target.closest('.layer-bar-header');
      if (!header || e.target.closest('.layer-min-btn')) return;
      if (e.touches.length === 1) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (isDragging) endDrag();
    }, { passive: true });
  }

  render() {
    const state = store.getState();
    const activeLayer = state.activeLayer;
    const isKeeper = state.userRole === 'keeper';

    this.container.innerHTML = `
      <div class="layer-bar glass-panel ${this.isMinimized ? 'layer-bar-minimized' : ''}">
        <div class="layer-bar-header" style="cursor: grab; user-select: none;" title="Arrastrar para mover panel">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--cyan-pearl); font-size: 11px; opacity: 0.7;">⋮⋮</span>
            <span class="layer-title-text">TACTICAL LAYERS</span>
            <span class="layer-current-badge">${LAYERS.find(l => l.id === activeLayer)?.name || 'Tokens'}</span>
          </div>
          <button class="layer-min-btn" id="layer_minimize_btn" title="${this.isMinimized ? 'Expand Layers Window' : 'Minimize Layers Window'}">
            ${this.isMinimized ? '▢' : '−'}
          </button>
        </div>

        <div class="layer-buttons-list" style="${this.isMinimized ? 'display: none;' : ''}">
          ${LAYERS.map(layer => {
            const isActive = layer.id === activeLayer;
            const isVisible = state.layerVisibility[layer.id] !== false;
            const isLocked = state.layerLocked[layer.id] === true;

            // Restrict walls/lights and map editing to Keeper
            const isRestricted = (layer.id === 'walls_lights' || layer.id === 'map') && !isKeeper;

            return `
              <div class="layer-row ${isActive ? 'active' : ''} ${isRestricted ? 'disabled' : ''}" data-layer-id="${layer.id}">
                <button class="layer-select-btn" data-layer-id="${layer.id}" title="${layer.desc}">
                  <span class="layer-icon">${layer.icon}</span>
                  <span class="layer-name">${layer.name}</span>
                </button>

                <div class="layer-toggles">
                  <button class="layer-toggle-btn toggle-vis ${!isVisible ? 'muted' : ''}" data-layer-id="${layer.id}" title="${isVisible ? 'Hide Layer' : 'Show Layer'}">
                    ${isVisible ? '👁️' : '🕶️'}
                  </button>
                  ${isKeeper ? `
                    <button class="layer-toggle-btn toggle-lock ${isLocked ? 'locked' : ''}" data-layer-id="${layer.id}" title="${isLocked ? 'Unlock Layer' : 'Lock Layer'}">
                      ${isLocked ? '🔒' : '🔓'}
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}

          ${isKeeper ? `
            <div class="layer-fow-section" style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0, 243, 255, 0.25);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11px; font-weight: bold; color: #00f3ff; font-family: 'Rajdhani', sans-serif;">🌫️ NIEBLA DE GUERRA</span>
                <button class="hud-btn hud-btn-xs ${state.fogOfWar !== false ? 'active' : ''}" id="btn_toggle_fow_layer" style="font-size: 10px; padding: 2px 8px;">
                  ${state.fogOfWar !== false ? 'ON' : 'OFF'}
                </button>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 10px; color: #94a3b8;">
                <span>Oscuridad Explorada (${Math.round((state.fogExploredOpacity ?? 0.88) * 100)}%):</span>
                <input type="range" id="input_fow_opacity" min="80" max="95" value="${Math.round((state.fogExploredOpacity ?? 0.88) * 100)}" style="width: 75px; accent-color: #00f3ff; cursor: pointer;">
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="hud-btn hud-btn-xs" id="btn_reset_fow" style="flex: 1; font-size: 9px; padding: 4px;" title="Reiniciar exploración (todo el mapa oscuro)">
                  🔄 REINICIAR
                </button>
                <button class="hud-btn hud-btn-xs" id="btn_reveal_fow" style="flex: 1; font-size: 9px; padding: 4px;" title="Revelar todo el mapa">
                  👁️ REVELAR
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.initEvents();
  }

  initEvents() {
    const minBtn = this.container.querySelector('#layer_minimize_btn');
    if (minBtn) {
      minBtn.onclick = (e) => {
        e.stopPropagation();
        this.isMinimized = !this.isMinimized;
        const list = this.container.querySelector('.layer-buttons-list');
        if (list) {
          if (this.isMinimized) {
            gsap.to(list, {
              height: 0,
              opacity: 0,
              duration: 0.2,
              onComplete: () => this.render()
            });
          } else {
            this.render();
            const newList = this.container.querySelector('.layer-buttons-list');
            if (newList) {
              gsap.from(newList, { height: 0, opacity: 0, duration: 0.2 });
            }
          }
        } else {
          this.render();
        }
      };
    }

    this.container.querySelectorAll('.layer-select-btn').forEach(btn => {
      btn.onclick = () => {
        const layerId = btn.dataset.layerId;
        store.setActiveLayer(layerId);
      };
    });

    this.container.querySelectorAll('.toggle-vis').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const layerId = btn.dataset.layerId;
        store.toggleLayerVisibility(layerId);
      };
    });

    this.container.querySelectorAll('.toggle-lock').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const layerId = btn.dataset.layerId;
        store.toggleLayerLock(layerId);
      };
    });

    const fowToggleBtn = this.container.querySelector('#btn_toggle_fow_layer');
    if (fowToggleBtn) {
      fowToggleBtn.onclick = () => {
        store.toggleFogOfWar();
      };
    }

    const fowSlider = this.container.querySelector('#input_fow_opacity');
    if (fowSlider) {
      fowSlider.oninput = (e) => {
        store.setFogExploredOpacity(parseInt(e.target.value, 10) / 100);
      };
    }

    const fowResetBtn = this.container.querySelector('#btn_reset_fow');
    if (fowResetBtn) {
      fowResetBtn.onclick = () => {
        store.resetMapFog();
        store.addCombatLog({
          type: 'INFO',
          title: '🌫️ NIEBLA REINICIADA',
          details: 'La exploración del mapa ha sido reiniciada a oscuridad completa.'
        });
      };
    }

    const fowRevealBtn = this.container.querySelector('#btn_reveal_fow');
    if (fowRevealBtn) {
      fowRevealBtn.onclick = () => {
        store.revealMapFog();
        store.addCombatLog({
          type: 'INFO',
          title: '👁️ MAPA REVELADO',
          details: 'Toda la niebla del mapa ha sido revelada por el Keeper.'
        });
      };
    }
  }
}
