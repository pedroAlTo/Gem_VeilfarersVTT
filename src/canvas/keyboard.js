// The map's keyboard shortcuts (split out of initEvents in v2.65.0).
import { store } from '../state.js';
import { network } from '../networkManager.js';
import { audio } from '../audioEngine.js';
import { undoManager } from '../undoManager.js';
import { confirmAction, notify } from '../ui.js';

export const keyboardMethods = {
// The map's keyboard shortcuts (registered in initEvents).
  onKeyDown(e) {
    if(e.defaultPrevented || e.target.closest?.('vf-select,.orbital-listbox,.veil-modal-backdrop,[contenteditable="true"]'))return;
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (e.target.closest?.('button') && (e.key === 'Enter' || e.code === 'Space')) return;
      if (this.mapClipboard.keydown(e)) return;
      if (e.key === 'Escape') { this.cancelTokenDrag(); this.freehand.cancel(); }

      if (e.code === 'Space' && !e.repeat) {
        this.isSpacePressed = true;
        this.canvas.style.cursor = 'grab';
      }
      // Arrow keys move the selected token one square (V3), with the same rules as dragging it.
      const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (step && !e.ctrlKey && !e.metaKey && !e.altKey && this.nudgeSelectedToken(step[0], step[1])) { e.preventDefault(); return; }

      // Delete key deletes active area template or selected wall/light/water zone
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.state.selectedDrawingId) {
          e.preventDefault(); network.editDrawing('erase', { mapId: store.state.activeMapId, ids: [store.state.selectedDrawingId] }).catch(error => notify(error.message, 'error')); return;
        }
        if (e.key === 'Backspace' && this.canDrawWater() && this.waterPolyPoints.length) {
          e.preventDefault(); this.waterPolyPoints.pop(); this.waterDraftChanged(); return;
        }
        if (this.activeTemplate) {
          undoManager.pushCurrentState('Eliminar Plantilla de Área');
          this.templates = this.templates.filter(t => t.id !== this.activeTemplate.id);
          this.activeTemplate = null;
          audio.playClockTick();
          return;
        }
        const state = store.getState();
        if (state.selectedTokenId && (state.userRole === 'keeper' || store.canEditToken(state.selectedTokenId))) {
          const tok = state.tokens.find(t => t.id === state.selectedTokenId);
          if (tok) {
            e.preventDefault();
            if (e.shiftKey) {
              (async () => {
                const ok = await confirmAction(`¿Eliminar definitivamente al token "${tok.name}" de la campaña?`);
                if (ok) {
                  store.deleteToken(tok.id);
                  network.broadcast?.({ type: 'TOKEN_DELETE', tokenId: tok.id });
                  network.syncAll?.();
                  audio.playLaserShot();
                  notify(`🗑️ Token "${tok.name}" eliminado definitivamente.`);
                }
              })();
            } else {
              store.sendTokenToReserve(tok.id);
              network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId: tok.id, partial: { mapId: 'reserve', inReserve: true } });
              network.syncAll?.();
              audio.playClockTick();
              notify(`📦 "${tok.name}" retirado a la Reserva (Roster).`);
            }
            return;
          }
        }
        if (state.userRole === 'keeper') {
          if (state.selectedWallId) {
            store.deleteWall(state.selectedWallId);
            audio.playLaserShot();
          } else if (state.selectedLightId) {
            store.deleteLight(state.selectedLightId);
            audio.playLaserShot();
          } else if (state.selectedEffectId) {
            store.deleteEffect(state.selectedEffectId);
            audio.playLaserShot();
          } else if (state.selectedWaterId) {
            store.deleteWaterZone(state.selectedWaterId);
          }
        }
      }

      // Enter closes in-progress polygon water drawing
      if ((e.key === 'Enter' || e.code === 'Enter') && this.canDrawWater() && this.waterPolyPoints.length) {
        e.preventDefault(); this.finishWaterPolygon();
      }

      // Escape cancels template, ruler, wall, or water placement
      if (e.code === 'Escape') {
        this.activeTemplate = null;
        this.rulerStart = null;
        this.wallStart = null;
        this.cancelWaterDrawing();
        store.update({ selectedWallId: null, selectedLightId: null, selectedSwitchId: null, selectedWaterId: null, selectedEffectId: null, selectedTemplateId: null });
      }
    },
};
