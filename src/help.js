import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e } from './ui.js';
import { APP_LABEL, APP_VERSION, CHANGELOG_FILENAME } from './version.js';
import { RELEASES, LEGACY_HISTORY } from './releaseHistory.js';
import { changelogMarkdown } from './releaseNotes.js';
import { currentLanguage } from './i18n.js';

// The help is written in both interface languages and redrawn when the language changes.
// Its body is left out of the automatic translation layer: it is prose, not interface strings.
// Release notes keep the language they were written in, as a historical record.
const TEXT = {
  es: {
    title: 'AYUDA', heading: 'Ayuda de la herramienta', versions: 'La versión de la aplicación y la de las reglas son independientes.',
    sections: 'Secciones de ayuda', guide: 'Guía rápida', body: 'Contenido de ayuda',
    history: 'Historial de cambios · versión instalada', download: 'Descargar changelog', notesLanguage: '',
    legacy: 'Entregas anteriores · Orbital', legacyText: 'Conservan sus nombres originales, sin asignarles versiones retroactivas.',
    legacyFull: 'El historial técnico completo se conserva en <strong>RELEASE_ORBITAL.md</strong>, dentro del ZIP.',
    shortcuts: 'Atajos útiles',
    keys: '<kbd>B</kbd> Dibujar · <kbd>D</kbd> Borrar dibujos · <kbd>Ctrl</kbd> + <kbd>C</kbd>/<kbd>V</kbd> Copiar/pegar · <kbd>U</kbd> Agua · <kbd>Ctrl</kbd> + <kbd>Z</kbd> Deshacer · <kbd>Ctrl</kbd> + <kbd>Y</kbd> Rehacer · <kbd>Esc</kbd> Cancelar trazado',
    guideItems: version => [
      ['Idioma e inicio', 'El selector <strong>ES / EN</strong> de la barra inferior (y del vestíbulo) cambia toda la interfaz, esta ayuda y los avisos. Los términos de reglas del Corebook se mantienen en inglés. El botón <strong>⌂</strong> de la cabecera vuelve a la pantalla de inicio.'],
      ['Macro y microentornos', '<strong>SCENES → Definir entorno / activar con Fear</strong>. Elige un microentorno y una sola característica Passive o Action del macro; guarda y activa las características con su coste impreso. El Tier muestra el escalado del Keeper, capítulos 9 y 10. Las tiradas, objetivos y consecuencias se resuelven según el texto.'],
      ['Bosses por estados', '<strong>ROSTER → Biblioteca de adversarios → Colocar como boss</strong>, o <strong>Ficha → Boss · estados</strong>. Revisa las cifras heredadas y configura los disparadores. Al cambiar de fase: +2 Fear, o +3 en la final, máximo 12. Confirma los objetivos y el momento del Spotlight indicado por el perfil.'],
      ['Impactos de armas', 'En <strong>DICE → Damage</strong>, elige el impacto o prepara el arma desde su ficha. Aparece al aplicar el daño: 1 HP = 50% del token, 2 HP = 100%, +20% por HP adicional hasta 200%. Armor consumido muestra el escudo; daño directo lo omite. Los efectos visuales no aplican condiciones automáticamente.'],
      ['Organizar escenas', 'El selector de destino de cada escena permite moverla a otro arco o dejarla en <strong>Sin arco</strong>. Las escenas independientes se pueden activar y configurar. Espera a <strong>SAVED</strong> antes de recargar o cerrar.'],
      ['Salas persistentes y partida online', 'Con Firebase configurado, <strong>SESIONES</strong> muestra las salas que diriges y aquellas en las que juegas. Inicia sesión con Google o correo, crea una sala o acepta una invitación (ej. NAV-33F44) una sola vez. El Keeper asigna tokens, expulsa o readmite y puede regenerar el código sin retirar a los miembros. Los arcos y escenas se conservan al volver. Sin Keeper, la sala queda en pausa hasta que regrese; un cierre inesperado puede tardar unos 20 segundos en detectarse. En LAN, usa <strong>INICIAR_VTT_RED_LOCAL.bat</strong>. El archivo local sigue en <strong>Sesiones guardadas</strong>.'],
      ['Dibujo y copiar/pegar', '<strong>Dibujar [B]</strong>: paleta visual y tres grosores. <strong>Borrar [D]</strong> elimina trazos completos, nunca otros elementos. Los jugadores borran y copian solo sus dibujos. Selecciona un elemento y usa <strong>Ctrl+C / Ctrl+V</strong> (Cmd en Mac); cada copia se desplaza una casilla. El Keeper duplica tokens, paredes, luces, agua, anomalías, dibujos y plantillas. Los tokens copiados no heredan jugadores. Esc, cambiar de herramienta o perder la conexión cancela el trazo pendiente.'],
      ['Tu personaje', 'Importa tu JSON desde <strong>SESIONES → Partida y tripulación</strong> o pide al Keeper que te asigne un personaje. <strong>My tokens</strong> reúne tu personaje y los drones que controlas. Abre <strong>Ficha</strong> para recursos, condiciones, armas e inventario. Los movimientos y recursos se muestran de inmediato y se confirman con el Keeper; un rechazo o pérdida de respuesta muestra un aviso. La visión espera esa confirmación.'],
      ['Cartas y Loadout', 'La mano de cartas aparece abajo al controlar un personaje: pasa el ratón para ampliarla y arrástrala al tablero (o haz clic) para usarla, pagando su coste. El icono de mazo abre el cajón para intercambiar Poderes entre Loadout y Vault. El Keeper recibe cada carta usada en la esquina inferior derecha y en el chat; su propia mano reúne los Fear moves y las habilidades del adversario seleccionado.'],
      ['Tu cuenta', 'La esquina superior derecha muestra <strong>Iniciar sesión · Offline</strong> con piloto rojo si no has accedido. Al entrar aparece tu nombre, <strong>Conectado</strong> y el piloto verde. Este indicador es de tu cuenta; la conexión a la partida se muestra por separado junto al nombre de sesión y su invitación. Puedes jugar localmente o unirte por invitación sin iniciar sesión en una cuenta.'],
      ['Mantener el acceso', 'Marca <strong>Mantener la sesión en este dispositivo</strong> al entrar con Google o correo. Vuelve mediante la misma dirección y puerto del VTT: el navegador separa el acceso de cada sitio. La cuenta y la conexión a la partida son independientes.'],
      ['Agua y polígonos', '<strong>Water → Caja</strong>: arrastra. <strong>Polígono</strong>: pulsa cada vértice y cierra en el primero, con doble clic, Enter o <strong>Cerrar polígono</strong>. Retroceso quita el último vértice. Esc, Cancelar o cambiar de herramienta descarta el trazado pendiente. En el inspector, <strong>Ondas de lluvia</strong> activa impactos sobre el agua de esa escena, con intensidad de llovizna a tormenta; la bruma se controla por separado.'],
      ['Chat y tiradas', '<strong>CHAT → Mesa</strong> habla con todos. Los susurros son entre Keeper y jugador; cada conversación conserva su borrador. En <strong>DICE</strong>, el Keeper puede activar <strong>Tirada secreta</strong> antes de tirar.'],
      ['Guardar y volver', 'Los cambios se guardan en este navegador. <strong>SESIONES</strong> permite abrir, crear y exportar campañas. La exportación del Keeper incluye sus datos privados. Mantén abierta su pestaña durante la partida; reconecta con la misma invitación y perfil para recuperar tu identidad de esa sesión.'],
      ['Si algo falla', `Comprueba el estado online/offline del menú y que ambos equipos usan la misma versión. Para informar de un fallo, indica <strong>VTT v${version}</strong>, la herramienta y los pasos para reproducirlo. El ZIP incluye <strong>PRUEBAS_LOCALES.md</strong>.`],
    ],
  },
  en: {
    title: 'HELP', heading: 'Tool help', versions: 'The application version and the rules version are independent.',
    sections: 'Help sections', guide: 'Quick guide', body: 'Help content',
    history: 'Change history · installed version', download: 'Download changelog', notesLanguage: 'Release notes are kept in the language they were written in (Spanish).',
    legacy: 'Earlier deliveries · Orbital', legacyText: 'They keep their original names, with no retroactive version numbers.',
    legacyFull: 'The full technical history is kept in <strong>RELEASE_ORBITAL.md</strong>, inside the ZIP.',
    shortcuts: 'Useful shortcuts',
    keys: '<kbd>B</kbd> Draw · <kbd>D</kbd> Erase drawings · <kbd>Ctrl</kbd> + <kbd>C</kbd>/<kbd>V</kbd> Copy/paste · <kbd>U</kbd> Water · <kbd>Ctrl</kbd> + <kbd>Z</kbd> Undo · <kbd>Ctrl</kbd> + <kbd>Y</kbd> Redo · <kbd>Esc</kbd> Cancel stroke',
    guideItems: version => [
      ['Language and home', 'The <strong>ES / EN</strong> switch in the bottom bar (and in the lobby) changes the whole interface, this help and the notices. Corebook rule terms stay in English. The <strong>⌂</strong> button in the header goes back to the home screen.'],
      ['Macro and micro environments', '<strong>SCENES → Define environment / activate with Fear</strong>. Choose a micro environment and a single Passive or Action feature from the macro; save, and activate features at their printed cost. The Tier shows the Keeper’s scaling, chapters 9 and 10. Rolls, objectives and consequences are resolved by the text.'],
      ['Bosses by states', '<strong>ROSTER → Adversary library → Place as boss</strong>, or <strong>Sheet → Boss · states</strong>. Check the inherited figures and set the triggers. On a phase change: +2 Fear, or +3 on the final one, up to 12. Confirm the objectives and the Spotlight timing the profile gives.'],
      ['Weapon impacts', 'In <strong>DICE → Damage</strong>, choose the impact or prepare the weapon from its sheet. It appears when damage is applied: 1 HP = 50% of the token, 2 HP = 100%, +20% per extra HP up to 200%. Spent Armor shows the shield; direct damage skips it. Visual effects never apply conditions on their own.'],
      ['Organising scenes', 'Each scene’s destination picker moves it to another arc or leaves it under <strong>No arc</strong>. Standalone scenes can be activated and configured. Wait for <strong>SAVED</strong> before reloading or closing.'],
      ['Persistent rooms and online play', 'With Firebase configured, <strong>SESSIONS</strong> lists the rooms you run and the ones you play in. Sign in with Google or email, create a room or accept an invitation (e.g. NAV-33F44) once. The Keeper assigns tokens, removes or readmits players and can regenerate the code without removing members. Arcs and scenes are kept when you come back. Without the Keeper the room is paused until they return; an unexpected close can take about 20 seconds to be noticed. On a LAN, use <strong>INICIAR_VTT_RED_LOCAL.bat</strong>. The local archive is still under <strong>Saved sessions</strong>.'],
      ['Drawing and copy/paste', '<strong>Draw [B]</strong>: visual palette and three widths. <strong>Erase [D]</strong> removes whole strokes, never other elements. Players erase and copy only their own drawings. Select an element and use <strong>Ctrl+C / Ctrl+V</strong> (Cmd on Mac); each copy is offset by one square. The Keeper duplicates tokens, walls, lights, water, anomalies, drawings and templates. Copied tokens do not inherit players. Esc, changing tool or losing the connection cancels the pending stroke.'],
      ['Your character', 'Import your JSON from <strong>SESSIONS → Game and crew</strong> or ask the Keeper to assign you a character. <strong>My tokens</strong> gathers your character and the drones you control. Open <strong>Sheet</strong> for resources, conditions, weapons and inventory. Moves and resources show at once and are confirmed by the Keeper; a rejection or a lost answer shows a notice. Vision waits for that confirmation.'],
      ['Cards and Loadout', 'Your hand of cards appears at the bottom when you control a character: hover to enlarge it and drag a card onto the board (or click it) to use it, paying its cost. The deck icon opens the drawer to swap Powers between Loadout and Vault. The Keeper sees each card used in the bottom-right corner and in the chat; their own hand holds the Fear moves and the selected adversary’s abilities.'],
      ['Your account', 'The top-right corner shows <strong>Sign in · Offline</strong> with a red light when you have not signed in. Once in, it shows your name, <strong>Connected</strong> and a green light. That indicator is for your account; the game connection is shown separately next to the session name and its invitation. You can play locally or join by invitation without signing in to an account.'],
      ['Staying signed in', 'Tick <strong>Keep me signed in on this device</strong> when signing in with Google or email. Come back through the same VTT address and port: the browser keeps each site’s sign-in separate. The account and the game connection are independent.'],
      ['Water and polygons', '<strong>Water → Box</strong>: drag. <strong>Polygon</strong>: click each vertex and close on the first one, with a double click, Enter or <strong>Close polygon</strong>. Backspace removes the last vertex. Esc, Cancel or changing tool discards the pending outline. In the inspector, <strong>Rain ripples</strong> turns on raindrops over that scene’s water, from drizzle to storm; the mist is controlled separately.'],
      ['Chat and rolls', '<strong>CHAT → Table</strong> talks to everyone. Whispers are between the Keeper and one player; each conversation keeps its own draft. In <strong>DICE</strong>, the Keeper can turn on <strong>Secret roll</strong> before rolling.'],
      ['Saving and coming back', 'Changes are saved in this browser. <strong>SESSIONS</strong> opens, creates and exports campaigns. The Keeper’s export includes their private data. Keep the Keeper’s tab open during play; reconnect with the same invitation and profile to recover your identity in that session.'],
      ['If something goes wrong', `Check the online/offline state in the menu and that every computer runs the same version. To report a fault, give <strong>VTT v${version}</strong>, the tool and the steps to reproduce it. The ZIP includes <strong>PRUEBAS_LOCALES.md</strong>.`],
    ],
  },
};

function helpBody(t, version) {
  return `
    <div class="help-hero"><span class="dossier-eyebrow">VEILFARERS / ORBITAL</span><h2>${t.heading}</h2><div class="help-version"><strong>VTT v${version}</strong><span>Corebook 12.06</span></div><p>${t.versions}</p></div>
    <nav class="dossier-tabs" aria-label="${t.sections}"><button type="button" class="hud-btn active" data-help-tab="guide" aria-pressed="true">${t.guide}</button><button type="button" class="hud-btn" data-help-tab="changes" aria-pressed="false">Changelog · v${version}</button></nav>
    <section data-help-panel="guide" aria-label="${t.guide}">
      <div class="help-guide-grid">${t.guideItems(version).map(([title, text]) => `<article><h3>${title}</h3><p>${text}</p></article>`).join('')}</div>
      <div class="help-shortcuts"><h3>${t.shortcuts}</h3><p>${t.keys}</p></div>
    </section>
    <section data-help-panel="changes" aria-label="Changelog" hidden>
      <div class="help-changelog-actions"><p>${t.history} <strong>v${version}</strong></p><button type="button" class="hud-btn" data-download-changelog>${t.download}</button></div>
      ${t.notesLanguage ? `<p class="help-notes-language">${t.notesLanguage}</p>` : ''}
      ${RELEASES.map(release => `<article class="help-release"><header><strong>v${e(release.version)}</strong><time datetime="${e(release.date)}">${e(release.date)}</time></header><h3>${e(release.title)}</h3>${release.sections.map(section => `<h4>${e(section.title)}</h4><ul>${section.items.map(item => `<li>${e(item)}</li>`).join('')}</ul>`).join('')}</article>`).join('')}
      <article class="help-release"><h3>${t.legacy}</h3><p>${t.legacyText}</p><ul>${LEGACY_HISTORY.map(entry => `<li><strong>${e(entry.date)} · ${e(entry.title)}</strong><br>${e(entry.text)}</li>`).join('')}</ul><p>${t.legacyFull}</p></article>
    </section>`;
}

const helpText = (lang = currentLanguage()) => TEXT[lang] || TEXT.es;
export const helpTitle = (lang = currentLanguage()) => `${helpText(lang).title} · ${APP_LABEL}`;

// Fills the dialog in the current language, keeping the open tab and the scroll position.
function paint(modal) {
  const t = helpText(), version = e(APP_VERSION);
  const body = modal.querySelector('.dossier-body');
  const tab = modal.querySelector('[data-help-tab].active')?.dataset.helpTab || 'guide';
  const scroll = body.scrollTop;
  const title = helpTitle();
  modal.querySelector('.veil-modal-header h3').textContent = title;
  modal.querySelector('[role="dialog"]').setAttribute('aria-label', title);
  modal.querySelector('.veil-modal-header').setAttribute('data-no-i18n', '');
  body.innerHTML = helpBody(t, version);
  body.setAttribute('aria-label', t.body);
  const select = name => {
    modal.querySelectorAll('[data-help-tab]').forEach(item => { const active = item.dataset.helpTab === name; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
    modal.querySelectorAll('[data-help-panel]').forEach(panel => { panel.hidden = panel.dataset.helpPanel !== name; });
  };
  modal.querySelectorAll('[data-help-tab]').forEach(button => { button.onclick = () => select(button.dataset.helpTab); });
  select(tab);
  body.scrollTop = scroll;
  modal.querySelector('[data-download-changelog]').onclick = () => {
    const url = URL.createObjectURL(new Blob([changelogMarkdown()], { type:'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href=url; link.download=CHANGELOG_FILENAME; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}

export function openHelp() {
  const existing = document.querySelector('.help-dialog');
  if (existing) { existing.querySelector('.modal-close-btn').focus(); return existing; }
  const modal = dossierDialog(helpTitle(), '', 'help-dialog');
  const body = modal.querySelector('.dossier-body');
  body.classList.add('veil-modal-body'); body.tabIndex = 0; body.setAttribute('data-no-i18n', '');
  paint(modal);
  const repaint = () => { if (modal.isConnected) paint(modal); else window.removeEventListener('veil:language', repaint); };
  window.addEventListener('veil:language', repaint);
  return modal;
}
