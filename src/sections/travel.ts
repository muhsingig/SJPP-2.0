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

  const stage = section.querySelector<HTMLElement>('[data-travel-stage]');
  if (!stage) return;

  // Reduced motion gets the opened-out collage with no scrubbing.
  if (prefersReducedMotion()) {
    stage.style.setProperty('--spread', '1');
    return;
  }

  const spread = { value: 0 };

  ScrollTrigger.create({
    trigger: stage,
    scroller: getScroller(),
    // Opens as the stage rises through the viewport and is fully out well before
    // it leaves, so the collage is never mid-flight when you stop scrolling.
    start: 'top 88%',
    end: 'bottom 62%',
    scrub: 0.6,
    onUpdate: (self) => {
      const eased = gsap.parseEase('power2.out')(self.progress);
      if (Math.abs(eased - spread.value) < 0.001) return;
      spread.value = eased;
      stage.style.setProperty('--spread', eased.toFixed(4));
    },
  });
}
