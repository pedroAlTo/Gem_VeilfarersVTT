# 🚀 HANDOVER DE DESARROLLO — VEILFARERS VTT

> **Fecha:** 31 de Octubre de 2026  
> **Proyecto:** Veilfarers Virtual Tabletop (VTT Táctico Sci-Fi / Espacial para Veilfarers 12.06)  
> **Repositorio Oficial en GitHub:** [https://github.com/pedroAlTo/Gem_VeilfarersVTT.git](https://github.com/pedroAlTo/Gem_VeilfarersVTT.git)  
> **Rama Principal:** `master`  
> **Stack Técnico:** Vanilla JavaScript (ES6 Modules) + HTML5 Canvas 2D + Vite + GSAP (animaciones HUD) + Web Audio API. Arquitectura pura, cero frameworks invasivos, 60 FPS garantizados con aceleración por hardware.

---

## 1. 🌐 Cómo Clonar y Arrancar en Cualquier Otro Ordenador

El repositorio en GitHub contiene la versión completa, optimizada y avanzada del VTT. Para continuar trabajando desde otro equipo (Windows, macOS o Linux):

### Requisitos Previos:
- **Node.js** (versión 18.x, 20.x o superior)
- **Git**
- Navegador web moderno con aceleración por hardware activada.

### Pasos de Instalación en 3 Minutos:

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/pedroAlTo/Gem_VeilfarersVTT.git
   cd Gem_VeilfarersVTT
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```
   *(Instala `vite`, `peerjs` y `gsap`).*

3. **Iniciar el servidor de desarrollo táctico:**
   ```bash
   npm run dev -- --host
   ```
   - Abre en tu navegador: **`http://localhost:5173/`**
   - El flag `--host` permite abrir el VTT desde tabletas, móviles o portátiles conectados a la misma red Wi-Fi utilizando la IP local que muestra la terminal.

4. **Compilar para Producción:**
   ```bash
   npm run build
   ```
   Genera el bundle estático en `dist/` en ~1 segundo.

---

## 2. 🗺️ Arquitectura del Sistema (`src/`)

```
Gem_VeilfarersVTT / VeilVTT
├── index.html              # Shell HUD Sci-Fi, modales, barras tácticas y docking panels
├── package.json            # Scripts de Vite, dependencias (vite, peerjs, gsap)
├── public/                 # Assets multimedia
│   └── assets/
│       ├── maps/           # starship_bridge.jpg, derelict_station.jpg
│       └── tokens/         # captain_harker.jpg, engineer_he09.jpg, pilot_vea.jpg, void_stalker.jpg
├── System/                 # Compendio canónico de reglas Veilfarers 12.06 en Markdown
└── src/
    ├── main.js             # Entrada del sistema, ciclo de eventos, atajos de teclado y HUD
    ├── state.js            # Store global reactivo con patrón Pub/Sub y gestión de estado
    ├── defaultData.js      # Datos iniciales (mapas predefinidos, luces, muros, tokens)
    │
    ├── canvasEngine.js     # Núcleo gráfico multicapa en Canvas 2D, FOV, sonar, snapping y touch
    ├── lightingEngine.js   # Motor de sombras dinámicas, raycasting, luces Siren y soldadura de vértices
    ├── fogEngine.js        # Motor de Niebla de Guerra (100% inexplorado, velo 80-95%, visión activa)
    ├── fxEngine.js         # Efectos visuales AAA (agujero negro relativista Kerr, Doppler, rayos, fuego)
    ├── audioEngine.js      # Sonido procedimental con Web Audio API (FX tácticos sin sonido intrusivo)
    │
    ├── inspectorHUD.js     # Inspector contextual para Muros, Puertas, Ventanas, Luces, Anomalías y Agua
    ├── tokenSheet.js       # HUD rápido inferior + Ficha Holográfica + Indicadores Canónicos Veilfarers
    ├── gridScalerHUD.js    # Herramienta de calibración visual interactiva de casillas
    │
    ├── rulesEngine.js      # Motor canónico Hope & Fear (2d12 de dualidad) y defensas
    ├── rulesCompendium.js  # Compendio de reglas, maniobras de combate y lore
    ├── diceRoller.js       # Lanzador y visualizador táctico de dados 3D / HUD
    ├── combatLog.js        # Registro de combate, tiradas y telemetría del sistema
    │
    ├── starshipManager.js  # Combate espacial de naves, asignación de energía y posiciones
    ├── clocksManager.js    # Relojes de progreso narrativo y táctico (4, 6 y 8 segmentos)
    ├── handoutManager.js   # Gestión de notas secretas, planos y documentos
    ├── fearMeter.js        # Medidor global de Miedo del Keeper animado con GSAP
    ├── layerManager.js     # Panel flotante de capas arrastrable, minimizable y controles de Niebla
    ├── networkManager.js   # Sincronización multijugador P2P WebRTC / Broadcast
    └── style.css           # Estilos Sci-Fi Cyber-Glassmorphism y soporte responsive tablet/móvil
```

---

## 3. 🧩 Detalle de Funcionalidades Implementadas al 100%

### 1. Ventana de Capas Tácticas Flotante y Arrastrable (`layerManager.js`)
- Barra de título con asa de arrastre visual (`⋮⋮ TACTICAL LAYERS`) y cursores `grab` / `grabbing`.
- Arrastre fluido unificado tanto para ratón como para dispositivos táctiles (`single-touch`).
- Botón de minimizar/expandir animado con GSAP que preserva la posición elegida por el usuario.
- Controles directos de visibilidad, bloqueo y configuración de Niebla de Guerra.

### 2. Menú de Snapping con 3 Opciones Independientes (`index.html` + `main.js`)
- Menú emergente lateral (flyout) accesible desde el botón de imán en la barra táctica.
- 3 interruptores independientes con estados visuales activos y marcas de verificación (`✓`):
  1. 🔲 **Snap a Rejilla** (`snapToGrid` / `gridSnap`): ancla a centros e intersecciones de celdas.
  2. ⚓ **Snap a Puntos de Anclaje** (`snapToAnchors`): ancla a extremos y vértices de muros, puertas y ventanas.
  3. 🎯 **Snap a Objetos** (`snapToObjects`): ancla a centros de tokens, emisores de luz y anomalías.

### 3. Muros Continuos sin Fisuras y Soldadura de Vértices (`canvasEngine.js` + `lightingEngine.js`)
- Renderizado de esquinas y empalmes con `ctx.lineCap = 'round'` y `ctx.lineJoin = 'round'` para evitar muescas visuales.
- Soldadura algorítmica de vértices contiguos (distancia <= 12px) en `computeVisibilityPolygon`, eliminando micro-huecos y fugas de luz.
- Tokens de jugadores no pueden atravesar muros físicamente.
- Las líneas de muros, puertas y ventanas solo son visibles para el Keeper; los jugadores perciben el mapa y los obstáculos de forma inmersiva sin trazados de depuración.

### 4. Agua Poligonal y Pintura Libre de Zonas Inundadas (`canvasEngine.js` + `inspectorHUD.js`)
- Menú flyout de agua con selector de modo: **🟦 Caja Rectangular** vs. **📐 Polígono**.
- Trazado interactivo de polígonos: clics sucesivos añaden vértices, con preview en tiempo real (líneas punteadas cian, nodos luminosos y guía elástica hacia el cursor).
- Cierre automático al hacer clic sobre el primer nodo (detecta radio <= 18px con texto *“Clic para cerrar”*), doble clic en canvas o tecla `Enter`.
- Tecla `Escape` cancela el trazado en curso.
- En el Inspector de Agua, selector de forma que permite convertir entre Caja y Polígono en cualquier momento sin perder datos.
- Selección por clic sobre la superficie completa del polígono o caja, con arrastre de vértices individuales o del centro completo.
- Efecto de lluvia meteorológica animada conmutada desde el inspector (`🌧️`).

### 5. Herramienta de Área Reactiva Instantánea
- Al hacer clic en cualquier forma del flyout (Cono, Caja, Línea, Círculo), si hay una plantilla seleccionada en el tablero, se transforma de inmediato a la geometría elegida.
- Si no hay plantilla activa, fija la herramienta y el tipo para que el siguiente clic sobre el mapa la invoque directamente.

### 6. Agujero Negro Relativista (Modelo Kerr) y Eliminación de Fantasmas (`fxEngine.js`)
- **Visuales AAA Relativistas:**
  - Arco de plasma con 6 filamentos espirales logarítmicos e inclinación en perspectiva.
  - Efecto Doppler relativista (*Doppler beaming*): el borde que rota hacia el observador resplandece con brillo y temperatura extrema (blanco-cian), mientras el opuesto se atenúa.
  - Arcos superior e inferior de curvatura gravitacional de Einstein (luz que rodea el horizonte de sucesos).
  - Anillo de fotones ultra-brillante (`#ffffff` a 2.5px) y núcleo de singularidad de vacío absoluto (`#000000`).
  - Ondas de contracción gravitacional concéntricas colapsando hacia el centro.
- **Sin Efectos de Sonido:** Totalmente silencioso para evitar ruidos molestos.
- **Cero Fantasmas / Residuos:** Purga inmediata de vórtices huérfanos al borrar o cambiar el tipo de anomalía.
- **Sincronización en Tiempo Real:** Al arrastrar la anomalía, el vórtice visual se traslada de forma sincronizada con el cursor.
- **Selección por Superficie:** Clic en cualquier punto del radio de la anomalía la selecciona de inmediato. Los marcadores se dibujan sobre las partículas para garantizar máxima accesibilidad.

### 7. Visión por Vibración (Tremorsense 360°) Estilo *Aliens* (`canvasEngine.js`)
- Barrido acústico de 10 segundos con pulso expansivo lento (3.2s) y desvanecimiento dramático (2.8s) con estética de detector de movimiento de fósforo verde.
- Para los jugadores, **cualquier contacto no-jugador (adversario, criatura, PNJ, horror) se enmascara estrictamente como `📡 VIBRACIÓN: ?????`**, impidiendo revelar nombres a través de la oscuridad o los muros.
- Solo para el Keeper con GM Vision activado se añade el nombre real entre corchetes: `📡 VIBRACIÓN: ????? [VOID HORROR STALKER]`.
- Muestra el tamaño relativo de la criatura (peana) sin renderizar el token en la oscuridad.

### 8. Adaptabilidad para Tablets y Smartphones
- Botón de colapso táctil (`🛠️`) en pantallas `< 768px` para replegar la barra de herramientas y maximizar el mapa.
- Modales holográficos (ficha de token, compendio) con scroll táctil suave (`-webkit-overflow-scrolling: touch`) y barra de acciones inferior fija (`sticky`), asegurando acceso permanente al botón "Aplicar Dossier".
- Aislamiento de gestos touch para evitar scroll elástico en navegadores móviles.

---

## 4. ⌨️ Atajos de Teclado Tácticos

| Tecla | Acción |
|:---:|---|
| **`M` / `V`** | Herramienta de Selección, Movimiento y Paneo del Escenario |
| **`R`** | Regla de Medición Láser (Bandas de Alcance canónicas en m y km) |
| **`T`** | Plantilla de Área Táctica (Círculo, Cono, Caja, Línea) |
| **`X`** | Disparador de Efectos Especiales AAA |
| **`P`** | Ping de Radar Táctico (también con `Alt + Clic`) |
| **`Shift + F`** | Activar / Desactivar Niebla de Guerra |
| **`G`** | Alternar Snapping a Rejilla |
| **`Shift + G`** | Abrir Calibrador Interactivo de Casillas del Mapa |
| **`Ctrl + D`** | Tirar Dados Rápidos (Hope & Fear 2d12 de Dualidad) |
| **`Enter`** | Cerrar y guardar trazado de polígono de agua en curso |
| **`Escape`** | Cancelar selección, trazados de muro, agua o plantillas activas |
| **`Delete` / `Backspace`** | Eliminar token, muro, luz, agua o anomalía seleccionada |

---

## 5. 🚀 Sincronización y Despliegue

Ambos directorios locales (`c:\VeildarersVTT\Gem_VeilfarersVTT` y `C:\Users\iomis\VeilVTT`) se encuentran completamente sincronizados y verificados con `npm run build`. Los cambios están preparados para la rama `master` del repositorio oficial.
