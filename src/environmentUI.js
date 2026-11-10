import { store } from './state.js';
import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e, notify } from './ui.js';
import { activeEnvironmentFeatures, environmentActivation, isKeeper, IMPACT_TYPES } from './encounterRules.js';

const options = (items, selected, empty = 'Sin seleccionar') => `<option value="">${empty}</option>` + items.map(x => `<option value="${e(x.id)}" ${x.id === selected ? 'selected' : ''}>${e(x.name)}</option>`).join('');
export async function openEnvironment(mapId, catalog) {
  if (!isKeeper(store.state, store.sessionRole)) return;
  const entries = catalog ?? (await import('virtual:veil-encounters')).default.environments;
  const map = store.state.maps.find(m => m.id === mapId);
  if (!map || !isKeeper(store.state, store.sessionRole)) return;
  const env = map.environment || { tier: 1 };
  const modal = dossierDialog('Entorno de la escena', `
    <span class="dossier-eyebrow">KEEPER’S COMPANION · CAPÍTULOS 9 Y 10</span><h2>${e(map.name)}</h2>
    <p class="dossier-muted">El microentorno aporta la ficha completa. Añade <strong>una sola característica Passive o Action</strong> del macroentorno. El clima visual se ajusta por separado.</p>
    <div class="encounter-grid">
      <label class="dossier-field">Microentorno · ficha base<vf-select class="hud-select" data-micro>${options(entries.filter(x => x.layer === 'micro'), env.microId)}</vf-select></label>
      <label class="dossier-field">Macroentorno · bioma<vf-select class="hud-select" data-macro>${options(entries.filter(x => x.layer === 'macro'), env.macroId, 'Sin modificador macro')}</vf-select></label>
      <label class="dossier-field">Única característica del macro<vf-select class="hud-select" data-feature></vf-select></label>
      <label class="dossier-field">Tier de la escena<vf-select class="hud-select" data-tier>${[1,2,3,4].map(n => `<option value="${n}" ${env.tier === n ? 'selected' : ''}>Tier ${n}</option>`).join('')}</vf-select></label>
    </div>
    <div class="encounter-toolbar"><button class="hud-btn hud-btn-primary" data-save>Guardar entorno</button><span data-saved aria-live="polite"></span></div>
    <div data-source></div><h3>Características activas <span class="encounter-fear" data-fear></span></h3>
    <p class="dossier-muted">Activar paga el coste impreso y deja constancia privada para el Keeper. Resuelve los objetivos, tiradas, duración y consecuencias según el texto; no se aplica daño automático.</p>
    <div class="encounter-grid">
      <label class="dossier-field">Objetivo del efecto<vf-select class="hud-select" data-target>${options(store.state.tokens.filter(t => t.mapId === mapId), '', 'Centro del mapa')}</vf-select></label>
      <label class="dossier-field">Acompañamiento visual<vf-select class="hud-select" data-visual><option value="none">Sin animación</option>${Object.entries(IMPACT_TYPES).filter(([k]) => !['auto','melee'].includes(k)).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</vf-select></label>
    </div><div data-features></div><p class="dossier-error" role="alert"></p>`, 'encounter-dialog');
  const q = s => modal.querySelector(s);
  let dirty = false;
  const read = () => ({ microId: q('[data-micro]').value, macroId: q('[data-macro]').value,
    macroFeatureId: q('[data-feature]').value, tier: Number(q('[data-tier]').value),
    microName: entries.find(x => x.id === q('[data-micro]').value)?.name || '',
    macroName: entries.find(x => x.id === q('[data-macro]').value)?.name || '' });
  function macroFeatures(selected = '') {
    const macro = entries.find(x => x.id === q('[data-macro]').value);
    q('[data-feature]').innerHTML = options(macro?.features.filter(f => ['Passive','Action'].includes(f.type)) || [], selected, 'Elige una característica');
    q('[data-feature]').disabled = !macro;
  }
  function render() {
    q('[data-fear]').textContent = `Fear ${store.state.fear} / 12`;
    const config = read();
    const chosen = [entries.find(x => x.id === config.microId), entries.find(x => x.id === config.macroId)].filter(Boolean);
    const tierRule = chosen.find(x => x.layer === 'micro')?.tierRules?.[config.tier];
    q('[data-source]').innerHTML = (tierRule ? `<article class="encounter-tier"><strong>TIER ${config.tier}${tierRule.dc ? ' · DC ' + tierRule.dc : ''}</strong><p>${e(tierRule.text)}</p></article>` : '') + chosen.map(x => `<details class="encounter-source"><summary>${e(x.name)} · ficha y escalado de tier</summary><p class="dossier-muted">${e(x.source)}</p><div class="encounter-source-text">${e(x.text)}</div></details>`).join('');
    let features = [];
    try { features = activeEnvironmentFeatures(config, entries); q('.dossier-error').textContent = ''; }
    catch (error) { q('.dossier-error').textContent = error.message; }
    q('[data-saved]').textContent = dirty ? 'Cambios pendientes de guardar' : 'Configuración guardada';
    q('[data-features]').innerHTML = features.map(f => `<article class="encounter-feature">
      <div class="encounter-feature-heading"><span class="dossier-eyebrow">${f.layer.toUpperCase()} · ${e(f.type)}</span><span>${f.type === 'Passive' ? 'Siempre activa' : f.fear === null ? 'Coste variable' : f.fear + ' Fear'}</span></div>
      <h4>${e(f.name)}</h4><p>${e(f.text)}</p>
      ${f.type !== 'Passive' ? `<div class="encounter-toolbar">${f.type === 'Reaction' ? '<label><input type="checkbox" data-trigger> Se ha cumplido el disparador</label>' : ''}${f.fear === null ? '<label>Fear impreso <input type="number" min="0" max="12" step="1" class="hud-input" data-cost></label>' : ''}
      <button class="hud-btn" data-activate="${e(f.id)}" ${dirty || mapId !== store.state.activeMapId || (f.fear !== null && f.fear > store.state.fear) ? 'disabled' : ''}>${f.fear ? 'Gastar ' + f.fear + ' Fear y activar' : 'Activar característica'}</button></div>` : ''}</article>`).join('') || '<p class="dossier-muted">Selecciona un microentorno para ver sus reglas.</p>';
    if (mapId !== store.state.activeMapId) q('[data-saved]').textContent += ' · Las activaciones requieren la escena activa.';
    q('[data-features]').querySelectorAll('[data-activate]').forEach(button => button.onclick = async () => {
      try {
        const card = button.closest('article'), target = store.state.tokens.find(t => t.id === q('[data-target]').value && t.mapId === mapId);
        const patch = environmentActivation(store.state, store.sessionRole, mapId, button.dataset.activate, entries, {
          triggerConfirmed: !!card.querySelector('[data-trigger]')?.checked,
          manualCost: card.querySelector('[data-cost]')?.value === '' ? undefined : Number(card.querySelector('[data-cost]')?.value), targetName: target?.name,
        });
        button.disabled = true;
        store._beforeTacticalMutation('Activar característica ambiental'); store.update(patch);
        const kind = q('[data-visual]').value;
        if (kind !== 'none') {
          const currentMap = store.getActiveMap(), grid = currentMap.gridSize || 64;
          const point = target || { x: currentMap.width / 2 || 500, y: currentMap.height / 2 || 350, size: 1 };
          const params = { attacker: { x: point.x, y: point.y }, target: { x: point.x, y: point.y }, mapId, kind, hpLost: 2, tokenDiameter: grid * (point.size || 1) };
          window.veilCanvas?.triggerAttackFX(params);
          // Environmental animation is public only for an explicitly visible target/location.
          if (!target?.hidden) { const { network } = await import('./networkManager.js'); network.broadcast({ type: 'ATTACK_FX', params }); }
        }
        notify('Característica activada. Resuelve el procedimiento impreso.'); render();
      } catch (error) { q('.dossier-error').textContent = error.message; }
    });
  }
  macroFeatures(env.macroFeatureId);
  for (const selector of ['[data-micro]', '[data-macro]', '[data-feature]', '[data-tier]']) q(selector).onchange = () => {
    if (selector === '[data-macro]') macroFeatures(); dirty = true; render();
  };
  q('[data-save]').onclick = () => {
    try {
      if (!isKeeper(store.state, store.sessionRole)) throw new Error('Solo el Keeper puede editar el entorno.');
      const config = read(); activeEnvironmentFeatures(config, entries);
      if (!store.state.maps.some(m => m.id === mapId)) throw new Error('La escena ya no existe.');
      store._beforeTacticalMutation('Definir macro y microentorno');
      store.update({ maps: store.state.maps.map(m => m.id === mapId ? { ...m, environment: config } : m) }); dirty = false; render();
    } catch (error) { q('.dossier-error').textContent = error.message; }
  };
  render();
  const unsubscribe = store.subscribe((_, keys) => { if (modal.isConnected && keys.some(k => ['fear', 'activeMapId'].includes(k))) render(); });
  const observer = new MutationObserver(() => { if (!modal.isConnected) { unsubscribe(); observer.disconnect(); } }); observer.observe(document.body, { childList: true });
  return modal;
}
