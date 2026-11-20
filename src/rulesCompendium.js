import { sanitizeHTML, escapeHTML } from './ui.js';
import { currentLanguage } from './i18n.js';
// src/rulesCompendium.js
// Sacred Rules Compendium & Mechanics Reference (Release 12.06)

export class RulesCompendiumModal {
  constructor() {
    this.modal = null;
    this.refreshLanguage = () => this.renderEntries();
  }

  open() {
    if (this.modal) return;

    this.modal = document.createElement('div');
    this.modal.className = 'veil-modal-backdrop';
    this.modal.innerHTML = sanitizeHTML(`
      <div class="veil-modal-box" style="max-width: 860px; max-height: 88vh; display: flex; flex-direction: column;">
        <div class="veil-modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--amber-warn); font-size: 16px;">📖</span>
            <h3 style="margin: 0;">SACRED SYSTEM COMPENDIUM // VEILFARERS CANON 12.06</h3>
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <div style="padding: 8px 16px; background: rgba(5, 8, 14, 0.9); border-bottom: 1px solid rgba(0, 243, 255, 0.2); display: flex; gap: 8px;">
          <input type="text" id="compendium_search" class="hud-input" placeholder="Search rules, moves, domains, soak..." style="flex: 1;" />
          <div style="display: flex; gap: 4px;">
            <button class="hud-btn hud-btn-xs comp-tab-btn active" data-cat="all">ALL</button>
            <button class="hud-btn hud-btn-xs comp-tab-btn" data-cat="core">CORE</button>
            <button class="hud-btn hud-btn-xs comp-tab-btn" data-cat="combat">COMBAT & SOAK</button>
            <button class="hud-btn hud-btn-xs comp-tab-btn" data-cat="domains">DOMAINS</button>
            <button class="hud-btn hud-btn-xs comp-tab-btn" data-cat="sleeping">SLEEPING</button>
            <button class="hud-btn hud-btn-xs comp-tab-btn" data-cat="naval">NAVAL</button>
          </div>
        </div>

        <div class="veil-modal-body" id="compendium_body" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
          <!-- Populated by renderEntries -->
        </div>
      </div>
    `);

    document.body.appendChild(this.modal);
    window.addEventListener('veil:language', this.refreshLanguage);

    this.modal.querySelector('.modal-close-btn').onclick = () => this.close();
    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.close();
    };

    const searchInput = this.modal.querySelector('#compendium_search');
    searchInput.oninput = () => this.renderEntries();

    this.modal.querySelectorAll('.comp-tab-btn').forEach(btn => {
      btn.onclick = () => {
        this.modal.querySelectorAll('.comp-tab-btn').forEach(b => b.classList.remove('active', 'hud-btn-primary'));
        btn.classList.add('active', 'hud-btn-primary');
        this.renderEntries();
      };
    });

    this.renderEntries();
  }

  close() {
    if (this.modal) {
      window.removeEventListener('veil:language', this.refreshLanguage);
      this.modal.remove();
      this.modal = null;
    }
  }

  renderEntries() {
    const body = this.modal.querySelector('#compendium_body');
    const query = (this.modal.querySelector('#compendium_search').value || '').toLowerCase().trim();
    const activeCat = this.modal.querySelector('.comp-tab-btn.active')?.dataset.cat || 'all';

    const lang = currentLanguage();
    const filtered = RULES_ENTRIES.filter(entry => {
      const matchCat = activeCat === 'all' || entry.category === activeCat;
      const matchQuery = !query || [...entry.es, ...entry.en, ...entry.tags].some(value => value.toLowerCase().includes(query));
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      body.innerHTML = sanitizeHTML(`<div style="text-align: center; color: var(--text-dim); padding: 30px;">No rules found matching query "${escapeHTML(query)}".</div>`);
      return;
    }

    body.innerHTML = sanitizeHTML(filtered.map(item => `
      <div class="glass-panel" style="padding: 12px 14px; border-left: 3px solid ${item.color || 'var(--cyan-pearl)'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-family: var(--font-hud); font-size: 13px; font-weight: 800; color: #fff;">${item[lang][0]}</span>
          <span class="badge" style="background: rgba(0, 243, 255, 0.1); border-color: ${item.color || 'var(--cyan-pearl)'}; color: ${item.color || 'var(--cyan-pearl)'}; font-size: 9px;">
            ${item.badge}
          </span>
        </div>
        <div style="font-size: 11px; line-height: 1.6; color: rgba(226, 232, 240, 0.9); white-space: pre-line;">
          ${item[lang][1]}
        </div>
      </div>
    `).join(''));
  }
}

const RULES_ENTRIES = [
  {
    category: "core", badge: "§1 · Core", color: "#00f3ff",
    tags: ["duality", "hope", "fear", "dc", "dice", "tirada"],
    es: ["Tirada de Dualidad",
      "Suma los d12 de Hope y Fear, el Trait y los modificadores aplicables. Fija antes de tirar la DC (5, 10, 15, 20, 25 o 30). El total igual o superior es éxito. Con Hope, incluso en un fallo, un Awakened gana 1 Hope y un Sleeping marca 1 segmento de Effort. Con Fear en una tirada de jugador, el Keeper gana 1 Fear, hasta 12, y aplica la consecuencia anunciada o impresa si corresponde."],
    en: ["Duality roll",
      "Add the Hope and Fear d12s, the Trait and applicable modifiers. Set the DC before rolling (5, 10, 15, 20, 25 or 30). Meeting it succeeds. On Hope, even on failure, an Awakened gains 1 Hope or a Sleeping marks 1 Effort segment. On a player roll with Fear, the Keeper gains 1 Fear, up to 12, and applies the declared or printed consequence if eligible."]
  },
  {
    category: "core", badge: "§1–2 · Core", color: "#f59e0b",
    tags: ["critical", "matching", "crit", "crítico"],
    es: ["Crítico con dados iguales",
      "Cualquier pareja, incluso 1+1, tiene éxito. El Awakened limpia 1 Stress y gana 1 Hope (máx. 6). El Sleeping limpia 1 Stress, completa la pista para ganar 1 Effort y suma otro punto a Effort o Resolve. Si Effort está lleno, ese último punto va a Resolve. En ataques críticos el jugador duplica los dados de daño y el Keeper toma el máximo de cada dado. Los bonos fijos se suman una vez."],
    en: ["Critical success on matching dice",
      "Any matching pair, including 1+1, succeeds. An Awakened clears 1 Stress and gains 1 Hope (max 6). A Sleeping clears 1 Stress, completes the track for 1 Effort and adds one more point to Effort or Resolve. If Effort is full, that point goes to Resolve. On a critical attack, a player doubles the damage dice and the Keeper takes the maximum on each die. Add flat bonuses once."]
  },
  {
    category: "core", badge: "§1, §5 · Core", color: "#ec4899",
    tags: ["advantage", "disadvantage", "vulnerable", "overwhelmed"],
    es: ["Ventaja y desventaja",
      "La ventaja suma 1d6 y la desventaja resta 1d6. Si hay ambas se cancelan. Varias fuentes del mismo signo siguen dando un solo dado. Atacar a un objetivo Vulnerable otorga ventaja. Un personaje Overwhelmed tiene desventaja en sus tiradas."],
    en: ["Advantage and disadvantage",
      "Add 1d6 for advantage or subtract 1d6 for disadvantage. If both apply, they cancel. Multiple sources of the same kind still give one die. Attacking a Vulnerable target grants advantage. An Overwhelmed character has disadvantage on rolls."]
  },
  {
    category: "combat", badge: "Ch. 10 · §5", color: "#10b981",
    tags: ["damage", "thresholds", "minor", "major", "severe", "hp", "umbrales", "resistencia", "inmunidad"],
    es: ["Daño y umbrales",
      "La inmunidad anula el daño del tipo o etiqueta y sus condiciones dependientes. La resistencia reduce ese daño a la mitad, redondeando hacia abajo, antes de los umbrales. Un impacto con daño bajo Major marca 1 HP, desde Major marca 2 HP y desde Severe marca 3 HP. Cada 10 puntos completos por encima de Severe añaden 1 HP. Solo se marca Stress si una regla lo indica."],
    en: ["Damage and thresholds",
      "Immunity prevents matching damage and its damage-dependent conditions. Resistance halves matching damage, rounded down, before thresholds. A damaging hit below Major marks 1 HP, from Major it marks 2 HP and from Severe it marks 3 HP. Each full 10 above Severe adds 1 HP. Mark Stress only for an explicit rule."]
  },
  {
    category: "combat", badge: "Ch. 10 · §5", color: "#38bdf8",
    tags: ["armor", "armour", "slots", "soak", "escudos", "armadura"],
    es: ["Armor Slots",
      "Cada Armor Slot gastado reduce un escalón de gravedad. Por ejemplo, un impacto de 2 HP baja a 1 HP. Un daño directo solo ignora los umbrales y la armadura cuando así lo indica la regla. Recupera slots con el movimiento de reparación correspondiente durante un descanso."],
    en: ["Armor Slots",
      "Each Armor Slot spent lowers the severity by one step. For example, a 2 HP hit becomes a 1 HP hit. Direct damage bypasses thresholds and armor when its rule specifies it. Restore slots with the appropriate repair move during a rest."]
  },
  {
    category: "combat", badge: "Ch. 9 · §2", color: "#ef4444",
    tags: ["stress", "overwhelmed", "abrumado"],
    es: ["Stress y Overwhelmed",
      "El máximo habitual es 6 Stress, o 7 para los Synthetics. Al llenarlo, el personaje queda Overwhelmed, tiene desventaja en todas sus tiradas y no puede pagar ni marcar más Stress. Limpiar al menos 1 Stress termina ese estado."],
    en: ["Stress and Overwhelmed",
      "The usual maximum is 6 Stress, or 7 for Synthetics. At maximum, the character becomes Overwhelmed, has disadvantage on all rolls and cannot pay or mark more Stress. Clearing at least 1 Stress ends this state."]
  },
  {
    category: "combat", badge: "Ch. 10 · §5", color: "#ef4444",
    tags: ["dying", "final", "estabilizar", "stabilize", "death", "blaze", "long", "bruise"],
    es: ["A 0 HP · Dying, Final y estabilización",
      "Al llegar a 0 HP el personaje queda Dying y deja de actuar. Al inicio de su Spotlight tira 1d12. Con 8+ marca un progreso. La segunda marca lleva a Final, donde se repite el procedimiento hasta la muerte. Un aliado adyacente puede estabilizar con Knowledge o Finesse, DC 15 en Dying o 20 en Final. Esto borra el progreso y deja al personaje a 0 HP. Al volver, el valor habitual es 1 HP y 1 Stress como Long Bruise. Solo el jugador puede elegir Blaze of Glory en lugar de la tirada."],
    en: ["At 0 HP · Dying, Final and stabilization",
      "At 0 HP a character is Dying and cannot act. At the start of their Spotlight roll 1d12. An 8+ marks one progress. The second mark leads to Final, where the same procedure ends in death. An adjacent ally can stabilize with Knowledge or Finesse, DC 15 in Dying or 20 in Final. This clears progress and leaves the character at 0 HP. The default return is at 1 HP with 1 Stress as Long Bruise. Only the player can choose Blaze of Glory in place of the roll."]
  },
  {
    category: "domains", badge: "Ch. 19", color: "#a855f7",
    tags: ["domains", "powers", "awakened", "dominios", "poderes"],
    es: ["Los siete dominios",
      "Tech, Synthesis, Social, Neural, Kinetic, Void y Lux. Cada Power usa su propio coste, alcance, objetivo, efecto y duración. Consulta su carta para resolverlo."],
    en: ["The seven Domains",
      "Tech, Synthesis, Social, Neural, Kinetic, Void and Lux. Each Power specifies its cost, range, target, effect and duration. Consult its card when resolving it."]
  },
  {
    category: "sleeping", badge: "Ch. 7, 9 · §2–3", color: "#f59e0b",
    tags: ["sleeping", "effort", "resolve", "honed", "edge", "recovery", "anchor", "ancla", "descanso"],
    es: ["Sleeping · Effort, Resolve y Recovery Anchor",
      "La pista de Effort tiene 2 segmentos. Al llenarla gana 1 Effort (máx. 6) y vacía la pista. Bear Down permite gastar Resolve tras la tirada para mejorar el total. Honed Edge añade nivel − 1 al daño una vez. El Recovery Anchor permite elegir Clear Stress (1d4 + Tier) en descanso corto o Decompress (todo el Stress) en descanso largo. Los descansos y el Anchor no generan Effort."],
    en: ["Sleeping · Effort, Resolve and Recovery Anchor",
      "The Effort track has 2 segments. Filling it grants 1 Effort (max 6) and resets the track. Bear Down lets you spend Resolve after rolling to improve the total. Honed Edge adds level − 1 to damage once. Your Recovery Anchor lets you choose Clear Stress (1d4 + Tier) on a short rest or Decompress (all Stress) on a long rest. Rest and the Anchor grant no Effort."]
  },
  {
    category: "naval", badge: "Ch. 17 · §7", color: "#06b6d4",
    tags: ["naval", "starship", "heat", "pearls", "salto", "jump", "ftl", "nave"],
    es: ["Naves · escudos, Heat y salto FTL",
      "El arco alcanzado absorbe el daño punto por punto antes del Hull y recupera 2 Armor Slots al final de la ronda, hasta su máximo. Si el Heat supera el límite se aplica el sobrecalentamiento. Para saltar, declara el destino y calcula con Knowledge, DC 10 o 15 bajo fuego. Fallar con Fear marca 1 Heat. Con una solución lista, el piloto usa otro Spotlight y tira Instinct, DC 10. El éxito gasta 1 Pearl e inicia el tránsito. Fallar con Fear resta 1 Integrity al Primary Drive."],
    en: ["Starships · shields, Heat and FTL",
      "The facing arc absorbs damage point for point before Hull and regains 2 Armor Slots at round end, up to its maximum. Exceeding the Heat cap triggers overheating. To jump, declare the destination and calculate with Knowledge, DC 10 or 15 under fire. Failure with Fear adds 1 Heat. With a ready solution the Pilot uses a separate Spotlight to roll Instinct, DC 10. Success spends 1 Pearl and enters transit. Failure with Fear costs the Primary Drive 1 Integrity."]
  },
];
