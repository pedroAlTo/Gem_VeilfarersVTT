import { controlsToken } from './tokenPermissions.js';
import { actorPortrait } from './tokenAvatars.js';
import { isInlinePortrait, isPortraitReference } from './portraitCatalog.js';

export function speakerToken(state, memberId, preferredId) {
  const owned = (state.tokens || []).filter(t => controlsToken(t, memberId) && !t.inReserve && t.mapId === state.activeMapId);
  return owned.find(t => t.id === preferredId) || owned.find(t => t.actorType === 'player' || t.isPlayer) || owned[0];
}

export function speakerAppearance(entry, state) {
  if (entry.senderId === 'veil-rules') return null;
  if (entry.senderId === 'keeper') return { name: entry.senderName, url: state.keeperPortrait || '', color: entry.color || '#fbbf24' };
  const token = speakerToken(state, entry.senderId, entry.senderTokenId);
  return { name: entry.senderName, url: entry.senderPortrait || (token ? actorPortrait(token) : ''), color: entry.color || token?.color };
}

export function speakerBadge({ name, url }) {
  const face = document.createElement('span');
  face.className = 'speech-portrait'; face.setAttribute('aria-hidden', 'true');
  const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase();
  face.textContent = initials;
  if (isPortraitReference(url) || isInlinePortrait(url)) {
    const img = document.createElement('img');
    img.alt = ''; img.onerror = () => { face.textContent = initials; };
    img.src = url; face.replaceChildren(img);
  }
  return face;
}

// Measure the original text column before taking up space with a portrait.
export class LongMessagePortraits {
  constructor(root) {
    this.root = root;
    this.rows = [];
    this.onResize = () => this.measure();
    const view = root.ownerDocument.defaultView;
    if (view.ResizeObserver) {
      this.observer = new view.ResizeObserver(([entry]) => {
        const width = entry.contentRect.width;
        if (width !== this.width) { this.width = width; this.measure(); }
      });
      this.observer.observe(root);
    } else view.addEventListener('resize', this.onResize);
    root.ownerDocument.fonts?.ready.then(() => this.measure());
    root.ownerDocument.fonts?.addEventListener('loadingdone', this.onResize);
  }
  set(rows) {
    for (const row of this.rows) { row.badge?.remove(); row.box.classList.remove('has-speech-portrait'); }
    this.rows = rows;
    this.measure();
  }
  measure() {
    if (!this.rows.length) return;
    for (const row of this.rows) row.box.classList.remove('has-speech-portrait');
    const view = this.root.ownerDocument.defaultView;
    const long = this.rows.map(({ body }) => {
      if (body.textContent.split(/\r\n|\r|\n/).length > 2) return true;
      const height = body.offsetHeight || body.getBoundingClientRect().height, style = view.getComputedStyle(body);
      const line = parseFloat(style.lineHeight);
      return Number.isFinite(line) && line > 0 && height > line * 2 + 1;
    });
    this.rows.forEach((row, i) => {
      if (!long[i]) { row.badge?.remove(); row.badge = null; return; }
      if (!row.badge) { row.badge = speakerBadge(row.appearance); row.box.prepend(row.badge); }
      row.box.classList.add('has-speech-portrait');
    });
  }
  destroy() {
    this.set([]);
    this.observer?.disconnect();
    this.root.ownerDocument.defaultView.removeEventListener('resize', this.onResize);
    this.root.ownerDocument.fonts?.removeEventListener('loadingdone', this.onResize);
  }
}
