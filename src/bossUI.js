import { store } from './state.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, notify } from './ui.js';
import { validateActor } from './validation.js';
import { isKeeper, validateBoss, applyBossStats, advanceBoss, phaseReady } from './encounterRules.js';
import { CONDITIONS } from './conditions.js';

const triggers = { hp0: 'HP llega a 0', hpPercent: 'Umbral de HP (%)', armor0: 'Armor llega a 0', clock: 'Reloj completo', objective: 'Objetivo / disparador narrativo' };
const statLabels = { hp: 'HP de la nueva reserva', armor: 'Armor disponible', stress: 'Stress máximo (empieza en 0)', evasion: 'Evasion', attackModifier: 'Ataque', majorThreshold: 'Major', severeThreshold: 'Severe' };
const select = (name, values, selected) => `<vf-select class="hud-select" data-key="${name}">${Object.entries(values).map(([key, label]) => `<option value="${e(key)}" ${key === selected ? 'selected' : ''}>${e(label)}</option>`).join('')}</vf-select>`;
const blank = token => ({ name: 'Nuevo estado', trigger: 'hp0', hpMode: 'pool', stats: { hp: token.hp.max }, notes: '', transition: '' });

export async function openBossEditor(tokenId, catalog) {
  if (!isKeeper(store.state, store.sessionRole)) return;
  const profiles = catalog ?? (await import('virtual:veil-encounters')).default.bosses;
  let token = store.state.tokens.find(t => t.id === tokenId);
  if (!token || token.isPlayer || token.actorType === 'player' || !isKeeper(store.state, store.sessionRole)) return;
  let draft = structuredClone(token.boss || { index: 0, states: [{ ...blank(token), name: 'Estado inicial' }, { ...blank(token), name: 'Desesperación' }] });
  let source = token.boss?.sourceText || '';
  const initialIndex = token.boss?.index ?? 0;
  const modal = dossierDialog('Boss · estados y escalada', `
    <span class="dossier-eyebrow">SOLO / LEADER · KEEPER’S COMPANION</span><h2>${e(token.name)}</h2>
    <div data-live></div><hr>
    <div class="encounter-toolbar"><label class="dossier-field">Perfil de referencia<vf-select class="hud-select" data-template><option value="">Personalizado</option>${profiles.map(p => `<option value="${p.id}">${e(p.name)}</option>`).join('')}</vf-select></label><button class="hud-btn" data-load>Cargar perfil</button></div>
    <p class="dossier-muted">Los valores vacíos heredan la ficha actual. Una reserva nueva sustituye HP; una transición por porcentaje conserva los HP restantes. Revisa los disparadores, objetivos e inmunidades del texto antes de guardar.</p>
    <details class="encounter-source"><summary>Procedimiento y texto de transición del perfil</summary><div class="encounter-source-text" data-reference></div></details>
    <form data-boss-form><div class="encounter-grid"><label class="dossier-field">Nombre del boss<input class="hud-input" data-boss-name value="${e(token.name)}" maxlength="300" required></label><label class="dossier-field">Rol<vf-select class="hud-select" data-boss-role><option value="Solo">Solo</option><option value="Leader" ${/Leader/i.test(token.roleTag || '') ? 'selected' : ''}>Leader</option></vf-select></label></div><p class="dossier-muted">Ficha base que se hereda donde el perfil no da una cifra: ataque ${e(token.attackModifier ?? 0)}, Evasion ${e(token.evasion)}, Major ${e(token.hp.majorThreshold)}, Severe ${e(token.hp.severeThreshold)}, Armor ${e(token.armor?.max ?? 0)}, Stress ${e(token.stress?.max ?? 0)}. Puedes ajustar cada cifra en sus estados.</p><div data-states></div><button type="button" class="hud-btn" data-add>+ Añadir estado</button>
      <footer class="encounter-footer"><label><input type="checkbox" data-start ${token.boss ? '' : 'checked'}> Aplicar ahora las estadísticas del estado inicial (reinicia sus recursos impresos)</label>
      <button class="hud-btn hud-btn-primary" type="submit">Guardar estados</button></footer></form>
    <p class="dossier-error" role="alert"></p>`, 'encounter-dialog');
  const q = s => modal.querySelector(s);
  const error = action => { try { action(); q('.dossier-error').textContent = ''; } catch (err) { q('.dossier-error').textContent = err.message; } };
  function readDraft() {
    draft.states = [...q('[data-states]').children].map(section => {
      const value = key => section.querySelector(`[data-key="${key}"]`)?.value;
      const phase = { ...draft.states[[...q('[data-states]').children].indexOf(section)], name: value('name').trim(), defeat: value('defeat'), clearMode: value('clearMode'), trigger: value('trigger'), hpMode: value('hpMode'), threshold: Number(value('threshold')), clockId: value('clockId'), transition: value('transition'), notes: value('notes'), stats: {} };
      for (const key of Object.keys(statLabels)) if (value(key) !== '') phase.stats[key] = Number(value(key));
      if (value('damageExpression').trim()) phase.stats.damageExpression = value('damageExpression').trim();
      return phase;
    });
    return draft;
  }
  function renderStates() {
    q('[data-reference]').textContent = source || 'Configuración propia del Keeper. Corebook 12.06: la fase final concede 3 Fear en lugar de 2; máximo 12. Al cambiar de fase se eliminan las condiciones negativas. Pausa el Spotlight, narra y aplica únicamente la interrupción indicada en la ficha.';
    q('[data-states]').innerHTML = draft.states.map((phase, index) => `<details class="boss-state" ${index === draft.index ? 'open' : ''}>
      <summary>ESTADO ${index + 1} · ${e(phase.name)}${index === draft.states.length - 1 ? ' · FINAL (+3 FEAR)' : index ? ' · +2 FEAR' : ''}</summary>
      <div class="encounter-grid">
        <label class="dossier-field">Nombre<input class="hud-input" data-key="name" value="${e(phase.name)}" maxlength="300" required></label>
        <label class="dossier-field">Entrada al estado${select('trigger', triggers, phase.trigger)}</label>
        <label class="dossier-field">HP al entrar${select('hpMode', { pool: 'Nueva reserva de HP', keep: 'Conservar HP actual y máximo' }, phase.hpMode)}</label>
        <label class="dossier-field" data-threshold>Porcentaje de HP<input type="number" class="hud-input" data-key="threshold" min="1" max="99" value="${phase.threshold ?? 50}"></label>
        <label class="dossier-field" data-clock>Reloj${select('clockId', Object.fromEntries([['', 'Elige un reloj'], ...(store.state.clocks || []).map(c => [c.id, c.title])]), phase.clockId)}</label>
        ${Object.entries(statLabels).map(([key, label]) => `<label class="dossier-field">${label}<input class="hud-input" type="number" data-key="${key}" min="${key === 'attackModifier' ? -100 : ['hp','majorThreshold','severeThreshold'].includes(key) ? 1 : 0}" max="${['evasion','attackModifier'].includes(key) ? 100 : 10000}" step="1" value="${phase.stats[key] ?? ''}" placeholder="Heredar ficha"></label>`).join('')}
        <label class="dossier-field">Derrota en estado final${select('defeat', { hp0: 'Al llegar a 0 HP', objective: 'Objetivo final (confirmación del Keeper)' }, phase.defeat || 'hp0')}</label>
        <label class="dossier-field">Condiciones al entrar${select('clearMode', { negative: 'Limpiar condiciones negativas', choose: 'Elegir según el procedimiento impreso' }, phase.clearMode || 'negative')}</label>
        <label class="dossier-field">Expresión de daño<input class="hud-input" data-key="damageExpression" value="${e(phase.stats.damageExpression || '')}" placeholder="Heredar ficha"></label>
      </div><label class="dossier-field">Narración / disparador completo<textarea class="hud-input" rows="3" data-key="transition" maxlength="10000">${e(phase.transition || '')}</textarea></label>
      <label class="dossier-field">Habilidades de este estado<textarea class="hud-input" rows="4" data-key="notes" maxlength="20000">${e(phase.notes || '')}</textarea></label>
      <button type="button" class="hud-btn hud-btn-danger" data-remove="${index}" ${draft.states.length <= 2 ? 'disabled' : ''}>Eliminar estado</button></details>`).join('');
    q('[data-add]').disabled = draft.states.length >= 8;
    q('[data-states]').querySelectorAll('.boss-state').forEach(section => {
      const updateFields = () => {
        const trigger = section.querySelector('[data-key=trigger]').value;
        section.querySelector('[data-threshold]').hidden = trigger !== 'hpPercent';
        section.querySelector('[data-clock]').hidden = trigger !== 'clock';
        const hp = section.querySelector('[data-key=hp]'); hp.disabled = section.querySelector('[data-key=hpMode]').value === 'keep';
        hp.required = !hp.disabled;
      };
      section.querySelector('[data-key=trigger]').onchange = () => { if (section.querySelector('[data-key=trigger]').value === 'hpPercent') section.querySelector('[data-key=hpMode]').value = 'keep'; updateFields(); };
      section.querySelector('[data-key=hpMode]').onchange = updateFields; updateFields();
    });
    q('[data-states]').querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { readDraft(); if (+b.dataset.remove <= draft.index && token.boss) { q('.dossier-error').textContent = 'No elimines un estado activo o ya superado.'; return; } draft.states.splice(+b.dataset.remove, 1); renderStates(); });
  }
  function renderLive() {
    token = store.state.tokens.find(t => t.id === tokenId);
    const boss = token?.boss, current = boss?.states[boss.index], next = boss?.states[boss.index + 1];
    if (!current) { q('[data-live]').innerHTML = '<p class="dossier-muted">Configura los estados para convertir este adversario en boss.</p>'; return; }
    const custom = (token.conditions || []).filter(name => next?.clearMode === 'choose' || !CONDITIONS.some(c => c.name === name));
    q('[data-live]').innerHTML = `<article class="encounter-feature"><span class="dossier-eyebrow">ENCUENTRO EN CURSO · FEAR ${store.state.fear} / 12</span><h3>${boss.index + 1} / ${boss.states.length} · ${e(current.name)}</h3><p class="encounter-source-text">${e(current.notes || '')}</p>
      ${next ? `<h4>Siguiente: ${e(next.name)}</h4><p>${e(triggers[next.trigger])}${next.trigger === 'hpPercent' ? ' · ' + next.threshold + '%' : ''}</p><p class="encounter-source-text">${e(next.transition || '')}</p>
      ${next.trigger === 'objective' ? '<label><input type="checkbox" data-objective> Confirmo que se ha cumplido el objetivo / disparador impreso</label>' : ''}
      ${boss.requiresTiming ? '<label><input type="checkbox" data-timing> Ha llegado el Spotlight de transición indicado en el perfil</label>' : ''}
      ${custom.length ? '<p>Elige las condiciones que el cambio de estado permite eliminar:</p>' + custom.map(c => `<label><input type="checkbox" data-clear="${e(c)}">${e(c)}</label>`).join('') : ''}
      <button class="hud-btn hud-btn-primary" data-advance ${next.trigger !== 'objective' && !phaseReady(token, store.state.clocks) ? 'disabled' : ''}>Pausar Spotlight y pasar a ${e(next.name)} · +${boss.index + 1 === boss.states.length - 1 ? 3 : 2} Fear</button>` : boss.defeated ? '<p>Objetivo final resuelto · boss derrotado.</p>' : current.defeat === 'objective' ? '<label><input type="checkbox" data-final-confirm> Se ha cumplido el objetivo final impreso</label><button class="hud-btn" data-finish>Marcar boss derrotado</button>' : '<p>Estado final. El boss se derrota al llegar a 0 HP.</p>'}</article>`;
    if (q('[data-finish]')) q('[data-finish]').onclick = () => error(() => { if (!q('[data-final-confirm]').checked) throw new Error('Confirma el objetivo final.'); if (!isKeeper(store.state, store.sessionRole)) throw new Error('Solo el Keeper puede resolver el encuentro.'); const live = store.state.tokens.find(t => t.id === tokenId); if (live?.boss?.index !== boss.index) throw new Error('La fase ha cambiado.'); store.updateToken(tokenId, { boss: { ...live.boss, defeated: true } }); });
    const advance = q('[data-advance]');
    if (advance) advance.onclick = () => error(() => {
      const patch = advanceBoss(store.state, store.sessionRole, tokenId, boss.index, { objectiveConfirmed: !!q('[data-objective]')?.checked, timingConfirmed: !!q('[data-timing]')?.checked, clearCustom: [...modal.querySelectorAll('[data-clear]:checked')].map(x => x.dataset.clear) });
      store._beforeTacticalMutation('Transición de boss'); store.update(patch); modal.remove(); openBossEditor(tokenId, profiles);
      notify('Nueva fase. Narra la transición y resuelve las habilidades impresas.');
    });
  }
  q('[data-load]').onclick = () => error(() => {
    const profile = profiles.find(p => p.id === q('[data-template]').value);
    if (!profile) throw new Error('Elige un perfil de referencia.');
    draft = { index: 0, profileId: profile.id, requiresTiming: profile.requiresTiming, states: structuredClone(profile.states) };
    q('[data-boss-name]').value = profile.name.replace(/ ENCOUNTER TYPE:.*/, '');
    source = profile.source + '\n\n' + profile.text;
    // Unprinted statistics stay blank and explicitly inherit this adversary's base sheet.
    for (const phase of draft.states) phase.transition ||= profile.trigger || 'Consulta y confirma el disparador impreso del perfil.';
    q('[data-start]').checked = true; renderStates();
  });
  q('[data-add]').onclick = () => { readDraft(); if (draft.states.length < 8) draft.states.push(blank(token)); renderStates(); };
  q('[data-boss-form]').onsubmit = event => { event.preventDefault(); error(() => {
    if (!isKeeper(store.state, store.sessionRole)) throw new Error('Solo el Keeper puede editar estados.');
    const current = store.state.tokens.find(t => t.id === tokenId);
    if (!current || (current.boss?.index ?? 0) !== initialIndex) throw new Error('El boss ha cambiado. Reabre su ficha.');
    readDraft(); draft.sourceText = source;
    const start = q('[data-start]').checked; draft.index = start ? 0 : current.boss?.index ?? 0;
    validateBoss(draft);
    // Validate inherited thresholds for every phase before saving the encounter.
    let preview = current; for (const phase of draft.states) preview = validateActor(applyBossStats(preview, phase));
    const updated = start ? applyBossStats(current, draft.states[0]) : structuredClone(current);
    updated.name = q('[data-boss-name]').value.trim(); updated.roleTag = 'Boss · ' + q('[data-boss-role]').value;
    updated.boss = draft; validateActor(updated); store.updateToken(tokenId, updated); modal.remove(); openBossEditor(tokenId, profiles);
    notify('Estados del boss guardados.');
  }); };
  renderStates(); renderLive();
  const unsubscribe = store.subscribe((_, keys) => { if (modal.isConnected && keys.some(k => ['tokens','clocks','fear'].includes(k))) renderLive(); });
  const observer = new MutationObserver(() => { if (!modal.isConnected) { unsubscribe(); observer.disconnect(); } }); observer.observe(document.body, { childList: true });
  return modal;
}
