// src/equipmentLibrary.js
// Canonical Equipment, Augmentations, Weapons & Alien Species Gear Catalog
// Supports Corebook rules and Rust & Steel alien species technology in any combination.

import { newId } from './persistence.js';

export const EQUIPMENT_SOURCES = [
  { id: 'all', name: 'Todas las fuentes' },
  { id: 'core', name: 'Reglamento Base (Core)' },
  { id: 'rust_and_steel', name: 'Rust & Steel (Especies Alienígenas)' }
];

export const EQUIPMENT_CATEGORIES = [
  { id: 'all', name: 'Todas las categorías' },
  { id: 'weapons', name: '⚔️ Armas y Ataques' },
  { id: 'armor', name: '🛡️ Armaduras y Escudos' },
  { id: 'gear', name: '🎒 Equipo y Tecnología' },
  { id: 'augmentations', name: '🧬 Aumentos e Implantes' }
];

export const EQUIPMENT_CATALOG = [
  // ==========================================
  // COREBOOK: WEAPONS
  // ==========================================
  {
    id: 'core_wp_kinetic_pistol',
    name: 'Pistola Cinética Militar',
    source: 'core',
    category: 'weapons',
    tier: 'Tier 1 · Core',
    damage: '1d8',
    damageMode: 'base',
    trait: 'Agility',
    range: 'Short',
    features: 'Arma compacta de proyectiles estándar. Recarga rápida y fiable en atmósferas hostiles.'
  },
  {
    id: 'core_wp_plasma_carbine',
    name: 'Carabina de Plasma',
    source: 'core',
    category: 'weapons',
    tier: 'Tier 1 · Core',
    damage: '1d10',
    damageMode: 'base',
    trait: 'Finesse',
    range: 'Medium',
    features: 'Ráfaga de plasma sobrecalentado. Perforación térmica que debilita blindajes.'
  },
  {
    id: 'core_wp_monoblade',
    name: 'Hoja de Monofilamento',
    source: 'core',
    category: 'weapons',
    tier: 'Tier 1 · Core',
    damage: '1d8',
    damageMode: 'base',
    trait: 'Agility',
    range: 'Melee',
    features: 'Filo molecular capaz de cortar aleaciones ligeras sin resistencia. Silenciosa.'
  },
  {
    id: 'core_wp_mag_cannon',
    name: 'Cañón de Aceleración Magnética',
    source: 'core',
    category: 'weapons',
    tier: 'Tier 2 · Core',
    damage: '2d8',
    damageMode: 'base',
    trait: 'Strength',
    range: 'Long',
    features: 'Arma pesada antivehículo. Retroceso cinético violento; causa impacto devastador.'
  },
  {
    id: 'core_wp_stun_baton',
    name: 'Porra de Choque Neuro-Eléctrica',
    source: 'core',
    category: 'weapons',
    tier: 'Tier 1 · Core',
    damage: '1d6',
    damageMode: 'base',
    trait: 'Strength',
    range: 'Melee',
    features: 'Descarga de alto voltaje diseñada para neutralizar e incapacitar sin matar.'
  },
  {
    id: 'core_wp_scattergun',
    name: 'Escopeta Táctica de Dispersión',
    source: 'core',
    category: 'weapons',
    tier: 'Tier 1 · Core',
    damage: '1d10',
    damageMode: 'base',
    trait: 'Strength',
    range: 'Short',
    features: 'Proyectiles de perdigones de tungsteno. Dispersión devastadora a quemarropa.'
  },
  {
    id: 'core_wp_void_rifle',
    name: 'Rifle de Francotirador del Vacío',
    source: 'core',
    category: 'weapons',
    tier: 'Tier 2 · Core',
    damage: '1d12',
    damageMode: 'base',
    trait: 'Finesse',
    range: 'Extreme',
    features: 'Óptica de precisión estabilizada. Disparo de hipervelocidad con perforación severa.'
  },
  {
    id: 'core_wp_beam_saber',
    name: 'Espada de Haz Fotónico',
    source: 'core',
    category: 'weapons',
    tier: 'Tier 2 · Core',
    damage: '1d10',
    damageMode: 'base',
    trait: 'Agility',
    range: 'Melee',
    features: 'Hoja de luz coherente de alta intensidad. Funde armaduras y deflecta proyectiles lentos.'
  },

  // ==========================================
  // COREBOOK: ARMOR & SHIELDS
  // ==========================================
  {
    id: 'core_ar_tactical_weave',
    name: 'Malla Táctica Balística',
    source: 'core',
    category: 'armor',
    tier: 'Tier 1 · Core',
    armorSlots: 1,
    quantity: '1',
    use: 'Armadura ligera de kevlar y grafeno. Otorga +1 slot de Armadura/Escudo sin penalización de agilidad.'
  },
  {
    id: 'core_ar_heavy_combat_suit',
    name: 'Traje de Combate Blindado Orbital',
    source: 'core',
    category: 'armor',
    tier: 'Tier 2 · Core',
    armorSlots: 2,
    quantity: '1',
    use: 'Placas de aleación balística selladas. Otorga +2 slots de Armadura/Escudos y soporte vital de 6 horas.'
  },
  {
    id: 'core_ar_power_rig',
    name: 'Exoesqueleto de Asalto (Power Rig)',
    source: 'core',
    category: 'armor',
    tier: 'Tier 3 · Core',
    armorSlots: 3,
    quantity: '1',
    use: 'Estructura motorizada completa. Otorga +3 slots de Armadura/Escudos y servomotores que mejoran Fuerza.'
  },
  {
    id: 'core_ar_kinetic_shield',
    name: 'Generador de Escudo Cinético Personal',
    source: 'core',
    category: 'armor',
    tier: 'Tier 2 · Core',
    armorSlots: 1,
    quantity: '1',
    use: 'Campo de fuerza deflectante recargable en cinturón. Absorbe impactos de alta velocidad como 1 escudo mitigatorio.'
  },
  {
    id: 'core_ar_hazard_suit',
    name: 'Traje de Aislamiento NBQ / Vacío',
    source: 'core',
    category: 'armor',
    tier: 'Tier 1 · Core',
    armorSlots: 1,
    quantity: '1',
    use: 'Sellado hermético ignífugo y antiradiación. Otorga +1 slot de Armadura e inmunidad a atmósferas corrosivas.'
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
  },

  // ==========================================
  // RUST & STEEL: ALIEN SPECIES WEAPONS
  // ==========================================
  {
    id: 'rs_wp_lithian_hammer',
    name: 'Martillo de Resonancia Sísmica Lithian',
    source: 'rust_and_steel',
    category: 'weapons',
    species: 'Lithian',
    tier: 'Tier 2 · Lithian',
    damage: '1d10',
    damageMode: 'base',
    trait: 'Strength',
    range: 'Melee',
    features: 'Arma pesada forjada en aleación cristalina. Desata ondas de choque que agrietan blindajes y aturden enemigos.'
  },
  {
    id: 'rs_wp_chitin_spikes',
    name: 'Lanzador de Espículas Quitinosas',
    source: 'rust_and_steel',
    category: 'weapons',
    species: 'Chitinid',
    tier: 'Tier 1 · Chitinid',
    damage: '1d8',
    damageMode: 'base',
    trait: 'Finesse',
    range: 'Medium',
    features: 'Disparador neumático orgánico de dardos de queratina endurecida. Completamente silencioso y no detectable por sensores de metal.'
  },
  {
    id: 'rs_wp_chitin_mandible',
    name: 'Garras Mandibulares Biomecánicas',
    source: 'rust_and_steel',
    category: 'weapons',
    species: 'Chitinid',
    tier: 'Tier 1 · Chitinid',
    damage: '1d8',
    damageMode: 'base',
    trait: 'Agility',
    range: 'Melee',
    features: 'Arma oculta integrada en extremidades. Capaz de inyectar veneno paralizante con un impacto crítico.'
  },
  {
    id: 'rs_wp_voidborn_blade',
    name: 'Cuchilla Dimensional del Vacío',
    source: 'rust_and_steel',
    category: 'weapons',
    species: 'Voidborn',
    tier: 'Tier 2 · Voidborn',
    damage: '1d10',
    damageMode: 'base',
    trait: 'Agility',
    range: 'Melee',
    features: 'Filo sintonizado con el Velo que corta a través del espacio fase, ignorando 1 punto de armadura del objetivo.'
  },
  {
    id: 'rs_wp_synther_arm_blaster',
    name: 'Bláster Oculto de Brazo Sintético',
    source: 'rust_and_steel',
    category: 'weapons',
    species: 'Synthet',
    tier: 'Tier 2 · Synthet',
    damage: '1d8',
    damageMode: 'base',
    trait: 'Finesse',
    range: 'Medium',
    features: 'Implante balístico bajo la dermis sintética. Se despliega mediante impulso neural en una fracción de segundo.'
  },

  // ==========================================
  // RUST & STEEL: ALIEN SPECIES ARMOR & SHIELDS
  // ==========================================
  {
    id: 'rs_ar_lithian_silicate',
    name: 'Coraza de Cristal Silíceo Lithian',
    source: 'rust_and_steel',
    category: 'armor',
    species: 'Lithian',
    tier: 'Tier 2 · Lithian',
    armorSlots: 2,
    quantity: '1',
    use: 'Placas de silicato mineral refractario. Concede +2 slots de Armadura/Escudos y gran resistencia al fuego y plasma.'
  },
  {
    id: 'rs_ar_chitin_carapace',
    name: 'Exoesqueleto de Quitina Endurecida',
    source: 'rust_and_steel',
    category: 'armor',
    species: 'Chitinid',
    tier: 'Tier 2 · Chitinid',
    armorSlots: 2,
    quantity: '1',
    use: 'Placas queratinizadas con biopolímeros autorreparables. Concede +2 slots de Armadura/Escudos y regenera 1 uso tras descanso.'
  },
  {
    id: 'rs_ar_thermo_sink_plating',
    name: 'Blindaje Térmico Disipador Sintético',
    source: 'rust_and_steel',
    category: 'armor',
    species: 'Synthet',
    tier: 'Tier 1 · Synthet',
    armorSlots: 1,
    quantity: '1',
    use: 'Revestimiento cerámico-metálico con canales refrigerantes. Concede +1 slot de Armadura y disipa sobrecalentamientos.'
  },

  // ==========================================
  // RUST & STEEL: AUGMENTATIONS & CYBERWARE
  // ==========================================
  {
    id: 'rs_aug_lithian_seismic_node',
    name: 'Nodo Sísmico Subdérmico Lithian',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Lithian',
    tier: 'Tier 2 · Aumento Lithian',
    quantity: '1',
    use: 'Implante en extremidades inferiores que capta microvibraciones en el suelo. Revela pasos y movimiento detrás de puertas o muros hasta 20m.'
  },
  {
    id: 'rs_aug_geode_core',
    name: 'Núcleo Resonante de Geoda',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Lithian',
    tier: 'Tier 3 · Aumento',
    quantity: '1',
    use: 'Aumento místico-cristalino integrado en el pecho. Permite canalizar y almacenar 1 punto de Esperanza adicional más allá del límite.'
  },
  {
    id: 'rs_aug_chitin_pheromone',
    name: 'Transmisor de Feromonas de Alerta',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Chitinid',
    tier: 'Tier 1 · Aumento Chitinid',
    quantity: '1',
    use: 'Glándula biomecánica que emite señales químicas directas. Permite coordinar acciones con aliados sin emitir ondas de radio interceptables.'
  },
  {
    id: 'rs_aug_neural_overclock',
    name: 'Módulo de Overclocking Neural Sintético',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Synthet',
    tier: 'Tier 2 · Aumento Sintético',
    quantity: '1',
    use: 'Procesador neuronal auxiliar que acelera el cálculo táctico. Permite repetir 1 dado en tiradas de Conocimiento o Finura a cambio de 1 Estrés.'
  },
  {
    id: 'rs_aug_subdermal_wiring',
    name: 'Cableado Óptico de Reflejos Subdérmicos',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Synthet',
    tier: 'Tier 2 · Aumento Sintético',
    quantity: '1',
    use: 'Sinapsis biomecánicas de fibra óptica que reducen el retardo motor. Otorga +1 a la Evasión pasiva del personaje.'
  },
  {
    id: 'rs_aug_void_gills',
    name: 'Branquias de Membrana del Vacío',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Voidborn',
    tier: 'Tier 2 · Aumento Voidborn',
    quantity: '1',
    use: 'Filtros respiratorios biológicos que reciclan oxígeno interno. Permite sobrevivir hasta 30 minutos expuesto al vacío del espacio.'
  },
  {
    id: 'rs_aug_zerog_thrusters',
    name: 'Propulsores Maniobrables de Gravedad Cero',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Voidborn',
    tier: 'Tier 2 · Aumento Voidborn',
    quantity: '1',
    use: 'Microtoberas de gas frío integradas en espalda y talones. Concede desplazamiento rápido y giro tridimensional sin soporte en ingravidez.'
  },
  {
    id: 'rs_aug_ocular_targeter',
    name: 'Ojo Cibernético con HUD Táctico',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Universal',
    tier: 'Tier 1 · Aumento',
    quantity: '1',
    use: 'Prótesis ocular de alta definición con visión nocturna, cálculo balístico en tiempo real y telémetro de distancia láser.'
  },
  {
    id: 'rs_aug_hydraulic_muscle',
    name: 'Injerto Muscular Hidráulico',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Universal',
    tier: 'Tier 2 · Aumento',
    quantity: '1',
    use: 'Miofibras sintéticas trenzadas reforzadas con micropistones. Concede +1 al daño plano cuerpo a cuerpo y duplica la carga máxima.'
  },
  {
    id: 'rs_aug_drone_link_jack',
    name: 'Conector Neural de Enlace con Drones',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Universal',
    tier: 'Tier 2 · Aumento',
    quantity: '1',
    use: 'Toma craneal de conexión directa con la CPU de drones tácticos. Permite impartir órdenes a drones en el mapa como acción gratuita.'
  },
  {
    id: 'rs_aug_auto_adrenal_pump',
    name: 'Bomba Adrenal de Resucitación Táctica',
    source: 'rust_and_steel',
    category: 'augmentations',
    species: 'Universal',
    tier: 'Tier 3 · Aumento',
    quantity: '1',
    use: 'Bomba torácica que monitoriza constantes vitales. Si el personaje cae a 0 HP, se activa automáticamente restaurando 1 HP de inmediato (1 uso por misión).'
  }
];

/**
 * Filter equipment catalog by source, category, and text query
 */
export function filterEquipmentCatalog({ source = 'all', category = 'all', query = '' } = {}) {
  const q = (query || '').toLowerCase().trim();
  return EQUIPMENT_CATALOG.filter(item => {
    if (source && source !== 'all' && item.source !== source) return false;
    if (category && category !== 'all' && item.category !== category) return false;
    if (q) {
      const matchName = item.name.toLowerCase().includes(q);
      const matchFeatures = (item.features || item.use || '').toLowerCase().includes(q);
      const matchTier = (item.tier || '').toLowerCase().includes(q);
      const matchSpecies = (item.species || '').toLowerCase().includes(q);
      if (!matchName && !matchFeatures && !matchTier && !matchSpecies) return false;
    }
    return true;
  });
}

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
      damageMode: catalogItem.damageMode || 'base',
      trait: catalogItem.trait || 'Agility',
      range: catalogItem.range || 'Medium',
      features: catalogItem.features || '',
      tier: catalogItem.tier || 'Tier 1'
    });
  } else {
    // Armor, Gear, or Augmentations
    draft.items.push({
      id: newId(),
      name: catalogItem.name,
      tier: catalogItem.tier || '',
      quantity: String(catalogItem.quantity || '1'),
      use: catalogItem.use || catalogItem.features || ''
    });
  }
  return draft;
}

