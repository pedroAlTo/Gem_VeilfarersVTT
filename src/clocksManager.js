import { sanitizeHTML } from './ui.js';
// src/clocksManager.js
// Movable Transparent HUD Progress Clocks with Keeper-Only / Shared Visibility

import { store } from './state.js';
import { network } from './networkManager.js';
import { audio } from './audioEngine.js';

export class ClocksManager {
  constructor(overlayContainer) {
    this.container = overlayContainer;
    this.draggedWidget = null;
    this.expanded = new Set();
    this.dragStart = { x: 0, y: 0 };
    this.widgetStart = { x: 0, y: 0 };

    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('clocks') || keys.includes('userRole')) {
        this.render();
      }
    });

    this.initGlobalEvents();
  }

  initGlobalEvents() {
    const handleMove = (clientX, clientY) => {
      if (this.draggedWidget) {
        const dx = clientX - this.dragStart.x;
        const dy = clientY - this.dragStart.y;
        const newX = Math.max(10, this.widgetStart.x + dx);
        const newY = Math.max(60, this.widgetStart.y + dy);

        this.draggedWidget.style.left = newX + 'px';
        this.draggedWidget.style.top = newY + 'px';
      }
    };

    const handleEnd = () => {
      if (this.draggedWidget) {
        const clockId = this.draggedWidget.dataset.id;
        const x = parseInt(this.draggedWidget.style.left, 10);
        const y = parseInt(this.draggedWidget.style.top, 10);
        store.updateClock(clockId, { posX: x, posY: y });
        this.draggedWidget = null;
      }
    };

    window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', handleEnd);

    window.addEventListener('touchmove', (e) => {
      if (this.draggedWidget && e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
  }

  render() {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';

    // Filter clocks based on role
    const visibleClocks = state.clocks.filter(c => {
      if (isKeeper) return true;
      return !c.isKeeperOnly;
    });

    this.container.innerHTML = sanitizeHTML(visibleClocks.map(clock => this.renderClockWidget(clock, isKeeper)).join(''));
    this.attachWidgetListeners();
  }

  renderClockWidget(clock, isKeeper) {
    const collapsed = !this.expanded.has(clock.id);
    const radius = 36;
    const center = 44;
    const segments = clock.segments;
    const filled = clock.filled;
    const isCompleted = filled >= segments;
    const categoryClass = `clock-${clock.category || 'danger'}`;

    // Generate SVG pie segments
    let svgPaths = '';
    const angleStep = (Math.PI * 2) / segments;

    for (let i = 0; i < segments; i++) {
      const startAngle = i * angleStep - Math.PI / 2;
      const endAngle = (i + 1) * angleStep - Math.PI / 2;

      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);

      const largeArc = angleStep > Math.PI ? 1 : 0;
      const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      const isSegmentFilled = i < filled;
      svgPaths += `
        <path
          d="${pathData}"
          class="clock-svg-slice ${isSegmentFilled ? 'filled' : 'empty'}"
          data-segment-idx="${i}"
        />
      `;
    }

    return `
      <div
        class="clock-widget glass-panel ${categoryClass} ${collapsed ? 'collapsed' : ''} ${isCompleted ? 'completed' : ''}"
        id="widget_${clock.id}"
        data-id="${clock.id}"
        style="left: ${clock.posX || 60}px; top: ${clock.posY || 120}px;"
      >
        <!-- Header / Drag Bar -->
        <div class="clock-drag-handle">
          <div class="clock-title-group">
            <span class="clock-category-pip"></span>
            <span class="clock-title" title="${clock.title}">${clock.title}</span><span class="clock-inline-count" style="--clock-progress:${Math.round(filled/segments*100)}%"><span>${filled}/${segments}</span></span>
          </div>
          <div class="clock-badges">
            ${isKeeper ? `
              <button class="clock-badge-btn ${clock.isKeeperOnly ? 'clock-badge-keeper' : 'clock-badge-shared'} clock-visibility-toggle" title="Click to Toggle GM Private vs Shared with Players">
                ${clock.isKeeperOnly ? 'PRIVATE' : 'SHARED'}
              </button>
            ` : `
              <span class="clock-badge-shared">SHARED</span>
            `}
            <button class="clock-collapse-btn" title="Toggle Compact View">${collapsed ? '▼' : '▲'}</button>
          </div>
        </div>

        <!-- Clock Body -->
        <div class="clock-body ${collapsed ? 'hidden' : ''}">
          <div class="clock-dial-wrapper">
            <svg class="clock-svg-dial" viewBox="0 0 88 88" width="88" height="88">
              <!-- Background Outer Ring -->
              <circle cx="${center}" cy="${center}" r="${radius + 2}" class="clock-dial-outer" />
              <!-- Segments -->
              ${svgPaths}
              <!-- Center Hub -->
              <circle cx="${center}" cy="${center}" r="10" class="clock-dial-hub" />
              <text x="${center}" y="${center + 4}" class="clock-dial-text" text-anchor="middle">${filled}/${segments}</text>
            </svg>
          </div>

          <div class="clock-controls">
            <div class="clock-progress-info">
              <span class="clock-status-tag">${isCompleted ? 'THREAT IMMINENT' : `${segments - filled} REMAINING`}</span>
            </div>
            ${isKeeper ? `
              <div class="clock-button-row">
                <button class="hud-btn hud-btn-xs clock-tick-down" title="Step Back">-1</button>
                <button class="hud-btn hud-btn-xs hud-btn-danger clock-tick-up" title="Advance Clock">+1</button>
                <button class="hud-btn hud-btn-xs hud-btn-secondary clock-reset" title="Reset to Zero">0</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  attachWidgetListeners() {
    const isKeeper = store.getState().userRole === 'keeper';

    this.container.querySelectorAll('.clock-widget').forEach(widget => {
      const clockId = widget.dataset.id;
      const handle = widget.querySelector('.clock-drag-handle');

      // Dragging by handle (Mouse & Touch)
      const onStart = (clientX, clientY, target) => {
        if (!this.expanded.has(widget.dataset.id)) return;
        if (target.classList.contains('clock-collapse-btn') || target.classList.contains('clock-visibility-toggle')) return;
        this.draggedWidget = widget;
        this.dragStart = { x: clientX, y: clientY };
        this.widgetStart = {
          x: parseInt(widget.style.left, 10) || 60,
          y: parseInt(widget.style.top, 10) || 120
        };
      };

      handle.addEventListener('mousedown', (e) => {
        onStart(e.clientX, e.clientY, e.target);
        e.stopPropagation();
      });

      handle.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          onStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
          e.stopPropagation();
        }
      }, { passive: true });

      // Visibility toggle (Keeper only)
      if (isKeeper) {
        const visToggle = widget.querySelector('.clock-visibility-toggle');
        if (visToggle) {
          visToggle.onclick = (e) => {
            e.stopPropagation();
            const clock = store.getState().clocks.find(c => c.id === clockId);
            if (clock) {
              const newPrivate = !clock.isKeeperOnly;
              store.updateClock(clockId, { isKeeperOnly: newPrivate });
              network.broadcast({ type: 'CLOCK_UPDATE', clockId, partial: { isKeeperOnly: newPrivate } });
              audio.playClockTick();
            }
          };
        }
      }

      // Collapse toggle
      const collapseBtn = widget.querySelector('.clock-collapse-btn');
      if (collapseBtn) {
        collapseBtn.onclick = (e) => {
          e.stopPropagation();
          const clock = store.getState().clocks.find(c => c.id === clockId);
          if (clock) {
            if(this.expanded.has(clockId))this.expanded.delete(clockId);else this.expanded.add(clockId);
            this.render();
          }
        };
      }

      // Keeper Quick Buttons
      if (isKeeper) {
        const tickUp = widget.querySelector('.clock-tick-up');
        const tickDown = widget.querySelector('.clock-tick-down');
        const resetBtn = widget.querySelector('.clock-reset');

        if (tickUp) {
          tickUp.onclick = (e) => {
            e.stopPropagation();
            store.advanceClock(clockId, 1);
            network.broadcast({ type: 'CLOCK_UPDATE', clockId, partial: store.getState().clocks.find(c => c.id === clockId) });
            audio.playClockTick();
          };
        }
        if (tickDown) {
          tickDown.onclick = (e) => {
            e.stopPropagation();
            store.advanceClock(clockId, -1);
            network.broadcast({ type: 'CLOCK_UPDATE', clockId, partial: store.getState().clocks.find(c => c.id === clockId) });
            audio.playClockTick();
          };
        }
        if (resetBtn) {
          resetBtn.onclick = (e) => {
            e.stopPropagation();
            store.updateClock(clockId, { filled: 0 });
            network.broadcast({ type: 'CLOCK_UPDATE', clockId, partial: { filled: 0 } });
          };
        }

        // Direct clicking on SVG slice
        widget.querySelectorAll('.clock-svg-slice').forEach(slice => {
          slice.onclick = (e) => {
            e.stopPropagation();
            const segIdx = parseInt(slice.dataset.segmentIdx, 10);
            const clock = store.getState().clocks.find(c => c.id === clockId);
            if (clock) {
              const newFilled = segIdx + 1 === clock.filled ? segIdx : segIdx + 1;
              store.updateClock(clockId, { filled: newFilled });
              network.broadcast({ type: 'CLOCK_UPDATE', clockId, partial: { filled: newFilled } });
              audio.playClockTick();
            }
          };
        });
      }
    });
  }

  openCreateModal() {
    const modal = document.createElement('div');
    modal.className = 'veil-modal-backdrop';
    modal.innerHTML = sanitizeHTML(`
      <div class="veil-modal-box">
        <div class="veil-modal-header">
          <h3>DEPLOY PROGRESS CLOCK // NARRATIVE ENGINE</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="veil-modal-body">
          <div class="form-group">
            <label>Clock Title / Threat Name</label>
            <input type="text" id="new_clock_title" class="hud-input" placeholder="e.g. Life Support Depletion, Patrol Intercept..." value="New Threat Countdown" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Segments</label>
              <vf-select id="new_clock_segments" class="hud-select">
                <option value="4">4 Segments (Fast / Urgent)</option>
                <option value="6" selected>6 Segments (Standard / Tactical)</option>
                <option value="8">8 Segments (Complex / Resilient)</option>
                <option value="10">10 Segments (Epic / Campaign)</option>
                <option value="12">12 Segments (Substrate Resonance)</option>
              </vf-select>
            </div>

            <div class="form-group">
              <label>Category Theme</label>
              <vf-select id="new_clock_category" class="hud-select">
                <option value="danger">Danger // Threat (Crimson)</option>
                <option value="countdown">Countdown // Timer (Amber)</option>
                <option value="project">Project // Breach (Cyan)</option>
                <option value="faction">Faction // Void (Purple)</option>
              </vf-select>
            </div>
          </div>

          <div class="form-group checkbox-group">
            <label class="hud-checkbox-label">
              <input type="checkbox" id="new_clock_private" />
              <span>Keeper-Only (Hidden from players)</span>
            </label>
          </div>

          <div class="modal-actions-row">
            <button class="hud-btn hud-btn-secondary modal-cancel-btn">CANCEL</button>
            <button class="hud-btn hud-btn-primary" id="confirm_clock_create">DEPLOY CLOCK</button>
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(modal);

    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.querySelector('.modal-cancel-btn').onclick = () => modal.remove();

    modal.querySelector('#confirm_clock_create').onclick = () => {
      const title = modal.querySelector('#new_clock_title').value.trim() || 'Tactical Clock';
      const segments = parseInt(modal.querySelector('#new_clock_segments').value, 10);
      const category = modal.querySelector('#new_clock_category').value;
      const isKeeperOnly = modal.querySelector('#new_clock_private').checked;

      const newClock = store.addClock({
        title,
        segments,
        category,
        isKeeperOnly
      });

      if (!isKeeperOnly) {
        network.broadcast({ type: 'CLOCK_UPDATE', clockId: newClock.id, partial: newClock });
      }

      audio.playClockTick();
      modal.remove();
    };
  }
}
