import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ANCESTRY_IDS, TOKEN_CLASSES, PORTRAIT_GENDERS, actorPortrait,
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
import { createActor, replaceActorSheet } from '../src/actors.js';
import { parseCharacterJSON } from '../src/characterImport.js';
import { TIER_ONE_PORTRAITS, tierOnePortrait } from '../src/bestiaryPortraits.js';
import { loadAdversaries } from '../scripts/adversary-library.mjs';
import { loadEncounters } from '../scripts/encounter-library.mjs';

test('Tier 1 book profiles, phased bosses and both Refuge creatures have distinct usable artwork', () => {
  const names = [
    ...loadAdversaries().filter(profile => profile.tier === 1).map(profile => profile.name),
    ...loadEncounters().bosses.filter(profile => ['keeper-boss-1', 'keeper-boss-2', 'keeper-boss-3'].includes(profile.id)).map(profile => profile.name),
    'Hunger Weaver', 'Weaver Queen',
  ];
  assert.equal(names.length, 14);
  const urls = names.map(name => {
    const url = tierOnePortrait(name);
    assert.ok(url, name);
    assert.equal(createActor({ actorType: 'adversary', name }, 'refuge').avatarUrl, url);
    const bytes = fs.readFileSync(new URL('../public' + url, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    return url;
  });
  assert.deepEqual(new Set(urls), new Set(TIER_ONE_PORTRAITS.map(p => p.url)));
  assert.equal(new Set(urls).size, 13);
  assert.equal(tierOnePortrait('Skitter-Rat Swarm'), tierOnePortrait('Charon Skitter-Rat Swarm'));
});

test('saved enemy tokens upgrade generic art and keep a chosen or renamed portrait', () => {
  const security = { name: 'Security Drone Model-V', isPlayer: false, actorType: 'adversary' };
  const oldArt = '/assets/cards/domain-tech-flag.png';
  const securityArt = tierOnePortrait(security.name);
  const ratArt = tierOnePortrait('Skitter-Rat Swarm');
  assert.equal(actorPortrait({ ...security, avatarUrl: oldArt }), securityArt);
  assert.equal(actorPortrait({ ...security, avatarUrl: oldArt, portraitOverride: true }), oldArt);
  assert.equal(actorPortrait({ ...security, avatarUrl: ratArt }), securityArt);
  assert.equal(actorPortrait({ ...security, avatarUrl: ratArt, portraitOverride: true }), ratArt);
  assert.equal(actorPortrait({ ...security, name: 'Dock security', avatarUrl: securityArt }), securityArt);
  assert.equal(actorPortrait({ ...security, avatarUrl: '/portraits/my-drone.webp' }), '/portraits/my-drone.webp');
  assert.equal(actorPortrait({ ...security, actorType: 'drone' }), oldArt);
});

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
  assert.equal(getArchetypeTokenAvatar('rift_spinner', 'warrior', 'm'), '/assets/tokens/classes/rift_spinner-soldier-m.svg');
  assert.equal(getArchetypeTokenAvatar('kryx', 'mystic', 'f'), '/assets/tokens/classes/kryx-mystic-f.svg');
  assert.equal(getArchetypeTokenAvatar('kryllian', 'engineer', 'm'), '/assets/tokens/classes/kryllian-engineer-m.svg');

  const list = listAncestryArchetypeTokens('Kryx', 'he/him', 'Brok');
  assert.equal(list.length, 4);
  assert.equal(list[0].id, 'warrior');
  assert.equal(list[0].avatarUrl, '/assets/tokens/classes/kryx-soldier-m.svg');
  assert.equal(list[1].id, 'mystic');
  assert.equal(list[1].avatarUrl, '/assets/tokens/classes/kryx-mystic-m.svg');
  assert.equal(list[2].id, 'scoundrel');
  assert.equal(list[2].avatarUrl, '/assets/tokens/classes/kryx-scoundrel-m.svg');
  assert.equal(list[3].id, 'engineer');
  assert.equal(list[3].avatarUrl, '/assets/tokens/classes/kryx-engineer-m.svg');
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
  assert.equal(actor.avatarUrl, '/assets/tokens/classes/kryx-soldier-m.svg');

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

  // Brok: Kryx Soldier (male)
  const brok = parseCharacterJSON(readFixture('Brok'));
  assert.equal(brok.token.avatarUrl, '/assets/tokens/classes/kryx-soldier-m.svg');

  // Jaraña: Rift Spinner Vanguard (female)
  const jarana = parseCharacterJSON(readFixture('Jarana'));
  assert.equal(jarana.token.avatarUrl, '/assets/tokens/classes/rift_spinner-vanguard-f.svg');

  // Lucy Fer: Human Mystic (female)
  const lucy = parseCharacterJSON(readFixture('Lucy_Fer'));
  assert.equal(lucy.token.avatarUrl, '/assets/tokens/classes/human-mystic-f.svg');

  // Miles: Human Diplomat (male)
  const miles = parseCharacterJSON(readFixture('Miles'));
  assert.equal(miles.token.avatarUrl, '/assets/tokens/classes/human-diplomat-m.svg');
});


test('all ancestry, class and gender combinations resolve to standalone build images', async () => {
  const { tokenPortraitsPlugin } = await import('../scripts/token-portraits.mjs');
  const images = new Map();
  tokenPortraitsPlugin().generateBundle.call({ emitFile: asset => images.set('/' + asset.fileName, asset.source) });
  const seen = new Set(), paintings = new Set();
  for (const species of ANCESTRY_IDS) for (const cls of TOKEN_CLASSES) for (const gender of PORTRAIT_GENDERS) {
    const pronouns = { m: 'he/him', f: 'she/her', n: 'they/them' }[gender];
    const url = defaultTokenAvatar(species, pronouns, '', cls);
    seen.add(url);
    assert.match(images.get(url), /viewBox="0 0 768 768"/);
    const encoded = /data:image\/webp;base64,([^"]+)/.exec(images.get(url))?.[1];
    assert.ok(encoded, url);
    paintings.add(encoded);
    assert.match(images.get(url), /data:image\/png;base64,/);
  }
  assert.equal(seen.size, 243);
  assert.equal(paintings.size, 45);
  assert.notEqual(images.get(defaultTokenAvatar('Human', 'ella', '', 'Soldier')), images.get(defaultTokenAvatar('Human', 'ella', '', 'Vanguard')));
});

test('assigning or replacing a sheet repairs stale portraits and respects a custom picture', async () => {
  const { assignControls } = await import('../src/tokenPermissions.js');
  const expected = '/assets/tokens/classes/kryx-explorer-f.svg';
  const stale = { id: 'seat', name: 'Scout', actorType: 'player', gender: 'Female', species: 'Kryx', characterClass: 'Explorer', avatarUrl: '/assets/tokens/captain_harker.jpg' };
  assert.equal(assignControls([stale], 'seat', ['pilot'], ['pilot'])[0].avatarUrl, expected);
  const old = createActor({ name: 'Capt. Jonathan Harker', x: 213, ownerId: 'pilot' }, 'bridge');
  const imported = createActor(stale, 'another-map');
  const actor = replaceActorSheet(old, imported);
  assert.deepEqual([actor.id, actor.x, actor.ownerId, actor.avatarUrl], [old.id, 213, 'pilot', expected]);
  const custom = { ...actor, avatarUrl: '/portraits/pilot.webp' };
  assert.equal(replaceActorSheet(custom, imported).avatarUrl, custom.avatarUrl);
  assert.equal(replaceActorSheet(custom, { ...imported, avatarUrl: '/portraits/new.webp' }).avatarUrl, '/portraits/new.webp');
  assert.equal(actorPortrait({ actorType: 'drone', avatarUrl: '/assets/tokens/synthetic_infiltrator_echo.jpg' }), '/assets/cards/domain-tech-flag.png');
  assert.equal(actorPortrait({ name: 'Void Stalker', actorType: 'adversary' }), '/assets/tokens/void_stalker.jpg');
});

test('the system JSON carries a chosen portrait style and explicit gender into the VTT', () => {
  const doc = JSON.parse(fs.readFileSync(new URL('./fixtures/creator/Miles.json', import.meta.url)));
  Object.assign(doc.fields, { gender: 'female', token_archetype: 'mystic' });
  assert.equal(parseCharacterJSON(doc).token.avatarUrl, '/assets/tokens/classes/human-mystic-f.svg');
  doc.fields.avatarUrl = 'https://example.org/miles.jpg';
  assert.equal(parseCharacterJSON(doc).token.avatarUrl, doc.fields.avatarUrl);
});

test('explicit sheet identity takes precedence over pronouns, names and stale default art', async () => {
  const { exportSystemCharacter } = await import('../src/characterImport.js');
  const doc = JSON.parse(fs.readFileSync(new URL('./fixtures/creator/Miles.json', import.meta.url)));
  Object.assign(doc.fields, { ancestry: 'Ailurean', gender: '', sexo: 'hembra', pron: '', pronouns: 'he/him' });
  const token = parseCharacterJSON(doc).token;
  assert.equal(token.pronouns, 'he/him');
  assert.equal(token.avatarUrl, '/assets/tokens/classes/ailuran-diplomat-f.svg');
  assert.equal(parseCharacterJSON(exportSystemCharacter(token)).token.avatarUrl, token.avatarUrl);
  assert.equal(actorPortrait({ ...token, gender: 'no binario' }), '/assets/tokens/classes/ailuran-diplomat-n.svg');
  assert.equal(actorPortrait({ ...token, gender: '', pronouns: '' }), token.avatarUrl);
  assert.equal(actorPortrait({ name:'Capt. Jonathan Harker', gender:'Femenina', avatarUrl:'/assets/tokens/captain_harker.jpg' }), '/assets/tokens/crew/human-f-station.webp');
  assert.equal(detectGender('', 'Piedra'), 'n');
  assert.equal(detectGender('', 'Cobalto'), 'n');
  assert.equal(detectGender('macho', 'Lucy'), 'm');
});

test('a player portrait patch must choose a complete catalog entry or reset it atomically', async () => {
  const { validTokenPatch } = await import('../src/validation.js');
  const { portraitChoices, presetLocation } = await import('../src/portraitCatalog.js');
  const base = portraitChoices('rift_spinner');
  // Five crew portraits and the user's Rift Spinners (Threnody, Madame Silk; v2.62.5), all distinct.
  assert.equal(new Set(base.map(x => x.url)).size, 7);
  for (const option of [...base, ...portraitChoices('kryx', 'mystic'), ...portraitChoices('bestiary')]) {
    assert.ok(presetLocation(option.url));
    assert.ok(validTokenPatch({ avatarUrl: option.url, portraitOverride:true }));
  }
  assert.ok(validTokenPatch({ avatarUrl:'', portraitOverride:false }));
  assert.ok(validTokenPatch({avatarUrl:'https://example.org/own.png',portraitOverride:true}));
  assert.ok(validTokenPatch({avatarUrl:'data:image/webp;base64,UklGRg==',portraitOverride:true}));
  for (const patch of [{avatarUrl:base[0].url}, {portraitOverride:false}, {avatarUrl:base[0].url,portraitOverride:false},
    {avatarUrl:'javascript:void(0)',portraitOverride:true}, {avatarUrl:'/assets/tokens/crew/not-real.webp',portraitOverride:true}]) {
    assert.equal(validTokenPatch(patch), false);
  }
});
