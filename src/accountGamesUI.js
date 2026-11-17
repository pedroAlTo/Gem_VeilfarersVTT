// "Partidas" in the account screen: the rooms this account runs or plays in, each with the
// account's private notes for that game (users/{uid}/notes, never visible to the Keeper).
import { account } from './cloudAccount.js';
import { escapeHTML as e, sanitizeHTML, notify, confirmAction } from './ui.js';

// Rooms first (the one in play on top, then the ones you run, then the most recently played,
// then by name); notes whose room is no longer listed are kept in their own group so nothing
// written is ever hidden. `records` are the per-game entries (users/{uid}/games).
export function groupGames(roomList = [], notes = [], { uid = '', currentId = '', records = [] } = {}) {
  const recordOf = new Map(records.filter(r => r?.roomId).map(r => [r.roomId, r]));
  const byRoom = new Map();
  for (const note of notes) {
    if (!note?.roomId) continue;
    if (!byRoom.has(note.roomId)) byRoom.set(note.roomId, []);
    byRoom.get(note.roomId).push(note);
  }
  for (const list of byRoom.values()) list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const rank = game => (game.current ? 0 : game.role === 'keeper' ? 1 : 2);
  const games = roomList.filter(room => room?.id).map(room => ({
    id: room.id, name: room.name || room.id, inviteCode: room.inviteCode || '',
    role: room.ownerUid === uid ? 'keeper' : 'player', current: room.id === currentId, notes: byRoom.get(room.id) || [], record: recordOf.get(room.id) || null,
  })).sort((a, b) => rank(a) - rank(b) || (b.record?.lastPlayedAt || 0) - (a.record?.lastPlayedAt || 0) || a.name.localeCompare(b.name));
  const listed = new Set(games.map(game => game.id));
  const orphans = [...byRoom].filter(([id]) => !listed.has(id)).map(([id, list]) => ({ id, name: id, inviteCode: '', role: 'gone', current: false, notes: list, record: recordOf.get(id) || null }));
  return [...games, ...orphans];
}

const when = time => (time ? new Date(time).toLocaleString() : '');

export function mountAccountGames(container, { onEnter = () => {}, openRoomId = '' } = {}) {
  let games = [], notes = [], open = openRoomId, editing = null;

  const load = async () => {
    container.innerHTML = '<p class="dossier-muted">Cargando partidas…</p>';
    let roomList = [], roomError = '';
    const { rooms } = await import('./roomController.js');
    try { roomList = await rooms.service.list(); } catch (error) { roomError = error.message; }
    try { notes = await account.list('notes'); } catch (error) { notes = []; roomError ||= error.message; }
    let records = [];
    try { records = await account.list('games'); } catch { records = []; }
    if (!container.isConnected) return;
    const currentId = rooms.room?.id || '';
    games = groupGames(roomList, notes, { uid: account.user?.uid || '', currentId, records });
    if (!open && currentId) open = currentId;
    paint(roomError);
  };

  const noteEditor = game => {
    const note = editing && editing.roomId === game.id ? editing : null;
    const items = game.notes.map(n => `<li><button type="button" class="account-note-item${note?.id === n.id ? ' active' : ''}" data-note="${e(n.id)}"><strong>${e(n.title || 'Sin título')}</strong><small>${e(when(n.updatedAt))}</small></button></li>`).join('');
    return `<div class="account-notes" data-notes-for="${e(game.id)}">
      <ul class="account-note-list">${items || '<li class="dossier-muted">Todavía no hay notas para esta partida.</li>'}</ul>
      <button type="button" class="hud-btn" data-note-new>＋ Nueva nota</button>
      ${note ? `<form class="account-note-form" data-note-form>
        <label class="dossier-field">Título<input class="hud-input" name="note_title" maxlength="200" value="${e(note.title || '')}"></label>
        <label class="dossier-field">Nota<textarea class="hud-input" name="note_body" rows="7" maxlength="20000">${e(note.body || '')}</textarea></label>
        <div class="session-actions"><button type="submit" class="hud-btn hud-btn-primary">Guardar nota</button>${note.id ? '<button type="button" class="hud-btn hud-btn-danger" data-note-delete>Eliminar nota</button>' : ''}<button type="button" class="hud-btn" data-note-cancel>Cancelar</button></div>
      </form>` : ''}
      <p class="dossier-muted account-note-private">Tus notas son privadas: ni el Keeper ni los demás jugadores pueden leerlas.</p>
    </div>`;
  };

  // Your character there and when you last played, from the per-game record.
  const recordLine = game => {
    const r = game.record;
    if (!r) return '';
    const who = game.role === 'player' && r.characterName ? `<span class="account-game-character"><span>Tu personaje:</span> <strong>${e(r.characterName)}</strong>${r.characterSummary ? ` <small>${e(r.characterSummary)}</small>` : ''}</span>` : '';
    return `<p class="account-game-record">${who}<span class="account-game-last"><span>Última partida:</span> ${e(when(r.lastPlayedAt))}</span></p>`;
  };
  const roleLabel = role => ({ keeper: 'Keeper', player: 'Jugador', gone: 'Sala no disponible' }[role]);
  const paint = (problem = '') => {
    const rows = games.map(game => `<article class="account-game${game.current ? ' current' : ''}" data-game="${e(game.id)}">
      <header>
        <div><strong>${e(game.name)}</strong><small><span>${roleLabel(game.role)}</span>${game.inviteCode ? ` · ${e(game.inviteCode)}` : ''}${game.current ? ' · <span>En curso</span>' : ''}</small></div>
        <div class="account-game-actions">
          ${game.role !== 'gone' && !game.current ? '<button type="button" class="hud-btn" data-game-enter>Abrir sala</button>' : ''}
          <button type="button" class="hud-btn" data-game-notes aria-expanded="${open === game.id}">Notas (${game.notes.length})</button>
        </div>
      </header>
      ${recordLine(game)}
      ${open === game.id ? noteEditor(game) : ''}
    </article>`).join('');
    container.innerHTML = sanitizeHTML(`${problem ? `<p class="dossier-error" role="alert">${e(problem)}</p>` : ''}${rows || '<p class="dossier-muted">Aún no participas en ninguna sala. Crea una o entra con una invitación desde SESIONES.</p>'}`);
    container.querySelectorAll('[data-game]').forEach(card => {
      const game = games.find(g => g.id === card.dataset.game);
      card.querySelector('[data-game-enter]')?.addEventListener('click', () => onEnter(game));
      card.querySelector('[data-game-notes]').onclick = () => { open = open === game.id ? '' : game.id; editing = null; paint(); };
      card.querySelectorAll('[data-note]').forEach(button => { button.onclick = () => { editing = { ...game.notes.find(n => n.id === button.dataset.note) }; paint(); }; });
      card.querySelector('[data-note-new]')?.addEventListener('click', () => { editing = { id: '', roomId: game.id, title: '', body: '' }; paint(); container.querySelector('[data-note-form] [name=note_title]')?.focus(); });
      card.querySelector('[data-note-cancel]')?.addEventListener('click', () => { editing = null; paint(); });
      const form = card.querySelector('[data-note-form]');
      if (form) form.onsubmit = async event => {
        event.preventDefault();
        const data = new FormData(form);
        try {
          const saved = await account.saveNote(game.id, { id: editing.id, title: data.get("note_title"), body: data.get("note_body") });
          notes = [saved, ...notes.filter(n => n.id !== saved.id)];
          editing = { ...saved };
          games = games.map(g => g.id === game.id ? { ...g, notes: [saved, ...g.notes.filter(n => n.id !== saved.id)] } : g);
          notify('Nota guardada.'); paint();
        } catch (error) { notify(error.message, 'error'); }
      };
      card.querySelector('[data-note-delete]')?.addEventListener('click', async () => {
        if (!(await confirmAction('¿Eliminar esta nota?'))) return;
        try {
          await account.removeNote(editing.id);
          const id = editing.id; editing = null;
          notes = notes.filter(n => n.id !== id);
          games = games.map(g => g.id === game.id ? { ...g, notes: g.notes.filter(n => n.id !== id) } : g);
          notify('Nota eliminada.'); paint();
        } catch (error) { notify(error.message, 'error'); }
      });
    });
  };

  load().catch(error => { if (container.isConnected) container.innerHTML = sanitizeHTML(`<p class="dossier-error" role="alert">${e(error.message)}</p>`); });
  return { reload: load };
}
