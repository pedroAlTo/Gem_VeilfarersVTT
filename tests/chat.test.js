import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CHAT_LIMIT, TABLE, KEEPER, chatHistoryFor, validateChatHistory, appendChat } from '../src/chat.js';
import { validateCampaign } from '../src/validation.js';
const dom = new JSDOM('<body></body>', { url:'http://localhost/', pretendToBeVisual:true });
for (const k of ['window','document','HTMLElement','customElements','MutationObserver','localStorage','Event','CustomEvent']) globalThis[k] = dom.window[k];
const { store } = await import('../src/state.js'); await store.ready;
const { NetworkManager } = await import('../src/networkManager.js');
const { ChatPanel } = await import('../src/chatPanel.js');
const { readCampaign } = await import('../src/persistence.js');
const original = structuredClone(store.state);
let panels = [], managers = [];
beforeEach(async () => {
  await store.saveQueue.catch(() => {}); store.state = structuredClone(original); store.listeners.clear();
  store.sessionRole = 'local'; store.remoteApplying = false; store.memberId = null; store.state.campaignId = crypto.randomUUID();
  document.body.innerHTML = '<button class="tab-nav-btn" data-tab="chat">CHAT <span class="chat-unread" hidden></span></button>';
});
afterEach(async () => { panels.forEach(p => p.destroy()); managers.forEach(n => n.disconnect()); panels = []; managers = []; await store.saveQueue.catch(() => {}); });
after(() => dom.window.close());
const message = (patch = {}) => ({ id:crypto.randomUUID(), clientId:crypto.randomUUID(), senderId:KEEPER, senderName:'Keeper', recipientId:TABLE, recipientName:'Mesa', text:'Hello', sentAt:Date.now(), ...patch });
function manager() { const n = new NetworkManager(); managers.push(n); return n; }
function panel(transport) { const el = document.createElement('div'); document.body.append(el); const p = new ChatPanel(el, { transport }); panels.push(p); return p; }
function host(n) {
  store.sessionRole = 'host'; Object.assign(store.state, { isHosting:true, isConnected:true, roomCode:'test', players:[{id:'pilot',name:'Pilot'},{id:'engineer',name:'Engineer'}], connectedPeers:[{id:'pilot',name:'Pilot'},{id:'engineer',name:'Engineer'}] }); n.room = 'test';
  const wires = { pilot:[], engineer:[] };
  for (const [id, sent] of Object.entries(wires)) { n.members.set(id, { id, name:id === 'pilot' ? 'Pilot' : 'Engineer' }); n.connections.set(id, { open:true, send:m => sent.push(structuredClone(m)) }); }
  return wires;
}

test('chat validation bounds history and text, rejects malformed recipients and strips unknown fields', () => {
  const entry = message({ unexpected:'not forwarded' });
  assert.equal(validateChatHistory([entry])[0].unexpected, undefined);
  for (const patch of [{text:' '},{text:'x'.repeat(2001)},{sentAt:Infinity},{senderId:'pilot',recipientId:'engineer'},{recipientId:KEEPER}]) assert.throws(() => validateChatHistory([message(patch)]));
  assert.throws(() => validateChatHistory([entry, entry]));
  assert.throws(() => validateChatHistory(Array.from({length:501}, () => message())));
  const history = Array.from({length:CHAT_LIMIT}, () => message()), last = message();
  assert.equal(appendChat(history, last).length, 500); assert.equal(appendChat(history, last)[0].id, history[1].id);
  assert.equal(appendChat(history, history[0]), history);
});

test('private messages are filtered for each participant, including offline Player preview', () => {
  const pub = message(), one = message({recipientId:'pilot',recipientName:'Pilot'}), two = message({senderId:'engineer',senderName:'Engineer',recipientId:KEEPER,recipientName:'Keeper'});
  assert.deepEqual(chatHistoryFor([pub,one,two], 'pilot').map(m => m.id), [pub.id,one.id]);
  assert.deepEqual(chatHistoryFor([pub,one,two], null).map(m => m.id), [pub.id]);
  assert.equal(chatHistoryFor([pub,one,two], KEEPER).length, 3);
});

test('host canonicalizes authors, isolates delivery and snapshots, and deduplicates uncertain retries', async () => {
  const n = manager(), wires = host(n);
  const packet = { type:'CHAT_SEND', room:'test', messageId:'first', requestId:'req', clientId:'client-1', text:'PRIVATE_SENTINEL', recipientId:KEEPER, senderId:'engineer', senderName:'Forged Keeper' };
  await n.handleIncomingMessage(packet, 'pilot');
  const entry = store.state.chatMessages[0];
  assert.equal(entry.senderId, 'pilot'); assert.equal(entry.senderName,'Pilot');
  assert.equal(wires.engineer.length, 0); assert.equal(n.syncTimer, undefined, 'chat does not schedule full map retransmission');
  assert.ok(wires.pilot.some(p => p.type === 'CHAT_MESSAGE'));
  await n.handleIncomingMessage({...packet,messageId:'retry',requestId:'retry'}, 'pilot');
  assert.equal(store.state.chatMessages.length, 1);
  await n.handleIncomingMessage({...packet,messageId:'collision',text:'different'}, 'pilot');
  assert.match(wires.pilot.at(-1).error, /utilizado/);
  await n.handleIncomingMessage({...packet,messageId:'forbidden',clientId:'client-2',recipientId:'engineer'}, 'pilot');
  assert.match(wires.pilot.at(-1).error, /Keeper/);
  await n.handleIncomingMessage({...packet,messageId:'outsider'}, 'intruder');
  assert.equal(store.state.chatMessages.length, 1);
  n.syncAll(); assert.ok(!JSON.stringify(wires.engineer).includes('PRIVATE_SENTINEL'));
  assert.equal(n.snapshotFor('pilot').chatMessages.length, 1); assert.equal(n.snapshotFor('engineer').chatMessages.length, 0);
  const pub = await n.sendChat({text:'Public'});
  assert.ok(wires.engineer.some(p => p.type === 'CHAT_MESSAGE' && p.entry.id === pub.id));
  assert.equal(store.state.logs.length, original.logs.length);
});

test('guest ignores injected chat and chat intended for somebody else', async () => {
  const n = manager(); store.sessionRole = 'player'; store.memberId = 'pilot'; n.room = 'test'; n.hostConn = {peer:'host'};
  const packet = {type:'CHAT_MESSAGE',room:'test',messageId:'one',entry:message()};
  await n.handleIncomingMessage(packet,'stranger'); assert.equal(store.state.chatMessages.length,0);
  await n.handleIncomingMessage({...packet,messageId:'two',entry:message({recipientId:'engineer',recipientName:'Engineer'})},'host'); assert.equal(store.state.chatMessages.length,0);
  await n.handleIncomingMessage({...packet,messageId:'three'},'host'); assert.equal(store.state.chatMessages.length,1);
  await assert.rejects(n.sendChat({text:'offline'}),/Not connected/);
});

test('saved sessions and exports keep chat, new and legacy sessions start empty', async () => {
  const n = manager(); await n.sendChat({text:'Remember this'}); await store.saveQueue;
  const id = store.state.campaignId;
  assert.equal((await readCampaign(id)).chatMessages[0].text, 'Remember this');
  assert.equal(store.serializeCampaign().chatMessages[0].text,'Remember this');
  const legacy = store.serializeCampaign(); delete legacy.chatMessages;
  assert.deepEqual(validateCampaign(legacy).chatMessages,[]); assert.deepEqual(store.normalizeCampaign(legacy).chatMessages,[]);
  await store.createSession('New empty table'); assert.equal(store.state.chatMessages.length,0);
  await store.openSession(id); assert.equal(store.state.chatMessages[0].text,'Remember this');
});

test('chat renders untrusted text literally and hides private history in Player preview', () => {
  store.state.chatMessages = [message({text:'<img src=x onerror=alert(1)>',senderName:'<b>Keeper</b>'}), message({text:'PRIVATE',recipientId:'pilot',recipientName:'Pilot'})];
  const p = panel(manager()); assert.equal(p.list.querySelector('img'), null); assert.match(p.list.textContent, /<img/);
  p.choose('pilot'); assert.match(p.list.textContent,/PRIVATE/);
  store.update({userRole:'player'}); assert.ok(!p.root.textContent.includes('PRIVATE')); assert.equal(p.viewer, null);
});

test('channel drafts stay separate; offline recipients cannot fall back to the public table', async () => {
  const n = manager(); host(n); const p = panel(n);
  p.input.value = 'Public draft'; p.choose('pilot'); assert.equal(p.input.value, '');
  p.input.value = 'Private draft'; p.choose(TABLE); assert.equal(p.input.value, 'Public draft');
  p.choose('pilot'); assert.equal(p.input.value, 'Private draft');
  store.update({connectedPeers:[]}); p.refreshComposer(); assert.equal(p.button.disabled,true);
  await p.send(); assert.equal(store.state.chatMessages.length,0); assert.equal(p.channel,'pilot'); assert.equal(p.input.value,'Private draft');
});

test('failed sends retain draft and retry ID, successful acknowledgement clears only the sent draft', async () => {
  const calls = []; let fail = true, finish;
  const p = panel({sendChat: async payload => { calls.push(payload); if (fail) throw new Error('Timeout'); await new Promise(r => {finish=r;}); }});
  p.input.value = 'Retry me'; await p.send(); assert.equal(p.input.value,'Retry me'); assert.match(p.error.textContent,/Timeout/);
  fail = false; const sending = p.send(); p.input.value = 'New unsent text'; finish(); await sending;
  assert.equal(calls[0].clientId,calls[1].clientId); assert.equal(p.input.value,'New unsent text'); assert.equal(p.pending,null);
});

test('Enter sends, Shift+Enter and IME composition do not; session changes clear drafts', async () => {
  const calls=[]; const p=panel({sendChat:async args=>calls.push(args)});
  p.input.value='Hello';
  for (const props of [{shiftKey:true},{isComposing:true}]) p.input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,...props}));
  assert.equal(calls.length,0);
  p.input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,0)); assert.equal(calls.length,1); assert.equal(p.input.value,'');
  p.input.value='Old campaign draft'; store.update({campaignId:'another'}); assert.equal(p.input.value,'');
});

test('unread count survives another open conversation and clears when its thread is visible', () => {
  const n=manager();host(n);const p=panel(n);p.root.style.display='none';
  store.update({chatMessages:[message({senderId:'pilot',senderName:'Pilot',recipientId:KEEPER,recipientName:'Keeper',text:'Whisper'})]});
  assert.equal(p.unread.size,1); assert.equal(document.querySelector('.chat-unread').hidden,false);
  p.root.style.display='block';p.refresh();assert.equal(p.unread.size,1);
  p.choose('pilot');assert.equal(p.unread.size,0);
});
