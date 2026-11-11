# Integración de Veilfarers: Player HUD, Keeper HUD y Dados 3D

Este paquete unifica los módulos de `veilfarerscharcreator` en la rama `feat/persistent-rooms` de `Gem_VeilfarersVTT`.

## Contenido del Paquete

* `vttIntegrationInit.js`: Inicializador principal que orquesta el rol (Keeper o Jugador) e inyecta la UI reactiva.
* `modules/diceEngine3D.js`: Motor de renderizado y banner para tiradas Duality (Hope / Fear / Crítico).
* `modules/dualityResourceManager.js`: Automatización de recursos en Firebase (+1 Hope, -1 Stress, +1 Fear).
* `modules/vttDiceSync.js`: Sincronización en tiempo real sobre el nodo `rooms/{roomId}/diceLog`.
* `modules/playerHudController.js`: Drawer colapsable del jugador con HP, Stress, Hope, Armour Shields (A.S.) y Slots de mejora.
* `modules/keeperHudController.js`: Consola del Keeper con reserva de Fear interactiva, Party Tracker en vivo y dados rápidos.
* `styles/`: CSS desacoplado para no alterar el mapa ni los tokens existentes.

## Modo de Uso Rápido en tu VTT

1. Enlaza los 3 archivos CSS en tu `index.html`:
```html
<link rel="stylesheet" href="./src/vtt-integration/styles/dice-overlay.css">
<link rel="stylesheet" href="./src/vtt-integration/styles/player-hud.css">
<link rel="stylesheet" href="./src/vtt-integration/styles/keeper-hud.css">
```

2. Llama a la inicialización al unirse a la sala:
```javascript
import { initVeilfarersVTTModules } from './src/vtt-integration/vttIntegrationInit.js';

await initVeilfarersVTTModules({
  roomId: 'sala-123',
  currentUser: {
    uid: user.uid,
    displayName: user.displayName,
    role: isRoomKeeper ? 'keeper' : 'player'
  },
  activeCharId: 'char-456' // null si es Keeper
});
```