import { store } from './state.js';
import { network } from './networkManager.js';
import { LOCAL_ONLY, LAN_SESSIONS, connectionDisplay } from './runtimeMode.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, sanitizeHTML, notify, confirmAction } from './ui.js';
import { openCharacterImport } from './characterManager.js';
import { openAccount, useCharacter, initAccount } from './accountUI.js';
import { isDrone } from './tokenPermissions.js';

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
  bar.innerHTML = '<button class="session-state" id="session_state">OFFLINE</button><span class="session-strip-name" id="session_name"></span><label class="session-code-label">INVITE <input aria-label="Invitation code" id="session_code" readonly></label><button class="hud-btn" id="session_copy">Copy code</button><button class="hud-btn hud-btn-primary" id="session_magic_btn" hidden title="Copiar Enlace Mágico de Invitación para Jugadores">🔗 Enlace Invitación</button><button class="hud-btn" id="session_crew">Crew · 0</button><div class="session-crew-pills" id="session_crew_pills" style="display:none; align-items:center; gap:4px; margin-left:6px;"></div><button class="hud-btn" id="session_join" hidden>Join game</button><button class="hud-btn" id="session_my_tokens" hidden>My tokens</button><button class="hud-btn" id="session_account" data-account-label>Sign in</button>';
  document.querySelector('.header-hud').after(bar);
  bar.querySelector('#session_state').onclick = () => openSessionLobby();
  bar.querySelector('#session_crew').onclick = () => openSessionLobby();
  bar.querySelector('#session_account').onclick = openAccount;
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
    mine.hidden = s.userRole !== 'player'; mine.disabled = !controlled.length; mine.textContent = `My tokens · ${controlled.length}`;
    mine.title = controlled.length ? 'Select and control your character or a shared drone' : 'Ask the Keeper to assign a token';

    // Fase 4: Live Crew status pills for the GM
    const crewPills = bar.querySelector('#session_crew_pills');
    if (crewPills) {
      if (s.isHosting) {
        const players = s.players || [];
        const peers = s.connectedPeers || [];
        crewPills.style.display = 'inline-flex';
        crewPills.innerHTML = sanitizeHTML(players.map(p => {
          const isOnline = peers.some(c => c.id === p.id);
          const tok = s.tokens.find(t => !isDrone(t) && t.ownerId === p.id);
          const avatar = tok?.avatarUrl || '';
          return `
            <span class="crew-live-pill ${isOnline ? 'online' : 'offline'}" style="display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:12px; font-size:10px; background:${isOnline ? 'rgba(0, 243, 255, 0.15)' : 'rgba(100, 116, 139, 0.2)'}; border:1px solid ${isOnline ? '#00f3ff' : '#64748b'}; color:#fff;" title="${e(p.name)} (${isOnline ? 'En línea' : 'Desconectado'}) — ${tok ? e(tok.name) : 'Sin personaje asignado'}">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${isOnline ? '#10b981' : '#64748b'};"></span>
              ${avatar ? `<img src="${e(avatar)}" style="width:14px; height:14px; border-radius:50%; object-fit:cover;" alt="" />` : ''}
              <strong>${e(p.name)}</strong>
              <small style="color:${tok ? 'var(--cyan-pearl)' : '#fbbf24'}; opacity:0.85;">${tok ? e(tok.name) : '⏳ Sin ficha'}</small>
            </span>
          `;
        }).join(''));
      } else {
        crewPills.style.display = 'none';
        crewPills.innerHTML = '';
      }
    }
  };
  store.subscribe(update); update(); initAccount();
  window.addEventListener('veil:announcement', event => dossierDialog('KEEPER BROADCAST', `<span class="dossier-eyebrow">${e(store.state.campaignName)}</span><p class="broadcast-message">${e(event.detail)}</p>`));
}

export function openPlayerTokens() {
  const tokens = store.getControlledTokens();
  const modal = dossierDialog('MY TOKENS', `<p class="dossier-muted">Move, turn, roll and manage the resources of your assigned tokens.</p><div class="session-actions">${tokens.map(token => `<button class="hud-btn" data-control-token="${e(token.id)}">Control ${e(token.name)}${isDrone(token) ? ' · shared drone' : ''}</button>`).join('') || '<p>No token assigned in this scene. Ask the Keeper to assign one.</p>'}</div>`);
  modal.querySelectorAll('[data-control-token]').forEach(button => button.onclick = () => {
    const token = store.state.tokens.find(t => t.id === button.dataset.controlToken);
    if (!token || !store.canEditToken(token.id)) { modal.remove(); notify('This token is no longer assigned to you.'); return; }
    store.update({ selectedTokenId: token.id, selectedWallId: null, selectedLightId: null, selectedWaterId: null, selectedEffectId: null, selectedTemplateId: null, activeTool: 'select', activeLayer: 'tokens' });
    const canvas = window.veilCanvas;
    if (canvas) { canvas.panX = canvas.displayWidth / 2 - token.x * canvas.zoom; canvas.panY = canvas.displayHeight / 2 - token.y * canvas.zoom; }
    modal.remove();
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

  const modal = dossierDialog(joinOnly ? 'JOIN GAME' : 'SESSION / CREW LINK', `
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
          <button class="hud-btn hud-btn-primary" id="btn_direct_join" style="width: 100%; margin-top: 10px;" ${LOCAL_ONLY ? 'disabled' : ''}>🚀 Entrar</button>
        </form>
      </div>
    ` : `<div class="session-lobby-grid"><form id="host_form" class="session-card"><span class="dossier-eyebrow">01 / HOST</span><h3>Create an online game</h3><label class="dossier-field">Session name<input class="hud-input" id="host_name" maxlength="200" required value="${e(s.campaignName)}"></label><label><input type="checkbox" id="host_efforts" ${s.optionalEfforts ? 'checked' : ''}> Optional Efforts</label><button class="hud-btn hud-btn-primary" ${LOCAL_ONLY ? 'disabled' : ''}>Host game</button></form>
    <form id="join_form" class="session-card"><span class="dossier-eyebrow">02 / JOIN</span><h3>Join your crew</h3><label class="dossier-field">Your call sign<input class="hud-input" id="join_name" maxlength="80" required value="${e(savedName)}" placeholder="Your name"></label><label class="dossier-field">Invitation code or link<input class="hud-input" id="join_code" required value="${e(prefill)}" placeholder="Paste invitation"></label><button class="hud-btn hud-btn-primary" ${LOCAL_ONLY ? 'disabled' : ''}>Join game</button></form></div>${LOCAL_ONLY ? '<p class="import-warning">Local test mode. Use INICIAR_VTT_ONLINE.bat for online features.</p>' : ''}`) : `
    <div class="session-invitation"><label class="dossier-field">Invitation code<input class="hud-input" readonly value="${e(invitationCode())}"></label><button class="hud-btn" id="lobby_copy">Copy code</button><button class="hud-btn hud-btn-primary" id="lobby_link">🔗 Copiar Enlace Mágico</button></div><div class="session-actions"><button class="hud-btn hud-btn-primary" id="lobby_import">Import my character</button><button class="hud-btn" id="lobby_library">My saved characters</button><button class="hud-btn" id="lobby_leave">${joined ? 'Leave game' : 'Close online game'}</button>${!s.isConnected && joined ? '<button class="hud-btn" id="lobby_reconnect">Reconnect</button>' : ''}</div>`}
    <p id="lobby_status" role="status"></p><p class="dossier-error" role="alert"></p>
    ${joinOnly ? '' : '<h3>Player roster</h3>'}<div id="lobby_roster" ${joinOnly ? 'hidden' : ''}></div>
    ${joinOnly && previewPlayer ? '<button type="button" class="hud-btn" id="lobby_preview">Preview player view offline</button>' : ''}
    ${s.isHosting ? '<form id="broadcast_form" class="session-card"><h3>Broadcast to everyone</h3><label class="dossier-field">Message<textarea class="hud-input" id="broadcast_text" maxlength="2000" rows="3" required placeholder="The next jump begins in five minutes…"></textarea></label><button class="hud-btn">Send broadcast</button></form>' : ''}
  `);
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
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hud-btn'; button.textContent = 'Susurrar';
      button.setAttribute('aria-label', `Susurrar a ${players.find(p => p.id === select.dataset.assign)?.name || 'jugador'}`);
      button.onclick = () => { modal.remove(); window.dispatchEvent(new CustomEvent('veil:open_chat', { detail: { recipientId: select.dataset.assign } })); };
      select.closest('.crew-row').append(button);
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
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('veil_last_player_name', playerName); } catch {}
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
