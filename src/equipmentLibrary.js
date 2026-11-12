// src/equipmentLibrary.js
// Canonical Equipment, Augmentations, Weapons, Alien Species Gear & Drone Modules Catalog
// Direct extraction from Veilfarers Corebook 12.06 and Rust & Steel.

import { newId } from './persistence.js';

export const EQUIPMENT_SOURCES = [
  { id: 'all', name: 'Todas las fuentes' },
  { id: 'core', name: 'Reglamento Base (Core)' },
  { id: 'rust_and_steel', name: 'Rust & Steel (Casas y Especies)' }
];

export const EQUIPMENT_CATEGORIES = [
  { id: 'all', name: 'Todas las categorías' },
  { id: 'weapons', name: '⚔️ Armas y Ataques' },
  { id: 'armor', name: '🛡️ Armaduras y Escudos' },
  { id: 'gear', name: '🎒 Equipo y Tecnología' },
  { id: 'augmentations', name: '🧬 Aumentos e Implantes' },
  { id: 'drone_modules', name: '🤖 Módulos de Dron' }
];

export const EQUIPMENT_CATALOG = [
  // ==========================================
  // COREBOOK: LIGHT ARMOR
  // ==========================================
  {
    id: 'core_ar_tactical_weave',
    name: 'Frontier Vest / Malla Táctica',
    source: 'core',
    category: 'armor',
    tier: 'Common (TT1)',
    majorThreshold: 5,
    severeThreshold: 11,
    armorSlots: 3,
    burden: 1,
    features: 'Flexible (+1 Evasión)',
    cost: '1 Cr',
    use: '🛡️ Umbrales: Mayor 5 / Severo 11 (+ Nivel) | +3 Slots de Armadura | Carga: 1. Flexible (+1 Evasión).'
  },
  {
    id: 'core_ar_env_suit',
    name: 'Environmental Suit / Traje Ambiental',
    source: 'core',
    category: 'armor',
    tier: 'Common (TT1)',
    majorThreshold: 4,
    severeThreshold: 8,
    armorSlots: 3,
    burden: 1,
    features: 'Life Support (2h)',
    cost: '1 Cr',
    use: '🛡️ Umbrales: Mayor 4 / Severo 8 (+ Nivel) | +3 Slots de Armadura | Carga: 1. Soporte vital para vacío y atmósferas tóxicas.'
  },
  {
    id: 'core_ar_mesh_armor',
    name: 'Mesh Armor / Malla de Aleación',
    source: 'core',
    category: 'armor',
    tier: 'Common (TT1)',
    majorThreshold: 5,
    severeThreshold: 10,
    armorSlots: 4,
    burden: 1,
    features: 'Self-Repair',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 5 / Severo 10 (+ Nivel) | +4 Slots de Armadura | Carga: 1. Regenera 1 slot en descansos.'
  },
  {
    id: 'core_ar_pilot_jacket',
    name: 'Pilot\'s Jacket / Chaqueta de Piloto',
    source: 'core',
    category: 'armor',
    tier: 'Common (TT1)',
    majorThreshold: 5,
    severeThreshold: 11,
    armorSlots: 3,
    burden: 1,
    features: 'Life Support',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 5 / Severo 11 (+ Nivel) | +3 Slots de Armadura | Carga: 1. Diseñada para cabinas estrechas y altas aceleraciones G.'
  },
  {
    id: 'core_ar_infiltrator_suit',
    name: 'Infiltrator Suit / Traje de Infiltración',
    source: 'core',
    category: 'armor',
    tier: 'Military (TT2)',
    majorThreshold: 7,
    severeThreshold: 14,
    armorSlots: 4,
    burden: 1,
    features: 'Cloaking',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 7 / Severo 14 (+ Nivel) | +4 Slots de Armadura | Carga: 1. Marca 1 Estrés para volverse invisible hasta atacar o ser alcanzado.'
  },
  {
    id: 'core_ar_stealth_armor',
    name: 'Stealth Armor / Armadura de Sigilo',
    source: 'core',
    category: 'armor',
    tier: 'Military (TT2)',
    majorThreshold: 7,
    severeThreshold: 16,
    armorSlots: 4,
    burden: 1,
    features: 'Cloaking',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 7 / Severo 16 (+ Nivel) | +4 Slots de Armadura | Carga: 1. Refracción lumínica avanzada de grado militar.'
  },
  {
    id: 'core_ar_smart_fabric',
    name: 'Smart Fabric Armor / Malla de Tejido Inteligente',
    source: 'core',
    category: 'armor',
    tier: 'Experimental (TT3)',
    majorThreshold: 8,
    severeThreshold: 16,
    armorSlots: 5,
    burden: 1,
    features: 'Flexible (+1 Evasión), Self-Repair',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 8 / Severo 16 (+ Nivel) | +5 Slots de Armadura | Carga: 1. Fibras reactivas con autorreparación rápida.'
  },
  {
    id: 'core_ar_special_forces',
    name: 'Special Forces Suit / Traje de Fuerzas Especiales',
    source: 'core',
    category: 'armor',
    tier: 'Experimental (TT3)',
    majorThreshold: 9,
    severeThreshold: 18,
    armorSlots: 5,
    burden: 1,
    features: 'Resilient',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 9 / Severo 18 (+ Nivel) | +5 Slots de Armadura | Carga: 1. En el último slot, 1d6 (con 6 ignora el daño).'
  },

  // ==========================================
  // COREBOOK: MEDIUM ARMOR
  // ==========================================
  {
    id: 'core_ar_homestead_rig',
    name: 'Homestead Rig / Arnés de Colono',
    source: 'core',
    category: 'armor',
    tier: 'Common (TT1)',
    majorThreshold: 6,
    severeThreshold: 13,
    armorSlots: 3,
    burden: 2,
    features: 'Flexible (+1 Evasión)',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 6 / Severo 13 (+ Nivel) | +3 Slots de Armadura | Carga: 2. Blindaje reforzado de trabajo agrícola y rescate.'
  },
  {
    id: 'core_ar_heavy_combat_suit',
    name: 'Combat Armor / Armadura de Combate Orbital',
    source: 'core',
    category: 'armor',
    tier: 'Military (TT2)',
    majorThreshold: 8,
    severeThreshold: 16,
    armorSlots: 3,
    burden: 2,
    features: 'Resilient',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 8 / Severo 16 (+ Nivel) | +3 Slots de Armadura | Carga: 2. Estándar para soldados galácticos.'
  },
  {
    id: 'core_ar_composite_armor',
    name: 'Composite Armor / Armadura Compuesta',
    source: 'core',
    category: 'armor',
    tier: 'Military (TT2)',
    majorThreshold: 8,
    severeThreshold: 16,
    armorSlots: 4,
    burden: 2,
    features: 'Composite, Resilient',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 8 / Severo 16 (+ Nivel) | +4 Slots de Armadura | Carga: 2. Capas laminadas que disipan impactos contundentes (Crushing).'
  },
  {
    id: 'core_ar_security_armor',
    name: 'Security Armor / Blindaje de Seguridad',
    source: 'core',
    category: 'armor',
    tier: 'Military (TT2)',
    majorThreshold: 7,
    severeThreshold: 14,
    armorSlots: 4,
    burden: 2,
    features: 'Resilient',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 7 / Severo 14 (+ Nivel) | +4 Slots de Armadura | Carga: 2. Utilizada por ejecutores corporativos y policía orbital.'
  },
  {
    id: 'core_ar_colony_defense',
    name: 'Colony Defense Armor / Blindaje Colonial',
    source: 'core',
    category: 'armor',
    tier: 'Military (TT2)',
    majorThreshold: 8,
    severeThreshold: 17,
    armorSlots: 5,
    burden: 2,
    features: 'Fortified',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 8 / Severo 17 (+ Nivel) | +5 Slots de Armadura | Carga: 2. Fortified: al gastar 1 slot de armadura reduce 2 escalones de severidad.'
  },
  {
    id: 'core_ar_tactical_armor',
    name: 'Tactical Armor / Armadura Táctica',
    source: 'core',
    category: 'armor',
    tier: 'Experimental (TT3)',
    majorThreshold: 10,
    severeThreshold: 20,
    armorSlots: 5,
    burden: 2,
    features: 'Tactical (+1 Instinto), Reflective',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 10 / Severo 20 (+ Nivel) | +5 Slots de Armadura | Carga: 2. Reflective: anula la penetración de daño de Energía.'
  },
  {
    id: 'core_ar_assault_armor',
    name: 'Assault Armor / Armadura de Asalto',
    source: 'core',
    category: 'armor',
    tier: 'Experimental (TT3)',
    majorThreshold: 11,
    severeThreshold: 22,
    armorSlots: 5,
    burden: 2,
    features: 'Assault (+1 en armas automáticas)',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 11 / Severo 22 (+ Nivel) | +5 Slots de Armadura | Carga: 2. Primera línea de asalto táctico.'
  },
  {
    id: 'core_ar_marine_armor',
    name: 'Marine Armor / Armadura de Marines',
    source: 'core',
    category: 'armor',
    tier: 'Experimental (TT3)',
    majorThreshold: 12,
    severeThreshold: 24,
    armorSlots: 5,
    burden: 2,
    features: 'Resilient, Environmental',
    cost: '16 Cr',
    use: '🛡️ Umbrales: Mayor 12 / Severo 24 (+ Nivel) | +5 Slots de Armadura | Carga: 2. Abordaje de naves espaciales, sellado hermético.'
  },
  {
    id: 'core_ar_power_rig',
    name: 'Powered Armor / Servoarmadura (Power Rig)',
    source: 'core',
    category: 'armor',
    tier: 'Experimental (TT3)',
    majorThreshold: 13,
    severeThreshold: 28,
    armorSlots: 6,
    burden: 2,
    features: 'Powered',
    cost: '16 Cr',
    use: '🛡️ Umbrales: Mayor 13 / Severo 28 (+ Nivel) | +6 Slots de Armadura | Carga: 2. Servomotores integrados que anulan penalizaciones de peso.'
  },

  // ==========================================
  // COREBOOK: HEAVY ARMOR
  // ==========================================
  {
    id: 'core_ar_riot_armor',
    name: 'Riot Armor / Armadura Antidisturbios',
    source: 'core',
    category: 'armor',
    tier: 'Military (TT2)',
    majorThreshold: 8,
    severeThreshold: 17,
    armorSlots: 5,
    burden: 3,
    features: 'Heavy (-1 Evasión), Fortified',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 8 / Severo 17 (+ Nivel) | +5 Slots de Armadura | Carga: 3. Fortified reduce 2 escalones por slot. Heavy (-1 Evasión).'
  },
  {
    id: 'core_ar_salvage_armor',
    name: 'Salvage Armor / Armadura de Chatarrero',
    source: 'core',
    category: 'armor',
    tier: 'Common (TT1)',
    majorThreshold: 7,
    severeThreshold: 15,
    armorSlots: 6,
    burden: 3,
    features: 'Heavy (-1 Evasión), Jury-rigged',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 7 / Severo 15 (+ Nivel) | +6 Slots de Armadura | Carga: 3. Reparable sin taller con chatarra común.'
  },
  {
    id: 'core_ar_industrial_exosuit',
    name: 'Industrial Exosuit / Exoesqueleto Industrial',
    source: 'core',
    category: 'armor',
    tier: 'Military (TT2)',
    majorThreshold: 8,
    severeThreshold: 16,
    armorSlots: 7,
    burden: 3,
    features: 'Very Heavy (-2 Evasión), Powered',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 8 / Severo 16 (+ Nivel) | +7 Slots de Armadura | Carga: 3. Estructura de carga pesada de gran absorción.'
  },
  {
    id: 'core_ar_battle_armor',
    name: 'Battle Armor / Armadura de Batalla',
    source: 'core',
    category: 'armor',
    tier: 'Experimental (TT3)',
    majorThreshold: 13,
    severeThreshold: 27,
    armorSlots: 7,
    burden: 4,
    features: 'Heavy (-1 Evasión), Fortified',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 13 / Severo 27 (+ Nivel) | +7 Slots de Armadura | Carga: 4. Armadura pesada insignia de las Grandes Casas.'
  },
  {
    id: 'core_ar_power_armor_heavy',
    name: 'Heavy Power Armor / Armadura de Poder Pesada',
    source: 'core',
    category: 'armor',
    tier: 'Experimental (TT3)',
    majorThreshold: 15,
    severeThreshold: 30,
    armorSlots: 8,
    burden: 4,
    features: 'Very Heavy, Powered',
    cost: '25 Cr',
    use: '🛡️ Umbrales: Mayor 15 / Severo 30 (+ Nivel) | +8 Slots de Armadura | Carga: 4. Auténtico tanque andante post-Silencio.'
  },
  {
    id: 'core_ar_siege_armor',
    name: 'Siege Armor / Blindaje de Asedio',
    source: 'core',
    category: 'armor',
    tier: 'Experimental (TT3)',
    majorThreshold: 16,
    severeThreshold: 32,
    armorSlots: 8,
    burden: 5,
    features: 'Very Heavy, Massive',
    cost: '25 Cr',
    use: '🛡️ Umbrales: Mayor 16 / Severo 32 (+ Nivel) | +8 Slots de Armadura | Carga: 5. Massive: al gastar slot, 1d6 (5-6 reduce otro escalón).'
  },

  // ==========================================
  // COREBOOK: SHIELDS & HAZARD GEAR
  // ==========================================
  {
    id: 'core_ar_kinetic_shield',
    name: 'Generador de Escudo Cinético Personal',
    source: 'core',
    category: 'armor',
    tier: 'Military (TT2)',
    majorThreshold: 0,
    severeThreshold: 0,
    armorSlots: 1,
    burden: 1,
    features: 'Escudo Deflector Recargable',
    cost: '4 Cr',
    use: '🛡️ Otorga +1 Slot de Armadura/Escudo deflector recargable en cinturón. Se suma a los slots existentes.'
  },
  {
    id: 'core_ar_hazard_suit',
    name: 'Traje de Aislamiento NBQ / Vacío',
    source: 'core',
    category: 'armor',
    tier: 'Common (TT1)',
    majorThreshold: 6,
    severeThreshold: 13,
    armorSlots: 4,
    burden: 2,
    features: 'Hazard-Sealed, Life Support (24h)',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 6 / Severo 13 (+ Nivel) | +4 Slots de Armadura | Carga: 2. Inmunidad a radiación y atmósferas corrosivas.'
  },

  // ==========================================
  // RUST & STEEL: HOUSES & ALIEN SPECIES ARMOR
  // ==========================================
  {
    id: 'rs_ar_lithian_silicate',
    name: 'Coraza de Cristal Silíceo Lithian',
    source: 'rust_and_steel',
    category: 'armor',
    species: 'Lithian',
    tier: 'Tier 2 · Lithian',
    majorThreshold: 8,
    severeThreshold: 15,
    armorSlots: 5,
    burden: 3,
    features: 'Refractaria, Resistencia Plasma/Fuego',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 8 / Severo 15 (+ Nivel) | +5 Slots de Armadura | Carga: 3. Placas minerales refractarias que absorben calor extremo.'
  },
  {
    id: 'rs_ar_chitin_carapace',
    name: 'Exoesqueleto de Quitina Endurecida',
    source: 'rust_and_steel',
    category: 'armor',
    species: 'Chitinid',
    tier: 'Tier 2 · Chitinid',
    majorThreshold: 7,
    severeThreshold: 14,
    armorSlots: 5,
    burden: 2,
    features: 'Biopolímeros, Regeneración de quitina',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 7 / Severo 14 (+ Nivel) | +5 Slots de Armadura | Carga: 2. Regenera 1 slot de armadura automáticamente tras cada descanso.'
  },
  {
    id: 'rs_ar_thermo_sink_plating',
    name: 'Blindaje Térmico Disipador Sintético',
    source: 'rust_and_steel',
    category: 'armor',
    species: 'Synthet',
    tier: 'Tier 1 · Synthet',
    majorThreshold: 6,
    severeThreshold: 13,
    armorSlots: 4,
    burden: 2,
    features: 'Canales Refrigerantes, Hazard-Sealed',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 6 / Severo 13 (+ Nivel) | +4 Slots de Armadura | Carga: 2. Revestimiento cerámico disipador de sobrecalentamientos.'
  },
  {
    id: 'rs_ar_sun_touched',
    name: 'Sun-Touched Cuirass (House Solari)',
    source: 'rust_and_steel',
    category: 'armor',
    tier: 'Tier 3 · Solari',
    majorThreshold: 9,
    severeThreshold: 17,
    armorSlots: 6,
    burden: 3,
    features: 'Inspiring, Dazzling, Climate-Controlled',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 9 / Severo 17 (+ Nivel) | +6 Slots de Armadura | Carga: 3. Dazzling: cega a enemigos a rango Close (DC 15).'
  },
  {
    id: 'rs_ar_dawn_regalia',
    name: 'Dawn Regalia (House Solari)',
    source: 'rust_and_steel',
    category: 'armor',
    tier: 'Tier 4 · Solari',
    majorThreshold: 11,
    severeThreshold: 20,
    armorSlots: 7,
    burden: 4,
    features: 'Solar Absorption, Flight (Limited), Social',
    cost: '16 Cr',
    use: '🛡️ Umbrales: Mayor 11 / Severo 20 (+ Nivel) | +7 Slots de Armadura | Carga: 4. Vuelo antigravitatorio y absorción de energía solar.'
  },
  {
    id: 'rs_ar_scrap_plate',
    name: 'Scrap-Plate Armor (House Volkov)',
    source: 'rust_and_steel',
    category: 'armor',
    tier: 'Tier 2 · Volkov',
    majorThreshold: 10,
    severeThreshold: 18,
    armorSlots: 6,
    burden: 4,
    features: 'Intimidating, Spiked, Jury-Rigged',
    cost: '4 Cr',
    use: '🛡️ Umbrales: Mayor 10 / Severo 18 (+ Nivel) | +6 Slots de Armadura | Carga: 4. Blindaje pesado de chatarrería de asalto brutal.'
  },
  {
    id: 'rs_ar_iron_tyrant',
    name: 'Iron Tyrant Plate (House Volkov)',
    source: 'rust_and_steel',
    category: 'armor',
    tier: 'Tier 3 · Volkov',
    majorThreshold: 12,
    severeThreshold: 22,
    armorSlots: 8,
    burden: 6,
    features: 'Intimidating, Terror, Rage-Fueled (+1 daño melee con 3+ Estrés)',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 12 / Severo 22 (+ Nivel) | +8 Slots de Armadura | Carga: 6. Requiere Fuerza +2.'
  },
  {
    id: 'rs_ar_shadow_weave',
    name: 'Shadow Weave (House Valerius)',
    source: 'rust_and_steel',
    category: 'armor',
    tier: 'Tier 3 · Valerius',
    majorThreshold: 6,
    severeThreshold: 13,
    armorSlots: 4,
    burden: 1,
    features: 'Silent, Thermoptic Camouflage, Flexible (+1 Evasión)',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 6 / Severo 13 (+ Nivel) | +4 Slots de Armadura | Carga: 1. Sigilo de infiltración y fundas ocultas para hojas.'
  },
  {
    id: 'rs_ar_joric_battle_plate',
    name: 'Joric Standard Battle Plate (House Joric)',
    source: 'rust_and_steel',
    category: 'armor',
    tier: 'Tier 3 · Joric',
    majorThreshold: 12,
    severeThreshold: 21,
    armorSlots: 8,
    burden: 5,
    features: 'Ablative (4), Environmental, Reactive Plating',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 12 / Severo 21 (+ Nivel) | +8 Slots de Armadura | Carga: 5. Requiere Fuerza +2. Capas ablativas que absorben fuego concentrado.'
  },
  {
    id: 'rs_ar_centurion_siege',
    name: 'Centurion Siege Armor (House Joric)',
    source: 'rust_and_steel',
    category: 'armor',
    tier: 'Tier 4 · Joric',
    majorThreshold: 15,
    severeThreshold: 28,
    armorSlots: 12,
    burden: 7,
    features: 'Ablative (6), Hardened (All), Last Stand, Servo-Assisted',
    cost: '25 Cr',
    use: '🛡️ Umbrales: Mayor 15 / Severo 28 (+ Nivel) | +12 Slots de Armadura | Carga: 7. Last Stand: permite 1 acción final al caer a 0 HP.'
  },
  {
    id: 'rs_ar_collectors_carapace',
    name: 'Collector\'s Carapace (House Amaranth)',
    source: 'rust_and_steel',
    category: 'armor',
    tier: 'Tier 3 · Amaranth',
    majorThreshold: 8,
    severeThreshold: 15,
    armorSlots: 5,
    burden: 3,
    features: 'Integrated Stun System, Specimen Containers, Hazard-Sealed',
    cost: '9 Cr',
    use: '🛡️ Umbrales: Mayor 8 / Severo 15 (+ Nivel) | +5 Slots de Armadura | Carga: 3. Emisores de descarga no letal y contenedores de éxtasis.'
  },

  // ==========================================
  // COREBOOK & RUST & STEEL: WEAPONS
  // ==========================================
  // --- MELEE WEAPONS ---
  {
    id: 'core_wp_combat_knife',
    name: 'Cuchillo Táctico de Combate',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Finesse',
    damage: '1d6 phys.',
    damageType: 'Physical',
    range: 'Melee',
    burden: 1,
    features: 'Paired (puede empuñarse por pares)',
    cost: '1 Cr'
  },
  {
    id: 'core_wp_stun_baton',
    name: 'Porra de Choque Neuro-Eléctrica',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Strength',
    damage: '1d6+1 phys.',
    damageType: 'Physical',
    range: 'Melee',
    burden: 1,
    features: 'Stunning (aturdimiento en impacto), Paired+1',
    cost: '1 Cr'
  },
  {
    id: 'core_wp_plasma_cutter',
    name: 'Cortador de Micro-Plasma Industrial',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Agility',
    damage: '1d8 ene.',
    damageType: 'Energy',
    range: 'Melee',
    burden: 1,
    features: 'Cutting (perfora blindajes ligeros), Paired+2',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_monoblade',
    name: 'Hoja de Monofilamento',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Finesse',
    damage: '1d8 phys.',
    damageType: 'Physical',
    range: 'Melee',
    burden: 1,
    features: 'Armor Piercing (reduce umbrales en 2), Paired+2',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_energy_dagger',
    name: 'Daga de Energía Pura',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Agility',
    damage: '1d6+1 ene.',
    damageType: 'Energy',
    range: 'Melee',
    burden: 1,
    features: 'Lightweight, Energy Tag',
    cost: '1 Cr'
  },
  {
    id: 'core_wp_vibro_sword',
    name: 'Vibro-Espada Militar',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Strength',
    damage: '1d8+3 phys.',
    damageType: 'Physical',
    range: 'Melee',
    burden: 1,
    features: 'Vibration (ignora 1 slot de armadura)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_chainglaive',
    name: 'Chainglaive de Asalto Volkov',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Strength',
    damage: '1d10+3 phys.',
    damageType: 'Physical',
    range: 'Melee',
    burden: 2,
    features: 'Automatic, Cleave (golpea a dos objetivos adyacentes)',
    cost: '9 Cr'
  },
  {
    id: 'core_wp_plasma_rapier',
    name: 'Estoque de Plasma Solari',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Finesse',
    damage: '1d8+3 ene.',
    damageType: 'Energy',
    range: 'Melee',
    burden: 1,
    features: 'Piercing, Overheating',
    cost: '9 Cr'
  },
  {
    id: 'core_wp_gravity_hammer',
    name: 'Martillo Gravítico Concusivo',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Strength',
    damage: '1d10+3 phys.',
    damageType: 'Physical',
    range: 'Melee',
    burden: 2,
    features: 'Stagger (desventaja en siguiente acción del objetivo)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_electro_whip',
    name: 'Látigo de Descarga Neural',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Agility',
    damage: '1d6+3 ene.',
    damageType: 'Energy',
    range: 'Very Close',
    burden: 1,
    features: 'Reach Very Close, Stunning en Crítico',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_phase_blade',
    name: 'Espada de Fase Dimensional',
    source: 'core',
    category: 'weapons',
    tier: 'Experimental (TT3)',
    trait: 'Finesse',
    damage: '1d8+6 void',
    damageType: 'Void',
    range: 'Melee',
    burden: 1,
    features: 'Phasing (ignora 1 slot de armadura, Penetración -4)',
    cost: '9 Cr'
  },
  {
    id: 'core_wp_void_cleaver',
    name: 'Cuchilla de Ruptura del Vacío',
    source: 'core',
    category: 'weapons',
    tier: 'Experimental (TT3)',
    trait: 'Strength',
    damage: '1d10+6 void',
    damageType: 'Void',
    range: 'Melee',
    burden: 2,
    features: 'Disintegrating (destruye slots de armadura en daño máximo)',
    cost: '9 Cr'
  },

  // --- PISTOLS ---
  {
    id: 'core_wp_kinetic_pistol',
    name: 'Pistola Cinética Militar (Slug Pistol)',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Agility',
    damage: '1d8+1 phys.',
    damageType: 'Physical',
    range: 'Close',
    burden: 1,
    features: 'Reliable (fiable en barro, lluvia y vacío)',
    cost: '1 Cr'
  },
  {
    id: 'core_wp_flechette_pistol',
    name: 'Pistola de Flechillas Perforantes',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Finesse',
    damage: '1d6+1 phys.',
    damageType: 'Physical',
    range: 'Close',
    burden: 1,
    features: 'Armor Piercing',
    cost: '1 Cr'
  },
  {
    id: 'core_wp_plasma_pistol',
    name: 'Pistola de Plasma Portátil',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Instinct',
    damage: '1d8 ene.',
    damageType: 'Energy',
    range: 'Close',
    burden: 1,
    features: 'Overheating (sobrecalentamiento con tirada de Miedo)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_needle_gun',
    name: 'Pistola de Agujas Tóxicas',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Finesse',
    damage: '1d6+1 phys.',
    damageType: 'Physical',
    range: 'Close',
    burden: 1,
    features: 'Poison (aplica condición Poisoned)',
    cost: '1 Cr'
  },
  {
    id: 'core_wp_combat_pistol',
    name: 'Pistola de Combate Rápida',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Agility',
    damage: '1d8+3 phys.',
    damageType: 'Physical',
    range: 'Close',
    burden: 1,
    features: 'Quick (dos disparos en rápida sucesión)',
    cost: '1 Cr'
  },
  {
    id: 'core_wp_gauss_pistol',
    name: 'Pistola Gauss Silenciada',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Finesse',
    damage: '1d8+3 phys.',
    damageType: 'Physical',
    range: 'Close',
    burden: 1,
    features: 'Silent (disparo hipersónico inaudible)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_disruptor_pistol',
    name: 'Pistola Disruptora de Escudos',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Knowledge',
    damage: '1d8+3 ene.',
    damageType: 'Energy',
    range: 'Close',
    burden: 1,
    features: 'Shield Piercing (tritura slots de escudos)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_phase_pistol',
    name: 'Pistola de Fase del Velo',
    source: 'core',
    category: 'weapons',
    tier: 'Experimental (TT3)',
    trait: 'Knowledge',
    damage: '1d8+6 void',
    damageType: 'Void',
    range: 'Close',
    burden: 1,
    features: 'Phasing (ignora cobertura, Penetración -4)',
    cost: '9 Cr'
  },
  {
    id: 'core_wp_void_pistol',
    name: 'Pistola de Micro-Singularidad',
    source: 'core',
    category: 'weapons',
    tier: 'Experimental (TT3)',
    trait: 'Presence',
    damage: '1d6+6 void',
    damageType: 'Void',
    range: 'Close',
    burden: 1,
    features: 'Disintegrating (arma de asesinos de Kurogane)',
    cost: '9 Cr'
  },

  // --- RIFLES & HEAVY WEAPONS ---
  {
    id: 'core_wp_assault_rifle',
    name: 'Rifle de Asalto Automático',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Strength',
    damage: '1d8+1 phys.',
    damageType: 'Physical',
    range: 'Close',
    burden: 2,
    features: 'Automatic (fuego selectivo y supresión)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_sniper_rifle',
    name: 'Rifle de Francotirador Balístico',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Finesse',
    damage: '1d8+1 phys.',
    damageType: 'Physical',
    range: 'Far',
    burden: 2,
    features: 'Accurate (precisión a larga distancia)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_gauss_rifle',
    name: 'Rifle Gauss de Aceleración',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Agility',
    damage: '1d6+1 phys.',
    damageType: 'Physical',
    range: 'Far',
    burden: 2,
    features: 'Armor Piercing',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_battle_rifle',
    name: 'Rifle de Batalla Pesado Joric',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Strength',
    damage: '1d10+3 phys.',
    damageType: 'Physical',
    range: 'Close',
    burden: 2,
    features: 'Powerful (alto calibre, atraviesa coberturas)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_sniper_system',
    name: 'Sistema Táctico de Francotirador',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Finesse',
    damage: '1d8+3 phys.',
    damageType: 'Physical',
    range: 'Very Far',
    burden: 2,
    features: 'Smart Scope (mira computarizada y telémetro)',
    cost: '9 Cr'
  },
  {
    id: 'core_wp_plasma_carbine',
    name: 'Carabina de Plasma Militar',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Instinct',
    damage: '1d8+3 ene.',
    damageType: 'Energy',
    range: 'Close',
    burden: 2,
    features: 'Stable (sin riesgo de sobrecalentamiento)',
    cost: '9 Cr'
  },
  {
    id: 'core_wp_machine_gun',
    name: 'Ametralladora de Escuadra Ligera',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Strength',
    damage: '1d6+3 phys.',
    damageType: 'Physical',
    range: 'Far',
    burden: 2,
    features: 'Automatic',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_heavy_machine_gun',
    name: 'Ametralladora Pesada de Trípode',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Strength',
    damage: '1d6+6 phys.',
    damageType: 'Physical',
    range: 'Far',
    burden: 2,
    features: 'Suppressive (fija escuadras enteras)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_rocket_launcher',
    name: 'Lanzacohetes Antiblindaje',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Agility',
    damage: '1d10+3 phys.',
    damageType: 'Physical',
    range: 'Far',
    burden: 2,
    features: 'Explosive (daño en área)',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_railgun',
    name: 'Cañón de Riel Hipersónico',
    source: 'core',
    category: 'weapons',
    tier: 'Common (TT1)',
    trait: 'Strength',
    damage: '1d8+3 phys.',
    damageType: 'Physical',
    range: 'Far',
    burden: 2,
    features: 'Massive',
    cost: '4 Cr'
  },
  {
    id: 'core_wp_fusion_cannon',
    name: 'Cañón de Fusión Concentrada',
    source: 'core',
    category: 'weapons',
    tier: 'Military (TT2)',
    trait: 'Instinct',
    damage: '1d10+9 ene.',
    damageType: 'Energy',
    range: 'Far',
    burden: 2,
    features: 'Devastating (reacción de fusión contenida)',
    cost: '16 Cr'
  },
  {
    id: 'rs_wp_lithian_hammer',
    name: 'Martillo de Resonancia Sísmica Lithian',
    source: 'rust_and_steel',
    category: 'weapons',
    species: 'Lithian',
    tier: 'Tier 2 · Lithian',
    trait: 'Strength',
    damage: '1d10+3 phys.',
    damageType: 'Physical',
    range: 'Melee',
    burden: 2,
    features: 'Resonancia sísmica, Shrewd',
    cost: '4 Cr'
  },
  {
    id: 'rs_wp_kryllian_wrist_blade',
    name: 'Cuchilla Oculta de Muñeca Kryllian',
    source: 'rust_and_steel',
    category: 'weapons',
    species: 'Kryllian',
    tier: 'Tier 2 · Kryllian',
    trait: 'Agility',
    damage: '1d6+3 phys.',
    damageType: 'Physical',
    range: 'Melee',
    burden: 1,
    features: 'Oculta en extremidad, Veneno paralizante en crítico',
    cost: '4 Cr'
  },
  {
    id: 'rs_wp_voidborn_blade',
    name: 'Cuchilla Dimensional del Vacío',
    source: 'rust_and_steel',
    category: 'weapons',
    species: 'Voidborn',
    tier: 'Tier 2 · Voidborn',
    trait: 'Agility',
    damage: '1d8+3 void',
    damageType: 'Void',
    range: 'Melee',
    burden: 1,
    features: 'Corte de fase (ignora 1 punto de armadura)',
    cost: '4 Cr'
  },
  {
    id: 'rs_wp_synther_arm_blaster',
    name: 'Bláster Oculto de Brazo Sintético',
    source: 'rust_and_steel',
    category: 'weapons',
    species: 'Synthet',
    tier: 'Tier 2 · Synthet',
    trait: 'Finesse',
    damage: '1d8+1 ene.',
    damageType: 'Energy',
    range: 'Close',
    burden: 1,
    features: 'Implante subdérmico, Despliegue en fracción de segundo',
    cost: '4 Cr'
  },

  // ==========================================
  // COREBOOK & RUST & STEEL: AUGMENTATIONS
  // ==========================================
  {
    id: 'core_aug_memory_chip',
    name: 'Chip de Memoria Eidética',
    source: 'core',
    category: 'augmentations',
    tier: 'Common (TT1)',
    augmentCost: 1,
    stressCost: 0,
    benefit: 'Memoria perfecta de todo lo presenciado; +1 en tiradas de Conocimiento para recordar o analizar.',
    drawback: 'Ecos de datos / visiones del pasado (narrativo).',
    cost: '4 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 0. Memoria perfecta y +1 en Conocimiento para análisis.'
  },
  {
    id: 'core_aug_pain_suppressor',
    name: 'Supresor Neuro-Químico de Dolor',
    source: 'core',
    category: 'augmentations',
    tier: 'Common (TT1)',
    augmentCost: 1,
    stressCost: 0,
    benefit: '1 vez/escena, tras recibir un impacto que marque 2+ HP, limpia 1 Estrés.',
    drawback: 'El jugador siempre conoce sus HP reales.',
    cost: '4 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 0. 1 vez/escena tras sufrir 2+ HP de daño, limpia 1 Estrés.'
  },
  {
    id: 'core_aug_combat_reflexes',
    name: 'Reflejos de Combate Acelerados',
    source: 'core',
    category: 'augmentations',
    tier: 'Military (TT2)',
    augmentCost: 1,
    stressCost: 1,
    benefit: '+1 a la Evasión pasiva.',
    drawback: 'Alerta extrema continua; Desventaja en reposo.',
    cost: '16 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 1. +1 Evasión pasiva del personaje.'
  },
  {
    id: 'core_aug_combat_precognition',
    name: 'Módulo de Pre-Cognición Táctica',
    source: 'core',
    category: 'augmentations',
    tier: 'Experimental (TT3)',
    augmentCost: 1,
    stressCost: 1,
    benefit: '1 vez/escena, marca 1 Estrés: Ventaja en 1 ataque o tirada de reacción en combate.',
    drawback: 'Desventaja en tiradas de Presencia en escenas sociales.',
    cost: '16 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 1. Ventaja en un ataque o reacción de combate por escena.'
  },
  {
    id: 'core_aug_subdermal_armor',
    name: 'Blindaje Subdérmico de Grafeno',
    source: 'core',
    category: 'augmentations',
    tier: 'Common (TT1)',
    augmentCost: 1,
    stressCost: 0,
    benefit: '+1 Slot Máximo de Armadura/Escudos.',
    drawback: 'Patrones metálicos evidentes bajo la piel.',
    cost: '9 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 0. Concede +1 slot adicional a la armadura máxima.'
  },
  {
    id: 'core_aug_reinforced_bones',
    name: 'Osificación Compuesta Reforzada',
    source: 'core',
    category: 'augmentations',
    tier: 'Common (TT1)',
    augmentCost: 1,
    stressCost: 0,
    benefit: '+2 HP Máximos.',
    drawback: 'Mayor masa corporal (-1 en nadar/escalar).',
    cost: '9 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 0. Incrementa la vitalidad máxima en +2 HP.'
  },
  {
    id: 'core_aug_toxin_filter',
    name: 'Filtro Hepático Bio-Sintético',
    source: 'core',
    category: 'augmentations',
    tier: 'Common (TT1)',
    augmentCost: 1,
    stressCost: 0,
    benefit: 'Inmunidad total a toxinas y venenos (ignora condición Poisoned).',
    drawback: 'Curación médica a la mitad de velocidad.',
    cost: '1 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 0. Inmunidad a toxinas y venenos.'
  },
  {
    id: 'core_aug_prosthetic_limb',
    name: 'Extremidad Cibernética Reforzada',
    source: 'core',
    category: 'augmentations',
    tier: 'Common (TT1)',
    augmentCost: 1,
    stressCost: 0,
    benefit: '+1 al atributo de Fuerza.',
    drawback: 'Requiere mantenimiento periódico.',
    cost: '4 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 0. Reemplazo cibernético con servomotores (+1 Fuerza).'
  },
  {
    id: 'core_aug_enhanced_reflexes',
    name: 'Acelerador Sináptico de Agilidad',
    source: 'core',
    category: 'augmentations',
    tier: 'Military (TT2)',
    augmentCost: 1,
    stressCost: 1,
    benefit: '+2 al atributo de Agilidad.',
    drawback: 'Hiperactividad nerviosa.',
    cost: '16 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 1. Acelera la velocidad motora (+2 Agilidad).'
  },
  {
    id: 'core_aug_sensory_package',
    name: 'Conjunto Sensorial de Banda Ancha',
    source: 'core',
    category: 'augmentations',
    tier: 'Military (TT2)',
    augmentCost: 1,
    stressCost: 1,
    benefit: '+2 al atributo de Instinto.',
    drawback: 'Sobrecarga sensorial en aglomeraciones.',
    cost: '16 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 1. Espectro electromagnético e infrarrojo (+2 Instinto).'
  },
  {
    id: 'core_aug_subdermal_camo',
    name: 'Camuflaje Subdérmico Cromático',
    source: 'core',
    category: 'augmentations',
    tier: 'Common (TT1)',
    augmentCost: 1,
    stressCost: 0,
    benefit: '+1 en tiradas de Agilidad para evitar detección visual.',
    drawback: 'Tinte brillante perceptible bajo luz intensa.',
    cost: '4 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 0. Pigmentos adaptativos bajo la piel (+1 en sigilo).'
  },
  {
    id: 'rs_aug_drone_link_jack',
    name: 'Conector Neural de Enlace con Drones',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Universal',
    tier: 'Tier 2 · Aumento',
    augmentCost: 1,
    stressCost: 0,
    benefit: 'Toma craneal directa para enlazar y dar órdenes a drones como acción gratuita.',
    drawback: 'Requiere implante en la base del cráneo.',
    cost: '4 Cr',
    use: '🧬 Capacidad: 1 pt | Coste Estrés: 0. Permite impartir órdenes tácticas a drones sin gastar acción.'
  },

  // ==========================================
  // COREBOOK: DRONE MODULES
  // ==========================================
  {
    id: 'drone_mod_extended_link',
    name: 'Extended Link / Enlace de Rango Extendido',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '2 Cr',
    effect: 'Mejora la señal en 1 escalón (Inestable a Estable) ante distancia o mamparos.',
    use: '🤖 Ranuras: 1 Slot. Mantiene la señal del operador estable a mayor distancia.'
  },
  {
    id: 'drone_mod_relay_node',
    name: 'Relay Node / Nodo Repetidor de Señal',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '2 Cr',
    effect: 'Actúa como repetidor local para la tripulación u otros drones en la escena.',
    use: '🤖 Ranuras: 1 Slot. Permite retransmitir señales a través del dron.'
  },
  {
    id: 'drone_mod_neural_network_control',
    name: 'Neural Network Control / Control de Red Compartido',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 0,
    cost: '1 Cr',
    effect: 'Permite a múltiples tripulantes registrados alternar el control del dron por turnos.',
    use: '🤖 Ranuras: 0 Slots (No consume espacio). Habilita el control multi-jugador simultáneo del dron.'
  },
  {
    id: 'drone_mod_basic_autonomy',
    name: 'Basic Autonomy Chip / Chip de Autonomía Básica',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '4 Cr',
    effect: 'Si la señal se pierde, ejecuta 1 protocolo precargado (Volver, Grabar, Patrullar).',
    use: '🤖 Ranuras: 1 Slot. Evita que el dron se congele al perder la conexión.'
  },
  {
    id: 'drone_mod_flight',
    name: 'Flight Module / Módulo de Vuelo y Levitación',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '2 Cr',
    effect: 'Vuelo táctico y suspensión en aire (-2 a tiradas de sigilo durante el vuelo).',
    use: '🤖 Ranuras: 1 Slot. Concede capacidad de vuelo a baja velocidad sobre obstáculos.'
  },
  {
    id: 'drone_mod_mil_flight',
    name: 'Military Flight Module / Propulsor Táctico Militar',
    source: 'core',
    category: 'drone_modules',
    tier: 'Military',
    slots: 1,
    cost: '6 Cr',
    effect: '+1 en maniobras, evasión y pilotaje en vuelo (-2 en sigilo sonoro).',
    use: '🤖 Ranuras: 1 Slot. Vuelo militar avanzado de alta maniobrabilidad.'
  },
  {
    id: 'drone_mod_wall_crawler',
    name: 'Wall-Crawler / Trepamuros Magnético',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '1 Cr',
    effect: 'Trepa paredes, techos, conductos de ventilación y mamparos sin hacer ruido.',
    use: '🤖 Ranuras: 1 Slot. Permite adherirse a superficies verticales e invertidas.'
  },
  {
    id: 'drone_mod_cargo_grip',
    name: 'Cargo Grip / Garra de Carga Ligera',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '1 Cr',
    effect: 'Sujeta y transporta objetos pequeños, muestras o llaves de acceso.',
    use: '🤖 Ranuras: 1 Slot. Manipulador de transporte de objetos pequeños.'
  },
  {
    id: 'drone_mod_low_light_camera',
    name: 'Low-Light Camera / Cámara Nocturna',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '1 Cr',
    effect: 'Ignora penalizaciones por oscuridad y humo en la visión del dron.',
    use: '🤖 Ranuras: 1 Slot. Visión nítida en entornos de baja iluminación.'
  },
  {
    id: 'drone_mod_thermal_camera',
    name: 'Thermal Camera / Óptica Térmica Infrarroja',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '2 Cr',
    effect: 'Detecta firmas térmicas a través de humo o coberturas ligeras.',
    use: '🤖 Ranuras: 1 Slot. Revela enemigos o componentes sobrecalentados.'
  },
  {
    id: 'drone_mod_target_painter',
    name: 'Target Painter / Puntero Láser Designador',
    source: 'core',
    category: 'drone_modules',
    tier: 'Military',
    slots: 1,
    cost: '4 Cr',
    effect: 'Acción de operador: marca un objetivo visible; el siguiente ataque aliado gana Ventaja.',
    use: '🤖 Ranuras: 1 Slot. Apunta a un enemigo para coordinar fuego concentrado.'
  },
  {
    id: 'drone_mod_manipulator_arm',
    name: 'Manipulator Arm / Brazo Articulado de Precisión',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '1 Cr',
    effect: 'Permite abrir puertas, conectar cables de datos o pulsar interruptores.',
    use: '🤖 Ranuras: 1 Slot. Interacción física a distancia para el operador.'
  },
  {
    id: 'drone_mod_medgel_injector',
    name: 'Medgel Injector / Inyector Remoto de Medigel',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '2 Cr',
    effect: 'Acción de operador: estabiliza a un aliado moribundo a distancia.',
    use: '🤖 Ranuras: 1 Slot. Estabilización de trauma en combate sin exponer al médico.'
  },
  {
    id: 'drone_mod_stealth_shell',
    name: 'Stealth Shell / Blindaje de Absorción de Radar',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '4 Cr',
    effect: '+1 en tiradas de Agilidad para sigilo mientras esté en tierra.',
    use: '🤖 Ranuras: 1 Slot. Recubrimiento mate que disipa reflejos y radar.'
  },
  {
    id: 'drone_mod_agile_servos',
    name: 'Agile Servos / Servomotores Evasivos',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 1,
    cost: '4 Cr',
    effect: '+1 a la Evasión pasiva del dron.',
    use: '🤖 Ranuras: 1 Slot. Maniobrabilidad rápida para esquivar disparos.'
  },
  {
    id: 'drone_mod_armor_plating',
    name: 'Armor Plating / Blindaje Adicional Reforzado',
    source: 'core',
    category: 'drone_modules',
    tier: 'Military',
    slots: 1,
    cost: '4 Cr',
    effect: '+1 Slot de Armadura (-1 Evasión en vuelo o maniobras estrechas).',
    use: '🤖 Ranuras: 1 Slot. Placas protectoras para operaciones en zonas de fuego.'
  },
  {
    id: 'drone_mod_compliance_taser',
    name: 'Compliance Taser / Taser de Reducción',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 2,
    cost: '4 Cr',
    effect: 'Ataque Close no letal: causa 1 Estrés y desestabiliza al objetivo.',
    use: '🤖 Ranuras: 2 Slots. Dispositivo de descarga no letal para neutralización.'
  },
  {
    id: 'drone_mod_stun_dart',
    name: 'Stun Dart Launcher / Lanzadardos Paralizantes',
    source: 'core',
    category: 'drone_modules',
    tier: 'Common',
    slots: 2,
    cost: '4 Cr',
    effect: 'Ataque Close/Far: causa 1d6 daño físico no letal o 1 Estrés.',
    use: '🤖 Ranuras: 2 Slots. Proyectiles químicos para capturar objetivos vivos.'
  },
  {
    id: 'drone_mod_micro_laser',
    name: 'Micro-Laser Táctico Militar',
    source: 'core',
    category: 'drone_modules',
    tier: 'Military',
    slots: 2,
    cost: '4 Cr',
    effect: 'Ataque Far: inflige 1d6 daño de Energía de alta precisión.',
    use: '🤖 Ranuras: 2 Slots. Sistema letal militar para apoyo de fuego a distancia.'
  },

  // ==========================================
  // COREBOOK: GEAR & TECH
  // ==========================================
  {
    id: 'core_gr_omnitool',
    name: 'Omnitool Táctico Multifunción',
    source: 'core',
    category: 'gear',
    tier: 'Tier 1 · Core',
    quantity: '1',
    use: 'Herramienta de ingeniería avanzada con soplete de micro-plasma, interfaz de hackeo de esclusas y sensor de cableado.'
  },
  {
    id: 'core_gr_medpack',
    name: 'Medikit Quirúrgico de Trauma',
    source: 'core',
    category: 'gear',
    tier: 'Tier 1 · Core',
    quantity: '3',
    use: 'Geles coagulantes y estimulantes biológicos. Estabiliza heridas críticas y restaura hasta 2 HP o elimina 1 Estrés.'
  },
  {
    id: 'core_gr_bioscanner',
    name: 'Escáner Biosensible Portátil',
    source: 'core',
    category: 'gear',
    tier: 'Tier 1 · Core',
    quantity: '1',
    use: 'Detección de constantes vitales, atmósferas tóxicas y feromonas alienígenas en un radio de 50 metros.'
  },
  {
    id: 'core_gr_magboots',
    name: 'Botas Magnéticas de Vacío',
    source: 'core',
    category: 'gear',
    tier: 'Tier 1 · Core',
    quantity: '1',
    use: 'Permite adherirse a mamparos metálicos y desplazarse a pie con firmeza en entornos de microgravedad y Gravedad Cero.'
  },
  {
    id: 'core_gr_breach_charge',
    name: 'Cargas Lineales de Brecha',
    source: 'core',
    category: 'gear',
    tier: 'Tier 2 · Core',
    quantity: '2',
    use: 'Explosivo termoplástico de corte para abrir mamparos blindados o derribar muros débiles en combate táctico.'
  },
  {
    id: 'core_gr_camo_cloak',
    name: 'Capa de Mimetismo Termo-Óptico',
    source: 'core',
    category: 'gear',
    tier: 'Tier 2 · Core',
    quantity: '1',
    use: 'Proyecta patrones de refracción luminosa. Concede ventaja en tiradas de sigilo mientras el portador permanezca estático.'
  },
  {
    id: 'core_gr_stim_injector',
    name: 'Auto-Inyector de Neuroestimulantes',
    source: 'core',
    category: 'gear',
    tier: 'Tier 1 · Core',
    quantity: '2',
    use: 'Cóctel químico de combate. Limpia inmediatamente 2 puntos de Estrés e incrementa el enfoque durante 1 turno.'
  }
];

export function getEquipmentLibrary(filters = {}) {
  const { source, category, query } = filters;
  const q = (query || '').trim().toLowerCase();

  return EQUIPMENT_CATALOG.filter(item => {
    if (source && source !== 'all' && item.source !== source) return false;
    if (category && category !== 'all' && item.category !== category) return false;
    if (q) {
      const matchName = item.name.toLowerCase().includes(q);
      const matchFeatures = (item.features || item.use || item.benefit || '').toLowerCase().includes(q);
      const matchTier = (item.tier || '').toLowerCase().includes(q);
      const matchSpecies = (item.species || '').toLowerCase().includes(q);
      if (!matchName && !matchFeatures && !matchTier && !matchSpecies) return false;
    }
    return true;
  });
}

export const filterEquipmentCatalog = getEquipmentLibrary;

/**
 * Adds an item or weapon from the catalog to an existing token inventory
 */
export function equipCatalogItem(inventory, catalogItem) {
  const draft = structuredClone(inventory || { weapons: [], items: [] });
  if (!draft.weapons) draft.weapons = [];
  if (!draft.items) draft.items = [];

  if (catalogItem.category === 'weapons') {
    draft.weapons.push({
      id: newId(),
      name: catalogItem.name,
      damage: catalogItem.damage || '1d8',
      damageMode: 'base',
      trait: catalogItem.trait || 'Agility',
      range: catalogItem.range || 'Close',
      features: catalogItem.features || '',
      tier: catalogItem.tier || 'Tier 1'
    });
  } else {
    // Armor, Gear, Augmentations, or Drone Modules
    draft.items.push({
      id: newId(),
      name: catalogItem.name,
      tier: catalogItem.tier || '',
      quantity: String(catalogItem.quantity || '1'),
      use: catalogItem.use || catalogItem.features || catalogItem.benefit || catalogItem.effect || ''
    });
  }
  return draft;
}
