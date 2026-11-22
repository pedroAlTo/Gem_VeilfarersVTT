import { store } from './state.js';
import { tableDialog } from './dossierDialog.js';
import { escapeHTML as e } from './ui.js';
import { tokenInventory } from './equipment.js';
import { swarmCandidates, swarmTargets } from './adversaryPassives.js';

export function openSwarmAttack(actorId, firstId) {
  const actor = () => store.state.tokens.find(t => t.id === actorId);
  if (store.sessionRole === 'player' || store.state.userRole !== 'keeper' || !actor()) return;
  const options = swarmCandidates(actor(), store.getActiveMap(), store.state.tokens);
  const modal = tableDialog('Swarm Tactics', '<p>Elige dos objetivos a alcance Close. Cada objetivo resuelve su ataque y su daño por separado.</p><div class="card-targets">' +
    options.map(t => '<label><input type="checkbox" name="swarm_target" value="' + e(t.id) + '"' + (t.id === firstId ? ' checked' : '') + '> ' + e(t.name) + '</label>').join('') +
    '</div><p role="alert" class="dossier-error"></p><footer class="dossier-footer"><button class="hud-btn" data-swarm>Atacar a ambos</button></footer>');
  const btn = modal.querySelector('[data-swarm]');
  btn.onclick = async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const targets = swarmTargets(actor(), store.getActiveMap(), store.state.tokens, [...modal.querySelectorAll(':checked')].map(el => el.value));
      const weapon = tokenInventory(actor()).weapons.find(w => /horde/i.test(w.name)) || tokenInventory(actor()).weapons[0];
      if (!weapon) throw new Error('El enjambre carece de un ataque en su ficha.');
      const dice = window.veilDiceRoller;
      if (!dice?.prepareWeapon(actorId, weapon.id)) throw new Error('No se pudo preparar el ataque.');
      window.veilActionBar?.stopTargeting();
      modal.dataset.busy = 'true';
      const results = [];
      for (const target of targets) {
        const select = dice.container.querySelector('#dmg_target_select');
        select.value = target.id; select.onchange?.();
        const result = await dice.executeAttack({ swarm: true });
        results.push({ name: target.name, result, damage: result?.hit ? dice.lastDamage : null });
      }
      modal.remove();
      const view = tableDialog('Swarm Tactics · resultados', results.map(({ name, result, damage }, i) =>
        '<p><strong>' + e(name) + '</strong> · ' + (result?.hit ? 'Impacto' : 'Fallo') + (result?.total != null ? ' · ' + result.total : '') +
        (damage ? ' · ' + damage.raw + ' daño <button class="hud-btn" data-hit="' + i + '">Resolver daño</button>' : '') + '</p>').join(''));
      for (const b of view.querySelectorAll('[data-hit]')) b.onclick = () => {
        const damage = results[Number(b.dataset.hit)].damage;
        if (!damage.applied) damage.apply();
        b.disabled = damage.applied;
      };
    } catch (err) { modal.querySelector('[role=alert]').textContent = err.message; }
    finally { delete modal.dataset.busy; btn.disabled = false; }
  };
  return modal;
}
