import './styles/base.css';
import './styles/sections.css';

import { initHeadingStroke, initHero } from './hero';
import { initNav, initNavToneObserver } from './sections/nav';
import { initProfileLayout, initProfileScrollReveal, initSnapScroll } from './sections/snap';
import { initWork } from './sections/work';
import { initSkills } from './sections/skills';
import { initExperience } from './sections/experience';
import { initRecommendations } from './sections/recommendations';
import { initWriting } from './sections/writing';
import { initTravel } from './sections/travel';
import { initElectricBorder } from './sections/electric-border';
import { initContactForm, initSimpleReveal } from './sections/contact';
import { getScroller, initViewportHeight } from './lib/utils';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

// Dev-only handle so animations can be inspected and fast-forwarded from the
// console. Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { gsap: typeof gsap }).gsap = gsap;
}

/*
 * Every ScrollTrigger records the scroll offset of its trigger the moment it is
 * created, and boot runs on DOMContentLoaded: before the images load, and before
 * the writing masonry above the travel section has laid out. That masonry is
 * absolutely positioned and sets its own height from JS, so everything below it
 * moves by hundreds of pixels afterwards while the triggers keep pointing at the
 * old offsets. The travel scatter is last on the page and therefore worst hit: it
 * would play out well before you scrolled to it, and arrive already finished.
 *
 * So recompute whenever the page actually changes height.
 */
function keepScrollTriggersInSync() {
  const scroller = getScroller();
  if (!scroller) return;

  let last = scroller.scrollHeight;
  const refresh = () => {
    if (Math.abs(scroller.scrollHeight - last) < 2) return;
    last = scroller.scrollHeight;
    ScrollTrigger.refresh();
  };

  const observer = new ResizeObserver(refresh);
  Array.from(scroller.children).forEach((child) => observer.observe(child));

  window.addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

function boot() {
  initViewportHeight();

  // Order matters: snap has to exist before nav, which scrolls through it.
  initSnapScroll();
  initProfileScrollReveal();
  initProfileLayout();

  /*
   * Reference settings, with cherry standing in for its electric cyan. chaos at
   * 0.01 rather than 0.12 is the one that matters: it keeps the line hugging the
   * edge as a crisp filament instead of throwing it out into a loose scribble.
   */
  initElectricBorder(document.querySelector('.profile-image-wrap'), {
    color: '#670626',
    speed: 1.2,
    chaos: 0.01,
    borderRadius: 0,
  });
  initNav();
  initNavToneObserver();

  initHeadingStroke();
  initWork();
  initSkills();
  initExperience();
  initRecommendations();
  initWriting();
  initTravel();
  initSimpleReveal();
  void initContactForm();

  // The hero owns the preloader, so it goes last and is never awaited.
  void initHero();

  keepScrollTriggersInSync();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
