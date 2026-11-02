import { requireNetworkMode } from './runtimeMode.js';
// Keeper-authoritative replication. No cross-room BroadcastChannel.
import PeerJS from 'peerjs';
import { store } from './state.js';
import { CAMPAIGN_KEYS, validTokenPatch, validateCampaign, finite } from './validation.js';
import { notify } from './ui.js';
const Peer = PeerJS?.Peer || PeerJS?.default || PeerJS;
import { newId as id } from './persistence.js';
export class NetworkManager {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.members = new Map();
    this.pending = new Map();
    this.hostConn = null;
    this.seen = new Set();
    this.invite = '';
    this.room = '';
    this.revision = 0;
    store.sendTokenPatch = (tokenId, partial) =>
      this.sendToHost({ type: 'TOKEN_UPDATE', tokenId, partial });
    store.subscribe((s, keys) => {
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
    this.disconnect();
    this.room = customCode || `VEIL-${id().slice(0, 8).toUpperCase()}`;
    this.invite = id();
    this.peer = new Peer(this.room, { debug: 0 });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.disconnect();
        reject(new Error('Session connection timed out.'));
      }, 15000);
      this.peer.on('open', (peerId) => {
        clearTimeout(timer);
        store.sessionRole = 'host';
        store.peerId = peerId;
        store.update({ isHosting: true, isConnected: true, roomCode: peerId, userRole: 'keeper' });
        resolve(peerId);
      });
      this.peer.on('connection', (conn) => this.setupConnection(conn));
      this.peer.on('error', (err) => {
        clearTimeout(timer);
        notify(`Connection: ${err.message}`, 'error');
        reject(err);
      });
      this.peer.on('disconnected', () => {
        if (!this.peer || this.closing) return;
        store.update({ isConnected: false });
        notify('Signalling disconnected. Reopen the session to reconnect.', 'error');
      });
    });
  }
  async joinSession(roomCode, playerName = 'Player', invite = '') {
    requireNetworkMode();
    if (!invite) throw new Error('An invitation key from the Keeper is required.');
    this.disconnect();
    await store.saveQueue;
    this.localCampaign = store.serializeCampaign();
    this.room = roomCode;
    this.invite = invite;
    store.sessionRole = 'player';
    store.update({
      userRole: 'player',
      gmVision: false,
      userName: playerName,
      isHosting: false,
      isConnected: false,
      roomCode,
    });
    this.peer = new Peer({ debug: 0 });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.disconnect();
        notify('Connection timed out. Check the invitation and try again.', 'error');
        reject(new Error('Connection timed out'));
      }, 15000);
      this.joinReady = () => {
        clearTimeout(timer);
        resolve(roomCode);
      };
      this.peer.on('open', (peerId) => {
        store.peerId = peerId;
        const conn = this.peer.connect(roomCode, { reliable: true });
        this.hostConn = conn;
        conn.on('open', () =>
          conn.send(this.envelope({ type: 'HELLO', invite, playerName: playerName.slice(0, 80) }))
        );
        conn.on('data', (data) => this.handleIncomingMessage(data, conn.peer));
        conn.on('close', () => {
          store.update({ isConnected: false });
          notify('Keeper disconnected. Your local campaign is preserved.', 'error');
        });
      });
      this.peer.on('error', (err) => {
        clearTimeout(timer);
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
        this.connections.set(conn.peer, conn);
        this.members.set(conn.peer, { name: String(data.playerName || 'Player').slice(0, 80) });
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
    store.update({ connectedPeers: [...this.members].map(([id, m]) => ({ id, name: m.name })) });
  }
  snapshotFor(peerId) {
    const s = store.getState(),
      map = structuredClone(store.getActiveMap());
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
    return {
      ...store.serializeCampaign(),
      maps: [map],
      tokens: s.tokens
        .filter((t) => t.mapId === s.activeMapId && !t.hidden)
        .map((t) => {
          const copy = structuredClone(t);
          if (!copy.isPlayer && (copy.hideName || copy.actorType === 'adversary')) {
            copy.name = 'Unknown contact';
            copy.roleTag = 'Unidentified';
            copy.species = '';
          }
          return copy;
        }),
      clocks: s.clocks.filter((c) => !c.isKeeperOnly),
      handouts: s.handouts.filter((h) => h.sharedWithPlayers),
      claimedTokenId: s.tokens.find((t) => t.ownerId === peerId)?.id || null,
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
    if (!store.state.isHosting) return;
    for (const conn of this.connections.values()) this.syncPeer(conn);
  }
  assignToken(peerId, tokenId) {
    if (!store.state.isHosting || !this.members.has(peerId)) return;
    for (const token of store.state.tokens)
      if (token.ownerId === peerId) store.updateToken(token.id, { ownerId: '' });
    const t = store.state.tokens.find((t) => t.id === tokenId && t.isPlayer);
    if (t) store.updateToken(t.id, { ownerId: peerId });
    this.syncAll();
  }
  broadcast(message) {
    if (store.sessionRole === 'player') {
      this.sendToHost(message);
      return;
    }
    if (!store.state.isHosting) return;
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
    if (['DICE_ROLL', 'PING', 'SPECIAL_FX', 'TRANSMISSION'].includes(message.type))
      for (const conn of this.connections.values())
        if (conn.open) conn.send(this.envelope(message));
  }
  sendToHost(message) {
    if (this.hostConn?.open) this.hostConn.send(this.envelope(message));
    else notify('Not connected to the Keeper.', 'error');
  }
  async requestAction(action) {
    if (store.sessionRole !== 'player') return this.performAction(action);
    if (!store.state.isConnected) throw new Error('Not connected to the Keeper.');
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
    const result = performGameAction(action);
    if (result.log) this.broadcast({ type: 'DICE_ROLL', logEntry: result.log });
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
    if (store.sessionRole === 'player') {
      if (senderId !== this.hostConn?.peer) return;
      if (data.type === 'INITIAL_STATE') {
        try {
          const s = validateCampaign(data.state);
          store.remoteApplying = true;
          store.update({
            ...s,
            userRole: 'player',
            gmVision: false,
            isConnected: true,
            claimedTokenId: data.state.claimedTokenId,
            selectedTokenId: s.tokens.some((t) => t.id === store.state.selectedTokenId)
              ? store.state.selectedTokenId
              : data.state.claimedTokenId,
          });
          store.validateSelections();
          this.joinReady?.();
          this.joinReady = null;
        } catch (e) {
          notify(`Invalid session state: ${e.message}`, 'error');
        } finally {
          store.remoteApplying = false;
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
    if (!store.state.isHosting || !this.members.has(senderId)) return;
    const owns = (tokenId) =>
      store.state.tokens.some(
        (t) => t.id === tokenId && t.isPlayer && t.ownerId === senderId && !t.hidden
      );
    if (data.type === 'TOKEN_UPDATE' || data.type === 'TOKEN_MOVE') {
      const partial = data.type === 'TOKEN_MOVE' ? { x: data.x, y: data.y } : data.partial;
      if (owns(data.tokenId) && validTokenPatch(partial)) {
        const token = store.state.tokens.find((t) => t.id === data.tokenId);
        for (const k of ['hp', 'armor', 'stress', 'resolve'])
          if (partial[k]) {
            if (partial[k].max !== token[k]?.max) return;
            for (const field of Object.keys(partial[k]))
              if (field !== 'current' && partial[k][field] !== token[k]?.[field]) return;
            partial[k] = { ...token[k], current: partial[k].current };
          }
        store.updateToken(data.tokenId, partial);
        this.syncAll();
      }
      return;
    }
    if (data.type === 'ACTION') {
      const conn = this.connections.get(senderId);
      try {
        if (
          !owns(data.action?.actorId) ||
          !['CHECK', 'EFFORT', 'RESOLVE'].includes(data.action?.type)
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
    if (data.type === 'DICE_ROLL' && data.logEntry) store.addLog(data.logEntry);
    if (data.type === 'PING' && finite(data.x) && finite(data.y))
      window.veilCanvas?.triggerPing(data.x, data.y, '#72d9f5');
    if (data.type === 'TRANSMISSION' && data.handout)
      window.dispatchEvent(
        new CustomEvent('veil:incoming_transmission', { detail: { handout: data.handout } })
      );
    if (data.type === 'SPECIAL_FX' && data.params)
      window.veilCanvas?.triggerFX(data.fxType, data.params);
  }
  disconnect() {
    this.closing = true;
    clearTimeout(this.syncTimer);
    const peer = this.peer;
    this.peer = null;
    peer?.destroy();
    this.closing = false;
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
    store.sessionRole = 'local';
    if (this.localCampaign) {
      store.update(this.localCampaign);
      this.localCampaign = null;
    }
    store.update({
      isHosting: false,
      isConnected: false,
      roomCode: '',
      connectedPeers: [],
      userRole: 'keeper',
      gmVision: true,
    });
  }
}
export const network = new NetworkManager();
