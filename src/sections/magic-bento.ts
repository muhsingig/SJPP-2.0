import gsap from 'gsap';

import { prefersReducedMotion } from '../lib/utils';

/**
 * Cursor spotlight and border glow for the essay tiles.
 *
 * Ported from the React component with the toggles Sanika chose: spotlight on at
 * radius 320, magnetism on, stars, tilt and click off.
 *
 * Two things differ from the original, both forced by where it lives:
 *
 * 1. The original blends its spotlight with mix-blend-mode: screen, which is
 *    built for a near-black page. This section is cream, where screen blending
 *    against a light ground does nothing at all. The halo is cherry over plain
 *    alpha instead, so it reads as light pooling on paper.
 * 2. Magnetism moves .art-item-img, never .art-item. The masonry owns a
 *    translate3d on the tile itself, and animating x/y there would fight the
 *    layout and throw tiles out of the grid.
 */

const SPOTLIGHT_RADIUS = 320;
const MOBILE_BREAKPOINT = 768;

export function initMagicBento(gridSelector: string, cardSelector: string) {
  const grid = document.querySelector<HTMLElement>(gridSelector);
  if (!grid) return;

  // Pointer-driven, so it is off on touch and for reduced motion.
  if (prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return;
  if (window.innerWidth <= MOBILE_BREAKPOINT) return;

  const spotlight = document.createElement('div');
  spotlight.className = 'bento-spotlight';
  spotlight.setAttribute('aria-hidden', 'true');
  document.body.appendChild(spotlight);

  const proximity = SPOTLIGHT_RADIUS * 0.5;
  const fadeDistance = SPOTLIGHT_RADIUS * 0.75;

  const cards = () => Array.from(grid.querySelectorAll<HTMLElement>(cardSelector));

  /*
   * Clear on the panel, not the tile. The glow is painted by .art-item-img's
   * ::after and reads the variable from there, so zeroing it on .art-item left
   * every tile stuck at full brightness once the pointer left the grid.
   */
  const clearGlow = () => {
    cards().forEach((card) => {
      const panel = card.querySelector<HTMLElement>('.art-item-img') ?? card;
      panel.style.setProperty('--glow-intensity', '0');
    });
  };

  const onMove = (e: MouseEvent) => {
    const rect = grid.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!inside) {
      gsap.to(spotlight, { opacity: 0, duration: 0.3, ease: 'power2.out' });
      clearGlow();
      return;
    }

    let nearest = Infinity;

    cards().forEach((card) => {
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const distance = Math.max(
        0,
        Math.hypot(e.clientX - cx, e.clientY - cy) - Math.max(r.width, r.height) / 2
      );
      nearest = Math.min(nearest, distance);

      let intensity = 0;
      if (distance <= proximity) intensity = 1;
      else if (distance <= fadeDistance) {
        intensity = (fadeDistance - distance) / (fadeDistance - proximity);
      }

      // The glow paints on the inner panel, so measure against that.
      const panel = card.querySelector<HTMLElement>('.art-item-img') ?? card;
      const pr = panel.getBoundingClientRect();
      panel.style.setProperty('--glow-x', `${((e.clientX - pr.left) / pr.width) * 100}%`);
      panel.style.setProperty('--glow-y', `${((e.clientY - pr.top) / pr.height) * 100}%`);
      panel.style.setProperty('--glow-intensity', intensity.toString());
      panel.style.setProperty('--glow-radius', `${SPOTLIGHT_RADIUS}px`);
    });

    gsap.to(spotlight, { left: e.clientX, top: e.clientY, duration: 0.1, ease: 'power2.out' });

    const targetOpacity =
      nearest <= proximity
        ? 0.8
        : nearest <= fadeDistance
          ? ((fadeDistance - nearest) / (fadeDistance - proximity)) * 0.8
          : 0;

    gsap.to(spotlight, {
      opacity: targetOpacity,
      duration: targetOpacity > 0 ? 0.2 : 0.5,
      ease: 'power2.out',
    });
  };

  const onLeave = () => {
    clearGlow();
    gsap.to(spotlight, { opacity: 0, duration: 0.3, ease: 'power2.out' });
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseleave', onLeave);

  /* ------------------------------------------------------------ magnetism */

  cards().forEach((card) => {
    if (card.hasAttribute('data-stub')) return;
    const panel = card.querySelector<HTMLElement>('.art-item-img');
    if (!panel) return;

    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) * 0.05;
      const dy = (e.clientY - r.top - r.height / 2) * 0.05;
      gsap.to(panel, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(panel, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' });
    });
  });
}
