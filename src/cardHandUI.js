// The card hand: next to the stats of the selected player character, its Loadout as a fan of
// 3D cards. A card is inspected with a click and played by dragging it onto the board.
import { store } from './state.js';
import { guideEvent } from './onboarding.js';
import { network } from './networkManager.js';
import { escapeHTML as e, sanitizeHTML, notify } from './ui.js';
import { tableDialog } from './dossierDialog.js';
import { cardData, loadCardData } from './cardData.js';
import { roundKey } from './combatState.js';
import { bearDown, bearDownTarget } from './bearDown.js';
import { throwDice } from './tableDice.js';
import { durationDice } from './effectClocks.js';
import { characterCards, keeperCards, costLabel, CARD_KINDS, cardKindName, RECALL_MODES, recallCost, loadoutNames, loadoutCap, isSleepingMystic, powerCard, powersInReach, catalogGroups, uncannyChoices, hasImpossibleEfficiency, IMPOSSIBLE_EFFICIENCY, archivePackages, archiveRequirement, DOMAIN_COLORS } from './loadoutCards.js';

import {cardUse,usedBy} from './cardLimits.js';
import { cardChoices, chosenCardOptions, openResolution } from './cardResolutionUI.js';
import { TARGET_RULES, SELF_EFFECTS, CARD_MODES, SUSTAINED, eligible, cardRollOptions, createResolution } from './cardResolution.js';
import { openSwarmAttack } from './swarmAttackUI.js';
import { cardSummary } from './cardSummaries.js';
import { cardStatus, statusBadge, cardChips, showPreview, hidePreview, quickPlan, startAim, stopAim, trackPlay, defaultMode, emblemNode, basicDefaults } from './cardFlow.js';
import { characterDetails } from './characterImport.js';
import { liveFor, liveReactions, answer as answerReaction } from './reactionOffers.js';
import { droneCompatible } from './dronePowers.js';
import { operatedDrone } from './droneControl.js';
import { tokenAtPoint } from './playerActionBar.js';
import { newId } from './persistence.js';
import { isAdvanced, luckyBreakDie } from './tableMode.js';
const KEEPER_KINDS = new Set(['fear', 'adversary']);
// Reactions this screen can see open by itself (v2.39.0): Lucky Break after the character's own
// Duality roll (not rerolled yet), Bear Down after its roll or while its damage is still open.
const HAND_GROUPS = [['all', 'Todas'], ['powers', 'Poderes'], ['reactions', 'Reacciones'], ['traits', 'Rasgos'], ['moves', 'Moves']];
const groupTest = {
  all: () => true,
  powers: c => ['power', 'archive'].includes(c.kind) || !!c.uncanny,
  reactions: c => !!c.reaction || c.name === 'Lucky Break' || c.kind === 'beardown',
  traits: c => ['feature', 'ancestry', 'community', 'augment'].includes(c.kind),
  moves: c => ['move', 'effort', 'beardown'].includes(c.kind) && !c.uncanny,
};
function savePrefs(hand) { try { localStorage.setItem('veil.hand.view', JSON.stringify({ group: hand.group, onlyUsable: !!hand.onlyUsable })); } catch {} }
function loadPrefs() { try { return JSON.parse(localStorage.getItem('veil.hand.view') || '{}') || {}; } catch { return {}; } }
function localLive(card, token) {
  if (!card.playable) return false;
  const dice = typeof window !== 'undefined' ? window.veilDiceRoller : null, last = dice?.lastResult;
  if (card.name === 'Lucky Break') return dice?.lastRollKind === 'check' && !!last && last.actorId === token.id && last.hopeVal != null && !last.keeperD20 && !last.luckyBreak && (token.stress?.current || 0) < (token.stress?.max ?? 6);
  if (card.kind === 'beardown') return (token.resolve?.current || 0) > 0 && !!bearDownTarget(token.id, dice);
  return false;
}
const keeperView = () => store.sessionRole !== 'player' && store.state.userRole === 'keeper';

const DRAG_START = 9; // pixels the pointer must travel before a click becomes a drag
const affordable = (token, card) => {
  if (KEEPER_KINDS.has(card.kind)) return (store.state.fear || 0) >= (card.cost.fear || 0);
  // A Common Effort can always be paid at 0 Effort through Burnout.
  if (card.kind === 'effort') return (token.effort || 0) >= card.cost.effort || (token.effort || 0) === 0;
  if (usedBy(token,cardUse(card,store.state))) return false;
  const c = card.cost, stressRoom = (token.stress?.max ?? 6) - (token.stress?.current || 0);
  if (card.kind === 'archive') return (token.uncanny ? card.level <= token.uncanny.access : (token.resolve?.current || 0) >= 1) && c.stress <= stressRoom;
  if (card.uncanny) return !!token.uncanny || (token.resolve?.current || 0) >= 1;
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
export function cardFace(card, { large = false, summary = '' } = {}) {
  const art = card.art || { flag: '', band: '', layout: 'band' }, price = badge(card);
  const footLeft = card.domain ? `${card.domain} · LV ${card.level}` : cardKindName(card.kind), footRight = card.kind === 'power' || card.kind === 'vault' ? `RC ${card.rc}` : '';
  return `
    <span class="vf-card-frame ${card.reverse ? 'vf-path-reverse' : ''} layout-${e(art.layout)}" style="--card-color:${e(card.color)}">
      <span class="vf-card-head"><strong class="vf-card-title">${e(card.name)}</strong>${price ? `<span class="vf-card-badge ${price[0]}">${e(String(price[1]))}</span>` : ''}</span>
      <span class="vf-card-art">
        ${Number.isInteger(art.cell) && art.cell >= 0 && art.cell < 9 ? `<span class="vf-sheet-window"><img class="vf-power-picture vf-sheet-picture" src="${e(art.illustration)}" style="left:-${art.cell % 3 * 100}%;top:-${Math.floor(art.cell / 3) * 100}%" alt="" draggable="false" /></span>` : art.illustration ? `<img class="vf-power-picture" src="${e(art.illustration)}" alt="" loading="lazy" draggable="false" />` : ''}
        ${art.flag ? `<span class="vf-card-flag"><img src="${e(art.flag)}" alt="" draggable="false" />${card.level ? `<b>${card.level}</b>` : ''}</span>` : ''}
        ${art.band ? `<img class="vf-card-band" src="${e(art.band)}" alt="" draggable="false" />` : ''}
      </span>
      <span class="vf-card-body">
        <span class="vf-card-pills">${pills(card)}</span>
        <span class="vf-card-text${summary && !large ? ' summary' : ''}">${e(large ? card.text : summary || card.text.slice(0, 170) + (card.text.length > 170 ? '…' : ''))}</span>
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
    const prefs = loadPrefs(); this.group = prefs.group || 'all'; this.onlyUsable = !!prefs.onlyUsable;
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
    // With the operated drone selected, the hand is the operator's, used through the drone (v2.38.0).
    const drone = operatedDrone(token.id);
    this.viaDroneId = drone?.id || null;
    const cards = characterCards(token, data, { optionalEfforts: !!store.state.optionalEfforts })
      .map(card => !drone ? card : droneCompatible(card) ? { ...card, viaDrone: drone.name } : { ...card, playable: false, droneBlocked: true });
    const signature = JSON.stringify([token.id, token.hope, token.effort, token.stress?.current, token.resolve?.current, token.cardUses, token.uncanny, this.group, this.onlyUsable, liveReactions().map(o => o.offerId), window.veilDiceRoller?.lastResult?.id, window.veilDiceRoller?.lastRollKind, !!window.veilDiceRoller?.lastDamage?.applied, drone?.id, drone?.x, drone?.y, store.state.activeMapId, cards.map(c => [c.id, c.reverse && c.subtitle])]);
    if (signature === this.signature) return;
    this.signature = signature; this.cards = cards; this.tokenId = token.id;
    // The hand by kind, and only what can be used now (v2.39.0). Lit reactions always show.
    const held = cards.filter(c => c.zone !== 'vault'), vault = cards.filter(c => c.zone === 'vault');
    const lit = card => !!(liveFor(token.id, card.name) || localLive(card, token));
    const usable = card => card.playable && affordable(token, card) && cardStatus(card, token)?.cls !== 'no';
    const groups = HAND_GROUPS.filter(([id]) => id === 'all' || held.some(c => groupTest[id](c)));
    if (!groups.some(([id]) => id === this.group)) this.group = 'all';
    const hand = held.filter(c => lit(c) || (groupTest[this.group](c) && (!this.onlyUsable || usable(c)))), n = hand.length;
    this.root.classList.remove('hidden'); this.quickbar.classList.add('with-hand');
    if (!cards.length) {
      // Say why instead of showing nothing: the sheet has no class, ancestry or Powers to read.
      this.root.innerHTML = sanitizeHTML(`<div class="card-hand-empty"><strong>Sin cartas</strong><p>La ficha de ${e(token.name)} no indica clase, ancestry, background ni Poderes, así que no hay cartas que mostrar.</p><button type="button" class="hud-btn hud-btn-xs" data-open-sheet>Completar la ficha</button></div>${deckButton('Mazo: consulta todos los Poderes del juego')}`);
      this.root.querySelector('[data-open-vault]').onclick = () => this.toggleDrawer('', false, { catalogOnly: true });
      this.root.querySelector('[data-open-sheet]').onclick = async () => { const { openDossier } = await import('./dossierUI.js'); openDossier(store.state.tokens.find(t => t.id === token.id), () => {}, 'stats'); };
      return;
    }
    const title = drone ? `Vía dron · ${drone.name}` : token.path === 'Sleeping' ? (isSleepingMystic(token) ? 'Archivo y Moves' : 'Moves') : `Loadout ${loadoutNames(token).length}/${loadoutCap(token)}`;
    this.root.innerHTML = sanitizeHTML(`
      <div class="card-hand-label"><span>${e(title)}</span>${groups.length > 2 || this.onlyUsable ? `<span class="card-hand-groups" role="group" aria-label="Tipo de carta">${groups.map(([id, label]) => `<button type="button" class="${this.group === id ? 'active' : ''}" data-hand-group="${id}" aria-pressed="${this.group === id}">${label}</button>`).join('')}</span>` : ''}<button type="button" class="card-hand-usable ${this.onlyUsable ? 'active' : ''}" data-hand-usable aria-pressed="${!!this.onlyUsable}" title="Mostrar solo las cartas que puedes usar ahora">Usables</button></div>
      <div class="card-hand-fan" style="--n:${n}">${hand.map((card, i) => `<button type="button" class="vf-card ${card.playable ? '' : 'passive'} ${card.playable && !affordable(token, card) ? 'unaffordable' : ''}" data-card="${e(card.id)}" style="--i:${i};--offset:${(i - (n - 1) / 2).toFixed(2)}" aria-label="${e(card.name)} · ${e(costLabel(card.cost))}"${liveFor(token.id, card.name) || localLive(card, token) ? ' data-live-reaction="1"' : ''}>${statusBadge(liveFor(token.id, card.name) || localLive(card, token) ? { cls: 'react live', text: '¡Úsala ahora!' } : card.droneBlocked ? { cls: 'no', text: 'No a través del dron' } : cardStatus(card, token))}${cardFace(card, { summary: cardSummary(card, token) })}</button>`).join('')}</div>
      ${token.path !== 'Sleeping' ? `<button type="button" class="card-deck" data-open-vault title="Mazo: cambia los Poderes de tu Loadout por los del Vault" aria-label="Abrir el mazo. ${vault.length} Poderes en el Vault"><span class="card-deck-stack"><i></i><i></i><i></i></span><b>${vault.length}</b></button>` : deckButton('Mazo: consulta todos los Poderes')}`);
    this.layoutFan(n);
    this.bind();
  }

  bind() {
    this.root.querySelectorAll('[data-hand-group]').forEach(b => b.onclick = () => { this.group = b.dataset.handGroup; savePrefs(this); this.refresh(); });
    const usableToggle = this.root.querySelector('[data-hand-usable]');
    if (usableToggle) usableToggle.onclick = () => { this.onlyUsable = !this.onlyUsable; savePrefs(this); this.refresh(); };
    const vault = this.root.querySelector('[data-open-vault]');
    if (vault) vault.onclick = () => this.toggleDrawer();
    for (const node of this.root.querySelectorAll('.vf-card')) {
      const card = this.cards.find(c => c.id === node.dataset.card);
      node.onpointermove = event => { // the card tilts towards the pointer
        const box = node.getBoundingClientRect(), x = (event.clientX - box.left) / box.width - 0.5, y = (event.clientY - box.top) / box.height - 0.5;
        node.style.setProperty('--ry', `${(x * 16).toFixed(1)}deg`); node.style.setProperty('--rx', `${(-y * 12).toFixed(1)}deg`);
        node.style.setProperty('--sx', `${((x + 0.5) * 100).toFixed(0)}%`); node.style.setProperty('--sy', `${((y + 0.5) * 100).toFixed(0)}%`);
      };
      node.onpointerleave = () => { for (const name of ['--rx', '--ry']) node.style.removeProperty(name); hidePreview(); };
      // Hovering shows the card large, with its summary and its data (v2.36.0).
      node.onpointerenter = event => { if (event.pointerType !== 'touch' && card) { const live = store.state.tokens.find(t => t.id === this.tokenId); showPreview(this, card, live, cardFace(card, { large: true })); } };
      node.onpointerdown = event => { hidePreview(); if (event.button === 0) this.track(event, node, card); };
      node.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.inspect(card); } };
      node.ondblclick = event => event.preventDefault();
    }
  }

  refresh() { this.signature = ''; this.render(); }

  // One click uses the card with its defaults; a second click soon after opens its options
  // (user decision, v2.36.0). A drag past a few pixels lifts it to be dropped on the map.
  clicked(card) {
    if (this.clickTimer && this.clickCard === card.id) { clearTimeout(this.clickTimer); this.clickTimer = null; stopAim(); this.inspect(card); return; }
    clearTimeout(this.clickTimer); this.clickCard = card.id;
    this.clickTimer = setTimeout(() => { this.clickTimer = null; this.quick(card); }, 260);
  }

  // The automatic use of a card: it is aimed on the map if it has a target, previewed if it is
  // an area, played at once otherwise; the roll is thrown and the result followed beside the hand.
  quick(card, point = null) {
    if (KEEPER_KINDS.has(card.kind) || !card.playable) { this.use(card, point); return; }
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token) return;
    // A reaction lit by the Keeper's offer: a click uses it (v2.37.0).
    const offer = liveFor(token.id, card.name);
    if (offer) { answerReaction(offer.offerId, token.id, true); return; }
    if (card.uncanny) { this.openUncanny(card, point); return; }
    // An Archive Power of a Mystic Sleeping (v2.41.0): the same gesture as any Power. It is aimed
    // (or dropped on its target) and then Uncanny Power runs by itself, with no window.
    // Dropped on a token (v2.42.0): the token is marked, as with an attack, and touching it again
    // casts the Power; an area is shown and a touch on the map casts it.
    const dropped = point ? this.cardTarget(point) : null;
    if (card.kind === 'archive') {
      let plan = quickPlan(card, token);
      if (plan === 'dialog') plan = 'play';
      if (plan === 'play') { this.uncannyCast(card, token, point); return; }
      startAim(card, token, plan, targetIds => this.uncannyCast(card, token, null, targetIds), { preselect: dropped });
      return;
    }
    if (this.special(card, token, point)) return;
    let plan = quickPlan(card, token);
    // Básico: the table takes the usual choice instead of opening the card's window (v2.48.0).
    const auto = plan === 'dialog' && !isAdvanced() ? basicDefaults(card, token, { dc: document.getElementById('dice_dc_select')?.value }) : null;
    if (auto) plan = auto.plan;
    if (plan === 'dialog') { this.inspect(card, point); return; }
    const options = { rollNow: true, ...(defaultMode(card) ? { mode: defaultMode(card) } : {}), ...(auto?.options || {}) };
    if (plan === 'play') { this.play(card, point, auto?.resolveSpent ?? null, options); return; }
    const drone = this.viaDroneId && store.state.tokens.find(t => t.id === this.viaDroneId);
    const origin = drone ? { ...token, x: drone.x, y: drone.y, size: drone.size || 1, mapId: drone.mapId } : token;
    startAim(card, origin, plan, targetIds => this.play(card, null, auto?.resolveSpent ?? null, { ...options, targetIds }), { preselect: dropped });
  }

  // The action ring (v2.47.0): the Powers in hand that can be aimed at this token now, and casting
  // one at it at once (the same as aiming it and touching the target).
  ringCards(target) {
    const token = store.state.tokens.find(t => t.id === this.tokenId), map = store.getActiveMap?.() || {};
    if (!token || !target) return [];
    return (this.cards || []).filter(card => {
      if (!card.playable || KEEPER_KINDS.has(card.kind) || card.uncanny) return false;
      const rule = TARGET_RULES[card.name];
      let plan = quickPlan(card, token);
      if (card.kind === 'archive' && plan === 'dialog') plan = 'play';
      return plan === 'aim' && !!rule && target.id !== token.id && eligible(token, target, map, rule);
    });
  }
  castAt(cardId, targetId) {
    const card = (this.cards || []).find(c => c.id === cardId), token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!card || !token) return;
    if (card.kind === 'archive') { this.uncannyCast(card, token, null, [targetId]); return; }
    this.play(card, null, null, { rollNow: true, targetIds: [targetId], ...(defaultMode(card) ? { mode: defaultMode(card) } : {}) });
  }

  // Click inspects; dragging past a few pixels lifts the card so it can be dropped on the map.
  track(down, node, card) {
    let ghost = null;
    const viewport = document.getElementById('canvas_viewport_root');
    const overBoard = event => { const box = viewport?.getBoundingClientRect(); return !!box && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom && !this.root.contains(document.elementFromPoint(event.clientX, event.clientY)) && !this.quickbar.contains(document.elementFromPoint(event.clientX, event.clientY)); };
    const move = event => {
      if (!ghost && Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < DRAG_START) return;
      if (!ghost) {
        // A Power travels as its Domain's emblem, glowing (v2.42.0); other cards as the card.
        ghost = emblemNode(card);
        if (!ghost) { ghost = document.createElement('div'); ghost.className = 'vf-card vf-card-ghost'; ghost.innerHTML = sanitizeHTML(cardFace(card)); }
        document.body.append(ghost); node.classList.add('dragging'); viewport?.classList.add('card-drop-target');
      }
      ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`;
      ghost.classList.toggle('over-board', overBoard(event));
    };
    const end = event => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
      viewport?.classList.remove('card-drop-target'); node.classList.remove('dragging');
      if (!ghost) { if (event.type === 'pointerup') this.clicked(card); return; }
      const dropped = event.type === 'pointerup' && overBoard(event);
      ghost.remove();
      if (!dropped) return;
      const box = viewport.getBoundingClientRect(), point = window.veilCanvas?.screenToWorld?.(event.clientX - box.left, event.clientY - box.top) || null;
      this.quick(card, point);
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
    const signature = JSON.stringify(['keeper', token?.id, token?.featureNotes, token?.hp?.current, fear, cards.map(c => c.id)]);
    if (signature === this.signature) return;
    this.signature = signature; this.cards = cards; this.tokenId = token?.id || null;
    this.root.classList.remove('hidden'); this.quickbar.classList.add('with-hand');
    const n = cards.length;
    this.root.innerHTML = sanitizeHTML(`
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
    if (card.uncanny || card.kind === 'archive') { this.openUncanny(card, point); return; }
    if (this.special(card, token, point)) return;
    if (card.chooseTrait || card.reverse || TARGET_RULES[card.name] || SELF_EFFECTS[card.name]?.modes || CARD_MODES[card.name] || card.name === 'Kinetic Blast' || cardRollOptions(card) || card.kind === 'archive' || (card.cost.open && card.cost.resolve)) { this.inspect(card, point); return; }
    this.play(card, point);
  }

  async play(card, point = null, resolveSpent = null, { burnout = false, targetIds, trait, weaponId, cardDC, mode, empower, special, rollNow = false, rollEdge = 'normal', expIndex = '', rollMod = 0 } = {}) {
    if (KEEPER_KINDS.has(card.kind)) return this.playKeeper(card, point);
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    if (!token) return false;
    if (card.reverse) {
      try {
        if (!card.chooseTrait) return await window.veilActionBar?.startClosingStrike(token, card, weaponId);
        await network.requestAction({ type: 'CARD_PLAY', actorId: token.id, cardId: card.id, clockId: card.clockId, trait });
        return true;
      } catch (err) { notify(err.message, 'error'); return false; }
    }
    if (card.kind === 'beardown' || card.kind === 'effort') return this.playSleeping(card, token, point, resolveSpent, burnout);
    try {
      const playerName = store.state.userName || store.state.playerName || 'Jugador';
      // The ally marked on the map receives an effect meant for others (Rapid Regeneration…).
      // (the marked target, or the ally selected on the map: touch your companion, then play).
      const picked = this.cardTarget(point);
      const recipients = card.chooseTrait ? [] : targetIds ?? (picked ? [picked] : []);
      // A duration set by a die (Rapid Regeneration: 1d4 turns) is thrown here, as 3D dice.
      // With a roll, the duration die is thrown after the success (v2.41.0).
      const dd = card.roll || card.kind === 'archive' ? null : durationDice(card);
      const durationFaces = dd ? await throwDice([{ qty: dd.qty, sides: dd.sides, role: 'Duración' }], { label: `${card.name} · duración`, actor: token,
        describe: v => ({ outcome: `${v.reduce((a, b) => a + b, 0)} turnos`, modifiers: `${dd.qty}d${dd.sides} [${v.join(', ')}]` }) }) : null;
      const effectFace = card.name === 'Emergency Repair' && card.kind !== 'archive'
        ? (await throwDice([{ qty: 1, sides: 8, role: 'Reparación' }], { label: card.name, actor: token }))[0] : undefined;
      const result = await network.requestAction({ type: 'CARD_PLAY', actorId: token.id, cardId: card.id, targetIds: recipients, trait, cardDC, mode, empower, ...(special ? { special } : {}), ...(this.viaDroneId ? { viaDroneId: this.viaDroneId } : {}), effectFace, resolveSpent, playerName, tokenName: token.name, ...(durationFaces ? { durationFaces } : {}) });
      const detail = [result.summary, ...(result.notes || [])].join(' ');
      window.veilDiceEngine?.showCallout?.({ playerName, tokenName: token.name, label: card.name, skill: card.name, outcome: result.failed ? 'NO SE MANIFIESTA' : result.outcomeTitle, modifiers: detail, details: detail });
      if (point) { window.veilCanvas?.triggerPing?.(point.x, point.y, card.color); network.broadcast?.({ type: 'PING', x: point.x, y: point.y }); }
      // Who used it, what it cost and what it does, for the whole table.
      const effect = card.text.replace(/\s+/g, ' ').trim();
      const line = `🂠 ${playerName} (${token.name}) usa ${card.name} [${cardKindName(card.kind)}] — ${detail} Efecto: ${effect}`;
      network.sendChat({ text: line.slice(0, 1900), recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: token.name, text: line, channel: 'table' }));
      // The resolution is followed in one card beside the hand (v2.36.0).
      trackPlay(this, card, token, result);
      if (result.roll && !result.failed) {
        // The roll is thrown at once (Uncanny Power since v2.31.1; every card since v2.36.0),
        // with the options chosen in the card's window (Advantage, Experience, modifier).
        const dice = window.veilDiceRoller;
        const prepared = dice?.prepareCheck?.({ tokenId: token.id, ...result.roll, playId: result.id, open: !rollNow });
        if (rollNow && prepared) {
          dice.presetCheck?.({ edge: rollEdge, expIndex, mod: rollMod });
          try { await dice.executeActionCheck?.(); } finally { dice.presetCheck?.({}); }
        } else notify(`${card.name}: tirada preparada (${result.roll.traitId}, DC ${result.roll.dc}). Pulsa ROLL.`);
      }
      guideEvent('card');
      return result;
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

  cardTarget(point) {
    if (point) return tokenAtPoint(store.getTokensForActiveMap(), point, store.getActiveMap()?.gridSize || 64)?.id;
    return store.state.targetTokenId || undefined;
  }
  // Uncanny Power (Sleeping Mystic, Corebook ch. 7), in the order it is played at the table:
  // 1) look at the Archive and pick the Power you aim for; 2) spend Resolve (one or more): one
  // Resolve Die per Resolve + Knowledge, thrown as 3D dice, sets the highest level reachable
  // (capped by your level) and gives the Keeper 1 Fear per Resolve; 3) with the access open,
  // keep that Power or pick any other at or below that level; 4) the Knowledge Spellcast Roll
  // against DC 10 + level: if it succeeds the Power manifests; a Critical returns the Resolve.
  // Uncanny Power in one go (v2.41.0, user decision): the access is thrown in 3D with the least
  // Resolve that can reach the Power's level (1 Resolve Die each, + Knowledge); if it reaches, the
  // Knowledge Spellcast (DC 10 + level) is thrown at once, and on a success the Power works by
  // itself (damage to the Keeper's window, duration die, clock…). An access that falls short stays
  // open for a lower Power, as the Corebook says.
  async uncannyCast(card, token, point = null, targetIds) {
    if (this.uncannyBusy) return false;
    const live = () => store.state.tokens.find(t => t.id === token.id);
    const sides = token.resolve?.dieType === 'd6' ? 6 : 4, knowledge = Number(token.traits?.knowledge) || 0, level = Number(token.level) || 1;
    if (card.level > level) { notify(`${card.name} es de nivel ${card.level}: Uncanny Power llega como mucho a tu nivel (${level}).`, 'error'); return false; }
    this.uncannyBusy = true;
    try {
      let access = live()?.uncanny?.access;
      if (access == null) {
        const available = live()?.resolve?.current || 0;
        if (!available) throw new Error('Sin Resolve: Uncanny Power necesita al menos 1.');
        const spent = Math.max(1, Math.min(available, Math.ceil((card.level - knowledge) / sides)));
        const faces = await throwDice([{ qty: spent, sides, role: 'Resolve' }], { label: `Uncanny Power · ${card.name}`, actor: token,
          describe: v => { const total = v.reduce((a, b) => a + b, 0) + knowledge; return { total, outcome: total >= card.level ? `Llega a ${card.name}` : `Acceso ${Math.max(0, Math.min(total, level))}: no llega`, modifiers: `${spent}d${sides} [${v.join(', ')}] + Knowledge ${knowledge} = ${total} · necesita ${card.level}` }; } });
        const result = await network.requestAction({ type: 'UNCANNY_ACCESS', actorId: token.id, resolveSpent: spent, faces });
        const playerName = store.state.userName || store.state.playerName || 'Jugador';
        const line = `🂠 ${playerName} (${token.name}) usa Uncanny Power — ${result.summary}`;
        network.sendChat({ text: line.slice(0, 1900), recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: token.name, text: line, channel: 'table' }));
        access = result.access;
      }
      if (access < card.level) { notify(`Acceso nivel ${access}: no llega a ${card.name} (nivel ${card.level}). El acceso sigue abierto para un Poder del Archivo de nivel ${access} o menor.`, 'error'); return false; }
      // The access dice settle before the Spellcast is thrown.
      const busy = () => !!window.VFDice3D?.status?.().rollPending;
      for (let waited = 0; busy() && waited < 8000; waited += 200) await new Promise(r => setTimeout(r, 200));
      await new Promise(r => setTimeout(r, 600));
      return await this.play(card, point, null, { rollNow: true, ...(targetIds ? { targetIds } : {}), ...(defaultMode(card) ? { mode: defaultMode(card) } : {}) });
    } catch (err) { notify(err.message, 'error'); return false; }
    finally { this.uncannyBusy = false; }
  }

  openUncanny(selected = null, point = null) {
    const data = cardData(), tokenId = this.tokenId, liveToken = () => store.state.tokens.find(t => t.id === tokenId);
    if (!data || !liveToken()) return null;
    let chosenId = selected?.kind === 'archive' ? selected.id : null, opened = null, busy = false;
    const modal = tableDialog('Uncanny Power', '<div class="uncanny" data-uncanny></div>', 'card-inspect-dialog uncanny-dialog');
    const host = modal.querySelector('[data-uncanny]');
    const draw = (error = '') => {
      const token = liveToken();
      if (!token) { modal.remove(); return; }
      const cards = characterCards(token, data).filter(c => c.kind === 'archive');
      const pending = token.uncanny || opened, reach = pending ? uncannyChoices(cards, pending.access) : [];
      if (pending && !reach.some(c => c.id === chosenId)) chosenId = reach[0]?.id || null;
      if (!pending && !cards.some(c => c.id === chosenId && c.playable)) chosenId = cards.find(c => c.playable)?.id || null;
      const chosen = cards.find(c => c.id === chosenId) || null;
      const knowledge = Number(token.traits?.knowledge) || 0, sides = token.resolve?.dieType === 'd6' ? 6 : 4, level = Number(token.level) || 1, available = token.resolve?.current || 0;
      const efficiency = hasImpossibleEfficiency(token) && !Object.hasOwn(token.cardUses || {}, IMPOSSIBLE_EFFICIENCY);
      const levels = [...new Set(cards.map(c => c.level))].sort((a, b) => a - b);
      const list = levels.map(l => `<h5 class="card-drawer-group">Nivel ${l} · DC ${10 + l}${l > level ? ' · por encima de tu nivel' : ''}</h5><div class="uncanny-list">${cards.filter(c => c.level === l).map(c => {
        const off = !c.playable || (pending && c.level > pending.access);
        const extra = [c.cost.stress && `${c.cost.stress} Stress`, c.cost.hp && `${c.cost.hp} HP`, !c.playable && (c.reaction ? 'Reaction' : 'Pasivo')].filter(Boolean).join(' · ');
        return `<button type="button" class="uncanny-power ${c.id === chosenId ? 'active' : ''}" data-uncanny-pick="${e(c.id)}" style="--card-color:${e(c.color)}" ${off ? 'disabled' : ''} aria-pressed="${c.id === chosenId}"><strong>${e(c.name)}</strong><small>${e(c.domain)} · ${e(c.type.replace(/\s*\(.*$/, ''))}${extra ? ` · ${e(extra)}` : ''}</small></button>`;
      }).join('')}</div>`).join('');
      const need = chosen ? Math.max(0, chosen.level - knowledge) : 0;
      host.innerHTML = sanitizeHTML(`
        <ol class="uncanny-steps"><li class="${pending ? 'done' : 'now'}">Elige el Poder</li><li class="${pending ? 'done' : 'now'}">Gasta Resolve y tira el acceso</li><li class="${pending ? 'now' : ''}">Spellcast de Knowledge</li></ol>
        ${pending ? `<p class="uncanny-access">Acceso abierto · <b>nivel ${pending.access}</b>. ${reach.length ? 'Puedes manifestar cualquier Poder del Archivo de ese nivel o menor.' : 'Ningún Poder del Archivo llega a ese nivel: renuncia al acceso.'} El Resolve y el Fear ya están gastados.</p>`
          : `<p class="dossier-muted">Tira un ${sides === 6 ? 'd6' : 'd4'} por cada Resolve que gastes y suma Knowledge ${knowledge >= 0 ? '+' : ''}${knowledge}: el resultado (máx. tu nivel, ${level}) es el nivel más alto que alcanzas. El Keeper gana 1 Fear por Resolve. Después eliges el Poder: el que marcaste u otro de ese nivel o menor.</p>`}
        <div class="uncanny-grid">
          <div class="uncanny-main">
            ${chosen ? `<div class="uncanny-chosen"><div class="vf-card table-card-preview" aria-hidden="true">${cardFace(chosen)}</div>
              <div><strong>${e(chosen.name)}</strong><p class="dossier-muted">${e(chosen.domain)} · nivel ${chosen.level} → Spellcast de Knowledge contra <b>DC ${10 + chosen.level}</b>. Ignora el coste de Hope; pagas el resto (${e([chosen.cost.stress && `${chosen.cost.stress} Stress`, chosen.cost.hp && `${chosen.cost.hp} HP`].filter(Boolean).join(', ') || 'nada más')}).${!pending ? ` Para alcanzarlo necesitas ${chosen.level} en el acceso${need ? `: ${need} con los dados` : ''}.` : ''}</p></div></div>
              <details class="table-rule"><summary>Texto del Poder</summary><p class="card-inspect-text">${richText(chosen.text)}</p></details>` : '<p class="dossier-muted">Elige un Poder del Archivo.</p>'}
            ${pending && chosen ? cardChoices(chosen, token, this.cardTarget(point)) : ''}
            ${!pending ? `<label class="dossier-field"><span>Resolve que gastas (tienes ${available})</span><input class="hud-input" type="number" name="uncanny_resolve" min="1" max="${Math.max(1, available)}" value="${Math.min(Math.max(1, need ? Math.ceil(need / ((sides + 1) / 2)) : 1), Math.max(1, available))}" /></label>
              ${efficiency ? '<label class="uncanny-check"><input type="checkbox" name="uncanny_efficiency" /> Impossible Efficiency: 2 dados por Resolve (1 / sesión)</label>' : ''}` : ''}
            <p class="dossier-error" role="alert">${e(error)}</p>
            <footer class="dossier-footer">${pending
              ? `<button type="button" class="hud-btn" data-uncanny-cancel>Renunciar al acceso</button><button type="button" class="hud-btn hud-btn-primary" data-uncanny-cast ${chosen ? '' : 'disabled'}>Manifestar${chosen ? ` · Knowledge DC ${10 + chosen.level}` : ''}</button>`
              : `<button type="button" class="hud-btn hud-btn-primary" data-uncanny-roll ${available ? '' : 'disabled'}>${available ? 'Tirar el acceso' : 'Sin Resolve'}</button>`}</footer>
          </div>
          <div class="uncanny-archive" aria-label="Archivo">${list || '<p class="dossier-muted">El Archivo está vacío: añade los Dominios desbloqueados del personaje.</p>'}<button type="button" class="hud-btn hud-btn-xs uncanny-manage" data-uncanny-archive>Gestionar el Archivo</button></div>
        </div>`);
      host.querySelectorAll('[data-uncanny-pick]').forEach(b => b.onclick = () => { chosenId = b.dataset.uncannyPick; draw(); });
      // The Archive is managed in the deck (Domains and levels unlocked).
      host.querySelector('[data-uncanny-archive]').onclick = () => { modal.remove(); this.toggleDrawer('', true); };
      const owned = () => { const t = liveToken(); if (t && t.mapId === store.state.activeMapId) return t; draw('Ha cambiado la escena. Vuelve a abrir Uncanny Power desde la mano.'); return null; };
      const rollButton = host.querySelector('[data-uncanny-roll]');
      if (rollButton) rollButton.onclick = async () => {
        const t = owned(); if (!t || busy) return;
        const spent = Math.max(1, Math.min(t.resolve?.current || 0, Math.floor(Number(host.querySelector('[name=uncanny_resolve]').value) || 1)));
        const twice = !!host.querySelector('[name=uncanny_efficiency]')?.checked, count = spent * (twice ? 2 : 1);
        busy = true; rollButton.disabled = true;
        try {
          const faces = await throwDice([{ qty: count, sides, role: 'Resolve' }], { label: 'Uncanny Power · acceso', actor: t,
            describe: v => { const total = v.reduce((a, b) => a + b, 0) + knowledge; return { total, outcome: `Nivel ${Math.max(0, Math.min(total, level))}`, modifiers: `${count}d${sides} [${v.join(', ')}] + Knowledge ${knowledge}` }; } });
          const result = await network.requestAction({ type: 'UNCANNY_ACCESS', actorId: t.id, resolveSpent: spent, faces, efficiency: twice });
          opened = { access: result.access, spent };
          const playerName = store.state.userName || store.state.playerName || 'Jugador';
          const line = `🂠 ${playerName} (${t.name}) usa Uncanny Power — ${result.summary}`;
          network.sendChat({ text: line.slice(0, 1900), recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: t.name, text: line, channel: 'table' }));
          busy = false; draw();
        } catch (err) { busy = false; draw(err.message); }
      };
      const cancel = host.querySelector('[data-uncanny-cancel]');
      if (cancel) cancel.onclick = async () => {
        const t = owned(); if (!t || busy) return;
        busy = true;
        try { await network.requestAction({ type: 'UNCANNY_ACCESS', actorId: t.id, cancel: true }); opened = null; modal.remove(); }
        catch (err) { busy = false; draw(err.message); }
      };
      const cast = host.querySelector('[data-uncanny-cast]');
      if (cast) cast.onclick = async () => {
        if (!chosen || !owned() || busy) return;
        busy = true; cast.disabled = true;
        if (await this.play(chosen, point, null, { ...chosenCardOptions(modal), rollNow: true })) { opened = null; modal.remove(); }
        else { busy = false; cast.disabled = false; }
      };
    };
    draw();
    return modal;
  }

  // Cards with their own window (v2.35.0): Lucky Break rerolls a die of the latest roll; a
  // sustained Power already active (Telekinetic Grasp, Flux Field) offers its action.
  special(card, token, point = null) {
    if (card.name === 'Lucky Break' && card.playable) { this.openLuckyBreak(token); return true; }
    if (SUSTAINED[card.name] && token.effectClocks?.some(c => c.name === card.name)) { this.openPowerUse(card, token, point); return true; }
    return false;
  }

  openLuckyBreak(token) {
    const dice = window.veilDiceRoller, last = dice?.lastResult;
    const usable = last && last.actorId === token.id && last.hopeVal != null && !last.keeperD20 && !last.luckyBreak;
    // Básico (the default): no window, the lower die is rerolled at once (v2.47.0).
    if (usable && !isAdvanced()) { void this.luckyBreak(token, luckyBreakDie(last)); return null; }
    const modal = tableDialog('Lucky Break', `<div class="kdmg">
      <p>${usable ? `Tu última tirada: Hope <b>${last.hopeVal}</b> · Fear <b>${last.fearVal}</b> → ${last.total} contra DC ${last.dc} (${e(last.outcomeTitle || '')}).` : 'Haz primero una tirada de Dualidad: Lucky Break relanza uno de sus dados.'}</p>
      <p class="dossier-muted">Marca 1 Stress y relanza un dado; te quedas con el nuevo resultado. Modo Personal o Vehículo (una Acción de la nave): el mismo relanzamiento.</p>
      <p class="dossier-error" role="alert"></p></div>
      <footer class="dossier-footer">${usable ? '<button type="button" class="hud-btn" data-lucky="fear">Relanzar Fear</button><button type="button" class="hud-btn hud-btn-primary" data-lucky="hope">Relanzar Hope</button>' : ''}</footer>`, 'damage-action-dialog');
    modal.querySelectorAll('[data-lucky]').forEach(b => b.onclick = async () => {
      modal.querySelectorAll('[data-lucky]').forEach(x => { x.disabled = true; });
      try {
        const die = b.dataset.lucky, [face] = await throwDice([{ qty: 1, sides: 12, role: die === 'hope' ? 'Hope' : 'Fear' }], { label: 'Lucky Break · ' + token.name, actor: token });
        const result = await network.requestAction({ type: 'LUCKY_BREAK', actorId: token.id, die, face, visibility: dice?.rollVisibility?.() || 'table' });
        modal.remove();
        await dice?.applyBearDown?.(result);
        notify(`Lucky Break: ${result.outcomeDesc}`);
      } catch (err) { modal.querySelector('[role=alert]').textContent = err.message; modal.querySelectorAll('[data-lucky]').forEach(x => { x.disabled = false; }); }
    });
    return modal;
  }

  async luckyBreak(token, die) {
    const dice = window.veilDiceRoller;
    try {
      const [face] = await throwDice([{ qty: 1, sides: 12, role: die === 'hope' ? 'Hope' : 'Fear' }], { label: 'Lucky Break · ' + token.name, actor: token });
      const result = await network.requestAction({ type: 'LUCKY_BREAK', actorId: token.id, die, face, visibility: dice?.rollVisibility?.() || 'table' });
      await dice?.applyBearDown?.(result);
      notify(`Lucky Break: ${result.outcomeDesc}`);
      return result;
    } catch (err) { notify(err.message, 'error'); return null; }
  }

  openPowerUse(card, token, point = null) {
    const clock = token.effectClocks.find(c => c.name === card.name), rule = SUSTAINED[card.name], map = store.getActiveMap?.();
    const flux = card.name === 'Flux Field', modes = clock?.modes || [];
    const picked = this.cardTarget(point);
    const options = store.state.tokens.filter(t => t.id !== token.id && t.mapId === token.mapId && !t.hidden && (!rule.reach || eligible(token, t, map, { reach: rule.reach, self: false })));
    const modal = tableDialog(card.name, `<div class="kdmg">
      <p>${flux ? `Activo: ${e(modes.join(' y '))}. Una vez por ronda.` : 'Lanzas el objeto enlazado como acción: (Proficiency)d6 Void contra el objetivo.'}</p>
      ${flux ? `<label class="dossier-field"><span>Modo</span><vf-select class="hud-select" name="use_mode">${modes.map(m => `<option value="${e(m)}">${e(m === 'Lucky Streak' ? 'Lucky Streak · Ventaja a un aliado' : 'Unlucky Enemies · Desventaja al ataque de un enemigo')}</option>`).join('')}</vf-select></label>` : ''}
      <label class="dossier-field"><span>Objetivo${rule.reach ? ' · ' + e(rule.reach) : ''}</span><vf-select class="hud-select" name="use_target"><option value="">Elige un objetivo</option>${options.map(t => `<option value="${e(t.id)}"${t.id === picked ? ' selected' : ''}>${e(t.name)}</option>`).join('')}</vf-select></label>
      <p class="dossier-error" role="alert"></p></div>
      <footer class="dossier-footer"><button type="button" class="hud-btn hud-btn-primary" data-use>${e(rule.label)}</button></footer>`, 'damage-action-dialog');
    modal.querySelector('[data-use]').onclick = async () => {
      const targetId = modal.querySelector('[name=use_target]').value, mode = modal.querySelector('[name=use_mode]')?.value;
      try {
        const result = await network.requestAction({ type: 'POWER_USE', actorId: token.id, name: card.name, targetId, mode });
        modal.remove();
        if (result.damage) window.veilDiceRoller?.autoCardDamage(token.id, result.targetId, result.damage.formula, window.veilDiceRoller.rollVisibility?.() === 'keeper', { type: result.damage.type });
        notify(result.summary);
        const line = `🂠 ${token.name}: ${result.summary}`;
        network.sendChat({ text: line.slice(0, 1900), recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: token.name, text: line, channel: 'table' }));
      } catch (err) { modal.querySelector('[role=alert]').textContent = err.message; }
    };
    return modal;
  }

  inspect(card, point = null) {
    const token = store.state.tokens.find(t => t.id === this.tokenId);
    // Reference cards of the deck (and the Powers of the catalog) are read without a character.
    const reference = card.zone === 'catalog' || card.zone === 'vault';
    if (!token && !KEEPER_KINDS.has(card.kind) && !reference) return;
    if (token && card.playable && (card.uncanny || card.kind === 'archive')) return this.openUncanny(card, point);
    if (token && card.playable && !reference && this.special(card, token, point)) return null;
    const use = cardUse(card,store.state);
    const burnoutOnly = card.kind === 'effort' && (token?.effort || 0) === 0;
    const chooses = card.playable && (card.kind === 'archive' || (card.cost.open && card.cost.resolve)), available = token?.resolve?.current || 0;
    const { activeMapId: mapId, selectedTokenId: selectedId } = store.state;
    // A card with a roll: Advantage, an Experience and a modifier, thrown at once (v2.36.0).
    const experiences = token && card.roll && card.playable && !reference ? characterDetails(token).experiences : [];
    const rollOptions = token && card.roll && card.playable && !reference && !KEEPER_KINDS.has(card.kind) ? `<fieldset class="card-roll-options"><legend>Tirada · ${e(card.roll.traitId)} DC ${card.roll.dc}</legend>
      <div class="card-edge" role="radiogroup" aria-label="Ventaja">${[['disadvantage', 'Desventaja'], ['normal', 'Normal'], ['advantage', 'Ventaja']].map(([v, l]) => `<label><input type="radio" name="roll_edge" value="${v}"${v === 'normal' ? ' checked' : ''}> ${l}</label>`).join('')}</div>
      ${experiences.length ? `<label class="dossier-field"><span>Experiencia${token.path === 'Sleeping' ? '' : ' (1 Hope)'}</span><select class="hud-input" name="roll_exp"><option value="">Ninguna</option>${experiences.map((x, i) => `<option value="${i}">${e(x.name)} (${e(x.bonus)})</option>`).join('')}</select></label>` : ''}
      <label class="dossier-field"><span>Modificador</span><input class="hud-input" type="number" name="roll_mod" value="0" min="-10" max="10"></label></fieldset>` : '';
    const modal = tableDialog(card.name, `
      <div class="card-inspect">
        <div class="vf-card table-card-preview" aria-hidden="true">${cardFace(card)}</div>
        <div class="card-inspect-side">
          <p class="dossier-muted">${e(card.subtitle)}</p>
          ${token || reference ? `<div class="card-chips">${cardChips(card, token).map(([tone, text]) => `<span class="card-chip ${e(tone)}">${e(text)}</span>`).join('')}</div><p class="card-inspect-summary">${e(cardSummary(card, token))}</p>` : ''}
          <details class="table-rule"${!card.playable ? ' open' : ''}><summary>Texto completo</summary><p class="card-inspect-text">${richText(card.text)}</p></details>
          ${use ? `<p class="dossier-muted">${e(use.label)} · ${usedBy(token,use) ? 'Gastado' : 'Disponible'}</p>` : ''}
          ${card.kind === 'archive' ? '<p class="dossier-muted">Uncanny Power: gasta Resolve, tira un dado de Resolve por cada uno y suma Knowledge; el resultado es el nivel máximo que alcanzas. El Keeper gana 1 Fear por Resolve. Ignoras el coste de Hope y tiras Knowledge contra DC 10 + nivel.</p>' : ''}
          ${card.zone === 'vault' ? '<p class="dossier-muted">Esta carta está en el Vault. Tráela al Loadout con un Recall.</p>' : ''}
          ${card.zone === 'catalog' ? '<p class="dossier-muted">Carta de consulta del mazo: se juega desde la mano del personaje que la tiene.</p>' : ''}
          ${!card.playable && card.zone !== 'vault' && card.zone !== 'catalog' ? '<p class="dossier-muted">Carta pasiva, de reacción no reproducible o proyecto a largo plazo: se consulta, no se juega desde la mano.</p>' : ''}
          ${KEEPER_KINDS.has(card.kind) ? `<p class="dossier-muted">Fear del Keeper: ${store.state.fear || 0}/12.${card.kind === 'adversary' ? ' Una criatura usa como mucho una Fear Ability por ciclo de Spotlight, más una Reaction defensiva.' : ''}</p>` : ''}
          ${card.playable && token && !reference && !KEEPER_KINDS.has(card.kind) && !['beardown','effort'].includes(card.kind) ? cardChoices(card,token,this.cardTarget(point)) : ''}
          ${burnoutOnly ? '<p class="dossier-muted">No te queda Effort: puedes usarla con Burnout. Pagas 1 HP, marcas 1 Stress y tu Stress máximo baja 1 hasta tu próxima Recovery.</p>' : card.kind === 'effort' && (token.effort || 0) < card.cost.effort ? `<p class="dossier-error">Hace falta ${card.cost.effort} Effort y tienes ${token.effort || 0}.</p>` : ''}
          ${rollOptions}
          ${chooses ? `<label class="dossier-field"><span>Resolve que gastas (tienes ${available})</span><input class="hud-input" type="number" name="card_resolve" min="1" max="${Math.max(1, available)}" value="${Math.max(1, card.cost.resolve || 1)}" /></label>` : ''}
          <p class="dossier-error" role="alert"></p>
          ${card.kind === 'adversary' && !card.playable && !card.swarm && keeperView() ? '<button type="button" class="hud-btn" data-observe>Resolver el desencadenante en mesa</button>' : ''}
          <footer class="dossier-footer">${card.zone === 'vault' && token ? '<button type="button" class="hud-btn hud-btn-primary" data-card-recall>Recall al Loadout</button>' : card.playable ? `<button type="button" class="hud-btn hud-btn-primary" data-card-play>${card.roll ? 'Lanzar' : 'Usar'} · ${e(card.kind === 'archive' ? 'Uncanny Power' : costLabel(card.cost))}${card.roll ? ` · ${e(card.roll.traitId[0].toUpperCase() + card.roll.traitId.slice(1))} DC ${card.roll.dc}` : ''}</button>` : ''}</footer>
        </div>
      </div>`, 'card-inspect-dialog');
    const stillAvailable = () => {
      const available = KEEPER_KINDS.has(card.kind)
        ? keeperView() && (!card.spotlight || store.state.selectedTokenId === selectedId)
        : token && this.owner()?.id === token.id && this.tokenId === token.id && token.mapId === mapId;
      if (available && store.state.activeMapId === mapId) return true;
      modal.querySelector('[role=alert]').textContent = 'Ha cambiado el personaje o la escena. Vuelve a abrir la carta desde su mano.';
      return false;
    };
    const playButton = modal.querySelector('[data-card-play]');
    if (playButton) {
      if (card.reverse) playButton.textContent = card.chooseTrait ? 'Guardar atributo' : 'Usar Breaking Point';
      if (usedBy(token,use)) { playButton.textContent = 'Uso gastado'; playButton.disabled = true; }
      if (burnoutOnly) playButton.textContent = 'Usar con Burnout · 1 HP';
      if (card.kind === 'effort' && !burnoutOnly && (token.effort || 0) < card.cost.effort) playButton.disabled = true;
      playButton.onclick = async () => {
        if (playButton.disabled || !stillAvailable()) return;
        const spent = chooses ? Math.max(1, Number(modal.querySelector('[name="card_resolve"]').value) || 1) : null;
        playButton.disabled = true;
        const roll = { rollNow: true, rollEdge: modal.querySelector('[name=roll_edge]:checked')?.value || 'normal', expIndex: modal.querySelector('[name=roll_exp]')?.value ?? '', rollMod: Number(modal.querySelector('[name=roll_mod]')?.value) || 0 };
        if (await this.play(card, point, spent, { burnout: burnoutOnly, ...roll, ...chosenCardOptions(modal) })) modal.remove(); else playButton.disabled = false;
      };
    }
    const observe = modal.querySelector('[data-observe]');
    if (observe) observe.onclick = async () => { if (stillAvailable() && await playKeeperMove(card,point)) modal.remove(); };
    const recall = modal.querySelector('[data-card-recall]');
    if (recall) recall.onclick = () => { if (stillAvailable()) { modal.remove(); this.toggleDrawer(card.name, true); } };
    return modal;
  }

  // The deck drawer: Loadout above, Vault below. Pick a Vault card, pick the moment, and if the
  // Loadout is full pick the card that leaves. Nothing is paid until Recall is pressed.
  // The catalog alone: every Power, by Domain, to read. Used by the Keeper and by Sleeping
  // characters (who have no Vault).
  drawCatalog(drawer, data, live, choice) {
    const domains = [...new Set(data.powers.map(p => p.d))];
    const catalog = data.powers.filter(p => choice.domain === 'all' || p.d === choice.domain).sort((a, b) => a.d.localeCompare(b.d) || a.l - b.l || a.n.localeCompare(b.n));
    // In the sheet, a Sleeping character's own hand (Resolve Moves, Common Efforts…) comes first.
    const hand = this.embedded && live ? characterCards(live, data) : [];
    const mystic = live && isSleepingMystic(live);
    drawer.innerHTML = sanitizeHTML(`
      <header class="card-drawer-head"><strong>MAZO · TODAS LAS CARTAS</strong><span style="flex:1"></span><button type="button" class="card-drawer-close" data-drawer-close aria-label="Cerrar el mazo">×</button></header>
      <p class="card-drawer-step">${mystic ? `${e(live.name)} es Mystic Sleeping: no tiene Loadout ni Vault. Su Archivo guarda los Dominios desbloqueados; sus Poderes se usan con Uncanny Power.` : live ? `${e(live.name)} es Sleeping: no tiene Loadout ni Vault. Aquí puedes consultar todos los Poderes.` : 'Consulta todos los Poderes del juego. Selecciona un personaje Awakened en postura de jugador para gestionar su Loadout y su Vault.'}</p>
      ${mystic ? this.archiveHTML(live, data, choice) : ''}
      ${hand.length ? `<h4>MANO · ${hand.length}</h4><div class="card-drawer-row">${hand.map(c => `<button type="button" class="vf-card vf-card-mini" data-drawer-hand="${e(c.id)}" title="${e(c.name)}">${cardFace(c)}</button>`).join('')}</div>` : ''}
      ${deckKindChips(choice)}
      ${choice.kind === 'powers' ? `<div class="equip-chips" role="group" aria-label="Dominio">${['all', ...domains].map(d => `<button type="button" class="equip-chip ${choice.domain === d ? 'active' : ''}" data-drawer-domain="${e(d)}">${d === 'all' ? 'Todos' : e(d)}</button>`).join('')}</div>
      <h4>TODOS LOS PODERES · ${catalog.length}</h4>
      <div class="card-drawer-row card-drawer-catalog">${catalog.map(p => `<button type="button" class="vf-card vf-card-mini" data-drawer-catalog="${e(p.n)}" title="${e(p.n)} · ${e(p.d)} L${p.l}">${cardFace(powerCard(p, 'vault'))}</button>`).join('')}</div>` : referenceHTML(data, choice)}`);
    drawer.querySelector('[data-drawer-close]').onclick = () => drawer.remove();
    if (mystic) this.bindArchive(drawer, live, choice, () => { const fresh = store.state.tokens.find(t => t.id === live.id); if (fresh && drawer.isConnected) this.drawCatalog(drawer, data, fresh, choice); });
    drawer.querySelectorAll('[data-drawer-hand]').forEach(b => b.onclick = () => { const card = hand.find(c => c.id === b.dataset.drawerHand); if (card) this.inspect(card); });
    drawer.querySelectorAll('[data-drawer-domain]').forEach(b => b.onclick = () => { choice.domain = b.dataset.drawerDomain; this.drawCatalog(drawer, data, live, choice); });
    drawer.querySelectorAll('[data-drawer-catalog]').forEach(b => b.onclick = () => { const p = data.powers.find(x => x.n === b.dataset.drawerCatalog); if (p) this.inspect(powerCard(p, 'vault')); });
    bindReference(drawer, data, choice, () => this.drawCatalog(drawer, data, live, choice), card => this.inspect(card));
  }

  // The Uncanny Archive (Sleeping Mystic): the unlocked Domain-level packages, and a Domain and a
  // level to add one (level ≤ character level; from level 2, two Domains at the level below).
  archiveHTML(live, data, choice) {
    const packages = archivePackages(live), level = Number(live.level) || 1, domains = Object.keys(DOMAIN_COLORS);
    choice.archiveDomain ||= domains.find(d => !packages.some(([x]) => x === d)) || domains[0];
    choice.archiveLevel = Math.min(Math.max(1, Number(choice.archiveLevel) || 1), level);
    const powersAt = (d, l) => data.powers.filter(p => p.d === d && p.l === l);
    const problem = archiveRequirement(live, packages, choice.archiveDomain, choice.archiveLevel) || (powersAt(choice.archiveDomain, choice.archiveLevel).length ? '' : `No hay Poderes de ${choice.archiveDomain} de nivel ${choice.archiveLevel}.`);
    const preview = powersAt(choice.archiveDomain, choice.archiveLevel);
    const sorted = [...packages].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    return `<section class="archive-manager" aria-label="Archivo de Uncanny">
      <h4>ARCHIVO · ${packages.length} ${packages.length === 1 ? 'paquete' : 'paquetes'}</h4>
      <div class="archive-packages">${sorted.map(([d, l]) => `<span class="archive-chip" style="--card-color:${e(DOMAIN_COLORS[d])}"><b>${e(d)} ${l}</b><small>${powersAt(d, l).length} Poderes</small><button type="button" data-archive-remove="${e(d)}|${l}" title="Quitar ${e(d)} ${l} del Archivo" aria-label="Quitar ${e(d)} ${l}">×</button></span>`).join('') || '<span class="dossier-muted">Vacío. Al crear el personaje se eligen dos Dominios de nivel 1.</span>'}</div>
      <div class="archive-add">
        <span class="dossier-label">AÑADIR UN DOMINIO</span>
        <div class="equip-chips" role="group" aria-label="Dominio">${domains.map(d => `<button type="button" class="equip-chip ${choice.archiveDomain === d ? 'active' : ''}" data-archive-domain="${e(d)}" aria-pressed="${choice.archiveDomain === d}">${e(d)}</button>`).join('')}</div>
        <div class="equip-chips" role="group" aria-label="Nivel">${Array.from({ length: level }, (_, i) => i + 1).map(l => `<button type="button" class="equip-chip ${choice.archiveLevel === l ? 'active' : ''}" data-archive-level="${l}" aria-pressed="${choice.archiveLevel === l}">Nivel ${l}</button>`).join('')}</div>
        <p class="card-drawer-step">${problem ? `<span class="dossier-error">${e(problem)}</span>` : `${e(choice.archiveDomain)} ${choice.archiveLevel}: ${e(preview.map(p => p.n).join(' · '))}`}</p>
        <button type="button" class="hud-btn hud-btn-primary" data-archive-add ${problem ? 'disabled' : ''}>Añadir ${e(choice.archiveDomain)} ${choice.archiveLevel} al Archivo</button>
        <p class="dossier-error" role="alert" data-archive-error></p>
      </div>
    </section>`;
  }

  bindArchive(drawer, live, choice, redraw) {
    const send = async action => {
      try { const result = await network.requestAction({ type: 'ARCHIVE_EDIT', actorId: live.id, ...action }); notify(result.summary); redraw(); }
      catch (err) { const box = drawer.querySelector('[data-archive-error]'); if (box) box.textContent = err.message; }
    };
    drawer.querySelectorAll('[data-archive-domain]').forEach(b => b.onclick = () => { choice.archiveDomain = b.dataset.archiveDomain; redraw(); });
    drawer.querySelectorAll('[data-archive-level]').forEach(b => b.onclick = () => { choice.archiveLevel = Number(b.dataset.archiveLevel); redraw(); });
    const add = drawer.querySelector('[data-archive-add]');
    if (add) add.onclick = () => { if (!add.disabled) { add.disabled = true; send({ op: 'add', domain: choice.archiveDomain, level: choice.archiveLevel }); } };
    drawer.querySelectorAll('[data-archive-remove]').forEach(b => b.onclick = () => { const [domain, level] = b.dataset.archiveRemove.split('|'); send({ op: 'remove', domain, level: Number(level) }); });
  }

  // catalogOnly (the Keeper's hand): no character, the whole catalog to read. A Sleeping
  // character also gets only the catalog: it has no Loadout or Vault.
  // The same deck inside the character sheet (v2.30.0): Loadout and Vault of that character, for
  // the player and the Keeper, with Recall and learning. A view of this hand bound to the sheet's
  // character and drawn in `host`; the hand on the map keeps its own character and drawer.
  openLoadoutIn(host, tokenId) {
    host.querySelector('.card-drawer')?.remove();
    const view = Object.create(this);
    view.tokenId = tokenId; view.root = { parentElement: host }; view.embedded = true;
    return view.toggleDrawer('', true);
  }

  toggleDrawer(selected = '', forceOpen = false, { catalogOnly = false } = {}) {
    const drawerId = this.embedded ? 'sheet_deck_drawer' : 'card_deck_drawer';
    const open = this.embedded ? this.root.parentElement.querySelector('.card-drawer') : document.getElementById(drawerId);
    if (open) { open.remove(); if (!forceOpen) return null; }
    const token = catalogOnly ? null : store.state.tokens.find(t => t.id === this.tokenId);
    if (!token && !catalogOnly) return null;
    const drawer = document.createElement('section');
    drawer.id = drawerId; drawer.className = `card-drawer${this.embedded ? ' card-drawer-embedded' : ''}`; drawer.setAttribute('aria-label', 'Mazo de cartas');
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
        <div class="card-drawer-foot card-drawer-recallbar"><span class="dossier-muted">${e(RECALL_MODES[choice.mode].name)}: ${e(RECALL_MODES[choice.mode].text)}</span><button type="button" class="hud-btn hud-btn-primary" data-drawer-recall ${picked && (!full || choice.replace) ? '' : 'disabled'}>${picked ? `Recall ${e(picked.name)}${choice.replace ? ` ⇄ ${e(choice.replace)}` : ''}${price ? ` · ${e(price)}` : ''}` : 'Recall · elige una carta del Vault'}</button></div>
        <p class="dossier-error" role="alert" data-drawer-error></p>
        ${deckKindChips(choice)}
        ${choice.kind !== 'powers' ? referenceHTML(data, choice) : `<h4>TODOS LOS PODERES · ${catalog.length}</h4>
        <div class="card-drawer-catalog-filters"><label class="equip-check"><input type="checkbox" data-drawer-mine ${choice.onlyMine ? 'checked' : ''} /> Solo los de mi acceso (tus Dominios, hasta tu nivel)</label>
          <div class="equip-chips" role="group" aria-label="Dominio">${['all', ...domains].map(d => `<button type="button" class="equip-chip ${choice.domain === d ? 'active' : ''}" data-drawer-domain="${e(d)}">${d === 'all' ? 'Todos' : e(d)}</button>`).join('')}</div></div>
        <div class="card-drawer-row card-drawer-catalog">${catalog.map(catalogCard).join('') || '<p class="dossier-muted">No hay Poderes nuevos a tu alcance ahora mismo. Desmarca la casilla para verlos todos.</p>'}</div>`}
        ${choice.kind === 'powers' && choice.learn ? `<div class="card-drawer-learn"><span>${e(choice.learn)}: ${learnable ? 'puedes añadirlo a tu Vault.' : known.has(choice.learn.toLowerCase()) ? 'ya lo conoces.' : 'fuera de tu acceso (otro Dominio o nivel superior).'}</span><button type="button" class="hud-btn hud-btn-xs" data-drawer-read>Leer</button><button type="button" class="hud-btn hud-btn-xs hud-btn-primary" data-drawer-learn ${learnable ? '' : 'disabled'}>Añadir al Vault</button></div>` : ''}
`);
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
    if (entry.playId && store.state.logs.some(row => row.resolution?.id === entry.playId)) return openResolution(entry.playId);
    const card = entry.card;
    return tableDialog(`${entry.actorName} usa ${card.name}`, `
      <div class="card-inspect">
        <div class="vf-card table-card-preview" aria-hidden="true">${cardFace(card)}</div>
        <div class="card-inspect-side">
          <p class="dossier-muted">Usada por <strong>${e(entry.actorName)}</strong>${entry.playerName ? ` (${e(entry.playerName)})` : ''} · ${e(card.subtitle)}</p>
          <p class="card-inspect-text"><strong>${e(entry.summary)}</strong>${entry.notes?.length ? `<br>${e(entry.notes.join(' '))}` : ''}</p>
          <details class="table-rule"><summary>Texto de la carta</summary><p class="card-inspect-text">${richText(card.text)}</p></details>
        </div>
      </div>`, 'card-inspect-dialog');
  }
}
const CARD_FEED_LIMIT = 4, CARD_FEED_LIFE = 90000;

export async function playKeeperMove(card, point = null) {
  if (!keeperView()) return false;
  if (card.swarm) return !!openSwarmAttack(card.actorId,store.state.targetTokenId);
  const fear = store.state.fear || 0, cost = card.cost.fear || 0;
  if (fear < cost) { notify(`No hay Fear suficiente: hacen falta ${cost} y quedan ${fear}.`, 'error'); return false; }
  const target = card.actorId ? store.state.tokens.find(t => t.id === card.actorId) : store.getSelectedToken?.();
  if (card.actorId && (!target || target.mapId !== store.state.activeMapId)) { notify('El adversario ya no está en la escena.', 'error'); return false; }
  const cycle = target && roundKey(store.getActiveMap());
  const usageKey = card.kind === 'adversary' && cost ? (card.reaction ? 'fearReactionRound' : 'fearAbilityRound') : null;
  if (usageKey && target[usageKey] === cycle) { notify('Esta criatura ya usó esa activación de Fear en este ciclo de Spotlight.', 'error'); return false; }
  // Spotlight Enemies with an adversary selected hands it the Spotlight; the table already
  // charges 1 Fear for that, so it is not charged twice.
  if (card.spotlight) {
    if (!target || target.isPlayer !== false || target.actorType === 'drone' || target.hasSpotlight || target.roundSpotlight === roundKey(store.getActiveMap())) {
      notify('Selecciona un adversario que aún no haya actuado en esta ronda.', 'error'); return false;
    }
    if (store.updateToken(target.id, { hasSpotlight: true, spotlight: { ...(target.spotlight || {}), enabled: true } }) === false) return false;
  } else if (cost && !store.spendFear(cost, card.actorName ? `${card.actorName}: ${card.name}` : card.name)) { notify('No se pudo gastar el Fear.', 'error'); return false; }
  if (usageKey) store.updateToken(target.id,{ [usageKey]: cycle });
  network.broadcast?.({ type: 'FEAR_UPDATE', fear: store.state.fear });
  const secretRoll = window.veilDiceRoller?.rollVisibility?.() === 'keeper';
  const roll = card.die ? (await throwDice([{ qty: 1, sides: card.die, role: card.name }], { label: card.name, actor: { name: 'Keeper' }, secret: secretRoll }))[0] : null;
  const who = card.actorName || (card.spotlight && target?.isPlayer === false ? target.name : 'Keeper');
  const summary = `${who} · ${card.name}${cost ? ` · ${cost} Fear (quedan ${store.state.fear})` : ''}${roll ? ` · d${card.die} [${roll}]` : ''}`;
  const secret = window.veilDiceRoller?.rollVisibility?.() === 'keeper';
  window.veilDiceEngine?.showCallout?.({ playerName: 'Keeper', tokenName: who, label: card.name, skill: card.name, outcome: cost ? `${cost} FEAR` : cardKindName(card.kind).toUpperCase(), modifiers: summary, details: summary, visibility: secret ? 'keeper' : 'table' });
  const mapId = store.state.activeMapId, playId = newId();
  const resolution = createResolution(card, card.actorId ? target : null, [], null, playId, mapId);
  store.addLog({ sender: 'Keeper', type: 'KEEPER_MOVE', title: card.name, details: summary, resolution, ...(secret ? { visibility: 'keeper' } : {}) });
  if (typeof document !== 'undefined') openResolution(playId);
  if (point) { window.veilCanvas?.triggerPing?.(point.x, point.y, card.color); if (!secret) network.broadcast?.({ type: 'PING', x: point.x, y: point.y }); }
  if (!secret) {
    const line = `🜏 Keeper · ${summary} — ${card.text.replace(/\s+/g, ' ').trim()}`;
    network.sendChat({ text: line.slice(0, 1900), recipientId: 'table' }).catch(() => store.addChatMessage?.({ senderName: 'Keeper', text: line, channel: 'table' }));
  }
  return true;
}
