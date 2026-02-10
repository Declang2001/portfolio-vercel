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
grep -rn "\.mp4\|\.jpg" *.html *.js | grep -v cloudinary  # ensure no local media refs
```

## File Structure

- `index.html` — Home page with video grid tiles
- `approach.html` — Approach page with video showcases
- `contact.html` — Contact page
- `script.js` — All interactivity and animation logic
- `style.css` — All styles
- `MEDIA_MAP.md` — Cloudinary asset inventory
