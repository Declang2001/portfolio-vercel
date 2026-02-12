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

- `index.html` — Home page with video grid tiles
- `approach.html` — Approach page with video showcases
- `contact.html` — Contact page
- `script.js` — All interactivity and animation logic
- `style.css` — All styles
- `MEDIA_MAP.md` — Cloudinary asset inventory

## Approach Page Architecture (Desktop, >= 1200px)

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
