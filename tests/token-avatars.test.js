import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ANCESTRY_IDS,
  ANCESTRY_TOKEN_AVATARS,
  normalizeAncestryId,
  detectGender,
  defaultTokenAvatar,
} from '../src/tokenAvatars.js';
import { createActor } from '../src/actors.js';
import { parseCharacterJSON } from '../src/characterImport.js';

test('every ancestry × gender portrait exists on disk and is non-empty', () => {
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
  assert.equal(normalizeAncestryId('UnknownAlien'), 'human'); // fallback
});

test('detectGender handles pronouns and name heuristics accurately', () => {
  // Pronouns feminine
  assert.equal(detectGender('she/her'), 'f');
  assert.equal(detectGender('Ella'), 'f');
  assert.equal(detectGender('femenino'), 'f');

  // Pronouns masculine
  assert.equal(detectGender('he/him'), 'm');
  assert.equal(detectGender('él'), 'm');
  assert.equal(detectGender('masculino'), 'm');

  // Name heuristics when pronouns empty
  assert.equal(detectGender('', 'Lucy Fer'), 'f');
  assert.equal(detectGender('', 'Jaraña'), 'f');
  assert.equal(detectGender('', 'Brok'), 'm');
  assert.equal(detectGender('', 'Miles'), 'm');
  assert.equal(detectGender('', 'Elena'), 'f');
  assert.equal(detectGender('', 'Marcus'), 'm');
});

test('defaultTokenAvatar returns correct image paths', () => {
  assert.equal(defaultTokenAvatar('Ailuran', 'she/her'), '/assets/tokens/ailuran_f.jpg');
  assert.equal(defaultTokenAvatar('Ailuran', 'he/him'), '/assets/tokens/ailuran_m.jpg');
  assert.equal(defaultTokenAvatar('Bloomstrider', 'f'), '/assets/tokens/bloomstrider_f.jpg');
  assert.equal(defaultTokenAvatar('Bloomstrider', 'm'), '/assets/tokens/bloomstrider_m.jpg');
  assert.equal(defaultTokenAvatar('Celestiari', 'f'), '/assets/tokens/celestiari_f.jpg');
  assert.equal(defaultTokenAvatar('Celestiari', 'm'), '/assets/tokens/celestiari_m.jpg');
  assert.equal(defaultTokenAvatar('Ethereal', 'f'), '/assets/tokens/ethereal_f.jpg');
  assert.equal(defaultTokenAvatar('Ethereal', 'm'), '/assets/tokens/ethereal_m.jpg');
  assert.equal(defaultTokenAvatar('Kryllian', 'f'), '/assets/tokens/kryllian_f.jpg');
  assert.equal(defaultTokenAvatar('Kryllian', 'm'), '/assets/tokens/kryllian_m.jpg');
  assert.equal(defaultTokenAvatar('Kryx', '', 'Brok'), '/assets/tokens/kryx_m.jpg');
  assert.equal(defaultTokenAvatar('Rift Spinner', '', 'Jaraña'), '/assets/tokens/rift_spinner_f.jpg');
  assert.equal(defaultTokenAvatar('Human', '', 'Lucy Fer'), '/assets/tokens/human_f.jpg');
  assert.equal(defaultTokenAvatar('Human', 'he/him', 'Miles'), '/assets/tokens/human_m.jpg');
  assert.equal(defaultTokenAvatar('Synthetic', 'she/her'), '/assets/tokens/synthetic_f.jpg');
  assert.equal(defaultTokenAvatar('Synthetic', 'he/him'), '/assets/tokens/synthetic_m.jpg');
});

test('createActor sets default avatarUrl based on species and pronouns', () => {
  const actor = createActor({
    name: 'Kryx Warrior',
    species: 'Kryx',
    pronouns: 'he/him',
  });
  assert.equal(actor.avatarUrl, '/assets/tokens/kryx_m.jpg');

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

test('parseCharacterJSON assigns default token avatar according to ancestry and pronouns on fixtures', () => {
  const readFixture = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/creator/${name}.json`, import.meta.url), 'utf8'));

  const brok = parseCharacterJSON(readFixture('Brok'));
  assert.equal(brok.token.avatarUrl, '/assets/tokens/kryx_m.jpg');

  const jarana = parseCharacterJSON(readFixture('Jarana'));
  assert.equal(jarana.token.avatarUrl, '/assets/tokens/rift_spinner_f.jpg');

  const lucy = parseCharacterJSON(readFixture('Lucy_Fer'));
  assert.equal(lucy.token.avatarUrl, '/assets/tokens/human_f.jpg');

  const miles = parseCharacterJSON(readFixture('Miles'));
  assert.equal(miles.token.avatarUrl, '/assets/tokens/human_m.jpg');
});
