import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearSRGBColorSpace,
  LoadingManager,
  Mesh,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Texture,
  TextureLoader,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import gsap from 'gsap';

import { compositeFrag, baseVert, maskFromVelocityFrag, trailFrag } from './shaders';
import { FluidSimulation } from './fluid';
import { clamp, prefersReducedMotion } from '../lib/utils';

/** Tuning constants, lifted verbatim from the build spec. */
const PARAMS = {
  fluidDt: 0.014,
  fluidResolution: 0.6,
  fluidFilmNoiseStrength: 0.72,
  decay: 0.94,
  velocityStrength: 0.58,
  velocityThreshold: 0.038,
  maskSmoothRadius: 48,
  centreGapRadius: 0.88,
  centreGapStrength: 0.96,
  revealThresholdLow: 0.02,
  revealThresholdHigh: 0.08,
  mouseGapRadius: 0.18,
  mouseGapStrength: 0.88,
  trailDecay: 0.91,
  trailRadius: 0.14,
  trailStrength: 0.85,
  trailMaskStrength: 0.88,
  maskRTScale: 0.75,
};

const SWIPE_VELOCITY_THRESHOLD = 1200;

let canvas: HTMLCanvasElement | null = null;
let renderer: WebGLRenderer | null = null;
let camera: OrthographicCamera;
let scene: Scene;
let quad: Mesh;

let maskMaterial: ShaderMaterial;
let trailMaterial: ShaderMaterial;
let compositeMaterial: ShaderMaterial;

let maskA: WebGLRenderTarget, maskB: WebGLRenderTarget;
let trailA: WebGLRenderTarget, trailB: WebGLRenderTarget;
let fluid: FluidSimulation | null = null;

let pointerTarget = { x: -1, y: -1 };
let pointerSmoothed = { x: 0.5, y: 0.5 };
let lastPointer = { x: 0.5, y: 0.5 };
let pointerOver = false;
let lastPointerTime = 0;
let lastClientX = 0;
let lastClientY = 0;

let resetRequested = false;
let lastTime = 0;
let running = false;
let heroInView = true;
let externallyPaused = false;

/* Phones pay for the fluid sim in battery and heat, so cap them below desktop. */
const getPixelRatio = () =>
  Math.min(window.innerWidth <= 900 ? 1.5 : 2, window.devicePixelRatio || 1);

/* ------------------------------------------------------------------ setup */

function makeRT(width: number, height: number) {
  return new WebGLRenderTarget(width, height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    format: RGBAFormat,
    type: UnsignedByteType,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

function createRenderTargets(pixelWidth: number, pixelHeight: number) {
  maskA?.dispose();
  maskB?.dispose();
  trailA?.dispose();
  trailB?.dispose();

  const scale = clamp(PARAMS.maskRTScale, 0.5, 1);
  const w = Math.max(1, Math.floor(pixelWidth * scale));
  const h = Math.max(1, Math.floor(pixelHeight * scale));

  maskA = makeRT(w, h);
  maskB = makeRT(w, h);
  trailA = makeRT(w, h);
  trailB = makeRT(w, h);
}

function resize() {
  if (!canvas || !renderer || !compositeMaterial || !fluid) return;

  const ratio = getPixelRatio();
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;

  renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, false);
  createRenderTargets(width * ratio, height * ratio);

  compositeMaterial.uniforms.uResolution.value.set(width * ratio, height * ratio);
  maskMaterial.uniforms.uPixelSize.value.set(1 / maskA.width, 1 / maskA.height);
  maskMaterial.uniforms.uAspect.value = width / height;
  trailMaterial.uniforms.uAspect.value = width / height;

  /*
   * The figure sits at about 66% across the frame, leaving the left clear for the
   * headline. Cover-fit crops toward the centre, so the narrower the viewport the
   * further right the sampling window has to pan to keep her in shot: at 375px it
   * only shows 37-63% of the image width, which would miss her entirely.
   */
  if (width <= 700) compositeMaterial.uniforms.uPan.value.set(0.19, 0);
  else if (width <= 1200) compositeMaterial.uniforms.uPan.value.set(0.11, 0);
  else compositeMaterial.uniforms.uPan.value.set(0, 0);

  fluid.resize(maskA.width, maskA.height);
  resetRequested = true;
}

/* ---------------------------------------------------------------- pointer */

function uvFromPointer(clientX: number, clientY: number) {
  const rect = canvas!.getBoundingClientRect();
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp(1 - (clientY - rect.top) / rect.height, 0, 1),
  };
}

function onPointerDown(e: PointerEvent) {
  pointerOver = true;
  lastClientX = e.clientX;
  lastClientY = e.clientY;
  const uv = uvFromPointer(e.clientX, e.clientY);
  pointerTarget = uv;
  pointerSmoothed = { ...uv };
  lastPointer = { ...uv };
  lastPointerTime = performance.now() / 1000;
}

function onPointerMove(e: PointerEvent) {
  pointerOver = true;
  const now = performance.now() / 1000;
  const dt = Math.min(0.1, now - lastPointerTime);

  // On touch, only let the page scroll through when the gesture is a decisive
  // upward swipe, otherwise the canvas keeps the gesture and paints with it.
  if (e.pointerType === 'touch' && dt > 0) {
    const dx = e.clientX - lastClientX;
    const dy = e.clientY - lastClientY;
    const speed = Math.hypot(dx, dy) / dt;
    const upward = dy < 0;
    if (!(speed >= SWIPE_VELOCITY_THRESHOLD && upward)) e.preventDefault();
  }

  lastClientX = e.clientX;
  lastClientY = e.clientY;
  pointerTarget = uvFromPointer(e.clientX, e.clientY);
  lastPointerTime = now;
}

function onPointerLeave() {
  pointerOver = false;
  pointerTarget = { x: -1, y: -1 };
}

/* ------------------------------------------------------------- fallbacks */

function showStaticHeroFallback() {
  running = false;
  if (!canvas) return;
  const img = document.createElement('img');
  img.src = '/front.jpg';
  img.alt = '';
  img.className = 'hero-static-fallback';
  canvas.replaceWith(img);
  canvas = null;
}

function hideLoader(loading: HTMLElement | null) {
  if (loading && !loading.classList.contains('is-hidden')) loading.classList.add('is-hidden');
}

/* ---------------------------------------------------------------- render */

function frame(now: number) {
  if (!running || !renderer || !fluid || !canvas) return;
  requestAnimationFrame(frame);

  if (!heroInView || externallyPaused) return;

  const time = now / 1000;
  const dt = lastTime ? Math.min(0.05, time - lastTime) : 0.016;
  lastTime = time;

  // ease the pointer so fast flicks still trace a continuous line
  if (pointerTarget.x >= 0) {
    pointerSmoothed.x += (pointerTarget.x - pointerSmoothed.x) * 0.35;
    pointerSmoothed.y += (pointerTarget.y - pointerSmoothed.y) * 0.35;

    const dx = (pointerSmoothed.x - lastPointer.x) * 900;
    const dy = (pointerSmoothed.y - lastPointer.y) * 900;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      fluid.splat(pointerSmoothed.x, pointerSmoothed.y, dx, dy, 0.0006);
    }
    lastPointer = { ...pointerSmoothed };
  }

  fluid.step(time);

  const reset = resetRequested ? 1 : 0;

  // trail pass
  trailMaterial.uniforms.uPrevTrail.value = trailA.texture;
  trailMaterial.uniforms.uMouseUV.value.set(
    pointerOver ? pointerSmoothed.x : -1,
    pointerOver ? pointerSmoothed.y : -1
  );
  trailMaterial.uniforms.uReset.value = reset;
  quad.material = trailMaterial;
  renderer.setRenderTarget(trailB);
  renderer.render(scene, camera);

  // mask pass
  maskMaterial.uniforms.uVelocity.value = fluid.getVelocityTexture();
  maskMaterial.uniforms.uPrevMask.value = maskA.texture;
  maskMaterial.uniforms.uTrail.value = trailB.texture;
  maskMaterial.uniforms.uMouseUV.value.copy(trailMaterial.uniforms.uMouseUV.value);
  maskMaterial.uniforms.uReset.value = reset;
  quad.material = maskMaterial;
  renderer.setRenderTarget(maskB);
  renderer.render(scene, camera);

  // composite to screen
  compositeMaterial.uniforms.uMask.value = maskB.texture;
  quad.material = compositeMaterial;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  // ping-pong
  [maskA, maskB] = [maskB, maskA];
  [trailA, trailB] = [trailB, trailA];
  resetRequested = false;

  void dt;
}

/* ------------------------------------------------------------------ init */

export async function initHero() {
  canvas = document.getElementById('hero-canvas') as HTMLCanvasElement | null;
  const loading = document.getElementById('loading');
  const counter = loading?.querySelector('.loading-counter') as HTMLElement | null;

  let shown = 0;
  const tweenTo = (target: number) => {
    gsap.to(
      { val: shown },
      {
        val: target,
        duration: 1.2,
        ease: 'power2.out',
        onUpdate() {
          shown = (this.targets()[0] as { val: number }).val;
          if (counter) counter.textContent = `${Math.round(shown)}%`;
        },
      }
    );
  };

  const manager = new LoadingManager();
  manager.onProgress = (_url, loaded, total) => tweenTo((loaded / total) * 100);
  manager.onLoad = () => {
    tweenTo(100);
    setTimeout(() => hideLoader(loading), 1500);
  };

  if (!canvas) {
    hideLoader(loading);
    return;
  }

  // A static hero is the right answer for reduced-motion and for missing WebGL.
  if (prefersReducedMotion()) {
    showStaticHeroFallback();
    setTimeout(() => hideLoader(loading), 400);
    return;
  }

  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    showStaticHeroFallback();
    hideLoader(loading);
    return;
  }

  const ratio = getPixelRatio();
  renderer.setPixelRatio(ratio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = NoToneMapping;

  camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1);
  scene = new Scene();
  quad = new Mesh(new PlaneGeometry(2, 2));
  scene.add(quad);

  const loader = new TextureLoader(manager);
  const load = (url: string) =>
    new Promise<Texture>((resolve, reject) => {
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = SRGBColorSpace;
          tex.minFilter = LinearFilter;
          tex.magFilter = LinearFilter;
          tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
          resolve(tex);
        },
        undefined,
        reject
      );
    });

  let texA: Texture, texB: Texture;
  try {
    [texA, texB] = await Promise.all([load('/front.jpg'), load('/back.jpg')]);
  } catch {
    showStaticHeroFallback();
    hideLoader(loading);
    return;
  }

  createRenderTargets(canvas.clientWidth * ratio, canvas.clientHeight * ratio);

  fluid = new FluidSimulation(renderer, maskA.width, maskA.height, {
    dt: PARAMS.fluidDt,
    resolution: PARAMS.fluidResolution,
    filmNoiseStrength: PARAMS.fluidFilmNoiseStrength,
    bfecc: true,
  });

  trailMaterial = new ShaderMaterial({
    vertexShader: baseVert,
    fragmentShader: trailFrag,
    uniforms: {
      uPrevTrail: { value: trailA.texture },
      uMouseUV: { value: new Vector2(-1, -1) },
      uTrailDecay: { value: PARAMS.trailDecay },
      uTrailRadius: { value: PARAMS.trailRadius },
      uTrailStrength: { value: PARAMS.trailStrength },
      uAspect: { value: 1 },
      uReset: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });

  maskMaterial = new ShaderMaterial({
    vertexShader: baseVert,
    fragmentShader: maskFromVelocityFrag,
    uniforms: {
      uVelocity: { value: null },
      uPrevMask: { value: maskA.texture },
      uTrail: { value: trailA.texture },
      uPixelSize: { value: new Vector2(1 / maskA.width, 1 / maskA.height) },
      uMouseUV: { value: new Vector2(-1, -1) },
      uDecay: { value: PARAMS.decay },
      uVelocityStrength: { value: PARAMS.velocityStrength },
      uVelocityThreshold: { value: PARAMS.velocityThreshold },
      uMaskSmoothRadius: { value: PARAMS.maskSmoothRadius },
      uTrailMaskStrength: { value: PARAMS.trailMaskStrength },
      uMouseGapRadius: { value: PARAMS.mouseGapRadius },
      uMouseGapStrength: { value: PARAMS.mouseGapStrength },
      uCentreGapRadius: { value: PARAMS.centreGapRadius },
      uCentreGapStrength: { value: PARAMS.centreGapStrength },
      uAspect: { value: 1 },
      uReset: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });

  compositeMaterial = new ShaderMaterial({
    vertexShader: baseVert,
    fragmentShader: compositeFrag,
    uniforms: {
      uImageA: { value: texA },
      uImageB: { value: texB },
      uMask: { value: maskA.texture },
      uResolution: { value: new Vector2(1, 1) },
      uImageSizeA: { value: new Vector2(texA.image.width, texA.image.height) },
      uImageSizeB: { value: new Vector2(texB.image.width, texB.image.height) },
      uPan: { value: new Vector2(0, 0) },
      uRevealThresholdLow: { value: PARAMS.revealThresholdLow },
      uRevealThresholdHigh: { value: PARAMS.revealThresholdHigh },
    },
    depthTest: false,
    depthWrite: false,
  });

  resize();
  window.addEventListener('resize', resize);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showStaticHeroFallback();
  });

  canvas.addEventListener('pointerenter', () => (pointerOver = true));
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') onPointerLeave();
  });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointercancel', onPointerLeave);

  running = true;
  requestAnimationFrame(frame);

  // Belt and braces: never leave the visitor staring at the preloader.
  setTimeout(() => hideLoader(loading), 6000);
}

export function setHeroInView(value: boolean) {
  heroInView = value;
}

export function setHeroPaused(value: boolean) {
  externallyPaused = value;
}

/**
 * Sizes the hand-drawn stroke that sits under the stressed word in the headline.
 * Measured from live rects so it survives font loading and every breakpoint.
 */
export function initHeadingStroke() {
  const word = document.querySelector<HTMLElement>('.resilient-word');
  const stroke = document.querySelector<HTMLElement>('.cycling-stroke');
  const line = document.querySelector<HTMLElement>('.hero-heading-second');
  const hero = document.querySelector<HTMLElement>('.hero');
  if (!word || !stroke || !line || !hero) return;

  const update = () => {
    const wordRect = word.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();

    stroke.style.left = `${lineRect.left - heroRect.left}px`;
    stroke.style.width = `${wordRect.right - lineRect.left}px`;
    stroke.style.top = `${lineRect.top - heroRect.top + lineRect.height * 0.6}px`;
    stroke.style.height = `${lineRect.height * 0.4}px`;
  };

  requestAnimationFrame(update);
  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  document.fonts?.ready.then(update);
}
