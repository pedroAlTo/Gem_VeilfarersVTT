# VeilFarers VTT — Changelog

Versión actual del VTT: **v1.1.0**.
Paquete: `VeilFarers_VTT_v1.1.0.zip`.
Reglas de referencia: **Corebook 12.06** (numeración independiente).

Las entregas con nombre de archivo versionado comienzan en v1.1.0. El historial anterior conserva sus nombres Orbital; no se le asignan versiones retroactivamente.

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
