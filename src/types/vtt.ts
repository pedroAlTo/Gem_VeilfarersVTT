export type UserRole = 'gm' | 'player';

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
  scaleUnit: string; // e.g. "5 ft" or "1 m"
}

export interface Token {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number; // in grid cells (1, 2, 3)
  rotation: number; // 0 - 360
  color: string;
  avatarUrl?: string;
  hp: number;
  maxHp: number;
  aether: number;
  maxAether: number;
  conditions: string[];
  isHidden: boolean; // only visible to GM
  ownerId?: string; // UID of controlling player
  elevation?: number;
  initiative?: number;
}

export interface MapData {
  id: string;
  name: string;
  imageUrl?: string;
  proceduralType?: 'veil_ruins' | 'astral_void' | 'dungeon' | 'sanctum';
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

export interface DieRoll {
  sides: number;
  value: number;
  dropped?: boolean;
}

export interface DiceRollResult {
  formula: string;
  total: number;
  dice: DieRoll[];
  modifier: number;
  isCritSuccess?: boolean;
  isCritFail?: boolean;
  label?: string;
  veilStrain?: number;
  archetype?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  timestamp: number;
  content: string;
  type: 'chat' | 'roll' | 'system' | 'whisper';
  rollDetails?: DiceRollResult;
  recipientId?: string;
}

export interface VeilfarerAttributes {
  might: number;
  agility: number;
  wits: number;
  willpower: number;
  resonance: number;
}

export interface CharacterSheet {
  id: string;
  ownerUid: string;
  name: string;
  archetype: string;
  level: number;
  hp: number;
  maxHp: number;
  aether: number;
  maxAether: number;
  strain: number; // Veil corruption / strain
  maxStrain: number;
  attributes: VeilfarerAttributes;
  skills: Array<{ name: string; attr: keyof VeilfarerAttributes; bonus: number }>;
  equipment: string[];
  relics: string[];
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

export interface RoomState {
  id: string;
  name: string;
  gmUid: string;
  activeMap: MapData;
  tokens: Record<string, Token>;
  drawings: DrawingPath[];
  fog: FogOfWarData;
  initiativeRound: number;
  activeInitiativeTokenId?: string;
  createdAt: number;
}
