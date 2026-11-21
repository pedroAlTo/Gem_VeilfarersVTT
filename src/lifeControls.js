import { lifeStage, roundKey, BLAZE_CHOICES, canChooseBlaze } from './combatState.js';
import { escapeHTML as esc, confirmAction, sanitizeHTML } from './ui.js';
import { distanceInfo } from './attackFlow.js';
import { throwDice } from './tableDice.js';

// Render in the character's existing Conditions panel. The table validates every choice again.
export function renderLifeControls(box, actor, store, network, showError) {
  if (!actor) { box.replaceChildren(); return; }
  const stage = lifeStage(actor), editable = store.canEditToken(actor.id);
  const dying = stage === 'Dying' || stage === 'Final';
  const mayChoose = store.sessionRole === 'local' || canChooseBlaze(actor, store.memberId || store.peerId);
  const map = store.getActiveMap(), turn = roundKey(map);
  const eligible = editable && actor.hasSpotlight && actor.lifeRollRound !== turn;
  const allies = !stage && editable ? store.state.tokens.filter(t => t.id !== actor.id && t.mapId === actor.mapId && !t.hidden && ['Dying', 'Final'].includes(lifeStage(t)) && distanceInfo(actor, t, map).band === 'Melee') : [];
  box.innerHTML = sanitizeHTML([
    stage ? `<p>${esc(stage)}${dying ? ' · ' + (actor.lifeProgress || 0) + '/2 · Corebook 10' : ''}</p>` : '',
    dying && editable ? `<button class="hud-btn" data-progress ${eligible ? '' : 'disabled'}>Progreso · 1d12</button>
      <vf-select aria-label="Blaze of Glory" data-blaze-choice>${BLAZE_CHOICES.map(c => `<option>${c}</option>`).join('')}</vf-select>
      <button class="hud-btn" data-blaze ${eligible && mayChoose ? '' : 'disabled'}>Blaze of Glory…</button>${mayChoose ? '': '<small>El jugador asignado elige su último acto.</small>'}` : '',
    stage === 'Last Act' && editable ? '<p>' + esc(actor.blazeChoice) + '</p><button class="hud-btn" data-finish>Marcar el último acto como resuelto</button>' : '',
    allies.length ? `<label>Estabilizar a un aliado adyacente <vf-select data-rescue>${allies.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</vf-select></label>
      <button class="hud-btn" data-rescue-trait="knowledge">Knowledge (Medicine)</button> <button class="hud-btn" data-rescue-trait="finesse">Finesse</button>` : ''
  ].join(''));
  const send = async action => { try { await network.requestAction({ ...action, actorId: actor.id }); } catch (e) { showError(e.message); } };
  const finish = box.querySelector('[data-finish]');
  if (finish) finish.onclick = () => send({ type: 'LIFE_TURN', finish: true });
  const progress = box.querySelector('[data-progress]');
  if (progress) progress.onclick = async () => {
    progress.disabled = true;
    try {
      const [face] = await throwDice([{ qty: 1, sides: 12, role: stage }], { label: stage, actor });
      await send({ type: 'LIFE_TURN', turn, face });
    } finally { if (progress.isConnected) progress.disabled = !eligible; }
  };
  const blaze = box.querySelector('[data-blaze]');
  if (blaze) blaze.onclick = async () => {
    const choice = box.querySelector('[data-blaze-choice]').value;
    if (await confirmAction('Esta elección sustituye la tirada de progreso y el personaje muere al resolver su último acto.', { title: 'Blaze of Glory · ' + choice, accept: 'Confirmar último acto' }))
      await send({ type: 'LIFE_TURN', turn, blaze: choice, confirmed: true });
  };
  for (const btn of box.querySelectorAll('[data-rescue-trait]')) btn.onclick = () => send({ type: 'STABILIZE', targetId: box.querySelector('[data-rescue]').value, traitId: btn.dataset.rescueTrait });
}
