// Core interactions for West Coast Studio

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

    const playAllPausedVideos = () => {
      lazyServiceVideos.forEach((video) => {
        if (video.paused && video.src) {
          video.muted = true;
          video.play().catch(() => {});
        }
      });
    };

    document.addEventListener('touchstart', playAllPausedVideos, { once: true, passive: true });
    document.addEventListener('scroll', playAllPausedVideos, { once: true, passive: true });

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
        { root: null, rootMargin: '800px 0px', threshold: 0.01 }
      );

      lazyServiceVideos.forEach((video) => observer.observe(video));
    } else {
      lazyServiceVideos.forEach((video) => startVideo(video));
    }
  }

  // 9. Eagerly load first few videos for instant playback
  const eagerLoadFirstVideos = () => {
    const firstVideos = document.querySelectorAll('.service-gallery video[data-autoplay]');
    const toLoad = Array.from(firstVideos).slice(0, 3);

    toLoad.forEach((video) => {
      const sources = video.querySelectorAll('source[data-src]');
      sources.forEach((source) => {
        if (!source.src && source.dataset.src) source.src = source.dataset.src;
      });
      video.preload = 'auto';
      video.load();
    });
  };

  setTimeout(eagerLoadFirstVideos, 100);

  // 10. Make entire case study card clickable (and remove the need for the arrow button)
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
      clone.src = (source && source.src) || video.currentSrc || video.src;
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


// Pinned collage rail: vertical page scroll drives horizontal card advance (desktop only)
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
  const endBufferPx = 260;

  let scrollDistance = 0;
  let startY = 0;
  let topOffset = 0;

  function recalc() {
    if (!isDesktop()) {
      section.style.height = '';
      stack.scrollLeft = 0;
      stack.style.setProperty('--railPadExtra', '0px');
      panels.forEach(p => { p.style.transform = ''; p.style.opacity = ''; });
      return;
    }

    // --- Start centering: compute extra left padding so first card is centered ---
    stack.style.setProperty('--railPadExtra', '0px');
    const basePadLeft = parseFloat(getComputedStyle(stack).paddingLeft) || 0;
    const firstPanel = panels[0];
    if (firstPanel) {
      const firstW = firstPanel.getBoundingClientRect().width;
      const desiredPad = Math.max(0, (stack.clientWidth - firstW) / 2);
      const extra = Math.max(0, desiredPad - basePadLeft);
      stack.style.setProperty('--railPadExtra', extra + 'px');
    }

    // Recompute after padding change
    scrollDistance = Math.max(0, stack.scrollWidth - stack.clientWidth);

    const topStr = getComputedStyle(pin).top || '0px';
    topOffset = parseFloat(topStr) || 0;

    const pinH = pin.getBoundingClientRect().height || 0;

    // Extra vertical runway = scrollDistance + end buffer
    section.style.height = (pinH + scrollDistance + endBufferPx) + 'px';

    const sectionTop = section.getBoundingClientRect().top + window.scrollY;
    startY = sectionTop - topOffset;

    sync();
  }

  let ticking = false;
  function sync() {
    if (!isDesktop() || scrollDistance <= 0) return;

    // Map vertical scroll to horizontal — clamp t to [0,1] using only scrollDistance
    const raw = (window.scrollY - startY) / scrollDistance;
    const t = Math.max(0, Math.min(1, raw));
    stack.scrollLeft = t * scrollDistance;

    // Subtle 3D card transforms (skip if reduced motion)
    if (!prefersReduced.matches) {
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
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; sync(); });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', recalc);
  // ResizeObserver catches content-driven size changes (images/videos loading)
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(recalc).observe(stack);
  }
  window.addEventListener('load', recalc);

  // Horizontal trackpad scroll → convert to vertical page scroll
  pin.addEventListener('wheel', (e) => {
    if (!isDesktop() || scrollDistance <= 0) return;
    // Only handle horizontal gesture (|deltaX| > |deltaY|)
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    // Don't trap at rail edges
    const currentT = (window.scrollY - startY) / scrollDistance;
    if ((e.deltaX < 0 && currentT <= 0) || (e.deltaX > 0 && currentT >= 1)) return;
    e.preventDefault();
    window.scrollBy(0, e.deltaX);
  }, { passive: false });

  recalc();
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
    const COLORS = [
      [168, 85, 247],  // accent purple
      [68, 136, 255],  // blue
      [68, 221, 255],  // cyan
      [204, 85, 255]   // soft magenta
    ];
    const TRAIL_FADE   = 0.035;
    const SPEED_MIN    = 0.4;
    const SPEED_MAX    = 1.8;
    const LIFE_MIN     = 200;
    const LIFE_MAX     = 550;
    const PTR_RADIUS   = 180;
    const PTR_FORCE    = 0.04;
    const SEED_COUNT   = 60;
    const SEED_FLY_MIN = 400;
    const SEED_FLY_MAX = 700;

    let ctx, W = 0, H = 0, dpr = 1;
    let particles = [], seeds = [];
    let raf = 0, intensity = 0;
    let ptrX = -9999, ptrY = -9999;
    let workRect = null;
    let seedFired = false;
    let reduced = false, staticDone = false;
    let attractX = 0, attractY = 0, attractActive = false;

    const rnd = (a, b) => Math.random() * (b - a) + a;

    // 4-octave sin/cos pseudo-noise field
    function fieldAngle(x, y, t) {
      const nx = x / W, ny = y / H;
      const s = t * 0.0003;
      return (
        Math.sin(nx * 2.1 + s * 0.5) + Math.cos(ny * 2.3 + s * 0.3)
        + (Math.sin(nx * 4.7 + s * 0.7) + Math.cos(ny * 4.3 + s * 0.4)) * 0.5
        + (Math.sin(nx * 8.3 - s * 0.2) + Math.cos(ny * 7.9 - s * 0.15)) * 0.25
        + (Math.sin(nx * 12.1 + ny * 3.7 + s * 0.9)) * 0.15
      ) * Math.PI;
    }

    function spawn(x, y) {
      const px = x ?? rnd(0, W), py = y ?? rnd(0, H);
      return {
        x: px, y: py, lx: px, ly: py,
        spd: rnd(SPEED_MIN, SPEED_MAX),
        ci: (Math.random() * COLORS.length) | 0,
        life: (rnd(LIFE_MIN, LIFE_MAX)) | 0,
        ml: 0
      };
    }

    function initPool() {
      const count = Math.min(Math.max((W * H / 200) | 0, 2000), 8000);
      particles = [];
      for (let i = 0; i < count; i++) {
        const p = spawn();
        p.ml = p.life;
        particles.push(p);
      }
    }

    function doResize() {
      const r = driftCanvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = (r.width * dpr) | 0;
      H = (r.height * dpr) | 0;
      driftCanvas.width = W;
      driftCanvas.height = H;
      initPool();
      seeds = [];
      if (workAccent) workRect = workAccent.getBoundingClientRect();
      if (reduced && !staticDone) renderStaticFrame();
    }

    function renderStaticFrame() {
      if (!ctx || W === 0) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      for (let f = 0; f < 60; f++) updateParticles(f * 16);
      renderFrame();
      staticDone = true;
    }

    function updateParticles(time) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.lx = p.x; p.ly = p.y;

        const a = fieldAngle(p.x, p.y, time);
        let vx = Math.cos(a) * p.spd;
        let vy = Math.sin(a) * p.spd;

        // Pointer swirl
        const dx = p.x - ptrX, dy = p.y - ptrY;
        const d2 = dx * dx + dy * dy;
        if (d2 < PTR_RADIUS * PTR_RADIUS && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / PTR_RADIUS) * PTR_FORCE;
          const pa = Math.atan2(dy, dx) + 1.5708; // π/2
          vx += Math.cos(pa) * f * (p.spd + 1);
          vy += Math.sin(pa) * f * (p.spd + 1);
        }

        // Collect attractor (particle-to-text handoff)
        if (attractActive) {
          const ax = attractX - p.x, ay = attractY - p.y;
          const ad2 = ax * ax + ay * ay;
          if (ad2 > 1) {
            const ad = Math.sqrt(ad2);
            const af = Math.min(0.06, 300 / ad2);
            vx += (ax / ad) * af * p.spd;
            vy += (ay / ad) * af * p.spd;
          }
        }

        p.x += vx; p.y += vy;
        p.life--;

        if (p.life <= 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
          const n = spawn();
          p.x = n.x; p.y = n.y; p.lx = n.lx; p.ly = n.ly;
          p.spd = n.spd; p.ci = n.ci; p.life = n.life; p.ml = n.life;
        }
      }
    }

    function updateSeeds(now) {
      for (let i = seeds.length - 1; i >= 0; i--) {
        const s = seeds[i];
        const t = Math.min((now - s.st) / s.dur, 1);
        const e = 1 - (1 - t) * (1 - t) * (1 - t); // easeOutCubic
        s.lx = s.x; s.ly = s.y;
        s.x += (s.tx - s.x) * e * 0.08;
        s.y += (s.ty - s.y) * e * 0.08;
        if (t >= 1) {
          const p = spawn(s.x, s.y);
          p.ci = s.ci; p.ml = p.life;
          particles.push(p);
          seeds.splice(i, 1);
        }
      }
    }

    function renderFrame() {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = intensity || 1;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const c = COLORS[p.ci];
        const fade = p.ml > 0 ? p.life / p.ml : 0;
        ctx.lineWidth = 1 + (p.spd / SPEED_MAX) * 1.2;
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(fade * 0.6).toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(p.lx, p.ly);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i];
        const c = COLORS[s.ci];
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.9)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.lx, s.ly);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }

      // Pointer glow
      if (ptrX > 0 && ptrY > 0) {
        const gr = PTR_RADIUS * 1.2;
        const grad = ctx.createRadialGradient(ptrX, ptrY, 0, ptrX, ptrY, gr);
        grad.addColorStop(0, `rgba(168,85,247,${(0.12 * intensity).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(168,85,247,${(0.04 * intensity).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(ptrX - gr, ptrY - gr, gr * 2, gr * 2);
      }

      ctx.restore();
    }

    function loop() {
      const now = performance.now();
      ctx.fillStyle = `rgba(0,0,0,${TRAIL_FADE})`;
      ctx.fillRect(0, 0, W, H);
      updateParticles(now);
      updateSeeds(now);
      renderFrame();
      raf = requestAnimationFrame(loop);
    }

    function start() { if (!raf && !reduced) raf = requestAnimationFrame(loop); }
    function stop()  { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    function onPtr(ev) {
      const r = driftCanvas.getBoundingClientRect();
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      ptrX = (cx - r.left) * dpr;
      ptrY = (cy - r.top) * dpr;
    }

    return {
      init() {
        ctx = driftCanvas.getContext('2d');
        reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        doResize();
        if (!reduced) {
          driftCanvas.addEventListener('mousemove', onPtr, { passive: true });
          driftCanvas.addEventListener('touchmove', onPtr, { passive: true });
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
          const cr = driftCanvas.getBoundingClientRect();
          const cx = ((workRect.left + workRect.width / 2) - cr.left) * dpr;
          const cy = ((workRect.top + workRect.height / 2) - cr.top) * dpr;
          const tx = W / 2, ty = H / 2;
          seeds = [];
          for (let i = 0; i < SEED_COUNT; i++) {
            const a = rnd(0, Math.PI * 2), d = rnd(5, 25);
            seeds.push({
              x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
              lx: cx, ly: cy, tx, ty,
              st: performance.now(), dur: rnd(SEED_FLY_MIN, SEED_FLY_MAX),
              ci: (Math.random() * COLORS.length) | 0
            });
          }
          seedFired = true;
        }
        if (progress < 0.2 && seedFired) {
          seedFired = false;
          seeds = [];
        }
      },

      startCollect(tx, ty) {
        attractX = tx * dpr;
        attractY = ty * dpr;
        attractActive = true;
        setTimeout(() => { attractActive = false; }, 500);
      },

      onResize: doResize
    };
  })();

  drift.init();

  // ── Particle-to-text handoff: "how the work comes together" glow ──
  const approachTitle = document.querySelector('.approach-title');
  if (approachTitle && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let handoffFired = false;
    const titleObs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !handoffFired) {
        handoffFired = true;
        // Collect particles toward heading
        const tr = approachTitle.getBoundingClientRect();
        const cr = driftCanvas.getBoundingClientRect();
        drift.startCollect(
          (tr.left + tr.width / 2) - cr.left,
          (tr.top + tr.height / 2) - cr.top
        );
        // Glow the heading
        approachTitle.classList.add('approach-title--glow');
        setTimeout(() => approachTitle.classList.remove('approach-title--glow'), 800);
      }
      if (!entry.isIntersecting && handoffFired) {
        // Only reset if scrolled back above the hero
        const heroBottom = approachHero.getBoundingClientRect().bottom;
        if (heroBottom > window.innerHeight) handoffFired = false;
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





// Approach collage: auto cycle and fade between videos
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('approach-page')) return;

  // Force play all videos on first user interaction (mobile fix)
  const playAllApproachVideos = () => {
    document.querySelectorAll('.approach-page video').forEach((video) => {
      if (video.paused) {
        video.muted = true;
        video.play().catch(() => {});
      }
    });
  };

  document.addEventListener('touchstart', playAllApproachVideos, { once: true, passive: true });
  document.addEventListener('scroll', playAllApproachVideos, { once: true, passive: true });

  // Tile id -> list of files to cycle through in order
  const rotationMap = {
    'tile-3d': ['https://res.cloudinary.com/ddpcw88mj/video/upload/lab7.mp4'],
    'tile-final': ['https://res.cloudinary.com/ddpcw88mj/video/upload/s3.mp4'],
    'tile-edit': ['https://res.cloudinary.com/ddpcw88mj/video/upload/vid2.mp4'],
    'tile-brand': ['https://res.cloudinary.com/ddpcw88mj/video/upload/vid3.mp4', 'https://res.cloudinary.com/ddpcw88mj/video/upload/vid2.mp4'],
    'tile-sound': ['https://res.cloudinary.com/ddpcw88mj/video/upload/vid1.mp4', 'https://res.cloudinary.com/ddpcw88mj/video/upload/vid5.mp4'],
    'tile-type': ['https://res.cloudinary.com/ddpcw88mj/video/upload/vid4.mp4'],
    'tile-delivery': ['https://res.cloudinary.com/ddpcw88mj/video/upload/d3.mp4']
  };

  // Fetch all first videos early for fast startup
  const allFirstVideos = Object.values(rotationMap).map((arr) => arr[0]);
  allFirstVideos.forEach((src) => {
    try {
      fetch(src).catch(() => {});
    } catch (_) {}
  });

  Object.entries(rotationMap).forEach(([tileId, sources]) => {
    const tile = document.getElementById(tileId);
    if (!tile || !sources.length) return;

    const video = tile.querySelector('video');
    if (!video) return;

    const hasMultiple = sources.length > 1;
    let index = 0;

    video.preload = 'auto';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.display = 'block';

    function playCurrent() {
      video.src = sources[index];
      video.load();
      const playPromise = video.play();
      if (playPromise && playPromise.catch) playPromise.catch(() => {});
    }

    // Single clip tiles just loop
    if (!hasMultiple) {
      video.loop = true;
      playCurrent();
      return;
    }

    // Multi clip tile with crossfade
    video.loop = false;
    video.style.opacity = '1';
    video.style.transition = 'opacity 420ms ease';
    playCurrent();

    function fadeToNext() {
      if (video.dataset.fading === 'out') return;
      video.dataset.fading = 'out';
      video.style.opacity = '0';
    }

    video.addEventListener('transitionend', (event) => {
      if (event.propertyName !== 'opacity') return;

      if (video.dataset.fading === 'out') {
        index = (index + 1) % sources.length;
        video.dataset.fading = 'in';

        video.src = sources[index];
        video.load();
        const promise = video.play();
        if (promise && promise.catch) promise.catch(() => {});

        requestAnimationFrame(() => {
          video.style.opacity = '1';
        });
      } else if (video.dataset.fading === 'in') {
        video.dataset.fading = '';
      }
    });

    video.addEventListener('ended', fadeToNext);
    tile.addEventListener('click', fadeToNext);
  });
});


// CURSOR FX — disabled
