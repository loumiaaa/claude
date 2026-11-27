/* ==========================================================================
   Plateforme de suivi - Lamia — petits moments de joie
   - L.fun.miniScene(host, key, voice) : la phrase d'encouragement des tableaux
     de bord Santé et Budget.
   - L.fun.celebrate({ title, text }) : petite fête discrète (étoiles pixel).
   - L.fun.countUp(root) : les chiffres clés défilent jusqu'à leur valeur.
   Tout respecte « Réduire les animations ».
   ========================================================================== */
(function (L) {
  'use strict';

  var U = L.ui, esc = U.esc;
  function reduced() { return U.reducedMotion ? U.reducedMotion() : window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* --- Phrase d'encouragement des tableaux de bord ---------------------------- */
  // voice = { lamia: 'texte' } (phrases de design/phrases.js)
  function miniScene(host, key, voice) {
    if (!host) return;
    host.innerHTML = '<figure class="glass mini-quote"><span class="mini-quote__mark" aria-hidden="true">“</span>' +
      '<blockquote class="mini-quote__text">' + esc(voice.lamia) + '</blockquote></figure>';
    U.typo(host);
  }

  /* --- Célébration ---------------------------------------------------------------- */
  var celebrateEl = null, celebrateTimer = null;
  function celebrate(o) {
    o = o || {};
    if (!celebrateEl) {
      celebrateEl = document.createElement('div');
      celebrateEl.className = 'glass glass--strong celebrate';
      celebrateEl.setAttribute('role', 'status');
      document.body.appendChild(celebrateEl);
    }
    clearTimeout(celebrateTimer);
    celebrateEl.innerHTML =
      '<div class="celebrate__stars" aria-hidden="true">' + (reduced() ? '' : Array.apply(null, Array(10)).map(function (_, i) {
        return '<span class="celebrate__star" style="--i:' + i + ';--x:' + (Math.round(Math.random() * 200) - 100) + 'px;--r:' + Math.round(Math.random() * 360) + 'deg">' + U.pixelImg(i % 3 ? 'star' : 'heart', 1, '', '') + '</span>';
      }).join('')) + '</div>' +
      '<span class="celebrate__icon" aria-hidden="true">' + U.px(pick(['star', 'trophy', 'medal']), 2) + '</span>' +
      '<div class="celebrate__text"><strong>' + esc(o.title || 'Bravo !') + '</strong>' + (o.text ? '<span>' + esc(o.text) + '</span>' : '') + '</div>';
    celebrateEl.classList.remove('is-in'); void celebrateEl.offsetWidth; celebrateEl.classList.add('is-in');
    celebrateTimer = setTimeout(function () { celebrateEl.classList.remove('is-in'); }, o.duration || 3600);
  }

  /* --- Chiffres qui défilent --------------------------------------------------------- */
  function countUp(root) {
    if (!root || reduced()) return;
    root.querySelectorAll('.stat__value').forEach(function (v) {
      var node = null;
      for (var i = 0; i < v.childNodes.length; i++) if (v.childNodes[i].nodeType === 3 && /\d/.test(v.childNodes[i].nodeValue)) { node = v.childNodes[i]; break; }
      if (!node) return;
      var txt = node.nodeValue, m = /-?[\d   ]*\d(?:,\d+)?/.exec(txt);
      if (!m) return;
      var raw = m[0], dec = (raw.split(',')[1] || '').length;
      var target = parseFloat(raw.replace(/[   ]/g, '').replace(',', '.'));
      if (!isFinite(target) || target === 0) return;
      var fmt = function (x) { return x.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };
      var t0 = performance.now(), dur = 700;
      (function step(t) {
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        node.nodeValue = txt.replace(raw, fmt(target * e));
        if (k < 1) requestAnimationFrame(step); else node.nodeValue = txt;
      })(t0);
    });
  }

  /* --- Défilement animé ----------------------------------------------------------------
     Les blocs encore sous l'écran apparaissent en glissant quand on descend vers eux.
     Seulement à l'arrivée sur un onglet : un re-rendu (valeur saisie) ne rejoue rien. */
  var io = null, ioBatch = 0, ioTimer = null;
  var REVEAL = '.card, .stat, .hcard, .goal-card, .profile-card, .pet-card, .mini-quote, .hero, .profile-hero, .profile-section, .page-head + *';
  function reveal(view) {
    if (!view || reduced() || !('IntersectionObserver' in window)) return;
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var n = en.target;
          io.unobserve(n);
          n.style.transitionDelay = Math.min(ioBatch++, 5) * 90 + 'ms';
          n.classList.add('is-revealed');
          setTimeout(function () { n.classList.remove('reveal', 'is-revealed'); n.style.transitionDelay = ''; }, 1700);
        });
        clearTimeout(ioTimer); ioTimer = setTimeout(function () { ioBatch = 0; }, 120);
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    var fold = window.innerHeight * 0.9;
    var list = [].slice.call(view.querySelectorAll(REVEAL)).filter(function (n) {
      // un seul niveau : pas de bloc animé dans un bloc animé
      var p = n.parentElement;
      while (p && p !== view) { if (p.matches && p.matches(REVEAL)) return false; p = p.parentElement; }
      return true;
    });
    list.forEach(function (n) {
      if (n.getBoundingClientRect().top < fold) return;
      n.classList.add('reveal');
      io.observe(n);
    });
  }

  // Barre du haut : plus présente dès qu'on a quitté le haut de la page
  function watchScroll() {
    var root = document.documentElement, ticking = false;
    function update() {
      ticking = false;
      root.classList.toggle('is-scrolled', window.scrollY > 8);
      // Tout en bas de la page : les derniers blocs apparaissent, même s'ils sont petits
      if (window.scrollY + window.innerHeight >= root.scrollHeight - 4) {
        document.querySelectorAll('.view:not([hidden]) .reveal:not(.is-revealed)').forEach(function (n) {
          if (io) io.unobserve(n);
          n.classList.add('is-revealed');
          setTimeout(function () { n.classList.remove('reveal', 'is-revealed'); }, 1100);
        });
      }
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* --- Molette avec inertie (ordinateur) -----------------------------------------------
     La molette donne une destination ; la page y glisse et ralentit en douceur.
     Le tactile (téléphone), le clavier, la barre de défilement, les zones qui défilent
     elles-mêmes (Kanban, Planning, fenêtres) gardent le défilement natif. */
  function smoothWheel() {
    if (reduced() || !window.requestAnimationFrame) return;
    var root = document.documentElement, target = window.scrollY, pos = window.scrollY, raf = null, last = 0;
    var EASE = 0.085;          // part du chemin parcourue à chaque image (plus petit = plus doux)
    function max() { return root.scrollHeight - window.innerHeight; }
    function step(t) {
      var dt = last ? Math.min(3, (t - last) / 16.7) : 1;   // même vitesse à 60 Hz et 120 Hz
      last = t;
      pos += (target - pos) * (1 - Math.pow(1 - EASE, dt));
      if (Math.abs(target - pos) < 0.4) { pos = target; raf = null; last = 0; }
      window.scrollTo({ top: pos, left: 0, behavior: 'instant' });
      if (raf) raf = requestAnimationFrame(step);
    }
    function scrollsItself(n, dy) {
      for (; n && n !== document.body && n !== root; n = n.parentElement) {
        var cs = getComputedStyle(n);
        if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) {
          if ((dy < 0 && n.scrollTop > 0) || (dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true;
        }
      }
      return false;
    }
    window.addEventListener('wheel', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (root.classList.contains('has-layer') || scrollsItself(e.target, e.deltaY)) return;
      var dy = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1);
      e.preventDefault();
      if (!raf) { pos = window.scrollY; target = pos; }
      target = Math.max(0, Math.min(max(), target + dy));
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: false });
    // Tout autre défilement (clavier, barre, ancre, retour en haut) reprend la main
    function cancel() { if (raf) { cancelAnimationFrame(raf); raf = null; last = 0; } }
    ['keydown', 'mousedown', 'touchstart'].forEach(function (k) { window.addEventListener(k, cancel, { passive: true }); });
    window.addEventListener('hashchange', cancel);
  }

  L.fun = { miniScene: miniScene, celebrate: celebrate, countUp: countUp, reveal: reveal, watchScroll: watchScroll, smoothWheel: smoothWheel };
})(window.Lamia = window.Lamia || {});
