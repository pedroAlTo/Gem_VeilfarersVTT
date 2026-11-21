import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAdversaries } from '../scripts/adversary-library.mjs';
import { actorPortrait } from '../src/tokenAvatars.js';
import { portraitChoices } from '../src/portraitCatalog.js';
import { powerArt } from '../src/loadoutCards.js';
import { equipmentThumbnail } from '../src/equipmentArtwork.js';
import { EQUIPMENT_CATALOG } from '../src/equipmentLibrary.js';

function data(file) {
  return JSON.parse(readFileSync(new URL('../src/' + file + '.json', import.meta.url)));
}
function checkImage(path) {
  assert.match(path, /^\/assets\/.*\.webp$/);
  const bytes = readFileSync(new URL('../public' + path, import.meta.url));
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
}
test('Every Tier 2 adversary deploys with an existing portrait that can also be selected manually', () => {
  const choices = portraitChoices('bestiary-2');
  assert.equal(choices.length, 18);
  for (const p of choices) checkImage(p.url);
  for (const p of loadAdversaries().filter(p => p.tier === 2)) {
    assert.ok(choices.some(c => c.url === actorPortrait({name: p.name, actorType: 'adversary'})), p.name);
  }
});
test('Every first-level power resolves its own illustration', () => {
  const paths = data('creator/data/powers').filter(p => p.l === 1).map(p => powerArt(p).illustration);
  assert.equal(new Set(paths).size, 21);
  paths.forEach(checkImage);
});
test('Every table catalog item at tiers 1 and 2 and all common Creator and drone gear resolve packaged art', () => {
  const common = [...data('creator/data/armor'), ...data('creator/data/weapons'), ...data('creator/data/humanInheritance').grafts, ...data('droneModules')].filter(x => (x.grade || x.tier).toLowerCase() === 'common');
  for (const item of [...common, ...EQUIPMENT_CATALOG.filter(x => /Common|Military|Tier [12]/.test(x.tier))]) {
    const thumb = equipmentThumbnail({name:item.name});
    assert.ok(thumb, item.name);
    checkImage(thumb.match(/src="([^"]+)"/)[1]);
  }
});

test('Sleeping and Keeper moves and the eight enemy categories use distinct packaged paintings', async () => {
  const { actionArt } = await import('../src/actionCardArt.js');
  const { FEAR_MOVES, sleepingCommonCards, keeperCards } = await import('../src/loadoutCards.js');
  const cards = [
    ...data('creator/data/resolveMoves').map(move => actionArt(move.name)),
    ...sleepingCommonCards({path:'Sleeping'}, {optionalEfforts:true}).map(c => c.art),
    ...FEAR_MOVES.map(c => c.art),
  ];
  const types = new Map();
  for (const profile of loadAdversaries()) {
    for (const c of keeperCards({ id: 'enemy', isPlayer: false, featureNotes: profile.text })) {
      if (c.kind === 'adversary') types.set(c.category, c.art);
    }
  }
  assert.equal(types.size, 8);
  cards.push(...types.values());
  const slots = new Set();
  for (const {illustration, cell} of cards) {
    assert.ok(Number.isInteger(cell) && cell >= 0 && cell <= 8);
    checkImage(illustration);
    slots.add(illustration + '#' + cell);
  }
  assert.equal(slots.size, 64);
});

test('all seven domains show distinct level 2–5 paintings in compact and enlarged cards', async () => {
  const { powerCard } = await import('../src/loadoutCards.js');
  const { cardFace } = await import('../src/cardHandUI.js');
  const slots = new Set();
  for (const p of data('creator/data/powers').filter(p => p.l >= 2 && p.l <= 5)) {
    const card = powerCard(p, 'loadout');
    const { illustration, cell } = card.art;
    checkImage(illustration);
    assert.ok(Number.isInteger(cell) && cell >= 0 && cell < 8, p.n);
    slots.add(illustration + '#' + cell);
    for (const large of [true, false]) {
      const html = cardFace(card, { large });
      assert.ok(html.includes('src="' + illustration + '"'), p.n);
      assert.ok(html.includes('left:-' + cell % 3 * 100 + '%;top:-' + Math.floor(cell / 3) * 100 + '%'), p.n);
    }
  }
  assert.equal(slots.size, 56);
});
