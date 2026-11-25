import { store } from './state.js';
import { network } from './networkManager.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as esc } from './ui.js';
import { LIFE_STATES } from './combatState.js';
import { renderLifeControls } from './lifeControls.js';
import { damageNames } from './damageProtection.js';
import { CONDITIONS, CAMPAIGN_STATES, CONDITION_SOURCE, conditionDefinition, conditionIcon, normalizeConditions, isSpecial, specialState, SPECIAL_MAX } from './conditions.js';

export function conditionBadges(token) {
  return normalizeConditions(token.conditions).map(name => {
    const def = conditionDefinition(name);
    const title = def ? `${def.label} (${def.name}) — ${def.rule}` : name;
    return `<span class="condition-badge" title="${esc(title)}" data-tooltip="${esc(title)}">${conditionIcon(name)}${esc(def?.label || name)}</span>`;
  }).join('');
}

export function openConditions(tokenId) {
  const token = () => store.state.tokens.find(t => t.id === tokenId);
  if (!token()) return;
  const modal = dossierDialog('Condiciones y Estados · ' + token().name, `
    <p class="dossier-muted">Marcadores tácticos y estados de campaña. Sus efectos y duración se resuelven en la mesa conforme a las reglas canónicas del Corebook y Rust & Steel.</p>
    <h4 class="dossier-label" style="margin: 8px 0 4px 0; color: #38bdf8;">⚡ CONDICIONES TÁCTICAS DE COMBATE (18)</h4>
    <div class="condition-picker">${CONDITIONS.map(c => `<button type="button" class="condition-choice" data-condition="${esc(c.name)}" title="${esc(c.label)} (${esc(c.name)}): ${esc(c.rule)}" aria-pressed="false">${conditionIcon(c.name)}<span>${esc(c.label)}<small>${esc(c.name)}</small></span></button>`).join('')}</div>
    
    <div class="condition-fear-source" data-fear-source hidden></div>
    <h4 class="dossier-label" style="margin: 12px 0 4px 0; color: #fbbf24;">💀 ESTADOS DE PERSONAJE Y CAMPAÑA</h4>
    <div class="condition-picker">${CAMPAIGN_STATES.map(c => `<button type="button" class="condition-choice" data-condition="${esc(c.name)}" title="${esc(c.label)} (${esc(c.name)}): ${esc(c.rule)}" aria-pressed="false" style="border-color: rgba(251, 191, 36, 0.3);">${conditionIcon(c.name)}<span style="color: #fde68a;">${esc(c.label)}<small>${esc(c.name)}</small></span></button>`).join('')}</div>

    <div data-life-controls></div>
    <details><summary>Resistencias e inmunidades activas</summary>
      <label>Defensa <vf-select data-defense-kind><option value="Resistance">Resistencia</option><option value="Immunity">Inmunidad</option></vf-select></label>
      <label>Tipo o etiqueta <vf-select data-defense-type>${damageNames.map(n => '<option>' + n + '</option>').join('')}</vf-select></label>
      <button type="button" class="hud-btn" data-add-defense>Añadir defensa</button></details>
    <article class="condition-rule" aria-live="polite" style="margin-top: 10px;"><strong data-rule-title>Selecciona una condición o estado para consultar su regla.</strong><p data-rule></p><small>${esc(CONDITION_SOURCE)}</small></article>
    <h4 class="dossier-label">Special y otros marcadores</h4><div class="condition-custom-list" data-custom-list></div>
    <form class="condition-custom"><label class="dossier-field">Estado Special · texto libre<input class="hud-input" data-custom maxlength="${SPECIAL_MAX}" placeholder="Ej.: Marcado por la lanza · −1 Evasion"></label><button class="hud-btn" type="submit">Añadir Special</button></form>
    <p class="dossier-muted">Un efecto de un poder que no está en la lista, o una simple anotación sobre el token. Se ve en el token con su icono; pasa el ratón para leerlo.</p>
    <p class="dossier-muted" data-permission></p><p class="dossier-error" role="alert"></p>`);
  const error = message => { modal.querySelector('.dossier-error').textContent = message; };
  const explain = name => {
    const c = conditionDefinition(name);
    modal.querySelector('[data-rule-title]').textContent = c ? c.label + ' · ' + c.name : name;
    modal.querySelector('[data-rule]').textContent = c?.rule || 'Marcador propio: consulta su efecto con el Keeper.';
  };
  const pending = new Set();
  const apply = async (name, toggle = true, extra = {}) => {
    if (!token() || !store.canEditToken(tokenId)) { error('Solo el Keeper y los jugadores asignados pueden cambiar estas condiciones.'); return; }
    const current = normalizeConditions(token().conditions);
    const normalized = normalizeConditions([name])[0];
    if (!normalized) return;
    let next = current.includes(normalized) ? (toggle ? current.filter(c => c !== normalized) : current) : [...current, normalized];
    next = normalizeConditions(next);
    if (next.length > 30 || next.some(c => c.length > 100)) { error('Máximo 30 marcadores de 100 caracteres.'); return; }
    if (pending.has(normalized)) return;
    pending.add(normalized); refresh();
    try {
      await network.requestAction({ type:'CONDITION', actorId:tokenId, name:normalized, active:!toggle || !current.includes(normalized), ...extra });
      error(''); explain(normalized); return true;
    } catch (e) { error(e.message); return false; }
    finally { pending.delete(normalized); if (modal.isConnected) refresh(); }
  };
  function refresh() {
    const editable = !!token() && store.canEditToken(tokenId);
    const active = normalizeConditions(token()?.conditions);
    renderLifeControls(modal.querySelector('[data-life-controls]'), token(), store, network, error);
    modal.querySelector('[data-add-defense]').disabled = !editable;
    modal.querySelectorAll('[data-condition]').forEach(button => {
      button.setAttribute('aria-pressed', String(active.includes(button.dataset.condition)));
      button.setAttribute('aria-disabled', String(!editable));
      button.disabled = pending.has(button.dataset.condition) || (token()?.isPlayer !== false && LIFE_STATES.includes(button.dataset.condition));
    });
    // Frightened (v2.55.0): of whom. With a source, the table gives Disadvantage on rolls against it
    // and does not let the player move the character closer to it.
    const fear = modal.querySelector('[data-fear-source]'), afraid = active.includes('Frightened');
    fear.hidden = !afraid;
    if (afraid) {
      const others = store.state.tokens.filter(t => t.mapId === token().mapId && t.id !== tokenId && !t.inReserve && (!t.hidden || store.state.userRole === 'keeper'));
      const signature = [token().frightenedBy || '', editable, ...others.map(t => t.id + t.name)].join('|');
      if (fear.dataset.signature !== signature) {
        fear.dataset.signature = signature;
        fear.innerHTML = `<label class="dossier-field">Frightened · ¿de quién tiene miedo? <vf-select data-fear-select ${editable ? '' : 'disabled'}><option value="">Sin fuente en la escena (solo recordatorio)</option>${others.map(t => `<option value="${esc(t.id)}" ${t.id === token().frightenedBy ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</vf-select></label><p class="dossier-muted">Con una fuente, sus tiradas contra ella llevan Desventaja y no puede acercarse a ella por su cuenta.</p>`;
        fear.querySelector('[data-fear-select]').addEventListener('change', event => apply('Frightened', false, { sourceId: event.target.value || '' }));
      }
    }
    modal.querySelector('[data-custom]').disabled = !editable;
    modal.querySelector('button[type=submit]').disabled = !editable;
    modal.querySelector('[data-permission]').textContent = editable ? (store.sessionRole === 'player' ? 'Los cambios se confirman al recibir la respuesta del Keeper.' : 'Los cambios se guardan al pulsar cada condición.') : 'Consulta: este token no está bajo tu control.';
    const list = modal.querySelector('[data-custom-list]'); list.replaceChildren();
    active.filter(c => (!conditionDefinition(c) || isSpecial(c)) && !LIFE_STATES.includes(c)).forEach(name => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hud-btn';
      button.textContent = (isSpecial(name) ? conditionDefinition(name).label : name) + (editable ? ' ×' : ''); button.onclick = () => editable ? apply(name) : explain(name); list.append(button);
    });
  }
  modal.querySelectorAll('[data-condition]').forEach(button => {
    button.onclick = () => store.canEditToken(tokenId) ? apply(button.dataset.condition) : explain(button.dataset.condition);
    button.onfocus = button.onpointerenter = () => explain(button.dataset.condition);
  });
  modal.querySelector('[data-add-defense]').onclick = () => apply(modal.querySelector('[data-defense-kind]').value + ': ' + modal.querySelector('[data-defense-type]').value, false);
  modal.querySelector('form').onsubmit = async event => { event.preventDefault(); const input = modal.querySelector('[data-custom]'), state = specialState(input.value); if (!state) { error('Escribe el texto del estado Special.'); return; } if (await apply(state, false)) input.value = ''; };
  const unsubscribe = store.subscribe((_, keys) => { if (!modal.isConnected) { unsubscribe(); return; } if (keys.some(k => ['tokens', 'maps', 'userRole', 'isConnected', 'claimedTokenId'].includes(k))) refresh(); });
  const observer = new MutationObserver(() => { if (!modal.isConnected) { unsubscribe(); observer.disconnect(); } }); observer.observe(document.body, { childList: true });
  refresh(); return modal;
}
