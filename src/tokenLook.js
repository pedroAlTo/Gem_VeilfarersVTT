// The token's controls (v2.60.0; inside the portrait selection since v2.60.1, user request: «los
// controles del token muévelos a la selección de retrato»): the frame (its dominant colour becomes
// the token's colour, used in the chat), the name and insignia on the map and where each stat goes.
// Every change applies at once (a player's travels as an ordinary token patch: frame, colour and
// layout are player fields), so the portrait selection stays one click for whoever only wants that.
import { store } from './state.js';
import { escapeHTML as e, notify } from './ui.js';
import { actorPortrait } from './tokenAvatars.js';
import { TOKEN_FRAMES, frameById, frameBody, frameLight } from './tokenFrames.js';
import { tokenLayout, placeStat, placesFor, LAYOUT_STATS } from './tokenLayout.js';

const thumb = frame => frame
  ? `<span class="look-frame-art"><img src="${frameBody(frame)}" alt=""><img class="look-light" src="${frameLight(frame)}" alt=""></span>`
  : '<span class="look-frame-art look-frame-none">∅</span>';

// The section, to put after the portraits.
export function tokenControlsHTML() {
  return `<section class="token-look" data-token-look>
    <h4 class="dossier-label">Token</h4>
    <div class="look-top">
      <div class="look-preview" aria-hidden="true"><img class="look-portrait" alt=""><span class="look-preview-frame"></span></div>
      <div class="look-side">
        <p class="look-color">Color del token (nombre y chat): <i data-look-swatch></i> <b data-look-color></b></p>
        <p class="dossier-muted">El color sale del marco elegido. Los cambios se aplican al momento.</p>
      </div>
    </div>
    <h4 class="dossier-label">Marco</h4>
    <div class="look-frames" role="radiogroup" aria-label="Marco del token">
      <button type="button" class="look-frame" role="radio" data-look-frame="" title="Sin marco">${thumb(null)}<span>Sin marco</span></button>
      ${TOKEN_FRAMES.map(f => `<button type="button" class="look-frame" role="radio" data-look-frame="${f.id}" title="${e(f.name)}" style="--frame-color:${f.color}">${thumb(f)}<span>${e(f.name)}</span></button>`).join('')}
    </div>
    <h4 class="dossier-label">En el mapa</h4>
    <div class="sheet-map-layout">
      <label class="checkbox-label"><input type="checkbox" data-look-name> Nombre</label>
      <label class="checkbox-label"><input type="checkbox" data-look-insignia> Insignia de clase</label>
      ${LAYOUT_STATS.map(([stat, label]) => `<label class="sheet-layout-stat"><span>${label}</span><select class="hud-input" data-layout-stat="${stat}">${placesFor(stat).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select></label>`).join('')}
    </div>
    <p class="dossier-muted">Un círculo o un lado por stat (elegir uno ocupado lo quita del otro); las barras se apilan. Los stats solo los ven el Keeper y el jugador de este personaje.</p>
  </section>`;
}

// Wires the section to the token. onChange(patch) after each change that was applied.
export function bindTokenControls(root, tokenId, { onChange } = {}) {
  const live = () => store.state.tokens.find(t => t.id === tokenId);
  const section = root.querySelector('[data-token-look]');
  if (!section || !live()) return { paint() {} };
  const apply = patch => {
    if (store.updateToken(tokenId, patch) === false) { notify('No se ha podido guardar el token. Comprueba la conexión.', 'error'); return; }
    onChange?.(patch);
    paint();
  };
  function paint() {
    const token = live(); if (!token) return;
    const f = frameById(token.frame), layout = tokenLayout(token), color = token.color || '#00f3ff';
    const portrait = section.querySelector('.look-portrait');
    portrait.src = actorPortrait(token);
    // The portrait fills the frame's hole, as on the map.
    portrait.style.setProperty('--hole', f ? `${Math.round(f.inner * 100) + 1}%` : '86%');
    section.querySelector('.look-preview-frame').innerHTML = f ? thumb(f) : '';
    section.querySelectorAll('[data-look-frame]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.lookFrame === (f?.id || ''))));
    section.querySelector('[data-look-swatch]').style.background = color;
    section.querySelector('[data-look-color]').textContent = color;
    section.querySelector('[data-look-name]').checked = layout.name;
    section.querySelector('[data-look-insignia]').checked = layout.insignia;
    section.querySelectorAll('[data-layout-stat]').forEach(select => { select.value = layout[select.dataset.layoutStat]; });
  }
  section.querySelectorAll('[data-look-frame]').forEach(b => b.onclick = () => {
    const f = frameById(b.dataset.lookFrame);
    apply({ frame: f?.id || '', ...(f ? { color: f.color } : {}) });
  });
  section.querySelectorAll('[data-layout-stat]').forEach(select => select.addEventListener('change', () => apply({ vitalsLayout: placeStat(tokenLayout(live()), select.dataset.layoutStat, select.value) })));
  section.querySelector('[data-look-name]').onchange = event => apply({ vitalsLayout: { ...tokenLayout(live()), name: event.target.checked } });
  section.querySelector('[data-look-insignia]').onchange = event => apply({ vitalsLayout: { ...tokenLayout(live()), insignia: event.target.checked } });
  paint();
  return { paint };
}

// The token's own window: the portrait selection with these controls (the old «Mi token»).
export function openTokenLook(tokenId, options = {}) {
  return import('./portraitPicker.js').then(({ openActorPortrait }) => openActorPortrait(tokenId, options.onPortrait, options));
}
