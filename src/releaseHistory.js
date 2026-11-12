// Keep published entries unchanged. Prepend a new entry when package.json changes.
export const RELEASES = [
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
