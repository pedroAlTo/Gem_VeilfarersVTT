// Full-bleed table (v2.28.2, user decision 21 Nov 2026): «no enmarques el mapa, déjalo que ocupe
// el fondo al 100 %; los menús y el panel van en overlay sobre el mapa». On a desktop screen the
// map viewport fills the window; the header, the tool bar and the right panel float over it. What
// lives on the map (scene title, clocks, character bar, card hand, dice) sits in a safe area that
// follows those panels, so nothing ends up under them. Phones and tablets keep the stacked layout.
import './fullbleed.css';

const DESKTOP = '(min-width: 1025px)';
const GAP = 8;

export function mountFullbleed() {
  const viewport = document.getElementById('canvas_viewport_root');
  if (!viewport || viewport.querySelector(':scope > .map-safe-area')) return null;
  const canvas = document.getElementById('tactical_canvas');
  const safe = document.createElement('div');
  safe.className = 'map-safe-area';
  // Everything on the map but the canvas goes into the safe area, now and when it is added later.
  const adopt = node => { if (node !== canvas && node !== safe && node.nodeType === 1 && node.parentElement === viewport) safe.append(node); };
  [...viewport.children].forEach(adopt);
  viewport.append(safe);
  new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(adopt))).observe(viewport, { childList: true });

  const media = window.matchMedia(DESKTOP);
  const header = document.querySelector('.header-hud'), tools = document.getElementById('main_left_toolbar'), panel = document.getElementById('main_right_sidebar');
  // (offsetParent is null for fixed elements: «shown» asks for boxes instead.)
  const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  // The safe area's edges: under the header, right of the tools, left of the panel.
  const measure = () => {
    const on = media.matches;
    document.body.classList.toggle('fullbleed', on);
    if (!on) return;
    const root = document.documentElement.style, width = window.innerWidth;
    const top = header ? header.getBoundingClientRect().bottom + GAP : GAP;
    root.setProperty('--fb-top', `${Math.round(top)}px`);
    root.setProperty('--fb-left', `${Math.round((shown(tools) ? tools.getBoundingClientRect().right : 0) + GAP)}px`);
    const left = shown(panel) && !panel.classList.contains('collapsed') ? panel.getBoundingClientRect().left : width;
    root.setProperty('--fb-right', `${Math.round(width - left + GAP)}px`);
  };
  const observer = new ResizeObserver(() => requestAnimationFrame(measure));
  [header, tools, panel].filter(Boolean).forEach(el => observer.observe(el));
  media.addEventListener?.('change', measure);
  window.addEventListener('resize', measure);
  measure();
  // The canvas follows its viewport's size; tell it that the viewport changed.
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  return safe;
}
