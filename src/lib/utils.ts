export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The page scrolls inside .snap-stack, not the window — every ScrollTrigger needs this. */
export const getScroller = (): HTMLElement | undefined =>
  (document.querySelector('.snap-stack') as HTMLElement | null) ?? undefined;

/** Collapse bursts of events into one call per animation frame. */
export function rafThrottle<T extends (...args: never[]) => void>(fn: T): T {
  let queued = 0;
  return ((...args: Parameters<T>) => {
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      fn(...args);
    });
  }) as T;
}

/**
 * Wraps every word of an element in <span class="reveal-word">, preserving inline
 * markup like <span class="weight-medium">. Returns the word spans in document order.
 */
export function wrapWords(root: HTMLElement): HTMLSpanElement[] {
  const words: HTMLSpanElement[] = [];
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (!text.trim()) continue;
        const frag = document.createDocumentFragment();
        const parts = text.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            const span = document.createElement('span');
            span.className = 'reveal-word';
            span.textContent = part;
            frag.appendChild(span);
            words.push(span);
          }
        }
        child.parentNode?.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    }
  };
  walk(root);
  return words;
}

/** Splits text into per-character spans once, flagged so it never re-splits. */
export function splitLetters(el: HTMLElement, className: string): HTMLSpanElement[] {
  if (el.dataset.splitLetters === 'true') {
    return Array.from(el.querySelectorAll<HTMLSpanElement>(`.${className}`));
  }
  const source = el.textContent ?? '';
  el.textContent = '';
  const frag = document.createDocumentFragment();
  const letters: HTMLSpanElement[] = [];
  for (const ch of Array.from(source)) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = ch === ' ' ? ' ' : ch;
    frag.appendChild(span);
    letters.push(span);
  }
  el.appendChild(frag);
  el.dataset.splitLetters = 'true';
  return letters;
}

/** Keeps --vvh in sync with the real visual viewport so mobile URL bars don't jump the layout. */
export function initViewportHeight() {
  const apply = () => {
    const h = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--vvh', `${h}px`);
  };
  apply();
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
}
