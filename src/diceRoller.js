// src/diceRoller.js
// Authentic Veilfarers Dice Roller & Threshold Damage Calculator

import { rollVeilfarersCheck, resolveDamage, DC_LADDER, TRAITS, SUBTRAITS } from './rulesEngine.js';
import { store } from './state.js';
import { audio } from './audioEngine.js';
import { network } from './networkManager.js';

export class DiceRollerSidebar {
  constructor(containerElement) {
    this.container = containerElement;
    this.selectedTraitId = 'finesse';
    this.selectedSubtraitId = '';
    this.currentActor = null;
    this.render();
    window.veilDiceRoller = this;

    store.subscribe((state, keys) => {
      if (keys.includes('selectedTokenId') || keys.includes('tokens')) {
        this.syncWithSelectedToken();
      }
    });
  }

  syncWithSelectedToken() {
    const token = store.getSelectedToken();
    if (token) {
      this.currentActor = token;
      const actorLabel = this.container.querySelector('#dice_actor_name');
      if (actorLabel) {
        const isKeeper = store.getState().userRole === 'keeper';
        const isHorror = token.hideName || (!token.isPlayer && (token.actorType === 'adversary' || /horror|stalker|abomination|threat|alien|beast|monster/i.test(token.name || '')));
        const isMasked = !isKeeper && isHorror;
        const actorName = isMasked ? '?????' : (isKeeper && isHorror ? `${token.name} [?????]` : token.name);
        actorLabel.textContent = `${actorName} (${token.path || 'Unknown'})`;
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

  render() {
    this.container.innerHTML = `
      <div class="dice-sidebar-content">
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
            <select id="dice_subtrait_select" class="hud-select">
              <option value="">None / General Trait</option>
              ${SUBTRAITS.map(st => `
                <option value="${st.id}">${st.name} (Parent: ${st.parent.toUpperCase()})</option>
              `).join('')}
            </select>
          </div>

          <!-- DC Ladder -->
          <div class="dice-input-block">
            <label class="dice-label">TARGET DIFFICULTY (DC LADDER)</label>
            <select id="dice_dc_select" class="hud-select">
              ${DC_LADDER.map(l => `
                <option value="${l.dc}" ${l.dc === 15 ? 'selected' : ''}>
                  DC ${l.dc} - ${l.name}
                </option>
              `).join('')}
            </select>
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

          <!-- Flat Modifier & Experience -->
          <div class="form-row" style="margin-top: 10px;">
            <div class="form-group">
              <label>Experience Mod</label>
              <input type="number" id="dice_exp_mod" class="hud-input" value="0" min="0" max="3" />
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
          <div class="dice-actor-bar">
            <span class="actor-tag">TARGET:</span>
            <select id="dmg_target_select" class="hud-select" style="max-width: 200px;">
              <!-- Target tokens populated -->
            </select>
          </div>

          <div class="form-group">
            <label>Weapon Damage Dice Expression</label>
            <div class="form-row">
              <input type="number" id="dmg_dice_count" class="hud-input" value="2" min="1" max="10" title="Dice count" />
              <select id="dmg_dice_sides" class="hud-select">
                <option value="6">d6</option>
                <option value="8" selected>d8</option>
                <option value="10">d10</option>
                <option value="12">d12</option>
              </select>
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
              <span>Critical Hit (Double Dice)</span>
            </label>
            <label class="hud-checkbox-label">
              <input type="checkbox" id="dmg_is_direct" />
              <span>Direct HP Damage (Bypass Thresholds)</span>
            </label>
          </div>

          <div class="form-group" style="margin-top: 10px;">
            <label>Mount Rating (Ship MR)</label>
            <select id="dmg_mount_rating" class="hud-select">
              <option value="1" selected>MR x1 (Personal Scale / T1 Craft)</option>
              <option value="2">MR x2 (Tier 2-3 Vessels)</option>
              <option value="3">MR x3 (Tier 4-5 Capital Ships)</option>
            </select>
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
    `;

    this.initEvents();
    this.syncWithSelectedToken();
  }

  initEvents() {
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
    this.container.querySelector('#roll_check_btn').onclick = () => this.executeActionCheck();

    // Roll Damage Button
    this.container.querySelector('#roll_damage_btn').onclick = () => this.executeDamageCalc();
  }

  updateTraitButtons() {
    if (!this.currentActor) return;
    TRAITS.forEach(t => {
      const modEl = this.container.querySelector(`#trait_mod_${t.id}`);
      if (modEl) {
        const val = this.currentActor.traits?.[t.id] ?? 0;
        modEl.textContent = val >= 0 ? `+${val}` : `${val}`;
      }
    });
  }

  populateDamageTargets() {
    const select = this.container.querySelector('#dmg_target_select');
    if (!select) return;
    const tokens = store.getTokensForActiveMap();
    select.innerHTML = tokens.map(t => `
      <option value="${t.id}">${t.name} (HP ${t.hp.current}/${t.hp.max})</option>
    `).join('');

    select.onchange = () => {
      const tok = tokens.find(t => t.id === select.value);
      if (tok) {
        this.container.querySelector('#dmg_major_thresh').value = tok.hp.majorThreshold;
        this.container.querySelector('#dmg_severe_thresh').value = tok.hp.severeThreshold;
      }
    };

    if (tokens.length > 0) {
      select.onchange();
    }
  }

  executeActionCheck() {
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

    const result = rollVeilfarersCheck({
      actorName: actor.name,
      path: actor.path || 'Awakened',
      traitName,
      traitMod,
      subtraitName: subtraitId,
      subtraitMod,
      dc,
      hasAdvantage,
      hasDisadvantage,
      useResolve,
      resolveDieType: actor.resolve?.dieType || 'd4',
      experienceMod: expMod,
      customMod
    });

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
    outcomeTitle.textContent = result.outcomeTitle;
    outcomeDesc.textContent = result.outcomeDesc;
    outcomePayout.textContent = result.pathPayout;

    // Extra Dice representation
    let extraStr = '';
    if (result.advVal) extraStr += `<span class="extra-die adv">+${result.advVal} (Adv)</span> `;
    if (result.disadvVal) extraStr += `<span class="extra-die disadv">-${result.disadvVal} (Disadv)</span> `;
    if (result.resolveVal) extraStr += `<span class="extra-die resolve">+${result.resolveVal} (Res)</span> `;
    if (result.totalMod) extraStr += `<span class="extra-die mod">${result.totalMod >= 0 ? '+' : ''}${result.totalMod} Mod</span>`;
    extraDiceEl.innerHTML = extraStr;

    // Sound FX on Critical
    if (result.isCritical) {
      audio.playCritical();
    }

    // Auto Fear management according to Veilfarers Canon:
    // "Success with Fear and Failure with Fear add 1 Fear to Keeper's pool"
    if (result.fearGain > 0) {
      store.addFear(result.fearGain);
      network.broadcast({ type: 'FEAR_UPDATE', fear: store.getState().fear });
      audio.playFearAlert();
    }

    // Log to game history & broadcast
    const logEntry = {
      sender: actor.name,
      type: 'CHECK',
      title: `${actor.name}: ${result.outcomeTitle}`,
      details: `Rolled Hope d12 [${result.hopeVal}] + Fear d12 [${result.fearVal}] ${result.totalMod >= 0 ? '+' : ''}${result.totalMod} = ${result.total} vs DC ${result.dc}. ${result.outcomeDesc}`,
      resultType: result.resultType
    };

    store.addLog(logEntry);
    network.broadcast({ type: 'DICE_ROLL', logEntry });
  }

  executeDamageCalc() {
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
    const mr = parseInt(this.container.querySelector('#dmg_mount_rating').value, 10);

    const dmgResult = resolveDamage({
      attackerName: this.currentActor?.name || 'Attacker',
      targetName: targetToken?.name || 'Target',
      diceCount,
      diceSides,
      flatModifier: flatMod,
      isCritical,
      isDirectDamage: isDirect,
      targetMajorThreshold: major,
      targetSevereThreshold: severe,
      useArmorSlot: useArmor,
      currentArmorSlots: targetToken?.armor?.current ?? 2,
      mountRating: mr
    });

    const display = this.container.querySelector('#damage_result_display');
    display.style.display = 'block';

    this.container.querySelector('#dmg_raw_val').textContent = dmgResult.rawDamage;
    this.container.querySelector('#dmg_severity_val').textContent = dmgResult.finalSeverity;
    this.container.querySelector('#dmg_hp_loss_val').textContent = `${dmgResult.finalHpDamage} HP`;

    const detailText = `Dice: [${dmgResult.rolls.join(', ')}] + ${dmgResult.flatModifier} ${dmgResult.mountRating > 1 ? `x MR ${dmgResult.mountRating}` : ''} = ${dmgResult.rawDamage} Raw Damage. ` +
      `Compared to Major (${major}) & Severe (${severe}). ` +
      (dmgResult.armorSlotSpent ? '1 Armor Slot spent to lower severity step.' : 'No armor slot used.');
    this.container.querySelector('#dmg_detail_text').textContent = detailText;

    // Apply button
    const applyBtn = this.container.querySelector('#apply_dmg_to_target_btn');
    applyBtn.onclick = () => {
      if (targetToken) {
        const newHp = Math.max(0, targetToken.hp.current - dmgResult.finalHpDamage);
        const newArmor = dmgResult.armorSlotSpent ? Math.max(0, targetToken.armor.current - 1) : targetToken.armor.current;

        store.updateToken(targetToken.id, {
          hp: { ...targetToken.hp, current: newHp },
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

        // Trigger explosion FX on target position!
        if (window.veilCanvas) {
          window.veilCanvas.triggerFX('explosion', { x: targetToken.x, y: targetToken.y });
        }

        store.addLog({
          sender: 'Combat',
          type: 'DAMAGE',
          title: `DAMAGE APPLIED: ${targetToken.name}`,
          details: `Suffered ${dmgResult.finalHpDamage} HP damage (${dmgResult.finalSeverity}). Current HP: ${newHp}/${targetToken.hp.max}.`
        });
      }
    };
  }
}
