export class VeilfarersDiceEngine {
  constructor(containerSelector = '#vf-dice-canvas-container') {
    this.containerSelector = containerSelector;
    this.isReady = false;
    this.clearTimer = null;
  }

  async init() {
    const container = document.querySelector(this.containerSelector);
    if (!container) return;

    // Conexión modular lista para integrar con Three.js / DiceBox del Creator
    this.isReady = true;
    console.log('[Veilfarers 3D Dice] Motor inicializado en el VTT.');
  }

  /**
   * Reproduce la animación 3D de una tirada recibida desde Firebase
   * @param {Object} rollData - Datos de la tirada
   */
  async playRollAnimation(rollData) {
    if (!this.isReady) return;
    if (this.clearTimer) clearTimeout(this.clearTimer);

    const { type, hopeVal, fearVal, extraDice = [] } = rollData;

    if (type === 'duality') {
      await this.throw3DDuality(hopeVal, fearVal, extraDice);
    } else {
      await this.throw3DStandard(extraDice);
    }

    this.showBanner(rollData);

    this.clearTimer = setTimeout(() => {
      this.clearCanvas();
      this.hideBanner();
    }, 5500);
  }

  async throw3DDuality(hopeVal, fearVal, extraDice) {
    console.log(`[3D Dice Animation] Duality -> Hope: ${hopeVal}, Fear: ${fearVal}`, extraDice);
    return new Promise((resolve) => setTimeout(resolve, 1400));
  }

  async throw3DStandard(diceArray) {
    console.log(`[3D Dice Animation] Dados estándar ->`, diceArray);
    return new Promise((resolve) => setTimeout(resolve, 1400));
  }

  clearCanvas() {
    // Espacio reservado para limpiar la escena 3D si tu motor lo requiere
  }

  showBanner(rollData) {
    const banner = document.getElementById('vf-roll-banner');
    if (!banner) return;

    banner.className = `vf-roll-banner outcome-${rollData.outcomeType || 'hope'}`;
    const pName = document.getElementById('roll-player-name');
    const sName = document.getElementById('roll-skill-name');
    const tVal = document.getElementById('roll-total-value');
    const bBadge = document.getElementById('roll-outcome-badge');
    const bText = document.getElementById('roll-breakdown-text');

    if (pName) pName.textContent = rollData.playerName || 'Viajero';
    if (sName) sName.textContent = rollData.label || 'Tirada';
    if (tVal) tVal.textContent = rollData.total ?? 0;
    if (bBadge) bBadge.textContent = rollData.outcomeLabel || 'RESULTADO';
    if (bText) bText.textContent = rollData.breakdown || '';

    banner.classList.remove('hidden');
  }

  hideBanner() {
    const banner = document.getElementById('vf-roll-banner');
    if (banner) banner.classList.add('hidden');
  }

  showResourceFeedback(changes, onUndoCallback) {
    const container = document.getElementById('roll-resource-feedback');
    const textEl = document.getElementById('roll-resource-text');
    const undoBtn = document.getElementById('roll-resource-undo');

    if (!container || !changes.summaryText) return;

    textEl.textContent = changes.summaryText;
    container.classList.remove('hidden');

    undoBtn.onclick = async () => {
      undoBtn.disabled = true;
      textEl.textContent = "Cambio revertido";
      await onUndoCallback();
      setTimeout(() => container.classList.add('hidden'), 1200);
    };
  }
}