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
      // What a Power gave for the scene goes with it (v2.52.0): temporary Armor Slots and weapons.
      const armorBack = gone.reduce((n, c) => n + (c.tempArmor && !c.sourceId ? c.tempArmor : 0), 0), weaponsGone = gone.map(c => c.grantWeapon).filter(Boolean);
      const patch = { effectClocks: token.effectClocks.filter(c => !c.scene) };
      if (armorBack && token.armor) { const max = Math.max(0, (token.armor.max || 0) - armorBack); patch.armor = { ...token.armor, max, current: Math.min(max, Math.max(0, (token.armor.current || 0) - armorBack)) }; }
      if (weaponsGone.length && token.inventory?.weapons) patch.inventory = { ...token.inventory, weapons: token.inventory.weapons.filter(w => !weaponsGone.includes(w.id)) };
      store.updateToken(token.id, patch);
      for (const c of gone) { ended++; store.addLog({ sender: token.name, type: 'EFFECT', title: `Fin de ${c.name}`, details: `${token.name}: «${c.name}» termina al acabar la escena.` }); }
    }
  } finally { store.tableActing = before; }
  return ended;
}

export function endTemporaryArmor(sourceId) {
  if (!isTable()) return 0;
  let ended = 0;
  const before = store.tableActing; store.tableActing = true;
  try {
    for (const token of store.state.tokens) {
      const gone = (token.effectClocks || []).filter(c => c.tempArmor && c.sourceId === sourceId);
      if (!gone.length) continue;
      const extra = gone.reduce((n, c) => n + c.tempArmor, 0), armor = token.armor || { current: 0, max: 0 };
      const max = Math.max(0, (armor.max || 0) - extra);
      store.updateToken(token.id, { armor: { ...armor, max, current: Math.min(max, Math.max(0, (armor.current || 0) - extra)) }, effectClocks: token.effectClocks.filter(c => !gone.includes(c)) });
      store.addLog({ sender: token.name, type: 'EFFECT', title: 'Fin de ' + gone[0].name, details: `${token.name}: terminan los ${extra} Armor Slots temporales.` });
      ended++;
    }
  } finally { store.tableActing = before; }
  return ended;
}

export function startEffectClocks() {
  let last = new Map(store.state.tokens.map(t => [t.id, t])), scene = store.state.activeMapId;
  store.subscribe((state, keys) => {
    if (state.activeMapId !== scene) { const was = scene; scene = state.activeMapId; if (was) queueMicrotask(endSceneEffects); }
    if (Array.isArray(keys) && !keys.includes('tokens')) return;
    for (const token of state.tokens) {
      const previous = last.get(token.id);
      if (!isTable() || !previous || previous.hasSpotlight || !token.hasSpotlight) continue;
      // Tactical Overwatch: the temporary Armor Slots last until the start of the giver's Spotlight.
      queueMicrotask(() => endTemporaryArmor(token.id));
      // The Spotlight clocks this Spotlight advanced (combatTransition marked them).
      for (const clock of previous.effectClocks || []) {
        if (clock.tick !== 'spotlight') continue;
        const now = (token.effectClocks || []).find(c => c.id === clock.id);
        if (now && now.filled === clock.filled) continue;
        const left = now ? now.segments - now.filled : 0, healed = clock.perTick?.hp ? ` ${token.name} recupera ${clock.perTick.hp} HP.` : '';
        // Weapon effects (v2.45.0): Continuous marks Stress; Melting asks its Reaction Roll now.
        const strained = clock.perTick?.stress ? ` ${token.name} marca ${clock.perTick.stress} Stress.` : '';
        const melting = clock.melting ? ` ${token.name} tira Strength contra CD ${clock.dc || 10}: si falla, recibe ${(clock.die || 'd6').replace(/^d/, '1d')} de daño Energy; si acierta, la mitad (con umbrales y Armor Slots).` : '';
        const details = (left ? `${clock.name} · ${left} / ${clock.segments} pendientes.` : `Fin de ${clock.name}.`) + healed + strained + melting;
        queueMicrotask(() => { if (!left) notify(details); store.addLog({ sender: token.name, type: 'EFFECT', title: clock.name, details }); });
      }
    }
    last = new Map(state.tokens.map(t => [t.id, t]));
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
