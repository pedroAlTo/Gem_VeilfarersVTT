export class VeilfarersDiceEngine {
  constructor(containerSelector = '#vf-dice-canvas-container') {
    this.containerSelector = containerSelector;
    this.isReady = false;
    this.clearTimer = null;
    this.audio = null;
  }

  async init() {
    const started = Date.now();
    while (typeof window !== 'undefined' && !window.VFDice3D && Date.now() - started < 6000) {
      await new Promise((r) => setTimeout(r, 60));
    }

    if (typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.init === 'function') {
      try {
        await window.VFDice3D.init();
        this.isReady = true;
        console.log('[Veilfarers 3D Dice] Motor @3d-dice oficial activo con texturas Duality.');
      } catch (err) {
        console.warn('[Veilfarers 3D Dice] Error inicializando DiceBox 3D:', err);
      }
    } else {
      console.warn('[Veilfarers 3D Dice] VFDice3D no disponible en window.');
    }
  }

  playDiceSound() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.audio) {
        this.audio = new Audio('/assets/dados_1.mp3');
        this.audio.preload = 'auto';
      }
      this.audio.volume = 0.85;
      this.audio.currentTime = 0;
      const playPromise = this.audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((e) => console.warn('[Veilfarers 3D Dice] Audio bloqueado por el navegador:', e));
      }
    } catch (e) {
      console.warn('[Veilfarers 3D Dice] Audio no disponible:', e);
    }
  }

  /**
   * Reproduce la animación 3D de una tirada recibida desde Firebase o local
   * @param {Object} rollData - Datos de la tirada
   */
  async playRollAnimation(rollData) {
    if (this.clearTimer) clearTimeout(this.clearTimer);
    const { type, hopeVal, fearVal, extraDice = [] } = rollData;

    this.playDiceSound();

    if (typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.roll === 'function') {
      const isDuality = type === 'duality';
      const isCrit = isDuality && (Number(hopeVal) === Number(fearVal));
      const groups = isDuality
        ? [
            { qty: 1, sides: 12, theme: 'vfHope', role: 'hope' },
            { qty: 1, sides: 12, theme: 'vfFear', role: 'fear' }
          ]
        : (extraDice.length
            ? extraDice.map((d) => ({
                qty: 1,
                sides: Number(d.sides) || 20,
                theme: 'vfNeutral',
                role: 'neutral'
              }))
            : [{ qty: 1, sides: 20, theme: 'vfNeutral', role: 'neutral' }]);

      const rollerName = rollData.playerName || 'Viajero';
      const label = rollData.label || (isDuality ? 'Duality Roll' : 'Tirada');

      try {
        await window.VFDice3D.roll(groups, {
          label: `${rollerName} · ${label}`,
          style: 'box',
          deferResults: true
        });

        let outcome = rollData.outcomeLabel || '';
        if (isDuality) {
          if (isCrit) outcome = 'CRITICAL SUCCESS';
          else if (Number(fearVal) > Number(hopeVal)) outcome = 'WITH FEAR';
          else outcome = 'WITH HOPE';
        }

        window.VFDice3D.showResults({
          label: `${rollerName} · ${label}`,
          outcome: outcome,
          hope: Number(hopeVal) || 0,
          fear: Number(fearVal) || 0,
          crit: isCrit,
          rolls: isDuality
            ? [
                { value: Number(hopeVal) || 0, sides: 12, role: 'hope' },
                { value: Number(fearVal) || 0, sides: 12, role: 'fear' }
              ]
            : (extraDice.length
                ? extraDice.map((d) => ({
                    value: Number(d.value) || 0,
                    sides: Number(d.sides) || 20,
                    role: 'neutral'
                  }))
                : [{ value: Number(rollData.total) || 0, sides: 20, role: 'neutral' }]),
          style: 'box'
        });
      } catch (err) {
        console.warn('[Veilfarers 3D Dice] Error en simulación 3D:', err);
      }
    } else {
      if (type === 'duality') {
        await this.throw3DDuality(hopeVal, fearVal, extraDice);
      } else {
        await this.throw3DStandard(extraDice);
      }
    }

    this.showBanner(rollData);

    this.clearTimer = setTimeout(() => {
      this.clearCanvas();
      this.hideBanner();
    }, 9000);
  }

  async throw3DDuality(hopeVal, fearVal, extraDice = []) {
    this.playDiceSound();
    if (typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.roll === 'function') {
      const groups = [
        { qty: 1, sides: 12, theme: 'vfHope', role: 'hope' },
        { qty: 1, sides: 12, theme: 'vfFear', role: 'fear' }
      ];
      return window.VFDice3D.roll(groups, { label: 'Tirada Duality', style: 'box' });
    }
    return new Promise((resolve) => setTimeout(resolve, 1400));
  }

  async throw3DStandard(diceArray = []) {
    this.playDiceSound();
    if (typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.roll === 'function') {
      const groups = diceArray.length
        ? diceArray.map((d) => ({
            qty: 1,
            sides: Number(d.sides) || 20,
            theme: 'vfNeutral',
            role: 'neutral'
          }))
        : [{ qty: 1, sides: 20, theme: 'vfNeutral', role: 'neutral' }];
      return window.VFDice3D.roll(groups, { label: 'Tirada Estándar', style: 'box' });
    }
    return new Promise((resolve) => setTimeout(resolve, 1400));
  }

  clearCanvas() {
    if (typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.hide === 'function') {
      window.VFDice3D.hide({ reason: 'auto-dismiss' });
    }
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
      textEl.textContent = 'Cambio revertido';
      await onUndoCallback();
      setTimeout(() => container.classList.add('hidden'), 1200);
    };
  }
}
