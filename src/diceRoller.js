import { attackPresentation, weaponImpactType } from './combatFX.js';
import { IMPACT_TYPES } from './encounterRules.js';
import { dossierDialog } from './dossierUI.js';
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
      const btnGlow = rollBtn.querySelector('.btn-glow-text') || rollBtn;
      btnGlow.textContent = secret ? 'TIRADA SECRETA · 2d12' : 'ROLL 2d12 (HOPE & FEAR)';
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
          <!-- Quick Polyhedral Dice Bar -->
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

        <!-- Section 3: Damage & Thresholds Calculator -->
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
            <span>RESOLVE DAMAGE &amp; THRESHOLDS</span>
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
            <div id="dmg_shield_mitigation_row" style="display: none; margin-top: 8px;">
              <button type="button" class="hud-btn hud-btn-secondary hud-btn-sm" id="dmg_mitigate_btn" style="width: 100%;">
                🛡️ Gastar escudos (Elegir cantidad)
              </button>
            </div>
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
      };
    }
    if (btnModPlus && customModInput) {
      btnModPlus.onclick = () => {
        const val = (parseInt(customModInput.value, 10) || 0) + 1;
        customModInput.value = Math.max(-20, Math.min(20, val));
      };
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
    const tokens = store.getTokensForActiveMap();
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
        if (maj) maj.value = tok.hp.majorThreshold;
        if (sev) sev.value = tok.hp.severeThreshold;
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

    if (this.is3D && typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.showResults === 'function') {
      window.VFDice3D.showResults({
        label: `Standard Roll: ${label}`,
        value: total,
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

    if (broadcast) {
      const actor = this.currentActor || store.getSelectedToken() || { name: 'Operativo' };
      const chatText = `🎲 ${actor.name || 'Operativo'}: ${label} ➔ ${total} (${rolls.join(' + ')}${mod !== 0 ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : ''})`;
      network.sendChat({ text: chatText, recipientId: 'table' }).catch(() => {
        store.addChatMessage({ senderName: actor.name || 'Operativo', text: chatText, channel: 'table' });
      });
      network.broadcast({
        type: 'DICE_ROLL',
        result: {
          id: String(Date.now()),
          actorName: actor.name,
          total,
          label: `Standard Roll: ${label}`,
          rolls: rolls.map(v => ({ value: v, sides, role: 'Standard' })),
          outcome: `${total}`
        }
      });
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

    audio.playDiceRoll();

    // Prepare 3D dice groups
    const groups = [
      { qty: 1, sides: 12, theme: 'vfHope', role: 'Hope' },
      { qty: 1, sides: 12, theme: 'vfFear', role: 'Fear' }
    ];
    if (hasAdvantage) groups.push({ qty: 1, sides: 6, theme: 'vfNeutral', role: 'Advantage' });
    else if (hasDisadvantage) groups.push({ qty: 1, sides: 6, theme: 'vfNeutral', role: 'Disadvantage' });
    if (useResolve) groups.push({ qty: 1, sides: 4, theme: 'vfNeutral', role: 'Resolve' });

    const themedGroups = this.applyDiceTextureSet(groups);
    const label = `${actor.name || 'Operative'} · ${traitName} Check`;

    let forcedHope = null;
    let forcedFear = null;
    let forcedAdv = null;

    if (this.is3D && store.state.dice3d !== false && typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.roll === 'function') {
      try {
        const roll3d = await window.VFDice3D.roll(themedGroups, { label, style: 'overlay', deferResults: true });
        if (roll3d && Array.isArray(roll3d.values) && roll3d.values.length >= 2) {
          forcedHope = roll3d.values[0];
          forcedFear = roll3d.values[1];
          if ((hasAdvantage || hasDisadvantage) && roll3d.values.length >= 3) {
            forcedAdv = roll3d.values[2];
          }
        }
      } catch (err) {
        console.warn('[DiceRoller] 3D roll fallback to random:', err);
      }
    }

    let result;
    try {
      result = await network.requestAction({
        type: 'CHECK',
        actorId: actor.id,
        visibility: this.rollVisibility(),
        options: {
          traitId: this.selectedTraitId,
          subtraitId,
          dc,
          hasAdvantage,
          hasDisadvantage,
          useResolve,
          experienceMod: expMod,
          customMod,
          criticalChoice: this.container.querySelector('#critical_resource').value,
          meaningful: this.container.querySelector('#meaningful_roll').checked,
          forcedHope,
          forcedFear,
          forcedAdv
        }
      });
    } catch(e) {
      notify(e.message, 'error');
      return;
    }

    // Overlay 3D results banner
    if (this.is3D && typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.showResults === 'function') {
      if (result.visibility !== 'keeper' || (store.sessionRole !== 'player' && store.state.userRole === 'keeper')) {
        const rolls = [
          { value: result.hopeVal, sides: 12, role: 'Hope' },
          { value: result.fearVal, sides: 12, role: 'Fear' }
        ];
        if (result.extraVal) {
          rolls.push({ value: result.extraVal, sides: 6, role: hasAdvantage ? 'Advantage' : 'Disadvantage' });
        }
        if (result.resolveDie) {
          rolls.push({ value: result.resolveDie, sides: 4, role: 'Resolve' });
        }
        window.VFDice3D.showResults({
          label,
          outcome: result.outcomeTitle,
          hope: result.hopeVal,
          fear: result.fearVal,
          crit: result.isCritical,
          value: result.total,
          rolls,
          style: 'overlay'
        });
      }
    }

    // Broadcast to table chat so every player sees the roll in chat:
    if (this.rollVisibility() !== 'keeper') {
      const summary = `🎲 ${actor.name} · ${traitName} Check ➔ ${result.total} (Hope ${result.hopeVal} + Fear ${result.fearVal}${result.totalMod ? (result.totalMod >= 0 ? ` + ${result.totalMod}` : ` - ${Math.abs(result.totalMod)}`) : ''}) vs DC ${result.dc} [${result.outcomeTitle}]`;
      network.sendChat({ text: summary, recipientId: 'table' }).catch(() => {
        store.addChatMessage({ senderName: actor.name, text: summary, channel: 'table' });
      });
    }

    this.lastResult = result;
    this.showResult(result);
  }

  showResult(result) {
    if (result.visibility === 'keeper' && (store.sessionRole === 'player' || store.state.userRole !== 'keeper')) return;
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
    if (cubeFear) cubeFear.textContent = result.fearVal;

    if (result.isCritical) {
      cubeHopeBox?.classList.add('crit-pulse');
      cubeFearBox?.classList.add('crit-pulse');
    } else {
      cubeHopeBox?.classList.remove('crit-pulse');
      cubeFearBox?.classList.remove('crit-pulse');
    }

    if (result.extraVal && cardExtra && cubeExtra) {
      cardExtra.style.display = 'flex';
      cubeExtra.textContent = result.extraVal;
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

    let spentShieldsChoice = null;
    const targetArmorAvailable = targetToken?.armor?.current || 0;
    const shieldRow = this.container.querySelector('#dmg_shield_mitigation_row');
    const mitigateBtn = this.container.querySelector('#dmg_mitigate_btn');
    if (shieldRow && mitigateBtn) {
      if (!isDirect && targetArmorAvailable > 0) {
        shieldRow.style.display = 'block';
        mitigateBtn.textContent = `🛡️ Gastar escudos (${targetArmorAvailable} disponible${targetArmorAvailable > 1 ? 's' : ''})`;
        mitigateBtn.onclick = () => {
          const freshTarget = store.state.tokens.find(t => t.id === targetId) || targetToken;
          promptShieldMitigation(freshTarget, dmgResult.rawDamage, (spent) => {
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
    let applied = false;
    applyBtn.disabled = !targetToken;
    applyBtn.textContent = targetToken ? 'APPLY DAMAGE TO TARGET' : 'ELIGE UN OBJETIVO Y VUELVE A CALCULAR';
    applyBtn.onclick = () => {
      if (applied) return;
      const currentTarget = store.state.tokens.find(t => t.id === targetId);
      if (!currentTarget) return;
      if (currentTarget.mapId !== damageMapId || currentTarget.mapId !== store.state.activeMapId) {
        notify('La escena o el objetivo ha cambiado. Calcula de nuevo el daño.', 'error');
        return;
      }

      const applyFinalDamage = (spentShields = 0) => {
        applied = true;
        applyBtn.disabled = true;
        applyBtn.textContent = 'DAMAGE APPLIED';
        const targetToken = store.state.tokens.find(t => t.id === targetId) || currentTarget;

        const currentDamage = resolveDamage({
          diceCount: 0,
          flatModifier: dmgResult.rawDamage,
          targetMajorThreshold: targetToken.hp.majorThreshold ?? major,
          targetSevereThreshold: targetToken.hp.severeThreshold ?? severe,
          isDirectDamage: isDirect,
          useArmorSlot: spentShields > 0,
          currentArmorSlots: targetToken.armor?.current || 0
        });

        // Each shield spent absorbs damage/reduces severity
        const mitigatedHpDamage = Math.max(0, (currentDamage.finalHpDamage || 0) - (spentShields > 0 ? (spentShields - 1) : 0));
        const finalHpDamage = targetToken.pendingBrace && !isDirect ? Math.max(0, mitigatedHpDamage - 1) : mitigatedHpDamage;

        const currentArmor = targetToken.armor?.current || 0;
        const newArmor = Math.max(0, currentArmor - spentShields);
        const newHp = Math.max(0, targetToken.hp.current - finalHpDamage);

        store.updateToken(targetToken.id, {
          hp: { ...targetToken.hp, current: newHp },
          pendingBrace: isDirect ? targetToken.pendingBrace : false,
          armor: { ...targetToken.armor, current: newArmor }
        });

        network.broadcast?.({
          type: 'TOKEN_UPDATE',
          tokenId: targetToken.id,
          partial: {
            hp: { ...targetToken.hp, current: newHp },
            armor: { ...targetToken.armor, current: newArmor }
          }
        });

        const attacker = store.state.tokens.find(t => t.id === attackerId && t.mapId === damageMapId);
        const params = attackPresentation({
          attacker: attacker || targetToken,
          target: targetToken,
          mapId: damageMapId,
          kind: impactKind,
          hpLost: targetToken.hp.current - newHp,
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
          if (!secret && !targetToken.hidden) network.broadcast?.({ type: 'ATTACK_FX', params });
        }

        store.addLog({
          sender: 'Combat',
          ...(secret ? { visibility: 'keeper' } : {}),
          type: 'DAMAGE',
          title: `DAMAGE APPLIED: ${targetToken.name}`,
          details: `Lost ${targetToken.hp.current - newHp} HP (${currentDamage.finalHpDamage} base). Escudos gastados: ${spentShields}. Current HP: ${newHp}/${targetToken.hp.max}.`
        });
      };

      const useArmor = this.container.querySelector('#dmg_use_armor')?.checked;
      const currentArmorNow = currentTarget.armor?.current || 0;
      let finalSpentShields = 0;
      if (!isDirect && currentArmorNow > 0) {
        if (spentShieldsChoice !== null && spentShieldsChoice !== undefined) {
          finalSpentShields = Math.min(currentArmorNow, Math.max(0, spentShieldsChoice));
        } else if (useArmor) {
          finalSpentShields = 1;
        }
      }
      applyFinalDamage(finalSpentShields);
    };
  }
}

export function promptShieldMitigation(targetToken, incomingRawDamage, onConfirm) {
  if (typeof document === 'undefined' || !document.body) {
    onConfirm(targetToken.armor?.current > 0 ? 1 : 0);
    return;
  }
  const currentShields = targetToken.armor?.current || 0;
  if (currentShields <= 0) {
    onConfirm(0);
    return;
  }

  const modal = dossierDialog('🛡️ MITIGACIÓN CON ESCUDOS · ' + targetToken.name, `
    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
      <img src="${escapeHTML(targetToken.avatarUrl || '/assets/tokens/captain_harker.jpg')}" style="width: 52px; height: 52px; border-radius: 50%; border: 2px solid #00f3ff; object-fit: cover;" alt="" />
      <div>
        <h3 style="margin: 0; color: #fff; font-size: 15px;">${escapeHTML(targetToken.name)}</h3>
        <p class="dossier-muted" style="margin: 2px 0 0;">¡Impacto entrante de ${incomingRawDamage} de daño!</p>
      </div>
    </div>
    <p style="font-size: 12px; color: #cbd5e1; line-height: 1.4; margin-bottom: 12px;">
      El portador cuenta con <strong>${currentShields} escudo${currentShields > 1 ? 's' : ''}</strong> disponible${currentShields > 1 ? 's' : ''}.
      Selecciona cuántos escudos deseas gastar para absorber el impacto. A continuación se ejecutará la animación de impacto y se restará el daño al HP restante.
    </p>

    <div style="background: rgba(15, 23, 42, 0.7); padding: 12px; border-radius: 6px; border: 1px solid rgba(0, 243, 255, 0.2); margin-bottom: 12px;">
      <label class="dossier-field" style="margin: 0;">
        <span>Escudos a gastar:</span>
        <div style="display: flex; gap: 10px; align-items: center; margin-top: 6px;">
          <input type="range" id="mitigate_shields_slider" min="0" max="${currentShields}" value="${Math.min(1, currentShields)}" style="flex: 1;" />
          <span id="mitigate_shields_val" style="font-size: 16px; font-weight: bold; color: #00f3ff; min-width: 28px; text-align: center;">${Math.min(1, currentShields)}</span>
        </div>
      </label>
    </div>

    <footer class="dossier-footer" style="display: flex; justify-content: space-between; gap: 8px;">
      <button class="hud-btn hud-btn-secondary" type="button" id="mitigate_zero_btn">Gastar 0 Escudos</button>
      <button class="hud-btn hud-btn-primary" type="button" id="mitigate_confirm_btn">🛡️ Gastar Escudos y Aplicar</button>
    </footer>
  `);

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
