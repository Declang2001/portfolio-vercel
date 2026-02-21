// ── Octo Tether: drift cords + messenger particles on Work card hover ──
// Self-contained. Index page only. No interference with comet or hover/tilt.
// Disabled on touch devices (no hover) and when reduced motion is preferred.
(() => {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Skip on touch/no-hover devices — hover-only system has no purpose on mobile
  if (window.matchMedia('(pointer: coarse)').matches
    || !window.matchMedia('(hover: hover)').matches) return;

  // ── Source: the "work" link text inside the Work heading ──
  const srcEl = document.querySelector('#services .work-switch.is-active');
  const grid = document.getElementById('workCollageGrid');
  if (!srcEl || !grid) return;

  const panels = grid.querySelectorAll('.comic-panel');
  if (!panels.length) return;

  // ── Viewport helper (self-contained version for this file) ──
  const _vp = (() => {
    const vv = window.visualViewport;
    function get() {
      if (vv) return { vw: vv.width, vh: vv.height, ox: vv.offsetLeft, oy: vv.offsetTop };
      return { vw: window.innerWidth, vh: window.innerHeight, ox: 0, oy: 0 };
    }
    function dprCap() { return Math.min(window.devicePixelRatio || 1, 2); }
    return { get, dprCap };
  })();

  // ── Canvas setup ──
  const canvas = document.createElement('canvas');
  canvas.id = 'workTetherCanvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:25;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Colors: accent purple + cool tones
  const COLORS = [
    [168, 85, 247],  // purple
    [68, 136, 255],  // blue
    [68, 221, 255],  // cyan
  ];
  const CORD_COUNT = 7;
  const MSG_COUNT = 8;

  let W = 0, H = 0, dpr = 1;
  let raf = 0;
  let activePanel = null;
  let fadeAlpha = 0;
  let fadeDir = 0;
  let startTime = 0;

  // Cached rects (updated on hover-start, resize, and throttled scroll)
  let srcCenter = [0, 0];
  let anchors = [];

  // Messenger state
  let messengers = [];

  // Contact burst state
  let bursts = [];

  // Cord state
  let cords = [];

  const rnd = (a, b) => Math.random() * (b - a) + a;

  function resize() {
    const vp = _vp.get();
    dpr = _vp.dprCap();
    W = Math.round(vp.vw * dpr);
    H = Math.round(vp.vh * dpr);
    canvas.width = W;
    canvas.height = H;
  }
  resize();
  window.addEventListener('resize', () => { resize(); recomputeRects(); }, { passive: true });

  // ── Rect helpers (no per-frame reads) ──
  function getCenter(el) {
    const r = el.getBoundingClientRect();
    const vp = _vp.get();
    return [(r.left + r.width / 2 - vp.ox) * dpr, (r.top + r.height / 2 - vp.oy) * dpr];
  }

  function borderAnchorsFromRect(rect, count) {
    const vp = _vp.get();
    const pts = [];
    const w = rect.width, h = rect.height;
    const peri = 2 * (w + h);
    const step = peri / count;
    for (let i = 0; i < count; i++) {
      let d = step * i + step * 0.15 + rnd(-step * 0.25, step * 0.25);
      d = ((d % peri) + peri) % peri;
      let x, y;
      if (d < w) {
        x = rect.left + d; y = rect.top;
      } else if (d < w + h) {
        x = rect.right; y = rect.top + (d - w);
      } else if (d < 2 * w + h) {
        x = rect.right - (d - w - h); y = rect.bottom;
      } else {
        x = rect.left; y = rect.bottom - (d - 2 * w - h);
      }
      pts.push([(x - vp.ox) * dpr, (y - vp.oy) * dpr]);
    }
    return pts;
  }

  function recomputeRects() {
    srcCenter = getCenter(srcEl);
    if (activePanel) {
      const r = activePanel.getBoundingClientRect();
      anchors = borderAnchorsFromRect(r, CORD_COUNT);
    }
  }

  // Throttled scroll recompute
  let scrollTick = 0;
  window.addEventListener('scroll', () => {
    if (!scrollTick && activePanel) {
      scrollTick = requestAnimationFrame(() => {
        scrollTick = 0;
        recomputeRects();
      });
    }
  }, { passive: true });

  // ── Cord data ──
  function buildCords() {
    cords = [];
    for (let i = 0; i < CORD_COUNT; i++) {
      cords.push({
        ci: i % COLORS.length,
        freq: rnd(0.6, 1.8),
        phase: rnd(0, Math.PI * 2),
        amp: rnd(20, 55) * dpr,
        ampY: rnd(15, 40) * dpr,
        alpha: rnd(0.12, 0.30),
        lw: rnd(0.8, 1.5)
      });
    }
  }

  // ── Messenger data ──
  function fireMessengers() {
    messengers = [];
    const now = performance.now();
    for (let i = 0; i < MSG_COUNT; i++) {
      // Each messenger targets a random anchor
      const ai = (i % anchors.length);
      const [tx, ty] = anchors[ai] || [0, 0];
      // Slight spread around source
      const a = rnd(0, Math.PI * 2), d = rnd(3, 15) * dpr;
      const sx = srcCenter[0] + Math.cos(a) * d;
      const sy = srcCenter[1] + Math.sin(a) * d;
      messengers.push({
        x: sx, y: sy, lx: sx, ly: sy,
        sx, sy, tx, ty,
        st: now + rnd(0, 100),
        dur: rnd(280, 550),
        arrived: false,
        burstFired: false
      });
    }
  }

  function updateMessengers(now) {
    let allDone = true;
    for (let i = 0; i < messengers.length; i++) {
      const m = messengers[i];
      if (m.arrived) {
        // Fire contact burst once on arrival
        if (!m.burstFired) {
          m.burstFired = true;
          spawnBurst(m.tx, m.ty, now);
        }
        continue;
      }
      const elapsed = now - m.st;
      if (elapsed < 0) { allDone = false; continue; }
      const t = Math.min(elapsed / m.dur, 1);
      const e = 1 - (1 - t) * (1 - t) * (1 - t);
      m.lx = m.x; m.ly = m.y;
      m.x = m.sx + (m.tx - m.sx) * e;
      m.y = m.sy + (m.ty - m.sy) * e;
      if (t >= 1) m.arrived = true;
      else allDone = false;
    }
    return allDone;
  }

  // ── Contact burst (micro-dashes on arrival) ──
  function spawnBurst(bx, by, now) {
    for (let j = 0; j < 4; j++) {
      const a = rnd(0, Math.PI * 2);
      const spd = rnd(0.8, 2.5) * dpr;
      bursts.push({
        x: bx, y: by,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        st: now,
        life: rnd(180, 300),
        ci: 0
      });
    }
  }

  function updateBursts(now) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      const age = now - b.st;
      if (age > b.life) { bursts.splice(i, 1); continue; }
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.92; b.vy *= 0.92;
    }
  }

  // ── Render ──
  function render(now) {
    ctx.clearRect(0, 0, W, H);

    // Fade logic
    if (fadeDir > 0) {
      fadeAlpha = Math.min(fadeAlpha + 0.07, 1);
      if (fadeAlpha >= 1) fadeDir = 0;
    } else if (fadeDir < 0) {
      fadeAlpha = Math.max(fadeAlpha - 0.06, 0);
    }

    const elapsed = (now - startTime) * 0.001;

    // Draw cords
    if (fadeAlpha > 0 && anchors.length > 0) {
      for (let i = 0; i < cords.length; i++) {
        const c = cords[i];
        const [ax, ay] = anchors[i] || anchors[0];
        const mx = (srcCenter[0] + ax) / 2;
        const my = (srcCenter[1] + ay) / 2;

        const wave = Math.sin(elapsed * c.freq + c.phase) * c.amp;
        const waveY = Math.cos(elapsed * c.freq * 0.7 + c.phase) * c.ampY;
        const cpx = mx + wave;
        const cpy = my + waveY;

        const col = COLORS[c.ci];
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(c.alpha * fadeAlpha).toFixed(3)})`;
        ctx.lineWidth = c.lw * dpr;
        ctx.beginPath();
        ctx.moveTo(srcCenter[0], srcCenter[1]);
        ctx.quadraticCurveTo(cpx, cpy, ax, ay);
        ctx.stroke();
      }
    }

    // Draw messengers
    const msgDone = updateMessengers(now);
    for (let i = 0; i < messengers.length; i++) {
      const m = messengers[i];
      if (m.arrived) continue;
      const col = COLORS[0];
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.95)`;
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.moveTo(m.lx, m.ly);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
    }

    // Draw bursts
    updateBursts(now);
    for (let i = 0; i < bursts.length; i++) {
      const b = bursts[i];
      const age = now - b.st;
      const fade = 1 - age / b.life;
      const col = COLORS[b.ci];
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(fade * 0.9).toFixed(2)})`;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 3, b.y - b.vy * 3);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Continue loop?
    const hasActivity = fadeAlpha > 0 || !msgDone || bursts.length > 0;
    if (hasActivity) {
      raf = requestAnimationFrame(render);
    } else {
      raf = 0;
      ctx.clearRect(0, 0, W, H);
    }
  }

  function startLoop() {
    if (!raf) raf = requestAnimationFrame(render);
  }

  // ── Hover handlers ──
  panels.forEach((panel) => {
    panel.addEventListener('pointerenter', () => {
      activePanel = panel;

      // Compute rects once on hover start
      srcCenter = getCenter(srcEl);
      const r = panel.getBoundingClientRect();
      anchors = borderAnchorsFromRect(r, CORD_COUNT);

      buildCords();
      fireMessengers();

      fadeDir = 1;
      startTime = performance.now();
      startLoop();
    }, { passive: true });

    panel.addEventListener('pointerleave', () => {
      if (activePanel === panel) {
        activePanel = null;
        fadeDir = -1;
        startLoop();
      }
    }, { passive: true });
  });
})();
