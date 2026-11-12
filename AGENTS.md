# Directrices de Desarrollo — Veilfarers VTT

- **Handover & Decisiones Consolidadas:** OBLIGATORIO revisar y cumplir estrictamente todas las decisiones documentadas en `HANDOVER.md` antes de modificar UI, flujos de sesión, roles o herramientas. NUNCA revertir ni alterar una decisión ya tomada (ej. entrada libre de jugadores sin personaje forzado, herramienta unificada dibujar/borrar, callouts estructurados sin textos ficticios, ficha compacta sin scroll forzado, etc.).
- **Git & Commits:** SIEMPRE realizar commit (y push al remoto) de cualquier cambio, mejora o corrección realizada tras finalizar la tarea.
- **Codificación:** Asegurar estrictamente la codificación UTF-8 en todos los archivos del proyecto (cero mojibake/caracteres corrompidos).
- **Verificación:** Ejecutar y validar `npm run build` antes de dar por cerrada cualquier implementación.
