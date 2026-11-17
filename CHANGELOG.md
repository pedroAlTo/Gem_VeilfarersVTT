# VeilFarers VTT — Changelog

Versión actual del VTT: **v2.15.0**.
Paquete: `VeilFarers_VTT_v2.15.0.zip`.
Reglas de referencia: **Corebook 12.06** (numeración independiente).

Las entregas con nombre de archivo versionado comienzan en v1.1.0. El historial anterior conserva sus nombres Orbital; no se le asignan versiones retroactivamente.

## [2.15.0] — 2026-11-17

V2 · Competencia tecnológica y catálogo de Poderes

### Equipo según la competencia

- El buscador de equipo de la ficha y el catálogo completo muestran primero solo lo que el personaje puede usar según su clase, su nivel y su Technology Access (tablas de cada clase del Corebook): familias de armas, peso de armadura, tipo de aumento y Tech Tier. La casilla «Solo lo que puedo usar» viene marcada; al desmarcarla se ve todo.
- Encima del buscador aparece el entrenamiento del personaje, por ejemplo «Mystic · nivel 1 · Common (TT1): Light Armor, Melee/Pistols, Neural/Physical Augments». Military (TT2) llega a nivel 2 y Experimental (TT3) a nivel 5; el avance «+1 Technology Access Level» lo sube.
- Lo que queda fuera de la competencia lleva la etiqueta «Fuera de tu competencia · Desventaja», también en el inventario.

### Desventaja fuera de la competencia

- Usar algo fuera de la competencia tira siempre con Desventaja: el arma del ataque, el dron que se opera (su Grado por encima del acceso del operador) y la armadura o los aumentos que lleva puestos, que cuentan en cualquier tirada. El detalle del ataque o el resultado de la tirada dicen por qué.
- Failure with Fear al atacar: se recomienda que la consecuencia sea del arma (se encasquilla, se queda sin munición o se cae) o, con un dron, tirar la Drone Complication. En otras tiradas se sugiere que la consecuencia sea del equipo que intervino.
- Los PNJ y adversarios no tienen estas restricciones.

### Catálogo de Poderes

- El cajón del mazo muestra, además del Loadout y el Vault, todos los Poderes del juego, con filtro por Dominio. «Solo los de mi acceso» viene marcado: los Poderes de los Dominios del personaje hasta su nivel que aún no conoce. Desmarcado, se ven los 147; los que no están a su alcance aparecen atenuados.
- Un Poder a su alcance se puede leer y añadir al Vault; la mesa del Keeper lo valida.

### Corrección

- Un jugador conectado a una sala online no podía jugar cartas ni hacer Recall: la mesa del Keeper rechazaba esas acciones («This character is not assigned to you»). Ya se resuelven.

## [2.14.4] — 2026-11-17

V2 · Armas a distancia largas en Melee con Desventaja

### Reglas

- Un arma a distancia larga (rifle, carabina, ametralladora, lanzacohetes…) usada contra un objetivo en Melee ataca con Desventaja. El aviso del ataque lo explica.
- Las armas cortas no tienen esa penalización: pistolas, blásters de mano, revólveres y similares (Corebook: «point-blank pistol range»). Se reconocen por el nombre; un arma de la ficha puede marcarse a mano como corta o no.
- El Stress por ronda de Bleeding y el límite de una Fear Ability por criatura y ciclo de Spotlight se siguen aplicando a mano en la mesa, por decisión de diseño.

## [2.14.3] — 2026-11-17

V2 · Tiradas de adversario con d20 y Bear Down sobre el daño

### Reglas

- Cualquier tirada de un adversario en el panel de dados es ahora 1d20 + su modificador contra la DC, como su ataque (decisión 6: el texto del Corebook que hace tirar Dualidad al Keeper es una errata). Ventaja suma 1d6, Desventaja lo resta; un 20 natural es éxito crítico. Sin pago de senda ni Fear.
- El panel muestra el d20 en la primera casilla (etiqueta D20) y el registro escribe la cuenta completa: «d20 [12] + 2 = 14 vs DC 15».
- Bear Down también vale tras una tirada de daño (Corebook, cap. 7: «después de cualquier tirada de Dualidad, ataque, reacción o daño»). Si lo último que ha tirado el personaje es un daño aún sin aplicar, la carta suma sus dados de Resolve a ese daño con los mismos dados ya tirados, y se recalcula la severidad. Si el ataque falló, Bear Down sigue sumando a la tirada de ataque, como antes.

## [2.14.2] — 2026-11-17

V2 · Idioma revisado pantalla a pantalla, móvil y primeros pasos en la ayuda

### Idioma

- Revisión automática de todas las pantallas en los dos idiomas: unos 350 textos que se quedaban en el otro idioma ya cambian con el selector.
- Cubre lobby, ficha (estadísticas, rasgos y vínculos), ajustes del token, crear escena, entorno, boss, arcos, consola de dron, biblioteca de adversarios, importación de fichas, nave, herramientas de dibujo y agua, y la tarjeta de resultado de las tiradas («¡La acción sale bien, pero con un coste!…»).
- Las frases partidas por negritas (consola de dron, entorno) se reescribieron para poder traducirse enteras. Las bandas de alcance (Close, Far…) no se traducen dentro de los avisos de ataque.
- No se traducen, como antes: nombres, chat, registro, contenido de los libros (ancestries, adversarios, módulos, compendio de reglas), los datos de la campaña de ejemplo y los términos de reglas del Corebook.

### Móvil y tablet

- La mesa sigue pensada para ordenador o tablet. En un teléfono aparece una vez un aviso que lo explica y dice qué funciona bien ahí: seguir la partida, la ficha, los dados y el chat.
- Teléfono: la guía de primeros pasos empieza minimizada, se ocultan el panel de capas y los relojes sobre el mapa (siguen en la pestaña RELOJES) y el aviso «Sin cartas» es compacto.
- Tablet: el panel de capas pasa arriba a la derecha del mapa y ya no tapa la barra del personaje; el título de la cabecera deja de pisarse con la cuenta.

### Primeros pasos

- En AYUDA, la sección se llama ahora «Primeros pasos», con los botones «Volver a ver los primeros pasos» y «Empezar desde cero».
- Al cerrar la guía, un aviso recuerda que se puede volver a ver desde AYUDA.

## [2.14.1] — 2026-11-17

V2 · Carga inicial más ligera

### Rendimiento

- La pantalla de inicio aparece antes: con una conexión de 10 Mbit/s, en 1,7 s en lugar de 3,3 s; antes de verla se descargan 0,9 MB en lugar de 2,6 MB.
- El motor de dados 3D (física, WASM y texturas, varios MB) se precarga cuando la página ya ha cargado y el navegador está libre, en vez de competir con la primera pantalla. Una tirada antes de eso inicia el motor en el momento.
- Los datos de reglas de las cartas (unos 375 KB) se descargan solo cuando hay una mano de jugador que mostrar; la mesa del Keeper los carga al resolver la carta de un jugador conectado.
- Retratos de token a 512 px (se ven como mucho a unos 300 px): de 24,7 MB a 6,2 MB en total, unos 60 KB cada uno. Mapas de ejemplo de 1,9 MB a 0,5 MB. Mismas rutas y sin diferencia visible.

## [2.14.0] — 2026-11-17

V2 · Guía de primer uso para jugadores y Keeper

### Guía de primer uso

- Al llegar a la mesa aparece, en la esquina superior derecha del mapa, una lista corta de primeros pasos según tu papel.
- Jugador: ten tu personaje, abre tu ficha, mueve tu token, haz una tirada, usa una carta y escribe a la mesa.
- Keeper: crea tu sala (solo con salas online), prepara una escena, coloca un adversario, asigna un personaje, gasta Fear y haz una tirada.
- Cada paso se marca solo cuando lo haces de verdad en la mesa; no hay botón «Siguiente». Lo que ya existía al empezar (la campaña de ejemplo) no cuenta.
- «Muéstramelo» resalta el botón o la zona de la que habla el paso. Un paso se puede saltar; si después lo haces, cuenta como hecho.
- La guía se minimiza o se cierra, y el progreso se recuerda en este navegador para cada papel. Se vuelve a abrir, o se empieza de nuevo, desde AYUDA → Guía de primer uso.
- Funciona en español y en inglés, y en pantallas estrechas se coloca arriba a lo ancho.

## [2.13.0] — 2026-11-17

V2 · Cuenta: tu personaje y tu última partida en cada sala

### Cuenta

- En Partidas y notas, cada sala muestra el personaje que usas en ella (nombre, nivel, clase y senda) y la fecha de tu última partida. Si diriges la sala, solo la fecha.
- Las salas jugadas más recientemente aparecen antes (después de la partida en curso y de las que diriges).
- La mesa lo anota sola mientras juegas: al entrar en la sala, cuando cambia tu personaje (por ejemplo, al subir de nivel o cuando el Keeper te asigna otro) y cada 15 minutos de juego.

### Firebase

- Nueva colección privada users/{uid}/games/{roomId} con sus reglas en firestore.rules: hay que publicar las reglas de nuevo. Sin publicarlas, el registro se guarda solo en este navegador, sin avisos.

## [2.12.0] — 2026-11-17

V2 · Cuenta: partidas y notas personales por partida

### Cuenta

- La ventana de cuenta (esquina superior derecha, con sesión iniciada) se ordena en tres pestañas: Partidas y notas, Personajes y Preferencias.
- Partidas y notas lista las salas que diriges y en las que juegas, con tu papel (Keeper o Jugador) y su invitación. La partida en curso aparece primero y marcada. «Abrir sala» entra en otra sin pasar por el lobby.
- Cada partida guarda tus notas personales: crear, editar y eliminar, con título y texto. Son privadas: ni el Keeper ni los demás jugadores pueden leerlas.
- Las notas de una sala que ya no existe no se pierden: aparecen como «Sala no disponible».
- En SESIONES, dentro de una sala, el botón «Mis notas» abre directamente las notas de esa partida.
- La ventana de cuenta con sesión iniciada, que estaba solo en inglés, sigue ahora el selector de idioma.

## [2.11.1] — 2026-11-17

V2 · Ayuda y avisos también en inglés

### Ayuda

- La ayuda (botón ?) está escrita en español y en inglés y se muestra en el idioma elegido; si se cambia el idioma con la ayuda abierta, se redibuja sin perder la pestaña.
- Nueva sección «Idioma e inicio» y «Cartas y Loadout» en la guía rápida.
- Las notas de cada versión del Changelog se conservan en el idioma en que se escribieron (español); en inglés se indica.

### Avisos y errores

- Los avisos emergentes y los mensajes de error (unos 330) se muestran en el idioma elegido, también los que llevan nombres o cifras («No hay Fear suficiente: hacen falta 2 y quedan 0»).
- Los avisos antiguos que mezclaban los dos idiomas se leen ahora en uno solo.
- Un mensaje que llega de fuera (por ejemplo, un error de Firebase o del navegador) se muestra tal cual.

## [2.11.0] — 2026-11-17

V2 · Interfaz en un solo idioma (español / inglés) y botón de inicio

### Idioma

- La interfaz, que mezclaba español e inglés, se muestra entera en un idioma. Por defecto, español.
- Selector ES / EN en la barra inferior de la mesa y en la esquina del lobby. El idioma elegido se recuerda en este navegador.
- Se traducen botones, pestañas, etiquetas, avisos, títulos de ayuda emergente y textos con números (contadores, pasos, «TIRAR FINESSE (+1)»), también los que aparecen después de cargar.
- Los términos de reglas del Corebook (Hope, Fear, Stress, HP, Evasion, Armor Slots, Proficiency, Effort, Resolve y los Traits) se mantienen en inglés en los dos idiomas, como en los libros.
- No se traducen el chat, el registro, los nombres ni el texto de los libros (cartas, Poderes, habilidades de adversarios, módulos de dron).

### Inicio

- Botón ⌂ en la cabecera, y también el logo VEILFARERS, para volver a la pantalla de inicio (salas y personajes) sin cerrar la mesa.

### Cabecera

- La cabecera ya no se sale de la pantalla a 1440 px: el nombre de la campaña y la invitación se acortan para dejar visibles el logo, el selector de escena y todos los botones.

## [2.10.0] — 2026-11-17

V2 · Mano del Keeper (Fear y adversarios), Bear Down y Effort como cartas

### Mano del Keeper

- En vista de Keeper la zona inferior muestra una mano con las cuatro jugadas de Fear del Corebook: Spotlight Enemies (1), Declare a Complication (1), Interrupt an Action (2) y Ancestry Complication (1, tira 1d6).
- Con un adversario seleccionado se añaden sus habilidades impresas como cartas, con su tipo (Action, Reaction, Passive) y su coste en Fear. Se leen del texto del libro: tabla del Keeper's Companion, líneas de Alien Species y «Special» de Rust & Steel (158 habilidades en 42 adversarios).
- Jugar una carta gasta el Fear, la anuncia a la mesa (aviso y chat) y marca el punto del mapa si se suelta sobre él. Con «Tirada secreta» activada solo queda en el registro del Keeper.
- Spotlight Enemies con un adversario seleccionado le da el Spotlight y cobra 1 Fear una sola vez.
- Las pasivas se consultan, no se juegan. El aviso de cartas usadas por los jugadores sube por encima de la mano.

### Sleeping: Bear Down y Effort

- Bear Down y los Effort comunes (Steady Hands, Read the Room, Push Through, The Opening, Try Again, Brace, Cover the Angle) están en la mano de todo Sleeping. Second Wind y Seize the Moment, solo si el Keeper activa el módulo opcional.
- Bear Down gasta los dados de Resolve que elijas y suma todos (antes, uno por pulsación), como dice el Corebook. Nunca cambia qué dado es mayor ni crea un Crítico.
- Si se usa Bear Down tras un ataque fallido y el nuevo total alcanza la Evasion, el ataque pasa a impactar y se calcula el daño.
- Un Effort común sin Effort disponible se puede usar con Burnout desde la carta: pide confirmación y explica el coste (1 HP, 1 Stress y −1 al Stress máximo hasta la Recovery).

### Corregido

- Con el Keeper en vista de jugador, las tiradas, Effort, Bear Down, condiciones y cartas de los jugadores no se aplicaban en su mesa. Ahora sí, y se guardan (la corrección de la v2.9.7 pagaba la carta pero ese cambio no se guardaba en el navegador hasta el siguiente).

## [2.9.7] — 2026-11-17

V2 · El Keeper ve la mano de cada personaje

### Mano de cartas

- El Keeper, al pasar a modo jugador, ve la mano de cualquier personaje que seleccione, no solo la del personaje reclamado, y puede jugar sus cartas.
- Los personajes antiguos sin clase ni ancestry en la ficha las toman del texto de su papel: «Ace Pilot» da las cartas de Pilot y «Heavy Engineer // Sleeping Synthetic», las de Engineer y Synthetic.
- Si un personaje no tiene nada de lo que salen las cartas, la mano lo dice y ofrece abrir la ficha para completarla, en lugar de no mostrar nada.
- Corregido: si el Keeper estaba en vista de jugador cuando un jugador jugaba una carta o hacía un Recall, el coste no se aplicaba.

## [2.9.6] — 2026-11-17

V2 · Cartas sin parpadeo

### Mano de cartas

- Las cartas ya no parpadean al pasar el ratón por su borde. La carta se levantaba y dejaba de estar bajo el puntero, bajaba y volvía a estarlo, sin parar.
- Ahora la zona que detecta el ratón no se mueve: solo sube la cara visible de la carta, y mientras está levantada se puede subir el ratón hasta ella sin que baje.
- Si el ratón sale a mitad de la animación, la carta vuelve suavemente desde donde esté, sin saltos.
- La carta levantada se ve recta, sin el giro del abanico.

### Keeper

- Las cartas de la esquina inferior derecha ya no repiten su animación de entrada cada vez que llega o caduca otra.

## [2.9.5] — 2026-11-17

V2 · Mazo con cajón, Gifts de Ancestry activos y aviso al Keeper

### Mazo

- Después de las cartas de un Awakened hay un pequeño mazo con el número de Poderes del Vault. Al pulsarlo se abre un cajón sobre la mano.
- El cajón muestra el Loadout arriba y el Vault abajo. Se elige el momento (Long Rest, Short Rest o escena activa), la carta del Vault que entra y, si el Loadout está lleno, la que sale.
- El coste se ve antes de confirmar y no se paga nada hasta pulsar Recall. El cajón sigue abierto para hacer más cambios.

### Cartas de Ancestry

- Cada Gift que se usa (tiene un momento, un coste o un límite) es su propia carta, con su coste y su límite de usos. Los Gifts pasivos ya no aparecen en la mano: siguen en la ficha.
- Los «path resources» de un Gift se cobran en Hope a un Awakened y en Effort a un Sleeping. Lo que el Gift devuelve no se cobra.
- Una Ancestry con solo Gifts pasivos no añade carta.

### Keeper

- Cuando un jugador usa una carta, el Keeper la ve en pequeño en la esquina inferior derecha del mapa, con el nombre del personaje.
- Al pulsarla se abre en grande con quién la usó, lo que pagó y su efecto. Se guardan las cuatro últimas durante minuto y medio.
- La línea del chat dice quién la usó (jugador y personaje), qué carta es, su coste y su efecto completo.

## [2.9.4] — 2026-11-17

V2 · Rendimiento: mapa más ligero y carga más rápida

### Mapa

- La niebla de guerra ya no se recalcula en cada fotograma: solo cuando se mueve un personaje, cambia un muro o una puerta, cambia una luz o cambia lo explorado.
- Las luces fijas se dibujan una vez y se reutilizan; las que parpadean o pulsan se redibujan 30 veces por segundo en lugar de 60.
- Saber si un punto o un muro está explorado ya no pide una lectura a la tarjeta gráfica por cada consulta: se usa una copia reducida que se actualiza solo al cambiar lo explorado.
- El guardado de la exploración del Keeper solo se ejecuta cuando ha cambiado algo.

### Carga

- Las texturas de los dados 3D pesan 3,7 MB en lugar de 19,5 MB: la pantalla de acceso descarga unos 16 MB menos.
- Los 94 retratos de token pesan 25 MB en lugar de 79 MB, con la misma resolución (1024 px).

## [2.9.3] — 2026-11-16

V2 · Cartas con el arte de Dominios y clases

### Mano de cartas

- Las cartas siguen el diseño de referencia: marco dorado, bandera colgando en la esquina, banda con el nombre y el texto sobre fondo claro.
- Cada Poder lleva la bandera y la banda de su Dominio (Social, Void, Kinetic, Mind, Synthesys, Tech, Light), con su nivel sobre la bandera.
- Los Resolve Moves y la carta de clase llevan la bandera y la banda de su clase.
- Las cartas de Ancestry y de Background llevan su banda de esquina.
- El coste principal se ve en un hexágono en la esquina; tipo, Tier, costes y tirada van en etiquetas bajo el título, y Dominio, nivel y Recall Cost al pie.
- Los colores de cada Dominio pasan a ser los de su bandera.

## [2.9.2] — 2026-11-16

V2 · Equipo más fácil de manejar

### Pestaña Armas y equipo

- Todo se hace en la propia pestaña, sin abrir ventanas encima: buscar, añadir, cambiar cantidades, editar y quitar.
- Un buscador con categorías (Armas, Armadura, Equipo, Aumentos) muestra el catálogo según escribes; cada resultado se añade con un clic.
- Añadir una armadura sigue actualizando sus umbrales y Armor Slots.
- Las cantidades se cambian con − y +.
- Cada arma y objeto se edita en su propia fila. El Trait y el Alcance se eligen de una lista en vez de escribirse.
- Quitar pide confirmación en el mismo botón, para no borrar nada por un clic de más.
- «+ Arma propia» y «+ Objeto propio» crean entradas a medida; no se guardan hasta ponerles nombre.
- Cada cambio se guarda al momento: desaparece el botón «Guardar inventario».
- El botón de cada arma se llama ahora «Atacar» y la lleva al panel de dados.
- El editor completo anterior sigue disponible desde un enlace al pie.

## [2.9.1] — 2026-11-16

V2 · Dron compartido con Neural Network Control

### Control compartido del dron

- Un dron está emparejado con un solo operador. Si se le instala Neural Network Control (1 Cr, 0 Slots), el Keeper puede registrar a varios jugadores y todos lo controlan por turnos.
- Sin ese módulo, el control del token solo admite un jugador y avisa de qué módulo hace falta.
- Pasar el control: gratis con señal Stable; con señal Unstable quien lo recibe marca 1 Stress, y si no puede marcarlo el operador anterior conserva el control; con señal Lost la interfaz no funciona.
- El cambio de operador se hace en Ficha → Dron · módulos y señal y se anuncia en el chat. Mueve el Spotlight: no da Acciones extra.
- Si se retira el módulo, el dron se queda con un solo jugador. Los drones creados antes de estas reglas conservan sus controladores.

## [2.9.0] — 2026-11-16

V2 · Mano de cartas: el Loadout en 3D junto a la ficha

### La mano

- En postura de jugador, al seleccionar tu personaje la barra inferior se divide en dos: a la izquierda sus stats, a la derecha su mano de cartas en abanico.
- Las cartas son 3D: se levantan y se inclinan hacia el puntero al pasar por encima, con el coste, la tirada y el Recall Cost a la vista.
- Un Awakened tiene en la mano los Poderes de su Loadout, su Hope Feature, la carta de su Ancestry y la de su Background.
- Un Sleeping tiene sus Resolve Moves, su Effort Feature, su Ancestry y su Background.
- El Mystic Sleeping tiene además los Poderes de su Uncanny Archive, que se juegan con Uncanny Power.

### Jugar una carta

- Un clic abre la carta en grande con su texto completo. Arrastrarla y soltarla sobre el mapa la juega en ese punto.
- Al jugarla se paga su coste impreso (Hope, Stress, Effort, Resolve o HP). Si no hay recursos, o estás Overwhelmed y cuesta Stress, no se juega y se explica por qué.
- La jugada se anuncia con una tarjeta a la derecha, una línea en el chat y una señal en el punto del mapa.
- Si el Poder pide tirada, el panel de dados queda preparado con su Trait y su DC: solo falta pulsar ROLL.
- Un Resolve Move tira sus dados de Resolve. Los Moves de coste abierto preguntan cuánto Resolve gastas.
- Uncanny Power: gastas Resolve, se tiran los dados más Knowledge para ver el nivel que alcanzas, el Keeper gana 1 Fear por Resolve y la tirada es Knowledge contra DC 10 + nivel. El coste de Hope se ignora.
- Las cartas pasivas, las reacciones del Archivo y los proyectos a largo plazo se consultan pero no se juegan.

### Vault y Recall

- El botón Vault muestra los Poderes que conoces y no tienes preparados.
- Recall los trae al Loadout pagando lo que marca el Corebook: gratis en un Long Rest, su Recall Cost en Stress en un Short Rest, y en una escena activa además 1 Hope y tu Acción.
- Si el Loadout está lleno, eliges qué Poder pasa al Vault.

## [2.8.10] — 2026-11-16

V2 · Drones según el Corebook: Grado, Módulos y señal

### Montar un dron

- ROSTER → + DRONE abre la consola del dron: se elige el Grado (Common, Military o Experimental) y sus Módulos, como en el capítulo 14 del Corebook. Las plantillas anteriores, con valores que no eran del libro, desaparecen.
- El Grado fija HP, Evasion, umbrales, Armor Slots y Module Slots: Common 2 HP / 10 / 5-11 / 0 / 2; Military 3 HP / 11 / 7-14 / 1 / 3; Experimental 5 HP / 12 / 9-16 / 2 / 4.
- Catálogo de 102 módulos con su coste, Slots y texto: los 31 del Corebook y 71 de Rust & Steel. Se puede buscar y filtrar por los que admite el Grado.
- Las ocho configuraciones de ejemplo del libro (Cheap Scout Mote, Security Stun Drone, Ghost-Signal Infiltrator…) se cargan con un clic.
- Se avisa si faltan Slots, si un módulo es de un Grado superior (modificación ilegal, con su tirada de Knowledge (Tech)) o si se monta un arma letal en un dron Common.
- Agile Servos, Armor Plating, Reinforced Plating y otros módulos ajustan Evasion, Armor Slots y umbrales, sin pasar del máximo de Evasion del Grado.

### En la mesa

- Cada dron tiene operador, estado de señal (Stable, Unstable, Lost), tipo de enlace y protocolo si pierde la señal. Se cambian en Ficha → Dron · módulos y señal.
- Atacar con un dron es la Acción y la tirada de su operador: tira Hope y Fear con los Traits del operador. Con señal Unstable el ataque tiene Desventaja; con señal Lost no se puede ordenar.
- Un dron con la señal Lost tiene Evasion −2 cuando lo atacan.
- El daño de las armas de dron no escala con Proficiency.
- Botón para tirar la Drone Complication (d12); los resultados de señal y de HP se aplican solos.
- Los módulos se pueden marcar offline. Un dron creado con las plantillas antiguas pide elegir Grado y módulos al abrir su consola.

## [2.8.9] — 2026-11-16

V2 · Documentación al día

### Documentación

- README.md, PRUEBAS_LOCALES.md y FIREBASE_SETUP.md describen la V2: lobby y biblioteca de la cuenta, creador, subida de nivel, ataque completo, alcances, daño en 3D, panel único de resultados y niebla con degradado. Seguían indicando v1.4.0.
- Se retiran de la documentación las instrucciones de Netlify Identity.
- La versión que muestran README.md y PRUEBAS_LOCALES.md se escribe sola al generar el changelog, y la comprobación de versión falla si se quedan atrás.

## [2.8.8] — 2026-11-16

V2 · Luces y niebla de guerra con degradado

### Visión y luces

- La visión y las luces en zona abierta vuelven a ser redondas: antes salían como un cuadrado de lados rectos.
- La visión se desvanece en el último tramo de su alcance en lugar de acabar en una línea.
- Los bordes de la niebla de guerra y de las sombras de las luces se dibujan difuminados. Los muros siguen cortando la visión.
- La zona explorada que se recupera al cargar la partida ya no muestra escalones marcados.

## [2.8.7] — 2026-11-16

V2 · 72 retratos canonicos por Ancestry, Genero y Tipologias con selector interactivo y correccion de anatomia alienigena

### Tokens y Retratos Canonicos

- Correccion rigurosa de anatomia segun el lore de Alien Species y Corebook: Kryx es ahora un feroz licantropo lupino humanoide (hombre lobo) con pelaje shadowsteel y crestas cian bioluminiscentes; Kryllian es un insectoide esbelto de cuatro brazos tipo mantis religiosa; Rift Spinner es estrictamente no humanoide, un aracnido cristalino prismatico de 8 extremidades.
- 72 retratos dedicados cubriendo las 9 ancestries x 2 generos x 4 tipologias canonicas: Guerrero / Vanguard, Erudito / Mago, Picaro / Explorador y Tecnico / Cientifico.
- Selector interactivo de tipologia en el Creador de Personajes (Paso 9: Detalles) para alternar en vivo entre las 4 variantes de rol con previsualizacion inmediata.
- Asignacion automatica por clase o rol al importar personajes JSON (Jarana como Vanguard Rift Spinner femenina, Brok como Soldier Kryx masculino, Lucy Fer como Mystic femenina, Miles como Diplomat/Tech masculino).

### Importacion de Personajes

- Compatibilidad universal e insensible a mayusculas para cualquier JSON generado por Veilfarers Character Creator o herramientas legacy.
- Deteccion automatica e inferencia de formato basada en campos estructurales, garantizando que ninguna ficha valida sea rechazada con formato no reconocido.

## [2.8.6] — 2026-11-16

V2 · Retratos canónicos para cada Ancestry por género y asignación automática

### Tokens y Retratos

- Galería de 18 retratos de tokens canónicos cubriendo las 9 ancestries oficiales de Veilfarers (Ailuran, Bloomstrider, Celestiari, Ethereal, Human, Kryllian, Kryx, Rift Spinner y Synthetic) con variantes femenina y masculina en alta resolución.
- Asignación automática e inteligente de avatar al importar personajes o crear nuevos actores según su ancestry, pronombres y morfología de nombre.
- Vista previa en tiempo real del retrato asignado en el asistente de creación de personajes (Paso 9: Detalles) y en las tarjetas de ingesta de fichas JSON.
- Mantiene los retratos personalizados existentes sin sobreescribir imágenes configuradas manualmente.

## [2.8.5] — 2026-11-16

V2 · Compatibilidad con fichas exportadas desde Veilfarers Character Creator

### Importación de Personajes

- Admite fichas creadas con el creador original Veilfarers Character Creator (versiones 2.41, 2.74 y gama 2.x) además del formato de Character Sheet y VTT Actor.
- Detección automática e inferencia de senda (Sleeping vs Awakened) cuando el campo chosen_path viene vacío o sin indicar en fichas del creador.
- Extracción robusta de atributos firmados (+1, -1, +0), umbrales, bonificador de Honed Edge, dados de Resolve y armadura.
- Carga completa de armamento, equipo, notas de trasfondo, aumentos y experiencias activas para los nuevos personajes importados.
- Validación de actores en mesa y sincronización de red habilitadas para fuentes de Character Creator sin rechazos de esquema.

## [2.8.4] — 2026-11-16

V2 · Un solo panel de resultados, con las tiradas de toda la mesa

### Resultados de tiradas

- Cada tirada se anuncia una sola vez: la tarjeta dorada de la derecha y la línea del chat. Desaparece el marcador inferior que repetía el resultado.
- El panel de la derecha apila las tiradas de todos, en el orden en que llegan: si varias personas lanzan a la vez se ven todos los resultados (hasta 6, 20 segundos cada uno; un clic cierra la tarjeta).
- El ataque de un adversario y el daño también llegan como tarjeta al resto de la mesa, salvo que la tirada sea secreta del Keeper.

## [2.8.3] — 2026-11-16

V2 · El d6 de Desventaja se ve entero y sin arma solo se ataca en Melee

### Tiradas

- El aviso de la tirada ya no resume todo en un único "Mod": escribe la suma completa, por ejemplo "Hope [2] + Fear [4] + 2 − d6 [6] (Desventaja) = 2". Antes el d6 quedaba mezclado con el Trait y parecía que solo se restaba una parte.
- El mismo desglose aparece en el panel, el chat y el registro, también con Ventaja y con el dado de Resolve.

### Ataque

- Sin arma el ataque es cuerpo a cuerpo: no se puede atacar a un objetivo fuera de Melee.

## [2.8.2] — 2026-11-16

V2 · Indicador de Desventaja en botón de acción, Proficiency en HUD y robustez de audio Web Audio

### Tiradas y Dados

- Los botones de selección de tirada (DIS / NORM / ADV) actualizan de inmediato la etiqueta del botón principal de acción con [DIS -1d6] y [ADV +1d6].
- El dado d6 de Desventaja en 3D utiliza el tema canónico de dados de miedo (vfFear).
- El HUD quickbar de tokens de personajes jugadores (PCs) ahora muestra explícitamente Evasion y Proficiency junto a los puntos de Esperanza/Esfuerzo.
- La inicialización del sintetizador Web Audio API es segura ante navegadores o entornos sin AudioContext.

## [2.8.1] — 2026-11-16

V2 · Un solo acceso: la cuenta de la VTT

### Cuenta

- Se retira el acceso con Netlify Identity. Se entra con correo y contraseña, con Google o como invitado en local.
- La pantalla de cuenta y los avisos de error ya no ofrecen Netlify Identity como alternativa.
- La página deja de cargar el widget externo de Netlify Identity.
- Las salas, los personajes, las escenas y las notas se guardan siempre en la cuenta de la VTT.

## [2.8.0] — 2026-11-16

V2 · Dados 3D en ataque y daño, Proficiency al día y biblioteca privada en el lobby

### Ataque

- La Desventaja (y la Ventaja) tira su d6 en la mesa y el resultado se resta (o suma) a la vista: aparece en el panel, en el aviso de la tirada, en el chat y en el registro, separado del resto de modificadores.
- El ataque de un adversario tira su d20 en 3D, con el d6 de Ventaja o Desventaja cuando toca.
- El dado de Resolve que cae en la mesa es el que cuenta: antes se tiraba en 3D pero se usaba otro valor.

### Daño

- Los dados de daño se tiran en 3D y sus caras son el daño: tantos dados como diga el arma con su Proficiency, y el doble en un Crítico de jugador.
- Un Crítico del Keeper sigue siendo daño máximo, sin tirar.
- Con más de 40 dados o con los dados 3D desactivados, el daño se calcula como antes.

### Proficiency y Honed Edge

- Al subir de nivel, el panel de daño usa la Proficiency nueva sin tener que volver a preparar el arma. Un valor escrito a mano se respeta.
- Honed Edge de un Sleeping es su nivel − 1 y se actualiza al subir de nivel.
- Una ficha importada con el daño "final" ya calculado vuelve al daño base del arma al subir de nivel, para que Proficiency y Honed Edge se apliquen con su valor actual.

### Lobby

- El panel de personajes del lobby es ahora "Mis personajes": la biblioteca privada de tu cuenta. Se pueden crear, importar desde JSON, descargar y borrar.
- El almacén compartido anterior deja de usarse; sus datos no se han borrado.
- En modo invitado no hay biblioteca: se puede crear un personaje y descargar su ficha.

## [2.7.1] — 2026-11-15

V2 · Creador: selección de equipo y listado de poderes más claros

### Equipo inicial

- Resumen "Tu equipo" arriba, con el arma, la armadura y los objetos de clase elegidos.
- Cada arma muestra por separado Daño, Alcance, Trait y Carga; cada armadura, sus umbrales ya con el nivel, Armor Slots y capacidad de mejoras.
- Cada propiedad (Armor Piercing, Reliable, Life Support…) aparece con la explicación de lo que hace.
- Las opciones se agrupan por categoría, con un buscador por nombre, categoría o propiedad.
- Las armas que atacan con uno de los mejores Traits del personaje se marcan como recomendadas y salen primero.
- Se indica qué categorías de armas y armaduras puede usar la clase.

### Poderes

- Resumen del Starter Loadout con los Poderes ya elegidos.
- Cada Poder muestra Tipo, Coste, Tirada y Recall por separado y su texto completo, sin recortar.
- Una línea explica qué significa cada dato.
- En la ficha, la pestaña Rasgos muestra los Poderes como tarjetas con sus etiquetas (Dominio, nivel, tipo, coste, tirada, Recall).

## [2.7.0] — 2026-11-15

V2 · Resolve Moves de los Sleeping y Awakening en juego

### Resolve Moves (Corebook, cap. 7)

- Catálogo de los 42 Resolve Moves: dos por clase y uno por subclase.
- Al crear un personaje Sleeping, la ficha recibe sola los dos Class Moves de su clase y el Move de su subclase. El creador los muestra en el paso de Poderes.
- Al subir de nivel, un multiclass Sleeping aprende exactamente un Class Resolve Move de la segunda clase, elegido de la lista.
- La opción de Move nuevo solo se ofrece si a la ficha le falta alguno de los de su clase y subclase; si ya los tiene todos, la opción es +1 Resolve máximo.

### Awakening en juego (Corebook, cap. 7)

- Nuevo botón Despertar en la ficha de un personaje Sleeping (vista Completa, solo el Keeper), para cuando la historia lo establece.
- El Effort actual pasa a ser Hope. Se retiran el Resolve, los Resolve Moves, Honed Edge y el Recovery Anchor. Las Experiencias se conservan.
- El Effort Feature y el Class Feature se sustituyen por el Hope Feature y el Class Feature de Awakened. La subclase conserva su rango; The Steward pasa a ser The Icon.
- Se abre el Vault y el Loadout con dos Poderes de nivel 1 de los Dominios de la clase. Un Mystic elige su Veil Alignment.
- Si había hecho multiclass, su Dominio latente pasa a estar activo, sin Poderes iniciales.
- Se devuelven los Advancement Slots gastados en +1 Resolve, Moves o Tempered Resolve. El botón Gastar Slots devueltos permite volver a gastarlos sin cambiar de nivel.

## [2.6.2] — 2026-11-15

V2 · Creador: herencia humana y guardado en la cuenta

### Creador de personajes

- Humanos: Inheritance of the Builders (Corebook, cap. 3). Al elegir Human se escoge una de las dos herencias: The Graft, un aumento Common o Military gratis y sin inconveniente (el Common no ocupa Augment Slot, el Military ocupa uno), o The Tool, un objeto Experimental de 9 Cr de cualquier catálogo.
- La ficha registra la herencia: el aumento aparece en Rasgos junto al +2 Augment Capacity de Made for the Graft, y The Tool entra en el equipo.
- Guardar en mi cuenta: con la sesión iniciada, el personaje terminado se guarda en tu biblioteca. Guardarlo otra vez actualiza la misma entrada.
- Desde la cuenta, Use in game trae el personaje guardado a la mesa.

## [2.6.1] — 2026-11-15

V2 · Creación y subida de nivel ajustadas al canon del Corebook

### Creación de personaje · correcciones de canon (Corebook 12.06, cap. 8)

- Experiencias iniciales: un personaje Awakened empieza con dos a +2 y uno Sleeping con tres. Antes el creador pedía tres a todos.
- Equipo inicial: un arma y una armadura de Tier 1, además de los objetos de clase. Antes permitía dos armas dentro de un presupuesto.
- Afiliaciones: las nueve del Corebook (seis Casas, Free Fleet, Explorers' Guild e Independent) son las opciones normales. Solara Compact y Stellar Commerce Guild aparecen como opción avanzada, y Church of the Eternal Veil y House Kaelen como fuera del Corebook; las cuatro avisan de que requieren aprobación del Keeper.
- Independent no tiene Standing ni Calls: lleva una Favor Pool de 1 Favor por sesión.

### Subida de nivel con el catálogo de reglas

- Nuevo Poder (Awakened): se elige de una lista con los Poderes de los Dominios del personaje que su nivel permite y que aún no tiene; entra en el Vault.
- Experiencias: en el Logro de Tier o en un Slot se puede subir dos Experiencias +1 o añadir una nueva a +2 y subir una. El máximo son cinco Experiencias.
- Multiclass: se elige la segunda Clase, un Dominio realmente nuevo y se responde a su pregunta de trasfondo. El Dominio nuevo progresa a la mitad del nivel, redondeando hacia arriba; en un Sleeping queda latente.
- Upgraded Subclass: añade a la ficha el rasgo completo de Specialization o de Mastery de la subclase.
- La capacidad del Loadout sigue el Tier: 5 Poderes en Tier 1, 6 en Tier 2 y 7 en Tier 3.

## [2.6.0] — 2026-11-15

V2 · Creador de personajes dentro de la VTT

### Creador de personajes

- Nueva sección para crear personajes paso a paso, adaptada del Character Creator: Ancestry, Community, Path con Class y Subclass, Traits, Experiencias, Afiliación, Poderes, Equipo y Detalles.
- Incluye las 9 ancestries, 7 communities, 9 clases con sus 3 subclases por senda (Awakened y Sleeping), 13 afiliaciones, los Poderes de nivel 1 de los 7 Dominios y el equipo Common del Corebook, con Rust & Steel opcional.
- Aplica las reglas de creación: los Traits se reparten con los valores +2, +1, +1, 0, 0, −1; tres Experiencias a +2; dos Poderes de nivel 1 de los Dominios de la clase (el Mystic elige Veil Alignment y el Vanguard según su subclase); armas y armadura dentro del acceso tecnológico de la clase, con 4 créditos para cada cosa.
- Cada paso marca cuándo está completo; cambiar una elección anterior limpia lo que dependía de ella. El borrador se guarda solo en el navegador.

### Llevar la ficha a la mesa

- Al terminar, el Keeper puede crear el personaje como token nuevo en la escena o asignar la ficha a un token que ya existe, que conserva su posición, color y jugador.
- También se puede descargar la ficha en JSON, en el mismo formato que la VTT ya importa.
- El personaje llega con sus HP, Evasion, Stress, umbrales (armadura + nivel), Armor Slots, armas con alcance y daño, Poderes, Experiencias y afiliación.

### Dónde está

- Botón + PERSONAJE en la pestaña Roster de la mesa y botón Crear personaje en el Character Vault del lobby.

## [2.5.0] — 2026-11-15

V2 · Fase 1: Subida de nivel

### Subida de nivel

- Nuevo botón Subir de nivel en la ficha (vista Completa, solo el Keeper). Aplica las reglas del Corebook, cap. 12, hasta el nivel 10.
- Cada nivel da dos Advancement Slots: +1 HP, +1 Stress, +1 a dos Experiencias, +1 a un Trait (una vez por Tier y Trait), +1 Evasion, +1 Technology Access, Nuevo Poder o Resolve, y las opciones de dos Slots: +1 Proficiency, Multiclass, Upgraded Subclass y Tempered Resolve. Las que no están disponibles aparecen desactivadas con el motivo.
- Los niveles 2, 5 y 8 añaden el Logro de Tier: +1 Proficiency y +1 a dos Experiencias.
- Los personajes Sleeping ganan +1 Resolve máximo en los niveles 3, 5, 7 y 9, hasta 6.
- Los umbrales Major y Severe suben 1 con el nivel.
- Si queda un Slot sin gastar, la ficha avisa de que se pierde y pide confirmarlo.
- El historial de avance queda en la pestaña Rasgos y en el registro de la partida.

## [2.4.1] — 2026-11-15

V2 · Alcance corregido, aviso de muros y bandas en el lock

### Alcance

- Bandas de alcance de la mesa: Melee (casilla adyacente o hasta 1 m), Very Close (hasta 5 m), Close (hasta 10 m), Far (hasta 25 m) y Extreme (más de 25 m). El ataque, la línea de lock y la regla de medir usan ahora las mismas bandas y la misma escala.
- Corregido: un arma cuya ficha no indicaba alcance no recibía Desventaja a larga distancia. Ahora toma el alcance del arma del catálogo con el mismo nombre; si aun así no se conoce, el resultado lo dice.
- Corregido: la línea de lock medía a 1,5 m por casilla y la regla a 2 m. Ambas usan la escala del mapa.

### Línea de tiro

- Si hay un muro o una puerta cerrada entre atacante y objetivo, el resultado del ataque avisa de que la línea de tiro está bloqueada. El ataque se puede lanzar igualmente. Ventanas y puertas abiertas no bloquean.
- La etiqueta de la línea de lock muestra la banda de juego junto a la distancia en metros y casillas, y BLOQUEADO cuando hay un obstáculo.
- El resultado del ataque muestra la banda, los metros y las casillas hasta el objetivo.

## [2.4.0] — 2026-11-15

V2 · Ataque completo: tirada, alcance y daño solo si impacta

### Ataques

- Nuevo botón ATACAR AL OBJETIVO en el panel de daño: hace el proceso entero. Primero la tirada de ataque contra la Evasion del objetivo y, solo si impacta, calcula el daño. Si falla no hay daño.
- Los personajes jugadores atacan con Hope y Fear (2d12) más el Trait del arma y sus modificadores; la tirada paga Hope, Effort o Fear como cualquier tirada de Dualidad. Con dados iguales es crítico: impacta siempre y dobla los dados de daño.
- Los adversarios del Keeper atacan con 1d20 más su modificador de Ataque. Un 20 natural es crítico: impacta siempre y hace el daño máximo.
- Ventaja y Desventaja suman o restan 1d6 y se anulan entre sí.
- Aplicar el daño sigue siendo un paso aparte, para que el defensor decida si gasta Armor Slots.

### Alcance

- El ataque mide la distancia entre los dos tokens y la traduce a la banda del Corebook: Melee (casilla adyacente), Very Close (hasta 5 m), Close (hasta 20 m), Far (hasta 100 m) y Very Far.
- Un arma cuerpo a cuerpo solo puede atacar a un objetivo en Melee; fuera de esa distancia el ataque no se tira.
- Un arma a distancia usada más allá de la banda que cubre ataca con Desventaja.
- El resultado indica la banda, el alcance del arma y el motivo de la Desventaja o del bloqueo.

### Chat

- Pulsar Intro sobre el mapa abre el chat de la mesa listo para escribir. No actúa si hay una ventana abierta, un campo o botón con el foco, o una zona de agua a medio dibujar.

### Otros

- El botón de daño directo se mantiene como "Solo daño (sin tirada de ataque)" para peligros, caídas y efectos que no son un ataque.

## [2.3.3] — 2026-11-15

V2 · Daño: armas Crushing y Bleed

### Resolución de daño

- Crushing: el impacto ignora 1 Armor Slot del objetivo, que no puede gastarlo contra ese golpe (con un solo slot, no puede mitigar). El slot ignorado no se consume. La armadura Composite lo anula.
- Bleed: cualquier impacto deja al objetivo con la condición Bleeding, sea cual sea su gravedad e incluso si la armadura lo absorbe. Los objetivos que no sangran (Synthetics) son inmunes.
- Ambos tags se leen de las propiedades del arma elegida y la armadura Composite se detecta en el objetivo; los tres se pueden marcar a mano en Opciones avanzadas.
- El resultado del daño indica cuándo se aplica cada tag o por qué se anula.

## [2.3.2] — 2026-11-15

V2 · Daño: Penetración por tipo de daño

### Resolución de daño

- Penetración según el Corebook (cap. 10): el daño Energy baja 2 los umbrales Major y Severe del objetivo para ese impacto; Void y Neural los bajan 4. Physical no los cambia. La Penetración no ignora la armadura.
- El tipo de daño se toma del arma o de la expresión (por ejemplo "1d8 ene." o "1d10 void") y se puede elegir a mano en Opciones avanzadas.
- La armadura Reflective anula la Penetración de Energy y un Ward anula la de Void y Neural. La armadura Reflective del objetivo se detecta sola; el Ward se marca en Opciones avanzadas.
- Un impacto Neural marca además 1 Stress al objetivo.
- El Overkill (1 HP extra por cada 10 puntos sobre Severe) cuenta desde el umbral ya reducido. El resultado muestra los umbrales originales y los aplicados al impacto.
- Se pueden gastar tantos Armor Slots como haya disponibles para mitigar un mismo impacto.

## [2.3.1] — 2026-11-15

V2 · Daño: la armadura ya no se gasta sola

### Resolución de daño

- Corregido: un impacto por debajo del umbral Major aparecía como "Deflected · 0 HP" porque el cálculo gastaba un Armor Slot por su cuenta. Ahora marca 1 HP (Minor), como indica el Corebook.
- Gastar armadura es decisión del defensor: la casilla "El defensor gasta 1 Armor Slot" empieza desmarcada y el botón Gastar escudos sigue disponible tras calcular.
- Con un objetivo elegido, el cálculo usa siempre los umbrales Major y Severe de ese token, de modo que lo que se muestra coincide con lo que se aplica aunque los campos manuales tuvieran otros valores.

## [2.3.0] — 2026-11-14

V2 · Fase 1: Ficha en vista Básica o Completa

### Fichas

- La ficha tiene dos vistas, con un conmutador junto a Guardar ficha. Básica muestra lo que se usa en mesa: condiciones, Proficiency, Evasion, recursos actuales, umbrales, Traits y notas, sin necesidad de desplazarse.
- Completa añade nombre, clase, ancestry y nivel, los máximos de cada recurso, la configuración de la senda Sleeping, el JSON original, las exportaciones y los ajustes del token.
- Los jugadores abren la ficha en Básica y el Keeper en Completa; la vista elegida se recuerda en el navegador.
- Guardar en vista Básica conserva todos los datos que no se ven.

## [2.2.3] — 2026-11-14

V2 · Vínculos visible en todos los personajes

### Fichas

- Corregido: la pestaña Vínculos solo aparecía en fichas importadas que ya traían afiliaciones o conexiones. Ahora está en la ficha de todos los personajes jugadores, también los creados en la VTT.
- Las tres afiliaciones de la ficha se pueden rellenar y editar (nombre, Standing, Reputation y Call usada), igual que las conexiones First Bond, Open Debt y Friction.
- Los cambios se guardan con Guardar ficha y, en fichas importadas, se conservan al exportar al formato del creador.

## [2.2.2] — 2026-11-14

V2 · Fase 1: Standing, Reputation y Call editables en mesa

### Fichas

- En la pestaña Vínculos, el Keeper puede cambiar el Standing y la Reputation de cada afiliación y marcar su Call como usada. Se guarda con Guardar ficha.
- Los cambios se conservan al exportar la ficha al formato del creador.
- Los jugadores ven estos datos en su ficha, sin poder modificarlos.

## [2.2.1] — 2026-11-14

V2 · El lobby encuentra tus salas y avisa si algo falla

### Salas en el lobby

- Corregido: al entrar con tu cuenta, el lobby podía mostrar "No tienes salas" aunque existieran. El portal y el sistema de salas usan ahora siempre la misma configuración de Firebase, también cuando faltan las variables de entorno.
- Si la lista de salas no se puede cargar, el lobby lo dice, explica el motivo y ofrece Reintentar, en lugar de mostrar una lista vacía.
- Si no se puede abrir, crear o unirse a una sala, vuelves al lobby con el motivo a la vista; antes te quedabas en una mesa local sin aviso.
- La mesa local y el modo invitado no consultan la nube.

## [2.2.0] — 2026-11-14

V2 · Fase 1: Vínculos, afiliaciones y loadout en la ficha

### Fichas

- Nueva pestaña Vínculos en la ficha de los personajes importados: afiliaciones con su Standing, Reputation y estado de la Call, tokens y notas de facción, conexiones (First Bond, Open Debt, Friction) y las semillas del personaje.
- La pestaña Rasgos muestra el Signature Trait, cuántos poderes hay equipados frente al límite del loadout y el Vault de poderes conocidos sin equipar.
- Estos datos son de consulta y se leen de la ficha JSON importada; la pestaña solo aparece si la ficha los incluye.
- El pie de la ficha con Guardar ficha queda siempre a la vista, sin texto asomando por debajo.

## [2.1.3] — 2026-11-14

V2 · Consola lateral en violeta

### Interfaz

- El interior de la consola lateral adopta las superficies violetas y pierde las esquinas redondeadas: tarjetas de roster, arcos y escenas, documentos, registro, chat y los contenedores del panel de tiradas.
- La escena activa, el token seleccionado y los temas de dados conservan su cian y sus colores propios.

## [2.1.2] — 2026-11-14

V2 · Modales, paneles flotantes y HUD en violeta

### Interfaz

- Los modales (ficha, ayuda, compendio, cuenta, salas y sesiones) usan la dirección visual violeta: marco de línea fina con borde superior de acento, sin esquinas redondeadas y títulos en mayúsculas espaciadas.
- Los relojes de escena, el panel de capas y los contenedores del HUD de jugador y del HUD de Keeper adoptan las mismas superficies.
- El pie de la ficha sigue fijo abajo con el botón Guardar ficha siempre a la vista.
- Se mantiene el cian para lo seleccionado o activo y no cambian los colores de dados, Hope, Fear, tokens ni barras de recursos.

## [2.1.1] — 2026-11-14

V2 · Marco de la mesa en violeta

### Mesa de juego

- El marco de la mesa adopta la dirección visual del lobby: fondo violeta oscuro con retícula fina, cabecera, barra de herramientas y consola lateral con líneas finas y sin esquinas redondeadas, y títulos en mayúsculas espaciadas.
- Botones, campos, pestañas y la barra rápida del token usan las mismas superficies violetas.
- No cambian los colores con significado en juego: dados, Hope, Fear, tokens, barras de recursos ni el cian que marca la herramienta o pestaña activa.

## [2.1.0] — 2026-11-14

V2 · Nuevo lobby: retícula violeta y vista Básico / Avanzado

### Pantalla de acceso y centro de mando

- Nueva dirección visual del lobby: fondo violeta oscuro con retícula de líneas finas, celdas numeradas (01, 02…), títulos en mayúsculas muy espaciadas y etiquetas en tipografía monoespaciada. Sin brillos ni esquinas redondeadas.
- Paleta violeta aprobada: fondo #0d0420, profundo #2a0b5c, medio #6d28d9, luz #c084fc y acento #fde68a. Los colores de juego (dados, Hope, Fear, tokens) no cambian.
- El portal de acceso se divide en dos celdas: título a la izquierda y formulario de acceso a la derecha. En pantallas estrechas se apilan.
- Se mantienen los dos grandes accesos ENTRAR COMO JUGADOR y ENTRAR COMO KEEPER, el usuario y el correo conectados, las salas, el código de invitación y la entrada directa a la mesa.

### Vista Básico / Avanzado

- Conmutador en la cabecera del centro de mando. Básico (por defecto) muestra lo necesario para entrar a jugar, con textos de ayuda; Avanzado añade el creador rápido de personaje, las estadísticas y acciones de cada ficha del Vault (exportar, eliminar) y el borrado de salas.
- La vista elegida se recuerda en el navegador.

### Accesibilidad

- Foco de teclado visible en botones y campos, y sin animaciones cuando el sistema pide movimiento reducido.

## [2.0.2] — 2026-11-14

V2 · Fase 0: Carga inicial más ligera

### Rendimiento

- El archivo principal de la aplicación baja de 1.316 kB a 888 kB (de 338 kB a 249 kB comprimido): Firebase se sirve en archivos propios que el navegador conserva en caché entre versiones.
- El módulo de conexión directa entre navegadores (PeerJS, 122 kB) ya no se descarga al abrir la aplicación; solo se carga al crear o unirse a una sesión directa. Las salas en la nube no lo necesitan.

### Dados 3D

- Corregida una referencia con mayúsculas incorrectas (Dice.min.js) que impedía iniciar los dados 3D en servidores que distinguen mayúsculas de minúsculas. Las físicas y los parámetros de los dados no cambian.

## [2.0.1] — 2026-11-14

V2 · Fase 0: Arcos de sala y notas personales en la cuenta

### Cuenta y guardado en la nube

- Notas personales por partida: cada usuario puede guardar notas privadas asociadas a una sala; ni el Keeper ni otros jugadores pueden leerlas (modelo y reglas listos; la pantalla llegará con la cuenta de la Fase 2).
- Arcos por sala del Keeper: la sala mantiene en la nube un índice de sus arcos (nombre, descripción, escenas y orden) que se actualiza solo al guardar la campaña y escribe únicamente lo que cambia.
- Al eliminar una sala también se borra su índice de arcos.
- Si las reglas de Firestore publicadas son anteriores a esta versión, la partida se guarda igual y el índice de arcos se omite sin errores.

### Reglas de Firestore

- Nuevas reglas para rooms/{sala}/arcs (solo el Keeper propietario) y users/{usuario}/notes (solo su autor), con límites de tamaño y campos cerrados. Requiere volver a publicar las reglas.

### Pruebas

- Las pruebas de reglas de cuenta y de salas se han ejecutado en el emulador de Firestore: guardado de personajes y escenas, notas, arcos, reconexión de Keeper y jugador.
- La reconexión de un jugador con varios tokens asignados conserva el control de todos ellos.

## [2.0.0] — 2026-11-14

V2 · Fase 0: Estabilización de guardado, fichas y red

### Chat

- Los subtítulos de chat en overlay se muestran siempre por encima de cualquier otro elemento (HUD, modales, dados 3D y avisos).

### Cuenta y guardado en la nube

- Guardar un personaje ya guardado actualiza su entrada en lugar de crear un duplicado.
- Reglas de Firestore corregidas: los personajes admiten actualización y las escenas del Keeper conservan muros, luces, niebla, agua, notas, tokens y arco, con imagen en Firebase Storage o en Cloudinary.
- Si un guardado no llega a la nube y queda solo en el navegador, la aplicación lo avisa de forma visible.
- Luz ambiente por defecto corregida al guardar escenas sin valor definido.

### Fichas

- El importador acepta las fichas actuales del creador (versiones 2.8x, esquema veilfarers.character/2) sin aviso de versión.
- Hope y Effort respetan el máximo de la ficha en la barra rápida y en los controles de recursos.

### Red y permisos

- Al resolver daño contra un token ajeno, el jugador solo puede cambiar HP y Armor del objetivo; el resto de campos queda protegido.

## [1.5.0] — 2026-11-12

Fidelidad Canónica Total: Lobby Simplificado por Roles, Subtítulos en Overlay, Paleta de Color de Token, Armaduras Activas y Catálogo Integral

### Físicas Canónicas de Dados 3D (@3d-dice/dice-box)

- Animación completa sin cortes prematuros (settleTimeout: 9500ms): los dados ruedan, rebotan y desaceleran hasta su detención natural por fricción y gravedad antes de que el motor resuelva el resultado.
- Muros invisibles de colisión física (Ammo.js) restringidos exclusivamente al área del mapa táctico (#canvas_viewport_root) con actualización dinámica por ResizeObserver, impidiendo que los dados caigan o reboten sobre los menús superior o laterales.
- Preservación de las físicas y parámetros canónicos de @3d-dice/dice-box (BabylonJS + Ammo.js) asegurando un movimiento fluido, natural y consistente sin saltos artificiales ni micro-rebotes excesivos.

### Pantalla de Entrada Simplificada (Lobby Táctico)

- Rediseño intuitivo con dos grandes botones Hero principales: [ ◈ ENTRAR COMO JUGADOR ] y [ ⚡ ENTRAR COMO KEEPER ].
- Modo Jugador: Listado de salas a las que está conectado el usuario con acceso con 1 clic, formulario para unirse a nueva sala con código de invitación y Character Vault.
- Modo Keeper: Listado de salas creadas por el Keeper para abrirlas o gestionarlas directamente, y formulario de creación de nueva sala/campaña con nombre.
- Autenticación Segura sin Transición Prematura: Bloqueo de inputs e indicador de progreso ("Verificando credenciales...") mientras se procesa el login; no transiciona al VTT hasta que Firebase Auth confirme la identidad.
- Visualización de Identidad: Encabezado con chips permanentes del usuario (displayName) y correo electrónico (email) conectado.

### Subtítulos Cinematográficos en Overlay

- Módulo #vf-subtitle-overlay que proyecta mensajes y descripciones en la parte inferior de la pantalla de forma no intrusiva (anclado a bottom: 74px), sin tapar controles tácticos ni HUD.

### Tokens Multicolores y Personalización Coordinada

- Selector de color de token (token.color) integrado en la configuración del token con paleta táctica (Cian, Ámbar, Esmeralda, Púrpura, Rojo, Carmesí, etc.).
- El color seleccionado define de forma coordinada el borde y nombre del token en mapa, el texto del usuario en chat, el subtítulo en overlay y la caja de resultado de dados (.vf-callout-result-box y .vf-results).

### Precarga Táctica de Daño según Armas Equipadas

- Las armas equipadas en la ficha del token se vinculan directamente al calculador de daño táctico (diceRoller.js), precargando fórmula de daño, modificadores y botón directo 💥 Daño en la barra rápida.
- Tooltip canónico con nombre y regla oficial al pasar el ratón (mouse-over) sobre marcadores de estado y condiciones en el mapa y HUD.
- Marcadores de bloqueo de objetivo (target lock) sutiles y discretos con corchetes esquineros ultrafinos (1px).

### Umbrales de Daño Dinámicos según Armadura

- Integración de los Damage Thresholds (Major Threshold / Severe Threshold) y Armor Slots en todas las armaduras canónicas del Corebook y del suplemento Rust & Steel (Casas Solari, Volkov, Valerius, Joric, Amaranth, y especies Lithian, Chitinid, Synthet).
- Al equipar una armadura desde el inventario del token, se recalculan y actualizan automáticamente sus umbrales activos en combate (Major = Armor Major + Nivel; Severe = Armor Severe + Nivel) y sus ranuras de armadura (current y max).
- Cálculo de daño en combate ajustado con fidelidad matemática estricta: Menor (1 HP si Daño < Major), Mayor (2 HP si Major <= Daño < Severe), y Severo (3 HP + 1 HP por cada 10 puntos de Overkill si Daño >= Severe).
- El gasto de ranuras de armadura mitiga la severidad en 1 escalón exacto.

### Catálogo Canónico Integral de Armas, Aumentos y Módulos de Dron

- Ampliación completa del arsenal con Trait de atributo, tipo de daño (Físico, Energía, Vacío), notación de dados canónica, rangos tácticos oficiales (Melee, Close, Far, Very Far) y Burden.
- Incorporación de Aumentos canónicos con coste de ranura (1 Augment), coste de estrés (Stress Cost), beneficios tácticos automáticos (+1 Slot de armadura, +2 HP, +1 Evasión) y peajes/drawbacks oficiales.
- Incorporación de Módulos de Dron canónicos con ranuras requeridas y soporte para el módulo oficial Neural Network Control (0 ranuras) que otorga control multi-jugador simultáneo de drones.
- Actualización visual de la biblioteca de equipamiento (Equipment UI) con pestañas dedicadas y tarjetas técnicas adaptadas a cada tipo de ítem.

### Estados de Personaje y Campaña Canónicos

- Incorporación a las 18 condiciones tácticas de combate de los 6 Estados de Personaje y Campaña canónicos: Overwhelmed (Abrumado), Dying (Moribundo), Final (Estado Final), Long Bruise (Secuela Grave), Blurred (Desfase de Realidad) y Burned Out (Agotamiento Durmiente) con sus respectivos iconos SVG y reglas oficiales.
- Selector de condiciones reorganizado con secciones visuales claras para condiciones tácticas y estados de campaña.

### Gasto de Miedo (Fear) en Foco de Adversarios

- Al activar el Foco de Combate (Spotlight) en un Adversario o PNJ hostil, el Keeper consume obligatoriamente 1 punto de Miedo del Fear Tracker global.
- Si no hay Fear disponible (Fear = 0), el sistema bloquea la activación y notifica al Keeper.
- Los drones aliados y tokens de jugadores están exentos del consumo de Fear.
- Sincronización en tiempo real mediante FEAR_UPDATE y TOKEN_UPDATE por la red P2P/Firestore.

## [1.4.9] — 2026-11-12

Restauración del Diseño Visual Clásico del Callout 3D con Datos Reales y Jerarquía Estilizada

### Formato Visual Elegante sin Encabezados Redundantes

- Restauración de la estética visual clásica del callout flotante dorado de dados 3D (borde dorado translúcido con desenfoque de fondo y tipografía táctica de alta legibilidad).
- Supresión de encabezados de formulario repetitivos ("NOMBRE DEL JUGADOR:", "NOMBRE DEL TOKEN:", "HABILIDAD:", "RESULTADO:", "MODIFICADORES APLICADOS:").
- Jerarquía estilizada: Kicker superior dorado con el nombre de quien hace la tirada (ej. KEEPER o PEDRO); título un poco más grande con el nombre del personaje/adversario (+ habilidad si aplica); tipo de resultado destacado (Failure with Fear, Success with Hope, etc.) bien visible con resplandor cromático según Hope/Fear/Crítico; número enorme (38px) con desglose Dualidad (HOPE 3 < FEAR 8); y pie técnico con tipo de dado y modificadores reales.
- Soporte completo tanto en el panel de análisis 3D en pantalla (VFDice3D) como en la pila de notificaciones tácticas de tiradas.

## [1.4.8] — 2026-11-12

Entrada Libre de Jugadores sin Personaje Previo y Consolidación de Handover de Decisiones de Diseño

### Entrada Libre y Asignación Flexible de Tokens

- Eliminado el bloqueo obligatorio de personaje en el Hub de acceso: el jugador puede entrar a cualquier mesa o partida sin tener que crear ni seleccionar un operativo previamente.
- Eliminada la ventana emergente automática (popup de Reclamar personaje) al conectarse a una sesión en la red: el jugador entra de forma limpia y directa a la mesa.
- Soporte completo para asignación diferida por el Keeper: el jugador entra en modo espectador/jugador y recibe su token y controles en el momento en que el Keeper se lo asigna.
- Actualización visual del resumen de despliegue en el Hub para reflejar que la entrada sin personaje está lista y autorizada.

### Handover & Preservación de Decisiones de Diseño

- Creación del documento HANDOVER.md en la raíz del repositorio consolidando las 8 decisiones críticas de arquitectura y UX acordadas para evitar regresiones futuras.
- Vinculación obligatoria del Handover en AGENTS.md para garantizar que todos los agentes y desarrolladores consulten y respeten estas directrices sin excepción.

## [1.4.7] — 2026-11-12

Borrado Permanente de Salas por el Keeper, Expulsión Reactiva de Jugadores y Resolución de Error de Permisos

### Gestión y Borrado de Salas Persistentes

- Permite al Keeper dueño de una sala eliminarla permanentemente mediante un botón de peligro ("Eliminar") tanto desde la lista de "Salas que dirijo" como desde el panel de la sala activa.
- Cuadro de diálogo de confirmación previo para prevenir eliminaciones accidentales de campañas en la nube.
- Borrado integral en Firestore: eliminación del documento de sala, sus miembros, subcolecciones de fragmentos y guardados, invitación activa (roomInvites) y registro de usuario.
- Expulsión en tiempo real de los jugadores conectados: el listener reactivo detecta el borrado de la sala o la revocación del acceso, los desconecta limpiamente, limpia su sesión y muestra notificación explicativa.
- Actualización de firestore.rules para permitir al propietario el borrado seguro de sus salas (allow delete) y administración de miembros.

### Resiliencia y Corrección de Permisos Firestore

- Eliminación de la rotación automática forzada en segundo plano de códigos de invitación en refresh() y enterRoom() que provocaba permission-denied cuando las reglas remotas de Firestore aún no se habían publicado.
- Preservación del acceso y estado online para salas existentes con códigos legacy sin interrumpir la sesión del Keeper.
- Limpieza automática de lastError en refrescos de sala para evitar que mensajes de error transitorios queden fijos en pantalla.

## [1.4.6] — 2026-11-12

Callout Dorado Estructurado, Ficha Condensada sin Scroll, Códigos de Invitación Breves y Herramienta Unificada de Dibujo

### Callout Dorado de Dados 3D

- Sustitución completa del texto genérico por información estructurada y fiel: Nombre del jugador, Nombre del token, Habilidad (si aplica), Resultado (con total y estado Duality) y Modificadores aplicados.
- Eliminación total de los rótulos TACTICAL SOLUTION y telemetría ficticia VECTOR TELEMETRY LOCKED.
- Paso explícito de metadatos de jugador, token, habilidad y modificadores en todas las fuentes de tirada (DiceRoller, VttDiceSync, DiceEngine3D y KeeperHud).

### Ficha de Personaje Ultra Condensada

- Rediseño compacto del modal de ficha (Dossier): reducción drástica de espaciados, hero compacto de 44px, inputs optimizados de 28px y área de notas estilizada.
- Pie de ficha sticky fijado en la parte inferior de la ventana para que el botón "Guardar ficha" esté siempre visible sin necesidad de hacer scroll.
- Botón de guardado rápido directo añadido en la barra superior de pestañas del dossier.

### Invitaciones y Mesas Persistentes

- Generación de códigos de invitación cortos y legibles con formato de 3 letras de la sala + guion + 5 caracteres aleatorios (ej. NAV-33F44).
- Auto-migración transparente de códigos heredados largos al nuevo formato breve al abrir o entrar a la sala como Keeper.

### Herramientas de Mesa

- Unificación de Dibujar y Borrar en un único botón en la barra lateral de herramientas con selector de modo integrado en su panel emergente y atajos de teclado [B / D].

## [1.4.5] — 2026-11-12

Inicialización Centralizada y Resiliente de Firebase Auth y Realtime Database

### Conectividad y Autenticación en la Nube

- Centralización de la inicialización de Firebase App, Auth y Realtime Database en un cliente unificado (firebaseClient.js) para evitar errores app/no-app.
- Sustitución de accesos dinámicos a variables de entorno por propiedades estáticas de Vite con configuración de respaldo pública garantizada.
- Mensajes de autenticación amigables en español para credenciales incorrectas, contraseñas cortas, ventanas emergentes bloqueadas y cuentas existentes.
- Vínculo inmediato del Vault de personajes, HUD de Jugador, consola del Keeper y sincronización de dados con Firebase Realtime Database.

## [1.4.4] — 2026-11-12

Terminal Táctico AAA: Hub de Operativos Rediseñado, Flujo de Logout y Precarga de Dados 3D

### Hub de Operativos y Portal AAA

- Rediseño premium con calidad de estudio AAA de la pantalla del Hub táctico, tipografías Orbitron/Rajdhani y ambientación Sci-Fi Pearl Era.
- Character Vault estilizado: tarjetas tácticas de operativo con avatar holográfico, indicadores de estado [ACTIVO], micropips para HP, Stress, Hope, Armour Shields y Slots de mejora.
- Panel de despliegue con frecuencias de sala rápidas y diagnóstico de enlace cuántico en tiempo real.
- Creador de personajes reestructurado en tres secciones tácticas con matriz Duality 2d12 de atributos y blindaje exotáctico.

### Ciclo de Acceso y Sesión

- Carga inmediata del portal en el arranque sin destellos previos del mapa ni de la mesa de juego.
- Flujo de retorno al portal de login automático y coherente tras cualquier cierre de sesión (botón de desconexión del Hub, menú de cuenta de la mesa o desautenticación remota).
- Precarga y precalentamiento en segundo plano del motor 3D de dados, física WASM y audio mientras el usuario interactúa con la pantalla de acceso.

## [1.4.3] — 2026-11-12

Diseño Táctico del Portal de Acceso y Modo Local / Invitado

### Portal y Acceso

- Rediseño completo de la interfaz de login del portal con estética Sci-Fi/Cyberpunk, fondo con cuadrícula táctica, glassmorphism y controles integrados.
- Botón directo para entrar como Invitado / Modo Local y botón de cierre rápido para acceder al VTT de inmediato sin requerir cuenta.
- Información contextual amigable en modo local si la autenticación remota no está configurada, sin mensajes de error invasivos.
- Soporte completo de estilos CSS para inputs con iconos, botones con gradientes cian, selector de Google y bóveda de personajes.
- Optimización Canvas2D con willReadFrequently para renderizado acelerado de la niebla de exploración y corrección de metadatos móviles.

## [1.4.2] — 2026-11-11

Callout de Tiradas Estructurado y Limpieza de Interfaz

### Callouts de Tiradas

- Formato estructurado en cada tarjeta de resultado con 4 campos explícitos: Nombre del jugador, Nombre del token, Resultado y Modificadores aplicados.
- Sincronización de identificadores de jugador y token en tiradas de acción, comprobaciones Duality y dados rápidos del Keeper.
- Eliminación completa del badge redundante de "FEAR EN MESA" sobre la cabecera de sesión.

## [1.4.1] — 2026-11-11

Veilfarers Suite: Dados 3D Optimizados, Callouts Remotos, Asignación Múltiple y HUD Movible

### Dados 3D y Notificaciones de Tirada

- Los dados 3D se animan exclusivamente en la pantalla del jugador que realiza la tirada. El resto de la mesa recibe un callout visual con el resultado.
- Callouts apilables e independientes: muestran el nombre del token, el resultado total y el desglose de modificadores aplicados, permitiendo ver múltiples tiradas simultáneas.
- Privacidad de tiradas del Keeper: las tiradas ocultas no se notifican a los jugadores y quedan claramente identificadas en la consola del Director.
- Física 3D calibrada: gravedad realista (3.6), fricción (0.95) y restitución reducida (0.12) para que los dados aterricen planos y firmes en sus caras.
- Resolución del bloqueo entre tiradas sucesivas y supresión de la tirada duplicada involuntaria de Hope & Fear al rodar dados estándar.

### Asignación de Tokens y Drones

- Un jugador puede tener asignados varios tokens a la vez sin que una nueva asignación desasigne sus fichas anteriores.
- Los drones compartidos admiten varios jugadores controladores simultáneos seleccionables por casillas de verificación.

### Consola del Keeper y Experiencia de Usuario

- Consola flotante del Keeper: elemento movible mediante arrastre que no obstruye la barra de sesión superior y puede minimizarse a un icono compacto ⚡ con contador de Fear.
- Panel de ataque y daño simplificado: precarga el arma y el objetivo directamente desde la ficha, dejando los detalles manuales comprimidos en un panel desplegable.
- Barra de dados poliédricos y texturas ajustada a dos filas para evitar cualquier desbordamiento horizontal en el panel lateral.
- Código de invitación corto: 3 caracteres basados en el nombre de la sala y 5 caracteres aleatorios (ej. EST-8K2MF).
- Resiliencia ante actualizaciones de chunks en despliegues y previsualizaciones de Netlify con recarga automática ante discrepancias de hash.

## [1.4.0] — 2026-11-11

Salas persistentes, reconexión y edición táctica

### Salas y conexión

- SESIONES separa las salas que diriges y aquellas en las que participas. La pertenencia y el control de los tokens quedan ligados a la cuenta de Firebase, no al nombre ni a una pestaña.
- Invitación única por sala. El Keeper puede regenerarla sin retirar a los miembros existentes, expulsar y readmitir jugadores, asignar tokens y enviar anuncios. Un personaje por jugador; los drones conservan sus controles compartidos.
- Campaña, arcos, escenas, recursos y asignaciones se guardan en Firestore. Los movimientos se confirman después de guardar. Volver a abrir una sala recupera el guardado existente.
- Los jugadores permanecen dentro si el Keeper pierde la conexión: las acciones se bloquean y se reanudan al regresar el propietario. Un cierre inesperado se detecta al caducar la presencia del servidor, en unos 20 segundos.
- Canales privados y ordenados por conexión, recuperación automática, bloqueo de conexiones antiguas y protección frente a dos Keepers simultáneos. Se mantienen los filtros de información privada.
- Las actualizaciones omiten las secciones sin cambios y el guardado reutiliza fragmentos inmutables de imágenes. El modo LAN y las campañas locales siguen disponibles. Las salas online requieren publicar las nuevas reglas de Firestore.

### Dibujo y portapapeles

- Dibujo libre con paleta visual propia y tres grosores: fino, medio y grueso. Los trazos se guardan en cada escena y se comparten con la sala.
- El borrador elimina exclusivamente trazos completos de dibujo libre. Los jugadores editan sus propios trazos; el Keeper puede borrar cualquiera. Cambiar de herramienta, escena o conexión cancela el trazo pendiente.
- Ctrl+C y Ctrl+V (Cmd en macOS) copian y pegan el elemento seleccionado: tokens, paredes, luces, agua, anomalías, dibujos y plantillas. Las copias reciben identificadores nuevos y los tokens duplicados no heredan jugadores asignados.
- Los jugadores solo duplican sus dibujos. El portapapeles respeta campos de texto, capas bloqueadas, cambios de campaña y salas en pausa. Los trazos se dibujan debajo de la niebla de guerra.

### Verificación

- Pruebas con el emulador real de Firestore: permisos entre cuentas, invitaciones, expulsión, canales privados, pérdida de red, reconexión, movimientos confirmados y campañas mayores de 1 MB.
- Pruebas del dibujo, borrador, portapapeles y conservación de los elementos originales. Guía de actualización y comprobaciones manuales incluidas.

## [1.3.1] — 2026-11-10

Persistencia del acceso, telemetría de escena y optimización compacta de paneles

### Inicio de sesión y preferencias

- Session y Sesiones se agrupan en un único acceso SESIONES, con secciones de partida/tripulación y archivo guardado. La cuenta aparece arriba a la derecha: usuario y piloto verde al iniciar sesión, Offline y piloto rojo al salir.
- Restauración de Netlify Identity tanto si el widget ya terminó de iniciarse como si carga después. Firebase y Netlify mantienen estados independientes y se recuerda el proveedor elegido.
- Google aplica explícitamente la opción de mantener la sesión, tanto en ventana emergente como en redirección. Cancelar un acceso no inicia otro proveedor automáticamente.
- El cierre de sesión limpia sus listeners temporales. Las preferencias se aíslan por cuenta y una respuesta antigua no puede reasignar el personaje ni sobrescribir los ajustes del Keeper.
- Guardado seguro de preferencias y parámetros de usuario: soporte para esquemas extendidos (fogOfWar, opacidad de niebla, modos de ajuste a rejilla) con almacenamiento local inmediato y fallback resiliente ante restricciones de permisos en Firestore.

### Movimiento y recursos

- El arrastre usa una vista provisional separada del token confirmado: las actualizaciones del Keeper conservan la posición bajo el cursor y las estadísticas más recientes.
- Los cambios del jugador se identifican y confirman en orden. Una instantánea anterior no deshace el último movimiento ni los clics rápidos de HP, Armor, Stress o Hope/Effort.
- Se elimina el envío duplicado desde la barra de recursos; el foco del token se sincroniza sin permitir cambiar la configuración de su luz.
- Rechazos y tiempos de espera muestran un aviso y recuperan el último estado confirmado. Cambiar de escena, retirar permisos o mover el token desde el Keeper cancela arrastres obsoletos.
- La visión, las luces y la exploración usan posiciones confirmadas por el Keeper, incluso mientras un movimiento espera respuesta. El modo Player de previsualización del anfitrión no bloquea los movimientos de sus jugadores.

### Telemetría de escena y distribución compacta de paneles

- Corrección integral de la telemetría de sincronización de escena: el anfitrión indexa el estado de carga por identificador de miembro, peer y nombre, emitiendo eventos reactivos que actualizan de inmediato las píldoras de tripulación a 100% ✅ y eliminan estados falsos de 0% o pendiente.
- Transmisión proactiva de telemetría: los clientes notifican inmediatamente su estado de carga al Keeper al conectarse o recibir la escena inicial, incluso cuando el mapa ya se encuentra precargado en la memoria local.
- Dossier de estado de escena reactivo y completo: actualización automática en vivo ante cambios de carga y visualización de la fila del Keeper para clientes conectados.
- Ampliación del límite de tamaño de mapas tácticos: se eleva el límite máximo de subida de 20 MB a 50 MB en almacenamiento local/servidor y hasta 100 MB al utilizar Cloudinary con compresión WebP/AVIF.
- Consola de chat táctico compacta y libre de scroll exterior: contenedor flex con mensajes scrollables internamente, selector de canal de bajo perfil y compositor de entrada condensado.
- Panel de vista previa de token (Token HUD) comprimido verticalmente en más de un 70%, agrupando acciones en cuadrícula compacta y disponiendo la telemetría vital en una sola fila ágil.
- Navegación por pestañas laterales (DICE, CLOCKS, SHIP, ROSTER, SCENES, DOSSIERS, LOG, CHAT) optimizada en una sola fila sin desbordamiento.

### Modo Observador y asignación de tokens

- Tercera opción al unirse a la partida: «Unirse como Observador». El jugador puede conectarse a la sesión sin verse forzado a reclamar o importar un personaje de inmediato.
- La opción de observador está disponible tanto en el formulario de acceso a la sesión como en el modal de reclamación de personaje (Opción C).
- El Director de Juego (Keeper) puede asignar cualquier token a un observador desde el lobby o el panel de asignación; la transición es fluida e inmediata, centrando la vista en el token y activando sus controles tácticos.
- Indicador interactivo en la barra superior «👁️ Observador», que permite al usuario seguir la partida en tiempo real y reclamar o importar un personaje si cambia de opinión.

### Foco táctico exclusivo, códigos simplificados y renderizado optimizado

- Regla canónica de foco exclusivo: solo un token puede tener el foco activado a la vez en todo el mapa táctico; al encenderlo en un token se apaga automáticamente en los demás.
- Coste de activación de foco en adversarios: otorgar el foco a un adversario le cuesta 1 punto de Miedo (Fear) al Director de Juego (Keeper). Si el Keeper cuenta con 0 Fear, la activación se bloquea y emite un aviso explicativo.
- Códigos de invitación ultracompactos: el código de sala pasa de ser una cadena de más de 40 caracteres a un formato conciso de 3 caracteres del nombre de campaña + guion + 5 caracteres alfanuméricos (ej. USC-K89FA).
- Frustum culling en capa de mapa táctico: el motor gráfico calcula el viewport visible según zoom y traslación para rasterizar únicamente el rectángulo de escena que entra en pantalla, optimizando radicalmente el rendimiento en mapas de ultra-alta resolución (4K/8K).
- Compresión adaptativa cliente para Cloudinary: las imágenes superiores a 9.5 MB se escalan y transcodifican fluidamente a WebP en el navegador, asegurando compatibilidad con el límite de 10 MB del nivel gratuito y admitiendo archivos de hasta 100 MB.
- Base de datos de escenas en Firebase con componentes completos: guardado automático en Firebase Firestore de cada escena creada con sus muros, luces, efectos, agua, fichas asignadas y notas de Keeper, sin depender de la caché del navegador.
- Menú superior en una sola línea compacta: reducción de altura a 46px (~50% del tamaño anterior), integrando la barra de sesión y el medidor de miedo en una única fila horizontal continua sin barras secundarias.
- Sesiones persistentes y reconexión automática tras refresco (F5): el Keeper y los jugadores retienen su sesión, sala y tokens asignados ante recargas accidentales sin requerir reconectar manualmente.
- Historial de invitaciones recientes en el lobby: lista de partidas guardadas con acceso directo de 1 clic para volver a unirse.
- Enrutamiento de telemetría insensible a mayúsculas/minúsculas: corrección de coincidencia de sala para que las actualizaciones MAP_LOAD_STATUS del cliente lleguen sin pérdidas al Keeper.

## [1.3.0] — 2026-11-10

Catálogo de equipo alienígena, drones tácticos, mitigación con escudos, spotlight cenital y niebla autoritaria

### Equipo y Aumentos Alienígenas (Core + Rust & Steel)

- Catálogo canónico completo de armamento, armaduras, equipo tecnológico y aumentos ciberbiológicos extraídos del Corebook y las especies alienígenas de Rust & Steel (Lithian, Chitinid, Synthet, Voidborn).
- Filtros interactivos por origen (Todos, Core, Rust & Steel) y categoría (Armas, Armaduras, Equipo, Aumentos), permitiendo a los jugadores equipar cualquier combinación a sus personajes.
- Integración directa con el dossier del personaje y el inventario del token, con previsualización de propiedades, daño, alcance y notas de reglas.

### Drones Tácticos y Despliegue

- Sistema dedicado de creación y despliegue de drones desde el Roster Táctico, con presets especializados: Scout (alta velocidad, sensor range), Combat (armadura reforzada y armamento ligero), Medical (módulos de socorro), Utility y Custom.
- Campo de visión (FOV) estándar estandarizado en 90º cónico con visión frontal direccional.
- Permisos de control compartido para tripulantes y foco cenital activado por defecto.

### Edición Rápida en Token HUD Preview

- Controles incrementales (+ / -) directamente integrados en la ventana de vista previa (TokenHUD) para HP, Escudos/Armor, Stress y Hope/Effort.
- Permite a los dueños de tokens y al Keeper modificar estadísticas vitales al vuelo durante el combate sin necesidad de abrir la ficha completa ni interrumpir el flujo táctico.
- Botón de conmutación rápida para foco cenital (🔦 FOCO) en el TokenHUD.

### Ejecución de Daño por Jugadores y Mitigación con Escudos

- Permiso habilitado para que los jugadores puedan ejecutar el daño calculado sobre su objetivo seleccionado.
- Mecanismo de mitigación interactiva con escudos: cuando un token recibe daño, el portador puede gastar uno o varios escudos disponibles para absorber el impacto antes de que se reste el HP y se ejecute la animación de impacto.
- Integración completa con las reglas de daño directo (que ignora escudos) y efectos de ataque acordes a los escudos consumidos.

### Spotlight Táctico — Borde Dorado Brillante con Pulso de Luz

- Rediseño compacto y elegante del foco táctico (Spotlight): se sustituyen el haz cenital y charco volumétrico de gran tamaño por un borde dorado brillante perimetral alrededor del token.
- Emisión de un breve pulso de luz periódico (onda dorada radiante) que se expande suavemente alrededor del borde del token sin ocupar espacio excesivo ni solapar elementos adyacentes del mapa.
- Anillo dorado con destello metálico, resplandor áureo dinámico, reflejo especular en el avatar y botón de alternancia rápida (✨ FOCO) en el Token HUD.

### Niebla de Guerra Persistente y Autoritaria

- Autoridad centralizada en el Keeper para la exploración de niebla de guerra por escena, persistida en la campaña mediante máscaras de bits comprimidas.
- Las acciones de "Reiniciar niebla" y "Revelar todo" actualizan la campaña y se sincronizan instantáneamente a todos los jugadores mediante el mensaje de red FOG_SYNC.
- Persistencia total ante recargas de página, reconexiones tardías y suspensiones de pestañas en navegadores móviles.

### Autenticación en la Nube y Compatibilidad Multiplataforma

- Resolución del error EBADPLATFORM en Netlify (Linux): eliminado @rollup/rollup-win32-x64-msvc de las dependencias directas para que Rollup resuelva dinámicamente el binario nativo según el sistema operativo del entorno de despliegue.
- Corrección del cierre inmediato del popup de Google: soporte de redirección directa (signInWithRedirect) que evita bloqueos de popups y políticas de aislamiento de origen (COOP), con reanudación automática de sesión vía getRedirectResult al recargar.
- Integración completa de Netlify Identity: widget integrado en el encabezado, detección y persistencia automática de sesión, y botón dedicado en el modal de cuenta con fallback inmediato si falla el popup.

### Respaldo de Campaña y Lanzadores Locales

- Copia de seguridad automática rotativa (auto-backup) en almacenamiento local durante cada guardado de campaña.
- Aviso modal proactivo de recordatorio de exportación JSON para testers alpha.
- Reparación de scripts de inicio por lotes (.bat) y script de instalación local en Windows invocando npm.cmd para evitar bloqueos por ExecutionPolicy de PowerShell.

## [1.2.0] — 2026-11-10

Entornos de dos capas, bosses por estados e impactos de combate

### Escenarios · Keeper, capítulos 9 y 10

- Los antiguos preajustes visuales se sustituyen por 15 macroentornos y 24 microentornos del Keeper 12.06. La escena usa todas las características del micro y exactamente una Passive o Action del macro.
- Tier, DC y escalado impreso, texto de referencia y configuración guardada por mapa. Las activaciones pagan únicamente el Fear indicado; las reacciones exigen confirmar su disparador. Meltdown crea su reloj visible de 6 segmentos.
- El Keeper resuelve las tiradas, objetivos y consecuencias del texto. Puede acompañar la activación con un efecto visual; iluminación, lluvia y bruma siguen teniendo sus controles independientes.

### Bosses por estados

- Editor para adversarios con 2–8 estados y 17 perfiles del Bestiary of Phases. Disparadores por HP, porcentaje, Armor, reloj u objetivo; reservas nuevas o conservación de HP, estadísticas, habilidades y narración por estado.
- La transición concede 2 Fear o 3 al entrar en la fase final, con máximo 12. Se respetan las excepciones impresas de Spotlight y limpieza de condiciones. Los valores no impresos se heredan de la ficha base y se pueden ajustar.
- Indicador de fase sobre el token y objetivos finales confirmados por el Keeper. Las fases pendientes no muestran prematuramente la calavera de derrota; los jugadores reciben solo el estado público actual.

### Impactos y fuego

- Trayectoria e impacto al aplicar daño: metralla balística, plasma para láser/plasma, fuego, cristales de congelación y explosión con núcleo, humo y onda de presión. Escudo solo cuando se consume Armor al mitigar, nunca por daño directo.
- Diámetro según HP realmente perdidos: 1 HP = 50% del token, 2 HP = 100%, +20% por cada HP adicional, máximo 200%. La animación no modifica las reglas ni aplica condiciones por sí sola.
- Área de fuego continua con brasas, llamas y pavesas recortadas al círculo, línea o polígono. Presupuesto visual, reducción de movimiento y laboratorio local para comparar efectos.

### Organización y guardado

- Cada escena puede trasladarse a cualquier arco o quedar sin arco desde su selector de destino. Las escenas independientes también permiten activar el mapa y configurar su entorno.
- Los arcos se incluyen ahora en guardado, exportación, importación y sincronización de campaña. La versión y esta guía aparecen en AYUDA.

## [1.1.1] — 2026-11-10

Overlay de lluvia cinemática, niebla táctica, restricciones de muros, doble toque móvil y onboarding multijugador

### Clima y Efectos Atmosféricos

- Overlay de lluvia cinemática a pantalla completa conservado y perfeccionado: paralaje multicapa, viento dinámico, salpicaduras en terreno e iluminación ambiental de tormenta.
- Ondas procedurales sobre el agua (drawRainRipples) perfectamente integradas y recortadas por el contorno del agua, incluidos polígonos cóncavos.
- Controles directos de lluvia y niebla en el panel de Capas Tácticas y en el inspector de elementos acuáticos, con niveles de llovizna, lluvia y tormenta.

### Niebla de Guerra y Visión Táctica

- Zonas inexploradas en oscuridad absoluta (100%): Muros, puertas, ventanas, fuentes de luz y tokens enemigos permanecen completamente ocultos para los jugadores hasta ser descubiertos por línea de visión.
- Atenuación explorada configurable: Las zonas ya visitadas fuera del campo visual actual se muestran atenuadas al 50% por defecto (ajustable de 10% a 90% desde el menú de Niebla de Combate). Las luces en zonas visitadas recortan la niebla al 100% sin atenuación.
- Detección y memoria de enemigos en la niebla (Ghosting): Los movimientos de enemigos en la niebla no se actualizan en tiempo real; se muestra su última posición conocida con radar ámbar hasta que un jugador descubra nuevamente la zona.
- Diferenciación integral de nieblas: Separación clara e inequívoca en la interfaz entre la Niebla de Combate táctica (Fog of War) y la Bruma Ambiental de clima (Overlay Weather).
- Prioridad absoluta de tokens: Al pulsar en cualquier punto del mapa, los tokens tienen la máxima preferencia de selección sobre cualquier pared, luz, agua, anomalía o plantilla.
- Línea de visión táctica (LOS) y telemetría de ataque: Al seleccionar un objetivo, se traza un rayo láser táctico, retícula crosshair y cálculo de distancia en tiempo real (metros y casillas), señalando si la línea de tiro está despejada o bloqueada por muros.
- Efectos especiales de ataque y explosión proporcional: Simulación de disparo según el arma (láser, plasma, arco voltaico, balística, cuerpo a cuerpo, vacío) y explosión en impacto con tamaño e intensidad directamente proporcionales al daño infligido.
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

### Gestión de Tokens y Banco de Reserva

- Banco de Reserva de Operativos: Posibilidad de retirar tokens del mapa activo hacia una reserva protegida preservando sus estadísticas, armadura, estados e inventario sin borrarlos.
- Atajos en lienzo táctico: Pulsar [Supr] o [Backspace] con un token seleccionado lo envía inmediatamente a la reserva; pulsar [Shift + Supr] permite eliminarlo definitivamente de la campaña.
- Sección dedicada en Roster Táctico: Pestaña con tokens en reserva, distintivo ámbar, botón de despliegue rápido [🚀] al centro del mapa actual y acceso directo a su ficha holográfica.
- Controles rápidos: Botón [📦 RESERVA] en la barra rápida inferior TokenHUD y en la fila de acciones del dossier.
- Reclamación inteligente: Si un jugador nuevo reclama un personaje almacenado en la reserva, el sistema lo despliega automáticamente en la escena y centra la cámara sobre él.

### Barra de Carga de Escenas y Telemetría Multijugador

- Barra de carga holográfica en lienzo: Indicador de progreso neón durante la descarga y decodificación de mapas pesados, mostrando bytes transferidos en tiempo real (MB/MB) y porcentaje.
- Telemetría de jugadores P2P: Mensaje MAP_LOAD_STATUS que sincroniza el progreso y finalización de carga de cada miembro de la tripulación en tiempo real.
- Indicador de sincronización en barra superior: Botón interactivo con estado global de la escena (100% listos o progreso mínimo) y micro-indicadores en las píldoras de tripulación.
- Dossier de estado de escena: Ventana holográfica para el Director de Juego con barras individuales por participante para confirmar que todos tienen el mapa cargado antes de iniciar el combate.

### Almacenamiento y Optimización Cloudinary

- Integración de Cloudinary Unsigned: Subida directa de imágenes de mapas desde el navegador sin necesidad de servidor backend.
- Optimización automática WebP/AVIF: Entrega en CDN global con compresión inteligente f_auto,q_auto reduciendo el ancho de banda y tiempos de carga entre 70% y 85%.
- Soporte en Creador de Escenas y Drag & Drop: Opción de subida con Cloudinary al crear una escena o arrastrar mapas directamente sobre el lienzo táctico.
- Modo dual y fallback: Compatibilidad total con Netlify/Vite y fallback transparente a almacenamiento local si se opera offline o sin credenciales.

### Moderación y Control de Sesión

- Expulsión de jugadores por el Keeper: El Director de Juego puede expulsar a cualquier jugador conectado tanto desde el listado del Lobby de Sesión como desde las píldoras de tripulación en vivo mediante un botón de acción rápida.
- Confirmación de seguridad: Diálogo interactivo de confirmación antes de aplicar la expulsión para evitar clics accidentales.
- Desconexión y revocación inmediata: Al expulsar a un jugador, su conexión WebRTC/P2P se cierra al instante, se desasignan y liberan todos los personajes y drones bajo su control, y se elimina de la lista de miembros de la partida.
- Prevención de reconexión: La sesión registra al jugador en una lista de bloqueo en memoria durante la partida, impidiendo reconexiones automáticas o manuales mediante token de reanudación.
- Notificación holográfica al jugador: El usuario expulsado recibe una alerta clara indicando la terminación del enlace neural sin afectar a sus campañas ni personajes guardados localmente.

### Despliegue y Configuración Netlify

- Protección de secretos y variables de entorno: Eliminado archivo .env del repositorio e incorporado a .gitignore; .env.example utiliza placeholders neutrales.
- Configuración netlify.toml: Definida regla SECRETS_SCAN_OMIT_KEYS para permitir variables públicas del cliente (Firebase y Cloudinary) y omisión de .env.example en el escaneo de secretos.
- Redirecciones SPA: Configurada redirección automática /* -> /index.html en Netlify para garantizar soporte de enlaces mágicos y parámetros de sala sin errores 404.

### Arcos de Campaña, Eliminación de Escenas y Entornos

- Eliminación de escenas: El Keeper puede eliminar escenas tácticas con confirmación de seguridad; los personajes activos se transfieren automáticamente a otra escena disponible y se protege contra el borrado de la última escena.
- Sistema de Arcos Narrativos: Agrupación de escenas por arcos de campaña, reordenación con botones interactivos arriba/abajo, selector para mover escenas entre arcos, y creación/eliminación de arcos con preservación de escenas.
- Recursos de Arco: Galería de imágenes tácticas y fichas asociadas a cada arco con subida directa a Cloudinary.
- Preajustes de Entorno del Sistema: Modos rápidos de 1 clic para configurar la escena activa (Derrelicto Espacial, Tormenta Planetaria, Bruma Tensa, Brecha Abisal e Instalación de Alta Seguridad).
- FOV Estándar de 90º: Cono de visión táctica establecido en 90º como estándar para todos los tokens de Veilfarers, conservando ajuste omnidireccional o focalizado en la ficha.
- Indicador de Baja (HP <= 0): Cuando los puntos de vida de un token caen a cero, el avatar se sustituye automáticamente por una calavera y huesos cruzados (☠️) con resplandor carmesí y distintivo de baja.
- Almacenamiento Cloudinary con prefijos: Subida de imágenes de Dossier con prefijo Dossier_ y avatares de tokens con prefijo Token_.
- Autenticación Netlify Identity con Google: Soporte directo de inicio de sesión con cuentas de Google mediante Netlify Identity Widget o Firebase Auth, protegiendo todos los parámetros del usuario frente a errores de lectura nula.

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
