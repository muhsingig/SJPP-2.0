# Build Prompt — Sanika Joshi Portfolio (Cherry × Matcha)

Build a single-page personal portfolio website for **Sanika Joshi**, a content, social media and
brand strategist. Reproduce the architecture, motion system, layout and exact numeric values below.
Content is final unless marked `[[LIKE THIS]]` — those are the only placeholders left to fill.

> **Still outstanding** (see §9 at the end of this file for the full list): the hero headline choice,
> the two employer names, contact links, and the Substack essay list.

---

## 1. Tech stack (non-negotiable)

- **Vite** + vanilla **TypeScript** (no React, no Next.js). Entry: `index.html` → `src/main.ts`.
- **three.js** — WebGL hero (fluid simulation + shader composite).
- **GSAP** + **ScrollTrigger** — all scroll animation, counters, marquees, nav, card stack.
- **lottie-web** — animated skill icons.
- **intl-tel-input** — phone field with country dial-code dropdown.
- **formsubmit.co** AJAX endpoint for the contact form (no backend).
- Static assets in `/public`. Ship `.webp` with `.png` fallback via `<picture>`.
- Output: a static build deployable to Netlify/Vercel/Cloudflare Pages.

---

## 2. Design system

### Colours — Cherry × Matcha
```css
--cherry        #670626   /* primary brand — dark sections, headings on light */
--cherry-deep   #4A0419   /* preloader, footer, deepest ground */
--cherry-black  #1E0209   /* hero backdrop behind canvas */
--cherry-soft   #8A1839   /* hover / secondary accent */
--matcha        #BAD797   /* secondary brand — light sections, type on cherry */
--matcha-pale   #E8F0D8   /* tinted light ground */
--matcha-deep   #8FA96A   /* muted accent, rules, nav prelayer */
--cream         #FBF8F1   /* warm off-white ground */
--ink           #2E0710   /* body text on light grounds */
--alert         #9C3D0E   /* form errors — deliberately NOT cherry, so errors read as errors */
--alert-soft    #C4692F
--radius        4px       /* media + buttons; nav card 16px; writing tiles 12px; stack cards 18px */
```
Cherry on matcha (and matcha on cherry) is **8.4:1** — WCAG AAA. Use that pairing freely.
Matcha on cream is decorative only; never set body copy in it.

### Type
- `General Sans` (Fontshare, 300/400/500/600/700) — everything.
- `Bayon` (Google Fonts) — logotype only. 28px, line-height 1, letter-spacing .04em, weight 400,
  two stacked lines.
- `Inter` — body fallback only.

| Element | Size | Weight | Tracking | Leading |
|---|---|---|---|---|
| Hero H1 line | `clamp(32px, 5.5vw, 80px)` | **300** | -.01em | 1.1 |
| Hero tagline | `clamp(20px, 4.5vw, 36px)` | 300 / **500** alternating per line | .02em | 1.4 |
| "Selected Work" display | `clamp(56px, 12vw, 173px)` | **700** | -.02em | .95 |
| Contact title | `clamp(44px, 6.7vw, 96px)` | **700** | -.02em | .98 |
| Skills / Writing / Beyond titles | `clamp(36px, 5.2vw, 75px)` | **300** | -.02em | 1.05 |
| Profile heading | `clamp(26px, 3.1vw, 44px)` | **300** (`.weight-medium` spans at 500) | -.01em | 1.15 |
| Profile greeting | `clamp(18px, 1.6vw, 23px)` | 400 | .01em | normal |
| Work card caption | 36px, JS-autofit down | 300 (`<strong>` 500) | -.01em | 1.1 |
| Experience heading | 40px | 400 | -.01em | 1.2 |
| Stat number | 70px | **300** | -.02em | 1 |
| Stat label | 24px | 400 | — | 1.35 |
| Writing subtext | 18px | 400 | — | 1.6, opacity .85 |
| Velocity marquee | **128px** | **700** | **.08em** | uppercase, opacity **.25** |
| Contact field label / input | 20px | 400 | — | 1.2 |
| Meta footer text | 20px | 400 | — | 1.25 |

### Section grounds (scroll order)
| # | Section | BG | Text | Nav tone |
|---|---|---|---|---|
| 1 | `#hero` | transparent over canvas | `#fff` | light |
| 2 | `#profile` | `--matcha` | `--cherry-deep` | `data-nav-tone="dark"` |
| 3 | `#work` | `--cream` | `--cherry` | `data-nav-tone="dark"` |
| 4 | `#skills` | `--cream` | `--cherry` | `data-nav-tone="dark"` |
| 5 | `#experience` | `--matcha-pale` | `--ink` | `data-nav-tone="dark"` |
| 6 | `#writing` | `--cream` | `--cherry` | `data-nav-tone="dark"` |
| 7 | `#beyond` | `--cherry` | `--matcha` | — |
| 8 | `#contact` | `--matcha` | `--cherry` | `data-nav-tone="dark"` |
| 9 | `#meta` | `--cherry-deep` | `--matcha-pale` | — |

Padding: hero 0 · profile `96px 0 128px` · work `96px clamp(24px,15vw,224px) 104px` ·
skills `96px 12vw 112px` · experience `112px 10vw` · writing `112px clamp(24px,4.5vw,64px) 128px` ·
beyond `72px 10vw 128px` · contact `112px 9vw` ·
meta `clamp(3.5rem,7vw,5.2rem) clamp(3.5rem,9vw,10rem) clamp(4rem,8vw,5.7rem)`.

---

## 3. Global shell

```html
<nav class="site-nav"> … </nav>
<main class="snap-stack is-js-snapping">
  <section id="hero"       class="hero snap-section">…</section>
  <section id="profile"    class="profile-section snap-section" data-nav-tone="dark">…</section>
  <section id="work"       data-nav-tone="dark">…</section>
  <section id="skills"     data-nav-tone="dark">…</section>
  <section id="experience" data-nav-tone="dark">…</section>
  <section id="writing"    data-nav-tone="dark">…</section>
  <section id="beyond">…</section>
  <section id="contact"    data-nav-tone="dark">…</section>
  <section id="meta">…</section>
</main>
```

- `.snap-stack` is the **scroll container**, not `window`:
  `height: 100svh; overflow-y: auto; overscroll-behavior: contain; scroll-snap-type: y mandatory;`
  — but `.is-js-snapping` sets `scroll-snap-type: none`, because **JS drives the snap** (§5.1).
- `.snap-section { scroll-snap-align: start; scroll-snap-stop: always; min-height: 100svh; }`
- **Every ScrollTrigger must pass `scroller: '.snap-stack'`.**
- Set `--vvh` from `visualViewport.height` on resize to kill mobile URL-bar jump.

### Preloader
Fixed `#loading`, `inset: 0`, bg **`--cherry-deep`**, z-index 9999,
`display:flex; flex-direction:column; justify-content:flex-end; padding: clamp(2rem,5vw,4rem)`.
Counter: `clamp(80px, 20vw, 240px)`, weight 500, line-height .9, tracking -.04em, colour **`--matcha`**.
- Entry: `opacity 0 → 1`, `translateY(20px) → 0`, `0.8s ease forwards`.
- Value tweened off three.js `LoadingManager.onProgress` with
  `gsap.to({val}, {duration: 1.2, ease: 'power2.out'})`, rendered `Math.round(v) + '%'`.
- `onLoad` → tween to 100 → `setTimeout(1500ms)` → add `.is-hidden`
  (`opacity/visibility 1.2s cubic-bezier(.4,0,.2,1)`).

### Nav
Fixed, `justify-content: space-between; align-items: flex-start; padding: 1rem clamp(1.25rem,4vw,2.5rem)`,
z-index 100, `font-weight: 600`.
- **Left:** two-line Bayon logotype **`SANIKA`** / **`JOSHI`** inside a bare `<button>` that
  scrolls to top. `:focus-visible` → 2px `rgba(255,255,255,.8)` outline, offset 4px.
- **Right:** `CV` link → `/CV.pdf`; hamburger button — 3rem square, `1px solid rgba(255,255,255,.85)`,
  `background: rgba(255,255,255,.24)`, two 20px bars, `transform: scaleX(-1)`.
  ≤700px: 2.45rem, 16px icon.
- **Tone observer:** rAF-throttled scroll listener tests whether any `[data-nav-tone="dark"]` section's
  rect overlaps the nav's rect; toggles `.on-light` → logotype + hamburger become **`--cherry`**.

**Menu card** — `position: fixed; top: 4.8rem; right: clamp(1.25rem,4vw,2.5rem);
width: min(560px, 100vw - 2.5rem); border-radius: 16px; overflow: hidden;
box-shadow: 0 24px 52px rgba(30,2,9,.42); transform-origin: right top; z-index: 110;`
Backdrop: `position: fixed; inset: 0; background: rgba(30,2,9,.46); backdrop-filter: blur(4px); z-index: 105;`

- **Three prelayers** absolutely `inset: 0`, at rest `translateX(102%)`, coloured
  **`--matcha`, `--matcha-deep`, `--cherry`** (in that DOM order).
- **List panel** `.nav-menu-list`:
  `background: linear-gradient(155deg, rgba(74,4,25,.97), rgba(30,2,9,.98));
  display: grid; gap: var(--nav-menu-gap); padding: var(--nav-menu-pad); counter-reset: nav-item;`
- **Items** (buttons, not links): **`About · Work · Skills · Experience · Writing · Beyond · Contact`**
  `font-size: var(--nav-item-size); weight 500; line-height .98; letter-spacing -.02em;
  padding: var(--nav-item-pad-y) 1rem var(--nav-item-pad-y) 4.05rem; border-radius: 10px;
  color: var(--cream);`
  - `::before` → CSS counter `"0" counter(nav-item)`, left 1rem, vertically centred, 13px, weight 500,
    tracking .12em, colour **`rgba(186,215,151,.94)`** (matcha).
  - `::after` → 1px rule `rgba(251,248,241,.16)`, inset 1rem, hidden on `:last-child`.
  - `:hover, :focus-visible` → `background: rgba(186,215,151,.17); color: var(--matcha); outline: none;`

**Menu sizing algorithm** (on open and on resize): compute
`itemSize = clamp(min(vw*.044, vh*.054), 30, 52)` (≤700px: `clamp(min(vw*.073, vh*.048), 24, 38)`),
`padY = clamp(vh*.0125, 10, 14)` (phone `clamp(vh*.0105, 8, 11)`),
`gap = clamp(vw*.005, 4, 8)` (phone `clamp(vw*.004, 3, 6)`),
`pad = clamp(vw*.02, 15, 24)` (phone `clamp(vw*.03, 12, 18)`).
Write as `--nav-item-size / --nav-item-pad-y / --nav-menu-gap / --nav-menu-pad`. Then if
`scrollHeight > available` (`available = max(220, innerHeight - menuTop - 14)`), multiply all four by
`clamp(available/scrollHeight, .7, 1)` with floors `22/6/2/8` (phone `19/5/2/8`) and re-write.

**Open timeline** (GSAP, `defaults: { overwrite: 'auto' }`), from
`backdrop autoAlpha 0`, `prelayers xPercent 102`, `list xPercent 102`, `items autoAlpha 0, y 18`:
```
.to(backdrop,  { autoAlpha: 1, duration: .22, ease: 'power2.out' }, 0)
.to(prelayers, { xPercent: 0, duration: .44, ease: 'power3.out', stagger: .07 }, 0)
.to(list,      { xPercent: 0, duration: .48, ease: 'power4.out' }, .12)
.to(items,     { autoAlpha: 1, y: 0, duration: .3, stagger: .045, ease: 'power3.out' }, .24)
```
**Close timeline:**
```
.to(items,     { autoAlpha: 0, y: 12, duration: .16, stagger: { each: .035, from: 'end' }, ease: 'power2.in' }, 0)
.to(list,      { xPercent: 102, duration: .34, ease: 'power3.in' }, .02)
.to(prelayers, { xPercent: 102, duration: .4,  ease: 'power3.in', stagger: .06 }, .06)
.to(backdrop,  { autoAlpha: 0, duration: .24, ease: 'power2.in' }, 0)
```
`onComplete` → set `hidden` on menu + backdrop. Close on backdrop click, outside click, Escape, or
item click (item click closes *instantly*, then calls the snap-scroll). Toggle `aria-expanded`.

---

## 4. Sections — structure + final content

### 4.1 Hero — WebGL fluid reveal (the centrepiece)

Full-viewport `<canvas id="hero-canvas">`, plus `.hero-overlay`
(`linear-gradient(to right, rgba(30,2,9,.72), rgba(30,2,9,.22), transparent)`; ≤700px → `to bottom`),
plus headlines at `top: clamp(6rem,18vh,10rem); left: clamp(2rem,5vw,4rem); pointer-events: none;`

**Renderer** — `WebGLRenderer({ alpha: true, antialias: true })`, `pixelRatio = min(devicePixelRatio, 2)`,
`OrthographicCamera(-1,1,1,-1,-1,1)`, one shared `PlaneGeometry(2,2)`,
`outputColorSpace = LinearSRGBColorSpace`, `toneMapping = NoToneMapping`, `setClearColor(0, 1)`.

**Textures** — load `front.png` (`[[HERO IMAGE A — base]]`) and `back.png`
(`[[HERO IMAGE B — revealed under cursor]]`) via `TextureLoader` on a shared `LoadingManager`.
`colorSpace = SRGBColorSpace`, `min/magFilter = LinearFilter`, `wrapS/T = ClampToEdgeWrapping`.
> Art direction: pair a portrait with a texture that carries the palette — matcha/ice, cherry-red
> ground, paper, or book pages. The two images should share composition so the reveal reads as one
> subject changing state, not two unrelated pictures.

**Render targets** — four, at `maskRTScale = 0.75` of canvas pixel size, `RGBAFormat`,
`UnsignedByteType`, `depthBuffer: false`, `stencilBuffer: false`, `generateMipmaps: false`:
`rtA`/`rtB` (mask ping-pong), `trailA`/`trailB` (trail ping-pong).

**Passes, per frame**
1. **Fluid sim** — Stam-style Navier–Stokes (advection with **BFECC**, divergence, Jacobi pressure,
   gradient subtract) → velocity texture. `dt .014`, `resolution .6`, `film_noise_strength .72`.
2. **Trail pass** — accumulates a soft radial blob at the pointer UV, decays the previous frame.
   `trailDecay .91`, `trailRadius .14`, `trailStrength .85`.
3. **Mask-from-velocity pass** — reads velocity + previous mask + trail; adds mask where
   `|velocity| > uVelocityThreshold`; multiplies previous by `uDecay`; box-blurs by `uMaskSmoothRadius`;
   subtracts a radial gap around the pointer and around frame centre.
   `decay .94`, `velocityStrength .58`, `velocityThreshold .038`, `maskSmoothRadius 48`,
   `mouseGapRadius .18`, `mouseGapStrength .88`, `centreGapRadius .88`, `centreGapStrength .96`,
   `trailMaskStrength .88`.
4. **Composite pass** — cover-fits both textures from `uResolution` / `uImageSizeA` / `uImageSizeB`, then
   `mix(colorA, colorB, smoothstep(uRevealThresholdLow, uRevealThresholdHigh, mask))`.
   `revealThresholdLow .02`, `revealThresholdHigh .08`, `gapMinRadius 48`,
   `centreRevealRadius .58`, `mouseRevealRadius .22`.
   `uImagePanX/Y` by width: ≤700px `(-0.085, 0.08)`, ≤1200px `(-0.03, 0.04)`, else `(0, 0)`.

**Pointer** — pointerenter/down/move/up/leave/cancel on the canvas. Client coords → UV with `y`
flipped, clamped 0–1; smoothed toward the target each frame. On touch, `preventDefault()` **unless**
the gesture is a fast upward swipe (velocity ≥ **1200** px/s) so scrolling still works.

**Guards** — pause the loop when the hero is out of view and while a snap animation runs; on
`webglcontextlost` swap in a static `<img src="/front.png">`; skip the sim entirely under
`prefers-reduced-motion`.

**Headline markup — final copy**
```html
<h1 class="hero-heading">
  <span class="hero-heading-line">Building</span>
  <span class="hero-heading-line hero-heading-second">
    <span class="resilient-word">brand</span> voices
  </span>
</h1>
<div class="hero-tagline">
  <span class="tagline-line tagline-line-light">With the ear of a</span>
  <span class="tagline-line tagline-line-medium">ghostwriter</span>
  <span class="tagline-line tagline-line-light">and the discipline of an</span>
  <span class="tagline-line tagline-line-medium">account lead</span>
</div>
```
`.hero-heading-second` is `display: flex; align-items: baseline; gap: .25em; position: relative`.

**Cycling stroke** — a `.cycling-stroke` div sized from JS every rAF/resize/load:
`width = strokeWord.right - hero.left`, `top = line.top - hero.top + line.height * 0.6`,
`height = line.height * 0.4`. Render it as a hand-drawn **matcha** underline behind the word "brand".

**Swipe hint** — bottom-centre, `bottom: clamp(1.8rem,5vh,3rem)`, opacity .7, column flex, gap .55rem:
a 22px chevron animating
`@keyframes hero-swipe-bounce { 0%,100% { translateY(0) } 50% { translateY(6px) } }`
2s ease-in-out infinite, plus a 13px `rgba(255,255,255,.8)` label "Swipe up to scroll".
Fades out permanently (`.is-hidden`, `opacity .4s`) once `scrollTop > 10`.

### 4.2 About — scroll-scrubbed word reveal

`.profile-top` = intro text (left) + portrait (right, `[[PORTRAIT IMAGE]]`), then `.profile-divider`,
then `.profile-columns` (three paragraphs).

**Divider** — full-bleed grid: `width: 100vw; margin-left: 50%; transform: translateX(-50%);
grid-template-columns: var(--divider-left) var(--divider-gap) var(--divider-right);
margin-top: -1px; margin-bottom: clamp(4rem, 8vw, 6rem);` — segment, gap, segment, in
`rgba(74,4,25,.35)`. JS writes the three custom properties from the portrait's measured rect so the
gap sits exactly under the image.

**The reveal** — the distinctive mechanic; implement exactly:
1. Each `[data-scroll-reveal]` stores its markup in `data-original-html`, then every word is wrapped in
   `<span class="reveal-word">` (preserving inner `.weight-medium` / `.bold-italic` spans).
2. After layout, walk the words and increment a `--line-order` index whenever a word's
   `getBoundingClientRect().top` differs from the previous by **>2px** — group **by visual line**.
3. Normalise: with `n` lines, `--line-span: 0.8` (or `1` if `n === 1`); each line's order becomes
   `index * (1 - 0.8) / (n - 1)`. The portrait wrap gets `--line-order: 0.2`
   (its CSS default is `.85`; JS overrides).
4. CSS does all the work — no per-element JS animation:
```css
#profile [data-scroll-reveal] .reveal-word,
#profile .profile-image-wrap {
  display: inline-block;
  --line-local: clamp(0, calc((var(--reveal-progress) - var(--line-order)) / var(--line-span)), 1);
  opacity: var(--line-local);
  transform: translateY(calc((1 - var(--line-local)) * 24px));
  will-change: opacity, transform;
}
```
5. JS sets one var: `--reveal-progress = clamp((scrollTop / profileTop - 0.2) / 0.8, 0, 1)`.
6. Rebuild the line grouping on every resize.
7. `--profile-scale` clamps content between **0.75–1.2** on ≥901px so the section fits one screen.

**Journal lines** — 7 vertical 1px rules behind the content, `height: 200vh`, `bottom: 50%`,
`background: linear-gradient(to bottom, rgba(74,4,25,.30), rgba(74,4,25,.20) 85%, transparent)`,
`gap = portraitWidth/4 - 1px`, aligned to the portrait's left edge. A **5-line** variant renders on
phones with `--journal-left/-width/-height/-gap` vars.

**Final copy**
- Greeting: `I'm Sanika 👋`
- Heading (with `.weight-medium` on the marked phrase):
  *"A generalist defined by a stubborn interest in **how brands actually find their voice**"*
- Paragraph 1: *"I have 5+ years across social media, content, brand strategy, client servicing,
  publishing and marketing — which is a long way of saying I've never been very good at staying in
  one lane."* (`.bold-italic` on **5+ years**)
- Paragraph 2: *"That range has taken me from managing a children's bookstore and working in
  publishing, to social media strategy, content writing, LinkedIn ghostwriting, qualitative research,
  and now client servicing and account management."*
- Paragraph 3: *"I sit somewhere between **content, strategy and execution**. I like understanding the
  bigger picture, working out what a brand is actually trying to say, turning that into ideas — and
  then making sure the right people actually execute it."* (`.bold-italic` on the marked phrase)

### 4.3 Selected Work — offset two-column card grid

- `h2.work-title` = **"Selected Work"**, giant display, weight 700, `--cherry`.
- `.work-grid` — `grid-template-columns: repeat(2, minmax(0,1fr)); gap: clamp(2rem,5vw,4rem);
  align-items: start; position: relative; z-index: 1`.
  **`.work-col-left { margin-top: clamp(-5.5rem, -5.5vw, -3.25rem) }`**,
  **`.work-col-right { margin-top: clamp(3rem, 5.5vw, 5.5rem) }`** — this offset is what makes the
  grid feel editorial. Each column: `display: flex; flex-direction: column; gap: clamp(2rem,5vw,4rem)`.
- **17 journal lines** behind the grid: `grid-auto-flow: column; grid-auto-columns: 1px;
  column-gap: var(--work-lines-gap, 12px)`, each 1px wide with
  `linear-gradient(to bottom, transparent, rgba(103,6,38,.15) 35%, rgba(103,6,38,.22) 55%, transparent)`.
  JS writes `--work-lines-top/-left/-width/-height/-gap` to track the grid (top offset −16px).

**The seven cards** — left column 1/3/5/7, right column 2/4/6:

| # | Project | Caption line 1 (`<strong>` bolded part) | Caption line 2 | Swap |
|---|---|---|---|---|
| 1 | Django — client servicing | **Running accounts** that | actually ship on time | black→white |
| 2 | Mental Health Awareness Month | **Making mental health** | feel less alone online | white→black |
| 3 | LGBTQI+ Month campaign | **Building space** for | queer voices on social | black→white |
| 4 | LinkedIn ghostwriting | **Writing in someone** | else's voice, convincingly | white→black |
| 5 | Humans of Bombay | **Turning conversations** | into published stories | black→white |
| 6 | Children's bookstore & book fairs | **Putting the right book** | in the right hands | white→black |
| 7 | UAL Knowledge Exchange | **Turning interviews** | into funding decisions | black→white |

**Card markup**
```html
<div class="work-card" data-desktop-url="[[URL]]" data-mobile-url="[[MOBILE URL]]">
  <div class="work-card-media">
    <picture><source srcset="/case-study-N.webp" type="image/webp"><img src="/case-study-N.png" alt="…"></picture>
    <div class="work-card-hover" aria-hidden="true">
      <img class="work-card-hover-image" src="/case-study-N-hover.png" alt="">
      <span class="work-card-hover-arrow is-white"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </div>
    <div class="work-card-text swap-black-white">
      <div class="work-card-text-layer work-card-text-base">
        <span class="work-card-text-line"><strong>Running accounts</strong> that</span>
        <span class="work-card-text-line">actually ship on time</span>
      </div>
      <div class="work-card-text-layer work-card-text-hover"><!-- identical copy --></div>
    </div>
  </div>
</div>
```
- `.work-card-media { position: relative; overflow: hidden; border-radius: 4px }`; `cursor: pointer`.
- `.work-card-hover { inset: 0; transform: translateY(100%); transition: transform .5s linear; z-index: 1 }`
  → `:hover` `translateY(0)`. Hover image `object-fit: cover`, full-bleed.
- `.work-card-text { position: absolute; top: 6.25%; left: 7.5%; right: 7.5%; z-index: 2;
  pointer-events: none }`; lines are `display: block; white-space: nowrap`.
- Colour swap: base layer `--cherry` (dark caption on light art) or `--cream` for the inverse variant;
  the hover layer is clipped `clip-path: inset(100% 0 0 0)` → `inset(0)` with
  `transition: clip-path var(--text-reveal-duration, .5s) linear` and
  `transition-delay: var(--text-reveal-delay-out, 0s)` at rest / `var(--text-reveal-delay-in, 0s)` on
  hover. **JS computes those three vars per card from the caption's vertical position** so the colour
  swap tracks the rising panel edge exactly.
- Arrow: `right: 10%; bottom: 7.5%`, 28px, looping
  `@keyframes work-arrow-slide { 0% { translateX(-4px) } 50% { translateX(6px) } 100% { translateX(-4px) } }`
  1.6s ease-in-out infinite.
- Captions **auto-fit**: shrink font-size until both `nowrap` lines fit the card; re-run on resize.
- Click opens `data-desktop-url` / `data-mobile-url` (media-query pick) in a new tab.
- `.work-card-soon` variant (use if any case study isn't ready): centred "Case study in progress"
  label, 24px weight 500 `--cream`, `opacity 0→1` + `translateY(12px)→0` over `.35s ease` on hover.
- **Entrance:** `.work-reveal { opacity: 0; transition: opacity .55s, transform .55s }` with
  `[data-reveal="left"] { transform: translateX(-40px) }`,
  `[data-reveal="right"] { transform: translateX(40px) }`, resolved by `.is-inview`.
- Touch devices: `is-touch-reveal` replaces `:hover`, applied on intersection with an index stagger.

### 4.4 What I Do — Lottie card grid

`h2.skills-title` = **"What I Do"**, weight 300.
`.skills-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr));
gap: clamp(2.5rem,6vw,4.5rem) clamp(2rem,6vw,5rem) }`.
Card: `display: flex; flex-direction: column; gap: .8rem` — an **84×84** `.skill-icon` holding a Lottie
(`data-lottie="[[Name]].json"`, lazy-loaded, played on enter, recoloured to `--cherry`), a title
(weight 500), a one-line description (weight 300, `opacity .8`).

**The eight cards:**
| Title | Description |
|---|---|
| Social Media Strategy & Management | Turning brand objectives into calendars, formats and posts that hold up |
| Content Strategy & Writing | Deciding what's worth saying before working out how to say it |
| Brand & Content Coordination | Keeping creative, content and client on the same page, on the same day |
| Client Servicing & Account Management | Owning accounts end to end, from brief to delivery |
| LinkedIn Personal Branding | Building founder presence that sounds like the founder |
| Long-form & Editorial Writing | Essays, newsletters and narrative pieces that earn the read |
| Publishing & Book Curation | Choosing the right books for the right readers and rooms |
| Research & Audience Understanding | Interviews and qualitative work that turn into usable decisions |

**Title animation — per-letter split.** Split `.skills-title` into `<span class="skill-title-letter">`
per character (spaces → `&nbsp;`, flagged `data-split-letters="true"` so it never re-splits):
```
gsap.set(letters, { y: 10, opacity: 0 })
gsap.timeline({ scrollTrigger: { trigger: section, scroller: '.snap-stack',
                                 start: 'top 80%', toggleActions: 'play none none reverse' } })
   .to(letters, { y: 0, opacity: 1, duration: .7, ease: 'power1.out', stagger: .02 })
```
**Cards:** `gsap.set(cards, { y: 16, opacity: 0 })` then `ScrollTrigger.batch(cards, { start: 'top 85%',
onEnter: b => gsap.to(b, { y: 0, opacity: 1, duration: .8, ease: 'power2.out', stagger: .08 }) })`,
reversed on `onLeaveBack`.

### 4.5 Experience — logo marquee + counters

- `h2` = **"Where I've worked"**, 40px weight 400.
- `.clients-marquee { overflow: hidden; margin: 0 auto clamp(3.5rem,7vw,5rem);
  mask-image: linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%) }`.
  Inside, `.clients-track { display: flex; align-items: center; width: max-content;
  gap: clamp(2.75rem,6vw,5rem) }` with **three identical** `.clients-track-set` divs.
  Logos: **`height: 74px; width: auto; filter: brightness(.75); opacity: .9`**.
  Animate `gsap.to(track, { x: -setWidth, ease: 'none', repeat: -1, duration: setWidth / 72 })`
  (72 px/sec). Pause off-screen and on `visibilitychange`; rebuild on resize.
  **Six logos:** Django · `[[MENTAL HEALTH ORG]]` · `[[CHILDREN'S BOOKSTORE]]` ·
  University of the Arts London · Humans of Bombay · Conscious Collective.
- `.clients-stats { display: grid; grid-template-columns: repeat(3, minmax(0,1fr));
  gap: clamp(1.5rem,4vw,2.5rem) }`. Each `.clients-card`: **bg `--cherry`, colour `--matcha`,
  `border-radius: 16px`, `padding: clamp(2rem,4vw,2.75rem)`, `min-height: 180px`, flex column,
  `justify-content: center`, `gap: .6rem`**.
  Number `<div class="clients-number" data-target="N" data-suffix=" +">` at 70px weight 300;
  label 24px weight 400.
  Counter: `gsap.to(obj, { value: target, duration: .8, ease: 'power1.out', onUpdate: round })`,
  ScrollTrigger `start: 'top 80%'`, reset to 0 on `onLeaveBack`, re-run on `onEnterBack`.
  Under `prefers-reduced-motion`, write the final value immediately.
  **Stats:** `5 +` years of experience · `6 +` organisations · `4 +` industries.

### 4.6 Writing — infinite masonry

`h2.art-title` = **"Beyond the brief, I write"** (same per-letter split, class `.art-title-letter`) +
`.art-subtext` (18px / 1.6 / opacity .85):
> *"I write on Substack — long-form pieces about culture, psychology, human behaviour and the
> ordinary things I can't stop noticing. None of it is client work, which is exactly the point."*

Then `.art-masonry-list` (`position: relative; --masonry-gap: 12px; height set by JS`).
Each `.art-item` is `position: absolute; top: 0; left: 0` with
`data-src / data-width / data-height / data-col / data-span`, wrapping an `.art-item-img`
(`background-size: cover; background-position: center; border-radius: 12px;
box-shadow: 0 12px 36px -18px rgba(30,2,9,.25)`).

**Tiles are essay cards, not photos:** each is a flat colour block cycling through
`--cherry` / `--matcha` / `--matcha-pale` / `--cream` with the essay title set in the *opposite*
brand colour (cherry-on-matcha, matcha-on-cherry), plus a small date line. Vary tile heights so the
masonry stays irregular. Each links to its Substack post.
Content: `[[6–10 SUBSTACK ESSAY TITLES + DATES + URLS]]`.

JS lays items into columns — **4** cols ≥1100px, **3** ≥700px, **2** ≥520px — placing each into the
shortest column, absolutely positioning it, preloading all images before reveal. Gap 12px ≤768px,
24px above. The list loops infinitely as you scroll. **Hover scales an item to `0.95`** over
`.3s power2.out`, `transformOrigin: center center` (deliberately *down*, not up).
Final tile is a text tile: **"and more of it on Substack →"**, linking to `[[SUBSTACK URL]]`.

### 4.7 Beyond — velocity marquee + card stack

- `h2` (two lines, weight 300, per-letter split reveal): **"Beyond the work / comes the reading"**
- Paragraph:
  > *"Books are the through-line. I trained in publishing, ran a children's bookstore, curated
  > collections for school fairs, and I still think a well-chosen book does more for a person than
  > most campaigns do for a brand. I read widely and unsystematically — literary fiction, psychology,
  > essays, whatever the independent presses are doing. Most of my best ideas at work started as
  > something I read that had nothing to do with work."*
- **`.inspiration-velocity`** — full-bleed layer *behind* the stack:
  `position: absolute; top: 0; bottom: 0; left: 50%; width: 100vw; transform: translateX(-50%);
  overflow: hidden; z-index: 0; pointer-events: none;` containing `.velocity-scroller`
  (`display: flex; white-space: nowrap; width: max-content`).
  Spans: **128px, weight 700, letter-spacing .08em, uppercase, colour `--matcha`, opacity .25,
  `white-space: pre`**.
  `data-text` = **`"Books . Publishing . Essays . Culture . Psychology . Independent Press . Bookstores . Reading . "`**
  Duplicate spans into a `.velocity-group` until it exceeds `innerWidth * 1.2`, then clone the group
  once. Animate `gsap.to(scroller, { x: -groupWidth, ease: 'none', repeat: -1, duration: groupWidth / 72 })`.
  Play/pause via IntersectionObserver on the section (`root: '.snap-stack'`, `threshold: [0, .05]`)
  and `visibilitychange`. Rebuild on resize.
- **`.inspiration-stack`** — base 642×451, scaled to
  `min(vw × [.78 ≤700 / .82 ≤900 / .86 ≤1200 / .9], 860)` × `min(vh × [.5 / .54 / .58 / .62], 560)`.
  Cards: `position: absolute; top: 50%; left: 50%; border-radius: 18px; overflow: hidden;
  cursor: pointer; will-change: transform`.
  Sorted by filename index. Card `i` gets `zIndex: n - i`, `y: i * 4`, `scale: 1 - i * 0.012`, and a
  random rotation in `[-8°, 8°]`; all positioned `xPercent: -50, yPercent: -50`.
  `data-autoplay="true"` (cycle ~4s), `data-random-rotation="true"`, `data-send-to-back="true"` —
  clicking/dragging the top card sends it to the back and re-lays the stack
  (`duration: .55, ease: 'power2.out'`). Draggable on pointer devices.
  Content: `[[5–7 PHOTOS — bookstore, book fairs, shelves, reading, Conscious Collective]]`.

### 4.8 Let's Connect

Two columns on matcha. Both sides use `[data-simple-reveal]`
(`opacity: 0; transform: translateY(18px); transition: opacity .55s, transform .55s` → `.is-inview`).

- **Left** (`display: flex; flex-direction: column; align-items: flex-start`):
  - `h2` = **"Let's work together"** at 96px/700, `--cherry`.
  - Subtext (two lines):
    *"I'm open to freelance work across strategy, content and everything in between.*
    *Tell me what you're trying to say — I'll help you say it."*
  - A small services list in 16px weight 400, `opacity .8`, separated by `·`:
    **Social media strategy · Content strategy · Content writing · LinkedIn personal branding ·
    Ghostwriting · Brand & content consulting · Publishing and editorial projects**
  - Controls row sized by `--contact-control-size`:
    - `.contact-icon-btn` × 3 — **LinkedIn**, **Substack**, **CV** — transparent, radius 4px, SVG
      `stroke: currentColor; stroke-width: 1.2; stroke-linecap/linejoin: round`, colour `--cherry`.
    - `.contact-mail-btn` → `mailto:[[EMAIL]]` — bg `--cherry`, colour `--cream`, radius 4px,
      `padding: 0 18px`, `gap: 9px`, 16px weight 500, 23px icon at `stroke-width: 1.35`.
      Label: **"Get in touch"**.
- **Right** (`padding-top: 4px`): intro line at 20px/1.3 —
  *"Or leave your details and I'll come back to you."* — then
  `<form action="https://formsubmit.co/ajax/[[EMAIL]]" method="post" novalidate>` with hidden inputs
  `_subject`, `_template=table`, `_captcha=false`.
  `.contact-form { margin-top: clamp(2.5rem,6vw,4rem); display: flex; flex-direction: column; gap: 2rem }`.
  Fields **Name\***, **Company / brand\***, **Phone number\*** — each a `.contact-field`
  (`display: grid; row-gap: 1rem`) with a 20px label span and:
  ```css
  .contact-field input {
    width: 100%; background: transparent; color: var(--cherry);
    border: none; border-bottom: 2px solid rgba(103,6,38,.62);
    font-size: 20px; line-height: 1.2; padding: 0 0 10px; outline: none;
  }
  ```
  Phone uses **intl-tel-input** (default country `in`, dial code inline, `font-size: 20px`).
  Errors: `.contact-field-error { font-size: 14px; color: var(--alert) }` (hidden when `:empty`),
  `aria-live="polite"`; `.is-invalid` turns the label `--alert` and the border `--alert-soft`.
  Result banner `.contact-form-message` — `.is-error` → `--alert` text on `rgba(251,248,241,.72)`
  with an `rgba(156,61,14,.35)` border; `.is-success` → `--matcha` text on `rgba(103,6,38,.9)`.
  Submit button reuses the mail-button style, `align-self: flex-start`,
  `margin-top: clamp(1.25rem,2.5vw,2rem)`, `[disabled] { opacity: .72; cursor: wait }`.
  Submit via `fetch` — never navigate away.

### 4.9 Meta footer

`.meta-inner { max-width: 1700px; margin: 0 auto; display: flex; align-items: flex-start;
gap: clamp(2.5rem,5vw,6rem) }`. Each `.meta-item` is preceded by a
**`.meta-line` rule: `82.4px × 0.8px`, `rgba(232,240,216,.92)`, `margin-bottom: 1.5rem`**, then a
20px/1.25 paragraph. Items: **"Designed by Sanika Joshi"** and **"Last updated in 2026"**.

---

## 5. Motion system

### 5.1 Hero ↔ About JS snap
Only these two snap; everything below scrolls freely.
- Measure `snapProfileTop` = profile's offset inside `.snap-stack`; recompute on resize.
- `wheel` listener (`passive: false`), ignore `|deltaY| < 2`:
  - down while `scrollTop < snapProfileTop - 1` → `preventDefault()` + `animateSnapTo(snapProfileTop)`
  - up while `scrollTop ∈ [snapProfileTop - 4, snapProfileTop + 80]` and `> 1` →
    `preventDefault()` + `animateSnapTo(0)`
  - if already animating, or `snapProfileTop <= 0`, just `preventDefault()`
- Touch: same logic from `touchstart`/`touchend` ΔY, threshold **96px** when `innerWidth ≤ 1024`, else 40px.
- `animateSnapTo` = a **2000ms** eased rAF tween that sets `snapAnimating` (suppressing the scroll
  handler and pausing the hero render loop) and drives `--reveal-progress` throughout, so the About
  copy writes itself on as the page moves.
- Support `#hash` deep links by scrolling `.snap-stack` to the target.

### 5.2 Rules
- Every ScrollTrigger passes `scroller: '.snap-stack'`.
- Section titles (What I Do / Writing / Beyond): per-letter split, `y: 10 → 0`, `opacity: 0 → 1`,
  `duration .7`, `ease power1.out`, `stagger .02`, `toggleActions: 'play none none reverse'`.
- `[data-simple-reveal]`: `opacity 0 + translateY(18px)` → `.is-inview`, `.55s`.
- `.work-reveal`: `opacity 0 + translateX(∓40px)` → `.is-inview`, `.55s`.
- Skill cards: `y 16 → 0`, `.8s power2.out`, stagger `.08`, via `ScrollTrigger.batch` at `top 85%`.
- `will-change: opacity, transform` on every animated layer; rAF-throttle all scroll handlers.
- **`prefers-reduced-motion`**: no fluid sim, no marquees, no arrow/swipe loops, counters jump to
  final values, all reveals resolve to their end state with `clearProps: 'transform'`.

---

## 6. Responsive

Breakpoints: **≤520**, **≤700** (phone), **≤900**, **≤1024**, **≤1100**, **≤1200**, **≥1500**.
- **≤1200:** hero pan `(-0.03, 0.04)`; stack scale `.86 / .58`.
- **≤1100:** work grid → 1 column, column offsets removed, `gap: 0`, `.work-grid { margin-top: 1rem }`.
- **≤900:** About becomes a stacked single column; skills → 2 columns; stack scale `.82 / .54`.
- **≤768:** masonry gap 12px.
- **≤700:** hero overlay gradient → `to bottom`; headline `clamp(38px, 10vw, 52px)` at line-height 1.03;
  headlines move to `top: clamp(4.6rem,12vh,6.5rem); left: 1rem; padding-left: 1.5rem`;
  swipe hint hidden; nav menu `width: calc(100vw - 2rem)`, `top: 4.45rem`, radius 14px,
  hamburger 2.45rem; masonry 3 cols; skills 1 column; stack scale `.78 / .5`; touch snap threshold 96px.
- **≤520:** masonry 2 cols.
- Work cards use `is-touch-reveal` instead of `:hover` on touch devices.
- Test at 375, 768, 1024, 1440, 1920.

---

## 7. Assets to supply

```
/front.png                  hero image A (base)
/back.png                   hero image B (revealed)
/display-picture.png|webp   portrait
/case-study-1..7.png|webp   work card images
/case-study-N-hover.png     work card hover images
/logo-*.png|webp            6 organisation logos
/writing-*.png              essay tiles (or CSS-rendered blocks)
/beyond1..N.png|webp        books / bookstore / fair photos
/[[Skill_Name]].json        8 Lottie icons
/CV.pdf
```
Generate tasteful placeholders (flat cherry/matcha/cream blocks, labelled) for anything missing so
the build runs end-to-end. Every raster asset needs a `.webp` in `<picture>` with a `.png` fallback.

---

## 8. Quality bar

- Semantic HTML, one `<h1>`, labelled sections, `aria-label` on every icon button,
  `aria-hidden="true"` on decorative layers, `aria-expanded` on the hamburger.
- Keyboard: menu opens/closes with Enter/Escape, visible `:focus-visible` outlines, logical tab order,
  work cards reachable and activatable.
- Meta: title, description, Open Graph image, favicon, `theme-color: #670626`.
- Lazy-load below-fold images; preload the two hero textures and both font files.
- Lighthouse ≥90 performance, ≥95 accessibility. No console errors. Graceful WebGL fallback.

Deliver the full working Vite project plus a README covering `npm install`, `npm run dev`,
`npm run build`, and a map of which file owns which section.

---

## 9. Outstanding — to be supplied before final build

**Confirmed so far:** name = Sanika Joshi · both employers to be named on the site ·
7 work cards as specced in §4.3 · stats = 5+ years / 6+ organisations / 4+ industries.

Still needed:

| # | Item | Where it lands |
|---|---|---|
| 1 | **Hero headline** — pick one (see options below) | §4.1 |
| 2 | **Mental health organisation** — real name + logo | §4.3 cards 2–3, §4.5 marquee |
| 3 | **Children's bookstore** — real name + logo | §4.3 card 6, §4.5 marquee |
| 4 | **Email address** | §4.8 mail button + form endpoint |
| 5 | **LinkedIn URL** | §4.8 icon button |
| 6 | **Substack URL** | §4.6 final tile, §4.8 icon button |
| 7 | **Substack essays** — 6–10 titles + dates + URLs | §4.6 masonry tiles |
| 8 | **Humans of Bombay** — link to the published piece | §4.3 card 5 |
| 9 | **Django client brands** — any nameable publicly | §4.5 marquee (optional extras) |
| 10 | **CV / résumé PDF** | `/CV.pdf`, nav link |
| 11 | **Images** — portrait, 2 hero images, 7 case study + 7 hover images, ~6 book/bookstore photos | throughout |

### Hero headline options (line 1 / **stroked first word** + rest)

1. `Building` / **`brand`** ` voices`
2. `Making` / **`brands`** ` sound human`
3. `Writing` / **`in`** ` other people's voices`
4. `Translating` / **`brands`** ` into words`  ← *recommended*
5. `Working` / **`between`** ` the lines`
6. `Between` / **`strategy`** ` and execution`
7. `Connecting` / **`strategy`** ` to what ships`

Matching taglines (4 lines, alternating weight 300 / 500):
- **for 4:** With the ear of a / **ghostwriter** / and the discipline of an / **account lead**
- **for 6:** With the range of a / **publishing generalist** / and the rigour of a / **qualitative researcher**
- **for 1:** With the instincts of a / **storyteller** / and the calendar of an / **account manager**
