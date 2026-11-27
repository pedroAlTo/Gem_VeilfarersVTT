import { sanitizeHTML, confirmAction, notify, escapeHTML as e } from './ui.js';
import { currentLanguage } from './i18n.js';
import { getCloudinaryConfig, uploadToCloudinary } from './cloudinaryService.js';
// src/handoutManager.js
// Classified Transmissions, Dossiers, and Enriched Text Handouts with Images

import { store } from './state.js';
import { network } from './networkManager.js';
import { audio } from './audioEngine.js';
import { publicDossier } from './dossierPrivacy.js';
import { MODULES, roomModule, mergeModule } from './moduleUpdate.js';

export class HandoutManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('handouts') || keys.includes('userRole') || keys.includes('activeTransmission')) {
        this.render();
      }
    });

    this.initGlobalTransmissionListener();
  }

  initGlobalTransmissionListener() {
    // Listen for incoming broadcasted transmissions
    window.addEventListener('veil:incoming_transmission', (e) => {
      this.displayTransmissionPopup(e.detail.handout);
    });
  }

  // The list (v2.62.0, Hearts in the Void room): dossiers grouped in folders, a search box, and for
  // the Keeper a «Compartir» switch (the players keep a shared dossier in their list) and the
  // «solo Keeper» mark (private notes: never transmitted nor shared, not even by mistake).
  render() {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';
    const handouts = (state.handouts || []).filter(doc => isKeeper || (doc.sharedWithPlayers && !doc.keeperOnly));
    const folders = new Map();
    for (const doc of handouts) {
      const folder = doc.folder || 'Dossiers';
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder).push(doc);
    }
    this.openFolders ??= new Set([...folders.keys()].slice(0, 1));
    const card = doc => `
            <div class="handout-card glass-panel ${doc.keeperOnly ? 'keeper-only' : ''}" data-id="${e(doc.id)}" data-search="${e(`${doc.title} ${doc.sender || ''} ${doc.folder || ''}`.toLowerCase())}">
              <div class="handout-header">
                <span class="handout-title" data-no-i18n>${e(doc.title)}</span>
                ${doc.imageUrl ? '<span class="handout-img-indicator">📷 IMAGE</span>' : ''}
                ${isKeeper && doc.keeperOnly ? '<span class="handout-badge">🔒 SOLO KEEPER</span>' : ''}
                ${isKeeper && !doc.keeperOnly && doc.keeperHtml ? '<span class="handout-badge keeper-notes" title="Tiene una parte «Solo para Keeper» que no se envía">+ NOTAS KEEPER</span>' : ''}
                ${isKeeper && doc.sharedWithPlayers && !doc.keeperOnly ? '<span class="handout-badge shared">COMPARTIDO</span>' : ''}
              </div>
              <div class="handout-meta">
                <span data-no-i18n>${e(doc.sender || 'Command')}</span>
                <span data-no-i18n>${e(doc.timestamp || '')}</span>
              </div>
              <div class="handout-actions">
                <button class="hud-btn hud-btn-xs preview-handout-btn" data-id="${e(doc.id)}">VIEW</button>
                ${isKeeper ? `
                  ${doc.keeperOnly ? '' : `<button class="hud-btn hud-btn-xs hud-btn-primary broadcast-handout-btn" data-id="${e(doc.id)}" title="Broadcast transmission to all players">TRANSMIT 📡</button>
                  <button class="hud-btn hud-btn-xs share-handout-btn" data-id="${e(doc.id)}" aria-pressed="${!!doc.sharedWithPlayers}" title="Los jugadores lo conservan en su lista de dossieres">${doc.sharedWithPlayers ? 'DEJAR DE COMPARTIR' : 'COMPARTIR'}</button>`}
                  <button class="hud-btn hud-btn-xs hud-btn-secondary edit-handout-btn" data-id="${e(doc.id)}">EDIT</button>
                  <button class="hud-btn hud-btn-xs hud-btn-danger delete-handout-btn" data-id="${e(doc.id)}" aria-label="Delete">✕</button>
                ` : ''}
              </div>
            </div>`;

    this.container.innerHTML = sanitizeHTML(`
      <div class="handouts-sidebar-content">
        <div class="sidebar-header-row">
          <span class="sidebar-title">TRANSMISSIONS & DOSSIERS (${handouts.length})</span>
          ${isKeeper ? `
            <button class="hud-btn hud-btn-xs hud-btn-primary" id="new_handout_btn">+ NEW DOSSIER</button>
            ${store.sessionRole !== 'player' && roomModule(state) ? `<button class="hud-btn hud-btn-xs" id="module_update_btn" title="Trae las imágenes, los dossieres y los PNJ nuevos de ${e(MODULES[roomModule(state)].name)} sin tocar tus mapas, posiciones ni relojes">⟳ ACTUALIZAR MÓDULO</button>` : ''}
          ` : ''}
        </div>

        <p class="modal-intro" style="margin: 8px 0;">
          Classified intelligence reports, star charts, mission briefings, and decoded alien archives.
        </p>
        ${handouts.length > 6 ? '<input type="search" class="hud-input handout-search" id="handout_search" placeholder="Buscar dossier…" aria-label="Buscar dossier">' : ''}

        <div class="handouts-list">
          ${handouts.length === 0 ? `
            <div class="log-empty-state">No classified transmissions stored. Create a dossier to broadcast to your crew.</div>
          ` : folders.size === 1 && [...folders.keys()][0] === 'Dossiers' ? handouts.map(card).join('') : [...folders].map(([folder, docs]) => `
            <details class="handout-folder" data-folder="${e(folder)}" ${this.openFolders.has(folder) ? 'open' : ''}>
              <summary><span data-no-i18n>${e(folder)}</span> · ${docs.length}</summary>
              ${docs.map(card).join('')}
            </details>`).join('')}
        </div>
      </div>
    `);

    this.initEvents();
  }

  initEvents() {
    const isKeeper = store.getState().userRole === 'keeper';
    const find = id => store.getState().handouts.find(h => h.id === id);
    this.container.querySelectorAll('.handout-folder').forEach(folder => folder.addEventListener('toggle', () => {
      if (folder.open) this.openFolders.add(folder.dataset.folder); else this.openFolders.delete(folder.dataset.folder);
    }));
    // The search hides what does not match and opens the folders that hold a match (no re-render).
    const search = this.container.querySelector('#handout_search');
    if (search) search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      this.container.querySelectorAll('.handout-card').forEach(c => { c.hidden = !!q && !c.dataset.search.includes(q); });
      this.container.querySelectorAll('.handout-folder').forEach(f => {
        const any = [...f.querySelectorAll('.handout-card')].some(c => !c.hidden);
        f.hidden = !any;
        if (q) f.open = any; else f.open = this.openFolders.has(f.dataset.folder);
      });
    };

    // View Handout
    this.container.querySelectorAll('.preview-handout-btn').forEach(btn => {
      btn.onclick = () => {
        const doc = find(btn.dataset.id);
        if (doc) this.displayTransmissionPopup(doc);
      };
    });

    if (isKeeper) {
      // New Handout
      const newBtn = this.container.querySelector('#new_handout_btn');
      if (newBtn) {
        newBtn.onclick = () => this.openEditorModal();
      }

      // A room made from a module, brought up to date (v2.63.0).
      const updateBtn = this.container.querySelector('#module_update_btn');
      if (updateBtn) updateBtn.onclick = () => this.updateFromModule(updateBtn);

      // Edit Handout
      this.container.querySelectorAll('.edit-handout-btn').forEach(btn => {
        btn.onclick = () => {
          const doc = find(btn.dataset.id);
          if (doc) this.openEditorModal(doc);
        };
      });

      // Delete Handout
      this.container.querySelectorAll('.delete-handout-btn').forEach(btn => {
        btn.onclick = async () => {
          if (await confirmAction('Delete this classified transmission?')) {
            store.deleteHandout(btn.dataset.id);
          }
        };
      });

      // Share with the players: they keep it in their list (a private note can never be shared).
      this.container.querySelectorAll('.share-handout-btn').forEach(btn => {
        btn.onclick = () => {
          const doc = find(btn.dataset.id);
          if (!doc || doc.keeperOnly) return;
          store.updateHandout(doc.id, { sharedWithPlayers: !doc.sharedWithPlayers });
          network.syncAll?.();
          notify(doc.sharedWithPlayers ? `«${doc.title}» ya no está en la lista de los jugadores.` : `«${doc.title}» compartido: los jugadores lo tienen en sus dossieres.`);
        };
      });

      // Broadcast Handout to Players
      this.container.querySelectorAll('.broadcast-handout-btn').forEach(btn => {
        btn.onclick = () => {
          const doc = find(btn.dataset.id);
          if (doc && !doc.keeperOnly) {
            network.broadcast({
              type: 'TRANSMISSION',
              handout: publicDossier(doc)
            });
            audio.playPing();
            this.displayTransmissionPopup(doc);
            store.addLog({
              sender: 'Keeper',
              type: 'TRANSMISSION',
              title: `BROADCAST TRANSMISSION: [${doc.title.toUpperCase()}]`,
              details: 'Classified dossier transmitted to all operative datapads.'
            });
          }
        };
      });
    }
  }

  async updateFromModule(button) {
    const id = roomModule(store.state);
    if (!id) return;
    const name = MODULES[id].name;
    if (!await confirmAction(`Actualizar esta partida con la última versión de ${name}: imágenes, dossieres y PNJ nuevos. Los dossieres del módulo se sustituyen por su versión actual (si editaste alguno, se pierde ese cambio). Tus mapas, las posiciones, los relojes y tus propios dossieres no se tocan.`)) return;
    button.disabled = true;
    try {
      const response = await fetch(`/campaigns/${id}.json`);
      if (!response.ok) throw new Error('No se ha podido descargar el módulo. Comprueba la conexión.');
      const { handouts, tokens, arcs, counts } = mergeModule(store.state, await response.json(), id);
      if (!counts.docsAdded && !counts.docsUpdated && !counts.tokensAdded && !counts.tokensUpdated) { notify(`${name}: la partida ya estaba al día.`); return; }
      store.update({ handouts, tokens, arcs });
      network.syncAll?.();
      notify(`${name} actualizado: ${counts.docsUpdated} dossieres al día y ${counts.docsAdded} nuevos; ${counts.tokensUpdated} PNJ con retrato o descripción al día y ${counts.tokensAdded} nuevos en la reserva.`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  openEditorModal(existingDoc = null) {
    const isEdit = !!existingDoc;
    const modal = document.createElement('div');
    modal.className = 'veil-modal-backdrop';
    modal.innerHTML = sanitizeHTML(`
      <div class="veil-modal-box sheet-modal-box dossier-editor-box">
        <div class="veil-modal-header">
          <h3>${isEdit ? 'EDIT TRANSMISSION FILE' : 'CREATE CLASSIFIED DOSSIER'}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="veil-modal-body">
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label>Dossier Title</label>
              <input type="text" id="doc_title" class="hud-input" placeholder="e.g. Star Chart: Pearl Node #4, Alien Biopsy Log..." value="${existingDoc ? existingDoc.title : 'New Classified Dossier'}" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label>Origin / Source</label>
              <input type="text" id="doc_sender" class="hud-input" placeholder="e.g. Free Fleet Vanguard" value="${existingDoc ? existingDoc.sender : 'Naval Intelligence'}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label>Carpeta</label>
              <input type="text" id="doc_folder" class="hud-input" placeholder="p. ej. Jugadores · Documentos" value="${e(existingDoc?.folder || '')}" />
            </div>
            <label class="checkbox-label" style="flex: 1; align-self: end;"><input type="checkbox" id="doc_keeper_only" ${existingDoc?.keeperOnly ? 'checked' : ''}> Todo el dossier es solo para el Keeper (no se transmite ni se comparte)</label>
          </div>

          <div class="form-group">
            <label>Attached Intel Image (Upload File or URL)</label>
            <div class="form-row">
              <input type="text" id="doc_image_url" class="hud-input" placeholder="Image URL (https://...)" value="${existingDoc ? (existingDoc.imageUrl || '') : ''}" />
              <input type="file" id="doc_image_file" accept="image/*" class="hud-file-input" style="max-width: 200px;" />
            </div>
            <div id="doc_image_preview_box" style="margin-top: 6px; ${existingDoc?.imageUrl ? '' : 'display: none;'}">
              <img src="${existingDoc?.imageUrl || ''}" id="doc_image_preview" alt="Vista previa de la imagen del dossier" style="max-height: 140px; border-radius: 4px; border: 1px solid var(--border-glass);" />
            </div>
          </div>

          <!-- Two parts (v2.63.0, user request): what the players get, and what only the Keeper reads. -->
          <div class="dossier-editor-parts">
            <div class="form-group">
              <label for="doc_content">Para los jugadores <small>(se comparte y se transmite · HTML)</small></label>
              <textarea id="doc_content" class="hud-input" rows="12" style="font-family: monospace; font-size: 12px; line-height: 1.4;"></textarea>
            </div>
            <div class="form-group dossier-keeper-part">
              <label for="doc_keeper">🔒 Solo para Keeper <small>(nunca se envía a los jugadores)</small></label>
              <textarea id="doc_keeper" class="hud-input" rows="12" placeholder="Secretos, motivaciones, qué pasa si…" style="font-family: monospace; font-size: 12px; line-height: 1.4;"></textarea>
            </div>
          </div>

          <div class="modal-actions-row">
            <button class="hud-btn hud-btn-secondary modal-cancel-btn">CANCEL</button>
            <button class="hud-btn hud-btn-primary" id="save_handout_btn">
              ${isEdit ? 'UPDATE DOSSIER' : 'ARCHIVE DOSSIER'}
            </button>
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(modal);
    // Set as values (not inside the markup): the HTML of a dossier is text to edit here.
    modal.querySelector('#doc_content').value = existingDoc ? existingDoc.contentHtml : '<h2>TACTICAL BRIEFING</h2>\n<p>Enter the classified transmission content here...</p>\n<blockquote>Key objective or dangerous warning.</blockquote>';
    modal.querySelector('#doc_keeper').value = existingDoc?.keeperHtml || '';

    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.querySelector('.modal-cancel-btn').onclick = () => modal.remove();

    const fileInput = modal.querySelector('#doc_image_file');
    const urlInput = modal.querySelector('#doc_image_url');
    const previewBox = modal.querySelector('#doc_image_preview_box');
    const previewImg = modal.querySelector('#doc_image_preview');

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const { isConfigured } = getCloudinaryConfig();
        if (isConfigured) {
          try {
            notify('Subiendo imagen de dossier a Cloudinary (Dossier_)...');
            const res = await uploadToCloudinary(file, () => {}, { prefix: 'Dossier_' });
            urlInput.value = res.url;
            previewImg.src = res.url;
            previewBox.style.display = 'block';
            notify('Imagen de dossier subida con éxito a Cloudinary.');
            return;
          } catch (err) {
            notify('No se pudo subir a Cloudinary (' + err.message + '). Usando imagen local.', 'error');
          }
        }
        const reader = new FileReader();
        reader.onload = (re) => {
          urlInput.value = re.target.result;
          previewImg.src = re.target.result;
          previewBox.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    };

    urlInput.oninput = () => {
      if (urlInput.value) {
        previewImg.src = urlInput.value;
        previewBox.style.display = 'block';
      } else {
        previewBox.style.display = 'none';
      }
    };

    modal.querySelector('#save_handout_btn').onclick = () => {
      const title = modal.querySelector('#doc_title').value.trim() || 'Classified Dossier';
      const sender = modal.querySelector('#doc_sender').value.trim() || 'Command';
      const imageUrl = urlInput.value.trim();
      const contentHtml = modal.querySelector('#doc_content').value.trim();
      const keeperHtml = modal.querySelector('#doc_keeper').value.trim();
      const folder = modal.querySelector('#doc_folder').value.trim();
      const keeperOnly = modal.querySelector('#doc_keeper_only').checked;

      if (isEdit) {
        store.updateHandout(existingDoc.id, { title, sender, imageUrl, contentHtml, keeperHtml, folder, keeperOnly, ...(keeperOnly ? { sharedWithPlayers: false } : {}) });
      } else {
        const doc = store.addHandout({ title, sender, imageUrl, contentHtml });
        store.updateHandout(doc.id, { folder, keeperOnly, keeperHtml });
      }

      modal.remove();
    };
  }

  // A dossier written in two languages (v2.62.0, [data-lang] blocks) shows one at a time: the
  // interface's, with ES / EN buttons to switch.
  languageSwitch(popup) {
    const blocks = [...popup.querySelectorAll('.transmission-content-area [data-lang]')];
    const langs = [...new Set(blocks.map(b => b.dataset.lang))];
    if (langs.length < 2) return;
    const bar = document.createElement('div');
    bar.className = 'handout-lang';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Idioma del dossier');
    const show = lang => {
      blocks.forEach(b => { b.hidden = b.dataset.lang !== lang; });
      bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.showLang === lang)));
    };
    for (const lang of langs) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'hud-btn hud-btn-xs'; button.dataset.showLang = lang;
      button.textContent = lang.toUpperCase(); button.setAttribute('data-no-i18n', '');
      button.onclick = () => show(lang);
      bar.append(button);
    }
    (popup.querySelector('.transmission-columns') || popup.querySelector('.transmission-content-area')).before(bar);
    show(langs.includes(currentLanguage()) ? currentLanguage() : langs[0]);
  }

  displayTransmissionPopup(doc) {
    audio.playPing();

    // Check if popup already exists, remove it
    const existing = document.getElementById('active_transmission_popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'active_transmission_popup';
    popup.className = 'veil-modal-backdrop';
    // The Keeper reads the two parts side by side: for the players, and «Solo para Keeper» (v2.63.0).
    // A player's copy never carries the second one (dossierPrivacy).
    const keeperPart = store.state.userRole === 'keeper' && store.sessionRole !== 'player' && !!doc.keeperHtml?.trim();
    popup.innerHTML = sanitizeHTML(`
      <div class="veil-modal-box transmission-popup-box ${keeperPart ? 'has-keeper-part' : ''}">
        <div class="veil-modal-header" style="background: linear-gradient(90deg, #0f172a 0%, #1e1b4b 100%); border-bottom: 2px solid var(--cyan-pearl);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--cyan-pearl); font-size: 16px;">📡</span>
            <h3 style="color: var(--cyan-pearl);" data-no-i18n>${e(doc.title.toUpperCase())}</h3>
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <div class="veil-modal-body transmission-body">
          <div class="transmission-header-bar">
            <span><strong>ORIGIN:</strong> <span data-no-i18n>${e(doc.sender || 'Tactical Net')}</span></span>
            ${doc.timestamp ? `<span><strong>TIMESTAMP:</strong> <span data-no-i18n>${e(doc.timestamp)}</span></span>` : ''}
          </div>

          <div class="transmission-columns">
            <section class="transmission-public">
              ${keeperPart ? '<h4 class="transmission-part-label">PARA LOS JUGADORES</h4>' : ''}
              ${doc.imageUrl ? `
                <div class="transmission-image-frame">
                  <img src="${e(doc.imageUrl)}" class="transmission-attached-img" alt="Imagen adjunta del dossier" />
                </div>
              ` : ''}
              <div class="transmission-content-area">
                ${doc.contentHtml}
              </div>
            </section>
            ${keeperPart ? `
              <section class="transmission-keeper">
                <h4 class="transmission-part-label">🔒 SOLO PARA KEEPER</h4>
                <div class="transmission-content-area">${doc.keeperHtml}</div>
              </section>
            ` : ''}
          </div>

          <div class="modal-actions-row" style="margin-top: 14px;">
            <button class="hud-btn hud-btn-primary modal-close-btn">ACKNOWLEDGE TELEMETRY</button>
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(popup);
    this.languageSwitch(popup);

    popup.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.onclick = () => popup.remove();
    });
    popup.onclick = (e) => {
      if (e.target === popup) popup.remove();
    };
  }
}
