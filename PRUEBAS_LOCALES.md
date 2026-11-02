# VeilFarers Orbital II — pruebas locales

## Arranque en Windows

1. Instala Node.js 24 LTS (también se admite Node 22.12 o posterior de la rama 22).
2. Extrae **todo** el ZIP en una carpeta. No ejecutes el batch desde dentro del ZIP.
3. Haz doble clic en `INICIAR_VTT_LOCAL.bat`, junto a `package.json`.
4. Selecciona **1** para ejecutar las pruebas, compilar y abrir el VTT.

El lanzador instala las dependencias bloqueadas con `npm ci` la primera vez y cuando cambie el lockfile o la versión de Node. Ese paso necesita internet. Después reutiliza la instalación. No instala Node automáticamente ni requiere permisos de administrador.

| Opción | Acción |
| --- | --- |
| 1 | Pruebas + compilación + abrir VTT |
| 2 | Abrir VTT directamente |
| 3 | Pruebas + compilación, sin servidor |
| 4 | Laboratorio de agua y agujero negro |
| 5 | Salir |

Dirección del VTT: `http://127.0.0.1:5173/`. Conserva la ventana del batch abierta; `Ctrl+C` detiene el servidor. Si el puerto está ocupado, cierra la instancia anterior. El puerto es fijo para conservar el mismo origen de almacenamiento entre sesiones.

El batch establece `VITE_LOCAL_ONLY=1`: desactiva crear/unirse a sesiones y la incorporación automática por invitación. No utiliza Firebase ni pide credenciales. La aplicación guarda la campaña en este navegador. Los recursos remotos que hayas añadido a tu campaña pueden necesitar internet.

Antes de probar con una partida importante, expórtala desde **Archive**. `localhost`, `127.0.0.1`, distintos puertos y distintos navegadores tienen almacenes separados: importa el JSON si quieres trasladar una campaña. El ZIP no contiene tus datos de partida del navegador.

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
8. **Exportar sesión JSON** crea una copia transportable; **Importar sesión JSON** la abre con una identidad nueva sin sobrescribir las sesiones guardadas. El autoguardado pertenece al navegador y a su dirección (mantén `http://127.0.0.1:5173` con el batch). Exporta antes de cambiar de navegador o limpiar sus datos.
9. Para enemigos, crea un **ACTOR → Adversario**, introduce HP/Stress/Armor/Evasion/umbrales y completa Attack, daño, alcance y habilidades en su ficha. Las tiradas de adversario utilizan su Attack, no un Trait de PJ. Puedes exportarlo y reimportarlo en formato VTT Actor v1.

Compatibilidad comprobada: **Veilfarers Character Sheet 2.80-RC3.2**, con los cuatro JSON aportados (tres personajes únicos), y **Veilfarers VTT Actor v1**. No se ha recibido un JSON externo de enemigo para validar otro esquema. Las habilidades, costes especiales y expresiones de daño compuestas se conservan como referencia y no se automatizan a partir de texto libre. Las experiencias importadas se pueden seleccionar en el panel de dados; las reglas existentes aplican su coste cuando se tira.

La importación valida el lote completo antes de modificar la sesión. Si falla el guardado, cambiar de sesión se bloquea y el estado actual sigue abierto. La lista de sesiones ofrece una copia de recuperación si no puede leerse el almacenamiento.

## Validación y límites

Se han ejecutado **70 pruebas automatizadas** y la compilación Vite, incluida la variante `VITE_LOCAL_ONLY=1`. La revisión visual se realizó a 1363, 820 y 390 px; se comprobó arrastre real, persistencia tras recarga, expansión, ordenación y apertura/cierre del panel móvil. Se revisaron el agua rectangular/poligonal y el agujero negro en el laboratorio.

El entorno de desarrollo es Linux: el `.bat` se ha revisado, pero **no se ha ejecutado en Windows**. El arranque con `npm ci` requiere acceso al registro de paquetes. No se han realizado pruebas multijugador ni se ha incorporado Firebase en esta iteración. Los efectos son una representación artística en Canvas 2D, no una simulación física.

## Comandos equivalentes

```bash
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Para el modo estrictamente local, establece `VITE_LOCAL_ONLY=1` antes de iniciar Vite o compilar; el batch lo hace por ti. No abras `index.html` con doble clic: necesita el servidor de Vite.
