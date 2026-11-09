import { store } from './state.js';
import { account, cloudConfigured, storageConfigured } from './cloudAccount.js';
import { openAccount } from './accountUI.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';

export function imageDimensions(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error('Image loading timed out. Check the URL.')), 15000);
    image.onload = () => { clearTimeout(timer); image.naturalWidth > 6000 || image.naturalHeight > 6000 ? reject(new Error('Resize your image to 6000 × 6000 pixels or less.')) : resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('This image could not be loaded.')); };
    image.src = src;
  });
}
export function openSceneCreator() {
  if (store.sessionRole === 'player') return;
  const modal = dossierDialog('CREATE A SCENE', `
    <span class="dossier-eyebrow">SCENE / NEW DESTINATION</span><h2>Set the next encounter.</h2><p class="dossier-muted">Your party travels with you. Enemies stay in their own scene.</p>
    <form id="scene_form"><label class="dossier-field">Scene name<input class="hud-input" id="scene_name" required maxlength="200" placeholder="Derelict station · Hangar 04"></label>
    <label class="dossier-drop"><strong>Map image</strong><span>PNG, JPEG or WebP · up to 20 MB · 6000 × 6000 px</span><input id="scene_file" type="file" accept="image/png,image/jpeg,image/webp"></label>
    <label class="dossier-field">Or an image URL<input class="hud-input" id="scene_url" type="url" placeholder="https://…"></label>
    <div class="session-options"><label><input id="scene_cloud" type="checkbox" ${storageConfigured ? 'checked' : ''} ${!storageConfigured ? 'disabled' : ''}> Save uploaded image and scene to my account</label><button type="button" class="hud-btn" id="scene_account">${account.user ? 'Account connected' : 'Sign in for server uploads'}</button></div>
    <p class="dossier-muted">${storageConfigured ? 'Server uploads use Firebase Storage. Without this option, the image is stored only in this local campaign. A web URL stays on its original server.' : 'Firebase Storage es opcional. Sin él, la imagen se guarda directamente en tu campaña local o pegando una URL web.'}</p>
    <img id="scene_preview" class="scene-upload-preview" alt="Map preview" hidden>
    <div class="form-row"><label class="dossier-field">Grid size (px)<input class="hud-input" id="scene_grid" type="number" value="70" min="24" max="250" required></label><label class="dossier-field">Ambient light<vf-select class="hud-select" id="scene_light"><option value="0.25">Dim · 25%</option><option value="0.5">Emergency · 50%</option><option value="0.8">Bright · 80%</option></vf-select></label></div>
    <p id="scene_progress" role="status"></p><p class="dossier-error" role="alert"></p><div class="session-actions"><button type="submit" class="hud-btn hud-btn-primary">Create and enter scene</button><button type="button" class="hud-btn" id="scene_cancel_upload" hidden>Cancel upload</button></div></form>
    <h3>Your server scenes</h3><div id="cloud_scenes">${account.user ? 'Loading…' : 'Sign in to reuse a saved scene.'}</div><button class="hud-btn" id="scene_refresh">Refresh library</button>
  `);
  const fileInput = modal.querySelector('#scene_file'), status = modal.querySelector('#scene_progress'), error = modal.querySelector('.dossier-error');
  let previewURL;
  const observer = new MutationObserver(() => { if (!modal.isConnected) { if (previewURL) URL.revokeObjectURL(previewURL); observer.disconnect(); } });
  observer.observe(document.body, { childList: true });
  fileInput.onchange = () => { if (previewURL) URL.revokeObjectURL(previewURL); const file = fileInput.files[0]; const img = modal.querySelector('#scene_preview'); img.hidden = !file; if (file) { previewURL = URL.createObjectURL(file); img.src = previewURL; } };
  modal.querySelector('#scene_account').onclick = () => openAccount();
  const refresh = async () => {
    const list = modal.querySelector('#cloud_scenes');
    try {
      const rows = await account.list('scenes');
      if (!modal.isConnected) return;
      list.innerHTML = sanitizeHTML(rows.length ? rows.map((s, i) => `<article class="crew-row"><div><strong>${e(s.name)}</strong><small>${s.width} × ${s.height} · server image</small></div><button class="hud-btn" data-scene="${i}">Add to game</button></article>`).join('') : 'No saved scenes yet.');
      list.querySelectorAll('[data-scene]').forEach(b => b.onclick = () => { store.addMap(rows[Number(b.dataset.scene)]); modal.remove(); });
    } catch (err) { list.textContent = err.message; }
  };
  modal.querySelector('#scene_refresh').onclick = refresh;
  if (account.user) refresh();
  modal.querySelector('#scene_cancel_upload').onclick = () => account.cancelUpload?.();
  modal.querySelector('form').onsubmit = async event => {
    event.preventDefault(); error.textContent = ''; modal.dataset.busy = '1';
    const controls = [...modal.querySelectorAll('input, button, vf-select')]; controls.forEach(c => c.disabled = true);
    const cancel = modal.querySelector('#scene_cancel_upload');
    try {
      const file = fileInput.files[0], cloud = modal.querySelector('#scene_cloud').checked;
      if (file && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024)) throw new Error('Choose PNG, JPEG or WebP up to 20 MB.');
      let src = file ? previewURL : modal.querySelector('#scene_url').value.trim() || '/assets/maps/blank-grid.svg';
      if (!file && src[0] !== '/' && !/^https?:\/\//i.test(src)) throw new Error('Use an HTTP or HTTPS image URL.');
      status.textContent = 'Checking image…';
      const dimensions = await imageDimensions(src);
      const scene = { name: modal.querySelector('#scene_name').value.trim(), gridSize: Number(modal.querySelector('#scene_grid').value), ambientLight: Number(modal.querySelector('#scene_light').value), ...dimensions };
      if (file && cloud) {
        cancel.hidden = false; cancel.disabled = false;
        Object.assign(scene, await account.uploadScene(file, scene, n => { status.textContent = `Uploading image to server · ${n}%`; }));
      } else {
        if (file) src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        scene.imageUrl = src;
      }
      if (!store.addMap(scene)) throw new Error('Cannot create a scene while joining a game.');
      modal.remove(); notify(file && cloud ? 'Scene saved on the server. Party moved to the new scene.' : 'Scene created. Party moved to the new scene.');
    } catch (err) { error.textContent = err.message || 'Image could not be saved.'; status.textContent = 'Scene was not created.'; }
    finally { delete modal.dataset.busy; controls.forEach(c => c.disabled = false); cancel.hidden = true; }
  };
  return modal;
}
