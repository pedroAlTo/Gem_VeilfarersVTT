// src/spaceCombatUI.js
// PROJECT ARES — Pantalla de combate espacial 3D: barra inferior por puesto (Piloto, Artillero,
// Ingeniero, Sensores), órdenes del Capitán y turno del Keeper; modo de motor, bandas, arcos,
// Sensor Lock, resultados antes de tirar y «Spotlight usado». La escena 3D se carga con import()
// dinámico para no engordar el bundle principal.

import { escapeHTML as esc, notify } from './ui.js';
import { store } from './state.js';
import { network } from './networkManager.js';
import { audio } from './audioEngine.js';
import {
  RANGE_BANDS, SENSOR_LOCK_DC, BAND_LABEL_KM, ENGINE_MODES, MANEUVERS, ARCS,
  evasionBreakdown, weaponCanFireAtBand, hullLossFor,
} from './spaceCombatRules.js';
import {
  newCombatState, withCombatDefaults, ghostBandFor, applyManeuverResult, applySensorLock,
  advanceCombatRound, announceEngineMode, publicCombatView, newContact,
} from './spaceCombatState.js';

const STATION_LABELS = {
  captain: 'Capitán', pilot: 'Piloto', gunner: 'Artillero', engineer: 'Ingeniero', sensors: 'Sensores', keeper: 'Keeper',
};
const ARC_ES = { fore: 'Proa', starboard: 'Estribor', aft: 'Popa', port: 'Babor' };

export class SpaceCombatUI {
  constructor(container) {
    this.container = container;
    this.station = 'pilot';
    this.camera = 'orbital';
    this.selectedManeuver = 'Aggressive Approach';
    this.targetArc = 'fore';
    this.scene = null;
    this.sceneFailed = false;
    store.subscribe((state, keys) => {
      if (keys.includes('starship') || keys.includes('userRole')) this.render();
    });
    this.render();
  }

  get ship() { return withCombatDefaults(store.state.starship); }
  get combat() { return this.ship.combat; }
  get isKeeper() { return store.state.userRole === 'keeper' && store.sessionRole !== 'player'; }
  get target() { return this.combat.contacts.find((c) => c.id === this.combat.targetContactId) || this.combat.contacts[0] || null; }

  updateShip(partial) {
    const cur = store.state.starship;
    const updated = { ...cur, ...partial };
    store._beforeTacticalMutation('Update starship');
    store.update({ starship: updated });
    network.broadcast({ type: 'STARSHIP_UPDATE', starship: updated });
    return updated;
  }

  setCombat(combatPatch, shipPatch = {}) {
    const cur = store.state.starship;
    const updated = { ...cur, ...shipPatch, combat: { ...(cur.combat || newCombatState()), ...combatPatch } };
    store._beforeTacticalMutation('Update space combat');
    store.update({ starship: updated });
    network.broadcast({ type: 'STARSHIP_UPDATE', starship: updated });
  }

  render() {
    const ship = this.ship, combat = this.combat, target = this.target;
    const done = (st) => combat.stationsDone.includes(st);
    const view = this.isKeeper ? combat : publicCombatView(combat);
    const band = target?.band ?? ship.rangeBand;

    this.container.innerHTML = `
      <div class="space-combat-root">
        <div class="sc-topbar">
          <span class="sc-title">PROJECT ARES · COMBATE ESPACIAL</span>
          <span class="sc-chip">RONDA ${combat.round}</span>
          <span class="sc-chip">MOTOR: ${combat.engineMode}${ENGINE_MODES[combat.engineMode]?.heatOnAnnounce ? ` (+${ENGINE_MODES[combat.engineMode].heatOnAnnounce} CALOR)` : ''}</span>
          <span class="sc-chip">BANDA: ${band.toUpperCase()} <small>(${BAND_LABEL_KM[band]})</small></span>
          ${target ? `<span class="sc-chip ${target.sensorLock ? 'locked' : ''}">${target.sensorLock ? '⌖ SENSOR LOCK' : 'SIN LOCK'} · ${esc(target.name)}</span>` : '<span class="sc-chip">SIN CONTACTOS</span>'}
          <span style="flex:1"></span>
          <button class="hud-btn hud-btn-xs sc-cam" data-cam="orbital" ${this.camera === 'orbital' ? 'disabled' : ''}>CÁMARA ORBITAL</button>
          <button class="hud-btn hud-btn-xs sc-cam" data-cam="zenith" ${this.camera === 'zenith' ? 'disabled' : ''}>CENITAL</button>
        </div>
        <div class="sc-scene" id="sc_scene"><div class="sc-scene-fallback">${this.sceneFailed ? 'Escena 3D no disponible (sin WebGL). El HUD sigue operativo.' : 'Cargando escena…'}</div></div>
        ${this.renderStationBar(ship, combat, target, done)}
      </div>`;

    this.attachEvents(ship, combat, target);
    this.ensureScene();
  }

  renderStationBar(ship, combat, target, done) {
    const st = this.station;
    const ev = evasionBreakdown({ base: ship.evasionBase ?? 12, crew: 2, engineMode: combat.engineMode, maneuverBonus: combat.pilotEvasionModifier });
    let bar = '';
    if (st === 'pilot') {
      const m = MANEUVERS[this.selectedManeuver];
      const ghost = ghostBandFor(this.selectedManeuver, target?.band ?? ship.rangeBand);
      bar = `
        <div class="sc-preview">
          <b>${esc(this.selectedManeuver)}</b> · DC ${m.dc} · Instinct
          ${m.bandDelta ? `· la nave fantasma acaba en <b>${ghost}</b> (${BAND_LABEL_KM[ghost]})` : '· mantiene la banda'}
          ${m.gunnerBonus ? ` · +1 Artilleros` : ''}${m.evasionPenalty ? ` · −1 Evasion` : ''}${m.evasionBonus ? ` · +${m.evasionBonus} Evasion` : ''}
          ${m.exposesArc ? ` · arco declarado: <b>${ARC_ES[m.exposesArc] || 'Babor/Estribor'}</b>` : ''}
        </div>
        <div class="sc-outcomes">
          <span>Éxito: se cumple la intención.</span><span>Crítico: además, Ventaja en el próximo disparo.</span>
          <span>Fallo con Hope: banda y rumbo sin cambios.</span>
          <span>Fallo con Fear: +1 Calor y ${m.exposesArc && m.exposesArc !== 'port|starboard' ? ARC_ES[m.exposesArc] : 'el arco declarado'} queda <b>Exposed</b>${combat.engineMode === 'Overdrive' ? ' (en Overdrive: Primary Drive −1 Integrity)' : ''}.</span>
        </div>`;
    } else if (st === 'gunner') {
      const weapon = { name: 'Light Plasma', damage: '2d10', band: 'Engagement', tags: ['Energy', 'Plasma'], sensorLock: !!target?.sensorLock };
      const canFire = weaponCanFireAtBand(weapon, target?.band ?? ship.rangeBand);
      bar = `
        <div class="sc-preview">
          Light Plasma 2d10 × MR ${ship.mountRating} · arco objetivo:
          ${ARCS.map((a) => `<button class="hud-btn hud-btn-xs sc-arc ${this.targetArc === a ? 'active' : ''}" data-target-arc="${a}">${ARC_ES[a]}</button>`).join(' ')}
          ${combat.gunnerBonus ? `· +1 por ${esc('Aggressive Approach')}` : ''}${combat.advantageNextShot ? ' · VENTAJA' : ''}${target?.sensorLock ? ' · +Ventaja (lock)' : ''}
          · contra Evasion enemiga (la mesa)
        </div>
        ${!canFire.ok ? `<div class="sc-outcomes warn">⚠ ${esc(weapon.name)}: ${esc(canFire.reason)} en banda ${target?.band}. Botón desactivado.</div>` : ''}
        <div class="sc-outcomes"><span>Daño impreso × Mount Rating; primero Armor Slots del arco, resto al casco.</span><span>Crítico PJ: dados dobles, modificador una vez; sistema declarado −1 Integrity si quita casco.</span></div>`;
    } else if (st === 'engineer') {
      bar = `
        <div class="sc-preview">Calor ${ship.heat}/${ship.heatCap}. Acciones mayores: Enfriar (−3), Reforzar arco (+2 calor, +2 Slots esta ronda), Redirigir escudos (±2 entre arcos), Ventilar (−5, nave Visible 1 ronda).</div>
        <div class="sc-outcomes"><span>Si el Calor pasa del máximo: todos los sistemas −1 Integrity, Piloto tira Instinct DC 15 y la nave queda Visible.</span><span>Se disipa solo −1 al fin de ronda si no se disparó.</span></div>`;
    } else if (st === 'sensors') {
      bar = `
        <div class="sc-preview">Sensor Lock: Knowledge <b>sin modificar</b> contra DC ${SENSOR_LOCK_DC[target?.band ?? ship.rangeBand]} (${target?.band}). Uno por objetivo; da Ventaja al próximo disparo y se gasta.</div>
        <div class="sc-outcomes">${RANGE_BANDS.map((b) => `<span class="${b === (target?.band ?? ship.rangeBand) ? 'hl' : ''}">${b}: DC ${SENSOR_LOCK_DC[b]}</span>`).join(' · ')}</div>`;
    } else if (st === 'captain') {
      bar = `<div class="sc-preview">Órdenes del Capitán: sin tirada salvo una Feature del casco. Anuncia el modo de motor de la ronda y marca el objetivo.</div>`;
    } else if (st === 'keeper') {
      bar = target ? `
        <div class="sc-preview keeper">Ficha oculta a jugadores — ${esc(target.name)}: Casco ${target.hull}/${target.maxHull} · Evasion base ${target.evasionBase} · Calor ${target.heat}/${target.heatCap} · Slots ${ARCS.map((a) => `${ARC_ES[a]} ${target.armorSlots[a]}`).join(' / ')}</div>
        <div class="sc-outcomes keeper"><span>Mueve la nave como una sola entidad: una maniobra, sus armas en alcance y una acción de sistema.</span><span>Los jugadores solo ven la maniobra y los impactos.</span></div>` : '<div class="sc-preview">Sin contactos. Añade uno desde el panel del Keeper.</div>';
    }
    const stationButtons = Object.keys(STATION_LABELS)
      .filter((k) => k !== 'keeper' || this.isKeeper)
      .map((k) => `<button class="hud-btn hud-btn-xs sc-station ${st === k ? 'active' : ''}" data-station="${k}" ${done(k) && k !== 'keeper' ? 'disabled title="Spotlight usado"' : ''}>${STATION_LABELS[k]}${done(k) && k !== 'keeper' ? ' ✓' : ''}</button>`)
      .join('');
    const rollDisabled = done(st) || (st === 'gunner' && !weaponCanFireAtBand({ band: 'Engagement', tags: [] }, target?.band ?? ship.rangeBand).ok && target?.band === 'Extreme');
    return `
      <div class="sc-bar">${stationButtons}</div>
      ${bar}
      <div class="sc-actions">
        ${st === 'pilot' ? `<select class="hud-select" id="sc_maneuver">${Object.keys(MANEUVERS).map((n) => `<option ${this.selectedManeuver === n ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}
        ${this.isKeeper ? `<select class="hud-select" id="sc_engine">${Object.keys(ENGINE_MODES).map((n) => `<option ${combat.engineMode === n ? 'selected' : ''}>Motor ${n}</option>`).join('')}</select><button class="hud-btn hud-btn-xs" id="sc_announce">Anunciar motor</button>` : ''}
        ${st === 'engineer' ? `<button class="hud-btn hud-btn-xs" id="sc_cool">Enfriar (−3)</button><select class="hud-select" id="sc_reinforce">${ARCS.map((a) => `<option value="${a}">Reforzar ${ARC_ES[a]}</option>`).join('')}</select><button class="hud-btn hud-btn-xs" id="sc_reinforce_btn">+2 Slots (+2 calor)</button>` : ''}
        ${st === 'gunner' ? `<button class="hud-btn hud-btn-xs hud-btn-danger" id="sc_fire" ${rollDisabled ? 'disabled' : ''}>DISPARAR (Finesse/Knowledge + Aim)</button>` : ''}
        ${st === 'sensors' ? `<button class="hud-btn hud-btn-xs" id="sc_lock" ${rollDisabled ? 'disabled' : ''}>SENSOR LOCK (Knowledge · DC ${SENSOR_LOCK_DC[target?.band ?? ship.rangeBand]})</button>` : ''}
        ${st === 'pilot' ? `<button class="hud-btn hud-btn-xs hud-btn-primary" id="sc_roll" ${rollDisabled ? 'disabled' : ''}>TIRAR MANIOBRA · DC ${MANEUVERS[this.selectedManeuver]?.dc}</button>` : ''}
        ${this.isKeeper ? `<button class="hud-btn hud-btn-xs" id="sc_add_contact">+ Contacto</button><button class="hud-btn hud-btn-xs" id="sc_end_round">Fin de ronda</button>` : ''}
      </div>`;
  }

  attachEvents(ship, combat, target) {
    this.container.querySelectorAll('.sc-station').forEach((b) => (b.onclick = () => { this.station = b.dataset.station; this.render(); }));
    this.container.querySelectorAll('.sc-cam').forEach((b) => (b.onclick = () => { this.camera = b.dataset.cam; this.scene?.setCamera(b.dataset.cam); this.render(); }));
    this.container.querySelectorAll('[data-target-arc]').forEach((b) => (b.onclick = () => { this.targetArc = b.dataset.targetArc; this.render(); }));
    const sel = this.container.querySelector('#sc_maneuver');
    if (sel) sel.onchange = () => { this.selectedManeuver = sel.value; this.render(); };

    const roll = this.container.querySelector('#sc_roll');
    if (roll) roll.onclick = async () => {
      const actor = store.getSelectedToken();
      if (!actor) { notify('Selecciona al Piloto primero.', 'error'); return; }
      roll.disabled = true;
      try {
        const result = await network.requestAction({ type: 'CHECK', actorId: actor.id, options: { traitId: 'instinct', dc: MANEUVERS[this.selectedManeuver].dc, criticalChoice: 'resolve' } });
        window.veilDiceRoller?.showResult(result);
        const applied = applyManeuverResult(combat, ship, { maneuverName: this.selectedManeuver, total: result.total, hope: result.hope ?? result.hopeCount ?? 0, fear: result.fear ?? result.fearCount ?? 0 });
        this.setCombat(applied.combat, applied.shipPatch);
        store.addLog({ sender: ship.name, type: 'SHIP_MOVE', title: `Piloto: ${this.selectedManeuver} → ${applied.effect.outcome}`, details: applied.effect.bandChange ? `Nueva banda: ${ship.rangeBand && applied.shipPatch.rangeBand}` : 'La banda y el rumbo no cambian.' });
        audio.playLaserShot();
        notify(`${this.selectedManeuver}: ${result.outcomeTitle}. ${applied.effect.outcome === 'fear' ? 'Arco Exposed y +1 Calor.' : applied.effect.bandChange ? 'Banda actualizada.' : 'Sin cambio de banda.'}`);
      } catch (e) { notify(e.message, 'error'); } finally { if (roll.isConnected) roll.disabled = false; }
    };

    const fire = this.container.querySelector('#sc_fire');
    if (fire) fire.onclick = async () => {
      const actor = store.getSelectedToken();
      if (!actor) { notify('Selecciona al Artillero primero.', 'error'); return; }
      fire.disabled = true;
      try {
        const result = await network.requestAction({ type: 'CHECK', actorId: actor.id, options: { traitId: 'instinct', dc: 12, criticalChoice: 'resolve' } });
        window.veilDiceRoller?.showResult(result);
        this.setCombat({ stationsDone: [...new Set([...combat.stationsDone, 'gunner'])], advantageNextShot: false });
        store.addLog({ sender: ship.name, type: 'ATTACK', title: `Artillero: Light Plasma → ${ARC_ES[this.targetArc]}`, details: `2d10 × ${ship.mountRating} contra el arco ${ARC_ES[this.targetArc]} del objetivo. El Keeper absorbe Armor Slots y aplica casco.` });
      } catch (e) { notify(e.message, 'error'); }
    };

    const lock = this.container.querySelector('#sc_lock');
    if (lock) lock.onclick = async () => {
      const actor = store.getSelectedToken();
      if (!actor || !target) { notify('Selecciona al operador de Sensores y un objetivo.', 'error'); return; }
      lock.disabled = true;
      try {
        const result = await network.requestAction({ type: 'CHECK', actorId: actor.id, options: { traitId: 'knowledge', dc: SENSOR_LOCK_DC[target.band], criticalChoice: 'resolve' } });
        window.veilDiceRoller?.showResult(result);
        const applied = applySensorLock(combat, { contactId: target.id, band: target.band, total: result.total });
        this.setCombat(applied.combat);
        notify(applied.locked ? '⌖ Sensor Lock conseguido.' : 'Sin lock.');
      } catch (e) { notify(e.message, 'error'); } finally { if (lock.isConnected) lock.disabled = false; }
    };

    const cool = this.container.querySelector('#sc_cool');
    if (cool) cool.onclick = () => { this.updateShip({ heat: Math.max(0, ship.heat - 3) }); this.setCombat({ stationsDone: [...new Set([...combat.stationsDone, 'engineer'])] }); };
    const reinforce = this.container.querySelector('#sc_reinforce_btn');
    if (reinforce) reinforce.onclick = () => {
      const arc = this.container.querySelector('#sc_reinforce').value;
      const max = ship.shieldArcs.maxPerArc ?? 4;
      this.updateShip({ shieldArcs: { ...ship.shieldArcs, [arc]: Math.min(max + 2, (ship.shieldArcs[arc] || 0) + 2) }, heat: ship.heat + 2 });
      this.setCombat({ stationsDone: [...new Set([...combat.stationsDone, 'engineer'])] });
    };

    const announce = this.container.querySelector('#sc_announce');
    if (announce) announce.onclick = () => {
      const mode = this.container.querySelector('#sc_engine').value.replace('Motor ', '');
      const applied = announceEngineMode(combat, ship, mode);
      this.setCombat(applied.combat, applied.shipPatch);
      store.addLog({ sender: ship.name, type: 'ENGINE_ACTION', title: `Motor anunciado: ${mode}`, details: `Evasion +${ENGINE_MODES[mode].evasion}, maniobras +${ENGINE_MODES[mode].maneuver}, ${ENGINE_MODES[mode].heatOnAnnounce} Calor al anunciarlo.` });
    };
    const addContact = this.container.querySelector('#sc_add_contact');
    if (addContact) addContact.onclick = () => {
      const c = newContact({ name: `Contacto ${(combat.contacts.length + 1)}`, band: 'Standard' });
      this.setCombat({ contacts: [...combat.contacts, c], targetContactId: combat.targetContactId || c.id, active: true });
    };
    const end = this.container.querySelector('#sc_end_round');
    if (end) end.onclick = () => {
      const applied = advanceCombatRound(combat, ship);
      this.setCombat(applied.combat, applied.shipPatch);
      nextSpotlightSafe();
      audio.playClockTick();
      store.addLog({ sender: ship.name, type: 'ROUND_RESET', title: `Fin de ronda ${combat.round}`, details: '+2 Armor Slots por arco; efectos caducados; banda y orientación actualizadas.' });
    };
  }

  async ensureScene() {
    if (this.scene || this.sceneFailed) { this.scene?.render(this.viewPayload()); return; }
    const host = this.container.querySelector('#sc_scene');
    if (!host) return;
    try {
      const { mountSpaceScene } = await import('./spaceScene3d.js'); // lazy: no engorda el bundle
      if (!host.isConnected) return;
      this.scene = await mountSpaceScene(host, this.viewPayload());
      host.querySelector('.sc-scene-fallback')?.remove();
    } catch (e) {
      this.sceneFailed = true;
      const fb = host.querySelector('.sc-scene-fallback');
      if (fb) fb.textContent = 'Escena 3D no disponible en este dispositivo. El HUD táctico sigue operativo.';
    }
  }

  viewPayload() {
    const ship = this.ship;
    return {
      starship: ship,
      combat: this.isKeeper ? this.combat : publicCombatView(this.combat),
      isKeeper: this.isKeeper,
      ghostBand: this.station === 'pilot' ? ghostBandFor(this.selectedManeuver, this.target?.band ?? ship.rangeBand) : null,
      highlightArc: this.station === 'pilot' ? (MANEUVERS[this.selectedManeuver]?.exposesArc === 'port|starboard' ? null : 'fore') : null,
      targetArcByGunner: this.station === 'gunner' ? this.targetArc : null,
    };
  }
}

function nextSpotlightSafe() {
  import('./combatState.js').then(({ nextSpotlightRound }) => { try { nextSpotlightRound(store); } catch (_) {} }).catch(() => {});
}
