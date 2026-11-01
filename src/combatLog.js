// src/combatLog.js
// Real-time Tactical Action and Roll Log for VeilVTT

import { store } from './state.js';

export class CombatLogView {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('logs')) {
        this.render();
      }
    });
  }

  render() {
    const logs = store.getState().logs || [];

    this.container.innerHTML = `
      <div class="combat-log-content">
        <div class="sidebar-header-row">
          <span class="sidebar-title">TACTICAL CHRONICLE (${logs.length})</span>
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
                  <span class="log-sender">${entry.sender || 'System'}</span>
                  <span class="log-time">${entry.timestamp}</span>
                </div>
                <div class="log-title">${entry.title}</div>
                ${entry.details ? `<div class="log-details">${entry.details}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const clearBtn = this.container.querySelector('#clear_log_btn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        store.update({ logs: [] });
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
