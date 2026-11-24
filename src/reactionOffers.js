// Reactions offered to the players who can use them (v2.37.0, user decision of 22 Nov 2026): when
// a reaction's trigger happens, the card lights up on the screen of each player who can play it,
// with a notice to use it or let it pass. There is no time limit (the game is not real time): if
// somebody does not answer, the Keeper decides in their own window.
import { store } from './state.js';
import { network } from './networkManager.js';
import { escapeHTML as e, sanitizeHTML } from './ui.js';

const newOfferId = () => `rx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── The Keeper's side ────────────────────────────────────────────────────────────────────────
const waiting = new Map(); // offerId → callback(answer)
// reactors: [{ id, name }]. onAnswer({ reactorId, use }) is called for each answer.
export function sendOffer({ name, reactors, text, cost }, onAnswer) {
  const offerId = newOfferId();
  waiting.set(offerId, onAnswer);
  network.broadcast?.({ type: 'REACTION_OFFER', offerId, name: String(name).slice(0, 60), reactorIds: reactors.map(r => r.id), text: String(text || '').slice(0, 400), cost: String(cost || '').slice(0, 30) });
  // The Keeper's own Player view at this table also sees it.
  if (store.sessionRole !== 'player') receiveOffer({ offerId, name, reactorIds: reactors.map(r => r.id), text, cost, local: true });
  return offerId;
}
export function closeOffer(offerId) {
  if (!offerId) return;
  waiting.delete(offerId);
  network.broadcast?.({ type: 'REACTION_CLOSED', offerId });
  dropOffer(offerId);
}
// An answer from a player (already checked by the table: it controls that character).
export function answerReceived({ offerId, reactorId, use }) {
  const callback = waiting.get(offerId);
  if (callback) callback({ reactorId: String(reactorId), use: use === true });
}

// ── The player's side ────────────────────────────────────────────────────────────────────────
const offers = new Map(); // offerId → { offerId, name, reactorIds, text, cost }
export const liveReactions = () => [...offers.values()];
// The reaction lit for this character and card, if any.
export const liveFor = (tokenId, cardName) => liveReactions().find(o => o.name === cardName && o.mine.includes(tokenId)) || null;
const mineOf = ids => ids.filter(id => store.sessionRole === 'player' ? store.canEditToken(id) : store.state.userRole === 'player' && store.state.tokens.some(t => t.id === id));

export function receiveOffer(offer) {
  if (!offer?.offerId || !Array.isArray(offer.reactorIds)) return;
  const mine = mineOf(offer.reactorIds.map(String));
  if (!mine.length) return;
  offers.set(offer.offerId, { ...offer, mine });
  drawToasts();
  window.veilCardHand?.refresh?.();
}
export function dropOffer(offerId) {
  if (!offers.delete(offerId)) return;
  drawToasts();
  window.veilCardHand?.refresh?.();
}
export function answer(offerId, reactorId, use) {
  const offer = offers.get(offerId);
  if (!offer) return;
  if (store.sessionRole === 'player') network.sendToHost?.({ type: 'REACTION_ANSWER', offerId, reactorId, use: use === true });
  else answerReceived({ offerId, reactorId, use });
  dropOffer(offerId);
}

function drawToasts() {
  let host = document.getElementById('reaction_toasts');
  if (!offers.size) { host?.remove(); return; }
  if (!host) { host = document.createElement('div'); host.id = 'reaction_toasts'; host.className = 'reaction-toasts'; host.setAttribute('aria-live', 'assertive'); document.body.append(host); }
  host.innerHTML = sanitizeHTML([...offers.values()].map(o => o.mine.map(id => {
    const who = store.state.tokens.find(t => t.id === id)?.name || '';
    return `<section class="reaction-toast" data-offer="${e(o.offerId)}" data-reactor="${e(id)}">
      <span class="reaction-toast-label">¡Puedes reaccionar!${who ? ` · ${e(who)}` : ''}</span>
      <p>${e(o.text)}</p>
      <footer><button type="button" class="hud-btn" data-pass>Dejar pasar</button><button type="button" class="hud-btn hud-btn-primary" data-use>Usar ${e(o.name)}${o.cost ? ` · ${e(o.cost)}` : ''}</button></footer>
    </section>`;
  }).join('')).join(''));
  host.querySelectorAll('.reaction-toast').forEach(box => {
    box.querySelector('[data-use]').onclick = () => answer(box.dataset.offer, box.dataset.reactor, true);
    box.querySelector('[data-pass]').onclick = () => answer(box.dataset.offer, box.dataset.reactor, false);
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('veil:reaction-offer', event => receiveOffer(event.detail));
  window.addEventListener('veil:reaction-closed', event => dropOffer(event.detail?.offerId));
  window.addEventListener('veil:reaction-answer', event => answerReceived(event.detail || {}));
}

// Rapid Regeneration as a reaction (v2.38.0): after a character loses HP, it lights up for whoever
// can use it (the target or an ally in Very Close, with it in the Loadout and 1 Hope). The first
// to accept plays it on that character, paid and resolved by the table.
export async function offerAfterDamage(targetId) {
  const [{ reactorsFor }, { cardData }, { characterCards }] = await Promise.all([import('./powerReactions.js'), import('./cardData.js'), import('./loadoutCards.js')]);
  const target = store.state.tokens.find(t => t.id === targetId), data = cardData();
  if (!target || !data) return null;
  const reactors = reactorsFor('Rapid Regeneration', target, store.state.tokens, store.getActiveMap?.(), data);
  if (!reactors.length) return null;
  let done = false;
  const offerId = sendOffer({ name: 'Rapid Regeneration', reactors, text: `${target.name} acaba de perder HP. Rapid Regeneration: +1 HP ahora y +1 HP al empezar cada uno de sus próximos 1d4 turnos.`, cost: '1 Hope' }, async ({ reactorId, use }) => {
    if (!use || done) return;
    done = true; closeOffer(offerId);
    const reactor = store.state.tokens.find(t => t.id === reactorId);
    const card = reactor && characterCards(reactor, data).find(c => c.name === 'Rapid Regeneration' && c.playable);
    if (!card) return;
    try { await network.requestAction({ type: 'CARD_PLAY', actorId: reactor.id, cardId: card.id, targetIds: [target.id] }); }
    catch (error) { (await import('./ui.js')).notify(error.message, 'error'); }
  });
  return offerId;
}
