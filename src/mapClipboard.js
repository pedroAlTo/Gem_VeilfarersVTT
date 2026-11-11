import { newId } from './persistence.js';
import { validateCampaign } from './validation.js';

const collections = { wall: 'walls', light: 'lights', water: 'waterZones', effect: 'effects', drawing: 'drawings' };
const fields = { token: 'selectedTokenId', wall: 'selectedWallId', light: 'selectedLightId', water: 'selectedWaterId', effect: 'selectedEffectId', drawing: 'selectedDrawingId' };
export function offsetElement(data, dx, dy) {
  const copy = structuredClone(data); copy.id = newId();
  for (const [x, y] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) if (Number.isFinite(copy[x]) && Number.isFinite(copy[y])) { copy[x] += dx; copy[y] += dy; }
  if (copy.points) copy.points = copy.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
  return copy;
}
export class MapClipboard {
  constructor(stateStore, networkManager, engine, report) { Object.assign(this, { store: stateStore, network: networkManager, engine, report }); }
  copy() {
    const s = this.store.state, map = this.store.getActiveMap(); let kind, source;
    for (const [candidate, field] of Object.entries(fields)) {
      const list = candidate === 'token' ? s.tokens.filter(t => t.mapId === s.activeMapId) : map[collections[candidate]] || [];
      const entry = list.find(x => x.id === s[field]); if (entry) { kind = candidate; source = entry; break; }
    }
    if (!source && this.engine.activeTemplate) { kind = 'template'; source = this.engine.activeTemplate; }
    if (!source) return false;
    if (this.store.sessionRole === 'player' && (kind !== 'drawing' || source.authorId !== this.store.memberId)) {
      this.report('Solo puedes copiar tus dibujos. El Keeper puede duplicar los elementos de la escena.', 'error'); return true;
    }
    this.content = { kind, data: structuredClone(source), campaignId: s.campaignId, role: this.store.sessionRole }; this.count = 0;
    this.report('Elemento copiado. Ctrl+V para pegar.'); return true;
  }
  async paste() {
    const saved = this.content, s = this.store.state;
    if (!saved) return false;
    if (saved.campaignId !== s.campaignId || saved.role !== this.store.sessionRole) { this.content = null; return false; }
    const layer = { token: 'tokens', wall: 'walls_lights', light: 'walls_lights', water: 'water', effect: 'overlay', drawing: 'overlay', template: 'overlay' }[saved.kind];
    if (this.store.sessionBusy || (s.persistentRoomId && s.roomPaused) || (this.store.sessionRole === 'player' && !s.isConnected) || s.layerLocked[layer] || s.layerVisibility[layer] === false) throw new Error('No se puede pegar mientras la sala esté en pausa o la capa esté bloqueada.');
    if (this.store.sessionRole === 'player' && saved.kind !== 'drawing') throw new Error('Solo el Keeper puede duplicar elementos de la escena.');
    const offset = (this.store.getActiveMap().gridSize || 64) * (++this.count), copy = offsetElement(saved.data, offset, offset);
    if (saved.kind === 'drawing') {
      const result = await this.network.editDrawing('add', { mapId: s.activeMapId, drawing: copy }); this.store.update({ selectedDrawingId: result.id });
    } else if (saved.kind === 'template') {
      this.store._beforeTacticalMutation('Pegar plantilla'); this.engine.templates.push(copy); this.engine.activeTemplate = copy;
    } else if (saved.kind === 'token') {
      Object.assign(copy, { mapId: s.activeMapId, ownerId: '', controllerIds: [], inReserve: false, scenePositions: {}, name: copy.name + ' (copia)' });
      const tokens = [...s.tokens, copy]; validateCampaign({ ...this.store.serializeCampaign(), tokens });
      this.store._beforeTacticalMutation('Pegar token'); this.store.update({ tokens, selectedTokenId: copy.id });
    } else {
      const key = collections[saved.kind], map = this.store.getActiveMap();
      const maps = s.maps.map(m => m.id === map.id ? { ...m, [key]: [...(m[key] || []), copy] } : m);
      validateCampaign({ ...this.store.serializeCampaign(), maps });
      this.store._beforeTacticalMutation('Pegar elemento'); this.store.update({ maps, [fields[saved.kind]]: copy.id });
    }
    return true;
  }
  keydown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || !['c', 'v'].includes(event.key.toLowerCase())) return false;
    if (event.target.closest?.('input,textarea,select,[contenteditable],.veil-modal-backdrop') || window.getSelection()?.toString()) return false;
    if (event.key.toLowerCase() === 'c') { if (!this.copy()) return false; }
    else { if (!this.content) return false; this.paste().catch(error => this.report(error.message, 'error')); }
    event.preventDefault(); return true;
  }
}
