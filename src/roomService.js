import { account } from './cloudAccount.js';
import { newId } from './persistence.js';

export const ROOM_LEASE_MS = 20000;
export const ROOM_HEARTBEAT_MS = 5000;
export const ROOM_PART_SIZE = 60000;
export function roomOnline(room, now = Date.now()) {
  return !!room?.hostEpoch && !!room.hostSeenAt && now - room.hostSeenAt.toMillis() < ROOM_LEASE_MS;
}
export function splitRoomData(value) {
  const text = JSON.stringify(value);
  if (text.length > 60 * 1024 * 1024) throw new Error('La campaña supera 60 MB. Usa imágenes alojadas para los mapas.');
  const parts = [];
  for (let i = 0; i < text.length;) {
    let end = Math.min(i + ROOM_PART_SIZE, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    parts.push(text.slice(i, end)); i = end;
  }
  return parts;
}
export function roomError(error) {
  return error?.code === 'permission-denied'
    ? 'No se pudo acceder a la sala. Comprueba tu cuenta y que el administrador haya publicado las reglas de salas de Firestore (FIREBASE_SETUP.md).'
    : error?.message || 'No se pudo conectar con la sala.';
}

// Only Firebase identities are credentials for Firestore. Netlify tokens are never
// treated as Firebase credentials, and membership never depends on a display name.
export class RoomService {
  constructor({ cloudAccount = account } = {}) { this.account = cloudAccount; }
  async ready() {
    await this.account.restoreSession();
    if (!this.account.user || this.account.user.isNetlify) throw new Error('Inicia sesión con Google o correo de Firebase para usar tus salas persistentes.');
    await this.account.init();
    const changed = this.uid !== this.account.user.uid;
    this.uid = this.account.user.uid; this.api = this.account.dbAPI; this.db = this.account.db;
    if (changed || !this.clockCheckedAt || Date.now() - this.clockCheckedAt > 300000) await this.syncClock();
    return this;
  }
  async syncClock() {
    // A local clock may be minutes or hours wrong. Server rules and UI use the
    // same timebase; round-trip uncertainty pauses a little early, never late.
    const started = Date.now(), ref = this.ref('users', this.uid, 'connection', 'clock');
    await this.api.setDoc(ref, { time: this.api.serverTimestamp() });
    const response = await this.api.getDocFromServer(ref), ended = Date.now();
    this.clockOffset = response.data().time.toMillis() - started;
    this.clockCheckedAt = ended;
  }
  now() { return Date.now() + (this.clockOffset || 0); }
  ref(...path) { return this.api.doc(this.db, ...path); }
  col(...path) { return this.api.collection(this.db, ...path); }
  async getRoom(id) {
    const snap = await this.api.getDocFromServer(this.ref('rooms', id));
    if (!snap.exists()) throw new Error('La sala ya no existe.');
    return { ...snap.data(), id };
  }
  async list() {
    await this.ready();
    const uid = this.uid, rows = await this.api.getDocsFromServer(this.col('users', uid, 'rooms'));
    const rooms = await Promise.all(rows.docs.map(async row => {
      try { return await this.getRoom(row.id); }
      catch (error) { if (error.code === 'permission-denied') return null; throw error; }
    }));
    if (uid !== this.account.user?.uid) throw new Error('La cuenta ha cambiado. Abre de nuevo tus salas.');
    return rooms.filter(Boolean);
  }
  async create(name, campaign) {
    await this.ready();
    name = String(name || '').trim().slice(0, 200);
    if (!name) throw new Error('Escribe un nombre para la sala.');
    const id = 'room_' + newId(), inviteCode = 'VF-' + newId().replaceAll('-', '').toUpperCase();
    const room = { name, ownerUid: this.uid, campaignId: campaign.campaignId, inviteCode, hostEpoch: '', hostSeenAt: null, checkpoint: null, createdAt: this.api.serverTimestamp() };
    const batch = this.api.writeBatch(this.db);
    batch.set(this.ref('rooms', id), room);
    batch.set(this.ref('roomInvites', inviteCode), { roomId: id, ownerUid: this.uid, name });
    batch.set(this.ref('users', this.uid, 'rooms', id), { roomId: id });
    await batch.commit();
    await this.saveCampaign(id, campaign, '');
    return this.getRoom(id);
  }
  async join(code, name) {
    await this.ready();
    code = String(code || '').trim();
    if (/^https?:/i.test(code)) { const url = new URL(code); code = new URLSearchParams(url.hash.slice(1)).get('roomInvite') || url.searchParams.get('roomInvite') || ''; }
    code = code.toUpperCase();
    if (!/^VF-[A-F0-9]{32}$/.test(code)) throw new Error('Pega el código VF-… o el enlace de la sala.');
    const invitation = await this.api.getDocFromServer(this.ref('roomInvites', code));
    if (!invitation.exists()) throw new Error('Esta invitación no existe o ha sido regenerada. Si ya eres miembro, entra desde Mis salas.');
    const { roomId, ownerUid } = invitation.data();
    if (ownerUid === this.uid) return this.getRoom(roomId);
    const memberRef = this.ref('rooms', roomId, 'members', this.uid);
    const current = await this.api.getDocFromServer(memberRef);
    if (current.exists() && current.data().status === 'revoked') throw new Error('El Keeper te ha expulsado de esta sala. Debe readmitirte para volver a entrar.');
    const batch = this.api.writeBatch(this.db);
    if (!current.exists()) batch.set(memberRef, { uid: this.uid, name: String(name || this.account.user.displayName || 'Jugador').slice(0, 80), status: 'active', inviteCode: code, joinedAt: this.api.serverTimestamp() });
    batch.set(this.ref('users', this.uid, 'rooms', roomId), { roomId });
    await batch.commit();
    return this.getRoom(roomId);
  }
  async rotateInvitation(id) {
    const code = 'VF-' + newId().replaceAll('-', '').toUpperCase(), a = this.api;
    await a.runTransaction(this.db, async tx => {
      const ref = this.ref('rooms', id), room = (await tx.get(ref)).data();
      if (room.ownerUid !== this.uid) throw new Error('Solo el Keeper dueño de la sala puede regenerar la invitación.');
      tx.delete(this.ref('roomInvites', room.inviteCode));
      tx.set(this.ref('roomInvites', code), { roomId: id, ownerUid: this.uid, name: room.name });
      tx.update(ref, { inviteCode: code });
    });
    return code;
  }
  async setMemberStatus(id, uid, status) {
    await this.api.updateDoc(this.ref('rooms', id, 'members', uid), { status });
  }
  async acquire(id, epoch) {
    await this.api.runTransaction(this.db, async tx => {
      const ref = this.ref('rooms', id), room = (await tx.get(ref)).data();
      if (room.ownerUid !== this.uid) throw new Error('Solo el propietario puede dirigir esta sala.');
      if (roomOnline(room, this.now()) && room.hostEpoch !== epoch) throw new Error('La sala está abierta en otra ventana del Keeper. Ciérrala o espera unos segundos antes de reconectar.');
      tx.update(ref, { hostEpoch: epoch, hostSeenAt: this.api.serverTimestamp() });
    });
  }
  async heartbeat(id, epoch) {
    await this.api.runTransaction(this.db, async tx => {
      const ref = this.ref('rooms', id), room = (await tx.get(ref)).data();
      if (room.hostEpoch !== epoch) throw new Error('Otra conexión del Keeper controla esta sala.');
      tx.update(ref, { hostSeenAt: this.api.serverTimestamp() });
    });
  }
  async release(id, epoch) {
    await this.api.runTransaction(this.db, async tx => {
      const ref = this.ref('rooms', id), room = (await tx.get(ref)).data();
      if (room.hostEpoch === epoch) tx.update(ref, { hostEpoch: '', hostSeenAt: null });
    });
  }
  async saveCampaign(id, campaign, epoch) {
    const parts = splitRoomData(campaign), saveId = newId(), a = this.api;
    const hashes = await Promise.all(parts.map(async text => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    }));
    this.knownChunks ||= new Map(); const known = this.knownChunks.get(id) || new Set();
    const changed = [...new Map(hashes.map((hash, i) => [hash, parts[i]])).entries()].filter(([hash]) => !known.has(hash));
    for (let i = 0; i < changed.length; i += 20) {
      const batch = a.writeBatch(this.db);
      changed.slice(i, i + 20).forEach(([hash, text]) => batch.set(this.ref('rooms', id, 'chunks', hash), { text }));
      await batch.commit();
      changed.slice(i, i + 20).forEach(([hash]) => known.add(hash));
    }
    this.knownChunks.set(id, known);
    await a.setDoc(this.ref('rooms', id, 'saves', saveId), { hashes, createdAt: a.serverTimestamp() });
    let previous;
    await a.runTransaction(this.db, async tx => {
      const ref = this.ref('rooms', id), room = (await tx.get(ref)).data();
      if (room.hostEpoch !== epoch) throw new Error('La conexión del Keeper ha cambiado. Se conserva el último guardado confirmado.');
      previous = room.checkpoint;
      tx.update(ref, { checkpoint: { id: saveId, parts: parts.length }, name: campaign.campaignName.slice(0, 200), ...(epoch ? { hostSeenAt: a.serverTimestamp() } : {}) });
    });
    // Immutable shared chunks keep large images out of subsequent movement saves.
    if (previous) a.deleteDoc(this.ref('rooms', id, 'saves', previous.id)).catch(() => {});
  }
  async cleanUnusedSaves(room) {
    // Only called under a newly acquired Keeper lease, before accepting players.
    const manifest = await this.api.getDocFromServer(this.ref('rooms', room.id, 'saves', room.checkpoint.id));
    const keep = new Set(manifest.data().hashes);
    for (const collection of ['chunks', 'saves']) {
      const rows = await this.api.getDocsFromServer(this.col('rooms', room.id, collection));
      const stale = rows.docs.filter(d => collection === 'chunks' ? !keep.has(d.id) : d.id !== room.checkpoint.id);
      for (let i = 0; i < stale.length; i += 20) {
        await this.api.runTransaction(this.db, async tx => {
          const current = (await tx.get(this.ref('rooms', room.id))).data();
          if (current.hostEpoch !== room.hostEpoch || current.checkpoint.id !== room.checkpoint.id) throw new Error('La sala ha cambiado de conexión. Vuelve a abrirla.');
          stale.slice(i, i + 20).forEach(d => tx.delete(d.ref));
        });
      }
    }
    this.knownChunks.set(room.id, keep);
  }
  async deleteWire(id, wireId) {
    // Delete the parent last so authorization remains valid for its message parts.
    for (const direction of ['up', 'down']) {
      const rows = await this.api.getDocsFromServer(this.col('rooms', id, 'wires', wireId, direction));
      for (let i = 0; i < rows.docs.length; i += 20) {
        const batch = this.api.writeBatch(this.db);
        rows.docs.slice(i, i + 20).forEach(row => batch.delete(row.ref)); await batch.commit();
      }
    }
    await this.api.deleteDoc(this.ref('rooms', id, 'wires', wireId));
  }
  async cleanOldWires(id, epoch) {
    const rows = await this.api.getDocsFromServer(this.col('rooms', id, 'wires'));
    for (const row of rows.docs) if (row.data().epoch !== epoch) await this.deleteWire(id, row.id);
  }
  async loadCampaign(room) {
    if (!room.checkpoint) throw new Error('Esta sala no tiene un guardado confirmado. No se ha creado una campaña vacía.');
    const manifest = await this.api.getDocFromServer(this.ref('rooms', room.id, 'saves', room.checkpoint.id));
    const hashes = manifest.data()?.hashes;
    if (!hashes || hashes.length !== room.checkpoint.parts) throw new Error('El guardado está incompleto. No se ha sustituido la campaña local.');
    const parts = [];
    for (let i = 0; i < hashes.length; i += 20) {
      const rows = await Promise.all(hashes.slice(i, i + 20).map(hash => this.api.getDocFromServer(this.ref('rooms', room.id, 'chunks', hash))));
      for (const row of rows) { if (!row.exists()) throw new Error('Falta una parte del guardado. No se ha sustituido la campaña local.'); parts.push(row.data().text); }
    }
    const campaign = JSON.parse(parts.join(''));
    this.knownChunks ||= new Map(); this.knownChunks.set(room.id, new Set(hashes));
    return campaign;
  }
}
