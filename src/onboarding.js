// First-use guide: a short list of steps per role. A step is ticked when the person really does
// it at the table (a roll, a card, a move...), never by pressing "next". Progress is kept per
// role in this browser; the guide can be hidden, closed and reopened from the help.
import { seatCharacter } from './gameRecord.js';

export const GUIDE_STORAGE_KEY = 'veil_guide_v1';

// `target`: what the "Show me" button highlights (first visible match). `needs`: a step that
// only applies in some setups (rooms need the cloud).
export const GUIDES = {
  player: [
    { id: 'character', title: 'Ten tu personaje', text: 'Pide al Keeper que te asigne un token o importa tu ficha desde SESIONES. Tu personaje aparece abajo, en tu mano de cartas y tus stats.', target: ['#network_modal_btn'] },
    { id: 'sheet', title: 'Abre tu ficha', text: 'Pulsa FICHA en la barra de tu token para ver recursos, condiciones, armas e inventario.', target: ['#open_sheet_btn', '#hud-toggle-btn'] },
    { id: 'move', title: 'Mueve tu token', text: 'Arrastra tu token por el mapa. El Keeper confirma el movimiento y tu visión se actualiza.', target: ['#tactical_canvas'] },
    { id: 'roll', title: 'Haz una tirada', text: 'En la pestaña DICE elige un Trait y pulsa TIRAR. El resultado aparece en la tarjeta dorada y en el chat.', target: ['.tab-nav-btn[data-tab="dice"]'] },
    { id: 'card', title: 'Usa una carta', text: 'Pasa el ratón por tu mano de cartas y arrastra una al tablero (o haz clic) para usarla; se paga su coste y la mesa ve el efecto.', target: ['#card_hand_root'] },
    { id: 'chat', title: 'Escribe a la mesa', text: 'Abre CHAT (o pulsa Intro), escribe un mensaje a la mesa o susúrrale al Keeper.', target: ['.tab-nav-btn[data-tab="chat"]'] },
  ],
  keeper: [
    { id: 'room', title: 'Crea tu sala', text: 'En SESIONES crea una sala online: guarda la campaña en la nube y te da una invitación para tus jugadores.', target: ['#network_modal_btn'], needs: 'cloud' },
    { id: 'scene', title: 'Prepara una escena', text: 'En SCENES crea una escena con tu mapa o activa otra de la campaña.', target: ['.tab-nav-btn[data-tab="scenes"]'] },
    { id: 'adversary', title: 'Coloca un adversario', text: 'En ROSTER abre la biblioteca de adversarios y coloca uno en la escena (puede entrar oculto).', target: ['.tab-nav-btn[data-tab="roster"]'] },
    { id: 'assign', title: 'Asigna un personaje', text: 'Cuando un jugador entre, asígnale su token desde SESIONES o desde el token. Sin jugadores, puedes saltar este paso.', target: ['#network_modal_btn'] },
    { id: 'fear', title: 'Gasta Fear', text: 'Tu mano de Keeper tiene las jugadas de Fear: arrastra una al tablero para usarla. El contador de Fear baja.', target: ['#card_hand_root'] },
    { id: 'roll', title: 'Haz una tirada', text: 'En DICE tira por un adversario (1d20 + Ataque) o pide una tirada. Con «Tirada secreta» solo la ves tú.', target: ['.tab-nav-btn[data-tab="dice"]'] },
  ],
};

export const guideRole = (sessionRole, userRole) => (sessionRole === 'player' || userRole === 'player' ? 'player' : 'keeper');
export const stepsFor = (role, { cloud = false } = {}) => (GUIDES[role] || []).filter(step => !step.needs || (step.needs === 'cloud' && cloud));

// Progress: { player: { done: [], skipped: [], closed: false }, keeper: {...} }.
export function readProgress(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage?.getItem(GUIDE_STORAGE_KEY) || '{}');
    const clean = entry => ({ done: [...new Set((entry?.done || []).filter(x => typeof x === 'string'))], skipped: [...new Set((entry?.skipped || []).filter(x => typeof x === 'string'))], closed: !!entry?.closed });
    return { player: clean(raw.player), keeper: clean(raw.keeper) };
  } catch { return { player: { done: [], skipped: [], closed: false }, keeper: { done: [], skipped: [], closed: false } }; }
}
export function writeProgress(progress, storage = globalThis.localStorage) {
  try { storage?.setItem(GUIDE_STORAGE_KEY, JSON.stringify(progress)); } catch {}
}
export function mark(progress, role, id, kind = 'done') {
  const entry = progress[role];
  if (!entry || entry.done.includes(id) || (kind === 'skipped' && entry.skipped.includes(id))) return false;
  if (kind === 'done') { entry.done.push(id); entry.skipped = entry.skipped.filter(x => x !== id); }
  else entry.skipped.push(id);
  return true;
}
export const settled = (entry, id) => entry.done.includes(id) || entry.skipped.includes(id);
export const finished = (entry, steps) => steps.every(step => settled(entry, step.id));

// Steps a change of table state completes. `base` is what the table looked like when the guide
// started watching, so things that were already there (the demo scene, its adversaries) do not
// count as something the person did.
export function stepsFromState(role, base, state, ctx = {}) {
  const done = [];
  const tokens = state.tokens || [];
  if (role === 'player') {
    // At the Keeper's own table (Player view), the selected character stands in for the seat.
    const mine = seatCharacter(tokens, ctx.seatId, state.claimedTokenId || ctx.previewTokenId);
    if (mine) {
      done.push('character');
      const start = base.positions?.[mine.id];
      if (start && (start.x !== mine.x || start.y !== mine.y)) done.push('move');
    }
  } else {
    if (ctx.keeperRoom) done.push('room');
    if ((state.maps || []).length > (base.mapCount ?? Infinity) || (base.activeMapId && state.activeMapId !== base.activeMapId)) done.push('scene');
    if (tokens.filter(t => t.actorType === 'adversary').length > (base.adversaries ?? Infinity)) done.push('adversary');
    if (assignedCount(tokens) > (base.assigned ?? Infinity)) done.push('assign');
    if (typeof state.fear === 'number' && typeof base.fear === 'number' && state.fear < base.fear) done.push('fear');
  }
  return done;
}
const assignedCount = tokens => tokens.filter(t => t.actorType !== 'drone' && t.actorType !== 'adversary' && (t.ownerId || (t.controllerIds || []).length)).length;

export function baselineOf(state) {
  const tokens = state.tokens || [];
  return {
    mapCount: (state.maps || []).length, activeMapId: state.activeMapId, fear: state.fear,
    adversaries: tokens.filter(t => t.actorType === 'adversary').length, assigned: assignedCount(tokens),
    positions: Object.fromEntries(tokens.map(t => [t.id, { x: t.x, y: t.y }])),
  };
}

// Actions that are not visible in the shared state (a roll result, a card played, a message, a
// sheet opened) announce themselves with this event.
export function guideEvent(name) {
  if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('veil:guide', { detail: { event: name } }));
}
