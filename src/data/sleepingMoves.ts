import type { ClassType } from '../types/vtt';

export interface SleepingMove {
  id: string;
  name: string;
  category: 'Common Effort' | 'Universal Resolve' | 'Class Move';
  classRequirement?: ClassType;
  effortCost?: number;
  resolveCostDice?: number; // count of d4s
  isRoll?: boolean; // if true, rolls the d4s and adds total
  description: string;
}

export const SLEEPING_MOVES: SleepingMove[] = [
  // ================= COMMON EFFORTS =================
  {
    id: 'eff-steady-hands',
    name: 'Steady Hands',
    category: 'Common Effort',
    effortCost: 1,
    description: 'Before making a Core Trait Roll that draws on something practiced, add +2 to the total.',
  },
  {
    id: 'eff-read-the-room',
    name: 'Read the Room',
    category: 'Common Effort',
    effortCost: 1,
    description: 'Ask the Keeper one truthful question about the tactical or social situation (exits, who holds power, tension).',
  },
  {
    id: 'eff-push-through',
    name: 'Push Through',
    category: 'Common Effort',
    effortCost: 1,
    description: 'Ignore one minor environmental or condition penalty on your next action (smoke, darkness, awkward footing).',
  },
  {
    id: 'eff-the-opening',
    name: 'The Opening',
    category: 'Common Effort',
    effortCost: 2,
    description: 'Gain Advantage (+1d6) on your next roll, through positioning, preparation, or veteran experience.',
  },
  {
    id: 'eff-try-again',
    name: 'Try Again',
    category: 'Common Effort',
    effortCost: 2,
    description: 'After rolling, reroll ONE of your two Duality dice (the Hope die or the Fear die) and keep the new result.',
  },
  {
    id: 'eff-brace',
    name: 'Brace',
    category: 'Common Effort',
    effortCost: 2,
    description: 'Against incoming harm you see coming, drop the next hit by one severity band (Severe -> Major -> Minor -> 0 HP) without spending Armor Slots.',
  },
  {
    id: 'eff-cover-angle',
    name: 'Cover the Angle',
    category: 'Common Effort',
    effortCost: 2,
    description: 'Give your Reaction to an ally within range: the next Core Trait Roll they make before your next Spotlight gains +2.',
  },

  // ================= UNIVERSAL RESOLVE MOVE =================
  {
    id: 'res-bear-down',
    name: 'Bear Down',
    category: 'Universal Resolve',
    resolveCostDice: 1,
    isRoll: true,
    description: 'After any Duality Roll, attack, reaction, or damage roll, roll Resolve Dice (d4s) and add their total to the result.',
  },

  // ================= CLASS RESOLVE MOVES =================
  // Soldier
  {
    id: 'res-soldier-take-hit',
    name: 'Take the Hit',
    category: 'Class Move',
    classRequirement: 'Soldier',
    resolveCostDice: 1,
    isRoll: true,
    description: 'When an ally in Close range is hit, intercept it. Reduce damage by rolled total (d4s) and take remaining damage yourself.',
  },
  {
    id: 'res-soldier-disciplined-strike',
    name: 'Disciplined Strike',
    category: 'Class Move',
    classRequirement: 'Soldier',
    resolveCostDice: 1,
    isRoll: true,
    description: 'Add rolled total (d4s) to a damage roll. Target cannot spend Armor Slots against the added portion.',
  },

  // Pilot
  {
    id: 'res-pilot-odds',
    name: 'Never Tell Me the Odds',
    category: 'Class Move',
    classRequirement: 'Pilot',
    resolveCostDice: 1,
    description: 'Attempt an impossible maneuver with Advantage by declaring a quirk of this hull. On Fear-dominant roll, the ship pays, not the crew.',
  },
  {
    id: 'res-pilot-hold-together',
    name: 'Hold Together',
    category: 'Class Move',
    classRequirement: 'Pilot',
    resolveCostDice: 1,
    isRoll: true,
    description: 'Reduce the damage your ship takes this round by the rolled total (d4s), or keep a failing subsystem online.',
  },

  // Engineer
  {
    id: 'res-eng-improvisation',
    name: 'Field Improvisation',
    category: 'Class Move',
    classRequirement: 'Engineer',
    resolveCostDice: 1,
    isRoll: true,
    description: 'Restore personal/vehicle Armor Slots, drone HP, or one ship arc\'s Armor Slots equal to rolled total (d4s), or return an offline device to service.',
  },
  {
    id: 'res-eng-hotwire',
    name: 'Hot-Wire',
    category: 'Class Move',
    classRequirement: 'Engineer',
    resolveCostDice: 1,
    description: 'Bypass one non-Precursor lock or activate one machine without a roll until the end of the scene.',
  },

  // Diplomat
  {
    id: 'res-dip-force-presence',
    name: 'Force of Presence',
    category: 'Class Move',
    classRequirement: 'Diplomat',
    resolveCostDice: 1,
    isRoll: true,
    description: 'Add rolled total to a Presence roll, or force an NPC of lesser standing to yield a minor concession before witnesses with no roll.',
  },
  {
    id: 'res-dip-read-table',
    name: 'Read the Table',
    category: 'Class Move',
    classRequirement: 'Diplomat',
    resolveCostDice: 1,
    description: 'In any negotiation, learn each present NPC\'s true priority and which of them will break first.',
  },

  // Scoundrel
  {
    id: 'res-scoundrel-vanish',
    name: 'Vanish',
    category: 'Class Move',
    classRequirement: 'Scoundrel',
    resolveCostDice: 1,
    description: 'Break line of sight and leave a tense scene with no roll, reappearing where it will hurt the opposition most.',
  },
  {
    id: 'res-scoundrel-long-con',
    name: 'The Long Con',
    category: 'Class Move',
    classRequirement: 'Scoundrel',
    resolveCostDice: 2,
    description: 'Plant a false belief or forged credential that holds up under one round of scrutiny.',
  },

  // Explorer
  {
    id: 'res-explorer-find-way',
    name: 'Find a Way',
    category: 'Class Move',
    classRequirement: 'Explorer',
    resolveCostDice: 1,
    description: 'There is always a route. Discover a viable path through terrain, a blockade, or a sealed approach.',
  },

  // Scholar
  {
    id: 'res-scholar-analyze-weakness',
    name: 'Analyze Weakness',
    category: 'Class Move',
    classRequirement: 'Scholar',
    resolveCostDice: 1,
    description: 'Study a foe or object and reveal a vulnerability that grants the crew Advantage against it for the scene.',
  },

  // Vanguard
  {
    id: 'res-vanguard-weightless',
    name: 'The Weightless Art',
    category: 'Class Move',
    classRequirement: 'Vanguard',
    resolveCostDice: 1,
    isRoll: true,
    description: 'For rolled rounds, your ki makes the world your floor (walls, cables, crowd heads). Fall without sound/harm and leaps cross +1 range band.',
  },
];
