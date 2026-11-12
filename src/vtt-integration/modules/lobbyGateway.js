import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { ref, onValue, push, set, remove } from "firebase/database";
import { getFirebaseAuthInstance, getFirebaseDatabaseInstance } from './firebaseClient.js';

export class VeilfarersLobbyGateway {
  constructor(optionsOrCallback) {
    this.auth = getFirebaseAuthInstance();
    this.db = getFirebaseDatabaseInstance();
    this.onEnterRoomCallback = typeof optionsOrCallback === 'function' 
      ? optionsOrCallback 
      : (optionsOrCallback?.onJoinRoom || optionsOrCallback?.onEnterRoom);

    this.currentUser = null;
    this.wasLoggedIn = false;
    this.selectedRole = 'player';
    this.selectedCharId = null;
    this.vaultCharacters = {};

    if (typeof window !== 'undefined') {
      window.vfLobbyGateway = this;
      window.addEventListener('veil:auth-signout', () => {
        this.showLoginScreen();
      });
    }

    this.injectLobbyDOM();
    this.bindEvents();
    this.listenAuth();
  }

  init() {
    if (!document.getElementById('vf-lobby-gateway')) {
      this.injectLobbyDOM();
      this.bindEvents();
    }
  }

  showLoginScreen() {
    const root = document.getElementById('vf-lobby-gateway');
    if (root) {
      root.classList.remove('hidden');
    }
    const authScreen = document.getElementById('vf-auth-screen');
    const hubScreen = document.getElementById('vf-hub-screen');
    const modal = document.getElementById('vf-creator-modal');
    modal?.classList.add('hidden');
    hubScreen?.classList.add('hidden');
    authScreen?.classList.remove('hidden');

    const pass = document.getElementById('vf-auth-pass');
    if (pass) pass.value = '';
    const err = document.getElementById('vf-auth-error');
    if (err) err.textContent = '';
  }

  showHubScreen() {
    const root = document.getElementById('vf-lobby-gateway');
    if (root) {
      root.classList.remove('hidden');
    }
    const authScreen = document.getElementById('vf-auth-screen');
    const hubScreen = document.getElementById('vf-hub-screen');
    const modal = document.getElementById('vf-creator-modal');
    modal?.classList.add('hidden');
    authScreen?.classList.add('hidden');
    hubScreen?.classList.remove('hidden');
  }

  hideLobby() {
    const root = document.getElementById('vf-lobby-gateway');
    if (root) {
      root.classList.add('hidden');
    }
  }

  injectLobbyDOM() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('vf-lobby-gateway')) return;

    const root = document.createElement('div');
    root.id = 'vf-lobby-gateway';
    root.className = 'vf-lobby-gateway';
    root.innerHTML = `
      <!-- PANTALLA 1: LOGIN Y ACCESO AL PORTAL -->
      <div id="vf-auth-screen" class="vf-lobby-card auth-card">
        <button type="button" class="vf-btn-close-lobby" id="vf-btn-dismiss-lobby" title="Cerrar y entrar a la mesa VTT">✕</button>

        <div class="vf-brand-header">
          <div class="vf-brand-badge"><span class="badge-dot">●</span> VEILFARERS // TERMINAL DE ACCESO TÁCTICO</div>
          <h1>PORTAL TÁCTICO</h1>
          <p>Vault de Operativos, Campañas Persistentes y Mesa Virtual</p>
        </div>

        <form id="vf-email-auth-form" class="vf-auth-form">
          <div class="vf-input-group">
            <span class="vf-input-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </span>
            <input type="email" id="vf-auth-email" placeholder="Correo electrónico o indicativo" required autocomplete="email" />
          </div>
          <div class="vf-input-group">
            <span class="vf-input-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            <input type="password" id="vf-auth-pass" placeholder="Contraseña de acceso" required autocomplete="current-password" />
          </div>
          <div class="vf-auth-actions">
            <button type="submit" class="vf-btn vf-btn-primary">Iniciar Sesión</button>
            <button type="button" id="vf-btn-register" class="vf-btn vf-btn-secondary">Crear Cuenta</button>
          </div>
        </form>

        <div class="vf-divider"><span>O CONÉCTATE MEDIANTE</span></div>

        <button type="button" id="vf-btn-google" class="vf-btn vf-btn-google">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Continuar con Google
        </button>

        <button type="button" id="vf-btn-guest" class="vf-btn vf-btn-guest">
          <span class="guest-icon">🚀</span> Entrar como Invitado / Modo Local
        </button>

        <p id="vf-auth-error" class="vf-error-msg"></p>
        <div id="vf-auth-info-banner" class="vf-auth-info" style="display:none;"></div>
      </div>

      <!-- PANTALLA 2: HUB PRINCIPAL (VAULT + CREADOR + SALAS) -->
      <div id="vf-hub-screen" class="vf-hub-container hidden">
        <header class="vf-hub-topbar">
          <div class="vf-hub-logo">
            <div class="hub-brand-title">
              <span class="hub-brand-glyph">✦</span>
              <h2>VEILFARERS // CENTRO DE MANDO</h2>
            </div>
            <div class="vf-user-chip">
              <span class="user-pulse"></span>
              <span class="chip-label">OPERATIVO:</span>
              <strong id="vf-user-welcome">Conectando...</strong>
            </div>
          </div>
          <div class="vf-role-switcher" role="radiogroup" aria-label="Selector de rol táctico">
            <button type="button" id="role-btn-player" class="role-btn active">
              <span class="role-icon">◈</span> MODO JUGADOR
            </button>
            <button type="button" id="role-btn-keeper" class="role-btn">
              <span class="role-icon">⚡</span> MODO KEEPER (DIRECTOR)
            </button>
          </div>
          <button type="button" id="vf-btn-logout" class="vf-btn vf-btn-logout" title="Desconectar y volver al portal de acceso">
            <span class="logout-icon">⏻</span> Cerrar Sesión
          </button>
        </header>

        <div class="vf-hub-grid">
          <!-- COLUMNA IZQUIERDA: CHARACTER VAULT -->
          <section id="vf-vault-section" class="vf-hub-panel vault-panel">
            <div class="panel-header">
              <div class="panel-title-group">
                <h3><span class="panel-icon">📂</span> CHARACTER VAULT</h3>
                <span class="panel-badge">EXPEDIENTES TÁCTICOS</span>
              </div>
              <div class="vault-actions">
                <button type="button" id="vf-btn-open-creator" class="vf-btn vf-btn-primary vf-btn-xs">
                  <span class="btn-icon">+</span> Nuevo Personaje
                </button>
                <label class="vf-btn vf-btn-secondary vf-btn-xs file-upload-btn" title="Importar expediente desde archivo JSON">
                  <span class="btn-icon">⬇</span> Importar JSON
                  <input type="file" id="vf-import-json" accept=".json" style="display:none;" />
                </label>
              </div>
            </div>
            <p class="panel-hint">Selecciona el operativo activo que se desplegará en la mesa táctica:</p>
            <div id="vf-vault-list" class="vf-vault-list"></div>
          </section>

          <!-- COLUMNA DERECHA: CONEXIÓN A SALA -->
          <section class="vf-hub-panel room-panel">
            <div class="panel-header">
              <div class="panel-title-group">
                <h3><span class="panel-icon">🛰️</span> ENLACE A SALA PERSISTENTE</h3>
                <span class="panel-badge status-live">CANAL CUÁNTICO</span>
              </div>
            </div>
            <div class="room-form-group">
              <label for="vf-room-code-input">
                <span class="field-code">// SALA</span> Código o Frecuencia de Campaña
              </label>
              <div class="room-input-container">
                <span class="room-input-icon">⌖</span>
                <input type="text" id="vf-room-code-input" placeholder="Ej: mesa-principal" value="mesa-principal" autocomplete="off" />
              </div>
              <div class="room-presets-row">
                <span class="presets-label">Frecuencias sugeridas:</span>
                <button type="button" class="room-preset-btn" data-room="mesa-principal">mesa-principal</button>
                <button type="button" class="room-preset-btn" data-room="sector-acheron">sector-acheron</button>
                <button type="button" class="room-preset-btn" data-room="estacion-pearl">estacion-pearl</button>
              </div>
            </div>
            <div id="vf-selected-summary" class="vf-selected-summary">
              <!-- Rendered dynamically -->
            </div>
            <button type="button" id="vf-btn-join-vtt" class="vf-btn vf-btn-launch">
              <span class="btn-launch-icon">🚀</span>
              <span class="btn-launch-text">ENTRAR A LA MESA VTT</span>
              <span class="btn-launch-glow"></span>
            </button>
          </section>
        </div>
      </div>

      <!-- MODAL: CREADOR / EDITOR DE PERSONAJE INTEGRADO -->
      <div id="vf-creator-modal" class="vf-modal-backdrop hidden">
        <div class="vf-creator-dialog">
          <header class="creator-header">
            <div class="creator-header-title">
              <span class="creator-badge">✦ VEILFARERS // EXPEDIENTE TÁCTICO</span>
              <h3>CREADOR DE PERSONAJES</h3>
            </div>
            <button type="button" id="vf-btn-close-creator" class="vf-btn vf-btn-close-dialog" title="Cerrar">✕</button>
          </header>
          <form id="vf-creator-form" class="creator-form">
            <!-- SECCIÓN 1: IDENTIDAD -->
            <div class="creator-section">
              <div class="creator-section-header">
                <span class="sec-number">01</span>
                <span class="sec-title">IDENTIDAD DEL OPERATIVO</span>
              </div>
              <div class="creator-row">
                <label>Nombre del Viajero
                  <input type="text" id="cr-name" required placeholder="Ej: Kaelen Vance" />
                </label>
                <label>Especie / Subespecie
                  <input type="text" id="cr-species" required placeholder="Ej: Humano / Voidborn" />
                </label>
                <label>Trasfondo / Especialización
                  <input type="text" id="cr-background" required placeholder="Ej: Vanguardia / Explorador" />
                </label>
              </div>
            </div>

            <!-- SECCIÓN 2: ATRIBUTOS DUALITY -->
            <div class="creator-section">
              <div class="creator-section-header">
                <span class="sec-number">02</span>
                <span class="sec-title">MATRIZ DE ATRIBUTOS (DUALITY 2d12)</span>
              </div>
              <div class="creator-attrs-grid">
                <div class="attr-box">
                  <span class="attr-code">AGI</span>
                  <label>Agility <input type="number" id="cr-attr-agility" value="1" min="-2" max="5" /></label>
                </div>
                <div class="attr-box">
                  <span class="attr-code">STR</span>
                  <label>Strength <input type="number" id="cr-attr-strength" value="0" min="-2" max="5" /></label>
                </div>
                <div class="attr-box">
                  <span class="attr-code">FIN</span>
                  <label>Finesse <input type="number" id="cr-attr-finesse" value="2" min="-2" max="5" /></label>
                </div>
                <div class="attr-box">
                  <span class="attr-code">INS</span>
                  <label>Instinct <input type="number" id="cr-attr-instinct" value="1" min="-2" max="5" /></label>
                </div>
                <div class="attr-box">
                  <span class="attr-code">PRE</span>
                  <label>Presence <input type="number" id="cr-attr-presence" value="0" min="-2" max="5" /></label>
                </div>
                <div class="attr-box">
                  <span class="attr-code">KNO</span>
                  <label>Knowledge <input type="number" id="cr-attr-knowledge" value="-1" min="-2" max="5" /></label>
                </div>
              </div>
            </div>

            <!-- SECCIÓN 3: ARMADURA Y SISTEMAS -->
            <div class="creator-section">
              <div class="creator-section-header">
                <span class="sec-number">03</span>
                <span class="sec-title">BLINDAJE EXOTÁCTICO & MEJORAS</span>
              </div>
              <div class="creator-row">
                <label>Nombre de Armadura
                  <input type="text" id="cr-armour-name" value="Traje Exo-Táctico" />
                </label>
                <label title="Cantidad de escudos de armadura que puedes marcar para evitar daño">
                  🛡️ Armour Shields (A.S.)
                  <input type="number" id="cr-armour-as" value="3" min="0" max="10" />
                </label>
                <label title="Capacidad de mejoras instalables en la armadura">
                  🔧 Slots de Mejora
                  <input type="number" id="cr-armour-slots" value="2" min="0" max="6" />
                </label>
              </div>
            </div>

            <div class="creator-footer">
              <button type="button" id="vf-btn-cancel-creator" class="vf-btn vf-btn-secondary">Cancelar</button>
              <button type="submit" class="vf-btn vf-btn-primary">Guardar en el Vault</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(root);
  }

  bindEvents() {
    if (typeof document === 'undefined') return;

    const closeLobby = () => {
      this.hideLobby();
    };

    document.getElementById('vf-btn-dismiss-lobby')?.addEventListener('click', closeLobby);

    document.getElementById('vf-btn-guest')?.addEventListener('click', () => {
      closeLobby();
      if (this.onEnterRoomCallback) {
        this.onEnterRoomCallback({
          roomId: 'mesa-principal',
          currentUser: {
            uid: 'guest_' + Date.now(),
            displayName: 'Invitado Local',
            role: 'player'
          },
          activeCharId: null
        });
      }
    });

    document.getElementById('vf-email-auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.auth) this.auth = getFirebaseAuthInstance();
      if (!this.auth) return this.showError('Firebase Auth no configurado o no disponible.');
      const email = document.getElementById('vf-auth-email').value.trim();
      const pass = document.getElementById('vf-auth-pass').value;
      this.showError('');
      try {
        await signInWithEmailAndPassword(this.auth, email, pass);
      } catch (err) {
        this.showError(this.friendlyAuthError(err));
      }
    });

    document.getElementById('vf-btn-register')?.addEventListener('click', async () => {
      if (!this.auth) this.auth = getFirebaseAuthInstance();
      if (!this.auth) return this.showError('Firebase Auth no configurado o no disponible.');
      const email = document.getElementById('vf-auth-email').value.trim();
      const pass = document.getElementById('vf-auth-pass').value;
      if (!email || !pass) return this.showError('Introduce correo y contraseña para registrarte.');
      this.showError('');
      try {
        await createUserWithEmailAndPassword(this.auth, email, pass);
      } catch (err) {
        this.showError(this.friendlyAuthError(err));
      }
    });

    document.getElementById('vf-btn-google')?.addEventListener('click', async () => {
      if (!this.auth) this.auth = getFirebaseAuthInstance();
      if (!this.auth) return this.showError('Firebase Auth no configurado o no disponible.');
      this.showError('');
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(this.auth, provider);
      } catch (err) {
        this.showError(this.friendlyAuthError(err));
      }
    });

    // Desconectar / Cerrar Sesión -> Regresar a la pantalla de login
    document.getElementById('vf-btn-logout')?.addEventListener('click', async () => {
      try {
        if (this.auth) await signOut(this.auth);
      } catch (err) {
        console.warn('[Lobby] Error al cerrar sesión de Firebase:', err);
      }
      try {
        const { account } = await import('../../cloudAccount.js');
        if (account) await account.signOut();
      } catch (e) {}
      this.currentUser = null;
      this.wasLoggedIn = false;
      this.showLoginScreen();
    });

    // Segmented Role Switcher
    const btnPlayer = document.getElementById('role-btn-player');
    const btnKeeper = document.getElementById('role-btn-keeper');

    btnPlayer?.addEventListener('click', () => {
      this.selectedRole = 'player';
      btnPlayer.classList.add('active');
      btnKeeper?.classList.remove('active');
      const vSec = document.getElementById('vf-vault-section');
      if (vSec) {
        vSec.style.opacity = '1';
        vSec.style.pointerEvents = 'auto';
      }
      this.updateSummaryText();
    });

    btnKeeper?.addEventListener('click', () => {
      this.selectedRole = 'keeper';
      btnKeeper.classList.add('active');
      btnPlayer?.classList.remove('active');
      const vSec = document.getElementById('vf-vault-section');
      if (vSec) {
        vSec.style.opacity = '0.55';
      }
      this.updateSummaryText();
    });

    // Presets de sala rápida
    document.querySelectorAll('.room-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const roomInput = document.getElementById('vf-room-code-input');
        if (roomInput && btn.dataset.room) {
          roomInput.value = btn.dataset.room;
        }
      });
    });

    // Modal Creador
    const modal = document.getElementById('vf-creator-modal');
    document.getElementById('vf-btn-open-creator')?.addEventListener('click', () => modal?.classList.remove('hidden'));
    document.getElementById('vf-btn-close-creator')?.addEventListener('click', () => modal?.classList.add('hidden'));
    document.getElementById('vf-btn-cancel-creator')?.addEventListener('click', () => modal?.classList.add('hidden'));

    document.getElementById('vf-creator-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveNewCharacterFromModal();
      modal?.classList.add('hidden');
    });

    document.getElementById('vf-import-json')?.addEventListener('change', (e) => this.handleImportJSON(e));

    // Entrar a la Mesa VTT
    document.getElementById('vf-btn-join-vtt')?.addEventListener('click', () => {
      const roomInput = document.getElementById('vf-room-code-input');
      const roomId = (roomInput?.value || '').trim() || 'mesa-principal';
      if (this.selectedRole === 'player' && !this.selectedCharId) {
        alert('Selecciona o crea un operativo en tu Vault antes de entrar como Jugador.');
        return;
      }

      this.hideLobby();

      if (this.onEnterRoomCallback) {
        this.onEnterRoomCallback({
          roomId,
          currentUser: {
            uid: this.currentUser?.uid || 'guest_' + Date.now(),
            displayName: this.currentUser?.displayName || this.currentUser?.email || (this.selectedRole === 'keeper' ? 'Keeper (Director)' : 'Viajero Táctico'),
            role: this.selectedRole
          },
          activeCharId: this.selectedRole === 'keeper' ? null : this.selectedCharId
        });
      }
    });

    this.updateSummaryText();
  }

  listenAuth() {
    const banner = document.getElementById('vf-auth-info-banner');
    if (!this.auth) {
      if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = '✦ <strong>Modo Local Activo</strong> · Autenticación en la nube opcional. Puedes continuar directamente a la mesa.';
      }
      return;
    }
    if (banner) {
      banner.style.display = 'none';
    }
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      const authScreen = document.getElementById('vf-auth-screen');
      const hubScreen = document.getElementById('vf-hub-screen');

      if (user) {
        this.wasLoggedIn = true;
        authScreen?.classList.add('hidden');
        hubScreen?.classList.remove('hidden');
        const welcome = document.getElementById('vf-user-welcome');
        if (welcome) welcome.textContent = user.displayName || user.email;
        this.subscribeToUserVault(user.uid);
      } else {
        if (this.wasLoggedIn) {
          this.wasLoggedIn = false;
          this.showLoginScreen();
        } else {
          authScreen?.classList.remove('hidden');
          hubScreen?.classList.add('hidden');
        }
      }
    });
  }

  subscribeToUserVault(uid) {
    if (!this.db || !uid) return;
    const vaultRef = ref(this.db, 'character_vault');
    onValue(vaultRef, (snapshot) => {
      const allChars = snapshot.val() || {};
      this.vaultCharacters = {};

      Object.entries(allChars).forEach(([charId, charData]) => {
        if (charData && charData.ownerId === uid) {
          this.vaultCharacters[charId] = charData;
        }
      });

      this.renderVaultList();
    });
  }

  renderVaultList() {
    const container = document.getElementById('vf-vault-list');
    if (!container) return;
    container.innerHTML = '';

    const entries = Object.entries(this.vaultCharacters);
    if (entries.length === 0) {
      container.innerHTML = `
        <div class="vault-empty">
          <div class="vault-empty-icon">📂</div>
          <div class="vault-empty-title">REGISTRO DE OPERATIVOS VACÍO</div>
          <p>No tienes personajes guardados en este terminal. Pulsa <strong>"+ Nuevo Personaje"</strong> o importa una ficha JSON para comenzar.</p>
        </div>
      `;
      this.updateSummaryText();
      return;
    }

    if (!this.selectedCharId && entries.length > 0) {
      this.selectedCharId = entries[0][0];
    }

    entries.forEach(([charId, data]) => {
      const st = data.staticData || {};
      const dyn = data.dynamicState || {};
      const armour = st.armour || {};
      const isSelected = charId === this.selectedCharId;

      const card = document.createElement('div');
      card.className = `vault-char-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="vault-card-body">
          <div class="vault-card-avatar">◈</div>
          <div class="vault-card-main">
            <div class="vault-card-header-row">
              <h4>${st.name || 'Operativo'}</h4>
              <span class="vault-card-status">${isSelected ? '✦ ACTIVO' : 'SELECCIONAR'}</span>
            </div>
            <div class="vault-card-meta">
              <span class="meta-tag">${st.species || 'Especie'}</span>
              <span class="meta-divider">•</span>
              <span class="meta-tag">${st.background || 'Explorador'}</span>
            </div>
            <div class="vault-card-stats">
              <span class="stat-pill hp" title="Health Points">❤️ <strong>HP:</strong> ${dyn.hp || 0}/${st.maxHp || 6}</span>
              <span class="stat-pill stress" title="Stress Táctico">⚡ <strong>STR:</strong> ${dyn.stress || 0}/${st.maxStress || 6}</span>
              <span class="stat-pill hope" title="Hope / Determinación">✨ <strong>HOP:</strong> ${dyn.hope ?? 2}/${st.maxHope || 6}</span>
              <span class="stat-pill as" title="Armour Shields Disponibles">🛡️ <strong>A.S.:</strong> ${(armour.shieldsAS || 3) - (dyn.armourShieldsUsed || 0)}/${armour.shieldsAS || 3}</span>
              <span class="stat-pill slots" title="Slots de Mejora">🔧 <strong>SLT:</strong> ${armour.slots || 2}</span>
            </div>
          </div>
        </div>
        <div class="vault-card-actions">
          <button type="button" class="vf-btn-sm btn-export-json" title="Exportar Ficha JSON">⬇ JSON</button>
          <button type="button" class="vf-btn-sm btn-delete-char" title="Eliminar Operativo">🗑️</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.selectedCharId = charId;
        this.renderVaultList();
        this.updateSummaryText();
      });

      card.querySelector('.btn-export-json')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(st.name || 'veilfarer').toLowerCase().replace(/\\s+/g, '_')}.json`;
        a.click();
      });

      card.querySelector('.btn-delete-char')?.addEventListener('click', async () => {
        if (confirm(`¿Eliminar a ${st.name || 'este personaje'} del Vault?`)) {
          if (this.selectedCharId === charId) this.selectedCharId = null;
          if (this.db) await remove(ref(this.db, `character_vault/${charId}`));
        }
      });

      container.appendChild(card);
    });

    this.updateSummaryText();
  }

  async saveNewCharacterFromModal() {
    if (!this.currentUser || !this.db) return;

    const name = document.getElementById('cr-name')?.value.trim() || 'Viajero';
    const species = document.getElementById('cr-species')?.value.trim() || 'Humano';
    const background = document.getElementById('cr-background')?.value.trim() || 'Explorador';

    const newCharPayload = {
      ownerId: this.currentUser.uid,
      staticData: {
        name,
        species,
        background,
        maxHp: 6,
        maxStress: 6,
        maxHope: 6,
        attributes: {
          Agility: Number(document.getElementById('cr-attr-agility')?.value) || 0,
          Strength: Number(document.getElementById('cr-attr-strength')?.value) || 0,
          Finesse: Number(document.getElementById('cr-attr-finesse')?.value) || 0,
          Instinct: Number(document.getElementById('cr-attr-instinct')?.value) || 0,
          Presence: Number(document.getElementById('cr-attr-presence')?.value) || 0,
          Knowledge: Number(document.getElementById('cr-attr-knowledge')?.value) || 0
        },
        armour: {
          name: document.getElementById('cr-armour-name')?.value.trim() || 'Traje Exo-Táctico',
          shieldsAS: Number(document.getElementById('cr-armour-as')?.value) || 3,
          slots: Number(document.getElementById('cr-armour-slots')?.value) || 2,
          installedUpgrades: []
        }
      },
      dynamicState: {
        hp: 0,
        stress: 0,
        hope: 2,
        armourShieldsUsed: 0
      }
    };

    const newRef = push(ref(this.db, 'character_vault'));
    await set(newRef, newCharPayload);
    this.selectedCharId = newRef.key;
  }

  handleImportJSON(event) {
    const file = event.target.files?.[0];
    if (!file || !this.currentUser || !this.db) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        const payload = {
          ownerId: this.currentUser.uid,
          staticData: imported.staticData || {
            name: imported.name || 'Importado',
            species: imported.species || 'Viajero',
            background: imported.background || 'Explorador',
            maxHp: imported.maxHp || 6,
            maxStress: imported.maxStress || 6,
            maxHope: imported.maxHope || 6,
            attributes: imported.attributes || { Agility: 1, Strength: 0, Finesse: 1, Instinct: 0, Presence: 0, Knowledge: 0 },
            armour: imported.armour || { name: 'Armadura', shieldsAS: 3, slots: 2, installedUpgrades: [] }
          },
          dynamicState: imported.dynamicState || { hp: 0, stress: 0, hope: 2, armourShieldsUsed: 0 }
        };
        const newRef = push(ref(this.db, 'character_vault'));
        await set(newRef, payload);
        this.selectedCharId = newRef.key;
      } catch (err) {
        alert('Archivo JSON inválido: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  updateSummaryText() {
    const summaryEl = document.getElementById('vf-selected-summary');
    if (!summaryEl) return;

    if (this.selectedRole === 'keeper') {
      summaryEl.innerHTML = `
        <div class="summary-line">
          <span class="summary-label">MODO ACTIVO:</span>
          <span class="summary-value keeper-badge">⚡ KEEPER (DIRECTOR DE JUEGO)</span>
        </div>
        <div class="summary-line">
          <span class="summary-label">ACCESO:</span>
          <span class="summary-value text-dim">Consola de Fear, Party Tracker, Niebla & Visión Global</span>
        </div>
        <div class="summary-status status-ready">
          <span class="status-pulse-dot">●</span> ENLACE AUTORIZADO // LISTO PARA DESPLIEGUE
        </div>
      `;
    } else {
      const char = this.vaultCharacters[this.selectedCharId];
      const charName = char?.staticData?.name;
      const species = char?.staticData?.species || 'Especie';
      const background = char?.staticData?.background || 'Clase';

      if (charName) {
        summaryEl.innerHTML = `
          <div class="summary-line">
            <span class="summary-label">MODO ACTIVO:</span>
            <span class="summary-value player-badge">◈ JUGADOR // OPERATIVO</span>
          </div>
          <div class="summary-line">
            <span class="summary-label">PERSONAJE:</span>
            <span class="summary-value char-name-highlight"><strong>${charName}</strong> <small class="text-dim">(${species} • ${background})</small></span>
          </div>
          <div class="summary-status status-ready">
            <span class="status-pulse-dot">●</span> OPERATIVO VINCULADO // LISTO PARA DESPLEGAR
          </div>
        `;
      } else {
        summaryEl.innerHTML = `
          <div class="summary-line">
            <span class="summary-label">MODO ACTIVO:</span>
            <span class="summary-value player-badge">◈ JUGADOR // OPERATIVO</span>
          </div>
          <div class="summary-line">
            <span class="summary-label">PERSONAJE:</span>
            <span class="summary-value text-warning">Ninguno seleccionado</span>
          </div>
          <div class="summary-status status-warning">
            <span class="status-pulse-dot">⚠️</span> SELECCIONA O CREA UN OPERATIVO EN EL VAULT
          </div>
        `;
      }
    }
  }

  friendlyAuthError(err) {
    if (!err) return 'Error de autenticación desconocido.';
    const code = err.code || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
      return 'Credenciales incorrectas o usuario no registrado.';
    }
    if (code.includes('email-already-in-use')) {
      return 'Este correo ya tiene una cuenta registrada. Haz clic en Iniciar Sesión.';
    }
    if (code.includes('weak-password')) {
      return 'La contraseña debe contener al menos 6 caracteres.';
    }
    if (code.includes('invalid-email')) {
      return 'El formato del correo electrónico no es válido.';
    }
    if (code.includes('popup-closed-by-user')) {
      return 'Acceso cancelado: Se ha cerrado la ventana de Google.';
    }
    if (code.includes('popup-blocked')) {
      return 'El navegador ha bloqueado la ventana emergente de Google. Habilítala en la barra de direcciones.';
    }
    if (code.includes('unauthorized-domain')) {
      return 'Dominio web no autorizado en la consola de Firebase para OAuth.';
    }
    if (code.includes('network-request-failed')) {
      return 'Error de conexión: Comprueba tu conexión a Internet o cortafuegos.';
    }
    return err.message || 'Error al autenticar con Firebase.';
  }

  showError(msg) {
    const el = document.getElementById('vf-auth-error');
    if (el) el.textContent = msg;
  }
}

export const LobbyGateway = VeilfarersLobbyGateway;
