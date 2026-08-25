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
/**
 * Opens the story panel for whichever photograph was clicked. Uses a native
 * <dialog>, so focus trapping, Escape and the backdrop come from the platform
 * rather than being reimplemented.
 */
function initTravelStories(section: HTMLElement) {
  const dialog = document.querySelector<HTMLDialogElement>('.travel-story');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const img = dialog.querySelector<HTMLImageElement>('.travel-story-img');
  const place = dialog.querySelector<HTMLElement>('.travel-story-place');
  const body = dialog.querySelector<HTMLElement>('.travel-story-body');
  const close = dialog.querySelector<HTMLButtonElement>('.travel-story-close');
  if (!img || !place || !body) return;

  section.querySelectorAll<HTMLElement>('.travel-piece, .travel-frame').forEach((btn) => {
    btn.addEventListener('click', () => {
      const full = btn.dataset.full ?? '';
      const name = btn.dataset.place ?? '';
      img.src = full;
      img.alt = name;
      place.textContent = name;
      body.textContent = btn.dataset.story ?? '';
      dialog.showModal();
    });
  });

  close?.addEventListener('click', () => dialog.close());

  // Clicking the backdrop closes it; clicks on the panel itself must not.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

export function initTravel() {
  const section = document.querySelector<HTMLElement>('.travel-section');
  if (!section) return;

  revealTitleByLetter(section.querySelector('.travel-title'), section, 'art-title-letter');
  initTravelStories(section);

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
      /*
       * Linear, deliberately. power2.out put the collage 87% open by the halfway
       * point, so it snapped apart at the top of the hold and then sat still for
       * the rest of it, which read as the effect not running at all. Scrubbed
       * motion wants to track the scroll one to one.
       */
      const p = self.progress;
      if (Math.abs(p - spread.value) < 0.001) return;
      spread.value = p;
      band.style.setProperty('--spread', p.toFixed(4));
    },
  });
}
