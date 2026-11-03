# VeilFarers VTT — Orbital UI y correcciones de sesión

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

Rama alternativa: `fix/vtt-session-integrity-and-orbital-ui`.

Repositorio: `pedroAlTo/Gem_VeilfarersVTT`. Esta rama contiene las correcciones y el rediseño Orbital sobre la base `e9d8aa2fd32d1060a7d4eef04c5becb74578789f`. El acceso de escritura quedó verificado y Pedro autorizó subir los cambios a una rama alternativa. La integración en `master` y el despliegue quedan pendientes de la validación multijugador indicada arriba.
