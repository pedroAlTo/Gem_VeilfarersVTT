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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
    this.setAuthBusy(false);
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

  setAuthBusy(busy, msg = 'Verificando credenciales con el servidor...') {
    const spinner = document.getElementById('vf-auth-spinner');
    const msgEl = document.getElementById('vf-auth-spinner-msg');
    const form = document.getElementById('vf-email-auth-form');
    const btnGoogle = document.getElementById('vf-btn-google');
    const btnGuest = document.getElementById('vf-btn-guest');
    const btnRegister = document.getElementById('vf-btn-register');

    if (spinner) {
      spinner.classList.toggle('hidden', !busy);
    }
    if (msgEl) {
      msgEl.textContent = msg;
    }
    if (form) {
      form.querySelectorAll('input, button').forEach(el => el.disabled = !!busy);
    }
    if (btnGoogle) btnGoogle.disabled = !!busy;
    if (btnGuest) btnGuest.disabled = !!busy;
    if (btnRegister) btnRegister.disabled = !!busy;
    if (busy) {
      this.showError('');
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

        <div id="vf-auth-spinner" class="vf-auth-spinner hidden">
          <span class="auth-loading-dot"></span>
          <span id="vf-auth-spinner-msg">Verificando credenciales con el servidor...</span>
        </div>

        <p id="vf-auth-error" class="vf-error-msg"></p>
        <div id="vf-auth-info-banner" class="vf-auth-info" style="display:none;"></div>
      </div>

      <!-- PANTALLA 2: HUB PRINCIPAL (MODO ENTRADA SIMPLIFICADA) -->
      <div id="vf-hub-screen" class="vf-hub-container hidden">
        <header class="vf-hub-topbar">
          <div class="vf-hub-logo">
            <div class="hub-brand-title">
              <span class="hub-brand-glyph">✦</span>
              <h2>VEILFARERS // CENTRO DE MANDO</h2>
            </div>
            <!-- Identificador de Usuario y Correo de Inicio de Sesión -->
            <div class="vf-user-identity-box">
              <div class="vf-user-chip">
                <span class="user-pulse"></span>
                <span class="chip-label">USUARIO:</span>
                <strong id="vf-user-welcome">Conectando...</strong>
              </div>
              <div class="vf-email-chip">
                <span class="chip-label">CORREO:</span>
                <span id="vf-user-email">...</span>
              </div>
            </div>
          </div>
          <button type="button" id="vf-btn-logout" class="vf-btn vf-btn-logout" title="Desconectar y volver al portal de acceso">
            <span class="logout-icon">⏻</span> Cerrar Sesión
          </button>
        </header>

        <!-- DOS BOTONES GRANDES HERO: ENTRAR COMO JUGADOR vs KEEPER -->
        <div class="vf-hero-role-selector">
          <button type="button" id="role-btn-player" class="vf-hero-role-card active">
            <div class="hero-role-header">
              <span class="hero-role-icon">◈</span>
              <span class="hero-role-badge">MODO JUGADOR</span>
            </div>
            <h3>ENTRAR COMO JUGADOR</h3>
            <p>Conéctate a tus salas activas o únete con un código de invitación para desplegar tu operativo en la mesa.</p>
            <div class="hero-role-glow"></div>
          </button>

          <button type="button" id="role-btn-keeper" class="vf-hero-role-card">
            <div class="hero-role-header">
              <span class="hero-role-icon">⚡</span>
              <span class="hero-role-badge">MODO KEEPER</span>
            </div>
            <h3>ENTRAR COMO KEEPER</h3>
            <p>Abre y gestiona las campañas y salas que has creado o crea una nueva sala como Director de Juego.</p>
            <div class="hero-role-glow"></div>
          </button>
        </div>

        <!-- VISTA DE JUGADOR: SALAS CONECTADAS + UNIRSE CON CÓDIGO + VAULT -->
        <div id="vf-player-section" class="vf-hub-section-view">
          <div class="vf-hub-grid">
            <section class="vf-hub-panel">
              <div class="panel-header">
                <div class="panel-title-group">
                  <h3><span class="panel-icon">🛰️</span> SALAS CONECTADAS</h3>
                  <span class="panel-badge">TUS CAMPAÑAS COMO JUGADOR</span>
                </div>
              </div>
              <p class="panel-hint">Selecciona una sala a la que estás conectado para entrar directamente:</p>
              <div id="vf-player-rooms-list" class="vf-rooms-list">
                <div class="vf-room-loading">Cargando salas conectadas...</div>
              </div>

              <!-- Unirse con código nuevo -->
              <div class="vf-join-code-box">
                <h4 class="vf-subheading"><span class="icon">⌖</span> UNIRSE A UNA NUEVA SALA</h4>
                <div class="room-input-container">
                  <span class="room-input-icon">🔑</span>
                  <input type="text" id="vf-join-code-input" placeholder="Código de invitación (ej: VEI-8H2FA)" autocomplete="off" />
                  <button type="button" id="vf-btn-join-code" class="vf-btn vf-btn-primary">
                    <span>Unirse</span>
                  </button>
                </div>
              </div>
              <button type="button" id="vf-btn-join-vtt" class="vf-btn vf-btn-launch" style="width: 100%; margin-top: 14px;">
                <span class="btn-launch-icon">🚀</span>
                <span class="btn-launch-text">ENTRAR DIRECTO A LA MESA VTT</span>
                <span class="btn-launch-glow"></span>
              </button>
            </section>

            <section id="vf-vault-section" class="vf-hub-panel vault-panel">
              <div class="panel-header">
                <div class="panel-title-group">
                  <h3><span class="panel-icon">📂</span> CHARACTER VAULT</h3>
                  <span class="panel-badge">OPERATIVO TÁCTICO</span>
                </div>
                <div class="vault-actions">
                  <button type="button" id="vf-btn-open-creator" class="vf-btn vf-btn-primary vf-btn-xs">
                    <span class="btn-icon">+</span> Nuevo
                  </button>
                  <label class="vf-btn vf-btn-secondary vf-btn-xs file-upload-btn" title="Importar expediente desde archivo JSON">
                    <span class="btn-icon">⬇</span> JSON
                    <input type="file" id="vf-import-json" accept=".json" style="display:none;" />
                  </label>
                </div>
              </div>
              <p class="panel-hint">Operativo activo seleccionado para la mesa:</p>
              <div id="vf-vault-list" class="vf-vault-list"></div>
            </section>
          </div>
        </div>

        <!-- VISTA DE KEEPER: SALAS CREADAS + CREAR NUEVA SALA -->
        <div id="vf-keeper-section" class="vf-hub-section-view hidden">
          <div class="vf-hub-grid">
            <section class="vf-hub-panel">
              <div class="panel-header">
                <div class="panel-title-group">
                  <h3><span class="panel-icon">⚡</span> TUS SALAS CREADAS</h3>
                  <span class="panel-badge">CAMPAÑAS KEEPER</span>
                </div>
              </div>
              <p class="panel-hint">Salas donde eres Director de Juego (Keeper):</p>
              <div id="vf-keeper-rooms-list" class="vf-rooms-list">
                <div class="vf-room-loading">Cargando tus salas creadas...</div>
              </div>
            </section>

            <section class="vf-hub-panel">
              <div class="panel-header">
                <div class="panel-title-group">
                  <h3><span class="panel-icon">🚀</span> CREAR NUEVA SALA</h3>
                  <span class="panel-badge status-live">NUEVO SECTOR</span>
                </div>
              </div>
              <p class="panel-hint">Genera un nuevo sector o campaña persistente con código propio de invitación:</p>
              <div class="vf-create-room-box">
                <div class="room-form-group">
                  <label for="vf-create-room-name">
                    <span class="field-code">// NOMBRE</span> Nombre de la Sala o Campaña
                  </label>
                  <div class="room-input-container">
                    <span class="room-input-icon">✦</span>
                    <input type="text" id="vf-create-room-name" placeholder="Ej: Sector Acheron - Misión 1" autocomplete="off" />
                  </div>
                </div>
                <button type="button" id="vf-btn-create-room" class="vf-btn vf-btn-launch" style="width: 100%; margin-top: 14px;">
                  <span class="btn-launch-icon">⚡</span>
                  <span class="btn-launch-text">CREAR Y ABRIR COMO KEEPER</span>
                  <span class="btn-launch-glow"></span>
                </button>
              </div>
            </section>
          </div>
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

            <div class="creator-section">
              <div class="creator-section-header">
                <span class="sec-number">02</span>
                <span class="sec-title">MATRIZ DE ATRIBUTOS (DUALITY 2d12)</span>
              </div>
              <div class="creator-attrs-grid">
                <div class="attr-box"><span class="attr-code">AGI</span><label>Agility <input type="number" id="cr-attr-agility" value="1" min="-2" max="5" /></label></div>
                <div class="attr-box"><span class="attr-code">STR</span><label>Strength <input type="number" id="cr-attr-strength" value="0" min="-2" max="5" /></label></div>
                <div class="attr-box"><span class="attr-code">FIN</span><label>Finesse <input type="number" id="cr-attr-finesse" value="2" min="-2" max="5" /></label></div>
                <div class="attr-box"><span class="attr-code">INS</span><label>Instinct <input type="number" id="cr-attr-instinct" value="1" min="-2" max="5" /></label></div>
                <div class="attr-box"><span class="attr-code">PRE</span><label>Presence <input type="number" id="cr-attr-presence" value="0" min="-2" max="5" /></label></div>
                <div class="attr-box"><span class="attr-code">KNO</span><label>Knowledge <input type="number" id="cr-attr-knowledge" value="-1" min="-2" max="5" /></label></div>
              </div>
            </div>

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

    // Guest / Local Mode
    document.getElementById('vf-btn-guest')?.addEventListener('click', () => {
      this.setAuthBusy(false);
      this.currentUser = {
        uid: 'guest_' + Date.now(),
        displayName: 'Invitado Local',
        email: 'Modo Local'
      };
      const authScreen = document.getElementById('vf-auth-screen');
      const hubScreen = document.getElementById('vf-hub-screen');
      authScreen?.classList.add('hidden');
      hubScreen?.classList.remove('hidden');
      const welcome = document.getElementById('vf-user-welcome');
      if (welcome) welcome.textContent = 'Invitado Local';
      const emailEl = document.getElementById('vf-user-email');
      if (emailEl) emailEl.textContent = 'Modo Local / Sin correo';
      this.loadRoomsList();
    });

    // Email / Password Form Submission - STRICT WAITING FOR AUTH TO COMPLETE
    document.getElementById('vf-email-auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.auth) this.auth = getFirebaseAuthInstance();
      if (!this.auth) return this.showError('Firebase Auth no configurado o no disponible.');
      const email = document.getElementById('vf-auth-email').value.trim();
      const pass = document.getElementById('vf-auth-pass').value;
      this.setAuthBusy(true, 'Verificando credenciales de acceso con el servidor...');
      try {
        await signInWithEmailAndPassword(this.auth, email, pass);
        // Do not transition here; onAuthStateChanged will handle it once confirmed
      } catch (err) {
        this.setAuthBusy(false);
        this.showError(this.friendlyAuthError(err));
      }
    });

    // Register Submission
    document.getElementById('vf-btn-register')?.addEventListener('click', async () => {
      if (!this.auth) this.auth = getFirebaseAuthInstance();
      if (!this.auth) return this.showError('Firebase Auth no configurado o no disponible.');
      const email = document.getElementById('vf-auth-email').value.trim();
      const pass = document.getElementById('vf-auth-pass').value;
      if (!email || !pass) return this.showError('Introduce correo y contraseña para registrarte.');
      this.setAuthBusy(true, 'Creando nueva cuenta en el servidor...');
      try {
        await createUserWithEmailAndPassword(this.auth, email, pass);
      } catch (err) {
        this.setAuthBusy(false);
        this.showError(this.friendlyAuthError(err));
      }
    });

    // Google OAuth Submission
    document.getElementById('vf-btn-google')?.addEventListener('click', async () => {
      if (!this.auth) this.auth = getFirebaseAuthInstance();
      if (!this.auth) return this.showError('Firebase Auth no configurado o no disponible.');
      this.setAuthBusy(true, 'Abriendo autenticación segura con Google...');
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(this.auth, provider);
      } catch (err) {
        this.setAuthBusy(false);
        this.showError(this.friendlyAuthError(err));
      }
    });

    // Sign Out / Desconectar
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

    // DOS BOTONES GRANDES HERO: JUGADOR vs KEEPER
    const btnPlayer = document.getElementById('role-btn-player');
    const btnKeeper = document.getElementById('role-btn-keeper');
    const playerSec = document.getElementById('vf-player-section');
    const keeperSec = document.getElementById('vf-keeper-section');

    btnPlayer?.addEventListener('click', () => {
      this.selectedRole = 'player';
      btnPlayer.classList.add('active');
      btnKeeper?.classList.remove('active');
      playerSec?.classList.remove('hidden');
      keeperSec?.classList.add('hidden');
      this.updateSummaryText();
    });

    btnKeeper?.addEventListener('click', () => {
      this.selectedRole = 'keeper';
      btnKeeper.classList.add('active');
      btnPlayer?.classList.remove('active');
      keeperSec?.classList.remove('hidden');
      playerSec?.classList.add('hidden');
      this.updateSummaryText();
    });

    // Unirse a sala con código
    document.getElementById('vf-btn-join-code')?.addEventListener('click', () => {
      const input = document.getElementById('vf-join-code-input');
      this.joinWithCode(input?.value);
    });

    document.getElementById('vf-btn-join-vtt')?.addEventListener('click', () => {
      this.enterRoomTarget('mesa-principal', this.selectedRole || 'player');
    });

    document.getElementById('vf-join-code-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.joinWithCode(e.target.value);
      }
    });

    // Crear nueva sala (Keeper)
    document.getElementById('vf-btn-create-room')?.addEventListener('click', () => {
      const input = document.getElementById('vf-create-room-name');
      this.createNewRoom(input?.value);
    });

    document.getElementById('vf-create-room-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.createNewRoom(e.target.value);
      }
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
        this.setAuthBusy(false);
        authScreen?.classList.add('hidden');
        hubScreen?.classList.remove('hidden');

        // Mostrar usuario y correo con el que ha iniciado sesión
        const welcome = document.getElementById('vf-user-welcome');
        if (welcome) welcome.textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'Operativo');
        const emailEl = document.getElementById('vf-user-email');
        if (emailEl) emailEl.textContent = user.email || 'Modo Local / Sin correo';

        this.subscribeToUserVault(user.uid);
        this.loadRoomsList();
      } else {
        this.setAuthBusy(false);
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

  async loadRoomsList() {
    const playerRoomsEl = document.getElementById('vf-player-rooms-list');
    const keeperRoomsEl = document.getElementById('vf-keeper-rooms-list');
    if (!playerRoomsEl && !keeperRoomsEl) return;

    if (playerRoomsEl) playerRoomsEl.innerHTML = '<div class="vf-room-loading">Buscando salas conectadas...</div>';
    if (keeperRoomsEl) keeperRoomsEl.innerHTML = '<div class="vf-room-loading">Buscando tus salas creadas...</div>';

    let allRooms = [];
    try {
      const { rooms } = await import('../../roomController.js');
      if (rooms && rooms.service) {
        allRooms = await rooms.service.list().catch(() => []);
      }
    } catch (e) {
      console.warn('[Lobby] Error al listar salas de Firestore:', e);
    }

    // Also get invited/history rooms from local storage
    let localHistory = [];
    try {
      const { getInvitedSessions } = await import('../../networkManager.js');
      if (typeof getInvitedSessions === 'function') {
        localHistory = getInvitedSessions() || [];
      }
    } catch (e) {}

    const uid = this.currentUser?.uid;
    const keeperRooms = allRooms.filter(r => r && r.ownerUid === uid);
    
    // Player rooms: rooms where user is not owner, plus localHistory sessions
    const playerRooms = allRooms.filter(r => r && r.ownerUid !== uid);
    localHistory.forEach(h => {
      if (h && h.room && !playerRooms.some(r => r.id === h.room || r.inviteCode === h.invite)) {
        playerRooms.push({
          id: h.room,
          name: h.label || h.room,
          inviteCode: h.invite || h.room,
          isLocalHistory: true
        });
      }
    });

    // Provide default local suggestion if empty
    if (!playerRooms.length && (!this.currentUser || this.currentUser.uid?.startsWith('guest_'))) {
      playerRooms.push({
        id: 'mesa-principal',
        name: 'Mesa Principal (Local)',
        inviteCode: 'mesa-principal'
      });
    }

    this.renderPlayerRooms(playerRooms);
    this.renderKeeperRooms(keeperRooms);
  }

  renderPlayerRooms(rooms) {
    const el = document.getElementById('vf-player-rooms-list');
    if (!el) return;
    if (!rooms.length) {
      el.innerHTML = `
        <div class="vf-room-empty">
          <span class="empty-icon">🛰️</span>
          <p>No tienes salas conectadas todavía.</p>
          <small>Introduce un código de invitación abajo para unirte a una campaña.</small>
        </div>
      `;
      return;
    }

    el.innerHTML = rooms.map(r => `
      <div class="vf-room-card" data-room-id="${escapeHtml(r.id)}">
        <div class="vf-room-info">
          <strong class="vf-room-name">${escapeHtml(r.name || r.id)}</strong>
          <span class="vf-room-code">CÓDIGO: ${escapeHtml(r.inviteCode || r.id)}</span>
        </div>
        <button type="button" class="vf-btn vf-btn-primary vf-btn-sm btn-enter-room" data-room-id="${escapeHtml(r.id)}" data-role="player">
          ▶ Entrar a la sala
        </button>
      </div>
    `).join('');

    el.querySelectorAll('.btn-enter-room').forEach(btn => {
      btn.onclick = () => {
        const roomId = btn.dataset.roomId;
        this.enterRoomTarget(roomId, 'player');
      };
    });
  }

  renderKeeperRooms(rooms) {
    const el = document.getElementById('vf-keeper-rooms-list');
    if (!el) return;
    if (!rooms.length) {
      el.innerHTML = `
        <div class="vf-room-empty">
          <span class="empty-icon">⚡</span>
          <p>No tienes salas creadas todavía.</p>
          <small>Crea una nueva sala a la derecha para iniciar tu campaña como Keeper.</small>
        </div>
      `;
      return;
    }

    el.innerHTML = rooms.map(r => `
      <div class="vf-room-card is-keeper" data-room-id="${escapeHtml(r.id)}">
        <div class="vf-room-info">
          <strong class="vf-room-name">${escapeHtml(r.name || r.id)}</strong>
          <span class="vf-room-code">INVITACIÓN: ${escapeHtml(r.inviteCode || r.id)}</span>
        </div>
        <div class="vf-room-actions">
          <button type="button" class="vf-btn vf-btn-launch vf-btn-sm btn-enter-room" data-room-id="${escapeHtml(r.id)}" data-role="keeper" title="Abrir mesa de juego como Director">
            ⚡ Abrir como Keeper
          </button>
          <button type="button" class="vf-btn vf-btn-danger vf-btn-sm btn-delete-room" data-room-id="${escapeHtml(r.id)}" data-room-name="${escapeHtml(r.name || r.id)}" title="Eliminar sala definitivamente">
            🗑️
          </button>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.btn-enter-room').forEach(btn => {
      btn.onclick = () => {
        const roomId = btn.dataset.roomId;
        this.enterRoomTarget(roomId, 'keeper');
      };
    });

    el.querySelectorAll('.btn-delete-room').forEach(btn => {
      btn.onclick = async () => {
        const roomId = btn.dataset.roomId;
        const roomName = btn.dataset.roomName;
        if (confirm(`¿Confirmar eliminación definitiva de la sala "${roomName}"?`)) {
          try {
            const { rooms } = await import('../../roomController.js');
            if (rooms?.service) {
              await rooms.service.deleteRoom(roomId);
            }
          } catch (e) {
            console.warn('Error al eliminar sala:', e);
          }
          this.loadRoomsList();
        }
      };
    });
  }

  enterRoomTarget(roomId, role) {
    this.selectedRole = role;
    this.hideLobby();
    if (this.onEnterRoomCallback) {
      this.onEnterRoomCallback({
        roomId,
        currentUser: {
          uid: this.currentUser?.uid || 'guest_' + Date.now(),
          displayName: this.currentUser?.displayName || (role === 'keeper' ? 'Keeper' : 'Viajero'),
          role
        },
        activeCharId: role === 'keeper' ? null : (this.selectedCharId || null)
      });
    }
    import('../../roomController.js').then(async ({ rooms }) => {
      if (rooms) {
        try {
          await rooms.enter(roomId);
        } catch (err) {
          console.warn('[Lobby] rooms.enter:', err?.message || err);
        }
      }
    }).catch(err => {
      console.warn('[Lobby] rooms.enter:', err?.message || err);
    });
  }

  joinWithCode(code) {
    const trimmed = String(code || '').trim();
    if (!trimmed) {
      alert('Por favor introduce un código de invitación válido.');
      return;
    }
    this.selectedRole = 'player';
    this.hideLobby();
    if (this.onEnterRoomCallback) {
      this.onEnterRoomCallback({
        roomId: trimmed,
        currentUser: {
          uid: this.currentUser?.uid || 'guest_' + Date.now(),
          displayName: this.currentUser?.displayName || 'Viajero',
          role: 'player'
        },
        activeCharId: this.selectedCharId || null
      });
    }
    import('../../roomController.js').then(async ({ rooms }) => {
      if (rooms) {
        try {
          await rooms.join(trimmed, this.currentUser?.displayName || 'Viajero');
        } catch (err) {
          console.warn('[Lobby] rooms.join:', err?.message || err);
        }
      }
    }).catch(err => {
      console.warn('[Lobby] rooms.join:', err?.message || err);
    });
  }

  createNewRoom(name) {
    const trimmed = String(name || '').trim() || 'Sector Nuevo';
    this.selectedRole = 'keeper';
    this.hideLobby();
    if (this.onEnterRoomCallback) {
      this.onEnterRoomCallback({
        roomId: trimmed.toLowerCase().replace(/\s+/g, '-'),
        currentUser: {
          uid: this.currentUser?.uid || 'guest_' + Date.now(),
          displayName: this.currentUser?.displayName || 'Keeper',
          role: 'keeper'
        },
        activeCharId: null
      });
    }
    import('../../roomController.js').then(async ({ rooms }) => {
      if (rooms) {
        try {
          await rooms.create(trimmed);
        } catch (err) {
          console.warn('[Lobby] rooms.create:', err?.message || err);
        }
      }
    }).catch(err => {
      console.warn('[Lobby] rooms.create:', err?.message || err);
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
              <h4>${escapeHtml(st.name || 'Operativo')}</h4>
              <span class="vault-card-status">${isSelected ? '✦ ACTIVO' : 'SELECCIONAR'}</span>
            </div>
            <div class="vault-card-meta">
              <span class="meta-tag">${escapeHtml(st.species || 'Especie')}</span>
              <span class="meta-divider">•</span>
              <span class="meta-tag">${escapeHtml(st.background || 'Explorador')}</span>
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
        a.download = `${(st.name || 'veilfarer').toLowerCase().replace(/\s+/g, '_')}.json`;
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
            <span class="summary-value char-name-highlight"><strong>${escapeHtml(charName)}</strong> <small class="text-dim">(${escapeHtml(species)} • ${escapeHtml(background)})</small></span>
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
            <span class="summary-value text-dim">Sin personaje vinculado (el Keeper te asignará un token en la mesa)</span>
          </div>
          <div class="summary-status status-ready">
            <span class="status-pulse-dot">●</span> ENLACE LISTO // DESPLIEGUE DIRECTO A LA MESA
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
