// ── Tethers v4: corner anchors, tilt-matrix glued, scroll-stable ──────────────
// Index page only. Reduced-motion and coarse-pointer aware.
(() => {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches
    || !window.matchMedia('(hover: hover)').matches) return;

  // Robust source selection: active switch → any switch → services section
  const srcEl = document.querySelector('#services .work-switch.is-active')
              || document.querySelector('#services .work-switch')
              || document.querySelector('#services');
  const grid  = document.getElementById('workCollageGrid');
  if (!srcEl || !grid) return;
  const panels = grid.querySelectorAll('.comic-panel');
  if (!panels.length) return;

  // ── Viewport helper ──────────────────────────────────────────────────────
  const vv = window.visualViewport;
  const getVP  = () => vv ? { ox: vv.offsetLeft, oy: vv.offsetTop } : { ox: 0, oy: 0 };
  const dprCap = () => Math.min(window.devicePixelRatio || 1, 2);

  const FALLBACK_RGB = [168, 85, 247];
  const MAIN_COUNT = 4, MICRO_COUNT = 2;

  // ── Canvas setup ─────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'workTetherCanvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:25;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  let raf = 0, activePanel = null;
  let fadeAlpha = 0, fadeDir = 0, startTime = 0;
  let srcPts = [], srcSeeds = [], anchors = [], filaments = [], bursts = [];
  let tetherRGB = FALLBACK_RGB.slice();
  let tiltEl = null, tiltLocalW = 0, tiltLocalH = 0;
  let panelRect = null, tiltOffset = [0, 0], tiltOrigin = [0, 0];
  let lastTiltUpdateAt = 0;
  let tiltCandidates = [];

  const rnd = (a, b) => Math.random() * (b - a) + a;

  function resize() {
    dpr = dprCap();
    W = Math.round((vv ? vv.width : window.innerWidth) * dpr);
    H = Math.round((vv ? vv.height : window.innerHeight) * dpr);
    canvas.width = W; canvas.height = H;
  }
  resize();

  function parseColorToRGB(color) {
    if (!color) return null;
    const s = color.trim();
    let m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const parts = m[1].split(',').map((x) => x.trim());
      if (parts.length < 3) return null;
      const r = parseFloat(parts[0]), g = parseFloat(parts[1]), b = parseFloat(parts[2]);
      const a = parts.length > 3 ? parseFloat(parts[3]) : 1;
      if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
      if (!Number.isFinite(a) || a <= 0) return null;
      return [Math.max(0, Math.min(255, Math.round(r))),
              Math.max(0, Math.min(255, Math.round(g))),
              Math.max(0, Math.min(255, Math.round(b)))];
    }
    m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      const h = m[1];
      if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    return null;
  }

  function captureTetherRGB() {
    const c = parseColorToRGB(getComputedStyle(srcEl).color);
    tetherRGB = c || FALLBACK_RGB.slice();
  }

  function toCanvas(vx, vy) {
    const vp = getVP();
    return [(vx - vp.ox) * dpr, (vy - vp.oy) * dpr];
  }

  function buildSourceSeeds(total) {
    const out = [];
    for (let i = 0; i < total; i++) {
      const t = total <= 1 ? 0.5 : i / (total - 1);
      const nx = 0.15 + t * 0.70 + rnd(-0.015, 0.015);
      const ny = 0.58 + rnd(-0.04, 0.04);
      out.push({
        nx: Math.max(0.12, Math.min(0.88, nx)),
        ny: Math.max(0.50, Math.min(0.74, ny)),
      });
    }
    return out;
  }

  function remapSourcePoints() {
    if (!srcSeeds.length) return;
    const r = srcEl.getBoundingClientRect();
    srcPts = srcSeeds.map((s) => toCanvas(r.left + r.width * s.nx, r.top + r.height * s.ny));
  }

  function parseOriginToken(tok, ref, axis) {
    if (!tok) return ref * 0.5;
    if (tok.endsWith('%')) return (parseFloat(tok) || 0) * 0.01 * ref;
    if (tok.endsWith('px')) return parseFloat(tok) || 0;
    if (axis === 'x') {
      if (tok === 'left') return 0;
      if (tok === 'center') return ref * 0.5;
      if (tok === 'right') return ref;
    } else {
      if (tok === 'top') return 0;
      if (tok === 'center') return ref * 0.5;
      if (tok === 'bottom') return ref;
    }
    const n = parseFloat(tok);
    return Number.isFinite(n) ? n : ref * 0.5;
  }

  function readOriginPx(el, w, h) {
    const cs = getComputedStyle(el);
    const bits = (cs.transformOrigin || '').trim().split(/\s+/);
    const ox = parseOriginToken(bits[0], w, 'x');
    const oy = parseOriginToken(bits[1] || bits[0], h, 'y');
    return [ox, oy];
  }

  function addCandidate(list, el) {
    if (!el || list.includes(el)) return;
    list.push(el);
  }

  function buildTiltCandidates(panel) {
    const list = [];
    addCandidate(list, panel);
    const kids = panel.children;
    for (let i = 0; i < kids.length && i < 6; i++) addCandidate(list, kids[i]);
    const first = panel.firstElementChild;
    if (first) {
      addCandidate(list, first);
      addCandidate(list, first.firstElementChild);
      addCandidate(list, first.lastElementChild);
    }
    return list;
  }

  function chooseTiltElement(panel, t0, t1) {
    for (let i = 0; i < tiltCandidates.length; i++) {
      const el = tiltCandidates[i];
      const a = t0.get(el) || 'none';
      const b = t1.get(el) || 'none';
      if (a !== b) return el;
    }
    if ((t1.get(panel) || 'none') !== 'none') return panel;
    for (let i = 0; i < tiltCandidates.length; i++) {
      const el = tiltCandidates[i];
      if ((t1.get(el) || 'none') !== 'none') return el;
    }
    return panel;
  }

  function sampleCandidateTransforms() {
    const map = new Map();
    for (let i = 0; i < tiltCandidates.length; i++) {
      const el = tiltCandidates[i];
      map.set(el, getComputedStyle(el).transform || 'none');
    }
    return map;
  }

  function primeTiltElement(panel) {
    tiltCandidates = buildTiltCandidates(panel);
    const s0 = sampleCandidateTransforms();
    requestAnimationFrame(() => {
      if (activePanel !== panel) return;
      const s1 = sampleCandidateTransforms();
      tiltEl = chooseTiltElement(panel, s0, s1);
      refreshTiltCache();
      updateAnchorsFromTilt();
    });
  }

  function refreshTiltCache() {
    if (!tiltEl || !activePanel) return;
    tiltLocalW = tiltEl.offsetWidth || 0;
    tiltLocalH = tiltEl.offsetHeight || 0;
    panelRect = activePanel.getBoundingClientRect();
    const tiltRect = tiltEl.getBoundingClientRect();
    tiltOffset = [tiltRect.left - panelRect.left, tiltRect.top - panelRect.top];
    tiltOrigin = readOriginPx(tiltEl, tiltLocalW, tiltLocalH);
  }

  function projectLocalPoint(localX, localY) {
    if (!tiltEl || !panelRect) return null;
    const tf = getComputedStyle(tiltEl).transform;
    const m = (!tf || tf === 'none') ? new DOMMatrix() : new DOMMatrix(tf);
    const ox = tiltOrigin[0], oy = tiltOrigin[1];
    const p = new DOMPoint(localX - ox, localY - oy, 0, 1).matrixTransform(m);
    const w = (p.w && Number.isFinite(p.w) && p.w !== 0) ? p.w : 1;
    return [panelRect.left + tiltOffset[0] + (p.x / w) + ox,
            panelRect.top  + tiltOffset[1] + (p.y / w) + oy];
  }

  function updateAnchorsFromTilt() {
    if (!tiltEl || !panelRect || tiltLocalW <= 0 || tiltLocalH <= 0) return;
    const inset = 1.5;
    const localPts = [
      [inset, inset],                              // top-left
      [Math.max(inset, tiltLocalW - inset), inset], // top-right
      [Math.max(inset, tiltLocalW - inset), Math.max(inset, tiltLocalH - inset)], // bottom-right
      [inset, Math.max(inset, tiltLocalH - inset)], // bottom-left
    ];
    anchors = localPts.map((pt) => {
      const projected = projectLocalPoint(pt[0], pt[1]);
      return projected ? toCanvas(projected[0], projected[1]) : [0, 0];
    });
  }

  // ── Recompute on scroll/resize while hovering ─────────────────────────────
  function recomputeRects() {
    if (!activePanel) return;
    remapSourcePoints();
    refreshTiltCache();
    updateAnchorsFromTilt();
  }
  let scrollTick = 0;
  const scheduleRecompute = () => {
    if (scrollTick || !activePanel) return;
    scrollTick = requestAnimationFrame(() => { scrollTick = 0; recomputeRects(); });
  };
  window.addEventListener('scroll', scheduleRecompute, { passive: true });
  window.addEventListener('resize', () => { resize(); scheduleRecompute(); }, { passive: true });
  if (vv) {
    vv.addEventListener('scroll', scheduleRecompute, { passive: true });
    vv.addEventListener('resize', () => { resize(); scheduleRecompute(); }, { passive: true });
  }

  // ── Bezier eval ──────────────────────────────────────────────────────────
  function bezPt(t, x0, y0, cx, cy, x1, y1) {
    const mt = 1 - t;
    return [mt*mt*x0 + 2*mt*t*cx + t*t*x1, mt*mt*y0 + 2*mt*t*cy + t*t*y1];
  }

  // ── Build filament configs ───────────────────────────────────────────────
  function buildFilaments() {
    filaments = [];
    const total = MAIN_COUNT + MICRO_COUNT;
    for (let i = 0; i < total; i++) {
      const isMain = i < MAIN_COUNT;
      filaments.push({
        ai:    i % anchors.length,
        si:    i % srcSeeds.length,
        ci:    0,
        freq:  rnd(0.5, 1.6),
        phase: rnd(0, Math.PI * 2),
        amp:   rnd(isMain ? 35 : 12, isMain ? 80 : 35) * dpr,
        ampY:  rnd(isMain ? 20 : 8,  isMain ? 50 : 20) * dpr,
        alpha: isMain ? rnd(0.65, 0.85) : rnd(0.22, 0.38),
        lw:    isMain ? rnd(1.2, 1.8) : rnd(0.6, 0.9),
        main:  isMain,
        spark: isMain ? { t: rnd(0, 1), spd: rnd(0.004, 0.010), dir: 1 } : null,
      });
    }
  }

  // ── Render one filament ──────────────────────────────────────────────────
  function drawFilament(f, elapsed, alpha) {
    if (!anchors[f.ai]) return;
    const [ax, ay] = anchors[f.ai];
    const [sx, sy] = srcPts[f.si] || srcPts[0] || [0, 0];
    const mx = (sx + ax) / 2 + Math.sin(elapsed * f.freq + f.phase) * f.amp;
    const my = (sy + ay) / 2 + Math.cos(elapsed * f.freq * 0.7 + f.phase) * f.ampY;
    const c = tetherRGB;
    const a = f.alpha * alpha;
    ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    if (f.main) {
      ctx.globalAlpha = a * 0.22; ctx.lineWidth = f.lw * dpr * 4;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ax, ay); ctx.stroke();
    }
    ctx.globalAlpha = a * (f.main ? 0.88 : 0.72);
    ctx.lineWidth   = f.lw * dpr;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ax, ay); ctx.stroke();
    if (f.main) {
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.5 + f.phase);
      const nr = (1.5 + pulse * 1.5) * dpr;
      ctx.globalAlpha = a * (0.65 + pulse * 0.35);
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath(); ctx.arc(sx, sy, nr, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(ax, ay, nr * 0.85, 0, 6.283); ctx.fill();
    }
    if (f.spark) {
      f.spark.t += f.spark.spd * f.spark.dir;
      if (f.spark.t > 1.05 || f.spark.t < -0.05) {
        f.spark.dir *= -1; f.spark.t = Math.max(0, Math.min(1, f.spark.t));
      }
      const [spx, spy] = bezPt(f.spark.t, sx, sy, mx, my, ax, ay);
      ctx.globalAlpha = a * 0.95; ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath(); ctx.arc(spx, spy, 1.5 * dpr, 0, 6.283); ctx.fill();
    }
  }

  // ── Contact bursts ────────────────────────────────────────────────────────
  function spawnBurst(bx, by, now) {
    for (let j = 0; j < 5; j++) {
      const a = rnd(0, Math.PI * 2), spd = rnd(1, 3) * dpr;
      bursts.push({ x: bx, y: by, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
                    st: now, life: rnd(200, 340), ci: 0 });
    }
  }

  // ── Main render loop ─────────────────────────────────────────────────────
  function render(now) {
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    fadeAlpha = fadeDir > 0
      ? Math.min(fadeAlpha + 0.07, 1)
      : fadeDir < 0
        ? Math.max(fadeAlpha - 0.06, 0)
        : fadeAlpha;
    if (activePanel && now - lastTiltUpdateAt >= 33) {
      lastTiltUpdateAt = now;
      updateAnchorsFromTilt();
    }
    const elapsed = (now - startTime) * 0.001;
    if (fadeAlpha > 0 && anchors.length > 0) {
      ctx.save();
      for (let i = 0; i < filaments.length; i++) drawFilament(filaments[i], elapsed, fadeAlpha);
      ctx.restore();
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; const age = now - b.st;
      if (age > b.life) { bursts.splice(i, 1); continue; }
      b.x += b.vx; b.y += b.vy; b.vx *= 0.91; b.vy *= 0.91;
      const c = tetherRGB;
      ctx.globalAlpha = (1 - age / b.life) * 0.9;
      ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 3, b.y - b.vy * 3); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const hasActivity = fadeAlpha > 0 || bursts.length > 0;
    if (hasActivity) { raf = requestAnimationFrame(render); }
    else { raf = 0; ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H); }
  }

  function fireArrivalBursts() {
    const now = performance.now();
    for (let i = 0; i < MAIN_COUNT; i++) {
      if (anchors[i]) spawnBurst(anchors[i][0], anchors[i][1], now);
    }
  }

  // ── Hover handlers ───────────────────────────────────────────────────────
  panels.forEach((panel) => {
    panel.addEventListener('pointerenter', () => {
      activePanel = panel;
      tiltEl = panel;
      lastTiltUpdateAt = 0;
      srcSeeds = buildSourceSeeds(MAIN_COUNT + MICRO_COUNT);
      captureTetherRGB();
      refreshTiltCache();
      remapSourcePoints();
      updateAnchorsFromTilt();
      primeTiltElement(panel);
      buildFilaments();
      fadeDir = 1; startTime = performance.now();
      if (!raf) raf = requestAnimationFrame(render);
      setTimeout(fireArrivalBursts, 120);
    }, { passive: true });

    panel.addEventListener('pointermove', () => {
      if (activePanel !== panel) return;
      updateAnchorsFromTilt();
    }, { passive: true });

    panel.addEventListener('pointerleave', () => {
      if (activePanel === panel) {
        activePanel = null;
        tiltEl = null;
        panelRect = null;
        tiltCandidates = [];
        fadeDir = -1;
      }
      if (!raf) raf = requestAnimationFrame(render);
    }, { passive: true });
  });
})();
