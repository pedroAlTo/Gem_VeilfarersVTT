import { APP_VERSION, RELEASE_BASENAME } from './version.js';
import { RELEASES, LEGACY_HISTORY } from './releaseHistory.js';

export function changelogMarkdown() {
  const lines = [
    '# VeilFarers VTT — Changelog', '',
    `Versión actual del VTT: **v${APP_VERSION}**.`,
    `Paquete: \`${RELEASE_BASENAME}.zip\`.`,
    'Reglas de referencia: **Corebook 12.06** (numeración independiente).', '',
    'Las entregas con nombre de archivo versionado comienzan en v1.1.0. El historial anterior conserva sus nombres Orbital; no se le asignan versiones retroactivamente.', '',
  ];
  for (const release of RELEASES) {
    lines.push(`## [${release.version}] — ${release.date}`, '', release.title, '');
    for (const section of release.sections) lines.push(`### ${section.title}`, '', ...section.items.map(item => `- ${item}`), '');
  }
  lines.push('## Historial previo — entregas Orbital', '');
  for (const entry of LEGACY_HISTORY) lines.push(`- **${entry.date} · ${entry.title}:** ${entry.text}`);
  lines.push('', 'El detalle técnico original y sus verificaciones se conservan en [RELEASE_ORBITAL.md](RELEASE_ORBITAL.md), incluido en el paquete.', '');
  return lines.join('\n');
}
