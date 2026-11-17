// Interface language. The app's templates are written in a mix of Spanish and English; this
// layer unifies whatever is on screen into one language by exact match against the dictionary,
// from either side, so switching back and forth needs no record of the original text.
// Player content (chat, log, names typed in fields) and book text (cards, abilities, modules)
// are never touched: they are excluded zones, and only whole interface strings are matched.
import { PAIRS as UI_PAIRS, PATTERNS as UI_PATTERNS } from './i18nDictionary.js';
import { MESSAGE_PAIRS, MESSAGE_PATTERNS } from './i18nMessages.js';

const PAIRS = [...UI_PAIRS, ...MESSAGE_PAIRS];
const PATTERNS = [...UI_PATTERNS, ...MESSAGE_PATTERNS];

export const LANGUAGES = { es: 'Español', en: 'English' };
const STORAGE_KEY = 'veil_lang';
const ATTRIBUTES = ['title', 'placeholder', 'aria-label'];
// Content zones, and elements redrawn every frame (3D dice tracking), are left alone.
const EXCLUDED = [
  '.chat-messages', '.chat-message', '.log-entry', '.vf-card', '.card-inspect-text', '.card-feed-who',
  '.dossier-json', '.bestiary-entry', '.bestiary-text', '.drone-module small', '.vf-dice-tracker', '.vf-tracker-readout',
  '.vf-dice3d-analysis', '.vf-callout-modifiers-text', 'textarea', 'script', 'style', '[contenteditable]', '[data-no-i18n]',
].join(',');

const toTarget = { es: new Map(), en: new Map() };
// A pair may list, after its two forms, other spellings the templates use for the same string.
for (const [es, en, ...variants] of PAIRS) {
  if (!toTarget.es.has(en)) toTarget.es.set(en, es);
  if (!toTarget.en.has(es)) toTarget.en.set(es, en);
  toTarget.es.set(es, es); toTarget.en.set(en, en);
  for (const variant of variants) { toTarget.es.set(variant, es); toTarget.en.set(variant, en); }
}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compile = template => {
  const names = [];
  const source = escape(template).replace(/\\\{(\w+)\\\}/g, (_, name) => { names.push(name); return '(.+?)'; });
  return { regex: new RegExp(`^${source}$`), names, template };
};
// Like pairs, a pattern may list other spellings after its two forms.
const patterns = PATTERNS.map(([es, en, ...variants]) => ({ es: compile(es), en: compile(en), variants: variants.map(compile) }));

let language = 'es';
try { language = LANGUAGES[localStorage.getItem(STORAGE_KEY)] ? localStorage.getItem(STORAGE_KEY) : 'es'; } catch {}
export const currentLanguage = () => language;

const cache = { es: new Map(), en: new Map() };
// The target-language form of an interface string, or null when it is not one we know.
export function translate(text, lang = language) {
  if (typeof text !== 'string' || !LANGUAGES[lang]) return null;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  const memo = cache[lang];
  if (memo.has(trimmed)) return memo.get(trimmed);
  let result = toTarget[lang].get(trimmed) ?? null;
  if (result === null) {
    for (const pair of patterns) {
      for (const side of [pair.es, pair.en, ...pair.variants]) {
        const match = side.regex.exec(trimmed);
        if (!match) continue;
        const target = lang === 'es' ? pair.es : pair.en;
        result = target.template.replace(/\{(\w+)\}/g, (_, name) => {
          const value = match[side.names.indexOf(name) + 1] ?? '';
          return translate(value, lang) ?? value;
        });
        break;
      }
      if (result !== null) break;
    }
  }
  memo.set(trimmed, result);
  return result;
}

// Keeps the spaces around a text node, which the layout sometimes relies on.
const swap = (original, translated) => {
  const lead = original.match(/^\s*/)[0], tail = original.match(/\s*$/)[0];
  return lead + translated + tail;
};
const excluded = element => !element || !!element.closest?.(EXCLUDED);

function translateNode(node) {
  if (node.nodeType === 3) {
    if (excluded(node.parentElement)) return;
    const next = translate(node.nodeValue);
    if (next !== null && next !== node.nodeValue.replace(/\s+/g, ' ').trim()) node.nodeValue = swap(node.nodeValue, next);
    return;
  }
  if (node.nodeType !== 1 || excluded(node)) return;
  for (const name of ATTRIBUTES) {
    const value = node.getAttribute(name);
    if (!value) continue;
    const next = translate(value);
    if (next !== null && next !== value.trim()) node.setAttribute(name, next);
  }
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: child => child.nodeType === 1 && excluded(child) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  while (walker.nextNode()) {
    const child = walker.currentNode;
    if (child.nodeType === 3) translateNode(child);
    else for (const name of ATTRIBUTES) {
      const value = child.getAttribute(name);
      if (!value) continue;
      const next = translate(value);
      if (next !== null && next !== value.trim()) child.setAttribute(name, next);
    }
  }
}

let observer = null, pending = new Set(), scheduled = false;
const flush = () => {
  scheduled = false;
  const nodes = [...pending]; pending = new Set();
  for (const node of nodes) if (node.isConnected) translateNode(node);
};
const queue = node => { pending.add(node); if (!scheduled) { scheduled = true; queueMicrotask(flush); } };

// Starts translating the page and everything added to it later.
export function startTranslation(root = document.body) {
  if (typeof document === 'undefined' || !root) return;
  document.documentElement.lang = language;
  translateNode(root);
  observer?.disconnect();
  observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'childList') m.addedNodes.forEach(queue);
      else if (m.type === 'characterData') queue(m.target);
      else if (m.type === 'attributes') queue(m.target);
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
}

export function setLanguage(lang) {
  if (!LANGUAGES[lang] || lang === language) return language;
  language = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    translateNode(document.body);
    window.dispatchEvent(new CustomEvent('veil:language', { detail: { language: lang } }));
  }
  return language;
}
