import gsap from 'gsap';
import { clamp, rafThrottle } from '../lib/utils';
import { animateSnapTo, scrollToSection } from './snap';

export function initNav() {
  const nav = document.querySelector<HTMLElement>('.site-nav');
  const hamburger = nav?.querySelector<HTMLButtonElement>('.nav-hamburger');
  const menu = nav?.querySelector<HTMLElement>('.nav-menu');
  const backdrop = nav?.querySelector<HTMLElement>('.nav-menu-backdrop');
  const list = menu?.querySelector<HTMLElement>('.nav-menu-list');
  const prelayers = menu ? Array.from(menu.querySelectorAll<HTMLElement>('.nav-menu-prelayer')) : [];
  if (!nav || !hamburger || !menu || !backdrop || !list || !prelayers.length) return;

  const items = Array.from(menu.querySelectorAll<HTMLElement>('.nav-menu-item'));
  let open = false;
  let timeline: gsap.core.Timeline | null = null;

  /**
   * The menu has to fit the viewport whatever the screen. Size it from the
   * viewport first, then shrink everything proportionally if it still overflows.
   */
  const fit = () => {
    const phone = window.matchMedia('(max-width: 700px)').matches;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let itemSize = phone
      ? clamp(Math.min(vw * 0.073, vh * 0.048), 24, 38)
      : clamp(Math.min(vw * 0.044, vh * 0.054), 30, 52);
    let padY = phone ? clamp(vh * 0.0105, 8, 11) : clamp(vh * 0.0125, 10, 14);
    let gap = phone ? clamp(vw * 0.004, 3, 6) : clamp(vw * 0.005, 4, 8);
    let pad = phone ? clamp(vw * 0.03, 12, 18) : clamp(vw * 0.02, 15, 24);

    const write = () => {
      menu.style.setProperty('--nav-item-size', `${itemSize.toFixed(2)}px`);
      menu.style.setProperty('--nav-item-pad-y', `${padY.toFixed(2)}px`);
      menu.style.setProperty('--nav-menu-gap', `${gap.toFixed(2)}px`);
      menu.style.setProperty('--nav-menu-pad', `${pad.toFixed(2)}px`);
    };
    write();

    const menuTop = menu.getBoundingClientRect().top;
    const available = Math.max(220, window.innerHeight - menuTop - 14);
    const natural = Math.ceil(menu.scrollHeight);
    if (natural <= available) return;

    const factor = clamp(available / Math.max(1, natural), 0.7, 1);
    itemSize = Math.max(phone ? 19 : 22, itemSize * factor);
    padY = Math.max(phone ? 5 : 6, padY * factor);
    gap = Math.max(2, gap * factor);
    pad = Math.max(8, pad * factor);
    write();
  };

  const finishClose = () => {
    menu.hidden = true;
    backdrop.hidden = true;
    open = false;
    timeline = null;
  };

  const close = (immediate = false) => {
    if (!open && menu.hidden) return;
    hamburger.setAttribute('aria-expanded', 'false');
    timeline?.kill();

    if (immediate) {
      finishClose();
      gsap.set([menu, backdrop, list, ...items, ...prelayers], {
        clearProps: 'opacity,visibility,transform',
      });
      return;
    }

    timeline = gsap
      .timeline({ defaults: { overwrite: 'auto' }, onComplete: finishClose })
      .to(items, {
        autoAlpha: 0,
        y: 12,
        duration: 0.16,
        stagger: { each: 0.035, from: 'end' },
        ease: 'power2.in',
      }, 0)
      .to(list, { xPercent: 102, duration: 0.34, ease: 'power3.in' }, 0.02)
      .to(prelayers, { xPercent: 102, duration: 0.4, ease: 'power3.in', stagger: 0.06 }, 0.06)
      .to(backdrop, { autoAlpha: 0, duration: 0.24, ease: 'power2.in' }, 0);
  };

  const openMenu = () => {
    if (open) return;
    timeline?.kill();
    menu.hidden = false;
    backdrop.hidden = false;
    hamburger.setAttribute('aria-expanded', 'true');
    open = true;
    fit();

    gsap.set(backdrop, { autoAlpha: 0 });
    gsap.set(prelayers, { xPercent: 102 });
    gsap.set(list, { xPercent: 102 });
    gsap.set(items, { autoAlpha: 0, y: 18 });

    timeline = gsap
      .timeline({ defaults: { overwrite: 'auto' }, onComplete: () => (timeline = null) })
      .to(backdrop, { autoAlpha: 1, duration: 0.22, ease: 'power2.out' }, 0)
      .to(prelayers, { xPercent: 0, duration: 0.44, ease: 'power3.out', stagger: 0.07 }, 0)
      .to(list, { xPercent: 0, duration: 0.48, ease: 'power4.out' }, 0.12)
      .to(items, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.045, ease: 'power3.out' }, 0.24);
  };

  hamburger.addEventListener('click', () => (menu.hidden || !open ? openMenu() : close()));

  for (const item of items) {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-scroll-target');
      close(true);
      if (target) scrollToSection(target);
    });
  }

  backdrop.addEventListener('click', () => close());

  document.addEventListener('click', (e) => {
    if (!menu.hidden && !nav.contains(e.target as Node)) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  window.addEventListener(
    'resize',
    rafThrottle(() => {
      if (!menu.hidden || open) fit();
    })
  );

  document
    .querySelector<HTMLButtonElement>('[data-scroll-top]')
    ?.addEventListener('click', () => animateSnapTo(0));

  close(true);
}

/**
 * Flips the nav to its dark treatment whenever a light-grounded section sits
 * behind it. Cheaper and more reliable than an IntersectionObserver here, because
 * the nav overlaps a scrolling container rather than the document.
 */
export function initNavToneObserver() {
  const nav = document.querySelector<HTMLElement>('.site-nav');
  const lightSections = document.querySelectorAll<HTMLElement>('[data-nav-tone="dark"]');
  if (!nav || !lightSections.length) return;

  const scroller = document.querySelector<HTMLElement>('.snap-stack');

  const update = rafThrottle(() => {
    const navRect = nav.getBoundingClientRect();
    let onLight = false;
    lightSections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.bottom > navRect.top && rect.top < navRect.bottom) onLight = true;
    });
    nav.classList.toggle('on-light', onLight);
    /*
     * The bar is transparent so it can float over the hero canvas. Once the page
     * scrolls, content passes visibly underneath the logo, so give it a frosted
     * backing from that point on.
     */
    nav.classList.toggle('is-stuck', (scroller?.scrollTop ?? window.scrollY) > 40);
  });

  (scroller ?? window).addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}
