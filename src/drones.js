// Drones by the book: Corebook 12.06, chapter 14 (Drones and Remote Tools), with the module
// lists of the Corebook and of Rust & Steel. A drone is a Grade (its chassis) plus Modules.
import DRONE_MODULES_DATA from './droneModules.json' with { type: 'json' };

export const DRONE_MODULES = DRONE_MODULES_DATA;
const GRADE_ORDER = ['common', 'military', 'experimental'];

// Grade table. evasionCap is the book's suggested ceiling; burden its inventory guideline.
export const DRONE_GRADES = {
  common: { id: 'common', name: 'Common Drone', tier: 2, cost: 4, hp: 2, evasion: 10, major: 5, severe: 11, armor: 0, slots: 2, evasionCap: 12, burden: '1', availability: 'Civil, comercial, mercados de frontera' },
  military: { id: 'military', name: 'Military Drone', tier: 3, cost: 8, hp: 3, evasion: 11, major: 7, severe: 14, armor: 1, slots: 3, evasionCap: 14, burden: '2', availability: 'Restringido, con licencia, seguridad de Casa' },
  experimental: { id: 'experimental', name: 'Experimental Drone', tier: 4, cost: 16, hp: 5, evasion: 12, major: 9, severe: 16, armor: 2, slots: 4, evasionCap: 15, burden: '2–3', availability: 'Raro, inestable, black-site, prototipo' },
};

export const SIGNAL_STATES = {
  stable: { name: 'Stable', effect: 'El dron funciona con normalidad.' },
  unstable: { name: 'Unstable', effect: 'Las órdenes simples funcionan. Toda orden compleja tira con Desventaja.' },
  lost: { name: 'Lost', effect: 'Sigue su protocolo cargado; sin protocolo se queda inmóvil. No puede esquivar activamente: Evasion −2 si lo atacan.' },
};
export const LINK_MODES = {
  rf: { name: 'Direct RF Link', effect: 'Privado pero frágil: distancia, estructura, interferencias y jamming pesan mucho más.' },
  mesh: { name: 'Local Mesh', effect: 'Melee a Very Far es Stable salvo restricción impresa. El dron queda registrado y localizable.' },
  relay: { name: 'Private Relay Chain', effect: 'Extiende el RF con repetidores propios; cada uno puede ser detectado, destruido o rastreado.' },
};
export const LOST_PROTOCOLS = {
  freeze: { name: 'Freeze', effect: 'Se detiene y espera a recuperar la conexión.' },
  return: { name: 'Return', effect: 'Intenta volver al último punto con señal.' },
  execute: { name: 'Execute', effect: 'Completa una orden simple precargada.' },
  dead: { name: 'Dead Weight', effect: 'Queda inerte hasta que lo recuperen.' },
};
// Default signal on a private link in open conditions, by range band from the operator.
export const SIGNAL_BY_RANGE = { Melee: 'stable', 'Very Close': 'stable', Close: 'stable', Far: 'stable', Extreme: 'unstable' };

export const DRONE_COMPLICATIONS = [
  'La señal empeora un paso.',
  'La señal queda Unstable hasta el final del próximo Spotlight del operador; después vuelve a su estado previo.',
  'El dron queda Restrained; se libera con Strength DC 15 o con una Acción del operador y Knowledge (Tech) DC 15.',
  'La señal queda Lost hasta que el operador gaste una Acción y supere Knowledge (Tech) DC 15 para redirigirla.',
  'El dron pierde Hidden y un observador hostil ya establecido conoce su zona actual.',
  'La siguiente Acción hecha a través del dron antes del final del próximo Spotlight del operador tiene Desventaja.',
  'El dron pierde 1 HP directo.',
  'El operador elige un módulo instalado: queda offline hasta una Acción y Knowledge (Tech) DC 10.',
  'La siguiente tirada de Knowledge o Instinct hecha a través del dron antes del final de la escena tiene Desventaja.',
  'El operador hace una Reaction Roll de Knowledge (Tech) DC 15; si falla, la señal empeora un estado.',
  'El operador hace una Reaction Roll de Knowledge (Tech) DC 20; si falla, la señal queda Lost hasta una Acción y Knowledge (Tech) DC 15. El control nunca se transfiere solo.',
  'El operador debe gastar una Acción para confirmar la orden actual antes de otra tarea compleja; volver y parar siguen funcionando.',
];

// The sample builds printed in the chapter.
export const DRONE_SAMPLE_BUILDS = [
  { id: 'cheap-scout-mote', name: 'Cheap Scout Mote', grade: 'common', modules: ['low-light-camera'], use: 'Exploración básica, grabación, revisar espacios oscuros.' },
  { id: 'field-repair-beetle', name: 'Field Repair Beetle', grade: 'common', modules: ['manipulator-arm', 'repair-kit'], use: 'Mantenimiento y reparación remota ligera.' },
  { id: 'relay-crawler', name: 'Relay Crawler', grade: 'common', modules: ['wall-crawler', 'relay-node'], use: 'Mantiene la señal tras esquinas e interiores complejos sin volar.' },
  { id: 'flying-scout-mote', name: 'Flying Scout Mote', grade: 'common', modules: ['flight-module', 'low-light-camera'], use: 'Exploración aérea básica. −2 a Agility para evitar ser detectado mientras vuela.' },
  { id: 'shared-crew-scout', name: 'Shared Crew Scout', grade: 'common', modules: ['low-light-camera', 'neural-network-control'], use: 'Dron de exploración barato que toda la tripulación controla por turnos.' },
  { id: 'security-stun-drone', name: 'Security Stun Drone', grade: 'military', modules: ['stun-dart', 'hardened-link'], use: 'Patrulla restringida, control no letal, seguridad de la tripulación.' },
  { id: 'tactical-support-frame', name: 'Tactical Support Frame', grade: 'military', modules: ['armor-plating', 'target-painter', 'smoke-flash-pod'], use: 'Apoyo de brecha, marcado, extracción.' },
  { id: 'ghost-signal-infiltrator', name: 'Ghost-Signal Infiltrator', grade: 'experimental', modules: ['ghost-signal-lattice', 'reflex-kernel', 'veil-hardened-casing'], use: 'Infiltración peligrosa con mala señal e interferencia del Velo. Alguien lo quiere de vuelta.' },
];

// What a module changes in the numbers of the frame. Everything else is its printed text.
const EFFECTS = {
  'agile-servos': { evasion: 1 },
  'reflex-kernel': { evasion: 1 },
  'armor-plating': { armor: 1 },
  'armor-booster': { armor: 1, minGrade: 'military' },
  'reinforced-plating': { major: 2, severe: 2, evasion: -1 },
  'predictive-motion-suite': { minGrade: 'military' },
};
const MOVEMENT = { 'flight-module': 'Vuelo', 'military-flight-module': 'Vuelo táctico', 'wall-crawler': 'Paredes y techos', 'micro-thrusters': 'EVA / baja gravedad', 'eva-kit': 'Vacío', 'submersible-kit': 'Submarino' };
// Weapons a module gives the drone. Drone damage never scales with Proficiency (ch. 14).
const WEAPONS = {
  'compliance-taser': { name: 'Compliance Taser', damage: '', range: 'Close', lethal: false, features: 'No letal. Al impactar: 1 Stress y el objetivo suelta un objeto, pierde pie o queda aturdido un momento.' },
  'stun-dart': { name: 'Stun Dart', damage: '1d6 phys', range: 'Far', lethal: false, features: 'No letal. Close/Far. Al impactar: 1d6 de daño físico no letal o 1 Stress. Munición limitada.' },
  'micro-laser': { name: 'Micro-Laser', damage: '1d6 ene', range: 'Far', lethal: true, features: 'Energy. Preciso, pero fácil de rastrear por calor u origen del haz.' },
  'net-launcher': { name: 'Net Launcher', damage: '', range: 'Close', lethal: false, features: 'Al impactar: inmoviliza un dron pequeño o frena a un humanoide hasta que una Acción lo libere.' },
};
const LETHAL = new Set(['micro-laser', 'hardpoint-mount', 'breach-charge-mount']);

export const droneModule = id => DRONE_MODULES.find(m => m.id === id) || null;
export const gradeRank = grade => GRADE_ORDER.indexOf(grade);
export const isDroneToken = token => token?.actorType === 'drone';

// The procedure the book asks for when a module is above the Grade of the frame.
export function installationRule(droneGrade, moduleGrade) {
  if (gradeRank(moduleGrade) <= gradeRank(droneGrade)) return null;
  if (droneGrade === 'common' && moduleGrade === 'military') return { dc: 15, extraSlot: 0, text: 'Módulo Military en dron Common: Knowledge (Tech) DC 15, herramientas adecuadas y Downtime.' };
  if (droneGrade === 'military') return { dc: 20, extraSlot: 0, text: 'Módulo Experimental en dron Military: Knowledge (Tech) DC 20, herramientas raras o acceso a un especialista y Downtime.' };
  return { dc: 20, extraSlot: 1, text: 'Módulo Experimental en dron Common: Knowledge (Tech) DC 20, herramientas raras y Downtime; ocupa un Slot adicional.' };
}

// Everything the table needs to know about a build: its numbers, what is wrong with it and
// what must be resolved at the table before it is legal to field.
export function droneBuild({ grade = 'common', modules = [], illegalMods = false, weaponUnlocked = false } = {}) {
  const frame = DRONE_GRADES[grade];
  if (!frame) throw new Error('Grado de dron desconocido.');
  const installed = modules.map(id => droneModule(id)), errors = [], notes = [];
  if (installed.some(m => !m)) throw new Error('Módulo de dron desconocido.');
  if (new Set(modules).size !== modules.length && modules.some((id, i) => modules.indexOf(id) !== i && id !== 'phase-capacitor')) errors.push('Cada módulo se instala una sola vez (salvo Phase Capacitor).');
  let slotsUsed = 0, cost = frame.cost, evasion = frame.evasion, armor = frame.armor, major = frame.major, severe = frame.severe;
  const weapons = [], movement = ['Terrestre'];
  for (const module of installed) {
    const rule = installationRule(grade, module.grade), effect = EFFECTS[module.id] || {};
    slotsUsed += module.slots + (rule?.extraSlot || 0); cost += module.cost;
    if (rule) { notes.push(`${module.name}: ${rule.text}`); if (!illegalMods) errors.push(`${module.name} es de grado ${DRONE_GRADES[module.grade].name.replace(' Drone', '')}: un dron ${frame.name.replace(' Drone', '')} solo lo monta como modificación ilegal.`); }
    if (effect.minGrade && gradeRank(grade) < gradeRank(effect.minGrade)) errors.push(`${module.name} solo se instala en drones Military o Experimental.`);
    if (LETHAL.has(module.id) && grade === 'common') {
      notes.push(`${module.name}: arma letal en un dron Common. Requiere el procedimiento Weaponized Common Drones (Knowledge (Tech) DC 15, herramientas y Downtime).`);
      if (!weaponUnlocked) errors.push(`${module.name} es letal: un dron Common tiene bloqueo contra armas letales.`);
    }
    evasion += effect.evasion || 0; armor += effect.armor || 0; major += effect.major || 0; severe += effect.severe || 0;
    if (MOVEMENT[module.id]) movement.push(MOVEMENT[module.id]);
    if (WEAPONS[module.id]) weapons.push({ id: module.id, ...WEAPONS[module.id] });
  }
  if (modules.includes('phase-capacitor') && !modules.includes('phase-blink-array')) errors.push('Phase Capacitor requiere Phase Blink Array.');
  if (modules.includes('reinforced-plating') && modules.includes('low-profile-frame') && grade !== 'experimental') errors.push('Reinforced Plating no se combina con Low-Profile Frame salvo en un dron Experimental.');
  if (slotsUsed > frame.slots) errors.push(`El dron ${frame.name.replace(' Drone', '')} tiene ${frame.slots} Module Slots y esta configuración usa ${slotsUsed}.`);
  if (evasion > frame.evasionCap) { notes.push(`Evasion limitada a ${frame.evasionCap}, el máximo recomendado para un dron ${frame.name.replace(' Drone', '')}.`); evasion = frame.evasionCap; }
  if (modules.some(id => id === 'flight-module' || id === 'military-flight-module')) notes.push('Mientras vuela: −2 a las tiradas de Agility para evitar ser detectado.');
  return { grade, frame, modules: installed, slotsUsed, slots: frame.slots, cost, hp: frame.hp, evasion, armor, major, severe, weapons, movement, errors, notes };
}

const signalOf = token => SIGNAL_STATES[token?.drone?.signal] ? token.drone.signal : 'stable';
export const droneSignal = signalOf;
export const worsenSignal = signal => ['stable', 'unstable', 'lost'][Math.min(2, ['stable', 'unstable', 'lost'].indexOf(signal) + 1)];
export const improveSignal = signal => ['stable', 'unstable', 'lost'][Math.max(0, ['stable', 'unstable', 'lost'].indexOf(signal) - 1)];

// A drone under attack with its signal Lost cannot evade: Evasion −2 (unless its protocol
// keeps it moving, which stays a Keeper call made by changing the signal state).
export function droneEvasion(token) {
  const base = Number.isFinite(token?.evasion) ? token.evasion : 10;
  return isDroneToken(token) && signalOf(token) === 'lost' ? base - 2 : base;
}

// How a drone attacks: its operator spends the Action and makes the roll. Lost signal means
// no command; Unstable makes the attack (a complex command) roll with Disadvantage.
export function droneCommand(token) {
  const signal = signalOf(token);
  if (signal === 'lost') return { allowed: false, disadvantage: false, reason: 'Señal Lost: el dron no recibe órdenes. Sigue su protocolo hasta recuperar la señal.' };
  const hardened = (token?.drone?.modules || []).some(id => id === 'hardened-link' || id === 'ghost-signal-lattice') && !(token.drone.offline || []).some(id => id === 'hardened-link' || id === 'ghost-signal-lattice');
  if (signal === 'unstable' && !hardened) return { allowed: true, disadvantage: true, reason: 'Señal Unstable: orden compleja con Desventaja.' };
  return { allowed: true, disadvantage: false, reason: '' };
}

// The token fields a build sets. Current HP and Armor are kept when an existing drone is
// refitted, capped by the new maximums.
export function droneTokenData(build, { previous = null, signal = 'stable', linkMode = 'rf', protocol = 'freeze', operatorId = '', illegalMods = false, weaponUnlocked = false } = {}) {
  const hpMax = build.hp, armorMax = build.armor;
  return {
    actorType: 'drone', isPlayer: false,
    roleTag: `${build.frame.name} · Tier ${build.frame.tier}`,
    evasion: build.evasion,
    hp: { current: previous ? Math.min(previous.hp?.current ?? hpMax, hpMax) : hpMax, max: hpMax, majorThreshold: build.major, severeThreshold: build.severe },
    armor: { current: previous ? Math.min(previous.armor?.current ?? armorMax, armorMax) : armorMax, max: armorMax },
    stress: { current: 0, max: 0 },
    attackModifier: 0,
    drone: { grade: build.grade, modules: build.modules.map(m => m.id), offline: (previous?.drone?.offline || []).filter(id => build.modules.some(m => m.id === id)), signal, linkMode, protocol, operatorId, illegalMods, weaponUnlocked },
    inventory: {
      weapons: build.weapons.map(w => ({ id: w.id, name: w.name, damage: w.damage, damageMode: 'final', trait: 'Operador', range: w.range, features: w.features, tier: '' })),
      items: build.modules.map(m => ({ id: 'mod_' + m.id, name: m.name, tier: DRONE_GRADES[m.grade].name.replace(' Drone', ''), quantity: '1', use: `${m.slots} Slot${m.slots === 1 ? '' : 's'} · ${m.cost} Cr · ${m.effect}` })),
    },
  };
}

// Shared control (ch. 14): a drone is paired to one operator unless it carries Neural Network
// Control, which lets every registered crew member take it in hand, one at a time.
export const SHARED_CONTROL_MODULE = 'neural-network-control';
export const hasSharedControl = token => isDroneToken(token) && (token.drone?.modules || []).includes(SHARED_CONTROL_MODULE) && !(token.drone?.offline || []).includes(SHARED_CONTROL_MODULE);
// A drone built by the book without the module takes a single controlling player.
export const droneControllerLimit = token => isDroneToken(token) && token.drone && !hasSharedControl(token) ? 1 : Infinity;
// The registered crew: the characters of the players who control the drone. At a local table
// with nobody assigned, every player character counts.
export function droneCrew(tokens, drone) {
  const characters = tokens.filter(t => t.isPlayer !== false && t.actorType !== 'drone'), controllers = drone?.controllerIds || [];
  const registered = characters.filter(t => t.ownerId && controllers.includes(t.ownerId));
  return registered.length ? registered : (controllers.length ? [] : characters);
}
// Passing control: free while the signal is Stable; on Unstable the receiving operator marks
// 1 Stress or the handoff fails; on Lost the interface does not work at all.
export function handoffControl(tokens, droneId, operatorId) {
  const drone = tokens.find(t => t.id === droneId), receiver = tokens.find(t => t.id === operatorId);
  if (!isDroneToken(drone) || !drone.drone) throw new Error('Ese token no es un dron configurado.');
  if (!hasSharedControl(drone)) throw new Error('Este dron está emparejado con un solo operador. Instala Neural Network Control (1 Cr, 0 Slots) para que la tripulación lo controle por turnos.');
  if (!receiver || !droneCrew(tokens, drone).some(t => t.id === operatorId)) throw new Error('Ese personaje no está registrado en el dron: el Keeper debe dar el control del dron a su jugador.');
  if (drone.drone.operatorId === operatorId) throw new Error(`${receiver.name} ya controla el dron.`);
  const signal = signalOf(drone);
  if (signal === 'lost') throw new Error('Señal Lost: Neural Network Control no funciona. El dron sigue su protocolo.');
  let stress = 0, updated = tokens;
  if (signal === 'unstable') {
    const current = receiver.stress?.current || 0, max = receiver.stress?.max ?? 6;
    if (current >= max) throw new Error(`Señal Unstable: tomar el control cuesta 1 Stress y ${receiver.name} no puede marcarlo. El operador anterior conserva el control.`);
    stress = 1; updated = updated.map(t => t.id === receiver.id ? { ...t, stress: { ...t.stress, current: current + 1 } } : t);
  }
  updated = updated.map(t => t.id === drone.id ? { ...t, drone: { ...t.drone, operatorId } } : t);
  return { tokens: updated, stress, summary: `${receiver.name} toma el control de ${drone.name}${stress ? ' (señal Unstable: 1 Stress)' : ''}. Mueve el Spotlight, no da Acciones extra.` };
}

export function validateDroneState(value) {
  const fail = () => { throw new Error('Configuración de dron inválida.'); };
  if (!value || typeof value !== 'object' || !DRONE_GRADES[value.grade] || !Array.isArray(value.modules) || value.modules.length > 20 || value.modules.some(id => !droneModule(id))) fail();
  if (value.offline !== undefined && (!Array.isArray(value.offline) || value.offline.some(id => !value.modules.includes(id)))) fail();
  if (!SIGNAL_STATES[value.signal ?? 'stable'] || !LINK_MODES[value.linkMode ?? 'rf'] || !LOST_PROTOCOLS[value.protocol ?? 'freeze']) fail();
  if (value.operatorId !== undefined && (typeof value.operatorId !== 'string' || value.operatorId.length > 200)) fail();
  return value;
}

export function rollDroneComplication(random = Math.random) {
  const roll = Math.floor(random() * 12) + 1;
  return { roll, text: DRONE_COMPLICATIONS[roll - 1] };
}
