// Vite replaces this flag for the local test launcher. No backend is required.
export const LOCAL_ONLY = import.meta.env?.VITE_LOCAL_ONLY === '1';
export function requireNetworkMode() {
  if (LOCAL_ONLY) throw new Error('Local test mode: multiplayer is disabled.');
}
