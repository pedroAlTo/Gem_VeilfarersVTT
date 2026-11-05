import { randomUUID } from 'node:crypto';

const channel = 'veil:lan';
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const validKey = value => typeof value === 'string' && /^[a-zA-Z0-9-]{20,100}$/.test(value);

// Use the LAN launcher's existing WebSocket. All replies are unicast to the
// recipient's socket. The Keeper still validates HELLOs, ownership and moves.
export function lanSessions() {
  return {
    name: 'veil-lan-sessions',
    apply: 'serve',
    configureServer(server) {
      if (server.config.env.VITE_SESSION_TRANSPORT !== 'lan' || server.config.env.VITE_LOCAL_ONLY === '1') return;
      const sockets = new Map();
      const rooms = new Map();
      const reply = (seat, message) => seat.client.send(channel, { ...message, instance: seat.instance });

      function unlink(seat, other) {
        if (!seat.links.delete(other.id)) return;
        other.links.delete(seat.id);
        reply(other, { op: 'closed', peer: seat.id });
      }
      function remove(seat) {
        sockets.delete(seat.client);
        if (seat.host) rooms.delete(seat.id);
        seat.client.socket.off('close', seat.onClose);
        for (const other of seat.links.values()) unlink(seat, other);
      }
      function receive(message, client) {
        if (!message || !validKey(message.instance)) return;
        const seat = sockets.get(client);
        if (message.op === 'register') {
          const host = message.room !== undefined;
          if (seat || (host && (!validId(message.room) || !validKey(message.invite)))) return;
          if (host && rooms.has(message.room)) {
            client.send(channel, { instance: message.instance, op: 'error', text: 'This room is already in use.' });
            return;
          }
          const entry = { client, instance: message.instance, host, id: host ? message.room : randomUUID(), links: new Map() };
          entry.onClose = () => remove(entry);
          if (host) { entry.invite = message.invite; rooms.set(entry.id, entry); }
          sockets.set(client, entry);
          client.socket.once('close', entry.onClose);
          reply(entry, { op: 'ready', id: entry.id });
          return;
        }
        if (!seat || seat.instance !== message.instance) return;
        if (message.op === 'leave') { remove(seat); return; }
        if (message.op === 'connect' && !seat.host && !seat.links.size) {
          const host = rooms.get(message.to);
          if (!host || host.invite !== message.invite) {
            reply(seat, { op: 'error', text: 'No matching invitation on this LAN server. Open the Keeper’s address and paste the complete code.' });
            return;
          }
          if (host.links.size >= 6) { reply(seat, { op: 'error', text: 'The table is full.' }); return; }
          host.links.set(seat.id, seat);
          seat.links.set(host.id, host);
          reply(host, { op: 'incoming', peer: seat.id });
          reply(seat, { op: 'connected', peer: host.id });
          return;
        }
        const other = seat.links.get(message.to);
        if (!other) return;
        if (message.op === 'close') unlink(seat, other);
        if (message.op === 'data' && message.data && typeof message.data === 'object') {
          reply(other, { op: 'data', peer: seat.id, data: message.data });
        }
      }
      server.ws.on(channel, receive);
      server.httpServer?.once('close', () => server.ws.off(channel, receive));
    },
  };
}
