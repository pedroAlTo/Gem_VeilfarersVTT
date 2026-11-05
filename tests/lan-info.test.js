import test from 'node:test';
import assert from 'node:assert/strict';
import { lanAddresses } from '../scripts/lan-info.mjs';

test('shows the physical LAN address first and lists other usable IPv4 adapters once', () => {
  const ipv4 = address => ({ family: 'IPv4', internal: false, address });
  assert.deepEqual(lanAddresses({
    'vEthernet (WSL)': [ipv4('172.24.0.1')],
    Loopback: [{ ...ipv4('127.0.0.1'), internal: true }],
    'Wi-Fi': [ipv4('192.168.2.43'), { address: 'fe80::1', family: 'IPv6', internal: false }],
    Ethernet: [{ ...ipv4('10.0.0.20'), family: 4 }, ipv4('192.168.2.43')],
  }), ['192.168.2.43', '10.0.0.20', '172.24.0.1']);
});

test('a machine without a usable IPv4 address has no shareable LAN URL', () => {
  assert.deepEqual(lanAddresses({ lo: [
    { address: '127.0.0.1', family: 4, internal: false },
    { address: '0.0.0.0', family: 'IPv4', internal: false },
    { address: '::1', family: 'IPv6', internal: true },
  ] }), []);
});
