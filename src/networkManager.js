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
import { TABLE, KEEPER, chatRequest, validateChatEntry, chatVisibleTo, chatHistoryFor, appendChat } from './chat.js';
const Peer = PeerJS?.Peer || PeerJS?.default || PeerJS;
import { newId as id } from './persistence.js';

export const SESSION_PERSIST_KEY = 'veil_active_session';

export function getActiveSession() {
  try {
    const raw = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_PERSIST_KEY)) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem(SESSION_PERSIST_KEY));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveActiveSession(sessionData) {
  try {
    const payload = JSON.stringify({ ...sessionData, timestamp: Date.now() });
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SESSION_PERSIST_KEY, payload);
    if (typeof localStorage !== 'undefined') localStorage.setItem(SESSION_PERSIST_KEY, payload);
  } catch {}
}

export function clearActiveSession() {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SESSION_PERSIST_KEY);
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_PERSIST_KEY);
  } catch {}
}

export const INVITED_SESSIONS_KEY = 'veil_invited_sessions';

export function getInvitedSessions() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(INVITED_SESSIONS_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveInvitedSession({ room, invite, playerName, campaignName }) {
  if (!room) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const existing = getInvitedSessions().filter(s => s.room?.toUpperCase() !== room?.toUpperCase());
    const updated = [
      {
        room: room.toUpperCase(),
        invite: invite || room,
        playerName: playerName || 'Player',
        campaignName: campaignName || room,
        lastVisited: Date.now()
      },
      ...existing
    ].slice(0, 8);
    localStorage.setItem(INVITED_SESSIONS_KEY, JSON.stringify(updated));
  } catch {}
}

export function removeInvitedSession(room) {
  try {
    if (typeof localStorage === 'undefined') return;
    const filtered = getInvitedSessions().filter(s => s.room?.toUpperCase() !== room?.toUpperCase());
    localStorage.setItem(INVITED_SESSIONS_KEY, JSON.stringify(filtered));
  } catch {}
}

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
    this.mapLoadStatuses = new Map();
    this.kickedMembers = new Set();
    this.invite = '';
    this.room = '';
    this.revision = 0;
    this.tokenPatchSequence = 0;
    this.tokenPatchAcks = new Map();
    this.pendingTokenPatches = new Map();
    this.authoritativeTokens = null;
    this.store.confirmedTokens = () => this.store.sessionRole === 'player' && this.authoritativeTokens ? this.authoritativeTokens : this.store.state.tokens;
    this.store.sendTokenPatch = (tokenId, partial) =>
      this.queueTokenPatch(tokenId, partial);
    this.store.subscribe((s, keys) => {
      if (s.isHosting && keys.some((k) => k !== 'chatMessages' && CAMPAIGN_KEYS.includes(k))) {
        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => this.syncAll(), 60);
      }
    });
  }
  envelope(message) {
    return { ...message, room: this.room, messageId: message.messageId || id() };
  }
  saveSeats() {
    try {
      if (typeof sessionStorage !== 'undefined' && this.room) {
        const obj = Object.fromEntries(this.seats.entries());
        sessionStorage.setItem('veil.host_seats.' + this.room, JSON.stringify(obj));
      }
    } catch {}
  }
  loadSeats(room) {
    const seats = new Map();
    try {
      if (typeof sessionStorage !== 'undefined' && room) {
        const raw = sessionStorage.getItem('veil.host_seats.' + room);
        if (raw) {
          const parsed = JSON.parse(raw);
          for (const [k, v] of Object.entries(parsed)) seats.set(k, v);
        }
      }
    } catch {}
    return seats;
  }
  leaveSession(reason = new Error('Session closed.')) {
    clearActiveSession();
    return this.disconnect(reason, { clearPersist: true });
  }
  async hostSession(customCode) {
    requireNetworkMode();
    await this.store.ready;
    this.disconnect();
    if (customCode) {
      this.room = customCode.toUpperCase();
    } else {
      const rawName = (this.store.state.campaignName || 'VTT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const prefix = (rawName.slice(0, 3) || 'VTT').padEnd(3, 'X');
      const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
      this.room = `${prefix}-${randomPart}`;
    }
    this.invite = this.room;
    this.seats = this.loadSeats(this.room);
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
        saveActiveSession({
          role: 'host',
          room: this.room,
          invite: this.invite,
          campaignName: this.store.state.campaignName,
          optionalEfforts: Boolean(this.store.state.optionalEfforts)
        });
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
    const normRoom = String(roomCode || '').trim().toUpperCase();
    this.room = normRoom;
    this.invite = invite;
    this.lastRevision = -1;
    const seatKey = 'veil.resume.' + normRoom + '.' + invite;
    let resume = id();
    try { resume = window.sessionStorage.getItem(seatKey) || resume; window.sessionStorage.setItem(seatKey, resume); } catch {}
    this.store.sessionRole = 'player';
    this.store.update({
      userRole: 'player',
      gmVision: false,
      userName: playerName,
      playerName: playerName,
      joiningSession: true,
      isHosting: false,
      isConnected: false,
      roomCode: normRoom,
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
        saveActiveSession({
          role: 'player',
          room: normRoom,
          invite,
          playerName,
          isObserver: Boolean(this.store.state.isObserver)
        });
        saveInvitedSession({
          room: normRoom,
          invite,
          playerName,
          campaignName: this.store.state.campaignName
        });
        resolve(normRoom);
      };
      this.peer.on('open', (peerId) => {
        if (this.peer !== peer) return;
        this.store.peerId = peerId;
        const conn = this.peer.connect(normRoom, { reliable: true });
        this.hostConn = conn;
        conn.on('open', () =>
          conn.send(this.envelope({ type: 'HELLO', invite, resume, playerName: playerName.slice(0, 80) }))
        );
        conn.on('data', (data) => { if (this.hostConn === conn) this.handleIncomingMessage(data, conn.peer); });
        conn.on('close', () => {
          if (this.closing || this.hostConn !== conn || this.peer !== peer) return;
          if (this.joinFailed) { this.disconnect(new Error('The Keeper closed the connection before sending the map. Check the invitation or whether the table is full.')); return; }
          this.store.update({ isConnected: false });
          this.clearTokenPatches(true);
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
        const roomMatches = String(data?.room || '').toUpperCase() === String(this.room || '').toUpperCase();
        const inviteMatches = !data?.invite || data.invite === this.invite || data.invite === this.room ||
          String(data.invite).toUpperCase() === String(this.invite).toUpperCase() ||
          String(data.invite).toUpperCase() === String(this.room).toUpperCase();
        if (data?.type !== 'HELLO' || !roomMatches || !inviteMatches) {
          conn.close();
          return;
        }

        const name = String(data.playerName || 'Player').slice(0, 80);
        const resume = typeof data.resume === 'string' && /^[a-zA-Z0-9-]{20,100}$/.test(data.resume) ? data.resume : id();
        const existingMemberByResume = this.seats.get(resume);
        const existingMemberByName = (this.store.state.players || []).find(p => p.name === name)?.id;
        const memberId = existingMemberByResume || existingMemberByName || 'player_' + id();

        if (this.kickedMembers.has(memberId) || this.kickedMembers.has(resume) || this.kickedMembers.has(conn.peer)) {
          conn.close();
          return;
        }

        const isReconnecting = Boolean(existingMemberByResume || existingMemberByName);
        if (!isReconnecting && this.members.size >= 6) {
          conn.close();
          return;
        }

        clearTimeout(expiry);

        // Evict old stale peer connection for this member if reconnecting
        for (const [oldPeerId, oldMember] of this.members.entries()) {
          if ((oldMember.id === memberId || oldPeerId === conn.peer) && oldPeerId !== conn.peer) {
            const oldConn = this.connections.get(oldPeerId);
            this.connections.delete(oldPeerId);
            this.members.delete(oldPeerId);
            this.tokenPatchAcks.delete(oldPeerId);
            try { oldConn?.close(); } catch {}
          }
        }

        this.connections.set(conn.peer, conn);
        this.seats.set(resume, memberId);
        this.saveSeats();
        this.members.set(conn.peer, { id: memberId, name });
        const activeMap = this.store.getActiveMap();
        const initialStatus = {
          peerId: memberId,
          memberId,
          name,
          role: 'player',
          mapId: activeMap?.id || '',
          progress: 0,
          loaded: false,
          text: 'Descargando escena...',
          updatedAt: Date.now()
        };
        this.mapLoadStatuses.set(memberId, initialStatus);
        this.mapLoadStatuses.set(conn.peer, initialStatus);
        this.mapLoadStatuses.set(name, initialStatus);
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
      this.tokenPatchAcks.delete(conn.peer);
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
      chatMessages: chatHistoryFor(s.chatMessages, memberId),
      memberId, connectedPeers: this.store.state.connectedPeers || [],
      maps: [map],
      arcs: (s.arcs || []).filter(a => a.sceneIds?.includes(map.id)).map(a => ({ id: a.id, name: a.name, description: '', sceneIds: [map.id], tokenIds: [], images: [] })),
      tokens: s.tokens
        .filter((t) => t.mapId === s.activeMapId && !t.hidden)
        .map((t) => {
          const copy = structuredClone(t);
          if (copy.boss) {
            copy.bossStatus = { index: copy.boss.index, total: copy.boss.states.length, name: copy.boss.states[copy.boss.index].name, defeated: !!copy.boss.defeated, pending: !copy.boss.defeated && (copy.boss.index < copy.boss.states.length - 1 || copy.boss.states[copy.boss.index].defeat === 'objective') };
            delete copy.boss;
          }
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
    if (conn.open) {
      conn.send(
        this.envelope({
          type: 'INITIAL_STATE',
          revision: ++this.revision,
          tokenPatchAck: this.tokenPatchAcks.get(conn.peer) || 0,
          state: this.snapshotFor(conn.peer),
        })
      );
      const activeMap = this.store.getActiveMap();
      if (activeMap) {
        conn.send(
          this.envelope({
            type: 'MAP_LOAD_STATUS',
            peerId: 'keeper',
            name: 'Keeper',
            role: 'keeper',
            mapId: activeMap.id,
            progress: 100,
            loaded: true,
            text: 'Matriz cargada al 100%',
            updatedAt: Date.now()
          })
        );
      }
    }
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
  kickPlayer(playerId, reason = 'Has sido expulsado de la sesión por el Director de Juego.') {
    if (!this.store.state.isHosting) return false;
    let targetPeerId = null;
    let targetMember = null;
    for (const [peerId, member] of this.members.entries()) {
      if (member.id === playerId || peerId === playerId) {
        targetPeerId = peerId;
        targetMember = member;
        break;
      }
    }

    const memberId = targetMember?.id || playerId;
    this.kickedMembers.add(memberId);
    if (targetPeerId) this.kickedMembers.add(targetPeerId);

    for (const [resume, mId] of this.seats.entries()) {
      if (mId === memberId) {
        this.kickedMembers.add(resume);
        this.seats.delete(resume);
      }
    }

    // Unassign tokens controlled by this player (owned and shared drones)
    this.store.update({
      tokens: (this.store.state.tokens || []).map(t => {
        let changed = false;
        let updated = t;
        if (!isDrone(t) && t.ownerId === memberId) {
          updated = { ...updated, ownerId: '' };
          changed = true;
        }
        if (t.controllerIds?.includes(memberId)) {
          updated = { ...updated, controllerIds: t.controllerIds.filter(id => id !== memberId) };
          changed = true;
        }
        return changed ? updated : t;
      }),
      players: (this.store.state.players || []).filter(p => p.id !== memberId && p.id !== playerId)
    });

    if (targetPeerId) {
      const conn = this.connections.get(targetPeerId);
      if (conn && conn.open) {
        try {
          conn.send(this.envelope({
            type: 'KICKED',
            reason
          }));
        } catch {}
        setTimeout(() => {
          try { conn.close(); } catch {}
        }, 50);
      }
      this.connections.delete(targetPeerId);
      this.members.delete(targetPeerId);
      this.mapLoadStatuses?.delete(memberId);
      this.mapLoadStatuses?.delete(targetPeerId);
    }

    this.updatePeersList();
    this.syncAll();
    notify(`👢 ${targetMember?.name || 'El jugador'} ha sido expulsado de la sesión.`);
    return true;
  }
  async importCharacter(token) {
    if (this.store.sessionRole !== 'player') throw new Error('Join a game first.');
    return this.request('IMPORT_CHARACTER', { token: portableCharacter(token) });
  }
  async claimToken(tokenId) {
    if (this.store.sessionRole !== 'player') {
      this.store.assignTokenControllers(tokenId, [this.store.memberId || 'keeper']);
      return { claimed: true, tokenId };
    }
    return this.request('CLAIM_TOKEN', { tokenId });
  }
  async sendChat({ text, recipientId = TABLE, clientId = id() }) {
    const payload = chatRequest({ text, recipientId, clientId });
    if (this.store.sessionRole === 'player') {
      if (![TABLE, KEEPER].includes(recipientId)) throw new Error('Los susurros se envían al Keeper.');
      return this.request('CHAT_SEND', payload);
    }
    if (this.store.state.userRole !== 'keeper') throw new Error('Únete a una sesión para escribir como jugador.');
    if (this.store.state.isHosting && !this.store.state.isConnected) throw new Error('Sin conexión. Reconecta la sesión antes de enviar.');
    return this.acceptChat(payload, KEEPER);
  }
  acceptChat(input, senderId) {
    const payload = chatRequest(input), members = [...this.members].filter(([peerId]) => this.connections.get(peerId)?.open).map(([, member]) => member);
    const sender = senderId === KEEPER ? { id: KEEPER, name: 'Keeper' } : members.find(m => m.id === senderId);
    if (!sender) throw new Error('Jugador no conectado.');
    if (senderId !== KEEPER && ![TABLE, KEEPER].includes(payload.recipientId)) throw new Error('Los susurros se envían al Keeper.');
    const previous = (this.store.state.chatMessages || []).find(m => m.senderId === senderId && m.clientId === payload.clientId);
    if (previous) {
      if (previous.text !== payload.text || previous.recipientId !== payload.recipientId) throw new Error('Identificador de mensaje ya utilizado.');
      return previous; // An acknowledgement may have been lost; never post twice.
    }
    const recipient = payload.recipientId === TABLE ? { id: TABLE, name: 'Mesa' }
      : payload.recipientId === KEEPER ? { id: KEEPER, name: 'Keeper' }
        : members.find(m => m.id === payload.recipientId);
    if (!recipient || recipient.id === senderId ||
        (recipient.id !== TABLE && senderId === KEEPER && !this.store.state.isConnected)) {
      throw new Error('El destinatario está desconectado. El susurro no se ha enviado.');
    }
    const entry = validateChatEntry({ ...payload, id: id(), senderId, senderName: sender.name.trim() || 'Player', recipientName: recipient.name.trim() || 'Player', sentAt: Date.now() });
    this.store.update({ chatMessages: appendChat(this.store.state.chatMessages, entry) });
    // Deliberately separate from broadcast: private contents only enter participant sockets.
    for (const [peerId, conn] of this.connections) {
      if (conn.open && chatVisibleTo(entry, this.members.get(peerId)?.id)) conn.send(this.envelope({ type: 'CHAT_MESSAGE', entry }));
    }
    return entry;
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
    if (['DICE_ROLL', 'PING', 'SPECIAL_FX', 'ATTACK_FX', 'TARGET_SELECT', 'TRANSMISSION', 'ANNOUNCEMENT', 'MAP_LOAD_STATUS'].includes(message.type))
      for (const conn of this.connections.values())
        if (conn.open) conn.send(this.envelope(message));
  }
  broadcastMapLoadStatus({ mapId, progress, loaded, text }) {
    const memberId = this.store.memberId || this.store.peerId || 'local';
    const name = this.store.state.userRole === 'keeper' ? 'Keeper' : (this.store.state.userName || this.store.state.playerName || 'Operativo');
    const isReady = loaded ?? (progress >= 100);
    const status = {
      type: 'MAP_LOAD_STATUS',
      peerId: memberId,
      memberId,
      name,
      role: this.store.state.userRole,
      mapId,
      progress: isReady ? 100 : Math.round(progress),
      loaded: Boolean(isReady),
      text: text || (isReady ? 'Matriz cargada al 100%' : `${Math.round(progress)}%`),
      updatedAt: Date.now()
    };
    this.mapLoadStatuses.set(memberId, status);
    this.mapLoadStatuses.set('local', status);
    if (this.store.memberId) this.mapLoadStatuses.set(this.store.memberId, status);
    if (this.store.peerId) this.mapLoadStatuses.set(this.store.peerId, status);
    if (name) this.mapLoadStatuses.set(name, status);
    if (this.store.state.userName) this.mapLoadStatuses.set(this.store.state.userName, status);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('veil:map-load-status', { detail: status }));
    }

    if (this.store.sessionRole === 'player') {
      if (this.hostConn?.open) {
        this.hostConn.send(this.envelope(status));
      }
    } else if (this.store.state.isHosting) {
      for (const conn of this.connections.values()) {
        if (conn.open) conn.send(this.envelope(status));
      }
    }
  }
  sendToHost(message) {
    if (this.hostConn?.open) { this.hostConn.send(this.envelope(message)); return true; }
    notify('Not connected to the Keeper.', 'error');
    return false;
  }
  queueTokenPatch(tokenId, partial) {
    const state = this.store.state, token = state.tokens.find(t => t.id === tokenId);
    if (!state.isConnected || !this.hostConn?.open || !controlsToken(token, this.store.memberId || this.store.peerId)) {
      notify('No puedes editar este token sin conexión o sin asignación del Keeper.', 'error'); return false;
    }
    if (!validTokenPatch(partial) || this.pendingTokenPatches.size >= 100) {
      notify('Cambio de token no permitido o demasiados cambios pendientes. Espera la confirmación del Keeper.', 'error'); return false;
    }
    this.authoritativeTokens ||= structuredClone(state.tokens);
    const sequence = ++this.tokenPatchSequence;
    const patch = { tokenId, partial: structuredClone(partial), sequence, campaignId: state.campaignId, mapId: token.mapId };
    patch.timer = setTimeout(() => {
      this.pendingTokenPatches.delete(sequence);
      this.applyPendingTokenPatches();
      notify('El Keeper no ha confirmado el cambio del token. Se ha recuperado el último estado confirmado.', 'error');
    }, 10000);
    this.pendingTokenPatches.set(sequence, patch);
    this.applyPendingTokenPatches();
    try {
      const { timer, ...request } = patch;
      if (!this.sendToHost({ type: 'TOKEN_UPDATE', ...request })) throw new Error('Conexión con el Keeper interrumpida.');
    } catch (error) {
      clearTimeout(patch.timer); this.pendingTokenPatches.delete(sequence); this.applyPendingTokenPatches();
      notify(error.message, 'error'); return false;
    }
    return true;
  }
  projectedTokens(tokens, state = this.store.state) {
    return tokens.map(token => {
      let result = token;
      for (const patch of this.pendingTokenPatches.values()) {
        if (patch.tokenId === token.id && patch.campaignId === state.campaignId && patch.mapId === state.activeMapId && token.mapId === patch.mapId && controlsToken(token, this.store.memberId || this.store.peerId)) {
          result = { ...result, ...patch.partial };
          for (const key of ['hp', 'armor', 'stress', 'resolve']) if (patch.partial[key]) result[key] = { ...token[key], current: Math.min(token[key].max, patch.partial[key].current) };
          // A personal toggle never replaces the Keeper's configured light parameters.
          if ('hasSpotlight' in patch.partial) result.spotlight = { ...token.spotlight, enabled: patch.partial.hasSpotlight };
        }
      }
      return result;
    });
  }
  applyPendingTokenPatches() {
    if (!this.authoritativeTokens || this.store.sessionRole !== 'player') return;
    const applying = this.store.remoteApplying;
    this.store.remoteApplying = true;
    try { this.store.update({ tokens: this.projectedTokens(this.authoritativeTokens) }); }
    finally { this.store.remoteApplying = applying; }
  }
  clearTokenPatches(restore = false) {
    for (const patch of this.pendingTokenPatches.values()) clearTimeout(patch.timer);
    this.pendingTokenPatches.clear();
    if (restore) this.applyPendingTokenPatches();
    this.authoritativeTokens = null;
  }
  reconcileTokenPatches(state, ack) {
    for (const [sequence, patch] of this.pendingTokenPatches) {
      const token = state.tokens.find(t => t.id === patch.tokenId);
      const acknowledged = Number.isSafeInteger(ack) && ack >= sequence;
      const obsolete = patch.campaignId !== state.campaignId || patch.mapId !== state.activeMapId || token?.mapId !== patch.mapId || !controlsToken(token, this.store.memberId || this.store.peerId);
      // Older Keepers have no acknowledgement field; matching their snapshot confirms the patch.
      const legacyConfirmed = ack === undefined && token && Object.entries(patch.partial).every(([key, value]) => JSON.stringify(token[key]) === JSON.stringify(value));
      if (acknowledged || obsolete || legacyConfirmed) { clearTimeout(patch.timer); this.pendingTokenPatches.delete(sequence); }
    }
    this.authoritativeTokens = structuredClone(state.tokens);
    state.tokens = this.projectedTokens(state.tokens, state);
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
    const roomMatches = String(data?.room || '').trim().toUpperCase() === String(this.room || '').trim().toUpperCase();
    if (
      !data ||
      !roomMatches ||
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
          this.reconcileTokenPatches(s, data.tokenPatchAck);
          const currentlyControlled = this.store.getControlledTokens();
          const hadAssigned = currentlyControlled.length > 0;
          const assigned = s.tokens.filter(t => controlsToken(t, this.store.memberId));
          const selectedId = assigned.some(t => t.id === this.store.state.selectedTokenId) ? this.store.state.selectedTokenId : data.state.claimedTokenId || assigned[0]?.id || null;
          const newAssignment = selectedId !== this.store.state.selectedTokenId;
          const wasObserver = !!this.store.state.isObserver;
          const isNowAssigned = assigned.length > 0;
          const nextIsObserver = isNowAssigned ? false : (hadAssigned ? true : wasObserver);
          this.store.remoteApplying = true;
          this.store.update({
            ...s,
            userRole: 'player',
            gmVision: false,
            isConnected: true,
            joiningSession: false,
            isObserver: nextIsObserver,
            claimedTokenId: data.state.claimedTokenId,
            selectedTokenId: selectedId,
            ...(newAssignment || !['select', 'measure', 'template', 'fx', 'ping'].includes(this.store.state.activeTool) ? { activeTool: 'select', activeLayer: 'tokens' } : {}),
          });
          this.store.validateSelections();
          const isInitialJoin = Boolean(this.joinReady);
          this.joinReady?.();
          this.joinReady = null;

          if (wasObserver && isNowAssigned && selectedId) {
            const newlyAssigned = assigned.find(t => t.id === selectedId) || assigned[0];
            notify(`🎯 El Director de Juego (Keeper) te ha asignado a ${newlyAssigned.name}.`);
            if (window.veilCanvas && newlyAssigned) {
              const cv = window.veilCanvas;
              cv.panX = cv.displayWidth / 2 - newlyAssigned.x * cv.zoom;
              cv.panY = cv.displayHeight / 2 - newlyAssigned.y * cv.zoom;
            }
          } else if (hadAssigned && !isNowAssigned) {
            notify('👁️ El Director de Juego ha cambiado tu estado a Observador.');
          }

          if (assigned.length === 0 && !this.store.state.claimedTokenId && !this.store.state.isObserver) {
            setTimeout(() => {
              if (this.store.state.isObserver || this.store.state.claimedTokenId || (this.store.getControlledTokens().length > 0)) return;
              import('./rosterManager.js').then(({ openClaimCharacterModal }) => {
                openClaimCharacterModal();
              }).catch(() => {});
            }, 300);
          }
        } catch (e) {
          if (this.joinFailed) this.disconnect(new Error('Could not open the Keeper’s map: ' + e.message));
          else notify(`Invalid session state: ${e.message}`, 'error');
        } finally {
          this.store.remoteApplying = false;
        }
      } else if (data.type === 'CHAT_MESSAGE') {
        try {
          const entry = validateChatEntry(data.entry);
          if (!chatVisibleTo(entry, this.store.memberId)) return;
          this.store.remoteApplying = true;
          this.store.update({ chatMessages: appendChat(this.store.state.chatMessages, entry) });
        } catch { /* Invalid messages must not corrupt the replica. */ }
        finally { this.store.remoteApplying = false; }
      } else if (data.type === 'TOKEN_PATCH_REJECTED') {
        notify(data.error || 'El Keeper ha rechazado el cambio del token.', 'error');
      } else if (data.type === 'ACTION_RESULT') {
        const p = this.pending.get(data.requestId);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(data.requestId);
          data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
        }
      } else if (data.type === 'KICKED') {
        const reason = data.reason || 'Has sido expulsado de la sesión por el Director de Juego.';
        clearActiveSession();
        this.disconnect(new Error(reason), { clearPersist: true });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veil:kicked', { detail: { reason } }));
        }
        notify(reason, 'error');
        return;
      } else this.ephemeral(data);
      return;
    }
    if (!this.store.state.isHosting || !this.members.has(senderId)) return;
    if (data.type === 'CHAT_SEND') {
      const conn = this.connections.get(senderId);
      try {
        const result = this.acceptChat(data, this.members.get(senderId).id);
        conn?.send(this.envelope({ type: 'ACTION_RESULT', requestId: data.requestId, result }));
      } catch (error) { conn?.send(this.envelope({ type: 'ACTION_RESULT', requestId: data.requestId, error: error.message })); }
      return;
    }
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
    if (data.type === 'CLAIM_TOKEN') {
      const conn = this.connections.get(senderId);
      const memberId = this.members.get(senderId)?.id || senderId;
      const target = this.store.state.tokens.find(t => t.id === data.tokenId);
      if (target && !isDrone(target) && (!target.ownerId || target.ownerId === 'keeper' || target.ownerId === '')) {
        this.store.assignTokenControllers(data.tokenId, [memberId]);
        this.syncAll();
        conn?.send(this.envelope({ type: 'ACTION_RESULT', requestId: data.requestId, result: { claimed: true, tokenId: data.tokenId } }));
      } else {
        conn?.send(this.envelope({ type: 'ACTION_RESULT', requestId: data.requestId, error: 'Ficha no disponible o ya reclamada.' }));
      }
      return;
    }
    if (data.type === 'TOKEN_UPDATE' || data.type === 'TOKEN_MOVE') {
      const conn = this.connections.get(senderId), sequenced = Number.isSafeInteger(data.sequence) && data.sequence > 0;
      if (sequenced && data.sequence <= (this.tokenPatchAcks.get(senderId) || 0)) { if (conn) this.syncPeer(conn); return; }
      try {
        const partial = structuredClone(data.type === 'TOKEN_MOVE' ? { x: data.x, y: data.y } : data.partial);
        if (!owns(data.tokenId)) throw new Error('Este token ya no está asignado a ti.');
        if (!validTokenPatch(partial)) throw new Error('El cambio contiene campos de token no permitidos.');
        const token = this.store.state.tokens.find((t) => t.id === data.tokenId);
        if (token.mapId !== this.store.state.activeMapId || (data.mapId && data.mapId !== token.mapId) || (data.campaignId && data.campaignId !== this.store.state.campaignId)) throw new Error('La escena ha cambiado. Repite el cambio en la escena actual.');
        for (const k of ['hp', 'armor', 'stress', 'resolve'])
          if (partial[k]) {
            if (partial[k].max !== token[k]?.max) throw new Error('El Keeper ha cambiado el máximo de ' + k + '. Revisa la ficha.');
            for (const field of Object.keys(partial[k]))
              if (field !== 'current' && partial[k][field] !== token[k]?.[field]) throw new Error('Solo puedes cambiar el valor actual de ' + k + '.');
            partial[k] = { ...token[k], current: partial[k].current };
          }
        if ('hasSpotlight' in partial) partial.spotlight = { ...token.spotlight, enabled: partial.hasSpotlight };
        const turnOnSpotlight = Boolean(partial.hasSpotlight);
        // Membership was checked above. Keeper's local Player-preview selection is irrelevant.
        this.store._beforeTacticalMutation?.('Cambio de jugador', 'tok_' + token.id);
        this.store.update({
          tokens: this.store.state.tokens.map(t => {
            if (t.id === token.id) return { ...t, ...partial };
            if (turnOnSpotlight && (t.hasSpotlight || t.spotlight?.enabled)) {
              return { ...t, hasSpotlight: false, spotlight: { ...(t.spotlight || {}), enabled: false } };
            }
            return t;
          })
        });
      } catch (error) {
        conn?.send(this.envelope({ type: 'TOKEN_PATCH_REJECTED', sequence: data.sequence, error: error.message }));
      } finally {
        if (sequenced) this.tokenPatchAcks.set(senderId, data.sequence);
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
    if (data.type === 'MAP_LOAD_STATUS') {
      const member = this.members.get(senderId);
      const peerId = member?.id || data.memberId || data.peerId || senderId;
      const statusName = member?.name || data.name;
      const status = { ...data, peerId, name: statusName };
      this.mapLoadStatuses.set(peerId, status);
      if (member?.id) this.mapLoadStatuses.set(member.id, status);
      if (data.peerId) this.mapLoadStatuses.set(data.peerId, status);
      if (data.memberId) this.mapLoadStatuses.set(data.memberId, status);
      if (senderId) this.mapLoadStatuses.set(senderId, status);
      if (statusName) this.mapLoadStatuses.set(statusName, status);
      this.ephemeral(status);
      this.broadcast(status);
    }
  }
  ephemeral(data) {
    // The authoritative snapshot contains logs; the event is only for presentation.
    if (data.type === 'MAP_LOAD_STATUS') {
      if (data.peerId) this.mapLoadStatuses.set(data.peerId, data);
      if (data.name) this.mapLoadStatuses.set(data.name, data);
      window.dispatchEvent(new CustomEvent('veil:map-load-status', { detail: data }));
    }
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
    if (data.type === 'ATTACK_FX' && data.params)
      window.veilCanvas?.triggerAttackFX(data.params);
    if (data.type === 'TARGET_SELECT')
      window.veilCanvas?.setAttackTarget(data.attackerId, data.targetId);
    if (data.type === 'FOG_SYNC' && data.mapId) {
      const currentMap = this.store.state.maps.find(m => m.id === data.mapId);
      if (currentMap) {
        this.store.updateMap(data.mapId, { fogExplored: data.fogExplored });
        if (typeof window !== 'undefined' && window.veilCanvas?.fog) {
          const fullMapId = `${this.store.state.campaignId}:${data.mapId}`;
          const w = window.veilCanvas.mapImage?.width || 2000;
          const h = window.veilCanvas.mapImage?.height || 1200;
          window.veilCanvas.fog.loadExploration(fullMapId, w, h, data.fogExplored);
          window.veilCanvas.render();
        }
      }
    }
  }
  disconnect(reason = new Error('Session closed. Check the invitation and try again.'), { clearPersist = false } = {}) {
    if (clearPersist) clearActiveSession();
    this.closing = true;
    clearTimeout(this.syncTimer);
    this.clearTokenPatches(); this.tokenPatchAcks.clear(); this.tokenPatchSequence = 0;
    const peer = this.peer;
    this.peer = null;
    peer?.destroy?.();
    this.hostConn = null;
    this.connections.clear();
    this.members.clear();
    this.mapLoadStatuses.clear();
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('Session closed'));
    }
    this.pending.clear();
    this.seen.clear();
    this.joinReady = null;
    this.joinFailed?.(reason); this.joinFailed = null;
    this.seats.clear(); this.kickedMembers.clear(); this.room = ''; this.invite = ''; this.store.memberId = null;
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
