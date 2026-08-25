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
import { initContactForm, initSimpleReveal } from './sections/contact';
import { initViewportHeight } from './lib/utils';
import gsap from 'gsap';

// Dev-only handle so animations can be inspected and fast-forwarded from the
// console. Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { gsap: typeof gsap }).gsap = gsap;
}

function boot() {
  initViewportHeight();

  // Order matters: snap has to exist before nav, which scrolls through it.
  initSnapScroll();
  initProfileScrollReveal();
  initProfileLayout();
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
