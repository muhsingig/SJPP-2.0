import {
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';

import {
  advectionFrag,
  baseVert,
  divergenceFrag,
  gradientSubtractFrag,
  pressureFrag,
  splatFrag,
} from './shaders';

export interface FluidOptions {
  dt: number;
  resolution: number;
  filmNoiseStrength: number;
  bfecc: boolean;
  pressureIterations?: number;
  velocityDissipation?: number;
}

interface PingPong {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;
  swap(): void;
  dispose(): void;
}

function makeTarget(width: number, height: number, filter: typeof LinearFilter | typeof NearestFilter) {
  return new WebGLRenderTarget(width, height, {
    minFilter: filter,
    magFilter: filter,
    format: RGBAFormat,
    type: HalfFloatType,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

function makePingPong(width: number, height: number, filter: typeof LinearFilter | typeof NearestFilter): PingPong {
  const state = {
    read: makeTarget(width, height, filter),
    write: makeTarget(width, height, filter),
    swap() {
      const t = state.read;
      state.read = state.write;
      state.write = t;
    },
    dispose() {
      state.read.dispose();
      state.write.dispose();
    },
  };
  return state;
}

/**
 * A compact Stam-style solver: advect, compute divergence, relax pressure with
 * Jacobi iterations, then subtract the pressure gradient to stay incompressible.
 * Only the velocity field is needed downstream, the hero mask reads it directly.
 */
export class FluidSimulation {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1);
  private quad: Mesh;

  private velocity!: PingPong;
  private pressure!: PingPong;
  private divergence!: WebGLRenderTarget;

  private advection: ShaderMaterial;
  private divergenceMat: ShaderMaterial;
  private pressureMat: ShaderMaterial;
  private gradientMat: ShaderMaterial;
  private splatMat: ShaderMaterial;

  private width = 1;
  private height = 1;
  private opts: Required<FluidOptions>;

  constructor(renderer: WebGLRenderer, width: number, height: number, opts: FluidOptions) {
    this.renderer = renderer;
    this.opts = {
      pressureIterations: 20,
      velocityDissipation: 0.985,
      ...opts,
    };

    const geometry = new PlaneGeometry(2, 2);
    this.quad = new Mesh(geometry);
    this.scene.add(this.quad);

    const texelSize = new Vector2(1, 1);

    this.advection = new ShaderMaterial({
      vertexShader: baseVert,
      fragmentShader: advectionFrag,
      uniforms: {
        uVelocity: { value: null },
        uSource: { value: null },
        uTexelSize: { value: texelSize.clone() },
        uDt: { value: opts.dt },
        uDissipation: { value: this.opts.velocityDissipation },
        uBFECC: { value: opts.bfecc ? 1 : 0 },
        uNoiseStrength: { value: opts.filmNoiseStrength },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.divergenceMat = new ShaderMaterial({
      vertexShader: baseVert,
      fragmentShader: divergenceFrag,
      uniforms: { uVelocity: { value: null }, uTexelSize: { value: texelSize.clone() } },
      depthTest: false,
      depthWrite: false,
    });

    this.pressureMat = new ShaderMaterial({
      vertexShader: baseVert,
      fragmentShader: pressureFrag,
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        uTexelSize: { value: texelSize.clone() },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.gradientMat = new ShaderMaterial({
      vertexShader: baseVert,
      fragmentShader: gradientSubtractFrag,
      uniforms: {
        uPressure: { value: null },
        uVelocity: { value: null },
        uTexelSize: { value: texelSize.clone() },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.splatMat = new ShaderMaterial({
      vertexShader: baseVert,
      fragmentShader: splatFrag,
      uniforms: {
        uTarget: { value: null },
        uAspect: { value: 1 },
        uPoint: { value: new Vector2(0.5, 0.5) },
        uColor: { value: new Vector3() },
        uRadius: { value: 0.0005 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.resize(width, height);
  }

  resize(width: number, height: number) {
    const w = Math.max(1, Math.floor(width * this.opts.resolution));
    const h = Math.max(1, Math.floor(height * this.opts.resolution));
    if (w === this.width && h === this.height && this.velocity) return;

    this.width = w;
    this.height = h;

    this.velocity?.dispose();
    this.pressure?.dispose();
    this.divergence?.dispose();

    this.velocity = makePingPong(w, h, LinearFilter);
    this.pressure = makePingPong(w, h, NearestFilter);
    this.divergence = makeTarget(w, h, NearestFilter);

    const texel = new Vector2(1 / w, 1 / h);
    this.advection.uniforms.uTexelSize.value = texel.clone();
    this.divergenceMat.uniforms.uTexelSize.value = texel.clone();
    this.pressureMat.uniforms.uTexelSize.value = texel.clone();
    this.gradientMat.uniforms.uTexelSize.value = texel.clone();
    this.splatMat.uniforms.uAspect.value = w / h;
  }

  private blit(material: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  /** Push momentum into the field at a uv point. */
  splat(u: number, v: number, dx: number, dy: number, radius: number) {
    this.splatMat.uniforms.uTarget.value = this.velocity.read.texture;
    this.splatMat.uniforms.uPoint.value.set(u, v);
    (this.splatMat.uniforms.uColor.value as Vector3).set(dx, dy, 0);
    this.splatMat.uniforms.uRadius.value = radius;
    this.blit(this.splatMat, this.velocity.write);
    this.velocity.swap();
  }

  step(time: number) {
    // advect velocity through itself
    this.advection.uniforms.uVelocity.value = this.velocity.read.texture;
    this.advection.uniforms.uSource.value = this.velocity.read.texture;
    this.advection.uniforms.uTime.value = time;
    this.blit(this.advection, this.velocity.write);
    this.velocity.swap();

    // divergence of the advected field
    this.divergenceMat.uniforms.uVelocity.value = this.velocity.read.texture;
    this.blit(this.divergenceMat, this.divergence);

    // relax pressure
    this.pressureMat.uniforms.uDivergence.value = this.divergence.texture;
    for (let i = 0; i < this.opts.pressureIterations; i++) {
      this.pressureMat.uniforms.uPressure.value = this.pressure.read.texture;
      this.blit(this.pressureMat, this.pressure.write);
      this.pressure.swap();
    }

    // project back to a divergence-free field
    this.gradientMat.uniforms.uPressure.value = this.pressure.read.texture;
    this.gradientMat.uniforms.uVelocity.value = this.velocity.read.texture;
    this.blit(this.gradientMat, this.velocity.write);
    this.velocity.swap();
  }

  getVelocityTexture() {
    return this.velocity.read.texture;
  }

  dispose() {
    this.velocity?.dispose();
    this.pressure?.dispose();
    this.divergence?.dispose();
    this.advection.dispose();
    this.divergenceMat.dispose();
    this.pressureMat.dispose();
    this.gradientMat.dispose();
    this.splatMat.dispose();
    this.quad.geometry.dispose();
  }
}
