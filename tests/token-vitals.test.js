// The tokens on the map (v2.58.0 and v2.59.0, the user's design): name and insignia yes/no; each
// stat as a bar below or above, a ring (inner, outer 1, outer 2) or, for Armor and Resolve, 8 px
// tokens beside it (Resolve: triangles for d4, squares for d6); the states inside the token.
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawStatBars, drawStatRing, drawStatPips, ringRadius } from '../src/tokenVitals.js';
import { tokenLayout, validLayout, placeStat, statFor, placesFor, DEFAULT_LAYOUT } from '../src/tokenLayout.js';
import { conditionMarkerLayout } from '../src/conditions.js';

function context() {
  const commands = [];
  const ctx = new Proxy({}, { get(target, key) { if (key in target) return target[key]; return (...args) => { commands.push([key, ...args]); }; }, set(target, key, value) { target[key] = value; commands.push(['set', key, value]); return true; } });
  return { ctx, commands };
}

test('bars: one black pixel between points; above the token they grow upwards', () => {
  const { ctx, commands } = context();
  drawStatBars(ctx, { y: 40, width: 64, rows: [['hp', { current: 4, max: 6 }], ['stress', { current: 1, max: 3 }]] });
  assert.equal(commands.filter(c => c[0] === 'fillRect').length, (2 + 5) + (2 + 2), 'track, fill and separators per bar');
  assert.ok(commands.some(c => c[0] === 'set' && c[1] === 'fillStyle' && c[2] === '#000'));
  const up = context(); drawStatBars(up.ctx, { y: -40, width: 64, rows: [['hp', { current: 1, max: 2 }]], up: true });
  assert.ok(up.commands.filter(c => c[0] === 'fillRect').every(c => c[2] < -40), 'drawn above the line');
  const none = context(); drawStatBars(none.ctx, { y: 0, width: 64, rows: [] }); assert.equal(none.commands.length, 0);
});

test('rings: a segment per point; inner inside the rim, outer 2 outside outer 1', () => {
  const { ctx, commands } = context();
  drawStatRing(ctx, { r: ringRadius('outer1', 32), width: 3, key: 'hp', stat: { current: 3, max: 6 } });
  assert.equal(commands.filter(c => c[0] === 'arc').length, 1 + 6, 'the dark band and six segments');
  assert.ok(ringRadius('inner1', 32) < 32 && ringRadius('outer1', 32) > 32 && ringRadius('outer2', 32) > ringRadius('outer1', 32));
});

test('pips: 8 px tokens, Armor shields, Resolve triangles (d4) or squares (d6), full or empty, on either side', () => {
  const d6 = context(); drawStatPips(d6.ctx, { side: 'right', radius: 32, key: 'resolve', stat: { current: 1, max: 3, die: 'd6' } });
  const rects = d6.commands.filter(c => c[0] === 'rect');
  assert.equal(rects.length, 3); assert.ok(rects.every(c => c[1] > 32 && c[3] === 8 && c[4] === 8), 'squares of 8 px on the right');
  const d4 = context(); drawStatPips(d4.ctx, { side: 'left', radius: 32, key: 'resolve', stat: { current: 2, max: 2, die: 'd4' } });
  assert.equal(d4.commands.filter(c => c[0] === 'rect').length, 0, 'triangles, not squares');
  assert.ok(d4.commands.filter(c => c[0] === 'moveTo').every(c => c[1] < -32), 'on the left');
  const armor = context(); drawStatPips(armor.ctx, { side: 'right', radius: 32, key: 'armor', stat: { current: 1, max: 2 } });
  const fills = armor.commands.filter(c => c[0] === 'set' && c[1] === 'fillStyle').map(c => c[2]);
  assert.deepEqual(fills, ['#79cef9', 'rgba(4,12,23,0.85)'], 'one full, one empty');
});

test('the layout: defaults, the old display settings, validation and one stat per ring or side', () => {
  assert.deepEqual(tokenLayout({}), DEFAULT_LAYOUT);
  assert.equal(tokenLayout({ displayConfig: { showHpBar: true, showStressBar: false } }).stress, 'none');
  assert.equal(tokenLayout({ displayOverlays: [{ statKey: 'armor', type: 'linear' }] }).armor, 'bottom');
  assert.equal(tokenLayout({ vitalsLayout: { insignia: false, hp: 'outer1' } }).insignia, false);
  assert.equal(validLayout({ hp: 'right' }), false, 'HP has no tokens');
  assert.equal(validLayout({ resolve: 'left', name: false }), true);
  assert.equal(validLayout({ hope: 'bottom' }), false, 'unknown stat');
  assert.ok(placesFor('armor').some(([id]) => id === 'right') && !placesFor('stress').some(([id]) => id === 'right'));
  const moved = placeStat({ ...DEFAULT_LAYOUT, hp: 'outer1' }, 'stress', 'outer1');
  assert.equal(moved.stress, 'outer1'); assert.equal(moved.hp, 'none', 'the ring is freed');
  assert.equal(placeStat(DEFAULT_LAYOUT, 'stress', 'bottom').hp, 'bottom', 'bars stack');
  assert.deepEqual(statFor({ path: 'Sleeping', effort: 2 }, 'path'), { current: 2, max: 6, label: 'EFFORT' });
  assert.equal(statFor({ isPlayer: false, hope: 3 }, 'path'), null, 'an adversary has no Hope');
  assert.equal(statFor({ resolve: { current: 1, max: 2, dieType: 'd6' } }, 'resolve').die, 'd6');
});

test('the states sit inside the token, in its lower-right quarter (over the class flag)', () => {
  for (const radius of [32, 64]) for (const zoom of [0.4, 1, 2]) {
    for (const s of conditionMarkerLayout(4, radius, zoom)) {
      assert.ok(Math.hypot(Math.abs(s.x) + s.size / 2, Math.abs(s.y) + s.size / 2) <= radius * 1.05);
      assert.ok(s.x > -radius * 0.1 && s.y > -radius * 0.2);
    }
  }
});

test('the 30 frames: two layers each, a colour for the chat, a hole for the portrait (v2.60.0)', async () => {
  const { TOKEN_FRAMES, frameById, frameGeometry, frameBody, frameLight } = await import('../src/tokenFrames.js');
  const { existsSync } = await import('node:fs');
  assert.equal(TOKEN_FRAMES.length, 30);
  for (const f of TOKEN_FRAMES) {
    assert.match(f.color, /^#[0-9a-f]{6}$/, f.id);
    assert.ok(f.inner > 0.4 && f.inner < f.outer && f.outer <= 1, f.id);
    assert.ok(existsSync('public' + frameBody(f)) && existsSync('public' + frameLight(f)), f.id + ' files');
    const g = frameGeometry(f, 32);
    assert.ok(Math.abs(g.half * f.outer - 32 * 1.2) < 1e-9 && g.hole < 32, 'outer edge at 1.2 r, portrait inside');
  }
  assert.equal(frameById('frame-99'), null);
  const { validTokenPatch } = await import('../src/validation.js');
  assert.equal(validTokenPatch({ frame: 'frame-05', color: '#d69b3d' }), true, 'a player may change their frame and colour');
  assert.equal(validTokenPatch({ frame: 'frame-99' }), false);
  assert.equal(validTokenPatch({ keeperOverride: true }), false, 'never the Keeper mark');
});

test('the portrait window has small, flat images for every frame and preset portrait (v2.61.2)', async () => {
  const { existsSync } = await import('node:fs');
  const { TOKEN_FRAMES, frameThumb, frameFlat } = await import('../src/tokenFrames.js');
  const { portraitChoices, portraitThumb } = await import('../src/portraitCatalog.js');
  const { ANCESTRY_IDS, TOKEN_CLASSES } = await import('../src/tokenAvatars.js');
  const file = url => new URL('../public' + url, import.meta.url);
  for (const frame of TOKEN_FRAMES) {
    assert.ok(existsSync(file(frameThumb(frame))), frameThumb(frame));
    assert.ok(existsSync(file(frameFlat(frame))), frameFlat(frame));
  }
  let checked = 0;
  for (const collection of ['bestiary', 'bestiary-2', 'crew', 'npc', 'pregens', ...ANCESTRY_IDS]) {
    for (const cls of ANCESTRY_IDS.includes(collection) ? ['', ...TOKEN_CLASSES] : ['']) {
      for (const { url } of portraitChoices(collection, cls)) {
        const thumb = portraitThumb(url);
        assert.notEqual(thumb, url, `${url} has a thumbnail`);
        assert.match(thumb, /^\/assets\/tokens\/thumbs\//);
        // The class portraits are drawn by the build (scripts/token-portraits.mjs) from the crew thumbnails.
        if (!thumb.endsWith('.svg')) { assert.ok(existsSync(file(thumb)), thumb); checked++; }
      }
    }
  }
  assert.ok(checked > 60);
  assert.equal(portraitThumb('data:image/webp;base64,AAAA'), 'data:image/webp;base64,AAAA', 'an uploaded image stays as it is');
});
