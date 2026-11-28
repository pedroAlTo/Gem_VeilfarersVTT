import { frameById } from './tokenFrames.js';
import { validLayout } from './tokenLayout.js';
import { isEncounterMarker } from './bestiaryProfiles.js';
import { validRest } from './rest.js';
import { validateDroneState } from './drones.js';
import { validEffectClocks } from './effectClocks.js';
import { validateDrawing } from './freehand.js';
import { validateEnvironment, validateBoss } from './encounterRules.js';
import { validateInventory } from './equipment.js';
import { validateChatHistory } from './chat.js';
import { isPlayerPortrait, isPortraitSource } from './portraitCatalog.js';

import { validEncounter } from './naval/encounter.js';

export const CAMPAIGN_KEYS = [
  'campaignId',
  'campaignName',
  'fear',
  'activeMapId',
  'maps',
  'arcs',
  'tokens',
  'clocks',
  'handouts',
  'starship',
  'fogOfWar',
  'fogExploredOpacity',
  'optionalEfforts',
  'logs',
  'players',
  'chatMessages',
  'keeperPortrait',
  'rest',
];
export const finite = (x, min = -1e6, max = 1e6) =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const resource = (r, label) =>
  assert(r && finite(r.max, 0, 10000) && finite(r.current, 0, r.max), `Invalid ${label}.`);

// Validate complete imports and network snapshots before mutating live state.
export function validateCampaign(data) {
  if (data.players !== undefined) {
    assert(Array.isArray(data.players) && data.players.length <= 100 && data.players.every(p => p && typeof p.id === 'string' && p.id.length <= 200 && typeof p.name === 'string' && p.name.length <= 80), 'Invalid player roster.');
    assert(new Set(data.players.map(p => p.id)).size === data.players.length, 'Duplicate player.');
  }
  assert(
    data &&
      typeof data === 'object' &&
      Array.isArray(data.maps) &&
      data.maps.length > 0 &&
      data.maps.length <= 100,
    'A campaign needs 1–100 maps.'
  );
  for (const key of ['tokens', 'clocks', 'handouts'])
    assert(Array.isArray(data[key]) && data[key].length <= 2000, `Invalid ${key} collection.`);
  for (const key of ['maps', 'tokens', 'clocks', 'handouts']) {
    const ids = new Set();
    for (const x of data[key]) {
      assert(
        x && typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 200 && !ids.has(x.id),
        `Invalid or repeated ${key} id.`
      );
      ids.add(x.id);
    }
  }
  assert(
    typeof data.campaignName === 'string' && data.campaignName.length <= 500,
    'Invalid campaign name.'
  );
  if (data.arcs !== undefined) {
    assert(Array.isArray(data.arcs) && data.arcs.length <= 100, 'Invalid arcs.');
    const assigned = new Set(), ids = new Set();
    for (const arc of data.arcs) {
      assert(arc && typeof arc.id === 'string' && arc.id.length <= 200 && !ids.has(arc.id) && typeof arc.name === 'string' && arc.name.length <= 500, 'Invalid arc.'); ids.add(arc.id);
      assert(Array.isArray(arc.sceneIds) && arc.sceneIds.length <= 100, 'Invalid arc scenes.');
      for (const id of arc.sceneIds) { assert(data.maps.some(m => m.id === id) && !assigned.has(id), 'Scene belongs to an invalid or duplicated arc.'); assigned.add(id); }
    }
  }
  for (const m of data.maps) {
    if (m.spotlightRound !== undefined) assert(Number.isSafeInteger(m.spotlightRound) && m.spotlightRound >= 1, 'Invalid Spotlight round.');
    if (m.lastSpotlightId !== undefined) assert(typeof m.lastSpotlightId === 'string' && m.lastSpotlightId.length <= 200, 'Invalid Spotlight holder.');
    validateEnvironment(m.environment);
    if (m.drawings !== undefined) {
      assert(Array.isArray(m.drawings) && m.drawings.length <= 500, 'Invalid drawings.');
      m.drawings.forEach(validateDrawing);
      assert(new Set(m.drawings.map(d => d.id)).size === m.drawings.length, 'Duplicate drawing.');
    }
    assert(
      typeof m.name === 'string' && typeof m.imageUrl === 'string' && finite(m.gridSize, 1, 1000),
      'Invalid map name, image or grid.'
    );
    // The explored veil of this scene (v2.64.0), set by the Keeper for everyone.
    if (m.naval != null) assert(validEncounter(m.naval), 'Invalid naval encounter.');
    if (m.fogExploredOpacity != null) assert(finite(m.fogExploredOpacity, 0.05, 0.95), 'Invalid explored fog opacity.');
    for (const k of ['walls', 'lights', 'effects', 'waterZones', 'switches']) {
      assert(
        m[k] === undefined ||
          (Array.isArray(m[k]) &&
            m[k].length <= 10000 &&
            m[k].every((x) => x && typeof x === 'object')),
        `Invalid map ${k}.`
      );
    }
    for (const w of m.walls || [])
      assert(
        ['x1', 'y1', 'x2', 'y2'].every((k) => finite(w[k])),
        'Invalid wall coordinates.'
      );
    for (const l of m.lights || [])
      assert(finite(l.x) && finite(l.y) && finite(l.radius, 0, 100000), 'Invalid light.');
    for (const sw of m.switches || [])
      assert(typeof sw.id === 'string' && sw.id.length <= 200 && finite(sw.x) && finite(sw.y) && Array.isArray(sw.lightIds) && sw.lightIds.length <= 500 && sw.lightIds.every(id => typeof id === 'string'), 'Invalid light switch.');
  }
  for (const t of data.tokens) {
    validateActor(t);
    if (t.blazeChoice != null) assert(typeof t.blazeChoice === 'string' && t.blazeChoice.length <= 60, 'Invalid Death Move.');
    if (t.lifeProgress !== undefined) assert(Number.isInteger(t.lifeProgress) && finite(t.lifeProgress, 0, 1), 'Invalid life progress.');
    if (t.vitalsLayout != null) assert(validLayout(t.vitalsLayout), 'Invalid map layout.');
    if (t.frame != null) assert(t.frame === '' || !!frameById(t.frame), 'Invalid token frame.');
    if (t.frightenedBy != null) assert(typeof t.frightenedBy === 'string' && t.frightenedBy.length <= 200, 'Invalid fear source.');
    for (const stamp of [t.roundSpotlight, t.lifeRollRound, t.ftlRound]) if (stamp != null) assert(typeof stamp === 'string' && stamp.length <= 220, 'Invalid Spotlight round.');
    assert(t.mapId === 'reserve' || t.inReserve || data.maps.some(m => m.id === t.mapId), 'Token refers to an unknown map.');
  }
  for (const c of data.clocks)
    assert(
      typeof c.title === 'string' &&
        Number.isInteger(c.segments) &&
        finite(c.segments, 1, 32) &&
        Number.isInteger(c.filled) &&
        finite(c.filled, 0, c.segments) &&
        (c.mapIds == null || (Array.isArray(c.mapIds) && c.mapIds.length <= 100 && c.mapIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200))),
      'Invalid clock.'
    );
  for (const h of data.handouts)
    assert(typeof h.title === 'string' && typeof h.contentHtml === 'string' && (h.keeperHtml == null || (typeof h.keeperHtml === 'string' && h.keeperHtml.length <= 500000)), 'Invalid dossier.');
  assert(finite(data.fear, 0, 12) && Number.isInteger(data.fear), 'Fear must be between 0 and 12.');
  if (data.starship) {
    const s = data.starship;
    assert(
      typeof s.name === 'string' &&
        finite(s.maxHull, 1, 10000) &&
        finite(s.hull, 0, s.maxHull) &&
        finite(s.heat, 0, 10000) &&
        finite(s.heatCap, 1, 10000) &&
        finite(s.pearls, 0, 10000),
      'Invalid starship data.'
    );
    assert(
      s.shieldArcs &&
        ['fore', 'aft', 'port', 'starboard', 'maxPerArc'].every((k) =>
          finite(s.shieldArcs[k], 0, 10000)
        ),
      'Invalid shield arcs.'
    );
    if (s.jump != null) assert(['ready', 'transit'].includes(s.jump.phase) && typeof s.jump.id === 'string' && s.jump.id.length <= 200 &&
      typeof s.jump.destination === 'string' && s.jump.destination.length > 0 && s.jump.destination.length <= 120 &&
      typeof s.jump.mapId === 'string' && s.jump.mapId.length <= 200, 'Invalid FTL solution.');
    if (s.systems)
      assert(
        Object.values(s.systems).every((n) => Number.isInteger(n) && finite(n, 0, 3)),
        'Invalid system Integrity.'
      );
  } else throw new Error('Missing starship data.');
  if (data.rest !== undefined) assert(validRest(data.rest), 'Invalid rest.');
  if (data.logs !== undefined) assert(Array.isArray(data.logs) && data.logs.length <= 150 && data.logs.every(x => x && typeof x === 'object'), 'Invalid session log.');
  const keeperPortrait = data.keeperPortrait ?? '';
  assert(keeperPortrait === '' || isPortraitSource(keeperPortrait), 'Invalid Keeper portrait.');
  return structuredClone({ ...data, keeperPortrait, chatMessages: validateChatHistory(data.chatMessages) });
}

// What a player may change on a token they control (the table checks every field).
export const PLAYER_TOKEN_FIELDS = ['x', 'y', 'rotation', 'facingAngle', 'hp', 'armor', 'stress', 'hope', 'effort', 'effortTrack', 'resolve', 'conditions', 'inventory', 'hasSpotlight', 'effectClocks', 'avatarUrl', 'portraitOverride', 'color', 'vitalsLayout', 'frame'];
export const pickPlayerFields = patch => Object.fromEntries(Object.entries(patch || {}).filter(([k]) => PLAYER_TOKEN_FIELDS.includes(k)));

export function validTokenPatch(p) {
  if (!p || typeof p !== 'object') return false;
  if (
    Object.keys(p).some(
      (k) =>
        ![
          'x',
          'y',
          'rotation',
          'facingAngle',
          'hp',
          'armor',
          'stress',
          'hope',
          'effort',
          'effortTrack',
          'resolve',
          'conditions',
          'inventory',
          'hasSpotlight',
          'effectClocks',
          'avatarUrl',
          'portraitOverride',
          'color',
          'vitalsLayout',
          'frame',
        ].includes(k)
    )
  )
    return false;
  if ('avatarUrl' in p || 'portraitOverride' in p) {
    if (!(p.portraitOverride === true && isPlayerPortrait(p.avatarUrl)) && !(p.portraitOverride === false && p.avatarUrl === '')) return false;
  }
  for (const k of ['x', 'y', 'rotation', 'facingAngle']) if (k in p && !finite(p[k])) return false;
  if ('vitalsLayout' in p && !validLayout(p.vitalsLayout)) return false;
  if ('frame' in p && !(p.frame === '' || frameById(p.frame))) return false;
  // The token's own colour (border, name, chat, subtitles): a plain hex colour (v2.29.2).
  if ('color' in p && !(typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color))) return false;
  for (const k of ['hope', 'effort']) if (k in p && !finite(p[k], 0, 6)) return false;
  if ('hasSpotlight' in p && typeof p.hasSpotlight !== 'boolean') return false;
  for (const k of ['hp', 'armor', 'stress', 'resolve'])
    if (k in p && (!p[k] || !finite(p[k].max, 0, 10000) || !finite(p[k].current, 0, p[k].max)))
      return false;
  if (
    'conditions' in p &&
    (!Array.isArray(p.conditions) ||
      p.conditions.length > 30 ||
      p.conditions.some((x) => typeof x !== 'string' || x.length > 100))
  )
    return false;
  if ('inventory' in p) { try { validateInventory(p.inventory); } catch { return false; } }
  if ('effectClocks' in p && !validEffectClocks(p.effectClocks)) return false;
  if (
    'effortTrack' in p &&
    (!Array.isArray(p.effortTrack) ||
      p.effortTrack.length !== 2 ||
      p.effortTrack.some((x) => typeof x !== 'boolean'))
  )
    return false;
  return true;
}

export function validateActor(t) {
  validateBoss(t?.boss);
    assert(t && typeof t === 'object', 'Invalid actor.');
    assert(typeof t.name === 'string' && finite(t.x) && finite(t.y), 'Invalid token data.');
    resource(t.hp, 'HP');
    if (t.bestiaryMode != null) assert(['partial', 'minion', 'narrative'].includes(t.bestiaryMode) && t.actorType === 'adversary', 'Invalid bestiary profile.');
    if (isEncounterMarker(t)) assert(t.hp.max === 0 && t.hp.current === 0, 'Encounter markers have no HP pool.');
    else assert(t.hp.max >= 1, 'HP maximum must be positive.');
    for (const key of ['armor', 'stress', 'resolve'])
      if (t[key] !== undefined) resource(t[key], key);
    for (const key of ['hope', 'effort'])
      if (t[key] !== undefined) assert(finite(t[key], 0, 6), `Invalid ${key}.`);
    if (t.conditions !== undefined)
      assert(
        Array.isArray(t.conditions) && t.conditions.length <= 30 && t.conditions.every((x) => typeof x === 'string' && x.length <= 100),
        'Invalid conditions.'
      );
    if (t.inventory !== undefined) validateInventory(t.inventory);
    for (const stats of [t.traits, t.subtraits])
      if (stats !== undefined)
        assert(
          stats &&
            typeof stats === 'object' &&
            Object.values(stats).every((n) => finite(n, -100, 100)),
          'Invalid character Traits.'
        );

  for (const key of ['majorThreshold', 'severeThreshold']) if (t.hp[key] !== undefined && t.hp[key] !== null) assert(finite(t.hp[key], 0, 10000), 'Invalid damage thresholds.');
  if (t.hp.majorThreshold !== undefined && t.hp.severeThreshold !== undefined && t.hp.majorThreshold !== null && t.hp.severeThreshold !== null) assert(t.hp.severeThreshold >= t.hp.majorThreshold, 'Severe debe ser igual o mayor que Major.');
  for (const key of ['level', 'proficiency', 'evasion', 'attackModifier', 'honedEdgeBonus', 'armorEvasion']) if (t[key] !== undefined && t[key] !== null) assert(finite(t[key], ['attackModifier', 'armorEvasion'].includes(key) ? -100 : 0, 100), `Invalid ${key}.`);
  for (const key of ['species', 'community', 'characterClass', 'subclass', 'roleTag', 'path', 'damageExpression', 'attackRange', 'featureNotes', 'description']) {
    if (t[key] === null) delete t[key];
    else if (t[key] !== undefined) {
      if (typeof t[key] !== 'string') t[key] = String(t[key]);
      assert(t[key].length <= 100000, `Invalid ${key}.`);
    }
  }
  if (t.name !== undefined) {
    if (typeof t.name !== 'string') t.name = String(t.name || 'Token');
    assert(t.name.length <= 100000, 'Invalid name.');
  }
  if (t.actorType !== undefined && t.actorType !== null) assert(['player', 'npc', 'adversary', 'drone'].includes(t.actorType), 'Invalid actor type.');
  if (t.drone === null) delete t.drone;
  if (t.drone !== undefined) validateDroneState(t.drone);
  if (t.ownerId !== undefined) {
    if (t.ownerId === null) delete t.ownerId;
    else if (typeof t.ownerId !== 'string') t.ownerId = String(t.ownerId);
    if (t.ownerId !== undefined) assert(t.ownerId.length <= 200, 'Invalid owner.');
  }
  if (t.controllerIds !== undefined && t.controllerIds !== null) assert(Array.isArray(t.controllerIds) && t.controllerIds.length <= 100 && t.controllerIds.every(x => typeof x === 'string' && x.length <= 200), 'Invalid controllers.');
  if (t.scenePositions !== undefined && t.scenePositions !== null) assert(t.scenePositions && typeof t.scenePositions === 'object' && Object.keys(t.scenePositions).length <= 100 && Object.values(t.scenePositions).every(p => p && finite(p.x) && finite(p.y)), 'Invalid scene positions.');
  if (t.isPlayer === true && t.path !== undefined && t.path !== null && t.path !== '') assert(['Awakened', 'Sleeping'].includes(t.path), 'Invalid character Path.');
  if (t.resolve?.dieType !== undefined && t.resolve?.dieType !== null) assert(['d4', 'd6'].includes(t.resolve.dieType), 'Invalid Resolve die.');
  if (t.size !== undefined && t.size !== null) assert(finite(t.size, 0.1, 20), 'Invalid token size.');
  if (t.color !== undefined && t.color !== null) {
    if (typeof t.color !== 'string') t.color = String(t.color);
    assert(t.color.length <= 50, 'Invalid token color.');
  }
  if (t.sourceCharacter !== undefined && t.sourceCharacter !== null) assert(t.sourceCharacter && typeof t.sourceCharacter === 'object' && ['Veilfarers Character Sheet', 'Veilfarers Character Creator'].includes(t.sourceCharacter.document?.app) && t.sourceCharacter.document?.fields && typeof t.sourceCharacter.document.fields === 'object', 'Invalid source character.');
  return t;
}
