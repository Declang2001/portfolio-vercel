# AGENTS.md — Agent Workflow & Constraints

## 1. PROJECT

- **Name:** Portfolio_Vercel
- **Goal:** Premium, employer-friendly interactions

## 2. NON-NEGOTIABLE CONSTRAINTS

- No libraries
- Do not refactor unrelated systems
- No continuous per-frame DOM layout reads (`getBoundingClientRect` only on init, hover start, resize throttled, and event-driven scroll updates while active)
- Must work on iOS Safari + desktop Chrome/Safari
- Must respect `prefers-reduced-motion: reduce`
- Preserve "no trails / no residue" guarantee on any canvas
- Do not touch Cloudinary URLs or captions

## 3. REQUIRED WORKFLOW

**Before edits:** output a short plan + risks + exact files/sections to be touched, then STOP.

**After edits, output ONLY:**

- `node -c script.js` result (if touched)
- `node -c index-work-tethers.js` result (if touched)
- `git diff --stat`
- Manual test checklist (10 lines max)

## 4. DEFAULT SCOPE

Prefer touching only `script.js` and `index-work-tethers.js` unless explicitly requested otherwise.
Keep changes minimal, targeted, reversible.
