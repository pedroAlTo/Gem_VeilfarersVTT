import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.error('Install Node.js 20+ or Node.js 22/24 LTS, then run this file again.');
  process.exit(1);
}

const stamp = 'node_modules/.veilfarers-local-ready';
const hash = createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
const hasVite = existsSync('node_modules/vite/bin/vite.js');
const ready = hasVite && existsSync(stamp) && readFileSync(stamp, 'utf8') === hash;

if (!ready) {
  if (hasVite) {
    try { writeFileSync(stamp, hash); } catch {}
    console.log('Local dependencies verified.');
  } else {
    console.log('Installing locked dependencies (internet is required for this step)...');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    let result = spawnSync(npmCmd, ['ci'], { stdio: 'inherit', shell: true });
    if (result.error || result.status !== 0) {
      console.log('npm ci failed, attempting npm install...');
      result = spawnSync(npmCmd, ['install'], { stdio: 'inherit', shell: true });
    }
    if (result.error || result.status !== 0) {
      console.error(result.error?.message || 'Dependency installation failed. Check your internet connection.');
      process.exit(1);
    }
    try { writeFileSync(stamp, hash); } catch {}
  }
}

try {
  if (existsSync('node_modules/@firebase/util/postinstall.js') && !existsSync('node_modules/@firebase/util/dist/postinstall.mjs')) {
    spawnSync(process.execPath, ['node_modules/@firebase/util/postinstall.js'], { stdio: 'ignore' });
  }
} catch {}

console.log('Local dependencies ready.');
