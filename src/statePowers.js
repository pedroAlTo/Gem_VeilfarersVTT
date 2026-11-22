import { immuneTo } from './powerEffects.js';
export const PATH_TRAITS = ['agility', 'instinct', 'strength'];
export const isPath = name => /^(path to nirvana|the refused path)$/i.test(name || '');
export const activePath = token => token?.effectClocks?.find(c => isPath(c.name) && c.filled < c.segments);
export const pathBranch = token => {
  const name = token?.subclass || '';
  if (/ghost blade|void/i.test(name)) return 'Void';
  if (/kinetic|echo/i.test(name)) return 'Kinetic';
  if (/pure conduit|lux/i.test(name)) return 'Lux';
  return '';
};
export const pathImmune = (token, condition) => (!!activePath(token) && /^(Stunned|Dazed)$/i.test(condition)) || immuneTo(token, condition);
export const pathTitle = clock => /^the refused path$/i.test(clock.name) ? 'Disciplined State' : 'Nirvana State';
export function pathBadge(clock) {
  return pathTitle(clock) + ' · ' + (clock.trait || 'elige atributo') + ' · Integridad ' + (clock.segments - clock.filled) + '/' + clock.segments;
}
export function pathCard(card, token) {
  if (card.kind !== 'feature' || !isPath(card.name)) return card;
  const clock = activePath(token);
  if (!clock) return { ...card, chooseTrait: true };
  const branch = pathBranch(token);
  const closing = (card.text.split(/\*\*Breaking Point\.\*\*/i)[1] || '').trim().split('\n')[0];
  return { ...card, id: card.id + ':reverse', frontName: card.name, reverse: true, clockId: clock.id,
    chooseTrait: !clock.trait, name: 'Breaking Point', subtitle: pathBadge(clock), text: closing,
    rollText: '+' + (token.proficiency || 1) + 'd6' + (branch ? ' ' + branch : ''), costText: 'Gratuito',
    cost: { hope: 0, effort: 0, stress: 0, hp: 0, resolve: 0 } };
}

export const CONTEXT_EDGES = {
  'Linguistic Patch': ['presence', 'Interacción social en la que importa el contexto cultural'],
  'Perfect Facade': ['presence', 'Mantener el engaño del disfraz'],
  'Veil Sensitivity': ['instinct', 'Detectar mentiras o intenciones hostiles'],
  'Ecosystem Analysis': ['instinct', 'Supervivencia, navegación o rastreo en la zona estudiada'],
  'Eyes of Truth': ['instinct', 'Percibir o investigar'],
  'Temporal Cloak': ['agility', 'Evitar ser detectado'],
};
export function contextualEdges(actor, trait) {
  return (actor?.effectClocks || []).filter(clock => Object.hasOwn(CONTEXT_EDGES, clock.name) && CONTEXT_EDGES[clock.name][0] === trait);
}
