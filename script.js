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
      const end = start + heroSection.offsetHeight - viewportHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (end <= start) return;

      let progress = (scrollY - start) / (end - start);
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

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateHeroOnScroll);
        ticking = true;
      }
    };

    updateHeroOnScroll();
    window.addEventListener('scroll', requestTick, { passive: true });
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


// Approach page hero: match home hero text drift + mid-screen fade, while video eases in
document.addEventListener('DOMContentLoaded', () => {
  const approachHero = document.querySelector('.hero.hero--approach');
  if (!approachHero) return;

  const topLine = approachHero.querySelector('.hero-line-top');
  const bottomLine = approachHero.querySelector('.hero-line-bottom');
  const videoWrapper = approachHero.querySelector('.approach-hero-video-wrapper');
  const heroVideo = approachHero.querySelector('.approach-hero-video-frame video');

  if (!topLine || !bottomLine || !videoWrapper) return;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // Ensure intro.mp4 tries to play
  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.preload = 'auto';
    heroVideo.setAttribute('playsinline', '');
    heroVideo.setAttribute('webkit-playsinline', '');

    const tryPlay = () => {
      const p = heroVideo.play();
      if (p && p.catch) p.catch(() => {});
    };

    tryPlay();
    window.addEventListener('scroll', tryPlay, { once: true, passive: true });
    document.addEventListener('touchstart', tryPlay, { once: true, passive: true });
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

    // VIDEO stays driven by the full approach hero scroll range (unchanged)
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
