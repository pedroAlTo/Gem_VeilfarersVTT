// The hyper-summary printed on a card in the hand (user decision, 22 Nov 2026): one line that fits,
// in Spanish, e.g. «Ataque a distancia · Daño 1d8 · Far · −2 armadura». The full rules text stays in
// the card's detail. Written by hand for the Powers of levels 1-3 and the Sleeping moves; any other
// card gets one built from its printed data. {P} is the character's Proficiency, {T} its Tier.
import { TARGET_RULES, areaRule } from './cardResolution.js';

export const SUMMARIES = {
  // Tech
  'Drone Whisper': 'Hechizo · Knowledge DC 10/15/20 · controlas una máquina T1-2 (Close) 1 h · con Hope 4 h',
  'Quantum Firewall': 'Hechizo · Knowledge DC 15 · protege un sistema 1 h: hackearlo exige superar tu tirada',
  'System Jackknife': 'Hechizo · Knowledge DC 10/15/20 · controlas un sistema (Close) 10 min',
  'Data Ghost': 'Hechizo · Knowledge DC 15 · borras tu rastro en un sistema · con Hope, pruebas falsas',
  'Emergency Repair': 'Reparación · toque · dron, vehículo o sintético +1d8 + Knowledge HP',
  'Digital Cascade': 'Hechizo · Knowledge DC 15 · virus en una red 1 h: apaga seguridad o copia datos',
  'Rapid Fabrication': 'Hechizo · Knowledge DC 15 · fabricas tecnología T1 (una escena) · con Hope, permanente',
  // Synthesis
  'Biological Scan': 'Escaneo · toque · ves HP, Stress y estados · DC 10: toxinas y cibernética',
  'Environmental Adaptation': 'Mejora · 1 h · inmune a vacío, temperatura, toxinas o radiación',
  'Rapid Regeneration': 'Curación · tú o aliado Very Close (o reacción al daño) · +1 HP y +1 por turno (1d4)',
  'Ecosystem Analysis': 'Mejora · 24 h · Ventaja en Instinct para sobrevivir y rastrear en la zona',
  'Symbiotic Bond': 'Vínculo · aliado Close · 1 h · si uno gasta Hope, el otro gana Ventaja (1 vez)',
  'Hostile Environment Mastery': 'Hechizo · Knowledge DC 15 · zona Close habitable 8 h (10 personas)',
  'Symbiotic Bloom': 'Hechizo · Instinct DC 15 · una escena · una adaptación (garras {P}d6 Void…)',
  // Social
  'Linguistic Patch': 'Mejora · una escena · hablas cualquier idioma · Ventaja en Presence social',
  'Perfect Facade': 'Hechizo · Finesse DC 10 · disfraz perfecto 1 h · Ventaja para mantenerlo',
  'Silver Tongue': 'Próxima tirada · Presence +{T} · un 11 en Hope cuenta como 12',
  'Emotional Manipulation': 'Hechizo · objetivo Close · Presence contra Instinct · Ventaja social 10 min',
  'Inspiring Presence': 'Área Close · aliados +2 a su próxima tirada',
  'Compelling Argument': 'Hechizo · Presence DC 15 · un NPC hace una acción razonable (1 h)',
  'Master of Disguise': 'Hechizo · Finesse DC 15 · disfraz que engaña a íntimos 24 h',
  // Neural
  'Mind Shield': 'Reacción · daño Neural −{P}d6 · Ventaja para resistir efectos mentales',
  'Telekinetic Grasp': 'Hechizo · Presence DC 10 · objeto a Far 1 min · lanzarlo: {P}d6 Void',
  'Veil Sensitivity': 'Mejora · una escena · Ventaja en Instinct para detectar mentiras',
  'Memory Echo': 'Hechizo · Instinct DC 15 · ves el recuerdo más intenso de un lugar u objeto',
  'Synaptic Disruption': 'Hechizo · objetivo Close · Presence DC 15 · Dazed · con Hope, Stunned',
  'Empathic Network': 'Vínculo · aliados en Far · una escena · al gastar Hope, los demás +1',
  'Mind-Slip': 'Hechizo · objetivo Close · Presence DC 15 · empujar, derribar (Prone) o frenar',
  // Kinetic
  'Force Shield': 'Reacción · tú o aliado Very Close impactado · +3 Evasión · si falla, {P}d4 al atacante',
  'Kinetic Blast': 'Ataque cuerpo a cuerpo · +Strength +1d8 · Empower +{P}d6 por Hope (máx. 2)',
  'Tactical Overwatch': 'Reacción · aliado Close atacado · el ataque con Desventaja · +2 Armor Slots',
  'Impact Absorption': 'Reacción · daño Physical −{P}d6 −2 · lo absorbido, a tu próximo ataque',
  'Kinetic Barrier': 'Mejora · una escena · +1 Evasión · resistencia Physical · absorbe 10',
  'Protective Dome': 'Hechizo · Strength DC 15 · zona Very Close 10 min · +2 Evasión dentro',
  'Velocity Surge': 'Hechizo · Agility DC 15 · una escena · +2 Agility · +1 banda de movimiento',
  // Void
  'Slipstream Jolt': 'Objetivo Close · Desventaja en su próxima tirada de Agility o Finesse',
  'Temporal Cloak': 'Mejora · 10 min · Oculto · Ventaja en Agility para no ser visto',
  'Vector Calculus': 'Próxima tirada · Agility o Finesse +nivel · Hope 10 o menos = 11',
  'Lucky Break': 'Reacción · relanza el Hope o el Fear de tu última tirada',
  'Spatial Shift': 'Movimiento · teletransporte a Close (la nave, a Far) · sin tirada',
  'Flux Field': 'Hechizo · Instinct DC 15 · 10 min · 1/ronda: Ventaja a un aliado o Desventaja a un enemigo',
  'Temporal Muffle': 'Hechizo · Finesse DC 15 · campo silencioso 1 h · Ventaja para no ser oído',
  // Lux
  'Blinding Flash': 'Reacción · área Close · enemigos Instinct DC 10 · fallo: Desventaja · con Fear, Dazed',
  'Spark of Hope': 'Apoyo · aliado Melee · −1 Stress',
  "Wayfinder's Pulse": 'Detección · Far · amenaza, salida y objetos ocultos más cercanos',
  'Eyes of Truth': 'Mejora · una escena · ves ilusiones e invisibles · Ventaja en Instinct para percibir',
  'Photon Shield': 'Reacción · aliado Close dañado · −{T2} al daño (doble contra Veil-Touched)',
  'Aura of Clarity': 'Hechizo · Presence DC 15 · área Close · inmunes a Frightened y Dazed · umbrales +1',
  'Stellar Lance': 'Ataque a distancia · Presence DC 15 · Far · {P}d8 Energy (Radiant) · Devastating contra Heavy',
  // Sleeping: Common Efforts, Bear Down and Uncanny Power
  'Steady Hands': 'Esfuerzo · +2 a tu próxima tirada',
  'Read the Room': 'Esfuerzo · una pregunta táctica o social: respuesta cierta',
  'Push Through': 'Esfuerzo · ignoras una penalización menor en tu próxima acción',
  'The Opening': 'Esfuerzo · Ventaja en tu próxima tirada',
  'Try Again': 'Esfuerzo · relanza un dado de Dualidad',
  'Brace': 'Esfuerzo · el próximo impacto baja una banda de gravedad',
  'Cover the Angle': 'Esfuerzo · un aliado +2 a su próxima tirada',
  'Second Wind': 'Esfuerzo · −2 Stress',
  'Seize the Moment': 'Esfuerzo · tras un éxito, una consecuencia favorable extra',
  'Bear Down': 'Resolve · suma dados de Resolve a tu última tirada o daño',
  // Class Features split in named abilities (v2.43.5).
  'Sneak Attack': 'Pasivo · ataque con Ventaja que impacta: +{T}d6 de daño (una vez por ataque)',
  'The Quiet Network': 'Una vez por sesión · un contacto local: reunión, refugio, oportunidad o servicio',
  'Shadow Operative': 'Ventaja en tiradas de sigilo · 1/sesión, repite una Agility fallida para esquivar',
  'Trained Body': 'Pasivo · golpes desarmados Melee d6 (d8 en Tier 2, d10 en Tier 3) con Strength o Agility',
  'Unbroken Focus': '+1 Evasión sin armadura Heavy · 1/escena, 1 Effort: no marcas un Stress',
  'The Refusal': 'Reacción · 1/escena, 1 Effort · Desventaja a un Poder o Ventaja a su tirada de reacción (Close)',
  'Stellar Instinct': '+2 a Finesse (Pilot/Navigate) · 1/sesión, repite un dado de Dualidad al fallar',
  'Pilot Surge Die': 'Pasivo · al gastar Hope en un rasgo de Pilot, suma d6 (d8 Tier 2, d10 Tier 3)',
  'Uncanny Power': 'Resolve · tira el acceso y lanza un Poder del Archivo',
};

const tierOf = level => { const l = Number(level) || 1; return l <= 4 ? 1 : l <= 7 ? 2 : 3; };
const fill = (line, token) => {
  const p = Math.max(1, Number(token?.proficiency) || 1), t = tierOf(token?.level);
  return line.replaceAll('{P}', String(p)).replaceAll('{T2}', String(t + 2)).replaceAll('{T}', String(t));
};
const TRAITS = 'Agility|Finesse|Strength|Instinct|Knowledge|Presence';

// A summary built from the card's printed data, for the cards without one written by hand.
export function autoSummary(card, token) {
  const text = String(card?.text || '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
  const parts = [];
  parts.push(card.reaction ? 'Reacción' : /passive/i.test(card.type || '') ? 'Pasivo' : /spell/i.test(card.type || '') ? 'Hechizo' : card.kind === 'move' ? 'Resolve' : card.kind === 'effort' ? 'Esfuerzo' : 'Habilidad');
  const dc = card.rollText || (new RegExp('(' + TRAITS + ')[^.]{0,30}?DC\\s*(\\d+)', 'i').exec(text)?.slice(1).join(' DC ') || '');
  if (dc && dc !== '—') parts.push(dc.replace(/^DC (\d+) \((\w+)\)$/, '$2 DC $1'));
  const area = areaRule(card), rule = TARGET_RULES[card.name];
  if (area) parts.push('área ' + area.reach);
  else if (rule?.reach) parts.push('objetivo ' + rule.reach);
  else { const reach = /within (Melee|Very Close|Close|Far|Very Far)\b/i.exec(text)?.[1]; if (reach) parts.push(reach); }
  const dmg = /\(Proficiency\)\s*[×x]\s*d(\d+)\s+(\w+)/i.exec(text) || /\b(\d+d\d+)\s+(\w+) damage/i.exec(text);
  if (dmg) parts.push((dmg[1].includes('d') ? dmg[1] : Math.max(1, Number(token?.proficiency) || 1) + 'd' + dmg[1]) + ' ' + dmg[2]);
  const time = /\b(for (?:one|the|a) scene|for 1 hour|for 10 minutes|for 1 minute|for 24 hours|until the end of the scene)\b/i.exec(text)?.[1];
  if (time) parts.push({ 'for one scene': 'una escena', 'for the scene': 'una escena', 'for a scene': 'una escena', 'for 1 hour': '1 h', 'for 10 minutes': '10 min', 'for 1 minute': '1 min', 'for 24 hours': '24 h', 'until the end of the scene': 'una escena' }[time.toLowerCase()] || time);
  if (parts.length < 3) {
    const first = text.replace(/^(Trigger:[^.]*\.|Reaction\.|Spend \d+ \w+\.|Mark \d+ \w+\.|Cost:[^.]*\.)\s*/gi, '').split(/(?<=\.)\s/)[0] || '';
    if (first) parts.push(first.length > 70 ? first.slice(0, 68).trim() + '…' : first.replace(/\.$/, ''));
  }
  return parts.join(' · ');
}

export function cardSummary(card, token) {
  if (!card) return '';
  const own = SUMMARIES[card.name] || SUMMARIES[String(card.name).replace(/\s*\(.*\)$/, '')];
  return own ? fill(own, token) : autoSummary(card, token);
}
