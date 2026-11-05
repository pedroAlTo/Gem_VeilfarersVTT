import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const [major,minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error('Install Node.js 22.12+ or Node.js 24 LTS, then run this file again.');
  process.exit(1);
}
const stamp = 'node_modules/.veilfarers-local-ready';
const hash = createHash('sha256').update(readFileSync('package-lock.json')).update(process.versions.node).digest('hex');
const ready = existsSync('node_modules/vite/bin/vite.js') && existsSync(stamp) && readFileSync(stamp,'utf8') === hash;
if (!ready) {
  console.log('Installing locked dependencies (internet is required for this step)...');
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d','/s','/c','npm ci'], { stdio:'inherit' })
    : spawnSync('npm', ['ci'], { stdio:'inherit' });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message || 'npm ci failed. Check the connection and retry.');
    process.exit(1);
  }
  writeFileSync(stamp,hash);
}
console.log('Local dependencies ready.');
