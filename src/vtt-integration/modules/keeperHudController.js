import { getDatabase, ref, onValue, runTransaction, push, serverTimestamp } from "firebase/database";

export class KeeperHudController {
  constructor(roomId, currentUser, diceSync) {
    try {
      this.db = getDatabase();
    } catch {
      this.db = null;
    }
    this.roomId = roomId;
    this.currentUser = currentUser;
    this.diceSync = diceSync;
    this.maxFear = 12;

    this.partySubscriptions = new Map();

    this.initWindowControls();
    this.initFearControls();
    this.initKeeperDiceRoller();
    this.subscribeToFearPool();
    this.subscribeToRoomParty();
  }

  initWindowControls() {
    const hudEl = document.getElementById('vf-keeper-hud');
    const toggleBtn = document.getElementById('btn-toggle-keeper-hud');
    const minBtn = document.getElementById('btn-minimize-keeper-hud');
    const dragHandle = document.getElementById('vf-keeper-drag-handle');

    if (toggleBtn && hudEl) {
      toggleBtn.onclick = () => {
        hudEl.classList.toggle('is-minimized');
      };
    }
    if (minBtn && hudEl) {
      minBtn.onclick = () => {
        hudEl.classList.add('is-minimized');
      };
    }

    if (dragHandle && hudEl) {
      let isDragging = false;
      let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

      dragHandle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = hudEl.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        hudEl.style.transition = 'none';
        dragHandle.setPointerCapture(e.pointerId);
      });

      dragHandle.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - hudEl.offsetWidth - 10, initialLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - hudEl.offsetHeight - 10, initialTop + dy));
        hudEl.style.left = `${newLeft}px`;
        hudEl.style.top = `${newTop}px`;
        hudEl.style.right = 'auto';
        hudEl.style.transform = 'none';
      });

      const stopDrag = (e) => {
        if (isDragging) {
          isDragging = false;
          hudEl.style.transition = '';
          try { dragHandle.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };
      dragHandle.addEventListener('pointerup', stopDrag);
      dragHandle.addEventListener('pointercancel', stopDrag);
    }
  }

  subscribeToFearPool() {
    if (!this.db) return;
    const fearRef = ref(this.db, `rooms/${this.roomId}/combatTracker/fearPool`);
    onValue(fearRef, (snapshot) => {
      const currentFear = Number(snapshot.val()) || 0;
      this.renderFearPool(currentFear);
    });
  }

  renderFearPool(currentFear) {
    const countEl = document.getElementById('keeper-fear-count');
    const pipsContainer = document.getElementById('keeper-fear-pips');
    const sharedBannerCount = document.getElementById('shared-fear-counter-val');

    if (countEl) {
      countEl.textContent = currentFear;
      countEl.classList.remove('fear-pulse');
      void countEl.offsetWidth;
      countEl.classList.add('fear-pulse');
    }

    if (sharedBannerCount) {
      sharedBannerCount.textContent = currentFear;
    }

    const minFearEl = document.getElementById('keeper-min-fear-val');
    if (minFearEl) {
      minFearEl.textContent = currentFear;
    }

    if (!pipsContainer) return;
    pipsContainer.innerHTML = '';

    for (let i = 1; i <= this.maxFear; i++) {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.className = `fear-pip ${i <= currentFear ? 'active' : ''}`;
      pip.title = `Fijar Fear en ${i === currentFear ? i - 1 : i}`;
      pip.addEventListener('click', () => {
        const targetVal = (i === currentFear) ? i - 1 : i;
        this.setFearValue(targetVal);
      });
      pipsContainer.appendChild(pip);
    }
  }

  initFearControls() {
    const btnSpend = document.getElementById('btn-fear-spend');
    const btnGain = document.getElementById('btn-fear-gain');

    if (btnSpend) btnSpend.addEventListener('click', () => this.adjustFear(-1));
    if (btnGain) btnGain.addEventListener('click', () => this.adjustFear(1));
  }

  async adjustFear(delta) {
    if (!this.db) return;
    const fearRef = ref(this.db, `rooms/${this.roomId}/combatTracker/fearPool`);
    await runTransaction(fearRef, (current) => {
      const val = Number(current) || 0;
      return Math.max(0, Math.min(this.maxFear, val + delta));
    });
  }

  async setFearValue(targetVal) {
    if (!this.db) return;
    const fearRef = ref(this.db, `rooms/${this.roomId}/combatTracker/fearPool`);
    await runTransaction(fearRef, () => Math.max(0, Math.min(this.maxFear, targetVal)));
  }

  subscribeToRoomParty() {
    if (!this.db) return;
    const roomRef = ref(this.db, `rooms/${this.roomId}`);

    onValue(roomRef, (snapshot) => {
      const roomData = snapshot.val() || {};
      const detectedCharIds = new Set();

      if (roomData.activeCharacters) {
        Object.values(roomData.activeCharacters).forEach((charId) => {
          if (charId) detectedCharIds.add(charId);
        });
      }

      const tokens = roomData.mapState?.tokens || roomData.tokens || {};
      Object.values(tokens).forEach((t) => {
        if (t && t.charId) detectedCharIds.add(t.charId);
      });

      detectedCharIds.forEach((charId) => {
        if (!this.partySubscriptions.has(charId)) {
          this.subscribeToPartyMember(charId);
        }
      });
    });
  }

  subscribeToPartyMember(charId) {
    if (!this.db || !charId) return;
    const charRef = ref(this.db, `character_vault/${charId}`);
    const unsubscribe = onValue(charRef, (snapshot) => {
      const charData = snapshot.val();
      if (!charData) return;
      this.renderPartyMemberCard(charId, charData);
    });

    this.partySubscriptions.set(charId, unsubscribe);
  }

  renderPartyMemberCard(charId, charData) {
    const container = document.getElementById('keeper-party-list');
    if (!container) return;

    const emptyMsg = container.querySelector('.party-empty-msg');
    if (emptyMsg) emptyMsg.remove();

    const staticData = charData.staticData || {};
    const dynamicState = charData.dynamicState || {};
    const armour = staticData.armour || {};

    const name = staticData.name || 'Viajero';
    const species = staticData.species || 'Explorador';
    const avatar = staticData.avatarUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="%2338bdf8" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>';

    const hp = Number(dynamicState.hp) || 0;
    const maxHp = Number(staticData.maxHp) || 6;

    const stress = Number(dynamicState.stress) || 0;
    const maxStress = Number(staticData.maxStress) || 6;

    const hope = Number(dynamicState.hope) ?? 2;
    const maxHope = Number(staticData.maxHope) || 6;

    // Armour Shields (A.S.): cantidad disponible para absorber daño
    const maxAS = Number(armour.shieldsAS) || 3;
    const usedAS = Number(dynamicState.armourShieldsUsed) || 0;
    const availableAS = Math.max(0, maxAS - usedAS);

    let card = document.getElementById(`party-card-${charId}`);
    if (!card) {
      card = document.createElement('div');
      card.id = `party-card-${charId}`;
      card.className = 'keeper-party-card';
      container.appendChild(card);
    }

    const isCriticalHp = hp >= maxHp - 1;
    const isHighStress = stress >= maxStress - 1;
    card.classList.toggle('danger-alert', isCriticalHp || isHighStress);

    card.innerHTML = `
      <div class="party-card-top">
        <img src="${avatar}" alt="${name}" class="party-avatar" />
        <div class="party-info">
          <strong class="party-name" title="${name}">${name}</strong>
          <span class="party-sub">${species}</span>
        </div>
      </div>
      <div class="party-metrics">
        <div class="p-metric hp ${isCriticalHp ? 'crit' : ''}" title="HP Daño (${hp}/${maxHp})">
          <span>❤️ HP</span>
          <strong>${hp}/${maxHp}</strong>
        </div>
        <div class="p-metric stress ${isHighStress ? 'crit' : ''}" title="Stress acumulado">
          <span>⚡ STR</span>
          <strong>${stress}/${maxStress}</strong>
        </div>
        <div class="p-metric hope" title="Hope">
          <span>✨ HOPE</span>
          <strong>${hope}/${maxHope}</strong>
        </div>
        <div class="p-metric as" title="Armour Shields (A.S.) libres (${usedAS}/${maxAS} usados)">
          <span>🛡️ A.S.</span>
          <strong>${availableAS}/${maxAS}</strong>
        </div>
      </div>
    `;
  }

  initKeeperDiceRoller() {
    const rollBtns = document.querySelectorAll('.keeper-quick-roll-btn');
    const secretCheckbox = document.getElementById('keeper-secret-roll-toggle');

    rollBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sides = parseInt(btn.dataset.sides, 10) || 20;
        const label = btn.dataset.label || `Tirada d${sides}`;
        const isSecret = secretCheckbox ? secretCheckbox.checked : false;
        let result = Math.floor(Math.random() * sides) + 1;

        if (typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.roll === 'function') {
          try {
            const roll3d = await window.VFDice3D.roll(
              [{ qty: 1, sides, theme: 'vfNeutral', role: 'neutral' }],
              { label: `Keeper · ${label}`, style: 'overlay', deferResults: true }
            );
            if (roll3d && Array.isArray(roll3d.values) && roll3d.values.length > 0) {
              result = roll3d.values[0];
            }
            window.VFDice3D.showResults({
              label: isSecret ? 'Keeper (Oculta)' : `Keeper · ${label}`,
              outcome: isSecret ? '🔒 TIRADA OCULTA' : `D${sides}: ${result}`,
              rolls: [{ value: result, sides, role: 'neutral' }],
              style: 'overlay'
            });
          } catch (err) {
            console.warn('[KeeperHUD] Fallback tirada 3D:', err);
          }
        }

        const rollPayload = {
          type: 'standard',
          uid: this.currentUser.uid,
          playerName: isSecret ? 'Keeper (Oculta)' : 'Keeper',
          label: label,
          extraDice: [{ sides, value: result }],
          total: result,
          outcomeType: 'fear',
          outcomeLabel: isSecret ? '🔒 TIRADA OCULTA' : `DADO D${sides}`,
          breakdown: `1d${sides} [${result}]`,
          isSecret: isSecret,
          skipAutoResource: true,
          clientTimestamp: Date.now(),
          serverTimestamp: serverTimestamp()
        };

        if (this.db) {
          const rollsListRef = ref(this.db, `rooms/${this.roomId}/diceLog`);
          await push(rollsListRef, rollPayload);
        }
      });
    });
  }
}