(function () {
  'use strict';

  /* ---------------------------------------------------------- reveal
     Client-directed deviation 2026-08-25: opacity-only relaxed to
     opacity+14px-drift (see DESIGN.md). Every .sl-spy element starts at
     opacity:0/translateY(14px) and gets .is-in added once it crosses the
     viewport; the CSS then handles the actual drift-fade. Sibling
     elements that cross the threshold in the SAME observer batch get a
     modest incremental transition-delay so they settle in a soft ripple
     rather than popping together — capped low, this is not a slideshow. */
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var spies = Array.prototype.slice.call(document.querySelectorAll('.sl-spy'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      var batchIndex = 0;
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (!reduceMotion) {
            e.target.style.transitionDelay = (Math.min(batchIndex, 4) * 70) + 'ms';
            batchIndex++;
          }
          e.target.classList.add('is-in');
          io.unobserve(e.target);
          // Failsafe: in throttled/hidden tabs (in-app previews) CSS transition
          // timelines freeze at 0, leaving .is-in content computed at opacity 0.
          // Force the end state (opacity AND the reveal drift) so sections can
          // never stay invisible or stuck mid-drift.
          (function (el) {
            setTimeout(function () {
              if (getComputedStyle(el).opacity === '0') { el.style.opacity = '1'; el.style.transform = 'none'; }
            }, 900);
          })(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    spies.forEach(function (el) { io.observe(el); });

    /* In-view-on-mount + hidden-document guard (the bakery pattern).
       In a hidden/throttled document (in-app preview panes) the observer
       never fires and transition timelines freeze at 0, so the page below
       the hero would render blank. If hidden, reveal everything with the
       end state inline (opacity AND transform, so the translateY drift
       never ships stuck mid-way); if visible, immediately reveal what is
       already in the viewport instead of waiting for the first observer
       tick. */
    var revealNow = function (el) { el.classList.add('is-in'); el.style.opacity = '1'; el.style.transform = 'none'; io.unobserve(el); };
    if (document.visibilityState === 'hidden') {
      spies.forEach(revealNow);
    } else {
      var vh = window.innerHeight;
      spies.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) revealNow(el);
      });
    }
  } else {
    spies.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------------------------------------------------------- CTA dock (JOB 1)
     The fixed call bar and the contact section's own call button are the same
     CTA. As #footerCallCta comes into view the bar retires (translateY+fade,
     handled in CSS off body.sl-cta-docked); scrolling back up brings it home.
     rootMargin is shrunk by the bar's own height so "in view" means actually
     visible above it, not merely underneath it. */
  var navMob = document.querySelector('.sl-callbar');
  var footerCallCta = document.getElementById('footerCallCta');
  if (navMob && footerCallCta && 'IntersectionObserver' in window) {
    var navMobH = navMob.getBoundingClientRect().height || 70;
    var ctaIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        document.body.classList.toggle('sl-cta-docked', e.isIntersecting);
      });
    }, { rootMargin: '0px 0px -' + Math.ceil(navMobH) + 'px 0px', threshold: 0 });
    ctaIO.observe(footerCallCta);
  }

  /* ---------------------------------------------------------- mobile menu */
  var menuOpen = document.getElementById('menuOpen');
  var menuClose = document.getElementById('menuClose');
  var menuPanel = document.getElementById('menuPanel');
  var menuLinks = document.querySelectorAll('.menuLink');

  function openMenu() {
    menuPanel.style.opacity = '1';
    menuPanel.style.visibility = 'visible';
    menuOpen.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    menuPanel.style.opacity = '0';
    menuPanel.style.visibility = 'hidden';
    menuOpen.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  if (menuOpen) menuOpen.addEventListener('click', openMenu);
  if (menuClose) menuClose.addEventListener('click', closeMenu);
  menuLinks.forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuPanel.style.visibility === 'visible') closeMenu();
  });

  /* ---------------------------------------------------------- catalogue rail
     Title, count, square-dot pagination, prev/next, snapping tiles.
     Dots are built once per rail from the number of tiles present. */
  var rails = document.querySelectorAll('[data-rail]');
  rails.forEach(function (rail) {
    var track = rail.querySelector('[data-track]');
    var dotsWrap = rail.querySelector('[data-dots]');
    var prevBtn = rail.querySelector('[data-prev]');
    var nextBtn = rail.querySelector('[data-next]');
    if (!track) return;
    var tiles = Array.prototype.slice.call(track.children);
    var n = tiles.length;

    if (dotsWrap) {
      tiles.forEach(function (_, k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sl-dot';
        b.setAttribute('data-on', k === 0 ? '1' : '0');
        b.setAttribute('aria-label', 'Fara á ' + (k + 1));
        b.addEventListener('click', function () {
          var first = track.firstElementChild;
          var step = (first ? first.offsetWidth : 320) + 8;
          track.scrollTo({ left: k * step, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
        dotsWrap.appendChild(b);
      });
    }

    function updateState() {
      var step = track.scrollWidth / Math.max(1, n);
      var i = Math.min(n - 1, Math.round(track.scrollLeft / Math.max(1, step)));
      if (dotsWrap) {
        Array.prototype.forEach.call(dotsWrap.children, function (d, k) {
          d.setAttribute('data-on', k === i ? '1' : '0');
        });
      }
      var atStart = track.scrollLeft <= 2;
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      if (prevBtn) prevBtn.disabled = atStart;
      if (nextBtn) nextBtn.disabled = atEnd;
    }

    function go(dir) {
      var first = track.firstElementChild;
      var step = (first ? first.offsetWidth : 320) + 8;
      track.scrollBy({ left: dir * step, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { go(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', updateState, { passive: true });
    window.addEventListener('resize', updateState);
    updateState();
  });

  /* ---------------------------------------------------------- Húsgögn dropdown */
  var drop = document.querySelector('.sl-drop');
  var dropBtn = document.getElementById('dropBtn');
  if (drop && dropBtn) {
    var hoverable = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    var closeTimer = null;
    function setOpen(on) {
      drop.classList.toggle('is-open', on);
      dropBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    dropBtn.addEventListener('click', function () { setOpen(!drop.classList.contains('is-open')); });
    if (hoverable) {
      drop.addEventListener('mouseenter', function () { clearTimeout(closeTimer); setOpen(true); });
      drop.addEventListener('mouseleave', function () { closeTimer = setTimeout(function () { setOpen(false); }, 160); });
    }
    document.addEventListener('click', function (e) { if (!drop.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    drop.querySelectorAll('.sl-droppanel a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  }
})();
