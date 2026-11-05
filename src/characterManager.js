import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { dossierDialog } from './dossierUI.js';
import { parseCharacterJSON, characterKey, initializeImportedResources } from './characterImport.js';
import { createActor } from './actors.js';
import { store } from './state.js';

export function openCharacterImport({ onImport, single = false } = {}) {
  const modal = dossierDialog('IMPORTAR PERSONAJES', `
    <span class="dossier-eyebrow">INGESTA DE FICHAS / VEILFARERS</span><h2 class="dossier-heading">Tu tripulación, con sus datos reales.</h2>
    <p class="dossier-muted">Admite varios JSON de Veilfarers Character Sheet y actores exportados por este VTT, incluidos PNJ y adversarios. Se añadirán a la escena activa.</p>
    <label class="dossier-drop"><strong>Seleccionar fichas JSON</strong><span>Hasta 30 archivos · 2 MB por ficha</span><input type="file" accept=".json,application/json" ${single ? "" : "multiple"} id="actor_files"></label>
    <div id="actor_preview" aria-live="polite"></div><p class="dossier-error" role="alert"></p>
    <footer class="dossier-footer"><span id="actor_count">Sin archivos seleccionados</span><button class="hud-btn hud-btn-primary" id="actor_import" disabled>Importar selección</button></footer>
  `);
  let rows = [], generation = 0;
  const button = modal.querySelector('#actor_import'), preview = modal.querySelector('#actor_preview'), error = modal.querySelector('.dossier-error');
  modal.querySelector('#actor_files').onchange = async event => {
    const ticket = ++generation, files = [...event.target.files];
    rows = []; button.disabled = true; error.textContent = ''; preview.textContent = 'Leyendo fichas…';
    try {
      if (!files.length || files.length > (single ? 1 : 30)) throw new Error('Selecciona entre 1 y 30 fichas.');
      const found = new Map();
      const results = await Promise.all(files.map(async file => {
        if (file.size > 2 * 1024 * 1024) throw new Error(`${file.name}: supera 2 MB.`);
        try {
          const parsed = parseCharacterJSON(await file.text());
          createActor(parsed.token, store.state.activeMapId); // reject malformed native actors before preview
          return { ...parsed, file: file.name };
        } catch (err) { throw new Error(`${file.name}: ${err.message}`); }
      }));
      if (ticket !== generation || !modal.isConnected) return;
      rows = results.map(row => {
        const key = characterKey(row.token), earlier = found.get(key);
        const matches = store.state.tokens.filter(t => characterKey(t) === key);
        found.set(key, row.file);
        return { ...row, earlier, matches };
      });
      preview.innerHTML = sanitizeHTML(rows.map((row, i) => {
        const t = row.token;
        return `<article class="import-card" data-index="${i}"><div class="import-card-top"><div><span class="dossier-eyebrow">${e(row.format)}</span><h3>${e(t.name)}</h3><p>${e([t.species, t.characterClass, t.subclass, t.path].filter(Boolean).join(' · '))}</p></div><vf-select class="hud-select import-action" aria-label="Acción para ${e(t.name)}"><option value="skip" ${row.earlier || row.matches.length ? 'selected' : ''}>Omitir</option><option value="new" ${!row.earlier && !row.matches.length ? 'selected' : ''}>${row.earlier || row.matches.length ? 'Crear otra copia' : 'Crear personaje'}</option>${row.matches.map(m => `<option value="${e(m.id)}">Actualizar ${e(m.name)} · ${e(store.state.maps.find(x => x.id === m.mapId)?.name || '')}</option>`).join('')}</vf-select></div>
          <div class="import-statline"><span>HP <b>${t.hp.max}</b></span><span>STRESS <b>${t.stress?.max ?? 0}</b></span><span>ARMOR <b>${t.armor?.max ?? 0}</b></span><span>EVASION <b>${t.evasion ?? '—'}</b></span><span>UMBRALES <b>${t.hp.majorThreshold ?? '—'} / ${t.hp.severeThreshold ?? '—'}</b></span></div>
          ${row.earlier ? `<p class="import-warning">Posible duplicado de ${e(row.earlier)}. Se omitirá salvo que elijas crear otra copia.</p>` : row.matches.length ? '<p class="import-warning">Este personaje ya está en la sesión. Actualizar sustituye sus datos y recursos; conserva posición, retrato e iluminación.</p>' : ''}
          ${row.warnings.map(w => `<p class="import-warning">${e(w)}</p>`).join('')}
          ${row.missing.length ? `<div class="import-missing"><span class="dossier-eyebrow">RECURSOS AUSENTES · VALORES INICIALES A REVISAR</span><div>${row.missing.map(m => `<label class="dossier-field"><span>${e(m.label)} · 0–${m.max}</span><input type="number" class="hud-input" data-resource="${m.key}" min="0" max="${m.max}" step="1" value="${['hp', 'armor_slots'].includes(m.key) ? m.max : 0}"></label>`).join('')}</div><label class="hud-checkbox-label"><input type="checkbox" class="import-reviewed"> He revisado estos valores; no proceden del JSON.</label></div>` : '<p class="dossier-muted">Recursos actuales conservados del archivo.</p>'}
          <small class="dossier-filename">${e(row.file)}</small></article>`;
      }).join(''));
      button.disabled = false;
      modal.querySelector('#actor_count').textContent = `${rows.length} archivos revisados · duplicados omitidos por defecto`;
    } catch (err) {
      if (ticket !== generation) return;
      preview.textContent = ''; error.textContent = err.message; modal.querySelector('#actor_count').textContent = 'No se ha importado ningún archivo.';
    }
  };
  button.onclick = async () => {
    try {
      const cv = window.veilCanvas, center = cv?.screenToWorld(cv.displayWidth / 2, cv.displayHeight / 2) || { x: 600, y: 400 };
      const entries = [];
      preview.querySelectorAll('.import-card').forEach(card => {
        const row = rows[Number(card.dataset.index)], action = card.querySelector('.import-action').value;
        if (action === 'skip') return;
        if (row.missing.length && !card.querySelector('.import-reviewed').checked) throw new Error(`${row.token.name}: revisa y confirma los recursos ausentes.`);
        const values = Object.fromEntries([...card.querySelectorAll('[data-resource]')].map(input => [input.dataset.resource, input.value]));
        const token = initializeImportedResources(row, values);
        token.x = Math.round(center.x + (entries.length % 5) * 80); token.y = Math.round(center.y + Math.floor(entries.length / 5) * 80);
        entries.push({ token, updateId: action === 'new' ? null : action });
      });
      if (!entries.length) throw new Error('No hay personajes seleccionados para importar.');
      button.disabled = true; modal.dataset.busy = "1";
      const count = onImport ? await onImport(entries) : store.importActors(entries);
      modal.remove(); notify(`${count} personaje${count === 1 ? '' : 's'} importado${count === 1 ? '' : 's'}.`);
    } catch (err) { error.textContent = err.message; } finally { button.disabled = false; delete modal.dataset.busy; }
  };
  return modal;
}
