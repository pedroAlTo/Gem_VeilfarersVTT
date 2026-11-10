# VeilFarers VTT — Notas de entrega

## v1.2.0 — entornos, bosses por estados e impactos · 10 de noviembre de 2026

Base: `main` en `b1cac241e681807e929d32599e35016268687b63`. Se conservan las mejoras actuales de lluvia, bruma, exploración, colisiones y onboarding. Esta entrega incorpora las reglas de creación de escenarios de los capítulos 9 y 10 del Keeper 12.06 aportado, cuyo contenido coincide con la fuente del repositorio.

- **Escenarios:** 24 microentornos y 15 macroentornos. Cada mapa guarda su microentorno base, tier y una sola característica Passive o Action del macro. La interfaz muestra las reglas y DC impresos. Las activaciones descuentan el Fear indicado, comprueban recursos y disparadores, y registran la resolución en privado. Meltdown crea su reloj de seis segmentos una sola vez.
- **Bosses:** editor de 2–8 estados y 17 perfiles de referencia, accesible desde la ficha o la biblioteca de adversarios. Cada fase permite sus estadísticas, habilidades, narración, reserva de HP y disparador. El Keeper confirma las transiciones; se aplican las ganancias de Fear y excepciones de tiempo y condiciones del perfil. Los jugadores reciben solamente la fase pública actual. Los valores no impresos se heredan explícitamente del adversario base.
- **Combate:** impactos de balística, plasma/láser, fuego, criogénesis y explosión. Los proyectiles muestran escudo únicamente cuando la mitigación consume Armor. El efecto se genera al aplicar el daño, una sola vez, y su diámetro usa los HP realmente perdidos: 1 = 50%, 2 = 100%, +20% por HP adicional hasta 200%. Los ataques secretos no se retransmiten y los tiradores ocultos no revelan su origen.
- **Fuego de área:** llamas, calor y brasas distribuidos por la superficie y recortados al círculo, línea o polígono, con límites de trabajo y reducción de movimiento.
- **Escenas y arcos:** selector de destino para mover una escena a cualquier arco o dejarla sin arco. Se conservan mapas, tokens y escena activa. Los arcos participan en guardado, importación, exportación, undo y sincronización.

Validación: **189 pruebas automatizadas correctas**, `npm run build` correcto y `git diff --check` sin errores. Revisión en navegador de configuración ambiental, tier/DC, gasto de Fear, movimiento y persistencia de escenas sin arco, creación de boss y laboratorio de impactos/fuego. La compilación conserva las advertencias existentes por tamaño de paquetes. No se ha validado esta entrega entre dos equipos físicos.

Alcance: las tiradas, objetivos narrativos, efectos especiales de habilidades, inmunidades y consecuencias ambientales se resuelven por el Keeper conforme al texto mostrado. El VTT automatiza costes, estados, estadísticas declaradas y presentación; los efectos visuales no añaden daño ni condiciones. Las transiciones no conceden ataques automáticos. No se ha desplegado el VTT ni modificado el portal público.

Paquete: `VeilFarers_VTT_v1.2.0.zip`, con fuentes, pruebas, reglas de referencia, lanzadores locales, `dist/` y `CHANGELOG_v1.2.0.md`. La ayuda y el changelog muestran la misma versión. Instrucciones y recorridos de prueba en `PRUEBAS_LOCALES.md`.

Las notas siguientes documentan entregas históricas; el comportamiento y la validación actuales son los descritos arriba y en `CHANGELOG.md`.

## v1.1.1 — water-only rain ripples · 9 November 2026

Rain now creates expanding, fading double rings only inside water zones. Falling streaks, dry-ground splashes, screen washes and storm flashes have been removed. Impacts stay in map coordinates, respect concave shorelines and render with the water beneath lighting, vision fog and tokens. Hiding water hides the ripples. Per-scene rain can override legacy global weather; drizzle, rain and storm retain different impact densities. Reduced motion suppresses animated rain, and viewport culling plus quality budgets bound work on large maps.

The supplied ZIP's independent mist, intensity controls, color-picker/grid fixes and water controls are preserved. The GitHub launchers are retained. The supplied ZIP was named v1.1.1 but still declared v1.1.0 internally; package metadata, help and changelog now agree on v1.1.1. The effects lab compares intensity and mist separately, and pausing retains the ripple frame.

Validation: 148 automated tests pass, including shoreline clipping, camera stability, intensity density, rendering budgets, reduced motion, scene controls and layer order. The production build passes with the existing chunk-size warnings. Browser QA verified application loading, rain/mist controls, paused surface rings and AYUDA/Changelog v1.1.1. No public deployment or Firebase configuration was performed.

## v1.1.0 — versioned releases, help and changelog · 5 November 2026

The header now opens **AYUDA**, available to both Keeper and players. It shows the installed VTT version separately from Corebook 12.06, a quick-start guide, keyboard shortcuts and a changelog with versioned Markdown download. `package.json` supplies the displayed version and download filenames. The generated `CHANGELOG.md` and the in-app view share release entries; the build rejects mismatched package/lockfile/release versions or stale generated notes. This delivery is **VeilFarers_VTT_v1.1.0.zip**. Previous Orbital names and the original history below remain intact.

Validation: 138 automated tests and the production build pass. DOM checks verified help navigation, duplicate-dialog prevention, closing and the exact versioned changelog download for Keeper and Player. Visual browser review remains pending because the browser runtime is unavailable; existing build warnings remain.

## Water polygon creation and tool cancellation · 5 November 2026

Water creation previously discarded `shape` and `points`, producing the default rectangle regardless of the drawn outline. The store now preserves independent polygon vertices and bounds, accepts zero coordinates, and creates unique zone IDs. Polygon edits keep bounds current; token water detection and rain ripples respect the real outline. Existing rectangles cannot recover vertices that were never saved.

Changing tool, shape, scene, campaign, role or layer clears unfinished water immediately. Escape, right-click, lost focus and pointer/touch cancellation also clear it. Right-click cancellation cannot delete geometry beneath the draft. Double-click closes once without an extra vertex, and closing at the first point uses a consistent screen-space distance at every zoom. The flyout provides explicit close/cancel controls, vertex count and keyboard instructions. Backspace removes a vertex; degenerate drafts fail visibly. Water geometry now participates in undo comparison so separate edits remain undoable.

Validation: all 138 automated tests and the production build pass. The water regression suite exercises the real canvas mouse/keyboard handlers, shape buttons, all close methods, cancellation, mode changes, zero coordinates, editing, save/import, undo/redo and permissions. The LAN test also verifies polygon vertices on a player client and after reconnect. Browser visual review remains unverified because the browser runtime is unavailable. Existing chunk-size and lobby import warnings remain.

## Session chat and Keeper whispers · 4 November 2026

The new **CHAT** panel adds public table messages and private Keeper–player threads, with a **Susurrar** shortcut in the player roster. Cyan public and violet private channels show their audience explicitly. Separate drafts, unread counts, keyboard sending, offline status and retry feedback keep conversation handling clear. Player-to-player whispers and offline message delivery are not included.

The Keeper assigns authors from authenticated session membership and forwards whispers only to the relevant player. Full snapshots apply the same filtering on joins, scene updates and reconnects. Chat-only changes use small dedicated messages instead of resending maps. Client request IDs prevent uncertain retries from posting twice while the entry remains in the retained history. The last 500 messages are saved in the Keeper's session and export; guests never write this replica over their own campaign. New sessions and old archives without chat start empty. The existing browser-session identity is required to recover a private thread; closing and reopening the host does not provide persistent account identity.

Validation: 125 automated tests and the production build pass. Real LAN WebSocket tests cover public delivery, both whisper directions, a third player's excluded wire traffic, forged destinations, duplicate retries, offline rejection and filtered reconnect history. UI tests cover literal text rendering, separate drafts, keyboard/IME handling, unread counts and Player preview privacy. Browser visual QA could not run because the browser runtime is unavailable; review on a second physical computer remains pending. Existing Three.js/Firebase chunk and lobby import warnings remain.

## Visible conditions and weapon inventory · 4 November 2026

Tokens now show condition icons and quickbar labels. **ESTADOS** and **Ficha → Condiciones** provide the 18 standard conditions with the verbatim Corebook 12.06 Chapter 10 rules, plus custom markers. Reapplying a condition does not stack it. The Keeper and assigned players can edit; others can consult. Network condition actions merge on the Keeper so rapid independent toggles do not replace each other. Hidden is a game condition, separate from token visibility. No automatic damage, bonuses, duration expiry or condition clearing is introduced.

**EQUIPO / Ficha → Armas y equipo** displays imported weapons, kits and items and provides an editable inventory. **Preparar daño** opens the damage panel with the chosen expression, preserving the target. Base and final damage are explicit: final imported values do not receive Proficiency or Honed Edge again. Mixed dice pools are supported and use the existing player/Keeper Critical procedures; unsupported alternative or keep-highest expressions fail visibly. Special features, resistances and ammunition remain manual. Inventory edits persist in sessions and native VTT actor exports; creator exports retain their original equipment. Concurrent inventory edits detected in the local replica require reopening the editor.

Validation: 115 automated tests and the production build pass. Tests cover exact canonical text, icon overflow, ownership, malformed patches, native export/import, concurrent condition toggles, final/base damage, mixed pools, Critical, stale weapon preparation, and real LAN WebSockets with inventory/condition recovery on reconnect. Browser QA confirmed condition icons on the map, rules, inventory editing and preparation from the sheet. The final browser follow-up was interrupted by the preview/browser environment; testing on a second physical computer remains pending. Existing Three.js/Firebase chunk warnings are unchanged.

## Keeper secret rolls and adversary library · 4 November 2026

**Dice → Tirada secreta · solo Keeper** keeps checks, Bear Down and damage results in the Keeper's local session log. Private entries are omitted from player snapshots and dice broadcasts, including reconnects; players cannot request private actions. A Keeper can make a secret check without selecting a token. Public and secret Bear Down histories are separate. Switching to Player removes private results from the visible log, result panel and tray. Resource changes on visible sheets still synchronize normally, and Keeper session exports retain private history.

**Roster → Biblioteca de adversarios** searches names, abilities and types, with book and tier filters. The catalog is generated from the supplied 12.06 Alien Species threats, Keeper’s Companion Galactic Bestiary Section A, and Rust & Steel brokers: 57 profiles, 42 directly deployable. The remaining 15 are reference-only because their printed encounters lack standard numeric fields or use special procedures. No missing HP or thresholds are invented. Tokens start hidden by default in the active scene, carry the printed combat values and full source notes, and have independent resources. Unprinted Stress/Armor tracks have zero slots; special abilities and mixed/alternative attacks remain manual.

Validation: all 104 automated tests and `npm run build` pass. Tests cover source fidelity, filtering and deployment controls, permissions, private result cleanup, and two independent real LAN WebSockets: public rolls and movement synchronize while hidden actors and secret rolls never reach the player's wire traffic or reconnect snapshot. Visual browser review and a second physical computer remain unverified; the managed preview relay is unavailable in this environment. Existing build warnings concern large Three.js/Firebase chunks and a mixed static/dynamic lobby import.

## LAN session and token position sync · 3 November 2026

The Player button opens the invitation form. Offline preview is an explicit choice. The Keeper shows “Waiting for players” until someone joins, and the guest is marked online after receiving the map. LAN sessions use the VTT server’s WebSocket to deliver messages to invited clients. Keeper-side permissions and filtered snapshots apply to movement in both directions. Online sessions continue to use PeerJS.

The transport integration test starts Vite and opens independent WebSocket clients. It checks invitation rejection, room privacy, token assignment, movement from both endpoints, disconnect and recovery of the current position on rejoin.

## Windows LAN launchers · 3 November 2026

The dedicated LAN and online launchers serve the VTT on port 5173 on all interfaces. The menu also keeps a single-PC offline option. The launchers print the host’s IPv4 URLs and ask Vite to open the browser once it is listening. If address detection fails, the console explains how to find the correct Wi-Fi or Ethernet address with `ipconfig`.

All 95 automated tests and the production build passed. The new tests cover multiple adapters and a host without a shareable IPv4 address. The Windows batches and a connection from a second physical device remain unverified. The test environment restricted network interface enumeration during the Vite LAN startup check.

## Orbital IV.2 — assigned player controls, visual anomaly colors and compact dice tray · 3 November 2026

The dice tray is now a 352 px overlay anchored inside the map’s top-right corner (300/264 px on narrower screens). It has no modal backdrop or focus trap. Minimize preserves the results, close releases graphics resources, and settings stay collapsed until requested. Tray gestures and shortcuts cannot pan or alter the map; the rest of the tabletop remains usable.

All four finishes have new 512 px color maps, separate relief and illumination maps, clear numbers with orientation marks on 6/9, and consistent cyan Hope / magenta Fear. Actual chamfer geometry adds reflective edges. Lighting is less overexposed; metal recesses do not glow.

cannon-es now steps at 120 Hz with lower launch height, gentler spin, tuned mat friction/bounce, and better contact precision. No live-body nudges, pose snaps or off-table teleports remain. The preparation pass selects clean initial conditions for a flat landing within six simulation seconds, then the live world reproduces them exactly. It does not reroll authoritative game values. Cosmetic tests use natural face labels.

Assigned players can select their character and shared drones through **My tokens**. They can move, turn, roll and change current resources. The Keeper validates ownership and resource limits. Reassignment immediately transfers control, and assigned NPCs are visible to their controllers. The lightning and laser inspectors now open a visual color picker with a two-dimensional color field, hue slider, presets and optional hex entry.

All 93 automated tests pass, including continuous trajectories compared at every step with an unmodified Cannon world, exact authoritative result matching, and nonmodal panel interaction/focus. An additional 200 seeded preparations all landed flat in 2.58–5.78 simulation seconds (mean 4.22). Production and local-mode builds pass. Browser QA verified map-relative placement, settings, minimize/expand, continued map-tool access, and all eight flat texture maps. This browser has WebGL disabled, so hardware rendering, material appearance under 3D lighting and perceived animation smoothness still require a local GPU check. No production deployment.

## Orbital IV.1 — Three.js WebGL dice · 2 November 2026

The dice tray now requires the Three.js WebGL 2 renderer. The former software renderer has been removed. Unsupported devices show a clear graphics-support message while retaining the authoritative numeric roll in the panel and log.

cannon-es advances solid d12 bodies at a fixed 60 Hz during the animation, with gravity, spin, friction, bounce, die-to-die collisions, sleep detection and recovery for cocked or off-table dice. Rendered rails and collision rails now share exact dimensions. Game throws use a deterministic physics preparation pass to label faces before animation; the live simulation reaches the same result without recording/replaying animation frames or rerolling the rules outcome. Cosmetic test throws read the top faces from the actual settled bodies.

Adds OrbitControls (drag, pinch/scroll), accessible rotation/reset buttons and reflected environment lighting. All four finishes and distinct Hope/Fear palettes remain. Theme changes reskin the existing pose instead of starting another throw.

Validation: 88 automated tests and production/local-mode builds. New tests check the live world's final poses against the deterministic preparation pass and the shared rail/collider geometry. GPU rendering cannot be verified in the provided browser because WebGL is disabled; check it locally with graphics acceleration enabled. No production deployment or Firebase changes in this patch.

## Orbital IV — crew, accounts, scenes and 3D dice · 2 November 2026

Adds a guided host/join flow, permanent session status and copyable invitation, player roster, character submissions, one non-drone token per player, and shared drone control. Rejoining the same live room retains a browser-session seat and its assignments. The Keeper can broadcast announcements; guests cannot publish arbitrary state or control other players' tokens.

Separate Firebase email/password accounts store private character versions and preferences. Scene uploads use resumable Firebase Storage transfers and account-owned scene metadata, with cancellation and failure cleanup. The Firebase project is not configured in this checkout; follow `FIREBASE_SETUP.md` before using account/cloud features. Local-only mode keeps cloud and multiplayer disabled.

Scene selection and creation move the party and shared drones atomically while preserving resources, IDs and controllers; returning restores saved positions. Encounter enemies stay in their original scenes, including legacy tokens owned by `keeper`.

Three.js d12 dice use four procedural sci-fi finishes with distinct Hope/Fear palettes, a textured raised mat, physical collision and bounce via cannon-es, reduced motion, and a compatibility renderer for WebGL-disabled devices. The top faces match the actual game result; cosmetic test throws do not alter the game. Three.js and Firebase are loaded in separate chunks as needed.

Validation: 86 automated tests, production and local-mode builds, browser checks for scene creation, live hosting, copying invitations, and all four dice finishes. Two-client join, assignments, character submission, scene sync and leave pass over an in-memory PeerJS transport. A live second-player browser connection timed out, so real WebRTC gameplay remains unverified. The browser used for QA has WebGL disabled; compatibility rendering and CPU physics were checked, but hardware WebGL rendering needs a local GPU check. Firebase authentication, security-rule evaluation and server uploads require a configured project and remain unverified against a live backend. Windows batch launchers were not run on Windows. No production deployment.

## Orbital III — fichas reales y sesiones locales · 2 de noviembre de 2026

Las fichas anteriores omitían clase, Evasion, experiencias y equipo del creador, y `addToken` descartaba los HP, Armor y Traits recibidos. Esta versión importa JSON de Character Sheet 2.80-RC3.2, preserva el documento completo y emplea sus valores finales sin duplicar bonificaciones. Las fichas y los bloques de adversario tienen una presentación nueva, con exportación individual, revisión de recursos ausentes y actualización de personajes sin mover sus tokens.

**SESIONES** permite crear, duplicar, renombrar, abrir, guardar y transportar campañas independientes. El cambio espera al guardado de la sesión actual y solo se aplica cuando la nueva copia está escrita. Persiste también el registro, evita heredar el antiguo guardado global al abrir IDs inexistentes y limpia selección, undo y efectos temporales al cambiar de campaña.

Validación: 70 pruebas automatizadas, lectura de los cuatro JSON adjuntos (tres personajes únicos), importación y edición en navegador, exportación/reapertura y build local. Compatible con PNJ/adversarios exportados por el VTT; no se ha validado un esquema externo de enemigos porque no se aportó ninguno. No se añade Firebase ni se hace una prueba multijugador. Instrucciones en `PRUEBAS_LOCALES.md`.

## Orbital II — 2 de noviembre de 2026

Los clocks compactos estaban forzados a una fila por CSS y solo admitían arrastre al expandirse. Ahora vuelven a posicionarse libremente en el mapa con Pointer Events, captura del puntero y persistencia de coordenadas, incluidos los valores cero. Añade movimiento por teclado, límites de pantalla, cancelación segura y ordenación manual desde el panel Clocks.

La segunda pasada visual refuerza la referencia [Sci-fi User Interface Dashboard](https://www.behance.net/gallery/87887291/Sci-fi-User-Interface-Dashboard): instrumentos con anillos segmentados, vidrio oscuro, detalles cian/magenta, bordes finos y jerarquía de controles. Se han creado gráficos propios en CSS, SVG y Canvas; no se han copiado recursos del proyecto de referencia.

Las barras de tokens muestran etiquetas, cantidades, segmentos y estados de peligro; el panel seleccionado reúne HP, Armor, Stress y Hope/Effort. El agua comparte superficie animada y máscara entre rectángulos y polígonos, con cáusticas, profundidad y orillas. El agujero negro utiliza disco de acreción por capas, halo y horizonte oscuro; se corrige la eliminación prematura de los efectos puntuales y se mantiene la anomalía aunque el presupuesto de partículas esté lleno.

Incluye `INICIAR_VTT_LOCAL.bat`, `PRUEBAS_LOCALES.md` y un laboratorio independiente en `fx-lab.html`. El batch desactiva las conexiones con `VITE_LOCAL_ONLY=1`, instala dependencias cuando hace falta y permite ejecutar pruebas, compilar y abrir la aplicación o el laboratorio. No se añade Firebase ni se modifica el protocolo multijugador.

Validación: **52 pruebas pasan**, compilación de producción en modo local correcta; revisión visual de escritorio, móvil/tableta, arrastre y recarga. El batch no se ha ejecutado en Windows porque el entorno disponible es Linux. Detalles y pasos reproducibles en `PRUEBAS_LOCALES.md`.

## Descripción para GitHub / PR

Esta actualización corrige pérdidas de sincronización y de datos de campaña, limita las acciones remotas a las fichas asignadas por el Keeper y renueva la interfaz tomando como referencia el HUD oscuro con detalles cian y magenta proporcionado por Pedro.

### Interfaz

- Consola lateral reorganizada, iconos vectoriales, jerarquía tipográfica más clara y contraste moderado.
- Relojes como instrumentos circulares compactos por defecto, con sus valores reales; panel de capas plegado y barra de personaje más legible.
- Indicadores circulares de Hull, Heat y Pearls; panel de integridad de sistemas y resolución de daño naval.
- Selectores, avisos, confirmaciones y barras de desplazamiento propios. Los selectores admiten teclado y estados deshabilitados sin bloquear la página.
- Panel lateral con cierre explícito en móvil/tableta y respeto de la preferencia de movimiento reducido.

### Correcciones funcionales

- El Keeper conserva el estado autoritativo. Las acciones del jugador se envían al anfitrión; las actualizaciones completas sincronizan altas, bajas, mapas, muros, relojes y nave.
- Invitación con clave aleatoria; asignación de fichas; validación de propietario, campos, límites y mensajes repetidos. Se elimina el canal global que mezclaba salas.
- Cada réplica de jugador filtra tokens ocultos, relojes privados y documentos no compartidos, también después de deshacer. Las puertas secretas conservan su geometría como muro, sin su etiqueta privada.
- Guardado por campaña con IndexedDB, migración del formato local anterior y respaldo de compatibilidad con localStorage. Nave y colecciones vacías se conservan; errores de lectura/escritura se muestran y una lectura fallida bloquea escrituras sobre el original.
- Importación validada antes de modificar la partida; exportación con identificador y versión de esquema. Las réplicas de jugador no sobrescriben la campaña local.
- Sanitización de HTML de interfaces, registro y dossiers con DOMPurify.
- El daño se aplica una sola vez, usando HP, umbrales y Armor actuales, sin volver a tirar los dados. Se añade d4, Proficiency y Honed Edge; el crítico del Keeper maximiza el dado normal y el del jugador duplica los dados.
- Tiradas autoritativas con costes de Experience/Resolve y pagos de Path aplicados. Steady Hands y The Opening preparan bonos de un solo uso; Bear Down modifica la última tirada de acción sin cambiar caras ni duplicar pagos. Burnout aplica HP, Stress y una sola reducción del máximo de Stress.
- Fear permanece limitado a 12; todos los dobles, incluido 1+1, son Critical. Los ataques del Keeper no generan recursos de Path ni Fear.
- La nave puede superar el Heat Cap y resolver la cascada de Integrity. La disipación al final de ronda depende de si se disparó. El daño naval absorbe primero los Slots del arco y convierte el resto a Hull conforme al capítulo 17.

## Validación realizada

- `npm test`: 40 pruebas automatizadas. Incluyen guardado IndexedDB simulado de un mapa de más de 6 MB, separación entre campañas, estados vacíos, corrupción de importaciones, secretos, mensajes repetidos, propiedad de fichas, costes/pagos, críticos, daño obsoleto, Heat y controles personalizados.
- `npm run build`: compilación de producción con Vite; JavaScript repartido en paquetes de aplicación, animación, red y sanitización.
- Revisión visual en navegador a 1363 px, 820 px y 390 px. Apertura/cierre del panel móvil y tirada de acción comprobados.
- El almacenamiento alternativo se comprobó en navegador; IndexedDB se comprobó mediante `fake-indexeddb`. Una pestaña de prueba anterior quedó bloqueada por el defecto de MutationObserver ya corregido. Se añadieron límites de espera y mensajes de error para almacenamiento ocupado.
- El anfitrión obtuvo una sala real de PeerJS. La conexión del segundo cliente agotó el tiempo de espera en este entorno: **no se considera validada la conexión WebRTC de extremo a extremo**. El protocolo de mensajes y los permisos sí tienen pruebas automatizadas. Confirmar una partida entre dos navegadores/redes antes de publicar.

## Alcance de la automatización

No es un motor exhaustivo de todos los poderes del Core. Los efectos narrativos, Try Again, Cover the Angle, acciones de clase navales y efectos particulares de maniobra siguen requiriendo resolución del Keeper; el registro indica cuando el coste se ha aplicado y el efecto debe resolverse en mesa. Bear Down se integra con la última tirada de acción de esta consola; su uso sobre daño no está automatizado. Las propiedades especiales de armas navales y sus excepciones se resuelven conforme al texto canónico. Second Wind y Seize the Moment se habilitan juntos antes de abrir la sesión.

## Ejecutar y desplegar

Entorno de validación: Node 24.22.1. Instalar dependencias con `npm ci`.

```bash
npm test
npm run build
npm run dev
```

Publicar el contenido de `dist/` en la raíz del sitio estático. Para Netlify: comando de build `npm run build`, directorio de publicación `dist`. Las rutas de recursos existentes presuponen la raíz del dominio; un despliegue en subcarpeta requiere adaptar la base y las rutas de recursos. Utilizar HTTPS para la versión publicada. PeerJS usa su servicio de señalización; no se han incorporado credenciales TURN ni un servicio de identidad externo.

Antes de actualizar una campaña existente, exportar su JSON. La versión reconoce la clave local anterior `veilvtt_campaign_data_v1207`. El ZIP incluye fuentes, recursos, reglas de referencia, pruebas y `dist/`; no incluye `node_modules` ni archivos internos de QA.

## Git

Rama de esta entrega: `feat/environments-boss-states`.

Repositorio: `pedroAlTo/Gem_VeilfarersVTT`. Esta rama se prepara sobre `main` en `b1cac241e681807e929d32599e35016268687b63`. La integración en `main` y cualquier despliegue quedan fuera de esta entrega.
