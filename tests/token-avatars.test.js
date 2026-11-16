import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ANCESTRY_IDS,
  ANCESTRY_TOKEN_AVATARS,
  ARCHETYPES,
  ARCHETYPE_META,
  normalizeAncestryId,
  detectGender,
  detectArchetype,
  getArchetypeTokenAvatar,
  listAncestryArchetypeTokens,
  defaultTokenAvatar,
} from '../src/tokenAvatars.js';
import { createActor } from '../src/actors.js';
import { parseCharacterJSON } from '../src/characterImport.js';

test('ARCHETYPES covers the four canon requested tipologías', () => {
  assert.deepEqual(ARCHETYPES, ['warrior', 'mystic', 'scoundrel', 'engineer']);
  assert.ok(ARCHETYPE_META.warrior.label.includes('Guerrero'));
  assert.ok(ARCHETYPE_META.mystic.label.includes('Erudito') || ARCHETYPE_META.mystic.label.includes('Mago'));
  assert.ok(ARCHETYPE_META.scoundrel.label.includes('Pícaro') || ARCHETYPE_META.scoundrel.label.includes('Explorador'));
  assert.ok(ARCHETYPE_META.engineer.label.includes('Técnico') || ARCHETYPE_META.engineer.label.includes('Científico'));
});

test('detectArchetype accurately categorizes classes, subclasses and roles', () => {
  // Warriors (Soldier, Vanguard, frontline)
  assert.equal(detectArchetype('Soldier'), 'warrior');
  assert.equal(detectArchetype('Vanguard'), 'warrior');
  assert.equal(detectArchetype('Guerrero'), 'warrior');
  assert.equal(detectArchetype('Peacekeeper'), 'warrior');
  assert.equal(detectArchetype('Blade Adept'), 'warrior');

  // Mystics (Mystic, Scholar psionic, Veil channelers)
  assert.equal(detectArchetype('Mystic'), 'mystic');
  assert.equal(detectArchetype('Místico'), 'mystic');
  assert.equal(detectArchetype('Scholar'), 'mystic');
  assert.equal(detectArchetype('Psiónico'), 'mystic');
  assert.equal(detectArchetype('Void Conduit'), 'mystic');

  // Scoundrel (Scoundrel, Explorer, recon, stealth)
  assert.equal(detectArchetype('Scoundrel'), 'scoundrel');
  assert.equal(detectArchetype('Pícaro'), 'scoundrel');
  assert.equal(detectArchetype('Explorer'), 'scoundrel');
  assert.equal(detectArchetype('Explorador'), 'scoundrel');
  assert.equal(detectArchetype('Infiltrator'), 'scoundrel');

  // Engineer (Engineer, Diplomat, tech, artisan)
  assert.equal(detectArchetype('Engineer'), 'engineer');
  assert.equal(detectArchetype('Ingeniero'), 'engineer');
  assert.equal(detectArchetype('Técnico'), 'engineer');
  assert.equal(detectArchetype('Diplomat'), 'engineer');
  assert.equal(detectArchetype('Pilot'), 'engineer');
});

test('getArchetypeTokenAvatar and listAncestryArchetypeTokens return correct URLs', () => {
  assert.equal(getArchetypeTokenAvatar('rift_spinner', 'warrior', 'm'), '/assets/tokens/rift_spinner_warrior_m.jpg');
  assert.equal(getArchetypeTokenAvatar('kryx', 'mystic', 'f'), '/assets/tokens/kryx_mystic_f.jpg');
  assert.equal(getArchetypeTokenAvatar('kryllian', 'engineer', 'm'), '/assets/tokens/kryllian_engineer_m.jpg');

  const list = listAncestryArchetypeTokens('Kryx', 'he/him', 'Brok');
  assert.equal(list.length, 4);
  assert.equal(list[0].id, 'warrior');
  assert.equal(list[0].avatarUrl, '/assets/tokens/kryx_warrior_m.jpg');
  assert.equal(list[1].id, 'mystic');
  assert.equal(list[1].avatarUrl, '/assets/tokens/kryx_mystic_m.jpg');
  assert.equal(list[2].id, 'scoundrel');
  assert.equal(list[2].avatarUrl, '/assets/tokens/kryx_scoundrel_m.jpg');
  assert.equal(list[3].id, 'engineer');
  assert.equal(list[3].avatarUrl, '/assets/tokens/kryx_engineer_m.jpg');
});

test('every base ancestry × gender portrait exists on disk and is non-empty', () => {
  assert.equal(ANCESTRY_IDS.length, 9);
  for (const ancestry of ANCESTRY_IDS) {
    for (const gender of ['m', 'f']) {
      const relPath = ANCESTRY_TOKEN_AVATARS[ancestry][gender];
      assert.ok(relPath, `Missing avatar entry for ${ancestry}_${gender}`);
      const diskPath = path.resolve(process.cwd(), 'public', relPath.replace(/^\//, ''));
      assert.ok(fs.existsSync(diskPath), `Disk file missing: ${diskPath}`);
      const stats = fs.statSync(diskPath);
      assert.ok(stats.size > 1000, `File too small/corrupt: ${diskPath} (${stats.size} bytes)`);
    }
  }
});

test('normalizeAncestryId correctly identifies all canonical species variants', () => {
  assert.equal(normalizeAncestryId('Ailuran'), 'ailuran');
  assert.equal(normalizeAncestryId('Bloomstrider'), 'bloomstrider');
  assert.equal(normalizeAncestryId('Celestiari'), 'celestiari');
  assert.equal(normalizeAncestryId('Ethereal'), 'ethereal');
  assert.equal(normalizeAncestryId('Etéreo'), 'ethereal');
  assert.equal(normalizeAncestryId('Etérea'), 'ethereal');
  assert.equal(normalizeAncestryId('Human'), 'human');
  assert.equal(normalizeAncestryId('Humano'), 'human');
  assert.equal(normalizeAncestryId('Humana'), 'human');
  assert.equal(normalizeAncestryId('Kryllian'), 'kryllian');
  assert.equal(normalizeAncestryId('Kryx'), 'kryx');
  assert.equal(normalizeAncestryId('Rift Spinner'), 'rift_spinner');
  assert.equal(normalizeAncestryId('Tejedor del Velo'), 'rift_spinner');
  assert.equal(normalizeAncestryId('Synthetic'), 'synthetic');
  assert.equal(normalizeAncestryId('Sintético'), 'synthetic');
  assert.equal(normalizeAncestryId('UnknownAlien'), 'human');
});

test('detectGender handles pronouns and name heuristics accurately', () => {
  assert.equal(detectGender('she/her'), 'f');
  assert.equal(detectGender('Ella'), 'f');
  assert.equal(detectGender('femenino'), 'f');
  assert.equal(detectGender('he/him'), 'm');
  assert.equal(detectGender('él'), 'm');
  assert.equal(detectGender('masculino'), 'm');

  assert.equal(detectGender('', 'Lucy Fer'), 'f');
  assert.equal(detectGender('', 'Jaraña'), 'f');
  assert.equal(detectGender('', 'Brok'), 'm');
  assert.equal(detectGender('', 'Miles'), 'm');
  assert.equal(detectGender('', 'Elena'), 'f');
  assert.equal(detectGender('', 'Marcus'), 'm');
});

test('createActor sets default avatarUrl based on species, pronouns and class', () => {
  const actor = createActor({
    name: 'Kryx Warrior',
    species: 'Kryx',
    pronouns: 'he/him',
    characterClass: 'Soldier',
  });
  assert.equal(actor.avatarUrl, '/assets/tokens/kryx_warrior_m.jpg');

  // Custom avatar is preserved
  const customActor = createActor({
    name: 'Custom Operative',
    species: 'Human',
    avatarUrl: '/assets/custom/agent.png',
  });
  assert.equal(customActor.avatarUrl, '/assets/custom/agent.png');

  // Adversary gets adversary marker by default
  const adversary = createActor({
    name: 'Void Fiend',
    actorType: 'adversary',
  });
  assert.equal(adversary.avatarUrl, '/assets/tokens/adversary-marker.svg');
});

test('parseCharacterJSON assigns archetype token based on class and pronouns on fixtures', () => {
  const readFixture = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/creator/${name}.json`, import.meta.url), 'utf8'));

  // Brok: Kryx Soldier (male) -> kryx_warrior_m.jpg
  const brok = parseCharacterJSON(readFixture('Brok'));
  assert.equal(brok.token.avatarUrl, '/assets/tokens/kryx_warrior_m.jpg');

  // Jaraña: Rift Spinner Vanguard (female) -> rift_spinner_warrior_f.jpg
  const jarana = parseCharacterJSON(readFixture('Jarana'));
  assert.equal(jarana.token.avatarUrl, '/assets/tokens/rift_spinner_warrior_f.jpg');

  // Lucy Fer: Human Mystic (female) -> human_mystic_f.jpg
  const lucy = parseCharacterJSON(readFixture('Lucy_Fer'));
  assert.equal(lucy.token.avatarUrl, '/assets/tokens/human_mystic_f.jpg');

  // Miles: Human Diplomat (male) -> human_engineer_m.jpg
  const miles = parseCharacterJSON(readFixture('Miles'));
  assert.equal(miles.token.avatarUrl, '/assets/tokens/human_engineer_m.jpg');
});
