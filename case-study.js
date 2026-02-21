/* ============================================================
   case-study.js — Scroll reveals + media modal
   Only runs on pages with .cs wrapper.
   ============================================================ */

(() => {
  'use strict';

  const root = document.querySelector('.cs');
  if (!root) return;

  /* ──────────────────────────────────────────────
     1. Scroll-reveal for .cs-section elements
     ────────────────────────────────────────────── */
  const sections = root.querySelectorAll('.cs-section, .cs-deepdive');

  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, threshold: 0.15 }
    );

    sections.forEach((s) => observer.observe(s));
  } else {
    sections.forEach((s) => s.classList.add('is-in'));
  }

  /* ──────────────────────────────────────────────
     2. Media modal
     ────────────────────────────────────────────── */
  const mediaButtons = Array.from(root.querySelectorAll('.cs-media'));
  if (!mediaButtons.length) return;

  // Build modal DOM
  const modal = document.createElement('div');
  modal.className = 'cs-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'media viewer');
  modal.innerHTML = `
    <div class="cs-modal-inner">
      <button class="cs-modal-close" aria-label="close viewer">&times;</button>
      <button class="cs-modal-nav cs-modal-prev" aria-label="previous">&lsaquo;</button>
      <button class="cs-modal-nav cs-modal-next" aria-label="next">&rsaquo;</button>
      <div class="cs-modal-stage"></div>
      <div class="cs-modal-caption"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const stage = modal.querySelector('.cs-modal-stage');
  const caption = modal.querySelector('.cs-modal-caption');
  const closeBtn = modal.querySelector('.cs-modal-close');
  const prevBtn = modal.querySelector('.cs-modal-prev');
  const nextBtn = modal.querySelector('.cs-modal-next');
  let currentIndex = -1;
  let previousFocus = null;

  function showItem(index) {
    currentIndex = ((index % mediaButtons.length) + mediaButtons.length) % mediaButtons.length;
    const btn = mediaButtons[currentIndex];
    const src = btn.dataset.full || '';
    const cap = btn.dataset.caption || '';
    const isVideo = btn.querySelector('video') || src.match(/\.(mp4|webm|mov)(\?|$)/i);

    stage.innerHTML = '';

    if (isVideo) {
      const video = document.createElement('video');
      video.src = src;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      stage.appendChild(video);
    } else if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = cap;
      stage.appendChild(img);
    }

    caption.textContent = cap;
  }

  function openModal(index) {
    previousFocus = document.activeElement;
    showItem(index);
    modal.classList.add('is-open');
    closeBtn.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    const vid = stage.querySelector('video');
    if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
    stage.innerHTML = '';
    if (previousFocus) previousFocus.focus();
  }

  // Click handlers
  mediaButtons.forEach((btn, i) => {
    btn.addEventListener('click', () => openModal(i));
  });

  closeBtn.addEventListener('click', closeModal);
  prevBtn.addEventListener('click', () => showItem(currentIndex - 1));
  nextBtn.addEventListener('click', () => showItem(currentIndex + 1));

  // Backdrop close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Keyboard
  modal.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('is-open')) return;

    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showItem(currentIndex - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); showItem(currentIndex + 1); }

    // Focus trap
    if (e.key === 'Tab') {
      const focusable = modal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  });

  /* ──────────────────────────────────────────────
     3. Hover particle effect (meta + triad cards)
     ────────────────────────────────────────────── */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!prefersReducedMotion.matches) {
    const rand = (min, max) => Math.random() * (max - min) + min;
    const cards = root.querySelectorAll('.cs-meta-item, .cs-triad-col');

    cards.forEach((card) => {
      let pfx = null;
      let animations = [];

      function spawnParticles() {
        if (pfx) return;
        pfx = document.createElement('div');
        pfx.className = 'cs-pfx';
        card.appendChild(pfx);

        const cardRect = card.getBoundingClientRect();
        const w = cardRect.width;
        const h = cardRect.height;
        const pad = 12;
        const count = Math.floor(rand(1, 4));

        for (let i = 0; i < count; i++) {
          const dot = document.createElement('div');
          dot.className = 'cs-particle';
          const size = rand(3, 6);
          dot.style.width = size + 'px';
          dot.style.height = size + 'px';
          dot.style.opacity = '0';
          pfx.appendChild(dot);

          const startX = rand(pad, w - pad);
          const startY = rand(pad, h - pad);

          const waypoints = [];
          const numWaypoints = Math.floor(rand(3, 7));
          for (let j = 0; j < numWaypoints; j++) {
            waypoints.push({
              transform: `translate(${rand(pad, w - pad)}px, ${rand(pad, h - pad)}px)`,
              opacity: rand(0.3, 0.7),
            });
          }

          const keyframes = [
            { transform: `translate(${startX}px, ${startY}px)`, opacity: 0 },
            { transform: `translate(${startX}px, ${startY}px)`, opacity: rand(0.4, 0.7), offset: 0.05 },
            ...waypoints,
            { transform: `translate(${rand(pad, w - pad)}px, ${rand(pad, h - pad)}px)`, opacity: 0 },
          ];

          const duration = rand(2000, 4000);
          const delay = rand(0, 300);

          const anim = dot.animate(keyframes, {
            duration,
            delay,
            iterations: Infinity,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          });
          animations.push(anim);
        }
      }

      function removeParticles() {
        animations.forEach((a) => a.cancel());
        animations = [];
        if (pfx) { pfx.remove(); pfx = null; }
      }

      card.addEventListener('pointerenter', spawnParticles);
      card.addEventListener('focusin', spawnParticles);
      card.addEventListener('pointerleave', removeParticles);
      card.addEventListener('focusout', (e) => {
        if (!card.contains(e.relatedTarget)) removeParticles();
      });
    });
  }

  /* ──────────────────────────────────────────────
     4. Deep Dive — tabbed module
     ────────────────────────────────────────────── */
  root.querySelectorAll('.cs-deepdive').forEach((deepdive) => {
    const tabs = Array.from(deepdive.querySelectorAll('[role="tab"]'));
    const panels = Array.from(deepdive.querySelectorAll('[role="tabpanel"]'));
    const indicator = deepdive.querySelector('.cs-tab-indicator');
    if (!tabs.length) return;

    function moveIndicator(tab) {
      if (!indicator) return;
      indicator.style.left = tab.offsetLeft + 'px';
      indicator.style.width = tab.offsetWidth + 'px';
    }

    function activate(tab) {
      tabs.forEach((t) => {
        t.setAttribute('aria-selected', 'false');
        t.classList.remove('is-active');
        t.tabIndex = -1;
      });
      panels.forEach((p) => {
        p.classList.remove('is-active');
        p.hidden = true;
      });

      tab.setAttribute('aria-selected', 'true');
      tab.classList.add('is-active');
      tab.tabIndex = 0;

      const panel = deepdive.querySelector('#' + tab.getAttribute('aria-controls'));
      if (panel) {
        panel.hidden = false;
        // Force reflow so the transition plays from the start
        void panel.offsetHeight;
        panel.classList.add('is-active');
      }

      moveIndicator(tab);
    }

    // Init indicator on the default active tab
    const activeTab = tabs.find((t) => t.classList.contains('is-active')) || tabs[0];
    moveIndicator(activeTab);

    // Recalc on resize
    window.addEventListener('resize', () => {
      const current = deepdive.querySelector('.cs-tab.is-active');
      if (current) moveIndicator(current);
    });

    // Click
    tabs.forEach((tab) => tab.addEventListener('click', () => activate(tab)));

    // Keyboard: arrow keys, home, end
    tabs.forEach((tab, i) => {
      tab.addEventListener('keydown', (e) => {
        let next;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) {
          e.preventDefault();
          next.focus();
          activate(next);
        }
      });
    });
  });
})();
