# VeilFarers VTT — Orbital UI y correcciones de sesión

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
