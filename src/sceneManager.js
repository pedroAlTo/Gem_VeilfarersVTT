// src/sceneManager.js
// Tactical Scene, Campaign Arcs & Multi-Map Manager for Veilfarers VTT

import { openSceneCreator } from './sceneCreator.js';
import { sanitizeHTML, escapeHTML as e, confirmAction, notify } from './ui.js';
import { dossierDialog } from './dossierUI.js';
import { getCloudinaryConfig, uploadToCloudinary } from './cloudinaryService.js';
import { store } from './state.js';
import { network } from './networkManager.js';

export class SceneManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('maps') || keys.includes('activeMapId') || keys.includes('userRole') || keys.includes('arcs')) {
        this.render();
      }
    });
  }

  render() {
    const state = store.getState();
    const activeMap = store.getActiveMap() || { name: 'Escena actual', walls: [], lights: [], waterZones: [] };
    const isKeeper = state.userRole === 'keeper';
    const arcs = store.getArcs();
    const allMaps = state.maps || [];

    // Map all scenes in arcs and find any unassigned scenes
    const assignedMapIds = new Set(arcs.flatMap(a => a.sceneIds || []));
    const unassignedMaps = allMaps.filter(m => !assignedMapIds.has(m.id));

    this.container.innerHTML = sanitizeHTML(`
      <div class="scenes-sidebar-content">
        <div class="sidebar-header-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <span class="sidebar-title">ARCOS Y ESCENAS (${allMaps.length})</span>
          ${isKeeper ? `
            <div style="display:flex; gap:4px;">
              <button class="hud-btn hud-btn-xs hud-btn-secondary" id="add_arc_btn">+ NUEVO ARCO</button>
              <button class="hud-btn hud-btn-xs hud-btn-primary" id="add_map_btn">+ ESCENA</button>
            </div>
          ` : ''}
        </div>

        <p class="modal-intro" style="margin: 6px 0 12px; font-size: 11px; color: #94a3b8;">
          Organiza la campaña por arcos narrativos. Reordena escenas, asocia fichas, imágenes de inteligencia y ajusta el entorno táctico.
        </p>

        <!-- Arcs List -->
        <div class="campaign-arcs-container" style="display: flex; flex-direction: column; gap: 14px;">
          ${arcs.map((arc, arcIdx) => {
            const arcMaps = (arc.sceneIds || []).map(id => allMaps.find(m => m.id === id)).filter(Boolean);
            const arcTokens = (arc.tokenIds || []).map(id => state.tokens?.find(t => t.id === id)).filter(Boolean);
            const arcImages = arc.images || [];

            return `
              <div class="arc-card glass-panel" data-arc-id="${arc.id}" style="border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 8px; padding: 10px; background: rgba(13, 22, 38, 0.65);">
                <div class="arc-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; border-bottom: 1px solid rgba(0, 243, 255, 0.15); padding-bottom: 6px;">
                  <div>
                    <span style="font-family: var(--font-hud); font-size: 10px; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.08em;">ARCO NARRATIVO ${arcIdx + 1}</span>
                    <h4 style="margin: 2px 0 4px; color: #fff; font-size: 14px; font-family: var(--font-hud);">${e(arc.name)}</h4>
                    ${arc.description ? `<p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.3;">${e(arc.description)}</p>` : ''}
                    <div style="margin-top: 4px; font-size: 10px; color: var(--cyan-pearl); font-family: var(--font-mono, monospace);">
                      <span>🗺️ ${arcMaps.length} escenas</span> · <span>👤 ${arcTokens.length} tokens</span> · <span>🖼️ ${arcImages.length} imágenes</span>
                    </div>
                  </div>
                  ${isKeeper ? `
                    <div style="display:flex; gap:3px;">
                      <button class="hud-btn hud-btn-xs edit-arc-btn" data-arc-id="${arc.id}" title="Editar título y descripción del arco">✏️</button>
                      <button class="hud-btn hud-btn-xs hud-btn-primary add-scene-to-arc-btn" data-arc-id="${arc.id}" title="Crear nueva escena en este arco">+ Escena</button>
                      <button class="hud-btn hud-btn-xs attach-image-arc-btn" data-arc-id="${arc.id}" title="Adjuntar imagen de inteligencia / mapa a este arco">🖼️+</button>
                      ${arcs.length > 1 ? `
                        <button class="hud-btn hud-btn-xs hud-btn-danger delete-arc-btn" data-arc-id="${arc.id}" title="Eliminar este arco argumental">✕</button>
                      ` : ''}
                    </div>
                  ` : ''}
                </div>

                <!-- Scenes in this Arc -->
                <div class="arc-scenes-list" style="display: flex; flex-direction: column; gap: 8px;">
                  ${arcMaps.length === 0 ? `
                    <div style="padding: 10px; text-align: center; font-size: 11px; color: #64748b; background: rgba(15, 23, 42, 0.4); border-radius: 6px;">
                      Sin escenas en este arco. Pulsa "+ Escena" para añadir una.
                    </div>
                  ` : arcMaps.map((map, sceneIdx) => {
                    const isActive = map.id === state.activeMapId;
                    return `
                      <div class="scene-card ${isActive ? 'active' : ''}" data-id="${map.id}" style="background: ${isActive ? 'rgba(0, 243, 255, 0.08)' : 'rgba(15, 23, 42, 0.7)'}; border: 1px solid ${isActive ? '#00f3ff' : 'rgba(100, 116, 139, 0.3)'}; border-radius: 6px; padding: 6px; display: flex; gap: 8px; align-items: center;">
                        <div class="scene-card-preview" style="width: 50px; height: 50px; flex-shrink: 0; background-image: url('${map.imageUrl}'); background-size: cover; background-position: center; border-radius: 4px; border: 1px solid rgba(0, 243, 255, 0.2); position: relative;">
                          ${isActive ? '<span class="scene-active-tag" style="position: absolute; bottom: 2px; left: 2px; right: 2px; font-size: 8px; text-align: center; background: #00f3ff; color: #000; font-weight: bold; border-radius: 2px;">ACTIVA</span>' : ''}
                        </div>
                        <div class="scene-card-info" style="flex: 1; min-width: 0;">
                          <strong class="scene-card-name" style="display: block; color: #fff; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e(map.name)}</strong>
                          <div class="scene-card-meta" style="font-size: 10px; color: #94a3b8; display: flex; gap: 6px;">
                            <span>Rejilla: ${map.gridSize || 64}px</span>
                            <span>Muros: ${map.walls?.length || 0}</span>
                            <span>Luces: ${map.lights?.length || 0}</span>
                          </div>
                          ${isKeeper && arcs.length > 1 ? `
                            <div style="margin-top: 3px;">
                              <select class="hud-select hud-select-xs move-scene-arc-select" data-map-id="${map.id}" data-current-arc="${arc.id}" style="font-size: 9px; padding: 1px 4px; height: auto;">
                                ${arcs.map(a => `<option value="${a.id}" ${a.id === arc.id ? 'selected' : ''}>Arco: ${e(a.name.slice(0, 20))}</option>`).join('')}
                              </select>
                            </div>
                          ` : ''}
                        </div>
                        <div class="scene-card-actions" style="display: flex; flex-direction: column; gap: 3px; align-items: flex-end;">
                          <div style="display: flex; gap: 2px;">
                            ${isKeeper ? `
                              <button class="hud-btn hud-btn-xs reorder-scene-btn" data-arc-id="${arc.id}" data-map-id="${map.id}" data-dir="up" ${sceneIdx === 0 ? 'disabled' : ''} title="Mover arriba">▲</button>
                              <button class="hud-btn hud-btn-xs reorder-scene-btn" data-arc-id="${arc.id}" data-map-id="${map.id}" data-dir="down" ${sceneIdx === arcMaps.length - 1 ? 'disabled' : ''} title="Mover abajo">▼</button>
                            ` : ''}
                          </div>
                          <div style="display: flex; gap: 2px;">
                            ${isKeeper && !isActive ? `
                              <button class="hud-btn hud-btn-xs hud-btn-secondary switch-scene-btn" data-id="${map.id}" title="Desplegar escena">ENGAGE</button>
                            ` : ''}
                            ${isKeeper ? `
                              <button class="hud-btn hud-btn-xs hud-btn-danger delete-scene-btn" data-id="${map.id}" data-name="${e(map.name)}" title="Eliminar escena">🗑️</button>
                            ` : ''}
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- Arc Attached Images Gallery -->
                ${arcImages.length > 0 ? `
                  <div class="arc-images-strip" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
                    <span style="font-size: 9px; color: #94a3b8; font-family: var(--font-mono, monospace);">IMÁGENES DEL ARCO (${arcImages.length}):</span>
                    <div style="display: flex; gap: 6px; overflow-x: auto; margin-top: 4px; padding-bottom: 2px;">
                      ${arcImages.map(img => `
                        <div class="arc-img-thumb" style="position: relative; flex-shrink: 0; width: 44px; height: 44px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(0,243,255,0.3);">
                          <img src="${e(img.url)}" title="${e(img.name || 'Imagen de arco')}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('${e(img.url)}', '_blank')" />
                          ${isKeeper ? `<button class="hud-btn hud-btn-danger detach-img-btn" data-arc-id="${arc.id}" data-img-id="${img.id}" style="position: absolute; top: 0; right: 0; padding: 0 3px; font-size: 8px; line-height: 1;">✕</button>` : ''}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}

          <!-- Unassigned Scenes (if any) -->
          ${unassignedMaps.length > 0 ? `
            <div class="unassigned-scenes-card glass-panel" style="padding: 10px; border: 1px dashed rgba(245, 158, 11, 0.4); border-radius: 8px;">
              <span style="font-family: var(--font-hud); font-size: 11px; color: #fbbf24;">ESCENAS SIN ARCO ASIGNADO (${unassignedMaps.length})</span>
              <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
                ${unassignedMaps.map(m => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: rgba(15,23,42,0.6); border-radius: 4px;">
                    <span style="font-size: 11px; color: #fff;">${e(m.name)}</span>
                    <div style="display: flex; gap: 4px; align-items: center;">
                      ${arcs[0] ? `<button class="hud-btn hud-btn-xs move-scene-arc-btn" data-map-id="${m.id}" data-target-arc="${arcs[0].id}">Mover al Arco 1</button>` : ''}
                      <button class="hud-btn hud-btn-xs hud-btn-danger delete-scene-btn" data-id="${m.id}" data-name="${e(m.name)}">🗑️</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        ${isKeeper ? `
          <!-- Active Scene Environment Config -->
          <div class="scene-config-panel glass-panel" style="margin-top: 18px; border: 1px solid rgba(0, 243, 255, 0.35); border-radius: 8px; padding: 12px; background: rgba(10, 16, 28, 0.85);">
            <div class="config-header" style="font-family: var(--font-hud); font-size: 12px; font-weight: 700; color: var(--cyan-pearl); display: flex; justify-content: space-between; align-items: center;">
              <span>AJUSTES AMBIENTALES DEL SISTEMA</span>
              <span style="font-size: 10px; color: #94a3b8;">[${e(activeMap.name)}]</span>
            </div>

            <!-- Environmental Presets (1-Click) -->
            <div style="margin-top: 10px;">
              <label style="font-size: 10px; color: #38bdf8; font-family: var(--font-mono, monospace); display: block; margin-bottom: 4px;">
                PREAJUSTES DE ENTORNO (SISTEMA VEILFARERS):
              </label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                <button class="hud-btn hud-btn-xs env-preset-btn" data-preset="derelict" style="font-size: 10px; text-align: left;">🚀 Derrelicto Espacial</button>
                <button class="hud-btn hud-btn-xs env-preset-btn" data-preset="storm" style="font-size: 10px; text-align: left;">⛈️ Tormenta Planetaria</button>
                <button class="hud-btn hud-btn-xs env-preset-btn" data-preset="fog" style="font-size: 10px; text-align: left;">🌫️ Bruma Tensa</button>
                <button class="hud-btn hud-btn-xs env-preset-btn" data-preset="abyssal" style="font-size: 10px; text-align: left;">🌊 Brecha Abisal</button>
                <button class="hud-btn hud-btn-xs env-preset-btn" data-preset="highsec" style="font-size: 10px; text-align: left; grid-column: span 2;">💡 Instalación Alta Seguridad</button>
              </div>
            </div>

            <div class="form-group" style="margin-top: 12px;">
              <label>Luz Ambiental (Nivel de oscuridad: ${(100 - ((activeMap.ambientLight ?? 0.25) * 100)).toFixed(0)}%)</label>
              <input type="range" id="scene_ambient_slider" min="0" max="1" step="0.05" value="${activeMap.ambientLight ?? 0.25}" class="hud-slider" />
            </div>

            <div class="form-row" style="margin-top: 8px;">
              <div class="form-group" style="flex: 1.2;">
                <label>Tamaño Rejilla: <span style="color: var(--cyan-pearl);">${activeMap.gridSize || 64}px</span></label>
                <input type="range" id="scene_grid_size_slider" class="hud-slider" value="${activeMap.gridSize || 64}" min="24" max="250" />
              </div>
              <div class="form-group" style="flex: 0.8;">
                <label>Escala (m/casilla)</label>
                <input type="number" id="scene_grid_scale_meters" class="hud-input" value="${activeMap.gridScaleMeters || 2.0}" min="0.5" max="100" step="0.5" />
              </div>
            </div>

            <div style="margin-top: 8px; margin-bottom: 8px;">
              <button class="hud-btn hud-btn-xs hud-btn-primary" id="open_grid_scaler_btn" style="width: 100%; font-size: 11px; padding: 6px;">
                📐 ESCALAR Y CALIBRAR REJILLA EN EL MAPA
              </button>
            </div>

            <div class="form-row" style="margin-top: 10px;">
              <button class="hud-btn hud-btn-xs hud-btn-danger" id="clear_walls_btn">LIMPIAR MUROS</button>
              <button class="hud-btn hud-btn-xs hud-btn-secondary" id="clear_lights_btn">LIMPIAR LUCES</button>
              <button class="hud-btn hud-btn-xs hud-btn-cyan" id="add_water_zone_btn">+ ZONA DE AGUA</button>
            </div>

            <!-- Water Zones List in Scene -->
            <div class="scene-water-list" style="margin-top: 14px; border-top: 1px solid rgba(0, 243, 255, 0.2); padding-top: 10px;">
              <div style="font-family: var(--font-hud); font-size: 11px; font-weight: 700; color: var(--cyan-pearl); margin-bottom: 6px;">
                PELIGROS ACUÁTICOS (${activeMap.waterZones?.length || 0}) // PROFUNDIDAD 0-5
              </div>
              ${(activeMap.waterZones || []).map(w => `
                <div class="log-card glass-panel" style="margin-bottom: 6px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <span style="font-weight: 700; color: #fff;">${e(w.name)}</span>
                    <span style="font-size: 11px; color: #38bdf8; margin-left: 6px;">Prof. ${w.depth ?? 2}</span>
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

      // Add Arc Button
      const addArcBtn = this.container.querySelector('#add_arc_btn');
      if (addArcBtn) {
        addArcBtn.onclick = () => this.openCreateArcModal();
      }

      // Delete Scene buttons
      this.container.querySelectorAll('.delete-scene-btn').forEach(btn => {
        btn.onclick = async () => {
          const mapId = btn.dataset.id;
          const mapName = btn.dataset.name || 'esta escena';
          if (await confirmAction(`¿Eliminar definitivamente la escena "${mapName}"? Si está activa, los personajes se trasladarán a otra escena.`)) {
            try {
              store.deleteScene(mapId);
              notify(`🗑️ Escena "${mapName}" eliminada.`);
            } catch (err) {
              notify(err.message, 'error');
            }
          }
        };
      });

      // Move Scene Reorder buttons (up / down)
      this.container.querySelectorAll('.reorder-scene-btn').forEach(btn => {
        btn.onclick = () => {
          const arcId = btn.dataset.arcId;
          const mapId = btn.dataset.mapId;
          const dir = btn.dataset.dir;
          store.reorderScenes(arcId, dir, mapId);
        };
      });

      // Move Scene to Arc dropdown
      this.container.querySelectorAll('.move-scene-arc-select').forEach(sel => {
        sel.onchange = () => {
          const mapId = sel.dataset.mapId;
          const targetArcId = sel.value;
          store.moveSceneToArc(mapId, targetArcId);
          notify('Escena movida al arco seleccionado.');
        };
      });

      // Move orphan scene button
      this.container.querySelectorAll('.move-scene-arc-btn').forEach(btn => {
        btn.onclick = () => {
          store.moveSceneToArc(btn.dataset.mapId, btn.dataset.targetArc);
        };
      });

      // Add Scene to Arc
      this.container.querySelectorAll('.add-scene-to-arc-btn').forEach(btn => {
        btn.onclick = () => {
          openSceneCreator({ arcId: btn.dataset.arcId });
        };
      });

      // Edit Arc
      this.container.querySelectorAll('.edit-arc-btn').forEach(btn => {
        btn.onclick = () => {
          const arc = store.getArcs().find(a => a.id === btn.dataset.arcId);
          if (arc) this.openEditArcModal(arc);
        };
      });

      // Delete Arc
      this.container.querySelectorAll('.delete-arc-btn').forEach(btn => {
        btn.onclick = async () => {
          const arcId = btn.dataset.arcId;
          const arc = store.getArcs().find(a => a.id === arcId);
          if (await confirmAction(`¿Eliminar el arco "${arc?.name || 'este arco'}"? Las escenas asociadas se conservarán en los demás arcos.`)) {
            try {
              store.deleteArc(arcId);
              notify('Arco argumental eliminado.');
            } catch (err) {
              notify(err.message, 'error');
            }
          }
        };
      });

      // Attach Image to Arc
      this.container.querySelectorAll('.attach-image-arc-btn').forEach(btn => {
        btn.onclick = () => {
          const arcId = btn.dataset.arcId;
          this.openAttachImageModal(arcId);
        };
      });

      // Detach Image from Arc
      this.container.querySelectorAll('.detach-img-btn').forEach(btn => {
        btn.onclick = () => {
          store.detachImageFromArc(btn.dataset.arcId, btn.dataset.imgId);
        };
      });

      // Environmental Presets (1-Click)
      this.container.querySelectorAll('.env-preset-btn').forEach(btn => {
        btn.onclick = () => {
          this.applyEnvironmentPreset(btn.dataset.preset);
        };
      });

      // Environmental Sliders & Controls
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

      const clearWalls = this.container.querySelector('#clear_walls_btn');
      if (clearWalls) {
        clearWalls.onclick = async () => {
          if (await confirmAction('¿Eliminar todos los muros y barreras de esta escena?')) {
            store.updateActiveMap({ walls: [] });
          }
        };
      }

      const clearLights = this.container.querySelector('#clear_lights_btn');
      if (clearLights) {
        clearLights.onclick = async () => {
          if (await confirmAction('¿Eliminar todas las fuentes de luz de esta escena?')) {
            store.updateActiveMap({ lights: [] });
          }
        };
      }

      const addWaterBtn = this.container.querySelector('#add_water_zone_btn');
      if (addWaterBtn) {
        addWaterBtn.onclick = () => {
          store.addWaterZone({
            name: 'Peligro Acuático',
            x: 400,
            y: 350,
            width: 320,
            height: 220,
            depth: 3
          });
        };
      }

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
    }
  }

  applyEnvironmentPreset(preset) {
    const activeMap = store.getActiveMap();
    if (!activeMap) return;

    switch (preset) {
      case 'derelict':
        store.updateActiveMap({ ambientLight: 0.18, showRain: false });
        store.update({ fogOfWar: true, fogExploredOpacity: 0.50, showRain: false });
        notify('🚀 Ajuste aplicado: Derrelicto Espacial (Oscuridad profunda, Niebla de guerra al 50%).');
        break;
      case 'storm':
        store.updateActiveMap({ ambientLight: 0.35, showRain: true });
        store.update({ showRain: true, rainSpeed: 1.5, rainDirection: -0.3, rainIntensity: 'storm' });
        notify('⛈️ Ajuste aplicado: Tormenta Planetaria (Lluvia torrencial y rayos ambientales).');
        break;
      case 'fog':
        store.updateActiveMap({ ambientLight: 0.28, showRain: true });
        store.update({ fogOfWar: true, fogExploredOpacity: 0.35, showRain: true, rainIntensity: 'fog' });
        notify('🌫️ Ajuste aplicado: Bruma Tensa (Bruma climática y niebla de combate atenuada).');
        break;
      case 'abyssal':
        store.updateActiveMap({ ambientLight: 0.12, showRain: false });
        store.update({ fogOfWar: true, fogExploredOpacity: 0.40 });
        notify('🌊 Ajuste aplicado: Brecha Abisal (Oscuridad oceánica profunda y atenuación).');
        break;
      case 'highsec':
        store.updateActiveMap({ ambientLight: 0.88, showRain: false });
        store.update({ showRain: false, fogOfWar: false });
        notify('💡 Ajuste aplicado: Instalación Alta Seguridad (Iluminación máxima, visibilidad total).');
        break;
    }
  }

  openCreateArcModal() {
    const modal = dossierDialog('NUEVO ARCO ARGUMENTAL', `
      <span class="dossier-eyebrow">ESTRUCTURA DE CAMPAÑA</span>
      <h2>Crear Arco Narrativo</h2>
      <p class="dossier-muted">Agrupa escenas, personajes e imágenes en un capítulo o episodio de la campaña.</p>
      <form id="create_arc_form">
        <label class="dossier-field">Nombre del Arco
          <input class="hud-input" id="arc_name_input" required placeholder="Ej.: Arco 2: Infiltración en la Estación Minera" maxlength="150" />
        </label>
        <label class="dossier-field">Descripción / Objetivos
          <textarea class="hud-input" id="arc_desc_input" rows="3" placeholder="Objetivos principales, facciones implicadas y notas del Keeper..."></textarea>
        </label>
        <div class="session-actions" style="margin-top: 14px;">
          <button class="hud-btn hud-btn-primary" type="submit">Guardar y Crear Arco</button>
        </div>
      </form>
    `);

    modal.querySelector('#create_arc_form').onsubmit = (e) => {
      e.preventDefault();
      const name = modal.querySelector('#arc_name_input').value.trim();
      const description = modal.querySelector('#arc_desc_input').value.trim();
      if (!name) return;
      store.createArc({ name, description });
      modal.remove();
      notify(`📁 Arco "${name}" creado.`);
    };
  }

  openEditArcModal(arc) {
    const modal = dossierDialog('EDITAR ARCO', `
      <span class="dossier-eyebrow">CONFIGURACIÓN DE ARCO</span>
      <h2>${e(arc.name)}</h2>
      <form id="edit_arc_form">
        <label class="dossier-field">Nombre del Arco
          <input class="hud-input" id="edit_arc_name" required value="${e(arc.name)}" maxlength="150" />
        </label>
        <label class="dossier-field">Descripción / Notas
          <textarea class="hud-input" id="edit_arc_desc" rows="3">${e(arc.description || '')}</textarea>
        </label>
        <div class="session-actions" style="margin-top: 14px;">
          <button class="hud-btn hud-btn-primary" type="submit">Actualizar Arco</button>
        </div>
      </form>
    `);

    modal.querySelector('#edit_arc_form').onsubmit = (e) => {
      e.preventDefault();
      const name = modal.querySelector('#edit_arc_name').value.trim();
      const description = modal.querySelector('#edit_arc_desc').value.trim();
      store.updateArc(arc.id, { name, description });
      modal.remove();
      notify('Arco argumental actualizado.');
    };
  }

  openAttachImageModal(arcId) {
    const cConfig = getCloudinaryConfig();
    const modal = dossierDialog('ADJUNTAR IMAGEN AL ARCO', `
      <span class="dossier-eyebrow">RECURSOS NARRATIVOS // IMAGEN</span>
      <h2>Añadir Imagen o Mapa de Referencia</h2>
      <p class="dossier-muted">Sube una ilustración, mapa de sectores o archivo de inteligencia táctica para este arco.</p>
      <form id="attach_img_form">
        <label class="dossier-field">Título / Etiqueta de la Imagen
          <input class="hud-input" id="arc_img_title" required placeholder="Ej.: Mapa de Sector, Nave Enemiga, Esquema..." maxlength="100" />
        </label>
        <label class="dossier-drop" style="margin: 10px 0;">
          <strong>Seleccionar Archivo de Imagen</strong>
          <span>PNG, JPEG o WebP · ${cConfig.isConfigured ? 'Subida automática a Cloudinary' : 'Almacenamiento local'}</span>
          <input type="file" id="arc_img_file" accept="image/png,image/jpeg,image/webp" />
        </label>
        <label class="dossier-field">O URL Directa de Imagen
          <input class="hud-input" id="arc_img_url" type="url" placeholder="https://..." />
        </label>
        <p id="attach_status" style="font-size: 11px; color: var(--cyan-pearl);"></p>
        <div class="session-actions" style="margin-top: 12px;">
          <button class="hud-btn hud-btn-primary" type="submit" id="btn_save_arc_img">Adjuntar Imagen</button>
        </div>
      </form>
    `);

    const fileInput = modal.querySelector('#arc_img_file');
    const urlInput = modal.querySelector('#arc_img_url');
    const titleInput = modal.querySelector('#arc_img_title');
    const statusText = modal.querySelector('#attach_status');

    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (file && !titleInput.value) {
        titleInput.value = file.name.replace(/\.[^/.]+$/, '');
      }
    };

    modal.querySelector('#attach_img_form').onsubmit = async (e) => {
      e.preventDefault();
      const file = fileInput.files[0];
      let url = urlInput.value.trim();
      const title = titleInput.value.trim() || 'Imagen de arco';

      if (file) {
        if (cConfig.isConfigured) {
          try {
            statusText.textContent = 'Subiendo imagen a Cloudinary (Dossier_)...';
            const res = await uploadToCloudinary(file, p => { statusText.textContent = `Subiendo: ${p}%`; }, { prefix: 'Dossier_' });
            url = res.url;
          } catch (err) {
            statusText.textContent = 'Error Cloudinary. Convirtiendo a formato local...';
          }
        }
        if (!url) {
          url = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = re => resolve(re.target.result);
            reader.readAsDataURL(file);
          });
        }
      }

      if (!url) {
        notify('Por favor, selecciona un archivo o introduce una URL válida.', 'error');
        return;
      }

      store.attachImageToArc(arcId, { name: title, url, createdAt: Date.now() });
      modal.remove();
      notify(`🖼️ Imagen "${title}" vinculada al arco.`);
    };
  }

  openAddMapModal() { return openSceneCreator(); }
}
