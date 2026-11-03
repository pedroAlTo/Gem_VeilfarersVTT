import { DICE_THEMES } from './diceMaterials.js';
import { escapeHTML as e } from './ui.js';

// A map child, not a modal: it never blocks the tabletop or captures focus.
export function createDiceTrayPanel({ theme = 'crystal', automatic = true, reducedMotion = false } = {}) {
  const viewport = document.getElementById('canvas_viewport_root');
  if (!viewport) throw new Error('Open a map before opening the dice tray.');
  const previous = document.activeElement, panel = document.createElement('aside');
  panel.className = 'dice-tray-overlay'; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', '3D dice tray');
  panel.innerHTML = `
    <header class="tray-header"><div><span class="tray-signal" aria-hidden="true"></span><strong>Dice tray</strong><small>HOPE + FEAR</small></div><nav aria-label="Dice tray controls">
      <button class="tray-icon" id="tray_settings_toggle" aria-label="Dice settings" aria-expanded="false" aria-controls="tray_settings" title="Dice settings">⚙</button>
      <button class="tray-icon" id="tray_minimize" aria-label="Minimize dice tray" aria-expanded="true" aria-controls="tray_body" title="Minimize">−</button>
      <button class="tray-icon" id="tray_close" aria-label="Close dice tray" title="Close">×</button>
    </nav></header>
    <div id="tray_body"><div class="tray-stage" id="tray_stage"><span class="tray-corner tray-corner-left">D12 / ORBITAL ARRAY</span><span class="tray-corner tray-corner-right" id="tray_engine">LIVE 3D</span></div></div>
    <div class="tray-result" role="status" aria-live="polite" aria-atomic="true"><span class="tray-hope"><small>HOPE</small><b id="tray_hope">—</b></span><span id="tray_caption">Ready to roll</span><span class="tray-fear"><small>FEAR</small><b id="tray_fear">—</b></span></div>
    <div class="tray-settings" id="tray_settings" hidden>
      <label class="tray-field" for="tray_theme">Dice finish</label><vf-select class="hud-select" id="tray_theme" aria-label="Dice finish">${Object.entries(DICE_THEMES).map(([key, label]) => `<option value="${key}" ${theme === key ? 'selected' : ''}>${e(label)}</option>`).join('')}</vf-select>
      <div class="tray-camera"><span>Drag to orbit · scroll to zoom</span><button class="tray-icon" id="tray_rotate_left" aria-label="Rotate camera left">↶</button><button class="tray-icon" id="tray_rotate_right" aria-label="Rotate camera right">↷</button><button class="tray-text-button" id="tray_reset_camera">Reset</button></div>
      <div class="tray-options"><label><input type="checkbox" id="tray_automatic" ${automatic ? 'checked' : ''}> Show for game rolls</label><label><input type="checkbox" id="tray_motion" ${reducedMotion ? 'checked' : ''}> Reduce motion</label></div>
      <div class="tray-test"><p id="tray_note">Test throws do not change your game.</p><button class="tray-text-button" id="tray_demo">Test throw</button></div>
    </div>`;
  const close = () => { const hadFocus = panel.contains(document.activeElement); panel.remove(); if (hadFocus && previous?.isConnected) previous.focus?.(); };
  panel.querySelector('#tray_close').onclick = close;
  panel.querySelector('#tray_minimize').onclick = event => {
    const body = panel.querySelector('#tray_body'), hidden = !body.hidden; body.hidden = hidden;
    panel.classList.toggle('is-minimized', hidden); event.currentTarget.setAttribute('aria-expanded', String(!hidden));
    event.currentTarget.setAttribute('aria-label', hidden ? 'Expand dice tray' : 'Minimize dice tray'); event.currentTarget.title = hidden ? 'Expand' : 'Minimize'; event.currentTarget.textContent = hidden ? '+' : '−';
    if (hidden) { panel.querySelector('#tray_settings').hidden = true; panel.querySelector('#tray_settings_toggle').setAttribute('aria-expanded', 'false'); }
  };
  panel.querySelector('#tray_settings_toggle').onclick = event => {
    const settings = panel.querySelector('#tray_settings'); settings.hidden = !settings.hidden; event.currentTarget.setAttribute('aria-expanded', String(!settings.hidden));
  };
  // Events within the tray must not pan/zoom the map or run its shortcuts.
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'touchstart', 'touchmove']) panel.addEventListener(name, event => event.stopPropagation());
  panel.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  panel.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close(); } });
  viewport.append(panel);
  return panel;
}
