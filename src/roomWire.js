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
// A part of a message, checked before it is kept.
const validRow = (row, expected) => row && Number.isSafeInteger(row.seq) && row.seq >= expected && Number.isInteger(row.total) && row.total >= 1 && row.total <= 1050 && Number.isInteger(row.part) && row.part >= 0 && row.part < row.total && typeof row.text === 'string';

export class RoomWire {
  // realtime: { api, db } of Realtime Database when both ends use it (V3): the messages travel
  // there (billed by data moved, not by operation); otherwise through the Firestore mailboxes.
  // epoch: the Keeper connection this wire belongs to; messages of another one are ignored.
  constructor(service, roomId, wireId, side, { onData, onClose, beforeSend = async () => {}, realtime = null, epoch = '' }) {
    Object.assign(this, { service, roomId, wireId, side, onData, onClose, beforeSend, realtime, epoch });
    this.open = true; this.sequence = 0; this.expected = 1; this.parts = new Map(); this.queue = []; this.sending = false; this.receiving = Promise.resolve();
    const incoming = side === 'keeper' ? 'up' : 'down', a = service.api;
    this.unwatch = a.onSnapshot(service.ref('rooms', roomId, 'wires', wireId), snapshot => {
      if (!snapshot.metadata.fromCache && !snapshot.exists()) this.fail(new Error('Reconectando con la sala…'));
    }, error => this.fail(error));
    if (realtime) {
      const { api } = realtime;
      this.unsubscribe = api.onChildAdded(this.rtRef(incoming), snap => {
        const row = snap.val();
        if (!this.open || !validRow(row, this.expected) || (this.epoch && row.epoch !== this.epoch)) return;
        const parts = this.parts.get(row.seq) || new Map(); parts.set(row.part, { ...row, key: snap.key }); this.parts.set(row.seq, parts);
        this.receiving = this.receiving.then(() => this.drain()).catch(error => this.fail(error));
      }, error => this.fail(error));
      // The Keeper reads the player's presence here (the player beats here, not in Firestore).
      if (side === 'keeper') this.unseen = api.onValue(this.rtRef('seenAt'), snap => { const v = snap.val(); if (Number.isFinite(v)) this.seenAt = v; }, () => {});
      return;
    }
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
      if (this.realtime) { await this.realtime.api.update(this.rtRef(this.side === 'keeper' ? 'up' : 'down'), Object.fromEntries(rows.map(row => [row.key, null]))); continue; }
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
        if (this.realtime) {
          await this.realtime.api.update(this.rtRef(outgoing), Object.fromEntries(parts.map((text, i) => [`${seq}_${i}`, { seq, part: i, total: parts.length, text, epoch: this.epoch }])));
          continue;
        }
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
  close() { this.open = false; this.unsubscribe?.(); this.unwatch?.(); this.unseen?.(); this.queue = []; this.parts.clear(); }
  rtRef(path) { return this.realtime.api.ref(this.realtime.db, `wires/${this.wireId}/${path}`); }
  // The player's presence, on Realtime Database (one small write, no Firestore quota).
  beat() { return this.realtime ? this.realtime.api.set(this.rtRef('seenAt'), this.realtime.api.serverTimestamp()) : null; }
}

// The player opens the wire on Realtime Database first (who may write each way, and for which
// Keeper connection), then announces it in Firestore. true when it is ready there.
export async function openRealtimeWire(service, room, id) {
  const rt = service.rtdb;
  if (!rt || (typeof localStorage !== 'undefined' && localStorage.getItem('veil.wire') === 'firestore')) return false;
  try {
    const write = rt.api.set(rt.api.ref(rt.db, `wires/${id}/meta`), { uid: service.uid, keeper: room.ownerUid, epoch: room.hostEpoch });
    await Promise.race([write, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))]);
    await rt.api.set(rt.api.ref(rt.db, `wires/${id}/seenAt`), rt.api.serverTimestamp());
    return true;
  } catch (error) { console.warn('Realtime Database no disponible para la sala; se usa Firestore:', error?.message || error); return false; }
}
// The Keeper asks whether a player's wire lives on Realtime Database.
export async function realtimeWireFor(service, id, timeout = 4000) {
  const rt = service.rtdb;
  if (!rt) return null;
  try {
    const snap = await Promise.race([rt.api.get(rt.api.ref(rt.db, `wires/${id}/meta`)), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))]);
    return snap.exists() && snap.val()?.keeper === service.uid ? rt : null;
  } catch { return null; }
}
export function removeRealtimeWire(service, id) {
  const rt = service.rtdb;
  return rt ? rt.api.remove(rt.api.ref(rt.db, `wires/${id}`)).catch(() => {}) : Promise.resolve();
}

export async function createRoomWire(service, room, name, id = newId()) {
  await service.api.setDoc(service.ref('rooms', room.id, 'wires', id), { uid: service.uid, name: String(name || 'Jugador').slice(0, 80), epoch: room.hostEpoch, seenAt: service.api.serverTimestamp() });
  return id;
}
