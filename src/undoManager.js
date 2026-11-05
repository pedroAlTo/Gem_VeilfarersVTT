import { sanitizeHTML } from './ui.js';
// src/undoManager.js
// Tactical Undo & Redo Manager for Veilfarers VTT
// Supports up to 20 undo steps across all tactical elements:
// Tokens, Walls, Lights, Water Zones, Anomalies/FX, Blast Templates, Clocks, Fear & Grid Scale.

import { store } from './state.js';
import { audio } from './audioEngine.js';
import { network } from './networkManager.js';

class UndoManager {
  constructor() {
    this.maxSteps = 20;
    this.undoStack = [];
    this.redoStack = [];
    this.isRestoring = false;
    this._lastPushTime = 0;
    this._activeGroupKey = null;
    this._lastGroupTime = 0;
  }

  /**
   * Captures a snapshot of the current tactical state.
   * @param {string} description - Human-readable description of the action.
   * @returns {Object} Deep-cloned snapshot object.
   */
  captureSnapshot(description = 'Acción Táctica') {
    const state = store.getState();
    const map = store.getActiveMap();

    // Collect templates from canvasEngine if available
    let templatesCopy = [];
    if (typeof window !== 'undefined' && window.veilCanvas?.templates) {
      templatesCopy = window.veilCanvas.templates.map(t => ({ ...t }));
    }

    return {
      description,
      timestamp: Date.now(),
      maps: JSON.parse(JSON.stringify(state.maps || [])),
      tokens: JSON.parse(JSON.stringify(state.tokens || [])),
      clocks: JSON.parse(JSON.stringify(state.clocks || [])),
      fear: state.fear,
      activeMapId: state.activeMapId,
      starship: state.starship ? JSON.parse(JSON.stringify(state.starship)) : null,
      handouts: state.handouts ? JSON.parse(JSON.stringify(state.handouts)) : null,
      templates: templatesCopy
    };
  }

  /**
   * Pushes a pre-captured snapshot onto the undo stack.
   * Ensures maximum capacity of 20 steps, deduplicates no-op states, and resets redo stack.
   * @param {Object} snapshot - Pre-captured snapshot from captureSnapshot.
   * @param {string} [overrideDescription] - Optional updated description.
   */
  pushSnapshot(snapshot, overrideDescription = null) {
    if (this.isRestoring || !snapshot) return;

    if (overrideDescription) {
      snapshot.description = overrideDescription;
    }

    // Light check: compare state hash with last snapshot to avoid duplicate identical pushes
    const currentHash = this._hashState(snapshot);
    if (this.undoStack.length > 0) {
      const lastHash = this._hashState(this.undoStack[this.undoStack.length - 1]);
      if (currentHash === lastHash) {
        return; // No state change detected, skip
      }
    }

    this.undoStack.push(snapshot);

    // Enforce strict limit of up to 20 undo steps
    while (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }

    // Clear redo stack on new action
    this.redoStack = [];
    this._lastPushTime = Date.now();

    this._emitStackChanged();
  }

  /**
   * Captures the current state and pushes it onto the undo stack immediately.
   * Supports debouncing grouped edits (e.g. rapid slider inputs).
   * @param {string} description - Action description.
   * @param {string} [groupKey] - Optional identifier to group rapid updates into a single undo step.
   */
  pushCurrentState(description = 'Acción Táctica', groupKey = null) {
    if (this.isRestoring) return;

    const now = Date.now();
    if (groupKey && this._activeGroupKey === groupKey && (now - this._lastGroupTime < 600)) {
      // Retain initial snapshot from the start of the slider/continuous gesture
      this._lastGroupTime = now;
      return;
    }

    if (groupKey) {
      this._activeGroupKey = groupKey;
      this._lastGroupTime = now;
    } else {
      this._activeGroupKey = null;
    }

    const snapshot = this.captureSnapshot(description);
    this.pushSnapshot(snapshot, description);
  }

  /**
   * Undoes the last action (up to 20 steps back).
   * @returns {boolean} True if an action was undone, false otherwise.
   */
  undo() {
    if(store.sessionRole==='player')return false;
    if (this.undoStack.length === 0 || this.isRestoring) {
      return false;
    }

    // 1. Capture current state for the redo stack
    const currentState = this.captureSnapshot(
      this.undoStack[this.undoStack.length - 1].description || 'Acción Revertida'
    );

    // 2. Pop target state from undo stack
    const targetSnapshot = this.undoStack.pop();

    // 3. Push current state into redo stack
    this.redoStack.push(currentState);
    while (this.redoStack.length > this.maxSteps) {
      this.redoStack.shift();
    }

    // 4. Restore the target snapshot
    this._restoreState(targetSnapshot);

    // 5. User feedback
    const remaining = this.undoStack.length;
    const desc = targetSnapshot.description || 'Paso Táctico';
    showTacticalNotification(`↶ DESHACER: ${desc}`, 'undo', remaining);

    try {
      audio.playClockTick();
    } catch (e) {}

    store.addLog({
      type: 'SYSTEM',
      title: '↶ ACCIÓN DESHECHA',
      details: `Revertido: [${desc}]. Pasos restantes en memoria: ${remaining} / ${this.maxSteps}`
    });

    this._emitStackChanged();
    return true;
  }

  /**
   * Redoes the last undone action.
   * @returns {boolean} True if an action was redone, false otherwise.
   */
  redo() {
    if(store.sessionRole==='player')return false;
    if (this.redoStack.length === 0 || this.isRestoring) {
      return false;
    }

    // 1. Capture current state for the undo stack
    const currentState = this.captureSnapshot(
      this.redoStack[this.redoStack.length - 1].description || 'Acción Restaurada'
    );

    // 2. Pop target state from redo stack
    const targetSnapshot = this.redoStack.pop();

    // 3. Push current state to undo stack
    this.undoStack.push(currentState);
    while (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }

    // 4. Restore target snapshot
    this._restoreState(targetSnapshot);

    // 5. User feedback
    const desc = targetSnapshot.description || 'Paso Táctico';
    showTacticalNotification(`↷ REHACER: ${desc}`, 'redo', this.undoStack.length);

    try {
      audio.playClockTick();
    } catch (e) {}

    store.addLog({
      type: 'SYSTEM',
      title: '↷ ACCIÓN REHECHA',
      details: `Restaurado: [${desc}]. Pasos en memoria: ${this.undoStack.length} / ${this.maxSteps}`
    });

    this._emitStackChanged();
    return true;
  }

  /**
   * Internal restoration routine.
   */
  _restoreState(snapshot) {
    this.isRestoring = true;

    try {
      // Restore tactical entities
      if (snapshot.maps) {
        store.state.maps = JSON.parse(JSON.stringify(snapshot.maps));
      }
      if (snapshot.tokens) {
        store.state.tokens = JSON.parse(JSON.stringify(snapshot.tokens));
      }
      if (snapshot.clocks) {
        store.state.clocks = JSON.parse(JSON.stringify(snapshot.clocks));
      }
      if (snapshot.fear !== undefined) {
        store.state.fear = snapshot.fear;
      }
      if (snapshot.activeMapId) {
        store.state.activeMapId = snapshot.activeMapId;
      }
      if (snapshot.starship) {
        store.state.starship = JSON.parse(JSON.stringify(snapshot.starship));
      }
      if (snapshot.handouts) {
        store.state.handouts = JSON.parse(JSON.stringify(snapshot.handouts));
      }

      // Restore Area Templates on Canvas Engine
      if (typeof window !== 'undefined' && window.veilCanvas) {
        if (snapshot.templates) {
          window.veilCanvas.templates = JSON.parse(JSON.stringify(snapshot.templates));
        }
        window.veilCanvas.activeTemplate = null;
      }

      // Clean dangling IDs
      store.validateSelections();

      // Persist to storage
      store.saveToStorage();

      // Notify reactive UI listeners
      store.notify(['maps', 'tokens', 'clocks', 'fear', 'activeMapId', 'templates', 'starship', 'handouts']);

      // Multiplayer synchronization if hosting
      if (store.state.isHosting) {
        network.syncAll();
      }
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * Computes a fast lightweight signature to verify state differences.
   */
  _hashState(snap) {
    if (!snap) return '';
    try {
      return JSON.stringify({
        mapId: snap.activeMapId,
        fear: snap.fear,
        tok: (snap.tokens || []).map(t => `${t.id}:${t.x}:${t.y}:${t.hp?.current}:${t.stress?.current}`),
        maps: (snap.maps || []).map(m => `${m.id}:${m.walls?.length}:${m.lights?.length}:${m.waterZones?.length}:${m.effects?.length}:${m.gridSize}`),
        water: (snap.maps || []).map(m => ({ id:m.id, zones:m.waterZones || [] })),
        clocks: (snap.clocks || []).map(c => `${c.id}:${c.filled}:${c.isKeeperOnly}`),
        tmpls: (snap.templates || []).map(t => `${t.id}:${t.type}:${t.x}:${t.y}:${t.radius}`)
      });
    } catch (e) {
      return '';
    }
  }

  _emitStackChanged() {
    const detail = {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      maxSteps: this.maxSteps,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      lastUndoDesc: this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].description : null,
      lastRedoDesc: this.redoStack.length > 0 ? this.redoStack[this.redoStack.length - 1].description : null
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('veil:undo_stack_changed', { detail }));
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  getUndoCount() {
    return this.undoStack.length;
  }

  getRedoCount() {
    return this.redoStack.length;
  }

  getLastUndoDescription() {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].description : null;
  }
}

export const undoManager = new UndoManager();
store.undoManager = undoManager;

/**
 * Tactical HUD Toast notification for instant visual feedback on Undo / Redo operations.
 */
export function showTacticalNotification(text, type = 'undo', count = 0) {
  if (typeof document === 'undefined') return;

  let toast = document.getElementById('tactical_undo_toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tactical_undo_toast';
    toast.className = 'tactical-undo-toast';
    document.body.appendChild(toast);
  }

  const icon = type === 'undo' ? '↶' : '↷';
  toast.innerHTML = sanitizeHTML(`
    <span class="toast-icon">${icon}</span>
    <span class="toast-text">${text}</span>
    <span class="toast-count">(${count}/20)</span>
  `);

  toast.classList.remove('show');
  void toast.offsetWidth; // Force layout reflow for animation replay
  toast.classList.add('show');

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}
