// Level-up dialog: collects the choices of Corebook ch. 12 and applies them to the sheet.
import { escapeHTML as e, notify } from './ui.js';
import { store } from './state.js';
import { validateActor } from './validation.js';
import { TRAIT_IDS } from './characterImport.js';
import { dossierDialog } from './dossierUI.js';
import { ADVANCEMENT_OPTIONS, MAX_LEVEL, applyLevelUp, availablePowers, experienceSlots, isTierAchievement, levelGrants, multiclassChoices, nextSubclassFeature, optionBlocked, tierOf } from './advancement.js';

export function canLevelUp(token) {
  const pc = token.actorType === 'player' || (!token.actorType && token.isPlayer);
  return pc && (token.level || 1) < MAX_LEVEL && store.sessionRole !== 'player' && store.state.userRole === 'keeper';
}

// The rules data (Powers, Classes, Subclasses) is the creator's; it loads on demand.
export async function openLevelUp(tokenId, onDone = () => {}) {
  const token = store.state.tokens.find(t => t.id === tokenId);
  if (!token) return null;
  let data = null;
  try { data = (await import('./creator/creatorData.js')).CREATOR_DATA; } catch (error) { console.warn('Level-up rules data unavailable; choices fall back to notes.', error); }
  const short = (text, max = 260) => { const t = String(text ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max).trim() + '…' : t; };
  // Raise two Experiences, or add a new one at +2 and raise one.
  const experiencePicker = (prefix, label) => `<div class="dossier-identity"><label class="dossier-field"><span>${label} · Experiencia que sube +1</span><select class="hud-input" name="${prefix}_0">${expOptions(0)}</select></label><label class="dossier-field"><span>Segunda Experiencia +1</span><select class="hud-input" name="${prefix}_1"><option value="">— Ninguna: añado una nueva —</option>${expOptions(Math.min(1, experiences.length - 1))}</select></label><label class="dossier-field"><span>…o Experiencia nueva a +2</span><input class="hud-input" name="${prefix}_new" maxlength="120" placeholder="Solo si no subes una segunda"></label></div>`;
  const level = token.level || 1, next = level + 1, sleeping = token.path === 'Sleeping';
  const experiences = experienceSlots(token), achievement = isTierAchievement(next);
  const expOptions = selected => experiences.map((x, i) => `<option value="${e(x.key)}" ${i === selected ? 'selected' : ''}>${e(x.name)} (+${x.bonus})</option>`).join('');
  const slotOptions = single => ADVANCEMENT_OPTIONS.filter(o => !single || o.slots === 1).map(o => {
    const why = optionBlocked(token, o.id, next);
    return `<option value="${o.id}" ${why ? 'disabled' : ''} title="${e(why)}">${e(o.label)}${o.slots === 2 ? ' · 2 Slots' : ''}${why ? ' — no disponible' : ''}</option>`;
  }).join('');
  const modal = dossierDialog(`SUBIR DE NIVEL · ${token.name}`, `
    <form id="level_up_form">
      <div class="dossier-hero"><div class="dossier-seal"><span>LVL</span><strong>${level} → ${next}</strong></div><div><span class="dossier-eyebrow">TIER ${tierOf(next)} · COREBOOK CAP. 12</span><h2>${e(token.name)}</h2><p>Cada nivel da dos Advancement Slots. Los que no se gasten se pierden.</p></div></div>
      <h4 class="dossier-label">LO QUE DA EL NIVEL</h4>
      <ul class="level-grants">${levelGrants(token).map(g => `<li>${e(g)}</li>`).join('')}</ul>
      ${achievement && experiences.length ? experiencePicker('ach_exp', 'Logro de Tier') : ''}
      <h4 class="dossier-label">ADVANCEMENT SLOTS</h4>
      ${[0, 1].map(i => `<section class="level-slot" data-slot="${i}">
        <label class="dossier-field"><span>Slot ${i + 1}</span><select class="hud-input" name="slot_${i}"><option value="">— Sin gastar (se pierde) —</option>${slotOptions(i === 1)}</select></label>
        <div class="level-slot-detail" data-detail="${i}"></div>
      </section>`).join('')}
      <p class="dossier-error" role="alert"></p>
      <footer class="dossier-footer"><button type="button" class="hud-btn" id="level_cancel">Cancelar</button><button class="hud-btn hud-btn-primary" type="submit">Subir a nivel ${next}</button></footer>
    </form>`, 'level-up-dialog');
  const form = modal.querySelector('form'), error = modal.querySelector('.dossier-error');
  const detail = (i, id) => {
    if (id === 'trait') {
      const raised = token.advancement?.traitRaises?.[tierOf(next)] || [];
      return `<label class="dossier-field"><span>Trait que sube</span><select class="hud-input" name="trait_${i}">${TRAIT_IDS.map(t => `<option value="${t}" ${raised.includes(t) ? 'disabled' : ''}>${t} (${token.traits?.[t] ?? 0})${raised.includes(t) ? ' — ya subió en este Tier' : ''}</option>`).join('')}</select></label>`;
    }
    if (id === 'experiences') return experiencePicker(`exp_${i}`, 'Slot');
    if (id === 'power' && !sleeping && data) {
      const powers = availablePowers(token, data, next);
      if (!powers.length) return '<p class="dossier-muted">No quedan Poderes disponibles de tus Dominios a este nivel.</p>';
      return `<label class="dossier-field"><span>Poder que entra en el Vault</span><select class="hud-input" name="power_${i}">${powers.map(p => `<option value="${e(`${p.d}::${p.n}`)}">${e(`${p.d} · L${p.l} · ${p.n}`)}${p.cost ? ` · ${e(p.cost)}` : ''}</option>`).join('')}</select></label><p class="dossier-muted" data-power-text="${i}">${e(short(powers[0].txt))}</p>`;
    }
    if (id === 'multiclass' && data) {
      const choices = multiclassChoices(token, data);
      return `<div class="dossier-identity"><label class="dossier-field"><span>Segunda Clase</span><select class="hud-input" name="mc_class_${i}">${choices.map(c => `<option value="${e(c.id)}">${e(c.name)}</option>`).join('')}</select></label><label class="dossier-field"><span>Dominio nuevo${sleeping ? ' (latente)' : ''}</span><select class="hud-input" name="mc_domain_${i}">${(choices[0]?.domains || []).map(d => `<option>${e(d)}</option>`).join('')}</select></label></div><label class="dossier-field"><span data-mc-question="${i}">${e(choices[0]?.question || 'Pregunta de trasfondo')}</span><textarea class="hud-input" name="mc_answer_${i}" rows="2" maxlength="1000"></textarea></label>`;
    }
    if (id === 'subclass' && data) {
      const upgrade = nextSubclassFeature(token, data);
      return upgrade.feature ? `<p class="dossier-muted"><strong>${e(token.subclass || '')} · ${upgrade.rank} — ${e(upgrade.feature.name)}.</strong> ${e(short(upgrade.feature.desc || upgrade.feature.text, 420))}</p>` : `<label class="dossier-field"><span>Rasgo de ${upgrade.rank} obtenido</span><input class="hud-input" name="note_${i}" maxlength="200"></label>`;
    }
    if (id === 'power' && sleeping) return `<label class="dossier-field"><span>Elige</span><select class="hud-input" name="resolve_${i}"><option value="max" ${(token.resolve?.max ?? 2) >= 6 ? 'disabled' : ''}>+1 Resolve máximo</option><option value="move" ${(token.resolve?.max ?? 2) >= 6 ? 'selected' : ''}>Nuevo Class Resolve Move</option></select></label><label class="dossier-field"><span>Move aprendido (si eliges Move)</span><input class="hud-input" name="note_${i}" maxlength="200"></label>`;
    if (['power', 'multiclass', 'subclass'].includes(id)) return `<label class="dossier-field"><span>${id === 'power' ? 'Poder que entra en el Vault' : id === 'multiclass' ? 'Clase secundaria' : 'Rasgo de Subclass obtenido'}</span><input class="hud-input" name="note_${i}" maxlength="200"></label>`;
    return '';
  };
  const sync = () => {
    const first = form.elements.slot_0.value, second = form.elements.slot_1;
    const whole = ADVANCEMENT_OPTIONS.find(o => o.id === first)?.slots === 2;
    if (whole) second.value = '';
    second.disabled = whole;
    for (const i of [0, 1]) {
      const id = form.elements[`slot_${i}`].value, box = modal.querySelector(`[data-detail="${i}"]`);
      if (box.dataset.for !== id) { box.innerHTML = detail(i, id); box.dataset.for = id; }
    }
    error.textContent = '';
  };
  form.elements.slot_0.onchange = sync; form.elements.slot_1.onchange = sync; sync();
  // Dependent pickers: the Power text, and the Domains and question of the chosen second Class.
  form.addEventListener('change', event => {
    const name = event.target.name || '', i = name.slice(-1);
    if (name.startsWith('power_')) { const [d, n] = event.target.value.split('::'), power = data?.powers.find(p => p.d === d && p.n === n); const box = modal.querySelector(`[data-power-text="${i}"]`); if (box) box.textContent = short(power?.txt); }
    if (name.startsWith('mc_class_')) {
      const choice = multiclassChoices(token, data).find(c => c.id === event.target.value);
      form.elements[`mc_domain_${i}`].innerHTML = (choice?.domains || []).map(d => `<option>${e(d)}</option>`).join('');
      modal.querySelector(`[data-mc-question="${i}"]`).textContent = choice?.question || 'Pregunta de trasfondo';
    }
  });
  modal.querySelector('#level_cancel').onclick = () => modal.remove();
  form.onsubmit = event => {
    event.preventDefault();
    try {
      const values = Object.fromEntries(new FormData(form));
      const picks = [0, 1].map(i => ({ i, id: values[`slot_${i}`] })).filter(p => p.id).map(({ i, id }) => ({
        id, trait: values[`trait_${i}`], experiences: [values[`exp_${i}_0`], values[`exp_${i}_1`]].filter(Boolean), newExperience: values[`exp_${i}_1`] ? '' : values[`exp_${i}_new`],
        resolve: values[`resolve_${i}`], note: values[`note_${i}`], powerId: values[`power_${i}`], classId: values[`mc_class_${i}`], domain: values[`mc_domain_${i}`], answer: values[`mc_answer_${i}`],
      }));
      const spent = picks.reduce((n, p) => n + ADVANCEMENT_OPTIONS.find(o => o.id === p.id).slots, 0);
      // Leaving a Slot unspent is allowed, but only on a second, explicit press.
      if (spent < 2 && form.dataset.confirmUnspent !== String(spent)) {
        form.dataset.confirmUnspent = String(spent);
        error.textContent = `Queda${2 - spent > 1 ? 'n' : ''} ${2 - spent} Advancement Slot sin gastar y se perderá${2 - spent > 1 ? 'n' : ''}. Pulsa de nuevo para subir de nivel así.`;
        return;
      }
      const current = store.state.tokens.find(t => t.id === tokenId);
      if (!current) throw new Error('Este personaje ya no existe.');
      const result = applyLevelUp(current, { data, picks, achievementExperiences: [values.ach_exp_0, values.ach_exp_1].filter(Boolean), achievementNewExperience: values.ach_exp_1 ? '' : values.ach_exp_new, allowUnspent: spent < 2 });
      store.updateToken(tokenId, validateActor(result.token));
      store.addLog({ type: 'SYSTEM', sender: 'Keeper', title: `${current.name} sube a nivel ${result.token.level}`, details: result.summary.join(' · ') });
      notify(`${current.name} sube a nivel ${result.token.level}.`);
      modal.remove(); onDone(result);
    } catch (err) { error.textContent = err.message; }
  };
  return modal;
}
