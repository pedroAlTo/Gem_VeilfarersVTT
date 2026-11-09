# VeilFarers VTT — Changelog

Versión actual del VTT: **v1.1.1**.
Paquete: `VeilFarers_VTT_v1.1.1.zip`.
Reglas de referencia: **Corebook 12.06** (numeración independiente).

Las entregas con nombre de archivo versionado comienzan en v1.1.0. El historial anterior conserva sus nombres Orbital; no se le asignan versiones retroactivamente.

## [1.1.1] — 2026-11-10

Overlay de lluvia cinemática, niebla táctica, restricciones de muros, doble toque móvil y onboarding multijugador

### Clima y Efectos Atmosféricos

- Overlay de lluvia cinemática a pantalla completa conservado y perfeccionado: paralaje multicapa, viento dinámico, salpicaduras en terreno e iluminación ambiental de tormenta.
- Ondas procedurales sobre el agua (drawRainRipples) perfectamente integradas y recortadas por el contorno del agua, incluidos polígonos cóncavos.
- Controles directos de lluvia y niebla en el panel de Capas Tácticas y en el inspector de elementos acuáticos, con niveles de llovizna, lluvia y tormenta.

### Niebla de Guerra y Visión Táctica

- Iluminación de zonas visitadas: Las fuentes de luz estáticas del mapa ubicadas en áreas previamente exploradas por los jugadores ahora iluminan su entorno a través de la niebla de guerra, evitando que las salas visitadas queden en oscuridad total.
- Bloqueo de visión en arrastre (Drag Vision Lockdown): Mientras un jugador arrastra su token, la visión y las luces se mantienen ancladas en la posición original sin sellar niebla permanente, impidiendo revelar habitaciones o pasillos inexplorados antes de soltar la ficha.

### Muros y Colisiones Físicas

- Restricción de movimiento en tiempo real: Los tokens de jugadores no pueden atravesar paredes, ventanas ni puertas cerradas, contando con deslizamiento axial fluido en X e Y al colisionar.

### Soporte Táctil para Tablets y Móviles

- Detección unificada de doble toque (double-tap): Permite abrir la hoja de personaje en tokens propios, cerrar trazados de polígonos de agua, dividir paredes, separar nodos compuestos e insertar nuevos vértices en dispositivos táctiles.

### Onboarding Multijugador en 4 Fases

- Fase 1 (URL directa): Entrada directa con ?join=CODIGO o ?room=CODIGO, forzando rol de jugador y presentando tarjeta compacta con nombre autocompletado.
- Fase 2 (Enlace mágico): Botón destacado "Copiar Enlace Mágico" en la barra superior del Keeper y en el lobby, con notificación toast visual.
- Fase 3 (Reclamo de personaje): Modal automático de entrada para reclamar un PJ de la tripulación en 1 clic o importar un archivo .json del Character Creator, centrando la cámara en el token asignado.
- Fase 4 (Tripulación en vivo): Píldoras de estado en la barra de sesión del Keeper con avatares de personajes, nombres y estado de conexión en tiempo real.

### Persistencia y Nube (Firebase)

- Soporte completo y configuración para cuentas en la nube, biblioteca privada de personajes y almacenamiento de mapas de alta resolución vía Firebase, manteniendo el juego en vivo multijugador P2P mediante PeerJS.

## [1.1.0] — 2026-11-05

Ayuda, changelog y entregas versionadas

### Añadido

- Panel AYUDA accesible para Keeper y jugadores, con versión instalada, guía rápida y atajos.
- Changelog consultable y descargable desde la herramienta, con versión y fecha de cada entrega.
- Nombre del ZIP y de la descarga del changelog con el número de versión. La versión del VTT es independiente del Corebook 12.06.

### Incluido en esta entrega

- Chat público y susurros privados Keeper–jugador, borradores por conversación e historial filtrado al reconectar.
- Polígonos de agua que conservan sus vértices, controles de cierre y cancelación, y limpieza del trazado al cambiar de herramienta.
- Tiradas secretas del Keeper, biblioteca de adversarios, condiciones visibles y armas e inventario en la ficha.
- Sesiones guardadas, importación JSON de personajes, control de tokens y drones, sincronización LAN y bandeja de dados 3D.

### Notas de uso

- Las zonas antiguas guardadas erróneamente como rectángulos deben redibujarse: sus vértices originales no se conservaron.
- Los guardados y exportaciones del Keeper incluyen información privada y susurros. No hay cola de mensajes para destinatarios desconectados.
- Las cuentas y las imágenes en la nube requieren configurar un proyecto Firebase. La partida LAN no lo necesita.

## Historial previo — entregas Orbital

- **2026-11-05 · Agua:** Corrección del guardado de polígonos, cancelación del trazado y edición con deshacer/rehacer.
- **2026-11-04 · Herramientas de partida:** Chat y susurros, condiciones e inventario, tiradas secretas y biblioteca de adversarios.
- **2026-11-03 · LAN y Orbital IV.2:** Sincronización de posiciones, lanzadores para red local, control de tokens asignados, selector de color y bandeja de dados compacta.
- **2026-11-02 · Orbital II, III, IV y IV.1:** Interfaz orbital, fichas JSON y sesiones locales, roster y drones, cambios de escena y dados Three.js con física.

El detalle técnico original y sus verificaciones se conservan en [RELEASE_ORBITAL.md](RELEASE_ORBITAL.md), incluido en el paquete.
