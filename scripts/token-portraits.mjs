// The map canvas and the roster both load ordinary, self-contained image URLs.
// Bake only existing ancestry portraits and editorial class insignia into the build.
import { readFileSync } from 'node:fs';
import { ANCESTRY_IDS, PORTRAIT_GENDERS, TOKEN_CLASSES, classPortraitPath, crewPortraitPath } from '../src/tokenAvatars.js';

const sources = new Map();
for (const ancestry of ANCESTRY_IDS) for (const gender of PORTRAIT_GENDERS) {
  for (const cls of TOKEN_CLASSES) {
    const image = crewPortraitPath(ancestry, gender, cls);
    sources.set(classPortraitPath(ancestry, cls, gender), { image, cls });
  }
}

export function tokenPortraitsPlugin() {
  const encoded = new Map();
  function asset(path) {
    if (!encoded.has(path)) encoded.set(path, readFileSync(new URL(path, import.meta.url)).toString('base64'));
    return encoded.get(path);
  }
  function render({ image, cls }) {
    const portrait = asset('../public' + image);
    const badge = asset('../public/assets/cards/class-' + cls + '-flag.png');
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="768" height="768" viewBox="0 0 768 768">' +
      '<image width="768" height="768" xlink:href="data:image/webp;base64,' + portrait + '"/>' +
      '<image x="498" y="495" width="84" height="160" xlink:href="data:image/png;base64,' + badge + '"/></svg>';
  }
  return {
    name: 'veil-token-portraits',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const source = sources.get(req.url?.split('?')[0]);
        if (!source) return next();
        res.setHeader('Content-Type', 'image/svg+xml');
        res.end(render(source));
      });
    },
    generateBundle() {
      for (const [url, source] of sources) this.emitFile({ type: 'asset', fileName: url.slice(1), source: render(source) });
    },
  };
}
