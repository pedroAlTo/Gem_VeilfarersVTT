import { store } from './state.js';
import { network } from './networkManager.js';
import { newId } from './persistence.js';
import { TABLE, KEEPER, CHAT_TEXT_LIMIT, chatHistoryFor, chatThread } from './chat.js';
import './ui.js';

export class ChatPanel {
  constructor(root, { stateStore = store, transport = network } = {}) {
    this.root = root; this.store = stateStore; this.network = transport;
    this.channel = TABLE; this.drafts = new Map(); this.known = new Set(); this.unread = new Set();
    root.innerHTML = `<section class="chat-console">
      <div class="chat-heading">
        <span class="eyebrow">COMMS // ENLACE</span>
        <span class="chat-status" role="status" title="Historial en tiempo real de la sesión"></span>
      </div>
      <label class="chat-channel-label" style="margin: 0;">
        <vf-select class="hud-select" aria-label="Destinatario del chat"></vf-select>
      </label>
      <p class="chat-privacy"></p>
      <div class="chat-messages" role="log" aria-label="Mensajes de la conversación" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
      <form class="chat-composer">
        <textarea id="chat_text" class="hud-input" rows="2" maxlength="2000" placeholder="Escribe a la mesa…" aria-describedby="chat_hint chat_error"></textarea>
        <div class="chat-composer-footer">
          <div class="chat-compose-meta"><span id="chat_hint">↵ Enviar · ⇧↵ Salto</span><span class="chat-count">0/2000</span></div>
          <button class="hud-btn hud-btn-xs hud-btn-primary chat-send" type="submit">Enviar</button>
        </div>
        <p id="chat_error" class="dossier-error" role="alert"></p>
      </form>
    </section>`;
    this.select = root.querySelector('vf-select'); this.input = root.querySelector('textarea');
    this.list = root.querySelector('.chat-messages'); this.error = root.querySelector('#chat_error');
    this.button = root.querySelector('.chat-send');
    this.select.addEventListener('change', () => this.choose(this.select.value));
    this.input.addEventListener('input', () => { this.error.textContent = ''; this.refreshComposer(); });
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void this.send(); }
    });
    root.querySelector('form').addEventListener('submit', event => { event.preventDefault(); void this.send(); });
    this.open = event => {
      this.choose(event.detail?.recipientId || TABLE);
      window.dispatchEvent(new CustomEvent('veil:open_sidebar_tab', { detail: { tab: 'chat' } }));
      this.input.focus(); this.refresh();
    };
    window.addEventListener('veil:open_chat', this.open);
    this.visibility = () => this.refresh();
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('resize', this.visibility);
    this.observer = new MutationObserver(this.visibility);
    this.observer.observe(root, { attributes: true, attributeFilter: ['style', 'hidden'] });
    const sidebar = document.getElementById('main_right_sidebar');
    if (sidebar) this.observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    this.unsubscribe = this.store.subscribe((_, keys) => {
      if (keys.some(k => ['chatMessages', 'players', 'connectedPeers', 'campaignId', 'userRole', 'isConnected', 'joiningSession', 'isHosting', 'roomCode'].includes(k))) this.refresh();
    });
    this.refresh();
  }
  get viewer() { return this.store.sessionRole === 'player' ? this.store.memberId : this.store.state.userRole === 'keeper' ? KEEPER : null; }
  get thread() { return this.channel === TABLE ? TABLE : this.viewer === KEEPER ? this.channel : this.viewer; }
  visible() {
    const sidebar = document.getElementById('main_right_sidebar');
    return !document.hidden && this.root.style.display !== 'none' && !this.root.hidden &&
      (!sidebar || window.innerWidth > 1024 || sidebar.classList.contains('open'));
  }
  choose(channel) {
    if (this.viewer !== KEEPER && ![TABLE, KEEPER].includes(channel)) return;
    this.drafts.set(this.channel, { text: this.input.value, retry: this.retry });
    this.channel = channel;
    const draft = this.drafts.get(channel);
    this.input.value = draft?.text || ''; this.retry = draft?.retry;
    this.error.textContent = ''; this.messageSignature = ''; this.refresh();
  }
  refresh() {
    const state = this.store.state;
    const identity = JSON.stringify([state.campaignId, state.roomCode, this.store.sessionRole, this.viewer]);
    const messages = chatHistoryFor(state.chatMessages, this.viewer);
    if (identity !== this.identity) {
      this.identity = identity; this.known = new Set(messages.map(m => m.id)); this.unread.clear();
      this.drafts.clear(); this.channel = TABLE; this.input.value = ''; this.retry = null; this.pending = null;
      this.error.textContent = ''; this.messageSignature = '';
    }
    const ids = new Set(messages.map(m => m.id));
    for (const m of messages) if (!this.known.has(m.id) && m.senderId !== this.viewer) this.unread.add(m.id);
    this.known = ids;
    for (const id of this.unread) if (!ids.has(id)) this.unread.delete(id);
    if (this.visible()) for (const m of messages) if (chatThread(m) === this.thread) this.unread.delete(m.id);
    const badge = document.querySelector('.tab-nav-btn[data-tab="chat"] .chat-unread');
    if (badge) { badge.hidden = !this.unread.size; badge.textContent = this.unread.size > 99 ? '99+' : String(this.unread.size); }
    const unreadFor = thread => messages.filter(m => this.unread.has(m.id) && chatThread(m) === thread).length;
    const choices = [{ id: TABLE, name: 'Mesa · todos', thread: TABLE }];
    if (this.viewer === KEEPER) {
      const people = new Map((state.players || []).map(p => [p.id, p.name]));
      for (const m of messages) if (m.recipientId !== TABLE && !people.has(chatThread(m))) people.set(chatThread(m), m.senderId === KEEPER ? m.recipientName : m.senderName);
      if (this.channel !== TABLE && !people.has(this.channel)) people.set(this.channel, 'Jugador');
      for (const [id, name] of people) choices.push({ id, thread: id, name: `${name} · ${state.connectedPeers?.some(p => p.id === id) && state.isConnected ? 'susurro' : 'desconectado'}` });
    } else choices.push({ id: KEEPER, name: 'Keeper · susurro', thread: this.viewer });
    const options = choices.map(p => ({ id: p.id, name: p.name + (unreadFor(p.thread) ? ` (${unreadFor(p.thread)} nuevos)` : '') }));
    const signature = JSON.stringify(options);
    if (signature !== this.optionsSignature) {
      this.optionsSignature = signature;
      this.select.querySelectorAll('option').forEach(o => o.remove());
      for (const p of options) { const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; this.select.append(option); }
    }
    this.select.value = this.channel;
    const privateChannel = this.channel !== TABLE;
    this.root.querySelector('.chat-console').classList.toggle('is-whisper', privateChannel);
    this.root.querySelector('.chat-privacy').textContent = privateChannel
      ? 'SUSURRO · Solo tú y este destinatario. El Keeper guarda la conversación.'
      : 'MESA · Visible para todos los participantes de la sesión.';
    const threadMessages = messages.filter(m => chatThread(m) === this.thread);
    const messageSignature = JSON.stringify([this.channel, threadMessages.map(m => m.id)]);
    if (messageSignature !== this.messageSignature) {
      const bottom = !this.messageSignature || this.list.scrollHeight - this.list.clientHeight - this.list.scrollTop < 60;
      this.messageSignature = messageSignature;
      const fragment = document.createDocumentFragment();
      if (!threadMessages.length) {
        const empty = document.createElement('p'); empty.className = 'chat-empty';
        empty.textContent = privateChannel ? 'Canal privado preparado. Los susurros aparecerán aquí.' : 'Abre la comunicación con tu tripulación.'; fragment.append(empty);
      }
      for (const m of threadMessages) {
        const article = document.createElement('article'); article.className = `chat-message${m.senderId === this.viewer ? ' is-own' : ''}`;
        const header = document.createElement('header'), name = document.createElement('strong'), time = document.createElement('time'), body = document.createElement('p');
        name.textContent = m.senderName; time.dateTime = new Date(m.sentAt).toISOString(); time.title = new Date(m.sentAt).toLocaleString();
        time.textContent = new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        body.textContent = m.text; header.append(name, time); article.append(header, body); fragment.append(article);
      }
      this.list.replaceChildren(fragment); if (bottom) this.list.scrollTop = this.list.scrollHeight;
    }
    this.refreshComposer();
  }
  unavailable() {
    const s = this.store.state;
    if (!this.viewer) return 'Únete a una sesión para escribir como jugador.';
    if (s.joiningSession || (this.store.sessionRole !== 'local' && !s.isConnected)) return 'Sin conexión · el borrador se conserva. Reconecta para enviar.';
    if (this.viewer === KEEPER && this.channel !== TABLE && (!s.isConnected || !s.connectedPeers?.some(p => p.id === this.channel))) return 'Destinatario desconectado · el susurro no se enviará hasta que vuelva.';
    return '';
  }
  refreshComposer() {
    const reason = this.unavailable();
    this.root.querySelector('.chat-status').textContent = this.store.state.isConnected ? 'EN LÍNEA' : 'LOCAL / SIN CONEXIÓN';
    this.root.querySelector('.chat-status').dataset.online = String(!!this.store.state.isConnected);
    this.root.querySelector('.chat-count').textContent = `${this.input.value.length} / ${CHAT_TEXT_LIMIT}`;
    this.input.placeholder = this.channel === TABLE ? 'Escribe a la mesa…' : 'Escribe un susurro privado…';
    this.button.disabled = !!this.pending || !!reason || !this.input.value.trim() || this.input.value.length > CHAT_TEXT_LIMIT;
    this.button.textContent = this.pending ? 'Enviando…' : this.channel !== TABLE ? 'Enviar susurro' : this.store.state.isConnected ? 'Enviar a la mesa' : 'Guardar en la mesa local';
    this.root.querySelector('#chat_hint').textContent = reason || 'Enter envía · Mayús + Enter, nueva línea';
  }
  async send() {
    if (this.pending || this.unavailable() || !this.input.value.trim() || this.input.value.length > CHAT_TEXT_LIMIT) return;
    const text = this.input.value, channel = this.channel, identity = this.identity;
    const fingerprint = JSON.stringify([channel, text.trim()]);
    const clientId = this.retry?.fingerprint === fingerprint ? this.retry.clientId : newId();
    this.retry = { fingerprint, clientId };
    this.drafts.set(channel, { text, retry: this.retry });
    const operation = { identity, channel }; this.pending = operation;
    this.error.textContent = ''; this.refreshComposer();
    try {
      await this.network.sendChat({ text, recipientId: channel, clientId });
      if (this.identity !== identity) return;
      if (this.drafts.get(channel)?.text === text) this.drafts.delete(channel);
      if (this.channel === channel && this.input.value === text) { this.input.value = ''; this.retry = null; }
    } catch (error) {
      if (this.identity === identity && this.channel === channel) this.error.textContent = `${error.message} El borrador se conserva; puedes reintentar.`;
    } finally {
      if (this.pending === operation) { this.pending = null; this.refreshComposer(); }
    }
  }
  destroy() {
    this.unsubscribe(); this.observer.disconnect();
    window.removeEventListener('veil:open_chat', this.open); window.removeEventListener('resize', this.visibility);
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
