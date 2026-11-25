import { CONTEXT_EDGES, contextualEdges } from './statePowers.js';
import { swarmCandidates, bloodiedAttack } from './adversaryPassives.js';
import { isEncounterMarker, perHitMinion } from './bestiaryProfiles.js';
import { actorPortrait } from './tokenAvatars.js';
import { attackPresentation, weaponImpactType } from './combatFX.js';
import { throwExpression } from './damageRiders.js';
import { guideEvent } from './onboarding.js';
import { IMPACT_TYPES } from './encounterRules.js';
import { tableDialog } from './dossierDialog.js';
// src/diceRoller.js
// Authentic Veilfarers Dice Roller & Threshold Damage Calculator

import { rollVeilfarersCheck, checkMath, resolveDamage, damageTypeOf, weaponTags, usableArmorSlots, canBleed, DAMAGE_TYPES, DC_LADDER, TRAITS, SUBTRAITS } from './rulesEngine.js';
import { notify, sanitizeHTML, escapeHTML } from './ui.js';
import { characterDetails } from './characterImport.js';
import { store } from './state.js';
import { audio } from './audioEngine.js';
import { network } from './networkManager.js';
import { normalizeConditions } from './conditions.js';
import { proceduralAttack, fixedStressAttack } from './adversaryWeapons.js';
import { damageNames, hitTypes } from './damageProtection.js';
import { checkEdge, disciplinedDefense, markMeleeDefense, requireActive, lifeStage } from './combatState.js';
import { distanceInfo, rangeCheck, weaponRangeBand, weaponTraitId, rollAdversaryAttack, dualityAttackHit, weaponAttackBonus } from './attackFlow.js';
import { whisperToKeeper, rulesWhisperText } from './rulesWhisper.js';
import { isPartyToken } from './tokenPermissions.js';
import { throwDice, facesRoller } from './tableDice.js';
import { durationDice } from './effectClocks.js';
import { weaponFeatures, armorSlotsAllowed, armorSlotNotes, damageExtras, devastatingExtra, hitStress, hitConditions, featureReminders, overheatCheck, extraDiceNeeded, armorCut, applyArmorCut, armorCutNotes } from './weaponFeatures.js';
import { isDroneToken, droneEvasion, droneCommand } from './drones.js';
import { cardData, loadCardData } from './cardData.js';
import { competence, droneCompetence, gearOutsideCompetence, failureWithFearAdvice } from './techAccess.js';
import { tokenInventory, weaponPreset, parseDamageExpression, resolveDamageExpression, targetDefenses, damageDicePools, honedEdgeOf } from './equipment.js';
import { resolutionLog, POWER_DAMAGE } from './cardResolution.js';
import { damageReactions, reduceComponents, reactorsFor, REACTIONS } from './powerReactions.js';
import { thresholdBonus } from './powerEffects.js';
import { sendOffer, closeOffer, offerAfterDamage } from './reactionOffers.js';

export class DiceRollerSidebar {
  constructor(containerElement) {
    this.container = containerElement;
    this.selectedTraitId = 'finesse';
    this.selectedSubtraitId = '';
    this.currentActor = null;
    this.playerRollType = 'normal';
    this.stdDieType = 20;
    this.stdCount = 1;
    this.stdMod = 0;
    this.stdBroadcast = true;
    this.is3D = store.state.dice3d !== false;
    this.diceTextureSet = typeof localStorage !== 'undefined' ? (localStorage.getItem('veilfarers_dice_texture_set') || 'tech') : 'tech';
    this.render();
    this.syncWithSelectedToken();
    window.veilDiceRoller = this;
    if (this.is3D && typeof window !== 'undefined') {
      window.VFDice3D?.preload?.().catch(() => {});
    }

    store.subscribe((state, keys) => {
      if (keys.includes('dice3d')) {
        this.is3D = store.state.dice3d !== false;
        this.updateDiceModeUI();
      }
      if (keys.some(key => ['selectedTokenId', 'tokens', 'userRole', 'isConnected', 'claimedTokenId'].includes(key))) {
        this.syncWithSelectedToken();
      }
    });
  }

  updateDiceModeUI() {
    this.is3D = store.state.dice3d !== false;
    const btn = this.container.querySelector('#btn_toggle_dice_mode');
    if (btn) {
      btn.textContent = this.is3D ? '🎲 3D' : '📄 2D';
      btn.className = `dice-mode-toggle-btn ${this.is3D ? 'mode-3d' : 'mode-2d'}`;
    }
    const textureGroup = this.container.querySelector('#texture_pills_group');
    if (textureGroup) {
      textureGroup.style.display = this.is3D ? 'flex' : 'none';
    }
  }

  applyDiceTextureSet(groups) {
    const plainThemes = {
      vfHope: 'vfPlainHope',
      vfFear: 'vfPlainFear',
      vfDamage: 'vfPlainDamage',
      vfNeutral: 'vfPlainNeutral'
    };
    const crystalThemes = {
      vfHope: 'vfBioHope',
      vfFear: 'vfBioFear',
      vfDamage: 'vfBioDamage',
      vfNeutral: 'vfNeutral'
    };
    return groups.map(g => {
      let theme = g.theme;
      if (this.diceTextureSet === 'plain') {
        theme = plainThemes[g.theme] || g.theme;
      } else if (this.diceTextureSet === 'crystal') {
        theme = crystalThemes[g.theme] || g.theme;
      }
      return { ...g, theme };
    });
  }

  rollVisibility() {
    return store.sessionRole !== 'player' && store.state.userRole === 'keeper' && this.container.querySelector('#secret_roll')?.checked ? 'keeper' : 'table';
  }

  syncWithSelectedToken() {
    const token = store.getSelectedToken();
    const actorChanged=this.currentActor?.id!==token?.id;
    this.currentActor = token;
    if (actorChanged) { this.container.querySelector('#dmg_delivery_tag').value = ''; this.preparedCard = null; }
    if (this.preparedWeapon && (actorChanged || JSON.stringify(token && tokenInventory(token).weapons.find(w => w.id === this.preparedWeapon.id)) !== this.preparedWeapon.signature)) {
      this.preparedWeapon = null;
      this.container.querySelector('#dmg_formula').value = '';
      this.syncDamageMode();
      this.container.querySelector('[data-weapon-preview]').textContent = 'El arma o el actor ha cambiado. Prepara el daño de nuevo.';
      this.container.querySelector('#damage_result_display').style.display = 'none';
    }
    const isPC = token && token.isPlayer !== false;
    const isKeeper = store.sessionRole !== 'player' && store.state.userRole === 'keeper';
    const toggle = this.container.querySelector('#secret_roll');
    toggle.closest('label').hidden = !isKeeper;
    if (!isKeeper) {
      toggle.checked = false;
      document.querySelector('.dice-tray-overlay[data-keeper-only]')?.remove();
      if (this.lastResult?.visibility === 'keeper') {
        this.container.querySelector('#dice_result_display').style.display = 'none';
        this.lastResult = null;
      }
      if (this.secretDamage) this.container.querySelector('#damage_result_display').style.display = 'none';
    }
    const secret = this.rollVisibility() === 'keeper';
    this.container.querySelector('[data-secret-help]').hidden = !secret;
    const rollBtn = this.container.querySelector('#roll_check_btn');
    if (rollBtn) {
      rollBtn.disabled = !secret && (!token || !store.canEditToken(token.id));
      this.updateRollButtonLabel();
    }
    const actorLabel = this.container.querySelector('#dice_actor_name');
    if (!token && actorLabel) actorLabel.textContent = secret ? 'Keeper · sin actor seleccionado' : 'Selecciona un actor';
    this.container.querySelector('#dice_exp_mod').disabled = !isPC;
    const experiences = token ? characterDetails(token).experiences : [];
    const signature = JSON.stringify([token?.id, experiences]);
    if (signature !== this.experiencesSignature) {
      this.experiencesSignature = signature;
      const select = this.container.querySelector('#dice_experience_select');
      select.innerHTML = sanitizeHTML('<option value="">Sin experiencia</option>' + experiences.map((x, i) => `<option value="${i}">${escapeHTML(x.name)} (${escapeHTML(x.bonus)})</option>`).join(''));
      select.disabled = !isPC || !experiences.length;
      select.onchange = () => { this.container.querySelector('#dice_exp_mod').value = Number(experiences[Number(select.value)]?.bonus) || 0; if (select.value === '') this.container.querySelector('#dice_exp_mod').value = 0; };
    }
    if (actorChanged) { this.container.querySelector('#dice_exp_mod').value = 0; this.container.querySelector('#dice_custom_mod').value = 0; }
    this.container.querySelectorAll('.trait-select-pill').forEach(b => { b.disabled = !token || (!isPC && token.attackModifier !== undefined); });
    this.container.querySelector('#dice_subtrait_select').disabled = !isPC;
    if (!isPC) this.container.querySelector('#dice_subtrait_select').value = '';
    this.updateTraitButtons();
    const resolve=this.container.querySelector('#dice_use_resolve');resolve.disabled=token?.path!=='Sleeping';if(resolve.disabled)resolve.checked=false;
    this.container.querySelector('.critical-choice-row').style.display=token?.path==='Sleeping'?'grid':'none';
    if(actorChanged){this.presetApplied={proficiency:token?.proficiency||1,honed:honedEdgeOf(token)};this.container.querySelector('#dmg_honed').value=this.presetApplied.honed;this.container.querySelector('#dmg_proficiency').value=this.presetApplied.proficiency;}
    if (token) {
      this.currentActor = token;
      const actorLabel = this.container.querySelector('#dice_actor_name');
      if (actorLabel) {
        const isKeeper = store.getState().userRole === 'keeper';
        const isHorror = token.hideName || (!token.isPlayer && (token.actorType === 'adversary' || /horror|stalker|abomination|threat|alien|beast|monster/i.test(token.name || '')));
        const isMasked = !isKeeper && !store.canEditToken(token.id) && isHorror;
        const actorName = isMasked ? '?????' : (isKeeper && isHorror ? `${token.name} [?????]` : token.name);
        actorLabel.textContent = isPC ? `${actorName} (${token.path || 'Unknown'})` : `${actorName} · Attack ${token.attackModifier ?? '—'} · Evasion ${token.evasion ?? '—'}`;
      }
      this.updateTraitButtons();
      this.updateRollButtonLabel();
    }
    this.syncWeaponsDropdown(token);
  }

  syncWeaponsDropdown(token) {
    const select = this.container.querySelector('#dmg_weapon_select');
    if (!select) return;
    const weapons = token ? (tokenInventory(token).weapons || []) : [];
    if (!weapons.length) {
      select.innerHTML = fixedStressAttack(token) ? '<option value="">Ataque · ' + escapeHTML(token.damageExpression) + '</option>' : proceduralAttack(token) ? '<option value="">Procedimiento de la ficha</option>' : '<option value="">Ataque básico (sin armas) · 1d4</option>';
      select.onchange = null;
      return;
    }
    const currentId = this.preparedWeapon?.id || '';
    select.innerHTML = sanitizeHTML(weapons.map(w => `<option value="${escapeHTML(w.id)}" ${w.id === currentId ? 'selected' : ''}>${escapeHTML(w.name)} (${escapeHTML(w.damage || '1d8')})</option>`).join(''));
    if (currentId) {
      select.value = currentId;
    }
    if (!currentId && token.isPlayer === false) this.applyWeaponPreset(token, weapons[0]);
    select.onchange = () => {
      if (select.value && token) {
        this.prepareWeapon(token.id, select.value);
      }
    };
  }

  applyWeaponPreset(actor, weapon) {
    if (!actor || !weapon) return;
    const preset = weaponPreset(actor, weapon);
    const formEl = this.container.querySelector('#dmg_formula');
    if (formEl) formEl.value = preset.formula;
    const delivery = this.container.querySelector('#dmg_delivery_tag');
    if (delivery) delivery.value = '';
    this.syncDamageMode();
    const profEl = this.container.querySelector('#dmg_proficiency');
    if (profEl) profEl.value = preset.proficiency;
    const honedEl = this.container.querySelector('#dmg_honed');
    if (honedEl) honedEl.value = preset.honed;
    this.presetApplied = { proficiency: preset.proficiency, honed: preset.honed };
    const impEl = this.container.querySelector('#dmg_impact_type');
    if (impEl) impEl.value = weaponImpactType(weapon);
    const tags = weaponTags(weapon);
    for (const [id, on] of [['#dmg_weapon_crushing', tags.crushing], ['#dmg_weapon_bleed', tags.bleed]]) { const box = this.container.querySelector(id); if (box) box.checked = on; }
    const note = weapon.damageMode === 'final' ? 'Daño final: Proficiency y Honed Edge no se vuelven a sumar.' : 'Daño base: se añade Proficiency al primer grupo de dados y Honed Edge una vez.';
    let warning = ''; try { parseDamageExpression(preset.formula); } catch (error) { warning = ' ' + error.message; }
    const prevEl = this.container.querySelector('[data-weapon-preview]');
    if (prevEl) prevEl.textContent = [weapon.name, note, weapon.features, warning].filter(Boolean).join(' · ');
    this.preparedWeapon = { id: weapon.id, signature: JSON.stringify(weapon) };
    const wSelect = this.container.querySelector('#dmg_weapon_select');
    if (wSelect && wSelect.value !== weapon.id) wSelect.value = weapon.id;
  }

  updateRollButtonLabel() {
    const rollBtn = this.container.querySelector('#roll_check_btn');
    if (!rollBtn) return;
    const secret = this.rollVisibility() === 'keeper';
    const actor = this.currentActor || store.getSelectedToken() || (store.sessionRole === 'player' ? (store.state.tokens.find(t => t.id === store.state.claimedTokenId) || store.getControlledTokens()[0]) : null);
    const traitObj = TRAITS.find(t => t.id === this.selectedTraitId);
    const traitName = traitObj ? traitObj.name : 'Finesse';
    const traitMod = actor ? (actor.traits?.[this.selectedTraitId] ?? (actor.attackModifier ?? 0)) : 0;
    const customMod = parseInt(this.container.querySelector('#dice_custom_mod')?.value, 10) || 0;
    const totalMod = traitMod + customMod;
    const sign = totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
    const btnGlow = rollBtn.querySelector('.btn-glow-text') || rollBtn;
    btnGlow.textContent = secret ? `TIRADA SECRETA · ${traitName.toUpperCase()} (${sign})` : `ROLL ${traitName.toUpperCase()} (${sign})`;
  }

  selectTrait(traitId, { rollNow = true } = {}) {
    if (!traitId) return;
    this.selectedTraitId = traitId;
    this.container.querySelectorAll('.trait-select-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.id === traitId);
    });

    const rollBtn = this.container.querySelector('#roll_check_btn');
    if (rollBtn) {
      rollBtn.disabled = false;
      rollBtn.classList.add('pulse-highlight');
      setTimeout(() => rollBtn.classList.remove('pulse-highlight'), 600);
    }
    this.updateRollButtonLabel();

    if (rollNow) {
      this.executeActionCheck();
    }
  }

  setCheckData({ actor, traitId, traitName, traitMod, rollNow = true }) {
    if (actor) {
      this.currentActor = actor;
      if (store.state.selectedTokenId !== actor.id) {
        store.update({ selectedTokenId: actor.id });
      }
    }
    this.selectedTraitId = traitId || this.selectedTraitId;
    this.selectedSubtraitId = '';
    this.syncWithSelectedToken();
    this.updateTraitButtons();
    this.selectTrait(this.selectedTraitId, { rollNow });
  }

  // The options a card's window chose for its roll (v2.36.0): Advantage/Disadvantage, an
  // Experience (its index in the sheet) and a modifier. Called with {} afterwards to reset.
  presetCheck({ edge = 'normal', expIndex = '', mod = 0 } = {}) {
    const q = s => this.container.querySelector(s);
    q({ advantage: '#btn_roll_adv', disadvantage: '#btn_roll_dis' }[edge] || '#btn_roll_norm')?.click();
    const select = q('#dice_experience_select');
    if (select) { select.value = String(expIndex ?? ''); select.onchange?.(); if (expIndex === '' || expIndex == null) { const m = q('#dice_exp_mod'); if (m) m.value = 0; } }
    const custom = q('#dice_custom_mod'); if (custom) custom.value = String(Number(mod) || 0);
  }

  // Sets up the roll a card asks for (Trait and DC) and leaves it one click away.
  prepareCheck({ tokenId, traitId, dc, playId = null, replyId = null, open = true }) {
    const actor = store.state.tokens.find(t => t.id === tokenId);
    if (!actor) return false;
    if (store.state.selectedTokenId !== tokenId) store.update({ selectedTokenId: tokenId });
    this.syncWithSelectedToken();
    // A roll thrown at once by a card (v2.36.0) does not open the dice panel.
    if (open) window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'dice' } }));
    this.container.querySelector('#tab_check_btn')?.click();
    this.selectTrait(traitId, { rollNow: false });
    const select = this.container.querySelector('#dice_dc_select');
    if (select && Number.isFinite(dc)) {
      if (![...select.options].some(o => Number(o.value) === dc)) { const option = document.createElement('option'); option.value = String(dc); option.textContent = `DC ${dc}`; select.append(option); }
      select.value = String(dc);
    }
    this.preparedCard = playId ? { tokenId, traitId, dc, playId, replyId } : null;
    return true;
  }

  // A card's damage worked out and sent to the Keeper's window at once (v2.36.0): the dice are
  // thrown, the impact calculated and the hit offered to the Keeper, who decides shields.
  async autoCardDuration(actor, record) {
    const dd = durationDice(record);
    if (!dd) return;
    const busy = () => !!window.VFDice3D?.status?.().rollPending;
    for (let waited = 0; busy() && waited < 8000; waited += 200) await new Promise(r => setTimeout(r, 200));
    await new Promise(r => setTimeout(r, 900));
    try {
      const faces = await throwDice([{ qty: dd.qty, sides: dd.sides, role: 'Duración' }], { label: `${record.name} · duración`, actor,
        describe: v => ({ outcome: `${v.reduce((a, b) => a + b, 0)} turnos`, modifiers: `${dd.qty}d${dd.sides} [${v.join(', ')}]` }) });
      const result = await network.requestAction({ type: 'CARD_DURATION', actorId: actor.id, playId: record.id, faces });
      if (result?.summary) notify(result.summary);
    } catch (error) { notify(error.message, 'error'); }
  }

  async autoCardDamage(actorId, targetId, formula, secret, power = null) {
    if (!this.prepareCardDamage(actorId, targetId, formula, secret, power, { open: false })) return false;
    // The dice of the roll that just landed must settle first: a new 3D throw waits for them.
    const busy = () => !!window.VFDice3D?.status?.().rollPending;
    for (let waited = 0; busy() && waited < 8000; waited += 200) await new Promise(r => setTimeout(r, 200));
    await new Promise(r => setTimeout(r, 900));
    await this.executeDamageCalc();
    const apply = this.container.querySelector('#apply_dmg_to_target_btn');
    if (apply && !apply.disabled) apply.onclick?.();
    return true;
  }

  prepareCardDamage(actorId, targetId, formula, secret, power = null, { open = true } = {}) {
    const q = selector => this.container.querySelector(selector);
    store.update({ selectedTokenId: actorId });
    this.syncWithSelectedToken();
    if (open) window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'dice' } }));
    q('#tab_damage_btn')?.click();
    this.preparedWeapon = null; this.presetApplied = null; this.lastAttack = null;
    this.populateDamageTargets();
    q('#dmg_target_select').value = targetId; q('#dmg_target_select').onchange?.();
    q('#dmg_weapon_select').value = ''; q('#dmg_delivery_tag').value = '';
    q('#dmg_formula').value = formula; q('#dmg_proficiency').value = 1; q('#dmg_honed').value = 0;
    q('#dmg_damage_type').value = power?.type || 'auto';
    if (power?.tag) q('#dmg_delivery_tag').value = power.tag;
    for (const name of ['dmg_is_critical','dmg_is_direct','dmg_weapon_crushing','dmg_weapon_bleed']) if (q('#'+name)) q('#'+name).checked = false;
    q('#secret_roll').checked = !!secret;
    this.syncDamageMode();
    if (open) notify('Daño preparado: elige el tipo impreso y calcula el impacto.');
    return true;
  }

  prepareWeapon(tokenId, weaponId) {
    const actor = store.state.tokens.find(t => t.id === tokenId);
    if (!actor || !store.canEditToken(tokenId)) { notify('Selecciona uno de tus tokens asignados.'); return false; }
    const weapon = tokenInventory(actor).weapons.find(w => w.id === weaponId);
    if (!weapon) { notify('Este arma ya no está en la ficha.'); return false; }
    store.update({ selectedTokenId: tokenId }); this.syncWithSelectedToken();
    this.applyWeaponPreset(actor, weapon);
    this.container.querySelector('#dmg_is_critical').checked = false;
    this.container.querySelector('#dmg_is_direct').checked = false;
    this.container.querySelector('#damage_result_display').style.display = 'none';
    window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'dice' } }));
    this.container.querySelector('#tab_damage_btn').click();
    this.container.querySelector('#dmg_formula').focus();
    return true;
  }

  render() {
    this.container.innerHTML = sanitizeHTML(`
      <div class="dice-sidebar-content">
        <label class="keeper-roll-switch" hidden><input type="checkbox" id="secret_roll"> Tirada secreta · solo Keeper</label>
        <p class="dossier-muted" data-secret-help hidden>El resultado y el registro son privados. Los cambios de recursos en fichas visibles se siguen compartiendo.</p>
        
        <!-- Tab Navigation: 3 tabs matching player-tool.jsx and VTT -->
        <div class="sidebar-subtabs dice-mode-subtabs">
          <button class="subtab-btn active" id="tab_check_btn">DUALITY (2d12)</button>
          <button class="subtab-btn" id="tab_standard_btn">STANDARD DICE</button>
          <button class="subtab-btn" id="tab_damage_btn">DAMAGE &amp; THRESHOLDS</button>
        </div>

        <!-- Sleek Utility Row: 2D/3D Mode Toggle & Quick Polyhedral Bar -->
        <div class="dice-utility-bar">
          <div class="dice-utility-row-top">
            <div class="dice-utility-left">
              <button type="button" class="dice-mode-toggle-btn ${this.is3D ? 'mode-3d' : 'mode-2d'}" id="btn_toggle_dice_mode" title="Alternar entre animación 3D y modo 2D rápido">
                ${this.is3D ? '🎲 3D' : '📄 2D'}
              </button>
              <div class="texture-pills" id="texture_pills_group" style="${this.is3D ? 'display:flex;' : 'display:none;'}">
                <button type="button" class="texture-pill ${this.diceTextureSet === 'plain' ? 'active' : ''}" data-texture="plain" id="btn_texture_plain">PLAIN</button>
                <button type="button" class="texture-pill ${this.diceTextureSet === 'tech' ? 'active' : ''}" data-texture="tech" id="btn_texture_tech">TECH</button>
                <button type="button" class="texture-pill ${this.diceTextureSet === 'crystal' ? 'active' : ''}" data-texture="crystal" id="btn_texture_crystal">CRYSTAL</button>
              </div>
            </div>
          </div>
          <!-- Quick Polyhedral Dice Bar: Full width, zero overflow -->
          <div class="quick-polyhedral-bar" title="Lanzador rápido de dados poliédricos">
            ${[4, 6, 8, 10, 12, 20, 100].map(d => `
              <button type="button" class="quick-die-btn" data-sides="${d}">d${d === 100 ? '%' : d}</button>
            `).join('')}
          </div>
        </div>

        <!-- Section 1: Hope & Fear Action Check (Duality) -->
        <div class="dice-section" id="section_action_check">
          <!-- Operative Header -->
          <div class="dice-actor-bar">
            <span class="actor-tag">OPERATIVE:</span>
            <span class="actor-name" id="dice_actor_name">Capt. Jonathan Harker (Awakened)</span>
          </div>

          <!-- Traits Selector: 3x2 Grid -->
          <div class="trait-selector-grid trait-selector-compact" id="dice_trait_selector">
            ${TRAITS.map(t => `
              <button class="trait-select-pill ${t.id === this.selectedTraitId ? 'active' : ''}" data-id="${t.id}" data-name="${t.name}">
                <span class="pill-name">${t.short}</span>
                <span class="pill-mod" id="trait_mod_${t.id}">+0</span>
              </button>
            `).join('')}
          </div>

          <!-- Subtrait & DC Ladder: 2 columns side by side -->
          <div class="dice-context-grid">
            <div class="dice-context-col">
              <label>Subtrait / Specialty</label>
              <vf-select id="dice_subtrait_select" class="hud-select">
                <option value="">None / General</option>
                ${SUBTRAITS.map(st => `
                  <option value="${st.id}">${st.name}</option>
                `).join('')}
              </vf-select>
            </div>
            <div class="dice-context-col">
              <label>Target DC</label>
              <vf-select id="dice_dc_select" class="hud-select">
                ${DC_LADDER.map(l => `
                  <option value="${l.dc}" ${l.dc === 15 ? 'selected' : ''}>
                    DC ${l.dc} (${l.name})
                  </option>
                `).join('')}
              </vf-select>
            </div>
          </div>

          <!-- Action Cockpit: Roll Type + Modifier Stepper + Live Cubes -->
          <div class="dice-action-cockpit">
            <div class="dice-action-left">
              <!-- Segmented Roll Type: DIS / NORM / ADV -->
              <div class="roll-type-segmented">
                <button type="button" class="roll-type-btn ${this.playerRollType === 'disadvantage' ? 'active-dis' : ''}" id="btn_roll_dis" data-type="disadvantage">DIS</button>
                <button type="button" class="roll-type-btn ${this.playerRollType === 'normal' ? 'active-norm' : ''}" id="btn_roll_norm" data-type="normal">NORM</button>
                <button type="button" class="roll-type-btn ${this.playerRollType === 'advantage' ? 'active-adv' : ''}" id="btn_roll_adv" data-type="advantage">ADV</button>
              </div>

              <!-- Modifier Stepper Row -->
              <div class="duality-mod-stepper-row">
                <span class="stepper-label">MOD:</span>
                <div class="stepper-row">
                  <button type="button" class="stepper-btn" id="btn_mod_minus">−</button>
                  <input type="number" id="dice_custom_mod" class="hud-input" value="0" min="-20" max="20" style="text-align: center; width: 44px;" />
                  <button type="button" class="stepper-btn" id="btn_mod_plus">+</button>
                </div>
              </div>
            </div>

            <!-- Live Duality Readout Preview Squares (HOPE, FEAR, ADV/DIS) -->
            <div class="duality-live-boxes">
              <div class="duality-live-card">
                <span class="duality-live-label hope-label">HOPE</span>
                <div class="duality-live-box hope-box" id="cube_hope">
                  <span id="cube_hope_num">?</span>
                </div>
              </div>
              <div class="duality-live-card">
                <span class="duality-live-label fear-label">FEAR</span>
                <div class="duality-live-box fear-box" id="cube_fear">
                  <span id="cube_fear_num">?</span>
                </div>
              </div>
              <div class="duality-live-card" id="card_extra_die" style="${this.playerRollType !== 'normal' ? 'display:flex' : 'display:none'}">
                <span class="duality-live-label" id="label_extra_die">${this.playerRollType === 'advantage' ? '+d6' : '-d6'}</span>
                <div class="duality-live-box" id="cube_extra" style="border-color:${this.playerRollType === 'advantage' ? '#22c55e' : '#ef4444'}; color:${this.playerRollType === 'advantage' ? '#86efac' : '#fca5a5'}">
                  <span id="cube_extra_num">?</span>
                </div>
              </div>
            </div>
          </div>

          <!-- BIG DUALITY ROLL BUTTON -->
          <button class="hud-btn hud-btn-primary roll-trigger-btn btn-duality-gradient" id="roll_check_btn">
            <span class="btn-glow-text">ROLL 2d12 (HOPE &amp; FEAR)</span>
          </button>

          <!-- Interactive Dice Result Display -->
          <div class="dice-result-panel glass-panel" id="dice_result_display" style="display: none;">
            <div class="dice-total-row">
              <div class="total-big-readout">
                <span class="readout-label">TOTAL</span>
                <span class="readout-num" id="readout_total">0</span>
              </div>
              <div class="total-vs-dc">
                <span class="readout-label">VS DC</span>
                <span class="readout-dc" id="readout_dc">15</span>
              </div>
            </div>

            <div class="dice-mod-box" id="dice_extra_dice"></div>

            <div class="outcome-banner" id="outcome_banner">
              <div class="outcome-title" id="outcome_title">CRITICAL SUCCESS</div>
              <div class="outcome-desc" id="outcome_desc">Details...</div>
              <div class="outcome-payout" id="outcome_payout">Payout...</div>
            </div>
          </div>

          <!-- Hidden inputs for Advantage/Disadvantage backwards compatibility -->
          <div class="dice-modifiers-grid" style="display:none;">
            <label class="hud-checkbox-label">
              <input type="checkbox" id="dice_advantage" ${this.playerRollType === 'advantage' ? 'checked' : ''} />
              <span>Advantage (+1d6)</span>
            </label>
            <label class="hud-checkbox-label">
              <input type="checkbox" id="dice_disadvantage" ${this.playerRollType === 'disadvantage' ? 'checked' : ''} />
              <span>Disadvantage (-1d6)</span>
            </label>
          </div>

          <!-- Collapsible Secondary & Path Options (Closed by default to guarantee ZERO scroll) -->
          <details class="dice-advanced-details">
            <summary class="dice-advanced-summary">
              <span>+ RESOLVE, EXPERIENCE &amp; PATH OPTIONS</span>
              <span class="arrow-indicator">▼</span>
            </summary>
            <div class="dice-advanced-content">
              <div class="dice-modifiers-grid" style="margin: 2px 0 6px;">
                <label class="hud-checkbox-label">
                  <input type="checkbox" id="dice_use_resolve" />
                  <span>Spend Resolve (+1d4)</span>
                </label>
              </div>

              <div class="form-row critical-choice-row" style="margin-bottom: 6px;">
                <div class="form-group" style="flex:1;">
                  <label style="font-size: 9px;">Sleeping critical</label>
                  <vf-select id="critical_resource" class="hud-select" style="height: 24px; font-size: 10px;">
                    <option value="effort">Effort (Resolve if full)</option>
                    <option value="resolve">Resolve</option>
                  </vf-select>
                </div>
                <label class="hud-checkbox-label" style="align-self: center; font-size: 10px;"><input type="checkbox" id="meaningful_roll" checked /> Meaningful</label>
              </div>

              <!-- Flat Modifier & Experience -->
              <div class="dice-context-grid" style="margin-bottom: 2px;">
                <div class="dice-context-col">
                  <label>Experiencia</label>
                  <vf-select id="dice_experience_select" class="hud-select" style="height: 24px; font-size: 10px;">
                    <option value="">Sin experiencia</option>
                  </vf-select>
                </div>
                <div class="dice-context-col">
                  <label>Exp Mod</label>
                  <input type="number" id="dice_exp_mod" class="hud-input" value="0" min="0" max="10" style="height: 24px; font-size: 10px;" />
                </div>
              </div>
            </div>
          </details>
        </div>

        <!-- Section 2: Standard Dice Launcher (d4, d6, d8, d10, d12, d20, d100) -->
        <div class="dice-section" id="section_standard_dice" style="display: none;">
          <div class="standard-dice-grid" id="std_dice_grid">
            ${[4, 6, 8, 10, 12, 20, 100].map(d => `
              <button type="button" class="standard-die-btn ${d === this.stdDieType ? 'active' : ''}" data-sides="${d}">d${d === 100 ? '%' : d}</button>
            `).join('')}
          </div>

          <div class="form-row" style="margin-bottom: 12px; align-items: flex-end;">
            <div class="form-group" style="flex: 1;">
              <label style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: bold;">Count</label>
              <div class="stepper-row">
                <button type="button" class="stepper-btn" id="btn_std_count_minus">−</button>
                <input type="number" id="std_count" class="hud-input" value="1" min="1" max="99" style="text-align: center;" />
                <button type="button" class="stepper-btn" id="btn_std_count_plus">+</button>
              </div>
            </div>
            <div style="padding-bottom: 6px; font-weight: 800; color: #94a3b8; font-size: 14px;" id="std_formula_label">
              d${this.stdDieType} +
            </div>
            <div class="form-group" style="flex: 1;">
              <label style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: bold;">Mod</label>
              <div class="stepper-row">
                <button type="button" class="stepper-btn" id="btn_std_mod_minus">−</button>
                <input type="number" id="std_mod" class="hud-input" value="0" min="-20" max="20" style="text-align: center;" />
                <button type="button" class="stepper-btn" id="btn_std_mod_plus">+</button>
              </div>
            </div>
          </div>

          <div class="form-row" style="margin-bottom: 14px; justify-content: center;">
            <label class="hud-checkbox-label">
              <input type="checkbox" id="std_broadcast" checked />
              <span>Broadcast to Party / Chat</span>
            </label>
          </div>

          <!-- BIG STANDARD ROLL BUTTON -->
          <button type="button" class="hud-btn hud-btn-primary hud-btn-lg roll-trigger-btn btn-standard-gradient" id="roll_standard_btn" style="margin-bottom: 12px;">
            <span>ROLL STANDARD DICE</span>
          </button>

          <div class="dice-result-panel glass-panel" id="std_result_display" style="display: none;">
            <div class="total-big-readout" style="text-align: center;">
              <span class="readout-label" id="std_res_label">TOTAL</span>
              <span class="readout-num" id="std_res_total" style="font-size: 36px; color: #f59e0b;">0</span>
            </div>
            <div id="std_res_detail" style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 4px; font-family: monospace;"></div>
          </div>
        </div>

        <!-- Section 3: Damage & Thresholds Calculator (Compact + Expandable) -->
        <div class="dice-section" id="section_damage_calc" style="display: none;">
          <!-- Compact Weapon & Target Row: Autofilled from character token -->
          <div class="dmg-quick-header">
            <div class="dmg-quick-weapon-box">
              <span class="dmg-quick-label">ARMA / ATAQUE (FICHA):</span>
              <vf-select id="dmg_weapon_select" class="hud-select">
                <option value="">Ataque básico · 1d8</option>
              </vf-select>
              <p class="weapon-prepared-note" data-weapon-preview>Prepara un arma desde Ficha → Armas y equipo, o introduce una expresión.</p>
            </div>

            <div class="dmg-quick-target-box">
              <span class="dmg-quick-label">OBJETIVO:</span>
              <vf-select id="dmg_target_select" class="hud-select">
                <!-- Target tokens populated -->
              </vf-select>
            </div>
          </div>

          <!-- Quick Action Bar: Mitigate + Critical + Big Button -->
          <div class="dmg-quick-controls">
            <div class="dmg-quick-checkboxes">
              <label class="hud-checkbox-label">
                <input type="checkbox" id="dmg_use_armor" />
                <span title="Corebook, cap. 10: el defensor PUEDE marcar un Armor Slot para bajar la severidad un escalón. Nunca es automático.">El defensor gasta 1 Armor Slot</span>
              </label>
              <label class="hud-checkbox-label">
                <input type="checkbox" id="dmg_is_critical" />
                <span>Crítico</span>
              </label>
            </div>

            <button class="hud-btn hud-btn-danger hud-btn-lg roll-trigger-btn btn-damage-gradient" id="roll_attack_btn" title="Tirada de ataque contra la Evasion del objetivo; el daño solo se calcula si impacta">
              <span>⚔️ ATACAR AL OBJETIVO</span>
            </button>
            <button class="hud-btn hud-btn-sm" id="roll_damage_btn" title="Para peligros, caídas o daño que no viene de una tirada de ataque" style="width: 100%; margin-top: 6px;">
              <span>💥 Solo daño (sin tirada de ataque)</span>
            </button>
          </div>
          <div class="dice-result-panel glass-panel" id="attack_result_display" role="status" style="display: none; margin-top: 14px;">
            <div class="dmg-readout-row">
              <div class="dmg-stat"><span class="dmg-tag">ATAQUE</span><span class="dmg-val" id="atk_total_val">0</span></div>
              <div class="dmg-stat"><span class="dmg-tag">EVASION</span><span class="dmg-val" id="atk_evasion_val">0</span></div>
              <div class="dmg-stat"><span class="dmg-tag">RESULTADO</span><span class="dmg-val" id="atk_outcome_val">—</span></div>
            </div>
            <div class="dmg-detail-text" id="atk_detail_text"></div>
          </div>

          <!-- Expandable Fine-Tuning Details: Collapsed by default -->
          <details class="dmg-advanced-details" id="dmg_advanced_details">
            <summary class="dmg-advanced-summary">⚙️ Opciones avanzadas y dados manuales</summary>
            <div class="dmg-advanced-body">
              <label class="dossier-field"><span>Expresión completa</span><input id="dmg_formula" class="hud-input" maxlength="1000" placeholder="Ej.: 1d8+1 Phys + 1d4 Shock"></label>
              <label class="dossier-field"><span>Tipo de daño · Penetración</span><vf-select class="hud-select" id="dmg_damage_type"><option value="auto" selected>Automático · según el arma</option><option value="physical">Physical · 0</option><option value="energy">Energy · −2 a los umbrales</option><option value="void">Void · −4 a los umbrales</option><option value="neural">Neural · −4 y +1 Stress</option></vf-select></label>
              <div class="form-row">
                <label class="hud-checkbox-label"><input type="checkbox" id="dmg_target_reflective" /><span>Objetivo con armadura Reflective (anula Energy)</span></label>
                <label>Etiqueta de daño <vf-select id="dmg_delivery_tag"><option value="">Según el arma</option>${damageNames.slice(4).map(n => '<option>' + n + '</option>').join('')}</vf-select></label>
                <label class="hud-checkbox-label"><input type="checkbox" id="dmg_target_warded" /><span>Objetivo con Ward (anula Void y Neural)</span></label>
              </div>
              <div class="form-row">
                <label class="hud-checkbox-label"><input type="checkbox" id="dmg_weapon_crushing" /><span>Arma Crushing (ignora 1 Armor Slot)</span></label>
                <label class="hud-checkbox-label"><input type="checkbox" id="dmg_target_composite" /><span>Objetivo con armadura Composite (anula Crushing)</span></label>
              </div>
              <div class="form-row">
                <label class="hud-checkbox-label"><input type="checkbox" id="dmg_weapon_bleed" /><span>Arma Bleed (el impacto deja Bleeding)</span></label>
              </div>
              <label class="dossier-field"><span>Impacto del arma</span><vf-select class="hud-select" id="dmg_impact_type">${Object.entries(IMPACT_TYPES).map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</vf-select></label>
              <div class="form-row">
                <div class="form-group"><label>Proficiency</label><input type="number" id="dmg_proficiency" value="1" min="1" max="6" class="hud-input" /></div>
                <div class="form-group"><label>Honed Edge (Sleeping)</label><input type="number" id="dmg_honed" value="0" min="0" max="20" class="hud-input" /></div>
              </div>
              <div class="form-group">
                <label>Dados manuales (si no hay fórmula)</label>
                <div class="form-row">
                  <input type="number" id="dmg_dice_count" class="hud-input" value="2" min="1" max="10" title="Dice count" />
                  <vf-select id="dmg_dice_sides" class="hud-select">
                    <option value="4">d4</option>
                    <option value="6">d6</option>
                    <option value="8" selected>d8</option>
                    <option value="10">d10</option>
                    <option value="12">d12</option>
                  </vf-select>
                  <input type="number" id="dmg_flat_mod" class="hud-input" value="2" title="Flat modifier" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Umbral Mayor Objetivo</label>
                  <input type="number" id="dmg_major_thresh" class="hud-input" value="6" />
                </div>
                <div class="form-group">
                  <label>Umbral Severo Objetivo</label>
                  <input type="number" id="dmg_severe_thresh" class="hud-input" value="12" />
                </div>
              </div>
              <div class="form-row">
                <label class="hud-checkbox-label">
                  <input type="checkbox" id="dmg_is_direct" />
                  <span>Daño directo a HP (ignorar umbrales)</span>
                </label>
              </div>
              <div class="form-group" style="margin-top: 6px;">
                <label>Damage scale · personal targets</label>
                <vf-select id="dmg_mount_rating" class="hud-select">
                  <option value="1" selected>Personal scale · x1</option>
                </vf-select>
              </div>
            </div>
          </details>

          <!-- Damage Outcome Display -->
          <div class="dice-result-panel glass-panel" id="damage_result_display" style="display: none; margin-top: 14px;">
            <div class="dmg-readout-row">
              <div class="dmg-stat">
                <span class="dmg-tag">RAW DAMAGE</span>
                <span class="dmg-val" id="dmg_raw_val">0</span>
              </div>
              <div class="dmg-stat">
                <span class="dmg-tag">SEVERITY</span>
                <span class="dmg-val" id="dmg_severity_val">Minor</span>
              </div>
              <div class="dmg-stat">
                <span class="dmg-tag">HP LOSS</span>
                <span class="dmg-val text-danger" id="dmg_hp_loss_val">1 HP</span>
              </div>
            </div>
            <div class="dmg-detail-text" id="dmg_detail_text"></div>
            <div id="dmg_shield_mitigation_row" style="display: none; margin-top: 8px;">
              <button type="button" class="hud-btn hud-btn-secondary hud-btn-sm" id="dmg_mitigate_btn" style="width: 100%;">
                🛡️ Gastar escudos (Elegir cantidad)
              </button>
            </div>
            <button type="button" class="pab-apply-main" id="apply_dmg_to_target_btn" style="width: 100%; margin-top: 10px;">
              APPLY DAMAGE TO TARGET TOKEN
            </button>
          </div>
        </div>
      </div>
    `);

    this.initEvents();
    this.syncWithSelectedToken();
  }

  initEvents() {
    const openTrayBtn = this.container.querySelector("#open_dice_tray");
    if (openTrayBtn) {
      openTrayBtn.onclick = async () => { const { openDiceTray } = await import("./diceTray3d.js"); openDiceTray(); };
    }

    // Toggle 2D / 3D Mode Button
    const btnToggleMode = this.container.querySelector('#btn_toggle_dice_mode');
    if (btnToggleMode) {
      btnToggleMode.onclick = () => {
        const next3d = !this.is3D;
        this.is3D = next3d;
        store.update({ dice3d: next3d });
        this.updateDiceModeUI();
      };
    }

    // Quick Polyhedral Bar Buttons (Clicking directly rolls that die)
    this.container.querySelectorAll('.quick-die-btn').forEach(btn => {
      btn.onclick = () => {
        const sides = parseInt(btn.dataset.sides, 10) || 20;
        this.stdDieType = sides;
        // Update selection in standard tab if open
        this.container.querySelectorAll('.standard-die-btn').forEach(b => {
          b.classList.toggle('active', parseInt(b.dataset.sides, 10) === sides);
        });
        const lbl = this.container.querySelector('#std_formula_label');
        if (lbl) lbl.textContent = `d${sides} +`;
        this.executeStandardRoll(sides);
      };
    });

    // Subtabs toggle (Duality, Standard, Damage)
    const checkTab = this.container.querySelector('#tab_check_btn');
    const standardTab = this.container.querySelector('#tab_standard_btn');
    const damageTab = this.container.querySelector('#tab_damage_btn');
    const checkSec = this.container.querySelector('#section_action_check');
    const standardSec = this.container.querySelector('#section_standard_dice');
    const damageSec = this.container.querySelector('#section_damage_calc');

    if (checkTab && standardTab && damageTab) {
      checkTab.onclick = () => {
        checkTab.classList.add('active');
        standardTab.classList.remove('active');
        damageTab.classList.remove('active');
        checkSec.style.display = 'block';
        standardSec.style.display = 'none';
        damageSec.style.display = 'none';
      };

      standardTab.onclick = () => {
        standardTab.classList.add('active');
        checkTab.classList.remove('active');
        damageTab.classList.remove('active');
        checkSec.style.display = 'none';
        standardSec.style.display = 'block';
        damageSec.style.display = 'none';
      };

      damageTab.onclick = () => {
        damageTab.classList.add('active');
        checkTab.classList.remove('active');
        standardTab.classList.remove('active');
        checkSec.style.display = 'none';
        standardSec.style.display = 'none';
        damageSec.style.display = 'block';
        this.populateDamageTargets();
      };
    }

    // Texture Set Selector
    this.container.querySelectorAll('.texture-pill').forEach(btn => {
      btn.onclick = () => {
        this.container.querySelectorAll('.texture-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.diceTextureSet = btn.dataset.texture;
        try { localStorage.setItem('veilfarers_dice_texture_set', this.diceTextureSet); } catch (_) {}
      };
    });

    // Segmented Roll Type Buttons (DIS / NORM / ADV)
    const btnDis = this.container.querySelector('#btn_roll_dis');
    const btnNorm = this.container.querySelector('#btn_roll_norm');
    const btnAdv = this.container.querySelector('#btn_roll_adv');
    const chkAdv = this.container.querySelector('#dice_advantage');
    const chkDis = this.container.querySelector('#dice_disadvantage');
    const cardExtra = this.container.querySelector('#card_extra_die');
    const labelExtra = this.container.querySelector('#label_extra_die');
    const cubeExtra = this.container.querySelector('#cube_extra');

    const updateRollTypeUI = (type) => {
      this.playerRollType = type;
      btnDis?.classList.toggle('active-dis', type === 'disadvantage');
      btnNorm?.classList.toggle('active-norm', type === 'normal');
      btnAdv?.classList.toggle('active-adv', type === 'advantage');

      if (chkAdv) chkAdv.checked = (type === 'advantage');
      if (chkDis) chkDis.checked = (type === 'disadvantage');

      if (cardExtra) {
        if (type === 'normal') {
          cardExtra.style.display = 'none';
        } else {
          cardExtra.style.display = 'flex';
          if (labelExtra) labelExtra.textContent = type === 'advantage' ? 'ADV (+d6)' : 'DIS (-d6)';
          if (cubeExtra) {
            cubeExtra.style.borderColor = type === 'advantage' ? '#22c55e' : '#ef4444';
            cubeExtra.style.color = type === 'advantage' ? '#86efac' : '#fca5a5';
          }
        }
      }
    };

    if (btnDis) btnDis.onclick = () => updateRollTypeUI('disadvantage');
    if (btnNorm) btnNorm.onclick = () => updateRollTypeUI('normal');
    if (btnAdv) btnAdv.onclick = () => updateRollTypeUI('advantage');

    // Steppers for Custom Mod
    const btnModMinus = this.container.querySelector('#btn_mod_minus');
    const btnModPlus = this.container.querySelector('#btn_mod_plus');
    const customModInput = this.container.querySelector('#dice_custom_mod');
    if (btnModMinus && customModInput) {
      btnModMinus.onclick = () => {
        const val = (parseInt(customModInput.value, 10) || 0) - 1;
        customModInput.value = Math.max(-20, Math.min(20, val));
        this.updateRollButtonLabel();
      };
    }
    if (btnModPlus && customModInput) {
      btnModPlus.onclick = () => {
        const val = (parseInt(customModInput.value, 10) || 0) + 1;
        customModInput.value = Math.max(-20, Math.min(20, val));
        this.updateRollButtonLabel();
      };
    }
    if (customModInput) {
      customModInput.oninput = () => this.updateRollButtonLabel();
    }

    // Standard Dice Buttons
    this.container.querySelectorAll('.standard-die-btn').forEach(btn => {
      btn.onclick = () => {
        this.container.querySelectorAll('.standard-die-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.stdDieType = parseInt(btn.dataset.sides, 10) || 20;
        const lbl = this.container.querySelector('#std_formula_label');
        if (lbl) lbl.textContent = `d${this.stdDieType === 100 ? '%' : this.stdDieType} +`;
      };
    });

    // Standard Dice Count & Mod Steppers
    const stdCount = this.container.querySelector('#std_count');
    const stdMod = this.container.querySelector('#std_mod');
    const btnStdCountMinus = this.container.querySelector('#btn_std_count_minus');
    const btnStdCountPlus = this.container.querySelector('#btn_std_count_plus');
    const btnStdModMinus = this.container.querySelector('#btn_std_mod_minus');
    const btnStdModPlus = this.container.querySelector('#btn_std_mod_plus');

    if (btnStdCountMinus && stdCount) btnStdCountMinus.onclick = () => { stdCount.value = Math.max(1, (parseInt(stdCount.value, 10) || 1) - 1); };
    if (btnStdCountPlus && stdCount) btnStdCountPlus.onclick = () => { stdCount.value = Math.min(99, (parseInt(stdCount.value, 10) || 1) + 1); };
    if (btnStdModMinus && stdMod) btnStdModMinus.onclick = () => { stdMod.value = Math.max(-20, (parseInt(stdMod.value, 10) || 0) - 1); };
    if (btnStdModPlus && stdMod) btnStdModPlus.onclick = () => { stdMod.value = Math.min(20, (parseInt(stdMod.value, 10) || 0) + 1); };

    // Roll Standard Dice Button
    const rollStdBtn = this.container.querySelector('#roll_standard_btn');
    if (rollStdBtn) rollStdBtn.onclick = () => this.executeStandardRoll();

    // Trait selector buttons: selects trait, updates modifier and executes roll immediately
    this.container.querySelectorAll('.trait-select-pill').forEach(btn => {
      btn.onclick = () => {
        this.selectTrait(btn.dataset.id, { rollNow: true });
      };
    });

    // Roll Action Check Button
    this.container.querySelector('#secret_roll').onchange = () => this.syncWithSelectedToken();
    this.container.querySelector('#roll_check_btn').onclick = () => this.executeActionCheck();

    // Roll Damage Button
    this.container.querySelector('#roll_damage_btn').onclick = () => { this.container.querySelector('#attack_result_display').style.display = 'none'; this.executeDamageCalc(); };
    this.container.querySelector('#roll_attack_btn').onclick = () => this.executeAttack().catch(error => notify(error.message, 'error'));
    for (const event of ['input', 'change']) damageSec.addEventListener(event, () => { this.syncDamageMode(); this.container.querySelector('#damage_result_display').style.display = 'none'; });
  }

  syncDamageMode() {
    const diceCountEl = this.container.querySelector('#dmg_dice_count');
    if (diceCountEl) {
      const grp = diceCountEl.closest('.form-group');
      if (grp) grp.style.display = this.container.querySelector('#dmg_formula')?.value.trim() ? 'none' : '';
    }
  }

  updateTraitButtons() {
    TRAITS.forEach(t => {
      const modEl = this.container.querySelector(`#trait_mod_${t.id}`);
      if (modEl) {
        const val = this.currentActor?.traits?.[t.id] ?? 0;
        modEl.textContent = val >= 0 ? `+${val}` : `${val}`;
      }
    });
  }

  populateDamageTargets() {
    const select = this.container.querySelector('#dmg_target_select');
    if (!select) return;
    const tokens = store.getTokensForActiveMap().filter(token => !isEncounterMarker(token));
    const previous = select.value;
    select.innerHTML = sanitizeHTML('<option value="">Sin objetivo · calcular</option>' + tokens.map(t => `
      <option value="${escapeHTML(t.id)}">${escapeHTML(t.name)} (HP ${t.hp.current}/${t.hp.max})</option>
    `).join(''));
    select.value = tokens.some(t => t.id === previous) ? previous : '';

    select.onchange = () => {
      const tok = tokens.find(t => t.id === select.value);
      if (tok) {
        const maj = this.container.querySelector('#dmg_major_thresh');
        const sev = this.container.querySelector('#dmg_severe_thresh');
        if (maj) maj.value = tok.hp.majorThreshold ?? '';
        if (sev) sev.value = tok.hp.severeThreshold ?? '';
      }
      const attackerId = this.currentActor?.id || store.getState().selectedTokenId;
      if (window.veilCanvas) {
        window.veilCanvas.setAttackTarget(attackerId, select.value || null);
      }
      network.broadcast({
        type: 'TARGET_SELECT',
        attackerId,
        targetId: select.value || null
      });
    };

    if (tokens.length > 0) {
      select.onchange();
    }
  }

  async executeStandardRoll(sidesOverride) {
    const sides = sidesOverride || this.stdDieType || 20;
    const count = Math.max(1, Math.min(99, parseInt(this.container.querySelector('#std_count')?.value, 10) || 1));
    const mod = Math.max(-20, Math.min(20, parseInt(this.container.querySelector('#std_mod')?.value, 10) || 0));
    const broadcast = this.container.querySelector('#std_broadcast')?.checked ?? true;
    const label = `${count}d${sides === 100 ? '%' : sides}${mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : ''}`;

    audio.playDiceRoll();

    const groups = this.applyDiceTextureSet([
      { qty: count, sides: sides === 100 ? 100 : sides, theme: 'vfNeutral', role: 'Standard' }
    ]);

    let rolls = [];
    if (this.is3D && store.state.dice3d !== false && typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.roll === 'function') {
      try {
        const roll3d = await window.VFDice3D.roll(groups, { label, style: 'overlay', deferResults: true });
        if (roll3d && Array.isArray(roll3d.values) && roll3d.values.length === count) {
          rolls = roll3d.values;
        }
      } catch (err) {
        console.warn('[DiceRoller] Standard roll 3D fallback:', err);
      }
    }

    if (!rolls.length) {
      for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
      }
    }

    const sum = rolls.reduce((acc, v) => acc + v, 0);
    const total = sum + mod;

    const actor = this.currentActor || store.getSelectedToken() || { name: 'Operativo' };
    const playerName = store.state.userName || store.state.playerName || (store.state.userRole === 'keeper' ? 'Keeper' : 'Jugador');
    const tokenName = actor.name || 'Operativo';
    const modText = mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : 'Ninguno';

    if (this.is3D && typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.showResults === 'function') {
      window.VFDice3D.showResults({
        label: `Standard Roll: ${label}`,
        playerName,
        tokenName,
        skill: label,
        modifiers: modText,
        value: total,
        total,
        outcome: `${total}`,
        rolls: rolls.map(v => ({ value: v, sides, role: 'Standard' })),
        style: 'overlay'
      });
    }

    const resDisplay = this.container.querySelector('#std_result_display');
    const resTotal = this.container.querySelector('#std_res_total');
    const resDetail = this.container.querySelector('#std_res_detail');
    if (resDisplay) resDisplay.style.display = 'block';
    if (resTotal) resTotal.textContent = total;
    if (resDetail) {
      resDetail.textContent = `[${rolls.join(', ')}]${mod !== 0 ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : ''} = ${total}`;
    }

    const breakdownText = `Dados: [${rolls.join(', ')}] (d${sides})${mod !== 0 ? (mod > 0 ? ` + Mod (${mod})` : ` - Mod (${Math.abs(mod)})`) : ''} = ${total}`;

    guideEvent('roll');
    if (window.veilDiceEngine && typeof window.veilDiceEngine.showCallout === 'function') {
      window.veilDiceEngine.showCallout({
        playerName,
        tokenName,
        actorName: tokenName,
        label: `Tirada: ${label}`,
        total,
        outcomeTitle: `Total ${total}`,
        details: breakdownText,
        breakdown: breakdownText,
        visibility: broadcast ? 'table' : 'keeper'
      });
    }

    if (broadcast) {
      const chatText = `🎲 ${playerName} (${tokenName}): ${label} ➔ ${total} (${rolls.join(' + ')}${mod !== 0 ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : ''})`;
      network.sendChat({ text: chatText, recipientId: 'table' }).catch(() => {
        store.addChatMessage?.({ senderName: tokenName, text: chatText, channel: 'table' });
      });
      network.broadcast({
        type: 'DICE_ROLL',
        result: {
          id: String(Date.now()),
          playerName,
          tokenName,
          actorName: tokenName,
          total,
          label: `Tirada: ${label}`,
          rolls: rolls.map(v => ({ value: v, sides, role: 'Standard' })),
          outcome: `${total}`,
          details: breakdownText,
          breakdown: breakdownText
        }
      });
    }
  }

  // A result reaches the table once: the golden card on the right for whoever rolled, and
  // the same card for everyone else unless the roll is secret. The chat line is separate.
  announceRoll(card, { rolled3D = false, secret = false } = {}) {
    guideEvent('roll');
    if (rolled3D && window.VFDice3D?.showResults) window.VFDice3D.showResults(card);
    else window.veilDiceEngine?.showCallout?.({ ...card, visibility: secret ? 'keeper' : 'table' });
    if (!secret) network.broadcast?.({ type: 'DICE_ROLL', result: { ...card, id: String(Date.now()), breakdown: card.modifiers, details: card.modifiers } });
  }

  // Bear Down adds to the total of the last roll. If that roll was an attack that missed and the
  // new total reaches the Evasion, the attack now hits and its damage is worked out.
  // A damage roll by this character that has not been applied yet, if it is the latest roll.
  pendingDamageFor(tokenId) {
    const d = this.lastDamage;
    return this.lastRollKind === 'damage' && d && !d.applied && d.actorId === tokenId ? d : null;
  }
  async applyBearDownDamage(bonus) {
    const d = this.lastDamage;
    if (!d || d.applied) return null;
    this.executeDamageCalc(d.faces.slice(), { bearDown: d.bonus + bonus, riders: d.riders, extrasPinned: d.extras });
    return this.lastDamage;
  }
  // An effect that adds damage to the attack just made (Combat Surge, Breaking Point…): the same
  // dice, plus its roll. Each effect once per attack.
  applyDamageRider(rider) {
    const d = this.lastDamage;
    if (!d || d.applied || d.riders.some(r => r.id === rider.id)) return null;
    this.executeDamageCalc(d.faces.slice(), { bearDown: d.bonus, riders: [...d.riders, rider], extrasPinned: d.extras });
    return this.lastDamage;
  }

  async applyBearDown(result) {
    if (!result) return;
    this.showResult(result);
    const attack = this.lastAttack;
    if (!attack || attack.hit || attack.rollerId !== result.actorId) return;
    if (result.total < attack.evasion) { this.container.querySelector('#atk_total_val').textContent = result.total; this.container.querySelector('#atk_detail_text').textContent += ` Bear Down: ${result.total}, sigue sin alcanzar la Evasion ${attack.evasion}.`; return; }
    attack.hit = true;
    this.container.querySelector('#attack_result_display').style.display = 'block';
    this.container.querySelector('#atk_total_val').textContent = result.total;
    const out = this.container.querySelector('#atk_outcome_val'); out.textContent = 'IMPACTO'; out.dataset.tone = 'hit';
    this.container.querySelector('#atk_detail_text').textContent = `${attack.where}${attack.rangeNote} ${attack.detail} Bear Down +${result.bearDown?.bonus ?? ''}: ${result.total}. Alcanza la Evasion ${attack.evasion}. Daño calculado abajo.`;
    this.container.querySelector('#dmg_is_critical').checked = false;
    await this.executeDamageCalc();
  }

  can3D() {
    return this.is3D && store.state.dice3d !== false && typeof window !== 'undefined' && typeof window.VFDice3D?.roll === 'function';
  }

  // Throws the dice on the table and returns the faces read, or null when 3D is off or fails
  // (the caller then rolls the numbers itself).
  async roll3D(groups, label) {
    if (!this.can3D()) return null;
    try {
      const rolled = await window.VFDice3D.roll(this.applyDiceTextureSet(groups), { label, style: 'overlay', deferResults: true });
      const wanted = groups.reduce((n, g) => n + g.qty, 0);
      return Array.isArray(rolled?.values) && rolled.values.length === wanted ? rolled.values : null;
    } catch (error) {
      console.warn('[DiceRoller] 3D roll fallback to random:', error);
      return null;
    }
  }

  // Proficiency and Honed Edge follow the sheet: if the character levelled up since the weapon
  // was prepared, the values the panel filled in are brought up to date. Numbers typed by hand
  // are left alone.
  refreshDamagePreset() {
    const q = id => this.container.querySelector(id);
    const actor = this.currentActor && (store.state.tokens.find(t => t.id === this.currentActor.id) || this.currentActor);
    if (!actor) return;
    const weapon = (tokenInventory(actor).weapons || []).find(w => w.id === q('#dmg_weapon_select')?.value) || null;
    const formula = q('#dmg_formula').value.trim();
    if (weapon?.damage && !formula) { this.applyWeaponPreset(actor, weapon); return; }
    if (!this.presetApplied || (weapon && formula !== String(weapon.damage ?? '').trim())) return;
    const fresh = weapon ? weaponPreset(actor, weapon) : { proficiency: actor.isPlayer !== false ? actor.proficiency || 1 : 1, honed: honedEdgeOf(actor) };
    for (const [id, key] of [['#dmg_proficiency', 'proficiency'], ['#dmg_honed', 'honed']]) {
      const input = q(id);
      if (Number(input.value) === this.presetApplied[key] && fresh[key] !== this.presetApplied[key]) input.value = fresh[key];
    }
    this.presetApplied = { proficiency: fresh.proficiency, honed: fresh.honed };
  }

  chooseRollContext(clocks) {
    return new Promise(resolve => {
      const dlg = tableDialog('¿Se aplica la ventaja del poder?', clocks.map(c => '<button class="hud-btn" data-clock="' + escapeHTML(c.id) + '">' + escapeHTML(c.name + ' · ' + CONTEXT_EDGES[c.name][1]) + '</button>').join('') + '<button class="hud-btn" data-clock="">Tirar sin este efecto</button>');
      const observer = new MutationObserver(() => { if (!dlg.isConnected) { observer.disconnect(); resolve(null); } });
      observer.observe(dlg.parentNode, { childList: true });
      dlg.querySelectorAll('[data-clock]').forEach(b => { b.onclick = () => { observer.disconnect(); dlg.remove(); resolve(b.dataset.clock || null); }; });
    });
  }
  async executeActionCheck(attack = null) {
    const actor = attack?.actor || this.currentActor || store.getSelectedToken() || (store.sessionRole === 'player' ? (store.state.tokens.find(t => t.id === store.state.claimedTokenId) || store.getControlledTokens()[0]) : null) || {
      name: 'Voidwalker',
      path: 'Awakened',
      traits: { [this.selectedTraitId]: 1 },
      subtraits: {}
    };

    try { requireActive(actor); } catch (error) { notify(error.message, 'error'); return null; }
    const traitMod = actor.traits?.[this.selectedTraitId] ?? (actor.attackModifier ?? 0);
    const subtraitId = this.container.querySelector('#dice_subtrait_select').value;
    const subtraitMod = subtraitId ? (actor.subtraits?.[subtraitId] ?? 0) : 0;
    // An attack is a Trait Roll against the target's Evasion; range may add Disadvantage.
    const dc = attack ? attack.evasion : parseInt(this.container.querySelector('#dice_dc_select').value, 10);
    // Worn armor or augmentations outside the character's training: Disadvantage (an attack
    // already counted them, with its weapon).
    const gear = !attack && actor.isPlayer !== false && actor.id ? await this.gearCheck(actor) : { disadvantage: false, text: '', worn: [] };
    const manualAdvantage = this.container.querySelector('#dice_advantage').checked;
    const situationalDisadvantage = this.container.querySelector('#dice_disadvantage').checked || !!attack?.disadvantage || gear.disadvantage;
    const contexts = contextualEdges(actor, this.selectedTraitId);
    const contextId = contexts.length ? await this.chooseRollContext(contexts) : null;
    const edge = checkEdge(actor, attack?.target, manualAdvantage || !!contextId, situationalDisadvantage, this.selectedTraitId);
    const hasAdvantage = edge.advantage;
    const hasDisadvantage = edge.disadvantage;
    const useResolve = this.container.querySelector('#dice_use_resolve').checked;
    const expMod = parseInt(this.container.querySelector('#dice_exp_mod').value, 10) || 0;
    // An attack adds its weapon's properties (Reliable, Accurate, Smart Scope).
    const customMod = (parseInt(this.container.querySelector('#dice_custom_mod').value, 10) || 0) + (attack?.bonus || 0);

    const traitObj = TRAITS.find(t => t.id === this.selectedTraitId);
    let traitName = traitObj ? traitObj.name : 'Finesse';

    audio.playDiceRoll();

    // An adversary's roll is 1d20 + modifier (decision 6); a character's, the Duality dice.
    const keeperRoll = actor.isPlayer === false && !attack;
    if (keeperRoll) traitName = 'd20 + Attack';
    // Prepare 3D dice groups
    const groups = keeperRoll ? [{ qty: 1, sides: 20, theme: 'vfNeutral', role: 'Attack' }] : [
      { qty: 1, sides: 12, theme: 'vfHope', role: 'Hope' },
      { qty: 1, sides: 12, theme: 'vfFear', role: 'Fear' }
    ];
    if (keeperRoll) { if (hasAdvantage || hasDisadvantage) groups.push({ qty: 1, sides: 6, theme: 'vfNeutral', role: hasAdvantage ? 'Advantage' : 'Disadvantage' }); }
    else if (hasAdvantage) groups.push({ qty: 1, sides: 6, theme: 'vfNeutral', role: 'Advantage' });
    else if (hasDisadvantage) groups.push({ qty: 1, sides: 6, theme: 'vfNeutral', role: 'Disadvantage' });
    if (useResolve) groups.push({ qty: 1, sides: 4, theme: 'vfNeutral', role: 'Resolve' });

    const themedGroups = this.applyDiceTextureSet(groups);
    const label = attack ? `${actor.name || 'Operative'}${attack.via ? ` (${attack.via})` : ''} · Ataque (${traitName}) vs ${attack.targetName}` : `${actor.name || 'Operative'} · ${traitName} Check`;

    let forcedHope = null;
    let forcedD20 = null;
    let forcedFear = null;
    let forcedAdv = null;
    let forcedResolve = null;

    if (this.is3D && store.state.dice3d !== false && typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.roll === 'function') {
      try {
        const roll3d = await window.VFDice3D.roll(themedGroups, { label, style: 'overlay', deferResults: true });
        if (keeperRoll && roll3d && Array.isArray(roll3d.values) && roll3d.values.length >= 1) {
          forcedD20 = roll3d.values[0];
          if ((hasAdvantage || hasDisadvantage) && roll3d.values.length >= 2) forcedAdv = roll3d.values[1];
        } else if (roll3d && Array.isArray(roll3d.values) && roll3d.values.length >= 2) {
          forcedHope = roll3d.values[0];
          forcedFear = roll3d.values[1];
          // Every die on the table counts: the d6 and the Resolve die are read, not re-rolled.
          const edged = hasAdvantage || hasDisadvantage;
          if (edged && roll3d.values.length >= 3) forcedAdv = roll3d.values[2];
          if (useResolve && roll3d.values.length >= (edged ? 4 : 3)) forcedResolve = roll3d.values[edged ? 3 : 2];
        }
      } catch (err) {
        console.warn('[DiceRoller] 3D roll fallback to random:', err);
      }
    }

    const prepared = !attack && this.preparedCard;
    const linked = prepared && prepared.tokenId === actor.id && prepared.traitId === this.selectedTraitId && prepared.dc === dc;
    let result;
    const playerName = store.state.userName || store.state.playerName || store.sessionAuthorName?.() || (store.state.userRole === 'keeper' ? 'Keeper' : 'Jugador');
    const tokenName = actor.name || 'Operativo';

    try {
      result = await network.requestAction({
        type: 'CHECK',
        actorId: actor.id,
        // An attack is an active action: the table gives the attacker the Spotlight.
        ...(attack ? { attack: true, targetId: attack.target?.id, weaponId: attack.weaponId, viaDrone: !!attack.via, closingId: attack.closingId } : {}),
        ...(linked ? { cardPlayId: prepared.playId, cardReplyId: prepared.replyId } : {}),
        playerName,
        tokenName,
        visibility: this.rollVisibility(),
        options: {
          traitId: this.selectedTraitId,
          subtraitId,
          dc,
          hasAdvantage: manualAdvantage, contextId,
          hasDisadvantage: situationalDisadvantage,
          useResolve,
          experienceMod: expMod,
          customMod,
          criticalChoice: this.container.querySelector('#critical_resource').value,
          meaningful: this.container.querySelector('#meaningful_roll').checked,
          forcedHope,
          forcedFear,
          forcedD20,
          forcedAdv,
          forcedResolve
        }
      });
    } catch(e) {
      notify(e.message, 'error');
      return null;
    }

    // Every die is written out: a single "Mod" figure hid the d6 inside the Trait bonus.
    if (linked) this.preparedCard = null;
    // A Power that deals damage on success (Stellar Lance…): its damage is prepared against the
    // target at once, for the Keeper to decide like any hit (v2.32.0).
    if (linked && !prepared.replyId && (result.isCritical || result.total >= result.dc)) {
      const record = resolutionLog(store, prepared.playId)?.resolution, power = record && POWER_DAMAGE[record.name];
      const target = power && store.state.tokens.find(t => t.id === record.targetIds?.[0]);
      // A duration die thrown after the success (Rapid Regeneration: 1d4 turns), in 3D (v2.41.0).
      if (record?.durationPending && !record.durationFaces) setTimeout(() => this.autoCardDuration(actor, record), 300);
      if (target) setTimeout(() => {
        this.autoCardDamage(actor.id, target.id, power.formula(actor), this.rollVisibility() === 'keeper', power);
        if (power.heavy && /heavy/i.test(tokenInventory(target).items.map(i => [i.name, i.kind]).join(' '))) notify(power.heavy);
      }, 300);
    }
    const math = checkMath(result);
    // Overlay 3D results banner
    if (this.is3D && typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.showResults === 'function') {
      if (result.visibility !== 'keeper' || (store.sessionRole !== 'player' && store.state.userRole === 'keeper')) {
        const rolls = result.keeperD20 ? [{ value: result.d20, sides: 20, role: 'Attack' }] : [
          { value: result.hopeVal, sides: 12, role: 'Hope' },
          { value: result.fearVal, sides: 12, role: 'Fear' }
        ];
        if (result.advVal || result.disadvVal) {
          rolls.push({ value: result.advVal || result.disadvVal, sides: 6, role: result.advVal ? 'Advantage' : 'Disadvantage' });
        }
        if (result.resolveVal) {
          rolls.push({ value: result.resolveVal, sides: result.resolveDieType === 'd6' ? 6 : 4, role: 'Resolve' });
        }
        window.VFDice3D.showResults({
          label,
          playerName,
          tokenName,
          skill: traitName,
          modifiers: math,
          outcome: result.outcomeTitle,
          hope: result.keeperD20 ? undefined : result.hopeVal,
          fear: result.keeperD20 ? undefined : result.fearVal,
          crit: result.isCritical,
          value: result.total,
          total: result.total,
          rolls,
          style: 'overlay'
        });
      }
    }

    // Show callout notification on screen:
    if (window.veilDiceEngine && typeof window.veilDiceEngine.showCallout === 'function') {
      window.veilDiceEngine.showCallout({
        playerName,
        tokenName,
        actorName: tokenName,
        label,
        total: result.total,
        outcomeTitle: result.outcomeTitle,
        outcomeType: result.isCritical ? 'crit' : result.keeperD20 ? (result.total >= result.dc ? 'hope' : 'fear') : (result.fearVal > result.hopeVal ? 'fear' : 'hope'),
        hopeVal: result.keeperD20 ? undefined : result.hopeVal,
        fearVal: result.keeperD20 ? undefined : result.fearVal,
        dc: result.dc,
        details: `${math} vs DC ${result.dc}`,
        breakdown: `${math} vs DC ${result.dc}`,
        visibility: this.rollVisibility()
      });
    }

    // Broadcast to table chat so every player sees the roll in chat:
    if (this.rollVisibility() !== 'keeper') {
      const summary = `🎲 ${actor.name} · ${traitName} Check ➔ ${result.total} (${math}) vs DC ${result.dc} [${result.outcomeTitle}]`;
      network.sendChat({ text: summary, recipientId: 'table' }).catch(() => {
        store.addChatMessage?.({ senderName: actor.name, text: summary, channel: 'table' });
      });
    }

    this.lastResult = result;
    this.showResult(result);
    const payout = this.container.querySelector('#outcome_payout');
    if (payout && gear.text) payout.textContent = `${payout.textContent}${gear.text}`;
    // Failure with Fear: if the character's gear took part, the consequence can be the gear's.
    if (!attack && result.resultType === 'FAILURE_WITH_FEAR' && gear.worn?.length) {
      const named = gear.worn.slice(0, 3).map(row => row.name).filter(Boolean).join(', ');
      const advice = `Si intervino tu equipo (${named}), se recomienda que la consecuencia del Failure with Fear sea suya: el arma se encasquilla, la armadura pierde el sellado, el aumento falla o el objeto se pierde.`;
      if (payout) payout.textContent = `${payout.textContent} ${advice}`;
    }
    return result;
  }

  // The whole attack: declare (weapon, target, range), roll against Evasion and, only on a
  // hit, work out the damage. Applying it stays a separate step so the defender can spend armor.
  // Gear outside the character's Technology Access (class, level): the weapon in hand, the drone
  // it operates, and worn armor or installed augmentations, which are always in use. Any of them
  // means Disadvantage (table rule, 17 Nov 2026).
  async gearCheck(token, { weapon = null, drone = null } = {}) {
    if (!token || token.isPlayer === false) return { disadvantage: false, text: '', worn: [] };
    const data = cardData() || await loadCardData().catch(() => null);
    if (!data) return { disadvantage: false, text: '', worn: [] };
    const notes = [];
    if (weapon) { const check = competence(weapon, token, data); if (!check.ok) notes.push(`${weapon.name}: ${check.reason}`); }
    if (drone) { const check = droneCompetence(drone, token, data); if (!check.ok) notes.push(`${drone.name}: ${check.reason}`); }
    const inventory = tokenInventory(token);
    for (const gear of gearOutsideCompetence(token, { weapons: [], items: inventory.items }, data).filter(g => g.kind === 'armor' || g.kind === 'augment')) notes.push(`${gear.name}: ${gear.reason}`);
    return { disadvantage: notes.length > 0, text: notes.length ? ` Fuera de competencia (Desventaja): ${notes.join(' · ')}` : '', worn: inventory.items };
  }

  async executeAttack({ closingId = null, swarm = false } = {}) {
    const q = id => this.container.querySelector(id);
    const attacker = this.currentActor || store.getSelectedToken();
    const target = store.state.tokens.find(t => t.id === q('#dmg_target_select').value);
    if (!attacker) throw new Error('Selecciona el token que ataca.');
    requireActive(attacker);
    if (!target) throw new Error('Elige un objetivo para atacar.');
    if (target.id === attacker.id) throw new Error('Un token no puede atacarse a sí mismo.');
    if (isEncounterMarker(attacker) || isEncounterMarker(target)) throw new Error('Este encuentro se resuelve según su ficha.');
    if (proceduralAttack(attacker) && !fixedStressAttack(attacker) && !tokenInventory(attacker).weapons.length) throw new Error('Este adversario se resuelve mediante las habilidades y objetivos de su ficha.');
    const bossPhase = attacker.boss?.states?.[attacker.boss.index];
    if (bossPhase?.canAttack === false) throw new Error('Este estado usa su procedimiento especial; no tiene un ataque estándar.');
    const weapon = (tokenInventory(attacker).weapons || []).find(w => w.id === q('#dmg_weapon_select').value) || null;
    const map = store.getActiveMap() || {};
    const gap = distanceInfo(attacker, target, map), band = gap.band;
    if (swarm && (store.sessionRole === 'player' || store.state.userRole !== 'keeper' || !swarmCandidates(attacker,map,store.state.tokens).some(t => t.id === target.id))) throw new Error('La situación del enjambre o del objetivo ha cambiado.');
    const range = swarm ? { allowed: true, reach: 'Close', disadvantage: false } : rangeCheck(weapon, band);
    // A drone whose signal is Lost cannot evade: Evasion −2 (Corebook ch. 14).
    const evasion = droneEvasion(target);
    // A drone attacks with its operator's Action and its operator's roll.
    const drone = isDroneToken(attacker), command = drone ? droneCommand(attacker) : null;
    const operator = drone ? store.state.tokens.find(t => t.id === attacker.drone?.operatorId && t.isPlayer !== false) : null;
    if (operator) requireActive(operator);
    if (drone && !command.allowed) throw new Error(command.reason);
    if (drone && !operator) throw new Error('Asigna un operador al dron (Ficha → Dron · módulos y señal): atacar con un dron es la Acción y la tirada de su operador.');
    const show = (total, outcome, detail, tone) => {
      q('#attack_result_display').style.display = 'block';
      q('#atk_total_val').textContent = total; q('#atk_evasion_val').textContent = evasion;
      const out = q('#atk_outcome_val'); out.textContent = outcome; out.dataset.tone = tone;
      q('#atk_detail_text').textContent = detail;
    };
    q('#damage_result_display').style.display = 'none';
    const where = `${weapon ? weapon.name : 'Ataque básico'} · objetivo a ${band} (${gap.meters.toFixed(1)} m, ${gap.squares.toFixed(1)} casillas) · ${range.reach ? `alcance del arma ${range.reach}` : 'alcance del arma sin indicar: no se aplica límite'}.`
      + (gap.blocked ? ' ⚠️ Hay un muro o una puerta cerrada entre atacante y objetivo: línea de tiro bloqueada.' : '');
    if (!range.allowed) { show('—', 'FUERA DE ALCANCE', `${where} ${range.reason} Acércate o cambia de arma.`, 'miss'); notify(range.reason, 'error'); return { hit: false, blocked: true, band }; }

    let attackRoll;
    let hit, critical, total, detail, rolled3D = false, fearAdvice = '';
    const gear = (attacker.isPlayer !== false || drone) ? await this.gearCheck(drone ? operator : attacker, { weapon: drone ? null : weapon, drone: drone ? attacker : null }) : { disadvantage: false, text: '' };
    if (attacker.isPlayer !== false || drone) {
      const traitId = weapon ? weaponTraitId(weapon) : 'strength';
      if (!weapon && !drone) {
        this.preparedWeapon = null; this.presetApplied = null;
        q('#dmg_formula').value = '1d4 Physical'; q('#dmg_proficiency').value = attacker.proficiency || 1;
        q('#dmg_honed').value = honedEdgeOf(attacker); q('#dmg_damage_type').value = 'auto';
        q('#dmg_delivery_tag').value = ''; q('#dmg_weapon_crushing').checked = false; q('#dmg_weapon_bleed').checked = false;
      }
      if (traitId && traitId !== this.selectedTraitId) this.selectTrait(traitId, { rollNow: false });
      const props = weaponAttackBonus(drone ? null : weapon, band);
      const result = await this.executeActionCheck({ evasion, target, weaponId: weapon?.id, closingId, disadvantage: range.disadvantage || !!command?.disadvantage || gear.disadvantage, targetName: target.name, actor: operator, via: drone ? attacker.name : '', bonus: props.bonus });
      if (!result) return { hit: false, band };
      attackRoll = result;
      hit = dualityAttackHit(result, evasion); critical = !!result.isCritical; total = result.total;
      // Overheating: its d6 after the attack, thrown as a 3D die.
      const heatFeatures = drone ? {} : weaponFeatures(weapon);
      const heatFace = heatFeatures.overheating ? (await throwDice([{ qty: 1, sides: 6, role: 'Overheating' }], { label: `Overheating · ${weapon.name}`, actor: attacker,
        describe: v => ({ total: v[0], outcome: v[0] <= 2 ? 'SE SOBRECALIENTA' : 'SIN PROBLEMA', modifiers: `d6 [${v[0]}]: 1–2 se sobrecalienta` }) }))[0] : null;
      const heat = drone ? null : overheatCheck(heatFeatures, () => heatFace);
      if (heat?.overheated) void whisperToKeeper(rulesWhisperText({ attacker: attacker.name, target: target.name, weapon: weapon.name, notes: [heat.text] }));
      detail = `${checkMath(result)}.${props.notes.length ? ` Propiedades del arma: ${props.notes.join(', ')}.` : ''}${heat ? ` ${heat.text}` : ''}`;
      // Failure with Fear on an attack: the consequence is best taken from the weapon (or drone).
      if (result.resultType === 'FAILURE_WITH_FEAR') fearAdvice = drone ? failureWithFearAdvice('drone', attacker.name) : weapon ? failureWithFearAdvice('weapon', weapon.name, weapon.features) : '';
      rolled3D = this.can3D();
    } else {
      audio.playDiceRoll();
      const melee = !swarm && (!weapon || weaponRangeBand(weapon) === 'Melee' || !weaponRangeBand(weapon) && band === 'Melee');
      const guard = melee && disciplinedDefense(target,attacker,map,store.state.tokens);
      // Tactical Overwatch: an ally in Close range may protect the target before the roll.
      // Blinding Flash: a character in Close range of the attacker may flash it before it attacks;
      // the enemies in the area roll Instinct (DC 10) at once and a failure gives this attack Disadvantage.
      const flash = await offerReaction('Blinding Flash', attacker, `${attacker.name} va a atacar a ${target.name}. Blinding Flash: los enemigos a alcance Close tiran Instinct DC 10; si fallan, Desventaja en su ataque.`);
      if (flash) await castReaction(flash, 'Blinding Flash');
      const overwatch = await offerReaction('Tactical Overwatch', target, `${attacker.name} ataca a ${target.name}: Ventaja en su defensa (el ataque tira con Desventaja) y +2 Armor Slots temporales.`);
      if (overwatch) await network.requestAction({ type: 'REACTION_PAY', actorId: overwatch.id, name: 'Tactical Overwatch', targetId: target.id }).catch(error => notify(error.message, 'error'));
      const edge = checkEdge(attacker, target, q('#dice_advantage').checked, q('#dice_disadvantage').checked || range.disadvantage || !!guard?.penalty || !!overwatch);
      const groups = [{ qty: 1, sides: 20, theme: 'vfNeutral', role: 'Attack' }];
      if (edge.advantage || edge.disadvantage) groups.push({ qty: 1, sides: 6, theme: 'vfNeutral', role: edge.advantage ? 'Advantage' : 'Disadvantage' });
      const attackLabel = `${attacker.name} · Ataque vs ${target.name}`;
      const faces = await this.roll3D(groups, attackLabel);
      rolled3D = !!faces;
      const conditional = target.conditions?.includes('Incapacitated') && /\+1 on attacks against an Incapacitated target/i.test(weapon?.features || '') ? 1 : 0;
      const roll = rollAdversaryAttack({ attackModifier: (attacker.attackModifier ?? 0) + conditional + bloodiedAttack(attacker).attack, evasion, hasAdvantage: edge.advantage, hasDisadvantage: edge.disadvantage, forcedD20: faces?.[0] ?? null, forcedD6: faces?.[1] ?? null });
      if (guard) markMeleeDefense(store,target,guard);
      // A «Disadvantage on their next attack» is spent by this attack.
      if (attacker.effectClocks?.some(c => c.nextAttack)) store.updateToken(attacker.id, { effectClocks: attacker.effectClocks.filter(c => !c.nextAttack) });
      // Attacking breaks Hidden (the Advantage it gave was counted in checkEdge).
      if (store.state.tokens.find(t => t.id === attacker.id)?.conditions?.includes('Hidden')) store.updateToken(attacker.id, { conditions: store.state.tokens.find(t => t.id === attacker.id).conditions.filter(c => c !== 'Hidden') });
      hit = roll.hit; critical = roll.isCritical; total = roll.total;
      // Force Shield: once the hit is known, +3 Evasion can turn it into a miss; the attacker then
      // takes (Proficiency)d4 Physical (Kinetic) from whoever raised the shield.
      let shielded = null;
      if (hit && !critical && total < evasion + 3) {
        shielded = await offerReaction('Force Shield', target, `${attacker.name} impacta a ${target.name} con ${total} contra Evasion ${evasion}: con +3 (${evasion + 3}) el ataque falla y ${attacker.name} recibe daño.`);
        if (shielded) {
          await network.requestAction({ type: 'REACTION_PAY', actorId: shielded.id, name: 'Force Shield' }).catch(error => notify(error.message, 'error'));
          hit = false; roll.hit = false;
          const backlash = `${Math.max(1, Math.min(10, Number(shielded.proficiency) || 1))}d4`;
          setTimeout(() => this.autoCardDamage(shielded.id, attacker.id, backlash, this.rollVisibility() === 'keeper', { type: 'physical', tag: 'Kinetic' }), 400);
        }
      }
      const card = {
        label: attackLabel, playerName: 'Keeper', tokenName: attacker.name, actorName: attacker.name, skill: 'Ataque',
        modifiers: `d20 [${roll.d20}] ${roll.attackModifier >= 0 ? '+' : '−'} ${Math.abs(roll.attackModifier)}${roll.edge ? ` ${roll.edge === 'Advantage' ? '+' : '−'} d6 [${roll.d6}]` : ''} = ${roll.total} vs Evasion ${evasion}`,
        value: roll.total, total: roll.total, outcome: critical ? 'CRÍTICO' : hit ? 'IMPACTO' : shielded ? 'FORCE SHIELD' : 'FALLO',
        rolls: [{ value: roll.d20, sides: 20, role: 'Attack' }, ...(roll.edge ? [{ value: roll.d6, sides: 6, role: roll.edge }] : [])], style: 'overlay'
      };
      this.announceRoll(card, { rolled3D: !!faces, secret: this.rollVisibility() === 'keeper' });
      detail = `d20 [${roll.d20}] ${roll.attackModifier >= 0 ? '+' : '−'} ${Math.abs(roll.attackModifier)}${roll.edge ? ` ${roll.edge === 'Advantage' ? '+' : '−'} d6 [${roll.d6}]` : ''} = ${roll.total}.`;
      const secret = this.rollVisibility() === 'keeper';
      const summary = `⚔️ ${attacker.name} ataca a ${target.name}: ${detail} vs Evasion ${evasion}${shielded ? ` (+3 Force Shield de ${shielded.name})` : ''} → ${critical ? 'CRÍTICO' : hit ? 'IMPACTO' : 'FALLO'}`;
      store.addLog({ ...(secret ? { visibility: 'keeper' } : {}), type: 'ROLL', sender: 'Keeper', title: `Ataque · ${attacker.name}`, details: summary });
      if (!secret) network.sendChat({ text: summary, recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: attacker.name, text: summary, channel: 'table' }));
    }
    const rangeNote = (range.disadvantage ? ` ${range.reason}` : '') + (drone ? ` Tira ${operator.name}, operador del dron.${command.disadvantage ? ' ' + command.reason : ''}` : '') + (gear.text || '');
    // Bear Down after a missed attack may still carry it over the Evasion (applyBearDown).
    this.lastAttack = { checkId: attackRoll?.id, targetId: target.id, actorId: attacker.id, rollerId: (attacker.isPlayer !== false || drone) ? (operator?.id || attacker.id) : null, evasion, hit, where, rangeNote, detail };
    if (!hit) {
      show(total, 'FALLO', `${where}${rangeNote} ${detail} No alcanza la Evasion ${evasion}: no hay daño.${fearAdvice ? ` ${fearAdvice}` : ''}`, 'miss');
      if (fearAdvice) notify(fearAdvice);
      return { hit: false, critical: false, total, band };
    }
    show(total, critical ? 'CRÍTICO' : 'IMPACTO', `${where}${rangeNote} ${detail} ${critical ? 'Crítico: impacta siempre.' : `Alcanza la Evasion ${evasion}.`} Daño calculado abajo.`, critical ? 'crit' : 'hit');
    q('#dmg_is_critical').checked = critical;
    // Let the table read the attack before the damage dice replace it.
    if (rolled3D) await new Promise(resolve => setTimeout(resolve, this.attackToDamagePause ?? 1600));
    this.featureWhisper = weapon ? { attacker: attacker.name, target: target.name, weapon: weapon.name } : null;
    const riders = [];
    const passive = bloodiedAttack(attacker);
    if (passive.flat) riders.push({ id: 'desperate-strike', label: 'Desperate Strike', value: passive.flat });
    if (passive.die) {
      const sides = /d(4|6|8|10|12|20)\b/i.exec(weapon?.damage || '')?.[1];
      if (sides) {
        const dice = '1d' + sides;
        const extra = critical ? { total: Number(sides), faces: [] } : await throwExpression(dice, 'Territorial Rage', attacker);
        riders.push({ id: 'territorial-rage', label: 'Territorial Rage', dice, value: extra.total, faces: extra.faces });
      }
    }
    for (const rider of attackRoll?.damageRiders || []) {
      if (!rider.dice) { riders.push(rider); continue; }
      const rolled = await throwExpression(rider.dice, rider.label, attacker);
      riders.push({ ...rider, value: rolled.total, faces: rolled.faces });
    }
    await this.executeDamageCalc(null, { riders });
    return { hit: true, critical, total, band };
  }

  showResult(result) {
    this.lastRollKind = 'check';
    // The hand lights the reactions this roll opens (Lucky Break, Bear Down; v2.39.0).
    queueMicrotask(() => window.veilCardHand?.refresh?.());
    if (result.visibility === 'keeper' && (store.sessionRole === 'player' || store.state.userRole !== 'keeper')) return;
    guideEvent('roll');
    this.lastResult = result;
    // Display Results
    const display = this.container.querySelector('#dice_result_display');
    if (display) display.style.display = 'block';

    const cubeHope = this.container.querySelector('#cube_hope_num');
    const cubeFear = this.container.querySelector('#cube_fear_num');
    const cubeExtra = this.container.querySelector('#cube_extra_num');
    const cardExtra = this.container.querySelector('#card_extra_die');
    const cubeHopeBox = this.container.querySelector('#cube_hope');
    const cubeFearBox = this.container.querySelector('#cube_fear');

    if (cubeHope) cubeHope.textContent = result.hopeVal;
    if (cubeFear) cubeFear.textContent = result.keeperD20 ? '—' : result.fearVal;
    // An adversary's d20 sits in the first box, labelled as such.
    const hopeLabel = this.container.querySelector('.duality-live-label.hope-label');
    if (hopeLabel) hopeLabel.textContent = result.keeperD20 ? 'D20' : 'HOPE';

    if (result.isCritical) {
      cubeHopeBox?.classList.add('crit-pulse');
      cubeFearBox?.classList.add('crit-pulse');
    } else {
      cubeHopeBox?.classList.remove('crit-pulse');
      cubeFearBox?.classList.remove('crit-pulse');
    }

    const edgeDie = result.advVal || result.disadvVal;
    if (edgeDie && cardExtra && cubeExtra) {
      cardExtra.style.display = 'flex';
      cubeExtra.textContent = edgeDie;
      const labelExtra = this.container.querySelector('#label_extra_die'), box = this.container.querySelector('#cube_extra');
      if (labelExtra) labelExtra.textContent = result.advVal ? 'ADV (+d6)' : 'DIS (-d6)';
      if (box) { box.style.borderColor = result.advVal ? '#22c55e' : '#ef4444'; box.style.color = result.advVal ? '#86efac' : '#fca5a5'; }
    } else if (cardExtra && this.playerRollType === 'normal') {
      cardExtra.style.display = 'none';
    }

    const readoutTotal = this.container.querySelector('#readout_total');
    const readoutDc = this.container.querySelector('#readout_dc');
    const outcomeBanner = this.container.querySelector('#outcome_banner');
    const outcomeTitle = this.container.querySelector('#outcome_title');
    const outcomeDesc = this.container.querySelector('#outcome_desc');
    const outcomePayout = this.container.querySelector('#outcome_payout');
    const extraDiceEl = this.container.querySelector('#dice_extra_dice');

    if (readoutTotal) readoutTotal.textContent = result.total;
    if (readoutDc) readoutDc.textContent = result.dc;

    if (outcomeBanner) {
      outcomeBanner.className = 'outcome-banner ' + result.resultType.toLowerCase();
      if (outcomeTitle) outcomeTitle.textContent = (result.visibility === 'keeper' ? 'SOLO KEEPER · ' : '') + result.outcomeTitle;
      if (outcomeDesc) outcomeDesc.textContent = result.outcomeDesc;
      if (outcomePayout) outcomePayout.textContent = result.pathPayout;
    }

    // Extra Dice representation
    let extraStr = '';
    if (result.advVal) extraStr += `<span class="extra-die adv">+${result.advVal} (Adv)</span> `;
    if (result.disadvVal) extraStr += `<span class="extra-die disadv">-${result.disadvVal} (Disadv)</span> `;
    if (result.resolveVal) extraStr += `<span class="extra-die resolve">+${result.resolveVal} (Res)</span> `;
    const flatMod = result.totalMod - (result.advVal || 0) + (result.disadvVal || 0) - (result.resolveVal || 0);
    if (flatMod) extraStr += `<span class="extra-die mod">${flatMod >= 0 ? '+' : ''}${flatMod} Mod</span>`;
    extraDiceEl.innerHTML = sanitizeHTML(extraStr);

    // Sound FX on Critical
    if (result.isCritical) {
      audio.playCritical();
    }

  }

  showStressDamage(attacker, target) {
    const q = selector => this.container.querySelector(selector);
    const amount = fixedStressAttack(attacker);
    const mapId = store.state.activeMapId;
    const secret = this.rollVisibility() === 'keeper';
    this.lastDamage = null;
    q('#damage_result_display').style.display = 'block';
    q('#dmg_shield_mitigation_row').style.display = 'none';
    q('#dmg_raw_val').textContent = amount;
    q('#dmg_severity_val').textContent = 'Stress';
    q('#dmg_hp_loss_val').textContent = '0 HP';
    q('#dmg_detail_text').textContent = (secret ? 'SOLO KEEPER · ' : '') + attacker.damageExpression;
    const apply = q('#apply_dmg_to_target_btn');
    apply.disabled = !target?.stress?.max;
    apply.textContent = apply.disabled ? 'Elige un objetivo con pista de Stress' : 'Marcar ' + amount + ' Stress';
    apply.onclick = () => {
      if (apply.disabled || store.sessionBusy || store.state.rest || !store.canEditToken(attacker.id) || store.state.activeMapId !== mapId) return;
      if ((this.currentActor || store.getSelectedToken())?.id !== attacker.id) return;
      const current = store.state.tokens.find(t => t.id === target?.id && t.mapId === mapId);
      if (!current?.stress || q('#dmg_target_select').value !== current.id || isEncounterMarker(current)) return;
      apply.disabled = true;
      if (store.sessionRole === 'player') {
        network.broadcast({ type: 'APPLY_DAMAGE', attackerId: attacker.id, targetId: current.id, hpLoss: 0, armorLoss: 0, stressMark: amount, isDirect: true, secret });
      } else {
        const before = store.tableActing; store.tableActing = true;
        try {
          store.updateToken(current.id, { stress: { ...current.stress, current: Math.min(current.stress.max, current.stress.current + amount) } });
        } finally { store.tableActing = before; }
        store.addLog({ ...(secret ? { visibility: 'keeper' } : {}), type: 'DAMAGE', sender: 'Keeper', title: attacker.name, details: current.name + ' · ' + attacker.damageExpression });
      }
      apply.textContent = store.sessionRole === 'player' ? 'Enviado al Keeper' : 'Stress aplicado';
    };
  }

  // rolled: the faces read from the 3D dice. Without them (3D off, or a first call) the dice
  // are thrown on the table first and this runs again with what they show.
  executeDamageCalc(rolled = null, { bearDown = 0, riders = [], extrasPinned = null, extraFaces = null } = {}) {
    if (lifeStage(this.currentActor)) { notify('Este personaje no puede infligir daño ordinario.', 'error'); return; }
    const riderTotal = riders.filter(r => !r.branch).reduce((n, r) => n + (Number(r.value) || 0), 0);
    const bonusComponents = riders.filter(r => r.branch).map(r => ({ amount: r.value, types: r.branch === 'Void' ? ['void'] : r.branch === 'Lux' ? ['energy', 'radiant'] : ['physical', 'kinetic'] }));
    const bossPhase = this.currentActor?.boss?.states[this.currentActor.boss.index];
    if (bossPhase?.canAttack === false) { notify('Este estado usa su procedimiento especial; no tiene un ataque de daño estándar.', 'error'); return; }
    const targetSelect = this.container.querySelector('#dmg_target_select');
    const targetId = targetSelect.value;
    const targetToken = store.getState().tokens.find(t => t.id === targetId);
    const actor = this.currentActor || store.getSelectedToken();
    if (isEncounterMarker(actor) || isEncounterMarker(targetToken)) { notify('Este encuentro se resuelve según su ficha.'); return; }
    if (proceduralAttack(actor) && !tokenInventory(actor).weapons.length) {
      if (fixedStressAttack(actor)) return this.showStressDamage(actor, targetToken);
      notify('Usa el procedimiento impreso en la ficha del adversario.'); return;
    }
    const perHit = perHitMinion(targetToken);

    const diceCount = parseInt(this.container.querySelector('#dmg_dice_count').value, 10);
    const diceSides = parseInt(this.container.querySelector('#dmg_dice_sides').value, 10);
    const flatMod = parseInt(this.container.querySelector('#dmg_flat_mod').value, 10);
    // With a target, its own thresholds decide the hit: the preview must match what is applied.
    const majorInput = this.container.querySelector('#dmg_major_thresh'), severeInput = this.container.querySelector('#dmg_severe_thresh');
    if (targetToken?.hp) {
      // Aura of Clarity and the like raise the thresholds while active.
      const raised = thresholdBonus(targetToken);
      majorInput.value = targetToken.hp.majorThreshold != null ? targetToken.hp.majorThreshold + raised : '';
      severeInput.value = targetToken.hp.severeThreshold != null ? targetToken.hp.severeThreshold + raised : '';
    }
    const major = parseInt(majorInput.value, 10);
    const severe = parseInt(severeInput.value, 10);
    const useArmor = this.container.querySelector('#dmg_use_armor').checked;
    // Defences found on the target are ticked for the Keeper; they can still be changed by hand.
    const reflectiveInput = this.container.querySelector('#dmg_target_reflective'), wardedInput = this.container.querySelector('#dmg_target_warded');
    if (targetToken && this.defencesReadFor !== targetToken.id) {
      const found = targetDefenses(targetToken);
      reflectiveInput.checked = found.reflective; wardedInput.checked = found.warded;
      this.container.querySelector('#dmg_target_composite').checked = found.composite;
      this.defencesReadFor = targetToken.id;
    }
    const crushing = this.container.querySelector('#dmg_weapon_crushing').checked, composite = this.container.querySelector('#dmg_target_composite').checked;
    const bleed = this.container.querySelector('#dmg_weapon_bleed').checked;
    // The weapon's features (Crushing, Phasing, Cutting, Shield Piercing…) limit the Armor Slots
    // the target may spend on this hit; Composite armor blunts Crushing. `feats` is set below.
    let feats = { crushing, bleed };
    const usableSlots = token => armorSlotsAllowed(token?.armor?.current, feats, { composite });
    const isCritical = this.container.querySelector('#dmg_is_critical').checked;
    const isDirect = this.container.querySelector('#dmg_is_direct').checked;
    const mr = 1;
    this.refreshDamagePreset();
    const proficiency=parseInt(this.container.querySelector('#dmg_proficiency').value,10),honed=parseInt(this.container.querySelector('#dmg_honed').value,10);
    if(!Number.isInteger(proficiency)||proficiency<1||proficiency>10||!Number.isInteger(honed)||honed<0||honed>9){notify('Check Proficiency (1–10) and Honed Edge (0–9).','error');return;}

    const formula = this.container.querySelector('#dmg_formula').value.trim();
    const wSelect = this.container.querySelector('#dmg_weapon_select');
    const chosenType = this.container.querySelector('#dmg_damage_type').value;
    const activeWeapon = this.currentActor && wSelect?.value ? (tokenInventory(this.currentActor).weapons || []).find(w => w.id === wSelect.value) : null;
    // The formula left in the panel may be just dice ("1d6+1"): then the weapon says the type (Energy −2…).
    const formulaType = formula ? damageTypeOf(formula) : 'physical';
    const tag = this.container.querySelector('#dmg_delivery_tag').value;
    const weaponType = activeWeapon ? damageTypeOf(activeWeapon) : damageTypeOf(tag);
    const typedFormula = /\b(?:physical|phys)\b/i.test(formula) || formulaType !== 'physical';
    const autoType = typedFormula ? formulaType : weaponType;
    const damageType = chosenType && chosenType !== 'auto' ? chosenType : autoType;
    const types = hitTypes(damageType, activeWeapon, formula, tag);
    feats = { ...weaponFeatures(activeWeapon), crushing, bleed }; // the two boxes follow the weapon and can be changed by hand
    if ((!isDirect && !perHit && (![major, severe].every(Number.isFinite) || major < 1 || severe < major)) || (!formula && (![diceCount,diceSides,flatMod].every(Number.isFinite) || diceCount<1 || diceCount>100))) { notify('Check the damage dice and thresholds.','error'); return; }
    // A drone is fired by a player character: its Critical doubles the dice like any player's.
    const keeperAttack = this.currentActor?.isPlayer === false && !isDroneToken(this.currentActor);
    if (!rolled && this.can3D()) {
      let pools = [];
      try { pools = damageDicePools(formula, { proficiency, diceCount, diceSides, isCritical: isCritical && !keeperAttack, isKeeperCritical: isCritical && keeperAttack }); } catch { pools = []; }
      const dice = pools.reduce((n, p) => n + p.count, 0);
      // Past 40 dice the table is unreadable: those are rolled as numbers.
      if (dice > 0 && dice <= 40) {
        audio.playDiceRoll();
        const label = `${this.currentActor?.name || 'Daño'} · Daño${targetToken ? ` a ${targetToken.name}` : ''}`;
        return this.roll3D(pools.map(p => ({ qty: p.count, sides: p.sides, theme: 'vfDamage', role: 'Damage' })), label).then(faces => this.executeDamageCalc(faces || [], { bearDown, riders, extrasPinned, extraFaces }));
      }
    }
    const faces = [...(rolled || [])], thrownFaces = [...(rolled || [])];
    const damageOptions = {
      attackerName: this.currentActor?.name || 'Attacker',
      targetName: targetToken?.name || 'Target',
      diceCount: diceCount + proficiency - 1,
      diceSides,
      flatModifier: flatMod + honed + bearDown + riderTotal,
      bonusComponents, bonus: bearDown + riderTotal, // the formula path adds it too
      ...(faces.length ? { rollDie: sides => { const face = faces.shift(); return Number.isInteger(face) && face >= 1 && face <= sides ? face : Math.floor(Math.random() * sides) + 1; } } : {}),
      isCritical: isCritical && !keeperAttack,
      isKeeperCritical: isCritical && keeperAttack,
      isDirectDamage: isDirect,
      targetMajorThreshold: major,
      targetSevereThreshold: severe,
      useArmorSlot: useArmor,
      currentArmorSlots: targetToken ? usableSlots(targetToken) : 2,
      mountRating: mr,
      proficiency, honed,
      damageType, types, targetToken, deliveryTag: tag,
      typeOverride: chosenType && chosenType !== 'auto' ? chosenType : '',
      targetReflective: reflectiveInput.checked,
      targetWarded: wardedInput.checked,
    };
    let dmgResult;
    try { dmgResult = formula ? resolveDamageExpression(formula, damageOptions) : resolveDamage(damageOptions); }
    catch (error) { notify(error.message, 'error'); return; }
    // Weapon features on the damage: Burst Fire, Massive, Energy Surge add to it; Devastating
    // marks 1 more HP at the Severe Threshold. The severity is worked out again on the new total.
    const rollSides = dmgResult.pools ? dmgResult.pools.flatMap(p => Array(p.count * (damageOptions.isCritical ? 2 : 1)).fill(p.sides)) : dmgResult.rolls.map(() => diceSides);
    const extraSides = rollSides.length === dmgResult.rolls.length ? rollSides : dmgResult.rolls.map(() => diceSides);
    // The weapon's extra dice (Burst Fire, Massive, Energy Surge) are thrown as 3D dice too, after
    // the damage dice; the damage is then worked out again with the same faces.
    if (!extrasPinned && !extraFaces && thrownFaces.length && this.can3D()) {
      const extraGroups = extraDiceNeeded(feats, dmgResult.rolls, extraSides);
      if (extraGroups.length) {
        const label = `${this.currentActor?.name || 'Daño'} · ${[...new Set(extraGroups.map(g => g.role))].join(' · ')}`;
        return this.roll3D(extraGroups.map(g => ({ ...g, theme: 'vfDamage' })), label).then(more => this.executeDamageCalc(thrownFaces, { bearDown, riders, extrasPinned, extraFaces: more || [] }));
      }
    }
    const extras = extrasPinned || damageExtras(feats, dmgResult.rolls, extraSides, extraFaces?.length ? facesRoller(extraFaces) : undefined);
    if (extras.bonus) {
      const components = dmgResult.components.map((part, i) => i ? part : { ...part, amount: part.amount + extras.bonus * mr });
      // The resolved parts already contain the opening strike and Breaking Point.
      const again = resolveDamage({ ...damageOptions, diceCount: 0, components, bonusComponents: [] });
      dmgResult = { ...dmgResult, ...again, rolls: dmgResult.rolls, flatModifier: dmgResult.flatModifier, baseDiceTotal: dmgResult.baseDiceTotal };
    }
    const devastating = isDirect || perHit ? 0 : devastatingExtra(feats, dmgResult.effectiveDamage, dmgResult.effectiveSevere);
    if (devastating) dmgResult = { ...dmgResult, finalHpDamage: dmgResult.finalHpDamage + devastating };
    const maxDie = dmgResult.rolls.some((r, i) => r === (rollSides[i] || diceSides));
    // An enemy's maximum Armor Slots are cut at once by Armor Piercing, Disintegrating, Shredding.
    const enemyArmor = !isDirect && !!targetToken && !isPartyToken(targetToken) && (targetToken.armor?.max || 0) > 0;
    const plannedCut = enemyArmor ? armorCut(activeWeapon, { hit: true, damaged: dmgResult.finalHpDamage > 0, maxDie }, targetToken.armor.max) : null;
    const featureNotes = [...riders.map(r => `${r.label}: +${r.value}${r.faces?.length ? ` (${r.dice} [${r.faces.join(', ')}])` : ''}.`), ...extras.notes, ...(devastating ? ['Devastating: alcanza el umbral Severe y marca 1 HP más.'] : []), ...(isDirect ? [] : armorSlotNotes(feats, { composite })),
      ...(feats.poison ? ['Poison: si pierde HP, el objetivo marca 1 Stress.'] : []), ...(feats.ignite ? ['Ignite: si pierde HP, el objetivo queda On Fire.'] : []),
      ...armorCutNotes(plannedCut),
      ...featureReminders(activeWeapon, { damaged: dmgResult.finalHpDamage > 0, critical: isCritical, maxDie, hit: true, armorAuto: enemyArmor })];
    this.lastFeatureNotes = featureNotes; // the player's Ficha shows them under the result
    // What the Keeper has to resolve by hand goes to the Keeper as a whisper, once per attack.
    if (this.featureWhisper) {
      const toResolve = featureReminders(activeWeapon, { damaged: dmgResult.finalHpDamage > 0, critical: isCritical, maxDie, hit: true, armorAuto: enemyArmor });
      const text = rulesWhisperText({ ...this.featureWhisper, notes: toResolve });
      this.featureWhisper = null;
      if (text) void whisperToKeeper(text);
    }

    if (rolled?.length) {
      const sidesOf = (dmgResult.pools || [{ count: dmgResult.rolls.length, sides: diceSides }]).flatMap(p => Array(p.count * (damageOptions.isCritical ? 2 : 1)).fill(p.sides));
      this.announceRoll({
        label: `Daño · ${damageOptions.attackerName}${targetToken ? ` → ${targetToken.name}` : ''}`, actorName: damageOptions.attackerName,
        playerName: store.state.userName || store.state.playerName || (store.state.userRole === 'keeper' ? 'Keeper' : 'Jugador'),
        tokenName: damageOptions.attackerName, skill: bearDown ? `Daño · Bear Down +${bearDown}` : 'Daño',
        modifiers: `${formula || `${damageOptions.diceCount}d${diceSides}`}${proficiency > 1 ? ` · Proficiency ${proficiency}` : ''}${honed ? ` · Honed Edge +${honed}` : ''}${damageOptions.isCritical ? ' · Crítico: dados dobles' : ''}${riders.length ? ` · ${riders.map(r => `${r.label} +${r.value}`).join(' · ')}` : ''}${extras.bonus ? ` · Propiedades del arma +${extras.bonus}` : ''}${devastating ? ' · Devastating +1 HP' : ''}`,
        value: dmgResult.rawDamage, total: dmgResult.rawDamage, outcome: `${dmgResult.rawDamage} · ${dmgResult.finalSeverity}`,
        rolls: dmgResult.rolls.map((value, i) => ({ value, sides: sidesOf[i] || diceSides, role: 'Damage' })), style: 'overlay'
      }, { rolled3D: true, secret: this.rollVisibility() === 'keeper' });
    }
    const display = this.container.querySelector('#damage_result_display');
    display.style.display = 'block';

    this.container.querySelector('#dmg_raw_val').textContent = dmgResult.rawDamage;
    this.container.querySelector('#dmg_severity_val').textContent = dmgResult.finalSeverity;
    this.container.querySelector('#dmg_hp_loss_val').textContent = `${dmgResult.finalHpDamage} HP`;

    const detailText = (bearDown ? `Bear Down +${bearDown} · ` : '') + (formula ? formula + ' · ' : '') + `Dice: [${dmgResult.rolls.join(', ')}] + ${dmgResult.flatModifier} ${dmgResult.mountRating > 1 ? `x MR ${dmgResult.mountRating}` : ''} = ${dmgResult.rawDamage} Raw Damage. ` +
      (dmgResult.penetration
        ? `${DAMAGE_TYPES[dmgResult.damageType]} · Penetración −${dmgResult.penetration}: umbrales ${major}/${severe} → ${dmgResult.effectiveMajor}/${dmgResult.effectiveSevere} para este impacto. `
        : `${DAMAGE_TYPES[dmgResult.damageType] || 'Physical'}${!isDirect && !perHit && dmgResult.damageType !== 'physical' ? ' · Penetración anulada por la defensa del objetivo' : ''}. `) +
      (dmgResult.protection ? dmgResult.groups.map(g => g.types.join('/') + ' ' + g.amount + ' → ' + g.effective +
        (g.applied === 'immune' ? ' (inmunidad)' : g.applied === 'resistant' ? ' (resistencia)' : '')).join(' + ') + '. ' : '') +
      (dmgResult.stressMarked ? 'Neural: +1 Stress. ' : '') +
      (featureNotes.length ? featureNotes.join(' ') + ' ' : '') +
      (bleed && !dmgResult.fullyProtected ? (targetToken && !canBleed(targetToken) ? 'Bleed: el objetivo no sangra (inmune). ' : 'Bleed: el objetivo queda Bleeding. ') : '') +
      (isDirect ? '' : perHit ? 'Sin umbrales: 1 HP por impacto que cause daño. ' : `Compared to Major (${dmgResult.effectiveMajor}) & Severe (${dmgResult.effectiveSevere}). `) +
      (dmgResult.armorSlotSpent ? '1 Armor Slot spent to lower severity step.' : 'No armor slot used.');
    const secret = this.rollVisibility() === 'keeper';
    this.secretDamage = secret;
    this.container.querySelector('#dmg_detail_text').textContent = (secret ? 'SOLO KEEPER · ' : '') + detailText;
    if (secret) store.addLog({ visibility: 'keeper', type: 'DAMAGE', sender: 'Keeper', title: 'Daño · ' + (targetToken?.name || 'Sin objetivo'), details: detailText });

    // Snapshot presentation choices, but never animate or broadcast a damage preview.
    const attackerId = this.currentActor?.id || store.state.selectedTokenId;
    const preparedWeapon = this.currentActor && this.preparedWeapon ? tokenInventory(this.currentActor).weapons.find(w => w.id === this.preparedWeapon.id) : null;
    const impactKind = weaponImpactType(preparedWeapon || [this.currentActor?.name, formula].join(' '), this.container.querySelector('#dmg_impact_type').value);
    const damageMapId = targetToken?.mapId;

    let spentShieldsChoice = null;
    const targetArmorAvailable = dmgResult.fullyProtected ? 0 : usableSlots(targetToken);
    const shieldRow = this.container.querySelector('#dmg_shield_mitigation_row');
    const mitigateBtn = this.container.querySelector('#dmg_mitigate_btn');
    if (shieldRow && mitigateBtn) {
      if (!isDirect && targetArmorAvailable > 0) {
        shieldRow.style.display = 'block';
        mitigateBtn.textContent = `🛡️ Gastar escudos (${targetArmorAvailable} disponible${targetArmorAvailable > 1 ? 's' : ''})`;
        mitigateBtn.onclick = () => {
          const freshTarget = store.state.tokens.find(t => t.id === targetId) || targetToken;
          promptShieldMitigation(freshTarget, dmgResult.rawDamage, usableSlots(freshTarget), (spent) => {
            spentShieldsChoice = spent;
            mitigateBtn.textContent = `🛡️ Escudos seleccionados: ${spent}`;
            applyBtn.textContent = `APPLY DAMAGE (${spent} ESCUDO${spent !== 1 ? 'S' : ''} GASTADO${spent !== 1 ? 'S' : ''})`;
          });
        };
      } else {
        shieldRow.style.display = 'none';
      }
    }

    // Apply button - Enabled for both Keeper and Token Owner Players
    const applyBtn = this.container.querySelector('#apply_dmg_to_target_btn');
    let applied = false, awaitingKeeper = false;
    // The damage stays open to Bear Down until it is applied: the same dice, plus the bonus.
    const pending = { checkId: this.lastAttack?.actorId === attackerId && this.lastAttack?.targetId === targetId && this.lastAttack?.hit ? this.lastAttack.checkId : null, targetId, actorId: attackerId, faces: dmgResult.rolls.slice(), bonus: bearDown, riders, extras, raw: dmgResult.rawDamage, severity: dmgResult.finalSeverity, applied: false };
    this.lastDamage = pending; this.lastRollKind = 'damage';
    queueMicrotask(() => window.veilCardHand?.refresh?.());
    applyBtn.disabled = !targetToken;
    applyBtn.textContent = targetToken ? 'APPLY DAMAGE TO TARGET' : 'ELIGE UN OBJETIVO Y VUELVE A CALCULAR';
    applyBtn.onclick = () => {
      if (applied || awaitingKeeper) return;
      const canApply = () => {
        const attacker = store.state.tokens.find(t => t.id === attackerId);
        if (attackerId && (!attacker || lifeStage(attacker))) { notify('Este personaje no puede infligir daño ordinario.', 'error'); return false; }
        return store.state.activeMapId === damageMapId;
      };
      if (!canApply()) return;
      const currentTarget = store.state.tokens.find(t => t.id === targetId);
      if (!currentTarget) return;
      if (currentTarget.mapId !== damageMapId || currentTarget.mapId !== store.state.activeMapId) {
        notify('La escena o el objetivo ha cambiado. Calcula de nuevo el daño.', 'error');
        return;
      }

      // What this hit does with a number of shields spent (nothing is changed yet).
      const planDamage = (spentShields = 0, reaction = null) => {
        const targetToken = store.state.tokens.find(t => t.id === targetId) || currentTarget;

        const currentDamage = resolveDamage({
          diceCount: 0,
          // A reaction Power (Photon Shield, Impact Absorption, Mind Shield) lowers the damage first.
          components: reaction ? reduceComponents(dmgResult.components, reaction.amount, reaction.types) : dmgResult.components,
          targetToken,
          targetMajorThreshold: targetToken.hp.majorThreshold != null ? targetToken.hp.majorThreshold + thresholdBonus(targetToken) : major,
          targetSevereThreshold: targetToken.hp.severeThreshold != null ? targetToken.hp.severeThreshold + thresholdBonus(targetToken) : severe,
          isDirectDamage: isDirect,
          useArmorSlot: spentShields > 0,
          currentArmorSlots: usableSlots(targetToken),
          damageType: dmgResult.damageType,
          targetReflective: damageOptions.targetReflective,
          targetWarded: damageOptions.targetWarded
        });

        if (currentDamage.fullyProtected) spentShields = 0;
        // Each shield spent absorbs damage/reduces severity
        const mitigatedHpDamage = Math.max(0, (currentDamage.finalHpDamage || 0) + (isDirect || perHitMinion(targetToken) ? 0 : devastatingExtra(feats, currentDamage.effectiveDamage, currentDamage.effectiveSevere)) - (spentShields > 0 ? (spentShields - 1) : 0));
        const finalHpDamage = targetToken.pendingBrace && !isDirect ? Math.max(0, mitigatedHpDamage - 1) : mitigatedHpDamage;

        const currentArmor = targetToken.armor?.current || 0;
        const newArmor = Math.max(0, currentArmor - spentShields);
        const newHp = Math.max(0, targetToken.hp.current - finalHpDamage);

        const attacker = store.state.tokens.find(t => t.id === attackerId && t.mapId === damageMapId);
        const hpLost = targetToken.hp.current - newHp;
        const armorLost = currentArmor - newArmor;
        // Neural: 1 Stress on top of the HP, capped by the target's Stress track.
        // Neural, Energy Surge and Poison mark Stress; Bleed and Ignite add their condition.
        const stressMark = !currentDamage.fullyProtected && targetToken.stress ? Math.min(3, (currentDamage.stressMarked ? 1 : 0) + (isDirect ? 0 : hitStress(feats, { hpLost }))) : 0;
        const addCondition = !currentDamage.fullyProtected && bleed && canBleed(targetToken) ? 'Bleeding' : '';
        const addConditions = isDirect || currentDamage.fullyProtected ? [] : hitConditions(feats, { hpLost });
        const withCondition = t => (addCondition || addConditions.length) ? { conditions: normalizeConditions([...(t.conditions || []), ...(addCondition ? [addCondition] : []), ...addConditions]) } : {};
        // The cut to an enemy's maximum Armor Slots, on the armor left after this hit.
        const cut = enemyArmor && !isPartyToken(targetToken) ? armorCut(activeWeapon, { hit: true, damaged: hpLost > 0, maxDie }, targetToken.armor?.max || 0) : null;
        const armorAfter = t => (cut ? applyArmorCut({ ...t.armor, current: newArmor }, cut) : { ...t.armor, current: newArmor });
        const withStress = t => stressMark ? { stress: { ...t.stress, current: Math.min(t.stress.max ?? (t.stress.current || 0) + stressMark, (t.stress.current || 0) + stressMark) } } : {};

        const damagePayload = {
          type: 'APPLY_DAMAGE',
          attackerId: attacker?.id || attackerId,
          targetId: targetToken.id,
          newHp,
          newArmor,
          hpLoss: hpLost,
          armorLoss: armorLost,
          spentShields,
          stressMark,
          ...(cut ? { armorCut: cut } : {}),
          addCondition,
          addConditions,
          isDirect,
          isCritical,
          rawDamage: dmgResult.rawDamage,
          defense: { groups: currentDamage.groups.map(({ types, applied }) => ({ types, applied })), hp: targetToken.hp.current, armor: currentArmor },
          kind: impactKind,
          secret,
          logDetails: `Lost ${hpLost} HP (${currentDamage.finalHpDamage} base). Escudos gastados: ${spentShields}. Current HP: ${newHp}/${targetToken.hp.max}.${cut ? ` Armor Slots máximos −${cut.long + cut.repairAll + cut.downtime} (${armorAfter(targetToken).max}).` : ''}`
        };
        return { targetToken, attacker, currentDamage, newHp, newArmor, hpLost, spentShields, armorAfter, withStress, withCondition, damagePayload };
      };

      const applyFinalDamage = (spentShields = 0, reaction = null) => {
        if (applied || !canApply()) return;
        applied = true; pending.applied = true;
        applyBtn.disabled = true;
        applyBtn.textContent = 'DAMAGE APPLIED';
        const { targetToken, attacker, currentDamage, newHp, hpLost, armorAfter, withStress, withCondition, damagePayload } = planDamage(spentShields, reaction);

        if (store.sessionRole === 'player') {
          network.broadcast?.(damagePayload);
          // Actualización optimista local del target para feedback inmediato
          store.remoteApplying = true;
          try {
            store.update({
              tokens: store.state.tokens.map(t => t.id === targetToken.id ? {
                ...t,
                hp: { ...t.hp, current: newHp },
                pendingBrace: isDirect ? t.pendingBrace : false,
                armor: armorAfter(t),
                ...withStress(t), ...withCondition(t)
              } : t)
            });
          } finally {
            store.remoteApplying = false;
          }
        } else {
          // This machine is the table (the Keeper, or the Keeper's own Player view): the damage is
          // the table's action, even on a token the previewed character does not control.
          const before = store.tableActing; store.tableActing = true;
          try {
            store.updateToken(targetToken.id, {
              hp: { ...targetToken.hp, current: newHp },
              pendingBrace: isDirect ? targetToken.pendingBrace : false,
              armor: armorAfter(targetToken),
              ...withStress(targetToken), ...withCondition(targetToken)
            });
          } finally { store.tableActing = before; }
        }

        const params = attackPresentation({
          attacker: attacker || targetToken,
          target: targetToken,
          mapId: damageMapId,
          kind: impactKind,
          hpLost: hpLost,
          armorSlotSpent: spentShields > 0,
          isDirect,
          isCritical,
          gridSize: store.getActiveMap()?.gridSize || 64
        });

        if (params) {
          params.targetId = targetToken.id;
          params.attackerId = attacker?.id;
          if (attacker?.hidden) params.attacker = { ...params.target };
          window.veilCanvas?.triggerAttackFX(params);
          if (!secret && !targetToken.hidden && store.sessionRole !== 'player') network.broadcast?.({ type: 'ATTACK_FX', params });
        }

        store.addLog({
          sender: 'Combat',
          ...(secret ? { visibility: 'keeper' } : {}),
          type: 'DAMAGE',
          title: `DAMAGE APPLIED: ${targetToken.name}`,
          details: `Lost ${hpLost} HP (${currentDamage.finalHpDamage} base). Escudos gastados: ${spentShields}. Current HP: ${newHp}/${targetToken.hp.max}.`
        });
        // Rapid Regeneration lights up for whoever can heal the character now (v2.38.0).
        if (hpLost > 0 && store.sessionRole !== 'player') offerAfterDamage(targetToken.id);
        // The attack is over: the Ficha closes it and the tokens are deselected.
        window.dispatchEvent(new CustomEvent('veil:attack-done', { detail: { attackerId: attacker?.id || attackerId, targetId: targetToken.id } }));
      };

      const useArmor = this.container.querySelector('#dmg_use_armor')?.checked;
      const currentArmorNow = planDamage(0).currentDamage.fullyProtected ? 0 : usableSlots(currentTarget);
      // Damage is always the Keeper's call (v2.27.5; v2.29.1: always, whatever the target, also
      // one the player controls): a window lets the Keeper choose its shields and apply or cancel
      // it. A connected player's hit goes to the Keeper with every option worked out.
      const maxShields = isDirect ? 0 : currentArmorNow;
      const options = Array.from({ length: Math.min(maxShields, 10) + 1 }, (_, n) => planDamage(n).damagePayload);
      // Reaction Powers the target (or an ally) can use on this hit, each with its own options.
      const reactions = isDirect ? [] : damageReactions({ target: currentTarget, attacker: store.state.tokens.find(t => t.id === attackerId), components: dmgResult.components, tokens: store.state.tokens, map: store.getActiveMap(), data: cardData() })
        .map(r => { const most = planDamage(0, r).currentDamage.fullyProtected ? 0 : usableSlots(currentTarget); return { ...r, options: Array.from({ length: Math.min(most, 10) + 1 }, (_, n) => planDamage(n, r).damagePayload) }; });
      const request = { attackerName: damageOptions.attackerName, targetId: currentTarget.id, targetName: currentTarget.name, raw: dmgResult.rawDamage, severity: dmgResult.finalSeverity, options, reactions, secret };
      if (store.sessionRole === 'player') {
        applied = true; pending.applied = true; applyBtn.disabled = true; applyBtn.textContent = 'ENVIADO AL KEEPER';
        network.sendToHost?.({ type: 'DAMAGE_REQUEST', request });
        notify(`Daño a ${currentTarget.name}: el Keeper decide los escudos y si lo aplica.`);
        window.dispatchEvent(new CustomEvent('veil:attack-done', { detail: { attackerId, targetId: currentTarget.id } }));
        return;
      }
      awaitingKeeper = true;
      keeperDamageDialog(currentTarget, request, (n, ri = -1) => {
        const reaction = ri >= 0 ? reactions[ri] : null;
        awaitingKeeper = false;
        const live = store.state.tokens.find(t => t.id === targetId);
        if (!live || live.mapId !== damageMapId || store.state.activeMapId !== damageMapId) {
          notify('El objetivo ha salido de la escena.', 'error'); return;
        }
        const before = (reaction ? reaction.options : options)[n], now = planDamage(n, reaction).damagePayload;
        if (before.newHp !== now.newHp || before.hpLoss !== now.hpLoss || before.newArmor !== now.newArmor || before.stressMark !== now.stressMark) {
          notify('Han cambiado las defensas. Revisa el resultado actualizado.');
          pending.apply();
          return;
        }
        applyFinalDamage(n, reaction);
        if (reaction) network.requestAction({ type: 'REACTION_PAY', actorId: reaction.actorId, name: reaction.name, amount: reaction.amount }).catch(error => notify(error.message, 'error'));
      }, { shields: spentShieldsChoice ?? (useArmor ? 1 : 0), onCancel: () => { awaitingKeeper = false; } });
    };
    pending.apply = applyBtn.onclick;
  }
}

// The Keeper's window for damage to an NPC or adversary: how many shields it spends (each
// option already worked out by the attacker) and Apply or Cancel. onApply(n) / onCancel().
// A reaction Power the Keeper offers at the table (the player decides): resolves with the token
// that uses it, or null. Nothing is offered when no one can use it.
// A reaction that is a whole card (Blinding Flash): the table plays it for the character that
// accepted and rolls at once the Reaction Rolls it asks of the adversaries.
async function castReaction(reactor, name) {
  try {
    const { characterCards } = await import('./loadoutCards.js');
    const live = store.state.tokens.find(t => t.id === reactor.id), card = live && characterCards(live, cardData()).find(c => c.name === name && c.playable);
    if (!card) return;
    const result = await network.requestAction({ type: 'CARD_PLAY', actorId: live.id, cardId: card.id });
    const { resolutionLog } = await import('./cardResolution.js');
    for (const reply of resolutionLog(store, result.id)?.resolution?.replies || []) {
      const who = store.state.tokens.find(t => t.id === reply.actorId);
      if (who?.isPlayer !== false) continue;
      await network.requestAction({ type: 'CHECK', actorId: who.id, cardPlayId: result.id, cardReplyId: reply.id, options: { traitId: reply.traitId, dc: reply.dc } }).catch(() => {});
    }
  } catch (error) { notify(error.message, 'error'); }
}

export function offerReaction(name, target, text) {
  const reactors = reactorsFor(name, target, store.state.tokens, store.getActiveMap?.(), cardData());
  if (!reactors.length || typeof document === 'undefined' || !document.body) return Promise.resolve(null);
  const cost = REACTIONS[name].cost.hope ? REACTIONS[name].cost.hope + ' Hope' : REACTIONS[name].cost.stress + ' Stress';
  return new Promise(resolve => {
    const modal = tableDialog(name, `<div class="kdmg"><p>${escapeHTML(text)}</p><p class="dossier-muted">Reacción (${escapeHTML(cost)}). La carta se ha iluminado a ${escapeHTML(reactors.map(r => r.name).join(', '))}; si no responde, decides tú.</p><p class="kdmg-answers" role="status"></p></div>
      <footer class="dossier-footer"><button class="hud-btn hud-btn-secondary" type="button" data-react="">No la usa</button>${reactors.map(r => `<button class="hud-btn hud-btn-primary" type="button" data-react="${escapeHTML(r.id)}">${escapeHTML(r.name)} la usa</button>`).join('')}</footer>`, 'damage-action-dialog');
    let done = false, offerId = null;
    const declined = new Set();
    const finish = id => { if (done) return; done = true; closeOffer(offerId); modal.remove(); resolve(reactors.find(r => r.id === id) || null); };
    // The players who can use it see it lit on their screen (v2.37.0); their answer decides.
    offerId = sendOffer({ name, reactors, text, cost }, ({ reactorId, use }) => {
      if (use) { finish(reactorId); return; }
      declined.add(reactorId);
      const line = modal.querySelector('.kdmg-answers');
      if (line) line.textContent = reactors.filter(r => declined.has(r.id)).map(r => r.name + ' la deja pasar').join(' · ');
      if (declined.size >= reactors.length) finish('');
    });
    modal.querySelectorAll('[data-react]').forEach(b => b.onclick = () => finish(b.dataset.react));
    new MutationObserver((_, obs) => { if (!modal.isConnected) { obs.disconnect(); finish(''); } }).observe(document.body, { childList: true });
  });
}

export function keeperDamageDialog(targetToken, request, onApply, { shields = 0, onCancel = () => {} } = {}) {
  const base = Array.isArray(request?.options) && request.options.length ? request.options : null;
  if (!base) return;
  if (typeof document === 'undefined' || !document.body) { onApply(0, -1); return; }
  // Reaction Powers (v2.33.0): each one has its own options, worked out by the attacker.
  const reactions = (Array.isArray(request.reactions) ? request.reactions : []).filter(r => Array.isArray(r?.options) && r.options.length);
  let ri = reactions.findIndex(r => r.free);
  const set = () => (ri >= 0 ? reactions[ri].options : base), max = () => set().length - 1;
  const describe = n => { const o = set()[Math.min(n, max())]; return `Pierde ${o.hpLoss} HP · HP ${o.newHp}/${targetToken.hp?.max ?? '?'}${o.stressMark ? ` · +${o.stressMark} Stress` : ''}${n ? ` · ${n} escudo${n > 1 ? 's' : ''}` : ''}`; };
  const start = Math.max(0, Math.min(max(), shields));
  const modal = tableDialog('Daño a ' + targetToken.name, `
    <div class="kdmg">
      <div class="kdmg-head"><img src="${escapeHTML(actorPortrait(targetToken))}" alt="" />
        <div><strong>${escapeHTML(targetToken.name)}</strong><p class="dossier-muted">${escapeHTML(request.attackerName || 'Ataque')}: ${escapeHTML(String(request.raw))} de daño · ${escapeHTML(String(request.severity || ''))}</p></div></div>
      ${reactions.length ? `<label class="dossier-field"><span>Reacción (pregunta al jugador)</span><vf-select class="hud-select" id="kdmg_reaction"><option value="-1">Ninguna</option>${reactions.map((r, i) => `<option value="${i}"${i === ri ? ' selected' : ''}>${escapeHTML(r.label)}</option>`).join('')}</vf-select></label>` : ''}
      <label class="dossier-field kdmg-shields" id="kdmg_shields_field"><span id="kdmg_shields_label"></span>
        <div class="kdmg-row"><input type="range" id="kdmg_shields" min="0" max="${max()}" value="${start}" /><b id="kdmg_shields_val">${start}</b></div></label>
      <p class="dossier-muted" id="kdmg_noshields">Sin escudos disponibles para este impacto.</p>
      <p class="kdmg-preview" id="kdmg_preview">${escapeHTML(describe(start))}</p>
    </div>
    <footer class="dossier-footer"><button class="hud-btn hud-btn-secondary" type="button" id="kdmg_cancel">Cancelar</button>
      <button class="pab-apply-main" type="button" id="kdmg_apply">Aplicar daño</button></footer>`, 'damage-action-dialog');
  const slider = modal.querySelector('#kdmg_shields'), val = modal.querySelector('#kdmg_shields_val'), preview = modal.querySelector('#kdmg_preview');
  const chosen = () => Math.max(0, Math.min(max(), parseInt(slider.value || '0', 10)));
  const sync = () => {
    slider.max = String(max()); if (chosen() !== Number(slider.value)) slider.value = String(chosen());
    modal.querySelector('#kdmg_shields_field').hidden = max() < 1; modal.querySelector('#kdmg_noshields').hidden = max() >= 1;
    modal.querySelector('#kdmg_shields_label').textContent = `Escudos a gastar (${max()} disponible${max() > 1 ? 's' : ''})`;
    val.textContent = slider.value; preview.textContent = describe(chosen());
  };
  slider.oninput = sync;
  const pick = modal.querySelector('#kdmg_reaction');
  if (pick) pick.onchange = () => { ri = Number(pick.value); sync(); };
  sync();
  // Each reaction lights up for its player (v2.37.0): «use it» selects it here; the Keeper
  // still applies the damage, and decides if nobody answers.
  const offers = [], said = [];
  reactions.forEach((r, i) => {
    if (r.free) return;
    const rule = REACTIONS[r.name], cost = rule?.cost?.hope ? rule.cost.hope + ' Hope' : rule?.cost?.stress ? rule.cost.stress + ' Stress' : '';
    offers.push(sendOffer({ name: r.name, reactors: [{ id: r.actorId, name: r.actorName }], text: `${request.attackerName || 'Un ataque'} daña a ${targetToken.name} (${request.raw}). ${r.label}.`, cost }, ({ use }) => {
      said.push(`${r.actorName} ${use ? 'usa' : 'deja pasar'} ${r.name}`);
      if (use && pick) { ri = i; pick.value = String(i); sync(); }
      const line = modal.querySelector('#kdmg_answers'); if (line) line.textContent = said.join(' · ');
    }));
  });
  if (offers.length) modal.querySelector('#kdmg_preview')?.insertAdjacentHTML('beforebegin', '<p class="kdmg-answers" id="kdmg_answers" role="status">Reacciones avisadas a sus jugadores…</p>');
  let done = false;
  const close = () => offers.forEach(closeOffer);
  modal.querySelector('#kdmg_apply').onclick = () => { done = true; close(); const n = chosen(); modal.remove(); onApply(n, ri); };
  modal.querySelector('#kdmg_cancel').onclick = () => { done = true; close(); modal.remove(); onCancel(); };
  // Closing the window another way also cancels.
  new MutationObserver((_, obs) => { if (!modal.isConnected) { obs.disconnect(); close(); if (!done) { done = true; onCancel(); } } }).observe(document.body, { childList: true });
}

export function promptShieldMitigation(targetToken, incomingRawDamage, usable, onConfirm) {
  // Older callers pass the callback third; then every available slot is usable.
  if (typeof usable === 'function') { onConfirm = usable; usable = undefined; }
  if (typeof document === 'undefined' || !document.body) {
    onConfirm(targetToken.armor?.current > 0 ? 1 : 0);
    return;
  }
  const currentShields = Math.max(0, Math.min(targetToken.armor?.current || 0, usable ?? Infinity));
  if (currentShields <= 0) {
    onConfirm(0);
    return;
  }

  const modal = tableDialog('Escudos · ' + targetToken.name, `
    <div class="kdmg">
      <div class="kdmg-head"><img src="${escapeHTML(actorPortrait(targetToken))}" alt="" />
        <p>Impacto de <strong>${escapeHTML(String(incomingRawDamage))}</strong> de daño</p></div>
      <label class="dossier-field"><span>Escudos que gastas (disponibles: ${currentShields})</span>
        <div class="kdmg-row"><input type="range" id="mitigate_shields_slider" min="0" max="${currentShields}" value="1" />
          <b id="mitigate_shields_val">1</b></div></label>
    </div>
    <footer class="dossier-footer">
      <button class="hud-btn hud-btn-secondary" type="button" id="mitigate_zero_btn">Sin escudos</button>
      <button class="hud-btn hud-btn-primary" type="button" id="mitigate_confirm_btn">Confirmar escudos</button>
    </footer>`, 'damage-action-dialog');

  const slider = modal.querySelector('#mitigate_shields_slider');
  const valText = modal.querySelector('#mitigate_shields_val');
  if (slider && valText) {
    slider.oninput = () => { valText.textContent = slider.value; };
  }

  modal.querySelector('#mitigate_zero_btn').onclick = () => {
    modal.remove();
    onConfirm(0);
  };

  modal.querySelector('#mitigate_confirm_btn').onclick = () => {
    const chosen = Math.max(0, Math.min(currentShields, parseInt(slider?.value || '0', 10)));
    modal.remove();
    onConfirm(chosen);
  };
}
