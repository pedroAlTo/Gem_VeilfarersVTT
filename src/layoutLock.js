// The table is a fixed layout: the map, its overlays (scene title, Fear track, hand of cards)
// and the page itself never scroll. Browsers still scroll an overflow:hidden box to show a
// focused or dragged element, so on short screens (tablets) picking a card pushed the Fear
// track and the scene title out of sight. Any such scroll is undone at once.
export function lockLayoutScroll(doc = document) {
  const keep = el => {
    if (!el || el.dataset?.scrollLocked) return;
    if (el.dataset) el.dataset.scrollLocked = '1';
    el.addEventListener('scroll', () => { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } }, { passive: true });
  };
  keep(doc.getElementById('canvas_viewport_root'));
  keep(doc.querySelector('.workspace-container'));
  keep(doc.getElementById('app_root'));
  // The page: only where the layout fits the screen (on a phone the page may need to scroll).
  const page = () => { if (doc.defaultView.innerWidth > 600 && (doc.scrollingElement.scrollTop || doc.scrollingElement.scrollLeft)) doc.scrollingElement.scrollTo(0, 0); };
  doc.defaultView.addEventListener('scroll', page, { passive: true });
  doc.body.addEventListener('scroll', () => { if (doc.defaultView.innerWidth > 600 && doc.body.scrollTop) doc.body.scrollTop = 0; }, { passive: true });
}
