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
const pills = card => {
  const c = card.cost, list = [];
  if (card.type && (card.kind === 'power' || card.kind === 'vault' || card.kind === 'archive')) list.push(['type', card.type.replace(/\s*\(.*$/, '')]);
  if (card.tier) list.push(['plain', card.tier]);
  if (card.kind === 'archive') list.push(['resolve', '1+ Resolve']);
  if (c.hope && card.kind !== 'archive') list.push(['hope', `${c.hope} Hope`]);
  if (c.stress) list.push(['stress', `${c.stress} Stress`]);
  if (c.effort) list.push(['effort', `${c.effort} Effort`]);
  if (c.resolve) list.push(['resolve', `${c.resolve}${c.open ? '+' : ''} Resolve`]);
  if (c.hp) list.push(['stress', `${c.hp} HP`]);
  if (c.open && !c.resolve) list.push(['plain', 'Variable']);
  if (card.reaction) list.push(['plain', 'Reaction']);
  if (card.rollText) list.push(['roll', card.rollText]);
  return list.map(([tone, label]) => `<span class="vf-card-pill ${tone}">${e(label)}</span>`).join('');
};
// The corner badge: the main price of the card at a glance.
const badge = card => {
  const c = card.cost;
  if (card.kind === 'archive') return ['resolve', '1+'];
  if (c.hope) return ['hope', c.hope]; if (c.effort) return ['effort', c.effort];
  if (c.resolve) return ['resolve', `${c.resolve}${c.open ? '+' : ''}`]; if (c.stress) return ['stress', c.stress];
  return null;
};

// The card follows the supplied art: gold frame, the flag of its Domain or Class hanging in
// the corner (with the level for Powers), the name band, and the rules on a light panel.
export function cardFace(card, { large = false } = {}) {
  const art = card.art || { flag: '', band: '', layout: 'band' }, price = badge(card);
  const footLeft = card.domain ? `${card.domain} · LV ${card.level}` : CARD_KINDS[card.kind], footRight = card.kind === 'power' || card.kind === 'vault' ? `RC ${card.rc}` : '';
  return `
    <span class="vf-card-frame layout-${e(art.layout)}" style="--card-color:${e(card.color)}">
      <span class="vf-card-art">
        ${art.flag ? `<span class="vf-card-flag"><img src="${e(art.flag)}" alt="" draggable="false" />${card.level ? `<b>${card.level}</b>` : ''}</span>` : ''}
        ${price ? `<span class="vf-card-badge ${price[0]}">${e(String(price[1]))}</span>` : ''}
        ${art.band ? `<img class="vf-card-band" src="${e(art.band)}" alt="" draggable="false" />` : ''}
      </span>
      <span class="vf-card-body">
        <strong class="vf-card-title">${e(card.name)}</strong>
        <span class="vf-card-pills">${pills(card)}</span>
        <span class="vf-card-text">${e(large ? card.text : card.text.slice(0, 170) + (card.text.length > 170 ? '…' : ''))}</span>
        <span class="vf-card-foot"><em>${e(footLeft)}</em><em>${e(footRight)}</em></span>
      </span>
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
      <div class="card-hand-label"><span>${e(title)}</span></div>
      <div class="card-hand-fan" style="--n:${n}">${hand.map((card, i) => `<button type="button" class="vf-card ${card.playable ? '' : 'passive'} ${card.playable && !affordable(token, card) ? 'unaffordable' : ''}" data-card="${e(card.id)}" style="--i:${i};--offset:${(i - (n - 1) / 2).toFixed(2)}" aria-label="${e(card.name)} · ${e(costLabel(card.cost))}">${cardFace(card)}</button>`).join('')}</div>
      ${token.path !== 'Sleeping' ? `<button type="button" class="card-deck" data-open-vault title="Mazo: cambia los Poderes de tu Loadout por los del Vault" aria-label="Abrir el mazo. ${vault.length} Poderes en el Vault"><span class="card-deck-stack"><i></i><i></i><i></i></span><b>${vault.length}</b></button>` : ''}`);
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
    if (vault) vault.onclick = () => this.toggleDrawer();
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
      // Who used it, what it cost and what it does, for the whole table.
      const effect = card.text.replace(/\s+/g, ' ').trim();
      const line = `🂠 ${playerName} (${token.name}) usa ${card.name} [${CARD_KINDS[card.kind]}] — ${detail} Efecto: ${effect}`;
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
    if (recall) recall.onclick = () => { modal.remove(); this.toggleDrawer(card.name, true); };
    return modal;
  }

  // The deck drawer: Loadout above, Vault below. Pick a Vault card, pick the moment, and if the
  // Loadout is full pick the card that leaves. Nothing is paid until Recall is pressed.
  toggleDrawer(selected = '', forceOpen = false) {
    const open = document.getElementById('card_deck_drawer');
    if (open) { open.remove(); if (!forceOpen) return null; }
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token) return null;
    const drawer = document.createElement('section');
    drawer.id = 'card_deck_drawer'; drawer.className = 'card-drawer'; drawer.setAttribute('aria-label', 'Mazo de cartas');
    this.root.parentElement.append(drawer);
    const choice = { vault: selected, replace: '', mode: 'scene' };
    const draw = () => {
      const live = store.state.tokens.find(t => t.id === this.tokenId), data = cardData();
      if (!live || !data) { drawer.remove(); return; }
      const cards = characterCards(live, data), vault = cards.filter(c => c.zone === 'vault'), loadout = cards.filter(c => c.kind === 'power'), cap = loadoutCap(live), full = loadout.length >= cap;
      if (!vault.some(c => c.name === choice.vault)) choice.vault = '';
      if (!loadout.some(c => c.name === choice.replace)) choice.replace = '';
      const picked = vault.find(c => c.name === choice.vault), cost = picked ? recallCost(picked, choice.mode) : null;
      const price = cost ? [cost.stress && `${cost.stress} Stress`, cost.hope && `${cost.hope} Hope`, cost.action && 'tu Acción'].filter(Boolean).join(' + ') || 'gratis' : '';
      const step = !vault.length ? 'El Vault está vacío. Los Poderes que aprendas al subir de nivel entran aquí.'
        : !picked ? '1 · Elige la carta del Vault que quieres preparar.'
        : full && !choice.replace ? `2 · El Loadout está lleno (${cap}): elige la carta que pasa al Vault.`
        : `Listo: ${picked.name} entra${choice.replace ? ` y ${choice.replace} sale` : ''}. Coste: ${price}.`;
      const mini = (card, zone) => `<button type="button" class="vf-card vf-card-mini ${(zone === 'vault' ? choice.vault : choice.replace) === card.name ? 'chosen' : ''}" data-drawer-${zone}="${e(card.name)}" title="${e(card.name)} · RC ${card.rc}">${cardFace(card)}</button>`;
      drawer.innerHTML = sanitizeHTML(`
        <header class="card-drawer-head"><strong>MAZO</strong><div class="card-drawer-modes" role="group" aria-label="Momento del Recall">${Object.entries(RECALL_MODES).map(([id, m]) => `<button type="button" class="equip-chip ${id === choice.mode ? 'active' : ''}" data-drawer-mode="${id}" title="${e(m.text)}">${e(m.name)}</button>`).join('')}</div><button type="button" class="card-drawer-close" data-drawer-close aria-label="Cerrar el mazo">×</button></header>
        <p class="card-drawer-step">${e(step)}</p>
        <h4>LOADOUT · ${loadout.length}/${cap}</h4><div class="card-drawer-row">${loadout.map(c => mini(c, 'loadout')).join('') || '<p class="dossier-muted">Sin Poderes preparados.</p>'}</div>
        <h4>VAULT · ${vault.length}</h4><div class="card-drawer-row">${vault.map(c => mini(c, 'vault')).join('') || '<p class="dossier-muted">Vacío.</p>'}</div>
        <p class="dossier-error" role="alert" data-drawer-error></p>
        <footer class="card-drawer-foot"><span class="dossier-muted">${e(RECALL_MODES[choice.mode].text)}</span><button type="button" class="hud-btn hud-btn-primary" data-drawer-recall ${picked && (!full || choice.replace) ? '' : 'disabled'}>Recall${price ? ` · ${e(price)}` : ''}</button></footer>`);
      drawer.querySelector('[data-drawer-close]').onclick = () => drawer.remove();
      drawer.querySelectorAll('[data-drawer-mode]').forEach(b => b.onclick = () => { choice.mode = b.dataset.drawerMode; draw(); });
      drawer.querySelectorAll('[data-drawer-vault]').forEach(b => b.onclick = () => { choice.vault = choice.vault === b.dataset.drawerVault ? '' : b.dataset.drawerVault; draw(); });
      // A Loadout card is only picked to make room; with room to spare it is just read.
      drawer.querySelectorAll('[data-drawer-loadout]').forEach(b => b.onclick = () => { if (full && picked) { choice.replace = choice.replace === b.dataset.drawerLoadout ? '' : b.dataset.drawerLoadout; draw(); } else this.inspect(loadout.find(c => c.name === b.dataset.drawerLoadout)); });
      drawer.querySelector('[data-drawer-recall]').onclick = async () => {
        try {
          const result = await network.requestAction({ type: 'CARD_RECALL', actorId: live.id, name: choice.vault, mode: choice.mode, replace: choice.replace });
          const line = `🂠 ${live.name} · ${result.summary}`;
          network.sendChat({ text: line, recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: live.name, text: line, channel: 'table' }));
          notify(result.summary); choice.vault = ''; choice.replace = ''; draw();
        } catch (error) { drawer.querySelector('[data-drawer-error]').textContent = error.message; }
      };
    };
    draw();
    return drawer;
  }
}

// The Keeper's card feed: when a player uses a card, a small copy lands in the bottom-right
// corner of the map; a click opens it full size with who used it and what it does.
export class CardFeed {
  constructor(parent) {
    this.entries = [];
    this.root = document.createElement('div');
    this.root.id = 'card_feed_root'; this.root.className = 'card-feed hidden'; this.root.setAttribute('aria-live', 'polite');
    parent.append(this.root);
    window.addEventListener('veil:card-played', event => this.add(event.detail));
    this.unsubscribe = store.subscribe((_, keys) => { if (keys.some(k => ['userRole', 'isConnected'].includes(k))) this.render(); });
  }
  isKeeper() { return store.sessionRole !== 'player' && store.state.userRole === 'keeper'; }
  add(entry) {
    if (!entry?.card) return;
    this.entries = [...this.entries, { ...entry, id: `${entry.at}-${Math.random().toString(36).slice(2, 7)}` }].slice(-CARD_FEED_LIMIT);
    const id = this.entries.at(-1).id;
    setTimeout(() => { this.entries = this.entries.filter(x => x.id !== id); this.render(); }, CARD_FEED_LIFE);
    this.render();
  }
  // Incremental: a card that arrives is added and one that expires is removed; the others are
  // left alone, so they never replay their entrance (redrawing the whole feed made them blink).
  render() {
    const shown = this.isKeeper() ? this.entries : [], ids = new Set(shown.map(x => x.id));
    this.root.classList.toggle('hidden', !shown.length);
    for (const node of [...this.root.children]) if (!ids.has(node.dataset.feed)) node.remove();
    const present = new Set([...this.root.children].map(node => node.dataset.feed));
    for (const x of shown) {
      if (present.has(x.id)) continue;
      const holder = document.createElement('div');
      holder.innerHTML = sanitizeHTML(`<button type="button" class="card-feed-item" data-feed="${e(x.id)}" title="${e(x.actorName)} usa ${e(x.card.name)}: clic para ampliar"><span class="vf-card vf-card-mini">${cardFace(x.card)}</span><span class="card-feed-who">${e(x.actorName)}${x.failed ? ' · no se manifiesta' : ''}</span></button>`);
      const button = holder.firstElementChild;
      button.onclick = () => this.open(this.entries.find(entry => entry.id === x.id));
      this.root.append(button);
    }
  }
  open(entry) {
    if (!entry) return null;
    const card = entry.card;
    return dossierDialog(`${entry.actorName} usa ${card.name}`, `
      <div class="card-inspect">
        <div class="vf-card vf-card-large">${cardFace(card, { large: true })}</div>
        <div class="card-inspect-side">
          <p class="dossier-muted">Usada por <strong>${e(entry.actorName)}</strong>${entry.playerName ? ` (${e(entry.playerName)})` : ''} · ${e(card.subtitle)}</p>
          <p class="card-inspect-text"><strong>${e(entry.summary)}</strong>${entry.notes?.length ? `<br>${e(entry.notes.join(' '))}` : ''}</p>
          <p class="card-inspect-text">${e(card.text).replace(/\n/g, '<br>')}</p>
        </div>
      </div>`, 'card-inspect-dialog');
  }
}
const CARD_FEED_LIMIT = 4, CARD_FEED_LIFE = 90000;
