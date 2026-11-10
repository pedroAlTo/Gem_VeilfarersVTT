import { openCharacterImport } from './characterManager.js';
import { dossierDialog } from './dossierUI.js';
import { sanitizeHTML, escapeHTML, notify, confirmAction } from './ui.js';
import { isDrone } from './tokenPermissions.js';
// src/rosterManager.js
// Operative Roster and NPC/Adversary Manager

import { store } from './state.js';
import { network } from './networkManager.js';

export class RosterManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('tokens') || keys.includes('selectedTokenId') || keys.includes('userRole') || keys.includes('activeMapId')) {
        this.render();
      }
    });
  }

  render() {
    const state = store.getState();
    const tokens = store.getTokensForActiveMap();
    const reserveTokens = store.getReserveTokens ? store.getReserveTokens() : state.tokens.filter(t => t.inReserve || t.mapId === 'reserve');
    const isKeeper = state.userRole === 'keeper';

    this.container.innerHTML = sanitizeHTML(`
      <div class="roster-sidebar-content">
        <div class="sidebar-header-row">
          <span class="sidebar-title">TACTICAL ROSTER (${tokens.length})</span>
          ${isKeeper ? `
            <button class="hud-btn hud-btn-xs" id="add_token_btn">+ ACTOR</button>
          ` : ''}
        </div>

        ${isKeeper ? '<div class="roster-import-actions"><button class="hud-btn" id="bestiary_open">Biblioteca de adversarios</button><button class="hud-btn hud-btn-primary" id="import_actors_btn">IMPORTAR PERSONAJES JSON</button></div>' : ''}
        <div class="roster-tokens-list">
          ${tokens.map(tok => {
            const isSelected = tok.id === state.selectedTokenId;
            return `
              <div class="roster-token-card glass-panel ${isSelected ? 'selected' : ''}" data-id="${tok.id}">
                <img src="${tok.avatarUrl || '/assets/tokens/captain_harker.jpg'}" class="roster-token-avatar" />
                <div class="roster-token-info">
                  <div class="roster-name-row">
                    <span class="roster-name">${escapeHTML(tok.name)}</span>
                    <span class="roster-badge ${tok.isPlayer ? 'badge-pc' : 'badge-npc'}">
                      ${tok.isPlayer ? 'PC' : tok.actorType === 'drone' ? 'DRONE' : tok.actorType === 'npc' ? 'NPC' : 'THREAT'}
                    </span>
                  </div>
                  <div class="roster-stats-row">
                    <span>HP: ${tok.hp.current}/${tok.hp.max}</span>
                    <span>ARMOR: ${tok.armor?.current || 0}</span>
                    <span>${escapeHTML(tok.isPlayer ? tok.path : 'EVASION ' + (tok.evasion ?? '—'))}</span>
                  </div>
                </div>
                <div class="roster-card-actions">
                  <button class="hud-btn hud-btn-xs focus-token-btn" data-id="${tok.id}" title="Focus View on Token">🎯</button>
                  ${isKeeper ? `
                    <button class="hud-btn hud-btn-xs toggle-hide-btn ${tok.hidden ? 'text-purple' : ''}" data-id="${tok.id}" title="${tok.hidden ? 'Make Visible' : 'Hide from Players'}">
                      ${tok.hidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                    <button class="hud-btn hud-btn-xs send-reserve-btn" data-id="${tok.id}" title="Mover a Reserva (Quitar del mapa)">📦</button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- SECCIÓN BANCO DE RESERVA -->
        <div class="sidebar-header-row" style="margin-top: 14px; border-top: 1px solid rgba(0, 243, 255, 0.2); padding-top: 10px;">
          <span class="sidebar-title" style="color: #fbbf24;">BANCO DE RESERVA (${reserveTokens.length})</span>
        </div>

        ${reserveTokens.length === 0 ? `
          <div style="font-size: 11px; color: #64748b; padding: 6px 4px; font-style: italic;">
            No hay operativos en reserva. (Pulsa [Supr] o el botón 📦 para retirar tokens del mapa a la reserva).
          </div>
        ` : `
          <div class="roster-tokens-list roster-reserve-list">
            ${reserveTokens.map(tok => {
              return `
                <div class="roster-token-card glass-panel reserve-token-card" data-id="${tok.id}" style="border-color: rgba(245, 158, 11, 0.35); background: rgba(15, 23, 42, 0.7); cursor: pointer;" title="Haz clic para ver o editar su ficha">
                  <img src="${tok.avatarUrl || '/assets/tokens/captain_harker.jpg'}" class="roster-token-avatar" style="border: 2px solid #f59e0b;" />
                  <div class="roster-token-info">
                    <div class="roster-name-row">
                      <span class="roster-name" style="color: #fbbf24;">${escapeHTML(tok.name)}</span>
                      <span class="roster-badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">
                        RESERVA
                      </span>
                    </div>
                    <div class="roster-stats-row">
                      <span>HP: ${tok.hp?.current ?? '?'}/${tok.hp?.max ?? '?'}</span>
                      <span>ARMOR: ${tok.armor?.current || 0}</span>
                      <span>${escapeHTML(tok.isPlayer ? tok.path || 'PC' : tok.actorType || 'NPC')}</span>
                    </div>
                  </div>
                  <div class="roster-card-actions" style="display: flex; gap: 4px; align-items: center;">
                    <button class="hud-btn hud-btn-xs hud-btn-primary deploy-reserve-btn" data-id="${tok.id}" title="Desplegar Operativo en el mapa actual">🚀</button>
                    ${isKeeper ? `
                      <button class="hud-btn hud-btn-xs hud-btn-danger delete-reserve-btn" data-id="${tok.id}" title="Eliminar definitivamente de la campaña">🗑️</button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `);

    this.initEvents();
  }

  initEvents() {
    const isKeeper = store.getState().userRole === 'keeper';

    const library = this.container.querySelector('#bestiary_open');
    if (library) library.onclick = async () => {
      try { const { openAdversaryLibrary } = await import('./adversaryLibrary.js'); await openAdversaryLibrary(); }
      catch (error) { notify(error.message, 'error'); }
    };
    // Select & focus token
    this.container.querySelectorAll('.roster-tokens-list:not(.roster-reserve-list) .roster-token-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.focus-token-btn') || e.target.closest('.toggle-hide-btn') || e.target.closest('.send-reserve-btn')) return;
        const tokId = card.dataset.id;
        store.update({ selectedTokenId: tokId });
      };
    });

    // Clicking reserve token card opens character sheet
    this.container.querySelectorAll('.reserve-token-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.deploy-reserve-btn') || e.target.closest('.delete-reserve-btn')) return;
        const tokId = card.dataset.id;
        const tok = store.getState().tokens.find(t => t.id === tokId);
        if (tok && window.veilTokenHUD) {
          window.veilTokenHUD.openCharacterSheetModal(tok);
        }
      };
    });

    this.container.querySelectorAll('.focus-token-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const tokId = btn.dataset.id;
        const tok = store.getState().tokens.find(t => t.id === tokId);
        if (tok && window.veilCanvas) {
          const cv = window.veilCanvas;
          cv.panX = cv.displayWidth / 2 - tok.x * cv.zoom;
          cv.panY = cv.displayHeight / 2 - tok.y * cv.zoom;
          store.update({ selectedTokenId: tok.id });
        }
      };
    });

    // Send to reserve button in active list
    this.container.querySelectorAll('.send-reserve-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const tokId = btn.dataset.id;
        const tok = store.getState().tokens.find(t => t.id === tokId);
        if (tok) {
          store.sendTokenToReserve(tokId);
          network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId: tokId, partial: { mapId: 'reserve', inReserve: true } });
          network.syncAll?.();
          notify(`📦 "${tok.name}" retirado a la Reserva.`);
        }
      };
    });

    // Deploy from reserve button
    this.container.querySelectorAll('.deploy-reserve-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const tokId = btn.dataset.id;
        const tok = store.getState().tokens.find(t => t.id === tokId);
        if (tok) {
          store.deployTokenFromReserve(tokId);
          network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId: tokId, partial: { mapId: store.state.activeMapId, inReserve: false } });
          network.syncAll?.();
          const deployedTok = store.getState().tokens.find(t => t.id === tokId);
          if (deployedTok && window.veilCanvas) {
            const cv = window.veilCanvas;
            cv.panX = cv.displayWidth / 2 - deployedTok.x * cv.zoom;
            cv.panY = cv.displayHeight / 2 - deployedTok.y * cv.zoom;
          }
          notify(`🚀 "${tok.name}" desplegado en el mapa.`);
        }
      };
    });

    // Delete token in reserve permanently
    this.container.querySelectorAll('.delete-reserve-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const tokId = btn.dataset.id;
        const tok = store.getState().tokens.find(t => t.id === tokId);
        if (tok && await confirmAction(`¿Eliminar definitivamente a "${tok.name}" de la campaña?`)) {
          store.deleteToken(tokId);
          network.broadcast?.({ type: 'TOKEN_DELETE', tokenId: tokId });
          network.syncAll?.();
          notify(`🗑️ "${tok.name}" eliminado definitivamente.`);
        }
      };
    });

    if (isKeeper) {
      this.container.querySelector('#import_actors_btn').onclick = openCharacterImport;
      // Toggle visibility
      this.container.querySelectorAll('.toggle-hide-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const tokId = btn.dataset.id;
          const tok = store.getState().tokens.find(t => t.id === tokId);
          if (tok) {
            const newHidden = !tok.hidden;
            store.updateToken(tokId, { hidden: newHidden });
            network.broadcast({ type: 'TOKEN_UPDATE', tokenId: tokId, partial: { hidden: newHidden } });
          }
        };
      });

      // Deploy new token modal
      const addBtn = this.container.querySelector('#add_token_btn');
      if (addBtn) {
        addBtn.onclick = () => this.openDeployModal();
      }
    }
  }

  openDeployModal() {
    const modal = dossierDialog('CREAR ACTOR MANUAL', `
      <p class="dossier-muted">Introduce los valores de tu ficha. Los valores iniciales son editables, no una plantilla de clase o especie. Para una ficha del creador, usa Importar personajes JSON.</p>
      <form id="manual_actor"><div class="dossier-identity">
        <label class="dossier-field"><span>Nombre</span><input class="hud-input" name="name" required value="Nuevo actor"></label>
        <label class="dossier-field"><span>Tipo</span><vf-select name="kind" id="manual_kind" class="hud-select"><option value="player">Personaje</option><option value="npc">PNJ</option><option value="drone">Drone · shared control</option><option value="adversary">Adversario</option></vf-select></label>
        ${[['hp', 'HP máximo', 6, 1], ['stress', 'Stress máximo', 6, 0], ['armor', 'Armor máximo', 0, 0], ['evasion', 'Evasion', 10, 0], ['major', 'Umbral Major', 5, 0], ['severe', 'Umbral Severe', 10, 0]].map(([key, label, value, min]) => `<label class="dossier-field"><span>${label}</span><input name="${key}" class="hud-input" type="number" required min="${min}" max="100" value="${value}"></label>`).join('')}
      </div><p class="dossier-error" role="alert"></p><footer class="dossier-footer"><button class="hud-btn hud-btn-primary">Crear y abrir ficha</button></footer></form>
    `);
    modal.querySelector('form').onsubmit = event => {
      event.preventDefault();
      try {
        const values = Object.fromEntries(new FormData(event.target));
        const kind = modal.querySelector('#manual_kind').value;
        const cv = window.veilCanvas, center = cv?.screenToWorld(cv.displayWidth / 2, cv.displayHeight / 2) || { x: 600, y: 400 };
        const token = store.addToken({ name: values.name.trim(), actorType: kind, isPlayer: kind === 'player', path: kind === 'player' ? 'Awakened' : '', evasion: Number(values.evasion), hp: { current: Number(values.hp), max: Number(values.hp), majorThreshold: Number(values.major), severeThreshold: Number(values.severe) }, armor: { current: Number(values.armor), max: Number(values.armor) }, stress: { current: 0, max: Number(values.stress) }, ...center });
        if (!token) throw new Error('No se pudo crear el actor.');
        store.update({ selectedTokenId: token.id });
        modal.remove();
        window.veilTokenHUD?.openCharacterSheetModal(token);
      } catch (err) { modal.querySelector('.dossier-error').textContent = err.message; }
    };
  }
}

// Fase 3: Modal automático para reclamar personaje al entrar a la sesión
export function openClaimCharacterModal() {
  const state = store.getState();
  const availablePCs = state.tokens.filter(t => t.isPlayer && !isDrone(t) && (!t.ownerId || t.ownerId === 'keeper' || t.ownerId === ''));

  const modal = dossierDialog('RECLAMAR PERSONAJE', `
    <span class="dossier-eyebrow">BIENVENIDO A BORDO / SELECCIÓN DE TRIPULANTE</span>
    <h2>Elige tu personaje para esta misión</h2>
    <p class="dossier-muted">Reclama un operativo disponible de la tripulación o importa tu ficha creada con el Character Creator.</p>

    <section class="claim-crew-section" style="margin-top: 14px;">
      <h3 class="dossier-eyebrow" style="color: #00f3ff; margin-bottom: 8px;">OPCIÓN A: TRIPULACIÓN DISPONIBLE (${availablePCs.length})</h3>
      <div class="claim-crew-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 16px;">
        ${availablePCs.map(tok => `
          <article class="roster-token-card glass-panel claim-card" style="padding: 10px; cursor: pointer; border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 6px; display: flex; flex-direction: column; justify-content: space-between;" data-claim-id="${escapeHTML(tok.id)}">
            <div style="display: flex; gap: 8px; align-items: center;">
              <img src="${tok.avatarUrl || '/assets/tokens/captain_harker.jpg'}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #00f3ff;" alt="" />
              <div>
                <strong style="color: #fff; font-size: 13px; display: block;">${escapeHTML(tok.name)}</strong>
                <small style="color: var(--cyan-pearl); font-size: 11px;">${escapeHTML(tok.path || 'Operativo')}</small>
              </div>
            </div>
            <div style="margin-top: 8px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between;">
              <span>HP: ${tok.hp.current}/${tok.hp.max}</span>
              <span>Armadura: ${tok.armor?.current || 0}</span>
              <span>Evasión: ${tok.evasion ?? '—'}</span>
            </div>
            <button class="hud-btn hud-btn-primary hud-btn-xs" style="width: 100%; margin-top: 8px;" data-claim-btn="${escapeHTML(tok.id)}">
              🎯 Reclamar
            </button>
          </article>
        `).join('') || '<p class="dossier-muted">No hay operativos libres en la escena actual.</p>'}
      </div>
    </section>

    <section class="claim-import-section" style="border-top: 1px solid rgba(0, 243, 255, 0.2); padding-top: 14px;">
      <h3 class="dossier-eyebrow" style="color: #00f3ff; margin-bottom: 6px;">OPCIÓN B: IMPORTAR MI VIAJERO</h3>
      <p class="dossier-muted" style="margin-bottom: 10px;">¿Tienes tu propio archivo de personaje exportado (.json)? Súbelo para saltar directamente a la acción.</p>
      <button class="hud-btn hud-btn-primary" id="btn_claim_import_file">
        📂 Importar mi Viajero (.JSON)
      </button>
    </section>
  `);

  modal.querySelectorAll('[data-claim-btn], [data-claim-id]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const tokenId = btn.dataset.claimBtn || btn.dataset.claimId;
      if (!tokenId) return;
      try {
        if (network.claimToken) {
          await network.claimToken(tokenId);
        } else {
          store.assignTokenControllers(tokenId, [store.memberId || 'player']);
        }
        store.update({ selectedTokenId: tokenId, claimedTokenId: tokenId, activeTool: 'select', activeLayer: 'tokens' });
        let targetToken = store.getState().tokens.find(t => t.id === tokenId);
        if (targetToken && (targetToken.mapId === 'reserve' || targetToken.inReserve)) {
          store.deployTokenFromReserve(targetToken.id);
          targetToken = store.getState().tokens.find(t => t.id === tokenId);
        }
        if (targetToken && window.veilCanvas) {
          const cv = window.veilCanvas;
          cv.panX = cv.displayWidth / 2 - targetToken.x * cv.zoom;
          cv.panY = cv.displayHeight / 2 - targetToken.y * cv.zoom;
        }
        notify(`¡Has reclamado a ${targetToken?.name || 'tu personaje'}!`);
        modal.remove();
      } catch (err) {
        notify(err.message, 'error');
      }
    };
  });

  const importBtn = modal.querySelector('#btn_claim_import_file');
  if (importBtn) {
    importBtn.onclick = () => {
      modal.remove();
      openCharacterImport({
        single: true,
        onImport: async entries => {
          for (const entry of entries) {
            if (network.importCharacter) await network.importCharacter(entry.token);
          }
          notify('¡Personaje importado y asignado!');
          return entries.length;
        }
      });
    };
  }

  return modal;
}
