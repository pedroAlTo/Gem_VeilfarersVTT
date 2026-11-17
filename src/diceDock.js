// The dice as a translucent icon in the top corner of the map (V3). A touch opens the full dice
// menu floating over the map; the side panel no longer has a Dice tab. The dice panel itself is
// the same element as before: it is moved into the floating panel while open and back after.
import { sanitizeHTML } from './ui.js';

const ICON = `<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><path d="M16 2 28 9v14L16 30 4 23V9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 2v8M4 9l12 1 12-1M16 10 9 22h14zM4 23l5-1M28 23l-5-1M16 30v-8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" opacity=".85"/></svg>`;

export class DiceDock {
  constructor(viewport, pane) {
    this.pane = pane; this.home = pane.parentElement; this.marker = document.createComment('dice-pane-home');
    this.home.insertBefore(this.marker, pane);
    this.button = document.createElement('button');
    this.button.type = 'button'; this.button.id = 'dice_dock_btn'; this.button.className = 'dice-dock-btn';
    this.button.title = 'Dados'; this.button.setAttribute('aria-label', 'Abrir los dados'); this.button.setAttribute('aria-expanded', 'false');
    this.button.innerHTML = sanitizeHTML(ICON);
    this.panel = document.createElement('section');
    this.panel.id = 'dice_dock_panel'; this.panel.className = 'dice-dock-panel'; this.panel.hidden = true; this.panel.setAttribute('aria-label', 'Dados');
    this.panel.innerHTML = sanitizeHTML('<header class="dice-dock-head"><strong>Dados</strong><button type="button" class="dice-dock-close" aria-label="Cerrar los dados">×</button></header><div class="dice-dock-body"></div>');
    viewport.append(this.button, this.panel);
    // The map must not pan or zoom under the panel.
    for (const type of ['pointerdown', 'mousedown', 'wheel', 'dblclick', 'contextmenu']) {
      this.panel.addEventListener(type, event => event.stopPropagation());
      this.button.addEventListener(type, event => event.stopPropagation());
    }
    this.button.onclick = () => this.toggle();
    this.panel.querySelector('.dice-dock-close').onclick = () => this.close();
    window.addEventListener('keydown', event => { if (event.key === 'Escape' && this.isOpen && !document.querySelector('.dossier-backdrop, .veil-modal-backdrop')) this.close(); });
    // The Dice tab of the side panel is replaced by the icon.
    const tab = document.querySelector('.tab-nav-btn[data-tab="dice"]');
    if (tab) {
      tab.hidden = true; tab.style.display = 'none';
      if (tab.classList.contains('active')) (document.querySelector('.tab-nav-btn[data-tab="roster"]') || document.querySelector('.tab-nav-btn:not([data-tab="dice"])'))?.click();
    }
  }

  get isOpen() { return !this.panel.hidden; }

  open() {
    if (this.isOpen) return;
    // A player's dice menu only gives dice: Roll and Attack live in the player's action bar.
    if (document.body.classList.contains('player-stance')) this.pane.querySelector('#tab_standard_btn')?.click();
    this.panel.querySelector('.dice-dock-body').append(this.pane);
    this.pane.style.display = 'block';
    this.panel.hidden = false; this.button.classList.add('active'); this.button.setAttribute('aria-expanded', 'true');
  }

  close() {
    if (!this.isOpen) return;
    this.home.insertBefore(this.pane, this.marker.nextSibling);
    this.pane.style.display = 'none';
    this.panel.hidden = true; this.button.classList.remove('active'); this.button.setAttribute('aria-expanded', 'false');
  }

  toggle() { if (this.isOpen) this.close(); else this.open(); }
}
