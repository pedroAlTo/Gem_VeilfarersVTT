// Which cards work through a drone (Corebook ch. 14, «Domain Powers Through a Drone»). Pure data,
// shared by the table (gameActions) and the hand (droneControl).
// Levels 1-3, by that rule. Vehicle modes (Temporal Cloak, Spatial Shift, Lucky Break, Temporal
// Muffle, Vector Calculus) count: a drone is a light vehicle.
export const DRONE_POWERS = new Set([
  'Drone Whisper', 'Quantum Firewall', 'System Jackknife', 'Data Ghost', 'Emergency Repair', 'Digital Cascade',
  'Biological Scan', 'Ecosystem Analysis',
  'Linguistic Patch', 'Silver Tongue', 'Compelling Argument',
  'Telekinetic Grasp',
  'Tactical Overwatch',
  'Slipstream Jolt', 'Temporal Cloak', 'Vector Calculus', 'Lucky Break', 'Spatial Shift', 'Temporal Muffle',
  "Wayfinder's Pulse", 'Stellar Lance',
]);
const BODY = /\b(touch(?:ing)? (?:an? )?(?:ally|creature|living)|your (?:own )?body|you and all allies|aura|melee attack|your skin|telepathic)\b/i;
const REMOTE = /\b(system|device|network|drone|vehicle|spacecraft|ship|machine|electronic|data|signal|sensor|scan|hack|line of sight|ranged attack)\b/i;
// A card usable through the drone: the Powers by the rule above; the Sleeping roll helpers
// (Common Efforts, Bear Down) that modify the operator's own roll; other Powers by their text.
export function droneCompatible(card) {
  if (!card) return false;
  if (card.kind === 'effort' || card.kind === 'beardown') return true;
  if (!['power', 'archive'].includes(card.kind)) return false;
  if (DRONE_POWERS.has(card.name)) return true;
  if ((card.level || 0) <= 3) return false;
  const text = String(card.text || '');
  return REMOTE.test(text) && !BODY.test(text);
}

