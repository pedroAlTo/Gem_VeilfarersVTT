import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../src/version.js';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('the documentation names the installed version and no longer describes a retired sign-in', () => {
  const readme = read('README.md'), local = read('PRUEBAS_LOCALES.md');
  assert.ok(readme.startsWith(`# VeilFarers VTT · v${APP_VERSION}`), 'README heading');
  assert.ok(readme.includes(`Current release: **v${APP_VERSION}**`), 'README release line');
  assert.ok(local.includes(`**VTT v${APP_VERSION}**`) && local.includes(`VeilFarers_VTT_v${APP_VERSION}.zip`), 'PRUEBAS_LOCALES version');
  for (const text of [readme, local, read('FIREBASE_SETUP.md')]) assert.ok(!/Repite con Netlify Identity|Una cuenta Netlify Identity, por sí sola/.test(text));
  assert.match(readme, /## What is new in V2/); assert.match(local, /## V2 · qué comprobar/);
});
