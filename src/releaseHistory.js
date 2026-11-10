// Keep published entries unchanged. Prepend a new entry when package.json changes.
export const RELEASES = [
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
