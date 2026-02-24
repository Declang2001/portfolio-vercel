// Core interactions for West Coast Studio

// ── Shared viewport helpers (iOS Safari safe) ──
const _wcsViewport = (() => {
  const vv = window.visualViewport;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    || !window.matchMedia('(hover: hover)').matches;

  function getViewport() {
    if (vv) return { vw: vv.width, vh: vv.height, ox: vv.offsetLeft, oy: vv.offsetTop };
    return { vw: window.innerWidth, vh: window.innerHeight, ox: 0, oy: 0 };
  }

  function getDprCap() {
    const raw = window.devicePixelRatio || 1;
    return Math.min(raw, coarsePointer ? 1.5 : 2);
  }

  function makeRafThrottle(fn) {
    let id = 0;
    return function () {
      if (id) return;
      id = requestAnimationFrame(() => { id = 0; fn(); });
    };
  }

  return { getViewport, getDprCap, makeRafThrottle, coarsePointer };
})();

// ── Dev mode: skip Cloudinary video loading on localhost / ?novideo ──
// Override with ?video=1 to force real video locally (e.g. to test loading UX).
const _vmDevMode = (() => {
  const p = new URLSearchParams(location.search);
  if (p.has('video')) return false;
  return (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    p.has('novideo')
  );
})();

// ── Cloudinary URL optimizer: inject f_auto,q_auto,vc_auto + width cap ──
// Tile widths are intentionally smaller than modal/full-screen playback.
const _cldOpt = (() => {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const t = coarse ? 'f_auto,q_auto,vc_auto,w_540,c_limit' : 'f_auto,q_auto,vc_auto,w_720,c_limit';
  return function (url) {
    if (!url || !url.includes('/video/upload/')) return url;
    if (url.includes(t)) return url;
    return url.replace('/video/upload/', '/video/upload/' + t + '/');
  };
})();

// ── Cloudinary poster: first frame as a small JPEG ──
const _cldPoster = (url) => {
  if (!url || !url.includes('/video/upload/')) return '';
  return url
    .replace('/video/upload/', '/video/upload/so_0,f_jpg,q_auto,w_800,c_limit/')
    .replace(/\.(mp4|mov|webm)(\?.*)?$/i, '.jpg');
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Dynamic year in footer
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // 2. Menu overlay (works on all pages)
  const menuToggle = document.querySelector('.menu-toggle');
  const menuOverlay =
    document.getElementById('menuOverlay') ||
    document.querySelector('.menu-overlay');
  const menuClose = menuOverlay ? menuOverlay.querySelector('.menu-close') : null;

  const openMenu = () => {
    if (!menuOverlay) return;
    menuOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  const closeMenu = () => {
    if (!menuOverlay) return;
    menuOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  if (menuToggle && menuOverlay) {
    menuToggle.addEventListener('click', openMenu);
  }

  if (menuClose && menuOverlay) {
    menuClose.addEventListener('click', closeMenu);
  }

  if (menuOverlay) {
    menuOverlay.addEventListener('click', (event) => {
      if (event.target === menuOverlay) closeMenu();
    });

    const overlayLinks = menuOverlay.querySelectorAll('a');
    overlayLinks.forEach((link) => link.addEventListener('click', closeMenu));
  }

  // 3. TEXT SCRAMBLER rotating word animation on home page only
  const rotatingEl = document.getElementById('rotatingWord');

  if (rotatingEl) {
    const words = [
      'emotion',
      'story-telling',
      'tension',
      'memory',
      'wonder',
      'nostalgia',
      'momentum'
    ];
    let idx = 0;

    class TextScrambler {
      constructor(el) {
        this.el = el;
        this.container = el.parentElement;

        this.baseChars = '!<>_/[]{}=+*^?#';

        this.scriptCharSets = [
          // Japanese (katakana)
          'アィイゥウェエォオカキクケコサシスセソタチツテトナニヌネノマミムメモヤユヨラリルレロワヲン',
          // Greek
          'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ' +
            'αβγδεζηθικλμνξοπρστυφχψω',
          // Cyrillic
          'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ' +
            'абвгдежзийклмнопрстуфхцчшщыэюя',
          // Arabic
          'ضصثقفغعهخحجدشسيبلاتنمكطئءؤرلاىةوزظ'
        ];

        this.frame = 0;
        this.queue = [];
        this.frameRequest = null;
        this.resolve = null;
        this.totalFrames = 0;
      }

      randomChar(globalProgress) {
        const t = Math.max(0, Math.min(1, globalProgress || 0));

        let setIndex;
        if (t < 0.25) setIndex = 0;
        else if (t < 0.5) setIndex = 1;
        else if (t < 0.75) setIndex = 2;
        else setIndex = 3;

        const scriptChars = this.scriptCharSets[setIndex];
        const pool = this.baseChars + scriptChars;
        const index = Math.floor(Math.random() * pool.length);
        return pool[index];
      }

      setText(newText) {
        const oldText = this.el.textContent;
        const length = Math.max(oldText.length, newText.length);
        this.queue = [];

        // Slower, more legible glitch
        for (let i = 0; i < length; i++) {
          const from = oldText[i] || '';
          const to = newText[i] || '';

          const start = Math.floor(Math.random() * 16); // 0-15
          const extra = Math.floor(Math.random() * 61) + 120; // 120-180
          const end = start + extra;

          this.queue.push({ from, to, start, end, char: null });
        }

        cancelAnimationFrame(this.frameRequest);
        this.frame = 0;
        this.totalFrames = this.queue.reduce(
          (max, item) => Math.max(max, item.end),
          0
        );

        // Reset pre-glow and turn on glitch state for word and container
        this.el.classList.remove('pre-glow');
        if (this.container) this.container.classList.remove('pre-glow');

        this.el.classList.add('is-scrambling');
        if (this.container) this.container.classList.add('is-scrambling');

        return new Promise((resolve) => {
          this.resolve = resolve;
          this.update();
        });
      }

      update() {
        let output = '';
        let complete = 0;

        const globalProgress = this.totalFrames ? this.frame / this.totalFrames : 0;

        for (const item of this.queue) {
          if (this.frame >= item.end) {
            complete++;
            output += item.to;
          } else if (this.frame >= item.start) {
            const life = item.end - item.start;
            const lifeProgress = life ? (this.frame - item.start) / life : 0;

            // Early on it shuffles quickly, then slows down
            const changeProb = 0.28 * (1 - lifeProgress) + 0.04;

            if (!item.char || Math.random() < changeProb) {
              item.char = this.randomChar(globalProgress);
            }
            output += item.char;
          } else {
            output += item.from;
          }
        }

        this.el.textContent = output;
        this.frame += 1;

        if (complete === this.queue.length) {
          this.el.classList.remove('is-scrambling');
          if (this.container) this.container.classList.remove('is-scrambling');

          if (this.resolve) this.resolve();
        } else {
          this.frameRequest = requestAnimationFrame(() => this.update());
        }
      }
    }

    const scrambler = new TextScrambler(rotatingEl);

    const REST_MS = 1400;
    const PRE_GLOW_MS = 900;

    function runCycle() {
      const nextWord = words[idx];

      rotatingEl.classList.add('pre-glow');
      const container = rotatingEl.parentElement;
      if (container) container.classList.add('pre-glow');

      setTimeout(() => {
        scrambler.setText(nextWord).then(() => {
          setTimeout(() => {
            idx = (idx + 1) % words.length;
            runCycle();
          }, REST_MS);
        });
      }, PRE_GLOW_MS);
    }

    runCycle();
  }

  // 4. Home hero scroll animation only
  const heroSection = document.querySelector('.hero.hero--home');
  if (heroSection) {
    const heroLines = heroSection.querySelectorAll('.hero-line');
    const heroPortfolio = heroSection.querySelector('.hero-portfolio');
    let ticking = false;
    let lastProgress = -1;
    const isMobile = window.innerWidth <= 767;

    const updateHeroOnScroll = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const start = heroSection.offsetTop;
      const scrollY = window.scrollY || window.pageYOffset;

      // Fixed animation range = 1 viewport height (same as old 200vh - 100vh).
      // Extra hero height is pure linger time after progress reaches 1.
      const animRange = viewportHeight;
      if (animRange <= 0) return;

      let progress = (scrollY - start) / animRange;
      progress = Math.min(Math.max(progress, 0), 1);

      if (isMobile && Math.abs(progress - lastProgress) < 0.005) {
        ticking = false;
        return;
      }
      lastProgress = progress;

      const fadeStart = 0.25;
      const fadeEnd = 0.75;
      const maxXOffset = isMobile ? 15 : 40;

      heroLines.forEach((line, index) => {
        const direction = index === 0 ? -1 : 1;
        const slideT = Math.min(progress / fadeEnd, 1);
        const xOffset = direction * slideT * maxXOffset;
        const yOffset = isMobile ? 0 : -progress * 12;

        let opacity = 1;
        if (progress >= fadeStart) {
          const t = Math.min((progress - fadeStart) / (fadeEnd - fadeStart), 1);
          opacity = 1 - t;
        }

        line.style.transform = `translate3d(${xOffset}vw, ${yOffset}px, 0)`;
        line.style.opacity = String(opacity);
      });

      if (heroPortfolio) {
        const appearStart = 0.45;
        const appearEnd = 0.95;
        let t = (progress - appearStart) / (appearEnd - appearStart);
        t = Math.min(Math.max(t, 0), 1);
        heroPortfolio.style.opacity = String(t);
      }

      ticking = false;
    };

    // ═══════════════════════════════════════════════════════════════
    //  ACCENT COMET STATE MACHINE
    //  Deterministic stop-to-stop comet travel system
    //  remembering → gainey → rotatingWord → skills → work
    // ═══════════════════════════════════════════════════════════════

    // --- Tuning ---
    const COMET_DURATION = 700;   // ms per comet travel
    const HOP_DURATION   = 300;   // ms per hover hop
    const HERO_THRESHOLD = 0.30;  // hero scroll fraction to trigger remembering→gainey
    const TAIL_LIFE_BASE = 150;   // tail particle base lifetime (ms)
    const TAIL_LIFE_RAND = 80;    // tail particle random extra lifetime (ms)
    const TAIL_SPAWN     = 12;    // core + mist particles per frame at head
    const BACKTRACK_N    = 10;    // extra particles spawned behind head
    const TAIL_CAP       = 1800;  // hard cap on total tail particles
    const HEAD_RADIUS    = 4;     // comet head radius (px)
    const HEAD_GLOW      = 14;    // comet head shadowBlur (px)
    const BEZIER_CURVE   = 0.25;  // control point offset (fraction of distance)
    const HYSTERESIS     = 40;    // px scroll margin to prevent jitter retrigger
    const PREVIEW_DURATION = 400; // ms for skills hover preview comet
    const SPARKLE_CHANCE = 0.10;  // 10% chance per spawn iteration for micro sparkle
    const IDLE_ARM_MS    = 1200;  // ms of no interaction before idle attract starts
    const IDLE_DWELL_MS  = 1400;  // ms pause between idle hops

    // --- DOM refs ---
    const sourceEl     = heroSection.querySelector('.hero-line-bottom .accent');
    const targetEl     = heroSection.querySelector('.hero-name-last');
    const targetGlow   = targetEl ? targetEl.querySelector('.hero-name-last-glow') : null;
    const accentCanvas = document.getElementById('heroAccentParticles');
    const prefersReducedHero = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Shared state ---
    let accentCtx = null, accentDpr = 1;
    let accentR = 168, accentG = 85, accentB = 247;
    let accentInited = false;

    // --- Seeded PRNG (mulberry32) ---
    const baseSeed = (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? crypto.getRandomValues(new Uint32Array(1))[0]
      : (Date.now() * 9301 + 49297) >>> 0;
    const seed32 = (s) => () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // --- Utilities ---
    const smoothstep = (t) => t * t * (3 - 2 * t);
    const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

    const parseAccentColor = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent').trim() || '#a855f7';
      const tmp = document.createElement('div');
      tmp.style.color = raw;
      document.body.appendChild(tmp);
      const c = getComputedStyle(tmp).color;
      document.body.removeChild(tmp);
      const m = c.match(/(\d+)/g);
      if (m) { accentR = +m[0]; accentG = +m[1]; accentB = +m[2]; }
    };

    const glyphRect = (el) => {
      if (!el) return null;
      const r = document.createRange();
      r.selectNodeContents(el);
      const rects = r.getClientRects();
      return rects.length ? rects[0] : r.getBoundingClientRect();
    };

    const resizeAccentCanvas = () => {
      if (!accentCanvas || !accentCtx) return;
      accentCanvas.width  = window.innerWidth  * accentDpr;
      accentCanvas.height = window.innerHeight * accentDpr;
      accentCtx.setTransform(accentDpr, 0, 0, accentDpr, 0, 0);
    };

    // ── Stop definitions ──
    // Each stop: { id, posEl, varEl, cssVar, activeVal, inactiveVal }
    const rotatingEl = document.getElementById('rotatingWord');
    const skillsEl   = document.querySelector('[data-accent-stop="skills"]');
    const workEl     = document.querySelector('[data-accent-stop="work"]');
    const approachEl = document.querySelector('[data-accent-stop="approach"]');

    const STOPS = [];
    if (sourceEl)    STOPS.push({ id:'remembering', posEl:sourceEl,   varEl:sourceEl,   cssVar:'--rem-drain', activeVal:'0', inactiveVal:'1' });
    if (targetGlow)  STOPS.push({ id:'gainey',      posEl:targetGlow, varEl:targetEl,   cssVar:'--gainey-p',  activeVal:'1', inactiveVal:'0' });
    if (rotatingEl)  STOPS.push({ id:'rotating',    posEl:rotatingEl, varEl:rotatingEl, cssVar:'--flow-p',    activeVal:'1', inactiveVal:'0' });
    if (skillsEl)    STOPS.push({ id:'skills',      posEl:skillsEl,   varEl:skillsEl,   cssVar:'--flow-p',    activeVal:'1', inactiveVal:'0' });
    if (workEl)      STOPS.push({ id:'work',        posEl:workEl,     varEl:workEl,     cssVar:'--flow-p',    activeVal:'1', inactiveVal:'0' });

    // ── State machine ──
    let currentStopIdx = 0;
    let stopDocYs  = [];    // document-Y centers for each stop
    let thresholds = [];    // scroll thresholds between consecutive stops

    // ── Comet state ──
    let cometActive    = false;
    let cometFrom      = 0;
    let cometTo        = 0;
    let cometStartTime = 0;
    let tailParticles  = [];
    let cometRafId     = 0;

    // ── Per-flight seeded RNG ──
    let flightId  = 0;
    let flightRng = seed32(baseSeed);

    // ── Motion streak state ──
    let prevCometHead = null;
    let prevHopHead   = null;

    // ── Configurable comet duration ──
    let activeCometDuration = COMET_DURATION;

    // ── Approach hover hop ──
    let hopActive    = false;
    let hopReverse   = false;
    let hopStartTime = 0;

    // ── Skills hover preview ──
    let previewMode      = false;
    let previewReturnIdx = -1;

    // ── Work zone tease state ──
    let lastUserActionTs  = performance.now();
    let workInView        = false;
    let workTeaseDone     = false;
    let workTeaseRunning  = false;
    let workTeaseTimer    = null;

    // ── Queued navigation (click-to-stop) ──
    let navMode  = false;
    let navQueue = [];

    // ── Position caching ──
    const cacheStopDocYs = () => {
      const sy = window.scrollY || window.pageYOffset;
      stopDocYs = [];
      for (const stop of STOPS) {
        const rect = glyphRect(stop.posEl);
        stopDocYs.push(rect ? rect.top + sy + rect.height / 2 : 0);
      }

      // Build thresholds
      thresholds = [];
      for (let i = 0; i < STOPS.length - 1; i++) {
        if (i === 0) {
          // Special: remembering → gainey are both in the hero section
          // Use hero scroll progress (30%) as threshold
          thresholds.push(heroSection.offsetTop + heroSection.offsetHeight * HERO_THRESHOLD);
        } else {
          thresholds.push((stopDocYs[i] + stopDocYs[i + 1]) / 2);
        }
      }
    };

    // ── CSS var helpers ──
    const setStopActive = (idx, active) => {
      if (idx < 0 || idx >= STOPS.length) return;
      const s = STOPS[idx];
      s.varEl.style.setProperty(s.cssVar, active ? s.activeVal : s.inactiveVal);
    };

    const lerpStopVar = (idx, t) => {
      // t: 0 = inactive, 1 = active
      if (idx < 0 || idx >= STOPS.length) return;
      const s = STOPS[idx];
      const from = parseFloat(s.inactiveVal);
      const to   = parseFloat(s.activeVal);
      const val  = from + (to - from) * t;
      s.varEl.style.setProperty(s.cssVar, val.toFixed(3));
    };

    // ── Bezier path ──
    const getCometPath = (fromEl, toEl) => {
      const sr = glyphRect(fromEl) || fromEl.getBoundingClientRect();
      const dr = glyphRect(toEl)   || toEl.getBoundingClientRect();
      const sx = sr.left + sr.width / 2;
      const sy = sr.top  + sr.height / 2;
      const dx = dr.left + dr.width / 2;
      const dy = dr.top  + dr.height / 2;

      const mx = (sx + dx) / 2;
      const my = (sy + dy) / 2;
      const dist = Math.hypot(dx - sx, dy - sy);
      const side = flightRng() > 0.5 ? 1 : -1;
      const curveJitter = 0.85 + flightRng() * 0.30;
      const nx = -(dy - sy) / (dist || 1);
      const ny = (dx - sx) / (dist || 1);
      const offset = dist * BEZIER_CURVE * curveJitter * side;
      const perpNoise = (flightRng() - 0.5) * dist * 0.06;
      return { sx, sy, dx, dy, cx: mx + nx * offset + ny * perpNoise, cy: my + ny * offset - nx * perpNoise, dist };
    };

    const bezierPt = (t, sx, sy, cx, cy, dx, dy) => {
      const u = 1 - t;
      return {
        x: u * u * sx + 2 * u * t * cx + t * t * dx,
        y: u * u * sy + 2 * u * t * cy + t * t * dy,
      };
    };

    // ── Comet launch / cancel ──
    const launchComet = (fromIdx, toIdx, duration) => {
      cometActive = true;
      cometFrom = fromIdx;
      cometTo = toIdx;
      cometStartTime = performance.now();
      activeCometDuration = duration || COMET_DURATION;
      tailParticles = [];
      prevCometHead = null;
      flightId++;
      flightRng = seed32(baseSeed + flightId * 7919 + fromIdx * 1000 + toIdx);
      if (!cometRafId) {
        accentCanvas.classList.add('is-on');
        cometRafId = requestAnimationFrame(cometLoop);
      }
    };

    const cancelComet = () => {
      if (!cometActive) return;
      setStopActive(cometFrom, false);
      setStopActive(cometTo, true);
      cometActive = false;
      tailParticles = [];
      prevCometHead = null;
      if (accentCtx) accentCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };

    // ── Hover hop launch ──
    const launchHop = (reverse) => {
      hopActive = true;
      hopReverse = reverse;
      hopStartTime = performance.now();
      tailParticles = [];
      prevHopHead = null;
      flightId++;
      flightRng = seed32(baseSeed + flightId * 7919 + (reverse ? 5000 : 6000));
      if (!cometRafId) {
        accentCanvas.classList.add('is-on');
        cometRafId = requestAnimationFrame(cometLoop);
      }
    };

    // ── Spawn helpers ──
    const spawnCometTail = (head, path, eased, nowMs) => {
      if (tailParticles.length >= TAIL_CAP) return;
      const spawnMul = Math.max(1, Math.min(2, (path.dist || 400) / 500));
      const coreN = Math.round(TAIL_SPAWN * spawnMul);
      const backN = Math.round(BACKTRACK_N * spawnMul);

      for (let i = 0; i < coreN; i++) {
        // Core: brighter, larger, shorter life
        tailParticles.push({
          x: head.x + (flightRng() - 0.5) * 8,
          y: head.y + (flightRng() - 0.5) * 8,
          born: nowMs,
          life: TAIL_LIFE_BASE + flightRng() * TAIL_LIFE_RAND,
          size: 2 + flightRng() * 2.5,
          alpha: 0.7,
        });
        // Mist: softer, smaller, longer life
        tailParticles.push({
          x: head.x + (flightRng() - 0.5) * 14,
          y: head.y + (flightRng() - 0.5) * 14,
          born: nowMs,
          life: (TAIL_LIFE_BASE + flightRng() * TAIL_LIFE_RAND) * 1.8,
          size: 1 + flightRng() * 1.5,
          alpha: 0.3,
        });
        // Sparkle: rare, small, bright, very short life
        if (flightRng() < SPARKLE_CHANCE) {
          tailParticles.push({
            x: head.x + (flightRng() - 0.5) * 6,
            y: head.y + (flightRng() - 0.5) * 6,
            born: nowMs,
            life: 40 + flightRng() * 50,
            size: 0.8 + flightRng() * 1.2,
            alpha: 0.95,
          });
        }
      }
      // Backtrack: spawn along trail behind head
      if (eased > 0.05) {
        for (let i = 0; i < backN; i++) {
          const bt = eased - flightRng() * 0.08;
          const bp = bezierPt(Math.max(0, bt), path.sx, path.sy, path.cx, path.cy, path.dx, path.dy);
          tailParticles.push({
            x: bp.x + (flightRng() - 0.5) * 10,
            y: bp.y + (flightRng() - 0.5) * 10,
            born: nowMs,
            life: TAIL_LIFE_BASE * 0.7 + flightRng() * TAIL_LIFE_RAND,
            size: 1.2 + flightRng() * 2,
            alpha: 0.45,
          });
        }
      }
    };

    const drawGradientHead = (x, y, alpha) => {
      const r3 = HEAD_RADIUS * 3;
      const grad = accentCtx.createRadialGradient(x, y, 0, x, y, r3);
      grad.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`);
      grad.addColorStop(0.3, `rgba(${accentR},${accentG},${accentB},${0.7 * alpha})`);
      grad.addColorStop(1, `rgba(${accentR},${accentG},${accentB},0)`);
      accentCtx.fillStyle = grad;
      accentCtx.fillRect(x - r3, y - r3, r3 * 2, r3 * 2);
    };

    const drawStreak = (prev, cur) => {
      if (!prev) return;
      accentCtx.strokeStyle = `rgba(${accentR},${accentG},${accentB},0.3)`;
      accentCtx.lineWidth = 2;
      accentCtx.beginPath();
      accentCtx.moveTo(prev.x, prev.y);
      accentCtx.lineTo(cur.x, cur.y);
      accentCtx.stroke();
    };

    // ── Main render loop ──
    const cometLoop = (nowMs) => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      accentCtx.clearRect(0, 0, w, h);

      let anyDrawn = false;

      // --- Update comet state (spawn + CSS vars, no drawing yet) ---
      let cometHead = null, cometPath = null;
      if (cometActive) {
        const elapsed = nowMs - cometStartTime;
        const rawT = Math.min(elapsed / activeCometDuration, 1);
        const eased = smoothstep(rawT);

        const fromStop = STOPS[cometFrom];
        const toStop   = STOPS[cometTo];
        cometPath = getCometPath(fromStop.posEl, toStop.posEl);
        cometHead = bezierPt(eased, cometPath.sx, cometPath.sy, cometPath.cx, cometPath.cy, cometPath.dx, cometPath.dy);

        lerpStopVar(cometFrom, 1 - eased);
        lerpStopVar(cometTo, eased);

        if (rawT < 1) {
          spawnCometTail(cometHead, cometPath, eased, nowMs);
        }

        if (rawT >= 1) {
          setStopActive(cometFrom, false);
          setStopActive(cometTo, true);
          cometActive = false;
          prevCometHead = null;
          if (navMode) advanceNav();
        }
      }

      // --- Update hop state (spawn + CSS vars, no drawing yet) ---
      let hopHead = null;
      if (hopActive) {
        const elapsed = nowMs - hopStartTime;
        const rawT = Math.min(elapsed / HOP_DURATION, 1);
        const eased = smoothstep(rawT);

        const workStop = STOPS.find(s => s.id === 'work');
        if (workStop && approachEl) {
          const fromEl = hopReverse ? approachEl : workStop.posEl;
          const toEl   = hopReverse ? workStop.posEl : approachEl;
          const hopPath = getCometPath(fromEl, toEl);
          hopHead = bezierPt(eased, hopPath.sx, hopPath.sy, hopPath.cx, hopPath.cy, hopPath.dx, hopPath.dy);

          if (hopReverse) {
            approachEl.style.setProperty('--flow-p', (1 - eased).toFixed(3));
          } else {
            approachEl.style.setProperty('--flow-p', eased.toFixed(3));
          }

          if (rawT < 1 && tailParticles.length < TAIL_CAP) {
            const spawnMul = Math.max(1, Math.min(2, (hopPath.dist || 300) / 500));
            const n = Math.round(TAIL_SPAWN * spawnMul);
            for (let i = 0; i < n; i++) {
              tailParticles.push({
                x: hopHead.x + (flightRng() - 0.5) * 6,
                y: hopHead.y + (flightRng() - 0.5) * 6,
                born: nowMs,
                life: TAIL_LIFE_BASE + flightRng() * TAIL_LIFE_RAND,
                size: 1.8 + flightRng() * 2,
                alpha: 0.65,
              });
              tailParticles.push({
                x: hopHead.x + (flightRng() - 0.5) * 12,
                y: hopHead.y + (flightRng() - 0.5) * 12,
                born: nowMs,
                life: (TAIL_LIFE_BASE + flightRng() * TAIL_LIFE_RAND) * 1.6,
                size: 0.8 + flightRng() * 1.2,
                alpha: 0.25,
              });
              if (flightRng() < SPARKLE_CHANCE) {
                tailParticles.push({
                  x: hopHead.x + (flightRng() - 0.5) * 5,
                  y: hopHead.y + (flightRng() - 0.5) * 5,
                  born: nowMs, life: 40 + flightRng() * 50,
                  size: 0.8 + flightRng() * 1.2, alpha: 0.95,
                });
              }
            }
          }

          if (rawT >= 1) {
            approachEl.style.setProperty('--flow-p', hopReverse ? '0' : '1');
            hopActive = false;
            prevHopHead = null;
          }
        } else {
          hopActive = false;
          prevHopHead = null;
        }
      }

      // --- Additive-blend drawing pass (tail + heads + streaks) ---
      accentCtx.save();
      accentCtx.globalCompositeOperation = 'lighter';

      // Tail particles
      for (let i = tailParticles.length - 1; i >= 0; i--) {
        const p = tailParticles[i];
        const age = nowMs - p.born;
        if (age > p.life) { tailParticles.splice(i, 1); continue; }
        const fade = 1 - age / p.life;
        accentCtx.globalAlpha = fade * (p.alpha || 0.6);
        accentCtx.fillStyle = `rgb(${accentR},${accentG},${accentB})`;
        accentCtx.beginPath();
        accentCtx.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2);
        accentCtx.fill();
        anyDrawn = true;
      }

      // Comet head + streak
      if (cometHead && cometActive) {
        drawStreak(prevCometHead, cometHead);
        drawGradientHead(cometHead.x, cometHead.y, 0.9);
        prevCometHead = { x: cometHead.x, y: cometHead.y };
        anyDrawn = true;
      }

      // Hop head + streak
      if (hopHead && hopActive) {
        drawStreak(prevHopHead, hopHead);
        drawGradientHead(hopHead.x, hopHead.y, 0.85);
        prevHopHead = { x: hopHead.x, y: hopHead.y };
        anyDrawn = true;
      }

      accentCtx.restore();
      accentCtx.globalAlpha = 1;

      // --- Continue or stop loop ---
      if (cometActive || hopActive || tailParticles.length > 0) {
        cometRafId = requestAnimationFrame(cometLoop);
      } else {
        accentCtx.clearRect(0, 0, w, h);
        accentCanvas.classList.remove('is-on');
        cometRafId = 0;
      }
    };

    // ── Threshold helper (reusable for preview return) ──
    const computeScrollTarget = () => {
      const sy = window.scrollY || window.pageYOffset;
      const sm = sy + window.innerHeight * 0.5;
      let t = 0;
      for (let i = 0; i < thresholds.length; i++) {
        const th = (i < currentStopIdx) ? thresholds[i] - HYSTERESIS : thresholds[i];
        if (sm > th) t = i + 1;
      }
      return t;
    };

    // ── Scroll handler — threshold-based state machine ──
    let accentScrollTicking = false;
    const onAccentScroll = () => {
      accentScrollTicking = false;
      if (!accentInited) return;

      lastUserActionTs = performance.now();

      // Cancel preview on scroll
      if (previewMode) {
        previewMode = false;
        if (cometActive) cancelComet();
      }

      // Let queued nav finish without interference
      if (navMode) return;

      const scrollY = window.scrollY || window.pageYOffset;
      const scrollMid = scrollY + window.innerHeight * 0.5;

      // Determine target stop from thresholds (with hysteresis)
      let targetStop = 0;
      for (let i = 0; i < thresholds.length; i++) {
        const th = (i < currentStopIdx) ? thresholds[i] - HYSTERESIS : thresholds[i];
        if (scrollMid > th) targetStop = i + 1;
      }

      if (targetStop === currentStopIdx) return;

      // Reduced motion: snap CSS vars directly, no canvas
      if (prefersReducedHero) {
        for (let i = 0; i < STOPS.length; i++) {
          setStopActive(i, i === targetStop);
        }
        currentStopIdx = targetStop;
        return;
      }

      // Cancel any active comet
      if (cometActive) cancelComet();

      // Determine comet source: one step before target
      const dir = targetStop > currentStopIdx ? 1 : -1;
      const cFrom = targetStop - dir; // adjacent stop

      // Snap all stops not involved in the comet
      for (let i = 0; i < STOPS.length; i++) {
        if (i === cFrom || i === targetStop) continue;
        if (dir > 0) {
          // Scrolling down: stops before cFrom should be inactive
          setStopActive(i, false);
        } else {
          // Scrolling up: stops after target should be inactive
          setStopActive(i, i < targetStop);
        }
      }

      // Ensure comet source starts in active state
      setStopActive(cFrom, true);
      setStopActive(targetStop, false);

      launchComet(cFrom, targetStop);
      currentStopIdx = targetStop;

      // One-time tease: arm or disarm based on new stop
      if (targetStop === workIdxForIdle && workInView) {
        armWorkTease();
      } else {
        stopWorkTease();
      }
    };

    const requestAccentTick = () => {
      if (!accentScrollTicking) {
        accentScrollTicking = true;
        requestAnimationFrame(onAccentScroll);
      }
    };

    // ── Queued navigation (for click-to-stop) ──
    const advanceNav = () => {
      if (!navQueue.length) { navMode = false; return; }
      const next = navQueue.shift();
      for (let i = 0; i < STOPS.length; i++) {
        if (i === currentStopIdx || i === next) continue;
        setStopActive(i, false);
      }
      setStopActive(currentStopIdx, true);
      setStopActive(next, false);
      launchComet(currentStopIdx, next);
      currentStopIdx = next;
    };

    const goToStop = (targetIdx) => {
      if (!accentInited || targetIdx < 0 || targetIdx >= STOPS.length) return;
      if (targetIdx === currentStopIdx) return;
      if (previewMode) { previewMode = false; }
      if (cometActive) cancelComet();
      navMode = true;
      navQueue = [];
      const dir = targetIdx > currentStopIdx ? 1 : -1;
      for (let i = currentStopIdx + dir; dir > 0 ? i <= targetIdx : i >= targetIdx; i += dir) {
        navQueue.push(i);
      }
      advanceNav();
    };

    // ── Skills hover preview ──
    const skillsIdx = STOPS.findIndex(s => s.id === 'skills');

    const startSkillsPreview = () => {
      if (!accentInited || skillsIdx < 0 || navMode) return;
      if (prefersReducedHero) { if (skillsEl) setStopActive(skillsIdx, true); return; }
      if (previewMode || hopActive || currentStopIdx === skillsIdx) return;

      previewMode = true;
      previewReturnIdx = currentStopIdx;
      if (cometActive) cancelComet();
      launchComet(currentStopIdx, skillsIdx, PREVIEW_DURATION);
    };

    const endSkillsPreview = () => {
      if (!previewMode) return;
      previewMode = false;
      if (prefersReducedHero) {
        if (skillsIdx >= 0) setStopActive(skillsIdx, false);
        if (previewReturnIdx >= 0) setStopActive(previewReturnIdx, true);
        return;
      }
      const returnTo = computeScrollTarget();
      if (cometActive) cancelComet();
      launchComet(skillsIdx, returnTo, PREVIEW_DURATION);
      currentStopIdx = returnTo;
    };

    const onSkillsClick = (e) => {
      if (skillsIdx < 0) return;
      e.preventDefault();
      const sec = document.getElementById('skills');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (prefersReducedHero) {
        for (let i = 0; i < STOPS.length; i++) setStopActive(i, i === skillsIdx);
        currentStopIdx = skillsIdx;
        return;
      }
      goToStop(skillsIdx);
    };

    // ── Approach hover hop handlers ──
    const startApproachHop = () => {
      if (!accentInited) return;
      lastUserActionTs = performance.now();
      stopWorkTease();
      if (prefersReducedHero) {
        if (approachEl) approachEl.style.setProperty('--flow-p', '1');
        return;
      }
      if (hopActive) return; // already in flight
      launchHop(false);
    };

    const endApproachHop = () => {
      lastUserActionTs = performance.now();
      if (prefersReducedHero) {
        if (approachEl) approachEl.style.setProperty('--flow-p', '0');
        return;
      }
      // If forward hop is still in flight, let it finish — the reverse will fire from end state
      launchHop(true);
      // Re-arm idle attract after user leaves
      const wIdx = STOPS.findIndex(s => s.id === 'work');
      if (workInView && currentStopIdx === wIdx) armWorkTease();
    };

    // ── One-time work zone tease: Work → Approach → Work ──
    const workIdxForIdle = STOPS.findIndex(s => s.id === 'work');

    const teaseGateOk = () => {
      return workInView
        && currentStopIdx === workIdxForIdle
        && !workTeaseDone
        && !workTeaseRunning
        && !prefersReducedHero
        && !previewMode
        && !navMode
        && !cometActive
        && !hopActive
        && (performance.now() - lastUserActionTs) > IDLE_ARM_MS;
    };

    const stopWorkTease = () => {
      workTeaseRunning = false;
      clearTimeout(workTeaseTimer);
      workTeaseTimer = null;
      if (approachEl && !hopActive) {
        approachEl.style.setProperty('--flow-p', '0');
      }
    };

    const armWorkTease = () => {
      if (prefersReducedHero || workTeaseDone) return;
      stopWorkTease();
      workTeaseTimer = setTimeout(fireWorkTease, IDLE_DWELL_MS);
    };

    const fireWorkTease = () => {
      if (!teaseGateOk()) return;
      workTeaseRunning = true;
      launchHop(false); // Work → Approach
      workTeaseTimer = setTimeout(() => {
        if (!workTeaseRunning) return;
        launchHop(true); // Approach → Work
        workTeaseTimer = setTimeout(() => {
          workTeaseRunning = false;
          workTeaseDone = true;
        }, HOP_DURATION);
      }, HOP_DURATION + IDLE_DWELL_MS);
    };

    // ── Initialize ──
    const initAccent = () => {
      if (accentInited || !accentCanvas || !sourceEl || !targetEl || !targetGlow) return false;
      if (STOPS.length < 2) return false;
      accentCtx = accentCanvas.getContext('2d');
      if (!accentCtx) return false;

      accentDpr = window.devicePixelRatio || 1;
      parseAccentColor();
      resizeAccentCanvas();
      cacheStopDocYs();

      // Set initial state: stop 0 (remembering) is active
      setStopActive(0, true);
      for (let i = 1; i < STOPS.length; i++) setStopActive(i, false);

      // Approach hover hop listeners
      if (approachEl) {
        const link = approachEl.closest('a') || approachEl;
        link.addEventListener('pointerenter', startApproachHop);
        link.addEventListener('pointerleave', endApproachHop);
      }

      // Skills hover preview + click listeners
      if (skillsIdx >= 0 && skillsEl) {
        const skillsWrap = skillsEl.closest('a') || skillsEl;
        skillsWrap.addEventListener('pointerenter', startSkillsPreview);
        skillsWrap.addEventListener('pointerleave', endSkillsPreview);
        skillsWrap.addEventListener('click', onSkillsClick);
      }

      // Idle attract: observe work zone visibility
      if (workIdxForIdle >= 0) {
        const servicesSection = document.getElementById('services');
        if (servicesSection) {
          const workObs = new IntersectionObserver(([entry]) => {
            workInView = entry.isIntersecting;
            if (workInView && currentStopIdx === workIdxForIdle) {
              workTeaseDone = false; // reset on re-entry
              armWorkTease();
            } else {
              stopWorkTease();
            }
          }, { threshold: 0.1 });
          workObs.observe(servicesSection);
        }

        if (workEl) {
          const workLink = workEl.closest('a') || workEl;
          workLink.addEventListener('pointerenter', () => { lastUserActionTs = performance.now(); stopWorkTease(); });
          workLink.addEventListener('pointermove', () => { lastUserActionTs = performance.now(); }, { passive: true });
        }
      }

      accentInited = true;
      return true;
    };

    // ── Resize handling ──
    const onAccentResize = () => {
      if (!accentInited) return;
      resizeAccentCanvas();
      cacheStopDocYs();
    };

    window.addEventListener('resize', onAccentResize);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (accentInited) cacheStopDocYs();
      });
    }

    // ── Init on first scroll ──
    // Lazy init: try on first scroll frame
    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (!accentInited) initAccent();
          updateHeroOnScroll();
        });
        ticking = true;
      }
    };

    if (!accentInited) initAccent();
    updateHeroOnScroll();
    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('scroll', requestAccentTick, { passive: true });
    window.addEventListener('resize', updateHeroOnScroll);
  }

  // 5. Fade in stacked panels (about, skills, services) as they stack
  const stackedPanels = document.querySelectorAll(
    '.panel-stack .agency-intro, .panel-stack .skills-showcase, .panel-stack .services'
  );

  if (stackedPanels.length) {
    if ('IntersectionObserver' in window) {
      const panelObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) entry.target.classList.add('is-visible');
          });
        },
        { root: null, threshold: 0.25 }
      );

      stackedPanels.forEach((panel) => panelObserver.observe(panel));
    } else {
      stackedPanels.forEach((panel) => panel.classList.add('is-visible'));
    }
  }

  // 6. Hide wordmark when skills section reaches the header
  const siteWordmark = document.querySelector('.site-wordmark');
  const skillsSection = document.getElementById('skills');
  const header = document.querySelector('.site-header');

  if (siteWordmark && skillsSection) {
    const headerHeight = header ? header.offsetHeight : 64;

    const updateWordmark = () => {
      const rect = skillsSection.getBoundingClientRect();
      if (rect.top <= headerHeight + 8) siteWordmark.classList.add('wordmark-hide');
      else siteWordmark.classList.remove('wordmark-hide');
    };

    updateWordmark();
    window.addEventListener('scroll', updateWordmark, { passive: true });
    window.addEventListener('resize', updateWordmark);
  }

  // 7. Services clamp band only (no bump animation)
  const servicesSection = document.querySelector('.services');
  if (servicesSection) {
    let servicesTicking = false;

    const updateServicesOnScroll = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const sectionRect = servicesSection.getBoundingClientRect();
      const inView = sectionRect.top < viewportHeight && sectionRect.bottom > 0;
      document.body.classList.toggle('services-active', inView);
      servicesTicking = false;
    };

    const requestServicesTick = () => {
      if (!servicesTicking) {
        servicesTicking = true;
        requestAnimationFrame(updateServicesOnScroll);
      }
    };

    updateServicesOnScroll();
    window.addEventListener('scroll', requestServicesTick, { passive: true });
    window.addEventListener('resize', requestServicesTick);
  }

  // 8. Lazy load service videos
  const lazyServiceVideos = document.querySelectorAll('.service-gallery video[data-autoplay]');

  if (lazyServiceVideos.length) {
    const startVideo = (video) => {
      const sources = video.querySelectorAll('source[data-src]');
      sources.forEach((source) => {
        if (!source.src && source.dataset.src) source.src = source.dataset.src;
      });

      video.load();
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');

      const playPromise = video.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => {
          video.muted = true;
          setTimeout(() => video.play().catch(() => {}), 100);
        });
      }
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const video = entry.target;
            startVideo(video);
            obs.unobserve(video);
          });
        },
        { root: null, rootMargin: '200px 0px', threshold: 0.01 }
      );

      lazyServiceVideos.forEach((video) => observer.observe(video));
    } else {
      lazyServiceVideos.forEach((video) => startVideo(video));
    }
  }

  // 9. Make entire case study card clickable (and remove the need for the arrow button)
  const caseStudyCards = document.querySelectorAll('.service-row.case-study[data-href]');
  if (caseStudyCards.length) {
    caseStudyCards.forEach((card) => {
      card.style.cursor = 'pointer';

      card.addEventListener('click', (e) => {
        // If they clicked a real link inside the card, let that link handle it
        if (e.target.closest('a')) return;

        const href = card.getAttribute('data-href');
        if (href) window.location.href = href;
      });
    });
  }
  // 11. Approach collage: video/image preview modal (replaces old click-to-contact)
  if (document.body.classList.contains('approach-page')) {
    initApproachVideoModal();
  }

});


// Video preview modal for approach page tiles
function initApproachVideoModal() {
  // Build modal DOM
  const overlay = document.createElement('div');
  overlay.className = 'video-modal-overlay';
  overlay.innerHTML = '<div class="video-modal-content"><button class="video-modal-close" aria-label="Close">&times;</button></div>';
  document.body.appendChild(overlay);

  const content = overlay.querySelector('.video-modal-content');
  const closeBtn = overlay.querySelector('.video-modal-close');
  let activeMedia = null;

  function openModal(tile) {
    const video = tile.querySelector('video');
    const img = tile.querySelector('img');

    // Remove any previous media in modal
    const prev = content.querySelector('video, img');
    if (prev) prev.remove();

    if (video) {
      const clone = document.createElement('video');
      const source = video.querySelector('source');
      clone.src = (source && source.getAttribute('src'))
        || video.currentSrc
        || video.getAttribute('src')
        || video.dataset.src
        || '';
      clone.autoplay = true;
      clone.loop = true;
      clone.muted = false;
      clone.volume = 1;
      clone.controls = true;
      clone.playsInline = true;
      content.appendChild(clone);
      // Try unmuted first (user gesture context); fallback to muted
      clone.play().catch(() => {
        clone.muted = true;
        clone.play().catch(() => {});
      });
      activeMedia = clone;
    } else if (img) {
      const clone = document.createElement('img');
      clone.src = img.src;
      clone.alt = img.alt || '';
      content.appendChild(clone);
      activeMedia = clone;
    } else {
      return;
    }

    overlay.classList.add('is-open');
  }

  function closeModal() {
    overlay.classList.remove('is-open');
    if (activeMedia && activeMedia.tagName === 'VIDEO') {
      activeMedia.pause();
      activeMedia.removeAttribute('src');
      activeMedia.load();
    }
    const media = content.querySelector('video, img');
    if (media) media.remove();
    activeMedia = null;
  }

  // Click on a tile video frame opens modal
  document.querySelector('.collage-stack').addEventListener('click', (e) => {
    const tileVideo = e.target.closest('.approach-tile-video');
    if (!tileVideo) return;

    // Don't interfere with header/menu clicks
    if (e.target.closest('.site-header') || e.target.closest('a')) return;

    e.preventDefault();
    e.stopPropagation();
    openModal(tileVideo);
  });

  // Close handlers
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });
}


// Collage rail: native horizontal scroller with 3D card transforms (desktop only)
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('approach-page')) return;
  initPinnedCollageScroll();
});

function initPinnedCollageScroll() {
  const isDesktop = () => window.matchMedia('(min-width: 1200px)').matches;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const section = document.getElementById('collageScrollSection');
  const pin     = document.getElementById('collageScrollPin');
  const stack   = document.getElementById('collageStack');
  if (!section || !pin || !stack) return;

  const panels = stack.querySelectorAll('.collage-panel');

  function recalc() {
    if (!isDesktop()) {
      section.style.height = '';
      stack.scrollLeft = 0;
      stack.style.setProperty('--railPadExtra', '0px');
      panels.forEach(p => { p.style.transform = ''; p.style.opacity = ''; });
      return;
    }

    // Center first card via extra left padding
    stack.style.setProperty('--railPadExtra', '0px');
    const basePadLeft = parseFloat(getComputedStyle(stack).paddingLeft) || 0;
    const firstPanel = panels[0];
    if (firstPanel) {
      const firstW = firstPanel.getBoundingClientRect().width;
      const desiredPad = Math.max(0, (stack.clientWidth - firstW) / 2);
      const extra = Math.max(0, desiredPad - basePadLeft);
      stack.style.setProperty('--railPadExtra', extra + 'px');
    }

    applyTransforms();
  }

  // 3D card transforms driven by stack.scrollLeft
  function applyTransforms() {
    if (!isDesktop() || prefersReduced.matches) return;
    const cx = stack.clientWidth / 2;
    const range = stack.clientWidth * 0.6;
    panels.forEach(p => {
      const pcx = (p.offsetLeft - stack.scrollLeft) + (p.offsetWidth / 2);
      const n = Math.max(-1, Math.min(1, (pcx - cx) / range));
      const absN = Math.abs(n);
      const ry = (-n * 10).toFixed(2);
      const tz = (-absN * 90).toFixed(1);
      const sc = (1 - absN * 0.05).toFixed(3);
      const op = (1 - absN * 0.25).toFixed(3);
      p.style.transform = `rotateY(${ry}deg) translateZ(${tz}px) scale(${sc})`;
      p.style.opacity = op;
    });
  }

  // RAF-throttled stack scroll → update transforms
  let ticking = false;
  stack.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; applyTransforms(); });
  }, { passive: true });

  // Shift+wheel → horizontal scroll on stack
  stack.addEventListener('wheel', (e) => {
    if (!isDesktop()) return;
    const hIntent = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!hIntent) return;
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : 1;
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    stack.scrollLeft += dx * scale;
  }, { passive: false });

  window.addEventListener('resize', recalc);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(recalc).observe(stack);
  }
  window.addEventListener('load', recalc);

  // ── Collage edge nav: left/right overlay chevrons ────────────────────────
  const svgL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="10,12 6,8 10,4"/></svg>';
  const svgR = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,4 10,8 6,12"/></svg>';

  const edgeNav = document.createElement('div');
  edgeNav.className = 'collage-edge-nav';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'collage-edge-btn collage-edge-btn--prev';
  prevBtn.setAttribute('aria-label', 'Previous card');
  prevBtn.innerHTML = svgL;

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'collage-edge-btn collage-edge-btn--next';
  nextBtn.setAttribute('aria-label', 'Next card');
  nextBtn.innerHTML = svgR;

  edgeNav.appendChild(prevBtn);
  edgeNav.appendChild(nextBtn);
  pin.appendChild(edgeNav);

  let snapLefts  = [];
  let navRafBusy = false;

  function buildSnaps() {
    snapLefts = Array.from(panels).map(p =>
      Math.round(p.offsetLeft + p.offsetWidth / 2 - stack.clientWidth / 2)
    );
  }

  function getActiveIdx() {
    if (!snapLefts.length) return 0;
    const sl = stack.scrollLeft;
    let best = 0, bestDist = Infinity;
    snapLefts.forEach((pos, i) => {
      const d = Math.abs(sl - pos);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  function updateBtns() {
    const idx = getActiveIdx();
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === snapLefts.length - 1;
  }

  function scrollToIdx(idx) {
    if (idx < 0 || idx >= snapLefts.length) return;
    const target = snapLefts[idx];
    if (prefersReduced.matches) {
      stack.scrollLeft = target;
      updateBtns();
      return;
    }
    const start = stack.scrollLeft;
    const delta = target - start;
    if (Math.abs(delta) < 2) { updateBtns(); return; }
    const dur = 380;
    const t0  = performance.now();
    navRafBusy = true;
    function step(now) {
      const p    = Math.min((now - t0) / dur, 1);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      stack.scrollLeft = start + delta * ease;
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        navRafBusy = false;
        updateBtns();
      }
    }
    requestAnimationFrame(step);
  }

  prevBtn.addEventListener('click', () => scrollToIdx(getActiveIdx() - 1));
  nextBtn.addEventListener('click', () => scrollToIdx(getActiveIdx() + 1));

  // ArrowLeft/Right when focus is anywhere inside the pin
  pin.addEventListener('keydown', e => {
    if (!isDesktop()) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); scrollToIdx(getActiveIdx() - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollToIdx(getActiveIdx() + 1); }
  });

  // RAF-throttled scroll → update button disabled state
  let btnSyncTick = false;
  stack.addEventListener('scroll', () => {
    if (navRafBusy || btnSyncTick) return;
    btnSyncTick = true;
    requestAnimationFrame(() => { btnSyncTick = false; if (!navRafBusy) updateBtns(); });
  }, { passive: true });

  // Rebuild snaps after recalc settles (deferred via rAF)
  let rebuildRaf = null;
  function scheduleRebuild() {
    if (rebuildRaf !== null) return;
    rebuildRaf = requestAnimationFrame(() => { rebuildRaf = null; buildSnaps(); updateBtns(); });
  }
  window.addEventListener('resize', scheduleRebuild);
  window.addEventListener('load',   scheduleRebuild);
  // ─────────────────────────────────────────────────────────────────────────

  recalc();
  buildSnaps();
  updateBtns();
}


// WORK COLLAGE — lazy-load, autoplay, focus mode, press/release (index page)
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('workCollageGrid');
  if (!grid) return;

  const panels = grid.querySelectorAll('.comic-panel');
  if (!panels.length) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // --- Lazy-load video sources via IntersectionObserver + autoplay ---
  const loadVideo = (video) => {
    const sources = video.querySelectorAll('source[data-src]');
    let swapped = false;
    sources.forEach((s) => {
      if (!s.src && s.dataset.src) { s.src = s.dataset.src; swapped = true; }
    });
    if (swapped) { video.preload = 'metadata'; video.load(); }
  };

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const v = e.target.querySelector('.comic-panel-video > video');
        if (v) {
          loadVideo(v);
          v.addEventListener('canplay', () => {
            v.muted = true;
            v.play().catch(() => {});
          }, { once: true });
        }
        o.unobserve(e.target);
      });
    }, { rootMargin: '400px 0px', threshold: 0.01 });
    panels.forEach((p) => obs.observe(p));
  } else {
    panels.forEach((p) => {
      const v = p.querySelector('.comic-panel-video > video');
      if (v) loadVideo(v);
    });
  }

  // --- Apple Card Tilt + Focus Mode (desktop pointer-fine only) ---
  if (canHover && !prefersReduced) {
    let activePanel = null;
    let rafId = 0;
    let lastX = 0;
    let lastY = 0;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const resetVars = (panel) => {
      panel.style.setProperty('--tiltX', '0deg');
      panel.style.setProperty('--tiltY', '0deg');
      panel.style.setProperty('--mediaX', '0px');
      panel.style.setProperty('--mediaY', '0px');
      panel.style.setProperty('--mx', '50%');
      panel.style.setProperty('--my', '50%');
    };

    const clearAll = () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (activePanel) {
        activePanel.classList.remove('is-active');
        resetVars(activePanel);
        activePanel = null;
      }
      grid.classList.remove('is-dimming');
      grid.querySelectorAll('.is-pressed').forEach((p) => p.classList.remove('is-pressed'));
    };

    const setActive = (panel) => {
      if (activePanel === panel) return;
      if (activePanel) {
        activePanel.classList.remove('is-active');
        resetVars(activePanel);
      }
      activePanel = panel;
      panel.classList.add('is-active');
      grid.classList.add('is-dimming');
    };

    // pointermove: find panel under cursor, update tilt + parallax per frame
    grid.addEventListener('pointermove', (e) => {
      // Use elementFromPoint for reliability with nested elements
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const panel = el ? el.closest('.comic-panel') : null;

      if (!panel || !grid.contains(panel)) {
        clearAll();
        return;
      }

      setActive(panel);
      lastX = e.clientX;
      lastY = e.clientY;

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          if (!activePanel) return;

          const rect = activePanel.getBoundingClientRect();
          // Normalized -0.5 to 0.5
          const nx = (lastX - rect.left) / rect.width - 0.5;
          const ny = (lastY - rect.top) / rect.height - 0.5;

          const tiltY = clamp(nx * 6, -4, 4);
          const tiltX = clamp(-ny * 6, -4, 4);
          const mediaX = clamp(nx * 10, -6, 6);
          const mediaY = clamp(ny * 10, -6, 6);
          const mx = ((nx + 0.5) * 100).toFixed(1);
          const my = ((ny + 0.5) * 100).toFixed(1);

          activePanel.style.setProperty('--tiltX', tiltX.toFixed(2) + 'deg');
          activePanel.style.setProperty('--tiltY', tiltY.toFixed(2) + 'deg');
          activePanel.style.setProperty('--mediaX', mediaX.toFixed(1) + 'px');
          activePanel.style.setProperty('--mediaY', mediaY.toFixed(1) + 'px');
          activePanel.style.setProperty('--mx', mx + '%');
          activePanel.style.setProperty('--my', my + '%');
        });
      }
    });

    // pointerleave on grid — clear everything
    grid.addEventListener('pointerleave', clearAll);

    // Scroll cancel
    window.addEventListener('scroll', () => {
      if (activePanel) clearAll();
    }, { passive: true });

    // Keyboard focus
    grid.addEventListener('focusin', (e) => {
      const panel = e.target.closest('.comic-panel');
      if (panel) setActive(panel);
    });
    grid.addEventListener('focusout', (e) => {
      if (!grid.contains(e.relatedTarget)) clearAll();
    });

  } else if (canHover && prefersReduced) {
    // Reduced motion: simple dim only, no tilt
    let activePanel = null;

    const clearAll = () => {
      if (activePanel) {
        activePanel.classList.remove('is-active');
        activePanel = null;
      }
      grid.classList.remove('is-dimming');
      grid.querySelectorAll('.is-pressed').forEach((p) => p.classList.remove('is-pressed'));
    };

    grid.addEventListener('pointermove', (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const panel = el ? el.closest('.comic-panel') : null;
      if (!panel || !grid.contains(panel)) { clearAll(); return; }
      if (activePanel === panel) return;
      if (activePanel) activePanel.classList.remove('is-active');
      activePanel = panel;
      panel.classList.add('is-active');
      grid.classList.add('is-dimming');
    });

    grid.addEventListener('pointerleave', clearAll);
    window.addEventListener('scroll', () => { if (activePanel) clearAll(); }, { passive: true });
    grid.addEventListener('focusin', (e) => {
      const panel = e.target.closest('.comic-panel');
      if (panel) {
        if (activePanel && activePanel !== panel) activePanel.classList.remove('is-active');
        activePanel = panel;
        panel.classList.add('is-active');
        grid.classList.add('is-dimming');
      }
    });
    grid.addEventListener('focusout', (e) => {
      if (!grid.contains(e.relatedTarget)) clearAll();
    });
  }

  // --- Press/Release (all devices, delegated on grid) ---
  grid.addEventListener('pointerdown', (e) => {
    const panel = e.target.closest('.comic-panel');
    if (panel) panel.classList.add('is-pressed');
  });

  grid.addEventListener('pointerup', () => {
    grid.querySelectorAll('.is-pressed').forEach((p) => p.classList.remove('is-pressed'));
  });

  grid.addEventListener('pointercancel', () => {
    grid.querySelectorAll('.is-pressed').forEach((p) => p.classList.remove('is-pressed'));
  });

  grid.addEventListener('click', () => {
    grid.querySelectorAll('.is-pressed').forEach((p) => p.classList.remove('is-pressed'));
  });
});


// Approach page hero: match home hero text drift + mid-screen fade, while drift canvas eases in
document.addEventListener('DOMContentLoaded', () => {
  const approachHero = document.querySelector('.hero.hero--approach');
  if (!approachHero) return;

  const topLine = approachHero.querySelector('.hero-line-top');
  const bottomLine = approachHero.querySelector('.hero-line-bottom');
  const videoWrapper = approachHero.querySelector('.approach-hero-video-wrapper');
  const driftCanvas = document.getElementById('approachDriftCanvas');
  const workAccent = approachHero.querySelector('.hero-line-bottom .accent');

  if (!topLine || !bottomLine || !videoWrapper || !driftCanvas) return;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // ── Drift engine ──
  const drift = (() => {
    // ── ION DRIFT v2 ────────────────────────────────────────────────────────
    const CFG = {
      COLORS: [[168,85,247],[68,136,255],[68,221,255],[204,85,255]],
      ION:    [160, 240, 255],  // visible color charge near pointer
      SPD_MIN: 0.30, SPD_MAX: 1.45,
      SPD_MIN_R: 0.08, SPD_MAX_R: 0.35,  // reduced motion
      LIFE_MIN: 280, LIFE_MAX: 950,
      PTR_R: 340,        // influence radius (canvas px)
      PTR_F: 0.20,       // vortex force
      PTR_LERP: 0.10,    // pointer smoothing
      PTR_RISE: 0.055, PTR_DECAY: 0.030,
      CURL_T: 0.00025,
      COMET_DUR: 900, COMET_R: 5, COMET_GLOW: 35, COMET_FRAGS: 9,
      FRAG_LIFE: 1400, SHOCK_DUR: 560,
    };
    const R2 = CFG.PTR_R * CFG.PTR_R;
    const CSTR = CFG.COLORS.map(c => `rgb(${c[0]},${c[1]},${c[2]})`);
    const ISTR = `rgb(${CFG.ION[0]},${CFG.ION[1]},${CFG.ION[2]})`;

    let ctx, W = 0, H = 0, dpr = 1;
    let particles = [];
    let raf = 0, intensity = 0;
    let ptrRawX = -9999, ptrRawY = -9999;
    let ptrX = -9999, ptrY = -9999;
    let ptrActive = false, ptrIntensity = 0;
    let canvasRect = { left: 0, top: 0, width: 0, height: 0 };
    let workRect = null, seedFired = false;
    let reduced = false, staticDone = false, isCoarse = false;
    let cometActive = false, cometSX = 0, cometSY = 0, cometT0 = 0;
    let fragments = [], shockwaves = [];

    const rnd = (a, b) => Math.random() * (b - a) + a;

    function fieldAngle(x, y, t) {
      const nx = x / W, ny = y / H, s = t * CFG.CURL_T;
      return (
        Math.sin(nx * 2.1 + s * 0.5) + Math.cos(ny * 2.3 + s * 0.3)
        + (Math.sin(nx * 4.7 + s * 0.7) + Math.cos(ny * 4.3 + s * 0.4)) * 0.5
        + (Math.sin(nx * 8.3 - s * 0.2) + Math.cos(ny * 7.9 - s * 0.15)) * 0.25
        + (Math.sin(nx * 12.1 + ny * 3.7 + s * 0.9)) * 0.15
      ) * Math.PI;
    }

    function makeParticle(x, y) {
      const px = (x !== undefined) ? x : rnd(0, W);
      const py = (y !== undefined) ? y : rnd(0, H);
      const roll = Math.random();
      let type, r;
      if (roll < 0.08)      { type = 'shard'; r = rnd(0.5, 0.9); }
      else if (roll < 0.14) { type = 'hero';  r = rnd(5.0, 9.0); }
      else                  { type = 'orb';   r = rnd(1.4, 4.5); }
      const spd = reduced ? rnd(CFG.SPD_MIN_R, CFG.SPD_MAX_R) : rnd(CFG.SPD_MIN, CFG.SPD_MAX);
      const life = (rnd(CFG.LIFE_MIN, CFG.LIFE_MAX)) | 0;
      return { x: px, y: py, spd, ci: (Math.random() * 4) | 0,
               life, ml: life, type, r: r * dpr, ox: 0, oy: 0, bvx: 0, bvy: 0 };
    }

    function initPool() {
      const desk = !isCoarse;
      const dens = reduced ? (desk ? 650 : 1000) : (desk ? 230 : 480);
      const lo   = reduced ? (desk ? 300 : 150)  : (desk ? 2200 : 600);
      const hi   = reduced ? (desk ? 700 : 350)  : (desk ? 5500 : 2000);
      const n = Math.min(Math.max((W * H / dens) | 0, lo), hi);
      particles = [];
      for (let i = 0; i < n; i++) particles.push(makeParticle());
    }

    function updateCanvasRect() {
      const r = driftCanvas.getBoundingClientRect();
      canvasRect = { left: r.left, top: r.top, width: r.width, height: r.height };
    }

    function doResize() {
      const lW = driftCanvas.offsetWidth, lH = driftCanvas.offsetHeight;
      if (!lW || !lH) return;
      dpr = _wcsViewport.getDprCap();
      W = (lW * dpr) | 0; H = (lH * dpr) | 0;
      driftCanvas.width = W; driftCanvas.height = H;
      initPool(); fragments = []; shockwaves = [];
      if (workAccent) workRect = workAccent.getBoundingClientRect();
      updateCanvasRect();
      if (reduced && !staticDone) renderStatic();
    }

    function tickPointer() {
      if (ptrRawX < -999) return;
      ptrX += (ptrRawX - ptrX) * CFG.PTR_LERP;
      ptrY += (ptrRawY - ptrY) * CFG.PTR_LERP;
      ptrIntensity = ptrActive
        ? Math.min(ptrIntensity + CFG.PTR_RISE, 1)
        : Math.max(ptrIntensity - CFG.PTR_DECAY, 0);
    }

    function updateParticles(t) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const a = fieldAngle(p.x, p.y, t);
        let vx = Math.cos(a) * p.spd + p.bvx;
        let vy = Math.sin(a) * p.spd + p.bvy;
        p.bvx *= 0.91; p.bvy *= 0.91;

        if (ptrIntensity > 0.01) {
          const dx = p.x - ptrX, dy = p.y - ptrY;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.1) {
            const d = Math.sqrt(d2);
            const f = (1 - d / CFG.PTR_R) * CFG.PTR_F * ptrIntensity;
            const pa = Math.atan2(dy, dx) + 1.5708;
            vx += Math.cos(pa) * f * (p.spd + 1) * 0.75;
            vy += Math.sin(pa) * f * (p.spd + 1) * 0.75;
            vx += (-dx / d) * f * (p.spd + 1) * 0.40;
            vy += (-dy / d) * f * (p.spd + 1) * 0.40;
            const prox = (1 - d / CFG.PTR_R) * ptrIntensity;
            p.ox += ((-dx / d) * prox * 2.5 - p.ox) * 0.12;
            p.oy += ((-dy / d) * prox * 2.5 - p.oy) * 0.12;
          } else { p.ox *= 0.93; p.oy *= 0.93; }
        } else { p.ox *= 0.97; p.oy *= 0.97; }

        const sp2 = vx * vx + vy * vy;
        if (sp2 > 16) { const inv = 4 / Math.sqrt(sp2); vx *= inv; vy *= inv; }
        p.x += vx; p.y += vy; p.life--;
        if (p.life <= 0 || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) {
          Object.assign(p, makeParticle());
        }
      }
    }

    function renderParticles() {
      const ic = CFG.ION, eff = intensity || 1;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const fade = p.ml > 0 ? p.life / p.ml : 0;
        const base = fade * eff;
        if (base < 0.01) continue;

        let rc = CFG.COLORS[p.ci][0], gc = CFG.COLORS[p.ci][1], bc = CFG.COLORS[p.ci][2];
        let scale3d = 1, bright = 1, useIstr = false;

        if (ptrIntensity > 0.02) {
          const dx = p.x - ptrX, dy = p.y - ptrY;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const prox = (1 - Math.sqrt(d2) / CFG.PTR_R) * ptrIntensity;
            rc = (rc + (ic[0] - rc) * prox) | 0;
            gc = (gc + (ic[1] - gc) * prox) | 0;
            bc = (bc + (ic[2] - bc) * prox) | 0;
            scale3d = 1 + prox * 0.85; bright = 1 + prox * 1.30;
            useIstr = false;
          }
        }

        const dx2 = p.x + p.ox, dy2 = p.y + p.oy, dr = p.r * scale3d;
        ctx.fillStyle = useIstr ? ISTR : `rgb(${rc},${gc},${bc})`;

        if (p.type === 'shard') {
          ctx.globalAlpha = Math.min(base * bright, 1);
          ctx.beginPath(); ctx.arc(dx2, dy2, dr + 0.5, 0, 6.283); ctx.fill();
        } else {
          ctx.globalAlpha = Math.min(base * 0.17 * bright, 1);
          ctx.beginPath(); ctx.arc(dx2, dy2, dr * 2.8, 0, 6.283); ctx.fill();
          ctx.globalAlpha = Math.min(base * 0.78 * bright, 1);
          ctx.beginPath(); ctx.arc(dx2, dy2, dr, 0, 6.283); ctx.fill();
        }
      }
    }

    function spawnShockwave(x, y, c) {
      shockwaves.push({ x, y, maxR: 90 * dpr, st: performance.now(),
                        dur: CFG.SHOCK_DUR, str: `rgb(${c[0]},${c[1]},${c[2]})` });
    }

    function drawShockwaves(now) {
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        const t = Math.min((now - s.st) / s.dur, 1);
        if (t >= 1) { shockwaves.splice(i, 1); continue; }
        ctx.globalAlpha = (1 - t) * 0.65 * (intensity || 1);
        ctx.strokeStyle = s.str;
        ctx.lineWidth = 2 * dpr * (1 - t * 0.6);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.maxR * t, 0, 6.283); ctx.stroke();
      }
    }

    function drawComet(now) {
      if (!cometActive) return;
      const t = Math.min((now - cometT0) / CFG.COMET_DUR, 1);
      const e = 1 - (1 - t) * (1 - t) * (1 - t);
      const cx = cometSX + (W / 2 - cometSX) * e;
      const cy = cometSY + (H / 2 - cometSY) * e;
      ctx.save();
      ctx.shadowColor = ISTR; ctx.shadowBlur = CFG.COMET_GLOW * dpr;
      ctx.globalAlpha = 0.42 * (intensity || 1);
      ctx.fillStyle = ISTR;
      ctx.beginPath(); ctx.arc(cx, cy, CFG.COMET_R * 2.8 * dpr, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 0.95 * (intensity || 1);
      ctx.fillStyle = '#fff'; ctx.shadowBlur = CFG.COMET_GLOW * 0.5 * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, CFG.COMET_R * dpr, 0, 6.283); ctx.fill();
      ctx.restore();
      if (t >= 1) {
        cometActive = false;
        spawnShockwave(cx, cy, CFG.ION); spawnShockwave(cx, cy, CFG.COLORS[2]);
        for (let i = 0; i < CFG.COMET_FRAGS; i++) {
          const a = rnd(0, Math.PI * 2), sp = rnd(3.5, 8.5);
          fragments.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                           r: rnd(2, 5) * dpr, ci: (Math.random() * 4) | 0,
                           st: now, life: rnd(CFG.FRAG_LIFE * 0.55, CFG.FRAG_LIFE) });
        }
      }
    }

    function drawFragments(now) {
      for (let i = fragments.length - 1; i >= 0; i--) {
        const f = fragments[i];
        const age = now - f.st;
        if (age > f.life) {
          const p = makeParticle(f.x, f.y); particles.push(p);
          fragments.splice(i, 1); continue;
        }
        f.vx *= 0.97; f.vy *= 0.97; f.x += f.vx; f.y += f.vy;
        const mt = age / f.life;
        const c = CFG.COLORS[f.ci];
        ctx.save();
        ctx.globalAlpha = (1 - mt) * 0.9 * (intensity || 1);
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.shadowColor = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.shadowBlur = f.r * 4 * (1 - mt * 0.7);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + (1 - mt) * 0.7), 0, 6.283); ctx.fill();
        ctx.restore();
      }
    }

    function loop() {
      const now = performance.now();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      tickPointer();
      updateParticles(now);
      ctx.globalCompositeOperation = 'lighter';
      renderParticles();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      drawShockwaves(now);
      if (cometActive) drawComet(now);
      if (fragments.length) drawFragments(now);
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    }

    function start() { if (!raf && !reduced) raf = requestAnimationFrame(loop); }
    function stop()  { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    function renderStatic() {
      if (!ctx || !W) return;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      for (let f = 0; f < 60; f++) updateParticles(f * 16);
      ctx.globalCompositeOperation = 'lighter'; renderParticles();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      staticDone = true;
    }

    function onPtr(ev) {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      if (!canvasRect.width) return;
      ptrRawX = ((cx - canvasRect.left) / canvasRect.width) * W;
      ptrRawY = ((cy - canvasRect.top) / canvasRect.height) * H;
      if (ptrX < -999) { ptrX = ptrRawX; ptrY = ptrRawY; }
    }

    return {
      init() {
        ctx = driftCanvas.getContext('2d');
        reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        isCoarse = window.matchMedia('(pointer: coarse)').matches;
        doResize();
        if (!reduced) {
          window.addEventListener('mousemove', onPtr, { passive: true });
          window.addEventListener('touchmove', onPtr, { passive: true });
          videoWrapper.addEventListener('mouseenter', () => { ptrActive = true; }, { passive: true });
          videoWrapper.addEventListener('mouseleave', () => { ptrActive = false; }, { passive: true });
          driftCanvas.addEventListener('click', (ev) => {
            if (!W) return;
            const cx = ((ev.clientX - canvasRect.left) / canvasRect.width) * W;
            const cy = ((ev.clientY - canvasRect.top) / canvasRect.height) * H;
            spawnShockwave(cx, cy, CFG.COLORS[2]);
            for (let i = 0; i < 16; i++) {
              const p = makeParticle(cx, cy);
              const a = (i / 16) * Math.PI * 2;
              p.bvx = Math.cos(a) * rnd(2, 5); p.bvy = Math.sin(a) * rnd(2, 5);
              particles.push(p);
            }
          });
          new IntersectionObserver((entries) => {
            entries.forEach(e => {
              if (e.isIntersecting && intensity > 0) start();
              else if (!e.isIntersecting) stop();
            });
          }, { threshold: 0.01 }).observe(videoWrapper);
        }
      },

      setIntensity(v) {
        intensity = v;
        if (v > 0) start(); else stop();
      },

      checkSeedBurst(progress) {
        if (reduced) return;
        if (progress >= 0.35 && !seedFired) {
          if (!workRect) return;
          const sx = ((workRect.left + workRect.width / 2) - canvasRect.left) * dpr;
          const sy = ((workRect.top + workRect.height / 2) - canvasRect.top) * dpr;
          cometSX = sx; cometSY = sy;
          cometActive = true; cometT0 = performance.now();
          seedFired = true;
        }
        if (progress < 0.2 && seedFired) {
          seedFired = false; cometActive = false; fragments = [];
        }
      },

      updateRect: updateCanvasRect,
      onResize: doResize
    };
  })();

  drift.init();

  // ── Particle-to-text handoff: overlay messenger to heading ──
  // Messengers render on a FIXED overlay canvas so they are not clipped by
  // the hero wrapper's overflow:hidden. The overlay only runs during the
  // handoff animation (no idle RAF).
  // Uses visualViewport for iOS Safari correctness + locks sizing during flight.
  const approachTitle = document.querySelector('.approach-title');
  if (approachTitle && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const hoCvs = document.createElement('canvas');
    hoCvs.setAttribute('aria-hidden', 'true');
    hoCvs.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;';
    document.body.appendChild(hoCvs);
    const hoCtx = hoCvs.getContext('2d');
    let hoW = 0, hoH = 0, hoDpr = 1;
    let hoFlying = false, hoPendingResize = false;
    const HCOLOR = [168, 85, 247]; // accent purple

    function hoResize() {
      if (hoFlying) { hoPendingResize = true; return; }
      const vp = _wcsViewport.getViewport();
      hoDpr = _wcsViewport.getDprCap();
      hoW = Math.round(vp.vw * hoDpr);
      hoH = Math.round(vp.vh * hoDpr);
      hoCvs.width = hoW;
      hoCvs.height = hoH;
    }
    hoResize();
    const hoResizeThrottled = _wcsViewport.makeRafThrottle(hoResize);
    window.addEventListener('resize', hoResizeThrottled, { passive: true });
    window.addEventListener('orientationchange', hoResizeThrottled, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', hoResizeThrottled, { passive: true });
      window.visualViewport.addEventListener('scroll', hoResizeThrottled, { passive: true });
    }

    let hoMsgs = [];
    let hoBursts = [];
    let hoRaf = 0;
    const hoRnd = (a, b) => Math.random() * (b - a) + a;

    function hoFire(sx, sy, tx, ty) {
      hoMsgs = [];
      hoBursts = [];
      hoFlying = true;
      const now = performance.now();
      for (let i = 0; i < 18; i++) {
        const a = hoRnd(0, Math.PI * 2), d = hoRnd(5, 50) * hoDpr;
        const ox = sx + Math.cos(a) * d;
        const oy = sy + Math.sin(a) * d;
        hoMsgs.push({
          x: ox, y: oy, lx: ox, ly: oy,
          sx: ox, sy: oy, tx, ty,
          st: now + hoRnd(0, 150),
          dur: hoRnd(550, 950),
          arrived: false,
          burstFired: false
        });
      }
      if (!hoRaf) hoRaf = requestAnimationFrame(hoLoop);
    }

    function hoLoop(now) {
      hoCtx.clearRect(0, 0, hoW, hoH);
      let allDone = true;

      // Update + draw messengers
      for (let i = 0; i < hoMsgs.length; i++) {
        const m = hoMsgs[i];
        if (m.arrived) {
          if (!m.burstFired) {
            m.burstFired = true;
            for (let j = 0; j < 5; j++) {
              const ba = hoRnd(0, Math.PI * 2);
              const bspd = hoRnd(1, 3) * hoDpr;
              hoBursts.push({
                x: m.tx, y: m.ty,
                vx: Math.cos(ba) * bspd, vy: Math.sin(ba) * bspd,
                st: now, life: hoRnd(180, 280)
              });
            }
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
        if (t >= 1) { m.arrived = true; allDone = false; continue; }
        allDone = false;
        const fade = 1 - t * 0.2;
        hoCtx.strokeStyle = `rgba(${HCOLOR[0]},${HCOLOR[1]},${HCOLOR[2]},${fade.toFixed(2)})`;
        hoCtx.lineWidth = 3.5 * hoDpr;
        hoCtx.beginPath();
        hoCtx.moveTo(m.lx, m.ly);
        hoCtx.lineTo(m.x, m.y);
        hoCtx.stroke();
      }

      // Update + draw contact bursts
      for (let i = hoBursts.length - 1; i >= 0; i--) {
        const b = hoBursts[i];
        const age = now - b.st;
        if (age > b.life) { hoBursts.splice(i, 1); continue; }
        b.x += b.vx; b.y += b.vy;
        b.vx *= 0.9; b.vy *= 0.9;
        const bfade = 1 - age / b.life;
        hoCtx.strokeStyle = `rgba(${HCOLOR[0]},${HCOLOR[1]},${HCOLOR[2]},${(bfade * 0.85).toFixed(2)})`;
        hoCtx.lineWidth = 2 * hoDpr;
        hoCtx.beginPath();
        hoCtx.moveTo(b.x - b.vx * 3, b.y - b.vy * 3);
        hoCtx.lineTo(b.x, b.y);
        hoCtx.stroke();
        allDone = false;
      }

      if (!allDone) {
        hoRaf = requestAnimationFrame(hoLoop);
      } else {
        hoRaf = 0;
        hoFlying = false;
        hoMsgs = [];
        hoBursts = [];
        hoCtx.clearRect(0, 0, hoW, hoH);
        // Apply any resize that was deferred during flight
        if (hoPendingResize) { hoPendingResize = false; hoResize(); }
      }
    }

    let handoffDone = false;
    const titleObs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !handoffDone) {
        handoffDone = true;
        // One-shot rect reads — not in RAF
        const vp = _wcsViewport.getViewport();
        const wr = videoWrapper.getBoundingClientRect();
        const tr = approachTitle.getBoundingClientRect();
        const sx = (wr.left + wr.width / 2 - vp.ox) * hoDpr;
        const sy = (wr.bottom - 40 - vp.oy) * hoDpr;
        const tx = (tr.left + tr.width / 2 - vp.ox) * hoDpr;
        const ty = (tr.top + tr.height / 2 - vp.oy) * hoDpr;
        hoFire(sx, sy, tx, ty);
        // Purple pulse on heading after messengers arrive (color only, no glow)
        setTimeout(() => {
          approachTitle.style.color = '#a855f7';
          setTimeout(() => { approachTitle.style.color = ''; }, 900);
        }, 750);
      }
      if (!entry.isIntersecting && handoffDone) {
        const heroBottom = approachHero.getBoundingClientRect().bottom;
        if (heroBottom > window.innerHeight) handoffDone = false;
      }
    }, { threshold: 0.5 });
    titleObs.observe(approachTitle);
  }

  let ticking = false;
  let lastProgress = -1;

  function update() {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const start = approachHero.offsetTop;
    const end = start + approachHero.offsetHeight - viewportHeight;
    const scrollY = window.scrollY || window.pageYOffset;

    if (end <= start) {
      ticking = false;
      return;
    }

    // Base progress (kept for VIDEO so your approach hero video behavior stays the same)
    let progress = (scrollY - start) / (end - start);
    progress = clamp(progress, 0, 1);

    // Text progress (matched to HOME HERO pacing: 200vh hero => 1 viewport of scroll drives the whole text drift)
    let textProgress = (scrollY - start) / viewportHeight;
    textProgress = clamp(textProgress, 0, 1);

    const isMobile = window.innerWidth <= 767;
    const threshold = isMobile ? 0.006 : 0.001;

    // Use TEXT progress for throttling so drift feels identical to home
    if (Math.abs(textProgress - lastProgress) < threshold) {
      ticking = false;
      return;
    }
    lastProgress = textProgress;

    // Match HOME HERO behavior for TEXT
    const fadeStart = 0.25;
    const fadeEnd = 0.75;
    const maxXOffset = isMobile ? 15 : 40;

    // Top line (left), bottom line (right)
    [topLine, bottomLine].forEach((line, index) => {
      const direction = index === 0 ? -1 : 1;

      const slideT = Math.min(textProgress / fadeEnd, 1);
      const xOffset = direction * slideT * maxXOffset;
      const yOffset = isMobile ? 0 : -textProgress * 12;

      let opacity = 1;
      if (textProgress >= fadeStart) {
        const t = Math.min((textProgress - fadeStart) / (fadeEnd - fadeStart), 1);
        opacity = 1 - t;
      }

      line.style.transform = `translate3d(${xOffset}vw, ${yOffset}px, 0)`;
      line.style.opacity = String(opacity);
    });

    // Drift wrapper stays driven by the full approach hero scroll range
    const appearStart = 0.35;
    const appearEnd = 0.9;
    let t = (progress - appearStart) / (appearEnd - appearStart);
    t = clamp(t, 0, 1);
    const e = easeOutCubic(t);

    const minScale = 0.62;
    const baseW = videoWrapper.offsetWidth;
    const baseH = videoWrapper.offsetHeight;
    const coverScale = Math.max(window.innerWidth / baseW, window.innerHeight / baseH) + 0.01;
    const maxScale = Math.max(1.07, coverScale);
    const scale = minScale + e * (maxScale - minScale);

    videoWrapper.style.transform = `translate3d(-50%, -50%, 0) scale3d(${scale}, ${scale}, 1)`;
    videoWrapper.style.opacity = String(e);

    // Drive drift canvas
    drift.updateRect();
    drift.setIntensity(e);
    drift.checkSeedBurst(progress);

    ticking = false;
  }

  function requestTick() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  update();
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', () => {
    lastProgress = -1;
    drift.onResize();
    update();
  });
});


// ── Approach collage: tether filaments from .approach-title → hovered panel ──
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('approach-page')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  const srcEl  = document.querySelector('.approach-title');
  const panels = document.querySelectorAll('#collageStack .collage-panel');
  if (!srcEl || !panels.length) return;

  const COLORS = [[68,221,255],[168,85,247],[204,85,255],[68,136,255]];
  const MAIN_N = 3, MICRO_N = 2;

  const vv = window.visualViewport;
  const getVP = () => vv ? { ox: vv.offsetLeft, oy: vv.offsetTop }
                          : { ox: 0, oy: 0 };
  const dprCap = () => Math.min(window.devicePixelRatio || 1, 2);

  const cvs = document.createElement('canvas');
  cvs.setAttribute('aria-hidden', 'true');
  cvs.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:25;';
  document.body.appendChild(cvs);
  const ctx2 = cvs.getContext('2d');
  let W2 = 0, H2 = 0, dpr2 = 1;

  function resize2() {
    dpr2 = dprCap();
    W2 = Math.round((vv ? vv.width : window.innerWidth) * dpr2);
    H2 = Math.round((vv ? vv.height : window.innerHeight) * dpr2);
    cvs.width = W2; cvs.height = H2;
  }
  resize2();
  window.addEventListener('resize', resize2, { passive: true });

  let raf2 = 0, fadeAlpha2 = 0, fadeDir2 = 0;
  let startTime2 = 0, activePanel2 = null;
  let srcPt2 = [0, 0], anchors2 = [], fils2 = [], bursts2 = [];
  const rnd2 = (a, b) => Math.random() * (b - a) + a;

  function getPt(el) {
    const r = el.getBoundingClientRect(), vp = getVP();
    return [(r.left + r.width / 2 - vp.ox) * dpr2, (r.top + r.height / 2 - vp.oy) * dpr2];
  }

  function perimPts(rect, n) {
    const vp = getVP();
    const { left, right, top, bottom, width, height } = rect;
    const peri = 2 * (width + height), step = peri / n, pts = [];
    for (let i = 0; i < n; i++) {
      let d = step * i + step * 0.1 + rnd2(-step * 0.2, step * 0.2);
      d = ((d % peri) + peri) % peri;
      let x, y;
      if (d < width)                   { x = left + d;                          y = top; }
      else if (d < width + height)     { x = right;                             y = top + (d - width); }
      else if (d < 2 * width + height) { x = right - (d - width - height);      y = bottom; }
      else                             { x = left;                              y = bottom - (d - 2 * width - height); }
      pts.push([(x - vp.ox) * dpr2, (y - vp.oy) * dpr2]);
    }
    return pts;
  }

  function bezPt2(t, x0, y0, cx, cy, x1, y1) {
    const mt = 1 - t;
    return [mt*mt*x0 + 2*mt*t*cx + t*t*x1, mt*mt*y0 + 2*mt*t*cy + t*t*y1];
  }

  function buildFils2() {
    fils2 = [];
    const total = MAIN_N + MICRO_N;
    for (let i = 0; i < total; i++) {
      const main = i < MAIN_N;
      fils2.push({
        ai: i % anchors2.length, ci: i % COLORS.length,
        freq: rnd2(0.5, 1.6), phase: rnd2(0, Math.PI * 2),
        amp:  rnd2(main ? 35 : 12, main ? 80 : 35) * dpr2,
        ampY: rnd2(main ? 20 : 8,  main ? 50 : 20) * dpr2,
        alpha: main ? rnd2(0.50, 0.75) : rnd2(0.15, 0.30),
        lw: main ? rnd2(1.0, 1.6) : rnd2(0.5, 0.8), main,
        spark: main ? { t: rnd2(0, 1), spd: rnd2(0.004, 0.01), dir: 1 } : null,
      });
    }
  }

  function drawFil2(f, elapsed, alpha) {
    if (!anchors2[f.ai]) return;
    const [ax, ay] = anchors2[f.ai], [sx, sy] = srcPt2;
    const mx = (sx + ax) / 2 + Math.sin(elapsed * f.freq + f.phase) * f.amp;
    const my = (sy + ay) / 2 + Math.cos(elapsed * f.freq * 0.7 + f.phase) * f.ampY;
    const c = COLORS[f.ci], a = f.alpha * alpha;
    ctx2.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    if (f.main) {
      ctx2.globalAlpha = a * 0.18; ctx2.lineWidth = f.lw * dpr2 * 4;
      ctx2.beginPath(); ctx2.moveTo(sx, sy); ctx2.quadraticCurveTo(mx, my, ax, ay); ctx2.stroke();
    }
    ctx2.globalAlpha = a * (f.main ? 0.82 : 0.70); ctx2.lineWidth = f.lw * dpr2;
    ctx2.beginPath(); ctx2.moveTo(sx, sy); ctx2.quadraticCurveTo(mx, my, ax, ay); ctx2.stroke();
    if (f.main) {
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.5 + f.phase);
      const nr = (1.5 + pulse * 1.5) * dpr2;
      ctx2.globalAlpha = a * (0.6 + pulse * 0.4);
      ctx2.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx2.beginPath(); ctx2.arc(sx, sy, nr, 0, 6.283); ctx2.fill();
      ctx2.beginPath(); ctx2.arc(ax, ay, nr * 0.85, 0, 6.283); ctx2.fill();
    }
    if (f.spark) {
      f.spark.t += f.spark.spd * f.spark.dir;
      if (f.spark.t > 1.05 || f.spark.t < -0.05) { f.spark.dir *= -1; f.spark.t = Math.max(0, Math.min(1, f.spark.t)); }
      const [spx, spy] = bezPt2(f.spark.t, sx, sy, mx, my, ax, ay);
      ctx2.globalAlpha = a * 0.95; ctx2.fillStyle = '#fff';
      ctx2.beginPath(); ctx2.arc(spx, spy, 1.5 * dpr2, 0, 6.283); ctx2.fill();
    }
  }

  function renderApproachTether(now) {
    ctx2.clearRect(0, 0, W2, H2); ctx2.globalAlpha = 1;
    fadeAlpha2 = fadeDir2 > 0 ? Math.min(fadeAlpha2 + 0.07, 1)
               : fadeDir2 < 0 ? Math.max(fadeAlpha2 - 0.06, 0)
               : fadeAlpha2;
    const elapsed = (now - startTime2) * 0.001;
    if (fadeAlpha2 > 0 && anchors2.length) {
      ctx2.save();
      for (let i = 0; i < fils2.length; i++) drawFil2(fils2[i], elapsed, fadeAlpha2);
      ctx2.restore();
    }
    for (let i = bursts2.length - 1; i >= 0; i--) {
      const b = bursts2[i]; const age = now - b.st;
      if (age > b.life) { bursts2.splice(i, 1); continue; }
      b.x += b.vx; b.y += b.vy; b.vx *= 0.91; b.vy *= 0.91;
      const c = COLORS[b.ci];
      ctx2.globalAlpha = (1 - age / b.life) * 0.9;
      ctx2.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx2.lineWidth = 2 * dpr2;
      ctx2.beginPath(); ctx2.moveTo(b.x - b.vx * 3, b.y - b.vy * 3); ctx2.lineTo(b.x, b.y); ctx2.stroke();
    }
    if (fadeAlpha2 > 0 || bursts2.length) { raf2 = requestAnimationFrame(renderApproachTether); }
    else { raf2 = 0; ctx2.clearRect(0, 0, W2, H2); }
  }

  panels.forEach((panel) => {
    panel.addEventListener('pointerenter', () => {
      activePanel2 = panel;
      srcPt2   = getPt(srcEl);
      anchors2 = perimPts(panel.getBoundingClientRect(), MAIN_N + MICRO_N);
      buildFils2(); fadeDir2 = 1; startTime2 = performance.now();
      if (!raf2) raf2 = requestAnimationFrame(renderApproachTether);
      setTimeout(() => {
        const now = performance.now();
        for (let i = 0; i < MAIN_N; i++) {
          if (!anchors2[i]) continue;
          for (let j = 0; j < 5; j++) {
            const a = Math.random() * Math.PI * 2, spd = rnd2(1, 3) * dpr2;
            bursts2.push({ x: anchors2[i][0], y: anchors2[i][1],
                           vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
                           st: now, life: rnd2(180, 320), ci: i % COLORS.length });
          }
        }
      }, 120);
    }, { passive: true });

    panel.addEventListener('pointerleave', () => {
      if (activePanel2 === panel) { activePanel2 = null; fadeDir2 = -1; }
      if (!raf2) raf2 = requestAnimationFrame(renderApproachTether);
    }, { passive: true });
  });
});



// Approach collage: posters + staged lazy playback
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('approach-page')) return;

  const _prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const _canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Tile id -> ordered list of clip URLs
  const rotationMap = {
    'tile-3d': ['https://res.cloudinary.com/ddpcw88mj/video/upload/lab7.mp4'],
    'tile-final': ['https://res.cloudinary.com/ddpcw88mj/video/upload/s3.mp4'],
    'tile-edit': ['https://res.cloudinary.com/ddpcw88mj/video/upload/vid2.mp4'],
    'tile-brand': ['https://res.cloudinary.com/ddpcw88mj/video/upload/vid3.mp4', 'https://res.cloudinary.com/ddpcw88mj/video/upload/vid2.mp4'],
    'tile-sound': ['https://res.cloudinary.com/ddpcw88mj/video/upload/vid1.mp4', 'https://res.cloudinary.com/ddpcw88mj/video/upload/vid5.mp4'],
    'tile-type': ['https://res.cloudinary.com/ddpcw88mj/video/upload/vid4.mp4'],
    'tile-delivery': ['https://res.cloudinary.com/ddpcw88mj/video/upload/d3.mp4']
  };

  const sbPlaylist = ['https://res.cloudinary.com/ddpcw88mj/video/upload/lab8.mp4'];
  const allTileVideos = Array.from(document.querySelectorAll('.approach-tile-video video'));

  // First/primary source URL for any tile video (used for poster + preload)
  function tileFirstSrc(v) {
    if (v.id === 'storyboardPlaylistVideo') return sbPlaylist[0];
    const article = v.closest('article[id]');
    if (article && rotationMap[article.id]) return rotationMap[article.id][0];
    return v.dataset.src || '';
  }

  // ── A) Posters — runs always, including dev mode and reduced-motion ──
  allTileVideos.forEach((v) => {
    if (!v.poster) {
      const src = tileFirstSrc(v);
      if (src) v.poster = _cldPoster(src);
    }
  });

  // No video playback in dev mode (posters remain visible) or reduced-motion
  if (_vmDevMode || _prefersReduced) return;

  // ── Shared active-video tracker (one playing at a time across all tiles) ──
  let vmActive = null;
  function vmPauseVideo(v) { if (v && !v.paused) v.pause(); }
  function vmPlay(v) {
    if (vmActive && vmActive !== v) vmPauseVideo(vmActive);
    vmActive = v;
    v.muted = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }

  // On-demand src assignment (fallback if preload observer hasn't fired yet)
  function ensureSrc(v) {
    if (v.getAttribute('src')) return;
    const src = tileFirstSrc(v);
    if (!src) return;
    v.src = _cldOpt(src);
    v.preload = 'metadata';
    v.load();
  }

  // ── Rotation map: crossfade + loop setup ──
  const rotIdx = {}; // tileId -> current clip index
  Object.entries(rotationMap).forEach(([tileId, sources]) => {
    const tile = document.getElementById(tileId);
    if (!tile) return;
    const video = tile.querySelector('video');
    if (!video) return;

    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.display = 'block';
    rotIdx[tileId] = 0;

    if (sources.length <= 1) { video.loop = true; return; }

    // Multi-clip crossfade
    video.loop = false;
    video.style.opacity = '1';
    video.style.transition = 'opacity 420ms ease';

    function fadeToNext() {
      if (video.dataset.fading === 'out') return;
      video.dataset.fading = 'out';
      video.style.opacity = '0';
    }
    video.addEventListener('transitionend', (ev) => {
      if (ev.propertyName !== 'opacity') return;
      if (video.dataset.fading === 'out') {
        rotIdx[tileId] = (rotIdx[tileId] + 1) % sources.length;
        video.dataset.fading = 'in';
        video.src = _cldOpt(sources[rotIdx[tileId]]);
        video.load();
        vmPlay(video);
        requestAnimationFrame(() => { video.style.opacity = '1'; });
      } else if (video.dataset.fading === 'in') {
        video.dataset.fading = '';
      }
    });
    video.addEventListener('ended', fadeToNext);
    tile.addEventListener('click', fadeToNext);
  });

  // Storyboard playlist cycling (re-plays on ended)
  const sbVideo = document.getElementById('storyboardPlaylistVideo');
  let sbIndex = 0;
  if (sbVideo) {
    sbVideo.addEventListener('ended', () => {
      sbIndex = (sbIndex + 1) % sbPlaylist.length;
      if (vmActive === sbVideo) {
        sbVideo.src = _cldOpt(sbPlaylist[sbIndex]);
        sbVideo.load();
        vmPlay(sbVideo);
      }
    });
  }

  // ── B) Stage 1: preload zone — assign src + preload=metadata before play ──
  const preloadObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const v = e.target;
      if (v.getAttribute('src')) { preloadObs.unobserve(v); return; }
      const src = tileFirstSrc(v);
      if (!src) return;
      v.src = _cldOpt(src);
      v.preload = 'metadata';
      v.load();
      preloadObs.unobserve(v);
    });
  }, { rootMargin: '200px 400px 200px 400px', threshold: 0 });
  allTileVideos.forEach((v) => preloadObs.observe(v));

  // ── C) Desktop: hover-to-play (pointer: fine + hover) ──
  if (_canHover) {
    allTileVideos.forEach((v) => {
      const article = v.closest('article');
      if (!article) return;
      article.addEventListener('pointerenter', () => { ensureSrc(v); vmPlay(v); });
      article.addEventListener('pointerleave', () => vmPauseVideo(v));
    });
    return; // desktop done — no scroll-driven autoplay
  }

  // ── D) Mobile: autoplay best visible video after first user gesture ──
  const intersecting = new Map(); // video -> intersectionRatio
  let gestureReady = false;

  const playZoneObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        intersecting.set(e.target, e.intersectionRatio);
      } else {
        intersecting.delete(e.target);
        vmPauseVideo(e.target);
      }
    });
    if (!gestureReady) return;
    let bestV = null, bestR = 0;
    intersecting.forEach((r, v) => { if (r > bestR) { bestR = r; bestV = v; } });
    if (bestV) vmPlay(bestV);
  }, { rootMargin: '0px', threshold: [0.1, 0.35, 0.6] });
  allTileVideos.forEach((v) => playZoneObs.observe(v));

  function onFirstGesture() {
    gestureReady = true;
    let bestV = null, bestR = 0;
    intersecting.forEach((r, v) => { if (r > bestR) { bestR = r; bestV = v; } });
    if (bestV) vmPlay(bestV);
  }
  document.addEventListener('touchstart', onFirstGesture, { once: true, passive: true });
  document.addEventListener('scroll', onFirstGesture, { once: true, passive: true });
});


// CURSOR FX — disabled
