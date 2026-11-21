import { dossierDialog } from './dossierDialog.js';
import { escapeHTML as e } from './ui.js';
import { store } from './state.js';
import { actorPortrait, ANCESTRY_IDS, normalizeAncestryId, TOKEN_CLASSES } from './tokenAvatars.js';
import { ancestryNames, isPlayerPortrait, isPortraitReference, isPortraitSource, isPresetPortrait, portraitChoices, presetLocation } from './portraitCatalog.js';

const option = (value, label, current) => `<option value="${e(value)}" ${value === current ? 'selected' : ''}>${e(label)}</option>`;
export const portraitGenderOptions = value => [['', 'Según los pronombres'], ['f', 'Femenino'], ['m', 'Masculino'], ['n', 'Neutro']]
  .map(([id, label]) => option(id, label, value || '')).join('');

async function resizePortrait(src) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('No se ha podido leer la imagen.'));
    img.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 320, 320);
  return canvas.toDataURL('image/webp', .8);
}

async function readFile(file, cloud) {
  if (cloud) {
    const { getCloudinaryConfig, uploadToCloudinary } = await import('./cloudinaryService.js');
    if (getCloudinaryConfig().isConfigured) {
      try { return (await uploadToCloudinary(file, () => {}, { prefix: 'Token_' })).url; }
      catch { /* Keep the portrait usable in an offline room. */ }
    }
  }
  const url = URL.createObjectURL(file);
  try { return await resizePortrait(url); }
  finally { URL.revokeObjectURL(url); }
}

export function openPortraitPicker({ title = 'Elegir retrato', current = '', collection = 'human', allowCustom = false,
  cloud = false, sceneTokens = [], onChoose, resetLabel = 'Usar retrato automático' }) {
  const preset = collection === 'scene' ? null : presetLocation(current);
  collection = preset?.collection || collection;
  const collections = [...(sceneTokens.length ? [['scene', 'Tokens de la escena']] : []),
    ...ANCESTRY_IDS.map(id => [id, ancestryNames[id]]), ['bestiary', 'Bestiario · Tier 1'], ['bestiary-2', 'Bestiario · Tier 2'], ['crew', 'Tripulación conocida']];
  const modal = dossierDialog(title, `
    <div class="portrait-filters"><label class="dossier-field"><span>Colección</span><vf-select class="hud-select" data-collection>${collections.map(([id, label]) => option(id, label, collection)).join('')}</vf-select></label>
    <label class="dossier-field" data-class-filter><span>Insignia de clase</span><vf-select class="hud-select" data-class>${option('', 'Sin insignia', '')}${TOKEN_CLASSES.map(id => option(id, id[0].toUpperCase() + id.slice(1))).join('')}</vf-select></label></div>
    <div class="portrait-grid" aria-label="Retratos disponibles"></div>
    ${allowCustom ? `<div class="portrait-custom"><button type="button" class="hud-btn" data-upload>Subir imagen</button><input type="file" accept="image/*" data-file hidden>
      <label class="dossier-field"><span>URL de imagen</span><input type="url" class="hud-input" data-url placeholder="https://…"></label><button type="button" class="hud-btn" data-use-url>Usar URL</button></div>` : ''}
    <p class="dossier-error" role="alert"></p><footer class="portrait-footer"><button type="button" class="hud-btn" data-auto>${e(resetLabel)}</button></footer>`, 'portrait-picker');
  const group = modal.querySelector('[data-collection]'), cls = modal.querySelector('[data-class]');
  group.value = collection;
  cls.value = preset?.cls || '';
  const error = modal.querySelector('[role=alert]');
  const close = modal.querySelector('.modal-close-btn');
  async function choose(getSource) {
    if (modal.dataset.busy) return;
    modal.dataset.busy = 'true';
    modal.setAttribute('aria-busy', 'true');
    error.textContent = '';
    try {
      let url = await getSource();
      if (allowCustom && typeof url === 'string' && url.startsWith('data:image/') && !isPortraitSource(url)) url = await resizePortrait(url);
      if (url !== '' && !(allowCustom ? isPortraitSource(url) : isPresetPortrait(url))) throw new Error('Selecciona una imagen válida.');
      if (await onChoose(url) === false) throw new Error('No se ha podido cambiar el retrato. Comprueba la conexión y la asignación del token.');
      delete modal.dataset.busy;
      close.click();
    } catch (err) { error.textContent = err.message; }
    finally { delete modal.dataset.busy; modal.removeAttribute('aria-busy'); }
  }
  function render() {
    modal.querySelector('[data-class-filter]').hidden = !ANCESTRY_IDS.includes(group.value);
    const choices = group.value === 'scene' ? sceneTokens.map(t => ({ name: t.name, url: actorPortrait(t) })) : portraitChoices(group.value, cls.value);
    const buttons = choices.map(({ name, url }) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'portrait-choice'; button.setAttribute('aria-pressed', String(url === current));
      const image = document.createElement('img'); image.alt = ''; image.src = url;
      const label = document.createElement('span'); label.textContent = name;
      button.append(image, label); button.onclick = () => choose(() => url);
      return button;
    });
    modal.querySelector('.portrait-grid').replaceChildren(...buttons);
  }
  group.addEventListener('change', render);
  cls.addEventListener('change', render);
  modal.querySelector('[data-auto]').onclick = () => choose(() => '');
  if (allowCustom) {
    const file = modal.querySelector('[data-file]'), url = modal.querySelector('[data-url]');
    modal.querySelector('[data-upload]').onclick = () => file.click();
    file.onchange = () => { if (file.files?.[0]) void choose(() => readFile(file.files[0], cloud)); };
    const useUrl = () => choose(() => {
      if (!isPortraitReference(url.value.trim())) throw new Error('Introduce una URL de imagen válida.');
      return url.value.trim();
    });
    modal.querySelector('[data-use-url]').onclick = useUrl;
    url.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); void useUrl(); } };
  }
  render();
  return modal;
}

export function actorCollection(token) {
  if (token.species || token.ancestry) return normalizeAncestryId(token.species || token.ancestry);
  return token.isPlayer === false || token.actorType === 'adversary' ? 'bestiary' : 'human';
}

export function openActorPortrait(tokenId, onApplied) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token || !store.canEditToken(tokenId)) return;
  const keeper = () => store.sessionRole !== 'player' && store.state.userRole === 'keeper';
  const campaign = store.state.campaignId;
  return openPortraitPicker({ current: actorPortrait(token), collection: actorCollection(token), allowCustom: true, cloud: keeper(),
    onChoose(url) {
      if (campaign !== store.state.campaignId || !store.canEditToken(tokenId) || (url && !keeper() && !isPlayerPortrait(url))) return false;
      const patch = { avatarUrl: url, portraitOverride: Boolean(url) };
      if (!store.updateToken(tokenId, patch)) return false;
      onApplied?.(actorPortrait({ ...token, ...patch }));
      return true;
    },
  });
}
