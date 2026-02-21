/* ============================================================
   case-study-comet.js — Accent comet overlay for case study pages
   Self-contained. Does NOT touch script.js or the index comet.
   ============================================================ */
(function () {
  'use strict';

  const titleEl = document.querySelector('.cs-hero .cs-title');
  if (!titleEl) return;

  // ── Collect all target elements ──
  const metaItems = Array.from(document.querySelectorAll('.cs-hero .cs-meta-item'));
  const triadCols = Array.from(document.querySelectorAll('.cs-triad-col'));
  const mediaEls  = Array.from(document.querySelectorAll('.cs-gallery .cs-media'));
  const tabEls    = Array.from(document.querySelectorAll('.cs-tabs .cs-tab'));

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced) {
    titleEl.style.setProperty('--cs-flow-p', '1');
    // Wire hover highlighting without canvas
    const allTargets = [titleEl, ...metaItems, ...triadCols, ...mediaEls, ...tabEls];
    allTargets.forEach((el) => {
      el.addEventListener('pointerenter', () => {
        titleEl.style.setProperty('--cs-flow-p', '0');
        el.style.setProperty('--cs-flow-p', '1');
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--cs-flow-p', '0');
        titleEl.style.setProperty('--cs-flow-p', '1');
      });
    });
    return;
  }

  // ── Tuning ──
  const COMET_DURATION  = 700;
  const HOVER_DURATION  = 450;
  const TAIL_LIFE_BASE  = 150;
  const TAIL_LIFE_RAND  = 80;
  const TAIL_SPAWN      = 10;
  const BACKTRACK_N     = 8;
  const TAIL_CAP        = 1200;
  const HEAD_RADIUS     = 4;
  const BEZIER_CURVE    = 0.25;
  const SPARKLE_CHANCE  = 0.10;
  const POINTER_OFFSET  = 6;
  const INTRO_DELAY     = 1500;
  const LEAVE_DEBOUNCE  = 80;

  // ── Accent color ──
  let aR = 168, aG = 85, aB = 247;
  const parseAccent = () => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--cs-accent').trim() || '#a855f7';
    const d = document.createElement('div');
    d.style.color = raw;
    document.body.appendChild(d);
    const c = getComputedStyle(d).color;
    document.body.removeChild(d);
    const m = c.match(/(\d+)/g);
    if (m) { aR = +m[0]; aG = +m[1]; aB = +m[2]; }
  };

  // ── Seeded PRNG (mulberry32) ──
  const baseSeed = (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? crypto.getRandomValues(new Uint32Array(1))[0]
    : (Date.now() * 9301 + 49297) >>> 0;
  const seed32 = (s) => () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ── Utilities ──
  const smoothstep = (t) => t * t * (3 - 2 * t);

  const glyphRect = (el) => {
    if (!el) return null;
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = r.getClientRects();
    return rects.length ? rects[0] : r.getBoundingClientRect();
  };

  // ── Viewport helper (self-contained for this file) ──
  const _vp = (() => {
    const vv = window.visualViewport;
    const coarse = window.matchMedia('(pointer: coarse)').matches
      || !window.matchMedia('(hover: hover)').matches;
    function get() {
      if (vv) return { vw: vv.width, vh: vv.height, ox: vv.offsetLeft, oy: vv.offsetTop };
      return { vw: window.innerWidth, vh: window.innerHeight, ox: 0, oy: 0 };
    }
    function dprCap() { return Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2); }
    return { get, dprCap };
  })();

  // ── Canvas setup ──
  const canvas = document.createElement('canvas');
  canvas.id = 'csAccentParticles';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998;opacity:0;transition:opacity .3s';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let dpr = _vp.dprCap();

  const resizeCanvas = () => {
    const vp = _vp.get();
    dpr = _vp.dprCap();
    canvas.width  = Math.round(vp.vw * dpr);
    canvas.height = Math.round(vp.vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resizeCanvas();
  let _rcRaf = 0;
  const resizeThrottled = () => { if (!_rcRaf) _rcRaf = requestAnimationFrame(() => { _rcRaf = 0; resizeCanvas(); }); };
  window.addEventListener('resize', resizeThrottled, { passive: true });
  window.addEventListener('orientationchange', resizeThrottled, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeThrottled, { passive: true });
  }

  // ── Stops ──
  // stop 0 = title, then meta, triad, media, tabs
  const STOPS = [
    { posEl: titleEl, varEl: titleEl, kind: 'title', centerLock: false }
  ];
  metaItems.forEach(el => STOPS.push({ posEl: el, varEl: el, kind: 'meta', centerLock: false }));
  triadCols.forEach(el => STOPS.push({ posEl: el, varEl: el, kind: 'triad', centerLock: false }));
  mediaEls.forEach(el  => STOPS.push({ posEl: el, varEl: el, kind: 'media', centerLock: true }));
  tabEls.forEach(el    => STOPS.push({ posEl: el, varEl: el, kind: 'tab', centerLock: false }));

  // ── State ──
  let activeIdx      = -1;
  let cometActive    = false;
  let cometFromPt    = null;
  let cometToIdx     = -1;
  let cometStartTime = 0;
  let activeDuration = COMET_DURATION;
  let tailParticles  = [];
  let rafId          = 0;
  let flightId       = 0;
  let flightRng      = seed32(baseSeed);
  let prevHead       = null;
  let lastPointer    = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let hoveredIdx     = -1;
  let leaveTimer     = 0;

  // ── CSS var helpers ──
  const setFlowP = (idx, val) => {
    if (idx < 0 || idx >= STOPS.length) return;
    STOPS[idx].varEl.style.setProperty('--cs-flow-p', val.toFixed(3));
  };

  const setActive = (idx, on) => {
    setFlowP(idx, on ? 1 : 0);
  };

  // ── Bezier path ──
  const getPath = (fromPt, toIdx) => {
    const toStop = STOPS[toIdx];
    const dr = toStop.posEl.getBoundingClientRect();

    // Pointer offset: skip for centerLock stops (media)
    let offX = 0, offY = 0;
    if (!toStop.centerLock) {
      offX = (lastPointer.x - (dr.left + dr.width / 2)) * 0.02;
      offY = (lastPointer.y - (dr.top + dr.height / 2)) * 0.02;
    }
    const capOff = (v) => Math.max(-POINTER_OFFSET, Math.min(POINTER_OFFSET, v));

    let sx, sy;
    if (typeof fromPt === 'object' && fromPt.x !== undefined) {
      sx = fromPt.x;
      sy = fromPt.y;
    } else {
      const sr = STOPS[fromPt].posEl.getBoundingClientRect();
      sx = sr.left + sr.width / 2;
      sy = sr.top  + sr.height / 2;
    }

    const dx = dr.left + dr.width / 2 + capOff(offX);
    const dy = dr.top  + dr.height / 2 + capOff(offY);

    const mx = (sx + dx) / 2;
    const my = (sy + dy) / 2;
    const dist = Math.hypot(dx - sx, dy - sy);
    const side = flightRng() > 0.5 ? 1 : -1;
    const jitter = 0.85 + flightRng() * 0.30;
    const nx = -(dy - sy) / (dist || 1);
    const ny = (dx - sx) / (dist || 1);
    const offset = dist * BEZIER_CURVE * jitter * side;
    const pNoise = (flightRng() - 0.5) * dist * 0.06;
    return { sx, sy, dx, dy, cx: mx + nx * offset + ny * pNoise, cy: my + ny * offset - nx * pNoise, dist };
  };

  const bezierPt = (t, p) => {
    const u = 1 - t;
    return {
      x: u * u * p.sx + 2 * u * t * p.cx + t * t * p.dx,
      y: u * u * p.sy + 2 * u * t * p.cy + t * t * p.dy,
    };
  };

  // ── Launch comet ──
  const launch = (from, toIdx, duration) => {
    cometActive    = true;
    cometFromPt    = from;
    cometToIdx     = toIdx;
    cometStartTime = performance.now();
    activeDuration = duration || COMET_DURATION;
    tailParticles  = [];
    prevHead       = null;
    flightId++;
    const fromSeed = (typeof from === 'number') ? from : 999;
    flightRng = seed32(baseSeed + flightId * 7919 + fromSeed * 1000 + toIdx);
    if (!rafId) {
      canvas.style.opacity = '1';
      rafId = requestAnimationFrame(cometLoop);
    }
  };

  const cancelComet = () => {
    if (!cometActive) return;
    if (typeof cometFromPt === 'number') setActive(cometFromPt, false);
    setActive(cometToIdx, true);
    activeIdx = cometToIdx;
    cometActive = false;
    tailParticles = [];
    prevHead = null;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };

  // ── Spawn tail particles ──
  const spawnTail = (head, path, eased, now) => {
    if (tailParticles.length >= TAIL_CAP) return;
    const mul = Math.max(1, Math.min(2, (path.dist || 400) / 500));
    const coreN = Math.round(TAIL_SPAWN * mul);
    const backN = Math.round(BACKTRACK_N * mul);

    for (let i = 0; i < coreN; i++) {
      tailParticles.push({
        x: head.x + (flightRng() - 0.5) * 8,
        y: head.y + (flightRng() - 0.5) * 8,
        born: now,
        life: TAIL_LIFE_BASE + flightRng() * TAIL_LIFE_RAND,
        size: 2 + flightRng() * 2.5,
        alpha: 0.7,
      });
      tailParticles.push({
        x: head.x + (flightRng() - 0.5) * 14,
        y: head.y + (flightRng() - 0.5) * 14,
        born: now,
        life: (TAIL_LIFE_BASE + flightRng() * TAIL_LIFE_RAND) * 1.8,
        size: 1 + flightRng() * 1.5,
        alpha: 0.3,
      });
      if (flightRng() < SPARKLE_CHANCE) {
        tailParticles.push({
          x: head.x + (flightRng() - 0.5) * 6,
          y: head.y + (flightRng() - 0.5) * 6,
          born: now,
          life: 40 + flightRng() * 50,
          size: 0.8 + flightRng() * 1.2,
          alpha: 0.95,
        });
      }
    }
    if (eased > 0.05) {
      for (let i = 0; i < backN; i++) {
        const bt = eased - flightRng() * 0.08;
        const bp = bezierPt(Math.max(0, bt), path);
        tailParticles.push({
          x: bp.x + (flightRng() - 0.5) * 10,
          y: bp.y + (flightRng() - 0.5) * 10,
          born: now,
          life: TAIL_LIFE_BASE * 0.7 + flightRng() * TAIL_LIFE_RAND,
          size: 1.2 + flightRng() * 2,
          alpha: 0.45,
        });
      }
    }
  };

  // ── Drawing helpers ──
  const drawHead = (x, y, alpha) => {
    const r3 = HEAD_RADIUS * 3;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r3);
    grad.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`);
    grad.addColorStop(0.3, `rgba(${aR},${aG},${aB},${0.7 * alpha})`);
    grad.addColorStop(1, `rgba(${aR},${aG},${aB},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - r3, y - r3, r3 * 2, r3 * 2);
  };

  const drawStreak = (prev, cur) => {
    if (!prev) return;
    ctx.strokeStyle = `rgba(${aR},${aG},${aB},0.3)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.stroke();
  };

  // ── Main render loop ──
  const cometLoop = (now) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    let anyDrawn = false;
    let head = null;

    if (cometActive) {
      const elapsed = now - cometStartTime;
      const rawT = Math.min(elapsed / activeDuration, 1);
      const eased = smoothstep(rawT);

      const path = getPath(cometFromPt, cometToIdx);
      head = bezierPt(eased, path);

      if (typeof cometFromPt === 'number') {
        setFlowP(cometFromPt, 1 - eased);
      }
      setFlowP(cometToIdx, eased);

      if (rawT < 1) {
        spawnTail(head, path, eased, now);
      }

      if (rawT >= 1) {
        if (typeof cometFromPt === 'number') setActive(cometFromPt, false);
        setActive(cometToIdx, true);
        activeIdx = cometToIdx;
        cometActive = false;
        prevHead = null;
      }
    }

    // ── Additive-blend draw pass ──
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = tailParticles.length - 1; i >= 0; i--) {
      const p = tailParticles[i];
      const age = now - p.born;
      if (age > p.life) { tailParticles.splice(i, 1); continue; }
      const fade = 1 - age / p.life;
      ctx.globalAlpha = fade * p.alpha;
      ctx.fillStyle = `rgb(${aR},${aG},${aB})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2);
      ctx.fill();
      anyDrawn = true;
    }

    if (head && cometActive) {
      drawStreak(prevHead, head);
      drawHead(head.x, head.y, 0.9);
      prevHead = { x: head.x, y: head.y };
      anyDrawn = true;
    }

    ctx.restore();
    ctx.globalAlpha = 1;

    if (cometActive || tailParticles.length > 0) {
      rafId = requestAnimationFrame(cometLoop);
    } else {
      ctx.clearRect(0, 0, w, h);
      canvas.style.opacity = '0';
      rafId = 0;
    }
  };

  // ── Hover handlers ──
  const onEnter = (idx) => {
    clearTimeout(leaveTimer);
    hoveredIdx = idx;
    if (idx === activeIdx) return;
    if (cometActive) cancelComet();
    launch(activeIdx >= 0 ? activeIdx : 0, idx, HOVER_DURATION);
  };

  const onLeave = () => {
    hoveredIdx = -1;
    leaveTimer = setTimeout(() => {
      if (hoveredIdx >= 0) return;
      if (activeIdx === 0) return;
      if (cometActive) cancelComet();
      launch(activeIdx >= 0 ? activeIdx : 0, 0, HOVER_DURATION);
    }, LEAVE_DEBOUNCE);
  };

  // Bind listeners on each stop element
  STOPS.forEach((stop, idx) => {
    stop.posEl.addEventListener('pointerenter', () => onEnter(idx));
    stop.posEl.addEventListener('pointerleave', onLeave);
  });

  // Track pointer for subtle destination offset
  document.addEventListener('pointermove', (e) => {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
  }, { passive: true });

  // ── Init ──
  parseAccent();

  // All stops start at 0 (white)
  for (let i = 0; i < STOPS.length; i++) setActive(i, false);

  // Intro comet: fly from below screen to title after entrance animations settle
  setTimeout(() => {
    const startPt = { x: window.innerWidth / 2, y: window.innerHeight + 60 };
    launch(startPt, 0, COMET_DURATION);
  }, INTRO_DELAY);
})();
