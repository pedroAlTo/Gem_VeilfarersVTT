import { store } from './state.js';
import { network } from './networkManager.js';
import { LOCAL_ONLY } from './runtimeMode.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, sanitizeHTML, notify, confirmAction } from './ui.js';
import { openCharacterImport } from './characterManager.js';
import { openAccount, useCharacter, initAccount } from './accountUI.js';
import { isDrone } from './tokenPermissions.js';

export function invitationCode() { return network.room && network.invite ? `${network.room}.${network.invite}` : ''; }
export function parseInvitation(value) {
  let room, invite;
  try { const url = new URL(value); room = url.searchParams.get('room'); invite = new URLSearchParams(url.hash.slice(1)).get('invite'); } catch { [room, invite] = value.trim().split('.'); }
  if (!room || !invite || !/^[a-zA-Z0-9_-]{1,100}$/.test(room) || !/^[a-zA-Z0-9-]{20,100}$/.test(invite)) throw new Error('Paste the complete invitation code or link from the Keeper.');
  return { room, invite };
}
export async function copyText(value, button) {
  try { await navigator.clipboard.writeText(value); if (button) { const label = button.textContent; button.textContent = 'Copied'; setTimeout(() => button.textContent = label, 1600); } }
  catch { const modal = dossierDialog('COPY INVITATION', '<p>Copy this text with Ctrl+C or Cmd+C.</p><input class="hud-input" id="manual_copy" readonly>'); const input = modal.querySelector('input'); input.value = value; input.focus(); input.select(); }
}
export function initSessionBar() {
  const bar = document.createElement('div'); bar.className = 'session-strip';
  bar.innerHTML = '<button class="session-state" id="session_state">OFFLINE</button><span class="session-strip-name" id="session_name"></span><label class="session-code-label">INVITE <input aria-label="Invitation code" id="session_code" readonly></label><button class="hud-btn" id="session_copy">Copy code</button><button class="hud-btn" id="session_crew">Crew · 0</button><button class="hud-btn" id="session_account" data-account-label>Sign in</button>';
  document.querySelector('.header-hud').after(bar);
  bar.querySelector('#session_state').onclick = () => openSessionLobby();
  bar.querySelector('#session_crew').onclick = () => openSessionLobby();
  bar.querySelector('#session_account').onclick = openAccount;
  bar.querySelector('#session_copy').onclick = event => copyText(invitationCode(), event.currentTarget);
  const update = () => {
    const s = store.state;
    bar.querySelector('#session_state').textContent = s.isConnected ? '● ONLINE' : '○ OFFLINE';
    bar.querySelector('#session_state').dataset.online = String(s.isConnected);
    bar.querySelector('#session_name').textContent = s.campaignName;
    bar.querySelector('#session_name').title = s.campaignName;
    bar.querySelector('#session_code').value = invitationCode() || 'Local session';
    bar.querySelector('#session_copy').disabled = !invitationCode();
    bar.querySelector('#session_crew').textContent = `Crew · ${(s.connectedPeers || []).length}`;
  };
  store.subscribe(update); update(); initAccount();
  window.addEventListener('veil:announcement', event => dossierDialog('KEEPER BROADCAST', `<span class="dossier-eyebrow">${e(store.state.campaignName)}</span><p class="broadcast-message">${e(event.detail)}</p>`));
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

export function openSessionLobby(prefill = '') {
  const s = store.state, joined = store.sessionRole === 'player', active = s.isHosting || joined;
  const modal = dossierDialog('SESSION / CREW LINK', `
    <span class="dossier-eyebrow">${s.isConnected ? 'ONLINE' : 'OFFLINE'} / ${joined ? 'PLAYER' : 'KEEPER'}</span><h2>${e(s.campaignName)}</h2>
    <p class="dossier-muted">${active ? joined ? 'Import your character or ask the Keeper to assign one. Drones may be shared.' : 'Share the invitation, then assign characters to your crew.' : 'Host your current game, or paste an invitation to join a friend. No account is required to play.'}</p>
    ${!active ? `<div class="session-lobby-grid"><form id="host_form" class="session-card"><span class="dossier-eyebrow">01 / HOST</span><h3>Create an online game</h3><label class="dossier-field">Session name<input class="hud-input" id="host_name" maxlength="200" required value="${e(s.campaignName)}"></label><label><input type="checkbox" id="host_efforts" ${s.optionalEfforts ? 'checked' : ''}> Optional Efforts</label><button class="hud-btn hud-btn-primary" ${LOCAL_ONLY ? 'disabled' : ''}>Host game</button></form>
    <form id="join_form" class="session-card"><span class="dossier-eyebrow">02 / JOIN</span><h3>Join your crew</h3><label class="dossier-field">Your call sign<input class="hud-input" id="join_name" maxlength="80" required value="${e(s.userName === 'Keeper' ? '' : s.userName)}" placeholder="Your name"></label><label class="dossier-field">Invitation code or link<input class="hud-input" id="join_code" required value="${e(prefill)}" placeholder="Paste invitation"></label><button class="hud-btn hud-btn-primary" ${LOCAL_ONLY ? 'disabled' : ''}>Join game</button></form></div>${LOCAL_ONLY ? '<p class="import-warning">Local test mode. Use INICIAR_VTT_ONLINE.bat for online features.</p>' : ''}` : `
    <div class="session-invitation"><label class="dossier-field">Invitation code<input class="hud-input" readonly value="${e(invitationCode())}"></label><button class="hud-btn" id="lobby_copy">Copy code</button><button class="hud-btn" id="lobby_link">Copy link</button></div><div class="session-actions"><button class="hud-btn hud-btn-primary" id="lobby_import">Import my character</button><button class="hud-btn" id="lobby_library">My saved characters</button><button class="hud-btn" id="lobby_leave">${joined ? 'Leave game' : 'Close online game'}</button>${!s.isConnected && joined ? '<button class="hud-btn" id="lobby_reconnect">Reconnect</button>' : ''}</div>`}
    <p id="lobby_status" role="status"></p><p class="dossier-error" role="alert"></p>
    <h3>Player roster</h3><div id="lobby_roster"></div>
    ${s.isHosting ? '<form id="broadcast_form" class="session-card"><h3>Broadcast to everyone</h3><label class="dossier-field">Message<textarea class="hud-input" id="broadcast_text" maxlength="2000" rows="3" required placeholder="The next jump begins in five minutes…"></textarea></label><button class="hud-btn">Send broadcast</button></form>' : ''}
  `);
  const error = modal.querySelector('.dossier-error'), status = modal.querySelector('#lobby_status');
  const run = async fn => { error.textContent = ''; modal.dataset.busy = '1'; const buttons = [...modal.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true); try { await fn(); } catch (err) { error.textContent = err.message; status.textContent = ''; } finally { delete modal.dataset.busy; buttons.forEach(b => b.disabled = false); } };
  const renderRoster = () => {
    const state = store.state, players = state.players || [], list = modal.querySelector('#lobby_roster');
    if (list.contains(document.activeElement)) return;
    list.innerHTML = sanitizeHTML(players.length ? players.map(p => {
      const online = state.connectedPeers?.some(c => c.id === p.id), token = state.tokens.find(t => !isDrone(t) && t.ownerId === p.id), drones = state.tokens.filter(t => isDrone(t) && t.controllerIds?.includes(p.id));
      return `<article class="crew-row"><span class="crew-avatar">${e(p.name.slice(0, 1).toUpperCase())}</span><div><strong>${e(p.name)}</strong><small>${online ? 'Online' : 'Offline'} · ${e(token?.name || 'No character assigned')}</small>${drones.length ? `<small>Shared drones: ${drones.map(t => e(t.name)).join(', ')}</small>` : ''}</div>${state.isHosting ? `<vf-select class="hud-select" data-assign="${e(p.id)}" aria-label="Character for ${e(p.name)}"><option value="" ${!token ? 'selected' : ''}>Observer</option>${state.tokens.filter(t => !isDrone(t)).map(t => `<option value="${e(t.id)}" ${t.id === token?.id ? 'selected' : ''}>${e(t.name)}</option>`).join('')}</vf-select>` : ''}</article>`;
    }).join('') : '<p class="dossier-muted">No players yet. Host a game and share its invitation.</p>');
    list.querySelectorAll('[data-assign]').forEach(select => select.onchange = () => { try { network.assignToken(select.dataset.assign, select.value); } catch (err) { error.textContent = err.message; } });
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
  modal.querySelector('#join_form')?.addEventListener('submit', event => { event.preventDefault(); run(async () => { const { room, invite } = parseInvitation(modal.querySelector('#join_code').value); status.textContent = 'Connecting to the Keeper…'; await network.joinSession(room, modal.querySelector('#join_name').value.trim(), invite); modal.remove(); openSessionLobby(); }); });
  const bind = (id, fn) => { const b = modal.querySelector(id); if (b) b.onclick = fn; };
  bind('#lobby_copy', event => copyText(invitationCode(), event.currentTarget));
  bind('#lobby_link', event => copyText(`${location.origin}${location.pathname}?room=${encodeURIComponent(network.room)}#invite=${encodeURIComponent(network.invite)}`, event.currentTarget));
  bind('#lobby_library', openAccount);
  bind('#lobby_import', () => openCharacterImport({ single: joined, onImport: async entries => { for (const entry of entries) await useCharacter(entry.token); return entries.length; } }));
  bind('#lobby_leave', () => run(async () => { if (await confirmAction(joined ? 'Leave this game and return to your local campaign?' : 'Close this online game for all players? The campaign remains saved locally.')) { network.disconnect(); modal.remove(); openSessionLobby(); } }));
  bind('#lobby_reconnect', () => run(async () => { const { room, invite } = network, name = s.userName; await network.joinSession(room, name, invite); modal.remove(); openSessionLobby(); }));
  modal.querySelector('#broadcast_form')?.addEventListener('submit', event => { event.preventDefault(); const input = modal.querySelector('#broadcast_text'), text = input.value.trim(); if (!text) return; network.broadcast({ type: 'ANNOUNCEMENT', text }); status.textContent = `Broadcast sent to ${network.connections.size} connected players.`; input.value = ''; });
  return modal;
}
