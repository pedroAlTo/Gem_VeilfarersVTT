import { LanPeer } from './lanPeer.js';
import { requireNetworkMode, LAN_SESSIONS } from './runtimeMode.js';
// Keeper-authoritative replication. No cross-room BroadcastChannel.
import PeerJS from 'peerjs';
import { store } from './state.js';
import { controlsToken, isDrone } from './tokenPermissions.js';
import { createActor, replaceActorSheet } from './actors.js';
import { portableCharacter } from './cloudAccount.js';
import { CAMPAIGN_KEYS, validTokenPatch, validateCampaign, finite } from './validation.js';
import { notify } from './ui.js';
const Peer = PeerJS?.Peer || PeerJS?.default || PeerJS;
import { newId as id } from './persistence.js';
export class NetworkManager {
  constructor({ stateStore = store, peerFactory } = {}) {
    this.store = stateStore;
    this.peerFactory = peerFactory ?? ((...args) => LAN_SESSIONS
      ? new LanPeer(import.meta.hot, args[0], this.invite)
      : new Peer(...args));
    this.seats = new Map();
    this.peer = null;
    this.connections = new Map();
    this.members = new Map();
    this.pending = new Map();
    this.hostConn = null;
    this.seen = new Set();
    this.invite = '';
    this.room = '';
    this.revision = 0;
    this.store.sendTokenPatch = (tokenId, partial) =>
      this.sendToHost({ type: 'TOKEN_UPDATE', tokenId, partial });
    this.store.subscribe((s, keys) => {
      if (s.isHosting && keys.some((k) => CAMPAIGN_KEYS.includes(k))) {
        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => this.syncAll(), 60);
      }
    });
  }
  envelope(message) {
    return { ...message, room: this.room, messageId: message.messageId || id() };
  }
  async hostSession(customCode) {
    requireNetworkMode();
    await this.store.ready;
    this.disconnect();
    this.room = customCode || `VEIL-${id().slice(0, 8).toUpperCase()}`;
    this.invite = id();
    this.lastRevision = -1;
    this.peer = this.peerFactory(this.room, { debug: 0 });
    const peer = this.peer;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.peer !== peer) return;
        this.disconnect();
        reject(new Error('Session connection timed out.'));
      }, 15000);
      this.peer.on('open', (peerId) => {
        if (this.peer !== peer) return;
        clearTimeout(timer);
        this.store.sessionRole = 'host';
        this.store.peerId = peerId;
        this.store.update({ isHosting: true, isConnected: true, roomCode: peerId, userRole: 'keeper' });
        resolve(peerId);
      });
      this.peer.on('connection', (conn) => { if (this.peer === peer) this.setupConnection(conn); else conn.close(); });
      this.peer.on('error', (err) => {
        if (this.peer !== peer) return;
        clearTimeout(timer);
        this.disconnect();
        notify(`Connection: ${err.message}`, 'error');
        reject(err);
      });
      this.peer.on('disconnected', () => {
        if (this.peer !== peer || this.closing) return;
        this.store.update({ isConnected: false });
        notify('Signalling disconnected. Reopen the session to reconnect.', 'error');
      });
    });
  }
  async joinSession(roomCode, playerName = 'Player', invite = '') {
    requireNetworkMode();
    if (!invite) throw new Error('An invitation key from the Keeper is required.');
    this.disconnect();
    await this.store.ready;
    await this.store.saveQueue;
    this.localCampaign = this.store.serializeCampaign();
    this.room = roomCode;
    this.invite = invite;
    this.lastRevision = -1;
    const seatKey = 'veil.resume.' + roomCode + '.' + invite;
    let resume = id();
    try { resume = window.sessionStorage.getItem(seatKey) || resume; window.sessionStorage.setItem(seatKey, resume); } catch {}
    this.store.sessionRole = 'player';
    this.store.update({
      userRole: 'player',
      gmVision: false,
      userName: playerName,
      joiningSession: true,
      isHosting: false,
      isConnected: false,
      roomCode,
    });
    this.peer = this.peerFactory({ debug: 0 });
    const peer = this.peer;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.peer !== peer) return;
        this.disconnect(new Error('The Keeper’s map did not arrive. Check the invitation, keep the host tab open and retry.'));
      }, 15000);
      this.joinFailed = error => { clearTimeout(timer); reject(error); };
      this.joinReady = () => {
        this.joinFailed = null;
        clearTimeout(timer);
        resolve(roomCode);
      };
      this.peer.on('open', (peerId) => {
        if (this.peer !== peer) return;
        this.store.peerId = peerId;
        const conn = this.peer.connect(roomCode, { reliable: true });
        this.hostConn = conn;
        conn.on('open', () =>
          conn.send(this.envelope({ type: 'HELLO', invite, resume, playerName: playerName.slice(0, 80) }))
        );
        conn.on('data', (data) => { if (this.hostConn === conn) this.handleIncomingMessage(data, conn.peer); });
        conn.on('close', () => {
          if (this.closing || this.hostConn !== conn || this.peer !== peer) return;
          if (this.joinFailed) { this.disconnect(new Error('The Keeper closed the connection before sending the map. Check the invitation or whether the table is full.')); return; }
          this.store.update({ isConnected: false });
          notify('Keeper disconnected. Your local campaign is preserved.', 'error');
        });
      });
      this.peer.on('error', (err) => {
        if (this.peer !== peer) return;
        clearTimeout(timer);
        this.disconnect(err);
        notify(err.message, 'error');
        reject(err);
      });
    });
  }
  setupConnection(conn) {
    const expiry = setTimeout(() => {
      if (!this.members.has(conn.peer)) conn.close();
    }, 10000);
    conn.on('data', (data) => {
      if (!this.members.has(conn.peer)) {
        if (data?.type !== 'HELLO' || data.room !== this.room || data.invite !== this.invite) {
          conn.close();
          return;
        }
        if (this.members.size >= 6) {
          conn.close();
          return;
        }
        clearTimeout(expiry);
        const resume = typeof data.resume === 'string' && /^[a-zA-Z0-9-]{20,100}$/.test(data.resume) ? data.resume : id();
        const memberId = this.seats.get(resume) || 'player_' + id();
        if ([...this.members.values()].some(m => m.id === memberId)) { conn.close(); return; }
        this.connections.set(conn.peer, conn);
        this.seats.set(resume, memberId);
        const name = String(data.playerName || 'Player').slice(0, 80);
        this.members.set(conn.peer, { id: memberId, name });
        this.store.update({ players: [...(this.store.state.players || []).filter(p => p.id !== memberId), { id: memberId, name }] });
        this.updatePeersList();
        this.syncPeer(conn);
        notify(`${data.playerName || 'Player'} joined. Assign their character in Session.`);
        return;
      }
      this.handleIncomingMessage(data, conn.peer);
    });
    conn.on('close', () => {
      clearTimeout(expiry);
      this.connections.delete(conn.peer);
      this.members.delete(conn.peer);
      this.updatePeersList();
    });
  }
  updatePeersList() {
    if (this.closing) return;
    this.store.update({ connectedPeers: [...this.members].map(([peerId, m]) => ({ id: m.id || peerId, name: m.name })) });
    this.syncAll();
  }
  snapshotFor(peerId) {
    const s = this.store.getState(),
      map = structuredClone(this.store.getActiveMap());
    map.walls = (map.walls || []).map((w) =>
      w.isSecret
        ? {
            id: w.id,
            x1: w.x1,
            y1: w.y1,
            x2: w.x2,
            y2: w.y2,
            wallType: 'wall',
            isDoor: false,
            isWindow: false,
            isOpen: false,
          }
        : w
    );
    const memberId = this.members.get(peerId)?.id || peerId;
    return {
      ...this.store.serializeCampaign(),
      logs: (s.logs || []).filter(entry => entry.visibility !== 'keeper').map(entry => structuredClone(entry)),
      memberId, connectedPeers: this.store.state.connectedPeers || [],
      maps: [map],
      tokens: s.tokens
        .filter((t) => t.mapId === s.activeMapId && !t.hidden)
        .map((t) => {
          const copy = structuredClone(t);
          if (!controlsToken(copy, memberId) && !copy.isPlayer && (copy.hideName || copy.actorType === 'adversary')) {
            copy.name = 'Unknown contact';
            copy.roleTag = 'Unidentified';
            copy.species = '';
            delete copy.sourceCharacter; delete copy.featureNotes;
          }
          return copy;
        }),
      clocks: s.clocks.filter((c) => !c.isKeeperOnly),
      handouts: s.handouts.filter((h) => h.sharedWithPlayers),
      claimedTokenId: s.tokens.find((t) => !isDrone(t) && t.ownerId === memberId)?.id || null,
    };
  }
  syncPeer(conn) {
    if (conn.open)
      conn.send(
        this.envelope({
          type: 'INITIAL_STATE',
          revision: ++this.revision,
          state: this.snapshotFor(conn.peer),
        })
      );
  }
  syncAll() {
    if (!this.store.state.isHosting) return;
    for (const conn of this.connections.values()) this.syncPeer(conn);
  }
  assignToken(playerId, tokenId) {
    if (!this.store.state.isHosting) return;
    const memberId = this.members.get(playerId)?.id || playerId;
    if (!tokenId) {
      this.store.update({ tokens: this.store.state.tokens.map(t => !isDrone(t) && t.ownerId === memberId ? { ...t, ownerId: '' } : t) });
    } else this.store.assignTokenControllers(tokenId, [memberId]);
    this.syncAll();
  }
  async importCharacter(token) {
    if (this.store.sessionRole !== 'player') throw new Error('Join a game first.');
    return this.request('IMPORT_CHARACTER', { token: portableCharacter(token) });
  }
  request(type, payload) {
    if (!this.store.state.isConnected) return Promise.reject(new Error('Not connected to the Keeper.'));
    const requestId = id();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('Request timed out. Check your connection.')); }, 10000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.sendToHost({ type, requestId, ...payload });
    });
  }
  acceptCharacter(token, playerId) {
    if (!token || JSON.stringify(token).length > 500000) throw new Error('Character must be smaller than 500 KB.');
    const safe = portableCharacter(token);
    if (safe.actorType !== 'player' && safe.isPlayer !== true) throw new Error('Import a player character. The Keeper creates drones and NPCs.');
    safe.actorType = 'player'; safe.isPlayer = true;
    const created = createActor(safe, this.store.state.activeMapId);
    const existing = this.store.state.tokens.find(t => !isDrone(t) && t.ownerId === playerId);
    const actor = existing ? replaceActorSheet(existing, created) : { ...created, ownerId: playerId };
    const tokens = existing ? this.store.state.tokens.map(t => t.id === actor.id ? actor : t) : [...this.store.state.tokens, actor];
    validateCampaign({ ...this.store.serializeCampaign(), tokens });
    this.store.update({ tokens });
    this.syncAll();
    return { tokenId: actor.id };
  }
  broadcast(message) {
    if (message.type === 'DICE_ROLL' && (message.logEntry?.visibility === 'keeper' || message.result?.visibility === 'keeper')) return;
    if (this.store.sessionRole === 'player') {
      this.sendToHost(message);
      return;
    }
    if (!this.store.state.isHosting) return;
    // State changes are replicated from the authoritative store, always filtered.
    if (
      [
        'INITIAL_STATE',
        'TOKEN_CREATE',
        'TOKEN_UPDATE',
        'TOKEN_DELETE',
        'TOKEN_MOVE',
        'WALL_UPDATE',
        'MAP_CHANGE',
        'CLOCK_UPDATE',
        'FEAR_UPDATE',
        'STARSHIP_UPDATE',
      ].includes(message.type)
    ) {
      this.syncAll();
      return;
    }
    if (['DICE_ROLL', 'PING', 'SPECIAL_FX', 'TRANSMISSION', 'ANNOUNCEMENT'].includes(message.type))
      for (const conn of this.connections.values())
        if (conn.open) conn.send(this.envelope(message));
  }
  sendToHost(message) {
    if (this.hostConn?.open) this.hostConn.send(this.envelope(message));
    else notify('Not connected to the Keeper.', 'error');
  }
  async requestAction(action) {
    if (this.store.sessionRole !== 'player') return this.performAction(action);
    if (!this.store.state.isConnected) throw new Error('Not connected to the Keeper.');
    const requestId = id();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Action timed out. Reconnect before trying again.'));
      }, 10000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.sendToHost({ type: 'ACTION', requestId, action });
    });
  }
  async performAction(action) {
    const { performGameAction } = await import('./gameActions.js');
    const result = performGameAction(action, this.store);
    if (result.log && result.log.visibility !== 'keeper') this.broadcast({ type: 'DICE_ROLL', logEntry: result.log, result: { id: result.id, actorId: result.actorId, hopeVal: result.hopeVal, fearVal: result.fearVal, total: result.total } });
    return result;
  }
  async handleIncomingMessage(data, senderId) {
    if (
      !data ||
      data.room !== this.room ||
      typeof data.messageId !== 'string' ||
      this.seen.has(data.messageId)
    )
      return;
    this.seen.add(data.messageId);
    if (this.seen.size > 2000) this.seen.delete(this.seen.values().next().value);
    if (this.store.sessionRole === 'player') {
      if (senderId !== this.hostConn?.peer) return;
      if (data.type === 'INITIAL_STATE') {
        try {
          if (Number.isFinite(data.revision) && data.revision <= this.lastRevision) return;
          const s = validateCampaign(data.state);
          this.lastRevision = data.revision;
          this.store.memberId = data.state.memberId || this.store.peerId;
          const assigned = s.tokens.filter(t => controlsToken(t, this.store.memberId));
          const selectedId = assigned.some(t => t.id === this.store.state.selectedTokenId) ? this.store.state.selectedTokenId : data.state.claimedTokenId || assigned[0]?.id || null;
          const newAssignment = selectedId !== this.store.state.selectedTokenId;
          this.store.remoteApplying = true;
          this.store.update({
            ...s,
            userRole: 'player',
            gmVision: false,
            isConnected: true,
            joiningSession: false,
            claimedTokenId: data.state.claimedTokenId,
            selectedTokenId: selectedId,
            ...(newAssignment || !['select', 'measure', 'template', 'fx', 'ping'].includes(this.store.state.activeTool) ? { activeTool: 'select', activeLayer: 'tokens' } : {}),
          });
          this.store.validateSelections();
          this.joinReady?.();
          this.joinReady = null;
        } catch (e) {
          if (this.joinFailed) this.disconnect(new Error('Could not open the Keeper’s map: ' + e.message));
          else notify(`Invalid session state: ${e.message}`, 'error');
        } finally {
          this.store.remoteApplying = false;
        }
      } else if (data.type === 'ACTION_RESULT') {
        const p = this.pending.get(data.requestId);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(data.requestId);
          data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
        }
      } else this.ephemeral(data);
      return;
    }
    if (!this.store.state.isHosting || !this.members.has(senderId)) return;
    const owns = (tokenId) =>
      this.store.state.tokens.some(
        (t) => t.id === tokenId && controlsToken(t, this.members.get(senderId)?.id || senderId)
      );
    if (data.type === 'IMPORT_CHARACTER') {
      const conn = this.connections.get(senderId);
      try {
        const result = this.acceptCharacter(data.token, this.members.get(senderId)?.id || senderId);
        conn?.send(this.envelope({ type: 'ACTION_RESULT', requestId: data.requestId, result }));
      } catch (error) { conn?.send(this.envelope({ type: 'ACTION_RESULT', requestId: data.requestId, error: error.message })); }
      return;
    }
    if (data.type === 'TOKEN_UPDATE' || data.type === 'TOKEN_MOVE') {
      const partial = data.type === 'TOKEN_MOVE' ? { x: data.x, y: data.y } : data.partial;
      if (owns(data.tokenId) && validTokenPatch(partial)) {
        const token = this.store.state.tokens.find((t) => t.id === data.tokenId);
        for (const k of ['hp', 'armor', 'stress', 'resolve'])
          if (partial[k]) {
            if (partial[k].max !== token[k]?.max) return;
            for (const field of Object.keys(partial[k]))
              if (field !== 'current' && partial[k][field] !== token[k]?.[field]) return;
            partial[k] = { ...token[k], current: partial[k].current };
          }
        this.store.updateToken(data.tokenId, partial);
        this.syncAll();
      }
      return;
    }
    if (data.type === 'ACTION') {
      const conn = this.connections.get(senderId);
      try {
        if (
          data.action?.visibility === 'keeper' || !owns(data.action?.actorId) ||
          !['CHECK', 'EFFORT', 'RESOLVE', 'CONDITION'].includes(data.action?.type)
        )
          throw new Error('This character is not assigned to you.');
        const result = await this.performAction(data.action);
        this.syncAll();
        conn?.send(this.envelope({ type: 'ACTION_RESULT', requestId: data.requestId, result }));
      } catch (e) {
        conn?.send(
          this.envelope({ type: 'ACTION_RESULT', requestId: data.requestId, error: e.message })
        );
      }
      return;
    }
    if (data.type === 'PING' && finite(data.x) && finite(data.y)) {
      this.ephemeral(data);
      this.broadcast(data);
    }
  }
  ephemeral(data) {
    // The authoritative snapshot contains logs; the event is only for presentation.
    if (data.type === 'DICE_ROLL' && data.result) window.dispatchEvent(new CustomEvent('veil:remote-roll', { detail: data.result }));
    if (data.type === 'ANNOUNCEMENT' && typeof data.text === 'string') window.dispatchEvent(new CustomEvent('veil:announcement', { detail: data.text.slice(0, 2000) }));
    if (data.type === 'PING' && finite(data.x) && finite(data.y))
      window.veilCanvas?.triggerPing(data.x, data.y, '#72d9f5');
    if (data.type === 'TRANSMISSION' && data.handout)
      window.dispatchEvent(
        new CustomEvent('veil:incoming_transmission', { detail: { handout: data.handout } })
      );
    if (data.type === 'SPECIAL_FX' && data.params)
      window.veilCanvas?.triggerFX(data.fxType, data.params);
  }
  disconnect(reason = new Error('Session closed. Check the invitation and try again.')) {
    this.closing = true;
    clearTimeout(this.syncTimer);
    const peer = this.peer;
    this.peer = null;
    peer?.destroy();
    this.hostConn = null;
    this.connections.clear();
    this.members.clear();
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('Session closed'));
    }
    this.pending.clear();
    this.seen.clear();
    this.joinReady = null;
    this.joinFailed?.(reason); this.joinFailed = null;
    this.seats.clear(); this.room = ''; this.invite = ''; this.store.memberId = null;
    this.store.sessionRole = 'local';
    if (this.localCampaign) {
      this.store.update(this.localCampaign);
      this.localCampaign = null;
    }
    this.store.update({
      isHosting: false,
      isConnected: false,
      roomCode: '',
      joiningSession: false,
      connectedPeers: [],
      userRole: 'keeper',
      gmVision: true,
    });
    this.store.validateSelections();
    this.closing = false;
  }
}
export const network = new NetworkManager();
