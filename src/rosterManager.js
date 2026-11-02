import { openCharacterImport } from './characterManager.js';
import { dossierDialog } from './dossierUI.js';
import { sanitizeHTML, escapeHTML, notify } from './ui.js';
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
    const isKeeper = state.userRole === 'keeper';

    this.container.innerHTML = sanitizeHTML(`
      <div class="roster-sidebar-content">
        <div class="sidebar-header-row">
          <span class="sidebar-title">TACTICAL ROSTER (${tokens.length})</span>
          ${isKeeper ? `
            <button class="hud-btn hud-btn-xs" id="add_token_btn">+ ACTOR</button>
          ` : ''}
        </div>

        ${isKeeper ? '<div class="roster-import-actions"><button class="hud-btn hud-btn-primary" id="import_actors_btn">IMPORTAR PERSONAJES JSON</button></div>' : ''}
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
                      ${tok.isPlayer ? 'PC' : 'THREAT'}
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
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `);

    this.initEvents();
  }

  initEvents() {
    const isKeeper = store.getState().userRole === 'keeper';

    // Select & focus token
    this.container.querySelectorAll('.roster-token-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.focus-token-btn') || e.target.closest('.toggle-hide-btn')) return;
        const tokId = card.dataset.id;
        store.update({ selectedTokenId: tokId });
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
        <label class="dossier-field"><span>Tipo</span><vf-select name="kind" id="manual_kind" class="hud-select"><option value="player">Personaje</option><option value="npc">PNJ</option><option value="adversary">Adversario</option></vf-select></label>
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
