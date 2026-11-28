// How tokens move on the map (split out of canvasEngine.js in v2.65.0): dragging, the slide
// to a confirmed place, nudging with the arrow keys and the distance shown while moving.
import { store } from '../state.js';
import { network } from '../networkManager.js';
import { audio } from '../audioEngine.js';
import { notify } from '../ui.js';
import { approachBlock, movementBlock } from '../combatState.js';
import { DEFAULT_METERS_PER_SQUARE } from '../attackFlow.js';
import { grantActorSpotlight } from '../gameActions.js';

export const tokenMotionMethods = {
  beginTokenDrag(token, facing = false) {
    this.lastMoveDistance = null;
    this.tokenDragContext = { distance: 0, campaignId: store.state.campaignId, mapId: token.mapId, tool: store.state.activeTool, role: store.state.userRole, x: token.x, y: token.y, facingAngle: token.facingAngle };
    // Gesture state is a visual preview, never the authoritative token object.
    if (facing) this.draggedTokenFacing = { ...token };
    else { this.draggedToken = { ...token }; this.draggedTokenOrigX = token.x; this.draggedTokenOrigY = token.y; }
  },

  cancelTokenDrag() {
    if (this.draggedToken || this.draggedTokenFacing) this.preDragSnapshot = null;
    this.draggedToken = null; this.draggedTokenFacing = null;
    this.draggedTokenOrigX = null; this.draggedTokenOrigY = null; this.tokenDragContext = null;
  },

  reconcileTokenDrag() {
    const drag = this.draggedToken || this.draggedTokenFacing, origin = this.tokenDragContext;
    if (!drag || !origin) return;
    const token = store.state.tokens.find(t => t.id === drag.id), state = store.state;
    if (!token || !store.canEditToken(drag.id) || token.mapId !== origin.mapId || state.activeMapId !== origin.mapId || state.campaignId !== origin.campaignId || state.activeTool !== origin.tool || state.userRole !== origin.role || token.x !== origin.x || token.y !== origin.y || (this.draggedTokenFacing && token.facingAngle !== origin.facingAngle)) this.cancelTokenDrag();
  },

  displayTokens() {
    this.reconcileTokenDrag();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return store.getTokensForActiveMap().map(token => {
      if (this.draggedToken?.id === token.id) { this.noteTokenAt(token.id, this.draggedToken.x, this.draggedToken.y, token.mapId); return { ...token, x: this.draggedToken.x, y: this.draggedToken.y }; }
      const shown = this.glideToken(token, now);
      if (this.draggedTokenFacing?.id === token.id) return { ...shown, facingAngle: this.draggedTokenFacing.facingAngle };
      return shown;
    });
  },

  // A token that changes place without being dragged here (another player's move, a move the
  // Keeper confirms, an undo) slides from where it was drawn to its new place instead of jumping.
  noteTokenAt(id, x, y, mapId) {
    this.tokenGlides ??= new Map();
    this.tokenGlides.set(id, { x, y, toX: x, toY: y, fromX: x, fromY: y, start: 0, dur: 0, mapId });
  },

  glideToken(token, now) {
    this.tokenGlides ??= new Map();
    const g = this.tokenGlides.get(token.id);
    if (!g || g.mapId !== token.mapId) { this.noteTokenAt(token.id, token.x, token.y, token.mapId); return token; }
    if (g.toX !== token.x || g.toY !== token.y) {
      const grid = store.getActiveMap?.()?.gridSize || 64;
      const dist = Math.hypot(token.x - g.x, token.y - g.y);
      // Far jumps (a new scene, a teleport across the map) are not animated.
      if (dist > grid * 40 || !Number.isFinite(dist)) { this.noteTokenAt(token.id, token.x, token.y, token.mapId); return token; }
      Object.assign(g, { fromX: g.x, fromY: g.y, toX: token.x, toY: token.y, start: now, dur: Math.max(220, Math.min(900, (dist / grid) * 110)) });
    }
    if (!g.dur) return token;
    const t = Math.min(1, (now - g.start) / g.dur), ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    g.x = g.fromX + (g.toX - g.fromX) * ease; g.y = g.fromY + (g.toY - g.fromY) * ease;
    if (t >= 1) { g.x = g.toX; g.y = g.toY; g.dur = 0; return token; }
    return { ...token, x: g.x, y: g.y };
  },

  // One square in a direction for the selected token: walls, doors and windows stop a player as
  // when dragging; the move is the player's active action (Spotlight) and reaches the table.
  nudgeSelectedToken(dx, dy) {
    const state = store.getState(), map = store.getActiveMap();
    const tok = state.tokens.find(t => t.id === state.selectedTokenId);
    if (!tok || !map || tok.mapId !== state.activeMapId || this.draggedToken) return false;
    if (!['select', 'measure'].includes(state.activeTool || 'select')) return false;
    if (state.userRole !== 'keeper' && !store.canEditToken(tok.id)) return false;
    if (state.rest && state.userRole !== 'keeper') { notify('La partida está en pausa: el grupo está descansando.', 'error'); return true; }
    // Restrained, Stunned, Incapacitated…: a player cannot move the character (the Keeper can).
    const blocked = state.userRole !== 'keeper' && movementBlock(tok);
    if (blocked) { audio.playError?.(); notify(blocked, 'error'); return true; }
    const g = map.gridSize || 64, W = this.mapImage?.width || Infinity, H = this.mapImage?.height || Infinity;
    const x = Math.max(0, Math.min(W, tok.x + dx * g)), y = Math.max(0, Math.min(H, tok.y + dy * g));
    if (x === tok.x && y === tok.y) return true;
    const afraid = state.userRole !== 'keeper' && approachBlock(tok, x, y, state.tokens);
    if (afraid) { audio.playError?.(); notify(afraid, 'error'); return true; }
    if (state.userRole !== 'keeper') {
      const wall = (map.walls || []).find(w => {
        const type = w.wallType || (w.isDoor ? 'door' : (w.isWindow ? 'window' : 'wall'));
        return (type === 'wall' || type === 'window' || (type === 'door' && !w.isOpen)) && this.checkLineIntersection(tok.x, tok.y, x, y, w.x1, w.y1, w.x2, w.y2);
      });
      if (wall) {
        const type = wall.wallType || (wall.isDoor ? 'door' : (wall.isWindow ? 'window' : 'wall'));
        audio.playError();
        notify(type === 'window' ? 'No puedes atravesar ventanas de cristal reforzado.' : type === 'door' ? 'La compuerta está cerrada.' : 'No puedes atravesar muros opacos.', 'error');
        return true;
      }
    }
    const stepDistance = Math.hypot(x - tok.x, y - tok.y);
    if (store.updateToken(tok.id, { x, y }) === false) return true;
    const previous = this.lastMoveDistance;
    const continued = previous?.tokenId === tok.id && previous.mapId === map.id && previous.keyboard && previous.expires > performance.now();
    this.showMoveDistance(tok.id, map.id, (continued ? previous.distance : 0) + stepDistance, true);
    if (store.sessionRole !== 'player' && state.userRole === 'player') grantActorSpotlight(store, tok.id);
    if (store.sessionRole !== 'player') network.broadcast({ type: 'TOKEN_MOVE', tokenId: tok.id, x, y });
    return true;
  },

  showMoveDistance(tokenId, mapId, distance, keyboard = false) {
    this.lastMoveDistance = { tokenId, mapId, distance, keyboard, expires: performance.now() + 1500 };
  },

  renderMovementPreview(ctx, map) {
    if (!this.draggedToken || !this.tokenDragContext?.distance) return;
    const origin = this.tokenDragContext;
    const token = this.draggedToken;
    const grid = map.gridSize || 64;
    this.renderGhostToken(ctx, { ...token, x: origin.x, y: origin.y, avatar: token.avatarUrl }, grid, 0, '');
    this.renderRuler(ctx, origin, token, grid, true);
  },

  renderMoveDistance(ctx, map, tokens) {
    const drag = this.draggedToken;
    const saved = this.lastMoveDistance;
    const active = drag ? this.tokenDragContext : saved;
    if (!active || active.mapId !== map.id || !active.distance || (!drag && active.expires <= performance.now())) return;
    const token = drag || tokens.find(t => t.id === saved.tokenId);
    if (!token) return;
    const grid = map.gridSize || 64;
    const meters = active.distance / grid * (map.gridScaleMeters || DEFAULT_METERS_PER_SQUARE);
    const label = meters.toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' m';
    const point = this.worldToScreen(token.x, token.y);
    ctx.save();
    ctx.font = 'bold 14px system-ui';
    const width = Math.ceil(ctx.measureText(label).width) + 16;
    const x = Math.max(0, Math.min(this.displayWidth - width, point.x - width / 2));
    const y = Math.max(0, Math.min(this.displayHeight - 24, point.y + (token.size || 1) * grid * this.zoom / 2 + 8));
    ctx.fillStyle = '#091625';
    ctx.fillRect(x, y, width, 24);
    ctx.fillStyle = '#a5f3fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + 12);
    ctx.restore();
  },
};
