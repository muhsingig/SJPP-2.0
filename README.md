# Sanika Joshi: Portfolio

Single-page portfolio built to [BUILD-PROMPT.md](BUILD-PROMPT.md): Vite + vanilla TypeScript, a
three.js fluid-reveal hero, GSAP/ScrollTrigger motion, in a cherry × matcha palette.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

`dist/` is a static folder: deploy it to Netlify, Vercel or Cloudflare Pages as-is.

---

## What lives where

| Path | Owns |
|---|---|
| `index.html` | All markup and copy for the nine sections |
| `src/main.ts` | Boot order for every section module |
| `src/styles/base.css` | Tokens, reset, snap stack, preloader, nav, hero, about |
| `src/styles/sections.css` | Work, skills, experience, writing, beyond, contact, footer, responsive |
| `src/hero/shaders.ts` | All GLSL: fluid, trail, mask, composite |
| `src/hero/fluid.ts` | Navier-Stokes solver (advect → divergence → Jacobi pressure → project) |
| `src/hero/index.ts` | Renderer, render targets, pointer, preloader, headline stroke |
| `src/sections/snap.ts` | Hero↔About snap, `--reveal-progress` word scrub, about layout fitting |
| `src/sections/nav.ts` | Menu open/close timelines, fit-to-viewport sizing, light/dark tone |
| `src/sections/work.ts` | Journal lines, caption auto-fit, hover-swap timing, reveals |
| `src/sections/skills.ts` | Per-letter title reveal (shared), card batch, optional Lottie icons |
| `src/sections/experience.ts` | Logo marquee, stat counters |
| `src/sections/recommendations.ts` | Title reveal for the LinkedIn recommendations band |
| `src/sections/writing.ts` | Shortest-column masonry for the Substack tiles |
| `src/sections/beyond.ts` | Velocity marquee, photo card stack |
| `src/sections/contact.ts` | Phone input, validation, AJAX submit, simple reveals |
| `scripts/gen-placeholders.mjs` | Generates every placeholder in `public/` |

---

## Content status

### Done

- **Contact**: `joshi.sanika3@gmail.com` on the mail button and the formsubmit endpoint;
  LinkedIn and Substack buttons live.
- **Portrait**: `public/display-picture.jpg`, 1400×1400 (square, cherry background).
- **Resume**: `public/Resume.pdf` is the real resume.
- **Essays**: five real Substack pieces, linked, titled and dated.
- **Employers**: Django, Amaha, The Kahani Tree, Myntmore, UAL, Humans of Bombay.

### Still outstanding

Search for `TODO` in `index.html` to find the inline markers.

1. **Recommendations**: `#recommendations` holds three `data-stub` cards. Replace each
   blockquote with a real excerpt, fill in name and role, and delete the `data-stub` attribute
   to bring the card up to full opacity.
2. **Four more essays**: tiles 6-9 in `#writing` are `data-stub` placeholders. Same deal: give
   one a real `href`, title and date, swap `<span>` for `<a>`, and drop `data-stub`.
3. **Case studies**: all seven `.work-card`s still carry placeholder copy and
   `data-desktop-url="#"` / `data-mobile-url="#"`. A card with `#` is inert.
4. **Logos**: currently generated text wordmarks. Real marks for five of the six have been
   sourced from the companies' own sites; Django is still missing.
5. **Hero headline**: currently option 4 of the seven in BUILD-PROMPT.md §9.
6. **Hero and "beyond" imagery**: see below.

### Replacing the imagery

`npm run placeholders` regenerates `public/`, but **it will not overwrite a file that already
exists**: real assets are safe. Pass `--force` if you genuinely want the placeholder back.
To use real assets, drop files in with the same names:

- `front.png` / `back.png`: the two hero photographs. **Give them the same composition**; the fluid
  reveal reads as one subject changing state, and unrelated images look like a glitch.
- `display-picture.jpg`: portrait.
- `case-study-1..7.png` and `case-study-N-hover.png`: one pair per card, portrait-ish crop.
- `logo-*.svg`: organisation wordmarks.
- `beyond1..6.png`: book/bookstore photography for the card stack, roughly 1.42:1.

The markup keeps `<picture>` wrappers, so adding a `<source srcset="…webp">` alongside each `<img>`
is a drop-in change.

### Skill icons

The eight icons are inline SVG. If you'd rather have animated ones, drop Bodymovin JSON into
`public/` matching each `data-lottie` filename (`social-strategy.json`, `content-strategy.json`, …)
and they'll be picked up automatically: the loader validates the JSON shape first and falls back to
the SVG, and `lottie-web` is only downloaded if at least one real animation is found.

---

## Notes on the implementation

**The hero.** Four passes per frame: a fluid velocity field driven by pointer splats, a decaying
trail buffer, a mask that integrates both and fades at the frame edges, and a composite that
cover-fits both photographs and mixes A→B through the mask. All tuning constants sit in `PARAMS` at
the top of `src/hero/index.ts`. The mask's gap terms were tuned by eye: the spec named the
parameters and their values but not the exact falloff curves.

**The scroll container is `.snap-stack`, not the window.** Every ScrollTrigger passes
`scroller: getScroller()`. Forgetting that is the most likely way to break a new section.

**The about section is exactly one viewport tall on desktop** (`height: 100svh` at ≥901px) because
the snap lands on it. `--profile-scale` shrinks the content to fit inside that box; `transform:
scale()` doesn't reflow, so the section has to be pinned rather than allowed to grow.

**Reduced motion is a real path, not an afterthought:** the fluid sim is skipped entirely in favour
of a static hero, marquees and counters resolve instantly, and every reveal starts at its end state.

### Two deliberate departures from the spec

1. **The writing masonry does not loop infinitely.** The spec inherited that from the reference
   site, where the tiles are paintings. Here each tile is a link to a real essay, and duplicating
   them would mean duplicate links for screen readers and crawlers. The masonry layout, hover and
   stagger all match; only the endless repetition is gone.
2. **`front.png`/`back.png` are generated abstracts, not photographs.** The reveal is tuned for two
   images that share a composition: worth re-checking the `PARAMS` feel once real photos land.

### Known trade-off

The main JS bundle is ~618 kB (175 kB gzipped), almost all of it three.js. `lottie-web` and
`intl-tel-input` are already split into lazy chunks. If the hero is ever dropped for a simpler
effect, the bundle falls by roughly two thirds.
