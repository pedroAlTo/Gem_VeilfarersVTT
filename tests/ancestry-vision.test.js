import test from 'node:test';
import assert from 'node:assert/strict';
import { monochromeViewer, keepsTokenColor, MonochromeLayers } from '../src/ancestryVision.js';

const pc = (id, species, ownerId) => ({ id, actorType: 'player', mapId: 'bridge', ownerId, species });
const iris = pc('iris', 'Ailurean', 'ada'), scout = pc('scout', 'Human', 'ada'), helena = pc('helena', 'Human', 'bea');
const enemy = { ...pc('enemy', 'Ailurean', 'keeper'), actorType: 'adversary' };
const state = { userRole: 'player', activeMapId: 'bridge', claimedTokenId: 'iris', selectedTokenId: 'helena' };

test('vision follows the viewing player across targeting, permissions, disconnection and Keeper preview', () => {
  function view(change = {}, role = 'player', member = 'ada', tokens = [iris, scout, helena, enemy]) {
    return monochromeViewer({ ...state, ...change }, tokens, role, member)?.id ?? null;
  }
  assert.equal(view(), 'iris'); assert.equal(view({ selectedTokenId: 'enemy', isConnected: false }), 'iris');
  assert.equal(view({ selectedTokenId: 'scout' }), null);
  assert.equal(view({}, 'player', 'bea'), null); assert.equal(view({}, 'player', 'observer'), null);
  assert.equal(view({ userRole: 'keeper', selectedTokenId: 'iris' }, 'host'), null);
  assert.equal(view({ selectedTokenId: 'iris' }, 'host', 'keeper'), 'iris');
  assert.equal(view({ activeMapId: 'elsewhere' }), null);
  for (const patch of [{ hidden: true }, { inReserve: true }, { actorType: 'drone' }]) {
    assert.equal(view({}, 'player', 'ada', [{ ...iris, ...patch }]), null);
  }
  for (const patch of [{ species: 'Ailuran' }, { species: '', ancestry: 'Ailurean' }, { species: '', sourceCharacter: { document: { fields: { ancestry: 'Ailuran' } } } }]) {
    assert.equal(view({}, 'player', 'ada', [{ ...iris, ...patch }]), 'iris');
  }
});

test('only visible player characters belonging to other players retain their colors', () => {
  assert.ok(keepsTokenColor(helena, iris, 'ada'));
  for (const t of [iris, scout, enemy, { ...helena, hidden: true }, { ...helena, actorType: 'drone' }]) assert.equal(keepsTokenColor(t, iris, 'ada'), false);
  assert.equal(keepsTokenColor(scout, iris, 'keeper'), false);
});

// Record just the Canvas 2D calls that compose the layers. Scene visibility is resolved
// by the renderer before it asks for either drawing surface.
function canvasFactory(supportsFilter) {
  const layers = [];
  const make = () => {
    const canvas = { width: 36, height: 24, ownerDocument: { createElement: make } };
    let op = 'source-over', filter = 'none', transform = 'camera';
    const stack = [], calls = [];
    const ctx = { canvas, calls, get globalCompositeOperation() { return op; }, set globalCompositeOperation(v) { op = v; },
      save() { stack.push([op, filter, transform]); }, restore() { [op, filter, transform] = stack.pop(); },
      getTransform() { return transform; }, setTransform(...v) { transform = v.length === 1 ? v[0] : v.join(','); },
      clearRect() {}, fillRect() { calls.push(['fill', op, transform]); }, drawImage() { calls.push(['image', op, filter, transform]); } };
    if (supportsFilter) Object.defineProperty(ctx, 'filter', { get: () => filter, set: v => { filter = v; } });
    canvas.getContext = () => ctx; layers.push(ctx); return canvas;
  };
  return { output: make().getContext(), layers };
}

test('colored allies retain their draw order and transparent FX reuse the grayscale surface', () => {
  for (const supportsFilter of [true, false]) {
    const { output, layers } = canvasFactory(supportsFilter), vision = new MonochromeLayers();
    vision.begin(output);
    assert.deepEqual(output.calls[0], ['fill', 'color', '1,0,0,1,0,0']);
    const grey = vision.grey();
    assert.equal(grey.getTransform(), 'camera'); assert.equal(vision.grey(), grey);
    assert.equal(vision.color(), output);
    output.calls.push(['ally']); assert.equal(vision.grey(), grey); vision.flush(); vision.flush();
    const frames = output.calls.filter(c => c[0] === 'image');
    assert.equal(frames.length, 2); assert.equal(output.calls[2][0], 'ally');
    if (supportsFilter) assert.match(frames[0][2], /grayscale/);
    else assert.equal(grey.calls.filter(c => c[1] === 'destination-in').length, 2);
    assert.equal(output.getTransform(), 'camera');
    output.canvas.width = 120; vision.begin(output); assert.equal(vision.grey().canvas.width, 120);
    assert.equal(layers.length, supportsFilter ? 2 : 3);
  }
});
