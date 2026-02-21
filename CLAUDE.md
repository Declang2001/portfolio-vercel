# CLAUDE.md

## Project Goal

Portfolio site with bold interactive animation. Must feel best-in-class while staying fast and stable on Vercel.

## Non-negotiables

- **No local media.** All videos/images served from Cloudinary CDN (`res.cloudinary.com/ddpcw88mj`). See `MEDIA_MAP.md` for asset inventory.
- **Preserve existing behavior.** Don't break animations or interactions unless explicitly asked.
- **Respect `prefers-reduced-motion`.** Provide toned-down fallbacks for all motion.

## Performance

- Target 60fps. Avoid layout thrash.
- Prefer `transform` and `opacity` over properties that trigger layout/paint.
- Use `requestAnimationFrame` for JS animation loops.
- No heavy libraries without justification. This is a static site—keep it light.

### Animation System Rules

- **No per-frame `getBoundingClientRect`.** Cache rect data on init, resize, and throttled scroll only.
- **DPR capped at 2** for all canvas elements (drift, handoff overlay, work tethers).
- All canvas overlays use `pointer-events: none`.
- Particle counts scaled by canvas area with min/max caps (2000–8000 for drift).

## Code Style

- Match patterns in `index.html`, `script.js`, `approach.html`.
- Keep functions small. Name things clearly.
- Comment only the non-obvious.

## When Changing Animation Code

1. Describe what changed and why.
2. State how you verified it (browser test, DevTools Performance tab, etc.).

## Commands

This is a static site with no build step.

```bash
# Local development
npx serve .                    # or: python3 -m http.server 8000

# Deploy (if Vercel CLI installed)
vercel                         # preview deploy
vercel --prod                  # production deploy

# Sanity checks before commit
git diff --stat                # review what changed
# Required check before any commit — no local media refs allowed
grep -R -n -E '\b(\./)?(videos/|images/)?[A-Za-z0-9_-]+\.(mp4|mov|webm|jpg|jpeg|png|gif|webp)\b' . | grep -v 'res\.cloudinary\.com' | grep -v '\.git' | grep -v 'MEDIA_MAP\.md'
```

- **Never commit or push changes unless Declan explicitly approves after reviewing `git diff` output.**

## File Structure

- `index.html` — Home page with work collage grid, skills console, accent comet
- `approach.html` — Approach page with drift canvas hero and collage rail
- `contact.html` — Contact page
- `script.js` — All interactivity and animation logic (drift engine, handoff, collage rail, comet, etc.)
- `style.css` — All styles
- `index-work-tethers.js` — Work grid hover tethers (index page only)
- `case-study.css` — Case study layout and styles
- `case-study.js` — Case study interactions (tabs, modal, scroll-reveal)
- `case-study-comet.js` — Accent comet particles for case study pages
- `pacifico.html` — Pacifico Dance Company case study
- `work-01` through `work-06` `.html` — Individual work/case study pages
- `MEDIA_MAP.md` — Cloudinary asset inventory

## Approach Page Architecture (Desktop, >= 1200px)

### Drift Canvas Hero

The hero uses a procedural particle system rendered on `<canvas id="approachDriftCanvas">`. No video asset is needed — the drift is fully code-generated.

**Key constants** (script.js, drift IIFE):
- `PTR_RADIUS = 320` — pointer interaction radius (canvas px)
- `PTR_FORCE = 0.14` — pointer force strength
- `DPR cap = 2` — `Math.min(devicePixelRatio, 2)`
- Particle count: `clamp(W * H / 400, 2000, 8000)`

**Sizing:** Canvas backing store uses `offsetWidth`/`offsetHeight` (CSS layout dimensions, immune to parent `transform: scale3d()`). This avoids the blur that `getBoundingClientRect` would cause when the wrapper is scaled down at page load.

**Pointer interaction:** Events bound to `window` (not the canvas). Coordinates mapped via ratio: `((clientX - rect.left) / rect.width) * canvasWidth`. Cached `canvasRect { left, top, width, height }` updated on resize and throttled scroll.

**Scroll behavior:** As the user scrolls, the wrapper scales from 0.62 to cover scale, opacity fades in, and drift intensity ramps up. `drift.updateRect()` is called inside the scroll handler.

**Reduced motion:** Renders a single static frame on init; no animation loop runs.

### Handoff Overlay

A separate fixed-position overlay canvas (`z-index: 50; pointer-events: none`) renders messenger particles that travel from the drift area to the `h2.approach-title` heading below.

- **Trigger:** `IntersectionObserver` on `.approach-title` (threshold 0.5), one-shot per scroll entry
- **Effect:** 18 messengers with easeOutCubic travel (550–950ms), contact burst (5 micro-dashes) on arrival, then a color pulse on the heading after 750ms delay
- **Why overlay?** The drift canvas is inside `.approach-hero-video-wrapper` which has `overflow: hidden`. Messengers need to travel outside that container to reach the heading.

### Pinned Collage Rail

The six collage cards scroll horizontally while the user scrolls vertically. No horizontal gesture required.

**Markup wrappers** (approach.html):
```
.collage-scroll-section#collageScrollSection   ← sets tall height for vertical runway
  .collage-scroll-pin#collageScrollPin         ← position:sticky pins the viewport
    .collage-stack#collageStack                ← flex row of 6 collage-panel cards
```

**CSS** (style.css, `@media (min-width: 1200px)`):
- `.collage-scroll-pin` is `position: sticky; top: calc(var(--header-height) + 24px)`
- `.collage-stack` uses `overflow-x: hidden` — JS drives `scrollLeft`, not the user
- `--railPadExtra` CSS variable is set by JS to center the first card at scroll start
- `.collage-panel` has `transform-style: preserve-3d; will-change: transform, opacity` for 3D depth effect

**JS** (script.js, `initPinnedCollageScroll()`):
- `recalc()` computes `scrollDistance`, sets `--railPadExtra` for first-card centering, sets section height to `pinH + scrollDistance + endBufferPx`
- `sync()` maps `window.scrollY` progress to `stack.scrollLeft` and applies per-panel 3D transforms (rotateY, translateZ, scale, opacity)
- End buffer (~260px) keeps the rail pinned after the last card so users can interact before release
- `ResizeObserver` + `window.load` + `resize` all trigger `recalc()`
- 3D transforms skipped when `prefers-reduced-motion: reduce`

### Sliver UI (Inside Each Card)

Each card's tiles display as narrow "slivers" that expand on hover.

**Key selectors:**
- `.approach-page .approach-grid.sliverTrack` — converts the grid to a flex sliver row
- `.approach-grid.sliverTrack .approach-tile` — each sliver, `flex: 0 0 var(--sliverW)`, expands to `--expandedW` on hover
- `.approach-grid.sliverTrack .approach-caption` — bottom-anchored, hidden until hover/focus

**Reduced motion:** `@media (min-width: 1200px) and (prefers-reduced-motion: reduce)` disables sliver hover transforms and card 3D transforms.

### Video Preview Modal

Click any sliver tile to open a fullscreen preview modal.
- Videos in the modal play **unmuted** (with native controls) if the browser allows it; falls back to muted on autoplay policy rejection
- Slivers in the cards are **always muted**
- Close via `×` button, click outside, or `Escape`

### Dev Gotchas

- **Header variable:** Sticky offset uses `--header-height` (defined as `64px` in `:root`). The legacy alias `--wcs-header-height` exists but the pinned rail uses `--header-height` directly.
- **Resize recalc:** Any change to stack content (lazy video load, font swap) triggers `ResizeObserver` → `recalc()`. If you add cards, no JS changes needed — `querySelectorAll('.collage-panel')` picks them up.
- **Mobile/tablet:** The wrappers and sliver classes exist in the DOM but have no desktop-only styles applied. Mobile uses the original `.approach-grid` grid layout unchanged.
- **Adding/swapping a video:** Update the `src` in approach.html, update `MEDIA_MAP.md`, and verify with the local-media grep in Commands above.

## Index Work Tethers

`index-work-tethers.js` is loaded `defer` on `index.html` only. It draws drift cords and messenger particles between the "work" heading link and hovered work collage cards.

- **Source:** `document.querySelector('#services .work-switch.is-active')` — the active "work" link text
- **Target:** Border anchor points distributed around the hovered `.comic-panel` perimeter via `borderAnchorsFromRect()`
- **Visuals:** 7 drift cords (bezier with oscillation) + 8 messengers with contact burst (4 micro-dashes each)
- **Canvas:** Fixed overlay, `z-index: 25`, `pointer-events: none`
- **Lifecycle:** RAF runs only during hover; throttled scroll recompute for rect caching
- **Reduced motion:** Entire system skips if `prefers-reduced-motion: reduce`

## Case Study Pages

Shared across all case study pages (`pacifico.html`, `work-01` through `work-06`):

- **`case-study.css`** — Editorial layout namespaced under `.cs`. Sections: hero (kicker/title/subtitle), meta cards, triad (brief/build/result), gallery with lightbox modal, tabbed deep-dive. Responsive at 900px, 768px, 480px.
- **`case-study.js`** — Scroll-reveal (IntersectionObserver), gallery modal with keyboard nav (Escape, arrows, Tab trap), hover particle effect on meta/triad cards, tabbed deep-dive (ARIA-compliant, arrow keys, sliding indicator).
- **`case-study-comet.js`** — Accent comet particle overlay for case study pages.

All three files are loaded on case study pages only. The `.cs` wrapper on `<main>` gates JS initialization.

## Cleanup Candidates

Items that appear unused but should be verified before removal:

| Item | Why it seems unused | Verify before removing |
|------|-------------------|----------------------|
| `intro.mp4` in Cloudinary | No longer referenced in any HTML — approach hero is now canvas-based drift | Check if any other page or JS references it; check Cloudinary usage stats |
