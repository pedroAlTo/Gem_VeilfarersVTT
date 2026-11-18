import test from 'node:test';
import assert from 'node:assert/strict';
import { splitGroup, VISIBLE, SECOND } from '../src/groupMenu.js';

test('the 3 + 5 + rest rule', () => {
  assert.equal(VISIBLE, 3); assert.equal(SECOND, 5);
  const items = [...'abcdefghijk'];
  assert.deepEqual(splitGroup(items), { shown: ['a', 'b', 'c'], menu: ['d', 'e', 'f', 'g', 'h'], more: ['i', 'j', 'k'] });
  assert.deepEqual(splitGroup(['a', 'b']), { shown: ['a', 'b'], menu: [], more: [] }, 'three or fewer: no menu');
  assert.deepEqual(splitGroup([...'abcdef']), { shown: ['a', 'b', 'c'], menu: ['d', 'e', 'f'], more: [] }, 'four to eight: menu without «Más…»');
});

test('the player groups follow the proposal: three in view first', async () => {
  const { PLAYER_GROUPS } = await import('../src/groupMenus.js');
  const first = name => PLAYER_GROUPS.find(g => g.name === name).items.filter(i => !i.hideOnly).slice(0, 3).map(i => i.sel);
  assert.deepEqual(first('Herramientas'), ['#tool_select', '#tool_measure', '#tool_draw']);
  assert.deepEqual(first('Personaje'), ['#open_sheet_btn', '#open_conditions_btn', '#open_equipment_btn']);
  assert.deepEqual(first('Cabecera'), ['#quick_scene_select', '#session_state', '#session_my_tokens']);
});
