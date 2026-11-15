// Shapes of the account data kept in Firestore. firestore.rules enforces the same limits.
import { newId } from './persistence.js';

const text = (value, max) => String(value ?? '').slice(0, max);

// A personal note belongs to one user and one room: users/{uid}/notes/{id}.
export function noteEntry(roomId, note = {}) {
  const room = text(roomId, 200);
  if (!room) throw new Error('La nota necesita una partida.');
  return { id: text(note.id, 200) || newId(), roomId: room, title: text(note.title, 200).trim(), body: text(note.body, 20000), updatedAt: Date.now() };
}

// Story arcs of a Keeper's room: rooms/{roomId}/arcs/{id}. The campaign save stays the
// source of truth; these entries let the account list a room's arcs without loading it.
export function arcEntries(campaign, now = Date.now()) {
  const scenes = new Set((campaign?.maps || []).map(m => m.id));
  return (campaign?.arcs || []).slice(0, 100).map((arc, order) => ({
    id: text(arc.id, 200), name: text(arc.name, 500) || 'Arco', description: text(arc.description, 5000),
    sceneIds: (arc.sceneIds || []).filter(id => scenes.has(id)).slice(0, 100), order, updatedAt: now,
  })).filter(arc => arc.id && !arc.id.includes('/'));
}
