import gsap from 'gsap';
import { getScroller, prefersReducedMotion } from '../lib/utils';
import { revealTitleByLetter } from './skills';

const VELOCITY_SPEED = 72; // px per second
/*
 * Portrait 3:4, matching the phone photographs that fill the stack. Landscape
 * cards would have kept only the middle third of them and cut off heads.
 */
const STACK_BASE = { width: 480, height: 640 };
const AUTOPLAY_MS = 4000;

/* --------------------------------------------------------------- marquee */

function initScrollVelocity() {
  const section = document.querySelector<HTMLElement>('.inspiration-section');
  const scroller = document.querySelector<HTMLElement>('.velocity-scroller');
  if (!section || !scroller) return;

  const text = scroller.dataset.text ?? scroller.textContent ?? '';
  if (!text.trim()) return;

  let tween: gsap.core.Tween | null = null;
  let visible = false;

  /** Repeats the phrase until the group is wider than the viewport, then clones it. */
  const fillGroup = (minWidth: number) => {
    const group = document.createElement('div');
    group.className = 'velocity-group';
    scroller.appendChild(group);

    let width = 0;
    let guard = 0;
    while (width < minWidth && guard < 200) {
      const span = document.createElement('span');
      span.className = 'velocity-text';
      span.textContent = `${text}  `;
      group.appendChild(span);
      width = group.scrollWidth;
      guard += 1;
    }
    return group;
  };

  const build = () => {
    tween?.kill();
    scroller.innerHTML = '';
    gsap.set(scroller, { x: 0 });

    const minWidth = Math.max(window.innerWidth * 1.2, 1);
    const first = fillGroup(minWidth);
    fillGroup(minWidth);

    if (prefersReducedMotion()) return;

    const width = first.getBoundingClientRect().width || 1;
    tween = gsap.to(scroller, {
      x: -width,
      duration: width / VELOCITY_SPEED,
      ease: 'none',
      repeat: -1,
      paused: true,
    });
    if (visible && !document.hidden) tween.play();
  };

  build();
  window.addEventListener('resize', build);
  document.fonts?.ready.then(build);

  if (prefersReducedMotion()) return;

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

/* ----------------------------------------------------------- photo stack */

function initStack() {
  const section = document.querySelector<HTMLElement>('.inspiration-section');
  const stack = document.querySelector<HTMLElement>('.inspiration-stack');
  if (!section || !stack) return;

  const cards = Array.from(stack.querySelectorAll<HTMLElement>('.stack-card'));
  if (!cards.length) return;

  const randomRotation = stack.dataset.randomRotation === 'true';
  const sendToBack = stack.dataset.sendToBack === 'true';
  const autoplay = stack.dataset.autoplay === 'true' && !prefersReducedMotion();

  const rotations = new Map<HTMLElement, number>();
  const rotationFor = (card: HTMLElement, regenerate = false) => {
    if (!rotations.has(card) || regenerate) {
      rotations.set(card, randomRotation ? gsap.utils.random(-8, 8) : 0);
    }
    return rotations.get(card) ?? 0;
  };

  const order = [...cards];

  const size = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const wFactor = vw <= 700 ? 0.78 : vw <= 900 ? 0.82 : vw <= 1200 ? 0.86 : 0.9;
    const hFactor = vw <= 700 ? 0.5 : vw <= 900 ? 0.54 : vw <= 1200 ? 0.58 : 0.62;

    const maxW = Math.min(vw * wFactor, 860);
    const maxH = Math.min(vh * hFactor, 560);
    const ratio = STACK_BASE.height / STACK_BASE.width;

    let width = maxW;
    let height = width * ratio;
    if (height > maxH) {
      height = maxH;
      width = height / ratio;
    }

    stack.style.width = `${width}px`;
    stack.style.height = `${height}px`;
    cards.forEach((card) => {
      card.style.width = `${width}px`;
      card.style.height = `${height}px`;
    });
  };

  const place = (animate = true) => {
    const count = order.length;
    order.forEach((card, i) => {
      card.style.zIndex = String(count - i);
      const vars = {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: i * 4,
        scale: 1 - i * 0.012,
        rotation: rotationFor(card),
      };
      if (animate) gsap.to(card, { ...vars, duration: 0.55, ease: 'power2.out', overwrite: true });
      else gsap.set(card, vars);
    });
  };

  const cycle = () => {
    if (!sendToBack || order.length < 2) return;
    const top = order.shift();
    if (!top) return;
    rotationFor(top, true);
    order.push(top);
    place(true);
  };

  size();
  place(false);
  window.addEventListener('resize', () => {
    size();
    place(false);
  });

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      if (order[0] === card) cycle();
    });
  });

  if (!autoplay) return;

  let timer: number | undefined;
  let visible = false;

  const start = () => {
    if (timer) return;
    timer = window.setInterval(cycle, AUTOPLAY_MS);
  };
  const stop = () => {
    if (!timer) return;
    window.clearInterval(timer);
    timer = undefined;
  };

  new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible && !document.hidden) start();
      else stop();
    },
    { root: getScroller() ?? null, threshold: 0.2 }
  ).observe(section);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  stack.addEventListener('pointerenter', stop);
  stack.addEventListener('pointerleave', () => {
    if (visible && !document.hidden) start();
  });
}

export function initBeyond() {
  const section = document.querySelector<HTMLElement>('.inspiration-section');
  if (!section) return;

  revealTitleByLetter(section.querySelector('.inspiration-title'), section, 'art-title-letter');
  initScrollVelocity();
  initStack();
}
