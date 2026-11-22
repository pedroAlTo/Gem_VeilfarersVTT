import { normalizeAncestryId } from './tokenAvatars.js';
import { controlsToken } from './tokenPermissions.js';

const character = t => !!t && !t.hidden && !t.inReserve && (t.actorType ? t.actorType === 'player' : t.isPlayer === true);
export function monochromeViewer(state, tokens, sessionRole, memberId) {
  if (state.userRole !== 'player' && sessionRole !== 'player') return null;
  const available = t => character(t) && t.mapId === state.activeMapId &&
    (sessionRole !== 'player' || controlsToken(t, memberId));
  const selected = tokens.find(t => t.id === state.selectedTokenId && available(t));
  const claimed = selected || tokens.find(t => t.id === state.claimedTokenId && available(t));
  const viewer = claimed || (sessionRole === 'player' && tokens.find(available));
  if (!viewer) return null;
  const fields = viewer.sourceCharacter?.document?.fields;
  const ancestry = viewer.species || viewer.ancestry || fields?.ancestry || viewer.sheetFields?.ancestry;
  return viewer.isAilurean || viewer.visionMode === 'chromatic' || normalizeAncestryId(ancestry || viewer.roleTag) === 'ailuran' ? viewer : null;
}

export const keepsTokenColor = (t, viewer, memberId) => character(t) && t.id !== viewer.id &&
  !controlsToken(t, memberId) && !controlsToken(t, viewer.ownerId);

// Replace hue and saturation while retaining scene luminance. Pure black fog stays black.
const tone = '#798491';
function toneOpaque(ctx) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'color';
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// World, tokens and weather keep their normal draw order. Batch adjacent monochrome
// foreground draws, so dense rain and particles need just one filtered composite.
export class MonochromeLayers {
  constructor() { this.pending = false; }
  begin(output) {
    this.output = output;
    this.pending = false;
    toneOpaque(output);
  }
  grey() {
    if (this.pending) return this.buffer;
    const source = this.output.canvas;
    this.buffer ||= source.ownerDocument.createElement('canvas').getContext('2d');
    const ctx = this.buffer, canvas = ctx.canvas;
    if (canvas.width !== source.width) canvas.width = source.width;
    if (canvas.height !== source.height) canvas.height = source.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(this.output.getTransform());
    this.pending = true;
    return ctx;
  }
  color() {
    this.flush();
    return this.output;
  }
  flush() {
    if (!this.pending) return;
    this.pending = false;
    const out = this.output, buffer = this.buffer.canvas;
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    if ('filter' in out) {
      out.filter = 'grayscale(1) sepia(0.18) hue-rotate(165deg) saturate(0.8)';
    } else {
      // Canvas contexts without CSS filters still support blend modes. Keep the
      // alpha of fog, sprites and weather when replacing the foreground's hue.
      this.mask ||= buffer.ownerDocument.createElement('canvas').getContext('2d');
      const mask = this.mask;
      if (mask.canvas.width !== buffer.width) mask.canvas.width = buffer.width;
      if (mask.canvas.height !== buffer.height) mask.canvas.height = buffer.height;
      mask.globalCompositeOperation = 'copy';
      mask.drawImage(buffer, 0, 0);
      toneOpaque(this.buffer);
      this.buffer.save();
      this.buffer.setTransform(1, 0, 0, 1, 0, 0);
      this.buffer.globalCompositeOperation = 'destination-in';
      this.buffer.drawImage(mask.canvas, 0, 0);
      this.buffer.restore();
    }
    out.drawImage(buffer, 0, 0);
    out.restore();
  }
}
