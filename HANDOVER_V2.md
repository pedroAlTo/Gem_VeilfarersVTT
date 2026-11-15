# HANDOVER V2 — Veilfarers VTT

> Léelo junto a `HANDOVER.md` (decisiones de diseño consolidadas, NO revertir) y `AGENTS.md`.
> Este archivo recoge el estado del trabajo de la versión 2 para poder continuar en un chat nuevo.
> Última actualización: 2026-11-14 · versión de la app 2.3.1 · rama `V2`.

## Objetivo de V2
Llevar una partida de Veilfarers al 100 % en la VTT, para dos públicos: jugadores con conocimientos básicos (herramientas simples a la vista) y usuarios avanzados (opciones desplegables).

Referencias: reglas en `System/` (Corebook 12.06). El repo `pedroAlTo/veilfarerscharcreator` (creador de personajes, player tool, ficha, subida de nivel, vault de poderes y equipo) es **solo referencia** de qué herramientas reimplementar dentro de la VTT.
Infraestructura: Netlify + Firebase (Auth, Firestore) + Cloudinary.

## Decisiones de V2 (consolidadas, NO revertir)
1. **Creador y VTT son proyectos independientes y NO comparten datos.** Sin login común ni vault compartido. El creador solo sirve de referencia de qué herramientas reimplementar dentro de la VTT. **Único punto de contacto: importar a mano un JSON de ficha** (`src/characterImport.js`).
2. **El login general es solo de la VTT (Firebase Auth).** Datos por usuario: sesiones unidas, personajes y notas por partida. Datos por sala de Keeper: arcos, mapas y configuración.
3. **Dirección visual aprobada: estilo FATES** (fates-world.webflow.io) **con paleta violeta**:
   - fondo `#0d0420` · profundo `#2a0b5c` · medio `#6d28d9` · luz `#c084fc` · acento `#fde68a`.
   - Retícula de líneas finas, celdas numeradas, títulos en mayúsculas muy espaciadas.
   - Lobby con conmutador **Básico / Avanzado**.
   - **NO cambiar los colores que fija `HANDOVER.md`** (dados, Hope, Fear, tokens) sin preguntar antes al usuario.
4. **El cian se mantiene como color de selección/activo en la mesa.** La paleta violeta se aplica a superficies, líneas y tipografía.

## Plan por fases
- **Fase 0 — Estabilización** (**cerrada en v2.0.2**, reglas publicadas): corregir fallos antes de añadir funciones.
- **Fase 1 — Fichas fieles al sistema** (PRIORIDAD): modelo de ficha propio de la VTT (el esquema `veilfarers.character/2` del creador solo se admite como formato de importación manual); ficha según Corebook cap. 8; vistas Básica y Completa; subida de nivel y vault.
- **Fase 2 — Cuenta de la VTT**: login general solo de la VTT con Firebase Auth (decisión 2); por usuario: sesiones unidas, personajes, notas y datos personales por partida; por sala de Keeper: arcos, mapas y configuración.
- **Fase 3 — Onboarding e interfaz**: primer uso guiado, modo Básico/Avanzado, rediseño visual estilo FATES en violeta (decisión 3), accesibilidad, carga más rápida.

## Hecho en la rama V2
- Overlay de subtítulos de chat por encima de todo (`src/style.css`, `src/subtitleOverlay.js`).
- Personajes: guardado con upsert por `characterKey` (`src/cloudAccount.js`).
- `firestore.rules`: personajes con `create, update` y claves `id, key`; escenas con contenido táctico y `storagePath` opcional (Cloudinary).
- Aviso visible cuando un guardado queda solo en local (evento `veil:cloud-fallback`, escuchado en `src/main.js`).
- Importador: acepta versiones 2.8x del creador (`src/characterImport.js`).
- Hope/Effort usan `hopeMax` / `effortMax` en `src/tokenSheet.js`.
- Daño a token ajeno limitado a `hp` y `armor` (`src/networkManager.js`).
- **v2.0.1 — Arcos y notas** (`src/accountModel.js` define las formas; `firestore.rules` aplica los mismos límites):
  - Notas personales: `users/{uid}/notes/{id}` = `{id, roomId, title, body, updatedAt}`, privadas del autor. API: `account.saveNote(roomId, note)`, `account.listNotes(roomId)`, `account.removeNote(id)`. **Aún sin pantalla** (Fase 2).
  - Arcos de sala: `rooms/{roomId}/arcs/{id}` = `{id, name, description, sceneIds, order, updatedAt}`, solo el Keeper propietario. Es un **índice derivado**: la fuente de verdad sigue siendo el guardado de campaña (`state.arcs`). `RoomController.persist()` y la entrada del Keeper llaman a `RoomService.syncArcs()`, que solo escribe lo que cambia; `listArcs()` lo lee; `deleteRoom()` lo purga. Con reglas antiguas publicadas se desactiva solo (`arcSyncDisabled`) sin romper el guardado.
  - Tests: `tests/account-model.test.js` (sin emulador) y ampliaciones en `tests/account.integration.js` y `tests/rooms.integration.js`.
- **v2.0.2 — Bundle**: `vite.config.js` usa `manualChunks` como función: `firebase-core` (app, auth, util) y `firebase-rtdb` salen de `main` (1.316 kB → 888 kB); Firestore sigue en su chunk bajo demanda (no añadirlo a `manualChunks`). PeerJS se importa de forma diferida en `src/networkManager.js` (`loadPeer()`, solo si no se inyecta `peerFactory` y no es modo LAN). `main` ya solo contiene código propio; reducirlo más exige cargar bajo demanda módulos de interfaz (compendio, nave, editor de escenas), que hoy se importan de forma estática y cruzada desde `main.js`.
- Dados 3D: `public/assets/3d-dice/world.*.min.js` importaban `./Dice.min.js` y el archivo es `dice.min.js`; corregido (fallaba en servidores Linux).
- **v2.1.0 — Lobby nuevo (primer bloque de la Fase 3, adelantado a petición del usuario)**:
  - Estilos en `src/vtt-integration/styles/lobby-fates.css`, cargados encima de `lobby.css` (que no se ha tocado). Todo va bajo `#vf-lobby-gateway` y usa las variables `--fx-*` de la paleta de la decisión 3; reutilizarlas al rediseñar el resto de pantallas.
  - El marcado del lobby existe **dos veces**: en `index.html` (para que se vea antes de cargar los scripts) y en la plantilla de `lobbyGateway.js`. `tests/lobby-visual.test.js` exige que sean idénticos: cualquier cambio se hace en la plantilla y se copia a `index.html`.
  - Conmutador Básico/Avanzado: `setLobbyMode()`, atributo `data-lobby-mode` en la raíz, `localStorage['veil_lobby_mode']`. Lo que lleva la clase `fx-advanced` solo se ve en Avanzado (creador rápido, estadísticas y acciones de fichas del Vault, borrar sala). **Entrar a la mesa nunca es solo de Avanzado** (HANDOVER.md §1).
  - La web de referencia (fates-world.webflow.io) no era accesible desde el entorno de trabajo: el diseño sale de la descripción del usuario y está pendiente de su visto bueno.
  - Sin rediseñar todavía: el interior del creador rápido.
- **v2.1.1 — Marco de la mesa en violeta**: `src/theme-violet.css` (importado al final en `main.js`) redefine solo variables de superficie (`--bg-*`, `--border-*`, `--text-dim/muted`) y el aspecto de cabecera, barras, paneles, botones y campos. **No redefine** `--cyan-pearl`, `--crimson-fear`, `--purple-void` ni ningún selector de dados, tokens, Hope o Fear (lo comprueba `tests/lobby-visual.test.js`). **Decisión del usuario (14 nov 2026): el cian se queda como color de selección/activo en la mesa** (pasarlo a violeta lo confundiría con el Fear `#d8b4fe`, y el acento `#fde68a` coincide con el Hope).
- **v2.1.2 — Modales, paneles flotantes y HUD**: el mismo `theme-violet.css` cubre `veil-modal-*`, `dossier-*`, ayuda, salas, relojes, capas y los contenedores de `vf-player-hud` / `vf-keeper-panel`. El pie sticky de la ficha (HANDOVER.md §4) se conserva; solo cambia su color.
- **v2.1.3 — Consola lateral**: tarjetas de roster, arcos, escenas, documentos, registro, chat y contenedores del panel de tiradas. Varias tarjetas llevan estilos en línea en el JS (`sceneManager.js`, `rosterManager.js`), por eso el tema usa `!important` en `.arc-card` y `.scene-card:not(.active)`. Sin revisar en pantalla: ficha de personaje completa y el interior de los HUD de jugador/Keeper (solo aparecen dentro de una sala en la nube).
- **v2.2.0 — Fase 1, primer bloque (ficha)**: `characterDetails()` (`src/characterImport.js`) lee además `affiliations` (campos `affiliation`, `aff_standing`, `aff_reputation`, `aff_call` y sus variantes `aff_2_*`, `aff_3_*`), `affiliationTokens`, `factionNotes`, `connections` (`conn_first/debt/friction`), `seeds` (`seed_motive/afraid/crew/loss`), `signatureTrait`, `loadoutCap` (`a_loadout_cap`) y `vault` (`a_vault`). `openDossier()` los muestra en la pestaña **Vínculos** y en **Rasgos**. Son de solo lectura. Los nombres de campo salen del repo del creador (clonado solo para consulta; no se comparte nada con él). Recovery Anchor ya era editable en la ficha (pestaña Ficha, senda Sleeping). **Subtraits**: la ficha del creador no los guarda; en la VTT se eligen al tirar (selector Subtrait / Specialty del panel de dados).
- **v2.2.1 — Salas en el lobby**: el portal (`firebaseClient.js`) iniciaba sesión con una configuración de reserva, pero `cloudAccount.js` exigía las variables `VITE_FIREBASE_*`; sin ellas `cloudConfigured` era `false`, no se iniciaba la cuenta ni las salas y el lobby mostraba la lista vacía porque tragaba el error. Ahora ambos leen `src/firebaseConfig.js` (`getFirebaseConfig()`; fuera del build de Vite la nube sigue apagada, para los tests). `lobbyGateway.js`: `loadRoomsList()` pinta el error con Reintentar, y `runRoomAction()` devuelve al lobby con el motivo en `#vf-hub-error` si falla abrir, crear o unirse. **Sin confirmar con una cuenta real** (el entorno de trabajo no llega a Firebase): si el usuario sigue sin ver sus salas, el mensaje del lobby dirá la causa.
- **v2.2.2 — Standing, Reputation y Call editables**: inputs en la pestaña Vínculos; `setAffiliation()` (`src/characterImport.js`) escribe en `sourceCharacter.document.fields`, así que `exportSystemCharacter()` los conserva. Solo el Keeper (o partida local) los cambia; en vista de jugador quedan deshabilitados como el resto de la ficha.
- **v2.2.3 — Vínculos en todos los PJ**: la pestaña ya no depende de que la ficha importada traiga datos (el usuario no la veía). Se muestra en todo personaje jugador con las 3 afiliaciones y las 3 conexiones editables. Los actores sin ficha importada guardan estos campos en `token.sheetFields` (mismas claves que el creador: `affiliation`, `aff_standing`, `conn_first`…); `characterDetails()` lee de `sourceCharacter.document.fields` o, si no hay, de `sheetFields`. `setAffiliation()` / `setConnection()` escriben donde corresponda. **Lección**: no esconder una función nueva tras una condición de datos; mostrarla vacía y editable.
- **v2.3.0 — Ficha Básica / Completa**: `openDossier()` marca con la clase `sheet-full` lo que solo sale en Completa (identidad, nivel, máximos, Resolve máx./dado, Honed Edge, pestaña JSON, botones de exportar, Player controls, Ajustes del token, Boss) y pone `data-sheet-view` en el modal; `dossiers.css` lo oculta en Básica. Preferencia en `localStorage['veil_sheet_view']`; por defecto jugador = Básica, Keeper = Completa. Los campos ocultos siguen en el formulario, así que guardar en Básica no pierde nada. El conmutador usa el cian de "activo" (decisión 4).
- **v2.3.1 — Daño**: el panel de daño (`src/diceRoller.js`) tenía marcada por defecto la casilla de mitigar y gastaba 1 Armor Slot sin que nadie lo eligiera (un 6 contra Major 10 salía "Deflected 0 HP"). Corebook cap. 10, paso 6: *"The defender **may** mark an Armor Slot"*. Ahora la casilla empieza desmarcada, `resolveDamage()` tiene `useArmorSlot = false` por defecto y, con objetivo, se usan los umbrales del token (antes los campos manuales podían quedar desfasados: mostraba Severe 20 con un token 10/16). **Pendiente de revisar contra el Corebook**: (a) Penetración del paso 4 (Energy −2 y Void −4 a los umbrales del impacto; Reflective y Wards lo anulan) no está implementada; (b) el diálogo Gastar escudos deja gastar varios Armor Slots en un mismo impacto, y el Corebook habla de marcar uno por impacto. Preguntar al usuario antes de cambiar (b).
- Emulador de Firestore: `npm run test:account` (3/3) y `npm run test:rooms` (4/4) ejecutados y en verde el 14 nov 2026. La prueba de reconexión cubre corte de red del jugador, caída y vuelta del Keeper, reentrada sin invitación, segunda pestaña y conservación de varios tokens asignados.
- Tests nuevos en `tests/regressions.test.js`, `tests/characters-sessions.test.js` y `tests/account.integration.js` (reglas, requiere emulador: `npm run test:account`).

## Pendiente inmediato
1. ~~Desplegar las reglas~~ — **hecho por el usuario el 14 nov 2026** (reglas de v2.0.2, con arcos y notas). Falta comprobarlo en producción: guardar un personaje y una escena con sesión iniciada no debe mostrar el aviso de "guardado solo en este navegador". Si `firestore.rules` vuelve a cambiar, hay que publicarlas otra vez.
2. **Fase 1, pendiente**: subida de nivel y gestión del loadout/vault de poderes dentro de la VTT.
3. Fase 2 (según decisiones 1 y 2): retirar de la VTT el acceso con Netlify Identity (rama `isNetlify` de `src/cloudAccount.js`, que guarda solo en localStorage) y el `character_vault` global de Realtime Database que usa `src/vtt-integration/` (`lobbyGateway.js`, HUDs). **Preguntar al usuario antes de retirarlos**: puede haber cuentas y fichas en uso.

## Hallazgos de la auditoría (14 nov 2026)
- Creador = Netlify Identity; VTT = Firebase Auth con rama `isNetlify` que guarda solo en localStorage.
- Las entradas de personaje incluían `id`, que las reglas antiguas rechazaban: ningún personaje llegaba a Firestore.
- `saveScene` enviaba campos que las reglas antiguas rechazaban; el error sí se mostraba, pero la escena quedaba solo en local.

## Normas de trabajo
- Cada cambio: entrada en `src/releaseHistory.js` (primera entrada = versión de `package.json` y `package-lock.json`), luego `npm run release:notes` para regenerar `CHANGELOG.md`. El changelog se ve en la app y se copia al proyecto de Claude.
- Antes de cerrar: `npm test` y `npm run build`.
- UTF-8 estricto. Commit y push al terminar cada tarea.
- Actualizar este archivo al final de cada sesión de trabajo.
