// ── Tethers v2: glowing filaments + micro-sparks on Work card hover ──────────
// Index page only. Self-contained. Shared visual style with approach tethers.
// Disabled on touch/no-hover devices and reduced-motion.
(() => {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches
    || !window.matchMedia('(hover: hover)').matches) return;

  const srcEl = document.querySelector('#services .work-switch.is-active');
  const grid  = document.getElementById('workCollageGrid');
  if (!srcEl || !grid) return;
  const panels = grid.querySelectorAll('.comic-panel');
  if (!panels.length) return;

  // ── Viewport helper ──────────────────────────────────────────────────────
  const _vp = (() => {
    const vv = window.visualViewport;
    function get() {
      if (vv) return { vw: vv.width, vh: vv.height, ox: vv.offsetLeft, oy: vv.offsetTop };
      return { vw: window.innerWidth, vh: window.innerHeight, ox: 0, oy: 0 };
    }
    return { get, dprCap: () => Math.min(window.devicePixelRatio || 1, 2) };
  })();

  // ── Shared filament drawing (used by approach tethers too via window._drawFilaments) ──
  const COLORS = [
    [68,  221, 255],  // ion cyan   (primary)
    [168,  85, 247],  // purple
    [204,  85, 255],  // magenta
    [68,  136, 255],  // blue
  ];
  const MAIN_COUNT = 3;   // main glowing filaments
  const MICRO_COUNT = 2;  // thin secondary strands

  // ── Canvas setup ─────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'workTetherCanvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:25;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  let raf = 0;
  let activePanel = null;
  let fadeAlpha = 0, fadeDir = 0;
  let startTime = 0;

  let srcCenter = [0, 0];
  let anchors   = [];   // [{x,y}] – target anchor points on card perimeter
  let filaments = [];   // cord configs
  let sparks    = [];   // travelling bright dots
  let bursts    = [];   // arrival micro-dashes

  const rnd = (a, b) => Math.random() * (b - a) + a;

  function resize() {
    const vp = _vp.get(); dpr = _vp.dprCap();
    W = Math.round(vp.vw * dpr); H = Math.round(vp.vh * dpr);
    canvas.width = W; canvas.height = H;
  }
  resize();
  window.addEventListener('resize', () => { resize(); recomputeRects(); }, { passive: true });

  // ── Rect helpers (no per-frame reads) ────────────────────────────────────
  function getCenter(el) {
    const r = el.getBoundingClientRect(), vp = _vp.get();
    return [(r.left + r.width / 2 - vp.ox) * dpr, (r.top + r.height / 2 - vp.oy) * dpr];
  }

  function perimeterAnchors(rect, count) {
    const vp = _vp.get();
    const { left, right, top, bottom, width, height } = rect;
    const peri = 2 * (width + height);
    const step = peri / count;
    const pts = [];
    for (let i = 0; i < count; i++) {
      let d = step * i + step * 0.1 + rnd(-step * 0.2, step * 0.2);
      d = ((d % peri) + peri) % peri;
      let x, y;
      if (d < width)                   { x = left + d;           y = top; }
      else if (d < width + height)     { x = right;              y = top + (d - width); }
      else if (d < 2 * width + height) { x = right - (d - width - height); y = bottom; }
      else                             { x = left;               y = bottom - (d - 2 * width - height); }
      pts.push([(x - vp.ox) * dpr, (y - vp.oy) * dpr]);
    }
    return pts;
  }

  function recomputeRects() {
    srcCenter = getCenter(srcEl);
    if (activePanel) {
      anchors = perimeterAnchors(activePanel.getBoundingClientRect(), MAIN_COUNT + MICRO_COUNT);
    }
  }

  let scrollTick = 0;
  window.addEventListener('scroll', () => {
    if (!scrollTick && activePanel) {
      scrollTick = requestAnimationFrame(() => { scrollTick = 0; recomputeRects(); });
    }
  }, { passive: true });

  // ── Bezier eval ──────────────────────────────────────────────────────────
  function bezPt(t, x0, y0, cx, cy, x1, y1) {
    const mt = 1 - t;
    return [mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
            mt * mt * y0 + 2 * mt * t * cy + t * t * y1];
  }

  // ── Build filament configs ───────────────────────────────────────────────
  function buildFilaments() {
    filaments = [];
    const total = MAIN_COUNT + MICRO_COUNT;
    for (let i = 0; i < total; i++) {
      const isMain = i < MAIN_COUNT;
      filaments.push({
        ai:    i % anchors.length,
        ci:    i % COLORS.length,
        freq:  rnd(0.5, 1.6),
        phase: rnd(0, Math.PI * 2),
        amp:   rnd(isMain ? 35 : 12, isMain ? 80 : 35) * dpr,
        ampY:  rnd(isMain ? 20 : 8,  isMain ? 50 : 20) * dpr,
        alpha: isMain ? rnd(0.55, 0.80) : rnd(0.18, 0.35),
        lw:    isMain ? rnd(1.0, 1.6) : rnd(0.5, 0.8),
        main:  isMain,
        // Spark: one per main filament
        spark: isMain ? { t: rnd(0, 1), spd: rnd(0.004, 0.010), dir: 1 } : null,
      });
    }
  }

  // ── Render one filament ──────────────────────────────────────────────────
  function drawFilament(f, elapsed, alpha) {
    if (!anchors[f.ai]) return;
    const [ax, ay] = anchors[f.ai];
    const [sx, sy] = srcCenter;
    const mx = (sx + ax) / 2 + Math.sin(elapsed * f.freq + f.phase) * f.amp;
    const my = (sy + ay) / 2 + Math.cos(elapsed * f.freq * 0.7 + f.phase) * f.ampY;
    const c = COLORS[f.ci];
    const a = f.alpha * alpha;

    ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;

    if (f.main) {
      // Outer glow layer
      ctx.globalAlpha = a * 0.18;
      ctx.lineWidth   = f.lw * dpr * 4;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ax, ay); ctx.stroke();
    }
    // Core
    ctx.globalAlpha = a * (f.main ? 0.82 : 0.70);
    ctx.lineWidth   = f.lw * dpr;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ax, ay); ctx.stroke();

    // Endpoint nodes (pulse)
    if (f.main) {
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.5 + f.phase);
      const nr = (1.5 + pulse * 1.5) * dpr;
      ctx.globalAlpha = a * (0.6 + pulse * 0.4);
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath(); ctx.arc(sx, sy, nr, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(ax, ay, nr * 0.85, 0, 6.283); ctx.fill();
    }

    // Micro-spark travelling along filament
    if (f.spark) {
      f.spark.t += f.spark.spd * f.spark.dir;
      if (f.spark.t > 1.05 || f.spark.t < -0.05) {
        f.spark.dir *= -1; f.spark.t = Math.max(0, Math.min(1, f.spark.t));
      }
      const [spx, spy] = bezPt(f.spark.t, sx, sy, mx, my, ax, ay);
      ctx.globalAlpha = a * 0.95;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(spx, spy, 1.5 * dpr, 0, 6.283); ctx.fill();
    }
  }

  // ── Contact bursts (on arrival) ──────────────────────────────────────────
  function spawnBurst(bx, by, now) {
    for (let j = 0; j < 5; j++) {
      const a = rnd(0, Math.PI * 2), spd = rnd(1, 3) * dpr;
      bursts.push({ x: bx, y: by, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
                    st: now, life: rnd(200, 340), ci: j % COLORS.length });
    }
  }

  // ── Main render loop ─────────────────────────────────────────────────────
  function render(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    fadeAlpha = fadeDir > 0
      ? Math.min(fadeAlpha + 0.07, 1)
      : fadeDir < 0
        ? Math.max(fadeAlpha - 0.06, 0)
        : fadeAlpha;

    const elapsed = (now - startTime) * 0.001;

    if (fadeAlpha > 0 && anchors.length > 0) {
      ctx.save();
      for (let i = 0; i < filaments.length; i++) drawFilament(filaments[i], elapsed, fadeAlpha);
      ctx.restore();
    }

    // Bursts
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      const age = now - b.st;
      if (age > b.life) { bursts.splice(i, 1); continue; }
      b.x += b.vx; b.y += b.vy; b.vx *= 0.91; b.vy *= 0.91;
      const c = COLORS[b.ci];
      ctx.globalAlpha = (1 - age / b.life) * 0.9;
      ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.lineWidth   = 2 * dpr;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 3, b.y - b.vy * 3); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    const hasActivity = fadeAlpha > 0 || bursts.length > 0;
    if (hasActivity) { raf = requestAnimationFrame(render); }
    else { raf = 0; ctx.clearRect(0, 0, W, H); }
  }

  // ── Fire arrival bursts once filaments are in place ──────────────────────
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
      srcCenter = getCenter(srcEl);
      anchors = perimeterAnchors(panel.getBoundingClientRect(), MAIN_COUNT + MICRO_COUNT);
      buildFilaments();
      fadeDir = 1; startTime = performance.now();
      if (!raf) raf = requestAnimationFrame(render);
      setTimeout(fireArrivalBursts, 120);
    }, { passive: true });

    panel.addEventListener('pointerleave', () => {
      if (activePanel === panel) { activePanel = null; fadeDir = -1; }
      if (!raf) raf = requestAnimationFrame(render);
    }, { passive: true });
  });
})();
