// The drone console: build a drone from a Grade and Modules (Corebook ch. 14), and run it at
// the table (signal, link mode, Lost protocol, operator, modules offline, complications).
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { store } from './state.js';
import { network } from './networkManager.js';
import { validateActor } from './validation.js';
import { DRONE_GRADES, DRONE_MODULES, DRONE_SAMPLE_BUILDS, SIGNAL_STATES, LINK_MODES, LOST_PROTOCOLS, droneBuild, droneTokenData, rollDroneComplication, worsenSignal } from './drones.js';

const GRADE_LABEL = { common: 'Common', military: 'Military', experimental: 'Experimental' };
const options = (map, selected) => Object.entries(map).map(([id, item]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${e(item.name)}</option>`).join('');

export function openDroneConsole(tokenId = null) {
  const token = tokenId ? store.state.tokens.find(t => t.id === tokenId) : null;
  if (tokenId && !token) return null;
  if (token && !store.canEditToken(token.id)) { notify('Solo el Keeper o quien controla el dron puede configurarlo.', 'error'); return null; }
  const state = {
    grade: token?.drone?.grade || 'common', modules: [...(token?.drone?.modules || [])], offline: [...(token?.drone?.offline || [])],
    illegalMods: !!token?.drone?.illegalMods, weaponUnlocked: !!token?.drone?.weaponUnlocked,
  };
  const operators = store.state.tokens.filter(t => t.isPlayer !== false && t.actorType !== 'drone');
  const legacy = token && !token.drone;
  const modal = dossierDialog(token ? `DRON · ${token.name}` : 'NUEVO DRON', `
    <form id="drone_console" class="drone-console">
      ${legacy ? '<p class="dossier-error">Este dron se creó con una plantilla antigua que no seguía el Corebook. Elige su Grado y sus módulos: al guardar se ajustan HP, Evasion, umbrales y Armor Slots a los del libro.</p>' : ''}
      <p class="dossier-muted">Un dron es equipo, no un personaje: no da Spotlights extra y lo maneja su operador con su propia Acción y su propia tirada (Corebook, cap. 14). Su <strong>Grado</strong> es el chasis; sus <strong>Módulos</strong>, lo que sabe hacer.</p>
      <div class="dossier-identity">
        <label class="dossier-field"><span>Nombre</span><input class="hud-input" name="drone_name" maxlength="80" required value="${e(token?.name || 'Cheap Scout Mote')}" /></label>
        <label class="dossier-field"><span>Configuración de ejemplo del libro</span><select class="hud-select" name="drone_sample">${token ? '<option value="">— Configuración actual —</option>' : ''}${DRONE_SAMPLE_BUILDS.map(b => `<option value="${b.id}">${e(b.name)} · ${GRADE_LABEL[b.grade]}</option>`).join('')}<option value="custom">A medida</option></select></label>
        <label class="dossier-field"><span>Grado (chasis)</span><select class="hud-select" name="drone_grade">${Object.values(DRONE_GRADES).map(g => `<option value="${g.id}">${e(g.name)} · Tier ${g.tier} · ${g.cost} Cr</option>`).join('')}</select></label>
      </div>
      <p class="dossier-muted" data-drone-use></p>
      <section class="drone-summary" data-drone-summary aria-live="polite"></section>
      <h4 class="dossier-label">SEÑAL Y CONTROL</h4>
      <div class="dossier-identity">
        <label class="dossier-field"><span>Operador</span><select class="hud-select" name="drone_operatorId"><option value="">Sin asignar</option>${operators.map(o => `<option value="${e(o.id)}" ${o.id === token?.drone?.operatorId ? 'selected' : ''}>${e(o.name)}</option>`).join('')}</select></label>
        <label class="dossier-field"><span>Señal</span><select class="hud-select" name="drone_signal">${options(SIGNAL_STATES, token?.drone?.signal || 'stable')}</select></label>
        <label class="dossier-field"><span>Enlace</span><select class="hud-select" name="drone_linkMode">${options(LINK_MODES, token?.drone?.linkMode || 'rf')}</select></label>
        <label class="dossier-field"><span>Protocolo si la señal se pierde</span><select class="hud-select" name="drone_protocol">${options(LOST_PROTOCOLS, token?.drone?.protocol || 'freeze')}</select></label>
      </div>
      <p class="dossier-muted" data-drone-signal></p>
      ${token ? '<div class="drone-actions"><button type="button" class="hud-btn" data-drone-complication title="Como mucho una vez por dron y escena, tras un Failure with Fear del operador en una tirada que implique al dron">Tirar Drone Complication (d12)</button><span class="dossier-muted" data-drone-complication-result></span></div>' : ''}
      <h4 class="dossier-label">MÓDULOS <span data-drone-slots></span></h4>
      <div class="dossier-identity">
        <label class="dossier-field"><span>Buscar módulo</span><input class="hud-input" type="search" name="drone_search" placeholder="Nombre, efecto o categoría" /></label>
        <label class="dossier-field"><span>Mostrar</span><select class="hud-select" name="drone_filter"><option value="fit">Los que admite este Grado</option><option value="installed">Solo instalados</option><option value="all">Todos (incluye modificaciones ilegales)</option></select></label>
      </div>
      <label class="drone-check"><input type="checkbox" name="drone_illegalMods" ${state.illegalMods ? 'checked' : ''} /> Modificación ilegal ya resuelta en mesa: permite módulos de un Grado superior al del chasis</label>
      <label class="drone-check"><input type="checkbox" name="drone_weaponUnlocked" ${state.weaponUnlocked ? 'checked' : ''} /> Bloqueo de armas letales anulado (procedimiento Weaponized Common Drones)</label>
      <div class="drone-modules" data-drone-modules></div>
      <p class="dossier-error" role="alert"></p>
      <footer class="dossier-footer"><button class="hud-btn hud-btn-primary" type="submit">${token ? 'Guardar dron' : 'Desplegar dron en la escena'}</button></footer>
    </form>`, 'drone-dialog');
  const form = modal.querySelector('form'), q = selector => modal.querySelector(selector);
  form.elements.drone_grade.value = state.grade;

  const build = () => droneBuild({ grade: state.grade, modules: state.modules, illegalMods: state.illegalMods, weaponUnlocked: state.weaponUnlocked });
  const renderModules = () => {
    const text = form.elements.drone_search.value.trim().toLowerCase(), filter = form.elements.drone_filter.value;
    const rank = { common: 0, military: 1, experimental: 2 };
    const shown = DRONE_MODULES.filter(m => {
      if (filter === 'installed' && !state.modules.includes(m.id)) return false;
      if (filter === 'fit' && rank[m.grade] > rank[state.grade] && !state.modules.includes(m.id)) return false;
      return !text || [m.name, m.effect, m.group, m.grade, m.source].join(' ').toLowerCase().includes(text);
    });
    const groups = new Map();
    for (const m of shown) { const key = `${GRADE_LABEL[m.grade]} · ${m.group}`; groups.set(key, [...(groups.get(key) || []), m]); }
    q('[data-drone-modules]').innerHTML = sanitizeHTML(shown.length ? [...groups].map(([title, list]) => `<fieldset class="drone-group"><legend>${e(title)}</legend>${list.map(m => {
      const on = state.modules.includes(m.id), off = state.offline.includes(m.id);
      return `<div class="drone-module ${on ? 'selected' : ''}"><label><input type="checkbox" data-module="${e(m.id)}" ${on ? 'checked' : ''} /><span><strong>${e(m.name)}</strong> <em>${m.slots} Slot${m.slots === 1 ? '' : 's'} · ${m.cost} Cr · ${e(m.source)}</em><small>${e(m.effect)}</small></span></label>${on && token ? `<label class="drone-offline"><input type="checkbox" data-offline="${e(m.id)}" ${off ? 'checked' : ''} /> Offline</label>` : ''}</div>`;
    }).join('')}</fieldset>`).join('') : '<p class="dossier-muted">Ningún módulo coincide con la búsqueda.</p>');
  };
  const renderSummary = () => {
    let b; try { b = build(); } catch (error) { q('[data-drone-summary]').textContent = error.message; return null; }
    const cell = (label, value) => `<div><span>${label}</span><strong>${e(String(value))}</strong></div>`;
    q('[data-drone-summary]').innerHTML = sanitizeHTML(`
      <div class="drone-stats">${cell('HP', b.hp)}${cell('Evasion', b.evasion)}${cell('Major / Severe', `${b.major} / ${b.severe}`)}${cell('Armor Slots', b.armor)}${cell('Module Slots', `${b.slotsUsed} / ${b.slots}`)}${cell('Coste', `${b.cost} Cr`)}${cell('Burden', b.frame.burden)}${cell('Movimiento', b.movement.join(', '))}</div>
      ${b.weapons.length ? `<p class="dossier-muted">Armas: ${b.weapons.map(w => `${e(w.name)}${w.damage ? ` (${e(w.damage)})` : ''} · ${e(w.range)}`).join('; ')}. El daño de un dron no escala con Proficiency; atacar gasta la Acción del operador.</p>` : ''}
      ${b.errors.map(x => `<p class="dossier-error">${e(x)}</p>`).join('')}${b.notes.map(x => `<p class="dossier-muted">▸ ${e(x)}</p>`).join('')}`);
    q('[data-drone-slots]').textContent = `· ${b.slotsUsed} / ${b.slots} Slots`;
    q('[data-drone-signal]').textContent = `${SIGNAL_STATES[form.elements.drone_signal.value].effect} ${LINK_MODES[form.elements.drone_linkMode.value].effect} Protocolo: ${LOST_PROTOCOLS[form.elements.drone_protocol.value].effect}`;
    return b;
  };
  const refresh = () => { renderSummary(); renderModules(); };
  const applySample = () => {
    const sample = DRONE_SAMPLE_BUILDS.find(b => b.id === form.elements.drone_sample.value);
    q('[data-drone-use]').textContent = sample ? sample.use : '';
    if (!sample) return;
    state.grade = sample.grade; state.modules = [...sample.modules]; state.offline = [];
    form.elements.drone_grade.value = sample.grade;
    if (!token || form.elements.drone_name.value === token.name) form.elements.drone_name.value = sample.name;
  };

  form.elements.drone_sample.onchange = () => { applySample(); refresh(); };
  form.elements.drone_grade.onchange = () => { state.grade = form.elements.drone_grade.value; refresh(); };
  form.elements.drone_search.oninput = renderModules; form.elements.drone_filter.onchange = renderModules;
  for (const name of ['signal', 'linkMode', 'protocol']) form.elements['drone_' + name].onchange = renderSummary;
  for (const name of ['illegalMods', 'weaponUnlocked']) form.elements['drone_' + name].onchange = () => { state[name] = form.elements['drone_' + name].checked; refresh(); };
  q('[data-drone-modules]').onchange = event => {
    const id = event.target.dataset.module, offline = event.target.dataset.offline;
    if (id) { state.modules = event.target.checked ? [...state.modules, id] : state.modules.filter(x => x !== id); if (!event.target.checked) state.offline = state.offline.filter(x => x !== id); if (form.elements.drone_sample.value && form.elements.drone_sample.value !== 'custom') form.elements.drone_sample.value = token ? '' : 'custom'; refresh(); }
    if (offline) state.offline = event.target.checked ? [...new Set([...state.offline, offline])] : state.offline.filter(x => x !== offline);
  };

  const complication = q('[data-drone-complication]');
  if (complication) complication.onclick = () => {
    const live = store.state.tokens.find(t => t.id === token.id); if (!live) return;
    const result = rollDroneComplication(), patch = {};
    const signal = form.elements.drone_signal.value;
    if (result.roll === 1) form.elements.drone_signal.value = worsenSignal(signal);
    if (result.roll === 2) form.elements.drone_signal.value = signal === 'lost' ? 'lost' : 'unstable';
    if (result.roll === 4) form.elements.drone_signal.value = 'lost';
    if (result.roll === 7) patch.hp = { ...live.hp, current: Math.max(0, live.hp.current - 1) };
    if (form.elements.drone_signal.value !== signal && live.drone) patch.drone = { ...live.drone, signal: form.elements.drone_signal.value };
    if (Object.keys(patch).length) store.updateToken(live.id, patch);
    q('[data-drone-complication-result]').textContent = `d12 [${result.roll}] · ${result.text}`;
    store.addLog({ type: 'ROLL', sender: live.name, title: `Drone Complication · ${live.name}`, details: `d12 [${result.roll}] · ${result.text}` });
    renderSummary();
  };

  form.onsubmit = event => {
    event.preventDefault();
    const error = q('form > .dossier-error[role="alert"]');
    try {
      const b = build();
      if (b.errors.length) throw new Error(b.errors[0]);
      const name = form.elements.drone_name.value.trim() || 'Dron';
      const live = token ? store.state.tokens.find(t => t.id === token.id) : null;
      const data = droneTokenData(b, { previous: live, signal: form.elements.drone_signal.value, linkMode: form.elements.drone_linkMode.value, protocol: form.elements.drone_protocol.value, operatorId: form.elements.drone_operatorId.value, illegalMods: state.illegalMods, weaponUnlocked: state.weaponUnlocked });
      data.drone.offline = state.offline.filter(id => data.drone.modules.includes(id));
      if (live) {
        // A refit keeps what the table added by hand (extra weapons or items) next to the modules.
        const previousInventory = live.inventory || { weapons: [], items: [] };
        const keptWeapons = (previousInventory.weapons || []).filter(w => !DRONE_MODULES.some(m => m.id === w.id) && live.drone);
        const keptItems = (previousInventory.items || []).filter(i => !String(i.id).startsWith('mod_') && live.drone);
        data.inventory = { weapons: [...data.inventory.weapons, ...keptWeapons], items: [...data.inventory.items, ...keptItems] };
        store.updateToken(live.id, validateActor({ ...live, ...data, name }));
        notify(`Dron "${name}" actualizado.`);
      } else {
        const canvas = window.veilCanvas, center = canvas?.screenToWorld?.(canvas.displayWidth / 2, canvas.displayHeight / 2) || { x: 500, y: 500 };
        const member = store.state.memberId || store.state.peerId || 'keeper';
        const created = store.addToken({ ...data, name, avatarUrl: '/assets/tokens/synthetic_infiltrator_echo.jpg', visionAngle: 90, fov: 90, facingAngle: 0, ownerId: '', controllerIds: member !== 'keeper' ? [member] : [], ...center });
        if (!created) throw new Error('No se pudo crear el dron.');
        store.update({ selectedTokenId: created.id });
        network.broadcast?.({ type: 'TOKEN_ADD', token: created });
        network.syncAll?.();
        notify(`Dron "${created.name}" desplegado.`);
      }
      modal.remove();
    } catch (problem) { error.textContent = problem.message; }
  };

  if (!token) applySample();
  refresh();
  return modal;
}
