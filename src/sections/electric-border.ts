import { getScroller, prefersReducedMotion } from '../lib/utils';

/**
 * Electric border: a rounded-rect outline traced around an element and pushed
 * about by layered value noise, so the line crawls like a live wire.
 *
 * Ported from the React component, same maths and the same tuning constants. The
 * differences are that it drives a plain element instead of JSX, and it stops
 * running when the portrait is off screen, since it is an unbroken rAF loop and
 * there is no reason to pay for it while nobody is looking.
 */

const OCTAVES = 10;
const LACUNARITY = 1.6;
const GAIN = 0.7;
const FREQUENCY = 10;
const BASE_FLATNESS = 0;
const DISPLACEMENT = 60;
/*
 * 16, not the component's 60. That figure assumes the default chaos of 0.12,
 * where the line is flung right out; at the 0.01 we run it strays 1-2px. The
 * extra margin was rendering a band of empty canvas on all four sides, which on
 * a phone made this the largest surface on the page, and pushed the profile
 * section wider than the viewport.
 */
const BORDER_OFFSET = 16;

type Options = {
  color?: string;
  speed?: number;
  chaos?: number;
  borderRadius?: number;
};

const random = (x: number) => (Math.sin(x * 12.9898) * 43758.5453) % 1;

function noise2D(x: number, y: number) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  const a = random(i + j * 57);
  const b = random(i + 1 + j * 57);
  const c = random(i + (j + 1) * 57);
  const d = random(i + 1 + (j + 1) * 57);

  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function octavedNoise(x: number, amplitude: number, time: number, seed: number) {
  let y = 0;
  let amp = amplitude;
  let freq = FREQUENCY;

  for (let i = 0; i < OCTAVES; i++) {
    const octaveAmplitude = i === 0 ? amp * BASE_FLATNESS : amp;
    y += octaveAmplitude * noise2D(freq * x + seed * 100, time * freq * 0.3);
    freq *= LACUNARITY;
    amp *= GAIN;
  }

  return y;
}

function cornerPoint(cx: number, cy: number, r: number, start: number, arc: number, t: number) {
  const angle = start + t * arc;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** Walks the perimeter of a rounded rectangle, t running 0 to 1. */
function roundedRectPoint(
  t: number,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number
) {
  const straightW = width - 2 * radius;
  const straightH = height - 2 * radius;
  const arc = (Math.PI * radius) / 2;
  const perimeter = 2 * straightW + 2 * straightH + 4 * arc;
  const distance = t * perimeter;
  let acc = 0;

  if (distance <= acc + straightW) {
    return { x: left + radius + ((distance - acc) / straightW) * straightW, y: top };
  }
  acc += straightW;

  if (distance <= acc + arc) {
    return cornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, (distance - acc) / arc);
  }
  acc += arc;

  if (distance <= acc + straightH) {
    return { x: left + width, y: top + radius + ((distance - acc) / straightH) * straightH };
  }
  acc += straightH;

  if (distance <= acc + arc) {
    return cornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, (distance - acc) / arc);
  }
  acc += arc;

  if (distance <= acc + straightW) {
    return { x: left + width - radius - ((distance - acc) / straightW) * straightW, y: top + height };
  }
  acc += straightW;

  if (distance <= acc + arc) {
    return cornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, (distance - acc) / arc);
  }
  acc += arc;

  if (distance <= acc + straightH) {
    return { x: left, y: top + height - radius - ((distance - acc) / straightH) * straightH };
  }
  acc += straightH;

  return cornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, (distance - acc) / arc);
}

export function initElectricBorder(target: HTMLElement | null, opts: Options = {}) {
  if (!target) return;

  const color = opts.color ?? '#670626';
  const speed = opts.speed ?? 1;
  const chaos = opts.chaos ?? 0.12;
  const borderRadius = opts.borderRadius ?? 24;

  target.classList.add('electric-border');
  target.style.setProperty('--electric-border-color', color);

  const layers = document.createElement('div');
  layers.className = 'eb-layers';
  layers.setAttribute('aria-hidden', 'true');
  layers.innerHTML =
    '<div class="eb-glow-1"></div><div class="eb-glow-2"></div><div class="eb-background-glow"></div>';

  const holder = document.createElement('div');
  holder.className = 'eb-canvas-container';
  holder.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.className = 'eb-canvas';
  holder.appendChild(canvas);

  // Behind the portrait, so the line reads as something around it, not over it.
  target.prepend(layers);
  target.prepend(holder);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // A still frame keeps the outline without the crawl.
  const still = prefersReducedMotion();

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let time = 0;
  let lastFrame = 0;
  let raf = 0;
  let visible = true;

  const size = () => {
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    width = rect.width + BORDER_OFFSET * 2;
    height = rect.height + BORDER_OFFSET * 2;
    // Decorative: a phone gains nothing from rendering this at dpr 2.
    dpr = window.innerWidth <= 900 ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    return true;
  };

  const draw = (now: number) => {
    const delta = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    if (!still) time += delta * speed;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const borderWidth = width - 2 * BORDER_OFFSET;
    const borderHeight = height - 2 * BORDER_OFFSET;
    if (borderWidth <= 0 || borderHeight <= 0) return;

    const radius = Math.min(borderRadius, Math.min(borderWidth, borderHeight) / 2);
    const perimeter = 2 * (borderWidth + borderHeight) + 2 * Math.PI * radius;
    const samples = Math.max(24, Math.floor(perimeter / 2));

    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = roundedRectPoint(t, BORDER_OFFSET, BORDER_OFFSET, borderWidth, borderHeight, radius);
      const nx = octavedNoise(t * 8, chaos, time, 0);
      const ny = octavedNoise(t * 8, chaos, time, 1);
      const x = p.x + nx * DISPLACEMENT;
      const y = p.y + ny * DISPLACEMENT;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  };

  const loop = (now: number) => {
    if (!visible || still) {
      raf = 0;
      return;
    }
    draw(now);
    raf = requestAnimationFrame(loop);
  };

  const start = () => {
    if (raf || still) return;
    lastFrame = 0;
    raf = requestAnimationFrame(loop);
  };

  const stop = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  if (!size()) return;
  draw(0);
  if (!still) start();

  /*
   * The element's own box is not the only thing that changes what this should
   * render at: crossing the 900px breakpoint changes the pixel ratio too, and a
   * ResizeObserver on the target never sees that on its own.
   */
  const resize = () => {
    if (size()) draw(performance.now());
  };

  new ResizeObserver(resize).observe(target);
  window.addEventListener('resize', resize);
  window.addEventListener('load', resize);

  // Only burn frames while the portrait is actually on screen.
  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      });
    },
    { root: getScroller() ?? null, threshold: 0 }
  ).observe(target);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });
}
