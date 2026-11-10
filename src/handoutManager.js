import { sanitizeHTML, confirmAction, notify } from './ui.js';
import { getCloudinaryConfig, uploadToCloudinary } from './cloudinaryService.js';
// src/handoutManager.js
// Classified Transmissions, Dossiers, and Enriched Text Handouts with Images

import { store } from './state.js';
import { network } from './networkManager.js';
import { audio } from './audioEngine.js';

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

  render() {
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';
    const handouts = state.handouts || [];

    this.container.innerHTML = sanitizeHTML(`
      <div class="handouts-sidebar-content">
        <div class="sidebar-header-row">
          <span class="sidebar-title">TRANSMISSIONS & DOSSIERS (${handouts.length})</span>
          ${isKeeper ? `
            <button class="hud-btn hud-btn-xs hud-btn-primary" id="new_handout_btn">+ NEW DOSSIER</button>
          ` : ''}
        </div>

        <p class="modal-intro" style="margin: 8px 0;">
          Classified intelligence reports, star charts, mission briefings, and decoded alien archives.
        </p>

        <div class="handouts-list">
          ${handouts.length === 0 ? `
            <div class="log-empty-state">No classified transmissions stored. Create a dossier to broadcast to your crew.</div>
          ` : handouts.map(doc => `
            <div class="handout-card glass-panel" data-id="${doc.id}">
              <div class="handout-header">
                <span class="handout-title">${doc.title}</span>
                ${doc.imageUrl ? '<span class="handout-img-indicator">📷 IMAGE</span>' : ''}
              </div>
              <div class="handout-meta">
                <span>Source: ${doc.sender || 'Command'}</span>
                <span>${doc.timestamp}</span>
              </div>
              <div class="handout-actions">
                <button class="hud-btn hud-btn-xs preview-handout-btn" data-id="${doc.id}">VIEW</button>
                ${isKeeper ? `
                  <button class="hud-btn hud-btn-xs hud-btn-primary broadcast-handout-btn" data-id="${doc.id}" title="Broadcast transmission to all players">
                    TRANSMIT 📡
                  </button>
                  <button class="hud-btn hud-btn-xs hud-btn-secondary edit-handout-btn" data-id="${doc.id}">EDIT</button>
                  <button class="hud-btn hud-btn-xs hud-btn-danger delete-handout-btn" data-id="${doc.id}">✕</button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `);

    this.initEvents();
  }

  initEvents() {
    const isKeeper = store.getState().userRole === 'keeper';

    // View Handout
    this.container.querySelectorAll('.preview-handout-btn').forEach(btn => {
      btn.onclick = () => {
        const docId = btn.dataset.id;
        const doc = store.getState().handouts.find(h => h.id === docId);
        if (doc) this.displayTransmissionPopup(doc);
      };
    });

    if (isKeeper) {
      // New Handout
      const newBtn = this.container.querySelector('#new_handout_btn');
      if (newBtn) {
        newBtn.onclick = () => this.openEditorModal();
      }

      // Edit Handout
      this.container.querySelectorAll('.edit-handout-btn').forEach(btn => {
        btn.onclick = () => {
          const docId = btn.dataset.id;
          const doc = store.getState().handouts.find(h => h.id === docId);
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

      // Broadcast Handout to Players
      this.container.querySelectorAll('.broadcast-handout-btn').forEach(btn => {
        btn.onclick = () => {
          const docId = btn.dataset.id;
          const doc = store.getState().handouts.find(h => h.id === docId);
          if (doc) {
            network.broadcast({
              type: 'TRANSMISSION',
              handout: doc
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

  openEditorModal(existingDoc = null) {
    const isEdit = !!existingDoc;
    const modal = document.createElement('div');
    modal.className = 'veil-modal-backdrop';
    modal.innerHTML = sanitizeHTML(`
      <div class="veil-modal-box sheet-modal-box">
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

          <div class="form-group">
            <label>Attached Intel Image (Upload File or URL)</label>
            <div class="form-row">
              <input type="text" id="doc_image_url" class="hud-input" placeholder="Image URL (https://...)" value="${existingDoc ? (existingDoc.imageUrl || '') : ''}" />
              <input type="file" id="doc_image_file" accept="image/*" class="hud-file-input" style="max-width: 200px;" />
            </div>
            <div id="doc_image_preview_box" style="margin-top: 6px; ${existingDoc?.imageUrl ? '' : 'display: none;'}">
              <img src="${existingDoc?.imageUrl || ''}" id="doc_image_preview" style="max-height: 140px; border-radius: 4px; border: 1px solid var(--border-glass);" />
            </div>
          </div>

          <div class="form-group">
            <label>Enriched Content / Briefing Text (HTML / Markdown supported)</label>
            <textarea id="doc_content" class="hud-input" rows="9" style="font-family: monospace; font-size: 12px; line-height: 1.4;">${existingDoc ? existingDoc.contentHtml : `<h2>TACTICAL BRIEFING</h2>\n<p>Enter the classified transmission content here...</p>\n<blockquote>Key objective or dangerous warning.</blockquote>`}</textarea>
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

      if (isEdit) {
        store.updateHandout(existingDoc.id, { title, sender, imageUrl, contentHtml });
      } else {
        store.addHandout({ title, sender, imageUrl, contentHtml });
      }

      modal.remove();
    };
  }

  displayTransmissionPopup(doc) {
    audio.playPing();

    // Check if popup already exists, remove it
    const existing = document.getElementById('active_transmission_popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'active_transmission_popup';
    popup.className = 'veil-modal-backdrop';
    popup.innerHTML = sanitizeHTML(`
      <div class="veil-modal-box transmission-popup-box">
        <div class="veil-modal-header" style="background: linear-gradient(90deg, #0f172a 0%, #1e1b4b 100%); border-bottom: 2px solid var(--cyan-pearl);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--cyan-pearl); font-size: 16px;">📡</span>
            <h3 style="color: var(--cyan-pearl);">${doc.title.toUpperCase()}</h3>
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <div class="veil-modal-body transmission-body">
          <div class="transmission-header-bar">
            <span><strong>ORIGIN:</strong> ${doc.sender || 'Tactical Net'}</span>
            <span><strong>TIMESTAMP:</strong> ${doc.timestamp}</span>
          </div>

          ${doc.imageUrl ? `
            <div class="transmission-image-frame">
              <img src="${doc.imageUrl}" class="transmission-attached-img" />
            </div>
          ` : ''}

          <div class="transmission-content-area">
            ${doc.contentHtml}
          </div>

          <div class="modal-actions-row" style="margin-top: 14px;">
            <button class="hud-btn hud-btn-primary modal-close-btn">ACKNOWLEDGE TELEMETRY</button>
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(popup);

    popup.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.onclick = () => popup.remove();
    });
    popup.onclick = (e) => {
      if (e.target === popup) popup.remove();
    };
  }
}
