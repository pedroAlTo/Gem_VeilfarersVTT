// The map canvas and the roster both load ordinary, self-contained image URLs.
// Bake only existing ancestry portraits and editorial class insignia into the build.
import { readFileSync } from 'node:fs';
import { ANCESTRY_IDS, PORTRAIT_GENDERS, TOKEN_CLASSES, classPortraitPath, detectArchetype } from '../src/tokenAvatars.js';

const sources = new Map();
for (const ancestry of ANCESTRY_IDS) for (const gender of PORTRAIT_GENDERS) {
  for (const cls of TOKEN_CLASSES) {
    const image = gender === 'n' ? ancestry + '_n.jpg' : ancestry + '_' + detectArchetype(cls) + '_' + gender + '.jpg';
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
    const portrait = asset('../public/assets/tokens/' + image);
    const badge = asset('../public/assets/cards/class-' + cls + '-flag.png');
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512">' +
      '<image width="512" height="512" xlink:href="data:image/jpeg;base64,' + portrait + '"/>' +
      '<image x="320" y="320" width="73" height="142" xlink:href="data:image/png;base64,' + badge + '"/></svg>';
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
