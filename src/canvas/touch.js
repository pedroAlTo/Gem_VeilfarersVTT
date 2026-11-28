// Touch gestures on the map (split out of canvasEngine.js in v2.65.0): one finger drags or
// selects, two fingers pan and pinch to zoom.
import { store } from '../state.js';

export const touchMethods = {
  initTouchEvents() {
    let lastTouchDistance = 0;
    let isPinching = false;
    let pinchCenterWorld = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let longPressTimer = null;
    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;

    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    this.canvas.addEventListener('touchstart', (e) => {
      clearLongPress();

      if (e.touches.length === 2) {
        this.cancelWaterDrawing();
        isPinching = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        lastTouchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = this.canvas.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        pinchCenterWorld = this.screenToWorld(midX, midY);
        e.preventDefault();
      } else if (e.touches.length === 1) {
        isPinching = false;
        touchMoved = false;
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        // Double Tap Detection (Mobile & Tablets)
        const now = Date.now();
        const timeDiff = now - lastTapTime;
        const distFromLastTap = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);
        if (timeDiff < 480 && timeDiff > 40 && distFromLastTap < 48) {
          clearLongPress();
          if (e.cancelable) e.preventDefault();
          const rect = this.canvas.getBoundingClientRect();
          const sx = touch.clientX - rect.left;
          const sy = touch.clientY - rect.top;
          const world = this.screenToWorld(sx, sy);
          this.handleDoubleAction(world.x, world.y, e);
          lastTapTime = 0;
          return;
        }
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;
        lastTapTime = now;

        // Long Press Detection (Hold for 500ms)
        longPressTimer = setTimeout(() => {
          if (!touchMoved && !isPinching) {
            const rect = this.canvas.getBoundingClientRect();
            const sx = lastTouchX - rect.left;
            const sy = lastTouchY - rect.top;
            const world = this.screenToWorld(sx, sy);
            const state = store.getState();
            const map = store.getActiveMap() || {};
            const gridSize = map.gridSize || 64;
            const tokens = state.tokens.filter(t => t.mapId === state.activeMapId);

            for (let i = tokens.length - 1; i >= 0; i--) {
              const tok = tokens[i];
              const radius = (tok.size * gridSize) / 2;
              if (Math.hypot(world.x - tok.x, world.y - tok.y) <= radius) {
                if (window.veilTokenHUD) {
                  window.veilTokenHUD.openCharacterSheetModal(tok);
                }
                break;
              }
            }
          }
        }, 500);

        const mouseEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        this.canvas.dispatchEvent(mouseEvent);
        e.preventDefault();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && isPinching) {
        clearLongPress();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const curDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = this.canvas.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

        if (lastTouchDistance > 0 && pinchCenterWorld) {
          const factor = curDist / lastTouchDistance;
          this.zoom = Math.max(0.12, Math.min(4.5, this.zoom * factor));
          this.panX = midX - pinchCenterWorld.x * this.zoom;
          this.panY = midY - pinchCenterWorld.y * this.zoom;
          pinchCenterWorld = this.screenToWorld(midX, midY);
        }
        lastTouchDistance = curDist;
        e.preventDefault();
      } else if (e.touches.length === 1 && !isPinching) {
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;

        if (Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY) > 8) {
          touchMoved = true;
          clearLongPress();
        }

        const mouseEvent = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        this.canvas.dispatchEvent(mouseEvent);
        e.preventDefault();
      }
    }, { passive: false });

    const endTouch = (e) => {
      clearLongPress();
      if (e.type === 'touchcancel') this.cancelWaterDrawing();
      if (e.touches && e.touches.length < 2) {
        isPinching = false;
        lastTouchDistance = 0;
        pinchCenterWorld = null;
      }
      const mouseEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: lastTouchX,
        clientY: lastTouchY,
        button: 0
      });
      this.canvas.dispatchEvent(mouseEvent);
      window.dispatchEvent(mouseEvent);
      if (e.cancelable) e.preventDefault();
    };

    this.canvas.addEventListener('touchend', endTouch, { passive: false });
    this.canvas.addEventListener('touchcancel', endTouch, { passive: false });
  },
};
