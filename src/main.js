import './sessionUI.css';
import './diceTray.css';
import './colorPicker.css';
import './chat.css';
import { ChatPanel } from './chatPanel.js';
import { initWaterControls } from './waterControls.js';
import './waterControls.css';
import './help.css';
import { APP_LABEL } from './version.js';
import { initSessionBar, openSessionLobby } from './sessionLobby.js';
import './dossiers.css';
import { openSessionManager } from './sessionManager.js';
import { LOCAL_ONLY } from './runtimeMode.js';
import { sanitizeHTML, confirmAction, notify } from './ui.js';
// src/main.js
// Application entry point for VEILVTT

import { initOrbitalUI } from './orbitalUI.js';
import { store } from './state.js';
import { audio } from './audioEngine.js';
import { network } from './networkManager.js';
import { CanvasEngine } from './canvasEngine.js';
import { FearMeterHUD } from './fearMeter.js';
import { ClocksManager } from './clocksManager.js';
import { TokenHUD } from './tokenSheet.js';
import { DiceRollerSidebar } from './diceRoller.js';
import { SceneManager } from './sceneManager.js';
import { RosterManager } from './rosterManager.js';
import { CombatLogView } from './combatLog.js';
import { LayerManagerHUD } from './layerManager.js';
import { HandoutManager } from './handoutManager.js';
import { ElementInspectorHUD } from './inspectorHUD.js';
import { GridScalerHUD } from './gridScalerHUD.js';
import { StarshipManager } from './starshipManager.js';
import { RulesCompendiumModal } from './rulesCompendium.js';
import { undoManager } from './undoManager.js';

window.addEventListener('DOMContentLoaded', async () => {
  await store.ready;
  initOrbitalUI();
  const helpButton = document.getElementById('help_btn');
  helpButton.title = `Ayuda y changelog · ${APP_LABEL}`;
  helpButton.onclick = () => import('./help.js').then(({ openHelp }) => openHelp()).catch(error => notify(`No se pudo abrir la ayuda: ${error.message}`, 'error'));
  // 1. Initialize Canvas Engine
  const canvasEl = document.getElementById('tactical_canvas');
  const canvasEngine = new CanvasEngine(canvasEl);
  window.veilCanvas = canvasEngine;

  // 2. Initialize Header Fear Meter
  const fearContainer = document.getElementById('fear_meter_container');
  new FearMeterHUD(fearContainer);

  // 3. Initialize Floating Clocks Overlay
  const clocksOverlay = document.getElementById('clocks_layer_overlay');
  const clocksManager = new ClocksManager(clocksOverlay);

  // 4. Initialize Token Floating Quickbar
  const quickbarContainer = document.getElementById('token_quickbar_root');
  window.veilTokenHUD = new TokenHUD(quickbarContainer);

  // 5. Initialize Tactical Layers HUD
  const layerContainer = document.getElementById('layer_hud_container');
  new LayerManagerHUD(layerContainer);

  // 6. Initialize Element Inspector HUD (Walls, Lights, Water, Anomalies)
  const inspectorContainer = document.getElementById('element_inspector_root');
  new ElementInspectorHUD(inspectorContainer);

  // 6b. Initialize Tactical Grid Scaler & Calibration HUD
  const gridScalerContainer = document.getElementById('grid_scaler_root');
  if (gridScalerContainer) new GridScalerHUD(gridScalerContainer);

  // 7. Initialize Sidebar Tabs
  const dicePane = document.getElementById('tab_pane_dice');
  new DiceRollerSidebar(dicePane);

  const rosterPane = document.getElementById('tab_pane_roster');
  new RosterManager(rosterPane);

  const scenesPane = document.getElementById('tab_pane_scenes');
  new SceneManager(scenesPane);

  const handoutsPane = document.getElementById('tab_pane_handouts');
  new HandoutManager(handoutsPane);

  const logPane = document.getElementById('tab_pane_log');
  new CombatLogView(logPane);
  new ChatPanel(document.getElementById('tab_pane_chat'));

  // Starship tab inside sidebar
  const shipPane = document.getElementById('tab_pane_ship');
  if (shipPane) new StarshipManager(shipPane);

  // Clocks tab inside sidebar
  const clocksPane = document.getElementById('tab_pane_clocks');
  renderClocksSidebarPane(clocksPane, clocksManager);

  // Rules Compendium Modal
  const rulesBtn = document.getElementById('rules_modal_btn');
  const compendium = new RulesCompendiumModal();
  if (rulesBtn) {
    rulesBtn.onclick = () => compendium.open();
  }

  // 8. Setup UI Event Listeners
  setupUndoRedoEvents();
  setupHeaderEvents();
  setupToolbarEvents();
  setupSidebarTabNavigation();
  setupKeyboardShortcuts();
  initSessionBar();
  window.addEventListener("veil:remote-roll", event => { if (store.state.dice3d !== false && event.detail.actorId !== store.state.claimedTokenId) import("./diceTray3d.js").then(({ openDiceTray }) => openDiceTray(event.detail)).catch(() => {}); });
  setupAutoJoinFromURL();
});

// --- Clocks Tab Pane ---
function renderClocksSidebarPane(paneEl, clocksManager) {
  function update() {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';
    const visibleClocks = state.clocks.filter(c => isKeeper || !c.isKeeperOnly);

    paneEl.innerHTML = sanitizeHTML(`
      <div class="clocks-sidebar-content">
        <div class="sidebar-header-row">
          <span class="sidebar-title">MISSION CLOCKS (${visibleClocks.length})</span>
          ${isKeeper ? `
            <button class="hud-btn hud-btn-xs hud-btn-primary" id="deploy_new_clock_btn">+ DEPLOY CLOCK</button>
          ` : ''}
        </div>

        <p class="modal-intro" style="margin: 8px 0;">
          Drag any clock freely. Use arrow keys for precise movement. Expand it to adjust progress.
        </p>

        <button class="hud-btn clock-arrange-btn" id="arrange_clocks_btn">ARRANGE ON MAP</button>
        <div class="scene-cards-list">
          ${visibleClocks.map(c => `
            <div class="log-card glass-panel" style="border-left: 3px solid ${c.isKeeperOnly ? 'var(--purple-void)' : 'var(--cyan-pearl)'};">
              <div class="log-card-header">
                <span style="font-weight: 700; color: #fff;">${c.title}</span>
                ${isKeeper ? `
                  <button class="clock-badge-btn ${c.isKeeperOnly ? 'clock-badge-keeper' : 'clock-badge-shared'} clock-sidebar-toggle-vis" data-id="${c.id}" title="Click to Toggle GM Private vs Shared">
                    ${c.isKeeperOnly ? '🔒 PRIVATE' : '📡 SHARED'}
                  </button>
                ` : `
                  <span class="clock-badge-shared">SHARED</span>
                `}
              </div>
              <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-top: 6px;">
                <span style="font-family: var(--font-display); font-size: 14px; font-weight: 700;">${c.filled} / ${c.segments} SEGMENTS</span>
                ${isKeeper ? `
                  <div style="display: flex; gap: 4px;">
                    <button class="hud-btn hud-btn-xs clock-sidebar-step-up" data-id="${c.id}">+1</button>
                    <button class="hud-btn hud-btn-xs hud-btn-danger clock-sidebar-del" data-id="${c.id}">✕</button>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `);

    paneEl.querySelector('#arrange_clocks_btn').onclick = () => clocksManager.arrangeClocks();
    if (isKeeper) {
      const deployBtn = paneEl.querySelector('#deploy_new_clock_btn');
      if (deployBtn) {
        deployBtn.onclick = () => clocksManager.openCreateModal();
      }

      paneEl.querySelectorAll('.clock-sidebar-toggle-vis').forEach(btn => {
        btn.onclick = () => {
          const clock = store.getState().clocks.find(c => c.id === btn.dataset.id);
          if (clock) {
            const newPrivate = !clock.isKeeperOnly;
            store.updateClock(btn.dataset.id, { isKeeperOnly: newPrivate });
            network.broadcast({ type: 'CLOCK_UPDATE', clockId: btn.dataset.id, partial: { isKeeperOnly: newPrivate } });
            audio.playClockTick();
          }
        };
      });

      paneEl.querySelectorAll('.clock-sidebar-step-up').forEach(btn => {
        btn.onclick = () => {
          store.advanceClock(btn.dataset.id, 1);
          audio.playClockTick();
        };
      });

      paneEl.querySelectorAll('.clock-sidebar-del').forEach(btn => {
        btn.onclick = async () => {
          if (await confirmAction('Delete this progress clock?')) {
            store.deleteClock(btn.dataset.id);
          }
        };
      });
    }
  }

  update();
  store.subscribe((state, keys) => {
    if (keys.includes('clocks') || keys.includes('userRole')) {
      update();
    }
  });
}

// --- Header Events ---
function setupHeaderEvents() {
  const sceneSelect = document.getElementById('quick_scene_select');
  const roleKeeperBtn = document.getElementById('role_keeper_btn');
  const rolePlayerBtn = document.getElementById('role_player_btn');
  const netBtn = document.getElementById('network_modal_btn');
  const audioBtn = document.getElementById('audio_toggle_btn');
  const dataBtn = document.getElementById('data_menu_btn');

  // Populate Scenes dropdown
  function updateScenesList() {
    const state = store.getState();
    sceneSelect.innerHTML = sanitizeHTML(state.maps.map(m => `
      <option value="${m.id}" ${m.id === state.activeMapId ? 'selected' : ''}>
        SCENE: ${m.name}
      </option>
    `).join(''));
  }
  updateScenesList();

  sceneSelect.onchange = (e) => {
    const id = e.target.value;
    store.switchScene(id);
    network.broadcast({ type: 'MAP_CHANGE', mapId: id });
  };

  store.subscribe((state, keys) => {
    if (keys.includes('maps') || keys.includes('activeMapId')) {
      updateScenesList();
    }
  });

  // Role toggle
  roleKeeperBtn.onclick = () => {
    if(store.sessionRole==='player'){notify('Only the host can use Keeper controls.');return;}
    roleKeeperBtn.classList.add('active');
    rolePlayerBtn.classList.remove('active');
    store.update({ userRole: 'keeper', gmVision: true });
    updateKeeperUIVisibility(true);
  };

  const previewPlayer = () => {
    rolePlayerBtn.classList.add('active');
    roleKeeperBtn.classList.remove('active');
    store.update({ userRole: 'player', gmVision: false, activeTool: 'select', activeLayer: 'tokens', ...(store.sessionRole !== 'player' ? { claimedTokenId: store.state.selectedTokenId || store.state.claimedTokenId } : {}) });
    updateKeeperUIVisibility(false);
  };
  rolePlayerBtn.onclick = () => {
    if (!LOCAL_ONLY && store.sessionRole === 'local') {
      openSessionLobby('', { joinOnly: true, previewPlayer });
    } else {
      previewPlayer();
    }
  };

  // Audio Toggle
  audioBtn.onclick = () => {
    const isMuted = audio.toggleMute();
    audioBtn.textContent = isMuted ? '🔇' : '🔊';
    audioBtn.classList.toggle('hud-btn-danger', isMuted);
  };

  // Multiplayer Modal
  netBtn.onclick = () => openMultiplayerModal();

  // Campaign Data Export / Import Modal
  dataBtn.onclick = () => openDataModal();
}

function updateKeeperUIVisibility(isKeeper) {
  document.querySelectorAll('.keeper-only-tool').forEach(el => {
    el.style.display = isKeeper ? 'flex' : 'none';
  });
}

// --- Toolbar Events ---
function setupToolbarEvents() {
  const tools = ['select', 'measure', 'template', 'fx', 'ping', 'wall', 'light', 'fx_emitter', 'water'];
  const templateFlyout = document.getElementById('template_flyout');
  const fxFlyout = document.getElementById('fx_flyout');
  const waterFlyout = document.getElementById('water_flyout');

  tools.forEach(toolName => {
    const btn = document.getElementById(`tool_${toolName}`);
    if (btn) {
      btn.onclick = () => {
        document.querySelectorAll('.left-toolbar .tool-btn').forEach(b => {
          if (b.dataset.tool) b.classList.remove('active');
        });
        btn.classList.add('active');
        store.update({ activeTool: toolName });

        // Show/hide flyouts
        if (templateFlyout) {
          templateFlyout.style.display = toolName === 'template' ? 'flex' : 'none';
        }
        if (fxFlyout) {
          fxFlyout.style.display = toolName === 'fx' ? 'flex' : 'none';
        }
        if (waterFlyout) {
          waterFlyout.style.display = toolName === 'water' ? 'flex' : 'none';
        }
      };
    }
  });

  // Grid Scaler & Calibration HUD Toggle Button
  const gridScaleBtn = document.getElementById('tool_grid_scale');
  if (gridScaleBtn) {
    gridScaleBtn.onclick = () => {
      const state = store.getState();
      const isCurrentlyScale = state.activeTool === 'grid_scale';
      const nextTool = isCurrentlyScale ? 'select' : 'grid_scale';
      store.update({ activeTool: nextTool });

      document.querySelectorAll('.left-toolbar .tool-btn').forEach(b => {
        if (b.dataset.tool) b.classList.toggle('active', b.dataset.tool === nextTool);
      });
      gridScaleBtn.classList.toggle('active', nextTool === 'grid_scale');

      window.dispatchEvent(new CustomEvent('veil:toggle_grid_scaler', { detail: { force: nextTool === 'grid_scale' } }));
      audio.playClockTick();
    };
  }

  // Template Shape Selector Buttons
  if (templateFlyout) {
    templateFlyout.querySelectorAll('.flyout-btn').forEach(btn => {
      btn.onclick = () => {
        templateFlyout.querySelectorAll('.flyout-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const shape = btn.dataset.shape;
        store.update({ activeTool: 'template', templateShape: shape, activeTemplateType: shape });

        // Activate template tool in toolbar UI
        document.querySelectorAll('.left-toolbar .tool-btn').forEach(b => {
          if (b.dataset.tool) b.classList.toggle('active', b.dataset.tool === 'template');
        });

        // Transform currently active or selected template immediately
        const cv = window.veilCanvas;
        if (cv) {
          if (cv.activeTemplate) {
            cv.activeTemplate.type = shape;
          } else {
            const s = store.getState();
            const tmpl = cv.templates.find(t => t.id === s.selectedTemplateId);
            if (tmpl) {
              tmpl.type = shape;
              cv.activeTemplate = tmpl;
            }
          }
        }
      };
    });
  }

  // FX Type Selector Buttons
  if (fxFlyout) {
    fxFlyout.querySelectorAll('.flyout-btn').forEach(btn => {
      if (btn.id === 'btn_fx_quality') return;
      btn.onclick = () => {
        fxFlyout.querySelectorAll('.flyout-btn').forEach(b => {
          if (b.id !== 'btn_fx_quality') b.classList.remove('active');
        });
        btn.classList.add('active');
        const fxType = btn.dataset.fx;
        store.update({ activeFxType: fxType });
      };
    });

    // FX Performance Quality Toggle (Eco / Balanced / Ultra)
    const fxQualityBtn = document.getElementById('btn_fx_quality');
    if (fxQualityBtn) {
      let currentQuality = store.getState().fxQuality || 'balanced';
      window.veilCanvas?.fx.setQuality(currentQuality);
      fxQualityBtn.textContent = currentQuality === 'eco' ? 'Eco' : currentQuality === 'ultra' ? 'Ultra' : 'Balanced';
      fxQualityBtn.onclick = (e) => {
        e.stopPropagation();
        if (currentQuality === 'balanced') currentQuality = 'eco';
        else if (currentQuality === 'eco') currentQuality = 'ultra';
        else currentQuality = 'balanced';

        window.veilCanvas?.fx.setQuality(currentQuality);
        store.update({ fxQuality: currentQuality });
        const labels = {
          eco: '⚡ Eco (Mínimo Consumo de CPU/GPU)',
          balanced: 'Balanced (Equilibrado)',
          ultra: 'Ultra (Mayor detalle)'
        };
        fxQualityBtn.textContent = currentQuality === 'eco' ? '⚡ Eco' : currentQuality === 'balanced' ? '⚡ Bal' : '⚡ Max';
        fxQualityBtn.title = `Rendimiento de Efectos: ${labels[currentQuality]}`;
        audio.playClockTick();
      };
    }
  }

  initWaterControls();

  // GM Vision Toggle
  const gmVisionBtn = document.getElementById('toggle_gm_vision');
  if (gmVisionBtn) {
    gmVisionBtn.onclick = () => {
      const state = store.getState();
      const newVal = !state.gmVision;
      store.update({ gmVision: newVal });
      gmVisionBtn.classList.toggle('active', newVal);
      gmVisionBtn.title = newVal ? '[Keeper] GM Vision Active (Full Brightness)' : '[Keeper] Player Perspective Active (Dynamic Fog)';
    };
  }

  // Fog of War Toggle
  const fogBtn = document.getElementById('toggle_fog_of_war');
  if (fogBtn) {
    fogBtn.onclick = () => {
      const state = store.getState();
      const newVal = !state.fogOfWar;
      store.update({ fogOfWar: newVal });
      fogBtn.classList.toggle('active', newVal);
      fogBtn.title = newVal ? '[Keeper] Fog of War Activa (Zonas inexploradas oscuras) [Shift+F]' : '[Keeper] Fog of War Desactivada [Shift+F]';
      audio.playClockTick();
    };
  }

  // Grid Toggle
  const gridBtn = document.getElementById('toggle_grid');
  if (gridBtn) {
    gridBtn.onclick = () => {
      const state = store.getState();
      const newVal = !state.showGrid;
      store.update({ showGrid: newVal });
      gridBtn.classList.toggle('active', newVal);
      audio.playClockTick();
    };
  }

  // Snap Controls and Sub-Flyout
  const snapBtn = document.getElementById('toggle_snap');
  const snapFlyout = document.getElementById('snap_flyout');
  const snapToggleGrid = document.getElementById('snap_toggle_grid');
  const snapToggleAnchors = document.getElementById('snap_toggle_anchors');
  const snapToggleObjects = document.getElementById('snap_toggle_objects');

  const updateSnapUI = () => {
    const s = store.getState();
    const hasAny = (s.snapToGrid !== false && s.gridSnap !== false) || s.snapToAnchors !== false || !!s.snapToObjects;
    if (snapBtn) snapBtn.classList.toggle('active', hasAny);
    if (snapToggleGrid) snapToggleGrid.classList.toggle('active', s.snapToGrid !== false && s.gridSnap !== false);
    if (snapToggleAnchors) snapToggleAnchors.classList.toggle('active', s.snapToAnchors !== false);
    if (snapToggleObjects) snapToggleObjects.classList.toggle('active', !!s.snapToObjects);
  };

  if (snapBtn && snapFlyout) {
    snapBtn.onclick = (e) => {
      e.stopPropagation();
      const isVisible = snapFlyout.style.display === 'flex';
      snapFlyout.style.display = isVisible ? 'none' : 'flex';
      updateSnapUI();
    };

    if (snapToggleGrid) {
      snapToggleGrid.onclick = (e) => {
        e.stopPropagation();
        const s = store.getState();
        const cur = s.snapToGrid !== false && s.gridSnap !== false;
        store.update({ snapToGrid: !cur, gridSnap: !cur });
        audio.playClockTick();
        updateSnapUI();
      };
    }

    if (snapToggleAnchors) {
      snapToggleAnchors.onclick = (e) => {
        e.stopPropagation();
        const s = store.getState();
        const cur = s.snapToAnchors !== false;
        store.update({ snapToAnchors: !cur });
        audio.playClockTick();
        updateSnapUI();
      };
    }

    if (snapToggleObjects) {
      snapToggleObjects.onclick = (e) => {
        e.stopPropagation();
        const s = store.getState();
        const cur = !!s.snapToObjects;
        store.update({ snapToObjects: !cur });
        audio.playClockTick();
        updateSnapUI();
      };
    }

    // Close flyout when clicking outside
    document.addEventListener('click', (e) => {
      if (!snapFlyout.contains(e.target) && e.target !== snapBtn) {
        snapFlyout.style.display = 'none';
      }
    });

    updateSnapUI();
  }

  // Reactive toolbar synchronization
  store.subscribe((state, keys) => {
    if (keys.includes('showGrid') && gridBtn) {
      gridBtn.classList.toggle('active', !!state.showGrid);
    }
    if (keys.includes('snapToGrid') || keys.includes('gridSnap') || keys.includes('snapToAnchors') || keys.includes('snapToObjects')) {
      updateSnapUI();
    }
    if (keys.includes('activeTool')) {
      document.querySelectorAll('.left-toolbar .tool-btn').forEach(b => {
        if (b.dataset.tool) b.classList.toggle('active', b.dataset.tool === state.activeTool);
      });
      if (gridScaleBtn) gridScaleBtn.classList.toggle('active', state.activeTool === 'grid_scale');
    }
  });

  // Mobile Toolbar Collapse / Expand
  const mobToggle = document.getElementById('toggle_mobile_toolbar');
  const leftToolbar = document.getElementById('main_left_toolbar');
  if (mobToggle && leftToolbar) {
    mobToggle.onclick = (e) => {
      e.stopPropagation();
      leftToolbar.classList.toggle('collapsed');
      mobToggle.classList.toggle('active', leftToolbar.classList.contains('collapsed'));
    };
  }
}

// --- Sidebar Tab Navigation & Tablet/Mobile Drawer ---
function setupSidebarTabNavigation() {
  const tabs = document.querySelectorAll('.tab-nav-btn');
  const panes = {
    dice: document.getElementById('tab_pane_dice'),
    clocks: document.getElementById('tab_pane_clocks'),
    ship: document.getElementById('tab_pane_ship'),
    roster: document.getElementById('tab_pane_roster'),
    scenes: document.getElementById('tab_pane_scenes'),
    handouts: document.getElementById('tab_pane_handouts'),
    log: document.getElementById('tab_pane_log'),
    chat: document.getElementById('tab_pane_chat')
  };

  const sidebarEl = document.getElementById('main_right_sidebar');
  const sidebarBackdrop = document.getElementById('sidebar_backdrop');
  const sidebarToggleBtn = document.getElementById('btn_toggle_sidebar');
  const sidebarCloseBtn = document.getElementById('sidebar_close_btn');

  const openSidebarDrawer = () => {
    if (sidebarEl) sidebarEl.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('hidden');
    if (sidebarToggleBtn) sidebarToggleBtn.classList.add('active');
  };

  const closeSidebarDrawer = () => {
    if (sidebarEl) sidebarEl.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
    if (sidebarToggleBtn) sidebarToggleBtn.classList.remove('active');
  };

  if (sidebarToggleBtn) {
    sidebarToggleBtn.onclick = (e) => {
      e.stopPropagation();
      if (sidebarEl && sidebarEl.classList.contains('open')) {
        closeSidebarDrawer();
      } else {
        openSidebarDrawer();
      }
    };
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.onclick = (e) => {
      e.stopPropagation();
      closeSidebarDrawer();
    };
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.onclick = () => {
      closeSidebarDrawer();
    };
  }

  window.addEventListener('veil:open_sidebar_tab', (e) => {
    const tabName = e.detail?.tab;
    if (tabName) {
      const targetTabBtn = document.querySelector(`.tab-nav-btn[data-tab="${tabName}"]`);
      if (targetTabBtn) targetTabBtn.click();
      if (window.innerWidth <= 1024) {
        openSidebarDrawer();
      }
    }
  });

  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetKey = tab.dataset.tab;

      Object.keys(panes).forEach(k => {
        if (panes[k]) {
          panes[k].style.display = k === targetKey ? 'block' : 'none';
        }
      });
    };
  });
}

// --- Keyboard Shortcuts ---
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if(e.defaultPrevented || e.target.closest?.('vf-select,.orbital-listbox,.veil-modal-backdrop,[contenteditable="true"]'))return;
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT') {
      return;
    }

    const key = e.key.toLowerCase();
    // Undo & Redo Shortcuts (up to 20 steps)
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        undoManager.redo();
      } else {
        undoManager.undo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'y') {
      e.preventDefault();
      undoManager.redo();
      return;
    }

    if (key === 'm' || key === 'v') document.getElementById('tool_select')?.click();
    if (key === 'r') document.getElementById('tool_measure')?.click();
    if (key === 't') document.getElementById('tool_template')?.click();
    if (key === 'x') document.getElementById('tool_fx')?.click();
    if (key === 'p') document.getElementById('tool_ping')?.click();
    if (key === 'w' && store.getState().userRole === 'keeper') document.getElementById('tool_wall')?.click();
    if (key === 'l' && store.getState().userRole === 'keeper') document.getElementById('tool_light')?.click();
    if (key === 'e' && store.getState().userRole === 'keeper') document.getElementById('tool_fx_emitter')?.click();
    if (key === 'u' && store.getState().userRole === 'keeper') document.getElementById('tool_water')?.click();
    if (e.shiftKey && key === 'g' && store.getState().userRole === 'keeper') {
      document.getElementById('tool_grid_scale')?.click();
      return;
    }
    if (e.shiftKey && key === 'f' && store.getState().userRole === 'keeper') {
      document.getElementById('toggle_fog_of_war')?.click();
      return;
    }
    if (key === 'g') document.getElementById('toggle_grid')?.click();
  });
}

// --- Multiplayer Modal ---
function openMultiplayerModal() { return openSessionLobby(); }
function setupAutoJoinFromURL() {
  if (LOCAL_ONLY) return;
  const searchParams = new URLSearchParams(location.search);
  const joinParam = searchParams.get('join') || searchParams.get('room');
  const hashInvite = new URLSearchParams(location.hash.slice(1)).get('invite');
  const searchInvite = searchParams.get('invite');

  if (joinParam) {
    // Fase 1: Enrutamiento directo por URL — forzar automáticamente rol a player para invitados
    store.update({ userRole: 'player' });

    let fullCode = joinParam;
    if (joinParam.includes('.')) {
      fullCode = joinParam;
    } else if (hashInvite || searchInvite) {
      fullCode = `${joinParam}.${hashInvite || searchInvite}`;
    }

    openSessionLobby(fullCode, { joinOnly: true });
  }
}

// --- Data Export / Import Modal ---
function openDataModal() { return openSessionManager(); }

// --- Undo & Redo System (Up to 20 Tactical Steps) ---
function setupUndoRedoEvents() {
  const headerUndoBtn = document.getElementById('header_btn_undo');
  const headerRedoBtn = document.getElementById('header_btn_redo');
  const headerBadge = document.getElementById('header_undo_badge');
  const toolUndoBtn = document.getElementById('tool_undo');
  const toolRedoBtn = document.getElementById('tool_redo');

  const handleUndo = () => {
    undoManager.undo();
  };

  const handleRedo = () => {
    undoManager.redo();
  };

  if (headerUndoBtn) headerUndoBtn.onclick = handleUndo;
  if (headerRedoBtn) headerRedoBtn.onclick = handleRedo;
  if (toolUndoBtn) toolUndoBtn.onclick = handleUndo;
  if (toolRedoBtn) toolRedoBtn.onclick = handleRedo;

  function updateUndoRedoUI(e) {
    const detail = e?.detail || {
      undoCount: undoManager.getUndoCount(),
      redoCount: undoManager.getRedoCount(),
      maxSteps: undoManager.maxSteps,
      canUndo: undoManager.canUndo(),
      canRedo: undoManager.canRedo(),
      lastUndoDesc: undoManager.getLastUndoDescription()
    };

    const undoCount = detail.undoCount;
    const redoCount = detail.redoCount;
    const canUndo = detail.canUndo;
    const canRedo = detail.canRedo;
    const max = detail.maxSteps || 20;

    const undoTitle = canUndo
      ? `Deshacer: ${detail.lastUndoDesc || 'Acción táctica'} [Ctrl+Z] (${undoCount}/${max})`
      : `Deshacer [Ctrl+Z] (0/${max})`;

    const redoTitle = canRedo
      ? `Rehacer: ${detail.lastRedoDesc || 'Acción táctica'} [Ctrl+Y / Ctrl+Shift+Z] (${redoCount})`
      : `Rehacer [Ctrl+Y / Ctrl+Shift+Z]`;

    if (headerUndoBtn) {
      headerUndoBtn.disabled = !canUndo;
      headerUndoBtn.title = undoTitle;
      headerUndoBtn.classList.toggle('has-undo-actions', canUndo);
    }

    if (headerBadge) {
      headerBadge.textContent = `${undoCount}/${max}`;
      headerBadge.classList.toggle('active', canUndo);
    }

    if (headerRedoBtn) {
      headerRedoBtn.disabled = !canRedo;
      headerRedoBtn.title = redoTitle;
      headerRedoBtn.style.display = canRedo ? 'inline-flex' : 'none';
    }

    if (toolUndoBtn) {
      toolUndoBtn.disabled = !canUndo;
      toolUndoBtn.title = undoTitle;
      toolUndoBtn.classList.toggle('disabled', !canUndo);
    }

    if (toolRedoBtn) {
      toolRedoBtn.disabled = !canRedo;
      toolRedoBtn.title = redoTitle;
      toolRedoBtn.style.display = canRedo ? 'inline-flex' : 'none';
      toolRedoBtn.classList.toggle('disabled', !canRedo);
    }
  }

  window.addEventListener('veil:undo_stack_changed', updateUndoRedoUI);
  updateUndoRedoUI();
}
