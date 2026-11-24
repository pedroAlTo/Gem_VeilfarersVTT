// «Invita a tus jugadores» (Plan de UX V3, fase 1): while the Keeper is in an online room and
// nobody has joined yet, a small card shows the invitation link and the code, with one button to
// copy the link. Players enter with only their name. It goes away when someone joins or when the
// Keeper closes it (remembered per room); the header keeps «Invitar» for later.
import { store } from './state.js';
import { network } from './networkManager.js';
import { escapeHTML as e, sanitizeHTML } from './ui.js';
import { copyText, invitationCode, magicInvitationLink } from './sessionLobby.js';

const closedKey = roomId => 'veil.invite.closed.' + roomId;
const isClosed = roomId => { try { return localStorage.getItem(closedKey(roomId)) === '1'; } catch { return false; } };

// Whether the card is due: the Keeper, in an online room, with no player connected yet.
export function inviteDue(state, controller, sessionRole) {
  const room = controller?.room;
  if (!room || !controller.isKeeper || sessionRole === 'player' || state.userRole !== 'keeper') return false;
  if ((state.connectedPeers || []).length) return false;
  return !isClosed(room.id);
}

export function mountKeeperInvite(controller = network.roomController) {
  if (typeof document === 'undefined') return null;
  let signature = '';
  const draw = () => {
    const due = inviteDue(store.state, controller, store.sessionRole);
    const code = due ? invitationCode() : '', link = due ? magicInvitationLink() : '';
    const next = due ? `${controller.room.id}|${code}` : '';
    if (next === signature) return;
    signature = next;
    let card = document.getElementById('keeper_invite');
    if (!due || !code) { card?.remove(); return; }
    if (!card) { card = document.createElement('aside'); card.id = 'keeper_invite'; card.className = 'keeper-invite'; card.setAttribute('aria-label', 'Invita a tus jugadores'); document.body.append(card); }
    card.innerHTML = sanitizeHTML(`<header><strong>Invita a tus jugadores</strong><button type="button" class="keeper-invite-close" data-invite-close aria-label="Cerrar">×</button></header>
      <p>Envíales este enlace. Entran con su nombre, sin crear cuenta, y eligen personaje en un clic.</p>
      <div class="keeper-invite-link"><input class="hud-input" readonly value="${e(link)}" aria-label="Enlace de invitación"><button type="button" class="hud-btn hud-btn-primary" data-invite-copy>Copiar enlace</button></div>
      <p class="keeper-invite-code">Código: <b data-no-i18n>${e(code)}</b> · <button type="button" class="hud-btn hud-btn-xs" data-invite-code>Copiar código</button></p>`);
    card.querySelector('[data-invite-copy]').onclick = event => copyText(link, event.currentTarget);
    card.querySelector('[data-invite-code]').onclick = event => copyText(code, event.currentTarget);
    card.querySelector('[data-invite-close]').onclick = () => { try { localStorage.setItem(closedKey(controller.room.id), '1'); } catch {} draw(); };
  };
  store.subscribe(draw);
  controller?.subscribe?.(draw);
  draw();
  return { refresh: () => { signature = ''; draw(); } };
}
