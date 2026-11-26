// «Mi token» (v2.60.0, user requests: «deja al jugador elegir el token y poder configurar sus barras
// de stats» and the 30 frames «para diferenciar el círculo del token»): the portrait, the frame
// (its dominant colour becomes the token's colour, used in the chat), the name and insignia on the
// map and where each stat goes. The player of a character and the Keeper both use it; a player's
// change travels as an ordinary token patch (frame, colour, layout are player fields).
import { store } from './state.js';
import { escapeHTML as e, notify } from './ui.js';
import { tableDialog } from './dossierDialog.js';
import { actorPortrait } from './tokenAvatars.js';
import { TOKEN_FRAMES, frameById, frameBody, frameLight } from './tokenFrames.js';
import { tokenLayout, placeStat, placesFor, LAYOUT_STATS } from './tokenLayout.js';

const thumb = frame => frame
  ? `<span class="look-frame-art"><img src="${frameBody(frame)}" alt=""><img class="look-light" src="${frameLight(frame)}" alt=""></span>`
  : '<span class="look-frame-art look-frame-none">∅</span>';

export function openTokenLook(tokenId, { onSaved } = {}) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token || !store.canEditToken(tokenId)) { notify('Solo el Keeper y el jugador de este personaje pueden cambiar su token.', 'error'); return null; }
  let frame = frameById(token.frame)?.id || '', layout = tokenLayout(token);
  const startColor = token.color || '';
  const dlg = tableDialog(`Mi token · ${token.name}`, `
    <div class="look-top">
      <div class="look-preview" aria-hidden="true"><img class="look-portrait" alt=""><span class="look-preview-frame"></span></div>
      <div class="look-side">
        <button type="button" class="hud-btn" data-look-portrait>Cambiar retrato</button>
        <p class="look-color">Color del token (nombre y chat): <i data-look-swatch></i> <b data-look-color></b></p>
        <p class="dossier-muted">El color sale del marco elegido.</p>
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
    <p class="dossier-muted">Un círculo o un lado por stat (elegir uno ocupado lo quita del otro); las barras se apilan. Tus stats solo los ves tú y el Keeper.</p>
    <div class="look-actions"><button type="button" class="hud-btn hud-btn-primary" data-look-save>Guardar</button></div>`, 'token-look-dialog');
  const colorFor = () => frameById(frame)?.color || startColor || '#00f3ff';
  const paint = () => {
    const live = store.state.tokens.find(t => t.id === tokenId) || token, f = frameById(frame);
    const portrait = dlg.querySelector('.look-portrait');
    portrait.src = actorPortrait(live);
    // The portrait fills the frame's hole, as on the map.
    portrait.style.setProperty('--hole', f ? `${Math.round(f.inner * 100) + 1}%` : '86%');
    dlg.querySelector('.look-preview-frame').innerHTML = f ? thumb(f) : '';
    dlg.querySelectorAll('[data-look-frame]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.lookFrame === frame)));
    dlg.querySelector('[data-look-swatch]').style.background = colorFor();
    dlg.querySelector('[data-look-color]').textContent = colorFor();
    dlg.querySelector('[data-look-name]').checked = layout.name;
    dlg.querySelector('[data-look-insignia]').checked = layout.insignia;
    dlg.querySelectorAll('[data-layout-stat]').forEach(select => { select.value = layout[select.dataset.layoutStat]; });
  };
  dlg.querySelectorAll('[data-look-frame]').forEach(b => b.onclick = () => { frame = b.dataset.lookFrame; paint(); });
  dlg.querySelectorAll('[data-layout-stat]').forEach(select => select.addEventListener('change', () => { layout = placeStat(layout, select.dataset.layoutStat, select.value); paint(); }));
  dlg.querySelector('[data-look-name]').onchange = event => { layout = { ...layout, name: event.target.checked }; };
  dlg.querySelector('[data-look-insignia]').onchange = event => { layout = { ...layout, insignia: event.target.checked }; };
  dlg.querySelector('[data-look-portrait]').onclick = () => import('./portraitPicker.js').then(({ openActorPortrait }) => openActorPortrait(tokenId, () => paint()));
  dlg.querySelector('[data-look-save]').onclick = () => {
    const patch = { frame, vitalsLayout: layout, ...(frame ? { color: colorFor() } : {}) };
    if (store.updateToken(tokenId, patch) === false) { notify('No se ha podido guardar el token. Comprueba la conexión.', 'error'); return; }
    notify('Token guardado.');
    onSaved?.(patch);
    dlg.remove();
  };
  paint();
  return dlg;
}
