import test from 'node:test';
import assert from 'node:assert/strict';
import { impactScale, weaponImpactType, attackPresentation, CombatFX, drawFireArea } from '../src/combatFX.js';
const target = { x: 100, y: 80, size: 2 }, attacker = { x: 0, y: 0 };
const ctx = () => {
  const calls = [];
  const gradient = { addColorStop: (...args) => calls.push(['stop', ...args]) };
  const context = new Proxy({ calls, createRadialGradient: () => gradient, createLinearGradient: () => gradient }, { get(obj, prop) { return prop in obj ? obj[prop] : (...args) => calls.push([prop, ...args]); } });
  return context;
};
test('impact footprint uses actual HP lost: 0/50/100/120/140/160/180/200 percent', () => {
  assert.deepEqual([0,1,2,3,4,5,6,7,99].map(impactScale), [0,.5,1,1.2,1.4,1.6,1.8,2,2]);
  assert.equal(impactScale(NaN), 0); assert.equal(impactScale(-1), 0);
});
test('weapon names and explicit overrides distinguish five requested damage presentations', () => {
  for (const [name, result] of [['Rifle cinético','ballistic'],['Shotgun','ballistic'],['Rifle láser','plasma'],['Pistola de plasma','plasma'],['Lanzallamas / Fire','fire'],['Cryogenic cannon','cryo'],['Criogénesis','cryo'],['Granada','explosion']]) assert.equal(weaponImpactType(name), result);
  assert.equal(weaponImpactType('Cryo rifle', 'fire'), 'fire');
});
test('shield feedback requires an Armor slot actually spent and never appears on direct bypass', () => {
  const data = { attacker, target, hpLost: 1, gridSize: 64, weapon: 'Rifle' };
  assert.equal(attackPresentation(data).shield, false);
  assert.equal(attackPresentation({ ...data, armorSlotSpent: true }).shield, true);
  assert.equal(attackPresentation({ ...data, armorSlotSpent: true, isDirect: true }).shield, false);
  assert.equal(attackPresentation(data).tokenDiameter, 128);
  assert.equal(attackPresentation({ ...data, target: { x: NaN, y: 1 } }), null);
});
test('bounded bursts reach the target before impact and expire independently of frame rate', () => {
  const fx = new CombatFX(), context = ctx();
  for (let i = 0; i < 100; i++) fx.add(attackPresentation({ attacker, target, hpLost: 3, kind: 'explosion' }));
  assert.equal(fx.bursts.length, 8);
  fx.render(context, .02); assert.ok(context.calls.some(c => c[0] === 'lineTo')); assert.ok(!context.calls.some(c => c[0] === 'clip'));
  context.calls.length = 0; fx.render(context, .4); assert.ok(context.calls.some(c => c[0] === 'clip'));
  fx.render(context, 2); assert.equal(fx.bursts.length, 0);
});
test('all impact kinds clip their glow, fragments and shockwave to the requested diameter', () => {
  for (const kind of ['ballistic','plasma','fire','cryo','explosion']) {
    const context = ctx(), fx = new CombatFX(); fx.add(attackPresentation({ attacker: target, target, hpLost: 1, kind, gridSize: 64 }));
    fx.render(context, .2, { quality: 'eco' });
    const mask = context.calls.findIndex(c => c[0] === 'clip'); assert.ok(mask >= 0);
    const arc = context.calls.slice(0, mask).find(c => c[0] === 'arc'); assert.equal(arc[3], 32);
    assert.equal(context.calls.filter(c => c[0] === 'save').length, context.calls.filter(c => c[0] === 'restore').length);
  }
});
test('zero HP mitigation renders only the shield; offscreen impacts do no drawing', () => {
  const fx = new CombatFX(), context = ctx(); fx.add(attackPresentation({ attacker: target, target, hpLost: 0, armorSlotSpent: true }));
  fx.render(context, .2); assert.ok(context.calls.some(c => c[0] === 'clip'));
  context.calls.length = 0; fx.render(context, .02, { viewport: { minX: 10000, minY: 10000, maxX: 11000, maxY: 11000 } }); assert.equal(context.calls.length, 0);
});
test('fire fills circular, concave polygon and line areas through a shared geometry clip', () => {
  for (const effect of [{ x: 70, y: 70, radius: 60 }, { shape: 'polygon', points: [{x:0,y:0},{x:100,y:0},{x:50,y:50},{x:100,y:100},{x:0,y:100}] }, { shape: 'line', x:0,y:50,x2:100,y2:50,width:30 }]) {
    const context = ctx(); drawFireArea(context, effect, 1, { quality: 'eco', reducedMotion: true });
    const mask = context.calls.findIndex(c => c[0] === 'clip'); const painted = context.calls.findIndex(c => c[0] === 'fillRect'); assert.ok(mask >= 0 && painted > mask);
    assert.equal(context.calls.filter(c=>c[0]==='save').length, context.calls.filter(c=>c[0]==='restore').length);
  }
});
test('invalid effect geometry is rejected and reduced motion has no projectile traversal', () => {
  const fx = new CombatFX(); assert.equal(fx.add({ attacker, target, hpLost: NaN, tokenDiameter: 64 }), false);
  const c = ctx(); drawFireArea(c, { shape:'polygon', points:[{x:0,y:0}] }, 0); assert.equal(c.calls.length, 0);
  fx.add(attackPresentation({ attacker, target, hpLost: 2, kind: 'cryo' })); fx.render(c, .01, { reducedMotion:true }); assert.ok(c.calls.some(x=>x[0]==='clip'));
});
