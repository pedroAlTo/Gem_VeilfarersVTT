import { newId } from './persistence.js';
import { TRAIT_IDS, characterKey } from './characterImport.js';
import { validateActor } from './validation.js';
import { actorPortrait, customTokenPortrait } from './tokenAvatars.js';

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
    name: 'Nuevo actor', roleTag: '',
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
  actor.avatarUrl = actorPortrait(actor);
  validateActor(actor);
  return actor;
}

// Reimport keeps the existing placement and controls while replacing the character sheet.
export function replaceActorSheet(existing, imported) {
  const tactical = ['id', 'mapId', 'x', 'y', 'size', 'color', 'rotation', 'ownerId', 'controllerIds', 'scenePositions', 'hidden', 'hideName', 'displayConfig', 'displayOverlays', 'vitalsLayout', 'frame', 'conditions', 'visionRadius', 'visionMode', 'visionRange', 'visionMeters', 'visionAngle', 'hasLight', 'lightRadius', 'lightMeters', 'vibrationMeters', 'lightColor', 'lightEffect', 'hasVibrationVision', 'vibrationRadius', 'isFlying', 'inReserve', 'lastMapId'];
  const next = { ...existing, ...imported };
  for (const key of tactical) {
    if (key in existing) next[key] = structuredClone(existing[key]);
    else delete next[key];
  }
  // A replacement sheet brings its portrait. Keep the player's custom image on reimport.
  next.tokenArchetype = imported.tokenArchetype || imported.sourceCharacter?.document?.fields?.token_archetype || '';
  const sameCharacter = characterKey(existing) === characterKey(imported);
  if (!sameCharacter) {
    for (const key of ['species', 'characterClass', 'roleTag', 'pronouns', 'pron', 'pronombres', 'gender', 'sex', 'sexo', 'genero', 'género', 'character_gender', 'sourceCharacter']) {
      if (!(key in imported)) delete next[key];
    }
  }
  let chosen = imported;
  if (!customTokenPortrait(imported) && sameCharacter && customTokenPortrait(existing)) chosen = existing;
  next.portraitOverride = chosen.portraitOverride === true;
  next.avatarUrl = actorPortrait({ ...next, avatarUrl: chosen.avatarUrl });
  validateActor(next);
  return next;
}
