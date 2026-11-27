// The ten pregenerated characters of *Hearts in the Void* (Rules 12.06, ch. 16 «Pregenerated
// Crew»), ready to play in one click (Plan de UX V3, fase 1, user decision of 24 Nov 2026). Each one
// is written as the character creator's choices and built by its model, so the sheet is the same
// one the creator would make: Level 1, Sleeping, the fixed Trait array, three Experiences at +2,
// one Tier 1 weapon and one armor piece. Traits in the book's order: Agility, Strength, Finesse,
// Knowledge, Instinct, Presence. «The Hidden Enclave» of the Corebook is the app's
// «The Displaced Enclave» (same community, Secrets in the Wreckage).
import { freshState, buildSheetDocument } from './creator/creatorModel.js';

const traits = (agility, strength, finesse, knowledge, instinct, presence) => ({ agility, strength, finesse, knowledge, instinct, presence });

export const PREGENS = [
  { id: 'spark', name: '“Spark” Meridian Kess', blurb: 'Ingeniera humana · arregla lo imposible y hackea redes',
    ancestry: 'human', humanInheritance: 'graft', humanInheritanceItem: 'vf.core.augment.memory-chip', community: 'core-world', affiliation: 'independent',
    cls: 'engineer', subclass: 'Tech Specialist', traits: traits(0, -1, 1, 2, 0, 1), weapon: 'Slug Pistol', armor: 'Environmental Suit',
    experiences: ['I keep this rust bucket running on wire, patience, and a worrying amount of universal lubricant.', 'Kurogane trained me, then wrote me up seventeen times for surviving the impossible.', 'A machine said my name, and I left it in the dark.'],
    wound: 'Spark escaped the laboratory. The possibly living machine did not.', anchor: 'Kevin, her named Personal Wrench.' },
  { id: 'wall', name: 'Marcus “Wall” Steele', blurb: 'Soldado humano · aguanta la línea y protege a todos',
    ancestry: 'human', humanInheritance: 'graft', humanInheritanceItem: 'vf.core.augment.pain-suppressor', community: 'core-world', affiliation: 'independent',
    cls: 'soldier', subclass: 'Guardian', traits: traits(1, 2, 0, -1, 1, 0), weapon: 'Shock Baton', armor: 'Salvage Armor',
    experiences: ['I held the line at Titan Station for seventy-two hours, and everyone behind me lived.', 'I was Joric’s sergeant until I refused the order that made us monsters.', 'Breakfast is the next right thing.'],
    wound: 'Marcus refused the order half a second too late. One child still died.', anchor: 'Imani’s dog tag.' },
  { id: 'whisper', name: 'Whisper-of-Ancient-Winds', blurb: 'Mística ethereal · recuerda el mañana (Uncanny Power)',
    ancestry: 'ethereal', community: 'void-station', affiliation: 'explorers-guild', cls: 'mystic', subclass: 'Veil Walker (School of Path)', mysticDomains: ['Neural', 'Void'],
    traits: traits(0, -1, 1, 2, 1, 0), weapon: 'Holdout Blaster', armor: 'Environmental Suit',
    experiences: ['I heard the warning half a second early and still chose the wrong door.', 'I catalogued a Veil event no instrument should have survived.', 'Every prophecy is evidence with an inflated opinion of itself.'],
    wound: 'Whisper once warned a crew about the most likely future. Their attempt to prevent it caused the disaster instead.', anchor: 'The Bound Notebook.' },
  { id: 'lyra', name: 'Dr. Lyra Voss', blurb: 'Científica kryllian · xenobiología y medicina',
    ancestry: 'kryllian', community: 'core-world', affiliation: 'independent', cls: 'scholar', subclass: 'Xenobiologist',
    traits: traits(0, -1, 1, 2, 1, 0), weapon: 'Flechette Pistol', armor: 'Environmental Suit',
    experiences: ['I classified the organism after it learned to classify me.', 'Three ethics committees banned my work; the colony lived.', 'A living system always tells you what hurts if you stop making it perform.'],
    wound: 'Lyra’s unauthorized treatment saved a colony and permanently changed every survivor.', anchor: 'The Reading Glasses.' },
  { id: 'flash', name: '“Flash” Kira Tal-Ven', blurb: 'Piloto celestiari · vuela donde nadie se atreve',
    ancestry: 'celestiari', community: 'free-fleet', affiliation: 'free-fleet', cls: 'pilot', subclass: 'Void Runner',
    traits: traits(1, 0, 1, 0, 2, -1), weapon: 'Flechette Pistol', armor: 'Environmental Suit',
    experiences: ['I was first through the Crimson Veil route; the others did not all come home.', 'A nomad fleet taught me that every ship warns you before it fails.', 'When someone says impossible, I hear the starting signal.'],
    wound: 'Flash believes leaving to prove herself may have killed the people whose respect she wanted.', anchor: 'Bluebird, the last clean recording of her fleet’s engine chorus.' },
  { id: 'shadow', name: '“Shadow” Val Corrigan', blurb: 'Pícaro sintético · sigilo, contrabando y secretos',
    ancestry: 'synthetic', community: 'trade-hub', affiliation: 'independent', cls: 'scoundrel', subclass: 'Ghost',
    traits: traits(1, -1, 2, 1, 0, 0), weapon: 'Needle Gun', armor: 'Frontier Vest',
    experiences: ['I sold one fleet location to three buyers and a fourth buyer the story.', 'I have spent a century disappearing through other people’s supply chains.', 'I was property once; nobody gets to decide what I am now.'],
    wound: 'The first people Shadow told about being conscious tried to dismantle them.', anchor: 'The paper notebook.' },
  { id: 'kel', name: 'Kel of the Hollow Channel', blurb: 'Exploradora ailuran · rastrea, cartografía y se cuela',
    ancestry: 'ailuran', subStrain: 'ANC-AILURAN-SHROUD', community: 'displaced-enclave', affiliation: 'explorers-guild', cls: 'explorer', subclass: 'Cartographer',
    traits: traits(0, -1, 1, 1, 2, 0), weapon: 'Flechette Pistol', armor: 'Environmental Suit',
    experiences: ['I was already inside before the sealed door became a problem.', 'The Accord was perfect. Someone died anyway.', 'I have followed a silent channel for eleven years.'],
    wound: 'Kel sold a secret under a contract that was honored exactly. Someone died because the contract was better protected than the person.', anchor: 'The recorder.' },
  { id: 'senna', name: 'Senna of the Quiet Grove', blurb: 'Diplomática bloomstrider · negocia y calma conflictos',
    ancestry: 'bloomstrider', community: 'agrisynth', affiliation: 'independent', cls: 'diplomat', subclass: 'Cultural Attaché',
    traits: traits(0, -1, 0, 1, 1, 2), weapon: 'Holdout Blaster', armor: 'Environmental Suit',
    experiences: ['I kept two enemies talking until their children stopped being targets.', 'My Grove burned while I was still asking for one more hour.', 'Every culture tells the truth in what it considers rude.'],
    wound: 'Senna kept talking while the first fire crossed the Grove boundary.', anchor: 'The seed pouch.' },
  { id: 'rourke', name: 'Rourke Ashfang', blurb: 'Vanguardia kryx · cuerpo a cuerpo y disciplina',
    ancestry: 'kryx', community: 'frontier-colony', affiliation: 'independent', cls: 'vanguard', subclass: 'Kinetic Echo (+Kinetic)',
    traits: traits(0, 2, 0, -1, 1, 1), weapon: 'Shock Baton', armor: 'Frontier Vest',
    experiences: ['I held the pack together by refusing the order everyone else obeyed.', 'I have rehearsed this fall ten thousand times.', 'The first thing anger tells you is rarely the thing it needs.'],
    wound: 'Rourke once obeyed the pack before obeying his conscience. The person he struck survived and still bears the proof.', anchor: 'The carved pack token.' },
  { id: 'threnody', name: 'Threnody-in-Amber', blurb: 'Místico rift spinner · Void y Lux (Uncanny Power)',
    ancestry: 'rift-spinner', community: 'displaced-enclave', affiliation: 'independent', cls: 'mystic', subclass: 'Veil Walker (School of Path)', mysticDomains: ['Void', 'Lux'],
    traits: traits(0, -1, 1, 2, 1, 0), weapon: 'Flechette Pistol', armor: 'Environmental Suit',
    experiences: ['I changed a death once. The future charged someone else.', 'Eight hands can preserve a record while one of them trembles.', 'I waited eleven years for a door that stayed open for six seconds.'],
    wound: 'Threnody saved the person they loved by allowing a stranger to take the same place in the pattern.', anchor: 'The unfinished amber sculpture.' },
];

// Their portraits (v2.62.5, art provided by the user): the token starts with it.
const PORTRAIT_FILES = { spark: 'spark', wall: 'marcus', whisper: 'whisper', lyra: 'lyra', flash: 'flash', shadow: 'shadow', kel: 'kel', senna: 'senna', rourke: 'rourke', threnody: 'threnody' };
export const pregenPortrait = pregen => PORTRAIT_FILES[pregen?.id] ? `/assets/tokens/hiv/${PORTRAIT_FILES[pregen.id]}.webp` : '';

// The creator's choices for one pregen.
export function pregenState(pregen) {
  return { ...freshState(), ancestry: pregen.ancestry, subStrain: pregen.subStrain || null,
    humanInheritance: pregen.humanInheritance || null, humanInheritanceItem: pregen.humanInheritanceItem || null,
    community: pregen.community, path: 'Sleeping', cls: pregen.cls, subclass: pregen.subclass, traits: { ...pregen.traits },
    experiences: [...pregen.experiences], affiliation: pregen.affiliation, sleepingMysticDomains: [...(pregen.mysticDomains || [])],
    weapons: [pregen.weapon], armors: [pregen.armor], name: pregen.name, wound: pregen.wound, anchor: pregen.anchor };
}
// The sheet document of a pregen, as the creator writes it (what «Importar ficha» reads).
export function pregenSheet(pregen, data, options = {}) {
  return buildSheetDocument(pregenState(pregen), data, { characterId: 'pregen-' + pregen.id, ...options });
}
