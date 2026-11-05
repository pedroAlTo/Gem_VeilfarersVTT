import DOMPurify from 'dompurify';
export const sanitizeHTML = (html) =>
  DOMPurify.sanitize(String(html ?? ''), {
    ADD_TAGS: ['vf-select'],
    ADD_ATTR: ['selected'],
    FORBID_TAGS: ['iframe', 'object', 'embed', 'script'],
    FORBID_ATTR: ['srcdoc'],
  });
export const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export function notify(message, kind = 'info') {
  if (typeof document === 'undefined') return;
  let root = document.getElementById('toast_stack');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast_stack';
    root.setAttribute('aria-live', 'polite');
    document.body.append(root);
  }
  const el = document.createElement('div');
  el.className = `orbital-toast ${kind}`;
  el.textContent = message;
  root.append(el);
  setTimeout(() => el.remove(), 6000);
}
export function confirmAction(message, options = {}) {
  return new Promise((resolve) => {
    const previous = document.activeElement,
      overlay = document.createElement('div');
    overlay.className = 'veil-modal-backdrop confirmation-layer';
    overlay.innerHTML = sanitizeHTML(
      `<div class="veil-modal-box confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm_title"><div class="veil-modal-header"><h3 id="confirm_title">${escapeHTML(options.title || 'Confirm action')}</h3></div><div class="veil-modal-body"><p>${escapeHTML(message)}</p><div class="confirm-actions"><button class="hud-btn cancel">Cancel</button><button class="hud-btn hud-btn-primary accept">${escapeHTML(options.accept || 'Confirm')}</button></div></div></div>`
    );
    let settled = false;
    const close = (value) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      previous?.focus?.();
      resolve(value);
    };
    overlay.querySelector('.cancel').onclick = () => close(false);
    overlay.querySelector('.accept').onclick = () => close(true);
    overlay.onkeydown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(false);
      }
      if (e.key === 'Tab') {
        const buttons = [...overlay.querySelectorAll('button')];
        e.preventDefault();
        buttons[
          (buttons.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + buttons.length) %
            buttons.length
        ].focus();
      }
    };
    document.body.append(overlay);
    overlay.querySelector('.cancel').focus();
  });
}
export async function chooseCriticalResource() {
  return (await confirmAction(
    'Place the additional Sleeping critical point in Resolve? Choose Effort to take Effort instead.',
    { title: 'Critical · Sleeping', accept: 'Resolve' }
  ))
    ? 'resolve'
    : 'effort';
}
// A real custom listbox: no operating-system select menu.
if (typeof customElements !== 'undefined' && !customElements.get('vf-select')) {
  class VeilSelect extends HTMLElement {
    connectedCallback() {
      if (this.trigger) return;
      this.trigger = document.createElement('button');
      this.trigger.type = 'button';
      this.trigger.className = 'orbital-select-trigger';
      this.trigger.setAttribute('role', 'combobox');
      this.trigger.setAttribute('aria-haspopup', 'listbox');
      this.trigger.setAttribute('aria-expanded', 'false');
      this.append(this.trigger);
      this.trigger.onclick = () => this.open();
      this.trigger.onkeydown = (e) => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
          e.preventDefault();
          this.open();
        }
      };
      this.observer = new MutationObserver(() => {
        if (!this.trigger?.isConnected) {
          this.trigger = null;
          this.observer.disconnect();
          this.connectedCallback();
        } else this.sync();
      });
      this.observer.observe(this, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['selected', 'disabled'],
      });
      this.sync();
    }
    disconnectedCallback() {
      this.observer?.disconnect();
      this.close();
    }
    get options() {
      return [...this.querySelectorAll('option')];
    }
    get value() {
      return (
        this._value ??
        this.options.find((x) => x.hasAttribute('selected'))?.value ??
        this.options[0]?.value ??
        ''
      );
    }
    set value(v) {
      this._value = String(v);
      this.sync();
    }
    get disabled() {
      return this.hasAttribute('disabled');
    }
    set disabled(v) {
      this.toggleAttribute('disabled', v);
      this.sync();
    }
    sync() {
      if (!this.trigger) return;
      const option = this.options.find((o) => o.value === this.value);
      const label = option?.textContent || 'Choose…';
      if (this.trigger.textContent !== label) this.trigger.textContent = label;
      if (this.trigger.disabled !== this.disabled) this.trigger.disabled = this.disabled;
      this.trigger.setAttribute(
        'aria-label',
        this.getAttribute('aria-label') || this.title || label
      );
    }
    close() {
      this.popup?.remove();
      this.popup = null;
      this.trigger?.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', this.outside);
      window.removeEventListener('resize', this.onResize);
    }
    open() {
      if (this.disabled) return;
      if (this.popup) {
        this.close();
        return;
      }
      const list = document.createElement('div');
      list.className = 'orbital-listbox';
      list.setAttribute('role', 'listbox');
      this.popup = list;
      for (const option of this.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(option.value === this.value));
        b.disabled = option.disabled;
        b.textContent = option.textContent;
        b.onclick = () => {
          this.value = option.value;
          this.close();
          this.trigger.focus();
          this.dispatchEvent(new Event('change', { bubbles: true }));
        };
        list.append(b);
      }
      document.body.append(list);
      const r = this.getBoundingClientRect();
      list.style.width = `${Math.max(180, Math.min(r.width, innerWidth - 24))}px`;
      list.style.left = `${Math.min(r.left, innerWidth - list.offsetWidth - 12)}px`;
      list.style.maxHeight = `${Math.min(280, innerHeight - 32)}px`;
      list.style.top = `${r.bottom + list.offsetHeight > innerHeight ? Math.max(12, r.top - list.offsetHeight - 4) : r.bottom + 4}px`;
      this.trigger.setAttribute('aria-expanded', 'true');
      (list.querySelector('[aria-selected="true"]') || list.querySelector('button'))?.focus();
      list.onkeydown = (e) => {
        const buttons = [...list.querySelectorAll('button:not(:disabled)')];
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const i = buttons.indexOf(document.activeElement);
          buttons[
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? buttons.length - 1
                : (i + (e.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length
          ]?.focus();
        }
        if (e.key === 'Escape' || e.key === 'Tab') {
          this.close();
          this.trigger.focus();
        }
      };
      this.outside = (e) => {
        if (!this.contains(e.target) && !list.contains(e.target)) this.close();
      };
      this.onResize = () => this.close();
      document.addEventListener('pointerdown', this.outside);
      window.addEventListener('resize', this.onResize);
    }
  }
  customElements.define('vf-select', VeilSelect);
}
