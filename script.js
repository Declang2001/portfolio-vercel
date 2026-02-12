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
  // 11. Approach collage panels: click anywhere in a collage panel -> contact.html
  if (document.body.classList.contains('approach-page')) {
    const collageStack = document.querySelector('.collage-stack');

    if (collageStack) {
      collageStack.addEventListener(
        'click',
        (e) => {
          // only handle clicks that originated inside a collage panel
          const panel = e.target.closest('.collage-panel');
          if (!panel) return;

          // do not hijack header/menu interactions
          if (
            e.target.closest('.site-header') ||
            e.target.closest('.menu-overlay') ||
            e.target.closest('.menu-toggle') ||
            e.target.closest('.menu-close') ||
            e.target.closest('a')
          ) {
            return;
          }

          // allow modified clicks (new tab, etc.) to behave normally
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

          e.preventDefault();
          e.stopPropagation();
          window.location.href = 'contact.html';
        },
        true // capture so this wins over any tile click handlers
      );
    }
  }

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
