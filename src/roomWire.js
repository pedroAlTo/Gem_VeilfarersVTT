import { newId } from './persistence.js';
import { splitRoomData } from './roomService.js';

// A list of objects with a unique string id (tokens, maps, clocks, handouts, logs…).
const isItemList = v => Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string') && new Set(v.map(x => x.id)).size === v.length;
const fieldStrings = item => new Map(Object.entries(item).map(([k, v]) => [k, JSON.stringify(v)]));
// What changed in a list: new things whole, changed fields of the others, and the order when
// a thing was added, removed or moved. null when nothing changed.
export function itemPatch(before, now, list) {
  const add = [], set = {}, unset = {};
  for (const item of list) {
    const old = before.get(item.id);
    if (!old) { add.push(item); continue; }
    const fields = now.get(item.id), changed = {}, gone = [];
    for (const [k, json] of fields) if (old.get(k) !== json) changed[k] = item[k];
    for (const k of old.keys()) if (!fields.has(k)) gone.push(k);
    if (Object.keys(changed).length) set[item.id] = changed;
    if (gone.length) unset[item.id] = gone;
  }
  const ids = list.map(x => x.id), oldIds = [...before.keys()];
  const reordered = ids.length !== oldIds.length || ids.some((id, i) => id !== oldIds[i]);
  if (!add.length && !Object.keys(set).length && !Object.keys(unset).length && !reordered) return null;
  return { ...(add.length ? { add } : {}), ...(Object.keys(set).length ? { set } : {}), ...(Object.keys(unset).length ? { unset } : {}), ...(reordered ? { order: ids } : {}) };
}
export function applyItemPatch(list, patch) {
  const byId = new Map((Array.isArray(list) ? list : []).map(item => [item.id, item]));
  for (const item of patch.add || []) byId.set(item.id, item);
  for (const [id, fields] of Object.entries(patch.set || {})) if (byId.has(id)) byId.set(id, { ...byId.get(id), ...fields });
  for (const [id, keys] of Object.entries(patch.unset || {})) if (byId.has(id)) { const copy = { ...byId.get(id) }; for (const k of keys) delete copy[k]; byId.set(id, copy); }
  const order = patch.order || [...byId.keys()];
  return order.filter(id => byId.has(id)).map(id => byId.get(id));
}

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
        for (const [key, patch] of Object.entries(data.items || {})) state[key] = applyItemPatch(this.receivedState[key], patch);
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
  // After the first full snapshot, only what changed: a value that changed, and for a list of
  // things with an id (tokens, maps, clocks…) only the things that changed and, of each, only
  // the fields that changed. A token moved sends its x and y, not every token with its sheet
  // and avatar; a map's image is never sent again unless it changes.
  compressSnapshot(data) {
    if (data.type !== 'INITIAL_STATE') return data;
    const strings = {}, itemsNow = {};
    for (const [key, value] of Object.entries(data.state)) {
      if (isItemList(value)) itemsNow[key] = new Map(value.map(item => [item.id, fieldStrings(item)]));
      else strings[key] = JSON.stringify(value);
    }
    const previous = this.sentStateStrings, previousItems = this.sentItems;
    this.sentStateStrings = strings; this.sentItems = itemsNow;
    if (!previous) return data;
    const { state, ...envelope } = data, changes = {}, items = {};
    for (const [key, value] of Object.entries(state)) {
      if (key in strings) { if (strings[key] !== previous[key]) changes[key] = value; continue; }
      const before = previousItems?.[key];
      if (!before) { changes[key] = value; continue; }
      const patch = itemPatch(before, itemsNow[key], value);
      if (patch) items[key] = patch;
    }
    const removed = [...Object.keys(previous), ...Object.keys(previousItems || {})].filter(key => !(key in state));
    return { ...envelope, type: 'ROOM_STATE_PATCH', changes, ...(Object.keys(items).length ? { items } : {}), removed };
  }
  fail(error) { if (this.open) { this.close(); this.onClose(error); } }
  close() { this.open = false; this.unsubscribe?.(); this.unwatch?.(); this.queue = []; this.parts.clear(); }
}

export async function createRoomWire(service, room, name) {
  const id = newId();
  await service.api.setDoc(service.ref('rooms', room.id, 'wires', id), { uid: service.uid, name: String(name || 'Jugador').slice(0, 80), epoch: room.hostEpoch, seenAt: service.api.serverTimestamp() });
  return id;
}
