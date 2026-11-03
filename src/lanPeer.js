import { newId } from './persistence.js';

const channel = 'veil:lan';
class Events extends EventTarget {
  on(type, handler) { this.addEventListener(type, event => handler(event.detail)); }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}

class LanConnection extends Events {
  constructor(transport, peer) {
    super();
    this.transport = transport;
    this.peer = peer;
    this.open = false;
  }
  send(data) {
    if (this.open) this.transport.send({ op: 'data', to: this.peer, data });
  }
  close() {
    this.transport.send({ op: 'close', to: this.peer });
    this.transport.closed(this.peer);
  }
}

// Provides the same connection events the session protocol uses with PeerJS.
// LAN players only need HTTP access to the same running VTT server.
export class LanPeer extends Events {
  constructor(hot, roomOrOptions, invite) {
    super();
    this.hot = hot;
    this.invite = invite;
    this.instance = newId();
    this.links = new Map();
    this.receive = message => {
      if (message.instance !== this.instance) return;
      switch (message.op) {
        case 'ready': this.emit('open', message.id); break;
        case 'incoming': {
          const connection = new LanConnection(this, message.peer);
          connection.open = true;
          this.links.set(message.peer, connection);
          this.emit('connection', connection);
          break;
        }
        case 'connected': {
          const connection = this.links.get(message.peer);
          if (connection) { connection.open = true; connection.emit('open'); }
          break;
        }
        case 'data': this.links.get(message.peer)?.emit('data', message.data); break;
        case 'closed': this.closed(message.peer); break;
        case 'error': this.emit('error', new Error(message.text)); break;
      }
    };
    this.onDisconnect = () => this.emit('error', new Error('LAN server disconnected. Reopen the Keeper’s LAN address to reconnect.'));
    hot.on(channel, this.receive);
    hot.on('vite:ws:disconnect', this.onDisconnect);
    this.send(typeof roomOrOptions === 'string' ? { op: 'register', room: roomOrOptions, invite } : { op: 'register' });
  }
  send(message) {
    if (!this.destroyed) this.hot.send(channel, { ...message, instance: this.instance });
  }
  connect(room) {
    const connection = new LanConnection(this, room);
    this.links.set(room, connection);
    this.send({ op: 'connect', to: room, invite: this.invite });
    return connection;
  }
  closed(peer) {
    const connection = this.links.get(peer);
    if (!connection) return;
    this.links.delete(peer);
    connection.open = false;
    connection.emit('close');
  }
  destroy() {
    if (this.destroyed) return;
    this.send({ op: 'leave' });
    this.destroyed = true;
    this.hot.off(channel, this.receive);
    this.hot.off('vite:ws:disconnect', this.onDisconnect);
    for (const peer of this.links.keys()) this.closed(peer);
  }
}
