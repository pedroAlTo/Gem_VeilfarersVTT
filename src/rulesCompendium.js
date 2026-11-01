// src/rulesCompendium.js
// Sacred Rules Compendium & Mechanics Reference (Release 12.06)

export class RulesCompendiumModal {
  constructor() {
    this.modal = null;
  }

  open() {
    if (this.modal) return;

    this.modal = document.createElement('div');
    this.modal.className = 'veil-modal-backdrop';
    this.modal.innerHTML = `
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
    `;

    document.body.appendChild(this.modal);

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
      this.modal.remove();
      this.modal = null;
    }
  }

  renderEntries() {
    const body = this.modal.querySelector('#compendium_body');
    const query = (this.modal.querySelector('#compendium_search').value || '').toLowerCase().trim();
    const activeCat = this.modal.querySelector('.comp-tab-btn.active')?.dataset.cat || 'all';

    const filtered = RULES_ENTRIES.filter(entry => {
      const matchCat = activeCat === 'all' || entry.category === activeCat;
      const matchQuery = !query || entry.title.toLowerCase().includes(query) || entry.text.toLowerCase().includes(query) || entry.tags.some(t => t.toLowerCase().includes(query));
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      body.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 30px;">No rules found matching query "${query}".</div>`;
      return;
    }

    body.innerHTML = filtered.map(item => `
      <div class="glass-panel" style="padding: 12px 14px; border-left: 3px solid ${item.color || 'var(--cyan-pearl)'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-family: var(--font-hud); font-size: 13px; font-weight: 800; color: #fff;">${item.title}</span>
          <span class="badge" style="background: rgba(0, 243, 255, 0.1); border-color: ${item.color || 'var(--cyan-pearl)'}; color: ${item.color || 'var(--cyan-pearl)'}; font-size: 9px;">
            ${item.badge}
          </span>
        </div>
        <div style="font-size: 11px; line-height: 1.6; color: rgba(226, 232, 240, 0.9); white-space: pre-line;">
          ${item.text}
        </div>
      </div>
    `).join('');
  }
}

const RULES_ENTRIES = [
  {
    category: 'core',
    badge: 'CH. 2 CORE',
    color: '#00f3ff',
    title: 'The Duality Roll (1d12 Hope + 1d12 Fear)',
    text: `Roll two 12-sided dice simultaneously: one Gold Hope die and one Purple Fear die.\n• Total = Hope Die + Fear Die + Trait Modifier + Subtrait + Advantage/Disadvantage.\n• Target = Difficulty Class (DC) set by Keeper (Routine 5, Easy 10, Challenging 15, Difficult 20, Extreme 25, Impossible 30).\n• Hope Dominant (Hope > Fear): Success brings clean victory or a spark of inspiration (+1 Hope for Awakened, +1 Effort segment for Sleeping).\n• Fear Dominant (Fear > Hope): Success brings unintended fallout, complications, or escalation. Keeper gains Fear points or makes a soft move.`,
    tags: ['duality', 'hope', 'fear', 'dice', 'roll']
  },
  {
    category: 'core',
    badge: 'CH. 2 CORE',
    color: '#f59e0b',
    title: 'Critical Success on Matching Faces (Even 1+1!)',
    text: `Whenever both d12 dice land on matching numbers (e.g. 1 & 1, 6 & 6, 12 & 12), the roll is a CRITICAL SUCCESS regardless of the DC.\n• Automatic success on the action.\n• Attacks deal DOUBLE normal weapon damage dice.\n• Path Payout:\n  - Awakened: Clears 1 Stress and gains +1 Hope (capped at 6).\n  - Sleeping: Clears 1 Stress, marks 2 Effort track segments, and gains +1 point in Effort or Resolve.`,
    tags: ['critical', 'matching', 'crit', 'success']
  },
  {
    category: 'core',
    badge: 'CH. 2 CORE',
    color: '#ec4899',
    title: 'Advantage & Disadvantage (+/- 1d6)',
    text: `• Advantage: Roll +1d6 (Advantage Die) and ADD it directly to the Duality total.\n• Disadvantage: Roll 1d6 and SUBTRACT it directly from the Duality total.\n• Advantage and Disadvantage cancel each other out one-for-one. Multiple sources do not stack beyond single Advantage or Disadvantage.`,
    tags: ['advantage', 'disadvantage', 'boon', 'bane']
  },
  {
    category: 'combat',
    badge: 'CH. 6 DEFENSES',
    color: '#10b981',
    title: 'Damage Thresholds & Wound Severity (Minor / Major / Severe)',
    text: `Damage in Veilfarers is measured against three thresholds:\n• Minor Hit (< Major Threshold): Deals 1 HP loss. Quick flesh wound or surface scorch.\n• Major Hit (>= Major Threshold): Deals 2 HP loss and 1 Stress mark.\n• Severe Hit (>= Severe Threshold): Deals 3 HP loss and 2 Stress marks.\n• Massive / Overkill: An attack dealing double the Severe threshold instantly forces Death Saves or destroys structural components.`,
    tags: ['damage', 'thresholds', 'minor', 'major', 'severe', 'hp']
  },
  {
    category: 'combat',
    badge: 'CH. 6 DEFENSES',
    color: '#38bdf8',
    title: 'Armor Slots & Damage Soak',
    text: `Armor does not merely add an AC bonus. Instead, you possess a set number of Armor Slots (Pips).\n• Reaction Soak: When hit by an attack, spend 1 Armor Slot to reduce the incoming damage severity by ONE TIER:\n  - Severe becomes Major (-1 HP, -1 Stress).\n  - Major becomes Minor (-1 HP, -1 Stress).\n• Armor slots remain spent until repaired or restored during a Short Rest (Field Repair) or Long Rest in port.`,
    tags: ['armor', 'slots', 'soak', 'defense']
  },
  {
    category: 'combat',
    badge: 'CH. 6 STRESS',
    color: '#ef4444',
    title: 'Stress & Becoming Overwhelmed',
    text: `Stress represents psychological panic, cognitive strain, and neural overload (Cap: 6, or 7 for Synthetics).\n• Marking Stress: Induced by Major/Severe wounds, horrific Veil anomalies, or paying costs for powerful abilities.\n• Overwhelmed (Current Stress >= Max): When stress maxes out, you become Overwhelmed. You suffer Disadvantage on all checks until you clear at least 1 Stress. Further stress converts directly to severe wounds!`,
    tags: ['stress', 'overwhelmed', 'panic']
  },
  {
    category: 'domains',
    badge: 'CH. 10 POWERS',
    color: '#a855f7',
    title: 'The Seven Sacred Domains (Awakened Powers)',
    text: `Awakened characters draw supernatural mastery from 7 resonant Domains:\n1. Void: Gravity, dimensional folding, phasing, cosmic cold.\n2. Kinetic: Force projection, kinetic redirection, concussive slams.\n3. Neural: Telepathy, sensory distortion, psychic daze, memory probes.\n4. Synthesis: Cellular regeneration, flesh crafting, biochemical venom.\n5. Tech: Machine empathy, electronic spoofing, remote drone overrides.\n6. Lux: Radiant lasers, solar shields, blinding flash, photon constructs.\n7. Social: Infiltration, silver-tongued suggestion, commanding presence.`,
    tags: ['domains', 'powers', 'awakened', 'magic']
  },
  {
    category: 'sleeping',
    badge: 'CH. 8 SLEEPING',
    color: '#f59e0b',
    title: 'Sleeping Path: Effort, Resolve Pool & Honed Edge',
    text: `Sleeping characters rely on peak mortal training, cybernetics, and tactical discipline instead of space-magic:\n• Effort Track (3 segments): Whenever you mark 3 segments, the track clears and awards +1 usable Effort point (max 6).\n• Resolve Dice Pool (d4s): A pool of bonus d4s rolled on crucial checks (Bear Down: spend 1 Resolve to add +1d4 to any check).\n• Recovery Anchor: An artifact, photograph, or memory of home that restores 2 Effort during a breather.\n• Honed Edge: Passive bonuses equal to character level - 1 on practiced mastery feats.`,
    tags: ['sleeping', 'effort', 'resolve', 'honed edge']
  },
  {
    category: 'naval',
    badge: 'CH. 17 NAVAL',
    color: '#06b6d4',
    title: 'Naval Combat: Range Bands, Shield Arcs & Thermal Core',
    text: `Starship warfare takes place across 5 Range Bands:\n• Adjacent -> Engagement -> Standard -> Long -> Extreme.\n• Shield Arcs: 4 independent arcs (Fore, Aft, Port, Starboard). Attacks hit the facing arc. Spending slots soaks Hull damage.\n• Thermal Core Heat (0-10): Firing weapons, overclocking systems, and reinforcing shields generates Heat. If Heat reaches 10, the ship suffers core meltdown or system shutdown.\n• Quantum Pearls: Rare space-time crystals required to execute emergency FTL jumps. Jumping without a Pearl is catastrophic.`,
    tags: ['naval', 'starship', 'combat', 'heat', 'pearls']
  }
];

