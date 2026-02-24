// ── Tethers v2.1: sticky edge-anchored filaments on work card hover ──────────
// Index page only. Edge-intersection anchors, scroll-stable, reduced-motion aware.
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

  const COLORS = [
    [68,  221, 255],  // ion cyan (primary)
    [168,  85, 247],  // purple
    [204,  85, 255],  // magenta
    [68,  136, 255],  // blue
  ];
  const MAIN_COUNT = 3, MICRO_COUNT = 2;

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
  let srcCenter = [0, 0], anchors = [], filaments = [], bursts = [];

  const rnd = (a, b) => Math.random() * (b - a) + a;

  function resize() {
    dpr = dprCap();
    W = Math.round((vv ? vv.width : window.innerWidth) * dpr);
    H = Math.round((vv ? vv.height : window.innerHeight) * dpr);
    canvas.width = W; canvas.height = H;
  }
  resize();

  // ── Source center at 60% down — hits the text, not the element midpoint ──
  function computeSrcCenter() {
    const r = srcEl.getBoundingClientRect(), vp = getVP();
    return [(r.left + r.width * 0.5 - vp.ox) * dpr,
            (r.top  + r.height * 0.60 - vp.oy) * dpr];
  }

  // ── Edge-intersection anchors ─────────────────────────────────────────────
  // Finds which card face the ray from source→card center hits, then spreads
  // MAIN_COUNT + MICRO_COUNT anchors along that edge — no random perimeter walk.
  function edgeAnchors(rect, count) {
    const vp = getVP();
    const { left, right, top, bottom, width, height } = rect;
    const srcVX = srcCenter[0] / dpr + vp.ox;
    const srcVY = srcCenter[1] / dpr + vp.oy;
    const cardCX = left + width * 0.5, cardCY = top + height * 0.5;
    const ddx = cardCX - srcVX, ddy = cardCY - srcVY;
    const dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    const ux = ddx / dlen, uy = ddy / dlen;
    const INSET = 5;
    const hits = [];
    const tryEdge = (t, x, y, edge) => {
      if (t > 0 && x >= left - 1 && x <= right + 1 && y >= top - 1 && y <= bottom + 1)
        hits.push({ t, x, y, edge });
    };
    if (Math.abs(ux) > 1e-4) {
      tryEdge((left  - srcVX) / ux, left,  srcVY + uy * (left  - srcVX) / ux, 'left');
      tryEdge((right - srcVX) / ux, right, srcVY + uy * (right - srcVX) / ux, 'right');
    }
    if (Math.abs(uy) > 1e-4) {
      tryEdge((top    - srcVY) / uy, srcVX + ux * (top    - srcVY) / uy, top,    'top');
      tryEdge((bottom - srcVY) / uy, srcVX + ux * (bottom - srcVY) / uy, bottom, 'bottom');
    }
    hits.sort((a, b) => a.t - b.t);
    const hit = hits[0] || { x: cardCX, y: cardCY, edge: 'bottom' };
    let bx = hit.x, by = hit.y;
    if (hit.edge === 'left')   bx += INSET;
    if (hit.edge === 'right')  bx -= INSET;
    if (hit.edge === 'top')    by += INSET;
    if (hit.edge === 'bottom') by -= INSET;
    const tgX = (hit.edge === 'left' || hit.edge === 'right') ? 0 : 1;
    const tgY = (hit.edge === 'left' || hit.edge === 'right') ? 1 : 0;
    const eLen = (hit.edge === 'left' || hit.edge === 'right') ? height : width;
    const spread = eLen * 0.22;
    const pts = [];
    for (let i = 0; i < count; i++) {
      const off = count > 1 ? (i / (count - 1) - 0.5) * 2 * spread : 0;
      let ax = bx + tgX * off, ay = by + tgY * off;
      ax = Math.max(left + INSET, Math.min(right - INSET, ax));
      ay = Math.max(top + INSET, Math.min(bottom - INSET, ay));
      pts.push([(ax - vp.ox) * dpr, (ay - vp.oy) * dpr]);
    }
    return pts;
  }

  // ── Recompute on scroll/resize while hovering ─────────────────────────────
  function recomputeRects() {
    if (!activePanel) return;
    srcCenter = computeSrcCenter();
    anchors   = edgeAnchors(activePanel.getBoundingClientRect(), MAIN_COUNT + MICRO_COUNT);
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
        ci:    i % COLORS.length,
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
    const [sx, sy] = srcCenter;
    const mx = (sx + ax) / 2 + Math.sin(elapsed * f.freq + f.phase) * f.amp;
    const my = (sy + ay) / 2 + Math.cos(elapsed * f.freq * 0.7 + f.phase) * f.ampY;
    const c = COLORS[f.ci];
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
      ctx.globalAlpha = a * 0.95; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(spx, spy, 1.5 * dpr, 0, 6.283); ctx.fill();
    }
  }

  // ── Contact bursts ────────────────────────────────────────────────────────
  function spawnBurst(bx, by, now) {
    for (let j = 0; j < 5; j++) {
      const a = rnd(0, Math.PI * 2), spd = rnd(1, 3) * dpr;
      bursts.push({ x: bx, y: by, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
                    st: now, life: rnd(200, 340), ci: j % COLORS.length });
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
      const c = COLORS[b.ci];
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
      srcCenter = computeSrcCenter();
      anchors   = edgeAnchors(panel.getBoundingClientRect(), MAIN_COUNT + MICRO_COUNT);
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
