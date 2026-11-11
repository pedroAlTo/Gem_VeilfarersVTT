import { sanitizeHTML } from './ui.js';
// src/fearMeter.js
// Futuristic 12-Cell Global Fear Meter Widget with GSAP High-Impact Animations

import { store } from './state.js';
import { audio } from './audioEngine.js';
import { network } from './networkManager.js';
import { KEEPER_MOVES } from './rulesEngine.js';
import gsap from 'gsap';

export class FearMeterHUD {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('fear') || keys.includes('userRole')) {
        this.updateView();
      }
    });
    this.updatePosition();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.updatePosition());
    }
  }

  updatePosition() {
    if (!this.container) return;
    // Inside canvas-viewport, top: 20px gives exact 20px padding from the top header menu
    this.container.style.top = '20px';
  }

  render() {
    this.container.innerHTML = sanitizeHTML(`
      <div class="fear-meter-wrapper" id="fear_meter_root">
        <div class="fear-label">
          <span class="fear-icon">▲</span>
          <span class="fear-title">GLOBAL FEAR</span>
          <span class="fear-counter" id="fear_counter_val">0 / 12</span>
        </div>
        <div class="fear-header-actions" id="fear_header_actions">
          <!-- Rendered based on user role -->
        </div>
        <button class="hud-btn hud-btn-xs fear-step-btn" id="fear_minus_btn" title="Disminuir Miedo (-1)">−</button>
        <div class="fear-cells-track" id="fear_cells_track" title="Clic para ajustar nivel de Miedo">
          ${Array.from({ length: 12 }, (_, i) => `
            <div class="fear-cell" data-index="${i + 1}">
              <div class="fear-cell-fill"></div>
              <div class="fear-cell-number">${i + 1}</div>
            </div>
          `).join('')}
        </div>
        <button class="hud-btn hud-btn-xs hud-btn-danger fear-step-btn" id="fear_plus_btn" title="Aumentar Miedo (+1)">+</button>
      </div>
    `);

    this.initEvents();
    this.updateView();
  }

  initEvents() {
    // Prevent dragging or clicking map under Fear HUD
    this.container.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.container.addEventListener('mousedown', (e) => e.stopPropagation());
    this.container.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    this.container.addEventListener('dblclick', (e) => e.stopPropagation());

    const track = this.container.querySelector('#fear_cells_track');
    if (track) {
      // Keeper can click segments to directly set Fear
      track.addEventListener('click', (e) => {
        const state = store.getState();
        if (state.userRole !== 'keeper') return;

        const cell = e.target.closest('.fear-cell');
        if (cell) {
          const targetVal = parseInt(cell.dataset.index, 10);
          const newVal = state.fear === targetVal ? targetVal - 1 : targetVal;
          store.setFear(newVal);
          network.broadcast({ type: 'FEAR_UPDATE', fear: newVal });
          audio.playFearAlert();
        }
      });
    }

    const minusBtn = this.container.querySelector('#fear_minus_btn');
    if (minusBtn) {
      minusBtn.onclick = () => {
        if (store.getState().userRole !== 'keeper') return;
        store.addFear(-1);
        network.broadcast({ type: 'FEAR_UPDATE', fear: store.getState().fear });
      };
    }

    const plusBtn = this.container.querySelector('#fear_plus_btn');
    if (plusBtn) {
      plusBtn.onclick = () => {
        if (store.getState().userRole !== 'keeper') return;
        store.addFear(1);
        network.broadcast({ type: 'FEAR_UPDATE', fear: store.getState().fear });
        audio.playFearAlert();
      };
    }
  }

  updateView() {
    const state = store.getState();
    const fearVal = state.fear;
    const isKeeper = state.userRole === 'keeper';

    // Update Counter Text
    const counterEl = this.container.querySelector('#fear_counter_val');
    if (counterEl) {
      counterEl.textContent = `${fearVal} / 12`;
      counterEl.className = 'fear-counter ' + this.getFearDangerClass(fearVal);
    }

    // Update - / + buttons state based on role
    const minusBtn = this.container.querySelector('#fear_minus_btn');
    const plusBtn = this.container.querySelector('#fear_plus_btn');
    if (minusBtn && plusBtn) {
      minusBtn.style.display = isKeeper ? 'inline-grid' : 'none';
      plusBtn.style.display = isKeeper ? 'inline-grid' : 'none';
    }

    // Update Segments
    const cells = this.container.querySelectorAll('.fear-cell');
    cells.forEach((cell, idx) => {
      const cellNum = idx + 1;
      const isFilled = cellNum <= fearVal;
      const wasActive = cell.classList.contains('active');
      cell.classList.toggle('active', isFilled);
      cell.classList.toggle('danger', fearVal >= 8 && isFilled);
      cell.classList.toggle('critical', fearVal === 12 && isFilled);

      if (isFilled && !wasActive) {
        try {
          gsap.fromTo(cell, { scale: 1.35, filter: 'brightness(2.2)' }, { scale: 1, filter: 'brightness(1)', duration: 0.35, ease: 'back.out(2)' });
        } catch { /* headless/JSDOM animation fallback */ }
      }
    });

    if (counterEl && fearVal >= 10) {
      try {
        gsap.to(counterEl, { scale: 1.2, repeat: 1, yoyo: true, duration: 0.2, ease: 'power2.out' });
      } catch { /* headless/JSDOM animation fallback */ }
    }

    // Update Keeper Header Actions
    const controlsEl = this.container.querySelector('#fear_header_actions') || this.container.querySelector('#fear_controls');
    if (controlsEl) {
      if (isKeeper) {
        controlsEl.innerHTML = sanitizeHTML(`
          <button class="hud-btn hud-btn-xs hud-btn-amber" id="fear_spend_menu_btn" title="Gastar Miedo en Movimientos del Keeper">SPEND FEAR</button>
          <button class="hud-btn hud-btn-xs" id="fear_session_reset_btn" title="Reinicio de Sesión (Tirar 1d4+2)">RESET</button>
        `);

        controlsEl.querySelector('#fear_spend_menu_btn').onclick = () => {
          this.openSpendModal();
        };
        controlsEl.querySelector('#fear_session_reset_btn').onclick = () => {
          store.resetFearSession();
          network.broadcast({ type: 'FEAR_UPDATE', fear: store.getState().fear });
          audio.playFearAlert();
        };
      } else {
        controlsEl.innerHTML = sanitizeHTML(`<span class="hud-role-badge">OBSERVER</span>`);
      }
    }
  }

  getFearDangerClass(val) {
    if (val >= 12) return 'fear-level-max';
    if (val >= 8) return 'fear-level-high';
    if (val >= 4) return 'fear-level-med';
    return 'fear-level-low';
  }

  openSpendModal() {
    const state = store.getState();
    const modal = document.createElement('div');
    modal.className = 'veil-modal-backdrop';
    modal.innerHTML = sanitizeHTML(`
      <div class="veil-modal-box">
        <div class="veil-modal-header">
          <h3>KEEPER'S VOID SPEND // FEAR POOL (${state.fear}/12)</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="veil-modal-body">
          <p class="modal-intro">Select an authorized Keeper Move from Chapter 2 & 4 of the Keeper's Companion:</p>
          <div class="keeper-moves-list">
            ${KEEPER_MOVES.map(m => `
              <div class="keeper-move-card ${state.fear < m.cost ? 'disabled' : ''}">
                <div class="move-info">
                  <div class="move-title-row">
                    <span class="move-name">${m.name}</span>
                    <span class="move-cost">${m.cost} FEAR</span>
                  </div>
                  <div class="move-desc">${m.desc}</div>
                </div>
                <button class="hud-btn hud-btn-sm hud-btn-danger spend-action-btn" data-cost="${m.cost}" data-name="${m.name}" ${state.fear < m.cost ? 'disabled' : ''}>
                  EXECUTE
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(modal);

    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    modal.querySelectorAll('.spend-action-btn').forEach(btn => {
      btn.onclick = () => {
        const cost = parseInt(btn.dataset.cost, 10);
        const name = btn.dataset.name;
        if (store.spendFear(cost, name)) {
          network.broadcast({ type: 'FEAR_UPDATE', fear: store.getState().fear });
          audio.playFearAlert();
          modal.remove();
        }
      };
    });
  }
}
