// src/defaultData.js
// Pre-configured Pearl Era assets, scenes, tokens and clocks based on Veilfarers Corebook, Keeper's Companion & Rust and Steel

export const INITIAL_MAPS = [
  {
    id: 'map_bridge_01',
    name: 'Bridge // USC Vagrant Star',
    imageUrl: '/assets/maps/starship_bridge.jpg',
    gridSize: 64,
    gridType: 'square',
    gridColor: 'rgba(0, 243, 255, 0.18)',
    ambientLight: 0.25,
    ambientColor: '#080d18',
    walls: [
      // Outer hull boundary (1376 x 768)
      { id: 'wall_b1', x1: 24, y1: 24, x2: 1352, y2: 24, isDoor: false, isOpen: false },
      { id: 'wall_b2', x1: 1352, y1: 24, x2: 1352, y2: 744, isDoor: false, isOpen: false },
      { id: 'wall_b3', x1: 1352, y1: 744, x2: 24, y2: 744, isDoor: false, isOpen: false },
      { id: 'wall_b4', x1: 24, y1: 744, x2: 24, y2: 24, isDoor: false, isOpen: false },
      // Central quantum core bulkhead barrier & observation window
      { id: 'wall_window_obs', x1: 530, y1: 390, x2: 670, y2: 390, wallType: 'window', isWindow: true, visionPercent: 85, label: 'Mirador Cuántico Blindado' },
      { id: 'wall_c1', x1: 670, y1: 390, x2: 846, y2: 390, wallType: 'wall', isDoor: false, isOpen: false },
      { id: 'wall_c2', x1: 530, y1: 390, x2: 530, y2: 700, wallType: 'wall', isDoor: false, isOpen: false },
      { id: 'wall_c3', x1: 846, y1: 390, x2: 846, y2: 700, wallType: 'wall', isDoor: false, isOpen: false },
      // Left workstation partition & blast door (unlocked for players)
      { id: 'wall_w1', x1: 260, y1: 250, x2: 430, y2: 250, wallType: 'wall', isDoor: false, isOpen: false },
      { id: 'wall_door_left', x1: 430, y1: 250, x2: 490, y2: 250, wallType: 'door', isDoor: true, isOpen: false, isLocked: false, label: 'Airlock Blast Door' },
      { id: 'wall_w2', x1: 260, y1: 250, x2: 260, y2: 460, wallType: 'wall', isDoor: false, isOpen: false }
    ],
    lights: [
      {
        id: 'light_core_01',
        x: 688,
        y: 545,
        radius: 320,
        color: '#00f3ff',
        intensity: 0.95,
        effect: 'quantum',
        pulseSpeed: 1.5,
        label: 'Quantum Pearl Core'
      },
      {
        id: 'light_helm_01',
        x: 688,
        y: 135,
        radius: 240,
        color: '#38bdf8',
        intensity: 0.8,
        effect: 'pulse',
        pulseSpeed: 1.0,
        label: 'Tactical Holo-Display'
      },
      {
        id: 'light_starboard_01',
        x: 1250,
        y: 380,
        radius: 250,
        color: '#3b82f6',
        intensity: 0.7,
        effect: 'steady',
        pulseSpeed: 0.5,
        label: 'Deep Void Viewport'
      },
      {
        id: 'light_warn_01',
        x: 90,
        y: 270,
        radius: 180,
        color: '#ffaa00',
        intensity: 0.65,
        effect: 'flicker',
        pulseSpeed: 2.5,
        label: 'Bulkhead Caution Light'
      }
    ],
    waterZones: [
      {
        id: 'water_coolant_01',
        name: 'Coolant Leak // Primary Conduit',
        x: 550,
        y: 580,
        width: 270,
        height: 110,
        depth: 1, // Depth 1: Ankle-deep (10-30cm)
        color: 'rgba(0, 243, 255, 0.45)',
        flowSpeed: 1.2
      }
    ],
    effects: []
  },
  {
    id: 'map_derelict_02',
    name: 'Sector 04 // Derelict Research Station',
    imageUrl: '/assets/maps/derelict_station.jpg',
    gridSize: 64,
    gridType: 'square',
    gridColor: 'rgba(255, 170, 0, 0.18)',
    ambientLight: 0.12,
    ambientColor: '#05070c',
    walls: [
      // Outer perimeter
      { id: 'wall_d1', x1: 24, y1: 24, x2: 1352, y2: 24, isDoor: false, isOpen: false },
      { id: 'wall_d2', x1: 1352, y1: 24, x2: 1352, y2: 744, isDoor: false, isOpen: false },
      { id: 'wall_d3', x1: 1352, y1: 744, x2: 24, y2: 744, isDoor: false, isOpen: false },
      { id: 'wall_d4', x1: 24, y1: 744, x2: 24, y2: 24, isDoor: false, isOpen: false },
      // Dividing central corridor wall
      { id: 'wall_d5', x1: 670, y1: 24, x2: 670, y2: 440, isDoor: false, isOpen: false },
      { id: 'wall_door_sec4', x1: 670, y1: 440, x2: 670, y2: 550, isDoor: true, isOpen: false, label: 'Station Blast Hatch' },
      { id: 'wall_d6', x1: 240, y1: 210, x2: 670, y2: 210, isDoor: false, isOpen: false },
      { id: 'wall_d7', x1: 240, y1: 210, x2: 240, y2: 600, isDoor: false, isOpen: false },
      { id: 'wall_d8', x1: 240, y1: 600, x2: 670, y2: 600, isDoor: false, isOpen: false }
    ],
    lights: [
      {
        id: 'light_cryo_01',
        x: 1220,
        y: 390,
        radius: 320,
        color: '#a855f7',
        intensity: 0.9,
        effect: 'quantum',
        pulseSpeed: 1.8,
        label: 'Stasis Cryo Tubes'
      },
      {
        id: 'light_spark_01',
        x: 500,
        y: 200,
        radius: 190,
        color: '#f97316',
        intensity: 0.85,
        effect: 'spark',
        pulseSpeed: 4.0,
        label: 'Sparking High-Voltage Cable'
      },
      {
        id: 'light_hall_01',
        x: 120,
        y: 210,
        radius: 200,
        color: '#ef4444',
        intensity: 0.7,
        effect: 'siren',
        pulseSpeed: 3.0,
        label: 'Emergency Airlock Siren'
      }
    ],
    waterZones: [
      {
        id: 'water_cryo_leak',
        name: 'Cryo Containment Flood Tank',
        x: 980,
        y: 260,
        width: 340,
        height: 280,
        depth: 3, // Depth 3: Waist-deep swamp / fluid (1m)
        color: 'rgba(168, 85, 247, 0.5)',
        flowSpeed: 0.8
      }
    ]
  }
];

export const INITIAL_TOKENS = [
  {
    id: 'tok_harker',
    mapId: 'map_bridge_01',
    x: 688,
    y: 260,
    size: 1, // 1 grid cell
    name: 'Capt. Jonathan Harker',
    roleTag: 'Captain // Awakened Voidwalker',
    avatarUrl: '/assets/tokens/captain_harker.jpg',
    isPlayer: true,
    ownerId: 'player_1',
    hidden: false,
    path: 'Awakened',
    // Veilfarers Vitals
    hp: { current: 16, max: 16, majorThreshold: 6, severeThreshold: 12 },
    armor: { current: 3, max: 4 },
    stress: { current: 1, max: 6 },
    hope: 3,
    effort: 2,
    resolve: { current: 3, max: 3, dieType: 'd4' },
    traits: {
      agility: 1,
      strength: 2,
      finesse: 1,
      knowledge: 1,
      instinct: 2,
      presence: 3
    },
    subtraits: {
      pilot: 1,
      tech: 0,
      medicine: 0
    },
    conditions: [],
    visionRadius: 10,
    visionAngle: 90,
    hasLight: true,
    lightRadius: 280,
    lightColor: '#00f3ff',
    lightEffect: 'steady',
    displayConfig: {
      showHpBar: true,
      showStressBar: true,
      showHpCounter: true,
      showArmorCounter: true,
      showClock: true,
      clockSegments: 4,
      clockProgress: 2,
      clockLabel: 'HACK'
    }
  },
  {
    id: 'tok_vea',
    mapId: 'map_bridge_01',
    x: 375,
    y: 330,
    size: 1,
    name: 'Vea Kaelen',
    roleTag: 'Ace Pilot // Awakened Starchaser',
    avatarUrl: '/assets/tokens/pilot_vea.jpg',
    isPlayer: true,
    ownerId: 'player_2',
    hidden: false,
    path: 'Awakened',
    hp: { current: 14, max: 14, majorThreshold: 5, severeThreshold: 10 },
    armor: { current: 2, max: 2 },
    stress: { current: 2, max: 6 },
    hope: 4,
    effort: 2,
    resolve: { current: 2, max: 2, dieType: 'd4' },
    traits: {
      agility: 3,
      strength: 0,
      finesse: 3,
      knowledge: 1,
      instinct: 2,
      presence: 0
    },
    subtraits: {
      pilot: 3,
      tech: 1,
      medicine: 0
    },
    conditions: [],
    visionRadius: 12,
    visionAngle: 90,
    hasLight: true,
    lightRadius: 240,
    lightColor: '#38bdf8',
    lightEffect: 'pulse'
  },
  {
    id: 'tok_he09',
    mapId: 'map_bridge_01',
    x: 1000,
    y: 380,
    size: 1,
    name: 'Unit HE-09',
    roleTag: 'Heavy Engineer // Sleeping Synthetic',
    avatarUrl: '/assets/tokens/engineer_he09.jpg',
    isPlayer: true,
    ownerId: 'player_3',
    hidden: false,
    path: 'Sleeping',
    hp: { current: 22, max: 22, majorThreshold: 8, severeThreshold: 16 },
    armor: { current: 5, max: 5 },
    stress: { current: 0, max: 7 }, // Synthetics have max 7 Stress
    hope: 2,
    effort: 3,
    effortTrack: [false, false],
    resolve: { current: 4, max: 4, dieType: 'd4' },
    isBurnedOut: false,
    recoveryAnchor: 'Auxiliary Core Relay #7',
    honedEdgeBonus: 2, // Level 3 -> +2
    traits: {
      agility: 0,
      strength: 3,
      finesse: 1,
      knowledge: 3,
      instinct: 1,
      presence: 0
    },
    subtraits: {
      pilot: 0,
      tech: 3,
      medicine: 1
    },
    conditions: [],
    visionRadius: 9,
    visionAngle: 90,
    hasLight: true,
    lightRadius: 260,
    lightColor: '#ffaa00',
    lightEffect: 'flicker'
  },
  {
    id: 'tok_stalker',
    mapId: 'map_bridge_01',
    x: 1180,
    y: 620,
    size: 2, // Large 2x2
    name: 'Void Horror Stalker',
    roleTag: 'Threat Tier 3 // Apex Abomination',
    avatarUrl: '/assets/tokens/void_stalker.jpg',
    actorType: 'adversary',
    isPlayer: false,
    hideName: true,
    ownerId: 'keeper',
    hidden: true, // Hidden from players by default!
    path: 'Awakened',
    hp: { current: 36, max: 36, majorThreshold: 10, severeThreshold: 20 },
    armor: { current: 4, max: 4 },
    stress: { current: 0, max: 6 },
    hope: 0,
    effort: 0,
    resolve: { current: 0, max: 0, dieType: 'd4' },
    traits: {
      agility: 3,
      strength: 4,
      finesse: 2,
      knowledge: 0,
      instinct: 4,
      presence: 2
    },
    subtraits: {
      pilot: 0,
      tech: 0,
      medicine: 0
    },
    conditions: ['Invisible'],
    visionRadius: 14,
    visionAngle: 90,
    hasLight: true,
    lightRadius: 180,
    lightColor: '#a855f7',
    lightEffect: 'quantum'
  }
];

export const INITIAL_CLOCKS = [
  {
    id: 'clock_reactor',
    title: 'Reactor Overheat // Meltdown',
    segments: 6,
    filled: 2,
    category: 'danger',
    isKeeperOnly: false,
    posX: 80,
    posY: 70,
    collapsed: false
  },
  {
    id: 'clock_reinforcements',
    title: 'Void Patrol Intercept Vector',
    segments: 8,
    filled: 3,
    category: 'countdown',
    isKeeperOnly: false,
    posX: 80,
    posY: 240,
    collapsed: false
  },
  {
    id: 'clock_hatch_burn',
    title: 'Cutting Through Blast Bulkhead',
    segments: 4,
    filled: 1,
    category: 'project',
    isKeeperOnly: false,
    posX: 80,
    posY: 410,
    collapsed: true
  },
  {
    id: 'clock_hidden_ambush',
    title: 'Void Entity Stalking Ambush (SECRET)',
    segments: 6,
    filled: 4,
    category: 'danger',
    isKeeperOnly: true,
    posX: 80,
    posY: 510,
    collapsed: true
  }
];

export const INITIAL_HANDOUTS = [
  {
    id: 'doc_quantum_anomaly',
    title: 'CLASSIFIED // Quantum Pearl Substrate Drift',
    sender: 'Naval Intelligence Office // Imperial House Sola',
    timestamp: 'Cycle 103.4 // Post-Silence',
    contentHtml: `
      <div style="font-family: var(--font-body); line-height: 1.6; color: #e2e8f0;">
        <h2 style="font-family: var(--font-display); color: var(--cyan-pearl); margin-bottom: 8px;">TRANSMISSION: DEEP VEIL DISTORTION</h2>
        <p><strong>To:</strong> Commander Maren & Crew of the <em>Vagrant Star</em></p>
        <p><strong>Subject:</strong> Substrate resonance spike detected in Sector 04.</p>
        <hr style="border: 0; border-top: 1px solid rgba(0, 243, 255, 0.3); margin: 12px 0;" />
        <p>Telemetry from deep acoustic sensors confirms the awakening of a high-resonance <strong>Void Anomaly</strong> within the derelict containment bay. The Great Silence left multiple experimental Pearl arrays unshielded in this quadrant.</p>
        <blockquote style="border-left: 3px solid var(--crimson-fear); background: rgba(255, 42, 95, 0.1); padding: 8px 12px; margin: 12px 0;">
          <strong style="color: var(--crimson-fear);">WARNING - SUBSTRATE PRESSURE:</strong> Flooding of the lower bulkheads has reached Level 3 (Waist-deep cryo discharge). Any operative engaging without sealed mag-boots will suffer movement reduction and hypothermic burn.
        </blockquote>
        <h3 style="font-family: var(--font-hud); color: var(--amber-warn); margin-top: 14px;">PRIMARY DIRECTIVES:</h3>
        <ol style="margin-left: 20px;">
          <li>Stabilize the central Quantum Core before containment breaches (Track via Meltdown Clock).</li>
          <li>Engage the apex entity using heavy munitions. Mitigate kinetic severity using Armor Slots.</li>
          <li>Sleeping operatives are authorized to expend Resolve via <em>Bear Down</em>.</li>
        </ol>
      </div>
    `,
    imageUrl: '/assets/tokens/void_stalker.jpg',
    sharedWithPlayers: false
  }
];
