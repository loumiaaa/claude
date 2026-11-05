/* ==========================================================================
   Plateforme de suivi - Lamia — badges et étapes
   Les badges se gagnent tout seuls, à partir des données (shared/badges.js).
   Un nouveau badge : petite fête avec Lamia et Memeow. Au fil des badges, des
   accessoires pixel se débloquent (fleur, nœud, béret, collier, couronnes) :
   on les fait porter à son personnage et à Memeow dans la « garde-robe ».
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, BD = window.LamiaShared.badges;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var ITEM_NAMES = { fleur: 'Fleur', beret: 'Béret', couronne: 'Couronne', noeud: 'Nœud rose', collier: 'Collier à grelot' };
  var el = null, casts = [], checkTimer = null;

  function list() { return BD.compute(S.get(), { today: D.today(), spaces: S.get().settings.spaces }); }
  function count(l) { return (l || list()).filter(function (b) { return b.got; }).length; }
  function unlocked(who, item, n) {
    return BD.rewards(n == null ? count() : n).some(function (r) { return r.who === who && r.item === item && r.unlocked; });
  }
  // Accessoires portés (et débloqués) : 'me' = son personnage, 'memeow'
  function extras(who) {
    var w = S.wardrobe()[who];
    return w && unlocked(who, w) ? [w] : [];
  }

  /* --- Nouveaux badges ------------------------------------------------------------ */
  function check() {
    var at = S.badgesAt(), l = list();
    var fresh = l.filter(function (b) { return b.got && !at[b.id]; });
    if (!fresh.length) return;
    var first = !Object.keys(at).length;
    var before = count(l) - fresh.length;
    S.markBadges(fresh.map(function (b) { return b.id; }));
    if (first && fresh.length > 1) return;            // premier lancement : rien à fêter d'un coup
    var b = fresh[0];
    L.fun.celebrate({ title: 'Nouveau badge : ' + b.title, text: fresh.length > 1 ? 'et ' + U.plural(fresh.length - 1, 'autre') + ' !' : b.desc + '.', duration: 4200 });
    var gift = BD.rewards(count(l)).filter(function (r) { return r.unlocked && r.need > before; })[0];
    if (gift) setTimeout(function () {
      U.toast({ kind: 'success', icon: 'sparkle', title: 'Cadeau débloqué : ' + gift.label, text: 'Viens l’essayer dans ta garde-robe.', duration: 9000,
        actions: [{ label: 'L’essayer', fn: function () { S.setWardrobe(gift.who, gift.item); location.hash = 'badges'; } }] });
    }, 4400);
  }
  function scheduleCheck() { clearTimeout(checkTimer); checkTimer = setTimeout(check, 900); }

  /* --- Vue --------------------------------------------------------------------------- */
  function destroyCasts() { casts.forEach(function (c) { try { c.destroy(); } catch (e) { /* rien */ } }); casts = []; }

  function wardrobeHTML(n) {
    var me = S.me(), w = S.wardrobe();
    function col(who, title, items) {
      return '<fieldset class="wardrobe__col"><legend class="wardrobe__title">' + esc(title) + '</legend><div class="wardrobe__items">' +
        ['none'].concat(items).map(function (it) {
          var ok = it === 'none' || unlocked(who, it, n), worn = (w[who] || 'none') === it || (it !== 'none' && w[who] === it);
          if (it === 'none') worn = !w[who] || !unlocked(who, w[who], n);
          var r = BD.REWARDS.filter(function (x) { return x.who === who && x.item === it; })[0];
          return '<label class="wardrobe__item' + (ok ? '' : ' is-locked') + (worn ? ' is-worn' : '') + '">' +
            '<input type="radio" name="wr-' + who + '" value="' + it + '" data-wear="' + who + '"' + (worn ? ' checked' : '') + (ok ? '' : ' disabled') + '>' +
            '<canvas data-wr-cast="' + (who === 'me' ? me.character : 'memeow') + '" data-wr-item="' + (it === 'none' ? '' : it) + '" aria-hidden="true"></canvas>' +
            '<span class="wardrobe__name">' + (it === 'none' ? 'Sans accessoire' : esc(ITEM_NAMES[it] || it)) + '</span>' +
            (ok ? '' : '<span class="wardrobe__lock">' + icon('alert') + U.plural(r.need, 'badge') + '</span>') + '</label>';
        }).join('') + '</div></fieldset>';
    }
    return '<section class="glass card" aria-labelledby="bd-wr"><div class="card__header"><div><h2 class="card__title" id="bd-wr">Garde-robe</h2>' +
      '<p class="card__subtitle">Les cadeaux débloqués avec tes badges. Ce que tu choisis ici se voit partout.</p></div></div>' +
      '<div class="wardrobe">' + col('me', me.name || 'Ton personnage', ['fleur', 'beret', 'couronne']) + col('memeow', 'Memeow', ['noeud', 'collier', 'couronne']) + '</div></section>';
  }

  function render() {
    if (!el) return;
    destroyCasts();
    var l = list(), n = count(l), at = S.badgesAt(), next = BD.nextReward(n);
    var got = l.filter(function (b) { return b.got; }).sort(function (a, b) { return (at[b.id] || '') < (at[a.id] || '') ? -1 : 1; });
    var todo = l.filter(function (b) { return !b.got; }).sort(function (a, b) { return b.pct - a.pct; });
    function badge(b) {
      return '<li class="badge-card' + (b.got ? ' is-got' : '') + '"><span class="badge-card__icon" aria-hidden="true">' + U.px(b.icon, 3) + '</span>' +
        '<span class="badge-card__title">' + esc(b.title) + '</span><span class="badge-card__desc">' + esc(b.desc) + '</span>' +
        (b.got ? '<span class="badge-card__when">' + icon('check') + (at[b.id] ? 'Gagné le ' + esc(D.dayMonth(at[b.id])) : 'Gagné') + '</span>'
          : '<span class="badge-card__prog">' + U.progress(b.pct, 'progress--sm') + '<span class="num">' + b.value + '/' + b.target + '</span></span>') + '</li>';
    }
    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Accueil</p><h1 class="h1" id="h-badges" tabindex="-1">Badges et étapes</h1>' +
        '<p class="page-head__lead">Ils se gagnent tout seuls, au fil de tes journées. Chaque badge rapproche d’un petit cadeau pixel.</p></div></header>' +
      '<section class="glass card badge-sum" aria-label="Progression"><div class="badge-sum__n"><strong class="num">' + n + '</strong><span>sur ' + l.length + ' badges</span></div>' +
        '<div class="badge-sum__bar">' + U.progress(Math.round(n / l.length * 100), '') +
        '<p class="hint">' + (next ? 'Prochain cadeau : <strong>' + esc(next.label.toLowerCase()) + '</strong>, dans ' + U.plural(next.left, 'badge') + '.' : 'Tous les cadeaux sont débloqués. Quelle collection !') + '</p></div></section>' +
      wardrobeHTML(n) +
      (got.length ? '<section aria-labelledby="bd-got"><h2 class="dash-section" id="bd-got">' + icon('sparkle') + 'Gagnés</h2><ul class="badge-grid" role="list">' + got.map(badge).join('') + '</ul></section>' : '') +
      (todo.length ? '<section aria-labelledby="bd-todo"><h2 class="dash-section" id="bd-todo">' + icon('target') + 'À venir</h2><ul class="badge-grid" role="list">' + todo.map(badge).join('') + '</ul></section>' : '');
    U.keepFocus(el, function () { el.innerHTML = html; });
    if (window.PixelCast) U.$$('[data-wr-cast]', el).forEach(function (c) {
      var it = c.getAttribute('data-wr-item');
      casts.push(window.PixelCast.mount(c, c.getAttribute('data-wr-cast'), { scale: 2, animation: 'idle', extras: it ? [it] : [] }));
    });
  }

  function mount(node) {
    el = node;
    el.addEventListener('change', function (e) {
      var r = e.target.closest('[data-wear]');
      if (!r) return;
      S.setWardrobe(r.getAttribute('data-wear'), r.value === 'none' ? null : r.value);
      U.toast({ icon: 'sparkle', title: r.value === 'none' ? 'Accessoire retiré' : (ITEM_NAMES[r.value] || r.value) + ' : ça te va bien !', duration: 2500 });
    });
    S.subscribe(function (type) {
      if (type === 'ui' || type === 'timer' || type === 'badges') { if (type === 'badges' && L.app.view() === 'badges') render(); return; }
      scheduleCheck();
      if (type === 'wardrobe' || type === 'reset' || type === 'profile') {
        if (L.app.view() === 'badges') render(); else el.dataset.stale = '1';
      }
    });
    setTimeout(check, 1500);
  }

  // Carte compacte de l'Accueil
  function cardHTML() {
    var l = list(), n = count(l), next = BD.nextReward(n);
    var close = l.filter(function (b) { return !b.got; }).sort(function (a, b) { return b.pct - a.pct; })[0];
    return '<section class="glass card life-card" aria-labelledby="dh-badges"><div class="card__header"><div><h2 class="card__title" id="dh-badges">' + U.px('medal', 2) + 'Badges</h2>' +
      '<p class="card__subtitle">' + n + ' sur ' + l.length + ' gagnés</p></div><a class="btn btn--ghost btn--sm" href="#badges">Voir' + icon('chevron-right') + '</a></div>' +
      U.progress(Math.round(n / l.length * 100), 'progress--sm') +
      (close ? '<p class="life-chip">' + U.px(close.icon) + ' Bientôt : ' + esc(close.title) + ' · ' + close.value + '/' + close.target + '</p>' : '') +
      (next ? '<p class="life-card__muted">' + U.px('gift') + ' ' + esc(next.label) + ' dans ' + U.plural(next.left, 'badge') + '</p>' : '') + '</section>';
  }

  L.badgesUI = { list: list, count: count, extras: extras, check: check, cardHTML: cardHTML };
  L.views = L.views || {};
  L.views.badges = { title: 'Badges', mount: mount, render: render, show: function () { delete el.dataset.stale; render(); } };
})(window.Lamia = window.Lamia || {});
