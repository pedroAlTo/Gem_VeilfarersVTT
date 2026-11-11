function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

export class VeilfarersDiceEngine {
  constructor(containerSelector = '#vf-dice-canvas-container') {
    this.containerSelector = containerSelector;
    this.isReady = false;
    this.clearTimer = null;
    this.audio = null;
    if (typeof window !== 'undefined') {
      window.veilDiceEngine = this;
    }
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
          style: 'overlay',
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
          style: 'overlay'
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

    this.showCallout(rollData);
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
      return window.VFDice3D.roll(groups, { label: 'Tirada Duality', style: 'overlay' });
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
      return window.VFDice3D.roll(groups, { label: 'Tirada Estándar', style: 'overlay' });
    }
    return new Promise((resolve) => setTimeout(resolve, 1400));
  }

  clearCanvas() {
    if (typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.hide === 'function') {
      window.VFDice3D.hide({ reason: 'auto-dismiss' });
    }
  }

  showCallout(rollData) {
    if (!rollData) return;

    // Verificar si es tirada oculta: solo visible para el Keeper
    const isSecret = !!(rollData.isSecret || rollData.visibility === 'keeper');
    const isKeeper = typeof window !== 'undefined' && window.veilStore
      ? (window.veilStore.sessionRole !== 'player' && window.veilStore.state.userRole === 'keeper')
      : true;
    if (isSecret && !isKeeper) return;

    let stack = document.getElementById('vf-callouts-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'vf-callouts-stack';
      stack.className = 'vf-callouts-stack';
      document.body.appendChild(stack);
    }

    const tokenName = rollData.actorName || rollData.playerName || rollData.tokenName || 'Operativo';
    const label = rollData.label || rollData.title || (rollData.type === 'duality' ? 'Acción Duality' : 'Tirada de dados');
    const total = rollData.total ?? (rollData.value ?? 0);

    let outcomeType = rollData.outcomeType;
    let outcomeLabel = rollData.outcomeLabel || rollData.outcomeTitle || rollData.outcome || '';
    if (!outcomeType) {
      if (rollData.crit || rollData.isCritical) {
        outcomeType = 'crit';
        outcomeLabel = outcomeLabel || '¡ÉXITO CRÍTICO!';
      } else if (Number(rollData.fearVal || rollData.fear) > Number(rollData.hopeVal || rollData.hope)) {
        outcomeType = 'fear';
        outcomeLabel = outcomeLabel || 'CON FEAR';
      } else {
        outcomeType = 'hope';
        outcomeLabel = outcomeLabel || (rollData.type === 'duality' ? 'CON HOPE' : '');
      }
    }

    const modifiers = rollData.breakdown || rollData.details || rollData.modifiers || (rollData.hopeVal != null ? `Hope [${rollData.hopeVal}] + Fear [${rollData.fearVal}] ${rollData.modifier ? (rollData.modifier >= 0 ? '+' + rollData.modifier : rollData.modifier) : ''}${rollData.dc ? ` vs DC ${rollData.dc}` : ''}` : '');

    const card = document.createElement('div');
    card.className = `vf-callout-card outcome-${outcomeType || 'hope'}`;
    const secretTag = isSecret ? '<span class="vf-callout-secret-badge">🔒 SECRETA KEEPER</span>' : '';
    const badgeHtml = outcomeLabel ? `<div class="vf-callout-badge">${escapeHtml(outcomeLabel)}</div>` : '';
    const modHtml = modifiers ? `<div class="vf-callout-modifiers">${escapeHtml(modifiers)}</div>` : '';

    card.innerHTML = `
      <div class="vf-callout-header">
        <div class="vf-callout-actor">
          <span class="vf-callout-icon">🎲</span>
          <strong class="vf-callout-name">${escapeHtml(tokenName)}</strong>
          ${secretTag}
        </div>
        <button type="button" class="vf-callout-close" title="Cerrar">×</button>
      </div>
      <div class="vf-callout-action">${escapeHtml(label)}</div>
      <div class="vf-callout-main">
        <div class="vf-callout-total">${escapeHtml(String(total))}</div>
        ${badgeHtml}
      </div>
      ${modHtml}
    `;

    const closeBtn = card.querySelector('.vf-callout-close');
    const dismiss = () => {
      card.classList.add('is-dismissing');
      setTimeout(() => card.remove(), 350);
    };
    if (closeBtn) closeBtn.onclick = dismiss;

    // Auto dismiss after 8 seconds
    const timer = setTimeout(dismiss, 8000);
    card.dataset.timer = String(timer);

    stack.prepend(card);

    // Mantener como máximo 5 callouts visibles a la vez
    while (stack.children.length > 5) {
      const oldest = stack.lastElementChild;
      if (oldest) oldest.remove();
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
