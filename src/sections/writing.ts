import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getScroller, prefersReducedMotion, rafThrottle } from '../lib/utils';
import { revealTitleByLetter } from './skills';

gsap.registerPlugin(ScrollTrigger);

interface Item {
  el: HTMLElement;
  ratio: number;
}

/*
 * Three at desktop, not four: with the placeholder tiles gone there are only
 * six items, and four columns left the section short and sparsely filled.
 */
const BREAKPOINTS: Array<[string, number]> = [
  ['(min-width: 1500px)', 3],
  ['(min-width: 1100px)', 3],
  ['(min-width: 700px)', 3],
  ['(min-width: 520px)', 2],
];

function columnCount() {
  for (const [query, cols] of BREAKPOINTS) {
    if (window.matchMedia(query).matches) return cols;
  }
  return 2;
}

/**
 * Shortest-column masonry. Items are absolutely positioned so tiles of different
 * heights interlock instead of leaving the ragged gaps a CSS grid would.
 */
function initMasonry() {
  const list = document.querySelector<HTMLElement>('.art-masonry-list');
  if (!list) return;

  const items: Item[] = Array.from(list.querySelectorAll<HTMLElement>('.art-item')).map((el) => ({
    el,
    ratio: Number(el.dataset.height ?? '1') / Number(el.dataset.width ?? '1'),
  }));
  if (!items.length) return;

  const layout = () => {
    const width = list.clientWidth;
    if (!width) return;

    const cols = columnCount();
    const gap = parseFloat(getComputedStyle(list).getPropertyValue('--masonry-gap')) || 24;
    const colWidth = (width - gap * (cols - 1)) / cols;
    const heights = new Array<number>(cols).fill(0);

    for (const item of items) {
      let shortest = 0;
      for (let c = 1; c < cols; c++) {
        if (heights[c] < heights[shortest]) shortest = c;
      }

      const h = colWidth * item.ratio;
      item.el.style.width = `${colWidth}px`;
      item.el.style.height = `${h}px`;
      item.el.style.transform = `translate3d(${shortest * (colWidth + gap)}px, ${heights[shortest]}px, 0)`;

      heights[shortest] += h + gap;
    }

    const height = `${Math.max(...heights) - gap}px`;
    if (list.style.height === height) return;
    list.style.height = height;

    /*
     * The tiles are absolutely positioned, so this height is the only thing
     * holding the section open, and it is set from JS after the triggers below
     * were created. Everything further down the page, the travel scatter above
     * all, would keep firing at offsets from before this ran.
     */
    ScrollTrigger.refresh();
  };

  const relayout = rafThrottle(layout);
  layout();
  window.addEventListener('resize', relayout);
  document.fonts?.ready.then(layout);
  window.addEventListener('load', layout);

  // Scaling *down* on hover is deliberate, it reads as the tile stepping back
  // rather than lunging at the cursor.
  if (!prefersReducedMotion() && window.matchMedia('(hover: hover)').matches) {
    for (const { el } of items) {
      // Stubs have nothing to open, so they shouldn't respond to the cursor.
      if (el.hasAttribute('data-stub')) continue;
      const img = el.querySelector<HTMLElement>('.art-item-img');
      if (!img) continue;
      el.addEventListener('mouseenter', () =>
        gsap.to(img, { scale: 0.95, duration: 0.3, ease: 'power2.out', transformOrigin: 'center center' })
      );
      el.addEventListener('mouseleave', () =>
        gsap.to(img, { scale: 1, duration: 0.3, ease: 'power2.out', transformOrigin: 'center center' })
      );
    }
  }

  if (prefersReducedMotion()) return;

  // The tiles are transform-positioned, so fade only, moving them would fight
  // the layout transform.
  gsap.set(
    items.map((i) => i.el),
    { opacity: 0 }
  );
  ScrollTrigger.batch(
    items.map((i) => i.el),
    {
      scroller: getScroller(),
      start: 'top 90%',
      onEnter: (batch) =>
        gsap.to(batch, { opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.06, overwrite: true }),
    }
  );
}

export function initWriting() {
  const section = document.querySelector<HTMLElement>('.art-section');
  if (!section) return;

  revealTitleByLetter(section.querySelector('.art-title'), section, 'art-title-letter');
  initMasonry();
}
