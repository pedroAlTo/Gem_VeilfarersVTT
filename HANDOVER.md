# HANDOVER & REGISTRO DE DECISIONES DE DISEÑO — VEILFARERS VTT

> **IMPORTANTE PARA TODOS LOS AGENTES Y DESARROLLADORES:**  
> Este documento contiene las decisiones de diseño arquitectónicas y de experiencia de usuario (UX) tomadas y consolidadas para el proyecto Veilfarers VTT.  
> **REGLA ABSOLUTA:** Antes de realizar cualquier modificación, consulta este documento. **ESTÁ ESTRICTAMENTE PROHIBIDO revertir, contradecir o ignorar cualquiera de estas decisiones.**

---

## 1. Entrada Libre de Jugadores (Sin selección obligatoria de personaje)
- **Decisión:** Un jugador **PUEDE entrar a cualquier sala o partida táctica sin tener que elegir, reclamar o crear un personaje previamente**.
- **Comportamiento en la mesa:**
  - El jugador entra directamente a la mesa táctica. Si no tiene un personaje vinculado, entra en modo espectador/jugador sin token asignado.
  - **El Keeper puede asignarle cualquier token** de la escena o la tripulación directamente desde el Roster, el Keeper HUD o el menú de Salas.
  - En cuanto el Keeper le asigna un token, el cliente del jugador recibe la asignación en tiempo real, se centra la cámara en su token y se despliega su HUD de jugador.
- **Prohibiciones estrictas:**
  - **CERO bloqueos:** NUNCA bloquear el botón de entrada a la mesa con `alert()` o validaciones que exijan tener un personaje seleccionado (`lobbyGateway.js`, `roomUI.js`, `sessionLobby.js`).
  - **CERO popups intrusivos:** NUNCA desplegar de forma automática modales de selección o reclamación de personaje (`openClaimCharacterModal()`) al conectarse a una sesión (`networkManager.js`). Reclamar o importar es una acción voluntaria accesible desde los botones del menú, nunca una interrupción forzada.

---

## 2. Herramienta Unificada de Dibujar y Borrar
- **Decisión:** Las herramientas de **Dibujo Libre** y **Borrador de Trazos** van **UNIFICADAS en un único botón** en la barra de herramientas lateral izquierda (`#btn_tool_draw`).
- **Comportamiento:**
  - Al pulsar el botón de Dibujo, se despliega el flyout de opciones donde el usuario puede alternar entre los modos:  
    `[ ✏️ Dibujar ]  [ 🧹 Borrar ]`
  - Incluye selector de color (`vf-color-picker`), grosores (Fino, Medio, Grueso) y el interruptor de modo.
- **Prohibiciones estrictas:**
  - **NUNCA separar Dibujar y Borrar en dos botones distintos** en la barra lateral.

---

## 3. Callout Dorado Estructurado de Tiradas de Dados 3D
- **Decisión:** El callout flotante dorado que aparece tras lanzar dados 3D debe mostrar única y exclusivamente datos verídicos y estructurados de la tirada.
- **Campos obligatorios:**
  1. **Nombre del jugador** (ej. *Capt. Jonathan Harker* o nombre de usuario).
  2. **Nombre del token** (si aplica).
  3. **Habilidad en uso** (si no hay habilidad específica asociada a la tirada, este campo no se muestra).
  4. **Resultado de la tirada** (Total con desglose de Hope / Fear y estado de Dualidad: *Critical Success*, *Success with Hope*, *Failure with Fear*, etc.).
  5. **Modificadores aplicados** (desglose numérico o lista de bonificadores/penalizadores reales).
- **Prohibiciones estrictas:**
  - **NUNCA mostrar el rótulo ficticio `"TACTICAL SOLUTION"`** ni telemetría inventada (`"VECTOR TELEMETRY LOCKED"`, `Q-FLUX`, etc.).
  - **NUNCA mostrar badges residuales flotantes de fear** (`#vf-shared-fear-badge`).

---

## 4. Ficha de Personaje Ultra-Condensada (Dossier)
- **Decisión:** El modal de expediente táctico (Dossier) debe ser extremadamente compacto para **evitar que el usuario tenga que hacer scroll vertical para guardar cambios**.
- **Ajustes ergonómicos consolidados:**
  - Reducción de márgenes y espaciados internos (padding de 6px a 10px).
  - Encabezado compacto (avatar de 44px, tipografía ajustada).
  - Campos e inputs optimizados con altura de 28px.
  - Textarea de notas limitado a 2 filas iniciales.
  - **Pie de ficha sticky:** El pie del modal (`.dossier-actions`) está fijado permanentemente en la parte inferior (`position: sticky; bottom: 0; background: var(--bg-surface); z-index: 10;`) con el botón **`Guardar ficha`** siempre a la vista.
  - **Acceso rápido:** Botón directo `💾 Guardar ficha` integrado en la barra superior de pestañas del dossier.

---

## 5. Formato Breve de Códigos de Invitación de Salas
- **Decisión:** Los códigos de sala deben ser cortos, memorables y fáciles de compartir por chat o voz.
- **Formato obligatorio:**
  - Las primeras 3 letras del nombre de la sala (en mayúsculas, alfanumérico) + guion + 5 caracteres aleatorios.  
    *Ejemplo:* Sala `"Nave 1"` → `NAV-33F44`.
- **Compatibilidad y seguridad:**
  - Los códigos heredados largos (`VF-[A-F0-9]{32}`) deben ser aceptados sin provocar errores.
  - **NUNCA ejecutar auto-rotaciones forzadas en segundo plano** contra Firestore si las reglas remotas no han sido desplegadas por el usuario en Firebase Console.

---

## 6. Borrado Permanente de Salas por el Keeper
- **Decisión:** El Keeper propietario de una sala tiene potestad total para eliminarla definitivamente.
- **Comportamiento:**
  - Botón **`Eliminar`** (estilo peligro) en cada tarjeta de sala en "Salas que dirijo" y botón **`Eliminar sala`** dentro de la sala activa.
  - Confirmación previa mediante modal (`confirmAction`).
  - **Purgado integral en Firestore:** borra el documento `rooms/{id}`, subcolecciones (`members`, `wires`, `saves`, `chunks`), invitación (`roomInvites/{code}`) y vínculo de usuario (`users/{uid}/rooms/{id}`).
  - **Expulsión reactiva:** Los jugadores conectados son desconectados inmediatamente mediante listener de Firestore (`!snapshot.exists()`), limpiando su sesión local y mostrando la notificación *"La sala ha sido eliminada por el Keeper."*.

---

## 7. Flujo de Cierre de Sesión (Logout) al Portal Táctico
- **Decisión:** Al cerrar sesión (logout) o desconectar la cuenta, el usuario debe ser redirigido inmediatamente a la pantalla del Portal Táctico / Login.
- **Comportamiento:**
  - Se descarga la sesión remota activa.
  - Se ocultan los elementos del VTT y se muestra el portal táctico limpio (`vf-auth-screen`).

---

## 8. Precalentamiento de Dados 3D en Login
- **Decisión:** El motor 3D de dados (`VeilfarersDiceEngine`), física WASM (Cannon/Ammo), geometrías, texturas y efectos de audio deben precargarse en segundo plano mientras el usuario interactúa con la pantalla de login.
- **Propósito:** Garantizar que al entrar a la mesa el primer lanzamiento de dados sea 100% fluido y sin micro-tirones ni retrasos de carga de assets.

---

## 9. Regla Operativa de Trabajo (Obligatoria para IA y Desarrolladores)
1. **Revisar HANDOVER.md** al inicio de cada tarea o prompt antes de proponer cambios.
2. **Respetar estrictamente los 8 puntos anteriores.** Si una petición del usuario entra en aparente conflicto, aclarar o conciliar sin destruir estas bases.
3. **Validación:** Ejecutar siempre `npm run build` y la suite de tests (`npm test`) antes de dar por cerrada cualquier tarea.
4. **Git:** Realizar commit descriptivo y push al repositorio remoto al finalizar.
