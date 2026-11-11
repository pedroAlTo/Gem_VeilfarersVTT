/* Adapted from @3d-dice/dice-ui DisplayResults 0.5.2 (MIT).
 * Original author/project: 3d-dice/dice-ui — https://github.com/3d-dice/dice-ui
 * Adaptation removes bundler-only SVG/CSS imports and adds VeilFarers labels/modifiers.
 */
export default class DisplayResults {
  constructor(selector) {
    this.target = document.querySelector(selector) || document.body;
    this.timeout = 420;
    this.elem = document.createElement('div');
    this.elem.className = 'vf-display-results';
    this.resultsElem1 = document.createElement('button');
    this.resultsElem1.type = 'button';
    this.resultsElem1.className = 'vf-results hidden';
    this.resultsElem2 = document.createElement('button');
    this.resultsElem2.type = 'button';
    this.resultsElem2.className = 'vf-results hidden';
    this.resultsElem1.style.transition = `all ${this.timeout}ms`;
    this.resultsElem2.style.transition = `all ${this.timeout}ms`;
    this.elem.append(this.resultsElem1, this.resultsElem2);
    this.target.prepend(this.elem);
    this.resultsElem1.addEventListener('click', () => this.clear(this.resultsElem1));
    this.resultsElem2.addEventListener('click', () => this.clear(this.resultsElem2));
    this.even = false;
  }
  _flatten(data) {
    if (!data) return [];
    if (Array.isArray(data.rolls)) return data.rolls;
    if (data.rolls && typeof data.rolls === 'object') return Object.values(data.rolls).flat();
    const out=[];
    const walk=(value)=>{
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value.rolls)) out.push(...value.rolls);
      Object.values(value).forEach(v=>{ if (v && typeof v === 'object' && v !== value.rolls) walk(v); });
    };
    walk(data);
    return out;
  }
  showResults(data) {
    const current = this[`resultsElem${this.even ? 2 : 1}`];
    this.clear(this[`resultsElem${this.even ? 1 : 2}`]);
    const rolls = this._flatten(data);
    const modifier = Number(data && (data.modifier ?? 0)) || 0;
    let total = data && data.value != null ? data.value : rolls.filter(r=>!r.drop).reduce((n,r)=>n+(Number(r.value)||0),0)+modifier;
    const label = data && data.label ? `<span class="vf-results-label">${this.escape(data.label)}</span>` : '';
    const outcome = String((data && data.outcome) || '');
    const winnerRole = /WITH HOPE/i.test(outcome) ? 'hope' : /WITH FEAR/i.test(outcome) ? 'fear' : '';
    const outcomeHtml = outcome ? `<span class="vf-results-outcome">${this.escape(outcome)}</span>` : '';
    const dice = rolls.map((roll) => {
      const sides = roll.die || roll.sides || 'fate';
      let cls = `vf-result-die d${sides}`;
      if (roll.drop) cls += ' die-dropped';
      if (roll.reroll) cls += ' die-rerolled';
      if (roll.explode) cls += ' die-exploded';
      if (winnerRole && String(roll.role || '').toLowerCase() === winnerRole) cls += ' duality-winner';
      if (Number(roll.value) === Number(sides)) cls += ' crit-success';
      if (Number(roll.value) === 1 && sides !== 'fate') cls += ' crit-failure';
      const role = roll.role ? `<small>${this.escape(roll.role)}</small>` : '';
      return `<span class="${cls}"><b>${this.escape(String(roll.value ?? '…'))}</b>${role}</span>`;
    }).join('<span class="vf-result-plus">+</span>');
    const modHtml = modifier ? `<span class="vf-result-mod">${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}</span>` : '';
    current.innerHTML = `${label}${outcomeHtml}<span class="vf-results-equation">${dice}${modHtml}<span class="vf-result-equals">=</span><strong>${this.escape(String(total))}</strong></span>`;
    clearTimeout(current.hideTimer);
    current.classList.remove('hidden','hideEffect');
    current.classList.add('showEffect');
    this.even = !this.even;
    current.hideTimer = setTimeout(()=>this.clear(current), 6200);
  }
  clear(elem) {
    const current = elem || this[`resultsElem${this.even ? 1 : 2}`];
    if (!current || current.classList.contains('hidden')) return;
    current.classList.remove('showEffect');
    current.classList.add('hideEffect');
    clearTimeout(current.hideTimer);
    current.hideTimer=setTimeout(()=>{ current.classList.remove('hideEffect'); current.classList.add('hidden'); },this.timeout);
  }
  escape(text){ const d=document.createElement('div'); d.textContent=text; return d.innerHTML; }
}
