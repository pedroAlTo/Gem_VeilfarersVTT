// Keep published entries unchanged. Prepend a new entry when package.json changes.
export const RELEASES = [
  {
    version: '2.34.0', date: '2026-11-22', title: 'V3 · Mejoras con números y modificadores de tirada',
    sections: [
      { title: 'Mejoras activas', items: [
        'Kinetic Barrier: mientras dura, +1 Evasion, resistencia a daño Physical y una barrera que absorbe hasta 10 de daño. En la ventana de daño aparece ya elegida; cuando se gasta, se disipa.',
        'Velocity Surge: si sale la tirada, +2 a las tiradas de Agility durante la escena.',
        'Aura of Clarity: si sale, tú y los aliados a alcance Close sumáis +1 a los umbrales de daño y sois inmunes a Frightened y Dazed.',
        'Protective Dome: si sale, quien está en la zona Very Close gana +2 Evasion.',
        'Eyes of Truth y Temporal Cloak dan su Ventaja contextual (Instinct para percibir; Agility para no ser detectado) en el panel de dados.',
      ] },
      { title: 'Para la próxima tirada', items: [
        'Silver Tongue: la próxima tirada de Presence suma tu Tier y un 11 en el dado de Hope cuenta como 12.',
        'Vector Calculus: la próxima tirada de Agility o Finesse suma tu nivel y un 10 o menos en el dado de Hope cuenta como 11.',
      ] },
    ],
  },
  {
    version: '2.33.0', date: '2026-11-22', title: 'V3 · Reacciones en el ataque y en la ventana de daño',
    sections: [
      { title: 'Al atacar', items: [
        'Tactical Overwatch: cuando un adversario ataca a un personaje, si un aliado a alcance Close la tiene en su Loadout y 1 Hope, el Keeper ve el aviso. Si la usa, el ataque se tira con Desventaja y el objetivo gana 2 Armor Slots temporales hasta el próximo Spotlight de quien la usó.',
        'Force Shield: si el ataque impacta pero +3 de Evasion lo haría fallar, se ofrece al objetivo o a un aliado a Very Close. Si la usa, el ataque falla y se prepara el daño de vuelta, (Proficiency)d4 Physical (Kinetic), contra el atacante.',
      ] },
      { title: 'En la ventana de daño', items: [
        'La ventana del Keeper tiene «Reacción»: Photon Shield (un aliado a Close resta su Tier + 2, el doble contra criaturas Veil-Touched), Impact Absorption (−(Proficiency)d6 + 2 al daño Physical) o Mind Shield (−(Proficiency)d6 al Neural). Cada opción muestra el HP final con sus escudos, y al aplicarla se cobra su coste.',
        'Impact Absorption guarda lo absorbido: el próximo ataque de ese personaje lo suma al daño.',
        'Solo aparecen las reacciones que el personaje tiene en el Loadout y puede pagar, y a su alcance.',
      ] },
    ],
  },
  {
    version: '2.32.0', date: '2026-11-22', title: 'V3 · Poderes de área y resolución automática (niveles 1-3)',
    sections: [
      { title: 'Áreas', items: [
        'Los Poderes que afectan a «todos los enemigos/aliados a alcance X» dibujan su círculo en el mapa alrededor de quien los lanza, visible para todos mientras la carta está abierta, y eligen solos a quien está dentro.',
        'Si la carta pide una tirada de reacción (Blinding Flash: Instinct contra DC 10), cada objetivo la tiene pendiente; el Keeper puede tirar las de todos los adversarios a la vez. Quien falla recibe lo que dice la carta: Desventaja en su próximo ataque (se gasta al atacar) o el estado impreso.',
        'Inspiring Presence da +2 a la próxima tirada de cada aliado del área.',
      ] },
      { title: 'Poderes con objetivo y efectos', items: [
        'Stellar Lance, Biological Scan, Mind-Slip, Emotional Manipulation y Symbiotic Bond piden un objetivo a su alcance, como un ataque. Stellar Lance, si sale la tirada, prepara su daño (Proficiency×d8 Energy, Radiant) para que el Keeper lo decida.',
        'Kinetic Blast (con Empower de hasta 2 Hope más) carga el próximo ataque cuerpo a cuerpo: al impactar suma Strength + 1d8 y (Proficiency)d6 por cada Hope de Empower.',
        'Biological Scan muestra al momento el HP, el Stress y los estados del objetivo.',
        'Temporal Cloak · Personal deja Hidden a quien lo lanza (también con Uncanny Power, si la tirada sale). Termina si ataca o usa otro Poder Void.',
      ] },
    ],
  },
  {
    version: '2.31.2', date: '2026-11-22', title: 'V3 · Archivo de personajes importados y creador sin pérdidas',
    sections: [
      { title: 'Mystic Sleeping', items: [
        'Un Mystic Sleeping importado sin Dominios (o con la clase en español, «Místico») se reconoce y puede empezar su Archivo desde el mazo o desde la ficha.',
        'La ventana de Uncanny Power tiene un botón «Gestionar el Archivo» que abre el mazo con el Archivo, también cuando está vacío.',
      ] },
      { title: 'Creador de personajes', items: [
        'Desde el lobby (antes de entrar en una sala) el creador ya no ofrece «Crear y poner en la mesa»: esa mesa se sustituía al entrar en la sala y el personaje se perdía. Allí se guarda en la cuenta o se descarga la ficha, y se lleva a la mesa al entrar.',
        'Un personaje que la nube no acepta y queda guardado solo en este navegador ya no desaparece de la biblioteca al volver a leerla: sigue en la lista hasta que la nube tenga una copia.',
      ] },
    ],
  },
  {
    version: '2.31.1', date: '2026-11-22', title: 'V3 · Archivo del Mystic Sleeping y Spellcast automático',
    sections: [
      { title: 'Archivo de Uncanny', items: [
        'El mazo y la pestaña Loadout de la ficha del Mystic Sleeping tienen su Archivo: los Dominios desbloqueados (Dominio + nivel) con sus Poderes, y un selector de Dominio y nivel para añadir uno o quitarlo.',
        'Se aplican las reglas del Corebook: el nivel no puede superar el del personaje, y para investigar un nivel hacen falta dos Dominios distintos en el nivel anterior. Los Dominios elegidos al crear el personaje aparecen y se pueden corregir.',
      ] },
      { title: 'Uncanny Power', items: [
        'Al pulsar Manifestar se tira enseguida el Spellcast: dados de Dualidad + Knowledge contra DC 10 + nivel del Poder. Si se supera, el Poder queda listo para resolverse en la mesa.',
      ] },
    ],
  },
  {
    version: '2.31.0', date: '2026-11-22', title: 'V3 · Uncanny Power del Mystic Sleeping, como dice el Corebook',
    sections: [
      { title: 'Uncanny Power', items: [
        'Al tocar un Poder del Archivo (o la carta Uncanny Power) se abre su ventana: a un lado el Archivo por niveles, con la DC de cada nivel, y al otro el Poder elegido con todas sus características.',
        'Primero se gasta Resolve, uno o varios: se tira un dado de Resolve por cada uno, en 3D, y se suma Knowledge. El resultado, con tu nivel como máximo, es el nivel más alto al que llegas. El Keeper gana 1 Fear por Resolve.',
        'Con el acceso abierto eliges el Poder: el que marcaste o cualquier otro del Archivo de ese nivel o menor. Si no llegas al que querías, ya no pierdes el Resolve: eliges otro. También puedes renunciar al acceso; el Resolve y el Fear quedan gastados.',
        'Manifestar prepara la tirada de Spellcast de Knowledge contra DC 10 + nivel. Si la superas, el Poder se ejecuta en la mesa; con un Critical recuperas el Resolve gastado (el Fear se queda). Se ignora el coste de Hope y se paga el resto.',
        'Impossible Efficiency (Mastery del Mind-Touched): una vez por sesión, dos dados por cada Resolve.',
      ] },
    ],
  },
  {
    version: '2.30.0', date: '2026-11-22', title: 'V3 · Loadout en la ficha y equipo completo de los dos libros',
    sections: [
      { title: 'Loadout en la ficha', items: [
        'La ficha del personaje (doble clic en el token) tiene una pestaña Loadout, para el jugador y para el Keeper: el mismo mazo que en la mesa, con el Loadout, el Vault, el Recall (Descanso largo, corto o Escena activa), los Poderes a tu alcance para añadir al Vault y las cartas de Ancestry, Comunidad y Clases. Un personaje Sleeping ve su mano (Resolve Moves y Common Efforts) y el catálogo.',
      ] },
      { title: 'Equipo de los dos libros', items: [
        'El catálogo pasa de 110 a unos 570 objetos: todas las armas, armaduras, aumentos y equipo personal del Corebook y de Rust & Steel, también los de las Casas y los del mercado negro (marcados como ilegales, con su Heat). No se incluyen armas de nave, mejoras de dron ni modificaciones de armas y armaduras.',
        'Cada objeto lleva su libro, su nivel tecnológico, su Wealth Tier (WT) y su coste. Los que no tienen ilustración propia usan una de su familia.',
      ] },
      { title: 'Armas y equipo', items: [
        'Tres bloques por importancia: Armas y Armaduras (el principal), Aumentos y Útiles y varios (una lista sencilla).',
        'Lo equipado se ve grande y resaltado, con todas sus características: daño, Trait, alcance, Burden, umbrales y Armor Slots, nivel, WT, coste, libro, propiedades, beneficio e inconveniente… Lo que solo llevas encima es una fila compacta que se abre para verlo todo.',
        'Las armas se equipan o se enfundan (dos en la mano al añadirlas). Puedes llevar varias armaduras, pero solo una puesta: ponerte otra deja la anterior encima, sin borrarla.',
        'Las etiquetas (Stunning, Paired, Environmental…) muestran su regla al pasar el ratón o al enfocarlas.',
        'Catálogo con filtros por tipo, por WT, por libro (varios a la vez) y «Solo lo que puedo usar». Al elegir un objeto ves todas sus características antes de cogerlo.',
      ] },
    ],
  },
  {
    version: '2.29.10', date: '2026-11-22', title: 'Visión Ailurean, Resolve y equipo en mesa',
    sections: [
      { title: 'En la mesa', items: [
        'Los Sleeper ven en la barra flotante el Resolve disponible, su máximo y el dado d4 o d6. Pueden gastarlo o recuperarlo junto al Effort.',
        'Desde un personaje Ailurean, el mapa, los obstáculos y los efectos se ven en grises con un ligero tinte azul. Los personajes de otros jugadores conservan su color.',
        'Las cartas, sus resoluciones y la elección de escudos se abren en un panel compacto que deja el mapa visible e interactivo.',
        'La ficha reconoce los nombres antiguos, abreviados y bilingües del equipo ilustrado, incluida la armadura de fichas importadas.',
      ] },
    ],
  },
  {
    version: '2.29.9', date: '2026-11-22', title: 'Bear Down, daño de Vanguard y usos por arco',
    sections: [
      { title: 'En la mesa', items: [
        'Bear Down actualiza el resultado del poder o de la tirada solicitada al personaje. Al pasar de fallo a éxito se aplica el beneficio una sola vez y se conserva el Fear de la tirada de Dualidad.',
        'Los dados extra del arma se suman una sola vez al primer golpe y a Breaking Point. El total mostrado y el daño aplicado usan las mismas cantidades.',
        'En las escenas sin arco asignado, el Keeper puede iniciar un nuevo arco narrativo desde el registro y renovar los usos aunque haya cerrado o borrado la carta.',
      ] },
    ],
  },
  {
    version: '2.29.8', date: '2026-11-21', title: 'Poderes y movimientos en mesa',
    sections: [
      { title: 'Cartas', items: ['El registro conserva lanzador, objetivos, tirada y consecuencias. El Keeper puede pedir las tiradas impresas a los jugadores, preparar daño con escudos y aplicar recursos, condiciones y relojes. Los proyectos de dominio abren un reloj de campaña. Se guardan los límites de uso de 51 poderes.'] },
      { title: 'Vanguard y bestiario', items: ['Path to Nirvana y The Refused Path muestran el estado en el token y Breaking Point en la otra cara de la carta. Swarm Tactics permite elegir dos objetivos a alcance Close con 3 HP o más y resolver cada impacto por separado.'] },
    ],
  },
  {
    version: '2.29.7', date: '2026-11-21', title: 'Equipamiento avanzado ilustrado',
    sections: [{ title: 'Inventario y cartas', items: ['Las 16 armaduras, cuatro armas y el módulo de precognición que faltaban en el catálogo de mesa tienen ilustración propia.'] }],
  },
  {
    version: '2.29.6', date: '2026-11-21', title: 'Ilustraciones para los poderes de nivel 6 a 10',
    sections: [{ title: 'Cartas', items: ['Los 70 poderes de nivel 6 a 10 completan las ilustraciones de las 147 cartas de los siete dominios.'] }],
  },
  {
    version: '2.29.5', date: '2026-11-21', title: 'Ilustraciones de los poderes de dominio de nivel 2 a 5',
    sections: [{ title: 'Cartas', items: ['Los 56 poderes de nivel 2 a 5 tienen ilustración propia en la mano, el Vault y el catálogo.'] }],
  },
  {
    version: '2.29.4', date: '2026-11-21', title: 'V3 · Las luces despejan la niebla solo donde el grupo ve: las ventanas ya funcionan con salas iluminadas',
    sections: [
      { title: 'Niebla y luces', items: [
        'Una luz encendida despeja la niebla solo donde el grupo tiene línea de visión (antes despejaba toda su zona, la viera alguien o no). Una sala iluminada tras un muro queda en la niebla hasta que alguien la vea.',
        'Por eso las ventanas ya funcionan también con salas iluminadas: desde un lado al 0 % la sala queda oculta, y con más transparencia se ve más (por ejemplo, 5 % casi negro, 20 % muy oscuro, 50 % atenuado, 100 % limpio).',
      ] },
    ],
  },
  {
    version: '2.29.3', date: '2026-11-21', title: 'V3 · El Keeper ve siempre los tokens; ventanas con graduación',
    sections: [
      { title: 'Vista del Keeper', items: [
        'En vista Keeper se ven siempre todos los tokens, también los que están en la niebla de guerra, sin necesidad de activar la Visión GM. Los que el grupo no ve se dibujan atenuados y con la marca de «en la niebla». En vista jugador nada cambia.',
      ] },
      { title: 'Ventanas', items: [
        'Arreglado: la transparencia de las ventanas era «nada o todo». Ahora lo que hay detrás se ve más o menos según el % del lado desde el que se mira: a 5 % casi negro, a 25 % muy oscuro, a 50 % atenuado, a 100 % limpio.',
        'Lo que se ve a través de un cristal al 50 % o más queda recordado como explorado; por debajo, solo se ve mientras se mira.',
      ] },
    ],
  },
  {
    version: '2.29.2', date: '2026-11-21', title: 'V3 · Ventanas con transparencia por lado, color del token y conos solo para el Keeper',
    sections: [
      { title: 'Ventanas', items: [
        'Cada lado de una ventana tiene su transparencia, de 0 % (muro opaco) a 100 % (cristal limpio): el espejo de una sala de interrogatorios es 100 % desde un lado y 10 % desde el otro. Lo que hay detrás se ve con la transparencia del lado desde el que se mira; a 0 % la ventana corta la vista como un muro. A 50 % o más se distingue quién hay detrás.',
        'Antes la vista atravesaba siempre las ventanas y el porcentaje solo atenuaba la luz (con niebla no hacía nada).',
        'Las ventanas se dibujan como un cristal fino con remates en los extremos, no como una línea gruesa. El Keeper ve el porcentaje de cada lado (A y B) en el editor de muros o con la ventana seleccionada; en el inspector hay un deslizador por lado y los atajos «Igual por los dos lados», «Espejo» e «Intercambiar A ↔ B».',
      ] },
      { title: 'Color del token', items: [
        'Arreglado: el color elegido no se aplicaba. Un personaje Sleeping se pintaba siempre en naranja (ahora el naranja es solo el color por defecto) y, en partida online, la mesa rechazaba la ficha que guardaba un jugador, así que su color no llegaba al borde, al nombre, al chat ni a los subtítulos. Ahora el jugador envía su color (y sus recursos), y la mesa lo acepta.',
      ] },
      { title: 'Visión', items: [
        'Los conos de los enemigos y NPC (su linterna y el arco de visión al seleccionarlos) solo los ve el Keeper. El jugador ve los del grupo y los de los tokens que controla.',
      ] },
    ],
  },
  {
    version: '2.29.1', date: '2026-11-21', title: 'V3 · El Keeper decide siempre el daño; el dado vuelve a abrirse',
    sections: [
      { title: 'Daño', items: [
        'El daño que aplica un jugador lo decide siempre el Keeper, sea cual sea el objetivo (también un enemigo al que se le haya asignado dueño, o su propio personaje): al Keeper le aparece la ventana para elegir los escudos y aplicar o cancelar. En la Ficha del jugador el botón dice «Enviar daño al Keeper» y, tras enviarlo, «Enviado al Keeper: él decide».',
        'La mesa rechaza el daño que le llegue de un jugador sin pasar por esa ventana (cada aprobación vale una sola vez).',
      ] },
      { title: 'Pantalla', items: [
        'Arreglado: el dado de la esquina del mapa (jugador y Keeper) y el botón de la pantalla del Keeper no respondían desde la v2.28.2.',
      ] },
    ],
  },
  {
    version: '2.29.0', date: '2026-11-21', title: 'V3 · Ajustes, fuentes más legibles, panel lateral que se oculta y esquinas suaves',
    sections: [
      { title: 'Ajustes', items: [
        'Nuevo botón «⚙ Ajustes» en la cabecera, con Sesiones, Sonido, Ayuda, el idioma (ES / EN), las fuentes y el comportamiento del panel lateral. Sesiones, Sonido y Ayuda salen de la cabecera.',
      ] },
      { title: 'Fuentes', items: [
        'Dos juegos de fuentes a elegir en Ajustes: B · Exo 2 (Exo 2 en títulos y botones, Inter en el texto, JetBrains Mono en las cifras) y E · Sobria (Orbitron solo en los títulos, Inter en todo lo demás). Por defecto, B. La elección se recuerda en el navegador.',
        'Ningún rótulo baja de 10 px (antes había de 7 y 8 px). El texto del mapa (nombres, barras, etiquetas) usa también la fuente elegida. Las cartas conservan su maqueta.',
      ] },
      { title: 'Panel lateral', items: [
        'El panel derecho puede quedar fijo o ocultarse: en «Se oculta» solo asoma una pestaña en el borde derecho y el mapa usa todo el ancho; al llevar el ratón al borde, el panel entra con una animación rápida y suave, y se va al salir. Se cambia en Ajustes o con la chincheta del propio panel.',
      ] },
      { title: 'Paneles', items: [
        'Esquinas redondeadas de 5 px, planas (sin bisel interior), en la cabecera, las herramientas, el panel lateral, la barra del personaje, los relojes y las ventanas.',
        'En pantalla completa se oculta el rótulo de la esquina (operativos, rejilla, escena): repetía la cabecera y quedaba bajo la mano de cartas.',
      ] },
    ],
  },
  {
    version: '2.28.2', date: '2026-11-21', title: 'V3 · El mapa ocupa toda la pantalla, sin marco',
    sections: [
      { title: 'Pantalla', items: [
        'En escritorio el mapa ocupa todo el fondo de la ventana, sin marco. La cabecera, la barra de herramientas y el panel derecho flotan encima, con un fondo translúcido.',
        'Lo que va sobre el mapa (nombre de la escena, relojes, barra del personaje, mano de cartas, dados) se coloca en el hueco que dejan los paneles, así que nada queda tapado. En móvil y tableta se mantiene la disposición de antes.',
        'Fuera la etiqueta «Fear N/12» junto a la mano de cartas del Keeper: el Fear ya se ve arriba.',
      ] },
    ],
  },
  {
    version: '2.28.1', date: '2026-11-21', title: 'V3 · Sin barra inferior: más alto para el mapa',
    sections: [
      { title: 'Pantalla', items: [
        'Fuera la barra de estado de abajo (conexión, campaña, guardado e idioma): ese alto pasa al mapa y a los paneles laterales.',
        'El estado del guardado y el selector de idioma ES / EN van en la cabecera, a la derecha. Al pasar el ratón por «Guardado» se ven la campaña y el estado de la conexión; al pulsarlo, el aviso de siempre. En pantallas estrechas solo queda el idioma.',
      ] },
    ],
  },
  {
    version: '2.28.0', date: '2026-11-21', title: 'V3 · Armas y equipo, reorganizado; aumentos con efectos y cartas',
    sections: [
      { title: 'Armas y equipo', items: [
        'Lo que llevas va primero, en cuatro bloques: Armas, Armadura, Aumentos y Equipo. Cada bloque tiene su «+ Añadir», que abre el catálogo ya filtrado en un panel aparte (se cierra con ✕ o Esc). «Solo lo que puedo usar» sigue marcado por defecto.',
        'Cada arma deja a la vista solo Atacar; Editar y Quitar pasan al menú «⋯». Tocar una etiqueta (Stunning, Paired…) muestra su regla del glosario. Los textos largos se abren al tocarlos.',
        'La armadura tiene su bloque, con umbrales y Armor Slots. «Cambiar» pone otra (sustituye a la que llevas). Quitarla deja los umbrales naturales (Mayor 2 / Grave 4 + nivel; 4 / 6 en Kryllian, Rift Spinner y Synthetic) y sin Armor Slots propios.',
        'El editor completo del inventario queda solo para el Keeper.',
      ] },
      { title: 'Aumentos', items: [
        'Sus efectos se aplican al instalarlos y se retiran al quitarlos: Reflejos de Combate (+1 Evasión), Blindaje Subdérmico (+1 Armor Slot máx., también sobre la armadura), Osificación Reforzada (+2 HP máx.), Extremidad Cibernética (+1 Fuerza), Acelerador Sináptico (+2 Agilidad) y Conjunto Sensorial (+2 Instinto).',
        'Capacidad de aumentos (Corebook): la suma de tus tres mejores entre Fuerza, Agilidad, Finura y Presencia (Humanos y Synthetics +2). Cada aumento cuesta 1; por cada punto por encima, −1 Stress máximo mientras sigas por encima. El bloque muestra «capacidad usada / total».',
        'Los aumentos que se activan son una carta en tu mano, junto a las de clase, ilustrada con la imagen del propio aumento: Pre-Cognición Táctica (1 Stress, 1 / escena: Ventaja en un ataque o reacción) y Supresor de Dolor (reacción, 1 / escena: limpia 1 Stress).',
        'Poner y quitar armadura y aumentos lo aplica la mesa, así que en partida online también cambian la Evasión, los Traits y el Stress máximo del jugador.',
      ] },
    ],
  },
  {
    version: '2.27.17', date: '2026-11-21', title: 'V3 · Insignia de clase más grande en el token',
    sections: [
      { title: 'Mapa', items: [
        'La insignia de clase de la esquina inferior derecha del token mide el doble (70 % del diámetro en vez del 35 %) y cuelga sobre el borde del anillo, sin tapar el retrato ni el nombre.',
      ] },
    ],
  },
  {
    version: '2.27.16', date: '2026-11-21', title: 'Insignias, retratos y cartas de acción',
    sections: [
      { title: 'Mesa', items: ['La insignia de clase ocupa el 35 % del diámetro del token en altura y queda en su esquina inferior derecha. Los jugadores pueden personalizar el retrato de sus tokens asignados desde su ficha.'] },
      { title: 'Cartas y equipo', items: ['Los movimientos Sleeping y del Keeper tienen ilustraciones. Las capacidades de los enemigos se agrupan en ocho categorías ilustradas. El inventario muestra las piezas de equipo con el estilo de las armaduras.'] },
    ],
  },
  {
    version: '2.27.15', date: '2026-11-21', title: 'Medición de movimiento y arte de la mesa',
    sections: [
      { title: 'Mapa', items: ['Durante el arrastre se conserva un retrato translúcido en el origen. La línea directa muestra los metros y el rango de la escena.'] },
      { title: 'Ilustraciones', items: ['Retratos del bestiario de Tier 2, ilustraciones para los 21 poderes de nivel 1 y miniaturas en el equipo, los aumentos y los módulos de dron.'] },
    ],
  },
  {
    version: '2.27.14', date: '2026-11-21', title: 'Rift Spinners y retratos en la mesa',
    sections: [
      { title: 'Personajes y PNJ', items: [
        'Cinco arañas de cristal con marcas individuales ilustran los Rift Spinners en el mapa, las fichas y las nueve insignias de clase.',
        'El retrato automático utiliza el género de la ficha y después los pronombres. Desde su ficha, cada jugador puede elegir un retrato predefinido para sus tokens. El Keeper puede usar cualquier ascendencia, un retrato del bestiario o una imagen propia para un PNJ.',
      ] },
      { title: 'Chat y susurros', items: [
        'Los mensajes que ocupan más de dos líneas muestran el retrato del hablante a la izquierda. El chat y los subtítulos se adaptan al ancho disponible.',
        'Desde Chat, el Keeper puede elegir un token de la escena o subir su propia imagen. El retrato se guarda con la campaña.',
      ] },
    ],
  },
  {
    version: '2.27.13', date: '2026-11-20', title: 'Bestiario en mesa y retratos de la tripulación',
    sections: [
      { title: 'Adversarios y encuentros', items: [
        'El Keeper puede colocar los 57 perfiles. Hay 48 adversarios de combate y nueve encuentros por objetivos con un marcador que abre el procedimiento del libro.',
        'La biblioteca identifica los valores provisionales de 44 fichas y explica sus defensas según la criatura. En una ficha ya desplegada, el Keeper puede recuperar las pistas vacías desde la biblioteca. El registro editorial está en docs/bestiario-pendientes-core.md.',
        'Los esbirros sin umbrales reciben 1 HP por impacto ordinario que cause daño. Los ataques de Void Leech y Neon Jelly permiten marcar el Stress impreso directamente al objetivo.',
      ] },
      { title: 'Retratos de personajes', items: [
        '45 retratos de las nueve ascendencias parten de las ilustraciones del paquete editorial. Las nueve insignias de clase dan identidad a las 243 combinaciones de ascendencia, clase y género. Harker, Vea y HE-09 tienen retratos propios renovados.',
      ] },
    ],
  },
  {
    version: '2.27.12', date: '2026-11-20', title: 'Bestiario ilustrado de Tier 1',
    sections: [
      { title: 'Retratos en fichas y mapa', items: [
        'Trece ilustraciones cubren ocho adversarios del bestiario, tres jefes del Keeper y los dos adversarios principales de Hearts in the Void. Los dos perfiles de la plaga de ratas de Charon comparten retrato.',
        'La biblioteca muestra la ilustración al abrir un perfil de Tier 1. Los tokens reconocen el nombre del adversario y el Keeper puede elegir cualquiera de los trece retratos en los ajustes del token.',
      ] },
    ],
  },
  {
    version: '2.27.11', date: '2026-11-20', title: 'Retratos de los personajes y descripciones del bestiario',
    sections: [
      { title: 'Personajes y adversarios', items: [
        'Al importar o asignar un personaje, el mapa y las fichas muestran su retrato de ascendencia con la insignia de su clase. Se recuperan 46 ilustraciones ya dibujadas y el creador conserva la variante elegida al exportar el JSON.',
        'Las 57 entradas del bestiario incluyen la descripción del libro. El Keeper puede editarla en las fichas desplegadas. Los contactos sin identificar conservan su identidad oculta.',
      ] },
      { title: 'Reglas en mesa', items: [
        'La regla de mesa del VTT para el Spotlight cobra 1 Fear por adversario y bloquea un segundo foco en la misma ronda, también desde sus ajustes o desde un jugador que lo controla.',
        'Las defensas se aplican a su parte del daño mixto antes de comparar el resultado con los umbrales. En descanso largo, Prepare devuelve la Hope del Awakened a 2.',
      ] },
    ],
  },
  {
    version: '2.27.10', date: '2026-11-20', title: 'Combate, bestiario y navegación según el Corebook 12.06',
    sections: [
      { title: 'En la mesa', items: [
        'A 0 HP, la ficha sigue el progreso de Dying y Final. Un aliado adyacente puede estabilizar. Blaze of Glory requiere la elección del jugador y la confirmación de que ha resuelto su último acto.',
        'Overwhelmed y Vulnerable se aplican en la tirada y se cancelan cuando coinciden. Las resistencias y las inmunidades activas se aplican antes de los umbrales de daño.',
        'Rapid Regeneration cura al activarse y al empezar cada Spotlight elegible. El Keeper dispone de Nueva ronda para abrir el siguiente ciclo.',
      ] },
      { title: 'Herramientas del Keeper y de la tripulación', items: [
        'El bestiario ofrece las armas y variantes impresas de cada adversario. Los perfiles narrativos remiten a su procedimiento. La cabecera de Fear usa los mismos movimientos y costes que la mano del Keeper.',
        'El salto FTL separa el cálculo de ruta de la iniciación por el piloto. La solución queda guardada y se consume una Pearl al entrar en tránsito.',
        'El Códice en español e inglés recoge las reglas de Effort, Recovery Anchor, heridas, Stress y Long Bruise del Corebook 12.06.',
      ] },
    ],
  },
  {
    version: '2.27.9', date: '2026-11-19', title: 'V3 · La linterna de un enemigo oculto no lo delata',
    sections: [
      { title: 'Niebla y visión', items: [
        'Arreglado: la luz propia de un enemigo (su linterna, con su cono) se dibujaba en la pantalla de los jugadores aunque no lo vieran, y delataba dónde estaba y hacia dónde miraba. Ahora la luz de un token solo se ve mientras el grupo ve a ese token; fuera de la vista queda solo el fantasma «ÚLTIMA POS.».',
      ] },
    ],
  },
  {
    version: '2.27.8', date: '2026-11-19', title: 'V3 · Un enemigo con dueño asignado sigue siendo un enemigo',
    sections: [
      { title: 'Niebla y visión', items: [
        'Arreglado: un adversario (o un token con nombre oculto, «?????») al que se le había asignado un dueño o un controlador contaba como del grupo. Los jugadores veían por sus ojos (su cono de visión destapaba la niebla) y lo veían siempre. Ahora nunca presta su visión y solo se ve cuando un personaje del grupo lo ve.',
        'Una luz deja ver a un enemigo más allá del alcance de la vista solo si algún personaje del grupo lo está mirando sin paredes de por medio: una sala iluminada a tu espalda o tras un muro no muestra quién hay dentro.',
      ] },
    ],
  },
  {
    version: '2.27.7', date: '2026-11-19', title: 'V3 · Los jugadores no ven por los ojos de los enemigos',
    sections: [
      { title: 'Niebla y visión', items: [
        'Solo los personajes del grupo (y los tokens que controla el jugador) muestran el mapa a los jugadores. Seleccionar un enemigo para atacarlo ya no puede hacer que su visión cuente como la del jugador.',
        'Si el Keeper, sin el grupo en la escena, selecciona un NPC para ver lo que ve, esa vista queda en su pantalla: no se guarda como explorado ni se envía a los jugadores.',
        'Un enemigo que entra en la niebla deja de verse: los jugadores solo ven un fantasma en la última posición donde lo vieron («ÚLTIMA POS.»), que desaparece cuando vuelven a mirar ese sitio y está vacío.',
        'Una luz apagada ya no deja ver a los enemigos que hay en su zona.',
      ] },
    ],
  },
  {
    version: '2.27.6', date: '2026-11-19', title: 'V3 · Las cartas de Common Effort ya se pueden usar',
    sections: [
      { title: 'Cartas', items: [
        'Arreglado el error «Cannot read properties of undefined (reading \'toUpperCase\')» al usar algunas cartas: los Common Effort (Cover the Angle, Brace, Steady Hands…), Bear Down y las cartas de Fear y de adversarios no tenían nombre de tipo. Ahora todas lo tienen y una carta de tipo desconocido se muestra como «Carta».',
      ] },
    ],
  },
  {
    version: '2.27.5', date: '2026-11-19', title: 'V3 · Foco a la vista y el Keeper decide todo el daño',
    sections: [
      { title: 'Foco', items: [
        'El botón Foco de la barra del personaje es dorado, va el primero y queda siempre a la vista; se ilumina («Con foco») mientras el personaje lo tiene. Equipo pasa al menú «⋯».',
        'En la Ficha del jugador, «Tomar foco» sustituye a «Ficha completa» (la ficha completa sigue en el botón FICHA de la barra) y se ilumina mientras tienes el foco.',
      ] },
      { title: 'Daño', items: [
        'Aplicar daño a un adversario, a un NPC o al personaje de otro jugador lo decide siempre el Keeper: le aparece una ventana para elegir cuántos escudos se gastan y aplicar o cancelar el daño. Solo el daño a tu propio personaje lo aplicas tú.',
      ] },
    ],
  },
  {
    version: '2.27.4', date: '2026-11-19', title: 'V3 · La niebla de guerra vuelve a dejar ver lo explorado',
    sections: [
      { title: 'Niebla de guerra', items: [
        'Arreglado: con la niebla de guerra activada, una zona que un personaje ya ha visitado vuelve a verse atenuada (según «Atenuación explorada»), no negra del todo. Desde la v2.24 la oscuridad de la escena se sumaba encima de lo explorado.',
        'Como hasta la v2.23, con la niebla activada es la niebla la que sombrea el mapa; la oscuridad del Clima solo se dibuja con la niebla desactivada. Las luces siguen despejando la niebla de su zona y tiñéndola.',
        'Las luces despejan la niebla una vez por cambio, no en cada fotograma.',
      ] },
    ],
  },
  {
    version: '2.27.3', date: '2026-11-18', title: 'V3 · Intensidad y teñido de las luces; barra y mazo se arrastran; Normal, Ventaja, Desventaja',
    sections: [
      { title: 'Luces', items: [
        'La intensidad de una luz es la cantidad de oscuridad (y de niebla) que elimina en su zona: 30 % quita el 30 %, 100 % la quita entera.',
        'Nuevo control «Teñido» en la ficha de la luz: cuánto colorea su zona con su color (0 % solo quita la oscuridad; 30 % por defecto). El color tiñe el mapa, no lo tapa.',
      ] },
      { title: 'Pantalla', items: [
        'La barra del personaje y el icono del mazo completo se arrastran pulsando sobre ellos (sin asa). Un toque sin mover sigue siendo un clic; Alt + doble clic los devuelve a su sitio.',
        'Normal, Ventaja y Desventaja van en la misma línea y en ese orden.',
      ] },
    ],
  },
  {
    version: '2.27.2', date: '2026-11-18', title: 'V3 · Las luces quitan la oscuridad, sin teñir el mapa',
    sections: [
      { title: 'Luces', items: [
        'Revertido el baño de color de la v2.27.1: era exagerado. Una luz vuelve a quitar la oscuridad de su zona y deja ver el mapa tal como es.',
        'Con la intensidad por defecto (0,9) la oscuridad desaparece del todo dentro de su zona (antes quedaba un 7 %); con intensidades bajas, penumbra.',
      ] },
    ],
  },
  {
    version: '2.27.1', date: '2026-11-18', title: 'V3 · Las luces iluminan de verdad',
    sections: [
      { title: 'Luces', items: [
        'Una luz ya no solo quita la oscuridad: baña su zona con su color, cortada por las paredes y según su intensidad, para que una sala iluminada se vea iluminada también en mapas de imagen oscura (como el Bridge, que además empieza con la luz ambiental al 25 %).',
        'El núcleo brillante alrededor de la luz es más pequeño y la zona entera queda iluminada.',
      ] },
    ],
  },
  {
    version: '2.27.0', date: '2026-11-18', title: 'V3 · Niebla sincronizada, el Keeper decide el daño a NPC, paneles movibles y cartas con el título arriba',
    sections: [
      { title: 'Niebla de guerra', items: [
        'Corregido: la exploración no llegaba a los jugadores. Su pantalla la cargaba solo la primera vez, y el aviso de niebla del Keeper no se enviaba. Ahora cada pantalla suma la exploración del Keeper cada vez que este la guarda; «Reiniciar niebla» y «Revelar todo» llegan a todos.',
        'Si algo de la partida no puede llegar a los jugadores (un elemento no válido), el Keeper ve un aviso que dice qué es; antes los jugadores se quedaban con el estado viejo sin que nadie lo supiera.',
        'Cada sincronización ya no lleva un segundo mensaje de «mapa cargado»: la mitad de mensajes.',
      ] },
      { title: 'Ataques', items: [
        'Junto a Desventaja y Ventaja está el botón Normal, al tirar un Trait y al atacar.',
        'El daño a un NPC o adversario lo decide el Keeper: se abre una ventana con el daño, los escudos que puede gastar (y lo que perdería con cada número) y Aplicar o Cancelar. Si ataca un jugador conectado, la ventana le sale al Keeper y el jugador recibe el resultado.',
      ] },
      { title: 'Pantalla', items: [
        'La mano de cartas y la barra del personaje se pueden mover arrastrando su asa (⠿); el sitio se recuerda en este navegador y un doble clic en el asa la devuelve a su lugar.',
        'Jugador: la herramienta Área queda a la vista y Medir pasa al menú ⋯.',
        'Cartas: el nombre y el coste van arriba (se leen en la mano); la parte blanca de abajo queda para el texto.',
      ] },
    ],
  },
  {
    version: '2.26.1', date: '2026-11-18', title: 'V3 · Una luz encendida ilumina siempre su zona',
    sections: [
      { title: 'Luces', items: [
        'Corregido: una luz encendida en una zona que el grupo aún no había visto no hacía nada (la niebla la tapaba). Ahora toda luz encendida ilumina su zona (las paredes la siguen cortando) y quita la niebla y la oscuridad de ella, la haya visto el grupo o no.',
        'La intensidad decide cuánto: la mínima muestra la zona en penumbra; desde 1, se ve como de día. La luz es pareja en toda su área y solo se suaviza junto al borde (antes se desvanecía desde el centro).',
        'Para ocultar una sala iluminada, apaga sus luces o déjala sin ellas.',
      ] },
    ],
  },
  {
    version: '2.26.0', date: '2026-11-18', title: 'V3 · La partida online viaja por Realtime Database',
    sections: [
      { title: 'Firebase', items: [
        'Los mensajes de la partida online (movimientos, tiradas, estado) y la presencia de los jugadores viajan por Realtime Database, que cobra por datos transferidos y no por operación. Firestore se queda con las cuentas, las salas, los guardados y la presencia del Keeper.',
        'En las pruebas, un minuto de partida en reposo pasa de 19 a 6 operaciones de Firestore, y cinco movimientos de 32–64 a 5–7. El jugador ya no escribe en Firestore mientras juega.',
        'Si Realtime Database no está disponible (sin crear, sin reglas o bloqueada), la sala sigue funcionando por Firestore como antes, sin hacer nada.',
        'Para activarlo hay que crear la base de datos y publicar sus reglas: FIREBASE_SETUP.md, «Realtime Database».',
      ] },
    ],
  },
  {
    version: '2.25.0', date: '2026-11-18', title: 'V3 · Menos peticiones a Firebase, luces que disipan la niebla e interruptores',
    sections: [
      { title: 'Firebase: menos peticiones', items: [
        'La partida online gasta mucho menos de la cuota de Firestore: en las pruebas, la mitad de escrituras en reposo y en cada movimiento o cambio de HP.',
        'Cada mensaje lleva solo lo que ha cambiado: el token movido y sus campos, no todos los tokens con sus fichas y avatares; la imagen del mapa ya no se reenvía.',
        'La campaña se guarda tras 3 s sin cambios (como mucho cada 15 s), no medio segundo después de cada cambio, y cada guardado reescribe solo el trozo que cambia. El latido de presencia pasa de 5 s a 10 s. El control de oscuridad se envía al soltarlo.',
        'Si Firebase agota la cuota, la VTT lo dice en claro (y cuándo se renueva) y deja de reintentar.',
      ] },
      { title: 'Luces', items: [
        'Cada luz se puede encender y apagar desde su ficha. Una luz encendida disipa la niebla de guerra de su zona (las paredes la siguen cortando), más o menos según su intensidad, si el grupo ya ha visto ese punto o lo tiene a la vista.',
        'Interruptores: «＋ Interruptor» en la ficha de una luz crea uno a su lado. Se mueve arrastrándolo; en su ficha se eligen las luces que controla, si es usable por los jugadores o está bloqueado, y si es visible o secreto. El Keeper lo acciona con doble clic o desde su ficha; un jugador, con un clic.',
        'Nuevo efecto de luz: Estroboscopio.',
      ] },
      { title: 'Corregido', items: [
        'Un jugador conectado ya puede abrir y cerrar puertas: antes solo cambiaba en su pantalla y la mesa no se enteraba.',
      ] },
    ],
  },
  {
    version: '2.24.1', date: '2026-11-18', title: 'V3 · La niebla vuelve a ser como antes; luces más vivas',
    sections: [
      { title: 'Niebla y visión', items: [
        'Corregido: tras la v2.24.0 los personajes no iluminaban su zona: de noche lo que veían quedaba bajo la oscuridad de la escena si no llevaban luz propia. Ahora lo que ve cada personaje vuelve a verse claro.',
        'Una escena se ve como siempre hasta que el Keeper elige su hora en Clima (Día, Ocaso, Noche o el control Oscuridad). Antes, todos los mapas pasaron a ser de noche sin que nadie lo eligiera, y con oscuridad 0 la visión no tenía límite de distancia.',
        'Con Día elegido en Clima, los personajes ven todo lo que tienen a la vista; de noche, su propia visión y lo que iluminan las luces.',
      ] },
      { title: 'Animaciones de las luces', items: [
        'Cada luz tiene su propio ritmo (dos antorchas ya no parpadean a la vez). El parpadeo imita una llama irregular con alguna caída, el pulso respira de forma más visible, la luz cuántica tiembla, la sirena funde sus dos colores y el estroboscopio da destellos secos.',
      ] },
    ],
  },
  {
    version: '2.24.0', date: '2026-11-18', title: 'V3 · Luces que iluminan, Clima con día y noche, lava y flechas del teclado',
    sections: [
      { title: 'Luces', items: [
        'La escena tiene oscuridad propia (0 % de día … 100 % de noche) y se ve siempre, también con niebla de guerra y en la Visión de Keeper (atenuada, para que el mapa se siga leyendo). Las luces del mapa y de los tokens la iluminan respetando paredes.',
        'Como en Foundry: de día un token ve todo lo que tiene a la vista; de noche ve su propia visión y lo que iluminan las luces. Solo se explora lo que se ve: una luz que nadie tiene a la vista ya no destapa su zona a través de las paredes.',
        'Corregido: las animaciones de las luces (pulso, parpadeo, cuántica, sirena, chispas) no se veían. Ahora cambian tanto la zona iluminada como el halo.',
      ] },
      { title: 'Clima (sustituye a Agua)', items: [
        'Día y noche: Día, Ocaso y Noche llevan la oscuridad a su valor en 10 s en todas las pantallas; el control Oscuridad la cambia al momento.',
        'Lluvia y niebla, como antes. Zonas de agua o de lava, en caja, polígono o a mano alzada. La lava brilla de noche; en la ficha de la zona se cambia entre agua y lava.',
      ] },
      { title: 'Teclado', items: [
        'Las flechas mueven el token seleccionado una casilla, con las mismas reglas que al arrastrarlo: paredes, puertas cerradas y ventanas detienen a los jugadores, y moverse da el foco.',
      ] },
    ],
  },
  {
    version: '2.23.2', date: '2026-11-18', title: 'V3 · Dados 3D también para las propiedades del arma',
    sections: [
      { title: 'Dados 3D', items: [
        'Los dados extra de las propiedades del arma se lanzan en 3D después de los de daño: uno por cada dado al máximo con Burst Fire, el dado extra de Massive y el d6 de Energy Surge. El daño se recalcula con las caras que muestran.',
        'El d6 de Overheating se lanza tras el ataque y muestra su tarjeta («se sobrecalienta» con 1–2).',
      ] },
    ],
  },
  {
    version: '2.23.1', date: '2026-11-18', title: 'V3 · «Aplicar daño» se ve a la primera',
    sections: [
      { title: 'Aplicar daño', items: [
        'En la Ficha, «Aplicar daño» es ahora el botón principal del resultado: ocupa la fila, es dorado, muestra los HP que hará perder (p. ej. «1 HP») y late suavemente mientras el daño está pendiente. «Escudos» queda a su lado, más pequeño.',
        'El botón del panel de dados del Keeper tiene el mismo aspecto.',
      ] },
    ],
  },
  {
    version: '2.23.0', date: '2026-11-18', title: 'V3 · Dados 3D en todas las tiradas y el ataque termina al aplicar el daño',
    sections: [
      { title: 'Dados 3D', items: [
        'Las tiradas que la mesa hacía por dentro ahora se lanzan como dados 3D en la pantalla de quien tira, y su resultado aparece para todos: los 1d4 del descanso corto (Tend Wounds, Clear Stress, Repair Armor), Bear Down, Combat Surge, The Held Line, el primer golpe de Nirvana, Breaking Point, la duración tirada de una carta (Rapid Regeneration…) y el dado de las cartas del Keeper.',
        'La mesa aplica las caras que muestran los dados. En un descanso, cambiar la elección no vuelve a tirar un movimiento ya tirado.',
      ] },
      { title: 'Ataque', items: [
        'Al aplicar el daño, el ataque termina: tras un instante para leer «Daño aplicado», se cierra el resultado de la Ficha, se quita la marca del objetivo y se deseleccionan los tokens.',
      ] },
    ],
  },
  {
    version: '2.22.0', date: '2026-11-18', title: 'V3 · Descansos en mesa, armadura de enemigos al instante y tiradas más discretas',
    sections: [
      { title: 'Descansos', items: [
        'El Keeper tiene dos botones en la esquina superior izquierda del mapa, junto al nombre de la escena: una luna creciente (descanso corto) y un sol amaneciendo (descanso largo).',
        'Al pulsar uno, la partida se pausa para todos y cada personaje elige dos movimientos distintos del descanso (Corebook, cap. 9). El panel muestra quién ha elegido y quién falta; cuando elige el último, la mesa aplica todo y la partida continúa.',
        'Descanso corto: Tend Wounds, Clear Stress, Repair Armor (1d4 + Tier) y Prepare (+1 Hope o +1 Resolve). Descanso largo: Recover, Decompress (también Long Bruise), Repair All Armor y Prepare (Hope a 2 o Resolve lleno); además termina Blinded, Poisoned y Weakened y devuelve los Armor Slots quitados por Armor Piercing.',
        'Durante la pausa nadie puede mover ni actuar. El Keeper puede elegir por un jugador ausente, aplicar el descanso solo a quienes ya han elegido o cancelarlo.',
      ] },
      { title: 'Armadura de los enemigos', items: [
        'Armor Piercing, Disintegrating y Shredding reducen al instante los Armor Slots máximos de un enemigo al aplicar el daño, en vez de quedar como recordatorio. Cada reducción recuerda cuándo vuelve: Armor Piercing en su próximo Long Rest, Disintegrating con Repair All Armor y Shredding al reparar en Downtime.',
        'Contra personajes jugadores sigue siendo un recordatorio: el jugador elige y lo apunta en su ficha.',
      ] },
      { title: 'Tiradas', items: [
        'La tarjeta de resultado tiene el fondo un 40 % transparente y desaparece antes (7 s; los dados 3D, a los 6 s). La tirada sigue en el registro.',
      ] },
    ],
  },
  {
    version: '2.21.2', date: '2026-11-18', title: 'V3 · La zona iluminada ya no se adelanta al token',
    sections: [
      { title: 'Luz y visión del token', items: [
        'Corregido: al mover un token, la zona que ilumina (su visión en la niebla de guerra) saltaba primero al destino y el token llegaba después. Ahora la visión avanza con el token mientras se desliza, igual que su halo.',
        'Al arrastrar como jugador, la visión sigue quedándose en el punto de partida hasta soltar; y solo avanza hacia una posición que la mesa ya ha confirmado.',
      ] },
    ],
  },
  {
    version: '2.21.1', date: '2026-11-18', title: 'V3 · La luz del token se mueve con él',
    sections: [
      { title: 'Luz de los tokens', items: [
        'Al arrastrar un token para ajustar su posición, su luz propia va con él mientras lo mueves, y también mientras se desliza a su sitio (la animación que ven los demás).',
        'La visión y la niebla de guerra del jugador siguen calculándose desde la posición confirmada: mover el token no deja ver zonas antes de soltarlo.',
      ] },
    ],
  },
  {
    version: '2.21.0', date: '2026-11-18', title: 'V3 · Armas con tags, daño de Combat Surge y compañía, y Resolve en la Ficha',
    sections: [
      { title: 'Armas con tags', items: [
        'Cada arma guarda sus propiedades como tags (Reliable, Armor Piercing 2, Paired +2, Reach…) y las reglas leen solo esos tags: ya no se buscan palabras en el nombre o la descripción. Las armas antiguas los obtienen de su lista de propiedades; las del catálogo y del creador llegan con ellos.',
        'El editor de equipo tiene el campo «Tags (reglas)»; la lista de armas los muestra como etiquetas. La descripción sigue en «Propiedades».',
        'El alcance sale del campo Alcance (o del catálogo): ya no se deduce del nombre del arma. La competencia de clase lee la familia del catálogo o del creador, y Massive / Heavy de sus tags.',
      ] },
      { title: 'Daño de efectos', items: [
        'Tras un impacto, la Ficha ofrece los efectos que suman daño a ese ataque: Combat Surge (Soldier Awakened, 2 Hope, +1d6) y The Held Line (Soldier Sleeping, 1 Effort, +1d6), una vez por ataque; se paga con la carta como desde la mano.',
        'Nirvana State / Disciplined State: el primer ataque cuerpo a cuerpo del estado suma +2d6 solo; Breaking Point termina el estado y suma +(Proficiency)d6.',
        'El daño se recalcula con los mismos dados. Corregido: con una fórmula de daño escrita (p. ej. «d8+2») no se sumaba Bear Down; ahora sí, igual que estos efectos.',
      ] },
      { title: 'Resolve (Sleeping)', items: [
        'En la Ficha, junto a las marcas de Resolve: Bear Down con el número de dados que quieras gastar; suma su total a tu última tirada o ataque (o al daño aún sin aplicar). Nunca cambia Hope/Fear ni hace crítico.',
        'Prepare: «+1» en un descanso corto y «lleno» en un descanso largo, como el Corebook (Resolve no se recupera solo).',
      ] },
    ],
  },
  {
    version: '2.20.1', date: '2026-11-18', title: 'V3 · El jugador que actúa toma el foco',
    sections: [
      { title: 'Foco automático', items: [
        'Cuando un jugador termina una acción activa, la mesa le da el foco: al atacar (cuando se resuelve la tirada), al usar un Poder, un Resolve Move, un Uncanny Power o su rasgo de senda, y al mover su token por el mapa.',
        'Si cancela la acción (Esc al apuntar, soltar el token en su sitio, un movimiento bloqueado), no hay foco. Las Reacciones y las tiradas normales de Trait tampoco lo dan.',
        'Si ya tenía el foco no cambia nada, así que mover y luego atacar en el mismo turno no hace avanzar dos veces sus relojes de efecto.',
      ] },
    ],
  },
  {
    version: '2.20.0', date: '2026-11-18', title: 'V3 · Poderes y rasgos al día con el Corebook 12.06, Integrity Die, duraciones de todo el mazo y cajón completo',
    sections: [
      { title: 'Textos al día con el Corebook 12.06', items: [
        'Revisados contra el libro los 147 Poderes, los 18 rasgos de senda (Hope Feature y Effort Feature), los 42 Resolve Moves, los Gifts de Ancestry y los beneficios de Community. Actualizados los que habían cambiado: 113 Poderes (29 reescritos a fondo, p. ej. Compelling Argument, Drone Whisper, Solar Avatar), 12 rasgos de senda (Scrap Genius, Veil Surge, Reality Unfold, Vanishing Act, Path to Nirvana, The Refused Path…), 16 Resolve Moves (Field Improvisation, Hot-Wire, Uncanny Power…), 10 Gifts y las 7 Communities.',
        'Uncanny Power vuelve a decir Resolve Die (no Effort Die), como el libro. Las cartas muestran la negrita y la cursiva del libro.',
      ] },
      { title: 'Path to Nirvana y Disciplined State (versión del Corebook)', items: [
        'Al entrar en el estado se crea un Integrity Die a su cara más alta según el Tier: d4 (niveles 1-4), d6 (5-7) o d8 (8-10). Cada tirada con Fear lo baja 1 (nunca con dados iguales); a 0 el estado termina. También termina al cambiar de escena. Igual para el Awakened (Path to Nirvana) y el Sleeping (The Refused Path).',
      ] },
      { title: 'Duraciones de todo el mazo', items: [
        'Revisadas las 234 cartas del juego: 58 crean un reloj de efecto al usarse: las que duran turnos o rondas, «hasta tu próximo Spotlight», «hasta el final de la escena» (termina al cambiar de escena o al tocar el reloj), los dados que fijan la duración (Rapid Regeneration, Nurturing Touch, con +1 HP por turno) y los Integrity Die.',
        'No crean reloj las duraciones de condiciones sobre un objetivo ni las de ramas de fallo: dependen de la tirada.',
        'Un efecto que puede ser para otro (Rapid Regeneration, Nurturing Touch…) va al aliado seleccionado o marcado en el mapa; si no hay ninguno, a quien juega la carta. Seleccionar a un aliado ya no le quita la mano de cartas al jugador.',
      ] },
      { title: 'Mazo', items: [
        'El cajón del mazo tiene ahora Poderes, Ancestry, Community y Clases. Las clases se agrupan por Awakened y Sleeping y, dentro, por clase (Hope o Effort Feature, Class Feature y Resolve Moves). Todas se pueden abrir y leer, también como Keeper.',
        'El botón del mazo se ve siempre, también mientras se cargan los datos de reglas.',
      ] },
    ],
  },
  {
    version: '2.19.0', date: '2026-11-18', title: 'V3 · Relojes de efecto: Path to Nirvana, Rapid Regeneration y otros efectos con duración',
    sections: [
      { title: 'Relojes de efecto', items: [
        'Al usar una carta cuyo texto fija una duración, el personaje recibe un reloj de efecto: Path to Nirvana («Spotlights equal to your Proficiency») crea un reloj de tantos segmentos como su Proficiency; Rapid Regeneration («Roll 1d4… number of additional turns») tira el d4 y crea un reloj de ese número. También se reconocen duraciones fijas («for 3 turns»).',
        'Cada vez que el personaje gana el foco se marca un segmento; al completarse, el efecto termina con un aviso y una entrada en el registro. Rapid Regeneration cura +1 HP en cada uno de esos turnos.',
        'El reloj se ve junto al token (a la izquierda; las condiciones van a la derecha) con los segmentos que quedan: tocarlo marca un segmento. En la Ficha del jugador aparece en «Efectos». En la ficha completa se edita: marcar, desmarcar, cambiar el número de segmentos o terminar el efecto.',
        'Volver a usar el mismo efecto reinicia su reloj.',
      ] },
    ],
  },
  {
    version: '2.18.3', date: '2026-11-18', title: 'V3 · El segundo toque en el objetivo ya ataca siempre',
    sections: [
      { title: 'Corregido', items: [
        'Al tocar dos veces seguidas el objetivo, el navegador generaba además un doble clic en el mapa, que intentaba abrir la ficha de ese token y mostraba «Selecciona uno de tus tokens asignados». Mientras se apunta, y un momento después de atacar, el mapa ya no recibe esos clics.',
        'Seleccionar un enemigo en el mapa ya no le quita la Ficha a tu personaje: si lo seleccionado no es un personaje jugador, la Ficha sigue con el que juegas.',
        'En la máquina del Keeper (también en su vista de jugador) se pueden marcar como objetivo los tokens ocultos; un jugador nunca los ve ni los marca.',
      ] },
    ],
  },
  {
    version: '2.18.2', date: '2026-11-18', title: 'V3 · Invitaciones sin ventanas encima y pruebas de login con emuladores',
    sections: [
      { title: 'Inicio de sesión', items: [
        'Corregido: al abrir un enlace de invitación sin haber iniciado sesión, la ventana de Sesiones salía encima de la pantalla de acceso y seguía allí después. Ahora el código espera en la casilla «Unirse» de la pantalla de inicio y, al iniciar sesión, entras directamente en la sala como jugador.',
        'Comprobado de punta a punta con cuentas reales en los emuladores de Firebase: el Keeper crea una sala, un jugador entra con el código, otro con el enlace de invitación, el Keeper recarga y vuelve a su sala, y el inicio de sesión desde «Cuenta» cierra la ventana con «Sesión iniciada como…». En ningún paso queda una ventana encima de otra.',
      ] },
      { title: 'Desarrollo', items: [
        'Nuevo `npm run dev:emulators`: la app entera contra los emuladores de Authentication y Firestore (proyecto ficticio, sin datos reales). Ver FIREBASE_SETUP.md.',
      ] },
    ],
  },
  {
    version: '2.18.1', date: '2026-11-18', title: 'V3 · Inicio de sesión sin ventanas superpuestas',
    sections: [
      { title: 'Inicio de sesión y salas', items: [
        'Corregido: con un enlace de invitación, la ventana de Sesiones se abría al cargar y otra vez al confirmar la cuenta (y en cada renovación de la sesión). Ahora la invitación se usa una sola vez y se quita de la dirección.',
        'La ventana de Sesiones ya no se apila: si ya está abierta, se trae al frente.',
        'Tras iniciar sesión desde «Cuenta» ya no se abre el archivo personal encima: se cierra y avisa «Sesión iniciada». Si se inició sesión desde la ventana de salas, se vuelve a ella.',
        'La vuelta automática a tu última sala va directa a la mesa (con «Volviendo a tu sala» y Cancelar), en lugar de cargar detrás de la pantalla de inicio. Cancelar devuelve a la pantalla de inicio.',
      ] },
    ],
  },
  {
    version: '2.18.0', date: '2026-11-18', title: 'V3 · La regla 3 + 5 + resto en la vista del jugador',
    sections: [
      { title: 'Vista del jugador más limpia', items: [
        'Nuevo componente común de menús (3 a la vista, 5 en «⋯» y el resto en «Más…»), aplicado de momento a la vista del jugador.',
        'Cabecera: Escena, Sala y Tokens a la vista; en «⋯» Cuenta, Sesiones, Ayuda, Tripulación y Copiar invitación; en «Más…» Códice, Inicio, Unirse a una sala, Audio y el enlace de invitación.',
        'Herramientas: Mover, Medir y Dibujo; en «⋯» Ping, Área, Efectos, Deshacer y Rejilla; en «Más…» Ajuste a la rejilla.',
        'Barra del personaje: Ficha, Estados y Equipo; en «⋯» Foco, Expandir y Reserva. Las cifras y sus botones −/+ siguen a la vista.',
        'Los atajos de teclado siguen funcionando. La vista del Keeper no cambia todavía.',
        'Con esto el jugador pasa de unos 95 controles a la vista (diagnóstico) a 48.',
      ] },
    ],
  },
  {
    version: '2.17.12', date: '2026-11-18', title: 'V3 · Atacar con Ventaja o Desventaja y pantalla del Keeper',
    sections: [
      { title: 'Ataques', items: [
        'Al marcar el objetivo aparecen Desventaja y Ventaja: tocar una ataca con ella; el segundo toque en el objetivo ataca sin ventaja. Igual para el jugador (en la Ficha) y para el Keeper.',
        'El Keeper apunta con un panel flotante sobre el mapa: quién ataca y con qué, el objetivo con su distancia y su tirada, Desventaja/Ventaja y cancelar.',
      ] },
      { title: 'Pantalla del Keeper', items: [
        'Nuevo icono de pantalla de Keeper junto al de los dados (solo para el Keeper). Levantada, todas sus tiradas son secretas: solo las ve él. Es el mismo interruptor que «Tirada secreta» del panel de dados y se recuerda entre sesiones en este navegador.',
      ] },
      { title: 'Detalles', items: [
        'El texto de la pestaña FICHA queda centrado como las demás.',
      ] },
    ],
  },
  {
    version: '2.17.11', date: '2026-11-17', title: 'V3 · El Keeper ataca con sus adversarios y recibe por susurro lo que tiene que resolver',
    sections: [
      { title: 'Keeper', items: [
        'Botón «⚔ ATACAR» en la barra inferior de los adversarios: toca el objetivo en el mapa (un aviso dice distancia, Ventaja/Desventaja y motivos) y vuelve a tocarlo para atacar. El panel de dados se abre con el resultado y «Aplicar daño».',
      ] },
      { title: 'Propiedades de arma en el chat', items: [
        'Cuando un arma tiene una propiedad que hay que resolver a mano (por ejemplo, la porra de choque con Stunning: Strength Reaction Roll contra CD 10), se envía al Keeper como susurro en el chat: desde la máquina de un jugador, como un susurro normal; en la del Keeper, en el hilo «Reglas · avisos de armas», que solo ve él.',
        'Overheating avisa también al Keeper cuando el arma se sobrecalienta.',
      ] },
    ],
  },
  {
    version: '2.17.10', date: '2026-11-17', title: 'V3 · Resolve en marcas amarillas',
    sections: [
      { title: 'Pestaña Ficha (rama V3, en pruebas)', items: [
        'Resolve se muestra como pequeñas marcas amarillas, una por punto: triángulos si son dados d4 y cuadrados si se compró la mejora a d6. Encendidas si el punto está disponible, apagadas si se ha gastado.',
      ] },
    ],
  },
  {
    version: '2.17.9', date: '2026-11-17', title: 'V3 · Distancias de peana a peana',
    sections: [
      { title: 'Distancias', items: [
        'La distancia entre dos tokens se mide de peana a peana (el hueco entre sus bordes), no entre centros: una criatura grande está en Melee cuando su peana toca la tuya, también en diagonal.',
        'Lo usan el ataque, la Ficha del jugador y la línea de objetivo del mapa. La regla de medir del mapa sigue midiendo entre los dos puntos que marcas.',
      ] },
    ],
  },
  {
    version: '2.17.8', date: '2026-11-17', title: 'V3 · Tokens que se deslizan y distancias que se recalculan',
    sections: [
      { title: 'Movimiento', items: [
        'Cuando un token cambia de sitio sin que lo arrastres tú (el movimiento de otro jugador, uno que confirma el Keeper, un deshacer), se desliza de un punto a otro en vez de aparecer de golpe. Los saltos muy largos (cambio de escena) no se animan.',
        'Si el atacante o el objetivo marcado se mueve, la Ficha recalcula la distancia, la penalización y si el ataque va con Ventaja o Desventaja.',
      ] },
    ],
  },
  {
    version: '2.17.7', date: '2026-11-17', title: 'V3 · Todas las propiedades de arma del Corebook, y modificadores en cada resultado',
    sections: [
      { title: 'Propiedades de arma (glosario del Corebook)', items: [
        'Se aplican solas: Reliable, Accurate, Smart Scope (tirada de ataque); Reach (alcance); Crushing, Phasing, Cutting, Vibration, Shield Piercing (Armor Slots que puede gastar el objetivo); Burst Fire, Massive, Energy Surge (daño extra); Devastating (+1 HP al llegar al umbral Severe); Energy, Phasing (penetración); Poison y Energy Surge (Stress); Ignite (On Fire) y Bleed (Bleeding); Overheating (d6 tras cada ataque).',
        'El resto sale como aviso tras el impacto, con lo que lo dispara, la tirada y la CD de característica del objeto (TT1 10, TT2 15, TT3 20, TT4 25): Stunning, Taser Charge, Entangling, Entrapping, Disorienting, Stagger, Continuous, Brittle, Armor Piercing, Shredding, Mind-Lock, Disintegrating, Unraveling, System Shock, Explosive, Automatic, Salvo Fire, Cleave, Quick, Reload, Suppressive, Probability Shift, Paired, Psionic y armas de área.',
        'La Ficha del jugador lista los efectos bajo el resultado del ataque.',
      ] },
      { title: 'Resultados y daño', items: [
        'Las tarjetas de resultado muestran siempre los modificadores de la tirada (dados, Trait, Ventaja/Desventaja, propiedades…), en todas las tiradas.',
        'Corregido: en la vista de jugador de la mesa del Keeper, «Aplicar daño» no cambiaba el HP del objetivo.',
      ] },
    ],
  },
  {
    version: '2.17.6', date: '2026-11-17', title: 'V3 · Armas de fuego de alcance Close sin Desventaja a Close ni en Melee',
    sections: [
      { title: 'Reglas de alcance', items: [
        'Regla de la mesa: cualquier arma de fuego con alcance máximo Close (o Very Close) no tiene Desventaja a Close ni en Melee, se llame como se llame (pistola, escopeta recortada, subfusil…). Así se sabe qué armas de fuego se pueden usar en Melee/Close.',
        'Un arma de alcance Far o más sigue teniendo Desventaja contra un objetivo en Melee, y pasarse del alcance del arma sigue dando Desventaja.',
        'Se retira la Desventaja de las pistolas a Close añadida en v2.17.1.',
      ] },
    ],
  },
  {
    version: '2.17.5', date: '2026-11-17', title: 'V3 · Alcance y propiedades de las armas en el ataque',
    sections: [
      { title: 'Reglas de las armas', items: [
        'Corregido: en fichas importadas el alcance venía junto al Trait («Agility · Melee») y el ataque no lo veía, así que un arma cuerpo a cuerpo atacaba a cualquier distancia y sin Desventaja por rango. Ahora se lee también de ahí, y la Ficha muestra el alcance real de cada arma.',
        'Si el objetivo está fuera de alcance (un arma cuerpo a cuerpo a distancia), el segundo toque no ataca: la Ficha ya dice por qué.',
        'Propiedades de arma en la tirada de ataque (Corebook): Reliable +1 siempre; Accurate +1 y Smart Scope +2 a Far o más. Reach permite atacar a Very Close con un arma cuerpo a cuerpo.',
        'Penetración: si la fórmula del panel no dice el tipo de daño, se usa el del arma (por ejemplo, «d6+1 ene.»: Energy, umbrales −2).',
        'Al marcar el objetivo, la Ficha lista también las propiedades que se aplican y la penetración del daño.',
      ] },
    ],
  },
  {
    version: '2.17.4', date: '2026-11-17', title: 'V3 · La Desventaja por alcance también con armas importadas',
    sections: [
      { title: 'Reglas de alcance', items: [
        'Corregido: si el arma de una ficha importada no indicaba su alcance en un formato conocido, no se aplicaba ningún límite y no había Desventaja por distancia.',
        'Ahora el alcance se lee también en español («Cercano», «Lejano», «Muy lejano», «Media») y en metros («15 m»); si la ficha no lo dice, se busca el arma del catálogo por su nombre en inglés o en español (por ejemplo, «Slug Pistol»); y si tampoco, se deduce del tipo de arma (pistola, rifle, francotirador, escopeta, cuchillo, espada…).',
        'Si aun así no se sabe, la Ficha lo dice al marcar el objetivo: «El arma no indica su alcance: no se aplica límite de distancia».',
      ] },
    ],
  },
  {
    version: '2.17.3', date: '2026-11-17', title: 'V3 · El ataque dice si va con Ventaja o Desventaja y ya se ejecuta en la vista de jugador local',
    sections: [
      { title: 'Atacar desde la Ficha (rama V3, en pruebas)', items: [
        'Al marcar el objetivo, la Ficha dice cómo será la tirada: «Con Desventaja», «Con Ventaja» o «Tirada normal», con cada motivo (alcance, arma fuera de competencia, Ventaja preparada).',
        'Corregido: en la vista de jugador de la mesa del Keeper (sin sala), el segundo toque en el objetivo mostraba «Selecciona uno de tus tokens asignados» y no atacaba. Ahora el personaje seleccionado en esa vista es el que se juega.',
      ] },
    ],
  },
  {
    version: '2.17.2', date: '2026-11-17', title: 'V3 · Experiencias siempre a la vista y ataque en dos toques',
    sections: [
      { title: 'Pestaña Ficha (rama V3, en pruebas)', items: [
        'Las experiencias se ven siempre en la ficha, bajo TIRAR. Se pueden elegir antes o después del Trait; si la ficha no tiene, lo dice.',
        'Atacar: toca el arma y luego el objetivo en el mapa; el primer toque lo marca (línea y distancia en el mapa) y la ficha muestra la distancia y la penalización que tendría. Un segundo toque en el mismo objetivo ataca; tocar otro cambia la marca; Esc cancela.',
      ] },
    ],
  },
  {
    version: '2.17.1', date: '2026-11-17', title: 'V3 · Ficha con defensa y recursos, resultados compactos y pistolas a Close',
    sections: [
      { title: 'Pestaña Ficha (rama V3, en pruebas)', items: [
        'Muestra Evasión, Umbrales (Major / Severe), Escudos, la armadura equipada, HP, Stress y Hope (Awakened) o Effort y Resolve (Sleeping), y en «Otros» lo pendiente: Ventaja preparada, bonificador para la próxima tirada y condiciones.',
        'Nuevo aspecto, igual que el panel de dados: líneas finas, celdas oscuras, etiquetas en mayúsculas y cian para lo seleccionado.',
        'Desventaja y Ventaja aparecen al seleccionar un Trait, y las experiencias con él, siempre con una entrada suave; al elegir una experiencia, la fila baja debajo de ellas con la misma animación.',
        'El resultado del ataque dice la distancia y, si la hay, la penalización por alcance y su motivo.',
      ] },
      { title: 'Resultados de las tiradas', items: [
        'Las tarjetas de resultado son más pequeñas y salen abajo en el centro, sobre la barra de estado (la zona de comunicaciones), con un máximo de tres a la vista. El detalle completo sigue en el registro y en el chat.',
      ] },
      { title: 'Reglas', items: [
        'Pistolas y armas cortas a Close o más lejos: Desventaja (Corebook, bandas de alcance: «Close: … Pistols take a penalty»). A Very Close y en Melee siguen sin penalización.',
      ] },
    ],
  },
  {
    version: '2.17.0', date: '2026-11-17', title: 'V3 · La ficha del jugador en el panel derecho',
    sections: [
      { title: 'Panel derecho del jugador (rama V3, en pruebas)', items: [
        'Para el jugador, el panel derecho tiene cinco pestañas: Ficha, Nave (por ahora), Dossiers, Registro y Chat. Relojes, Reparto y Escenas quedan para el Keeper; los relojes siguen viéndose sobre el mapa.',
        'Nueva pestaña «Ficha» («Mi personaje»), que se abre sola al pasar a jugador: nombre, clase y Path, «Ficha completa», TIRAR (los seis Traits en dos filas), experiencias, Ventaja/Desventaja y ATACAR. Sin personaje asignado explica cómo conseguirlo.',
        'TIRAR y ATACAR dejan de flotar sobre el mapa. En tablet, al elegir un arma el panel se cierra para tocar el objetivo y se vuelve a abrir con el resultado.',
        'El contador de la cabecera del panel cuenta solo las pestañas visibles (por ejemplo «01 / 05»).',
      ] },
    ],
  },
  {
    version: '2.16.1', date: '2026-11-17', title: 'V3 · Tirar en dos toques: Trait, ventaja y experiencias',
    sections: [
      { title: 'Barra del jugador (rama V3, en pruebas)', items: [
        'Un toque en un Trait lo selecciona y muestra debajo Desventaja y Ventaja. Un segundo toque en el Trait tira sin ventaja; Ventaja o Desventaja tiran con ella.',
        'Con un Trait seleccionado aparecen las experiencias del personaje. Al elegir una, Desventaja y Ventaja pasan debajo de las experiencias; un segundo toque en la experiencia tira Trait + experiencia, y Ventaja o Desventaja tiran con ella.',
        'Awakened: las experiencias solo están disponibles con Hope; al elegir una se marca el Hope que se va a gastar (en la barra y en el contador HOPE del personaje). Sleeping: la experiencia se marca y no cuesta nada.',
        'Esc o tocar otro Trait cambia o cancela la selección. En «⋯» quedan la DC y «Más opciones de tirada».',
      ] },
    ],
  },
  {
    version: '2.16.0', date: '2026-11-17', title: 'V3 · Vista del jugador: barra Tirar y Atacar, y los dados en un icono',
    sections: [
      { title: 'Barra del jugador (rama V3, en pruebas)', items: [
        'En postura de jugador, sobre la barra del personaje aparece la barra de acciones con lo que más se usa, a un toque.',
        'TIRAR: los seis Traits con su valor («FIN +1»); un toque tira contra la DC. En «⋯»: Desventaja / Normal / Ventaja, la DC y más opciones.',
        'ATACAR: un botón por arma (o «Desarmado»). Se toca el arma, luego el objetivo en el mapa (Esc cancela), y la mesa hace el resto: alcance, competencia, tirada y daño.',
        'RESULTADO: el último ataque queda en la barra, con el daño y la severidad, «Escudos» para que el defensor gaste Armor y «Aplicar daño» (paso aparte, decisión 8). Bear Down actualiza el daño.',
        'En postura de jugador se oculta el panel de capas, que no hace falta para jugar.',
      ] },
      { title: 'Dados en un icono', items: [
        'Los dados pasan a un icono transparente en la esquina superior derecha del mapa; la pestaña «Dados» del panel lateral desaparece.',
        'Para el jugador, el panel de dados solo da dados (d4 a d100). Tirar y atacar se hacen desde su barra.',
        'Para el Keeper, el panel conserva por ahora Dualidad, Dados estándar y Daño; su vista se simplifica en la siguiente fase.',
      ] },
    ],
  },
  {
    version: '2.15.2', date: '2026-11-17', title: 'V2 · El icono del mazo siempre a la vista',
    sections: [
      { title: 'Mazo', items: [
        'El icono del mazo, a la derecha de las cartas, se ve siempre: en la mano del Keeper, con un personaje Sleeping, con una ficha sin cartas y en postura de jugador sin personaje seleccionado (entonces la mano es solo el mazo).',
        'Con un personaje Awakened abre su mazo de siempre (Loadout, Vault y catálogo para añadir Poderes). En los demás casos abre «Mazo · Todos los poderes»: el catálogo completo para consultar, con filtro por Dominio y lectura de cada carta.',
      ] },
    ],
  },
  {
    version: '2.15.1', date: '2026-11-17', title: 'V2 · La sesión no caduca en la mesa, reintentos al entrar y Fear visible en tablet',
    sections: [
      { title: 'Sesión en la mesa', items: [
        'Mientras estás en la mesa, la sala ya no «caduca»: el latido que la mantiene viva (cada 5 s, con un margen de 20 s) sigue a su ritmo aunque la pestaña quede en segundo plano. Antes el navegador lo frenaba hasta una vez por minuto y la sala se daba por perdida.',
        'Un fallo de red puntual ya no desconecta: solo tres latidos fallidos seguidos cuentan como corte.',
        'Al volver a la pestaña, recuperar la red o enfocar la ventana, la mesa se reconecta al momento en vez de esperar al siguiente ciclo.',
      ] },
      { title: 'Entrar en una sala', items: [
        'Al entrar (desde el inicio, con invitación, desde SESIONES o al volver tras recargar) se muestra un panel «Entrando en la sala» con el intento, la cuenta atrás del siguiente («Reintentando en 4 s · intento 3») y el último error. Reintenta solo hasta conectar (2, 4, 8 y luego cada 15 s), y «Cancelar» vuelve al inicio.',
        'Si el error no tiene arreglo (la sala ya no existe, te han expulsado, falta iniciar sesión), se muestra como antes, sin reintentar.',
        'Ya dentro, si un jugador está esperando al Keeper o reconectando, o el Keeper está recuperando la sala, el mismo panel lo dice con su cuenta atrás y permite cancelar.',
      ] },
      { title: 'Fear en tablet', items: [
        'En pantallas de poca altura (tablets), al tocar o arrastrar una carta de la mano el navegador desplazaba el mapa para mostrarla entera, y la barra de Fear y el título de la escena salían de la pantalla, sobre todo como Keeper. El mapa, la mesa y la página ya no se desplazan.',
        '«Muéstramelo» de la guía ya no desplaza la vista.',
      ] },
    ],
  },
  {
    version: '2.15.0', date: '2026-11-17', title: 'V2 · Competencia tecnológica y catálogo de Poderes',
    sections: [
      { title: 'Equipo según la competencia', items: [
        'El buscador de equipo de la ficha y el catálogo completo muestran primero solo lo que el personaje puede usar según su clase, su nivel y su Technology Access (tablas de cada clase del Corebook): familias de armas, peso de armadura, tipo de aumento y Tech Tier. La casilla «Solo lo que puedo usar» viene marcada; al desmarcarla se ve todo.',
        'Encima del buscador aparece el entrenamiento del personaje, por ejemplo «Mystic · nivel 1 · Common (TT1): Light Armor, Melee/Pistols, Neural/Physical Augments». Military (TT2) llega a nivel 2 y Experimental (TT3) a nivel 5; el avance «+1 Technology Access Level» lo sube.',
        'Lo que queda fuera de la competencia lleva la etiqueta «Fuera de tu competencia · Desventaja», también en el inventario.',
      ] },
      { title: 'Desventaja fuera de la competencia', items: [
        'Usar algo fuera de la competencia tira siempre con Desventaja: el arma del ataque, el dron que se opera (su Grado por encima del acceso del operador) y la armadura o los aumentos que lleva puestos, que cuentan en cualquier tirada. El detalle del ataque o el resultado de la tirada dicen por qué.',
        'Failure with Fear al atacar: se recomienda que la consecuencia sea del arma (se encasquilla, se queda sin munición o se cae) o, con un dron, tirar la Drone Complication. En otras tiradas se sugiere que la consecuencia sea del equipo que intervino.',
        'Los PNJ y adversarios no tienen estas restricciones.',
      ] },
      { title: 'Catálogo de Poderes', items: [
        'El cajón del mazo muestra, además del Loadout y el Vault, todos los Poderes del juego, con filtro por Dominio. «Solo los de mi acceso» viene marcado: los Poderes de los Dominios del personaje hasta su nivel que aún no conoce. Desmarcado, se ven los 147; los que no están a su alcance aparecen atenuados.',
        'Un Poder a su alcance se puede leer y añadir al Vault; la mesa del Keeper lo valida.',
      ] },
      { title: 'Corrección', items: [
        'Un jugador conectado a una sala online no podía jugar cartas ni hacer Recall: la mesa del Keeper rechazaba esas acciones («This character is not assigned to you»). Ya se resuelven.',
      ] },
    ],
  },
  {
    version: '2.14.4', date: '2026-11-17', title: 'V2 · Armas a distancia largas en Melee con Desventaja',
    sections: [
      { title: 'Reglas', items: [
        'Un arma a distancia larga (rifle, carabina, ametralladora, lanzacohetes…) usada contra un objetivo en Melee ataca con Desventaja. El aviso del ataque lo explica.',
        'Las armas cortas no tienen esa penalización: pistolas, blásters de mano, revólveres y similares (Corebook: «point-blank pistol range»). Se reconocen por el nombre; un arma de la ficha puede marcarse a mano como corta o no.',
        'El Stress por ronda de Bleeding y el límite de una Fear Ability por criatura y ciclo de Spotlight se siguen aplicando a mano en la mesa, por decisión de diseño.',
      ] },
    ],
  },
  {
    version: '2.14.3', date: '2026-11-17', title: 'V2 · Tiradas de adversario con d20 y Bear Down sobre el daño',
    sections: [
      { title: 'Reglas', items: [
        'Cualquier tirada de un adversario en el panel de dados es ahora 1d20 + su modificador contra la DC, como su ataque (decisión 6: el texto del Corebook que hace tirar Dualidad al Keeper es una errata). Ventaja suma 1d6, Desventaja lo resta; un 20 natural es éxito crítico. Sin pago de senda ni Fear.',
        'El panel muestra el d20 en la primera casilla (etiqueta D20) y el registro escribe la cuenta completa: «d20 [12] + 2 = 14 vs DC 15».',
        'Bear Down también vale tras una tirada de daño (Corebook, cap. 7: «después de cualquier tirada de Dualidad, ataque, reacción o daño»). Si lo último que ha tirado el personaje es un daño aún sin aplicar, la carta suma sus dados de Resolve a ese daño con los mismos dados ya tirados, y se recalcula la severidad. Si el ataque falló, Bear Down sigue sumando a la tirada de ataque, como antes.',
      ] },
    ],
  },
  {
    version: '2.14.2', date: '2026-11-17', title: 'V2 · Idioma revisado pantalla a pantalla, móvil y primeros pasos en la ayuda',
    sections: [
      { title: 'Idioma', items: [
        'Revisión automática de todas las pantallas en los dos idiomas: unos 350 textos que se quedaban en el otro idioma ya cambian con el selector.',
        'Cubre lobby, ficha (estadísticas, rasgos y vínculos), ajustes del token, crear escena, entorno, boss, arcos, consola de dron, biblioteca de adversarios, importación de fichas, nave, herramientas de dibujo y agua, y la tarjeta de resultado de las tiradas («¡La acción sale bien, pero con un coste!…»).',
        'Las frases partidas por negritas (consola de dron, entorno) se reescribieron para poder traducirse enteras. Las bandas de alcance (Close, Far…) no se traducen dentro de los avisos de ataque.',
        'No se traducen, como antes: nombres, chat, registro, contenido de los libros (ancestries, adversarios, módulos, compendio de reglas), los datos de la campaña de ejemplo y los términos de reglas del Corebook.',
      ] },
      { title: 'Móvil y tablet', items: [
        'La mesa sigue pensada para ordenador o tablet. En un teléfono aparece una vez un aviso que lo explica y dice qué funciona bien ahí: seguir la partida, la ficha, los dados y el chat.',
        'Teléfono: la guía de primeros pasos empieza minimizada, se ocultan el panel de capas y los relojes sobre el mapa (siguen en la pestaña RELOJES) y el aviso «Sin cartas» es compacto.',
        'Tablet: el panel de capas pasa arriba a la derecha del mapa y ya no tapa la barra del personaje; el título de la cabecera deja de pisarse con la cuenta.',
      ] },
      { title: 'Primeros pasos', items: [
        'En AYUDA, la sección se llama ahora «Primeros pasos», con los botones «Volver a ver los primeros pasos» y «Empezar desde cero».',
        'Al cerrar la guía, un aviso recuerda que se puede volver a ver desde AYUDA.',
      ] },
    ],
  },
  {
    version: '2.14.1', date: '2026-11-17', title: 'V2 · Carga inicial más ligera',
    sections: [
      { title: 'Rendimiento', items: [
        'La pantalla de inicio aparece antes: con una conexión de 10 Mbit/s, en 1,7 s en lugar de 3,3 s; antes de verla se descargan 0,9 MB en lugar de 2,6 MB.',
        'El motor de dados 3D (física, WASM y texturas, varios MB) se precarga cuando la página ya ha cargado y el navegador está libre, en vez de competir con la primera pantalla. Una tirada antes de eso inicia el motor en el momento.',
        'Los datos de reglas de las cartas (unos 375 KB) se descargan solo cuando hay una mano de jugador que mostrar; la mesa del Keeper los carga al resolver la carta de un jugador conectado.',
        'Retratos de token a 512 px (se ven como mucho a unos 300 px): de 24,7 MB a 6,2 MB en total, unos 60 KB cada uno. Mapas de ejemplo de 1,9 MB a 0,5 MB. Mismas rutas y sin diferencia visible.',
      ] },
    ],
  },
  {
    version: '2.14.0', date: '2026-11-17', title: 'V2 · Guía de primer uso para jugadores y Keeper',
    sections: [
      { title: 'Guía de primer uso', items: [
        'Al llegar a la mesa aparece, en la esquina superior derecha del mapa, una lista corta de primeros pasos según tu papel.',
        'Jugador: ten tu personaje, abre tu ficha, mueve tu token, haz una tirada, usa una carta y escribe a la mesa.',
        'Keeper: crea tu sala (solo con salas online), prepara una escena, coloca un adversario, asigna un personaje, gasta Fear y haz una tirada.',
        'Cada paso se marca solo cuando lo haces de verdad en la mesa; no hay botón «Siguiente». Lo que ya existía al empezar (la campaña de ejemplo) no cuenta.',
        '«Muéstramelo» resalta el botón o la zona de la que habla el paso. Un paso se puede saltar; si después lo haces, cuenta como hecho.',
        'La guía se minimiza o se cierra, y el progreso se recuerda en este navegador para cada papel. Se vuelve a abrir, o se empieza de nuevo, desde AYUDA → Guía de primer uso.',
        'Funciona en español y en inglés, y en pantallas estrechas se coloca arriba a lo ancho.',
      ] },
    ],
  },
  {
    version: '2.13.0', date: '2026-11-17', title: 'V2 · Cuenta: tu personaje y tu última partida en cada sala',
    sections: [
      { title: 'Cuenta', items: [
        'En Partidas y notas, cada sala muestra el personaje que usas en ella (nombre, nivel, clase y senda) y la fecha de tu última partida. Si diriges la sala, solo la fecha.',
        'Las salas jugadas más recientemente aparecen antes (después de la partida en curso y de las que diriges).',
        'La mesa lo anota sola mientras juegas: al entrar en la sala, cuando cambia tu personaje (por ejemplo, al subir de nivel o cuando el Keeper te asigna otro) y cada 15 minutos de juego.',
      ] },
      { title: 'Firebase', items: [
        'Nueva colección privada users/{uid}/games/{roomId} con sus reglas en firestore.rules: hay que publicar las reglas de nuevo. Sin publicarlas, el registro se guarda solo en este navegador, sin avisos.',
      ] },
    ],
  },
  {
    version: '2.12.0', date: '2026-11-17', title: 'V2 · Cuenta: partidas y notas personales por partida',
    sections: [
      { title: 'Cuenta', items: [
        'La ventana de cuenta (esquina superior derecha, con sesión iniciada) se ordena en tres pestañas: Partidas y notas, Personajes y Preferencias.',
        'Partidas y notas lista las salas que diriges y en las que juegas, con tu papel (Keeper o Jugador) y su invitación. La partida en curso aparece primero y marcada. «Abrir sala» entra en otra sin pasar por el lobby.',
        'Cada partida guarda tus notas personales: crear, editar y eliminar, con título y texto. Son privadas: ni el Keeper ni los demás jugadores pueden leerlas.',
        'Las notas de una sala que ya no existe no se pierden: aparecen como «Sala no disponible».',
        'En SESIONES, dentro de una sala, el botón «Mis notas» abre directamente las notas de esa partida.',
        'La ventana de cuenta con sesión iniciada, que estaba solo en inglés, sigue ahora el selector de idioma.',
      ] },
    ],
  },
  {
    version: '2.11.1', date: '2026-11-17', title: 'V2 · Ayuda y avisos también en inglés',
    sections: [
      { title: 'Ayuda', items: [
        'La ayuda (botón ?) está escrita en español y en inglés y se muestra en el idioma elegido; si se cambia el idioma con la ayuda abierta, se redibuja sin perder la pestaña.',
        'Nueva sección «Idioma e inicio» y «Cartas y Loadout» en la guía rápida.',
        'Las notas de cada versión del Changelog se conservan en el idioma en que se escribieron (español); en inglés se indica.',
      ] },
      { title: 'Avisos y errores', items: [
        'Los avisos emergentes y los mensajes de error (unos 330) se muestran en el idioma elegido, también los que llevan nombres o cifras («No hay Fear suficiente: hacen falta 2 y quedan 0»).',
        'Los avisos antiguos que mezclaban los dos idiomas se leen ahora en uno solo.',
        'Un mensaje que llega de fuera (por ejemplo, un error de Firebase o del navegador) se muestra tal cual.',
      ] },
    ],
  },
  {
    version: '2.11.0', date: '2026-11-17', title: 'V2 · Interfaz en un solo idioma (español / inglés) y botón de inicio',
    sections: [
      { title: 'Idioma', items: [
        'La interfaz, que mezclaba español e inglés, se muestra entera en un idioma. Por defecto, español.',
        'Selector ES / EN en la barra inferior de la mesa y en la esquina del lobby. El idioma elegido se recuerda en este navegador.',
        'Se traducen botones, pestañas, etiquetas, avisos, títulos de ayuda emergente y textos con números (contadores, pasos, «TIRAR FINESSE (+1)»), también los que aparecen después de cargar.',
        'Los términos de reglas del Corebook (Hope, Fear, Stress, HP, Evasion, Armor Slots, Proficiency, Effort, Resolve y los Traits) se mantienen en inglés en los dos idiomas, como en los libros.',
        'No se traducen el chat, el registro, los nombres ni el texto de los libros (cartas, Poderes, habilidades de adversarios, módulos de dron).',
      ] },
      { title: 'Inicio', items: [
        'Botón ⌂ en la cabecera, y también el logo VEILFARERS, para volver a la pantalla de inicio (salas y personajes) sin cerrar la mesa.',
      ] },
      { title: 'Cabecera', items: [
        'La cabecera ya no se sale de la pantalla a 1440 px: el nombre de la campaña y la invitación se acortan para dejar visibles el logo, el selector de escena y todos los botones.',
      ] },
    ],
  },
  {
    version: '2.10.0', date: '2026-11-17', title: 'V2 · Mano del Keeper (Fear y adversarios), Bear Down y Effort como cartas',
    sections: [
      { title: 'Mano del Keeper', items: [
        'En vista de Keeper la zona inferior muestra una mano con las cuatro jugadas de Fear del Corebook: Spotlight Enemies (1), Declare a Complication (1), Interrupt an Action (2) y Ancestry Complication (1, tira 1d6).',
        'Con un adversario seleccionado se añaden sus habilidades impresas como cartas, con su tipo (Action, Reaction, Passive) y su coste en Fear. Se leen del texto del libro: tabla del Keeper\'s Companion, líneas de Alien Species y «Special» de Rust & Steel (158 habilidades en 42 adversarios).',
        'Jugar una carta gasta el Fear, la anuncia a la mesa (aviso y chat) y marca el punto del mapa si se suelta sobre él. Con «Tirada secreta» activada solo queda en el registro del Keeper.',
        'Spotlight Enemies con un adversario seleccionado le da el Spotlight y cobra 1 Fear una sola vez.',
        'Las pasivas se consultan, no se juegan. El aviso de cartas usadas por los jugadores sube por encima de la mano.',
      ] },
      { title: 'Sleeping: Bear Down y Effort', items: [
        'Bear Down y los Effort comunes (Steady Hands, Read the Room, Push Through, The Opening, Try Again, Brace, Cover the Angle) están en la mano de todo Sleeping. Second Wind y Seize the Moment, solo si el Keeper activa el módulo opcional.',
        'Bear Down gasta los dados de Resolve que elijas y suma todos (antes, uno por pulsación), como dice el Corebook. Nunca cambia qué dado es mayor ni crea un Crítico.',
        'Si se usa Bear Down tras un ataque fallido y el nuevo total alcanza la Evasion, el ataque pasa a impactar y se calcula el daño.',
        'Un Effort común sin Effort disponible se puede usar con Burnout desde la carta: pide confirmación y explica el coste (1 HP, 1 Stress y −1 al Stress máximo hasta la Recovery).',
      ] },
      { title: 'Corregido', items: [
        'Con el Keeper en vista de jugador, las tiradas, Effort, Bear Down, condiciones y cartas de los jugadores no se aplicaban en su mesa. Ahora sí, y se guardan (la corrección de la v2.9.7 pagaba la carta pero ese cambio no se guardaba en el navegador hasta el siguiente).',
      ] },
    ],
  },
  {
    version: '2.9.7', date: '2026-11-17', title: 'V2 · El Keeper ve la mano de cada personaje',
    sections: [
      { title: 'Mano de cartas', items: [
        'El Keeper, al pasar a modo jugador, ve la mano de cualquier personaje que seleccione, no solo la del personaje reclamado, y puede jugar sus cartas.',
        'Los personajes antiguos sin clase ni ancestry en la ficha las toman del texto de su papel: «Ace Pilot» da las cartas de Pilot y «Heavy Engineer // Sleeping Synthetic», las de Engineer y Synthetic.',
        'Si un personaje no tiene nada de lo que salen las cartas, la mano lo dice y ofrece abrir la ficha para completarla, en lugar de no mostrar nada.',
        'Corregido: si el Keeper estaba en vista de jugador cuando un jugador jugaba una carta o hacía un Recall, el coste no se aplicaba.',
      ] },
    ],
  },
  {
    version: '2.9.6', date: '2026-11-17', title: 'V2 · Cartas sin parpadeo',
    sections: [
      { title: 'Mano de cartas', items: [
        'Las cartas ya no parpadean al pasar el ratón por su borde. La carta se levantaba y dejaba de estar bajo el puntero, bajaba y volvía a estarlo, sin parar.',
        'Ahora la zona que detecta el ratón no se mueve: solo sube la cara visible de la carta, y mientras está levantada se puede subir el ratón hasta ella sin que baje.',
        'Si el ratón sale a mitad de la animación, la carta vuelve suavemente desde donde esté, sin saltos.',
        'La carta levantada se ve recta, sin el giro del abanico.',
      ] },
      { title: 'Keeper', items: [
        'Las cartas de la esquina inferior derecha ya no repiten su animación de entrada cada vez que llega o caduca otra.',
      ] },
    ],
  },
  {
    version: '2.9.5', date: '2026-11-17', title: 'V2 · Mazo con cajón, Gifts de Ancestry activos y aviso al Keeper',
    sections: [
      { title: 'Mazo', items: [
        'Después de las cartas de un Awakened hay un pequeño mazo con el número de Poderes del Vault. Al pulsarlo se abre un cajón sobre la mano.',
        'El cajón muestra el Loadout arriba y el Vault abajo. Se elige el momento (Long Rest, Short Rest o escena activa), la carta del Vault que entra y, si el Loadout está lleno, la que sale.',
        'El coste se ve antes de confirmar y no se paga nada hasta pulsar Recall. El cajón sigue abierto para hacer más cambios.',
      ] },
      { title: 'Cartas de Ancestry', items: [
        'Cada Gift que se usa (tiene un momento, un coste o un límite) es su propia carta, con su coste y su límite de usos. Los Gifts pasivos ya no aparecen en la mano: siguen en la ficha.',
        'Los «path resources» de un Gift se cobran en Hope a un Awakened y en Effort a un Sleeping. Lo que el Gift devuelve no se cobra.',
        'Una Ancestry con solo Gifts pasivos no añade carta.',
      ] },
      { title: 'Keeper', items: [
        'Cuando un jugador usa una carta, el Keeper la ve en pequeño en la esquina inferior derecha del mapa, con el nombre del personaje.',
        'Al pulsarla se abre en grande con quién la usó, lo que pagó y su efecto. Se guardan las cuatro últimas durante minuto y medio.',
        'La línea del chat dice quién la usó (jugador y personaje), qué carta es, su coste y su efecto completo.',
      ] },
    ],
  },
  {
    version: '2.9.4', date: '2026-11-17', title: 'V2 · Rendimiento: mapa más ligero y carga más rápida',
    sections: [
      { title: 'Mapa', items: [
        'La niebla de guerra ya no se recalcula en cada fotograma: solo cuando se mueve un personaje, cambia un muro o una puerta, cambia una luz o cambia lo explorado.',
        'Las luces fijas se dibujan una vez y se reutilizan; las que parpadean o pulsan se redibujan 30 veces por segundo en lugar de 60.',
        'Saber si un punto o un muro está explorado ya no pide una lectura a la tarjeta gráfica por cada consulta: se usa una copia reducida que se actualiza solo al cambiar lo explorado.',
        'El guardado de la exploración del Keeper solo se ejecuta cuando ha cambiado algo.',
      ] },
      { title: 'Carga', items: [
        'Las texturas de los dados 3D pesan 3,7 MB en lugar de 19,5 MB: la pantalla de acceso descarga unos 16 MB menos.',
        'Los 94 retratos de token pesan 25 MB en lugar de 79 MB, con la misma resolución (1024 px).',
      ] },
    ],
  },
  {
    version: '2.9.3', date: '2026-11-16', title: 'V2 · Cartas con el arte de Dominios y clases',
    sections: [
      { title: 'Mano de cartas', items: [
        'Las cartas siguen el diseño de referencia: marco dorado, bandera colgando en la esquina, banda con el nombre y el texto sobre fondo claro.',
        'Cada Poder lleva la bandera y la banda de su Dominio (Social, Void, Kinetic, Mind, Synthesys, Tech, Light), con su nivel sobre la bandera.',
        'Los Resolve Moves y la carta de clase llevan la bandera y la banda de su clase.',
        'Las cartas de Ancestry y de Background llevan su banda de esquina.',
        'El coste principal se ve en un hexágono en la esquina; tipo, Tier, costes y tirada van en etiquetas bajo el título, y Dominio, nivel y Recall Cost al pie.',
        'Los colores de cada Dominio pasan a ser los de su bandera.',
      ] },
    ],
  },
  {
    version: '2.9.2', date: '2026-11-16', title: 'V2 · Equipo más fácil de manejar',
    sections: [
      { title: 'Pestaña Armas y equipo', items: [
        'Todo se hace en la propia pestaña, sin abrir ventanas encima: buscar, añadir, cambiar cantidades, editar y quitar.',
        'Un buscador con categorías (Armas, Armadura, Equipo, Aumentos) muestra el catálogo según escribes; cada resultado se añade con un clic.',
        'Añadir una armadura sigue actualizando sus umbrales y Armor Slots.',
        'Las cantidades se cambian con − y +.',
        'Cada arma y objeto se edita en su propia fila. El Trait y el Alcance se eligen de una lista en vez de escribirse.',
        'Quitar pide confirmación en el mismo botón, para no borrar nada por un clic de más.',
        '«+ Arma propia» y «+ Objeto propio» crean entradas a medida; no se guardan hasta ponerles nombre.',
        'Cada cambio se guarda al momento: desaparece el botón «Guardar inventario».',
        'El botón de cada arma se llama ahora «Atacar» y la lleva al panel de dados.',
        'El editor completo anterior sigue disponible desde un enlace al pie.',
      ] },
    ],
  },
  {
    version: '2.9.1', date: '2026-11-16', title: 'V2 · Dron compartido con Neural Network Control',
    sections: [
      { title: 'Control compartido del dron', items: [
        'Un dron está emparejado con un solo operador. Si se le instala Neural Network Control (1 Cr, 0 Slots), el Keeper puede registrar a varios jugadores y todos lo controlan por turnos.',
        'Sin ese módulo, el control del token solo admite un jugador y avisa de qué módulo hace falta.',
        'Pasar el control: gratis con señal Stable; con señal Unstable quien lo recibe marca 1 Stress, y si no puede marcarlo el operador anterior conserva el control; con señal Lost la interfaz no funciona.',
        'El cambio de operador se hace en Ficha → Dron · módulos y señal y se anuncia en el chat. Mueve el Spotlight: no da Acciones extra.',
        'Si se retira el módulo, el dron se queda con un solo jugador. Los drones creados antes de estas reglas conservan sus controladores.',
      ] },
    ],
  },
  {
    version: '2.9.0', date: '2026-11-16', title: 'V2 · Mano de cartas: el Loadout en 3D junto a la ficha',
    sections: [
      { title: 'La mano', items: [
        'En postura de jugador, al seleccionar tu personaje la barra inferior se divide en dos: a la izquierda sus stats, a la derecha su mano de cartas en abanico.',
        'Las cartas son 3D: se levantan y se inclinan hacia el puntero al pasar por encima, con el coste, la tirada y el Recall Cost a la vista.',
        'Un Awakened tiene en la mano los Poderes de su Loadout, su Hope Feature, la carta de su Ancestry y la de su Background.',
        'Un Sleeping tiene sus Resolve Moves, su Effort Feature, su Ancestry y su Background.',
        'El Mystic Sleeping tiene además los Poderes de su Uncanny Archive, que se juegan con Uncanny Power.',
      ] },
      { title: 'Jugar una carta', items: [
        'Un clic abre la carta en grande con su texto completo. Arrastrarla y soltarla sobre el mapa la juega en ese punto.',
        'Al jugarla se paga su coste impreso (Hope, Stress, Effort, Resolve o HP). Si no hay recursos, o estás Overwhelmed y cuesta Stress, no se juega y se explica por qué.',
        'La jugada se anuncia con una tarjeta a la derecha, una línea en el chat y una señal en el punto del mapa.',
        'Si el Poder pide tirada, el panel de dados queda preparado con su Trait y su DC: solo falta pulsar ROLL.',
        'Un Resolve Move tira sus dados de Resolve. Los Moves de coste abierto preguntan cuánto Resolve gastas.',
        'Uncanny Power: gastas Resolve, se tiran los dados más Knowledge para ver el nivel que alcanzas, el Keeper gana 1 Fear por Resolve y la tirada es Knowledge contra DC 10 + nivel. El coste de Hope se ignora.',
        'Las cartas pasivas, las reacciones del Archivo y los proyectos a largo plazo se consultan pero no se juegan.',
      ] },
      { title: 'Vault y Recall', items: [
        'El botón Vault muestra los Poderes que conoces y no tienes preparados.',
        'Recall los trae al Loadout pagando lo que marca el Corebook: gratis en un Long Rest, su Recall Cost en Stress en un Short Rest, y en una escena activa además 1 Hope y tu Acción.',
        'Si el Loadout está lleno, eliges qué Poder pasa al Vault.',
      ] },
    ],
  },
  {
    version: '2.8.10', date: '2026-11-16', title: 'V2 · Drones según el Corebook: Grado, Módulos y señal',
    sections: [
      { title: 'Montar un dron', items: [
        'ROSTER → + DRONE abre la consola del dron: se elige el Grado (Common, Military o Experimental) y sus Módulos, como en el capítulo 14 del Corebook. Las plantillas anteriores, con valores que no eran del libro, desaparecen.',
        'El Grado fija HP, Evasion, umbrales, Armor Slots y Module Slots: Common 2 HP / 10 / 5-11 / 0 / 2; Military 3 HP / 11 / 7-14 / 1 / 3; Experimental 5 HP / 12 / 9-16 / 2 / 4.',
        'Catálogo de 102 módulos con su coste, Slots y texto: los 31 del Corebook y 71 de Rust & Steel. Se puede buscar y filtrar por los que admite el Grado.',
        'Las ocho configuraciones de ejemplo del libro (Cheap Scout Mote, Security Stun Drone, Ghost-Signal Infiltrator…) se cargan con un clic.',
        'Se avisa si faltan Slots, si un módulo es de un Grado superior (modificación ilegal, con su tirada de Knowledge (Tech)) o si se monta un arma letal en un dron Common.',
        'Agile Servos, Armor Plating, Reinforced Plating y otros módulos ajustan Evasion, Armor Slots y umbrales, sin pasar del máximo de Evasion del Grado.',
      ] },
      { title: 'En la mesa', items: [
        'Cada dron tiene operador, estado de señal (Stable, Unstable, Lost), tipo de enlace y protocolo si pierde la señal. Se cambian en Ficha → Dron · módulos y señal.',
        'Atacar con un dron es la Acción y la tirada de su operador: tira Hope y Fear con los Traits del operador. Con señal Unstable el ataque tiene Desventaja; con señal Lost no se puede ordenar.',
        'Un dron con la señal Lost tiene Evasion −2 cuando lo atacan.',
        'El daño de las armas de dron no escala con Proficiency.',
        'Botón para tirar la Drone Complication (d12); los resultados de señal y de HP se aplican solos.',
        'Los módulos se pueden marcar offline. Un dron creado con las plantillas antiguas pide elegir Grado y módulos al abrir su consola.',
      ] },
    ],
  },
  {
    version: '2.8.9', date: '2026-11-16', title: 'V2 · Documentación al día',
    sections: [
      { title: 'Documentación', items: [
        'README.md, PRUEBAS_LOCALES.md y FIREBASE_SETUP.md describen la V2: lobby y biblioteca de la cuenta, creador, subida de nivel, ataque completo, alcances, daño en 3D, panel único de resultados y niebla con degradado. Seguían indicando v1.4.0.',
        'Se retiran de la documentación las instrucciones de Netlify Identity.',
        'La versión que muestran README.md y PRUEBAS_LOCALES.md se escribe sola al generar el changelog, y la comprobación de versión falla si se quedan atrás.',
      ] },
    ],
  },
  {
    version: '2.8.8', date: '2026-11-16', title: 'V2 · Luces y niebla de guerra con degradado',
    sections: [
      { title: 'Visión y luces', items: [
        'La visión y las luces en zona abierta vuelven a ser redondas: antes salían como un cuadrado de lados rectos.',
        'La visión se desvanece en el último tramo de su alcance en lugar de acabar en una línea.',
        'Los bordes de la niebla de guerra y de las sombras de las luces se dibujan difuminados. Los muros siguen cortando la visión.',
        'La zona explorada que se recupera al cargar la partida ya no muestra escalones marcados.',
      ] },
    ],
  },
  {
    version: '2.8.7', date: '2026-11-16', title: 'V2 · 72 retratos canonicos por Ancestry, Genero y Tipologias con selector interactivo y correccion de anatomia alienigena',
    sections: [
      { title: 'Tokens y Retratos Canonicos', items: [
        'Correccion rigurosa de anatomia segun el lore de Alien Species y Corebook: Kryx es ahora un feroz licantropo lupino humanoide (hombre lobo) con pelaje shadowsteel y crestas cian bioluminiscentes; Kryllian es un insectoide esbelto de cuatro brazos tipo mantis religiosa; Rift Spinner es estrictamente no humanoide, un aracnido cristalino prismatico de 8 extremidades.',
        '72 retratos dedicados cubriendo las 9 ancestries x 2 generos x 4 tipologias canonicas: Guerrero / Vanguard, Erudito / Mago, Picaro / Explorador y Tecnico / Cientifico.',
        'Selector interactivo de tipologia en el Creador de Personajes (Paso 9: Detalles) para alternar en vivo entre las 4 variantes de rol con previsualizacion inmediata.',
        'Asignacion automatica por clase o rol al importar personajes JSON (Jarana como Vanguard Rift Spinner femenina, Brok como Soldier Kryx masculino, Lucy Fer como Mystic femenina, Miles como Diplomat/Tech masculino).',
      ] },
      { title: 'Importacion de Personajes', items: [
        'Compatibilidad universal e insensible a mayusculas para cualquier JSON generado por Veilfarers Character Creator o herramientas legacy.',
        'Deteccion automatica e inferencia de formato basada en campos estructurales, garantizando que ninguna ficha valida sea rechazada con formato no reconocido.',
      ] },
    ],
  },
  {
    version: '2.8.6', date: '2026-11-16', title: 'V2 · Retratos canónicos para cada Ancestry por género y asignación automática',
    sections: [
      { title: 'Tokens y Retratos', items: [
        'Galería de 18 retratos de tokens canónicos cubriendo las 9 ancestries oficiales de Veilfarers (Ailuran, Bloomstrider, Celestiari, Ethereal, Human, Kryllian, Kryx, Rift Spinner y Synthetic) con variantes femenina y masculina en alta resolución.',
        'Asignación automática e inteligente de avatar al importar personajes o crear nuevos actores según su ancestry, pronombres y morfología de nombre.',
        'Vista previa en tiempo real del retrato asignado en el asistente de creación de personajes (Paso 9: Detalles) y en las tarjetas de ingesta de fichas JSON.',
        'Mantiene los retratos personalizados existentes sin sobreescribir imágenes configuradas manualmente.',
      ] },
    ],
  },

  {
    version: '2.8.5', date: '2026-11-16', title: 'V2 · Compatibilidad con fichas exportadas desde Veilfarers Character Creator',
    sections: [
      { title: 'Importación de Personajes', items: [
        'Admite fichas creadas con el creador original Veilfarers Character Creator (versiones 2.41, 2.74 y gama 2.x) además del formato de Character Sheet y VTT Actor.',
        'Detección automática e inferencia de senda (Sleeping vs Awakened) cuando el campo chosen_path viene vacío o sin indicar en fichas del creador.',
        'Extracción robusta de atributos firmados (+1, -1, +0), umbrales, bonificador de Honed Edge, dados de Resolve y armadura.',
        'Carga completa de armamento, equipo, notas de trasfondo, aumentos y experiencias activas para los nuevos personajes importados.',
        'Validación de actores en mesa y sincronización de red habilitadas para fuentes de Character Creator sin rechazos de esquema.',
      ] },
    ],
  },
  {
    version: '2.8.4', date: '2026-11-16', title: 'V2 · Un solo panel de resultados, con las tiradas de toda la mesa',
    sections: [
      { title: 'Resultados de tiradas', items: [
        'Cada tirada se anuncia una sola vez: la tarjeta dorada de la derecha y la línea del chat. Desaparece el marcador inferior que repetía el resultado.',
        'El panel de la derecha apila las tiradas de todos, en el orden en que llegan: si varias personas lanzan a la vez se ven todos los resultados (hasta 6, 20 segundos cada uno; un clic cierra la tarjeta).',
        'El ataque de un adversario y el daño también llegan como tarjeta al resto de la mesa, salvo que la tirada sea secreta del Keeper.',
      ] },
    ],
  },
  {
    version: '2.8.3', date: '2026-11-16', title: 'V2 · El d6 de Desventaja se ve entero y sin arma solo se ataca en Melee',
    sections: [
      { title: 'Tiradas', items: [
        'El aviso de la tirada ya no resume todo en un único "Mod": escribe la suma completa, por ejemplo "Hope [2] + Fear [4] + 2 − d6 [6] (Desventaja) = 2". Antes el d6 quedaba mezclado con el Trait y parecía que solo se restaba una parte.',
        'El mismo desglose aparece en el panel, el chat y el registro, también con Ventaja y con el dado de Resolve.',
      ] },
      { title: 'Ataque', items: [
        'Sin arma el ataque es cuerpo a cuerpo: no se puede atacar a un objetivo fuera de Melee.',
      ] },
    ],
  },
  {
    version: '2.8.2', date: '2026-11-16', title: 'V2 · Indicador de Desventaja en botón de acción, Proficiency en HUD y robustez de audio Web Audio',
    sections: [
      { title: 'Tiradas y Dados', items: [
        'Los botones de selección de tirada (DIS / NORM / ADV) actualizan de inmediato la etiqueta del botón principal de acción con [DIS -1d6] y [ADV +1d6].',
        'El dado d6 de Desventaja en 3D utiliza el tema canónico de dados de miedo (vfFear).',
        'El HUD quickbar de tokens de personajes jugadores (PCs) ahora muestra explícitamente Evasion y Proficiency junto a los puntos de Esperanza/Esfuerzo.',
        'La inicialización del sintetizador Web Audio API es segura ante navegadores o entornos sin AudioContext.',
      ] },
    ],
  },
  {
    version: '2.8.1', date: '2026-11-16', title: 'V2 · Un solo acceso: la cuenta de la VTT',
    sections: [
      { title: 'Cuenta', items: [
        'Se retira el acceso con Netlify Identity. Se entra con correo y contraseña, con Google o como invitado en local.',
        'La pantalla de cuenta y los avisos de error ya no ofrecen Netlify Identity como alternativa.',
        'La página deja de cargar el widget externo de Netlify Identity.',
        'Las salas, los personajes, las escenas y las notas se guardan siempre en la cuenta de la VTT.',
      ] },
    ],
  },
  {
    version: '2.8.0', date: '2026-11-16', title: 'V2 · Dados 3D en ataque y daño, Proficiency al día y biblioteca privada en el lobby',
    sections: [
      { title: 'Ataque', items: [
        'La Desventaja (y la Ventaja) tira su d6 en la mesa y el resultado se resta (o suma) a la vista: aparece en el panel, en el aviso de la tirada, en el chat y en el registro, separado del resto de modificadores.',
        'El ataque de un adversario tira su d20 en 3D, con el d6 de Ventaja o Desventaja cuando toca.',
        'El dado de Resolve que cae en la mesa es el que cuenta: antes se tiraba en 3D pero se usaba otro valor.',
      ] },
      { title: 'Daño', items: [
        'Los dados de daño se tiran en 3D y sus caras son el daño: tantos dados como diga el arma con su Proficiency, y el doble en un Crítico de jugador.',
        'Un Crítico del Keeper sigue siendo daño máximo, sin tirar.',
        'Con más de 40 dados o con los dados 3D desactivados, el daño se calcula como antes.',
      ] },
      { title: 'Proficiency y Honed Edge', items: [
        'Al subir de nivel, el panel de daño usa la Proficiency nueva sin tener que volver a preparar el arma. Un valor escrito a mano se respeta.',
        'Honed Edge de un Sleeping es su nivel − 1 y se actualiza al subir de nivel.',
        'Una ficha importada con el daño "final" ya calculado vuelve al daño base del arma al subir de nivel, para que Proficiency y Honed Edge se apliquen con su valor actual.',
      ] },
      { title: 'Lobby', items: [
        'El panel de personajes del lobby es ahora "Mis personajes": la biblioteca privada de tu cuenta. Se pueden crear, importar desde JSON, descargar y borrar.',
        'El almacén compartido anterior deja de usarse; sus datos no se han borrado.',
        'En modo invitado no hay biblioteca: se puede crear un personaje y descargar su ficha.',
      ] },
    ],
  },
  {
    version: '2.7.1', date: '2026-11-15', title: 'V2 · Creador: selección de equipo y listado de poderes más claros',
    sections: [
      { title: 'Equipo inicial', items: [
        'Resumen "Tu equipo" arriba, con el arma, la armadura y los objetos de clase elegidos.',
        'Cada arma muestra por separado Daño, Alcance, Trait y Carga; cada armadura, sus umbrales ya con el nivel, Armor Slots y capacidad de mejoras.',
        'Cada propiedad (Armor Piercing, Reliable, Life Support…) aparece con la explicación de lo que hace.',
        'Las opciones se agrupan por categoría, con un buscador por nombre, categoría o propiedad.',
        'Las armas que atacan con uno de los mejores Traits del personaje se marcan como recomendadas y salen primero.',
        'Se indica qué categorías de armas y armaduras puede usar la clase.',
      ] },
      { title: 'Poderes', items: [
        'Resumen del Starter Loadout con los Poderes ya elegidos.',
        'Cada Poder muestra Tipo, Coste, Tirada y Recall por separado y su texto completo, sin recortar.',
        'Una línea explica qué significa cada dato.',
        'En la ficha, la pestaña Rasgos muestra los Poderes como tarjetas con sus etiquetas (Dominio, nivel, tipo, coste, tirada, Recall).',
      ] },
    ],
  },
  {
    version: '2.7.0', date: '2026-11-15', title: 'V2 · Resolve Moves de los Sleeping y Awakening en juego',
    sections: [
      { title: 'Resolve Moves (Corebook, cap. 7)', items: [
        'Catálogo de los 42 Resolve Moves: dos por clase y uno por subclase.',
        'Al crear un personaje Sleeping, la ficha recibe sola los dos Class Moves de su clase y el Move de su subclase. El creador los muestra en el paso de Poderes.',
        'Al subir de nivel, un multiclass Sleeping aprende exactamente un Class Resolve Move de la segunda clase, elegido de la lista.',
        'La opción de Move nuevo solo se ofrece si a la ficha le falta alguno de los de su clase y subclase; si ya los tiene todos, la opción es +1 Resolve máximo.',
      ] },
      { title: 'Awakening en juego (Corebook, cap. 7)', items: [
        'Nuevo botón Despertar en la ficha de un personaje Sleeping (vista Completa, solo el Keeper), para cuando la historia lo establece.',
        'El Effort actual pasa a ser Hope. Se retiran el Resolve, los Resolve Moves, Honed Edge y el Recovery Anchor. Las Experiencias se conservan.',
        'El Effort Feature y el Class Feature se sustituyen por el Hope Feature y el Class Feature de Awakened. La subclase conserva su rango; The Steward pasa a ser The Icon.',
        'Se abre el Vault y el Loadout con dos Poderes de nivel 1 de los Dominios de la clase. Un Mystic elige su Veil Alignment.',
        'Si había hecho multiclass, su Dominio latente pasa a estar activo, sin Poderes iniciales.',
        'Se devuelven los Advancement Slots gastados en +1 Resolve, Moves o Tempered Resolve. El botón Gastar Slots devueltos permite volver a gastarlos sin cambiar de nivel.',
      ] },
    ],
  },
  {
    version: '2.6.2', date: '2026-11-15', title: 'V2 · Creador: herencia humana y guardado en la cuenta',
    sections: [
      { title: 'Creador de personajes', items: [
        'Humanos: Inheritance of the Builders (Corebook, cap. 3). Al elegir Human se escoge una de las dos herencias: The Graft, un aumento Common o Military gratis y sin inconveniente (el Common no ocupa Augment Slot, el Military ocupa uno), o The Tool, un objeto Experimental de 9 Cr de cualquier catálogo.',
        'La ficha registra la herencia: el aumento aparece en Rasgos junto al +2 Augment Capacity de Made for the Graft, y The Tool entra en el equipo.',
        'Guardar en mi cuenta: con la sesión iniciada, el personaje terminado se guarda en tu biblioteca. Guardarlo otra vez actualiza la misma entrada.',
        'Desde la cuenta, Use in game trae el personaje guardado a la mesa.',
      ] },
    ],
  },
  {
    version: '2.6.1', date: '2026-11-15', title: 'V2 · Creación y subida de nivel ajustadas al canon del Corebook',
    sections: [
      { title: 'Creación de personaje · correcciones de canon (Corebook 12.06, cap. 8)', items: [
        'Experiencias iniciales: un personaje Awakened empieza con dos a +2 y uno Sleeping con tres. Antes el creador pedía tres a todos.',
        'Equipo inicial: un arma y una armadura de Tier 1, además de los objetos de clase. Antes permitía dos armas dentro de un presupuesto.',
        'Afiliaciones: las nueve del Corebook (seis Casas, Free Fleet, Explorers\' Guild e Independent) son las opciones normales. Solara Compact y Stellar Commerce Guild aparecen como opción avanzada, y Church of the Eternal Veil y House Kaelen como fuera del Corebook; las cuatro avisan de que requieren aprobación del Keeper.',
        'Independent no tiene Standing ni Calls: lleva una Favor Pool de 1 Favor por sesión.',
      ] },
      { title: 'Subida de nivel con el catálogo de reglas', items: [
        'Nuevo Poder (Awakened): se elige de una lista con los Poderes de los Dominios del personaje que su nivel permite y que aún no tiene; entra en el Vault.',
        'Experiencias: en el Logro de Tier o en un Slot se puede subir dos Experiencias +1 o añadir una nueva a +2 y subir una. El máximo son cinco Experiencias.',
        'Multiclass: se elige la segunda Clase, un Dominio realmente nuevo y se responde a su pregunta de trasfondo. El Dominio nuevo progresa a la mitad del nivel, redondeando hacia arriba; en un Sleeping queda latente.',
        'Upgraded Subclass: añade a la ficha el rasgo completo de Specialization o de Mastery de la subclase.',
        'La capacidad del Loadout sigue el Tier: 5 Poderes en Tier 1, 6 en Tier 2 y 7 en Tier 3.',
      ] },
    ],
  },
  {
    version: '2.6.0', date: '2026-11-15', title: 'V2 · Creador de personajes dentro de la VTT',
    sections: [
      { title: 'Creador de personajes', items: [
        'Nueva sección para crear personajes paso a paso, adaptada del Character Creator: Ancestry, Community, Path con Class y Subclass, Traits, Experiencias, Afiliación, Poderes, Equipo y Detalles.',
        'Incluye las 9 ancestries, 7 communities, 9 clases con sus 3 subclases por senda (Awakened y Sleeping), 13 afiliaciones, los Poderes de nivel 1 de los 7 Dominios y el equipo Common del Corebook, con Rust & Steel opcional.',
        'Aplica las reglas de creación: los Traits se reparten con los valores +2, +1, +1, 0, 0, −1; tres Experiencias a +2; dos Poderes de nivel 1 de los Dominios de la clase (el Mystic elige Veil Alignment y el Vanguard según su subclase); armas y armadura dentro del acceso tecnológico de la clase, con 4 créditos para cada cosa.',
        'Cada paso marca cuándo está completo; cambiar una elección anterior limpia lo que dependía de ella. El borrador se guarda solo en el navegador.',
      ] },
      { title: 'Llevar la ficha a la mesa', items: [
        'Al terminar, el Keeper puede crear el personaje como token nuevo en la escena o asignar la ficha a un token que ya existe, que conserva su posición, color y jugador.',
        'También se puede descargar la ficha en JSON, en el mismo formato que la VTT ya importa.',
        'El personaje llega con sus HP, Evasion, Stress, umbrales (armadura + nivel), Armor Slots, armas con alcance y daño, Poderes, Experiencias y afiliación.',
      ] },
      { title: 'Dónde está', items: [
        'Botón + PERSONAJE en la pestaña Roster de la mesa y botón Crear personaje en el Character Vault del lobby.',
      ] },
    ],
  },
  {
    version: '2.5.0', date: '2026-11-15', title: 'V2 · Fase 1: Subida de nivel',
    sections: [
      { title: 'Subida de nivel', items: [
        'Nuevo botón Subir de nivel en la ficha (vista Completa, solo el Keeper). Aplica las reglas del Corebook, cap. 12, hasta el nivel 10.',
        'Cada nivel da dos Advancement Slots: +1 HP, +1 Stress, +1 a dos Experiencias, +1 a un Trait (una vez por Tier y Trait), +1 Evasion, +1 Technology Access, Nuevo Poder o Resolve, y las opciones de dos Slots: +1 Proficiency, Multiclass, Upgraded Subclass y Tempered Resolve. Las que no están disponibles aparecen desactivadas con el motivo.',
        'Los niveles 2, 5 y 8 añaden el Logro de Tier: +1 Proficiency y +1 a dos Experiencias.',
        'Los personajes Sleeping ganan +1 Resolve máximo en los niveles 3, 5, 7 y 9, hasta 6.',
        'Los umbrales Major y Severe suben 1 con el nivel.',
        'Si queda un Slot sin gastar, la ficha avisa de que se pierde y pide confirmarlo.',
        'El historial de avance queda en la pestaña Rasgos y en el registro de la partida.',
      ] },
    ],
  },
  {
    version: '2.4.1', date: '2026-11-15', title: 'V2 · Alcance corregido, aviso de muros y bandas en el lock',
    sections: [
      { title: 'Alcance', items: [
        'Bandas de alcance de la mesa: Melee (casilla adyacente o hasta 1 m), Very Close (hasta 5 m), Close (hasta 10 m), Far (hasta 25 m) y Extreme (más de 25 m). El ataque, la línea de lock y la regla de medir usan ahora las mismas bandas y la misma escala.',
        'Corregido: un arma cuya ficha no indicaba alcance no recibía Desventaja a larga distancia. Ahora toma el alcance del arma del catálogo con el mismo nombre; si aun así no se conoce, el resultado lo dice.',
        'Corregido: la línea de lock medía a 1,5 m por casilla y la regla a 2 m. Ambas usan la escala del mapa.',
      ] },
      { title: 'Línea de tiro', items: [
        'Si hay un muro o una puerta cerrada entre atacante y objetivo, el resultado del ataque avisa de que la línea de tiro está bloqueada. El ataque se puede lanzar igualmente. Ventanas y puertas abiertas no bloquean.',
        'La etiqueta de la línea de lock muestra la banda de juego junto a la distancia en metros y casillas, y BLOQUEADO cuando hay un obstáculo.',
        'El resultado del ataque muestra la banda, los metros y las casillas hasta el objetivo.',
      ] },
    ],
  },
  {
    version: '2.4.0', date: '2026-11-15', title: 'V2 · Ataque completo: tirada, alcance y daño solo si impacta',
    sections: [
      { title: 'Ataques', items: [
        'Nuevo botón ATACAR AL OBJETIVO en el panel de daño: hace el proceso entero. Primero la tirada de ataque contra la Evasion del objetivo y, solo si impacta, calcula el daño. Si falla no hay daño.',
        'Los personajes jugadores atacan con Hope y Fear (2d12) más el Trait del arma y sus modificadores; la tirada paga Hope, Effort o Fear como cualquier tirada de Dualidad. Con dados iguales es crítico: impacta siempre y dobla los dados de daño.',
        'Los adversarios del Keeper atacan con 1d20 más su modificador de Ataque. Un 20 natural es crítico: impacta siempre y hace el daño máximo.',
        'Ventaja y Desventaja suman o restan 1d6 y se anulan entre sí.',
        'Aplicar el daño sigue siendo un paso aparte, para que el defensor decida si gasta Armor Slots.',
      ] },
      { title: 'Alcance', items: [
        'El ataque mide la distancia entre los dos tokens y la traduce a la banda del Corebook: Melee (casilla adyacente), Very Close (hasta 5 m), Close (hasta 20 m), Far (hasta 100 m) y Very Far.',
        'Un arma cuerpo a cuerpo solo puede atacar a un objetivo en Melee; fuera de esa distancia el ataque no se tira.',
        'Un arma a distancia usada más allá de la banda que cubre ataca con Desventaja.',
        'El resultado indica la banda, el alcance del arma y el motivo de la Desventaja o del bloqueo.',
      ] },
      { title: 'Chat', items: [
        'Pulsar Intro sobre el mapa abre el chat de la mesa listo para escribir. No actúa si hay una ventana abierta, un campo o botón con el foco, o una zona de agua a medio dibujar.',
      ] },
      { title: 'Otros', items: [
        'El botón de daño directo se mantiene como "Solo daño (sin tirada de ataque)" para peligros, caídas y efectos que no son un ataque.',
      ] },
    ],
  },
  {
    version: '2.3.3', date: '2026-11-15', title: 'V2 · Daño: armas Crushing y Bleed',
    sections: [
      { title: 'Resolución de daño', items: [
        'Crushing: el impacto ignora 1 Armor Slot del objetivo, que no puede gastarlo contra ese golpe (con un solo slot, no puede mitigar). El slot ignorado no se consume. La armadura Composite lo anula.',
        'Bleed: cualquier impacto deja al objetivo con la condición Bleeding, sea cual sea su gravedad e incluso si la armadura lo absorbe. Los objetivos que no sangran (Synthetics) son inmunes.',
        'Ambos tags se leen de las propiedades del arma elegida y la armadura Composite se detecta en el objetivo; los tres se pueden marcar a mano en Opciones avanzadas.',
        'El resultado del daño indica cuándo se aplica cada tag o por qué se anula.',
      ] },
    ],
  },
  {
    version: '2.3.2', date: '2026-11-15', title: 'V2 · Daño: Penetración por tipo de daño',
    sections: [
      { title: 'Resolución de daño', items: [
        'Penetración según el Corebook (cap. 10): el daño Energy baja 2 los umbrales Major y Severe del objetivo para ese impacto; Void y Neural los bajan 4. Physical no los cambia. La Penetración no ignora la armadura.',
        'El tipo de daño se toma del arma o de la expresión (por ejemplo "1d8 ene." o "1d10 void") y se puede elegir a mano en Opciones avanzadas.',
        'La armadura Reflective anula la Penetración de Energy y un Ward anula la de Void y Neural. La armadura Reflective del objetivo se detecta sola; el Ward se marca en Opciones avanzadas.',
        'Un impacto Neural marca además 1 Stress al objetivo.',
        'El Overkill (1 HP extra por cada 10 puntos sobre Severe) cuenta desde el umbral ya reducido. El resultado muestra los umbrales originales y los aplicados al impacto.',
        'Se pueden gastar tantos Armor Slots como haya disponibles para mitigar un mismo impacto.',
      ] },
    ],
  },
  {
    version: '2.3.1', date: '2026-11-15', title: 'V2 · Daño: la armadura ya no se gasta sola',
    sections: [
      { title: 'Resolución de daño', items: [
        'Corregido: un impacto por debajo del umbral Major aparecía como "Deflected · 0 HP" porque el cálculo gastaba un Armor Slot por su cuenta. Ahora marca 1 HP (Minor), como indica el Corebook.',
        'Gastar armadura es decisión del defensor: la casilla "El defensor gasta 1 Armor Slot" empieza desmarcada y el botón Gastar escudos sigue disponible tras calcular.',
        'Con un objetivo elegido, el cálculo usa siempre los umbrales Major y Severe de ese token, de modo que lo que se muestra coincide con lo que se aplica aunque los campos manuales tuvieran otros valores.',
      ] },
    ],
  },
  {
    version: '2.3.0', date: '2026-11-14', title: 'V2 · Fase 1: Ficha en vista Básica o Completa',
    sections: [
      { title: 'Fichas', items: [
        'La ficha tiene dos vistas, con un conmutador junto a Guardar ficha. Básica muestra lo que se usa en mesa: condiciones, Proficiency, Evasion, recursos actuales, umbrales, Traits y notas, sin necesidad de desplazarse.',
        'Completa añade nombre, clase, ancestry y nivel, los máximos de cada recurso, la configuración de la senda Sleeping, el JSON original, las exportaciones y los ajustes del token.',
        'Los jugadores abren la ficha en Básica y el Keeper en Completa; la vista elegida se recuerda en el navegador.',
        'Guardar en vista Básica conserva todos los datos que no se ven.',
      ] },
    ],
  },
  {
    version: '2.2.3', date: '2026-11-14', title: 'V2 · Vínculos visible en todos los personajes',
    sections: [
      { title: 'Fichas', items: [
        'Corregido: la pestaña Vínculos solo aparecía en fichas importadas que ya traían afiliaciones o conexiones. Ahora está en la ficha de todos los personajes jugadores, también los creados en la VTT.',
        'Las tres afiliaciones de la ficha se pueden rellenar y editar (nombre, Standing, Reputation y Call usada), igual que las conexiones First Bond, Open Debt y Friction.',
        'Los cambios se guardan con Guardar ficha y, en fichas importadas, se conservan al exportar al formato del creador.',
      ] },
    ],
  },
  {
    version: '2.2.2', date: '2026-11-14', title: 'V2 · Fase 1: Standing, Reputation y Call editables en mesa',
    sections: [
      { title: 'Fichas', items: [
        'En la pestaña Vínculos, el Keeper puede cambiar el Standing y la Reputation de cada afiliación y marcar su Call como usada. Se guarda con Guardar ficha.',
        'Los cambios se conservan al exportar la ficha al formato del creador.',
        'Los jugadores ven estos datos en su ficha, sin poder modificarlos.',
      ] },
    ],
  },
  {
    version: '2.2.1', date: '2026-11-14', title: 'V2 · El lobby encuentra tus salas y avisa si algo falla',
    sections: [
      { title: 'Salas en el lobby', items: [
        'Corregido: al entrar con tu cuenta, el lobby podía mostrar "No tienes salas" aunque existieran. El portal y el sistema de salas usan ahora siempre la misma configuración de Firebase, también cuando faltan las variables de entorno.',
        'Si la lista de salas no se puede cargar, el lobby lo dice, explica el motivo y ofrece Reintentar, en lugar de mostrar una lista vacía.',
        'Si no se puede abrir, crear o unirse a una sala, vuelves al lobby con el motivo a la vista; antes te quedabas en una mesa local sin aviso.',
        'La mesa local y el modo invitado no consultan la nube.',
      ] },
    ],
  },
  {
    version: '2.2.0', date: '2026-11-14', title: 'V2 · Fase 1: Vínculos, afiliaciones y loadout en la ficha',
    sections: [
      { title: 'Fichas', items: [
        'Nueva pestaña Vínculos en la ficha de los personajes importados: afiliaciones con su Standing, Reputation y estado de la Call, tokens y notas de facción, conexiones (First Bond, Open Debt, Friction) y las semillas del personaje.',
        'La pestaña Rasgos muestra el Signature Trait, cuántos poderes hay equipados frente al límite del loadout y el Vault de poderes conocidos sin equipar.',
        'Estos datos son de consulta y se leen de la ficha JSON importada; la pestaña solo aparece si la ficha los incluye.',
        'El pie de la ficha con Guardar ficha queda siempre a la vista, sin texto asomando por debajo.',
      ] },
    ],
  },
  {
    version: '2.1.3', date: '2026-11-14', title: 'V2 · Consola lateral en violeta',
    sections: [
      { title: 'Interfaz', items: [
        'El interior de la consola lateral adopta las superficies violetas y pierde las esquinas redondeadas: tarjetas de roster, arcos y escenas, documentos, registro, chat y los contenedores del panel de tiradas.',
        'La escena activa, el token seleccionado y los temas de dados conservan su cian y sus colores propios.',
      ] },
    ],
  },
  {
    version: '2.1.2', date: '2026-11-14', title: 'V2 · Modales, paneles flotantes y HUD en violeta',
    sections: [
      { title: 'Interfaz', items: [
        'Los modales (ficha, ayuda, compendio, cuenta, salas y sesiones) usan la dirección visual violeta: marco de línea fina con borde superior de acento, sin esquinas redondeadas y títulos en mayúsculas espaciadas.',
        'Los relojes de escena, el panel de capas y los contenedores del HUD de jugador y del HUD de Keeper adoptan las mismas superficies.',
        'El pie de la ficha sigue fijo abajo con el botón Guardar ficha siempre a la vista.',
        'Se mantiene el cian para lo seleccionado o activo y no cambian los colores de dados, Hope, Fear, tokens ni barras de recursos.',
      ] },
    ],
  },
  {
    version: '2.1.1', date: '2026-11-14', title: 'V2 · Marco de la mesa en violeta',
    sections: [
      { title: 'Mesa de juego', items: [
        'El marco de la mesa adopta la dirección visual del lobby: fondo violeta oscuro con retícula fina, cabecera, barra de herramientas y consola lateral con líneas finas y sin esquinas redondeadas, y títulos en mayúsculas espaciadas.',
        'Botones, campos, pestañas y la barra rápida del token usan las mismas superficies violetas.',
        'No cambian los colores con significado en juego: dados, Hope, Fear, tokens, barras de recursos ni el cian que marca la herramienta o pestaña activa.',
      ] },
    ],
  },
  {
    version: '2.1.0', date: '2026-11-14', title: 'V2 · Nuevo lobby: retícula violeta y vista Básico / Avanzado',
    sections: [
      { title: 'Pantalla de acceso y centro de mando', items: [
        'Nueva dirección visual del lobby: fondo violeta oscuro con retícula de líneas finas, celdas numeradas (01, 02…), títulos en mayúsculas muy espaciadas y etiquetas en tipografía monoespaciada. Sin brillos ni esquinas redondeadas.',
        'Paleta violeta aprobada: fondo #0d0420, profundo #2a0b5c, medio #6d28d9, luz #c084fc y acento #fde68a. Los colores de juego (dados, Hope, Fear, tokens) no cambian.',
        'El portal de acceso se divide en dos celdas: título a la izquierda y formulario de acceso a la derecha. En pantallas estrechas se apilan.',
        'Se mantienen los dos grandes accesos ENTRAR COMO JUGADOR y ENTRAR COMO KEEPER, el usuario y el correo conectados, las salas, el código de invitación y la entrada directa a la mesa.',
      ] },
      { title: 'Vista Básico / Avanzado', items: [
        'Conmutador en la cabecera del centro de mando. Básico (por defecto) muestra lo necesario para entrar a jugar, con textos de ayuda; Avanzado añade el creador rápido de personaje, las estadísticas y acciones de cada ficha del Vault (exportar, eliminar) y el borrado de salas.',
        'La vista elegida se recuerda en el navegador.',
      ] },
      { title: 'Accesibilidad', items: [
        'Foco de teclado visible en botones y campos, y sin animaciones cuando el sistema pide movimiento reducido.',
      ] },
    ],
  },
  {
    version: '2.0.2', date: '2026-11-14', title: 'V2 · Fase 0: Carga inicial más ligera',
    sections: [
      { title: 'Rendimiento', items: [
        'El archivo principal de la aplicación baja de 1.316 kB a 888 kB (de 338 kB a 249 kB comprimido): Firebase se sirve en archivos propios que el navegador conserva en caché entre versiones.',
        'El módulo de conexión directa entre navegadores (PeerJS, 122 kB) ya no se descarga al abrir la aplicación; solo se carga al crear o unirse a una sesión directa. Las salas en la nube no lo necesitan.',
      ] },
      { title: 'Dados 3D', items: [
        'Corregida una referencia con mayúsculas incorrectas (Dice.min.js) que impedía iniciar los dados 3D en servidores que distinguen mayúsculas de minúsculas. Las físicas y los parámetros de los dados no cambian.',
      ] },
    ],
  },
  {
    version: '2.0.1', date: '2026-11-14', title: 'V2 · Fase 0: Arcos de sala y notas personales en la cuenta',
    sections: [
      { title: 'Cuenta y guardado en la nube', items: [
        'Notas personales por partida: cada usuario puede guardar notas privadas asociadas a una sala; ni el Keeper ni otros jugadores pueden leerlas (modelo y reglas listos; la pantalla llegará con la cuenta de la Fase 2).',
        'Arcos por sala del Keeper: la sala mantiene en la nube un índice de sus arcos (nombre, descripción, escenas y orden) que se actualiza solo al guardar la campaña y escribe únicamente lo que cambia.',
        'Al eliminar una sala también se borra su índice de arcos.',
        'Si las reglas de Firestore publicadas son anteriores a esta versión, la partida se guarda igual y el índice de arcos se omite sin errores.',
      ] },
      { title: 'Reglas de Firestore', items: [
        'Nuevas reglas para rooms/{sala}/arcs (solo el Keeper propietario) y users/{usuario}/notes (solo su autor), con límites de tamaño y campos cerrados. Requiere volver a publicar las reglas.',
      ] },
      { title: 'Pruebas', items: [
        'Las pruebas de reglas de cuenta y de salas se han ejecutado en el emulador de Firestore: guardado de personajes y escenas, notas, arcos, reconexión de Keeper y jugador.',
        'La reconexión de un jugador con varios tokens asignados conserva el control de todos ellos.',
      ] },
    ],
  },
  {
    version: '2.0.0', date: '2026-11-14', title: 'V2 · Fase 0: Estabilización de guardado, fichas y red',
    sections: [
      { title: 'Chat', items: [
        'Los subtítulos de chat en overlay se muestran siempre por encima de cualquier otro elemento (HUD, modales, dados 3D y avisos).',
      ] },
      { title: 'Cuenta y guardado en la nube', items: [
        'Guardar un personaje ya guardado actualiza su entrada en lugar de crear un duplicado.',
        'Reglas de Firestore corregidas: los personajes admiten actualización y las escenas del Keeper conservan muros, luces, niebla, agua, notas, tokens y arco, con imagen en Firebase Storage o en Cloudinary.',
        'Si un guardado no llega a la nube y queda solo en el navegador, la aplicación lo avisa de forma visible.',
        'Luz ambiente por defecto corregida al guardar escenas sin valor definido.',
      ] },
      { title: 'Fichas', items: [
        'El importador acepta las fichas actuales del creador (versiones 2.8x, esquema veilfarers.character/2) sin aviso de versión.',
        'Hope y Effort respetan el máximo de la ficha en la barra rápida y en los controles de recursos.',
      ] },
      { title: 'Red y permisos', items: [
        'Al resolver daño contra un token ajeno, el jugador solo puede cambiar HP y Armor del objetivo; el resto de campos queda protegido.',
      ] },
    ],
  },
  {
    version: '1.5.0', date: '2026-11-12', title: 'Fidelidad Canónica Total: Lobby Simplificado por Roles, Subtítulos en Overlay, Paleta de Color de Token, Armaduras Activas y Catálogo Integral',
    sections: [
      { title: 'Físicas Canónicas de Dados 3D (@3d-dice/dice-box)', items: [
        'Animación completa sin cortes prematuros (settleTimeout: 9500ms): los dados ruedan, rebotan y desaceleran hasta su detención natural por fricción y gravedad antes de que el motor resuelva el resultado.',
        'Muros invisibles de colisión física (Ammo.js) restringidos exclusivamente al área del mapa táctico (#canvas_viewport_root) con actualización dinámica por ResizeObserver, impidiendo que los dados caigan o reboten sobre los menús superior o laterales.',
        'Preservación de las físicas y parámetros canónicos de @3d-dice/dice-box (BabylonJS + Ammo.js) asegurando un movimiento fluido, natural y consistente sin saltos artificiales ni micro-rebotes excesivos.',
      ] },
      { title: 'Pantalla de Entrada Simplificada (Lobby Táctico)', items: [
        'Rediseño intuitivo con dos grandes botones Hero principales: [ ◈ ENTRAR COMO JUGADOR ] y [ ⚡ ENTRAR COMO KEEPER ].',
        'Modo Jugador: Listado de salas a las que está conectado el usuario con acceso con 1 clic, formulario para unirse a nueva sala con código de invitación y Character Vault.',
        'Modo Keeper: Listado de salas creadas por el Keeper para abrirlas o gestionarlas directamente, y formulario de creación de nueva sala/campaña con nombre.',
        'Autenticación Segura sin Transición Prematura: Bloqueo de inputs e indicador de progreso ("Verificando credenciales...") mientras se procesa el login; no transiciona al VTT hasta que Firebase Auth confirme la identidad.',
        'Visualización de Identidad: Encabezado con chips permanentes del usuario (displayName) y correo electrónico (email) conectado.',
      ] },
      { title: 'Subtítulos Cinematográficos en Overlay', items: [
        'Módulo #vf-subtitle-overlay que proyecta mensajes y descripciones en la parte inferior de la pantalla de forma no intrusiva (anclado a bottom: 74px), sin tapar controles tácticos ni HUD.',
      ] },
      { title: 'Tokens Multicolores y Personalización Coordinada', items: [
        'Selector de color de token (token.color) integrado en la configuración del token con paleta táctica (Cian, Ámbar, Esmeralda, Púrpura, Rojo, Carmesí, etc.).',
        'El color seleccionado define de forma coordinada el borde y nombre del token en mapa, el texto del usuario en chat, el subtítulo en overlay y la caja de resultado de dados (.vf-callout-result-box y .vf-results).',
      ] },
      { title: 'Precarga Táctica de Daño según Armas Equipadas', items: [
        'Las armas equipadas en la ficha del token se vinculan directamente al calculador de daño táctico (diceRoller.js), precargando fórmula de daño, modificadores y botón directo 💥 Daño en la barra rápida.',
        'Tooltip canónico con nombre y regla oficial al pasar el ratón (mouse-over) sobre marcadores de estado y condiciones en el mapa y HUD.',
        'Marcadores de bloqueo de objetivo (target lock) sutiles y discretos con corchetes esquineros ultrafinos (1px).',
      ] },
      { title: 'Umbrales de Daño Dinámicos según Armadura', items: [
        'Integración de los Damage Thresholds (Major Threshold / Severe Threshold) y Armor Slots en todas las armaduras canónicas del Corebook y del suplemento Rust & Steel (Casas Solari, Volkov, Valerius, Joric, Amaranth, y especies Lithian, Chitinid, Synthet).',
        'Al equipar una armadura desde el inventario del token, se recalculan y actualizan automáticamente sus umbrales activos en combate (Major = Armor Major + Nivel; Severe = Armor Severe + Nivel) y sus ranuras de armadura (current y max).',
        'Cálculo de daño en combate ajustado con fidelidad matemática estricta: Menor (1 HP si Daño < Major), Mayor (2 HP si Major <= Daño < Severe), y Severo (3 HP + 1 HP por cada 10 puntos de Overkill si Daño >= Severe).',
        'El gasto de ranuras de armadura mitiga la severidad en 1 escalón exacto.',
      ] },
      { title: 'Catálogo Canónico Integral de Armas, Aumentos y Módulos de Dron', items: [
        'Ampliación completa del arsenal con Trait de atributo, tipo de daño (Físico, Energía, Vacío), notación de dados canónica, rangos tácticos oficiales (Melee, Close, Far, Very Far) y Burden.',
        'Incorporación de Aumentos canónicos con coste de ranura (1 Augment), coste de estrés (Stress Cost), beneficios tácticos automáticos (+1 Slot de armadura, +2 HP, +1 Evasión) y peajes/drawbacks oficiales.',
        'Incorporación de Módulos de Dron canónicos con ranuras requeridas y soporte para el módulo oficial Neural Network Control (0 ranuras) que otorga control multi-jugador simultáneo de drones.',
        'Actualización visual de la biblioteca de equipamiento (Equipment UI) con pestañas dedicadas y tarjetas técnicas adaptadas a cada tipo de ítem.',
      ] },
      { title: 'Estados de Personaje y Campaña Canónicos', items: [
        'Incorporación a las 18 condiciones tácticas de combate de los 6 Estados de Personaje y Campaña canónicos: Overwhelmed (Abrumado), Dying (Moribundo), Final (Estado Final), Long Bruise (Secuela Grave), Blurred (Desfase de Realidad) y Burned Out (Agotamiento Durmiente) con sus respectivos iconos SVG y reglas oficiales.',
        'Selector de condiciones reorganizado con secciones visuales claras para condiciones tácticas y estados de campaña.',
      ] },
      { title: 'Gasto de Miedo (Fear) en Foco de Adversarios', items: [
        'Al activar el Foco de Combate (Spotlight) en un Adversario o PNJ hostil, el Keeper consume obligatoriamente 1 punto de Miedo del Fear Tracker global.',
        'Si no hay Fear disponible (Fear = 0), el sistema bloquea la activación y notifica al Keeper.',
        'Los drones aliados y tokens de jugadores están exentos del consumo de Fear.',
        'Sincronización en tiempo real mediante FEAR_UPDATE y TOKEN_UPDATE por la red P2P/Firestore.',
      ] },
    ],
  },
  {
    version: '1.4.9', date: '2026-11-12', title: 'Restauración del Diseño Visual Clásico del Callout 3D con Datos Reales y Jerarquía Estilizada',
    sections: [
      { title: 'Formato Visual Elegante sin Encabezados Redundantes', items: [
        'Restauración de la estética visual clásica del callout flotante dorado de dados 3D (borde dorado translúcido con desenfoque de fondo y tipografía táctica de alta legibilidad).',
        'Supresión de encabezados de formulario repetitivos ("NOMBRE DEL JUGADOR:", "NOMBRE DEL TOKEN:", "HABILIDAD:", "RESULTADO:", "MODIFICADORES APLICADOS:").',
        'Jerarquía estilizada: Kicker superior dorado con el nombre de quien hace la tirada (ej. KEEPER o PEDRO); título un poco más grande con el nombre del personaje/adversario (+ habilidad si aplica); tipo de resultado destacado (Failure with Fear, Success with Hope, etc.) bien visible con resplandor cromático según Hope/Fear/Crítico; número enorme (38px) con desglose Dualidad (HOPE 3 < FEAR 8); y pie técnico con tipo de dado y modificadores reales.',
        'Soporte completo tanto en el panel de análisis 3D en pantalla (VFDice3D) como en la pila de notificaciones tácticas de tiradas.',
      ] },
    ],
  },
  {
    version: '1.4.8', date: '2026-11-12', title: 'Entrada Libre de Jugadores sin Personaje Previo y Consolidación de Handover de Decisiones de Diseño',
    sections: [
      { title: 'Entrada Libre y Asignación Flexible de Tokens', items: [
        'Eliminado el bloqueo obligatorio de personaje en el Hub de acceso: el jugador puede entrar a cualquier mesa o partida sin tener que crear ni seleccionar un operativo previamente.',
        'Eliminada la ventana emergente automática (popup de Reclamar personaje) al conectarse a una sesión en la red: el jugador entra de forma limpia y directa a la mesa.',
        'Soporte completo para asignación diferida por el Keeper: el jugador entra en modo espectador/jugador y recibe su token y controles en el momento en que el Keeper se lo asigna.',
        'Actualización visual del resumen de despliegue en el Hub para reflejar que la entrada sin personaje está lista y autorizada.',
      ] },
      { title: 'Handover & Preservación de Decisiones de Diseño', items: [
        'Creación del documento HANDOVER.md en la raíz del repositorio consolidando las 8 decisiones críticas de arquitectura y UX acordadas para evitar regresiones futuras.',
        'Vinculación obligatoria del Handover en AGENTS.md para garantizar que todos los agentes y desarrolladores consulten y respeten estas directrices sin excepción.',
      ] },
    ],
  },
  {
    version: '1.4.7', date: '2026-11-12', title: 'Borrado Permanente de Salas por el Keeper, Expulsión Reactiva de Jugadores y Resolución de Error de Permisos',
    sections: [
      { title: 'Gestión y Borrado de Salas Persistentes', items: [
        'Permite al Keeper dueño de una sala eliminarla permanentemente mediante un botón de peligro ("Eliminar") tanto desde la lista de "Salas que dirijo" como desde el panel de la sala activa.',
        'Cuadro de diálogo de confirmación previo para prevenir eliminaciones accidentales de campañas en la nube.',
        'Borrado integral en Firestore: eliminación del documento de sala, sus miembros, subcolecciones de fragmentos y guardados, invitación activa (roomInvites) y registro de usuario.',
        'Expulsión en tiempo real de los jugadores conectados: el listener reactivo detecta el borrado de la sala o la revocación del acceso, los desconecta limpiamente, limpia su sesión y muestra notificación explicativa.',
        'Actualización de firestore.rules para permitir al propietario el borrado seguro de sus salas (allow delete) y administración de miembros.',
      ] },
      { title: 'Resiliencia y Corrección de Permisos Firestore', items: [
        'Eliminación de la rotación automática forzada en segundo plano de códigos de invitación en refresh() y enterRoom() que provocaba permission-denied cuando las reglas remotas de Firestore aún no se habían publicado.',
        'Preservación del acceso y estado online para salas existentes con códigos legacy sin interrumpir la sesión del Keeper.',
        'Limpieza automática de lastError en refrescos de sala para evitar que mensajes de error transitorios queden fijos en pantalla.',
      ] },
    ],
  },
  {
    version: '1.4.6', date: '2026-11-12', title: 'Callout Dorado Estructurado, Ficha Condensada sin Scroll, Códigos de Invitación Breves y Herramienta Unificada de Dibujo',
    sections: [
      { title: 'Callout Dorado de Dados 3D', items: [
        'Sustitución completa del texto genérico por información estructurada y fiel: Nombre del jugador, Nombre del token, Habilidad (si aplica), Resultado (con total y estado Duality) y Modificadores aplicados.',
        'Eliminación total de los rótulos TACTICAL SOLUTION y telemetría ficticia VECTOR TELEMETRY LOCKED.',
        'Paso explícito de metadatos de jugador, token, habilidad y modificadores en todas las fuentes de tirada (DiceRoller, VttDiceSync, DiceEngine3D y KeeperHud).',
      ] },
      { title: 'Ficha de Personaje Ultra Condensada', items: [
        'Rediseño compacto del modal de ficha (Dossier): reducción drástica de espaciados, hero compacto de 44px, inputs optimizados de 28px y área de notas estilizada.',
        'Pie de ficha sticky fijado en la parte inferior de la ventana para que el botón "Guardar ficha" esté siempre visible sin necesidad de hacer scroll.',
        'Botón de guardado rápido directo añadido en la barra superior de pestañas del dossier.',
      ] },
      { title: 'Invitaciones y Mesas Persistentes', items: [
        'Generación de códigos de invitación cortos y legibles con formato de 3 letras de la sala + guion + 5 caracteres aleatorios (ej. NAV-33F44).',
        'Auto-migración transparente de códigos heredados largos al nuevo formato breve al abrir o entrar a la sala como Keeper.',
      ] },
      { title: 'Herramientas de Mesa', items: [
        'Unificación de Dibujar y Borrar en un único botón en la barra lateral de herramientas con selector de modo integrado en su panel emergente y atajos de teclado [B / D].',
      ] },
    ],
  },
  {
    version: '1.4.5', date: '2026-11-12', title: 'Inicialización Centralizada y Resiliente de Firebase Auth y Realtime Database',
    sections: [
      { title: 'Conectividad y Autenticación en la Nube', items: [
        'Centralización de la inicialización de Firebase App, Auth y Realtime Database en un cliente unificado (firebaseClient.js) para evitar errores app/no-app.',
        'Sustitución de accesos dinámicos a variables de entorno por propiedades estáticas de Vite con configuración de respaldo pública garantizada.',
        'Mensajes de autenticación amigables en español para credenciales incorrectas, contraseñas cortas, ventanas emergentes bloqueadas y cuentas existentes.',
        'Vínculo inmediato del Vault de personajes, HUD de Jugador, consola del Keeper y sincronización de dados con Firebase Realtime Database.',
      ] },
    ],
  },
  {
    version: '1.4.4', date: '2026-11-12', title: 'Terminal Táctico AAA: Hub de Operativos Rediseñado, Flujo de Logout y Precarga de Dados 3D',
    sections: [
      { title: 'Hub de Operativos y Portal AAA', items: [
        'Rediseño premium con calidad de estudio AAA de la pantalla del Hub táctico, tipografías Orbitron/Rajdhani y ambientación Sci-Fi Pearl Era.',
        'Character Vault estilizado: tarjetas tácticas de operativo con avatar holográfico, indicadores de estado [ACTIVO], micropips para HP, Stress, Hope, Armour Shields y Slots de mejora.',
        'Panel de despliegue con frecuencias de sala rápidas y diagnóstico de enlace cuántico en tiempo real.',
        'Creador de personajes reestructurado en tres secciones tácticas con matriz Duality 2d12 de atributos y blindaje exotáctico.',
      ] },
      { title: 'Ciclo de Acceso y Sesión', items: [
        'Carga inmediata del portal en el arranque sin destellos previos del mapa ni de la mesa de juego.',
        'Flujo de retorno al portal de login automático y coherente tras cualquier cierre de sesión (botón de desconexión del Hub, menú de cuenta de la mesa o desautenticación remota).',
        'Precarga y precalentamiento en segundo plano del motor 3D de dados, física WASM y audio mientras el usuario interactúa con la pantalla de acceso.',
      ] },
    ],
  },
  {
    version: '1.4.3', date: '2026-11-12', title: 'Diseño Táctico del Portal de Acceso y Modo Local / Invitado',
    sections: [
      { title: 'Portal y Acceso', items: [
        'Rediseño completo de la interfaz de login del portal con estética Sci-Fi/Cyberpunk, fondo con cuadrícula táctica, glassmorphism y controles integrados.',
        'Botón directo para entrar como Invitado / Modo Local y botón de cierre rápido para acceder al VTT de inmediato sin requerir cuenta.',
        'Información contextual amigable en modo local si la autenticación remota no está configurada, sin mensajes de error invasivos.',
        'Soporte completo de estilos CSS para inputs con iconos, botones con gradientes cian, selector de Google y bóveda de personajes.',
        'Optimización Canvas2D con willReadFrequently para renderizado acelerado de la niebla de exploración y corrección de metadatos móviles.',
      ] },
    ],
  },
  {
    version: '1.4.2', date: '2026-11-11', title: 'Callout de Tiradas Estructurado y Limpieza de Interfaz',
    sections: [
      { title: 'Callouts de Tiradas', items: [
        'Formato estructurado en cada tarjeta de resultado con 4 campos explícitos: Nombre del jugador, Nombre del token, Resultado y Modificadores aplicados.',
        'Sincronización de identificadores de jugador y token en tiradas de acción, comprobaciones Duality y dados rápidos del Keeper.',
        'Eliminación completa del badge redundante de "FEAR EN MESA" sobre la cabecera de sesión.',
      ] },
    ],
  },
  {
    version: '1.4.1', date: '2026-11-11', title: 'Veilfarers Suite: Dados 3D Optimizados, Callouts Remotos, Asignación Múltiple y HUD Movible',
    sections: [
      { title: 'Dados 3D y Notificaciones de Tirada', items: [
        'Los dados 3D se animan exclusivamente en la pantalla del jugador que realiza la tirada. El resto de la mesa recibe un callout visual con el resultado.',
        'Callouts apilables e independientes: muestran el nombre del token, el resultado total y el desglose de modificadores aplicados, permitiendo ver múltiples tiradas simultáneas.',
        'Privacidad de tiradas del Keeper: las tiradas ocultas no se notifican a los jugadores y quedan claramente identificadas en la consola del Director.',
        'Física 3D calibrada: gravedad realista (3.6), fricción (0.95) y restitución reducida (0.12) para que los dados aterricen planos y firmes en sus caras.',
        'Resolución del bloqueo entre tiradas sucesivas y supresión de la tirada duplicada involuntaria de Hope & Fear al rodar dados estándar.',
      ] },
      { title: 'Asignación de Tokens y Drones', items: [
        'Un jugador puede tener asignados varios tokens a la vez sin que una nueva asignación desasigne sus fichas anteriores.',
        'Los drones compartidos admiten varios jugadores controladores simultáneos seleccionables por casillas de verificación.',
      ] },
      { title: 'Consola del Keeper y Experiencia de Usuario', items: [
        'Consola flotante del Keeper: elemento movible mediante arrastre que no obstruye la barra de sesión superior y puede minimizarse a un icono compacto ⚡ con contador de Fear.',
        'Panel de ataque y daño simplificado: precarga el arma y el objetivo directamente desde la ficha, dejando los detalles manuales comprimidos en un panel desplegable.',
        'Barra de dados poliédricos y texturas ajustada a dos filas para evitar cualquier desbordamiento horizontal en el panel lateral.',
        'Código de invitación corto: 3 caracteres basados en el nombre de la sala y 5 caracteres aleatorios (ej. EST-8K2MF).',
        'Resiliencia ante actualizaciones de chunks en despliegues y previsualizaciones de Netlify con recarga automática ante discrepancias de hash.',
      ] },
    ],
  },
  {
    version: '1.4.0', date: '2026-11-11', title: 'Salas persistentes, reconexión y edición táctica',
    sections: [
      { title: 'Salas y conexión', items: [
        'SESIONES separa las salas que diriges y aquellas en las que participas. La pertenencia y el control de los tokens quedan ligados a la cuenta de Firebase, no al nombre ni a una pestaña.',
        'Invitación única por sala. El Keeper puede regenerarla sin retirar a los miembros existentes, expulsar y readmitir jugadores, asignar tokens y enviar anuncios. Un personaje por jugador; los drones conservan sus controles compartidos.',
        'Campaña, arcos, escenas, recursos y asignaciones se guardan en Firestore. Los movimientos se confirman después de guardar. Volver a abrir una sala recupera el guardado existente.',
        'Los jugadores permanecen dentro si el Keeper pierde la conexión: las acciones se bloquean y se reanudan al regresar el propietario. Un cierre inesperado se detecta al caducar la presencia del servidor, en unos 20 segundos.',
        'Canales privados y ordenados por conexión, recuperación automática, bloqueo de conexiones antiguas y protección frente a dos Keepers simultáneos. Se mantienen los filtros de información privada.',
        'Las actualizaciones omiten las secciones sin cambios y el guardado reutiliza fragmentos inmutables de imágenes. El modo LAN y las campañas locales siguen disponibles. Las salas online requieren publicar las nuevas reglas de Firestore.',
      ] },
      { title: 'Dibujo y portapapeles', items: [
        'Dibujo libre con paleta visual propia y tres grosores: fino, medio y grueso. Los trazos se guardan en cada escena y se comparten con la sala.',
        'El borrador elimina exclusivamente trazos completos de dibujo libre. Los jugadores editan sus propios trazos; el Keeper puede borrar cualquiera. Cambiar de herramienta, escena o conexión cancela el trazo pendiente.',
        'Ctrl+C y Ctrl+V (Cmd en macOS) copian y pegan el elemento seleccionado: tokens, paredes, luces, agua, anomalías, dibujos y plantillas. Las copias reciben identificadores nuevos y los tokens duplicados no heredan jugadores asignados.',
        'Los jugadores solo duplican sus dibujos. El portapapeles respeta campos de texto, capas bloqueadas, cambios de campaña y salas en pausa. Los trazos se dibujan debajo de la niebla de guerra.',
      ] },
      { title: 'Verificación', items: [
        'Pruebas con el emulador real de Firestore: permisos entre cuentas, invitaciones, expulsión, canales privados, pérdida de red, reconexión, movimientos confirmados y campañas mayores de 1 MB.',
        'Pruebas del dibujo, borrador, portapapeles y conservación de los elementos originales. Guía de actualización y comprobaciones manuales incluidas.',
      ] },
    ],
  },
  {
    version: '1.3.1',
    date: '2026-11-10',
    title: 'Persistencia del acceso, telemetría de escena y optimización compacta de paneles',
    sections: [
      { title: 'Inicio de sesión y preferencias', items: [
        'Session y Sesiones se agrupan en un único acceso SESIONES, con secciones de partida/tripulación y archivo guardado. La cuenta aparece arriba a la derecha: usuario y piloto verde al iniciar sesión, Offline y piloto rojo al salir.',
        'Restauración de Netlify Identity tanto si el widget ya terminó de iniciarse como si carga después. Firebase y Netlify mantienen estados independientes y se recuerda el proveedor elegido.',
        'Google aplica explícitamente la opción de mantener la sesión, tanto en ventana emergente como en redirección. Cancelar un acceso no inicia otro proveedor automáticamente.',
        'El cierre de sesión limpia sus listeners temporales. Las preferencias se aíslan por cuenta y una respuesta antigua no puede reasignar el personaje ni sobrescribir los ajustes del Keeper.',
        'Guardado seguro de preferencias y parámetros de usuario: soporte para esquemas extendidos (fogOfWar, opacidad de niebla, modos de ajuste a rejilla) con almacenamiento local inmediato y fallback resiliente ante restricciones de permisos en Firestore.',
      ] },
      { title: 'Movimiento y recursos', items: [
        'El arrastre usa una vista provisional separada del token confirmado: las actualizaciones del Keeper conservan la posición bajo el cursor y las estadísticas más recientes.',
        'Los cambios del jugador se identifican y confirman en orden. Una instantánea anterior no deshace el último movimiento ni los clics rápidos de HP, Armor, Stress o Hope/Effort.',
        'Se elimina el envío duplicado desde la barra de recursos; el foco del token se sincroniza sin permitir cambiar la configuración de su luz.',
        'Rechazos y tiempos de espera muestran un aviso y recuperan el último estado confirmado. Cambiar de escena, retirar permisos o mover el token desde el Keeper cancela arrastres obsoletos.',
        'La visión, las luces y la exploración usan posiciones confirmadas por el Keeper, incluso mientras un movimiento espera respuesta. El modo Player de previsualización del anfitrión no bloquea los movimientos de sus jugadores.',
      ] },
      { title: 'Telemetría de escena y distribución compacta de paneles', items: [
        'Corrección integral de la telemetría de sincronización de escena: el anfitrión indexa el estado de carga por identificador de miembro, peer y nombre, emitiendo eventos reactivos que actualizan de inmediato las píldoras de tripulación a 100% ✅ y eliminan estados falsos de 0% o pendiente.',
        'Transmisión proactiva de telemetría: los clientes notifican inmediatamente su estado de carga al Keeper al conectarse o recibir la escena inicial, incluso cuando el mapa ya se encuentra precargado en la memoria local.',
        'Dossier de estado de escena reactivo y completo: actualización automática en vivo ante cambios de carga y visualización de la fila del Keeper para clientes conectados.',
        'Ampliación del límite de tamaño de mapas tácticos: se eleva el límite máximo de subida de 20 MB a 50 MB en almacenamiento local/servidor y hasta 100 MB al utilizar Cloudinary con compresión WebP/AVIF.',
        'Consola de chat táctico compacta y libre de scroll exterior: contenedor flex con mensajes scrollables internamente, selector de canal de bajo perfil y compositor de entrada condensado.',
        'Panel de vista previa de token (Token HUD) comprimido verticalmente en más de un 70%, agrupando acciones en cuadrícula compacta y disponiendo la telemetría vital en una sola fila ágil.',
        'Navegación por pestañas laterales (DICE, CLOCKS, SHIP, ROSTER, SCENES, DOSSIERS, LOG, CHAT) optimizada en una sola fila sin desbordamiento.',
      ] },
      { title: 'Modo Observador y asignación de tokens', items: [
        'Tercera opción al unirse a la partida: «Unirse como Observador». El jugador puede conectarse a la sesión sin verse forzado a reclamar o importar un personaje de inmediato.',
        'La opción de observador está disponible tanto en el formulario de acceso a la sesión como en el modal de reclamación de personaje (Opción C).',
        'El Director de Juego (Keeper) puede asignar cualquier token a un observador desde el lobby o el panel de asignación; la transición es fluida e inmediata, centrando la vista en el token y activando sus controles tácticos.',
        'Indicador interactivo en la barra superior «👁️ Observador», que permite al usuario seguir la partida en tiempo real y reclamar o importar un personaje si cambia de opinión.',
      ] },
      { title: 'Foco táctico exclusivo, códigos simplificados y renderizado optimizado', items: [
        'Regla canónica de foco exclusivo: solo un token puede tener el foco activado a la vez en todo el mapa táctico; al encenderlo en un token se apaga automáticamente en los demás.',
        'Coste de activación de foco en adversarios: otorgar el foco a un adversario le cuesta 1 punto de Miedo (Fear) al Director de Juego (Keeper). Si el Keeper cuenta con 0 Fear, la activación se bloquea y emite un aviso explicativo.',
        'Códigos de invitación ultracompactos: el código de sala pasa de ser una cadena de más de 40 caracteres a un formato conciso de 3 caracteres del nombre de campaña + guion + 5 caracteres alfanuméricos (ej. USC-K89FA).',
        'Frustum culling en capa de mapa táctico: el motor gráfico calcula el viewport visible según zoom y traslación para rasterizar únicamente el rectángulo de escena que entra en pantalla, optimizando radicalmente el rendimiento en mapas de ultra-alta resolución (4K/8K).',
        'Compresión adaptativa cliente para Cloudinary: las imágenes superiores a 9.5 MB se escalan y transcodifican fluidamente a WebP en el navegador, asegurando compatibilidad con el límite de 10 MB del nivel gratuito y admitiendo archivos de hasta 100 MB.',
        'Base de datos de escenas en Firebase con componentes completos: guardado automático en Firebase Firestore de cada escena creada con sus muros, luces, efectos, agua, fichas asignadas y notas de Keeper, sin depender de la caché del navegador.',
        'Menú superior en una sola línea compacta: reducción de altura a 46px (~50% del tamaño anterior), integrando la barra de sesión y el medidor de miedo en una única fila horizontal continua sin barras secundarias.',
        'Sesiones persistentes y reconexión automática tras refresco (F5): el Keeper y los jugadores retienen su sesión, sala y tokens asignados ante recargas accidentales sin requerir reconectar manualmente.',
        'Historial de invitaciones recientes en el lobby: lista de partidas guardadas con acceso directo de 1 clic para volver a unirse.',
        'Enrutamiento de telemetría insensible a mayúsculas/minúsculas: corrección de coincidencia de sala para que las actualizaciones MAP_LOAD_STATUS del cliente lleguen sin pérdidas al Keeper.',
      ] },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-11-10',
    title: 'Catálogo de equipo alienígena, drones tácticos, mitigación con escudos, spotlight cenital y niebla autoritaria',
    sections: [
      {
        title: 'Equipo y Aumentos Alienígenas (Core + Rust & Steel)',
        items: [
          'Catálogo canónico completo de armamento, armaduras, equipo tecnológico y aumentos ciberbiológicos extraídos del Corebook y las especies alienígenas de Rust & Steel (Lithian, Chitinid, Synthet, Voidborn).',
          'Filtros interactivos por origen (Todos, Core, Rust & Steel) y categoría (Armas, Armaduras, Equipo, Aumentos), permitiendo a los jugadores equipar cualquier combinación a sus personajes.',
          'Integración directa con el dossier del personaje y el inventario del token, con previsualización de propiedades, daño, alcance y notas de reglas.',
        ],
      },
      {
        title: 'Drones Tácticos y Despliegue',
        items: [
          'Sistema dedicado de creación y despliegue de drones desde el Roster Táctico, con presets especializados: Scout (alta velocidad, sensor range), Combat (armadura reforzada y armamento ligero), Medical (módulos de socorro), Utility y Custom.',
          'Campo de visión (FOV) estándar estandarizado en 90º cónico con visión frontal direccional.',
          'Permisos de control compartido para tripulantes y foco cenital activado por defecto.',
        ],
      },
      {
        title: 'Edición Rápida en Token HUD Preview',
        items: [
          'Controles incrementales (+ / -) directamente integrados en la ventana de vista previa (TokenHUD) para HP, Escudos/Armor, Stress y Hope/Effort.',
          'Permite a los dueños de tokens y al Keeper modificar estadísticas vitales al vuelo durante el combate sin necesidad de abrir la ficha completa ni interrumpir el flujo táctico.',
          'Botón de conmutación rápida para foco cenital (🔦 FOCO) en el TokenHUD.',
        ],
      },
      {
        title: 'Ejecución de Daño por Jugadores y Mitigación con Escudos',
        items: [
          'Permiso habilitado para que los jugadores puedan ejecutar el daño calculado sobre su objetivo seleccionado.',
          'Mecanismo de mitigación interactiva con escudos: cuando un token recibe daño, el portador puede gastar uno o varios escudos disponibles para absorber el impacto antes de que se reste el HP y se ejecute la animación de impacto.',
          'Integración completa con las reglas de daño directo (que ignora escudos) y efectos de ataque acordes a los escudos consumidos.',
        ],
      },
      {
        title: 'Spotlight Táctico — Borde Dorado Brillante con Pulso de Luz',
        items: [
          'Rediseño compacto y elegante del foco táctico (Spotlight): se sustituyen el haz cenital y charco volumétrico de gran tamaño por un borde dorado brillante perimetral alrededor del token.',
          'Emisión de un breve pulso de luz periódico (onda dorada radiante) que se expande suavemente alrededor del borde del token sin ocupar espacio excesivo ni solapar elementos adyacentes del mapa.',
          'Anillo dorado con destello metálico, resplandor áureo dinámico, reflejo especular en el avatar y botón de alternancia rápida (✨ FOCO) en el Token HUD.',
        ],
      },
      {
        title: 'Niebla de Guerra Persistente y Autoritaria',
        items: [
          'Autoridad centralizada en el Keeper para la exploración de niebla de guerra por escena, persistida en la campaña mediante máscaras de bits comprimidas.',
          'Las acciones de "Reiniciar niebla" y "Revelar todo" actualizan la campaña y se sincronizan instantáneamente a todos los jugadores mediante el mensaje de red FOG_SYNC.',
          'Persistencia total ante recargas de página, reconexiones tardías y suspensiones de pestañas en navegadores móviles.',
        ],
      },
      {
        title: 'Autenticación en la Nube y Compatibilidad Multiplataforma',
        items: [
          'Resolución del error EBADPLATFORM en Netlify (Linux): eliminado @rollup/rollup-win32-x64-msvc de las dependencias directas para que Rollup resuelva dinámicamente el binario nativo según el sistema operativo del entorno de despliegue.',
          'Corrección del cierre inmediato del popup de Google: soporte de redirección directa (signInWithRedirect) que evita bloqueos de popups y políticas de aislamiento de origen (COOP), con reanudación automática de sesión vía getRedirectResult al recargar.',
          'Integración completa de Netlify Identity: widget integrado en el encabezado, detección y persistencia automática de sesión, y botón dedicado en el modal de cuenta con fallback inmediato si falla el popup.',
        ],
      },
      {
        title: 'Respaldo de Campaña y Lanzadores Locales',
        items: [
          'Copia de seguridad automática rotativa (auto-backup) en almacenamiento local durante cada guardado de campaña.',
          'Aviso modal proactivo de recordatorio de exportación JSON para testers alpha.',
          'Reparación de scripts de inicio por lotes (.bat) y script de instalación local en Windows invocando npm.cmd para evitar bloqueos por ExecutionPolicy de PowerShell.',
        ],
      },
    ],
  },
  {
    version: '1.2.0', date: '2026-11-10',
    title: 'Entornos de dos capas, bosses por estados e impactos de combate',
    sections: [
      { title: 'Escenarios · Keeper, capítulos 9 y 10', items: [
        'Los antiguos preajustes visuales se sustituyen por 15 macroentornos y 24 microentornos del Keeper 12.06. La escena usa todas las características del micro y exactamente una Passive o Action del macro.',
        'Tier, DC y escalado impreso, texto de referencia y configuración guardada por mapa. Las activaciones pagan únicamente el Fear indicado; las reacciones exigen confirmar su disparador. Meltdown crea su reloj visible de 6 segmentos.',
        'El Keeper resuelve las tiradas, objetivos y consecuencias del texto. Puede acompañar la activación con un efecto visual; iluminación, lluvia y bruma siguen teniendo sus controles independientes.',
      ] },
      { title: 'Bosses por estados', items: [
        'Editor para adversarios con 2–8 estados y 17 perfiles del Bestiary of Phases. Disparadores por HP, porcentaje, Armor, reloj u objetivo; reservas nuevas o conservación de HP, estadísticas, habilidades y narración por estado.',
        'La transición concede 2 Fear o 3 al entrar en la fase final, con máximo 12. Se respetan las excepciones impresas de Spotlight y limpieza de condiciones. Los valores no impresos se heredan de la ficha base y se pueden ajustar.',
        'Indicador de fase sobre el token y objetivos finales confirmados por el Keeper. Las fases pendientes no muestran prematuramente la calavera de derrota; los jugadores reciben solo el estado público actual.',
      ] },
      { title: 'Impactos y fuego', items: [
        'Trayectoria e impacto al aplicar daño: metralla balística, plasma para láser/plasma, fuego, cristales de congelación y explosión con núcleo, humo y onda de presión. Escudo solo cuando se consume Armor al mitigar, nunca por daño directo.',
        'Diámetro según HP realmente perdidos: 1 HP = 50% del token, 2 HP = 100%, +20% por cada HP adicional, máximo 200%. La animación no modifica las reglas ni aplica condiciones por sí sola.',
        'Área de fuego continua con brasas, llamas y pavesas recortadas al círculo, línea o polígono. Presupuesto visual, reducción de movimiento y laboratorio local para comparar efectos.',
      ] },
      { title: 'Organización y guardado', items: [
        'Cada escena puede trasladarse a cualquier arco o quedar sin arco desde su selector de destino. Las escenas independientes también permiten activar el mapa y configurar su entorno.',
        'Los arcos se incluyen ahora en guardado, exportación, importación y sincronización de campaña. La versión y esta guía aparecen en AYUDA.',
      ] },
    ],
  },
  {
    version: '1.1.1',
    date: '2026-11-10',
    title: 'Overlay de lluvia cinemática, niebla táctica, restricciones de muros, doble toque móvil y onboarding multijugador',
    sections: [
      {
        title: 'Clima y Efectos Atmosféricos',
        items: [
          'Overlay de lluvia cinemática a pantalla completa conservado y perfeccionado: paralaje multicapa, viento dinámico, salpicaduras en terreno e iluminación ambiental de tormenta.',
          'Ondas procedurales sobre el agua (drawRainRipples) perfectamente integradas y recortadas por el contorno del agua, incluidos polígonos cóncavos.',
          'Controles directos de lluvia y niebla en el panel de Capas Tácticas y en el inspector de elementos acuáticos, con niveles de llovizna, lluvia y tormenta.',
        ],
      },
      {
        title: 'Niebla de Guerra y Visión Táctica',
        items: [
          'Zonas inexploradas en oscuridad absoluta (100%): Muros, puertas, ventanas, fuentes de luz y tokens enemigos permanecen completamente ocultos para los jugadores hasta ser descubiertos por línea de visión.',
          'Atenuación explorada configurable: Las zonas ya visitadas fuera del campo visual actual se muestran atenuadas al 50% por defecto (ajustable de 10% a 90% desde el menú de Niebla de Combate). Las luces en zonas visitadas recortan la niebla al 100% sin atenuación.',
          'Detección y memoria de enemigos en la niebla (Ghosting): Los movimientos de enemigos en la niebla no se actualizan en tiempo real; se muestra su última posición conocida con radar ámbar hasta que un jugador descubra nuevamente la zona.',
          'Diferenciación integral de nieblas: Separación clara e inequívoca en la interfaz entre la Niebla de Combate táctica (Fog of War) y la Bruma Ambiental de clima (Overlay Weather).',
          'Prioridad absoluta de tokens: Al pulsar en cualquier punto del mapa, los tokens tienen la máxima preferencia de selección sobre cualquier pared, luz, agua, anomalía o plantilla.',
          'Línea de visión táctica (LOS) y telemetría de ataque: Al seleccionar un objetivo, se traza un rayo láser táctico, retícula crosshair y cálculo de distancia en tiempo real (metros y casillas), señalando si la línea de tiro está despejada o bloqueada por muros.',
          'Efectos especiales de ataque y explosión proporcional: Simulación de disparo según el arma (láser, plasma, arco voltaico, balística, cuerpo a cuerpo, vacío) y explosión en impacto con tamaño e intensidad directamente proporcionales al daño infligido.',
          'Iluminación de zonas visitadas: Las fuentes de luz estáticas del mapa ubicadas en áreas previamente exploradas por los jugadores ahora iluminan su entorno a través de la niebla de guerra, evitando que las salas visitadas queden en oscuridad total.',
          'Bloqueo de visión en arrastre (Drag Vision Lockdown): Mientras un jugador arrastra su token, la visión y las luces se mantienen ancladas en la posición original sin sellar niebla permanente, impidiendo revelar habitaciones o pasillos inexplorados antes de soltar la ficha.',
        ],
      },
      {
        title: 'Muros y Colisiones Físicas',
        items: [
          'Restricción de movimiento en tiempo real: Los tokens de jugadores no pueden atravesar paredes, ventanas ni puertas cerradas, contando con deslizamiento axial fluido en X e Y al colisionar.',
        ],
      },
      {
        title: 'Soporte Táctil para Tablets y Móviles',
        items: [
          'Detección unificada de doble toque (double-tap): Permite abrir la hoja de personaje en tokens propios, cerrar trazados de polígonos de agua, dividir paredes, separar nodos compuestos e insertar nuevos vértices en dispositivos táctiles.',
        ],
      },
      {
        title: 'Onboarding Multijugador en 4 Fases',
        items: [
          'Fase 1 (URL directa): Entrada directa con ?join=CODIGO o ?room=CODIGO, forzando rol de jugador y presentando tarjeta compacta con nombre autocompletado.',
          'Fase 2 (Enlace mágico): Botón destacado "Copiar Enlace Mágico" en la barra superior del Keeper y en el lobby, con notificación toast visual.',
          'Fase 3 (Reclamo de personaje): Modal automático de entrada para reclamar un PJ de la tripulación en 1 clic o importar un archivo .json del Character Creator, centrando la cámara en el token asignado.',
          'Fase 4 (Tripulación en vivo): Píldoras de estado en la barra de sesión del Keeper con avatares de personajes, nombres y estado de conexión en tiempo real.',
        ],
      },
      {
        title: 'Persistencia y Nube (Firebase)',
        items: [
          'Soporte completo y configuración para cuentas en la nube, biblioteca privada de personajes y almacenamiento de mapas de alta resolución vía Firebase, manteniendo el juego en vivo multijugador P2P mediante PeerJS.',
        ],
      },
      {
        title: 'Gestión de Tokens y Banco de Reserva',
        items: [
          'Banco de Reserva de Operativos: Posibilidad de retirar tokens del mapa activo hacia una reserva protegida preservando sus estadísticas, armadura, estados e inventario sin borrarlos.',
          'Atajos en lienzo táctico: Pulsar [Supr] o [Backspace] con un token seleccionado lo envía inmediatamente a la reserva; pulsar [Shift + Supr] permite eliminarlo definitivamente de la campaña.',
          'Sección dedicada en Roster Táctico: Pestaña con tokens en reserva, distintivo ámbar, botón de despliegue rápido [🚀] al centro del mapa actual y acceso directo a su ficha holográfica.',
          'Controles rápidos: Botón [📦 RESERVA] en la barra rápida inferior TokenHUD y en la fila de acciones del dossier.',
          'Reclamación inteligente: Si un jugador nuevo reclama un personaje almacenado en la reserva, el sistema lo despliega automáticamente en la escena y centra la cámara sobre él.',
        ],
      },
      {
        title: 'Barra de Carga de Escenas y Telemetría Multijugador',
        items: [
          'Barra de carga holográfica en lienzo: Indicador de progreso neón durante la descarga y decodificación de mapas pesados, mostrando bytes transferidos en tiempo real (MB/MB) y porcentaje.',
          'Telemetría de jugadores P2P: Mensaje MAP_LOAD_STATUS que sincroniza el progreso y finalización de carga de cada miembro de la tripulación en tiempo real.',
          'Indicador de sincronización en barra superior: Botón interactivo con estado global de la escena (100% listos o progreso mínimo) y micro-indicadores en las píldoras de tripulación.',
          'Dossier de estado de escena: Ventana holográfica para el Director de Juego con barras individuales por participante para confirmar que todos tienen el mapa cargado antes de iniciar el combate.',
        ],
      },
      {
        title: 'Almacenamiento y Optimización Cloudinary',
        items: [
          'Integración de Cloudinary Unsigned: Subida directa de imágenes de mapas desde el navegador sin necesidad de servidor backend.',
          'Optimización automática WebP/AVIF: Entrega en CDN global con compresión inteligente f_auto,q_auto reduciendo el ancho de banda y tiempos de carga entre 70% y 85%.',
          'Soporte en Creador de Escenas y Drag & Drop: Opción de subida con Cloudinary al crear una escena o arrastrar mapas directamente sobre el lienzo táctico.',
          'Modo dual y fallback: Compatibilidad total con Netlify/Vite y fallback transparente a almacenamiento local si se opera offline o sin credenciales.',
        ],
      },
      {
        title: 'Moderación y Control de Sesión',
        items: [
          'Expulsión de jugadores por el Keeper: El Director de Juego puede expulsar a cualquier jugador conectado tanto desde el listado del Lobby de Sesión como desde las píldoras de tripulación en vivo mediante un botón de acción rápida.',
          'Confirmación de seguridad: Diálogo interactivo de confirmación antes de aplicar la expulsión para evitar clics accidentales.',
          'Desconexión y revocación inmediata: Al expulsar a un jugador, su conexión WebRTC/P2P se cierra al instante, se desasignan y liberan todos los personajes y drones bajo su control, y se elimina de la lista de miembros de la partida.',
          'Prevención de reconexión: La sesión registra al jugador en una lista de bloqueo en memoria durante la partida, impidiendo reconexiones automáticas o manuales mediante token de reanudación.',
          'Notificación holográfica al jugador: El usuario expulsado recibe una alerta clara indicando la terminación del enlace neural sin afectar a sus campañas ni personajes guardados localmente.',
        ],
      },
      {
        title: 'Despliegue y Configuración Netlify',
        items: [
          'Protección de secretos y variables de entorno: Eliminado archivo .env del repositorio e incorporado a .gitignore; .env.example utiliza placeholders neutrales.',
          'Configuración netlify.toml: Definida regla SECRETS_SCAN_OMIT_KEYS para permitir variables públicas del cliente (Firebase y Cloudinary) y omisión de .env.example en el escaneo de secretos.',
          'Redirecciones SPA: Configurada redirección automática /* -> /index.html en Netlify para garantizar soporte de enlaces mágicos y parámetros de sala sin errores 404.',
        ],
      },
      {
        title: 'Arcos de Campaña, Eliminación de Escenas y Entornos',
        items: [
          'Eliminación de escenas: El Keeper puede eliminar escenas tácticas con confirmación de seguridad; los personajes activos se transfieren automáticamente a otra escena disponible y se protege contra el borrado de la última escena.',
          'Sistema de Arcos Narrativos: Agrupación de escenas por arcos de campaña, reordenación con botones interactivos arriba/abajo, selector para mover escenas entre arcos, y creación/eliminación de arcos con preservación de escenas.',
          'Recursos de Arco: Galería de imágenes tácticas y fichas asociadas a cada arco con subida directa a Cloudinary.',
          'Preajustes de Entorno del Sistema: Modos rápidos de 1 clic para configurar la escena activa (Derrelicto Espacial, Tormenta Planetaria, Bruma Tensa, Brecha Abisal e Instalación de Alta Seguridad).',
          'FOV Estándar de 90º: Cono de visión táctica establecido en 90º como estándar para todos los tokens de Veilfarers, conservando ajuste omnidireccional o focalizado en la ficha.',
          'Indicador de Baja (HP <= 0): Cuando los puntos de vida de un token caen a cero, el avatar se sustituye automáticamente por una calavera y huesos cruzados (☠️) con resplandor carmesí y distintivo de baja.',
          'Almacenamiento Cloudinary con prefijos: Subida de imágenes de Dossier con prefijo Dossier_ y avatares de tokens con prefijo Token_.',
          'Autenticación Netlify Identity con Google: Soporte directo de inicio de sesión con cuentas de Google mediante Netlify Identity Widget o Firebase Auth, protegiendo todos los parámetros del usuario frente a errores de lectura nula.',
        ],
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-05',
    title: 'Ayuda, changelog y entregas versionadas',
    sections: [
      { title: 'Añadido', items: [
        'Panel AYUDA accesible para Keeper y jugadores, con versión instalada, guía rápida y atajos.',
        'Changelog consultable y descargable desde la herramienta, con versión y fecha de cada entrega.',
        'Nombre del ZIP y de la descarga del changelog con el número de versión. La versión del VTT es independiente del Corebook 12.06.',
      ] },
      { title: 'Incluido en esta entrega', items: [
        'Chat público y susurros privados Keeper–jugador, borradores por conversación e historial filtrado al reconectar.',
        'Polígonos de agua que conservan sus vértices, controles de cierre y cancelación, y limpieza del trazado al cambiar de herramienta.',
        'Tiradas secretas del Keeper, biblioteca de adversarios, condiciones visibles y armas e inventario en la ficha.',
        'Sesiones guardadas, importación JSON de personajes, control de tokens y drones, sincronización LAN y bandeja de dados 3D.',
      ] },
      { title: 'Notas de uso', items: [
        'Las zonas antiguas guardadas erróneamente como rectángulos deben redibujarse: sus vértices originales no se conservaron.',
        'Los guardados y exportaciones del Keeper incluyen información privada y susurros. No hay cola de mensajes para destinatarios desconectados.',
        'Las cuentas y las imágenes en la nube requieren configurar un proyecto Firebase. La partida LAN no lo necesita.',
      ] },
    ],
  },
];

export const LEGACY_HISTORY = [
  { date:'2026-11-05', title:'Agua', text:'Corrección del guardado de polígonos, cancelación del trazado y edición con deshacer/rehacer.' },
  { date:'2026-11-04', title:'Herramientas de partida', text:'Chat y susurros, condiciones e inventario, tiradas secretas y biblioteca de adversarios.' },
  { date:'2026-11-03', title:'LAN y Orbital IV.2', text:'Sincronización de posiciones, lanzadores para red local, control de tokens asignados, selector de color y bandeja de dados compacta.' },
  { date:'2026-11-02', title:'Orbital II, III, IV y IV.1', text:'Interfaz orbital, fichas JSON y sesiones locales, roster y drones, cambios de escena y dados Three.js con física.' },
];
