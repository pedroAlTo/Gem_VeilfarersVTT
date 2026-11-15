// Character creator wizard of the VTT. The rules live in creatorModel.js; this file is
// only the nine-step dialog and what happens with the finished sheet.
import { escapeHTML as e, notify } from '../ui.js';
import { store } from '../state.js';
import { newId } from '../persistence.js';
import { dossierDialog } from '../dossierUI.js';
import { parseCharacterJSON, downloadJSON } from '../characterImport.js';
import { account } from '../cloudAccount.js';
import {
  CREATOR_STEPS, TRAIT_IDS, TRAIT_ARRAY, EQUIP_BUDGET, STARTING_POWERS, experienceCount, affiliationStatus, freshState, setChoice, isStepReady, firstIncompleteStep,
  classOf, classRules, subclassList, inheritanceOptions, startingResolveMoves, featureDefinition, weaponSuits, startingThresholds, characterDomains, allDomains, levelOnePowers, powerId, equipmentChoices, spend, buildSheetDocument,
} from './creatorModel.js';

const DRAFT_KEY = 'veil_creator_draft';
const short = (text, max = 190) => { const s = String(text ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); return s.length > max ? s.slice(0, max).trim() + '…' : s; };
const plain = text => String(text ?? '').replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim();
const chip = (label, value) => `<span class="creator-chip"><b>${e(label)}</b> ${e(value)}</span>`;
const card = (attrs, selected, title, tag, body) => `<button type="button" class="creator-card ${selected ? 'selected' : ''}" aria-pressed="${selected}" ${attrs}><strong>${e(title)}</strong>${tag ? `<span class="creator-card-tag">${e(tag)}</span>` : ''}${body ? `<span class="creator-card-text">${e(body)}</span>` : ''}</button>`;

function loadDraft() {
  try { const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return saved && typeof saved === 'object' ? { ...freshState(), ...saved } : freshState(); } catch { return freshState(); }
}

export async function openCharacterCreator({ onCreated = () => {} } = {}) {
  const { CREATOR_DATA: data } = await import('./creatorData.js');
  let state = loadDraft(), step = Math.min(firstIncompleteStep(state, data) || 9, 9);
  const modal = dossierDialog('CREADOR DE PERSONAJES', `
    <div class="creator-layout">
      <nav class="creator-steps" aria-label="Pasos de creación"></nav>
      <section class="creator-panel" aria-live="polite"></section>
    </div>
    <p class="dossier-error" role="alert"></p>
    <footer class="dossier-footer creator-footer">
      <button type="button" class="hud-btn" data-act="reset" title="Empezar un personaje nuevo">Empezar de nuevo</button>
      <span class="creator-progress"></span>
      <button type="button" class="hud-btn" data-act="prev">Anterior</button>
      <button type="button" class="hud-btn hud-btn-primary" data-act="next">Siguiente</button>
    </footer>`, 'creator-dialog');
  const nav = modal.querySelector('.creator-steps'), panel = modal.querySelector('.creator-panel'), error = modal.querySelector('.dossier-error');
  const save = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch {} };
  const set = (key, value) => { state = setChoice(state, key, value); save(); render(); };

  // Step 8 lists, redrawn on their own so typing in the search box is never interrupted.
  let equipSearch = '';
  const matches = item => { const q = equipSearch.trim().toLowerCase(); return !q || [item.name, item.category, item.trait, item.range, item.damage, ...(item.features || [])].join(' ').toLowerCase().includes(q); };
  const featureList = item => (item.features || []).length ? `<span class="creator-features">${item.features.map(f => `<span class="creator-feature"><b>${e(f)}</b>${featureDefinition(data, f) ? ` — ${e(featureDefinition(data, f))}` : ''}</span>`).join('')}</span>` : '';
  const equipCard = (type, item) => {
    const on = (type === 'weapon' ? state.weapons : state.armors).includes(item.name), suits = type === 'weapon' && weaponSuits(state, item);
    const stats = type === 'weapon'
      ? `${chip('Daño', item.damage)}${chip('Alcance', item.range)}${chip('Trait', item.trait)}${chip('Carga', item.burden ?? '—')}`
      : `${chip('Umbrales', `${startingThresholds(item).major} / ${startingThresholds(item).severe}`)}${chip('Armor Slots', item.armorSlots)}${item.improvementCapacity != null ? chip('Mejoras', item.improvementCapacity) : ''}`;
    return `<button type="button" class="creator-card creator-equip ${on ? 'selected' : ''}" aria-pressed="${on}" data-${type}="${e(item.name)}">
      <span class="creator-power-head"><strong>${suits ? '★ ' : ''}${e(item.name)}</strong><span class="creator-pick">${on ? '✓ Elegida' : 'Elegir'}</span></span>
      <span class="creator-card-tag">${e(item.category)}${type === 'armor' ? ' armor' : ''} · ${item.cost} Cr${item.pack !== 'core' ? ' · Rust & Steel' : ''}${suits ? ' · Recomendada' : ''}</span>
      <span class="creator-chips">${stats}</span>${featureList(item)}</button>`;
  };
  function equipLists() {
    const group = (type, title) => {
      const all = equipmentChoices(state, data, type), shown = all.filter(matches);
      if (type === 'weapon') shown.sort((x, y) => Number(weaponSuits(state, y)) - Number(weaponSuits(state, x)) || x.category.localeCompare(y.category) || x.name.localeCompare(y.name));
      const categories = [...new Set(shown.map(i => i.category))];
      return `<h4 class="dossier-label">${title} · ${(type === 'weapon' ? state.weapons : state.armors).length} / 1 · ${shown.length} de ${all.length} OPCIONES</h4>
        ${shown.length ? categories.map(c => `<h5 class="creator-category">${e(c)}</h5><div class="creator-grid equip">${shown.filter(i => i.category === c).map(i => equipCard(type, i)).join('')}</div>`).join('') : '<p class="dossier-muted">Nada coincide con la búsqueda.</p>'}`;
    };
    return group('weapon', 'ARMA') + group('armor', 'ARMADURA');
  }

  const panels = {
    1: () => {
      const anc = data.ancestries.find(a => a.id === state.ancestry);
      return `<h3>Ancestry</h3><p class="dossier-muted">La especie de tu personaje y sus dones.</p>
        <div class="creator-grid">${data.ancestries.map(a => card(`data-set="ancestry" data-value="${e(a.id)}"`, a.id === state.ancestry, a.name, a.tag, short(a.desc))).join('')}</div>
        ${anc ? `<div class="creator-detail"><h4>${e(anc.name)} · dones</h4>${(anc.gifts || []).map(g => `<p><strong>${e(g.name)}.</strong> ${e(short(g.text, 400))}</p>`).join('')}</div>` : ''}
        ${anc?.id === 'human' ? `<h4 class="dossier-label">INHERITANCE OF THE BUILDERS · ELIGE UNA</h4>
          <div class="creator-grid two">${card('data-set="humanInheritance" data-value="graft"', state.humanInheritance === 'graft', 'The Graft', 'Un aumento gratis, sin inconveniente', 'Common (TT1): no ocupa Augment Slot. Military (TT2): ocupa 1 slot.')}${card('data-set="humanInheritance" data-value="tool"', state.humanInheritance === 'tool', 'The Tool', 'Un objeto Experimental (TT3) de 9 Cr', 'De cualquier catálogo de equipo en juego. Es tuyo y está pagado.')}</div>
          ${state.humanInheritance ? `<label class="hud-checkbox-label"><input type="checkbox" data-rs ${state.includeRustAndSteel ? 'checked' : ''}> Incluir el catálogo de Rust &amp; Steel</label>
          <div class="creator-grid">${inheritanceOptions(state, data).map(item => card(`data-set="humanInheritanceItem" data-value="${e(item.id)}"`, item.id === state.humanInheritanceItem, item.name, state.humanInheritance === 'graft' ? `${item.tier} · ${item.capacityCost ? '1 Augment Slot' : '0 Augment Slots'}` : `${item.catalog} · ${item.tier} · ${item.cost} Cr`, state.humanInheritance === 'graft' ? item.benefit : item.summary)).join('')}</div>` : ''}` : ''}
        ${anc?.subStrains?.length ? `<h4 class="dossier-label">ELIGE UNA ESTIRPE</h4><div class="creator-grid">${anc.subStrains.map(s => card(`data-set="subStrain" data-value="${e(s.id)}"`, s.id === state.subStrain, s.name, s.epithet, short(s.featText || s.flavor))).join('')}</div>` : ''}`;
    },
    2: () => `<h3>Community</h3><p class="dossier-muted">Dónde creció y qué le enseñó.</p>
      <div class="creator-grid">${data.communities.map(c => card(`data-set="community" data-value="${e(c.id)}"`, c.id === state.community, c.name, c.tag, `${c.feature.name}: ${short(c.feature.text, 150)}`)).join('')}</div>`,
    3: () => {
      const cls = classOf(state, data), rules = classRules(state, data);
      return `<h3>Path, Class y Subclass</h3>
        <h4 class="dossier-label">SENDA</h4>
        <div class="creator-grid two">${card('data-set="path" data-value="Awakened"', state.path === 'Awakened', 'Awakened', 'Hope y Poderes de Dominio', 'Canaliza el Velo: gasta Hope y equipa un Loadout de Poderes.')}${card('data-set="path" data-value="Sleeping"', state.path === 'Sleeping', 'Sleeping', 'Effort y Resolve', 'Oficio y disciplina: gasta Effort y Resolve Moves, con Honed Edge.')}</div>
        <h4 class="dossier-label">CLASE</h4>
        <div class="creator-grid">${data.classes.map(c => card(`data-set="cls" data-value="${e(c.id)}"`, c.id === state.cls, c.name, `${c.domains} · HP ${c.hp} · Evasion ${c.evasion}`, short(c.desc, 140))).join('')}</div>
        ${cls && state.path ? `<div class="creator-detail"><h4>${e(cls.name)} · ${state.path}</h4><p><strong>${e((state.path === 'Sleeping' ? rules.effortFeature : rules.hopeFeature)?.name || '')}.</strong> ${e(short((state.path === 'Sleeping' ? rules.effortFeature : rules.hopeFeature)?.text, 320))}</p><p><strong>${e(rules.classFeature?.name || '')}.</strong> ${e(short(rules.classFeature?.text, 320))}</p></div>
        <h4 class="dossier-label">SUBCLASE</h4><div class="creator-grid">${subclassList(state, data).map(s => card(`data-set="subclass" data-value="${e(s.name)}"`, s.name === state.subclass, s.name, `Trait: ${s.trait}`, `${s.foundation?.name || ''}: ${short(s.foundation?.desc, 150)}`)).join('')}</div>` : '<p class="dossier-muted">Elige senda y clase para ver sus subclases.</p>'}`;
    },
    4: () => {
      const used = TRAIT_IDS.map(id => state.traits[id]).filter(v => v !== undefined);
      const left = [...TRAIT_ARRAY]; for (const v of used) { const i = left.indexOf(Number(v)); if (i >= 0) left.splice(i, 1); }
      const signature = classRules(state, data)?.spellcastTrait || '';
      return `<h3>Traits</h3><p class="dossier-muted">Reparte estos valores, uno por Trait: <strong>${TRAIT_ARRAY.map(v => (v > 0 ? '+' : '') + v).join(', ')}</strong>.${signature ? ` El Trait de tu clase es <strong>${e(signature)}</strong>.` : ''}</p>
        <div class="creator-traits">${TRAIT_IDS.map(id => {
          const mine = state.traits[id], options = [...new Set([...(mine !== undefined ? [Number(mine)] : []), ...left])].sort((a, b) => b - a);
          return `<label class="dossier-field"><span>${id}${signature.toLowerCase() === id ? ' ★' : ''}</span><select class="hud-input" data-trait="${id}"><option value="">—</option>${options.map(v => `<option value="${v}" ${mine !== undefined && Number(mine) === v ? 'selected' : ''}>${v > 0 ? '+' : ''}${v}</option>`).join('')}</select></label>`;
        }).join('')}</div>
        <p class="dossier-muted">${left.length ? `Quedan por repartir: ${left.map(v => (v > 0 ? '+' : '') + v).join(', ')}.` : 'Todos los valores repartidos.'}</p>
        <button type="button" class="hud-btn" data-act="clear-traits">Vaciar Traits</button>`;
    },
    5: () => {
      if (!state.path) return '<h3>Experiencias</h3><p class="dossier-muted">Elige primero la senda en el paso 3: decide cuántas Experiencias tienes.</p>';
      const count = experienceCount(state);
      return `<h3>Experiencias</h3><p class="dossier-muted">${state.path === 'Sleeping' ? 'Un personaje Sleeping empieza con tres Experiencias a +2 y las invoca gratis.' : 'Un personaje Awakened empieza con dos Experiencias a +2 y gasta 1 Hope para invocar una.'} Hazlas personales, aplicables y con un coste.</p>
        ${Array.from({ length: count }, (_, i) => `<label class="dossier-field"><span>Experiencia ${i + 1} · +2</span><input class="hud-input" data-exp="${i}" maxlength="120" value="${e(state.experiences[i] || '')}" placeholder="Ej.: Criada entre contrabandistas"></label>`).join('')}`;
    },
    6: () => `<h3>Afiliación</h3><p class="dossier-muted">La institución a la que responde. Empieza en Standing +1 (Good Standing) con una Call por sesión; Independent cambia eso por una Favor Pool.</p>
      <div class="creator-grid">${data.affiliations.map(a => { const status = affiliationStatus(a); return card(`data-set="affiliation" data-value="${e(a.id)}"`, a.id === state.affiliation, a.name, status.kind === 'core' ? a.tag : `${a.tag} · ${status.kind === 'advanced' ? 'OPCIÓN AVANZADA' : 'FUERA DEL COREBOOK'}`, `${short(a.benefit, 110)} · Obligación: ${short(a.obligation, 90)}${status.note ? ` · ${status.note}` : ''}`); }).join('')}</div>`,
    7: () => {
      const cls = classOf(state, data);
      if (!cls || !state.path) return '<h3>Poderes</h3><p class="dossier-muted">Elige senda y clase en el paso 3.</p>';
      if (state.path === 'Sleeping') {
        const moves = startingResolveMoves(state, data);
        const movesHtml = `<h4 class="dossier-label">RESOLVE MOVES · ${moves.length}</h4><p class="dossier-muted">Los dos Moves de tu clase${moves.some(m => m.subclass) ? ' y el de tu subclase' : ''}. Se pagan con dados de Resolve.</p><div class="creator-detail">${moves.map(m => `<p><strong>${e(m.name)}</strong> <em>(${e(m.cost)})</em>. ${e(short(m.text, 420))}</p>`).join('') || '<p>Elige una subclase en el paso 3.</p>'}</div>`;
        if (cls.id !== 'mystic') return `<h3>Resolve Moves</h3><p class="dossier-muted">Un personaje Sleeping no usa Poderes de Dominio: trabaja con Effort y Resolve Moves. No hay nada que elegir aquí.</p>${movesHtml}`;
        return `${movesHtml}<h3>Starting Uncanny Archive</h3><p class="dossier-muted">Elige dos Dominios distintos. Desbloqueas todos sus Poderes de nivel 1 a través de Uncanny Power.</p>
          <div class="creator-grid">${allDomains(data).map(d => card(`data-domain="${e(d)}"`, state.sleepingMysticDomains.includes(d), d, `${levelOnePowers(data, d).length} poderes de nivel 1`, levelOnePowers(data, d).map(p => p.n).join(' · '))).join('')}</div>`;
      }
      const domains = characterDomains(state, data);
      const chosen = state.powers.map(id => data.powers.find(p => powerId(p) === id)).filter(Boolean);
      const powerCard = p => {
        const on = state.powers.includes(powerId(p)), full = !on && state.powers.length >= STARTING_POWERS;
        return `<button type="button" class="creator-card creator-power ${on ? 'selected' : ''}" aria-pressed="${on}" data-power="${e(powerId(p))}" ${full ? 'title="Ya tienes dos: quita uno para cambiarlo"' : ''}>
          <span class="creator-power-head"><strong>${e(p.n)}</strong><span class="creator-pick">${on ? '✓ En tu Loadout' : full ? 'Loadout completo' : 'Elegir'}</span></span>
          <span class="creator-chips">${chip('Tipo', p.t)}${chip('Coste', p.cost || 'Sin coste')}${p.dc && p.dc !== '—' ? chip('Tirada', p.dc) : ''}${chip('Recall', p.rc ?? '0')}</span>
          <span class="creator-card-text creator-power-text">${e(plain(p.txt))}</span></button>`;
      };
      return `<h3>Poderes de Dominio</h3>
        ${cls.id === 'mystic' ? `<h4 class="dossier-label">VEIL ALIGNMENT</h4><div class="creator-grid two">${['Lux', 'Void'].map(v => card(`data-set="veilAlignment" data-value="${v}"`, state.veilAlignment === v, v, 'Tu segundo Dominio', `Abre los Poderes de ${v}.`)).join('')}</div>` : ''}
        ${cls.id === 'vanguard' && domains.length < 2 ? '<p class="dossier-muted">Elige una subclase en el paso 3: decide tu segundo Dominio.</p>' : ''}
        <div class="creator-summary" role="status"><strong>Starter Loadout · ${state.powers.length} / ${STARTING_POWERS}</strong><span>${chosen.length ? chosen.map(p => `${e(p.n)} (${e(p.d)})`).join(' · ') : `Elige ${STARTING_POWERS} Poderes de nivel 1 entre los ${domains.length * 3} de tus Dominios: ${e(domains.join(' y ') || '—')}.`}</span></div>
        <p class="dossier-muted"><strong>Coste</strong>: lo que gastas al usarlo. <strong>Tirada</strong>: la dificultad y el Trait, si pide tirar. <strong>Recall</strong>: Stress que cuesta pasarlo del Vault al Loadout en mitad de una escena (gratis en un Long Rest).</p>
        ${domains.map(d => `<h4 class="dossier-label creator-domain">${e(d.toUpperCase())} · ${levelOnePowers(data, d).length} PODERES DE NIVEL 1</h4><div class="creator-grid powers">${levelOnePowers(data, d).map(powerCard).join('')}</div>`).join('')}`;
    },
    8: () => {
      const cls = classOf(state, data);
      if (!cls) return '<h3>Equipo</h3><p class="dossier-muted">Elige una clase en el paso 3.</p>';
      const weapon = data.weapons.find(w => w.name === state.weapons[0]), armor = data.armor.find(x => x.name === state.armors[0]);
      const access = cls.technologyAccess?.tiers?.find(t => Number(t.rank) === 1);
      return `<h3>Equipo inicial</h3><p class="dossier-muted">Un arma y una armadura de Tier 1 (Common) dentro del acceso tecnológico de ${e(cls.name)}, además de los objetos de clase.</p>
        <div class="creator-summary" role="status"><strong>Tu equipo</strong>
          <span>Arma: ${weapon ? `<b>${e(weapon.name)}</b> · ${e(weapon.damage)} · ${e(weapon.range)} · ataca con ${e(weapon.trait)}` : 'sin elegir'}</span>
          <span>Armadura: ${armor ? `<b>${e(armor.name)}</b> · umbrales ${startingThresholds(armor).major} / ${startingThresholds(armor).severe} · ${armor.armorSlots} Armor Slots` : 'sin elegir'}</span>
          <span>Objetos de clase: ${e((classRules(state, data).items || []).join(' · ') || '—')}</span></div>
        <div class="creator-toolbar"><label class="dossier-field"><span>Buscar por nombre, categoría o propiedad</span><input class="hud-input" data-equip-search type="search" value="${e(equipSearch)}" placeholder="Ej.: pistol, melee, armor piercing"></label>
          <label class="hud-checkbox-label"><input type="checkbox" data-rs ${state.includeRustAndSteel ? 'checked' : ''}> Incluir equipo de Rust &amp; Steel</label></div>
        <p class="dossier-muted">${e(cls.name)} puede usar: armas ${e(access?.allWeapons ? 'de cualquier categoría' : (access?.weaponCategories || []).join(', '))}; armadura ${e(access?.allArmor ? 'de cualquier categoría' : (access?.armorCategories || []).join(', '))}. <strong>★ Recomendada</strong>: ataca con uno de tus mejores Traits.</p>
        <div data-equip-lists>${equipLists()}</div>
        <label class="dossier-field"><span>Kit personal (opcional): de tres a cinco objetos que son suyos</span><input class="hud-input" data-field="kit" maxlength="200" value="${e(state.kit)}"></label>`;
    },
    9: () => {
      const cls = classOf(state, data), text = (key, label, rows = 2) => `<label class="dossier-field"><span>${label}</span><textarea class="hud-input" data-field="${key}" rows="${rows}" maxlength="1000">${e(state[key])}</textarea></label>`;
      const pending = CREATOR_STEPS.filter(s => s.id < 9 && !isStepReady(state, s.id, data));
      const canPlace = store.sessionRole !== 'player' && store.state.userRole === 'keeper';
      const targets = canPlace ? store.state.tokens.filter(t => t.isPlayer !== false && t.actorType !== 'adversary') : [];
      return `<h3>Detalles</h3>
        <div class="dossier-identity"><label class="dossier-field"><span>Nombre</span><input class="hud-input" data-field="name" maxlength="120" value="${e(state.name)}"></label><label class="dossier-field"><span>Pronombres</span><input class="hud-input" data-field="pronouns" maxlength="60" value="${e(state.pronouns)}"></label></div>
        ${text('bgAnswer', cls ? cls.bgQuestion : 'Pregunta de trasfondo')}
        <div class="dossier-identity">${text('appearance', 'Apariencia')}${text('voice', 'Voz y maneras')}</div>
        ${state.path === 'Sleeping' ? text('anchor', 'Recovery Anchor', 1) : ''}
        ${text('wound', 'Herida, deuda o misterio abierto', 1)}
        ${pending.length ? `<p class="dossier-error">Faltan pasos por completar: ${pending.map(s => `${s.id}. ${e(s.label)}`).join(' · ')}.</p>` : `
        <h4 class="dossier-label">TERMINAR</h4>
        <div class="creator-finish">
          ${canPlace ? `<button type="button" class="hud-btn hud-btn-primary" data-finish="token">Crear y poner en la mesa</button>
          ${targets.length ? `<label class="dossier-field"><span>…o llevar la ficha a un token que ya existe</span><select class="hud-input" data-target><option value="">Elegir token</option>${targets.map(t => `<option value="${e(t.id)}">${e(t.name)}</option>`).join('')}</select></label><button type="button" class="hud-btn" data-finish="replace">Asignar a ese token</button>` : ''}` : '<p class="dossier-muted">El Keeper pone los personajes en la mesa. Descarga la ficha y envíasela, o impórtala cuando te asigne un token.</p>'}
          ${account.user && !account.user.isNetlify ? '<button type="button" class="hud-btn" data-finish="account" title="Guarda el personaje en tu biblioteca de la cuenta">Guardar en mi cuenta</button>' : ''}
          <button type="button" class="hud-btn" data-finish="download">Descargar ficha JSON</button>
        </div>`}`;
    },
  };

  function render() {
    nav.innerHTML = CREATOR_STEPS.map(s => `<button type="button" class="creator-step ${s.id === step ? 'active' : ''} ${isStepReady(state, s.id, data) ? 'ready' : ''}" data-step="${s.id}" ${s.id === step ? 'aria-current="step"' : ''}><span class="creator-step-num">${String(s.id).padStart(2, '0')}</span><span>${e(s.label)}</span><span class="creator-step-check" aria-hidden="true">${isStepReady(state, s.id, data) ? '✓' : ''}</span></button>`).join('');
    panel.innerHTML = panels[step]();
    panel.scrollTop = 0; error.textContent = '';
    modal.querySelector('[data-act="prev"]').disabled = step === 1;
    const next = modal.querySelector('[data-act="next"]'); next.hidden = step === 9;
    modal.querySelector('.creator-progress').textContent = `Paso ${step} de 9 · ${CREATOR_STEPS.filter(s => isStepReady(state, s.id, data)).length} completos`;
  }

  // One id per character, so saving it again updates the same entry instead of duplicating it.
  let characterId = state.characterId || '';
  async function finish(kind) {
    try {
      if (!characterId) { characterId = 'vtt-' + newId(); state = { ...state, characterId }; save(); }
      const doc = buildSheetDocument(state, data, { characterId });
      if (kind === 'download') { downloadJSON(doc, `${state.name.trim() || 'personaje'}.json`); notify('Ficha descargada.'); return; }
      const token = parseCharacterJSON(doc).token;
      if (kind === 'account') {
        account.lastSaveTarget = 'cloud';
        await account.saveCharacter({ ...token, x: 0, y: 0 });
        notify(account.lastSaveTarget === 'local' ? `${token.name} se ha guardado solo en este navegador.` : `${token.name} guardado en tu cuenta.`);
        return;
      }
      const updateId = kind === 'replace' ? modal.querySelector('[data-target]')?.value : '';
      if (kind === 'replace' && !updateId) throw new Error('Elige el token que recibe la ficha.');
      store.importActors([updateId ? { updateId, token } : { token }]);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      notify(updateId ? `Ficha de ${token.name} asignada al token.` : `${token.name} creado y puesto en la mesa.`);
      modal.remove(); onCreated({ token, document: doc, updateId });
    } catch (err) { error.textContent = err.message; }
  }

  modal.addEventListener('click', event => {
    const el = event.target.closest('button'); if (!el || !modal.contains(el)) return;
    if (el.dataset.step) { step = Number(el.dataset.step); render(); }
    else if (el.dataset.set) set(el.dataset.set, el.dataset.value);
    else if (el.dataset.domain) { const d = el.dataset.domain, list = state.sleepingMysticDomains.filter(x => x !== d); if (list.length === state.sleepingMysticDomains.length) { list.push(d); if (list.length > 2) list.shift(); } state = { ...state, sleepingMysticDomains: list }; save(); render(); }
    else if (el.dataset.power) { const id = el.dataset.power, has = state.powers.includes(id); if (!has && state.powers.length >= STARTING_POWERS) { error.textContent = `Solo ${STARTING_POWERS} Poderes iniciales: quita uno para cambiarlo.`; return; } state = { ...state, powers: has ? state.powers.filter(p => p !== id) : [...state.powers, id] }; save(); render(); }
    else if (el.dataset.weapon || el.dataset.armor) { const key = el.dataset.weapon ? 'weapons' : 'armors', name = el.dataset.weapon || el.dataset.armor, has = state[key].includes(name); state = { ...state, [key]: has ? [] : [name] }; save(); render(); }
    else if (el.dataset.finish) finish(el.dataset.finish);
    else if (el.dataset.act === 'prev') { step = Math.max(1, step - 1); render(); }
    else if (el.dataset.act === 'next') { if (!isStepReady(state, step, data)) { error.textContent = `Completa «${CREATOR_STEPS[step - 1].label}» para seguir, o salta a otro paso desde la lista.`; return; } step = Math.min(9, step + 1); render(); }
    else if (el.dataset.act === 'clear-traits') { state = { ...state, traits: {} }; save(); render(); }
    else if (el.dataset.act === 'reset') { state = freshState(); characterId = ''; step = 1; save(); render(); }
  });
  modal.addEventListener('change', event => {
    const el = event.target;
    if (el.dataset.trait) { const traits = { ...state.traits }; if (el.value === '') delete traits[el.dataset.trait]; else traits[el.dataset.trait] = Number(el.value); state = { ...state, traits }; save(); render(); }
    else if ('rs' in el.dataset) { state = { ...state, includeRustAndSteel: el.checked }; save(); render(); }
  });
  // Text fields update the draft without redrawing, so typing is never interrupted.
  modal.addEventListener('input', event => {
    const el = event.target;
    if ('equipSearch' in el.dataset) { equipSearch = el.value; const box = modal.querySelector('[data-equip-lists]'); if (box) box.innerHTML = equipLists(); return; }
    if (el.dataset.exp !== undefined) { const experiences = [...state.experiences]; experiences[Number(el.dataset.exp)] = el.value; state = { ...state, experiences }; save(); }
    else if (el.dataset.field) { state = { ...state, [el.dataset.field]: el.value }; save(); }
    else return;
    nav.querySelectorAll('.creator-step').forEach(b => { const ready = isStepReady(state, Number(b.dataset.step), data); b.classList.toggle('ready', ready); b.querySelector('.creator-step-check').textContent = ready ? '✓' : ''; });
    modal.querySelector('.creator-progress').textContent = `Paso ${step} de 9 · ${CREATOR_STEPS.filter(s => isStepReady(state, s.id, data)).length} completos`;
  });
  render();
  return modal;
}
