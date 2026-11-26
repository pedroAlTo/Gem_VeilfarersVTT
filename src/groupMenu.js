// GroupMenu (V3): the user's rule for every group of controls, 3 + 5 + the rest.
// The first three available items stay in view; the next five go into a «⋯» menu; everything
// else goes into «Más…» inside that menu. The original buttons are never moved: they are hidden
// and the menu presses them, so every handler the app already has keeps working, wherever it
// looks for them. It applies only while `when()` is true (for now, the player's view).
import { zoomOf } from './uiScale.js';
import { sanitizeHTML, escapeHTML as e } from './ui.js';

export const VISIBLE = 3, SECOND = 5;

// Splits the available items into the three levels of the rule.
export function splitGroup(items, { visible = VISIBLE, second = SECOND } = {}) {
  return { shown: items.slice(0, visible), menu: items.slice(visible, visible + second), more: items.slice(visible + second) };
}

const available = el => !!el && el.isConnected && !el.hidden && el.style.display !== 'none' && !el.closest('[hidden]');
const labelOf = (item, el) => item.label || el.getAttribute('aria-label') || el.title || el.innerText.trim().replace(/\s+/g, ' ');

let openMenu = null;
function closeOpenMenu() { openMenu?.close(); }
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && openMenu) { event.stopPropagation(); closeOpenMenu(); } }, true);
  window.addEventListener('pointerdown', event => { if (openMenu && !openMenu.box.contains(event.target) && !openMenu.owner.trigger.contains(event.target)) closeOpenMenu(); }, true);
  window.addEventListener('resize', closeOpenMenu);
}

export class GroupMenu {
  // items: [{ sel, label?, hideOnly? }] in order of priority. hideOnly: hidden in the player's
  // view but not offered in the menu (its action is reached through another item).
  constructor({ root, items, when, name, anchor = null, placement = 'below' }) {
    this.root = typeof root === 'string' ? document.querySelector(root) : root;
    this.items = items; this.when = when; this.name = name; this.anchorSel = anchor; this.placement = placement;
    if (!this.root) return;
    this.trigger = document.createElement('button');
    this.trigger.type = 'button'; this.trigger.className = 'gm-trigger'; this.trigger.textContent = '⋯';
    this.trigger.setAttribute('aria-haspopup', 'menu'); this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.title = `Más opciones · ${name}`; this.trigger.setAttribute('aria-label', `Más opciones de ${name}`);
    this.trigger.onclick = event => { event.stopPropagation(); this.toggle(); };
    for (const type of ['pointerdown', 'mousedown']) this.trigger.addEventListener(type, event => event.stopPropagation());
    this.refresh = this.refresh.bind(this);
    // The app redraws some of these groups (the character bar) on every change: apply again.
    this.observer = new MutationObserver(() => { if (!this.applying) this.refresh(); });
    this.observer.observe(this.root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'disabled'] });
    this.refresh();
  }

  elements() {
    return this.items.map(item => ({ item, el: this.root.querySelector(item.sel) || document.querySelector(item.sel) })).filter(x => x.el);
  }

  refresh() {
    if (!this.root) return;
    this.applying = true;
    try {
      const on = !!this.when?.();
      const all = this.elements();
      for (const { el } of all) el.classList.remove('gm-collapsed');
      if (!on) { this.trigger.remove(); if (openMenu?.owner === this) closeOpenMenu(); return; }
      const live = all.filter(x => available(x.el));
      const offered = live.filter(x => !x.item.hideOnly);
      const { shown, menu, more } = splitGroup(offered);
      // Also what the app means to hide (some buttons carry `hidden` but a stylesheet shows them).
      for (const x of [...menu, ...more, ...live.filter(y => y.item.hideOnly), ...all.filter(y => !live.includes(y))]) x.el.classList.add('gm-collapsed');
      this.levels = { menu, more };
      const anchor = this.anchorSel ? this.root.querySelector(this.anchorSel) || this.root : null;
      const hasMenu = menu.length || more.length;
      if (!hasMenu) { this.trigger.remove(); return; }
      if (anchor) { if (this.trigger.parentElement !== anchor || anchor.lastElementChild !== this.trigger) anchor.append(this.trigger); }
      else {
        const last = shown[shown.length - 1]?.el;
        if (last && last.nextElementSibling !== this.trigger) last.after(this.trigger);
      }
      if (openMenu?.owner === this) openMenu.paint();
    } finally {
      this.observer.takeRecords(); this.applying = false;
    }
  }

  toggle() { if (openMenu?.owner === this) closeOpenMenu(); else this.open(); }

  open() {
    closeOpenMenu();
    const box = document.createElement('div');
    box.className = 'gm-popover'; box.setAttribute('role', 'menu'); box.setAttribute('aria-label', this.name);
    for (const type of ['pointerdown', 'mousedown', 'wheel']) box.addEventListener(type, event => event.stopPropagation());
    document.body.append(box);
    let moreOpen = false;
    const paint = () => {
      const { menu = [], more = [] } = this.levels || {};
      const row = ({ item, el }, i, level) => `<button type="button" role="menuitem" class="gm-item ${el.classList.contains('active') ? 'active' : ''}" data-gm="${level}:${i}" ${el.disabled || el.classList.contains('disabled') ? 'disabled' : ''}>${e(labelOf(item, el))}</button>`;
      box.innerHTML = sanitizeHTML(`${menu.map((x, i) => row(x, i, 'menu')).join('')}
        ${more.length ? `<button type="button" class="gm-item gm-more" aria-expanded="${moreOpen}" data-gm-more>${moreOpen ? 'Menos' : 'Más…'}</button>${moreOpen ? `<div class="gm-level2">${more.map((x, i) => row(x, i, 'more')).join('')}</div>` : ''}` : ''}`);
      box.querySelectorAll('[data-gm]').forEach(button => {
        button.onclick = () => {
          const [level, i] = button.dataset.gm.split(':');
          const target = this.levels?.[level]?.[Number(i)]?.el;
          closeOpenMenu();
          if (!target) return;
          // A select opens its own list; anything else is pressed.
          const inner = target.matches('vf-select') ? target.querySelector('button') : null;
          (inner || target).click();
        };
      });
      const moreBtn = box.querySelector('[data-gm-more]');
      if (moreBtn) moreBtn.onclick = () => { moreOpen = !moreOpen; paint(); place(); box.querySelector('.gm-level2 .gm-item')?.focus(); };
    };
    const place = () => {
      // Measured as drawn (Ajustes → Tamaño may zoom the menu).
      const r = this.trigger.getBoundingClientRect(), drawn = box.getBoundingClientRect(), w = drawn.width, h = drawn.height;
      let left = this.placement === 'right' ? r.right + 6 : r.right - w, top = this.placement === 'right' ? r.top : r.bottom + 6;
      if (this.placement === 'above') top = r.top - h - 6;
      left = Math.max(8, Math.min(left, innerWidth - w - 8)); top = Math.max(8, Math.min(top, innerHeight - h - 8));
      const z = zoomOf(box); box.style.left = `${Math.round(left / z)}px`; box.style.top = `${Math.round(top / z)}px`;
    };
    paint(); place();
    this.trigger.classList.add('active'); this.trigger.setAttribute('aria-expanded', 'true');
    openMenu = { owner: this, box, paint, close: () => { box.remove(); this.trigger.classList.remove('active'); this.trigger.setAttribute('aria-expanded', 'false'); openMenu = null; } };
    box.querySelector('.gm-item:not([disabled])')?.focus();
  }
}
