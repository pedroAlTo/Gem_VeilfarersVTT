// The player's character panel (V3, phase A): the "Ficha" tab of the right panel, with what a
// player does most, in one touch. A player's right panel shows Ficha, Nave, Dossiers, Registro
// and Chat; Relojes, Reparto and Escenas are the Keeper's.
// TIRAR: the six Traits with their values. A touch selects one and shows Disadvantage/Advantage
// below; a second touch rolls it, and so does Advantage or Disadvantage. With a Trait selected
// the character's Experiences appear: selecting one (Awakened: only with Hope, and it marks the
// Hope it will spend) moves the edge buttons under the Experiences; a second touch rolls Trait +
// Experience, and Advantage or Disadvantage rolls it with that edge.
// ATACAR: one button per weapon; a touch, then the target on the map, and the table does the
// rest (range, training, damage, the defender's armor). Everything else stays where it was.
import { store } from './state.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { TRAITS } from './rulesEngine.js';
import { tokenInventory } from './equipment.js';
import { characterDetails } from './characterImport.js';
import { statGaugeHTML } from './tokenVitals.js';
import { normalizeConditions, conditionDefinition } from './conditions.js';
import { distanceInfo, rangeCheck, netEdge, weaponRangeBand, weaponAttackBonus } from './attackFlow.js';
import { damageTypeOf, penetrationFor } from './rulesEngine.js';

const sign = n => (n >= 0 ? `+${n}` : `${n}`);
const usableWeapon = w => w && w.damage && !/^(?:n\/?a|none|—|-)$/i.test(String(w.damage).trim());

// The bar belongs to the player stance: the player character you control, selected.
export const isPlayerView = (state = store.state) => store.sessionRole === 'player' || state.userRole === 'player';
export const PLAYER_TABS = ['sheet', 'ship', 'handouts', 'log', 'chat'];
export function barOwner(state = store.state) {
  if (!isPlayerView(state)) return null;
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

// The selection logic, without the DOM. `pick` is { trait, exp }; a tap is
// { kind: 'trait' | 'exp' | 'edge', id }. Returns the new pick and, when the tap rolls, the roll.
export const EMPTY_PICK = Object.freeze({ trait: null, exp: null });
export function tapPick(pick, tap) {
  const cur = pick || EMPTY_PICK;
  if (tap.kind === 'trait') {
    if (cur.trait === tap.id) return { pick: EMPTY_PICK, roll: { trait: cur.trait, exp: cur.exp, edge: 'normal' } };
    return { pick: { trait: tap.id, exp: cur.exp } };
  }
  // The Experiences are always on the sheet: one can be chosen before or after the Trait.
  if (tap.kind === 'exp') {
    if (cur.exp === tap.id) return cur.trait ? { pick: EMPTY_PICK, roll: { trait: cur.trait, exp: cur.exp, edge: 'normal' } } : { pick: { trait: null, exp: null } };
    return { pick: { trait: cur.trait, exp: tap.id } };
  }
  if (!cur.trait) return { pick: cur };
  if (tap.kind === 'edge') return { pick: EMPTY_PICK, roll: { trait: cur.trait, exp: cur.exp, edge: tap.id === 'adv' ? 'adv' : 'dis' } };
  return { pick: cur };
}
// An Awakened character pays 1 Hope for an Experience; a Sleeping one pays nothing.
export const experienceCost = token => (token?.path === 'Sleeping' ? 0 : 1);
export const experienceAvailable = token => experienceCost(token) === 0 || (Number(token?.hope) || 0) >= 1;
export const experienceBonus = exp => Math.max(0, Math.min(10, parseInt(String(exp?.bonus ?? '').replace(/\s/g, ''), 10) || 0));

// What the Ficha tab shows of the character, read-only (the character bar keeps the steppers).
export function sheetStats(token, armorName = '') {
  const sleeping = token.path === 'Sleeping';
  const others = [];
  if (token.pendingAdvantage) others.push('Ventaja preparada');
  if (Number(token.pendingCheckBonus)) others.push(`${sign(Number(token.pendingCheckBonus))} a la próxima tirada`);
  for (const name of normalizeConditions(token.conditions || [])) others.push(conditionDefinition(name)?.label || name);
  return {
    evasion: token.evasion ?? 10,
    thresholds: [token.hp?.majorThreshold, token.hp?.severeThreshold].map(v => (v ?? '—')),
    shields: { current: token.armor?.current ?? 0, max: token.armor?.max ?? 0 },
    armor: armorName || '—',
    hp: { current: token.hp?.current ?? 0, max: token.hp?.max ?? 0 },
    stress: { current: token.stress?.current ?? 0, max: token.stress?.max ?? 6 },
    path: sleeping ? { label: 'EFFORT', current: token.effort ?? 0, max: token.effortMax ?? 6 } : { label: 'HOPE', current: token.hope ?? 0, max: token.hopeMax ?? 6 },
    resolve: sleeping ? { current: token.resolve?.current ?? 0, max: token.resolve?.max ?? 0, die: token.resolve?.dieType || 'd4' } : null,
    others,
  };
}

export class PlayerActionBar {
  constructor(parent) {
    this.root = document.createElement('section');
    this.root.id = 'player_action_bar'; this.root.className = 'player-action-bar';
    this.root.setAttribute('aria-label', 'Acciones del personaje');
    parent.append(this.root);
    this.signature = ''; this.targeting = null; this.pick = EMPTY_PICK; this.optionsOpen = false; this.view = null;
    store.subscribe(() => this.render());
    window.addEventListener('keydown', event => { if (event.key !== 'Escape') return; if (this.targeting) this.stopTargeting(); else if (this.pick.trait || this.pick.exp !== null) { this.pick = EMPTY_PICK; this.render(); } });
    this.render();
  }

  render() {
    this.syncTabs();
    const token = barOwner();
    if (token && store.sessionRole !== 'player' && store.state.claimedTokenId !== token.id) {
      // At the Keeper's own table (Player view) the selected character is the one being played:
      // claim it, so attacks and gear accept it (store.canEditToken).
      queueMicrotask(() => { if (barOwner()?.id === token.id && store.state.claimedTokenId !== token.id) store.update({ claimedTokenId: token.id }); });
    }
    // Player stance: the map-editing panels are hidden (see playerActionBar.css).
    document.body.classList.toggle('player-stance', !!token);
    if (!token) {
      this.edgeKey = '';
      this.stopTargeting(false); document.body.classList.remove('pab-hope-pending');
      if (this.signature !== 'empty') { this.signature = 'empty'; this.tokenId = null; this.root.innerHTML = sanitizeHTML('<p class="pab-empty">Aún no tienes personaje. Pide al Keeper que te asigne uno o importa tu ficha desde SESIONES.</p>'); }
      return;
    }
    // The target marked for an attack: if either token moves, the distance is worked out again.
    if (this.targeting?.targetId) {
      const target = store.state.tokens.find(t => t.id === this.targeting.targetId);
      const key = target ? `${token.x},${token.y},${target.x},${target.y}` : '';
      if (!target) this.stopTargeting(false);
      else if (this.targeting.posKey && key !== this.targeting.posKey) { this.targeting.posKey = key; this.markTarget(target); }
    }
    const weapons = (tokenInventory(token).weapons || []).filter(usableWeapon);
    const details = characterDetails(token);
    const experiences = (details.experiences || []).filter(x => x.name);
    const stats = sheetStats(token, details.armor);
    if (token.id !== this.tokenId) this.pick = EMPTY_PICK;
    const signature = JSON.stringify([token.id, token.name, token.characterClass, stats, token.traits, token.path, token.hope, experiences, weapons.map(w => [w.id, w.name, w.range, w.trait]), this.pick, this.optionsOpen, this.targeting?.weaponId ?? null, this.targeting?.targetId ?? null, this.result]);
    if (signature === this.signature) return;
    this.signature = signature; this.tokenId = token.id; this.weapons = weapons; this.experiences = experiences;
    const dc = document.getElementById('dice_dc_select')?.value || '15';
    const { trait, exp } = this.pick, canExp = experienceAvailable(token), cost = experienceCost(token);
    const traitName = TRAITS.find(t => t.id === trait)?.name || '';
    const edgeKey = !trait ? '' : exp === null ? 'trait' : 'exp', enterEdge = edgeKey && edgeKey !== this.edgeKey ? ' pab-enter' : '';
    this.edgeKey = edgeKey;
    const edges = `<div class="pab-row pab-edge-row${enterEdge}"><span class="pab-label"></span><div class="pab-buttons">
        <button type="button" class="pab-edge-btn dis" data-pab-edge="dis">Desventaja</button>
        <button type="button" class="pab-edge-btn adv" data-pab-edge="adv">Ventaja</button></div></div>`;
    const hope = Number(token.hope) || 0;
    const expButtons = experiences.map((x, i) => `<button type="button" class="pab-exp ${exp === i ? 'selected' : ''}" data-pab-exp="${i}" ${canExp ? '' : 'disabled'} aria-pressed="${exp === i}" title="${canExp ? (cost ? 'Cuesta 1 Hope' : 'Sin coste (Sleeping)') : 'Necesitas 1 Hope'}"><b>${e(x.name)}</b><span data-no-i18n>${e(sign(experienceBonus(x)))}</span></button>`).join('');
    const expNote = !experiences.length ? '<span class="pab-tip">La ficha no tiene experiencias.</span>'
      : !canExp ? '<span class="pab-tip">Sin Hope para experiencias</span>'
      : exp !== null && cost ? `<span class="pab-hope-cost" role="status">−1 Hope · ${hope} → ${hope - 1}</span>` : '';
    const expRow = `<div class="pab-row pab-exp-row"><span class="pab-label">Experiencias</span><div class="pab-buttons">${expButtons}${expNote}</div></div>`;
    document.body.classList.toggle('pab-hope-pending', exp !== null && cost > 0);
    const subtitle = [token.characterClass, token.path].filter(Boolean).join(' · ');
    this.root.innerHTML = sanitizeHTML(`
      <header class="pab-head"><div><strong data-no-i18n>${e(token.name || '')}</strong>${subtitle ? `<small>${e(subtitle)}</small>` : ''}</div>
        <button type="button" class="hud-btn hud-btn-xs" data-pab-sheet>Ficha completa</button></header>
      ${this.statsHTML(stats)}
      <div class="pab-row">
        <span class="pab-label">Tirar</span>
        <div class="pab-buttons pab-traits">${TRAITS.map(t => `<button type="button" class="pab-trait ${trait === t.id ? 'selected' : ''}" data-pab-trait="${t.id}" aria-pressed="${trait === t.id}" title="${e(t.name)} · DC ${e(dc)}"><b>${e(t.short)}</b><span>${sign(Number(token.traits?.[t.id]) || 0)}</span></button>`).join('')}</div>
        <button type="button" class="pab-more ${this.optionsOpen ? 'active' : ''}" data-pab-options title="Opciones de la tirada" aria-expanded="${this.optionsOpen}">⋯</button>
      </div>
      ${trait && exp === null ? edges : ''}
      ${expRow}
      ${trait && exp !== null ? edges : ''}
      ${trait ? `<p class="pab-hint pab-pick-hint" role="status">${e(traitName)}${exp !== null ? ` + ${e(experiences[exp]?.name || '')}` : ''}: toca otra vez para tirar · Esc para cancelar</p>`
        : exp !== null ? `<p class="pab-hint pab-pick-hint" role="status">${e(experiences[exp]?.name || '')}: elige el Trait · Esc para cancelar</p>` : ''}
      ${this.optionsOpen ? `<div class="pab-options">
        <label class="pab-dc">DC <select data-pab-dc>${[5, 10, 12, 15, 18, 20, 25, 30].map(v => `<option value="${v}" ${String(v) === String(dc) ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <button type="button" class="hud-btn hud-btn-xs" data-pab-panel>Más opciones de tirada</button>
      </div>` : ''}
      <div class="pab-row">
        <span class="pab-label">Atacar</span>
        <div class="pab-buttons">${weapons.length ? weapons.map(w => `<button type="button" class="pab-weapon ${this.targeting?.weaponId === w.id ? 'active' : ''}" data-pab-weapon="${e(w.id)}" title="Atacar con ${e(w.name)}"><b>${e(w.name)}</b><span data-no-i18n>${e(weaponRangeBand(w) || '—')}</span></button>`).join('')
          : `<button type="button" class="pab-weapon ${this.targeting?.weaponId === '' ? 'active' : ''}" data-pab-weapon="" title="Sin armas: ataque desarmado (Melee)"><b>Desarmado</b><span>Melee</span></button>`}</div>
      </div>
      ${this.targeting ? (this.targeting.preview ? this.targetHint(this.targeting.preview) : '<p class="pab-hint" role="status">Toca el objetivo en el mapa · Esc para cancelar</p>') : ''}
      ${this.result ? this.resultRow() : ''}`);
    this.root.querySelector('[data-pab-sheet]')?.addEventListener('click', () => document.getElementById('open_sheet_btn')?.click());
    this.root.querySelectorAll('[data-pab-trait]').forEach(b => { b.onclick = () => this.tap({ kind: 'trait', id: b.dataset.pabTrait }); });
    this.root.querySelectorAll('[data-pab-exp]').forEach(b => { b.onclick = () => this.tap({ kind: 'exp', id: Number(b.dataset.pabExp) }); });
    this.root.querySelectorAll('[data-pab-weapon]').forEach(b => { b.onclick = () => (this.targeting?.weaponId === b.dataset.pabWeapon ? this.stopTargeting() : this.startTargeting(b.dataset.pabWeapon)); });
    this.root.querySelector('[data-pab-options]').onclick = () => { this.optionsOpen = !this.optionsOpen; this.render(); };
    this.root.querySelectorAll('[data-pab-edge]').forEach(b => { b.onclick = () => this.tap({ kind: 'edge', id: b.dataset.pabEdge }); });
    this.root.querySelector('[data-pab-dc]')?.addEventListener('change', event => { const panel = document.getElementById('dice_dc_select'); if (panel) { panel.value = event.target.value; panel.dispatchEvent(new Event('change')); } this.signature = ''; this.render(); });
    this.root.querySelector('[data-pab-apply]')?.addEventListener('click', () => this.applyDamage());
    this.root.querySelector('[data-pab-shields]')?.addEventListener('click', () => document.querySelector('#dmg_mitigate_btn')?.click());
    this.root.querySelector('[data-pab-clear]')?.addEventListener('click', () => { this.result = null; this.signature = ''; this.render(); });
    this.root.querySelector('[data-pab-panel]')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'dice' } })));
  }

  targetHint(t) {
    const edge = { adv: ['adv', 'Con Ventaja'], dis: ['dis', 'Con Desventaja'], normal: ['normal', 'Tirada normal'] }[t.edge || 'normal'];
    return `<div class="pab-hint pab-target" role="status">
      <div><span>Objetivo:</span> <b data-no-i18n>${e(t.name)}</b> · <span data-no-i18n>${e(t.band)} · ${e(t.meters.toFixed(1))} m</span>${t.blocked ? ' · <span>Línea de tiro bloqueada</span>' : ''}</div>
      ${t.allowed ? `<div class="pab-edge-tag ${edge[0]}"><b>${edge[1]}</b></div>` : ''}
      ${t.reasons.map(r => `<div class="pab-reason"><span>${e(r)}</span></div>`).join('')}
      <div class="pab-confirm"><span>${t.allowed ? 'Toca otra vez el objetivo para atacar' : 'Fuera de alcance: elige otro objetivo'}</span> · <span>Esc para cancelar</span></div>
    </div>`;
  }

  statsHTML(st) {
    const cell = (label, value, extra = '') => `<div class="pab-cell${extra}"><span>${label}</span><b data-no-i18n>${value}</b></div>`;
    return `<div class="pab-stats">
      <div class="pab-cells">${cell('Evasión', e(st.evasion))}${cell('Umbrales', `${e(st.thresholds[0])} / ${e(st.thresholds[1])}`)}${cell('Escudos', `${e(st.shields.current)} / ${e(st.shields.max)}`)}</div>
      <div class="pab-armor"><span>Armadura</span><b>${e(st.armor)}</b></div>
      <div class="pab-gauges">${statGaugeHTML('HP', st.hp.current, st.hp.max, 'hp')}${statGaugeHTML('STRESS', st.stress.current, st.stress.max, 'stress')}${statGaugeHTML(st.path.label, st.path.current, st.path.max, 'path')}
        ${st.resolve ? cell(`Resolve ${e(st.resolve.die)}`, `${e(st.resolve.current)} / ${e(st.resolve.max)}`, ' pab-resolve') : ''}</div>
      ${st.others.length ? `<div class="pab-others"><span>Otros</span>${st.others.map(o => `<i>${e(o)}</i>`).join('')}</div>` : ''}
    </div>`;
  }

  // Entering the player view opens Ficha; going back to the Keeper leaves it for Reparto.
  syncTabs() {
    const view = isPlayerView() ? 'player' : 'keeper';
    document.body.classList.toggle('player-view', view === 'player');
    if (view === this.view) return;
    this.view = view;
    const active = document.querySelector('.tab-nav-btn.active')?.dataset.tab;
    if (view === 'player' && !PLAYER_TABS.includes(active)) document.querySelector('.tab-nav-btn[data-tab="sheet"]')?.click();
    if (view === 'keeper' && active === 'sheet') document.querySelector('.tab-nav-btn[data-tab="roster"]')?.click();
  }

  tap(action) {
    this.stopTargeting(false);
    const { pick, roll } = tapPick(this.pick, action);
    this.pick = pick;
    if (roll) this.roll(roll);
    this.render();
  }

  // The bar sets the edge and the Experience of the dice panel, which makes the roll.
  applyRoll(edge, expMod) {
    const panel = window.veilDiceRoller?.container || document;
    const adv = panel.querySelector('#dice_advantage'), dis = panel.querySelector('#dice_disadvantage'), mod = panel.querySelector('#dice_exp_mod');
    if (adv) adv.checked = edge === 'adv';
    if (dis) dis.checked = edge === 'dis';
    if (mod) mod.value = String(expMod);
  }

  roll({ trait, exp = null, edge = 'normal' }) {
    const dice = window.veilDiceRoller, token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!dice || !token) { notify('El panel de dados todavía no está disponible.'); return; }
    const experience = exp === null ? null : this.experiences?.[exp];
    if (experience && !experienceAvailable(token)) { notify('Necesitas 1 Hope para usar una experiencia.'); return; }
    // First the actor and the Trait (changing actor clears the Experience), then edge and Experience.
    dice.setCheckData({ actor: token, traitId: trait, rollNow: false });
    this.applyRoll(edge, experience ? Math.max(1, experienceBonus(experience)) : 0);
    dice.selectTrait(trait, { rollNow: true });
  }

  startTargeting(weaponId) {
    this.stopTargeting(false);
    const canvas = window.veilCanvas?.canvas || document.getElementById('tactical_canvas');
    if (!canvas) return;
    this.targeting = { weaponId };
    if (document.getElementById('main_right_sidebar')?.classList.contains('open')) { this.reopenDrawer = true; document.getElementById('sidebar_close_btn')?.click(); }
    // Captured before the map's own handler, so the touch picks a target instead of panning.
    this.onPick = event => {
      const engine = window.veilCanvas, map = store.getActiveMap?.() || {};
      if (!engine?.screenToWorld) return;
      const rect = canvas.getBoundingClientRect(), point = event.touches?.[0] || event;
      const world = engine.screenToWorld(point.clientX - rect.left, point.clientY - rect.top);
      const target = tokenAtPoint(store.getTokensForActiveMap(), world, map.gridSize || 64, { exclude: this.tokenId });
      if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      // First touch marks the target (the map draws the line and the distance); a second
      // touch on the same token attacks it.
      if (this.targeting.targetId !== target.id) { this.markTarget(target); return; }
      // Out of reach (a melee weapon at a distance): no attack, the sheet already says why.
      if (this.targeting.preview && !this.targeting.preview.allowed) { notify(this.targeting.preview.reasons[0] || 'Fuera de alcance.', 'error'); return; }
      const chosen = this.targeting.weaponId;
      this.stopTargeting(true, { keepMark: true });
      this.attack(chosen, target);
    };
    canvas.addEventListener('pointerdown', this.onPick, true);
    document.body.classList.add('pab-targeting');
    this.render();
  }

  // The roll the attack will make, said before it is made: range, training (weapon outside the
  // character's competence) and a prepared Advantage, as the dice panel will count them.
  async markTarget(target) {
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    const weapon = (this.weapons || []).find(w => w.id === this.targeting.weaponId) || null;
    const gap = distanceInfo(token, target, store.getActiveMap?.() || {}), check = rangeCheck(weapon, gap.band);
    const targeting = this.targeting;
    targeting.targetId = target.id;
    targeting.posKey = `${token.x},${token.y},${target.x},${target.y}`;
    window.veilCanvas?.setAttackTarget?.(this.tokenId, target.id);
    const gear = await window.veilDiceRoller?.gearCheck?.(token, { weapon }).catch(() => null) || { disadvantage: false, text: '' };
    if (this.targeting !== targeting || targeting.targetId !== target.id) return;
    const edge = netEdge(!!token.pendingAdvantage, check.disadvantage || gear.disadvantage);
    const props = weaponAttackBonus(weapon, gap.band), type = damageTypeOf(weapon || ''), pen = penetrationFor(type);
    const reasons = [check.disadvantage || !check.allowed ? check.reason : '',
      props.notes.length ? `Propiedades del arma: ${props.notes.join(', ')} al ataque.` : '',
      pen ? `Daño ${type === 'energy' ? 'Energy' : type === 'void' ? 'Void' : 'Neural'}: umbrales del objetivo −${pen} en este impacto.` : '', weapon && !check.reach ? 'El arma no indica su alcance: no se aplica límite de distancia.' : '', gear.disadvantage ? gear.text.trim() : '', token.pendingAdvantage ? 'Ventaja preparada' : ''].filter(Boolean);
    targeting.preview = { name: target.name, band: gap.band, meters: gap.meters, blocked: gap.blocked, allowed: check.allowed, edge: edge.advantage ? 'adv' : edge.disadvantage ? 'dis' : 'normal', reasons };
    this.signature = ''; this.render();
  }

  stopTargeting(redraw = true, { keepMark = false } = {}) {
    const canvas = window.veilCanvas?.canvas || document.getElementById('tactical_canvas');
    if (this.onPick && canvas) canvas.removeEventListener('pointerdown', this.onPick, true);
    this.onPick = null;
    if (!this.targeting) return;
    if (this.targeting.targetId && !keepMark) window.veilCanvas?.setAttackTarget?.(null, null);
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
    const notes = damage ? (window.veilDiceRoller?.lastFeatureNotes || []) : [];
    const heat = (q('atk_detail_text')?.textContent || '').match(/Overheating: d6 \[\d\]: (?:sin problema\.|el arma se sobrecalienta[^.]*\.)/)?.[0] || '';
    return {
      targetName, outcome, notes: heat ? [...notes, heat] : notes,
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
      ${(r.notes || []).length ? `<ul class="pab-notes">${r.notes.map(n => `<li>${e(n)}</li>`).join('')}</ul>` : ''}
      ${this.resultRange ? `<div class="pab-range ${this.resultRange.penalty ? 'penalty' : ''}">Distancia: <span data-no-i18n>${e(this.resultRange.band)} · ${e(this.resultRange.meters.toFixed(1))} m</span>${this.resultRange.penalty ? ` · ${e(this.resultRange.penalty)}` : ''}</div>` : ''}
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
      this.applyRoll('normal', 0);
      await dice.executeAttack();
      // The range and its penalty, said in the bar (the panel says it in its detail line).
      const weapon = (tokenInventory(token).weapons || []).find(w => w.id === weaponId) || null;
      const gap = distanceInfo(token, target, store.getActiveMap?.() || {}), check = rangeCheck(weapon, gap.band);
      this.resultRange = { band: gap.band, meters: gap.meters, penalty: check.disadvantage ? check.reason : '' };
      this.result = this.readResult(target.name); this.signature = ''; this.render();
      if (this.reopenDrawer) { this.reopenDrawer = false; window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'sheet' } })); }
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
