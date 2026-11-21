// The card hand: next to the stats of the selected player character, its Loadout as a fan of
// 3D cards. A card is inspected with a click and played by dragging it onto the board.
import { store } from './state.js';
import { guideEvent } from './onboarding.js';
import { network } from './networkManager.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { dossierDialog } from './dossierUI.js';
import { cardData, loadCardData } from './cardData.js';
import { roundKey } from './combatState.js';
import { bearDown } from './bearDown.js';
import { throwDice } from './tableDice.js';
import { durationDice } from './effectClocks.js';
import { characterCards, keeperCards, costLabel, CARD_KINDS, cardKindName, RECALL_MODES, recallCost, loadoutNames, loadoutCap, isSleepingMystic, powerCard, powersInReach, catalogGroups } from './loadoutCards.js';

const KEEPER_KINDS = new Set(['fear', 'adversary']);
const keeperView = () => store.sessionRole !== 'player' && store.state.userRole === 'keeper';

const DRAG_START = 9; // pixels the pointer must travel before a click becomes a drag
const affordable = (token, card) => {
  if (KEEPER_KINDS.has(card.kind)) return (store.state.fear || 0) >= (card.cost.fear || 0);
  // A Common Effort can always be paid at 0 Effort through Burnout.
  if (card.kind === 'effort') return (token.effort || 0) >= card.cost.effort || (token.effort || 0) === 0;
  const c = card.cost, stressRoom = (token.stress?.max ?? 6) - (token.stress?.current || 0);
  if (card.kind === 'archive') return (token.resolve?.current || 0) >= 1 && c.stress <= stressRoom;
  return (token.hope || 0) >= c.hope && (token.effort || 0) >= c.effort && (token.resolve?.current || 0) >= c.resolve && c.stress <= stressRoom;
};
const pills = card => {
  const c = card.cost, list = [];
  if (card.type && (card.kind === 'power' || card.kind === 'vault' || card.kind === 'archive')) list.push(['type', card.type.replace(/\s*\(.*$/, '')]);
  if (card.category) list.push(['type', card.category]);
  if (card.tier) list.push(['plain', card.tier]);
  if (card.kind === 'archive') list.push(['resolve', '1+ Resolve']);
  if (c.fear) list.push(['fear', `${c.fear} Fear`]);
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
  if (c.fear) return ['fear', c.fear];
  if (c.hope) return ['hope', c.hope]; if (c.effort) return ['effort', c.effort];
  if (c.resolve) return ['resolve', `${c.resolve}${c.open ? '+' : ''}`]; if (c.stress) return ['stress', c.stress];
  return null;
};

// The card: gold frame; at the top its name and cost (what shows in the hand, where the lower
// part is hidden); then the flag of its Domain or Class (with the level for Powers) and the
// name band; and below, the rules on a white panel.
export function cardFace(card, { large = false } = {}) {
  const art = card.art || { flag: '', band: '', layout: 'band' }, price = badge(card);
  const footLeft = card.domain ? `${card.domain} · LV ${card.level}` : cardKindName(card.kind), footRight = card.kind === 'power' || card.kind === 'vault' ? `RC ${card.rc}` : '';
  return `
    <span class="vf-card-frame layout-${e(art.layout)}" style="--card-color:${e(card.color)}">
      <span class="vf-card-head"><strong class="vf-card-title">${e(card.name)}</strong>${price ? `<span class="vf-card-badge ${price[0]}">${e(String(price[1]))}</span>` : ''}</span>
      <span class="vf-card-art">
        ${Number.isInteger(art.cell) && art.cell >= 0 && art.cell < 9 ? `<span class="vf-sheet-window"><img class="vf-power-picture vf-sheet-picture" src="${e(art.illustration)}" style="left:-${art.cell % 3 * 100}%;top:-${Math.floor(art.cell / 3) * 100}%" alt="" draggable="false" /></span>` : art.illustration ? `<img class="vf-power-picture" src="${e(art.illustration)}" alt="" loading="lazy" draggable="false" />` : ''}
        ${art.flag ? `<span class="vf-card-flag"><img src="${e(art.flag)}" alt="" draggable="false" />${card.level ? `<b>${card.level}</b>` : ''}</span>` : ''}
        ${art.band ? `<img class="vf-card-band" src="${e(art.band)}" alt="" draggable="false" />` : ''}
      </span>
      <span class="vf-card-body">
        <span class="vf-card-pills">${pills(card)}</span>
        <span class="vf-card-text">${e(large ? card.text : card.text.slice(0, 170) + (card.text.length > 170 ? '…' : ''))}</span>
        <span class="vf-card-foot"><em>${e(footLeft)}</em><em>${e(footRight)}</em></span>
      </span>
      <span class="vf-card-shine"></span>
    </span>`;
}

// The deck icon of a hand without a Vault (the Keeper's, a Sleeping character's): it opens the
// whole catalog of Powers to read.
// The books' light markup in a card's text: **bold**, *italic* and line breaks (escaped first).
export const richText = value => e(value).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>').replace(/\n/g, '<br>');
const deckButton = title => `<button type="button" class="card-deck card-deck-catalog" data-open-vault title="${e(title)}" aria-label="${e(title)}"><span class="card-deck-stack"><i></i><i></i><i></i></span><b>∞</b></button>`;

// The deck also holds every Ancestry, Community and class card to read (user request): a chip
// row picks what to show; the classes are grouped Awakened / Sleeping, then by class.
const DECK_KINDS = [['powers', 'Poderes'], ['ancestry', 'Ancestry'], ['community', 'Community'], ['class', 'Clases']];
const deckKindChips = choice => `<div class="equip-chips card-drawer-kinds" role="group" aria-label="Tipo de carta">${DECK_KINDS.map(([id, label]) => `<button type="button" class="equip-chip ${choice.kind === id ? 'active' : ''}" data-drawer-kind="${id}" aria-pressed="${choice.kind === id}">${label}</button>`).join('')}</div>`;
let groupsCache = null;
const referenceGroups = data => (groupsCache?.data === data ? groupsCache.groups : (groupsCache = { data, groups: catalogGroups(data) }).groups);
function referenceHTML(data, choice) {
  const all = referenceGroups(data);
  const groups = choice.kind === 'class' ? (choice.path === 'sleeping' ? all.sleeping : all.awakened) : all[choice.kind] || [];
  const paths = choice.kind === 'class' ? `<div class="equip-chips" role="group" aria-label="Senda">${[['awakened', 'Awakened'], ['sleeping', 'Sleeping']].map(([id, label]) => `<button type="button" class="equip-chip ${choice.path === id ? 'active' : ''}" data-drawer-path="${id}">${label}</button>`).join('')}</div>` : '';
  return `${paths}${groups.map(g => `<h5 class="card-drawer-group">${e(g.group)} · ${g.cards.length}</h5><div class="card-drawer-row card-drawer-catalog">${g.cards.map(c => `<button type="button" class="vf-card vf-card-mini" data-drawer-ref="${e(c.id)}" title="${e(c.name)} · ${e(c.subtitle)}">${cardFace(c)}</button>`).join('')}</div>`).join('')}`;
}
function bindReference(drawer, data, choice, redraw, inspect) {
  drawer.querySelectorAll('[data-drawer-kind]').forEach(b => b.onclick = () => { choice.kind = b.dataset.drawerKind; redraw(); });
  drawer.querySelectorAll('[data-drawer-path]').forEach(b => b.onclick = () => { choice.path = b.dataset.drawerPath; redraw(); });
  const all = referenceGroups(data), cards = [...all.ancestry, ...all.community, ...all.awakened, ...all.sleeping].flatMap(g => g.cards);
  drawer.querySelectorAll('[data-drawer-ref]').forEach(b => b.onclick = () => { const card = cards.find(c => c.id === b.dataset.drawerRef); if (card) inspect(card); });
}

export class CardHand {
  constructor(quickbar) {
    this.quickbar = quickbar; this.signature = ''; this.cards = []; this.tokenId = null;
    this.root = document.createElement('div');
    this.root.id = 'card_hand_root'; this.root.className = 'card-hand hidden';
    quickbar.parentElement.append(this.root);
    this.unsubscribe = store.subscribe(() => this.render());
    this.render();
  }

  // The hand belongs to the player stance: the character you control, selected. The Keeper's
  // own table (local or hosting) previewing the Player view sees the hand of any character.
  owner() {
    const selected = store.getSelectedToken?.();
    const playerStance = store.sessionRole === 'player' || store.state.userRole !== 'keeper';
    if (!playerStance) return null;
    const mine = t => t && t.isPlayer !== false && t.actorType !== 'drone' && (store.sessionRole !== 'player' || store.canEditToken(t.id));
    if (mine(selected)) return selected;
    // An ally (or an enemy) selected on the map: the hand stays with the character being played,
    // and that ally is who an effect for others goes to.
    const claimed = store.state.tokens.find(t => t.id === store.state.claimedTokenId);
    return selected && mine(claimed) ? claimed : null;
  }

  render() {
    if (keeperView()) return this.renderKeeper();
    const token = this.owner(), data = cardData();
    // The rules data (~375 KB) is only fetched once a player character's hand has to be shown.
    if (token && !data) loadCardData().then(() => this.render()).catch(error => console.warn('[CardHand] rules data', error));
    // No character of yours selected: the hand is just the deck, to read every Power.
    if (!token) {
      if (this.signature === 'deck-only') return;
      this.signature = 'deck-only'; this.tokenId = null; this.cards = [];
      this.root.classList.remove('hidden'); this.quickbar.classList.remove('with-hand');
      this.root.innerHTML = sanitizeHTML(deckButton('Mazo: consulta todos los Poderes del juego'));
      this.root.querySelector('[data-open-vault]').onclick = () => this.toggleDrawer('', false, { catalogOnly: true });
      return;
    }
    // While the rules data loads, the deck stays in sight (it is always visible).
    if (!data) { this.signature = ''; this.tokenId = null; this.root.classList.remove('hidden'); this.quickbar.classList.remove('with-hand'); this.root.innerHTML = sanitizeHTML(deckButton('Mazo: consulta todos los Poderes del juego')); this.root.querySelector('[data-open-vault]').onclick = () => this.toggleDrawer('', false, { catalogOnly: true }); return; }
    const cards = characterCards(token, data, { optionalEfforts: !!store.state.optionalEfforts });
    const signature = JSON.stringify([token.id, token.hope, token.effort, token.stress?.current, token.resolve?.current, cards.map(c => c.id)]);
    if (signature === this.signature) return;
    this.signature = signature; this.cards = cards; this.tokenId = token.id;
    const hand = cards.filter(c => c.zone !== 'vault'), vault = cards.filter(c => c.zone === 'vault'), n = hand.length;
    this.root.classList.remove('hidden'); this.quickbar.classList.add('with-hand');
    if (!cards.length) {
      // Say why instead of showing nothing: the sheet has no class, ancestry or Powers to read.
      this.root.innerHTML = sanitizeHTML(`<div class="card-hand-empty"><strong>Sin cartas</strong><p>La ficha de ${e(token.name)} no indica clase, ancestry, background ni Poderes, así que no hay cartas que mostrar.</p><button type="button" class="hud-btn hud-btn-xs" data-open-sheet>Completar la ficha</button></div>${deckButton('Mazo: consulta todos los Poderes del juego')}`);
      this.root.querySelector('[data-open-vault]').onclick = () => this.toggleDrawer('', false, { catalogOnly: true });
      this.root.querySelector('[data-open-sheet]').onclick = async () => { const { openDossier } = await import('./dossierUI.js'); openDossier(store.state.tokens.find(t => t.id === token.id), () => {}, 'stats'); };
      return;
    }
    const title = token.path === 'Sleeping' ? (isSleepingMystic(token) ? 'Archivo y Moves' : 'Moves') : `Loadout ${loadoutNames(token).length}/${loadoutCap(token)}`;
    this.root.innerHTML = sanitizeHTML(`
      <div class="card-hand-label"><span>${e(title)}</span></div>
      <div class="card-hand-fan" style="--n:${n}">${hand.map((card, i) => `<button type="button" class="vf-card ${card.playable ? '' : 'passive'} ${card.playable && !affordable(token, card) ? 'unaffordable' : ''}" data-card="${e(card.id)}" style="--i:${i};--offset:${(i - (n - 1) / 2).toFixed(2)}" aria-label="${e(card.name)} · ${e(costLabel(card.cost))}">${cardFace(card)}</button>`).join('')}</div>
      ${token.path !== 'Sleeping' ? `<button type="button" class="card-deck" data-open-vault title="Mazo: cambia los Poderes de tu Loadout por los del Vault" aria-label="Abrir el mazo. ${vault.length} Poderes en el Vault"><span class="card-deck-stack"><i></i><i></i><i></i></span><b>${vault.length}</b></button>` : deckButton('Mazo: consulta todos los Poderes')}`);
    this.layoutFan(n);
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

  layoutFan(n) {
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

  // The Keeper's hand: the Fear moves, plus the abilities of the adversary selected, if any.
  renderKeeper() {
    const selected = store.getSelectedToken?.(), token = selected && selected.isPlayer === false && selected.actorType !== 'drone' ? selected : null;
    const cards = keeperCards(token), fear = store.state.fear || 0;
    const signature = JSON.stringify(['keeper', token?.id, token?.featureNotes?.length, fear, cards.map(c => c.id)]);
    if (signature === this.signature) return;
    this.signature = signature; this.cards = cards; this.tokenId = token?.id || null;
    this.root.classList.remove('hidden'); this.quickbar.classList.add('with-hand');
    const n = cards.length;
    this.root.innerHTML = sanitizeHTML(`
      <div class="card-hand-label"><span>Fear ${fear}/12${token ? ` · ${e(token.name)}` : ''}</span></div>
      <div class="card-hand-fan" style="--n:${n}">${cards.map((card, i) => `<button type="button" class="vf-card ${card.playable ? '' : 'passive'} ${card.playable && !affordable(null, card) ? 'unaffordable' : ''}" data-card="${e(card.id)}" style="--i:${i};--offset:${(i - (n - 1) / 2).toFixed(2)}" aria-label="${e(card.name)} · ${e(card.costText)}">${cardFace(card)}</button>`).join('')}</div>
      ${deckButton('Mazo: consulta todos los Poderes del juego')}`);
    this.layoutFan(n);
    const deck = this.root.querySelector('[data-open-vault]');
    if (deck) deck.onclick = () => this.toggleDrawer('', false, { catalogOnly: true });
  }

  // A card whose Resolve is chosen by the player (open Moves, Uncanny Power, Bear Down) asks how
  // many; a Common Effort at 0 Effort asks to confirm Burnout.
  use(card, point = null) {
    if (KEEPER_KINDS.has(card.kind)) { if (card.playable) this.playKeeper(card, point); else this.inspect(card); return; }
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token) return;
    if (card.kind === 'effort' && (token.effort || 0) < card.cost.effort) { this.inspect(card, point); return; }
    if (!card.playable) { this.inspect(card); return; }
    if (card.kind === 'archive' || (card.cost.open && card.cost.resolve)) { this.inspect(card, point); return; }
    this.play(card, point);
  }

  async play(card, point = null, resolveSpent = null, { burnout = false } = {}) {
    if (KEEPER_KINDS.has(card.kind)) return this.playKeeper(card, point);
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token) return false;
    if (card.kind === 'beardown' || card.kind === 'effort') return this.playSleeping(card, token, point, resolveSpent, burnout);
    try {
      const playerName = store.state.userName || store.state.playerName || 'Jugador';
      // The ally marked on the map receives an effect meant for others (Rapid Regeneration…).
      // (the marked target, or the ally selected on the map: touch your companion, then play).
      const picked = [store.state.targetTokenId, store.state.selectedTokenId].find(id => id && id !== token.id && store.state.tokens.some(t => t.id === id && t.isPlayer !== false));
      const targetId = picked || undefined;
      // A duration set by a die (Rapid Regeneration: 1d4 turns) is thrown here, as 3D dice.
      const dd = durationDice(card);
      const durationFaces = dd ? await throwDice([{ qty: dd.qty, sides: dd.sides, role: 'Duración' }], { label: `${card.name} · duración`, actor: token,
        describe: v => ({ outcome: `${v.reduce((a, b) => a + b, 0)} turnos`, modifiers: `${dd.qty}d${dd.sides} [${v.join(', ')}]` }) }) : null;
      const result = await network.requestAction({ type: 'CARD_PLAY', actorId: token.id, cardId: card.id, resolveSpent, playerName, tokenName: token.name, ...(targetId ? { targetId } : {}), ...(durationFaces ? { durationFaces } : {}) });
      const detail = [result.summary, ...(result.notes || [])].join(' ');
      window.veilDiceEngine?.showCallout?.({ playerName, tokenName: token.name, label: card.name, skill: card.name, outcome: result.failed ? 'NO SE MANIFIESTA' : result.outcomeTitle, modifiers: detail, details: detail });
      if (point) { window.veilCanvas?.triggerPing?.(point.x, point.y, card.color); network.broadcast?.({ type: 'PING', x: point.x, y: point.y }); }
      // Who used it, what it cost and what it does, for the whole table.
      const effect = card.text.replace(/\s+/g, ' ').trim();
      const line = `🂠 ${playerName} (${token.name}) usa ${card.name} [${cardKindName(card.kind)}] — ${detail} Efecto: ${effect}`;
      network.sendChat({ text: line.slice(0, 1900), recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: token.name, text: line, channel: 'table' }));
      if (result.roll && !result.failed) { window.veilDiceRoller?.prepareCheck?.({ tokenId: token.id, ...result.roll }); notify(`${card.name}: tirada preparada (${result.roll.traitId}, DC ${result.roll.dc}). Pulsa ROLL.`); }
      guideEvent('card');
      return true;
    } catch (error) { notify(error.message, 'error'); return false; }
  }

  // Bear Down and the Common Efforts go through the actions the quickbar already used, so their
  // effects (the +2 of Steady Hands, Advantage, Brace) are prepared exactly as before.
  async playSleeping(card, token, point, resolveSpent, burnout) {
    try {
      const playerName = store.state.userName || store.state.playerName || 'Jugador';
      let summary;
      if (card.kind === 'beardown') {
        // After a damage roll that is still open, Bear Down adds to the damage; otherwise to the
        // latest check or attack.
        ({ summary } = await bearDown(token, resolveSpent));
      } else {
        const result = await network.requestAction({ type: 'EFFORT', actorId: token.id, move: card.move, burnout });
        summary = `${card.name} · ${result?.log?.details || ''}`.trim();
      }
      window.veilDiceEngine?.showCallout?.({ playerName, tokenName: token.name, label: card.name, skill: card.name, outcome: cardKindName(card.kind).toUpperCase(), modifiers: summary, details: summary });
      if (point) { window.veilCanvas?.triggerPing?.(point.x, point.y, card.color); network.broadcast?.({ type: 'PING', x: point.x, y: point.y }); }
      const line = `🂠 ${playerName} (${token.name}) usa ${card.name} — ${summary} Efecto: ${card.text}`;
      network.sendChat({ text: line.slice(0, 1900), recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: token.name, text: line, channel: 'table' }));
      guideEvent('card');
      return true;
    } catch (error) { notify(error.message, 'error'); return false; }
  }

  async playKeeper(card, point = null) {
    const played = await playKeeperMove(card, point);
    if (played) this.render();
    return played;
  }

  inspect(card, point = null) {
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    // Reference cards of the deck (and the Powers of the catalog) are read without a character.
    const reference = card.zone === 'catalog' || card.zone === 'vault';
    if (!token && !KEEPER_KINDS.has(card.kind) && !reference) return;
    const burnoutOnly = card.kind === 'effort' && (token?.effort || 0) === 0;
    const chooses = card.playable && (card.kind === 'archive' || (card.cost.open && card.cost.resolve)), available = token?.resolve?.current || 0;
    const modal = dossierDialog(card.name, `
      <div class="card-inspect">
        <div class="vf-card vf-card-large">${cardFace(card, { large: true })}</div>
        <div class="card-inspect-side">
          <p class="dossier-muted">${e(card.subtitle)}</p>
          <p class="card-inspect-text">${richText(card.text)}</p>
          ${card.kind === 'archive' ? '<p class="dossier-muted">Uncanny Power: gasta Resolve, tira un dado de Resolve por cada uno y suma Knowledge; el resultado es el nivel máximo que alcanzas. El Keeper gana 1 Fear por Resolve. Ignoras el coste de Hope y tiras Knowledge contra DC 10 + nivel.</p>' : ''}
          ${card.zone === 'vault' ? '<p class="dossier-muted">Esta carta está en el Vault. Tráela al Loadout con un Recall.</p>' : ''}
          ${card.zone === 'catalog' ? '<p class="dossier-muted">Carta de consulta del mazo: se juega desde la mano del personaje que la tiene.</p>' : ''}
          ${!card.playable && card.zone !== 'vault' && card.zone !== 'catalog' ? '<p class="dossier-muted">Carta pasiva, de reacción no reproducible o proyecto a largo plazo: se consulta, no se juega desde la mano.</p>' : ''}
          ${KEEPER_KINDS.has(card.kind) ? `<p class="dossier-muted">Fear del Keeper: ${store.state.fear || 0}/12.${card.kind === 'adversary' ? ' Una criatura usa como mucho una Fear Ability por ciclo de Spotlight, más una Reaction defensiva.' : ''}</p>` : ''}
          ${burnoutOnly ? '<p class="dossier-muted">No te queda Effort: puedes usarla con Burnout. Pagas 1 HP, marcas 1 Stress y tu Stress máximo baja 1 hasta tu próxima Recovery.</p>' : card.kind === 'effort' && (token.effort || 0) < card.cost.effort ? `<p class="dossier-error">Hace falta ${card.cost.effort} Effort y tienes ${token.effort || 0}.</p>` : ''}
          ${chooses ? `<label class="dossier-field"><span>Resolve que gastas (tienes ${available})</span><input class="hud-input" type="number" name="card_resolve" min="1" max="${Math.max(1, available)}" value="${Math.max(1, card.cost.resolve || 1)}" /></label>` : ''}
          <p class="dossier-error" role="alert"></p>
          <footer class="dossier-footer">${card.zone === 'vault' && token ? '<button type="button" class="hud-btn hud-btn-primary" data-card-recall>Recall al Loadout</button>' : card.playable ? `<button type="button" class="hud-btn hud-btn-primary" data-card-play>Jugar · ${e(card.kind === 'archive' ? 'Uncanny Power' : costLabel(card.cost))}</button>` : ''}</footer>
        </div>
      </div>`, 'card-inspect-dialog');
    const playButton = modal.querySelector('[data-card-play]');
    if (playButton) {
      if (burnoutOnly) playButton.textContent = 'Usar con Burnout · 1 HP';
      if (card.kind === 'effort' && !burnoutOnly && (token.effort || 0) < card.cost.effort) playButton.disabled = true;
      playButton.onclick = async () => {
        const spent = chooses ? Math.max(1, Number(modal.querySelector('[name="card_resolve"]').value) || 1) : null;
        playButton.disabled = true;
        if (await this.play(card, point, spent, { burnout: burnoutOnly })) modal.remove(); else playButton.disabled = false;
      };
    }
    const recall = modal.querySelector('[data-card-recall]');
    if (recall) recall.onclick = () => { modal.remove(); this.toggleDrawer(card.name, true); };
    return modal;
  }

  // The deck drawer: Loadout above, Vault below. Pick a Vault card, pick the moment, and if the
  // Loadout is full pick the card that leaves. Nothing is paid until Recall is pressed.
  // The catalog alone: every Power, by Domain, to read. Used by the Keeper and by Sleeping
  // characters (who have no Vault).
  drawCatalog(drawer, data, live, choice) {
    const domains = [...new Set(data.powers.map(p => p.d))];
    const catalog = data.powers.filter(p => choice.domain === 'all' || p.d === choice.domain).sort((a, b) => a.d.localeCompare(b.d) || a.l - b.l || a.n.localeCompare(b.n));
    drawer.innerHTML = sanitizeHTML(`
      <header class="card-drawer-head"><strong>MAZO · TODAS LAS CARTAS</strong><span style="flex:1"></span><button type="button" class="card-drawer-close" data-drawer-close aria-label="Cerrar el mazo">×</button></header>
      <p class="card-drawer-step">${live ? `${e(live.name)} es Sleeping: no tiene Loadout ni Vault. Aquí puedes consultar todos los Poderes.` : 'Consulta todos los Poderes del juego. Selecciona un personaje Awakened en postura de jugador para gestionar su Loadout y su Vault.'}</p>
      ${deckKindChips(choice)}
      ${choice.kind === 'powers' ? `<div class="equip-chips" role="group" aria-label="Dominio">${['all', ...domains].map(d => `<button type="button" class="equip-chip ${choice.domain === d ? 'active' : ''}" data-drawer-domain="${e(d)}">${d === 'all' ? 'Todos' : e(d)}</button>`).join('')}</div>
      <h4>TODOS LOS PODERES · ${catalog.length}</h4>
      <div class="card-drawer-row card-drawer-catalog">${catalog.map(p => `<button type="button" class="vf-card vf-card-mini" data-drawer-catalog="${e(p.n)}" title="${e(p.n)} · ${e(p.d)} L${p.l}">${cardFace(powerCard(p, 'vault'))}</button>`).join('')}</div>` : referenceHTML(data, choice)}`);
    drawer.querySelector('[data-drawer-close]').onclick = () => drawer.remove();
    drawer.querySelectorAll('[data-drawer-domain]').forEach(b => b.onclick = () => { choice.domain = b.dataset.drawerDomain; this.drawCatalog(drawer, data, live, choice); });
    drawer.querySelectorAll('[data-drawer-catalog]').forEach(b => b.onclick = () => { const p = data.powers.find(x => x.n === b.dataset.drawerCatalog); if (p) this.inspect(powerCard(p, 'vault')); });
    bindReference(drawer, data, choice, () => this.drawCatalog(drawer, data, live, choice), card => this.inspect(card));
  }

  // catalogOnly (the Keeper's hand): no character, the whole catalog to read. A Sleeping
  // character also gets only the catalog: it has no Loadout or Vault.
  toggleDrawer(selected = '', forceOpen = false, { catalogOnly = false } = {}) {
    const open = document.getElementById('card_deck_drawer');
    if (open) { open.remove(); if (!forceOpen) return null; }
    const token = catalogOnly ? null : store.state.tokens.find(t => t.id === this.tokenId);
    if (!token && !catalogOnly) return null;
    const drawer = document.createElement('section');
    drawer.id = 'card_deck_drawer'; drawer.className = 'card-drawer'; drawer.setAttribute('aria-label', 'Mazo de cartas');
    this.root.parentElement.append(drawer);
    // learn: a Power of the catalog picked to add to the Vault. onlyMine: the catalog shows only
    // what this character can take (its Domains, up to its level); unticked, every Power.
    const choice = { vault: selected, replace: '', mode: 'scene', learn: '', onlyMine: true, domain: 'all', kind: 'powers', path: 'awakened' };
    const draw = () => {
      const live = catalogOnly ? null : store.state.tokens.find(t => t.id === this.tokenId), data = cardData();
      if (!data) { loadCardData().then(() => { if (drawer.isConnected) draw(); }).catch(() => drawer.remove()); return; }
      if (!live && !catalogOnly) { drawer.remove(); return; }
      if (!live || live.path === 'Sleeping') { this.drawCatalog(drawer, data, live, choice); return; }
      const cards = characterCards(live, data), vault = cards.filter(c => c.zone === 'vault'), loadout = cards.filter(c => c.kind === 'power'), cap = loadoutCap(live), full = loadout.length >= cap;
      if (!vault.some(c => c.name === choice.vault)) choice.vault = '';
      if (!loadout.some(c => c.name === choice.replace)) choice.replace = '';
      const picked = vault.find(c => c.name === choice.vault), cost = picked ? recallCost(picked, choice.mode) : null;
      const price = cost ? [cost.stress && `${cost.stress} Stress`, cost.hope && `${cost.hope} Hope`, cost.action && 'tu Acción'].filter(Boolean).join(' + ') || 'gratis' : '';
      const step = !vault.length ? 'El Vault está vacío. Los Poderes que aprendas al subir de nivel entran aquí.'
        : !picked ? '1 · Elige la carta del Vault que quieres preparar.'
        : full && !choice.replace ? `2 · El Loadout está lleno (${cap}): elige la carta que pasa al Vault.`
        : `Listo: ${picked.name} entra${choice.replace ? ` y ${choice.replace} sale` : ''}. Coste: ${price}.`;
      // The whole catalog of Powers, so every Power can be read; only those in reach can be taken.
      const known = new Set(cards.filter(c => c.zone === 'vault' || c.kind === 'power').map(c => c.name.toLowerCase()));
      const reach = new Set(powersInReach(live, data).map(p => p.n.toLowerCase()));
      const domains = [...new Set(data.powers.map(p => p.d))];
      const catalog = data.powers.filter(p => (choice.domain === 'all' || p.d === choice.domain) && (!choice.onlyMine || reach.has(p.n.toLowerCase())))
        .sort((a, b) => a.d.localeCompare(b.d) || a.l - b.l || a.n.localeCompare(b.n));
      if (!catalog.some(p => p.n === choice.learn)) choice.learn = '';
      const learnable = choice.learn && reach.has(choice.learn.toLowerCase()) && !known.has(choice.learn.toLowerCase());
      const catalogCard = p => { const card = powerCard(p, 'vault'), state = known.has(p.n.toLowerCase()) ? 'known' : reach.has(p.n.toLowerCase()) ? '' : 'locked';
        return `<button type="button" class="vf-card vf-card-mini ${state} ${choice.learn === p.n ? 'chosen' : ''}" data-drawer-catalog="${e(p.n)}" title="${e(p.n)} · ${e(p.d)} L${p.l}${state === 'known' ? ' · ya lo conoces' : state === 'locked' ? ' · fuera de tu acceso' : ''}">${cardFace(card)}</button>`; };
      const mini = (card, zone) => `<button type="button" class="vf-card vf-card-mini ${(zone === 'vault' ? choice.vault : choice.replace) === card.name ? 'chosen' : ''}" data-drawer-${zone}="${e(card.name)}" title="${e(card.name)} · RC ${card.rc}">${cardFace(card)}</button>`;
      drawer.innerHTML = sanitizeHTML(`
        <header class="card-drawer-head"><strong>MAZO</strong><div class="card-drawer-modes" role="group" aria-label="Momento del Recall">${Object.entries(RECALL_MODES).map(([id, m]) => `<button type="button" class="equip-chip ${id === choice.mode ? 'active' : ''}" data-drawer-mode="${id}" title="${e(m.text)}">${e(m.name)}</button>`).join('')}</div><button type="button" class="card-drawer-close" data-drawer-close aria-label="Cerrar el mazo">×</button></header>
        <p class="card-drawer-step">${e(step)}</p>
        <h4>LOADOUT · ${loadout.length}/${cap}</h4><div class="card-drawer-row">${loadout.map(c => mini(c, 'loadout')).join('') || '<p class="dossier-muted">Sin Poderes preparados.</p>'}</div>
        <h4>VAULT · ${vault.length}</h4><div class="card-drawer-row">${vault.map(c => mini(c, 'vault')).join('') || '<p class="dossier-muted">Vacío.</p>'}</div>
        ${deckKindChips(choice)}
        ${choice.kind !== 'powers' ? referenceHTML(data, choice) : `<h4>TODOS LOS PODERES · ${catalog.length}</h4>
        <div class="card-drawer-catalog-filters"><label class="equip-check"><input type="checkbox" data-drawer-mine ${choice.onlyMine ? 'checked' : ''} /> Solo los de mi acceso (tus Dominios, hasta tu nivel)</label>
          <div class="equip-chips" role="group" aria-label="Dominio">${['all', ...domains].map(d => `<button type="button" class="equip-chip ${choice.domain === d ? 'active' : ''}" data-drawer-domain="${e(d)}">${d === 'all' ? 'Todos' : e(d)}</button>`).join('')}</div></div>
        <div class="card-drawer-row card-drawer-catalog">${catalog.map(catalogCard).join('') || '<p class="dossier-muted">No hay Poderes nuevos a tu alcance ahora mismo. Desmarca la casilla para verlos todos.</p>'}</div>`}
        ${choice.kind === 'powers' && choice.learn ? `<div class="card-drawer-learn"><span>${e(choice.learn)}: ${learnable ? 'puedes añadirlo a tu Vault.' : known.has(choice.learn.toLowerCase()) ? 'ya lo conoces.' : 'fuera de tu acceso (otro Dominio o nivel superior).'}</span><button type="button" class="hud-btn hud-btn-xs" data-drawer-read>Leer</button><button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-drawer-learn ${learnable ? '' : 'disabled'}>Añadir al Vault</button></div>` : ''}
        <p class="dossier-error" role="alert" data-drawer-error></p>
        <footer class="card-drawer-foot"><span class="dossier-muted">${e(RECALL_MODES[choice.mode].text)}</span><button type="button" class="hud-btn hud-btn-primary" data-drawer-recall ${picked && (!full || choice.replace) ? '' : 'disabled'}>Recall${price ? ` · ${e(price)}` : ''}</button></footer>`);
      drawer.querySelector('[data-drawer-close]').onclick = () => drawer.remove();
      drawer.querySelectorAll('[data-drawer-mode]').forEach(b => b.onclick = () => { choice.mode = b.dataset.drawerMode; draw(); });
      drawer.querySelectorAll('[data-drawer-vault]').forEach(b => b.onclick = () => { choice.vault = choice.vault === b.dataset.drawerVault ? '' : b.dataset.drawerVault; draw(); });
      const mine = drawer.querySelector('[data-drawer-mine]'); if (mine) mine.onchange = event => { choice.onlyMine = event.target.checked; draw(); };
      bindReference(drawer, data, choice, draw, card => this.inspect(card));
      drawer.querySelectorAll('[data-drawer-domain]').forEach(b => b.onclick = () => { choice.domain = b.dataset.drawerDomain; draw(); });
      drawer.querySelectorAll('[data-drawer-catalog]').forEach(b => b.onclick = () => { choice.learn = choice.learn === b.dataset.drawerCatalog ? '' : b.dataset.drawerCatalog; draw(); });
      drawer.querySelector('[data-drawer-read]')?.addEventListener('click', () => { const p = data.powers.find(x => x.n === choice.learn); if (p) this.inspect(powerCard(p, 'vault')); });
      drawer.querySelector('[data-drawer-learn]')?.addEventListener('click', async () => {
        try {
          const result = await network.requestAction({ type: 'CARD_LEARN', actorId: live.id, name: choice.learn });
          notify(result.summary); choice.learn = ''; draw();
        } catch (error) { drawer.querySelector('[data-drawer-error]').textContent = error.message; }
      });
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

export async function playKeeperMove(card, point = null) {
  if (!keeperView()) return false;
  const fear = store.state.fear || 0, cost = card.cost.fear || 0;
  if (fear < cost) { notify(`No hay Fear suficiente: hacen falta ${cost} y quedan ${fear}.`, 'error'); return false; }
  const target = card.actorId ? store.state.tokens.find(t => t.id === card.actorId) : store.getSelectedToken?.();
  // Spotlight Enemies with an adversary selected hands it the Spotlight; the table already
  // charges 1 Fear for that, so it is not charged twice.
  if (card.spotlight) {
    if (!target || target.isPlayer !== false || target.actorType === 'drone' || target.hasSpotlight || target.roundSpotlight === roundKey(store.getActiveMap())) {
      notify('Selecciona un adversario que aún no haya actuado en esta ronda.', 'error'); return false;
    }
    if (store.updateToken(target.id, { hasSpotlight: true, spotlight: { ...(target.spotlight || {}), enabled: true } }) === false) return false;
  } else if (cost && !store.spendFear(cost, card.actorName ? `${card.actorName}: ${card.name}` : card.name)) { notify('No se pudo gastar el Fear.', 'error'); return false; }
  network.broadcast?.({ type: 'FEAR_UPDATE', fear: store.state.fear });
  const secretRoll = window.veilDiceRoller?.rollVisibility?.() === 'keeper';
  const roll = card.die ? (await throwDice([{ qty: 1, sides: card.die, role: card.name }], { label: card.name, actor: { name: 'Keeper' }, secret: secretRoll }))[0] : null;
  const who = card.actorName || (card.spotlight && target?.isPlayer === false ? target.name : 'Keeper');
  const summary = `${who} · ${card.name}${cost ? ` · ${cost} Fear (quedan ${store.state.fear})` : ''}${roll ? ` · d${card.die} [${roll}]` : ''}`;
  const secret = window.veilDiceRoller?.rollVisibility?.() === 'keeper';
  window.veilDiceEngine?.showCallout?.({ playerName: 'Keeper', tokenName: who, label: card.name, skill: card.name, outcome: cost ? `${cost} FEAR` : cardKindName(card.kind).toUpperCase(), modifiers: summary, details: summary, visibility: secret ? 'keeper' : 'table' });
  if (!cost) store.addLog({ sender: 'Keeper', type: 'KEEPER_MOVE', title: card.name, details: summary, ...(secret ? { visibility: 'keeper' } : {}) });
  if (point) { window.veilCanvas?.triggerPing?.(point.x, point.y, card.color); if (!secret) network.broadcast?.({ type: 'PING', x: point.x, y: point.y }); }
  if (!secret) {
    const line = `🜏 Keeper · ${summary} — ${card.text.replace(/\s+/g, ' ').trim()}`;
    network.sendChat({ text: line.slice(0, 1900), recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: 'Keeper', text: line, channel: 'table' }));
  }
  return true;
}
