# Instrucciones de Despliegue para Antigravity

Este paquete contiene la suite completa para integrar en `Gem_VeilfarersVTT` en una **nueva rama independiente** (`feat/veilfarers-full-suite`):
1. **Lobby & Auth Gateway**: Login con Firebase Auth (Google y Email/Password), selector de modo (Keeper vs Jugador), Character Vault y Creador rápido integrado.
2. **Player HUD**: Ficha virtual interactiva desplegable (Drawer lateral con pips de HP, Stress, Hope, Armour Shields A.S. y Slots de armadura).
3. **Keeper HUD**: Consola superior flotante con Fear Pool interactivo sincronizado en Firebase, Party Tracker en tiempo real y dados de director.
4. **3D Dice Overlay**: Motor sincronizado de dados 2d12 Duality (Hope, Fear y Crítico) con banners y resolución automática de recursos.

## Pasos para Antigravity:

1. **Crear y posicionarse en la nueva rama:**
```bash
git fetch --all
git checkout -b feat/veilfarers-full-suite origin/main
# (o origin/feat/persistent-rooms según la rama base que quieras tomar)
```

2. **Descomprimir el contenido:**
```bash
unzip -o veilfarers-vtt-full-suite.zip
```

3. **Cargar los estilos en `index.html`:**
Añadir antes del cierre de `</head>`:
```html
<link rel="stylesheet" href="./src/vtt-integration/styles/lobby.css">
<link rel="stylesheet" href="./src/vtt-integration/styles/dice-overlay.css">
<link rel="stylesheet" href="./src/vtt-integration/styles/player-hud.css">
<link rel="stylesheet" href="./src/vtt-integration/styles/keeper-hud.css">
```

4. **Punto de Entrada en la Aplicación:**
En tu archivo principal de script (por ejemplo `src/main.js` o `index.html`):
```javascript
import { initVeilfarersApp } from './src/vtt-integration/vttIntegrationInit.js';

// Inicializa el Lobby de entrada (Auth + Vault + Room Selector)
initVeilfarersApp();
```

5. **Commit y Push a GitHub:**
```bash
git add .
git commit -m "feat(vtt): add full suite with auth lobby, character vault, player/keeper HUDs and 3d dice"
git push -u origin feat/veilfarers-full-suite
```