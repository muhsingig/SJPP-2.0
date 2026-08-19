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
 * Captions are set nowrap on purpose, so they have to be shrunk to fit rather
 * than allowed to wrap. Binary-free: step down until both lines clear the box.
 */
function fitWorkCardText() {
  const cards = document.querySelectorAll<HTMLElement>('.work-card');
  cards.forEach((card) => {
    const media = card.querySelector<HTMLElement>('.work-card-media');
    const text = card.querySelector<HTMLElement>('.work-card-text');
    if (!media || !text) return;

    const available = media.clientWidth * 0.85;
    if (available <= 0) return;

    let size = window.innerWidth <= 700 ? 24 : 36;
    text.style.fontSize = `${size}px`;

    const widest = () =>
      Math.max(
        ...Array.from(text.querySelectorAll<HTMLElement>('.work-card-text-base .work-card-text-line')).map(
          (line) => line.scrollWidth
        )
      );

    let guard = 0;
    while (widest() > available && size > 11 && guard < 40) {
      size -= 1;
      text.style.fontSize = `${size}px`;
      guard += 1;
    }

    // Time the colour swap to the rising panel: the caption sits near the top of
    // the card, so the panel edge reaches it late on the way in and early on the
    // way out.
    const cardHeight = media.clientHeight || 1;
    const textTop = text.offsetTop;
    const fraction = Math.min(0.95, Math.max(0.05, textTop / cardHeight));
    const duration = 0.5;
    text.style.setProperty('--text-reveal-duration', `${(duration * 0.42).toFixed(3)}s`);
    text.style.setProperty('--text-reveal-delay-in', `${(duration * (1 - fraction) * 0.72).toFixed(3)}s`);
    text.style.setProperty('--text-reveal-delay-out', `${(duration * fraction * 0.28).toFixed(3)}s`);
  });
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

function initWorkCardLinks() {
  const mobile = window.matchMedia('(max-width: 768px)');
  document.querySelectorAll<HTMLElement>('.work-card').forEach((card) => {
    const activate = () => {
      const url = mobile.matches
        ? card.getAttribute('data-mobile-url')
        : card.getAttribute('data-desktop-url');
      if (!url || url === '#') return;
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    card.addEventListener('click', activate);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });
}

export function initWork() {
  initWorkJournalLines();
  initWorkReveal();
  initWorkTouchReveal();
  initWorkCardLinks();

  const refit = rafThrottle(fitWorkCardText);
  refit();
  window.addEventListener('resize', refit);
  document.fonts?.ready.then(() => fitWorkCardText());
  window.addEventListener('load', () => fitWorkCardText());
}
