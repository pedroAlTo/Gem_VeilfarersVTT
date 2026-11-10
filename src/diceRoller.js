import { attackPresentation, weaponImpactType } from './combatFX.js';
import { IMPACT_TYPES } from './encounterRules.js';
// src/diceRoller.js
// Authentic Veilfarers Dice Roller & Threshold Damage Calculator

import { rollVeilfarersCheck, resolveDamage, DC_LADDER, TRAITS, SUBTRAITS } from './rulesEngine.js';
import { notify, sanitizeHTML, escapeHTML } from './ui.js';
import { characterDetails } from './characterImport.js';
import { store } from './state.js';
import { audio } from './audioEngine.js';
import { network } from './networkManager.js';
import { tokenInventory, weaponPreset, parseDamageExpression, resolveDamageExpression } from './equipment.js';

export class DiceRollerSidebar {
  constructor(containerElement) {
    this.container = containerElement;
    this.selectedTraitId = 'finesse';
    this.selectedSubtraitId = '';
    this.currentActor = null;
    this.render();
    this.syncWithSelectedToken();
    window.veilDiceRoller = this;

    store.subscribe((state, keys) => {
      if (keys.some(key => ['selectedTokenId', 'tokens', 'userRole', 'isConnected', 'claimedTokenId'].includes(key))) {
        this.syncWithSelectedToken();
      }
    });
  }

  rollVisibility() {
    return store.sessionRole !== 'player' && store.state.userRole === 'keeper' && this.container.querySelector('#secret_roll')?.checked ? 'keeper' : 'table';
  }

  syncWithSelectedToken() {
    const token = store.getSelectedToken();
    const actorChanged=this.currentActor?.id!==token?.id;
    this.currentActor = token;
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
    this.container.querySelector('#roll_check_btn').disabled = !secret && (!token || !store.canEditToken(token.id));
    this.container.querySelector('#roll_check_btn .btn-glow-text').textContent = secret ? 'TIRADA SECRETA · 2d12' : 'ROLL 2d12 (HOPE & FEAR)';
    if (!token) this.container.querySelector('#dice_actor_name').textContent = secret ? 'Keeper · sin actor seleccionado' : 'Selecciona un actor';
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
    if(actorChanged){this.container.querySelector('#dmg_honed').value=token?.path==='Sleeping'?(token.honedEdgeBonus??Math.max(0,(token.level||1)-1)):0;this.container.querySelector('#dmg_proficiency').value=token?.proficiency||1;}
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
    }
  }

  setCheckData({ actor, traitId, traitName, traitMod }) {
    this.currentActor = actor;
    this.selectedTraitId = traitId;
    this.selectedSubtraitId = '';
    this.syncWithSelectedToken();
    this.updateTraitButtons();

    // Trigger instant roll if quick action was intended or highlight roll section
    const rollBtn = this.container.querySelector('#roll_check_btn');
    if (rollBtn) {
      rollBtn.scrollIntoView({ behavior: 'smooth' });
      rollBtn.classList.add('pulse-highlight');
      setTimeout(() => rollBtn.classList.remove('pulse-highlight'), 1000);
    }
  }

  prepareWeapon(tokenId, weaponId) {
    const actor = store.state.tokens.find(t => t.id === tokenId);
    if (!actor || !store.canEditToken(tokenId)) { notify('Selecciona uno de tus tokens asignados.'); return false; }
    const weapon = tokenInventory(actor).weapons.find(w => w.id === weaponId);
    if (!weapon) { notify('Este arma ya no está en la ficha.'); return false; }
    store.update({ selectedTokenId: tokenId }); this.syncWithSelectedToken();
    const preset = weaponPreset(actor, weapon);
    this.container.querySelector('#dmg_formula').value = preset.formula;
    this.syncDamageMode();
    this.container.querySelector('#dmg_proficiency').value = preset.proficiency;
    this.container.querySelector('#dmg_honed').value = preset.honed;
    this.container.querySelector('#dmg_is_critical').checked = false;
    this.container.querySelector('#dmg_is_direct').checked = false;
    this.container.querySelector('#damage_result_display').style.display = 'none';
    const note = weapon.damageMode === 'final' ? 'Daño final: Proficiency y Honed Edge no se vuelven a sumar.' : 'Daño base: se añade Proficiency al primer grupo de dados y Honed Edge una vez.';
    let warning = ''; try { parseDamageExpression(preset.formula); } catch (error) { warning = ' ' + error.message; }
    this.container.querySelector('[data-weapon-preview]').textContent = [weapon.name, note, weapon.features, warning].filter(Boolean).join(' · ');
    this.preparedWeapon = { id: weaponId, signature: JSON.stringify(weapon) };
    this.container.querySelector('#dmg_impact_type').value = weaponImpactType(weapon);
    window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'dice' } }));
    this.container.querySelector('#tab_damage_btn').click();
    this.container.querySelector('#dmg_formula').focus();
    return true;
  }

  render() {
    this.container.innerHTML = sanitizeHTML(`
      <div class="dice-sidebar-content"><div class="tray-launcher"><div><span>ORBITAL DICE ARRAY</span><strong>3D Hope &amp; Fear</strong></div><button class="hud-btn" id="open_dice_tray">Open tray</button></div>
        <label class="keeper-roll-switch" hidden><input type="checkbox" id="secret_roll"> Tirada secreta · solo Keeper</label>
        <p class="dossier-muted" data-secret-help hidden>El resultado y el registro son privados. Los cambios de recursos en fichas visibles se siguen compartiendo.</p>
        <!-- Tab Navigation -->
        <div class="sidebar-subtabs">
          <button class="subtab-btn active" id="tab_check_btn">HOPE & FEAR CHECK</button>
          <button class="subtab-btn" id="tab_damage_btn">DAMAGE & THRESHOLDS</button>
        </div>

        <!-- Section 1: Hope & Fear Action Check -->
        <div class="dice-section" id="section_action_check">
          <div class="dice-actor-bar">
            <span class="actor-tag">OPERATIVE:</span>
            <span class="actor-name" id="dice_actor_name">Capt. Jonathan Harker (Awakened)</span>
          </div>

          <!-- Trait Selector -->
          <div class="dice-input-block">
            <label class="dice-label">CHOOSE TRAIT</label>
            <div class="trait-selector-grid" id="dice_trait_selector">
              ${TRAITS.map(t => `
                <button class="trait-select-pill ${t.id === this.selectedTraitId ? 'active' : ''}" data-id="${t.id}" data-name="${t.name}">
                  <span class="pill-name">${t.short}</span>
                  <span class="pill-mod" id="trait_mod_${t.id}">+0</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Subtrait Selector -->
          <div class="dice-input-block">
            <label class="dice-label">SUBTRAIT / SPECIALTY</label>
            <vf-select id="dice_subtrait_select" class="hud-select">
              <option value="">None / General Trait</option>
              ${SUBTRAITS.map(st => `
                <option value="${st.id}">${st.name} (Parent: ${st.parent.toUpperCase()})</option>
              `).join('')}
            </vf-select>
          </div>

          <!-- DC Ladder -->
          <div class="dice-input-block">
            <label class="dice-label">TARGET DIFFICULTY (DC LADDER)</label>
            <vf-select id="dice_dc_select" class="hud-select">
              ${DC_LADDER.map(l => `
                <option value="${l.dc}" ${l.dc === 15 ? 'selected' : ''}>
                  DC ${l.dc} - ${l.name}
                </option>
              `).join('')}
            </vf-select>
          </div>

          <!-- Roll Modifiers -->
          <div class="dice-modifiers-grid">
            <label class="hud-checkbox-label">
              <input type="checkbox" id="dice_advantage" />
              <span>Advantage (+1d6)</span>
            </label>
            <label class="hud-checkbox-label">
              <input type="checkbox" id="dice_disadvantage" />
              <span>Disadvantage (-1d6)</span>
            </label>
            <label class="hud-checkbox-label">
              <input type="checkbox" id="dice_use_resolve" />
              <span>Spend Resolve (+1d4)</span>
            </label>
          </div>

          <div class="form-row critical-choice-row"><div class="form-group"><label>Sleeping critical · extra point</label><vf-select id="critical_resource" class="hud-select"><option value="effort">Effort (Resolve if full)</option><option value="resolve">Resolve</option></vf-select></div><label class="hud-checkbox-label"><input type="checkbox" id="meaningful_roll" checked /> Meaningful roll</label></div>
          <!-- Flat Modifier & Experience -->
          <div class="form-group"><label>Experiencia de la ficha</label><vf-select id="dice_experience_select" class="hud-select"><option value="">Sin experiencia</option></vf-select></div>
          <div class="form-row" style="margin-top: 10px;">
            <div class="form-group">
              <label>Experience Mod</label>
              <input type="number" id="dice_exp_mod" class="hud-input" value="0" min="0" max="10" />
            </div>
            <div class="form-group">
              <label>Custom Modifier</label>
              <input type="number" id="dice_custom_mod" class="hud-input" value="0" />
            </div>
          </div>

          <!-- Big Roll Button -->
          <button class="hud-btn hud-btn-primary hud-btn-lg roll-trigger-btn" id="roll_check_btn">
            <span class="btn-glow-text">ROLL 2d12 (HOPE & FEAR)</span>
          </button>

          <!-- Interactive Dice Result Display -->
          <div class="dice-result-panel glass-panel" id="dice_result_display" style="display: none;">
            <!-- Dice Visuals -->
            <div class="dice-visuals-row">
              <div class="d12-cube d12-hope" id="cube_hope">
                <span class="cube-tag">HOPE</span>
                <span class="cube-num" id="cube_hope_num">?</span>
              </div>
              <div class="dice-plus-sign">+</div>
              <div class="d12-cube d12-fear" id="cube_fear">
                <span class="cube-tag">FEAR</span>
                <span class="cube-num" id="cube_fear_num">?</span>
              </div>
              <div class="dice-mod-box" id="dice_extra_dice"></div>
            </div>

            <!-- Total vs DC -->
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

            <!-- Sacred Canon Outcome Banner -->
            <div class="outcome-banner" id="outcome_banner">
              <div class="outcome-title" id="outcome_title">CRITICAL SUCCESS</div>
              <div class="outcome-desc" id="outcome_desc">Details...</div>
              <div class="outcome-payout" id="outcome_payout">Payout...</div>
            </div>
          </div>
        </div>

        <!-- Section 2: Damage & Thresholds Calculator -->
        <div class="dice-section" id="section_damage_calc" style="display: none;">
          <p class="weapon-prepared-note" data-weapon-preview>Prepara un arma desde Ficha → Armas y equipo, o introduce una expresión.</p>
          <label class="dossier-field"><span>Impacto del arma</span><vf-select class="hud-select" id="dmg_impact_type">${Object.entries(IMPACT_TYPES).map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</vf-select></label>
          <p class="dossier-muted">Tamaño por HP realmente perdidos: 1 → 50%, 2 → 100%, +20% por HP adicional (máx. 200%). Armor consumido muestra el escudo.</p>
          <label class="dossier-field"><span>Expresión completa</span><input id="dmg_formula" class="hud-input" maxlength="1000" placeholder="Ej.: 1d8+1 Phys + 1d4 Shock"></label>
          <p class="field-help">Vacía este campo para usar los dados manuales de abajo. Las propiedades y condiciones se resuelven según su texto.</p>
          <div class="dice-actor-bar">
            <span class="actor-tag">TARGET:</span>
            <vf-select id="dmg_target_select" class="hud-select" style="max-width: 200px;">
              <!-- Target tokens populated -->
            </vf-select>
          </div>

          <div class="form-row"><div class="form-group"><label>Proficiency</label><input type="number" id="dmg_proficiency" value="1" min="1" max="6" class="hud-input" /></div><div class="form-group"><label>Honed Edge (Sleeping)</label><input type="number" id="dmg_honed" value="0" min="0" max="20" class="hud-input" /></div></div><p class="field-help">Enter the printed dice. Proficiency expands one die; Honed Edge is added once. For naval targets use Starship.</p>
          <div class="form-group">
            <label>Weapon Damage Dice Expression</label>
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
              <label>Target Major Threshold</label>
              <input type="number" id="dmg_major_thresh" class="hud-input" value="6" />
            </div>
            <div class="form-group">
              <label>Target Severe Threshold</label>
              <input type="number" id="dmg_severe_thresh" class="hud-input" value="12" />
            </div>
          </div>

          <div class="dice-modifiers-grid">
            <label class="hud-checkbox-label">
              <input type="checkbox" id="dmg_use_armor" checked />
              <span>Spend 1 Armor Slot to Mitigate</span>
            </label>
            <label class="hud-checkbox-label">
              <input type="checkbox" id="dmg_is_critical" />
              <span>Critical Hit</span>
            </label>
            <label class="hud-checkbox-label">
              <input type="checkbox" id="dmg_is_direct" />
              <span>Direct HP Damage (Bypass Thresholds)</span>
            </label>
          </div>

          <div class="form-group" style="margin-top: 10px;">
            <label>Damage scale · personal targets</label>
            <vf-select id="dmg_mount_rating" class="hud-select">
              <option value="1" selected>Personal scale · x1</option>


            </vf-select>
          </div>

          <button class="hud-btn hud-btn-danger hud-btn-lg roll-trigger-btn" id="roll_damage_btn" style="margin-top: 16px;">
            <span>RESOLVE DAMAGE & THRESHOLDS</span>
          </button>

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
            <button class="hud-btn hud-btn-sm hud-btn-danger" id="apply_dmg_to_target_btn" style="width: 100%; margin-top: 8px;">
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
    this.container.querySelector("#open_dice_tray").onclick = async () => { const { openDiceTray } = await import("./diceTray3d.js"); openDiceTray(); };
    // Subtabs toggle
    const checkTab = this.container.querySelector('#tab_check_btn');
    const damageTab = this.container.querySelector('#tab_damage_btn');
    const checkSec = this.container.querySelector('#section_action_check');
    const damageSec = this.container.querySelector('#section_damage_calc');

    checkTab.onclick = () => {
      checkTab.classList.add('active');
      damageTab.classList.remove('active');
      checkSec.style.display = 'block';
      damageSec.style.display = 'none';
    };

    damageTab.onclick = () => {
      damageTab.classList.add('active');
      checkTab.classList.remove('active');
      checkSec.style.display = 'none';
      damageSec.style.display = 'block';
      this.populateDamageTargets();
    };

    // Trait selector buttons
    this.container.querySelectorAll('.trait-select-pill').forEach(btn => {
      btn.onclick = () => {
        this.container.querySelectorAll('.trait-select-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTraitId = btn.dataset.id;
      };
    });

    // Roll Action Check Button
    this.container.querySelector('#secret_roll').onchange = () => this.syncWithSelectedToken();
    this.container.querySelector('#roll_check_btn').onclick = () => this.executeActionCheck();

    // Roll Damage Button
    this.container.querySelector('#roll_damage_btn').onclick = () => this.executeDamageCalc();
    for (const event of ['input', 'change']) damageSec.addEventListener(event, () => { this.syncDamageMode(); this.container.querySelector('#damage_result_display').style.display = 'none'; });
  }

  syncDamageMode() {
    this.container.querySelector('#dmg_dice_count').closest('.form-group').style.display = this.container.querySelector('#dmg_formula').value.trim() ? 'none' : '';
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
    const tokens = store.getTokensForActiveMap();
    const previous = select.value;
    select.innerHTML = sanitizeHTML('<option value="">Sin objetivo · calcular</option>' + tokens.map(t => `
      <option value="${escapeHTML(t.id)}">${escapeHTML(t.name)} (HP ${t.hp.current}/${t.hp.max})</option>
    `).join(''));
    select.value = tokens.some(t => t.id === previous) ? previous : '';

    select.onchange = () => {
      const tok = tokens.find(t => t.id === select.value);
      if (tok) {
        this.container.querySelector('#dmg_major_thresh').value = tok.hp.majorThreshold;
        this.container.querySelector('#dmg_severe_thresh').value = tok.hp.severeThreshold;
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

  async executeActionCheck() {
    const actor = this.currentActor || store.getSelectedToken() || {
      name: 'Voidwalker',
      path: 'Awakened',
      traits: { [this.selectedTraitId]: 1 },
      subtraits: {}
    };

    const traitMod = actor.traits?.[this.selectedTraitId] ?? 0;
    const subtraitId = this.container.querySelector('#dice_subtrait_select').value;
    const subtraitMod = subtraitId ? (actor.subtraits?.[subtraitId] ?? 0) : 0;
    const dc = parseInt(this.container.querySelector('#dice_dc_select').value, 10);
    const hasAdvantage = this.container.querySelector('#dice_advantage').checked;
    const hasDisadvantage = this.container.querySelector('#dice_disadvantage').checked;
    const useResolve = this.container.querySelector('#dice_use_resolve').checked;
    const expMod = parseInt(this.container.querySelector('#dice_exp_mod').value, 10) || 0;
    const customMod = parseInt(this.container.querySelector('#dice_custom_mod').value, 10) || 0;

    const traitObj = TRAITS.find(t => t.id === this.selectedTraitId);
    const traitName = traitObj ? traitObj.name : 'Finesse';

    // Animate Dice
    audio.playDiceRoll();

    let result;
    try {
      result = await network.requestAction({type:'CHECK',actorId:actor.id,visibility:this.rollVisibility(),options:{traitId:this.selectedTraitId,subtraitId,dc,hasAdvantage,hasDisadvantage,useResolve,experienceMod:expMod,customMod,criticalChoice:this.container.querySelector('#critical_resource').value,meaningful:this.container.querySelector('#meaningful_roll').checked}});
    } catch(e) { notify(e.message,'error'); return; }
    if (store.state.dice3d !== false) import("./diceTray3d.js").then(({ openDiceTray }) => { if (result.visibility !== 'keeper' || (store.sessionRole !== 'player' && store.state.userRole === 'keeper')) openDiceTray(result); }).catch(() => notify("3D dice unavailable; your roll is shown below."));
    this.lastResult=result;
    this.showResult(result);
  }

  showResult(result) {
    if (result.visibility === 'keeper' && (store.sessionRole === 'player' || store.state.userRole !== 'keeper')) return;
    this.lastResult = result;
    // Display Results
    const display = this.container.querySelector('#dice_result_display');
    display.style.display = 'block';

    const cubeHope = this.container.querySelector('#cube_hope_num');
    const cubeFear = this.container.querySelector('#cube_fear_num');
    const readoutTotal = this.container.querySelector('#readout_total');
    const readoutDc = this.container.querySelector('#readout_dc');
    const outcomeBanner = this.container.querySelector('#outcome_banner');
    const outcomeTitle = this.container.querySelector('#outcome_title');
    const outcomeDesc = this.container.querySelector('#outcome_desc');
    const outcomePayout = this.container.querySelector('#outcome_payout');
    const extraDiceEl = this.container.querySelector('#dice_extra_dice');

    cubeHope.textContent = result.hopeVal;
    cubeFear.textContent = result.fearVal;
    readoutTotal.textContent = result.total;
    readoutDc.textContent = result.dc;

    outcomeBanner.className = 'outcome-banner ' + result.resultType.toLowerCase();
    outcomeTitle.textContent = (result.visibility === 'keeper' ? 'SOLO KEEPER · ' : '') + result.outcomeTitle;
    outcomeDesc.textContent = result.outcomeDesc;
    outcomePayout.textContent = result.pathPayout;

    // Extra Dice representation
    let extraStr = '';
    if (result.advVal) extraStr += `<span class="extra-die adv">+${result.advVal} (Adv)</span> `;
    if (result.disadvVal) extraStr += `<span class="extra-die disadv">-${result.disadvVal} (Disadv)</span> `;
    if (result.resolveVal) extraStr += `<span class="extra-die resolve">+${result.resolveVal} (Res)</span> `;
    if (result.totalMod) extraStr += `<span class="extra-die mod">${result.totalMod >= 0 ? '+' : ''}${result.totalMod} Mod</span>`;
    extraDiceEl.innerHTML = sanitizeHTML(extraStr);

    // Sound FX on Critical
    if (result.isCritical) {
      audio.playCritical();
    }

  }

  executeDamageCalc() {
    const bossPhase = this.currentActor?.boss?.states[this.currentActor.boss.index];
    if (bossPhase?.canAttack === false) { notify('Este estado usa su procedimiento especial; no tiene un ataque de daño estándar.', 'error'); return; }
    const targetSelect = this.container.querySelector('#dmg_target_select');
    const targetId = targetSelect.value;
    const targetToken = store.getState().tokens.find(t => t.id === targetId);

    const diceCount = parseInt(this.container.querySelector('#dmg_dice_count').value, 10);
    const diceSides = parseInt(this.container.querySelector('#dmg_dice_sides').value, 10);
    const flatMod = parseInt(this.container.querySelector('#dmg_flat_mod').value, 10);
    const major = parseInt(this.container.querySelector('#dmg_major_thresh').value, 10);
    const severe = parseInt(this.container.querySelector('#dmg_severe_thresh').value, 10);
    const useArmor = this.container.querySelector('#dmg_use_armor').checked;
    const isCritical = this.container.querySelector('#dmg_is_critical').checked;
    const isDirect = this.container.querySelector('#dmg_is_direct').checked;
    const mr = 1;
    const proficiency=parseInt(this.container.querySelector('#dmg_proficiency').value,10),honed=parseInt(this.container.querySelector('#dmg_honed').value,10);
    if(!Number.isInteger(proficiency)||proficiency<1||proficiency>10||!Number.isInteger(honed)||honed<0||honed>9){notify('Check Proficiency (1–10) and Honed Edge (0–9).','error');return;}

    const formula = this.container.querySelector('#dmg_formula').value.trim();
    if (![major,severe,mr].every(Number.isFinite) || major<1 || severe<major || (!formula && (![diceCount,diceSides,flatMod].every(Number.isFinite) || diceCount<1 || diceCount>100))) { notify('Check the damage dice and thresholds.','error'); return; }
    const damageOptions = {
      attackerName: this.currentActor?.name || 'Attacker',
      targetName: targetToken?.name || 'Target',
      diceCount: diceCount + Math.max(0, (parseInt(this.container.querySelector('#dmg_proficiency').value,10)||1)-1),
      diceSides,
      flatModifier: flatMod + (parseInt(this.container.querySelector('#dmg_honed').value,10)||0),
      isCritical: isCritical && this.currentActor?.isPlayer !== false,
      isKeeperCritical: isCritical && this.currentActor?.isPlayer === false,
      isDirectDamage: isDirect,
      targetMajorThreshold: major,
      targetSevereThreshold: severe,
      useArmorSlot: useArmor,
      currentArmorSlots: targetToken?.armor?.current ?? 2,
      mountRating: mr,
      proficiency, honed,
    };
    let dmgResult;
    try { dmgResult = formula ? resolveDamageExpression(formula, damageOptions) : resolveDamage(damageOptions); }
    catch (error) { notify(error.message, 'error'); return; }

    const display = this.container.querySelector('#damage_result_display');
    display.style.display = 'block';

    this.container.querySelector('#dmg_raw_val').textContent = dmgResult.rawDamage;
    this.container.querySelector('#dmg_severity_val').textContent = dmgResult.finalSeverity;
    this.container.querySelector('#dmg_hp_loss_val').textContent = `${dmgResult.finalHpDamage} HP`;

    const detailText = (formula ? formula + ' · ' : '') + `Dice: [${dmgResult.rolls.join(', ')}] + ${dmgResult.flatModifier} ${dmgResult.mountRating > 1 ? `x MR ${dmgResult.mountRating}` : ''} = ${dmgResult.rawDamage} Raw Damage. ` +
      `Compared to Major (${major}) & Severe (${severe}). ` +
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

    // Apply button
    const applyBtn = this.container.querySelector('#apply_dmg_to_target_btn');
    let applied=false;
    applyBtn.disabled=!targetToken || store.sessionRole==='player' || store.state.userRole!=='keeper';applyBtn.textContent=targetToken ? 'APPLY DAMAGE TO TARGET' : 'ELIGE UN OBJETIVO Y VUELVE A CALCULAR';
    applyBtn.onclick = () => {
      if(applied)return;
      if(store.sessionRole==='player'||store.state.userRole!=='keeper'){notify('The Keeper applies incoming damage.','error');return;}
      const currentTarget=store.state.tokens.find(t=>t.id===targetId);
      if (currentTarget) {
        if (currentTarget.mapId !== damageMapId || currentTarget.mapId !== store.state.activeMapId) { notify('La escena o el objetivo ha cambiado. Calcula de nuevo el daño.', 'error'); return; }
        applied=true;applyBtn.disabled=true;applyBtn.textContent='DAMAGE APPLIED';
        const targetToken=currentTarget;
        // Preserve the original dice; use current armor and thresholds when the hit lands.
        const currentDamage=resolveDamage({diceCount:0,flatModifier:dmgResult.rawDamage,targetMajorThreshold:targetToken.hp.majorThreshold??major,targetSevereThreshold:targetToken.hp.severeThreshold??severe,isDirectDamage:isDirect,useArmorSlot:useArmor,currentArmorSlots:targetToken.armor?.current||0});
        if(targetToken.pendingBrace&&!isDirect){currentDamage.finalHpDamage=Math.max(0,currentDamage.finalHpDamage-1);currentDamage.finalSeverity+=' · Brace';}
        const newHp = Math.max(0, targetToken.hp.current - currentDamage.finalHpDamage);
        const newArmor = currentDamage.armorSlotSpent ? Math.max(0, (targetToken.armor?.current||0) - 1) : (targetToken.armor?.current||0);

        store.updateToken(targetToken.id, {
          hp: { ...targetToken.hp, current: newHp },
          pendingBrace:isDirect?targetToken.pendingBrace:false,
          armor: { ...targetToken.armor, current: newArmor }
        });

        network.broadcast({
          type: 'TOKEN_UPDATE',
          tokenId: targetToken.id,
          partial: {
            hp: { ...targetToken.hp, current: newHp },
            armor: { ...targetToken.armor, current: newArmor }
          }
        });

        const attacker = store.state.tokens.find(t => t.id === attackerId && t.mapId === damageMapId);
        const params = attackPresentation({ attacker: attacker || targetToken, target: targetToken,
          mapId: damageMapId, kind: impactKind, hpLost: targetToken.hp.current - newHp,
          armorSlotSpent: currentDamage.armorSlotSpent, isDirect, isCritical,
          gridSize: store.getActiveMap().gridSize || 64 });
        if (params) {
          params.targetId = targetToken.id; params.attackerId = attacker?.id;
          // An unseen attacker must not disclose its location through a projectile trail.
          if (attacker?.hidden) params.attacker = { ...params.target };
          window.veilCanvas?.triggerAttackFX(params);
          if (!secret && !targetToken.hidden) network.broadcast({ type: 'ATTACK_FX', params });
        }

        store.addLog({
          sender: 'Combat',
          ...(secret ? { visibility: 'keeper' } : {}),
          type: 'DAMAGE',
          title: `DAMAGE APPLIED: ${targetToken.name}`,
          details: `Lost ${targetToken.hp.current - newHp} HP (${currentDamage.finalHpDamage} before remaining-HP cap) (${currentDamage.finalSeverity}). Current HP: ${newHp}/${targetToken.hp.max}.`
        });
      }
    };
  }
}
