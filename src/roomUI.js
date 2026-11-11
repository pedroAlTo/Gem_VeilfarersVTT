import { rooms } from './roomController.js';
import { account } from './cloudAccount.js';
import { roomError, roomOnline } from './roomService.js';
import { store } from './state.js';
import { network } from './networkManager.js';
import { dossierDialog } from './dossierUI.js';
import { openAccount, initAccount, useCharacter } from './accountUI.js';
import { mountSessionNavigation } from './sessionNavigation.js';
import { openCharacterImport } from './characterManager.js';
import { escapeHTML as e, sanitizeHTML, confirmAction, notify } from './ui.js';

export function openRoomLobby(prefill = '') {
  const modal = dossierDialog('SESIONES', '<p>Leyendo tus salas…</p>', 'rooms-backdrop');
  mountSessionNavigation(modal, 'live');
  const body = modal.querySelector('.dossier-body'); let cached = [], busy = false;
  const run = async fn => {
    if (busy) return;
    busy = true; modal.dataset.busy = 'true';
    const disabled = new Set([...modal.querySelectorAll('button:disabled')]);
    modal.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { await fn(); }
    catch (error) { if (modal.isConnected) { paint(); body.querySelector('[data-room-error]').textContent = roomError(error); } }
    finally { busy = false; delete modal.dataset.busy; modal.querySelectorAll('button').forEach(b => { b.disabled = disabled.has(b); }); updateLive(); }
  };
  const refresh = async () => { await initAccount(); if (account.user && !account.user.isNetlify) cached = await rooms.service.list(); paint(); };
  const paint = () => {
    if (!modal.isConnected) return;
    const signed = account.user && !account.user.isNetlify, current = rooms.room;
    const card = room => `<article class="room-card"><div><h3>${e(room.name)}</h3><p>${roomOnline(room, rooms.service.now()) ? '<span class="room-live">● Keeper online</span>' : '<span class="room-paused">○ Keeper offline · sala en pausa</span>'}</p></div><button class="hud-btn hud-btn-primary" data-enter-room="${e(room.id)}">${room.id === current?.id ? 'Dentro de la sala' : room.ownerUid === rooms.service.uid ? 'Abrir como Keeper' : 'Entrar'}</button></article>`;
    body.innerHTML = sanitizeHTML(`
      <span class="dossier-eyebrow">SALAS / CAMPAÑAS PERSISTENTES</span><h2>Tus mesas de juego</h2>
      <p class="dossier-muted">Cada sala conserva su campaña, arcos, escenas y miembros. Puedes dirigir tus salas y jugar en las de otros Keepers.</p>
      ${!signed ? `<section class="room-notice"><h3>Entra con tu cuenta</h3><p>Usa Google o correo de Firebase para guardar tu acceso a las salas y volver desde otro equipo.</p><button class="hud-btn hud-btn-primary" data-room-login>Iniciar sesión</button>${account.user?.isNetlify ? '<p>La cuenta Netlify actual guarda su archivo local. Cambia a Google o correo de Firebase para usar salas.</p>' : ''}</section>` : `
      ${current ? `<section class="room-current"><span class="dossier-eyebrow">DENTRO DE LA SALA</span><h2>${e(current.name)}</h2><p data-current-presence class="room-paused"></p><p class="dossier-muted" data-room-save></p>
        <div class="session-actions"><button class="hud-btn" data-room-leave>Salir de la sala</button><button class="hud-btn" data-room-reconnect>Volver a conectar</button><button class="hud-btn" data-room-import ${store.state.roomPaused ? 'disabled' : ''}>Importar personaje</button><button class="hud-btn" data-room-archive>Mis personajes</button></div>
        ${rooms.isKeeper ? `<label class="dossier-field">Invitación única<input class="hud-input" readonly value="${e(current.inviteCode)}" aria-label="Invitación de sala"></label><div class="session-actions"><button class="hud-btn" data-room-copy>Copiar código</button><button class="hud-btn" data-room-link>Copiar enlace</button><button class="hud-btn" data-room-rotate>Regenerar invitación</button></div><p class="dossier-muted">Regenerar el código no expulsa a quienes ya son miembros.</p><h3>Jugadores de la sala</h3><div data-room-roster></div>` : '<p class="dossier-muted">Tu acceso y tus asignaciones se conservan al salir. Si el Keeper se desconecta, permanecerás en la sala y el juego se reanudará cuando vuelva.</p><h3>Jugadores de la sala</h3><div data-room-roster></div>'}
        ${rooms.isKeeper ? '<form data-room-broadcast><h3>Anuncio a la sala</h3><label class="dossier-field">Mensaje<textarea class="hud-input" name="message" required maxlength="2000" rows="2"></textarea></label><button class="hud-btn">Enviar anuncio</button></form>' : ''}
      </section>` : ''}
      <h3>Salas que dirijo</h3><div class="room-grid">${cached.filter(r => r.ownerUid === rooms.service.uid).map(card).join('') || '<p class="dossier-muted">Todavía no diriges ninguna sala.</p>'}</div>
      <h3>Salas en las que juego</h3><div class="room-grid">${cached.filter(r => r.ownerUid !== rooms.service.uid).map(card).join('') || '<p class="dossier-muted">Usa una invitación una vez; después podrás entrar desde aquí.</p>'}</div>
      ${!current ? `<form data-room-create class="session-card"><h3>Crear sala</h3><p class="dossier-muted">Crea una sala independiente con una copia de la campaña local actual, incluidos sus arcos y escenas.</p><label class="dossier-field">Nombre<input class="hud-input" name="roomName" required maxlength="200" value="${e(store.state.campaignName)}"></label><button class="hud-btn hud-btn-primary">Crear y entrar como Keeper</button></form>` : ''}
      <form data-room-join class="session-card"><h3>Entrar con invitación</h3><label class="dossier-field">Código o enlace<input class="hud-input" name="invitation" required placeholder="VF-…" value="${e(prefill)}"></label><button class="hud-btn hud-btn-primary">Aceptar invitación y entrar</button></form>
      `}<p class="dossier-error" role="alert" data-room-error></p><button class="hud-btn" data-room-refresh>Actualizar salas</button>`);
    const bind = (selector, fn) => { const b = body.querySelector(selector); if (b) b.onclick = fn; };
    bind('[data-room-login]', () => { modal.remove(); openAccount(); });
    bind('[data-room-refresh]', () => run(refresh));
    bind('[data-room-archive]', openAccount);
    bind('[data-room-leave]', () => run(async () => { await rooms.leave(); await refresh(); }));
    bind('[data-room-reconnect]', () => run(async () => { const id = rooms.room.id; await rooms.leave({ preserveRemembered: true }); await rooms.enter(id); await refresh(); }));
    const broadcast = body.querySelector('[data-room-broadcast]');
    if (broadcast) broadcast.onsubmit = event => { event.preventDefault(); if (!store.state.isConnected) { notify('La sala está en pausa.', 'error'); return; } const text = broadcast.elements.message.value.trim(); if (text) { network.broadcast({ type: 'ANNOUNCEMENT', text }); broadcast.elements.message.value = ''; notify('Anuncio enviado a los jugadores conectados.'); } };
    bind('[data-room-import]', () => openCharacterImport({ single: !rooms.isKeeper, onImport: async entries => { for (const entry of entries) await useCharacter(entry.token); return entries.length; } }));
    const copy = async value => { try { await navigator.clipboard.writeText(value); notify('Invitación copiada.'); } catch { const dialog = dossierDialog('COPIAR INVITACIÓN', `<p>Selecciona el texto y cópialo.</p><input class="hud-input" readonly value="${e(value)}">`); dialog.querySelector('input').select(); } };
    bind('[data-room-copy]', () => run(() => copy(rooms.room.inviteCode)));
    bind('[data-room-link]', () => run(() => copy(`${location.origin}${location.pathname}#roomInvite=${encodeURIComponent(rooms.room.inviteCode)}`)));
    bind('[data-room-rotate]', () => run(async () => { if (await confirmAction('¿Regenerar la invitación? El código anterior dejará de admitir nuevas entradas. Los miembros actuales mantendrán su acceso.')) { await rooms.rotate(); await refresh(); } }));
    body.querySelectorAll('[data-enter-room]').forEach(b => { b.onclick = () => run(async () => { await rooms.enter(b.dataset.enterRoom); await refresh(); }); });
    const create = body.querySelector('[data-room-create]'); if (create) create.onsubmit = event => { event.preventDefault(); run(async () => { await rooms.create(create.elements.roomName.value); await refresh(); }); };
    const join = body.querySelector('[data-room-join]'); if (join) join.onsubmit = event => { event.preventDefault(); run(async () => { await rooms.join(join.elements.invitation.value, account.user.displayName || store.state.userName); prefill = ''; if (location.hash.includes('roomInvite=')) history.replaceState(null, '', location.pathname + location.search); await refresh(); }); };
    updateLive();
  };
  const updateLive = () => {
    if (!modal.isConnected || !rooms.room) return;
    const presence = body.querySelector('[data-current-presence]');
    if (presence) { presence.textContent = store.state.isConnected ? (rooms.isKeeper ? '● Online · diriges esta sala' : '● Online · conectado al Keeper') : '○ Sala en pausa · esperando al Keeper'; presence.className = store.state.isConnected ? 'room-live' : 'room-paused'; }
    const importing = body.querySelector('[data-room-import]'); if (importing) importing.disabled = busy || !store.state.isConnected;
    const save = body.querySelector('[data-room-save]'); if (save) save.textContent = rooms.isKeeper ? (store.state.roomSaveStatus === 'error' ? 'No se ha podido confirmar el guardado. Conserva una copia local y reintenta.' : store.state.roomSaveStatus === 'saving' ? 'Guardando campaña…' : 'Campaña guardada · arcos y escenas conservados') : '';
    const error = body.querySelector('[data-room-error]'); if (error && rooms.lastError) error.textContent = rooms.lastError;
    const list = body.querySelector('[data-room-roster]');
    if (list && !list.contains(document.activeElement)) {
      const roster = rooms.isKeeper ? rooms.members : store.state.players.map(p => ({ uid: p.id, name: p.name, status: 'active' }));
      list.innerHTML = sanitizeHTML(roster.map(m => `<article class="room-card"><div><strong>${e(m.name)}</strong><p>${m.status === 'revoked' ? 'Acceso retirado' : store.state.connectedPeers.some(p => p.id === m.uid) ? '● Online' : '○ Offline'}</p><small>${e(store.state.tokens.find(t => t.ownerId === m.uid)?.name || 'Sin token asignado')}</small></div><div class="session-actions">${!rooms.isKeeper ? '' : m.status === 'active' ? `<button class="hud-btn" data-room-assign="${e(m.uid)}">Asignar token</button><button class="hud-btn hud-btn-danger" data-room-kick="${e(m.uid)}">Expulsar</button>` : `<button class="hud-btn" data-room-readmit="${e(m.uid)}">Readmitir</button>`}</div></article>`).join('') || '<p class="dossier-muted">Comparte la invitación para añadir jugadores.</p>');
      list.querySelectorAll('[data-room-kick]').forEach(b => b.onclick = () => run(async () => { if (await confirmAction('¿Expulsar a este jugador? Perderá el acceso a la sala y el control de sus tokens hasta que lo readmitas.')) await rooms.kick(b.dataset.roomKick); }));
      list.querySelectorAll('[data-room-readmit]').forEach(b => b.onclick = () => run(() => rooms.readmit(b.dataset.roomReadmit)));
      list.querySelectorAll('[data-room-assign]').forEach(b => b.onclick = () => {
        const uid = b.dataset.roomAssign;
        const dialog = dossierDialog('ASIGNAR TOKEN', `<p>Un personaje por jugador. Los drones se comparten desde los controles de cada token.</p><div class="session-actions"><button class="hud-btn" data-token="">Sin personaje</button>${store.state.tokens.filter(t => t.actorType !== 'drone').map(t => `<button class="hud-btn" data-token="${e(t.id)}">${e(t.name)}</button>`).join('')}</div>`);
        dialog.querySelectorAll('[data-token]').forEach(button => button.onclick = () => { network.assignToken(uid, button.dataset.token); dialog.remove(); updateLive(); });
      });
    }
  };
  const unroom = rooms.subscribe(updateLive), unstore = store.subscribe(updateLive);
  const observer = new MutationObserver(() => { if (!modal.isConnected) { unroom(); unstore(); observer.disconnect(); } }); observer.observe(document.body, { childList: true });
  run(refresh); return modal;
}
