# HANDOVER V2 — Veilfarers VTT

> Léelo junto a `HANDOVER.md` (decisiones de diseño consolidadas, NO revertir) y `AGENTS.md`.
> Este archivo recoge el estado del trabajo de la versión 2 para poder continuar en un chat nuevo.
> Última actualización: 2026-11-14 · versión de la app 2.0.2 · rama `V2`.

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

## Plan por fases
- **Fase 0 — Estabilización** (**cerrada en v2.0.2**, salvo el despliegue de reglas que hace el usuario): corregir fallos antes de añadir funciones.
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
- Emulador de Firestore: `npm run test:account` (3/3) y `npm run test:rooms` (4/4) ejecutados y en verde el 14 nov 2026. La prueba de reconexión cubre corte de red del jugador, caída y vuelta del Keeper, reentrada sin invitación, segunda pestaña y conservación de varios tokens asignados.
- Tests nuevos en `tests/regressions.test.js`, `tests/characters-sessions.test.js` y `tests/account.integration.js` (reglas, requiere emulador: `npm run test:account`).

## Pendiente inmediato
1. **Desplegar las reglas** (lo hace el usuario): `firebase deploy --only firestore:rules`. Sin esto, en producción siguen fallando los guardados en la nube de personajes y escenas, y no se crean notas ni el índice de arcos.
2. **Siguiente: Fase 1 (fichas)**: `characterDetails()` ya lee experiencias, armas y rasgos de clase desde `sourceCharacter.document`; faltan en la ficha afiliación y Standing, conexiones, loadout de poderes, subtraits y Recovery Anchor editable.
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
