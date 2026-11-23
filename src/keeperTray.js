// The Keeper's decision tray (v2.39.0, card UX plan, phase 4): the cards played in the current
// scene that still wait for the table — a linked roll, the replies of their targets or the
// Keeper's call — in one small list, with the adversaries' replies rolled in one click. With
// «Auto» on, the table rolls those replies as soon as they appear (the Keeper still decides the
// consequences that are not automatic).
import { store } from './state.js';
import { network } from './networkManager.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { adjudicateCard } from './cardResolution.js';
import { openResolution } from './cardResolutionUI.js';

const MAX_ROWS = 6;
const keeperHere = () => store.sessionRole !== 'player' && store.state.userRole === 'keeper';

// The open plays of the active scene, newest first: [{ id, name, actor, phase, waiting, adversaries, players }].
export function pendingDecisions(state) {
  const tokens = state.tokens || [];
  return (state.logs || []).filter(row => row.resolution && row.resolution.phase !== 'done' && row.resolution.mapId === state.activeMapId).map(row => {
    const r = row.resolution, actor = tokens.find(t => t.id === r.actorId);
    const open = (r.replies || []).filter(reply => !reply.outcome);
    const adversaries = open.filter(reply => tokens.find(t => t.id === reply.actorId)?.isPlayer === false);
    return { id: r.id, name: r.name, actor: actor?.name || '', phase: r.phase, waiting: open.length, adversaries, players: open.length - adversaries.length };
  });
}
// What the row says the table is waiting for.
export function decisionStatus(item) {
  if (item.phase === 'roll') return 'Esperando la tirada de ' + (item.actor || 'quien la lanza');
  if (item.adversaries.length && item.players) return item.waiting + ' tiradas pendientes';
  if (item.adversaries.length) return item.adversaries.length + ' adversario(s) por tirar';
  if (item.players) return item.players + ' personaje(s) por tirar';
  return 'Lista para que decidas';
}

const prefs = () => { try { return JSON.parse(localStorage.getItem('veil.keeper.tray') || '{}') || {}; } catch { return {}; } };
const savePrefs = value => { try { localStorage.setItem('veil.keeper.tray', JSON.stringify(value)); } catch {} };

const rolling = new Set(); // reply ids already sent to the table
async function rollAdversaries(item) {
  for (const reply of item.adversaries) {
    if (rolling.has(reply.id)) continue;
    rolling.add(reply.id);
    await network.requestAction({ type: 'CHECK', actorId: reply.actorId, cardPlayId: item.id, cardReplyId: reply.id, options: { traitId: reply.traitId, dc: reply.dc } })
      .catch(error => { rolling.delete(reply.id); notify(error.message, 'error'); });
  }
}

export function mountKeeperTray() {
  if (typeof document === 'undefined') return null;
  const view = { open: prefs().open !== false, auto: !!prefs().auto };
  let signature = '';
  const draw = () => {
    const items = keeperHere() && !store.state.rest ? pendingDecisions(store.state) : [];
    if (view.auto) items.filter(item => item.phase === 'ready' && item.adversaries.some(r => !rolling.has(r.id))).forEach(rollAdversaries);
    const next = JSON.stringify([items, view]);
    if (next === signature) return;
    signature = next;
    let host = document.getElementById('keeper_tray');
    if (!items.length) { host?.remove(); return; }
    if (!host) { host = document.createElement('aside'); host.id = 'keeper_tray'; host.className = 'keeper-tray'; host.setAttribute('aria-label', 'Decisiones pendientes'); document.body.append(host); }
    const rows = items.slice(0, MAX_ROWS).map(item => `<li data-play="${e(item.id)}">
      <span class="keeper-tray-name">${e(item.name)}${item.actor ? ` · <small>${e(item.actor)}</small>` : ''}</span>
      <span class="keeper-tray-status">${e(decisionStatus(item))}</span>
      <span class="keeper-tray-actions">${item.phase === 'ready' && item.adversaries.length ? '<button type="button" class="hud-btn" data-roll>Tirar adversarios</button>' : ''}<button type="button" class="hud-btn" data-open>Abrir</button>${item.phase === 'ready' && !item.waiting ? '<button type="button" class="hud-btn" data-finish>Finalizar</button>' : ''}</span>
    </li>`).join('');
    const ready = items.filter(item => item.phase === 'ready' && !item.waiting);
    host.innerHTML = sanitizeHTML(`<header><button type="button" class="keeper-tray-toggle" data-toggle aria-expanded="${view.open}">Decisiones · ${items.length}</button>
      <label class="keeper-tray-auto" title="Tirar automáticamente las tiradas de objetivo de los adversarios"><input type="checkbox" data-auto${view.auto ? ' checked' : ''}> Auto</label></header>
      ${view.open ? `<ol>${rows}</ol>${items.length > MAX_ROWS ? `<p class="keeper-tray-more">+${items.length - MAX_ROWS} más en el registro de mesa</p>` : ''}${ready.length > 1 ? `<button type="button" class="hud-btn keeper-tray-close-all" data-finish-all>Finalizar las ${ready.length} listas</button>` : ''}` : ''}`);
    host.querySelector('[data-toggle]').onclick = () => { view.open = !view.open; savePrefs(view); draw(); };
    host.querySelector('[data-auto]').onchange = event => { view.auto = event.target.checked; savePrefs(view); draw(); };
    host.querySelectorAll('[data-play]').forEach(li => {
      const item = items.find(i => i.id === li.dataset.play);
      li.querySelector('[data-open]').onclick = () => openResolution(item.id);
      const roll = li.querySelector('[data-roll]');
      if (roll) roll.onclick = () => { roll.disabled = true; rollAdversaries(item); };
      const finish = li.querySelector('[data-finish]');
      if (finish) finish.onclick = () => { try { adjudicateCard(store, item.id, { operation: 'finish' }); } catch (error) { notify(error.message, 'error'); } };
    });
    const all = host.querySelector('[data-finish-all]');
    if (all) all.onclick = () => { for (const item of ready) { try { adjudicateCard(store, item.id, { operation: 'finish' }); } catch (error) { notify(error.message, 'error'); } } };
  };
  store.subscribe(draw);
  draw();
  return { refresh: () => { signature = ''; draw(); } };
}
