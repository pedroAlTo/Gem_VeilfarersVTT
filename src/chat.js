// Session chat is owned by the Keeper. Whispers always include the Keeper.
export const CHAT_LIMIT = 500;
export const CHAT_TEXT_LIMIT = 2000;
export const TABLE = 'table';
export const KEEPER = 'keeper';
const string = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function chatRequest(input) {
  if (!input || !string(input.text, CHAT_TEXT_LIMIT) || !string(input.clientId, 200) || !string(input.recipientId, 200)) {
    throw new Error('Escribe un mensaje de 1 a 2000 caracteres y selecciona un destinatario.');
  }
  return { text: input.text.trim(), clientId: input.clientId, recipientId: input.recipientId };
}

export function validateChatEntry(entry) {
  chatRequest(entry);
  if (!string(entry.id, 200) || !string(entry.senderId, 200) || entry.senderId === TABLE ||
      !string(entry.senderName, 80) || !string(entry.recipientName, 80) ||
      !Number.isSafeInteger(entry.sentAt) || entry.sentAt < 0 || entry.sentAt > 8640000000000000 ||
      entry.senderId === entry.recipientId ||
      (entry.recipientId !== TABLE && entry.senderId !== KEEPER && entry.recipientId !== KEEPER)) {
    throw new Error('Mensaje de chat no válido.');
  }
  // Only canonical fields are persisted or forwarded.
  const { id, clientId, senderId, senderName, recipientId, recipientName, text, sentAt } = entry;
  return { id, clientId, senderId, senderName, recipientId, recipientName, text, sentAt };
}

export function validateChatHistory(messages = []) {
  if (!Array.isArray(messages) || messages.length > CHAT_LIMIT) throw new Error('Historial de chat no válido.');
  const safe = messages.map(validateChatEntry);
  if (new Set(safe.map(m => m.id)).size !== safe.length ||
      new Set(safe.map(m => JSON.stringify([m.senderId, m.clientId]))).size !== safe.length) {
    throw new Error('Mensajes de chat duplicados.');
  }
  return safe;
}

export const chatVisibleTo = (entry, viewerId) => entry.recipientId === TABLE ||
  (!!viewerId && (entry.senderId === viewerId || entry.recipientId === viewerId));
export const chatHistoryFor = (messages = [], viewerId) => messages.filter(m => chatVisibleTo(m, viewerId)).map(validateChatEntry);
export const appendChat = (messages = [], entry) => messages.some(m => m.id === entry.id)
  ? messages : [...messages, validateChatEntry(entry)].slice(-CHAT_LIMIT);
export const chatThread = entry => entry.recipientId === TABLE ? TABLE : entry.senderId === KEEPER ? entry.recipientId : entry.senderId;
