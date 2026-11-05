import * as THREE from 'three';
import { seededRandom } from './dicePhysics.js';

export const DICE_THEMES = { crystal: 'Crystal caves', panels: 'Tech panels', circuits: 'Circuits & processors', galaxy: 'Galaxy & stars' };
// The role stays recognizable when changing finish, including in the result HUD.
export const DICE_PALETTES = { hope: '#6de8ff', fear: '#f19ad9' };
const TAU = Math.PI * 2;
function canvas(size = 512) { const value = document.createElement('canvas'); value.width = value.height = size; return value; }
function polygon(c, points) { c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); }
function pentagon(c, radius) { polygon(c, Array.from({ length: 5 }, (_, i) => [256 + Math.cos(i * TAU / 5) * radius, 256 + Math.sin(i * TAU / 5) * radius])); }

// Color, height and illumination are separate: metal recesses do not glow, and
// the ink remains readable under changing light. Height maps use linear data.
export function createDiceMaps(theme, fear, number) {
  if (!DICE_THEMES[theme]) theme = 'crystal';
  const albedo = canvas(), height = canvas(256), emission = canvas(256);
  const c = albedo.getContext('2d'), h = height.getContext('2d'), g = emission.getContext('2d');
  h.scale(.5, .5); g.scale(.5, .5);
  const color = fear ? DICE_PALETTES.fear : DICE_PALETTES.hope, random = seededRandom(4789 + number * 137 + (fear ? 653 : 0));
  const base = c.createLinearGradient(0, 0, 512, 512);
  base.addColorStop(0, fear ? '#4f2459' : '#185370'); base.addColorStop(.5, fear ? '#211630' : '#102d40'); base.addColorStop(1, '#080f1e');
  c.fillStyle = base; c.fillRect(0, 0, 512, 512);
  h.fillStyle = '#888'; h.fillRect(0, 0, 512, 512); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  if (theme === 'crystal') {
    // A coherent mineral mosaic with luminous seams and internal striations.
    const rows = 5, columns = 5, points = [];
    for (let y = 0; y <= rows; y++) { points[y] = []; for (let x = 0; x <= columns; x++) points[y][x] = [x * 128 - 64 + (random() - .5) * 65, y * 128 - 64 + (random() - .5) * 65]; }
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const a = points[y][x], b = points[y][x + 1], d = points[y + 1][x], e = points[y + 1][x + 1];
      for (const p of [[a, b, d], [b, e, d]]) {
        const shine = c.createLinearGradient(p[0][0], p[0][1], p[2][0] + 80, p[2][1]);
        shine.addColorStop(0, color + (random() > .5 ? '9c' : '40')); shine.addColorStop(1, color + '06');
        polygon(c, p); c.fillStyle = shine; c.fill(); c.strokeStyle = color + '70'; c.lineWidth = 1.4; c.stroke();
        polygon(h, p); h.fillStyle = `rgb(${Array(3).fill(95 + Math.round(random() * 75)).join(',')})`; h.fill();
        polygon(g, p); g.strokeStyle = color + '55'; g.lineWidth = 1; g.stroke();
        c.save(); polygon(c, p); c.clip(); c.strokeStyle = '#defcff12'; c.lineWidth = .8;
        for (let line = -100; line < 600; line += 11) { c.beginPath(); c.moveTo(line, 0); c.lineTo(line + 110, 512); c.stroke(); } c.restore();
      }
    }
  } else if (theme === 'panels') {
    // Five machined plates follow the actual pentagonal face instead of tiling.
    for (let i = 0; i < 5; i++) {
      [c, h, g].forEach(ctx => { ctx.save(); ctx.translate(256, 256); ctx.rotate(i * TAU / 5); });
      const plate = [[58, -42], [170, -112], [218, -18], [218, 18], [170, 112], [58, 42]];
      polygon(c, plate); const steel = c.createLinearGradient(60, -60, 210, 90); steel.addColorStop(0, '#758796'); steel.addColorStop(.25, fear ? '#403344' : '#294755'); steel.addColorStop(1, '#132332'); c.fillStyle = steel; c.fill(); c.lineWidth = 2; c.strokeStyle = '#07121e'; c.stroke();
      polygon(h, plate); h.fillStyle = '#bbb'; h.fill(); h.strokeStyle = '#353535'; h.lineWidth = 4; h.stroke();
      for (let n = 0; n < 5; n++) { c.fillStyle = '#07121c'; c.fillRect(145, -30 + n * 13, 34, 5); h.fillStyle = '#222'; h.fillRect(145, -30 + n * 13, 34, 5); }
      for (const y of [-55, 55]) { c.fillStyle = '#111b26'; c.beginPath(); c.arc(169, y, 5, 0, TAU); c.fill(); c.strokeStyle = '#a2b4c4'; c.lineWidth = 1; c.beginPath(); c.moveTo(166, y); c.lineTo(172, y); c.stroke(); }
      c.fillStyle = g.fillStyle = color; c.fillRect(192, -21, 4, 42); g.fillRect(192, -21, 4, 42);
      c.fillStyle = '#acc5ce80'; c.font = '8px monospace'; c.fillText(`VF-${number.toString().padStart(2, '0')}`, 90, 5);
      [c, h, g].forEach(ctx => ctx.restore());
    }
    c.fillStyle = '#d9eeff0b'; for (let y = 0; y < 512; y += 3) c.fillRect(0, y, 512, .5);
  } else if (theme === 'circuits') {
    c.fillStyle = fear ? '#231b33' : '#102b32'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5; i++) {
      [c, h, g].forEach(ctx => { ctx.save(); ctx.translate(256, 256); ctx.rotate(i * TAU / 5); });
      for (let n = -2; n <= 2; n++) {
        const y = n * 13, end = 184 + Math.abs(n) * 8;
        for (const ctx of [c, h, g]) { ctx.strokeStyle = ctx === h ? '#ccc' : ctx === g ? color + '9c' : color + 'bc'; ctx.lineWidth = ctx === h ? 4 : 2; ctx.beginPath(); ctx.moveTo(65, y); ctx.lineTo(124, y); ctx.lineTo(145, y + n * 8); ctx.lineTo(end, y + n * 8); ctx.stroke(); ctx.beginPath(); ctx.arc(end, y + n * 8, 3, 0, TAU); ctx.stroke(); }
      }
      c.fillStyle = '#050c17'; c.fillRect(141, -16, 31, 32); c.strokeStyle = '#798893'; c.lineWidth = 1; c.strokeRect(142, -15, 29, 30);
      h.fillStyle = '#d0d0d0'; h.fillRect(141, -16, 31, 32);
      for (let n = -10; n <= 10; n += 5) { c.fillStyle = '#d1ba82'; c.fillRect(137, n, 5, 2); c.fillRect(172, n, 5, 2); }
      c.fillStyle = color; c.font = '9px monospace'; c.fillText('VF', 150, 4);
      [c, h, g].forEach(ctx => ctx.restore());
    }
  } else {
    c.fillStyle = '#060d23'; c.fillRect(0, 0, 512, 512);
    // Multiple translucent clouds give the nebula depth without washing out ink.
    for (let i = 0; i < 19; i++) {
      const x = random() * 650 - 65, y = 430 - x * .65 + (random() - .5) * 150, r = 70 + random() * 115;
      const cloud = c.createRadialGradient(x, y, 0, x, y, r); cloud.addColorStop(0, (i % 3 ? (fear ? '#d34fbb' : '#398bce') : '#805ce5') + '42'); cloud.addColorStop(1, '#36246e00'); c.fillStyle = cloud; c.fillRect(0, 0, 512, 512);
    }
    for (let i = 0; i < 230; i++) {
      const x = random() * 512, y = random() * 512, r = .3 + random() * 1.1;
      for (const ctx of [c, g]) { ctx.fillStyle = i % 5 ? '#e5efffc0' : color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      if (i % 45 === 0) { c.save(); c.shadowColor = color; c.shadowBlur = 10; c.fillStyle = '#fff'; c.fillRect(x - 5, y - .5, 10, 1); c.fillRect(x - .5, y - 5, 1, 10); c.restore(); }
    }
  }
  // Engraved pentagonal frame and a quiet, high-contrast number field.
  c.lineWidth = 2; c.strokeStyle = color + '8c'; pentagon(c, 221); c.stroke();
  g.lineWidth = 1.2; g.strokeStyle = color + '78'; pentagon(g, 221); g.stroke();
  const ink = c.createRadialGradient(256, 256, 42, 256, 256, 124); ink.addColorStop(0, '#07121ff5'); ink.addColorStop(.7, '#07121fe8'); ink.addColorStop(1, '#07121f00'); c.fillStyle = ink; c.fillRect(125, 125, 262, 262);
  h.fillStyle = '#888'; h.beginPath(); h.arc(256, 256, 100, 0, TAU); h.fill();
  g.fillStyle = '#000'; g.beginPath(); g.arc(256, 256, 105, 0, TAU); g.fill();
  for (const ctx of [c, g]) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 126px "Trebuchet MS", sans-serif'; ctx.fillStyle = ctx === c ? '#f3f9ff' : '#727f88'; ctx.fillText(String(number), 256, 247);
    ctx.font = 'bold 20px monospace'; ctx.fillStyle = color; ctx.fillText(fear ? 'F E A R' : 'H O P E', 256, 324);
    // Orientation underline disambiguates 6 and 9 on rotating faces.
    if (number === 6 || number === 9) ctx.fillRect(241, 304, 30, 3);
  }
  const texture = (source, srgb) => { const map = new THREE.CanvasTexture(source); if (srgb) map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map; };
  return { map: texture(albedo, true), bumpMap: texture(height, false), emissiveMap: texture(emission, true) };
}
