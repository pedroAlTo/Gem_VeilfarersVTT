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
import { openActorPortrait } from './portraitPicker.js';
import { actorPortrait } from './tokenAvatars.js';
import { characterDetails } from './characterImport.js';
import { statGaugeHTML } from './tokenVitals.js';
import { normalizeConditions, conditionDefinition } from './conditions.js';
import { openConditions } from './conditionUI.js';
import { checkEdge, lifeStage } from './combatState.js';
import { distanceInfo, rangeCheck, weaponRangeBand, weaponAttackBonus, weaponTraitId } from './attackFlow.js';
import { weaponAttackEdge, wielderEvasion, ignoresLineOfSight, weaponReadiness, availableFollowUps, FOLLOW_UPS, areaProcedure, zoneTargets } from './weaponFeatures.js';
import { throwDice } from './tableDice.js';
import { isAdvanced, setTableMode } from './tableMode.js';
import { hasSwarmTactics } from './adversaryPassives.js';
import { openSwarmAttack } from './swarmAttackUI.js';
import { proceduralAttack } from './adversaryWeapons.js';
import { damageTypeOf, penetrationFor } from './rulesEngine.js';
import { isPath, pathBadge } from './statePowers.js';
import { clockPieHTML } from './effectClocks.js';
import { availableRiders, throwExpression } from './damageRiders.js';
import { bearDown, bearDownTarget, prepareResolve } from './bearDown.js';
import { cardData } from './cardData.js';
import { characterCards } from './loadoutCards.js';
import { network } from './networkManager.js';
import { toggleSpotlight } from './spotlight.js';
import { PREGENS, pregenSheet } from './pregens.js';

const sign = n => (n >= 0 ? `+${n}` : `${n}`);
const usableWeapon = w => w && w.damage && !/^(?:n\/?a|none|—|-)$/i.test(String(w.damage).trim());

// The bar belongs to the player stance: the player character you control, selected.
export const isPlayerView = (state = store.state) => store.sessionRole === 'player' || state.userRole === 'player';
export const PLAYER_TABS = ['sheet', 'ship', 'handouts', 'log', 'chat'];
export function barOwner(state = store.state) {
  if (!isPlayerView(state)) return null;
  // The selected character if it is a player character; otherwise (an enemy selected on the map)
  // the one being played, so the Ficha never loses it.
  const playable = t => t && t.isPlayer !== false && t.actorType !== 'drone';
  const selected = state.tokens.find(t => t.id === state.selectedTokenId);
  const token = playable(selected) ? selected : state.tokens.find(t => t.id === state.claimedTokenId);
  if (!playable(token)) return null;
  return store.sessionRole !== 'player' || store.canEditToken(token.id) ? token : null;
}

// The token under a point of the map canvas, among those the player can see and target.
// Hidden tokens only count on the Keeper's machine, which draws them (a player never gets them).
export function tokenAtPoint(tokens, world, gridSize, { exclude = '', includeHidden = false } = {}) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (!t || t.id === exclude || (t.hidden && !includeHidden)) continue;
    const radius = ((t.size || 1) * gridSize) / 2;
    if (Math.hypot(world.x - t.x, world.y - t.y) <= radius + 4) return t;
  }
  return null;
}

// The selection logic, without the DOM. `pick` is { trait, exp }; a tap is
// { kind: 'trait' | 'exp' | 'edge', id }. Returns the new pick and, when the tap rolls, the roll.
export const EMPTY_PICK = Object.freeze({ trait: null, exp: null });
// The panel of a player without a character (V3): the ten pregens of Hearts in the Void, the
// player's own characters and the creator.
function choosePanelHTML(taken) {
  return `<section class="pab-choose" aria-label="Elige tu personaje">
    <h4 class="pab-choose-title">Elige tu personaje</h4>
    <p class="pab-empty">Elige uno listo para jugar, trae uno tuyo o pide al Keeper que te asigne un token.</p>
    <div class="pab-pregens" role="list">${PREGENS.map(p => `<button type="button" role="listitem" class="pab-pregen" data-pab-pregen="${e(p.id)}" ${taken.has(p.name) ? 'disabled aria-disabled="true" title="Ya está en la mesa"' : ''}><b data-no-i18n>${e(p.name)}</b><small>${e(p.blurb)}</small></button>`).join('')}</div>
    <p class="pab-choose-source">Pregenerados de <i>Hearts in the Void</i> · nivel 1, Sleeping.</p>
    <div class="pab-choose-more"><button type="button" class="hud-btn" data-pab-mine>Mis personajes</button><button type="button" class="hud-btn" data-pab-create>Crear personaje</button></div>
  </section>`;
}
export async function pregenToken(id) {
  const pregen = PREGENS.find(p => p.id === id);
  if (!pregen) throw new Error('Ese personaje no existe.');
  const [{ CREATOR_DATA }, { parseCharacterJSON }] = await Promise.all([import('./creator/creatorData.js'), import('./characterImport.js')]);
  return parseCharacterJSON(pregenSheet(pregen, CREATOR_DATA)).token;
}

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
  if (tap.kind === 'edge') return { pick: EMPTY_PICK, roll: { trait: cur.trait, exp: cur.exp, edge: ['adv', 'dis'].includes(tap.id) ? tap.id : 'normal' } };
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
    effects: (token.effectClocks || []).map(c => ({ id: c.id, name: isPath(c.name) ? pathBadge(c) : c.name, segments: c.segments, filled: c.filled, die: c.die || '' })),
  };
}

// The shortcuts of the player's bar, said by «?» (v2.48.0).
export const SHORTCUTS_HELP = 'Atajos: 1–9 atacar con el arma de ese lugar (0 desarmado) · Enter ataca al objetivo marcado · F tomar foco · flechas mueven tu personaje · Esc cancela.';

export class PlayerActionBar {
  constructor(parent) {
    this.root = document.createElement('section');
    this.root.id = 'player_action_bar'; this.root.className = 'player-action-bar';
    this.root.setAttribute('aria-label', 'Acciones del personaje');
    parent.append(this.root);
    this.signature = ''; this.targeting = null; this.pick = EMPTY_PICK; this.optionsOpen = false; this.view = null;
    store.subscribe(() => this.render());
    // A roll's result arrives after the state changes it caused: redraw so Bear Down can be used.
    window.addEventListener('veil:guide', event => { if (event.detail?.event === 'roll') { this.signature = ''; this.render(); } });
    // Damage applied ends the attack: after a moment to read «Daño aplicado», the result, the
    // marked target and the selection are cleared.
    window.addEventListener('veil:attack-done', () => {
      clearTimeout(this.doneTimer);
      this.doneTimer = setTimeout(() => {
        if (this.targeting) return; // a new attack has already started
        // A second target, a second attack or the rest of an area still to come: the result stays
        // (applied) with their buttons; × closes it (v2.46.0).
        const more = this.followUps().length > 0 || !!this.areaQueue?.items?.some(i => !i.done);
        this.keeperAttack = false; this.result = more && this.result ? { ...this.result, applied: true } : null; this.signature = '';
        if (!more) this.areaQueue = null;
        window.veilCanvas?.setAttackTarget?.(null, null);
        store.update({ selectedTokenId: null, targetTokenId: null });
        this.render();
      }, 1200);
    });
    window.addEventListener('keydown', event => { if (event.key !== 'Escape') return; if (this.targeting) this.stopTargeting(); else if (this.pick.trait || this.pick.exp !== null) { this.pick = EMPTY_PICK; this.render(); } });
    // Keyboard shortcuts (v2.48.0, Plan de UX V3, fase 2): 1–9 attack with the weapon in that place
    // of the bar (0 unarmed), Enter attacks the marked target, F takes the Spotlight, ? lists them.
    // In the capture phase: Enter on a marked target attacks before it would open the table chat.
    window.addEventListener('keydown', event => this.shortcut(event), true);
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
      if (this.keeperAttack) return; // the Keeper is aiming with an adversary (startKeeperAttack)
      this.edgeKey = '';
      this.stopTargeting(false); document.body.classList.remove('pab-hope-pending');
      // No character yet (V3): pick one ready to play, bring one of yours or make one. Nothing
      // forces the choice (HANDOVER §1): the Keeper can still assign a token at any time.
      const taken = store.state.tokens.filter(t => t.isPlayer !== false).map(t => t.name).join('|');
      const signature = 'empty:' + taken;
      if (this.signature !== signature) {
        this.signature = signature; this.tokenId = null;
        this.root.innerHTML = sanitizeHTML(choosePanelHTML(new Set(store.state.tokens.filter(t => t.isPlayer !== false).map(t => t.name))));
        this.bindChoose();
      }
      return;
    }
    // The target marked for an attack: if either token moves, the distance is worked out again.
    if (this.targeting?.targetId) {
      const target = store.state.tokens.find(t => t.id === this.targeting.targetId);
      const key = target ? JSON.stringify([token.x, token.y, target.x, target.y, token.conditions, token.stress, target.conditions, token.pendingAdvantage]) : '';
      if (!target) this.stopTargeting(false);
      else if (this.targeting.posKey && key !== this.targeting.posKey) { this.targeting.posKey = key; this.markTarget(target); }
    }
    const weapons = (tokenInventory(token).weapons || []).filter(usableWeapon);
    const details = characterDetails(token);
    const experiences = (details.experiences || []).filter(x => x.name);
    const stats = sheetStats(token, details.armor);
    if (token.id !== this.tokenId) this.pick = EMPTY_PICK;
    const signature = JSON.stringify([token.id, token.name, token.characterClass, actorPortrait(token), store.canEditToken(token.id), stats, bearDownTarget(token.id), this.bearCount || 1, window.veilDiceRoller?.lastDamage?.riders?.length || 0, token.traits, token.path, token.hope, !!token.hasSpotlight, experiences, weapons.map(w => [w.id, w.name, w.range, w.trait, !!w.spent, !!w.charged]), this.pick, this.optionsOpen, this.targeting?.weaponId ?? null, this.targeting?.targetId ?? null, this.result, this.lastAttackCtx, this.areaQueue]);
    if (signature === this.signature) return;
    this.signature = signature; this.tokenId = token.id; this.weapons = weapons; this.experiences = experiences;
    const dc = document.getElementById('dice_dc_select')?.value || '15';
    const { trait, exp } = this.pick, canExp = experienceAvailable(token), cost = experienceCost(token);
    const traitName = TRAITS.find(t => t.id === trait)?.name || '';
    const edgeKey = !trait ? '' : exp === null ? 'trait' : 'exp', enterEdge = edgeKey && edgeKey !== this.edgeKey ? ' pab-enter' : '';
    this.edgeKey = edgeKey;
    const edges = `<div class="pab-row pab-edge-row${enterEdge}"><span class="pab-label"></span><div class="pab-buttons pab-edge-three">
        <button type="button" class="pab-edge-btn normal" data-pab-edge="normal">Normal</button>
        <button type="button" class="pab-edge-btn adv" data-pab-edge="adv">Ventaja</button>
        <button type="button" class="pab-edge-btn dis" data-pab-edge="dis">Desventaja</button></div></div>`;
    const hope = Number(token.hope) || 0;
    const expButtons = experiences.map((x, i) => `<button type="button" class="pab-exp ${exp === i ? 'selected' : ''}" data-pab-exp="${i}" ${canExp ? '' : 'disabled'} aria-pressed="${exp === i}" title="${canExp ? (cost ? 'Cuesta 1 Hope' : 'Sin coste (Sleeping)') : 'Necesitas 1 Hope'}"><b>${e(x.name)}</b><span data-no-i18n>${e(sign(experienceBonus(x)))}</span></button>`).join('');
    const expNote = !experiences.length ? '<span class="pab-tip">La ficha no tiene experiencias.</span>'
      : !canExp ? '<span class="pab-tip">Sin Hope para experiencias</span>'
      : exp !== null && cost ? `<span class="pab-hope-cost" role="status">−1 Hope · ${hope} → ${hope - 1}</span>` : '';
    const expRow = `<div class="pab-row pab-exp-row"><span class="pab-label">Experiencias</span><div class="pab-buttons">${expButtons}${expNote}</div></div>`;
    document.body.classList.toggle('pab-hope-pending', exp !== null && cost > 0);
    const stage = lifeStage(token);
    const subtitle = [token.characterClass, token.path].filter(Boolean).join(' · ');
    this.root.innerHTML = sanitizeHTML(`
      <header class="pab-head">${store.canEditToken(token.id) ? `<button type="button" class="actor-portrait-button pab-portrait-button" data-pab-portrait title="Cambiar retrato" aria-label="Cambiar retrato"><img src="${e(actorPortrait(token))}" alt=""></button>` : ''}<div><strong data-no-i18n>${e(token.name || '')}</strong>${subtitle ? `<small>${e(subtitle)}</small>` : ''}</div>
        <button type="button" class="pab-focus ${token.hasSpotlight ? 'is-on' : ''}" data-pab-focus aria-pressed="${!!token.hasSpotlight}" title="${token.hasSpotlight ? 'Tienes el foco · pulsa para quitarlo' : 'Tomar el foco'}" ${store.canEditToken(token.id) ? '' : 'disabled'}>✨ ${token.hasSpotlight ? 'Con el foco' : 'Tomar foco'}</button></header>
      ${this.statsHTML(stats)}
      ${stage ? '<button type="button" class="hud-btn" data-pab-life>' + e(stage) + ' · <span>Ver estado del personaje</span></button>' : ''}
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
        <button type="button" class="hud-btn hud-btn-xs" data-pab-keys title="${e(SHORTCUTS_HELP)}">Atajos <kbd>?</kbd></button>
        <button type="button" class="hud-btn hud-btn-xs" data-pab-mode aria-pressed="${isAdvanced()}" title="Básico: la mesa elige lo habitual (Lucky Break relanza el dado más bajo). Avanzado: te pregunta y muestra todas las opciones.">Modo: ${isAdvanced() ? 'Avanzado' : 'Básico'}</button>
      </div>` : ''}
      <div class="pab-row">
        <span class="pab-label">Atacar</span>
        <div class="pab-buttons">${weapons.length ? weapons.map((w, i) => { const ready = weaponReadiness(w), kbd = i < 9 ? `<kbd class="pab-key" aria-hidden="true">${i + 1}</kbd>` : '';
          // Reload / Charge-Up (v2.45.0): a spent or uncharged weapon offers its Action instead.
          return ready.ready ? `<button type="button" class="pab-weapon ${this.targeting?.weaponId === w.id ? 'active' : ''}" data-pab-weapon="${e(w.id)}" title="Atacar con ${e(w.name)}">${kbd}<b>${e(w.name)}</b><span data-no-i18n>${e(weaponRangeBand(w) || '—')}</span></button>`
            : `<button type="button" class="pab-weapon pab-weapon-unready" data-pab-ready="${e(w.id)}" title="${e(ready.reason)}"><b>${e(w.name)}</b><span>${e(ready.action)}</span></button>`; }).join('')
          : `<button type="button" class="pab-weapon ${this.targeting?.weaponId === '' ? 'active' : ''}" data-pab-weapon="" title="Sin armas: ataque desarmado (Melee)"><b>Desarmado</b><span>Melee</span></button>`}</div>
      </div>
      ${this.targeting ? (this.targeting.preview ? this.targetHint(this.targeting.preview) : '<p class="pab-hint" role="status">Toca el objetivo en el mapa · Esc para cancelar</p>') : ''}
      ${this.result ? this.resultRow() : ''}`);
    this.root.querySelector('[data-pab-portrait]')?.addEventListener('click', () => openActorPortrait(token.id));
    this.root.querySelector('[data-pab-focus]')?.addEventListener('click', () => { if (toggleSpotlight(token.id)) { this.signature = ''; this.render(); } });
    if (stage) {
      this.root.querySelector('[data-pab-life]').onclick = () => openConditions(token.id);
      this.root.querySelectorAll('[data-pab-trait], [data-pab-weapon], [data-pab-bear], [data-pab-apply], [data-pab-attack-edge]').forEach(b => { b.disabled = true; });
    }
    this.root.querySelectorAll('[data-pab-trait]').forEach(b => { b.onclick = () => this.tap({ kind: 'trait', id: b.dataset.pabTrait }); });
    this.root.querySelectorAll('[data-pab-exp]').forEach(b => { b.onclick = () => this.tap({ kind: 'exp', id: Number(b.dataset.pabExp) }); });
    this.root.querySelectorAll('[data-pab-weapon]').forEach(b => { b.onclick = () => (this.targeting?.weaponId === b.dataset.pabWeapon ? this.stopTargeting() : this.startTargeting(b.dataset.pabWeapon)); });
    this.root.querySelectorAll('[data-pab-ready]').forEach(b => { b.onclick = () => network.requestAction({ type: 'WEAPON_READY', actorId: token.id, weaponId: b.dataset.pabReady, playerName: store.state.userName || '', tokenName: token.name })
      .then(r => { notify(r.mode === 'reload' ? 'Arma recargada (una Acción).' : 'Arma cargada: podrá disparar en un Spotlight posterior.'); this.signature = ''; this.render(); }).catch(error => notify(error.message, 'error')); });
    this.root.querySelector('[data-pab-options]').onclick = () => { this.optionsOpen = !this.optionsOpen; this.render(); };
    this.root.querySelector('[data-pab-keys]')?.addEventListener('click', () => notify(SHORTCUTS_HELP));
    this.root.querySelector('[data-pab-mode]')?.addEventListener('click', () => { const mode = setTableMode(isAdvanced() ? 'basic' : 'advanced'); notify(mode === 'advanced' ? 'Modo Avanzado: la mesa te pregunta antes y muestra todas las opciones.' : 'Modo Básico: la mesa elige lo habitual con menos clics.'); this.signature = ''; this.render(); });
    this.root.querySelectorAll('[data-pab-edge]').forEach(b => { b.onclick = () => this.tap({ kind: 'edge', id: b.dataset.pabEdge }); });
    this.root.querySelector('[data-pab-dc]')?.addEventListener('change', event => { const panel = document.getElementById('dice_dc_select'); if (panel) { panel.value = event.target.value; panel.dispatchEvent(new Event('change')); } this.signature = ''; this.render(); });
    this.root.querySelector('[data-pab-apply]')?.addEventListener('click', () => this.applyDamage());
    this.root.querySelectorAll('[data-pab-attack-edge]').forEach(b => { b.onclick = () => this.confirmAttack(b.dataset.pabAttackEdge); });
    this.root.querySelector('[data-pab-shields]')?.addEventListener('click', () => document.querySelector('#dmg_mitigate_btn')?.click());
    this.root.querySelectorAll('[data-pab-rider]').forEach(b => { b.onclick = () => this.useRider(b.dataset.pabRider); });
    this.root.querySelectorAll('[data-pab-follow]').forEach(b => { b.onclick = () => this.startFollowUp(b.dataset.pabFollow); });
    this.root.querySelectorAll('[data-pab-area]').forEach(b => { b.onclick = () => this.areaDamage(b.dataset.pabArea, Number(b.dataset.share)); });
    this.root.querySelectorAll('[data-pab-bear-step]').forEach(b => { b.onclick = () => { this.bearCount = Math.max(1, (this.bearCount || 1) + Number(b.dataset.pabBearStep)); this.signature = ''; this.render(); }; });
    this.root.querySelector('[data-pab-bear]')?.addEventListener('click', () => this.useBearDown());
    this.root.querySelectorAll('[data-pab-prepare]').forEach(b => { b.onclick = () => this.prepare(b.dataset.pabPrepare); });
    this.root.querySelector('[data-pab-clear]')?.addEventListener('click', () => { this.result = null; this.areaQueue = null; this.lastAttackCtx = null; this.signature = ''; this.render(); });
    this.root.querySelector('[data-pab-panel]')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'dice' } })));
  }

  bindChoose() {
    this.root.querySelectorAll('[data-pab-pregen]').forEach(button => {
      button.onclick = async () => {
        if (button.disabled) return;
        this.root.querySelectorAll('[data-pab-pregen]').forEach(b => { b.disabled = true; });
        try {
          const token = await pregenToken(button.dataset.pabPregen);
          const { useCharacter } = await import('./accountUI.js');
          await useCharacter(token);
          notify(`${token.name} está en la mesa.`);
        } catch (error) { notify(error.message, 'error'); this.signature = ''; this.render(); }
      };
    });
    const mine = this.root.querySelector('[data-pab-mine]');
    if (mine) mine.onclick = async () => { const { openAccount } = await import('./accountUI.js'); openAccount({ tab: 'characters' }); };
    const create = this.root.querySelector('[data-pab-create]');
    if (create) create.onclick = async () => { const { openCharacterCreator } = await import('./creator/creatorUI.js'); openCharacterCreator(); };
  }

  targetHint(t) {
    // A second target with no new roll (Automatic, Salvo Fire, Arc): one more touch confirms it.
    if (t.followUp) return `<div class="pab-hint pab-target" role="status">
      <div><span>${e(t.followUp)}:</span> <b data-no-i18n>${e(t.name)}</b> · <span data-no-i18n>${e(t.band)} · ${e(t.meters.toFixed(1))} m</span></div>
      ${t.reasons.map(r => `<div class="pab-reason"><span>${e(r)}</span></div>`).join('')}
      <div class="pab-confirm"><span>Toca otra vez el objetivo para confirmarlo</span> · <span>Esc para cancelar</span></div>
    </div>`;
    const edge = { adv: ['adv', 'Con Ventaja'], dis: ['dis', 'Con Desventaja'], normal: ['normal', 'Tirada normal'] }[t.edge || 'normal'];
    return `<div class="pab-hint pab-target" role="status">
      <div><span>Objetivo:</span> <b data-no-i18n>${e(t.name)}</b> · <span data-no-i18n>${e(t.band)} · ${e(t.meters.toFixed(1))} m</span>${t.blocked ? ' · <span>Línea de tiro bloqueada</span>' : ''}</div>
      ${t.allowed ? `<div class="pab-edge-tag ${edge[0]}"><b>${edge[1]}</b></div>` : ''}
      ${t.reasons.map(r => `<div class="pab-reason"><span>${e(r)}</span></div>`).join('')}
      ${t.allowed ? `<div class="pab-buttons pab-attack-edges pab-edge-three"><button type="button" class="pab-edge-btn normal" data-pab-attack-edge="normal">Normal</button><button type="button" class="pab-edge-btn adv" data-pab-attack-edge="adv">Ventaja</button><button type="button" class="pab-edge-btn dis" data-pab-attack-edge="dis">Desventaja</button></div>` : ''}
      <div class="pab-confirm"><span>${t.allowed ? 'Toca otra vez el objetivo para atacar sin ventaja' : 'Fuera de alcance: elige otro objetivo'}</span> · <span>Esc para cancelar</span></div>
    </div>`;
  }

  // Resolve: one small yellow mark per point, a triangle for d4 dice and a square for d6;
  // lit while the point is available, dim once it is spent.
  resolveHTML(r) {
    const shape = String(r.die).toLowerCase() === 'd4' ? 'tri' : 'sq';
    const target = bearDownTarget(this.tokenId), n = Math.max(1, Math.min(Number(r.current) || 1, this.bearCount || 1));
    const controls = `<div class="pab-resolve-actions">
      <span class="pab-bear"><button type="button" class="pab-step" data-pab-bear-step="-1" aria-label="Un dado menos" ${n <= 1 ? 'disabled' : ''}>−</button><b data-no-i18n>${n}${e(r.die)}</b><button type="button" class="pab-step" data-pab-bear-step="1" aria-label="Un dado más" ${n >= (r.current || 0) ? 'disabled' : ''}>+</button>
      <button type="button" class="hud-btn hud-btn-xs" data-pab-bear ${target && r.current > 0 ? '' : 'disabled'} title="${target === 'damage' ? 'Suma los dados al daño que aún no se ha aplicado' : target ? 'Suma los dados al total de tu última tirada (no cambia Hope/Fear ni hace crítico)' : 'Tira primero; Bear Down se usa antes de narrar el resultado'}">Bear Down${target === 'damage' ? ' · daño' : ''}</button></span>
      <span class="pab-prepare"><button type="button" class="hud-btn hud-btn-xs" data-pab-prepare="short" ${r.current >= r.max ? 'disabled' : ''} title="Descanso corto con Prepare: recupera 1 Resolve">Prepare +1</button><button type="button" class="hud-btn hud-btn-xs" data-pab-prepare="long" ${r.current >= r.max ? 'disabled' : ''} title="Descanso largo con Prepare: Resolve al máximo">Prepare · lleno</button></span></div>`;
    const pips = Array.from({ length: Math.max(0, Number(r.max) || 0) }, (_, i) => `<i class="pab-res ${shape} ${i < (Number(r.current) || 0) ? 'on' : ''}"></i>`).join('');
    return `<div class="pab-cell pab-resolve" title="Resolve ${e(r.current)} / ${e(r.max)} (${e(r.die)})"><span>Resolve ${e(r.die)}</span><span class="pab-res-row" role="meter" aria-label="Resolve" aria-valuemin="0" aria-valuemax="${e(r.max)}" aria-valuenow="${e(r.current)}">${pips || '<b data-no-i18n>0</b>'}</span>${controls}</div>`;
  }

  statsHTML(st) {
    const cell = (label, value, extra = '') => `<div class="pab-cell${extra}"><span>${label}</span><b data-no-i18n>${value}</b></div>`;
    return `<div class="pab-stats">
      <div class="pab-cells">${cell('Evasión', e(st.evasion))}${cell('Umbrales', `${e(st.thresholds[0])} / ${e(st.thresholds[1])}`)}${cell('Escudos', `${e(st.shields.current)} / ${e(st.shields.max)}`)}</div>
      <div class="pab-armor"><span>Armadura</span><b>${e(st.armor)}</b></div>
      <div class="pab-gauges">${statGaugeHTML('HP', st.hp.current, st.hp.max, 'hp')}${statGaugeHTML('STRESS', st.stress.current, st.stress.max, 'stress')}${statGaugeHTML(st.path.label, st.path.current, st.path.max, 'path')}
        ${st.resolve ? this.resolveHTML(st.resolve) : ''}</div>
      ${st.effects.length ? `<div class="pab-effects"><span>Efectos</span>${st.effects.map(c => `<i title="${e(c.name)}: ${c.filled} de ${c.segments} segmentos marcados">${clockPieHTML(c, 18)}<b data-no-i18n>${e(c.name)}</b><small>${c.die ? `${e(c.die)} · ${c.segments - c.filled}` : `${c.segments - c.filled}/${c.segments}`}</small></i>`).join('')}</div>` : ''}
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

  // The Keeper's normal attack with an adversary, from the character bar (⚔ ATACAR): the same two
  // touches as a player's (mark the target, touch it again), said in notices because the Keeper's
  // panel has no Ficha tab; the result and «Aplicar daño» stay in the dice panel.
  startKeeperAttack(tokenId) {
    const token = store.state.tokens.find(t => t.id === tokenId);
    if (!token) return;
    const weapons = (tokenInventory(token).weapons || []).filter(usableWeapon);
    if (!weapons.length) { notify(proceduralAttack(token) ? 'Este adversario se resuelve mediante las habilidades y objetivos de su ficha.' : 'Este adversario no tiene ataque en su ficha: indica su daño para atacar.', 'error'); return; }
    this.keeperAttack = true; this.tokenId = tokenId; this.weapons = weapons;
    window.veilDiceDock?.close(); // the map must be free to pick the target; the result reopens it
    this.startTargeting(weapons[0].id);
    this.keeperPanel();
  }

  // The Keeper's aiming panel, floating over the map: who attacks, the marked target with its
  // distance and roll, and Disadvantage / Advantage (a second touch on the target attacks plainly).
  keeperPanel() {
    let box = document.getElementById('keeper_attack_panel');
    if (!this.keeperAttack || !this.targeting) { box?.remove(); return; }
    if (!box) {
      box = document.createElement('section'); box.id = 'keeper_attack_panel'; box.className = 'keeper-attack-panel';
      for (const type of ['pointerdown', 'mousedown', 'wheel', 'dblclick']) box.addEventListener(type, event => event.stopPropagation());
      (document.getElementById('canvas_viewport_root') || document.body).append(box);
    }
    const attacker = store.state.tokens.find(t => t.id === this.tokenId), weapon = (this.weapons || []).find(w => w.id === this.targeting.weaponId);
    const p = this.targeting.preview;
    box.innerHTML = sanitizeHTML(`<header><b data-no-i18n>${e(attacker?.name || '')}</b> · <span data-no-i18n>${e(weapon?.name || '')}</span><button type="button" class="pab-more" data-kap-cancel aria-label="Cancelar el ataque">×</button></header>
      ${p ? this.targetHint(p) : '<p class="pab-hint" role="status">Toca el objetivo en el mapa · Esc para cancelar</p>'}`);
    if (this.weapons.length > 1) {
      const menu = document.createElement('vf-select');
      menu.setAttribute('aria-label', 'Ataque del adversario');
      for (const w of this.weapons) {
        const option = document.createElement('option');
        option.value = w.id;
        option.textContent = w.name + ' · ' + w.damage;
        if (w.id === weapon?.id) option.setAttribute('selected', '');
        menu.append(option);
      }
      box.querySelector('header').after(menu);
      menu.onchange = () => {
        this.targeting.weaponId = menu.value;
        const marked = store.state.tokens.find(t => t.id === this.targeting.targetId);
        if (marked) this.markTarget(marked); else this.keeperPanel();
      };
    }
    if (hasSwarmTactics(attacker) && attacker.hp.current >= 3) {
      const swarm = document.createElement('button');
      swarm.type = 'button'; swarm.className = 'hud-btn'; swarm.textContent = 'Swarm Tactics · dos objetivos';
      swarm.onclick = () => openSwarmAttack(attacker.id, this.targeting.targetId);
      box.append(swarm);
    }
    box.querySelector('[data-kap-cancel]').onclick = () => this.stopTargeting();
    box.querySelectorAll('[data-pab-attack-edge]').forEach(b => { b.onclick = () => this.confirmAttack(b.dataset.pabAttackEdge); });
  }

  startTargeting(weaponId, followUp = null) {
    this.stopTargeting(false);
    const canvas = window.veilCanvas?.canvas || document.getElementById('tactical_canvas');
    if (!canvas) return;
    this.targeting = { weaponId, ...(followUp ? { followUp } : {}) };
    if (document.getElementById('main_right_sidebar')?.classList.contains('open')) { this.reopenDrawer = true; document.getElementById('sidebar_close_btn')?.click(); }
    // Captured before the map's own handler, so the touch picks a target instead of panning.
    this.onPick = event => {
      const engine = window.veilCanvas, map = store.getActiveMap?.() || {};
      if (!engine?.screenToWorld) return;
      const rect = canvas.getBoundingClientRect(), point = event.touches?.[0] || event;
      const world = engine.screenToWorld(point.clientX - rect.left, point.clientY - rect.top);
      const target = tokenAtPoint(store.getTokensForActiveMap(), world, map.gridSize || 64, { exclude: this.tokenId, includeHidden: store.sessionRole !== 'player' });
      if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      // A second target must be another one (Automatic, Salvo Fire, Arc, Cleave).
      const follow = this.targeting.followUp;
      if (follow && FOLLOW_UPS[follow.kind]?.other && target.id === follow.primaryId) { notify(`${FOLLOW_UPS[follow.kind].label}: elige otro objetivo distinto del primero.`, 'error'); return; }
      // First touch marks the target (the map draws the line and the distance); a second
      // touch on the same token attacks it.
      if (this.targeting.targetId !== target.id) { follow && !FOLLOW_UPS[follow.kind]?.attack ? this.markFollowTarget(target) : this.markTarget(target); return; }
      // Out of reach (a melee weapon at a distance): no attack, the sheet already says why.
      if (this.targeting.preview && !this.targeting.preview.allowed) { notify(this.targeting.preview.reasons[0] || 'Fuera de alcance.', 'error'); return; }
      this.confirmAttack('normal');
    };
    canvas.addEventListener('pointerdown', this.onPick, true);
    // Two quick touches on the target also make a double-click (and clicks) on the map, which
    // would open that token's sheet ("Selecciona uno de tus tokens asignados") or select it. While
    // aiming, and for a moment after the attack, the map does not get them.
    if (!this.swallowInstalled) {
      this.swallowInstalled = true;
      const swallow = event => { if (this.targeting || performance.now() < (this.swallowUntil || 0)) { event.preventDefault(); event.stopImmediatePropagation(); } };
      for (const type of ['dblclick', 'click', 'mousedown', 'mouseup', 'pointerup', 'contextmenu']) canvas.addEventListener(type, swallow, true);
    }
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
    targeting.posKey = JSON.stringify([token.x, token.y, target.x, target.y, token.conditions, token.stress, target.conditions, token.pendingAdvantage]);
    window.veilCanvas?.setAttackTarget?.(this.tokenId, target.id);
    const gear = await window.veilDiceRoller?.gearCheck?.(token, { weapon }).catch(() => null) || { disadvantage: false, text: '' };
    if (this.targeting !== targeting || targeting.targetId !== target.id) return;
    const roller = token.actorType === 'drone' ? store.state.tokens.find(t => t.id === token.drone?.operatorId) : token;
    // The weapon's properties, said before the roll (Plan de UX V3, fase 4): Heavy, the defender's
    // weapons (Massive, Defensive), what the player decides first (Unwieldy, Overcharge…).
    const heavy = weaponAttackEdge(token.actorType === 'drone' ? null : weapon, roller);
    const melee = weapon ? weaponRangeBand(weapon) === 'Melee' || (!weaponRangeBand(weapon) && gap.band === 'Melee') : gap.band === 'Melee';
    const held = wielderEvasion(tokenInventory(target).weapons, { melee });
    const edge = checkEdge(roller, target, false, check.disadvantage || gear.disadvantage || heavy.disadvantage, weaponTraitId(weapon));
    const props = weaponAttackBonus(weapon, gap.band), type = damageTypeOf(weapon || ''), pen = penetrationFor(type);
    const reasons = [check.disadvantage || !check.allowed ? check.reason : '',
      props.notes.length ? `Propiedades del arma: ${props.notes.join(', ')} al ataque.` : '',
      ...heavy.notes, held.notes.length ? `Evasion de ${target.name}: ${held.notes.join(', ')}.` : '', ...heavy.ahead,
      gap.blocked && ignoresLineOfSight(weapon) ? 'El arma no necesita línea de tiro.' : '',
      pen ? `Daño ${type === 'energy' ? 'Energy' : type === 'void' ? 'Void' : 'Neural'}: umbrales del objetivo −${pen} en este impacto.` : '', weapon && !check.reach ? 'El arma no indica su alcance: no se aplica límite de distancia.' : '', gear.disadvantage ? gear.text.trim() : '', token.pendingAdvantage ? 'Ventaja preparada' : ''].filter(Boolean);
    if (lifeStage(roller)) reasons.unshift('El personaje no puede atacar en este estado.');
    targeting.preview = { name: target.name, band: gap.band, meters: gap.meters, blocked: gap.blocked && !ignoresLineOfSight(weapon), allowed: check.allowed && !lifeStage(roller), edge: edge.advantage ? 'adv' : edge.disadvantage ? 'dis' : 'normal', reasons };
    if (this.keeperAttack) this.keeperPanel();
    this.signature = ''; this.render();
  }

  stopTargeting(redraw = true, { keepMark = false } = {}) {
    const canvas = window.veilCanvas?.canvas || document.getElementById('tactical_canvas');
    if (this.onPick && canvas) canvas.removeEventListener('pointerdown', this.onPick, true);
    this.onPick = null;
    if (!this.targeting) return;
    if (this.targeting.targetId && !keepMark) window.veilCanvas?.setAttackTarget?.(null, null);
    if (!keepMark) this.keeperAttack = false;
    document.getElementById('keeper_attack_panel')?.remove();
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
      canApply: !!(damage && apply && !apply.disabled), shields: !!(damage && mitigate && mitigate.style.display !== 'none'), applied: !!(apply && /APPLIED|APLICADO|ENVIADO/i.test(apply.textContent || '')), sent: !!(apply && /ENVIADO/i.test(apply.textContent || '')),
    };
  }
  resultRow() {
    const r = this.result;
    const hit = r.raw !== '';
    return `<div class="pab-row pab-result ${hit ? 'hit' : 'miss'}" role="status">
      <span class="pab-label">Resultado</span>
      <div class="pab-result-text"><b>${e(r.outcome || '—')}</b> <span>${e(r.targetName)}</span>${hit ? ` · <span>${e(r.raw)} de daño · ${e(r.severity)} · ${e(r.loss)}</span>` : ''}</div>
      ${(r.notes || []).length ? `<ul class="pab-notes">${r.notes.map(n => `<li>${e(n)}</li>`).join('')}</ul>` : ''}
      ${hit && !r.applied ? this.ridersHTML() : ''}
      ${this.followHTML()}
      ${this.areaHTML()}
      ${this.resultRange ? `<div class="pab-range ${this.resultRange.penalty ? 'penalty' : ''}">Distancia: <span data-no-i18n>${e(this.resultRange.band)} · ${e(this.resultRange.meters.toFixed(1))} m</span>${this.resultRange.penalty ? ` · ${e(this.resultRange.penalty)}` : ''}</div>` : ''}
      <div class="pab-result-actions">${hit && !r.applied ? `<button type="button" class="pab-apply-main" data-pab-apply ${r.canApply ? '' : 'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg><span>${store.sessionRole === 'player' ? 'Enviar daño al Keeper' : 'Aplicar daño'}</span>${r.loss ? `<b>${e(r.loss)}</b>` : ''}</button>` : ''}${hit && r.shields && !r.applied ? '<button type="button" class="hud-btn hud-btn-xs" data-pab-shields>Escudos</button>' : ''}${r.applied ? `<span class="pab-applied">${r.sent ? 'Enviado al Keeper: él decide' : 'Daño aplicado'}</span>` : ''}<button type="button" class="pab-more" data-pab-clear aria-label="Quitar el resultado">×</button></div>
    </div>`;
  }
  // Effects that add damage to this attack (Combat Surge, The Held Line, Breaking Point).
  riders() {
    const dice = window.veilDiceRoller, d = dice?.lastDamage, token = store.state.tokens.find(t => t.id === this.tokenId), data = cardData();
    if (!d || d.applied || d.actorId !== this.tokenId || !token || !data) return [];
    return availableRiders(token, characterCards(token, data), (d.riders || []).map(x => x.id));
  }
  ridersHTML() {
    const list = this.riders();
    return list.length ? `<div class="pab-riders">${list.map(r => `<button type="button" class="hud-btn hud-btn-xs" data-pab-rider="${e(r.id)}" ${r.enough ? '' : 'disabled'} title="${e(r.label)}: +${e(r.dice)} al daño de este ataque (${e(r.cost)})">${e(r.label)} · <span data-no-i18n>+${e(r.dice)}</span> · ${e(r.cost)}</button>`).join('')}</div>` : '';
  }
  async useBearDown() {
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token?.resolve?.current) return;
    try {
      const { summary } = await bearDown(token, Math.min(token.resolve.current, this.bearCount || 1));
      notify(summary); this.bearCount = 1;
      setTimeout(() => { if (this.result) this.result = this.readResult(this.result.targetName); this.signature = ''; this.render(); }, 300);
    } catch (error) { notify(error.message, 'error'); }
  }
  prepare(rest) {
    const token = store.state.tokens.find(t => t.id === this.tokenId), patch = prepareResolve(token, rest);
    if (!patch) return;
    const before = store.tableActing; if (store.sessionRole !== 'player') store.tableActing = true;
    try { store.updateToken(token.id, patch); } finally { store.tableActing = before; }
    notify(`Prepare (${rest === 'long' ? 'descanso largo' : 'descanso corto'}): Resolve ${patch.resolve.current}/${patch.resolve.max}.`);
  }
  async startClosingStrike(token, card, weaponId) {
    const pending = window.veilDiceRoller?.pendingDamageFor(token.id);
    if (pending?.checkId) return this.useRider('breaking-point');
    if (this.tokenId !== token.id) return false;
    this.startTargeting(weaponId || '');
    if (!this.targeting) return false;
    this.targeting.closingId = card.clockId;
    notify('Breaking Point: elige el objetivo de tu acción. Esc cancela sin terminar el estado.');
    return true;
  }
  async useRider(id) {
    const rider = this.riders().find(r => r.id === id), dice = window.veilDiceRoller, token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!rider || !dice || !token || this.busyRider) return false;
    const pending = dice.pendingDamageFor(token.id);
    if (!pending || (rider.kind === 'state' && !pending.checkId)) return false;
    this.busyRider = true;
    try {
      // The table pays the card (Hope / Effort) as when it is played from the hand.
      if (rider.kind === 'card') await network.requestAction({ type: 'CARD_PLAY', actorId: token.id, cardId: rider.cardId, playerName: store.state.userName || '', tokenName: token.name });
      // Breaking Point ends the state.
      if (rider.kind === 'state') {
        const card = characterCards(token, cardData()).find(c => c.reverse);
        if (!card) return false;
        const result = await network.requestAction({ type: 'CARD_PLAY', actorId: token.id, cardId: card.id, clockId: rider.clockId, checkId: pending.checkId });
        Object.assign(rider, result.rider);
      }
      const roll = await throwExpression(rider.dice, rider.label, token);
      if (dice.pendingDamageFor(token.id) !== pending || pending.applied) return false;
      dice.applyDamageRider({ id: rider.id, branch: rider.branch, label: rider.label, dice: rider.dice, value: roll.total, faces: roll.faces });
      notify(`${rider.label}: +${roll.total} (${rider.dice} [${roll.faces.join(', ')}]).`);
      setTimeout(() => { if (this.result) { this.result = this.readResult(this.result.targetName); this.signature = ''; this.render(); } }, 300);
      return true;
    } catch (error) { notify(error.message, 'error'); return false; } finally { this.busyRider = false; }
  }
  applyDamage() {
    document.getElementById('apply_dmg_to_target_btn')?.click();
    setTimeout(() => { if (this.result) { this.result = this.readResult(this.result.targetName); this.render(); } }, 400);
  }
  // Plan de UX V3, fase 2 (user decision, 25 Nov 2026): a hit's damage goes to the Keeper's window
  // by itself, with no «Enviar daño» click. The button stays only while the player can still add
  // to the damage: Bear Down (Resolve left) or an effect that rides on it (Combat Surge…).
  canAddToDamage() {
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token || !store.canEditToken(token.id)) return false;
    const resolve = token.path === 'Sleeping' && (token.resolve?.current || 0) > 0;
    return resolve || this.riders().some(r => r.enough);
  }
  autoApply() {
    if (!this.result?.canApply || this.result.applied || this.canAddToDamage()) return false;
    this.applyDamage();
    return true;
  }

  shortcut(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return false;
    const active = document.activeElement;
    if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable || active.closest?.('vf-select,.orbital-listbox'))) return false;
    if (document.querySelector('.dossier-backdrop, .veil-modal-backdrop') || window.veilCardAim) return false;
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token || !store.canEditToken(token.id) || lifeStage(token)) return false;
    const key = event.key;
    if (/^[0-9]$/.test(key)) {
      const n = Number(key), weapons = this.weapons || [];
      const weapon = n === 0 ? null : weapons[n - 1];
      if (n > 0 && !weapon) return false;
      if (n === 0 && weapons.length) return false;
      event.preventDefault();
      const ready = weaponReadiness(weapon);
      if (!ready.ready) { notify(ready.reason, 'error'); return true; }
      this.startTargeting(weapon?.id || '');
      if (this.targeting) notify(`${weapon?.name || 'Desarmado'}: toca el objetivo (Enter ataca al marcado, Esc cancela).`);
      return true;
    }
    if (key === 'Enter' && this.targeting?.targetId && this.targeting.preview?.allowed) { event.preventDefault(); this.confirmAttack('normal'); return true; }
    if ((key === 'f' || key === 'F') && !event.shiftKey && !token.hasSpotlight) { event.preventDefault(); if (toggleSpotlight(token.id)) { this.signature = ''; this.render(); } return true; }
    if (key === '?') { event.preventDefault(); notify(SHORTCUTS_HELP); return true; }
    return false;
  }

  // The action ring chose the weapon and the target (v2.47.0): the attack goes at once, no edge.
  attackFromRing(weaponId, target) {
    const actor = store.state.tokens.find(t => t.id === store.state.claimedTokenId);
    if (!actor || !target) return;
    if (this.tokenId !== actor.id) { store.update({ selectedTokenId: actor.id }); this.signature = ''; this.render(); }
    this.stopTargeting(false);
    this.swallowUntil = performance.now() + 700;
    window.veilCanvas?.setAttackTarget?.(actor.id, target.id);
    this.attack(weaponId, target, 'normal');
  }

  // The marked target is attacked: a second touch on it (no edge), or Advantage/Disadvantage.
  confirmAttack(edge = 'normal') {
    const t = this.targeting, target = t && store.state.tokens.find(x => x.id === t.targetId);
    if (!t || !target) return;
    if (t.preview && !t.preview.allowed) { notify(t.preview.reasons[0] || 'Fuera de alcance.', 'error'); return; }
    const chosen = t.weaponId, follow = t.followUp;
    this.swallowUntil = performance.now() + 700;
    this.stopTargeting(true, { keepMark: true });
    if (follow) { this.resolveFollowUp(follow, chosen, target, edge); return; }
    this.attack(chosen, target, edge, t.closingId);
  }

  // ── Areas and Psionic (v2.46.0) ───────────────────────────────────────────────────────────────
  // Explosive, Area, Dispersal Wave, Psionic: the d20s of the NPCs in the zone are thrown in 3D and
  // the table resolves their Reaction Rolls; each creature then takes its share of one damage roll.
  async areaSave(weaponId, target, procedure) {
    const token = store.state.tokens.find(t => t.id === this.tokenId), dice = window.veilDiceRoller;
    if (!token || !dice) return;
    const map = store.getActiveMap?.() || {};
    const zone = zoneTargets(store.getTokensForActiveMap?.() || store.state.tokens, token, target, procedure, (a, b) => distanceInfo(a, b, map));
    const npcs = zone.filter(t => t.isPlayer === false && t.actorType !== 'player');
    const faces = npcs.length ? await throwDice([{ qty: npcs.length, sides: 20, role: 'Reaction' }], { label: `${procedure.label} · ${npcs.map(n => n.name).join(', ')}`, actor: token }).catch(() => []) : [];
    let out;
    try { out = await network.requestAction({ type: 'WEAPON_AREA', actorId: token.id, weaponId, targetId: target.id, faces, visibility: dice.rollVisibility?.() || 'table', playerName: store.state.userName || '', tokenName: token.name }); }
    catch (error) { notify(error.message, 'error'); window.veilCanvas?.setAttackTarget?.(null, null); return; }
    this.lastAttackCtx = null;
    this.areaQueue = { label: out.label, weaponId, actorId: token.id, critical: false, raw: null, save: out, items: out.items.map(i => ({ ...i, done: i.share === 0 })) };
    const summary = out.items.map(i => i.player ? `${i.name}: tira ${out.traits.join(' o ')} contra CD ${out.dc}` : `${i.name}: ${i.math} → ${i.failed ? 'falla' : 'resiste'}`);
    this.result = { targetName: target.name, outcome: out.label, notes: summary, raw: '', severity: '', loss: '', canApply: false, shields: false, applied: false, sent: false };
    this.signature = ''; this.render();
  }
  areaHTML() {
    const q = this.areaQueue;
    if (!q?.items?.length) return '';
    const share = s => (s === 1 ? 'completo' : s === 0.5 ? 'mitad' : 'sin daño');
    const rows = q.items.map(i => {
      if (i.done) return `<li class="done"><b data-no-i18n>${e(i.name)}</b> · ${i.share === 0 ? 'sin daño' : 'hecho'}</li>`;
      // A character's player rolled the Reaction Roll: whoever applies chooses the result.
      if (i.share === null) return `<li><b data-no-i18n>${e(i.name)}</b> <button type="button" class="hud-btn hud-btn-xs" data-pab-area="${e(i.targetId)}" data-share="1">Falla: completo</button><button type="button" class="hud-btn hud-btn-xs" data-pab-area="${e(i.targetId)}" data-share="${q.save?.success ?? 0}">Resiste: ${share(q.save?.success ?? 0)}</button></li>`;
      return `<li><b data-no-i18n>${e(i.name)}</b> <button type="button" class="hud-btn hud-btn-xs" data-pab-area="${e(i.targetId)}" data-share="${i.share}">Daño ${share(i.share)}</button></li>`;
    }).join('');
    return `<div class="pab-area${this.pendingDamage() ? ' waiting' : ''}"><span class="pab-label" data-no-i18n>${e(q.label)}</span>${this.pendingDamage() ? '<span class="pab-wait">Aplica antes el daño de este impacto.</span>' : ''}<ul>${rows}</ul></div>`;
  }
  // One creature of the zone takes its share: the weapon's damage is rolled once (the first time)
  // and the same total goes to everyone, in full or half, against each one's thresholds.
  async areaDamage(targetId, share) {
    const q = this.areaQueue, dice = window.veilDiceRoller, item = q?.items.find(i => i.targetId === targetId);
    if (!q || !dice || !item || item.done) return;
    if (this.pendingDamage()) { notify('Aplica antes el daño de este impacto.'); return; }
    if (!(share > 0)) { item.done = true; item.share = 0; this.signature = ''; this.render(); return; }
    if (q.raw === null) {
      // The first one rolls the weapon's dice (in 3D); everyone else takes that same total.
      if (share === 1) {
        await dice.followUpDamage(q.actorId, q.weaponId, targetId, { critical: q.critical });
        q.raw = Number(dice.lastDamage?.raw) || 0;
      } else {
        await dice.followUpDamage(q.actorId, q.weaponId, targetId, { critical: q.critical });
        q.raw = Number(dice.lastDamage?.raw) || 0;
        await dice.followUpDamage(q.actorId, q.weaponId, targetId, { amount: Math.floor(q.raw * share) });
      }
    } else await dice.followUpDamage(q.actorId, q.weaponId, targetId, { amount: Math.floor(q.raw * share) });
    item.done = true; item.share = share;
    this.resultRange = null;
    this.result = this.readResult(item.name);
    this.result.notes = [`${q.label}: ${share === 1 ? 'daño completo' : 'la mitad'} (${Math.floor(q.raw * share)} de ${q.raw}).`, ...(this.result.notes || [])];
    this.signature = ''; this.render(); this.watchDamage(); this.autoApply();
  }

  // ── A second target or a second attack (v2.46.0) ─────────────────────────────────────────────
  // What the weapon offers after this attack: Automatic, Salvo Fire, Arc, Cleave, Quick.
  followUps() {
    const ctx = this.lastAttackCtx, token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!ctx || ctx.followUp || !ctx.weaponId || !ctx.checkId || !token || token.id !== ctx.actorId) return [];
    const weapon = tokenInventory(token).weapons.find(w => w.id === ctx.weaponId);
    return availableFollowUps(weapon, { hit: ctx.hit, melee: weaponRangeBand(weapon) === 'Melee', used: ctx.used || [] });
  }
  // The damage of the hit is applied first: the panel holds one damage at a time.
  pendingDamage() { return !!(this.result && this.result.raw !== '' && !this.result.applied); }
  followHTML() {
    const list = this.followUps(), wait = this.pendingDamage();
    return list.length ? `<div class="pab-riders pab-follow">${wait ? '<span class="pab-wait">Aplica antes el daño de este impacto.</span>' : ''}${list.map(f => `<button type="button" class="hud-btn hud-btn-xs" ${wait ? 'disabled' : ''} data-pab-follow="${e(f.id)}" title="${e(f.label)}: ${e(f.action)}${f.stress ? ` (${f.stress} Stress)` : ''}"><span data-no-i18n>${e(f.label)}</span> · ${e(f.action)}${f.stress ? ` · <span data-no-i18n>${f.stress} Stress</span>` : ''}</button>`).join('')}</div>` : '';
  }
  startFollowUp(kind) {
    const ctx = this.lastAttackCtx, rule = FOLLOW_UPS[kind];
    if (!ctx || !rule) return;
    const follow = { kind, checkId: ctx.checkId, primaryId: ctx.targetId, raw: ctx.raw || Number(this.result?.raw) || 0 };
    // Quick: again the same target, at once.
    if (rule.sameTarget) { const target = store.state.tokens.find(t => t.id === ctx.targetId); if (target) this.resolveFollowUp(follow, ctx.weaponId, target, 'normal'); return; }
    this.startTargeting(ctx.weaponId, follow);
    if (this.targeting) notify(`${rule.label}: toca el segundo objetivo${rule.near ? ` (a ${rule.near} de ${store.state.tokens.find(t => t.id === ctx.targetId)?.name || 'el primero'})` : ''}. Esc cancela.`);
  }
  markFollowTarget(target) {
    const token = store.state.tokens.find(t => t.id === this.tokenId), primary = store.state.tokens.find(t => t.id === this.targeting.followUp.primaryId);
    const map = store.getActiveMap?.() || {}, gap = distanceInfo(primary || token, target, map), rule = FOLLOW_UPS[this.targeting.followUp.kind];
    this.targeting.targetId = target.id;
    window.veilCanvas?.setAttackTarget?.(this.tokenId, target.id);
    const reasons = [rule.half ? `Recibe la mitad del daño (${Math.floor((this.targeting.followUp.raw || 0) / 2)}), sin tirada.` : 'El mismo resultado del ataque contra su Evasion; el daño se tira aparte.', rule.stress ? `Cuesta ${rule.stress} Stress.` : ''].filter(Boolean);
    this.targeting.preview = { name: target.name, band: gap.band, meters: gap.meters, allowed: true, edge: 'normal', reasons, followUp: `${rule.label} · ${rule.action}` };
    this.signature = ''; this.render();
  }
  async resolveFollowUp(follow, weaponId, target, edge = 'normal') {
    const token = store.state.tokens.find(t => t.id === this.tokenId), dice = window.veilDiceRoller, ctx = this.lastAttackCtx, rule = FOLLOW_UPS[follow.kind];
    if (!token || !dice || !ctx || !rule) return;
    let out;
    try {
      out = await network.requestAction({ type: 'WEAPON_FOLLOWUP', actorId: token.id, kind: follow.kind, checkId: follow.checkId, weaponId, targetId: target.id, visibility: dice.rollVisibility?.() || 'table', playerName: store.state.userName || '', tokenName: token.name });
    } catch (error) { notify(error.message, 'error'); window.veilCanvas?.setAttackTarget?.(null, null); return; }
    ctx.used = [...(ctx.used || []), follow.kind];
    // Cleave and Quick: a whole new attack (it offers no second target of its own).
    if (rule.attack) { await this.attack(weaponId, target, edge, null, { followUp: true }); return; }
    if (rule.same && !out.hit) {
      notify(`${rule.label}: ${out.total} no alcanza la Evasion ${out.evasion} de ${target.name}.`);
      this.result = { targetName: target.name, outcome: 'FALLO', notes: [`${rule.label}: ${out.total} contra Evasion ${out.evasion}.`], raw: '', severity: '', loss: '', canApply: false, shields: false, applied: false, sent: false };
      this.lastAttackCtx = { ...ctx, followUp: true }; this.signature = ''; this.render(); return;
    }
    await dice.followUpDamage(token.id, weaponId, target.id, rule.half ? { amount: Math.floor((follow.raw || 0) / 2) } : { critical: out.critical });
    this.lastAttackCtx = { ...ctx, followUp: true, targetId: target.id };
    this.resultRange = null; // the distance shown was the first target's
    this.result = this.readResult(target.name);
    this.result.notes = [`${rule.label}: ${rule.half ? 'la mitad del daño, sin tirada' : `${out.total} contra Evasion ${out.evasion}: impacta`}.`, ...(this.result.notes || [])];
    this.signature = ''; this.render(); this.watchDamage(); this.autoApply();
  }

  async attack(weaponId, target, edge = 'normal', closingId = null, { followUp = false } = {}) {
    const dice = window.veilDiceRoller, token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!dice || !token) return;
    // Explosive, Area, Dispersal Wave and Psionic have no attack roll: the zone rolls (v2.46.0).
    const procedure = areaProcedure((tokenInventory(token).weapons || []).find(w => w.id === weaponId));
    if (procedure?.mode === 'save' && !followUp) { this.areaQueue = null; return this.areaSave(weaponId, target, procedure); }
    this.areaQueue = null;
    const dockWasOpen = !!window.veilDiceDock?.isOpen;
    this.result = null;
    try {
      // Preparing the weapon asks for the dice panel; the player's attack stays in the bar.
      // The Keeper keeps the dice panel open: the result and «Aplicar daño» are there.
      if (weaponId) { if (!dice.prepareWeapon(token.id, weaponId)) return; if (!dockWasOpen && !this.keeperAttack) window.veilDiceDock?.close(); }
      else { store.update({ selectedTokenId: token.id }); dice.syncWithSelectedToken(); }
      dice.populateDamageTargets?.();
      const targetSelect = dice.container.querySelector('#dmg_target_select'), weaponSelect = dice.container.querySelector('#dmg_weapon_select');
      if (weaponSelect) weaponSelect.value = weaponId || '';
      if (targetSelect) { targetSelect.value = target.id; targetSelect.onchange?.(); }
      this.applyRoll(edge, 0);
      const outcome = await dice.executeAttack({ closingId });
      // The attack, for what the weapon offers after it (Automatic, Salvo Fire, Arc, Cleave, Quick).
      const done = dice.lastAttack;
      this.lastAttackCtx = done?.actorId === token.id && done.checkId ? { actorId: token.id, weaponId: weaponId || '', targetId: target.id, checkId: done.checkId, hit: !!outcome?.hit, followUp, used: [] } : null;
      // Spray and Waveform: the same attack against everyone else in the cone.
      if (procedure?.mode === 'attack' && this.lastAttackCtx && !followUp) {
        const out = await network.requestAction({ type: 'WEAPON_AREA', actorId: token.id, weaponId, checkId: done.checkId, visibility: dice.rollVisibility?.() || 'table' }).catch(error => { notify(error.message, 'error'); return null; });
        // «Roll once»: when the first target was hit, its damage is the total for everyone.
        if (out?.items?.length) this.areaQueue = { label: out.label, weaponId, actorId: token.id, critical: out.critical, raw: outcome?.hit ? (Number(dice.lastDamage?.raw) || null) : null, items: out.items.map(i => ({ ...i, done: i.share === 0 })) };
      }
      // The range and its penalty, said in the bar (the panel says it in its detail line).
      const weapon = (tokenInventory(token).weapons || []).find(w => w.id === weaponId) || null;
      const gap = distanceInfo(token, target, store.getActiveMap?.() || {}), check = rangeCheck(weapon, gap.band);
      this.resultRange = { band: gap.band, meters: gap.meters, penalty: check.disadvantage ? check.reason : '' };
      this.result = this.readResult(target.name);
      if (this.lastAttackCtx) this.lastAttackCtx.raw = Number(this.result.raw) || 0;
      this.signature = ''; this.render();
      this.autoApply();
      if (this.reopenDrawer) { this.reopenDrawer = false; window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'sheet' } })); }
      // Bear Down can still raise the damage before it is applied: follow the panel.
      this.watchDamage();
    } catch (error) { notify(error.message, 'error'); } finally { if (this.keeperAttack) { this.keeperAttack = false; this.signature = ''; this.render(); } }
  }
  watchDamage() {
    const box = document.getElementById('damage_result_display');
    if (!box || this.damageObserver) return;
    this.damageObserver = new MutationObserver(() => { if (this.result) { const next = this.readResult(this.result.targetName); if (JSON.stringify(next) !== JSON.stringify(this.result)) { this.result = next; this.render(); } } });
    this.damageObserver.observe(box, { childList: true, subtree: true, characterData: true, attributes: true });
  }
}
