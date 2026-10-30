export type UserRole = 'gm' | 'player';
export type CharacterPath = 'awakened' | 'sleeping';

export interface VTTUser {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  role: UserRole;
  color: string;
  isOnline: boolean;
  lastSeen?: number;
}

export type GridType = 'square' | 'hex';

export interface GridConfig {
  enabled: boolean;
  type: GridType;
  size: number; // pixels per cell
  color: string;
  opacity: number;
  snapToGrid: boolean;
  scaleUnit: string; // e.g. "5 m" or "Range Band"
}

// Canonical 12.06 Traits
export interface CoreTraits {
  agility: number;
  strength: number;
  finesse: number;
  knowledge: number;
  instinct: number;
  presence: number;
}

export type TraitName = keyof CoreTraits;
export type SubtraitName = 'finesse_pilot' | 'knowledge_tech' | 'knowledge_medicine';

export type AncestryType =
  | 'Ailuran'
  | 'Bloomstrider'
  | 'Celestiari'
  | 'Ethereal'
  | 'Human'
  | 'Kryllian'
  | 'Kryx'
  | 'Rift Spinner'
  | 'Synthetic';

export type CommunityType =
  | 'Core World'
  | 'Trade Hub'
  | 'Frontier Colony'
  | 'Void Station'
  | 'Free Fleet'
  | 'AgriSynth'
  | 'Hidden Enclave';

export type AffiliationType =
  | 'House Amaranth'
  | 'House Joric'
  | 'House Kurogane'
  | 'House Solari'
  | 'House Valerius'
  | 'House Volkov'
  | 'House Kaelen'
  | 'The Free Fleet'
  | 'The Explorers\' Guild'
  | 'The Solara Compact'
  | 'The Stellar Commerce Guild'
  | 'Independent';

export type ClassType =
  | 'Diplomat'
  | 'Engineer'
  | 'Explorer'
  | 'Mystic'
  | 'Pilot'
  | 'Scholar'
  | 'Scoundrel'
  | 'Soldier'
  | 'Vanguard';

export type DomainType =
  | 'Social'
  | 'Void'
  | 'Kinetic'
  | 'Neural'
  | 'Synthesis'
  | 'Tech'
  | 'Lux';

export type ConditionType =
  | 'Bleeding'
  | 'Blinded'
  | 'Confused'
  | 'Cornered'
  | 'Dazed'
  | 'Fleeing'
  | 'Frightened'
  | 'Hidden'
  | 'Incapacitated'
  | 'Infected'
  | 'On Fire'
  | 'Poisoned'
  | 'Prone'
  | 'Restrained'
  | 'Silenced'
  | 'Stunned'
  | 'Vulnerable'
  | 'Weakened';

export interface Token {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number; // in grid cells (1, 2, 3)
  rotation: number; // 0 - 360
  color: string;
  avatarUrl?: string;
  
  // Canonical Defenses
  hp: number;
  maxHp: number;
  majorThreshold: number; // Major Damage Threshold
  severeThreshold: number; // Severe Damage Threshold
  armorSlots: number; // Current available soak
  maxArmorSlots: number; // Maximum soak capacity
  evasion: number; // Target DC to hit
  
  // Stress and Composure
  stress: number;
  maxStress: number;
  
  // Path & Resources
  path: CharacterPath;
  hope?: number; // Awakened: 0 - 6
  effort?: number; // Sleeping: 0 - 6
  effortTrack?: number; // Sleeping: 0, 1, or 2 segments
  resolve?: number; // Sleeping: pool of d4s (2 to 6)
  maxResolve?: number;
  
  // Status and Meta
  conditions: ConditionType[];
  isHidden: boolean; // GM stealth
  ownerId?: string; // controlling player UID
  elevation?: number;
  isNpc?: boolean;
  actedThisRound?: boolean;
}

export interface MapData {
  id: string;
  name: string;
  imageUrl?: string;
  proceduralType?: 'rust_belt' | 'hydros' | 'tellurian' | 'spire_verita';
  width: number;
  height: number;
  grid: GridConfig;
}

export interface FogRevealCircle {
  x: number;
  y: number;
  radius: number;
}

export interface FogOfWarData {
  enabled: boolean;
  reveals: FogRevealCircle[];
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingPath {
  id: string;
  color: string;
  width: number;
  points: DrawingPoint[];
}

export interface PingMarker {
  id: string;
  x: number;
  y: number;
  senderName: string;
  color: string;
  timestamp: number;
}

export type DualityOutcome =
  | 'critical_success'
  | 'success_hope'
  | 'success_fear'
  | 'failure_hope'
  | 'failure_fear';

export interface DualityRollResult {
  hopeDie: number; // 1-12
  fearDie: number; // 1-12
  traitName?: string;
  traitModifier: number;
  experienceBonus?: number;
  experienceName?: string;
  advantageModifier?: number; // +d6 (Boon) or -d6 (Bane)
  advantageType?: 'advantage' | 'disadvantage' | 'none';
  total: number;
  dc: number;
  outcome: DualityOutcome;
  label?: string;
  characterName: string;
  path: CharacterPath;
  
  // Damage details if this roll was an attack or weapon damage
  damageDealt?: {
    rawTotal: number;
    damageType: 'Physical' | 'Energy' | 'Void' | 'Neural';
    severity: 'Minor' | 'Major' | 'Severe' | 'Overkill';
    hpLoss: number;
    penetration: number;
    tags: string[];
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  timestamp: number;
  content: string;
  type: 'chat' | 'roll' | 'system' | 'whisper';
  rollDetails?: DualityRollResult;
  recipientId?: string;
}

export interface Experience {
  id: string;
  name: string;
  bonus: number; // usually +2 at creation
}

export interface CharacterSheet {
  id: string;
  ownerUid: string;
  name: string;
  path: CharacterPath;
  ancestry: AncestryType;
  community: CommunityType;
  affiliation: AffiliationType;
  affiliationStanding: number; // -5 to +5, start +1
  reputationPoints: Record<string, number>; // Faction -> RP
  class: ClassType;
  subclass: string;
  level: number;
  proficiency: number; // 1 - 6
  
  // Resources
  hp: number;
  maxHp: number;
  majorThreshold: number;
  severeThreshold: number;
  armorSlots: number;
  maxArmorSlots: number;
  evasion: number;
  stress: number;
  maxStress: number;
  
  // Awakened specific
  hope: number;
  maxHope: number; // 6
  loadout: string[]; // Prepared powers
  vault: string[]; // Known powers
  
  // Sleeping specific
  effort: number;
  maxEffort: number; // 6
  effortTrack: number; // 0, 1, or 2
  resolve: number; // d4 pool (2-6)
  maxResolve: number;
  honedEdge: number; // level - 1
  recoveryAnchor: string;
  
  traits: CoreTraits;
  experiences: Experience[];
  weapons: string[];
  armor: string;
  equipment: string[];
  wealthTier: number; // 0 to 5
  notes: string;
}

export type ActiveTool =
  | 'select'
  | 'pan'
  | 'measure'
  | 'ping'
  | 'draw'
  | 'fog_reveal'
  | 'fog_hide';

export interface ProgressClock {
  id: string;
  name: string;
  segments: number; // 4, 6, 8, 10, 12
  progress: number; // 0 to segments
  color: string;
}

export interface RoomState {
  id: string;
  name: string;
  gmUid: string;
  activeMap: MapData;
  tokens: Record<string, Token>;
  clocks?: ProgressClock[];
  drawings: DrawingPath[];
  fog: FogOfWarData;
  round: number;
  activeSpotlightTokenId?: string;
  actedThisRound: string[];
  keeperFear: number; // 0 to 12
  crewHeat: number; // 0 to 10
  createdAt: number;
}
