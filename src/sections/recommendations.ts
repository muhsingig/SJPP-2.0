import { getScroller, prefersReducedMotion, rafThrottle } from '../lib/utils';
import { revealTitleByLetter } from './skills';

/**
 * Dots for the testimonial track. The swipe itself is native scroll-snap, so
 * this only mirrors the scroll position and lets the dots drive it back.
 */
function initRecsCarousel(section: HTMLElement) {
  const track = section.querySelector<HTMLElement>('[data-recs-track]');
  const dots = section.querySelector<HTMLElement>('.recs-dots');
  if (!track || !dots) return;

  const cards = Array.from(track.querySelectorAll<HTMLElement>('.rec-card'));
  if (cards.length < 2) return;

  const arrows = Array.from(section.querySelectorAll<HTMLButtonElement>('.recs-arrow'));
  let index = 0;

  const goTo = (i: number) => {
    const target = cards[Math.max(0, Math.min(cards.length - 1, i))];
    if (!target) return;
    track.scrollTo({
      left: target.offsetLeft - track.offsetLeft,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  const buttons = cards.map((_card, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'recs-dot';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Testimonial ${i + 1} of ${cards.length}`);
    b.addEventListener('click', () => goTo(i));
    dots.appendChild(b);
    return b;
  });

  arrows.forEach((arrow) => {
    const dir = Number(arrow.dataset.dir ?? '1');
    arrow.addEventListener('click', () => goTo(index + dir));
  });

  const syncActive = () => {
    // Whichever card sits nearest the track's left edge is the current one.
    const x = track.scrollLeft;
    let nearest = 0;
    let best = Infinity;
    cards.forEach((card, i) => {
      const d = Math.abs(card.offsetLeft - track.offsetLeft - x);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    index = nearest;
    buttons.forEach((b, i) => b.setAttribute('aria-selected', String(i === nearest)));
    arrows.forEach((arrow) => {
      const dir = Number(arrow.dataset.dir ?? '1');
      arrow.disabled = dir < 0 ? nearest === 0 : nearest === cards.length - 1;
    });
  };

  const update = rafThrottle(syncActive);
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  syncActive();
}

export function initRecommendations() {
  const section = document.querySelector<HTMLElement>('.recs-section');
  if (!section) return;

  revealTitleByLetter(section.querySelector('.recs-title'), section, 'art-title-letter');
  initRecsCarousel(section);

  /*
   * The cards carry data-simple-reveal, but the track clips them horizontally,
   * so a card scrolled out of the track never intersects and would stay at
   * opacity 0. Reveal the whole set together when the section arrives instead.
   */
  const cards = Array.from(section.querySelectorAll<HTMLElement>('.rec-card'));
  if (!cards.length) return;

  if (prefersReducedMotion()) {
    cards.forEach((c) => c.classList.add('is-inview'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        cards.forEach((c) => c.classList.add('is-inview'));
        observer.disconnect();
      });
    },
    { root: getScroller() ?? null, threshold: 0.15 }
  );

  observer.observe(section);
}
