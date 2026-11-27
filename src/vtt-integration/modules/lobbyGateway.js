import { actorPortrait } from '../../tokenAvatars.js';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  updateProfile
} from "firebase/auth";
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
    this.characters = [];
    this.lobbyMode = 'basic';
    try { this.lobbyMode = localStorage.getItem('veil_lobby_mode') || 'basic'; } catch {}

    if (typeof window !== 'undefined') {
      window.vfLobbyGateway = this;
      window.addEventListener('veil:auth-signout', () => {
        this.showLoginScreen();
      });
    }

    this.injectLobbyDOM();
    this.setLobbyMode(this.lobbyMode);
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

  // index.html carries the same markup so the portal is visible before scripts load;
  // tests/lobby-visual.test.js keeps both copies identical.
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

        <div class="fx-cell fx-cell-brand">
          <span class="fx-num">01</span>
          <div class="vf-brand-header">
            <img class="vf-brand-logo" src="/assets/brand/veilfarers-logo-light.png" alt="Veilfarers" width="1200" height="298" />
            <div class="vf-brand-badge"><span class="badge-dot">●</span> TERMINAL DE ACCESO TÁCTICO</div>
            <h1>PORTAL TÁCTICO</h1>
            <p>Vault de Operativos, Campañas Persistentes y Mesa Virtual</p>
          </div>
        </div>

        <div class="fx-cell fx-cell-access">
        <span class="fx-num">02</span>
        <span class="fx-cell-title">Acceso</span>
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

        <!-- ¿TE HAN INVITADO? Entrar a una partida solo con un nombre (V3) -->
        <form id="vf-invite-form" class="vf-invite-form" autocomplete="off">
          <div class="vf-divider"><span>¿TE HAN INVITADO?</span></div>
          <div class="vf-invite-row">
            <input type="text" id="vf-invite-name" placeholder="Tu nombre en la mesa" maxlength="40" autocomplete="nickname" aria-label="Tu nombre en la mesa" />
            <input type="text" id="vf-invite-code" placeholder="Código de invitación" autocomplete="off" aria-label="Código de invitación" />
          </div>
          <button type="submit" id="vf-btn-invite-join" class="vf-btn vf-btn-primary">Entrar a la partida</button>
        </form>

        <div id="vf-auth-spinner" class="vf-auth-spinner hidden">
          <span class="auth-loading-dot"></span>
          <span id="vf-auth-spinner-msg">Verificando credenciales con el servidor...</span>
        </div>

        <p id="vf-auth-error" class="vf-error-msg"></p>
        <div id="vf-auth-info-banner" class="vf-auth-info" style="display:none;"></div>
        </div>
      </div>

      <!-- PANTALLA 2: HUB PRINCIPAL (MODO ENTRADA SIMPLIFICADA) -->
      <div id="vf-hub-screen" class="vf-hub-container hidden">
        <header class="vf-hub-topbar">
          <div class="vf-hub-logo">
            <div class="hub-brand-title">
              <span class="hub-brand-glyph">✦</span>
              <h2><img class="vf-hub-brandmark" src="/assets/brand/veilfarers-logo-light-sm.png" alt="Veilfarers" width="420" height="104" /> <span>CENTRO DE MANDO</span></h2>
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
          <div class="vf-hub-controls">
            <div class="vf-mode-switch" role="group" aria-label="Nivel de detalle del lobby">
              <span class="mode-label">Vista</span>
              <button type="button" id="vf-mode-basic" class="mode-btn" title="Solo lo necesario para entrar a jugar">Básico</button>
              <button type="button" id="vf-mode-advanced" class="mode-btn" title="Muestra todas las opciones de gestión">Avanzado</button>
            </div>
            <button type="button" id="vf-btn-logout" class="vf-btn vf-btn-logout" title="Desconectar y volver al portal de acceso">
              <span class="logout-icon">⏻</span> Cerrar Sesión
            </button>
          </div>
        </header>

        <p id="vf-hub-error" class="vf-hub-error" role="alert" hidden></p>

        <!-- INICIO RÁPIDO: crear, unirse o continuar con un clic (Plan de UX V3, fase 1) -->
        <section id="vf-quick-start" class="vf-quick-start" aria-label="Inicio rápido">
          <button type="button" id="vf-quick-create" class="vf-quick-action vf-quick-create">
            <span class="quick-icon">⚡</span>
            <span class="quick-title">CREAR PARTIDA</span>
            <span class="quick-hint">Diriges tú (Keeper). El enlace de invitación se copia solo.</span>
          </button>
          <button type="button" id="vf-quick-module" class="vf-quick-action vf-quick-module" data-module="hearts-in-the-void">
            <span class="quick-icon">📖</span>
            <span class="quick-title">HEARTS IN THE VOID</span>
            <span class="quick-hint">Aventura preparada: escenas, PNJ, relojes y dossieres. Diriges tú (Keeper); solo faltan tus mapas.</span>
          </button>
          <div class="vf-quick-action vf-quick-join">
            <span class="quick-icon">⌖</span>
            <span class="quick-title">UNIRME</span>
            <div class="vf-join-code-box">
              <div class="room-input-container">
                <input type="text" id="vf-join-code-input" placeholder="Código de invitación (ej: VEI-8H2FA)" autocomplete="off" aria-label="Código de invitación" />
                <button type="button" id="vf-btn-join-code" class="vf-btn vf-btn-primary">
                  <span>Unirse</span>
                </button>
              </div>
            </div>
          </div>
          <button type="button" id="vf-quick-continue" class="vf-quick-action vf-quick-continue" hidden>
            <span class="quick-icon">↻</span>
            <span class="quick-title">CONTINUAR</span>
            <span class="quick-hint" id="vf-quick-continue-name"></span>
          </button>
        </section>
        <!-- BÁSICO: tus partidas en una sola lista -->
        <section id="vf-quick-rooms" class="vf-quick-rooms" aria-label="Tus partidas">
          <h3><span class="panel-icon">🛰️</span> TUS PARTIDAS</h3>
          <div id="vf-quick-rooms-list" class="vf-rooms-list">
            <div class="vf-room-loading">Cargando tus partidas...</div>
          </div>
          <button type="button" id="vf-btn-join-vtt" class="vf-btn vf-btn-secondary vf-quick-local">
            <span class="btn-launch-text">Mesa local sin conexión</span>
          </button>
        </section>

        <!-- DOS BOTONES GRANDES HERO: ENTRAR COMO JUGADOR vs KEEPER -->
        <div class="vf-hero-role-selector">
          <button type="button" id="role-btn-player" class="vf-hero-role-card active">
            <span class="fx-num">01</span>
            <div class="hero-role-header">
              <span class="hero-role-icon">◈</span>
              <span class="hero-role-badge">MODO JUGADOR</span>
            </div>
            <h3>ENTRAR COMO JUGADOR</h3>
            <p>Conéctate a tus salas activas o únete con un código de invitación para desplegar tu operativo en la mesa.</p>
            <div class="hero-role-glow"></div>
          </button>

          <button type="button" id="role-btn-keeper" class="vf-hero-role-card">
            <span class="fx-num">02</span>
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
              <span class="fx-num">03</span>
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

            </section>

            <section id="vf-vault-section" class="vf-hub-panel vault-panel">
              <span class="fx-num">04</span>
              <div class="panel-header">
                <div class="panel-title-group">
                  <h3><span class="panel-icon">📂</span> MIS PERSONAJES</h3>
                  <span class="panel-badge">BIBLIOTECA PRIVADA DE TU CUENTA</span>
                </div>
                <div class="vault-actions">
                  <button type="button" id="vf-btn-character-creator" class="vf-btn vf-btn-primary vf-btn-xs" title="Crear un personaje paso a paso y descargar su ficha">
                    Crear personaje
                  </button>
                  <label class="vf-btn vf-btn-secondary vf-btn-xs file-upload-btn" title="Importar expediente desde archivo JSON">
                    Importar ficha JSON
                    <input type="file" id="vf-import-json" accept=".json" style="display:none;" />
                  </label>
                </div>
              </div>
              <p class="panel-hint">Solo tú ves estos personajes. Ya en la mesa, tráelos desde Cuenta → Personajes → Usar en la partida, o pide al Keeper que te asigne un token.</p>
              <div id="vf-vault-list" class="vf-vault-list"></div>
            </section>
          </div>
        </div>

        <!-- VISTA DE KEEPER: SALAS CREADAS + CREAR NUEVA SALA -->
        <div id="vf-keeper-section" class="vf-hub-section-view hidden">
          <div class="vf-hub-grid">
            <section class="vf-hub-panel">
              <span class="fx-num">03</span>
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
              <span class="fx-num">04</span>
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
    `;
    document.body.appendChild(root);
  }

  // Básico shows only what is needed to get into a game; Avanzado adds management options.
  setLobbyMode(mode) {
    this.lobbyMode = mode === 'advanced' ? 'advanced' : 'basic';
    try { localStorage.setItem('veil_lobby_mode', this.lobbyMode); } catch {}
    const root = document.getElementById('vf-lobby-gateway');
    if (!root) return;
    root.dataset.lobbyMode = this.lobbyMode;
    for (const [id, value] of [['vf-mode-basic', 'basic'], ['vf-mode-advanced', 'advanced']]) {
      const button = document.getElementById(id);
      button?.classList.toggle('active', value === this.lobbyMode);
      button?.setAttribute('aria-pressed', String(value === this.lobbyMode));
    }
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
      this.loadCharacters();
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

    // An invitation link (#roomInvite=CODE) fills the code and puts the invited form first.
    try {
      const invite = new URLSearchParams(location.hash.slice(1)).get('roomInvite') || new URLSearchParams(location.search).get('roomInvite');
      if (invite) {
        for (const id of ['vf-invite-code', 'vf-join-code-input']) { const box = document.getElementById(id); if (box && !box.value) box.value = invite; }
        document.getElementById('vf-auth-screen')?.setAttribute('data-invited', 'true');
        setTimeout(() => document.getElementById('vf-invite-name')?.focus(), 0);
      }
    } catch {}
    // Invited (V3): a name and the code are enough; no account is created.
    document.getElementById('vf-invite-form')?.addEventListener('submit', event => {
      event.preventDefault();
      this.joinWithoutAccount(document.getElementById('vf-invite-name')?.value, document.getElementById('vf-invite-code')?.value);
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

    document.getElementById('vf-mode-basic')?.addEventListener('click', () => this.setLobbyMode('basic'));
    document.getElementById('vf-mode-advanced')?.addEventListener('click', () => this.setLobbyMode('advanced'));

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

    // Inicio rápido (V3): crear con un clic y volver a la última partida.
    document.getElementById('vf-quick-create')?.addEventListener('click', () => this.quickCreate());
    document.getElementById('vf-quick-module')?.addEventListener('click', event => this.quickModule(event.currentTarget.dataset.module));
    document.getElementById('vf-quick-continue')?.addEventListener('click', event => {
      const { roomId, role } = event.currentTarget.dataset;
      if (roomId) this.enterRoomTarget(roomId, role || 'player');
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
    document.getElementById('vf-btn-character-creator')?.addEventListener('click', async () => {
      try {
        const { openCharacterCreator } = await import('../../creator/creatorUI.js');
        const dialog = await openCharacterCreator({ place: false });
        // Whatever was saved to the account while the creator was open shows up on closing it.
        new MutationObserver((_m, observer) => { if (!dialog.isConnected) { observer.disconnect(); this.loadCharacters(); } }).observe(document.body, { childList: true });
      } catch (err) { this.showHubError(`No se pudo abrir el creador: ${err?.message || err}`); }
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

        this.loadCharacters();
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

    // A failed lookup must never look like "you have no rooms".
    let allRooms = [], listError = '';
    if (this.hasCloudAccount()) {
      try {
        const { rooms } = await import('../../roomController.js');
        allRooms = await rooms.service.list();
      } catch (e) {
        console.warn('[Lobby] Error al listar salas de Firestore:', e);
        listError = this.roomErrorText(e);
      }
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
    this.renderQuickRooms(keeperRooms, playerRooms);
    if (listError) this.renderRoomsError(listError, !playerRooms.length);
  }

  hasCloudAccount() {
    const uid = this.currentUser?.uid;
    return !!uid && !String(uid).startsWith('guest_');
  }

  roomErrorText(error) {
    if (error?.code === 'permission-denied') return 'Firebase ha rechazado la consulta. Comprueba que las reglas de Firestore están publicadas.';
    if (error?.code === 'unavailable' || /offline|network/i.test(error?.message || '')) return 'Sin conexión con el servidor. Revisa tu red y vuelve a intentarlo.';
    return error?.message || 'Error desconocido.';
  }

  renderRoomsError(message, replacePlayerList = true) {
    const html = `
      <div class="vf-room-empty vf-room-error" role="alert">
        <p>No se han podido cargar tus salas.</p>
        <small>${escapeHtml(message)}</small>
        <button type="button" class="vf-btn vf-btn-secondary vf-btn-sm btn-retry-rooms">Reintentar</button>
      </div>
    `;
    for (const [id, replace] of [['vf-player-rooms-list', replacePlayerList], ['vf-keeper-rooms-list', true]]) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (replace) el.innerHTML = html; else el.insertAdjacentHTML('afterbegin', html);
      el.querySelectorAll('.btn-retry-rooms').forEach(btn => { btn.onclick = () => this.loadRoomsList(); });
    }
  }

  // Runs a cloud room action; on failure the user returns to the lobby and is told why.
  async runRoomAction(action, label) {
    this.showHubError('');
    try {
      const { rooms } = await import('../../roomController.js');
      await action(rooms);
    } catch (err) {
      console.warn(`[Lobby] ${label}:`, err?.message || err);
      this.showHubScreen();
      this.showHubError(`${label}: ${this.roomErrorText(err)}`);
      this.loadRoomsList();
    }
  }

  showHubError(message) {
    const el = document.getElementById('vf-hub-error');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  // Básico (V3): every game of this account in one list, and «Continuar» for the last one.
  renderQuickRooms(keeperRooms = [], playerRooms = []) {
    const el = document.getElementById('vf-quick-rooms-list');
    let remembered = '';
    try { remembered = this.currentUser?.uid ? localStorage.getItem(`veil.room.active.${this.currentUser.uid}`) || '' : ''; } catch {}
    const all = [...keeperRooms.map(r => ({ ...r, role: 'keeper' })), ...playerRooms.filter(r => r.id !== 'mesa-principal').map(r => ({ ...r, role: 'player' }))];
    const last = all.find(r => r.id === remembered);
    const cont = document.getElementById('vf-quick-continue');
    if (cont) {
      cont.hidden = !last;
      if (last) { cont.dataset.roomId = last.id; cont.dataset.role = last.role; }
      const label = document.getElementById('vf-quick-continue-name');
      if (label) label.textContent = last ? `${last.name || last.id} · ${last.role === 'keeper' ? 'Keeper' : 'Jugador'}` : '';
    }
    if (!el) return;
    if (!all.length) {
      el.innerHTML = `<div class="vf-room-empty"><p>${this.hasCloudAccount() ? 'Todavía no tienes partidas. Crea una o únete con un código.' : 'Sin cuenta no hay partidas online. Inicia sesión para crearlas o unirte, o juega en la Mesa local.'}</p></div>`;
      return;
    }
    all.sort((a, b) => (b.id === remembered) - (a.id === remembered));
    el.innerHTML = all.map(r => `
      <div class="vf-room-card${r.role === 'keeper' ? ' is-keeper' : ''}">
        <div class="vf-room-info"><strong class="vf-room-name"><span class="vf-quick-room-role">${r.role === 'keeper' ? 'KEEPER' : 'JUGADOR'}</span>${escapeHtml(r.name || r.id)}</strong></div>
        <div class="vf-room-actions"><button type="button" class="vf-btn vf-btn-primary vf-btn-sm btn-quick-enter" data-room-id="${escapeHtml(r.id)}" data-role="${r.role}">Entrar</button></div>
      </div>`).join('');
    el.querySelectorAll('.btn-quick-enter').forEach(btn => { btn.onclick = () => this.enterRoomTarget(btn.dataset.roomId, btn.dataset.role); });
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
          <button type="button" class="vf-btn vf-btn-danger vf-btn-sm btn-delete-room fx-advanced" data-room-id="${escapeHtml(r.id)}" data-room-name="${escapeHtml(r.name || r.id)}" title="Eliminar sala definitivamente">
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
        activeCharId: null
      });
    }
    // The local table and guests never touch the cloud.
    if (roomId === 'mesa-principal' || !this.hasCloudAccount()) return;
    // Keeps trying until it connects, with a counter and Cancel (back to the home screen).
    this.runRoomAction(async rooms => {
      const { retryUntilConnected } = await import('../../connectRetryUI.js');
      await retryUntilConnected(() => rooms.enter(roomId), { label: 'Entrando en la sala', onCancel: () => { this.showHubScreen(); this.loadRoomsList(); } });
    }, 'No se pudo abrir la sala');
  }

  // Entering a game with only a name (V3, user decision of 24 Nov 2026): an anonymous Firebase
  // session holds the seat in the room; the account can be kept later by linking it to Google.
  // With an invitation link, main.js joins as soon as the session exists; a typed code joins here.
  async joinWithoutAccount(name, code) {
    const who = String(name || '').trim().slice(0, 40), invite = String(code || '').trim();
    if (!who) return this.showError('Escribe tu nombre para la mesa.');
    if (!invite) return this.showError('Escribe el código de invitación que te ha pasado el Keeper.');
    if (!this.auth) this.auth = getFirebaseAuthInstance();
    if (!this.auth) return this.showError('La conexión con el servidor no está disponible. Juega en la Mesa local o inténtalo más tarde.');
    const viaLink = typeof location !== 'undefined' && /roomInvite=/.test(location.hash + location.search);
    this.inviteName = who;
    this.setAuthBusy(true, 'Entrando en la partida...');
    try {
      const credential = this.currentUser?.isAnonymous ? { user: this.currentUser } : await signInAnonymously(this.auth);
      await updateProfile(credential.user, { displayName: who }).catch(() => {});
      this.setAuthBusy(false);
      if (!viaLink) this.joinWithCode(invite);
    } catch (err) {
      this.setAuthBusy(false);
      this.showError(this.friendlyAuthError(err));
    }
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
          displayName: this.currentUser?.displayName || this.inviteName || 'Viajero',
          role: 'player'
        },
        activeCharId: null
      });
    }
    this.runRoomAction(async rooms => {
      const { retryUntilConnected } = await import('../../connectRetryUI.js');
      await retryUntilConnected(() => rooms.join(trimmed, this.currentUser?.displayName || this.inviteName || 'Viajero'), { label: 'Entrando con la invitación', onCancel: () => { this.showHubScreen(); this.loadRoomsList(); } });
    }, 'No se pudo entrar con ese código');
  }

  // One click (V3): a room with an automatic name (renamed later from Salas), the Keeper inside
  // and the invitation link copied. Without an account there is no online room: the local table.
  quickCreate() {
    if (!this.hasCloudAccount()) {
      this.showHubError('Para crear una partida online e invitar a otros, inicia sesión (Google o correo). Sin cuenta puedes jugar en la Mesa local sin conexión.');
      return;
    }
    const who = this.currentUser?.displayName || (this.currentUser?.email ? this.currentUser.email.split('@')[0] : '');
    const day = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    this.createNewRoom(`${who ? `Partida de ${who}` : 'Nueva partida'} · ${day}`);
  }

  // A prepared adventure (v2.62.2, user request: «no veo cómo crear la partida de Hearts; añádelo al
  // menú de selección de partidas»): with an account, a new online room holding the adventure (the
  // invitation is copied, as in Crear partida); without one, the adventure on the local table.
  async quickModule(id) {
    this.showHubError('');
    let campaign;
    try {
      const response = await fetch(`/campaigns/${id}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      campaign = await response.json();
    } catch (err) { this.showHubError(`No se pudo descargar la aventura: ${err?.message || err}`); return; }
    const name = campaign.campaignName || 'Aventura';
    if (!this.hasCloudAccount()) {
      const { store } = await import('../../state.js');
      if (!await store.importCampaignJSON(JSON.stringify(campaign))) { this.showHubError('No se pudo preparar la aventura en la mesa local.'); return; }
      this.enterRoomTarget('mesa-principal', 'keeper');
      return;
    }
    const day = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    this.createNewRoom(`${name} · ${day}`, campaign);
  }

  // The invitation of a room just created: the link is copied and said in a notice.
  async shareInvite(room) {
    const code = room?.inviteCode;
    if (!code || typeof location === 'undefined') return;
    const link = `${location.origin}${location.pathname}#roomInvite=${encodeURIComponent(code)}`;
    let copied = false;
    try { await navigator.clipboard.writeText(link); copied = true; } catch {}
    try {
      const { notify } = await import('../../ui.js');
      notify(copied ? `Enlace de invitación copiado. Código: ${code}` : `Comparte el código de invitación: ${code}`);
    } catch {}
  }

  createNewRoom(name, campaign = null) {
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
    this.runRoomAction(async rooms => { const room = await rooms.create(trimmed, { campaign }); this.shareInvite(room); }, 'No se pudo crear la sala');
  }

  // The library is the signed-in user's own (Firestore users/{uid}/characters); nobody else
  // can list or change it. It replaced the shared Realtime Database vault.
  async loadCharacters() {
    const container = document.getElementById('vf-vault-list');
    if (!container) return;
    if (!this.hasCloudAccount()) {
      this.characters = [];
      container.innerHTML = `<div class="vault-empty"><div class="vault-empty-title">SIN CUENTA</div><p>En modo invitado no hay biblioteca. Puedes crear un personaje y descargar su ficha, o iniciar sesión para guardarlo.</p></div>`;
      return;
    }
    container.innerHTML = '<div class="vf-room-loading">Cargando tus personajes...</div>';
    try {
      const { account } = await import('../../cloudAccount.js');
      this.characters = await account.list('characters');
      this.renderVaultList();
    } catch (err) {
      console.warn('[Lobby] No se pudo cargar la biblioteca de personajes:', err);
      container.innerHTML = `<div class="vf-room-empty vf-room-error" role="alert"><p>No se han podido cargar tus personajes.</p><small>${escapeHtml(this.roomErrorText(err))}</small><button type="button" class="vf-btn vf-btn-secondary vf-btn-sm btn-retry-characters">Reintentar</button></div>`;
      container.querySelector('.btn-retry-characters').onclick = () => this.loadCharacters();
    }
  }

  renderVaultList() {
    const container = document.getElementById('vf-vault-list');
    if (!container) return;
    if (!this.characters.length) {
      container.innerHTML = `<div class="vault-empty"><div class="vault-empty-title">AÚN NO TIENES PERSONAJES</div><p>Pulsa <strong>Crear personaje</strong> y guárdalo en tu cuenta al terminar, o importa una ficha <strong>JSON</strong>.</p></div>`;
      return;
    }
    container.innerHTML = '';
    for (const row of this.characters) {
      let sheet = null;
      try { sheet = JSON.parse(row.payload)?.token || null; } catch {}
      const meta = sheet ? [sheet.species, sheet.characterClass, sheet.subclass, sheet.path, sheet.level ? `Nivel ${sheet.level}` : ''].filter(Boolean) : [];
      const card = document.createElement('div');
      card.className = 'vault-char-card';
      card.innerHTML = `
        <div class="vault-card-body">
          ${sheet ? '<img class="vault-card-avatar" src="' + escapeHtml(actorPortrait(sheet)) + '" alt="" loading="lazy">' : ''}
          <div class="vault-card-main">
            <div class="vault-card-header-row">
              <h4>${escapeHtml(row.name || 'Personaje')}</h4>
              <span class="vault-card-status">${escapeHtml(new Date(row.updatedAt || Date.now()).toLocaleDateString())}</span>
            </div>
            <div class="vault-card-meta">${meta.map(m => `<span class="meta-tag">${escapeHtml(m)}</span>`).join('<span class="meta-divider">•</span>') || '<span class="meta-tag">Ficha guardada</span>'}</div>
            ${sheet ? `<div class="vault-card-stats fx-advanced">
              <span class="stat-pill hp" title="Hit Points">HP ${escapeHtml(sheet.hp?.current ?? '—')}/${escapeHtml(sheet.hp?.max ?? '—')}</span>
              <span class="stat-pill stress" title="Stress">Stress ${escapeHtml(sheet.stress?.current ?? 0)}/${escapeHtml(sheet.stress?.max ?? 6)}</span>
              <span class="stat-pill as" title="Armor Slots">Armor ${escapeHtml(sheet.armor?.current ?? 0)}/${escapeHtml(sheet.armor?.max ?? 0)}</span>
              <span class="stat-pill slots" title="Evasion">Evasion ${escapeHtml(sheet.evasion ?? '—')}</span>
            </div>` : ''}
          </div>
        </div>
        <div class="vault-card-actions fx-advanced">
          <button type="button" class="vf-btn-sm btn-export-json" title="Descargar la ficha en JSON">Descargar JSON</button>
          <button type="button" class="vf-btn-sm btn-delete-char" title="Eliminar de tu biblioteca">Eliminar</button>
        </div>
      `;
      card.querySelector('.btn-export-json').addEventListener('click', () => {
        const blob = new Blob([row.payload], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${String(row.name || 'personaje').toLowerCase().replace(/\s+/g, '_')}.json`;
        link.click();
      });
      card.querySelector('.btn-delete-char').addEventListener('click', async () => {
        if (!confirm(`¿Eliminar a ${row.name || 'este personaje'} de tu biblioteca?`)) return;
        try { const { account } = await import('../../cloudAccount.js'); await account.removeCharacter(row.id); }
        catch (err) { this.showHubError(`No se pudo eliminar: ${this.roomErrorText(err)}`); }
        this.loadCharacters();
      });
      container.appendChild(card);
    }
  }

  // Importing a sheet JSON is the one bridge from the character creator project.
  async handleImportJSON(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    this.showHubError('');
    try {
      if (!this.hasCloudAccount()) throw new Error('Inicia sesión para guardar fichas en tu biblioteca.');
      const { parseCharacterJSON } = await import('../../characterImport.js');
      const { account } = await import('../../cloudAccount.js');
      const parsed = parseCharacterJSON(await file.text());
      await account.saveCharacter({ ...parsed.token, x: 0, y: 0 });
      await this.loadCharacters();
    } catch (err) {
      this.showHubError(`No se pudo importar la ficha: ${err?.message || err}`);
    }
  }

  // Kept for callers: the lobby no longer links a character before entering (HANDOVER.md §1).
  updateSummaryText() {}

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
    if (code.includes('operation-not-allowed') || code.includes('admin-restricted-operation')) {
      return 'El acceso sin cuenta no está activado en este servidor (Firebase → Authentication → Anónimo). Entra con Google o con correo.';
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
