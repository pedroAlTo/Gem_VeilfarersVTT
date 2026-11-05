import { store } from './state.js';
import { network } from './networkManager.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as esc } from './ui.js';
import { CONDITIONS, CONDITION_SOURCE, conditionDefinition, conditionIcon, normalizeConditions } from './conditions.js';

export function conditionBadges(token) {
  return normalizeConditions(token.conditions).map(name => `<span class="condition-badge">${conditionIcon(name)}${esc(conditionDefinition(name)?.label || name)}</span>`).join('');
}

export function openConditions(tokenId) {
  const token = () => store.state.tokens.find(t => t.id === tokenId);
  if (!token()) return;
  const modal = dossierDialog('Condiciones · ' + token().name, `
    <p class="dossier-muted">Marcadores de la escena. Sus efectos y duración se resuelven en la mesa; no modifican dados ni recursos automáticamente. Hidden no cambia la visibilidad del token para los jugadores.</p>
    <div class="condition-picker">${CONDITIONS.map(c => `<button type="button" class="condition-choice" data-condition="${esc(c.name)}" aria-pressed="false">${conditionIcon(c.name)}<span>${esc(c.label)}<small>${esc(c.name)}</small></span></button>`).join('')}</div>
    <article class="condition-rule" aria-live="polite"><strong data-rule-title>Selecciona una condición para consultar su regla.</strong><p data-rule></p><small>${esc(CONDITION_SOURCE)}</small></article>
    <h4 class="dossier-label">Otros marcadores</h4><div class="condition-custom-list" data-custom-list></div>
    <form class="condition-custom"><label class="dossier-field">Marcador propio<input class="hud-input" data-custom maxlength="100" placeholder="Ej.: Herido · efecto de la escena"></label><button class="hud-btn" type="submit">Añadir</button></form>
    <p class="dossier-muted" data-permission></p><p class="dossier-error" role="alert"></p>`);
  const error = message => { modal.querySelector('.dossier-error').textContent = message; };
  const explain = name => {
    const c = conditionDefinition(name);
    modal.querySelector('[data-rule-title]').textContent = c ? c.label + ' · ' + c.name : name;
    modal.querySelector('[data-rule]').textContent = c?.rule || 'Marcador propio: consulta su efecto con el Keeper.';
  };
  const pending = new Set();
  const apply = async (name, toggle = true) => {
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
      await network.requestAction({ type:'CONDITION', actorId:tokenId, name:normalized, active:!toggle || !current.includes(normalized) });
      error(''); explain(normalized); return true;
    } catch (e) { error(e.message); return false; }
    finally { pending.delete(normalized); if (modal.isConnected) refresh(); }
  };
  function refresh() {
    const editable = !!token() && store.canEditToken(tokenId);
    const active = normalizeConditions(token()?.conditions);
    modal.querySelectorAll('[data-condition]').forEach(button => {
      button.setAttribute('aria-pressed', String(active.includes(button.dataset.condition)));
      button.setAttribute('aria-disabled', String(!editable));
      button.disabled = pending.has(button.dataset.condition);
    });
    modal.querySelector('[data-custom]').disabled = !editable;
    modal.querySelector('button[type=submit]').disabled = !editable;
    modal.querySelector('[data-permission]').textContent = editable ? (store.sessionRole === 'player' ? 'Los cambios se confirman al recibir la respuesta del Keeper.' : 'Los cambios se guardan al pulsar cada condición.') : 'Consulta: este token no está bajo tu control.';
    const list = modal.querySelector('[data-custom-list]'); list.replaceChildren();
    active.filter(c => !conditionDefinition(c)).forEach(name => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hud-btn';
      button.textContent = name + (editable ? ' ×' : ''); button.onclick = () => editable ? apply(name) : explain(name); list.append(button);
    });
  }
  modal.querySelectorAll('[data-condition]').forEach(button => {
    button.onclick = () => store.canEditToken(tokenId) ? apply(button.dataset.condition) : explain(button.dataset.condition);
    button.onfocus = button.onpointerenter = () => explain(button.dataset.condition);
  });
  modal.querySelector('form').onsubmit = async event => { event.preventDefault(); const input = modal.querySelector('[data-custom]'); if (await apply(input.value, false)) input.value = ''; };
  const unsubscribe = store.subscribe((_, keys) => { if (!modal.isConnected) { unsubscribe(); return; } if (keys.some(k => ['tokens', 'userRole', 'isConnected', 'claimedTokenId'].includes(k))) refresh(); });
  const observer = new MutationObserver(() => { if (!modal.isConnected) { unsubscribe(); observer.disconnect(); } }); observer.observe(document.body, { childList: true });
  refresh(); return modal;
}
