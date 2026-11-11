import { getDatabase, ref, set, onValue } from 'firebase/database';
import { VeilfarersDiceEngine } from './modules/diceEngine3D.js';
import { VTTDiceSync } from './modules/vttDiceSync.js';
import { PlayerHudController } from './modules/playerHudController.js';
import { KeeperHudController } from './modules/keeperHudController.js';

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
  const sharedFearBadgeEl = document.getElementById('vf-shared-fear-badge');

  // 3. Enrutamiento de interfaz según el Rol en la mesa
  if (currentUser.role === 'keeper') {
    if (playerHudEl) playerHudEl.style.display = 'none';
    if (sharedFearBadgeEl) sharedFearBadgeEl.style.display = 'none';
    if (keeperHudEl) keeperHudEl.style.display = 'flex';

    const keeperHud = db ? new KeeperHudController(roomId, currentUser, diceSync) : null;
    return { diceEngine, diceSync, keeperHud };
  } else {
    // Modo Jugador: Ocultar consola de Keeper, mostrar badge global de Fear y montar su Ficha
    if (keeperHudEl) keeperHudEl.style.display = 'none';
    if (sharedFearBadgeEl) sharedFearBadgeEl.style.display = 'flex';

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

    <!-- 2. BADGE DE FEAR PARA JUGADORES -->
    <div id="vf-shared-fear-badge" class="vf-shared-fear-badge" style="display: none;">
      <span>⚡ FEAR EN MESA:</span>
      <strong id="shared-fear-counter-val">0</strong>
    </div>

    <!-- 3. KEEPER HUD (Consola Superior: Fear Pool + Party Tracker + Dados Director) -->
    <header id="vf-keeper-hud" class="vf-keeper-hud" style="display: none;">
      <div class="keeper-fear-module">
        <div class="fear-module-header">
          <span>⚡ RESERVA DE FEAR</span>
          <span id="keeper-fear-count">0 / 12</span>
        </div>
        <div class="keeper-fear-controls">
          <button type="button" id="btn-fear-spend" class="btn-fear-action" title="Gastar 1 de Fear">-1 Gastar</button>
          <div id="keeper-fear-pips" class="keeper-fear-pips"></div>
          <button type="button" id="btn-fear-gain" class="btn-fear-action" title="Añadir 1 de Fear">+1</button>
        </div>
      </div>

      <div id="keeper-party-list" class="keeper-party-list">
        <span class="party-empty-msg">Esperando a que los jugadores entren con su ficha...</span>
      </div>

      <div class="keeper-dice-module">
        <div class="keeper-dice-row">
          <button type="button" class="keeper-quick-roll-btn" data-sides="20" data-label="Ataque Adversario (d20)">d20</button>
          <button type="button" class="keeper-quick-roll-btn" data-sides="12" data-label="Dado d12">d12</button>
          <button type="button" class="keeper-quick-roll-btn" data-sides="8" data-label="Daño (d8)">d8</button>
          <button type="button" class="keeper-quick-roll-btn" data-sides="6" data-label="Daño (d6)">d6</button>
        </div>
        <label class="keeper-secret-label">
          <input type="checkbox" id="keeper-secret-roll-toggle" />
          🔒 Tirada oculta
        </label>
      </div>
    </header>

    <!-- 4. PLAYER HUD DRAWER (Ficha Interactiva del Jugador) -->
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
}
