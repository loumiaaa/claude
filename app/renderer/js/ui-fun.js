/* ==========================================================================
   Plateforme de suivi - Lamia — personnages et petits moments de joie
   - L.fun.miniScene(host, key, voice) : Lamia + Memeow en pixel art, avec
     leurs bulles, pour les tableaux de bord Santé et Budget.
   - L.fun.celebrate({ title, text }) : Lamia saute de joie, Memeow miaule,
     petites étoiles pixel (une seule à la fois, discrète).
   - L.fun.countUp(root) : les chiffres clés défilent jusqu'à leur valeur.
   - L.fun.meow() : la réplique au hasard de Memeow (jamais de mots humains).
   - Memeow dort dans la barre latérale et se réveille quand on la caresse.
   Tout respecte « Réduire les animations ».
   ========================================================================== */
(function (L) {
  'use strict';

  var U = L.ui, esc = U.esc;
  var casts = {};
  function reduced() { return U.reducedMotion ? U.reducedMotion() : window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var MEOWS = [
    { text: 'Meew !', icon: 'heart', anim: 'meow' },
    { text: 'Meeew meeew…', icon: 'heart', anim: 'lick' },
    { text: 'Mrrreeew ?', icon: 'kibble', anim: 'hungry' },
    { text: 'Meew meew meeew !', icon: 'star', anim: 'meow' },
    { text: 'mew.', icon: 'fish', anim: 'lick' },
    { text: 'Mrrrr…', icon: 'zzz', anim: 'idle' }
  ];
  function meow(not) {
    var pool = MEOWS.filter(function (m) { return m.text !== not; });
    return pick(pool);
  }
  function meowHTML(m) { return esc(m.text) + U.pixelImg(m.icon, 2, 'pixel-bubble__icon', ''); }

  function mount(key, canvas, who, anim, scale) {
    if (casts[key]) { try { casts[key].destroy(); } catch (e) { /* rien */ } }
    if (!canvas || !window.PixelCast) return null;
    casts[key] = window.PixelCast.mount(canvas, who, { scale: scale, animation: 'idle' });
    if (anim && anim !== 'idle' && !reduced()) setTimeout(function () { if (casts[key]) casts[key].play(anim); }, 450);
    return casts[key];
  }

  /* --- Mini-scène pour les tableaux de bord ---------------------------------- */
  // voice = { lamia: 'texte', lamiaAnim: 'wave'|'cheer'|'typing'|'idle', memeow?: {text, icon, anim} }
  function miniScene(host, key, voice) {
    if (!host) return;
    var narrow = window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
    var m = voice.memeow || meow();
    host.innerHTML =
      '<div class="glass mini-scene">' +
        '<canvas class="mini-scene__lamia" data-mini="lamia" aria-label="' + esc(L.store.me().name || 'Ton personnage') + ', en pixel art"></canvas>' +
        '<p class="pixel-bubble ' + (narrow ? 'pixel-bubble--tail-bottom' : 'pixel-bubble--tail-left') + ' pixel-bubble--pop mini-scene__say" aria-live="polite">' + esc(voice.lamia) + '</p>' +
        '<div class="mini-scene__cat">' +
          '<p class="pixel-bubble pixel-bubble--tail-bottom pixel-bubble--pop" data-mini-meow aria-live="polite"><span class="sr-only">Memeow répond : </span><span data-say>' + meowHTML(m) + '</span></p>' +
          '<button type="button" class="scene__cat" data-mini-memeow aria-label="Memeow, clique pour qu’elle réagisse"><canvas data-mini="memeow" aria-hidden="true"></canvas></button>' +
        '</div>' +
      '</div>';
    var scale = narrow ? 2 : 3;
    mount(key + ':lamia', host.querySelector('[data-mini="lamia"]'), L.store.me().character, voice.lamiaAnim || 'wave', scale);
    mount(key + ':memeow', host.querySelector('[data-mini="memeow"]'), 'memeow', m.anim, scale);
    var last = m.text;
    host.querySelector('[data-mini-memeow]').addEventListener('click', function () {
      var r = meow(last); last = r.text;
      var b = host.querySelector('[data-mini-meow]');
      b.classList.remove('pixel-bubble--pop'); void b.offsetWidth; b.classList.add('pixel-bubble--pop');
      b.querySelector('[data-say]').innerHTML = meowHTML(r);
      if (casts[key + ':memeow']) casts[key + ':memeow'].play(r.anim);
    });
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
    var m = { text: pick(['Meew meew meeew !', 'Meew !', 'Mrrreeew !']), icon: pick(['star', 'heart']) };
    celebrateEl.innerHTML =
      '<div class="celebrate__stars" aria-hidden="true">' + (reduced() ? '' : Array.apply(null, Array(10)).map(function (_, i) {
        return '<span class="celebrate__star" style="--i:' + i + ';--x:' + (Math.round(Math.random() * 200) - 100) + 'px;--r:' + Math.round(Math.random() * 360) + 'deg">' + U.pixelImg(i % 3 ? 'star' : 'heart', 1, '', '') + '</span>';
      }).join('')) + '</div>' +
      '<canvas data-cel="lamia" aria-hidden="true"></canvas>' +
      '<div class="celebrate__text"><strong>' + esc(o.title || 'Bravo !') + '</strong>' + (o.text ? '<span>' + esc(o.text) + '</span>' : '') +
        '<span class="celebrate__meow">' + meowHTML(m) + '</span></div>' +
      '<canvas data-cel="memeow" aria-hidden="true"></canvas>';
    celebrateEl.classList.remove('is-in'); void celebrateEl.offsetWidth; celebrateEl.classList.add('is-in');
    mount('cel:lamia', celebrateEl.querySelector('[data-cel="lamia"]'), L.store.me().character, 'cheer', 2);
    mount('cel:memeow', celebrateEl.querySelector('[data-cel="memeow"]'), 'memeow', 'meow', 2);
    celebrateTimer = setTimeout(function () {
      celebrateEl.classList.remove('is-in');
      setTimeout(function () { ['cel:lamia', 'cel:memeow'].forEach(function (k) { if (casts[k]) { casts[k].destroy(); delete casts[k]; } }); }, 400);
    }, o.duration || 3600);
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

  /* --- Memeow dans la barre latérale -------------------------------------------------- */
  function sidebarCat() {
    var foot = document.querySelector('.sidebar__foot');
    if (!foot || foot.querySelector('.side-cat')) return;
    var box = document.createElement('div');
    box.className = 'side-cat';
    box.innerHTML = '<p class="pixel-bubble pixel-bubble--tail-bottom side-cat__say" hidden aria-live="polite"></p>' +
      '<button type="button" class="side-cat__btn" aria-label="Caresser Memeow"><canvas aria-hidden="true"></canvas></button>';
    foot.insertBefore(box, foot.firstChild);
    var ctrl = mount('side:memeow', box.querySelector('canvas'), 'memeow', 'sleep', 2);
    var say = box.querySelector('.side-cat__say'), timer = null, last = '';
    box.querySelector('button').addEventListener('click', function () {
      var r = meow(last); last = r.text;
      say.innerHTML = meowHTML(r); say.hidden = false;
      say.classList.remove('pixel-bubble--pop'); void say.offsetWidth; say.classList.add('pixel-bubble--pop');
      if (ctrl) ctrl.play(r.anim === 'idle' ? 'meow' : r.anim);
      clearTimeout(timer);
      timer = setTimeout(function () { say.hidden = true; if (ctrl) ctrl.play('sleep'); }, 3500);
    });
  }

  /* --- Défilement animé ----------------------------------------------------------------
     Les blocs encore sous l'écran apparaissent en glissant quand on descend vers eux.
     Seulement à l'arrivée sur un onglet : un re-rendu (valeur saisie) ne rejoue rien. */
  var io = null, ioBatch = 0, ioTimer = null;
  var REVEAL = '.card, .stat, .hcard, .goal-card, .profile-card, .pet-card, .mini-scene, .hero, .profile-hero, .profile-section, .page-head + *';
  function reveal(view) {
    if (!view || reduced() || !('IntersectionObserver' in window)) return;
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var n = en.target;
          io.unobserve(n);
          n.style.transitionDelay = Math.min(ioBatch++, 5) * 70 + 'ms';
          n.classList.add('is-revealed');
          setTimeout(function () { n.classList.remove('reveal', 'is-revealed'); n.style.transitionDelay = ''; }, 1100);
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

  L.fun = { miniScene: miniScene, celebrate: celebrate, countUp: countUp, meow: meow, sidebarCat: sidebarCat, reveal: reveal, watchScroll: watchScroll };
})(window.Lamia = window.Lamia || {});
