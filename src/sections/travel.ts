import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

import { getScroller, prefersReducedMotion } from '../lib/utils';
import { revealTitleByLetter } from './skills';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven scatter. Every piece is positioned by a single custom property,
 * --spread, running 0 to 1: at 0 they sit stacked and small over the film strip,
 * at 1 they have travelled out to their own --tx/--ty near the edges. Driving one
 * variable rather than tweening twelve transforms keeps the whole collage in step
 * and leaves the geometry in CSS where it is easy to retune.
 */
export function initTravel() {
  const section = document.querySelector<HTMLElement>('.travel-section');
  if (!section) return;

  revealTitleByLetter(section.querySelector('.travel-title'), section, 'art-title-letter');

  const band = section.querySelector<HTMLElement>('[data-travel-stage]');
  const runway = section.querySelector<HTMLElement>('.travel-runway');
  if (!band || !runway) return;

  // Reduced motion gets the opened-out collage with no scrubbing.
  if (prefersReducedMotion()) {
    band.style.setProperty('--spread', '1');
    return;
  }

  const spread = { value: -1 };

  /*
   * Measured on the runway, not the band: the band is sticky, so its own box
   * stops moving once it pins and would report no progress. The runway keeps
   * scrolling underneath it and is what actually defines how long the hold runs.
   */
  ScrollTrigger.create({
    trigger: runway,
    scroller: getScroller(),
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.5,
    onUpdate: (self) => {
      const eased = gsap.parseEase('power2.out')(self.progress);
      if (Math.abs(eased - spread.value) < 0.001) return;
      spread.value = eased;
      band.style.setProperty('--spread', eased.toFixed(4));
    },
  });
}
