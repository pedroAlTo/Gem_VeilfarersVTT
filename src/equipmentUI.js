import { tagLabel, weaponTagList } from './weaponTags.js';
import { tagInfo } from './weaponGlossary.js';
const tagLine = row => weaponTagList(row).map(tagLabel).join(', ');
import { store } from './state.js';
import { dossierDialog } from './dossierDialog.js';
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
import { installGear, gearKind, installedAugments, augmentRule, catalogEntry, effectsLine, augmentCapacity, overCapacity, isWorn } from './gear.js';

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

// The equipment tab (v2.30.0, user decision 22 Nov 2026). Three blocks by importance:
//   1. Armas y Armaduras: the main one. What is in hand or worn is shown large, with every
//      characteristic; what is only carried is a compact row that opens to show them all.
//   2. Aumentos: the installed augmentations, with their effects and capacity.
//   3. Útiles y varios: a simple list.
// The catalog (both books, ~570 items) opens apart with filters by type, Wealth Tier, book (several
// at once) and «solo lo que puedo usar». Picking an item shows all of it before taking it.
// Tags show their rule on hover (or focus). Armor and augmentations change the character's
// numbers: the table puts them on, wears and removes them (GEAR_INSTALL / GEAR_WEAR / GEAR_REMOVE).
const TYPES = [['weapons', 'Armas'], ['armor', 'Armaduras'], ['augmentations', 'Aumentos'], ['gear', 'Útiles y varios']];
const BOOKS = [['core', 'Corebook'], ['rust_and_steel', 'Rust & Steel']];
const WTS = [0, 1, 2, 3, 4, 5];
const TYPE_LABEL = Object.fromEntries(TYPES);
// A tag's rule, from the glossary (Corebook): «Armor Piercing 2» → the text of Armor Piercing.
const ruleOf = label => { const defs = cardData()?.features || {}; return defs[label] || defs[String(label).replace(/[+\s]*\d+$/, '').trim()] || defs[String(label).replace(/\s*\(.*\)$/, '').trim()] || ''; };
const tagRule = tag => ruleOf(tagLabel(tag));
// The catalog entry behind an inventory row (its extra data: book, WT, cost, description…).
const entryOf = row => catalogEntry(row) || {};
const bookName = source => Object.fromEntries(BOOKS)[source] || '';
const featureList = text => String(text || '').split(/,\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean);

// Tags: chips that show their rule in a popup on hover or focus. A weapon's tag also says what the
// table does with it (Plan de UX V3, fase 4): a mark on the chip and a line in the popup.
const MODE_MARK = { auto: '⚙', partial: '◐', reminder: '🔔', info: '' };
function tagsHTML(item) {
  const weapon = item.category === 'weapons' || item.damage !== undefined && !item.armorSlots;
  if (weapon) {
    const tags = weaponTagList(item).map(tagInfo);
    if (!tags.length) return '';
    return `<span class="eq-tags">${tags.map(t => {
      const rule = t.rule || tagRule(t.id);
      // Game data (names, the book's rule) is never machine-translated; what the table does is.
      return `<span class="eq-tag eq-tag-${t.mode}" tabindex="0">${MODE_MARK[t.mode] ? `<i aria-hidden="true">${MODE_MARK[t.mode]}</i>` : ''}<span data-no-i18n>${esc(t.label)}</span><span class="eq-tag-pop" role="tooltip"><b data-no-i18n>${esc(t.label)}</b>${rule ? `<span data-no-i18n>${esc(rule)}</span>` : 'Sin regla en el glosario: aplícala según su texto.'}${t.book ? `<small data-no-i18n>${esc(t.book)}</small>` : ''}<em class="eq-tag-use eq-use-${t.mode}"><strong>${esc(t.modeLabel)}</strong>${t.table ? `<span>${esc(t.table)}</span>` : ''}</em></span></span>`;
    }).join('')}</span>`;
  }
  const labels = featureList(item.features).map(f => [f, ruleOf(f)]);
  if (!labels.length) return '';
  return `<span class="eq-tags">${labels.map(([label, rule]) => `<span class="eq-tag" tabindex="0">${esc(label)}${rule ? `<span class="eq-tag-pop" role="tooltip"><b>${esc(label)}</b>${esc(rule)}</span>` : ''}</span>`).join('')}</span>`;
}
// Every characteristic of a piece of equipment (an inventory row merged with its catalog entry).
function detailHTML(raw, { token = null, kind = '' } = {}) {
  const entry = raw.category ? raw : entryOf(raw), item = { ...entry, ...raw, features: raw.features || entry.features };
  const cat = item.category || kind || (raw.damage !== undefined ? 'weapons' : '');
  // Game data (names, damage, ranges, rules) is never machine-translated: «Close» is a range.
  const stat = (label, value) => value === undefined || value === null || value === '' ? '' : `<div><span>${esc(label)}</span><b data-no-i18n>${esc(value)}</b></div>`;
  const level = Number(token?.level || 1);
  const stats = cat === 'weapons' ? [stat('Daño', item.damage), stat('Trait', item.trait), stat('Alcance', item.range), stat('Burden', item.burden), stat('Familia', item.family)]
    : cat === 'armor' ? [stat('Umbrales', item.majorThreshold ? `${item.majorThreshold} / ${item.severeThreshold} (+${level} nivel = ${item.majorThreshold + level} / ${item.severeThreshold + level})` : ''), stat('Armor Slots', item.armorSlots), stat('Peso', item.family), stat('Burden', item.burden)]
    : cat === 'augmentations' ? [stat('Tipo', item.family), stat('Stress al activarlo', item.stressCost || ''), stat('Complejidad', item.complexity), stat('DC de instalación', item.installDC), stat('Requiere', item.requires)]
    : [stat('Tipo', item.family), stat('Burden', item.burden), stat('Cantidad', raw.quantity)];
  const meta = [item.tier, item.wt != null ? `WT${item.wt}` : '', item.cost, bookName(item.source), item.illegal ? `Ilegal · Heat ${item.heat || '+1'}` : ''].filter(Boolean);
  const effects = cat === 'augmentations' ? effectsLine(augmentRule(raw.catalogId ? raw : { catalogId: item.id, name: item.name })?.effects) : '';
  const texts = [
    item.benefit && cat === 'augmentations' ? ['Beneficio', item.benefit] : null,
    item.drawback ? ['Inconveniente', item.drawback] : null,
    cat !== 'augmentations' && (raw.use || item.use) && (raw.use || item.use) !== item.features ? ['Uso', raw.use || item.use] : null,
    item.description ? ['Descripción', item.description] : null,
    item.tactical ? ['En la mesa', item.tactical] : null,
    cat === 'weapons' && raw.features ? ['Propiedades', raw.features] : null,
  ].filter(Boolean);
  return `<div class="eq-detail">
    ${meta.length ? `<p class="eq-meta">${meta.map(m => `<i>${esc(m)}</i>`).join('')}</p>` : ''}
    <div class="eq-stats">${stats.join('')}</div>
    ${effects ? `<p class="eq-effect">${esc(effects)}</p>` : ''}
    ${tagsHTML(item)}
    ${item.traitProposed ? '<p class="dossier-muted">El libro no indica el Trait de esta arma: se propone uno por su familia (edítalo si tu mesa usa otro).</p>' : ''}
    ${texts.map(([label, text]) => `<p class="eq-text"><span>${esc(label)}</span>${esc(text)}</p>`).join('')}
  </div>`;
}

export function mountEquipmentPanel(container, tokenId) {
  const ui = { query: '', types: [], wts: [], books: [], onlyMine: true, open: false, pick: null, editing: null, confirming: null, draft: null, menu: null, expanded: new Set() };
  container.innerHTML = sanitizeHTML(`
    <section class="eq-catalog" data-eq-catalog hidden>
      <header class="eq-catalog-head"><strong>Catálogo · Corebook y Rust &amp; Steel</strong><button type="button" class="equip-close" data-eq-close aria-label="Cerrar el catálogo">✕</button></header>
      <input class="hud-input" type="search" data-eq-search placeholder="Busca por nombre, propiedad o efecto…" autocomplete="off" aria-label="Buscar en el catálogo" />
      <div class="eq-filters">
        <div class="eq-filter"><span>Tipo</span>${TYPES.map(([id, label]) => `<button type="button" class="equip-chip" data-eq-type="${id}">${label}</button>`).join('')}</div>
        <div class="eq-filter"><span>WT</span>${WTS.map(wt => `<button type="button" class="equip-chip" data-eq-wt="${wt}" title="Wealth Tier ${wt}">${wt}</button>`).join('')}</div>
        <div class="eq-filter"><span>Libro</span>${BOOKS.map(([id, label]) => `<button type="button" class="equip-chip" data-eq-book="${id}">${label}</button>`).join('')}</div>
        <label class="equip-check eq-mine"><input type="checkbox" data-eq-mine checked /> Solo lo que puedo usar</label>
      </div>
      <p class="dossier-muted equip-access" data-eq-access></p>
      <div class="eq-catalog-body"><div class="eq-results" data-eq-results></div><aside class="eq-pick" data-eq-pick></aside></div>
      <div class="eq-custom"><button type="button" class="equip-link" data-eq-custom="weapons">+ Arma propia</button> · <button type="button" class="equip-link" data-eq-custom="items">+ Objeto propio</button></div>
    </section>
    <div data-eq-lists></div>
    <p class="dossier-error" role="alert" data-eq-error></p>
    <p class="dossier-muted equip-foot">Los cambios se guardan al momento.<span data-eq-keeper hidden> <button type="button" class="equip-link" data-edit-inventory>Editor completo (Keeper)</button></span></p>`);
  const q = selector => container.querySelector(selector);
  const current = () => store.state.tokens.find(t => t.id === tokenId);
  const fail = message => { q('[data-eq-error]').textContent = message || ''; };
  const isKeeperTable = () => store.sessionRole !== 'player' && store.state.userRole === 'keeper';
  const editable = () => !!current() && store.canEditToken(tokenId);

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
  const gearAction = async (action, done) => {
    if (!store.canEditToken(tokenId)) { fail('Ya no tienes control de este token.'); return; }
    try { await network.requestAction({ ...action, actorId: tokenId }); fail(''); if (done) notify(done); }
    catch (error) { fail(error.message); }
  };

  // ---- Catalog ----
  function openCatalog(types = []) {
    ui.open = true; ui.types = types; ui.pick = null; ui.query = '';
    q('[data-eq-catalog]').hidden = false; q('[data-eq-search]').value = '';
    paintFilters(); renderResults();
    q('[data-eq-catalog]').scrollIntoView?.({ block: 'nearest' }); q('[data-eq-search]').focus();
  }
  const closeCatalog = () => { ui.open = false; q('[data-eq-catalog]').hidden = true; };
  function paintFilters() {
    container.querySelectorAll('[data-eq-type]').forEach(b => { const on = ui.types.includes(b.dataset.eqType); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    container.querySelectorAll('[data-eq-wt]').forEach(b => { const on = ui.wts.includes(Number(b.dataset.eqWt)); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    container.querySelectorAll('[data-eq-book]').forEach(b => { const on = ui.books.includes(b.dataset.eqBook); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  }
  const toggle = (list, value) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  const actionLabel = item => item.category === 'armor' ? 'Ponérmela' : item.category === 'augmentations' ? 'Instalar' : item.category === 'weapons' ? 'Equipar' : 'Añadir';
  function renderResults() {
    const box = q('[data-eq-results]'), pickBox = q('[data-eq-pick]');
    const can = editable();
    q('[data-eq-search]').disabled = !can; q('[data-eq-mine]').disabled = !can;
    if (!ui.open || !can) { box.innerHTML = ''; pickBox.innerHTML = ''; return; }
    const token = current(), data = cardData(), access = characterAccess(token, data);
    q('[data-eq-access]').textContent = accessLine(access);
    const check = item => competence(item, token, data, access);
    const found = filterEquipmentCatalog({ categories: ui.types, wts: ui.wts, sources: ui.books, query: ui.query })
      .filter(item => item.category !== 'drone_modules' && (!ui.onlyMine || check(item).ok))
      .sort((a, b) => TYPES.findIndex(t => t[0] === a.category) - TYPES.findIndex(t => t[0] === b.category) || (a.wt ?? 9) - (b.wt ?? 9) || a.name.localeCompare(b.name));
    const shown = found.slice(0, 60);
    box.innerHTML = sanitizeHTML(`<p class="dossier-muted eq-count">${found.length} objeto${found.length === 1 ? '' : 's'}${found.length > shown.length ? ` · se muestran ${shown.length}: afina con la búsqueda o los filtros` : ''}</p>` + (shown.map(item => `<button type="button" class="eq-result ${ui.pick === item.id ? 'active' : ''}" data-eq-pickid="${esc(item.id)}">${equipmentThumbnail(item)}<span><strong>${esc(item.name)}</strong><small>${esc([TYPE_LABEL[item.category], item.family, item.tier, item.wt != null ? 'WT' + item.wt : '', bookName(item.source)].filter(Boolean).join(' · '))}</small><em data-no-i18n>${esc(catalogLine(item))}</em></span>${check(item) && !check(item).ok ? `<span class="eq-outside" title="Fuera de tu competencia: ${esc(check(item).reason)}">Desventaja</span>` : ''}</button>`).join('')
      || (ui.onlyMine && access ? '<p class="dossier-muted">Nada de eso entra en tu competencia. Desmarca «Solo lo que puedo usar» para verlo todo (fuera de tu competencia tiras con Desventaja).</p>' : '<p class="dossier-muted">Nada en el catálogo con esos filtros.</p>')));
    box.querySelectorAll('[data-eq-pickid]').forEach(b => b.onclick = () => { ui.pick = b.dataset.eqPickid; renderResults(); });
    const item = found.find(x => x.id === ui.pick) || null;
    pickBox.innerHTML = sanitizeHTML(item ? `<header>${equipmentThumbnail(item)}<div><strong>${esc(item.name)}</strong>${outsideBadge(check(item))}</div></header>${detailHTML(item, { token })}<button type="button" class="hud-btn hud-btn-primary eq-take" data-eq-take="${esc(item.id)}">${actionLabel(item)}</button>`
      : '<p class="dossier-muted">Elige un objeto de la lista para ver todas sus características antes de cogerlo.</p>');
    pickBox.querySelector('[data-eq-take]')?.addEventListener('click', () => take(item));
  }
  function take(item) {
    const token = current();
    if (!token || !item || !store.canEditToken(tokenId)) { fail('Ya no tienes control de este token.'); return; }
    if (item.category === 'armor' || item.category === 'augmentations') { gearAction({ type: 'GEAR_INSTALL', catalogId: item.id }, `${item.name}: ${item.category === 'armor' ? 'puesta; umbrales y Armor Slots actualizados' : 'instalado'}.`); return; }
    try {
      const updates = catalogEquipUpdates(token, item);
      store.updateToken(tokenId, updates);
      if (store.sessionRole !== 'player') network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId, partial: updates });
      fail(''); notify(`${item.name} añadido.`);
    } catch (error) { fail(error.message); }
  }

  // ---- What the character has ----
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
  const more = (row, { edit = true } = {}) => !editable() ? '' : ui.menu === row.id
    ? `${edit ? `<button type="button" class="hud-btn hud-btn-xs" data-equip-edit="${esc(row.id)}">Editar</button>` : ''}<button type="button" class="hud-btn hud-btn-xs ${ui.confirming === row.id ? 'hud-btn-danger' : ''}" data-equip-remove="${esc(row.id)}">${ui.confirming === row.id ? '¿Quitar?' : 'Quitar'}</button><button type="button" class="equip-more" data-equip-menu="${esc(row.id)}" aria-label="Cerrar opciones" aria-expanded="true">✕</button>`
    : `<button type="button" class="equip-more" data-equip-menu="${esc(row.id)}" aria-label="Más opciones de ${esc(row.name)}" aria-expanded="false">⋯</button>`;
  const blockHead = (title, count, types, extra = '') => `<header class="eq-block-head"><h4 class="dossier-label">${title}${count != null ? ` · ${count}` : ''}${extra}</h4>${editable() ? `<button type="button" class="equip-chip" data-eq-open="${types.join(',')}">+ Añadir</button>` : ''}</header>`;

  function renderLists() {
    const token = current(), box = q('[data-eq-lists]');
    if (!token) { box.textContent = 'Este actor ya no existe.'; return; }
    const inventory = tokenInventory(token), can = editable(), data = cardData();
    q('[data-eq-keeper]').hidden = !isKeeperTable();
    const usable = w => can && w.damage && !/^(?:n\/?a|none|—|-)$/i.test(w.damage.trim());
    const weapons = inventory.weapons, inHand = weapons.filter(w => w.equipped !== false), carriedW = weapons.filter(w => w.equipped === false);
    const armors = inventory.items.filter(r => gearKind(r) === 'armor'), worn = armors.filter(r => isWorn(r, inventory)), carriedA = armors.filter(r => !isWorn(r, inventory));
    const augments = installedAugments(inventory), gear = inventory.items.filter(r => gearKind(r) === 'gear');
    const sheetArmor = !armors.length && token.sourceCharacter?.document?.fields?.armor_name;
    const capacity = augmentCapacity(token), over = overCapacity(token, inventory);

    // Large: in hand / worn / installed, every characteristic in sight.
    const bigCard = (row, kind, actions) => ui.editing === row.id ? editor(kind === 'weapons' ? 'weapons' : 'items', row) : `<article class="eq-card eq-${kind}">
      <header>${equipmentThumbnail({ ...row, ...(row.catalogId ? {} : {}) })}<div><strong>${esc(row.name || 'Sin nombre')}</strong>${kind === 'weapons' ? `<span class="eq-damage">${esc(row.damage || 'Sin daño')}</span>` : ''}${outsideBadge(competence(row, token, data))}</div><div class="equip-actions">${actions}</div></header>
      ${detailHTML(row, { token, kind })}</article>`;
    // Compact: carried; opens to show everything.
    const smallRow = (row, kind, actions) => ui.editing === row.id ? editor(kind === 'weapons' ? 'weapons' : 'items', row) : `<article class="eq-row ${ui.expanded.has(row.id) ? 'open' : ''}">
      <button type="button" class="eq-row-main" data-eq-expand="${esc(row.id)}" aria-expanded="${ui.expanded.has(row.id)}" title="Ver todas sus características">${equipmentThumbnail(row)}<strong>${esc(row.name || 'Sin nombre')}</strong><small data-no-i18n>${esc(kind === 'weapons' ? [row.damage, row.trait, row.range].filter(Boolean).join(' · ') : catalogLine(entryOf(row)))}</small></button>
      <div class="equip-actions">${actions}</div>
      ${ui.expanded.has(row.id) ? detailHTML(row, { token, kind }) : ''}</article>`;
    const attack = w => `<button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-prepare-weapon="${esc(w.id)}" ${usable(w) ? '' : 'disabled'} title="Lleva esta arma al panel de dados para atacar">Atacar</button>`;
    const weaponsHTML = `<section class="eq-sub"><h5>Armas en mano · ${inHand.length}</h5>${inHand.map(w => bigCard(w, 'weapons', `${attack(w)}${can ? `<button type="button" class="hud-btn hud-btn-xs" data-eq-hand="${esc(w.id)}" data-on="0" title="Enfundarla: la llevas encima, no en la mano">Enfundar</button>` : ''}${more(w)}`)).join('') || '<p class="dossier-muted">Ninguna arma en la mano.</p>'}
      ${carriedW.length ? `<h5>Llevas encima · ${carriedW.length}</h5>${carriedW.map(w => smallRow(w, 'weapons', `${can ? `<button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-eq-hand="${esc(w.id)}" data-on="1">Equipar</button>` : ''}${more(w)}`)).join('')}` : ''}
      ${ui.draft?.kind === 'weapons' ? editor('weapons', ui.draft.row) : ''}</section>`;
    const armorHTML = `<section class="eq-sub"><h5>Armadura puesta</h5>${sheetArmor ? `<article class="eq-card eq-armor"><header>${equipmentThumbnail({ name: sheetArmor })}<div><strong>${esc(sheetArmor)}</strong></div></header><div class="eq-detail"><div class="eq-stats"><div><span>Umbrales</span><b>${token.hp?.majorThreshold ?? '—'} / ${token.hp?.severeThreshold ?? '—'}</b></div><div><span>Armor Slots</span><b>${token.armor?.current ?? 0} / ${token.armor?.max ?? 0}</b></div></div><p class="dossier-muted">De la ficha importada. Ponte una del catálogo para sustituirla.</p></div></article>`
        : worn.map(r => bigCard(r, 'armor', `<span class="eq-live">${token.hp?.majorThreshold ?? '—'} / ${token.hp?.severeThreshold ?? '—'} · ${token.armor?.current ?? 0}/${token.armor?.max ?? 0} slots</span>${can ? `<button type="button" class="hud-btn hud-btn-xs" data-eq-wear="" title="Quitártela: umbrales naturales">Quitármela</button>` : ''}${more(r, { edit: false })}`)).join('') || '<p class="dossier-muted">Sin armadura: umbrales naturales y ningún Armor Slot propio.</p>'}
      ${carriedA.length ? `<h5>Llevas encima · ${carriedA.length}</h5>${carriedA.map(r => smallRow(r, 'armor', `${can ? `<button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-eq-wear="${esc(r.id)}">Ponérmela</button>` : ''}${more(r, { edit: false })}`)).join('')}` : ''}</section>`;
    const augHTML = augments.map(r => bigCard(r, 'augmentations', `${augmentRule(r)?.active ? '<span class="equip-card-note">Carta en tu mano</span>' : ''}${more(r, { edit: false })}`)).join('') || '<p class="dossier-muted">Sin aumentos instalados.</p>';
    const gearHTML = gear.map(item => ui.editing === item.id ? editor('items', item) : `<li class="eq-gear ${ui.expanded.has(item.id) ? 'open' : ''}"><button type="button" class="eq-gear-name" data-eq-expand="${esc(item.id)}" aria-expanded="${ui.expanded.has(item.id)}">${esc(item.name || 'Objeto sin nombre')}</button><span class="eq-gear-use">${esc(item.use || entryOf(item).use || '')}</span><span class="equip-qty"><button type="button" class="hud-btn hud-btn-xs" data-equip-qty="${esc(item.id)}" data-delta="-1" ${can ? '' : 'disabled'} aria-label="Una unidad menos de ${esc(item.name)}">−</button><b>${esc(item.quantity)}</b><button type="button" class="hud-btn hud-btn-xs" data-equip-qty="${esc(item.id)}" data-delta="1" ${can ? '' : 'disabled'} aria-label="Una unidad más de ${esc(item.name)}">+</button></span>${more(item)}${ui.expanded.has(item.id) ? detailHTML(item, { token, kind: 'gear' }) : ''}</li>`).join('') + (ui.draft?.kind === 'items' ? `<li>${editor('items', ui.draft.row)}</li>` : '');

    box.innerHTML = sanitizeHTML(`
      <section class="eq-block eq-block-main">${blockHead('ARMAS Y ARMADURAS', null, ['weapons', 'armor'])}<div class="eq-main-grid">${weaponsHTML}${armorHTML}</div></section>
      <section class="eq-block">${blockHead('AUMENTOS', augments.length, ['augmentations'], ` <span class="equip-capacity ${over ? 'over' : ''}">· capacidad ${augments.length} / ${capacity}${over ? ` · −${over} Stress máx.` : ''}</span>`)}<div class="eq-aug-grid">${augHTML}</div></section>
      <section class="eq-block eq-block-minor">${blockHead('ÚTILES Y VARIOS', gear.length, ['gear'])}<ul class="eq-gear-list">${gearHTML || '<li class="dossier-muted">Sin objetos.</li>'}</ul></section>`);

    box.querySelectorAll('[data-eq-open]').forEach(b => b.onclick = () => openCatalog(b.dataset.eqOpen.split(',')));
    box.querySelectorAll('[data-eq-expand]').forEach(b => b.onclick = () => { const id = b.dataset.eqExpand; if (ui.expanded.has(id)) ui.expanded.delete(id); else ui.expanded.add(id); renderLists(); });
    box.querySelectorAll('[data-eq-hand]').forEach(b => b.onclick = () => save(inv => { const w = inv.weapons.find(x => x.id === b.dataset.eqHand); if (w) w.equipped = b.dataset.on === '1'; }, b.dataset.on === '1' ? 'Arma en la mano.' : 'Arma enfundada.'));
    box.querySelectorAll('[data-eq-wear]').forEach(b => b.onclick = () => gearAction({ type: 'GEAR_WEAR', rowId: b.dataset.eqWear || null }, b.dataset.eqWear ? 'Armadura puesta: umbrales y Armor Slots actualizados.' : 'Armadura quitada: umbrales naturales.'));
    box.querySelectorAll('[data-equip-menu]').forEach(b => b.onclick = () => { ui.menu = ui.menu === b.dataset.equipMenu ? null : b.dataset.equipMenu; ui.confirming = null; renderLists(); });
    box.querySelectorAll('[data-prepare-weapon]').forEach(button => button.onclick = () => {
      if (!store.canEditToken(tokenId)) { notify('Ya no tienes control de este token.'); return; }
      if (!window.veilDiceRoller) { notify('El panel de dados todavía no está disponible.'); return; }
      if (window.veilDiceRoller.prepareWeapon(tokenId, button.dataset.prepareWeapon)) container.closest('.dossier-backdrop')?.remove();
    });
    box.querySelectorAll('[data-equip-qty]').forEach(button => button.onclick = () => save(inv => { const item = inv.items.find(i => i.id === button.dataset.equipQty); if (item) item.quantity = String(Math.max(0, Math.min(999999, (Number(item.quantity) || 0) + Number(button.dataset.delta)))); }));
    box.querySelectorAll('[data-equip-edit]').forEach(button => button.onclick = () => { ui.editing = button.dataset.equipEdit; ui.confirming = null; ui.menu = null; renderLists(); box.querySelector('[data-equip-form] input')?.focus(); });
    box.querySelectorAll('[data-equip-remove]').forEach(button => button.onclick = () => {
      const id = button.dataset.equipRemove;
      if (ui.confirming !== id) { ui.confirming = id; renderLists(); return; }
      ui.confirming = null; ui.menu = null;
      const row = inventory.items.find(r => r.id === id);
      if (row && gearKind(row) !== 'gear') gearAction({ type: 'GEAR_REMOVE', rowId: id }, `${row.name}: ${gearKind(row) === 'armor' ? 'quitada' : 'desinstalado; sus efectos se retiran'}.`);
      else save(inv => { inv.weapons = inv.weapons.filter(w => w.id !== id); inv.items = inv.items.filter(i => i.id !== id); }, 'Quitado del inventario.');
    });
    const form = box.querySelector('[data-equip-form]');
    if (form) {
      form.querySelector('[data-equip-cancel]').onclick = () => { ui.editing = null; ui.draft = null; fail(''); renderLists(); };
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

  const search = q('[data-eq-search]');
  search.oninput = () => { ui.query = search.value; renderResults(); };
  q('[data-eq-mine]').onchange = event => { ui.onlyMine = event.target.checked; renderResults(); };
  container.querySelectorAll('[data-eq-type]').forEach(b => b.onclick = () => { ui.types = toggle(ui.types, b.dataset.eqType); paintFilters(); renderResults(); });
  container.querySelectorAll('[data-eq-wt]').forEach(b => b.onclick = () => { ui.wts = toggle(ui.wts, Number(b.dataset.eqWt)); paintFilters(); renderResults(); });
  container.querySelectorAll('[data-eq-book]').forEach(b => b.onclick = () => { ui.books = toggle(ui.books, b.dataset.eqBook); paintFilters(); renderResults(); });
  q('[data-eq-close]').onclick = closeCatalog;
  q('[data-eq-catalog]').addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); closeCatalog(); } });
  container.querySelectorAll('[data-eq-custom]').forEach(button => button.onclick = () => {
    const kind = button.dataset.eqCustom, id = newId();
    const row = kind === 'weapons' ? { id, name: '', tier: '', damage: '', damageMode: 'base', trait: 'Agility', range: 'Close', features: '' } : { id, name: '', tier: '', quantity: '1', use: '' };
    if (!current() || !store.canEditToken(tokenId)) return;
    closeCatalog();
    ui.draft = { kind, row }; ui.editing = id; ui.confirming = null; renderLists();
    q('[data-equip-form] input')?.focus();
  });
  q('[data-edit-inventory]').onclick = () => { if (isKeeperTable()) openInventory(tokenId); };

  const unsubscribe = store.subscribe((_, keys) => { if (!container.isConnected) { unsubscribe(); return; } if (keys.some(k => ['tokens', 'userRole', 'isConnected'].includes(k))) { if (!ui.editing || !container.contains(document.activeElement)) renderLists(); renderResults(); } });
  const observer = new MutationObserver(() => { if (!container.isConnected) { unsubscribe(); observer.disconnect(); } }); observer.observe(document.body, { childList: true });
  renderLists();
  if (!cardData()) loadCardData().then(() => { if (container.isConnected) { renderResults(); renderLists(); } }).catch(() => {});
}
