/**
 * GLSL for the hero. Four stages run per frame:
 *   1. fluid   , Navier-Stokes velocity field driven by the pointer
 *   2. trail   , soft accumulating blob under the cursor
 *   3. mask    , velocity + trail integrated into a decaying reveal mask
 *   4. composite- cover-fits both photographs and mixes A -> B through the mask
 */

/* PlaneGeometry(2,2) already spans clip space, so the vertex stage is a pass-through. */
export const baseVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/* ------------------------------------------------------------ fluid solver */

export const advectionFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform float uDt;
uniform float uDissipation;
uniform float uBFECC;
uniform float uNoiseStrength;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 vel = texture2D(uVelocity, vUv).xy;
  vec2 back = vUv - uDt * vel * uTexelSize;

  // BFECC: advect forward from the back-traced point and subtract half the error.
  vec2 fwd = back + uDt * texture2D(uVelocity, back).xy * uTexelSize;
  vec2 corrected = back - (fwd - vUv) * 0.5;
  vec2 coord = mix(back, corrected, uBFECC);

  vec4 result = texture2D(uSource, coord) * uDissipation;

  // A whisper of film grain keeps the field from settling into flat banding.
  float n = hash(vUv * 512.0 + uTime) - 0.5;
  result.xy += n * uNoiseStrength * 0.02;

  gl_FragColor = vec4(result.xyz, 1.0);
}
`;

export const divergenceFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;

void main() {
  float l = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
  float r = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
  float b = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
  float t = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
  float div = 0.5 * (r - l + t - b);
  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

export const pressureFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;

void main() {
  float l = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float r = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float b = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float t = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((l + r + b + t - div) * 0.25, 0.0, 0.0, 1.0);
}
`;

export const gradientSubtractFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;

void main() {
  float l = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float r = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float b = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float t = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  vec2 vel = texture2D(uVelocity, vUv).xy;
  vel -= vec2(r - l, t - b) * 0.5;
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
`;

export const splatFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;

void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.0);
}
`;

export const clearFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uValue;
void main() {
  gl_FragColor = texture2D(uTexture, vUv) * uValue;
}
`;

/* ------------------------------------------------------------------ trail */

export const trailFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPrevTrail;
uniform vec2 uMouseUV;
uniform float uTrailDecay;
uniform float uTrailRadius;
uniform float uTrailStrength;
uniform float uAspect;
uniform float uReset;

void main() {
  float prev = texture2D(uPrevTrail, vUv).r * uTrailDecay;

  float add = 0.0;
  if (uMouseUV.x >= 0.0) {
    vec2 d = vUv - uMouseUV;
    d.x *= uAspect;
    add = exp(-dot(d, d) / (uTrailRadius * uTrailRadius)) * uTrailStrength;
  }

  float v = clamp(prev + add, 0.0, 1.0) * (1.0 - uReset);
  gl_FragColor = vec4(v, v, v, 1.0);
}
`;

/* ------------------------------------------------------------------- mask */

export const maskFromVelocityFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uPrevMask;
uniform sampler2D uTrail;
uniform vec2 uPixelSize;
uniform vec2 uMouseUV;
uniform float uDecay;
uniform float uVelocityStrength;
uniform float uVelocityThreshold;
uniform float uMaskSmoothRadius;
uniform float uTrailMaskStrength;
uniform float uMouseGapRadius;
uniform float uMouseGapStrength;
uniform float uCentreGapRadius;
uniform float uCentreGapStrength;
uniform float uAspect;
uniform float uReset;

/* 9-tap blur standing in for a wide box blur, cheap and visually equivalent here. */
float blurredPrev(vec2 uv, vec2 off) {
  float s = texture2D(uPrevMask, uv).r * 0.25;
  s += texture2D(uPrevMask, uv + vec2(off.x, 0.0)).r * 0.125;
  s += texture2D(uPrevMask, uv - vec2(off.x, 0.0)).r * 0.125;
  s += texture2D(uPrevMask, uv + vec2(0.0, off.y)).r * 0.125;
  s += texture2D(uPrevMask, uv - vec2(0.0, off.y)).r * 0.125;
  s += texture2D(uPrevMask, uv + off).r * 0.0625;
  s += texture2D(uPrevMask, uv - off).r * 0.0625;
  s += texture2D(uPrevMask, uv + vec2(off.x, -off.y)).r * 0.0625;
  s += texture2D(uPrevMask, uv + vec2(-off.x, off.y)).r * 0.0625;
  return s;
}

void main() {
  vec2 off = uPixelSize * uMaskSmoothRadius * 0.25;
  float prev = blurredPrev(vUv, off) * uDecay;

  float speed = length(texture2D(uVelocity, vUv).xy);
  float add = smoothstep(uVelocityThreshold, uVelocityThreshold * 8.0, speed) * uVelocityStrength;

  float trail = texture2D(uTrail, vUv).r * uTrailMaskStrength;

  float m = prev + add + trail;

  // Fade the mask out towards the frame edges so the reveal never floods the canvas.
  float dc = distance(vUv, vec2(0.5)) / 0.7071;
  m -= uCentreGapStrength * smoothstep(uCentreGapRadius, 1.0, dc);

  // Carve a soft hole a little way out from the cursor, this is what makes the
  // reveal read as liquid rather than as a solid painted blob.
  if (uMouseUV.x >= 0.0) {
    vec2 d = vUv - uMouseUV;
    d.x *= uAspect;
    float dm = length(d);
    float ring = smoothstep(uMouseGapRadius, uMouseGapRadius * 2.2, dm);
    m -= uMouseGapStrength * ring * 0.22;
  }

  m = clamp(m, 0.0, 1.0) * (1.0 - uReset);
  gl_FragColor = vec4(m, m, m, 1.0);
}
`;

/* -------------------------------------------------------------- composite */

export const compositeFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImageA;
uniform sampler2D uImageB;
uniform sampler2D uMask;
uniform vec2 uResolution;
uniform vec2 uImageSizeA;
uniform vec2 uImageSizeB;
uniform vec2 uPan;
uniform float uRevealThresholdLow;
uniform float uRevealThresholdHigh;

/* object-fit: cover, in shader form */
vec2 coverUv(vec2 uv, vec2 res, vec2 img, vec2 pan) {
  float screenAspect = res.x / res.y;
  float imageAspect = img.x / img.y;
  vec2 scale = screenAspect > imageAspect
    ? vec2(1.0, imageAspect / screenAspect)
    : vec2(screenAspect / imageAspect, 1.0);
  return (uv - 0.5) * scale + 0.5 + pan;
}

void main() {
  vec2 uvA = coverUv(vUv, uResolution, uImageSizeA, uPan);
  vec2 uvB = coverUv(vUv, uResolution, uImageSizeB, uPan);

  vec3 a = texture2D(uImageA, clamp(uvA, 0.0, 1.0)).rgb;
  vec3 b = texture2D(uImageB, clamp(uvB, 0.0, 1.0)).rgb;

  float m = texture2D(uMask, vUv).r;
  float t = smoothstep(uRevealThresholdLow, uRevealThresholdHigh, m);

  gl_FragColor = vec4(mix(a, b, t), 1.0);
}
`;
