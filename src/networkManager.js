// src/networkManager.js
// P2P WebRTC Multiplayer using PeerJS + Local BroadcastChannel sync

import PeerJS from 'peerjs';
const Peer = PeerJS?.Peer || PeerJS?.default || PeerJS;
import { store } from './state.js';
import { audio } from './audioEngine.js';

class NetworkManager {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.hostConn = null; // Connection to host if we are a player
    this.broadcastChannel = new BroadcastChannel('veilvtt_local_broadcast');
    
    // Listen to local BroadcastChannel for tab-to-tab instant sync
    this.broadcastChannel.onmessage = (event) => {
      this.handleIncomingMessage(event.data, 'local_channel');
    };
  }

  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'VEIL-';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * Host a game session as Keeper
   */
  async hostSession(customCode) {
    const code = customCode || this.generateRoomCode();
    
    try {
      this.peer = new Peer(code, {
        debug: 1
      });

      this.peer.on('open', (id) => {
        store.update({
          isHosting: true,
          isConnected: true,
          roomCode: id,
          userRole: 'keeper'
        });
        store.addLog({
          sender: 'Multiplayer',
          type: 'NET_HOST',
          title: `TRANSMISSION ONLINE: ROOM [${id}]`,
          details: 'P2P quantum frequency open. Send code or link to players to join.'
        });
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS host notice:', err);
      });

      return code;
    } catch (err) {
      console.error('Error starting host:', err);
      // Fallback local code
      store.update({ isHosting: true, roomCode: code });
      return code;
    }
  }

  /**
   * Join an existing session with room code
   */
  async joinSession(roomCode, playerName = 'Player') {
    try {
      this.peer = new Peer({ debug: 1 });

      this.peer.on('open', () => {
        const conn = this.peer.connect(roomCode, { reliable: true });
        this.hostConn = conn;

        conn.on('open', () => {
          store.update({
            isConnected: true,
            roomCode: roomCode,
            userRole: 'player',
            userName: playerName,
            isHosting: false
          });

          // Handshake request for state
          conn.send({
            type: 'REQUEST_SYNC',
            playerName: playerName
          });

          store.addLog({
            sender: 'Multiplayer',
            type: 'NET_JOIN',
            title: `CONNECTED TO ROOM: [${roomCode}]`,
            details: 'Joined session as Voidwalker. Receiving tactical telemetry...'
          });
        });

        conn.on('data', (data) => {
          this.handleIncomingMessage(data, conn.peer);
        });

        conn.on('close', () => {
          store.update({ isConnected: false });
          store.addLog({
            sender: 'Multiplayer',
            type: 'NET_DISCONNECT',
            title: 'CONNECTION LOST',
            details: 'Disconnected from host carrier.'
          });
        });
      });

      this.peer.on('error', (err) => {
        console.error('Peer join error:', err);
        alert('Could not connect to room ' + roomCode + '. Check code and try again.');
      });
    } catch (err) {
      console.error('Join error:', err);
    }
  }

  setupConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.updatePeersList();

      // Send initial state to newly joined player
      const s = store.getState();
      conn.send({
        type: 'INITIAL_STATE',
        state: {
          campaignName: s.campaignName,
          fear: s.fear,
          activeMapId: s.activeMapId,
          maps: s.maps,
          // If sending to player, filter out hidden tokens and hidden clocks
          tokens: s.tokens.filter(t => !t.hidden),
          clocks: s.clocks.filter(c => !c.isKeeperOnly)
        }
      });
    });

    conn.on('data', (data) => {
      this.handleIncomingMessage(data, conn.peer);
      // Re-broadcast to other peers
      this.broadcast(data, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.updatePeersList();
    });
  }

  updatePeersList() {
    const peerIds = Array.from(this.connections.keys());
    store.update({ connectedPeers: peerIds });
  }

  broadcast(message, excludePeerId = null) {
    // 1. BroadcastChannel for local tabs
    try {
      this.broadcastChannel.postMessage(message);
    } catch (e) {}

    // 2. PeerJS network
    for (const [peerId, conn] of this.connections.entries()) {
      if (peerId !== excludePeerId && conn.open) {
        conn.send(message);
      }
    }
  }

  sendToHost(message) {
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(message);
    }
    // Also broadcast locally
    try {
      this.broadcastChannel.postMessage(message);
    } catch (e) {}
  }

  handleIncomingMessage(data, senderId) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'INITIAL_STATE':
        if (data.state) {
          store.update({
            campaignName: data.state.campaignName,
            fear: data.state.fear,
            activeMapId: data.state.activeMapId,
            maps: data.state.maps,
            tokens: data.state.tokens,
            clocks: data.state.clocks
          });
        }
        break;

      case 'TOKEN_MOVE':
        store.updateToken(data.tokenId, { x: data.x, y: data.y });
        break;

      case 'TOKEN_UPDATE':
        store.updateToken(data.tokenId, data.partial);
        break;

      case 'FEAR_UPDATE':
        store.setFear(data.fear);
        audio.playFearAlert();
        break;

      case 'CLOCK_UPDATE':
        store.updateClock(data.clockId, data.partial);
        audio.playClockTick();
        break;

      case 'MAP_CHANGE':
        store.update({ activeMapId: data.mapId });
        break;

      case 'DICE_ROLL':
        store.addLog(data.logEntry);
        if (data.logEntry.resultType === 'CRITICAL_SUCCESS') {
          audio.playCritical();
        } else {
          audio.playDiceRoll();
        }
        break;

      case 'PING':
        if (window.veilCanvas) {
          window.veilCanvas.triggerPing(data.x, data.y, data.color);
        }
        audio.playPing();
        break;

      case 'SPECIAL_FX':
        if (window.veilCanvas) {
          window.veilCanvas.triggerFX(data.fxType, data.params);
        }
        break;

      case 'TRANSMISSION':
        if (data.handout) {
          window.dispatchEvent(new CustomEvent('veil:incoming_transmission', { detail: { handout: data.handout } }));
        }
        break;
    }
  }
}

export const network = new NetworkManager();
