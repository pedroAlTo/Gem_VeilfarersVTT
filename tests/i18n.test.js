import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'localStorage', 'NodeFilter', 'MutationObserver', 'CustomEvent']) globalThis[key] = dom.window[key];
const { translate, setLanguage, currentLanguage, startTranslation } = await import('../src/i18n.js');
const { PAIRS } = await import('../src/i18nDictionary.js');
after(() => dom.window.close());
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('Spanish is the default and a string is found from either language', () => {
  assert.equal(currentLanguage(), 'es');
  assert.equal(translate('ROSTER', 'es'), 'REPARTO'); assert.equal(translate('REPARTO', 'en'), 'ROSTER');
  assert.equal(translate('REPARTO', 'es'), 'REPARTO', 'already in the target language');
  assert.equal(translate('  APPLY   DAMAGE TO TARGET TOKEN ', 'es'), 'APLICAR DAÑO AL TOKEN OBJETIVO', 'spacing does not matter');
  assert.equal(translate('Capt. Jonathan Harker', 'es'), null, 'names are not interface strings');
  // A variant spelling used by a template maps to the same pair.
  assert.equal(translate('Cuenta: Offline · iniciar sesión', 'es'), 'Cuenta: Sin conexión · iniciar sesión');
  assert.equal(translate('Cuenta: Offline · iniciar sesión', 'en'), 'Account: Offline · sign in');
});

test('strings with numbers and names inside use the templates, translating the parts that are known', () => {
  assert.equal(translate('ROLL FINESSE (+1)', 'es'), 'TIRAR FINESSE (+1)');
  assert.equal(translate('TACTICAL ROSTER (4)', 'es'), 'REPARTO TÁCTICO (4)');
  assert.equal(translate('Paso 1 de 9 · 0 completos', 'en'), 'Step 1 of 9 · 0 complete');
  assert.equal(translate('3 / 8 SEGMENTS', 'es'), '3 / 8 SEGMENTOS');
  assert.equal(translate('SCENE: Bridge // USC Vagrant Star', 'es'), 'ESCENA: Bridge // USC Vagrant Star');
});

test('the dictionary is consistent: no Spanish form points to two English ones', () => {
  const seen = new Map();
  for (const [es, en] of PAIRS) { if (seen.has(es)) assert.equal(seen.get(es), en, es); seen.set(es, en); }
  assert.ok(PAIRS.length > 600);
});

test('the page is translated as it changes, player content and book text are left alone, and the language can be switched back', async () => {
  document.body.innerHTML = `<nav><button title="Rehacer [Ctrl+Y / Ctrl+Shift+Z]">DICE</button><button>ROSTER</button></nav>
    <div class="chat-messages"><p>ROSTER</p></div><div class="vf-card"><span>Close</span><span>ROSTER</span></div>
    <input placeholder="Search module"><p> SCENES </p>`;
  startTranslation(document.body);
  const text = selector => document.querySelector(selector).textContent;
  assert.equal(text('nav button'), 'DADOS'); assert.equal(text('nav button + button'), 'REPARTO');
  assert.equal(document.querySelector('nav button').title, 'Rehacer [Ctrl+Y / Ctrl+Shift+Z]');
  assert.equal(document.querySelector('input').placeholder, 'Buscar módulo');
  assert.equal(text('body > p'), ' ESCENAS ', 'the spaces around the text are kept');
  assert.equal(text('.chat-messages p'), 'ROSTER', 'chat is never translated');
  assert.equal(text('.vf-card span + span'), 'ROSTER', 'nor is a card');
  // Content added later.
  const added = document.createElement('button'); added.textContent = 'END ROUND'; document.body.append(added);
  await tick(); await tick();
  assert.equal(added.textContent, 'FIN DE RONDA');
  added.textContent = 'CLEAR'; await tick(); await tick();
  assert.equal(added.textContent, 'LIMPIAR', 'a node whose text the app changes');
  // Switching language and back.
  let announced = null; window.addEventListener('veil:language', event => { announced = event.detail.language; }, { once: true });
  setLanguage('en');
  assert.equal(announced, 'en'); assert.equal(document.documentElement.lang, 'en'); assert.equal(localStorage.getItem('veil_lang'), 'en');
  assert.equal(text('nav button'), 'DICE'); assert.equal(added.textContent, 'CLEAR'); assert.equal(document.querySelector('nav button').title, 'Redo [Ctrl+Y / Ctrl+Shift+Z]');
  setLanguage('es');
  assert.equal(text('nav button'), 'DADOS'); assert.equal(text('.chat-messages p'), 'ROSTER');
  assert.equal(setLanguage('fr'), 'es', 'an unknown language changes nothing');
});

test('notices and error messages are translated both ways, with names and nested messages inside', async () => {
  const { MESSAGE_PAIRS, MESSAGE_PATTERNS } = await import('../src/i18nMessages.js');
  assert.ok(MESSAGE_PAIRS.length > 250 && MESSAGE_PATTERNS.length > 60);
  assert.equal(translate('Selecciona uno de tus tokens asignados.', 'en'), 'Select one of your assigned tokens.');
  assert.equal(translate('Not connected to the Keeper.', 'es'), 'Sin conexión con el Keeper.');
  assert.equal(translate('No hay Fear suficiente: hacen falta 2 y quedan 0.', 'en'), 'Not enough Fear: 2 needed and 0 left.');
  assert.equal(translate('3 personajes importados.', 'en'), '3 characters imported.');
  assert.equal(translate('1 personaje importado.', 'en'), '1 character imported.');
  // A mixed-language message from older code reads in one language.
  assert.equal(translate('Save failed: disco lleno. Exporta una copia desde SESIONES.', 'en'), 'Save failed: disco lleno. Export a copy from SESSIONS.');
  assert.equal(translate('Connection: Sala en pausa: espera al Keeper.', 'en'), 'Connection: Room paused: wait for the Keeper.');
  const seen = new Map();
  for (const [es, en] of MESSAGE_PAIRS) { if (seen.has(es)) assert.equal(seen.get(es), en, es); seen.set(es, en); }
});

test('a toast is shown in the interface language', async () => {
  const { notify } = await import('../src/ui.js');
  setLanguage('en');
  notify('Sesión guardada.');
  assert.equal(document.querySelector('#toast_stack .orbital-toast:last-child').textContent, 'Session saved.');
  notify('Mensaje que no está en el diccionario');
  assert.equal(document.querySelector('#toast_stack .orbital-toast:last-child').textContent, 'Mensaje que no está en el diccionario');
  setLanguage('es');
  notify('Session saved.');
  assert.equal(document.querySelector('#toast_stack .orbital-toast:last-child').textContent, 'Sesión guardada.');
});
