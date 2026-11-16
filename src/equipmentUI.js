import { store } from './state.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as esc, sanitizeHTML, notify } from './ui.js';
import { tokenInventory, validateInventory } from './equipment.js';
import { newId } from './persistence.js';
import { network } from './networkManager.js';
import {
  filterEquipmentCatalog,
  EQUIPMENT_SOURCES,
  EQUIPMENT_CATEGORIES,
  equipCatalogItem
} from './equipmentLibrary.js';

// What equipping a catalog entry changes on the token: the inventory and, for armor and a few
// augmentations, the numbers they set (thresholds are armor + level; Armor Slots follow the armor).
export function catalogEquipUpdates(token, item) {
  const inventory = equipCatalogItem(tokenInventory(token), item);
  validateInventory(inventory);
  const updates = { inventory }, level = Number(token.level || 1);
  if (item.category === 'armor') {
    if (item.majorThreshold && item.severeThreshold) updates.hp = { ...token.hp, majorThreshold: item.majorThreshold + level, severeThreshold: item.severeThreshold + level };
    if (item.armorSlots) updates.armor = { current: item.armorSlots, max: item.armorSlots };
  }
  if (item.id === 'core_aug_subdermal_armor') updates.armor = { current: (token.armor?.current || 0) + 1, max: (token.armor?.max || 0) + 1 };
  else if (item.id === 'core_aug_reinforced_bones') { const max = token.hp?.max || 6; updates.hp = { ...token.hp, max: max + 2, current: Math.min(max + 2, (token.hp?.current || 6) + 2) }; }
  else if (item.id === 'core_aug_combat_reflexes') updates.evasion = (token.evasion || 10) + 1;
  return updates;
}

const input = (label, key, value, attrs = '') => `<label class="dossier-field"><span>${label}</span><input class="hud-input" data-field="${key}" value="${esc(value)}" ${attrs}></label>`;

export function openEquipmentCatalog(tokenId, onEquipped = null) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token || !store.canEditToken(tokenId)) {
    notify('Selecciona uno de tus tokens asignados.');
    return;
  }

  let currentSource = 'all';
  let currentCategory = 'all';
  let searchQuery = '';

  const modal = dossierDialog('CATÁLOGO DE EQUIPO Y AUMENTOS · ' + token.name, `
    <p class="dossier-muted">Combina libremente equipo y tecnología del Reglamento Base (Core) y de especies alienígenas de Rust & Steel (Lithian, Chitinid, Synthet, Voidborn).</p>
    
    <div class="equipment-catalog-filters" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; background: rgba(15, 23, 42, 0.6); padding: 8px; border-radius: 6px; border: 1px solid rgba(0, 243, 255, 0.2);">
      <label class="dossier-field" style="flex: 1; min-width: 140px; margin: 0;">
        <span>Origen / Sistema</span>
        <select class="hud-select" data-catalog-filter="source">
          ${EQUIPMENT_SOURCES.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}
        </select>
      </label>
      
      <label class="dossier-field" style="flex: 1; min-width: 140px; margin: 0;">
        <span>Categoría</span>
        <select class="hud-select" data-catalog-filter="category">
          ${EQUIPMENT_CATEGORIES.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
        </select>
      </label>
      
      <label class="dossier-field" style="flex: 2; min-width: 180px; margin: 0;">
        <span>Búsqueda</span>
        <input class="hud-input" type="search" data-catalog-filter="query" placeholder="Buscar armas, implantes, equipo..." />
      </label>
    </div>

    <div class="equipment-catalog-results" style="max-height: 440px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;"></div>
    
    <footer class="dossier-footer" style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
      <span class="dossier-muted catalog-count-text"></span>
      <button class="hud-btn hud-btn-secondary" type="button" data-close-catalog>Cerrar catálogo</button>
    </footer>
  `);

  const resultsContainer = modal.querySelector('.equipment-catalog-results');
  const countText = modal.querySelector('.catalog-count-text');

  function renderList() {
    const items = filterEquipmentCatalog({
      source: currentSource,
      category: currentCategory,
      query: searchQuery
    });

    countText.textContent = `${items.length} elementos encontrados`;

    if (!items.length) {
      resultsContainer.innerHTML = sanitizeHTML(`
        <div style="text-align: center; padding: 24px; color: #64748b; font-style: italic;">
          No se encontraron elementos con los filtros seleccionados.
        </div>
      `);
      return;
    }

    resultsContainer.innerHTML = sanitizeHTML(items.map(item => {
      const isWeapon = item.category === 'weapons';
      const isAugment = item.category === 'augmentations';
      const isArmor = item.category === 'armor';
      const isDroneMod = item.category === 'drone_modules';

      const sourceBadgeColor = item.source === 'rust_and_steel' ? '#f59e0b' : '#00f3ff';
      const sourceBadgeLabel = item.source === 'rust_and_steel' ? 'RUST & STEEL' : 'CORE';

      return `
        <article class="glass-panel" style="padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(10, 15, 26, 0.7); display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div>
              <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 2px;">
                <span class="roster-badge" style="background: rgba(0,0,0,0.5); color: ${sourceBadgeColor}; border: 1px solid ${sourceBadgeColor}; font-size: 9px; padding: 1px 6px;">
                  ${sourceBadgeLabel}
                </span>
                <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">
                  ${esc(item.tier)}
                </span>
                ${item.species ? `<span style="font-size: 10px; color: #fbbf24; font-weight: 600;">[${esc(item.species)}]</span>` : ''}
              </div>
              <h4 style="margin: 0; color: #fff; font-size: 13px;">${esc(item.name)}</h4>
            </div>
            <button class="hud-btn hud-btn-xs hud-btn-primary" type="button" data-equip-id="${esc(item.id)}" style="white-space: nowrap;">
              ➕ Equipar
            </button>
          </div>

          ${isWeapon ? `
            <div style="font-size: 11px; display: flex; flex-wrap: wrap; gap: 8px; color: #38bdf8; font-weight: bold; background: rgba(56, 189, 248, 0.1); padding: 4px 6px; border-radius: 4px;">
              <span>⚔️ Daño: ${esc(item.damage)}</span>
              <span>Atributo: ${esc(item.trait)}</span>
              <span>Rango: ${esc(item.range)}</span>
              ${item.burden ? `<span>Carga: ${item.burden}</span>` : ''}
            </div>
            <p style="margin: 0; font-size: 11px; color: #cbd5e1; line-height: 1.4;">${esc(item.features)}</p>
          ` : isArmor ? `
            <div style="font-size: 11px; display: flex; flex-wrap: wrap; gap: 8px; color: #34d399; font-weight: bold; background: rgba(52, 211, 153, 0.1); padding: 4px 6px; border-radius: 4px;">
              ${item.majorThreshold ? `<span>🛡️ Umbrales: Mayor ${item.majorThreshold} / Severo ${item.severeThreshold} (+ Nivel)</span>` : ''}
              <span>+${item.armorSlots} Slot${item.armorSlots > 1 ? 's' : ''} Armadura</span>
              ${item.burden ? `<span>Carga: ${item.burden}</span>` : ''}
            </div>
            <p style="margin: 0; font-size: 11px; color: #cbd5e1; line-height: 1.4;">
              ${esc(item.use || item.features || '')}
            </p>
          ` : isAugment ? `
            <div style="font-size: 11px; display: flex; flex-wrap: wrap; gap: 8px; color: #f472b6; font-weight: bold; background: rgba(244, 114, 182, 0.1); padding: 4px 6px; border-radius: 4px;">
              <span>🧬 Capacidad: 1 pt</span>
              <span>Coste Estrés: ${item.stressCost ? item.stressCost + ' ⚡' : '0 (Pasivo)'}</span>
              ${item.cost ? `<span>Coste: ${esc(item.cost)}</span>` : ''}
            </div>
            ${item.benefit ? `<p style="margin: 0; font-size: 11px; color: #a7f3d0; line-height: 1.4;"><strong>Beneficio:</strong> ${esc(item.benefit)}</p>` : ''}
            ${item.drawback ? `<p style="margin: 0; font-size: 10px; color: #fca5a5; line-height: 1.3;"><strong>Peaje:</strong> ${esc(item.drawback)}</p>` : ''}
          ` : isDroneMod ? `
            <div style="font-size: 11px; display: flex; flex-wrap: wrap; gap: 8px; color: #a78bfa; font-weight: bold; background: rgba(167, 139, 250, 0.1); padding: 4px 6px; border-radius: 4px;">
              <span>🤖 Ranuras de Dron: ${item.slots} Slot${item.slots !== 1 ? 's' : ''}</span>
              <span>Grado: ${esc(item.tier)}</span>
              ${item.cost ? `<span>Coste: ${esc(item.cost)}</span>` : ''}
            </div>
            <p style="margin: 0; font-size: 11px; color: #cbd5e1; line-height: 1.4;">${esc(item.effect || item.use || '')}</p>
          ` : `
            <p style="margin: 0; font-size: 11px; color: #cbd5e1; line-height: 1.4;">
              ${esc(item.use || item.features || '')}
            </p>
          `}
        </article>
      `;
    }).join(''));

    resultsContainer.querySelectorAll('[data-equip-id]').forEach(btn => {
      btn.onclick = () => {
        const itemToEquip = items.find(it => it.id === btn.dataset.equipId);
        if (!itemToEquip) return;

        const currentTok = store.state.tokens.find(t => t.id === tokenId);
        if (!currentTok || !store.canEditToken(tokenId)) {
          notify('Ya no tienes control de este token.');
          return;
        }

        const updates = catalogEquipUpdates(currentTok, itemToEquip), updated = updates.inventory;
        store.updateToken(tokenId, updates);
        if (store.sessionRole !== 'player') network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId: tokenId, partial: updates });
        if (onEquipped) onEquipped(updated);
        notify(`"${itemToEquip.name}" equipado a ${currentTok.name}.`);
      };
    });
  }

  modal.querySelector('[data-catalog-filter="source"]').onchange = (e) => {
    currentSource = e.target.value;
    renderList();
  };

  modal.querySelector('[data-catalog-filter="category"]').onchange = (e) => {
    currentCategory = e.target.value;
    renderList();
  };

  const queryInput = modal.querySelector('[data-catalog-filter="query"]');
  queryInput.oninput = () => {
    searchQuery = queryInput.value;
    renderList();
  };

  modal.querySelector('[data-close-catalog]').onclick = () => modal.remove();

  renderList();
  return modal;
}

export function openInventory(tokenId) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token || !store.canEditToken(tokenId)) { notify('Selecciona uno de tus tokens asignados.'); return; }
  let draft = tokenInventory(token);
  const before = JSON.stringify(draft);
  const modal = dossierDialog('Inventario · ' + token.name, `
    <p class="dossier-muted">El inventario se guarda en la sesión y en Exportar actor VTT. El JSON original del creador se conserva intacto. Las propiedades especiales siguen su texto.</p>
    <div style="margin-bottom: 12px; display: flex; justify-content: flex-end;">
      <button type="button" class="hud-btn hud-btn-primary" id="open_catalog_from_inv_btn">📦 Abrir Catálogo (Core & Alien Rust & Steel)</button>
    </div>
    <form data-inventory-form><div class="inventory-toolbar"><h4>Armas y ataques</h4><button type="button" class="hud-btn" data-add="weapons">+ Arma</button></div><div data-rows="weapons"></div>
    <div class="inventory-toolbar"><h4>Equipo</h4><button type="button" class="hud-btn" data-add="items">+ Objeto</button></div><div data-rows="items"></div>
    <p class="dossier-error" role="alert"></p><footer class="dossier-footer"><button class="hud-btn hud-btn-primary" type="submit">Guardar inventario</button></footer></form>`);
  const error = message => { modal.querySelector('.dossier-error').textContent = message; };

  modal.querySelector('#open_catalog_from_inv_btn')?.addEventListener('click', () => {
    openEquipmentCatalog(tokenId, (newInv) => {
      draft = structuredClone(newInv);
      render();
    });
  });

  function render() {
    for (const kind of ['weapons', 'items']) {
      const list = modal.querySelector(`[data-rows="${kind}"]`);
      list.innerHTML = sanitizeHTML(draft[kind].map((row, i) => `<section class="inventory-edit-row" data-row="${i}"><div class="inventory-toolbar"><span>${kind === 'weapons' ? 'Arma' : 'Objeto'} ${i + 1}</span><button type="button" class="hud-btn" data-remove="${i}" aria-label="Quitar ${esc(row.name || 'fila ' + (i+1))}">Quitar</button></div>
        <div class="inventory-fields">${input('Nombre', 'name', row.name, 'required maxlength="200"')}${input('Tier / categoría', 'tier', row.tier, 'maxlength="100"')}
        ${kind === 'weapons' ? `${input('Expresión de daño', 'damage', row.damage, 'maxlength="1000" placeholder="Ej.: d8+1 phys."')}<label class="dossier-field"><span>Cálculo de daño</span><vf-select class="hud-select" data-field="damageMode"><option value="base" ${row.damageMode === 'base' ? 'selected' : ''}>Base · añadir Proficiency / Honed Edge</option><option value="final" ${row.damageMode === 'final' ? 'selected' : ''}>Final · ya incluye bonificaciones</option></vf-select></label>${input('Trait', 'trait', row.trait, 'maxlength="150"')}${input('Alcance', 'range', row.range, 'maxlength="150"')}` : input('Cantidad', 'quantity', row.quantity, 'type="number" min="0" max="999999" step="1" required')}
        </div><label class="dossier-field"><span>${kind === 'weapons' ? 'Propiedades / efectos' : 'Uso / notas'}</span><textarea class="hud-input" data-field="${kind === 'weapons' ? 'features' : 'use'}" rows="3" maxlength="10000">${esc(row.features ?? row.use)}</textarea></label></section>`).join('') || '<p class="dossier-muted">Todavía no hay entradas.</p>');
      list.querySelectorAll('[data-row]').forEach(element => {
        const index = Number(element.dataset.row);
        element.querySelectorAll('[data-field]').forEach(field => {
          field.oninput = field.onchange = () => { draft[kind][index][field.dataset.field] = field.value; };
        });
        element.querySelector('[data-remove]').onclick = () => { draft[kind].splice(index, 1); render(); };
      });
    }
  }
  modal.querySelectorAll('[data-add]').forEach(button => button.onclick = () => {
    const kind = button.dataset.add;
    if (draft[kind].length >= (kind === 'weapons' ? 40 : 100)) { error('Se ha alcanzado el límite de entradas.'); return; }
    draft[kind].push(kind === 'weapons' ? { id: newId(), name:'', tier:'', damage:'', damageMode:'base', trait:'', range:'', features:'' } : { id:newId(), name:'', tier:'', quantity:'1', use:'' });
    render(); modal.querySelector(`[data-rows="${kind}"] [data-row]:last-child input`).focus();
  });
  modal.querySelector('form').onsubmit = event => {
    event.preventDefault();
    try {
      const current = store.state.tokens.find(t => t.id === tokenId);
      if (!current || !store.canEditToken(tokenId)) throw new Error('Ya no tienes control de este token.');
      if (JSON.stringify(tokenInventory(current)) !== before) throw new Error('El inventario ha cambiado en otra ventana. Cierra y vuelve a abrir para editar la versión actual.');
      validateInventory(draft);
      store.updateToken(tokenId, { inventory: structuredClone(draft) });
      modal.remove(); notify(store.sessionRole === 'player' ? 'Inventario enviado al Keeper.' : 'Inventario guardado.');
    } catch (e) { error(e.message); }
  };
  render(); return modal;
}

const CHIPS = [['all', 'Todo'], ['weapons', 'Armas'], ['armor', 'Armadura'], ['gear', 'Equipo'], ['augmentations', 'Aumentos']];
const TRAIT_OPTIONS = ['Agility', 'Strength', 'Finesse', 'Instinct', 'Presence', 'Knowledge'];
const RANGE_OPTIONS = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];
const catalogLine = item => item.category === 'weapons' ? [item.damage, item.trait, item.range].filter(Boolean).join(' · ')
  : item.category === 'armor' ? [item.majorThreshold && `Umbrales ${item.majorThreshold}/${item.severeThreshold} + nivel`, item.armorSlots && `${item.armorSlots} Armor Slot${item.armorSlots > 1 ? 's' : ''}`].filter(Boolean).join(' · ')
  : (item.benefit || item.use || item.features || item.effect || '');
const options = (list, value) => [...new Set([...(value && !list.includes(value) ? [value] : []), ...list])].map(o => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('');

// The equipment tab: everything is done in place. Search and add from the catalog, change a
// quantity with − and +, edit or remove an entry on its own row. Each change is saved at once.
export function mountEquipmentPanel(container, tokenId) {
  const ui = { query: '', category: 'all', editing: null, confirming: null, draft: null }; // draft: a new entry being written, not saved yet
  container.innerHTML = sanitizeHTML(`
    <section class="equip-add">
      <label class="dossier-field"><span>Añadir equipo</span><input class="hud-input" type="search" data-equip-search placeholder="Busca un arma, armadura, objeto o aumento…" autocomplete="off" /></label>
      <div class="equip-chips" role="group" aria-label="Categoría">${CHIPS.map(([id, label]) => `<button type="button" class="equip-chip ${id === 'all' ? 'active' : ''}" data-equip-category="${id}">${label}</button>`).join('')}<span class="equip-chips-gap"></span><button type="button" class="equip-chip" data-equip-custom="weapons">+ Arma propia</button><button type="button" class="equip-chip" data-equip-custom="items">+ Objeto propio</button></div>
      <div class="equip-results" data-equip-results></div>
    </section>
    <div data-equip-lists></div>
    <p class="dossier-error" role="alert" data-equip-error></p>
    <p class="dossier-muted equip-foot">Los cambios se guardan al momento, en la sesión y en Exportar actor VTT. <button type="button" class="equip-link" data-edit-inventory>Abrir el editor completo</button></p>`);
  const q = selector => container.querySelector(selector);
  const current = () => store.state.tokens.find(t => t.id === tokenId);
  const fail = message => { q('[data-equip-error]').textContent = message || ''; };

  // One change, validated and saved; the lists redraw from the store.
  const save = (change, done = '') => {
    const token = current();
    if (!token || !store.canEditToken(tokenId)) { fail('Ya no tienes control de este token.'); return false; }
    try {
      const inventory = tokenInventory(token); change(inventory); validateInventory(inventory);
      store.updateToken(tokenId, { inventory });
      if (store.sessionRole !== 'player') network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId, partial: { inventory } });
      fail(''); if (done) notify(done);
      return true;
    } catch (error) { fail(error.message); return false; }
  };

  function renderResults() {
    const editable = !!current() && store.canEditToken(tokenId), box = q('[data-equip-results]');
    q('[data-equip-search]').disabled = !editable;
    if (!editable || (!ui.query.trim() && ui.category === 'all')) { box.innerHTML = sanitizeHTML(editable ? '<p class="dossier-muted">Escribe un nombre o elige una categoría para ver el catálogo.</p>' : ''); return; }
    const found = filterEquipmentCatalog({ source: 'all', category: ui.category, query: ui.query }).filter(item => item.category !== 'drone_modules'), shown = found.slice(0, 8);
    box.innerHTML = sanitizeHTML(shown.map(item => `<div class="equip-result"><div><strong>${esc(item.name)}</strong> <em>${esc(item.tier || '')}${item.source === 'rust_and_steel' ? ' · Rust & Steel' : ''}</em><small>${esc(catalogLine(item))}</small></div><button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-equip-add="${esc(item.id)}">Añadir</button></div>`).join('')
      + (found.length > shown.length ? `<p class="dossier-muted">${found.length - shown.length} más: escribe algo más para afinar.</p>` : '') || '<p class="dossier-muted">Nada en el catálogo con ese nombre. Puedes crearlo con «+ Arma propia» o «+ Objeto propio».</p>');
    box.querySelectorAll('[data-equip-add]').forEach(button => button.onclick = () => {
      const token = current(), item = found.find(x => x.id === button.dataset.equipAdd);
      if (!token || !item || !store.canEditToken(tokenId)) { fail('Ya no tienes control de este token.'); return; }
      try {
        const updates = catalogEquipUpdates(token, item);
        store.updateToken(tokenId, updates);
        if (store.sessionRole !== 'player') network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId, partial: updates });
        fail(''); notify(`${item.name} añadido${item.category === 'armor' ? ': umbrales y Armor Slots actualizados' : ''}.`);
      } catch (error) { fail(error.message); }
    });
  }

  const editor = (kind, row) => kind === 'weapons' ? `
    <div class="equip-edit" data-equip-form="${esc(row.id)}">
      <div class="inventory-fields">${input('Nombre', 'name', row.name, 'required maxlength="200"')}${input('Daño', 'damage', row.damage, 'maxlength="1000" placeholder="d8+1 phys"')}
        <label class="dossier-field"><span>Trait</span><select class="hud-select" data-field="trait">${options(TRAIT_OPTIONS, row.trait)}</select></label>
        <label class="dossier-field"><span>Alcance</span><select class="hud-select" data-field="range">${options(RANGE_OPTIONS, row.range)}</select></label></div>
      <label class="equip-check"><input type="checkbox" data-field="damageMode" ${row.damageMode === 'final' ? 'checked' : ''} /> El daño escrito ya incluye Proficiency y Honed Edge (no sumarlos otra vez)</label>
      <label class="dossier-field"><span>Propiedades</span><textarea class="hud-input" data-field="features" rows="2" maxlength="10000">${esc(row.features)}</textarea></label>
      <div class="equip-actions"><button class="hud-btn hud-btn-primary" type="button" data-equip-save>Guardar</button><button class="hud-btn" type="button" data-equip-cancel>Cancelar</button></div>
    </div>` : `
    <div class="equip-edit" data-equip-form="${esc(row.id)}">
      <div class="inventory-fields">${input('Nombre', 'name', row.name, 'required maxlength="200"')}${input('Cantidad', 'quantity', row.quantity, 'type="number" min="0" max="999999" step="1" required')}</div>
      <label class="dossier-field"><span>Para qué sirve</span><textarea class="hud-input" data-field="use" rows="2" maxlength="10000">${esc(row.use)}</textarea></label>
      <div class="equip-actions"><button class="hud-btn hud-btn-primary" type="button" data-equip-save>Guardar</button><button class="hud-btn" type="button" data-equip-cancel>Cancelar</button></div>
    </div>`;
  const rowButtons = (row, editable) => `<button type="button" class="hud-btn hud-btn-xs" data-equip-edit="${esc(row.id)}" ${editable ? '' : 'disabled'}>Editar</button><button type="button" class="hud-btn hud-btn-xs ${ui.confirming === row.id ? 'hud-btn-danger' : ''}" data-equip-remove="${esc(row.id)}" ${editable ? '' : 'disabled'}>${ui.confirming === row.id ? '¿Quitar?' : 'Quitar'}</button>`;

  function renderLists() {
    const token = current(), box = q('[data-equip-lists]');
    if (!token) { box.textContent = 'Este actor ya no existe.'; return; }
    const inventory = tokenInventory(token), editable = store.canEditToken(tokenId);
    q('[data-edit-inventory]').disabled = !editable;
    for (const button of container.querySelectorAll('[data-equip-custom]')) button.disabled = !editable;
    const usable = w => editable && w.damage && !/^(?:n\/?a|none|—|-)$/i.test(w.damage.trim());
    box.innerHTML = sanitizeHTML(`
      <h4 class="dossier-label">ARMAS · ${inventory.weapons.length}</h4>
      <div class="equip-list">${inventory.weapons.map(w => ui.editing === w.id ? editor('weapons', w) : `<article class="equip-row"><div class="equip-main"><strong>${esc(w.name || 'Arma sin nombre')}</strong><span class="equip-damage">${esc(w.damage || 'Sin daño')}</span><em>${esc([w.trait, w.range, w.damageMode === 'final' ? 'daño final' : ''].filter(Boolean).join(' · '))}</em>${w.features ? `<small>${esc(w.features)}</small>` : ''}</div><div class="equip-actions"><button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-prepare-weapon="${esc(w.id)}" ${usable(w) ? '' : 'disabled'} title="Lleva esta arma al panel de dados para atacar">Atacar</button>${rowButtons(w, editable)}</div></article>`).join('') + (ui.draft?.kind === 'weapons' ? editor('weapons', ui.draft.row) : '') || '<p class="dossier-muted">Sin armas. Búscalas arriba o crea una con «+ Arma propia».</p>'}</div>
      <h4 class="dossier-label">EQUIPO · ${inventory.items.length}</h4>
      <div class="equip-list">${inventory.items.map(item => ui.editing === item.id ? editor('items', item) : `<article class="equip-row"><div class="equip-main"><strong>${esc(item.name || 'Objeto sin nombre')}</strong>${item.tier ? `<em>${esc(item.tier)}</em>` : ''}${item.use ? `<small>${esc(item.use)}</small>` : ''}</div><div class="equip-actions"><span class="equip-qty"><button type="button" class="hud-btn hud-btn-xs" data-equip-qty="${esc(item.id)}" data-delta="-1" ${editable ? '' : 'disabled'} aria-label="Una unidad menos de ${esc(item.name)}">−</button><b>${esc(item.quantity)}</b><button type="button" class="hud-btn hud-btn-xs" data-equip-qty="${esc(item.id)}" data-delta="1" ${editable ? '' : 'disabled'} aria-label="Una unidad más de ${esc(item.name)}">+</button></span>${rowButtons(item, editable)}</div></article>`).join('') + (ui.draft?.kind === 'items' ? editor('items', ui.draft.row) : '') || '<p class="dossier-muted">Sin objetos. Búscalos arriba o crea uno con «+ Objeto propio».</p>'}</div>`);
    box.querySelectorAll('[data-prepare-weapon]').forEach(button => button.onclick = () => {
      if (!store.canEditToken(tokenId)) { notify('Ya no tienes control de este token.'); return; }
      if (!window.veilDiceRoller) { notify('El panel de dados todavía no está disponible.'); return; }
      if (window.veilDiceRoller.prepareWeapon(tokenId, button.dataset.prepareWeapon)) container.closest('.dossier-backdrop')?.remove();
    });
    box.querySelectorAll('[data-equip-qty]').forEach(button => button.onclick = () => save(inv => { const item = inv.items.find(i => i.id === button.dataset.equipQty); if (item) item.quantity = String(Math.max(0, Math.min(999999, (Number(item.quantity) || 0) + Number(button.dataset.delta)))); }));
    box.querySelectorAll('[data-equip-edit]').forEach(button => button.onclick = () => { ui.editing = button.dataset.equipEdit; ui.confirming = null; renderLists(); box.querySelector('[data-equip-form] input')?.focus(); });
    // Removing asks once, on the same button, so a slip of the finger deletes nothing.
    box.querySelectorAll('[data-equip-remove]').forEach(button => button.onclick = () => {
      const id = button.dataset.equipRemove;
      if (ui.confirming !== id) { ui.confirming = id; renderLists(); return; }
      ui.confirming = null;
      save(inv => { inv.weapons = inv.weapons.filter(w => w.id !== id); inv.items = inv.items.filter(i => i.id !== id); }, 'Quitado del inventario.');
    });
    const form = box.querySelector('[data-equip-form]');
    if (form) {
      form.querySelector('[data-equip-cancel]').onclick = () => { ui.editing = null; ui.draft = null; fail(''); renderLists(); };
      // The sheet is itself a form, so this editor cannot be one: Enter in a field saves it.
      form.onkeydown = event => { if (event.key === 'Enter' && event.target.tagName === 'INPUT') { event.preventDefault(); event.stopPropagation(); form.querySelector('[data-equip-save]').click(); } };
      form.querySelector('[data-equip-save]').onclick = () => {
        const id = ui.editing, values = {};
        for (const field of form.querySelectorAll('[data-field]')) values[field.dataset.field] = field.type === 'checkbox' ? (field.checked ? 'final' : 'base') : field.value.trim();
        if (!values.name) { fail('Ponle un nombre.'); return; }
        const draft = ui.draft;
        ui.editing = null; ui.draft = null;
        const saved = draft
          ? save(inv => { inv[draft.kind].push({ ...draft.row, ...values }); }, `${values.name} añadido.`)
          : save(inv => { const row = [...inv.weapons, ...inv.items].find(r => r.id === id); if (row) Object.assign(row, values); });
        if (!saved) { ui.editing = id; ui.draft = draft && { kind: draft.kind, row: { ...draft.row, ...values } }; renderLists(); }
      };
    }
  }

  const search = q('[data-equip-search]');
  search.oninput = () => { ui.query = search.value; renderResults(); };
  container.querySelectorAll('[data-equip-category]').forEach(button => button.onclick = () => {
    ui.category = button.dataset.equipCategory;
    container.querySelectorAll('[data-equip-category]').forEach(b => b.classList.toggle('active', b === button));
    renderResults();
  });
  container.querySelectorAll('[data-equip-custom]').forEach(button => button.onclick = () => {
    const kind = button.dataset.equipCustom, id = newId();
    const row = kind === 'weapons' ? { id, name: '', tier: '', damage: '', damageMode: 'base', trait: 'Agility', range: 'Close', features: '' } : { id, name: '', tier: '', quantity: '1', use: '' };
    // The new entry is written first and only saved with a name: cancelling leaves no trace.
    if (!current() || !store.canEditToken(tokenId)) return;
    ui.draft = { kind, row }; ui.editing = id; ui.confirming = null; renderLists();
    q('[data-equip-form] input')?.focus();
  });
  q('[data-edit-inventory]').onclick = () => openInventory(tokenId);

  const unsubscribe = store.subscribe((_, keys) => { if (!container.isConnected) { unsubscribe(); return; } if (keys.some(k => ['tokens', 'userRole', 'isConnected'].includes(k))) { if (!ui.editing || !container.contains(document.activeElement)) renderLists(); renderResults(); } });
  const observer = new MutationObserver(() => { if (!container.isConnected) { unsubscribe(); observer.disconnect(); } }); observer.observe(document.body, { childList:true });
  renderResults(); renderLists();
}
