import { getDatabase, ref, set, onValue } from 'firebase/database';
import './styles/lobby.css';
import { VeilfarersDiceEngine } from './modules/diceEngine3D.js';
import { VTTDiceSync } from './modules/vttDiceSync.js';
import { PlayerHudController } from './modules/playerHudController.js';
import { KeeperHudController } from './modules/keeperHudController.js';
import { VeilfarersLobbyGateway } from './modules/lobbyGateway.js';

/**
 * Punto de entrada general: Muestra primero el Lobby (Login + Character Vault + Creador + Salas)
 * y al entrar a una sala inicializa el VTT con Dados 3D y el HUD de Jugador o Keeper.
 */
export function initVeilfarersApp(options = {}) {
  const lobby = new VeilfarersLobbyGateway(async ({ roomId, currentUser, activeCharId }) => {
    await initVeilfarersVTTModules({ roomId, currentUser, activeCharId });
    if (typeof options.onEnterRoom === 'function') {
      options.onEnterRoom({ roomId, currentUser, activeCharId });
    }
    if (typeof options.onJoinRoom === 'function') {
      options.onJoinRoom({ roomId, currentUser, activeCharId });
    }
  });
  return lobby;
}

export const launchVTTSession = initVeilfarersVTTModules;

/**
 * Inicializa el Overlay de Dados 3D y el HUD correspondiente (Keeper o Jugador) en la sala activa.
 * @param {Object} config - { roomId, currentUser: { uid, displayName, role }, activeCharId }
 */
export async function initVeilfarersVTTModules({ roomId, currentUser, activeCharId }) {
  let db = null;
  try {
    db = getDatabase();
  } catch (err) {
    console.warn('[Veilfarers Integration] Firebase RTDB aún no inicializado:', err);
  }

  // 1. Inyectar contenedores DOM para Dados 3D, Player HUD y Keeper HUD
  injectOverlayAndHudDOM();

  // 2. Arrancar Motor 3D y Sincronización por Firebase
  const diceEngine = new VeilfarersDiceEngine('#vf-dice-canvas-container');
  await diceEngine.init();

  let diceSync = null;
  if (db) {
    diceSync = new VTTDiceSync(roomId, currentUser, diceEngine);
    diceSync.listenToRoomRolls();
  }

  const playerHudEl = document.getElementById('vf-player-hud');
  const keeperHudEl = document.getElementById('vf-keeper-hud');
  const staleFearBadge = document.getElementById('vf-shared-fear-badge');
  if (staleFearBadge) staleFearBadge.remove();

  // 3. Enrutamiento de interfaz según el Rol en la mesa
  if (currentUser.role === 'keeper') {
    if (playerHudEl) playerHudEl.style.display = 'none';
    if (keeperHudEl) keeperHudEl.style.display = 'flex';

    const keeperHud = db ? new KeeperHudController(roomId, currentUser, diceSync) : null;
    return { diceEngine, diceSync, keeperHud };
  } else {
    // Modo Jugador: Ocultar consola de Keeper y montar su Ficha
    if (keeperHudEl) keeperHudEl.style.display = 'none';

    // Escuchar el contador de Fear para que el jugador vea la tensión acumulada
    if (db) {
      onValue(ref(db, `rooms/${roomId}/combatTracker/fearPool`), (snap) => {
        const countEl = document.getElementById('shared-fear-counter-val');
        if (countEl) countEl.textContent = Number(snap.val()) || 0;
      });
    }

    let playerHud = null;
    if (activeCharId && db) {
      // Registrar este personaje en la sala activa para que el Party Tracker del Keeper lo detecte al instante
      await set(ref(db, `rooms/${roomId}/activeCharacters/${currentUser.uid}`), activeCharId);
      playerHud = new PlayerHudController(activeCharId, roomId, diceSync);
    }

    return { diceEngine, diceSync, playerHud };
  }
}

function injectOverlayAndHudDOM() {
  if (document.getElementById('vf-integration-root')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'vf-integration-root';
  wrapper.innerHTML = `
    <!-- 1. OVERLAY DADOS 3D -->
    <div id="vf-dice-overlay" class="vf-dice-overlay">
      <div id="vf-dice-canvas-container"></div>
      <div id="vf-roll-banner" class="vf-roll-banner hidden">
        <div class="roll-header" id="roll-player-name">Jugador</div>
        <div class="roll-skill" id="roll-skill-name">Acción</div>
        <div class="roll-total" id="roll-total-value">0</div>
        <div class="roll-outcome" id="roll-outcome-badge">RESULTADO</div>
        <div class="roll-breakdown" id="roll-breakdown-text"></div>
        <div id="roll-resource-feedback" class="roll-resource-feedback hidden">
          <span id="roll-resource-text"></span>
          <button type="button" id="roll-resource-undo" class="btn-undo-resource">Deshacer</button>
        </div>
      </div>
    </div>

    <!-- 2. KEEPER HUD (Consola Flotante Movible y Minimizable a Icono ⚡) -->
    <div id="vf-keeper-hud" class="vf-keeper-hud is-minimized" style="display: none;">
      <!-- Botón minimizado (Icono ⚡ flotante con contador) -->
      <button type="button" class="vf-keeper-hud-toggle" id="btn-toggle-keeper-hud" title="Abrir Consola Flotante del Keeper">
        <span class="hud-toggle-icon">⚡</span>
        <span class="hud-toggle-label" id="keeper-min-fear-val">0</span>
      </button>

      <!-- Panel flotante expandible -->
      <div class="vf-keeper-panel" id="vf-keeper-panel">
        <div class="keeper-panel-header" id="vf-keeper-drag-handle">
          <div class="panel-header-title">
            <span class="drag-grip">⋮⋮</span>
            <span>⚡ KEEPER CONTROLS</span>
          </div>
          <button type="button" class="btn-keeper-minimize" id="btn-minimize-keeper-hud" title="Minimizar a icono">−</button>
        </div>

        <div class="keeper-panel-body">
          <div class="keeper-fear-module">
            <div class="keeper-fear-controls">
              <span class="keeper-fear-tag">⚡ Fear: <strong id="keeper-fear-count">0</strong></span>
              <button type="button" id="btn-fear-spend" class="btn-fear-action" title="Gastar 1 de Fear">-1 Gastar</button>
              <button type="button" id="btn-fear-gain" class="btn-fear-action" title="Añadir 1 de Fear">+1 Ganar</button>
            </div>
          </div>

          <div class="keeper-dice-module">
            <div class="dice-section-label">DADOS RÁPIDOS:</div>
            <div class="keeper-dice-row">
              <button type="button" class="keeper-quick-roll-btn" data-sides="20" data-label="Ataque Adversario (d20)">d20</button>
              <button type="button" class="keeper-quick-roll-btn" data-sides="12" data-label="Dado d12">d12</button>
              <button type="button" class="keeper-quick-roll-btn" data-sides="8" data-label="Daño (d8)">d8</button>
              <button type="button" class="keeper-quick-roll-btn" data-sides="6" data-label="Daño (d6)">d6</button>
            </div>
            <label class="keeper-secret-label">
              <input type="checkbox" id="keeper-secret-roll-toggle" checked />
              <span>🔒 Tirada oculta</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. CALLOUTS STACK PARA TODAS LAS TIRADAS (MULTIPLE & APILABLE) -->
    <div id="vf-callouts-stack" class="vf-callouts-stack"></div>

    <!-- 5. PLAYER HUD DRAWER (Ficha Interactiva del Jugador) -->
    <aside id="vf-player-hud" class="vf-player-hud collapsed">
      <div class="hud-quick-tab" id="hud-toggle-btn" title="Abrir/Cerrar Ficha">
        <span class="toggle-icon">◀</span>
        <div class="quick-stat hp"><span id="quick-hp">0</span>❤️</div>
        <div class="quick-stat stress"><span id="quick-stress">0</span>⚡</div>
        <div class="quick-stat hope"><span id="quick-hope">0</span>✨</div>
        <div class="quick-stat as"><span id="quick-as">0</span>🛡️</div>
      </div>
      <div class="hud-sheet-content">
        <header class="sheet-header">
          <img id="sheet-char-avatar" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='54' height='54' viewBox='0 0 24 24' fill='none' stroke='%2338bdf8' stroke-width='2'><circle cx='12' cy='8' r='5'/><path d='M20 21a8 8 0 1 0-16 0'/></svg>" alt="Avatar" class="char-avatar" />
          <div class="char-identity">
            <h2 id="sheet-char-name">Cargando Viajero...</h2>
            <span id="sheet-char-subtitle" class="char-subtitle">Especie • Trasfondo</span>
          </div>
        </header>
        <section class="sheet-section resources-grid">
          <div class="resource-box">
            <div class="resource-header"><span>HP (Daño)</span><span id="label-hp-count">0 / 6</span></div>
            <div id="pips-hp" class="pips-container hp-pips"></div>
          </div>
          <div class="resource-box">
            <div class="resource-header"><span>STRESS</span><span id="label-stress-count">0 / 6</span></div>
            <div id="pips-stress" class="pips-container stress-pips"></div>
          </div>
          <div class="resource-box">
            <div class="resource-header"><span>HOPE</span><span id="label-hope-count">2 / 6</span></div>
            <div id="pips-hope" class="pips-container hope-pips"></div>
          </div>
        </section>
        <section class="sheet-section armour-panel">
          <div class="armour-header">
            <div>
              <h3 id="sheet-armour-name">Traje de Vacío</h3>
              <span class="armour-thresholds" id="sheet-armour-thresholds">Umbrales: Menor 6 | Mayor 12 | Severo 18</span>
            </div>
          </div>
          <div class="resource-box as-box">
            <div class="resource-header"><span>🛡️ ARMOUR SHIELDS (A.S. Marcados)</span><span id="label-as-count">0 / 3</span></div>
            <div id="pips-as" class="pips-container as-pips"></div>
          </div>
          <div class="armour-slots-box">
            <div class="resource-header"><span>🔧 SLOTS DE MEJORA</span><span id="label-slots-count">0 / 2</span></div>
            <div id="armour-slots-list" class="slots-list"></div>
          </div>
        </section>
        <section class="sheet-section">
          <h3 class="section-title">Atributos (2d12 Duality)</h3>
          <div id="sheet-attributes-grid" class="attributes-grid"></div>
        </section>
      </div>
    </aside>
  `;
  document.body.appendChild(wrapper);
}

if (typeof window !== 'undefined') {
  window.initVeilfarersVTTModules = initVeilfarersVTTModules;
  window.initVeilfarersApp = initVeilfarersApp;
}
