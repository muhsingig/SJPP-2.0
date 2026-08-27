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
  decay: 0.915,
  velocityStrength: 0.58,
  velocityThreshold: 0.038,
  maskSmoothRadius: 48,
  centreGapRadius: 0.88,
  centreGapStrength: 0.96,
  revealThresholdLow: 0.02,
  revealThresholdHigh: 0.08,
  mouseGapRadius: 0.055,
  mouseGapStrength: 0.88,
  trailDecay: 0.87,
  trailRadius: 0.042,
  trailStrength: 0.85,
  trailMaskStrength: 0.88,
  maskRTScale: 0.75,
};

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

let resetRequested = false;
let lastTime = 0;
let running = false;
let heroInView = true;
let externallyPaused = false;

/*
 * Full ratio on a phone, same as the reference, which renders its hero at the
 * device's own 2x. Capping this at 1.5 was saving very little (the simulation
 * grids are sized separately, below) and cost the one thing a phone shows most
 * of: the edge of the brush stroke, which went visibly stepped.
 */
const getPixelRatio = () => Math.min(2, window.devicePixelRatio || 1);

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

/*
 * The hero is sized in --vvh, which tracks the visual viewport, so its height
 * changes the moment a mobile URL bar collapses. That fires visualViewport's
 * resize, not window's, which iOS never raises for chrome changes: the CSS box
 * grew while the drawing buffer kept its old dimensions, so the composite
 * stretched vertically and the mask stopped lining up with the canvas, which is
 * what put horizontal smears down the side of the picture.
 *
 * Observing the canvas itself catches every cause at once. Guarding on the
 * pixel size keeps that cheap: resize() reallocates four render targets and
 * clears the mask, so it must not run on a no-op.
 */
let lastPixelW = 0;
let lastPixelH = 0;

function resize() {
  if (!canvas || !renderer || !compositeMaterial || !fluid) return;

  const ratio = getPixelRatio();
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  if (width < 1 || height < 1) return;

  const pixelW = Math.round(width * ratio);
  const pixelH = Math.round(height * ratio);
  if (pixelW === lastPixelW && pixelH === lastPixelH) return;
  lastPixelW = pixelW;
  lastPixelH = pixelH;

  renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, false);
  createRenderTargets(width * ratio, height * ratio);

  compositeMaterial.uniforms.uResolution.value.set(width * ratio, height * ratio);
  maskMaterial.uniforms.uPixelSize.value.set(1 / maskA.width, 1 / maskA.height);
  maskMaterial.uniforms.uAspect.value = width / height;
  trailMaterial.uniforms.uAspect.value = width / height;

  /*
   * The figure sits about 66% across the frame, leaving the left clear for the
   * headline, so the narrower the viewport the further right the sampling window
   * has to pan to keep her in shot.
   *
   * Vertically, cover-fit on a portrait viewport matches the image's height: the
   * whole frame is visible top to bottom and only the width is cropped. That
   * fixes her face at about 24% down the screen, which is exactly where the
   * tagline sits. Panning cannot help, because at zoom 1 there is nothing above
   * or below to pan into. Zooming past cover and pinning the sample window to
   * the image's top edge is what moves her clear of the type; panY below is the
   * offset that puts that window's top at 0, so it never samples past the image
   * and smears the edge.
   */
  if (width <= 700) {
    /*
     * 1.4 puts her eyes at 339px with the tagline ending at 306, so the type
     * sits on hair and sky rather than on her face. Going further clears more
     * but crops to a head-and-shoulders portrait and loses the terrace behind
     * her, which is the half of the photograph that carries the place.
     */
    const zoom = 1.4;
    compositeMaterial.uniforms.uZoom.value = zoom;
    compositeMaterial.uniforms.uPan.value.set(0.19, 0.5 / zoom - 0.5);
  } else if (width <= 1200) {
    compositeMaterial.uniforms.uZoom.value = 1;
    compositeMaterial.uniforms.uPan.value.set(0.11, 0);
  } else {
    compositeMaterial.uniforms.uZoom.value = 1;
    compositeMaterial.uniforms.uPan.value.set(0, 0);
  }

  /*
   * A finger is not a cursor. The stroke is tuned to a mouse pointer, and at
   * 4% of the screen it reads on a phone as a smudge under your thumb rather
   * than as a brush, which is why the effect looked like it was not running.
   */
  const touch = width <= 700 ? 2.1 : 1;
  trailMaterial.uniforms.uTrailRadius.value = PARAMS.trailRadius * touch;
  maskMaterial.uniforms.uMouseGapRadius.value = PARAMS.mouseGapRadius * touch;

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
  const uv = uvFromPointer(e.clientX, e.clientY);
  pointerTarget = uv;
  pointerSmoothed = { ...uv };
  lastPointer = { ...uv };
}

/*
 * The brush follows a finger but never takes the gesture. This used to call
 * preventDefault on any touch-move that was not a fast upward flick, which meant
 * an ordinary drag painted instead of scrolling and the hero felt stuck: the
 * page only moved if you swiped hard enough, and the stroke stuttered while the
 * browser waited to find out whether the listener would cancel the scroll.
 * Letting the gesture through costs nothing, since the stroke is painted from
 * the coordinates either way.
 */
function onPointerMove(e: PointerEvent) {
  pointerOver = true;
  pointerTarget = uvFromPointer(e.clientX, e.clientY);
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

  /*
   * Ease toward the pointer, but normalised against dt. A fixed per-frame lerp
   * ran twice as fast on a 120Hz screen as on a 60Hz one, so the brush lagged
   * by a different amount depending on the display.
   */
  if (pointerTarget.x >= 0) {
    const ease = 1 - Math.pow(0.001, dt);
    pointerSmoothed.x += (pointerTarget.x - pointerSmoothed.x) * ease;
    pointerSmoothed.y += (pointerTarget.y - pointerSmoothed.y) * ease;

    const dx = (pointerSmoothed.x - lastPointer.x) * 900;
    const dy = (pointerSmoothed.y - lastPointer.y) * 900;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      // Splat along the step rather than only at its end, so a fast drag pushes
      // a continuous line of momentum instead of a row of separate dabs.
      const steps = Math.min(6, 1 + Math.floor(Math.hypot(dx, dy) / 12));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        fluid.splat(
          lastPointer.x + (pointerSmoothed.x - lastPointer.x) * t,
          lastPointer.y + (pointerSmoothed.y - lastPointer.y) * t,
          dx / steps,
          dy / steps,
          0.00028
        );
      }
    }
    lastPointer = { ...pointerSmoothed };
  }

  fluid.step(time);

  const reset = resetRequested ? 1 : 0;

  // trail pass
  trailMaterial.uniforms.uPrevTrail.value = trailA.texture;
  // Last frame's point first: the shader strokes the segment between the two.
  trailMaterial.uniforms.uMousePrevUV.value.copy(trailMaterial.uniforms.uMouseUV.value);
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
      uMousePrevUV: { value: new Vector2(-1, -1) },
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
      uZoom: { value: 1 },
      uRevealThresholdLow: { value: PARAMS.revealThresholdLow },
      uRevealThresholdHigh: { value: PARAMS.revealThresholdHigh },
    },
    depthTest: false,
    depthWrite: false,
  });

  resize();

  /*
   * All three, because a URL bar sliding away raises a different one on each
   * platform. They are called directly rather than deferred to a frame: the
   * pixel-size guard already makes a duplicate free, and rAF does not run while
   * the tab is throttled, which is exactly when a viewport change lands.
   */
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  new ResizeObserver(() => resize()).observe(canvas);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showStaticHeroFallback();
  });

  canvas.addEventListener('pointerenter', () => (pointerOver = true));
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') onPointerLeave();
  });
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
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

    /*
     * Anchored to the hero's own left edge, not the text's, so the bar runs off
     * the side of the screen instead of starting neatly inside the margin. That
     * bleed is what makes it read as a marker stroke rather than an underline.
     */
    stroke.style.left = '0px';
    stroke.style.width = `${wordRect.right - heroRect.left}px`;
    stroke.style.top = `${lineRect.top - heroRect.top + lineRect.height * 0.59}px`;
    stroke.style.height = `${lineRect.height * 0.41}px`;
  };

  requestAnimationFrame(update);
  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  document.fonts?.ready.then(update);
}
