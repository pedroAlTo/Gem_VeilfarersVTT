import { store } from './state.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as esc, sanitizeHTML, notify } from './ui.js';
import { tokenInventory, validateInventory } from './equipment.js';
import { newId } from './persistence.js';
import {
  filterEquipmentCatalog,
  EQUIPMENT_SOURCES,
  EQUIPMENT_CATEGORIES,
  equipCatalogItem
} from './equipmentLibrary.js';

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

        const inv = tokenInventory(currentTok);
        const updated = equipCatalogItem(inv, itemToEquip);
        validateInventory(updated);

        const updates = { inventory: updated };
        const charLevel = Number(currentTok.level || currentTok.tier || 1);

        // Armor equip: strictly update token Damage Thresholds and Armor Slots
        if (itemToEquip.category === 'armor') {
          if (itemToEquip.majorThreshold && itemToEquip.severeThreshold) {
            updates.hp = {
              ...currentTok.hp,
              majorThreshold: itemToEquip.majorThreshold + charLevel,
              severeThreshold: itemToEquip.severeThreshold + charLevel
            };
          }
          if (itemToEquip.armorSlots) {
            updates.armor = {
              current: itemToEquip.armorSlots,
              max: itemToEquip.armorSlots
            };
          }
        }

        // Augmentation specific stat bonuses
        if (itemToEquip.id === 'core_aug_subdermal_armor') {
          const curMax = currentTok.armor?.max || 0;
          updates.armor = { current: (currentTok.armor?.current || 0) + 1, max: curMax + 1 };
        } else if (itemToEquip.id === 'core_aug_reinforced_bones') {
          const curHpMax = currentTok.hp?.max || 6;
          updates.hp = { ...currentTok.hp, max: curHpMax + 2, current: Math.min(curHpMax + 2, (currentTok.hp?.current || 6) + 2) };
        } else if (itemToEquip.id === 'core_aug_combat_reflexes') {
          updates.evasion = (currentTok.evasion || 10) + 1;
        }

        store.updateToken(tokenId, updates);
        if (store.sessionRole !== 'player') {
          network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId: tokenId, partial: updates });
        }
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

export function mountEquipmentPanel(container, tokenId) {
  function render() {
    const token = store.state.tokens.find(t => t.id === tokenId);
    if (!token) { container.textContent = 'Este actor ya no existe.'; return; }
    const inventory = tokenInventory(token), editable = store.canEditToken(tokenId);
    container.innerHTML = sanitizeHTML(`<div class="inventory-toolbar"><h4 class="dossier-label">ARMAS Y EQUIPO</h4>
      <div style="display: flex; gap: 6px;">
        <button type="button" class="hud-btn hud-btn-primary" data-open-catalog ${editable ? '' : 'disabled'}>Catálogo de Equipo</button>
        <button type="button" class="hud-btn" data-edit-inventory ${editable ? '' : 'disabled'}>Editar inventario</button>
      </div>
    </div>
      <p class="dossier-muted">Preparar daño rellena el panel de dados. Revisa sus propiedades y el objetivo antes de tirar; no consume munición ni aplica efectos automáticamente.</p>
      <div class="dossier-weapons">${inventory.weapons.map(w => `<article><span class="dossier-eyebrow">${esc(w.tier)} · ${w.damageMode === 'final' ? 'DAÑO FINAL' : 'DAÑO BASE'}</span><h4>${esc(w.name)}</h4><div class="weapon-damage">${esc(w.damage || 'Sin daño indicado')}</div><p>${esc([w.trait,w.range].filter(Boolean).join(' · '))}</p><p>${esc(w.features)}</p><button type="button" class="hud-btn hud-btn-primary" data-prepare-weapon="${esc(w.id)}" ${editable && w.damage && !/^(?:n\/?a|none|—|-)$/i.test(w.damage.trim()) ? '' : 'disabled'}>Preparar daño</button></article>`).join('') || '<p class="dossier-muted">Añade un arma o importa tu ficha.</p>'}</div>
      <div class="inventory-items">${inventory.items.map(item => `<article><div><strong>${esc(item.name)}</strong><span>${esc(item.quantity)} × · ${esc(item.tier)}</span></div><p>${esc(item.use)}</p></article>`).join('') || '<p class="dossier-muted">Sin objetos registrados.</p>'}</div>
      <p class="dossier-muted">Los cambios de inventario del VTT se incluyen en Exportar actor VTT y en las sesiones guardadas. Exportar al creador conserva su equipo original.</p>`);
    container.querySelector('[data-open-catalog]')?.addEventListener('click', () => openEquipmentCatalog(tokenId));
    container.querySelector('[data-edit-inventory]')?.addEventListener('click', () => openInventory(tokenId));
    container.querySelectorAll('[data-prepare-weapon]').forEach(button => button.onclick = () => {
      if (!store.canEditToken(tokenId)) { notify('Ya no tienes control de este token.'); return; }
      if (!window.veilDiceRoller) { notify('El panel de dados todavía no está disponible.'); return; }
      if (window.veilDiceRoller.prepareWeapon(tokenId, button.dataset.prepareWeapon)) container.closest('.dossier-backdrop')?.remove();
    });
  }
  const unsubscribe = store.subscribe((_, keys) => { if (!container.isConnected) { unsubscribe(); return; } if (keys.some(k => ['tokens', 'userRole', 'isConnected'].includes(k))) render(); });
  const observer = new MutationObserver(() => { if (!container.isConnected) { unsubscribe(); observer.disconnect(); } }); observer.observe(document.body, { childList:true });
  render();
}
