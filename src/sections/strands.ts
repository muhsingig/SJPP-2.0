import {
  BufferAttribute,
  BufferGeometry,
  GLSL3,
  Mesh,
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';

import { getScroller, prefersReducedMotion } from '../lib/utils';

/**
 * Strands: glowing filaments drifting behind a section.
 *
 * Ported from the ogl component, shader unchanged apart from being fed this
 * site's palette. Three is already a dependency for the hero, and the shader is
 * plain GLSL, so there was no reason to add a second WebGL library for it.
 */

const MAX_COLORS = 8;
const MAX_STRANDS = 12;

const VERT = /* glsl */ `
in vec3 position;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform int uStrandCount;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uHueShift;
uniform float uIntensity;
uniform float uOpacity;
uniform float uScale;
uniform float uSaturation;

out vec4 fragColor;

const float PI = 3.14159265;

vec3 samplePalette(float t) {
  t = fract(t);
  float scaled = t * float(uColorCount);
  int idx = int(floor(scaled));
  float blend = fract(scaled);
  int nextIdx = idx + 1;
  if (nextIdx >= uColorCount) nextIdx = 0;
  return mix(uColors[idx], uColors[nextIdx], blend);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  uv /= max(uScale, 0.0001);

  float e = 0.06 + uIntensity * 0.94;
  float env = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);

  vec3 col = vec3(0.0);

  for (int i = 0; i < ${MAX_STRANDS}; i++) {
    if (i >= uStrandCount) break;

    float fi = float(i);
    float ph = fi * 1.7 * uSpread;
    float freq = (2.0 + fi * 0.35) * uWaviness;
    float spd = 1.4 + fi * 1.2;

    float tt = uTime * uSpeed;
    float w = sin(uv.x * freq + tt * spd + ph) * 0.60
            + sin(uv.x * freq * 1.1 - tt * spd * 0.7 + ph * 1.7) * 0.40;

    float amp = (0.1 + 0.02 * e) * env * uAmplitude;
    float y = w * amp;

    float d = abs(uv.y - y);
    float thick = (0.001 + 0.05 * e) * (0.35 + env) * uThickness;
    float g = thick / (d + thick * 0.45);
    g = g * g;

    float h = fi / float(uStrandCount) + uv.x * 0.30 + uTime * 0.04 + uHueShift;
    col += samplePalette(h) * g * env;
  }

  col *= 0.45 + 0.7 * e;
  col = 1.0 - exp(-col * uGlow);

  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(gray), col, uSaturation), 0.0);

  float lum = max(max(col.r, col.g), col.b);
  float alpha = clamp(lum, 0.0, 1.0) * uOpacity;

  fragColor = vec4(col * uOpacity, alpha);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

type Options = {
  colors?: string[];
  count?: number;
  speed?: number;
  thickness?: number;
  glow?: number;
  intensity?: number;
  saturation?: number;
  opacity?: number;
  scale?: number;
};

export function initStrands(host: HTMLElement | null, opts: Options = {}) {
  if (!host) return;

  const colors = opts.colors ?? ['#BAD797', '#FBF8F1', '#8FA96A', '#8A1839'];

  const canvas = document.createElement('canvas');
  canvas.className = 'strands-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
  } catch {
    // No WebGL: the section simply keeps its flat background.
    canvas.remove();
    return;
  }
  renderer.setClearColor(0x000000, 0);

  const flat = new Float32Array(MAX_COLORS * 3);
  for (let i = 0; i < MAX_COLORS; i++) {
    const rgb = hexToRgb(colors[i] ?? colors[colors.length - 1]);
    flat.set(rgb, i * 3);
  }

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uColors: { value: flat },
    uColorCount: { value: Math.min(colors.length, MAX_COLORS) },
    uStrandCount: { value: Math.min(opts.count ?? 3, MAX_STRANDS) },
    uSpeed: { value: opts.speed ?? 0.5 },
    uAmplitude: { value: 1 },
    uWaviness: { value: 1 },
    uThickness: { value: opts.thickness ?? 0.7 },
    uGlow: { value: opts.glow ?? 2.6 },
    uTaper: { value: 3 },
    uSpread: { value: 1 },
    uHueShift: { value: 0 },
    uIntensity: { value: opts.intensity ?? 0.6 },
    uOpacity: { value: opts.opacity ?? 1 },
    uScale: { value: opts.scale ?? 1.5 },
    uSaturation: { value: opts.saturation ?? 1.5 },
  };

  // One oversized triangle rather than a quad: no seam down the diagonal.
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
  );

  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const size = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    // Bail on a collapsed box: sizing can run before layout has settled, and a
    // stale tiny value gets baked into the backing store and stretched.
    if (w < 2 || h < 2) return false;
    /*
     * These are decorative and full-section. At dpr 2 a phone renders four times
     * the pixels for no visible gain, so cap them at 1 there. The hero keeps its
     * higher ratio; it is the thing people actually look at.
     */
    const ratio = window.innerWidth <= 900 ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w * ratio, h * ratio);
    return true;
  };

  size();

  const still = prefersReducedMotion();
  let raf = 0;
  let visible = false;

  const render = (t: number) => {
    uniforms.uTime.value = t * 0.001;
    renderer.render(scene, camera);
  };

  const loop = (t: number) => {
    if (!visible || still) {
      raf = 0;
      return;
    }
    render(t);
    raf = requestAnimationFrame(loop);
  };

  const start = () => {
    if (raf || still) return;
    raf = requestAnimationFrame(loop);
  };

  const stop = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  render(0);

  /*
   * ResizeObserver alone was not enough: the first pass ran against a box that
   * had not laid out, leaving the backing store at a fraction of the display
   * size and the shader visibly stretched. Re-measure on resize and on load too.
   */
  const resize = () => {
    if (!size()) return;
    if (!raf) render(performance.now());
  };

  new ResizeObserver(resize).observe(host);
  window.addEventListener('resize', resize);
  window.addEventListener('load', resize);
  document.fonts?.ready.then(resize);

  // Another unbroken rAF loop, so only run it while the section is on screen.
  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      });
    },
    { root: getScroller() ?? null, threshold: 0 }
  ).observe(host);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });
}
