import { store } from './state.js';
import { dossierDialog } from './dossierDialog.js';
import { escapeHTML as e, notify } from './ui.js';
import { printedChecks, printedPools } from './cardProcedures.js';
import { currentArc } from './cardLimits.js';
import { throwDice } from './tableDice.js';
import { CONDITIONS } from './conditions.js';
import { EFFECT_OPTIONS, TARGET_RULES, eligible, adjudicateCard, requestCardChecks, cardRollOptions, resolutionLog } from './cardResolution.js';
import { PATH_TRAITS } from './statePowers.js';
import { tokenInventory } from './equipment.js';

const opt = (value, label, selected = false) => '<option value="' + e(String(value)) + '"' + (selected ? ' selected' : '') + '>' + e(String(label)) + '</option>';
const field = (label, html) => '<label class="dossier-field"><span>' + e(label) + '</span>' + html + '</label>';
const keeper = () => store.sessionRole !== 'player' && store.state.userRole === 'keeper';
export function cardChoices(card, actor, picked) {
  if (!actor) return '';
  const trait = card.chooseTrait ? field('Atributo con Ventaja', '<vf-select name="path_trait" required>' + opt('', 'Elige un atributo') + PATH_TRAITS.map(t => opt(t, t[0].toUpperCase() + t.slice(1))).join('') + '</vf-select>') : '';
  if (card.reverse) {
    if (trait) return trait;
    if (window.veilDiceRoller?.pendingDamageFor(actor.id)?.checkId) return '<p>Se añadirá al daño pendiente de esta acción.</p>';
    return field('Ataque de cierre', '<vf-select name="closing_weapon">' + opt('', 'Sin arma · Melee') + tokenInventory(actor).weapons.filter(w => w.damage && !/^n\/a$/i.test(w.damage)).map(w => opt(w.id, w.name)).join('') + '</vf-select>');
  }
  if (trait) return trait;
  const rule = TARGET_RULES[card.name];
  const options = store.state.tokens.filter(t => eligible(actor, t, store.getActiveMap(), rule));
  const marked = options.find(t => t.id === picked)?.id || (rule?.self && options.some(t => t.id === actor.id) ? actor.id : '');
  const targets = rule ? field('Objetivo · ' + rule.reach, '<vf-select name="card_target">' + opt('', rule.object ? 'Sistema sin token' : 'Elige un objetivo') + options.map(t => opt(t.id, t.name, t.id === marked)).join('') + '</vf-select>') :
    '<details class="card-targets"' + (marked ? ' open' : '') + '><summary>Objetivos en la escena</summary>' + options.map(t => '<label><input type="checkbox" name="card_target" value="' + e(t.id) + '"' + (marked === t.id ? ' checked' : '') + '> ' + e(t.name) + '</label>').join('') + '</details>';
  const dcs = card.kind === 'archive' ? null : cardRollOptions(card);
  return (dcs ? field('Dificultad del sistema', '<vf-select name="card_dc">' + dcs.map(dc => opt(dc, 'DC ' + dc)).join('') + '</vf-select>') : '') + targets;
}
export function chosenCardOptions(modal) {
  const targetIds = [...modal.querySelectorAll('vf-select[name=card_target],input[name=card_target]:checked')].map(el => el.value).filter(Boolean);
  return { targetIds, trait: modal.querySelector('[name=path_trait]')?.value, weaponId: modal.querySelector('[name=closing_weapon]')?.value,
    cardDC: Number(modal.querySelector('[name=card_dc]')?.value) || undefined };
}
const status = { roll: 'Tirada pendiente', ready: 'Resolver en mesa', done: 'Ver resolución' };
export const resolutionLabel = record => status[record.phase] || 'Ver carta';
export function openResolution(id) {
  const row = resolutionLog(store, id), record = row?.resolution;
  if (!record) return;
  const here = record.mapId === store.state.activeMapId;
  const editable = keeper() && here && record.phase !== 'done';
  const actor = store.state.tokens.find(t => t.id === record.actorId);
  const canRoll = record.roll && record.phase === 'roll' && here && actor && (keeper() || store.canEditToken(actor.id));
  const tokens = store.state.tokens.filter(t => t.mapId === record.mapId && (!t.hidden || keeper() && row.visibility === 'keeper'));
  const names = tokens.filter(t => record.targetIds.includes(t.id)).map(t => t.name);
  const freeArc = keeper() && here && !store.state.rest && !currentArc(store.state) && record.limit?.scopeId === 'unassigned' && actor?.cardUses?.[record.limit.key];
  const applied = record.applied.map(r => '<li>' + e(r.label) + '</li>').join('');
  const options = tokens.map(t => '<label><input type="checkbox" name="recipient" value="' + e(t.id) + '"' + (record.targetIds.includes(t.id) ? ' checked' : '') + '> ' + e(t.name) + '</label>').join('');
  const ruleText = String(record.text || '').replace(/\*\*/g, '');
  const preferred = /(?:gains?|becomes?|target is|inflict) (?:the )?(?:Dazed|Stunned|Hidden|Vulnerable|Frightened|Restrained|Bleeding)/i.test(ruleText) ? 'condition' : /(?:clear|mark)s? \d+ Stress/i.test(ruleText) ? 'stress' : 'note';
  const checks = printedChecks(record), pools = printedPools(record, actor);
  const tools = (checks.length ? field('Tirada que pide la regla', '<vf-select name="printed_check">' + checks.map((c,i) => opt(i,c.traitId + ' · DC ' + c.dc)).join('') + '</vf-select>') + '<button class="hud-btn" data-request>Solicitar a los objetivos</button>' : '') +
    (pools.length ? field('Dados impresos', '<vf-select name="pool">' + pools.map((p,i) => opt(i,p.label)).join('') + '</vf-select>') + '<button class="hud-btn" data-pool>Tirar dados</button>' + (actor ? '<button class="hud-btn" data-damage>Preparar daño contra un objetivo</button>' : '') : '');
  const replies = (record.replies || []).map(r => {
    const t = tokens.find(t => t.id === r.actorId);
    const can = t && here && record.phase !== 'done' && !r.outcome && (keeper() || store.canEditToken(t.id));
    return '<p>' + e([t?.name || 'Objetivo', r.traitId, 'DC ' + r.dc, r.outcome, r.total].filter(x => x != null).join(' · ')) + (can ? ' <button class="hud-btn" data-reply="' + e(r.id) + '">Tirar</button>' : '') + '</p>';
  }).join('');
  const controls = editable && record.phase === 'ready' ? '<fieldset><legend>Consecuencia según la ficha</legend><div class="card-targets">' + options + '</div>' + tools +
    field('Aplicar', '<vf-select name="kind">' + Object.entries(EFFECT_OPTIONS).map(([k,label]) => opt(k,label,k===preferred)).join('') + '</vf-select>') +
    field('Cantidad (+/−)', '<input name="amount" type="number" min="-100" max="100" value="1">') +
    field('Condición', '<vf-select name="condition">' + CONDITIONS.map(c => opt(c.name,c.name,ruleText.includes(c.name))).join('') + '</vf-select>') +
    field('Decisión de mesa', '<input name="note" maxlength="500">') +
    '<button type="button" class="hud-btn" data-effect="apply">Aplicar consecuencia</button></fieldset>' : '';
  const modal = dossierDialog(record.name, '<div class="card-resolution"><p>' + e([actor?.name, ...names, record.outcome, record.conclusion].filter(Boolean).join(' · ')) + '</p>' +
    (record.roll ? '<p>' + e(record.roll.traitId + ' · DC ' + record.roll.dc + (record.total != null ? ' · Resultado ' + record.total : '')) + '</p>' : '') +
    '<p class="card-inspect-text">' + e(ruleText).replaceAll('\n','<br>') + '</p>' +
    (record.notes?.length ? '<p>' + e(record.notes.join(' ')) + '</p>' : '') +
    (record.project ? '<p>Proyecto · ' + record.project + ' segmentos</p>' : '') +
    (applied ? '<ul>' + applied + '</ul>' : '') + (record.note ? '<p>' + e(record.note) + '</p>' : '') +
    replies + controls + '<p class="dossier-error" role="alert"></p><footer class="dossier-footer">' +
    (freeArc ? '<button class="hud-btn" data-effect="renew-arc">Renovar uso al cambiar de arco sin asignar</button>' : '') +
    (canRoll ? '<button class="hud-btn hud-btn-primary" data-roll>Preparar tirada vinculada</button>' : '') +
    (editable ? '<button class="hud-btn" data-effect="' + (record.phase === 'roll' ? 'cancel' : 'finish') + '">' + (record.phase === 'roll' ? 'Cancelar resolución' : 'Finalizar') + '</button>' : '') + '</footer></div>');
  const q = selector => modal.querySelector(selector);
  if (q('[data-roll]')) q('[data-roll]').onclick = () => {
    if (window.veilDiceRoller?.prepareCheck({ tokenId: actor.id, ...record.roll, playId: id })) modal.remove();
  };
  const chosen = () => [...modal.querySelectorAll('[name=recipient]:checked')].map(el => el.value);
  const fail = err => { q('[role=alert]').textContent = err.message; };
  if (q('[data-request]')) q('[data-request]').onclick = () => {
    try { requestCardChecks(store,id,chosen(),checks[Number(q('[name=printed_check]').value)]); modal.remove(); openResolution(id); } catch (err) { fail(err); }
  };
  for (const b of modal.querySelectorAll('[data-reply]')) b.onclick = () => {
    const reply = record.replies.find(r => r.id === b.dataset.reply);
    if (window.veilDiceRoller?.prepareCheck({ tokenId: reply.actorId, traitId: reply.traitId, dc: reply.dc, playId: id, replyId: reply.id })) modal.remove();
  };
  if (q('[data-pool]')) q('[data-pool]').onclick = async () => {
    const button = q('[data-pool]'); button.disabled = true;
    try {
      const pool = pools[Number(q('[name=pool]').value)];
      const faces = await throwDice([{ qty: pool.qty, sides: pool.sides, role: record.name }], { label: record.name, actor, secret: row.visibility === 'keeper' });
      const label = pool.label + ' [' + faces.join(', ') + '] = ' + (faces.reduce((a,b) => a+b,0) + pool.flat);
      adjudicateCard(store,id,{ operation: 'apply', kind: 'note', ids: chosen(), note: label });
      modal.remove(); openResolution(id);
    } catch (err) { fail(err); } finally { button.disabled = false; }
  };
  if (q('[data-damage]')) q('[data-damage]').onclick = () => {
    const ids = chosen();
    if (ids.length !== 1) { fail(new Error('Selecciona un objetivo para calcular su daño y escudos.')); return; }
    if (window.veilDiceRoller?.prepareCardDamage(actor.id, ids[0], pools[Number(q('[name=pool]').value)].label, row.visibility === 'keeper')) modal.remove();
  };
  const sync = () => {
    const kind = q('[name=kind]')?.value;
    if (!kind) return;
    q('[name=condition]').closest('label').hidden = !['condition','clear'].includes(kind);
    q('[name=amount]').closest('label').hidden = !['hp','armor','hope','effort','stress','bonus','clock'].includes(kind);
  };
  if (q('[name=kind]')) { q('[name=kind]').onchange = sync; sync(); }
  for (const btn of modal.querySelectorAll('[data-effect]')) btn.onclick = () => {
    const kind = q('[name=kind]')?.value;
    try {
      adjudicateCard(store, id, { operation: btn.dataset.effect, kind,
        ids: [...modal.querySelectorAll('[name=recipient]:checked')].map(el => el.value),
        value: q('[name=amount]')?.closest('label').hidden ? undefined : Number(q('[name=amount]')?.value),
        condition: ['condition','clear'].includes(kind) ? q('[name=condition]').value : '', note: q('[name=note]')?.value });
      modal.remove(); if (btn.dataset.effect === 'apply') openResolution(id); else notify('Resolución guardada.');
    } catch (err) { q('[role=alert]').textContent = err.message; }
  };
  return modal;
}
