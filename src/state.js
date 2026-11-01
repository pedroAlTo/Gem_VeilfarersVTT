// src/state.js
// Centralized reactive state store for VeilVTT with Layers, Water, Handouts, and Sleeping Moves

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
      campaignName: 'USC Vagrant Star // Frontier Expedition',
      fear: initialFear, // 0 to 12
      fearMax: 12,
      activeMapId: 'map_bridge_01',
      maps: [...INITIAL_MAPS],
      tokens: [...INITIAL_TOKENS],
      clocks: [...INITIAL_CLOCKS],
      handouts: [...INITIAL_HANDOUTS],
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
    this.loadFromStorage();
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changedKeys = []) {
    this.saveToStorage();
    for (const listener of this.listeners) {
      listener(this.state, changedKeys);
    }
  }

  update(partialState) {
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
    const clamped = Math.max(0, Math.min(this.state.fearMax, newVal));
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
  updateToken(tokenId, partial) {
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
    this._beforeTacticalMutation('Crear Operativo: ' + (tokenData?.name || 'Nuevo Token'));
    const newToken = {
      id: 'tok_' + Date.now(),
      mapId: this.state.activeMapId,
      x: tokenData.x || 600,
      y: tokenData.y || 400,
      size: tokenData.size || 1,
      name: tokenData.name || 'New Operative',
      roleTag: tokenData.roleTag || 'Voidfarer',
      avatarUrl: tokenData.avatarUrl || '/assets/tokens/captain_harker.jpg',
      isPlayer: tokenData.isPlayer ?? true,
      ownerId: tokenData.ownerId || 'player',
      hidden: tokenData.hidden || false,
      path: tokenData.path || 'Awakened',
      hp: { current: 15, max: 15, majorThreshold: 6, severeThreshold: 12 },
      armor: { current: 2, max: 2 },
      stress: { current: 0, max: 6 },
      hope: 2,
      effort: 2,
      effortTrack: [false, false],
      resolve: { current: 2, max: 2, dieType: 'd4' },
      isBurnedOut: false,
      recoveryAnchor: 'Quarters & Memorial Token',
      honedEdgeBonus: 1,
      traits: { agility: 1, strength: 1, finesse: 1, knowledge: 1, instinct: 1, presence: 1 },
      subtraits: { pilot: 0, tech: 0, medicine: 0 },
      conditions: [],
      visionRadius: 10,
      hasLight: true,
      lightRadius: 250,
      lightColor: '#00f3ff',
      lightEffect: 'steady'
    };
    this.update({ tokens: [...this.state.tokens, newToken] });
    return newToken;
  }

  deleteToken(tokenId) {
    this._beforeTacticalMutation('Eliminar Operativo');
    this.update({
      tokens: this.state.tokens.filter(t => t.id !== tokenId),
      selectedTokenId: this.state.selectedTokenId === tokenId ? null : this.state.selectedTokenId
    });
  }

  // --- Sleeping Character Mechanics ---
  spendEffort(tokenId, amount, moveName) {
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
      if (confirm(`At 0 Effort: Spend 1 HP to enter BURNOUT and activate [${moveName}]? (Reduces max stress by 1 until recovery)`)) {
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
      window.veilCanvas.fog.resetExploration(targetMapId);
    }
    this.update({ fogLastReset: Date.now() });
  }

  revealMapFog(mapId = null) {
    const targetMapId = mapId || this.state.activeMapId;
    const map = this.getActiveMap();
    if (typeof window !== 'undefined' && window.veilCanvas?.fog && map) {
      window.veilCanvas.fog.revealAll(targetMapId, window.veilCanvas.mapImage?.width || 2000, window.veilCanvas.mapImage?.height || 1200);
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

  // --- Storage ---
  saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const dataToSave = {
        campaignName: this.state.campaignName,
        fear: this.state.fear,
        activeMapId: this.state.activeMapId,
        maps: this.state.maps,
        tokens: this.state.tokens,
        clocks: this.state.clocks,
        handouts: this.state.handouts
      };
      localStorage.setItem('veilvtt_campaign_data_v1207', JSON.stringify(dataToSave));
    } catch (e) {}
  }

  loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem('veilvtt_campaign_data_v1207');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.maps && parsed.maps.length) this.state.maps = parsed.maps;
        if (parsed.tokens && parsed.tokens.length) this.state.tokens = parsed.tokens;
        if (parsed.clocks && parsed.clocks.length) this.state.clocks = parsed.clocks;
        if (parsed.handouts && parsed.handouts.length) this.state.handouts = parsed.handouts;
        if (parsed.fear !== undefined) this.state.fear = parsed.fear;
        if (parsed.activeMapId) this.state.activeMapId = parsed.activeMapId;
        if (parsed.campaignName) this.state.campaignName = parsed.campaignName;
      }
    } catch (e) {
      console.warn('Could not load saved campaign, using defaults', e);
    }
  }

  exportCampaignJSON() {
    const data = {
      campaignName: this.state.campaignName,
      fear: this.state.fear,
      maps: this.state.maps,
      tokens: this.state.tokens,
      clocks: this.state.clocks,
      handouts: this.state.handouts
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veilfarers_campaign_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importCampaignJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.maps) this.state.maps = parsed.maps;
      if (parsed.tokens) this.state.tokens = parsed.tokens;
      if (parsed.clocks) this.state.clocks = parsed.clocks;
      if (parsed.handouts) this.state.handouts = parsed.handouts;
      if (parsed.fear !== undefined) this.state.fear = parsed.fear;
      if (parsed.maps && parsed.maps.length > 0) this.state.activeMapId = parsed.maps[0].id;
      this.notify(['maps', 'tokens', 'clocks', 'handouts', 'fear', 'activeMapId']);
      return true;
    } catch (e) {
      console.error('Invalid campaign JSON', e);
      return false;
    }
  }
}

export const store = new StateStore();
