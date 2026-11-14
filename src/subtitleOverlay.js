import { store } from './state.js';
import { escapeHTML } from './ui.js';

class SubtitleOverlayManager {
  constructor() {
    this.root = null;
    this.senderEl = null;
    this.textEl = null;
    this.hideTimer = null;
    this.lastProcessedMsgId = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized || typeof document === 'undefined') return;
    this.initialized = true;

    // Inject subtitle overlay container
    this.root = document.createElement('div');
    this.root.id = 'vf-subtitle-overlay';
    this.root.className = 'vf-subtitle-overlay is-hidden';
    this.root.setAttribute('aria-live', 'polite');
    this.root.innerHTML = `
      <div class="vf-subtitle-card">
        <span class="vf-subtitle-sender" id="vf-sub-sender"></span>
        <span class="vf-subtitle-text" id="vf-sub-text"></span>
      </div>
    `;
    document.body.appendChild(this.root);

    this.senderEl = this.root.querySelector('#vf-sub-sender');
    this.textEl = this.root.querySelector('#vf-sub-text');

    // Subscribe to store updates for chatMessages
    store.subscribe((state, keys) => {
      if (keys.includes('chatMessages')) {
        this.checkNewChatMessage(state.chatMessages || []);
      }
    });

    // Initialize with current messages count so old messages aren't re-announced on boot
    const currentMsgs = store.state.chatMessages || [];
    if (currentMsgs.length > 0) {
      this.lastProcessedMsgId = currentMsgs[currentMsgs.length - 1].id;
    }
  }

  checkNewChatMessage(messages) {
    if (!messages.length) return;
    const latest = messages[messages.length - 1];
    if (!latest || latest.id === this.lastProcessedMsgId) return;
    this.lastProcessedMsgId = latest.id;

    // Find token/sender color
    const tokens = store.state.tokens || [];
    const senderToken = tokens.find(t => t.id === latest.senderTokenId || t.name === latest.senderName || (t.isPlayer && t.ownerId === latest.senderId));
    const isKeeper = latest.senderId === 'keeper' || latest.senderName?.toLowerCase().includes('keeper');
    const color = latest.color || senderToken?.color || (isKeeper ? '#fbbf24' : '#00f3ff');

    this.show({
      sender: latest.senderName || (isKeeper ? 'KEEPER' : 'OPERATIVO'),
      text: latest.text,
      color,
      duration: 5500
    });
  }

  show({ sender = '', text = '', color = '#00f3ff', duration = 5500 }) {
    if (!this.root) this.init();
    if (!this.root || !text) return;

    clearTimeout(this.hideTimer);

    if (this.senderEl) {
      if (sender) {
        this.senderEl.textContent = `${sender}:`;
        this.senderEl.style.color = color;
        this.senderEl.style.display = 'inline-block';
      } else {
        this.senderEl.style.display = 'none';
      }
    }

    if (this.textEl) {
      this.textEl.textContent = text;
      this.textEl.style.color = color || '#ffffff';
    }

    // Set accent colors on card
    const card = this.root.querySelector('.vf-subtitle-card');
    if (card) {
      card.style.borderColor = color;
      card.style.boxShadow = `0 6px 28px rgba(0, 0, 0, 0.8), 0 0 16px ${color}33`;
    }

    // Keep the overlay as the last child of <body> so it wins ties against
    // any other max z-index layer injected later (modals, dice canvas, toasts).
    if (this.root.parentNode !== document.body || document.body.lastElementChild !== this.root) {
      document.body.appendChild(this.root);
    }
    this.root.classList.remove('is-hidden');
    this.root.classList.add('is-visible');

    this.hideTimer = setTimeout(() => {
      this.hide();
    }, duration);
  }

  hide() {
    if (!this.root) return;
    this.root.classList.remove('is-visible');
    this.root.classList.add('is-hidden');
    clearTimeout(this.hideTimer);
  }
}

export const subtitleOverlay = new SubtitleOverlayManager();
export function displaySubtitle(text, sender, color, duration) {
  subtitleOverlay.show({ text, sender, color, duration });
}

