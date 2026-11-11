import { dossierDialog } from './dossierUI.js';
import { escapeHTML as e } from './ui.js';
import { APP_LABEL, APP_VERSION, CHANGELOG_FILENAME } from './version.js';
import { RELEASES, LEGACY_HISTORY } from './releaseHistory.js';
import { changelogMarkdown } from './releaseNotes.js';

export function openHelp() {
  const existing = document.querySelector('.help-dialog');
  if (existing) { existing.querySelector('.modal-close-btn').focus(); return existing; }
  const modal = dossierDialog(`AYUDA · ${APP_LABEL}`, `
    <div class="help-hero"><span class="dossier-eyebrow">VEILFARERS / ORBITAL</span><h2>Ayuda de la herramienta</h2><div class="help-version"><strong>VTT v${e(APP_VERSION)}</strong><span>Corebook 12.06</span></div><p>La versión de la aplicación y la de las reglas son independientes.</p></div>
    <nav class="dossier-tabs" aria-label="Secciones de ayuda"><button type="button" class="hud-btn active" data-help-tab="guide" aria-pressed="true">Guía rápida</button><button type="button" class="hud-btn" data-help-tab="changes" aria-pressed="false">Changelog · v${e(APP_VERSION)}</button></nav>
    <section data-help-panel="guide" aria-label="Guía rápida">
      <div class="help-guide-grid">
        <article><h3>Macro y microentornos</h3><p><strong>SCENES → Definir entorno / activar con Fear</strong>. Elige un microentorno y una sola característica Passive o Action del macro; guarda y activa las características con su coste impreso. El Tier muestra el escalado del Keeper, capítulos 9 y 10. Las tiradas, objetivos y consecuencias se resuelven según el texto.</p></article>
        <article><h3>Bosses por estados</h3><p><strong>ROSTER → Biblioteca de adversarios → Colocar como boss</strong>, o <strong>Ficha → Boss · estados</strong>. Revisa las cifras heredadas y configura los disparadores. Al cambiar de fase: +2 Fear, o +3 en la final, máximo 12. Confirma los objetivos y el momento del Spotlight indicado por el perfil.</p></article>
        <article><h3>Impactos de armas</h3><p>En <strong>DICE → Damage</strong>, elige el impacto o prepara el arma desde su ficha. Aparece al aplicar el daño: 1 HP = 50% del token, 2 HP = 100%, +20% por HP adicional hasta 200%. Armor consumido muestra el escudo; daño directo lo omite. Los efectos visuales no aplican condiciones automáticamente.</p></article>
        <article><h3>Organizar escenas</h3><p>El selector de destino de cada escena permite moverla a otro arco o dejarla en <strong>Sin arco</strong>. Las escenas independientes se pueden activar y configurar. Espera a <strong>SAVED</strong> antes de recargar o cerrar.</p></article>
        <article><h3>Salas persistentes y partida online</h3><p>Con Firebase configurado, <strong>SESIONES</strong> muestra las salas que diriges y aquellas en las que juegas. Inicia sesión con Google o correo, crea una sala o acepta una invitación VF-… una sola vez. El Keeper asigna tokens, expulsa o readmite y puede regenerar el código sin retirar a los miembros. Los arcos y escenas se conservan al volver. Sin Keeper, la sala queda en pausa hasta que regrese; un cierre inesperado puede tardar unos 20 segundos en detectarse. En LAN, usa <strong>INICIAR_VTT_RED_LOCAL.bat</strong>. El archivo local sigue en <strong>Sesiones guardadas</strong>.</p></article>
        <article><h3>Dibujo y copiar/pegar</h3><p><strong>Dibujar [B]</strong>: paleta visual y tres grosores. <strong>Borrar [D]</strong> elimina trazos completos, nunca otros elementos. Los jugadores borran y copian solo sus dibujos. Selecciona un elemento y usa <strong>Ctrl+C / Ctrl+V</strong> (Cmd en Mac); cada copia se desplaza una casilla. El Keeper duplica tokens, paredes, luces, agua, anomalías, dibujos y plantillas. Los tokens copiados no heredan jugadores. Esc, cambiar de herramienta o perder la conexión cancela el trazo pendiente.</p></article>
        <article><h3>Tu personaje</h3><p>Importa tu JSON desde <strong>SESIONES → Partida y tripulación</strong> o pide al Keeper que te asigne un personaje. <strong>My tokens</strong> reúne tu personaje y los drones que controlas. Abre <strong>Ficha</strong> para recursos, condiciones, armas e inventario. Los movimientos y recursos se muestran de inmediato y se confirman con el Keeper; un rechazo o pérdida de respuesta muestra un aviso. La visión espera esa confirmación.</p></article>
        <article><h3>Tu cuenta</h3><p>La esquina superior derecha muestra <strong>Iniciar sesión · Offline</strong> con piloto rojo si no has accedido. Al entrar aparece tu nombre, <strong>Conectado</strong> y el piloto verde. Este indicador es de tu cuenta; la conexión a la partida se muestra por separado junto al nombre de sesión y su invitación. Puedes jugar localmente o unirte por invitación sin iniciar sesión en una cuenta.</p></article>
        <article><h3>Mantener el acceso</h3><p>Marca <strong>Keep me signed in on this device</strong> al entrar con Google o correo. Vuelve mediante la misma dirección y puerto del VTT: el navegador separa el acceso de cada sitio. Netlify restaura la sesión guardada por su widget. La cuenta y la conexión a la partida son independientes.</p></article>
        <article><h3>Agua y polígonos</h3><p><strong>Water → Caja</strong>: arrastra. <strong>Polígono</strong>: pulsa cada vértice y cierra en el primero, con doble clic, Enter o <strong>Cerrar polígono</strong>. Retroceso quita el último vértice. Esc, Cancelar o cambiar de herramienta descarta el trazado pendiente. En el inspector, <strong>Ondas de lluvia</strong> activa impactos sobre el agua de esa escena, con intensidad de llovizna a tormenta; la bruma se controla por separado.</p></article>
        <article><h3>Chat y tiradas</h3><p><strong>CHAT → Mesa</strong> habla con todos. Los susurros son entre Keeper y jugador; cada conversación conserva su borrador. En <strong>DICE</strong>, el Keeper puede activar <strong>Tirada secreta</strong> antes de tirar.</p></article>
        <article><h3>Guardar y volver</h3><p>Los cambios se guardan en este navegador. <strong>SESIONES</strong> permite abrir, crear y exportar campañas. La exportación del Keeper incluye sus datos privados. Mantén abierta su pestaña durante la partida; reconecta con la misma invitación y perfil para recuperar tu identidad de esa sesión.</p></article>
        <article><h3>Si algo falla</h3><p>Comprueba el estado online/offline del menú y que ambos equipos usan la misma versión. Para informar de un fallo, indica <strong>VTT v${e(APP_VERSION)}</strong>, la herramienta y los pasos para reproducirlo. El ZIP incluye <strong>PRUEBAS_LOCALES.md</strong>.</p></article>
      </div>
      <div class="help-shortcuts"><h3>Atajos útiles</h3><p><kbd>B</kbd> Dibujar · <kbd>D</kbd> Borrar dibujos · <kbd>Ctrl</kbd> + <kbd>C</kbd>/<kbd>V</kbd> Copiar/pegar · <kbd>U</kbd> Agua · <kbd>Ctrl</kbd> + <kbd>Z</kbd> Deshacer · <kbd>Ctrl</kbd> + <kbd>Y</kbd> Rehacer · <kbd>Esc</kbd> Cancelar trazado</p></div>
    </section>
    <section data-help-panel="changes" aria-label="Changelog" hidden>
      <div class="help-changelog-actions"><p>Historial de cambios · versión instalada <strong>v${e(APP_VERSION)}</strong></p><button type="button" class="hud-btn" data-download-changelog>Descargar changelog</button></div>
      ${RELEASES.map(release => `<article class="help-release"><header><strong>v${e(release.version)}</strong><time datetime="${e(release.date)}">${e(release.date)}</time></header><h3>${e(release.title)}</h3>${release.sections.map(section => `<h4>${e(section.title)}</h4><ul>${section.items.map(item => `<li>${e(item)}</li>`).join('')}</ul>`).join('')}</article>`).join('')}
      <article class="help-release"><h3>Entregas anteriores · Orbital</h3><p>Conservan sus nombres originales, sin asignarles versiones retroactivas.</p><ul>${LEGACY_HISTORY.map(entry => `<li><strong>${e(entry.date)} · ${e(entry.title)}</strong><br>${e(entry.text)}</li>`).join('')}</ul><p>El historial técnico completo se conserva en <strong>RELEASE_ORBITAL.md</strong>, dentro del ZIP.</p></article>
    </section>`, 'help-dialog');
  const body = modal.querySelector('.dossier-body');
  body.classList.add('veil-modal-body'); body.tabIndex = 0; body.setAttribute('aria-label', 'Contenido de ayuda');
  modal.querySelectorAll('[data-help-tab]').forEach(button => {
    button.onclick = () => {
      modal.querySelectorAll('[data-help-tab]').forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active)); });
      modal.querySelectorAll('[data-help-panel]').forEach(panel => { panel.hidden = panel.dataset.helpPanel !== button.dataset.helpTab; });
    };
  });
  modal.querySelector('[data-download-changelog]').onclick = () => {
    const url = URL.createObjectURL(new Blob([changelogMarkdown()], { type:'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href=url; link.download=CHANGELOG_FILENAME; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return modal;
}
