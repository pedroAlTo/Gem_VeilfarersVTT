// Toggling a token's spotlight (Foco), shared by the character bar and the player's Ficha.
// On a table that is not a connected player it also tells the players and the Fear it cost.
import { store } from './state.js';
import { network } from './networkManager.js';
import { notify } from './ui.js';

export function toggleSpotlight(tokenId) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token || !store.canEditToken(token.id)) return false;
  const on = !token.hasSpotlight;
  if (!store.setTokenSpotlight(token.id, on)) return false;
  if (store.sessionRole !== 'player') {
    network.broadcast?.({ type: 'TOKEN_UPDATE', tokenId: token.id, partial: { hasSpotlight: on, spotlight: { ...(token.spotlight || {}), enabled: on } } });
    network.broadcast?.({ type: 'FEAR_UPDATE', fear: store.state.fear });
  }
  notify(on ? '✨ Tienes el foco.' : '✨ Foco desactivado.');
  return true;
}
