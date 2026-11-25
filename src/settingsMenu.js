// Ajustes (v2.29.0, user decision 21 Nov 2026): one button in the header opens Sesiones, Sonido,
// Ayuda, the language, the font set (B / E) and how the right panel behaves. The original header
// buttons stay in the page, hidden: the menu presses them, so their handlers keep working.
// The right panel can be pinned (always shown) or tucked away: then it slides in, quickly and
// smoothly, while the pointer is at the right edge or over it.
import './settingsMenu.css';
import { UI_SCALES, uiScale, applyUiScale, zoomOf } from './uiScale.js';
import { FONT_SETS, applyFontSet, currentFontSet } from './fontSets.js';
import { audio } from './audioEngine.js';
import { escapeHTML as e } from './ui.js';

const PANEL_KEY = 'veil.sidebar';
const readPanel = () => { try { return localStorage.getItem(PANEL_KEY) === 'auto' ? 'auto' : 'pinned'; } catch { return 'pinned'; } };
let panelMode = readPanel();
export const sidebarMode = () => panelMode;

function setPanelMode(mode) {
  panelMode = mode === 'auto' ? 'auto' : 'pinned';
  try { localStorage.setItem(PANEL_KEY, panelMode); } catch {}
  document.body.classList.toggle('sb-auto', panelMode === 'auto');
  document.getElementById('main_right_sidebar')?.classList.remove('sb-open');
  document.querySelectorAll('[data-panel-pin]').forEach(b => { b.setAttribute('aria-pressed', String(panelMode === 'pinned')); b.title = panelMode === 'pinned' ? 'Panel fijo · pulsa para que se oculte solo' : 'El panel se oculta · pulsa para dejarlo fijo'; });
  window.dispatchEvent(new CustomEvent('veil:sidebar-mode', { detail: { mode: panelMode } }));
  window.dispatchEvent(new Event('resize'));
}

// The tucked-away panel: shown while the pointer is on the right edge or over the panel (or a
// field in it has the focus); hidden again a moment after it leaves.
function mountSidebarAuto() {
  const panel = document.getElementById('main_right_sidebar');
  if (!panel || document.querySelector('.sidebar-hover-edge')) return;
  const edge = document.createElement('div');
  edge.className = 'sidebar-hover-edge'; edge.setAttribute('aria-hidden', 'true');
  document.body.append(edge);
  let timer = null;
  const open = () => { clearTimeout(timer); if (panelMode === 'auto') panel.classList.add('sb-open'); };
  const close = () => { clearTimeout(timer); timer = setTimeout(() => { if (!panel.matches(':hover') && !panel.contains(document.activeElement)) panel.classList.remove('sb-open'); }, 280); };
  edge.addEventListener('pointerenter', open);
  panel.addEventListener('pointerenter', open);
  panel.addEventListener('pointerleave', close);
  panel.addEventListener('focusin', open);
  panel.addEventListener('focusout', close);
  // A pin in the panel's own heading.
  const heading = panel.querySelector('.orbital-panel-heading > div') || panel.querySelector('.sidebar-tab-nav');
  if (heading && !heading.querySelector('[data-panel-pin]')) {
    const pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'panel-pin'; pin.dataset.panelPin = ''; pin.setAttribute('aria-label', 'Fijar u ocultar el panel lateral');
    pin.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.5 2.5l7 7-2.1.7-3.3 3.3.4 4.6-1.6 1.6-4.2-4.2-5.2 5.2-1.4-1.4 5.2-5.2-4.2-4.2 1.6-1.6 4.6.4 3.3-3.3z"/></svg>';
    pin.onclick = () => setPanelMode(panelMode === 'pinned' ? 'auto' : 'pinned');
    heading.append(pin);
  }
}

export function mountSettingsMenu() {
  const right = document.querySelector('.header-right');
  if (!right || document.getElementById('settings_btn')) return null;
  const wrap = document.createElement('div');
  wrap.className = 'settings-wrap';
  wrap.innerHTML = `<button type="button" class="hud-btn hud-btn-xs settings-btn" id="settings_btn" aria-haspopup="dialog" aria-expanded="false" title="Ajustes"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.5 7.5 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5A3.5 3.5 0 1 1 13 8.5a3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg><span>AJUSTES</span></button>
    <div class="settings-pop" id="settings_pop" role="dialog" aria-label="Ajustes" hidden>
      <button type="button" class="settings-item" data-settings="sessions">Sesiones<small>Partida, sala y tripulación</small></button>
      <button type="button" class="settings-item" data-settings="sound">Sonido<small data-settings-sound></small></button>
      <button type="button" class="settings-item" data-settings="help">Ayuda<small>Guía, versión y cambios</small></button>
      <div class="settings-row"><span>Idioma</span><span data-settings-lang></span></div>
      <div class="settings-row"><span>Fuentes</span><span class="settings-seg" role="group" aria-label="Fuentes">${Object.entries(FONT_SETS).map(([id, set]) => `<button type="button" data-font-set="${id}" title="${e(set.note)}">${id.toUpperCase()} · ${e(set.name)}</button>`).join('')}</span></div>
      <div class="settings-row"><span>Tamaño</span><span class="settings-seg" role="group" aria-label="Tamaño de la interfaz">${UI_SCALES.map(s => `<button type="button" data-ui-scale="${s.value}" title="${Math.round(s.value * 100)} %">${e(s.label)}</button>`).join('')}</span></div>
      <div class="settings-row"><span>Panel lateral</span><span class="settings-seg" role="group" aria-label="Panel lateral"><button type="button" data-panel-mode="pinned">Fijo</button><button type="button" data-panel-mode="auto">Se oculta</button></span></div>
    </div>`;
  // Before the account button, after the save state.
  const status = right.querySelector('.header-status');
  if (status) status.after(wrap); else right.prepend(wrap);
  const button = wrap.querySelector('#settings_btn'), pop = wrap.querySelector('#settings_pop');
  const paint = () => {
    pop.querySelector('[data-settings-sound]').textContent = audio.muted ? 'Silenciado · pulsa para activarlo' : 'Activado · pulsa para silenciarlo';
    pop.querySelectorAll('[data-font-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fontSet === currentFontSet())));
    pop.querySelectorAll('[data-panel-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.panelMode === panelMode)));
    pop.querySelectorAll('[data-ui-scale]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.uiScale) === uiScale())));
  };
  // The header clips what overflows it: the menu is placed on the page, under its button.
  document.body.append(pop);
  const place = () => { const r = button.getBoundingClientRect(), z = zoomOf(pop); pop.style.top = `${Math.round((r.bottom + 8) / z)}px`; pop.style.right = `${Math.round((window.innerWidth - r.right) / z)}px`; };
  const toggle = show => { pop.hidden = !show; button.setAttribute('aria-expanded', String(show)); if (show) { place(); paint(); } };
  window.addEventListener('resize', () => { if (!pop.hidden) place(); });
  button.onclick = event => { event.stopPropagation(); toggle(pop.hidden); };
  document.addEventListener('pointerdown', event => { if (!pop.hidden && !wrap.contains(event.target) && !pop.contains(event.target)) toggle(false); }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !pop.hidden) { toggle(false); button.focus(); } });
  pop.addEventListener('click', event => {
    const item = event.target.closest('[data-settings]')?.dataset.settings;
    if (item) {
      if (item === 'sound') { document.getElementById('audio_toggle_btn')?.click(); paint(); return; }
      toggle(false);
      document.getElementById(item === 'sessions' ? 'network_modal_btn' : 'help_btn')?.click();
      return;
    }
    const font = event.target.closest('[data-font-set]')?.dataset.fontSet;
    if (font) { applyFontSet(font); paint(); window.dispatchEvent(new Event('resize')); return; }
    const scale = event.target.closest('[data-ui-scale]')?.dataset.uiScale;
    if (scale) { applyUiScale(Number(scale)); paint(); place(); return; }
    const mode = event.target.closest('[data-panel-mode]')?.dataset.panelMode;
    if (mode) { setPanelMode(mode); paint(); }
  });
  applyFontSet(currentFontSet());
  applyUiScale(uiScale());
  mountSidebarAuto();
  setPanelMode(panelMode);
  return wrap;
}
