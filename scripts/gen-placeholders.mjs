/**
 * Generates placeholder imagery in /public so the site builds and runs before
 * Sanika's real photography lands. Everything here is disposable, drop real
 * files in with the same names and delete this script.
 *
 * Writes real PNGs (minimal encoder over node:zlib) plus a few SVG wordmarks.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(OUT, { recursive: true });

/*
 * Real assets have started landing in /public, so this script must never clobber
 * one. Anything already on disk is left alone unless --force is passed.
 */
const FORCE = process.argv.includes('--force');
let kept = 0;

/** @returns true when the caller should skip writing this file. */
function preserve(name) {
  if (FORCE || !existsSync(join(OUT, name))) return false;
  kept += 1;
  process.stdout.write(`  ${name}  kept (already exists)\n`);
  return true;
}

/* ---------------------------------------------------------------- palette */

const C = {
  cherry: [0x67, 0x06, 0x26],
  cherryDeep: [0x4a, 0x04, 0x19],
  cherryBlack: [0x1e, 0x02, 0x09],
  cherrySoft: [0x8a, 0x18, 0x39],
  matcha: [0xba, 0xd7, 0x97],
  matchaPale: [0xe8, 0xf0, 0xd8],
  matchaDeep: [0x8f, 0xa9, 0x6a],
  cream: [0xfb, 0xf8, 0xf1],
};

/* ------------------------------------------------------------ png encoder */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** rgb: Uint8Array of w*h*3 */
function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------- drawing dsl */

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** hash-based value noise, smooth enough for grain */
function noise2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function render(width, height, shade) {
  const px = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = shade(x / width, y / height, x, y);
      const i = (y * width + x) * 3;
      px[i] = Math.max(0, Math.min(255, c[0] | 0));
      px[i + 1] = Math.max(0, Math.min(255, c[1] | 0));
      px[i + 2] = Math.max(0, Math.min(255, c[2] | 0));
    }
  }
  return px;
}

function write(name, width, height, shade) {
  if (preserve(name)) return;
  writeFileSync(join(OUT, name), encodePng(width, height, render(width, height, shade)));
  process.stdout.write(`  ${name}  ${width}x${height}\n`);
}

/** soft radial blob field, gives the placeholders some organic structure */
function blobs(u, v, seeds) {
  let acc = 0;
  for (const [cx, cy, r, w] of seeds) {
    const d = Math.hypot(u - cx, v - cy);
    acc += w * (1 - smooth(0, r, d));
  }
  return clamp01(acc);
}

/* ------------------------------------------------------------------- hero */

// front + back share a composition so the fluid reveal reads as one subject
// changing state rather than two unrelated pictures.
const HERO_SEEDS = [
  [0.30, 0.38, 0.52, 0.85],
  [0.72, 0.30, 0.40, 0.60],
  [0.58, 0.78, 0.46, 0.55],
  [0.12, 0.82, 0.34, 0.40],
];

console.log('generating placeholders in /public');

write('front.png', 1600, 1000, (u, v, x, y) => {
  const b = blobs(u, v, HERO_SEEDS);
  const base = mix(C.cherryBlack, C.cherryDeep, smooth(0, 1, v * 0.7 + u * 0.3));
  const lit = mix(base, C.cherry, b * 0.9);
  const grain = (noise2(x * 0.7, y * 0.7) - 0.5) * 9;
  const vign = 1 - 0.35 * smooth(0.35, 1.0, Math.hypot(u - 0.42, v - 0.5));
  return lit.map((c) => c * vign + grain);
});

write('back.png', 1600, 1000, (u, v, x, y) => {
  const b = blobs(u, v, HERO_SEEDS);
  const base = mix(C.matchaDeep, C.matchaPale, smooth(0, 1, v * 0.7 + u * 0.3));
  const lit = mix(base, C.matcha, b * 0.85);
  const grain = (noise2(x * 0.7, y * 0.7) - 0.5) * 10;
  const vign = 1 - 0.22 * smooth(0.35, 1.0, Math.hypot(u - 0.42, v - 0.5));
  return lit.map((c) => c * vign + grain);
});

/* --------------------------------------------------------------- portrait */

// Sanika's real portrait is a .jpg, so check that before writing the .png stand-in.
if (existsSync(join(OUT, 'display-picture.jpg'))) {
  process.stdout.write('  display-picture  kept (real display-picture.jpg present)\n');
  kept += 1;
} else write('display-picture.png', 900, 1150, (u, v, x, y) => {
  const head = 1 - smooth(0.0, 0.20, Math.hypot((u - 0.5) * 1.15, v - 0.34));
  const body = 1 - smooth(0.0, 0.46, Math.hypot((u - 0.5) * 0.85, (v - 1.12) * 0.72));
  const figure = clamp01(head + body);
  const ground = mix(C.matchaPale, C.matcha, smooth(0.1, 1.0, v));
  const grain = (noise2(x * 0.9, y * 0.9) - 0.5) * 7;
  return mix(ground, C.cherry, figure * 0.92).map((c) => c + grain);
});

/* ------------------------------------------------------------ work cards */

// Alternating grounds so the two caption swap variants both have contrast.
const CARD_THEMES = [
  { bg: [C.matchaPale, C.matcha], shape: C.cherry },
  { bg: [C.cherryDeep, C.cherry], shape: C.matcha },
  { bg: [C.cream, C.matchaPale], shape: C.cherrySoft },
  { bg: [C.cherry, C.cherrySoft], shape: C.matchaPale },
  { bg: [C.matcha, C.matchaDeep], shape: C.cherryDeep },
  { bg: [C.cherryBlack, C.cherryDeep], shape: C.matcha },
  { bg: [C.matchaPale, C.cream], shape: C.cherry },
];

for (let i = 0; i < 7; i++) {
  const t = CARD_THEMES[i];
  const seeds = [
    [0.28 + (i % 3) * 0.16, 0.30 + (i % 2) * 0.12, 0.40, 0.9],
    [0.74 - (i % 2) * 0.18, 0.66, 0.34, 0.7],
  ];
  write(`case-study-${i + 1}.png`, 900, 1240, (u, v, x, y) => {
    const g = mix(t.bg[0], t.bg[1], smooth(0, 1, v * 0.8 + u * 0.2));
    const b = blobs(u, v, seeds);
    const grain = (noise2(x * 0.8 + i, y * 0.8) - 0.5) * 8;
    return mix(g, t.shape, b * 0.55).map((c) => c + grain);
  });
  // hover art: same composition, palette flipped, so the rising panel reads as a state change
  write(`case-study-${i + 1}-hover.png`, 900, 1240, (u, v, x, y) => {
    const g = mix(t.shape, t.bg[1], smooth(0, 1, 1 - v));
    const b = blobs(u, v, seeds);
    const grain = (noise2(x * 0.8 + i, y * 0.8) - 0.5) * 8;
    return mix(g, t.bg[0], b * 0.7).map((c) => c + grain);
  });
}

/* ---------------------------------------------------------- beyond photos */

const BEYOND = [
  [C.cherry, C.cherryDeep, C.matcha],
  [C.matcha, C.matchaDeep, C.cherry],
  [C.matchaPale, C.matcha, C.cherryDeep],
  [C.cherryDeep, C.cherryBlack, C.matchaPale],
  [C.cream, C.matchaPale, C.cherrySoft],
  [C.cherrySoft, C.cherry, C.matcha],
];

BEYOND.forEach(([a, b, accent], i) => {
  write(`beyond${i + 1}.png`, 1284, 902, (u, v, x, y) => {
    const g = mix(a, b, smooth(0, 1, u * 0.6 + v * 0.4));
    // stacked horizontal bands, loosely "shelf of books"
    const band = Math.sin((v * 6.0 + u * 0.6 + i) * Math.PI) * 0.5 + 0.5;
    const grain = (noise2(x * 0.6 + i * 13, y * 0.6) - 0.5) * 9;
    return mix(g, accent, band * 0.28).map((c) => c + grain);
  });
});

/* -------------------------------------------------------------- wordmarks */

const LOGOS = [
  ['logo-django', 'Django Digital'],
  ['logo-amaha', 'Amaha'],
  ['logo-kahani-tree', 'The Kahani Tree'],
  ['logo-myntmore', 'Myntmore'],
  ['logo-ual', 'University of the Arts London'],
  ['logo-hob', 'Humans of Bombay'],
];

for (const [file, label] of LOGOS) {
  // The real marks are PNGs for most of these, so check both extensions before
  // writing a wordmark nothing references.
  if (existsSync(join(OUT, `${file}.png`))) {
    process.stdout.write(`  ${file}  kept (real ${file}.png present)\n`);
    kept += 1;
    continue;
  }
  if (preserve(`${file}.svg`)) continue;
  const w = Math.max(220, label.length * 15);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="74" viewBox="0 0 ${w} 74">
  <rect width="${w}" height="74" rx="6" fill="none" stroke="#670626" stroke-width="1.5" opacity="0.45"/>
  <text x="${w / 2}" y="43" text-anchor="middle" font-family="Georgia, serif" font-size="21"
        letter-spacing="1.5" fill="#670626">${label.replace(/&/g, '&amp;')}</text>
</svg>`;
  writeFileSync(join(OUT, `${file}.svg`), svg);
  process.stdout.write(`  ${file}.svg\n`);
}

/* -------------------------------------------------------------- favicon */

if (!preserve('favicon.svg')) {
  writeFileSync(
    join(OUT, 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="32" fill="#670626"/>
  <rect y="32" width="64" height="32" fill="#BAD797"/>
</svg>`
  );
  process.stdout.write('  favicon.svg\n');
}

/* --------------------------------------------------------- placeholder resume */

if (!preserve('Resume.pdf')) {
  writeFileSync(
    join(OUT, 'Resume.pdf'),
    Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n' +
        '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
        '5 0 obj<</Length 68>>stream\nBT /F1 24 Tf 72 740 Td (Sanika Joshi - resume placeholder) Tj ET\nendstream endobj\n' +
        'trailer<</Root 1 0 R>>\n',
      'latin1'
    )
  );
  process.stdout.write('  Resume.pdf (placeholder)\n');
}

console.log(kept ? `done, ${kept} existing file(s) kept. Use --force to overwrite.` : 'done');
