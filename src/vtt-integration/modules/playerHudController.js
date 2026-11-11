import { getDatabase, ref, onValue, update } from "firebase/database";

export class PlayerHudController {
  constructor(charId, roomId, diceSync) {
    try {
      this.db = getDatabase();
    } catch {
      this.db = null;
    }
    this.charId = charId;
    this.roomId = roomId;
    this.diceSync = diceSync;
    this.charData = null;

    this.initDrawerToggle();
    this.subscribeToCharacter();
  }

  initDrawerToggle() {
    const hud = document.getElementById('vf-player-hud');
    const toggleBtn = document.getElementById('hud-toggle-btn');
    if (hud && toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        hud.classList.toggle('collapsed');
      });
    }
  }

  subscribeToCharacter() {
    if (!this.db || !this.charId) return;
    const charRef = ref(this.db, `character_vault/${this.charId}`);

    onValue(charRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      this.charData = data;
      this.renderIdentity(data.staticData);
      this.renderResources(data.staticData, data.dynamicState);
      this.renderArmour(data.staticData, data.dynamicState);
      this.renderAttributes(data.staticData);
    });
  }

  renderIdentity(staticData = {}) {
    const nameEl = document.getElementById('sheet-char-name');
    const subEl = document.getElementById('sheet-char-subtitle');
    const avatarEl = document.getElementById('sheet-char-avatar');

    if (nameEl) nameEl.textContent = staticData.name || 'Viajero';
    if (subEl) subEl.textContent = `${staticData.species || 'Especie'} • ${staticData.background || 'Explorador'}`;
    if (avatarEl && staticData.avatarUrl) avatarEl.src = staticData.avatarUrl;
  }

  renderResources(staticData = {}, dynamicState = {}) {
    const maxHp = Number(staticData.maxHp) || 6;
    const currentHp = Number(dynamicState.hp) || 0;

    const maxStress = Number(staticData.maxStress) || 6;
    const currentStress = Number(dynamicState.stress) || 0;

    const maxHope = Number(staticData.maxHope) || 6;
    const currentHope = Number(dynamicState.hope) ?? 2;

    document.getElementById('label-hp-count').textContent = `${currentHp} / ${maxHp}`;
    document.getElementById('label-stress-count').textContent = `${currentStress} / ${maxStress}`;
    document.getElementById('label-hope-count').textContent = `${currentHope} / ${maxHope}`;

    document.getElementById('quick-hp').textContent = `${currentHp}/${maxHp}`;
    document.getElementById('quick-stress').textContent = `${currentStress}/${maxStress}`;
    document.getElementById('quick-hope').textContent = currentHope;

    this.buildPips('pips-hp', currentHp, maxHp, 'hp');
    this.buildPips('pips-stress', currentStress, maxStress, 'stress');
    this.buildPips('pips-hope', currentHope, maxHope, 'hope');
  }

  renderArmour(staticData = {}, dynamicState = {}) {
    const armour = staticData.armour || {};
    // Shields (A.S.): cantidad de escudos para absorber daño
    const maxAS = Number(armour.shieldsAS) || 3;
    const usedAS = Number(dynamicState.armourShieldsUsed) || 0;
    const availableAS = Math.max(0, maxAS - usedAS);

    // Slots: capacidad de mejora de la armadura
    const maxSlots = Number(armour.slots) || 2;
    const installedUpgrades = armour.installedUpgrades || [];

    const nameEl = document.getElementById('sheet-armour-name');
    if (nameEl) nameEl.textContent = armour.name || 'Traje de Vacío';

    document.getElementById('label-as-count').textContent = `${usedAS} / ${maxAS} marcados`;
    document.getElementById('quick-as').textContent = availableAS;

    this.buildPips('pips-as', usedAS, maxAS, 'armourShieldsUsed');

    document.getElementById('label-slots-count').textContent = `${installedUpgrades.length} / ${maxSlots} Ocupados`;
    const slotsContainer = document.getElementById('armour-slots-list');
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';

    for (let i = 0; i < maxSlots; i++) {
      const upgrade = installedUpgrades[i];
      const slotEl = document.createElement('div');
      slotEl.className = `armour-slot-item ${upgrade ? 'installed' : 'empty'}`;
      slotEl.innerHTML = upgrade
        ? `<span>⚙️ <strong>${upgrade.name}</strong></span><span>${upgrade.effect || ''}</span>`
        : `<span>⬜ Slot de mejora libre</span><span>Disponible</span>`;
      slotsContainer.appendChild(slotEl);
    }
  }

  buildPips(containerId, currentValue, maxValue, statKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= maxValue; i++) {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.className = `pip ${i <= currentValue ? 'filled' : ''}`;
      pip.title = `Fijar ${statKey} en ${i === currentValue ? i - 1 : i}`;

      pip.addEventListener('click', () => {
        const newValue = (i === currentValue) ? i - 1 : i;
        this.updateDynamicStat(statKey, newValue);
      });

      container.appendChild(pip);
    }
  }

  async updateDynamicStat(statKey, newValue) {
    if (!this.db) return;
    const updates = {};
    updates[`character_vault/${this.charId}/dynamicState/${statKey}`] = newValue;

    if (this.roomId) {
      updates[`rooms/${this.roomId}/characterSnapshots/${this.charId}/${statKey}`] = newValue;
    }

    await update(ref(this.db), updates);
  }

  renderAttributes(staticData = {}) {
    const grid = document.getElementById('sheet-attributes-grid');
    if (!grid || grid.children.length > 0) return;

    const attributes = staticData.attributes || {
      Agility: 1, Strength: 0, Finesse: 2, Instinct: 1, Presence: 0, Knowledge: -1
    };

    Object.entries(attributes).forEach(([attrName, modVal]) => {
      const mod = Number(modVal) || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'attr-roll-btn';
      btn.innerHTML = `
        <span class="attr-name">${attrName}</span>
        <span class="attr-mod">${mod >= 0 ? '+' + mod : mod}</span>
      `;

      btn.addEventListener('click', () => {
        this.diceSync.rollDuality({
          label: `Tirada de ${attrName}`,
          modifier: mod,
          charId: this.charId
        });
      });

      grid.appendChild(btn);
    });
  }
}