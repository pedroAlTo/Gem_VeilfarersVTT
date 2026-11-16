// The card hand: next to the stats of the selected player character, its Loadout as a fan of
// 3D cards. A card is inspected with a click and played by dragging it onto the board.
import { store } from './state.js';
import { network } from './networkManager.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { dossierDialog } from './dossierUI.js';
import { cardData, loadCardData } from './cardData.js';
import { characterCards, costLabel, CARD_KINDS, RECALL_MODES, recallCost, loadoutNames, loadoutCap, isSleepingMystic } from './loadoutCards.js';

const DRAG_START = 9; // pixels the pointer must travel before a click becomes a drag
const affordable = (token, card) => {
  const c = card.cost, stressRoom = (token.stress?.max ?? 6) - (token.stress?.current || 0);
  if (card.kind === 'archive') return (token.resolve?.current || 0) >= 1 && c.stress <= stressRoom;
  return (token.hope || 0) >= c.hope && (token.effort || 0) >= c.effort && (token.resolve?.current || 0) >= c.resolve && c.stress <= stressRoom;
};
const chips = card => {
  const c = card.cost, list = [];
  if (c.hope && card.kind !== 'archive') list.push(['hope', `${c.hope} Hope`]); if (c.stress) list.push(['stress', `${c.stress} Stress`]);
  if (c.effort) list.push(['effort', `${c.effort} Effort`]); if (c.resolve) list.push(['resolve', `${c.resolve}${c.open ? '+' : ''} Resolve`]);
  if (card.kind === 'archive') list.unshift(['resolve', '1+ Resolve']);
  if (c.hp) list.push(['stress', `${c.hp} HP`]);
  if (!list.length) list.push(['free', c.open ? 'Variable' : 'Sin coste']);
  return list.map(([tone, label]) => `<span class="vf-card-chip ${tone}">${e(label)}</span>`).join('');
};
const glyph = card => ({ power: '✦', archive: '✧', vault: '◈', move: '⬢', feature: '❖', ancestry: '☉', community: '⌂' })[card.kind] || '✦';

export function cardFace(card, { large = false } = {}) {
  return `
    <span class="vf-card-frame" style="--card-color:${e(card.color)}">
      <span class="vf-card-head"><em>${e(CARD_KINDS[card.kind])}</em><strong>${e(card.name)}</strong></span>
      <span class="vf-card-art"><i>${glyph(card)}</i>${card.level ? `<b>L${card.level}</b>` : ''}</span>
      <span class="vf-card-sub">${e(card.subtitle)}</span>
      <span class="vf-card-chips">${chips(card)}${card.rollText ? `<span class="vf-card-chip roll">${e(card.rollText)}</span>` : ''}${card.kind === 'power' || card.kind === 'vault' ? `<span class="vf-card-chip rc">RC ${card.rc}</span>` : ''}</span>
      <span class="vf-card-text">${e(large ? card.text : card.text.slice(0, 150) + (card.text.length > 150 ? '…' : ''))}</span>
      <span class="vf-card-shine"></span>
    </span>`;
}

export class CardHand {
  constructor(quickbar) {
    this.quickbar = quickbar; this.signature = ''; this.cards = []; this.tokenId = null;
    this.root = document.createElement('div');
    this.root.id = 'card_hand_root'; this.root.className = 'card-hand hidden';
    quickbar.parentElement.append(this.root);
    this.unsubscribe = store.subscribe(() => this.render());
    loadCardData().then(() => this.render()).catch(error => console.warn('[CardHand] rules data', error));
    this.render();
  }

  // The hand belongs to the player stance: the character you control, selected.
  owner() {
    const token = store.getSelectedToken?.();
    const playerStance = store.sessionRole === 'player' || store.state.userRole !== 'keeper';
    return token && playerStance && token.isPlayer !== false && token.actorType !== 'drone' && store.canEditToken(token.id) ? token : null;
  }

  render() {
    const token = this.owner(), data = cardData();
    if (!token || !data) { this.signature = ''; this.tokenId = null; this.root.classList.add('hidden'); this.quickbar.classList.remove('with-hand'); return; }
    const cards = characterCards(token, data);
    const signature = JSON.stringify([token.id, token.hope, token.effort, token.stress?.current, token.resolve?.current, cards.map(c => c.id)]);
    if (signature === this.signature) return;
    this.signature = signature; this.cards = cards; this.tokenId = token.id;
    const hand = cards.filter(c => c.zone !== 'vault'), vault = cards.filter(c => c.zone === 'vault'), n = hand.length;
    this.root.classList.toggle('hidden', !cards.length); this.quickbar.classList.toggle('with-hand', !!cards.length);
    const title = token.path === 'Sleeping' ? (isSleepingMystic(token) ? 'Archivo y Moves' : 'Moves') : `Loadout ${loadoutNames(token).length}/${loadoutCap(token)}`;
    this.root.innerHTML = sanitizeHTML(`
      <div class="card-hand-label"><span>${e(title)}</span>${token.path !== 'Sleeping' ? `<button type="button" class="card-hand-vault" data-open-vault title="Recall: traer Poderes del Vault al Loadout">Vault · ${vault.length}</button>` : ''}</div>
      <div class="card-hand-fan" style="--n:${n}">${hand.map((card, i) => `<button type="button" class="vf-card ${card.playable ? '' : 'passive'} ${card.playable && !affordable(token, card) ? 'unaffordable' : ''}" data-card="${e(card.id)}" style="--i:${i};--offset:${(i - (n - 1) / 2).toFixed(2)}" aria-label="${e(card.name)} · ${e(costLabel(card.cost))}">${cardFace(card)}</button>`).join('')}</div>`);
    // The fan opens as far as the hand is wide; with many cards they overlap more.
    // The hand takes the room the stats leave free, so neither covers the other.
    const room = (this.root.parentElement?.clientWidth || 0) - (this.quickbar.offsetWidth || 0) - 44;
    if (room > 0) this.root.style.width = `${Math.max(240, Math.min(560, room))}px`;
    const width = this.root.clientWidth || 520, cardWidth = this.root.querySelector('.vf-card')?.offsetWidth || 124;
    // A big hand keeps the same gentle arc: the outer cards never tip over or sink off screen.
    const half = Math.max(1, (n - 1) / 2), fan = this.root.querySelector('.card-hand-fan');
    fan.style.setProperty('--tilt', `${Math.min(4, 14 / half).toFixed(2)}deg`); fan.style.setProperty('--drop', `${(22 / (half * half)).toFixed(2)}px`);
    fan.style.setProperty('--spread', `${Math.max(18, Math.min(92, (width - cardWidth) / Math.max(1, n - 1))).toFixed(1)}px`);
    this.bind();
  }

  bind() {
    const vault = this.root.querySelector('[data-open-vault]');
    if (vault) vault.onclick = () => this.openVault();
    for (const node of this.root.querySelectorAll('.vf-card')) {
      const card = this.cards.find(c => c.id === node.dataset.card);
      node.onpointermove = event => { // the card tilts towards the pointer
        const box = node.getBoundingClientRect(), x = (event.clientX - box.left) / box.width - 0.5, y = (event.clientY - box.top) / box.height - 0.5;
        node.style.setProperty('--ry', `${(x * 16).toFixed(1)}deg`); node.style.setProperty('--rx', `${(-y * 12).toFixed(1)}deg`);
        node.style.setProperty('--sx', `${((x + 0.5) * 100).toFixed(0)}%`); node.style.setProperty('--sy', `${((y + 0.5) * 100).toFixed(0)}%`);
      };
      node.onpointerleave = () => { for (const name of ['--rx', '--ry']) node.style.removeProperty(name); };
      node.onpointerdown = event => { if (event.button === 0) this.track(event, node, card); };
      node.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.inspect(card); } };
    }
  }

  // Click inspects; dragging past a few pixels lifts the card so it can be dropped on the map.
  track(down, node, card) {
    let ghost = null;
    const viewport = document.getElementById('canvas_viewport_root');
    const overBoard = event => { const box = viewport?.getBoundingClientRect(); return !!box && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom && !this.root.contains(document.elementFromPoint(event.clientX, event.clientY)) && !this.quickbar.contains(document.elementFromPoint(event.clientX, event.clientY)); };
    const move = event => {
      if (!ghost && Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < DRAG_START) return;
      if (!ghost) {
        ghost = document.createElement('div'); ghost.className = 'vf-card vf-card-ghost'; ghost.innerHTML = sanitizeHTML(cardFace(card));
        document.body.append(ghost); node.classList.add('dragging'); viewport?.classList.add('card-drop-target');
      }
      ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`;
      ghost.classList.toggle('over-board', overBoard(event));
    };
    const end = event => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
      viewport?.classList.remove('card-drop-target'); node.classList.remove('dragging');
      if (!ghost) { if (event.type === 'pointerup') this.inspect(card); return; }
      const dropped = event.type === 'pointerup' && overBoard(event);
      ghost.remove();
      if (!dropped) return;
      const box = viewport.getBoundingClientRect(), point = window.veilCanvas?.screenToWorld?.(event.clientX - box.left, event.clientY - box.top) || null;
      this.use(card, point);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  }

  // A card whose Resolve is chosen by the player (open Moves, Uncanny Power) asks how many.
  use(card, point = null) {
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token) return;
    if (!card.playable) { this.inspect(card); return; }
    if (card.kind === 'archive' || (card.cost.open && card.cost.resolve)) { this.inspect(card, point); return; }
    this.play(card, point);
  }

  async play(card, point = null, resolveSpent = null) {
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token) return false;
    try {
      const playerName = store.state.userName || store.state.playerName || 'Jugador';
      const result = await network.requestAction({ type: 'CARD_PLAY', actorId: token.id, cardId: card.id, resolveSpent, playerName, tokenName: token.name });
      const detail = [result.summary, ...(result.notes || [])].join(' ');
      window.veilDiceEngine?.showCallout?.({ playerName, tokenName: token.name, label: card.name, skill: card.name, outcome: result.failed ? 'NO SE MANIFIESTA' : result.outcomeTitle, modifiers: detail, details: detail });
      if (point) { window.veilCanvas?.triggerPing?.(point.x, point.y, card.color); network.broadcast?.({ type: 'PING', x: point.x, y: point.y }); }
      const line = `🂠 ${token.name} juega ${card.name} — ${detail}`;
      network.sendChat({ text: line.slice(0, 1900), recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: token.name, text: line, channel: 'table' }));
      if (result.roll && !result.failed) { window.veilDiceRoller?.prepareCheck?.({ tokenId: token.id, ...result.roll }); notify(`${card.name}: tirada preparada (${result.roll.traitId}, DC ${result.roll.dc}). Pulsa ROLL.`); }
      return true;
    } catch (error) { notify(error.message, 'error'); return false; }
  }

  inspect(card, point = null) {
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token) return;
    const chooses = card.playable && (card.kind === 'archive' || (card.cost.open && card.cost.resolve)), available = token.resolve?.current || 0;
    const modal = dossierDialog(card.name, `
      <div class="card-inspect">
        <div class="vf-card vf-card-large">${cardFace(card, { large: true })}</div>
        <div class="card-inspect-side">
          <p class="dossier-muted">${e(card.subtitle)}</p>
          <p class="card-inspect-text">${e(card.text).replace(/\n/g, '<br>')}</p>
          ${card.kind === 'archive' ? '<p class="dossier-muted">Uncanny Power: gasta Resolve, tira un dado de Resolve por cada uno y suma Knowledge; el resultado es el nivel máximo que alcanzas. El Keeper gana 1 Fear por Resolve. Ignoras el coste de Hope y tiras Knowledge contra DC 10 + nivel.</p>' : ''}
          ${card.zone === 'vault' ? '<p class="dossier-muted">Esta carta está en el Vault. Tráela al Loadout con un Recall.</p>' : ''}
          ${!card.playable && card.zone !== 'vault' ? '<p class="dossier-muted">Carta pasiva, de reacción no reproducible o proyecto a largo plazo: se consulta, no se juega desde la mano.</p>' : ''}
          ${chooses ? `<label class="dossier-field"><span>Resolve que gastas (tienes ${available})</span><input class="hud-input" type="number" name="card_resolve" min="1" max="${Math.max(1, available)}" value="${Math.max(1, card.cost.resolve || 1)}" /></label>` : ''}
          <p class="dossier-error" role="alert"></p>
          <footer class="dossier-footer">${card.zone === 'vault' ? '<button type="button" class="hud-btn hud-btn-primary" data-card-recall>Recall al Loadout</button>' : card.playable ? `<button type="button" class="hud-btn hud-btn-primary" data-card-play>Jugar · ${e(card.kind === 'archive' ? 'Uncanny Power' : costLabel(card.cost))}</button>` : ''}</footer>
        </div>
      </div>`, 'card-inspect-dialog');
    const playButton = modal.querySelector('[data-card-play]');
    if (playButton) playButton.onclick = async () => {
      const spent = chooses ? Math.max(1, Number(modal.querySelector('[name="card_resolve"]').value) || 1) : null;
      playButton.disabled = true;
      if (await this.play(card, point, spent)) modal.remove(); else playButton.disabled = false;
    };
    const recall = modal.querySelector('[data-card-recall]');
    if (recall) recall.onclick = () => { modal.remove(); this.openVault(card.name); };
    return modal;
  }

  openVault(selected = '') {
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token) return null;
    const vault = this.cards.filter(c => c.zone === 'vault'), loadout = this.cards.filter(c => c.kind === 'power'), full = loadout.length >= loadoutCap(token);
    const modal = dossierDialog(`VAULT · ${token.name}`, vault.length ? `
      <form class="card-vault">
        <p class="dossier-muted">El Loadout es lo que tienes preparado (${loadout.length}/${loadoutCap(token)}). El Vault es lo demás que conoces: para usarlo hay que traerlo con un Recall, y cuesta más cuanto más cerca estás del peligro.</p>
        <div class="dossier-identity">
          <label class="dossier-field"><span>Poder del Vault</span><select class="hud-select" name="vault_power">${vault.map(c => `<option value="${e(c.name)}" ${c.name === selected ? 'selected' : ''}>${e(c.name)} · ${e(c.subtitle)} · RC ${c.rc}</option>`).join('')}</select></label>
          <label class="dossier-field"><span>Momento</span><select class="hud-select" name="vault_mode">${Object.entries(RECALL_MODES).map(([id, m]) => `<option value="${id}" ${id === 'scene' ? 'selected' : ''}>${e(m.name)}</option>`).join('')}</select></label>
          ${full ? `<label class="dossier-field"><span>Loadout lleno: pasa al Vault</span><select class="hud-select" name="vault_replace">${loadout.map(c => `<option value="${e(c.name)}">${e(c.name)}</option>`).join('')}</select></label>` : ''}
        </div>
        <p class="dossier-muted" data-vault-cost></p>
        <div class="card-vault-preview" data-vault-preview></div>
        <p class="dossier-error" role="alert"></p>
        <footer class="dossier-footer"><button class="hud-btn hud-btn-primary" type="submit">Hacer Recall</button></footer>
      </form>` : '<p class="dossier-muted">El Vault está vacío. Los Poderes nuevos que aprendas al subir de nivel entran aquí.</p>', 'card-vault-dialog');
    const form = modal.querySelector('form');
    if (!form) return modal;
    const refresh = () => {
      const card = vault.find(c => c.name === form.elements.vault_power.value), mode = form.elements.vault_mode.value, cost = recallCost(card, mode);
      modal.querySelector('[data-vault-cost]').textContent = `${RECALL_MODES[mode].text} Coste: ${[cost.stress && `${cost.stress} Stress`, cost.hope && `${cost.hope} Hope`, cost.action && 'tu Acción'].filter(Boolean).join(' + ') || 'ninguno'}.`;
      modal.querySelector('[data-vault-preview]').innerHTML = sanitizeHTML(`<div class="vf-card vf-card-large">${cardFace(card, { large: true })}</div>`);
    };
    form.elements.vault_power.onchange = refresh; form.elements.vault_mode.onchange = refresh; refresh();
    form.onsubmit = async event => {
      event.preventDefault();
      try {
        const result = await network.requestAction({ type: 'CARD_RECALL', actorId: token.id, name: form.elements.vault_power.value, mode: form.elements.vault_mode.value, replace: form.elements.vault_replace?.value || '' });
        const line = `🂠 ${token.name} · ${result.summary}`;
        network.sendChat({ text: line, recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: token.name, text: line, channel: 'table' }));
        notify(result.summary); modal.remove();
      } catch (error) { modal.querySelector('.dossier-error').textContent = error.message; }
    };
    return modal;
  }
}
