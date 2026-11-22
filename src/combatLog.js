import { sanitizeHTML, escapeHTML as e } from './ui.js';
// src/combatLog.js
// Real-time Tactical Action and Roll Log for VeilVTT

import { beginCardSession, beginUnassignedArc, currentArc, hasUnassignedArcUses } from './cardLimits.js';
import { dossierDialog } from './dossierDialog.js';
import { openResolution, resolutionLabel } from './cardResolutionUI.js';
import { store } from './state.js';

export class CombatLogView {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.some(key => ['logs', 'userRole', 'activeMapId', 'arcs', 'rest'].includes(key))) {
        this.render();
      }
    });
  }

  render() {
    const isKeeper = store.sessionRole !== 'player' && store.state.userRole === 'keeper';
    const logs = (store.getState().logs || []).filter(entry => isKeeper || entry.visibility !== 'keeper');

    this.container.innerHTML = sanitizeHTML(`
      <div class="combat-log-content">
        <div class="sidebar-header-row">
          <span class="sidebar-title">TACTICAL CHRONICLE (${logs.length})</span>
          ${isKeeper && store.state.tokens.some(t => Object.values(t.cardUses || {}).includes('session')) ? '<button class="hud-btn hud-btn-xs" data-game-session>Nueva sesión de juego</button>' : ''}
          ${isKeeper && !store.state.rest && !currentArc(store.state) && store.state.tokens.some(hasUnassignedArcUses) ? '<button class="hud-btn hud-btn-xs" data-new-arc>Nuevo arco narrativo</button>' : ''}
          <button class="hud-btn hud-btn-xs hud-btn-secondary" id="clear_log_btn">CLEAR</button>
        </div>

        <div class="log-entries-list">
          ${logs.length === 0 ? `
            <div class="log-empty-state">No events recorded. Roll dice or trigger moves to populate telemetry.</div>
          ` : logs.map(entry => {
            const badgeClass = this.getBadgeClass(entry.resultType || entry.type);
            return `
              <div class="log-card glass-panel ${badgeClass}">
                <div class="log-card-header">
                  <span class="log-sender">${e(entry.sender || 'System')} ${entry.visibility === 'keeper' ? '<b class="keeper-log-label">SOLO KEEPER</b>' : ''}</span>
                  <span class="log-time">${e(entry.timestamp)}</span>
                </div>
                <div class="log-title">${e(entry.title)}</div>
                ${entry.resolution ? `<button type="button" class="hud-btn hud-btn-xs" data-resolution="${e(entry.resolution.id)}">${e(resolutionLabel(entry.resolution))} · ${e(entry.resolution.name)}</button>` : ''}
                ${entry.details ? `<div class="log-details">${e(entry.details)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `);

    for (const btn of this.container.querySelectorAll('[data-resolution]')) btn.onclick = () => openResolution(btn.dataset.resolution);
    const session = this.container.querySelector('[data-game-session]');
    if (session) session.onclick = () => {
      const modal = dossierDialog('Nueva sesión de juego','<p>Se renovarán los poderes de un uso por sesión para todos los personajes de esta sala.</p><button class="hud-btn" data-renew>Renovar usos de sesión</button>');
      modal.querySelector('[data-renew]').onclick = () => { beginCardSession(store); modal.remove(); };
    };
    const arc = this.container.querySelector('[data-new-arc]');
    if (arc) arc.onclick = () => {
      const modal = dossierDialog('Nuevo arco narrativo', '<p>Todos los personajes recuperarán sus poderes por arco gastados en escenas sin arco asignado.</p><button class="hud-btn" data-renew>Iniciar arco y renovar usos</button><p class="dossier-error" role="alert"></p>');
      modal.querySelector('[data-renew]').onclick = () => {
        try { beginUnassignedArc(store); modal.remove(); }
        catch (error) { modal.querySelector('[role=alert]').textContent = error.message; }
      };
    };
    const clearBtn = this.container.querySelector('#clear_log_btn');
    if (clearBtn) {
      clearBtn.disabled = !isKeeper;
      clearBtn.onclick = () => {
        store.update({ logs: store.state.logs.filter(row => row.resolution?.phase === 'roll' || row.resolution?.replies?.some(r => !r.outcome)) });
      };
    }
  }

  getBadgeClass(type) {
    if (!type) return '';
    const t = type.toLowerCase();
    if (t.includes('critical')) return 'log-critical';
    if (t.includes('success_with_hope')) return 'log-success-hope';
    if (t.includes('success_with_fear')) return 'log-success-fear';
    if (t.includes('failure_with_hope')) return 'log-failure-hope';
    if (t.includes('failure_with_fear')) return 'log-failure-fear';
    if (t.includes('keeper_move') || t.includes('threat')) return 'log-keeper';
    if (t.includes('damage')) return 'log-damage';
    return '';
  }
}
