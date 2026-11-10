import { validateInventory } from './equipment.js';
import { validateChatHistory } from './chat.js';
export const CAMPAIGN_KEYS = [
  'campaignId',
  'campaignName',
  'fear',
  'activeMapId',
  'maps',
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
  for (const m of data.maps) {
    assert(
      typeof m.name === 'string' && typeof m.imageUrl === 'string' && finite(m.gridSize, 1, 1000),
      'Invalid map name, image or grid.'
    );
    for (const k of ['walls', 'lights', 'effects', 'waterZones']) {
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
  }
  for (const t of data.tokens) {
    validateActor(t);
    assert(t.mapId === 'reserve' || t.inReserve || data.maps.some(m => m.id === t.mapId), 'Token refers to an unknown map.');
  }
  for (const c of data.clocks)
    assert(
      typeof c.title === 'string' &&
        Number.isInteger(c.segments) &&
        finite(c.segments, 1, 32) &&
        Number.isInteger(c.filled) &&
        finite(c.filled, 0, c.segments),
      'Invalid clock.'
    );
  for (const h of data.handouts)
    assert(typeof h.title === 'string' && typeof h.contentHtml === 'string', 'Invalid dossier.');
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
    if (s.systems)
      assert(
        Object.values(s.systems).every((n) => Number.isInteger(n) && finite(n, 0, 3)),
        'Invalid system Integrity.'
      );
  } else throw new Error('Missing starship data.');
  if (data.logs !== undefined) assert(Array.isArray(data.logs) && data.logs.length <= 150 && data.logs.every(x => x && typeof x === 'object'), 'Invalid session log.');
  return structuredClone({ ...data, chatMessages: validateChatHistory(data.chatMessages) });
}

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
        ].includes(k)
    )
  )
    return false;
  for (const k of ['x', 'y', 'rotation', 'facingAngle']) if (k in p && !finite(p[k])) return false;
  for (const k of ['hope', 'effort']) if (k in p && !finite(p[k], 0, 6)) return false;
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
    assert(t && typeof t === 'object', 'Invalid actor.');
    assert(typeof t.name === 'string' && finite(t.x) && finite(t.y), 'Invalid token data.');
    resource(t.hp, 'HP');
    assert(t.hp.max >= 1, 'HP maximum must be positive.');
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

  for (const key of ['majorThreshold', 'severeThreshold']) if (t.hp[key] !== undefined) assert(finite(t.hp[key], 0, 10000), 'Invalid damage thresholds.');
  if (t.hp.majorThreshold !== undefined && t.hp.severeThreshold !== undefined) assert(t.hp.severeThreshold >= t.hp.majorThreshold, 'Severe debe ser igual o mayor que Major.');
  for (const key of ['level', 'proficiency', 'evasion', 'attackModifier', 'honedEdgeBonus']) if (t[key] !== undefined) assert(finite(t[key], key === 'attackModifier' ? -100 : 0, 100), `Invalid ${key}.`);
  for (const key of ['name', 'species', 'community', 'characterClass', 'subclass', 'roleTag', 'path', 'damageExpression', 'attackRange', 'featureNotes']) if (t[key] !== undefined) assert(typeof t[key] === 'string' && t[key].length <= 100000, `Invalid ${key}.`);
  if (t.actorType !== undefined) assert(['player', 'npc', 'adversary', 'drone'].includes(t.actorType), 'Invalid actor type.');
  if (t.ownerId !== undefined) assert(typeof t.ownerId === 'string' && t.ownerId.length <= 200, 'Invalid owner.');
  if (t.controllerIds !== undefined) assert(Array.isArray(t.controllerIds) && t.controllerIds.length <= 100 && t.controllerIds.every(x => typeof x === 'string' && x.length <= 200), 'Invalid controllers.');
  if (t.scenePositions !== undefined) assert(t.scenePositions && typeof t.scenePositions === 'object' && Object.keys(t.scenePositions).length <= 100 && Object.values(t.scenePositions).every(p => p && finite(p.x) && finite(p.y)), 'Invalid scene positions.');
  if (t.isPlayer === true && t.path !== undefined) assert(['Awakened', 'Sleeping'].includes(t.path), 'Invalid character Path.');
  if (t.resolve?.dieType !== undefined) assert(['d4', 'd6'].includes(t.resolve.dieType), 'Invalid Resolve die.');
  if (t.size !== undefined) assert(finite(t.size, 0.1, 20), 'Invalid token size.');
  if (t.sourceCharacter !== undefined) assert(t.sourceCharacter && typeof t.sourceCharacter === 'object' && t.sourceCharacter.document?.app === 'Veilfarers Character Sheet' && t.sourceCharacter.document?.fields && typeof t.sourceCharacter.document.fields === 'object', 'Invalid source character.');
  return t;
}
