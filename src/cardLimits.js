// Only a use limit heading that governs the whole Power is charged on play. An optional
// once-per-scene clause inside an otherwise repeatable Power is adjudicated separately.
const labels = { session: 'sesión', 'long rest': 'descanso largo', 'story arc': 'arco', campaign: 'campaña' };
export const limitScope = card => /^(?:power|archive|vault)$/.test(card.kind) ? /^once per (story arc|long rest|campaign|session)\b/i.exec((card.text || '').trim())?.[1].toLowerCase() || '' : '';
export function cardUse(card, state) {
  const scope = limitScope(card);
  if (!scope) return null;
  const arc = scope === 'story arc' && state.arcs?.find(a => a.sceneIds?.includes(state.activeMapId));
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
