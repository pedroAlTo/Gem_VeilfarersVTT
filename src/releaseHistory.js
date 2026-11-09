// Keep published entries unchanged. Prepend a new entry when package.json changes.
export const RELEASES = [
  {
    version:'1.1.1', date:'2026-11-09', title:'Ondas de lluvia y conservación de las mejoras de clima',
    sections:[
      {title:'Corregido',items:[
        'La lluvia deja de dibujar gotas, rayas, salpicaduras en suelo seco y destellos sobre todo el mapa. Solo genera ondas en las zonas de agua.',
        'Impactos dispersos con doble anillo, expansión suave y desvanecimiento, recortados por el contorno real del agua, incluidos polígonos cóncavos.',
        'Ondas ancladas al mapa, por debajo de tokens, iluminación y niebla de visión. Ocultar la capa de agua también oculta la lluvia.',
        'Ajuste de lluvia por escena con compatibilidad para guardados antiguos; reducir movimiento desactiva los impactos animados. Trabajo de dibujo acotado en mapas grandes.',
      ]},
      {title:'Conservado de la copia aportada',items:[
        'Bruma independiente y niveles de llovizna, lluvia y tormenta, que ahora regulan la densidad de las ondas.',
        'Mejoras del selector de color, calibración de rejilla y controles de agua. Se conservan los lanzadores actuales de GitHub.',
      ]},
      {title:'Prueba local',items:[
        'Laboratorio de efectos con intensidad de lluvia y bruma separadas. Versión, ayuda, changelog y nombre del paquete sincronizados en v1.1.1.',
      ]},
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
