# Directrices de Desarrollo — Veilfarers VTT

- **Handover & Decisiones Consolidadas:** OBLIGATORIO revisar y cumplir estrictamente todas las decisiones documentadas en `HANDOVER.md` antes de modificar UI, flujos de sesión, roles o herramientas. NUNCA revertir ni alterar una decisión ya tomada (ej. entrada libre de jugadores sin personaje forzado, herramienta unificada dibujar/borrar, callouts estructurados sin textos ficticios, ficha compacta sin scroll forzado, etc.).
- **Git & Commits:** SIEMPRE realizar commit (y push al remoto) de cualquier cambio, mejora o corrección realizada tras finalizar la tarea.
- **Codificación:** Asegurar estrictamente la codificación UTF-8 en todos los archivos del proyecto (cero mojibake/caracteres corrompidos).
- **Verificación:** Ejecutar y validar `npm run build` antes de dar por cerrada cualquier implementación.
- **Motor del mapa en módulos:** `src/canvasEngine.js` es solo el núcleo (canvas, carga del mapa, vista y bucle de render). El resto vive en `src/canvas/` (un archivo por parte: entrada, puntero, teclado, visión, capas de escena, tokens, plantillas, superposiciones…). El código nuevo del mapa va en su módulo o en uno nuevo, nunca de vuelta en `canvasEngine.js` (`tests/canvas-modules.test.js` lo vigila).
- **Niebla, luces y visión:** si se tocan, ejecutar también `npm run test:visual` (comprueba en un navegador real lo que se ve: sala tras muros, luz, puerta, velo, visión de Keeper, borrar lo descubierto).
