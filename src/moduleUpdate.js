// Brings a room made from a prepared module up to date (v2.63.0). The user's Hearts in the Void room
// was created before the NPC images and the shareable dossiers existed («tienes las imágenes de muchos
// PNJ, añádelas al dossier»). Only the module's own content changes: the Keeper's maps, token
// positions, clocks, arcs and own dossiers stay as they are.
export const MODULES = {
  'hearts-in-the-void': { name: 'Hearts in the Void', docPrefix: 'hv_', tokenPrefix: 'tok_hv_' },
};

// The module a room was made from, recognised by the ids of its content.
export function roomModule(state) {
  return Object.keys(MODULES).find(id => {
    const { docPrefix, tokenPrefix } = MODULES[id];
    return (state.handouts || []).some(h => h.id?.startsWith(docPrefix)) || (state.tokens || []).some(t => t.id?.startsWith(tokenPrefix));
  }) || null;
}

// An image the module (or the app) placed, as opposed to one the Keeper uploaded or linked.
const presetImage = url => !url || url.startsWith('/assets/') || url.startsWith('/campaigns/');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function mergeModule(state, module, moduleId) {
  const { docPrefix, tokenPrefix } = MODULES[moduleId];
  const counts = { docsAdded: 0, docsUpdated: 0, tokensAdded: 0, tokensUpdated: 0 };

  // Dossiers: the module's are refreshed to their latest text and image (shared ones stay shared,
  // unless the module now keeps them for the Keeper); new ones are added, not shared.
  const moduleDocs = (module.handouts || []).filter(h => h.id?.startsWith(docPrefix));
  const docById = new Map(moduleDocs.map(h => [h.id, h]));
  const handouts = (state.handouts || []).map(h => {
    const m = docById.get(h.id);
    if (!m) return h;
    const next = { ...h, title: m.title, sender: m.sender, timestamp: m.timestamp, folder: m.folder, keeperOnly: !!m.keeperOnly, contentHtml: m.contentHtml,
      imageUrl: presetImage(h.imageUrl) ? (m.imageUrl || h.imageUrl || '') : h.imageUrl, sharedWithPlayers: m.keeperOnly ? false : !!h.sharedWithPlayers };
    if (m.keeperHtml) next.keeperHtml = m.keeperHtml; else delete next.keeperHtml;
    if (!same(next, h)) counts.docsUpdated++;
    return next;
  });
  const have = new Set(handouts.map(h => h.id));
  for (const m of moduleDocs) if (!have.has(m.id)) { handouts.push({ ...structuredClone(m), sharedWithPlayers: false }); counts.docsAdded++; }

  // Tokens: what the players may read (description) and the portrait follow the module, unless the
  // Keeper chose an image of their own; everything about the table (place, scene, vitals) stays.
  const moduleTokens = (module.tokens || []).filter(t => t.id?.startsWith(tokenPrefix));
  const tokById = new Map(moduleTokens.map(t => [t.id, t]));
  const tokens = (state.tokens || []).map(t => {
    const m = tokById.get(t.id);
    if (!m) return t;
    const next = { ...t, roleTag: m.roleTag ?? t.roleTag, species: m.species ?? t.species, description: m.description ?? t.description,
      ...(presetImage(t.avatarUrl) && m.avatarUrl ? { avatarUrl: m.avatarUrl, portraitOverride: true } : {}) };
    if (!same(next, t)) counts.tokensUpdated++;
    return next;
  });
  const haveTok = new Set(tokens.map(t => t.id));
  for (const m of moduleTokens) if (!haveTok.has(m.id)) { tokens.push(structuredClone(m)); counts.tokensAdded++; }

  // The module's acts list their new people.
  const arcs = (state.arcs || []).map(a => {
    const m = (module.arcs || []).find(x => x.id === a.id);
    if (!m) return a;
    const ids = [...new Set([...(a.tokenIds || []), ...(m.tokenIds || []).filter(id => tokens.some(t => t.id === id))])];
    return ids.length === (a.tokenIds || []).length ? a : { ...a, tokenIds: ids };
  });

  // The module plays with fog of war (v2.64.3); rooms made before had it off by mistake.
  const fogOn = state.fogOfWar === false && module.fogOfWar !== false;
  if (fogOn) counts.fogOn = true;
  return { handouts, tokens, arcs, counts, ...(fogOn ? { fogOfWar: true } : {}) };
}

// The module's images for the room's dossiers that have none (v2.64.5, user report: «no veo las
// imágenes aplicadas a los dossiers»: the room was made before them and «Actualizar módulo» had not
// been pressed). It only fills empty images, so it is applied on its own when the Keeper opens the room.
export function moduleImages(state, module, moduleId) {
  const { docPrefix } = MODULES[moduleId];
  const images = new Map((module.handouts || []).filter(h => h.id?.startsWith(docPrefix) && h.imageUrl).map(h => [h.id, h.imageUrl]));
  let filled = 0;
  const handouts = (state.handouts || []).map(h => {
    const url = images.get(h.id);
    if (!url || h.imageUrl) return h;
    filled++;
    return { ...h, imageUrl: url };
  });
  return { handouts, filled };
}

// What «Actualizar módulo» would still change, or null when the room is up to date (v2.64.5).
export function pendingUpdate(state, module, moduleId) {
  const { counts } = mergeModule(state, module, moduleId);
  return counts.docsAdded || counts.docsUpdated || counts.tokensAdded || counts.tokensUpdated || counts.fogOn ? counts : null;
}
