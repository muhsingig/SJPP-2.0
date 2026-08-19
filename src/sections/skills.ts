import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getScroller, prefersReducedMotion, splitLetters } from '../lib/utils';

gsap.registerPlugin(ScrollTrigger);

/**
 * Section titles animate letter by letter. Split once, flagged so resizes and
 * re-entries never re-split into nested spans.
 */
export function revealTitleByLetter(title: HTMLElement | null, section: HTMLElement, cls: string) {
  if (!title) return;

  // Titles set on more than one line wrap each line in its own span, split those
  // individually so the line breaks survive.
  const lines = Array.from(title.querySelectorAll<HTMLElement>(':scope > span'));
  const letters = lines.length
    ? lines.flatMap((line) => splitLetters(line, cls))
    : splitLetters(title, cls);
  const targets = letters.length ? letters : [title];

  if (prefersReducedMotion()) {
    gsap.set(targets, { opacity: 1, y: 0, clearProps: 'transform' });
    return;
  }

  gsap.set(targets, { y: 10, opacity: 0 });
  gsap
    .timeline({
      scrollTrigger: {
        trigger: section,
        scroller: getScroller(),
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
    })
    .to(targets, {
      y: 0,
      opacity: 1,
      duration: 0.7,
      ease: 'power1.out',
      stagger: letters.length ? 0.02 : 0,
    });
}

/**
 * Loads a Lottie into each icon slot when one is available, leaving the inline
 * SVG in place as the fallback. Lottie is imported lazily so it never blocks
 * first paint for a decoration.
 */
/**
 * A 200 is not proof the file exists: dev servers and SPA hosts happily rewrite
 * an unknown /icon.json to index.html. So parse the body and check it actually
 * looks like a Bodymovin document before handing anything to lottie-web.
 */
async function loadLottieData(name: string): Promise<object | null> {
  try {
    const res = await fetch(`/${name}`);
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
    const data = await res.json();
    return data && typeof data === 'object' && 'layers' in data ? (data as object) : null;
  } catch {
    return null;
  }
}

async function initSkillLotties() {
  const icons = Array.from(document.querySelectorAll<HTMLElement>('.skill-icon[data-lottie]'));
  if (!icons.length || prefersReducedMotion()) return;

  const resolved = await Promise.all(
    icons.map(async (icon) => {
      const name = icon.dataset.lottie;
      if (!name) return null;
      const data = await loadLottieData(name);
      return data ? { icon, data } : null;
    })
  );

  const usable = resolved.filter((r): r is { icon: HTMLElement; data: object } => r !== null);
  // No animations shipped yet, the inline SVGs stay, and lottie-web is never fetched.
  if (!usable.length) return;

  const lottie = (await import('lottie-web')).default;
  const byIcon = new Map(usable.map(({ icon, data }) => [icon, data]));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const icon = entry.target as HTMLElement;
        const animationData = byIcon.get(icon);
        if (!animationData) return;
        observer.unobserve(icon);
        icon.innerHTML = '';
        lottie.loadAnimation({
          container: icon,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          animationData,
        });
      });
    },
    { root: getScroller() ?? null, threshold: 0.4 }
  );

  usable.forEach(({ icon }) => observer.observe(icon));
}

export function initSkills() {
  const section = document.querySelector<HTMLElement>('.skills-section');
  if (!section) return;

  revealTitleByLetter(section.querySelector('.skills-title'), section, 'skill-title-letter');

  const cards = Array.from(section.querySelectorAll<HTMLElement>('.skill-card'));
  if (cards.length) {
    if (prefersReducedMotion()) {
      gsap.set(cards, { opacity: 1, y: 0 });
    } else {
      gsap.set(cards, { y: 16, opacity: 0 });
      ScrollTrigger.batch(cards, {
        scroller: getScroller(),
        start: 'top 85%',
        onEnter: (batch) =>
          gsap.to(batch, { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', stagger: 0.08, overwrite: true }),
        onLeaveBack: (batch) =>
          gsap.to(batch, { y: 16, opacity: 0, duration: 0.4, ease: 'power2.in', overwrite: true }),
      });
    }
  }

  void initSkillLotties();
}
