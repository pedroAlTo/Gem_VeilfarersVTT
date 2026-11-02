// src/state.js
// Centralized reactive state store for VeilVTT with Layers, Water, Handouts, and Sleeping Moves

import { activeCampaignId, readCampaign, writeCampaign, selectCampaign, newId, listCampaigns } from './persistence.js';
import { createActor, replaceActorSheet } from './actors.js';
import { CAMPAIGN_KEYS, validateCampaign } from './validation.js';
import { confirmAction, notify } from './ui.js';

import { INITIAL_MAPS, INITIAL_TOKENS, INITIAL_CLOCKS, INITIAL_HANDOUTS } from './defaultData.js';

class StateStore {
  constructor() {
    this.listeners = new Set();
    this.undoManager = null;
    this._skipNextUndoSnapshot = false;

    // Initial Fear: 1d4 + 2 (Rolls at session start)
    const initialFear = Math.floor(Math.random() * 4) + 1 + 2;

    this.state = {
      // Game Data
      campaignId: activeCampaignId(),
      saveStatus: 'loading',
      campaignName: 'USC Vagrant Star // Frontier Expedition',
      optionalEfforts:false,
      fear: initialFear, // 0 to 12
      fearMax: 12,
      activeMapId: 'map_bridge_01',
      maps: structuredClone(INITIAL_MAPS),
      tokens: structuredClone(INITIAL_TOKENS),
      clocks: structuredClone(INITIAL_CLOCKS),
      handouts: structuredClone(INITIAL_HANDOUTS),
      activeTransmission: null, // Broadcasted handout currently popped up
      logs: [],

      // Layers System
      // 'map' | 'water' | 'walls_lights' | 'tokens' | 'overlay'
      activeLayer: 'tokens',
      layerVisibility: {
        map: true,
        water: true,
        walls_lights: true,
        tokens: true,
        overlay: true
      },
      layerLocked: {
        map: true,
        water: false,
        walls_lights: false,
        tokens: false,
        overlay: false
      },

      // Client / User context
      userRole: 'keeper', // 'keeper' or 'player'
      userName: 'Keeper',
      claimedTokenId: 'tok_harker',
      selectedTokenId: 'tok_harker',
      selectedWallId: null,
      selectedLightId: null,
      selectedWaterId: null,
      selectedEffectId: null,
      selectedTemplateId: null,

      // UI / Interaction
      activeTool: 'select', // 'select', 'measure', 'template', 'wall', 'light', 'water', 'fx', 'ping'
      activeFxType: 'lightning', // 'lightning', 'sparkle', 'explosion', 'radiant', 'void_rift', 'emp'
      templateShape: 'circle', // 'circle', 'cone', 'line', 'box'
      templateRadius: 4, // grid units
      gmVision: true, // If true, Keeper sees all without fog/darkness
      fogOfWar: true, // If true, unexplored areas are completely dark, explored areas out of vision are shrouded
      fogExploredOpacity: 0.88, // Darkness opacity for explored areas out of vision (0.80 to 0.95)
      showGrid: true,
      gridSnap: true,
      snapToGrid: true,
      snapToAnchors: true,
      snapToObjects: true,
      showRain: false,
      audioMuted: false,

      // Multiplayer
      isHosting: false,
      isConnected: false,
      roomCode: '',
      connectedPeers: [],

      // Starship State (Veilfarers Chapter 17 Naval Combat)
      starship: {
        name: 'USC Vagrant Star',
        hullClass: 'Light Freighter (Tier 2)',
        tier: 2,
        hull: 14,
        maxHull: 14,
        evasion: 14,
        mountRating: 2,
        heat: 0,
        heatCap: 10,
        systems: { 'Primary Drive':3, 'FTL Drive':3, 'Sensor Array':3, 'Comms Array':3, 'Life Support':3, 'Weapons':3 },
        firedThisRound:false,
        visible:false,
        heatCheckPending:false,
        rangeBand: 'Engagement', // 'Adjacent' | 'Engagement' | 'Standard' | 'Long' | 'Extreme'
        pearls: 3,
        shieldArcs: {
          fore: 4,
          aft: 4,
          port: 4,
          starboard: 4,
          maxPerArc: 4
        }
      }
    };

    // Load persisted state if exists
    this.sessionRole = 'local';
    this.remoteApplying = false;
    this.saveQueue = Promise.resolve();
    this.initialCampaign = this.serializeCampaign();
    this.ready = this.loadFromStorage();
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changedKeys = []) {
    if (changedKeys.some(k=>CAMPAIGN_KEYS.includes(k))) this.saveToStorage();
    for (const listener of this.listeners) {
      listener(this.state, changedKeys);
    }
  }

  update(partialState) {
    if (this.sessionBusy) return false;
    if (this.sessionRole === 'player' && !this.remoteApplying) {
      if (Object.keys(partialState).some(k=>CAMPAIGN_KEYS.includes(k))) return false;
      if (partialState.userRole === 'keeper') return false;
    }
    Object.assign(this.state, partialState);
    this.notify(Object.keys(partialState));
  }

  _beforeTacticalMutation(description, groupKey = null) {
    if (this._skipNextUndoSnapshot) {
      this._skipNextUndoSnapshot = false;
      return;
    }
    if (this.undoManager && !this.undoManager.isRestoring) {
      this.undoManager.pushCurrentState(description, groupKey);
    }
  }

  validateSelections() {
    const map = this.getActiveMap();
    if (this.state.selectedTokenId && !this.state.tokens.some(t => t.id === this.state.selectedTokenId)) {
      this.state.selectedTokenId = null;
    }
    if (map) {
      if (this.state.selectedWallId && !(map.walls || []).some(w => w.id === this.state.selectedWallId)) {
        this.state.selectedWallId = null;
      }
      if (this.state.selectedLightId && !(map.lights || []).some(l => l.id === this.state.selectedLightId)) {
        this.state.selectedLightId = null;
      }
      if (this.state.selectedWaterId && !(map.waterZones || []).some(w => w.id === this.state.selectedWaterId)) {
        this.state.selectedWaterId = null;
      }
      if (this.state.selectedEffectId && !(map.effects || []).some(e => e.id === this.state.selectedEffectId)) {
        this.state.selectedEffectId = null;
      }
    }
  }

  getActiveMap() {
    return this.state.maps.find(m => m.id === this.state.activeMapId) || this.state.maps[0];
  }

  getTokensForActiveMap() {
    const isPlayer = this.state.userRole === 'player';
    return this.state.tokens.filter(t => {
      if (t.mapId !== this.state.activeMapId) return false;
      if (isPlayer && t.hidden) return false;
      return true;
    });
  }

  getSelectedToken() {
    return this.state.tokens.find(t => t.id === this.state.selectedTokenId) || null;
  }

  // --- Layer Management ---
  setActiveLayer(layerName) {
    this.update({
      activeLayer: layerName,
      // Deselect elements on other layers
      selectedWallId: layerName === 'walls_lights' ? this.state.selectedWallId : null,
      selectedLightId: layerName === 'walls_lights' ? this.state.selectedLightId : null,
      selectedWaterId: layerName === 'water' ? this.state.selectedWaterId : null,
      selectedTokenId: layerName === 'tokens' ? this.state.selectedTokenId : null
    });
  }

  toggleLayerVisibility(layerName) {
    const layerVisibility = { ...this.state.layerVisibility, [layerName]: !this.state.layerVisibility[layerName] };
    this.update({ layerVisibility });
  }

  toggleLayerLock(layerName) {
    const layerLocked = { ...this.state.layerLocked, [layerName]: !this.state.layerLocked[layerName] };
    this.update({ layerLocked });
  }

  // --- Fear Management ---
  setFear(newVal) {
    this._beforeTacticalMutation('Ajustar Miedo / Fear', 'fear_change');
    const clamped = Math.max(0, Math.min(12, Number.isFinite(newVal) ? Math.round(newVal) : this.state.fear));
    this.update({ fear: clamped });
  }

  addFear(delta = 1) {
    this._beforeTacticalMutation(delta > 0 ? 'Aumentar Miedo' : 'Reducir Miedo', 'fear_change');
    this.setFear(this.state.fear + delta);
  }

  spendFear(amount, moveName = 'Keeper Move') {
    this._beforeTacticalMutation('Gasto de Miedo: ' + moveName);
    if (this.state.fear >= amount) {
      this.setFear(this.state.fear - amount);
      this.addLog({
        sender: 'Keeper',
        type: 'KEEPER_MOVE',
        title: `SPENT ${amount} FEAR: ${moveName}`,
        details: `Keeper pool reduced to ${this.state.fear} / 12`
      });
      return true;
    }
    return false;
  }

  resetFearSession() {
    this._beforeTacticalMutation('Reiniciar Miedo de Sesión');
    const rolled = Math.floor(Math.random() * 4) + 1 + 2;
    this.setFear(rolled);
    this.addLog({
      sender: 'Keeper',
      type: 'SESSION_START',
      title: 'SESSION RESET: FEAR ENGINE INITIALIZED',
      details: `Rolled 1d4 + 2 -> Fear initialized to ${rolled} / 12 tokens.`
    });
  }

  // --- Clocks Management ---
  addClock(clockData) {
    this._beforeTacticalMutation('Añadir Reloj de Misión');
    const newClock = {
      id: 'clock_' + Date.now(),
      title: clockData.title || 'New Mission Clock',
      segments: clockData.segments || 6,
      filled: 0,
      category: clockData.category || 'danger',
      isKeeperOnly: clockData.isKeeperOnly ?? false,
      posX: 80,
      posY: 100 + (this.state.clocks.length * 80),
      collapsed: false
    };
    this.update({ clocks: [...this.state.clocks, newClock] });
    return newClock;
  }

  updateClock(clockId, partial) {
    this._beforeTacticalMutation('Modificar Reloj', 'clock_' + clockId);
    const clocks = this.state.clocks.map(c => {
      if (c.id === clockId) {
        return { ...c, ...partial };
      }
      return c;
    });
    this.update({ clocks });
  }

  advanceClock(clockId, delta = 1) {
    this._beforeTacticalMutation('Avanzar Reloj', 'clock_' + clockId);
    const clock = this.state.clocks.find(c => c.id === clockId);
    if (!clock) return;
    const newFilled = Math.max(0, Math.min(clock.segments, clock.filled + delta));
    this.updateClock(clockId, { filled: newFilled });

    if (newFilled === clock.segments) {
      this.addLog({
        sender: 'System',
        type: 'CLOCK_COMPLETED',
        title: `CLOCK COMPLETED: [${clock.title.toUpperCase()}]`,
        details: `All ${clock.segments} segments filled! Trigger event is now imminent!`
      });
    }
  }

  deleteClock(clockId) {
    this._beforeTacticalMutation('Eliminar Reloj');
    this.update({ clocks: this.state.clocks.filter(c => c.id !== clockId) });
  }

  // --- Token Management ---
  canEditToken(tokenId) {
    if (this.sessionRole !== 'player') return this.state.userRole === 'keeper' || !!this.state.tokens.find(t=>t.id===tokenId && t.isPlayer);
    return !!this.state.tokens.find(t=>t.id===tokenId && t.ownerId===this.peerId && t.isPlayer);
  }

  updateToken(tokenId, partial) {
    if (this.sessionRole === 'player' && !this.remoteApplying) {
      if (this.canEditToken(tokenId)) this.sendTokenPatch?.(tokenId, partial);
      return;
    }
    this._beforeTacticalMutation('Modificar Operativo', 'tok_' + tokenId);
    const tokens = this.state.tokens.map(t => {
      if (t.id === tokenId) {
        return { ...t, ...partial };
      }
      return t;
    });
    this.update({ tokens });
  }

  addToken(tokenData) {
    if (this.sessionRole === 'player' || this.sessionBusy) return null;
    const token = createActor(tokenData, this.state.activeMapId);
    this._beforeTacticalMutation('Crear actor: ' + token.name);
    this.update({ tokens: [...this.state.tokens, token] });
    return token;
  }

  importActors(entries) {
    if (this.sessionRole !== 'local' || this.state.isHosting || this.state.isConnected || this.sessionBusy) throw new Error('Importa personajes en una sesión local.');
    // Validate the whole batch before a single live mutation or undo snapshot.
    let tokens = structuredClone(this.state.tokens);
    const seen = new Set();
    let selectedTokenId;
    for (const entry of entries) {
      if (entry.updateId) {
        if (seen.has(entry.updateId)) throw new Error('Dos archivos intentan actualizar el mismo personaje.');
        seen.add(entry.updateId);
        const index = tokens.findIndex(t => t.id === entry.updateId);
        if (index < 0) throw new Error('El personaje que se iba a actualizar ya no existe.');
        tokens[index] = replaceActorSheet(tokens[index], entry.token);
        selectedTokenId = entry.updateId;
      } else {
        const token = createActor(entry.token, this.state.activeMapId);
        tokens.push(token); selectedTokenId = token.id;
      }
    }
    validateCampaign({ ...this.serializeCampaign(), tokens });
    this._beforeTacticalMutation('Importar personajes');
    this.update({ tokens, selectedTokenId });
    return entries.length;
  }

  deleteToken(tokenId) {
    this._beforeTacticalMutation('Eliminar Operativo');
    this.update({
      tokens: this.state.tokens.filter(t => t.id !== tokenId),
      selectedTokenId: this.state.selectedTokenId === tokenId ? null : this.state.selectedTokenId
    });
  }

  // --- Sleeping Character Mechanics ---
  async spendEffort(tokenId, amount, moveName) {
    this._beforeTacticalMutation('Gasto de Esfuerzo');
    const token = this.state.tokens.find(t => t.id === tokenId);
    if (!token) return false;

    if (token.effort >= amount) {
      const newEffort = token.effort - amount;
      this.updateToken(tokenId, { effort: newEffort });
      this.addLog({
        sender: token.name,
        type: 'EFFORT_MOVE',
        title: `${token.name}: Spent ${amount} Effort on [${moveName}]`,
        details: `Remaining Effort: ${newEffort} / 6`
      });
      return true;
    } else if (token.effort === 0) {
      // Burnout option: Pay 1 HP instead
      if (await confirmAction(`At 0 Effort: Spend 1 HP to enter BURNOUT and activate [${moveName}]? (Reduces max stress by 1 until recovery)`)) {
        const newHp = Math.max(0, token.hp.current - 1);
        const curMaxStress = token.stress?.max || 6;
        const newMaxStress = Math.max(1, curMaxStress - 1);
        this.updateToken(tokenId, {
          hp: { ...token.hp, current: newHp },
          stress: { ...token.stress, max: newMaxStress },
          isBurnedOut: true
        });
        this.addLog({
          sender: token.name,
          type: 'BURNOUT',
          title: `BURNOUT! ${token.name} paid 1 HP for [${moveName}]`,
          details: `Current HP: ${newHp}/${token.hp.max}. Max Stress temporarily reduced to ${newMaxStress}.`
        });
        return true;
      }
    }
    return false;
  }

  markEffortSegment(tokenId) {
    this._beforeTacticalMutation('Marcar Esfuerzo');
    const token = this.state.tokens.find(t => t.id === tokenId);
    if (!token || token.path !== 'Sleeping') return;

    let track = token.effortTrack ? [...token.effortTrack] : [false, false];
    if (!track[0]) {
      track[0] = true;
      this.updateToken(tokenId, { effortTrack: track });
    } else if (!track[1]) {
      // Both segments marked -> Clear and gain 1 Effort!
      track = [false, false];
      const newEffort = Math.min(6, (token.effort || 0) + 1);
      this.updateToken(tokenId, { effort: newEffort, effortTrack: track });
      this.addLog({
        sender: token.name,
        type: 'EFFORT_TRACK',
        title: `${token.name}: Completed Effort Track!`,
        details: `Track cleared -> Gained +1 Effort (Current: ${newEffort} / 6)`
      });
    }
  }

  spendResolve(tokenId, count = 1, moveName = 'Bear Down') {
    this._beforeTacticalMutation('Gasto de Temple (Resolve)');
    const token = this.state.tokens.find(t => t.id === tokenId);
    if (!token) return { success: false, totalBonus: 0 };
    if ((token.resolve?.current || 0) >= count) {
      const sides = token.resolve.dieType === 'd6' ? 6 : 4;
      let totalRoll = 0;
      let rolls = [];
      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        rolls.push(r);
        totalRoll += r;
      }
      const newResolve = token.resolve.current - count;
      this.updateToken(tokenId, { resolve: { ...token.resolve, current: newResolve } });
      this.addLog({
        sender: token.name,
        type: 'RESOLVE_MOVE',
        title: `${token.name}: Resolve [${moveName}] (${count}${token.resolve.dieType})`,
        details: `Rolled [${rolls.join(', ')}] -> Added +${totalRoll} to total! Remaining Resolve: ${newResolve}/${token.resolve.max}`
      });
      return { success: true, totalBonus: totalRoll, rolls };
    }
    return { success: false, totalBonus: 0 };
  }

  // --- Water Zones ---
  addWaterZone(zoneData) {
    this._beforeTacticalMutation('Añadir Zona Acuática');
    const map = this.getActiveMap();
    const newZone = {
      id: 'water_' + Date.now(),
      name: zoneData.name || 'Water Hazard',
      x: zoneData.x || 300,
      y: zoneData.y || 300,
      width: zoneData.width || 200,
      height: zoneData.height || 160,
      depth: zoneData.depth ?? 2, // 0 to 5
      color: zoneData.color || 'rgba(0, 243, 255, 0.45)',
      flowSpeed: 1.0
    };
    const waterZones = [...(map.waterZones || []), newZone];
    this.updateActiveMap({ waterZones });
    this.update({ selectedWaterId: newZone.id });
    return newZone;
  }

  updateWaterZone(zoneId, partial) {
    this._beforeTacticalMutation('Modificar Zona Acuática', 'water_' + zoneId);
    const map = this.getActiveMap();
    const waterZones = (map.waterZones || []).map(w => w.id === zoneId ? { ...w, ...partial } : w);
    this.updateActiveMap({ waterZones });
  }

  deleteWaterZone(zoneId) {
    this._beforeTacticalMutation('Eliminar Zona Acuática');
    const map = this.getActiveMap();
    const waterZones = (map.waterZones || []).filter(w => w.id !== zoneId);
    this.updateActiveMap({ waterZones });
    if (this.state.selectedWaterId === zoneId) this.update({ selectedWaterId: null });
  }

  // --- Walls & Lights Interactive ---
  updateWall(wallId, partial) {
    this._beforeTacticalMutation('Modificar Muro', 'wall_' + wallId);
    const map = this.getActiveMap();
    const walls = (map.walls || []).map(w => w.id === wallId ? { ...w, ...partial } : w);
    this.updateActiveMap({ walls });
  }

  deleteWall(wallId) {
    this._beforeTacticalMutation('Eliminar Muro');
    const map = this.getActiveMap();
    const walls = (map.walls || []).filter(w => w.id !== wallId);
    this.updateActiveMap({ walls });
    if (this.state.selectedWallId === wallId) this.update({ selectedWallId: null });
  }

  updateLight(lightId, partial) {
    this._beforeTacticalMutation('Modificar Luz', 'light_' + lightId);
    const map = this.getActiveMap();
    const lights = (map.lights || []).map(l => l.id === lightId ? { ...l, ...partial } : l);
    this.updateActiveMap({ lights });
  }

  deleteLight(lightId) {
    this._beforeTacticalMutation('Eliminar Luz');
    const map = this.getActiveMap();
    const lights = (map.lights || []).filter(l => l.id !== lightId);
    this.updateActiveMap({ lights });
    if (this.state.selectedLightId === lightId) this.update({ selectedLightId: null });
  }

  // --- Persistent Particle FX Emitter Elements ---
  addEffect(fxData) {
    this._beforeTacticalMutation('Crear Anomalía FX');
    const map = this.getActiveMap();
    const isLaser = fxData.type === 'laser';
    const newFx = {
      id: 'fx_' + Date.now(),
      type: fxData.type || 'void_rift', // 'laser', 'void_rift', 'toxic', 'radioactive', 'fire', 'lightning', 'emp', 'radiant', 'sparkle'
      shape: isLaser ? 'line' : (fxData.shape || 'circle'), // 'circle' | 'polygon' | 'line'
      points: fxData.points || [],
      label: fxData.label || (isLaser ? 'Tactical Laser Beam' : 'Anomaly Emitter'),
      x: fxData.x || 400,
      y: fxData.y || 400,
      x2: fxData.x2 || ((fxData.x || 400) + (isLaser ? 260 : 160)),
      y2: fxData.y2 || (fxData.y || 400),
      radius: fxData.radius || 120,
      beamWidth: fxData.beamWidth || (isLaser ? 6 : 4),
      intensity: fxData.intensity ?? 1.0,
      particleIntensity: fxData.particleIntensity ?? 1.0,
      lightIntensity: fxData.lightIntensity ?? 1.0,
      frequency: fxData.frequency ?? 1.0,
      lightningMode: fxData.lightningMode || (fxData.shape === 'polygon' ? 'polygon' : (fxData.shape === 'line' ? 'line' : 'circle')),
      active: fxData.active ?? true,
      color: fxData.color || (isLaser ? '#ef4444' : '#00f3ff'),
      color2: fxData.color2 || '#3b82f6'
    };
    const effects = [...(map.effects || []), newFx];
    this.updateActiveMap({ effects });
    this.update({ selectedEffectId: newFx.id });
    return newFx;
  }

  updateEffect(fxId, partial) {
    this._beforeTacticalMutation('Modificar Anomalía FX', 'fx_' + fxId);
    const map = this.getActiveMap();
    const current = (map.effects || []).find(f => f.id === fxId);
    if (current && (partial.type && partial.type !== current.type || partial.active === false)) {
      if (typeof window !== 'undefined' && window.veilCanvas?.fx) {
        window.veilCanvas.fx.removeEffect(fxId);
      }
    }
    const effects = (map.effects || []).map(f => f.id === fxId ? { ...f, ...partial } : f);
    this.updateActiveMap({ effects });
  }

  deleteEffect(fxId) {
    this._beforeTacticalMutation('Eliminar Anomalía FX');
    const map = this.getActiveMap();
    const effects = (map.effects || []).filter(f => f.id !== fxId);
    this.updateActiveMap({ effects });
    if (this.state.selectedEffectId === fxId) this.update({ selectedEffectId: null });
    // Guarantee cleanup in canvas FXEngine
    if (typeof window !== 'undefined' && window.veilCanvas?.fx) {
      window.veilCanvas.fx.removeEffect(fxId);
    }
  }

  // --- Fog of War & Exploration Shroud ---
  toggleFogOfWar() {
    this.update({ fogOfWar: !this.state.fogOfWar });
  }

  setFogExploredOpacity(opacity) {
    this.update({ fogExploredOpacity: Math.max(0.80, Math.min(0.95, opacity)) });
  }

  resetMapFog(mapId = null) {
    const targetMapId = mapId || this.state.activeMapId;
    if (typeof window !== 'undefined' && window.veilCanvas?.fog) {
      window.veilCanvas.fog.resetExploration(`${this.state.campaignId}:${targetMapId}`);
    }
    this.update({ fogLastReset: Date.now() });
  }

  revealMapFog(mapId = null) {
    const targetMapId = mapId || this.state.activeMapId;
    const map = this.getActiveMap();
    if (typeof window !== 'undefined' && window.veilCanvas?.fog && map) {
      window.veilCanvas.fog.revealAll(`${this.state.campaignId}:${targetMapId}`, window.veilCanvas.mapImage?.width || 2000, window.veilCanvas.mapImage?.height || 1200);
    }
    this.update({ fogLastReveal: Date.now() });
  }

  // --- Handouts / Classified Transmissions ---
  addHandout(handoutData) {
    const newDoc = {
      id: 'doc_' + Date.now(),
      title: handoutData.title || 'Classified Intelligence File',
      sender: handoutData.sender || 'Keeper Transmission',
      timestamp: new Date().toLocaleDateString() + ' // ' + new Date().toLocaleTimeString(),
      contentHtml: handoutData.contentHtml || '<p>Transmitted telemetry intelligence...</p>',
      imageUrl: handoutData.imageUrl || '',
      sharedWithPlayers: false
    };
    this.update({ handouts: [...this.state.handouts, newDoc] });
    return newDoc;
  }

  updateHandout(handoutId, partial) {
    const handouts = this.state.handouts.map(h => h.id === handoutId ? { ...h, ...partial } : h);
    this.update({ handouts });
  }

  deleteHandout(handoutId) {
    this.update({ handouts: this.state.handouts.filter(h => h.id !== handoutId) });
  }

  // --- Map Management (Up to 6000x6000px) ---
  addMap(mapData) {
    this._beforeTacticalMutation('Añadir Mapa Táctico');
    const newMap = {
      id: 'map_' + Date.now(),
      name: mapData.name || 'New Tactical Map',
      imageUrl: mapData.imageUrl,
      width: mapData.width || 2000,
      height: mapData.height || 2000,
      gridSize: mapData.gridSize || 64,
      gridType: mapData.gridType || 'square',
      gridColor: 'rgba(0, 243, 255, 0.2)',
      ambientLight: mapData.ambientLight ?? 0.3,
      ambientColor: '#0a1220',
      walls: [],
      lights: [],
      waterZones: []
    };
    this.update({
      maps: [...this.state.maps, newMap],
      activeMapId: newMap.id
    });
    return newMap;
  }

  updateActiveMap(partial) {
    this._beforeTacticalMutation('Modificar Mapa Activo');
    const maps = this.state.maps.map(m => {
      if (m.id === this.state.activeMapId) {
        return { ...m, ...partial };
      }
      return m;
    });
    this.update({ maps });
  }

  // --- Logs ---
  addLog(entry) {
    const newEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ...entry
    };
    const logs = [newEntry, ...this.state.logs].slice(0, 150);
    this.update({ logs });
  }

  addCombatLog(entry) {
    return this.addLog(entry);
  }

  // Complete versioned snapshots; guest replicas never overwrite a local campaign.
  serializeCampaign() {
    const data={schemaVersion:3, savedAt: this.state.savedAt};
    for(const key of CAMPAIGN_KEYS)data[key]=structuredClone(this.state[key]);
    return data;
  }
  async saveToStorage() {
    if(this.sessionRole==='player'||this.remoteApplying||this.storageReadFailed)return;
    const data=this.serializeCampaign(); data.savedAt=new Date().toISOString(); this.state.saveStatus='saving'; this._storageEvent();
    const write=this.saveQueue.catch(()=>{}).then(()=>writeCampaign(data.campaignId,data));this.saveQueue=write;
    try{await write;if(this.saveQueue===write){this.state.saveStatus='saved';this.state.savedAt=data.savedAt;delete this.state.saveError;}}
    catch(e){this.state.saveStatus='error';this.state.saveError=e.message;}
    this._storageEvent();
  }
  _storageEvent(){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('veil:save-status',{detail:{status:this.state.saveStatus,error:this.state.saveError}}));}
  async loadFromStorage() {
    try {
      const id = this.state.campaignId;
      const saved = await readCampaign(id, { migrateLegacy: true });
      if (saved) {
        const merged = this.normalizeCampaign({ ...saved, campaignId: id });
        for (const key of CAMPAIGN_KEYS) this.state[key] = merged[key];
        this.state.savedAt = saved.savedAt;
      }
      this.state.saveStatus = 'saved';
      // Persist a legacy snapshot under its own identity once; no other ID inherits it.
      if (!saved || !saved.campaignId) await this.saveToStorage();
    } catch (e) {
      this.storageReadFailed = true; this.state.saveStatus = 'error'; this.state.saveError = e.message;
      notify(`Saved campaign unavailable: ${e.message} Original data has not been overwritten.`, 'error');
    }
    this._storageEvent();
  }
  normalizeCampaign(input) {
    // Old archives may omit optional fields, never borrow maps/actors/logs from the open session.
    const base = structuredClone(this.initialCampaign);
    const data = validateCampaign({ ...base, ...input, logs: input.logs ?? [], starship: { ...base.starship, ...input.starship } });
    if (!data.maps.some(m => m.id === data.activeMapId)) data.activeMapId = data.maps[0].id;
    return data;
  }
  async savedSessions() {
    await this.ready;
    await this.saveQueue;
    return listCampaigns();
  }
  async changeSession(prepare) {
    await this.ready;
    if (this.sessionBusy) throw new Error('Espera a que termine el cambio de sesión.');
    if (this.sessionRole !== 'local' || this.state.isHosting || this.state.isConnected) throw new Error('Las sesiones guardadas se gestionan en modo local.');
    if (this.storageReadFailed) throw new Error('No se pudo leer el guardado. Exporta una copia y recarga antes de cambiar de sesión.');
    this.sessionBusy = true;
    try {
      await this.saveToStorage();
      await this.saveQueue; // A failed save must not switch or erase the current session.
      const prepared = await prepare();
      const data = this.normalizeCampaign(prepared);
      data.savedAt = new Date().toISOString();
      await writeCampaign(data.campaignId, data);
      selectCampaign(data.campaignId);
      for (const key of CAMPAIGN_KEYS) this.state[key] = data[key];
      Object.assign(this.state, { selectedTokenId: null, claimedTokenId: null, selectedWallId: null, selectedLightId: null, selectedWaterId: null, selectedEffectId: null, selectedTemplateId: null, activeTransmission: null, activeTool: 'select', activeLayer: 'tokens', saveStatus: 'saved', savedAt: data.savedAt });
      this.undoManager?.clear?.();
      this._storageEvent();
      for (const listener of this.listeners) listener(this.state, [...CAMPAIGN_KEYS, 'selectedTokenId', 'selectedWallId', 'selectedLightId', 'selectedWaterId', 'selectedEffectId', 'selectedTemplateId', 'activeTransmission', 'activeTool', 'activeLayer']);
      return data.campaignId;
    } finally { this.sessionBusy = false; }
  }
  openSession(id) {
    return this.changeSession(async () => {
      const data = await readCampaign(id);
      if (!data) throw new Error('No se encuentra esta sesión.');
      return { ...data, campaignId: id };
    });
  }
  createSession(name, duplicate = false) {
    name = String(name || '').trim();
    if (!name || name.length > 500) return Promise.reject(new Error('Escribe un nombre de 1 a 500 caracteres.'));
    return this.changeSession(() => {
      const data = structuredClone(duplicate ? this.serializeCampaign() : this.initialCampaign);
      data.campaignId = newId(); data.campaignName = name;
      if (!duplicate) {
        const id = 'map_' + newId();
        data.maps = [{ id, name: 'Escena inicial', imageUrl: '/assets/maps/blank-grid.svg', gridSize: 64, gridType: 'square', gridColor: 'rgba(0,243,255,.18)', ambientLight: 1, ambientColor: '#080d18', walls: [], lights: [], effects: [], waterZones: [] }];
        data.activeMapId = id; data.tokens = []; data.clocks = []; data.handouts = []; data.logs = [];
        data.fear = 0; data.fogOfWar = false; data.starship.visible = false; data.starship.name = 'Nave sin asignar';
      }
      return data;
    });
  }
  renameSession(name) {
    name = String(name || '').trim();
    if (!name || name.length > 500) return Promise.reject(new Error('Escribe un nombre de 1 a 500 caracteres.'));
    return this.changeSession(() => ({ ...this.serializeCampaign(), campaignName: name }));
  }
  exportCampaignJSON(){
    const blob=new Blob([JSON.stringify(this.serializeCampaign(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download=`veilfarers_campaign_${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async importCampaignJSON(jsonString) {
    if (this.sessionRole === 'player') return false;
    try {
      const input = JSON.parse(jsonString.replace(/^\uFEFF/, ''));
      if (!input || !Array.isArray(input.maps) || !Array.isArray(input.tokens) || !Array.isArray(input.clocks) || !Array.isArray(input.handouts)) throw new Error('Se necesita un archivo de sesión completo.');
      const parsed = this.normalizeCampaign({ ...input, campaignId: newId() });
      await this.changeSession(() => parsed);
      return true;
    } catch (e) { notify(`Import failed: ${e.message}`, 'error'); return false; }
  }
}
export const store = new StateStore();
