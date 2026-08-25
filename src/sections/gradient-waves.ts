import {
  BufferAttribute,
  BufferGeometry,
  GLSL3,
  Mesh,
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

import { getScroller, prefersReducedMotion } from '../lib/utils';

/**
 * Raymarched wave field for the contact section.
 *
 * Ported from the ogl component; the shader is unchanged apart from being fed
 * this site's palette. Unlike the strands this one paints colour rather than
 * adding light, so it covers whatever is behind it and works on any ground.
 */

const VERT = /* glsl */ `
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed, uAmplitude, uWaveScale, uWaveRatio, uSwell, uTurbulence;
uniform float uTilt, uZoom, uHeight, uFogDepth, uSteps, uBrightness, uOpacity;
uniform float uGrain, uGrainIntensity, uParallax;
uniform vec2 uMouse;
uniform bool uEnableMouse;
uniform vec3 uHorizonColor, uWaveColor, uCrestColor;
out vec4 fragColor;

const float MAX_DIST = 20000.0;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float plasma(vec3 r, vec2 freq, vec4 tc) {
  float mx = r.x + tc.x;
  mx += uSwell * sin((r.y + mx) / 20.0 + tc.y);
  float my = r.y - tc.z;
  my += uTurbulence * cos(r.x / 23.0 + tc.w);
  return r.z - (sin(mx * freq.x) * uAmplitude + sin(my * freq.y) * uAmplitude + uHeight);
}

float raymarch(vec3 pos, vec3 dir, vec2 freq, vec4 tc) {
  float dist = 0.0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float dscene = plasma(pos + dist * dir, freq, tc);
    if (abs(dscene) < 0.1) break;
    dist += 0.9 * dscene;
    if (!(abs(dist) < MAX_DIST)) return MAX_DIST;
  }
  return dist;
}

void main() {
  float T = iTime * uSpeed;
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(T / 0.130, T / 0.810, T / 0.200, T / 0.710);
  float c, s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, 30.0);
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
  uv.x *= iResolution.x / iResolution.y;
  uv.y *= -1.0;

  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot); s = sin(xrot);
  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  c = nuv.x; s = nuv.y;
  dir = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0) * dir;
  c = cos(uTilt); s = sin(uTilt);
  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;

  if (uEnableMouse) {
    float yaw = (uMouse.x - 0.5) * uParallax * 0.4;
    float pitch = (uMouse.y - 0.5) * uParallax * 0.4;
    c = cos(yaw); s = sin(yaw);
    dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;
    c = cos(pitch); s = sin(pitch);
    dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  }

  float dist = raymarch(cam, dir, freq, tc);
  vec3 pos = cam + dist * dir;

  float t = clamp(uFogDepth / max(dist, 0.001), 0.0, 1.0);
  vec3 body = mix(uWaveColor, uCrestColor, clamp(pos.z * 0.08 + 0.5, 0.0, 1.0));
  vec3 col = mix(uHorizonColor, body, t);
  col *= uBrightness;
  col = clamp(col, 0.0, 1.0);

  float alpha = clamp(t, 0.0, 1.0) * uOpacity;
  if (uGrain > 0.5) {
    float g = hash21(gl_FragCoord.xy + mod(iTime, 64.0) * 11.0);
    alpha += (g - 0.5) * uGrainIntensity;
  }
  alpha = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(col * alpha, alpha);
}
`;

const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  return new Vector3(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  );
};

type Options = {
  horizonColor?: string;
  waveColor?: string;
  crestColor?: string;
  speed?: number;
  opacity?: number;
  brightness?: number;
};

export function initGradientWaves(host: HTMLElement | null, opts: Options = {}) {
  if (!host) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'waves-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true });
  } catch {
    canvas.remove();
    return;
  }
  renderer.setClearColor(0x000000, 0);

  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new Vector2(1, 1) },
    uSpeed: { value: opts.speed ?? 0.4 },
    uAmplitude: { value: 2.5 },
    uWaveScale: { value: 0.6 },
    uWaveRatio: { value: 0.9 },
    uSwell: { value: 35 },
    uTurbulence: { value: 20 },
    uTilt: { value: 1.11 },
    uZoom: { value: 1 },
    uHeight: { value: 5.5 },
    uFogDepth: { value: 15 },
    uSteps: { value: 70 },
    uBrightness: { value: opts.brightness ?? 1 },
    uOpacity: { value: opts.opacity ?? 1 },
    uGrain: { value: 1 },
    uGrainIntensity: { value: 0.05 },
    uParallax: { value: 0.5 },
    uMouse: { value: new Vector2(0.5, 0.5) },
    uEnableMouse: { value: true },
    uHorizonColor: { value: rgb(opts.horizonColor ?? '#1E0209') },
    uWaveColor: { value: rgb(opts.waveColor ?? '#670626') },
    uCrestColor: { value: rgb(opts.crestColor ?? '#BAD797') },
  };

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
  );

  const scene = new Scene();
  scene.add(
    new Mesh(
      geometry,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
    )
  );
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const size = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    uniforms.iResolution.value.set(w * ratio, h * ratio);
  };
  size();

  const still = prefersReducedMotion();
  uniforms.uEnableMouse.value = !still;

  const target = { x: 0.5, y: 0.5 };
  host.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    target.x = (e.clientX - r.left) / r.width;
    target.y = 1 - (e.clientY - r.top) / r.height;
  });
  host.addEventListener('pointerleave', () => {
    target.x = 0.5;
    target.y = 0.5;
  });

  let raf = 0;
  let visible = false;
  const t0 = performance.now();

  const render = (t: number) => {
    uniforms.iTime.value = (t - t0) * 0.001;
    const m = uniforms.uMouse.value;
    m.x += 0.05 * (target.x - m.x);
    m.y += 0.05 * (target.y - m.y);
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

  render(performance.now());

  new ResizeObserver(() => {
    size();
    if (!raf) render(performance.now());
  }).observe(host);

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
