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

  const buttons = cards.map((card, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'recs-dot';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Testimonial ${i + 1} of ${cards.length}`);
    b.addEventListener('click', () => {
      track.scrollTo({
        left: card.offsetLeft - track.offsetLeft,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    });
    dots.appendChild(b);
    return b;
  });

  /* Nothing overflows at desktop, where all three fit, so hide the control. */
  const syncVisibility = () => {
    dots.hidden = track.scrollWidth <= track.clientWidth + 1;
  };

  const syncActive = () => {
    // Nearest card to the track's left edge wins.
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
    buttons.forEach((b, i) => b.setAttribute('aria-selected', String(i === nearest)));
  };

  const update = rafThrottle(() => {
    syncVisibility();
    syncActive();
  });

  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  syncVisibility();
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
