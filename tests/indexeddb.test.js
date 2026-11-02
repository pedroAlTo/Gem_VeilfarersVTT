import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
globalThis.indexedDB = indexedDB;
globalThis.localStorage = { getItem: () => null };
const { readCampaign, writeCampaign, listCampaigns } = await import('../src/persistence.js');
test('IndexedDB preserves large maps, empty collections and complete ship data', async () => {
  const campaign = {
    campaignId: 'idb-test',
    maps: [{ imageUrl: 'data:image/png;base64,' + 'a'.repeat(6 * 1024 * 1024) }],
    tokens: [],
    clocks: [],
    handouts: [],
    starship: { hull: 2, heat: 13, pearls: 0, systems: { Weapons: 1 } },
  };
  await writeCampaign(campaign.campaignId, campaign);
  assert.deepEqual(await readCampaign(campaign.campaignId), campaign);
});
test('different campaign IDs retain independent snapshots', async () => {
  await writeCampaign('one', { campaignName: 'One' });
  await writeCampaign('two', { campaignName: 'Two' });
  assert.equal((await readCampaign('one')).campaignName, 'One');
  assert.equal((await readCampaign('two')).campaignName, 'Two');
  const sessions = await listCampaigns();
  assert.ok(sessions.some(s => s.id === 'one' && s.name === 'One'));
  assert.ok(sessions.every(s => !('maps' in s) || typeof s.maps === 'number'));
});
