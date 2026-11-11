# VeilFarers VTT v1.4.0 — Salas persistentes y edición táctica

La conexión online anterior dependía de una sesión temporal del navegador del Keeper. Ahora, con Firebase configurado, cada cuenta tiene salas propias y membresías persistentes en otras salas. La campaña se recupera desde un guardado confirmado, incluidos arcos, escenas, recursos y asignaciones.

## Comportamiento

- Invitación única, regenerable sin retirar a los miembros. Entrada directa desde la lista de salas. Expulsión/readmisión por el Keeper y asignación de tokens por cuenta, con controles compartidos para drones.
- El propietario conserva la autoridad. Los jugadores esperan dentro si cae su conexión; las acciones quedan bloqueadas al caducar la presencia (20 s), y la sesión se recupera cuando regresa. Una segunda pestaña no puede dirigir simultáneamente la misma sala.
- Transporte privado Firestore con mensajes ordenados y fragmentación; no depende de que WebRTC atraviese la red. Las confirmaciones de estado salen después del guardado. Las instantáneas siguen filtrando información privada por destinatario.
- Fragmentos de campaña inmutables reutilizados por contenido y actualizaciones que omiten secciones sin cambios. Limpieza de conexiones y guardados obsoletos al abrir como Keeper.
- Dibujo libre compartido y persistente, paleta propia, tres grosores, borrador exclusivo de trazos. Jugadores editan sus propios dibujos; Keeper edita cualquiera. Cancelación al cambiar herramienta, escena o conexión.
- Ctrl+C/V duplica el elemento seleccionado. Soporta tokens, paredes, luces, agua poligonal, anomalías, dibujos y plantillas. Identificadores independientes; tokens copiados sin asignaciones. Campos de texto, capas bloqueadas y permisos protegidos.

## Validación

- `npm test`: suite de aplicación y regresiones; `tests/map-editing.test.js` cubre dibujo, permisos, borrado y copias; `tests/room-ui.test.js` cubre el menú y sus controles por rol.
- `npm run test:rooms`: 4 pruebas de integración sobre las reglas y SDK reales del emulador. Incluye dos cuentas, dos pestañas del mismo jugador, invitación rotada, expulsión, datos privados, mensajes fuera de orden, campaña >1 MB, reutilización de fragmentos, cortes de red en ambos lados, expiración de presencia y recuperación de movimientos/arcos/escenas/dibujos.
- `npm run build` y comprobación de versiones/changelog correctos. Vite mantiene su aviso sobre paquetes JS grandes.
- La vista previa no pudo verificarse en el navegador del entorno. No se han probado OAuth real, imágenes subidas ni una partida prolongada contra producción; los pasos manuales están en PRUEBAS_LOCALES.md.

## Despliegue y migración

1. Usar únicamente el proyecto Firebase privado del **VTT**, separado del portal público.
2. Publicar `firestore.rules` y `firestore.indexes.json` mediante el comando de FIREBASE_SETUP.md. Este PR no despliega reglas ni cambia cuentas o servicios de producción.
3. Reconstruir el frontend con las variables `VITE_FIREBASE_*` del VTT. Todos los participantes deben usar v1.4.0 y una cuenta Firebase Google/correo.
4. Abrir la campaña local existente, crear la sala y asignar de nuevo los tokens a sus cuentas. Los antiguos códigos PeerJS/LAN no se convierten automáticamente en membresías.

El modo LAN y los guardados locales se mantienen. Las salas online dependen de la disponibilidad de Firebase y consumen sus cuotas. No hay sustitución automática del Keeper ni garantía sobre cambios aún no confirmados antes de un corte. Para mapas grandes se recomienda usar las URLs de imágenes alojadas que ya admite la aplicación.
