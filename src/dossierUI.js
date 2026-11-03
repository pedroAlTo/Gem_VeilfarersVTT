import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { store } from './state.js';
import { validateActor } from './validation.js';
import { characterDetails, exportSystemCharacter, exportNativeCharacter, downloadJSON, TRAIT_IDS } from './characterImport.js';

export function dossierDialog(title, body, className = '') {
  const previous = document.activeElement;
  const modal = document.createElement('div');
  modal.className = `veil-modal-backdrop dossier-backdrop ${className}`;
  modal.innerHTML = sanitizeHTML(`<section class="veil-modal-box dossier-modal" role="dialog" aria-modal="true" aria-label="${e(title)}"><header class="veil-modal-header"><h3>${e(title)}</h3><button class="modal-close-btn" aria-label="Cerrar">×</button></header><div class="dossier-body">${body}</div></section>`);
  const close = () => { if (modal.dataset.busy) return; modal.remove(); previous?.focus?.(); };
  modal.querySelector('.modal-close-btn').onclick = close;
  modal.onclick = event => { if (event.target === modal) close(); };
  modal.onkeydown = event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (event.key === 'Tab') {
      const items = [...modal.querySelectorAll('button, input, textarea, [tabindex="0"]')].filter(x => !x.disabled && x.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  document.body.append(modal);
  modal.querySelector('.modal-close-btn').focus();
  return modal;
}
const field = (label, key, value, type = 'text', attrs = '') => `<label class="dossier-field"><span>${e(label)}</span><input class="hud-input" name="${key}" type="${type}" value="${e(value)}" ${attrs}></label>`;
const stat = (label, key, value, min = 0, max = 10000) => field(label, key, value ?? 0, 'number', `min="${min}" max="${max}" step="1" required`);
const narrative = (title, value) => `<article class="dossier-narrative"><h4>${e(title)}</h4><p>${e(value).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')}</p></article>`;

export function openDossier(token, openSettings) {
  const pc = token.actorType === 'player' || (!token.actorType && token.isPlayer);
  const d = characterDetails(token), imported = !!token.sourceCharacter;
  const modal = dossierDialog(pc ? 'ARCHIVO DE PERSONAJE' : 'ARCHIVO DE ADVERSARIO / PNJ', `
    <div class="dossier-hero"><div class="dossier-seal"><span>${pc ? 'LVL' : 'NPC'}</span><strong>${pc ? e(token.level ?? 1) : '◇'}</strong></div><div><span class="dossier-eyebrow">${imported ? e(token.sourceCharacter.document.app + ' · ' + token.sourceCharacter.document.version) : 'ACTOR LOCAL · DATOS EDITABLES'}</span><h2>${e(token.name)}</h2><p>${e([token.species, token.characterClass, token.subclass, pc ? token.path : token.roleTag].filter(Boolean).join(' / '))}</p></div></div>
    <nav class="dossier-tabs" aria-label="Secciones de ficha"><button class="hud-btn active" data-tab="stats">Ficha</button><button class="hud-btn" data-tab="reference">Rasgos y equipo</button>${imported ? '<button class="hud-btn" data-tab="source">JSON original</button>' : ''}</nav>
    <form id="dossier_form">
      <div data-panel="stats">
        <div class="dossier-identity">${field('Nombre', 'actorName', token.name)}${field(pc ? 'Clase' : 'Rol', pc ? 'characterClass' : 'roleTag', pc ? token.characterClass || '' : token.roleTag || '')}${pc ? field('Subclase', 'subclass', token.subclass || '') : ''}${field('Ancestry / especie', 'species', token.species || '')}${pc ? field('Comunidad', 'community', token.community || '') + stat('Nivel', 'level', token.level ?? 1, 1, 100) + stat('Proficiency', 'proficiency', token.proficiency ?? 1, 1, 100) : ''}${stat('Evasion', 'evasion', token.evasion ?? 10, 0, 100)}</div>
        <div class="dossier-resources">
          ${[['hp', 'HP · disponibles'], ['armor', 'Armor · disponibles'], ['stress', 'Stress · marcado']].map(([k, label]) => `<section class="dossier-resource ${k}"><h4>${label}</h4><div>${stat('Actual', `${k}_current`, token[k]?.current)}${stat('Máximo', `${k}_max`, token[k]?.max, k === 'hp' ? 1 : 0)}</div></section>`).join('')}
          ${pc ? `<section class="dossier-resource path"><h4>${e(token.path || 'Awakened')}</h4><div>${token.path === 'Sleeping' ? stat('Effort', 'effort', token.effort, 0, token.effortMax ?? 6) + stat('Resolve', 'resolve_current', token.resolve?.current, 0, token.resolve?.max ?? 2) : stat('Hope', 'hope', token.hope, 0, token.hopeMax ?? 6)}</div></section>` : ''}
        </div>
        <div class="dossier-thresholds"><span>UMBRALES FINALES<br><small>Incluyen los ajustes de la ficha</small></span>${stat('Major', 'majorThreshold', token.hp.majorThreshold)}${stat('Severe', 'severeThreshold', token.hp.severeThreshold)}</div>
        ${pc ? `<h4 class="dossier-label">TRAITS · VALORES FINALES</h4><div class="dossier-traits">${TRAIT_IDS.map(k => stat(k, `trait_${k}`, token.traits?.[k], -100, 100)).join('')}</div>${token.path === 'Sleeping' ? `<div class="dossier-identity">${stat('Resolve máximo', 'resolve_max', token.resolve?.max, 0, 100)}${field('Dado Resolve', 'resolve_die', token.resolve?.dieType || 'd4', 'text', 'pattern="d[46]" required')}${stat('Honed Edge', 'honedEdgeBonus', token.honedEdgeBonus, 0, 100)}${field('Recovery Anchor', 'recoveryAnchor', token.recoveryAnchor || '')}</div>` : ''}` : `<h4 class="dossier-label">BLOQUE DE COMBATE</h4><div class="dossier-identity">${stat('Modificador de ataque', 'attackModifier', token.attackModifier, -100, 100)}${field('Daño (expresión completa)', 'damageExpression', token.damageExpression || '', 'text', 'placeholder="Ej.: 1d8+1 Phys + 1d4 Shock"')}${field('Alcance', 'attackRange', token.attackRange || '')}</div><p class="dossier-muted">Las expresiones y habilidades se muestran como referencia; los efectos especiales se resuelven según su texto.</p>`}
        <label class="dossier-field"><span>Notas y habilidades ${pc ? 'de la sesión' : 'del adversario'}</span><textarea class="hud-input" name="featureNotes" rows="4">${e(token.featureNotes || '')}</textarea></label>
      </div>
      <div data-panel="reference" hidden>
        ${imported ? '<p class="dossier-muted">Referencia del archivo importado. Las especializaciones, propiedades de armas y costes no se activan automáticamente.</p>' : '<p class="dossier-muted">Importa una ficha del creador para ver sus experiencias, poderes y equipo. Puedes registrar las habilidades manuales en Notas.</p>'}
        ${d.experiences.length ? `<h4 class="dossier-label">EXPERIENCIAS · ${e(token.path)}</h4><div class="dossier-experiences">${d.experiences.map(x => `<article><span>${e(x.name)}</span><strong>${e(x.bonus)}</strong></article>`).join('')}</div>` : ''}
        ${d.weapons.length ? `<h4 class="dossier-label">ARMAMENTO</h4><div class="dossier-weapons">${d.weapons.map(w => `<article><span class="dossier-eyebrow">${e(w.tier)}</span><h4>${e(w.name)}</h4><div class="weapon-damage">${e(w.damage || 'Sin daño indicado')}</div><p>${e(w.trait)}</p><p>${e(w.features)}</p></article>`).join('')}</div>` : ''}
        ${d.armor ? narrative('Armadura', d.armor) : ''}
        ${d.features.map(([k, v]) => narrative(k, v)).join('')}
        ${d.domains ? `<h4 class="dossier-label">DOMINIOS · ${e(d.domains)}</h4>` : ''}
        ${d.powers.map(p => narrative(`${p.name}${p.recall ? ' · Recall ' + p.recall : ''}`, p.description)).join('')}
        ${d.equipment.length ? `<h4 class="dossier-label">EQUIPO</h4>${d.equipment.map(x => narrative(`${x.quantity || '1'} × ${x.name} · ${x.tier}`, x.use)).join('')}` : ''}
        ${d.notes.map(([k, v]) => narrative(k, v)).join('')}
      </div>
      ${imported ? `<div data-panel="source" hidden><p class="dossier-muted">Original íntegro para consulta, incluidos campos de otras sendas. Exportar al creador conserva esos campos y actualiza los valores editables de esta ficha.</p><pre class="dossier-json">${e(JSON.stringify(token.sourceCharacter.document, null, 2))}</pre></div>` : ''}
      <p class="dossier-error" role="alert"></p>
      <footer class="dossier-footer"><button type="button" class="hud-btn" id="dossier_controls">Player controls</button><button type="button" class="hud-btn" id="dossier_token">Ajustes del token</button><button type="button" class="hud-btn" id="dossier_export">Exportar actor VTT</button>${imported ? '<button type="button" class="hud-btn" id="dossier_system">Exportar al creador</button>' : ''}<button class="hud-btn hud-btn-primary" type="submit">Guardar ficha</button></footer>
    </form>
  `);
  modal.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {
    modal.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === button));
    modal.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== button.dataset.tab; });
  });
  modal.querySelector('#dossier_controls').onclick = async () => { const { openTokenControl } = await import('./sessionLobby.js'); openTokenControl(token.id); };
  modal.querySelector('#dossier_token').onclick = () => { modal.remove(); openSettings(store.state.tokens.find(t => t.id === token.id) || token); };
  const playerView = store.sessionRole === 'player' || store.state.userRole === 'player';
  const readPlayerPatch = () => {
    const current = store.state.tokens.find(t => t.id === token.id);
    if (!current || !store.canEditToken(token.id)) throw new Error('This token is not assigned to you.');
    const form = modal.querySelector('form'), patch = {};
    for (const key of ['hp', 'armor', 'stress', 'resolve']) {
      const input = form.elements.namedItem(`${key}_current`);
      if (input && current[key] && input.value !== input.defaultValue) patch[key] = { ...current[key], current: Number(input.value) };
    }
    for (const key of ['hope', 'effort']) { const input = form.elements.namedItem(key); if (input && input.value !== input.defaultValue) patch[key] = Number(input.value); }
    validateActor({ ...current, ...patch });
    return patch;
  };
  const read = () => {
    if (playerView) { const current = store.state.tokens.find(t => t.id === token.id) || token; return { ...current, ...(store.canEditToken(token.id) ? readPlayerPatch() : {}) }; }
    const current = store.state.tokens.find(t => t.id === token.id);
    if (!current) throw new Error('Este actor ya no existe.');
    const form = modal.querySelector('form');
    if (!form.reportValidity()) throw new Error('Revisa los campos de la ficha.');
    const data = Object.fromEntries(new FormData(form)), updated = structuredClone(current);
    for (const key of ['name', 'species', 'characterClass', 'subclass', 'community', 'roleTag', 'damageExpression', 'attackRange', 'featureNotes', 'recoveryAnchor']) if (key in data) updated[key] = data[key].trim();
    if ('actorName' in data) updated.name = data.actorName.trim();
    if (!updated.name) throw new Error('El nombre no puede estar vacío.');
    for (const key of ['level', 'proficiency', 'evasion', 'hope', 'effort', 'honedEdgeBonus', 'attackModifier']) if (key in data) updated[key] = Number(data[key]);
    for (const key of ['hp', 'armor', 'stress']) updated[key] = { ...current[key], current: Number(data[`${key}_current`]), max: Number(data[`${key}_max`]) };
    for (const key of ['majorThreshold', 'severeThreshold']) updated.hp[key] = Number(data[key]);
    if (pc) {
      updated.roleTag = [updated.characterClass, updated.subclass].filter(Boolean).join(' · ');
      updated.traits = Object.fromEntries(TRAIT_IDS.map(k => [k, Number(data[`trait_${k}`])]));
      if (token.path === 'Sleeping') updated.resolve = { current: Number(data.resolve_current), max: Number(data.resolve_max), dieType: data.resolve_die };
    }
    return validateActor(updated);
  };
  const run = action => { try { action(); } catch (err) { modal.querySelector('.dossier-error').textContent = err.message; } };
  modal.querySelector('form').onsubmit = event => {
    event.preventDefault(); run(() => { store.updateToken(token.id, playerView ? readPlayerPatch() : read()); modal.remove(); notify(store.sessionRole === 'player' ? 'Cambios enviados al Keeper.' : 'Ficha guardada.'); });
  };
  modal.querySelector('#dossier_export').onclick = () => run(() => downloadJSON(exportNativeCharacter(read()), `${token.name}-VTT.json`));
  if (imported) modal.querySelector('#dossier_system').onclick = () => run(() => downloadJSON(exportSystemCharacter(read()), `${token.name}.json`));
  if (playerView) {
    modal.querySelectorAll('form input, form textarea, form vf-select, form button[type=submit], #dossier_token').forEach(el => el.disabled = true);
    if (store.canEditToken(token.id)) {
      for (const name of ['hp_current', 'armor_current', 'stress_current', 'resolve_current', 'hope', 'effort']) { const input = modal.querySelector('form').elements.namedItem(name); if (input) input.disabled = false; }
      modal.querySelector('button[type=submit]').disabled = false;
    }
  }
  return modal;
}
