// Keep published entries unchanged. Prepend a new entry when package.json changes.
export const RELEASES = [
  {
    version: '1.3.1',
    date: '2026-11-10',
    title: 'Persistencia del acceso y sincronización de tokens de jugadores',
    sections: [
      { title: 'Inicio de sesión', items: [
        'Session y Sesiones se agrupan en un único acceso SESIONES, con secciones de partida/tripulación y archivo guardado. La cuenta aparece arriba a la derecha: usuario y piloto verde al iniciar sesión, Offline y piloto rojo al salir.',
        'Restauración de Netlify Identity tanto si el widget ya terminó de iniciarse como si carga después. Firebase y Netlify mantienen estados independientes y se recuerda el proveedor elegido.',
        'Google aplica explícitamente la opción de mantener la sesión, tanto en ventana emergente como en redirección. Cancelar un acceso no inicia otro proveedor automáticamente.',
        'El cierre de sesión limpia sus listeners temporales. Las preferencias se aíslan por cuenta y una respuesta antigua no puede reasignar el personaje ni sobrescribir los ajustes del Keeper.',
      ] },
      { title: 'Movimiento y recursos', items: [
        'El arrastre usa una vista provisional separada del token confirmado: las actualizaciones del Keeper conservan la posición bajo el cursor y las estadísticas más recientes.',
        'Los cambios del jugador se identifican y confirman en orden. Una instantánea anterior no deshace el último movimiento ni los clics rápidos de HP, Armor, Stress o Hope/Effort.',
        'Se elimina el envío duplicado desde la barra de recursos; el foco del token se sincroniza sin permitir cambiar la configuración de su luz.',
        'Rechazos y tiempos de espera muestran un aviso y recuperan el último estado confirmado. Cambiar de escena, retirar permisos o mover el token desde el Keeper cancela arrastres obsoletos.',
        'La visión, las luces y la exploración usan posiciones confirmadas por el Keeper, incluso mientras un movimiento espera respuesta. El modo Player de previsualización del anfitrión no bloquea los movimientos de sus jugadores.',
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
