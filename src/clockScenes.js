// Clocks belong to scenes (v2.62.3, user request: «los relojes deberían ir asociados a cada mapa, no
// solo en el módulo sino en general para todos los arcos y pantallas»). A clock lists the scenes
// where it is shown (`mapIds`); with no list (older clocks, or «Todas las escenas») it is shown on
// every scene. A new clock belongs to the active scene.
import { store } from './state.js';
import { network } from './networkManager.js';
import { escapeHTML as e } from './ui.js';

export const clockOnScene = (clock, mapId) => !Array.isArray(clock?.mapIds) || clock.mapIds.length === 0 || clock.mapIds.includes(mapId);

export function clockScenesLabel(clock, maps = store.state.maps || []) {
  if (!Array.isArray(clock?.mapIds) || !clock.mapIds.length) return 'Todas las escenas';
  const names = clock.mapIds.map(id => maps.find(m => m.id === id)?.name).filter(Boolean);
  return names.length === 1 ? names[0] : `${names.length} escenas`;
}

// The scopes offered when a clock is created: this scene, its arc, or every scene.
export function scopeMapIds(scope, state = store.state) {
  if (scope === 'all') return null;
  if (scope === 'arc') return (state.arcs || []).find(a => a.sceneIds?.includes(state.activeMapId))?.sceneIds?.slice() || [state.activeMapId];
  return [state.activeMapId];
}

// Chooses the scenes of a clock, grouped by arc (Keeper).
export async function openClockScenes(clockId) {
  const clock = store.state.clocks.find(c => c.id === clockId);
  if (!clock || store.state.userRole !== 'keeper' || store.sessionRole === 'player') return null;
  const { dossierDialog } = await import('./dossierDialog.js');
  const maps = store.state.maps || [], arcs = store.state.arcs || [];
  const inArc = new Set(arcs.flatMap(a => a.sceneIds || []));
  const groups = [...arcs.map(a => [a.name, (a.sceneIds || []).map(id => maps.find(m => m.id === id)).filter(Boolean)]), ['Sin arco', maps.filter(m => !inArc.has(m.id))]].filter(([, list]) => list.length);
  const all = !Array.isArray(clock.mapIds) || !clock.mapIds.length;
  const chosen = new Set(all ? [] : clock.mapIds);
  const modal = dossierDialog(`Escenas del reloj · ${clock.title}`, `
    <p class="dossier-muted">El reloj aparece solo en las escenas marcadas (para el Keeper y, si es visible, para los jugadores).</p>
    <label class="checkbox-label clock-scenes-all"><input type="checkbox" data-all ${all ? 'checked' : ''}> Todas las escenas</label>
    <div class="clock-scenes-list" ${all ? 'hidden' : ''}>${groups.map(([arc, list]) => `<fieldset><legend>${e(arc)}</legend>${list.map(m => `<label class="checkbox-label"><input type="checkbox" data-map="${e(m.id)}" ${chosen.has(m.id) ? 'checked' : ''}> ${e(m.name)}${m.id === store.state.activeMapId ? ' <small>(activa)</small>' : ''}</label>`).join('')}</fieldset>`).join('')}</div>
    <p class="dossier-error" role="alert"></p>
    <div class="look-actions"><button type="button" class="hud-btn hud-btn-primary" data-save>Guardar</button></div>`, 'clock-scenes-dialog');
  const allBox = modal.querySelector('[data-all]'), list = modal.querySelector('.clock-scenes-list');
  allBox.onchange = () => { list.hidden = allBox.checked; };
  modal.querySelector('[data-save]').onclick = () => {
    const mapIds = allBox.checked ? null : [...modal.querySelectorAll('[data-map]:checked')].map(b => b.dataset.map);
    if (mapIds && !mapIds.length) { modal.querySelector('[role=alert]').textContent = 'Marca al menos una escena o «Todas las escenas».'; return; }
    store.updateClock(clockId, { mapIds });
    network.broadcast?.({ type: 'CLOCK_UPDATE', clockId, partial: { mapIds } });
    modal.querySelector('.modal-close-btn').click();
  };
  return modal;
}
