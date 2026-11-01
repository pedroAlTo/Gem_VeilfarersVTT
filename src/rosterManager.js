import { sanitizeHTML } from './ui.js';
// src/rosterManager.js
// Operative Roster and NPC/Adversary Manager

import { store } from './state.js';
import { network } from './networkManager.js';

export class RosterManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('tokens') || keys.includes('selectedTokenId') || keys.includes('userRole')) {
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
            <button class="hud-btn hud-btn-xs hud-btn-primary" id="add_token_btn">+ DEPLOY TOKEN</button>
          ` : ''}
        </div>

        <div class="roster-tokens-list">
          ${tokens.map(tok => {
            const isSelected = tok.id === state.selectedTokenId;
            return `
              <div class="roster-token-card glass-panel ${isSelected ? 'selected' : ''}" data-id="${tok.id}">
                <img src="${tok.avatarUrl || '/assets/tokens/captain_harker.jpg'}" class="roster-token-avatar" />
                <div class="roster-token-info">
                  <div class="roster-name-row">
                    <span class="roster-name">${tok.name}</span>
                    <span class="roster-badge ${tok.isPlayer ? 'badge-pc' : 'badge-npc'}">
                      ${tok.isPlayer ? 'PC' : 'THREAT'}
                    </span>
                  </div>
                  <div class="roster-stats-row">
                    <span>HP: ${tok.hp.current}/${tok.hp.max}</span>
                    <span>ARMOR: ${tok.armor?.current || 0}</span>
                    <span>${tok.path}</span>
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
    const modal = document.createElement('div');
    modal.className = 'veil-modal-backdrop';
    modal.innerHTML = sanitizeHTML(`
      <div class="veil-modal-box">
        <div class="veil-modal-header">
          <h3>DEPLOY OPERATIVE OR THREAT TO MAP</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="veil-modal-body">
          <div class="form-group">
            <label>Template Archetype</label>
            <vf-select id="deploy_archetype" class="hud-select">
              <option value="scout">Awakened Scout / Infiltrator (HP 14, High Agility)</option>
              <option value="soldier">Awakened Marine / Vanguard (HP 18, Armor 4)</option>
              <option value="synthetic">Sleeping Heavy Synthetic (HP 24, Armor 5, Max Stress 7)</option>
              <option value="drone">Autonomous Defense Drone (HP 8, Armor 2, Flying)</option>
              <option value="void_beast">Void Horror Adversary (HP 32, Armor 4, Stealth)</option>
            </vf-select>
          </div>

          <div class="form-group">
            <label>Designation / Name</label>
            <input type="text" id="deploy_name" class="hud-input" value="Operative Vanguard" />
          </div>

          <div class="modal-actions-row">
            <button class="hud-btn hud-btn-secondary modal-cancel-btn">CANCEL</button>
            <button class="hud-btn hud-btn-primary" id="confirm_deploy_btn">DEPLOY TO CENTER</button>
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(modal);

    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.querySelector('.modal-cancel-btn').onclick = () => modal.remove();

    modal.querySelector('#confirm_deploy_btn').onclick = () => {
      const arch = modal.querySelector('#deploy_archetype').value;
      const name = modal.querySelector('#deploy_name').value.trim() || 'Operative';

      let tokenData = {
        name,
        isPlayer: arch !== 'void_beast',
        avatarUrl: arch === 'synthetic' ? '/assets/tokens/engineer_he09.jpg' : (arch === 'void_beast' ? '/assets/tokens/void_stalker.jpg' : '/assets/tokens/captain_harker.jpg'),
        hidden: arch === 'void_beast'
      };

      if (arch === 'void_beast') {
        tokenData.actorType = 'adversary';
        tokenData.hideName = true;
        tokenData.roleTag = 'Apex Threat // Void Spawn';
        tokenData.hp = { current: 32, max: 32, majorThreshold: 10, severeThreshold: 20 };
        tokenData.armor = { current: 4, max: 4 };
        tokenData.size = 2;
      } else if (arch === 'synthetic') {
        tokenData.roleTag = 'Heavy Support // Synthetic';
        tokenData.path = 'Sleeping';
        tokenData.hp = { current: 24, max: 24, majorThreshold: 8, severeThreshold: 16 };
        tokenData.armor = { current: 5, max: 5 };
        tokenData.stress = { current: 0, max: 7 };
      }

      const cv = window.veilCanvas;
      if (cv) {
        const centerWorld = cv.screenToWorld(cv.displayWidth / 2, cv.displayHeight / 2);
        tokenData.x = Math.round(centerWorld.x);
        tokenData.y = Math.round(centerWorld.y);
      }

      const newToken = store.addToken(tokenData);
      network.broadcast({ type: 'TOKEN_CREATE', token: newToken });
      modal.remove();
    };
  }
}
