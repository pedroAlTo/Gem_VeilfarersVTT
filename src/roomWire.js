import { newId } from './persistence.js';
import { splitRoomData } from './roomService.js';

// Ordered, private Firestore mailboxes. The same game protocol works without
// WebRTC, a public peer ID, a TURN server, or exposing a Keeper snapshot to others.
export class RoomWire {
  constructor(service, roomId, wireId, side, { onData, onClose, beforeSend = async () => {} }) {
    Object.assign(this, { service, roomId, wireId, side, onData, onClose, beforeSend });
    this.open = true; this.sequence = 0; this.expected = 1; this.parts = new Map(); this.queue = []; this.sending = false; this.receiving = Promise.resolve();
    const incoming = side === 'keeper' ? 'up' : 'down', a = service.api;
    this.unwatch = a.onSnapshot(service.ref('rooms', roomId, 'wires', wireId), snapshot => {
      if (!snapshot.metadata.fromCache && !snapshot.exists()) this.fail(new Error('Reconectando con la sala…'));
    }, error => this.fail(error));
    this.unsubscribe = a.onSnapshot(service.col('rooms', roomId, 'wires', wireId, incoming), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites || !this.open) return;
      for (const doc of snapshot.docs) {
        const row = doc.data();
        if (!Number.isSafeInteger(row.seq) || row.seq < this.expected || row.total < 1 || row.total > 1050 || row.part < 0 || row.part >= row.total || typeof row.text !== 'string') continue;
        const parts = this.parts.get(row.seq) || new Map(); parts.set(row.part, { ...row, ref: doc.ref }); this.parts.set(row.seq, parts);
      }
      this.receiving = this.receiving.then(() => this.drain()).catch(error => this.fail(error));
    }, error => this.fail(error));
  }
  async drain() {
    while (this.open) {
      const parts = this.parts.get(this.expected), first = parts?.get(0);
      if (!first || parts.size !== first.total) return;
      const rows = Array.from({ length: first.total }, (_, i) => parts.get(i));
      if (rows.some(row => !row || row.total !== first.total)) throw new Error('Mensaje de sala incompleto.');
      let data = JSON.parse(rows.map(row => row.text).join(''));
      if (data.type === 'ROOM_STATE_PATCH') {
        if (!this.receivedState) throw new Error('Se necesita una instantánea completa. Reconectando…');
        const state = { ...this.receivedState, ...data.changes };
        for (const key of data.removed || []) delete state[key];
        data = { ...data, type: 'INITIAL_STATE', state }; delete data.changes; delete data.removed;
      }
      if (data.type === 'INITIAL_STATE') this.receivedState = structuredClone(data.state);
      this.parts.delete(this.expected++);
      await this.onData(data);
      for (let i = 0; i < rows.length; i += 20) {
        const batch = this.service.api.writeBatch(this.service.db);
        rows.slice(i, i + 20).forEach(row => batch.delete(row.ref)); await batch.commit();
      }
    }
  }
  send(data) {
    if (!this.open) throw new Error('Sala en pausa. Espera a que vuelva el Keeper.');
    // Intermediate full snapshots are replaceable; commands and results are not.
    if (data.type === 'INITIAL_STATE') this.queue = this.queue.filter(row => row.type !== 'INITIAL_STATE');
    this.queue.push(structuredClone(data)); this.flush();
  }
  async flush() {
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.open && this.queue.length) {
        const data = this.queue.shift(); await this.beforeSend(data);
        if (!this.open) break;
        const seq = ++this.sequence, parts = splitRoomData(this.compressSnapshot(data)), a = this.service.api;
        const outgoing = this.side === 'keeper' ? 'down' : 'up';
        for (let i = 0; i < parts.length && this.open; i += 20) {
          const batch = a.writeBatch(this.service.db);
          parts.slice(i, i + 20).forEach((text, j) => batch.set(this.service.ref('rooms', this.roomId, 'wires', this.wireId, outgoing, `${seq}_${i + j}`), { seq, part: i + j, total: parts.length, text }));
          await batch.commit();
        }
      }
    } catch (error) { this.fail(error); }
    finally { this.sending = false; }
  }
  compressSnapshot(data) {
    if (data.type !== 'INITIAL_STATE') return data;
    const strings = Object.fromEntries(Object.entries(data.state).map(([key, value]) => [key, JSON.stringify(value)]));
    const previous = this.sentStateStrings; this.sentStateStrings = strings;
    if (!previous) return data;
    const { state, ...envelope } = data;
    return { ...envelope, type: 'ROOM_STATE_PATCH', changes: Object.fromEntries(Object.entries(state).filter(([key]) => strings[key] !== previous[key])), removed: Object.keys(previous).filter(key => !(key in strings)) };
  }
  fail(error) { if (this.open) { this.close(); this.onClose(error); } }
  close() { this.open = false; this.unsubscribe?.(); this.unwatch?.(); this.queue = []; this.parts.clear(); }
}

export async function createRoomWire(service, room, name) {
  const id = newId();
  await service.api.setDoc(service.ref('rooms', room.id, 'wires', id), { uid: service.uid, name: String(name || 'Jugador').slice(0, 80), epoch: room.hostEpoch, seenAt: service.api.serverTimestamp() });
  return id;
}
