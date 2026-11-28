// Setting up the map's input (split out of canvasEngine.js in v2.65.0): the tools, the
// subscriptions and every event listener. The big handlers live in their own modules:
// keyboard.js (onKeyDown), pointerDown.js (onMouseDown), pointerMove.js (onMouseMove),
// pointerUp.js (onMouseUp) and dropAndMenu.js (onDrop, onContextMenu).
import { FreehandTool } from '../freehand.js';
import { MapClipboard } from '../mapClipboard.js';
import { healedTokens } from '../healFX.js';
import { store } from '../state.js';
import { FogBrush } from '../fogBrush.js';
import { network } from '../networkManager.js';
import { notify } from '../ui.js';

export const inputMethods = {
  initEvents() {
    this.freehand = new FreehandTool(this, store, network, notify);
    this.fogBrush = new FogBrush(this, store);
    this.mapClipboard = new MapClipboard(store, network, this, notify);
    this.tokenUnsubscribe = store.subscribe(() => this.reconcileTokenDrag());
    // A token healed shows a small green effect (v2.43.1): on every screen, for tokens it can see.
    let healTokens = store.state.tokens, healMap = store.state.activeMapId;
    this.healUnsubscribe = store.subscribe((state, keys) => {
      if (Array.isArray(keys) && !keys.includes('tokens') && !keys.includes('activeMapId')) return;
      const sameScene = state.activeMapId === healMap;
      const healed = sameScene ? healedTokens(healTokens, state.tokens, state.activeMapId) : [];
      healTokens = state.tokens; healMap = state.activeMapId;
      if (!healed.length) return;
      const map = store.getActiveMap(), grid = map?.gridSize || 64, visible = store.getTokensForActiveMap();
      for (const h of healed) {
        const token = state.tokens.find(t => t.id === h.id);
        if (state.userRole !== 'keeper' && (!token || token.hidden || !this.isTokenVisibleToPlayers(token, visible, map))) continue;
        this.fx.heal.add({ x: h.x, y: h.y, diameter: h.size * grid, amount: h.amount });
      }
      this.requestRender?.();
    });
    const waterContext = s => JSON.stringify([s.campaignId,s.activeMapId,s.activeTool,s.waterDrawMode,s.userRole,s.activeLayer,s.layerVisibility.water,s.layerLocked.water]);
    let previousWaterContext = waterContext(store.state);
    this.waterUnsubscribe = store.subscribe(state => {
      const context = waterContext(state);
      if (context !== previousWaterContext) { previousWaterContext = context; this.cancelWaterDrawing(); }
    });
    window.addEventListener('blur', () => { this.cancelWaterDrawing(); this.cancelTokenDrag(); this.freehand.cancel(); this.isSpacePressed=false; this.isPanning=false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.cancelWaterDrawing(); this.cancelTokenDrag(); this.freehand.cancel(); } });
    this.canvas.addEventListener('pointercancel', () => { this.cancelWaterDrawing(); this.cancelTokenDrag(); this.freehand.cancel(); });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resize(), 120);
    });

    // Keyboard Hotkeys
    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.canvas.style.cursor = 'default';
      }
    });

    // Double-click handler (Desktop mouse)
    this.canvas.addEventListener('dblclick', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);
      this.handleDoubleAction(world.x, world.y, e);
    });

    // Drag and Drop Images directly onto Canvas
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      this.canvas.classList.add('canvas-drag-over');
    });

    this.canvas.addEventListener('dragleave', () => {
      this.canvas.classList.remove('canvas-drag-over');
    });

    this.canvas.addEventListener('drop', (e) => this.onDrop(e));

    // MOUSE DOWN
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));

    // MOUSE MOVE
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // MOUSE UP
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));

    // Zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const worldBefore = this.screenToWorld(sx, sy);
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.1, Math.min(10.0, this.zoom * zoomFactor));

      this.zoom = newZoom;
      this.panX = sx - worldBefore.x * newZoom;
      this.panY = sy - worldBefore.y * newZoom;
    }, { passive: false });

    // Context Menu (Right Click) cancels placement, deletes clicked template, or deletes clicked anchor/element
    this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
  },
};
