// Team 79 Krunch 2026 makeover — interactions (vanilla, minimal).
(function () {
  // mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var root = document.documentElement;
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = root.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.mobile-menu a').forEach(function (a) {
      a.addEventListener('click', function () { root.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false'); });
    });
  }

  // "More" dropdown: click/keyboard operable + aria-expanded kept in sync.
  // (CSS still opens it on hover/focus-within for mouse users.)
  var moreWrap = document.querySelector('.nav-more');
  var moreBtn = moreWrap && moreWrap.querySelector('.nav-more__btn');
  if (moreWrap && moreBtn) {
    var setMore = function (open) {
      moreWrap.classList.toggle('is-open', open);
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    moreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setMore(moreBtn.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('click', function (e) { if (!moreWrap.contains(e.target)) setMore(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMore(false); });
    moreWrap.addEventListener('focusout', function (e) { if (!moreWrap.contains(e.relatedTarget)) setMore(false); });
    moreWrap.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMore(false); }); });
  }

  // Hero video: a bandwidth-gated enhancement. The team photo is the always-on
  // fallback; the drone/robot video fades in on top for any visitor on a good
  // connection (desktop OR mobile) who hasn't asked to reduce motion or save data.
  // Bandwidth is gated wherever it's measurable (navigator.connection — e.g.
  // Android/Chrome). iOS Safari doesn't expose it, so there we play optimistically:
  // the clip is small (~5 MB), muted, and preload="none" so nothing loads unless it plays.
  var heroVid = document.querySelector('[data-hero-video]');
  if (heroVid) {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var c = navigator.connection || {};
    var stingy = c.saveData === true || (typeof c.effectiveType === 'string' && /(slow-2g|2g|3g)/.test(c.effectiveType));
    if (!reduceMotion && !stingy) {
      var heroSection = heroVid.closest('.hero--feature');
      heroVid.addEventListener('playing', function () {
        if (heroSection) heroSection.classList.add('hero-video-on');
      }, { once: true });
      var playAttempt = heroVid.play();
      if (playAttempt && playAttempt.catch) playAttempt.catch(function () {}); // autoplay blocked -> keep photo
    }
  }

  // scroll reveal (skipped when reduced motion is preferred)
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window && els.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    els.forEach(function (el) { io.observe(el); });
    // safety net: content must never stay hidden if the observer misses (fast scroll,
    // flaky timing, etc.). Force-reveal any stragglers after 2s.
    setTimeout(function () { els.forEach(function (el) { el.classList.add('in'); }); }, 2000);
  } else {
    els.forEach(function (el) { el.classList.add('in'); });
  }

  // Live-calculated stats: e.g. [data-since="1998"] = one per year since 1998, inclusive
  // (seasons competed). Recomputed in the browser so it stays correct every year with no edits.
  [].slice.call(document.querySelectorAll('[data-since]')).forEach(function (el) {
    var y = parseInt(el.getAttribute('data-since'), 10);
    if (y) el.textContent = String(new Date().getFullYear() - y + 1);
  });

  // Stat count-up: numbers tick from 0 to their value when scrolled into view.
  // Single 1-3 digit numbers only, so it animates counts (25+, 800+, $200) but leaves
  // years (1997) and ranges (12-18) and words (Open) alone. Honors reduced motion, and
  // never destroys the real value if the stat is never scrolled to.
  var countable = [].slice.call(document.querySelectorAll('.num')).map(function (el) {
    var m = /^(\D*)(\d{1,3})(\D*)$/.exec(el.textContent.trim());
    return m ? { el: el, pre: m[1], target: +m[2], suf: m[3] } : null;
  }).filter(Boolean);
  if (countable.length && !reduce && 'IntersectionObserver' in window) {
    var runCount = function (item) {
      var dur = 1100, t0 = null;
      var step = function (ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        item.el.textContent = item.pre + Math.round((1 - Math.pow(1 - p, 3)) * item.target) + item.suf;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        for (var i = 0; i < countable.length; i++) if (countable[i].el === e.target) { runCount(countable[i]); break; }
      });
    }, { threshold: 0.6 });
    countable.forEach(function (item) { cio.observe(item.el); });
  }

  // Contact form: submit through FormSubmit's AJAX endpoint so the visitor stays
  // on the page and gets an inline confirmation. If JS is off or fetch is missing,
  // the form's normal action (POST + /thanks/ redirect) still works.
  var cform = document.getElementById('contact-form');
  if (cform) {
    var cok = document.getElementById('contact-success');
    var cerr = cform.querySelector('.form-error');
    var cbtn = cform.querySelector('button[type="submit"]');
    var endpoint = (cform.getAttribute('action') || '').replace('formsubmit.co/', 'formsubmit.co/ajax/');
    cform.addEventListener('submit', function (e) {
      if (!window.fetch || endpoint.indexOf('/ajax/') === -1) return; // native POST fallback
      e.preventDefault();
      if (cerr) cerr.hidden = true;
      var label = cbtn ? cbtn.textContent : '';
      if (cbtn) { cbtn.disabled = true; cbtn.textContent = 'Sending…'; }
      fetch(endpoint, { method: 'POST', headers: { 'Accept': 'application/json' }, body: new FormData(cform) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!(res.ok && (res.d.success === true || res.d.success === 'true'))) throw new Error('submit failed');
          cform.hidden = true;
          if (cok) { cok.hidden = false; if (cok.focus) cok.focus(); cok.scrollIntoView({ block: 'nearest' }); }
        })
        .catch(function () {
          if (cerr) cerr.hidden = false;
          if (cbtn) { cbtn.disabled = false; cbtn.textContent = label; }
        });
    });
  }
})();
