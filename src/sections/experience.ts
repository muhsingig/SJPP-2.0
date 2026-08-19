import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getScroller, prefersReducedMotion } from '../lib/utils';

gsap.registerPlugin(ScrollTrigger);

const MARQUEE_SPEED = 72; // px per second

function initClientsMarquee() {
  const section = document.querySelector<HTMLElement>('.clients-section');
  const track = section?.querySelector<HTMLElement>('.clients-track');
  const original = track?.querySelector<HTMLElement>('.clients-track-set');
  if (!section || !track || !original) return;

  // Three sets: one visible, two to cover the wrap at any viewport width.
  for (let i = 0; i < 2; i++) {
    const clone = original.cloneNode(true) as HTMLElement;
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  if (prefersReducedMotion()) return;

  let tween: gsap.core.Tween | null = null;
  let visible = false;

  const build = () => {
    tween?.kill();
    gsap.set(track, { x: 0 });
    const width = original.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap || '0');
    if (width <= 0) return;
    tween = gsap.to(track, {
      x: -width,
      duration: width / MARQUEE_SPEED,
      ease: 'none',
      repeat: -1,
      paused: true,
    });
    if (visible && !document.hidden) tween.play();
  };

  build();
  window.addEventListener('resize', build);
  document.fonts?.ready.then(build);

  new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      visible = entry.isIntersecting;
      if (visible && !document.hidden) tween?.play();
      else tween?.pause();
    },
    { root: getScroller() ?? null, threshold: [0, 0.05] }
  ).observe(section);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) tween?.pause();
    else if (visible) tween?.play();
  });
}

function initClientsCounters() {
  const section = document.querySelector<HTMLElement>('.clients-section');
  if (!section) return;

  const numbers = Array.from(section.querySelectorAll<HTMLElement>('.clients-number[data-target]'));
  if (!numbers.length) return;

  if (prefersReducedMotion()) {
    numbers.forEach((el) => {
      el.textContent = `${Math.round(Number(el.dataset.target ?? '0'))}${el.dataset.suffix ?? ''}`;
    });
    return;
  }

  const state = new Map<HTMLElement, { value: number; rendered: number }>();
  const stateFor = (el: HTMLElement) => {
    let s = state.get(el);
    if (!s) {
      s = { value: 0, rendered: -1 };
      state.set(el, s);
    }
    return s;
  };

  const reset = () => {
    numbers.forEach((el) => {
      const s = stateFor(el);
      gsap.killTweensOf(s);
      s.value = 0;
      s.rendered = 0;
      el.textContent = `0${el.dataset.suffix ?? ''}`;
    });
  };

  const run = () => {
    numbers.forEach((el) => {
      const target = Number(el.dataset.target ?? '0');
      const suffix = el.dataset.suffix ?? '';
      if (!Number.isFinite(target)) return;
      const s = stateFor(el);
      gsap.killTweensOf(s);
      s.value = 0;
      s.rendered = -1;
      gsap.to(s, {
        value: target,
        duration: 0.8,
        ease: 'power1.out',
        onUpdate: () => {
          const rounded = Math.round(s.value);
          if (rounded !== s.rendered) {
            s.rendered = rounded;
            el.textContent = `${rounded}${suffix}`;
          }
        },
      });
    });
  };

  ScrollTrigger.create({
    trigger: section,
    scroller: getScroller(),
    start: 'top 80%',
    onEnter: () => {
      reset();
      run();
    },
    onEnterBack: () => {
      reset();
      run();
    },
    onLeaveBack: reset,
  });
}

export function initExperience() {
  initClientsMarquee();
  initClientsCounters();
}
