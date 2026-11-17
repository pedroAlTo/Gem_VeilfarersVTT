// What a weapon feature leaves for the Keeper to resolve (a reaction roll, a choice, a condition
// to apply by hand) is whispered to the Keeper in the chat. From a player's machine it is an
// ordinary whisper to the Keeper; on the Keeper's own machine it lands in a "Reglas" thread
// that only the Keeper sees (whispers only reach their participants).
import { store } from './state.js';
import { network } from './networkManager.js';
import { newId } from './persistence.js';
import { KEEPER, CHAT_TEXT_LIMIT, appendChat } from './chat.js';

export const RULES_SENDER = 'veil-rules';

export function rulesWhisperText({ attacker = '', target = '', weapon = '', notes = [] } = {}) {
  const lines = notes.filter(Boolean);
  if (!lines.length) return '';
  const head = `⚔ ${attacker || 'Ataque'}${target ? ` → ${target}` : ''}${weapon ? ` · ${weapon}` : ''}: por resolver`;
  return [head, ...lines.map(l => `• ${l}`)].join('\n').slice(0, CHAT_TEXT_LIMIT);
}

export async function whisperToKeeper(text) {
  const clean = String(text ?? '').trim().slice(0, CHAT_TEXT_LIMIT);
  if (!clean) return false;
  try {
    if (store.sessionRole === 'player') { await network.sendChat({ text: clean, recipientId: KEEPER, clientId: newId() }); return true; }
    const entry = { id: newId(), clientId: newId(), senderId: RULES_SENDER, senderName: 'Reglas', recipientId: KEEPER, recipientName: 'Keeper', text: clean, sentAt: Date.now() };
    store.update({ chatMessages: appendChat(store.state.chatMessages, entry) });
    return true;
  } catch (error) {
    console.warn('Rules whisper not sent:', error);
    return false;
  }
}
