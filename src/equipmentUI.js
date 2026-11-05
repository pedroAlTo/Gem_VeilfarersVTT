import { store } from './state.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as esc, sanitizeHTML, notify } from './ui.js';
import { tokenInventory, validateInventory } from './equipment.js';
import { newId } from './persistence.js';

const input = (label, key, value, attrs = '') => `<label class="dossier-field"><span>${label}</span><input class="hud-input" data-field="${key}" value="${esc(value)}" ${attrs}></label>`;
export function openInventory(tokenId) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token || !store.canEditToken(tokenId)) { notify('Selecciona uno de tus tokens asignados.'); return; }
  let draft = tokenInventory(token);
  const before = JSON.stringify(draft);
  const modal = dossierDialog('Inventario · ' + token.name, `
    <p class="dossier-muted">El inventario se guarda en la sesión y en Exportar actor VTT. El JSON original del creador se conserva intacto. Las propiedades especiales siguen su texto.</p>
    <form data-inventory-form><div class="inventory-toolbar"><h4>Armas y ataques</h4><button type="button" class="hud-btn" data-add="weapons">+ Arma</button></div><div data-rows="weapons"></div>
    <div class="inventory-toolbar"><h4>Equipo</h4><button type="button" class="hud-btn" data-add="items">+ Objeto</button></div><div data-rows="items"></div>
    <p class="dossier-error" role="alert"></p><footer class="dossier-footer"><button class="hud-btn hud-btn-primary" type="submit">Guardar inventario</button></footer></form>`);
  const error = message => { modal.querySelector('.dossier-error').textContent = message; };
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
    container.innerHTML = sanitizeHTML(`<div class="inventory-toolbar"><h4 class="dossier-label">ARMAS Y EQUIPO</h4><button type="button" class="hud-btn" data-edit-inventory ${editable ? '' : 'disabled'}>Editar inventario</button></div>
      <p class="dossier-muted">Preparar daño rellena el panel de dados. Revisa sus propiedades y el objetivo antes de tirar; no consume munición ni aplica efectos automáticamente.</p>
      <div class="dossier-weapons">${inventory.weapons.map(w => `<article><span class="dossier-eyebrow">${esc(w.tier)} · ${w.damageMode === 'final' ? 'DAÑO FINAL' : 'DAÑO BASE'}</span><h4>${esc(w.name)}</h4><div class="weapon-damage">${esc(w.damage || 'Sin daño indicado')}</div><p>${esc([w.trait,w.range].filter(Boolean).join(' · '))}</p><p>${esc(w.features)}</p><button type="button" class="hud-btn hud-btn-primary" data-prepare-weapon="${esc(w.id)}" ${editable && w.damage && !/^(?:n\/?a|none|—|-)$/i.test(w.damage.trim()) ? '' : 'disabled'}>Preparar daño</button></article>`).join('') || '<p class="dossier-muted">Añade un arma o importa tu ficha.</p>'}</div>
      <div class="inventory-items">${inventory.items.map(item => `<article><div><strong>${esc(item.name)}</strong><span>${esc(item.quantity)} × · ${esc(item.tier)}</span></div><p>${esc(item.use)}</p></article>`).join('') || '<p class="dossier-muted">Sin objetos registrados.</p>'}</div>
      <p class="dossier-muted">Los cambios de inventario del VTT se incluyen en Exportar actor VTT y en las sesiones guardadas. Exportar al creador conserva su equipo original.</p>`);
    container.querySelector('[data-edit-inventory]').onclick = () => openInventory(tokenId);
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
