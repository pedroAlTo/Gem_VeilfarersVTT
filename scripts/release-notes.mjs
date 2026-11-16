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
// The documents that name the installed version are stamped with it, so they cannot fall behind.
const stamped = [
  ['../README.md', [[/^# VeilFarers VTT · v\d+\.\d+\.\d+/m, `# VeilFarers VTT · v${APP_VERSION}`], [/Current release: \*\*v\d+\.\d+\.\d+\*\*\. Download package: \*\*VeilFarers_VTT_v\d+\.\d+\.\d+\.zip\*\*/, `Current release: **v${APP_VERSION}**. Download package: **VeilFarers_VTT_v${APP_VERSION}.zip**`]]],
  ['../PRUEBAS_LOCALES.md', [[/VeilFarers_VTT_v\d+\.\d+\.\d+\.zip/, `VeilFarers_VTT_v${APP_VERSION}.zip`], [/\*\*VTT v\d+\.\d+\.\d+\*\*/, `**VTT v${APP_VERSION}**`], [/\*\*Changelog · v\d+\.\d+\.\d+\*\*/, `**Changelog · v${APP_VERSION}**`], [/VeilFarers_VTT_Changelog_v\d+\.\d+\.\d+\.md/, `VeilFarers_VTT_Changelog_v${APP_VERSION}.md`]]],
];
const documents = await Promise.all(stamped.map(async ([path, rules]) => {
  const url = new URL(path, import.meta.url), current = await readFile(url, 'utf8');
  let next = current;
  for (const [pattern, text] of rules) {
    if (!pattern.test(next)) throw new Error(`${path.slice(3)} ya no tiene la línea de versión que se actualiza sola (${pattern}).`);
    next = next.replace(pattern, text);
  }
  return { path: path.slice(3), url, current, next };
}));
if (process.argv.includes('--check')) {
  const current = await readFile(destination, 'utf8').catch(() => '');
  if (current !== content) throw new Error('CHANGELOG.md está desactualizado. Ejecuta npm run release:notes.');
  const behind = documents.filter(d => d.current !== d.next).map(d => d.path);
  if (behind.length) throw new Error(`${behind.join(' y ')} no indican la versión v${APP_VERSION}. Ejecuta npm run release:notes.`);
  console.log(`Versiones y changelog coherentes: v${APP_VERSION}`);
} else {
  await writeFile(destination, content, 'utf8');
  for (const d of documents) if (d.current !== d.next) await writeFile(d.url, d.next, 'utf8');
  console.log(`CHANGELOG.md actualizado para v${APP_VERSION}`);
}
