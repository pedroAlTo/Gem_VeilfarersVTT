// The language switch (ES / EN) and the Home button of the header.
import { LANGUAGES, currentLanguage, setLanguage } from './i18n.js';

export function languageSwitch(className = '') {
  const group = document.createElement('div');
  group.className = `lang-switch ${className}`.trim();
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Idioma de la interfaz');
  for (const code of Object.keys(LANGUAGES)) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'lang-btn'; button.dataset.lang = code;
    button.textContent = code.toUpperCase(); button.title = LANGUAGES[code];
    button.onclick = () => setLanguage(code);
    group.append(button);
  }
  const mark = () => group.querySelectorAll('.lang-btn').forEach(b => { const on = b.dataset.lang === currentLanguage(); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  window.addEventListener('veil:language', mark); mark();
  return group;
}

// Home: back to the lobby (room list and characters) without leaving the table, which stays
// open underneath. From there the player can open another room or come back.
export function goHome() {
  const root = document.getElementById('vf-lobby-gateway');
  const lobby = window.veilLobby;
  if (lobby?.currentUser) { lobby.showHubScreen(); lobby.loadRoomsList?.(); lobby.loadCharacters?.(); }
  else root?.classList.remove('hidden');
}

// The header is already full: Home is an icon (and the VEILFARERS badge also goes home); the
// language switch lives in the status bar at the bottom.
export function mountHeaderControls() {
  const actions = document.querySelector('.header-hud .header-actions');
  if (actions && !actions.querySelector('#home_btn')) {
    const home = document.createElement('button');
    home.type = 'button'; home.id = 'home_btn'; home.className = 'hud-btn hud-btn-xs home-btn';
    home.textContent = '⌂'; home.title = 'Volver a la pantalla de inicio'; home.setAttribute('aria-label', 'Volver a la pantalla de inicio');
    home.onclick = goHome;
    actions.prepend(home);
  }
  const brand = document.querySelector('.header-hud .brand-badge');
  if (brand && !brand.dataset.home) {
    brand.dataset.home = 'true'; brand.setAttribute('role', 'button'); brand.tabIndex = 0;
    brand.title = 'Volver a la pantalla de inicio';
    brand.onclick = goHome;
    brand.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); goHome(); } };
  }
  const lobby = document.getElementById('vf-lobby-gateway');
  if (lobby && !lobby.querySelector('.lang-switch')) lobby.append(languageSwitch('lang-switch-lobby'));
}
export function mountStatusbarLanguage() {
  const bar = document.querySelector('[data-settings-lang]') || document.querySelector('.header-status');
  if (bar && !bar.querySelector('.lang-switch')) bar.append(languageSwitch('lang-switch-status'));
}
