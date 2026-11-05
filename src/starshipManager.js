import { sanitizeHTML, notify } from './ui.js';
// src/starshipManager.js
// Starship Naval Combat HUD & Tactical Station (Veilfarers Canon 12.06 Chapter 17)

import { store } from './state.js';
import { network } from './networkManager.js';
import { rollVeilfarersCheck } from './rulesEngine.js';
import { audio } from './audioEngine.js';

export class StarshipManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    store.subscribe((state, keys) => {
      if (keys.includes('starship') || keys.includes('userRole')) {
        this.render();
      }
    });
  }

  render() {
    const state = store.getState();
    const ship = state.starship || {
      name: 'USC Vagrant Star',
      hullClass: 'Light Freighter (Tier 2)',
      tier: 2,
      hull: 14,
      maxHull: 14,
      evasion: 14,
      mountRating: 2,
      heat: 0,
      heatCap: 10,
      rangeBand: 'Engagement',
      pearls: 3,
      shieldArcs: {
        fore: 4,
        aft: 4,
        port: 4,
        starboard: 4,
        maxPerArc: 4
      }
    };
    const isKeeper = state.userRole === 'keeper';

    const hullPct = Math.max(0, Math.min(100, (ship.hull / ship.maxHull) * 100));
    const heatPct = Math.max(0, Math.min(100, (ship.heat / ship.heatCap) * 100));

    this.container.innerHTML = sanitizeHTML(`
      <div class="starship-sidebar-content">
        <div class="sidebar-header-row">
          <span class="sidebar-title">STARSHIP TACTICAL HUB // [${ship.name.toUpperCase()}]</span>
          <span class="badge badge-cyan">${ship.hullClass}</span>
        </div>

        <div class="ship-instruments">
          ${[{label:'HULL',value:ship.hull,max:ship.maxHull,color:'#78cfdf'},{label:'HEAT',value:ship.heat,max:ship.heatCap,color:'#c885c1'},{label:'PEARLS',value:ship.pearls,max:Math.max(3,ship.pearls),color:'#8fa4e7'}].map(m=>`<div class="instrument"><div class="instrument-ring" style="--value:${Math.min(100,m.value/m.max*100)};--ring:${m.color}"><div class="instrument-value">${m.value}<small>/ ${m.max}</small></div></div><span>${m.label}</span></div>`).join('')}
        </div>
        ${!isKeeper?'<p class="field-help">Ship systems are managed by the Keeper. Select your character to roll a station check.</p>':''}
        <!-- Hull Points & Range Band -->
        <div class="glass-panel" style="padding: 10px; margin-bottom: 12px; border-color: rgba(0, 243, 255, 0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-family: var(--font-hud); font-size: 11px; font-weight: 700; color: #fff;">HULL INTEGRITY</span>
            <span style="font-family: var(--font-mono); font-size: 13px; font-weight: 900; color: ${hullPct > 50 ? 'var(--emerald-success)' : hullPct > 25 ? 'var(--amber-warn)' : 'var(--danger-glow)'};">
              ${ship.hull} / ${ship.maxHull}
            </span>
          </div>
          <div class="tok-qb-hp-bar" style="height: 6px; margin-bottom: 8px;">
            <div class="tok-qb-hp-fill" style="width: ${hullPct}%; background: ${hullPct > 50 ? 'var(--emerald-success)' : hullPct > 25 ? 'var(--amber-warn)' : 'var(--danger-glow)'};"></div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 4px;">
              <button class="hud-btn hud-btn-xs hud-btn-danger" id="ship_hull_minus">-1 HULL</button>
              <button class="hud-btn hud-btn-xs hud-btn-primary" id="ship_hull_plus">+1 HULL</button>
            </div>
            <div style="font-size: 10px; color: var(--text-dim);">
              EVASION: <span style="color: #fff; font-weight: 700;">${ship.evasion}</span> | MR: <span style="color: var(--cyan-pearl); font-weight: 700;">×${ship.mountRating}</span>
            </div>
          </div>
        </div>

        <!-- Range Band Selector -->
        <div class="glass-panel" style="padding: 10px; margin-bottom: 12px;">
          <div style="font-family: var(--font-hud); font-size: 10px; font-weight: 700; color: var(--cyan-pearl); margin-bottom: 6px; text-transform: uppercase;">
            TACTICAL RANGE BAND (CHAPTER 17)
          </div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px;">
            ${['Adjacent', 'Engagement', 'Standard', 'Long', 'Extreme'].map(band => `
              <button class="hud-btn hud-btn-xs range-band-btn ${ship.rangeBand === band ? 'active hud-btn-primary' : ''}" data-band="${band}" style="padding: 4px 2px; font-size: 9px;">
                ${band}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Shield Arcs (4 Compass Points) -->
        <div class="glass-panel" style="padding: 10px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-family: var(--font-hud); font-size: 10px; font-weight: 700; color: var(--cyan-pearl);">SHIELD ARCS // ABSORPTION</span>
            <button class="hud-btn hud-btn-xs hud-btn-secondary" id="regen_shields_btn" title="End of Round: Regenerate 2 Slots per Arc">END ROUND</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            ${['fore', 'aft', 'port', 'starboard'].map(arc => {
              const cur = ship.shieldArcs[arc];
              const max = ship.shieldArcs.maxPerArc;
              return `
                <div style="background: rgba(10, 16, 28, 0.7); border: 1px solid rgba(0, 243, 255, 0.2); padding: 6px 8px; border-radius: 4px;">
                  <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
                    <span style="text-transform: uppercase; font-weight: 700; color: #fff;">${arc}</span>
                    <span style="color: var(--cyan-pearl); font-weight: 700;">${cur} / ${max}</span>
                  </div>
                  <div style="display: flex; gap: 3px; margin-bottom: 6px;">
                    ${Array.from({ length: max }, (_, i) => `
                      <span class="pip pip-armor ${i < cur ? 'active' : ''}" style="width: 14px; height: 6px; border-radius: 1px;"></span>
                    `).join('')}
                  </div>
                  <button class="hud-btn hud-btn-xs reinforce-arc-btn" data-arc="${arc}" style="width: 100%; font-size: 8px;">REINFORCE (+2 HEAT)</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Thermal Core & Heat Management -->
        <div class="glass-panel" style="padding: 10px; margin-bottom: 12px; border-color: ${ship.heat >= 8 ? 'var(--danger-glow)' : 'rgba(245, 158, 11, 0.3)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-family: var(--font-hud); font-size: 10px; font-weight: 700; color: var(--amber-warn);">THERMAL CORE HEAT</span>
            <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 900; color: ${ship.heat >= 8 ? 'var(--danger-glow)' : 'var(--amber-warn)'};">
              ${ship.heat} / ${ship.heatCap}
            </span>
          </div>
          <div class="tok-qb-hp-bar" style="height: 6px; margin-bottom: 8px;">
            <div class="tok-qb-hp-fill" style="width: ${heatPct}%; background: ${ship.heat >= 8 ? 'var(--danger-glow)' : 'var(--amber-warn)'};"></div>
          </div>

          <div style="display: flex; gap: 6px;">
            <button class="hud-btn hud-btn-xs hud-btn-secondary" id="cool_systems_btn" style="flex: 1;">COOL (-3 HEAT)</button>
            <button class="hud-btn hud-btn-xs hud-btn-danger" id="vent_core_btn" style="flex: 1;" title="Dump 5 Heat; Ship becomes Visible for 1 round">VENT CORE (-5)</button>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;margin-bottom:14px">
          <span class="sidebar-title">SYSTEM INTEGRITY</span>
          ${Object.entries(ship.systems||{}).map(([name,value])=>`<div class="system-row"><span>${name}</span><span>${value}/3 <button class="hud-btn system-repair" data-system="${name}" title="Keeper adjustment: restore 1 Integrity after resolving repair">+</button></span></div>`).join('')}
          ${ship.heatCheckPending?'<button class="hud-btn hud-btn-danger" id="resolve_overheat">Resolve overheat · Pilot DC 15</button>':''}
          <label class="hud-checkbox-label" style="margin-top:12px"><input type="checkbox" id="ship_fired" ${ship.firedThisRound?'checked':''} /> Weapons fired this round</label>
          <p class="field-help">${ship.visible?'VISIBLE · +2 to incoming attack rolls.':'Signature stable.'}</p>
        </div>
        <div class="glass-panel" style="padding:14px;margin-bottom:14px">
          <span class="sidebar-title">INCOMING NAVAL DAMAGE</span>
          <p class="field-help">Enter final damage after Mount Rating. Shields absorb points before Hull conversion. Core Ch.17.</p>
          <div class="naval-damage-form"><input id="naval_raw" class="hud-input" type="number" min="0" value="0" aria-label="Incoming naval damage" /><vf-select id="naval_arc" class="hud-select">${['fore','aft','port','starboard'].map(a=>`<option value="${a}">${a}</option>`).join('')}</vf-select>
          <vf-select id="naval_system" class="hud-select"><option value="">No declared system</option>${Object.keys(ship.systems||{}).map(n=>`<option value="${n}">${n}</option>`).join('')}</vf-select>
          <label class="hud-checkbox-label"><input type="checkbox" id="naval_critical" /> Critical hit</label></div>
          <button class="hud-btn hud-btn-danger" id="apply_naval_damage">Apply to this ship</button>
        </div>
        <!-- FTL Emergency Jump -->
        <div class="glass-panel" style="padding: 10px; margin-bottom: 12px; border-color: rgba(168, 85, 247, 0.4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-family: var(--font-hud); font-size: 10px; font-weight: 700; color: #c084fc;">QUANTUM PEARLS</span>
            <span style="font-family: var(--font-mono); font-size: 13px; font-weight: 900; color: #e9d5ff;">✦ ${ship.pearls} REMAINING</span>
          </div>
          <button class="hud-btn hud-btn-xs" id="ftl_jump_btn" style="width: 100%; background: linear-gradient(135deg, #7e22ce, #3b82f6); color: #fff; font-weight: 700; padding: 6px;">
            BURN PEARL & EMERGENCY FTL JUMP
          </button>
        </div>

        <!-- Pilot Maneuvers -->
        <div class="glass-panel" style="padding: 10px; margin-bottom: 12px;">
          <div style="font-family: var(--font-hud); font-size: 10px; font-weight: 700; color: var(--cyan-pearl); margin-bottom: 6px;">
            PILOT MANEUVERS (INSTINCT / PILOT)
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
            <button class="hud-btn hud-btn-xs maneuver-btn" data-name="Close Range" data-dc="10" data-heat="0">Close Range (DC 10)</button>
            <button class="hud-btn hud-btn-xs maneuver-btn" data-name="Evasive Pattern" data-dc="10" data-heat="0">Evasive (DC 10, +2)</button>
            <button class="hud-btn hud-btn-xs maneuver-btn" data-name="Flanking Run" data-dc="15" data-heat="0">Flank Arc (DC 15)</button>
            <button class="hud-btn hud-btn-xs maneuver-btn" data-name="Disengage" data-dc="10" data-heat="0">Disengage (DC 10)</button>
          </div>
        </div>

        <!-- Class Actions in Naval Combat -->
        <div class="glass-panel" style="padding: 10px;">
          <div style="font-family: var(--font-hud); font-size: 10px; font-weight: 700; color: var(--amber-warn); margin-bottom: 6px;">
            CREW ACTIONS IN NAVAL COMBAT (CH. 17)
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <button class="hud-btn hud-btn-xs class-action-btn" data-title="Soldier: Fire Discipline" data-desc="Enemy arc counts as 2 Slots lower, and first Hull hit adds character Proficiency. Cost: 1 Stress.">
              Soldier: Fire Discipline (1 Stress)
            </button>
            <button class="hud-btn hud-btn-xs class-action-btn" data-title="Pilot: Thread the Needle" data-desc="Cancels enemy advantage or maneuvers to any arc bypassing shield regeneration. Cost: 1 Stress.">
              Pilot: Thread the Needle (1 Stress)
            </button>
            <button class="hud-btn hud-btn-xs class-action-btn" data-title="Engineer: Overclock Systems" data-desc="Weapons fire twice or Drives move 2 bands or Shields absorb half damage. Cost: 1 Stress + 2 Heat.">
              Engineer: Overclock (1 Stress + 2 Heat)
            </button>
            <button class="hud-btn hud-btn-xs class-action-btn" data-title="Scholar: Read the Enemy" data-desc="Reveals enemy's lowest arc, internal heat status, or weapon weak point. Crew gains Advantage. Cost: 1 Stress.">
              Scholar: Read the Enemy (1 Stress)
            </button>
            <button class="hud-btn hud-btn-xs class-action-btn" data-title="Mystic: Veil-Sight" data-desc="Foresee adversary attack vector, deal 2d8 Neural directly into enemy cockpit, or restore 1 system Integrity. Cost: 1 Stress + 1 Hope.">
              Mystic: Veil-Sight (1 Stress + 1 Hope)
            </button>
          </div>
        </div>
      </div>
    `);

    this.attachEvents(ship);
    if(store.sessionRole==='player')this.container.querySelectorAll('button:not(.maneuver-btn),input,vf-select').forEach(el=>el.disabled=true);
  }

  attachEvents(ship) {
    // Hull + / -
    const hullPlus = this.container.querySelector('#ship_hull_plus');
    const hullMinus = this.container.querySelector('#ship_hull_minus');
    if (hullPlus) {
      hullPlus.onclick = () => {
        const next = Math.min(ship.maxHull, ship.hull + 1);
        this.updateShip({ hull: next });
      };
    }
    if (hullMinus) {
      hullMinus.onclick = () => {
        const next = Math.max(0, ship.hull - 1);
        this.updateShip({ hull: next });
        audio.playExplosion();
      };
    }

    // Range band clicks
    this.container.querySelectorAll('.range-band-btn').forEach(btn => {
      btn.onclick = () => {
        const band = btn.dataset.band;
        this.updateShip({ rangeBand: band });
        store.addLog({
          sender: ship.name,
          type: 'SHIP_MOVE',
          title: `Naval Range Adjusted: [${band.toUpperCase()}]`,
          details: `Tactical engagement distance set to ${band}.`
        });
        audio.playLaserShot();
      };
    });

    // Reinforce Arc
    this.container.querySelectorAll('.reinforce-arc-btn').forEach(btn => {
      btn.onclick = () => {
        const arc = btn.dataset.arc;
        const curSlots = ship.shieldArcs[arc];
        const nextHeat = ship.heat + 2;
        const updatedArcs = { ...ship.shieldArcs, [arc]: curSlots + 2 };
        this.updateShip({ shieldArcs: updatedArcs, heat: nextHeat });
        store.addLog({
          sender: ship.name,
          type: 'ENGINEER_ACTION',
          title: `Reinforced ${arc.toUpperCase()} Shield Arc`,
          details: `Armor Slots +2 (Now ${curSlots + 2}). Core heat increased +2 (Now ${nextHeat}/${ship.heatCap}).`
        });
        audio.playSparkle();
      };
    });

    // Regen Shields (End of Round)
    const regenBtn = this.container.querySelector('#regen_shields_btn');
    if (regenBtn) {
      regenBtn.onclick = () => {
        const nextArcs = {
          fore: Math.min(ship.shieldArcs.maxPerArc, ship.shieldArcs.fore + 2),
          aft: Math.min(ship.shieldArcs.maxPerArc, ship.shieldArcs.aft + 2),
          port: Math.min(ship.shieldArcs.maxPerArc, ship.shieldArcs.port + 2),
          starboard: Math.min(ship.shieldArcs.maxPerArc, ship.shieldArcs.starboard + 2),
          maxPerArc: ship.shieldArcs.maxPerArc
        };
        const nextHeat = Math.max(0, ship.heat - (ship.firedThisRound ? 0 : 1));
        this.updateShip({ shieldArcs: nextArcs, heat: nextHeat, firedThisRound:false, visible:false });
        store.addLog({
          sender: ship.name,
          type: 'ROUND_RESET',
          title: `End of Starship Round: Shields Regenerated`,
          details: `All shield arcs restored up to +2 Armor Slots. ${ship.firedThisRound?'No passive cooling: weapons fired.':'Core heat dissipated by 1.'}`
        });
        audio.playClockTick();
      };
    }

    // Cool Systems
    const coolBtn = this.container.querySelector('#cool_systems_btn');
    if (coolBtn) {
      coolBtn.onclick = () => {
        const nextHeat = Math.max(0, ship.heat - 3);
        this.updateShip({ heat: nextHeat });
        store.addLog({
          sender: ship.name,
          type: 'ENGINEER_ACTION',
          title: `Engineer: Cool Systems (-3 Heat)`,
          details: `Core thermal stress dissipated. Current Heat: ${nextHeat}/${ship.heatCap}.`
        });
        audio.playClockTick();
      };
    }

    // Vent Core
    const ventBtn = this.container.querySelector('#vent_core_btn');
    if (ventBtn) {
      ventBtn.onclick = () => {
        const nextHeat = Math.max(0, ship.heat - 5);
        this.updateShip({ heat: nextHeat, visible:true });
        store.addLog({
          sender: ship.name,
          type: 'ENGINEER_ACTION',
          title: `⚠️ EMERGENCY CORE VENT (-5 Heat)`,
          details: `Dumped 5 thermal units! Ship radiant signature is flared (VISIBLE: +2 to enemy hit rolls for 1 round).`
        });
        audio.playExplosion();
      };
    }

    // FTL Jump
    const ftlBtn = this.container.querySelector('#ftl_jump_btn');
    if (ftlBtn) {
      ftlBtn.onclick = () => {
        if (ship.pearls <= 0) {
          notify('No Quantum Pearls remaining! Jumping into the raw Veil without a Pearl is lethal.');
          return;
        }
        const nextPearls = ship.pearls - 1;
        this.updateShip({ pearls: nextPearls });
        store.addLog({
          sender: ship.name,
          type: 'FTL_JUMP',
          title: `✦ QUANTUM PEARL BURNED // EMERGENCY FTL JUMP`,
          details: `Pearl consumed in drive core. Space-time folded, emergency jump engaged. Remaining Pearls: ${nextPearls}.`
        });
        audio.playLaserShot();
      };
    }

    // Use the same canonical check and the selected pilot's real Instinct.
    this.container.querySelectorAll('.maneuver-btn').forEach(btn=>{
      btn.onclick=async()=>{
        const actor=store.getSelectedToken();if(!actor){notify('Select the pilot first.');return;}
        try{const result=await network.requestAction({type:'CHECK',actorId:actor.id,options:{traitId:'instinct',dc:Number(btn.dataset.dc),criticalChoice:'resolve'}});window.veilDiceRoller?.showResult(result);notify(`${btn.dataset.name}: ${result.outcomeTitle}. Resolve the printed maneuver effect (Core Ch.17).`);}
        catch(e){notify(e.message,'error');}
      };
    });

    const fired=this.container.querySelector('#ship_fired');if(fired)fired.onchange=()=>this.updateShip({firedThisRound:fired.checked});
    this.container.querySelectorAll('.system-repair').forEach(btn=>btn.onclick=()=>{const s=store.state.starship;this.updateShip({systems:{...s.systems,[btn.dataset.system]:Math.min(3,(s.systems[btn.dataset.system]||0)+1)}});});
    const overheat=this.container.querySelector('#resolve_overheat');if(overheat)overheat.onclick=async()=>{
      if(store.sessionRole==='player'){notify('The Keeper resolves ship damage.');return;}
      const actor=store.getSelectedToken();if(!actor){notify('Select the pilot first.');return;}
      try{const r=await network.requestAction({type:'CHECK',actorId:actor.id,options:{traitId:'instinct',dc:15,criticalChoice:'resolve'}});const s=store.state.starship,systems={...s.systems};if(!r.isCritical&&r.total<15)systems['Primary Drive']=Math.max(0,(systems['Primary Drive']||0)-1);this.updateShip({systems,heatCheckPending:false});window.veilDiceRoller?.showResult(r);}catch(e){notify(e.message,'error');}
    };
    const damage=this.container.querySelector('#apply_naval_damage');if(damage)damage.onclick=()=>{
      const raw=Number(this.container.querySelector('#naval_raw').value);if(!Number.isFinite(raw)||raw<0||raw>100000){notify('Enter a valid damage total.');return;}
      const arc=this.container.querySelector('#naval_arc').value,system=this.container.querySelector('#naval_system').value,critical=this.container.querySelector('#naval_critical').checked;
      const s=store.state.starship,left=Math.max(0,raw-s.shieldArcs[arc]);const loss=left===0?0:left<=5?1:left<=12?2:left<=20?3:left<=30?4:5+Math.floor((left-30)/10);
      const systems={...s.systems};if(critical&&loss>0&&system in systems)systems[system]=Math.max(0,systems[system]-1);
      this.updateShip({shieldArcs:{...s.shieldArcs,[arc]:Math.max(0,s.shieldArcs[arc]-raw)},hull:Math.max(0,s.hull-loss),systems});notify(`Naval hit · ${loss} Hull lost.`);
    };

    // Class Action Buttons
    this.container.querySelectorAll('.class-action-btn').forEach(btn => {
      btn.onclick = () => {
        const title = btn.dataset.title;
        const desc = btn.dataset.desc;
        store.addLog({
          sender: ship.name,
          type: 'CLASS_ACTION',
          title: `Naval Crew Action: [${title}]`,
          details: desc
        });
        audio.playSparkle();
      };
    });
  }

  updateShip(partial) {
    if(store.sessionRole==='player'){notify('Ship systems are managed by the Keeper.');return;}
    const cur=store.state.starship,updated={...cur,...partial};
    if(cur.heat<=cur.heatCap&&updated.heat>updated.heatCap){updated.systems=Object.fromEntries(Object.entries(updated.systems||{}).map(([key,value])=>[key,Math.max(0,value-1)]));updated.visible=true;updated.heatCheckPending=true;notify('Heat cap exceeded: every system loses 1 Integrity. Select the pilot and resolve Instinct DC 15.','error');}
    store._beforeTacticalMutation('Update starship');store.update({starship:updated});network.broadcast({type:'STARSHIP_UPDATE',starship:updated});
  }
}
