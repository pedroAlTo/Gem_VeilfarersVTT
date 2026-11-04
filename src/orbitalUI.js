import { LOCAL_ONLY, connectionDisplay } from './runtimeMode.js';
import { store } from './state.js';
import { sanitizeHTML, notify } from './ui.js';
import './orbital.css';
import './orbital-v2.css';
const icons = {
  select: 'M4 3l15 9-7 1-3 7z',
  measure: 'M4 18L18 4l3 3L7 21z M8 14l3 3 M12 10l3 3 M16 6l3 3',
  template: 'M12 3v18 M3 12h18 M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16',
  fx: 'M13 2L5 13h6l-1 9 9-13h-6z',
  ping: 'M12 3a7 7 0 0 0-7 7c0 5 7 11 7 11s7-6 7-11a7 7 0 0 0-7-7z M12 7v6 M9 10h6',
  wall: 'M3 5h18v14H3z M3 12h18 M8 5v7 M16 12v7',
  light: 'M8 16h8 M9 20h6 M8 15c-6-5-1-13 4-13s10 8 4 13',
  water: 'M3 8q3-4 6 0t6 0 6 0 M3 14q3-4 6 0t6 0 6 0 M3 20q3-4 6 0t6 0 6 0',
  grid: 'M3 3h18v18H3z M9 3v18 M15 3v18 M3 9h18 M3 15h18',
  eye: 'M2 12q10-15 20 0-10 15-20 0 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  undo: 'M9 5L3 10l6 5 M3 10h11a6 6 0 0 1 0 12',
  redo: 'M15 5l6 5-6 5 M21 10h-11a6 6 0 0 0 0 12',
  snap: 'M5 4v10a7 7 0 0 0 14 0V4h-4v10a3 3 0 0 1-6 0V4z',
};
const icon = (k) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[k] || icons.template}"/></svg>`;
export function initOrbitalUI() {
  const labels = {
    tool_select: ['select', 'Move'],
    tool_measure: ['measure', 'Measure'],
    tool_template: ['template', 'Area'],
    tool_fx: ['fx', 'Effects'],
    tool_ping: ['ping', 'Ping'],
    tool_wall: ['wall', 'Walls'],
    tool_light: ['light', 'Lights'],
    tool_fx_emitter: ['template', 'Anomaly'],
    tool_water: ['water', 'Water'],
    tool_grid_scale: ['grid', 'Scale'],
    toggle_gm_vision: ['eye', 'Vision'],
    toggle_fog_of_war: ['water', 'Fog'],
    toggle_grid: ['grid', 'Grid'],
    toggle_snap: ['snap', 'Snap'],
    tool_undo: ['undo', 'Undo'],
    tool_redo: ['redo', 'Redo'],
  };
  for (const [id, [glyph, label]] of Object.entries(labels)) {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = sanitizeHTML(`${icon(glyph)}<span class="tool-caption">${label}</span>`);
      el.setAttribute('aria-label', label);
    }
  }
  document.querySelector('.brand-version').textContent = 'TACTICAL SYSTEM / 12.06';
  document.getElementById('network_modal_btn').innerHTML =
    '<span id="net_status_dot">●</span> SESSION';
  if (LOCAL_ONLY) {
    const session = document.getElementById('network_modal_btn');
    session.disabled = false;
    session.innerHTML = '<span id="net_status_dot">●</span> LOCAL TEST';
    session.title = 'Local test mode. Multiplayer is disabled.';
  }
  document.getElementById('rules_modal_btn').textContent = 'CODEX';
  document.getElementById('data_menu_btn').textContent = 'SESIONES';
  document.getElementById('data_menu_btn').title = 'Crear, abrir y guardar sesiones locales';
  const sidebar = document.getElementById('main_right_sidebar');
  const heading = document.createElement('div');
  heading.className = 'orbital-panel-heading';
  heading.innerHTML =
    '<span class="eyebrow">OPERATIONS CONSOLE</span><div><h2 id="orbital_panel_title">Resolve an action</h2><span class="panel-index" id="orbital_panel_index">01 / 08</span></div>';
  sidebar.prepend(heading);
  const titles = {
    dice: 'Resolve an action',
    clocks: 'Mission clocks',
    ship: 'Ship systems',
    roster: 'Crew manifest',
    scenes: 'Tactical scenes',
    handouts: 'Intelligence',
    log: 'Session chronicle',
    chat: 'Comunicaciones',
  };
  [...document.querySelectorAll('.tab-nav-btn')].forEach((b, i) => {
    b.addEventListener('click', () => {
      document.getElementById('orbital_panel_title').textContent =
        titles[b.dataset.tab] || b.textContent.trim();
      document.getElementById('orbital_panel_index').textContent = `0${i + 1} / 08`;
    });
  });
  const viewport = document.getElementById('canvas_viewport_root'),
    hud = document.createElement('div');
  hud.className = 'orbital-map-heading';
  hud.innerHTML =
    '<div><span class="eyebrow">LIVE TACTICAL FIELD</span><h1 id="orbital_scene_name"></h1></div><div class="field-coordinates"><span class="live-dot"></span><span id="orbital_view_mode">KEEPER VIEW</span></div>';
  viewport.append(hud);
  const frame = document.createElement('div');
  frame.className = 'orbital-map-frame'; frame.setAttribute('aria-hidden','true');
  viewport.append(frame);
  const readout = document.createElement('div');
  readout.className = 'orbital-field-readout';
  viewport.append(readout);
  const footer = document.createElement('footer');
  footer.className = 'orbital-statusbar';
  footer.innerHTML =
    '<span><i class="live-dot"></i> VEIL CONNECTION <b id="orbital_connection">LOCAL</b></span><span id="orbital_campaign"></span><button id="orbital_save_status" class="status-save">SAVED</button>';
  document.getElementById('app_root').append(footer);
  const update = () => {
    const s = store.state;
    const currentMap = store.getActiveMap();
    const connection = connectionDisplay(s, store.sessionRole);
    readout.innerHTML = `<span>OPERATIVES <b>${store.getTokensForActiveMap().filter(t => s.userRole === 'keeper' || !t.hidden).length}</b></span><span>GRID <b>${currentMap?.gridSize || 0}</b></span><span>SCENE / ${s.isConnected ? 'SESSION' : 'LOCAL'}</span>`;
    document.getElementById('orbital_scene_name').textContent =
      store.getActiveMap()?.name || 'No active scene';
    document.getElementById('orbital_view_mode').textContent =
      s.userRole === 'keeper' ? 'KEEPER VIEW' : 'PLAYER VIEW';
    document.getElementById('orbital_connection').textContent = connection.detail;
    document.getElementById('orbital_campaign').textContent = s.campaignName;
    document.getElementById('role_keeper_btn').disabled = store.sessionRole === 'player';
    document
      .querySelectorAll('.keeper-only-tool')
      .forEach((el) => el.classList.toggle('hidden', s.userRole !== 'keeper'));
    document.getElementById('quick_scene_select').disabled = store.sessionRole === 'player';
    const label = document.getElementById('orbital_save_status');
    label.textContent =
      store.sessionRole === 'player' ? 'SESSION REPLICA' : (s.saveStatus || 'saved').toUpperCase();
    label.dataset.state = s.saveStatus;
  };
  window.addEventListener('veil:save-status', update);
  store.subscribe(update);
  update();
  initScrollRails();
  footer.querySelector('button').onclick = () => {
    if (store.state.saveStatus === 'error')
      notify(`Save failed: ${store.state.saveError}. Exporta una copia desde SESIONES.`, 'error');
    else notify('Your campaign is saved on this device. Exporta una copia desde SESIONES.');
  };
  // Accessible custom file triggers; the system file picker is only invoked on explicit upload.
  const upgradeFiles = () => {
    document.querySelectorAll('input[type="file"]:not([data-orbital])').forEach((input) => {
      input.dataset.orbital = 'true';
      input.classList.add('orbital-file-source');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hud-btn orbital-file-trigger';
      button.textContent = input.multiple ? 'Seleccionar archivos…' : 'Seleccionar archivo…';
      button.onclick = () => input.click();
      input.after(button);
      input.addEventListener(
        'change',
        () => (button.textContent = input.files?.length > 1 ? `${input.files.length} archivos seleccionados` : input.files?.[0]?.name || 'Seleccionar archivo…')
      );
    });
  };
  new MutationObserver(upgradeFiles).observe(document.body, { childList: true, subtree: true });
  upgradeFiles();
}

// Custom scroll rails retain wheel, touch and keyboard scrolling without native chrome.
function initScrollRails() {
  const installed = new WeakSet();
  const install = () =>
    document.querySelectorAll('.sidebar-tab-content-area,.veil-modal-body').forEach((el) => {
      if (installed.has(el)) return;
      installed.add(el);
      const rail = document.createElement('div'),
        thumb = document.createElement('button');
      rail.className = 'orbital-scroll-rail';
      thumb.className = 'orbital-scroll-thumb';
      thumb.setAttribute('aria-label', 'Scroll panel');
      rail.append(thumb);
      document.body.append(rail);
      const update = () => {
        if (!el.isConnected) {
          rail.remove();
          observer.disconnect();
          return;
        }
        const r = el.getBoundingClientRect();
        const visible = r.height > 0 && el.scrollHeight > el.clientHeight + 2;
        rail.hidden = !visible;
        if (!visible) return;
        const size = Math.max(28, (r.height * el.clientHeight) / el.scrollHeight);
        Object.assign(rail.style, {
          left: `${r.right - 7}px`,
          top: `${r.top + 3}px`,
          height: `${r.height - 6}px`,
        });
        Object.assign(thumb.style, {
          height: `${size}px`,
          top: `${((r.height - 6 - size) * el.scrollTop) / (el.scrollHeight - el.clientHeight)}px`,
        });
      };
      const observer = new ResizeObserver(update);
      observer.observe(el);
      el.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      let startY, startScroll;
      thumb.onpointerdown = (e) => {
        startY = e.clientY;
        startScroll = el.scrollTop;
        thumb.setPointerCapture(e.pointerId);
      };
      thumb.onpointermove = (e) => {
        if (!thumb.hasPointerCapture(e.pointerId)) return;
        el.scrollTop = startScroll + ((e.clientY - startY) * el.scrollHeight) / el.clientHeight;
      };
      thumb.onkeydown = (e) => {
        if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          el.scrollTop =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? el.scrollHeight
                : el.scrollTop +
                  {
                    ArrowDown: 40,
                    ArrowUp: -40,
                    PageDown: el.clientHeight,
                    PageUp: -el.clientHeight,
                  }[e.key];
        }
      };
      const mutation = new MutationObserver(() => {
        if (!el.isConnected) {
          mutation.disconnect();
          rail.remove();
          window.removeEventListener('resize', update);
        } else update();
      });
      mutation.observe(document.body, { childList: true, subtree: true });
      update();
    });
  new MutationObserver(install).observe(document.body, { childList: true, subtree: true });
  install();
}
