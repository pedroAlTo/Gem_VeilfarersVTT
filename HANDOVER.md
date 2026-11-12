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
- **Decisión:** El callout flotante dorado que aparece tras lanzar dados 3D debe mostrar única y exclusivamente datos verídicos y estructurados de la tirada, manteniendo estrictamente el formato visual elegante original (marco dorado translúcido con desenfoque).
- **Jerarquía y diseño visual consolidado (Cero encabezados redundantes):**
  1. **Línea superior (Kicker dorado `11.5px` uppercase):** Quién ha hecho la tirada (Nombre del jugador, ej. `KEEPER`, `PEDRO`).
  2. **Identidad del actuante (`13.5px` bold):** Nombre del personaje o adversario (+ habilidad si aplica, ej. `Capt. Jonathan Harker · Finesse` u `Operativo`). Si la habilidad es una notación de dado (ej. `1d10`), se mueve al pie técnico.
  3. **Tipo de resultado bien visible (`17px` bold uppercase destacado con resplandor):** Estado de la tirada (*FAILURE WITH FEAR*, *SUCCESS WITH HOPE*, *CRITICAL SUCCESS*, *WITH FEAR*, *WITH HOPE*, etc.) coloreado según Hope (`#fde68a`), Fear (`#d8b4fe`) o Crítico (`#ffffff` con halo dorado).
  4. **Número enorme que ha salido (`38px` tabular monospace):** Total numérico destacado junto al desglose de Dualidad (`HOPE 3 < FEAR 8` con números grandes).
  5. **Pie técnico (`9px` monospace `#64748b`):** Más pequeño, el tipo de dado y modificadores reales aplicados (ej. `1d10 · Mod: Ninguno` o `2d12 + 2 · Hope [3] + Fear [8]`).
- **Prohibiciones estrictas:**
  - **CERO encabezados de formulario repetitivos:** NUNCA mostrar etiquetas como `"NOMBRE DEL JUGADOR:"`, `"NOMBRE DEL TOKEN:"`, `"HABILIDAD:"`, `"RESULTADO:"`, `"MODIFICADORES APLICADOS:"`. La información debe fluir de forma directa y elegante.
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

## 9. Múltiples Tokens por Jugador y Control Compartido de Drones
- **Decisión:** Un jugador **PUEDE tener varios tokens asignados simultáneamente** (por ejemplo, controlar su personaje principal y el dron de exploración, o controlar dos personajes/aliados).
- **Control compartido de drones:**
  - **EL DRON PUEDE SER CONTROLADO POR MÁS DE UN JUGADOR A LA VEZ**: los drones son recursos tácticos compartidos.
  - Al asignar un dron a un jugador, **se añade dicho jugador a la lista de controladores del dron (`controllerIds`) sin desasignar ni expulsar a los otros jugadores** que ya lo controlan.
- **Preservación de tokens asignados:**
  - **NUNCA desasignar los tokens previos de un jugador cuando el Keeper le asigne otro token adicional**.
  - Si el Keeper asigna un segundo o tercer token a un jugador, el jugador mantiene el control de todos ellos.
  - La interfaz de selección y controles de token permite al jugador conmutar libremente entre sus tokens asignados.

---

## 10. Resolución de Daño en Ataques a Tokens Objetivos
- **Decisión:** Cuando un jugador ejecuta un ataque contra otro token (un enemigo, adversario o cualquier objetivo en la escena) y resuelve el daño, **el daño debe aplicarse limpiamente al objetivo sin bloqueos de permisos**.
- **Regla de red y permisos:**
  - Para aplicar daño a un objetivo, la red **NO exige que el jugador posea el token objetivo** (los enemigos y PNJs pertenecen al Keeper).
  - La validación de permisos en red verifica que el jugador **controle el token ATACANTE** (`owns(attackerId)`).
  - El mensaje de daño táctico `APPLY_DAMAGE` se transmite al Keeper (autoridad de la sesión), quien aplica la reducción de HP y escudos al objetivo y sincroniza la escena con todos los clientes.
- **Prohibiciones estrictas:**
  - **NUNCA emitir el error `"Este token no está asignado a ti"`** al resolver daño contra un objetivo atacado desde un token propio.

---

## 11. Regla Operativa de Trabajo (Obligatoria para IA y Desarrolladores)
1. **Revisar HANDOVER.md** al inicio de cada tarea o prompt antes de proponer cambios.
2. **Respetar estrictamente todos los puntos anteriores.** Si una petición del usuario entra en aparente conflicto, aclarar o conciliar sin destruir estas bases.
3. **Validación:** Ejecutar siempre `npm run build` y la suite de tests (`npm test`) antes de dar por cerrada cualquier tarea.
4. **Git:** Realizar commit descriptivo y push al repositorio remoto al finalizar.
