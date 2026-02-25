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
      'interactive',
      'motion-led',
      'story-driven',
      'campaign-ready',
      'short-form',
      'illustrated',
      'AI-enabled'
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
    let cometEX = 0, cometEY = 0, cometCPX = 0, cometCPY = 0, cometTail = [];
    let fragments = [], shockwaves = [];
    let fieldActive = false, fieldBloomT0 = 0;

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
      else if (roll < 0.11) { type = 'hero';  r = rnd(5.0, 9.0); }
      else                  { type = 'orb';   r = rnd(1.4, 4.5); }
      const spd = reduced ? rnd(CFG.SPD_MIN_R, CFG.SPD_MAX_R) : rnd(CFG.SPD_MIN, CFG.SPD_MAX);
      const life = (rnd(CFG.LIFE_MIN, CFG.LIFE_MAX)) | 0;
      return { x: px, y: py, lx: px, ly: py, spd, ci: (Math.random() * 4) | 0,
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
      initPool(); fragments = []; shockwaves = []; cometTail = [];
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
        p.lx = p.x; p.ly = p.y;
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
      if (!fieldActive) return;
      const bloomAlpha = Math.min((performance.now() - fieldBloomT0) / 700, 1);
      const ic = CFG.ION, eff = (intensity || 1) * bloomAlpha;
      ctx.lineCap = 'round';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const fade = p.ml > 0 ? p.life / p.ml : 0;
        const base = fade * eff;
        if (base < 0.01) continue;

        let rc = CFG.COLORS[p.ci][0], gc = CFG.COLORS[p.ci][1], bc = CFG.COLORS[p.ci][2];
        let scale3d = 1, bright = 1;

        if (ptrIntensity > 0.02) {
          const dx = p.x - ptrX, dy = p.y - ptrY;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const prox = (1 - Math.sqrt(d2) / CFG.PTR_R) * ptrIntensity;
            rc = (rc + (ic[0] - rc) * prox) | 0;
            gc = (gc + (ic[1] - gc) * prox) | 0;
            bc = (bc + (ic[2] - bc) * prox) | 0;
            scale3d = 1 + prox * 0.85; bright = 1 + prox * 1.30;
          }
        }

        const cx2 = p.x + p.ox, cy2 = p.y + p.oy;
        const lx2 = p.lx + p.ox, ly2 = p.ly + p.oy;
        const dr = p.r * scale3d;
        const col = `rgb(${rc},${gc},${bc})`;

        if (p.type === 'hero') {
          // Small tight plasma glow — not a big soap-bubble halo
          ctx.globalAlpha = Math.min(base * 0.20 * bright, 1);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(cx2, cy2, dr * 2.2, 0, 6.283); ctx.fill();
          ctx.globalAlpha = Math.min(base * 0.90 * bright, 1);
          ctx.fillStyle = `rgb(${Math.min(rc+70,255)},${Math.min(gc+70,255)},${Math.min(bc+70,255)})`;
          ctx.beginPath(); ctx.arc(cx2, cy2, dr * 0.55, 0, 6.283); ctx.fill();
        } else if (p.type === 'shard') {
          // Thin bright streak — crisp ion needle
          ctx.globalAlpha = Math.min(base * bright * 1.1, 1);
          ctx.strokeStyle = `rgb(${Math.min(rc+90,255)},${Math.min(gc+90,255)},${Math.min(bc+90,255)})`;
          ctx.lineWidth = dr * 0.7;
          ctx.beginPath(); ctx.moveTo(lx2, ly2); ctx.lineTo(cx2, cy2); ctx.stroke();
        } else {
          // orb → plasma streak: soft outer glow + bright core
          ctx.globalAlpha = Math.min(base * bright * 0.32, 1);
          ctx.strokeStyle = col;
          ctx.lineWidth = dr * 3.2;
          ctx.beginPath(); ctx.moveTo(lx2, ly2); ctx.lineTo(cx2, cy2); ctx.stroke();
          ctx.globalAlpha = Math.min(base * bright * 0.88, 1);
          ctx.strokeStyle = `rgb(${Math.min(rc+55,255)},${Math.min(gc+55,255)},${Math.min(bc+55,255)})`;
          ctx.lineWidth = dr * 0.9;
          ctx.beginPath(); ctx.moveTo(lx2, ly2); ctx.lineTo(cx2, cy2); ctx.stroke();
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

    // Init cinematic comet: smooth bezier arc, no jagged bolt
    function initComet() {
      cometEX = W / 2; cometEY = H / 2;
      const midX = (cometSX + cometEX) / 2, midY = (cometSY + cometEY) / 2;
      const ddx = cometEX - cometSX, ddy = cometEY - cometSY;
      const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      const nx = -ddy / len, ny = ddx / len; // perpendicular unit
      cometCPX = midX + nx * len * 0.22;    // gentle arc offset
      cometCPY = midY + ny * len * 0.22;
      cometTail = [];
    }

    function drawComet(now) {
      if (!cometActive) return;
      const t = Math.min((now - cometT0) / CFG.COMET_DUR, 1);
      const e = 1 - (1 - t) * (1 - t) * (1 - t); // easeOutCubic
      // Quadratic bezier head position
      const mt = 1 - e;
      const hx = mt*mt*cometSX + 2*mt*e*cometCPX + e*e*cometEX;
      const hy = mt*mt*cometSY + 2*mt*e*cometCPY + e*e*cometEY;

      // Maintain tail history (capped)
      const TAIL_LEN = 18;
      cometTail.push({ x: hx, y: hy });
      if (cometTail.length > TAIL_LEN) cometTail.shift();

      const eff = intensity || 1;
      const n = cometTail.length;
      ctx.save();
      ctx.lineCap = 'round';

      // Tail: tapered glow + core passes, older segments dimmer and thinner
      for (let i = 1; i < n; i++) {
        const p0 = cometTail[i - 1], p1 = cometTail[i];
        const frac = i / n; // 0 = tail tip, 1 = head

        // Outer glow (ion cyan, wide, soft)
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = frac * 0.48 * eff;
        ctx.strokeStyle = ISTR;
        ctx.lineWidth = (1.5 + frac * 9) * dpr;
        ctx.shadowColor = ISTR; ctx.shadowBlur = 14 * dpr;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();

        // Core (near-white, crisp)
        ctx.globalAlpha = frac * 0.92 * eff;
        ctx.strokeStyle = 'rgb(228,244,255)';
        ctx.lineWidth = (0.4 + frac * 2.2) * dpr;
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 4 * dpr;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }

      // Bright head
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.55 * eff;
      ctx.fillStyle = ISTR;
      ctx.shadowColor = ISTR; ctx.shadowBlur = CFG.COMET_GLOW * 2 * dpr;
      ctx.beginPath(); ctx.arc(hx, hy, CFG.COMET_R * 2.8 * dpr, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 0.95 * eff;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff'; ctx.shadowBlur = CFG.COMET_GLOW * 0.5 * dpr;
      ctx.beginPath(); ctx.arc(hx, hy, CFG.COMET_R * dpr, 0, 6.283); ctx.fill();
      ctx.restore();

      if (t >= 1) {
        cometActive = false; cometTail = [];
        fieldActive = true; fieldBloomT0 = performance.now();
        spawnShockwave(hx, hy, CFG.ION); spawnShockwave(hx, hy, CFG.COLORS[2]);
        const now2 = performance.now();
        for (let i = 0; i < CFG.COMET_FRAGS; i++) {
          const a = Math.PI * 2 * i / CFG.COMET_FRAGS + rnd(-0.3, 0.3);
          const sp = rnd(4, 9);
          fragments.push({ x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                           r: rnd(1.5, 4) * dpr, ci: (i * 3) % 4,
                           st: now2, life: rnd(CFG.FRAG_LIFE * 0.6, CFG.FRAG_LIFE) });
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
      // Ion lens — unmistakable cursor bloom while hovering
      if (ptrIntensity > 0.05) {
        ctx.globalAlpha = ptrIntensity * 0.75;
        ctx.strokeStyle = ISTR;
        ctx.lineWidth = 1.5 * dpr;
        ctx.shadowColor = ISTR; ctx.shadowBlur = 12 * dpr;
        ctx.beginPath(); ctx.arc(ptrX, ptrY, 14 * dpr, 0, 6.283); ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
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
          initComet();
          start();
          cometActive = true; cometT0 = performance.now();
          seedFired = true;
        }
        if (progress < 0.2 && seedFired) {
          seedFired = false; cometActive = false; fragments = []; cometTail = [];
          fieldActive = false; fieldBloomT0 = 0;
        }
      },

      updateRect: updateCanvasRect,
      onResize: doResize,

      // Mobile tap pulse: shockwave + burst particles at a touch point (coarse-safe).
      touchPulse(clientX, clientY) {
        if (reduced || !W || intensity <= 0) return;
        // One-time rect read to map touch → canvas coords
        updateCanvasRect();
        if (!canvasRect.width) return;
        const cx = ((clientX - canvasRect.left) / canvasRect.width) * W;
        const cy = ((clientY - canvasRect.top)  / canvasRect.height) * H;
        spawnShockwave(cx, cy, CFG.COLORS[0]);
        for (let i = 0; i < 12; i++) {
          const p = makeParticle(cx, cy);
          const a = (i / 12) * Math.PI * 2;
          p.bvx = Math.cos(a) * rnd(1.5, 4); p.bvy = Math.sin(a) * rnd(1.5, 4);
          particles.push(p);
        }
        start();
      }
    };
  })();

  drift.init();

  // Mobile touch pulse: tap the hero area to get a brief particle burst.
  // Only fires when the drift canvas is active (intensity > 0 = hero visible).
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    videoWrapper.addEventListener('touchend', (ev) => {
      const t = ev.changedTouches[0];
      drift.touchPulse(t.clientX, t.clientY);
    }, { passive: true });
  }

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
      const nW = Math.round(vp.vw * hoDpr);
      const nH = Math.round(vp.vh * hoDpr);
      // Skip if unchanged — avoids canvas clear on every iOS address-bar scroll event.
      if (nW === hoW && nH === hoH) return;
      hoW = nW; hoH = nH;
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
  let workIgniteFired = false;
  // Cache viewport height so iOS address-bar collapse mid-scroll doesn't jitter the scale.
  let cachedViewportH = window.innerHeight;

  // One-shot WORK ignition: particle peels off "work" → bezier travel → hero burst.
  function fireWorkIgnition() {
    if (!workAccent || !videoWrapper) return;
    workAccent.classList.add('is-igniting');
    // Remove the glow class after the animation completes so the element resets cleanly.
    setTimeout(() => { workAccent.classList.remove('is-igniting'); }, 700);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      drift.checkSeedBurst(0.36);
      window._conduitSpike?.();
      return;
    }

    // One-time rects for bezier endpoints (only getBoundingClientRect call in ignition)
    const srcRect = workAccent.getBoundingClientRect();
    const dstRect = videoWrapper.getBoundingClientRect();
    const sx = srcRect.left + srcRect.width  / 2;
    const sy = srcRect.top  + srcRect.height / 2;
    const dx = dstRect.left + dstRect.width  / 2;
    const dy = dstRect.top  + dstRect.height / 2;
    const arcX = (sx + dx) / 2 + (Math.random() - 0.5) * 160;
    const arcY = Math.min(sy, dy) - 80 - Math.random() * 60;

    const igCvs = document.createElement('canvas');
    igCvs.setAttribute('aria-hidden', 'true');
    igCvs.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60;';
    document.body.appendChild(igCvs);
    const igCtx  = igCvs.getContext('2d');
    const igDpr  = Math.min(window.devicePixelRatio || 1, 2);
    igCvs.width  = Math.round(window.innerWidth  * igDpr);
    igCvs.height = Math.round(window.innerHeight * igDpr);

    const TRAVEL_MS = 750;
    const igStart  = performance.now();
    // Trail: ring buffer of the last N canvas positions
    const TRAIL_LEN = 6;
    const trail = [];

    function igTick(now) {
      const raw = Math.min((now - igStart) / TRAVEL_MS, 1);
      const mt  = 1 - raw;
      // Quadratic bezier position in viewport px
      const vx  = mt * mt * sx + 2 * mt * raw * arcX + raw * raw * dx;
      const vy  = mt * mt * sy + 2 * mt * raw * arcY + raw * raw * dy;
      // Convert to canvas px
      const cpx = vx * igDpr;
      const cpy = vy * igDpr;

      igCtx.globalCompositeOperation = 'source-over';
      igCtx.clearRect(0, 0, igCvs.width, igCvs.height);

      if (raw < 1) {
        // Push to trail (oldest first)
        trail.push({ x: cpx, y: cpy });
        if (trail.length > TRAIL_LEN) trail.shift();

        const fadeOut = raw > 0.75 ? 1 - (raw - 0.75) / 0.25 : 1;

        // Draw fading trail dots (smallest and most transparent first)
        for (let i = 0; i < trail.length - 1; i++) {
          const tfrac = i / (TRAIL_LEN - 1);
          const tr    = (1.5 + tfrac * 2) * igDpr;
          igCtx.globalAlpha = fadeOut * tfrac * 0.45;
          igCtx.fillStyle   = 'rgb(168,85,247)';
          igCtx.beginPath(); igCtx.arc(trail[i].x, trail[i].y, tr, 0, 6.283); igCtx.fill();
        }

        // Core particle — larger and with a bloom halo
        const r = 5 * igDpr;
        igCtx.globalAlpha = fadeOut;
        igCtx.fillStyle   = 'rgb(210,160,255)'; // slightly lighter center
        igCtx.beginPath(); igCtx.arc(cpx, cpy, r, 0, 6.283); igCtx.fill();
        // Inner bright core
        igCtx.fillStyle = '#fff';
        igCtx.globalAlpha = fadeOut * 0.7;
        igCtx.beginPath(); igCtx.arc(cpx, cpy, r * 0.45, 0, 6.283); igCtx.fill();
        // Outer glow ring
        igCtx.fillStyle   = 'rgb(168,85,247)';
        igCtx.globalAlpha = fadeOut * 0.25;
        igCtx.beginPath(); igCtx.arc(cpx, cpy, r * 3.5, 0, 6.283); igCtx.fill();

        requestAnimationFrame(igTick);
      } else {
        igCtx.clearRect(0, 0, igCvs.width, igCvs.height);
        igCvs.remove();
        // Attempt hero video play (fails silently if no element or blocked)
        const heroVid = videoWrapper.querySelector('video');
        if (heroVid) heroVid.play().catch(() => {});
        // Trigger existing hero burst system
        drift.checkSeedBurst(0.36);
        window._conduitSpike?.();
      }
    }
    requestAnimationFrame(igTick);
  }

  function update() {
    const viewportHeight = cachedViewportH;
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
    if (progress >= 0.30 && !workIgniteFired) {
      workIgniteFired = true;
      fireWorkIgnition();
    }

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
    cachedViewportH = window.innerHeight;
    lastProgress = -1;
    drift.onResize();
    update();
  });
  window.addEventListener('orientationchange', () => {
    cachedViewportH = window.innerHeight;
    lastProgress = -1;
  }, { passive: true });
});


// ── Approach collage: particle conduit from headline + hero → hovered panel ────
// v3.0: directed particles along bezier beams, hero emitter, always purple
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('approach-page')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  const srcEl = document.querySelector('.approach-title')
              || document.querySelector('.approach-header h2');
  const panels = document.querySelectorAll('#collageStack .collage-panel');
  if (!srcEl || !panels.length) return;

  const FALLBACK_PURPLE_RGB2 = [168, 85, 247];
  const BEAM_COUNT = 4;
  const PARTICLE_BUDGET = 120;

  const vv = window.visualViewport;
  const getVP = () => vv ? { ox: vv.offsetLeft, oy: vv.offsetTop } : { ox: 0, oy: 0 };
  const dprCap = () => Math.min(window.devicePixelRatio || 1, 2);

  const cvs = document.createElement('canvas');
  cvs.setAttribute('aria-hidden', 'true');
  cvs.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
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

  let raf2 = 0, fadeAlpha2 = 0, fadeDir2 = 0;
  let startTime2 = 0, activePanel2 = null, spikeUntil2 = 0;
  let srcPts2 = [], srcSeeds2 = [], anchors2 = [], beams2 = [], particles2 = [];
  let beamFX2 = null;
  let heroRect2 = null, heroVisibleFactor2 = 0;
  // Read --accent from :root once; never sample headline text (which is white by default)
  const _accentRaw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const purpleRGB2 = parseColorToRGB2(_accentRaw) || FALLBACK_PURPLE_RGB2.slice();
  const tetherRGB2 = purpleRGB2; // constant reference — color never changes
  let panelRO2 = null;
  const rnd2 = (a, b) => Math.random() * (b - a) + a;
  window._conduitSpike = () => { spikeUntil2 = performance.now() + 900; };

  function parseColorToRGB2(color) {
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
      if (h.length === 3) return [parseInt(h[0]+h[0],16),parseInt(h[1]+h[1],16),parseInt(h[2]+h[2],16)];
      return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
    }
    return null;
  }

  function buildSourceSeeds2() {
    return [{ nx: 0.5, ny: 0.5 }];
  }

  function remapSourcePoints2() {
    if (!srcSeeds2.length) return;
    const r = srcEl.getBoundingClientRect();
    const vp = getVP();
    srcPts2 = srcSeeds2.map((s) => [
      (r.left + r.width  * s.nx - vp.ox) * dpr2,
      (r.top  + r.height * s.ny - vp.oy) * dpr2,
    ]);
  }

  function detachPanelObserver2() {
    if (!panelRO2) return; panelRO2.disconnect(); panelRO2 = null;
  }

  function attachPanelObserver2(panel) {
    detachPanelObserver2();
    if (typeof ResizeObserver === 'undefined') return;
    panelRO2 = new ResizeObserver(() => { if (activePanel2 === panel) scheduleRecompute2(); });
    panelRO2.observe(panel);
  }

  // Corner anchors on panel: TL, TR, BR, BL (small inset so lines land on card edge)
  function cornerAnchors2(rect) {
    const vp = getVP();
    const iw = Math.min(6, rect.width  * 0.03);
    const ih = Math.min(6, rect.height * 0.03);
    return [
      [(rect.left  + iw - vp.ox) * dpr2, (rect.top    + ih - vp.oy) * dpr2],
      [(rect.right - iw - vp.ox) * dpr2, (rect.top    + ih - vp.oy) * dpr2],
      [(rect.right - iw - vp.ox) * dpr2, (rect.bottom - ih - vp.oy) * dpr2],
      [(rect.left  + iw - vp.ox) * dpr2, (rect.bottom - ih - vp.oy) * dpr2],
    ];
  }

  // Generate stable per-beam style/motion params (called once per hover activation)
  function initBeamFX2() {
    beamFX2 = [];
    for (var i = 0; i < BEAM_COUNT; i++) {
      beamFX2.push({
        freq:  rnd2(0.5, 1.6),
        phase: rnd2(0, Math.PI * 2),
        amp:   rnd2(35, 80),
        ampY:  rnd2(20, 50),
        alpha: rnd2(0.65, 0.85),
        lw:    rnd2(1.2, 1.8),
        spark: { t: rnd2(0, 1), spd: rnd2(0.004, 0.010), dir: 1 },
      });
    }
  }

  // Build exactly 4 beams wiring src→anchor, reading stable params from beamFX2
  function buildBeams2() {
    beams2 = [];
    if (!srcPts2.length || !anchors2.length || !beamFX2) return;
    for (var i = 0; i < BEAM_COUNT; i++) {
      var fx = beamFX2[i];
      beams2.push({
        si: 0, ai: i % anchors2.length,
        freq:  fx.freq,
        phase: fx.phase,
        amp:   fx.amp * dpr2,
        ampY:  fx.ampY * dpr2,
        alpha: fx.alpha,
        lw:    fx.lw,
        spark: fx.spark,
      });
    }
  }

  function bezPt2(t, x0, y0, cx, cy, x1, y1) {
    const mt = 1 - t;
    return [mt*mt*x0 + 2*mt*t*cx + t*t*x1, mt*mt*y0 + 2*mt*t*cy + t*t*y1];
  }

  // Update cached hero rect and compute how visible it is (0-1)
  function updateHeroRect2() {
    const hw = document.querySelector('.approach-hero-video-wrapper');
    if (!hw) { heroRect2 = null; heroVisibleFactor2 = 0; return; }
    heroRect2 = hw.getBoundingClientRect();
    const viewH = vv ? vv.height : window.innerHeight;
    const visiblePx = Math.max(0, Math.min(heroRect2.bottom, viewH) - Math.max(heroRect2.top, 0));
    heroVisibleFactor2 = heroRect2.height > 0 ? Math.min(visiblePx / heroRect2.height, 1) : 0;
  }

  // Emit one particle: from hero emitter zone or from headline source points
  function spawnParticle2(fromHero) {
    if (!srcPts2.length || !anchors2.length) return;
    const ai = Math.floor(Math.random() * anchors2.length);
    const [ax, ay] = anchors2[ai];
    let sx, sy;
    if (fromHero && heroRect2) {
      const vp = getVP();
      sx = (heroRect2.left + Math.random() * heroRect2.width  - vp.ox) * dpr2;
      sy = (heroRect2.top  + Math.random() * heroRect2.height - vp.oy) * dpr2;
    } else {
      const si = Math.floor(Math.random() * srcPts2.length);
      [sx, sy] = srcPts2[si];
    }
    const midX = (sx + ax) * 0.5 + rnd2(-55, 55) * dpr2;
    const midY = (sy + ay) * 0.5 + rnd2(-35, 35) * dpr2;
    var isSpark = Math.random() < 0.15;
    particles2.push({
      x0: sx, y0: sy, cx: midX, cy: midY, x1: ax, y1: ay,
      t: 0, spd: rnd2(0.0025, 0.006),
      jx: rnd2(-1.5, 1.5) * dpr2, jy: rnd2(-1.5, 1.5) * dpr2,
      alpha: isSpark ? 0.90 : rnd2(0.50, 0.85),
      r: (isSpark ? 2.5 : rnd2(0.8, 2.0)) * dpr2,
      spark: isSpark,
    });
  }

  function renderApproachTether(now) {
    ctx2.globalCompositeOperation = 'source-over'; ctx2.globalAlpha = 1;
    ctx2.clearRect(0, 0, W2, H2);
    fadeAlpha2 = fadeDir2 > 0 ? Math.min(fadeAlpha2 + 0.07, 1)
               : fadeDir2 < 0 ? Math.max(fadeAlpha2 - 0.06, 0)
               : fadeAlpha2;

    if (fadeAlpha2 > 0 && anchors2.length && srcPts2.length) {
      const [cr, cg, cb] = tetherRGB2;
      const elapsed = (now - startTime2) * 0.001;

      // Draw filaments — index-matched two-pass with endpoint dots + spark travelers
      ctx2.save();
      ctx2.lineCap = 'round';
      var cStr = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
      for (let i = 0; i < beams2.length; i++) {
        const bm = beams2[i];
        const [sx, sy] = srcPts2[bm.si] || srcPts2[0];
        const [ax, ay] = anchors2[bm.ai] || anchors2[0];
        const mx = (sx + ax) * 0.5 + Math.sin(elapsed * bm.freq + bm.phase) * bm.amp;
        const my = (sy + ay) * 0.5 + Math.cos(elapsed * bm.freq * 0.7 + bm.phase) * bm.ampY;
        const a = bm.alpha * fadeAlpha2;
        ctx2.strokeStyle = cStr;
        // Glow pass
        ctx2.globalAlpha = a * 0.22;
        ctx2.lineWidth = bm.lw * dpr2 * 4;
        ctx2.beginPath(); ctx2.moveTo(sx, sy); ctx2.quadraticCurveTo(mx, my, ax, ay); ctx2.stroke();
        // Core pass
        ctx2.globalAlpha = a * 0.88;
        ctx2.lineWidth = bm.lw * dpr2;
        ctx2.beginPath(); ctx2.moveTo(sx, sy); ctx2.quadraticCurveTo(mx, my, ax, ay); ctx2.stroke();
        // Endpoint dots
        var pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.5 + bm.phase);
        var nr = (1.5 + pulse * 1.5) * dpr2;
        ctx2.globalAlpha = a * (0.65 + pulse * 0.35);
        ctx2.fillStyle = cStr;
        ctx2.beginPath(); ctx2.arc(sx, sy, nr, 0, 6.283); ctx2.fill();
        ctx2.beginPath(); ctx2.arc(ax, ay, nr * 0.85, 0, 6.283); ctx2.fill();
        // Spark traveler
        if (bm.spark) {
          bm.spark.t += bm.spark.spd * bm.spark.dir;
          if (bm.spark.t > 1.05 || bm.spark.t < -0.05) {
            bm.spark.dir *= -1; bm.spark.t = Math.max(0, Math.min(1, bm.spark.t));
          }
          var sp = bezPt2(bm.spark.t, sx, sy, mx, my, ax, ay);
          ctx2.globalAlpha = a * 0.95;
          ctx2.beginPath(); ctx2.arc(sp[0], sp[1], 1.5 * dpr2, 0, 6.283); ctx2.fill();
        }
      }
      ctx2.restore();

      // Spawn new particles while fading in / stable and under budget.
      // During spike: higher budget and spawn cap for a brief surge.
      const spiking2     = performance.now() < spikeUntil2;
      const effBudget2   = spiking2 ? 240 : PARTICLE_BUDGET;
      const effSpawnCap2 = spiking2 ? 7 : 3;
      if (particles2.length < effBudget2 && fadeDir2 >= 0) {
        const heroSpawnRatio = 0.25 + 0.7 * heroVisibleFactor2;
        const spawnCount = Math.min(effSpawnCap2, effBudget2 - particles2.length);
        for (let i = 0; i < spawnCount; i++) {
          spawnParticle2(Math.random() < heroSpawnRatio);
        }
      }

      // Update and draw particles
      ctx2.save();
      for (let i = particles2.length - 1; i >= 0; i--) {
        const p = particles2[i];
        p.t += p.spd;
        if (p.t >= 1) { particles2.splice(i, 1); continue; }
        const [bx, by] = bezPt2(p.t, p.x0, p.y0, p.cx, p.cy, p.x1, p.y1);
        // Jitter fades toward zero as particle approaches the anchor
        const ptx = bx + p.jx * (1 - p.t);
        const pty = by + p.jy * (1 - p.t);
        // Fade in quickly, fade out in the last 15% of travel
        const fadeIn  = Math.min(p.t * 8, 1);
        const fadeOut = p.t > 0.85 ? 1 - (p.t - 0.85) / 0.15 : 1;
        // Hero exclusion: soft-fade particles overlapping the hero rect
        let heroFade = 1;
        if (heroRect2) {
          const vp3     = getVP();
          const vx3     = ptx / dpr2 + vp3.ox;
          const vy3     = pty / dpr2 + vp3.oy;
          const excMgn  = 28;
          const minDist = Math.min(
            vx3 - heroRect2.left, heroRect2.right  - vx3,
            vy3 - heroRect2.top,  heroRect2.bottom - vy3
          );
          if (minDist < excMgn) heroFade = Math.max(0, minDist / excMgn);
        }
        var pAlpha = fadeAlpha2 * p.alpha * fadeIn * fadeOut * heroFade;
        ctx2.globalAlpha = pAlpha;
        ctx2.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx2.beginPath(); ctx2.arc(ptx, pty, p.r, 0, 6.283); ctx2.fill();
        if (p.spark && pAlpha > 0.15) {
          ctx2.globalAlpha = pAlpha * 0.25;
          ctx2.beginPath(); ctx2.arc(ptx, pty, p.r * 3, 0, 6.283); ctx2.fill();
        }
      }
      ctx2.restore();
    }

    // Clean up particles when fully faded out
    if (fadeAlpha2 <= 0 && fadeDir2 < 0) particles2 = [];

    if (fadeAlpha2 > 0 || particles2.length) {
      raf2 = requestAnimationFrame(renderApproachTether);
    } else {
      raf2 = 0; ctx2.globalAlpha = 1; ctx2.clearRect(0, 0, W2, H2);
    }
  }

  // Recompute positions on scroll/resize while a panel is active
  function recompute2() {
    if (!activePanel2) return;
    remapSourcePoints2();
    updateHeroRect2();
    const r = activePanel2.getBoundingClientRect();
    anchors2 = cornerAnchors2(r);
    // Update anchor refs in existing beams without re-randomizing params
    for (var i = 0; i < beams2.length; i++) {
      beams2[i].ai = i % anchors2.length;
    }
  }
  let scrollTick2 = 0;
  function scheduleRecompute2() {
    if (scrollTick2 || !activePanel2) return;
    scrollTick2 = requestAnimationFrame(() => { scrollTick2 = 0; recompute2(); });
  }

  window.addEventListener('scroll', scheduleRecompute2, { passive: true });
  window.addEventListener('resize', () => { resize2(); if (beamFX2) buildBeams2(); scheduleRecompute2(); }, { passive: true });
  // Horizontal rail scroll keeps conduit locked to the moving card
  const collageStack2 = document.getElementById('collageStack');
  if (collageStack2) collageStack2.addEventListener('scroll', scheduleRecompute2, { passive: true });
  // iOS visualViewport scroll/resize
  if (vv) {
    vv.addEventListener('scroll', scheduleRecompute2, { passive: true });
    vv.addEventListener('resize', () => { resize2(); if (beamFX2) buildBeams2(); scheduleRecompute2(); }, { passive: true });
  }

  panels.forEach((panel) => {
    panel.addEventListener('pointerenter', () => {
      activePanel2 = panel;
      srcEl.classList.add('tether-headline-active');
      srcSeeds2 = buildSourceSeeds2();
      remapSourcePoints2();
      updateHeroRect2();
      const r2 = panel.getBoundingClientRect();
      anchors2 = cornerAnchors2(r2);
      initBeamFX2();
      buildBeams2();
      particles2 = [];
      // Burst: spawn 12 particles immediately for impact
      for (var bi = 0; bi < 12; bi++) spawnParticle2(Math.random() < 0.3);
      attachPanelObserver2(panel);
      fadeDir2 = 1; startTime2 = performance.now();
      if (!raf2) raf2 = requestAnimationFrame(renderApproachTether);
    }, { passive: true });

    panel.addEventListener('pointerleave', () => {
      if (activePanel2 === panel) {
        activePanel2 = null;
        detachPanelObserver2();
        fadeDir2 = -1;
        srcEl.classList.remove('tether-headline-active');
      }
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
    'tile-3d': ['https://res.cloudinary.com/ddpcw88mj/video/upload/style2.mp4'],
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

// ── Journey page: 3D Tunnel Fly-Through + Resume Mode ────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('journey-page')) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MILESTONES = [
    { year: 'Los Angeles', title: 'West Coast Origins',
      oneLine: 'Grew up surrounded by visual culture, music, and street art in LA.',
      tags: ['roots', 'visual culture', 'LA'], triggerZ: 80 },
    { year: 'Paris', title: 'Art Studies in Paris',
      oneLine: 'Semester abroad studying fine art and conceptual design at studios in Paris.',
      tags: ['fine art', 'study abroad', 'concept'], triggerZ: 260 },
    { year: 'Oregon', title: 'BS Art & Technology',
      oneLine: 'University of Oregon — combining fine art, design, and creative computing.',
      tags: ['degree', 'design', 'tech'], triggerZ: 440 },
    { year: '2022', title: 'Amerikid Collective',
      oneLine: 'Co-founded Amerikid, building brand presence, motion content, and social visuals.',
      tags: ['brand', 'motion', 'web'], triggerZ: 620 },
    { year: '2023', title: 'Multimedia Consultant, Nile',
      oneLine: 'Editorial comics that turned security topics into fast, on-brand stories.',
      tags: ['consulting', 'editorial', 'comics'], triggerZ: 800 },
    { year: '2024', title: 'West Coast Illustrations LLC',
      oneLine: 'Short-form video edits for BrandCo, Shopify site for a west Hollywood boutique, and a dance company website.',
      tags: ['freelance', 'shopify', 'video'], triggerZ: 960 },
    { year: 'Now', title: 'Design Technologist',
      oneLine: 'Building interactive, motion-led web experiences at the intersection of design and code.',
      tags: ['interactive', 'motion', 'design tech'], triggerZ: 1120 },
  ];

  const cvs       = document.getElementById('journeyCanvas');
  const cardEl    = document.getElementById('journeyCard');
  const cardYear  = document.getElementById('jCardYear');
  const cardTitle = document.getElementById('jCardTitle');
  const cardLine  = document.getElementById('jCardLine');
  const cardTags  = document.getElementById('jCardTags');
  const resumeEl  = document.getElementById('journeyResume');
  const highlightsEl = document.getElementById('journeyHighlights');
  const skipBtn   = document.getElementById('jSkip');
  const ctrlLabel = document.getElementById('jCtrlLabel');
  const replayCtaBtn   = document.getElementById('jReplayCta');
  const navWorkBtn     = document.getElementById('jNavWork');
  const navApproachBtn = document.getElementById('jNavApproach');
  const scrubWrap = document.getElementById('journeyScrubWrap');
  const scrubEl   = document.getElementById('journeyScrub');
  if (!cvs) return;

  const ctx = cvs.getContext('2d');
  let W = 0, H = 0, cx = 0, cy = 0, dpr = 1;
  let raf = 0, lastT = 0, elapsed = 0;
  let isTunnelMode = !reduced, done = false;
  let isScrubbing = false, scrubMin = 0;

  const FOV = 500, NEAR = 14, FAR = 1800, SPEED = 65, END_Z = 1300;
  // Milestone phase durations (ms)
  const FLY_FIRST = 2200, FLY_REST = 1900;
  const HOLD_FIRST = 1400, HOLD_REST = 1100;
  const FADE_MS = 500;
  const META_REVEAL = 350, LINE_REVEAL = 550, TAGS_REVEAL = 750;
  const REVEAL_RAMP = 180; // fade-in ramp for each staged element
  let R_TUNNEL = 300, NUM_DUST = 180;

  // Reward transition constants
  const REWARD_RUSH_MS = 600;
  const REWARD_BURST_MS = 450;
  const REWARD_IRIS_MS = 900;
  const RESUME_PRINT_STAGGER = 90;
  const RESUME_PRINT_TOTAL = 650;

  let cameraZ = 0, rings = [], streaks = [], dust = [], pulseRings = [], msDone = [];
  let boostEnd = 0, boostMul = 1, bloomStart = 0;
  let noiseCvs = null, noisePat = null;
  let milestoneFX = null;
  let isRewardTransition = false, rewardStart = 0;
  let freezeBmp = null, rewardSparks = [], rewardShockwaves = [];

  const NUM_RINGS = 28, NUM_STREAKS = 55;

  function makeRing(z) {
    return { z, rFrac: 0.88 + Math.random()*0.24, alpha: 0.08 + Math.random()*0.10,
             seg: Math.random() < 0.28, phase: Math.random()*Math.PI*2,
             wobble: Math.random()*0.055, wfreq: 0.7 + Math.random()*1.3 };
  }
  function makeStreak() {
    return { angle: Math.random()*Math.PI*2, frac: Math.random()*1.15,
             z: cameraZ + NEAR + Math.random()*(FAR-NEAR) };
  }
  function makeDust() {
    var layer = Math.random() < 0.35 ? 0 : Math.random() < 0.55 ? 1 : 2;
    var frac  = Math.random() < 0.22 ? Math.random()*0.32 : 0.5 + Math.random()*0.65;
    var zRange = layer === 0 ? FAR*0.45 : layer === 1 ? FAR*0.75 : FAR;
    return { angle: Math.random()*Math.PI*2, frac, layer, purple: Math.random()<0.52,
             size: 0.4 + Math.random()*0.9, z: cameraZ + NEAR + Math.random()*zRange };
  }
  function makePulseRing(now) {
    return { startT: now, dur: 460 + Math.random()*280, rFrac: 0.5 + Math.random()*0.7 };
  }

  function buildNoiseTex() {
    noiseCvs = document.createElement('canvas');
    noiseCvs.width = noiseCvs.height = 256;
    var nc = noiseCvs.getContext('2d');
    var imgd = nc.createImageData(256, 256);
    var d = imgd.data, i;
    for (i = 0; i < d.length; i += 4) {
      if (Math.random() < 0.055) {
        var p = Math.random() < 0.6;
        d[i]   = p ? 148 + Math.floor(Math.random()*70) : 215 + Math.floor(Math.random()*40);
        d[i+1] = p ? 45  + Math.floor(Math.random()*70) : 180 + Math.floor(Math.random()*45);
        d[i+2] = p ? 220 + Math.floor(Math.random()*35) : 255;
        d[i+3] = 15 + Math.floor(Math.random()*65);
      }
    }
    nc.putImageData(imgd, 0, 0);
    noisePat = ctx.createPattern(noiseCvs, 'repeat');
  }

  function initTunnel() {
    cameraZ = 0; elapsed = 0; lastT = 0;
    msDone = MILESTONES.map(function() { return false; });
    boostEnd = 0; boostMul = 1; bloomStart = 0; milestoneFX = null;
    rings = []; streaks = []; dust = []; pulseRings = [];
    var i;
    for (i = 0; i < NUM_RINGS;   i++) rings.push(makeRing(NEAR + (i/NUM_RINGS)*(FAR-NEAR)));
    for (i = 0; i < NUM_STREAKS; i++) streaks.push(makeStreak());
    for (i = 0; i < NUM_DUST;    i++) dust.push(makeDust());
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio||1, 2);
    W = Math.round(window.innerWidth*dpr);
    H = Math.round(window.innerHeight*dpr);
    cx = W*0.5; cy = H*0.5;
    R_TUNNEL = H*0.16;
    NUM_DUST = dpr <= 1 ? 160 : 220;
    cvs.width = W; cvs.height = H;
  }

  // ── Milestone FX: offscreen pre-render + cheap per-frame drawImage ──

  // ── Word-wrap helper: returns array of lines that fit within maxW ──
  function wrapTextLines(ctxRef, text, maxW, maxLines) {
    var words = text.split(' ');
    var lines = [], cur = words[0] || '';
    for (var i = 1; i < words.length; i++) {
      var test = cur + ' ' + words[i];
      if (ctxRef.measureText(test).width > maxW) {
        lines.push(cur);
        cur = words[i];
        if (maxLines && lines.length >= maxLines) { cur = ''; break; }
      } else { cur = test; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function startMilestoneFX(m, now, idx) {
    var isFirst = (idx === 0);
    var flyMs  = isFirst ? FLY_FIRST : FLY_REST;
    var holdMs = isFirst ? HOLD_FIRST : HOLD_REST;
    milestoneFX = {
      active: true, start: now,
      flyMs: flyMs, holdMs: holdMs, fadeMs: FADE_MS,
      dur: flyMs + holdMs + FADE_MS,
      titleBmp: null, metaBmp: null, lineBmp: null, tagsBmp: null,
      bmpW: 0, totalH: 0,
      titleH: 0, metaH: 0, lineH: 0, tagsH: 0,
      sp1: 0, sp2: 0, sp3: 0
    };
    prerenderMilestoneLayers(m, milestoneFX);
  }

  function prerenderMilestoneLayers(m, fx) {
    var vw = W / dpr;
    var titlePx = Math.max(36, Math.min(vw * 0.075, 88));
    var metaPx  = Math.round(titlePx * 0.40);
    var linePx  = Math.round(titlePx * 0.36);
    var tagPx   = Math.round(titlePx * 0.26);
    var pillH   = Math.round(tagPx * 1.8);
    var fontStack = 'system-ui, -apple-system, sans-serif';
    var maxTextW = Math.min(vw * 0.85, 700) * dpr;

    fx.sp1 = Math.round(titlePx * 0.70 * dpr);
    fx.sp2 = Math.round(titlePx * 0.50 * dpr);
    fx.sp3 = Math.round(titlePx * 0.55 * dpr);

    var si, st, sox, soy, sa;

    // ── 1) Title layer (3D extruded, word-wrapped up to 2 lines) ──
    var tSz = Math.round(titlePx * dpr);
    var measure = document.createElement('canvas').getContext('2d');
    measure.font = 'bold ' + tSz + 'px ' + fontStack;
    var titleLines = wrapTextLines(measure, m.title, maxTextW, 2);
    // Auto-shrink if still too wide on a single line
    var tSzActual = tSz;
    if (titleLines.length === 1 && measure.measureText(titleLines[0]).width > maxTextW) {
      tSzActual = Math.round(tSz * maxTextW / measure.measureText(titleLines[0]).width);
      measure.font = 'bold ' + tSzActual + 'px ' + fontStack;
    }
    var tLineH = Math.round(tSzActual * 1.20);
    var tBlockH = tLineH * titleLines.length;
    var extDepth = tSzActual * 0.09;
    // Width: measure widest line + extrusion offset + margin
    var tMaxLW = 0;
    for (si = 0; si < titleLines.length; si++) {
      var lw = measure.measureText(titleLines[si]).width;
      if (lw > tMaxLW) tMaxLW = lw;
    }
    var tBmpW = Math.round(tMaxLW + extDepth * 2 + tSzActual * 0.3);
    var tBmpH = Math.round(tBlockH + extDepth + tSzActual * 0.15);
    var tOc = document.createElement('canvas');
    tOc.width = tBmpW; tOc.height = tBmpH;
    var tc = tOc.getContext('2d');
    tc.textAlign = 'center'; tc.textBaseline = 'middle';
    tc.font = 'bold ' + tSzActual + 'px ' + fontStack;
    var tCx = tBmpW * 0.5;
    var extSteps = 16;
    for (var li = 0; li < titleLines.length; li++) {
      var lineY = tLineH * 0.5 + li * tLineH;
      // Extrusion slices
      for (si = extSteps; si >= 1; si--) {
        st = si / extSteps;
        sox = st * extDepth * 0.65;
        soy = st * extDepth;
        var sR = Math.round(75 + 45 * (1 - st));
        var sG = Math.round(25 + 30 * (1 - st));
        var sB = Math.round(140 + 55 * (1 - st));
        sa = 0.14 + 0.12 * (1 - st);
        tc.globalAlpha = sa;
        tc.fillStyle = 'rgb(' + sR + ',' + sG + ',' + sB + ')';
        tc.fillText(titleLines[li], tCx + sox, lineY + soy);
      }
      // Face
      tc.globalAlpha = 1;
      tc.fillStyle = '#fff';
      tc.fillText(titleLines[li], tCx, lineY);
      // Rim stroke
      tc.globalAlpha = 0.50;
      tc.strokeStyle = 'rgba(168,85,247,1)';
      tc.lineWidth = Math.max(0.6, tSzActual * 0.014);
      tc.strokeText(titleLines[li], tCx, lineY);
      // Specular
      tc.globalAlpha = 0.10;
      tc.fillStyle = 'rgba(230,215,255,1)';
      tc.fillText(titleLines[li], tCx, lineY - tSzActual * 0.018);
    }
    tc.globalAlpha = 1;
    fx.titleBmp = tOc; fx.titleH = tBmpH;

    // ── 2) Meta layer (year/location) ──
    var mSz = Math.round(metaPx * dpr);
    var mOc = document.createElement('canvas');
    var mMeasure = document.createElement('canvas').getContext('2d');
    mMeasure.font = '600 ' + mSz + 'px ' + fontStack;
    var mTW = Math.round(mMeasure.measureText(m.year).width + mSz * 0.6);
    var mBmpH = Math.round(mSz * 1.5);
    mOc.width = mTW; mOc.height = mBmpH;
    var mc = mOc.getContext('2d');
    mc.textAlign = 'center'; mc.textBaseline = 'middle';
    mc.font = '600 ' + mSz + 'px ' + fontStack;
    mc.globalAlpha = 0.92;
    mc.fillStyle = 'rgba(185,120,255,1)';
    mc.fillText(m.year, mTW * 0.5, mBmpH * 0.5);
    fx.metaBmp = mOc; fx.metaH = mBmpH;

    // ── 3) OneLine layer (word-wrapped, up to 4 lines, no truncation) ──
    var lSz = Math.round(linePx * dpr);
    var lMeasure = document.createElement('canvas').getContext('2d');
    lMeasure.font = '400 ' + lSz + 'px ' + fontStack;
    var oneLines = wrapTextLines(lMeasure, m.oneLine, maxTextW, 4);
    var lLineH = Math.round(lSz * 1.55);
    var lBlockH = lLineH * oneLines.length;
    var lMaxLW = 0;
    for (si = 0; si < oneLines.length; si++) {
      var olw = lMeasure.measureText(oneLines[si]).width;
      if (olw > lMaxLW) lMaxLW = olw;
    }
    var lBmpW = Math.round(lMaxLW + lSz * 0.6);
    var lBmpH = Math.round(lBlockH + lSz * 0.2);
    var lOc = document.createElement('canvas');
    lOc.width = lBmpW; lOc.height = lBmpH;
    var lc = lOc.getContext('2d');
    lc.textAlign = 'center'; lc.textBaseline = 'middle';
    lc.font = '400 ' + lSz + 'px ' + fontStack;
    lc.globalAlpha = 0.78;
    lc.fillStyle = 'rgba(225,215,240,1)';
    for (si = 0; si < oneLines.length; si++) {
      lc.fillText(oneLines[si], lBmpW * 0.5, lLineH * 0.5 + si * lLineH);
    }
    fx.lineBmp = lOc; fx.lineH = lBmpH;

    // ── 4) Tags layer (pills) ──
    var tags = m.tags || [];
    if (tags.length) {
      var tgSz = Math.round(tagPx * dpr);
      var pH   = Math.round(pillH * dpr);
      var tgMeasure = document.createElement('canvas').getContext('2d');
      tgMeasure.font = '500 ' + tgSz + 'px ' + fontStack;
      var show = tags.length > 3 ? tags.slice(0, 3) : tags;
      var extra = tags.length > 3 ? '+' + (tags.length - 3) : '';
      if (extra) show = show.concat([extra]);
      var tPadX = tgSz * 0.7, tGap = tgSz * 0.45;
      var tWidths = [], tTotalW = 0;
      for (si = 0; si < show.length; si++) {
        var tw = tgMeasure.measureText(show[si]).width + tPadX * 2;
        tWidths.push(tw); tTotalW += tw;
      }
      tTotalW += (show.length - 1) * tGap;
      var tgBmpW = Math.round(tTotalW + tgSz);
      var tgBmpH = Math.round(pH + tgSz * 0.4);
      var tgOc = document.createElement('canvas');
      tgOc.width = tgBmpW; tgOc.height = tgBmpH;
      var tgc = tgOc.getContext('2d');
      tgc.textAlign = 'center'; tgc.textBaseline = 'middle';
      tgc.font = '500 ' + tgSz + 'px ' + fontStack;
      var tStartX = (tgBmpW - tTotalW) * 0.5;
      var tR = pH * 0.5;
      var tgCy = tgBmpH * 0.5;
      for (si = 0; si < show.length; si++) {
        var tpx = tStartX + tWidths[si] * 0.5;
        tgc.globalAlpha = 0.18;
        tgc.fillStyle = 'rgba(168,85,247,1)';
        tgc.beginPath();
        tgc.roundRect(tpx - tWidths[si] * 0.5, tgCy - pH * 0.5, tWidths[si], pH, tR);
        tgc.fill();
        tgc.globalAlpha = 0.42;
        tgc.strokeStyle = 'rgba(168,85,247,1)';
        tgc.lineWidth = 1;
        tgc.beginPath();
        tgc.roundRect(tpx - tWidths[si] * 0.5, tgCy - pH * 0.5, tWidths[si], pH, tR);
        tgc.stroke();
        tgc.globalAlpha = 0.82;
        tgc.fillStyle = 'rgba(200,160,255,1)';
        tgc.fillText(show[si], tpx, tgCy);
        tStartX += tWidths[si] + tGap;
      }
      fx.tagsBmp = tgOc; fx.tagsH = tgBmpH;
    }

    // Composite width = widest layer
    fx.bmpW = Math.max(tBmpW, mTW, lBmpW, fx.tagsBmp ? fx.tagsBmp.width : 0);
    fx.totalH = fx.titleH + fx.sp1 + fx.metaH + fx.sp2 + fx.lineH + fx.sp3 + (fx.tagsH || 0);
  }

  function drawMilestoneFX(now) {
    if (!milestoneFX || !milestoneFX.active) return;
    var fx = milestoneFX;
    if (!fx.titleBmp) return;
    var t = now - fx.start; // elapsed ms
    if (t >= fx.dur) { milestoneFX = null; return; }

    // ── Scale: fly-in over flyMs, then hold at 1.0 ──
    var flyP = Math.min(t / fx.flyMs, 1);
    flyP = 1 - Math.pow(2, -10 * flyP); // easeOutExpo
    var depth = 1.0 - flyP;
    var s = 0.28 + 0.72 * flyP;

    // Fit scale cap: never wider than 92% of viewport
    var fitScale = (W * 0.92) / fx.bmpW;
    if (s > fitScale) s = fitScale;

    // ── Alpha envelope ──
    var alphaIn = Math.min(t / 300, 1); // quick 300ms fade-in
    var fadeStart = fx.flyMs + fx.holdMs;
    var alphaOut = t > fadeStart ? 1 - (t - fadeStart) / fx.fadeMs : 1;
    if (alphaOut < 0) alphaOut = 0;
    var fog = 0.25 + 0.75 * flyP;
    var baseAlpha = alphaIn * alphaOut * fog;

    // ── Staged alpha per layer (keyed off ms, not %) ──
    var titleA = baseAlpha;
    var metaA  = baseAlpha * Math.min(Math.max((t - META_REVEAL) / REVEAL_RAMP, 0), 1);
    var lineA  = baseAlpha * Math.min(Math.max((t - LINE_REVEAL) / REVEAL_RAMP, 0), 1);
    var tagsA  = baseAlpha * Math.min(Math.max((t - TAGS_REVEAL) / REVEAL_RAMP, 0), 1);

    // Vertical drift (only during fly-in)
    var yDrift = depth * 40 * dpr;

    // Composite block: center on screen, stack layers with spacing
    var totalH = fx.totalH * s;
    var blockTop = cy - totalH * 0.42 + yDrift;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Perspective skew during fly-in
    var skewX = 0.03 * depth;
    ctx.translate(cx, cy);
    ctx.transform(1, 0, skewX, 1, 0, 0);
    ctx.translate(-cx, -cy);

    var curY = blockTop;

    // Title
    var tw = fx.titleBmp.width * s, th = fx.titleH * s;
    ctx.globalAlpha = titleA;
    ctx.drawImage(fx.titleBmp, cx - tw * 0.5, curY, tw, th);
    curY += th + fx.sp1 * s;

    // Meta
    if (metaA > 0.005) {
      var mw = fx.metaBmp.width * s, mh = fx.metaH * s;
      ctx.globalAlpha = metaA;
      ctx.drawImage(fx.metaBmp, cx - mw * 0.5, curY, mw, mh);
    }
    curY += fx.metaH * s + fx.sp2 * s;

    // OneLine
    if (lineA > 0.005) {
      var lw = fx.lineBmp.width * s, lh = fx.lineH * s;
      ctx.globalAlpha = lineA;
      ctx.drawImage(fx.lineBmp, cx - lw * 0.5, curY, lw, lh);
    }
    curY += fx.lineH * s + fx.sp3 * s;

    // Tags
    if (tagsA > 0.005 && fx.tagsBmp) {
      var tgw = fx.tagsBmp.width * s, tgh = fx.tagsH * s;
      ctx.globalAlpha = tagsA;
      ctx.drawImage(fx.tagsBmp, cx - tgw * 0.5, curY, tgw, tgh);
    }

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ── Show resume (shared final step for both skip and reward) ──
  function showResumeMode(printOn) {
    isTunnelMode = false;
    isRewardTransition = false;
    milestoneFX = null;
    cvs.hidden = true;
    cvs.style.transition = ''; cvs.style.opacity = '1';
    resumeEl.hidden = false; highlightsEl.hidden = false;
    var scrollTarget = (resumeEl.offsetTop||0) - 80;
    window.scrollTo(0, Math.max(0, scrollTarget));
    if (ctrlLabel)      ctrlLabel.hidden = true;
    if (skipBtn)        skipBtn.hidden = true;
    if (scrubWrap)      scrubWrap.hidden = true;
    if (navWorkBtn)     navWorkBtn.hidden = false;
    if (navApproachBtn) navApproachBtn.hidden = false;
    isScrubbing = false;
    // Print-on cascade (reward only)
    if (printOn && !reduced) {
      resumeEl.classList.add('resume-print-on');
      var header = resumeEl.querySelector('.resume-header');
      if (header) header.style.setProperty('--d', '0ms');
      var panels = resumeEl.querySelectorAll('.resume-panel');
      for (var i = 0; i < panels.length; i++) {
        panels[i].style.setProperty('--d', (120 + i * RESUME_PRINT_STAGGER) + 'ms');
      }
      var bottom = resumeEl.querySelector('.resume-bottom');
      if (bottom) bottom.style.setProperty('--d', (120 + panels.length * RESUME_PRINT_STAGGER) + 'ms');
      var totalMs = 120 + panels.length * RESUME_PRINT_STAGGER + 480 + 100;
      setTimeout(function() { resumeEl.classList.remove('resume-print-on'); }, totalMs);
    }
  }
  function showTunnelMode() {
    isTunnelMode = true;
    isRewardTransition = false;
    resumeEl.hidden = true; highlightsEl.hidden = true;
    resumeEl.classList.remove('resume-print-on');
    cvs.hidden = false; cvs.style.transition = ''; cvs.style.opacity = '1';
    milestoneFX = null; done = false; rushLastT = 0;
    freezeBmp = null; rewardSparks = []; rewardShockwaves = [];
    if (ctrlLabel)      ctrlLabel.hidden = false;
    if (skipBtn)        skipBtn.hidden = false;
    if (scrubWrap)      scrubWrap.hidden = false;
    if (scrubEl)        { scrubEl.value = 0; scrubEl.min = 0; }
    isScrubbing = false; scrubMin = 0;
    if (navWorkBtn)     navWorkBtn.hidden = true;
    if (navApproachBtn) navApproachBtn.hidden = true;
    initTunnel(); startAnim();
  }
  // Skip: fast fade, no reward
  function endAnimationFast() {
    done = true;
    isRewardTransition = false;
    isScrubbing = false;
    cancelAnim();
    if (scrubWrap) scrubWrap.hidden = true;
    cvs.style.transition = 'opacity 0.25s ease'; cvs.style.opacity = '0';
    setTimeout(function() { showResumeMode(false); }, 300);
  }
  // Natural completion: rush → burst → iris → resume
  function startRewardTransition() {
    done = true;
    isRewardTransition = true;
    isScrubbing = false;
    if (scrubWrap) scrubWrap.hidden = true;
    cancelAnim();
    rewardStart = performance.now();
    freezeBmp = null;
    rewardSparks = [];
    rewardShockwaves = [];
    rushLastT = 0;
    raf = requestAnimationFrame(rewardLoop);
  }

  function captureFreeze() {
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    oc.getContext('2d').drawImage(cvs, 0, 0);
    return oc;
  }

  function initBurstFX() {
    var i, a, spd;
    // 3 shockwave rings
    rewardShockwaves = [];
    for (i = 0; i < 3; i++) {
      rewardShockwaves.push({
        delay: i * 80,
        maxR: Math.hypot(W, H) * (0.35 + i * 0.12),
        width: (3.5 - i * 0.8) * dpr,
        purple: i > 0
      });
    }
    // 40 spark streaklets
    rewardSparks = [];
    for (i = 0; i < 40; i++) {
      a = Math.random() * Math.PI * 2;
      spd = (120 + Math.random() * 280) * dpr;
      rewardSparks.push({
        angle: a, speed: spd,
        len: (8 + Math.random() * 18) * dpr,
        life: 0.5 + Math.random() * 0.5,
        purple: Math.random() < 0.55,
        width: (0.6 + Math.random() * 1.4) * dpr
      });
    }
  }

  // ── Reward render loop: rush → burst → iris → resume ──
  var rushLastT = 0;
  function rewardLoop(now) {
    if (!isRewardTransition) { raf = 0; return; }
    var el = now - rewardStart;

    // ── Phase 1: Rush ──
    if (el < REWARD_RUSH_MS) {
      if (!rushLastT) rushLastT = now;
      var rdt = Math.min((now - rushLastT) / 1000, 0.05);
      rushLastT = now;
      var rushT = el / REWARD_RUSH_MS;
      var rushSpd = SPEED * (2.5 + rushT * 5.5);

      cameraZ += rushSpd * rdt;

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      drawBloom(now);
      drawHaze();
      ctx.lineCap = 'round';
      var i, ring, streak, dp;
      for (i = 0; i < rings.length; i++) {
        ring = rings[i];
        if (ring.z - cameraZ < NEAR) {
          ring.z = cameraZ + FAR * (0.65 + Math.random() * 0.35);
          ring.rFrac = 0.88 + Math.random() * 0.24;
          ring.alpha = 0.08 + Math.random() * 0.10;
        }
        drawRing(ring);
      }
      ctx.lineCap = 'butt';
      for (i = 0; i < streaks.length; i++) {
        streak = streaks[i];
        if (streak.z - cameraZ < NEAR) {
          streak.angle = Math.random() * Math.PI * 2;
          streak.frac = Math.random() * 1.15;
          streak.z = cameraZ + FAR * (0.5 + Math.random() * 0.5);
        }
        drawStreak(streak, rushSpd, rdt);
      }
      for (i = 0; i < dust.length; i++) {
        dp = dust[i];
        if (dp.z - cameraZ < NEAR) {
          dp.angle = Math.random() * Math.PI * 2;
          dp.frac = Math.random() < 0.22 ? Math.random() * 0.32 : 0.5 + Math.random() * 0.65;
          dp.z = cameraZ + NEAR + Math.random() * (FAR * (dp.layer === 2 ? 1.0 : dp.layer === 1 ? 0.75 : 0.45));
          dp.purple = Math.random() < 0.52;
        }
        drawDust(dp, rushSpd, rdt);
      }
      ctx.lineCap = 'round';
      drawPulseRings(now);
      ctx.globalAlpha = 1;

      // At end of rush, capture freeze + init burst
      if (el + 16 >= REWARD_RUSH_MS && !freezeBmp) {
        freezeBmp = captureFreeze();
        initBurstFX();
      }

      raf = requestAnimationFrame(rewardLoop);
      return;
    }

    // Ensure freeze captured (safety)
    if (!freezeBmp) { freezeBmp = captureFreeze(); initBurstFX(); }
    rushLastT = 0;

    // ── Phase 2: Burst (explosion overlays on freeze frame) ──
    var burstEl = el - REWARD_RUSH_MS;
    if (burstEl < REWARD_BURST_MS) {
      var bt = burstEl / REWARD_BURST_MS; // 0→1

      // Jitter offset (subtle camera shake)
      var jx = (Math.random() - 0.5) * 3.0 * dpr * (1 - bt);
      var jy = (Math.random() - 0.5) * 3.0 * dpr * (1 - bt);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(jx, jy);
      ctx.drawImage(freezeBmp, 0, 0);
      ctx.restore();

      // Purple bloom — peaks at ~30%, fades out
      var bloomA = Math.sin(bt * Math.PI) * 0.38;
      if (bloomA > 0.005) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = bloomA;
        var bR = Math.hypot(W, H) * (0.25 + bt * 0.35);
        var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bR);
        grad.addColorStop(0, 'rgba(200,140,255,0.8)');
        grad.addColorStop(0.4, 'rgba(168,85,247,0.35)');
        grad.addColorStop(1, 'rgba(100,30,200,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // White core flash (brief)
      if (bt < 0.25) {
        var flashA = (1 - bt / 0.25) * 0.22;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = flashA;
        var fR = Math.hypot(W, H) * 0.18;
        var fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, fR);
        fg.addColorStop(0, 'rgba(255,255,255,0.9)');
        fg.addColorStop(0.5, 'rgba(220,200,255,0.3)');
        fg.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // Shockwave rings
      var si, sw, swT, swR, swA;
      for (si = 0; si < rewardShockwaves.length; si++) {
        sw = rewardShockwaves[si];
        swT = (burstEl - sw.delay) / (REWARD_BURST_MS - sw.delay);
        if (swT < 0 || swT > 1) continue;
        var swEase = 1 - Math.pow(1 - swT, 2);
        swR = sw.maxR * swEase;
        swA = (1 - swT) * 0.55;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = swA;
        ctx.lineWidth = sw.width * (1 - swT * 0.6);
        ctx.strokeStyle = sw.purple ? 'rgba(168,85,247,1)' : 'rgba(230,210,255,1)';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(swR, 1), 0, Math.PI * 2);
        ctx.stroke();
        // Soft outer glow
        if (sw.width > 2) {
          ctx.globalAlpha = swA * 0.3;
          ctx.lineWidth = sw.width * 3 * (1 - swT * 0.5);
          ctx.strokeStyle = 'rgba(168,85,247,0.4)';
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(swR, 1), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Spark streaklets
      var sp, spT, spDist, spA, spX, spY, spTailX, spTailY;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (si = 0; si < rewardSparks.length; si++) {
        sp = rewardSparks[si];
        spT = bt / sp.life;
        if (spT > 1) continue;
        spA = (1 - spT) * 0.7;
        spDist = sp.speed * bt;
        spX = cx + Math.cos(sp.angle) * spDist;
        spY = cy + Math.sin(sp.angle) * spDist;
        spTailX = spX - Math.cos(sp.angle) * sp.len * (1 - spT * 0.5);
        spTailY = spY - Math.sin(sp.angle) * sp.len * (1 - spT * 0.5);
        ctx.globalAlpha = spA;
        ctx.strokeStyle = sp.purple ? 'rgba(190,120,255,1)' : 'rgba(255,240,255,1)';
        ctx.lineWidth = sp.width * (1 - spT * 0.6);
        ctx.beginPath();
        ctx.moveTo(spTailX, spTailY);
        ctx.lineTo(spX, spY);
        ctx.stroke();
      }
      ctx.restore();

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(rewardLoop);
      return;
    }

    // ── Phase 3: Iris close ──
    var irisEl = el - REWARD_RUSH_MS - REWARD_BURST_MS;
    var t = Math.min(irisEl / REWARD_IRIS_MS, 1);
    var ease = 1 - Math.pow(1 - t, 3);
    var maxR = Math.hypot(W, H) * 0.6;
    var radius = maxR * (1 - ease);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(freezeBmp, 0, 0);

    // Iris: black overlay with circular cutout
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(radius, 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Soft purple glow inside iris
    if (radius > 5) {
      var iBloom = Math.sin(t * Math.PI) * 0.18;
      if (iBloom > 0.005) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = iBloom;
        var ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        ig.addColorStop(0, 'rgba(168,85,247,0.6)');
        ig.addColorStop(0.6, 'rgba(168,85,247,0.15)');
        ig.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.fillStyle = ig;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    if (t >= 1) {
      isRewardTransition = false;
      freezeBmp = null;
      raf = 0;
      showResumeMode(true);
      return;
    }
    raf = requestAnimationFrame(rewardLoop);
  }
  function cancelAnim() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function startAnim()  { cancelAnim(); raf = requestAnimationFrame(loop); }

  function triggerPulse(now) {
    var p, dp;
    for (p = 0; p < 12; p++) pulseRings.push(makePulseRing(now));
    for (p = 0; p < 20; p++) {
      dp = makeDust(); dp.z = cameraZ + NEAR + Math.random()*70; dp.layer = 0;
      dust.push(dp);
    }
    if (dust.length > NUM_DUST + 45) dust.splice(0, dust.length - (NUM_DUST+45));
    bloomStart = now;
  }

  function drawBloom(now) {
    if (!bloomStart) return;
    var t = (now - bloomStart) / 360;
    if (t >= 1) { bloomStart = 0; return; }
    var alpha = 0.16*(1-t)*(1-t);
    var r = R_TUNNEL*(FOV/55)*(0.3 + t*0.7);
    var grd = ctx.createRadialGradient(cx,cy,0, cx,cy,r);
    grd.addColorStop(0,    'rgba(210,170,255,'+alpha.toFixed(4)+')');
    grd.addColorStop(0.35, 'rgba(168,85,247,'+(alpha*0.45).toFixed(4)+')');
    grd.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = grd; ctx.fillRect(0,0,W,H);
  }

  function drawHaze() {
    var r = R_TUNNEL*(FOV/155);
    var grd = ctx.createRadialGradient(cx,cy,0, cx,cy,r);
    grd.addColorStop(0,    'rgba(168,85,247,0.050)');
    grd.addColorStop(0.45, 'rgba(110,35,190,0.024)');
    grd.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = grd; ctx.fillRect(0,0,W,H);
    var driftX = Math.sin(elapsed*0.19)*W*0.045;
    var driftY = Math.cos(elapsed*0.14)*H*0.032;
    var r2 = Math.max(W,H)*0.7;
    var grd2 = ctx.createRadialGradient(cx+driftX,cy+driftY,0, cx+driftX,cy+driftY,r2);
    grd2.addColorStop(0,    'rgba(75,18,155,0.022)');
    grd2.addColorStop(0.55, 'rgba(35,8,90,0.010)');
    grd2.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = grd2; ctx.fillRect(0,0,W,H);
    if (noisePat) {
      var ox = (elapsed*7) % 256;
      var oy = (elapsed*4.5) % 256;
      ctx.save(); ctx.globalAlpha = 0.055;
      ctx.translate(ox, oy); ctx.fillStyle = noisePat;
      ctx.fillRect(-ox,-oy, W+256, H+256);
      ctx.restore();
    }
  }

  function drawRing(ring) {
    var relZ = ring.z - cameraZ;
    if (relZ < NEAR || relZ > FAR) return;
    var scale   = FOV/relZ;
    var wobbled = 1 + ring.wobble*Math.sin(elapsed*ring.wfreq + ring.phase);
    var screenR = ring.rFrac*R_TUNNEL*scale*wobbled;
    if (screenR < 2) return;
    var fade = Math.min(1,(relZ-NEAR)/80)*Math.min(1,(FAR-relZ)/400);
    var rot  = ring.phase + elapsed*0.04;
    var i, a0, a1, steps;
    if (ring.seg) {
      steps = 28;
      ctx.globalAlpha = ring.alpha*0.55*fade;
      ctx.strokeStyle = 'rgba(168,85,247,1)';
      ctx.lineWidth   = Math.max(1.5, 4*scale);
      ctx.beginPath();
      for (i=0; i<steps; i+=2) {
        a0 = (i/steps)*Math.PI*2; a1 = ((i+0.72)/steps)*Math.PI*2;
        ctx.moveTo(cx+Math.cos(a0)*screenR, cy+Math.sin(a0)*screenR);
        ctx.arc(cx,cy,screenR,a0,a1);
      }
      ctx.stroke();
      ctx.globalAlpha = ring.alpha*1.7*fade;
      ctx.strokeStyle = 'rgba(210,155,255,1)';
      ctx.lineWidth   = Math.max(0.5, 1.1*scale);
      ctx.beginPath();
      for (i=0; i<steps; i+=2) {
        a0 = (i/steps)*Math.PI*2; a1 = ((i+0.72)/steps)*Math.PI*2;
        ctx.moveTo(cx+Math.cos(a0)*screenR, cy+Math.sin(a0)*screenR);
        ctx.arc(cx,cy,screenR,a0,a1);
      }
      ctx.stroke();
    } else {
      ctx.globalAlpha = ring.alpha*0.55*fade;
      ctx.strokeStyle = 'rgba(168,85,247,1)';
      ctx.lineWidth   = Math.max(1.5, 4*scale);
      ctx.beginPath(); ctx.ellipse(cx,cy,screenR,screenR*0.6,rot,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha = ring.alpha*1.7*fade;
      ctx.strokeStyle = 'rgba(210,155,255,1)';
      ctx.lineWidth   = Math.max(0.5, 1.1*scale);
      ctx.beginPath(); ctx.ellipse(cx,cy,screenR,screenR*0.6,rot,0,Math.PI*2); ctx.stroke();
    }
  }

  function drawStreak(streak, spd, dt) {
    var relZ = streak.z - cameraZ;
    if (relZ < NEAR || relZ > FAR) return;
    var s0 = FOV/(relZ + spd*dt), s1 = FOV/relZ;
    var wx = Math.cos(streak.angle)*streak.frac*R_TUNNEL;
    var wy = Math.sin(streak.angle)*streak.frac*R_TUNNEL;
    var fadeNear = Math.min(1,(relZ-NEAR)/30);
    ctx.globalAlpha = (0.14 + 0.26*Math.min(1,spd*dt*10/relZ))*fadeNear;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(0.4, 0.9*s1);
    ctx.beginPath(); ctx.moveTo(cx+wx*s0,cy+wy*s0); ctx.lineTo(cx+wx*s1,cy+wy*s1); ctx.stroke();
  }

  function drawDust(dp, spd, dt) {
    var relZ = dp.z - cameraZ;
    if (relZ < NEAR || relZ > FAR) return;
    var s1 = FOV/relZ;
    var wx = Math.cos(dp.angle)*dp.frac*R_TUNNEL;
    var wy = Math.sin(dp.angle)*dp.frac*R_TUNNEL;
    var sx = cx + wx*s1, sy = cy + wy*s1;
    var r  = Math.max(0.5, dp.size*s1*(dp.layer===0?2.4:dp.layer===1?1.5:0.9));
    var baseA = dp.layer===0 ? 0.60 : dp.layer===1 ? 0.38 : 0.20;
    var fadeNear = Math.min(1,(relZ-NEAR)/22);
    var alpha = baseA*fadeNear*(0.82 + Math.random()*0.36);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = dp.purple ? 'rgba(190,115,255,1)' : 'rgba(228,210,255,1)';
    ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
    if (dp.layer===0 && r>1.0) {
      ctx.globalAlpha = alpha*0.22;
      ctx.fillStyle = 'rgba(168,85,247,1)';
      ctx.beginPath(); ctx.arc(sx,sy,r*2.8,0,Math.PI*2); ctx.fill();
    }
    var s0  = FOV/Math.max(NEAR+1, relZ + spd*dt*3);
    var sx0 = cx + wx*s0, sy0 = cy + wy*s0;
    var dx = sx - sx0, dy = sy - sy0;
    if (dx*dx + dy*dy > 0.25) {
      ctx.globalAlpha = alpha*0.45;
      ctx.strokeStyle = dp.purple ? 'rgba(180,100,255,1)' : 'rgba(220,200,255,1)';
      ctx.lineWidth = Math.max(0.3, r*0.55);
      ctx.beginPath(); ctx.moveTo(sx0,sy0); ctx.lineTo(sx,sy); ctx.stroke();
    }
  }

  function drawPulseRings(now) {
    var i, pr, t, expandR;
    for (i = pulseRings.length-1; i >= 0; i--) {
      pr = pulseRings[i]; t = (now - pr.startT) / pr.dur;
      if (t >= 1) { pulseRings.splice(i,1); continue; }
      expandR = pr.rFrac*R_TUNNEL*(FOV/(NEAR+28))*(0.25 + t*0.75);
      ctx.globalAlpha = 0.62*(1-t);
      ctx.strokeStyle = 'rgba(210,155,255,1)';
      ctx.lineWidth   = Math.max(0.5, 2.8*(1-t*0.6));
      ctx.beginPath(); ctx.ellipse(cx,cy,expandR,expandR*0.6,0,0,Math.PI*2); ctx.stroke();
    }
  }

  function loop(now) {
    if (!lastT) lastT = now;
    var dt = Math.min((now - lastT)/1000, 0.05);
    lastT = now; elapsed += dt;

    boostMul = (now < boostEnd) ? 1.6 : 1;
    var msFXMul = 1;
    if (milestoneFX && milestoneFX.active) {
      var mT = now - milestoneFX.start;
      var visEnd = milestoneFX.flyMs + milestoneFX.holdMs; // fly + hold
      // Slow to 0.35× during visible period, ease back during fade
      if (mT < visEnd) { msFXMul = 0.35; }
      else { msFXMul = 0.35 + 0.65 * Math.min((mT - visEnd) / milestoneFX.fadeMs, 1); }
    }
    var spd = SPEED * boostMul * msFXMul;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0,0,W,H);
    if (!isTunnelMode) { raf = 0; return; }

    if (!isScrubbing) cameraZ += spd*dt;
    // Update slider (write only, no layout read)
    if (scrubEl) scrubEl.value = Math.min(cameraZ / END_Z, 1);
    drawBloom(now);
    drawHaze();
    ctx.lineCap = 'round';

    var i, ring, streak, dp;
    for (i = 0; i < rings.length; i++) {
      ring = rings[i];
      if (ring.z - cameraZ < NEAR) {
        ring.z      = cameraZ + FAR*(0.65 + Math.random()*0.35);
        ring.rFrac  = 0.88 + Math.random()*0.24;
        ring.alpha  = 0.08 + Math.random()*0.10;
        ring.seg    = Math.random() < 0.28;
        ring.phase  = Math.random()*Math.PI*2;
        ring.wobble = Math.random()*0.055;
        ring.wfreq  = 0.7 + Math.random()*1.3;
      }
      drawRing(ring);
    }

    ctx.lineCap = 'butt';
    for (i = 0; i < streaks.length; i++) {
      streak = streaks[i];
      if (streak.z - cameraZ < NEAR) {
        streak.angle = Math.random()*Math.PI*2;
        streak.frac  = Math.random()*1.15;
        streak.z     = cameraZ + FAR*(0.5 + Math.random()*0.5);
      }
      drawStreak(streak, spd, dt);
    }

    for (i = 0; i < dust.length; i++) {
      dp = dust[i];
      if (dp.z - cameraZ < NEAR) {
        dp.angle  = Math.random()*Math.PI*2;
        dp.frac   = Math.random()<0.22 ? Math.random()*0.32 : 0.5 + Math.random()*0.65;
        dp.z      = cameraZ + NEAR + Math.random()*(FAR*(dp.layer===2?1.0:dp.layer===1?0.75:0.45));
        dp.purple = Math.random() < 0.52;
      }
      drawDust(dp, spd, dt);
    }

    ctx.lineCap = 'round';
    drawPulseRings(now);
    ctx.globalAlpha = 1;

    var m;
    for (m = 0; m < MILESTONES.length; m++) {
      if (!msDone[m] && cameraZ >= MILESTONES[m].triggerZ) {
        msDone[m]   = true;
        startMilestoneFX(MILESTONES[m], now, m);
        triggerPulse(now);
      }
    }
    drawMilestoneFX(now);
    if (cameraZ >= END_Z) { startRewardTransition(); return; }
    raf = requestAnimationFrame(loop);
  }

  if (skipBtn) skipBtn.addEventListener('click', function() {
    // Cancel reward if in progress, or skip from tunnel
    if (isRewardTransition) { isRewardTransition = false; cancelAnim(); showResumeMode(false); }
    else { endAnimationFast(); }
  });
  if (replayCtaBtn) replayCtaBtn.addEventListener('click', showTunnelMode);

  document.addEventListener('click', function() {
    if (!isTunnelMode || done || isRewardTransition) return;
    boostEnd = performance.now() + 500;
  }, { passive: true });

  // ── Scrub slider logic ──
  if (scrubEl) {
    var scrubGrabHandler = function(e) {
      if (!isTunnelMode || done) return;
      isScrubbing = true;
      scrubMin = cameraZ / END_Z;
      scrubEl.min = scrubMin;        // forward-only clamp
      e.stopPropagation();           // don't trigger click-boost
    };
    scrubEl.addEventListener('pointerdown', scrubGrabHandler);
    scrubEl.addEventListener('mousedown', scrubGrabHandler);

    scrubEl.addEventListener('input', function() {
      if (!isScrubbing) return;
      var val = parseFloat(scrubEl.value);
      if (val < scrubMin) val = scrubMin;
      cameraZ = val * END_Z;
    });

    var scrubReleaseHandler = function() {
      if (!isScrubbing) return;
      isScrubbing = false;
      scrubEl.min = 0;
      if (cameraZ >= END_Z) { startRewardTransition(); }
    };
    scrubEl.addEventListener('pointerup', scrubReleaseHandler);
    scrubEl.addEventListener('change', scrubReleaseHandler);

    // Prevent page scroll while dragging
    scrubEl.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
  }

  buildNoiseTex();
  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (reduced) {
    cvs.hidden = true;
    resumeEl.hidden = false; highlightsEl.hidden = false;
    isTunnelMode = false;
    if (ctrlLabel)      ctrlLabel.hidden = true;
    if (skipBtn)        skipBtn.hidden = true;
    if (scrubWrap)      scrubWrap.hidden = true;
    if (replayCtaBtn)   replayCtaBtn.hidden = true;
    if (navWorkBtn)     navWorkBtn.hidden = false;
    if (navApproachBtn) navApproachBtn.hidden = false;
  } else {
    if (scrubWrap) scrubWrap.hidden = false;
    initTunnel();
    startAnim();
  }
});
