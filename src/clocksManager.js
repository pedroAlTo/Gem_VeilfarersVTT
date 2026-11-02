import { sanitizeHTML, escapeHTML } from './ui.js';
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

    this.localPositions = new Map();
    this.pendingRender = false;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('clocks') || keys.includes('userRole')) {
        if (this.draggedWidget) this.pendingRender = true;
        else this.render();
      }
    });

    this.initGlobalEvents();
  }

  // Positions are relative to the map viewport, independent of collapsed state.
  constrain(widget, x, y) {
    const bounds = this.container.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(x, Math.max(0, bounds.width - widget.offsetWidth))),
      y: Math.max(0, Math.min(y, Math.max(0, bounds.height - widget.offsetHeight)))
    };
  }

  placeWidget(widget, x, y) {
    const p = this.constrain(widget, x, y);
    widget.style.left = `${p.x}px`;
    widget.style.top = `${p.y}px`;
    return p;
  }

  savePosition(clockId, position) {
    // Player arrangements are local; moving a display must never change clock progress.
    if (store.sessionRole === 'player') this.localPositions.set(clockId, position);
    else store.updateClock(clockId, { posX: position.x, posY: position.y });
  }

  initGlobalEvents() {
    this.onPointerMove = (event) => {
      if (!this.draggedWidget || event.pointerId !== this.activePointer) return;
      event.preventDefault();
      this.placeWidget(this.draggedWidget,
        this.widgetStart.x + event.clientX - this.dragStart.x,
        this.widgetStart.y + event.clientY - this.dragStart.y);
    };
    this.endDrag = (event, cancel = false) => {
      const widget = this.draggedWidget;
      if (!widget || (event.pointerId !== undefined && event.pointerId !== this.activePointer)) return;
      const position = cancel ? this.widgetStart : {
        x: parseFloat(widget.style.left), y: parseFloat(widget.style.top)
      };
      this.draggedWidget = null;
      widget.classList.remove('dragging');
      const handle = widget.querySelector('.clock-drag-handle');
      if (handle.hasPointerCapture?.(this.activePointer)) handle.releasePointerCapture(this.activePointer);
      if (!cancel && (position.x !== this.widgetStart.x || position.y !== this.widgetStart.y)) {
        this.savePosition(widget.dataset.id, position);
      }
      this.pendingRender = false;
      this.render();
    };
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', event => this.endDrag(event));
    window.addEventListener('pointercancel', event => this.endDrag(event, true));
    window.addEventListener('blur', () => this.endDrag({}, true));
    this.onResize = () => {
      if (this.draggedWidget) this.endDrag({}, true);
      this.container.querySelectorAll('.clock-widget').forEach(widget => {
        this.placeWidget(widget, parseFloat(widget.style.left), parseFloat(widget.style.top));
      });
    };
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.container);
    }
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
    this.container.querySelectorAll('.clock-widget').forEach(widget => {
      this.placeWidget(widget, parseFloat(widget.style.left), parseFloat(widget.style.top));
    });
  }

  renderClockWidget(clock, isKeeper) {
    const collapsed = !this.expanded.has(clock.id);
    const safeTitle = escapeHTML(clock.title);
    const position = this.localPositions.get(clock.id) || { x: clock.posX ?? 60, y: clock.posY ?? 120 };
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

      const largeArc = angleStep > Math.PI ? 1 : 0;
      const inner = 24;
      const gap = 0.045;
      const a = startAngle + gap, b = endAngle - gap;
      const point = (r, angle) => `${center + r * Math.cos(angle)} ${center + r * Math.sin(angle)}`;
      const pathData = `M ${point(radius,a)} A ${radius} ${radius} 0 ${largeArc} 1 ${point(radius,b)} L ${point(inner,b)} A ${inner} ${inner} 0 ${largeArc} 0 ${point(inner,a)} Z`;

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
        style="left: ${position.x}px; top: ${position.y}px;"
      >
        <!-- Header / Drag Bar -->
        <div class="clock-drag-handle" tabindex="0" aria-label="Move clock: ${safeTitle}. Drag or use arrow keys." title="Drag to move · Arrow keys: 10 px · Shift: 1 px">
          <div class="clock-title-group">
            <span class="clock-category-pip"></span>
            <span class="clock-title" title="${safeTitle}">${safeTitle}</span><span class="clock-inline-count" style="--clock-progress:${Math.round(filled/segments*100)}%"><span><b>${filled}<small>/${segments}</small></b><em>PROGRESS</em></span></span>
          </div>
          <div class="clock-badges">
            ${isKeeper ? `
              <button class="clock-badge-btn ${clock.isKeeperOnly ? 'clock-badge-keeper' : 'clock-badge-shared'} clock-visibility-toggle" title="Click to Toggle GM Private vs Shared with Players">
                ${clock.isKeeperOnly ? 'PRIVATE' : 'SHARED'}
              </button>
            ` : `
              <span class="clock-badge-shared">SHARED</span>
            `}
            <button class="clock-collapse-btn" aria-expanded="${!collapsed}" title="${collapsed ? 'Expand clock' : 'Collapse clock'}">${collapsed ? '▼' : '▲'}</button>
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

      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.target.closest('button')) return;
        event.preventDefault();
        event.stopPropagation();
        this.draggedWidget = widget;
        this.activePointer = event.pointerId;
        this.dragStart = { x: event.clientX, y: event.clientY };
        this.widgetStart = { x: parseFloat(widget.style.left) || 0, y: parseFloat(widget.style.top) || 0 };
        widget.classList.add('dragging');
        handle.setPointerCapture?.(event.pointerId);
      });
      handle.addEventListener('keydown', (event) => {
        if (event.target !== handle) return;
        const directions = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] };
        if (!directions[event.key]) return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? 1 : 10, [dx,dy] = directions[event.key];
        const p = this.placeWidget(widget, parseFloat(widget.style.left) + dx * step, parseFloat(widget.style.top) + dy * step);
        this.savePosition(clockId, p);
        [...this.container.querySelectorAll('.clock-widget')].find(el => el.dataset.id === clockId)?.querySelector('.clock-drag-handle')?.focus();
      });

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

  arrangeClocks() {
    this.expanded.clear();
    const visible = store.state.clocks.filter(c => store.state.userRole === 'keeper' || !c.isKeeperOnly);
    const { width, height } = this.container.getBoundingClientRect();
    this.render();
    const cardWidth = this.container.querySelector('.clock-widget')?.offsetWidth || 218;
    const columns = Math.max(1, Math.floor((width - 24) / (cardWidth + 10)));
    const positions = new Map(visible.map((clock,index) => [clock.id, {
      x: Math.max(0, Math.min(12 + (index % columns) * (cardWidth + 10), width-cardWidth)),
      y: Math.max(0, Math.min(82 + Math.floor(index / columns) * 106, height-100))
    }]));
    if (store.sessionRole === 'player') this.localPositions = positions;
    else store.update({clocks: store.state.clocks.map(c => positions.has(c.id)
      ? {...c,posX:positions.get(c.id).x,posY:positions.get(c.id).y} : c)});
    this.render();
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
