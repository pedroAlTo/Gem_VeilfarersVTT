// Effect clocks at the table: a segment is marked each time a token gains the Spotlight (only the
// table that resolves the game does it, so it is counted once), and a touch on a clock beside a
// token marks one by hand. A full clock ends its effect with a notice and a log entry. Clocks with
// a per-turn effect (Rapid Regeneration: +1 HP) apply it when the Spotlight marks them.
import { store } from './state.js';
import { notify } from './ui.js';
import { tickClocks, clockAt } from './effectClocks.js';

const isTable = () => store.sessionRole !== 'player';

export function advanceClocks(tokenId, selector) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token?.effectClocks?.length) return null;
  const result = tickClocks(token.effectClocks, selector);
  if (!result.ticked.length) return null;
  const patch = { effectClocks: result.list };
  const heal = selector.kind === 'spotlight' ? result.ticked.reduce((n, c) => n + (c.perTick?.hp || 0), 0) : 0;
  if (heal && token.hp) patch.hp = { ...token.hp, current: Math.min(token.hp.max, (token.hp.current || 0) + heal) };
  if (isTable()) {
    const before = store.tableActing; store.tableActing = true;
    try { store.updateToken(token.id, patch); } finally { store.tableActing = before; }
  } else if (!store.updateToken(token.id, patch)) { notify('Ese reloj es de un personaje que no controlas.', 'error'); return null; }
  for (const clock of result.ticked) {
    const left = clock.segments - clock.filled, ended = result.expired.some(c => c.id === clock.id);
    const text = ended ? `«${clock.name}» termina para ${token.name}.` : `«${clock.name}» (${token.name}): quedan ${left} de ${clock.segments}.`;
    if (ended) notify(text);
    if (isTable()) store.addLog({ sender: token.name, type: 'EFFECT', title: ended ? `Fin de ${clock.name}` : clock.name, details: `${text}${heal && clock.perTick?.hp ? ` Recupera ${clock.perTick.hp} HP.` : ''}` });
  }
  return result;
}

// Effects that last until the end of the scene (the Integrity Die states) end when the table
// moves to another scene.
export function endSceneEffects() {
  if (!isTable()) return 0;
  let ended = 0;
  const before = store.tableActing; store.tableActing = true;
  try {
    for (const token of store.state.tokens) {
      const gone = (token.effectClocks || []).filter(c => c.scene);
      if (!gone.length) continue;
      store.updateToken(token.id, { effectClocks: token.effectClocks.filter(c => !c.scene) });
      for (const c of gone) { ended++; store.addLog({ sender: token.name, type: 'EFFECT', title: `Fin de ${c.name}`, details: `${token.name}: «${c.name}» termina al acabar la escena.` }); }
    }
  } finally { store.tableActing = before; }
  return ended;
}

export function startEffectClocks() {
  let last = new Map(), scene = store.state.activeMapId;
  store.subscribe((state, keys) => {
    if (state.activeMapId !== scene) { const was = scene; scene = state.activeMapId; if (was) queueMicrotask(endSceneEffects); }
    if (Array.isArray(keys) && !keys.includes('tokens')) return;
    const now = new Map(state.tokens.map(t => [t.id, !!t.hasSpotlight]));
    if (isTable()) for (const t of state.tokens) {
      if (t.hasSpotlight && last.has(t.id) && !last.get(t.id) && t.effectClocks?.some(c => c.tick === 'spotlight')) queueMicrotask(() => advanceClocks(t.id, { kind: 'spotlight' }));
    }
    last = now;
  });
  // A touch on a clock beside a token marks one segment (not while aiming an attack).
  const attach = () => {
    const engine = window.veilCanvas, canvas = engine?.canvas;
    if (!canvas) { setTimeout(attach, 500); return; }
    canvas.addEventListener('pointerdown', event => {
      if (window.veilActionBar?.targeting || !engine.screenToWorld) return;
      const rect = canvas.getBoundingClientRect(), world = engine.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
      const grid = store.getActiveMap?.()?.gridSize || 64;
      for (const token of [...store.getTokensForActiveMap()].reverse()) {
        if (!token.effectClocks?.length) continue;
        const clock = clockAt(token, world, ((token.size || 1) * grid) / 2, engine.zoom || 1);
        if (!clock) continue;
        event.preventDefault(); event.stopImmediatePropagation();
        if (!store.canEditToken(token.id)) { notify('Ese reloj es de un personaje que no controlas.', 'error'); return; }
        advanceClocks(token.id, { id: clock.id });
        return;
      }
    }, true);
  };
  attach();
}
