# VeilFarers Orbital II — pruebas locales

## Agua: polígonos y cancelación

1. En **Water → Polígono**, dibuja un triángulo o un contorno cóncavo. Cierra con el primer vértice, doble clic, Enter o **Cerrar polígono**. Debe conservar esa silueta, sin crear un rectángulo ni añadir un vértice duplicado.
2. Durante otro trazado, pulsa **Move**, **Measure**, cambia a **Caja** o cambia de escena. El trazado pendiente debe desaparecer. Volver a Polígono empieza desde cero. Prueba también **Esc**, clic derecho y **Cancelar**; no deben borrar zonas o muros ya guardados.
3. Pulsa **Retroceso** para quitar el último vértice. Prueba el cierre con zoom alto y bajo. En Caja, arrastra desde una coordenada cero y comprueba que no salta a otra posición.
4. Con **Move**, ajusta un vértice de la zona creada. Comprueba **Undo/Redo**, guardado y recarga, y que otro jugador vea el mismo contorno al conectarse o reconectar.
5. Las ondas y los efectos de agua de los tokens deben respetar el interior del polígono. Las zonas que una versión anterior ya guardó erróneamente como rectángulos deben redibujarse: sus vértices originales no se conservaron.

## Chat de sesión y susurros

1. Ejecuta **INICIAR_VTT_RED_LOCAL.bat** y conecta dos jugadores desde perfiles de navegador distintos. En **CHAT → Mesa · todos**, envía un mensaje desde cada participante: los tres deben verlo una sola vez.
2. En **Session → Player roster → Susurrar**, el Keeper elige al primer jugador. El panel debe pasar a violeta y mostrar ese destinatario. Envía un susurro y responde desde **CHAT → Keeper · susurro** en el jugador. El segundo jugador no debe recibir ninguno de los dos mensajes, tampoco al cambiar de escena o reconectar.
3. Escribe borradores distintos en Mesa y en un susurro. Cambia de canal: cada borrador debe permanecer en su conversación. Enter envía y Mayús + Enter inserta una línea. Comprueba el contador de mensajes sin leer al abrir otra pestaña o conversación.
4. Desconecta al destinatario: el susurro queda deshabilitado y conserva su destino. Reconecta con la misma invitación en el mismo perfil/pestaña: debe recuperar su historial disponible. No hay cola de envíos automáticos ni confirmación de lectura.
5. Cierra la partida online, abre otra sesión guardada y vuelve a la original. El Keeper conserva los últimos 500 mensajes; una sesión nueva empieza vacía. Una exportación JSON del Keeper incluye los susurros. La copia del jugador no debe sustituir su campaña local.

Verificación automatizada de esta entrega: **125 pruebas y build de producción correctos**, incluidos Keeper y dos jugadores por WebSocket LAN real. No se ha podido realizar la revisión visual porque el navegador del entorno no está disponible.

## Condiciones, armas e inventario

1. Selecciona un token y abre **ESTADOS**. Activa Cegado y Oculto: los dos iconos deben aparecer junto al token y sus nombres en la barra inferior. El token debe seguir visible al jugador: la condición Hidden es independiente del control de visibilidad del Keeper. Consulta una condición y comprueba que se muestra su texto y la referencia al Corebook, Chapter 10.
2. Añade un marcador propio, quítalo y comprueba el resultado en el otro equipo. El jugador asignado puede cambiar condiciones; un jugador sin control puede consultar las reglas. Activa dos condiciones rápidamente: deben conservarse ambas. No se descuentan Stress ni HP automáticamente.
3. Abre **EQUIPO → Editar inventario**. Añade un arma y un objeto con cantidad. Guarda, vuelve a abrir y exporta el actor VTT. Al reimportar ese JSON deben mantenerse armas, cantidades y condiciones. Exportar al creador mantiene su equipo original; para conservar los cambios de inventario utiliza el formato VTT o la sesión completa.
4. Pulsa **Preparar daño**. Comprueba que se carga su expresión y se abre el panel de daño. Una expresión final importada usa Proficiency 1 y Honed Edge 0 para evitar duplicaciones. Una base aplica los valores de la ficha. La preparación no tira dados ni aplica daño.
5. Prueba `1d8+1 Phys + 1d4 Shock`: se tiran ambos grupos, se suma el modificador una vez y se comparan los umbrales una vez. Prueba `2d8 keep highest` o `d8 / d6`: debe pedirte resolver ese procedimiento, sin tirar una versión incompleta. Las resistencias y propiedades especiales siguen siendo manuales.
6. En LAN, edita el inventario desde el jugador asignado y reconecta. Keeper y jugador deben conservar las condiciones, armas y cantidades. Solo el Keeper puede aplicar el daño calculado a un objetivo. Guarda la sesión antes de cerrar el servidor.

## Tiradas secretas y biblioteca de adversarios

1. Conecta un Keeper y un jugador siguiendo el arranque LAN descrito abajo. Abre **Dice** y el registro en ambos equipos.
2. En el Keeper, activa **Tirada secreta · solo Keeper**. Puedes seleccionar un adversario o tirar sin token. El resultado y su entrada **SOLO KEEPER** deben aparecer únicamente en su pantalla. Desconecta y vuelve a conectar al jugador: esa entrada debe seguir ausente. Al desactivar la casilla, la siguiente tirada debe publicarse normalmente.
3. El daño calculado en secreto también conserva un registro privado. Aplicarlo a un personaje visible cambia sus HP/Armor para todos: el modo secreto oculta el resultado de los dados, no los recursos de las fichas compartidas. La sesión guardada y su exportación conservan el registro privado del Keeper.
4. Abre **Roster → Biblioteca de adversarios**, busca `Rogue Synthetic` y comprueba HP 12, Stress 6, Evasion 13, Ataque +3, Major 10 / Severe 18 y `1d8+1 Phys + 1d4 Shock`. Coloca dos copias: deben estar ocultas inicialmente y modificar los HP de una no debe cambiar la otra. Revela una desde el roster para mostrarla al jugador.
5. Filtra por **Rust & Steel**, tier **3**, y busca `Vanko`. Comprueba HP 25, Armor 4 y las notas originales en su ficha. Busca `Grandfather Leviathan`: debe mostrar la referencia completa y tener desactivado **Colocar en la escena**.
6. Guarda y reabre la sesión. Los adversarios, sus recursos y las tiradas privadas deben conservarse. Cambia a la vista local Player: no debe mostrar los resultados privados ni el control de tiradas secretas.

## Arranque en Windows

1. Instala Node.js 24 LTS (también se admite Node 22.12 o posterior de la rama 22).
2. Extrae **todo** el ZIP en una carpeta. No ejecutes el batch desde dentro del ZIP.
3. Para jugar por Wi-Fi o Ethernet, ejecuta `INICIAR_VTT_RED_LOCAL.bat` en el PC del Keeper. En los demás equipos abre la URL que muestra la consola, por ejemplo `http://192.168.1.42:5173/`. Todos deben estar en la misma red.
4. Desde esa dirección, el Keeper crea la partida en **Session** y comparte el código o enlace de invitación. En el segundo equipo, pulsa **PLAYER → Join game**, escribe un nombre y pega la invitación. El Keeper debe ver **Crew · 1** y el jugador **LINKED TO KEEPER**. Mantén abiertas la consola y la pestaña del Keeper. El modo LAN comunica los equipos por el propio servidor del VTT.
5. Si Windows pide acceso para Node.js, permite las conexiones en la red privada donde vas a jugar. Si hay varias direcciones, elige la del adaptador Wi-Fi o Ethernet de esa red. Puedes consultarla con `ipconfig`.

También puedes ejecutar `INICIAR_VTT_ONLINE.bat` para jugar por internet mediante PeerJS, o `INICIAR_VTT_LOCAL.bat` para elegir una de estas opciones.

| Opción | Acción |
| --- | --- |
| 1 | Abrir el VTT para la red local |
| 2 | Abrir el VTT offline en este PC |
| 3 | Ejecutar pruebas, compilar y abrir para la red local |
| 4 | Ejecutar pruebas y compilar |
| 5 | Abrir el laboratorio de efectos en este PC |
| 6 | Salir |

El modo LAN escucha en todas las interfaces con el puerto 5173. La opción 2 y el laboratorio escuchan en `127.0.0.1` y activan `VITE_LOCAL_ONLY=1`. El lanzador instala las dependencias con `npm ci` la primera vez. Pulsa Ctrl+C para detenerlo.

**Si ya tenías una campaña en este PC**, expórtala desde la dirección que utilizabas antes y después impórtala al abrir el VTT desde la IP de red. El navegador guarda por separado los datos de cada dirección y puerto.

## Prueba manual de esta iteración

- **Clocks:** arrastra un clock compacto por la cabecera o el dial. Expándelo y vuelve a moverlo. Recarga: debe conservar la posición y el progreso. Con la cabecera enfocada, las flechas mueven 10 px; Shift + flecha, 1 px. Los botones no arrastran el widget. En **Clocks → Arrange on map** puedes recolocarlos si cambias de pantalla.
- **Tokens:** selecciona un personaje; compara HP, Armor, Stress y Hope/Effort con la ficha. Las barras del mapa muestran etiqueta y cantidad. HP bajo y Stress completo tienen aviso cromático. Expande el panel para conservar los controles de edición.
- **Agua:** crea un rectángulo y un polígono cóncavo. Ambos deben mostrar reflejos, cáusticas y orilla dentro de sus límites. Modifica profundidad; con velocidad cero el agua se queda quieta. Los tiradores aparecen al seleccionar o editar la capa.
- **Agujero negro:** prueba un efecto puntual y una anomalía persistente; mueve, cambia de tamaño y elimina la anomalía. El núcleo debe permanecer oscuro y el disco visible. Los efectos puntuales ya no desaparecen por la limpieza de emisores persistentes.
- **Calidad:** compara Eco, Balanced y Ultra en el laboratorio (`/fx-lab.html`). Puedes pausar la animación. El laboratorio no lee ni guarda campañas. Respeta la preferencia de movimiento reducido.
- **Móvil/tableta:** comprueba los controles de abrir/cerrar paneles, las barras de stats y que puedas recolocar los clocks.

## Fichas JSON y sesiones guardadas (Orbital III)

1. Abre **SESIONES** y crea una sesión con **Nueva vacía**. Conserva la campaña anterior con su propia identidad. Puedes duplicar una sesión preparada, renombrarla y abrirla después.
2. En **ROSTER → IMPORTAR PERSONAJES JSON** (también disponible en SESIONES), selecciona los archivos del creador. Admite hasta 30 JSON de 2 MB cada uno.
3. Revisa el resumen y los valores actuales ausentes. En los archivos de Asha y Juno no se exportaron esos valores: la interfaz propone HP/Armor al máximo y Stress/Hope en 0, pero exige revisarlos y confirmarlos. Puedes indicar Hope 2 si corresponde a la situación de partida. Silas conserva los valores de su archivo.
4. La copia repetida de Asha se omite por defecto. Al reimportar, elige **Actualizar** para reemplazar los datos de la ficha conservando el token, su posición, retrato, visibilidad y overlays; o **Crear otra copia** si lo necesitas. Los archivos con `character_id` se emparejan por ese ID; los demás por nombre, clase, especie y senda, por lo que conviene revisar los posibles duplicados.
5. Selecciona el token y pulsa **FICHA**. Comprueba identidad, Evasion, Traits finales, recursos y umbrales. En **Rasgos y equipo**, comprueba las experiencias de la senda activa, armas, poderes y equipo. Asha conserva Stress máximo 6 y su Net Launcher muestra `n/a`.
6. Guarda una nota, cambia a otra sesión y vuelve; después recarga el navegador. La ficha, las escenas, clocks, nave, documentos y el registro (últimas 150 entradas) deben recuperarse. Se guardan los ajustes de niebla, pero no su historial de exploración al cerrar el navegador; las plantillas de medida y los efectos puntuales son transitorios.
7. **Exportar actor VTT** conserva toda la ficha local y sirve también para PNJ/adversarios. **Exportar al creador** conserva el JSON original y actualiza los datos editables y recursos; no recalcula reglas de avance ni modifica automáticamente las descripciones de poderes. Comprueba los campos derivados al abrirlo en tu creador.
8. **Exportar sesión JSON** crea una copia transportable; **Importar sesión JSON** la abre con una identidad nueva sin sobrescribir las sesiones guardadas. El autoguardado pertenece al navegador y a su dirección (mantén la misma dirección y puerto). Exporta antes de cambiar de navegador o limpiar sus datos.
9. Para enemigos, crea un **ACTOR → Adversario**, introduce HP/Stress/Armor/Evasion/umbrales y completa Attack, daño, alcance y habilidades en su ficha. Las tiradas de adversario utilizan su Attack, no un Trait de PJ. Puedes exportarlo y reimportarlo en formato VTT Actor v1.

Compatibilidad comprobada: **Veilfarers Character Sheet 2.80-RC3.2**, con los cuatro JSON aportados (tres personajes únicos), y **Veilfarers VTT Actor v1**. No se ha recibido un JSON externo de enemigo para validar otro esquema. Las habilidades, costes especiales y expresiones de daño compuestas se conservan como referencia y no se automatizan a partir de texto libre. Las experiencias importadas se pueden seleccionar en el panel de dados; las reglas existentes aplican su coste cuando se tira.

La importación valida el lote completo antes de modificar la sesión. Si falla el guardado, cambiar de sesión se bloquea y el estado actual sigue abierto. La lista de sesiones ofrece una copia de recuperación si no puede leerse el almacenamiento.

## Validación histórica de Orbital III

Se han ejecutado **70 pruebas automatizadas** y la compilación Vite, incluida la variante `VITE_LOCAL_ONLY=1`. La revisión visual se realizó a 1363, 820 y 390 px; se comprobó arrastre real, persistencia tras recarga, expansión, ordenación y apertura/cierre del panel móvil. Se revisaron el agua rectangular/poligonal y el agujero negro en el laboratorio.

El entorno de desarrollo es Linux: el `.bat` se ha revisado, pero **no se ha ejecutado en Windows**. El arranque con `npm ci` requiere acceso al registro de paquetes. No se han realizado pruebas multijugador ni se ha incorporado Firebase en esta iteración. Los efectos son una representación artística en Canvas 2D, no una simulación física.

## Comandos equivalentes

```bash
npm ci
npm test
npm run build
VITE_SESSION_TRANSPORT=lan VITE_LOCAL_ONLY=0 npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Para el modo estrictamente local usa `VITE_LOCAL_ONLY=1 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` en macOS/Linux o la opción 2 del menú en Windows. No abras `index.html` con doble clic: necesita el servidor de Vite.


## Orbital IV.2 — comprobar los dados con GPU local

1. Ejecuta `INICIAR_VTT_LOCAL.bat` y abre **DICE → Open tray**. La bandeja debe aparecer sobre la esquina superior derecha del mapa, sin bloquearlo.
2. Abre **⚙ Dice settings** y pulsa **Test throw** varias veces. Comprueba los rebotes, la desaceleración y la caída sobre una cara plana. No debe haber saltos de posición ni impulsos después de caer.
3. Prueba los cuatro acabados; Hope es cian y Fear magenta. Cambiar el acabado mantiene la posición y el resultado. Comprueba la legibilidad de 6/9 y los reflejos al rotar la cámara.
4. Haz una tirada real: los valores de Hope/Fear deben coincidir con el resultado del panel y del registro. **Test throw** no cambia la partida.
5. Minimiza y expande, cambia de herramienta del mapa, cierra y vuelve a abrir. Desactiva **Show for game rolls** para evitar aperturas automáticas; activa **Reduce motion** para ver el resultado sin animación.
6. Reduce el tamaño de la ventana y comprueba que la bandeja queda dentro del mapa. Si aparece el aviso de WebGL 2, activa la aceleración gráfica de tu navegador y vuelve a abrirla.

En el entorno de revisión pasan 93 pruebas automáticas y ambos builds. Se verificaron 200 trayectorias físicas y las ocho texturas planas; el navegador de revisión no dispone de WebGL, por lo que la apariencia final con iluminación 3D y la fluidez visual requieren esta comprobación local.

Para probar el selector de anomalías, coloca una tormenta eléctrica o un láser y pulsa **Color → Choose**. Comprueba el cambio de tono arrastrando y vuelve a abrir el selector para ver el valor guardado.

Para probar el control de jugadores en LAN, abre una partida con `INICIAR_VTT_RED_LOCAL.bat` en el PC del Keeper. Desde un segundo navegador, abre la misma dirección del VTT y únete por invitación. Asigna un personaje en **Session → Player roster** y comparte un dron. Mueve el token desde el Keeper y después desde el jugador. Al soltarlo debe ocupar la misma casilla en ambas ventanas, aunque el zoom sea distinto. En **My tokens**, comprueba movimiento, orientación, tiradas y recursos. Reasigna el personaje y comprueba que su anterior controlador pierde el acceso y conserva el dron compartido.
