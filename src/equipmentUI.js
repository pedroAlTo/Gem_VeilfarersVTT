import { tagLabel, weaponTagList } from './weaponTags.js';
const tagLine = row => weaponTagList(row).map(tagLabel).join(', ');
import { store } from './state.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as esc, sanitizeHTML, notify } from './ui.js';
import { tokenInventory, validateInventory } from './equipment.js';
import { newId } from './persistence.js';
import { network } from './networkManager.js';
import { cardData, loadCardData } from './cardData.js';
import { characterAccess, competence } from './techAccess.js';
import {
  filterEquipmentCatalog,
  EQUIPMENT_SOURCES,
  EQUIPMENT_CATEGORIES,
  equipCatalogItem
} from './equipmentLibrary.js';

import { equipmentThumbnail } from './equipmentArtwork.js';
import { installGear, gearKind, installedAugments, augmentRule, catalogEntry, effectsLine, augmentCapacity, overCapacity } from './gear.js';

// What equipping a catalog entry changes on the token. Armor and augmentations go through the
// gear rules (gear.js: thresholds, Armor Slots, augment effects, capacity); the rest is inventory.
export function catalogEquipUpdates(token, item) {
  if (item.category === 'armor' || item.category === 'augmentations') return installGear(token, tokenInventory(token), item);
  const inventory = equipCatalogItem(tokenInventory(token), item);
  validateInventory(inventory);
  return { inventory };
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

    <label class="equip-check equip-mine"><input type="checkbox" data-catalog-mine checked /> Solo lo que puedo usar (clase, nivel y Technology Access)</label>
    <p class="dossier-muted equip-access" data-catalog-access></p>
    <div class="equipment-catalog-results" style="max-height: 440px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;"></div>
    
    <footer class="dossier-footer" style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
      <span class="dossier-muted catalog-count-text"></span>
      <button class="hud-btn hud-btn-secondary" type="button" data-close-catalog>Cerrar catálogo</button>
    </footer>
  `);

  const resultsContainer = modal.querySelector('.equipment-catalog-results');
  const countText = modal.querySelector('.catalog-count-text');

  let onlyMine = true;
  function renderList() {
    const data = cardData(), access = characterAccess(token, data);
    modal.querySelector('[data-catalog-access]').textContent = accessLine(access);
    const check = item => competence(item, token, data, access);
    const items = filterEquipmentCatalog({
      source: currentSource,
      category: currentCategory,
      query: searchQuery
    }).filter(item => !onlyMine || check(item).ok);

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
              <h4 style="margin: 0; color: #fff; font-size: 13px;">${esc(item.name)} ${outsideBadge(check(item))}</h4>
            </div>
            ${equipmentThumbnail(item)}<button class="hud-btn hud-btn-xs hud-btn-primary" type="button" data-equip-id="${esc(item.id)}" style="white-space: nowrap;">
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
  modal.querySelector('[data-catalog-mine]').onchange = event => { onlyMine = event.target.checked; renderList(); };
  if (!cardData()) loadCardData().then(() => { if (modal.isConnected) renderList(); }).catch(() => {});

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
        ${kind === 'weapons' ? `${input('Expresión de daño', 'damage', row.damage, 'maxlength="1000" placeholder="Ej.: d8+1 phys."')}<label class="dossier-field"><span>Cálculo de daño</span><vf-select class="hud-select" data-field="damageMode"><option value="base" ${row.damageMode === 'base' ? 'selected' : ''}>Base · añadir Proficiency / Honed Edge</option><option value="final" ${row.damageMode === 'final' ? 'selected' : ''}>Final · ya incluye bonificaciones</option></vf-select></label>${input('Trait', 'trait', row.trait, 'maxlength="150"')}${input('Alcance', 'range', row.range, 'maxlength="150"')}${input('Tags (reglas)', 'tags', tagLine(row), 'maxlength="600" placeholder="Ej.: Reliable, Armor Piercing 2, Reach"')}` : input('Cantidad', 'quantity', row.quantity, 'type="number" min="0" max="999999" step="1" required')}
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
// The character's training, in one line; and the badge for gear outside it.
export const accessLine = access => access ? `${access.className} · nivel ${access.level} · ${access.tierName}: ${access.summary}` : '';
export const outsideBadge = check => check && !check.ok ? `<span class="equip-outside" title="${esc(check.reason)}">Fuera de tu competencia · Desventaja</span>` : '';

// The equipment tab (v2.28.0, user decision 21 Nov 2026): what the character carries comes first,
// in four blocks (Armas, Armadura, Aumentos, Equipo); each block has its own «+ Añadir», which
// opens the catalog already filtered, apart. Armor and augmentations change the character's
// numbers, so the table puts them on and takes them off (GEAR_INSTALL / GEAR_REMOVE).
const BLOCKS = [
  { id: 'weapons', title: 'Armas', category: 'weapons', custom: 'weapons', empty: 'Sin armas.' },
  { id: 'armor', title: 'Armadura', category: 'armor', empty: 'Sin armadura: umbrales naturales y ningún Armor Slot propio.' },
  { id: 'augment', title: 'Aumentos', category: 'augmentations', empty: 'Sin aumentos instalados.' },
  { id: 'gear', title: 'Equipo', category: 'gear', custom: 'items', empty: 'Sin objetos.' },
];
const ADD_TITLES = { weapons: 'un arma', armor: 'una armadura', augmentations: 'un aumento', gear: 'equipo' };
// A tag's rule, from the glossary (Corebook): «Armor Piercing 2» → the text of Armor Piercing.
const tagRule = tag => { const defs = cardData()?.features || {}, label = tagLabel(tag); return defs[label] || defs[label.replace(/[+\s]*\d+$/, '').trim()] || ''; };

export function mountEquipmentPanel(container, tokenId) {
  // adding: the catalog category being browsed (null: the panel is closed). menu: the row whose
  // «⋯» is open. tag: the weapon tag whose rule is shown. onlyMine: Technology Access filter.
  const ui = { query: '', adding: null, editing: null, confirming: null, draft: null, onlyMine: true, menu: null, tag: null, open: new Set() };
  container.innerHTML = sanitizeHTML(`
    <section class="equip-add" data-equip-panel hidden>
      <header class="equip-add-head"><strong data-equip-panel-title>Añadir</strong><button type="button" class="equip-close" data-equip-close aria-label="Cerrar el catálogo">✕</button></header>
      <input class="hud-input" type="search" data-equip-search placeholder="Busca por nombre…" autocomplete="off" aria-label="Buscar en el catálogo" />
      <div class="equip-chips" role="group" aria-label="Opciones del catálogo"><label class="equip-check equip-mine"><input type="checkbox" data-equip-mine checked /> Solo lo que puedo usar</label><span class="equip-chips-gap"></span><button type="button" class="equip-chip" data-equip-custom hidden></button></div>
      <p class="dossier-muted equip-access" data-equip-access></p>
      <div class="equip-results" data-equip-results></div>
    </section>
    <div data-equip-lists></div>
    <p class="dossier-error" role="alert" data-equip-error></p>
    <p class="dossier-muted equip-foot">Los cambios se guardan al momento.<span data-equip-keeper hidden> <button type="button" class="equip-link" data-edit-inventory>Editor completo (Keeper)</button></span></p>`);
  const q = selector => container.querySelector(selector);
  const current = () => store.state.tokens.find(t => t.id === tokenId);
  const fail = message => { q('[data-equip-error]').textContent = message || ''; };
  const isKeeperTable = () => store.sessionRole !== 'player' && store.state.userRole === 'keeper';

  // One change to weapons or plain gear, validated and saved; the lists redraw from the store.
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
  // Armor and augmentations: the table works the change out (and undoes it on removal).
  const gearAction = async (action, done) => {
    if (!store.canEditToken(tokenId)) { fail('Ya no tienes control de este token.'); return; }
    try { await network.requestAction({ ...action, actorId: tokenId }); fail(''); if (done) notify(done); }
    catch (error) { fail(error.message); }
  };

  function openPanel(category) {
    ui.adding = category; ui.query = ''; ui.menu = null;
    const panel = q('[data-equip-panel]'), custom = q('[data-equip-custom]'), block = BLOCKS.find(b => b.category === category);
    panel.hidden = false;
    q('[data-equip-panel-title]').textContent = `Añadir ${ADD_TITLES[category] || 'equipo'}`;
    q('[data-equip-search]').value = '';
    custom.hidden = !block?.custom; custom.dataset.equipCustom = block?.custom || '';
    custom.textContent = block?.custom === 'weapons' ? '+ Arma propia' : '+ Objeto propio';
    renderResults();
    panel.scrollIntoView?.({ block: 'nearest' }); q('[data-equip-search]').focus();
  }
  const closePanel = () => { ui.adding = null; q('[data-equip-panel]').hidden = true; };

  function renderResults() {
    const editable = !!current() && store.canEditToken(tokenId), box = q('[data-equip-results]');
    // The player's sheet disables its form fields; the catalog's own stay usable when allowed.
    q('[data-equip-search]').disabled = !editable; q('[data-equip-mine]').disabled = !editable;
    if (!ui.adding || !editable) { box.innerHTML = ''; return; }
    const token = current(), data = cardData(), access = characterAccess(token, data);
    q('[data-equip-access]').textContent = accessLine(access);
    const check = item => competence(item, token, data, access);
    const found = filterEquipmentCatalog({ source: 'all', category: ui.adding, query: ui.query }).filter(item => item.category !== 'drone_modules' && (!ui.onlyMine || check(item).ok)), shown = found.slice(0, 12);
    box.innerHTML = sanitizeHTML(shown.map(item => `<div class="equip-result">${equipmentThumbnail(item)}<div><strong>${esc(item.name)}</strong> ${outsideBadge(check(item))} <em>${esc(item.tier || '')}${item.source === 'rust_and_steel' ? ' · Rust & Steel' : ''}</em><small>${esc(catalogLine(item))}</small></div><button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-equip-add="${esc(item.id)}">${item.category === 'armor' ? 'Ponérmela' : item.category === 'augmentations' ? 'Instalar' : 'Añadir'}</button></div>`).join('')
      + (found.length > shown.length ? `<p class="dossier-muted">${found.length - shown.length} más: escribe algo para afinar.</p>` : '') || (ui.onlyMine && access ? '<p class="dossier-muted">Nada de eso entra en tu competencia. Desmarca «Solo lo que puedo usar» para verlo todo (fuera de tu competencia tiras con Desventaja).</p>' : '<p class="dossier-muted">Nada en el catálogo con ese nombre.</p>'));
    box.querySelectorAll('[data-equip-add]').forEach(button => button.onclick = () => {
      const token = current(), item = found.find(x => x.id === button.dataset.equipAdd);
      if (!token || !item || !store.canEditToken(tokenId)) { fail('Ya no tienes control de este token.'); return; }
      if (item.category === 'armor' || item.category === 'augmentations') { closePanel(); gearAction({ type: 'GEAR_INSTALL', catalogId: item.id }, `${item.name}: ${item.category === 'armor' ? 'puesta; umbrales y Armor Slots actualizados' : 'instalado'}.`); return; }
      try {
        const updates = catalogEquipUpdates(token, item);
        store.updateToken(tokenId, updates);
        if (store.sessionRole !== 'player') network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId, partial: updates });
        fail(''); notify(`${item.name} añadido.`);
      } catch (error) { fail(error.message); }
    });
  }

  const editor = (kind, row) => kind === 'weapons' ? `
    <div class="equip-edit" data-equip-form="${esc(row.id)}">
      <div class="inventory-fields">${input('Nombre', 'name', row.name, 'required maxlength="200"')}${input('Daño', 'damage', row.damage, 'maxlength="1000" placeholder="d8+1 phys"')}
        <label class="dossier-field"><span>Trait</span><select class="hud-select" data-field="trait">${options(TRAIT_OPTIONS, row.trait)}</select></label>
        <label class="dossier-field"><span>Alcance</span><select class="hud-select" data-field="range">${options(RANGE_OPTIONS, row.range)}</select></label></div>
      <label class="equip-check"><input type="checkbox" data-field="damageMode" ${row.damageMode === 'final' ? 'checked' : ''} /> El daño escrito ya incluye Proficiency y Honed Edge (no sumarlos otra vez)</label>
      <label class="dossier-field"><span>Tags (reglas)</span><input class="hud-input" data-field="tags" value="${esc(tagLine(row))}" maxlength="600" placeholder="Ej.: Reliable, Armor Piercing 2, Reach"></label>
      <label class="dossier-field"><span>Propiedades (descripción)</span><textarea class="hud-input" data-field="features" rows="2" maxlength="10000">${esc(row.features)}</textarea></label>
      <div class="equip-actions"><button class="hud-btn hud-btn-primary" type="button" data-equip-save>Guardar</button><button class="hud-btn" type="button" data-equip-cancel>Cancelar</button></div>
    </div>` : `
    <div class="equip-edit" data-equip-form="${esc(row.id)}">
      <div class="inventory-fields">${input('Nombre', 'name', row.name, 'required maxlength="200"')}${input('Cantidad', 'quantity', row.quantity, 'type="number" min="0" max="999999" step="1" required')}</div>
      <label class="dossier-field"><span>Para qué sirve</span><textarea class="hud-input" data-field="use" rows="2" maxlength="10000">${esc(row.use)}</textarea></label>
      <div class="equip-actions"><button class="hud-btn hud-btn-primary" type="button" data-equip-save>Guardar</button><button class="hud-btn" type="button" data-equip-cancel>Cancelar</button></div>
    </div>`;
  // «⋯»: the row's less frequent actions (edit, remove), so the row shows only what is used.
  const more = (row, editable, { edit = true } = {}) => !editable ? '' : ui.menu === row.id
    ? `${edit ? `<button type="button" class="hud-btn hud-btn-xs" data-equip-edit="${esc(row.id)}">Editar</button>` : ''}<button type="button" class="hud-btn hud-btn-xs ${ui.confirming === row.id ? 'hud-btn-danger' : ''}" data-equip-remove="${esc(row.id)}">${ui.confirming === row.id ? '¿Quitar?' : 'Quitar'}</button><button type="button" class="equip-more" data-equip-menu="${esc(row.id)}" aria-label="Cerrar opciones" aria-expanded="true">✕</button>`
    : `<button type="button" class="equip-more" data-equip-menu="${esc(row.id)}" aria-label="Más opciones de ${esc(row.name)}" aria-expanded="false">⋯</button>`;
  const longText = (row, value) => value ? `<small class="${ui.open.has(row.id) ? 'is-open' : ''}" data-equip-expand="${esc(row.id)}" title="Toca para ver todo">${esc(value)}</small>` : '';
  const head = (block, count, extra = '') => `<header class="equip-block-head"><h4 class="dossier-label">${block.title.toUpperCase()} · ${count}${extra}</h4>${editableNow() ? `<button type="button" class="equip-chip" data-equip-open="${block.category}">${block.id === 'armor' && count ? 'Cambiar' : '+ Añadir'}</button>` : ''}</header>`;
  const editableNow = () => !!current() && store.canEditToken(tokenId);

  function renderLists() {
    const token = current(), box = q('[data-equip-lists]');
    if (!token) { box.textContent = 'Este actor ya no existe.'; return; }
    const inventory = tokenInventory(token), editable = store.canEditToken(tokenId), data = cardData();
    q('[data-equip-keeper]').hidden = !isKeeperTable();
    const usable = w => editable && w.damage && !/^(?:n\/?a|none|—|-)$/i.test(w.damage.trim());
    const armor = inventory.items.filter(r => gearKind(r) === 'armor'), augments = installedAugments(inventory), gear = inventory.items.filter(r => gearKind(r) === 'gear');
    const sheetArmor = !armor.length && token.sourceCharacter?.document?.fields?.armor_name;
    const capacity = augmentCapacity(token), over = overCapacity(token, inventory);

    const weaponRow = w => ui.editing === w.id ? editor('weapons', w) : `<article class="equip-row">${equipmentThumbnail(w)}<div class="equip-main"><strong>${esc(w.name || 'Arma sin nombre')}</strong>${outsideBadge(competence(w, token, data))}<span class="equip-damage">${esc(w.damage || 'Sin daño')}</span><em>${esc([w.trait, w.range, w.damageMode === 'final' ? 'daño final' : ''].filter(Boolean).join(' · '))}</em>${weaponTagList(w).length ? `<span class="equip-tags">${weaponTagList(w).map(t => `<button type="button" class="equip-tag ${ui.tag === w.id + '|' + t ? 'active' : ''}" data-equip-tag="${esc(w.id + '|' + t)}" title="Ver la regla">${esc(tagLabel(t))}</button>`).join('')}</span>` : ''}${ui.tag?.startsWith(w.id + '|') ? `<p class="equip-tag-rule">${esc(tagRule(ui.tag.slice(w.id.length + 1)) || 'Sin regla en el glosario: aplícala según su texto.')}</p>` : ''}${longText(w, w.features)}</div><div class="equip-actions"><button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-prepare-weapon="${esc(w.id)}" ${usable(w) ? '' : 'disabled'} title="Lleva esta arma al panel de dados para atacar">Atacar</button>${more(w, editable)}</div></article>`;
    const armorRow = r => `<article class="equip-row">${equipmentThumbnail(r)}<div class="equip-main"><strong>${esc(r.name)}</strong>${outsideBadge(competence(r, token, data))}<span class="equip-stats"><b>${token.hp?.majorThreshold ?? '—'} / ${token.hp?.severeThreshold ?? '—'}</b> umbrales · <b>${token.armor?.current ?? 0} / ${token.armor?.max ?? 0}</b> Armor Slots</span>${longText(r, r.use)}</div><div class="equip-actions">${more(r, editable, { edit: false })}</div></article>`;
    const augmentRow = r => {
      const rule = augmentRule(r), entry = catalogEntry(r), effects = effectsLine(rule?.effects);
      return `<article class="equip-row">${equipmentThumbnail(r)}<div class="equip-main"><strong>${esc(r.name)}</strong>${outsideBadge(competence(r, token, data))}${entry?.tier ? `<em>${esc(entry.tier)}${entry.stressCost ? ` · ${entry.stressCost} Stress al activarlo` : ''}</em>` : ''}${effects ? `<span class="equip-effect">${esc(effects)}</span>` : ''}${rule?.active ? '<span class="equip-card-note">Activable · carta en tu mano</span>' : ''}${longText(r, entry?.benefit || r.use)}${entry?.drawback ? `<small class="equip-drawback">Inconveniente: ${esc(entry.drawback)}</small>` : ''}</div><div class="equip-actions">${more(r, editable, { edit: false })}</div></article>`;
    };
    const gearRow = item => ui.editing === item.id ? editor('items', item) : `<article class="equip-row equip-row-gear">${equipmentThumbnail(item)}<div class="equip-main"><strong>${esc(item.name || 'Objeto sin nombre')}</strong>${outsideBadge(competence(item, token, data))}${item.tier ? `<em>${esc(item.tier)}</em>` : ''}${longText(item, item.use)}</div><div class="equip-actions"><span class="equip-qty"><button type="button" class="hud-btn hud-btn-xs" data-equip-qty="${esc(item.id)}" data-delta="-1" ${editable ? '' : 'disabled'} aria-label="Una unidad menos de ${esc(item.name)}">−</button><b>${esc(item.quantity)}</b><button type="button" class="hud-btn hud-btn-xs" data-equip-qty="${esc(item.id)}" data-delta="1" ${editable ? '' : 'disabled'} aria-label="Una unidad más de ${esc(item.name)}">+</button></span>${more(item, editable)}</div></article>`;
    const list = (rows, html, empty, draftKind) => `<div class="equip-list">${rows.map(html).join('') + (draftKind && ui.draft?.kind === draftKind ? editor(draftKind, ui.draft.row) : '') || `<p class="dossier-muted">${empty}</p>`}</div>`;

    box.innerHTML = sanitizeHTML(`
      ${head(BLOCKS[0], inventory.weapons.length)}${list(inventory.weapons, weaponRow, BLOCKS[0].empty, 'weapons')}
      ${head(BLOCKS[1], armor.length || (sheetArmor ? 1 : 0))}${sheetArmor ? `<div class="equip-list"><article class="equip-row"><div class="equip-main"><strong>${esc(sheetArmor)}</strong><span class="equip-stats"><b>${token.hp?.majorThreshold ?? '—'} / ${token.hp?.severeThreshold ?? '—'}</b> umbrales · <b>${token.armor?.current ?? 0} / ${token.armor?.max ?? 0}</b> Armor Slots</span><small>De la ficha importada. «Cambiar» la sustituye por una del catálogo.</small></div></article></div>` : list(armor, armorRow, BLOCKS[1].empty)}
      ${head(BLOCKS[2], augments.length, ` <span class="equip-capacity ${over ? 'over' : ''}">· capacidad ${augments.length} / ${capacity}${over ? ` · −${over} Stress máx.` : ''}</span>`)}${list(augments, augmentRow, BLOCKS[2].empty)}
      ${head(BLOCKS[3], gear.length)}${list(gear, gearRow, BLOCKS[3].empty, 'items')}`);

    box.querySelectorAll('[data-equip-open]').forEach(button => button.onclick = () => openPanel(button.dataset.equipOpen));
    box.querySelectorAll('[data-equip-menu]').forEach(button => button.onclick = () => { ui.menu = ui.menu === button.dataset.equipMenu ? null : button.dataset.equipMenu; ui.confirming = null; renderLists(); });
    box.querySelectorAll('[data-equip-tag]').forEach(button => button.onclick = () => { ui.tag = ui.tag === button.dataset.equipTag ? null : button.dataset.equipTag; renderLists(); });
    box.querySelectorAll('[data-equip-expand]').forEach(el => el.onclick = () => { const id = el.dataset.equipExpand; if (ui.open.has(id)) ui.open.delete(id); else ui.open.add(id); el.classList.toggle('is-open'); });
    box.querySelectorAll('[data-prepare-weapon]').forEach(button => button.onclick = () => {
      if (!store.canEditToken(tokenId)) { notify('Ya no tienes control de este token.'); return; }
      if (!window.veilDiceRoller) { notify('El panel de dados todavía no está disponible.'); return; }
      if (window.veilDiceRoller.prepareWeapon(tokenId, button.dataset.prepareWeapon)) container.closest('.dossier-backdrop')?.remove();
    });
    box.querySelectorAll('[data-equip-qty]').forEach(button => button.onclick = () => save(inv => { const item = inv.items.find(i => i.id === button.dataset.equipQty); if (item) item.quantity = String(Math.max(0, Math.min(999999, (Number(item.quantity) || 0) + Number(button.dataset.delta)))); }));
    box.querySelectorAll('[data-equip-edit]').forEach(button => button.onclick = () => { ui.editing = button.dataset.equipEdit; ui.confirming = null; ui.menu = null; renderLists(); box.querySelector('[data-equip-form] input')?.focus(); });
    // Removing asks once, on the same button, so a slip of the finger deletes nothing.
    box.querySelectorAll('[data-equip-remove]').forEach(button => button.onclick = () => {
      const id = button.dataset.equipRemove;
      if (ui.confirming !== id) { ui.confirming = id; renderLists(); return; }
      ui.confirming = null; ui.menu = null;
      const row = inventory.items.find(r => r.id === id);
      if (row && gearKind(row) !== 'gear') gearAction({ type: 'GEAR_REMOVE', rowId: id }, `${row.name}: ${gearKind(row) === 'armor' ? 'quitada; umbrales naturales' : 'desinstalado; sus efectos se retiran'}.`);
      else save(inv => { inv.weapons = inv.weapons.filter(w => w.id !== id); inv.items = inv.items.filter(i => i.id !== id); }, 'Quitado del inventario.');
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
  q('[data-equip-mine]').onchange = event => { ui.onlyMine = event.target.checked; renderResults(); };
  q('[data-equip-close]').onclick = closePanel;
  q('[data-equip-panel]').addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); closePanel(); } });
  q('[data-equip-custom]').onclick = () => {
    const kind = q('[data-equip-custom]').dataset.equipCustom, id = newId();
    const row = kind === 'weapons' ? { id, name: '', tier: '', damage: '', damageMode: 'base', trait: 'Agility', range: 'Close', features: '' } : { id, name: '', tier: '', quantity: '1', use: '' };
    // The new entry is written first and only saved with a name: cancelling leaves no trace.
    if (!current() || !store.canEditToken(tokenId) || !kind) return;
    closePanel();
    ui.draft = { kind, row }; ui.editing = id; ui.confirming = null; renderLists();
    q('[data-equip-form] input')?.focus();
  };
  q('[data-edit-inventory]').onclick = () => { if (isKeeperTable()) openInventory(tokenId); };

  const unsubscribe = store.subscribe((_, keys) => { if (!container.isConnected) { unsubscribe(); return; } if (keys.some(k => ['tokens', 'userRole', 'isConnected'].includes(k))) { if (!ui.editing || !container.contains(document.activeElement)) renderLists(); renderResults(); } });
  const observer = new MutationObserver(() => { if (!container.isConnected) { unsubscribe(); observer.disconnect(); } }); observer.observe(document.body, { childList:true });
  renderLists();
  // The class tables and the tag glossary come with the rules data, fetched on demand.
  if (!cardData()) loadCardData().then(() => { if (container.isConnected) { renderResults(); renderLists(); } }).catch(() => {});
}
