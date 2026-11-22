// Only a use limit heading that governs the whole Power is charged on play. An optional
// once-per-scene clause inside an otherwise repeatable Power is adjudicated separately.
const labels = { session: 'sesión', 'long rest': 'descanso largo', 'story arc': 'arco', campaign: 'campaña' };
export const currentArc = state => state.arcs?.find(arc => arc.sceneIds?.includes(state.activeMapId));
const isUnassignedArcUse = ([key, scope]) => scope === 'story arc' && key.startsWith('["story arc","unassigned",');
export const hasUnassignedArcUses = actor => Object.entries(actor.cardUses || {}).some(isUnassignedArcUse);
export const limitScope = card => /^(?:power|archive|vault)$/.test(card.kind) ? /^once per (story arc|long rest|campaign|session)\b/i.exec((card.text || '').trim())?.[1].toLowerCase() || '' : '';
export function cardUse(card, state) {
  const scope = limitScope(card);
  if (!scope) return null;
  const arc = scope === 'story arc' && currentArc(state);
  // A scene outside an arc still supports play. Its boundary is declared by the Keeper.
  const scopeId = scope === 'story arc' ? arc?.id || 'unassigned' : scope;
  return { key: JSON.stringify([scope, scopeId, card.name]), scope, scopeId, label:'1 / ' + labels[scope] };
}
export const usedBy = (actor, use) => !!use && Object.hasOwn(actor?.cardUses || {}, use.key);
export function resetCardUses(actor, scope) {
  if (!actor.cardUses || !Object.values(actor.cardUses).includes(scope)) return {};
  return { cardUses:Object.fromEntries(Object.entries(actor.cardUses).filter(([,v]) => v !== scope)) };
}
export function beginCardSession(store) {
  if (store.sessionRole === 'player' || store.state.userRole !== 'keeper') throw new Error('Solo el Keeper puede abrir la sesión de juego.');
  store.update({tokens:store.state.tokens.map(t=>({...t,...resetCardUses(t,'session')}))});
  store.addLog({type:'SESSION',sender:'Keeper',title:'Nueva sesión de juego',details:'Se renuevan los poderes de un uso por sesión.'});
}
export function beginUnassignedArc(store) {
  if (store.sessionRole === 'player' || store.state.userRole !== 'keeper' || currentArc(store.state) || store.state.rest) {
    throw new Error('El Keeper puede iniciar un arco narrativo entre escenas sin arco asignado.');
  }
  const tokens = store.state.tokens.map(token => {
    if (!hasUnassignedArcUses(token)) return token;
    const kept = Object.entries(token.cardUses).filter(entry => !isUnassignedArcUse(entry));
    return { ...token, cardUses: Object.fromEntries(kept) };
  });
  store.update({ tokens });
  store.addLog({type:'SESSION',sender:'Keeper',title:'Nuevo arco narrativo',details:'Se han renovado los poderes por arco gastados en escenas sin arco asignado.'});
}
