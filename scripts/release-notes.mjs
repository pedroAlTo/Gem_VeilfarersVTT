import { readFile, writeFile } from 'node:fs/promises';
import { APP_VERSION } from '../src/version.js';
import { RELEASES } from '../src/releaseHistory.js';
import { changelogMarkdown } from '../src/releaseNotes.js';

const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(APP_VERSION) || RELEASES[0]?.version !== APP_VERSION || lock.version !== APP_VERSION || lock.packages[''].version !== APP_VERSION) {
  throw new Error('La versión de package.json, package-lock.json y la primera entrada del changelog deben coincidir.');
}
if (new Set(RELEASES.map(r => r.version)).size !== RELEASES.length) throw new Error('Hay versiones duplicadas en el changelog.');
const destination = new URL('../CHANGELOG.md', import.meta.url), content = changelogMarkdown();
if (process.argv.includes('--check')) {
  const current = await readFile(destination, 'utf8').catch(() => '');
  if (current !== content) throw new Error('CHANGELOG.md está desactualizado. Ejecuta npm run release:notes.');
  console.log(`Versiones y changelog coherentes: v${APP_VERSION}`);
} else {
  await writeFile(destination, content, 'utf8');
  console.log(`CHANGELOG.md actualizado para v${APP_VERSION}`);
}
