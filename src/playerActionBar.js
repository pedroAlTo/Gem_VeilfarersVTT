// The player's action bar (V3, phase A): what a player does most, in one touch.
// TIRAR: the six Traits with their values; a touch rolls against the DC the table has set.
// ATACAR: one button per weapon; a touch, then the target on the map, and the table does the
// rest (range, training, damage, the defender's armor). Everything else stays where it was.
import { store } from './state.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { TRAITS } from './rulesEngine.js';
import { tokenInventory } from './equipment.js';

const sign = n => (n >= 0 ? `+${n}` : `${n}`);
const usableWeapon = w => w && w.damage && !/^(?:n\/?a|none|—|-)$/i.test(String(w.damage).trim());

// The bar belongs to the player stance: the player character you control, selected.
export function barOwner(state = store.state) {
  const playerStance = store.sessionRole === 'player' || state.userRole === 'player';
  if (!playerStance) return null;
  const token = state.tokens.find(t => t.id === state.selectedTokenId) || state.tokens.find(t => t.id === state.claimedTokenId);
  if (!token || token.isPlayer === false || token.actorType === 'drone') return null;
  return store.sessionRole !== 'player' || store.canEditToken(token.id) ? token : null;
}

// The token under a point of the map canvas, among those the player can see and target.
export function tokenAtPoint(tokens, world, gridSize, { exclude = '' } = {}) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (!t || t.id === exclude || t.hidden) continue;
    const radius = ((t.size || 1) * gridSize) / 2;
    if (Math.hypot(world.x - t.x, world.y - t.y) <= radius + 4) return t;
  }
  return null;
}

export class PlayerActionBar {
  constructor(parent) {
    this.root = document.createElement('section');
    this.root.id = 'player_action_bar'; this.root.className = 'player-action-bar hidden';
    this.root.setAttribute('aria-label', 'Acciones del personaje');
    parent.append(this.root);
    this.signature = ''; this.targeting = null; this.edge = 'normal'; this.optionsOpen = false;
    store.subscribe(() => this.render());
    window.addEventListener('resize', () => this.place());
    // It sits right above the character bar, whatever height that bar has.
    const quickbar = document.getElementById('token_quickbar_root');
    if (quickbar && typeof ResizeObserver === 'function') new ResizeObserver(() => this.place()).observe(quickbar);
    window.addEventListener('keydown', event => { if (event.key === 'Escape' && this.targeting) this.stopTargeting(); });
    this.render();
  }

  render() {
    const token = barOwner();
    // Player stance: the map-editing panels are hidden (see playerActionBar.css).
    document.body.classList.toggle('player-stance', !!token);
    if (!token) { this.signature = ''; this.root.classList.add('hidden'); this.stopTargeting(); return; }
    const weapons = (tokenInventory(token).weapons || []).filter(usableWeapon);
    const signature = JSON.stringify([token.id, token.traits, weapons.map(w => [w.id, w.name, w.range]), this.edge, this.optionsOpen, this.targeting?.weaponId ?? null, this.result]);
    if (signature === this.signature) return;
    this.signature = signature; this.tokenId = token.id; this.weapons = weapons;
    this.root.classList.remove('hidden');
    const dc = document.getElementById('dice_dc_select')?.value || '15';
    const edgeButton = (id, label) => `<button type="button" class="pab-edge ${this.edge === id ? 'active' : ''}" data-pab-edge="${id}">${label}</button>`;
    this.root.innerHTML = sanitizeHTML(`
      <div class="pab-row">
        <span class="pab-label">Tirar</span>
        <div class="pab-buttons">${TRAITS.map(t => `<button type="button" class="pab-trait" data-pab-trait="${t.id}" title="${e(t.name)} · tirar contra DC ${e(dc)}"><b>${e(t.short)}</b><span>${sign(Number(token.traits?.[t.id]) || 0)}</span></button>`).join('')}</div>
        <button type="button" class="pab-more ${this.optionsOpen ? 'active' : ''}" data-pab-options title="Opciones de la tirada" aria-expanded="${this.optionsOpen}">⋯</button>
      </div>
      ${this.optionsOpen ? `<div class="pab-options">
        <div class="pab-edges" role="group" aria-label="Ventaja">${edgeButton('dis', 'Desventaja')}${edgeButton('normal', 'Normal')}${edgeButton('adv', 'Ventaja')}</div>
        <label class="pab-dc">DC <select data-pab-dc>${[5, 10, 12, 15, 18, 20, 25, 30].map(v => `<option value="${v}" ${String(v) === String(dc) ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <button type="button" class="hud-btn hud-btn-xs" data-pab-panel>Más opciones de tirada</button>
      </div>` : ''}
      <div class="pab-row">
        <span class="pab-label">Atacar</span>
        <div class="pab-buttons">${weapons.length ? weapons.map(w => `<button type="button" class="pab-weapon ${this.targeting?.weaponId === w.id ? 'active' : ''}" data-pab-weapon="${e(w.id)}" title="Atacar con ${e(w.name)}"><b>${e(w.name)}</b><span data-no-i18n>${e(w.range || '—')}</span></button>`).join('')
          : `<button type="button" class="pab-weapon ${this.targeting?.weaponId === '' ? 'active' : ''}" data-pab-weapon="" title="Sin armas: ataque desarmado (Melee)"><b>Desarmado</b><span>Melee</span></button>`}</div>
      </div>
      ${this.targeting ? '<p class="pab-hint" role="status">Toca el objetivo en el mapa · Esc para cancelar</p>' : ''}
      ${this.result ? this.resultRow() : ''}`);
    this.place();
    this.root.querySelectorAll('[data-pab-trait]').forEach(b => { b.onclick = () => this.roll(b.dataset.pabTrait); });
    this.root.querySelectorAll('[data-pab-weapon]').forEach(b => { b.onclick = () => (this.targeting?.weaponId === b.dataset.pabWeapon ? this.stopTargeting() : this.startTargeting(b.dataset.pabWeapon)); });
    this.root.querySelector('[data-pab-options]').onclick = () => { this.optionsOpen = !this.optionsOpen; this.render(); };
    this.root.querySelectorAll('[data-pab-edge]').forEach(b => { b.onclick = () => { this.edge = b.dataset.pabEdge; this.applyEdge(); this.render(); }; });
    this.root.querySelector('[data-pab-dc]')?.addEventListener('change', event => { const panel = document.getElementById('dice_dc_select'); if (panel) { panel.value = event.target.value; panel.dispatchEvent(new Event('change')); } this.signature = ''; this.render(); });
    this.root.querySelector('[data-pab-apply]')?.addEventListener('click', () => this.applyDamage());
    this.root.querySelector('[data-pab-shields]')?.addEventListener('click', () => document.querySelector('#dmg_mitigate_btn')?.click());
    this.root.querySelector('[data-pab-clear]')?.addEventListener('click', () => { this.result = null; this.signature = ''; this.render(); });
    this.root.querySelector('[data-pab-panel]')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'dice' } })));
  }

  place() {
    const parent = this.root.parentElement, quickbar = document.getElementById('token_quickbar_root');
    if (!parent) return;
    const box = parent.getBoundingClientRect(), bar = quickbar?.getClientRects().length ? quickbar.getBoundingClientRect() : null;
    this.root.style.bottom = `${Math.round(bar ? box.bottom - bar.top + 8 : 20)}px`;
    if (bar) this.root.style.left = `${Math.round(bar.left - box.left)}px`;
  }

  // The dice panel keeps the edge; the bar only sets it.
  applyEdge() {
    const adv = document.getElementById('dice_advantage'), dis = document.getElementById('dice_disadvantage');
    if (adv) adv.checked = this.edge === 'adv';
    if (dis) dis.checked = this.edge === 'dis';
  }

  roll(traitId) {
    const dice = window.veilDiceRoller, token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!dice || !token) { notify('El panel de dados todavía no está disponible.'); return; }
    this.stopTargeting(); this.applyEdge();
    dice.setCheckData({ actor: token, traitId, rollNow: true });
  }

  startTargeting(weaponId) {
    this.stopTargeting(false);
    const canvas = window.veilCanvas?.canvas || document.getElementById('tactical_canvas');
    if (!canvas) return;
    this.targeting = { weaponId };
    // Captured before the map's own handler, so the touch picks a target instead of panning.
    this.onPick = event => {
      const engine = window.veilCanvas, map = store.getActiveMap?.() || {};
      if (!engine?.screenToWorld) return;
      const rect = canvas.getBoundingClientRect(), point = event.touches?.[0] || event;
      const world = engine.screenToWorld(point.clientX - rect.left, point.clientY - rect.top);
      const target = tokenAtPoint(store.getTokensForActiveMap(), world, map.gridSize || 64, { exclude: this.tokenId });
      if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const chosen = this.targeting.weaponId;
      this.stopTargeting();
      this.attack(chosen, target);
    };
    canvas.addEventListener('pointerdown', this.onPick, true);
    document.body.classList.add('pab-targeting');
    this.render();
  }

  stopTargeting(redraw = true) {
    const canvas = window.veilCanvas?.canvas || document.getElementById('tactical_canvas');
    if (this.onPick && canvas) canvas.removeEventListener('pointerdown', this.onPick, true);
    this.onPick = null;
    if (!this.targeting) return;
    this.targeting = null; document.body.classList.remove('pab-targeting');
    if (redraw) this.render();
  }

  // The attack's outcome stays in the bar: hit or miss, damage and severity, and the buttons to
  // let the defender spend shields and to apply the damage (decision 8: a separate step).
  readResult(targetName) {
    const q = id => document.getElementById(id), shown = id => q(id) && q(id).style.display !== 'none' && q(id).getClientRects;
    const outcome = q('atk_outcome_val')?.textContent?.trim() || '';
    const damage = shown('damage_result_display') && q('damage_result_display').style.display === 'block';
    const apply = q('apply_dmg_to_target_btn'), mitigate = q('dmg_shield_mitigation_row');
    return {
      targetName, outcome,
      raw: damage ? q('dmg_raw_val')?.textContent?.trim() : '', severity: damage ? q('dmg_severity_val')?.textContent?.trim() : '', loss: damage ? q('dmg_hp_loss_val')?.textContent?.trim() : '',
      canApply: !!(damage && apply && !apply.disabled), shields: !!(damage && mitigate && mitigate.style.display !== 'none'), applied: !!(apply && /APPLIED|APLICADO/i.test(apply.textContent || '')),
    };
  }
  resultRow() {
    const r = this.result;
    const hit = r.raw !== '';
    return `<div class="pab-row pab-result ${hit ? 'hit' : 'miss'}" role="status">
      <span class="pab-label">Resultado</span>
      <div class="pab-result-text"><b>${e(r.outcome || '—')}</b> <span>${e(r.targetName)}</span>${hit ? ` · <span>${e(r.raw)} de daño · ${e(r.severity)} · ${e(r.loss)}</span>` : ''}</div>
      <div class="pab-result-actions">${hit && r.shields && !r.applied ? '<button type="button" class="hud-btn hud-btn-xs" data-pab-shields>Escudos</button>' : ''}${hit && !r.applied ? `<button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-pab-apply ${r.canApply ? '' : 'disabled'}>Aplicar daño</button>` : ''}${r.applied ? '<span class="pab-applied">Daño aplicado</span>' : ''}<button type="button" class="pab-more" data-pab-clear aria-label="Quitar el resultado">×</button></div>
    </div>`;
  }
  applyDamage() {
    document.getElementById('apply_dmg_to_target_btn')?.click();
    setTimeout(() => { if (this.result) { this.result = this.readResult(this.result.targetName); this.render(); } }, 400);
  }

  async attack(weaponId, target) {
    const dice = window.veilDiceRoller, token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!dice || !token) return;
    const dockWasOpen = !!window.veilDiceDock?.isOpen;
    this.result = null;
    try {
      // Preparing the weapon asks for the dice panel; the player's attack stays in the bar.
      if (weaponId) { if (!dice.prepareWeapon(token.id, weaponId)) return; if (!dockWasOpen) window.veilDiceDock?.close(); }
      else { store.update({ selectedTokenId: token.id }); dice.syncWithSelectedToken(); }
      dice.populateDamageTargets?.();
      const targetSelect = dice.container.querySelector('#dmg_target_select'), weaponSelect = dice.container.querySelector('#dmg_weapon_select');
      if (weaponSelect) weaponSelect.value = weaponId || '';
      if (targetSelect) { targetSelect.value = target.id; targetSelect.onchange?.(); }
      this.applyEdge();
      await dice.executeAttack();
      this.result = this.readResult(target.name); this.signature = ''; this.render();
      // Bear Down can still raise the damage before it is applied: follow the panel.
      this.watchDamage();
    } catch (error) { notify(error.message, 'error'); }
  }
  watchDamage() {
    const box = document.getElementById('damage_result_display');
    if (!box || this.damageObserver) return;
    this.damageObserver = new MutationObserver(() => { if (this.result) { const next = this.readResult(this.result.targetName); if (JSON.stringify(next) !== JSON.stringify(this.result)) { this.result = next; this.render(); } } });
    this.damageObserver.observe(box, { childList: true, subtree: true, characterData: true, attributes: true });
  }
}
