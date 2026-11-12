import { newId } from './persistence.js';
import { TRAIT_IDS } from './characterImport.js';
import { validateActor } from './validation.js';

export const TOKEN_COLOR_PALETTE = [
  '#00f3ff', // Cyan Neon (Default Veilfarer)
  '#10b981', // Emerald Tech
  '#f59e0b', // Amber Hazard
  '#ef4444', // Crimson Combat
  '#8b5cf6', // Violet Void
  '#38bdf8', // Sky Blue
  '#ec4899', // Rose Cyber
  '#f97316', // Blaze Orange
];

export function createActor(data = {}, mapId) {
  const isPlayer = data.actorType ? data.actorType === 'player' : data.isPlayer !== false;
  const defaultColor = data.color || TOKEN_COLOR_PALETTE[Math.floor(Math.random() * TOKEN_COLOR_PALETTE.length)];
  const actor = {
    name: 'Nuevo actor', roleTag: '', avatarUrl: '/assets/tokens/captain_harker.jpg',
    x: 600, y: 400, size: 1, hidden: false, isPlayer, actorType: isPlayer ? 'player' : 'adversary',
    color: defaultColor,
    path: isPlayer ? 'Awakened' : '', level: 1, proficiency: 1, evasion: 10,
    hp: { current: 6, max: 6, majorThreshold: 5, severeThreshold: 10 },
    armor: { current: 0, max: 0 }, stress: { current: 0, max: 6 },
    hope: 0, effort: 0, effortTrack: [false, false],
    resolve: { current: 0, max: 2, dieType: 'd4' }, honedEdgeBonus: 0, recoveryAnchor: '',
    traits: Object.fromEntries(TRAIT_IDS.map(k => [k, 0])), subtraits: {}, conditions: [],
    visionRadius: 10, visionAngle: 90, hasLight: true, lightRadius: 250, lightColor: '#00f3ff', lightEffect: 'steady',
    ...structuredClone(data), id: `tok_${newId()}`, mapId,
  };
  validateActor(actor);
  return actor;
}

// Only sheet data changes on reimport. The existing token keeps its tactical presentation.
export function replaceActorSheet(existing, imported) {
  const tactical = ['id', 'mapId', 'x', 'y', 'size', 'color', 'rotation', 'ownerId', 'controllerIds', 'scenePositions', 'hidden', 'hideName', 'avatarUrl', 'displayConfig', 'displayOverlays', 'conditions', 'visionRadius', 'visionMode', 'visionRange', 'visionAngle', 'hasLight', 'lightRadius', 'lightColor', 'lightEffect', 'hasVibrationVision', 'vibrationRadius', 'isFlying', 'inReserve', 'lastMapId'];
  const next = { ...existing, ...imported };
  for (const key of tactical) {
    if (key in existing) next[key] = structuredClone(existing[key]);
    else delete next[key];
  }
  validateActor(next);
  return next;
}
