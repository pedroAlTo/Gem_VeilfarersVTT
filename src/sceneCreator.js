import { store } from './state.js';
import { account, cloudConfigured, storageConfigured } from './cloudAccount.js';
import { openAccount } from './accountUI.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { getCloudinaryConfig, uploadToCloudinary } from './cloudinaryService.js';

export function imageDimensions(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error('Image loading timed out. Check the URL.')), 15000);
    image.onload = () => { clearTimeout(timer); image.naturalWidth > 6000 || image.naturalHeight > 6000 ? reject(new Error('Resize your image to 6000 × 6000 pixels or less.')) : resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('This image could not be loaded.')); };
    image.src = src;
  });
}
export function openSceneCreator({ arcId } = {}) {
  if (store.sessionRole === 'player') return;
  const cConfig = getCloudinaryConfig();
  const modal = dossierDialog('CREATE A SCENE', `
    <span class="dossier-eyebrow">SCENE / NEW DESTINATION</span><h2>Set the next encounter.</h2><p class="dossier-muted">Your party travels with you. Enemies stay in their own scene.</p>
    <form id="scene_form"><label class="dossier-field">Scene name<input class="hud-input" id="scene_name" required maxlength="200" placeholder="Derelict station · Hangar 04"></label>
    <label class="dossier-drop"><strong>Map image</strong><span>PNG, JPEG o WebP · hasta 50 MB (100 MB con Cloudinary) · hasta 8192 × 8192 px</span><input id="scene_file" type="file" accept="image/png,image/jpeg,image/webp"></label>
    <label class="dossier-field">Or an image URL<input class="hud-input" id="scene_url" type="url" placeholder="https://…"></label>
    <div class="session-options" style="background: rgba(0, 243, 255, 0.08); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(0, 243, 255, 0.3); margin: 8px 0;">
      <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
        <input id="scene_cloudinary" type="checkbox" ${cConfig.isConfigured ? 'checked' : ''} ${!cConfig.isConfigured ? 'disabled' : ''}>
        <strong style="color: var(--cyan-pearl, #00f3ff);">${cConfig.isConfigured ? '☁️ Subir y optimizar mapa con Cloudinary' : '☁️ Cloudinary (No detectado en variables de entorno)'}</strong>
      </label>
      <small style="color: #94a3b8; display: block; margin-top: 4px;">
        ${cConfig.isConfigured ? `Conectado al cloud [${e(cConfig.cloudName)}]. Optimización WebP/AVIF (f_auto, q_auto) en CDN global para todos los jugadores.` : 'Sin Cloudinary, la imagen se almacena en la campaña local o pegando una URL web.'}
      </small>
    </div>
    <div class="session-options" style="margin: 8px 0; background: rgba(16, 185, 129, 0.08); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3);">
      <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
        <input id="scene_save_account" type="checkbox" checked>
        <span style="color: #34d399; font-weight: 600;">🔥 Guardar automáticamente en la base de datos de Firebase ${account.user ? `[${e(account.user.displayName || 'Conectado')}]` : ''}</span>
      </label>
      <small style="color: #94a3b8; display: block; margin-top: 4px;">
        La escena y todos sus componentes (muros, luces, efectos, agua y fichas) se guardarán en tu base de datos de cuenta en Firebase.
      </small>
    </div>
    <p class="dossier-muted">Las imágenes se optimizan y sirven desde Cloudinary. Al guardar en tu cuenta, podrás reutilizar la escena en cualquier campaña.</p>
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
  modal.querySelector('#scene_account')?.addEventListener('click', () => openAccount());
  const refresh = async () => {
    const list = modal.querySelector('#cloud_scenes');
    try {
      const rows = await account.list('scenes');
      if (!modal.isConnected) return;
      list.innerHTML = sanitizeHTML(rows.length ? rows.map((s, i) => `
        <article class="crew-row" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${e(s.name)}</strong>
            <small style="display:block; color:#94a3b8;">${s.width || 1920} × ${s.height || 1080} · cuadrícula ${s.gridSize || 70}px</small>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="hud-btn hud-btn-xs" data-scene="${i}">Añadir al juego</button>
            <button class="hud-btn hud-btn-xs hud-btn-danger" data-delete-scene="${i}" title="Eliminar de mi cuenta">✕</button>
          </div>
        </article>
      `).join('') : '<p class="dossier-muted">No tienes escenas guardadas todavía.</p>');
      list.querySelectorAll('[data-scene]').forEach(b => b.onclick = () => {
        const item = rows[Number(b.dataset.scene)];
        store.addMap(item);
        if (item.walls?.length) store.updateMapWalls(item.id, item.walls);
        if (item.lights?.length) store.updateMapLights(item.id, item.lights);
        if (item.effects?.length) store.updateMapEffects(item.id, item.effects);
        if (item.tokens?.length) {
          const newTokens = item.tokens.map(t => ({ ...t, mapId: item.id, id: 'tok_' + Math.random().toString(36).substring(2, 9) }));
          store.update({ tokens: [...store.state.tokens, ...newTokens] });
        }
        modal.remove();
        notify(`Escena "${item.name}" cargada con sus componentes desde Firebase.`);
      });
      list.querySelectorAll('[data-delete-scene]').forEach(b => b.onclick = async () => {
        const item = rows[Number(b.dataset.deleteScene)];
        if (await confirmAction(`¿Eliminar la escena "${item.name}" de tu cuenta?`)) {
          await account.removeScene(item.id);
          await refresh();
        }
      });
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
      const file = fileInput.files[0];
      const saveToAccount = !!modal.querySelector('#scene_save_account')?.checked;
      const isCloudinary = !!modal.querySelector('#scene_cloudinary')?.checked;
      const maxBytes = isCloudinary ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
      const maxMB = Math.round(maxBytes / (1024 * 1024));
      if (file) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
          throw new Error('Elige una imagen en formato PNG, JPEG o WebP.');
        }
        if (file.size > maxBytes) {
          throw new Error(`La imagen supera el límite de ${maxMB} MB.${!isCloudinary ? ' Activa la opción de Cloudinary para permitir mapas de hasta 100 MB.' : ''}`);
        }
      }
      let src = file ? previewURL : modal.querySelector('#scene_url').value.trim() || '/assets/maps/blank-grid.svg';
      if (!file && src[0] !== '/' && !/^https?:\/\//i.test(src)) throw new Error('Use an HTTP or HTTPS image URL.');
      status.textContent = 'Checking image…';
      const dimensions = await imageDimensions(src);
      const scene = { name: modal.querySelector('#scene_name').value.trim(), gridSize: Number(modal.querySelector('#scene_grid').value), ambientLight: Number(modal.querySelector('#scene_light').value), ...dimensions };
      if (file && isCloudinary) {
        status.textContent = 'Subiendo y optimizando mapa en Cloudinary...';
        const res = await uploadToCloudinary(file, n => {
          status.textContent = `Subiendo a Cloudinary · ${n}%`;
        });
        scene.imageUrl = res.url;
        scene.width = res.width || scene.width;
        scene.height = res.height || scene.height;
      } else if (file) {
        src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        scene.imageUrl = src;
      } else {
        scene.imageUrl = src;
      }
      if (arcId) scene.arcId = arcId;
      if (!store.addMap(scene)) throw new Error('Cannot create a scene while joining a game.');

      // Persist automatically to Firebase database with all components
      if (saveToAccount || account.user) {
        status.textContent = 'Guardando escena en base de datos Firebase...';
        try {
          await account.saveScene(scene, {
            walls: scene.walls || [],
            lights: scene.lights || [],
            effects: scene.effects || [],
            water: scene.water || [],
            tokens: store.state.tokens.filter(t => t.mapId === scene.id)
          });
        } catch (saveErr) {
          console.warn('Firebase saveScene error:', saveErr);
          notify(`Aviso: Escena creada localmente. Error en Firebase: ${saveErr.message}`, 'error');
        }
      }

      modal.remove(); notify('¡Escena creada y desplegada con éxito!');
    } catch (err) { error.textContent = err.message || 'Image could not be saved.'; status.textContent = 'Scene was not created.'; }
    finally { delete modal.dataset.busy; controls.forEach(c => c.disabled = false); cancel.hidden = true; }
  };
  return modal;
}
