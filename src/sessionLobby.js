import { store } from './state.js';
import { network } from './networkManager.js';
import { LOCAL_ONLY, LAN_SESSIONS, connectionDisplay } from './runtimeMode.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, sanitizeHTML, notify, confirmAction } from './ui.js';
import { openCharacterImport } from './characterManager.js';
import { openAccount, useCharacter, initAccount } from './accountUI.js';
import { isDrone } from './tokenPermissions.js';
import { mountSessionNavigation } from './sessionNavigation.js';

export function invitationCode() { return network.room && network.invite ? `${network.room}.${network.invite}` : ''; }
export function magicInvitationLink() {
  const code = invitationCode();
  if (!code) return '';
  return `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(code)}`;
}
export function parseInvitation(value) {
  let room, invite;
  try {
    const url = new URL(value);
    const joinParam = url.searchParams.get('join') || url.searchParams.get('room');
    if (joinParam && joinParam.includes('.')) {
      [room, invite] = joinParam.trim().split('.');
    } else {
      room = joinParam;
      invite = new URLSearchParams(url.hash.slice(1)).get('invite') || url.searchParams.get('invite');
    }
  } catch {
    [room, invite] = value.trim().split('.');
  }
  if (!room || !invite || !/^[a-zA-Z0-9_-]{1,100}$/.test(room) || !/^[a-zA-Z0-9-]{20,100}$/.test(invite)) throw new Error('Paste the complete invitation code or link from the Keeper.');
  return { room, invite };
}
export async function copyText(value, button) {
  try { await navigator.clipboard.writeText(value); if (button) { const label = button.textContent; button.textContent = 'Copiado'; setTimeout(() => button.textContent = label, 1600); } notify('¡Copiado al portapapeles!'); }
  catch { const modal = dossierDialog('COPY INVITATION', '<p>Copy this text with Ctrl+C or Cmd+C.</p><input class="hud-input" id="manual_copy" readonly>'); const input = modal.querySelector('input'); input.value = value; input.focus(); input.select(); }
}
export function initSessionBar() {
  const bar = document.createElement('div'); bar.className = 'session-strip';
  bar.innerHTML = '<button class="session-state" id="session_state">OFFLINE</button><span class="session-strip-name" id="session_name"></span><label class="session-code-label">INVITE <input aria-label="Invitation code" id="session_code" readonly></label><button class="hud-btn" id="session_copy">Copy code</button><button class="hud-btn hud-btn-primary" id="session_magic_btn" hidden title="Copiar Enlace Mágico de Invitación para Jugadores">🔗 Enlace Invitación</button><button class="hud-btn" id="session_crew">Crew · 0</button><div class="session-crew-pills" id="session_crew_pills" style="display:none; align-items:center; gap:4px; margin-left:6px;"></div><button class="hud-btn hud-btn-xs" id="session_map_sync" style="display:none; margin-left:6px; font-weight:600; cursor:pointer;" title="Telemetría de sincronización de escena">🛰️ Escena: 100%</button><button class="hud-btn" id="session_join" hidden>Join game</button><button class="hud-btn" id="session_my_tokens" hidden>My tokens</button>';
  document.querySelector('.header-hud').after(bar);
  bar.querySelector('#session_state').onclick = () => openSessionLobby();
  bar.querySelector('#session_crew').onclick = () => openSessionLobby();
  bar.querySelector('#session_map_sync').onclick = () => openMapSyncTelemetryModal();
  bar.querySelector('#session_join').onclick = () => openSessionLobby('', { joinOnly: true });
  bar.querySelector('#session_my_tokens').onclick = openPlayerTokens;
  bar.querySelector('#session_copy').onclick = event => copyText(invitationCode(), event.currentTarget);
  bar.querySelector('#session_magic_btn').onclick = event => copyText(magicInvitationLink(), event.currentTarget);
  const update = () => {
    const s = store.state;
    const { label, detail } = connectionDisplay(s, store.sessionRole);
    bar.querySelector('#session_state').textContent = `${s.isConnected ? '●' : '○'} ${label}`;
    bar.querySelector('#session_state').title = LAN_SESSIONS ? 'LAN · ' + detail : detail;
    bar.querySelector('#session_join').hidden = LOCAL_ONLY || store.sessionRole !== 'local';
    bar.querySelector('#session_state').dataset.online = String(s.isConnected);
    bar.querySelector('#session_name').textContent = s.campaignName;
    bar.querySelector('#session_name').title = s.campaignName;
    bar.querySelector('#session_code').value = invitationCode() || 'Local session';
    bar.querySelector('#session_copy').disabled = !invitationCode();
    const magicBtn = bar.querySelector('#session_magic_btn');
    if (magicBtn) magicBtn.hidden = !invitationCode() || store.sessionRole === 'player';
    bar.querySelector('#session_crew').textContent = `Crew · ${(s.connectedPeers || []).length}`;
    const mine = bar.querySelector('#session_my_tokens'), controlled = store.getControlledTokens();
    mine.hidden = s.userRole !== 'player';
    mine.disabled = false;
    mine.textContent = controlled.length
      ? `My tokens · ${controlled.length}`
      : (s.isObserver ? '👁️ Observador' : 'My tokens · 0');
    mine.title = controlled.length
      ? 'Select and control your character or a shared drone'
      : (s.isObserver ? 'Modo Observador activo: el Keeper te asignará un token' : 'Ask the Keeper to assign a token');

    // Live Scene Synchronization Status Button
    const mapSyncBtn = bar.querySelector('#session_map_sync');
    if (mapSyncBtn) {
      if (s.isConnected || s.isHosting) {
        mapSyncBtn.style.display = 'inline-flex';
        const myMemberId = store.memberId || store.peerId || 'local';
        const peers = (s.connectedPeers || []).filter(p => p.id && p.id !== myMemberId);
        const activeMap = store.getActiveMap();
        const activeMapId = activeMap?.id;
        const myStatus = network.mapLoadStatuses?.get(myMemberId) || network.mapLoadStatuses?.get('local');
        const selfReady = myStatus ? (myStatus.mapId === activeMapId && myStatus.loaded) : (window.veilCanvas?.isMapLoaded !== false);
        
        let total = 1;
        let ready = selfReady ? 1 : 0;
        let minProgress = selfReady ? 100 : (myStatus?.progress || 0);

        for (const peer of peers) {
          total++;
          const p = (s.players || []).find(x => x.id === peer.id);
          const st = network.mapLoadStatuses?.get(peer.id) ||
                     (p ? network.mapLoadStatuses?.get(p.id) : null) ||
                     (peer.name ? network.mapLoadStatuses?.get(peer.name) : null) ||
                     [...network.mapLoadStatuses.values()].find(x => (peer.name && x.name === peer.name) || x.peerId === peer.id || (p && x.peerId === p.id));
          const isPeerReady = st ? (st.mapId === activeMapId && st.loaded) : (!s.isHosting);
          if (isPeerReady) {
            ready++;
          } else {
            const prog = st ? (st.mapId === activeMapId ? st.progress : 0) : 0;
            if (prog < minProgress) minProgress = prog;
          }
        }

        if (ready >= total) {
          mapSyncBtn.textContent = '🛰️ Escena: 100% ✅';
          mapSyncBtn.style.borderColor = '#10b981';
          mapSyncBtn.style.color = '#7de8d0';
        } else if (selfReady) {
          mapSyncBtn.textContent = `🛰️ Escena: 100% (Tripulación: ${ready}/${total})`;
          mapSyncBtn.style.borderColor = '#10b981';
          mapSyncBtn.style.color = '#7de8d0';
        } else {
          mapSyncBtn.textContent = `⏳ Escena: ${ready}/${total} (${minProgress}%)`;
          mapSyncBtn.style.borderColor = '#f59e0b';
          mapSyncBtn.style.color = '#fbbf24';
        }
      } else {
        mapSyncBtn.style.display = 'none';
      }
    }

    // Fase 4: Live Crew status pills for the GM
    const crewPills = bar.querySelector('#session_crew_pills');
    if (crewPills) {
      if (s.isHosting) {
        const players = s.players || [];
        const peers = s.connectedPeers || [];
        const activeMapId = store.getActiveMap()?.id;
        crewPills.style.display = 'inline-flex';
        crewPills.innerHTML = sanitizeHTML(players.map(p => {
          const isOnline = peers.some(c => c.id === p.id);
          const tok = s.tokens.find(t => !isDrone(t) && t.ownerId === p.id);
          const avatar = tok?.avatarUrl || '';
          const peer = peers.find(c => c.id === p.id);
          const st = network.mapLoadStatuses?.get(p.id) ||
                     (peer ? network.mapLoadStatuses?.get(peer.id) : null) ||
                     network.mapLoadStatuses?.get(p.name) ||
                     [...network.mapLoadStatuses.values()].find(x => x.name === p.name || x.peerId === p.id || (peer && x.peerId === peer.id));
          const isReady = st ? (st.mapId === activeMapId && st.loaded) : false;
          const progress = isReady ? 100 : (st?.mapId === activeMapId ? st.progress : 0);
          const syncBadge = !isOnline ? '' : (isReady ?
            '<span style="color:#10b981; font-size:10px; margin-left:2px;" title="Escena descargada al 100%">✅</span>' :
            `<span style="color:#fbbf24; font-size:9px; margin-left:2px; background:rgba(245,158,11,0.2); padding:1px 3px; border-radius:3px;" title="Cargando escena: ${progress}%">⏳ ${progress}%</span>`
          );
          return `
            <span class="crew-live-pill ${isOnline ? 'online' : 'offline'}" style="display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:12px; font-size:10px; background:${isOnline ? 'rgba(0, 243, 255, 0.15)' : 'rgba(100, 116, 139, 0.2)'}; border:1px solid ${isOnline ? '#00f3ff' : '#64748b'}; color:#fff;" title="${e(p.name)} (${isOnline ? 'En línea' : 'Desconectado'}) — ${tok ? e(tok.name) : 'Sin personaje asignado'}">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${isOnline ? '#10b981' : '#64748b'};"></span>
              ${avatar ? `<img src="${e(avatar)}" style="width:14px; height:14px; border-radius:50%; object-fit:cover;" alt="" />` : ''}
              <strong>${e(p.name)}</strong>
              ${syncBadge}
              <small style="color:${tok ? 'var(--cyan-pearl)' : '#fbbf24'}; opacity:0.85;">${tok ? e(tok.name) : '⏳ Sin ficha'}</small>
              <button class="crew-kick-pill-btn" data-kick-player="${e(p.id)}" title="Expulsar a ${e(p.name)} de la sesión" style="margin-left:3px; padding:0 3px; font-size:9px; line-height:1; color:#ef4444; border:none; background:transparent; cursor:pointer; font-weight:bold;">✕</button>
            </span>
          `;
        }).join(''));
        crewPills.querySelectorAll('[data-kick-player]').forEach(btn => {
          btn.onclick = async (ev) => {
            ev.stopPropagation();
            const playerId = btn.dataset.kickPlayer;
            const targetPlayer = players.find(p => p.id === playerId);
            const name = targetPlayer?.name || 'este jugador';
            if (await confirmAction(`¿Expulsar a "${name}" de la sesión activa? Se revocará su acceso y se liberará su personaje asignado.`)) {
              network.kickPlayer(playerId);
            }
          };
        });
      } else {
        crewPills.style.display = 'none';
        crewPills.innerHTML = '';
      }
    }
  };
  store.subscribe(update); update(); initAccount();
  window.addEventListener('veil:map-load-status', () => update());
  window.addEventListener('veil:announcement', event => dossierDialog('KEEPER BROADCAST', `<span class="dossier-eyebrow">${e(store.state.campaignName)}</span><p class="broadcast-message">${e(event.detail)}</p>`));
  window.addEventListener('veil:kicked', event => {
    const reason = event.detail?.reason || 'Has sido expulsado de la sesión por el Director de Juego.';
    dossierDialog('ACCESO DENEGADO // EXPULSIÓN', `
      <span class="dossier-eyebrow">ENLACE TERMINADO</span>
      <h2 style="color:#ef4444;">Expulsado de la sesión</h2>
      <p style="margin:14px 0; color:#f87171; font-weight:500;">${e(reason)}</p>
      <p class="dossier-muted">Tu terminal ha sido desconectada del enlace táctico. Tu campaña y personajes locales permanecen intactos.</p>
      <div style="margin-top:16px;">
        <button class="hud-btn hud-btn-primary" onclick="this.closest('.dossier-modal')?.remove()">Entendido</button>
      </div>
    `);
  });
}

export function openPlayerTokens() {
  const tokens = store.getControlledTokens();
  const isObserver = !!store.state.isObserver;
  const content = tokens.length
    ? `<p class="dossier-muted">Mueve, gira, tira y gestiona los recursos de tus tokens asignados.</p>
       <div class="session-actions">${tokens.map(token => `<button class="hud-btn" data-control-token="${e(token.id)}">Controlar ${e(token.name)}${isDrone(token) ? ' · dron compartido' : ''}</button>`).join('')}</div>`
    : `<div style="text-align: center; padding: 12px 6px;">
        <p style="font-size: 15px; margin-bottom: 8px;">${isObserver ? '👁️ <strong>Estás conectado como Observador</strong>' : 'No tienes ningún token asignado en esta escena.'}</p>
        <p class="dossier-muted" style="margin-bottom: 16px;">${isObserver ? 'El Keeper te asignará tu personaje directamente cuando sea oportuno, o puedes reclamar o importar uno tú mismo.' : 'Pide al Keeper que te asigne uno o reclama uno disponible de la tripulación.'}</p>
        <button class="hud-btn hud-btn-primary" id="btn_modal_claim_character" style="width: 100%;">🎯 Reclamar o Importar Personaje</button>
       </div>`;
  const modal = dossierDialog('MIS TOKENS', content);
  modal.querySelectorAll('[data-control-token]').forEach(button => button.onclick = () => {
    const token = store.state.tokens.find(t => t.id === button.dataset.controlToken);
    if (!token || !store.canEditToken(token.id)) { modal.remove(); notify('This token is no longer assigned to you.'); return; }
    store.update({ selectedTokenId: token.id, selectedWallId: null, selectedLightId: null, selectedWaterId: null, selectedEffectId: null, selectedTemplateId: null, activeTool: 'select', activeLayer: 'tokens' });
    const canvas = window.veilCanvas;
    if (canvas) { canvas.panX = canvas.displayWidth / 2 - token.x * canvas.zoom; canvas.panY = canvas.displayHeight / 2 - token.y * canvas.zoom; }
    modal.remove();
  });
  modal.querySelector('#btn_modal_claim_character')?.addEventListener('click', () => {
    modal.remove();
    import('./rosterManager.js').then(({ openClaimCharacterModal }) => {
      openClaimCharacterModal();
    }).catch(() => {});
  });
  return modal;
}

export function openTokenControl(tokenId) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token) return;
  const keeper = store.sessionRole !== 'player' && store.state.userRole === 'keeper';
  const players = store.state.players || [];
  const drone = isDrone(token);
  const modal = dossierDialog('TOKEN CONTROL', `<h2>${e(token.name)}</h2><p class="dossier-muted">${drone ? 'Shared drone. Select every player who can control it.' : 'One character or NPC per player. Assigning this token releases their previous non-drone token.'}</p>
    <form><div class="controller-list">${players.length ? players.map(p => `<label><input type="${drone ? 'checkbox' : 'radio'}" name="controller" value="${e(p.id)}" ${(drone ? token.controllerIds?.includes(p.id) : token.ownerId === p.id) ? 'checked' : ''} ${keeper ? '' : 'disabled'}> ${e(p.name)}</label>`).join('') : '<p>Players appear here after joining your session.</p>'}${!drone ? `<label><input type="radio" name="controller" value="" ${!token.ownerId ? 'checked' : ''} ${keeper ? '' : 'disabled'}> Keeper only</label>` : ''}</div><p class="dossier-error" role="alert"></p>${keeper ? '<button class="hud-btn hud-btn-primary">Save control</button>' : ''}</form>`);
  modal.querySelector('form').onsubmit = event => { event.preventDefault(); try { store.assignTokenControllers(tokenId, [...modal.querySelectorAll('input:checked')].map(x => x.value)); modal.remove(); } catch (error) { modal.querySelector('.dossier-error').textContent = error.message; } };
}

export function openSessionLobby(prefill = '', { joinOnly = false, previewPlayer } = {}) {
  const s = store.state, joined = store.sessionRole === 'player', active = s.isHosting || joined;
  joinOnly = !active && joinOnly;
  let savedName = s.userName === 'Keeper' ? '' : s.userName;
  try {
    const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('veil_last_player_name') : null;
    if (fromStorage && !savedName) savedName = fromStorage;
  } catch {}

  const modal = dossierDialog(joinOnly ? 'UNIRSE A LA PARTIDA' : 'SESIONES', `
    <span class="dossier-eyebrow">${s.isConnected ? 'ONLINE' : 'OFFLINE'}${LAN_SESSIONS ? ' · LAN' : ''} / ${joinOnly || joined ? 'PLAYER' : 'KEEPER'}</span><h2>${joinOnly ? 'Unirse a la misión' : e(s.campaignName)}</h2>
    <p class="dossier-muted">${joinOnly ? 'Introduce tu nombre o indicativo de llamada. La sesión táctica se abrirá en cuanto la conexión esté lista.' : active ? joined ? 'Importa tu personaje o reclama uno disponible de la tripulación. Los drones pueden compartirse.' : 'Comparte el enlace de invitación y asigna personajes a tu tripulación.' : 'Inicia una partida online o pega un enlace para unirte a tus compañeros. No se requiere cuenta para jugar.'}</p>
    ${!active ? (joinOnly ? `
      <div class="session-join-compact" style="max-width: 440px; margin: 0 auto;">
        <form id="join_form" class="session-card">
          <span class="dossier-eyebrow">CONEXIÓN RÁPIDA / JUGADOR</span>
          <h3>Unirse a la misión ${prefill ? `[${e(prefill.split('.')[0])}]` : ''}</h3>
          <label class="dossier-field">Nombre de Jugador / Indicativo
            <input class="hud-input" id="join_name" maxlength="80" required value="${e(savedName)}" placeholder="Tu nombre de jugador">
          </label>
          <label class="dossier-field" ${prefill ? 'style="display:none;"' : ''}>Código o Enlace de Invitación
            <input class="hud-input" id="join_code" required value="${e(prefill)}" placeholder="Pega el código o enlace">
          </label>
          <label class="dossier-field" style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-top:8px;">
            <input type="checkbox" id="join_as_observer" ${s.isObserver ? 'checked' : ''}>
            <span>👁️ Unirme como Observador (el Keeper asignará el token)</span>
          </label>
          <button class="hud-btn hud-btn-primary" id="btn_direct_join" style="width: 100%; margin-top: 10px;" ${LOCAL_ONLY ? 'disabled' : ''}>🚀 Entrar</button>
        </form>
      </div>
    ` : `<div class="session-lobby-grid"><form id="host_form" class="session-card"><span class="dossier-eyebrow">01 / HOST</span><h3>Create an online game</h3><label class="dossier-field">Session name<input class="hud-input" id="host_name" maxlength="200" required value="${e(s.campaignName)}"></label><label><input type="checkbox" id="host_efforts" ${s.optionalEfforts ? 'checked' : ''}> Optional Efforts</label><button class="hud-btn hud-btn-primary" ${LOCAL_ONLY ? 'disabled' : ''}>Host game</button></form>
    <form id="join_form" class="session-card"><span class="dossier-eyebrow">02 / JOIN</span><h3>Join your crew</h3><label class="dossier-field">Your call sign<input class="hud-input" id="join_name" maxlength="80" required value="${e(savedName)}" placeholder="Your name"></label><label class="dossier-field">Invitation code or link<input class="hud-input" id="join_code" required value="${e(prefill)}" placeholder="Paste invitation"></label><label class="dossier-field" style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-top:8px;"><input type="checkbox" id="join_as_observer" ${s.isObserver ? 'checked' : ''}> <span>👁️ Unirme como observador (el Keeper asignará el token)</span></label><button class="hud-btn hud-btn-primary" ${LOCAL_ONLY ? 'disabled' : ''}>Join game</button></form></div>${LOCAL_ONLY ? '<p class="import-warning">Local test mode. Use INICIAR_VTT_ONLINE.bat for online features.</p>' : ''}`) : `
    <div class="session-invitation"><label class="dossier-field">Invitation code<input class="hud-input" readonly value="${e(invitationCode())}"></label><button class="hud-btn" id="lobby_copy">Copy code</button><button class="hud-btn hud-btn-primary" id="lobby_link">🔗 Copiar Enlace Mágico</button></div><div class="session-actions"><button class="hud-btn hud-btn-primary" id="lobby_import">Import my character</button><button class="hud-btn" id="lobby_library">My saved characters</button><button class="hud-btn" id="lobby_leave">${joined ? 'Leave game' : 'Close online game'}</button>${!s.isConnected && joined ? '<button class="hud-btn" id="lobby_reconnect">Reconnect</button>' : ''}</div>`}
    <p id="lobby_status" role="status"></p><p class="dossier-error" role="alert"></p>
    ${joinOnly ? '' : '<h3>Player roster</h3>'}<div id="lobby_roster" ${joinOnly ? 'hidden' : ''}></div>
    ${joinOnly && previewPlayer ? '<button type="button" class="hud-btn" id="lobby_preview">Preview player view offline</button>' : ''}
    ${s.isHosting ? '<form id="broadcast_form" class="session-card"><h3>Broadcast to everyone</h3><label class="dossier-field">Message<textarea class="hud-input" id="broadcast_text" maxlength="2000" rows="3" required placeholder="The next jump begins in five minutes…"></textarea></label><button class="hud-btn">Send broadcast</button></form>' : ''}
  `);
  mountSessionNavigation(modal, 'live');
  const error = modal.querySelector('.dossier-error'), status = modal.querySelector('#lobby_status');
  if (joinOnly) modal.querySelector('#join_name').focus();
  modal.querySelector('#lobby_preview')?.addEventListener('click', () => { modal.remove(); previewPlayer(); });
  const run = async fn => { error.textContent = ''; modal.dataset.busy = '1'; const buttons = [...modal.querySelectorAll('button')]; const enabled = buttons.filter(b => !b.disabled); enabled.forEach(b => b.disabled = true); try { await fn(); } catch (err) { error.textContent = err.message; status.textContent = ''; } finally { delete modal.dataset.busy; enabled.forEach(b => b.disabled = false); } };
  const renderRoster = () => {
    const state = store.state, players = state.players || [], list = modal.querySelector('#lobby_roster');
    if (list.contains(document.activeElement)) return;
    list.innerHTML = sanitizeHTML(players.length ? players.map(p => {
      const online = state.connectedPeers?.some(c => c.id === p.id), token = state.tokens.find(t => !isDrone(t) && t.ownerId === p.id), drones = state.tokens.filter(t => isDrone(t) && t.controllerIds?.includes(p.id));
      return `<article class="crew-row"><span class="crew-avatar">${e(p.name.slice(0, 1).toUpperCase())}</span><div><strong>${e(p.name)}</strong><small>${online ? 'Online' : 'Offline'} · ${e(token?.name || 'No character assigned')}</small>${drones.length ? `<small>Shared drones: ${drones.map(t => e(t.name)).join(', ')}</small>` : ''}</div>${state.isHosting ? `<vf-select class="hud-select" data-assign="${e(p.id)}" aria-label="Character for ${e(p.name)}"><option value="" ${!token ? 'selected' : ''}>Observer</option>${state.tokens.filter(t => !isDrone(t)).map(t => `<option value="${e(t.id)}" ${t.id === token?.id ? 'selected' : ''}>${e(t.name)}</option>`).join('')}</vf-select>` : ''}</article>`;
    }).join('') : '<p class="dossier-muted">No players yet. Host a game and share its invitation.</p>');
    list.querySelectorAll('[data-assign]').forEach(select => select.onchange = () => { try { network.assignToken(select.dataset.assign, select.value); } catch (err) { error.textContent = err.message; } });
    if (state.isHosting) list.querySelectorAll('[data-assign]').forEach(select => {
      const playerId = select.dataset.assign;
      const targetPlayer = players.find(p => p.id === playerId);
      const name = targetPlayer?.name || 'jugador';

      const button = document.createElement('button'); button.type = 'button'; button.className = 'hud-btn'; button.textContent = 'Susurrar';
      button.setAttribute('aria-label', `Susurrar a ${name}`);
      button.onclick = () => { modal.remove(); window.dispatchEvent(new CustomEvent('veil:open_chat', { detail: { recipientId: playerId } })); };
      select.closest('.crew-row').append(button);

      const kickBtn = document.createElement('button');
      kickBtn.type = 'button';
      kickBtn.className = 'hud-btn hud-btn-danger';
      kickBtn.textContent = '👢 Expulsar';
      kickBtn.title = `Expulsar a ${name} de la sesión`;
      kickBtn.setAttribute('aria-label', `Expulsar a ${name}`);
      kickBtn.onclick = async () => {
        if (await confirmAction(`¿Expulsar a "${name}" de la sesión? No podrá reconectarse automáticamente.`)) {
          network.kickPlayer(playerId);
          renderRoster();
        }
      };
      select.closest('.crew-row').append(kickBtn);
    });
    if (state.isHosting) {
      const row = document.createElement('div'); row.className = 'session-actions';
      for (const drone of state.tokens.filter(isDrone)) { const b = document.createElement('button'); b.className = 'hud-btn'; b.textContent = `Drone controls · ${drone.name}`; b.onclick = () => openTokenControl(drone.id); row.append(b); }
      list.append(row);
    }
  };
  renderRoster();
  const unsub = store.subscribe((state, keys) => { if (keys.some(k => ['players', 'connectedPeers', 'tokens'].includes(k))) renderRoster(); });
  const observer = new MutationObserver(() => { if (!modal.isConnected) { unsub(); observer.disconnect(); } }); observer.observe(document.body, { childList: true });
  modal.querySelector('#host_form')?.addEventListener('submit', event => { event.preventDefault(); run(async () => { store.update({ campaignName: modal.querySelector('#host_name').value.trim(), optionalEfforts: modal.querySelector('#host_efforts').checked }); status.textContent = 'Opening your game…'; await network.hostSession(); modal.remove(); openSessionLobby(); }); });
  modal.querySelector('#join_form')?.addEventListener('submit', event => {
    event.preventDefault();
    const playerName = modal.querySelector('#join_name').value.trim();
    const asObserver = !!modal.querySelector('#join_as_observer')?.checked;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('veil_last_player_name', playerName); } catch {}
    store.update({ isObserver: asObserver, ...(asObserver ? { claimedTokenId: null, selectedTokenId: null } : {}) });
    run(async () => {
      const { room, invite } = parseInvitation(modal.querySelector('#join_code').value);
      status.textContent = 'Connecting to the Keeper and waiting for the map…';
      await network.joinSession(room, playerName, invite);
      modal.remove();
      openSessionLobby();
    });
  });
  const bind = (id, fn) => { const b = modal.querySelector(id); if (b) b.onclick = fn; };
  bind('#lobby_copy', event => copyText(invitationCode(), event.currentTarget));
  bind('#lobby_link', event => copyText(magicInvitationLink(), event.currentTarget));
  bind('#lobby_library', openAccount);
  bind('#lobby_import', () => openCharacterImport({ single: joined, onImport: async entries => { for (const entry of entries) await useCharacter(entry.token); return entries.length; } }));
  bind('#lobby_leave', () => run(async () => { if (await confirmAction(joined ? 'Leave this game and return to your local campaign?' : 'Close this online game for all players? The campaign remains saved locally.')) { network.disconnect(); modal.remove(); openSessionLobby(); } }));
  bind('#lobby_reconnect', () => run(async () => { const { room, invite } = network, name = s.userName; await network.joinSession(room, name, invite); modal.remove(); openSessionLobby(); }));
  modal.querySelector('#broadcast_form')?.addEventListener('submit', event => { event.preventDefault(); const input = modal.querySelector('#broadcast_text'), text = input.value.trim(); if (!text) return; network.broadcast({ type: 'ANNOUNCEMENT', text }); status.textContent = `Broadcast sent to ${network.connections.size} connected players.`; input.value = ''; });
  return modal;
}

export function openMapSyncTelemetryModal() {
  const modal = dossierDialog('TELEMETRÍA // ESTADO DE ESCENA', '<div id="telemetry_content"></div>');
  const container = modal.querySelector('#telemetry_content');

  const render = () => {
    if (!container || !modal.isConnected) return;
    const s = store.state;
    const activeMap = store.getActiveMap() || { name: 'Escena actual' };
    const peers = s.connectedPeers || [];
    const players = s.players || [];
    const activeMapId = activeMap.id;

    const myMemberId = store.memberId || store.peerId || 'local';
    const myStatus = network.mapLoadStatuses?.get(myMemberId) || network.mapLoadStatuses?.get('local');
    const selfLoaded = myStatus ? (myStatus.mapId === activeMapId && myStatus.loaded) : (window.veilCanvas?.isMapLoaded !== false);
    const selfProgress = selfLoaded ? 100 : (myStatus?.progress || 0);
    const isKeeper = s.userRole === 'keeper';

    const keeperStatus = network.mapLoadStatuses?.get('keeper') || [...network.mapLoadStatuses.values()].find(x => x.role === 'keeper');
    const isKeeperReady = keeperStatus ? (keeperStatus.mapId === activeMapId && keeperStatus.loaded) : true;
    const keeperRow = isKeeper ? null : {
      name: 'Director de Juego (Keeper)',
      role: 'KEEPER',
      tokenName: 'Host de la misión',
      progress: 100,
      loaded: isKeeperReady,
      statusText: 'Matriz cargada al 100%',
      isSelf: false
    };

    const rows = [
      {
        name: isKeeper ? 'Keeper' : (s.userName || s.playerName || 'Mi Terminal'),
        role: isKeeper ? 'KEEPER' : 'OPERATIVO',
        tokenName: isKeeper ? 'Director de Juego' : (store.getSelectedToken()?.name || 'Operativo'),
        progress: selfProgress,
        loaded: selfLoaded,
        statusText: selfLoaded ? 'Matriz cargada al 100%' : (myStatus?.text || 'Descargando...'),
        isSelf: true
      },
      ...(keeperRow ? [keeperRow] : []),
      ...peers.filter(peer => peer.id && peer.id !== myMemberId).map(peer => {
        const p = players.find(x => x.id === peer.id);
        const tok = s.tokens.find(t => !isDrone(t) && t.ownerId === peer.id);
        const st = network.mapLoadStatuses?.get(peer.id) ||
                   (p ? network.mapLoadStatuses?.get(p.id) : null) ||
                   (peer.name ? network.mapLoadStatuses?.get(peer.name) : null) ||
                   [...network.mapLoadStatuses.values()].find(x => (peer.name && x.name === peer.name) || x.peerId === peer.id || (p && x.peerId === p.id));
        const isReady = st ? (st.mapId === activeMapId && st.loaded) : (!s.isHosting);
        const progress = isReady ? 100 : (st?.mapId === activeMapId ? st.progress : 0);
        return {
          name: peer.name || p?.name || 'Operativo',
          role: 'OPERATIVO',
          tokenName: tok ? tok.name : 'Sin personaje asignado',
          progress,
          loaded: isReady,
          statusText: isReady ? 'Matriz cargada al 100%' : (st?.text || 'Descargando escena...'),
          isSelf: false
        };
      })
    ];

    const allReady = rows.every(r => r.loaded);
    const readyCount = rows.filter(r => r.loaded).length;

    container.innerHTML = sanitizeHTML(`
      <span class="dossier-eyebrow">SINCRONIZACIÓN DE MATRIZ TÁCTICA // MULTIJUGADOR</span>
      <h2>${e(activeMap.name)}</h2>
      <p class="dossier-muted">Estado de descarga y decodificación del mapa táctico en las terminales de la tripulación (${readyCount}/${rows.length} sincronizados).</p>

      <div style="margin: 16px 0; display: flex; flex-direction: column; gap: 10px;">
        ${rows.map(row => `
          <div class="glass-panel" style="padding: 10px 14px; border-radius: 6px; border: 1px solid ${row.loaded ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}; background: rgba(13, 20, 36, 0.7);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${row.loaded ? '#10b981' : '#fbbf24'}; box-shadow: 0 0 8px ${row.loaded ? '#10b981' : '#fbbf24'};"></span>
                <strong style="color: #fff; font-size: 13px;">${e(row.name)} ${row.isSelf ? '<small style="color:var(--cyan-pearl);">(Tú)</small>' : ''}</strong>
                <span style="font-size: 10px; color: #94a3b8;">[${e(row.tokenName)}]</span>
              </div>
              <span style="font-family: var(--font-mono, monospace); font-weight: 700; color: ${row.loaded ? '#10b981' : '#fbbf24'}; font-size: 12px;">
                ${row.loaded ? '100% ✅' : `${row.progress}% ⏳`}
              </span>
            </div>

            <div style="width: 100%; height: 6px; background: rgba(15, 23, 42, 0.8); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${row.progress}%; background: ${row.loaded ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f59e0b, #fbbf24)'}; transition: width 0.3s ease;"></div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-top: 4px; font-family: var(--font-mono, monospace);">
              <span>${e(row.statusText)}</span>
              <span>${row.loaded ? 'Listo para el combate' : 'Esperando datos de escena...'}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="padding: 10px; border-radius: 6px; text-align: center; background: ${allReady ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; border: 1px solid ${allReady ? '#10b981' : '#f59e0b'};">
        <strong style="color: ${allReady ? '#10b981' : '#fbbf24'}; font-size: 12px;">
          ${allReady ? '🚀 TODOS LOS OPERATIVOS ESTÁN SINCRONIZADOS Y LISTOS' : '⏳ ESPERANDO A QUE TODOS LOS OPERATIVOS COMPLETEN LA CARGA DEL MAPA'}
        </strong>
      </div>
    `);
  };

  render();
  window.addEventListener('veil:map-load-status', render);
  const unsub = store.subscribe(() => render());
  const obs = new MutationObserver(() => {
    if (!modal.isConnected) {
      window.removeEventListener('veil:map-load-status', render);
      unsub();
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true });

  return modal;
}
