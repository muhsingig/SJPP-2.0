import { getScroller, prefersReducedMotion, rafThrottle } from '../lib/utils';

const JOURNAL_LINE_COUNT = 17;

/** Hairline rules that sit behind the grid, sized to track it exactly. */
function initWorkJournalLines() {
  const section = document.querySelector<HTMLElement>('.work-section');
  const container = section?.querySelector<HTMLElement>('.work-journal-lines');
  const grid = section?.querySelector<HTMLElement>('.work-grid');
  if (!section || !container || !grid) return;

  container.innerHTML = '';
  for (let i = 0; i < JOURNAL_LINE_COUNT; i++) container.appendChild(document.createElement('span'));

  const update = rafThrottle(() => {
    const sectionRect = section.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const gap = gridRect.width / JOURNAL_LINE_COUNT;

    section.style.setProperty('--work-lines-top', `${gridRect.top - sectionRect.top}px`);
    section.style.setProperty('--work-lines-left', `${gridRect.left - sectionRect.left}px`);
    section.style.setProperty('--work-lines-width', `${gridRect.width}px`);
    section.style.setProperty('--work-lines-height', `${gridRect.height}px`);
    section.style.setProperty('--work-lines-gap', `${Math.max(1, gap - 1)}px`);
  });

  update();
  window.addEventListener('resize', update);
  document.fonts?.ready.then(update);
}

/**
 * Five cards split three and two, so the columns can never end level. The right
 * one is dropped so the stagger mirrors itself: it starts T lower than the left
 * and the left ends T lower than it. Solving for that gives T = (L - R) / 2.
 *
 * Measured rather than set in CSS, because the captions differ in length and so
 * do the cards: no fixed fraction of a card width gets both ends to agree.
 */
function initWorkStagger() {
  const left = document.querySelector<HTMLElement>('.work-col-left');
  const right = document.querySelector<HTMLElement>('.work-col-right');
  if (!left || !right) return;

  const twoColumns = window.matchMedia('(min-width: 1101px)');

  const update = () => {
    if (!twoColumns.matches) {
      right.style.marginTop = '';
      return;
    }
    const lift = parseFloat(getComputedStyle(left).marginTop) || 0;
    const offset = (left.offsetHeight - right.offsetHeight) / 2;
    right.style.marginTop = `${Math.round(lift + Math.max(0, offset))}px`;
  };

  update();
  // sizes change with fonts, lazy images and the "read the pieces" toggles
  const ro = new ResizeObserver(update);
  ro.observe(left);
  ro.observe(right);
  twoColumns.addEventListener('change', update);
  // backstops for anything that settles without a resize callback
  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  document.fonts?.ready.then(update);
  document.querySelectorAll('.work-card-more').forEach((d) => d.addEventListener('toggle', update));
}

function initWorkReveal() {
  const cards = document.querySelectorAll<HTMLElement>('.work-reveal');
  if (!cards.length) return;

  if (prefersReducedMotion()) {
    cards.forEach((c) => c.classList.add('is-inview'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-inview');
          observer.unobserve(entry.target);
        }
      });
    },
    { root: getScroller() ?? null, threshold: 0.15 }
  );

  cards.forEach((card) => observer.observe(card));
}

/** Hover is meaningless on touch, reveal the panel on intersection instead. */
function initWorkTouchReveal() {
  if (!window.matchMedia('(hover: none)').matches) return;
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.work-card'));
  if (!cards.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const card = entry.target as HTMLElement;
        const index = cards.indexOf(card);
        if (entry.isIntersecting) {
          setTimeout(() => card.classList.add('is-touch-reveal'), (index % 3) * 90);
        } else {
          card.classList.remove('is-touch-reveal');
        }
      });
    },
    { root: getScroller() ?? null, threshold: 0.55 }
  );

  cards.forEach((card) => observer.observe(card));
}

export function initWork() {
  initWorkJournalLines();
  initWorkReveal();
  initWorkTouchReveal();
  initWorkStagger();
}
