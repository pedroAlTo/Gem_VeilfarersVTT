// A token's vision, light and vibration sense are measured in metres (v2.63.0, user request: «la
// visión de los tokens debería medirse en metros, no en píxeles, y estar alineada con la escala de
// cada mapa»). Each map says how many pixels a square has (gridSize) and how many metres it is
// (gridScaleMeters); the same character sees as far on a small sketch as on a 4K plate.
// Up to v2.62 they were pixels (`visionRange`, `lightRadius`, `vibrationRadius`), so on a large map
// a character saw a couple of squares. Those old values are ignored: tokens without metres use the
// defaults below.
// Two ranges, as Foundry VTT's detection modes (v2.64.0, user decision): the vision range is the
// farthest a character sees anything (Foundry's «Light Perception», which there is unlimited by
// default); the dark range is what it makes out without light (Foundry's «Basic Sight» / vision
// range, 0 for a human there). By day, or with no time set in Clima, it sees up to its vision range;
// at night, up to its dark range in the dark and up to its vision range where something is lit.
export const DEFAULT_VISION_METERS = 25;    // Far (decision 9): the farthest a character sees
export const DEFAULT_DARK_METERS = 5;       // Very Close: what it makes out at night without light
export const DEFAULT_LIGHT_METERS = 10;     // Close: a hand lamp or a suit light
export const DEFAULT_VIBRATION_METERS = 10; // Close
const METERS_PER_SQUARE = 2;                // the table's default scale (attackFlow.DEFAULT_METERS_PER_SQUARE)

const meters = (value, fallback) => (Number.isFinite(value) && value >= 0 ? Math.min(value, 1000) : fallback);
export const pixelsPerMeter = map => (map?.gridSize || 64) / (map?.gridScaleMeters || METERS_PER_SQUARE);

export function tokenSenses(token) {
  return {
    vision: meters(token?.visionMeters, DEFAULT_VISION_METERS),
    // Night vision (the green beam) sees in the dark as far as by day, unless the sheet says otherwise.
    dark: meters(token?.darkMeters, token?.visionMode === 'night_vision' ? meters(token?.visionMeters, DEFAULT_VISION_METERS) : DEFAULT_DARK_METERS),
    light: meters(token?.lightMeters, DEFAULT_LIGHT_METERS),
    vibration: meters(token?.vibrationMeters, DEFAULT_VIBRATION_METERS),
  };
}

// The token as the vision, lighting and fog engines read it: its ranges in this map's pixels.
export function withRanges(token, map) {
  const k = pixelsPerMeter(map), s = tokenSenses(token);
  return { ...token, visionRange: s.vision * k, darkRange: Math.min(s.dark, s.vision) * k, lightRadius: s.light * k, vibrationRadius: s.vibration * k };
}
