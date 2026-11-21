// Editorial labels describe the fiction; the printed timing and cost remain on the card.
const groups = {
  Spell: 'Phase Scatter|Phase Form|Reality Theft|Veil Step|Shadow Step|Dimensional Rift|Reality Warp|Reality Warping|Phase Through|Vessel Migration|Reformation|Temporal Displacement|Phase Shift|Blink|Rewrite|Temporal Reset|Living City|Power Word',
  'Physical Ability': 'Swarm Tactics|Wire-Chewer|Scatter|Chameleonic Skin|Pack Tactics|Blackout Hunt|Swarm|Integrate|Fanatical Devotion|Ambush Predator|Unnatural Anatomy|Territorial Rage|Multi-Limb|Rapid Adaptation|Consume Trait|Unstable Biology|Unstable Mitosis|Massive|Accelerated Consumption|Volatile|Translucent|Scuttle|Vanish|Overclock|Active Camo|Consume and Grow|Hard Light Form|Forced Evolution|Assimilation',
  'Physical Attack': 'Throat-Ripper|Corroded Slam|Suicide Strike|Fanatical Charge|Acid Spray|Unstoppable Charge|Tectonic Charge|Rending Claws|Tail Sweep|Crushing Embrace|Multi-Limb Assault|Predatory Sample|Swallow Whole|Group Attack|Self-Destruct|Neurotoxin|Desperate Strike|Filthy Shank|Suppressive Fire|Shadow Pounce|Chain-Glaive Sweep|Rotary Suppression|Mono-Filament|Mother\'s Fury|Salvo|Main Cannon Charge',
  Defense: 'Repair Protocol|Unstoppable|Willing Sacrifice|Desperate Anchor|Entropic Shield|Reconstruction|Thick Hide|Void Shield|Regeneration|Regenerative Metabolism|Perfect Serenity|Refractive Carapace|Shrug it Off|Walking Fortress|Reactive Plating|Adaptive Shielding|Chitinous Plating|Internal Defense',
  'Magical Attack': 'Life Drain|Energy Drain|Drain Surge|Reality Corrosion|Consume Fear|Life Tap|Void Bolt|Format Lance|Gaze of the Void|Reality Tear|Hollow Whispers|Quantum Surge|Energy Siphon|Feedback Loop|Reality Bite|Rift Tear|Mind-Shatter|Disintegration|Blink-Fire|Mind-Burn|Erasure Beam|Gravity Shear|Unmake|Timeline Fracture',
  Control: 'Silence Aura|Magnetic Vortex|Terrifying Presence|Rust Aura|Gravity Well|Ink Cloud|Dominate Will|Mass Conversion|Tidal Wake|Mass Calm|Compliance Protocol|Monofilament Trap|Crystal Cage|Wireless Jam|Steel Grip|Alpha Challenge|Petrify|Smoke & Mirrors|Kill the Lights|Nest Collapse|System Control|Psychic Song|Veil Wake|Time Dilation|Spore Choke',
  Support: 'Networked Response|Designation Protocol|Harmony Pulse|Guardian Call|Spawn Heralds|Networked|Form Up|Fire-Control Mark|Rapid Spawning|Pheromone Frenzy|Drone Swarm|Echoes of Rule',
  Utility: 'Emotion Sense|Hope-Seeker|Void Trail|Metal-Sense|Perfect Tracking|Apex Predator|Destroy the Anchor|Shield-Sense|Ancestral Memory|Heat Seeker|Tactical Reload|Echolocation|Vibration Sense|Blood Scent|Crystalline Prism|Reactor Leak|Vent Heat|Omniscience|Precognition',
};
const labels = new Map(Object.entries(groups).flatMap(([label, names]) =>
  names.split('|').map(name => [name.toLowerCase(), label])));
export function enemyCategory(ability) {
  const printed = labels.get(ability.name.toLowerCase());
  if (printed) return printed;
  const words = ability.name + ' ' + ability.text;
  if (/shield|armor|mitigate|resist|reduce.*damage/i.test(words)) return 'Defense';
  if (/heal|repair|ally|allies/i.test(words)) return 'Support';
  if (/immobiliz|restrain|stun|jammed/i.test(words)) return 'Control';
  if (/psionic|arcane|spell|magical/i.test(words)) return /damage|attack/i.test(words) ? 'Magical Attack' : 'Spell';
  if (/attack|damage|strike|claw|bite/i.test(words)) return 'Physical Attack';
  if (/jump|climb|leap|crawl/i.test(words)) return 'Physical Ability';
  return 'Utility';
}
