// Vite replaces this flag for the local test launcher. No backend is required.
export const LOCAL_ONLY = import.meta.env?.VITE_LOCAL_ONLY === '1';
export const LAN_SESSIONS = !LOCAL_ONLY && import.meta.env?.DEV && import.meta.env?.VITE_SESSION_TRANSPORT === 'lan';
export function requireNetworkMode() {
  if (LOCAL_ONLY) throw new Error('Local test mode: multiplayer is disabled.');
}

export function connectionDisplay(state, role) {
  if (state.joiningSession) return { label: 'CONNECTING', detail: 'WAITING FOR MAP' };
  if (role === 'player') return state.isConnected
    ? { label: 'ONLINE', detail: 'LINKED TO KEEPER' }
    : { label: 'OFFLINE', detail: 'CONNECTION LOST' };
  if (state.isHosting && state.isConnected) {
    const count = state.connectedPeers?.length || 0;
    return { label: 'ONLINE', detail: count ? `${count} LINKED` : 'WAITING FOR PLAYERS' };
  }
  return { label: 'OFFLINE', detail: state.userRole === 'player' ? 'LOCAL PREVIEW' : 'LOCAL' };
}
