import { clamp, prefersReducedMotion, wrapWords } from '../lib/utils';
import { setHeroInView, setHeroPaused } from '../hero';

const SNAP_DURATION = 2000;
/** Reveal only starts once the snap is a fifth of the way in, then fills over the rest. */
const REVEAL_DELAY = 0.2;
const LINE_SPAN = 0.8;

let snapStack: HTMLElement | null = null;
let profileSection: HTMLElement | null = null;
let profileTop = 0;

let snapAnimating = false;
let rebuildLines: (() => void) | null = null;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const applyRevealDelay = (p: number) => clamp((p - REVEAL_DELAY) / (1 - REVEAL_DELAY), 0, 1);

function setRevealProgress(p: number) {
  profileSection?.style.setProperty('--reveal-progress', p.toFixed(3));
}

function updateRevealFromScroll() {
  if (!snapStack || profileTop <= 0) return;
  setRevealProgress(applyRevealDelay(clamp(snapStack.scrollTop / profileTop, 0, 1)));
}

function measure() {
  if (!snapStack || !profileSection) return;
  const stackRect = snapStack.getBoundingClientRect();
  profileTop = profileSection.getBoundingClientRect().top - stackRect.top + snapStack.scrollTop;
  updateRevealFromScroll();
}

/* ------------------------------------------------------- profile line reveal */

/**
 * Groups every word by the visual line it landed on, then hands each line an
 * ordering value. A single --reveal-progress variable then drives the whole
 * paragraph in CSS — no per-word JS animation.
 */
export function initProfileScrollReveal() {
  profileSection = document.getElementById('profile');
  if (!profileSection) return;

  const targets = Array.from(
    profileSection.querySelectorAll<HTMLElement>('[data-scroll-reveal]')
  ).filter((el) => !el.classList.contains('profile-image-wrap'));
  if (!targets.length) return;

  profileSection.style.setProperty('--reveal-progress', '0');

  for (const el of targets) {
    if (!el.getAttribute('data-original-html')) {
      el.setAttribute('data-original-html', el.innerHTML);
    }
  }

  const build = () => {
    const words: HTMLSpanElement[] = [];
    for (const el of targets) {
      el.innerHTML = el.getAttribute('data-original-html') ?? '';
      words.push(...wrapWords(el));
    }

    requestAnimationFrame(() => {
      let lineIndex = -1;
      let lastTop: number | null = null;

      for (const word of words) {
        const top = word.getBoundingClientRect().top;
        if (lastTop === null || Math.abs(top - lastTop) > 2) {
          lineIndex += 1;
          lastTop = top;
        }
        word.style.setProperty('--line-order', String(lineIndex));
      }

      const lineCount = Math.max(1, lineIndex + 1);
      const span = lineCount > 1 ? LINE_SPAN : 1;
      const step = lineCount > 1 ? (1 - span) / (lineCount - 1) : 0;

      profileSection!.style.setProperty('--line-span', span.toFixed(4));
      for (const word of words) {
        const order = Number(word.style.getPropertyValue('--line-order') || 0);
        word.style.setProperty('--line-order', (order * step).toFixed(4));
      }

      const image = profileSection!.querySelector<HTMLElement>('.profile-image-wrap');
      image?.style.setProperty('--line-order', (1 - span).toFixed(4));
    });
  };

  rebuildLines = build;
  build();
  window.addEventListener('resize', build);

  if (prefersReducedMotion()) setRevealProgress(1);
}

/**
 * Keeps the about section inside one viewport on desktop, and lines the divider's
 * gap up with the portrait above it.
 */
export function initProfileLayout() {
  const section = document.getElementById('profile');
  if (!section) return;

  const update = () => {
    const image = section.querySelector<HTMLElement>('.profile-image-wrap');
    const divider = section.querySelector<HTMLElement>('.profile-divider');

    if (image) {
      const rect = image.getBoundingClientRect();
      section.style.setProperty('--profile-image-width', `${rect.width}px`);
      if (divider && rect.width > 0) {
        divider.style.setProperty('--divider-left', `${Math.max(0, rect.left)}px`);
        divider.style.setProperty('--divider-gap', `${rect.width}px`);
        divider.style.setProperty('--divider-right', `${Math.max(0, window.innerWidth - rect.right)}px`);
      }
    }

    if (!window.matchMedia('(min-width: 901px)').matches) {
      section.style.setProperty('--profile-scale', '1');
      rebuildLines?.();
      updateRevealFromScroll();
      return;
    }

    const available = (snapStack?.clientHeight || window.innerHeight) as number;
    section.style.setProperty('--profile-scale', '1');
    const natural = section.scrollHeight;
    const scale = clamp(available / Math.max(1, natural), 0.75, 1.2);
    section.style.setProperty('--profile-scale', scale.toFixed(3));
    rebuildLines?.();
    updateRevealFromScroll();
  };

  requestAnimationFrame(update);
  window.addEventListener('resize', update);
  document.fonts?.ready.then(update);
}

/* ------------------------------------------------------------------ snapping */

export function animateSnapTo(target: number) {
  if (!snapStack) return;
  const from = snapStack.scrollTop;
  const distance = target - from;
  if (Math.abs(distance) < 1) return;

  snapAnimating = true;
  setHeroPaused(true);
  const start = performance.now();

  const tick = (now: number) => {
    if (!snapStack) return;
    const t = clamp((now - start) / SNAP_DURATION, 0, 1);
    const eased = easeInOutCubic(t);
    snapStack.scrollTop = from + distance * eased;

    if (profileTop > 0) {
      setRevealProgress(applyRevealDelay(clamp(snapStack.scrollTop / profileTop, 0, 1)));
    }

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      snapAnimating = false;
      setHeroPaused(false);
      setHeroInView(snapStack.scrollTop <= 10);
    }
  };

  requestAnimationFrame(tick);
}

export function scrollToSection(selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target || !snapStack) return;
  const stackRect = snapStack.getBoundingClientRect();
  const top = target.getBoundingClientRect().top - stackRect.top + snapStack.scrollTop;
  animateSnapTo(Math.max(0, top));
}

export function initSnapScroll() {
  snapStack = document.querySelector<HTMLElement>('.snap-stack');
  const hero = document.getElementById('hero');
  profileSection = document.getElementById('profile');
  if (!snapStack || !hero || !profileSection) return;

  snapStack.classList.add('is-js-snapping');
  measure();
  window.addEventListener('resize', measure);

  const swipeHint = document.querySelector<HTMLElement>('.hero-swipe-hint');
  let hintHidden = false;

  snapStack.addEventListener(
    'scroll',
    () => {
      if (!snapAnimating) updateRevealFromScroll();
      setHeroInView(snapStack!.scrollTop < snapStack!.clientHeight);
      if (!hintHidden && swipeHint && snapStack!.scrollTop > 10) {
        hintHidden = true;
        swipeHint.classList.add('is-hidden');
      }
    },
    { passive: true }
  );

  snapStack.addEventListener(
    'wheel',
    (e) => {
      if (snapAnimating || profileTop <= 0) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < 2) return;

      const top = snapStack!.scrollTop;
      const down = e.deltaY > 0;
      const atProfile = top >= profileTop - 4 && top <= profileTop + 80;

      if (down && top < profileTop - 1) {
        e.preventDefault();
        measure();
        animateSnapTo(profileTop);
      } else if (!down && atProfile && top > 1) {
        e.preventDefault();
        animateSnapTo(0);
      }
    },
    { passive: false }
  );

  let touchStartY = 0;
  let touchStartScroll = 0;
  let threshold = window.innerWidth <= 1024 ? 96 : 40;
  window.addEventListener('resize', () => {
    threshold = window.innerWidth <= 1024 ? 96 : 40;
  });

  snapStack.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      touchStartScroll = snapStack!.scrollTop;
    },
    { passive: true }
  );

  snapStack.addEventListener(
    'touchend',
    (e) => {
      if (snapAnimating || profileTop <= 0) return;
      const endY = e.changedTouches[0]?.clientY ?? touchStartY;
      const delta = touchStartY - endY;
      if (Math.abs(delta) < threshold) return;

      const down = delta > 0;
      const top = snapStack!.scrollTop;
      const atProfile = top >= profileTop - 4 && top <= profileTop + 80;

      if (down && touchStartScroll < profileTop - 1) {
        measure();
        animateSnapTo(profileTop);
      } else if (!down && atProfile && top > 1) {
        animateSnapTo(0);
      }
    },
    { passive: true }
  );

  if (window.location.hash) {
    requestAnimationFrame(() => scrollToSection(window.location.hash));
  }
}
