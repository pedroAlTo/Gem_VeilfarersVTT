import { conditionBadges, openConditions } from './conditionUI.js';
import { openDossier } from './dossierUI.js';
import { validateActor } from './validation.js';
import { statGaugeHTML } from './tokenVitals.js';
// src/tokenSheet.js
// Token HUD Quickbar and Holographic Character Sheet Editor

import { notify, confirmAction, sanitizeHTML, escapeHTML } from './ui.js';
import { store } from './state.js';
import { network } from './networkManager.js';
import { TRAITS, SUBTRAITS } from './rulesEngine.js';

export function isHorrorToken(token) {
  if (!token) return false;
  if (token.hideName) return true;
  if (token.isPlayer) return false;
  if (token.actorType === 'adversary') return true;
  const str = `${token.name || ''} ${token.roleTag || ''} ${token.species || ''}`.toLowerCase();
  return /horror|stalker|abomination|threat|alien|beast|monster|parasite|spawn|unknown/i.test(str);
}

// Available stats selectable for custom modular token overlays
export const AVAILABLE_STATS = [
  { id: 'hp', name: '❤️ Puntos de Vida (HP)' },
  { id: 'stress', name: '⚡ Estrés' },
  { id: 'armor', name: '🛡️ Armadura' },
  { id: 'hope', name: '✨ Esperanza' },
  { id: 'effort', name: '🔋 Esfuerzo' },
  { id: 'resolve', name: '🎲 Determinación' },
  { id: 'clock', name: '⏱️ Reloj Táctico' },
  { id: 'trait_agility', name: '👟 Agilidad' },
  { id: 'trait_strength', name: '💪 Fuerza' },
  { id: 'trait_finesse', name: '🎯 Finura' },
  { id: 'trait_knowledge', name: '🧠 Conocimiento' },
  { id: 'trait_instinct', name: '👁️ Instinto' },
  { id: 'trait_presence', name: '👑 Presencia' }
];

import { openColorPickerPopover } from './colorPicker.js';
export { openColorPickerPopover };

export class TokenHUD {
  constructor(quickbarContainer) {
    this.container = quickbarContainer;
    this.isExpanded = false; // Minimized by default as requested
    this.movesOpen = false;  // Sleeper moves collapsed in drawer by default
    this.render();
    store.subscribe((state, keys) => {
      if (keys.some(key => ['selectedTokenId', 'tokens', 'userRole', 'isConnected', 'claimedTokenId'].includes(key))) {
        this.render();
      }
    });
  }

  render() {
    const token = store.getSelectedToken();
    if (!token) {
      this.container.innerHTML = sanitizeHTML('');
      this.container.classList.add('hidden');
      return;
    }

    this.container.classList.remove('hidden');
    const state = store.getState();
    const isKeeper = state.userRole === 'keeper';
    const isHorror = isHorrorToken(token);
    const isMasked = !isKeeper && !store.canEditToken(token.id) && isHorror;
    const displayName = isMasked ? '?????' : (isKeeper && isHorror ? `${token.name} [?????]` : token.name);
    const displayRole = isMasked ? 'Amenaza Desconocida // ?????' : (token.roleTag || 'Voidfarer');
    const isPC = token.actorType === 'player' || (!token.actorType && token.isPlayer);
    const maxStress = token.stress?.max ?? 6;
    const isOverwhelmed = (token.stress?.current || 0) >= maxStress;

    // --- COMPACT MINIMIZED QUICKBAR (DEFAULT) ---
    if (!this.isExpanded) {
      this.container.innerHTML = sanitizeHTML(`
        <div class="token-quickbar glass-panel tok-qb-compact">
          <!-- Token Avatar & Name -->
          <div class="tok-qb-avatar-group">
            <img src="${escapeHTML(token.avatarUrl || '/assets/tokens/captain_harker.jpg')}" class="tok-qb-avatar" />
            <div class="tok-qb-meta">
              <span class="tok-qb-name" style="${isMasked ? 'color: #f43f5e; font-weight: bold;' : ''}">${escapeHTML(displayName)}</span>
              <span class="tok-qb-role">${escapeHTML(displayRole)}</span>
              <div class="condition-badges tok-condition-badges">${conditionBadges(token)}</div>
            </div>
          </div>

          <div class="tok-qb-divider"></div>

          <div class="token-telemetry-grid">
            ${statGaugeHTML('HP', token.hp?.current, token.hp?.max, 'hp')}
            ${statGaugeHTML('ARMOR', token.armor?.current, token.armor?.max, 'armor')}
            ${statGaugeHTML('STRESS', token.stress?.current, maxStress, 'stress')}
            ${isPC ? statGaugeHTML(token.path === 'Sleeping' ? 'EFFORT' : 'HOPE', token.path === 'Sleeping' ? token.effort : token.hope, 6, 'path') : `<div class="dossier-eyebrow">EVASION ${token.evasion ?? '—'}<br>ATTACK ${token.attackModifier ?? '—'}</div>`}
          </div>

          <!-- Compact Action Controls -->
          <div class="tok-qb-actions" style="display: flex; gap: 6px; align-items: center;">
            <button class="hud-btn hud-btn-xs" id="open_conditions_btn">ESTADOS</button>
            <button class="hud-btn hud-btn-xs" id="open_equipment_btn" ${store.canEditToken(token.id) ? '' : 'disabled'}>EQUIPO</button>
            <button class="hud-btn hud-btn-xs hud-btn-secondary" id="open_sheet_btn" title="Abrir Ficha Holográfica Completa">FICHA</button>
            <button class="hud-btn hud-btn-xs hud-btn-primary" id="toggle_expand_btn" title="Expandir Panel Completo">▲ EXPANDIR</button>
          </div>
        </div>
      `);
      this.attachEvents(token);
      return;
    }

    // --- FULL EXPANDED QUICKBAR ---
    this.container.innerHTML = sanitizeHTML(`
      <div class="token-quickbar glass-panel tok-qb-expanded">
        <!-- Token Header / Avatar -->
        <div class="tok-qb-avatar-group">
          <img src="${escapeHTML(token.avatarUrl || '/assets/tokens/captain_harker.jpg')}" class="tok-qb-avatar" />
          <div class="tok-qb-meta">
            <span class="tok-qb-name" style="${isMasked ? 'color: #f43f5e; font-weight: bold;' : ''}">${escapeHTML(displayName)}</span>
            <span class="tok-qb-role">${escapeHTML(displayRole)}</span>
          </div>
          <button class="hud-btn hud-btn-xs hud-btn-secondary" id="open_sheet_btn" title="Open Full Character Sheet">SHEET</button>
          <button class="hud-btn hud-btn-xs" id="open_conditions_btn">ESTADOS</button>
          <button class="hud-btn hud-btn-xs" id="open_equipment_btn" ${store.canEditToken(token.id) ? '' : 'disabled'}>EQUIPO</button>
        </div>

        <div class="tok-qb-divider"></div>

        <!-- HP & Thresholds -->
        <div class="tok-qb-stat-group">
          ${statGaugeHTML('HP', token.hp?.current, token.hp?.max, 'hp')}
          <div class="tok-qb-stat-actions">
            <button class="hud-btn hud-btn-xs" id="hp_minus_btn">-1</button>
            <button class="hud-btn hud-btn-xs hud-btn-primary" id="hp_plus_btn">+1</button>
            <span class="tok-qb-thresholds">M:${token.hp.majorThreshold} S:${token.hp.severeThreshold}</span>
          </div>
        </div>

        <div class="tok-qb-divider"></div>

        <!-- Armor & Stress -->
        <div class="tok-qb-stat-group">
          <div class="tok-qb-stat-label">
            <span>ARMOR</span>
            <span class="tok-qb-num">${token.armor?.current ?? 0} / ${token.armor?.max ?? 0}</span>
          </div>
          <div class="tok-qb-pips" id="armor_pips_row">
            ${Array.from({ length: token.armor?.max || 0 }, (_, i) => `
              <button type="button" class="pip pip-armor ${i < (token.armor?.current || 0) ? 'active' : ''}" data-idx="${i}" aria-label="Set pip-armor to ${i + 1}"></button>
            `).join('')}
          </div>

          <div class="tok-qb-stat-label" style="margin-top: 4px;">
            <span>STRESS</span>
            <span class="tok-qb-num ${isOverwhelmed ? 'text-danger' : ''}">${token.stress?.current ?? 0} / ${maxStress}</span>
          </div>
          <div class="tok-qb-pips" id="stress_pips_row">
            ${Array.from({ length: maxStress }, (_, i) => `
              <button type="button" class="pip pip-stress ${i < (token.stress?.current || 0) ? 'active' : ''}" data-idx="${i}" aria-label="Set pip-stress to ${i + 1}"></button>
            `).join('')}
          </div>
        </div>

        <div class="tok-qb-divider"></div>

        <!-- Hope (Awakened) or Effort/Resolve (Sleeping) -->
        <div class="tok-qb-stat-group">
          ${!isPC ? `<div class="tok-qb-stat-label">EVASION ${token.evasion ?? '—'} · ATTACK ${token.attackModifier ?? '—'}</div><div>${escapeHTML(token.damageExpression || '')}</div>` : token.path === 'Awakened' ? `
            <div class="tok-qb-stat-label">
              <span>HOPE</span>
              <span class="tok-qb-num text-cyan">${token.hope || 0} / 6</span>
            </div>
            <div class="tok-qb-pips" id="hope_pips_row">
              ${Array.from({ length: 6 }, (_, i) => `
                <button type="button" class="pip pip-hope ${i < (token.hope || 0) ? 'active' : ''}" data-idx="${i}" aria-label="Set pip-hope to ${i + 1}"></button>
              `).join('')}
            </div>
            <div class="tok-qb-path-actions" style="margin-top: 5px;">
              <button class="hud-btn hud-btn-xs hud-btn-cyan tok-hope-action-btn" data-action="advantage" title="Spend 1 Hope for Advantage">ADVANTAGE (1H)</button>
              <button class="hud-btn hud-btn-xs hud-btn-cyan tok-hope-action-btn" data-action="assist" title="Spend 1 Hope to Assist Ally (+2)">ASSIST (1H)</button>
            </div>
          ` : `
            <div class="tok-qb-stat-label">
              <span>EFFORT</span>
              <span class="tok-qb-num text-amber">${token.effort || 0} / 6</span>
            </div>
            <div class="tok-qb-pips" id="effort_pips_row">
              ${Array.from({ length: 6 }, (_, i) => `
                <button type="button" class="pip pip-effort ${i < (token.effort || 0) ? 'active' : ''}" data-idx="${i}" aria-label="Set pip-effort to ${i + 1}"></button>
              `).join('')}
            </div>

            <!-- 2-Segment Effort Track -->
            <div class="effort-track-row" style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 10px; color: var(--text-dim);">TRACK:</span>
              <div class="effort-track-pips">
                <span class="pip-track ${token.effortTrack?.[0] ? 'active' : ''}">●</span>
                <span class="pip-track ${token.effortTrack?.[1] ? 'active' : ''}">●</span>
              </div>
              <button class="hud-btn hud-btn-xs hud-btn-amber" id="mark_effort_segment_btn" title="When Hope > Fear: Mark 1 segment. 2 segments gain +1 Effort!">+TRACK</button>
            </div>

            <div class="tok-qb-stat-label" style="margin-top: 4px;">
              <span>RESOLVE (${token.resolve?.dieType || 'd4'})</span>
              <span class="tok-qb-num text-amber">${token.resolve?.current || 0} / ${token.resolve?.max || 0}</span>
            </div>
            <div class="tok-qb-path-actions" style="margin-top: 4px; display: flex; gap: 4px;">
              <button class="hud-btn hud-btn-xs hud-btn-amber" id="bear_down_btn" title="Universal Sleeping Move: Spend 1 Resolve die and add to roll total">BEAR DOWN (1${token.resolve?.dieType || 'd4'})</button>
              <button class="hud-btn hud-btn-xs ${token.effort === 0 ? 'hud-btn-danger' : 'hud-btn-secondary'}" id="burnout_btn" title="At 0 Effort: Pay 1 HP to invoke any Effort feature">BURNOUT</button>
            </div>
          `}
        </div>

        <div class="tok-qb-divider"></div>

        <!-- Sleeper Common Efforts Collapsible Drawer (If Sleeping) -->
        ${isPC && token.path === 'Sleeping' ? `
          <div class="tok-qb-moves-collapsible-container" style="position: relative;">
            <button class="hud-btn hud-btn-xs hud-btn-amber" id="toggle_moves_drawer" style="white-space: nowrap;">
              ⚡ ESFUERZOS (${this.movesOpen ? 'OCULTAR ▲' : 'DESPLEGAR 9 ▼'})
            </button>
            ${this.movesOpen ? `
              <div class="tok-qb-moves-drawer glass-panel" style="position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); width: 440px; padding: 10px; background: rgba(10, 15, 26, 0.95); border: 1px solid var(--amber-warn); border-radius: 6px; box-shadow: 0 -8px 24px rgba(0,0,0,0.8); z-index: 150;">
                <div style="font-size: 11px; font-weight: 700; color: var(--amber-warn); margin-bottom: 6px;">COMMON EFFORTS // SLEEPING MOVES</div>
                <div class="tok-qb-moves-row" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;">
                  <button class="effort-move-btn" data-cost="1" data-move="Steady Hands (+2)" title="Spend 1 Effort: Add +2 to any check before rolling">
                    <span class="em-cost">1E</span> Steady Hands
                  </button>
                  <button class="effort-move-btn" data-cost="1" data-move="Read the Room" title="Spend 1 Effort: Read emotional temperature, lies, or hidden motives">
                    <span class="em-cost">1E</span> Read Room
                  </button>
                  <button class="effort-move-btn" data-cost="1" data-move="Push Through" title="Spend 1 Effort: Ignore one minor penalty on your next action">
                    <span class="em-cost">1E</span> Push Through
                  </button>
                  <button class="effort-move-btn" data-cost="2" data-move="The Opening" title="Spend 2 Effort: Roll check with Advantage">
                    <span class="em-cost">2E</span> Opening (Adv)
                  </button>
                  <button class="effort-move-btn" data-cost="2" data-move="Try Again" title="Spend 2 Effort: Reroll 1 die of your choice">
                    <span class="em-cost">2E</span> Try Again
                  </button>
                  <button class="effort-move-btn" data-cost="2" data-move="Brace (Mitigate)" title="Spend 2 Effort: Reduce damage severity step by 1">
                    <span class="em-cost">2E</span> Brace (-1 Sev)
                  </button>
                  <button class="effort-move-btn" data-cost="2" data-move="Cover the Angle" title="Spend 2 Effort: Grant +2 to ally's roll in sight">
                    <span class="em-cost">2E</span> Cover Angle
                  </button>
                  <button class="effort-move-btn" data-cost="3" data-move="Second Wind" title="Spend 3 Effort: Immediately clear 2 Stress">
                    <span class="em-cost">3E</span> Second Wind
                  </button>
                  <button class="effort-move-btn" data-cost="3" data-move="Seize the Moment" title="Spend 3 Effort: Optional: after a success, add a favorable consequence validated by the Keeper">
                    <span class="em-cost">3E</span> Seize Moment
                  </button>
                </div>
                <div class="tok-qb-honed-edge" style="font-size: 10px; color: var(--amber-warn); margin-top: 6px;">
                  ✦ Honed Edge: +${token.honedEdgeBonus ?? Math.max(0,(token.level||1)-1)} Flat Damage Bonus
                </div>
              </div>
            ` : ''}
          </div>
          <div class="tok-qb-divider"></div>
        ` : ''}

        <!-- Quick Roll Traits -->
        <div class="tok-qb-traits-group">
          <span class="tok-qb-traits-header">TRAITS</span>
          <div class="tok-qb-traits-row">
            ${TRAITS.map(t => {
              const val = token.traits?.[t.id] ?? 0;
              const sign = val >= 0 ? `+${val}` : `${val}`;
              return `
                <button class="quick-trait-btn" data-trait-id="${t.id}" data-trait-name="${t.name}" data-mod="${val}" title="Roll ${t.name} Check">
                  <span class="qt-label">${t.short}</span>
                  <span class="qt-val">${sign}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="tok-qb-divider"></div>

        <!-- Minimize Button -->
        <button class="hud-btn hud-btn-xs hud-btn-secondary" id="toggle_expand_btn" title="Minimizar barra a modo compacto">▼ MINIMIZAR</button>
      </div>
    `);

    this.attachEvents(token);
  }

  attachEvents(token) {
    this.container.querySelector('#open_conditions_btn')?.addEventListener('click', () => openConditions(token.id));
    this.container.querySelector('#open_equipment_btn')?.addEventListener('click', () => { if (store.canEditToken(token.id)) openDossier(store.state.tokens.find(t => t.id === token.id), actor => this.openTokenSettingsModal(actor), 'equipment'); });
    if (!store.canEditToken(token.id)) this.container.querySelectorAll('button').forEach(button => {
      if (!['toggle_expand_btn', 'toggle_moves_drawer'].includes(button.id)) button.disabled = true;
    });
    // Expand / Minimize Quickbar
    const expandBtn = this.container.querySelector('#toggle_expand_btn');
    if (expandBtn) {
      expandBtn.onclick = () => {
        this.isExpanded = !this.isExpanded;
        this.render();
      };
    }

    // Toggle Sleeper Moves Drawer
    const drawerBtn = this.container.querySelector('#toggle_moves_drawer');
    if (drawerBtn) {
      drawerBtn.onclick = () => {
        this.movesOpen = !this.movesOpen;
        this.render();
      };
    }

    // Open Sheet
    const sheetBtn = this.container.querySelector('#open_sheet_btn');
    if (sheetBtn) {
      sheetBtn.onclick = () => this.openCharacterSheetModal(token);
    }

    // HP Plus / Minus
    const hpPlus = this.container.querySelector('#hp_plus_btn');
    const hpMinus = this.container.querySelector('#hp_minus_btn');
    if (hpPlus) {
      hpPlus.onclick = () => {
        const cur = token.hp.current;
        const newHp = Math.min(token.hp.max, cur + 1);
        store.updateToken(token.id, { hp: { ...token.hp, current: newHp } });
        network.broadcast({ type: 'TOKEN_UPDATE', tokenId: token.id, partial: { hp: { ...token.hp, current: newHp } } });
      };
    }
    if (hpMinus) {
      hpMinus.onclick = () => {
        const cur = token.hp.current;
        const newHp = Math.max(0, cur - 1);
        store.updateToken(token.id, { hp: { ...token.hp, current: newHp } });
        network.broadcast({ type: 'TOKEN_UPDATE', tokenId: token.id, partial: { hp: { ...token.hp, current: newHp } } });
      };
    }

    // Armor Pips click
    this.container.querySelectorAll('.pip-armor').forEach(pip => {
      pip.onclick = () => {
        const idx = parseInt(pip.dataset.idx, 10);
        const cur = token.armor?.current || 0;
        const newArmor = idx + 1 === cur ? idx : idx + 1;
        store.updateToken(token.id, { armor: { ...token.armor, current: newArmor } });
        network.broadcast({ type: 'TOKEN_UPDATE', tokenId: token.id, partial: { armor: { ...token.armor, current: newArmor } } });
      };
    });

    // Stress Pips click
    this.container.querySelectorAll('.pip-stress').forEach(pip => {
      pip.onclick = () => {
        const idx = parseInt(pip.dataset.idx, 10);
        const cur = token.stress?.current || 0;
        const newStress = idx + 1 === cur ? idx : idx + 1;
        store.updateToken(token.id, { stress: { ...token.stress, current: newStress } });
        network.broadcast({ type: 'TOKEN_UPDATE', tokenId: token.id, partial: { stress: { ...token.stress, current: newStress } } });
      };
    });

    // Hope Pips click
    this.container.querySelectorAll('.pip-hope').forEach(pip => {
      pip.onclick = () => {
        const idx = parseInt(pip.dataset.idx, 10);
        const cur = token.hope || 0;
        const newHope = idx + 1 === cur ? idx : idx + 1;
        store.updateToken(token.id, { hope: newHope });
        network.broadcast({ type: 'TOKEN_UPDATE', tokenId: token.id, partial: { hope: newHope } });
      };
    });

    // Effort Pips click (Sleeping)
    this.container.querySelectorAll('.pip-effort').forEach(pip => {
      pip.onclick = () => {
        const idx = parseInt(pip.dataset.idx, 10);
        const cur = token.effort || 0;
        const newEffort = idx + 1 === cur ? idx : idx + 1;
        store.updateToken(token.id, { effort: newEffort });
        network.broadcast({ type: 'TOKEN_UPDATE', tokenId: token.id, partial: { effort: newEffort } });
      };
    });

    // Mark Effort Segment Button
    const markSegBtn = this.container.querySelector('#mark_effort_segment_btn');
    if (markSegBtn) {
      markSegBtn.onclick = () => {
        store.markEffortSegment(token.id);
      };
    }

    // Bear Down Resolve Button
    const bearDownBtn = this.container.querySelector('#bear_down_btn');
    if (bearDownBtn) {
      bearDownBtn.onclick = async () => {
        try { const result=await network.requestAction({type:'RESOLVE',actorId:token.id,visibility:window.veilDiceRoller?.rollVisibility() || 'table'});window.veilDiceRoller?.showResult(result); }
        catch(e){notify(e.message,'error');}
      };
    }

    const burnoutBtn = this.container.querySelector('#burnout_btn');
    if (burnoutBtn) burnoutBtn.onclick=()=>notify('At 0 Effort, choose a Common Effort to invoke it using Burnout.');
    this.container.querySelectorAll('.effort-move-btn').forEach(btn=>{
      btn.onclick=async()=>{
        const fresh=store.state.tokens.find(t=>t.id===token.id);
        const burnout=fresh?.effort===0;
        if(burnout&&!await confirmAction(`Invoke ${btn.dataset.move} with Burnout? Pay 1 HP, mark 1 Stress and reduce Stress maximum by 1 until Recovery.`))return;
        try{await network.requestAction({type:'EFFORT',actorId:token.id,move:btn.dataset.move,burnout});notify(`${btn.dataset.move} · cost applied. See the session log for its effect.`);}
        catch(e){notify(e.message,'error');}
      };
    });

    // Awakened Hope Actions
    this.container.querySelectorAll('.tok-hope-action-btn').forEach(btn => {
      btn.onclick = () => {
        const act = btn.dataset.action;
        if ((token.hope || 0) >= 1) {
          store.updateToken(token.id, { hope: token.hope - 1 });
          store.addLog({
            sender: token.name,
            type: 'HOPE_MOVE',
            title: `${escapeHTML(token.name)}: Spent 1 Hope on [${act.toUpperCase()}]`,
            details: `Remaining Hope: ${token.hope - 1} / 6`
          });
        } else {
          notify('Not enough Hope remaining (Requires 1 Hope).');
        }
      };
    });

    // Quick Trait Roll Click
    this.container.querySelectorAll('.quick-trait-btn').forEach(btn => {
      btn.onclick = () => {
        const traitId = btn.dataset.traitId;
        const traitName = btn.dataset.traitName;
        const mod = parseInt(btn.dataset.mod, 10);

        // Populate and trigger roll in Dice Roller sidebar
        if (window.veilDiceRoller) {
          window.veilDiceRoller.setCheckData({
            actor: token,
            traitId,
            traitName,
            traitMod: mod
          });
        }
      };
    });
  }

  openCharacterSheetModal(token) {
    if (!store.canEditToken(token.id)) { notify('Selecciona uno de tus tokens asignados.'); return; }
    return openDossier(token, actor => this.openTokenSettingsModal(actor));
  }

  openTokenSettingsModal(token) {
    if(store.sessionRole==='player'){notify('The Keeper manages character dossiers. Use your assigned character’s quick controls.');return;}
    const modal = document.createElement('div');
    modal.className = 'veil-modal-backdrop';
    modal.innerHTML = sanitizeHTML(`
      <div class="veil-modal-box sheet-modal-box">
        <div class="veil-modal-header">
          <h3>OPERATIVE DOSSIER // [${escapeHTML(token.name.toUpperCase())}]</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="veil-modal-body sheet-modal-body">
          <div class="sheet-grid">
            <!-- Left Column: Portrait & Identity -->
            <div class="sheet-col-left">
              <div class="sheet-avatar-frame">
                <img src="${escapeHTML(token.avatarUrl || '/assets/tokens/captain_harker.jpg')}" id="sheet_avatar_preview" class="sheet-avatar-img" />
              </div>

              <div class="form-group" style="margin-top: 10px;">
                <label>Avatar URL or File</label>
                <input type="text" id="sheet_avatar_url" class="hud-input" value="${escapeHTML(token.avatarUrl || '')}" />
                <input type="file" id="sheet_avatar_file" accept="image/*" class="hud-file-input" style="margin-top: 6px;" />
              </div>

              <div class="form-group">
                <label>Token Name</label>
                <input type="text" id="sheet_name" class="hud-input" value="${escapeHTML(token.name)}" />
              </div>

              <div class="form-group">
                <label>Class / Role / Title</label>
                <input type="text" id="sheet_role" class="hud-input" value="${escapeHTML(token.roleTag || '')}" />
              </div>

              <div class="form-group">
                <label>Species / Lineage (ej. Ailurean, Humano, Synth)</label>
                <input type="text" id="sheet_species" class="hud-input" value="${escapeHTML(token.species || (token.roleTag?.toLowerCase().includes('ailurean') ? 'Ailurean' : ''))}" placeholder="Ailurean (activa visión cromática), etc." />
              </div>

              <div class="form-group">
                <label>Tipo de Actor / Token</label>
                <vf-select id="sheet_actor_type" class="hud-select">
                  <option value="player" ${(token.actorType || (token.isPlayer !== false ? 'player' : 'npc')) === 'player' ? 'selected' : ''}>👤 Personaje Jugador (PJ)</option>
                  <option value="npc" ${(token.actorType || (token.isPlayer !== false ? 'player' : 'npc')) === 'npc' ? 'selected' : ''}>🤝 PNJ Aliado / Neutral</option>
                  <option value="adversary" ${(token.actorType || (token.isPlayer !== false ? 'player' : 'npc')) === 'adversary' ? 'selected' : ''}>👾 Adversario / Enemigo Hostil</option>
                </vf-select>
              </div>

              <div class="form-group checkbox-group" style="margin-top: 6px;">
                <label class="hud-checkbox-label">
                  <input type="checkbox" id="sheet_hide_name" ${token.hideName ? 'checked' : ''} />
                  <span>🕶️ Ocultar Nombre a Jugadores (Muestra ?????)</span>
                </label>
              </div>

              <div class="form-group">
                <label>Cosmological Path</label>
                <vf-select id="sheet_path" class="hud-select">
                  <option value="Awakened" ${token.path === 'Awakened' ? 'selected' : ''}>Awakened (Hope Engine)</option>
                  <option value="Sleeping" ${token.path === 'Sleeping' ? 'selected' : ''}>Sleeping (Effort & Resolve)</option>
                </vf-select>
              </div>

              <div class="form-group">
                <label>Grid Size (Cells)</label>
                <vf-select id="sheet_size" class="hud-select">
                  <option value="1" ${token.size === 1 ? 'selected' : ''}>Medium (1x1 sq)</option>
                  <option value="2" ${token.size === 2 ? 'selected' : ''}>Large (2x2 sq)</option>
                  <option value="3" ${token.size === 3 ? 'selected' : ''}>Huge / Ship (3x3 sq)</option>
                </vf-select>
              </div>
            </div>

            <!-- Right Column: Vitals, Traits & Lighting -->
            <div class="sheet-col-right">
              <h4 class="sheet-section-title">VITALS & THRESHOLDS</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Current HP</label>
                  <input type="number" id="sheet_hp_cur" class="hud-input" value="${token.hp.current}" />
                </div>
                <div class="form-group">
                  <label>Max HP</label>
                  <input type="number" id="sheet_hp_max" class="hud-input" value="${token.hp.max}" />
                </div>
                <div class="form-group">
                  <label>Major Threshold</label>
                  <input type="number" id="sheet_hp_major" class="hud-input" value="${token.hp.majorThreshold}" />
                </div>
                <div class="form-group">
                  <label>Severe Threshold</label>
                  <input type="number" id="sheet_hp_severe" class="hud-input" value="${token.hp.severeThreshold}" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Armor Current</label>
                  <input type="number" id="sheet_armor_cur" class="hud-input" value="${token.armor?.current || 0}" />
                </div>
                <div class="form-group">
                  <label>Armor Max</label>
                  <input type="number" id="sheet_armor_max" class="hud-input" value="${token.armor?.max || 0}" />
                </div>
                <div class="form-group">
                  <label>Stress Current</label>
                  <input type="number" id="sheet_stress_cur" class="hud-input" value="${token.stress?.current || 0}" />
                </div>
                <div class="form-group">
                  <label>Stress Max</label>
                  <input type="number" id="sheet_stress_max" class="hud-input" value="${token.stress?.max || 6}" />
                </div>
              </div>

              <!-- Sleeping Path Exclusive Stats -->
              <div id="sleeping_stats_section" style="${token.path === 'Sleeping' ? '' : 'display: none;'}">
                <h4 class="sheet-section-title" style="margin-top: 14px; color: var(--amber-warn); border-color: rgba(255,170,0,0.3);">
                  SLEEPING OPERATIVE // EFFORT & RESOLVE
                </h4>
                <div class="form-row">
                  <div class="form-group">
                    <label>Current Effort</label>
                    <input type="number" id="sheet_effort_cur" class="hud-input" value="${token.effort ?? 2}" min="0" max="6" />
                  </div>
                  <div class="form-group">
                    <label>Resolve Dice Pool</label>
                    <input type="number" id="sheet_resolve_cur" class="hud-input" value="${token.resolve?.current ?? 2}" />
                  </div>
                  <div class="form-group">
                    <label>Resolve Die Type</label>
                    <vf-select id="sheet_resolve_die" class="hud-select">
                      <option value="d4" ${token.resolve?.dieType === 'd4' ? 'selected' : ''}>d4 (Standard)</option>
                      <option value="d6" ${token.resolve?.dieType === 'd6' ? 'selected' : ''}>d6 (Honed Tier)</option>
                    </vf-select>
                  </div>
                  <div class="form-group">
                    <label>Honed Edge (+Dmg)</label>
                    <input type="number" id="sheet_honed_edge" class="hud-input" value="${token.honedEdgeBonus ?? 1}" />
                  </div>
                </div>
                <div class="form-group">
                  <label>Recovery Anchor (Bond / Quarters / Keepsake)</label>
                  <input type="text" id="sheet_recovery_anchor" class="hud-input" value="${escapeHTML(token.recoveryAnchor || '')}" />
                </div>
              </div>

              <h4 class="sheet-section-title" style="margin-top: 16px;">THE SIX CANONICAL TRAITS</h4>
              <div class="form-row traits-editor-grid">
                ${TRAITS.map(t => `
                  <div class="form-group">
                    <label>${t.name}</label>
                    <input type="number" id="sheet_trait_${t.id}" class="hud-input trait-input" value="${token.traits?.[t.id] ?? 0}" />
                  </div>
                `).join('')}
              </div>

              <h4 class="sheet-section-title" style="margin-top: 16px;">SUBTRAITS</h4>
              <div class="form-row subtraits-editor-grid">
                ${SUBTRAITS.map(st => `
                  <div class="form-group">
                    <label>${st.name}</label>
                    <input type="number" id="sheet_subtrait_${st.id}" class="hud-input subtrait-input" value="${token.subtraits?.[st.id] ?? 0}" />
                  </div>
                `).join('')}
              </div>

              <!-- TACTICAL VISION & DYNAMIC LIGHTING -->
              <h4 class="sheet-section-title" style="margin-top: 16px; color: #00f3ff; border-color: rgba(0, 243, 255, 0.3);">
                👁️ SISTEMA DE VISIÓN TÁCTICA & SENSORES
              </h4>
              <div class="form-row" style="gap: 10px; flex-wrap: wrap;">
                <div class="form-group" style="flex: 1.2; min-width: 140px;">
                  <label>Modo de Visión</label>
                  <vf-select id="sheet_vision_mode" class="hud-select">
                    <option value="normal" ${(token.visionMode || 'normal') === 'normal' ? 'selected' : ''}>Visión Normal (Estándar)</option>
                    <option value="night_vision" ${token.visionMode === 'night_vision' ? 'selected' : ''}>Visión Nocturna (Haz Verde)</option>
                    <option value="sensory" ${token.visionMode === 'sensory' ? 'selected' : ''}>Visión Sensorial (Tremorsense Acústico)</option>
                    <option value="chromatic" ${token.visionMode === 'chromatic' ? 'selected' : ''}>Visión Cromática (B&N Ailurean)</option>
                  </vf-select>
                </div>
                <div class="form-group" style="flex: 1; min-width: 100px;">
                  <label>Alcance Visión (px)</label>
                  <input type="number" id="sheet_vision_range" class="hud-input" min="60" max="1200" step="20" value="${token.visionRange || 280}" />
                </div>
                <div class="form-group" style="flex: 1; min-width: 110px;">
                  <label>Ángulo FOV</label>
                  <vf-select id="sheet_vision_angle" class="hud-select">
                    <option value="360" ${(token.visionAngle ?? 360) === 360 ? 'selected' : ''}>360° Omnidireccional</option>
                    <option value="180" ${token.visionAngle === 180 ? 'selected' : ''}>180° Frontal Amplio</option>
                    <option value="120" ${token.visionAngle === 120 ? 'selected' : ''}>120° Cono Táctico</option>
                    <option value="90" ${token.visionAngle === 90 ? 'selected' : ''}>90° Estándar</option>
                    <option value="60" ${token.visionAngle === 60 ? 'selected' : ''}>60° Enfocado</option>
                  </vf-select>
                </div>
                <div class="form-group checkbox-group" style="flex: 1.2; min-width: 140px; margin-top: 18px;">
                  <label class="hud-checkbox-label">
                    <input type="checkbox" id="sheet_is_flying" ${token.isFlying ? 'checked' : ''} />
                    <span>🕊️ Criatura Voladora (Inmune a Vibración)</span>
                  </label>
                </div>
                <div class="form-group checkbox-group" style="flex: 1.3; min-width: 160px; margin-top: 18px;">
                  <label class="hud-checkbox-label">
                    <input type="checkbox" id="sheet_has_vibration" ${token.hasVibrationVision ? 'checked' : ''} />
                    <span>📡 Sentir Vibraciones (Tremorsense 360°)</span>
                  </label>
                </div>
                <div class="form-group" style="flex: 1; min-width: 110px;">
                  <label>Radio Vibración (px)</label>
                  <input type="number" id="sheet_vibration_radius" class="hud-input" min="40" max="1200" step="20" value="${token.vibrationRadius || 260}" />
                </div>
              </div>

              <!-- DYNAMIC LIGHT EMISSION -->
              <h4 class="sheet-section-title" style="margin-top: 16px;">EMISIÓN DE LUZ / LINTERNA</h4>
              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label class="hud-checkbox-label">
                    <input type="checkbox" id="sheet_has_light" ${token.hasLight ? 'checked' : ''} />
                    <span>Emite Luz / Foco Táctico</span>
                  </label>
                </div>
                <div class="form-group">
                  <label>Radio de Luz (px)</label>
                  <input type="number" id="sheet_light_rad" class="hud-input" value="${token.lightRadius || 260}" />
                </div>
                <div class="form-group">
                  <label>Color de Luz</label>
                  <div style="display: flex; gap: 6px; align-items: center;">
                    <button type="button" id="sheet_light_col_btn" class="overlay-color-btn" style="background: ${token.lightColor || '#00f3ff'};" title="Elegir Color de Luz"></button>
                    <input type="text" id="sheet_light_col_val" class="hud-input hud-input-xs" value="${token.lightColor || '#00f3ff'}" style="width: 80px;" />
                  </div>
                </div>
              </div>

              <div class="form-row" style="margin-top: 8px;">
                <div class="form-group">
                  <label>Efecto Dinámico FX</label>
                  <vf-select id="sheet_light_fx" class="hud-select">
                    <option value="steady" ${token.lightEffect === 'steady' ? 'selected' : ''}>Steady (Normal Torch)</option>
                    <option value="pulse" ${token.lightEffect === 'pulse' ? 'selected' : ''}>Pulse (Breathing Beacon)</option>
                    <option value="flicker" ${token.lightEffect === 'flicker' ? 'selected' : ''}>Flicker (Damaged Circuit)</option>
                    <option value="siren" ${token.lightEffect === 'siren' ? 'selected' : ''}>Siren / Strobe (Alert Warning)</option>
                    <option value="quantum" ${token.lightEffect === 'quantum' ? 'selected' : ''}>Quantum (Pearl Glow)</option>
                    <option value="spark" ${token.lightEffect === 'spark' ? 'selected' : ''}>Spark (Arcing Filament)</option>
                  </vf-select>
                </div>
                <div class="form-group checkbox-group" style="margin-top: 18px;">
                  <label class="hud-checkbox-label">
                    <input type="checkbox" id="sheet_is_hidden" ${token.hidden ? 'checked' : ''} />
                    <span>Oculto a Jugadores (Stealth / Niebla)</span>
                  </label>
                </div>
              </div>

              <!-- MAP OVERLAYS & MODULAR INDICATOR SELECTION -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px; border-bottom: 1px solid rgba(0, 243, 255, 0.3); padding-bottom: 4px;">
                <h4 class="sheet-section-title" style="margin: 0; color: #00f3ff; border: none;">
                  📊 INDICADORES EN TOKEN // BARRAS, CONTADORES Y RELOJES
                </h4>
                <button type="button" class="hud-btn hud-btn-xs hud-btn-primary" id="sheet_add_overlay_btn">+ AÑADIR INDICADOR</button>
              </div>
              <div class="overlay-indicators-list" id="sheet_overlays_list">
                <!-- Rendered dynamically -->
              </div>
            </div>
          </div>

          <div class="modal-actions-row sheet-actions">
            <button class="hud-btn hud-btn-danger" id="sheet_delete_btn">DELETE TOKEN</button>
            <div style="display: flex; gap: 8px;">
              <button class="hud-btn hud-btn-secondary modal-cancel-btn">CANCEL</button>
              <button class="hud-btn hud-btn-primary" id="sheet_save_btn">APPLY DOSSIER</button>
            </div>
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(modal);

    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.querySelector('.modal-cancel-btn').onclick = () => modal.remove();

    // Setup Persistent Color Picker on Light Color Button
    const lightColBtn = modal.querySelector('#sheet_light_col_btn');
    const lightColVal = modal.querySelector('#sheet_light_col_val');
    if (lightColBtn && lightColVal) {
      lightColBtn.onclick = () => {
        openColorPickerPopover(lightColBtn, lightColVal.value, (newCol) => {
          lightColVal.value = newCol;
          lightColBtn.style.background = newCol;
        });
      };
      lightColVal.oninput = () => {
        lightColBtn.style.background = lightColVal.value;
      };
    }

    // Initialize Modular Token Overlays
    let currentOverlays = [];
    if (token.displayOverlays && Array.isArray(token.displayOverlays) && token.displayOverlays.length > 0) {
      currentOverlays = JSON.parse(JSON.stringify(token.displayOverlays));
    } else {
      currentOverlays = [
        { id: 'ov_hp_bar', statKey: 'hp', type: 'bar', color: '#10b981', label: 'HP' },
        { id: 'ov_stress_bar', statKey: 'stress', type: 'bar', color: '#d946ef', label: 'ESTRÉS' },
        { id: 'ov_hp_cnt', statKey: 'hp', type: 'linear', color: '#34d399', label: '❤️' },
        { id: 'ov_armor_cnt', statKey: 'armor', type: 'linear', color: '#38bdf8', label: '🛡️' },
        { id: 'ov_clock', statKey: 'clock', type: 'circular', color: '#00f3ff', label: 'HACK', segments: 4, current: 2 }
      ];
    }

    const overlaysListEl = modal.querySelector('#sheet_overlays_list');
    const renderOverlayCards = () => {
      overlaysListEl.innerHTML = sanitizeHTML('');
      currentOverlays.forEach((ov, index) => {
        const card = document.createElement('div');
        card.className = 'overlay-indicator-card';
        card.innerHTML = sanitizeHTML(`
          <div style="flex: 1.5; min-width: 140px;">
            <label style="font-size: 9px; color: var(--text-dim); display: block; margin-bottom: 2px;">Elemento de Ficha</label>
            <vf-select class="overlay-stat hud-select hud-select-xs">
              ${AVAILABLE_STATS.map(st => `
                <option value="${st.id}" ${ov.statKey === st.id ? 'selected' : ''}>${st.name}</option>
              `).join('')}
            </vf-select>
          </div>
          <div style="flex: 1.2; min-width: 130px;">
            <label style="font-size: 9px; color: var(--text-dim); display: block; margin-bottom: 2px;">Tipo Visual</label>
            <vf-select class="overlay-type hud-select hud-select-xs">
              <option value="bar" ${ov.type === 'bar' ? 'selected' : ''}>█ Barra Superior</option>
              <option value="linear" ${ov.type === 'linear' ? 'selected' : ''}>🏷️ Contador Linear</option>
              <option value="circular" ${ov.type === 'circular' ? 'selected' : ''}>⏱️ Contador Circular / Reloj</option>
            </vf-select>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; width: 36px;">
            <label style="font-size: 9px; color: var(--text-dim); margin-bottom: 2px;">Color</label>
            <button type="button" class="overlay-color-btn" style="background: ${ov.color || '#00f3ff'};" title="Elegir Color"></button>
          </div>
          <div style="flex: 1; min-width: 80px;">
            <label style="font-size: 9px; color: var(--text-dim); display: block; margin-bottom: 2px;">Etiqueta</label>
            <input type="text" class="overlay-label hud-input hud-input-xs" value="${ov.label || ''}" placeholder="ej. HP" />
          </div>
          <div style="display: flex; align-items: flex-end;">
            <button type="button" class="hud-btn hud-btn-xs hud-btn-danger overlay-del" title="Eliminar Indicador" style="margin-top: 14px;">✕</button>
          </div>
        `);

        const statSel = card.querySelector('.overlay-stat');
        const typeSel = card.querySelector('.overlay-type');
        const colorBtn = card.querySelector('.overlay-color-btn');
        const labelInp = card.querySelector('.overlay-label');
        const delBtn = card.querySelector('.overlay-del');

        statSel.onchange = (e) => { ov.statKey = e.target.value; };
        typeSel.onchange = (e) => { ov.type = e.target.value; };
        labelInp.oninput = (e) => { ov.label = e.target.value; };

        colorBtn.onclick = (e) => {
          e.stopPropagation();
          openColorPickerPopover(colorBtn, ov.color || '#00f3ff', (newCol) => {
            ov.color = newCol;
            colorBtn.style.background = newCol;
          });
        };

        delBtn.onclick = () => {
          currentOverlays.splice(index, 1);
          renderOverlayCards();
        };

        overlaysListEl.appendChild(card);
      });
    };

    renderOverlayCards();

    // Add Overlay Button
    modal.querySelector('#sheet_add_overlay_btn').onclick = () => {
      currentOverlays.push({
        id: 'ov_' + Date.now(),
        statKey: 'hp',
        type: 'bar',
        color: '#00f3ff',
        label: 'STAT'
      });
      renderOverlayCards();
    };

    // Toggle sleeping section when path select changes
    const pathSelect = modal.querySelector('#sheet_path');
    const sleepingSection = modal.querySelector('#sleeping_stats_section');
    pathSelect.onchange = () => {
      sleepingSection.style.display = pathSelect.value === 'Sleeping' ? 'block' : 'none';
    };

    // Local avatar file upload
    const fileInput = modal.querySelector('#sheet_avatar_file');
    const avatarPreview = modal.querySelector('#sheet_avatar_preview');
    const avatarUrlInput = modal.querySelector('#sheet_avatar_url');

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          avatarPreview.src = re.target.result;
          avatarUrlInput.value = re.target.result;
        };
        reader.readAsDataURL(file);
      }
    };

    avatarUrlInput.oninput = () => {
      avatarPreview.src = avatarUrlInput.value;
    };

    // Delete token
    modal.querySelector('#sheet_delete_btn').onclick = async () => {
      if (await confirmAction(`Confirm termination of token [${token.name}]?`)) {
        store.deleteToken(token.id);
        network.broadcast({ type: 'TOKEN_DELETE', tokenId: token.id });
        modal.remove();
      }
    };

    // Save token
    modal.querySelector('#sheet_save_btn').onclick = () => {
      const traits = {};
      TRAITS.forEach(t => {
        traits[t.id] = parseInt(modal.querySelector(`#sheet_trait_${t.id}`).value, 10) || 0;
      });

      const subtraits = {};
      SUBTRAITS.forEach(st => {
        subtraits[st.id] = parseInt(modal.querySelector(`#sheet_subtrait_${st.id}`).value, 10) || 0;
      });

      // Synchronize latest values from overlay cards
      const cardEls = modal.querySelectorAll('.overlay-indicator-card');
      cardEls.forEach((card, idx) => {
        if (currentOverlays[idx]) {
          currentOverlays[idx].statKey = card.querySelector('.overlay-stat').value;
          currentOverlays[idx].type = card.querySelector('.overlay-type').value;
          currentOverlays[idx].label = card.querySelector('.overlay-label').value.trim() || currentOverlays[idx].statKey.toUpperCase();
        }
      });

      const actorTypeVal = modal.querySelector('#sheet_actor_type')?.value || 'player';
      const updated = {
        name: modal.querySelector('#sheet_name').value.trim() || token.name,
        roleTag: modal.querySelector('#sheet_role').value.trim(),
        actorType: actorTypeVal,
        isPlayer: actorTypeVal === 'player',
        hideName: modal.querySelector('#sheet_hide_name')?.checked ?? false,
        species: modal.querySelector('#sheet_species')?.value.trim() || token.species,
        avatarUrl: avatarUrlInput.value || token.avatarUrl,
        path: pathSelect.value,
        size: parseInt(modal.querySelector('#sheet_size').value, 10),
        hp: {
          current: parseInt(modal.querySelector('#sheet_hp_cur').value, 10),
          max: parseInt(modal.querySelector('#sheet_hp_max').value, 10),
          majorThreshold: parseInt(modal.querySelector('#sheet_hp_major').value, 10),
          severeThreshold: parseInt(modal.querySelector('#sheet_hp_severe').value, 10)
        },
        armor: {
          current: parseInt(modal.querySelector('#sheet_armor_cur').value, 10),
          max: parseInt(modal.querySelector('#sheet_armor_max').value, 10)
        },
        stress: {
          current: parseInt(modal.querySelector('#sheet_stress_cur').value, 10),
          max: parseInt(modal.querySelector('#sheet_stress_max').value, 10)
        },
        effort: parseInt(modal.querySelector('#sheet_effort_cur')?.value, 10) ?? token.effort,
        resolve: {
          current: parseInt(modal.querySelector('#sheet_resolve_cur')?.value, 10) ?? (token.resolve?.current || 2),
          max: token.resolve?.max ?? 2,
          dieType: modal.querySelector('#sheet_resolve_die')?.value || 'd4'
        },
        recoveryAnchor: modal.querySelector('#sheet_recovery_anchor')?.value.trim() || token.recoveryAnchor,
        honedEdgeBonus: parseInt(modal.querySelector('#sheet_honed_edge')?.value, 10) || 0,
        traits,
        subtraits,
        visionMode: modal.querySelector('#sheet_vision_mode').value,
        visionRange: parseInt(modal.querySelector('#sheet_vision_range').value, 10) || 280,
        visionAngle: parseInt(modal.querySelector('#sheet_vision_angle').value, 10) || 360,
        isFlying: modal.querySelector('#sheet_is_flying').checked,
        hasVibrationVision: modal.querySelector('#sheet_has_vibration')?.checked ?? false,
        vibrationRadius: parseInt(modal.querySelector('#sheet_vibration_radius')?.value, 10) || 260,
        hasLight: modal.querySelector('#sheet_has_light').checked,
        lightRadius: parseInt(modal.querySelector('#sheet_light_rad').value, 10),
        lightColor: modal.querySelector('#sheet_light_col_val').value,
        lightEffect: modal.querySelector('#sheet_light_fx').value,
        hidden: modal.querySelector('#sheet_is_hidden').checked,
        displayOverlays: currentOverlays,
        displayConfig: {
          showHpBar: currentOverlays.some(o => o.statKey === 'hp' && o.type === 'bar'),
          showStressBar: currentOverlays.some(o => o.statKey === 'stress' && o.type === 'bar'),
          showHpCounter: currentOverlays.some(o => o.statKey === 'hp' && o.type === 'linear'),
          showStressCounter: currentOverlays.some(o => o.statKey === 'stress' && o.type === 'linear'),
          showArmorCounter: currentOverlays.some(o => o.statKey === 'armor' && o.type === 'linear'),
          showClock: currentOverlays.some(o => o.type === 'circular'),
          clockLabel: currentOverlays.find(o => o.type === 'circular')?.label || 'CLOCK',
          clockSegments: 4,
          clockProgress: 2
        }
      };

      try { validateActor({ ...token, ...updated }); } catch (err) { notify(err.message, 'error'); return; }
      store.updateToken(token.id, updated);
      network.broadcast({ type: 'TOKEN_UPDATE', tokenId: token.id, partial: updated });
      modal.remove();
    };
  }
}
