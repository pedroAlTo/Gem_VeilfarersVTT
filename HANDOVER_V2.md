# HANDOVER V2 — Veilfarers VTT

> Léelo junto a `HANDOVER.md` (decisiones de diseño consolidadas, NO revertir) y `AGENTS.md`.
> Este archivo recoge el estado del trabajo de la versión 2 para poder continuar en un chat nuevo.
> Última actualización: 2026-11-14 · versión de la app 2.0.0 · rama `V2`.

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
- **Fase 0 — Estabilización** (en curso): corregir fallos antes de añadir funciones.
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
- Tests nuevos en `tests/regressions.test.js`, `tests/characters-sessions.test.js` y `tests/account.integration.js` (reglas, requiere emulador: `npm run test:account`).

## Pendiente inmediato
1. **Desplegar las reglas**: `firebase deploy --only firestore:rules`. Sin esto, los guardados en la nube siguen fallando en producción.
2. **Ejecutar `npm run test:account` y `npm run test:rooms`** en una máquina con el emulador de Firestore (no se pudo descargar en el entorno donde se escribieron).
3. Resto de Fase 0: reglas y modelo para arcos y notas personales; prueba de reconexión de jugador; dividir el bundle principal (1,3 MB).
4. Decidir el login único: propuesta = Firebase Auth en VTT y creador, migrando el vault de Netlify Identity del creador.
5. Fase 1: `characterDetails()` ya lee experiencias, armas y rasgos de clase desde `sourceCharacter.document`; faltan en la ficha afiliación y Standing, conexiones, loadout de poderes, subtraits y Recovery Anchor editable.

## Hallazgos de la auditoría (14 nov 2026)
- Creador = Netlify Identity; VTT = Firebase Auth con rama `isNetlify` que guarda solo en localStorage.
- Las entradas de personaje incluían `id`, que las reglas antiguas rechazaban: ningún personaje llegaba a Firestore.
- `saveScene` enviaba campos que las reglas antiguas rechazaban; el error sí se mostraba, pero la escena quedaba solo en local.

## Normas de trabajo
- Cada cambio: entrada en `src/releaseHistory.js` (primera entrada = versión de `package.json` y `package-lock.json`), luego `npm run release:notes` para regenerar `CHANGELOG.md`. El changelog se ve en la app y se copia al proyecto de Claude.
- Antes de cerrar: `npm test` y `npm run build`.
- UTF-8 estricto. Commit y push al terminar cada tarea.
- Actualizar este archivo al final de cada sesión de trabajo.
