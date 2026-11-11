import { getDatabase, ref, runTransaction } from "firebase/database";

export class DualityResourceManager {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Aplica las consecuencias de una tirada Duality (Hope, Crítico o Fear)
   * @param {Object} params - { roomId, charId, outcomeType }
   * @returns {Promise<Object>} Resumen de los cambios aplicados
   */
  async applyRollOutcome({ roomId, charId, outcomeType }) {
    const changesApplied = {
      hopeDelta: 0,
      stressDelta: 0,
      fearDelta: 0,
      summaryText: ""
    };

    // 1. CASO FEAR: Suma +1 a la reserva del Keeper en la sala
    if (outcomeType === 'fear' && roomId) {
      const fearRef = ref(this.db, `rooms/${roomId}/combatTracker/fearPool`);
      await runTransaction(fearRef, (currentFear) => {
        const val = Number(currentFear) || 0;
        const maxFear = 12;
        if (val < maxFear) {
          changesApplied.fearDelta = 1;
          return val + 1;
        }
        return val;
      });

      if (changesApplied.fearDelta > 0) {
        changesApplied.summaryText = "⚡ +1 Fear para el Keeper";
      }
      return changesApplied;
    }

    // 2. CASO HOPE O CRÍTICO: Actualiza la ficha del jugador en el Vault
    if ((outcomeType === 'hope' || outcomeType === 'crit') && charId) {
      const charStateRef = ref(this.db, `character_vault/${charId}/dynamicState`);

      await runTransaction(charStateRef, (state) => {
        if (!state) {
          state = { hope: 2, maxHope: 6, stress: 0, maxStress: 6 };
        }

        const currentHope = Number(state.hope) || 0;
        const maxHope = Number(state.maxHope) || 6;
        const currentStress = Number(state.stress) || 0;

        if (currentHope < maxHope) {
          state.hope = currentHope + 1;
          changesApplied.hopeDelta = 1;
        }

        if (outcomeType === 'crit' && currentStress > 0) {
          state.stress = currentStress - 1;
          changesApplied.stressDelta = -1;
        }

        return state;
      });

      const parts = [];
      if (changesApplied.hopeDelta > 0) parts.push("✨ +1 Hope");
      else parts.push("✨ Hope al máximo");

      if (outcomeType === 'crit') {
        if (changesApplied.stressDelta < 0) parts.push("💨 -1 Stress");
        else parts.push("💨 Sin Stress que limpiar");
      }

      changesApplied.summaryText = parts.join("  |  ");
    }

    return changesApplied;
  }

  /**
   * Permite revertir la transacción desde el botón Deshacer
   */
  async revertOutcome({ roomId, charId, changesApplied }) {
    if (changesApplied.fearDelta > 0 && roomId) {
      const fearRef = ref(this.db, `rooms/${roomId}/combatTracker/fearPool`);
      await runTransaction(fearRef, (val) => Math.max(0, (Number(val) || 0) - changesApplied.fearDelta));
    }

    if ((changesApplied.hopeDelta !== 0 || changesApplied.stressDelta !== 0) && charId) {
      const charStateRef = ref(this.db, `character_vault/${charId}/dynamicState`);
      await runTransaction(charStateRef, (state) => {
        if (!state) return state;
        state.hope = Math.max(0, (Number(state.hope) || 0) - changesApplied.hopeDelta);
        state.stress = Math.max(0, (Number(state.stress) || 0) - changesApplied.stressDelta);
        return state;
      });
    }
  }
}