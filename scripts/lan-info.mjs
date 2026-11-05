import { isIPv4 } from 'node:net';
import { networkInterfaces } from 'node:os';
import { pathToFileURL } from 'node:url';

export function lanAddresses(interfaces) {
  const addresses = [];
  for (const [name, entries] of Object.entries(interfaces)) {
    for (const { address, internal, family } of entries ?? []) {
      if (internal || (family !== 'IPv4' && family !== 4) || !isIPv4(address)) continue;
      if (address.startsWith('127.') || address === '0.0.0.0') continue;
      // Several adapters can be active. Prefer the private LAN to virtual
      // adapters, and keep alternatives visible for multihomed hosts.
      const virtual = /vpn|virtual|vethernet|vmware|vbox|wsl|docker|wireguard|tailscale|hyper-v|^tun\d|^tap\d/i.test(name);
      const privateIP = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address);
      const score = (virtual ? 0 : 4) + (privateIP ? 2 : 0) - (address.startsWith('169.254.') ? 8 : 0);
      addresses.push({ address, score });
    }
  }
  addresses.sort((a, b) => b.score - a.score);
  return [...new Set(addresses.map(entry => entry.address))];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const primaryOnly = process.argv.includes('--primary');
  let addresses = [];
  try { addresses = lanAddresses(networkInterfaces()); }
  catch { /* Some restricted environments cannot enumerate network adapters. */ }
  if (!addresses.length) {
    if (!primaryOnly) console.error('No se ha detectado una IPv4 de red. Ejecuta ipconfig y comparte http://<IPv4 de Wi-Fi o Ethernet>:5173/ con los jugadores.');
    process.exitCode = 1;
  } else if (primaryOnly) {
    console.log(addresses[0]);
  } else {
    console.log('Desde otros equipos de la misma red, abre esta dirección:');
    console.log('  http://' + addresses[0] + ':5173/');
    if (addresses.length > 1) {
      console.log('Si usas otro adaptador, prueba la dirección que corresponda a tu red:');
      for (const address of addresses.slice(1)) console.log('  http://' + address + ':5173/');
    }
  }
}
