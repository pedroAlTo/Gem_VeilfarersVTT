import { account } from './cloudAccount.js';
import { network } from './networkManager.js';
import { store } from './state.js';
import { newId } from './persistence.js';
import { CAMPAIGN_KEYS } from './validation.js';
import { notify } from './ui.js';
import { RoomService, roomOnline, roomError, ROOM_HEARTBEAT_MS, ROOM_LEASE_MS } from './roomService.js';
import { RoomWire, createRoomWire } from './roomWire.js';

export const activeRoomKey = uid => 'veil.room.active.' + uid;
export class RoomController {
  constructor({ service = new RoomService(), stateStore = store, networkManager = network, clock } = {}) {
    Object.assign(this, { service, store: stateStore, network: networkManager, clock: clock || (() => service.now()) });
    this.generation = 0; this.listeners = new Set(); this.wires = new Map(); this.unsubscribers = []; this.members = [];
    this.persistQueue = Promise.resolve(); this.lastSaved = ''; this.lastError = ''; this.discardedWires = new Set();
    this.network.roomController = this;
    this.unsubscribeStore = this.store.subscribe((_s, keys) => {
      if (this.isKeeper && this.room && !this.leaving && keys.some(k => CAMPAIGN_KEYS.includes(k))) {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.persist().catch(error => this.fail(error)), 500);
      }
    });
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }
  get isKeeper() { return !!this.room && this.room.ownerUid === this.service.uid; }
  remember(id) { try { if (id) localStorage.setItem(activeRoomKey(this.service.uid), id); else localStorage.removeItem(activeRoomKey(this.service.uid)); } catch {} }
  async restore() {
    if (this.room || this.entering) return;
    await this.service.ready();
    let id; try { id = localStorage.getItem(activeRoomKey(this.service.uid)); } catch {}
    if (id) await this.enter(id);
  }
  async create(name) {
    if (this.room) throw new Error('Sal de la sala actual antes de crear otra.');
    await this.service.ready();
    await this.store.createSession(name, true);
    // A new room has its own roster; a copied campaign cannot grant old seats access.
    this.store.update({ players: [], tokens: this.store.state.tokens.map(t => ({ ...t, ownerId: '', controllerIds: [] })) });
    const room = await this.service.create(name, this.store.serializeCampaign());
    await this.enter(room.id); return room;
  }
  async join(code, name) {
    const room = await this.service.join(code, name);
    await this.enter(room.id); return room;
  }
  async enter(id) {
    if (this.entering) throw new Error('Espera a que termine la conexión a la sala.');
    this.entering = true;
    try { return await this.enterRoom(id); } finally { this.entering = false; }
  }
  async enterRoom(id) {
    if (this.room?.id === id) return;
    await this.leave(); await this.service.ready();
    const generation = ++this.generation, room = await this.service.getRoom(id);
    await this.store.ready; await this.store.saveQueue;
    this.network.disconnect(); this.room = room; this.lastError = ''; this.epoch = ''; this.lastSaved = ''; this.saveFailed = false; this.serverConfirmed = false; this.discardedWires.clear();
    this.network.room = room.id; this.network.lastRevision = -1;
    try {
      if (this.isKeeper) {
        // A fresh lease fences an old tab before restoring its campaign.
        this.epoch = newId(); await this.service.acquire(room.id, this.epoch);
        this.loadingHeartbeat = setInterval(() => this.service.heartbeat(id, this.epoch).catch(() => {}), ROOM_HEARTBEAT_MS);
        const latest = await this.service.getRoom(id), campaign = await this.service.loadCampaign(latest);
        await this.service.cleanUnusedSaves(latest);
        await this.store.changeSession(() => campaign);
        this.room = latest; this.lastSaved = this.campaignText();
        this.persistQueue = this.persistQueue.catch(() => {}).then(() => this.syncArcs(id, campaign));
        this.store.sessionRole = 'host'; this.store.peerId = this.service.uid;
        this.store.update({ userRole: 'keeper', gmVision: true, isHosting: true, isConnected: true });
      } else {
        this.network.localCampaign = this.store.serializeCampaign();
        this.store.sessionRole = 'player'; this.store.memberId = this.service.uid; this.store.peerId = this.service.uid;
        const empty = this.store.normalizeCampaign({ ...structuredClone(this.store.initialCampaign), campaignId: room.campaignId, campaignName: room.name, maps: [{ id: 'waiting', name: 'Esperando al Keeper', imageUrl: '/assets/maps/blank-grid.svg', width: 1200, height: 800, gridSize: 64, walls: [], lights: [], effects: [], waterZones: [] }], activeMapId: 'waiting', tokens: [], arcs: [], clocks: [], handouts: [], logs: [], chatMessages: [], players: [] });
        this.store.remoteApplying = true;
        try { this.store.update({ ...empty, userRole: 'player', gmVision: false, isConnected: false, isHosting: false, isObserver: true, selectedTokenId: null, claimedTokenId: null }); }
        finally { this.store.remoteApplying = false; }
      }
      clearInterval(this.loadingHeartbeat);
      this.store.update({ persistentRoomId: id, roomCode: id, roomName: room.name, roomPaused: !this.isKeeper, joiningSession: false });
      this.remember(id);
      const a = this.service.api;
      this.unsubscribers.push(a.onSnapshot(this.service.ref('rooms', id), { includeMetadataChanges: true }, snapshot => {
        if (generation !== this.generation || snapshot.metadata.hasPendingWrites) return;
        this.serverConfirmed = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
        if (!snapshot.exists()) {
          this.remember(null);
          this.leave({ preserveRemembered: false, save: false }).then(() => {
            notify('La sala ha sido eliminada por el Keeper.', 'error');
          });
          return;
        }
        this.room = { ...snapshot.data(), id };
        this.checkPresence(); this.emit();
      }, error => {
        if (error?.code === 'permission-denied' && !this.isKeeper) {
          this.remember(null);
          this.leave({ preserveRemembered: false, save: false }).then(() => {
            notify('La sala ha sido eliminada por el Keeper.', 'error');
          });
          return;
        }
        this.fail(error);
      }));
      this.unsubscribers.push(a.onSnapshot(this.isKeeper ? this.service.col('rooms', id, 'members') : this.service.ref('rooms', id, 'members', this.service.uid), { includeMetadataChanges: true }, snapshot => {
        if (generation !== this.generation || snapshot.metadata.hasPendingWrites) return;
        this.members = this.isKeeper ? snapshot.docs.map(d => ({ ...d.data(), uid: d.id })) : (snapshot.exists() ? [snapshot.data()] : []);
        if (!this.isKeeper && !this.members.some(m => m.uid === this.service.uid && m.status === 'active')) {
          this.remember(null); this.leave({ preserveRemembered: false, save: false }).then(() => notify('El Keeper ha retirado tu acceso a esta sala o la sala ha sido eliminada.', 'error')); return;
        }
        if (this.isKeeper) this.applyRoster();
        this.emit();
      }, error => {
        if (error?.code === 'permission-denied' && !this.isKeeper) {
          this.remember(null);
          this.leave({ preserveRemembered: false, save: false }).then(() => {
            notify('La sala ha sido eliminada por el Keeper.', 'error');
          });
          return;
        }
        this.fail(error);
      }));
      if (this.isKeeper) { this.watchWires(generation); this.service.cleanOldWires(id, this.epoch).catch(() => {}); }
      this.presenceTimer = setInterval(() => this.checkPresence(), 1000);
      this.heartbeatTimer = setInterval(() => this.heartbeat().catch(error => this.fail(error)), ROOM_HEARTBEAT_MS);
      this.checkPresence(); this.emit();
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        import('./vtt-integration/vttIntegrationInit.js').then(async ({ initVeilfarersVTTModules }) => {
          const user = this.service.account?.user || { uid: this.service.uid, displayName: this.service.name || 'Viajero' };
          await initVeilfarersVTTModules({
            roomId: id,
            currentUser: {
              uid: this.service.uid,
              displayName: user.displayName || this.service.name || 'Viajero',
              role: this.isKeeper ? 'keeper' : 'player'
            },
            activeCharId: this.isKeeper ? null : (this.store.state.claimedTokenId || null)
          });
        }).catch(err => {
          console.warn('[Veilfarers Integration] No se pudo inicializar los módulos VTT:', err);
        });
      }
    } catch (error) { await this.leave({ preserveRemembered: true, save: false }); throw error; }
  }
  applyRoster() {
    const active = this.members.filter(m => m.status === 'active'), ids = new Set(active.map(m => m.uid));
    for (const [id, wire] of this.wires) if (!ids.has(wire.uid)) this.dropWire(id);
    const players = active.map(m => ({ id: m.uid, name: m.name }));
    const tokens = this.store.state.tokens.map(t => ({ ...t, ownerId: t.ownerId && t.ownerId !== 'keeper' && !ids.has(t.ownerId) ? '' : t.ownerId, controllerIds: (t.controllerIds || []).filter(uid => ids.has(uid)) }));
    if (JSON.stringify(players) !== JSON.stringify(this.store.state.players) || JSON.stringify(tokens) !== JSON.stringify(this.store.state.tokens)) this.store.update({ players, tokens });
  }
  campaignText() {
    const data = this.store.serializeCampaign(); delete data.savedAt; return JSON.stringify(data);
  }
  persist() {
    if (!this.isKeeper || !this.epoch) return Promise.resolve();
    const id = this.room.id, epoch = this.epoch, generation = this.generation;
    const task = this.persistQueue.catch(() => {}).then(async () => {
      if (generation !== this.generation) return;
      const text = this.campaignText(); if (text === this.lastSaved) return;
      this.store.update({ roomSaveStatus: 'saving' });
      try { await this.service.saveCampaign(id, JSON.parse(text), epoch); }
      catch (error) { this.saveFailed = true; this.store.update({ roomSaveStatus: 'error', isConnected: false, roomPaused: true }); throw error; }
      if (generation === this.generation) { this.lastSaved = text; this.saveFailed = false; this.lastError = ''; this.store.update({ roomSaveStatus: 'saved' }); this.checkPresence(); }
      // The arc index is derived from the confirmed save; its failure never blocks play.
      await this.syncArcs(id, JSON.parse(text));
    });
    this.persistQueue = task; return task;
  }
  async syncArcs(id, campaign) {
    if (this.arcSyncDisabled || !this.service.syncArcs) return;
    try { await this.service.syncArcs(id, campaign); }
    catch (error) {
      // Rules that predate the arc index reject it; stop retrying for this session.
      if (error?.code === 'permission-denied') this.arcSyncDisabled = true;
      console.warn('No se pudo actualizar el índice de arcos de la sala:', error);
    }
  }
  watchWires(generation) {
    const a = this.service.api;
    const query = a.query(this.service.col('rooms', this.room.id, 'wires'), a.where('epoch', '==', this.epoch));
    this.unsubscribers.push(a.onSnapshot(query, snapshot => {
      if (generation !== this.generation || snapshot.metadata.fromCache) return;
      this.wireRows = snapshot.docs.map(d => ({ ...d.data(), id: d.id })); this.updateWires();
    }, error => this.fail(error)));
  }
  updateWires() {
    if (!this.isKeeper) return;
    const active = (this.wireRows || []).filter(w => !this.discardedWires.has(w.id) && w.seenAt && this.clock() - w.seenAt.toMillis() < ROOM_LEASE_MS && this.members.some(m => m.uid === w.uid && m.status === 'active'));
    // Multiple tabs may share an account; each has a separate ordered mailbox.
    // Ownership stays on the account, and the roster only lists it once.
    const ids = new Set(active.map(w => w.id));
    for (const id of this.wires.keys()) if (!ids.has(id)) this.dropWire(id);
    for (const row of active) if (!this.wires.has(row.id)) {
      const wire = new RoomWire(this.service, this.room.id, row.id, 'keeper', {
        beforeSend: async () => { await this.persist(); if (!this.store.state.isConnected) throw new Error('Keeper desconectado.'); },
        onData: async data => { if (!this.leaving && this.store.state.isConnected && this.members.some(m => m.uid === row.uid && m.status === 'active')) await this.network.handleIncomingMessage(data, row.id); },
        onClose: error => { this.dropWire(row.id); this.lastError = roomError(error); this.emit(); }
      });
      wire.peer = row.id; wire.uid = row.uid;
      this.wires.set(row.id, wire); this.network.connections.set(row.id, wire);
      this.network.members.set(row.id, { id: row.uid, name: this.members.find(m => m.uid === row.uid).name });
      this.network.updatePeersList();
    }
  }
  dropWire(id) {
    this.discardedWires.add(id); this.wires.get(id)?.close(); this.wires.delete(id);
    if (this.room && this.isKeeper) this.service.deleteWire(this.room.id, id).catch(() => {});
    this.network.connections.delete(id); this.network.members.delete(id); this.network.tokenPatchAcks.delete(id);
    this.network.updatePeersList();
  }
  async connectPlayer() {
    if (this.connecting || this.leaving) return;
    this.connecting = true;
    const generation = this.generation, epoch = this.room.hostEpoch;
    try {
      const id = await createRoomWire(this.service, this.room, this.service.account.user.displayName);
      if (generation !== this.generation || !roomOnline(this.room, this.clock()) || this.room.hostEpoch !== epoch) return;
      this.network.lastRevision = -1; this.network.seen.clear(); this.network.tokenPatchSequence = 0; this.network.clearTokenPatches(true);
      const wire = new RoomWire(this.service, this.room.id, id, 'player', {
        onData: async data => { if (generation === this.generation && roomOnline(this.room, this.clock()) && this.room.hostEpoch === epoch) { await this.network.handleIncomingMessage(data, this.room.ownerUid); if (data.type === 'INITIAL_STATE' && this.store.state.isConnected) { this.lastError = ''; this.store.update({ roomPaused: false }); this.emit(); } } },
        onClose: error => { this.pausePlayer(); this.lastError = error?.code === 'permission-denied' ? 'La conexión anterior ha caducado. Reconectando…' : roomError(error); this.retryAt = this.clock() + 3000; this.emit(); }
      });
      wire.peer = this.room.ownerUid; this.playerWire = wire; this.playerWireId = id; this.playerEpoch = epoch; this.network.hostConn = wire;
      this.connectStarted = this.clock(); this.store.update({ roomPaused: true, joiningSession: true });
    } catch (error) { this.lastError = roomError(error); this.retryAt = this.clock() + 5000; this.emit(); }
    finally { this.connecting = false; }
  }
  pausePlayer() {
    this.playerWire?.close(); this.playerWire = null; this.playerWireId = null; this.playerEpoch = null; this.network.hostConn = null;
    this.network.clearTokenPatches(true);
    for (const pending of this.network.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Sala en pausa: el Keeper no está online.')); }
    this.network.pending.clear();
    this.store.update({ isConnected: false, joiningSession: false, roomPaused: true });
  }
  checkPresence() {
    if (!this.room || this.leaving) return;
    const online = this.serverConfirmed && roomOnline(this.room, this.clock());
    if (this.isKeeper) {
      const ownsLease = online && this.room.hostEpoch === this.epoch && !this.saveFailed;
      const resumed = ownsLease && !this.store.state.isConnected;
      this.store.update({ isConnected: ownsLease, roomPaused: !ownsLease });
      if (ownsLease) { this.updateWires(); if (resumed) this.network.syncAll(); }
    } else if (!online || (this.playerEpoch && this.playerEpoch !== this.room.hostEpoch)) {
      if (this.playerWire || this.store.state.isConnected || this.store.state.joiningSession) this.pausePlayer();
    } else if (!this.playerWire && this.clock() >= (this.retryAt || 0)) this.connectPlayer();
  }
  async heartbeat() {
    if (!this.room || this.leaving || this.beating || (this.isKeeper && !this.serverConfirmed)) return;
    this.beating = true;
    try {
      if (this.isKeeper) { if (this.saveFailed) await this.persist(); else await this.service.heartbeat(this.room.id, this.epoch); }
      else if (this.playerWireId && this.store.state.joiningSession && this.clock() - this.connectStarted > 30000) { this.pausePlayer(); this.retryAt = this.clock() + 2000; }
      else if (this.playerWireId) await this.service.api.updateDoc(this.service.ref('rooms', this.room.id, 'wires', this.playerWireId), { seenAt: this.service.api.serverTimestamp() });
    } finally { this.beating = false; }
  }
  async kick(uid) {
    if (!this.isKeeper || uid === this.service.uid) throw new Error('Solo el Keeper propietario puede expulsar jugadores.');
    await this.service.setMemberStatus(this.room.id, uid, 'revoked');
  }
  async readmit(uid) { if (!this.isKeeper) throw new Error('Solo el Keeper puede readmitir.'); await this.service.setMemberStatus(this.room.id, uid, 'active'); }
  async rotate() { if (!this.isKeeper) throw new Error('Solo el Keeper puede regenerar la invitación.'); return this.service.rotateInvitation(this.room.id); }
  async deleteRoom(id = this.room?.id) {
    if (!id) throw new Error('No se ha especificado la sala a eliminar.');
    await this.service.deleteRoom(id);
    if (this.room?.id === id) {
      await this.leave({ preserveRemembered: false, save: false });
    }
    this.remember(null);
    this.emit();
  }
  fail(error) {
    this.lastError = roomError(error);
    if (!this.isKeeper) this.pausePlayer();
    else this.store.update({ isConnected: false, roomPaused: true, roomSaveStatus: 'error' });
    this.emit(); notify(this.lastError, 'error');
  }
  async leave({ preserveRemembered = false, save = true } = {}) {
    if (!this.room) return;
    this.leaving = true; clearTimeout(this.saveTimer); clearInterval(this.loadingHeartbeat);
    try {
      if (this.isKeeper && save) await this.persist();
      if (this.isKeeper && this.epoch) await this.service.release(this.room.id, this.epoch);
    } catch (error) { this.lastError = roomError(error); if (save) { this.leaving = false; throw error; } }
    if (!preserveRemembered) this.remember(null);
    ++this.generation; clearInterval(this.heartbeatTimer); clearInterval(this.presenceTimer);
    this.unsubscribers.splice(0).forEach(fn => fn());
    this.playerWire?.close();
    if (this.playerWireId) this.service.deleteWire(this.room.id, this.playerWireId).catch(() => {});
    this.playerWire = null; this.playerWireId = null; this.playerEpoch = null;
    for (const wire of this.wires.values()) wire.close(); this.wires.clear();
    this.network.disconnect(); this.room = null; this.members = []; this.wireRows = []; this.epoch = ''; this.serverConfirmed = false;
    this.store.update({ persistentRoomId: '', roomName: '', roomPaused: false, roomSaveStatus: '' });
    if (typeof document !== 'undefined') {
      const pHud = document.getElementById('vf-player-hud'); if (pHud) pHud.style.display = 'none';
      const kHud = document.getElementById('vf-keeper-hud'); if (kHud) kHud.style.display = 'none';
      const fBadge = document.getElementById('vf-shared-fear-badge'); if (fBadge) fBadge.remove();
    }
    this.leaving = false; this.emit();
  }
}
export const rooms = new RoomController();
account.subscribe(user => {
  if (rooms.room && (!user || user.isNetlify || user.uid !== rooms.service.uid)) rooms.leave({ save: false, preserveRemembered: true }).catch(error => rooms.fail(error));
});
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => {
  if (rooms.isKeeper) rooms.service.release(rooms.room.id, rooms.epoch).catch(() => {});
});

if (typeof window !== 'undefined') window.addEventListener('pageshow', event => {
  if (!event.persisted || !rooms.room || rooms.entering) return;
  const id = rooms.room.id;
  rooms.leave({ save: false, preserveRemembered: true }).then(() => rooms.enter(id)).catch(error => notify(roomError(error), 'error'));
});
